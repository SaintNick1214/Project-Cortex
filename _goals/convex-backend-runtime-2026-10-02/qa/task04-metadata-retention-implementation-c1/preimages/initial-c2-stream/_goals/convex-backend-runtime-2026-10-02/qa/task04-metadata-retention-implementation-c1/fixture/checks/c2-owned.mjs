import assert from 'node:assert/strict';
import {Ownership,buildRunner,OFFICIAL_DRIVER} from '../convex/runner.ts';
import {OWNER_RUN_ID,BINDING} from '../convex/installed.ts';
import {Harness} from './harness.mjs';
import {generate} from './controls.mjs';
import {observeGenerate,observeEmbed,observeStream,nativeEvent,makeEvent} from '../convex/observer.ts';
import {REQUESTS} from '../convex/requests.ts';
import {CASES} from '../convex/cases.ts';
import {fail,canonical} from '../convex/validate.ts';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const unhandled=[];const listener=error=>unhandled.push(String(error));process.on('unhandledRejection',listener);
const outcomes=[];
for(const late of ['success','failure']){
 const owner=new Ownership();let resolve,reject;const source=new Promise((yes,no)=>{resolve=yes;reject=no});const tracked=owner.track(source);const continuation=owner.track(tracked.then(()=>{if(late==='failure')throw Error('DUMMY_SECONDARY_FAILURE');return 'DUMMY_SUCCESS'}));assert.equal((await owner.cleanup(2)).pending,2);
 if(late==='success')resolve('DUMMY_FIRST_SUCCESS');else reject(Error('DUMMY_PRIMARY_FAILURE'));
 await wait(10);assert.equal(owner.pending,0);assert.equal(owner.failures.length,late==='failure'?2:0);assert.equal(unhandled.length,0);assert.equal((await Promise.allSettled([tracked,continuation])).length,2);outcomes.push({name:`late ${late} owned continuation consumed`,status:'PASS'});
}
for(const delayed of [false,true]){
 const h=await new Harness().setup(),action=h.action();const original=action.runMutation;let captures=0,calls=0;
 action.runMutation=async(ref,args)=>{if(ref[Symbol.for('functionName')].endsWith('capture')){captures++;if(delayed)await wait(50);throw Error('DUMMY_PERSISTENCE_REJECT')}return original(ref,args)};
 const result=await buildRunner({execute:async(c,ctx)=>{calls++;return observeGenerate(ctx,generate(c))}},{entry:500,native:10,persistence:10,cleanup:2})(action,{scenarioId:'C01',ownerRunId:OWNER_RUN_ID});await wait(60);assert.equal(result.status,'native-unknown');assert.equal(calls,1);assert.ok(captures>=1&&captures<=2);assert.equal(h.state().reserved,29031);assert.equal(h.state().active,'C01');assert.equal(h.state().stopped,true);assert.equal(unhandled.length,0);outcomes.push({name:`${delayed?'late':'settled'} persistence failure owned no replay/fullK`,status:'PASS'});
}
for(const mode of ['malformed','read-error','bound','cancel-error','cancel-pending']){
 let cancel=0,release=0,reads=0;let releaseCancel;
 const reader={read:async()=>{reads++;if(mode==='read-error')throw Error('DUMMY_READ_FAILURE');if(mode==='bound')return {done:false,value:{type:'raw',rawValue:{oversized:'x'.repeat(180001)}}};return {done:false,value:{type:'text-delta',id:'DUMMY',delta:undefined}}},cancel:async()=>{cancel++;if(mode==='cancel-error')throw Error('DUMMY_CANCEL_FAILURE');if(mode==='cancel-pending')await new Promise(resolve=>releaseCancel=resolve)},releaseLock:()=>{release++}};
 const gateway=()=>({doStream:async()=>({stream:{getReader:()=>reader}})});
 const execute=Function('REQUESTS','convexGateway','fail','observeEmbed','observeGenerate','observeStream','nativeEvent','canonical','makeEvent','Ownership',`return ({${String(OFFICIAL_DRIVER.execute)}}).execute`)(REQUESTS,gateway,fail,observeEmbed,observeGenerate,observeStream,nativeEvent,canonical,makeEvent,Ownership);
 // malformed selection must fail before retaining an invalid official event.
 if(mode!=='read-error'&&mode!=='bound'){Object.defineProperty(reader,'read',{value:async()=>{reads++;const part={type:'raw'};Object.defineProperty(part,'rawValue',{enumerable:true,get(){throw Error('DUMMY_GETTER')}});return {done:false,value:part}}});}
 const now=Date.now(),ctx={binding:BINDING,scenarioId:'C02',dispatchIdentity:'a'.repeat(64),enteredAt:now,now,originalDeadline:now+30,sourceClosureHash:BINDING.installedClosureHash};const start=Date.now();const observation=await execute(CASES.find(c=>c.scenarioId==='C02'),ctx,new AbortController().signal,async()=>false);assert.ok(Date.now()-start<150);assert.equal(reads,1);assert.equal(cancel,1);assert.equal(release,1);assert.equal(observation.receipt.lifetime,'unknown');assert.equal(observation.receipt.money,'unknown');assert.ok(observation.readerOwnership.failures.length>=1);
 if(mode==='cancel-pending'){assert.equal(observation.readerOwnership.pending,1);releaseCancel();await wait(5);assert.equal(observation.readerOwnership.pending,0)}if(mode==='cancel-error')assert.ok(observation.readerOwnership.failures.some(error=>String(error).includes('DUMMY_CANCEL_FAILURE')));assert.equal(unhandled.length,0);outcomes.push({name:`exact official runtime ${mode} reader bounded cancel/release`,status:'PASS'});
}
{
 const h=await new Harness().setup();let release;const readerOwner=new Ownership();readerOwner.track(new Promise((_,reject)=>release=reject));const result=await buildRunner({execute:async(c,ctx)=>({...await observeGenerate(ctx,generate(c)),readerOwnership:readerOwner})},{entry:500,native:100,persistence:100,cleanup:2})(h.action(),{scenarioId:'C01',ownerRunId:OWNER_RUN_ID});assert.equal(result.pending,1);assert.equal(readerOwner.pending,1);release(Error('DUMMY_LATE_READER_CLEANUP_REJECT'));await wait(10);assert.equal(readerOwner.pending,0);assert.equal(unhandled.length,0);assert.equal(h.state().active,'C01');assert.equal(h.state().reserved,29031);outcomes.push({name:'runner includes unresolved reader cleanup in owned pending count',status:'PASS'});
}
process.off('unhandledRejection',listener);console.log(JSON.stringify({scope:'DUMMY_C2_OWNED_PRIMARY_SECONDARY_READER_PORT_ONLY',outcomes,unhandled}));
