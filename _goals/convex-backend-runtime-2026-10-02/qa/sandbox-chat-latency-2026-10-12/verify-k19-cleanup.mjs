import {K19_PINS,requireK19ReadyPins} from './k19-collector-pins.mjs';
requireK19ReadyPins();
/** Fresh read-only exact post-cleanup checks; never recreates credentials/resources. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadSession, PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
const id=K19_PINS.sessionId;
const session=await loadSession(PROOFS_ROOT,id);
assert.equal(session.phase,'CLEANED');
assert.equal(session.target.name,K19_PINS.name);
assert.equal(session.target.id,K19_PINS.targetId);
assert.equal(session.target.teamId,325340);
assert.equal(session.target.projectId,3200658);
assert.equal(session.target.reference,'dev/cortex-sandbox-'+id);
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
assert.equal(deployments.filter(row=>row.id===K19_PINS.targetId||row.name===K19_PINS.name||row.reference===session.target.reference).length,0);
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
  target:{name:session.target.name,id:session.target.id,reference:session.target.reference,teamId:325340,projectId:3200658},
  database:'ABSENT',container:'ABSENT',credentialsRemoved:true,removed,
  verification:{freshApprovedProjectGet:true,freshDeploymentInventoryNoExactIdentity:true,exactDockerInspectNegative:true,launcherExit:130},
  retained:'Public session journal and original redacted financial/test/failure receipts; no historical uncertainty refunded'};
const destination=path.join(path.dirname(new URL(import.meta.url).pathname),'k19-cleanup-final.json');
await fs.writeFile(destination,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({receipt:destination,status:receipt.status,sessionId:id}));
