import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const qa=path.dirname(new URL(import.meta.url).pathname),root='/workspace/Project-Cortex';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const f=JSON.parse(fs.readFileSync(path.join(qa,'current-freeze.json'),'utf8'));const config=JSON.parse(fs.readFileSync(path.join(qa,'jest.current.json'),'utf8'));
assert.deepEqual(config,f.config);assert.deepEqual(config.moduleNameMapper,{});assert.deepEqual(config.setupFiles,[]);assert.deepEqual(config.setupFilesAfterEnv,[]);
for(const row of f.files)assert.equal(hash(row.path),row.sha256,'FROZEN_SOURCE_CONFIG_CHANGED');
assert.equal(config.testMatch[0],path.join(root,'tests/unit/runtime/gateway-terminal-composition.test.ts'));assert.equal(config.testMatch.length,1);
fs.writeFileSync(path.join(f.work,'imports.ndjson'),'');
const mode=process.argv[2];assert.ok(['--list','--run'].includes(mode));
console.log('CURRENT_PREIMPORT_GUARD_PASS');
const argv=['--experimental-vm-modules',path.join(root,'node_modules/jest/bin/jest.js'),'--config',path.join(qa,'jest.current.json'),'--runInBand','--no-cache',...(mode==='--list'?['--listTests','--json']:['--json','--outputFile',path.join(f.work,'current-results.json')])];
const r=spawnSync(process.execPath,argv,{cwd:root,env:process.env,encoding:'utf8',timeout:60000});process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.status!==0)process.exit(r.status??1);
if(mode==='--list'){assert.deepEqual(JSON.parse(r.stdout),config.testMatch);fs.writeFileSync(path.join(qa,'current-discovery.json'),r.stdout);}
else{const result=JSON.parse(fs.readFileSync(path.join(f.work,'current-results.json'),'utf8'));assert.equal(result.numTotalTests,result.numPassedTests);assert.ok(result.numTotalTests>=109);assert.equal(result.numPendingTests,0);assert.equal(result.numTodoTests,0);assert.equal(result.numRuntimeErrorTestSuites,0);assert.equal(result.numTotalTestSuites,1);
 const imports=fs.readFileSync(path.join(f.work,'imports.ndjson'),'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));assert.ok(imports.some(x=>x.resolved===path.join(root,'convex-dev/runtimeGateway.ts')));assert.ok(imports.every(x=>x.verified&&!x.resolved.includes('/catalog/')));fs.writeFileSync(path.join(qa,'current-results.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(qa,'current-imports.json'),JSON.stringify(imports,null,2)+'\n');console.log(JSON.stringify({scope:'CURRENT_OFFLINE_ONLY',passed:result.numPassedTests,skipped:0}));}
for(const row of f.files)assert.equal(hash(row.path),row.sha256,'POST_SOURCE_CONFIG_CHANGED');
