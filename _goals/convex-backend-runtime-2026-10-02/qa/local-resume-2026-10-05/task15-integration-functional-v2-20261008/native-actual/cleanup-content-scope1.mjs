/** Exact owned Task15 retirement; no inference, refund, account reset or historical replay. */
import assert from 'node:assert/strict';
import {readFile,stat,unlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {openContentContext,q,scope,subjects,sha} from './content-common1.mjs';
const c=await openContentContext({requestTimeoutMs:30000});
const fixture=JSON.parse(await readFile(join(q,'content-public-fixture1.json')));
const scopes=[scope,fixture.foreignScope], phases=[];
const owns=row=>scopes.some(s=>row.tenantId===s.tenantId&&row.memorySpaceId===s.memorySpaceId);
async function table(name,phase){
 const args=['data',name,'--format','jsonArray','--limit','1000','--url',c.state.url];
 const env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>['HOME','PATH','TMPDIR','SHELL','LANG','LC_ALL','TERM','NO_COLOR'].includes(key))),CI:'true',CONVEX_URL:c.state.url,CONVEX_DEPLOYMENT:'dev:'+c.state.deploymentName,CONVEX_DEPLOY_KEY:c.credentials.deployKey};
 env.PATH=dirname(process.execPath)+':'+env.PATH;
 const began=Date.now(),child=spawn(process.execPath,[join(c.host,'node_modules/convex/bin/main.js'),...args],{cwd:c.host,env,detached:true,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='',closed=false,timedOut=false;
 child.stdout.on('data',value=>stdout+=value);child.stderr.on('data',value=>stderr+=value);
 const signal=s=>{if(!closed)try{process.kill(-child.pid,s);}catch{}};
 const timer=setTimeout(()=>{timedOut=true;signal('SIGTERM');},30000),hard=setTimeout(()=>{if(timedOut)signal('SIGKILL');},35000);
 let exit;try{exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});}finally{clearTimeout(timer);clearTimeout(hard);}
 await c.publish(`cleanup-content1-${phase}-${name.toLowerCase()}`,{args,pid:child.pid,...exit,closed,timedOut,elapsedMs:Date.now()-began,stderr:c.redact(stderr),modelCalls:0,wholeTableRawNotPublished:true});
 assert.equal(exit.code,0);assert.equal(timedOut,false);const rows=JSON.parse(stdout);assert.ok(Array.isArray(rows)&&rows.length<1000,'bounded full financial/scope read');return rows;
}
async function snapshot(phase){
 const accounts=await table('runtimeBudgetAccounts',phase),operations=await table('runtimeModelOperations',phase),attempts=await table('runtimeModelAttempts',phase),authScopes=await table('runtimeAuthScopes',phase);
 const scopedOps=operations.filter(owns),ids=new Set(scopedOps.map(row=>row._id));
 const accountProjection=accounts.map(row=>({accountId:row._id,tenantId:row.tenantId,kind:row.kind,runBudgetId:row.runBudgetId??null,root:row.root,windowId:row.windowId,windowStart:row.windowStart,windowEnd:row.windowEnd,reservedUnits:row.reservedUnits,uncertainUnits:row.uncertainUnits,settledUnits:row.settledUnits,activeConcurrency:row.activeConcurrency,limitUnits:row.limitUnits})).sort((a,b)=>a.accountId.localeCompare(b.accountId));
 const attemptProjection=attempts.map(row=>({attemptId:row._id,operationId:row.operationDocumentId,state:row.state,reservationUnits:row.reservationUnits,slotReleased:row.slotReleased,dispatchIdentity:row.dispatchIdentity})).sort((a,b)=>a.attemptId.localeCompare(b.attemptId));
 const scopedAttempts=attemptProjection.filter(row=>ids.has(row.operationId));
 return {allTargetFinancial:{accounts:accountProjection,attempts:attemptProjection},ownedScopes:authScopes.filter(owns).map(row=>({id:row._id,tenantId:row.tenantId,memorySpaceId:row.memorySpaceId??null,epoch:row.epoch,deletedAt:row.deletedAt??null})),ownedOperations:scopedOps.map(row=>({operationId:row._id,operationKey:row.operationKey,runAccountId:row.runAccountId,parentOperationId:row.parentOperationId??null,tenantId:row.tenantId,memorySpaceId:row.memorySpaceId})),ownedAttempts:scopedAttempts};
}
const publicFinancial=value=>({ownedAccounts:value.allTargetFinancial.accounts.filter(row=>scopes.some(s=>s.tenantId===row.tenantId)),ownedAttempts:value.ownedAttempts,allTargetFinancialSha256:sha(JSON.stringify(value.allTargetFinancial)),allTargetAccountCount:value.allTargetFinancial.accounts.length,allTargetAttemptCount:value.allTargetFinancial.attempts.length});
async function denial(subject,selectedScope){
 try{await c.http(subject).mutation(c.reference('runtimeClient:session'),selectedScope);throw Error('UNEXPECTED_ALLOWED');}
 catch(error){assert.notEqual(error.message,'UNEXPECTED_ALLOWED');const rendered=c.redact(error.message);assert.match(rendered,/FORBIDDEN/);return {subject,scope:selectedScope,code:'FORBIDDEN',message:rendered.slice(0,2000),JWTCurrentAndSigned:true};}
}
try{
 await c.verifyTarget('cleanup-content1-target-verified');
 assert.equal(fixture.tenantId,scope.tenantId);assert.equal(fixture.memorySpaceId,scope.memorySpaceId);
 const server=JSON.parse(await readFile(join(q,'content-consumer5-server-cleanup.json')));assert.equal(server.closed,true);assert.equal(server.pid,6956);assert.equal(server.controllerPid,6946);
 const before=await snapshot('before'),baseline=JSON.parse(await readFile(join(q,'basic-hono3-snapshot.json')));
 const mainAccounts=before.allTargetFinancial.accounts.filter(row=>row.tenantId===scope.tenantId),tenantAccount=mainAccounts.find(row=>row.kind==='tenant');
 assert.equal(tenantAccount.uncertainUnits,4000000);assert.equal(tenantAccount.reservedUnits,0);assert.equal(tenantAccount.settledUnits,0);assert.equal(tenantAccount.activeConcurrency,0);assert.equal(before.ownedAttempts.length,40);assert.ok(before.ownedAttempts.every(row=>row.slotReleased));
 assert.deepEqual(mainAccounts.map(({tenantId,...row})=>row),baseline.accounts.map(row=>({accountId:row.accountId,kind:row.kind,runBudgetId:row.runBudgetId??null,root:row.root,windowId:row.windowId,windowStart:row.windowStart,windowEnd:row.windowEnd,reservedUnits:row.reservedUnits,uncertainUnits:row.uncertainUnits,settledUnits:row.settledUnits,activeConcurrency:row.activeConcurrency,limitUnits:row.limitUnits})).sort((a,b)=>a.accountId.localeCompare(b.accountId)));
 await c.publish('cleanup-content1-before',{...publicFinancial(before),ownedScopes:before.ownedScopes,ownedOperations:before.ownedOperations,noAddedPaidEffects:true});
 for(let index=0;index<scopes.length;index++){
  const selected=scopes[index],previous=before.ownedScopes.find(row=>row.tenantId===selected.tenantId&&row.memorySpaceId===selected.memorySpaceId);assert.ok(previous);assert.equal(previous.deletedAt,null);
  await c.publish(`cleanup-content1-issued-${index}`,{operation:'runtimeAuth:deleteScope',scope:selected,previousEpoch:previous.epoch,issuedAtUtc:new Date().toISOString(),noInference:true});
  const result=await c.admin.mutation(c.reference('runtimeAuth:deleteScope'),selected);assert.equal(result,null);
  phases.push({scope:selected,result:null,originalEpoch:previous.epoch});await c.publish(`cleanup-content1-retired-${index}`,phases.at(-1));
 }
 const denials=[];for(const key of ['owner','operator','expiry'])denials.push(await denial(subjects[key],scope));denials.push(await denial(subjects.foreign,fixture.foreignScope));
 await c.publish('cleanup-content1-role-denials',{denials,allThreeMainRolesForbidden:true,foreignOwnedScopeForbidden:true,newModelCalls:0});
 const after=await snapshot('after');assert.deepEqual(after.allTargetFinancial,before.allTargetFinancial);
 for(const selected of scopes){const previous=before.ownedScopes.find(row=>row.tenantId===selected.tenantId&&row.memorySpaceId===selected.memorySpaceId),current=after.ownedScopes.find(row=>row.tenantId===selected.tenantId&&row.memorySpaceId===selected.memorySpaceId);assert.ok(current.deletedAt);assert.equal(current.epoch,previous.epoch+1);}
 await c.publish('cleanup-content1-after',{...publicFinancial(after),ownedScopes:after.ownedScopes,allTargetFinancialUnchanged:true});
 assert.equal((await stat(fixture.privateDirectory)).mode&0o777,0o700);const removed=[];
 for(const name of ['owner.jwt','owner-refresh.jwt','ui-expired.jwt','ui-foreign.jwt']){const path=join(fixture.privateDirectory,name),metadata=await stat(path);assert.ok(metadata.isFile());assert.equal(metadata.mode&0o777,0o600);await unlink(path);await assert.rejects(stat(path),{code:'ENOENT'});removed.push({path,bytes:metadata.size,mode:'0600',removed:true});}
 await c.close();
 await c.publish('cleanup-content1-outcomes',{status:'ACTUAL_TASK15_OWNED_SCOPES_AND_TOKENS_RETIRED_WITH_FINANCIAL_FENCES_PRESERVED',retirements:phases,denials,ownedTokenFiles:removed,scopeEpochs:after.ownedScopes,allTargetFinancialUnchanged:true,task15ActualAttemptCount:40,task15FullUnknownLiabilityUnits:4000000,task15ReservedUnits:0,task15SettledUnits:0,task15ActiveConcurrency:0,allTask15ConfirmedSlotsReleased:true,modelCalls:0,readmissions:0,authorityRestorations:0,refunds:0,ownedNextServerClosed:true,ownedHTTPAndRuntimeClientsClosed:true,mainDev3174742:'retained for newly scoped03/final; not retired',centralCredentialAndIssuerStore:'retained0700/0600 sole copy; no printed values or authority restoration',otherHistoricalScopesAndHeldUnknownMedia:'unchanged',current15CanonicalHistoryAndFinancialRows:'retained behind retired scope; no physical purge or reset'});
 console.log(JSON.stringify({status:'TASK15_SCOPED_CLEANUP_PASS',retiredScopes:2,mainRoleDenials:3,removedTokenFiles:4,fullUnknownLiabilityUnits:4000000,modelCalls:0}));
}catch(error){await c.publish('cleanup-content1-outcomes',{status:'FAIL_OR_UNKNOWN',completedRetirements:phases,error:{name:error.name,message:c.redact(error.message).slice(0,4000)},modelCalls:0,readmissions:0,noImplicitReplayOfCompletedRetirements:true});throw Error('TASK15_CLEANUP_FAILED_SEE_PUBLIC_RECEIPT');}
finally{await c.close();}
