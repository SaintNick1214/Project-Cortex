import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {requireK27ReadyPins} from './k27-collector-pins.mjs';
const Q=path.dirname(fileURLToPath(import.meta.url));
/** Local interlock only: this function never opens a client or contacts a service. */
export function requireK27OrdinaryMemoryPins(options){
 const pins=requireK27ReadyPins(),expected={...pins,id:pins.targetId};
 for(const key of ['sessionId','name','id','expiresAt','sourceCommit','imageId','manifestSha256','sdkArchiveSha256'])assert.equal(options[key],expected[key],'Exact K27 READY target/artifact required');
 assert.match(pins.backendManifestSha256,/^[a-f0-9]{64}$/);
 const file=process.env.CORTEX_K27_FOUR_RUN_PROOF_RECEIPT;
 assert.ok(typeof file==='string','Quiet fixed-four native proof receipt required before any ordinary-memory client');
 assert.equal(path.dirname(path.resolve(file)),Q);assert.match(path.basename(file),/^k27-memory-native-v2-four-run-verification-\d+\.json$/);
 const stat=fs.lstatSync(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid());
 const bytes=fs.readFileSync(file),proof=JSON.parse(bytes);assert.equal(typeof proof.passed,'boolean');assert.equal(proof.readOnly,true);assert.equal(proof.freshVerifications,45);
 for(const key of ['sessionId','name','id'])assert.equal(proof.target[key],expected[key]);
 assert.equal(proof.target.teamId,325340);assert.equal(proof.target.projectId,3200658);
 assert.equal(proof.target.reference,'dev/cortex-sandbox-'+pins.sessionId);
 assert.equal(proof.mode,'four-supplied-runs');assert.equal(proof.runs.length,4);assert.equal(pins.runIds.length,4);
 for(let index=0;index<4;index++){const run=proof.runs[index];assert.equal(run.runId,pins.runIds[index]);assert.equal(typeof run.passed,'boolean');
  assert.equal(run.responseStatus,'complete');assert.ok(['complete','failed'].includes(run.memoryStatus));assert.equal(run.events.length,2);}
 return {...expected,fixedFourBaselinePassed:proof.passed,fixedFourBaselineFreshVerifications:proof.freshVerifications,fixedFourProofSha256:createHash('sha256').update(bytes).digest('hex')};
}
