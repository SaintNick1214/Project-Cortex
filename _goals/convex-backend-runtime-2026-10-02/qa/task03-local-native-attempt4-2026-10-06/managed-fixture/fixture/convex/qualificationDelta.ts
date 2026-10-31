/** Prospective fixture-only internal helpers. Empty-table observations and deleted native IDs;
 * never install policy roots, dispatch models, hydrate private result rows or purge foreign data. */
import { internalMutation, internalQuery } from './_generated/server';
import { runtimeAuthorityReference } from './runtimeAuthSchema';
import { v } from 'convex/values';
const policyTables=['runtimeModelPolicies','runtimeModelQualifications','runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts'] as const;
function prefix(run:string):string{if(!/^foundation-[a-f0-9]{32}$/.test(run))throw new Error('Invalid fixture run');return run+':';}
export const policySnapshot=internalQuery({args:{run:v.string()},handler:async(ctx,args)=>{
 prefix(args.run);const result=[];
 // Fresh guarded disposable target only. A nonempty current policy ledger is unexpected and
 // rejects before returning any foreign/private row. These controls require all five empty.
 for(const name of policyTables){const rows=await ctx.db.query(name).take(1);if(rows.length!==0)throw new Error('Policy ledger unexpectedly nonempty');result.push({table:name,count:0});}
 return result;
}});
export const allocateDeletedAttemptId=internalMutation({args:{run:v.string(),reference:runtimeAuthorityReference},handler:async(ctx,args)=>{
 const p=prefix(args.run),ref=args.reference;if(!ref.tenantId.startsWith(p)||!ref.memorySpaceId?.startsWith(p))throw new Error('Unowned fixture authority');
 for(const name of policyTables)if((await ctx.db.query(name).take(1)).length)throw new Error('Policy ledger unexpectedly nonempty');
 const now=Date.now(),root={manifestId:p+'validator-only',revision:1,canonical:'{}',hash:'0'.repeat(64),artifactRevision:p+'validator-only',evidenceHash:'0'.repeat(64),acceptanceHash:'0'.repeat(64)};
 // Exact current schema validates these transient values. They are deleted within this SAME
 // native transaction and can never be usable policy authority, accounts or dispatch state.
 const accountId=await ctx.db.insert('runtimeBudgetAccounts',{accountKey:p+'native-id',scopeKey:p+'native-id',kind:'run',tenantId:ref.tenantId,runBudgetId:p+'absent-run',reference:ref,requestCanonical:'{}',windowId:p+'native-id',windowStart:now,windowEnd:now+1,currency:'USD',monetaryUnit:'micro-USD',root,limitUnits:1,reservedUnits:0,settledUnits:0,uncertainUnits:0,concurrencyLimit:1,activeConcurrency:0,overrun:false,current:false,cancelled:true,version:1,createdAt:now});
 const operationId=await ctx.db.insert('runtimeModelOperations',{operationId:p+'native-id',reference:ref,tenantId:ref.tenantId,memorySpaceId:ref.memorySpaceId!,principalId:ref.principalId,semanticId:p+'native-id',operationKey:'agent.respond',runAccountId:accountId,resolutionCanonical:'{}',snapshotCanonical:'{}',identityCanonical:'{}',identityHash:'0'.repeat(64),reservedUnits:0,settledUnits:0,uncertainUnits:0,overrun:false,cancelled:true,createdAt:now});
 const attemptId=await ctx.db.insert('runtimeModelAttempts',{operationDocumentId:operationId,childCallId:p+'native-id',ordinal:0,attemptNumber:1,canonical:'{}',hash:'0'.repeat(64),resolutionCanonical:'{}',snapshotCanonical:'{}',inputProofCanonical:'{}',measuredInputTokens:1,maximumOutputTokens:0,tenantAccountId:accountId,runAccountId:accountId,reservationUnits:1,state:'not_dispatched',dispatchIdentity:p+'native-id',slotReleased:true,outputVisible:false,toolInputVisible:false,toolResultVisible:false,toolEffectCommitted:false,resultWithheld:true,createdAt:now});
 await ctx.db.delete(attemptId);await ctx.db.delete(operationId);await ctx.db.delete(accountId);
 return {runtimeBudgetAccounts:accountId,runtimeModelOperations:operationId,runtimeModelAttempts:attemptId,transientCreated:3,transientDeleted:3,persistedRows:0};
}});
