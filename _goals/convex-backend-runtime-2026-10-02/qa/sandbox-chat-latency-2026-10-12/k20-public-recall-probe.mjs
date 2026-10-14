/** Prepared public API probe. Exactly one new semantic recall; no retries. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createK20DiagnosticContext, parseArgs, safeError } from './k20-auth-close-diagnostic-readonly.mjs';
import { requirePublicRecallPins } from './k20-public-recall-pins.mjs';
const Q=path.dirname(fileURLToPath(import.meta.url)), RPC_MS=12000, WHOLE_MS=30000, MAX_EVENTS=256;
const QUERY='What is my favorite color?', DEFAULT_PROFILE='cortex-text-small-1536-v1';
const hash=value=>createHash('sha256').update(value).digest('hex');
const methods=new Set(['runtimeClient:session','runtimeMemory:defaultProfile','runtimeMemory:recall']);
export function safeLatencyEvent(event) {
  if (!event || event.version!==1 || !['rpc.begin','rpc.end','rpc.failed','auth.begin','auth.ready','auth.denied'].includes(event.phase)
    || !Number.isFinite(event.atMs) || event.atMs<0 || event.method!==undefined&&!methods.has(event.method)) return undefined;
  const result={version:1,phase:event.phase,atMs:event.atMs};
  if(event.method!==undefined)result.method=event.method;
  if(Number.isSafeInteger(event.rpcId)&&event.rpcId>=0)result.rpcId=event.rpcId;
  if(Number.isFinite(event.durationMs)&&event.durationMs>=0)result.durationMs=event.durationMs;
  return result;
}
/** Validate attributed public fields in memory; save only counts/booleans/digests. */
export function projectRecall(value,actor,profile,now=Date.now()) {
  assert.ok(value&&Array.isArray(value.items)&&value.items.length<=10&&typeof value.context==='string');
  assert.equal(value.profileId,profile); assert.equal(profile,DEFAULT_PROFILE);
  assert.ok(value.deliveryExpiresAt===undefined||Number.isSafeInteger(value.deliveryExpiresAt)&&value.deliveryExpiresAt>now);
  let expectedPreference=false,factCount=0,memoryCount=0;const provenance=[];
  for(const item of value.items){
    assert.ok(item&&['memory','fact'].includes(item.type)&&typeof item.content==='string'&&typeof item.id==='string'&&Number.isFinite(item.score));
    const row=item.type==='fact'?item.fact:item.memory;assert.ok(row&&typeof row==='object');
    assert.equal(row.tenantId,actor.tenantId);assert.equal(row.memorySpaceId,actor.memorySpaceId);
    assert.equal(item.type==='fact'?row.ownerPrincipalId:row.userId,actor.principalId);
    if(item.type==='fact'){
      factCount++;const l=row.lineage;assert.ok(l&&['user','tool'].includes(l.role)&&typeof l.sourceId==='string'&&typeof l.sourceEventId==='string'&&Number.isSafeInteger(l.sourceRevision)&&l.sourceRevision>0);
      assert.equal(l.trust,l.role==='user'?'user_assertion':'verified_tool_evidence');
      if(l.role==='user'&&/\bcoral\b/i.test(item.content))expectedPreference=true;
      provenance.push({type:'fact',itemIdSha256:hash(item.id),lineageSha256:hash(JSON.stringify([l.sourceId,l.sourceEventId,l.sourceRevision,l.role,l.trust])),sourceRevision:l.sourceRevision});
    }else{
      memoryCount++;assert.ok(Number.isSafeInteger(row.version)&&row.version>0&&['conversation','tool'].includes(row.sourceType));
      provenance.push({type:'memory',itemIdSha256:hash(item.id),sourceRevision:row.version,sourceType:row.sourceType});
    }
  }
  assert.equal(expectedPreference,true,'Expected current authorized synthetic coral preference required');
  return{itemCount:value.items.length,factCount,memoryCount,expectedPreference,allItemsScoped:true,currentOwner:true,
    profileId:profile,contextBytes:Buffer.byteLength(value.context),deliveryDeadlineValid:true,...value.deliveryExpiresAt===undefined?{}:{deliveryExpiresAt:value.deliveryExpiresAt},provenance};
}
async function deadline(promise,ms,code){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(code),{code})),ms);})]);}finally{clearTimeout(timer);}}
export async function main(argv){
  const outcome={version:1,preparedProbe:true,publicApi:'CortexRuntimeClient.recall',rawPayloadRetained:false,retries:0,requestTimeoutMs:RPC_MS,wholeDeadlineMs:WHOLE_MS,
    serviceCalls:0,publicRecallAttempts:0,clientsClosed:false,sdkClosed:false,borrowedPortClosed:false,events:[],portRpc:[],droppedEvents:0};
  let client,port,c,phase='interlock',requestId,probeStart;
  const receipt=path.join(Q,'k20-public-recall-probe-'+Date.now()+'-'+randomUUID()+'.json');
  try{
    assert.equal(process.version,'v24.15.0');const options=parseArgs(argv),pins=requirePublicRecallPins(options);
    assert.equal(process.env.CORTEX_K20_PUBLIC_RECALL_GO,'1','Explicit root GO for one public recall is required');
    probeStart=performance.now();
    const within=async work=>{const remaining=WHOLE_MS-(performance.now()-probeStart);if(remaining<=0)throw Object.assign(new Error('DIAGNOSTIC_DEADLINE'),{code:'DIAGNOSTIC_DEADLINE'});
      return await deadline(work(),remaining,'DIAGNOSTIC_DEADLINE');};
    phase='target.guard';c=await within(()=>createK20DiagnosticContext(options));outcome.target={sessionId:options.sessionId,name:options.name,id:options.id,sourceCommit:options.sourceCommit,imageId:options.imageId};
    outcome.sdk=c.sdkIdentity;
    const installed=path.join(c.s.backendDir,'node_modules/@cortexmemory/sdk');
    assert.equal(hash(await fs.readFile(path.join(installed,'dist/backend/v1/manifest.json'))),pins.backendManifestSha256);
    const host=JSON.parse(await fs.readFile(path.join(c.s.receiptDir,'host-prepared.json'),'utf8'));assert.equal(host.sourceCommit,options.sourceCommit);
    const requireHost=createRequire(path.join(c.s.backendDir,'package.json')), {ConvexClient}=requireHost('convex/browser'),{getFunctionName}=requireHost('convex/server');
    const {CortexRuntimeClient}=await import(pathToFileURL(path.join(installed,'dist/client-runtime/index.js')));
    port=new ConvexClient(c.s.target.deploymentUrl,{logger:false,unsavedChangesWarning:false,reportDebugInfoToConvex:false});
    const scope={tenantId:c.s.publicRuntime.tenantId,memorySpaceId:c.s.publicRuntime.memorySpaceId};requestId='qa-k20-public-recall:'+randomUUID();
    const observe=async(kind,ref,args,invoke)=>{
      const method=getFunctionName(ref);assert.ok(methods.has(method));assert.equal(args.tenantId,scope.tenantId);assert.equal(args.memorySpaceId,scope.memorySpaceId);
      if(kind==='action'){assert.equal(method,'runtimeMemory:recall');assert.equal(outcome.publicRecallAttempts,0);assert.equal(args.requestId,requestId);assert.equal(args.text,QUERY);assert.equal(args.limit,10);
        assert.deepEqual(Object.keys(args).sort(),['limit','memorySpaceId','requestId','tenantId','text']);outcome.publicRecallAttempts++;}
      else{assert.ok(['runtimeClient:session','runtimeMemory:defaultProfile'].includes(method));assert.deepEqual(Object.keys(args).sort(),['memorySpaceId','tenantId']);}
      outcome.serviceCalls++;const began=performance.now();let failed=false;
      try{return await invoke(ref,args);}catch(error){failed=true;throw error;}finally{if(outcome.portRpc.length<MAX_EVENTS)outcome.portRpc.push({kind,method,stage:phase,durationMs:performance.now()-began,failed});else outcome.droppedEvents++;}
    };
    const mutation=port.mutation.bind(port),action=port.action.bind(port);
    port.query=async()=>{throw new Error('PROBE_QUERY_BLOCKED');};
    port.mutation=(ref,args)=>observe('mutation',ref,args,mutation);port.action=(ref,args)=>observe('action',ref,args,action);
    phase='auth.bootstrap';
    client=new CortexRuntimeClient({deploymentUrl:c.s.target.deploymentUrl,client:port,scope,authTimeoutMs:4000,requestTimeoutMs:RPC_MS,fetchToken:async()=>c.token(false),
      onLatencyEvent:event=>{const safe=safeLatencyEvent(event);if(safe&&outcome.events.length<MAX_EVENTS)outcome.events.push({...safe,stage:phase});else outcome.droppedEvents++;}});
    phase='auth.bootstrap';await within(()=>c.verify());let started=performance.now();const actor=await within(()=>client.session());outcome.authBootstrapElapsedMs=performance.now()-started;await within(()=>c.verify());
    assert.equal(actor.tenantId,scope.tenantId);assert.equal(actor.memorySpaceId,scope.memorySpaceId);assert.ok(actor.deliveryExpiresAt===undefined||actor.deliveryExpiresAt>Date.now());
    phase='current.profile';started=performance.now();const selected=await within(()=>client.getDefaultProfile());outcome.currentProfileElapsedMs=performance.now()-started;
    assert.equal(selected.version,1);assert.deepEqual(selected.profile,{profileId:DEFAULT_PROFILE,modelId:'openai/text-embedding-3-small',dimensions:1536,
      normalization:'text-nfc-lf-v1',chunking:'codepoint-1600-overlap-200-v1',indexName:'by_default_embedding_v1'});await within(()=>c.verify());
    phase='public.recall';started=performance.now();let value;
    try{value=await within(()=>client.recall({text:QUERY,requestId,limit:10}));}finally{outcome.publicApiElapsedMs=performance.now()-started;}
    phase='post.recall.guard';await within(()=>c.verify());outcome.result=projectRecall(value,actor,selected.profile.profileId);
    outcome.semanticRequestIdSha256=hash(requestId);outcome.freshVerifications=c.verificationCount();outcome.wholeObservedElapsedMs=performance.now()-probeStart;
    assert.ok(outcome.wholeObservedElapsedMs<=WHOLE_MS,'Original whole probe deadline retained');
    const authBegin=outcome.events.find(e=>e.phase==='auth.begin'),authReady=outcome.events.find(e=>e.phase==='auth.ready');
    if(authBegin&&authReady&&authReady.atMs>=authBegin.atMs)outcome.authHandshakeElapsedMs=authReady.atMs-authBegin.atMs;
    outcome.boundaries='API elapsed brackets the public SDK recall including its original pre/post-session RPCs; auth bootstrap/default profile/management target guards are separate, not added to API latency. Port durations are nested and must not be summed.';
    outcome.verdict='PASS';
  }catch(error){outcome.verdict='FAIL';outcome.failedPhase=phase;outcome.error=safeError(error);}
  finally{
    try{try{if(client){await deadline(client.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');outcome.sdkClosed=true;}}finally{if(port){await deadline(port.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');outcome.borrowedPortClosed=port.closed;}}}
    catch(error){outcome.verdict='FAIL';outcome.closeError=safeError(error);}
    outcome.clientsCreated=Boolean(port);outcome.clientsClosed=(!client||outcome.sdkClosed)&&(!port||outcome.borrowedPortClosed);
  }
  outcome.observedAt=new Date().toISOString();await fs.writeFile(receipt,JSON.stringify(outcome,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({receipt,verdict:outcome.verdict,publicRecallAttempts:outcome.publicRecallAttempts,publicApiElapsedMs:outcome.publicApiElapsedMs,clientsClosed:outcome.clientsClosed,failedPhase:outcome.failedPhase}));
  return outcome.verdict==='PASS'&&outcome.clientsClosed?0:1;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.slice(2).join(' ')==='--help')console.log('PREPARATION ONLY until accepted K20 pins ready:true and CORTEX_K20_PUBLIC_RECALL_GO=1. ONE actual public recall, no retry; original SDK12000ms/whole30000ms. Paired args exactly as k20-auth-close-diagnostic-readonly: --session --name --id --expires-at --source-commit --manifest-sha256 --sdk-archive-sha256 --image-id. No services for help.');
  else process.exitCode=await main(process.argv.slice(2));
}
