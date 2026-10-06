import assert from 'node:assert/strict';
import { makeFunctionReference } from 'convex/server';
// Current root-built output, with its own new byte inventory. No old packed SDK substitution.
import { Cortex, createAuthContext } from '../../../../../dist/index.js';
import { configureReactiveTransport } from './reactive-transport.mjs';
import { authDenial } from './native-engine.mjs';
const pause=ms=>new Promise(done=>setTimeout(done,ms));
async function waitFor(predicate){const until=Date.now()+12000;while(!predicate()){if(Date.now()>=until)throw new Error('Live observer timeout');await pause(25);}}
export function assertSanitizedHostFailure(failure){
 assert.ok(failure&&typeof failure==='object');const descriptor=Object.getOwnPropertyDescriptor(failure,'attemptId');assert.ok(descriptor&&Object.hasOwn(descriptor,'value'));const attemptId=descriptor.value;assert.ok(Number.isSafeInteger(attemptId)&&attemptId>0);
 assert.deepEqual(failure,{code:'HOST_TOKEN_FETCH_FAILED',attemptId});assert.equal(Object.isFrozen(failure),true);
}
export async function qualifyLifecycle(ctx) {
 configureReactiveTransport(ctx.deploymentUrl);
 const args={tenantId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId,namespace:ctx.run+':lifecycle',key:ctx.run+':lifecycle-key'};
 await ctx.seed([{table:'mutable',value:{...args,ownerPrincipalId:ctx.principals.reader,value:41,createdAt:Date.now(),updatedAt:Date.now()}}]);
 let current=ctx.tokenFor('reader'),mode='current',lateResolve,forceRefresh=false;const authFailures=[];
 const sdk=new Cortex({convexUrl:ctx.deploymentUrl,resilience:{enabled:false},auth:createAuthContext({userId:ctx.users.reader,tenantId:ctx.scopes.tenantId}),
  fetchAuthToken:async request=>{forceRefresh ||= request.forceRefreshToken;if(mode==='late')return await new Promise(done=>{lateResolve=done;});if(mode==='throw')throw new Error('fixture private provider diagnostic');return current;},onAuthError:failure=>{assertSanitizedHostFailure(failure);authFailures.push(failure);}});
 const records=[];const stops=[];
 try {
  const client=sdk.getClient(),query=makeFunctionReference('mutable:get');
  assert.equal((await ctx.bounded(()=>client.query(query,args))).value,41);
  current=ctx.tokenFor('reader');sdk.credentials.notifySessionChanged();
  assert.equal((await ctx.bounded(()=>sdk.credentials.withHttpAuth(ctx.httpClient(),http=>http.query(query,args),{forceRefreshToken:true}))).value,41);assert.equal(forceRefresh,true);records.push('current-sdk-refresh');
  const foreign=ctx.reactiveClient('foreign');let foreignDenied=false,foreignOutputs=0;
  stops.push(foreign.onUpdate(query,args,()=>foreignOutputs++,error=>{authDenial(undefined,error);foreignDenied=true;}));
  await waitFor(()=>foreignDenied);assert.equal(foreignOutputs,0);records.push('cross-tenant-subscription');
  let successes=0,denied=false,values=[];
  stops.push(client.onUpdate(query,args,value=>{successes++;values.push(value?.value);assert.ok(values.length<=64);},error=>{authDenial(undefined,error);denied=true;}));
  await waitFor(()=>successes>0);assert.equal(values.at(-1),41);
  mode='late';sdk.credentials.notifySessionChanged();await waitFor(()=>typeof lateResolve==='function');
  const before=successes;mode='current';current=null;sdk.credentials.notifySessionChanged();await waitFor(()=>denied);
  lateResolve(ctx.tokenFor('reader'));
  await ctx.call('reader','mutable:set',{...args,value:42});assert.equal((await ctx.call('reader','mutable:get',args)).value,42);
  await pause(750);assert.equal(successes,before);let result,error;try{result=await ctx.bounded(()=>client.query(query,args));}catch(caught){error=caught;}authDenial(result,error);
  assert.deepEqual(await sdk.credentials.getAuthorizationHeaders(),{});records.push('logout-real-update-no-delivery','late-token-session-fence');
  // Ordinary logout does not revoke a persisted trusted grant; a later backend reference still needs its own checks.
  current=ctx.tokenFor('reader');sdk.credentials.notifySessionChanged();
  let recovered=false,recoveryFailure;const stopRecovery=client.onUpdate(query,args,value=>{try{assert.equal(value?.value,42);recovered=true;}catch(error){recoveryFailure=error;}},error=>{try{authDenial(undefined,error);}catch(caught){recoveryFailure=caught;}});
  try{await waitFor(()=>recovered||recoveryFailure);if(recoveryFailure)throw recoveryFailure;assert.equal((await ctx.bounded(()=>client.query(query,args))).value,42);}finally{stopRecovery();}
  mode='throw';sdk.credentials.notifySessionChanged();await waitFor(()=>authFailures.length>0);for(const failure of authFailures)assertSanitizedHostFailure(failure);records.push('sanitized-host-callback');
  await ctx.operator('runtimeAuth:revokeGrant',{grantId:ctx.grants.reader});
  const snapshot=await ctx.snapshot();let revokedError;try{await ctx.call('reader','mutable:set',{...args,value:43});}catch(caught){revokedError=caught;}authDenial(undefined,revokedError);assert.deepEqual(await ctx.snapshot(),snapshot);records.push('current-grant-revocation-no-effect');
  return records;
 }finally{for(const stop of stops)stop();await sdk.shutdown(2000);}
}
