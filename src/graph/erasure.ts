/** Managed delivery and scoped erasure share the same physical SourceState gate. */
import {randomUUID} from "node:crypto";
import {ConvexError,type Value} from "convex/values";
import type {ConvexClient} from "convex/browser";
import {api} from "../../convex-dev/_generated/api";
import type {Id} from "../../convex-dev/_generated/dataModel";
import type {GraphAdapter,GraphIdentity,GraphJob,GraphJobReceipt,GraphProjection,GraphApplyResult,ManagedGraphTransaction,GraphSyncPolicy,GraphScope} from "./types";
import {GraphDatabaseError,GraphCommittedPartial,GraphPrimaryOutcomeUnknown,GraphJobUnresolved} from "./types";
import {MANAGED_LABELS,MANAGED_RELATIONSHIPS,identityProperties,assertIdentityProperties,derivedGraphIdentity,graphDigest,canonicalGraphJson,validateGraphJob,graphSourceDigest} from "./identity";
import {assertManagedGraphCompatibility} from "./schema/initSchema";
import {getFunctionName,type FunctionReference,type FunctionArgs,type FunctionReturnType} from "convex/server";
import {FactCommitOutcomeUnknownError,FactCommittedReceiptUnresolvedError,FactCommittedResultUnavailableError,type HistoryReceipt} from "../facts/history";
import {mutateSelected,assertDomainActive,waitDomainOperation,partialFrom,type SelectedRecord} from "../common/domainPaging";
import {DomainOperationPartialError,type DomainReadOptions,type DomainPartial,type DomainItemOutcome,type DomainGraphIdentity} from "../types";
import type {GraphErasureTransport,GraphErasureStatus,GraphErasurePreflightPage} from "./erasureTransport";
export type GraphPrimary<T> = T extends {graphVersion:2;primaryResult:infer R} ? R : T;
export interface GraphCaptureMetadata {graphJobs?:GraphJobReceipt[];graphDisposition?:"queued"|"delivered";}
export function isGraphWriteFailure(error:unknown):boolean {
  return error instanceof GraphDatabaseError||error instanceof GraphPrimaryOutcomeUnknown||error instanceof GraphCommittedPartial||error instanceof GraphJobUnresolved||
    error instanceof FactCommitOutcomeUnknownError||error instanceof FactCommittedReceiptUnresolvedError||error instanceof FactCommittedResultUnavailableError;
}
/** Graph-off consumers must never discard captured jobs accidentally. */
export function graphOffResult<T>(value:T):GraphPrimary<T> {
  if(value && typeof value==="object" && "graphVersion" in value)
    throw new GraphDatabaseError("Unexpected graph capture in a graph-off operation; retain its jobs for reconciliation.","GRAPH_POLICY_MISMATCH");
  return value as GraphPrimary<T>;
}
/** Preserve Task22's primary settlement distinctions when graph delivery fails after a received commit. */
export async function mutateGraphSelected<T>(name:string,selected:SelectedRecord<T>[],send:(row:SelectedRecord<T>)=>Promise<{deleted:boolean;graphIdentity?:DomainGraphIdentity}>,
  options:DomainReadOptions|undefined,adapter:GraphAdapter|undefined):Promise<DomainPartial> {
  if(!requestedGraph(adapter,options?.syncToGraph))return mutateSelected(name,selected,send,options);
  const outcomes:DomainItemOutcome[]=selected.map(row=>({physicalId:row.physicalId,disposition:"unstarted"}));
  for(let i=0;i<selected.length;i++) {
    try{assertDomainActive(options);}catch(cause){throw new DomainOperationPartialError(name,partialFrom(outcomes),cause);}
    let operation:ReturnType<typeof send>;
    try{operation=send(selected[i]);}catch(cause){throw new DomainOperationPartialError(name,partialFrom(outcomes),cause);}
    try{const result=await waitDomainOperation(operation,options);outcomes[i].disposition=result.deleted?"knownCommitted":"alreadyAbsent";outcomes[i].graphIdentity=result.graphIdentity;}
    catch(cause){
      if(cause instanceof GraphCommittedPartial) {const result=cause.primaryResult as {deleted?:boolean;graphIdentity?:DomainGraphIdentity};outcomes[i].disposition=result.deleted?"knownCommitted":"alreadyAbsent";outcomes[i].graphIdentity=result.graphIdentity;outcomes[i].graphJobs=cause.jobs;}
      else outcomes[i].disposition=cause instanceof ConvexError?"knownRolledBack":"outcomeUnknown";
      throw new DomainOperationPartialError(name,partialFrom(outcomes),cause);
    }
  }
  return partialFrom(outcomes);
}
const cleanIntent=(value:unknown):unknown=>Array.isArray(value)?value.map(cleanIntent):value && typeof value==="object" && !(value instanceof ArrayBuffer)?
  Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,cleanIntent(v)])):value;
