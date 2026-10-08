/** Immutable, exact-scope managed graph jobs. Native scope selection is never administrator authentication. */
import {paginationOptsValidator} from "convex/server";
import {v} from "convex/values";
import {mutation,query,internalMutation,internalQuery,type MutationCtx,type QueryCtx} from "./_generated/server";
import type {Id,Doc} from "./_generated/dataModel";
import {reconcileRow,markDeletedRow,reserveLifecycle} from "./lib/referenceLifecycle";
import {graphFail,graphTable,sourceTarget,sourceIdentity,graphRequestValidator,
  capturedProjection,graphScopeValidator,graphSourceDigest,graphTables,type GraphTable,type GraphProofBudget} from "./lib/graphSync";
import {byteSize,canonical,digest} from "./lib/factHistoryProvenance";
import {validateDomainScope} from "./lib/domainScope";

const attempt={...graphScopeValidator,id:v.id("graphSyncQueue"),generation:v.string(),attemptToken:v.string()};
async function selectedJob(ctx:MutationCtx|QueryCtx,args:{tenantId?:string;id:Id<"graphSyncQueue">;generation:string}) {
  validateDomainScope(args.tenantId);
  const job=await ctx.db.get(args.id);
  if(!job || job.schemaVersion!==2 || job.tenantKnown!==true || job.tenantId!==args.tenantId || job.generation!==args.generation ||
    !job.identity || !job.projection || !job.attemptToken || !job.sourceRevision || !job.referenceGeneration || !job.ownershipRevision || !job.state)
    graphFail("GRAPH_JOB_UNRESOLVED");
  const expected=sourceIdentity(graphTable(job.table),{_id:job.physicalSourceId,tenantId:job.tenantId,memorySpaceId:job.memorySpaceId});
  if(expected.key!==job.identity.key || expected.tupleJson!==job.identity.tupleJson || job.projection.identity?.key!==expected.key ||
    job.projection.sourceRevision!==job.sourceRevision)graphFail("GRAPH_JOB_UNRESOLVED");
  const request={request:{graphInvocationId:job.graphInvocationId,priority:job.priority??"normal"},table:job.table,operation:job.operation,projection:job.projection,sourceDigest:job.sourceDigest,suppressedJobs:job.suppressedJobs??[]};
  if(job.sourceDigest!==graphSourceDigest(job.projection)||job.projectionJson!==canonical(job.projection)||job.projectionDigest!==digest(job.projection)||job.requestJson!==canonical(request)||job.requestDigest!==digest(request))graphFail("GRAPH_JOB_UNRESOLVED");
  return job;
}
export const getGraphJob=query({args:{...graphScopeValidator,id:v.id("graphSyncQueue"),generation:v.string()},handler:selectedJob});

/** Legacy caller-supplied entities/deletes cannot invent physical authority. */
export const queueForSync=mutation({args:{table:v.string(),entityId:v.string(),operation:v.union(v.literal("insert"),v.literal("update"),v.literal("delete")),
  entity:v.optional(v.any()),priority:v.optional(v.string()),physicalSourceId:v.optional(v.string()),tenantId:v.optional(v.string()),queueGraph:v.optional(graphRequestValidator)},
  handler:async(ctx,args)=>{
    if(args.entity!==undefined || args.operation==="delete" || !args.physicalSourceId || !args.queueGraph)graphFail("GRAPH_QUEUE_MIGRATION_REQUIRED");
    const table=graphTable(args.table),id=ctx.db.normalizeId(table,args.physicalSourceId);if(!id)graphFail("GRAPH_PHYSICAL_SOURCE_REQUIRED");
    const row=await ctx.db.get(id);if(!row || row.tenantId!==args.tenantId)graphFail("GRAPH_SCOPE_MISMATCH");
    // The compatibility path uses the same capture context; it does not mutate the selected source.
    return captureValidatedGraphJob(ctx,table,row,args.queueGraph,args.operation);
  }});
// Transaction-callable fixed capture for trusted administration/Task19 before deleting the source.
export {captureGraphChange,captureGraphErasure} from "./lib/graphSync";
import {captureValidatedGraphJob} from "./lib/graphSync";

