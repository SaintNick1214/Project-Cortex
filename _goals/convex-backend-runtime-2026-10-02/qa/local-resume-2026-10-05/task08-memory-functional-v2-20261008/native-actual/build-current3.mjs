/** One coordinated SDK/backend build after both product authors release source. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {spawn} from 'node:child_process';
import {q,root,sha} from './common.mjs';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
const npm='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js',args=[npm,'run','build'];
const start=Date.now(),child=spawn(process.execPath,args,{cwd:root,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;
child.stdout.on('data',bytes=>stdout+=bytes);child.stderr.on('data',bytes=>stderr+=bytes);
const timer=setTimeout(()=>{timedOut=true;if(!closed)try{process.kill(-child.pid,'SIGTERM');}catch{}},120000);
const hard=setTimeout(()=>{if(timedOut&&!closed)try{process.kill(-child.pid,'SIGKILL');}catch{}},125000);
let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
await writeFile(join(q,'build-current3.stdout.log'),stdout);await writeFile(join(q,'build-current3.stderr.log'),stderr);
await writeFile(join(q,'build-current3.json'),JSON.stringify({executable:process.execPath,args,cwd:root,pid:child.pid,...exit,timedOut,childClosed:closed,
  deadlineMs:120000,elapsedMs:Date.now()-start},null,2)+'\n');assert.equal(timedOut,false);assert.equal(exit.code,0,stderr.slice(-4000));
const raw=await readFile(join(root,'dist/backend/v1/manifest.json')),manifest=JSON.parse(raw);
const result={bytes:raw.length,sha256:sha(raw),sourceFileCount:manifest.files.length,tableCount:manifest.tables.length,components:manifest.components};
await writeFile(join(q,'built-backend-current3.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
