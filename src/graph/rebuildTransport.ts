/** Fixed administrator transport. It never consults environment/config or exposes an ordinary Cortex client. */
import {ConvexHttpClient} from "convex/browser";
import {makeFunctionReference,type FunctionReference} from "convex/server";
import {ConvexError} from "convex/values";
import type {GraphKind} from "./types";
import {GraphDatabaseError} from "./types";
import {GRAPH_TABLES} from "./identity";
export interface GraphRebuildSelection {tenantId?:string;memorySpaceId?:string;}
export interface GraphRebuildRange {cursor:string|null;endCursor:string|null;numItems:number;}
export interface GraphRebuildRequestOptions {signal?:AbortSignal;timeoutMs?:number;}
export interface GraphRebuildSourceRequest extends GraphRebuildSelection {version:2;kind:GraphKind;paginationOpts:GraphRebuildRange;}
export interface GraphRebuildEdgeRequest extends GraphRebuildSourceRequest {physicalSourceId:string;expectedSourceRevision:number;expectedOwnershipRevision:number;expectedReferenceGeneration:string;}
export interface GraphRebuildTransport {
  sourcePage(args:GraphRebuildSourceRequest,options?:GraphRebuildRequestOptions):Promise<unknown>;
  edgePage(args:GraphRebuildEdgeRequest,options?:GraphRebuildRequestOptions):Promise<unknown>;
  /** Abort only requests owned by this transport; no graph adapter or Cortex ownership. */
  close():void;
}
export function createGraphRebuildTransport(options:{url:string;deploymentKey:string}):GraphRebuildTransport {
  const url=new URL(options.url);
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=="/"||
    typeof options.deploymentKey!=="string"||!options.deploymentKey.trim())throw new GraphDatabaseError("An explicit deployment URL and administrator key are required for graph rebuild.","GRAPH_REBUILD_TRANSPORT_REQUIRED");
  const active=new Set<AbortController>();let closed=false,current:GraphRebuildRequestOptions|undefined;
  const guardedFetch:typeof fetch=async(input,init={})=>{
    const controller=new AbortController(),timeout=current?.timeoutMs??30000,signal=current?.signal;
    if(closed||!Number.isFinite(timeout)||timeout<=0||signal?.aborted)throw new GraphDatabaseError("Graph rebuild was cancelled or its deadline expired.","GRAPH_REBUILD_CANCELLED");
    active.add(controller);const cancel=()=>controller.abort();signal?.addEventListener("abort",cancel,{once:true});
    const timer=setTimeout(cancel,Math.min(timeout,30000));
    try {
      const response=await fetch(input,{...init,signal:controller.signal}),reader=response.body?.getReader(),chunks:Uint8Array[]=[];let bytes=0;
      if(reader)try {for(;;){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>8*1024*1024)throw new GraphDatabaseError("Native graph rebuild response exceeds its encoded bound.","GRAPH_REBUILD_PAGE_BUDGET");chunks.push(item.value);}}
      finally {try{await reader.cancel();}finally{reader.releaseLock();}}
      const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
      return new Response(joined,{status:response.status,statusText:response.statusText,headers:response.headers});
    }finally{clearTimeout(timer);signal?.removeEventListener("abort",cancel);active.delete(controller);}
  };
  const candidate:unknown=new ConvexHttpClient(url.origin,{logger:false,fetch:guardedFetch});
  if(!candidate||typeof candidate!=="object"||!("setAdminAuth"in candidate)||typeof candidate.setAdminAuth!=="function"||!("query"in candidate)||typeof candidate.query!=="function")
    throw new GraphDatabaseError("The installed Convex client does not support the fixed administrator transport.","GRAPH_REBUILD_TRANSPORT_REQUIRED");
  const client=candidate as {setAdminAuth(key:string):void;query(reference:FunctionReference<"query">,args:Record<string,unknown>):Promise<unknown>};
  client.setAdminAuth(options.deploymentKey);
  let inFlight=false;
  const call=async(name:"rebuildSourcePage"|"rebuildEdgePage",args:GraphRebuildSourceRequest|GraphRebuildEdgeRequest,request?:GraphRebuildRequestOptions)=>{
    if(closed||inFlight)throw new GraphDatabaseError("Graph rebuild transport is closed or already has an active request.","GRAPH_REBUILD_TRANSPORT_BUSY");
    if(args.version!==2||!Object.values(GRAPH_TABLES).includes(args.kind)||args.tenantId!==undefined&&(typeof args.tenantId!=="string"||!args.tenantId)||
      args.memorySpaceId!==undefined&&(typeof args.memorySpaceId!=="string"||!args.memorySpaceId))throw new GraphDatabaseError("Graph rebuild requires fixed kind and exact known scope.","GRAPH_SCOPE_MISMATCH");
    inFlight=true;current=request;
    try{return await client.query(makeFunctionReference(`cliOperator/graphSync:${name}`),args as unknown as Record<string,unknown>);}
    catch(error){if(error instanceof ConvexError||error instanceof GraphDatabaseError)throw error;throw new GraphDatabaseError("Fixed native graph rebuild request failed; confirmed counts remain partial.",request?.signal?.aborted?"GRAPH_REBUILD_CANCELLED":"GRAPH_REBUILD_TRANSPORT_FAILED");}
    finally{inFlight=false;current=undefined;}
  };
  return {sourcePage:(args,request)=>call("rebuildSourcePage",args,request),edgePage:(args,request)=>call("rebuildEdgePage",args,request),close:()=>{closed=true;for(const controller of active)controller.abort();}};
}
