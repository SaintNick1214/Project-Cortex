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
import {requireK24OrdinaryMemoryPins} from './k24-ordinary-memory-pins.mjs';
import {requireK24ReadyPins} from './k24-collector-pins.mjs';
const Q=path.dirname(fileURLToPath(import.meta.url)),KIT=path.join(PROOFS_ROOT,'manual-sandbox-foreground-priority-2026-10-14');
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
function eqIds(a,b){for(const k of ['receiptId','requestId','conversationId','principalId','messageIds','sourceEventIds'])assert.deepEqual(a[k],b[k]);}

const out={version:1,kind:'k24-exact-warm-facts-leaf',paidCalls:0,mutations:0,newCaptures:0,rawPrivatePayloadRetained:false,freshVerifications:0,tables:{},clientsClosed:false};
let c;
const allowedLeaf=new Set(['AMBIGUOUS_EXTRACTION_SLOT','INVALID_CONFIRMED_MODEL_OUTPUT','INVALID_BELIEF_DECISION','INVALID_BELIEF_PLAN','REPLAN_REQUIRED','INDEXING_OUTCOME_UNKNOWN','INDEXING_FAILED','INDEXING_ADMISSION_FAILED','CAPACITY_WAIT_EXPIRED','BUDGET_EXCEEDED','INTERRUPTED_REQUIRES_RECONCILIATION']);
try{
 assert.equal(process.env.CORTEX_K24_FAILED_STAGE_READ_GO,'1');
 const pins=requireK24ReadyPins(),options={...pins,id:pins.targetId};
 const runId=pins.runIds[1];assert.equal(runId,'run:7fc4069c7fddf2870aa6d9739a0546f08b6d4cba95de34c6255c698e4da884fb');
 c=await context(options,pins,out);c.mutateAdmin=async()=>{throw Error('READ_ONLY');};
 const rows={};for(const name of ['runtimeRuns','runtimeIngestionEvents','runtimeIngestionStages','runtimeIngestionJobs','runtimeModelOperations','runtimeModelAttempts','runtimeBudgetAccounts','runtimeMemorySources','facts'])rows[name]=await c.table(name);
 const exactly=xs=>{assert.equal(xs.length,1);return xs[0];};
 const run=exactly(rows.runtimeRuns.filter(x=>x.runId===runId)),scoped=x=>x.tenantId===run.tenantId&&x.memorySpaceId===run.memorySpaceId;
 const event=exactly(rows.runtimeIngestionEvents.filter(x=>scoped(x)&&x.runId===runId&&x.lineage.role==='user'));
 assert.equal(event.eventId,'ingestion:8c83a8a56e7d8a8def351051e3dbc254e00019aa65bc9c63383040baec47bd46');assert.equal(event.sequence,3);
 const stages=rows.runtimeIngestionStages.filter(x=>scoped(x)&&x.eventId===event.eventId),factsStage=exactly(stages.filter(x=>x.stage==='facts')),extract=exactly(stages.filter(x=>x.stage==='extract'));
 const job=exactly(rows.runtimeIngestionJobs.filter(x=>scoped(x)&&x.eventId===event.eventId)),account=exactly(rows.runtimeBudgetAccounts.filter(x=>x._id===job.runAccountId));
 const source=exactly(rows.runtimeMemorySources.filter(x=>scoped(x)&&c.pure.policy.canonicalModelJson(x.lineage)===c.pure.policy.canonicalModelJson(event.lineage)));
 assert.equal(source.contentHash,event.contentHash);
 const backend=path.join(c.s.backendDir,'node_modules/@cortexmemory/sdk/dist/backend/v1'),manifest=JSON.parse(await fs.readFile(path.join(backend,'manifest.json')));
 for(const [key,sourcePath]of Object.entries({conflicts:'src/domain/conflicts.ts',beliefs:'src/domain/belief-plan.ts'})){
  const f=exactly(manifest.files.filter(f=>f.sourcePath===sourcePath));const bytes=await fs.readFile(path.join(backend,f.path));assert.equal(hash(bytes),f.sha256);c.pure[key]=await import(pathToFileURL(path.join(backend,f.path)));
  (out.sourceModules??=[]).push({sourcePath,outputSha256:f.sha256,sourceSha256:f.sourceSha256});
 }
 const ops=rows.runtimeModelOperations.filter(x=>x.runAccountId===job.runAccountId);
 out.target={sessionId:pins.sessionId,name:pins.name,id:pins.targetId,sourceCommit:pins.sourceCommit};
 out.run={runId,eventId:event.eventId,sequence:event.sequence,factsState:event.factsState,vectorsState:event.vectorsState};
 out.stage={stage:'facts',state:factsStage.state,failureCode:allowedLeaf.has(factsStage.failureCode)?factsStage.failureCode:'UNCLASSIFIED_CODE',attempt:factsStage.attempt,leaseVersion:factsStage.leaseVersion,payloadPresent:typeof factsStage.payloadCanonical==='string',extractState:extract.state};
 out.account={reservedUnits:account.reservedUnits,settledUnits:account.settledUnits,uncertainUnits:account.uncertainUnits,activeConcurrency:account.activeConcurrency,current:account.current,cancelled:account.cancelled===true};
 out.native=[];const decisions=[];
 for(const op of ops){const a=exactly(rows.runtimeModelAttempts.filter(x=>x.operationDocumentId===op._id)),terminal=a.terminalEvidenceCanonical?JSON.parse(a.terminalEvidenceCanonical):undefined,snapshot=JSON.parse(a.snapshotCanonical);
  const n={operationKey:['memory.extract','facts.resolve','embedding.memory'].includes(op.operationKey)?op.operationKey:'OTHER',attemptState:a.state,attachment:a.resultAttachmentState,slotReleased:a.slotReleased,withheld:a.resultWithheld===true,terminalOutcome:terminal?.outcome,usageComplete:completeNativeTokenUsage(snapshot.nativeInterface,terminal?.usage,a),usage:terminal?.usage&&Object.fromEntries(['inputTokens','outputTokens','totalTokens','cachedInputTokens','reasoningTokens'].filter(k=>Number.isFinite(terminal.usage[k])).map(k=>[k,terminal.usage[k]])),costProvenance:a.costProvenance,reservationUnits:a.reservationUnits,settledCostUnits:a.settledCostUnits};
  if(op.operationKey==='facts.resolve'){const retained=JSON.parse(a.privateResultCanonical);assert.equal(typeof retained.text,'string');const d=c.pure.conflicts.parseConflictDecision(retained.text);decisions.push(d);n.parsedAction=d.action;n.targetPresent=typeof d.targetFactId==='string';}
  out.native.push(n);
 }
 assert.equal(extract.state,'complete');const candidates=JSON.parse(extract.payloadCanonical);assert.ok(Array.isArray(candidates));
 const shape=x=>({...x,subject:x.subject?.trim().toLowerCase(),predicate:x.predicate?.trim().toLowerCase()});
 const pair=[];for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++)if(c.pure.beliefs.beliefSlot(candidates[i])===c.pure.beliefs.beliefSlot(candidates[j])){
  const l=candidates[i],rr=candidates[j],ls=shape(l),rs=shape(rr);
  pair.push({left:i,right:j,sameNormalizedSlot:true,sameLineage:c.pure.policy.canonicalModelJson(l.lineage)===c.pure.policy.canonicalModelJson(rr.lineage),sameExactCandidate:c.pure.policy.canonicalModelJson(ls)===c.pure.policy.canonicalModelJson(rs),sameObject:l.object===rr.object,sameFact:l.fact===rr.fact,sameConfidence:l.confidence===rr.confidence,sameTags:c.pure.policy.canonicalModelJson(l.tags)===c.pure.policy.canonicalModelJson(rr.tags),sameEntities:c.pure.policy.canonicalModelJson(l.entities)===c.pure.policy.canonicalModelJson(rr.entities),sameRelations:c.pure.policy.canonicalModelJson(l.relations)===c.pure.policy.canonicalModelJson(rr.relations),differentAllowedFields:['fact','factType','subject','predicate','object','confidence','tags','entities','relations','lineage'].filter(k=>c.pure.policy.canonicalModelJson(ls[k]??null)!==c.pure.policy.canonicalModelJson(rs[k]??null)),leftSha256:hash(ls),rightSha256:hash(rs)});
 }
 out.extraction={candidateCount:candidates.length,storedPayloadBytes:Buffer.byteLength(extract.payloadCanonical),storedPayloadSha256:hash(extract.payloadCanonical),duplicateSlots:pair};
 const existing=rows.facts.filter(x=>scoped(x)&&x.ownerPrincipalId===source.ownerPrincipalId&&x.tombstonedAt===undefined);
 out.currentExistingCount=existing.length;out.currentFactsChangedAfterFailure=existing.some(x=>x.updatedAt>factsStage.updatedAt);
 // This is an installed pure source comparison, not recovery or a paid replay.
 let resolutionCalls=0;
 try{await c.pure.beliefs.planBeliefs({eventId:event.eventId,sequence:event.sequence,source,candidates,existing,resolve:async()=>{const d=decisions[resolutionCalls++];assert.ok(d);return d;}});out.installedPlanner={accepted:true,resolutionCalls};}
 catch(e){const m=Object.getOwnPropertyDescriptor(e,'message')?.value;out.installedPlanner={accepted:false,resolutionCalls,failureCode:allowedLeaf.has(m)?m:'UNCLASSIFIED_CODE'};}
 out.verdict='CLASSIFIED';
}catch(e){out.verdict='CLASSIFICATION_FAIL';out.error=scalarError(e);}
finally{try{if(c)await bound(c.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');out.clientsClosed=true;}catch{out.clientsClosed=false;}}
const receipt=path.join(Q,'k24-exact-warm-facts-leaf-'+Date.now()+'.json');await fs.writeFile(receipt,JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({receipt,verdict:out.verdict,clientsClosed:out.clientsClosed,stage:out.stage,account:out.account,extraction:out.extraction,installedPlanner:out.installedPlanner,native:out.native}));process.exitCode=out.verdict==='CLASSIFIED'&&out.clientsClosed?0:1;
