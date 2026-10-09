/** Parent-authorized exact disposable new-scope delay/commission fixture. No public override or invocation. */
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('agent-media-overlay1-target-verified');
 const prior=JSON.parse(await readFile(join(q,'installed-current4-source-manifest.json'))),prepared=JSON.parse(await readFile(join(q,'agent-media-local-validation3.json')));
 assert.equal(prepared.status,'LOCAL_CONTRACT_PARSE_PASS_NOT_NATIVE_QUALIFICATION');assert.equal(prepared.sourceManifestSha256,prior.packed.sdk.manifestSha256);
 const functions=join(c.host,c.functionsDirectory);
 for(const row of prior.files){const overlay=prior.QAOverlay.find(value=>value.path===row.path);assert.equal(sha(await readFile(join(functions,row.path))),overlay?.sha256??row.sha256);}
 for(const row of prior.QAOverlay)assert.equal(sha(await readFile(join(functions,row.path))),row.sha256);
 const names=['task13AgentDelay.ts','task13AgentDelaySchema.ts','task13AgentMediaQualificationManifest.ts'];
 for(const name of names){let exists=true;try{await access(join(functions,name));}catch(error){if(error.code==='ENOENT')exists=false;else throw error;}assert.equal(exists,false,'Unexpected fixture collision '+name);}
 const runs=await readFile(join(functions,'runs.ts'),'utf8'),schema=await readFile(join(functions,'schema.ts'),'utf8'),bootstrap=await readFile(join(functions,'runtimeModelPolicyBootstrap.ts'),'utf8');
 assert.equal(sha(runs),prior.files.find(row=>row.path==='runs.ts').sha256);
 const registration='export const submit = mutation({ args: { request: v.any(), tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) }, handler: submitHandler });';
 assert.equal(runs.split(registration).length,2);
 const modifiedRuns='import {withTask13HeldSubmit} from "./task13AgentDelay";\n'+runs.replace(registration,
  registration.replace('handler: submitHandler','handler: async (ctx, args) => await withTask13HeldSubmit(ctx, args, submitHandler)'));
 const modifiedSchema='import {task13HeldIngestionTable} from "./task13AgentDelaySchema";\n'+schema.replace('...cortexTablesV1,','...cortexTablesV1,task13HeldIngestion:task13HeldIngestionTable,');
 assert.notEqual(modifiedSchema,schema);assert.equal(modifiedSchema.split('task13HeldIngestion:').length,2);
 let modifiedBootstrap='import {agentMediaFixtureManifest} from "./task13AgentMediaQualificationManifest";\n'+bootstrap;
 assert.equal(bootstrap.split('imageFixtureManifest]);').length,2);
 modifiedBootstrap=modifiedBootstrap.replace('imageFixtureManifest]);','imageFixtureManifest, agentMediaFixtureManifest]);');
 assert.equal(bootstrap.split('manifest === imageFixtureManifest)').length,2);
 modifiedBootstrap=modifiedBootstrap.replace('manifest === imageFixtureManifest)','manifest === imageFixtureManifest || manifest === agentMediaFixtureManifest)');
 const manifest=JSON.parse(await readFile(join(q,'agent-media-local-manifest3.json')));
 assert.equal(manifest.classification,'fixture-synthetic');assert.equal(manifest.revision,13);assert.equal(manifest.qualifications.length,7);
 const module='import type {DeploymentPolicyManifest} from "./runtimeModelPolicyBootstrap";\n// Exact private operator recipe, PROVISIONAL V2; no actual or independent acceptance fabricated.\nexport const agentMediaFixtureManifest='+JSON.stringify(manifest)+' as const satisfies DeploymentPolicyManifest;\n';
 const delay=await readFile(join(q,'task13AgentDelay.fixture.ts')),delaySchema=await readFile(join(q,'task13AgentDelaySchema.fixture.ts'));
 await c.publish('agent-media-overlay1-preimage',{priorSourceManifest:join(q,'installed-current4-source-manifest.json'),manifestSha256:prepared.sourceManifestSha256,
  sourcePreimages:[{path:'runs.ts',sha256:sha(runs),source:runs},{path:'schema.ts',sha256:sha(schema),source:schema},{path:'runtimeModelPolicyBootstrap.ts',sha256:sha(bootstrap),source:bootstrap}],
  exactNewScope:{tenantId:'task13-agent-media-v2-3c1dcff16463',memorySpaceId:'agent-media-v2-3c1dcff16463'},publicValidatorsUnchanged:true,canonicalSubmitHandlerUnchanged:true,
  initialExtractOnly:true,holdBeforeClaim:true,maximumHoldMs:300000,oneIssuedRealStageRelease:true,noPublicFaultFlag:true,otherSourceFilesUnchanged:true,
  fixtureSyntheticManifest:manifest.manifestId,proofPromotion:false,rootActivationPending:true,modelCalls:0});
 for(const [name,bytes] of [['task13AgentDelay.ts',delay],['task13AgentDelaySchema.ts',delaySchema],['task13AgentMediaQualificationManifest.ts',module]])await writeFile(join(functions,name),bytes,{flag:'wx'});
 for(const [name,bytes] of [['runs.ts',modifiedRuns],['schema.ts',modifiedSchema],['runtimeModelPolicyBootstrap.ts',modifiedBootstrap]])await writeFile(join(functions,name),bytes);
 const overlay=prior.QAOverlay.filter(row=>!['schema.ts','runtimeModelPolicyBootstrap.ts'].includes(row.path));
 for(const path of ['runs.ts','schema.ts','runtimeModelPolicyBootstrap.ts',...names]){const bytes=await readFile(join(functions,path));overlay.push({path,bytes:bytes.length,sha256:sha(bytes),QAOnly:true});}
 for(const row of prior.preserved.filter(row=>!row.path.endsWith('/schema.ts')))assert.equal(sha(await readFile(join(c.host,row.path))),row.sha256);
 await c.publish('installed-agent-media-overlay1-source-manifest',{...prior,QAOverlay:overlay,QAOnlyFixtures:[...prior.QAOnlyFixtures,...names],fixtureDelayRegistration:true,
  newScopeOnly:true,canonicalRunsSha256:sha(runs),sourceCandidateManifestSha256:prior.packed.sdk.manifestSha256,overlaySourceRestorationRequired:true,
  fixtureSyntheticManifest:manifest.manifestId,provisionalV2Evidence:true,enabledDeploymentPending:true,rootActivationPending:true,modelCalls:0});
 console.log(JSON.stringify({status:'OWNED_DELAY_AND_PROVISIONAL_V2_OVERLAY_INSTALLED',modelCalls:0,rootActivation:false}));
}finally{await c.close();}
