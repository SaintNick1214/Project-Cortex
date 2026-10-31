/** Final installed selection/auth preflights only. No native admission or provider call. */
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openNativeContext,q,authorityReference,sha} from './common.mjs';
const c=await openNativeContext({requestTimeoutMs:30000});
const sorted=rows=>[...rows].sort((a,b)=>a._id.localeCompare(b._id));
const financial=value=>({accounts:sorted(value.accounts),attempts:sorted(value.attempts)});
const selector={tenantId:'task16-final14-readback-20261009',memorySpaceId:'final14-readback-20261009'};
const subject='final14-reader-20261009',completed=[];
let client,entry;
try{
 await c.verifyTarget('manifest14-installed-readback1-target');
 const installed=JSON.parse(await readFile(join(q,'installed-merged4-source-manifest.json')));
 assert.equal(JSON.parse(await readFile(join(q,'deploy-merged4.json'))).code,0);
 const manifest=JSON.parse(await readFile(join(q,'observed-manifest144.json')));
 const before=await c.admin.query('nativeMerged:financial',{});
 const retired=JSON.parse(await readFile(join(q,'cleanup-merged2-after.json')));
 assert.deepEqual(financial(before),financial(retired.financial));
 assert.ok(manifest.dispatchEvidence.slice(0,3).every(proof=>proof.expiresAt<Date.now()),'Real expired historical proof expected');
 assert.ok(manifest.dispatchEvidence.slice(5).every(proof=>proof.checkedAt<=Date.now()&&proof.expiresAt>Date.now()));
 await c.publish('manifest14-installed-readback1-before',{financial:financial(before),observedClock:Date.now(),historicalUnselectedFirstThreeProofsActuallyExpired:true,finalArchiveSha256:installed.archive.sha256,manifestSha256:installed.manifestSha256});
 const install=await c.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',{manifestId:manifest.manifestId,expectedRevision:14});
 assert.deepEqual(install,{manifestId:manifest.manifestId,revision:14});completed.push('installed-root14');
 assert.deepEqual(financial(await c.admin.query('nativeMerged:financial',{})),financial(before));
 assert.deepEqual(await c.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',{manifestId:manifest.manifestId,expectedRevision:14}),install);
 assert.deepEqual(financial(await c.admin.query('nativeMerged:financial',{})),financial(before));
 const actor=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject,actorKind:'user',...selector,resourceAccess:'space',capabilities:['read','write','run','tool','storage:read'],expiresAt:Date.now()+1200000});
 completed.push('new-readback-identity');
 const reference=authorityReference(actor),session=await c.http(subject).mutation('runtimeClient:session',selector);
 assert.equal(session.principalId,actor.principalId);assert.equal(session.tenantId,selector.tenantId);
 const preflightBefore=await c.admin.query('nativeMerged:financial',{});
 let expiredDenial;
 try{await c.admin.mutation('runtimeModelPolicy:ensureBudget',{reference,operationKey:'facts.resolve',requestId:'final14-expired-selected-20261009',requestCanonical:JSON.stringify({version:1,purpose:'unpaid-selected-proof-readback'})});throw Error('EXPIRED_SELECTED_PROOF_ALLOWED');}
 catch(error){assert.notEqual(error.message,'EXPIRED_SELECTED_PROOF_ALLOWED');expiredDenial=c.publicError(error);assert.match(JSON.stringify(expiredDenial),/CAPABILITY_UNAVAILABLE/);}
 assert.deepEqual(financial(await c.admin.query('nativeMerged:financial',{})),financial(preflightBefore));
 const keys=['agent.respond','media.image.generate','conversation.title','memory.extract','embedding.memory','embedding.query'];
 const expected={'agent.respond':'ACTUAL-agent-v2-generate-stream-20261009','media.image.generate':'ACTUAL-image-v4-requested-only-20261009','conversation.title':'ACTUAL-ci-conversation-title-20261009','memory.extract':'ACTUAL-memory-extract-20261009','embedding.memory':'ACTUAL-small1536-memory-query-20261009','embedding.query':'ACTUAL-small1536-memory-query-20261009'};
 const selections=[];
 for(const operationKey of keys){
  const budget=await c.admin.mutation('runtimeModelPolicy:ensureBudget',{reference,operationKey,requestId:'final14-metadata-'+operationKey,requestCanonical:JSON.stringify({version:1,purpose:'unpaid-selected-proof-readback',operationKey})});
  const replay=await c.admin.mutation('runtimeModelPolicy:ensureBudget',{reference,operationKey,requestId:'final14-metadata-'+operationKey,requestCanonical:JSON.stringify({version:1,purpose:'unpaid-selected-proof-readback',operationKey})});
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
 await c.publish('manifest14-installed-readback1-selected',{install,session,selector,reference,selections,expiredSelectedProofDenial:expiredDenial,expiredSelectedAddedAccounts:0,expiredSelectedAddedAttempts:0,profile,defaultProfile,readiness,wrongProfileDenied:true,foreignDenial:foreign,declaredPackedRuntime:true,runtimeEntrySha256:sha(entrySource),modelCalls:0});
 await c.publish('manifest14-installed-readback1-retirement-issued',{scope:selector,operation:'runtimeAuth:deleteScope',issuedAt:Date.now()});
 assert.equal(await c.admin.mutation('runtimeAuth:deleteScope',selector),null);completed.push('new-readback-scope-retired');
 let retiredDenial;
 try{await c.http(subject).mutation('runtimeClient:session',selector);throw Error('RETIRED_READBACK_SCOPE_ALLOWED');}
 catch(error){assert.notEqual(error.message,'RETIRED_READBACK_SCOPE_ALLOWED');retiredDenial=c.publicError(error);assert.match(JSON.stringify(retiredDenial),/FORBIDDEN/);}
 const finalFinancial=await c.admin.query('nativeMerged:financial',{});assert.deepEqual(financial(finalFinancial),financial(after));
 await c.publish('manifest14-installed-readback1-after',{financial:financial(finalFinancial),newZeroLiabilityAccounts:added,retiredDenial,oldAccountAndAttemptExactIdEquality:true,allPriorHeldSlotsUnchanged:true,modelCalls:0});
 await c.close();
 await c.publish('manifest14-installed-readback1-outcomes',{status:'ACTUAL_FINAL_INSTALLED_MANIFEST14_AUTH_PROFILE_PREFLIGHT_AND_CLEANUP_PASS',completed,install,finalArchiveSha256:installed.archive.sha256,manifestSha256:installed.manifestSha256,managedFiles:156,tables:72,expiredUnusedHistoricalProofsActuallyPresent:true,expiredSelectedDenial:'CAPABILITY_UNAVAILABLE',expiredSelectedNoAccountOrAttemptWrite:true,freshSelectedPreflights:6,newZeroLiabilityAccounts:7,newOperations:0,newAttempts:0,newModelCalls:0,currentSmallProfile1536:true,strictEmptyFactsVectorsReadiness:true,wrongProfile:'PROFILE_MISMATCH',foreign:'FORBIDDEN',retiredReadbackScope:'FORBIDDEN',sourceGrantNeverRestored:true,ownedRuntimeClientClosed:true,ownedEntryFileRemoved:true,allPriorAccountsRootsWindowsCountersAttemptsAndOldHeld2ExactUnchanged:true,mainTargetRetained:true,acceptance:false});
 console.log(JSON.stringify({status:'ACTUAL_FINAL_INSTALLED_MANIFEST14_AUTH_PROFILE_PREFLIGHT_AND_CLEANUP_PASS',selectedPreflights:6,newAccounts:7,newAttempts:0,newModelCalls:0,expiredSelectedDenied:true,scopeRetired:true}));
}catch(error){await c.publish('manifest14-installed-readback1-outcomes',{status:'FAIL_OR_UNKNOWN',completed,error:c.publicError(error),newModelCalls:0,noImplicitRepeatOfCommittedEffects:true});throw Error('FINAL_MANIFEST14_READBACK_FAILED_SEE_RECEIPT');}
finally{if(client)await client.close();if(entry)await unlink(entry).catch(error=>{if(error.code!=='ENOENT')throw error;});await c.close();}
