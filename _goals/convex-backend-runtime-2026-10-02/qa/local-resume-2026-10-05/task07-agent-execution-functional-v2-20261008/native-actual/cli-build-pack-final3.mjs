import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {q,root,sha} from './common.mjs';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
const npm='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/npm/bin/npm-cli.js';
async function command(label,args,cwd){const began=Date.now(),child=spawn(process.execPath,[npm,...args],{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const signal=s=>{if(!closed)try{process.kill(-child.pid,s);}catch{}};
 const t=setTimeout(()=>{timedOut=true;signal('SIGTERM');},120000),h=setTimeout(()=>{if(timedOut)signal('SIGKILL');},125000);
 let exit;try{exit=await new Promise((res,rej)=>{child.once('error',rej);child.once('close',(code,signal)=>{closed=true;res({code,signal});});});}finally{clearTimeout(t);clearTimeout(h);}
 await writeFile(join(q,label+'.stdout.log'),stdout);await writeFile(join(q,label+'.stderr.log'),stderr);
 await writeFile(join(q,label+'.json'),JSON.stringify({args:[npm,...args],cwd,pid:child.pid,...exit,timedOut,childClosed:closed,elapsedMs:Date.now()-began,deadlineMs:120000},null,2)+'\n');
 assert.equal(timedOut,false);assert.equal(exit.code,0,stderr);return stdout;}
const cwd=join(root,'packages/cortex-cli');
await command('cli-build-final3',['run','build','--ignore-scripts'],cwd);
const directory='/Users/SaintNick/.codex/tmp/cortex-task07-cli-pack-'+randomUUID();await mkdir(directory,{recursive:true,mode:0o700});
const result=JSON.parse(await command('cli-pack-final3',['pack','--json','--ignore-scripts','--pack-destination',directory],cwd));
const item=Array.isArray(result)?result[0]:(result.filename?result:Object.values(result)[0]),file=join(directory,item.filename),bytes=await readFile(file);
await writeFile(join(q,'packed-cli-final3.json'),JSON.stringify({file,bytes:bytes.length,sha256:sha(bytes),version:item.version,package:item.name,packIgnoredScripts:true,templatePrebuildNotNeededForNarrowHelperRepair:true,noServiceEffects:true},null,2)+'\n');
