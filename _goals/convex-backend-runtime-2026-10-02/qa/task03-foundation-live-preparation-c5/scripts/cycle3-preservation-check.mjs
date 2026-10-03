import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preparation, repo, sha256, canonical } from './guard.mjs';
const manifest=JSON.parse(readFileSync(resolve(preparation,'cycle3-preservation.json')));
for(const row of manifest.files)assert.equal(sha256(readFileSync(canonical(resolve(repo,row.path),repo))),row.sha256);
assert.equal(sha256(readFileSync(resolve(preparation,'../task03-foundation-live-preparation-c3/runtime-freeze.json'))),manifest.candidateSha256);
console.log(JSON.stringify({scope:'OFFLINE_CYCLE3_BYTE_PRESERVATION',status:'PASS',files:manifest.files.length,candidateSha256:manifest.candidateSha256,serviceCalls:0,keyReads:0,signatures:0}));
