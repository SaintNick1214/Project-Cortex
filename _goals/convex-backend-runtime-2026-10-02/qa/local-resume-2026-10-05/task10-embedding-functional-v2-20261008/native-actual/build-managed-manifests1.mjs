/** One truthful observed qualification candidate. No fabricated independent PASS. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {q,sha,openOwnedContext} from './common.mjs';
const c=await openOwnedContext(),read=name=>readFile(join(q,name+'.json'),'utf8').then(JSON.parse);
try{
 const outcomes=await read('large-commission-outcomes2');assert.equal(outcomes.status,'ACTUAL_NATIVE_PASS');
 const provisional=await read('commission-only-manifest1'),packed=await read('packed-sdk-current1'),call=await read('large-commission-call1');
 const source=await readFile(join(packed.unpackedBackend,'runtimeGatewayQualifications.ts'),'utf8');
 const original=JSON.parse(/export const DEFAULT_GATEWAY_POLICY_MANIFEST = (\{[\s\S]*\}) as const satisfies DeploymentPolicyManifest;/.exec(source)[1]);
 const inputs=['large-commission-call1','large-commission1-before','large-commission1-after','large-commission-replay1','large-commission-outcomes2','large-commission-internal-reachability3','large-commission-observation-correction2','commissioning-path1','current-price-interface-evidence1','commission-fixture-source-manifest2'];
 const evidence=[];for(const name of inputs){const raw=await readFile(join(q,name+'.json'));evidence.push({path:join(q,name+'.json'),bytes:raw.length,sha256:sha(raw)});}
 const record={version:1,scope:'ACTUAL_NATIVE_EMBEDDING_PROFILE_QUALIFICATION_REVIEW_CANDIDATE',projectId:c.state.projectId,deploymentName:c.state.deploymentName,
  modelId:outcomes.modelId,actualWireModel:outcomes.actualWireModel,profile:outcomes.profile,usage:outcomes.usage,inputUtf8Bytes:outcomes.inputUtf8Bytes,
  vectorHash:outcomes.vectorHash,terminalCost:'unavailable',reservationUnits:100000,fullLiabilityRetained:true,finishedSlotReleased:true,
  exactReplayNoDispatch:true,priceBasis:'Published0.13USD/M text input, <=8192UTF8 units, 1065microUSD envelope, 100000 retained ceiling; no batch/options/dimensions override',
  evidence,sourceManifestSha256:packed.manifestSha256,independentAcceptanceClaimed:false,notTask10Acceptance:true};
 const raw=JSON.stringify(record,null,2)+'\n',recordHash=sha(raw);await writeFile(join(q,'large-actual-qualification-record1.json'),raw);
 const terminal=call.events.find(event=>event.phase==='terminal');assert.ok(terminal);assert.ok(terminal.at<=Date.now());
 const qualification=structuredClone(provisional.qualifications.at(-1)),proof=structuredClone(provisional.dispatchEvidence.at(-1));
 qualification.receiptId='ACTUAL-task10-large-'+c.state.operation;proof.receiptId=qualification.receiptId;
 proof.evidenceHash=recordHash;proof.checkedAt=terminal.at;proof.expiresAt=terminal.at+86400000;
 proof.inputBound.proofHash=recordHash;proof.resultBound.proofHash=recordHash;
 qualification.costBound.provenance='Actual bounded native profile qualification '+recordHash+'; '+record.priceBasis+'; costunknown no refund/discount';
 const candidates=[];
 for(const [kind,revision] of [['small',7]]){
  const manifest=structuredClone(original);manifest.manifestId='task10-observed-'+kind+'-'+c.state.operation;manifest.revision=revision;
  manifest.classification='reviewed-actual';manifest.evidenceHash=recordHash;manifest.acceptanceHash=recordHash;
  manifest.artifactRevision=sha(await readFile(join(packed.unpackedBackend,'runtimeGateway.ts')));
  for(const policy of manifest.policies){policy.policyId+='-task10-observed-'+kind+'-'+c.state.operation;policy.version=revision;
   if(!policy.operationKey)policy.rules.allowedModels=[...new Set([...policy.rules.allowedModels,outcomes.modelId])];}
  manifest.qualifications.push(qualification);manifest.dispatchEvidence.push(proof);
  assert.deepEqual(manifest.qualifications.slice(0,4),original.qualifications);assert.deepEqual(manifest.dispatchEvidence.slice(0,4),original.dispatchEvidence);
  assert.ok(manifest.dispatchEvidence.every(row=>row.checkedAt<=Date.now()&&Date.now()<row.expiresAt));
  await c.publish('observed-'+kind+'-manifest1',manifest);candidates.push({kind,manifestId:manifest.manifestId,expectedRevision:manifest.revision});
 }
 await c.publish('managed-policy-candidates1',{small:{manifestId:candidates[0].manifestId,expectedRevision:7},largeSelector:{modelId:outcomes.modelId,nativeInterface:'embedding',priceRevision:qualification.priceRevision,boundRevision:qualification.boundRevision},
  recordHash,largeReceiptId:qualification.receiptId,sourceManifestSha256:packed.manifestSha256,classificationPurpose:'Actual-record-bound compiled review candidates; no independent verdict asserted',shippedDefaultProfileUnchanged:true,oldQualificationObjectsPreserved:4});
 const small=await read('observed-small-manifest1');
 await writeFile(join(q,'profileObservedManifests.ts'),'import type {DeploymentPolicyManifest} from "./runtimeModelPolicyBootstrap";\n// Exact actual record hash; candidate only, no fabricated independent PASS.\nexport const smallProfileManifest = '+JSON.stringify(small)+' as const satisfies DeploymentPolicyManifest;\n');
 console.log(JSON.stringify({status:'OBSERVED_COMPILED_CANDIDATES_WRITTEN',recordHash,modelId:outcomes.modelId,independentAcceptanceClaimed:false}));
}finally{await c.close();}
