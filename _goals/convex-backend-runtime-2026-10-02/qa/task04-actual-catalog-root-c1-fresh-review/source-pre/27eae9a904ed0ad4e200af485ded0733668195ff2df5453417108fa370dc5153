import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {syncBuiltinESMExports} from 'node:module';
const base='/workspace/Project-Cortex/work/resume/task04-current-catalog-release-c4';
const log='/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-actual-catalog-root-c1-fresh-review/identity-'+process.pid+'.jsonl';
const mk=fs.mkdtempSync.bind(fs),rm=fs.rmSync.bind(fs),append=fs.appendFileSync.bind(fs),owned=new Map();
function record(value){append(log,JSON.stringify({utc:new Date().toISOString(),pid:process.pid,...value})+'\n',{mode:0o600});}
fs.mkdtempSync=function(prefix,...args){const name=String(prefix);if(name.startsWith(base+'/'))assert.ok(name.startsWith(base+'/private-')||name.startsWith(base+'/test-scratch/'),'UNAUTHORIZED_SHARED_MKDTEMP');const created=mk(prefix,...args);if(String(created).startsWith(base+'/')){const s=fs.lstatSync(created);owned.set(String(created),{dev:s.dev,ino:s.ino});record({event:'created',path:String(created),dev:s.dev,ino:s.ino,mode:s.mode&0o777});}return created;};
fs.rmSync=function(target,...args){const name=String(target);if(owned.has(name)){const expected=owned.get(name),s=fs.lstatSync(target);assert.equal(s.dev,expected.dev);assert.equal(s.ino,expected.ino);assert.ok(!s.isSymbolicLink());record({event:'cleanup-before',path:name,...expected});const result=rm(target,...args);assert.ok(!fs.existsSync(target));record({event:'cleanup-after',path:name,...expected,absent:true});return result;}return rm(target,...args);};
syncBuiltinESMExports();
