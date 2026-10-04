import assert from 'node:assert/strict';
import { mkdirSync, chmodSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createWireDiagnostics, boundedWireBody, diagnosticLimits } from './wire-diagnostics.mjs';
import { authDenial } from './native-engine.mjs';
import { repo } from './guard.mjs';
const directory=resolve(repo,'work/resume/current-guard-live-c4/diagnostic-controls-'+randomUUID());mkdirSync(directory,{mode:0o700});
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
const q=readFileSync(new URL('./qualify.mjs',import.meta.url),'utf8');assert.ok(q.indexOf('// Every public registration')<q.indexOf('// Run uniformly unavailable'));
assert.ok(q.includes('try{authDenial(result,error);}catch(assertion){ctx.diagnoseAuthFailure(result,error);throw assertion;}'));
console.log(JSON.stringify({scope:'OFFLINE_PRIVATE_DIAGNOSTICS',status:'PASS',routineDenials:560,routineDiskRecords:0,maxRecords:32,maxRecordBytes:65536,mode600:true,unknownStillFails:true,unexpectedSuccessStillFails:true,redaction:true,streamBound:true,publicBeforeClosure:true,serviceCalls:0,keyReads:0,signatures:0}));
