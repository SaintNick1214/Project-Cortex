import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {compose,composeForControls} from './current-compose.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
import {repositoryRoot} from './repository-location.mjs';
const work=path.join(repositoryRoot,'work/resume/task04-current-catalog-release-c4');
const transition=JSON.parse(fs.readFileSync(path.join(base,'source-transition.json'),'utf8'));
const fixed=path.join(base,'staged-post-root');
const allocations=()=>fs.readdirSync(work).filter(n=>n.startsWith('private-'));
let mkdirCalls=0,mkdtempCalls=0;const mkdir=fs.mkdirSync,mkdtemp=fs.mkdtempSync;
function deny(destination,sourceRoot){const before=allocations();mkdirCalls=0;mkdtempCalls=0;fs.mkdirSync=(...args)=>{mkdirCalls++;return mkdir(...args)};fs.mkdtempSync=(...args)=>{mkdtempCalls++;return mkdtemp(...args)};try{assert.throws(()=>sourceRoot?composeForControls(destination,{sourceRoot}):compose(destination),/SOURCE_BYTES_DRIFT/)}finally{fs.mkdirSync=mkdir;fs.mkdtempSync=mkdtemp}assert.equal(mkdirCalls,0);assert.equal(mkdtempCalls,0);assert.ok(!fs.existsSync(destination));assert.deepEqual(allocations(),before)}
const outcomes=[];
deny(path.join(work,'pre-runtime-denied'));outcomes.push({name:'normal default root PRE denies before mkdir/mkdtemp',mkdir:0,mkdtemp:0});
const cliDestination=path.join(work,'pre-cli-denied');let failed=false;try{execFileSync(process.execPath,[path.join(base,'current-compose.mjs'),cliDestination],{env:{PATH:'/usr/bin:/bin',TSX_DISABLE_CACHE:'1',NODE_OPTIONS:'--import '+path.join(base,'offline-guard.mjs')},encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch(error){failed=true;assert.match(error.stderr,/SOURCE_BYTES_DRIFT/)}assert.ok(failed&&!fs.existsSync(cliDestination));outcomes.push({name:'actual normal CLI PRE fail-closed',outputAbsent:true});
const cases=fs.mkdtempSync(path.join(base,'release-cases-'));
try{
 const candidate=path.join(cases,'mixed');fs.cpSync(fixed,candidate,{recursive:true,dereference:false});
 for(let mask=0;mask<15;mask++){
  for(const [i,row]of transition.changedOnly.entries())fs.copyFileSync(path.join(base,mask&(1<<i)?'postimages':'preimages-before',row.path),path.join(candidate,row.path));
  deny(path.join(work,'mixed-'+mask),candidate);outcomes.push({name:'mixed PRE/POST state '+mask+' denies',mkdir:0,mkdtemp:0});
 }
 for(const row of transition.changedOnly)fs.copyFileSync(path.join(base,'postimages',row.path),path.join(candidate,row.path));
 for(const row of transition.changedOnly){const p=path.join(candidate,row.path),before=fs.readFileSync(p);fs.writeFileSync(p,Buffer.concat([before,Buffer.from(' ')]));deny(path.join(work,'corrupt-'+path.basename(path.dirname(p))),candidate);fs.writeFileSync(p,before);outcomes.push({name:'one-byte corrupt POST '+row.path+' denies',mkdir:0,mkdtemp:0})}
 const result=composeForControls(path.join(base,'witness'),{sourceRoot:fixed});assert.equal(result.currentComposition.currentEndpoints,275);assert.deepEqual(result.currentComposition.totals,{baselineTables:26,additiveTables:5,currentTables:31,indexes:184,policyInternal:16});assert.deepEqual(allocations(),[]);outcomes.push({name:'exact136 POST graph succeeds only, current catalog exact',endpoints:275});
 console.log(JSON.stringify({scope:'POST_ONLY_RELEASE_SOURCE_GRAPH_OFFLINE',groups:outcomes.length,outcomes,actualRootApplied:false,nativeServices:'NOT_RUN'}));
}finally{fs.rmSync(cases,{recursive:true,force:true})}
