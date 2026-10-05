import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createContext, authDenial, opaqueInternalFailure } from './native-engine.mjs';
import { argumentsFor } from './argument-candidates.mjs';
import { qualifyAuthorityBoundaries } from './auth-boundaries.mjs';
import { seedClosureFixtures, closureArguments } from './closure-fixtures.mjs';
import { qualifyLifecycle } from './lifecycle.mjs';
import { preparation, scratch, appendRedactedReceipt, livePreflight } from './guard.mjs';
import { prepare as prepareMf } from '../cases/mf-registry-artifacts.mjs';
import { prepare as prepareMwd } from '../cases/metadata-worker-domain.mjs';
livePreflight(); // Reject before evidence writes or constructing clients.
const ledger=JSON.parse(readFileSync(resolve(preparation,'path-ledger.json')));
const recognized=error=>{try{const code=typeof error?.data==='string'?error.data:error?.data?.code;if(code==='INTERNAL_FAILURE')return opaqueInternalFailure(error)?code:undefined;return ['FORBIDDEN','UNAUTHENTICATED','CAPABILITY_NOT_READY','CAPABILITY_UNAVAILABLE','STALE_SOURCE','POLICY_NOT_CONFIGURED','MEMORY_NOT_FOUND','FACT_NOT_FOUND','INTERNAL_FAILURE'].includes(code)?code:undefined;}catch{return undefined;}};
const failureClass=error=>{try{if(opaqueInternalFailure(error))return 'opaque_internal_failure';if(error?.name==='AssertionError')return 'assertion';if(/ArgumentValidationError|Validator|invalid argument/i.test(error?.message??''))return 'validation';if(/Could not find.*function|not a public function/i.test(error?.message??''))return 'function_visibility_or_missing';if(/timeout|aborted/i.test(error?.message??''))return 'timeout_unknown_dispatch';if(recognized(error))return 'recognized_policy';return 'unknown_transport_or_infrastructure';}catch{return 'unknown_infrastructure';}};
const counts={discovered:259,public:200,internal:59,negativeCases:0,visibilityCases:0,closureCases:0,domainClosureCases:0,functionalCases:0,blocked:0,failed:0,skipped:0};
const journalPath=resolve(scratch,'case-journal-'+randomUUID()+'.jsonl');const journal=openSync(journalPath,'wx',0o600);let journalBytes=0;
function record(item){const row={observedAt:new Date().toISOString(),...item};const line=JSON.stringify(row)+'\n';journalBytes+=Buffer.byteLength(line);if(journalBytes>4000000)throw new Error('Case journal ceiling');writeSync(journal,line);fsyncSync(journal);evidence.push(row);}
const evidence=[],publicObserved=new Set(),internalObserved=new Set(),closureObserved=new Set();let activeCase;
let ctx,cleanupComplete=false,status;const start=Date.now();
try {
 ctx=await createContext();
 // Persist every imperative family/lifecycle RPC observation before its enclosing assertion completes.
 for(const method of ['call','operator']){const original=ctx[method];ctx[method]=async(...args)=>{const path=method==='call'?args[1]:args[0];const identityAlias=method==='call'?args[0]:'trustedOperator';const observedRpc=()=>activeCase&&(method==='call'||path.includes(':'));try{const result=await original(...args);if(observedRpc())record({id:activeCase.id+':rpc',paths:[path],phase:'rpc-observation',identityAlias,expectedCode:'ASSERTED_BY_ENCLOSING_CASE',observedCode:'SUCCESS',status:'OBSERVED',noEffect:false});return result;}catch(error){if(observedRpc())record({id:activeCase.id+':rpc',paths:[path],phase:'rpc-observation',identityAlias,expectedCode:'ASSERTED_BY_ENCLOSING_CASE',observedCode:recognized(error)??'UNRECOGNIZED',status:'OBSERVED',failureClass:failureClass(error),noEffect:false});throw error;}};}
 const suites=[await prepareMf(ctx),await prepareMwd(ctx)];
 // Actual storage ID enables validators; this is not an upload/delivery capability claim.
 await ctx.operator('storeTiny',{slot:'owned'});await ctx.operator('storeTiny',{slot:'foreign'});await seedClosureFixtures(ctx);
 const observed=new Set();
 // Run uniformly unavailable controls before family descriptors delete owned canonical rows.
 for(const row of ledger.cases.filter(row=>row.safeClosure)) {
  for(const mode of row.group==='stats'?['owned']:['owned','foreign','ownerless','missing']){
  activeCase={id:'closure:'+mode+':'+row.path,paths:[row.path],phase:'uniform-unavailability',identityAlias:row.visibility==='internal'?'trustedOperator':'reader',expectedCode:row.group==='assets'?'CAPABILITY_UNAVAILABLE':'CAPABILITY_NOT_READY'};
  const args=closureArguments(argumentsFor(row,ctx),ctx,mode),before=await ctx.snapshot();let result,error;
  try{result= row.visibility==='internal'?await ctx.operator(row.path,args):await ctx.call('reader',row.path,args);}catch(caught){error=caught;}
  assert.equal(result,undefined);assert.ok(error);const code=typeof error.data==='string'?error.data:error.data?.code;
  assert.ok(['CAPABILITY_NOT_READY','CAPABILITY_UNAVAILABLE'].includes(code),'Require exact authorized safe unavailability');
  if(code==='CAPABILITY_NOT_READY')assert.deepEqual(error.data,{version:1,code:'CAPABILITY_NOT_READY',message:'Access denied or invalid registry input',retryable:false,outcome:'not_dispatched'});
  if(code==='CAPABILITY_UNAVAILABLE')assert.deepEqual(error.data,{version:1,code:'CAPABILITY_UNAVAILABLE',message:'Asset capability unavailable.',retryable:false,outcome:'not_dispatched'});
  assert.deepEqual(await ctx.snapshot(),before);counts.closureCases++;closureObserved.add(row.path);record({...activeCase,observedCode:code,status:'PASS',noEffect:true});
  }
 }
 // Every public registration uses exact native validators; no function-not-found or validation error counts as authorization.
 for(const row of ledger.cases.filter(row=>row.visibility==='public')) {
  const args=argumentsFor(row,ctx),before=await ctx.snapshot();
  for(const identity of ['noJWT','forgedJWT','wrongIssuer','wrongAudience','expiredJWT','ungranted','foreign']) {
   activeCase={id:'negative:'+identity+':'+row.path,paths:[row.path],phase:'authorization',identityAlias:identity,expectedCode:'FORBIDDEN_OR_UNAUTHENTICATED'};
   let result,error;try{result=await ctx.call(identity,row.path,args);}catch(caught){error=caught;}authDenial(result,error);counts.negativeCases++;record({...activeCase,observedCode:recognized(error)??'PLATFORM_UNAUTHENTICATED',status:'PASS',noEffect:false});
  }
  assert.deepEqual(await ctx.snapshot(),before);publicObserved.add(row.path);record({id:'negative-effects:'+row.path,paths:[row.path],phase:'authorization-effect-snapshot',identityAlias:'allSevenNegatives',expectedCode:'NO_EFFECT',observedCode:'NO_EFFECT',status:'PASS',noEffect:true});for(const item of evidence.filter(item=>item.phase==='authorization'&&item.paths[0]===row.path))item.noEffect=true;
 }
 // Internal visibility denial is distinct from public authorization denial.
 for(const row of ledger.cases.filter(row=>row.visibility==='internal'))for(const identity of ['noJWT','reader']){
  activeCase={id:'visibility:'+identity+':'+row.path,paths:[row.path],phase:'internal-visibility',identityAlias:identity,expectedCode:'INTERNAL_ONLY'};
  const args=argumentsFor(row,ctx);let result,error;try{result=await ctx.call(identity,row.path,args);}catch(caught){error=caught;}
  assert.equal(result,undefined);assert.ok(error);assert.match(error.message,/Could not find public function|internal function|not a public function/i);assert.doesNotMatch(error.message,/ArgumentValidationError|Validator|invalid argument/i);counts.visibilityCases++;internalObserved.add(row.path);record({...activeCase,observedCode:'INTERNAL_ONLY',status:'PASS',noEffect:true});
 }
 for(const suite of suites)for(const item of suite.cases){
  activeCase={id:item.id,paths:item.paths??[item.path],phase:'functional-family',identityAlias:item.identity??'multipleAliasScenario',expectedCode:'ASSERTED_OWNED_OUTCOME'};
  const before=item.effects==='unchanged'?await ctx.snapshot():undefined;
  if(item.run){const observedResult=await item.run(ctx);if(observedResult?.domainClosureCases!==undefined){assert.equal(observedResult.domainClosureCases,10);assert.deepEqual(observedResult.domainClosurePaths.sort(),['runtimeMemory:recall','runtimeMemory:remember']);counts.domainClosureCases+=observedResult.domainClosureCases;}}
  else{let result,error;try{result=await ctx.call(item.identity,item.path,item.args);}catch(caught){error=caught;}await item.assert(result,error);}
  await ctx.discoverOwnedEffects();if(before)assert.deepEqual(await ctx.snapshot(),before);
  for(const path of item.paths??[item.path])observed.add(path);counts.functionalCases++;record({...activeCase,observedCode:'ASSERTED_OWNED_OUTCOME',status:'PASS',noEffect:item.effects==='unchanged'});
 }
 assert.equal(counts.domainClosureCases,10);assert.equal(counts.negativeCases,1400);assert.equal(counts.visibilityCases,118);assert.equal(counts.closureCases,262);assert.equal(publicObserved.size,200);assert.equal(internalObserved.size,59);assert.equal(closureObserved.size,67);counts.observedPublicPaths=publicObserved.size;counts.observedInternalPaths=internalObserved.size;
 activeCase={id:'authority-boundaries',paths:['mutable:get','mutable:set','runtimeAuth:revokeMembership','runtimeAuth:deleteScope'],phase:'authority-boundaries'};
 for(const id of await qualifyAuthorityBoundaries(ctx))record({id,paths:activeCase.paths,phase:'authority-boundaries',status:'PASS',noEffect:true});
 // Required real subscription/refresh/background obligations are supplied by a separately reviewed bridge module.
 // Do not convert their absence into PASS, even if all direct native RPC cases pass.
 const lifecycle=JSON.parse(readFileSync(resolve(preparation,'lifecycle-coverage.json')));
 activeCase={id:'current-sdk-lifecycle',paths:['mutable:get','mutable:set','runtimeAuth:revokeGrant'],phase:'lifecycle'};
 const liveLifecycle=await qualifyLifecycle(ctx);for(const id of liveLifecycle)record({id,paths:activeCase.paths,phase:'lifecycle',status:'PASS'});
 if(lifecycle.requiredFoundationCases.some(row=>!liveLifecycle.includes(row.id))){counts.blocked++;status='BLOCKED';}
 else status=ctx.stats().unknownDispatch?'FAIL':'PASS';
} catch(error) {counts.failed++;status='FAIL';if(activeCase)record({...activeCase,status:'FAIL',failureClass:failureClass(error),observedCode:recognized(error)??'UNRECOGNIZED',noEffect:false});}
finally {if(ctx){try{cleanupComplete=await ctx.finish();}catch{cleanupComplete=false;}if(!cleanupComplete||ctx.stats().unknownDispatch)status='FAIL';}}
record({id:'qualification-final',paths:[],phase:'terminal',status,cleanupComplete});closeSync(journal);
writeFileSync(resolve(scratch,'case-outcomes-'+randomUUID()+'.json'),JSON.stringify({scope:'CURRENT_NATIVE_LIVE',observedAt:new Date().toISOString(),argv:[process.execPath,process.argv[1]],status,evidence},null,2)+'\n',{flag:'wx',mode:0o600});
appendRedactedReceipt('qualify-'+randomUUID()+'.json',{phase:'current-foundation-native-live',status,counts,elapsedMs:Date.now()-start,cleanupComplete});
process.stdout.write(JSON.stringify({status,counts,cleanupComplete})+'\n');process.exitCode=status==='PASS'?0:1;
