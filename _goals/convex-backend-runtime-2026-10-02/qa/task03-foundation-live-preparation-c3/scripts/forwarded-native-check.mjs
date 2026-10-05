/** Offline serialized native seam qualification; no credentials, signing or services. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ConvexError, convexToJson } from 'convex/values';
import { getFunctionName } from 'convex/server';
import { repo, sourcePreflight } from './guard.mjs';
import { validate } from './offline-arguments-check.mjs';
import { authDenial } from './native-engine.mjs';
sourcePreflight();
const { memoryFixture, registeredHandler }=await import(pathToFileURL(resolve(repo,'tests/unit/runtimeMemory/fixture.ts')));
const registrations=await import(pathToFileURL(resolve(repo,'convex-dev/runtimeMemory.ts')));
const { authorize }=await import(pathToFileURL(resolve(repo,'convex-dev/runtimeAuth.ts')));
const schema=JSON.parse(registrations.checkAuthority.exportArgs());
const readiness={version:1,code:'CAPABILITY_UNAVAILABLE',message:'Memory capability unavailable.',retryable:false,outcome:'not_dispatched'};
const opaque={version:1,code:'INTERNAL_FAILURE',message:'Memory control failed.',retryable:false,outcome:'not_dispatched'};
const rows=[];
function prohibitBusinessQueries(fixture){let queries=0;const original=fixture.db.query.bind(fixture.db);fixture.db.query=table=>{if(['facts','runtimeMemorySources','runtimeMemoryVectors','runtimeMemoryChunks'].includes(table))queries++;return original(table);};return ()=>queries;}
for(const name of ['remember','recall']){
 const fixture=memoryFixture(),privateQueries=prohibitBusinessQueries(fixture),original=fixture.actionCtx.runQuery.bind(fixture.actionCtx);let captured;
 fixture.actionCtx.runQuery=async(ref,input)=>{const path=getFunctionName(ref),wire=convexToJson(input);const native=path==='runtimeAuth:authorize'?authorize:path==='runtimeMemory:checkAuthority'?registrations.checkAuthority:undefined;assert.ok(native,'Unexpected foreground internal call');validate(JSON.parse(native.exportArgs()),wire);if(path==='runtimeMemory:checkAuthority')captured=wire;return await original(ref,input);};
 const args={tenantId:'tenant-a',memorySpaceId:'space-a',requestId:'native-forwarded-shape',text:'private controlled source'};
 validate(JSON.parse(registrations[name].exportArgs()),convexToJson(args));let error;try{await registeredHandler(registrations[name])(fixture.actionCtx,args);}catch(caught){error=caught;}
 assert.deepEqual(error?.data,readiness);assert.ok(captured);assert.equal(Object.keys(captured.reference).length,10);assert.equal(privateQueries(),0);assert.equal(fixture.db.writes,0);assert.equal(fixture.db.table('runtimeMemorySources').length,0);
 for(const field of ['actorKind','userId','capabilities','resourceAccess'])assert.throws(()=>validate(schema,{...captured,reference:{...captured.reference,[field]:field==='capabilities'?['read']:field}}));
 rows.push({path:'runtimeMemory:'+name,forwardedReferenceFields:10,nativeSchemaAccepted:true,noBusinessWrites:true,noPrivateHydration:true,extraFieldNegatives:4});
}
let faults=0;
for(const name of ['remember','recall'])for(const location of ['runtimeAuth:authorize','runtimeMemory:checkAuthority']){
 const fixture=memoryFixture(),privateQueries=prohibitBusinessQueries(fixture),original=fixture.actionCtx.runQuery.bind(fixture.actionCtx);let reached=false;
 fixture.actionCtx.runQuery=async(ref,input)=>{const path=getFunctionName(ref);validate(JSON.parse((path==='runtimeAuth:authorize'?authorize:registrations.checkAuthority).exportArgs()),convexToJson(input));if(path===location){reached=true;throw new ConvexError({code:'UNKNOWN_BACKEND_FAILURE',message:'FIXTURE_PRIVATE_DIAGNOSTIC',privateControl:'FIXTURE_PRIVATE_CONTROL'});}return await original(ref,input);};
 let error;try{await registeredHandler(registrations[name])(fixture.actionCtx,{tenantId:'tenant-a',memorySpaceId:'space-a',requestId:'opaque-forwarded-fault',text:'controlled private text'});}catch(caught){error=caught;}
 assert.equal(reached,true);assert.deepEqual(error?.data,opaque);assert.equal(error.message,JSON.stringify(opaque));assert.throws(()=>authDenial(undefined,error));assert.equal(privateQueries(),0);assert.equal(fixture.db.writes,0);assert.equal(fixture.db.table('runtimeMemorySources').length,0);faults++;
}
let knownDenials=0;
for(const name of ['remember','recall'])for(const location of ['runtimeAuth:authorize','runtimeMemory:checkAuthority']){
 const fixture=memoryFixture(),privateQueries=prohibitBusinessQueries(fixture),original=fixture.actionCtx.runQuery.bind(fixture.actionCtx);let reached=false;
 const fixed={version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'};
 fixture.actionCtx.runQuery=async(ref,input)=>{const path=getFunctionName(ref);validate(JSON.parse((path==='runtimeAuth:authorize'?authorize:registrations.checkAuthority).exportArgs()),convexToJson(input));if(path===location){reached=true;throw new ConvexError(fixed);}return await original(ref,input);};
 let result,error;try{result=await registeredHandler(registrations[name])(fixture.actionCtx,{tenantId:'tenant-a',memorySpaceId:'space-a',requestId:'known-fixed-denial',text:'controlled private text'});}catch(caught){error=caught;}
 assert.equal(reached,true);assert.deepEqual(error?.data,fixed);authDenial(result,error);assert.equal(privateQueries(),0);assert.equal(fixture.db.writes,0);knownDenials++;
}
console.log(JSON.stringify({scope:'OFFLINE_ACTUAL_SERIALIZED_FOREGROUND_CONTROL',status:'PASS',healthyCases:rows,unknownForwardedControls:faults,knownFixedDenialControls:knownDenials,extraFieldNegatives:8,handlerOnlyBypass:false,serviceCalls:0,signatures:0,live:'NOT_RUN'}));
