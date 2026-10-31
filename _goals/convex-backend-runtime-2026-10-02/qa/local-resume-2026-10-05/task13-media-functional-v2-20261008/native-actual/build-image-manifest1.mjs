/** Build the private operator candidate from the coherent packed registry. No deployment or inference. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try{
 const packed=JSON.parse(await readFile(join(q,'packages-current1.json'))),backend=packed.sdk.unpackedBackend;
 const source=await readFile(join(backend,'runtimeGatewayQualifications.ts'),'utf8');
 const ts=createRequire(import.meta.url)('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/typescript');
 const ast=ts.createSourceFile('runtimeGatewayQualifications.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 for(const row of ast.statements.filter(ts.isImportDeclaration))assert.equal(row.importClause?.isTypeOnly,true);
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const registry=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
 const original=registry.DEFAULT_GATEWAY_POLICY_MANIFEST,manifest=structuredClone(original),now=Date.now();
 assert.equal(original.revision,9);assert.equal(original.qualifications.length,5);
 assert.ok(original.dispatchEvidence.every(proof=>proof.checkedAt<=now&&now<proof.expiresAt));
 assert.equal(original.qualifications.some(proof=>proof.nativeInterface==='image'),false);
 const operation=c.pointer.operation,receiptId='PROVISIONAL-task13-image-'+operation;
 const contract={scope:'PRIVATE_OPERATOR_COMMISSIONING_NOT_ACTUAL_QUALIFICATION',projectId:c.state.projectId,
  operationKey:'media.image.generate',modelId:'openai/gpt-image-1',nativeInterface:'image',provider:'@convex-dev/ai-sdk-provider@0.2.1',
  fixedPrompt:'A small blue square centered on a plain white background. No text.',n:1,size:'1024x1024',quality:'low',outputFormat:'png',
  maxRetries:0,maximumPromptUtf8Bytes:1024,maximumWireBytes:8192,maximumNativeEncodedResponseBytes:28000000,maximumDecodedResultBytes:20000000,
  ruleId:'media-native-utf8-v1',featureEnvelope:'media-image-v1',priceRevision:'convex-gateway-2026-10-08-image-low',boundRevision:'media-image-1024-low-png-v1',
  nativeDeadlineMs:60000,wholeCallCeilingUnits:2000000,
  identity:'Requested constructor echo only; serving model unobserved unless separate genuine wire metadata exists.',
  pricing:{source:'https://developers.openai.com/api/docs/models/gpt-image-1',fixedLowImageUsd:'0.011',textInputUsdPerMillion:'5',maximumConservativePromptUnits:1024,
   boundedPublishedEnvelopeUsd:'0.01612',conservativeCeilingUsd:'2.00',aggregateCompletenessUnattested:true,unknownCostFullLiability:true},
  qualificationStatus:'PROVISIONAL_FIXED_OPERATOR_ONLY',actualEvidencePending:true,noIndependentAcceptanceClaimed:true,shippedFiveProofsPreserved:true};
 const proofHash=sha(JSON.stringify(contract));
 manifest.manifestId='task13-operator-image-'+operation;manifest.revision=12;manifest.classification='fixture-synthetic';
 manifest.evidenceHash=proofHash;manifest.acceptanceHash=sha('UNREVIEWED_OPERATOR_COMMISSION:'+proofHash);manifest.artifactRevision=sha(await readFile(join(backend,'runtimeModelPolicy.ts')));
 for(const policy of manifest.policies){policy.policyId+='-task13-operator';policy.version=12;
  if(!policy.operationKey){policy.rules.allowedModels=[...new Set([...policy.rules.allowedModels,contract.modelId])];
   policy.rules.interfaces=[...new Set([...policy.rules.interfaces,'image'])];policy.rules.capabilities=[...new Set([...policy.rules.capabilities,'image'])];
   policy.rules.limits.operationBudgetUnits=2000000;policy.rules.limits.runBudgetUnits=2000000;policy.rules.limits.tenantBudgetUnits=10000000;policy.rules.limits.concurrency=2;}}
 const limits={inputTokens:8192,contextTokens:16384,outputTokens:1,toolSteps:0,timeoutMs:60000,operationBudgetUnits:2000000,runBudgetUnits:2000000,tenantBudgetUnits:10000000,concurrency:2};
 manifest.policies.push({policyId:'task13-operator-image',version:12,scope:'deployment',operationKey:contract.operationKey,
  rules:{modelId:contract.modelId,nativeInterface:'image',allowedModels:[contract.modelId],interfaces:['image'],capabilities:['image'],allowedOptions:[],allowedTools:[],fallbackModels:[],limits,
   pins:{priceRevision:contract.priceRevision,boundRevision:contract.boundRevision}}});
 manifest.qualifications.push({receiptId,modelId:contract.modelId,nativeInterface:'image',capabilities:['image'],allowedOptions:[],limits,
  costBound:{kind:'qualified-call-ceiling',maximumCostUnits:2000000,coversAllProviderCharges:true,provenance:'Exact n1/1024x1024/low/png/prompt-only envelope: published0.011USD image plus at most1024 conservative text units at5USD/M totals0.01612USD;2USD conservative ceiling, maxRetries0/no fallback. No aggregate bill completeness assertion.'},
  priceRevision:contract.priceRevision,boundRevision:contract.boundRevision});
 const mediaContract={version:1,options:{kind:'image',n:1,size:'1024x1024',quality:'low',outputFormat:'png'},inputProtocol:'none',maximumInputAssetBytes:0,
  maximumResultBytes:20000000,callbacks:false,terminalIdentity:'requested-only',usage:'optional'};
 manifest.dispatchEvidence.push({receiptId,modelId:contract.modelId,nativeInterface:'image',evidenceHash:proofHash,providerVersion:'0.2.1',priceRevision:contract.priceRevision,boundRevision:contract.boundRevision,
  checkedAt:now-1,expiresAt:now+86400000,terminalCost:'unavailable',terminalProof:'provider-terminal-v1',mediaContract,
  inputBound:{ruleId:contract.ruleId,revision:1,featureEnvelope:contract.featureEnvelope,proofHash,documentHash:sha(JSON.stringify(contract.pricing)),
   nativeTransformHash:sha(await readFile(join(c.host,'node_modules/@ai-sdk/openai-compatible/src/image/openai-compatible-image-model.ts')))},
  resultBound:{maximumPrivateResultBytes:60000,maximumOutputTokens:0,maximumEmbeddingValues:1,proofHash}});
 assert.deepEqual(manifest.qualifications.slice(0,original.qualifications.length),original.qualifications);
 assert.deepEqual(manifest.dispatchEvidence.slice(0,original.dispatchEvidence.length),original.dispatchEvidence);
 await c.publish('image-commissioning-path1',contract);await c.publish('image-commission-only-manifest1',manifest);
 await c.publish('image-commission-lineage1',{scope:contract.scope,manifestId:manifest.manifestId,revision:manifest.revision,
  originalManifestId:original.manifestId,originalRevision:original.revision,originalQualificationObjectsPreserved:5,originalDispatchEvidenceObjectsPreserved:5,
  provisionalReceiptId:receiptId,proofHash,sourceManifestSha256:packed.sdk.manifestSha256,actualEvidencePending:true,shippedRegistryChanged:false,
  noActualOrIndependentAcceptanceFabricated:true,targetEffects:0,priorHeldSlots:2,priorUnknownLiabilityUnits:4500000});
 console.log(JSON.stringify({status:'PROVISIONAL_FIXED_IMAGE_MANIFEST_CREATED',actualEvidencePending:true,targetEffects:0}));
}finally{await c.close();}
