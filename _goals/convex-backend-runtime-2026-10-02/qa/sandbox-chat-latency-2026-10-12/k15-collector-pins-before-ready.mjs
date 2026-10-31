/** K15 preparation only. Root must supply exact fresh READY pins and phase GO. */
import assert from 'node:assert/strict';
export const K15_PINS=Object.freeze({
 ready:false,sessionId:'UNREADY_K15_SESSION',name:'UNREADY_K15_NAME',targetId:0,expiresAt:0,imageId:'UNREADY_K15_IMAGE',
 sourceCommit:'2c8689fac3aca2acf1fb1f46d8b10a87388e95cd',
 kit:'/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-turn-consolidation-2026-10-13',
 manifestSha256:'UNREADY_K15_MANIFEST',sdkArchiveSha256:'UNREADY_K15_SDK_ARCHIVE',
 runIds:Object.freeze(['UNREADY_K15_BROWSER_FIRST','UNREADY_K15_BROWSER_WARM','UNREADY_K15_CLI_FIRST','UNREADY_K15_CLI_WARM']),
 markers:Object.freeze(['READY35','WARM35','CLI35','CLW35']),
});
export const K15_V5_NAMES=Object.freeze(['turnStepV5','prepareTurnModel','prepareResolvedModelOperation','admitPreparedModelOperation']);
export function requireK15ReadyPins(){
 assert.equal(K15_PINS.ready,true,'UNREADY_K15: exact fresh READY pins required; no service access');
 assert.match(K15_PINS.sessionId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
 assert.match(K15_PINS.name,/^[a-z]+(?:-[a-z]+)+-\d+$/);
 assert.ok(Number.isSafeInteger(K15_PINS.targetId)&&K15_PINS.targetId>0);
 assert.ok(Number.isSafeInteger(K15_PINS.expiresAt)&&K15_PINS.expiresAt>0);
 assert.match(K15_PINS.imageId,/^sha256:[a-f0-9]{64}$/);
 assert.match(K15_PINS.sourceCommit,/^[a-f0-9]{40}$/);
 return K15_PINS;
}
export function requireK15Run(index,runId){
 requireK15ReadyPins();assert.ok(Number.isSafeInteger(index)&&index>=0&&index<4);
 assert.match(K15_PINS.runIds[index],/^run:[a-f0-9]{64}$/);assert.equal(runId,K15_PINS.runIds[index]);
}
