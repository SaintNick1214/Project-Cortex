/** Run only after the exclusive Task10 build handoff. This declares no prior actual acceptance. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try{
 const packed=JSON.parse(await readFile(join(q,'packed-sdk-current1.json')));
 const source=await readFile(join(packed.unpackedBackend,'runtimeGatewayQualifications.ts'),'utf8');
 const match=/export const DEFAULT_GATEWAY_POLICY_MANIFEST = (\{[\s\S]*\}) as const satisfies DeploymentPolicyManifest;/.exec(source);assert.ok(match);
 const original=JSON.parse(match[1]),manifest=structuredClone(original),operation=c.state.operation,now=Date.now();
 assert.equal(original.revision,5);assert.equal(original.qualifications.length,4);assert.equal(original.dispatchEvidence.length,4);
 assert.ok(original.dispatchEvidence.every(proof=>proof.checkedAt<=now&&now<proof.expiresAt),'Existing qualifications are no longer current');
 const path=JSON.parse(await readFile(join(q,'commissioning-path1.json'))),prices=JSON.parse(await readFile(join(q,'current-price-interface-evidence1.json'))),profile=path.profile;
 const proofHash=sha(JSON.stringify({path,prices})),priceRevision=path.priceRevision,boundRevision=path.boundRevision;
 manifest.manifestId='task10-operator-qualification-'+operation;manifest.revision=6;manifest.classification='fixture-synthetic';
 manifest.evidenceHash=proofHash;manifest.acceptanceHash=sha('UNREVIEWED_OPERATOR_QUALIFICATION:'+proofHash);
 manifest.artifactRevision=sha(await readFile(join(packed.unpackedBackend,'runtimeGateway.ts')));
 for(const policy of manifest.policies){policy.policyId+='-task10-operator-'+operation;policy.version=6;
  if(!policy.operationKey){policy.rules.allowedModels=[...new Set([...policy.rules.allowedModels,profile.modelId])];}}
 for(const key of ['embedding.memory','embedding.query'])manifest.policies.push({policyId:'task10-operator-'+key+'-'+operation,version:6,scope:'deployment',operationKey:key,
  rules:{modelId:profile.modelId,nativeInterface:'embedding',pins:{priceRevision,boundRevision}}});
 const receiptId='PROVISIONAL-task10-large-'+operation;
 manifest.qualifications.push({receiptId,modelId:profile.modelId,nativeInterface:'embedding',capabilities:['embedding'],allowedOptions:[],
  limits:{inputTokens:8192,contextTokens:16384,outputTokens:512,toolSteps:0,timeoutMs:60000,operationBudgetUnits:200000,runBudgetUnits:2000000,tenantBudgetUnits:10000000,concurrency:2},
  costBound:{kind:'qualified-call-ceiling',maximumCostUnits:100000,coversAllProviderCharges:true,provenance:'Fixed operator commissioning, one text value <=8192 UTF8 units at published Vercel/OpenAI 0.13USD/M; envelope1065microUSD, retained100000microUSD ceiling; no optional dimensions/batch/fallback/provider extras'},priceRevision,boundRevision});
 manifest.dispatchEvidence.push({receiptId,modelId:profile.modelId,nativeInterface:'embedding',evidenceHash:proofHash,providerVersion:'0.2.1',priceRevision,boundRevision,
  embeddingProfile:profile,terminalModelId:path.wireTerminalId,checkedAt:now-1,expiresAt:now+86400000,terminalCost:'unavailable',terminalProof:'provider-terminal-v1',
  inputBound:{ruleId:path.ruleId,revision:1,featureEnvelope:path.featureEnvelope,proofHash,documentHash:sha(await readFile(join(q,'current-price-interface-evidence1.json'))),nativeTransformHash:sha(await readFile(join(c.host,'node_modules/@convex-dev/ai-sdk-provider/src/index.ts')))},
  resultBound:{maximumPrivateResultBytes:131072,maximumOutputTokens:0,maximumEmbeddingValues:1,proofHash}});
 assert.deepEqual(manifest.qualifications.slice(0,4),original.qualifications);assert.deepEqual(manifest.dispatchEvidence.slice(0,4),original.dispatchEvidence);
 await c.publish('commission-only-manifest1',manifest);
 await c.publish('commission-only-lineage1',{status:'PROVISIONAL_FIXED_OPERATOR_CONTRACT_NOT_ACTUAL_QUALIFICATION',projectId:c.state.projectId,operation,
  originalManifest:original.manifestId,oldQualificationObjectsPreserved:4,oldDispatchObjectsPreserved:4,newReceiptId:receiptId,exactOperatorFixtureOnly:true,
  shippedRegistryChanged:false,actualEvidencePending:true,noFabricatedIndependentAcceptance:true,sourceManifestSha256:packed.manifestSha256,proofHash,priceRevision,boundRevision,largeResultBytes131072:true,at:new Date().toISOString()});
 console.log(JSON.stringify({status:'PROVISIONAL_MANIFEST_CREATED',manifestId:manifest.manifestId,shippedRegistryChanged:false,actualEvidencePending:true}));
}finally{await c.close();}
