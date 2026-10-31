/** New prospective sync scope; preserve async root10 and every prior financial account. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try {
 await c.verifyTarget('prepare-sync1-target-verified');
 const original=JSON.parse(await readFile(join(q,'commission-only-manifest1.json'))),manifest=structuredClone(original),now=Date.now();
 manifest.manifestId+='-sync';manifest.revision=11;
 const contract={kind:'DISTINCT_SYNC_PRIVATE_INPUT_NOT_ASYNC_RETRY',nativePath:'/v1/videos/generations',modelId:'google/veo-3.1',duration:4,resolution:'720p',generateAudio:false,n:1,maxRetries:0,ceilingUnits:2000000,requestTimeoutMs:180000,controllerDeadlineMs:200000,maximumNativeEncodedResponseBytes:28000000,maximumDecodedAssetBytes:20000000,maximumPrivateLedgerSummaryBytes:60000,genericVideoLedgerReplay:false,actualEvidencePending:true,shippedQualification:false};
 const evidence=sha(JSON.stringify(contract));manifest.evidenceHash=evidence;manifest.acceptanceHash=sha('UNREVIEWED_DISTINCT_SYNC:'+evidence);
 for(const policy of manifest.policies){policy.policyId+='-sync';policy.version=11;if(policy.rules.limits)policy.rules.limits.timeoutMs=180000;if(policy.operationKey==='media.video.generate')policy.rules.pins.boundRevision='private-frame-video-8192-4s720p-sync180-v1';}
 const qualification=manifest.qualifications.find(row=>row.nativeInterface==='video'),proof=manifest.dispatchEvidence.find(row=>row.nativeInterface==='video');assert.ok(qualification&&proof);
 qualification.receiptId+='-sync';qualification.boundRevision='private-frame-video-8192-4s720p-sync180-v1';qualification.limits.timeoutMs=180000;
 proof.receiptId=qualification.receiptId;proof.boundRevision=qualification.boundRevision;proof.checkedAt=now-1;proof.expiresAt=now+86400000;proof.evidenceHash=evidence;proof.inputBound.proofHash=evidence;proof.resultBound.proofHash=evidence;
 assert.equal(proof.resultBound.maximumPrivateResultBytes,60000);assert.deepEqual(manifest.qualifications.filter(row=>row.nativeInterface!=='video'),original.qualifications.filter(row=>row.nativeInterface!=='video'));assert.deepEqual(manifest.dispatchEvidence.filter(row=>row.nativeInterface!=='video'),original.dispatchEvidence.filter(row=>row.nativeInterface!=='video'));
 await c.publish('sync-commission-contract1',contract);await c.publish('sync-commission-manifest1',manifest);
 // Validate prospective limits through the same installed product domain parser.
 const domain=await import(new URL('./local-media-input1/model-policy.js',import.meta.url));
 const scope={tenantId:'local-sync',memorySpaceId:'local-sync',tenantEpoch:1,memorySpaceEpoch:1,principalId:'local-sync',principalVersion:1,membershipId:'local-sync',membershipVersion:1,grantId:'local-sync',grantVersion:1};
 const selected=domain.resolveModelPolicy({context:{scope,operationKey:'media.video.generate',runBudgetId:'local-sync',authorizedOverrides:[]},policies:manifest.policies.filter(row=>!row.operationKey||row.operationKey==='media.video.generate'),qualifications:manifest.qualifications});assert.equal(selected.limits.timeoutMs,180000);assert.equal(selected.costBound.maximumCostUnits,2000000);
 const fn=join(c.host,c.functionsDirectory),path=join(fn,'runtimeModelPolicyBootstrap.ts'),before=await readFile(path,'utf8');
 const registry='DEFAULT_GATEWAY_POLICY_MANIFEST, fixtureManifest])',trusted='manifest === fixtureManifest)';assert.equal(before.split(registry).length,2);assert.equal(before.split(trusted).length,2);
 const after='import {syncFixtureManifest} from "./mediaSyncQualificationManifest";\n'+before.replace(registry,'DEFAULT_GATEWAY_POLICY_MANIFEST, fixtureManifest, syncFixtureManifest])').replace(trusted,'manifest === fixtureManifest || manifest === syncFixtureManifest)');
 await c.publish('sync-fixture-preimages1',{bootstrap:{source:before,sha256:sha(before)},originalFixtureRoot10Preserved:true,sourceManifest:'installed-current1-source-manifest.json',oldAccountsReset:false,modelCalls:0});
 await writeFile(join(fn,'mediaSyncQualificationManifest.ts'),'import type {DeploymentPolicyManifest} from "./runtimeModelPolicyBootstrap";\nexport const syncFixtureManifest = '+JSON.stringify(manifest)+' as const satisfies DeploymentPolicyManifest;\n',{flag:'wx'});
 await writeFile(join(fn,'mediaSyncProbe.ts'),await readFile(join(q,'mediaSyncProbe.fixture.ts')),{flag:'wx'});await writeFile(path,after);
 const pins=[];for(const file of ['runtimeModelPolicyBootstrap.ts','mediaSyncProbe.ts','mediaSyncQualificationManifest.ts','mediaQualificationManifest.ts']){const bytes=await readFile(join(fn,file));pins.push({file,bytes:bytes.length,sha256:sha(bytes),QAOnly:true});}
 await c.publish('sync-fixture-source-manifest1',{pins,scope:'PRIVATE_EXACT_OBJECT_FIXED_OPERATOR',manifestId:manifest.manifestId,revision:11,originalRoot10LookupPreserved:true,oldFiveQualificationsUnchanged:true,shippedRegistryChanged:false,tableChanges:0,modelCalls:0,localContractPass:true});
 console.log(JSON.stringify({status:'SYNC_FIXTURE_PREPARED',modelCalls:0,oldRoot10Preserved:true}));
}finally{await c.close();}
