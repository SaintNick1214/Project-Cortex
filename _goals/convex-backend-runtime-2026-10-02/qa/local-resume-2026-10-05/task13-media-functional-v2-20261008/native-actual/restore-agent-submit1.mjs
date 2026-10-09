/** Restore exact canonical product runs.submit after the one deliberate scheduler scene. No run restart. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('agent-submit-restore1-target-verified');
 const prior=JSON.parse(await readFile(join(q,'installed-agent-media-overlay1-source-manifest.json'))),released=JSON.parse(await readFile(join(q,'agent-media-release-ingestion1-readback.json')));
 assert.equal(released.status,'ACTUAL_REAL_INGESTION_RELEASE_COMPLETE');assert.equal(released.run.responseStatus,'complete');assert.equal(released.run.memoryStatus,'complete');
 const functions=join(c.host,c.functionsDirectory),path='runs.ts',privatePath=join(functions,path),old=await readFile(privatePath),pin=prior.QAOverlay.find(row=>row.path===path);
 assert.equal(sha(old),pin.sha256);const canonical=await readFile(join(prior.packed.sdk.unpackedBackend,path)),product=prior.files.find(row=>row.path===path);
 assert.equal(sha(canonical),product.sha256);assert.equal(sha(canonical),prior.canonicalRunsSha256);
 for(const row of prior.QAOverlay.filter(row=>row.path!==path))assert.equal(sha(await readFile(join(functions,row.path))),row.sha256);
 await c.publish('agent-submit-restore1-preimage',{path,privateOverlaySha256:sha(old),privateOverlaySource:old.toString(),canonicalSha256:sha(canonical),reason:'One original deliberate initial ingestion delay scene closed; restore canonical registration before final current-product readbacks.',noRunRestart:true,noNewProviderCalls:true});
 await writeFile(privatePath,canonical);assert.equal(sha(await readFile(privatePath)),product.sha256);
 const preserved=prior.preserved.map(row=>row.path.endsWith('/schema.ts')?{...row,sha256:prior.QAOverlay.find(pin=>pin.path==='schema.ts').sha256}:row);
 await c.publish('installed-agent-media-restored1-source-manifest',{...prior,QAOverlay:prior.QAOverlay.filter(row=>row.path!==path),preserved,
  fixtureDelayRegistration:false,canonicalRunsRegistrationRestored:true,overlaySourceRestorationRequired:false,restoredRunsSha256:sha(canonical),enabledDeploymentPending:true,
  noAgentOrMediaRestart:true,existingRunFinalAndMemoryComplete:true,modelCalls:0});
 console.log(JSON.stringify({status:'CANONICAL_RUNS_REGISTRATION_RESTORED_LOCALLY',sha256:sha(canonical),noNewProviderCalls:true}));
}finally{await c.close();}
