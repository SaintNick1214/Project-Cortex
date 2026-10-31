/** SOURCE/MOCK only: pure current-public gate and original pre-content hold ordering. */
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';import vm from 'node:vm';import path from 'node:path';import{fileURLToPath}from'node:url';
const A=path.dirname(fileURLToPath(import.meta.url)),F=path.join(path.dirname(A),'task03-attempt6-current-binding-repair2'),Q=path.join(path.dirname(path.dirname(A)),'task03-local-native-attempt6-2026-10-06');
const code=fs.readFileSync(path.join(A,'independent-private-observer.mjs'),'utf8'),bindingBody=fs.readFileSync(path.join(F,'current-transport-binding.json')),requestBody=fs.readFileSync(path.join(Q,'project-request.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');const controls=[];
const start=code.indexOf('function validateCurrentBinding('),end=code.indexOf('\n}',start)+2;assert.ok(start>0&&end>start);
const pin=Object.fromEntries(['dev','ino','mode','uid','gid','nlink','size','mtime_ns','ctime_ns'].map(k=>['st_'+k,'1']));
const context=vm.createContext({assert,sha,OP:'c9fbaa34-8ca8-4153-b8bd-1cfe60a8241f',CURRENT_BINDING_ORIGINAL_NINE:pin,bindingRow:{identityDecimal:pin,sha256:sha(bindingBody),body:bindingBody},requestRow:{body:requestBody},privateAccesses:0});
vm.runInContext('function json(b){return JSON.parse(b.toString())}\n'+code.slice(start,end),context);
function test(name,body,deny=false){let rejected=false;try{body();}catch(e){if(!(e instanceof assert.AssertionError))throw e;rejected=true;}assert.equal(rejected,deny,name);controls.push({name,result:deny?'DENIED':'PASS',scope:'SOURCE/MOCK'});}
test('new_six_canonical_pinned_public_input',()=>{const v=vm.runInContext('validateCurrentBinding(bindingRow,requestRow)',context);assert.equal(v.binding.projectName,'cortex-foundation-delta-312f13a61cc6');});
for(const field of ['operation','requestSha256','projectSlug','projectName','teamId','privateEnvironmentFile'])test('changed_'+field+'_denied_before_private',()=>{const bad=JSON.parse(bindingBody);bad[field]=field==='teamId'?true:'changed';context.bad={...context.bindingRow,body:Buffer.from(JSON.stringify(bad))};vm.runInContext('validateCurrentBinding(bad,requestRow);privateAccesses++',context);},true);
test('native_public_pin_changed_denied',()=>{context.bad={...context.bindingRow,identityDecimal:{...pin,st_ctime_ns:'2'}};vm.runInContext('validateCurrentBinding(bad,requestRow);privateAccesses++',context);},true);
test('public_binding_hash_changed_denied',()=>{context.bad={...context.bindingRow,sha256:'0'.repeat(64)};vm.runInContext('validateCurrentBinding(bad,requestRow);privateAccesses++',context);},true);
assert.equal(context.privateAccesses,0);
const publicGate=code.indexOf('validateCurrentBinding(currentBindingRow,currentRequestRow)'),firstPrivate=code.indexOf("const roots=[openHeld(source,true)");assert.ok(publicGate>0&&firstPrivate>publicGate);
controls.push({name:'public_gate_precedes_every_private_path_operation',result:'PASS',scope:'SOURCE_ORDER_AND_PURE_NEGATIVE_CONTROLS'});
const sourceDescriptors=code.indexOf('const sourceHandles='),destDescriptors=code.indexOf('const destHandles='),hold=code.indexOf('const preContentObservationStart='),firstReceipt=code.indexOf('const nativeReceiptRow=');
assert.ok(sourceDescriptors>firstPrivate&&destDescriptors>sourceDescriptors&&hold>destDescriptors&&firstReceipt>hold);assert.ok(code.slice(hold,firstReceipt).includes('20000'));assert.equal((code.match(/Atomics\.wait/g)||[]).length,2);
controls.push({name:'all_four_native_and_three_destination_descriptors_before_original_content_and_20_second_hold',result:'PASS',scope:'SOURCE_ORDER_ONLY_NOT_ACTUAL_HOLD'});
assert.ok(code.includes('rsa2048:true')&&code.includes('rs256SignVerify:true')&&code.includes('changedMessageRejected:true'));
const result={scope:'OBSERVER_PURE_SOURCE_MOCK_CONTROLS_ONLY',status:'PASS',controls,count:controls.length,privateAccesses:0,DockerCalls:0,actualObservationSeconds:0,noActualCryptoOrNativeAcceptance:true};fs.writeFileSync(path.join(A,'observer-source-control-results.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS',count:controls.length,scope:result.scope}));
