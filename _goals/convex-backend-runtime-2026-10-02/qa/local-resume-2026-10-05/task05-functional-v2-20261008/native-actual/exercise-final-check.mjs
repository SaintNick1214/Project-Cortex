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
async function cli(label,fn,args={}){const name=`final-check-${++sequence}-${label}`;const c=spawn(process.execPath,[join(q,'run-fixture.mjs'),'run',name,fn,JSON.stringify(args)],{stdio:'inherit'});const code=await new Promise((resolve,reject)=>{c.once('error',reject);c.once('close',resolve);});if(code!==0)throw Error('Official CLI failed '+name);const raw=await readFile(join(q,name+'.stdout'),'utf8');return raw.trim()?JSON.parse(raw):null;}
function client(subject){const c=new ConvexHttpClient(s.url,{logger:false,fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(45_000)})});if(subject){const now=Math.floor(Date.now()/1000);const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const raw=b({alg:'RS256',kid:auth.kid,typ:'JWT'})+'.'+b({iss:auth.issuer,sub:subject,aud:auth.applicationID,iat:now,exp:now+2700});c.setAuth(raw+'.'+sign('RSA-SHA256',Buffer.from(raw),pem).toString('base64url'));}return c;}
async function call(label,c,kind,fn,args){const start=Date.now();let result,error;try{result=kind==='mutation'?await c.mutation(makeFunctionReference(fn),args,{skipQueue:true}):await c[kind](makeFunctionReference(fn),args);}catch(e){error={name:e?.name??'Error',data:e?.data??null,message:String(e?.message??e).slice(0,2500)};}const receipt={label,kind,fn,args,result:result??null,error:error??null,elapsedMs:Date.now()-start,target:s.deploymentName,actualJwt:!!c};await writeFile(join(q,'public-'+label+'.json'),JSON.stringify(receipt,null,2));return receipt;}
function ok(receipt){assert.equal(receipt.error,null,JSON.stringify(receipt.error));return receipt.result;}
function denied(receipt,code){assert.ok(receipt.error);assert.ok(JSON.stringify(receipt.error).includes(code),JSON.stringify(receipt.error));}
async function check(name,body){try{await body();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:String(e?.message??e)});await publish();throw e;}await publish();}
async function publish(){await writeFile(join(q,'final-check-outcomes.json'),JSON.stringify({scope:'ACTUAL_NATIVE_AGENT_AND_AUTHENTICATED_TASK05_NO_INFERENCE',operation:p.operation,checks,pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length,at:new Date().toISOString()},null,2));}
const context=JSON.parse(await readFile(join(q,'core-context.json')));const {reference,scope,subject,definition}=context;const c=client(subject);

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const makeRequest=(key,conversationId,text='queued native input',selected=definition)=>({version:1,agentId:selected.agentId,agentVersion:selected.version,clientRequestId:key,conversationId,parts:[{type:'text',text}]});
const newConversation=async key=>ok(await call('create-'+key,c,'mutation','runtimeTranscript:create',{memorySpaceId:scope.memorySpaceId,clientRequestId:key}));
async function cliDenied(label,fn,args,expected){const name='final-check-negative-'+label;const child=spawn(process.execPath,[join(q,'run-fixture.mjs'),'run',name,fn,JSON.stringify(args)],{stdio:'inherit'});const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});assert.equal(code,1);assert.ok((await readFile(join(q,name+'.stderr'),'utf8')).includes(expected));}


await check('current final product source still rolls back Agent budget queue scheduler and revision journals atomically',async()=>{
 const before=await cli('rollback-before','qualification:state',{reference});const request={version:1,agentId:definition.agentId,agentVersion:definition.version,clientRequestId:'final-rollback-v1',parts:[{type:'text',text:'final no-dispatch rollback fixture'}]};denied(await call('final-rollback',c,'mutation','qualification:submitThenRollback',{request,marker:'final-rollback-marker-v1',...scope}),'INTENTIONAL_PARENT_ROLLBACK');assert.deepEqual(await cli('rollback-after','qualification:state',{reference}),before);
});await check('persisted model ledger confirms Task05 caused no inference admission or dispatch',async()=>{
 const state=await cli('no-inference','qualification:noInference',{reference});assert.deepEqual(state,{modelOperations:0,modelAttempts:0,dispatchCheckpoints:0,reservedUnits:0,settledUnits:0,uncertainUnits:0});
});await publish();
