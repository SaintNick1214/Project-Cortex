import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn, fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { sign } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
const q=dirname(new URL(import.meta.url).pathname);const p=JSON.parse(await readFile(join(q,'fixture-pointer.json')));
const s=JSON.parse(await readFile(join(p.privateDirectory,'state.json')));const iso=JSON.parse(await readFile(join(q,'target-isolation.json')));
assert.equal(s.retired,undefined);assert.equal(iso.deployment.projectId,s.projectId);assert.equal(iso.deployment.kind,'cloud');assert.equal(iso.deployment.deploymentType,'dev');assert.equal(iso.deployments.length,1);
const auth=JSON.parse(await readFile(join(q,'jwt-public-config.json')));const pem=await readFile(join(p.privateDirectory,'jwt-private.pem'));
const ref=a=>Object.fromEntries(['principalId','principalVersion','membershipId','membershipVersion','grantId','grantVersion','tenantId','tenantEpoch','memorySpaceId','memorySpaceEpoch'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));
let sequence=0;const checks=[];
async function cli(label,fn,args={}){const name=`crash-${++sequence}-${label}`;const c=spawn(process.execPath,[join(q,'run-fixture.mjs'),'run',name,fn,JSON.stringify(args)],{stdio:'inherit'});const code=await new Promise((resolve,reject)=>{c.once('error',reject);c.once('close',resolve);});if(code!==0)throw Error('Official CLI failed '+name);const raw=await readFile(join(q,name+'.stdout'),'utf8');return raw.trim()?JSON.parse(raw):null;}
function client(subject){const c=new ConvexHttpClient(s.url,{logger:false,fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(45_000)})});if(subject){const now=Math.floor(Date.now()/1000);const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const raw=b({alg:'RS256',kid:auth.kid,typ:'JWT'})+'.'+b({iss:auth.issuer,sub:subject,aud:auth.applicationID,iat:now,exp:now+2700});c.setAuth(raw+'.'+sign('RSA-SHA256',Buffer.from(raw),pem).toString('base64url'));}return c;}
async function call(label,c,kind,fn,args){const start=Date.now();let result,error;try{result=kind==='mutation'?await c.mutation(makeFunctionReference(fn),args,{skipQueue:true}):await c[kind](makeFunctionReference(fn),args);}catch(e){error={name:e?.name??'Error',data:e?.data??null,message:String(e?.message??e).slice(0,2500)};}const receipt={label,kind,fn,args,result:result??null,error:error??null,elapsedMs:Date.now()-start,target:s.deploymentName,actualJwt:!!c};await writeFile(join(q,'public-'+label+'.json'),JSON.stringify(receipt,null,2));return receipt;}
function ok(receipt){assert.equal(receipt.error,null,JSON.stringify(receipt.error));return receipt.result;}
function denied(receipt,code){assert.ok(receipt.error);assert.ok(JSON.stringify(receipt.error).includes(code),JSON.stringify(receipt.error));}
async function check(name,body){try{await body();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:String(e?.message??e)});await publish();throw e;}await publish();}
async function publish(){await writeFile(join(q,'crash-outcomes.json'),JSON.stringify({scope:'ACTUAL_NATIVE_AGENT_AND_AUTHENTICATED_TASK05_NO_INFERENCE',operation:p.operation,checks,pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length,at:new Date().toISOString()},null,2));}
const context=JSON.parse(await readFile(join(q,'core-context.json')));const {reference,scope,subject,definition}=context;const c=client(subject);

const request={version:1,agentId:definition.agentId,agentVersion:definition.version,clientRequestId:'crash-after-acceptance-v1',parts:[{type:'text',text:'durable accepted input before caller crashes'}]};
if(process.argv[2]==='producer'){
 const result=await c.mutation(makeFunctionReference('runs:submit'),{request},{skipQueue:true});process.send({accepted:result});setInterval(()=>{},1000);
}else{
 await check('actual owned producer crash after committed acceptance leaves one recoverable run and canonical input',async()=>{
  const before=await cli('before','qualification:state',{reference});const start=Date.now();const child=fork(new URL(import.meta.url),['producer'],{execPath:process.execPath,stdio:['ignore','ignore','pipe','ipc']});let stderr='';child.stderr.on('data',b=>stderr+=b.toString());const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
  const accepted=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Producer acceptance timed out'));},45000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('message',v=>{clearTimeout(timer);resolve(v.accepted);});});assert.ok(accepted.runId);const signaled=child.kill('SIGKILL');const exit=await closed;assert.equal(signaled,true);assert.equal(exit.signal,'SIGKILL');await writeFile(join(q,'crash-owned-producer.json'),JSON.stringify({pid:child.pid,accepted,exit,signaled,elapsedMs:Date.now()-start,stderr,ownership:'direct fork child handle; no guessed pid; after committed response'},null,2));
  const current=ok(await call('crash-get',c,'query','runs:get',{...scope,runId:accepted.runId}));assert.equal(current.responseStatus,'queued');assert.equal(current.attemptNumber,0);const replay=ok(await call('crash-replay',c,'mutation','runs:submit',{request}));assert.equal(replay.runId,accepted.runId);await cli('recover','runs:recoverQueue',{reference,conversationId:accepted.conversationId});const claim=await cli('claim','runs:claimNext',{reference,conversationId:accepted.conversationId});assert.equal(claim.runId,accepted.runId);assert.equal(claim.snapshot.messages.length,1);const after=await cli('after','qualification:state',{reference});assert.equal(after.counts.runs,before.counts.runs+1);assert.equal(after.counts.nativeMessages,before.counts.nativeMessages+1);assert.equal(after.counts.nativeThreads,before.counts.nativeThreads+1);assert.equal(after.counts.outbox,before.counts.outbox+1);
 });
 await publish();
}
