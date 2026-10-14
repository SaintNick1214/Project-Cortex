/** K18 preparation only. Root must supply exact fresh READY pins and phase GO. */
import assert from 'node:assert/strict';
export const K18_PINS=Object.freeze({
 ready:true,sessionId:'6d26bec9-cd41-49ef-b1a1-73a5f9b8e56e',name:'tidy-emu-328',targetId:6156264,expiresAt:1792556007329,imageId:'sha256:a1330ff0ee1431af68a69f0b65c82a67acdd8611fb8d1188f6b821b5fc8a708c',
 sourceCommit:'f7c906b2888a410deb81c6a181e4863ca148e43c',
 kit:'/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-endpoint-scopes-2026-10-13',
 backendManifestSha256:'585a52249d48b8008c897b04b9304f637700d14c2ab7ae3cef7b598cd62df0ae',manifestSha256:'f45feb1caaedc49437a5bab9a42e75a41373cd18b5ba09fb3d0b0f0e1e3c9a96',sdkArchiveSha256:'5a6f1813e256b99e4fa25b59f35c68c6738281543cc7811039ce4a1016081d6c',
 runIds:Object.freeze(['UNREADY_BROWSER_FIRST','UNREADY_BROWSER_WARM','UNREADY_CLI_FIRST','UNREADY_CLI_WARM']),
 markers:Object.freeze(['READY38','WARM38','CLI38','CLW38']),
});
export const K18_V5_NAMES=Object.freeze(['turnStepV5','prepareTurnModel','prepareResolvedModelOperation','admitPreparedModelOperation','contextSourceBatch','contextSource']);
export function requireK18ReadyPins(){
 assert.equal(K18_PINS.ready,true,'UNREADY_K18: exact fresh READY pins required; no service access');
 assert.match(K18_PINS.sessionId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
 assert.match(K18_PINS.name,/^[a-z]+(?:-[a-z]+)+-\d+$/);
 assert.ok(Number.isSafeInteger(K18_PINS.targetId)&&K18_PINS.targetId>0);
 assert.ok(Number.isSafeInteger(K18_PINS.expiresAt)&&K18_PINS.expiresAt>0);
 assert.match(K18_PINS.imageId,/^sha256:[a-f0-9]{64}$/);
 assert.match(K18_PINS.sourceCommit,/^[a-f0-9]{40}$/);
 return K18_PINS;
}
export function requireK18Run(index,runId){
 requireK18ReadyPins();assert.ok(Number.isSafeInteger(index)&&index>=0&&index<4);
 assert.match(K18_PINS.runIds[index],/^run:[a-f0-9]{64}$/);assert.equal(runId,K18_PINS.runIds[index]);
}
