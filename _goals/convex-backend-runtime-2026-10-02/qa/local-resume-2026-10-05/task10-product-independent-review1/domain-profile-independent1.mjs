import assert from 'node:assert/strict';
import { DEFAULT_EMBEDDING_PROFILE as small, LARGE_EMBEDDING_PROFILE as large, assertEmbeddingVector, assertSupportedEmbeddingProfile, embeddingProfileForModel } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile.ts";
import { prepareSourceContent, isCurrentAuthorizedVector } from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/sources.ts";
const scope={tenantId:'review10-tenant',tenantEpoch:1,memorySpaceId:'review10-space',memorySpaceEpoch:1,principalId:'review10-reader',principalVersion:1,membershipId:'review10-membership',membershipVersion:1,grantId:'review10-grant',grantVersion:1};
const lineage={sourceId:'review10-source',sourceEventId:'review10-event',sourceRevision:1,role:'user',trust:'user_assertion'};
const results=[];
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(error){results.push({name,status:'FAIL',error:String(error)});}}
await check('logical source and chunk identities are independent of model generation',async()=>{
 const clock={now:()=>1700000000000};const text='  Caf\u00e9\r\n'+('evidence \ud83e\uddea '.repeat(170))+'tail  ';
 const a=await prepareSourceContent(scope,lineage,text,clock,small),b=await prepareSourceContent(scope,lineage,text,clock,large);
 assert.equal(a.chunks.length,b.chunks.length);assert.ok(a.chunks.length>1);assert.deepEqual(a.source,b.source);assert.deepEqual(a.chunks,b.chunks);
 assert.ok(a.chunks.every(c=>!Object.hasOwn(c,'profileId')&&c.normalization===small.normalization&&c.chunking===small.chunking));
});
await check('current vector positive and same-dimensional different-model denial',async()=>{
 const {source,chunks}=await prepareSourceContent(scope,lineage,'known review fixture',{now:()=>1700000000000},small);const chunk=chunks[0];
 const vector={sourceId:lineage.sourceId,sourceEventId:lineage.sourceEventId,sourceRevision:1,vectorId:'review10-vector',chunkId:chunk.chunkId,tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,profile:small,embedding:Array(small.dimensions).fill(0.125),processingReceiptId:'review10-receipt'};
 assert.equal(isCurrentAuthorizedVector(vector,source,chunk,scope,small),true);
 const incompatible={...small,modelId:large.modelId};assert.equal(incompatible.dimensions,small.dimensions);
 assert.throws(()=>isCurrentAuthorizedVector({...vector,profile:incompatible},source,chunk,scope,small),/PROFILE_NOT_READY/);
});
await check('dimension, nonfinite and sparse vectors cannot satisfy profile validation',async()=>{
 assertEmbeddingVector(Array(large.dimensions).fill(0.125),large);
 assert.throws(()=>assertEmbeddingVector(Array(small.dimensions).fill(0.125),large),/INVALID_INPUT/);
 const bad=Array(large.dimensions).fill(0.125);bad[123]=NaN;assert.throws(()=>assertEmbeddingVector(bad,large),/INVALID_INPUT/);
 const sparse=new Array(large.dimensions);assert.throws(()=>assertEmbeddingVector(sparse,large),/INVALID_INPUT/);
});
await check('unsupported model and undeclared index have explicit catalog denial',async()=>{
 assert.equal(embeddingProfileForModel(large.modelId),large);assertSupportedEmbeddingProfile(large);
 assert.throws(()=>embeddingProfileForModel('other/unknown-embedding'),/CAPABILITY_UNSUPPORTED/);
 assert.throws(()=>assertSupportedEmbeddingProfile({...large,indexName:'undeclared_index'}),/PROFILE_NOT_READY/);
});
console.log(JSON.stringify({scope:'DOMAIN_CODE_ONLY_NOT_MANAGED_RETRIEVAL',independentlyAuthoredControls:4,results,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,noServiceEffects:true},null,2));
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
