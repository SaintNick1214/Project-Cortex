import assert from 'node:assert/strict';
import {toStage} from './lifecycle.mjs';
import {buildRunner} from '../convex/runner.ts';
import {observeStream,makeEvent} from '../convex/observer.ts';
import {OWNER_RUN_ID} from '../convex/installed.ts';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));const unhandled=[];process.on('unhandledRejection',error=>unhandled.push(String(error)));
const outcomes=[];
for(const secondary of ['success','failure']){
 const h=await toStage('C09',true),action=h.action(),original=action.runMutation;let submissions=0,native=0,callbackElapsed=0,callbackResult,signalAborted=false,inspects=0;
 action.runMutation=async(ref,args)=>{if(ref[Symbol.for('functionName')].endsWith('stageAndTrigger')){submissions++;const result=await original(ref,args);await wait(300);if(secondary==='failure')throw Error('DUMMY_STAGE_ACK_LATE_FAILURE');return result}return original(ref,args)};
 const originalQuery=action.runQuery;action.runQuery=async(ref,args)=>{if(ref[Symbol.for('functionName')].endsWith('inspectTrigger'))inspects++;return originalQuery(ref,args)};
 const run=buildRunner({execute:async(c,ctx,signal,onEvents)=>{native++;const events=await Promise.all([['raw',{id:'DUMMY',model:c.modelId,choices:[{index:0,delta:{content:'DUMMY'},finish_reason:null}]}],['text-start',{id:'DUMMY'}],['text-delta',{id:'DUMMY',delta:'DUMMY'}]].map(([kind,data],index)=>makeEvent(index,kind,data)));const start=Date.now();callbackResult=await onEvents(events);callbackElapsed=Date.now()-start;signalAborted=signal.aborted;return observeStream(ctx,events,'abort')}},{entry:500,native:500,persistence:100,cleanup:10});
 const result=await run(action,{scenarioId:'C09',ownerRunId:OWNER_RUN_ID});assert.ok(callbackElapsed<200,`local callback took ${callbackElapsed}ms`);assert.equal(callbackResult,false);assert.equal(signalAborted,true);assert.equal(submissions,1);assert.equal(inspects,0);assert.equal(native,1);assert.equal(h.rows.filter(r=>r._table==='fixtureStages').length,1);const identity=h.state().retainedTriggerCanonical;
 await wait(350);assert.equal(h.state().retainedTriggerCanonical,identity);assert.equal(h.state().revoked,true);assert.equal(h.state().attempts.at(-1).attachment,'closed');assert.equal(h.state().active,'C09');assert.equal(h.state().attempts.at(-1).known,null);assert.equal(unhandled.length,0);outcomes.push({name:`already submitted committed stage late ${secondary} preserved`,status:'PASS',callbackElapsed,result,pendingAfterCallback:result.pending});
}
console.log(JSON.stringify({scope:'DUMMY_LOCAL_STAGE_PHASE_ONLY_SERVER_CAPABILITY_GATE_UNIMPLEMENTED',outcomes,unhandled}));
