import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
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
async function cli(label,fn,args={}){const name=`compat3-${++sequence}-${label}`;const c=spawn(process.execPath,[join(q,'run-fixture.mjs'),'run',name,fn,JSON.stringify(args)],{stdio:'inherit'});const code=await new Promise((resolve,reject)=>{c.once('error',reject);c.once('close',resolve);});if(code!==0)throw Error('Official CLI failed '+name);const raw=await readFile(join(q,name+'.stdout'),'utf8');return raw.trim()?JSON.parse(raw):null;}
function client(subject){const c=new ConvexHttpClient(s.url,{logger:false,fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(45_000)})});if(subject){const now=Math.floor(Date.now()/1000);const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const raw=b({alg:'RS256',kid:auth.kid,typ:'JWT'})+'.'+b({iss:auth.issuer,sub:subject,aud:auth.applicationID,iat:now,exp:now+2700});c.setAuth(raw+'.'+sign('RSA-SHA256',Buffer.from(raw),pem).toString('base64url'));}return c;}
async function call(label,c,kind,fn,args){const start=Date.now();let result,error;try{result=kind==='mutation'?await c.mutation(makeFunctionReference(fn),args,{skipQueue:true}):await c[kind](makeFunctionReference(fn),args);}catch(e){error={name:e?.name??'Error',data:e?.data??null,message:String(e?.message??e).slice(0,2500)};}const receipt={label,kind,fn,args,result:result??null,error:error??null,elapsedMs:Date.now()-start,target:s.deploymentName,actualJwt:!!c};await writeFile(join(q,'public-compat3-'+label+'.json'),JSON.stringify(receipt,null,2));return receipt;}
function ok(receipt){assert.equal(receipt.error,null,JSON.stringify(receipt.error));return receipt.result;}
function denied(receipt,code){assert.ok(receipt.error);assert.ok(JSON.stringify(receipt.error).includes(code),JSON.stringify(receipt.error));}
async function check(name,body){try{await body();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:String(e?.message??e)});await publish();throw e;}await publish();}
async function publish(){await writeFile(join(q,'compat3-outcomes.json'),JSON.stringify({scope:'ACTUAL_NATIVE_AGENT_AND_AUTHENTICATED_TASK05_NO_INFERENCE',operation:p.operation,checks,pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length,at:new Date().toISOString()},null,2));}
const context=JSON.parse(await readFile(join(q,'core-context.json')));const {reference,scope,subject,definition}=context;const c=client(subject);

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const makeRequest=(key,conversationId,text='queued native input',selected=definition)=>({version:1,agentId:selected.agentId,agentVersion:selected.version,clientRequestId:key,conversationId,parts:[{type:'text',text}]});
const newConversation=async key=>ok(await call('create-'+key,c,'mutation','runtimeTranscript:create',{memorySpaceId:scope.memorySpaceId,clientRequestId:key}));
async function cliDenied(label,fn,args,expected){const name='compat-negative-'+label;const child=spawn(process.execPath,[join(q,'run-fixture.mjs'),'run',name,fn,JSON.stringify(args)],{stdio:'inherit'});const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});assert.equal(code,1);assert.ok((await readFile(join(q,name+'.stderr'),'utf8')).includes(expected));}



const alias='task05-legacy-compat-v1';const selector={...scope,conversationId:alias};const create={...selector,type:'user-agent',participants:{userId:reference.principalId,agentId:'discovery-label-only'},metadata:{title:'Canonical compatibility'}};
await check('scoped successful assistant complete persists one registered output and duplicate terminal delivery cannot add a second journal',async()=>{
 const claim=JSON.parse(await readFile(join(q,'compat2-9-complete-claim.stdout')));const output=JSON.parse(await readFile(join(q,'compat2-10-complete-native-output.stdout')));const result=JSON.parse(await readFile(join(q,'compat2-12-complete.stdout')));assert.equal(result.responseStatus,'complete');const before=await cli('complete-stable','qualification:state',{reference});const run=before.runs.find(r=>r.runId===claim.runId);const conversation=before.conversations.find(c=>c.conversationId===run.conversationId);const native=before.nativeMessages.find(t=>t.threadId===conversation.threadId);assert.equal(native.count,2);assert.equal(before.bridges.filter(b=>output.some(m=>m.id===b.nativeMessageId)).length,1);await cliDenied('duplicate-complete','runs:complete',{reference,runId:claim.runId,attemptNumber:claim.attemptNumber,leaseVersion:claim.leaseVersion,outputMessageIds:output.map(m=>m.id)},'INVALID_STATE');assert.deepEqual(await cli('complete-stable-after','qualification:state',{reference}),before);
});
await check('compatibility deletion tombstones the same native transcript and blocks alias recreation',async()=>{
 const result=ok(await call('compat-delete',c,'mutation','conversations:deleteConversation',selector));assert.equal(result.deleted,true);assert.equal(result.cleanup,'scheduled');assert.equal(result.messagesDeleted,0);denied(await call('compat-after-delete',c,'query','conversations:get',selector),'FORBIDDEN');denied(await call('compat-recreate-denied',c,'mutation','conversations:create',create),'FORBIDDEN');
});await publish();
