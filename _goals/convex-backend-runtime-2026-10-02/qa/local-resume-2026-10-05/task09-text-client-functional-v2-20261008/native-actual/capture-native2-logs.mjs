import {spawn} from 'node:child_process';
import {dirname,join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {openOwnedContext,qa} from './common.mjs';
const c=await openOwnedContext();try{
 const args=[join(c.host,'node_modules/convex/bin/main.js'),'logs','--history','30','--jsonl'];
 const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR','CI'].includes(k))),CONVEX_DEPLOY_KEY:c.credentials.deployKey,CONVEX_DEPLOYMENT:'dev:'+c.state.deploymentName};env.PATH=dirname(process.execPath)+':'+env.PATH;
 const start=Date.now(),p=spawn(process.execPath,args,{cwd:c.host,env,detached:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',closed=false;
 const signal=()=>{if(!closed)try{process.kill(-p.pid,'SIGTERM');}catch{}};
 p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);const timer=setTimeout(signal,10000);
 const result=await new Promise((resolve,reject)=>{p.once('error',reject);p.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});clearTimeout(timer);
 await writeFile(join(qa,'native2-cli-logs.stdout.log'),c.redact(stdout));await writeFile(join(qa,'native2-cli-logs.stderr.log'),c.redact(stderr));await c.publish('native2-cli-logs',{...result,pid:p.pid,childClosed:closed,elapsedMs:Date.now()-start,readOnlyLogCaptureMs:10000,args,cwd:c.host});
 const lines=stdout.split('\n').filter(x=>/error|fail|modelStep|Unknown/i.test(x));console.log(c.redact(lines.join('\n')).slice(-8000));
}finally{await c.close();}
