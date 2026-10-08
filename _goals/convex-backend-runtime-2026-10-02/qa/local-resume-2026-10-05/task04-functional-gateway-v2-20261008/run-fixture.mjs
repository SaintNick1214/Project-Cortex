import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
const qa=dirname(new URL(import.meta.url).pathname);const root=resolve(qa,'../../../../..');
const pointer=JSON.parse(await readFile(join(qa,'fixture-pointer.json')));
const state=JSON.parse(await readFile(join(pointer.privateDirectory,'state.json')));
const credentials=JSON.parse(await readFile(join(pointer.privateDirectory,'credentials.json')));
const isolation=JSON.parse(await readFile(join(qa,'target-isolation.json')));
assert.equal(state.operation,pointer.operation);assert.equal(credentials.operation,state.operation);assert.equal(state.retired,undefined);
assert.equal(isolation.deployment.deploymentType,'dev');assert.equal(isolation.deployment.kind,'cloud');assert.equal(isolation.deployment.projectId,state.projectId);assert.equal(isolation.deployments.length,1);assert.equal(isolation.deployments[0].name,state.deploymentName);
assert.equal(credentials.url,state.url);assert.equal(credentials.deploymentName,state.deploymentName);
assert.equal(typeof credentials.deployKey,'string');assert.ok(credentials.deployKey.startsWith(`dev:${state.deploymentName}|`));
const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','HOME','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(k))),CONVEX_DEPLOY_KEY:credentials.deployKey,CONVEX_DEPLOYMENT:`dev:${state.deploymentName}`,CONVEX_URL:state.url};
env.PATH='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/node/bin:'+env.PATH;
const stage=process.argv[2];const label=process.argv[3]??stage;
const args=stage==='deploy'?[join(root,'node_modules/convex/bin/main.js'),'dev','--once','--typecheck','enable']:[join(root,'node_modules/convex/bin/main.js'),'run',process.argv[4],process.argv[5]??'{}'];
const started=Date.now();const child=spawn(process.execPath,args,{cwd:join(pointer.privateDirectory,'project'),env,stdio:['ignore','pipe','pipe']});
const collected={stdout:'',stderr:''};let timedOut=false;let exceeded=false;
for(const k of ['stdout','stderr'])child[k].on('data',b=>{collected[k]+=b; if(Buffer.byteLength(collected[k])>2_000_000){exceeded=true;child.kill('SIGTERM');}});
const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},120_000);
const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});clearTimeout(timer);
for(const k of ['stdout','stderr']){collected[k]=collected[k].replaceAll(credentials.adminKey,'[REDACTED]').replaceAll(credentials.deployKey,'[REDACTED]');await writeFile(join(qa,`${label}.${k}`),collected[k]);}
await writeFile(join(qa,`${label}.receipt.json`),JSON.stringify({stage,command:[process.execPath,...args],cwd:join(pointer.privateDirectory,'project'),startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,pid:child.pid,...exit,timedOut,exceeded,selectedDeployment:state.deploymentName,production:false,credentialsPrinted:false},null,2));
console.log(JSON.stringify({label,...exit,timedOut,elapsedMs:Date.now()-started,stdoutBytes:Buffer.byteLength(collected.stdout),stderrBytes:Buffer.byteLength(collected.stderr)}));
if(exit.code!==0||timedOut||exceeded){console.log(collected.stderr.slice(-2500));process.exitCode=1;}
