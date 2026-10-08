import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createContext,authDenial} from './native-engine.mjs';
import {preparation} from './runtime-config.mjs';
const records=[],snapshots=[];let ctx,cleanupComplete=false,failure;
function record(id,details={}){records.push({id,status:'PASS',...details});console.log(JSON.stringify({stage:'case',id,status:'PASS'}));}
async function negative(id,identity,endpoint,args,expected){
 const before=await ctx.snapshot();let result,error;try{result=await ctx.call(identity,endpoint,args);}catch(e){error=e;}
 try{if(expected){assert.equal(result,undefined);assert.ok(error);assert.deepEqual(error.data,expected);}else authDenial(result,error);}catch(e){ctx.diagnoseAuthFailure(result,error);throw e;}
 const after=await ctx.snapshot();assert.deepEqual(after,before);snapshots.push({id,before,after,equal:true});record(id,{identity,endpoint,observedEnvelope:error.data??{platform:'INVALID_AUTH'},noEffect:true});
}
try{
 ctx=await createContext();const scope={tenantId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId};
 const memory=await ctx.call('reader','memories:store',{...scope,content:'functionalneedle owned '+ctx.run,contentType:'raw',sourceType:'system',importance:50,tags:[]});
 assert.ok(memory.memoryId);assert.equal(memory.ownerPrincipalId,ctx.principals.reader);assert.ok(memory.lineage.sourceId);record('memory-store-canonical-provenance');
 const foreignMemory=await ctx.call('foreign','memories:store',{tenantId:ctx.scopes.foreignTenantId,memorySpaceId:ctx.scopes.foreignMemorySpaceId,content:'functionalneedle foreign '+ctx.run,contentType:'raw',sourceType:'system',importance:50,tags:[]});assert.ok(foreignMemory.memoryId);record('foreign-owned-memory-fixture');
 const searchArgs={memorySpaceId:scope.memorySpaceId,query:'functionalneedle',limit:10};
 const hits=await ctx.call('reader','memories:search',searchArgs);assert.equal(hits.length,1);assert.equal(hits[0].memoryId,memory.memoryId);assert.equal(hits[0].content,memory.content);assert.equal(hits[0].ownerPrincipalId,ctx.principals.reader);record('memory-search-owned-positive',{matchedOwnedRows:1,foreignRows:0});
 await negative('memory-search-foreign-denial','foreign','memories:search',searchArgs);
 await negative('memory-search-noJWT-denial','noJWT','memories:search',searchArgs);
 const factArgs={...scope,fact:'Functional fact '+ctx.run,factType:'knowledge',confidence:91,sourceType:'manual',tags:[]};
 const fact=await ctx.call('reader','facts:store',factArgs);assert.ok(fact.factId);assert.equal(fact.ownerPrincipalId,ctx.principals.reader);assert.equal(fact.extractionPolicyVersion,'manual-assertion-v1');assert.ok(fact.lineage.sourceId);assert.equal(fact.lineage.trust,'user_assertion');
 const factRead=await ctx.call('reader','facts:get',{memorySpaceId:scope.memorySpaceId,factId:fact.factId});assert.equal(factRead.fact,factArgs.fact);assert.equal(factRead.lineage.sourceId,fact.lineage.sourceId);record('facts-store-get-canonical-provenance');
 await negative('facts-readonly-no-write','readOnly','facts:store',factArgs);
 const registered=await ctx.call('reader','memorySpaces:register',{...scope,type:'personal',name:'Functional fixture space'});assert.equal(registered.memorySpaceId,scope.memorySpaceId);
 assert.equal((await ctx.call('reader','memorySpaces:get',scope)).ownerPrincipalId,ctx.principals.reader);record('registry-memorySpace-register-get');
 await negative('registry-foreign-tenant','foreign','memorySpaces:get',scope);
 await negative('registry-readonly-no-admin-write','readOnly','memorySpaces:update',{...scope,name:'Not permitted'});
 const context=await ctx.call('reader','contexts:create',{...scope,purpose:'Functional owned context'});assert.ok(context.contextId);assert.equal((await ctx.call('reader','contexts:get',{...scope,contextId:context.contextId})).purpose,'Functional owned context');record('registry-context-create-get');
 await negative('context-foreign-no-write','foreign','contexts:update',{...scope,contextId:context.contextId,description:'Not permitted'});
 const artifact=await ctx.call('reader','artifacts:create',{...scope,kind:'text',content:'Functional manual text',artifactId:ctx.run+':artifact'});assert.equal(artifact.ownerPrincipalId,ctx.principals.reader);
 const artifactRead=await ctx.call('reader','artifacts:get',{...scope,artifactId:artifact.artifactId});assert.equal(artifactRead.content,'Functional manual text');record('manual-text-artifact-create-get');
 await negative('artifact-readonly-no-write','readOnly','artifacts:create',{...scope,content:'Not permitted',artifactId:ctx.run+':denied-artifact'});
 const governance={template:'GDPR',tenantId:scope.tenantId,scope:{organizationId:scope.tenantId,memorySpaceId:scope.memorySpaceId}};
 const template=await ctx.call('admin','governance:getTemplate',governance);assert.equal(template.compliance.mode,'GDPR');assert.equal(template.organizationId,scope.tenantId);assert.equal(template.memorySpaceId,scope.memorySpaceId);record('governance-admin-scoped-template');
 await negative('governance-nonadmin-denial','readOnly','governance:getTemplate',governance);
 const memoryUnavailable={version:1,code:'CAPABILITY_UNAVAILABLE',message:'Memory capability unavailable.',retryable:false,outcome:'not_dispatched'};
 for(const action of ['remember','recall'])await negative('healthy-memory-'+action+'-readiness','reader','runtimeMemory:'+action,{...scope,text:'Safety closure only',requestId:ctx.run+':'+action},memoryUnavailable);
 const ready={version:1,code:'CAPABILITY_NOT_READY',message:'Access denied or invalid registry input',retryable:false,outcome:'not_dispatched'};
 await negative('healthy-conversation-readiness','reader','conversations:get',{...scope,conversationId:ctx.run+':conversation'},ready);
 const assetArgs={...scope,attachmentId:ctx.run+':attachment'};
 await negative('healthy-asset-readiness','reader','attachments:get',assetArgs,{version:1,code:'CAPABILITY_UNAVAILABLE',message:'Asset capability unavailable.',retryable:false,outcome:'not_dispatched'});
 await negative('asset-readonly-no-storage-capability','readOnly','attachments:get',assetArgs);
 await negative('healthy-registry-stats-readiness','reader','memorySpaces:getStats',scope,ready);
 await ctx.operator('runtimeAuth:revokeGrant',{grantId:ctx.grants.reader});await negative('memory-search-revocation-no-effect','reader','memories:search',searchArgs);
}catch(error){failure={name:error?.name??'Error',message:String(error?.message??error).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED_JWT]'),code:error?.data?.code};}
finally{
 if(ctx){try{cleanupComplete=await ctx.finish();}catch(error){failure??={name:error.name,message:'Owned fixture cleanup failed'};}}
 fs.writeFileSync(path.join(preparation,'persisted-snapshots.json'),JSON.stringify(snapshots,null,2)+'\n');
 fs.writeFileSync(path.join(preparation,'native-smoke-results.json'),JSON.stringify({status:!failure&&cleanupComplete?'PASS':'FAIL',records,snapshotCount:snapshots.length,cleanupComplete,failure,stats:ctx?.stats(),coverage:'focused current-family actual03-foundation; readiness closures are safety only; no paid inference or fullTask03 acceptance'},null,2)+'\n');
}
console.log(JSON.stringify({stage:'finished',status:!failure&&cleanupComplete?'PASS':'FAIL',conditions:records.length,cleanupComplete,failure}));if(failure||!cleanupComplete)process.exitCode=1;
