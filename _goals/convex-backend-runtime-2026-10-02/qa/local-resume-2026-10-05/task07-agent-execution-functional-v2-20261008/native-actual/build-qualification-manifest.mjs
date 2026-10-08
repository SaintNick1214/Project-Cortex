/** Local design construction only. This never installs or mutates a service. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {q,root,sha} from './common.mjs';
const operation=process.argv[2]??randomUUID();assert.match(operation,/^[a-f0-9-]{36}$/);
const raw=await readFile(join(root,'convex-dev/runtimeGatewayQualifications.ts'),'utf8');
const start=raw.indexOf('= {');const end=raw.lastIndexOf('} as const satisfies');assert.ok(start>=0&&end>start);
const original=JSON.parse(raw.slice(start+2,end+1));assert.equal(original.classification,'reviewed-actual');
const manifest=structuredClone(original);const now=Date.now();
const domainRaw=await readFile(join(root,'src/domain/agent-tools.ts'),'utf8');
// TypeScript is used only to load the exact side-effect-free fixed registry. No model/provider constructor.
const ts=(await import(pathToFileURL(join(root,'node_modules/typescript/lib/typescript.js')))).default;
const emitted=ts.transpileModule(domainRaw,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.ESNext}}).outputText;
const {AGENT_NATIVE_TOOLS,AGENT_TOOL_REGISTRY_VERSION}=await import('data:text/javascript;base64,'+Buffer.from(emitted).toString('base64'));
const encodeModule=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const profileModule=encodeModule(await readFile(join(root,'src/domain/profile.ts'),'utf8'));
const {DEFAULT_EMBEDDING_PROFILE}=await import(profileModule);
const policySource=(await readFile(join(root,'src/domain/model-policy.ts'),'utf8')).replace('from "zod"','from '+JSON.stringify(pathToFileURL(join(root,'node_modules/zod/index.js')).href)).replace('from "./profile.js"','from '+JSON.stringify(profileModule));
const {canonicalModelJson:canonical,resolveModelPolicy}=await import(encodeModule(policySource));
const toolsCanonical=canonical(AGENT_NATIVE_TOOLS);const nativeNames=AGENT_NATIVE_TOOLS.map(tool=>tool.name);
assert.deepEqual(nativeNames,['memory_recall','memory_remember']);
const boundRevision='agent-tools-32768-512-v1',priceRevision='openrouter-2026-10-08-candidate';
const limits={inputTokens:32768,contextTokens:65536,outputTokens:512,toolSteps:4,timeoutMs:60000,
  operationBudgetUnits:200000,runBudgetUnits:2000000,tenantBudgetUnits:10000000,concurrency:2};
const contract={scope:'PROVISIONAL_FIXED_OPERATOR_QUALIFICATION_ONLY_NOT_ACTUAL_ACCEPTANCE',checkedAt:new Date(now).toISOString(),
  operation,modelId:'openai/gpt-4o-mini',nativeInterface:'chat',featureEnvelope:'agent-tools-chat-v1',registryVersion:AGENT_TOOL_REGISTRY_VERSION,
  sourceUrls:['https://docs.convex.dev/ai-gateway/api','https://docs.convex.dev/ai-gateway/usage-and-billing','https://openrouter.ai/openai/gpt-4o-mini'],
  observedPrimaryFacts:{standardInputUsdPerMillion:'0.15',standardOutputUsdPerMillion:'0.60',highestDisplayedInputUsdPerMillion:'0.165',highestDisplayedOutputUsdPerMillion:'0.66',
    ordinaryChatToolsAndStreamForwarded:true,invoiceCurrency:'USD',providerRoutingControlledByConvex:true},
  conservativePublishedEnvelopeMicroUsd:5746,qualifiedCeilingMicroUsd:100000,
  ceilingBasis:'32768 input *0.165 USD/M +512 output *0.66 USD/M =0.00574464 USD; ceiling0.10 USD >17x; only fixed text/function tools, no search/audio/image/reasoning/provider options; overrun fence and one-day expiry remain',
  terminalCost:'unavailable',aggregateCompletenessClaim:false,unknownCostRetention:'full100000 operation/run/tenant liability, no settlement discount, no paid retry/fallback',
  inputRule:'6*full canonical messages/tools/choice UTF8bytes +64*(messageCount+toolCount)+1024; native terminal observed usage must not exceed admitted bound',
  limits,toolsCanonical,productionRegistryChanged:false,actualEvidenceStillRequired:true};
const proofHash=sha(canonical(contract));
manifest.manifestId='task07-operator-qualification-'+operation;manifest.revision=original.revision+1;
manifest.classification='fixture-synthetic';manifest.evidenceHash=proofHash;manifest.acceptanceHash=sha('UNREVIEWED_OPERATOR_QUALIFICATION:'+proofHash);
manifest.artifactRevision=sha(await readFile(join(root,'convex-dev/runtimeGateway.ts')));
for(const policy of manifest.policies){policy.policyId+='-task07-fixture-'+operation;policy.version=manifest.revision;
  if(!policy.operationKey){policy.rules.capabilities=[...new Set([...policy.rules.capabilities,'tools'])];policy.rules.allowedTools=nativeNames;
    policy.rules.limits={...policy.rules.limits,inputTokens:32768,contextTokens:65536,toolSteps:4};}}
manifest.policies.push({policyId:'task07-agent-'+operation,version:manifest.revision,scope:'deployment',operationKey:'agent.respond',
  rules:{modelId:'openai/gpt-4o-mini',nativeInterface:'chat',pins:{boundRevision,toolRegistryVersion:AGENT_TOOL_REGISTRY_VERSION}}});
const receiptId='PROVISIONAL-task07-agent-'+operation;
manifest.qualifications.push({receiptId,modelId:'openai/gpt-4o-mini',nativeInterface:'chat',capabilities:['text','tools'],allowedOptions:[],limits,
  costBound:{kind:'qualified-call-ceiling',maximumCostUnits:100000,coversAllProviderCharges:true,
    provenance:'Operator qualification-only envelope; fixed text/native memory tools32768/512 at published highest displayed0.165/0.66USD/M, cap5746microUSD, retained100000 ceiling; no enabled extra modality/provider options'},priceRevision,boundRevision});
manifest.dispatchEvidence.push({receiptId,modelId:'openai/gpt-4o-mini',nativeInterface:'chat',evidenceHash:proofHash,providerVersion:'0.2.1',priceRevision,boundRevision,
  checkedAt:now-1,expiresAt:now+86400000,terminalCost:'unavailable',terminalProof:'provider-terminal-v1',supportsStream:true,
  toolContract:{registryVersion:AGENT_TOOL_REGISTRY_VERSION,toolsCanonical,maximumToolCalls:4},
  inputBound:{ruleId:'agent-tools-chat-utf8-v1',revision:1,featureEnvelope:'agent-tools-chat-v1',proofHash,documentHash:proofHash,
    nativeTransformHash:sha(await readFile(join(root,'node_modules/@convex-dev/ai-sdk-provider/src/index.ts')))},
  resultBound:{maximumPrivateResultBytes:60000,maximumOutputTokens:512,maximumEmbeddingValues:1,proofHash}});
assert.deepEqual(manifest.qualifications.slice(0,original.qualifications.length),original.qualifications);
assert.deepEqual(manifest.dispatchEvidence.slice(0,original.dispatchEvidence.length),original.dispatchEvidence);
const designScope={tenantId:'operator-qualification-design',memorySpaceId:'operator-qualification-design',principalId:'operator-qualification-design',
  principalVersion:1,membershipId:'operator-qualification-design',membershipVersion:1,grantId:'operator-qualification-design',grantVersion:1,tenantEpoch:1,memorySpaceEpoch:1};
const resolutions=[];
for(const operationKey of ['agent.respond','memory.extract','embedding.query','conversation.title']){
  const resolved=resolveModelPolicy({context:{scope:designScope,operationKey,runBudgetId:'qualification-design',authorizedOverrides:[],
    ...(operationKey.startsWith('embedding.')?{semanticProfile:DEFAULT_EMBEDDING_PROFILE}:{})},
    policies:manifest.policies.filter(policy=>!policy.operationKey||policy.operationKey===operationKey),qualifications:manifest.qualifications});
  assert.equal(resolved.pins.boundRevision,operationKey==='agent.respond'?boundRevision:original.policies[0].rules.pins.boundRevision);
  assert.equal(resolved.limits.inputTokens,operationKey==='agent.respond'?32768:8192);
  resolutions.push({operationKey,modelId:resolved.modelId,nativeInterface:resolved.nativeInterface,boundRevision:resolved.pins.boundRevision,
    inputTokens:resolved.limits.inputTokens,allowedTools:resolved.allowedTools,capabilities:resolved.capabilities});
}
await writeFile(join(q,'qualification-price-contract.json'),JSON.stringify(contract,null,2)+'\n');
await writeFile(join(q,'qualification-only-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(q,'qualification-only-manifest-lineage.json'),JSON.stringify({operation,classification:'fixture-synthetic',originalManifestId:original.manifestId,
  originalRevision:original.revision,oldSourceSha256:sha(raw),fixedRegistrySha256:sha(domainRaw),oldQualificationsPreserved:original.qualifications.length,
  oldDispatchReceiptsPreserved:original.dispatchEvidence.length,newReceiptId:receiptId,newBound:boundRevision,
  evidenceIsAuthorDesignOnly:true,actualQualificationPending:true,noInventedIndependentAcceptance:true,noServiceEffects:true},null,2)+'\n');
await writeFile(join(q,'qualification-policy-design-resolutions.json'),JSON.stringify({operation,scope:'PURE_REAL_RESOLVER_DESIGN_ONLY_NO_NATIVE_AUTHORITY',resolutions},null,2)+'\n');
console.log(JSON.stringify({operation,manifestId:manifest.manifestId,revision:manifest.revision,classification:manifest.classification,oldQualifications:original.qualifications.length,newQualification:receiptId,protectedEffects:0}));
