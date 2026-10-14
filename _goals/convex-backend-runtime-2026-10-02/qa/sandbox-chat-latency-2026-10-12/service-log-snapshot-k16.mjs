import {projectOccMetadata} from './occ-metadata-projection-next.mjs';
import {K16_PINS,K16_V5_NAMES,requireK16ReadyPins} from './k16-collector-pins.mjs';
requireK16ReadyPins();
/** Read-only metadata snapshot via the installed official CLI log protocol. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {loadSession, createContext, PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud, getDeployKey} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
const capturePhase=process.argv[3];assert.ok(['browser-post-pair','cli-post-pair'].includes(capturePhase),'Exact authorized capture phase required');assert.equal(process.env.CORTEX_K16_CAPTURE_GO,capturePhase,'Root explicit per-phase GO required');assert.equal(process.argv[2],K16_PINS.sessionId);
const session=await loadSession(PROOFS_ROOT, process.argv[2]);
assert.equal(session.phase,'READY'); assert.equal(session.ownerUid,process.getuid());

const exactTarget = async value => {
 assert.equal(value.id,K16_PINS.sessionId);assert.equal(value.phase,'READY');assert.equal(value.ownerUid,process.getuid());
 assert.equal(value.target.name,K16_PINS.name);assert.equal(value.target.id,K16_PINS.targetId);assert.equal(value.target.teamId,325340);assert.equal(value.target.projectId,3200658);
 assert.equal(value.target.reference,'dev/cortex-sandbox-'+K16_PINS.sessionId);assert.equal(value.target.isDefault,false);
 assert.equal(value.target.expiresAt,K16_PINS.expiresAt);assert.ok(value.target.expiresAt>Date.now());
 assert.equal(value.container.imageId,K16_PINS.imageId);
 const host=JSON.parse(await fs.readFile(path.join(value.receiptDir,'host-prepared.json'),'utf8'));
 assert.equal(host.sourceCommit,K16_PINS.sourceCommit);
};
await exactTarget(session);

const ctx=await createContext(session,{logger:()=>{}});
ctx.persist=async()=>{};ctx.receipt=async()=>{};
const managementFetch=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET');return managementFetch(url,options);};
await verifyCloud(session,ctx); const key=await getDeployKey(session,ctx);
const response=await fetch(session.target.deploymentUrl+'/api/stream_function_logs?cursor=0', {
 headers:{Authorization:'Convex '+key,'Convex-Client':'npm-cli-1.46.0','Content-Type':'application/json'},
 redirect:'error',signal:AbortSignal.timeout(30000)});
assert.equal(response.status,200,'Native log snapshot failed');
const reader=response.body.getReader(),chunks=[];let bytes=0;
try {for(;;){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;assert.ok(bytes<=16_777_216,'Log snapshot exceeds bound');chunks.push(item.value);}}finally{reader.releaseLock();}
const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.ok(Array.isArray(raw.entries));
const phases=[],executions=[];
const scalarKeys=['runId','attemptNumber','phase','at','runBudgetId','semanticId','operationKey','durationMs','bytes','status'];
// Convex console strings use a single-quoted wrapper in native structured logs.
// Decode bounded wrappers only; retain no unrecognized message payload.
function traceObject(message) {
 let value=message.trim();
 for(let depth=0;depth<4;depth++) {
  try { const decoded=JSON.parse(value); if(typeof decoded==='string'){value=decoded;continue;} return decoded; } catch {}
  if((value.startsWith("'")&&value.endsWith("'"))||(value.startsWith('"')&&value.endsWith('"'))){value=value.slice(1,-1);continue;}
  return null;
 }
 return null;
}
for(const entry of raw.entries){
 if(entry.kind==='Completion'){
  const projected={};
  for(const name of ['identifier','componentPath','udfType','kind','requestId','executionId']) if(typeof entry[name]==='string'&&/^[a-zA-Z0-9+/_:.=-]{1,512}$/.test(entry[name]))projected[name]=entry[name];
  for(const name of ['timestamp','executionTimestamp','executionTime','userExecutionTime','returnBytes']) if(typeof entry[name]==='number'&&Number.isFinite(entry[name]))projected[name]=entry[name];
  projected.errorPresent=!!entry.error;projected.cachedResult=entry.cachedResult===true;projected.willRetry=entry.willRetry===true;
  if(Number.isSafeInteger(entry.occInfo?.retryCount))projected.occRetryCount=entry.occInfo.retryCount;
  projected.occInfo=projectOccMetadata(entry.occInfo);
  projected.usage=Object.fromEntries(Object.entries(entry.usageStats??{}).filter(([name,value])=>/^(database|vectorIndex|networkEgress|memoryUsed)/.test(name)&&typeof value==='number'&&Number.isFinite(value)));
  executions.push(projected);
 }
 for(const line of entry.logLines??[])for(const message of typeof line==='object'&&line!==null&&Array.isArray(line.messages)?line.messages:typeof line==='string'?[line]:[]){
  if(typeof message!=='string')continue;
  const event=traceObject(message);
  if(!event||! /^(?:run:|sha256:)?[a-f0-9]{64}$/.test(event.runId??'')||! /^[a-z0-9.-]{1,128}$/.test(event.phase??'')||!Number.isFinite(event.at))continue;
  const projected=Object.fromEntries(scalarKeys.filter(name=>typeof event[name]==='string'||typeof event[name]==='number'&&Number.isFinite(event[name])).map(name=>[name,event[name]]));
  phases.push({...projected,functionPath:entry.identifier,executionId:entry.executionId});
 }
}
await exactTarget(await loadSession(PROOFS_ROOT,session.id));await verifyCloud(session,ctx);
const target={sessionId:session.id,name:session.target.name,id:session.target.id,reference:session.target.reference};
assert.ok(executions.length<=1000,'Original native execution cap exceeded');
const nativeMatches=Object.fromEntries(K16_V5_NAMES.map(name=>[name,executions.filter(row=>typeof row.identifier==='string'&&new RegExp('(?:^|/)runtimeAgent(?:\\.js)?:'+name+'$').test(row.identifier)).length]));
const result={capturePhase,orchestration:{expectedFreshWorkflow:'executeTurnV5',nativeExecutionCounts:nativeMatches,sourceCommit:K16_PINS.sourceCommit,note:'Counts are observations, not required old journal stages or additive durations.'},observedAt:new Date().toISOString(),target,nativeProtocol:'Convex1.46.0 cli/lib/logs.ts pollUdfLog; one GET no retry',phases,executions,rawPayloadRetained:false,byteCount:bytes,clockNote:'UI/CLI monotonic SLO clocks are separate; workflow replay logs are not additive durations. Convex mutation Date.now is fixed within a transaction: zero timestamp delta does not mean zero execution time. Gateway phases join via raw64hex runBudgetId or hashed correlations.'};
const destination=path.join(path.dirname(new URL(import.meta.url).pathname),'service-log-snapshot-k16-'+capturePhase+'-'+Date.now()+'.json');
await fs.writeFile(destination,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({target,capturePhase,orchestration:result.orchestration,phases:phases.length,executions:executions.length,receipt:destination}));