export const markSynced=mutation({args:attempt,handler:async(ctx,args)=>{
  const job=await selectedJob(ctx,args);
  if(job.state==="synced" && job.terminalAttemptToken===args.attemptToken)return {id:job._id,state:job.state};
  if(job.state!=="pending" || job.attemptToken!==args.attemptToken)graphFail("GRAPH_ACK_CONFLICT");
  await reconcileRow(ctx,job._id,{state:"synced",synced:true,syncedAt:Date.now(),terminalAt:Date.now(),terminalAttemptToken:args.attemptToken,lastError:undefined});
  return {id:job._id,state:"synced" as const};
}});
export const suppressJob=mutation({args:attempt,handler:async(ctx,args)=>{
  const job=await selectedJob(ctx,args);
  if(job.state==="suppressed" && job.terminalAttemptToken===args.attemptToken)return {id:job._id,state:job.state};
  if(job.state!=="pending" || job.attemptToken!==args.attemptToken)graphFail("GRAPH_ACK_CONFLICT");
  await reconcileRow(ctx,job._id,{state:"suppressed",synced:false,terminalAt:Date.now(),terminalAttemptToken:args.attemptToken,lastError:undefined});
  return {id:job._id,state:"suppressed" as const};
}});
export const markFailed=mutation({args:{...attempt,errorCode:v.string(),maxAttempts:v.number()},handler:async(ctx,args)=>{
  const job=await selectedJob(ctx,args);
  if(!Number.isSafeInteger(args.maxAttempts)||args.maxAttempts<1||args.maxAttempts>10||!/^[A-Z0-9_]{1,96}$/.test(args.errorCode))graphFail("GRAPH_RETRY_INVALID");
  if(job.lastFailedAttemptToken===args.attemptToken)return {id:job._id,state:job.state,failedAttempts:job.failedAttempts??0};
  if(job.state!=="pending"||job.attemptToken!==args.attemptToken)graphFail("GRAPH_ACK_CONFLICT");
  const failedAttempts=(job.failedAttempts??0)+1,failed=failedAttempts>=args.maxAttempts;
  await reconcileRow(ctx,job._id,{failedAttempts,lastError:args.errorCode,lastFailedAttemptToken:args.attemptToken,
    state:failed?"failed":"pending",synced:false,attemptToken:failed?job.attemptToken:crypto.randomUUID(),
    terminalAt:failed?Date.now():undefined,terminalAttemptToken:failed?args.attemptToken:undefined});
  return {id:job._id,state:failed?"failed":"pending",failedAttempts};
}});
function limit(value:number) {if(!Number.isSafeInteger(value)||value<1||value>128)graphFail("GRAPH_PAGE_LIMIT");return value;}
const pageArgs={...graphScopeValidator,limit:v.number(),cursor:v.optional(v.union(v.string(),v.null()))};
export const getUnsyncedItems=query({args:{...graphScopeValidator,limit:v.number()},handler:async(ctx,args)=>{
  validateDomainScope(args.tenantId);limit(args.limit);
  const jobs=await ctx.db.query("graphSyncQueue").withIndex("by_scope_state",q=>q.eq("tenantId",args.tenantId).eq("state","pending")).order("asc").take(args.limit);
  for(const job of jobs)await selectedJob(ctx,{...args,id:job._id,generation:job.generation??""});
  if(byteSize(jobs)>2*1024*1024)graphFail("GRAPH_PAGE_BUDGET");return jobs;
}});
export const getHighPriorityItems=query({args:{...graphScopeValidator,limit:v.number()},handler:async(ctx,args)=>{
  validateDomainScope(args.tenantId);limit(args.limit);
  const jobs=await ctx.db.query("graphSyncQueue").withIndex("by_scope_priority_state",q=>q.eq("tenantId",args.tenantId).eq("priority","high").eq("state","pending")).take(args.limit);
  for(const job of jobs)await selectedJob(ctx,{...args,id:job._id,generation:job.generation??""});
  if(byteSize(jobs)>2*1024*1024)graphFail("GRAPH_PAGE_BUDGET");return jobs;
}});
export const getFailedItems=query({args:pageArgs,handler:async(ctx,args)=>{
  validateDomainScope(args.tenantId);limit(args.limit);
  return ctx.db.query("graphSyncQueue").withIndex("by_scope_state",q=>q.eq("tenantId",args.tenantId).eq("state","failed"))
    .paginate({numItems:args.limit,cursor:args.cursor??null,maximumRowsRead:256,maximumBytesRead:2*1024*1024});
}});
export const getSyncStats=query({args:{...graphScopeValidator,limit:v.optional(v.number()),cursor:v.optional(v.union(v.string(),v.null()))},handler:async(ctx,args)=>{
  validateDomainScope(args.tenantId);
  const page=await ctx.db.query("graphSyncQueue").withIndex("by_scope_state",q=>q.eq("tenantId",args.tenantId))
    .paginate({numItems:limit(args.limit??128),cursor:args.cursor??null,maximumRowsRead:256,maximumBytesRead:2*1024*1024});
  const rows=page.page.filter(r=>r.schemaVersion===2),synced=rows.filter(r=>r.state==="synced"),pending=rows.filter(r=>r.state==="pending");
  return {total:rows.length,unsynced:pending.length,synced:synced.length,failed:rows.filter(r=>r.state==="failed").length,
    suppressed:rows.filter(r=>r.state==="suppressed").length,legacyExcluded:page.page.length-rows.length,
    avgSyncTimeMs:synced.length?synced.reduce((n,r)=>n+(r.syncedAt!-r.createdAt),0)/synced.length:0,
    syncLagMs:pending.length?Date.now()-Math.min(...pending.map(r=>r.createdAt)):0,
    byTable:Object.fromEntries(Object.keys(graphTablesForStats).map(table=>[table,rows.filter(r=>r.table===table).length])),
    limited:!page.isDone,continueCursor:page.continueCursor,isDone:page.isDone};
}});
const graphTablesForStats={memories:1,facts:1,contexts:1,conversations:1,memorySpaces:1,immutable:1,mutable:1,artifacts:1};
export const deleteSyncItem=mutation({args:{id:v.id("graphSyncQueue")},handler:async()=>graphFail("GRAPH_QUEUE_RETENTION_REQUIRED")});
export const purgeAll=mutation({args:{},handler:async()=>graphFail("GRAPH_QUEUE_ADMIN_MIGRATION_REQUIRED")});
const disposalSelection={table:v.string(),physicalSourceId:v.string(),sourceRevision:v.number(),ownershipRevision:v.number(),referenceRevision:v.number(),referenceGeneration:v.string(),targetId:v.id("cortexReferenceTargets")};
const disposalRange=v.object({cursor:v.union(v.string(),v.null()),endCursor:v.union(v.string(),v.null())});
const disposalMode=v.union(
  v.object({kind:v.literal("preflight"),...disposalSelection,scan:v.union(v.literal("source"),v.literal("legacy")),range:disposalRange}),
  v.object({kind:v.literal("status"),id:v.id("graphSyncQueue"),generation:v.string(),...disposalSelection}),
  v.object({kind:v.literal("dispose"),id:v.id("graphSyncQueue"),generation:v.string(),expectedDisposalRevision:v.number(),...disposalSelection}));
