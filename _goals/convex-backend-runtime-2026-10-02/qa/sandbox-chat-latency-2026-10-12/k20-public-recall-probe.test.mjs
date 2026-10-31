import test from 'node:test';
import assert from 'node:assert/strict';
import {safeLatencyEvent,projectRecall} from './k20-public-recall-probe.mjs';
import {requirePublicRecallPins} from './k20-public-recall-pins.mjs';
const actor={tenantId:'t',memorySpaceId:'s',principalId:'p'},profile='cortex-text-small-1536-v1';
function value(){return{profileId:profile,context:'PRIVATE_CONTEXT_SECRET',deliveryExpiresAt:2000,items:[{type:'fact',id:'private-fact-id',content:'My favorite color is coral.',score:0.8,source:'facts',
  fact:{tenantId:'t',memorySpaceId:'s',ownerPrincipalId:'p',lineage:{sourceId:'private-source',sourceEventId:'private-event',sourceRevision:1,role:'user',trust:'user_assertion'}}}]};}
test('unready pins reject before native setup',()=>assert.throws(()=>requirePublicRecallPins({}),/UNREADY_K20/));
test('SDK latency projection copies only compiled scalar metadata',()=>{const e=safeLatencyEvent({version:1,phase:'rpc.end',atMs:100,method:'runtimeMemory:recall',rpcId:1,durationMs:30,token:'SECRET',output:'PRIVATE'});assert.deepEqual(e,{version:1,phase:'rpc.end',atMs:100,method:'runtimeMemory:recall',rpcId:1,durationMs:30});assert.equal(safeLatencyEvent({version:1,phase:'rpc.end',atMs:100,method:'private-arbitrary-request'}),undefined);});
test('positive expected scope/lineage result is scalar-only and retains no payload/raw identifiers',()=>{const p=projectRecall(value(),actor,profile,1000),s=JSON.stringify(p);assert.equal(p.expectedPreference,true);assert.equal(p.currentOwner,true);assert.equal(p.factCount,1);assert.doesNotMatch(s,/PRIVATE_CONTEXT_SECRET|My favorite|private-fact-id|private-source|private-event/);});
for(const field of ['tenantId','memorySpaceId','ownerPrincipalId'])test('foreign '+field+' is refused',()=>{const v=value();v.items[0].fact[field]='foreign';assert.throws(()=>projectRecall(v,actor,profile,1000));});
test('assistant attribution and expired deadline are refused',()=>{const v=value();v.items[0].fact.lineage.role='assistant';assert.throws(()=>projectRecall(v,actor,profile,1000));const expired=value();expired.deliveryExpiresAt=1000;assert.throws(()=>projectRecall(expired,actor,profile,1000));});
test('mismatching default profile and missing positive preference are refused',()=>{assert.throws(()=>projectRecall(value(),actor,'wrong-profile',1000));const v=value();v.items[0].content='No matching expected preference';assert.throws(()=>projectRecall(v,actor,profile,1000));});
