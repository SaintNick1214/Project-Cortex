import assert from 'node:assert/strict';
import {Harness} from './harness.mjs';
import {capture,mockResolver,modes} from './controls.mjs';
import * as guard from '../convex/guard.ts';
import {canonical,account,factsFold} from '../convex/validate.ts';
import {BINDING,ACCOUNT_HASH} from '../convex/installed.ts';
import {CASES} from '../convex/cases.ts';
const h=await new Harness().setup(guard.buildControls(mockResolver));await h.reserve();await h.enter();modes.money=true;modes.lifetime=false;await capture(h);modes.lifetime=true;await capture(h);const original=h.state();assert.equal(original.attempts[0].refinements.length,1);await account(canonical(original,524288),BINDING,ACCOUNT_HASH);const outcomes=[];
for(const mode of ['refinement-foreign-dispatch','coherent-foreign-first-plus-refinement']){const state=structuredClone(original),a=state.attempts[0];if(mode==='refinement-foreign-dispatch'){const r=JSON.parse(a.refinements[0]);r.dispatchIdentity='b'.repeat(64);a.refinements[0]=canonical(r,8192)}else{const c=CASES.find(c=>c.scenarioId==='C03'),alter=raw=>canonical({...JSON.parse(raw),scenarioId:c.scenarioId,dispatchIdentity:'b'.repeat(64),nativeHash:c.normalizedNativeRequestHash,expectedWireHash:c.expectedWireBodyHash,method:c.method,interface:c.nativeInterface,requestedModel:c.modelId},8192);a.firstCapture=alter(a.firstCapture);a.refinements=a.refinements.map(alter);a.facts=factsFold([a.firstCapture,...a.refinements].map(JSON.parse))}
await assert.rejects(account(canonical(state,524288),BINDING,ACCOUNT_HASH),/IDENTITY_CONFLICT/);h.setState(state);const bytes=canonical(h.rows,Number.MAX_SAFE_INTEGER),writes=h.writes;const result=await h.query(guard.inspect);assert.deepEqual(result,{kind:'denied',reason:'corrupt'});assert.equal(h.writes,writes);assert.equal(canonical(h.rows,Number.MAX_SAFE_INTEGER),bytes);outcomes.push({name:mode,status:'PASS',writes:0,noSummary:true})}
console.log(JSON.stringify({scope:'DUMMY_RETAINED_REFINEMENT_AND_COHERENT_FOREIGN_FOLD_NO_NATIVE',outcomes,skipped:0}));
