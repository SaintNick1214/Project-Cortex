/** Bounded runner for the installed Task14 read-only receipt; never invokes a model. */
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {spawn} from 'node:child_process';
import {openOwnedContext,q} from './common.mjs';
const label=process.argv[2];assert.ok(['ui-chat-readback1','ui-chat-readback2','ui-chat-readback3','asset-auth-readback1','sdk-auth-successor2'].includes(label));const source=join(q,label+'.mjs');await readFile(source);
const c=await openOwnedContext(),deadlineMs=60000,env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(key)));env.PATH=dirname(process.execPath)+':'+env.PATH;
const start=Date.now(),child=spawn(process.execPath,[source],{cwd:c.host,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false,timedOut=false;const signals=[];
child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
const stop=signal=>{if(closed)return;try{process.kill(-child.pid,signal);signals.push({signal,ownedGroupFromSpawn:child.pid});}catch(error){signals.push({signal,error:c.publicError(error)});}};
const timer=setTimeout(()=>{timedOut=true;stop('SIGTERM');},deadlineMs),hard=setTimeout(()=>{if(timedOut)stop('SIGKILL');},deadlineMs+5000);
let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);await c.close();}
const safe=value=>c.redact(value).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]');await writeFile(join(q,label+'.stdout.log'),safe(stdout),{flag:'wx'});await writeFile(join(q,label+'.stderr.log'),safe(stderr),{flag:'wx'});
const receipt={phase:label,executable:process.execPath,args:[source],cwd:c.host,pid:child.pid,ownedProcessGroup:true,...exit,timedOut,childClosed:closed,signals,elapsedMs:Date.now()-start,deadlineMs,cleanupReserveMs:5000,secretsPrinted:false};await c.publish(label+'-command',receipt);console.log(JSON.stringify(receipt));assert.equal(timedOut,false);assert.equal(exit.code,0,safe(stderr).slice(-3000));
