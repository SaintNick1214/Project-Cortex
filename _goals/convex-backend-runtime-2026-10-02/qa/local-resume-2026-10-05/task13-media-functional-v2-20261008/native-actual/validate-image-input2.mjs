/** Ordinary exact-domain preparation check. No target effect, model call or trust promotion. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {q,root,sha} from './common.mjs';
const {build}=await import(pathToFileURL(join(root,'node_modules/esbuild/lib/main.js')));
const output=join(q,'local-image-input2.mjs');
await build({stdin:{contents:'export * from "./src/domain/model-policy.ts";export * from "./src/domain/media-jobs.ts";',resolveDir:root,sourcefile:'task13-exact-domain.ts'},outfile:output,bundle:true,platform:'node',format:'esm',external:['zod'],logLevel:'silent'});
const domain=await import(pathToFileURL(output)),raw=await readFile(join(q,'image-commission-only-manifest1.json')),manifest=JSON.parse(raw);
const scope={tenantId:'local-task13',memorySpaceId:'local-media',tenantEpoch:1,memorySpaceEpoch:1,principalId:'local-fixed-operator',principalVersion:1,membershipId:'local-membership',membershipVersion:1,grantId:'local-grant',grantVersion:1};
const operationKey='media.image.generate';
const snapshot=domain.resolveModelPolicy({context:{scope,operationKey,runBudgetId:'local-image-commission',authorizedOverrides:[]},policies:manifest.policies.filter(row=>!row.operationKey||row.operationKey===operationKey),qualifications:manifest.qualifications});
assert.equal(snapshot.modelId,'openai/gpt-image-1');assert.equal(snapshot.nativeInterface,'image');assert.equal(snapshot.costBound.maximumCostUnits,2000000);assert.equal(snapshot.limits.timeoutMs,60000);assert.equal(snapshot.limits.concurrency,2);
const proof=manifest.dispatchEvidence.find(row=>row.nativeInterface==='image');assert.ok(proof);
const envelope={version:1,prompt:'A small blue square centered on a plain white background. No text.',options:{kind:'image',n:1,size:'1024x1024',quality:'low',outputFormat:'png'}};
domain.mediaEnvelopeSchema.parse(envelope);
const inputTokens=domain.mediaInputBound(envelope,proof.mediaContract,snapshot.modelId),wire=domain.canonicalModelJson(domain.mediaWireBody(envelope,snapshot.modelId));
const request={semanticId:'fixed-local-image-commission',childCallId:'fixed-local-image-commission',texts:[envelope.prompt],messages:[{role:'user',parts:[{type:'text',text:envelope.prompt}]}],inputTokens,outputTokens:0,toolSteps:0,timeoutMs:60000,reservationUnits:2000000,promptVersion:snapshot.pins.promptVersion,schemaVersion:snapshot.pins.schemaVersion,extractionVersion:snapshot.pins.extractionVersion,toolRegistryVersion:snapshot.pins.toolRegistryVersion,tools:[],options:{maxRetries:0},media:envelope};
domain.validateModelRequest(snapshot,request);assert.ok(inputTokens<=8192);assert.ok(Buffer.byteLength(wire)<=8192);
assert.throws(()=>domain.mediaInputBound({...envelope,options:{...envelope.options,n:2}},proof.mediaContract,snapshot.modelId));
assert.throws(()=>domain.mediaInputBound({...envelope,prompt:'x'.repeat(1025)},proof.mediaContract,snapshot.modelId));
const sources=[];for(const path of ['src/domain/model-policy.ts','src/domain/media-jobs.ts']){const value=await readFile(join(root,path));sources.push({path,sha256:sha(value),bytes:value.length});}
await writeFile(join(q,'image-prepared-input-validation2.json'),JSON.stringify({status:'PASS',effects:0,manifestSha256:sha(raw),sourcePins:sources,selected:snapshot,inputBound:inputTokens,nativeBodyBytes:Buffer.byteLength(wire),nativeBodyHash:sha(wire),qualification:'PROVISIONAL_FIXED_OPERATOR_NOT_ACTUAL'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'LOCAL_PREPARED_IMAGE_CONTRACT_PASS',inputBound:inputTokens,nativeBodyBytes:Buffer.byteLength(wire),effects:0}));
