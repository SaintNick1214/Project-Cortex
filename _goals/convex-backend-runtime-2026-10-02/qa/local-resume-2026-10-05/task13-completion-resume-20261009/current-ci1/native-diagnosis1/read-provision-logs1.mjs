/** Bounded read-only existing function logs for the exact current-CI provision failure. */
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const q=dirname(fileURLToPath(import.meta.url)),priv='/Users/SaintNick/.codex/tmp/cortex-task16-ci-native-5b5ba39cd23b',hash=x=>createHash('sha256').update(x).digest('hex');
const start=Date.parse('2026-10-09T22:18:00Z')/1000,end=Date.parse('2026-10-09T22:20:30Z')/1000;
const startedAt=new Date().toISOString(),results=[];
assert.equal((await lstat(priv)).mode&0o777,0o700);
await Promise.all([['sdk',3176493,'steady-snake-253'],['cli',3176494,'usable-sheep-908']].map(async([kind,id,name])=>{
 const result={kind,projectId:id,deploymentName:name,status:'READ_STARTED',startedAt:new Date().toISOString(),reads:1};results.push(result);
 try{
  const p=join(priv,kind+'-credentials.json'),st=await lstat(p);assert.ok(st.isFile()&&!st.isSymbolicLink());assert.equal(st.mode&0o777,0o600);const c=JSON.parse(await readFile(p,'utf8'));assert.equal(c.projectId,id);assert.equal(c.deploymentName,name);assert.equal(c.url,'https://'+name+'.convex.cloud');assert.ok(c.deployKey.startsWith('dev:'+name+'|'));
  const res=await fetch(new URL('/api/stream_function_logs?cursor=0',c.url),{method:'GET',headers:{Authorization:'Convex '+c.deployKey,'Content-Type':'application/json','Convex-Client':'npm-cli-1.46.0'},signal:AbortSignal.timeout(15000),redirect:'error'});result.httpStatus=res.status;
  const reader=res.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;assert.ok(size<=16777216,'LOG_RESPONSE_BOUND_EXCEEDED');chunks.push(value);}}finally{reader.releaseLock();}
  const body=Buffer.concat(chunks),rawPath=join(priv,'resume-ci37998200336-'+kind+'-logs1.private.json');await writeFile(rawPath,body,{flag:'wx',mode:0o600});result.rawPrivate={path:rawPath,sha256:hash(body),mode:'0600'};result.responseBytes=size;assert.equal(res.status,200);
  const data=JSON.parse(body.toString('utf8'));assert.ok(Array.isArray(data.entries));result.entryCount=data.entries.length;
  result.selectedEntries=data.entries.filter(e=>Number(e.timestamp)>=start&&Number(e.timestamp)<=end&&/runtimeAuth:provision|runtimeModelPolicy:installDeploymentPolicy/.test(e.identifier??'')).map(e=>{const text=String(e.error??'')+'\n'+JSON.stringify(e.logLines??[]);return{identifier:e.identifier,udfType:e.udfType,timestamp:e.timestamp,executionTime:e.executionTime,requestId:e.requestId,executionId:e.executionId,errorPresent:Boolean(e.error),errorSha256:hash(String(e.error??'')),staticCodes:[...new Set(text.match(/\b(?:FORBIDDEN|UNAUTHENTICATED|INVALID_INPUT|POLICY_DENIED|CAPABILITY_UNAVAILABLE|POLICY_CHANGED|QUALIFICATION_EXPIRED|BUDGET_EXCEEDED|CI_FIXTURE_OPERATOR_CALL_FAILED)\b/g)??[])],sourceFrames:[...new Set(text.match(/(?:_cortex\/)?[A-Za-z0-9_/-]+\.(?:js|ts):\d+:\d+/g)??[])]};});
  result.status='ONE_READONLY_LOG_CAPTURE_COMPLETE';
 }catch(e){result.status='READ_FAILED';result.failureCode=typeof e.code==='string'?e.code:e instanceof assert.AssertionError?'ASSERTION_FAILED':e.message?.match(/^[A-Z_]+$/)?.[0]??'READ_OR_PARSE_FAILED';}
 result.completedAt=new Date().toISOString();
}));
results.sort((a,b)=>a.kind.localeCompare(b.kind));const out={status:results.every(x=>x.status==='ONE_READONLY_LOG_CAPTURE_COMPLETE')?'READONLY_PROVISION_DIAGNOSIS_LOGS_CAPTURED':'READONLY_PROVISION_DIAGNOSIS_CAPTURE_INCOMPLETE',workflowRunId:37998200336,headSha:'2a5230f91525fb6e937e213d53886231fcd40f59',startedAt,completedAt:new Date().toISOString(),method:'GET',path:'/api/stream_function_logs?cursor=0',selectedWindow:['2026-10-09T22:18:00Z','2026-10-09T22:20:30Z'],baselineUnchanged:'No new financial read; prospective native-before1 remains separate.',targets:results,coverage:'One bounded history response per exact target, no tail retry or provision/recheck.',effects:{model:0,mutation:0,deploy:0,repair:0,cleanup:0,setting:0,secret:0}};
await writeFile(join(q,'log-capture1.json'),JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:out.status,targets:results.map(x=>({kind:x.kind,httpStatus:x.httpStatus,status:x.status,entries:x.entryCount,matched:x.selectedEntries?.length,codes:[...new Set(x.selectedEntries?.flatMap(e=>e.staticCodes)??[])]})),effects:out.effects}));
