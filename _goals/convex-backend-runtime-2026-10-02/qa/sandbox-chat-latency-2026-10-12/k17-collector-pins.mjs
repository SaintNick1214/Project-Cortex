/** K17 preparation only. Root must supply exact fresh READY pins and phase GO. */
import assert from 'node:assert/strict';
export const K17_PINS=Object.freeze({
 ready:true,sessionId:'2b6876d8-e68b-4cb1-9a9e-6eee05c07245',name:'impartial-dodo-83',targetId:6154753,expiresAt:1792548541228,imageId:'sha256:fda79d598f57bade27dfdf442e3ef299084406420e3840b2a200b11a514d6218',
 sourceCommit:'6156ea97aa8776accee52879176cdcd12e802d89',
 kit:'/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-progress-source-batch-2026-10-13',
 backendManifestSha256:'dc22cb4d58c8871137b37cb2705fcc14a8d04378e6a330bf0c2a6f8267869e32',
 manifestSha256:'4d157dcb5ede22f036248a749af3c2d622f35b0fc10daea3943281ac3823d162',sdkArchiveSha256:'e3fc94fb39e47c9cf4840a8c57e4e1ceae4d8f5b66779f1cfbfccd34f29ad57f',
 runIds:Object.freeze(['run:a5498982769f735c2bbfa39c05d597abf1bcf6fbb72d13e780859ea744a231c1','run:0365525e064c3dde77fc258281dda56b400d259e21c05c8ff8b8e75561aff493','run:50ba733aa9d4f2c586e46f5c2d29147f2669714b7ec3b5c7c294675cce4fd6ad','run:a5c814064bbd1ec6d7ddf669ff0e533a5b4e2704b84aa524e15209b603b8618a']),
 markers:Object.freeze(['READY37','WARM37','CLI37','CLW37']),
});
export const K17_V5_NAMES=Object.freeze(['turnStepV5','prepareTurnModel','prepareResolvedModelOperation','admitPreparedModelOperation','contextSourceBatch','contextSource']);
export function requireK17ReadyPins(){
 assert.equal(K17_PINS.ready,true,'UNREADY_K17: exact fresh READY pins required; no service access');
 assert.match(K17_PINS.sessionId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
 assert.match(K17_PINS.name,/^[a-z]+(?:-[a-z]+)+-\d+$/);
 assert.ok(Number.isSafeInteger(K17_PINS.targetId)&&K17_PINS.targetId>0);
 assert.ok(Number.isSafeInteger(K17_PINS.expiresAt)&&K17_PINS.expiresAt>0);
 assert.match(K17_PINS.imageId,/^sha256:[a-f0-9]{64}$/);
 assert.match(K17_PINS.sourceCommit,/^[a-f0-9]{40}$/);
 return K17_PINS;
}
export function requireK17Run(index,runId){
 requireK17ReadyPins();assert.ok(Number.isSafeInteger(index)&&index>=0&&index<4);
 assert.match(K17_PINS.runIds[index],/^run:[a-f0-9]{64}$/);assert.equal(runId,K17_PINS.runIds[index]);
}
