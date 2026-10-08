/** Explicit administrative erasure. Primary mutations are never resilience-retried. */
import { randomUUID } from "node:crypto";
import { ConvexHttpClient, type ConvexClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { digest } from "../../convex-dev/lib/factHistoryProvenance";
import type { ErasureDomain, ErasureProjection } from "../../convex-dev/lib/domainErasureScope";
import { prepareGraphErasure, eraseGraphItem, verifyGraphErasure, type PreparedGraphErasureItem } from "../graph/erasure";
import type { GraphAdapter, GraphJobReceipt } from "../graph/types";
import type { GraphErasureTransport } from "../graph/erasureTransport";

export type { ErasureDomain, ErasureProjection };
export const ERASURE_OPERATIONS = ["discoverPage","checkRecord","checkBinaryReferences","verifyPage","getReceiptPage","eraseRecord","purgeExpiredReceiptsPage"] as const;
type Operation = typeof ERASURE_OPERATIONS[number];
export interface ErasureCallOptions {signal?:AbortSignal}
export interface ErasureEnvelope {protocolVersion:1;domain:ErasureDomain;observationTime:number}
export interface ErasurePage extends ErasureEnvelope {table:string;page:ErasureProjection[];continueCursor:string;isDone:boolean;pageStatus?:"SplitRequired"|"SplitRecommended"|null;splitCursor?:string|null}
export interface ErasureOutcome extends ErasureEnvelope {
  operationId:string;itemKey:string;table:string;id:string;state:"committed"|"alreadyAbsent";
  deleted:number;detached:number;retainedVersions:number;messages:number;serializedBytes?:number;
  blobs:{storageId:string;disposition:"deleted"|"protected"|"missing"}[];graphJobs:GraphJobReceipt[];
}
export interface ErasureTransport {
  readonly kind:"cortex-erasure-v1";readonly protocolVersion:1;readonly operations:readonly Operation[];
  discoverPage(request:Record<string,unknown>,options?:ErasureCallOptions):Promise<ErasurePage>;
  checkRecord(request:Record<string,unknown>,options?:ErasureCallOptions):Promise<ErasureEnvelope & {record:ErasureProjection|null}>;
  checkBinaryReferences(request:Record<string,unknown>,options?:ErasureCallOptions):Promise<ErasureEnvelope & {blobs:unknown[]}>;
  verifyPage(request:Record<string,unknown>,options?:ErasureCallOptions):Promise<ErasurePage>;
  getReceiptPage(request:Record<string,unknown>,options?:ErasureCallOptions):Promise<ErasureEnvelope & {page:ErasureOutcome[];continueCursor:string;isDone:boolean}>;
  eraseRecord(request:Record<string,unknown>,options?:ErasureCallOptions):Promise<ErasureOutcome>;
  purgeExpiredReceiptsPage(request:Record<string,unknown>,options?:ErasureCallOptions):Promise<{protocolVersion:1;deleted:number;continueCursor:string;isDone:boolean}>;
  close():void;
}
export interface ErasureGraphParticipant {adapter:GraphAdapter;disposalTransport:GraphErasureTransport}
export interface ErasureOptions {erasureTransport?:ErasureTransport;tenantId?:string;signal?:AbortSignal;graphParticipant?:ErasureGraphParticipant;dryRun?:boolean;verify?:boolean}
export interface ErasureReceipt {
  version:1;operationId:string;domain:ErasureDomain;deletionScope:"exclusiveSupportedPrimary";
  executed:boolean;complete:boolean;fullUserDataErased:boolean;startedAt:number;endedAt:number;
  planned:ErasureProjection[];outcomes:ErasureOutcome[];remaining:string[];blockers:{id:string;reason:string}[];
  perTable:Record<string,{deleted:number;detached:number;preserved:number;alreadyAbsent:number;retainedVersions:number}>;
  totalDeleted:number;graph:{state:"notConfigured"|"prepared"|"complete"|"partial";jobs:GraphJobReceipt[];nodesDeleted:number};
  verification:{state:"notExecuted"|"notRequested"|"verified"|"failed";complete:boolean};
  exclusions:string[];errors:string[];unknown:string[];
}
export class ErasureError extends Error {
  constructor(readonly code:string,readonly receipt?:ErasureReceipt) {super(`Supported erasure stopped: ${code}. Inspect its receipt before continuing.`);this.name="ErasureError";}
}
export class ErasureTransportError extends Error {
  constructor(readonly code:string,readonly operation:Operation,readonly outcome:"notSent"|"rolledBack"|"unknown") {super(`Administrative erasure ${operation} failed: ${code}.`);this.name="ErasureTransportError";}
}
const object=(x:unknown):x is Record<string,unknown>=>Boolean(x)&&typeof x==="object"&&!Array.isArray(x);
const compact=(x:unknown):unknown=>Array.isArray(x)?x.map(compact):object(x)?Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined).map(([k,v])=>[k,compact(v)])):x;
export function assertErasureTransport(value:unknown):asserts value is ErasureTransport {
  if(!object(value)||value.kind!=="cortex-erasure-v1"||value.protocolVersion!==1||!Array.isArray(value.operations)||value.operations.length!==7||ERASURE_OPERATIONS.some(operation=>!(value.operations as unknown[]).includes(operation)||typeof value[operation]!=="function")||typeof value.close!=="function")throw new ErasureError("ERASURE_ADMIN_TRANSPORT_REQUIRED");
}
export function createErasureTransport(options:{url:string;deploymentKey:string;timeoutMs?:number}):ErasureTransport {
  let url:URL;try{url=new URL(options.url);}catch{throw new ErasureError("ERASURE_ADMIN_TRANSPORT_REQUIRED");}
  const timeout=options.timeoutMs??30000;
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=="/"||!options.deploymentKey?.trim()||!Number.isInteger(timeout)||timeout<1||timeout>30000)throw new ErasureError("ERASURE_ADMIN_TRANSPORT_REQUIRED");
  const active=new Set<AbortController>();let closed=false,inFlight=false;
  async function call(operation:Operation,request:Record<string,unknown>,optionsCall:ErasureCallOptions={}):Promise<unknown> {
    if(closed||inFlight||optionsCall.signal?.aborted)throw new ErasureTransportError("ERASURE_CANCELLED",operation,"notSent");
    const controller=new AbortController();active.add(controller);inFlight=true;let sent=false,expired=false,nativeRejected=false;
    const cancel=()=>controller.abort();optionsCall.signal?.addEventListener("abort",cancel,{once:true});
    const timer=setTimeout(()=>{expired=true;controller.abort();},timeout);
    try {
      const guardedFetch:typeof fetch=async(input,init)=>{
        if(Buffer.byteLength(String(init?.body??""))>1024*1024)throw new ErasureTransportError("ERASURE_REQUEST_TOO_LARGE",operation,"notSent");
        sent=true;const response=await fetch(input,{...init,signal:controller.signal,redirect:"error"});
        const reader=response.body?.getReader();if(!reader)throw new ErasureTransportError("ERASURE_PROTOCOL",operation,"unknown");
        const chunks:Uint8Array[]=[];let bytes=0;
        try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>8*1024*1024)throw new ErasureTransportError("ERASURE_RESPONSE_TOO_LARGE",operation,"unknown");chunks.push(next.value);}}
        finally{try{await reader.cancel();}finally{reader.releaseLock();}}
        if(response.status===401||response.status===403)throw new ErasureTransportError("ERASURE_AUTHORIZATION",operation,"rolledBack");
        const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
        // A complete official UDF error envelope confirms transaction rollback,
        // including runtime errors which the client exposes as plain Error.
        // Incomplete/malformed responses remain unknown and are never resent.
        if(response.status===200||response.status===560) {
          try {const body:unknown=JSON.parse(new TextDecoder().decode(joined));nativeRejected=object(body)&&body.status==="error";}
          catch { /* The official client still receives the original bytes. */ }
        }
        return new Response(joined,{status:response.status,headers:response.headers});
      };
      const candidate:unknown=new ConvexHttpClient(url.origin,{logger:false,fetch:guardedFetch,skipConvexDeploymentUrlCheck:true});
      if(!object(candidate)||typeof candidate.setAdminAuth!=="function"||typeof candidate.function!=="function")throw new ErasureTransportError("ERASURE_ADMIN_TRANSPORT_REQUIRED",operation,"notSent");
      const client=candidate as {setAdminAuth(key:string):void;function(name:string,component:undefined,args:Record<string,unknown>):Promise<unknown>};
      client.setAdminAuth(options.deploymentKey);
      const result=await client.function(`domainErasure:${operation}`,undefined,compact(request) as Record<string,unknown>);
      if(!object(result)||result.protocolVersion!==1||(operation!=="purgeExpiredReceiptsPage"&&digest(result.domain)!==digest(request.domain)))throw new ErasureTransportError("ERASURE_PROTOCOL",operation,"unknown");
      return result;
    } catch(error) {
      if(error instanceof ErasureTransportError)throw error;
      if(error instanceof ConvexError) {const code=object(error.data)&&typeof error.data.code==="string"&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.data.code)?error.data.code:"ERASURE_NATIVE_REFUSAL";throw new ErasureTransportError(code,operation,"rolledBack");}
      if(nativeRejected)throw new ErasureTransportError("ERASURE_NATIVE_REFUSAL",operation,"rolledBack");
      throw new ErasureTransportError(expired?"ERASURE_DEADLINE":controller.signal.aborted?"ERASURE_CANCELLED":"ERASURE_RESPONSE_UNKNOWN",operation,sent?"unknown":"notSent");
    } finally{clearTimeout(timer);optionsCall.signal?.removeEventListener("abort",cancel);active.delete(controller);inFlight=false;}
  }
  return Object.freeze({kind:"cortex-erasure-v1" as const,protocolVersion:1 as const,operations:ERASURE_OPERATIONS,
    discoverPage:(r:Record<string,unknown>,o?:ErasureCallOptions)=>call("discoverPage",r,o) as Promise<ErasurePage>,
    checkRecord:(r:Record<string,unknown>,o?:ErasureCallOptions)=>call("checkRecord",r,o) as ReturnType<ErasureTransport["checkRecord"]>,
    checkBinaryReferences:(r:Record<string,unknown>,o?:ErasureCallOptions)=>call("checkBinaryReferences",r,o) as ReturnType<ErasureTransport["checkBinaryReferences"]>,
    verifyPage:(r:Record<string,unknown>,o?:ErasureCallOptions)=>call("verifyPage",r,o) as Promise<ErasurePage>,
    getReceiptPage:(r:Record<string,unknown>,o?:ErasureCallOptions)=>call("getReceiptPage",r,o) as ReturnType<ErasureTransport["getReceiptPage"]>,
    eraseRecord:(r:Record<string,unknown>,o?:ErasureCallOptions)=>call("eraseRecord",r,o) as Promise<ErasureOutcome>,
    purgeExpiredReceiptsPage:(r:Record<string,unknown>,o?:ErasureCallOptions)=>call("purgeExpiredReceiptsPage",r,o) as ReturnType<ErasureTransport["purgeExpiredReceiptsPage"]>,
    close:()=>{closed=true;for(const controller of active)controller.abort();}});
}
export const ERASURE_TABLES=["immutable","mutable","conversations","memories","facts","factHistory","contexts","sessions","artifacts","attachments","conversationShares","conversationSnapshots","memorySpaces","agents","governancePolicies","governanceEnforcement","graphSyncQueue"] as const;
function active(options:ErasureOptions) {if(options.signal?.aborted)throw new ErasureError("ERASURE_CANCELLED");}
/** Each provisional split is discarded; child ranges and the original tail are exhausted. */
export async function discoverErasure(domain:ErasureDomain,transport:ErasureTransport,options:ErasureOptions,verify=false):Promise<ErasureProjection[]> {
  const found=new Map<string,ErasureProjection>();
  const tables=domain.kind==="space"?["memorySpaces",...ERASURE_TABLES.filter(t=>t!=="memorySpaces")]:[...ERASURE_TABLES];
  for(const table of tables) {
    const ranges:{cursor:string|null;endCursor:string|null}[]=[{cursor:null,endCursor:null}];const visited=new Set<string>();
    while(ranges.length) {
      active(options);const range=ranges.shift()!,key=JSON.stringify(range);if(visited.has(key))throw new ErasureError("ERASURE_PAGE_NONPROGRESS");visited.add(key);
      const page=await transport[verify?"verifyPage":"discoverPage"]({domain,table,...range,numItems:16},{signal:options.signal});
      if(page.table!==table||!Array.isArray(page.page)||typeof page.continueCursor!=="string"||typeof page.isDone!=="boolean")throw new ErasureError("ERASURE_PROTOCOL");
      if(page.pageStatus==="SplitRequired"||page.pageStatus==="SplitRecommended") {
        if(!page.splitCursor||page.splitCursor===range.cursor||page.splitCursor===range.endCursor||page.splitCursor===page.continueCursor)throw new ErasureError("ERASURE_PAGE_NONPROGRESS");
        ranges.unshift({cursor:range.cursor,endCursor:page.splitCursor},{cursor:page.splitCursor,endCursor:page.continueCursor});
        if(!page.isDone)ranges.splice(2,0,{cursor:page.continueCursor,endCursor:range.endCursor});continue;
      }
      for(const record of page.page) {
        if(record.table!==table||!record.id||!record.fingerprint||!Array.isArray(record.dependencies))throw new ErasureError("ERASURE_PROTOCOL");
        const previous=found.get(record.id);if(previous&&digest(previous)!==digest(record))throw new ErasureError("ERASURE_SELECTION_CHANGED");found.set(record.id,record);
      }
      if(!page.isDone) {if(page.continueCursor===range.cursor)throw new ErasureError("ERASURE_PAGE_NONPROGRESS");ranges.unshift({cursor:page.continueCursor,endCursor:range.endCursor});}
    }
  }
  return [...found.values()];
}
/** Hard dependencies must be acyclic. Server-proven ordinary data SCCs use stable order. */
export function orderErasure(records:ErasureProjection[]):ErasureProjection[] {
  const selected=records.filter(row=>["delete","detach","root"].includes(row.action));
  const nodes=new Map(selected.map(row=>[row.id,row])),degree=new Map(selected.map(row=>[row.id,0]));
  const edges=new Map<string,Set<string>>();
  for(const row of selected)for(const edge of row.dependencies)if(edge.kind==="hard"&&nodes.has(edge.id)) {
    const outgoing=edges.get(row.id)??new Set<string>();if(!outgoing.has(edge.id)){degree.set(edge.id,degree.get(edge.id)!+1);outgoing.add(edge.id);}edges.set(row.id,outgoing);
  }
  // Prefer dependency leaves even for noncyclic data links. Pure data cycles break by stable rank.
  const rank=(row:ErasureProjection)=>row.action==="root"?100:row.action==="detach"?90:ERASURE_TABLES.indexOf(row.table);
  const sort=(a:ErasureProjection,b:ErasureProjection)=>rank(a)-rank(b)||a.id.localeCompare(b.id);
  const ready=selected.filter(row=>degree.get(row.id)===0).sort(sort),result:ErasureProjection[]=[];
  while(ready.length){
    const available=ready.findIndex(candidate=>!ready.some(other=>other.id!==candidate.id&&other.dependencies.some(edge=>edge.id===candidate.id)));
    const row=ready.splice(available<0?0:available,1)[0];result.push(row);
    for(const id of edges.get(row.id)??[]){degree.set(id,degree.get(id)!-1);if(degree.get(id)===0){ready.push(nodes.get(id)!);ready.sort(sort);}}
  }
  if(result.length!==selected.length)throw new ErasureError("ERASURE_DEPENDENCY_CYCLE");
  // Root and detachments may not be pulled ahead of live dependents by table rank.
  return [...result.filter(row=>row.action==="delete"),...result.filter(row=>row.action==="detach"),...result.filter(row=>row.action==="root")];
}
export interface PreparedErasure {receipt:ErasureReceipt;order:ErasureProjection[];graph:PreparedGraphErasureItem[];options:ErasureOptions}
export async function prepareErasure(domain:ErasureDomain,options:ErasureOptions,configuredAdapter?:GraphAdapter):Promise<PreparedErasure> {
  assertErasureTransport(options.erasureTransport);active(options);
  if(configuredAdapter&&(!options.graphParticipant||options.graphParticipant.adapter!==configuredAdapter))throw new ErasureError("ERASURE_GRAPH_PARTICIPANT_REQUIRED");
  const planned=await discoverErasure(domain,options.erasureTransport,options),order=orderErasure(planned);
  const receipt:ErasureReceipt={version:1,operationId:randomUUID(),domain,deletionScope:"exclusiveSupportedPrimary",executed:false,complete:false,fullUserDataErased:false,startedAt:Date.now(),endedAt:Date.now(),planned,outcomes:[],remaining:order.map(row=>row.id),blockers:planned.filter(row=>row.action==="block").map(row=>({id:row.id,reason:row.reason??"ERASURE_BLOCKED"})),perTable:{},totalDeleted:0,graph:{state:options.graphParticipant?"prepared":"notConfigured",jobs:[],nodesDeleted:0},verification:{state:"notExecuted",complete:false},exclusions:["sharedRegistry","operationalGovernance","protectedOperationalProvenance","temporarySevenDayReceipts","externalManualOrPreviouslyConfiguredGraph"],errors:[],unknown:[]};
  for(const table of ERASURE_TABLES)receipt.perTable[table]={deleted:0,detached:0,preserved:planned.filter(row=>row.table===table&&row.action==="preserve").length,alreadyAbsent:0,retainedVersions:0};
  if(receipt.blockers.length)throw new ErasureError("ERASURE_PREFLIGHT_BLOCKED",receipt);
  for(const record of order) {
    const request={domain,table:record.table,id:record.id,expectedFingerprint:record.fingerprint};
    const checked=await options.erasureTransport.checkRecord(request,{signal:options.signal});if(!checked.record||digest(checked.record)!==digest(record))throw new ErasureError("ERASURE_SELECTION_CHANGED",receipt);
    await options.erasureTransport.checkBinaryReferences(request,{signal:options.signal});
    if(record.managedQueueCount&&!options.graphParticipant)throw new ErasureError("ERASURE_GRAPH_PARTICIPANT_REQUIRED",receipt);
  }
  const graph=options.graphParticipant?await prepareGraphErasure(order.flatMap(row=>row.graph?[row.graph]:[]),options.graphParticipant):[];
  return {receipt,order,graph,options};
}
function mergeOutcome(receipt:ErasureReceipt,outcome:ErasureOutcome) {
  if(![0,1].includes(outcome.deleted)||![0,1].includes(outcome.detached)||outcome.deleted+outcome.detached>1||!Number.isSafeInteger(outcome.retainedVersions)||outcome.retainedVersions<0||!Number.isSafeInteger(outcome.messages)||outcome.messages<0||!Array.isArray(outcome.blobs)||!Array.isArray(outcome.graphJobs)||outcome.state==="alreadyAbsent"&&(outcome.deleted!==0||outcome.detached!==0||outcome.retainedVersions!==0||outcome.messages!==0))throw new ErasureError("ERASURE_PROTOCOL",receipt);
  receipt.outcomes.push(outcome);receipt.remaining=receipt.remaining.filter(id=>id!==outcome.id);
  const counts=receipt.perTable[outcome.table];if(!counts)throw new ErasureError("ERASURE_PROTOCOL",receipt);
  if(outcome.state==="committed"){counts.deleted+=outcome.deleted;counts.detached+=outcome.detached;counts.retainedVersions+=outcome.retainedVersions;receipt.totalDeleted+=outcome.deleted;}
  else counts.alreadyAbsent++;
  receipt.graph.jobs.push(...outcome.graphJobs);
}
export async function executeErasure(prepared:PreparedErasure,client:ConvexClient):Promise<ErasureReceipt> {
  const {receipt,order,options}=prepared,transport=options.erasureTransport!;
  if(options.dryRun){receipt.endedAt=Date.now();return receipt;}
  const graphDelivered:PreparedGraphErasureItem[]=[];
  try {
    for(const record of order) {
      active(options);
      // Mandatory rolling remaining-data closure and graph verification precede the final root.
      if(record.action==="root") {
        const current=await discoverErasure(receipt.domain,transport,options,true);
        if(current.some(row=>row.id!==record.id&&["delete","detach","root","block"].includes(row.action)))throw new ErasureError("ERASURE_REMAINING_PRIMARY",receipt);
        if(options.graphParticipant&&graphDelivered.length) {const verified=await verifyGraphErasure(graphDelivered.map(item=>item.item),{...options.graphParticipant,jobs:receipt.graph.jobs});if(!verified.complete)throw new ErasureError("ERASURE_GRAPH_INCOMPLETE",receipt);}
      }
      const request={domain:receipt.domain,table:record.table,id:record.id,expectedFingerprint:record.fingerprint,operationId:receipt.operationId,itemKey:`${record.table}:${record.id}`,domainDigest:digest(receipt.domain),graphInvocationId:options.graphParticipant?`${receipt.operationId}:${record.id}`:undefined};
      let outcome:ErasureOutcome;
      try{outcome=await transport.eraseRecord({...request,requestDigest:digest(request)},{signal:options.signal});}
      catch(error) {
        if(!(error instanceof ErasureTransportError)||error.outcome!=="unknown")throw error;
        // Read the original receipt once, without replaying the mutation or selecting a new alias.
        receipt.unknown.push(record.id);
        const reconciled=await transport.getReceiptPage({domain:receipt.domain,operationId:receipt.operationId,itemKey:request.itemKey,cursor:null,numItems:2});
        if(reconciled.page.length!==1){receipt.unknown.push(record.id);throw new ErasureError("ERASURE_OUTCOME_UNKNOWN",receipt);}
        outcome=reconciled.page[0];
        receipt.unknown=receipt.unknown.filter(id=>id!==record.id);
      }
      if(outcome.itemKey!==request.itemKey||outcome.operationId!==receipt.operationId||outcome.id!==record.id||outcome.table!==record.table||!["committed","alreadyAbsent"].includes(outcome.state))throw new ErasureError("ERASURE_PROTOCOL",receipt);
      mergeOutcome(receipt,outcome);receipt.executed=true;
      const graph=prepared.graph.find(item=>item.item.identity.physicalSourceId===record.id);
      if(graph&&outcome.state==="committed") {const result=await eraseGraphItem(graph,{client,jobs:outcome.graphJobs});receipt.graph.nodesDeleted+=result.nodesDeleted;graphDelivered.push(graph);}
    }
    if(options.graphParticipant) {const verified=await verifyGraphErasure(graphDelivered.map(item=>item.item),{...options.graphParticipant,jobs:receipt.graph.jobs});if(!verified.complete)throw new ErasureError("ERASURE_GRAPH_INCOMPLETE",receipt);receipt.graph.state="complete";}
    if(options.verify===false)receipt.verification={state:"notRequested",complete:false};
    else {
      const remaining=await discoverErasure(receipt.domain,transport,options,true);receipt.remaining=remaining.filter(row=>["delete","detach","root","block"].includes(row.action)).map(row=>row.id);
      receipt.verification={state:receipt.remaining.length?"failed":"verified",complete:receipt.remaining.length===0};
      if(receipt.remaining.length)throw new ErasureError("ERASURE_POSTVERIFY_FAILED",receipt);
    }
    receipt.complete=receipt.verification.complete;receipt.fullUserDataErased=false;receipt.endedAt=Date.now();return receipt;
  } catch(error) {
    receipt.endedAt=Date.now();receipt.errors.push(error instanceof ErasureError||error instanceof ErasureTransportError?error.code:"ERASURE_PARTIAL");if(options.graphParticipant)receipt.graph.state="partial";
    throw new ErasureError(receipt.errors.at(-1)!,receipt);
  }
}
