import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createContext,authDenial} from './native-engine.mjs';
import {qualifyLifecycle} from './lifecycle.mjs';
import {preparation} from './runtime-config.mjs';
const records=[],snapshots=[];let ctx,cleanupComplete=false,failure;
function record(id,details={}){records.push({id,status:'PASS',...details});console.log(JSON.stringify({stage:'case',id,status:'PASS'}));}
async function deny(id,identity,endpoint,args){
 const before=await ctx.snapshot();let result,error;try{result=await ctx.call(identity,endpoint,args);}catch(e){error=e;}
 try{authDenial(result,error);}catch(e){ctx.diagnoseAuthFailure(result,error);throw e;}
 const after=await ctx.snapshot();assert.deepEqual(after,before);snapshots.push({id,before,after,equal:true});record(id,{identity,endpoint,denial:error.data?.code??'PLATFORM_INVALID_AUTH',noEffect:true});
}
try{
 ctx=await createContext();
 const args={tenantId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId,namespace:ctx.run+':smoke',key:ctx.run+':key'};
 await ctx.call('reader','mutable:set',{...args,value:41});assert.equal((await ctx.call('reader','mutable:get',args)).value,41);record('authenticated-mutable-41');
 await ctx.call('reader','mutable:set',{...args,value:42});assert.equal((await ctx.call('reader','mutable:get',args)).value,42);record('authenticated-mutable-42');
 for(const identity of ['noJWT','forgedJWT','wrongIssuer','wrongAudience','expiredJWT','ungranted','foreign','claimsOnly','revoked','deleted']){
  await deny(identity+'-read',identity,'mutable:get',args);await deny(identity+'-write',identity,'mutable:set',{...args,value:900});
 }
 await deny('mismatched-tenant','reader','mutable:set',{...args,tenantId:ctx.scopes.foreignTenantId,value:900});
 await deny('unauthorized-space','reader','mutable:set',{...args,memorySpaceId:ctx.scopes.writerMemorySpaceId,value:900});
 const scope={tenantId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId};
 const families=[
  ['memories:get',{...scope,memoryId:ctx.run+':missing'}],['facts:get',{...scope,factId:ctx.run+':missing'}],
  ['conversations:get',{...scope,conversationId:ctx.run+':missing'}],['memorySpaces:get',{...scope}],
  ['artifacts:get',{...scope,artifactId:ctx.run+':missing'}],['attachments:get',{...scope,attachmentId:ctx.run+':missing'}],
  ['runtimeMemory:remember',{...scope,text:'No paid inference permitted',requestId:ctx.run+':remember'}],
  ['immutable:get',{...scope,type:'user',id:ctx.users.reader}],
 ];
 for(const [endpoint,input] of families)await deny('family-noJWT-'+endpoint,'noJWT',endpoint,input);
 for(const endpoint of ['runtimeAuth:authorize','admin:deleteRecord']){
  const input=endpoint==='runtimeAuth:authorize'?{requirement:{capability:'read',...scope}}:endpoint==='qualificationOwned:seed'?{run:ctx.run,rows:[]}:{table:'mutable',id:ctx.refs.find(r=>r.table==='mutable').id};
  for(const identity of ['noJWT','reader']){const before=await ctx.snapshot();let result,error;try{result=await ctx.call(identity,endpoint,input);}catch(e){error=e;}assert.equal(result,undefined);assert.ok(error);assert.match(error.message,/Could not find public function|internal function|not a public function/i);assert.doesNotMatch(error.message,/ArgumentValidationError|Validator|invalid argument/i);const after=await ctx.snapshot();assert.deepEqual(after,before);snapshots.push({id:'internal-'+identity+'-'+endpoint,before,after,equal:true});record('internal-'+identity+'-'+endpoint,{internalOnly:true,noEffect:true});}
 }
 const lifecycle=await qualifyLifecycle(ctx);assert.equal(lifecycle.length,6);for(const id of lifecycle)record(id,{actualSDK:true});
 const before=await ctx.snapshot();let e;try{await ctx.call('reader','mutable:set',{...args,value:43});}catch(error){e=error;}authDenial(undefined,e);assert.deepEqual(await ctx.snapshot(),before);record('revoked-original-key-write-no-effect');
}catch(error){failure={name:error?.name??'Error',message:String(error?.message??error).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED_JWT]'),code:error?.data?.code};}
finally{
 if(ctx){try{cleanupComplete=await ctx.finish();}catch(error){failure??={name:error.name,message:'Owned fixture cleanup failed'};}}
 fs.writeFileSync(path.join(preparation,'persisted-snapshots.json'),JSON.stringify(snapshots,null,2)+'\n');
 fs.writeFileSync(path.join(preparation,'native-smoke-results.json'),JSON.stringify({status:!failure&&cleanupComplete?'PASS':'FAIL',records,snapshotCount:snapshots.length,cleanupComplete,failure,stats:ctx?.stats(),coverage:'focused actual03-foundation; Task02 model remains unavailable; fullTask03 criteria open'},null,2)+'\n');
}
console.log(JSON.stringify({stage:'finished',status:!failure&&cleanupComplete?'PASS':'FAIL',conditions:records.length,cleanupComplete,failure}));
if(failure||!cleanupComplete)process.exitCode=1;
