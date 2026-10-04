import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {verify,loadFreeze,qa,work,catalogQA} from './guard.mjs';
const mode=process.argv[2];assert.ok(['--list','--run'].includes(mode),'INVALID_RUN_MODE');
const checked=verify();console.log(JSON.stringify({stage:'PREIMPORT_GUARD_PASS',...checked}));
fs.writeFileSync(path.join(work,'child-started.json'),JSON.stringify({mode,stage:'guard-passed'})+'\n');
fs.writeFileSync(path.join(work,'imports.ndjson'),'');
const args=['--experimental-vm-modules','/workspace/Project-Cortex/node_modules/jest/bin/jest.js','--config',path.join(qa,'jest.historical.json'),'--runInBand','--no-cache',...(mode==='--list'?['--listTests','--json']:['--json','--outputFile',path.join(work,'historical-results.json')])];
const result=spawnSync(process.execPath,args,{cwd:'/workspace/Project-Cortex',env:process.env,encoding:'utf8',timeout:60000});
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');if(result.status!==0){process.exit(result.status??1);}
const f=loadFreeze();
if(mode==='--list'){
 const discovered=JSON.parse(result.stdout);assert.deepEqual(discovered.sort(),[...f.expectedTests].sort(),'DISCOVERY_CHANGED');fs.writeFileSync(path.join(qa,'discovery.json'),JSON.stringify({scope:'HISTORICAL_ONLY',discovered,expected:f.expectedTests,exact:true},null,2)+'\n');
}else{
 const r=JSON.parse(fs.readFileSync(path.join(work,'historical-results.json'),'utf8'));
 assert.equal(r.numTotalTests,78);assert.equal(r.numPassedTests,78);assert.equal(r.numFailedTests,0);assert.equal(r.numPendingTests,0);assert.equal(r.numTodoTests,0);assert.equal(r.numRuntimeErrorTestSuites,0);assert.equal(r.numTotalTestSuites,4);
 const counts=f.expectedTests.map(p=>r.testResults.find(x=>x.name===p)?.assertionResults.length);assert.deepEqual(counts,[74,1,1,2]);
 const imports=fs.readFileSync(path.join(work,'imports.ndjson'),'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));
 assert.ok(imports.some(x=>x.resolved===path.join(catalogQA,'catalog/convex-dev/runtimeGateway.ts')));assert.ok(imports.some(x=>x.resolved===path.join(catalogQA,'catalog/src/domain/model-policy.ts')));assert.ok(imports.some(x=>x.resolved===path.join(catalogQA,'catalog/src/domain/profile.ts')));
 assert.ok(imports.every(x=>x.verified));assert.ok(!imports.some(x=>x.resolved==='/workspace/Project-Cortex/convex-dev/runtimeGateway.ts'));assert.ok(!imports.some(x=>/runtimeModelPolicy(?:Bootstrap)?\.[jt]s$/.test(x.resolved)));
 fs.writeFileSync(path.join(qa,'historical-results.json'),JSON.stringify(r,null,2)+'\n');fs.writeFileSync(path.join(qa,'import-verification.json'),JSON.stringify({scope:'HISTORICAL_ONLY',observations:imports,verifiedResolutions:imports.length,uniqueModules:[...new Set(imports.map(x=>x.resolved))],noCurrentGateway:true,noLedgerOrBootstrapRuntime:true,counts},null,2)+'\n');
 console.log(JSON.stringify({scope:'HISTORICAL_ONLY',passed:78,counts,failed:0,pending:0,todo:0,verifiedImports:imports.length,currentGatewayQualification:'NOT_RUN'}));
}
verify();
