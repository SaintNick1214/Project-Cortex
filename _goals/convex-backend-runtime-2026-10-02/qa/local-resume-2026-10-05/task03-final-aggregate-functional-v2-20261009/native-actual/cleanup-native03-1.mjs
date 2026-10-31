import assert from 'node:assert/strict';
import {readFile,stat,unlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openNativeContext,q,scope,sha,denied,waitUntil} from './common.mjs';
const c=await openNativeContext(),phases=[];
try {
 await c.verifyTarget('cleanup-native03-1-target-verified');
 const setup=JSON.parse(await readFile(join(q,'native-deadlines1-setup.json'))),baseline=JSON.parse(await readFile(join(q,'native-deadlines2-financial-after.json')));
 const before=await c.admin.query('task03Deadline:snapshot',{});assert.deepEqual(before,baseline);await c.publish('cleanup-native03-1-before',before);
 const selectedScopes=[scope,{tenantId:scope.tenantId+'-foreign',memorySpaceId:scope.memorySpaceId+'-foreign'}];
 for(let i=0;i<selectedScopes.length;i++){
  await c.publish('cleanup-native03-1-issued'+i,{scope:selectedScopes[i],operation:'runtimeAuth:deleteScope',issuedAtUtc:new Date().toISOString(),newModelCalls:0});
  const result=await c.admin.mutation('runtimeAuth:deleteScope',selectedScopes[i]);assert.equal(result,null);phases.push({scope:selectedScopes[i],result:null});await c.publish('cleanup-native03-1-retired'+i,phases.at(-1));
 }
 const denials=[];for(const name of ['owner','viewer','operator','foreign']){const role=setup[name],selected=name==='foreign'?selectedScopes[1]:scope,error=await denied(()=>c.http(role.subject).mutation('runtimeClient:session',selected));assert.equal(error.data?.code,'FORBIDDEN');denials.push({role:name,subject:role.subject,scope:selected,error:c.publicError(error),currentSignedJWT:true});}
 const assets=await waitUntil('owned03 storage cleanup',()=>c.admin.query('task12Native:snapshot',scope),value=>value.versions.every(row=>row.physicalStorage===null)&&value.jobs.every(row=>row.state!=='uploading'),{timeoutMs:30000,pollMs:500});
 assert.ok(assets.versions.length>=3);assert.ok(assets.versions.every(row=>row.edges.every(edge=>!edge.active)));
 const after=await c.admin.query('task03Deadline:snapshot',{});assert.deepEqual(after,before);await c.publish('cleanup-native03-1-after',after);
 const installed=JSON.parse(await readFile(join(q,'installed-sdk5-source-manifest.json'))),fixtureInstall=JSON.parse(await readFile(join(q,'deadline-fixture1-install.json'))),fixtureCorrection=JSON.parse(await readFile(join(q,'deadline-fixture2-install.json'))),fn=join(c.host,c.functionsDirectory),httpPath=join(fn,'http.ts'),helperPath=join(fn,'task03Deadline.ts');
 const http=await readFile(httpPath),helper=await readFile(helperPath),preimage=await readFile(join(q,'deadline-fixture1-http-preimage.ts'));assert.equal(sha(http),fixtureInstall.httpPostimageSha256);assert.equal(sha(helper),fixtureCorrection.postimage);assert.equal(sha(preimage),fixtureInstall.httpPreimageSha256);
 await writeFile(httpPath,preimage);await unlink(helperPath);await assert.rejects(stat(helperPath),{code:'ENOENT'});
 const overlays=new Map(installed.QAOverlay.map(row=>[row.path,row.sha256]));for(const row of installed.files)assert.equal(sha(await readFile(join(fn,row.path))),overlays.get(row.path)??row.sha256,row.path);for(const row of installed.preserved)assert.equal(sha(await readFile(join(c.host,row.path))),row.sha256,row.path);
 await c.publish('cleanup-native03-1-source-restoration',{httpPreimageSha256:sha(preimage),httpRestoredSha256:sha(await readFile(httpPath)),removedOnlyOwnedFixture:{path:helperPath,sha256:sha(helper)},all107ProductSourcePinsAndHostPreimagesPreserved:true,existingHistoricalQAOverlaysPreserved:true,restoredPublicFiveRouteProductRegistration:true,enabledRestoreDeployPending:true});
 await c.publish('cleanup-native03-1-outcomes',{status:'OWNED03_SCOPES_BYTES_AND_LOCAL_FIXTURE_RETIRED_RESTORE_DEPLOY_PENDING',projectId:c.state.projectId,retirements:phases,denials,assetVersions:assets.versions.map(row=>({versionId:row.versionId,state:row.state,physicalStorage:null,activeEdges:row.edges.filter(edge=>edge.active).length})),activeAssetBytes:0,activeAssetJobs:0,historicalReadyJobsRetained:true,allTargetFinancialRootsWindowsCountersAndAttemptFencesUnchanged:true,allNew03AccountsZeroLiability:true,modelCalls:0,providerDispatches:0,paidReadmissions:0,authorityRestorations:0,refunds:0,newCredentialFiles:0,tokensInMemoryOnly:true,ownedClientsClosedOnExit:true,mainDev3174742:'retained for16/final',olderUnknownSlotsAndLiability:'unchanged; not adopted as task03 active work',sourceRestoration:'cleanup-native03-1-source-restoration.json'});
 console.log(JSON.stringify({status:'SCOPES_BYTES_FIXTURE_RETIRED',groups:9,retiredScopes:2,physicalBytes:0,modelCalls:0}));
}catch(error){await c.publish('cleanup-native03-1-outcomes',{status:'FAIL_OR_UNKNOWN',completedRetirements:phases,error:c.publicError(error),modelCalls:0,noImplicitReplayOfCommittedRetirement:true});throw error;}
finally{await c.close();}
