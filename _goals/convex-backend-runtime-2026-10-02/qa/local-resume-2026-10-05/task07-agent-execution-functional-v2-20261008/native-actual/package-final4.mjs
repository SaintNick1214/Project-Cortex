/** Invoke only after the coordinated exclusive SDK/backend build is released. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {q,root,sha} from './common.mjs';
const expectedManifestSha=process.argv[2];assert.match(expectedManifestSha??'',/^[a-f0-9]{64}$/);
const manifestRaw=await readFile(join(root,'dist/backend/v1/manifest.json'));assert.equal(sha(manifestRaw),expectedManifestSha);
const operation=randomUUID(),directory='/Users/SaintNick/.codex/tmp/cortex-task07-pack-'+operation;
await mkdir(directory,{recursive:true,mode:0o700});const unpacked=join(directory,'unpacked');await mkdir(unpacked,{mode:0o700});
const npm='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
async function command(label,executable,args,cwd){const began=Date.now(),child=spawn(executable,args,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;
  child.stdout.on('data',bytes=>stdout+=bytes);child.stderr.on('data',bytes=>stderr+=bytes);
  const timer=setTimeout(()=>{timedOut=true;if(!closed)try{process.kill(-child.pid,'SIGTERM');}catch{}},120000);
  const hard=setTimeout(()=>{if(timedOut&&!closed)try{process.kill(-child.pid,'SIGKILL');}catch{}},125000);
  let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
  await writeFile(join(q,label+'.stdout.log'),stdout);await writeFile(join(q,label+'.stderr.log'),stderr);
  await writeFile(join(q,label+'.json'),JSON.stringify({executable,args,cwd,pid:child.pid,...exit,timedOut,childClosed:closed,elapsedMs:Date.now()-began,deadlineMs:120000},null,2)+'\n');
  assert.equal(timedOut,false);assert.equal(exit.code,0,stderr.slice(-4000));return stdout;}
const packed=JSON.parse(await command('pack-sdk-final4',process.execPath,[npm,'pack','--json','--ignore-scripts','--pack-destination',directory],root));
const item=Array.isArray(packed)?packed[0]:(packed.filename?packed:Object.values(packed)[0]);assert.ok(item.filename);
const file=join(directory,item.filename),bytes=await readFile(file);
await command('unpack-sdk-final4','/usr/bin/tar',['-xzf',file,'-C',unpacked],root);
const backend=join(unpacked,'package/dist/backend/v1');assert.equal(sha(await readFile(join(backend,'manifest.json'))),expectedManifestSha);
const receipt={operation,file,bytes:bytes.length,sha256:sha(bytes),unpackedBackend:backend,manifestSha256:expectedManifestSha,
  package:item.name,version:item.version,sourceBuildAlreadyReleased:true,packIgnoredScripts:true,noServiceEffects:true};
await writeFile(join(q,'packed-sdk-final4.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
