/** Official native log metadata only. No service/session/key reads until exact pins and per-phase Root GO. */
import {projectOccMetadata} from './occ-metadata-projection-next.mjs';
import {projectK20ModelBounds as projectEffortModelBounds} from './k20-model-bounds-projection.mjs';
import {projectLiteralTraceMetadata as projectEffortTraceMetadata} from './memory-effort-literal-latency-phase-projection.mjs';
import {K29_NATIVE_NAMES} from './k29-collector-pins.mjs';
import {parsePins,readReady,pendingMetadata,readReviewedSource,Q,KIT,PROOFS_ROOT} from './memory-effort-canonical-native-pins.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const CAPTURE_PHASES=Object.freeze(['before-turns','browser-pre-run','browser-post-run','browser-post-pair','cli-pre-run','cli-post-run','cli-post-pair','public-post-run','public-post-ordinary','supplemental-post-run']);
const NATIVE_NAMES=Object.freeze([...K29_NATIVE_NAMES,'runtimeMemoryQuery:directReads']);
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--local-preflight'){
 assert.equal(process.version,'v24.15.0');
 console.log(JSON.stringify({...pendingMetadata(),capturePhases:CAPTURE_PHASES,goVariable:'CORTEX_MEMORY_EFFORT_CANONICAL_CAPTURE_GO=<phase>',officialLogGetLimit:1,deadlineMs:30000,byteLimit:16777216,executionLimit:1000}));process.exit(0);
}
const capturePhase=args.shift();assert.ok(CAPTURE_PHASES.includes(capturePhase),'Exact authorized capture phase required');
let priorName;
if(args[0]==='--prior'){args.shift();priorName=args.shift();assert.match(priorName??'',/^memory-effort-canonical-service-log-snapshot-([a-z-]+)-\d+\.json$/);assert.ok(CAPTURE_PHASES.some(phase=>priorName.startsWith('memory-effort-canonical-service-log-snapshot-'+phase+'-')));}
assert(capturePhase==='before-turns'||priorName,'Subsequent phase must continue the one-GET prior cursor chain');assert(capturePhase!=='before-turns'||priorName===undefined,'Initial phase starts at cursor0');
const PINS=parsePins(args);assert.ok(!PINS.localPreflight,'Exact Root pins required');
assert.equal(process.version,'v24.15.0');assert.equal(process.env.HOME,'/Users/SaintNick');
assert.equal(process.env.CORTEX_MEMORY_EFFORT_CANONICAL_CAPTURE_GO,capturePhase,'Root explicit per-phase GO required before READY/session/service/private reads');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const safeString=value=>typeof value==='string'&&/^[a-zA-Z0-9+/_:.=-]{1,512}$/.test(value);
const identityFields=['id','name','kind','teamId','projectId','reference','deploymentType','isDefault','expiresAt','deploymentUrl','disposable'];
const result={version:1,status:'UNRUN',capturePhase,sessionId:PINS.sessionId,sourceCommit:PINS.sourceCommit,imageId:PINS.imageId,modelCalls:0,retries:0,mutations:0,officialLogGets:0,sessionReads:0,privateKeyReads:0,readerClosed:false,clientsClosed:false,rawPayloadRetained:false};
const destination=path.join(Q,'memory-effort-canonical-service-log-snapshot-'+capturePhase+'-'+Date.now()+'.json');
let key,reader;
try{
 await readReviewedSource(PINS);const ready=await readReady(PINS);
 const proposal=JSON.parse(await fs.readFile(path.join(Q,'memory-effort-canonical-package-integration-proposal.json'),'utf8')).next;
 const packaging=JSON.parse(await fs.readFile(path.join(Q,'memory-effort-canonical-package-report.json'),'utf8'));
 assert.equal(proposal.sourceReview.path,PINS.reviewPath);assert.equal(proposal.sourceReview.sha256,PINS.reviewSha256);assert.equal(proposal.sourceCommit,PINS.sourceCommit);assert.equal(proposal.imageId,PINS.imageId);assert.equal(proposal.kit,KIT);
 const manifestBytes=await fs.readFile(path.join(KIT,'image/archives/manifest.json')),manifest=JSON.parse(manifestBytes);
 assert.equal(hash(manifestBytes),proposal.artifactManifestSha256);assert.equal(manifest.sourceCommit,PINS.sourceCommit);
 assert.equal(manifest.backend.files,174);assert.equal(manifest.backend.manifestSha256,packaging.backend.manifestSha256);
 const {loadSession,createContext}=await import('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs');
 const {verifyCloud}=await import('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs');
 const exactSession=async session=>{
  assert.equal(session.id,PINS.sessionId);assert.equal(session.phase,'READY');assert.equal(session.ownerUid,process.getuid());assert.equal(session.ownerGid,process.getgid());
  assert.equal(session.launcherHost,os.hostname());assert.equal(session.launcherPid,PINS.launcherPid);process.kill(PINS.launcherPid,0);
  for(const field of identityFields)assert.equal(session.target[field],ready.target[field]);assert.ok(session.target.expiresAt>Date.now());
  assert.equal(session.container.id,ready.container.id);assert.equal(session.container.name,ready.container.name);assert.equal(session.container.imageId,PINS.imageId);
  const host=JSON.parse(await fs.readFile(path.join(session.receiptDir,'host-prepared.json'),'utf8'));
  assert.equal(host.sourceCommit,PINS.sourceCommit);assert.equal(host.backendManifestSha256,manifest.backend.manifestSha256);
 };
 const session=await loadSession(PROOFS_ROOT,PINS.sessionId);result.sessionReads++;await exactSession(session);
 const ctx=await createContext(session,{logger:()=>{}});ctx.persist=async()=>{};ctx.receipt=async()=>{};
 const managementFetch=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET');return managementFetch(url,options);};
 const target=await verifyCloud(session,ctx);for(const field of identityFields)assert.equal(target[field],ready.target[field]);
 const inspected=JSON.parse((await promisify(execFile)(ctx.docker,['container','inspect',session.container.id],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024})).stdout);assert.equal(inspected.length,1);
 const container=inspected[0];assert.equal(container.Id,ready.container.id);assert.equal(container.Name,'/'+ready.container.name);assert.equal(container.Image,PINS.imageId);
 assert.ok(container.State.Running&&!container.State.Paused&&!container.State.Restarting&&!container.State.Dead&&!container.State.OOMKilled);
 assert.equal(container.Config.Labels['dev.cortex.disposable-sandbox'],PINS.sessionId);assert.equal(container.Config.Labels['dev.cortex.disposable-sandbox.root'],session.runDir);
 result.verifiedTarget={sessionId:session.id,id:target.id,name:target.name,teamId:target.teamId,projectId:target.projectId,sourceCommit:PINS.sourceCommit,imageId:PINS.imageId,ownedContainerRunning:true,verifiedAt:Date.now()};
 let cursor=0;
 if(priorName){
  const prior=JSON.parse(await fs.readFile(path.join(Q,priorName),'utf8'));
  assert.equal(prior.status,'OFFICIAL_METADATA_CAPTURE_COMPLETE');assert.equal(prior.officialLogGets,1);assert.equal(prior.clientsClosed,true);assert.equal(prior.target.sessionId,PINS.sessionId);assert.equal(prior.target.name,ready.target.name);assert.equal(prior.target.id,PINS.targetId);
  assert.equal(prior.orchestration.sourceCommit,PINS.sourceCommit);assert.equal(prior.orchestration.imageId,PINS.imageId);
  assert.ok(Number.isFinite(prior.newCursor)&&prior.newCursor>=0);cursor=prior.newCursor;result.priorReceipt=priorName;
 }
 assert.equal(session.deploymentKeyPath,path.join(PROOFS_ROOT,'.sandbox-env-runs',PINS.sessionId,'secrets/dev-deploy-key.txt'));
 const stat=await fs.lstat(session.deploymentKeyPath);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&(stat.mode&0o077)===0);
 key=(await fs.readFile(session.deploymentKeyPath,'utf8')).trim();result.privateKeyReads++;assert.ok(key.startsWith('dev:'+ready.target.name+'|'));
 result.requestCursor=cursor;result.nativeProtocol='Convex1.46.0 cli/lib/logs.ts pollUdfLog stream_function_logs; one GET no retry';
 result.officialLogGets++;
 const response=await fetch(session.target.deploymentUrl+'/api/stream_function_logs?cursor='+cursor,{method:'GET',headers:{Authorization:'Convex '+key,'Convex-Client':'npm-cli-1.46.0','Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200,'Native log snapshot failed');reader=response.body.getReader();const chunks=[];let bytes=0;
 try{for(;;){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;assert.ok(bytes<=16777216,'Original log snapshot byte bound exceeded');chunks.push(item.value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();reader=undefined;result.readerClosed=true;}
 const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.ok(Array.isArray(raw.entries));assert.ok(Number.isFinite(raw.newCursor)&&raw.newCursor>=cursor,'Official monotone next cursor required');
 const phases=[],executions=[],modelBounds=[];
 function traceObject(message){let value=message.trim();for(let depth=0;depth<4;depth++){try{const decoded=JSON.parse(value);if(typeof decoded==='string'){value=decoded;continue;}return decoded;}catch{}if((value.startsWith("'")&&value.endsWith("'"))||(value.startsWith('"')&&value.endsWith('"'))){value=value.slice(1,-1);continue;}return null;}return null;}
 for(const entry of raw.entries){
  if(entry.kind==='Completion'){
   const projected={};for(const name of ['identifier','componentPath','udfType','kind','requestId','executionId'])if(safeString(entry[name]))projected[name]=entry[name];
   for(const name of ['timestamp','executionTimestamp','executionTime','userExecutionTime','returnBytes'])if(Number.isFinite(entry[name]))projected[name]=entry[name];
   projected.errorPresent=!!entry.error;projected.cachedResult=entry.cachedResult===true;projected.willRetry=entry.willRetry===true;
   if(Number.isSafeInteger(entry.occInfo?.retryCount))projected.occRetryCount=entry.occInfo.retryCount;projected.occInfo=projectOccMetadata(entry.occInfo);
   projected.usage=Object.fromEntries(Object.entries(entry.usageStats??{}).filter(([name,value])=>/^(database|vectorIndex|networkEgress|memoryUsed)/.test(name)&&typeof value==='number'&&Number.isFinite(value)));
   executions.push(projected);
  }
  for(const line of entry.logLines??[])for(const message of typeof line==='object'&&line!==null&&Array.isArray(line.messages)?line.messages:typeof line==='string'?[line]:[]){
   if(typeof message!=='string')continue;const event=traceObject(message),identity=Object.fromEntries(['identifier','executionId','requestId'].filter(name=>safeString(entry[name])).map(name=>[name,entry[name]]));
   const bounds=projectEffortModelBounds(event);if(bounds)modelBounds.push({...bounds,...identity,...Number.isFinite(entry.timestamp)?{timestamp:entry.timestamp}:{}});
   const projected=projectEffortTraceMetadata(event);if(!projected)continue;
   for(const [name,value]of Object.entries(projected))if(typeof value==='string'&&!safeString(value))delete projected[name];
   phases.push({...projected,...safeString(entry.identifier)?{functionPath:entry.identifier}:{},...safeString(entry.executionId)?{executionId:entry.executionId}:{}});
  }
 }
 assert.ok(executions.length<1000,'Native execution cap reached; complete coverage unavailable, do not truncate or continue as PASS');
 await exactSession(await loadSession(PROOFS_ROOT,session.id));result.sessionReads++;await verifyCloud(session,ctx);
 result.target={sessionId:session.id,name:session.target.name,id:session.target.id,reference:session.target.reference};
 result.orchestration={expectedFreshOrdinaryAction:'executeDirectV8',nativeExecutionCounts:Object.fromEntries(NATIVE_NAMES.map(name=>[name,executions.filter(row=>typeof row.identifier==='string'&&row.identifier.replace(/\.js(?=:)/,'').endsWith(name)).length])),sourceCommit:PINS.sourceCommit,imageId:PINS.imageId,manifestSha256:hash(manifestBytes),backendManifestSha256:manifest.backend.manifestSha256,note:'Counts observe official executions only; source/helper classes do not constitute native timing or qualification.'};
 result.phases=phases;result.executions=executions;result.modelBounds=modelBounds;result.newCursor=raw.newCursor;result.byteCount=bytes;result.executionCapHit=executions.length===1000;
 result.status=result.executionCapHit?'OFFICIAL_METADATA_CAPTURE_COMPLETE_CAP_HIT_COVERAGE_UNKNOWN':'OFFICIAL_METADATA_CAPTURE_COMPLETE';
 result.clockNote='UI/CLI monotonic SLO clocks are separate; workflow replay logs are not additive durations. Convex mutation Date.now is fixed within a transaction: zero timestamp delta does not mean zero execution time. Gateway phases join via raw64hex runBudgetId or hashed correlations. Native durationMs uses performance.now; absent/nonfinite duration is UNAVAILABLE. Admission submit uses a fixed hashed label: join executionId to the submit parent requestId; later start/get use actual run correlation.';
}catch(error){
 result.status='OFFICIAL_METADATA_CAPTURE_FAILED';result.error={name:error?.name??'Error',code:typeof error?.code==='string'&&safeString(error.code)?error.code:'UNCLASSIFIED',messageSha256:hash(String(error?.message??error))};process.exitCode=1;
}finally{
 if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();result.readerClosed=true;}
 key=undefined;result.clientsClosed=true;result.observedAt=new Date().toISOString();await fs.writeFile(destination,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({receipt:destination,status:result.status,capturePhase,sourceCommit:PINS.sourceCommit,target:result.target,phases:result.phases?.length,executions:result.executions?.length,modelBounds:result.modelBounds?.length,requestCursor:result.requestCursor,newCursor:result.newCursor,byteCount:result.byteCount,executionCapHit:result.executionCapHit,officialLogGets:result.officialLogGets,readerClosed:result.readerClosed,clientsClosed:true,retries:0,error:result.error}));
}
