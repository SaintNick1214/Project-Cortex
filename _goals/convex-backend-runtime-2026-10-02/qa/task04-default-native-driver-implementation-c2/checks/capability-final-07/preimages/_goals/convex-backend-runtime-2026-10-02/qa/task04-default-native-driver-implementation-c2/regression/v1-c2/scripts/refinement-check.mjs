import assert from 'node:assert/strict';
import * as guard from '../fixture/convex/guard.ts';
import {CASES,BINDING} from '../fixture/convex/compiled.ts';
import {canonical} from '../fixture/convex/canonical.ts';
/** Faithful single-row OCC snapshot/rollback/retry harness. NOT Convex native proof.
 * Registered handlers execute unchanged. Exceptions discard all transaction writes;
 * competing read versions retry the entire mutation before publication. */
class Harness {
  rows=[];version=0;conflicts=0; failBeforeCommit=false; loseResponse=false;
  async mutation(fn,args={}) {
    for(let retry=0;retry<32;retry++) {
      const version=this.version,snapshot=structuredClone(this.rows);let writes=false;
      const db={query:()=>({withIndex:(_name,callback)=>{let selected;callback({eq:(_key,value)=>{selected=value;return {};}});return {unique:async()=>{const rows=snapshot.filter(x=>x.key===selected);if(rows.length>1)throw Error('AMBIGUOUS');return structuredClone(rows[0]??null);}};}}),insert:async(_table,row)=>{writes=true;snapshot.push({...row,_id:'account-1'});return 'account-1';},replace:async(id,row)=>{writes=true;const i=snapshot.findIndex(x=>x._id===id);if(i<0)throw Error('MISSING');snapshot[i]={...row,_id:id};}};
      const result=await fn._handler({db},args);
      if(version!==this.version){this.conflicts++;continue;}
      if(this.failBeforeCommit){this.failBeforeCommit=false;throw Error('ROLLBACK_INJECTED');}
      if(writes){this.rows=snapshot;this.version++;}
      if(this.loseResponse){this.loseResponse=false;throw Error('COMMITTED_RESPONSE_LOST');}
      return result;
    }throw Error('OCC_RETRY_EXHAUSTED');
  }
  state(){return JSON.parse(this.rows[0].stateCanonical);}
  async setup(){await this.mutation(guard.provision);return this;}
  actionContext(principal=BINDING.principal){return {auth:{getUserIdentity:async()=>principal===null?null:{tokenIdentifier:principal}},runMutation:async(ref,args)=>{const name=String(ref[Symbol.for('functionName')]??'');return this.mutation(name.endsWith('reserveCheckpoint')?guard.reserveCheckpoint:name.endsWith('enterPeer')?guard.enterPeer:guard.capture,args);}};}
}
const receipts=[];
async function test(name,body){try{await body();receipts.push({name,status:'PASS'});}catch(error){receipts.push({name,status:'FAIL',error:String(error)});throw error;}}
const args=id=>({scenarioId:id,ownerRunId:BINDING.ownerRunId,principal:BINDING.principal});
const reserve=(h,id='C01')=>h.mutation(guard.reserveCheckpoint,args(id));
const observation=(c,id,changes={})=>({version:1,evidenceScope:'nonpaid-peer-offline',dispatchIdentity:id,nativeHash:c.normalizedNativeRequestHash,terminalId:'offline-terminal-'+c.scenarioId,lifetime:'qualified-terminal',money:'qualified-experiment-observation',microUSD:10,currency:'USD',category:'aggregate-inference',hypothesisValidated:true,resultHash:null,usageInput:c.inputU,usageOutput:0,...changes});
const capture=(h,id='C01',changes={})=>{const a=h.state().attempts.find(a=>a.scenarioId===id),c=CASES.find(c=>c.scenarioId===id);return h.mutation(guard.capture,{scenarioId:id,dispatchIdentity:a.dispatchIdentity,observationCanonical:canonical(observation(c,a.dispatchIdentity,changes))});};

