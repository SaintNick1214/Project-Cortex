/** K16 preparation only. Root must supply exact fresh READY pins and phase GO. */
import assert from 'node:assert/strict';
export const K16_PINS=Object.freeze({
 ready:false,sessionId:'UNREADY_K16_SESSION',name:'UNREADY_K16_NAME',targetId:0,expiresAt:0,imageId:'UNREADY_K16_IMAGE',
 sourceCommit:'2dd1c8474392322b71606a8dd8ee2df64b9fe0c5',
 kit:'/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-transcript-reader-2026-10-13',
 backendManifestSha256:'UNREADY_K16_BACKEND_MANIFEST',
 manifestSha256:'UNREADY_K16_ARCHIVE_MANIFEST',sdkArchiveSha256:'UNREADY_K16_SDK_ARCHIVE',
 runIds:Object.freeze(['UNREADY_K16_BROWSER_FIRST','UNREADY_K16_BROWSER_WARM','UNREADY_K16_CLI_FIRST','UNREADY_K16_CLI_WARM']),
 markers:Object.freeze(['UNREADY_K16_BROWSER_FIRST_MARKER','UNREADY_K16_BROWSER_WARM_MARKER','UNREADY_K16_CLI_FIRST_MARKER','UNREADY_K16_CLI_WARM_MARKER']),
});
export const K16_V5_NAMES=Object.freeze(['turnStepV5','prepareTurnModel','prepareResolvedModelOperation','admitPreparedModelOperation']);
export function requireK16ReadyPins(){
 assert.equal(K16_PINS.ready,true,'UNREADY_K16: exact fresh READY pins required; no service access');
 assert.match(K16_PINS.sessionId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
 assert.match(K16_PINS.name,/^[a-z]+(?:-[a-z]+)+-\d+$/);
 assert.ok(Number.isSafeInteger(K16_PINS.targetId)&&K16_PINS.targetId>0);
 assert.ok(Number.isSafeInteger(K16_PINS.expiresAt)&&K16_PINS.expiresAt>0);
 assert.match(K16_PINS.imageId,/^sha256:[a-f0-9]{64}$/);
 assert.match(K16_PINS.sourceCommit,/^[a-f0-9]{40}$/);
 return K16_PINS;
}
export function requireK16Run(index,runId){
 requireK16ReadyPins();assert.ok(Number.isSafeInteger(index)&&index>=0&&index<4);
 assert.match(K16_PINS.runIds[index],/^run:[a-f0-9]{64}$/);assert.equal(runId,K16_PINS.runIds[index]);
}