/** Fixed native writer forwarding. The source transaction, never these arguments, supplies graph authority. */
export async function writeGraphMutation<M extends FunctionReference<"mutation","public">>(client:ConvexClient,adapter:GraphAdapter|undefined,
  policy:GraphSyncPolicy|undefined,reference:M,args:FunctionArgs<M>,explicit?:boolean):Promise<GraphPrimary<FunctionReturnType<M>> & GraphCaptureMetadata> {
  const domain=getFunctionName(reference),scope:GraphScope={tenantKnown:true,tenantId:typeof args.tenantId==="string"?args.tenantId:null,
    memorySpaceId:typeof args.memorySpaceId==="string"?args.memorySpaceId:null};
  if(!requestedGraph(adapter,explicit))return graphOffResult(await client.mutation(reference,args));
  let original={...args};
  const fact=domain.startsWith("facts:"),name=domain.split(":")[1];
  if(fact && name==="store" && !original.historyIntent)original={...original,historyIntent:{operationId:randomUUID(),phase:"store"}};
  const history=map(original.historyIntent),operationId=typeof history.operationId==="string"?history.operationId:typeof original.operationId==="string"?original.operationId:undefined,
    phase=typeof history.phase==="string"?history.phase:({update:"update",deleteFact:"delete",deleteMany:"physical_delete",consolidate:"consolidate",supersede:"supersede"} as Record<string,string>)[name];
  try {
    return await writeWithGraph(client,adapter,policy,scope,domain,cleanIntent(original),queueGraph=>client.mutation(reference,{...original,queueGraph}),explicit,
      typeof original.expectedPhysicalId==="string"?[original.expectedPhysicalId]:[]);
  } catch(error) {
    if(error instanceof ConvexError && error.data && typeof error.data==="object" && "code" in error.data &&
      typeof error.data.code==="string" && /^(GRAPH_|REFERENCE_)/.test(error.data.code))
      throw new GraphDatabaseError("Native graph capture refused atomically; resolve its preparation or projection before retry.",error.data.code);
    // A graph delivery failure already has a received committed result; never reinterpret it as primary uncertainty.
    if(!fact || error instanceof GraphCommittedPartial || !(error instanceof GraphPrimaryOutcomeUnknown ||
      error instanceof ConvexError && error.data==="FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE"))throw error;
    if(!operationId || !phase || typeof original.memorySpaceId!=="string")throw new FactCommitOutcomeUnknownError(operationId??"unavailable",phase??name,error);
    let receipt:HistoryReceipt|null;
    try {receipt=await client.query(api.factHistory.getOperationReceipt,{memorySpaceId:original.memorySpaceId,tenantId:scope.tenantId??undefined,operationId,phase});}
    catch(receiptError){throw new FactCommittedReceiptUnresolvedError(operationId,phase,{memorySpaceId:original.memorySpaceId,tenantId:scope.tenantId??undefined},"unavailable",error,receiptError);}
    if(!receipt)throw new FactCommitOutcomeUnknownError(operationId,phase,error);
    const expected=graphDigest(cleanIntent(original) as Value);
    if(!receipt.events.length || receipt.events.some(event=>event.pending?.payload.requestDigest!==expected))
      throw new FactCommittedReceiptUnresolvedError(operationId,phase,{memorySpaceId:original.memorySpaceId,tenantId:scope.tenantId??undefined},"missing",error);
    const jobs=receipt.graphJobs as GraphJobReceipt[];
    if(!Array.isArray(jobs)||!jobs.length)throw new GraphJobUnresolved();
    if(policy?.mode!=="background")try{for(const job of jobs)await deliverGraphJob(client,adapter!,job);}catch(cause){
      throw new GraphCommittedPartial({historyReceipt:receipt,primaryResultUnavailable:true},jobs,"failed",cause instanceof GraphDatabaseError?cause.code??"GRAPH_DELIVERY_FAILED":"GRAPH_ACK_UNKNOWN");
    }
    throw new FactCommittedResultUnavailableError(receipt,{memorySpaceId:original.memorySpaceId,tenantId:scope.tenantId??undefined},error);
  }
}
const empty = ():GraphApplyResult=>({disposition:"applied",nodesCreated:0,nodesDeleted:0,relationshipsCreated:0,relationshipsDeleted:0,absentTargets:[]});
const label=(identity:GraphIdentity)=>MANAGED_LABELS[identity.kind];
const map=(x:unknown):Record<string,unknown>=>x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};
const rel=(name:string)=>{
  if(!(MANAGED_RELATIONSHIPS as readonly string[]).includes(name))throw new GraphDatabaseError("Unsupported managed relationship.","GRAPH_RELATIONSHIP_UNSUPPORTED");
  return name;
};
function add(result:GraphApplyResult,stats?:{nodesCreated?:number;nodesDeleted?:number;relationshipsCreated?:number;relationshipsDeleted?:number}) {
  result.nodesCreated+=stats?.nodesCreated??0;result.nodesDeleted+=stats?.nodesDeleted??0;
  result.relationshipsCreated+=stats?.relationshipsCreated??0;result.relationshipsDeleted+=stats?.relationshipsDeleted??0;
}
async function gate(tx:ManagedGraphTransaction,identity:GraphIdentity) {
  const properties=identityProperties(identity);
  const ensured=await tx.query("MERGE (s:CortexV2SourceState {key:$key}) ON CREATE SET s += $properties, s.sourceRevision=-1, s.tombstoned=false, s.gateEpoch=0 RETURN properties(s) AS state",{key:identity.key,properties});
  if(ensured.count!==1)throw new GraphDatabaseError("SourceState is ambiguous.","GRAPH_IDENTITY_MISMATCH");
  assertIdentityProperties(map(ensured.records[0].state),identity);
  const locked=await tx.query("MATCH (s:CortexV2SourceState {key:$key}) SET s.gateEpoch=s.gateEpoch+1 RETURN properties(s) AS state",{key:identity.key});
  if(locked.count!==1)throw new GraphDatabaseError("SourceState disappeared.","GRAPH_IDENTITY_MISMATCH");
  const state=map(locked.records[0].state);assertIdentityProperties(state,identity);
  if(!Number.isSafeInteger(state.sourceRevision)||typeof state.tombstoned!=="boolean")throw new GraphDatabaseError("SourceState revision is invalid.","GRAPH_IDENTITY_MISMATCH");
  return state;
}
async function incidents(tx:ManagedGraphTransaction,identity:GraphIdentity) {
  const response=await tx.query(`MATCH (n:${label(identity)} {key:$key})-[r]-(other) RETURN type(r) AS type,properties(r) AS edge,labels(other) AS labels,properties(other) AS endpoint LIMIT 65`,{key:identity.key});
  if(response.count>64)throw new GraphDatabaseError("Managed graph relationship degree exceeds the fixed transaction budget.","GRAPH_RELATIONSHIP_BUDGET");
  for(const row of response.records) {
    const edge=map(row.edge),endpoint=map(row.endpoint),labels=Array.isArray(row.labels)?row.labels:[];
    if(!(MANAGED_RELATIONSHIPS as readonly unknown[]).includes(row.type)||edge.schemaVersion!==2||endpoint.schemaVersion!==2||
      !labels.some(x=>(Object.values(MANAGED_LABELS) as unknown[]).includes(x))||endpoint.tenantTag!==identityProperties(identity).tenantTag||
      endpoint.tenantValue!==identityProperties(identity).tenantValue||
      !((edge.sourceKey===identity.key&&edge.sourceTuple===identity.tupleJson&&edge.targetKey===endpoint.key&&edge.targetTuple===endpoint.tupleJson)||
      (edge.targetKey===identity.key&&edge.targetTuple===identity.tupleJson&&edge.sourceKey===endpoint.key&&edge.sourceTuple===endpoint.tupleJson)))
      throw new GraphDatabaseError("Manual, foreign or legacy incident relationships are preserved. Resolve them explicitly before erasure.","GRAPH_ERASURE_BLOCKED");
  }
  return response;
}
/** Identical bounded ownership guard before primary erase and during graph delete. */
async function ownedRelationships(tx:ManagedGraphTransaction,identity:GraphIdentity) {
  const owned=await tx.query("MATCH ()-[r]->() WHERE r.ownerKey=$key RETURN properties(r) AS edge LIMIT 65",{key:identity.key});
  if(owned.count>64 || owned.records.some(r=>map(r.edge).schemaVersion!==2||map(r.edge).ownerTuple!==identity.tupleJson))throw new GraphDatabaseError("Foreign source-owned graph relationship is preserved.","GRAPH_ERASURE_BLOCKED");
  return owned;
}
function nodeProperties(projection:GraphProjection):Record<string,unknown> {
  const properties:Record<string,unknown>={...identityProperties(projection.identity),sourceRevision:projection.sourceRevision,
    projectionJson:canonicalGraphJson(projection.properties as Value)};
  // Fixed graph field semantics; nested values use official canonical JSON instead of user-defined property names.
  for(const [key,value]of Object.entries(projection.properties)) {
    if(!/^[A-Za-z][A-Za-z0-9]*$/.test(key))throw new GraphDatabaseError("Unsupported graph projection property.","GRAPH_PROJECTION_INVALID");
    const displayKey = key === "kind" ? "artifactKind" : key === "key" ? "mutableKey" : key;
    properties[displayKey]=value&&typeof value==="object"&&(!Array.isArray(value)||value.some(item=>item&&typeof item==="object"))?canonicalGraphJson(value as Value):value;
  }
  return properties;
}
async function apply(tx:ManagedGraphTransaction,job:GraphJob,phase:"all"|"nodes"|"edges"="all"):Promise<GraphApplyResult> {
  const result=empty(),projection=job.projection,identity=job.identity;
  const targets=new Map<string,GraphIdentity>([[identity.key,identity]]);
  for(const reference of projection.references) {
    identityProperties(reference.identity);
    if(reference.identity.tenantId!==identity.tenantId)throw new GraphDatabaseError("Foreign graph reference.","GRAPH_SCOPE_MISMATCH");
    const prior=targets.get(reference.identity.key);
    if(prior&&prior.tupleJson!==reference.identity.tupleJson)throw new GraphDatabaseError("Graph reference tuple mismatch.","GRAPH_IDENTITY_MISMATCH");
    targets.set(reference.identity.key,reference.identity);
  }
  if(projection.references.length+projection.derived.length+(projection.derivedRelations?.length??0)>64||projection.derived.length+1>32)throw new GraphDatabaseError("Managed graph batch budget exceeded.","GRAPH_TRANSACTION_BUDGET");
  const states=new Map<string,Record<string,unknown>>();
  for(const [key,target]of [...targets].sort(([a],[b])=>a<b?-1:a>b?1:0))states.set(key,await gate(tx,target));
  const state=states.get(identity.key)!,revision=state.sourceRevision as number;
  const existing=await tx.query(`MATCH (n:${label(identity)} {key:$key}) RETURN properties(n) AS node`,{key:identity.key});
  if(existing.count>1)throw new GraphDatabaseError("Managed source node is ambiguous.","GRAPH_IDENTITY_MISMATCH");
  if(existing.count)assertIdentityProperties(map(existing.records[0].node),identity);
  if(job.operation==="delete") {
    if(revision>job.sourceRevision){result.disposition="suppressed";return result;}
    await incidents(tx,identity);
    await ownedRelationships(tx,identity);
    const ownedDelete=await tx.query("MATCH ()-[r]->() WHERE r.schemaVersion=2 AND r.ownerKey=$key AND r.ownerTuple=$tuple DELETE r",{key:identity.key,tuple:identity.tupleJson});add(result,ownedDelete.stats);
    const links=await tx.query(`MATCH (n:${label(identity)} {key:$key})-[r]-() WHERE r.schemaVersion=2 AND (r.sourceKey=$key OR r.targetKey=$key) DELETE r`,{key:identity.key});add(result,links.stats);
    const node=await tx.query(`MATCH (n:${label(identity)} {key:$key}) WHERE n.schemaVersion=2 AND n.tupleJson=$tuple DELETE n`,{key:identity.key,tuple:identity.tupleJson});add(result,node.stats);
    await tx.query("MATCH (s:CortexV2SourceState {key:$key}) SET s.sourceRevision=$revision,s.tombstoned=true,s.ownershipRevision=$ownershipRevision,s.referenceGeneration=$referenceGeneration REMOVE s.activeDigest RETURN s.key AS key",{key:identity.key,revision:job.sourceRevision,ownershipRevision:job.ownershipRevision,referenceGeneration:job.referenceGeneration});
    if(state.tombstoned===true && !existing.count)result.disposition="idempotent";
    return result;
  }
  if(state.tombstoned===true||revision>job.sourceRevision){result.disposition="suppressed";return result;}
  const digest=job.sourceDigest ?? graphSourceDigest(projection);
  if(revision===job.sourceRevision) {
    if(state.activeDigest!==digest||!existing.count)throw new GraphDatabaseError("Equal graph source revision has a contradictory projection.","GRAPH_REVISION_CONFLICT");
    if(phase!=="edges"){result.disposition="idempotent";return result;}
  } else if(phase==="edges")throw new GraphDatabaseError("Rebuild source changed before its edge phase.","GRAPH_REBUILD_SOURCE_CHANGED");
  if(phase!=="edges") {
  const properties=nodeProperties(projection);
  if(existing.count) {
    const before=map(existing.records[0].node),priorKeys=Array.isArray(before.projectionKeys)?before.projectionKeys:[];
    for(const key of priorKeys)if(typeof key==="string" && !(key in properties))properties[key]=null;
  }
  properties.projectionKeys=Object.keys(projection.properties).map(key=>key==="kind"?"artifactKind":key==="key"?"mutableKey":key);
  const node=await tx.query(`MERGE (n:${label(identity)} {key:$key}) ON CREATE SET n += $identity WITH n WHERE n.schemaVersion=2 AND n.tupleJson=$tuple SET n += $properties RETURN n.key AS key`,{key:identity.key,tuple:identity.tupleJson,identity:identityProperties(identity),properties});
  if(node.count!==1)throw new GraphDatabaseError("Managed source identity mismatch.","GRAPH_IDENTITY_MISMATCH");add(result,node.stats);
  await tx.query("MATCH (s:CortexV2SourceState {key:$key}) SET s.sourceRevision=$revision,s.activeDigest=$digest,s.ownershipRevision=$ownershipRevision,s.referenceGeneration=$referenceGeneration RETURN s.key AS key",
    {key:identity.key,revision:job.sourceRevision,digest,ownershipRevision:job.ownershipRevision,referenceGeneration:job.referenceGeneration});
  // Self-references must observe this transaction's confirmed SourceState update.
  Object.assign(state,{sourceRevision:job.sourceRevision,activeDigest:digest,ownershipRevision:job.ownershipRevision,referenceGeneration:job.referenceGeneration});
  }
  if(phase==="nodes")return result;
  // Replace only this source's exact managed outgoing projections. Incoming/manual edges survive.
  const obsolete=await tx.query("MATCH ()-[r]->() WHERE r.schemaVersion=2 AND r.ownerKey=$key AND r.ownerTuple=$tuple DELETE r",{key:identity.key,tuple:identity.tupleJson});add(result,obsolete.stats);
  for(const reference of projection.references) {
    const target=reference.identity,targetState=states.get(target.key)!;
    if(targetState.tombstoned===true){result.absentTargets.push(target.key);continue;}
    if(targetState.sourceRevision===-1)throw new GraphDatabaseError("A captured live graph target has not been delivered yet; retry only this graph job after its target.","GRAPH_TARGET_NOT_DELIVERED");
    if(targetState.sourceRevision!==reference.sourceRevision||targetState.ownershipRevision!==reference.ownershipRevision||targetState.referenceGeneration!==reference.referenceGeneration)
      throw new GraphDatabaseError("Captured live target revision, ownership or generation changed; inspect and replan the graph work.","GRAPH_REFERENCE_CHANGED");
    const type=rel(reference.relationship),edgeKey=graphDigest([identity.key,reference.role,reference.slot,target.key]);
    const edge=await tx.query(`MATCH (a:${label(identity)} {key:$sourceKey}),(b:${label(target)} {key:$targetKey}) WHERE a.schemaVersion=2 AND a.tupleJson=$sourceTuple AND a.sourceRevision=$sourceRevision AND b.schemaVersion=2 AND b.tupleJson=$targetTuple AND b.sourceRevision=$targetRevision MERGE (a)-[r:${type} {edgeKey:$edgeKey}]->(b) ON CREATE SET r += $properties RETURN r.edgeKey AS edgeKey`,
      {sourceKey:identity.key,targetKey:target.key,sourceTuple:identity.tupleJson,targetTuple:target.tupleJson,sourceRevision:job.sourceRevision,targetRevision:reference.sourceRevision,edgeKey,
        properties:{schemaVersion:2,edgeKey,ownerKey:identity.key,ownerTuple:identity.tupleJson,sourceKey:identity.key,targetKey:target.key,sourceTuple:identity.tupleJson,targetTuple:target.tupleJson,sourceRevision:job.sourceRevision,targetRevision:reference.sourceRevision,role:reference.role,slot:reference.slot}});
    if(!edge.count)throw new GraphDatabaseError("A live target node disappeared or changed after its SourceState check.","GRAPH_REFERENCE_CHANGED");add(result,edge.stats);
  }
  for(const item of projection.derived) {
    const target=derivedGraphIdentity(item.kind,item.logicalId,identity,item.entityType),type=rel(item.relationship),targetLabel=MANAGED_LABELS[item.kind];
    const created=await tx.query(`MERGE (n:${targetLabel} {key:$key}) ON CREATE SET n += $properties RETURN properties(n) AS node`,{key:target.key,properties:{...target.properties,...(typeof item.properties.fullValue==="string"?{fullValue:item.properties.fullValue}:{})}});
    if(created.count!==1||map(created.records[0].node).tupleJson!==target.tupleJson||map(created.records[0].node).schemaVersion!==2)throw new GraphDatabaseError("Derived graph identity mismatch.","GRAPH_IDENTITY_MISMATCH");add(result,created.stats);
    const edgeKey=graphDigest([identity.key,type,target.key]);
    const edge=await tx.query(`MATCH (a:${label(identity)} {key:$sourceKey}),(b:${targetLabel} {key:$targetKey}) MERGE (a)-[r:${type} {edgeKey:$edgeKey}]->(b) ON CREATE SET r += $properties RETURN r.edgeKey AS edgeKey`,
      {sourceKey:identity.key,targetKey:target.key,edgeKey,properties:{schemaVersion:2,edgeKey,ownerKey:identity.key,ownerTuple:identity.tupleJson,sourceKey:identity.key,targetKey:target.key,sourceTuple:identity.tupleJson,targetTuple:target.tupleJson,sourceRevision:job.sourceRevision,
        detailsJson:canonicalGraphJson(item.properties as Value)}});add(result,edge.stats);
  }
  for(const relation of projection.derivedRelations??[]) {
    const source=derivedGraphIdentity("Entity",relation.subject.name,identity,relation.subject.type),target=derivedGraphIdentity("Entity",relation.object.name,identity,relation.object.type),
      edgeKey=graphDigest([identity.key,"ENTITY_RELATION",source.key,relation.predicate,target.key]);
    const edge=await tx.query("MATCH (a:CortexV2Entity {key:$sourceKey}),(b:CortexV2Entity {key:$targetKey}) WHERE a.schemaVersion=2 AND b.schemaVersion=2 AND a.tupleJson=$sourceTuple AND b.tupleJson=$targetTuple MERGE (a)-[r:ENTITY_RELATION {edgeKey:$edgeKey}]->(b) ON CREATE SET r += $properties RETURN r.edgeKey AS edgeKey",{
      sourceKey:source.key,targetKey:target.key,sourceTuple:source.tupleJson,targetTuple:target.tupleJson,edgeKey,
      properties:{schemaVersion:2,edgeKey,ownerKey:identity.key,ownerTuple:identity.tupleJson,sourceKey:source.key,targetKey:target.key,sourceTuple:source.tupleJson,targetTuple:target.tupleJson,
        sourceRevision:job.sourceRevision,predicate:relation.predicate}});add(result,edge.stats);
  }
  return result;
}
export async function applyGraphJob(adapter:GraphAdapter,job:GraphJob):Promise<GraphApplyResult> {
  validateGraphJob(job);await assertManagedGraphCompatibility(adapter);
  if(!adapter.managedTransaction)throw new GraphDatabaseError("Adapter lacks the required explicit managed transaction.","GRAPH_SCHEMA_MIGRATION_REQUIRED");
  for(let attempt=0;;attempt++)try{return await adapter.managedTransaction(tx=>apply(tx,job));}
  catch(error){if(!(error instanceof GraphDatabaseError)||error.code!=="GRAPH_TRANSACTION_CONFLICT"||attempt>=2)throw error;}
}
/** Only fixed administrator snapshots use the explicit two-pass rebuild phase. No primary CRUD or queue ack. */
export async function applyGraphRebuildSnapshot(adapter:GraphAdapter,snapshot:GraphJob,phase:"nodes"|"edges"):Promise<GraphApplyResult> {
  validateGraphJob(snapshot);await assertManagedGraphCompatibility(adapter);
  if(!adapter.managedTransaction)throw new GraphDatabaseError("Adapter lacks managed transactions.","GRAPH_SCHEMA_MIGRATION_REQUIRED");
  for(let attempt=0;;attempt++)try{return await adapter.managedTransaction(tx=>apply(tx,snapshot,phase));}
  catch(error){if(!(error instanceof GraphDatabaseError)||error.code!=="GRAPH_TRANSACTION_CONFLICT"||attempt>=2)throw error;}
}
export async function deliverGraphJob(client:ConvexClient,adapter:GraphAdapter,receipt:GraphJobReceipt):Promise<GraphApplyResult> {
  let value:unknown;
  try {value=await client.query(api.graphSync.getGraphJob,{id:receipt.id as Id<"graphSyncQueue">,generation:receipt.generation,tenantId:receipt.identity.tenantId??undefined});}
  catch {throw new GraphJobUnresolved(receipt);}
  const job=validateGraphJob(value as GraphJob);
  if(job.identity.key!==receipt.identity.key||job.sourceRevision!==receipt.sourceRevision)throw new GraphJobUnresolved(receipt);
  if(job.state==="synced"||job.state==="suppressed")return {...empty(),disposition:job.state==="synced"?"idempotent":"suppressed"};
  if(job.state!=="pending")throw new GraphDatabaseError("Graph job retry attempts are exhausted.","GRAPH_JOB_FAILED");
  const result=await applyGraphJob(adapter,job);
  const args={id:job._id as Id<"graphSyncQueue">,generation:job.generation,attemptToken:job.attemptToken,tenantId:job.identity.tenantId??undefined};
  await client.mutation(result.disposition==="suppressed"?api.graphSync.suppressJob:api.graphSync.markSynced,args);
  return result;
}
export function requestedGraph(adapter:GraphAdapter|undefined,explicit?:boolean):boolean {
  if(explicit!==undefined&&typeof explicit!=="boolean")throw new GraphDatabaseError("syncToGraph must be boolean.","GRAPH_POLICY_INVALID");
  if(explicit===true&&!adapter)throw new GraphDatabaseError("syncToGraph:true requires a configured graph adapter.","GRAPH_ADAPTER_REQUIRED");
  return explicit!==false&&!!adapter;
}
export async function writeWithGraph<T>(client:ConvexClient,adapter:GraphAdapter|undefined,policy:GraphSyncPolicy|undefined,scope:GraphScope,
  domain:string,intent:unknown,operation:(queueGraph?:{graphInvocationId:string})=>Promise<T | {graphVersion:2;primaryResult:T;graphJobs:GraphJobReceipt[]}>,explicit?:boolean,knownPhysicalSourceIds:string[]=[]):Promise<T> {
  if(!requestedGraph(adapter,explicit))return await operation() as T;
  await assertManagedGraphCompatibility(adapter!);
  const invocationId=randomUUID();let response:T | {graphVersion:2;primaryResult:T;graphJobs:GraphJobReceipt[]};
  try {response=await operation({graphInvocationId:invocationId});}
  catch(error){if(error instanceof ConvexError)throw error;throw new GraphPrimaryOutcomeUnknown(domain,scope,invocationId,intent,knownPhysicalSourceIds);}
  const value=map(response);
  if(value.graphVersion!==2||!Array.isArray(value.graphJobs)||!("primaryResult"in value))throw new GraphJobUnresolved();
  const result=value.primaryResult as T,jobs=value.graphJobs as GraphJobReceipt[];
  if(policy?.mode!=="background")try {for(const job of jobs)await deliverGraphJob(client,adapter!,job);}
  catch(error){throw new GraphCommittedPartial(result,jobs,error instanceof GraphDatabaseError&&error.code==="GRAPH_TRANSACTION_OUTCOME_UNKNOWN"?"unknown":"failed",
    error instanceof GraphJobUnresolved?error.code:error instanceof GraphDatabaseError?error.code??"GRAPH_DELIVERY_FAILED":"GRAPH_ACK_UNKNOWN");}
  return result && typeof result==="object"&&!Array.isArray(result)?{...result,graphJobs:jobs,graphDisposition:policy?.mode==="background"?"queued" as const:"delivered" as const}:result;
}
export interface GraphErasureItem {
  identity:GraphIdentity;sourceRevision:number;ownershipRevision:number;referenceGeneration:string;referenceRevision:number;
  /** Actual captured Task23 physical evidence, not a logical replacement lookup. */
  evidence:{targetId:string;generation:string;physicalSourceId:string;scopeKnown:true};
}
export interface PreparedGraphErasureItem {item:GraphErasureItem;adapter:GraphAdapter;disposalTransport:GraphErasureTransport;prepared:true;}
async function preflightCopies(item:GraphErasureItem,transport:GraphErasureTransport):Promise<void> {
  for(const scan of ["source","legacy"] as const) {
    const ranges:Array<{cursor:string|null;endCursor:string|null}>=[{cursor:null,endCursor:null}],seen=new Set<string>();
    while(ranges.length){let range=ranges.shift()!;for(;;) {
      const key=JSON.stringify(range);if(seen.has(key))throw new GraphDatabaseError("Copied-job preflight cursor did not advance.","GRAPH_ERASURE_INVALID_PAGE");seen.add(key);
      const page=await transport.preflight(item,scan,range) as GraphErasurePreflightPage;
      if(!page||page.kind!=="preflight"||!Number.isSafeInteger(page.checked)||page.checked<0||typeof page.isDone!=="boolean"||typeof page.continueCursor!=="string")
        throw new GraphDatabaseError("Copied-job preflight returned invalid evidence.","GRAPH_ERASURE_INVALID_PAGE");
      if(page.pageStatus==="SplitRequired") {if(!page.splitCursor||page.splitCursor===range.cursor||page.splitCursor===range.endCursor)throw new GraphDatabaseError("Invalid copied-job preflight split.","GRAPH_ERASURE_INVALID_PAGE");
        ranges.unshift({cursor:page.splitCursor,endCursor:range.endCursor});range={cursor:range.cursor,endCursor:page.splitCursor};continue;}
      if(page.isDone||range.endCursor!==null&&page.continueCursor===range.endCursor)break;
      if(!page.continueCursor||page.continueCursor===range.cursor)throw new GraphDatabaseError("Copied-job preflight cursor did not advance.","GRAPH_ERASURE_INVALID_PAGE");range={...range,cursor:page.continueCursor};
    }}
  }
}
export async function prepareGraphErasure(items:GraphErasureItem[],options:{adapter:GraphAdapter;disposalTransport:GraphErasureTransport}):Promise<PreparedGraphErasureItem[]> {
  if(!options.disposalTransport)throw new GraphDatabaseError("Explicit administrator copied-job preflight is required before primary erasure.","GRAPH_ERASURE_TRANSPORT_REQUIRED");
  await assertManagedGraphCompatibility(options.adapter);
  if(!options.adapter.managedTransaction)throw new GraphDatabaseError("Adapter requires managed transactions.","GRAPH_SCHEMA_MIGRATION_REQUIRED");
  for(const item of items) {
    identityProperties(item.identity);
    if(item.evidence.scopeKnown!==true||item.evidence.physicalSourceId!==item.identity.physicalSourceId||item.evidence.generation!==item.referenceGeneration||
      !item.evidence.targetId||!Number.isSafeInteger(item.sourceRevision)||item.sourceRevision<1||!Number.isSafeInteger(item.ownershipRevision)||item.ownershipRevision<1)
      throw new GraphDatabaseError("Erasure needs captured physical lifecycle evidence.","GRAPH_IDENTITY_REQUIRED");
    // Preparation is strictly read-only: no gate creation or epoch update.
    const response=await options.adapter.managedRead!(`MATCH (n:${label(item.identity)} {key:$key}) RETURN properties(n) AS node`,{key:item.identity.key});
    if(response.count>1)throw new GraphDatabaseError("Graph source is ambiguous.","GRAPH_IDENTITY_MISMATCH");
    if(response.count)assertIdentityProperties(map(response.records[0].node),item.identity);
    const edges=await options.adapter.managedRead!(`MATCH (n:${label(item.identity)} {key:$key})-[r]-(other) RETURN type(r) AS type,properties(r) AS edge,labels(other) AS labels,properties(other) AS endpoint LIMIT 65`,{key:item.identity.key});
    // Use the same validation without opening a write transaction.
    await incidents({query:async()=>edges},item.identity);
    await ownedRelationships({query:options.adapter.managedRead!.bind(options.adapter)},item.identity);
    await preflightCopies(item,options.disposalTransport);
  }
  return items.map(item=>({item,adapter:options.adapter,disposalTransport:options.disposalTransport,prepared:true}));
}
export interface GraphErasureDelivery {client:ConvexClient;jobs:GraphJobReceipt[];}
async function erasureJobs(item:GraphErasureItem,delivery:GraphErasureDelivery):Promise<GraphJob[]> {
  if(!delivery.jobs.length)throw new GraphJobUnresolved();
  const jobs=[];
  for(const receipt of delivery.jobs) {
    let value:unknown;try{value=await delivery.client.query(api.graphSync.getGraphJob,{id:receipt.id as Id<"graphSyncQueue">,generation:receipt.generation,tenantId:item.identity.tenantId??undefined});}catch{throw new GraphJobUnresolved(receipt);}
    const job=validateGraphJob(value as GraphJob);
    if(job.operation!=="delete"||job.identity.key!==item.identity.key||job.identity.tupleJson!==item.identity.tupleJson||job.sourceRevision!==item.sourceRevision+1||job.referenceGeneration!==item.referenceGeneration||job.ownershipRevision!==item.ownershipRevision)throw new GraphJobUnresolved(receipt);
    jobs.push(job);
  }
  return jobs;
}
function disposalStatus(value:unknown,item:GraphErasureItem,receipt:GraphJobReceipt):GraphErasureStatus {
  const state=map(value);
  if(state.kind!=="status"||state.id!==receipt.id||state.generation!==receipt.generation||state.sourceRevision!==item.sourceRevision+1||!["synced","suppressed"].includes(String(state.state))||
    !Number.isSafeInteger(state.disposalRevision)||(state.disposalRevision as number)<0||!Number.isSafeInteger(state.disposedJobCount)||(state.disposedJobCount as number)<0||typeof state.complete!=="boolean"||
    !/^[a-f0-9]{64}$/.test(String(state.requestDigest))||!/^[a-f0-9]{64}$/.test(String(state.projectionDigest)))throw new GraphJobUnresolved(receipt);
  const identity=map(state.identity);assertIdentityProperties(identityProperties(identity as unknown as GraphIdentity),item.identity);
  return state as unknown as GraphErasureStatus;
}
async function graphErasureState(item:GraphErasureItem,adapter:GraphAdapter) {
  const response=await adapter.managedRead!(`OPTIONAL MATCH (n:${label(item.identity)} {key:$key}) OPTIONAL MATCH (s:CortexV2SourceState {key:$key}) RETURN count(n) AS nodes,properties(s) AS state`,{key:item.identity.key});
  const row=response.records[0]??{},state=map(row.state);if(Object.keys(state).length)assertIdentityProperties(state,item.identity);
  const edges=await adapter.managedRead!("MATCH ()-[r]-() WHERE r.schemaVersion=2 AND (r.sourceKey=$key OR r.targetKey=$key OR r.ownerKey=$key) RETURN r.edgeKey AS key LIMIT 1",{key:item.identity.key});
  return {absent:row.nodes===0&&edges.count===0,tombstoned:state.tombstoned===true&&(state.sourceRevision as number)>=item.sourceRevision+1&&state.ownershipRevision===item.ownershipRevision&&state.referenceGeneration===item.referenceGeneration};
}
export class GraphErasureProgressError extends GraphCommittedPartial<{physicalSourceId:string}> {
  constructor(item:GraphErasureItem,jobs:GraphJobReceipt[],public readonly disposalOutcome:"failed"|"unknown",public readonly disposalStatus:GraphErasureStatus|undefined,reason:string) {
    super({physicalSourceId:item.identity.physicalSourceId},jobs,disposalOutcome,reason);this.name="GraphErasureProgressError";
  }
}
export async function eraseGraphItem(prepared:PreparedGraphErasureItem,delivery:GraphErasureDelivery):Promise<GraphApplyResult&{disposal:GraphErasureStatus}> {
  if(prepared.prepared!==true)throw new GraphDatabaseError("Prepare every selected item before primary effects.","GRAPH_ERASURE_NOT_PREPARED");
  const receipt=delivery.jobs[0],result=empty();let status:GraphErasureStatus|undefined;
  if(!receipt||delivery.jobs.some(job=>job.identity.key!==prepared.item.identity.key||job.identity.tupleJson!==prepared.item.identity.tupleJson||job.sourceRevision!==prepared.item.sourceRevision+1))throw new GraphJobUnresolved(receipt);
  try {
    try {status=disposalStatus(await prepared.disposalTransport.status(prepared.item,receipt),prepared.item,receipt);}
    catch(cause) {
      if(!(cause instanceof ConvexError)||!cause.data||typeof cause.data!=="object"||!("code"in cause.data)||cause.data.code!=="GRAPH_ERASURE_NOT_ACKNOWLEDGED")throw cause;
      const jobs=await erasureJobs(prepared.item,delivery);
      for(const job of jobs)add(result,await deliverGraphJob(delivery.client,prepared.adapter,{id:job._id,generation:job.generation,identity:job.identity,sourceRevision:job.sourceRevision}));
      status=disposalStatus(await prepared.disposalTransport.status(prepared.item,receipt),prepared.item,receipt);
    }
    const graph=await graphErasureState(prepared.item,prepared.adapter);if(!graph.absent||!graph.tombstoned)throw new GraphDatabaseError("Original source graph erasure is not verified; copied data remains protected.","GRAPH_ERASURE_NOT_VERIFIED");
    while(!status.complete) {
      const prior=status;status=disposalStatus(await prepared.disposalTransport.dispose(prepared.item,receipt,prior.disposalRevision),prepared.item,receipt);
      if(status.disposalRevision!==prior.disposalRevision+1||status.disposedJobCount<prior.disposedJobCount)throw new GraphDatabaseError("Copied-job disposal progress is contradictory.","GRAPH_ERASURE_PROGRESS_CHANGED");
    }
    return {...result,disposal:status};
  }catch(cause) {
    const unresolved=cause instanceof GraphDatabaseError&&["GRAPH_ERASURE_RESPONSE_UNKNOWN","GRAPH_ERASURE_CANCELLED","GRAPH_TRANSACTION_OUTCOME_UNKNOWN"].includes(cause.code??"")||!(cause instanceof ConvexError)&&!(cause instanceof GraphDatabaseError);
    throw new GraphErasureProgressError(prepared.item,delivery.jobs,unresolved?"unknown":"failed",status,
      cause instanceof GraphDatabaseError?cause.code??"GRAPH_ERASURE_FAILED":"GRAPH_ERASURE_RESPONSE_UNKNOWN");
  }
}
export async function verifyGraphErasure(items:GraphErasureItem[],options:{adapter:GraphAdapter;disposalTransport:GraphErasureTransport;jobs:GraphJobReceipt[]}):Promise<{complete:boolean;items:Array<{key:string;absent:boolean;tombstoned:boolean;queueComplete:boolean;disposedJobCount:number}>}> {
  await assertManagedGraphCompatibility(options.adapter);const results=[];
  for(const item of items) {
    identityProperties(item.identity);const receipt=options.jobs.find(job=>job.identity.key===item.identity.key);if(!receipt)throw new GraphJobUnresolved();
    const status=disposalStatus(await options.disposalTransport.status(item,receipt),item,receipt),graph=await graphErasureState(item,options.adapter);
    results.push({key:item.identity.key,...graph,queueComplete:status.complete,disposedJobCount:status.disposedJobCount});
  }
  return {complete:results.every(r=>r.absent&&r.tombstoned&&r.queueComplete),items:results};
}
