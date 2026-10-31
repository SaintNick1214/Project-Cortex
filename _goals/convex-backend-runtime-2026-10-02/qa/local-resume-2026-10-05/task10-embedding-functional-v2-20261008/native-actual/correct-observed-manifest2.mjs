/** Correct a rejected fixture-only provenance string; same truthful original qualification. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha} from './common.mjs';
const c=await openOwnedContext();
try{
 await c.verifyTarget('observed-manifest2-target-verified');
 const prior=JSON.parse(await readFile(join(q,'observed-small-manifest1.json'))),manifest=structuredClone(prior);
 assert.equal(prior.qualifications.at(-1).costBound.provenance.length,275);
 manifest.manifestId+='-r2';manifest.revision=8;
 for(const policy of manifest.policies){policy.policyId+='-r2';policy.version=8;}
 manifest.qualifications.at(-1).costBound.provenance='Actual record '+manifest.evidenceHash+'; published $0.13/M input,8192UTF8 <=1065microUSD;100000 retained ceiling; cost unavailable, no refund.';
 assert.ok(manifest.qualifications.at(-1).costBound.provenance.length<=256);
 assert.deepEqual(manifest.qualifications.slice(0,4),prior.qualifications.slice(0,4));assert.deepEqual(manifest.dispatchEvidence,prior.dispatchEvidence);
 await c.publish('observed-small-manifest2',manifest);
 const candidates=JSON.parse(await readFile(join(q,'managed-policy-candidates1.json')));candidates.small={manifestId:manifest.manifestId,expectedRevision:manifest.revision};
 await c.publish('managed-policy-candidates2',candidates);
 const fn=join(c.host,c.functionsDirectory),old=await readFile(join(fn,'profileObservedManifests.ts'));
 await c.publish('observed-manifest2-rejected-preimage',{sourceSha256:sha(old),sourceBytes:old.length,oldManifestPath:join(q,'observed-small-manifest1.json'),oldProvenanceLength:275,maximumContractLength:256,priorSetupFailure:'managed-setup1-failure.json',sameOriginalCall:true,paidCalls:0});
 const source='import type {DeploymentPolicyManifest} from "./runtimeModelPolicyBootstrap";\n// Actual record-bound candidate; independent acceptance is not asserted.\nexport const smallProfileManifest = '+JSON.stringify(manifest)+' as const satisfies DeploymentPolicyManifest;\n';
 await writeFile(join(q,'profileObservedManifests2.ts'),source);await writeFile(join(fn,'profileObservedManifests.ts'),source);
 const priorFiles=JSON.parse(await readFile(join(q,'observed-fixture-source-manifest1.json'))),files=[];
 for(const row of priorFiles.files){const bytes=await readFile(join(fn,row.path));if(row.path!=='profileObservedManifests.ts')assert.equal(sha(bytes),row.sha256);files.push({path:row.path,bytes:bytes.length,sha256:sha(bytes)});}
 await c.publish('observed-fixture-source-manifest2',{...priorFiles,files,compiledCandidates:candidates,provenanceTextOnlyCorrection:true});
}finally{await c.close();}
