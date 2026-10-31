/** PREPARED: shipped public SDK only; two new captures/one recall, no paid retry. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,createSign,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadSession,createContext,PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
import {parseArgs} from './k20-auth-close-diagnostic-readonly.mjs';
import {completeNativeTokenUsage} from './verify-k6-native-usage.mjs';
import {requireK22ReadyPins} from './k22-collector-pins.mjs';
const Q=path.dirname(fileURLToPath(import.meta.url)),KIT=path.join(PROOFS_ROOT,'manual-sandbox-latency-bounded-repair-2026-10-14');
const RPC_MS=12000,WHOLE_MS=30000,MAX_ROWS=256,MAX_EVENTS=256;
const BODY='My favorite color is coral.',ANSWER='I received the preference.',QUERY='What is my favorite color?';
const PROFILE='cortex-text-small-1536-v1',hash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const known=new Set(['FORBIDDEN','UNAUTHENTICATED','IDEMPOTENCY_CONFLICT','TRANSCRIPT_LOCKED','STALE_TRANSCRIPT','STALE_SOURCE','POLICY_DENIED','CAPABILITY_UNAVAILABLE',
 'PROFILE_NOT_READY','MEMORY_OPERATION_FAILED','RPC_DEADLINE_EXCEEDED','AUTHENTICATION_TIMEOUT','SESSION_CHANGED','DIAGNOSTIC_DEADLINE','DIAGNOSTIC_CLOSE_TIMEOUT']);
const scalarError=e=>{let data=Object.getOwnPropertyDescriptor(e??{},'data')?.value;if(typeof data==='string'){try{data=JSON.parse(data);}catch{data=undefined;}}
 const code=Object.getOwnPropertyDescriptor(e??{},'code')?.value??(data&&typeof data==='object'?Object.getOwnPropertyDescriptor(data,'code')?.value:undefined);
 const requestId=Object.getOwnPropertyDescriptor(e??{},'requestId')?.value;
 return {code:known.has(code)?code:'OTHER_ERROR',...(typeof requestId==='string'&&/^remember:[a-f0-9-]{36}$/.test(requestId)?{requestId}:{})};};
async function bound(promise,ms,code='DIAGNOSTIC_DEADLINE'){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error(code),{code})),ms);})]);}finally{clearTimeout(timer);}}
async function privateRead(p){const s=await fs.lstat(p);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&(s.mode&0o077)===0);return fs.readFile(p,'utf8');}
function latency(e){if(!e||e.version!==1||!['rpc.begin','rpc.end','rpc.failed','auth.begin','auth.ready','auth.denied'].includes(e.phase)||!Number.isFinite(e.atMs)||e.atMs<0)return;
 if(e.method!==undefined&&!['runtimeClient:session','runtimeMemory:defaultProfile','runtimeMemory:recall','runtimeMemoryCapture:rememberExchange','runtimeMemoryCapture:rememberStatus','runtimeClientExtensions:memoryReadiness'].includes(e.method))return;
 return {version:1,phase:e.phase,atMs:e.atMs,...(e.method===undefined?{}:{method:e.method}),...(Number.isSafeInteger(e.rpcId)?{rpcId:e.rpcId}:{}),...(Number.isFinite(e.durationMs)&&e.durationMs>=0?{durationMs:e.durationMs}:{})};}
async function context(options,pins,out){
 const s=await loadSession(PROOFS_ROOT,options.sessionId),ctx=await createContext(s,{logger:()=>{}});ctx.persist=async()=>{};ctx.receipt=async()=>{};
 const fetchManagement=ctx.fetch;ctx.fetch=(url,args={})=>{assert.equal((args.method??'GET').toUpperCase(),'GET');return fetchManagement(url,args);};
 function identity(v){assert.equal(v.phase,'READY');assert.equal(v.id,options.sessionId);assert.equal(v.target.name,options.name);assert.equal(v.target.id,options.id);
  assert.equal(v.target.teamId,325340);assert.equal(v.target.projectId,3200658);assert.equal(v.target.reference,'dev/cortex-sandbox-'+options.sessionId);
  assert.equal(v.target.kind,'cloud');assert.equal(v.target.deploymentType,'dev');assert.equal(v.target.isDefault,false);assert.equal(v.target.disposable,true);
  assert.equal(v.target.deploymentUrl,'https://'+options.name+'.convex.cloud');assert.equal(v.target.expiresAt,options.expiresAt);assert.ok(options.expiresAt>Date.now());
  assert.equal(v.container.imageId,options.imageId);assert.equal(v.launcherPid,s.launcherPid);process.kill(v.launcherPid,0);}
 async function verify(){identity(await loadSession(PROOFS_ROOT,options.sessionId));identity(s);await verifyCloud(s,ctx);identity(s);out.freshVerifications++;}
 await verify();const manifestBytes=await fs.readFile(path.join(KIT,'image/archives/manifest.json'));assert.equal(hash(manifestBytes),options.manifestSha256);
 const manifest=JSON.parse(manifestBytes);assert.equal(manifest.sourceCommit,options.sourceCommit);assert.equal(manifest.node,'24.15.0');assert.equal(manifest.npm,'12.2.0');
 const sdk=manifest.packages.find(p=>p.role==='sdk');assert.equal(sdk.version,'0.39.0');assert.equal(sdk.sha256,options.sdkArchiveSha256);
 const archive=path.join(KIT,'image/archives',sdk.filename);assert.equal(hash(await fs.readFile(archive)),sdk.sha256);
 const installed=path.join(s.backendDir,'node_modules/@cortexmemory/sdk');
 for(const member of ['dist/index.js','dist/client-runtime/index.js']){const {stdout}=await promisify(execFile)('/usr/bin/tar',['-xOf',archive,'package/'+member],{encoding:'buffer',timeout:30000,maxBuffer:16*1024*1024});assert.equal(hash(await fs.readFile(path.join(installed,member))),hash(stdout));}
 const backend=path.join(installed,'dist/backend/v1'),backendBytes=await fs.readFile(path.join(backend,'manifest.json'));assert.equal(hash(backendBytes),pins.backendManifestSha256);
 const host=JSON.parse(await fs.readFile(path.join(s.receiptDir,'host-prepared.json')));assert.equal(host.sourceCommit,options.sourceCommit);
 const bm=JSON.parse(backendBytes),pure={};for(const [name,sourcePath] of Object.entries({profile:'src/domain/profile.ts',sources:'src/domain/sources.ts',policy:'src/domain/model-policy.ts'})){
  const f=bm.files.find(f=>f.sourcePath===sourcePath);assert.ok(f);assert.equal(hash(await fs.readFile(path.join(backend,f.path))),f.sha256);pure[name]=await import(pathToFileURL(path.join(backend,f.path)));}
 const requireHost=createRequire(path.join(s.backendDir,'package.json'));assert.equal(requireHost('convex/package.json').version,'1.46.0');
 const {ConvexClient,ConvexHttpClient,BaseConvexClient}=requireHost('convex/browser'),{getFunctionName}=requireHost('convex/server');
 const identities=JSON.parse(await privateRead(path.join(s.issuerDir,'identities.json'))),pem=await privateRead(path.join(s.issuerDir,'jwt-private.pem'));
 function token(role){const i=identities[role];assert.ok(i&&i.expiresAt>Date.now());const now=Math.floor(Date.now()/1000),encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const unsigned=encode({alg:'RS256',typ:'JWT',kid:'sandbox-'+options.sessionId})+'.'+encode({iss:i.issuer,sub:i.subject,aud:'cortex-sandbox-'+options.sessionId,iat:now,exp:Math.min(now+3600,Math.floor(i.expiresAt/1000))});
  const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();return unsigned+'.'+signer.sign(pem).toString('base64url');}
 const key=await privateRead(s.deploymentKeyPath);assert.ok(key.startsWith('dev:'+options.name+'|'));
 const admin=new ConvexHttpClient(s.target.deploymentUrl,{logger:false,fetch:(url,args)=>fetch(url,{...args,redirect:'error',signal:AbortSignal.timeout(30000)})});admin.setAdminAuth(key);
 const full=await import(pathToFileURL(path.join(installed,'dist/index.js'))),runtime=await import(pathToFileURL(path.join(installed,'dist/client-runtime/index.js')));
 const waiting=new Map();let base;
 base=new BaseConvexClient(s.target.deploymentUrl,tokens=>{for(const t of tokens){const w=waiting.get(t);if(w){try{w.resolve(base.localQueryResultByToken(t));}catch(e){w.reject(e);}}}},{logger:false,unsavedChangesWarning:false,webSocketConstructor:WebSocket});base.setAdminAuth(key);
 async function table(name,componentPath=''){await verify();try{const page=await new Promise((resolve,reject)=>{const sub=base.subscribe('_system/cli/tableData',{table:name,order:'desc',paginationOpts:{cursor:null,numItems:MAX_ROWS}},{componentPath});
  const timer=setTimeout(()=>{waiting.delete(sub.queryToken);sub.unsubscribe();reject(Error('Bounded table timeout'));},30000);
  waiting.set(sub.queryToken,{resolve:v=>{clearTimeout(timer);waiting.delete(sub.queryToken);sub.unsubscribe();resolve(v);},reject:e=>{clearTimeout(timer);waiting.delete(sub.queryToken);sub.unsubscribe();reject(e);}});});
  assert.ok(Array.isArray(page.page)&&page.isDone&&page.page.length<=MAX_ROWS,'Complete bounded native table required');out.tables[componentPath+':'+name]=page.page.length;return page.page;}finally{await verify();}}
 const allowedAdmin=new Set(['runtimeAuth:provision','runtimeAuth:revokeGrant']);
 async function mutateAdmin(name,args){assert.ok(allowedAdmin.has(name));await verify();try{return await admin.mutation(name,args);}finally{await verify();}}
 return {s,identities,token,verify,table,mutateAdmin,pure,full,runtime,ConvexClient,getFunctionName,close:async()=>{for(const w of waiting.values())w.reject(Error('Collector closed'));waiting.clear();await base.close();}};
}

const PRIOR='k22-native-ordinary-memory-v2-1791985510832-a1de5b5c-e7c5-4f4f-9692-30ec9337545f.json',PROOF='k22-existing-capture-continuation-1791986358952.json';
const out={version:1,kind:'existing-k22-capture-public-recall-and-negatives',rawPayloadRetained:false,newCaptureIntents:0,originalCaptureReplays:0,retries:0,recallCalls:0,freshVerifications:0,tables:{},clientsClosed:false,events:[],rpc:[],assertions:{}};
const clients=[],ports=[];let c,phase='interlock',began;function add(field,value){if(out[field].length<MAX_EVENTS)out[field].push(value);}
try{
 assert.equal(process.env.CORTEX_K22_EXISTING_CAPTURE_API_GO,'1');const raw=requireK22ReadyPins(),pins={...raw,id:raw.targetId};
 const options={sessionId:pins.sessionId,name:pins.name,id:pins.id,expiresAt:pins.expiresAt,sourceCommit:pins.sourceCommit,imageId:pins.imageId,manifestSha256:pins.manifestSha256,sdkArchiveSha256:pins.sdkArchiveSha256};
 const priorBytes=await fs.readFile(path.join(Q,PRIOR)),proofBytes=await fs.readFile(path.join(Q,PROOF)),prior=JSON.parse(priorBytes),proof=JSON.parse(proofBytes);
 assert.equal(prior.target.sessionId,pins.sessionId);assert.equal(proof.target.sourceCommit,pins.sourceCommit);assert.equal(proof.clientsClosed,true);assert.equal(proof.recallCalls,0);assert.equal(proof.newCaptures,0);assert.equal(proof.checks.length,221);assert.ok(proof.checks.every(c=>c.passed));
 for(const [key,value]of Object.entries({captureCount:2,traceRows:4,nativeMessageRows:4,eventCount:4,positiveCoralFact:true,assistantExternal:true,metadataMatches:true,currentGrant:true,nativeUsageAttempts:6}))assert.equal(proof.native[key],value);
 out.previousNativeProofSha256=hash(proofBytes);out.originalFailureSha256=hash(priorBytes);out.retainedOriginalFailure=true;
 c=await context(options,pins,out);out.target=prior.target;const [first,second]=prior.captureHandles;
 const captures=(await c.table('runtimeMemoryCaptures')).filter(r=>[first.receiptId,second.receiptId].includes(r.receiptId));assert.equal(captures.length,2);assert.ok(captures.every(r=>r.tenantId===captures[0].tenantId&&r.memorySpaceId===captures[0].memorySpaceId&&r.ownerPrincipalId===captures[0].ownerPrincipalId));
 const scope={tenantId:captures[0].tenantId,memorySpaceId:captures[0].memorySpaceId},granted=captures[0].authorityReference;assert.equal(hash(scope),prior.scopeSha256);assert.equal(hash(granted.grantId),prior.ownerGrantIdSha256);assert.ok(scope.memorySpaceId.startsWith('qa-k22-capture-'));
 assert.ok(captures.every(r=>c.pure.policy.canonicalModelJson(r.authorityReference)===c.pure.policy.canonicalModelJson(granted)));
 const conversations=await c.table('runtimeConversations'),conversation=conversations.find(r=>r.tenantId===scope.tenantId&&r.memorySpaceId===scope.memorySpaceId&&r.conversationId===first.conversationId);assert.ok(conversation&&conversation.manualWriteLocked===true&&conversation.ownerPrincipalId===granted.principalId);
 const originalAdmin=c.mutateAdmin;c.mutateAdmin=async(name,args)=>{assert.equal(name,'runtimeAuth:revokeGrant');assert.equal(args.grantId,granted.grantId);return originalAdmin(name,args);};
 const nonce=randomUUID(),owner=c.identities.owner,firstParams={userName:'QA V8 Capture',tags:['qa-v8-native-capture']},exact={conversationId:first.conversationId,requestId:first.requestId,userMessage:BODY,agentResponse:ANSWER,userId:owner.metadataUserId,participantId:owner.metadataUserId,userName:firstParams.userName,agentId:'qa-external-assistant',metadata:{importance:42,tags:firstParams.tags}};
 const storedRequest=JSON.parse(captures.find(r=>r.receiptId===first.receiptId).requestCanonical);exact.conversationId=storedRequest.conversationId;
  const allowed=new Set(['runtimeClient:session','runtimeMemoryCapture:rememberExchange','runtimeMemoryCapture:rememberStatus','runtimeMemoryCapture:setCaptureLock',
   'runtimeTranscript:remove','runtimeTranscript:setPolicy','runtimeMemory:defaultProfile','runtimeClientExtensions:memoryReadiness','runtimeMemory:recall']);
  function observe(port){const mutation=port.mutation.bind(port),action=port.action.bind(port);for(const [kind,fn]of [['mutation',mutation],['action',action]])port[kind]=async(ref,args)=>{
   const method=c.getFunctionName(ref);assert.ok(allowed.has(method));assert.equal(args.tenantId,scope.tenantId);assert.equal(args.memorySpaceId,scope.memorySpaceId);
   const began=performance.now();let failed=false;try{return await fn(ref,args);}catch(e){failed=true;throw e;}finally{add('rpc',{kind,method,phase,durationMs:performance.now()-began,failed});}};ports.push(port);return port;}
  function sdk(role){const port=observe(new c.ConvexClient(c.s.target.deploymentUrl,{logger:false,unsavedChangesWarning:false,reportDebugInfoToConvex:false}));
   const client=new c.runtime.CortexRuntimeClient({deploymentUrl:c.s.target.deploymentUrl,client:port,scope,authTimeoutMs:4000,requestTimeoutMs:RPC_MS,fetchToken:async()=>c.token(role),onLatencyEvent:e=>{const v=latency(e);if(v)add('events',{...v,phaseStage:phase});}});
   clients.push({kind:'runtime',close:()=>client.close()});return {client,port};}
  const owned=sdk('owner');
  async function deny(label,work,code){phase=label;await c.verify();let received=false,actual;try{await bound(work(),WHOLE_MS);received=true;}catch(e){actual=scalarError(e).code;}finally{await c.verify();}
   assert.equal(received,false,'Protected payload/effect unexpectedly returned');assert.equal(actual,code,'Expected native denial code');out.assertions[label]={code,protectedPayloadReturned:false};}
  phase='public.profile';began=performance.now();const current=await owned.client.getDefaultProfile();out.profileApiMs=performance.now()-began;assert.equal(current.profile.profileId,PROFILE);
  phase='public.recall';const requestId='qa-k22-public-recall:'+nonce;await c.verify();began=performance.now();out.recallCalls++;let result;
  try{result=await bound(owned.client.recall({text:QUERY,requestId,limit:10}),WHOLE_MS);}finally{out.recallApiMs=performance.now()-began;}await c.verify();
  assert.equal(result.profileId,PROFILE);assert.ok(Array.isArray(result.items)&&result.items.length<=10);assert.ok(result.items.some(i=>i.type==='fact'&&/\bcoral\b/i.test(i.content)&&i.fact.ownerPrincipalId===granted.principalId));
  for(const i of result.items){const r=i.type==='fact'?i.fact:i.memory;assert.equal(r.tenantId,scope.tenantId);assert.equal(r.memorySpaceId,scope.memorySpaceId);assert.equal(i.type==='fact'?r.ownerPrincipalId:r.userId,granted.principalId);}
  out.publicRecall={itemCount:result.items.length,contextBytes:Buffer.byteLength(result.context),currentProfile:true,scopedPositivePreference:true,requestIdSha256:hash(requestId)};
  const reader=sdk('reader'),outsider=sdk('outsider');await deny('reader.capture',()=>reader.client.remember({...exact,requestId:'reader-'+nonce}),'FORBIDDEN');await deny('outsider.status',()=>outsider.client.rememberStatus(first.receiptId),'FORBIDDEN');
  phase='capture.lock';await c.verify();await owned.port.mutation('runtimeMemoryCapture:setCaptureLock',{...scope,conversationId:first.conversationId,expectedRevision:conversation.historyRevision,locked:true});await c.verify();
  await deny('locked.new',()=>owned.client.remember({...exact,requestId:'locked-'+nonce}),'TRANSCRIPT_LOCKED');await deny('locked.replay',()=>owned.client.remember(exact),'TRANSCRIPT_LOCKED');
  assert.equal((await owned.client.rememberStatus(first.receiptId)).receiptId,first.receiptId);out.assertions.lockedStatusReadAllowed=true;
  phase='capture.delete';await c.verify();
  // Original delete keeps its manual-lock denial. Explicit administrator setup on this owned QA conversation enables the tombstone negative.
  await owned.port.mutation('runtimeTranscript:setPolicy',{...scope,conversationId:first.conversationId,expectedRevision:conversation.historyRevision,manualWriteLocked:false});out.assertions.explicitAdminManualUnlockForDelete=true;
  await owned.port.mutation('runtimeTranscript:remove',{...scope,conversationId:first.conversationId});await c.verify();await deny('deleted.status',()=>owned.client.rememberStatus(first.receiptId),'FORBIDDEN');
  await c.mutateAdmin('runtimeAuth:revokeGrant',{grantId:granted.grantId});await deny('revoked.new',()=>owned.client.remember({...exact,requestId:'revoked-'+nonce}),'FORBIDDEN');
  out.assertions.demoOwnerGrantUntouched=true;out.verdict='PASS';

}catch(e){out.verdict='FAIL';out.failedPhase=phase;out.error=scalarError(e);}
finally{let closeFailure=false;for(const v of clients.reverse()){try{await bound(v.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');}catch(e){closeFailure=true;out.closeError=scalarError(e);}}
 for(const p of ports){try{await bound(p.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');assert.equal(p.closed,true);}catch(e){closeFailure=true;out.closeError=scalarError(e);}}
 try{if(c)await bound(c.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');}catch(e){closeFailure=true;out.closeError=scalarError(e);}out.clientsClosed=!closeFailure;if(closeFailure)out.verdict='FAIL';}
const receipt=path.join(Q,'k22-existing-capture-api-'+Date.now()+'.json');await fs.writeFile(receipt,JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({receipt,verdict:out.verdict,clientsClosed:out.clientsClosed,newCaptureIntents:out.newCaptureIntents,recallCalls:out.recallCalls,failedPhase:out.failedPhase}));process.exitCode=out.verdict==='PASS'&&out.clientsClosed?0:1;
