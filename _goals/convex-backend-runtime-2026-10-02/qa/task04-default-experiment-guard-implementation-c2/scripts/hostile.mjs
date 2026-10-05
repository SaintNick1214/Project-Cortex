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

const outcomes=[];
async function probe(name,body){try {outcomes.push({name,...await body()});}catch(e){outcomes.push({name,error:String(e)});}}
await probe('late genuine terminal with money still unknown must release slot independently',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null});
 let rejected=null;try{await capture(h,'C01',{lifetime:'qualified-terminal',money:'unknown',microUSD:null});}catch(e){rejected=String(e);}
 const s=h.state();assert.equal(s.reserved,29031);assert.equal(s.known,0);
 return {contractMet:s.active===null&&s.attempts[0].slotReleased,rejected,active:s.active,slotReleased:s.attempts[0].slotReleased};
});
await probe('known money then genuine terminal missing money should release once',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown'});let rejected=null;
 try{await capture(h,'C01',{money:'unknown',microUSD:null});}catch(e){rejected=String(e);}const s=h.state();assert.equal(s.known,10);
 return {contractMet:s.active===null,rejected,active:s.active,reserved:s.reserved,known:s.known};
});
await probe('usage evidence cannot conflict between first and refined receipt',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null,usageInput:1});let rejected=null;
 try{await capture(h,'C01',{usageInput:2});}catch(e){rejected=String(e);}return {contractMet:rejected!==null,rejected,refinements:h.state().attempts[0].refinements.length,known:h.state().known};
});
await probe('terminal refinement cannot accept unlimited new receipts',async()=>{
 const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{lifetime:'unknown',money:'unknown',microUSD:null,usageInput:1});await capture(h,'C01',{usageInput:1});let rejected=null;
 try{await capture(h,'C01',{usageInput:2});await capture(h,'C01',{usageInput:3});}catch(e){rejected=String(e);}return {contractMet:rejected!==null,rejected,refinements:h.state().attempts[0].refinements.length,slotReleased:h.state().attempts[0].slotReleased,known:h.state().known};
});
await probe('charge scope cannot become production evidence',async()=>{const h=await new Harness().setup();await reserve(h);await capture(h,'C01',{evidenceScope:'production'});assert.equal(h.state().known,0);assert.equal(h.state().stopped,true);return {contractMet:true};});
await probe('private query allowlist excludes attached values',async()=>{const h=await new Harness().setup();await reserve(h);const privateResultCanonical=canonical({text:'offline-private-canary'}),resultHash=await digest(privateResultCanonical);await capture(h,'C01',{resultHash});await h.mutation(guard.attach,{...args('C01'),dispatchIdentity:h.state().attempts[0].dispatchIdentity,privateResultCanonical});const view=await h.mutation(guard.inspect);assert.equal(JSON.stringify(view).includes('offline-private-canary'),false);return {contractMet:true};});
console.log(JSON.stringify({classification:'INDEPENDENT_HOSTILE_OUTCOMES_OFFLINE_ONLY',outcomes}));

assert.equal(outcomes.filter(x=>x.contractMet!==true).length,0,'Independent contract assertions failed');
