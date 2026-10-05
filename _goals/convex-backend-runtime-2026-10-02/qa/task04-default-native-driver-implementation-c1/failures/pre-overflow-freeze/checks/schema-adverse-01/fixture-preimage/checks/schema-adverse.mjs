import assert from 'node:assert/strict';
import {Harness} from './harness.mjs';
import {context,generate} from './controls.mjs';
import {observeGenerate} from '../convex/observer.ts';
import {canonical,receipt} from '../convex/validate.ts';
import {BINDING} from '../convex/installed.ts';
const h=await new Harness().setup();await h.reserve();await h.enter();const ctx=context(h),obs=await observeGenerate(ctx,generate()),r=obs.receipt;
const mutations=[x=>x.version=1,x=>x.evidenceScope='nonpaid-peer-offline',x=>x.extra=true,x=>delete x.binding.profileEpoch,x=>x.binding.grantEpoch=0,x=>x.rawDigest='BAD',x=>x.responseId='\u0000bad',x=>x.rawCounts.input=true,x=>x.rawCounts.input=-0,x=>x.rawCounts.input=1.5,x=>x.rawCounts.input=31,x=>x.observedCategories=['routing','inference'],x=>x.observedCategories=['inference','inference'],x=>x.observedCategories=['unknown'],x=>x.lifetimeProof='a'.repeat(64),x=>x.moneyProof='a'.repeat(64),x=>x.microUSD=0,x=>x.usage='validated-raw-mapped'&&(x.rawCounts.input=null),x=>x.money='validated-whole-invocation-usd',x=>x.reason='none',x=>x.serving='validated-bound-premises'];
let rejected=0;for(const change of mutations){const item=structuredClone(r);change(item);assert.throws(()=>receipt(canonical(item,8192),BINDING));rejected++}
const malformed={...r};delete malformed.nativeHash;const args={scenarioId:'C01',dispatchIdentity:ctx.dispatchIdentity,observationCanonical:canonical(malformed),contextCanonical:canonical(ctx),transcriptCanonical:obs.transcriptCanonical};const before=h.writes;assert.equal((await h.mutation(h.controls.capture,args)).status,'invalid-retained');assert.equal(h.writes,before+1);assert.equal(h.state().reserved,29031);assert.equal(h.state().active,'C01');assert.equal(h.state().stopped,true);const w=h.writes;await h.mutation(h.controls.capture,args);assert.equal(h.writes,w);
console.log(JSON.stringify({scope:'OFFLINE_STRICT_SCHEMA_ADVERSE_ONLY',outcomes:[{name:'21 independent typed enum/key/hash/count/category/crossfield rejects and first malformedSTOP1write then0repeat',status:'PASS',rejected}]}));
