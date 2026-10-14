/** K15 preparation only. Root must supply exact fresh READY pins and phase GO. */
import assert from 'node:assert/strict';
export const K15_PINS=Object.freeze({
 ready:true,sessionId:'513d91a6-6cc5-425f-b997-306a6261b868',name:'formal-newt-698',targetId:6152307,expiresAt:1792539988680,imageId:'sha256:78149117c6ef5a0f6a8484d2d4c6dfa121afbe95632b649bed80e0f245162780',
 sourceCommit:'2c8689fac3aca2acf1fb1f46d8b10a87388e95cd',
 kit:'/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-turn-consolidation-2026-10-13',
 backendManifestSha256:'3e508699163ccf254b2a8d3aad93760ca36ff4dae7730ac37e82b6e5006a4465',
 manifestSha256:'14c76c5724b83c94d50567ab5e24488ca72d9bd9147ff0f67bd958fdedc1ebd3',sdkArchiveSha256:'06d82ae7844d87a95c6d4fe0a434fc34118a64ad337a8c18e814a682f47d4e51',
 runIds:Object.freeze(['run:b3eb8df008a0f979418a2bacfc29a131ba040d9ff3668c7739c634ebe299d697','run:9aecac68c77901eeb9b3e89426dd2d72b3f5033e80f9ba43b479e5eaf52fb7df','UNREADY_K15_CLI_FIRST','UNREADY_K15_CLI_WARM']),
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
