/** Replace only the fixture registry with fixed actual-record candidates, removing commissioning trust. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('install-observed1-target-verified');
 const prior=JSON.parse(await readFile(join(q,'commission-fixture-source-manifest2.json'))),packed=JSON.parse(await readFile(join(q,'packed-sdk-current1.json'))),candidates=JSON.parse(await readFile(join(q,'managed-policy-candidates1.json'))),fn=join(c.host,c.functionsDirectory);
 assert.equal(candidates.sourceManifestSha256,packed.manifestSha256);
 for(const file of prior.files)assert.equal(sha(await readFile(join(fn,file.path))),file.sha256,'Candidate changed since qualification '+file.path);
 const original=await readFile(join(packed.unpackedBackend,'runtimeModelPolicyBootstrap.ts'),'utf8');
 const registry='Object.freeze([TEXT_GATEWAY_POLICY_MANIFEST_V3, DEFAULT_GATEWAY_POLICY_MANIFEST])';assert.equal(original.split(registry).length,2);
 const source='import { smallProfileManifest } from "./profileObservedManifests";\n'+original.replace(registry,'Object.freeze([TEXT_GATEWAY_POLICY_MANIFEST_V3, DEFAULT_GATEWAY_POLICY_MANIFEST, smallProfileManifest])');
 assert.ok(!source.includes('manifest === fixtureManifest'));assert.ok(!source.includes('from "./profileQualificationManifest"'));
 await c.publish('install-observed1-preimage',{path:'runtimeModelPolicyBootstrap.ts',sha256:sha(await readFile(join(fn,'runtimeModelPolicyBootstrap.ts'))),source:await readFile(join(fn,'runtimeModelPolicyBootstrap.ts'),'utf8')});
 await c.publish('install-observed1-observer-preimage',{path:'profileNative.ts',sha256:sha(await readFile(join(fn,'profileNative.ts'))),source:await readFile(join(fn,'profileNative.ts'),'utf8'),change:'QA observer uses durable terminalEvidenceCanonical before legacy known-settlement receiptCanonical'});
 await writeFile(join(fn,'runtimeModelPolicyBootstrap.ts'),source);await writeFile(join(fn,'profileObservedManifests.ts'),await readFile(join(q,'profileObservedManifests.ts')));
 await writeFile(join(fn,'profileNative.ts'),await readFile(join(q,'profileNative.ts')));
 const paths=[...prior.files.map(row=>row.path),'profileObservedManifests.ts'],files=[];
 for(const path of paths){const bytes=await readFile(join(fn,path));files.push({path,bytes:bytes.length,sha256:sha(bytes)});}
 await c.publish('observed-fixture-source-manifest1',{projectId:c.state.projectId,files,actualRecordHash:candidates.recordHash,commissionSyntheticTrustRemoved:true,
  compiledCandidates:candidates,shippedDefaultSmallUnchanged:true,reviewCandidateNotFinalAcceptance:true,productionEffects:false});
}finally{await c.close();}
