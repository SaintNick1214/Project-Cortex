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
import {requireK25OrdinaryMemoryPins} from './k25-ordinary-memory-pins.mjs';
const Q=path.dirname(fileURLToPath(import.meta.url)),KIT=path.join(PROOFS_ROOT,'manual-sandbox-candidate-bound-2026-10-14');
const RPC_MS=12000,WHOLE_MS=30000,MAX_ROWS=256,MAX_EVENTS=256;
const BODY='I like cake. I like sorbet. Both dessert preferences are current and equally important.',ANSWER='I received both dessert preferences.';
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
function eqIds(a,b){for(const k of ['receiptId','requestId','conversationId','principalId','messageIds','sourceEventIds'])assert.deepEqual(a[k],b[k]);}
export async function main(argv){
 const out={version:1,verdict:'UNRUN',rawPayloadRetained:false,retries:0,freshVerifications:0,tables:{},clientsClosed:false,events:[],rpc:[],assertions:{},newCaptureIntents:0,recallCalls:0};
 const clients=[],ports=[];let c,phase='interlock';const receipt=path.join(Q,'k25-native-unequal-candidate-capture-'+Date.now()+'-'+randomUUID()+'.json');
 function add(field,v){if(out[field].length<MAX_EVENTS)out[field].push(v);}
 try{
  assert.equal(process.version,'v24.15.0');const options=parseArgs(argv),pins=requireK25OrdinaryMemoryPins(options);assert.equal(process.env.CORTEX_K25_UNEQUAL_CAPTURE_GO,'1','One supplemental intent GO required');
  c=await context(options,pins,out);out.target={sessionId:options.sessionId,name:options.name,id:options.id,sourceCommit:options.sourceCommit,imageId:options.imageId};
  const budgetRows=await c.table('runtimeBudgetAccounts');const tenants=budgetRows.filter(a=>a.kind==='tenant'&&a.tenantId===c.s.publicRuntime.tenantId&&a.current);assert.equal(tenants.length,1);
  const a=tenants[0];for(const key of ['limitUnits','reservedUnits','settledUnits','uncertainUnits','activeConcurrency'])assert.ok(Number.isSafeInteger(a[key])&&a[key]>=0);
  assert.ok(!a.cancelled&&!a.overrun&&a.limitUnits<=10_000_000&&a.activeConcurrency===0&&a.reservedUnits===0);assert.ok(a.settledUnits+a.uncertainUnits<a.limitUnits,'Current tenant capacity required');
  out.tenantBefore={limitUnits:a.limitUnits,reservedUnits:a.reservedUnits,settledUnits:a.settledUnits,uncertainUnits:a.uncertainUnits,activeConcurrency:a.activeConcurrency,remainingUnits:a.limitUnits-a.settledUnits-a.uncertainUnits,chargesUnknown:true};
  const nonce=randomUUID(),scope={tenantId:c.s.publicRuntime.tenantId,memorySpaceId:'qa-k25-unequal-'+nonce},owner=c.identities.owner;
  assert.equal(owner.tenantId,scope.tenantId);const granted=await c.mutateAdmin('runtimeAuth:provision',{...owner,memorySpaceId:scope.memorySpaceId});out.scopeSha256=hash(scope);
  const allowed=new Set(['runtimeClient:session','runtimeMemoryCapture:rememberExchange','runtimeMemoryCapture:rememberStatus','runtimeClientExtensions:memoryReadiness']);
  function observe(port){const mutation=port.mutation.bind(port);port.mutation=async(ref,args)=>{const method=c.getFunctionName(ref);assert.ok(allowed.has(method));assert.equal(args.tenantId,scope.tenantId);assert.equal(args.memorySpaceId,scope.memorySpaceId);const start=performance.now();let failed=false;try{return await mutation(ref,args);}catch(e){failed=true;throw e;}finally{add('rpc',{kind:'mutation',method,phase,durationMs:performance.now()-start,failed});}};ports.push(port);return port;}
  const cortex=new c.full.Cortex({convexUrl:c.s.target.deploymentUrl,convexLogger:false,graphEnabled:false,fetchAuthToken:async()=>c.token('owner')},{initializeTransport:port=>{observe(port);}});clients.push({kind:'cortex',close:()=>cortex.shutdown(1500)});
  const port=observe(new c.ConvexClient(c.s.target.deploymentUrl,{logger:false,unsavedChangesWarning:false,reportDebugInfoToConvex:false}));
  const client=new c.runtime.CortexRuntimeClient({deploymentUrl:c.s.target.deploymentUrl,client:port,scope,authTimeoutMs:4000,requestTimeoutMs:RPC_MS,fetchToken:async()=>c.token('owner')});clients.push({kind:'runtime',close:()=>client.close()});
  const owned={client,port},firstParams={...scope,conversationId:'unequal-'+nonce,userId:owner.metadataUserId,participantId:owner.metadataUserId,userName:'QA Candidate Binding',agentId:'qa-external-assistant',userMessage:BODY,agentResponse:ANSWER,importance:42,tags:['qa-k25-unequal-candidate']};
  const exact={metadata:{importance:42,tags:firstParams.tags}};
  phase='capture.once';await c.verify();const began=performance.now();out.newCaptureIntents++;const first=(await bound(cortex.memory.remember(firstParams),WHOLE_MS)).durable;out.apiMs=performance.now()-began;await c.verify();assert.ok(first);
  out.captureHandle={receiptId:first.receiptId,requestId:first.requestId,conversationId:first.conversationId,messageIds:first.messageIds,sourceEventIds:first.sourceEventIds};
  phase='status.readiness';const deadline=performance.now()+WHOLE_MS;let readiness,status;
  do{assert.ok(performance.now()<deadline,'Original readiness deadline');await c.verify();status=await bound(owned.client.rememberStatus(first.receiptId),Math.max(1,deadline-performance.now()));
   readiness=await bound(owned.client.memoryReadiness({cutoff:2,expectedProfileId:PROFILE,strictStages:[]}),Math.max(1,deadline-performance.now()));await c.verify();assert.ok(performance.now()<=deadline,'Original readiness deadline');
   if(status.memoryStatus==='failed'||status.memoryStatus==='complete'&&readiness.stages.facts?.complete&&readiness.stages.vectors?.complete)break;
   await new Promise(resolve=>setTimeout(resolve,500));}while(true);
  out.observedStatus={memoryStatus:status.memoryStatus,factsThrough:readiness.stages.facts?.indexedThrough,vectorsThrough:readiness.stages.vectors?.indexedThrough};
  phase='native.evidence';const rows={};for(const name of ['runtimeMemoryCaptures','runtimeMemoryCaptureMessages','runtimeTranscriptMessages','runtimeConversations','runtimeIngestionEvents','runtimeIngestionStages','runtimeIngestionJobs','runtimeIngestionScopes','runtimeMemorySources','runtimeMemoryChunks','runtimeMemoryVectors','runtimeMemoryVectorGenerations','runtimeMemoryReceipts','facts','runtimeModelOperations','runtimeModelAttempts','runtimeBudgetAccounts','runtimeAuthGrants','runtimeAuthPrincipals','runtimeAuthMemberships','runtimeAuthScopes','runtimeAuthTombstones'])rows[name]=await c.table(name);
  const inScope=name=>rows[name].filter(r=>r.tenantId===scope.tenantId&&r.memorySpaceId===scope.memorySpaceId);
  const event=inScope('runtimeIngestionEvents').find(e=>e.lineage.role==='user');assert.ok(event);
  const source=inScope('runtimeMemorySources').find(s=>s.lineage.sourceEventId===event.lineage.sourceEventId);assert.ok(source);
  const stages=inScope('runtimeIngestionStages').filter(s=>s.eventId===event.eventId),extract=stages.find(s=>s.stage==='extract'),facts=stages.find(s=>s.stage==='facts');
  const knownLeaves=new Set(['INVALID_BELIEF_DECISION','AMBIGUOUS_EXTRACTION_SLOT','FACT_VERSION_CONFLICT','BUDGET_EXCEEDED','INVALID_EXTRACTED_FACTS','INDEXING_FAILED','POLICY_DENIED','CAPABILITY_UNAVAILABLE','INGESTION_CONFLICT']);
  out.stages=stages.map(s=>({stage:s.stage,state:s.state,attempt:s.attempt,payloadPresent:typeof s.payloadCanonical==='string',failureCode:knownLeaves.has(s.failureCode)?s.failureCode:undefined,errorCode:knownLeaves.has(s.errorCode)?s.errorCode:undefined}));
  const backend=path.join(c.s.backendDir,'node_modules/@cortexmemory/sdk/dist/backend/v1'),bm=JSON.parse(await fs.readFile(path.join(backend,'manifest.json'))),entry=bm.files.find(f=>f.sourcePath==='src/domain/belief-plan.ts');assert.ok(entry);
  const bytes=await fs.readFile(path.join(backend,entry.path));assert.equal(hash(bytes),entry.sha256);const planHelpers=await import(pathToFileURL(path.join(backend,entry.path)));out.installedPlanHelperSha256=entry.sha256;
  assert.equal(extract?.state,'complete','Confirmed strict extraction required');assert.ok(extract.payloadCanonical&&facts);
  const candidates=JSON.parse(extract.payloadCanonical),boundCandidates=await planHelpers.sourceCandidateBindings({eventId:event.eventId,sequence:event.sequence,source,candidates,attempt:facts.attempt});
  const unequalPairs=[];for(let i=0;i<boundCandidates.length;i++)for(let j=i+1;j<boundCandidates.length;j++){const l=boundCandidates[i].candidate,r=boundCandidates[j].candidate;if(planHelpers.beliefSlot(l)===planHelpers.beliefSlot(r)&&c.pure.policy.canonicalModelJson(l)!==c.pure.policy.canonicalModelJson(r))unequalPairs.push([i,j]);}
  const job=inScope('runtimeIngestionJobs').find(j=>j.eventId===event.eventId),operations=inScope('runtimeModelOperations').filter(o=>o.runAccountId===job?.runAccountId&&o.operationKey==='facts.resolve');
  const plan=facts.payloadCanonical?JSON.parse(facts.payloadCanonical):undefined;
  out.coverage={rawCandidates:candidates.length,retainedCandidates:boundCandidates.length,unequalSameSlotPairs:unequalPairs,privatePlanPresent:!!plan,paidResolverCalls:operations.length,
   resolverBindings:operations.map(op=>({semanticId:op.semanticId,matchedOrdinal:boundCandidates.find(v=>v.binding.semanticId===op.semanticId)?.binding.ordinal})),
   candidates:boundCandidates.map(v=>({ordinal:v.binding.ordinal,sourceOrdinal:v.binding.sourceOrdinal,candidateId:v.binding.candidateId,slotHash:hash(planHelpers.beliefSlot(v.candidate)),candidateHash:hash(c.pure.policy.canonicalModelJson(v.candidate)),semanticId:v.binding.semanticId})),
   fullPrivatePlanCoverage:!!plan&&plan.candidateBindingVersion===1&&c.pure.policy.canonicalModelJson(plan.entries.map(e=>({candidate:e.candidate,binding:e.candidateBinding})))===c.pure.policy.canonicalModelJson(boundCandidates.map(v=>({candidate:v.candidate,binding:v.binding}))),
   planDecisions:plan?.entries.map(e=>({ordinal:e.ordinal,action:e.decision.action,targetIsNull:e.decision.targetFactId===null})),
   deterministicInitialAdd:!!plan&&plan.entries[0]?.decision.action==='ADD'&&plan.entries[0]?.targetFactId===null,
   allResolverCallsBound:operations.every(op=>boundCandidates.some(v=>v.binding.semanticId===op.semanticId))};
  assert.equal(status.memoryStatus,'complete','Actual memory stage failure');assert.equal(readiness.cutoff,2);assert.ok(readiness.stages.facts.indexedThrough>=2&&readiness.stages.vectors.indexedThrough>=2);out.assertions.contiguousReadinessThrough2=true;
  const selected=(name)=>rows[name].filter(r=>r.tenantId===scope.tenantId&&r.memorySpaceId===scope.memorySpaceId),ids=new Set(first.messageIds);
  assert.equal(selected('runtimeMemoryCaptures').length,1);assert.equal(selected('runtimeMemoryCaptureMessages').length,2);assert.equal(selected('runtimeTranscriptMessages').length,2);
  const native=await c.table('messages','agent');for(const id of ids){const message=native.find(r=>r._id===id);assert.ok(message&&message.status==='success'&&['user','assistant'].includes(message.message.role));
   const parts=message.message.content;assert.ok(Array.isArray(parts)&&parts.length===1&&parts[0].type==='text');assert.equal(parts[0].text,message.message.role==='user'?BODY:ANSWER);assert.equal(message.userId,granted.principalId);}
  const conversation=selected('runtimeConversations').find(r=>r.conversationId===first.conversationId);assert.ok(conversation&&conversation.manualWriteLocked===true);
  for(const r of selected('runtimeMemoryCaptureMessages')){assert.ok(ids.has(r.nativeMessageId));assert.equal(r.attribution,'external_capture');const m=JSON.parse(r.metadataCanonical);assert.equal(m.actorPrincipalId,granted.principalId);assert.equal(m.actorUserId,owner.metadataUserId);assert.equal(m.participantId,owner.metadataUserId);assert.equal(m.userName,firstParams.userName);assert.deepEqual(m.metadata,exact.metadata);assert.ok([first.requestId].includes(m.requestId));}
  const events=selected('runtimeIngestionEvents');assert.equal(events.length,2);assert.deepEqual(events.map(e=>e.sequence).sort((a,b)=>a-b),[1,2]);
  const canon=c.pure.policy.canonicalModelJson,allFacts=selected('facts').filter(f=>f.tombstonedAt===undefined),sourceRefs=[];let positive=false,attempts=0;
  for(const event of events){assert.equal(event.eligibility,'eligible');assert.equal(event.vectorsState,'complete');assert.equal(event.factsState,event.lineage.role==='user'?'complete':'skipped');assert.ok(ids.has(event.nativeMessageId));
   assert.equal(event.lineage.trust,event.lineage.role==='user'?'user_assertion':'assistant_claim');const source=selected('runtimeMemorySources').find(s=>canon(s.lineage)===canon(event.lineage));assert.ok(source&&source.tombstonedAt===undefined&&source.contentHash===event.contentHash&&source.ownerPrincipalId===granted.principalId);
   const prepared=await c.pure.sources.prepareSourceContent({...event.authorityReference},source.lineage,source.content,{now:()=>source.createdAt});assert.equal(prepared.source.contentHash,source.contentHash);
   const chunks=selected('runtimeMemoryChunks').filter(x=>x.sourceEventId===event.lineage.sourceEventId),vectors=selected('runtimeMemoryVectors').filter(v=>v.sourceEventId===event.lineage.sourceEventId);
   assert.equal(chunks.length,prepared.chunks.length);assert.equal(vectors.length,chunks.length);assert.ok(vectors.length>0);
   const vectorIdentity={sourceId:source.lineage.sourceId,sourceEventId:source.lineage.sourceEventId,sourceRevision:source.lineage.sourceRevision,stage:'vectors',semanticPolicyVersion:PROFILE},vectorReceiptId=await c.pure.sources.processingIdentityKey(vectorIdentity);
   const vectorReceipt=selected('runtimeMemoryReceipts').filter(r=>r.receiptId===vectorReceiptId);assert.equal(vectorReceipt.length,1);assert.equal(vectorReceipt[0].canonicalIdentity,canon(vectorIdentity));
   const payload=JSON.parse(vectorReceipt[0].canonicalPayload);assert.equal(payload.vectors.length,vectors.length);assert.equal(payload.chunks.length,chunks.length);
   const generation=selected('runtimeMemoryVectorGenerations').filter(r=>r.sourceEventId===source.lineage.sourceEventId&&r.profile.profileId===PROFILE);assert.equal(generation.length,1);assert.equal(generation[0].receiptId,vectorReceiptId);assert.equal(generation[0].contentHash,source.contentHash);
   for(const v of vectors){c.pure.profile.assertEmbeddingVector(v.embedding,v.profile);assert.equal(v.profile.profileId,PROFILE);const chunk=chunks.find(x=>x.chunkId===v.chunkId),expected=prepared.chunks.find(x=>x.chunkId===v.chunkId);assert.ok(chunk&&expected&&chunk.text===expected.text&&chunk.textHash===expected.textHash);
    const {_id,_creationTime,...stored}=chunk;assert.equal(canon(stored),canon(expected));assert.ok(payload.chunks.some(x=>canon(x)===canon(expected)));assert.equal(v.processingReceiptId,vectorReceiptId);
    const {_id:vectorId,_creationTime:vectorTime,embeddingLarge,profileId,scopeProfileKey,ownerPrincipalId,scopeProfileOwnerKey,...logical}=v;assert.ok(payload.vectors.some(x=>canon(x)===canon(logical)));assert.equal(ownerPrincipalId,granted.principalId);}
   const stages=selected('runtimeIngestionStages').filter(s=>s.eventId===event.eventId);assert.ok(stages.length>0&&stages.every(s=>s.attempt<2&&['complete','skipped'].includes(s.state)));
   const jobs=selected('runtimeIngestionJobs').filter(j=>j.eventId===event.eventId);assert.equal(jobs.length,1);const operations=selected('runtimeModelOperations').filter(o=>o.runAccountId===jobs[0].runAccountId);assert.ok(operations.length>=1);
   for(const op of operations){const a=rows.runtimeModelAttempts.filter(a=>a.operationDocumentId===op._id);assert.equal(a.length,1);const receipt=JSON.parse(a[0].terminalEvidenceCanonical),snapshot=JSON.parse(a[0].snapshotCanonical);
    assert.ok(a[0].slotReleased&&a[0].resultAttachmentState==='attached');assert.equal(receipt.nativeInterface,snapshot.nativeInterface);assert.ok(completeNativeTokenUsage(snapshot.nativeInterface,receipt.usage,a[0]));assert.equal(receipt.dispatchIdentity,a[0].dispatchIdentity);
    const retained=JSON.parse(a[0].privateResultCanonical);
    if(op.operationKey==='embedding.memory')for(const v of vectors)assert.ok(retained.vectors.some(x=>canon(x)===canon(v.embedding)));
    if(op.operationKey==='memory.extract'){assert.equal(event.lineage.role,'user');assert.equal(snapshot.pins.promptVersion,c.pure.policy.MEMORY_JSON_OBJECT_CONTRACT.promptVersion);c.pure.sources.parseSourceFactsResponse(JSON.parse(retained.text),source);}
    attempts++;}
   const account=rows.runtimeBudgetAccounts.find(a=>a._id===jobs[0].runAccountId);assert.ok(account&&account.reservedUnits===0&&account.activeConcurrency===0&&account.limitUnits<=3_000_000);
   sourceRefs.push(hash([event.lineage.sourceId,event.lineage.sourceEventId,event.lineage.sourceRevision]));
   for(const fact of allFacts.filter(f=>f.lineage?.sourceEventId===event.lineage.sourceEventId)){assert.equal(event.lineage.role,'user');assert.equal(fact.ownerPrincipalId,granted.principalId);if(/\b(?:cake|sorbet)\b/i.test(fact.fact))positive=true;}}
  assert.equal(positive,true,'A declared positive dessert preference must be attributed');
  const grant=rows.runtimeAuthGrants.find(g=>g._id===granted.grantId),principal=rows.runtimeAuthPrincipals.find(p=>p._id===granted.principalId),membership=rows.runtimeAuthMemberships.find(m=>m._id===granted.membershipId);
  assert.ok(grant&&grant.revokedAt===undefined&&grant.expiresAt>Date.now()&&grant.capabilities.includes('read')&&grant.capabilities.includes('write'));
  assert.ok(principal&&principal.deletedAt===undefined&&principal.revokedAt===undefined&&principal.version===granted.principalVersion);
  assert.ok(membership&&membership.deletedAt===undefined&&membership.revokedAt===undefined&&membership.principalId===granted.principalId&&membership.version===granted.membershipVersion);
  for(const memorySpaceId of [undefined,scope.memorySpaceId]){const state=rows.runtimeAuthScopes.filter(s=>s.tenantId===scope.tenantId&&s.memorySpaceId===memorySpaceId);assert.equal(state.length,1);assert.equal(state[0].deletedAt,undefined);assert.equal(state[0].epoch,memorySpaceId===undefined?granted.tenantEpoch:granted.memorySpaceEpoch);}
  assert.ok(!rows.runtimeAuthTombstones.some(t=>t.tenantId===scope.tenantId&&(t.resourceType==='tenant'||t.resourceType==='memorySpace'&&t.resourceId===scope.memorySpaceId||t.resourceType==='source'&&events.some(e=>e.lineage.sourceId===t.resourceId))));
  assert.ok(events.every(e=>e.authorityReference.principalId===granted.principalId&&e.authorityReference.grantId===granted.grantId&&e.authorityReference.grantVersion===grant.version));
  assert.ok(rows.runtimeBudgetAccounts.filter(a=>a.kind==='tenant'&&a.tenantId===scope.tenantId&&a.current).every(a=>a.limitUnits<=10_000_000));
  out.native={captureCount:1,traceRows:2,nativeMessageRows:2,eventCount:2,sourceRefsSha256:hash(sourceRefs),positiveDessertFact:true,assistantExternal:true,metadataMatches:true,currentGrant:true,nativeUsageAttempts:attempts};
  assert.ok(out.coverage.fullPrivatePlanCoverage&&out.coverage.allResolverCallsBound,'Complete exact private candidate binding required');
  if(out.coverage.retainedCandidates<2||!out.coverage.unequalSameSlotPairs.length){out.verdict='COVERAGE_UNAVAILABLE';out.coverage.reason='Extractor did not retain two unequal same-slot candidates';}
  else{assert.ok(out.coverage.deterministicInitialAdd,'Fresh-scope first candidate must use the original deterministic ADD');assert.ok(out.coverage.paidResolverCalls>=1,'Original subsequent candidate resolution required');assert.ok(out.coverage.resolverBindings.some(v=>v.matchedOrdinal>=1),'Resolver result must bind the subsequent original candidate');out.verdict='PASS';}
 }catch(e){out.verdict='FAIL';out.failedPhase=phase;out.error=scalarError(e);out.errorFingerprint={sha256:hash(String(e?.message??e)),bytes:Buffer.byteLength(String(e?.message??e))};}
 finally{let closeFailure=false;for(const v of clients.reverse()){try{await bound(v.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');}catch(e){closeFailure=true;out.closeError=scalarError(e);}}
  for(const port of ports){try{await bound(port.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');assert.equal(port.closed,true);}catch(e){closeFailure=true;out.closeError=scalarError(e);}}
  if(c)try{await bound(c.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');}catch(e){closeFailure=true;out.closeError=scalarError(e);}out.clientsClosed=!closeFailure;if(closeFailure)out.verdict='FAIL';
 }
 await fs.writeFile(receipt,JSON.stringify(out,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt,verdict:out.verdict,clientsClosed:out.clientsClosed,newCaptureIntents:out.newCaptureIntents,recallCalls:out.recallCalls,coverage:out.coverage,failedPhase:out.failedPhase,stages:out.stages}));return out.verdict==='PASS'&&out.clientsClosed?0:out.verdict==='COVERAGE_UNAVAILABLE'&&out.clientsClosed?2:1;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main(process.argv.slice(2));
