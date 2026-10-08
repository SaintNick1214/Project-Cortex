import assert from 'node:assert/strict';
import { readFileSync, lstatSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createPrivateKey, createPublicKey, randomUUID } from 'node:crypto';
import { repo, fixture, scratch, preparation, sha256, canonical, preparationReviewed } from './guard.mjs';
preparationReviewed(); // Independent preparation PASS required before private key access.
const path=canonical(resolve(repo,'work/backend-runtime/qualification/jwt-private.pem'),repo,true);
const directory=lstatSync(canonical(dirname(path),repo));assert.equal(directory.mode&0o777,0o700);assert.equal(directory.uid,process.getuid());
const key=createPrivateKey(readFileSync(path)),pub=createPublicKey(key).export({format:'jwk'});
const config=readFileSync(resolve(fixture,'fixture/convex/auth.config.ts'),'utf8');
const expected=JSON.parse(Buffer.from(config.match(/base64,([A-Za-z0-9+/=]+)/)[1],'base64')).keys[0];
assert.equal(pub.kty,'RSA');assert.equal(pub.n,expected.n);assert.equal(pub.e,expected.e);assert.equal(expected.alg,'RS256');
const request=JSON.parse(readFileSync(resolve(fixture,'project-request.json')));const keyCheckReceipt=resolve(scratch,'key-match-'+randomUUID()+'.json');writeFileSync(keyCheckReceipt,JSON.stringify({operation:request.operation,status:'PASS',publicKeyMatches:true,candidateSha256:sha256(readFileSync(resolve(preparation,'runtime-freeze.json'))),observedAt:new Date().toISOString(),keysCreated:0,signatures:0},null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({keyCheckReceipt,scope:'OFFLINE_READ_ONLY_EXISTING_KEY',status:'PASS',publicKeyMatches:true,keysCreated:0,signatures:0,dispatches:0}));
