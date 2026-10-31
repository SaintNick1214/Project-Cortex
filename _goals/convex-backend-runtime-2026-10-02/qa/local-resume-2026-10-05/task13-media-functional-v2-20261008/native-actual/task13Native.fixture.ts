/** Bounded read-only diagnostic for the owned disposable media fixture. Not shipped. */
import {v} from 'convex/values';
import {internalQuery} from './_generated/server';
export const snapshot=internalQuery({args:{tenantId:v.string(),memorySpaceId:v.string()},handler:async(ctx,args)=>{
 const jobs=await ctx.db.query('runtimeMediaJobs').withIndex('by_scope',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId)).take(21);
 const accounts=await ctx.db.query('runtimeBudgetAccounts').filter(q=>q.eq(q.field('tenantId'),args.tenantId)).take(21);
 const operations=await ctx.db.query('runtimeModelOperations').withIndex('by_identity',q=>q.eq('tenantId',args.tenantId)).take(21);
 const artifacts=await ctx.db.query('artifacts').withIndex('by_runtime_key',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId)).take(21);
 if([jobs,accounts,operations,artifacts].some(rows=>rows.length>20))throw Error('TASK13_SCOPE_LIMIT');
 const attempts=[];
 for(const op of operations){const rows=await ctx.db.query('runtimeModelAttempts').withIndex('by_child_attempt',q=>q.eq('operationDocumentId',op._id)).take(3);
  if(rows.length>2)throw Error('TASK13_ATTEMPT_LIMIT');
  for(const row of rows)attempts.push({attemptId:row._id,operationId:op._id,state:row.state,ordinal:row.ordinal,dispatchIdentity:row.dispatchIdentity,
   reservationUnits:row.reservationUnits,measuredInputTokens:row.measuredInputTokens,maximumOutputTokens:row.maximumOutputTokens,
   slotReleased:row.slotReleased,resultWithheld:row.resultWithheld,checkpointAt:row.checkpointAt??null,
   terminalEvidenceHash:row.terminalEvidenceHash??null,terminal:row.terminalEvidenceCanonical?JSON.parse(row.terminalEvidenceCanonical):null,
   resultAttachmentState:row.resultAttachmentState??null,result:row.privateResultCanonical?JSON.parse(row.privateResultCanonical):null});
 }
 const assets=[];
 for(const job of jobs){if(!job.assetVersionId)continue;const value=await ctx.db.query('runtimeAssetVersions').withIndex('by_version_id',q=>q.eq('tenantId',job.tenantId).eq('memorySpaceId',job.memorySpaceId).eq('versionId',job.assetVersionId!)).unique();
  if(value)assets.push({...value,physicalStorage:await ctx.storage.getMetadata(value.storageId)});
 }
 return {jobs:jobs.map(row=>({jobId:row.jobId,artifactId:row.artifactId,requestId:row.requestId,kind:row.kind,state:row.state,revision:row.revision,
  createdAt:row.createdAt,updatedAt:row.updatedAt,runBudgetId:row.runBudgetId,runAccountId:row.runAccountId,reference:row.reference,
  attemptId:row.attemptId??null,modelOperationId:row.modelOperationId??null,dispatchIdentity:row.dispatchIdentity??null,
  snapshot:row.snapshotCanonical?JSON.parse(row.snapshotCanonical):null,proof:row.proofCanonical?JSON.parse(row.proofCanonical):null,
  result:row.resultCanonical?JSON.parse(row.resultCanonical):null,assetVersionId:row.assetVersionId??null,failureCode:row.failureCode??null,
  costStatus:row.costStatus,downloadAttempt:row.downloadAttempt,pollCount:row.pollCount,terminalStatus:row.terminalStatus??null,
  privateOperationRetained:!!row.operation,privateInferenceIdRetained:!!row.inferenceId,privateWebhookSecretRetained:!!row.webhookSecret})),
 accounts:accounts.map(row=>({accountId:row._id,kind:row.kind,runBudgetId:row.runBudgetId??null,root:row.root,windowId:row.windowId,
  windowStart:row.windowStart,windowEnd:row.windowEnd,reservedUnits:row.reservedUnits,uncertainUnits:row.uncertainUnits,settledUnits:row.settledUnits,
  activeConcurrency:row.activeConcurrency,limitUnits:row.limitUnits,cancelled:row.cancelled??false})),
 operations:operations.map(row=>({operationId:row._id,operationKey:row.operationKey,semanticId:row.semanticId,runAccountId:row.runAccountId,
  reference:row.reference,reservedUnits:row.reservedUnits,uncertainUnits:row.uncertainUnits,settledUnits:row.settledUnits,cancelled:row.cancelled})),attempts,artifacts,assets};
}});
