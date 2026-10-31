/** Explicit Root-authorized disposable fixture patch, not a product migration. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join,isAbsolute} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const incoming=process.argv[2];assert.ok(incoming&&isAbsolute(incoming));
const context=await openOwnedContext();
try{
  await context.verifyTarget('update-target-verified');
  const functions=join(context.host,context.functionsDirectory),current=join(context.host,'node_modules/@cortexmemory/sdk/dist/backend/v1');
  const oldRaw=await readFile(join(current,'manifest.json')),nextRaw=await readFile(join(incoming,'manifest.json'));
  assert.equal(sha(oldRaw),'5803f6aa2eebf0fda6f373760503330fbeecea269151bed5786831a4ee6d1990');
  const old=JSON.parse(oldRaw),next=JSON.parse(nextRaw);assert.equal(old.files.length,61);
  assert.deepEqual(next.components.slice().sort(),['agent','workflow']);
  const oldPaths=new Set(old.files.map(file=>file.path)),files=[];
  for(const file of old.files){assert.equal(sha(await readFile(join(functions,file.path))),file.sha256,'Changed owned installed file: '+file.path);}
  const preservationPaths=['convex.json',context.functionsDirectory+'host.ts',context.functionsDirectory+'hostNode.ts',context.functionsDirectory+'http.ts',
    context.functionsDirectory+'auth.config.ts',context.functionsDirectory+'schema.ts'];
  const preserved=[];for(const path of preservationPaths){const bytes=await readFile(join(context.host,path));preserved.push({path,bytes:bytes.length,sha256:sha(bytes)});}
  for(const file of next.files){assert.ok(!file.path.includes('..')&&!isAbsolute(file.path));const bytes=await readFile(join(incoming,file.path));assert.equal(sha(bytes),file.sha256);
    if(!oldPaths.has(file.path)){try{await readFile(join(functions,file.path));throw new Error('UNRELATED_TARGET_COLLISION: '+file.path);}catch(error){if(error.code!=='ENOENT')throw error;}}
    files.push({...file,bytes:bytes.length});}
  const configPath=join(functions,'convex.config.ts'),config=await readFile(configPath,'utf8');
  assert.equal(config.split('registerCortexComponentsV1(app);').length,2);assert.ok(config.includes('app.use(agent,{name:"hostAgent"})'));
  const directConfig=config.replace('import { registerCortexComponentsV1 } from "./_cortex/components";\n','')
    .replace('registerCortexComponentsV1(app);','app.use(_cortex_component_agent, { name: "agent" });\napp.use(_cortex_component_workflow, { name: "workflow" });')
    .replace('import {defineApp}', 'import _cortex_component_agent from "@convex-dev/agent/convex.config";\nimport _cortex_component_workflow from "@convex-dev/workflow/convex.config";\nimport {defineApp}');
  assert.ok(directConfig.includes('app.use(_cortex_component_workflow, { name: "workflow" })'));
  const bootstrap=await readFile(join(incoming,'runtimeModelPolicyBootstrap.ts'),'utf8');
  const registry='Object.freeze([DEFAULT_GATEWAY_POLICY_MANIFEST])';assert.equal(bootstrap.split(registry).length,2);
  const trusted='manifest.classification === "reviewed-actual" && manifests.some((entry) => entry === manifest)';assert.equal(bootstrap.split(trusted).length,2);
  const candidateBootstrap=bootstrap.replace('import { DEFAULT_GATEWAY_POLICY_MANIFEST }','import { fixtureManifest } from "./qualificationManifest";\nimport { DEFAULT_GATEWAY_POLICY_MANIFEST }')
    .replace(registry,'Object.freeze([DEFAULT_GATEWAY_POLICY_MANIFEST, fixtureManifest])')
    .replace(trusted,'(manifest.classification === "reviewed-actual" || manifest === fixtureManifest) && manifests.some((entry) => entry === manifest)');
  const manifest=JSON.parse(await readFile(join(q,'qualification-only-manifest.json'),'utf8'));assert.equal(manifest.classification,'fixture-synthetic');
  await context.publish('update-owned-preimage',{oldManifestSha256:sha(oldRaw),oldFiles:old.files,preserved,configSha256:sha(config),config,
    incomingManifestSha256:sha(nextRaw),newFiles:files,fixtureOnlyExplicitPatch:true,productInstallerConflictBehaviorUnchanged:true});
  // All owned and collision checks complete before the first controlled fixture write.
  for(const file of files){await mkdir(dirname(join(functions,file.path)),{recursive:true});await writeFile(join(functions,file.path),await readFile(join(incoming,file.path)));}
  await writeFile(configPath,directConfig);await writeFile(join(functions,'runtimeModelPolicyBootstrap.ts'),candidateBootstrap);
  await writeFile(join(functions,'qualificationManifest.ts'),'import type { DeploymentPolicyManifest } from "./runtimeModelPolicyBootstrap";\n// Operator-only provisional contract: no actual/independent PASS is asserted.\nexport const fixtureManifest = '+JSON.stringify(manifest)+' as const satisfies DeploymentPolicyManifest;\n');
  for(const name of ['gatewayQualification.ts','agentQualification.ts'])await writeFile(join(functions,name),await readFile(join(q,name)));
  for(const pin of preserved)assert.equal(sha(await readFile(join(context.host,pin.path))),pin.sha256);
  const deployed=[];for(const file of files){const bytes=await readFile(join(functions,file.path));deployed.push({path:file.path,bytes:bytes.length,sha256:sha(bytes),
    shippedSha256:file.sha256,fixtureTrustChange:file.path==='runtimeModelPolicyBootstrap.ts'});}
  for(const path of ['convex.config.ts','qualificationManifest.ts','gatewayQualification.ts','agentQualification.ts']){const bytes=await readFile(join(functions,path));deployed.push({path,bytes:bytes.length,sha256:sha(bytes),fixtureOnly:true});}
  await context.publish('deployment-source-manifest',{projectId:context.state.projectId,shippedManifestSha256:sha(nextRaw),incomingRoot:incoming,
    files:deployed,preserved,registeredDirectComponents:['hostAgent','agent','workflow'],qualificationTrust:'compiled exact-object operator-only fixture exception',
    qualificationManifestId:manifest.manifestId,qualificationRevision:manifest.revision,sourceAcceptance:false});
}finally{await context.close();}