await test('independent money/lifetime upgrades in either order; every historical exact replay has zero writes',async()=>{
 for(const order of ['money-first','life-first','atomic']){const h=await new Harness().setup();await reserve(h);const changes={lifetime:'unknown',money:'unknown',microUSD:null};await capture(h,'C01',changes);const initial=h.state().attempts[0].firstCapture;
 if(order==='money-first'){await capture(h,'C01',{lifetime:'unknown'});assert.equal(h.state().active,'C01');assert.equal(h.state().known,10);await capture(h,'C01',{money:'unknown',microUSD:null});}
 if(order==='life-first'){await capture(h,'C01',{money:'unknown',microUSD:null});assert.equal(h.state().reserved,29031);assert.equal(h.state().active,null);await capture(h,'C01',{lifetime:'unknown'});}
 if(order==='atomic')await capture(h);
 const state=h.state(),a=state.attempts[0];assert.equal(state.known,10);assert.equal(state.reserved,0);assert.equal(state.active,null);assert.equal(a.state,'terminal');assert.equal(a.refinements.length,order==='atomic'?1:2);assert.equal(a.attachment,'closed');
 for(const receipt of [initial,...a.refinements]){const version=h.version,before=canonical(h.state());await h.mutation(guard.capture,{scenarioId:'C01',dispatchIdentity:a.dispatchIdentity,observationCanonical:receipt});assert.equal(h.version,version);assert.equal(canonical(h.state()),before);}
 const before=canonical(h.state()),version=h.version;await assert.rejects(capture(h,'C01',{microUSD:11}),/COLLISION/);await assert.rejects(capture(h,'C01',{usageOutput:1}),/COLLISION/);assert.equal(h.version,version);assert.equal(canonical(h.state()),before);
 }
});
await test('facts supplied during upgrade cannot later change/remove; no fact-only receipt or terminal downgrade',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null,usageInput:null,resultHash:null});const resultHash='a'.repeat(64);await capture(h,'C01',{money:'unknown',microUSD:null,usageInput:1,resultHash});
 const before=canonical(h.state()),version=h.version;for(const changes of [{usageInput:2,resultHash},{usageInput:null,resultHash},{usageInput:1,resultHash:null},{usageInput:1,resultHash:'b'.repeat(64)},{usageInput:1,resultHash,terminalId:'changed'},{usageInput:1,resultHash,nativeHash:'b'.repeat(64)}])await assert.rejects(capture(h,'C01',changes),/COLLISION|CONFLICT/);assert.equal(h.version,version);assert.equal(canonical(h.state()),before);
 await capture(h,'C01',{lifetime:'unknown',usageInput:1,resultHash});assert.equal(h.state().attempts[0].state,'terminal');assert.equal(h.state().known,10);assert.equal(h.state().stopped,true);assert.equal(h.state().attempts[0].attachment,'closed');await assert.rejects(reserve(h,'C02'),/PERMIT_DENIED/);
});
await test('invalid proof STOP cannot be cleared; malformed lifetime never releases; closed controls/provision cannot renew',async()=>{
 for(const changes of [{currency:'credits'},{category:'cache-write'},{hypothesisValidated:false}]){const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{...changes,lifetime:'unknown',money:'unknown',microUSD:null});await capture(h,'C01',{...changes,money:'unknown',microUSD:null});assert.equal(h.state().active,null);assert.equal(h.state().known,0);assert.equal(h.state().reserved,29031);assert.equal(h.state().stopped,true);await assert.rejects(reserve(h,'C02'),/PERMIT_DENIED/);}
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null});await capture(h,'C01',{lifetime:'EOF',money:'unknown',microUSD:null});assert.equal(h.state().active,'C01');assert.equal(h.state().attempts[0].slotReleased,false);assert.equal(h.state().stopped,true);await capture(h,'C01',{money:'unknown',microUSD:null});assert.equal(h.state().active,null);assert.equal(h.state().stopped,true);await capture(h,'C01',{lifetime:'EOF',money:'unknown',microUSD:null});assert.equal(h.state().attempts[0].state,'terminal');assert.equal(h.state().attempts[0].slotReleased,true);
 for(const event of ['revoke','cancel','source_stale','profile_stale','proof_expired','window_retired']){const j=await new Harness().setup();await reserve(j);await capture(j,'C01',{lifetime:'unknown',money:'unknown',microUSD:null});await j.mutation(guard.control,{event});await capture(j,'C01',{money:'unknown',microUSD:null});await capture(j,'C01',{lifetime:'unknown'});await j.mutation(guard.provision);assert.equal(j.state().known,10);assert.equal(j.state().reserved,0);assert.equal(j.state().active,null);assert.equal(j.state().next,1);assert.equal(j.state().attempts[0].attachment,'closed');await assert.rejects(reserve(j,'C02'),/PERMIT_DENIED/);}
});
await test('simultaneous independent upgrades OCC-union once; incompatible upgrade rollback is atomic',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null});await Promise.all([capture(h,'C01',{lifetime:'unknown'}),capture(h,'C01',{money:'unknown',microUSD:null})]);assert.ok(h.conflicts>=1);assert.equal(h.state().known,10);assert.equal(h.state().active,null);assert.equal(h.state().attempts[0].refinements.length,2);
 const j=await new Harness().setup();await reserve(j);await capture(j,'C01',{lifetime:'unknown',money:'unknown',microUSD:null,usageInput:1});const before=canonical(j.state()),version=j.version;await assert.rejects(capture(j,'C01',{usageInput:2,microUSD:29032}),/COLLISION/);assert.equal(j.version,version);assert.equal(canonical(j.state()),before);
});
console.log(JSON.stringify({status:'PASS_OFFLINE_HANDLER_HARNESS_ONLY',tests:receipts.length,skipped:0,testsDetail:receipts,native:'NOT_RUN'}));
