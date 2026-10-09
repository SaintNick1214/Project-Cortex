/** Local prospective recipe only. This file never opens a client or dispatches. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {canonicalModelJson,resolveModelPolicy,validateModelRequest,mediaInputBound} from './local-image-input2.mjs';

const q=dirname(new URL(import.meta.url).pathname);
const sha=value=>createHash('sha256').update(value).digest('hex');
const read=name=>readFile(join(q,name));
const json=async name=>JSON.parse(await read(name));
const publish=async(name,value)=>writeFile(join(q,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const packed=await json('packages-current3.json');
const backend=packed.sdk.unpackedBackend;
const ts=createRequire(import.meta.url)('/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/node_modules/typescript');
async function pureModule(path){
 const raw=await readFile(path,'utf8');
 const source=ts.createSourceFile(path,raw,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 for(const statement of source.statements.filter(ts.isImportDeclaration))assert.equal(statement.importClause?.isTypeOnly,true);
 const emitted=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 return await import('data:text/javascript;base64,'+Buffer.from(emitted).toString('base64'));
}
const registry=await pureModule(join(backend,'runtimeGatewayQualifications.ts'));
const toolsModule=await pureModule(join(backend,'_cortex/shared/domain/agent_tools.ts'));
const original=registry.DEFAULT_GATEWAY_POLICY_MANIFEST;
assert.equal(original.revision,9);assert.equal(original.qualifications.length,5);
const now=Date.now();
assert.ok(original.dispatchEvidence.every(value=>value.checkedAt<=now&&now<value.expiresAt));
const tools=structuredClone(toolsModule.AGENT_NATIVE_TOOLS_V2);
assert.equal(tools.length,5);assert.equal(toolsModule.AGENT_TOOL_REGISTRY_VERSION_V2,'cortex-media-tools-v2');
assert.deepEqual(tools.slice(0,2),toolsModule.AGENT_NATIVE_TOOLS);
const imageRecordRaw=await read('actual-image-qualification-record1.json');
const imageRecord=JSON.parse(imageRecordRaw),imageRecordHash=sha(imageRecordRaw);
assert.equal(imageRecord.status,'ACTUAL_IMAGE_QUALIFICATION_OBSERVATION');
assert.equal(imageRecord.nativeHttpStatus,200);assert.equal(imageRecord.issuedCount,1);
assert.equal(imageRecord.terminalIdentity,'requested-only');assert.equal(imageRecord.aggregateCostUnavailable,true);
const formerImage=await json('image-commission-only-manifest1.json');
const imageQualification=structuredClone(formerImage.qualifications.find(value=>value.nativeInterface==='image'));
const imageProof=structuredClone(formerImage.dispatchEvidence.find(value=>value.nativeInterface==='image'));
const operation='task13-agent-media-v2-3c1dcff16463';
const contract={version:1,status:'LOCAL_OPERATOR_RECIPE_NOT_DISPATCH_READY',
 target:{projectId:3174742,teamId:325340,deploymentName:'formal-husky-914',production:false},
 activationRequires:'Fresh verified target/current authority and coherent03+V2 installed source release; local recipe is not activation authority.',
 trust:'Exact private operator-only fixture-synthetic manifest; no fabricated prior actual V2 or independent acceptance.',
 newScopeOnly:true,oldAccountsRootWindowsAndLiabilityUntouched:true,
 agent:{modelId:'openai/gpt-4o-mini',nativeInterface:'chat',featureEnvelope:'agent-tools-chat-v2',ruleId:'agent-tools-chat-utf8-v1',
  toolRegistryVersion:'cortex-media-tools-v2',tools,streaming:true,maximumToolEffects:1,
  inputTokens:32768,contextTokens:65536,outputTokens:256,timeoutMs:60000,maxRetries:0,perCallCeilingUnits:100000,
  priceRevision:'openrouter-2026-10-08-candidate',boundRevision:'agent-tools-v2-32768-256-shared3m-v1',
  noServingOrCostGuarantee:true,actualNativeV2EvidencePending:true},
 image:{modelId:'openai/gpt-image-1',nativeInterface:'image',featureEnvelope:'media-image-v1',ruleId:'media-native-utf8-v1',
  n:1,size:'1024x1024',quality:'low',outputFormat:'png',maxRetries:0,perCallCeilingUnits:2000000,runBudgetUnits:3000000,
  priceRevision:formerImage.qualifications.find(value=>value.nativeInterface==='image').priceRevision,boundRevision:'media-image-1024-low-png-shared3m-v1',
  actualRecordPath:join(q,'actual-image-qualification-record1.json'),actualRecordHash:imageRecordHash,
  identity:'requested-only; no observed serving model',aggregateCost:'unavailable; full ceiling retained'},
 commonBudget:{runBudgetUnits:3000000,tenantBudgetUnits:10000000,concurrency:2},
 expectedSharedRun:{contextEmbedding:100000,firstModel:100000,image:2000000,finalModel:100000,total:2300000,
  notAnActualCallCountOrOutputGuarantee:true},
 asyncVideo:'No qualification; existing503 never resubmitted',
 terminalReplay:'Only confirmed matching bounded terminal; uncertain cost retains full liability. Lost/ambiguous calls never paid-readmitted.',
 privateImageBytes:'Product asset storage only; ledger/transcript store bounded immutable references, not bytes.',
 sourceApplicability:{packedManifestSha256:packed.sdk.manifestSha256,upcoming03V2NotIncluded:true,mustRebindBeforeActivation:true},
 noServiceCalls:true,noPaidCalls:true,noRootSwitch:true};
const proofHash=sha(canonicalModelJson(contract));
const manifest=structuredClone(original);
manifest.manifestId=operation;manifest.revision=13;manifest.classification='fixture-synthetic';
manifest.evidenceHash=proofHash;manifest.acceptanceHash=sha('UNREVIEWED_PRIVATE_OPERATOR_RECIPE:'+proofHash);
manifest.artifactRevision=sha(await readFile(join(backend,'runtimeModelPolicy.ts')));
for(const policy of manifest.policies){
 policy.policyId+='-agent-media-v2';policy.version=13;
 if(!policy.operationKey){
  policy.rules.allowedModels=[...new Set([...policy.rules.allowedModels,'openai/gpt-image-1'])];
  policy.rules.interfaces=[...new Set([...policy.rules.interfaces,'image'])];
  policy.rules.capabilities=[...new Set([...policy.rules.capabilities,'image'])];
  policy.rules.allowedTools=tools.map(value=>value.name);
  policy.rules.limits.operationBudgetUnits=2000000;policy.rules.limits.runBudgetUnits=3000000;
  policy.rules.limits.tenantBudgetUnits=10000000;policy.rules.limits.concurrency=2;
 }
 if(policy.operationKey==='agent.respond'){
  policy.rules.pins={...policy.rules.pins,boundRevision:contract.agent.boundRevision,toolRegistryVersion:contract.agent.toolRegistryVersion};
  policy.rules.limits={inputTokens:32768,contextTokens:65536,outputTokens:256,toolSteps:1,timeoutMs:60000,
   operationBudgetUnits:100000,runBudgetUnits:3000000,tenantBudgetUnits:10000000,concurrency:2};
 }
}
const chatQualification=structuredClone(original.qualifications.find(value=>value.boundRevision==='agent-tools-32768-512-v1'));
const chatProof=structuredClone(original.dispatchEvidence.find(value=>value.boundRevision==='agent-tools-32768-512-v1'));
chatQualification.receiptId='PROVISIONAL-'+operation;
chatQualification.boundRevision=contract.agent.boundRevision;
chatQualification.limits={...manifest.policies.find(value=>value.operationKey==='agent.respond').rules.limits};
chatQualification.costBound.provenance='Private prospective V2 five-tool mini envelope;32768 conservative input/output256,100000 full-call ceiling,maxRetries0. Actual native V2 evidence pending; no aggregate-cost attestation.';
chatProof.receiptId=chatQualification.receiptId;chatProof.boundRevision=chatQualification.boundRevision;
chatProof.evidenceHash=proofHash;chatProof.checkedAt=now-1;chatProof.expiresAt=Math.min(...original.dispatchEvidence.map(value=>value.expiresAt));
chatProof.supportsStream=true;
chatProof.toolContract={registryVersion:contract.agent.toolRegistryVersion,toolsCanonical:canonicalModelJson(tools),maximumToolCalls:1};
chatProof.inputBound={...chatProof.inputBound,featureEnvelope:'agent-tools-chat-v2',proofHash,documentHash:sha(canonicalModelJson(contract.agent))};
chatProof.resultBound={...chatProof.resultBound,maximumOutputTokens:256,proofHash};
imageQualification.receiptId='OBSERVED-task13-image-shared3m-'+operation;
imageQualification.boundRevision=contract.image.boundRevision;
imageQualification.limits.runBudgetUnits=3000000;
imageQualification.costBound.provenance='Genuine image record '+imageRecordHash+';n1/1024low/png;serving requested-only;2m full liability,no aggregate-cost attestation;prospective shared run3m.';
imageProof.receiptId=imageQualification.receiptId;imageProof.boundRevision=imageQualification.boundRevision;imageProof.evidenceHash=imageRecordHash;
imageProof.checkedAt=imageRecord.reservationBeforeDispatch.issuedAt;
imageProof.expiresAt=Math.min(imageProof.expiresAt,chatProof.expiresAt);
imageProof.inputBound.proofHash=imageRecordHash;imageProof.resultBound.proofHash=imageRecordHash;
manifest.policies.push({policyId:'task13-agent-image-shared3m',version:13,scope:'deployment',operationKey:'media.image.generate',
 rules:{modelId:'openai/gpt-image-1',nativeInterface:'image',allowedModels:['openai/gpt-image-1'],interfaces:['image'],capabilities:['image'],
  allowedOptions:[],allowedTools:[],fallbackModels:[],limits:imageQualification.limits,
  pins:{priceRevision:imageQualification.priceRevision,boundRevision:imageQualification.boundRevision}}});
manifest.qualifications.push(chatQualification,imageQualification);manifest.dispatchEvidence.push(chatProof,imageProof);
assert.deepEqual(manifest.qualifications.slice(0,5),original.qualifications);
assert.deepEqual(manifest.dispatchEvidence.slice(0,5),original.dispatchEvidence);
assert.equal(manifest.qualifications.filter(value=>value.nativeInterface==='video').length,0);
const registryV2={version:2,tools:{'memory.remember':1,'memory.recall':1,'media.image.generate':1,'media.video.generate':1,'artifact.read':1},contexts:{'cortex.transcript':1}};
const registryHash=sha(canonicalModelJson(registryV2));
const instructions='Create exactly one image with media_image_generate when requested. Use the prompt supplied by the user. After the tool returns, answer briefly with its durable media job and artifact references. Execute one tool effect in this run.';
const userPrompt='Create an image of a small blue circle centered on a plain white background, with no text. Use media_image_generate once, then tell me the durable job and artifact references.';
const definition={instructions:{text:instructions,promptVersion:'task13-agent-media-v2-prompt1'},
 tools:Object.keys(registryV2.tools).map(toolId=>({toolId,toolVersion:1,registryHash,requiredCapability:'tool',approval:'none'})),
 context:{handlerId:'cortex.transcript',handlerVersion:1,registryHash,memoryMode:'indexed-plus-pending',requiredStages:[],maxContextTokens:4096},
 policies:[{policyId:'task13-agent-media-v2-small',version:1,operationKey:'agent.respond',rules:{limits:{outputTokens:256,toolSteps:1}}}]};
const scope={tenantId:'prospective-task13-agent-media-v2',tenantEpoch:1,memorySpaceId:'prospective-media-v2',memorySpaceEpoch:1,
 principalId:'LOCAL_NOT_PROVISIONED',principalVersion:1,membershipId:'LOCAL_NOT_PROVISIONED',membershipVersion:1,grantId:'LOCAL_NOT_PROVISIONED',grantVersion:1};
const context=operationKey=>({scope,operationKey,runBudgetId:'LOCAL_SHARED_3M_NOT_ADMITTED',authorizedOverrides:[]});
const snapshots={};
for(const operationKey of ['agent.respond','media.image.generate','embedding.query']){
 snapshots[operationKey]=resolveModelPolicy({context:context(operationKey),
  policies:manifest.policies.filter(value=>!value.operationKey||value.operationKey===operationKey),qualifications:manifest.qualifications});
}
assert.equal(snapshots['agent.respond'].limits.runBudgetUnits,3000000);
assert.equal(snapshots['media.image.generate'].limits.runBudgetUnits,3000000);
assert.equal(snapshots['embedding.query'].limits.runBudgetUnits,2000000);
assert.equal(snapshots['media.image.generate'].costBound.maximumCostUnits,2000000);
assert.deepEqual(snapshots['agent.respond'].allowedTools,tools.map(value=>value.name));
const messages=[{role:'system',parts:[{type:'text',text:instructions}]},{role:'user',parts:[{type:'text',text:userPrompt}]}];
const requestTools=tools.map(value=>({name:value.name,definition:{description:value.description,inputSchema:value.inputSchema}}));
const toolChoice={type:'auto'};
const inputTokens=toolsModule.agentToolsInputBoundV2(canonicalModelJson({messages,tools:requestTools,toolChoice}),messages.length,requestTools.length);
const snapshot=snapshots['agent.respond'];
validateModelRequest(snapshot,{semanticId:'LOCAL_ONLY_MODEL0',childCallId:'LOCAL_ONLY_MODEL0',texts:messages.flatMap(value=>value.parts.map(part=>part.text)),messages,
 inputTokens,outputTokens:256,toolSteps:1,timeoutMs:60000,reservationUnits:100000,
 promptVersion:snapshot.pins.promptVersion,schemaVersion:snapshot.pins.schemaVersion,extractionVersion:snapshot.pins.extractionVersion,
 toolRegistryVersion:snapshot.pins.toolRegistryVersion,tools:requestTools,toolChoice,options:{maxRetries:0}});
const media={version:1,prompt:'A small blue circle centered on a plain white background. No text.',options:imageProof.mediaContract.options};
const imageBound=mediaInputBound(media,imageProof.mediaContract,'openai/gpt-image-1');
const imageSnapshot=snapshots['media.image.generate'];
validateModelRequest(imageSnapshot,{semanticId:'LOCAL_ONLY_IMAGE',childCallId:'LOCAL_ONLY_IMAGE',texts:[media.prompt],messages:[{role:'user',parts:[{type:'text',text:media.prompt}]}],
 inputTokens:imageBound,outputTokens:0,toolSteps:0,timeoutMs:60000,reservationUnits:2000000,promptVersion:imageSnapshot.pins.promptVersion,
 schemaVersion:imageSnapshot.pins.schemaVersion,extractionVersion:imageSnapshot.pins.extractionVersion,toolRegistryVersion:imageSnapshot.pins.toolRegistryVersion,
 tools:[],options:{maxRetries:0},media});
await publish('agent-media-local-contract2',contract);
await publish('agent-media-local-manifest2',manifest);
await publish('agent-media-local-definition2',{status:'LOCAL_ONLY_NOT_PUBLISHED',definition,userPrompt,registryV2,registryHash});
await publish('agent-media-local-validation2',{status:'LOCAL_CONTRACT_PARSE_PASS_NOT_NATIVE_QUALIFICATION',newServiceCalls:0,newPaidCalls:0,newRootSwitches:0,
 sourceManifestSha256:packed.sdk.manifestSha256,mustRebindToCoherentSource:true,allFiveOldQualificationAndEvidenceObjectsPreserved:true,
 newV2AgentEvidence:'PROVISIONAL_NOT_ACTUAL',imageEvidenceHash:imageRecordHash,
 initialSampleInputBound:inputTokens,imageSampleInputBound:imageBound,actualNativePromptMayDiffer:true,
 resolved:{agent:snapshot,image:imageSnapshot,query:snapshots['embedding.query']},commonRunPlanned2300000:true,
 nativeV2InitialAndFinalStreamsPending:true,installedV2TerminalParityRepairPending:true,expiredSdkHandshakeRepairPending:true,artifactReadWitnessRepairPending:true});
console.log(JSON.stringify({status:'LOCAL_CONTRACT_PARSE_PASS_NOT_NATIVE_QUALIFICATION',tools:tools.length,sampleInputBound:inputTokens,
 imageSampleInputBound:imageBound,runBudgetUnits:3000000,newServiceCalls:0,newPaidCalls:0,newRootSwitches:0}));
