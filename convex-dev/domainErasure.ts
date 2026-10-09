/** Seven fixed, deployment-administrator-only erasure operations. Never publicly registered. */
import { internalQuery, internalMutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { digest, byteSize, clean } from "./lib/factHistoryProvenance";
import { requireLifecycleReady, reserveLifecycle, reconcileRow, markDeletedRow, deleteUnreferencedStorage, pruneOrphanIdentity, type Primary } from "./lib/referenceLifecycle";
import { captureGraphErasure, graphTables } from "./lib/graphSync";
import { erasureTables, erasureRoot, validateErasureDomain, erasureFail, erasureAction, projectErasure, checkErasureIncoming, normalizeErasureId, erasureTarget, type ErasureDomain, type ErasureRow } from "./lib/domainErasureScope";

const domainValidator = v.object({kind:v.union(v.literal("user"),v.literal("space")),tenantId:v.optional(v.string()),userId:v.optional(v.string()),memorySpaceId:v.optional(v.string()),rootDocumentId:v.optional(v.string())});
const tableValidator = v.union(...erasureTables.map(table=>v.literal(table)));
const pageFields = {cursor:v.union(v.string(),v.null()),endCursor:v.optional(v.union(v.string(),v.null())),numItems:v.number()};
const selectedFields = {domain:domainValidator,table:tableValidator,id:v.string(),expectedFingerprint:v.string()};
const envelope = (domain:ErasureDomain) => ({protocolVersion:1 as const,domain,observationTime:Date.now()});
function pageOptions(args:{cursor:string|null;endCursor?:string|null;numItems:number}) {
  if (!Number.isInteger(args.numItems)||args.numItems<1||args.numItems>128) erasureFail("ERASURE_PAGE_INVALID");
  return {cursor:args.cursor,endCursor:args.endCursor,numItems:args.numItems,maximumRowsRead:128,maximumBytesRead:2*1024*1024};
}
async function finish<T>(ctx:Pick<QueryCtx,"meta">,result:T):Promise<T> {
  const metrics=await ctx.meta.getTransactionMetrics();
  if (metrics.bytesRead.used+metrics.bytesWritten.used>12*1024*1024||byteSize(result)>8*1024*1024) erasureFail("ERASURE_NATIVE_BUDGET");
  return clean(result) as T;
}
async function discover(ctx:QueryCtx,args:{domain:ErasureDomain;table:Primary;cursor:string|null;endCursor?:string|null;numItems:number},verify=false) {
  await erasureRoot(ctx,args.domain,verify);
  const page=await ctx.db.query(args.table).paginate(pageOptions(args));
  // Split pages are provisional and must be discarded by the SDK, including any projections.
  if (page.pageStatus === "SplitRequired" || page.pageStatus === "SplitRecommended") return finish(ctx,{...envelope(args.domain),table:args.table,...page,page:[]});
  const projections=[];
  for(const row of page.page) {
    const content=row as unknown as ErasureRow;
    const relevantLegacyHistory=args.table==="factHistory"&&content.scopeVersion!==1&&content.tenantId===undefined&&(args.domain.kind==="user"?content.userId===args.domain.userId:content.memorySpaceId===args.domain.memorySpaceId);
    if (!relevantLegacyHistory && ("tenantId" in row ? row.tenantId!==args.domain.tenantId : args.domain.tenantId!==undefined && args.table!=="governancePolicies" && args.table!=="governanceEnforcement")) continue;
    const projection=await projectErasure(ctx,args.table,row as unknown as ErasureRow,args.domain);
    // No content or foreign-domain identifiers are exported by this administrative plan.
    if(projection.reason!=="foreignTenant")projections.push(projection);
  }
  return finish(ctx,{...envelope(args.domain),table:args.table,...page,page:projections});
}
export const discoverPage = internalQuery({args:{domain:domainValidator,table:tableValidator,...pageFields},handler:(ctx,args)=>discover(ctx,args)});
export const verifyPage = internalQuery({args:{domain:domainValidator,table:tableValidator,...pageFields},handler:(ctx,args)=>discover(ctx,args,true)});
async function selected(ctx:QueryCtx|MutationCtx,args:{domain:ErasureDomain;table:Primary;id:string;expectedFingerprint:string},preflight=false) {
  validateErasureDomain(args.domain);await requireLifecycleReady(ctx);
  const id=normalizeErasureId(ctx,args.table,args.id),row=await ctx.db.get(id);
  if(!row)return null;
  if(digest(row)!==args.expectedFingerprint)erasureFail("ERASURE_SELECTION_CHANGED");
  const projection=await projectErasure(ctx,args.table,row as unknown as ErasureRow,args.domain);
  if(projection.action==="block")erasureFail(projection.reason??"ERASURE_BLOCKED");
  if(!["delete","root","detach"].includes(projection.action))erasureFail("ERASURE_NOT_AUTHORIZED");
  if(projection.action!=="detach")await checkErasureIncoming(ctx,args.table,row as unknown as ErasureRow,args.domain,preflight);
  return {row,id,projection};
}
export const checkRecord = internalQuery({args:selectedFields,handler:async(ctx,args)=>finish(ctx,{...envelope(args.domain),record:(await selected(ctx,args,true))?.projection??null})});
export const checkBinaryReferences = internalQuery({args:selectedFields,handler:async(ctx,args)=>{
  const record=await selected(ctx,args,true);const blobs=[];
  for(const storageId of record?.projection.storageIds??[]) {
    const id=ctx.db.system.normalizeId("_storage",storageId);if(!id)erasureFail("REFERENCE_STORAGE_ID_INVALID");
    const targets=await ctx.db.query("cortexReferenceTargets").withIndex("by_key",q=>q.eq("key",`storage:${id}`)).take(2);
    if(targets.length!==1||targets[0].counterGeneration!==(await requireLifecycleReady(ctx)).generation)erasureFail("REFERENCE_COUNTER_DRIFT");
    const target=targets[0],metadata=await ctx.db.system.get("_storage",id);
    const references=await ctx.db.query("cortexReferenceEdges").withIndex("by_target",q=>q.eq("targetTargetId",target._id)).collect();
    if(references.length!==target.refCount||references.some(edge=>edge.kind!=="storage"||edge.countedGeneration!==target.generation)||references.reduce((sum,edge)=>sum+(edge.occurrenceCount??0),0)!==target.occurrenceCount)erasureFail("REFERENCE_COUNTER_DRIFT");
    blobs.push({storageId,refCount:target.refCount,occurrenceCount:target.occurrenceCount,revision:target.revision,exists:metadata!==null});
  }
  return finish(ctx,{...envelope(args.domain),blobs});
}});
export const getReceiptPage = internalQuery({args:{domain:domainValidator,operationId:v.string(),itemKey:v.optional(v.string()),cursor:v.union(v.string(),v.null()),numItems:v.number()},handler:async(ctx,args)=>{
  validateErasureDomain(args.domain);
  const query=ctx.db.query("cortexErasureReceipts").withIndex("by_operation_item",q=>args.itemKey===undefined?q.eq("operationId",args.operationId):q.eq("operationId",args.operationId).eq("itemKey",args.itemKey));
  const page=await query.paginate(pageOptions(args));
  const domainDigest=digest(args.domain);
  if(page.page.some(row=>row.domainDigest!==domainDigest))erasureFail("ERASURE_RECEIPT_CONFLICT");
  return finish(ctx,{...envelope(args.domain),...page,page:page.page.map(row=>row.outcome)});
}});
/** All remaining eligibility is server-derived. Root closure is rechecked in its actual mutation. */
async function guardRoot(ctx:MutationCtx,domain:ErasureDomain,rootId:string) {
  for(const table of erasureTables) {
    // Convex permits only one paginated query in a UDF. This last-item guard
    // consumes ordinary native query iterators, with actual transaction budget
    // checks; it never turns a page boundary into permission to remove a root.
    for await (const row of ctx.db.query(table)) {
        if(row._id===rootId)continue;
        // Closure needs authoritative membership, not a deletion projection for
        // every unrelated row. Ambiguous membership still resolves its physical
        // source through erasureAction before a root can be removed.
        const membership=await erasureAction(ctx,table,row as unknown as ErasureRow,domain);
        if(["delete","detach","root","block"].includes(membership.action))erasureFail("ERASURE_REMAINING_PRIMARY");
        await reserveLifecycle(ctx,2048);
    }
  }
}
export const eraseRecord = internalMutation({args:{...selectedFields,operationId:v.string(),itemKey:v.string(),requestDigest:v.string(),domainDigest:v.string(),graphInvocationId:v.optional(v.string())},handler:async(ctx,args)=>{
  if(!args.operationId.trim()||args.operationId.length>256||args.itemKey!==`${args.table}:${args.id}`||args.domainDigest!==digest(args.domain))erasureFail("ERASURE_PROTOCOL");
  const request={domain:args.domain,table:args.table,id:args.id,expectedFingerprint:args.expectedFingerprint,operationId:args.operationId,itemKey:args.itemKey,domainDigest:args.domainDigest,graphInvocationId:args.graphInvocationId};
  if(args.requestDigest!==digest(request))erasureFail("ERASURE_REQUEST_DIGEST");
  const previous=await ctx.db.query("cortexErasureReceipts").withIndex("by_operation_item",q=>q.eq("operationId",args.operationId).eq("itemKey",args.itemKey)).take(2);
  if(previous.length>1)erasureFail("ERASURE_RECEIPT_CONFLICT");
  if(previous.length) {if(previous[0].requestDigest!==args.requestDigest||previous[0].domainDigest!==args.domainDigest)erasureFail("ERASURE_RECEIPT_CONFLICT");return previous[0].outcome;}
  const record=await selected(ctx,args);
  if(!record)return finish(ctx,{...envelope(args.domain),operationId:args.operationId,itemKey:args.itemKey,table:args.table,id:args.id,state:"alreadyAbsent",deleted:0,detached:0,retainedVersions:0,messages:0,blobs:[],graphJobs:[]});
  const {row,id,projection}=record;
  if(projection.managedQueueCount && !args.graphInvocationId)erasureFail("ERASURE_GRAPH_PARTICIPANT_REQUIRED");
  await erasureRoot(ctx,args.domain);
  if(projection.action==="root")await guardRoot(ctx,args.domain,args.id);
  const target=await erasureTarget(ctx,args.table,row as unknown as ErasureRow);
  await reserveLifecycle(ctx,0,byteSize(row)+8192,8);
  let graphJobs:Awaited<ReturnType<typeof captureGraphErasure>>=[];
  if(args.graphInvocationId && args.table in graphTables && projection.action!=="detach") graphJobs=await captureGraphErasure(ctx,args.table as keyof typeof graphTables,row as unknown as ErasureRow,{graphInvocationId:args.graphInvocationId});
  const blobs=[];
  if(projection.action==="detach") {
    const user=args.domain.userId!;
    if(args.table==="memorySpaces")await reconcileRow(ctx,id,{participants:(row as {participants:{id:string;type:string}[]}).participants.filter(p=>!(p.id===user&&p.type==="human"))});
    else if(args.table==="artifacts")await reconcileRow(ctx,id,{collaborators:(row as {collaborators:{id:string;type:string;role:string}[]}).collaborators.filter(p=>!(p.id===user&&p.type==="user"&&p.role!=="owner"))});
    else erasureFail("ERASURE_DETACH_INVALID");
  } else {
    await markDeletedRow(ctx,id);
    for(const storageId of projection.storageIds) {const storage=ctx.db.system.normalizeId("_storage",storageId);if(!storage)erasureFail("REFERENCE_STORAGE_ID_INVALID");blobs.push({storageId,disposition:await deleteUnreferencedStorage(ctx,storage)});}
    if(target && (!projection.graph||!args.graphInvocationId))await pruneOrphanIdentity(ctx,target._id);
  }
  const outcome=clean({...envelope(args.domain),operationId:args.operationId,itemKey:args.itemKey,table:args.table,id:args.id,state:"committed",deleted:projection.action==="detach"?0:1,detached:projection.action==="detach"?1:0,retainedVersions:projection.action==="detach"?0:projection.retainedVersions,messages:projection.action==="detach"?0:projection.messages,serializedBytes:projection.serializedBytes,blobs,graphJobs});
  await ctx.db.insert("cortexErasureReceipts",{operationId:args.operationId,itemKey:args.itemKey,requestDigest:args.requestDigest,domainDigest:args.domainDigest,stage:projection.action,state:"committed",outcome,createdAt:Date.now(),expiresAt:Date.now()+7*24*60*60*1000});
  return finish(ctx,outcome);
}});
export const purgeExpiredReceiptsPage = internalMutation({args:{before:v.number(),...pageFields},handler:async(ctx,args)=>{
  if(!Number.isFinite(args.before)||args.before>Date.now())erasureFail("ERASURE_EXPIRY_INVALID");
  const page=await ctx.db.query("cortexErasureReceipts").withIndex("by_expiry",q=>q.lt("expiresAt",args.before)).paginate(pageOptions(args));
  if(page.pageStatus==="SplitRequired"||page.pageStatus==="SplitRecommended")return finish(ctx,{protocolVersion:1,...page,page:[],deleted:0});
  for(const row of page.page) {
    const outcome=row.outcome as {table:Primary;id:string;domain:ErasureDomain;deleted:number};
    if(outcome.deleted===1) {
      const target=await ctx.db.query("cortexReferenceTargets").withIndex("by_document",q=>q.eq("table",outcome.table).eq("documentId",outcome.id)).take(2).then(rows=>{if(rows.length>1)erasureFail("REFERENCE_DUPLICATE_IDENTITY");return rows[0];});
      if(target) {
        const copies=await ctx.db.query("graphSyncQueue").withIndex("by_scope_source_state",q=>q.eq("tenantId",outcome.domain.tenantId).eq("physicalSourceId",outcome.id)).collect();
        // Original jobs retain reconciliation authority while copied data or
        // in-flight delivery remains. Prune only genuinely orphaned provenance.
        if(copies.every(job=>["synced","suppressed"].includes(job.state??"")&&job.entity===undefined&&job.projection===undefined&&job.requestJson===undefined&&job.projectionJson===undefined))await pruneOrphanIdentity(ctx,target._id);
      }
    }
    await ctx.db.delete(row._id);
  }
  return finish(ctx,{protocolVersion:1,continueCursor:page.continueCursor,isDone:page.isDone,deleted:page.page.length});
}});
