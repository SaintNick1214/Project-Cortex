/** Private exact-object operator trust exception, excluded from shipped source/registry. */
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const context=await openOwnedContext();
try{
 await context.verifyTarget('install-media-fixture1-target-verified');
 const installed=JSON.parse(await readFile(join(q,'installed-current1-source-manifest.json'))),manifest=JSON.parse(await readFile(join(q,'commission-only-manifest1.json'))),validation=JSON.parse(await readFile(join(q,'media-prepared-input-validation1.json')));
 assert.equal(manifest.classification,'fixture-synthetic');assert.equal(validation.status,'PASS');assert.equal(validation.manifestSha256,sha(await readFile(join(q,'commission-only-manifest1.json'))));
 const fn=join(context.host,context.functionsDirectory),bootstrapPath=join(fn,'runtimeModelPolicyBootstrap.ts'),schemaPath=join(fn,'schema.ts');
 const bootstrap=await readFile(bootstrapPath,'utf8'),schema=await readFile(schemaPath,'utf8');
 const bootstrapPin=installed.files.find(row=>row.path==='runtimeModelPolicyBootstrap.ts'),schemaPin=installed.preserved.find(row=>row.path==='custom/backend/schema.ts');assert.equal(sha(bootstrap),bootstrapPin.sha256);assert.equal(sha(schema),schemaPin.sha256);
 const registry='Object.freeze([TEXT_GATEWAY_POLICY_MANIFEST_V3, AGENT_GATEWAY_POLICY_MANIFEST_V5, DEFAULT_GATEWAY_POLICY_MANIFEST])',trusted='manifest.classification === "reviewed-actual" && manifests.some((entry) => entry === manifest)';assert.equal(bootstrap.split(registry).length,2);assert.equal(bootstrap.split(trusted).length,2);
 const changed='import { fixtureManifest } from "./mediaQualificationManifest";\n'+bootstrap.replace(registry,'Object.freeze([TEXT_GATEWAY_POLICY_MANIFEST_V3, AGENT_GATEWAY_POLICY_MANIFEST_V5, DEFAULT_GATEWAY_POLICY_MANIFEST, fixtureManifest])').replace(trusted,'(manifest.classification === "reviewed-actual" || manifest === fixtureManifest) && manifests.some((entry) => entry === manifest)');
 assert.equal(schema.split('...cortexTablesV1,').length,2);
 const changedSchema='import {task12MediaProbeTable} from "./mediaProbeSchema";\n'+schema.replace('...cortexTablesV1,','...cortexTablesV1,task12MediaProbes:task12MediaProbeTable,');
 const files=[['mediaProbe.fixture.ts','mediaProbe.ts'],['mediaProbeSchema.fixture.ts','mediaProbeSchema.ts']];for(const[,to]of [...files,[null,'mediaQualificationManifest.ts']]){let exists=true;try{await access(join(fn,to));}catch(error){if(error.code==='ENOENT')exists=false;else throw error;}assert.equal(exists,false,'QA media file already exists: '+to);}
 await context.publish('install-media-fixture1-preimages',{scope:'PRIVATE_OPERATOR_COMMISSIONING_NOT_SHIPPED_QUALIFICATION',bootstrap:{path:bootstrapPath,bytes:Buffer.byteLength(bootstrap),sha256:sha(bootstrap),source:bootstrap},schema:{path:schemaPath,bytes:Buffer.byteLength(schema),sha256:sha(schema),source:schema},existingInstalledManifestSha256:installed.packed.sdk.manifestSha256});
 for(const[from,to]of files)await writeFile(join(fn,to),await readFile(join(q,from)),{flag:'wx'});
 await writeFile(join(fn,'mediaQualificationManifest.ts'),'import type {DeploymentPolicyManifest} from "./runtimeModelPolicyBootstrap";\n// Provisional fixed operator commissioning only; no actual or independent PASS.\nexport const fixtureManifest = '+JSON.stringify(manifest)+' as const satisfies DeploymentPolicyManifest;\n',{flag:'wx'});
 await writeFile(bootstrapPath,changed);await writeFile(schemaPath,changedSchema);
 for(const row of installed.preserved)if(row.path!=='custom/backend/schema.ts'&&row.path!=='custom/backend/http.ts')assert.equal(sha(await readFile(join(context.host,row.path))),row.sha256);
 const pins=[];for(const path of ['runtimeModelPolicyBootstrap.ts','schema.ts','mediaProbe.ts','mediaProbeSchema.ts','mediaQualificationManifest.ts']){const bytes=await readFile(join(fn,path));pins.push({path,bytes:bytes.length,sha256:sha(bytes),QAOnly:true});}
 await context.publish('media-fixture-source-manifest1',{scope:'PRIVATE_OPERATOR_COMMISSIONING_NOT_SHIPPED_QUALIFICATION',projectId:context.state.projectId,defaultProductionManifestUnchanged:true,compiledException:'exact fixtureManifest object only',shippedRegistryChanged:false,manifestId:manifest.manifestId,manifestRevision:manifest.revision,pins,sourcePackSha256:installed.packed.sdk.sha256,sourceManifestSha256:installed.packed.sdk.manifestSha256,onlyNewQATable:'task12MediaProbes',modelCalls:0,enabledDeploymentPending:true});
 console.log(JSON.stringify({status:'MEDIA_FIXTURE_INSTALLED',modelCalls:0,shippedRegistryChanged:false}));
}finally{await context.close();}
