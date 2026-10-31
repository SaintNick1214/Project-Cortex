import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, createSign } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadSession, createContext, PROOFS_ROOT } from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import { verifyCloud, getDeployKey } from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';
export const Q=path.dirname(new URL(import.meta.url).pathname), id='e8cccbc7-fc49-44ef-a61a-d12ca169d472', source='ae9a836ff9c5e6a0ce9a279bdbdb96ad37c2a448';
export const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const write=async(name,value)=>{const file=path.join(Q,'k9-native-negative-'+name+'.json');await fs.writeFile(file,JSON.stringify(value,null,2)+'\n');return file;};
export const errorSummary=error=>({code:typeof error?.code==='string'?error.code:typeof error?.data?.code==='string'?error.data.code:undefined,messageSha256:hash(String(error?.message??'')),messageBytes:Buffer.byteLength(String(error?.message??''))});
export async function context(){
 const s=await loadSession(PROOFS_ROOT,id);assert.equal(s.phase,'READY');assert.equal(s.target.name,'hushed-cobra-213');assert.equal(s.target.id,6136804);
 assert.equal(s.target.teamId,325340);assert.equal(s.target.projectId,3200658);assert.equal(s.target.reference,'dev/cortex-sandbox-'+id);assert.equal(s.target.isDefault,false);assert.equal(s.target.expiresAt,1792498394650);
 assert.equal(s.container.imageId,'sha256:dc90698021d55918e6b301fc9b3de5abdc08260b66a1093bcf77418801520ead');
 const ctx=await createContext(s,{logger:()=>{}});let verifications=0;ctx.persist=async()=>{};ctx.receipt=async name=>{if(name.startsWith('cloud-verified-'))verifications++;};
 const originalFetch=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET','No management mutation/key creation');return originalFetch(url,options);};
 async function verify(){
  const current=await loadSession(PROOFS_ROOT,id);assert.equal(current.phase,'READY');assert.equal(current.launcherPid,s.launcherPid);process.kill(s.launcherPid,0);await verifyCloud(s,ctx);
  const {stdout}=await promisify(execFile)('docker',['container','inspect',s.container.id],{maxBuffer:1024*1024});const [v]=JSON.parse(stdout);assert.equal(v.Id,s.container.id);assert.equal(v.Config.Image,s.container.imageId);assert.equal(v.State.Running,true);assert.equal(v.Config.Labels['dev.cortex.disposable-sandbox'],id);assert.equal(v.Config.Labels['dev.cortex.disposable-sandbox.root'],path.join(PROOFS_ROOT,'.sandbox-env-runs',id));
 }
 await verify();const keyStat=await fs.lstat(s.deploymentKeyPath);assert.equal(keyStat.mode&0o077,0);const key=await getDeployKey(s,ctx);
 const req=createRequire(path.join(s.backendDir,'package.json')), {ConvexHttpClient,ConvexClient}=req('convex/browser');
 const sdkPath=path.join(s.backendDir,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js');
 const expected=await fs.readFile('/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-compact-vector-2026-10-13/staging/'+source+'/dist/client-runtime/index.js');
 assert.equal(hash(await fs.readFile(sdkPath)),hash(expected),'Actually installed SDK bytes must match immutable archive build');
 const {CortexRuntimeClient}=await import(pathToFileURL(sdkPath));
 const httpOptions={logger:false,fetch:async(url,opts)=>fetch(url,{...opts,redirect:'error',signal:AbortSignal.timeout(30000)})};
 const admin=new ConvexHttpClient(s.target.deploymentUrl,httpOptions);admin.setAdminAuth(key);
 async function table(table){const value=await admin.query('_system/cli/tableData',{table,order:'desc',paginationOpts:{cursor:null,numItems:256}});assert.ok(Array.isArray(value.page)&&value.isDone,'Bounded complete table required');return value.page;}
 async function snapshot(){const names=['runtimeRuns','runtimeAgentExecutions','runtimeRunOutbox','runtimeRunAttempts','runtimeAgentOperations','runtimeModelOperations','runtimeModelAttempts','runtimeBudgetAccounts','runtimeMemorySources','runtimeMemoryVectors','runtimeMemoryReceipts','runtimeIngestionEvents','runtimeIngestionScopes','runtimeAuthScopes','facts','runtimeMemoryChunks','runtimeMemoryVectorGenerations','runtimeIngestionStages','runtimeIngestionJobs','runtimeModelPolicies','runtimeModelQualifications'];const rows=Object.fromEntries(await Promise.all(names.map(async name=>[name,await table(name)])));return {rows,counts:Object.fromEntries(names.map(name=>[name,rows[name].length])),hashes:Object.fromEntries(names.map(name=>[name,hash(rows[name])])),financial:rows.runtimeBudgetAccounts.map(row=>Object.fromEntries(['_id','kind','tenantId','runBudgetId','limitUnits','reservedUnits','settledUnits','uncertainUnits','activeConcurrency','version','cancelled'].filter(k=>row[k]!==undefined).map(k=>[k,row[k]])))};}
 const identities=JSON.parse(await fs.readFile(path.join(s.issuerDir,'identities.json'),'utf8'));const privatePath=path.join(s.issuerDir,'jwt-private.pem');const stat=await fs.lstat(privatePath);assert.equal(stat.mode&0o077,0);assert.equal(stat.isFile(),true);assert.equal(stat.isSymbolicLink(),false);const signingKey=await fs.readFile(privatePath,'utf8');
 function token(role,expired=false){const i=identities[role];assert.ok(i);const now=Math.floor(Date.now()/1000);assert.ok(i.expiresAt>Date.now());const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const unsigned=encode({alg:'RS256',typ:'JWT',kid:'sandbox-'+id})+'.'+encode({iss:i.issuer,sub:i.subject,aud:'cortex-sandbox-'+id,iat:expired?now-3600:now,exp:expired?now-60:Math.min(now+3600,Math.floor(i.expiresAt/1000))});const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();return unsigned+'.'+signer.sign(signingKey).toString('base64url');}
 const live=new Set();
 function sdk(role,{scope={tenantId:s.publicRuntime.tenantId,memorySpaceId:s.publicRuntime.memorySpaceId},jwt,hook}={}){
  const port=new ConvexClient(s.target.deploymentUrl,{logger:false,unsavedChangesWarning:false});live.add(port);const events=[];
  const realMutation=port.mutation.bind(port);if(hook)port.mutation=async(...args)=>{const result=await realMutation(...args);return await hook(args[0],result);};
  const client=new CortexRuntimeClient({deploymentUrl:s.target.deploymentUrl,scope,client:port,authTimeoutMs:4000,requestTimeoutMs:12000,fetchToken:async()=>jwt===undefined?token(role):jwt,onLatencyEvent:event=>events.push(event)});
  return {client,events,port,close:async()=>{await client.close();await port.close();live.delete(port);}};
 }
 async function close(){await Promise.allSettled([...live].map(port=>port.close()));live.clear();}
 return {s,ctx,verify,admin,table,snapshot,sdk,token,identities,close,ConvexHttpClient,httpOptions,verifications:()=>verifications,sdkIdentity:{path:sdkPath,sha256:hash(expected),sourceCommit:source}};
}
