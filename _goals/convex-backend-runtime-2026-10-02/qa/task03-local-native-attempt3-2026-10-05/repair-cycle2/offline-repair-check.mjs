import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeCleanup,executeDriver } from './offline-injection-harness.mjs';
const q=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cleanupSource=readFileSync(resolve(q,'scripts/cleanup.mjs'),'utf8'),driverSource=readFileSync(resolve(q,'scripts/driver.mjs'),'utf8');
const policy=['runtimeModelPolicies','runtimeModelQualifications','runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts'].map(table=>({table,count:0}));
const results=[];
for(const [name,scenario,pass] of [
 ['all-owned-and-policy-clean',{},true],
 ['policy-check-throws',{policyThrows:true},false],
 ['policy-nonempty',{policy:policy.map((row,index)=>index===2?{...row,count:1}:row)},false],
 ['policy-duplicate-table',{policy:Array(5).fill(policy[0])},false],
 ['policy-missing-table',{policy:policy.slice(0,4)},false],
 ['policy-malformed-result',{policy:{}},false],
 ['owned-rows-remain',{rowsRemain:true},false],
 ['owned-row-cleanup-throws',{rowsCleanupThrows:true},false],
 ['owned-row-snapshot-throws',{rowsSnapshotThrows:true},false],
 ['storage-cleanup-throws',{storageThrows:true},false],
 ['storage-absence-check-throws',{storageVerificationThrows:true},false],
 ['storage-not-proven-absent',{storageRemains:true},false]
]){
 const observed=await executeCleanup(cleanupSource,scenario);assert.equal(observed.exitCode,pass?0:1,name);assert.deepEqual(observed.output,{status:pass?'PASS':'FAIL',cleanupComplete:pass},name);assert.equal(observed.receipts[0].status,observed.output.status);assert.equal(observed.receipts[0].cleanupComplete,pass);if(!pass)assert.ok(observed.rpc.every(row=>!row.path.includes('deletePolicy')));results.push({name,kind:'actual-cleanup-source',status:'PASS',expectedSuccessfulCleanup:pass,observed});
}
const recoveryBase={code:0,timedOut:false,overflow:false,stderr:'',stdout:JSON.stringify({status:'PASS',cleanupComplete:true})};
for(const [name,clean,expected] of [
 ['clean-recovery-success',recoveryBase,1],
 ['contradictory-zero-exit-fail',{...recoveryBase,stdout:JSON.stringify({status:'FAIL',cleanupComplete:true})},0],
 ['zero-exit-cleanup-false',{...recoveryBase,stdout:JSON.stringify({status:'PASS',cleanupComplete:false})},0],
 ['zero-exit-malformed-json',{...recoveryBase,stdout:'not json'},0],
 ['zero-exit-null-json',{...recoveryBase,stdout:'null'},0],
 ['zero-exit-array-json',{...recoveryBase,stdout:'[]'},0],
 ['zero-exit-string-true',{...recoveryBase,stdout:JSON.stringify({status:'PASS',cleanupComplete:'true'})},0],
 ['nonzero-pass-output',{...recoveryBase,code:1},0],
 ['signaled-zero-exit-pass-output',{...recoveryBase,signal:'SIGTERM'},0],
 ['timed-out-pass-output',{...recoveryBase,timedOut:true},0],
 ['overflow-pass-output',{...recoveryBase,overflow:true},0]
]){
 const observed=await executeDriver(driverSource,{clean});assert.equal(observed.receipts[0].counts.cleanupRecoveryVerified,expected,name);assert.equal(observed.output.status,'FAIL',name);assert.equal(observed.output.cleanupComplete,false);assert.equal(observed.exitCode,1,'Failed original qualification cannot become PASS');results.push({name,kind:'actual-driver-source-recovery',status:'PASS',expectedRecoveryVerified:expected,observed});
}
for(const [name,scenario] of [['nonterminal-owned-group',{nonterminal:true}],['terminal-reap-throws',{reapThrows:true}]]){const observed=await executeDriver(driverSource,scenario);assert.equal(observed.receipts[0].counts.cleanupRecoveryVerified,0);assert.equal(observed.output.status,'FAIL');assert.equal(observed.exitCode,1);results.push({name,kind:'actual-driver-source-terminal-fence',status:'PASS',observed});}
for(const [name,qualify,expected] of [
 ['healthy-qualification',{...recoveryBase,stdout:JSON.stringify({status:'PASS',cleanupComplete:true,counts:{failed:0}})},'PASS'],
 ['contradictory-qualification-zero-exit',{...recoveryBase,stdout:JSON.stringify({status:'FAIL',cleanupComplete:true})},'FAIL'],
 ['malformed-qualification-zero-exit',{...recoveryBase,stdout:'invalid json'},'FAIL']
]){const observed=await executeDriver(driverSource,{qualify});assert.equal(observed.output.status,expected);assert.equal(observed.exitCode,expected==='PASS'?0:1);assert.equal(observed.output.cleanupComplete,expected==='PASS');results.push({name,kind:'actual-driver-source-qualification-consistency',status:'PASS',observed});}
console.log(JSON.stringify({phase:'CYCLE2_ACTUAL_SOURCE_OFFLINE_FAULT_INJECTIONS',status:'PASS',actualSourceSha256:{cleanup:createHash('sha256').update(cleanupSource).digest('hex'),driver:createHash('sha256').update(driverSource).digest('hex')},cases:results.length,cleanupCases:12,recoveryConsistencyCases:11,terminalCases:2,qualificationConsistencyCases:3,serviceCalls:0,externalEffects:0,privateFilesRead:false,results}));
