import test from 'node:test';
import assert from 'node:assert/strict';
import {projectK18TraceMetadata} from './k18-latency-phase-projection.mjs';
const base={runId:'run:'+'a'.repeat(64),attemptNumber:1,at:1234};
for(const phase of ['start.claimNext.begin','start.claimNext.end','start.claimNext.failed']){
 test('retains exactly authorized static phase '+phase,()=>{
  const value={...base,phase,durationMs:4.75};
  assert.deepEqual(projectK18TraceMetadata(value),value);
 });
}
test('rejects unrelated uppercase and private-labelled phases without widening the original charset',()=>{
 for(const phase of ['start.claimNext.complete','start.claimNEXT.end','Start.claimNext.end','start.privateAlice.end','PRIVATE_PROMPT_PHASE','start.claimNext.end.privateUser','start.claimNext.end\nprivate']){
  assert.equal(projectK18TraceMetadata({...base,phase}),null);
 }
});
test('retains original lowercase phases and exact scalar field allowlist',()=>{
 const value={...base,phase:'admission.submit.end',runBudgetId:'b'.repeat(64),semanticId:'sha256:'+'c'.repeat(64),operationKey:'agent.respond',durationMs:0,bytes:64,status:200};
 assert.deepEqual(projectK18TraceMetadata({...value,prompt:'PRIVATE_PROMPT',apiKey:'PRIVATE_KEY',output:{text:'PRIVATE_OUTPUT'}}),value);
 assert.deepEqual(projectK18TraceMetadata({...base,phase:'lowercase-123.end'}),{...base,phase:'lowercase-123.end'});
 assert.notEqual(projectK18TraceMetadata({...base,phase:'a'.repeat(128)}),null);
 assert.equal(projectK18TraceMetadata({...base,phase:'a'.repeat(129)}),null);
});
test('missing or unusable duration remains omitted, never filled with zero',()=>{
 for(const durationMs of [undefined,Number.NaN,Infinity,-1,'4.75']){
  const value={...base,phase:'start.claimNext.end',durationMs};
  assert.deepEqual(projectK18TraceMetadata(value),{...base,phase:'start.claimNext.end'});
 }
});
test('original bounded run correlation and finite timestamp refusals remain intact',()=>{
 assert.equal(projectK18TraceMetadata({...base,phase:'start.claimNext.end',runId:'PRIVATE_CALLER_RUN'}),null);
 assert.equal(projectK18TraceMetadata({...base,phase:'admission.start.end',at:Infinity}),null);
 assert.equal(projectK18TraceMetadata(null),null);
});
