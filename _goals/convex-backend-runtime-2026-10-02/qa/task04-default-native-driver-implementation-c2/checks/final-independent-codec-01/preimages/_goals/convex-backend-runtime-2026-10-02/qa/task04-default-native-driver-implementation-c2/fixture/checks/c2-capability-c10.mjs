import assert from 'node:assert/strict';
// Prefix generation only: unchanged historical trusted-code algebra, never repaired authority proof.
import {toStage} from '../../../task04-default-native-driver-implementation-c1/fixture/checks/lifecycle.mjs';
import * as runner from '../../fixture-vm/convex/runner.ts';
import * as lifecycle from '../../fixture-vm/convex/lifecycle.ts';
import {setParts} from '../../fixture-vm/convex/dummy-port.mjs';
import {OWNER_RUN_ID} from '../convex/installed.ts';
const h=await toStage('C10',true);const action=h.action(),original=action.runMutation;let calls=0,issued;
action.runMutation=async(ref,args)=>{if(ref[Symbol.for('functionName')].endsWith('stageAndTrigger')){calls++;issued=args;return h.mutation(lifecycle.stageAndTrigger,args)}return original(ref,args)};
setParts([{type:'raw',rawValue:{id:'DUMMY',model:'openai/gpt-4o-mini',choices:[{index:0,delta:{content:'first'},finish_reason:null}]}},{type:'text-start',id:'DUMMY'},{type:'text-delta',id:'DUMMY',delta:'first'}]);
await runner.buildRunner(runner.OFFICIAL_DRIVER,{entry:1000,native:15000,persistence:1000,cleanup:10})(action,{scenarioId:'C10',ownerRunId:OWNER_RUN_ID});assert.equal(calls,1);assert.equal(h.state().cancelled,true);assert.equal(h.state().revoked,false);assert.equal(h.state().active,'C10');assert.equal(h.rows.filter(r=>r._table==='fixtureStages').length,1);assert.equal(h.rows.find(r=>r._table==='fixtureGrants').active,true);const writes=h.writes;assert.equal((await h.mutation(lifecycle.stageAndTrigger,issued)).kind,'replay');assert.equal(h.writes,writes);
console.log(JSON.stringify({scope:'DUMMY_EXACT_OFFICIAL_BODY_C10_REGISTERED_POSITIVE_HISTORICAL_PREFIX_ONLY',outcomes:[{name:'C10 official-issued stage cancels atomically without grant mutation; historical replay zero writes',status:'PASS'}],skipped:0}));
