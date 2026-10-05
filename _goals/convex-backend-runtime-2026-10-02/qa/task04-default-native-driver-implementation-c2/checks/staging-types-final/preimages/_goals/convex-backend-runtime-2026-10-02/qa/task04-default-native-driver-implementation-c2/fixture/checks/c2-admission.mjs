import assert from 'node:assert/strict';
import {h as prefix} from './independent-prefix.mjs';
import {Harness} from './harness.mjs';
import {OWNER_RUN_ID} from '../convex/installed.ts';
import * as runner from '../../fixture-vm/convex/runner.ts';
import * as lifecycle from '../../fixture-vm/convex/lifecycle.ts';
import {setParts} from '../../fixture-vm/convex/dummy-port.mjs';
const state=prefix.state();state.attempts.pop();state.next--;state.active=null;state.reserved=0;prefix.setState(state);const base=structuredClone(prefix.rows);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));const unhandled=[];process.on('unhandledRejection',e=>unhandled.push(String(e)));const outcomes=[];
const parts=[{type:'raw',rawValue:{id:'DUMMY',model:'openai/gpt-4o-mini',choices:[{index:0,delta:{content:'first'},finish_reason:null}]}},{type:'text-start',id:'DUMMY'},{type:'text-delta',id:'DUMMY',delta:'first'}];
for(const mode of ['sign-crosses-expiry','sign-late-rejection','admitted-late-success','admitted-late-failure']){
 const h=new Harness();h.rows=structuredClone(base);h.controls=prefix.controls;setParts(parts);const action=h.action(),original=action.runMutation;let stages=0,inspects=0,signs=0;
 action.runMutation=async(ref,args)=>{if(ref[Symbol.for('functionName')].endsWith('stageAndTrigger')){stages++;const committed=await h.mutation(lifecycle.stageAndTrigger,args);await wait(1100);if(mode==='admitted-late-failure')throw Error('DUMMY_LATE_RPC_ERROR');return committed}return original(ref,args)};
 const query=action.runQuery;action.runQuery=async(ref,args)=>{if(ref[Symbol.for('functionName')].endsWith('inspectTrigger'))inspects++;return query(ref,args)};
 const originalSign=crypto.subtle.sign.bind(crypto.subtle);
 if(mode.startsWith('sign-'))crypto.subtle.sign=async(...args)=>{signs++;if(signs===2){await wait(1100);if(mode==='sign-late-rejection')throw Error('DUMMY_LATE_PREPARATION_ERROR')}return originalSign(...args)};
 const start=Date.now();let result;try{result=await runner.buildRunner(runner.OFFICIAL_DRIVER,{entry:1000,native:15000,persistence:1000,cleanup:10})(action,{scenarioId:'C09',ownerRunId:OWNER_RUN_ID})}finally{crypto.subtle.sign=originalSign}
 const elapsed=Date.now()-start;assert.ok(elapsed<1500,mode+': original stage local wait must close');assert.equal(stages,mode.startsWith('sign-')?0:1);assert.equal(inspects,0);if(mode.startsWith('sign-'))assert.equal(h.rows.filter(r=>r._table==='fixtureStages').length,0);else assert.equal(h.rows.filter(r=>r._table==='fixtureStages').length,1);
 const trigger=h.state().retainedTriggerCanonical;await wait(200);assert.equal(unhandled.length,0);assert.equal(h.state().retainedTriggerCanonical,trigger);assert.equal(h.state().active,'C09');assert.equal(h.state().attempts.at(-1).known,null);assert.equal(h.state().attempts.at(-1).attachment,'closed');outcomes.push({name:mode,status:'PASS',elapsed,stages,pending:result.pending});
}
console.log(JSON.stringify({scope:'DUMMY_REGISTERED_VM_ORIGINAL_1000MS_PREPARATION_ADMISSION_PENDING',outcomes,unhandled,skipped:0}));
