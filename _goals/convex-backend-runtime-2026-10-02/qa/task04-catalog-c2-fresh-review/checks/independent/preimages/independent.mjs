import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compose,composeForControls,verifyNative} from './current-compose.mjs';
import {rollbackOutput,readExact,hash} from './containment.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const scratch=fs.mkdtempSync(path.join(base,'independent-'));const results=[];
const test=(name,fn)=>{fn();results.push({name,status:'PASS'})};
try{
 const sources=path.join(scratch,'source');fs.mkdirSync(sources);for(const row of JSON.parse(fs.readFileSync(path.join(base,'source-pre.json'))).sources){const p=path.join(sources,row.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(base,'preimages',row.path),p)}
 test('independent preeffect drift denial observes zero mkdir and zero mkdtemp calls',()=>{fs.appendFileSync(path.join(sources,'AGENTS.md'),'\nDRIFT');let effects=0;const mkdir=fs.mkdirSync,mkdtemp=fs.mkdtempSync;fs.mkdirSync=(...args)=>{effects++;return mkdir(...args)};fs.mkdtempSync=(...args)=>{effects++;return mkdtemp(...args)};try{assert.throws(()=>composeForControls(path.join(scratch,'bad'),{sourceRoot:sources}),/SOURCE_BYTES_DRIFT/);assert.equal(effects,0)}finally{fs.mkdirSync=mkdir;fs.mkdtempSync=mkdtemp}});
 test('independent ancestor denial prevents outside sentinel writes',()=>{const outside=path.join(scratch,'outside');fs.mkdirSync(outside);const sentinel=path.join(outside,'sentinel');fs.writeFileSync(sentinel,'CALLER');fs.symlinkSync(outside,path.join(scratch,'hop'));assert.throws(()=>compose(path.join(scratch,'hop','out')),/SYMLINK_ANCESTOR_DENIED/);assert.deepEqual(fs.readdirSync(outside),['sentinel']);assert.equal(fs.readFileSync(sentinel,'utf8'),'CALLER')});
 test('independent single-link read rejects same-content hardlink before acceptance',()=>{const file=path.join(scratch,'single');fs.writeFileSync(file,'PIN');const pin=hash(fs.readFileSync(file));assert.equal(readExact(file,pin).toString(),'PIN');fs.linkSync(file,path.join(scratch,'hard'));assert.throws(()=>readExact(file,pin),/REGULAR_SINGLE_LINK_SOURCE_REQUIRED/);assert.equal(fs.readFileSync(file,'utf8'),'PIN')});
 test('identity rollback rejects replaced caller file and preserves bytes',()=>{const file=path.join(scratch,'identity');fs.writeFileSync(file,'RUNNER');const s=fs.lstatSync(file);fs.renameSync(file,path.join(scratch,'park'));fs.writeFileSync(file,'CALLER_REPLACEMENT');assert.throws(()=>rollbackOutput([{path:file,dev:s.dev,ino:s.ino,kind:'file'}]),/OUTPUT_CLEANUP_OWNERSHIP_FAILURE/);assert.equal(fs.readFileSync(file,'utf8'),'CALLER_REPLACEMENT')});
 test('independent complete current metadata and wrong baseline returns denial',()=>{const native=JSON.parse(fs.readFileSync(path.join(base,'witness/current-native.json')));const baseline=JSON.parse(fs.readFileSync(path.join(base,'witness/exact-current-repair-native.json')));assert.deepEqual(verifyNative(native,baseline),{baselineTables:26,additiveTables:5,currentTables:31,indexes:184,policyInternal:16});native.artifactRegistrations.count.returns='{}';assert.throws(()=>verifyNative(native,baseline))});
 console.log(JSON.stringify({independentControls:results,realNetwork:0}));
}finally{fs.rmSync(scratch,{recursive:true,force:true})}
