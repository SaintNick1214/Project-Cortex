import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifyReleaseState} from './release-preconditions.mjs';
let effects=0;const mkdir=fs.mkdirSync,mkdtemp=fs.mkdtempSync;
fs.mkdirSync=(...args)=>{effects++;return mkdir(...args)};fs.mkdtempSync=(...args)=>{effects++;return mkdtemp(...args)};
try{const result=verifyReleaseState('PRE');assert.equal(result.exactRootRows,136);assert.equal(result.writes,0);assert.throws(()=>verifyReleaseState('POST'),/SOURCE_BYTES_DRIFT/);for(const value of ['',null,'pre','BOTH',{}])assert.throws(()=>verifyReleaseState(value),/EXACT_PHASE_REQUIRED/);assert.equal(effects,0);console.log(JSON.stringify({scope:'READ_ONLY_ROOT_SOURCE_PRECONDITIONS',PRE:'PASS_EXACT136',POST:'EXPECTED_DENIAL_BEFORE_ROOT_SPLICE',invalidPhases:5,effects:0,actualRootApplied:false}))}finally{fs.mkdirSync=mkdir;fs.mkdtempSync=mkdtemp}
