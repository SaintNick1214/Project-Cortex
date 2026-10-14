/** K16 preparation only. Root must supply exact fresh READY pins and phase GO. */
import assert from 'node:assert/strict';
export const K16_PINS=Object.freeze({
 ready:false,sessionId:'c530728c-fdc2-4876-8690-13317e55ef8d',name:'charming-rabbit-938',targetId:6153416,expiresAt:1792544402587,imageId:'sha256:b6348f112d76399d79c1b2bdd10ec1499cb9b70291e297192496a27199b1748b',
 sourceCommit:'2dd1c8474392322b71606a8dd8ee2df64b9fe0c5',
 kit:'/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-transcript-reader-2026-10-13',
 backendManifestSha256:'b50d0bd7c71e982e78c4794426402dd5dc447f1f215a1042cdbb514eba319a6a',
 manifestSha256:'05cd5f983707d80c35c4d4afc542f5b8af29fa6a28300cacaad24c5568577350',sdkArchiveSha256:'9ac8a26120ab12209ae34f2fbdd0ee292942ed5d23ebfc2f6ca4a50afd6876b3',
 runIds:Object.freeze(['UNREADY_K16_BROWSER_FIRST','UNREADY_K16_BROWSER_WARM','UNREADY_K16_CLI_FIRST','UNREADY_K16_CLI_WARM']),
 markers:Object.freeze(['READY36','WARM36','CLI36','CLW36']),
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
