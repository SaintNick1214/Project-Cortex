/** One bounded read-only management identity and installed policy metadata check. */
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdtemp,chmod} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion',q=dirname(fileURLToPath(import.meta.url));
const json=async p=>JSON.parse(await readFile(p,'utf8')),run=promisify(execFile),hash=b=>createHash('sha256').update(b).digest('hex');
const startedAt=new Date().toISOString(),out={status:'READONLY_NATIVE_MEDIA_PREREQUISITES',startedAt,managementReads:0,policyDataReads:0,effects:{deployment:0,modelRequests:0,mutation:0,settings:0,credentials:0,oldOperationReplay:0}};
const save=(n,v)=>writeFile(join(q,n+'.json'),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
try {
 const pointer=await json(join(r,'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task13-media-functional-v2-20261008/native-actual/fixture-pointer.json'));
 assert.equal(pointer.projectId,3174742);assert.equal(pointer.teamId,325340);assert.equal(pointer.deploymentName,'formal-husky-914');
 assert.equal((await lstat(pointer.privateDirectory)).mode&0o777,0o700);
 const credentialPath=join(pointer.privateDirectory,'credentials.json'),st=await lstat(credentialPath);assert.ok(st.isFile()&&!st.isSymbolicLink());assert.equal(st.mode&0o777,0o600);
 const credentials=await json(credentialPath),state=await json(join(pointer.privateDirectory,'state.json'));assert.equal(state.projectId,pointer.projectId);assert.equal(state.teamId,pointer.teamId);assert.equal(state.production,false);assert.equal(state.retired,undefined);assert.ok(credentials.deployKey.startsWith('dev:formal-husky-914|'));
 const management=(await json(join(homedir(),'.convex/config.json'))).accessToken;
 const get=async p=>{out.managementReads++;const res=await fetch('https://api.convex.dev/v1'+p,{headers:{Authorization:'Bearer '+management},signal:AbortSignal.timeout(15000),redirect:'error'});assert.equal(res.status,200,'READONLY_MANAGEMENT_DENIED');return res.json();};
 const [project,deployment,list]=await Promise.all([get('/projects/3174742'),get('/deployments/formal-husky-914'),get('/projects/3174742/list_deployments')]);
 assert.equal(project.id,3174742);assert.equal(project.teamId,325340);assert.equal(deployment.name,'formal-husky-914');assert.equal(deployment.projectId,3174742);assert.equal(deployment.deploymentType,'dev');assert.equal(deployment.kind,'cloud');assert.equal(new URL(deployment.deploymentUrl).origin,pointer.url);assert.equal(list.length,1);assert.equal(list[0].name,'formal-husky-914');
 out.target={projectId:3174742,teamId:325340,projectName:pointer.projectName,deploymentName:'formal-husky-914',deploymentType:'dev',kind:'cloud',production:false,soleCloudDev:true,cloudUrl:pointer.url,siteOrigin:pointer.url.replace('.convex.cloud','.convex.site'),verifiedAt:new Date().toISOString(),credentialFileMode:'0600',credentialValuesExposed:false};
 const raw=await mkdtemp(join(homedir(),'.codex/tmp/cortex-task13-readiness-'));await chmod(raw,0o700);out.privateRawDirectory=raw;
 const env={HOME:process.env.HOME,PATH:process.env.PATH,CI:'true',CONVEX_DEPLOYMENT:'dev:formal-husky-914',CONVEX_DEPLOY_KEY:credentials.deployKey,CONVEX_URL:pointer.url};
 const rows={};await Promise.all(['runtimeModelPolicies','runtimeModelQualifications'].map(async table=>{
  out.policyDataReads++;const result=await run(process.execPath,[join(r,'node_modules/convex/bin/main.js'),'data',table,'--limit','5000','--format','jsonArray'],{cwd:r,env,timeout:30000,maxBuffer:16*1024*1024});rows[table]=result.stdout.trim()?JSON.parse(result.stdout):[];assert.ok(rows[table].length<5000,'POLICY_METADATA_BOUND_REACHED');await writeFile(join(raw,table+'.json'),JSON.stringify(rows[table]),{mode:0o600,flag:'wx'});
 }));
 const active=rows.runtimeModelPolicies.filter(x=>x.scope==='deployment'&&x.active&&x.revokedAt===undefined);assert.ok(active.length>0&&active.length<65);assert.ok(active.every(x=>x.root.hash===active[0].root.hash));
 const root=active[0].root,manifest=JSON.parse(root.canonical);assert.equal(hash(root.canonical),root.hash);assert.equal(root.revision,manifest.revision);assert.equal(root.manifestId,manifest.manifestId);assert.equal(active.length,manifest.policies.filter(p=>p.scope==='deployment').length);
 assert.ok(active.every(row=>manifest.policies.some(p=>p.policyId===row.policyId&&p.version===row.version&&JSON.stringify(JSON.parse(row.canonical))===JSON.stringify(p))));
 const qualified=rows.runtimeModelQualifications.filter(x=>x.version===root.revision&&x.active&&x.revokedAt===undefined);assert.equal(qualified.length,manifest.qualifications.length);assert.ok(qualified.every(row=>manifest.qualifications.some(p=>p.receiptId===row.receiptId&&JSON.stringify(JSON.parse(row.canonical))===JSON.stringify(p))));
 await writeFile(join(raw,'installed-manifest.json'),JSON.stringify(manifest),{mode:0o600,flag:'wx'});
 out.installedRoot={manifestId:root.manifestId,revision:root.revision,hash:root.hash,artifactRevision:root.artifactRevision,activeDeploymentPolicies:active.length,activeQualifications:qualified.length,qualificationsMetadataConsistent:true};
 out.proofs=manifest.dispatchEvidence.map(p=>({receiptId:p.receiptId,modelId:p.modelId,nativeInterface:p.nativeInterface,priceRevision:p.priceRevision,boundRevision:p.boundRevision,checkedAt:p.checkedAt,expiresAt:p.expiresAt,currentAtRead:p.checkedAt<=Date.now()&&Date.now()<p.expiresAt,featureEnvelope:p.inputBound.featureEnvelope,maximumPrivateResultBytes:p.resultBound.maximumPrivateResultBytes,...(p.mediaContract?{mediaContract:p.mediaContract}:{}),terminalCost:p.terminalCost}));
 out.videoProofRegistered=manifest.qualifications.some(p=>p.nativeInterface==='video');out.supportEnablementScope='UNKNOWN: metadata verifies the dev deployment/team identity but contains no documented async Gateway enablement selector.';
 out.completedAt=new Date().toISOString();await save('target-prerequisites1',out);console.log(JSON.stringify({status:out.status,target:out.target,installedRoot:out.installedRoot,videoProofRegistered:out.videoProofRegistered,managementReads:out.managementReads,policyDataReads:out.policyDataReads,effects:out.effects}));
} catch(error){out.status='READONLY_PREREQUISITES_FAILED';out.failureCode=error.code??error.name??'UNKNOWN';out.completedAt=new Date().toISOString();await save('target-prerequisites1',out);console.log(JSON.stringify({status:out.status,failureCode:out.failureCode,effects:out.effects}));process.exitCode=1;}
