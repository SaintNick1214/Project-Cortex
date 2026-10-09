/** Exact owned merged-V2 retirement. No inference, reset, refund or old-scope recovery. */
import assert from 'node:assert/strict';import {readFile,stat,unlink}from'node:fs/promises';import{join}from'node:path';import{openNativeContext,q,scope,sha}from'./common.mjs';
const c=await openNativeContext({requestTimeoutMs:30000}),completed=[];
const sorted=rows=>[...rows].sort((a,b)=>a._id.localeCompare(b._id)),financial=value=>({accounts:sorted(value.accounts),attempts:sorted(value.attempts)});
try {
 await c.verifyTarget('cleanup-merged1-target');
 const fixture=JSON.parse(await readFile(join(q,'fixture4.json'))),handle=JSON.parse(await readFile(join(q,'run-merged2-handle.json')));
 const refs=JSON.parse(await readFile(join(q,'setup-merged3-current-authority.json'))),baseline=JSON.parse(await readFile(join(q,'financial-baseline3.json')));
 const before=await c.admin.query('nativeMerged:snapshot',scope),moneyBefore=await c.admin.query('nativeMerged:financial',{});
 assert.equal(before.attempts.length,9);assert.equal(before.accounts.find(x=>x.kind==='tenant').uncertainUnits,900000);assert.ok(before.attempts.every(x=>x.slotReleased));
 for(const table of ['accounts','attempts'])for(const row of baseline[table])assert.deepEqual(moneyBefore[table].find(x=>x._id===row._id),row,'Historical '+table+' changed');
 await c.publish('cleanup-merged1-before',{snapshot:before,financial:financial(moneyBefore),oldFinancialBaselineExactIds:true,modelCalls:0});
 const removed=await c.http(fixture.operatorSubject).mutation('artifacts:deleteArtifact',{...scope,artifactId:fixture.artifactId});assert.equal(removed.deleted,true);completed.push('tiny-artifact-tombstone');
 let artifactFence;
 try {await c.http(fixture.subject).mutation('runtimeAgent:observe',{...scope,runId:handle.runId,afterSequence:0,limit:100,finalOnly:false});throw Error('DELETED_ARTIFACT_OUTPUT_NOT_FENCED');}
 catch(e){assert.notEqual(e.message,'DELETED_ARTIFACT_OUTPUT_NOT_FENCED');artifactFence=c.publicError(e);assert.match(JSON.stringify(artifactFence),/FORBIDDEN|STALE_TRANSCRIPT|STALE_CONTEXT|STALE_ARTIFACT/);}
 await c.publish('cleanup-merged1-artifact-fence',{deleted:removed,denial:artifactFence,paidCalls:0,protectedPartsDelivered:0,originalCompletedResultRetained:'run-merged2-closed.json'});
 const selectors=[scope,{tenantId:refs.outsider.tenantId,memorySpaceId:refs.outsider.memorySpaceId}];
 for(let i=0;i<selectors.length;i++){
  await c.publish('cleanup-merged1-issued-'+i,{operation:'runtimeAuth:deleteScope',scope:selectors[i],issuedAt:Date.now(),noModelCall:true});
  assert.equal(await c.admin.mutation('runtimeAuth:deleteScope',selectors[i]),null);completed.push('scope-'+i);
  await c.publish('cleanup-merged1-retired-'+i,{scope:selectors[i],result:null});
 }
 const denials=[];
 for(const subject of [fixture.subject,fixture.operatorSubject,fixture.outsiderSubject]){
  const selector=subject===fixture.outsiderSubject?selectors[1]:scope;
  try{await c.http(subject).mutation('runtimeClient:session',selector);throw Error('RETIRED_SCOPE_NOT_DENIED');}
  catch(e){assert.notEqual(e.message,'RETIRED_SCOPE_NOT_DENIED');const error=c.publicError(e);assert.match(JSON.stringify(error),/FORBIDDEN/);denials.push({subject,scope:selector,error,currentSignedJWT:true});}
 }
 const after=await c.admin.query('nativeMerged:snapshot',scope),moneyAfter=await c.admin.query('nativeMerged:financial',{});
 assert.deepEqual(financial(moneyAfter),financial(moneyBefore));assert.equal(after.data.runtimeAssets.length,0);assert.equal(after.data.runtimeAssetJobs.length,0);assert.equal(after.data.runtimeMediaJobs.length,0);
 assert.ok(after.data.runtimeIngestionJobs.every(x=>['complete','failed','cancelled'].includes(x.status??x.state)),'Owned ingestion job still active');
 const file='/Users/SaintNick/.codex/tmp/cortex-merged-v2-ui-20261009/actor.jwt',info=await stat(file);assert.ok(info.isFile());assert.equal(info.mode&0o777,0o600);
 const token=await readFile(file,'utf8'),claims=JSON.parse(Buffer.from(token.trim().split('.')[1],'base64url'));assert.equal(claims.sub,fixture.subject);assert.equal(claims.iss,c.auth.issuer);
 await unlink(file);await assert.rejects(stat(file),{code:'ENOENT'});await c.close();
 await c.publish('cleanup-merged1-after',{snapshot:after,financial:financial(moneyAfter),denials,allTargetFinancialExactIdEquality:true,oldHeldSlotsUnchanged:moneyAfter.attempts.filter(x=>!x.slotReleased).map(x=>x._id),newModelCalls:0});
 await c.publish('cleanup-merged1-outcomes',{status:'ACTUAL_MERGED_SCOPE_CLEANUP_PASS',completed,denials,artifactCurrentnessFence:artifactFence,assets:0,assetJobs:0,mediaJobs:0,ownedIngestionJobsActive:0,ownedAttempts:9,ownedUnknownUnits:900000,ownedHeldSlots:0,oldHeld2AndAllPriorFinancialRootsWindowsCountersUnchanged:true,allTargetFinancialExactIdEquality:true,ownedToken:{path:file,mode:'0600',bytes:info.size,removed:true},HTTPAndRuntimeClientsClosed:true,ownedNativeChildrenClosed:true,rootUI:'root1/ui/cleanup1.json',mainTarget3174742:'retained for final merged-candidate CI and unresolved external async capability; not retired',graphContainers:'retained exact owned Neo4j/Memgraph for final checks',centralCredentials:'sole0700/0600 copy retained; no values printed',newModelCalls:0,scopeRestorations:0,refunds:0});
 console.log(JSON.stringify({status:'ACTUAL_MERGED_SCOPE_CLEANUP_PASS',retiredScopes:2,roleDenials:3,unknownUnits:900000,oldHeldSlotsUnchanged:true,newModelCalls:0}));
}catch(e){await c.publish('cleanup-merged1-outcomes',{status:'FAIL_OR_UNKNOWN',completed,error:c.publicError(e),noImplicitRepeatOfCommittedEffects:true,newModelCalls:0});throw Error('MERGED_CLEANUP_FAILED_SEE_RECEIPT');}
finally{await c.close();}
