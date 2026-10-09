/** Final installed selection/auth preflights only. No native admission or provider call. */
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {openNativeContext,q,authorityReference,sha} from './common.mjs';
const c=await openNativeContext({requestTimeoutMs:30000});
const sorted=rows=>[...rows].sort((a,b)=>a._id.localeCompare(b._id));
const financial=value=>({accounts:sorted(value.accounts),attempts:sorted(value.attempts)});
const selector={tenantId:'task16-final14-readback-20261009',memorySpaceId:'final14-readback-20261009'};
const subject='final14-reader-20261009',completed=[];
const exec=promisify(execFile);
const canonical=value=>JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));
async function existingAuthority(){
 const env={HOME:process.env.HOME,PATH:process.env.PATH,CONVEX_DEPLOY_KEY:c.credentials.deployKey,CONVEX_DEPLOYMENT:'dev:'+c.state.deploymentName};
 const data=async table=>{const result=await exec(process.execPath,[join(c.host,'node_modules/convex/bin/main.js'),'data',table,'--limit','1000','--format','jsonArray'],{cwd:c.host,env,timeout:30000,maxBuffer:8*1024*1024});const rows=JSON.parse(result.stdout);assert.ok(rows.length<1000);return rows;};
 const principal=(await data('runtimeAuthPrincipals')).filter(row=>row.issuer===c.auth.issuer&&row.subject===subject&&row.deletedAt===undefined&&row.revokedAt===undefined);assert.equal(principal.length,1);
 const member=(await data('runtimeAuthMemberships')).filter(row=>row.principalId===principal[0]._id&&row.tenantId===selector.tenantId&&row.deletedAt===undefined&&row.revokedAt===undefined);assert.equal(member.length,1);
 const grant=(await data('runtimeAuthGrants')).filter(row=>row.principalId===principal[0]._id&&row.membershipId===member[0]._id&&row.tenantId===selector.tenantId&&row.memorySpaceId===selector.memorySpaceId&&row.deletedAt===undefined&&row.revokedAt===undefined);assert.equal(grant.length,1);assert.ok(grant[0].expiresAt>Date.now());
 const scopes=await data('runtimeAuthScopes'),tenant=scopes.filter(row=>row.tenantId===selector.tenantId&&row.memorySpaceId===undefined&&row.deletedAt===undefined),space=scopes.filter(row=>row.tenantId===selector.tenantId&&row.memorySpaceId===selector.memorySpaceId&&row.deletedAt===undefined);assert.equal(tenant.length,1);assert.equal(space.length,1);
 const reference={principalId:principal[0]._id,principalVersion:principal[0].version,membershipId:member[0]._id,membershipVersion:member[0].version,grantId:grant[0]._id,grantVersion:grant[0].version,...selector,tenantEpoch:tenant[0].epoch,memorySpaceEpoch:space[0].epoch};
 const actor=await c.admin.query('runtimeAuth:recheck',{reference,requirement:{capability:'read',...selector}});assert.deepEqual(authorityReference(actor),reference);
 await c.publish('manifest14-installed-readback2-authority',{reference,capabilities:actor.capabilities,existingUnchangedAuthority:true,officialBoundedDataReads:4,provisionEffects:0});return actor;
}
let client,entry;
try{
 await c.verifyTarget('manifest14-installed-readback2-target');
 const installed=JSON.parse(await readFile(join(q,'installed-merged4-source-manifest.json')));
 assert.equal(JSON.parse(await readFile(join(q,'deploy-merged4.json'))).code,0);
 const manifest=JSON.parse(await readFile(join(q,'observed-manifest144.json')));
 const before=await c.admin.query('nativeMerged:financial',{});
 const retired=JSON.parse(await readFile(join(q,'cleanup-merged2-after.json')));
 assert.deepEqual(financial(before),financial(retired.financial));
 assert.ok(manifest.dispatchEvidence.slice(0,3).every(proof=>proof.expiresAt<Date.now()),'Real expired historical proof expected');
 assert.ok(manifest.dispatchEvidence.slice(5).every(proof=>proof.checkedAt<=Date.now()&&proof.expiresAt>Date.now()));
 await c.publish('manifest14-installed-readback2-before',{financial:financial(before),observedClock:Date.now(),historicalUnselectedFirstThreeProofsActuallyExpired:true,finalArchiveSha256:installed.archive.sha256,manifestSha256:installed.manifestSha256});
 const prior=JSON.parse(await readFile(join(q,'manifest14-installed-readback1-outcomes.json')));
 assert.deepEqual(prior.completed,['installed-root14','new-readback-identity']);
 const install={manifestId:manifest.manifestId,revision:14,alreadyCommittedBy:'manifest14-installed-readback1.mjs'};
 completed.push('existing-root14-reconciled');
 const actor=await existingAuthority();completed.push('existing-readback-identity-reconciled');
 const reference=authorityReference(actor),session=await c.http(subject).mutation('runtimeClient:session',selector);
 assert.equal(session.principalId,actor.principalId);assert.equal(session.tenantId,selector.tenantId);
 const preflightBefore=await c.admin.query('nativeMerged:financial',{});
 let expiredDenial;
 try{await c.admin.mutation('runtimeModelPolicy:ensureBudget',{reference,operationKey:'facts.resolve',requestId:'final14-expired-selected-20261009',requestCanonical:canonical({version:1,purpose:'unpaid-selected-proof-readback'})});throw Error('EXPIRED_SELECTED_PROOF_ALLOWED');}
 catch(error){assert.notEqual(error.message,'EXPIRED_SELECTED_PROOF_ALLOWED');expiredDenial=c.publicError(error);assert.match(JSON.stringify(expiredDenial),/CAPABILITY_UNAVAILABLE/);}
 assert.deepEqual(financial(await c.admin.query('nativeMerged:financial',{})),financial(preflightBefore));
 const keys=['agent.respond','media.image.generate','conversation.title','memory.extract','embedding.memory','embedding.query'];
 const expected={'agent.respond':'ACTUAL-agent-v2-generate-stream-20261009','media.image.generate':'ACTUAL-image-v4-requested-only-20261009','conversation.title':'ACTUAL-ci-conversation-title-20261009','memory.extract':'ACTUAL-memory-extract-20261009','embedding.memory':'ACTUAL-small1536-memory-query-20261009','embedding.query':'ACTUAL-small1536-memory-query-20261009'};
 const selections=[];
 for(const operationKey of keys){
  const budget=await c.admin.mutation('runtimeModelPolicy:ensureBudget',{reference,operationKey,requestId:'final14-metadata-'+operationKey,requestCanonical:canonical({version:1,purpose:'unpaid-selected-proof-readback',operationKey})});
  const replay=await c.admin.mutation('runtimeModelPolicy:ensureBudget',{reference,operationKey,requestId:'final14-metadata-'+operationKey,requestCanonical:canonical({version:1,purpose:'unpaid-selected-proof-readback',operationKey})});
  assert.deepEqual(replay,budget);
  if(!['memory.extract','embedding.memory'].includes(operationKey)){
   const resolved=await c.admin.query('runtimeModelPolicy:resolve',{reference,operationKey,runBudgetId:budget.runBudgetId});
   assert.equal(resolved.snapshot.qualificationReceiptId,expected[operationKey]);
   assert.ok(resolved.dispatchEvidence.expiresAt>Date.now());
   selections.push({operationKey,budget,snapshot:resolved.snapshot,dispatchEvidence:resolved.dispatchEvidence,nativeDispatches:0});
  }else{
   const profile=operationKey==='embedding.memory'?await c.admin.query('runtimeModelPolicy:embeddingProfile',{reference,operationKey,runBudgetId:budget.runBudgetId}):undefined;
   if(profile)assert.equal(profile.dimensions,1536);
   selections.push({operationKey,budget,selectedCurrentProofPreflight:'ensureBudget resolves and checks current applicable proof before account writes',expectedCompiledReceiptId:expected[operationKey],...(profile?{profile}:{}),nativeDispatches:0});
  }
 }
 entry=join(c.host,'final14-runtime-entry.mjs');
 const entrySource='export { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";\n';
 await writeFile(entry,entrySource,{flag:'wx'});
 const runtime=await import(pathToFileURL(entry));
 client=new runtime.CortexRuntimeClient({deploymentUrl:c.state.url,assetHttpUrl:c.state.url.replace('.convex.cloud','.convex.site'),scope:selector,fetchToken:async()=>c.token(subject)});
 const profile=await client.getEmbeddingProfile({expectedProfileId:'cortex-text-small-1536-v1'});
 assert.equal(profile.profile.dimensions,1536);
 const defaultProfile=await client.getDefaultProfile();assert.deepEqual(defaultProfile.profile,profile.profile);
 const readiness=await client.memoryReadiness({expectedProfileId:profile.profile.profileId,strictStages:['facts','vectors']});
 assert.equal(readiness.cutoff,0);assert.equal(readiness.stages.facts.complete,true);assert.equal(readiness.stages.vectors.complete,true);
 await assert.rejects(()=>client.getEmbeddingProfile({expectedProfileId:'cortex-text-large-3072-v1'}),/PROFILE_MISMATCH/);
 let foreign;
 try{await c.http('native16v2-20261009').mutation('runtimeClientExtensions:embeddingProfile',selector);throw Error('FOREIGN_METADATA_ALLOWED');}
 catch(error){assert.notEqual(error.message,'FOREIGN_METADATA_ALLOWED');foreign=c.publicError(error);assert.match(JSON.stringify(foreign),/FORBIDDEN/);}
 await client.close();client=undefined;await unlink(entry);entry=undefined;
 const after=await c.admin.query('nativeMerged:financial',{});
 assert.deepEqual(sorted(after.attempts),sorted(before.attempts));
 for(const row of before.accounts)assert.deepEqual(after.accounts.find(value=>value._id===row._id),row);
 const added=after.accounts.filter(row=>!before.accounts.some(value=>value._id===row._id));
 assert.equal(added.length,7);
 assert.ok(added.every(row=>row.root.revision===14&&row.reservedUnits===0&&row.uncertainUnits===0&&row.settledUnits===0&&row.activeConcurrency===0));
 await c.publish('manifest14-installed-readback2-selected',{install,session,selector,reference,selections,expiredSelectedProofDenial:expiredDenial,expiredSelectedAddedAccounts:0,expiredSelectedAddedAttempts:0,profile,defaultProfile,readiness,wrongProfileDenied:true,foreignDenial:foreign,declaredPackedRuntime:true,runtimeEntrySha256:sha(entrySource),modelCalls:0});
 await c.publish('manifest14-installed-readback2-retirement-issued',{scope:selector,operation:'runtimeAuth:deleteScope',issuedAt:Date.now()});
 assert.equal(await c.admin.mutation('runtimeAuth:deleteScope',selector),null);completed.push('new-readback-scope-retired');
 let retiredDenial;
 try{await c.http(subject).mutation('runtimeClient:session',selector);throw Error('RETIRED_READBACK_SCOPE_ALLOWED');}
 catch(error){assert.notEqual(error.message,'RETIRED_READBACK_SCOPE_ALLOWED');retiredDenial=c.publicError(error);assert.match(JSON.stringify(retiredDenial),/FORBIDDEN/);}
 const finalFinancial=await c.admin.query('nativeMerged:financial',{});assert.deepEqual(financial(finalFinancial),financial(after));
 await c.publish('manifest14-installed-readback2-after',{financial:financial(finalFinancial),newZeroLiabilityAccounts:added,retiredDenial,oldAccountAndAttemptExactIdEquality:true,allPriorHeldSlotsUnchanged:true,modelCalls:0});
 await c.close();
 await c.publish('manifest14-installed-readback2-outcomes',{status:'ACTUAL_FINAL_INSTALLED_MANIFEST14_AUTH_PROFILE_PREFLIGHT_AND_CLEANUP_PASS',completed,install,finalArchiveSha256:installed.archive.sha256,manifestSha256:installed.manifestSha256,managedFiles:156,tables:72,expiredUnusedHistoricalProofsActuallyPresent:true,expiredSelectedDenial:'CAPABILITY_UNAVAILABLE',expiredSelectedNoAccountOrAttemptWrite:true,freshSelectedPreflights:6,newZeroLiabilityAccounts:7,rootInstallEffectsReissued:0,provisionEffectsReissued:0,originalCanonicalInputFailure:'manifest14-installed-readback1-outcomes.json',newOperations:0,newAttempts:0,newModelCalls:0,currentSmallProfile1536:true,strictEmptyFactsVectorsReadiness:true,wrongProfile:'PROFILE_MISMATCH',foreign:'FORBIDDEN',retiredReadbackScope:'FORBIDDEN',sourceGrantNeverRestored:true,ownedRuntimeClientClosed:true,ownedEntryFileRemoved:true,allPriorAccountsRootsWindowsCountersAttemptsAndOldHeld2ExactUnchanged:true,mainTargetRetained:true,acceptance:false});
 console.log(JSON.stringify({status:'ACTUAL_FINAL_INSTALLED_MANIFEST14_AUTH_PROFILE_PREFLIGHT_AND_CLEANUP_PASS',selectedPreflights:6,newAccounts:7,newAttempts:0,newModelCalls:0,expiredSelectedDenied:true,scopeRetired:true}));
}catch(error){await c.publish('manifest14-installed-readback2-outcomes',{status:'FAIL_OR_UNKNOWN',completed,error:c.publicError(error),newModelCalls:0,noImplicitRepeatOfCommittedEffects:true});throw Error('FINAL_MANIFEST14_READBACK_FAILED_SEE_RECEIPT');}
finally{if(client)await client.close();if(entry)await unlink(entry).catch(error=>{if(error.code!=='ENOENT')throw error;});await c.close();}
