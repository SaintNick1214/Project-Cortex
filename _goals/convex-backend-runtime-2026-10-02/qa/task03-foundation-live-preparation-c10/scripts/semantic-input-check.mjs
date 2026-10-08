/** Offline real native handlers; no service wire or deployment qualification. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { getFunctionName } from 'convex/server';
import { convexToJson, jsonToConvex } from 'convex/values';
import { candidate, argumentsFor } from './argument-candidates.mjs';
import { offlineCandidateContext as fixtureCtx, validate } from './offline-arguments-check.mjs';
import { authDenial } from './native-engine.mjs';
import { qualifyPolicyTemplate } from './policy-fixture.mjs';
import { repo, preparation, scratch, canonical } from './guard.mjs';
const ledger=JSON.parse(readFileSync(resolve(preparation,'path-ledger.json'))),native=JSON.parse(readFileSync(resolve(preparation,'native-registration-schemas.json')));
const rows=ledger.cases.filter(row=>row.visibility==='public'),sources=[...new Set([...rows.map(row=>row.source),'convex-dev/runtimeAuth.ts'])];
const input=sources.map((source,index)=>`import * as m${index} from ${JSON.stringify(resolve(repo,source))};`).join('\n')+'\nimport { memoryFixture } from '+JSON.stringify(resolve(repo,'tests/unit/runtimeMemory/fixture.ts'))+';\nexport {memoryFixture};\nexport default {'+sources.map((source,index)=>JSON.stringify(source)+`:m${index}`).join(',')+'};';
const bundle=resolve(scratch,'offline-semantic-handlers.mjs');canonical(scratch,repo);await build({stdin:{contents:input,resolveDir:repo},bundle:true,platform:'node',format:'esm',packages:'external',outfile:bundle,logLevel:'silent'});
const loaded=await import(pathToFileURL(bundle)),modules=loaded.default,observations=[];
for(const row of rows){
 let authReads=0,effectTraps=0,authorityForwards=0;const trap=()=>{effectTraps++;throw new Error('OFFLINE_EFFECT_TRAP');};
 const context={auth:{getUserIdentity:async()=>{authReads++;return null;}},db:new Proxy({}, {get:()=>trap}),scheduler:new Proxy({}, {get:()=>trap}),storage:new Proxy({}, {get:()=>trap}),runQuery:async(ref,args)=>{assert.equal(getFunctionName(ref),'runtimeAuth:authorize');authorityForwards++;return await modules['convex-dev/runtimeAuth.ts'].authorize._handler(context,args);},runMutation:trap,runAction:trap,vectorSearch:trap};
 const args=argumentsFor(row,fixtureCtx);validate(native.rows.find(entry=>entry.path===row.path).args,args);let result,error;
 try{result=await modules[row.source][row.path.split(':')[1]]._handler(context,args);}catch(caught){error=caught;}
 assert.ok(authReads>0,'Native argument semantics must reach identity at '+row.path);assert.equal(effectTraps,0,row.path);authDenial(result,error);
 observations.push({path:row.path,authReached:true,effectTraps:0,authorityForwards,code:error.data.code});
}
assert.equal(observations.length,200);assert.equal(new Set(observations.map(row=>row.path)).size,200);
// Retain the exact original semantic failure: native shape valid, authority never reached.
const policyRow=rows.find(row=>row.path==='governance:setPolicy'),oldArgs=candidate(policyRow.validatorSchema,fixtureCtx);validate(native.rows.find(row=>row.path===policyRow.path).args,oldArgs);
let oldAuth=0,oldError;try{await modules[policyRow.source].setPolicy._handler({auth:{getUserIdentity:async()=>{oldAuth++;return null;}}},oldArgs);}catch(error){oldError=error;}
assert.equal(oldAuth,0);assert.deepEqual(oldError.data,{version:1,code:'INVALID_INPUT',message:'Access denied or invalid worker input',retryable:false,outcome:'not_dispatched'});assert.throws(()=>authDenial(undefined,oldError));
const fixedArgs=argumentsFor(policyRow,fixtureCtx),expected=structuredClone(oldArgs);expected.policy.conversations.retention.deleteAfter='30d';assert.deepEqual(fixedArgs,expected);
const healthy=loaded.memoryFixture();healthy.grant.capabilities.push('admin');healthy.db.table('runtimeAuthTombstones');const grantSnapshot=structuredClone(healthy.db.rows),beforeWrites=healthy.db.writes;
const healthyCtx={scopes:{tenantId:healthy.reference.tenantId,memorySpaceId:healthy.reference.memorySpaceId},snapshot:async()=>structuredClone(healthy.db.rows),call:async(identity,path,args)=>{assert.equal(identity,'reader');assert.equal(path,'governance:getTemplate');validate(native.rows.find(row=>row.path===path).args,args);return jsonToConvex(convexToJson(await modules['convex-dev/governance.ts'].getTemplate._handler(healthy.ctx,args)));}};
const control=await qualifyPolicyTemplate(healthyCtx);assert.equal(control.status,'PASS');assert.equal(control.noEffect,true);assert.equal(healthy.db.writes,beforeWrites);assert.deepEqual(healthy.db.rows,grantSnapshot);
const observationAlias='semantic-input-results-'+randomUUID()+'.json';writeFileSync(resolve(scratch,observationAlias),JSON.stringify({scope:'OFFLINE_ONLY',observations},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({scope:'OFFLINE_ACTUAL_NATIVE_SEMANTIC_INPUTS',status:'PASS',publicPaths:observations.length,authReached:200,effectTraps:0,authorityForwards:observations.reduce((n,row)=>n+row.authorityForwards,0),originalMalformedNativeShapeValid:true,originalMalformedCode:'INVALID_INPUT',originalMalformedAuthReads:0,originalMalformedNotAuth:true,minimalOnlyDurationChange:true,healthyScopedTemplate:'PASS',healthyWrites:0,serviceWire:'NOT_RUN',dispatches:0,signatures:0,observationAlias}));
