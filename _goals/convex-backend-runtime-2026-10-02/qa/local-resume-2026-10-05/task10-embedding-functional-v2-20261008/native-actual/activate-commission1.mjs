/** Ordinary enabled-deployment verification and exact operator policy installation; no inference. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha,authorityReference} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('activate-commission1-target-verified');
 const deployment=JSON.parse(await readFile(join(q,'deploy-commission2.json'))),source=JSON.parse(await readFile(join(q,'commission-fixture-source-manifest2.json'))),manifest=JSON.parse(await readFile(join(q,'commission-only-manifest1.json')));
 assert.equal(deployment.code,0);assert.equal(deployment.timedOut,false);assert.equal(deployment.childClosed,true);
 for(const file of source.files)assert.equal(sha(await readFile(join(c.host,c.functionsDirectory,file.path))),file.sha256);
 assert.equal(source.projectId,c.state.projectId);assert.equal(manifest.manifestId,'task10-operator-qualification-'+c.state.operation);
 const installed=await c.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',{manifestId:manifest.manifestId,expectedRevision:manifest.revision});
 const base=JSON.parse(await readFile(join(q,'baseline-functional-auth-outcomes.json')));
 const selected=await c.admin.query('runtimeModelPolicy:embeddingProfile',{reference:authorityReference(base.owner),operationKey:'embedding.query'});
 assert.equal(selected.modelId,'openai/text-embedding-3-large');assert.equal(selected.dimensions,3072);
 const ledger=await c.admin.query('profileQualification:state',{reference:authorityReference(base.owner)});assert.equal(ledger.operations.length,0);assert.equal(ledger.attempts.length,0);
 await c.publish('commission-fixture-deployed1',{projectId:c.state.projectId,installed,selected,sourceManifestSha256:source.manifestSha256,enabledDeploymentExit:0,
  qualificationTrust:'private exact-object fixture-synthetic operator exception',shippedRegistryChanged:false,zeroModelCallsBeforeCommission:true,profileCatalogueNotClaimedAsQualification:true});
}finally{await c.close();}
