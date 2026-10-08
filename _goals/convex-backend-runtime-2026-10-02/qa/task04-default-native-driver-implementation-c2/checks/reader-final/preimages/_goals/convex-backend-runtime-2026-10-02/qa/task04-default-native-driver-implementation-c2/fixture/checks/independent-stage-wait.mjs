import assert from 'node:assert/strict';
import {h} from './independent-prefix.mjs';
import {buildRunner} from '../convex/runner.ts';
import {OWNER_RUN_ID} from '../convex/installed.ts';
import {observeStream,makeEvent} from '../convex/observer.ts';
// Prefix helper leaves C09 already entered. Remove only that checkpoint in DUMMY account to run actual runner.
const s=h.state();s.attempts.pop();s.next--;s.active=null;s.reserved=0;h.setState(s);
const action=h.action(),original=action.runMutation;let stageStart=0,stageEnd=0,stageCalls=0;action.runMutation=async(ref,args)=>{if(ref[Symbol.for('functionName')].endsWith('stageAndTrigger')){stageCalls++;stageStart=Date.now();await new Promise(resolve=>setTimeout(resolve,250));const result=await original(ref,args);stageEnd=Date.now();return result}return original(ref,args)};
let callback;const result=await buildRunner({execute:async(c,ctx,_signal,onEvents)=>{const parts=[['raw',{id:'DUMMY',model:c.modelId,choices:[{index:0,delta:{content:'DUMMY'},finish_reason:null}]}],['text-start',{id:'DUMMY'}],['text-delta',{id:'DUMMY',delta:'DUMMY'}]],events=await Promise.all(parts.map(([k,d],i)=>makeEvent(i,k,d)));callback=await onEvents(events);return observeStream(ctx,events,'abort')}},{entry:500,native:500,persistence:10,cleanup:10})(action,{scenarioId:'C09',ownerRunId:OWNER_RUN_ID});
console.log(JSON.stringify({scope:'DUMMY_REGISTERED_STAGE_WINDOW',result,callback,stageCalls,stageMillis:stageEnd-stageStart,persistenceMillis:10,stages:h.rows.filter(r=>r._table==='fixtureStages').length,expected:'reader stage wait closes at original10ms persistence phase; pending effect may settle later'}));assert.ok(stageEnd-stageStart<=60,'reader stage wait must honor original10ms phase (60ms generous scheduling allowance), not native500ms');
