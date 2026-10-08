/** Ordinary bounded owned-process runner; invoked only after installed source is coherent. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {spawn} from 'node:child_process';
import {q,openOwnedContext} from './common.mjs';
const label=process.argv[2],phases={'setup-scopes1':120000,'native-delivery1':180000,'native-boundary1':300000,'native-lifecycle1':180000,'native-lifecycle2':180000,'native-media-metadata1':60000,'native-private-input1':180000,'native-media-commission1':180000};
phases['native-media-sync1']=200000;
phases['cleanup12']=120000;
phases['retired-liability-recovery1']=60000;
assert.ok(Object.hasOwn(phases,label),'Unknown declared native phase');const deadlineMs=phases[label];
const source=join(q,label+'.mjs');await readFile(source);
const context=await openOwnedContext();const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
const start=Date.now(),child=spawn(process.execPath,[source],{cwd:context.host,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;const signals=[];
child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
const stop=signal=>{if(closed)return;try{process.kill(-child.pid,signal);signals.push({signal,ownedGroupFromSpawn:child.pid,at:Date.now()});}catch(error){signals.push({signal,error:context.publicError(error)});}};
const timer=setTimeout(()=>{timedOut=true;stop('SIGTERM');},deadlineMs),hard=setTimeout(()=>{if(timedOut)stop('SIGKILL');},deadlineMs+5000),progress=setInterval(()=>console.log(JSON.stringify({phase:label,pid:child.pid,elapsedMs:Date.now()-start,deadlineMs,stillRunning:!closed})),30000);
let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);clearInterval(progress);await context.close();}
const safe=text=>context.redact(text).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]');
await writeFile(join(q,label+'.stdout.log'),safe(stdout),{flag:'wx'});await writeFile(join(q,label+'.stderr.log'),safe(stderr),{flag:'wx'});
const receipt={phase:label,executable:process.execPath,args:[source],cwd:context.host,pid:child.pid,ownedProcessGroup:true,...exit,timedOut,childClosed:closed,signals,elapsedMs:Date.now()-start,deadlineMs,cleanupReserveMs:5000,secretsPrinted:false};
await context.publish(label+'-command',receipt);console.log(JSON.stringify(receipt));assert.equal(timedOut,false);assert.equal(exit.code,0,safe(stderr).slice(-4000));
