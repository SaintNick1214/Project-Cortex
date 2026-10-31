/** Root-invoked pending observation only; never submits or approves a tool. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,createSign} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {K19_PINS,requireK19ReadyPins} from './k19-collector-pins.mjs';
import {loadSession,createContext,PROOFS_ROOT} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/runner.mjs';
import {verifyCloud} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/cloud.mjs';

const Q=path.dirname(fileURLToPath(import.meta.url)),hash=v=>createHash('sha256').update(v).digest('hex');
const proofName='k19-memory-native-v2-four-run-verification-1791959794094.json';
const proofHash='b670453337e01bad8e82c8798e771f8d7167140590e8e40108c614b38f25d114';
let sdk,port,freshVerifications=0,phase='interlock',outcome;
async function main(){
  requireK19ReadyPins();assert.equal(process.versions.node,'24.15.0');
  assert.equal(process.env.CORTEX_K19_APPROVAL_READ_GO,'1','Explicit root pending-approval read GO required');
  assert.equal(process.argv.length,6,'Usage: SESSION NAME ID SUPPLEMENTAL_RUN');
  const [id,name,targetId,runId]=process.argv.slice(2);assert.equal(id,K19_PINS.sessionId);assert.equal(name,K19_PINS.name);assert.equal(Number(targetId),K19_PINS.targetId);
  assert.match(runId,/^run:[a-f0-9]{64}$/);assert.ok(!K19_PINS.runIds.includes(runId),'Separate supplemental run required');
  const rawProof=await fs.readFile(path.join(Q,proofName));assert.equal(hash(rawProof),proofHash);const proof=JSON.parse(rawProof);
  assert.equal(proof.passed,true);assert.equal(proof.target.sessionId,id);assert.deepEqual(proof.runs.map(run=>run.runId),K19_PINS.runIds);
  const session=await loadSession(PROOFS_ROOT,id),ctx=await createContext(session,{logger:()=>{}});
  ctx.persist=async()=>{};ctx.receipt=async name=>{if(name.startsWith('cloud-verified-'))freshVerifications++;};
  const originalFetch=ctx.fetch;ctx.fetch=(url,options={})=>{assert.equal((options.method??'GET').toUpperCase(),'GET','Read-only management GET');return originalFetch(url,options);};
  async function verify(){
    const current=await loadSession(PROOFS_ROOT,id);assert.equal(current.id,id);assert.equal(current.phase,'READY');assert.equal(current.ownerUid,process.getuid());
    assert.equal(current.target.id,Number(targetId));assert.equal(current.target.name,name);assert.equal(current.target.teamId,325340);assert.equal(current.target.projectId,3200658);
    assert.equal(current.target.reference,'dev/cortex-sandbox-'+id);assert.equal(current.target.isDefault,false);assert.equal(current.target.expiresAt,K19_PINS.expiresAt);assert.ok(current.target.expiresAt>Date.now());
    assert.equal(current.container.imageId,K19_PINS.imageId);const host=JSON.parse(await fs.readFile(path.join(current.receiptDir,'host-prepared.json'),'utf8'));assert.equal(host.sourceCommit,K19_PINS.sourceCommit);
    await verifyCloud(current,ctx);
  }
  phase='target';await verify();
  const installed=path.join(session.backendDir,'node_modules/@cortexmemory/sdk');
  assert.equal(hash(await fs.readFile(path.join(installed,'dist/backend/v1/manifest.json'))),K19_PINS.backendManifestSha256);
  const pkg=JSON.parse(await fs.readFile(path.join(installed,'package.json'),'utf8'));assert.equal(pkg.version,'0.39.0');
  const identities=JSON.parse(await fs.readFile(path.join(session.issuerDir,'identities.json'),'utf8'));
  const authorities=JSON.parse(await fs.readFile(path.join(session.issuerDir,'manual-authorities.json'),'utf8'));
  const owner=identities.owner;assert.ok(owner&&owner.expiresAt>Date.now());assert.equal(owner.expiresAt,K19_PINS.expiresAt);
  const privateFile=path.join(session.issuerDir,'jwt-private.pem'),stat=await fs.lstat(privateFile);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&(stat.mode&0o077)===0);
  const signingKey=await fs.readFile(privateFile,'utf8');
  const token=()=>{const now=Math.floor(Date.now()/1000),encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
    const unsigned=encode({alg:'RS256',typ:'JWT',kid:'sandbox-'+id})+'.'+encode({iss:owner.issuer,sub:owner.subject,aud:'cortex-sandbox-'+id,iat:now,exp:Math.min(now+3600,Math.floor(owner.expiresAt/1000))});
    const sign=createSign('RSA-SHA256');sign.update(unsigned);sign.end();return unsigned+'.'+sign.sign(signingKey).toString('base64url');};
  const requireHost=createRequire(path.join(session.backendDir,'package.json')),{ConvexClient}=requireHost('convex/browser');
  const {CortexRuntimeClient}=await import(pathToFileURL(path.join(installed,'dist/client-runtime/index.js')));
  port=new ConvexClient(session.target.deploymentUrl,{logger:false,unsavedChangesWarning:false});
  sdk=new CortexRuntimeClient({deploymentUrl:session.target.deploymentUrl,client:port,
    scope:{tenantId:session.publicRuntime.tenantId,memorySpaceId:session.publicRuntime.memorySpaceId},authTimeoutMs:4000,requestTimeoutMs:30000,fetchToken:async()=>token()});
  async function read(name,fn){phase=name;await verify();const value=await fn();await verify();return value;}
  const actor=await read('owner.session',()=>sdk.session());assert.equal(actor.principalId,authorities.owner.principalId);
  assert.equal(actor.tenantId,session.publicRuntime.tenantId);assert.equal(actor.memorySpaceId,session.publicRuntime.memorySpaceId);
  const handle=await read('owner.attach',()=>sdk.attach(runId));assert.equal(handle.runId,runId);
  const observation=await read('owner.observe',()=>sdk.observe(handle,{limit:100}));
  assert.equal(observation.run.runId,runId);assert.equal(observation.run.responseStatus,'waiting_approval');assert.ok(observation.run.attemptNumber>0);
  assert.equal(observation.approvals.length,1,'One actual pending tool approval required');const approval=observation.approvals[0];
  assert.equal(approval.toolName,'memory_remember');assert.match(approval.operationId,/^agent-op:[a-f0-9]{64}$/);assert.match(approval.requestHash,/^[a-f0-9]{64}$/);
  return {passed:true,readOnly:true,mutationRegistrationsHaveReadOnlyBodies:true,submitted:false,approved:false,paidCalls:0,rawPrivatePayloadRetained:false,
    target:{sessionId:id,name,id:Number(targetId),sourceCommit:K19_PINS.sourceCommit,imageId:K19_PINS.imageId},runId,attemptNumber:observation.run.attemptNumber,
    responseStatus:'waiting_approval',approval:{operationId:approval.operationId,toolName:approval.toolName,requestHash:approval.requestHash},
    fixedFourProofSha256:proofHash,freshVerifications,authTimeoutMs:4000,requestTimeoutMs:30000};
}
try{outcome=await main();}catch(error){const text=String(error?.message??error);outcome={passed:false,readOnly:true,submitted:false,approved:false,phase,
  errorSha256:hash(text),errorBytes:Buffer.byteLength(text),knownCode:typeof error?.code==='string'&&/^[A-Z_]{1,80}$/.test(error.code)?error.code:undefined,rawPrivatePayloadRetained:false,freshVerifications};process.exitCode=1;}
finally{await sdk?.close();await port?.close();}
outcome.clientsClosed=true;const receipt=path.join(Q,'k19-pending-approval-observation-'+Date.now()+'.json');await fs.writeFile(receipt,JSON.stringify(outcome,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({receipt,passed:outcome.passed,clientsClosed:true,approval:outcome.approval,rawPrivatePayloadRetained:false}));
