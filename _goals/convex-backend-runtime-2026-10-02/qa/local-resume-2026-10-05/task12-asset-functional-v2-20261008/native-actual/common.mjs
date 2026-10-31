import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash,sign} from 'node:crypto';
export const q=dirname(new URL(import.meta.url).pathname),root='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
export const sha=value=>createHash('sha256').update(value).digest('hex');
export function authorityReference(value){const reference={};for(const key of ['principalId','principalVersion','membershipId','membershipVersion','grantId','grantVersion','tenantId','tenantEpoch','memorySpaceId','memorySpaceEpoch'])if(value[key]!==undefined)reference[key]=value[key];return reference;}
export async function openOwnedContext({signal,requestTimeoutMs=90000}={}){
 assert.ok(Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>=1000&&requestTimeoutMs<=200000);
 const pointer=JSON.parse(await readFile(join(q,'fixture-pointer.json'))),state=JSON.parse(await readFile(join(pointer.privateDirectory,'state.json'))),fixture=JSON.parse(await readFile(join(pointer.privateDataDirectory,'state.json')));
 assert.equal(state.projectId,3174742);assert.equal(pointer.projectId,state.projectId);assert.equal(pointer.operation,fixture.operation);assert.equal(state.teamId,325340);assert.equal(state.production,false);assert.equal(state.retired,undefined);assert.equal(pointer.deploymentName,state.deploymentName);
 assert.equal((await stat(pointer.privateDirectory)).mode&0o777,0o700);assert.equal((await stat(pointer.privateDataDirectory)).mode&0o777,0o700);
 for(const name of ['credentials.json','auth.json','jwt-private.pem'])assert.equal((await stat(join(pointer.privateDirectory,name))).mode&0o777,0o600);
 const credentials=JSON.parse(await readFile(join(pointer.privateDirectory,'credentials.json'))),auth=JSON.parse(await readFile(join(pointer.privateDirectory,'auth.json'))),pem=await readFile(join(pointer.privateDirectory,'jwt-private.pem'));
 assert.ok(credentials.deployKey.startsWith('dev:'+state.deploymentName+'|'));
 const host=join(pointer.privateDirectory,'project'),secrets=new Set([credentials.deployKey,credentials.adminKey]),clients=new Set();
 const redact=value=>{let text=String(value);for(const secret of secrets)if(secret)text=text.replaceAll(secret,'[REDACTED]');return text;};
 const publicError=error=>({name:error?.name??'unknown',message:redact(error?.message??String(error)).slice(0,4000),...(error?.data===undefined?{}:{data:JSON.parse(redact(JSON.stringify(error.data)))})});
 const publish=async(name,value)=>{assert.match(name,/^[a-z0-9][a-z0-9._-]*$/);await writeFile(join(q,name+'.json'),redact(JSON.stringify(value,null,2))+'\n',{flag:'wx'});};
 function token(subject,hostAuth=false){const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const input=enc({alg:'RS256',kid:auth.kid,typ:'JWT'})+'.'+enc({iss:hostAuth?auth.hostIssuer:auth.issuer,sub:subject,aud:hostAuth?auth.hostAudience:auth.applicationID,iat:now,exp:now+7200});const jwt=input+'.'+sign('RSA-SHA256',Buffer.from(input),pem).toString('base64url');secrets.add(jwt);return jwt;}
 const {ConvexHttpClient}=await import(pathToFileURL(join(host,'node_modules/convex/dist/esm/browser/index.js'))),{makeFunctionReference}=await import(pathToFileURL(join(host,'node_modules/convex/dist/esm/server/index.js')));
 function http(subject,hostAuth=false){const c=new ConvexHttpClient(state.url,{logger:false,fetch:(url,options)=>fetch(url,{...options,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(requestTimeoutMs)]):AbortSignal.timeout(requestTimeoutMs)})});if(subject)c.setAuth(token(subject,hostAuth));return c;}
 const admin=http();admin.setAdminAuth(credentials.adminKey);
 async function verifyTarget(label){const account=JSON.parse(await readFile(join(homedir(),'.convex/config.json'))),utility=await import(pathToFileURL(join(host,'node_modules/@cortexmemory/cli/dist/utils/init/development-target.js')));const result=await utility.verifyDisposableDevelopmentTarget({teamId:state.teamId,projectId:state.projectId,deploymentName:state.deploymentName,deploymentUrl:state.url,disposable:true},account.accessToken);
  const response=await fetch('https://api.convex.dev/v1/projects/'+state.projectId+'/list_deployments',{headers:{Authorization:'Bearer '+account.accessToken},signal:AbortSignal.timeout(15000),redirect:'error'});assert.equal(response.status,200);const rows=await response.json();assert.equal(rows.length,1);assert.equal(rows[0].name,state.deploymentName);assert.equal(rows[0].deploymentType,'dev');await publish(label,{target:result.target,verifiedAt:result.verifiedAt,soleCloudDev:true,production:false});return result;}
 async function runtimeClient(subject){const sdk=await import(pathToFileURL(join(host,'task12-runtime-entry.mjs')));assert.equal(typeof sdk.CortexRuntimeClient,'function');const client=new sdk.CortexRuntimeClient({deploymentUrl:state.url,assetHttpUrl:state.url.replace('.convex.cloud','.convex.site'),fetchToken:async()=>token(subject),scope:{tenantId:fixture.tenantId,memorySpaceId:fixture.memorySpaceId}});clients.add(client);return client;}
 async function closeClient(client){if(!clients.has(client))return;clients.delete(client);await client.close();}
 async function close(){const errors=[];for(const client of [...clients]){clients.delete(client);try{await client.close();}catch(error){errors.push(publicError(error));}}if(errors.length)throw new AggregateError(errors,'Owned runtime clients did not close');}
 return {pointer,state,fixture,host,credentials,auth,admin,http,token,publicError,publish,redact,verifyTarget,runtimeClient,closeClient,close,reference:makeFunctionReference,functionsDirectory:'custom/backend/',tenantId:fixture.tenantId,memorySpaceId:fixture.memorySpaceId};
}
export async function denied(action){try{await action();throw Error('UNEXPECTED_ALLOWED');}catch(error){assert.notEqual(error.message,'UNEXPECTED_ALLOWED');return error;}}
export async function waitUntil(label,observe,predicate,{timeoutMs=120000,pollMs=250}={}){const start=performance.now();let result;while(performance.now()-start<timeoutMs){result=await observe();if(predicate(result))return result;await new Promise(done=>setTimeout(done,pollMs));}throw Error(label+': deadline exceeded; last='+JSON.stringify(result));}
