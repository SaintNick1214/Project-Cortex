import assert from 'node:assert/strict';
import {h} from './independent-prefix.mjs';
import {buildRunner} from '../convex/runner.ts';
import {OWNER_RUN_ID} from '../convex/installed.ts';
import {observeStream,makeEvent} from '../convex/observer.ts';
// Prefix helper leaves C09 already entered. Remove only that checkpoint in DUMMY account to run actual runner.
const s=h.state();s.attempts.pop();s.next--;s.active=null;s.reserved=0;h.setState(s);
const action=h.action(),original=action.runMutation;let stageStart=0,stageEnd=0,stageCalls=0;action.runMutation=async(ref,args)=>{if(ref[Symbol.for('functionName')].endsWith('stageAndTrigger')){stageCalls++;stageStart=Date.now();await new Promise(resolve=>setTimeout(resolve,60));const result=await original(ref,args);stageEnd=Date.now();return result}return original(ref,args)};
let callback;const result=await buildRunner({execute:async(c,ctx,_signal,onEvents)=>{const parts=[['raw',{id:'DUMMY',model:c.modelId,choices:[{index:0,delta:{content:'DUMMY'},finish_reason:null}]}],['text-start',{id:'DUMMY'}],['text-delta',{id:'DUMMY',delta:'DUMMY'}]],events=await Promise.all(parts.map(([k,d],i)=>makeEvent(i,k,d)));callback=await onEvents(events);return observeStream(ctx,events,'abort')}},{entry:500,native:500,persistence:10,cleanup:10})(action,{scenarioId:'C09',ownerRunId:OWNER_RUN_ID});
console.log(JSON.stringify({scope:'DUMMY_REGISTERED_STAGE_WINDOW',result,callback,stageCalls,stageMillis:stageEnd-stageStart,persistenceMillis:10,stages:h.rows.filter(r=>r._table==='fixtureStages').length,expected:'part persistence deadline closes before delayed fresh stage commit'}));assert.equal(h.rows.filter(r=>r._table==='fixtureStages').length,0,'stage persistence cannot use whole native window');
