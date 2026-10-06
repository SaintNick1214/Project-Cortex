import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath}from'node:url';
import {fullHeld}from'../source/node_contract.mjs';
const directory=path.join(path.dirname(fileURLToPath(import.meta.url)),'node-helper-fixture-run1');fs.mkdirSync(directory,{mode:0o700});
const p=path.join(directory,'regular');fs.writeFileSync(p,'PUBLIC_READ_ONLY_HELPER\n',{flag:'wx',mode:0o600});
const raw=fs.readFileSync(p),expected={bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')},fd=fs.openSync(p,'r');
const results=[];const test=(name,fn)=>{try{fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',error:String(e)});}};
try{
 test('positional-full-eof-after-descriptor-at-eof',()=>{fs.readFileSync(fd);assert.deepEqual(fullHeld(fd,expected),{...expected,EOF:true});});
 test('repeat-positional-full-eof',()=>assert.deepEqual(fullHeld(fd,expected),{...expected,EOF:true}));
 test('bytes-overflow-before-hash-return',()=>assert.throws(()=>fullHeld(fd,{...expected,bytes:1}),/BOUND/));
 test('hash-mismatch',()=>assert.throws(()=>fullHeld(fd,{...expected,sha256:'0'.repeat(64)}),/FULL_BYTE_PIN/));
 test('fractional-size-denied',()=>assert.throws(()=>fullHeld(fd,{...expected,bytes:14.5}),/FINITE_HELD_SOURCE_BYTES/));
 test('unsafe-size-denied',()=>assert.throws(()=>fullHeld(fd,{...expected,bytes:1e20}),/FINITE_HELD_SOURCE_BYTES/));
 test('read-error-retained',()=>assert.throws(()=>fullHeld(fd,expected,()=>{throw Error('PUBLIC_READ_FAILURE');}),/PUBLIC_READ_FAILURE/));
}finally{fs.closeSync(fd);}
test('closed-fd-denied',()=>assert.throws(()=>fullHeld(fd,expected),/EBADF/));
const output={scope:'PUBLIC_HOST_NODE_HELPER_ONLY',count:results.length,results,nativeQualification:false,original122:'HELD',ROOT:'ABSENT'};
fs.writeFileSync(path.join(path.dirname(directory),'node-control-results-run1.json'),JSON.stringify(output)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(output));if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
