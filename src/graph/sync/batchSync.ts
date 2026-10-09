/** Complete rolling graph rebuild through two fixed administrator query services. */
import type {Cortex} from "../..";
import type {GraphAdapter,GraphKind,GraphJob,GraphApplyResult} from "../types";
import {GraphDatabaseError} from "../types";
import {GRAPH_TABLES,validateGraphJob} from "../identity";
import {assertManagedGraphCompatibility} from "../schema/initSchema";
import {applyGraphRebuildSnapshot} from "../erasure";
import type {GraphRebuildTransport,GraphRebuildSelection,GraphRebuildRange} from "../rebuildTransport";
const kinds=Object.entries(GRAPH_TABLES) as Array<[keyof typeof GRAPH_TABLES,GraphKind]>;
export interface BatchSyncOptions extends GraphRebuildSelection {
  transport?:GraphRebuildTransport;
  limits?:Partial<Record<keyof typeof GRAPH_TABLES,number>>;
  syncRelationships?:boolean;
  onProgress?:(entity:string,current:number,total:number)=>void;
  signal?:AbortSignal;
  /** Optional whole-operation duration. Omitted rebuilds have no arbitrary terminal cap. */
  deadlineMs?:number;
}
export interface BatchSyncResult {
  memorySpaces:{synced:number;failed:number};contexts:{synced:number;failed:number};conversations:{synced:number;failed:number};memories:{synced:number;failed:number};facts:{synced:number;failed:number};
  immutable:{synced:number;failed:number};mutable:{synced:number;failed:number};artifacts:{synced:number;failed:number};
  errors:Array<{entity:string;id:string;error:string}>;duration:number;schemaVersion:2;scope:GraphRebuildSelection;
  complete:boolean;limited:boolean;consistency:"rolling";legacyExcluded:true;excludedKinds:string[];
  graph:GraphApplyResult;confirmedPhysicalIds:Partial<Record<keyof typeof GRAPH_TABLES,string[]>>;
}
export class GraphRebuildPartialError extends Error {
  readonly code="GRAPH_REBUILD_PARTIAL";
  constructor(public readonly result:BatchSyncResult,public readonly originalError:unknown){super("Graph rebuild stopped after confirmed work. Counts are partial; inspect the failed physical item before continuing.");this.name="GraphRebuildPartialError";}
}
type Page={page:unknown[];isDone:boolean;continueCursor:string;pageStatus?:"SplitRequired"|"SplitRecommended"|null;splitCursor?:string|null;snapshot?:GraphJob;schemaVersion:2;};
function page(value:unknown):Page {
  if(!value||typeof value!=="object")throw new GraphDatabaseError("Invalid native graph rebuild page.","GRAPH_REBUILD_INVALID_PAGE");
  const p=value as Page;if(p.schemaVersion!==2||!Array.isArray(p.page)||typeof p.isDone!=="boolean"||typeof p.continueCursor!=="string"||
    ![undefined,null,"SplitRequired","SplitRecommended"].includes(p.pageStatus)||p.splitCursor!==undefined&&p.splitCursor!==null&&typeof p.splitCursor!=="string")throw new GraphDatabaseError("Invalid native graph rebuild page.","GRAPH_REBUILD_INVALID_PAGE");
  return p;
}
/** Native endCursor terminates a subrange, even when isDone describes the entire query. */
export async function* graphRebuildPages(load:(range:GraphRebuildRange)=>Promise<unknown>):AsyncGenerator<Page> {
  const ranges:Array<{cursor:string|null;endCursor:string|null}>=[{cursor:null,endCursor:null}],seen=new Set<string>();
  while(ranges.length){let range=ranges.shift()!;for(;;){const key=JSON.stringify(range);if(seen.has(key))throw new GraphDatabaseError("Native graph rebuild cursor did not advance.","GRAPH_REBUILD_NONADVANCING_CURSOR");seen.add(key);
    const p=page(await load({...range,numItems:8}));
    if(p.pageStatus==="SplitRequired"){if(!p.splitCursor||p.splitCursor===range.cursor||p.splitCursor===range.endCursor)throw new GraphDatabaseError("Invalid native rebuild split.","GRAPH_REBUILD_INVALID_PAGE");ranges.unshift({cursor:p.splitCursor,endCursor:range.endCursor});range={cursor:range.cursor,endCursor:p.splitCursor};continue;}
    if(!p.isDone&&(!p.continueCursor||p.continueCursor===range.cursor))throw new GraphDatabaseError("Native graph rebuild cursor did not advance.","GRAPH_REBUILD_NONADVANCING_CURSOR");
    yield p;if(p.isDone||range.endCursor!==null&&p.continueCursor===range.endCursor)break;range={...range,cursor:p.continueCursor};
  }}
}
const sum=(target:GraphApplyResult,value:GraphApplyResult)=>{for(const key of ["nodesCreated","nodesDeleted","relationshipsCreated","relationshipsDeleted"]as const)target[key]+=value[key];target.absentTargets.push(...value.absentTargets);};
type Descriptor={kind:GraphKind;physicalSourceId:string;sourceRevision:number;ownershipRevision:number;referenceGeneration:string;sourceDigest?:string;};
export async function initialGraphSync(_cortex:Cortex,adapter:GraphAdapter,options:BatchSyncOptions={}):Promise<BatchSyncResult> {
  // No private Cortex client, ordinary JWT, logical source reread or capped public list is administrative authority.
  if(!options.transport)throw new GraphDatabaseError("Pass createGraphRebuildTransport({url,deploymentKey}) explicitly before initialGraphSync.","GRAPH_REBUILD_TRANSPORT_REQUIRED");
  const start=Date.now(),expires=options.deadlineMs===undefined?Infinity:start+options.deadlineMs;
  if(options.deadlineMs!==undefined&&(!Number.isFinite(options.deadlineMs)||options.deadlineMs<=0))throw new GraphDatabaseError("Invalid optional rebuild deadline.","GRAPH_REBUILD_CANCELLED");
  for(const maximum of Object.values(options.limits??{}))if(!Number.isSafeInteger(maximum)||maximum!<0)throw new GraphDatabaseError("Rebuild limits must be explicit nonnegative safe integers.","GRAPH_REBUILD_LIMIT_INVALID");
  const stats=()=>({synced:0,failed:0});const result:BatchSyncResult={memorySpaces:stats(),contexts:stats(),conversations:stats(),memories:stats(),facts:stats(),immutable:stats(),mutable:stats(),artifacts:stats(),
    errors:[],duration:0,schemaVersion:2,scope:{tenantId:options.tenantId,memorySpaceId:options.memorySpaceId},complete:false,limited:false,consistency:"rolling",legacyExcluded:true,excludedKinds:[],
    graph:{disposition:"applied",nodesCreated:0,nodesDeleted:0,relationshipsCreated:0,relationshipsDeleted:0,absentTargets:[]},confirmedPhysicalIds:{}};
  const request=()=>{if(options.signal?.aborted||Date.now()>=expires)throw new GraphDatabaseError("Graph rebuild cancelled or deadline expired.","GRAPH_REBUILD_CANCELLED");return {signal:options.signal,timeoutMs:Math.min(30000,expires-Date.now())};};
  const selected:Array<{table:keyof typeof GRAPH_TABLES;item:Descriptor}>=[];let current:{table:keyof typeof GRAPH_TABLES;physicalId:string}|undefined;
  try {
    request();await assertManagedGraphCompatibility(adapter);
    for(const [table,kind]of kinds){if(options.memorySpaceId!==undefined&&(table==="immutable"||table==="mutable")){result.excludedKinds.push(table);continue;}
      const seen=new Map<string,string>(),maximum=options.limits?.[table]??Infinity;result.confirmedPhysicalIds[table]=[];
      if(maximum===0){result.limited=true;continue;}
      for await(const p of graphRebuildPages(range=>options.transport!.sourcePage({version:2,kind,tenantId:options.tenantId,memorySpaceId:options.memorySpaceId,paginationOpts:range},request()))){
        for(const value of p.page){const snapshot=validateGraphJob(value as GraphJob);current={table,physicalId:snapshot.identity.physicalSourceId};
          if(snapshot.table!==table||snapshot.identity.tenantId!==(options.tenantId??null)||options.memorySpaceId!==undefined&&snapshot.identity.memorySpaceId!==options.memorySpaceId)throw new GraphDatabaseError("Native rebuild returned another scope or kind.","GRAPH_SCOPE_MISMATCH");
          const prior=seen.get(snapshot.identity.physicalSourceId);if(prior!==undefined){if(prior!==snapshot.projectionDigest)throw new GraphDatabaseError("A repeated physical source changed during rebuild.","GRAPH_REBUILD_SOURCE_CHANGED");continue;}
          request();sum(result.graph,await applyGraphRebuildSnapshot(adapter,snapshot,"nodes"));seen.set(snapshot.identity.physicalSourceId,snapshot.projectionDigest!);
          const item:Descriptor={kind,physicalSourceId:snapshot.identity.physicalSourceId,sourceRevision:snapshot.sourceRevision,ownershipRevision:snapshot.ownershipRevision,referenceGeneration:snapshot.referenceGeneration,sourceDigest:snapshot.sourceDigest};selected.push({table,item});
          result[table].synced++;result.confirmedPhysicalIds[table]!.push(item.physicalSourceId);options.onProgress?.(table,result[table].synced,result[table].synced);
          if(result[table].synced>=maximum){result.limited=!p.isDone||p.page.at(-1)!==value||result.limited;break;}
        }
        if(result[table].synced>=maximum){if(!p.isDone)result.limited=true;break;}
      }
    }
    if(options.syncRelationships!==false)for(const {table,item}of selected){current={table,physicalId:item.physicalSourceId};let snapshot:GraphJob|undefined;
      for await(const p of graphRebuildPages(range=>options.transport!.edgePage({version:2,kind:item.kind,tenantId:options.tenantId,memorySpaceId:options.memorySpaceId,physicalSourceId:item.physicalSourceId,
        expectedSourceRevision:item.sourceRevision,expectedOwnershipRevision:item.ownershipRevision,expectedReferenceGeneration:item.referenceGeneration,paginationOpts:range},request()))){
        const next=validateGraphJob(p.snapshot!);if(next.identity.physicalSourceId!==item.physicalSourceId||next.sourceDigest!==item.sourceDigest||snapshot&&snapshot.projectionDigest!==next.projectionDigest)throw new GraphDatabaseError("Physical source/edge snapshot changed during rolling rebuild.","GRAPH_REBUILD_SOURCE_CHANGED");snapshot=next;
      }
      if(!snapshot)throw new GraphDatabaseError("Native edge service returned no physical source snapshot.","GRAPH_REBUILD_INVALID_PAGE");request();sum(result.graph,await applyGraphRebuildSnapshot(adapter,snapshot,"edges"));
    }
    result.complete=!result.limited&&options.syncRelationships!==false;return result;
  }catch(error){if(current){result[current.table].failed++;result.errors.push({entity:current.table,id:current.physicalId,error:error instanceof GraphDatabaseError?error.code??"GRAPH_REBUILD_FAILED":"GRAPH_REBUILD_NATIVE_FAILED"});}
    throw new GraphRebuildPartialError(result,error);
  }finally{result.duration=Date.now()-start;options.transport.close();}
}
