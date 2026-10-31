/** Prospective canonical-candidate pins. Import/preflight performs no service, session or credential access. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
export const Q=path.dirname(fileURLToPath(import.meta.url));
export const PROOFS_ROOT='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs';
export const KIT=path.join(PROOFS_ROOT,'manual-sandbox-memory-effort-canonical-2026-10-15');
export const BASE_COMMIT='3875d3238705a90cb191abbf824d3fa3517e42e5';
export const EXPECTED_READY=path.join(Q,'memory-effort-canonical-environment-ready.json');
export const REQUIRED=['ready','session','source','image','target-id','launcher-pid','launcher-exec','kit','manifest','manifest-sha256','review','review-sha256'];
const RETIRED_SESSIONS=new Set(['53bda5ed-0c61-4308-b0d6-7b8a6e2cf34e','3a4f0b7f-dcb7-47fd-93d7-0086cef72489','a8fa8264-62b4-4aeb-9cb8-a1079620f5b2','c6a1903b-d656-4e15-806f-4f92defb0bf0','c371f9bb-831d-44e3-95a2-bfe43f48d946','50567f65-1574-42bd-8941-00cd1c1ed581','75310545-3b70-46e5-884d-bcd2cc97e0e9','04ab48d4-6995-4d90-9a20-5935787e58f2','3d381c46-a9ab-4650-9ea2-a541c76bf207']);
const RETIRED_TARGETS=new Set([6182618,6183373,6184997,6186053,6187093,6188142,6189484,6190027]);
const RETIRED_IMAGES=new Set(['sha256:19f06ee1e5d86390974183d761011caa70012beba3b99d5844993e0956a778e5','sha256:1856464478b4b8820262b724db678d2c08e4505d7774db1263efce0e6cda6a92']);
const REQUIRED_FROZEN_PATHS=['src/domain/memory-direct-recall.ts','src/domain/memory-effort.ts','convex-dev/runtimeMemoryQuery.ts','convex-dev/runtimeAgentRecall.ts','convex-dev/runtimeAgent.ts','tests/unit/runtimeMemory/direct-fact-rule.test.ts','tests/unit/runtimeMemory/query-composition.test.ts','tests/unit/runtimeAgent/whole-recall-composition.test.ts','tests/unit/runtimeAgent/v8-preparation-read-retention.test.ts','src/domain/memory-traversal.ts','convex-dev/runtimeMemoryTraversal.ts','tests/unit/runtimeMemory/memory-traversal.test.ts'];
const MINIMUM_SCORES={requirementFulfillment:4,codeQuality:3,testQuality:4,patternAdherence:3,completeness:4};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function qaArtifact(value){const resolved=path.resolve(value);assert.equal(path.dirname(resolved),Q,'Explicit direct Q artifact required');assert.equal(path.extname(resolved),'.json');return resolved;}
export function parsePins(argv){
 if(argv.length===1&&argv[0]==='--local-preflight')return {localPreflight:true};
 assert.ok(argv.length>0&&argv.length%2===0,'PENDING: exact Root pins required before session/service/private access');
 const fields={};for(let i=0;i<argv.length;i+=2){const key=argv[i].replace(/^--/,'');assert.ok(argv[i]==='--'+key&&[...REQUIRED,'trace'].includes(key)&&fields[key]===undefined,'Unexpected/duplicate pin argument');fields[key]=argv[i+1];}
 for(const key of REQUIRED)assert.ok(typeof fields[key]==='string'&&fields[key].length>0,'PENDING: missing exact Root pin '+key);
 assert.match(fields.session,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);assert.ok(!RETIRED_SESSIONS.has(fields.session),'Cleaned session cannot authorize a fresh run');
 assert.match(fields.source,/^[a-f0-9]{40}$/);assert.notEqual(fields.source,BASE_COMMIT,'Prospective reviewed commit required; failed3875 is historical');assert.match(fields.image,/^sha256:[a-f0-9]{64}$/);assert.ok(!RETIRED_IMAGES.has(fields.image),'Cleaned prior image cannot identify the prospective candidate');
 assert.equal(path.resolve(fields.kit),KIT,'Exact new Root canonical kit required');
 const pins={sessionId:fields.session,sourceCommit:fields.source,imageId:fields.image,readyPath:qaArtifact(fields.ready),tracePath:qaArtifact(fields.trace??path.join(Q,'memory-effort-canonical-kit-backend-trace-enabled.json')),sourceManifestPath:qaArtifact(fields.manifest),sourceManifestSha256:fields['manifest-sha256'],reviewPath:qaArtifact(fields.review),reviewSha256:fields['review-sha256']};
 assert.match(pins.sourceManifestSha256,/^[a-f0-9]{64}$/);assert.match(pins.reviewSha256,/^[a-f0-9]{64}$/);assert.notEqual(pins.sourceManifestPath,pins.reviewPath);assert.notEqual(pins.sourceManifestPath,pins.readyPath);assert.notEqual(pins.reviewPath,pins.readyPath);assert.notEqual(pins.tracePath,pins.readyPath);
 for(const [argument,field]of [['target-id','targetId'],['launcher-pid','launcherPid'],['launcher-exec','rootExecSession']]){assert.match(fields[argument],/^[1-9][0-9]*$/);pins[field]=Number(fields[argument]);assert.ok(Number.isSafeInteger(pins[field]));}
 assert.ok(!RETIRED_TARGETS.has(pins.targetId),'Cleaned target cannot authorize a fresh run');assert.equal(pins.readyPath,EXPECTED_READY);return pins;
}
export function requireTsxLoader(){
 const options=[...process.execArgv,...(process.env.NODE_OPTIONS??'').split(/\s+/)];
 assert.ok(options.some(value=>/tsx\/dist\/loader\.mjs/.test(value)||value==='--import=tsx'),'Real TSX loader required before installed backend TypeScript imports');
}
export function requireRootGo(){assert.ok(['READY','TRACE','NATIVE'].some(phase=>process.env['CORTEX_MEMORY_EFFORT_CANONICAL_'+phase+'_GO']==='1'),'Explicit canonical Root GO required before session/service/private access');}
export async function readReviewedSource(pins){
 const manifestBytes=await fs.readFile(pins.sourceManifestPath),reviewBytes=await fs.readFile(pins.reviewPath);
 assert.equal(sha(manifestBytes),pins.sourceManifestSha256,'Frozen combined source manifest bytes must match Root pin');assert.equal(sha(reviewBytes),pins.reviewSha256,'One combined independent review bytes must match Root pin');
 const manifest=JSON.parse(manifestBytes),review=JSON.parse(reviewBytes);
 assert.equal(manifest.version,1);assert.equal(manifest.baseCommit,BASE_COMMIT);assert.equal(review.version,1);assert.equal(review.baseCommit,BASE_COMMIT);assert.equal(review.verdict,'PASS');assert.match(review.reviewer,/independent non-author/);const findings=review.unresolvedBreakingFindings??review.breakingFindings;assert.ok(findings===0||Array.isArray(findings)&&findings.length===0);if(review.unresolvedBreakingFindingsCount!==undefined)assert.equal(review.unresolvedBreakingFindingsCount,0);assert.equal(review.allFrozenHashesMatch,true);const reviewedManifest=review.frozenManifest??review.coherentManifest;assert.equal(typeof reviewedManifest,'string');assert.equal(path.resolve(Q,reviewedManifest),pins.sourceManifestPath);
 const hashes=manifest.sourceHashes;assert.ok(hashes&&typeof hashes==='object'&&!Array.isArray(hashes)&&Object.keys(hashes).length>0);
 for(const sourcePath of REQUIRED_FROZEN_PATHS)assert.ok(Object.hasOwn(hashes,sourcePath),'Combined frozen manifest must retain required source/test '+sourcePath);
 for(const [sourcePath,hash]of Object.entries(hashes)){assert.ok(!path.isAbsolute(sourcePath)&&!sourcePath.split('/').includes('..'));assert.match(hash,/^[a-f0-9]{64}$/);}
 // Version1 review fields; the combined batch can contain more than twelve files.
 for(const field of ['sourceHashesBefore','sourceHashesAfterIndependentChecks','sourceHashesFinal'])assert.deepEqual(review[field],hashes);
 assert.ok(review.scores&&typeof review.scores==='object'&&!Array.isArray(review.scores)&&Object.values(review.scores).every(Number.isFinite)&&Object.entries(MINIMUM_SCORES).every(([key,minimum])=>Object.hasOwn(review.scores,key)&&review.scores[key]>=minimum),'Goal acceptance-policy-v2 dimension minima required');
 assert.ok(Object.keys(MINIMUM_SCORES).reduce((total,key)=>total+review.scores[key],0)/Object.keys(MINIMUM_SCORES).length>=3.6,'Goal acceptance-policy-v2 minimum average3.6 required');return manifest;
}
export function assertSessionIdentity(pins,current){
 requireRootGo();assert.ok(!RETIRED_SESSIONS.has(pins.sessionId)&&!RETIRED_TARGETS.has(pins.targetId));
 assert.ok(current.phase==='READY'&&current.id===pins.sessionId&&current.launcherPid===pins.launcherPid&&current.ownerUid===process.getuid()&&current.ownerGid===process.getgid()&&current.launcherHost===os.hostname(),'Exact live owned launcher required');process.kill(pins.launcherPid,0);
 assert.equal(current.runDir,path.join(PROOFS_ROOT,'.sandbox-env-runs',pins.sessionId));assert.equal(current.backendDir,path.join(current.runDir,'host'));assert.equal(current.issuerDir,path.join(current.runDir,'issuer'));assert.equal(current.deploymentKeyPath,path.join(current.runDir,'secrets/dev-deploy-key.txt'));
 const target=current.target;assert.ok(target&&target.id===pins.targetId&&target.teamId===325340&&target.projectId===3200658&&target.kind==='cloud'&&target.deploymentType==='dev'&&!target.isDefault&&target.disposable===true&&Number.isSafeInteger(target.expiresAt)&&target.expiresAt>Date.now(),'Fresh logical approved disposable target required before any service');
 assert.match(target.name,/^[a-z]+(?:-[a-z]+)+-\d+$/);assert.equal(target.reference,'dev/cortex-sandbox-'+pins.sessionId);assert.equal(target.deploymentUrl,'https://'+target.name+'.convex.cloud');assert.equal(current.container.name,'cortex-sandbox-'+pins.sessionId);assert.equal(current.container.imageId,pins.imageId);assert.match(current.container.id,/^[a-f0-9]{64}$/);
}
export async function readReady(pins,{allowExpired=false}={}){
 requireRootGo();requireTsxLoader();assert.equal(pins.readyPath,EXPECTED_READY);
 const ready=JSON.parse(await fs.readFile(pins.readyPath,'utf8'));
 assert.ok(ready?.state==='READY'&&ready.sessionId===pins.sessionId&&ready.sourceCommit===pins.sourceCommit&&ready.kit===KIT&&ready.container?.imageId===pins.imageId,'Fresh READY must match explicit Root pins');
 for(const field of ['sourceManifestPath','sourceManifestSha256','reviewPath','reviewSha256'])assert.equal(ready[field],pins[field],'READY frozen source/review pin '+field);
 assert.ok(ready.launcherPid===pins.launcherPid&&ready.rootExecSession===pins.rootExecSession&&ready.startupFixedQualification==='8/8ACTUAL_PASS','Exact launcher and actual startup qualification required');
 assert.ok(ready.startupBatch?.actualSuccessfulMethods===8&&ready.startupBatch.dispatches===8&&ready.startupBatch.fullUnknownLiabilityUnits===2700000&&ready.startupBatch.activeConcurrency===0&&ready.startupBatch.freshActualOutcomes===true&&ready.startupBatch.oldQualificationDatesReused===false,'Actual original8calls2.7M startup evidence required');
 assert.ok(ready.managedDefaultProfile===true&&ready.capabilities?.inputSelectionVersion===2&&ready.capabilities?.memoryEffortPolicyVersion===1,'Managed default and2/1capabilities required');
 const target=ready.target;assert.ok(target&&target.id===pins.targetId&&!RETIRED_TARGETS.has(target.id)&&target.teamId===325340&&target.projectId===3200658&&target.kind==='cloud'&&target.deploymentType==='dev'&&!target.isDefault&&target.disposable===true&&target.serverExpiryVerified===true&&Number.isSafeInteger(target.expiresAt)&&(allowExpired||target.expiresAt>Date.now()),'Exact approved disposable target required');
 assert.match(target.name,/^[a-z]+(?:-[a-z]+)+-\d+$/);assert.equal(target.reference,'dev/cortex-sandbox-'+pins.sessionId);assert.equal(target.deploymentUrl,'https://'+target.name+'.convex.cloud');assert.equal(ready.container.name,'cortex-sandbox-'+pins.sessionId);assert.match(ready.container.id,/^[a-f0-9]{64}$/);return ready;
}
/** Fresh read-only management and Docker identity check, called before live writes. */
export async function verifyRuntimeIdentity(ctx,pins,ready){
 requireRootGo();await readReviewedSource(pins);
 const {loadSession}=await import(pathToFileURL(path.join(PROOFS_ROOT,'sandbox-env/runner.mjs')));
 const current=await loadSession(PROOFS_ROOT,pins.sessionId);assertSessionIdentity(pins,current);
 if(ready){for(const field of ['id','name','kind','teamId','projectId','reference','deploymentType','isDefault','expiresAt','deploymentUrl','disposable'])assert.equal(current.target[field],ready.target[field]);for(const field of ['id','name','imageId'])assert.equal(current.container[field],ready.container[field]);}
 const {verifyCloud}=await import(pathToFileURL(path.join(PROOFS_ROOT,'sandbox-env/cloud.mjs')));
 const actual=await verifyCloud(current,ctx);for(const field of ['id','name','kind','teamId','projectId','reference','deploymentType','isDefault','expiresAt','deploymentUrl','disposable'])assert.equal(actual[field],current.target[field]);assert.ok(actual.expiresAt>Date.now());
 const format='{"id":{{json .Id}},"image":{{json .Image}},"name":{{json .Name}},"state":{{json .State}},"labels":{{json .Config.Labels}}}';
 const docker=JSON.parse((await promisify(execFile)(ctx.docker,['container','inspect','--format',format,current.container.id],{encoding:'utf8',timeout:30000,maxBuffer:65536})).stdout);
 assert.ok(docker.id===current.container.id&&docker.image===pins.imageId&&docker.name==='/'+current.container.name&&docker.state.Running&&!docker.state.Paused&&!docker.state.Restarting&&!docker.state.Dead&&!docker.state.OOMKilled&&docker.labels['dev.cortex.disposable-sandbox']===pins.sessionId&&docker.labels['dev.cortex.disposable-sandbox.root']===current.runDir,'Actual running owned exact Docker required');return current;
}
export function pendingMetadata(){return {status:'PREPARED_WAITING_FOR_ROOT_PINS_AND_GO',sourceCommit:'PENDING_EXPLICIT_PROSPECTIVE_COMMIT',baseCommit:BASE_COMMIT,readyPath:EXPECTED_READY,kit:KIT,requiredPins:REQUIRED.map(key=>'--'+key),optionalTracePin:'--trace',serviceCalls:0,modelCalls:0,sessionReads:0,privateKeyReads:0,liveQualification:'NOT_RUN',priorNative663:'HISTORICAL_ONLY_NOT_CURRENT_ACCEPTANCE',original3875FastFailure:'PRESERVED_6923.7MS_NO_APRICOT_SELECTED0_RETRIEVAL848MS_DEADLINE750MS',syntheticThreeProjectionProof:'NOT_COVERED_UNCHANGED_FIXTURE_CANNOT_SEED_IT'};}
