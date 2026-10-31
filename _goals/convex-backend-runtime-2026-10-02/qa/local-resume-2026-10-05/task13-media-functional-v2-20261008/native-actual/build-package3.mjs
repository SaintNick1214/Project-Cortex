/** Execute only after the coordinated final Task13 source release. One exclusive build/pack lane. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {q,root,sha} from './common.mjs';
const directory='/Users/SaintNick/.codex/tmp/cortex-task13-pack-'+randomUUID();await mkdir(directory,{mode:0o700});
const npm='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
async function command(label,executable,args,cwd){const start=Date.now(),child=spawn(executable,args,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;
 child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
 const timer=setTimeout(()=>{timedOut=true;if(!closed)try{process.kill(-child.pid,'SIGTERM');}catch{}},120000),hard=setTimeout(()=>{if(timedOut&&!closed)try{process.kill(-child.pid,'SIGKILL');}catch{}},125000);
 const progress=setInterval(()=>console.log(JSON.stringify({phase:label,pid:child.pid,elapsedMs:Date.now()-start,deadlineMs:120000})),30000);
 let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);clearInterval(progress);}
 await writeFile(join(q,label+'.stdout.log'),stdout,{flag:'wx'});await writeFile(join(q,label+'.stderr.log'),stderr,{flag:'wx'});await writeFile(join(q,label+'.json'),JSON.stringify({executable,args,cwd,pid:child.pid,...exit,timedOut,childClosed:closed,deadlineMs:120000,elapsedMs:Date.now()-start},null,2)+'\n',{flag:'wx'});assert.equal(timedOut,false);assert.equal(exit.code,0,stderr.slice(-4000));return stdout;
}
await command('build-sdk-current3',process.execPath,[npm,'run','build'],root);
// Root owns declared downstream provider lint/type after this pack boundary.
// Cycle-only successor: reuse exact qualified CLI package from current1; no CLI/template writer.
const raw=await readFile(join(root,'dist/backend/v1/manifest.json')),manifest=JSON.parse(raw);
assert.deepEqual(new Set(manifest.httpRoutes),new Set(['POST /cortex/assets/upload','GET /cortex/assets/download','OPTIONS /cortex/assets/upload','OPTIONS /cortex/assets/download','POST /cortex/media/video/webhook']));
assert.ok(manifest.files.some(row=>row.path==='_cortex/http.ts'));
async function pack(label,cwd){const result=JSON.parse(await command(label,process.execPath,[npm,'pack','--json','--ignore-scripts','--pack-destination',directory],cwd));const item=Array.isArray(result)?result[0]:(result.filename?result:Object.values(result)[0]);assert.ok(item.filename);const file=join(directory,item.filename),bytes=await readFile(file);return{file,bytes:bytes.length,sha256:sha(bytes),package:item.name,version:item.version};}
const sdk=await pack('pack-sdk-current3',root),prior=JSON.parse(await readFile(join(q,'packages-current1.json'))),cli=prior.cli;assert.equal(sha(await readFile(cli.file)),cli.sha256);
const unpacked=join(directory,'unpacked');await mkdir(unpacked,{mode:0o700});await command('unpack-sdk-current3','/usr/bin/tar',['-xzf',sdk.file,'-C',unpacked],root);
const unpackedBackend=join(unpacked,'package/dist/backend/v1');assert.equal(sha(await readFile(join(unpackedBackend,'manifest.json'))),sha(raw));
const receipt={directory,sdk:{...sdk,unpackedBackend,manifestSha256:sha(raw)},cli,sourceFileCount:manifest.files.length,tableCount:manifest.tables.length,components:manifest.components,httpRoutes:manifest.httpRoutes,packIgnoredScripts:true,cliTemplateLifecycleSkipped:true,reason:'Canonical UI writer is separate; Task15 owns mirror synchronization.',cliReusedFromCurrent1:true,noTargetEffects:true};
await writeFile(join(q,'packages-current3.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
