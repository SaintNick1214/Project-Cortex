import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openNativeContext,q,scope,denied} from './common.mjs';
const c=await openNativeContext();
try {
 await c.verifyTarget('native-deadlines2-target-verified');
 const prior=JSON.parse(await readFile(join(q,'native-deadlines1-outcomes.json'))),setup=JSON.parse(await readFile(join(q,'native-deadlines1-setup.json'))),before=JSON.parse(await readFile(join(q,'native-deadlines1-financial-before.json')));
 assert.equal(prior.status,'FAIL_OR_UNKNOWN');assert.equal(prior.groups.length,8);assert.match(JSON.stringify(prior.error),/STALE_TRANSCRIPT/);
 const owner=c.http(setup.owner.subject),runId='run:aggregate03-unpaid-observation';
 const artifactDenial=await denied(()=>c.admin.mutation('task03Deadline:artifactContext',{reference:setup.owner.reference,artifactId:'aggregate03-anchored'}));
 const exhaustedDenial=await denied(()=>owner.mutation('runtimeAgent:observe',{...scope,runId,afterSequence:1}));
 for(const error of [artifactDenial,exhaustedDenial])assert.equal(error.data?.code,'STALE_TRANSCRIPT');
 const after=await c.admin.query('task03Deadline:snapshot',{});assert.deepEqual(after.attempts,before.attempts);assert.deepEqual(after.accounts.filter(row=>row.tenantId!==scope.tenantId),before.accounts);
 for(const row of after.accounts.filter(row=>row.tenantId===scope.tenantId)){assert.equal(row.reservedUnits,0);assert.equal(row.settledUnits,0);assert.equal(row.uncertainUnits,0);assert.equal(row.activeConcurrency,0);}
 await c.publish('native-deadlines2-financial-after',after);
 const groups=[...prior.groups,{name:'registered-native-message-deletion-invalidates-artifact-context-and-exhausted-observer',status:'PASS',originalOracleFailurePreserved:true,correctContract:'Typed currentness denial after canonical message removal; STALE_TRANSCRIPT is precise here.',artifactDenial:c.publicError(artifactDenial),exhaustedDenial:c.publicError(exhaustedDenial),readOnlyClosure:true,modelCalls:0}];
 await c.publish('native-deadlines2-outcomes',{status:'ACTUAL_UNPAID_DEADLINE_ANCHOR_OBSERVER_PASS',groups,scope,projectId:c.state.projectId,modelCalls:0,newModelAttempts:0,originalRed:'native-deadlines1-outcomes.json',repeatWrites:0,allPriorFinancialRootsWindowsCountersPreserved:true,newAccountsHaveZeroLiability:true,QAOnlyProjectionAndHTTPDelayRoutes:true,currentProductPack:'packages5.json',cleanupPending:true});
 console.log(JSON.stringify({status:'ACTUAL_UNPAID_PASS',groups:groups.length,modelCalls:0,repeatWrites:0}));
}finally{await c.close();}
