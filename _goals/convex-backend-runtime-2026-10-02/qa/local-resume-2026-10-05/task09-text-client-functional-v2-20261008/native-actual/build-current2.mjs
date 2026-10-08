import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {qa,root,sha} from './common.mjs';
const expected=process.argv[2];assert.match(expected??'',/^[a-f0-9]{64}$/);
assert.equal(sha(await readFile(join(root,'convex-dev/runtimeGateway.ts'))),expected);
const npm='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
const args=[npm,'run','build'],began=Date.now(),child=spawn(process.execPath,args,{cwd:root,env,detached:true,stdio:['ignore','pipe','pipe']});
let stdout='',stderr='',closed=false,timedOut=false;const signals=[];
child.stdout.on('data',bytes=>stdout+=bytes);child.stderr.on('data',bytes=>stderr+=bytes);
function stop(signal){if(closed)return;try{process.kill(-child.pid,signal);signals.push({signal,pid:child.pid});}catch(error){signals.push({signal,error:String(error)});}}
const timer=setTimeout(()=>{timedOut=true;stop('SIGTERM');},120000),hard=setTimeout(()=>{if(timedOut)stop('SIGKILL');},125000);let exit;
try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
await writeFile(join(qa,'build-current2.stdout.log'),stdout);await writeFile(join(qa,'build-current2.stderr.log'),stderr);
await writeFile(join(qa,'build-current2.json'),JSON.stringify({args,cwd:root,sourceSha256:expected,pid:child.pid,...exit,timedOut,childClosed:closed,deadlineMs:120000,signals,elapsedMs:Date.now()-began},null,2)+'\n');
assert.equal(timedOut,false);assert.equal(exit.code,0,stderr.slice(-3000));
assert.equal(sha(await readFile(join(root,'convex-dev/runtimeGateway.ts'))),expected);
const bytes=await readFile(join(root,'dist/backend/v1/manifest.json')),manifest=JSON.parse(bytes);assert.equal(manifest.files.length,80);
console.log(JSON.stringify({status:'PASS',sourceSha256:expected,manifestSha256:sha(bytes),files:manifest.files.length,elapsedMs:Date.now()-began}));
