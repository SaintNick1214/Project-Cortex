import assert from 'node:assert/strict';
import {createResolver} from '../convex/proofs.ts';
import {BINDING,SOURCE_SNAPSHOT} from '../convex/installed.ts';
import {canonical} from '../convex/validate.ts';
import {observeStream,makeEvent} from '../convex/observer.ts';
const H='a'.repeat(64),model='openai/gpt-4o-mini',now=Date.now();
const p={version:1,proofHash:H,type:'lifetime',installationHash:BINDING.installedClosureHash,reviewerAcceptanceHash:H,validatorSourceHash:H,providerSourceHash:SOURCE_SNAPSHOT.providerSourceHash,providerVersion:'0.2.1',adapterVersion:'3.0.14',providerV4Version:'4.0.21',loadedClosureHash:BINDING.installedClosureHash,sourceRevision:H,checkedAt:SOURCE_SNAPSHOT.checkedAt,expiresAt:SOURCE_SNAPSHOT.expiresAt,targetHash:BINDING.targetHash,manifestHash:BINDING.manifestHash,requestedModel:model,actualModels:[model],methods:['stream'],rule:'chat-correlated-raw-native-finish-v1',supportsRawFinish:['stop','length','content_filter'],confirmsWholeInvocationTermination:true};
// Exact closed resolver with disjoint DUMMY compiled accepted bytes; actual registry stays empty.
const resolver=createResolver([p],[{proofHash:H,canonical:canonical(p,8192)}],BINDING.installedClosureHash),ctx={binding:BINDING,scenarioId:'C09',dispatchIdentity:H,enteredAt:now,now,originalDeadline:now+15000,sourceClosureHash:BINDING.installedClosureHash};
const raw={id:'DUMMY',model,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:0,cost:'0'}},finish={finish:{unified:'stop',raw:'stop'},usage:{input:1,output:0}};
const cases=[
{name:'two balanced empty segments positive',parts:[['raw',raw],['text-start',{id:'one'}],['text-end',{id:'one'}],['text-start',{id:'two'}],['text-end',{id:'two'}],['finish',finish]],expected:'validated-provider-terminal'},
{name:'first empty closed second open denies',parts:[['raw',raw],['text-start',{id:'one'}],['text-end',{id:'one'}],['text-start',{id:'two'}],['finish',finish]],expected:'unknown'},
{name:'complete terminal genuine error retains',parts:[['raw',raw],['text-start',{id:'one'}],['text-end',{id:'one'}],['finish',finish],['error',{type:'error'}]],expected:'validated-provider-terminal'},
{name:'usage raw after complete terminal error denies',parts:[['raw',raw],['text-start',{id:'one'}],['text-end',{id:'one'}],['finish',finish],['error',{type:'error'}],['raw',{id:'DUMMY',model,choices:[],usage:{prompt_tokens:1,completion_tokens:0,cost:'0'}}]],expected:'unknown'}];
const outcomes=[];for(const test of cases){const events=await Promise.all(test.parts.map(([kind,data],index)=>makeEvent(index,kind,data)));const observed=await observeStream(ctx,events,'error',resolver);assert.equal(observed.receipt.lifetime,test.expected);outcomes.push({name:test.name,status:'PASS',lifetime:observed.receipt.lifetime})}console.log(JSON.stringify({scope:'DUMMY_C2_ORDERED_COMPLETE_ERROR_AND_ALL_SEGMENTS_ONLY',outcomes}));
