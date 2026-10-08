/** A distinct, single-operation administrator transport for exact copied-job disposal. */
import {ConvexHttpClient} from "convex/browser";
import {makeFunctionReference,type FunctionReference} from "convex/server";
import {ConvexError} from "convex/values";
import {GRAPH_TABLES,identityProperties} from "./identity";
import {GraphDatabaseError,type GraphJobReceipt,type GraphIdentity} from "./types";
import type {GraphErasureItem} from "./erasure";
import type {GraphRebuildRequestOptions} from "./rebuildTransport";
export interface GraphErasureStatus {
  kind:"status";id:string;generation:string;identity:GraphIdentity;sourceRevision:number;state:"synced"|"suppressed";
  requestDigest:string;projectionDigest:string;disposalRevision:number;disposedJobCount:number;complete:boolean;
}
export interface GraphErasurePreflightPage {kind:"preflight";checked:number;isDone:boolean;continueCursor:string;pageStatus?:"SplitRequired"|"SplitRecommended"|null;splitCursor?:string|null;}
export interface GraphErasureTransport {
  preflight(item:GraphErasureItem,scan:"source"|"legacy",range:{cursor:string|null;endCursor:string|null},options?:GraphRebuildRequestOptions):Promise<unknown>;
  status(item:GraphErasureItem,receipt:GraphJobReceipt,options?:GraphRebuildRequestOptions):Promise<unknown>;
  dispose(item:GraphErasureItem,receipt:GraphJobReceipt,expectedDisposalRevision:number,options?:GraphRebuildRequestOptions):Promise<unknown>;
  close():void;
}
export function createGraphErasureTransport(options:{url:string;deploymentKey:string}):GraphErasureTransport {
  const url=new URL(options.url);
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=="/"||typeof options.deploymentKey!=="string"||!options.deploymentKey.trim())
    throw new GraphDatabaseError("Pass explicit deployment URL and administrator key for graph erasure.","GRAPH_ERASURE_TRANSPORT_REQUIRED");
  const active=new Set<AbortController>();let closed=false,current:GraphRebuildRequestOptions|undefined,inFlight=false;
  // Same bounded HTTP body/cancellation primitive as the two-function rebuild transport.
  const guardedFetch:typeof fetch=async(input,init={})=>{
    const controller=new AbortController(),timeout=current?.timeoutMs??30000,signal=current?.signal;
    if(closed||!Number.isFinite(timeout)||timeout<=0||signal?.aborted)throw new GraphDatabaseError("Graph erasure request cancelled.","GRAPH_ERASURE_CANCELLED");
    active.add(controller);const cancel=()=>controller.abort();signal?.addEventListener("abort",cancel,{once:true});const timer=setTimeout(cancel,Math.min(timeout,30000));
    try {
      const response=await fetch(input,{...init,signal:controller.signal}),reader=response.body?.getReader(),chunks:Uint8Array[]=[];let bytes=0;
      if(reader)try{for(;;){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>8*1024*1024)throw new GraphDatabaseError("Graph erasure response exceeded its encoded bound.","GRAPH_ERASURE_PAGE_BUDGET");chunks.push(item.value);}}
      finally{try{await reader.cancel();}finally{reader.releaseLock();}}
      const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
      return new Response(joined,{status:response.status,statusText:response.statusText,headers:response.headers});
    }finally{clearTimeout(timer);signal?.removeEventListener("abort",cancel);active.delete(controller);}
  };
  const candidate:unknown=new ConvexHttpClient(url.origin,{logger:false,fetch:guardedFetch});
  if(!candidate||typeof candidate!=="object"||!("setAdminAuth"in candidate)||typeof candidate.setAdminAuth!=="function"||!("mutation"in candidate)||typeof candidate.mutation!=="function")
    throw new GraphDatabaseError("Installed Convex client lacks the fixed administrator transport.","GRAPH_ERASURE_TRANSPORT_REQUIRED");
  const client=candidate as {setAdminAuth(key:string):void;mutation(reference:FunctionReference<"mutation">,args:Record<string,unknown>,options:{skipQueue:true}):Promise<unknown>};client.setAdminAuth(options.deploymentKey);
  const selection=(item:GraphErasureItem)=>{
    identityProperties(item.identity);const table=Object.entries(GRAPH_TABLES).find(([,kind])=>kind===item.identity.kind)![0];
    return {table,physicalSourceId:item.identity.physicalSourceId,sourceRevision:item.sourceRevision,ownershipRevision:item.ownershipRevision,referenceRevision:item.referenceRevision,referenceGeneration:item.referenceGeneration,targetId:item.evidence.targetId};
  };
  const call=async(item:GraphErasureItem,mode:Record<string,unknown>,request?:GraphRebuildRequestOptions)=>{
    if(closed||inFlight)throw new GraphDatabaseError("Graph erasure transport closed or already active.","GRAPH_ERASURE_TRANSPORT_BUSY");
    const args={tenantId:item.identity.tenantId??undefined,disposal:{...selection(item),...mode}};inFlight=true;current=request;
    try{return await client.mutation(makeFunctionReference("cliOperator/graphSync:clearSyncedItems"),args,{skipQueue:true});}
    catch(error){if(error instanceof ConvexError||error instanceof GraphDatabaseError)throw error;throw new GraphDatabaseError("Original graph disposal response is unresolved; read status before continuing.",request?.signal?.aborted?"GRAPH_ERASURE_CANCELLED":"GRAPH_ERASURE_RESPONSE_UNKNOWN");}
    finally{inFlight=false;current=undefined;}
  };
  return {preflight:(item,scan,range,request)=>call(item,{kind:"preflight",scan,range},request),status:(item,receipt,request)=>call(item,{kind:"status",id:receipt.id,generation:receipt.generation},request),
    dispose:(item,receipt,expectedDisposalRevision,request)=>call(item,{kind:"dispose",id:receipt.id,generation:receipt.generation,expectedDisposalRevision},request),
    close:()=>{closed=true;for(const controller of active)controller.abort();}};
}
