import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as guard from '../fixture/convex/guard.ts';
import {buildRunner,run,Lifecycle} from '../fixture/convex/runner.ts';
import {CASES,ORDER,BINDING,PROFILE} from '../fixture/convex/compiled.ts';
import {canonical,parseCanonical,digest} from '../fixture/convex/canonical.ts';
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
await test('compiled immutable initial14 identity/order/U/M/K equals approved exact manifest',async()=>{
 const m=JSON.parse(readFileSync(new URL('../initial14-manifest.json',import.meta.url)));assert.deepEqual([...ORDER],m.executionOrder);assert.equal(CASES.length,14);assert.equal(new Set(CASES.map(c=>c.normalizedNativeRequestHash)).size,13);for(const c of CASES){const original=m.expectedCalls.find(x=>x.scenarioId===c.scenarioId);for(const key of Object.keys(c))assert.deepEqual(c[key],original[key]);}assert.equal(CASES.reduce((s,c)=>s+c.candidateReservationKMicroUSD,0),314310);assert.throws(()=>{CASES[0].inputU=999;},TypeError);assert.throws(()=>{ORDER.reverse();},TypeError);assert.throws(()=>{PROFILE.dimensions=1;},TypeError);
});
await test('registered Convex exports internal controls; published runner fail closed without reserve',async()=>{
 for(const name of ['provision','reserveCheckpoint','enterPeer','control','capture','attach'])assert.equal(guard[name].isInternal,true);assert.equal(guard.inspect.isInternal,true);const h=await new Harness().setup();const before=canonical(h.state());await assert.rejects(run._handler(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId}),/NOT_IMPLEMENTED/);assert.equal(canonical(h.state()),before);
});
await test('fourteen once-only serial closures; fifteenth and unknown ID denied; same native hash independent semantic permits',async()=>{
 const h=await new Harness().setup();let closures=0;const runner=buildRunner(async(c,id)=>{closures++;return observation(c,id);});
 for(const id of ORDER){await runner(h.actionContext(),{scenarioId:id,ownerRunId:BINDING.ownerRunId});await runner(h.actionContext(),{scenarioId:id,ownerRunId:BINDING.ownerRunId});}assert.equal(closures,14);assert.equal(h.state().known,140);assert.equal(h.state().reserved,0);assert.equal(h.state().active,null);assert.equal(h.state().next,14);assert.equal(h.state().attempts.length,14);await assert.rejects(runner(h.actionContext(),{scenarioId:'C15',ownerRunId:BINDING.ownerRunId}),/NO_PERMIT/);assert.equal(closures,14);assert.notEqual(h.state().attempts[8].dispatchIdentity,h.state().attempts[11].dispatchIdentity);
});
await test('OCC simultaneous duplicate reserve retries then grants exactly one dispatch ticket',async()=>{
 const h=await new Harness().setup();const out=await Promise.all([reserve(h),reserve(h)]);assert.equal(out.filter(x=>x.dispatch).length,1);assert.ok(h.conflicts>=1);assert.equal(h.state().reserved,29031);assert.equal(h.state().next,1);assert.equal(h.state().attempts.length,1);
});
await test('simultaneous runner race executes one selected peer closure',async()=>{
 const h=await new Harness().setup();let n=0;const runner=buildRunner(async(c,id)=>{n++;return observation(c,id);});await Promise.all([runner(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId}),runner(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId})]);assert.equal(n,1);assert.equal(h.state().known,10);assert.equal(h.state().reserved,0);
});
await test('reserve transaction rollback prevents peer closure; persisted retry then succeeds once',async()=>{
 const h=await new Harness().setup();let n=0;const runner=buildRunner(async(c,id)=>{n++;return observation(c,id);});h.failBeforeCommit=true;await assert.rejects(runner(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId}),/ROLLBACK/);assert.equal(n,0);assert.equal(h.state().next,0);assert.equal(h.state().reserved,0);await runner(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId});assert.equal(n,1);
});
await test('checkpoint committed response loss forbids retry closure and retains full active uncertainty',async()=>{
 const h=await new Harness().setup();let n=0;const runner=buildRunner(async(c,id)=>{n++;return observation(c,id);});h.loseResponse=true;await assert.rejects(runner(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId}),/RESPONSE_LOST/);await runner(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId});assert.equal(n,0);assert.equal(h.state().reserved,29031);assert.equal(h.state().active,'C01');assert.equal(h.state().attempts[0].checkpoint,true);await assert.rejects(reserve(h,'C02'),/PERMIT_DENIED/);
});
await test('capture rollback and lost response recover by persistence-only retry, charge once',async()=>{
 const h=await new Harness().setup();await reserve(h);h.failBeforeCommit=true;await assert.rejects(capture(h),/ROLLBACK/);assert.equal(h.state().known,0);assert.equal(h.state().reserved,29031);h.loseResponse=true;await assert.rejects(capture(h),/RESPONSE_LOST/);const first=h.state().attempts[0].firstCapture;await capture(h);assert.equal(h.state().known,10);assert.equal(h.state().reserved,0);assert.equal(h.state().attempts[0].firstCapture,first);assert.equal(h.state().attempts[0].slotReleased,true);
});
await test('ambiguous lifetime retains full reservation and active slot; qualified terminal unknown money releases slot once',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null});assert.equal(h.state().reserved,29031);assert.equal(h.state().active,'C01');await assert.rejects(reserve(h,'C02'),/PERMIT_DENIED/);
 const j=await new Harness().setup();await reserve(j);await capture(j,'C01',{money:'unknown',microUSD:null});assert.equal(j.state().active,null);assert.equal(j.state().reserved,29031);await capture(j,'C01',{money:'unknown',microUSD:null});await reserve(j,'C02');assert.equal(j.state().reserved,58062);
});
await test('qualified known charge with unknown lifetime retains active slot then late terminal releases once without second charge',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown'});assert.equal(h.state().known,10);assert.equal(h.state().reserved,0);assert.equal(h.state().active,'C01');await capture(h);await capture(h);assert.equal(h.state().known,10);assert.equal(h.state().active,null);assert.equal(h.state().attempts[0].slotReleased,true);
});
await test('late known full charge survives revoke/cancel/original window retirement; first evidence immutable and closed attachment never reopens',async()=>{
 for(const event of ['revoke','cancel','window_retired','source_stale']){const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{money:'unknown',microUSD:null});const first=h.state().attempts[0].firstCapture;await h.mutation(guard.control,{event});await capture(h);await capture(h);assert.equal(h.state().known,10);assert.equal(h.state().reserved,0);assert.equal(h.state().attempts[0].firstCapture,first);assert.equal(h.state().attempts[0].attachment,'closed');assert.equal(h.state().attempts[0].refinements.length,1);await assert.rejects(reserve(h,'C02'),/PERMIT_DENIED/);await h.mutation(guard.provision);assert.equal(h.state().known,10);assert.equal(h.state().next,1);}
});
await test('monetary overrun above K retained in full and stops serial next; usage overrun stops and retains full known',async()=>{
 for(const changes of [{microUSD:29032},{usageInput:31},{usageOutput:17}]){const h=await new Harness().setup();await reserve(h);await capture(h,'C01',changes);assert.equal(h.state().known,changes.microUSD??10);assert.equal(h.state().reserved,0);assert.equal(h.state().stopped,true);assert.equal(h.state().attempts[0].attachment,'closed');await assert.rejects(reserve(h,'C02'),/PERMIT_DENIED/);}
});
await test('unqualified money retains full K and stops next; genuine terminal releases slot independently; malformed lifetime retains active',async()=>{
 for(const changes of [{hypothesisValidated:false},{currency:'credits'},{category:'cache-write'},{microUSD:-1}]){const h=await new Harness().setup();await reserve(h);await capture(h,'C01',changes);assert.equal(h.state().known,0);assert.equal(h.state().reserved,29031);assert.equal(h.state().active,changes.microUSD===-1?'C01':null);assert.equal(h.state().attempts[0].slotReleased,changes.microUSD!==-1);assert.equal(h.state().stopped,true);await assert.rejects(reserve(h,'C02'),/PERMIT_DENIED/);}
});
await test('immutable dispatch and capture collisions rollback instead of overwrite or double charge',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h);const before=canonical(h.state());for(const changes of [{nativeHash:'0'.repeat(64)},{dispatchIdentity:'wrong'},{terminalId:'other'},{microUSD:20}])await assert.rejects(capture(h,'C01',changes),/CONFLICT|COLLISION/);assert.equal(canonical(h.state()),before);
});
await test('currentness source/profile/proof/grant/cancel denies before closure; no new owner-run laundering',async()=>{
 for(const event of ['revoke','cancel','source_stale','profile_stale','proof_expired','window_retired']){const h=await new Harness().setup();await h.mutation(guard.control,{event});await assert.rejects(reserve(h),/PERMIT_DENIED/);assert.equal(h.state().reserved,0);await h.mutation(guard.provision);await assert.rejects(reserve(h),/PERMIT_DENIED/);}
 const h=await new Harness().setup();await assert.rejects(h.mutation(guard.reserveCheckpoint,{...args('C01'),ownerRunId:'new'}),/FORBIDDEN/);assert.equal(h.state().next,0);
});
await test('authenticated exact public shape rejects caller prompt/model/options/price/tool/profile and getters without closure or getter side effects',async()=>{
 const h=await new Harness().setup();let n=0,getters=0;const runner=buildRunner(async(c,id)=>{n++;return observation(c,id);});for(const extra of ['prompt','modelId','providerOptions','headers','tools','schema','price','profile','dimensions','values'])await assert.rejects(runner(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId,[extra]:{}}),/SHAPE/);const hostile={ownerRunId:BINDING.ownerRunId};Object.defineProperty(hostile,'scenarioId',{enumerable:true,get(){getters++;return 'C01';}});await assert.rejects(runner(h.actionContext(),hostile),/OWN_DATA/);await assert.rejects(runner(h.actionContext(null),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId}),/FORBIDDEN/);await assert.rejects(runner(h.actionContext('wrong'),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId}),/FORBIDDEN/);assert.equal(getters,0);assert.equal(n,0);assert.equal(h.state().next,0);
});
await test('revocation after checkpoint before selected dispatch fence invokes zero peer closure',async()=>{
 const h=await new Harness().setup();let n=0;const ctx=h.actionContext();const original=ctx.runMutation;ctx.runMutation=async(ref,args)=>{const result=await original(ref,args);if(String(ref[Symbol.for('functionName')]??'').endsWith('reserveCheckpoint'))await h.mutation(guard.control,{event:'revoke'});return result;};const runner=buildRunner(async(c,id)=>{n++;return observation(c,id);});await runner(ctx,{scenarioId:'C01',ownerRunId:BINDING.ownerRunId});assert.equal(n,0);assert.equal(h.state().reserved,29031);assert.equal(h.state().active,'C01');assert.equal(h.state().attempts[0].state,'unknown');
});
await test('canonical rejects ill Unicode/accessor nested graph/sparse/symbol/prototype/cycle/noncanonical/limits before traversal',async()=>{
 let n=0;const getter={};Object.defineProperty(getter,'danger',{enumerable:true,get(){n++;return 1;}});const cycle={};cycle.self=cycle;for(const value of ['\ud800',{nested:getter},new Array(2),{[Symbol('a')]:1},new Date(),cycle,{n:-0},{n:Infinity}])assert.throws(()=>canonical(value));assert.equal(n,0);assert.throws(()=>canonical({text:'x'.repeat(200)},32),/BYTE_LIMIT/);assert.throws(()=>parseCanonical('{"b":1,"a":2}'),/NONCANONICAL/);assert.throws(()=>parseCanonical('{"a":1,"a":1}'),/NONCANONICAL/);assert.equal(parseCanonical(canonical({text:'😀'})).text,'😀');
});
await test('capture first then attach exact private text; revoke clears attached result; unauthorized and mismatched hashes do not attach',async()=>{
 const h=await new Harness().setup();await reserve(h);const text=canonical({text:'offline-peer'}),resultHash=await digest(text);await capture(h,'C01',{resultHash});const a=h.state().attempts[0];await assert.rejects(h.mutation(guard.attach,{...args('C01'),principal:'wrong',dispatchIdentity:a.dispatchIdentity,privateResultCanonical:text}),/FORBIDDEN/);await assert.rejects(h.mutation(guard.attach,{...args('C01'),dispatchIdentity:a.dispatchIdentity,privateResultCanonical:canonical({text:'different'})}),/RESULT_COLLISION/);assert.equal((await h.mutation(guard.attach,{...args('C01'),dispatchIdentity:a.dispatchIdentity,privateResultCanonical:text})).attached,true);await h.mutation(guard.control,{event:'revoke'});assert.equal(h.state().attempts[0].privateCanonical,null);assert.equal((await h.mutation(guard.attach,{...args('C01'),dispatchIdentity:a.dispatchIdentity,privateResultCanonical:text})).attached,false);
});
await test('embedding exact profile/1536 finite and bytes: profile change dimensions/nonfinite fail; stale source never hydrates',async()=>{
 const h=await new Harness().setup();for(const id of ORDER.slice(0,8)){await reserve(h,id);await capture(h,id);}await reserve(h,'E11');const result=canonical({profile:PROFILE,vector:Array(1536).fill(0)}),resultHash=await digest(result);await capture(h,'E11',{resultHash});const a=h.state().attempts[8];for(const value of [{profile:{...PROFILE,dimensions:1535},vector:Array(1536).fill(0)},{profile:PROFILE,vector:[0]}])await assert.rejects(h.mutation(guard.attach,{...args('E11'),dispatchIdentity:a.dispatchIdentity,privateResultCanonical:canonical(value)}),/RESULT_PROFILE/);assert.equal((await h.mutation(guard.attach,{...args('E11'),dispatchIdentity:a.dispatchIdentity,privateResultCanonical:result})).attached,true);await h.mutation(guard.control,{event:'source_stale'});assert.equal(h.state().attempts[8].privateCanonical,null);assert.equal((await h.mutation(guard.attach,{...args('E11'),dispatchIdentity:a.dispatchIdentity,privateResultCanonical:result})).attached,false);
});
await test('owned pending peer deadline retains slot; late handlers capture one full charge and settle without replay',async()=>{
 const h=await new Harness().setup();let release,n=0;const waiting=new Promise(resolve=>{release=resolve;});const runner=buildRunner(async(c,id)=>{n++;await waiting;return observation(c,id);},{entry:5,peer:5,persistence:5,cleanup:5});await assert.rejects(runner(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId}),/DEADLINE_UNKNOWN/);assert.equal(h.state().reserved,29031);assert.equal(h.state().active,'C01');assert.equal(n,1);release();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(h.state().known,10);assert.equal(h.state().active,null);await runner(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId});assert.equal(n,1);
});
await test('action entry reservation deadline owns late committed checkpoint without entering peer or replay',async()=>{
 const h=await new Harness().setup();let release,n=0;const waiting=new Promise(resolve=>{release=resolve;});const ctx=h.actionContext(),original=ctx.runMutation;ctx.runMutation=async(ref,args)=>{const result=await original(ref,args);if(String(ref[Symbol.for('functionName')]??'').endsWith('reserveCheckpoint'))await waiting;return result;};const runner=buildRunner(async(c,id)=>{n++;return observation(c,id);},{entry:2,peer:5,persistence:5,cleanup:2});await assert.rejects(runner(ctx,{scenarioId:'C01',ownerRunId:BINDING.ownerRunId}),/DEADLINE_UNKNOWN/);assert.equal(h.state().reserved,29031);assert.equal(h.state().active,'C01');release();await new Promise(resolve=>setTimeout(resolve,10));await runner(h.actionContext(),{scenarioId:'C01',ownerRunId:BINDING.ownerRunId});assert.equal(n,0);assert.equal(h.state().attempts[0].state,'dispatch_pending');
});
await test('lifecycle exposes pending and late errors consume handlers without declaring terminal',async()=>{
 const life=new Lifecycle();let reject;const pending=life.track(new Promise((_,r)=>{reject=r;}));pending.catch(()=>{});const status=await life.complete(2);assert.equal(status.pending,1);assert.equal(status.timedOut,true);reject(Error('late'));await Promise.allSettled([pending]);assert.equal(life.pending,0);
});
console.log(JSON.stringify({status:'PASS_OFFLINE_HANDLER_HARNESS_ONLY',tests:receipts.length,skipped:0,testsDetail:receipts,native:'NOT_RUN',officialDriver:'NOT_IMPLEMENTED',targetProfile:'NOT_IMPLEMENTED',paid:'NOT_RUN',managedSearch:'NOT_RUN'}));
