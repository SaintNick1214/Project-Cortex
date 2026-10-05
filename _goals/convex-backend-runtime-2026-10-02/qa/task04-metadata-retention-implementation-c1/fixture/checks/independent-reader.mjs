import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {OFFICIAL_DRIVER} from '../convex/runner.ts';
import {REQUESTS} from '../convex/requests.ts';
import {CASES} from '../convex/cases.ts';
import {BINDING} from '../convex/installed.ts';
import {fail,canonical} from '../convex/validate.ts';
import {observeEmbed,observeGenerate,observeStream,nativeEvent,makeEvent} from '../convex/observer.ts';
const source=String(OFFICIAL_DRIVER.execute);writeFileSync('checks/official-execute-runtime-preimage.txt',source);
// Exact runtime function body copied from untouched imported source. Only factory dependency
// is a disjoint DUMMY port, so no real official factory/token/network/native invocation occurs.
let cancel=0,release=0,reads=0,fakeFactories=0,live=true;
const malformed={type:'raw'};Object.defineProperty(malformed,'rawValue',{enumerable:true,get(){throw Error('DUMMY_GETTER_MUST_NOT_READ')}});
const reader={read:async()=>{reads++;return {done:false,value:malformed}},cancel:async()=>{cancel++;live=false},releaseLock:()=>{release++}};
const fakeGateway=()=>{fakeFactories++;return {doStream:async()=>({stream:{getReader:()=>reader}})}};
const execute=Function('REQUESTS','convexGateway','fail','observeEmbed','observeGenerate','observeStream','nativeEvent','canonical','makeEvent',`return ({${source}}).execute`)(REQUESTS,fakeGateway,fail,observeEmbed,observeGenerate,observeStream,nativeEvent,canonical,makeEvent);
const now=Date.now(),c=CASES.find(c=>c.scenarioId==='C02'),ctx={binding:BINDING,scenarioId:'C02',dispatchIdentity:'a'.repeat(64),enteredAt:now,now,originalDeadline:now+15000,sourceClosureHash:BINDING.installedClosureHash};
const o=await execute(c,ctx,new AbortController().signal,async()=>false);
console.log(JSON.stringify({scope:'DUMMY_EXACT_RUNTIME_EXECUTE_BODY_DEPENDENCY_PORT_ONLY',reads,cancel,release,fakeFactories,actualFactory:0,liveAfterReturn:live,reason:o.receipt.reason,lifetime:o.receipt.lifetime,expected:'malformed live reader cancelled/released before return'}));assert.equal(release,1);assert.equal(o.receipt.lifetime,'unknown');assert.equal(cancel,1,'malformed live reader must remain owned/cancelled, not merely unlocked');
