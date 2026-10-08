/** Parent-only existing key MATCH; never generate/sign and never execute in preparation. */
import assert from 'node:assert/strict';
import {readFileSync,lstatSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createPrivateKey,createPublicKey,randomUUID} from 'node:crypto';
import {reviewed,canonical,root,fixture,scratch,repo,json,sha256,exclusive} from './guard.mjs';
reviewed();const path=canonical(process.env.CORTEX_QA_TASK04_EXISTING_KEY,repo,true);
const dir=lstatSync(canonical(dirname(path),repo));assert.equal(dir.mode&511,448);assert.equal(dir.uid,process.getuid());
const pub=createPublicKey(createPrivateKey(readFileSync(path))).export({format:'jwk'});
const config=readFileSync(resolve(fixture,'convex/auth.config.ts'),'utf8');const expected=JSON.parse(Buffer.from(config.match(/base64,([A-Za-z0-9+/=]+)/)[1],'base64')).keys[0];
assert.equal(pub.kty,'RSA');assert.equal(pub.n,expected.n);assert.equal(pub.e,expected.e);assert.equal(expected.alg,'RS256');
const request=json(resolve(root,'project-request.json'));const receipt=resolve(scratch,'key-match-'+randomUUID()+'.json');
exclusive(receipt,{operation:request.operation,status:'PASS',publicKeyMatches:true,freezeSha256:sha256(readFileSync(resolve(root,'runtime-freeze.json'))),authConfigSha256:sha256(config),observedAt:new Date().toISOString(),keysCreated:0,signatures:0});
process.stdout.write(JSON.stringify({status:'PASS',receipt,keysCreated:0,signatures:0})+'\n');
