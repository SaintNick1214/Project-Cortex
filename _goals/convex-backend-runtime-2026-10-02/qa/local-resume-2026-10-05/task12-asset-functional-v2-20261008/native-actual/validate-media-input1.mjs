/** Ordinary prepared contract validation. No target, credentials or inference. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {q,root,sha} from './common.mjs';
import {privateFramePng as privateFrame} from './private-frame.mjs';
const ts=await import(pathToFileURL(join(root,'node_modules/typescript/lib/typescript.js'))),directory=join(q,'local-media-input1');await mkdir(directory,{recursive:true});
const sourcePins=[];
for(const name of ['profile','model-policy','media-input']){const path=join(root,'src/domain',name+'.ts'),bytes=await readFile(path);sourcePins.push({path,bytes:bytes.length,sha256:sha(bytes)});await writeFile(join(directory,name+'.js'),ts.transpileModule(bytes.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.ES2022}}).outputText,{flag:'wx'});}
const {resolveModelPolicy,validateModelRequest,canonicalModelJson}=await import(pathToFileURL(join(directory,'model-policy.js'))),{privateFrameVideoInputBound}=await import(pathToFileURL(join(directory,'media-input.js')));
const manifestRaw=await readFile(join(q,'commission-only-manifest1.json')),manifest=JSON.parse(manifestRaw);
const scope={tenantId:'local-operator-validation',memorySpaceId:'local-assets-validation',tenantEpoch:1,memorySpaceEpoch:1,principalId:'local-fixed-operator',principalVersion:1,membershipId:'local-membership',membershipVersion:1,grantId:'local-grant',grantVersion:1},operationKey='media.video.generate';
const snapshot=resolveModelPolicy({context:{scope,operationKey,runBudgetId:'local-commission',authorizedOverrides:[]},policies:manifest.policies.filter(row=>!row.operationKey||row.operationKey===operationKey),qualifications:manifest.qualifications});assert.equal(snapshot.modelId,'google/veo-3.1');assert.equal(snapshot.nativeInterface,'video');assert.equal(snapshot.costBound.maximumCostUnits,2000000);assert.equal(snapshot.limits.operationBudgetUnits,2000000);assert.equal(snapshot.limits.runBudgetUnits,2000000);assert.equal(snapshot.limits.tenantBudgetUnits,10000000);assert.equal(snapshot.limits.concurrency,2);
const frame=privateFrame(),prompt='Animate a gentle slow drift in this solid blue frame. Keep the image simple. No text or audio.';
assert.equal(frame.length,1496);const body={model:snapshot.modelId,prompt,resolution:'720p',duration:4,generate_audio:false,frame_images:[{type:'image_url',image_url:{url:'data:image/png;base64,'+frame.toString('base64')},frame_type:'first_frame'}]},wire=canonicalModelJson(body),inputTokens=privateFrameVideoInputBound(wire,snapshot.modelId);
const request={semanticId:'fixed-local-commission',childCallId:'fixed-child',texts:[wire],messages:[{role:'user',parts:[{type:'text',text:wire}]}],inputTokens,outputTokens:0,toolSteps:0,timeoutMs:60000,reservationUnits:2000000,promptVersion:snapshot.pins.promptVersion,schemaVersion:snapshot.pins.schemaVersion,extractionVersion:snapshot.pins.extractionVersion,toolRegistryVersion:snapshot.pins.toolRegistryVersion,tools:[],options:{maxRetries:0}};
validateModelRequest(snapshot,request);assert.equal(inputTokens,Buffer.byteLength(wire));assert.ok(inputTokens<=8192);
assert.throws(()=>privateFrameVideoInputBound(canonicalModelJson({...body,generate_audio:true}),snapshot.modelId),/POLICY_DENIED/);assert.throws(()=>privateFrameVideoInputBound(canonicalModelJson({...body,n:2}),snapshot.modelId),/POLICY_DENIED/);
await writeFile(join(q,'media-prepared-input-validation1.json'),JSON.stringify({status:'PASS',effects:false,manifestSha256:sha(manifestRaw),sourcePins,frameBytes:frame.length,frameSha256:sha(frame),nativeBodyBytes:inputTokens,nativeBodySha256:sha(wire),scope:'PROVISIONAL_FIXED_OPERATOR_NOT_ACTUAL_QUALIFICATION',selected:snapshot},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'LOCAL_PREPARED_CONTRACT_PASS',nativeBodyBytes:inputTokens,effects:false}));
