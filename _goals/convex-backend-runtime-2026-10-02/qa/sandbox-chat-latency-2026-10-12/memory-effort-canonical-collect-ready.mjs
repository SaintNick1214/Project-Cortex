/** Read actual fresh startup receipts after Root supplies pins and GO; never provisions or performs inference. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Q,PROOFS_ROOT,KIT,parsePins,pendingMetadata,requireTsxLoader,verifyRuntimeIdentity,readReviewedSource,assertSessionIdentity} from './memory-effort-canonical-native-pins.mjs';
let pins;
try{pins=parsePins(process.argv.slice(2));}catch{console.log(JSON.stringify({...pendingMetadata(),pinValidation:'PENDING_OR_INVALID'}));process.exitCode=2;}
if(pins){if(pins.localPreflight||process.env.CORTEX_MEMORY_EFFORT_CANONICAL_READY_GO!=='1'){
 console.log(JSON.stringify({...pendingMetadata(),collector:'ACTUAL_STARTUP_READY_READ_ONLY'}));if(!pins.localPreflight)process.exitCode=2;
}else await collect();}
async function collect(){
 assert.equal(process.version,'v24.15.0');assert.equal(process.env.HOME,'/Users/SaintNick');requireTsxLoader();await readReviewedSource(pins);
 const {loadSession,createContext}=await import('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs');
 const {verifyCloud}=await import('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs');
 const s=await loadSession(PROOFS_ROOT,pins.sessionId);assertSessionIdentity(pins,s);
 assert.equal(s.phase,'READY');assert.equal(s.launcherPid,pins.launcherPid);assert.equal(s.launcherHost,os.hostname());
 assert.equal(s.ownerUid,process.getuid());assert.equal(s.ownerGid,process.getgid());process.kill(s.launcherPid,0);
 assert.equal(s.target.id,pins.targetId);assert.equal(s.target.teamId,325340);assert.equal(s.target.projectId,3200658);
 assert.equal(s.target.reference,'dev/cortex-sandbox-'+s.id);assert.equal(s.target.deploymentUrl,'https://'+s.target.name+'.convex.cloud');
 const ctx=await createContext(s,{logger:()=>{}});ctx.persist=async()=>{};ctx.receipt=async()=>{};
 const fetchManagement=ctx.fetch;ctx.fetch=(url,args={})=>{assert.equal((args.method??'GET').toUpperCase(),'GET');return fetchManagement(url,args);};
 await readReviewedSource(pins);await verifyRuntimeIdentity(ctx,pins);
 const target=await verifyCloud(s,ctx);for(const field of ['id','name','reference','expiresAt','deploymentUrl'])assert.equal(target[field],s.target[field]);
 assert.ok(target.disposable&&!target.isDefault&&target.deploymentType==='dev'&&target.expiresAt>Date.now());
 const manifestBytes=await fs.readFile(path.join(KIT,'image/archives/manifest.json')),manifest=JSON.parse(manifestBytes);
 assert.equal(manifest.sourceCommit,pins.sourceCommit);assert.equal(manifest.node,'24.15.0');assert.equal(manifest.npm,'12.2.0');
 assert.ok(Number.isSafeInteger(manifest.backend.files)&&manifest.backend.files>0);
 const hostPrepared=JSON.parse(await fs.readFile(path.join(s.receiptDir,'host-prepared.json'),'utf8'));
 assert.equal(hostPrepared.sourceCommit,pins.sourceCommit);assert.equal(hostPrepared.backendManifestSha256,manifest.backend.manifestSha256);
 const format='{"id":{{json .Id}},"image":{{json .Image}},"running":{{json .State.Running}},"paused":{{json .State.Paused}},"oomKilled":{{json .State.OOMKilled}},"labels":{{json .Config.Labels}}}';
 const container=JSON.parse((await promisify(execFile)(ctx.docker,['container','inspect','--format',format,s.container.id],{encoding:'utf8',timeout:30000,maxBuffer:65536})).stdout);
 assert.equal(container.id,s.container.id);assert.equal(container.image,pins.imageId);assert.equal(s.container.imageId,pins.imageId);
 assert.ok(container.running&&!container.paused&&!container.oomKilled);assert.equal(container.labels['dev.cortex.disposable-sandbox'],s.id);assert.equal(container.labels['dev.cortex.disposable-sandbox.root'],s.runDir);
 const batchBytes=await fs.readFile(path.join(s.receiptDir,'qualification-batch-evaluation.json')),startupBatch=JSON.parse(batchBytes);
 assert.equal(startupBatch.actualSuccessfulMethods,8);assert.equal(startupBatch.dispatches,8);assert.equal(startupBatch.fullUnknownLiabilityUnits,2700000);
 assert.equal(startupBatch.activeConcurrency,0);assert.equal(startupBatch.freshActualOutcomes,true);assert.equal(startupBatch.oldQualificationDatesReused,false);
 const extractionBytes=await fs.readFile(path.join(s.receiptDir,'raw-jsonExtract.json')),extraction=JSON.parse(extractionBytes);
 assert.equal(extraction.error,null);assert.equal(extraction.completionError,null);assert.deepEqual(JSON.parse(extraction.result.text),{facts:[]});assert.deepEqual(extraction.result.parsedFacts,[]);
 const admitted=extraction.events.filter(event=>event.phase==='admit');assert.equal(admitted.length,1);
 const nativeFormat=JSON.parse(admitted[0].nativeFormat);assert.equal(nativeFormat.type,'json');assert.equal(nativeFormat.name,'cortex_facts_v1');
 assert.equal(nativeFormat.schema.additionalProperties,false);assert.deepEqual(nativeFormat.schema.required,['facts']);
 const runtimeBytes=await fs.readFile(path.join(s.receiptDir,'runtime-ready.json')),runtime=JSON.parse(runtimeBytes);
 assert.equal(runtime.status,'QUALIFIED_DISPOSABLE_RUNTIME_READY');assert.equal(runtime.ownerSessionAndManagedDefaultProfilePass,true);
 assert.equal(runtime.metadata.sessionId,s.id);assert.equal(runtime.metadata.inputSelectionVersion,2);assert.equal(runtime.metadata.memoryEffortPolicyVersion,1);
 const health=await fetch('http://127.0.0.1:'+s.ports.web,{signal:AbortSignal.timeout(10000),redirect:'error'});assert.equal(health.status,200);assert.match(await health.text(),/Cortex/);
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const record={state:'READY',sessionId:s.id,sourceCommit:pins.sourceCommit,kit:KIT,target:s.target,container:s.container,ports:s.ports,launcherPid:s.launcherPid,
  rootExecSession:pins.rootExecSession,sourceManifestPath:pins.sourceManifestPath,sourceManifestSha256:pins.sourceManifestSha256,reviewPath:pins.reviewPath,reviewSha256:pins.reviewSha256,startupFixedQualification:'8/8ACTUAL_PASS',startupBatch,startupBatchSha256:sha(batchBytes),startupStrictEmptyQuestion:true,startupExtractionSha256:sha(extractionBytes),
  runtimeReadySha256:sha(runtimeBytes),managedDefaultProfile:true,capabilities:{inputSelectionVersion:2,memoryEffortPolicyVersion:1},healthStatus:health.status,
  readyAt:new Date().toISOString(),effortProfileRuntimeAcceptance:false,manifestSha256:sha(manifestBytes),backendManifestSha256:manifest.backend.manifestSha256,backendFileCount:manifest.backend.files,modelCalls:0};
 await fs.writeFile(pins.readyPath,JSON.stringify(record,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(record));
}
