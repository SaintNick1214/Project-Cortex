import assert from 'node:assert/strict';
export const K20_PUBLIC_RECALL_PINS = Object.freeze({"ready":true,"sessionId":"eaef43cc-1e21-4c97-9885-1796e48d7d30","name":"trustworthy-cricket-487","id":6161421,"expiresAt":1792572558247,"sourceCommit":"53421e78165fb12a16a11faa19db9372fa8ddfd4","imageId":"sha256:77a412842714f4ce2e4d44a2b4abe5472185c9bd0be87d1707ec947708c9199d","manifestSha256":"9e9fac124a65281e261b1d973ee2aa64a328d1f7d9a502cf7a39924da3605af2","backendManifestSha256":"b876e82f260092d7c1413159c150b6df3a5aa7a3e1312953b4b03b52f3eb1dea","sdkArchiveSha256":"772a220599591477e9e1ab2c28b446b99f95ee0ad56a443d99b436547552559a"});
export function requirePublicRecallPins(options) {
  assert.equal(K20_PUBLIC_RECALL_PINS.ready, true, 'UNREADY_K20: fresh accepted READY pins and root GO required; no native access');
  for (const key of ['sessionId','name','id','expiresAt','sourceCommit','imageId','manifestSha256','sdkArchiveSha256']) assert.equal(options[key], K20_PUBLIC_RECALL_PINS[key], 'Exact accepted target/artifact required');
  assert.match(K20_PUBLIC_RECALL_PINS.backendManifestSha256, /^[a-f0-9]{64}$/);
  return K20_PUBLIC_RECALL_PINS;
}
