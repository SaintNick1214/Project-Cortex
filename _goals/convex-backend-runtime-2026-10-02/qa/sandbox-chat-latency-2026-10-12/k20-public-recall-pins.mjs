import assert from 'node:assert/strict';
export const K20_PUBLIC_RECALL_PINS = Object.freeze({ ready: false, sessionId: 'UNREADY_K20', name: 'UNREADY_K20', id: 0, expiresAt: 0,
  sourceCommit: 'UNREADY_K20', imageId: 'UNREADY_K20', manifestSha256: 'UNREADY_K20', backendManifestSha256: 'UNREADY_K20', sdkArchiveSha256: 'UNREADY_K20' });
export function requirePublicRecallPins(options) {
  assert.equal(K20_PUBLIC_RECALL_PINS.ready, true, 'UNREADY_K20: fresh accepted READY pins and root GO required; no native access');
  for (const key of ['sessionId','name','id','expiresAt','sourceCommit','imageId','manifestSha256','sdkArchiveSha256']) assert.equal(options[key], K20_PUBLIC_RECALL_PINS[key], 'Exact accepted target/artifact required');
  assert.match(K20_PUBLIC_RECALL_PINS.backendManifestSha256, /^[a-f0-9]{64}$/);
  return K20_PUBLIC_RECALL_PINS;
}
