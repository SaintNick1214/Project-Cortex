/** Run once after the coherent Task13 installed candidate is verified. No inference. */
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,authorityReference,q} from './common.mjs';
const context=await openOwnedContext(),actors=[];
try{
 let prior=false;try{await access(join(q,'setup-scopes1.json'));prior=true;}catch(error){if(error.code!=='ENOENT')throw error;}
 assert.equal(prior,false,'Do not repeat a closed setup');
 await context.verifyTarget('setup-scopes1-target-verified');
 const expiresAt=Date.now()+7200000;
 const provision=async(name,subject,scope,resourceAccess,capabilities)=>{
  const value=await context.admin.mutation('runtimeAuth:provision',{issuer:context.auth.issuer,subject,actorKind:'user',...scope,resourceAccess,capabilities,expiresAt});
  const actor={name,subject,scope,resourceAccess,capabilities,reference:authorityReference(value)};actors.push(actor);await context.publish('setup-scopes1-'+name,actor);return actor;
 };
 const scope={tenantId:context.tenantId,memorySpaceId:context.memorySpaceId};
 const owner=await provision('owner',context.fixture.ownerSubject,scope,'own',['read','write','run','admin','storage:read','storage:write']);
 const reader=await provision('reader',context.fixture.readerSubject,scope,'own',['read','storage:read']);
 const foreign=await provision('foreign',context.fixture.foreignSubject,{tenantId:context.tenantId+'-foreign',memorySpaceId:context.memorySpaceId+'-foreign'},'own',['read','write','storage:read','storage:write']);
 const operator=await provision('operator',context.fixture.operatorSubject,scope,'space',['read','write','admin','storage:read','storage:write']);
 const space=await context.http(owner.subject).mutation('memorySpaces:register',{...scope,name:'Task13 owned media fixture',type:'project'});
 assert.equal(space.ownerPrincipalId,owner.reference.principalId);assert.equal(space.tenantId,context.tenantId);
 await context.publish('setup-scopes1',{status:'PASS',owner,reader,foreign,operator,expiresAt,space:{memorySpaceId:space.memorySpaceId,ownerPrincipalId:space.ownerPrincipalId},priorScopesChanged:false,modelCalls:0});
 console.log(JSON.stringify({status:'SCOPES_READY',projectId:context.state.projectId,modelCalls:0}));
}catch(error){await context.publish('setup-scopes1-failure',{status:'FAIL_OR_UNKNOWN',completedActors:actors.map(actor=>actor.name),error:context.publicError(error),noBlindRepeat:true});throw error;}finally{await context.close();}
