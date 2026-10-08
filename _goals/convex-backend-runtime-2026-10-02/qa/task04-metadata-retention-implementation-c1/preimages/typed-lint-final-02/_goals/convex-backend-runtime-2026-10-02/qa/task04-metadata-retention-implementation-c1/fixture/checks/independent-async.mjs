import assert from 'node:assert/strict';
import {Harness} from './harness.mjs';
import {buildRunner} from '../convex/runner.ts';
import {OWNER_RUN_ID} from '../convex/installed.ts';
const unhandled=[];process.on('unhandledRejection',e=>unhandled.push(String(e)));
const h=await new Harness().setup();let calls=0;const r=await buildRunner({execute:async()=>{calls++;throw Error('DUMMY_PROVIDER_REJECTED')}},{entry:500,native:100,persistence:100,cleanup:20})(h.action(),{scenarioId:'C01',ownerRunId:OWNER_RUN_ID});await new Promise(resolve=>setTimeout(resolve,30));const s=h.state();console.log(JSON.stringify({scope:'DUMMY_PROVIDER_REJECTION_NO_NATIVE',result:r,calls,unhandled,state:{active:s.active,reserved:s.reserved,stopped:s.stopped,attachment:s.attempts[0].attachment},expectedUnhandled:0}));assert.equal(calls,1);assert.equal(s.reserved,29031);assert.equal(s.active,'C01');assert.equal(s.stopped,true);assert.equal(unhandled.length,0,'owned native error and persistence continuation must both be joined');
