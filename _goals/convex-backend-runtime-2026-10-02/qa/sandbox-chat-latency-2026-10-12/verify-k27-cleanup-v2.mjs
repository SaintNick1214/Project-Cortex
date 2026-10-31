/** Prepared only; execute ONCE only after Root explicitly signals CLEANED + GO and all readers closed. */
/** Fresh read-only exact post-cleanup checks; never recreates credentials/resources. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadSession, PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import { K27_PINS, requireK27ReadyPins } from './k27-collector-pins.mjs';
assert.equal(process.env.CORTEX_K27_CLEANUP_GO,'1','Explicit K27 CLEANED cleanup GO required; no service access');
requireK27ReadyPins();
const K27_CLEANUP_TARGET=Object.freeze({ready:K27_PINS.ready,sessionId:K27_PINS.sessionId,name:K27_PINS.name,
  targetId:K27_PINS.targetId,expiresAt:K27_PINS.expiresAt,sourceCommit:K27_PINS.sourceCommit,imageId:K27_PINS.imageId,
  teamId:325340,projectId:3200658});
assert.equal(K27_CLEANUP_TARGET.ready,true,'K27 exact target is UNREADY; no service access');
assert.equal(K27_CLEANUP_TARGET.sourceCommit,'6ce044425b7e52270cdf89cde0ea3a8fbb42f91a');
assert.match(K27_CLEANUP_TARGET.sessionId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
assert.match(K27_CLEANUP_TARGET.name,/^[a-z]+(?:-[a-z]+)+-\d+$/);
assert.ok(Number.isSafeInteger(K27_CLEANUP_TARGET.targetId)&&K27_CLEANUP_TARGET.targetId>0);
assert.ok(Number.isSafeInteger(K27_CLEANUP_TARGET.expiresAt)&&K27_CLEANUP_TARGET.expiresAt>0);
assert.match(K27_CLEANUP_TARGET.imageId,/^sha256:[a-f0-9]{64}$/);
const launcherExitBytes=await fs.readFile(new URL('./k27-launcher-child-exit-v1.json',import.meta.url));
const launcherExit=JSON.parse(launcherExitBytes.toString('utf8'));
assert.equal(launcherExit.exitCode,130,'Actual direct launcher child must have exited 130');
assert.ok(Number.isSafeInteger(launcherExit.launcherPid)&&launcherExit.launcherPid>0);
assert.equal(launcherExit.source,'direct child close event; no pipeline or tee');
const ready=JSON.parse(await fs.readFile(new URL('./k27-environment-ready.json',import.meta.url),'utf8'));
assert.equal(ready.state,'READY');
assert.equal(ready.launcherPid,launcherExit.launcherPid);
assert.equal(ready.sourceCommit,K27_CLEANUP_TARGET.sourceCommit);
assert.equal(ready.imageId,K27_CLEANUP_TARGET.imageId);
assert.equal(ready.sessionId,K27_CLEANUP_TARGET.sessionId);
assert.equal(ready.target.id,K27_CLEANUP_TARGET.targetId);
assert.equal(ready.target.name,K27_CLEANUP_TARGET.name);
const id=K27_CLEANUP_TARGET.sessionId;
const session=await loadSession(PROOFS_ROOT,id);
assert.equal(session.phase,'CLEANED');
assert.equal(session.launcherPid,launcherExit.launcherPid,'Direct child exit must identify this exact journal launcher');
assert.equal(session.target.name,K27_CLEANUP_TARGET.name);
assert.equal(session.target.id,K27_CLEANUP_TARGET.targetId);
assert.equal(session.target.teamId,325340);
assert.equal(session.target.projectId,3200658);
assert.equal(session.target.reference,'dev/cortex-sandbox-'+id);
assert.equal(session.target.deploymentType,'dev');
assert.equal(session.target.isDefault,false);
assert.equal(session.target.expiresAt,K27_CLEANUP_TARGET.expiresAt);
const configPath='/Users/SaintNick/.convex/config.json';
const stat=await fs.lstat(configPath);
assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid());
const token=JSON.parse(await fs.readFile(configPath,'utf8')).accessToken;
assert.ok(typeof token==='string'&&token.length>0);
async function get(route){
  const response=await fetch('https://api.convex.dev/v1'+route,{method:'GET',redirect:'error',signal:AbortSignal.timeout(30000),
    headers:{Authorization:'Bearer '+token,'Convex-Client':'npm-cli-1.46.0'}});
  assert.equal(response.status,200,'Fresh management GET unsuccessful');
  return response.json();
}
const [project,deployments]=await Promise.all([get('/projects/3200658'),get('/projects/3200658/list_deployments')]);
assert.equal(project.id,3200658);assert.equal(project.teamId,325340);assert.equal(project.slug,'cortex-sandboxes');
assert.ok(Array.isArray(deployments));
assert.equal(deployments.filter(row=>row.id===K27_CLEANUP_TARGET.targetId||row.name===K27_CLEANUP_TARGET.name||row.reference===session.target.reference).length,0);
const execFileAsync=promisify(execFile);
let dockerAbsent=false;
try{await execFileAsync('/Applications/Docker.app/Contents/Resources/bin/docker',['inspect',session.container?.name ?? ('cortex-sandbox-'+id)],{timeout:30000,maxBuffer:65536});}
catch(error){dockerAbsent=error.code===1&&String(error.stdout).trim()==='[]'&&/no such (object|container)/i.test(String(error.stderr));}
assert.ok(dockerAbsent,'Exact Docker container absence not verified');
const removed={};
for(const key of ['issuerDir','secretsDir','workspace','backendDir']){
  try{await fs.lstat(session[key]);removed[key]=false;}catch(error){if(error.code!=='ENOENT')throw error;removed[key]=true;}
  assert.equal(removed[key],true,'Owned private directory remains');
}
const receipt={observedAt:new Date().toISOString(),status:'ABSENT',sessionId:id,
  target:{name:session.target.name,id:session.target.id,reference:session.target.reference,teamId:325340,projectId:3200658,expiresAt:session.target.expiresAt,deploymentType:'dev',isDefault:false},
  sourceCommit:K27_CLEANUP_TARGET.sourceCommit,imageId:K27_CLEANUP_TARGET.imageId,
  database:'ABSENT',container:'ABSENT',credentialsRemoved:true,removed,
  verification:{freshApprovedProjectGet:true,freshDeploymentInventoryNoExactIdentity:true,exactDockerInspectNegative:true,launcherExit:launcherExit.exitCode,launcherExitStatus:'OBSERVED_DIRECT_CHILD_EXIT_130',launcherExitReceipt:'k27-launcher-child-exit-v1.json',launcherExitReceiptSha256:createHash('sha256').update(launcherExitBytes).digest('hex'),launcherExitProvenance:launcherExit.source,launcherPid:launcherExit.launcherPid},
  retained:'Public session journal and original redacted financial/test/failure receipts; no historical uncertainty refunded'};
const destination=path.join(path.dirname(new URL(import.meta.url).pathname),'k27-cleanup-final.json');
await fs.writeFile(destination,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({receipt:destination,status:receipt.status,sessionId:id}));
