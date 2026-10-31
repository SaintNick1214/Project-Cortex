/** Sole Native owner: bounded read-only dedicated-target financial/fixture snapshot. */
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const run=promisify(execFile), r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion', q=dirname(fileURLToPath(import.meta.url)), priv='/Users/SaintNick/.codex/tmp/cortex-task16-ci-native-5b5ba39cd23b';
const label=process.argv[2]; assert.equal(label,'before1');
const json=async p=>JSON.parse(await readFile(p,'utf8')), hash=s=>createHash('sha256').update(s).digest('hex'), save=async(n,v)=>writeFile(join(q,n+'.json'),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
const scope=['_id','_creationTime','tenantId','memorySpaceId','ownerPrincipalId','principalId','createdAt','updatedAt'];
const tables={
 runtimeBudgetAccounts:['_id','_creationTime','accountKey','scopeKey','kind','tenantId','runBudgetId','agentId','agentVersion','windowId','windowStart','windowEnd','currency','monetaryUnit','limitUnits','reservedUnits','settledUnits','uncertainUnits','concurrencyLimit','activeConcurrency','overrun','current','cancelled','predecessor','version','createdAt'],
 runtimeModelOperations:[...scope,'operationId','semanticId','operationKey','runAccountId','parentOperationId','source','identityHash','reservedUnits','settledUnits','uncertainUnits','overrun','cancelled'],
 runtimeModelAttempts:['_id','_creationTime','operationDocumentId','childCallId','ordinal','attemptNumber','fallbackModelId','priorAttemptId','hash','measuredInputTokens','maximumOutputTokens','tenantAccountId','runAccountId','reservationUnits','state','dispatchIdentity','checkpointAt','slotReleased','outputVisible','toolInputVisible','toolResultVisible','toolEffectCommitted','receiptHash','settledCostUnits','costProvenance','actualModel','resultWithheld','terminalEvidenceHash','resultAttachmentState','createdAt'],
 runtimeAuthScopes:['_id','_creationTime','tenantId','memorySpaceId','epoch','createdAt','deletedAt'],
 runtimeAuthGrants:[...scope,'membershipId','tenantEpoch','memorySpaceEpoch','capabilities','resourceAccess','version','expiresAt','revokedAt','deletedAt'],
 runtimeAuthMemberships:[...scope,'version','revokedAt','deletedAt'],
 runtimeAuthPrincipals:['_id','_creationTime','issuer','subject','actorKind','metadataUserId','version','createdAt','revokedAt','deletedAt'],
 runtimeAuthTombstones:[...scope,'resourceType','resourceId','deletedAt'],
 runtimeRuns:[...scope,'runId','conversationId','conversationEpoch','requestIdentityHash','agentId','agentVersion','definitionHash','inputMessageIds','outputMessageIds','runBudgetId','runAccountId','responseStatus','memoryStatus','graphStatus','attemptNumber','failureCode','contextCompleteness','contextFailureCode','cancelledAt','tombstonedAt','streamingRequested'],
 runtimeAgentOperations:[...scope,'runId','attemptNumber','operationId','semanticId','kind','ordinal','toolCallId','toolName','state','nativeMessageIds','nativeModelOperationId','failureCode'],
 runtimeAgentIngestion:[...scope,'runId','attemptNumber','receiptId','outputMessageIds','sourceEvents','state'],
 runtimeTranscriptMessages:[...scope,'conversationId','nativeMessageId','role','runId','attemptNumber','order','stepOrder','revision','contentHash','sourceContentHash','sourceEventId','sourceId','approved','tombstonedAt','assetVersionIds','mediaJobReferences'],
 runtimeIngestionScopes:[...scope,'sequence','factsThrough','vectorsThrough','graphThrough','graphProfileThrough','vectorProfileThrough','version'],
 runtimeIngestionEvents:[...scope,'eventId','sequence','lineage','contentHash','createdAt','updatedAt','conversationId','nativeMessageId','eligibility','factsState','vectorsState','graphState','graphProfilesComplete','vectorProfilesComplete','profile','runId'],
 runtimeIngestionStages:[...scope,'eventId','stage','state','attempt','leaseVersion','leaseExpiresAt','receiptId','failureCode','updatedAt'],
 runtimeIngestionJobs:[...scope,'eventId','runBudgetId','runAccountId'],
 runtimeAssets:[...scope,'assetId','latestVersion','deletedAt'],
 runtimeAssetVersions:[...scope,'assetId','versionId','assetVersion','contentHash','sizeBytes','mimeType','mediaKind','deletedAt'],
 runtimeAssetJobs:[...scope,'jobId','assetId','assetVersion','versionId','state','failureCode','expiresAt'],
 runtimeMediaJobs:[...scope,'jobId','artifactId','kind','state','failureCode','costStatus','runBudgetId','runAccountId','parentOperationId','attemptId','modelOperationId','expiresAt'],
 runtimeContentJobs:[...scope,'jobId','artifactId','intent','state','failureCode','costStatus','runBudgetId','runAccountId','parentOperationId','primaryOperationId','titleOperationId','expiresAt'],
 runtimeModelPolicies:[...scope,'policyId','version','scope','agentId','agentVersion','operationKey','active','revokedAt'],
 runtimeModelQualifications:['_id','_creationTime','receiptId','version','active','revokedAt','createdAt'],
};
const startedAt=new Date().toISOString(); const out={status:'READONLY_DEDICATED_CURRENT_CI_STATE',workflowRunId:null,headSha:null,label,startedAt,baselineTiming:'Prospective read-only baseline before Parent commits/pushes the resumed media correction and before new CI effects; comparison baseline is the closed successor4 snapshot12:20:37-12:20:51Z. No transactional snapshot is claimed.',targets:[],effects:{deployment:0,rootReset:0,provision:0,model:0,setting:0,secret:0,retirement:0}};
await save(label+'-started',{startedAt,workflowRunId:out.workflowRunId,label});
try{
 assert.equal((await lstat(priv)).mode&0o777,0o700);
 const state=await json(join(priv,'state.json')),access=(await json(join(homedir(),'.convex/config.json'))).accessToken;
 const get=async path=>{const res=await fetch('https://api.convex.dev'+path,{headers:{Authorization:'Bearer '+access,'Convex-Client':'npm-cli-1.46.0'},signal:AbortSignal.timeout(20000),redirect:'error'}); if(res.status!==200){await writeFile(join(priv,'resume-current-ci-before1-management-read-error.json'),JSON.stringify({path,status:res.status,body:await res.text()},null,2)+'\n',{flag:'wx',mode:0o600});throw Error('READ_ONLY_MANAGEMENT_FAILED:'+res.status);}return res.json();};
 const teamList=await get('/api/teams'),team=(Array.isArray(teamList)?teamList:teamList.teams).find(x=>x.id===325340);assert.ok(team?.slug);
 for(const[kind,id,name]of[['sdk',3176493,'steady-snake-253'],['cli',3176494,'usable-sheep-908']]){
  const metadata=state.targets.find(x=>x.kind===kind),p=join(priv,kind+'-credentials.json'),st=await lstat(p);assert.ok(st.isFile()&&!st.isSymbolicLink());assert.equal(st.mode&0o777,0o600);const c=await json(p);assert.equal(c.projectId,id);assert.equal(c.deploymentName,name);assert.equal(c.url,metadata.url);assert.ok(c.deployKey.startsWith('dev:'+name+'|'));
  const[project,dep,list,scoped]=await Promise.all([get('/v1/projects/'+id),get('/v1/deployments/'+name),get('/v1/projects/'+id+'/list_deployments'),get('/v1/teams/'+team.slug+'/projects/'+metadata.projectSlug)]);assert.equal(project.id,id);assert.equal(scoped.id,id);assert.equal(dep.projectId,id);assert.equal(dep.deploymentType,'dev');assert.equal(dep.kind,'cloud');assert.equal(dep.deploymentUrl,c.url);assert.equal(list.length,1);assert.equal(list[0].name,name);
  const t={kind,projectId:id,deploymentName:name,teamId:325340,production:false,soleCloudDev:true,identityCheckedAt:new Date().toISOString(),tables:{},reads:[]};out.targets.push(t);
  const env={PATH:process.env.PATH,HOME:process.env.HOME,CI:'true',CONVEX_URL:c.url,CONVEX_DEPLOY_KEY:c.deployKey,CONVEX_DEPLOYMENT:'dev:'+name};
  const entries=Object.entries(tables).filter(([table])=>['runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts','runtimeAuthScopes'].includes(table));
  for(let i=0;i<entries.length;i+=4)await Promise.all(entries.slice(i,i+4).map(async([table,keys])=>{
   const start=new Date().toISOString();let result;try{result=await run(process.execPath,[join(r,'node_modules/convex/bin/main.js'),'data',table,'--limit','5000','--format','jsonArray'],{cwd:r,env,timeout:30000,maxBuffer:32*1024*1024});}catch(e){await writeFile(join(priv,'resume-current-ci-before1-'+kind+'-'+table+'-read-error.json'),JSON.stringify({code:e.code??null,signal:e.signal??null,stderr:e.stderr??'',stdout:e.stdout??''},null,2)+'\n',{flag:'wx',mode:0o600});t.reads.push({table,startedAt:start,endedAt:new Date().toISOString(),status:'READ_FAILED',exitCode:e.code??null,privateErrorCaptured:true});throw Error('READ_ONLY_TABLE_FAILED:'+kind+':'+table);}
   // Official CLI data.ts returns before JSON formatting when the table is empty.
   const rows=result.stdout.trim()===''?[]:JSON.parse(result.stdout);assert.ok(rows.length<5000,'BOUND_REACHED:'+kind+':'+table);
   t.tables[table]=rows.map(row=>{const v=pick(row,keys);if(row.root)v.root=pick(row.root,['manifestId','revision','hash','artifactRevision','evidenceHash','acceptanceHash']);for(const field of['canonical','snapshotCanonical','resolutionCanonical','inputProofCanonical','terminalEvidenceCanonical','receiptCanonical','requestCanonical','requestIdentityCanonical','policyCanonical','payloadCanonical'])if(typeof row[field]==='string')v[field+'Sha256']=hash(row[field]);if(table==='runtimeRuns'){for(const field of['requestCanonical','requestIdentityCanonical'])if(typeof row[field]==='string'){try{const x=JSON.parse(row[field]);if(typeof x.clientRequestId==='string')v.clientRequestId=x.clientRequestId;}catch{}}}if(table==='runtimeModelAttempts'){for(const field of['snapshotCanonical','terminalEvidenceCanonical'])if(typeof row[field]==='string'){try{const x=JSON.parse(row[field]);v[field==='snapshotCanonical'?'selectedSnapshot':'terminalSummary']=pick(x,['operationKey','modelId','nativeInterface','qualificationReceiptId','receiptId','boundRevision','priceRevision','state','outcome','actualModel','usage','aggregateCostUsd','completedAt','maxCostUnits']);}catch{}}}return v;}).sort((a,b)=>a._id.localeCompare(b._id));
   t.reads.push({table,startedAt:start,endedAt:new Date().toISOString(),status:'READ',count:rows.length,limit:5000,completeWithinBound:true});
  }));
  t.completedAt=new Date().toISOString();await save(label+'-'+kind,t);
 }
 out.completedAt=new Date().toISOString();await save(label+'-outcomes',out);console.log(JSON.stringify({status:out.status,label,startedAt,completedAt:out.completedAt,targets:out.targets.map(t=>({kind:t.kind,accounts:t.tables.runtimeBudgetAccounts.length,operations:t.tables.runtimeModelOperations.length,attempts:t.tables.runtimeModelAttempts.length,retainedScopeRows:t.tables.runtimeAuthScopes.length})),effects:out.effects}));
}catch(e){out.status='READONLY_SNAPSHOT_FAILED';out.failureCode=e.message;out.completedAt=new Date().toISOString();await save(label+'-failure',out);console.log(JSON.stringify({status:out.status,label,failureCode:out.failureCode,effects:out.effects}));process.exitCode=1;}
