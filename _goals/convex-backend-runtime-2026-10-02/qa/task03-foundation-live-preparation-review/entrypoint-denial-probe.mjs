import assert from 'node:assert/strict';
import fs from 'node:fs';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {pathToFileURL} from 'node:url';
let networkAttempts=0, privateKeyReads=0, processSpawns=0;
const originalRead=fs.readFileSync;
fs.readFileSync=function(path,...args){if(String(path).endsWith('jwt-private.pem')){privateKeyReads++;throw new Error('JUDGE_PRIVATE_KEY_READ_TRAP');}return originalRead.call(this,path,...args);};
childProcess.spawn=function(){processSpawns++;throw new Error('JUDGE_SUBPROCESS_TRAP');};
syncBuiltinESMExports();
globalThis.fetch=async()=>{networkAttempts++;throw new Error('JUDGE_NETWORK_TRAP');};
const target=process.argv[2];process.argv=[process.execPath,target,target.endsWith('deploy.mjs')?'deploy':'foundation-'+'a'.repeat(32)];
let rejected=false;try{await import(pathToFileURL(target));}catch{rejected=true;}
assert.equal(rejected,true);assert.equal(networkAttempts,0);assert.equal(privateKeyReads,0);assert.equal(processSpawns,0);
console.log(JSON.stringify({scope:'INDEPENDENT_NO_REVIEW_ENTRYPOINT_DENIAL',entrypoint:target.split('/').at(-1),status:'PASS',networkAttempts,privateKeyReads,processSpawns}));
