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

await test('late C01 terminal/money receipts cannot release or charge C02 active slot',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null});await capture(h,'C01',{money:'unknown',microUSD:null});await reserve(h,'C02');const active=h.state().active;assert.equal(active,'C02');await capture(h,'C01',{lifetime:'unknown'});assert.equal(h.state().active,'C02');assert.equal(h.state().known,10);assert.equal(h.state().reserved,29031);assert.equal(h.state().attempts[0].slotReleased,true);assert.equal(h.state().attempts[1].slotReleased,false);const version=h.version;for(const r of [h.state().attempts[0].firstCapture,...h.state().attempts[0].refinements])await h.mutation(guard.capture,{scenarioId:'C01',dispatchIdentity:h.state().attempts[0].dispatchIdentity,observationCanonical:r});assert.equal(h.version,version);assert.equal(h.state().active,'C02');
});
await test('numeric unqualified fact cannot be laundered by later lifetime/amount; zero is supplied money',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:17});await capture(h,'C01',{money:'unknown',microUSD:null});assert.equal(h.state().reserved,29031);const before=canonical(h.state()),version=h.version;await assert.rejects(capture(h,'C01',{lifetime:'unknown',microUSD:18}),/COLLISION/);assert.equal(h.version,version);assert.equal(canonical(h.state()),before);await capture(h,'C01',{lifetime:'unknown',microUSD:17});assert.equal(h.state().known,17);assert.equal(h.state().reserved,0);assert.equal(h.state().attempts[0].refinements.length,2);
 const z=await new Harness().setup();await reserve(z);await capture(z,'C01',{lifetime:'unknown',microUSD:0});assert.equal(z.state().known,0);assert.equal(z.state().attempts[0].known,0);assert.equal(z.state().reserved,0);await capture(z,'C01',{money:'unknown',microUSD:null});assert.equal(z.state().active,null);assert.equal(z.state().attempts[0].known,0);const v=z.version;await assert.rejects(capture(z,'C01',{microUSD:1}),/COLLISION/);assert.equal(z.version,v);
});
await test('every immutable refinement field collision is transactionally read-only',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null,usageInput:1,usageOutput:0,resultHash:'a'.repeat(64)});const before=canonical(h.state()),version=h.version;
 for(const changes of [{dispatchIdentity:'other'},{nativeHash:'b'.repeat(64)},{terminalId:'other'},{currency:'EUR'},{category:'cache-write'},{hypothesisValidated:false},{usageInput:2},{usageInput:null},{usageOutput:1},{usageOutput:null},{resultHash:null},{resultHash:'b'.repeat(64)}]){
   await assert.rejects(capture(h,'C01',{usageInput:1,usageOutput:0,resultHash:'a'.repeat(64),...changes}),/CONFLICT|COLLISION/);assert.equal(h.version,version);assert.equal(canonical(h.state()),before);
 }
 await capture(h,'C01',{usageInput:1,usageOutput:0,resultHash:'a'.repeat(64)});const terminal=canonical(h.state()),v=h.version;await assert.rejects(capture(h,'C01',{usageInput:1,usageOutput:0,resultHash:'a'.repeat(64),lifetime:'unknown',money:'unknown',microUSD:null}),/COLLISION/);assert.equal(h.version,v);assert.equal(canonical(h.state()),terminal);
});
await test('late full overrun captures original account and preserves stopped retired private authority',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null});await h.mutation(guard.control,{event:'window_retired'});await capture(h,'C01',{money:'unknown',microUSD:null});await capture(h,'C01',{lifetime:'unknown',microUSD:29032});const s=h.state();assert.equal(s.known,29032);assert.equal(s.reserved,0);assert.equal(s.overrun,true);assert.equal(s.stopped,true);assert.equal(s.active,null);assert.equal(s.attempts[0].attachment,'closed');assert.equal(s.attempts[0].privateCanonical,null);await assert.rejects(reserve(h,'C02'),/PERMIT_DENIED/);await h.mutation(guard.provision);assert.equal(h.state().known,29032);assert.equal(h.state().next,1);
});
await test('simultaneous combined and independent capture publishes compatible one settlement without extra receipt authority',async()=>{
 for(const pair of [[{},{}],[{}, {lifetime:'unknown'}],[{}, {money:'unknown',microUSD:null}]]){const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null});const out=await Promise.allSettled(pair.map(x=>capture(h,'C01',x)));assert.ok(h.conflicts>=1);assert.ok(out.some(x=>x.status==='fulfilled'));for(const x of out)if(x.status==='rejected')assert.match(String(x.reason),/COLLISION/);assert.equal(h.state().known,10);assert.equal(h.state().reserved,0);assert.equal(h.state().active,null);assert.ok(h.state().attempts[0].refinements.length<=2);const v=h.version;for(const r of [h.state().attempts[0].firstCapture,...h.state().attempts[0].refinements])await h.mutation(guard.capture,{scenarioId:'C01',dispatchIdentity:h.state().attempts[0].dispatchIdentity,observationCanonical:r});assert.equal(h.version,v);}
});
console.log(JSON.stringify({status:'PASS_OFFLINE_INDEPENDENT_ONLY',tests:receipts.length,skipped:0,testsDetail:receipts,native:'NOT_RUN'}));
