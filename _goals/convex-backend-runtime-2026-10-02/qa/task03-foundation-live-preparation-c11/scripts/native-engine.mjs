import assert from 'node:assert/strict';
import { createWireDiagnostics, boundedWireBody } from './wire-diagnostics.mjs';
import { isDeepStrictEqual } from 'node:util';
import { ConvexHttpClient, ConvexClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { readFileSync, writeFileSync, renameSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPrivateKey, createPublicKey, createSign, randomUUID } from 'node:crypto';
import { livePreflight, verifyCodegen, fixture, repo, scratch, preparation, canonical } from './guard.mjs';
import { configureReactiveTransport } from './reactive-transport.mjs';
export const limits=Object.freeze({calls:10000,callTimeoutMs:12000,runTimeoutMs:1200000,subjects:16,totalRows:320,storageFiles:2,storageBytes:64,cleanupAttempts:2});
const platformWireMessages=new Set();
export function rememberPlatformWire(status,body){
 platformWireMessages.clear();
 if(![400,401,403].includes(status)||typeof body!=='string')return false;
 try{const parsed=JSON.parse(body);if(!parsed||typeof parsed!=='object'||!(['InvalidAuth','Unauthenticated'].includes(parsed.code)||(status===401&&['InvalidAuthHeader','NoAuthProvider'].includes(parsed.code)))||typeof parsed.message!=='string'||Object.keys(parsed).some(key=>!['code','message'].includes(key)))return false;
 if(/ArgumentValidationError|Could not find.*function|Server Error|Uncaught/i.test(parsed.message))return false;platformWireMessages.add(body);return true;
 }catch{return false;}
}
export function authDenial(result,error) {
 assert.equal(result,undefined);assert.ok(error);
 const envelopes=[
  {version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'},
  {version:1,code:'UNAUTHENTICATED',message:'Verified identity required',retryable:false,outcome:'not_dispatched'},
  ...['FORBIDDEN','UNAUTHENTICATED'].flatMap(code=>['not_dispatched','rolled_back'].map(outcome=>({version:1,code,message:'Access denied or invalid registry input',retryable:false,outcome}))),
  {version:1,code:'FORBIDDEN',message:'Access denied or invalid worker input',retryable:false,outcome:'not_dispatched'},
  ...['A concrete authorized memory space is required','A write-authorized mutation is required','Source was deleted','Resolution candidate was deleted','Fact has no current runtime owner'].map(message=>({version:1,code:'FORBIDDEN',message,retryable:false,outcome:'not_dispatched'})),
  {code:'FORBIDDEN',message:'Access denied'},
  ...['FORBIDDEN','UNAUTHENTICATED'].map(code=>({code,message:'Artifact operation denied.'})),
 ];
 const native=envelopes.some(envelope=>isDeepStrictEqual(error.data,envelope));
 const platform=error instanceof Error && platformWireMessages.has(error.message);
 assert.ok(native||platform,'Exact native policy or observed supported platform HTTP wire denial required');
}
export function opaqueInternalFailure(error){return isDeepStrictEqual(error?.data,{version:1,code:'INTERNAL_FAILURE',message:'Memory control failed.',retryable:false,outcome:'not_dispatched'});}
export async function createContext() {
 const {target,values}=livePreflight();
 verifyCodegen(target);
 const keyPath=canonical(resolve(repo,'work/backend-runtime/qualification/jwt-private.pem'),repo,true);
 const privateKey=createPrivateKey(readFileSync(keyPath));const publicJwk=createPublicKey(privateKey).export({format:'jwk'});
 const config=readFileSync(resolve(fixture,'fixture/convex/auth.config.ts'),'utf8');
 const jwks=JSON.parse(Buffer.from(config.match(/base64,([A-Za-z0-9+/=]+)/)[1],'base64'));
 assert.equal(jwks.keys[0].n,publicJwk.n);assert.equal(jwks.keys[0].e,publicJwk.e);
 const diagnostics=createWireDiagnostics(scratch,target.deploymentUrl);diagnostics.addSecret(values.CONVEX_DEPLOY_KEY);
 const run='foundation-'+randomUUID().replaceAll('-','');const issuer='https://cortex-qualification.invalid';
 let calls=0;const deadline=Date.now()+limits.runTimeoutMs;const aborters=new Set();let cleanupMode=false;let cleanupDeadline=0;let unknownDispatch=false;
 async function bounded(operation){if(++calls>(cleanupMode?limits.calls:limits.calls-128)||Date.now()>=(cleanupMode?cleanupDeadline:deadline))throw new Error('Qualification budget exhausted');let timer;
  try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>{unknownDispatch=true;reject(new Error('Qualification call timeout'));},Math.min(limits.callTimeoutMs,(cleanupMode?cleanupDeadline:deadline)-Date.now()));})]);}finally{clearTimeout(timer);}}
 function token(subject,patch={}){const now=Math.floor(Date.now()/1000);const head=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:jwks.keys[0].kid})).toString('base64url');const body=Buffer.from(JSON.stringify({iss:issuer,aud:'cortex-task01',sub:subject,iat:now,exp:now+900,...patch})).toString('base64url');const payload=head+'.'+body;const signed=payload+'.'+createSign('RSA-SHA256').update(payload).sign(privateKey,'base64url');diagnostics.addSecret(signed);return signed;}
 const nativeFetch=async(url,options)=>{platformWireMessages.clear();const parsed=new URL(typeof url==='string'?url:url.url);if(parsed.origin!==target.deploymentUrl)throw new Error('HTTP origin rejected');const controller=new AbortController();aborters.add(controller);const timer=setTimeout(()=>{unknownDispatch=true;controller.abort();},limits.callTimeoutMs);try{const response=await globalThis.fetch(url,{...options,redirect:'error',signal:controller.signal});if(!response.ok){platformWireMessages.clear();const wire=await boundedWireBody(response);diagnostics.wire(response.status,parsed.origin,wire.body,wire.byteCount,wire.truncated);if(!wire.truncated)rememberPlatformWire(response.status,wire.body);}return response;}finally{clearTimeout(timer);aborters.delete(controller);}};
 const ledger=JSON.parse(readFileSync(resolve(preparation,'path-ledger.json')));const kindByPath=Object.fromEntries(ledger.cases.map(row=>[row.path,row.kind]));
 const adminClient=new ConvexHttpClient(target.deploymentUrl,{logger:false,fetch:nativeFetch});adminClient.setAdminAuth(values.CONVEX_DEPLOY_KEY);
 // Official deployed function metadata proves actual publication and visibility before target writes.
 const published=await bounded(()=>adminClient.query(makeFunctionReference('_system/cli/modules:apiSpec'),{}));
 assert.ok(Array.isArray(published));assert.ok(published.every(fn=>fn.functionType!=='HttpAction'),'Unexpected HTTP registration');
 const deployed=new Map(published.map(fn=>[fn.identifier.replace(/\.js:/,':'),fn]));assert.equal(deployed.size,published.length,'Published alias/duplicate rejected');
 for(const row of ledger.cases){const fn=deployed.get(row.path);assert.ok(fn,'Actual current path not published');assert.equal(String(fn.functionType).toLowerCase(),row.kind);assert.equal(fn.visibility?.kind??fn.visibility,row.visibility);}
 const refs=[],files=[],clients={},identities={},principals={},grants={},references={},users={};const reactive=[];
 const scopes={tenantId:run+':tenantA',memorySpaceId:run+':spaceA',writerMemorySpaceId:run+':spaceWriter',foreignTenantId:run+':tenantB',foreignMemorySpaceId:run+':spaceB'};
 const fixtureKinds={seed:'mutation',snapshot:'query',cleanup:'mutation',ownedTombstones:'query',discoverOwnedEffects:'query',storageSnapshot:'query',storageCatalog:'query',registerStorage:'mutation',storeTiny:'action',cleanupStorage:'mutation'};
 for(const [name,kind] of Object.entries(fixtureKinds)){const fn=deployed.get('qualificationOwned:'+name);assert.ok(fn,'Fixture operator not published');assert.equal(String(fn.functionType).toLowerCase(),kind);assert.equal(fn.visibility?.kind??fn.visibility,'internal');}
 assert.deepEqual([...deployed.keys()].sort(),[...ledger.cases.map(row=>row.path),...Object.keys(fixtureKinds).map(name=>'qualificationOwned:'+name)].sort(),'Unexpected published path');
 const allowedInternal=new Set([...ledger.cases.filter(row=>row.visibility==='internal'&&row.safeClosure).map(row=>row.path),'runtimeAuth:recheck','runtimeAuth:revokeGrant','runtimeAuth:revokeMembership','runtimeAuth:deletePrincipal','runtimeAuth:deleteScope','runtimeAuth:tombstoneResource','sessions:incrementMessageCount','sessions:incrementMemoryCount','sessions:expireIdle','governance:enforce','admin:deleteRecord',...ledger.cases.filter(row=>row.visibility==='internal'&&['runtimeMemory','graphSync'].includes(row.path.split(':')[0])).map(row=>row.path)]);
 const ownershipPath=resolve(scratch,'owned-'+run+'.json'),ownershipJournal=resolve(scratch,'owned-journal-'+run+'.jsonl');writeFileSync(ownershipPath,JSON.stringify({run,refs,files}),{flag:'wx',mode:0o600});writeFileSync(ownershipJournal,JSON.stringify({run,stage:'BEGIN',refs:[],files:[]})+'\n',{flag:'wx',mode:0o600});
 function track(newRefs){for(const ref of newRefs){assert.ok(ref&&typeof ref.id==='string');if(!refs.some(r=>r.table===ref.table&&r.id===ref.id))refs.push(ref);}if(refs.length>limits.totalRows)throw new Error('Owned row ceiling exceeded');canonical(ownershipJournal,scratch,true);appendFileSync(ownershipJournal,JSON.stringify({run,stage:'OWNED_REFS',refs,files})+'\n');const temporary=ownershipPath+'.'+randomUUID()+'.tmp';writeFileSync(temporary,JSON.stringify({run,refs,files}),{flag:'wx',mode:0o600});canonical(ownershipPath,scratch,true);renameSync(temporary,ownershipPath);}
 async function operator(name,args={}) {
  if(name==='seed'&&(!Array.isArray(args.rows)||args.rows.length+refs.length>limits.totalRows||refs.filter(ref=>ref.table==='runtimeAuthPrincipals').length+args.rows.filter(row=>row.table==='runtimeAuthPrincipals').length>limits.subjects))throw new Error('Pre-dispatch owned row/subject ceiling');
  if(name==='storeTiny'&&files.length>=limits.storageFiles)throw new Error('Pre-dispatch storage ceiling');
  const fixtureCall=Object.hasOwn(fixtureKinds,name);if(!fixtureCall&&!allowedInternal.has(name))throw new Error('Operator path rejected');
  const path=fixtureCall?'qualificationOwned:'+name:name,kind=fixtureCall?fixtureKinds[name]:kindByPath[path];
  if(!kind)throw new Error('Unknown internal kind');const result=await bounded(()=>adminClient[kind](makeFunctionReference(path),fixtureCall?{...args,run}:args));
  if(name==='seed'||name==='discoverOwnedEffects'||name==='ownedTombstones')track(result);
  if(name==='storeTiny'){assert.ok(files.length<limits.storageFiles);files.push({...result,slot:args.slot});track([{table:'mutable',id:result.catalogId}]);}
  return result;
 }
 async function seed(rows){if(refs.filter(ref=>ref.table==='runtimeAuthPrincipals').length+rows.filter(row=>row.table==='runtimeAuthPrincipals').length>limits.subjects)throw new Error('Subject ceiling exceeded');return await operator('seed',{rows});}
 // Real control IDs; all rows are unique and privately tracked. No caller metadata bootstrap.
 await seed([{table:'governancePolicies',value:{tenantId:scopes.tenantId,memorySpaceId:scopes.memorySpaceId,policy:{},isActive:false,createdAt:Date.now(),updatedAt:Date.now()}},{table:'graphSyncQueue',value:{tenantId:scopes.tenantId,memorySpaceId:scopes.memorySpaceId,table:'facts',entityId:run+':validator-only',operation:'insert',synced:true,createdAt:Date.now()}}]);
 const keys=['reader','writer','foreign','revoked','deleted','ungranted','admin'];
 for(const key of keys){users[key]=run+':user-'+key;identities[key]=run+':subject-'+key;principals[key]=(await seed([{table:'runtimeAuthPrincipals',value:{issuer,subject:identities[key],actorKind:'user',metadataUserId:users[key],version:1,createdAt:Date.now()}}]))[0].id;}
 const scopeSpecs=[{tenantId:scopes.tenantId},{tenantId:scopes.tenantId,memorySpaceId:scopes.memorySpaceId},{tenantId:scopes.tenantId,memorySpaceId:scopes.writerMemorySpaceId},{tenantId:scopes.foreignTenantId},{tenantId:scopes.foreignTenantId,memorySpaceId:scopes.foreignMemorySpaceId}];
 await seed(scopeSpecs.map(scope=>({table:'runtimeAuthScopes',value:{...scope,epoch:1,createdAt:Date.now()}})));
 for(const key of keys){if(key==='ungranted')continue;const foreign=key==='foreign',tenantId=foreign?scopes.foreignTenantId:scopes.tenantId,memorySpaceId=foreign?scopes.foreignMemorySpaceId:key==='writer'?scopes.writerMemorySpaceId:scopes.memorySpaceId;
  const membershipId=(await seed([{table:'runtimeAuthMemberships',value:{principalId:principals[key],tenantId,version:1,createdAt:Date.now()}}]))[0].id;
  const capabilities=key==='admin'?['admin']:key==='writer'?['write','admin','storage:write']:['read','write','admin','run','tool','storage:read','storage:write'];
  const grantId=(await seed([{table:'runtimeAuthGrants',value:{principalId:principals[key],membershipId,tenantId,memorySpaceId,tenantEpoch:1,memorySpaceEpoch:1,capabilities,resourceAccess:'own',version:1,createdAt:Date.now(),...(key==='revoked'?{revokedAt:Date.now()}:{} )}}]))[0].id;grants[key]=grantId;
  references[key]={principalId:principals[key],principalVersion:1,membershipId,membershipVersion:1,grantId,grantVersion:1,tenantId,memorySpaceId,tenantEpoch:1,memorySpaceEpoch:1};
 }
 // Deletion is a real later trusted transaction after fixture admission.
 await operator('runtimeAuth:deletePrincipal',{principalId:principals.deleted});
 for(const key of keys){const client=new ConvexHttpClient(target.deploymentUrl,{logger:false,fetch:nativeFetch});client.setAuth(token(identities[key]));clients[key]=client;}
 const forged=new ConvexHttpClient(target.deploymentUrl,{logger:false,fetch:nativeFetch});const parts=token(identities.reader).split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);forged.setAuth(parts.join('.'));clients.forgedJWT=forged;
 const claimsOnly=new ConvexHttpClient(target.deploymentUrl,{logger:false,fetch:nativeFetch});claimsOnly.setAuth(token(identities.ungranted,{role:'admin',roles:['admin'],tenantId:scopes.tenantId,memorySpaceId:scopes.memorySpaceId,principalId:principals.reader}));clients.claimsOnly=claimsOnly;
 for(const [key,patch] of [['noJWT',null],['wrongIssuer',{iss:'https://wrong-issuer.invalid'}],['wrongAudience',{aud:'wrong-audience'}],['expiredJWT',{exp:Math.floor(Date.now()/1000)-60}]]){const client=new ConvexHttpClient(target.deploymentUrl,{logger:false,fetch:nativeFetch});if(patch)client.setAuth(token(identities.reader,patch));clients[key]=client;}
 async function call(identity,path,args){if(!Object.hasOwn(clients,identity)||!kindByPath[path])throw new Error('Native call path/identity rejected');diagnostics.clear();platformWireMessages.clear();return await bounded(()=>clients[identity][kindByPath[path]](makeFunctionReference(path),args));}
 async function discoverOwnedEffects(){return await operator('discoverOwnedEffects',{tenantIds:[scopes.tenantId,scopes.foreignTenantId,run+':catalog']});}
 async function snapshot(selected=refs){await discoverOwnedEffects();const rows=await operator('snapshot',{refs:selected.map(({table,id})=>({table,id}))});const storage=await operator('storageSnapshot',{files});if(selected===refs)return [...rows,{table:'_storage',id:'owned-storage-metadata',row:storage}];return rows;}
 async function cleanup(selected=refs){return await operator('cleanup',{refs:selected.map(({table,id})=>({table,id}))});}
 function reactiveClient(identity){configureReactiveTransport(target.deploymentUrl);const client=new ConvexClient(target.deploymentUrl,{logger:false});client.setAuth(async()=>token(identities[identity]));reactive.push(client);return client;}
 async function finish(){cleanupMode=true;cleanupDeadline=Date.now()+60000;let complete=false;try{await discoverOwnedEffects();for(const file of files)await operator('cleanupStorage',file);for(let attempt=0;attempt<limits.cleanupAttempts;attempt++){await cleanup();const remaining=await operator('snapshot',{refs});if(remaining.every(entry=>entry.row===null)){complete=true;break;}}}finally{await Promise.allSettled(reactive.map(client=>client.close()));for(const controller of aborters)controller.abort();}return complete&&!unknownDispatch;}
 return {diagnostics,diagnoseAuthFailure:(result,error)=>{if(result!==undefined||!error)diagnostics.success();else diagnostics.error(error,error instanceof Error&&platformWireMessages.has(error.message));},run,issuer,deploymentUrl:target.deploymentUrl,bounded,httpClient:()=>new ConvexHttpClient(target.deploymentUrl,{logger:false,fetch:nativeFetch}),tokenFor:identity=>token(identities[identity]),kindByPath,identities,scopes,principals,grants,references,users,refs,files,operator,seed,snapshot,cleanup,call,discoverOwnedEffects,captureOwnedEffects:discoverOwnedEffects,reactiveClient,finish,stats:()=>({calls,jwtSubjects:keys.length,subjects:refs.filter(ref=>ref.table==='runtimeAuthPrincipals').length,trackedRows:refs.length,storageFiles:files.length,unknownDispatch})};
}
