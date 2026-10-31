/** Fresh verified disposable target; official read-only component codegen, no deploy/inference. */
import assert from 'node:assert/strict';
import {readFile, writeFile, lstat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const q=dirname(fileURLToPath(import.meta.url)),run=promisify(execFile);
const v='/Users/SaintNick/.codex/tmp/cortex-runtime-039-qualification-20261010';
const app=join(v,'packages/cortex-cli/templates/chat-sdk-quickstart');
const priv='/Users/SaintNick/.codex/tmp/cortex-task16-ci-native-5b5ba39cd23b';
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const result={sourceCommit:'5ba0046864839ccbcff55ea3515951e90276243c',startedAt:new Date().toISOString(),status:'STARTED',effects:{deployment:0,inference:0,settings:0,provisioning:0},officialCommand:['convex','codegen','--typecheck','enable'],scope:'Installed current backend and canonical ChatSDK app; official read-only component codegen against freshly verified existing disposable CLI target. No service execution acceptance.'};
try {
 assert.equal((await lstat(priv)).mode&0o777,0o700);
 const path=join(priv,'cli-credentials.json'),s=await lstat(path);assert.ok(s.isFile()&&!s.isSymbolicLink());assert.equal(s.mode&0o777,0o600);
 const c=await readJson(path);assert.equal(c.projectId,3176494);assert.equal(c.deploymentName,'usable-sheep-908');assert.ok(c.deployKey.startsWith('dev:usable-sheep-908|'));
 const access=(await readJson(join(homedir(),'.convex/config.json'))).accessToken;assert.equal(typeof access,'string');
 const get=async p=>{const r=await fetch('https://api.convex.dev/v1'+p,{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(15000),redirect:'error'});assert.equal(r.status,200,'MANAGEMENT_READ_DENIED');return r.json();};
 const [p,d,list]=await Promise.all([get('/projects/3176494'),get('/deployments/usable-sheep-908'),get('/projects/3176494/list_deployments')]);
 assert.equal(p.id,3176494);assert.equal(p.teamId,325340);assert.equal(d.projectId,3176494);assert.equal(d.name,'usable-sheep-908');assert.equal(d.kind,'cloud');assert.equal(d.deploymentType,'dev');assert.equal(d.deploymentUrl,c.url);assert.equal(list.length,1);assert.equal(list[0].name,d.name);
 result.target={teamId:325340,projectId:p.id,deploymentName:d.name,kind:d.kind,deploymentType:d.deploymentType,production:false,soleCloudDev:true,verifiedAt:new Date().toISOString(),credentialsExposed:false};
 await writeFile(join(q,'prospective-chat-codegen-target.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 const env={HOME:homedir(),PATH:process.env.PATH,CI:'true',CONVEX_DEPLOYMENT:'dev:'+d.name,CONVEX_DEPLOY_KEY:c.deployKey,CONVEX_URL:c.url};
 const redact=s=>s.split(c.deployKey).join('[REDACTED_DEPLOY_KEY]').split(access).join('[REDACTED_MANAGEMENT_TOKEN]');
 try {
  const r=await run(process.execPath,[join(app,'node_modules/convex/bin/main.js'),'codegen','--typecheck','enable'],{cwd:app,env,timeout:120000,killSignal:'SIGTERM',maxBuffer:8*1024*1024});
  await writeFile(join(q,'prospective-chat-component-codegen.log'),redact(r.stdout+'\n'+r.stderr),{flag:'wx'});result.status='PASS';result.exitCode=0;
 } catch(e) {
  await writeFile(join(q,'prospective-chat-component-codegen.log'),redact((e.stdout??'')+'\n'+(e.stderr??'')),{flag:'wx'});result.status='FAIL';result.exitCode=typeof e.code==='number'?e.code:null;result.signal=e.signal??null;result.killed=e.killed??false;result.failure='OFFICIAL_COMPONENT_CODEGEN_FAILED';process.exitCode=1;
 }
} catch(e) { result.status='BLOCKED';result.failure=e.code??e.name??'UNKNOWN';process.exitCode=1; }
result.endedAt=new Date().toISOString();
await writeFile(join(q,'prospective-chat-component-codegen.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
