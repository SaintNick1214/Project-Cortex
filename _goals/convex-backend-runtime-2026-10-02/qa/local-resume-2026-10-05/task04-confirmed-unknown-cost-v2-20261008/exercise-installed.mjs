import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {dirname,join} from 'node:path';
import {sign} from 'node:crypto';
import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
const q=dirname(new URL(import.meta.url).pathname);
const p=JSON.parse(await readFile(join(q,'fixture-pointer.json')));const s=JSON.parse(await readFile(join(p.privateDirectory,'state.json')));
assert.equal(s.retired,undefined);const iso=JSON.parse(await readFile(join(q,'target-isolation.json')));assert.equal(iso.deployment.projectId,s.projectId);assert.equal(iso.deployment.kind,'cloud');assert.equal(iso.deployment.deploymentType,'dev');assert.equal(iso.deployments.length,1);
const auth=JSON.parse(await readFile(join(q,'jwt-public-config.json')));const pem=await readFile(join(p.privateDirectory,'jwt-private.pem'));
const ref=a=>Object.fromEntries(['principalId','principalVersion','membershipId','membershipVersion','grantId','grantVersion','tenantId','tenantEpoch','memorySpaceId','memorySpaceEpoch'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));
async function cli(label,fn,args){label='installed-'+label;const c=spawn(process.execPath,[join(q,'run-fixture.mjs'),'run',label,fn,JSON.stringify(args)],{stdio:'inherit'});const code=await new Promise((resolve,reject)=>{c.once('error',reject);c.once('close',resolve);});if(code!==0)throw Error('Official CLI failed '+label);const raw=await readFile(join(q,label+'.stdout'),'utf8');return raw.trim()?JSON.parse(raw):null;}
function client(subject){const c=new ConvexHttpClient(s.url,{logger:false,fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(90_000)})});if(subject){const now=Math.floor(Date.now()/1000);const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const raw=b({alg:'RS256',kid:auth.kid,typ:'JWT'})+'.'+b({iss:auth.issuer,sub:subject,aud:auth.applicationID,iat:now,exp:now+2700});c.setAuth(raw+'.'+sign('RSA-SHA256',Buffer.from(raw),pem).toString('base64url'));}return c;}
async function pub(label,c,fn,args){label='installed-'+label;const start=Date.now();let result,error;try{result=await c.action(makeFunctionReference(fn),args);}catch(e){error={name:e?.name??'Error',data:e?.data??null,message:String(e?.message??e).slice(0,2000)};}const receipt={label,fn,args,result:result??null,error:error??null,elapsedMs:Date.now()-start,target:s.deploymentName,actualJwt:true};await writeFile(join(q,label+'.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({public:label,success:!error,elapsedMs:receipt.elapsedMs,errorCode:error?.data?.code}));return receipt;}
const provision=async(label,subject,tenant)=>ref(await cli(label,'runtimeAuth:provision',{issuer:auth.issuer,subject,actorKind:'user',tenantId:tenant,memorySpaceId:'qualification',capabilities:['read','write','run','admin'],resourceAccess:'space'}));
const mt='task04-installed-5bfe0c22';const mr=await provision('authority-memory','installed-memory-user',mt);
const c=client('installed-memory-user');const base={tenantId:mt,memorySpaceId:'qualification'};
await cli('memory-before','qualification:memoryState',{reference:mr});await cli('ledger-before','qualification:state',{reference:mr});
const remember=await pub('remember',c,'runtimeMemory:remember',{...base,text:'The user prefers jasmine tea.',requestId:'installed-jasmine-v1'});assert.equal(remember.error,null);
const recall=await pub('recall',c,'runtimeMemory:recall',{...base,text:'What tea does the user prefer?',requestId:'installed-recall-v1',limit:5});assert.equal(recall.error,null);
await cli('memory-after','qualification:memoryState',{reference:mr});await cli('ledger-after','qualification:state',{reference:mr});
const rr=await pub('remember-replay',c,'runtimeMemory:remember',{...base,text:'The user prefers jasmine tea.',requestId:'installed-jasmine-v1'});assert.equal(rr.error,null);
const qr=await pub('recall-replay',c,'runtimeMemory:recall',{...base,text:'What tea does the user prefer?',requestId:'installed-recall-v1',limit:5});assert.equal(qr.error,null);
await cli('memory-after-replay','qualification:memoryState',{reference:mr});await cli('ledger-after-replay','qualification:state',{reference:mr});
await writeFile(join(q,'exercise-installed-finished.json'),JSON.stringify({operation:p.operation,finishedAt:new Date().toISOString(),credentialsPrinted:false,actualService:true,productionSourceBootstrap:true,productionDeployment:false}));
