import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash,sign} from 'node:crypto';
export const q=dirname(new URL(import.meta.url).pathname),root='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
export const sha=value=>createHash('sha256').update(value).digest('hex');
/** Native RPC reference is smaller than the returned authority result. */
export function authorityReference(value){const result={};for(const key of ['principalId','principalVersion','membershipId','membershipVersion','grantId','grantVersion','tenantId','tenantEpoch','memorySpaceId','memorySpaceEpoch'])if(value[key]!==undefined)result[key]=value[key];return result;}
export async function openOwnedContext(){
 const pointer=JSON.parse(await readFile(join(q,'fixture-pointer.json'))),state=JSON.parse(await readFile(join(pointer.privateDirectory,'state.json')));
 const created=JSON.parse(await readFile(join(q,'target-provision.json')));
 assert.equal(state.operation,pointer.operation);assert.equal(created.operation,state.operation);assert.equal(state.teamId,325340);
 assert.equal(created.projectId,state.projectId);assert.equal(created.deploymentName,state.deploymentName);assert.equal(created.url,state.url);
 assert.equal(state.projectName,pointer.projectName);assert.match(state.projectName,/^cortex-task10-embedding-v2-[a-f0-9]{12}$/);
 assert.equal(state.retired,undefined);assert.equal(state.production,false);assert.equal(created.requestedType,'dev');assert.equal(created.currentProjectMatches,true);
 const host=join(pointer.privateDirectory,'project'),credentials=JSON.parse(await readFile(join(pointer.privateDirectory,'credentials.json')));
 assert.ok(credentials.deployKey.startsWith('dev:'+state.deploymentName+'|'));
 const auth=JSON.parse(await readFile(join(pointer.privateDirectory,'auth.json'))),pem=await readFile(join(pointer.privateDirectory,'jwt-private.pem'));
 const {ConvexHttpClient,ConvexClient}=await import(pathToFileURL(join(host,'node_modules/convex/dist/esm/browser/index.js')));
 const {makeFunctionReference}=await import(pathToFileURL(join(host,'node_modules/convex/dist/esm/server/index.js')));
 const secrets=new Set([credentials.adminKey,credentials.deployKey]),clients=new Set();
 const redact=value=>{let text=String(value);for(const secret of secrets)if(secret)text=text.replaceAll(secret,'[REDACTED]');return text;};
 const publicError=e=>({name:e?.name??'unknown',message:redact(e?.message??String(e)).slice(0,8000),...(e?.data!==undefined?{data:JSON.parse(redact(JSON.stringify(e.data)))}:{})});
 const publish=async(name,value)=>{assert.match(name,/^[a-z0-9][a-z0-9._-]*$/);await writeFile(join(q,name+'.json'),redact(JSON.stringify(value,null,2))+'\n');};
 function token(subject,hostAuth=false){const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const raw=enc({alg:'RS256',kid:auth.kid,typ:'JWT'})+'.'+enc({iss:hostAuth?auth.hostIssuer:auth.issuer,sub:subject,aud:hostAuth?auth.hostAudience:auth.applicationID,iat:now,exp:now+7200});
  const jwt=raw+'.'+sign('RSA-SHA256',Buffer.from(raw),pem).toString('base64url');secrets.add(jwt);return jwt;}
 function http(subject,hostAuth=false){const client=new ConvexHttpClient(state.url,{logger:false,fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(90000)})});if(subject)client.setAuth(token(subject,hostAuth));return client;}
 function reactive(subject){const client=new ConvexClient(state.url,{logger:false}),jwt=token(subject);client.setAuth(async()=>jwt);clients.add(client);return client;}
 async function closeReactive(client){if(!clients.has(client))return;clients.delete(client);await client.close();}
 async function close(){const errors=[];for(const client of [...clients]){clients.delete(client);try{await client.close();}catch(error){errors.push(publicError(error));}}if(errors.length)throw new AggregateError(errors,'Owned reactive clients did not close');}
 const admin=http();admin.setAdminAuth(credentials.adminKey);
 const expectedTarget={teamId:state.teamId,projectId:state.projectId,deploymentName:state.deploymentName,deploymentUrl:state.url,disposable:true};
 async function verifyTarget(label='target-current'){
  const account=JSON.parse(await readFile(join(homedir(),'.convex/config.json')));
  const utility=await import(pathToFileURL(join(host,'node_modules/@cortexmemory/cli/dist/utils/init/development-target.js')));
  const result=await utility.verifyDisposableDevelopmentTarget(expectedTarget,account.accessToken);
  await publish(label,{target:result.target,verifiedAt:result.verifiedAt,soleOwnedCloudDevelopment:true,production:false});return result;
 }
 return {pointer,state,host,functionsDirectory:'custom/backend/',credentials,auth,admin,owner:http('cortex-owner'),foreign:http('foreign-user'),anonymous:http(),hostOwner:http('host-owner',true),
  tenantId:'task10-'+state.operation,memorySpaceId:'task10-'+state.operation+'-space',reference:makeFunctionReference,http,reactive,closeReactive,token,redact,publicError,publish,verifyTarget,close};
}
export async function denied(action){try{await action();throw Error('UNEXPECTED_ALLOWED');}catch(error){assert.notEqual(error.message,'UNEXPECTED_ALLOWED');return error;}}
export async function waitUntil(label,observe,predicate,{timeoutMs=120000,pollMs=250}={}){const started=performance.now();let current;while(performance.now()-started<timeoutMs){current=await observe();if(predicate(current))return current;await new Promise(ok=>setTimeout(ok,pollMs));}throw Error(label+': deadline exceeded ('+timeoutMs+'ms), last state '+(current?.state??'unknown'));}