function sameDisposalRow(row:Doc<"graphSyncQueue">,table:GraphTable,identity:ReturnType<typeof sourceIdentity>,generation:string,maximumRevision:number) {
  if(row.schemaVersion!==2||row.table!==table||row.tenantKnown!==true||row.physicalSourceId!==identity.physicalSourceId||canonical(row.identity??null)!==canonical(identity)||
    !row.generation||!row.attemptToken||row.referenceGeneration!==generation||!Number.isSafeInteger(row.sourceRevision)||row.sourceRevision!>maximumRevision||!row.state)
    graphFail("GRAPH_JOB_UNRESOLVED");
}
export const clearSyncedItems=internalMutation({args:{...graphScopeValidator,olderThanMs:v.optional(v.number()),limit:v.optional(v.number()),cursor:v.optional(v.union(v.string(),v.null())),disposal:v.optional(disposalMode)},handler:async(ctx,args)=>{
  validateDomainScope(args.tenantId);
  if(args.disposal) {
    const mode=args.disposal,table=graphTable(mode.table),id=ctx.db.normalizeId(table,mode.physicalSourceId),target=await ctx.db.get(mode.targetId);
    if(!id||!target||target.table!==table||target.documentId!==id||!target.scopeKnown||target.tenantId!==args.tenantId||target.generation!==mode.referenceGeneration||target.ownershipRevision!==mode.ownershipRevision||
      !Number.isSafeInteger(mode.sourceRevision)||mode.sourceRevision<1)graphFail("GRAPH_ERASURE_AUTHORITY_CHANGED");
    const identity=sourceIdentity(table,{_id:id,tenantId:target.tenantId,memorySpaceId:target.memorySpaceId});
    const source=await ctx.db.get(id),selected=ctx.db.query("graphSyncQueue").withIndex("by_scope_source_state",q=>q.eq("tenantId",args.tenantId).eq("physicalSourceId",id));
    if(mode.kind==="preflight") {
      if(!source||source.tenantId!==args.tenantId||target.state!=="live"||target.sourceRevision!==mode.sourceRevision||target.revision!==mode.referenceRevision)graphFail("GRAPH_ERASURE_AUTHORITY_CHANGED");
      const actual=await sourceTarget(ctx,table,source);if(actual._id!==target._id)graphFail("GRAPH_ERASURE_AUTHORITY_CHANGED");
      const fields:Record<GraphTable,string>={memories:"memoryId",facts:"factId",contexts:"contextId",conversations:"conversationId",memorySpaces:"memorySpaceId",artifacts:"artifactId",immutable:"id",mutable:"key"};
      const logical=(source as Record<string,unknown>)[fields[table]];
      if(typeof logical!=="string")graphFail("GRAPH_ERASURE_AUTHORITY_CHANGED");
      const page=await (mode.scan==="source"?selected:ctx.db.query("graphSyncQueue").withIndex("by_table_entity",q=>q.eq("table",table).eq("entityId",logical)))
        .paginate({...mode.range,numItems:16,maximumRowsRead:64,maximumBytesRead:2*1024*1024});
      if(page.pageStatus!=="SplitRequired")for(const row of page.page) {
        if(mode.scan==="legacy") {if(row.schemaVersion!==2)graphFail("GRAPH_LEGACY_JOB_UNRESOLVED");continue;}
        sameDisposalRow(row,table,identity,target.generation,mode.sourceRevision);
        if(row.disposedAt!==undefined)graphFail("GRAPH_ERASURE_AUTHORITY_CHANGED");
        await selectedJob(ctx,{id:row._id,generation:row.generation!,tenantId:args.tenantId});
      }
      const metrics=await ctx.meta.getTransactionMetrics();if(metrics.bytesRead.used>2*1024*1024||metrics.documentsRead.used>256)graphFail("GRAPH_ERASURE_PAGE_BUDGET");
      return {kind:"preflight" as const,checked:page.pageStatus==="SplitRequired"?0:page.page.length,isDone:page.isDone,continueCursor:page.continueCursor,pageStatus:page.pageStatus,splitCursor:page.splitCursor};
    }
    if(source||target.state!=="deleted"||!target.finalSnapshotDigest||target.sourceRevision!==mode.sourceRevision+1||target.revision!==mode.referenceRevision+1)graphFail("GRAPH_ERASURE_SOURCE_NOT_ABSENT");
    const original=await ctx.db.get(mode.id);
    if(!original||original.generation!==mode.generation)graphFail("GRAPH_JOB_UNRESOLVED");
    sameDisposalRow(original,table,identity,target.generation,target.sourceRevision!);
    if(original.operation!=="delete"||original.sourceRevision!==target.sourceRevision||original.state!=="synced"&&original.state!=="suppressed")graphFail("GRAPH_ERASURE_NOT_ACKNOWLEDGED");
    const status=()=>({kind:"status" as const,id:original._id,generation:original.generation!,identity:original.identity!,sourceRevision:original.sourceRevision!,
      requestDigest:original.requestDigest!,projectionDigest:original.projectionDigest!,state:original.state!,disposalRevision:original.disposalRevision??0,disposedJobCount:original.disposedJobCount??0,complete:original.disposalComplete===true});
    if(mode.kind==="status")return status();
    if(!Number.isSafeInteger(mode.expectedDisposalRevision)||mode.expectedDisposalRevision!==(original.disposalRevision??0))graphFail("GRAPH_ERASURE_PROGRESS_CHANGED");
    if(original.disposalComplete)return status();
    const ranges=original.disposalRanges??[{cursor:null,endCursor:null}],range=ranges[0];if(!range)graphFail("GRAPH_ERASURE_PROGRESS_CHANGED");
    const page=await selected.paginate({...range,numItems:16,maximumRowsRead:64,maximumBytesRead:2*1024*1024});
    let remaining=ranges.slice(1),copied=0,writes=4096;
    if(page.pageStatus==="SplitRequired") {
      if(!page.splitCursor||page.splitCursor===range.cursor||page.splitCursor===range.endCursor)graphFail("GRAPH_ERASURE_INVALID_PAGE");
      remaining=[{cursor:range.cursor,endCursor:page.splitCursor},{cursor:page.splitCursor,endCursor:range.endCursor},...remaining];
    } else {
      for(const row of page.page) {
        sameDisposalRow(row,table,identity,target.generation,target.sourceRevision!);
        if(row.disposedAt===undefined){await selectedJob(ctx,{id:row._id,generation:row.generation!,tenantId:args.tenantId});copied++;writes+=byteSize(row)+4096;}
      }
      if(!page.isDone&&page.continueCursor!==range.endCursor) {
        if(!page.continueCursor||page.continueCursor===range.cursor)graphFail("GRAPH_ERASURE_INVALID_PAGE");
        remaining=[{cursor:page.continueCursor,endCursor:range.endCursor},...remaining];
      }
      await reserveLifecycle(ctx,0,writes,page.page.length*3+3);
      for(const row of page.page)if(row.disposedAt===undefined)await reconcileRow(ctx,row._id,{entity:undefined,projection:undefined,projectionJson:undefined,requestJson:undefined,suppressedJobs:undefined,
        disposedAt:Date.now(),...(row.state==="pending"?{state:"suppressed",synced:false,terminalAt:Date.now(),terminalAttemptToken:row.attemptToken}:{})});
    }
    const metrics=await ctx.meta.getTransactionMetrics();if(metrics.bytesRead.used>2*1024*1024||metrics.documentsRead.used>256||writes>3*1024*1024)graphFail("GRAPH_ERASURE_PAGE_BUDGET");
    const progress={disposalRevision:(original.disposalRevision??0)+1,disposedJobCount:(original.disposedJobCount??0)+copied,disposalComplete:remaining.length===0,disposalRanges:remaining};
    await reconcileRow(ctx,original._id,progress);
    return {...status(),...progress,kind:"status" as const,complete:progress.disposalComplete};
  }
  validateDomainScope(args.tenantId);const age=args.olderThanMs??7*24*60*60*1000;
  if(!Number.isSafeInteger(age)||age<7*24*60*60*1000)graphFail("GRAPH_QUEUE_RETENTION_REQUIRED");
  const cutoff=Date.now()-age,page=await ctx.db.query("graphSyncQueue").withIndex("by_scope_state",q=>q.eq("tenantId",args.tenantId))
    .paginate({numItems:limit(args.limit??64),cursor:args.cursor??null,maximumRowsRead:128,maximumBytesRead:2*1024*1024});
  const rows=page.page.filter(row=>(row.state==="synced"||row.state==="suppressed")&&row.terminalAt!==undefined&&row.terminalAt<cutoff);
  for(const row of rows)await markDeletedRow(ctx,row._id);return {deleted:rows.length,limited:!page.isDone,continueCursor:page.continueCursor,isDone:page.isDone};
}});

