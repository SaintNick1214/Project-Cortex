/** K18 preparation only. Root must supply exact fresh READY pins and phase GO. */
import assert from 'node:assert/strict';
export const K18_PINS=Object.freeze({
 ready:false,sessionId:'UNREADY',name:'UNREADY',targetId:null,expiresAt:null,imageId:null,
 sourceCommit:'f7c906b2888a410deb81c6a181e4863ca148e43c',
 kit:'/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-endpoint-scopes-2026-10-13',
 backendManifestSha256:null,manifestSha256:null,sdkArchiveSha256:null,
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
