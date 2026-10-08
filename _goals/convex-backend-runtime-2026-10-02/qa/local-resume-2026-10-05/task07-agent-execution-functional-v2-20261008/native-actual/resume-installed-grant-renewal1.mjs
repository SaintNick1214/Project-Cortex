import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openOwnedContext, denied } from './common-installed.mjs';
const c=await openOwnedContext(), scope={memorySpaceId:c.memorySpaceId}, records=[];
const prior=JSON.parse(await readFile(new URL('./installed-fence2-grant-renewal-calls.json',import.meta.url)));
const attempt=prior.records.find(row=>row.label==='native-claim').result;
const renewed=prior.records.find(row=>row.label==='renew-real-current-grant').result;
const selector={...scope,runId:attempt.runId};
const snapshot=()=>c.admin.query('agentQualification:state',{tenantId:c.tenantId,...selector});
const budgets=()=>c.admin.query('agentFenceQualification:budgets',{tenantId:c.tenantId,...selector});
async function call(label,kind,name,args,client=c.owner){try{const result=await client[kind](name,args);records.push({label,function:name,status:'PASS',result});return result;}
 catch(error){records.push({label,function:name,status:'FAIL',error:c.publicError(error)});throw error;}
 finally{await c.publish('installed-grant-renewal-resume1-calls',{operation:prior.operation,records});}}
try{
 await c.verifyTarget('installed-grant-renewal-resume1-target-verified');
 const current=await c.owner.query('agentQualification:reference',scope);
 assert.equal(current.grantId,renewed.grantId);assert.equal(current.grantVersion,renewed.grantVersion);
 assert.notEqual(current.grantId,attempt.reference.grantId);assert.ok(current.grantVersion>attempt.reference.grantVersion);
 for(const key of ['principalId','tenantId','memorySpaceId','membershipId'])assert.equal(current[key],attempt.reference[key]);
 const before=await snapshot(),budgetBefore=await budgets();assert.equal(before.modelAttempts.length,0);
 const priorLiability=JSON.parse(await readFile(new URL('./installed-fence2-definition-revoke-outcome.json',import.meta.url))).budgetAfter;
 for(const account of priorLiability.tenants){const actual=budgetBefore.tenants.find(row=>row._id===account._id);assert.ok(actual);
  for(const key of ['reservedUnits','uncertainUnits','settledUnits'])assert.equal(actual[key],account[key]);}
 const safeRead=await call('safe-replacement-grant-get','query','runs:get',selector);assert.equal(safeRead.responseStatus,'running');
 const foreignDenial=await denied(()=>c.foreign.mutation('runtimeAgent:cancel',selector));
 const cancelled=await call('safe-replacement-grant-cancel','mutation','runtimeAgent:cancel',selector);assert.equal(cancelled.cancelled,true);
 const output=await call('safe-replacement-grant-observe','query','runtimeAgent:observe',selector);assert.equal(output.state,'cancelled');
 const first=await call('old-captured-grant-model-denial','action','agentFenceQualification:attemptModel',{...attempt,ordinal:0},c.admin);
 const second=await call('repeat-old-captured-grant-denial','action','agentFenceQualification:attemptModel',{...attempt,ordinal:0},c.admin);
 for(const result of [first,second]){assert.equal(result.denied,true);assert.equal(result.error.data?.code,'FORBIDDEN');}
 const after=await snapshot(),budgetAfter=await budgets();
 assert.equal(after.modelAttempts.length,0);assert.equal(after.operations.length,0);assert.equal(after.ingestion.length,0);
 assert.equal(after.native.filter(row=>row.role==='assistant').length,0);
 assert.equal(budgetAfter.run.cancelled,true);assert.equal(budgetAfter.run.activeConcurrency,0);
 assert.deepEqual(budgetAfter.run.reference,budgetBefore.run.reference);
 for(const key of ['reservedUnits','uncertainUnits','settledUnits'])assert.equal(budgetAfter.run[key],budgetBefore.run[key]);
 for(const account of budgetBefore.tenants){const actual=budgetAfter.tenants.find(row=>row._id===account._id);assert.ok(actual);
  for(const key of ['reservedUnits','uncertainUnits','settledUnits','activeConcurrency'])assert.equal(actual[key],account[key]);}
 await c.publish('installed-grant-renewal-resume1-outcome',{status:'PASS',operation:prior.operation,scenario:'replacement-grant-renewal',
  priorStoppedOracle:'installed-grant-renewal-command1.stderr.log',sameAdmittedRun:true,noReprovision:true,
  attempt,current,renewed,before,budgetBefore,safeRead,cancelled,output,foreignDenial:c.publicError(foreignDenial),first,second,after,budgetAfter,
  capturedBudgetUnchanged:true,fullTenantLiabilityUnchanged:true,noPaidDispatch:true,sourceCandidate:'installed-final5-source-manifest.json'});
}finally{await c.close();await c.publish('installed-grant-renewal-resume1-client-cleanup',{ownedClientsClosed:true});}
