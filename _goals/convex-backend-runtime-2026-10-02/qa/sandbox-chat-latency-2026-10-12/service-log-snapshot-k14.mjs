/** Read-only metadata snapshot via the installed official CLI log protocol. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {loadSession, createContext, PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud, getDeployKey} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
const session=await loadSession(PROOFS_ROOT, process.argv[2]);
assert.equal(session.phase,'READY'); assert.equal(session.ownerUid,process.getuid());

const exactTarget = async value => {
 assert.equal(value.id,'e07fd8cd-4f0b-4ceb-833c-15b167bda97f');assert.equal(value.phase,'READY');assert.equal(value.ownerUid,process.getuid());
 assert.equal(value.target.name,'mild-eagle-107');assert.equal(value.target.id,6150945);assert.equal(value.target.teamId,325340);assert.equal(value.target.projectId,3200658);
 assert.equal(value.target.reference,'dev/cortex-sandbox-e07fd8cd-4f0b-4ceb-833c-15b167bda97f');assert.equal(value.target.isDefault,false);
 assert.equal(value.target.expiresAt,1792536059586);assert.ok(value.target.expiresAt>Date.now());
 assert.equal(value.container.imageId,'sha256:f1b4bb13bf023ed2851f0bca5c9da2a18eca1e7010daee7eeaef730978d56406');
 const host=JSON.parse(await fs.readFile(path.join(value.receiptDir,'host-prepared.json'),'utf8'));
 assert.equal(host.sourceCommit,'8917f3250fc50aa7f30f5cd727aaf279709a2ef2');
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
const result={observedAt:new Date().toISOString(),target,nativeProtocol:'Convex1.46.0 cli/lib/logs.ts pollUdfLog; one GET no retry',phases,executions,rawPayloadRetained:false,byteCount:bytes,clockNote:'UI/CLI monotonic SLO clocks are separate; workflow replay logs are not additive durations. Convex mutation Date.now is fixed within a transaction: zero timestamp delta does not mean zero execution time. Gateway phases join via raw64hex runBudgetId or hashed correlations.'};
const destination=path.join(path.dirname(new URL(import.meta.url).pathname),'service-log-snapshot-'+Date.now()+'.json');
await fs.writeFile(destination,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({target,phases:phases.length,executions:executions.length,receipt:destination}));
