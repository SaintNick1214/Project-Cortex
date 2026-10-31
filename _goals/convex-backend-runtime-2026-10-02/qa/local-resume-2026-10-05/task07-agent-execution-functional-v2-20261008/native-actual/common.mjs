/** Practical owned Task07 collector. Importing this file has no service effects. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, sign } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

export const q = dirname(new URL(import.meta.url).pathname);
export const root = resolve(q, '../../../../../..');
export const expectedTarget = Object.freeze({ teamId:325340, projectId:3172114, deploymentName:'determined-raven-795',
  deploymentUrl:'https://determined-raven-795.convex.cloud', disposable:true });
const priorQa = join(root, '_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task06-additive-functional-v2-20261008/native-actual/custom');
export const sha = value => createHash('sha256').update(value).digest('hex');
export async function openOwnedContext() {
  const pointer = JSON.parse(await readFile(join(priorQa,'fixture-pointer.json'),'utf8'));
  const state = JSON.parse(await readFile(join(pointer.privateDirectory,'state.json'),'utf8'));
  assert.equal(state.operation, pointer.operation);
  assert.equal(state.projectId, expectedTarget.projectId); assert.equal(state.teamId, expectedTarget.teamId);
  assert.equal(state.deploymentName, expectedTarget.deploymentName); assert.equal(state.url, expectedTarget.deploymentUrl);
  assert.equal(state.retired, undefined);
  const host=join(pointer.privateDirectory,'project');
  const {ConvexHttpClient,ConvexClient}=await import(pathToFileURL(join(host,'node_modules/convex/dist/esm/browser/index.js')));
  const {makeFunctionReference}=await import(pathToFileURL(join(host,'node_modules/convex/dist/esm/server/index.js')));
  const credentials=JSON.parse(await readFile(join(pointer.privateDirectory,'credentials.json'),'utf8'));
  assert.ok(credentials.deployKey.startsWith('dev:'+state.deploymentName+'|'));
  const auth=JSON.parse(await readFile(join(pointer.privateDirectory,'auth.json'),'utf8'));
  const pem=await readFile(join(pointer.privateDirectory,'jwt-private.pem'));
  const secrets=new Set([credentials.adminKey,credentials.deployKey]); const ownedClients=new Set();
  const redact=text=>{let safe=String(text);for(const secret of secrets)if(secret)safe=safe.replaceAll(secret,'[REDACTED]');return safe;};
  const publicError=e=>({name:e?.name??'unknown',message:redact(e?.message??String(e)).slice(0,8000),...(e?.data!==undefined?{data:JSON.parse(redact(JSON.stringify(e.data)))}:{})});
  async function publish(name,value) {
    assert.match(name,/^[a-z0-9][a-z0-9._-]*$/); await mkdir(q,{recursive:true});
    await writeFile(join(q,name+'.json'),redact(JSON.stringify(value,null,2))+'\n');
  }
  function token(subject,hostAuth=false) {
    const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
    const raw=enc({alg:'RS256',kid:auth.kid,typ:'JWT'})+'.'+enc({iss:hostAuth?auth.hostIssuer:auth.issuer,sub:subject,
      aud:hostAuth?auth.hostAudience:auth.applicationID,iat:now,exp:now+7200});
    const jwt=raw+'.'+sign('RSA-SHA256',Buffer.from(raw),pem).toString('base64url'); secrets.add(jwt);return jwt;
  }
  function http(subject,hostAuth=false) {
    const client=new ConvexHttpClient(state.url,{logger:false,fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(90_000)})});
    if(subject)client.setAuth(token(subject,hostAuth));return client;
  }
  function reactive(subject) {
    const client=new ConvexClient(state.url,{logger:false}); const jwt=token(subject);client.setAuth(async()=>jwt);
    ownedClients.add(client);return client;
  }
  async function closeReactive(client) { if(!ownedClients.has(client))return;ownedClients.delete(client);await client.close(); }
  const admin=http(); admin.setAdminAuth(credentials.adminKey);
  async function verifyTarget(label='target-current') {
    const account=JSON.parse(await readFile(join(homedir(),'.convex/config.json'),'utf8'));
    const utility=await import(pathToFileURL(join(host,'node_modules/@cortexmemory/cli/dist/utils/init/development-target.js')));
    const result=await utility.verifyDisposableDevelopmentTarget(expectedTarget,account.accessToken);
    await publish(label,{target:result.target,verifiedAt:result.verifiedAt,soleOwnedCloudDevelopment:true,production:false}); return result;
  }
  async function close() {const errors=[];for(const client of [...ownedClients]){ownedClients.delete(client);try{await client.close();}catch(e){errors.push(publicError(e));}}if(errors.length)throw new AggregateError(errors,'Owned reactive client cleanup failed');}
  return {pointer,state,host,functionsDirectory:'custom/backend/',credentials,auth,http,reactive,closeReactive,admin,token,redact,publicError,publish,verifyTarget,close,
    owner:http('cortex-owner'),foreign:http('foreign-user'),anonymous:http(),hostOwner:http('host-owner',true),tenantId:'task06-custom',memorySpaceId:'task06-custom-space',
    reference:makeFunctionReference};
}

export async function denied(action) {try{await action();throw new Error('UNEXPECTED_ALLOWED');}catch(e){assert.notEqual(e.message,'UNEXPECTED_ALLOWED');return e;}}
export async function waitUntil(label,observe,predicate,{timeoutMs=120_000,pollMs=250}={}) {
  const started=performance.now();let latest;
  while(performance.now()-started<timeoutMs){latest=await observe();if(predicate(latest))return latest;await new Promise(resolve=>setTimeout(resolve,pollMs));}
  throw new Error(`${label}: deadline exceeded (${timeoutMs}ms); last state ${latest?.state??'unknown'}`);
}

/** Cursor is saved output replay; this makes no claim of upstream stream resumption. */
export function observeRun(context,subject,runId,{afterSequence=0,finalOnly=false,label='observer'}={}) {
  const client=context.reactive(subject),events=[],parts=new Map();let error,latest,unsubscribe;
  unsubscribe=client.onUpdate(context.reference('runtimeAgent:observe'),{runId,memorySpaceId:context.memorySpaceId,afterSequence,limit:100,finalOnly},value=>{
    latest=value;events.push({observedAt:Date.now(),state:value.state,cursor:value.cursor,parts:value.parts,approvals:value.approvals});
    for(const row of value.parts){const previous=parts.get(row.sequence);if(previous&&JSON.stringify(previous)!==JSON.stringify(row))error=new Error('Sequence changed');parts.set(row.sequence,row);}
  },e=>{error=e;});
  return {label,client,events,parts,get latest(){if(error)throw error;return latest;},get error(){return error;},
    async disconnect(){unsubscribe?.();unsubscribe=undefined;await context.closeReactive(client);},
    async terminal(timeoutMs=120_000){return await waitUntil(label,async()=>this.latest,v=>v&&['complete','failed','cancelled','unknown'].includes(v.state),{timeoutMs});}};
}