// Fixed administrator-only rebuild transport. These snapshots are not persisted queue jobs.
const rebuildKind=v.union(v.literal("Memory"),v.literal("Fact"),v.literal("Context"),v.literal("Conversation"),v.literal("MemorySpace"),v.literal("Immutable"),v.literal("Mutable"),v.literal("Artifact"));
const rebuildScope={version:v.literal(2),kind:rebuildKind,tenantId:v.optional(v.string()),memorySpaceId:v.optional(v.string())};
type RebuildScope={version:2;kind:typeof graphTables[keyof typeof graphTables];tenantId?:string;memorySpaceId?:string};
function rebuildTable(kind:RebuildScope["kind"]):GraphTable {
  return Object.entries(graphTables).find(([,candidate])=>candidate===kind)![0] as GraphTable;
}
function sourceQuery(ctx:QueryCtx,table:GraphTable,args:RebuildScope) {
  const tenant=args.tenantId,space=args.memorySpaceId;
  switch(table) {
    case "memories":return space===undefined?ctx.db.query(table).withIndex("by_tenantId",q=>q.eq("tenantId",tenant)):ctx.db.query(table).withIndex("by_tenant_space",q=>q.eq("tenantId",tenant).eq("memorySpaceId",space));
    case "facts":return space===undefined?ctx.db.query(table).withIndex("by_tenantId",q=>q.eq("tenantId",tenant)):ctx.db.query(table).withIndex("by_tenant_space",q=>q.eq("tenantId",tenant).eq("memorySpaceId",space));
    case "contexts":return space===undefined?ctx.db.query(table).withIndex("by_tenantId",q=>q.eq("tenantId",tenant)):ctx.db.query(table).withIndex("by_tenant_space",q=>q.eq("tenantId",tenant).eq("memorySpaceId",space));
    case "conversations":return space===undefined?ctx.db.query(table).withIndex("by_tenantId",q=>q.eq("tenantId",tenant)):ctx.db.query(table).withIndex("by_tenant_space",q=>q.eq("tenantId",tenant).eq("memorySpaceId",space));
    case "artifacts":return space===undefined?ctx.db.query(table).withIndex("by_tenantId",q=>q.eq("tenantId",tenant)):ctx.db.query(table).withIndex("by_tenant_space",q=>q.eq("tenantId",tenant).eq("memorySpaceId",space));
    case "memorySpaces":return space===undefined?ctx.db.query(table).withIndex("by_tenantId",q=>q.eq("tenantId",tenant)):ctx.db.query(table).withIndex("by_tenant_memorySpaceId",q=>q.eq("tenantId",tenant).eq("memorySpaceId",space));
    case "immutable":return ctx.db.query(table).withIndex("by_tenantId",q=>q.eq("tenantId",tenant));
    case "mutable":return ctx.db.query(table).withIndex("by_tenantId",q=>q.eq("tenantId",tenant));
  }
}
async function rebuildBounds(ctx:QueryCtx,args:unknown,result:unknown) {
  const metrics=await ctx.meta.getTransactionMetrics();
  if(metrics.documentsRead.used>256||metrics.bytesRead.used>2*1024*1024||byteSize(args)+byteSize(result)>8*1024*1024)graphFail("GRAPH_REBUILD_PAGE_BUDGET");
  return result;
}
async function rebuildSnapshot(ctx:QueryCtx,table:GraphTable,row:Doc<GraphTable>,target:Doc<"cortexReferenceTargets">,proof:GraphProofBudget) {
  const projection=await capturedProjection(ctx,table,row,target,"update",target.sourceRevision!,proof),identity=projection.identity,
    graphInvocationId=`rebuild:${target._id}:${target.sourceRevision}`,sourceDigest=graphSourceDigest(projection),
    request={sourceDigest,suppressedJobs:[],request:{graphInvocationId,priority:"normal"},table,operation:"update",projection};
  return {_id:`rebuild:${target._id}:${target.sourceRevision}`,schemaVersion:2 as const,table,identity,sourceRevision:target.sourceRevision!,
    ownershipRevision:target.ownershipRevision!,referenceGeneration:target.generation,referenceRevision:target.revision!,targetId:target._id,
    operation:"update" as const,graphInvocationId,requestDigest:digest(request),requestJson:canonical(request),sourceDigest,suppressedJobs:[],
    projectionJson:canonical(projection),projectionDigest:digest(projection),projection,generation:target.generation,
    attemptToken:"administrator-snapshot-not-queue",state:"pending" as const,failedAttempts:0,createdAt:Date.now()};
}
export const rebuildSourcePage=internalQuery({args:{...rebuildScope,paginationOpts:paginationOptsValidator},handler:async(ctx,args)=>{
  validateDomainScope(args.tenantId);const table=rebuildTable(args.kind);
  if(args.memorySpaceId!==undefined&&(!args.memorySpaceId||table==="immutable"||table==="mutable")) {
    if(!args.memorySpaceId)graphFail("GRAPH_SCOPE_MISMATCH");
    return {page:[],isDone:true,continueCursor:args.paginationOpts.endCursor??args.paginationOpts.cursor??"",excluded:"tenant-global kind is not space-owned",schemaVersion:2};
  }
  const maximum=limit(args.paginationOpts.numItems),page=await sourceQuery(ctx,table,args).paginate({...args.paginationOpts,
    numItems:Math.min(maximum,8),maximumRowsRead:240,maximumBytesRead:1536*1024});
  // A SplitRequired range is provisional; callers discard it without applying any row.
  if(page.pageStatus==="SplitRequired")return rebuildBounds(ctx,args,{...page,page:[],schemaVersion:2});
  const proof:GraphProofBudget={reads:0,targets:new Map()},snapshots=[];
  for(const row of page.page) {const target=await sourceTarget(ctx,table,row,proof);snapshots.push(await rebuildSnapshot(ctx,table,row,target,proof));}
  return rebuildBounds(ctx,args,{...page,page:snapshots,schemaVersion:2,scope:{tenantKnown:true,tenantId:args.tenantId??null,memorySpaceId:args.memorySpaceId??null}});
}});
export const rebuildEdgePage=internalQuery({args:{...rebuildScope,physicalSourceId:v.string(),expectedSourceRevision:v.number(),expectedOwnershipRevision:v.number(),expectedReferenceGeneration:v.string(),paginationOpts:paginationOptsValidator},handler:async(ctx,args)=>{
  validateDomainScope(args.tenantId);limit(args.paginationOpts.numItems);const table=rebuildTable(args.kind),id=ctx.db.normalizeId(table,args.physicalSourceId);
  if(!id||args.memorySpaceId!==undefined&&(table==="immutable"||table==="mutable"))graphFail("GRAPH_SCOPE_MISMATCH");
  const row=await ctx.db.get(id);
  if(!row||row.tenantId!==args.tenantId||args.memorySpaceId!==undefined&&(!("memorySpaceId"in row)||row.memorySpaceId!==args.memorySpaceId))graphFail("GRAPH_REBUILD_SOURCE_CHANGED");
  const proof:GraphProofBudget={reads:1,targets:new Map()},target=await sourceTarget(ctx,table,row,proof);
  if(target.sourceRevision!==args.expectedSourceRevision||target.ownershipRevision!==args.expectedOwnershipRevision||target.generation!==args.expectedReferenceGeneration)graphFail("GRAPH_REBUILD_SOURCE_CHANGED");
  const page=await ctx.db.query("cortexReferenceEdges").withIndex("by_source",q=>q.eq("sourceTargetId",target._id)).paginate({...args.paginationOpts,maximumRowsRead:128,maximumBytesRead:512*1024});
  if(page.pageStatus==="SplitRequired")return rebuildBounds(ctx,args,{...page,page:[],schemaVersion:2});
  const snapshot=await rebuildSnapshot(ctx,table,row,target,proof);
  return rebuildBounds(ctx,args,{...page,page:page.page.map(edge=>{const reference=snapshot.projection.references.find(r=>r.role===edge.role&&r.slot===edge.slot);
    return {edgeId:edge._id,disposition:reference?"resolved":"excluded",...reference?{reference}:{}};}),snapshot,schemaVersion:2});
}});
