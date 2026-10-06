/** Fresh local qualification identity only. Never emits or persists JWTs here. */
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, randomUUID } from 'node:crypto';
import { mkdirSync, lstatSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const q=dirname(fileURLToPath(import.meta.url));const privateDirectory='/Users/SaintNick/.codex/tmp/cortex-runtime-task03-attempt4-private-20261006';
mkdirSync(privateDirectory,{mode:0o700});const stat=lstatSync(privateDirectory);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());assert.equal(realpathSync(privateDirectory),privateDirectory);assert.equal(stat.uid,process.getuid());assert.equal(stat.mode&0o777,0o700);
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const keyPath=resolve(privateDirectory,'jwt-private.pem');writeFileSync(keyPath,privateKey.export({format:'pem',type:'pkcs8'}),{flag:'wx',mode:0o600});const keyStat=lstatSync(keyPath);assert.equal(keyStat.mode&0o777,0o600);assert.equal(keyStat.nlink,1);
const jwk={...publicKey.export({format:'jwk'}),kid:'current-foundation-'+randomUUID(),alg:'RS256',use:'sig'};const publicHash=createHash('sha256').update(JSON.stringify(jwk)).digest('hex');
const authPath=resolve(q,'managed-fixture/fixture/convex/auth.config.ts');const historical=readFileSync(resolve(q,'historical-preimages/auth.config.ts'));
const encoded=Buffer.from(JSON.stringify({keys:[jwk]})).toString('base64');const auth=historical.toString().replace(/base64,[A-Za-z0-9+/=]+/,`base64,${encoded}`);assert.notEqual(auth,historical.toString());writeFileSync(authPath,auth);
writeFileSync(resolve(q,'fresh-identity-public.json'),JSON.stringify({state:'FRESH_LOCAL_IDENTITY_ONLY_NO_SERVICE_REQUESTS',generatedAt:new Date().toISOString(),algorithm:'RS256',modulusLength:2048,kid:jwk.kid,publicJwkSha256:publicHash,publicJwks:{keys:[jwk]},issuer:'https://cortex-qualification.invalid',audience:'cortex-task01',privateDirectory,privateDirectoryMode:'0700',privateKeyPath:keyPath,privateKeyMode:'0600',privateBytesOutput:false,jwtTokensCreated:0,historicalAuthSha256:createHash('sha256').update(historical).digest('hex'),freshAuthSha256:createHash('sha256').update(auth).digest('hex'),authDelta:'PUBLIC_JWKS_ONLY; issuer, audience, algorithm, provider shape conserved'},null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({status:'PASS',publicIdentityReceipt:'fresh-identity-public.json',privateKeyMode:'0600',externalRequests:0,privateBytesOutput:false})+'\n');
