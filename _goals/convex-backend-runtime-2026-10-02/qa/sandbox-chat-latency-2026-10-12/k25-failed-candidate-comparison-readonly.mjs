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
import {requireK25ReadyPins,requireK25Run} from './k25-collector-pins.mjs';

export function compareStoredCandidates(candidates, canonical){
 const keys=['fact','factType','subject','predicate','object','confidence','tags','entities','relations','lineage'];
 const property=(x,key)=>Object.hasOwn(x,key)?canonical(x[key]):'<absent>';
 const normalized=x=>({...x,subject:x.subject?.trim().toLowerCase(),predicate:x.predicate?.trim().toLowerCase()});
 const slot=x=>JSON.stringify(x.subject&&x.predicate?[x.subject.trim().toLowerCase(),x.predicate.trim().toLowerCase()]:['text',x.fact.trim().toLowerCase()]);
 const candidateInfo=candidates.map(x=>({allowedKeys:keys.filter(k=>Object.hasOwn(x,k)),confidence:x.confidence,kindType:typeof x.factType,wordingSha256:hash(x.fact),valueSha256:Object.hasOwn(x,'object')?hash(x.object):null,
  slotSha256:hash(slot(x)),lineageSha256:hash(canonical(x.lineage)),tagsSha256:hash(property(x,'tags')),entitiesSha256:hash(property(x,'entities')),relationsSha256:hash(property(x,'relations')),candidateIdFieldPresent:['id','candidateId','factId','ordinal'].some(k=>Object.hasOwn(x,k))}));
 const pairs=[];for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
  const l=candidates[i],rr=candidates[j],ls=normalized(l),rs=normalized(rr),equal=k=>property(ls,k)===property(rs,k);
  pairs.push({left:i,right:j,sameNormalizedSlot:slot(l)===slot(rr),sameExactCandidate:canonical(ls)===canonical(rs),sameLineage:equal('lineage'),sameKind:equal('factType'),sameValue:equal('object'),sameWording:equal('fact'),sameConfidence:equal('confidence'),sameTags:equal('tags'),sameEntities:equal('entities'),sameRelations:equal('relations'),differentAllowedFields:keys.filter(k=>!equal(k)),leftSha256:hash(canonical(ls)),rightSha256:hash(canonical(rs))});
 }
 return {candidateCount:candidates.length,candidates:candidateInfo,pairs};
}
const out={version:1,kind:'k25-exact-warm-candidate-comparison',paidCalls:0,mutations:0,newCaptures:0,nativeQueries:0,rawPrivatePayloadRetained:false,freshVerifications:0,tables:{},clientsClosed:false};
let c;
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
try{
 assert.equal(process.env.CORTEX_K25_FAILED_CANDIDATE_READ_GO,'1');const pins=requireK25ReadyPins(),options={...pins,id:pins.targetId};
 assert.equal(process.argv.length,3,'RUN_INDEX required only after a failed fresh proof and explicit read-only GO');
 const runIndex=Number(process.argv[2]),runId=pins.runIds[runIndex];requireK25Run(runIndex,runId);
 const proofPath=process.env.CORTEX_K25_FAILED_STAGE_PROOF_RECEIPT;assert.ok(typeof proofPath==='string');
 assert.equal(path.dirname(path.resolve(proofPath)),Q);assert.match(path.basename(proofPath),/^k25-memory-native-v2-four-run-verification-\d+\.json$/);
 const proof=JSON.parse(await fs.readFile(proofPath,'utf8'));assert.equal(proof.passed,false);assert.equal(proof.readOnly,true);assert.equal(proof.freshVerifications,45);
 assert.equal(proof.target.sessionId,pins.sessionId);assert.equal(proof.target.name,pins.name);assert.equal(proof.target.id,pins.targetId);
 assert.deepEqual(proof.runs.map(run=>run.runId),pins.runIds);
 const userEvent=proof.runs[runIndex].events.find(event=>event.role==='user');assert.ok(userEvent);assert.equal(userEvent.passed,false);
 const eventId=userEvent.eventId,expectedSequence=userEvent.sequence,stageAttempt=userEvent.stages.find(stage=>stage.stage==='facts')?.attempt;
 assert.match(eventId,/^ingestion:[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(stageAttempt)&&stageAttempt>0);
 c=await context(options,pins,out);c.mutateAdmin=async()=>{throw Error('READ_ONLY');};
 const backend=path.join(c.s.backendDir,'node_modules/@cortexmemory/sdk/dist/backend/v1'),manifest=JSON.parse(await fs.readFile(path.join(backend,'manifest.json'))),sourceModules=[];
 for(const [key,sourcePath]of Object.entries({conflicts:'src/domain/conflicts.ts',beliefs:'src/domain/belief-plan.ts',ingestion:'src/domain/ingestion.ts'})){
  const f=manifest.files.find(f=>f.sourcePath===sourcePath);assert.ok(f);const bytes=await fs.readFile(path.join(backend,f.path));assert.equal(hash(bytes),f.sha256);c.pure[key]=await import(pathToFileURL(path.join(backend,f.path)));sourceModules.push({sourcePath,outputSha256:f.sha256,sourceSha256:f.sourceSha256});
 }
 const semanticId=await c.pure.profile.semanticHash(c.pure.policy.canonicalModelJson(['facts.resolve',eventId+':facts:'+stageAttempt+':0',c.pure.ingestion.BELIEF_POLICY_VERSION]));
 const binding={tenantId:c.s.publicRuntime.tenantId,memorySpaceId:c.s.publicRuntime.memorySpaceId,eventId,runId,semanticId,expectedSequence,beliefVersion:c.pure.ingestion.BELIEF_POLICY_VERSION};
 const querySource='import {query} from "convex:/_system/repl/wrappers.js";\nexport default query({handler:async(ctx)=>{const b='+JSON.stringify(binding)+';const one=xs=>{if(xs.length!==1)throw Error("EXACT_OWNED_ROW_REQUIRED");return xs[0];};const event=one(await ctx.db.query("runtimeIngestionEvents").withIndex("by_event",q=>q.eq("tenantId",b.tenantId).eq("memorySpaceId",b.memorySpaceId).eq("eventId",b.eventId)).take(2));if(event.runId!==b.runId||event.sequence!==b.expectedSequence||event.lineage.role!=="user"||event.beliefVersion!==b.beliefVersion)throw Error("EXACT_OWNED_EVENT_REQUIRED");const stage=async name=>one(await ctx.db.query("runtimeIngestionStages").withIndex("by_event_stage",q=>q.eq("tenantId",b.tenantId).eq("memorySpaceId",b.memorySpaceId).eq("eventId",b.eventId).eq("stage",name)).take(2));const extract=await stage("extract"),facts=await stage("facts");const source=one(await ctx.db.query("runtimeMemorySources").withIndex("by_scope_event",q=>q.eq("tenantId",b.tenantId).eq("memorySpaceId",b.memorySpaceId).eq("lineage.sourceEventId",event.lineage.sourceEventId)).take(2));if(source.contentHash!==event.contentHash||source.ownerPrincipalId!==event.ownerPrincipalId||source.tombstonedAt!==undefined||source.lineage.sourceRevision!==event.lineage.sourceRevision)throw Error("CURRENT_SOURCE_REQUIRED");const operation=one(await ctx.db.query("runtimeModelOperations").withIndex("by_identity",q=>q.eq("tenantId",b.tenantId).eq("memorySpaceId",b.memorySpaceId).eq("principalId",event.authorityReference.principalId).eq("semanticId",b.semanticId).eq("operationKey","facts.resolve")).take(2));const attempt=one(await ctx.db.query("runtimeModelAttempts").withIndex("by_operation",q=>q.eq("operationDocumentId",operation._id)).take(2));return {event,source,extract,facts,operation,attempt,documents:6};}});';
 await c.verify();let result;
 try{const key=await privateRead(c.s.deploymentKeyPath);out.nativeQueries++;
  const response=await fetch(c.s.target.deploymentUrl+'/api/run_test_function',{method:'POST',headers:{Authorization:'Convex '+key,'Content-Type':'application/json','Convex-Client':'npm-cli-1.46.0'},body:JSON.stringify({adminKey:key,args:{},bundle:{path:'testQuery.js',source:querySource},format:'convex_encoded_json'}),redirect:'error',signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.status,'success','Official read-only query failed');assert.equal((body.logLines??[]).length,0);result=body.value;
 }finally{await c.verify();}
 // Only fixed indexed reads above; no table/list scan or database write.
 assert.equal(result.documents,6);const {event,source,extract,facts,operation,attempt}=result;
 assert.ok(['dead_letter','unknown','failed'].includes(facts.state),'Exact source must still have a failed facts stage');assert.equal(facts.attempt,stageAttempt);assert.equal(extract.state,'complete');
 const candidates=JSON.parse(extract.payloadCanonical);assert.ok(Array.isArray(candidates));const canonical=c.pure.policy.canonicalModelJson;
 const comparison=compareStoredCandidates(candidates,canonical);
 const retained=JSON.parse(attempt.privateResultCanonical),envelope=JSON.parse(attempt.canonical),request=envelope.request??envelope,decision=c.pure.conflicts.parseConflictDecision(retained.text),snapshot=JSON.parse(attempt.snapshotCanonical),terminal=JSON.parse(attempt.terminalEvidenceCanonical);
 const messageParts=(request.messages??[]).flatMap(m=>m.parts??[]).filter(p=>p.type==='text'),texts=messageParts.map(p=>p.text);
 const promptIds=texts.flatMap(text=>[...text.matchAll(/\[ID: ([^\]\n]+)\]/g)].map(m=>m[1]));
 const ownLineage=canonical(source.lineage);out.target={sessionId:pins.sessionId,name:pins.name,id:pins.targetId,sourceCommit:pins.sourceCommit};
 out.sourceModules=sourceModules;out.documents=6;out.event={eventId:event.eventId,sequence:event.sequence,factsState:event.factsState,vectorsState:event.vectorsState,sourceBindingMatches:candidates.every(x=>canonical(x.lineage)===ownLineage),ownerMatches:source.ownerPrincipalId===event.ownerPrincipalId,currentSourceHashMatches:source.contentHash===event.contentHash};
 out.stage={state:facts.state,failureCode:facts.failureCode,attempt:facts.attempt,leaseVersion:facts.leaseVersion,extractPayloadSha256:hash(extract.payloadCanonical)};
 out.comparison=comparison;out.decision={action:decision.action,targetReferenceType:decision.targetFactId===null?'null':typeof decision.targetFactId,targetReferencePresent:typeof decision.targetFactId==='string',targetReferenceInAdmittedPrompt:typeof decision.targetFactId==='string'&&promptIds.includes(decision.targetFactId),operationSemanticIdentityMatches:operation.semanticId===semanticId,requestKeys:Object.keys(request).filter(k=>['semanticId','childCallId','source','messages','ordinal','candidateId','operationId','inputTokens','maximumOutputTokens'].includes(k)),requestOrdinalPresent:Object.hasOwn(request,'ordinal'),requestCandidateIdPresent:Object.hasOwn(request,'candidateId'),attemptOrdinal:attempt.ordinal,attemptNumber:attempt.attemptNumber,promptCandidateOrdinalFieldPresent:texts.some(t=>/(?:candidateId|candidateOrdinal|ordinal)[=:]/.test(t)),candidateInPromptExactWordings:candidates.map(x=>texts.some(t=>t.includes('Fact: "'+x.fact+'"'))),existingPromptReferenceCount:promptIds.length,resultSha256:hash(retained.text),resultBytes:Buffer.byteLength(retained.text),terminalOutcome:terminal.outcome,usageComplete:completeNativeTokenUsage(snapshot.nativeInterface,terminal.usage,attempt),slotReleased:attempt.slotReleased,resultAttachmentState:attempt.resultAttachmentState};
 if(typeof facts.payloadCanonical==='string'){
  const plan=JSON.parse(facts.payloadCanonical),selected=await c.pure.beliefs.sourceCandidateBindings({eventId,sequence:event.sequence,source,candidates,attempt:stageAttempt});
  out.privatePlan={candidateBindingVersion:plan.candidateBindingVersion??null,entries:Array.isArray(plan.entries)?plan.entries.length:null,
   fullCandidateCoverage:Array.isArray(plan.entries)&&canonical(plan.entries.map(entry=>entry.candidate))===canonical(selected.map(value=>value.candidate)),
   exactBindings:Array.isArray(plan.entries)&&canonical(plan.entries.map(entry=>entry.candidateBinding??null))===canonical(selected.map(value=>value.binding)),
   bindings:Array.isArray(plan.entries)?plan.entries.map(entry=>({sourceOrdinal:entry.candidateBinding?.sourceOrdinal??null,ordinal:entry.ordinal,candidateIdSha256:entry.candidateBinding?.candidateId?hash(entry.candidateBinding.candidateId):null})):[]};
 }
 out.completeEquivalence=comparison.pairs.every(x=>!x.sameNormalizedSlot||x.sameExactCandidate);out.verdict='CLASSIFIED';
}catch(e){out.verdict='CLASSIFICATION_FAIL';out.error=scalarError(e);}
finally{try{if(c)await bound(c.close(),1500,'DIAGNOSTIC_CLOSE_TIMEOUT');out.clientsClosed=true;}catch{out.clientsClosed=false;}}
const receipt=path.join(Q,'k25-exact-warm-candidate-comparison-'+Date.now()+'.json');await fs.writeFile(receipt,JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({receipt,verdict:out.verdict,clientsClosed:out.clientsClosed,nativeQueries:out.nativeQueries,documents:out.documents,stage:out.stage,comparison:out.comparison,decision:out.decision,completeEquivalence:out.completeEquivalence}));process.exitCode=out.verdict==='CLASSIFIED'&&out.clientsClosed?0:1;
}
