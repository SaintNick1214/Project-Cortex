import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {spawn} from 'node:child_process';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try {
 const packed=JSON.parse(await readFile(join(q,'packed-sdk-final5.json'),'utf8'));
 assert.equal(sha(await readFile(packed.file)),packed.sha256);
 const pre=await readFile(join(c.host,'package.json'),'utf8');
 await c.publish('install-packed-sdk-final5-preimage',{packageJson:JSON.parse(pre),sha256:sha(pre),packed});
 const cli=process.argv[2];assert.ok(cli);
 const cliPacked=JSON.parse(await readFile(join(q,'packed-cli-final3.json'),'utf8'));assert.equal(cli,cliPacked.file);assert.equal(sha(await readFile(cli)),cliPacked.sha256);
 const args=['/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js','install',packed.file,cli,'--ignore-scripts','--no-audit','--no-fund'];
 const env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)))};
 env.PATH=dirname(process.execPath)+':'+env.PATH;
 const began=Date.now(),child=spawn(process.execPath,args,{cwd:c.host,env,detached:true,stdio:['ignore','pipe','pipe']});
 let out='',err='',closed=false,timedOut=false;const signals=[];
 child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
 const signal=s=>{if(!closed){try{process.kill(-child.pid,s);signals.push(s);}catch(e){signals.push(c.publicError(e));}}};
 const timer=setTimeout(()=>{timedOut=true;signal('SIGTERM');},120000),hard=setTimeout(()=>{if(timedOut)signal('SIGKILL');},125000);
 let exit;try{exit=await new Promise((res,rej)=>{child.once('error',rej);child.once('close',(code,s)=>{closed=true;res({code,signal:s});});});}finally{clearTimeout(timer);clearTimeout(hard);}
 await writeFile(join(q,'install-packed-sdk-final5.stdout.log'),c.redact(out));await writeFile(join(q,'install-packed-sdk-final5.stderr.log'),c.redact(err));
 await c.publish('install-packed-sdk-final5',{...exit,pid:child.pid,ownedProcessGroup:true,timedOut,childClosed:closed,signals,elapsedMs:Date.now()-began,deadlineMs:120000,args,cwd:c.host,ignoreScripts:true});
 assert.equal(timedOut,false);assert.equal(exit.code,0,c.redact(err));
 const mf=await readFile(join(c.host,'node_modules/@cortexmemory/sdk/dist/backend/v1/manifest.json'));
 assert.equal(sha(mf),packed.manifestSha256);
 await c.publish('installed-package-final5',{manifestSha256:sha(mf),packageVersion:JSON.parse(await readFile(join(c.host,'node_modules/@cortexmemory/sdk/package.json'),'utf8')).version});
} finally {await c.close();}
