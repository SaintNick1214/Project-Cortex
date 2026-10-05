import assert from 'node:assert/strict';
import { mkdirSync, chmodSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createWireDiagnostics, boundedWireBody, diagnosticLimits } from './wire-diagnostics.mjs';
import { authDenial } from './native-engine.mjs';
import { repo } from './guard.mjs';
const directory=resolve(repo,'work/backend-runtime/task03-foundation-live-c11/diagnostic-controls-'+randomUUID());mkdirSync(directory,{mode:0o700});
const origin='https://diagnostic.invalid',d=createWireDiagnostics(directory,origin);d.addSecret('private-control-secret');
for(let i=0;i<560;i++){d.clear();d.wire(401,origin,'{"code":"InvalidAuth","message":"opaque"}',45,false);}
const exact={version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'};for(let i=0;i<560;i++)authDenial(undefined,{data:exact});
assert.equal(d.summary().recordCount,0);assert.equal(readdirSync(directory).length,0);
assert.throws(()=>authDenial(undefined,new Error('unknown private-control-secret')));
d.error(new Error('unknown private-control-secret'),false);assert.equal(d.summary().recordCount,2);
for(let i=0;i<40;i++)d.success();assert.equal(d.summary().recordCount,32);assert.ok(d.summary().droppedRecords>0);
for(const alias of readdirSync(directory)){const path=resolve(directory,alias),stat=lstatSync(path),text=readFileSync(path,'utf8');assert.equal(stat.mode&0o777,0o600);assert.equal(stat.nlink,1);assert.ok(stat.size<=diagnosticLimits.bytesPerRecord);assert.ok(!text.includes('private-control-secret'));}
const summary=JSON.stringify(d.summary());assert.ok(!summary.includes('opaque'));assert.ok(!summary.includes('private-control-secret'));assert.throws(()=>d.wire(401,'https://foreign.invalid','{}',2,false));
const bad=resolve(directory,'bad');mkdirSync(bad,{mode:0o755});chmodSync(bad,0o755);assert.throws(()=>createWireDiagnostics(bad,origin));
const large=await boundedWireBody(new Response('x'.repeat(70000),{status:401}));assert.equal(large.byteCount,65536);assert.equal(large.truncated,true);
assert.throws(()=>authDenial({unexpected:true},undefined));
const engine=readFileSync(new URL('./native-engine.mjs',import.meta.url),'utf8'),priorEngine=readFileSync(resolve(repo,'_goals/convex-backend-runtime-2026-10-02/qa/task03-foundation-live-preparation-c3/scripts/native-engine.mjs'),'utf8');
const exactClassifier=text=>text.slice(text.indexOf('export function authDenial'),text.indexOf('export function opaqueInternalFailure'));assert.equal(exactClassifier(engine),exactClassifier(priorEngine));
assert.ok(engine.includes('diagnostics.clear();platformWireMessages.clear();return await bounded'));
assert.ok(engine.includes('if(!response.ok){platformWireMessages.clear();const wire='));
const q=readFileSync(new URL('./qualify.mjs',import.meta.url),'utf8');assert.ok(q.indexOf('// Every public registration')<q.indexOf('// Run uniformly unavailable'));
assert.ok(q.includes('try{authDenial(result,error);}catch(assertion){ctx.diagnoseAuthFailure(result,error);throw assertion;}'));
const boundaryObserved=[];
for(const serializedBytes of [65535,65536,65537]){
 const root=resolve(directory,'boundary-'+serializedBytes);mkdirSync(root,{mode:0o700});
 const sha=value=>createHash('sha256').update(value).digest('hex');
 const trial=JSON.stringify({version:1,observedAt:new Date().toISOString(),kind:'caught_native_error',messageSha256:sha(''),cachedWire:false,privateDiagnostic:JSON.stringify({message:''})});
 const n=serializedBytes-Buffer.byteLength(trial),message='x'.repeat(n);
 assert.equal(Buffer.byteLength(JSON.stringify({version:1,observedAt:new Date().toISOString(),kind:'caught_native_error',messageSha256:sha(message),cachedWire:false,privateDiagnostic:JSON.stringify({message})})),serializedBytes);
 const capture=createWireDiagnostics(root,origin);assert.doesNotThrow(()=>capture.error(new Error(message),false));
 const files=readdirSync(root);assert.equal(files.length,1);const file=resolve(root,files[0]),stat=lstatSync(file),record=JSON.parse(readFileSync(file,'utf8'));
 assert.ok(stat.size<=65536);assert.equal(stat.mode&0o777,0o600);assert.equal(stat.nlink,1);assert.equal(capture.summary().recordCount,1);assert.equal(capture.summary().receipts[0].receiptBytes,stat.size);
 if(serializedBytes===65535){assert.equal(stat.size,65536);assert.equal(record.truncated,undefined);}else assert.equal(record.truncated,true);
 boundaryObserved.push({serializedBytes,fileBytes:stat.size,truncated:record.truncated===true});
}
const plain=Buffer.from(JSON.stringify({code:'InvalidAuth',message:'known-BOM-boundary-message'}));
const invalid=Buffer.concat([Buffer.from('{"code":"InvalidAuth","message":"'),Buffer.from([0xc3,0x28]),Buffer.from('"}')]);
const decodeObserved=[];
for(const [label,bytes] of [['plain',plain],['bom',Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),plain])],['invalidUTF8',invalid]]){
 const response=new Response(bytes,{status:401}),original=await response.clone().text(),captured=await boundedWireBody(response);
 assert.equal(captured.body,original);assert.equal(captured.byteCount,bytes.length);assert.equal(captured.truncated,false);
 const baseline=await import('./native-engine.mjs?baseline-'+label),candidate=await import('./native-engine.mjs?candidate-'+label);
 const originalAccepted=baseline.rememberPlatformWire(401,original),capturedAccepted=candidate.rememberPlatformWire(401,captured.body);
 assert.equal(originalAccepted,true);assert.equal(capturedAccepted,originalAccepted);assert.doesNotThrow(()=>baseline.authDenial(undefined,new Error(original)));assert.doesNotThrow(()=>candidate.authDenial(undefined,new Error(original)));
 assert.equal(JSON.parse(captured.body).code,'InvalidAuth');assert.throws(()=>candidate.authDenial(undefined,new Error('unrecognized-private-wire')));
 decodeObserved.push({label,sameText:true,byteCount:captured.byteCount,truncated:false,originalAccepted,capturedAccepted,originalDenial:true,capturedDenial:true,code:'InvalidAuth',unknownRejected:true});
}
console.log(JSON.stringify({scope:'OFFLINE_PRIVATE_DIAGNOSTICS',status:'PASS',routineDenials:560,routineDiskRecords:0,maxRecords:32,maxRecordBytes:65536,mode600:true,unknownStillFails:true,unexpectedSuccessStillFails:true,redaction:true,streamBound:true,publicBeforeClosure:true,boundaryObserved,decodeObserved,serviceCalls:0,keyReads:0,signatures:0}));
