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
const runIds=['run:0297688c5141af8e763e6b1fea6da5a6b11417d0092992bbe1b549c373d97d13','run:1351af06c7c92d2979c37f951e663d33c2a71c6dca51d59bd960e268c0cfabf3'];
const out={version:1,kind:'exact-k22-facts-unknown',rawPayloadRetained:false,paidCalls:0,mutations:0,newCaptures:0,freshVerifications:0,tables:{},clientsClosed:false};let c;
try{
 assert.equal(process.env.CORTEX_K22_FACTS_UNKNOWN_READ_GO,'1');const raw=requireK22ReadyPins(),pins={...raw,id:raw.targetId};
 const options={sessionId:pins.sessionId,name:pins.name,id:pins.id,expiresAt:pins.expiresAt,sourceCommit:pins.sourceCommit,imageId:pins.imageId,manifestSha256:pins.manifestSha256,sdkArchiveSha256:pins.sdkArchiveSha256};
 c=await context(options,pins,out);c.mutateAdmin=async()=>{throw Error('READ_ONLY');};out.target={sessionId:pins.sessionId,name:pins.name,id:pins.id,sourceCommit:pins.sourceCommit};
 const backend=path.join(c.s.backendDir,'node_modules/@cortexmemory/sdk/dist/backend/v1'),bm=JSON.parse(await fs.readFile(path.join(backend,'manifest.json')));
 for(const [key,sourcePath]of Object.entries({conflicts:'src/domain/conflicts.ts',beliefs:'src/domain/belief-plan.ts'})){const file=bm.files.find(f=>f.sourcePath===sourcePath);assert.ok(file);assert.equal(hash(await fs.readFile(path.join(backend,file.path))),file.sha256);c.pure[key]=await import(pathToFileURL(path.join(backend,file.path)));}
 const rows={};for(const name of ['runtimeRuns','runtimeIngestionEvents','runtimeIngestionStages','runtimeIngestionJobs','runtimeModelOperations','runtimeModelAttempts','runtimeMemorySources','facts'])rows[name]=await c.table(name);
 out.runs=[];
 for(const runId of runIds){
  const runs=rows.runtimeRuns.filter(r=>r.runId===runId);assert.equal(runs.length,1);const run=runs[0];
  const events=rows.runtimeIngestionEvents.filter(e=>e.runId===runId&&e.tenantId===run.tenantId&&e.memorySpaceId===run.memorySpaceId&&e.lineage.role==='user');assert.equal(events.length,1);const event=events[0];
  const stages=rows.runtimeIngestionStages.filter(s=>s.eventId===event.eventId&&s.tenantId===event.tenantId&&s.memorySpaceId===event.memorySpaceId),facts=stages.find(s=>s.stage==='facts'),extract=stages.find(s=>s.stage==='extract');
  const jobs=rows.runtimeIngestionJobs.filter(j=>j.eventId===event.eventId&&j.tenantId===event.tenantId&&j.memorySpaceId===event.memorySpaceId);assert.equal(jobs.length,1);
  const source=rows.runtimeMemorySources.find(s=>s.tenantId===event.tenantId&&s.memorySpaceId===event.memorySpaceId&&c.pure.policy.canonicalModelJson(s.lineage)===c.pure.policy.canonicalModelJson(event.lineage));assert.ok(source&&source.contentHash===event.contentHash);
  const ops=rows.runtimeModelOperations.filter(o=>o.runAccountId===jobs[0].runAccountId);const result={runId,eventId:event.eventId,sequence:event.sequence,factsState:facts.state,failureCode:facts.failureCode,extractState:extract.state,attempt:facts.attempt,draftPresent:typeof facts.payloadCanonical==='string',operations:[]};
  for(const op of ops){const attempts=rows.runtimeModelAttempts.filter(a=>a.operationDocumentId===op._id);assert.equal(attempts.length,1);const a=attempts[0],receipt=a.terminalEvidenceCanonical?JSON.parse(a.terminalEvidenceCanonical):undefined,snapshot=JSON.parse(a.snapshotCanonical);
   const metadata={operationKey:op.operationKey,state:a.state,attachment:a.resultAttachmentState,withheld:a.resultWithheld,slotReleased:a.slotReleased,terminalOutcome:receipt?.outcome,completeUsage:completeNativeTokenUsage(snapshot.nativeInterface,receipt?.usage,a),outputPresent:typeof a.privateResultCanonical==='string'};
   if(op.operationKey==='facts.resolve'&&a.privateResultCanonical){
    const retained=JSON.parse(a.privateResultCanonical),requestEnvelope=JSON.parse(a.canonical),request=requestEnvelope.request??requestEnvelope;
    assert.equal(typeof retained.text,'string');metadata.resultBytes=Buffer.byteLength(retained.text);metadata.resultSha256=hash(retained.text);
    const promptIds=[];for(const message of request.messages??[])for(const part of message.parts??[])if(part.type==='text')for(const match of part.text.matchAll(/\[ID: ([^\]\n]+)\]/g))promptIds.push(match[1]);
    metadata.admittedPromptExistingCount=promptIds.length;metadata.promptBytes=Buffer.byteLength(c.pure.policy.canonicalModelJson(request.messages));
    let decision;try{decision=c.pure.conflicts.parseConflictDecision(retained.text);metadata.parserAccepted=true;}catch(error){metadata.parserAccepted=false;const message=Object.getOwnPropertyDescriptor(error,'message')?.value;
     metadata.parserClass=typeof message==='string'&&message.startsWith('No JSON object')?'MISSING_JSON':typeof message==='string'&&message.startsWith('Invalid action:')?'INVALID_ACTION':typeof message==='string'&&message.startsWith('Failed to parse JSON:')?'MALFORMED_JSON':'PARSER_REFUSAL';}
    if(decision){metadata.action=decision.action;metadata.targetPresent=Boolean(decision.targetFactId);metadata.targetInAdmittedPrompt=Boolean(decision.targetFactId&&promptIds.includes(decision.targetFactId));metadata.mergedFactPresent=Boolean(decision.mergedFact);
     metadata.confidenceFinite=Number.isFinite(decision.confidence);metadata.confidenceInRange=Number.isFinite(decision.confidence)&&decision.confidence>=0&&decision.confidence<=100;
     const inputCandidates=JSON.parse(extract.payloadCanonical);const existing=rows.facts.filter(f=>f.tenantId===event.tenantId&&f.memorySpaceId===event.memorySpaceId&&f.ownerPrincipalId===event.ownerPrincipalId&&f.tombstonedAt===undefined);
     metadata.currentExistingCount=existing.length;metadata.currentRowsChangedAfterFailure=existing.some(f=>f.updatedAt>facts.updatedAt);
     const check=c.pure.conflicts.validateConflictDecision(decision,existing);metadata.genericDecisionValid=check.valid;metadata.noneMissingTarget=decision.action==='NONE'&&!decision.targetFactId;metadata.addUnexpectedTarget=decision.action==='ADD'&&Boolean(decision.targetFactId);
     try{await c.pure.beliefs.planBeliefs({eventId:event.eventId,sequence:event.sequence,source,candidates:inputCandidates,existing,resolve:async()=>decision});metadata.actualPlannerAccepted=true;}
     catch(error){const message=Object.getOwnPropertyDescriptor(error,'message')?.value;metadata.actualPlannerAccepted=false;metadata.plannerClass=['INVALID_BELIEF_PLAN','AMBIGUOUS_EXTRACTION_SLOT','INVALID_BELIEF_DECISION'].includes(message)?message:'PLANNER_REFUSAL';}
    }
   }
   result.operations.push(metadata);
  }
  out.runs.push(result);
 }
 out.verdict='CLASSIFIED';
}catch(error){out.verdict='CLASSIFICATION_FAIL';out.error=scalarError(error);}
finally{try{if(c)await bound(c.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');out.clientsClosed=true;}catch{out.clientsClosed=false;}}
const receipt=path.join(Q,'k22-facts-unknown-native-'+Date.now()+'.json');await fs.writeFile(receipt,JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({receipt,verdict:out.verdict,clientsClosed:out.clientsClosed,runs:out.runs}));process.exitCode=out.verdict==='CLASSIFIED'&&out.clientsClosed?0:1;
