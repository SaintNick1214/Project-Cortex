from pathlib import Path
import json,hashlib
root=Path('/workspace/Project-Cortex');qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-historical-catalog-preparation-c1';work=root/'work/resume/task04-gateway-historical-catalog-preparation-c1';catalog=qa/'catalog'
local=json.loads((qa/'local-catalog.json').read_text());official=json.loads((qa/'official-catalog.json').read_text())
mapper={r'^/workspace/Project-Cortex/convex-dev/runtimeGateway$':str(catalog/'convex-dev/runtimeGateway.ts'),r'^/workspace/Project-Cortex/src/domain/model-policy$':str(catalog/'src/domain/model-policy.ts'),r'^/workspace/Project-Cortex/src/domain/profile$':str(catalog/'src/domain/profile.ts'),r'^\./profile\.js$':str(catalog/'src/domain/profile.ts')}
tests=[str(qa/r['catalog']) for r in local['files'] if r['original'].endswith('.test.ts')]
config={'rootDir':str(root),'roots':[str(catalog)],'testEnvironment':'node','testMatch':tests,'extensionsToTreatAsEsm':['.ts'],'transform':{r'^.+\.tsx?$':['ts-jest',{'useESM':True,'diagnostics':False,'tsconfig':{'target':'ES2022','module':'ESNext','moduleResolution':'bundler','esModuleInterop':True,'skipLibCheck':True,'isolatedModules':True,'ignoreDeprecations':'6.0'}}]},'moduleNameMapper':mapper,'setupFiles':[],'setupFilesAfterEnv':[],'resolver':str(qa/'resolver.cjs'),'cache':False,'maxWorkers':1}
(qa/'jest.historical.json').write_text(json.dumps(config,indent=2)+'\n')
(qa/'expected-config.json').write_text(json.dumps(config,indent=2)+'\n')
freeze={'scope':'HISTORICAL_ONLY','local':local['files'],'official':official['files'],'packages':official['packages'],'config':config,'expectedTests':tests,'expectedOutcomes':78,'expectedSuiteOutcomes':[74,1,1,2]}
(qa/'freeze.json').write_text(json.dumps(freeze,indent=2)+'\n')
fh=hashlib.sha256((qa/'freeze.json').read_bytes()).hexdigest()
guard="""import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
export const root=ROOT;export const qa=QA;export const work=WORK;
const expectedFreezeHash=FREEZEHASH;
export const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export function inventory(folder){const out=[];for(const d of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,d.name);if(d.isSymbolicLink())throw Error('SYMLINK_DENIED');if(d.isDirectory())out.push(...inventory(p));else if(d.isFile())out.push(p);else throw Error('FILE_TYPE_DENIED');}return out.sort();}
export function loadFreeze(){assert.equal(hash(path.join(qa,'freeze.json')),expectedFreezeHash,'FREEZE_CHANGED');return JSON.parse(fs.readFileSync(path.join(qa,'freeze.json'),'utf8'));}
export function verify(config=JSON.parse(fs.readFileSync(path.join(qa,'jest.historical.json'),'utf8'))){
 const f=loadFreeze();assert.deepEqual(config,f.config,'MAPPING_OR_CONFIG_CHANGED');assert.deepEqual(inventory(path.join(qa,'catalog')),f.local.map(r=>path.join(qa,r.catalog)).sort(),'MISSING_OR_EXTRA_CATALOG_FILE');
 assert.deepEqual(inventory(path.join(qa,'official-preimages')),f.official.map(r=>path.join(qa,r.snapshot)).sort(),'MISSING_OR_EXTRA_OFFICIAL_FILE');
 for(const r of f.local){assert.equal(hash(path.join(qa,r.catalog)),r.sha256,'CATALOG_SOURCE_OR_TEST_CHANGED');if(r.original.endsWith('.test.ts'))assert.equal(hash(path.join(root,r.original)),r.sha256,'ORIGINAL_TEST_CHANGED');}
 for(const r of f.official){assert.equal(hash(r.path),r.sha256,'OFFICIAL_DEPENDENCY_CHANGED');assert.equal(hash(path.join(qa,r.snapshot)),r.sha256,'OFFICIAL_PREIMAGE_CHANGED');}
 return {scope:'HISTORICAL_ONLY',files:f.local.length+f.official.length,tests:f.expectedTests};
}
export function assertResolved(request,resolved){const f=loadFreeze();const row=f.local.find(r=>path.join(qa,r.catalog)===resolved)??f.official.find(r=>r.path===resolved);assert.ok(row,'UNCATALOGED_MODULE_RESOLUTION');assert.equal(hash(resolved),row.sha256,'RESOLVED_MODULE_CHANGED');return {request,resolved,sha256:row.sha256,verified:true};}
export function guardCurrentConfig(config){assert.equal((config.setupFiles??[]).length,0);assert.equal((config.setupFilesAfterEnv??[]).length,0);assert.ok(!config.resolver,'CURRENT_RESOLVER_MUST_BE_SEPARATELY_REVIEWED');assert.equal(Object.keys(config.moduleNameMapper??{}).length,0,'CURRENT_NO_HISTORICAL_ALIAS');for(const value of [...(config.roots??[]),...(config.testMatch??[])])assert.ok(!value.includes('historical')&&!value.includes('/catalog/'),'CURRENT_NO_HISTORICAL_SOURCE');return {scope:'CURRENT_GUARD_TEMPLATE_ONLY',testsExecuted:0};}
"""
for k,v in [('ROOT',str(root)),('QA',str(qa)),('WORK',str(work)),('FREEZEHASH',fh)]:guard=guard.replace(k,json.dumps(v))
(qa/'guard.mjs').write_text(guard)
resolver="""const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const qa=QA;const work=WORK;const freeze=JSON.parse(fs.readFileSync(path.join(qa,'freeze.json'),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(hash(path.join(qa,'freeze.json'))!==FREEZEHASH)throw Error('FREEZE_CHANGED');
const files=new Map([...freeze.local.map(r=>[path.join(qa,r.catalog),r.sha256]),...freeze.official.map(r=>[r.path,r.sha256])]);
module.exports=(request,options)=>{const resolved=options.defaultResolver(request,options);
 if(request.startsWith('node:'))return resolved;
 const expected=files.get(resolved);if(!expected)throw Error('UNCATALOGED_MODULE_RESOLUTION:'+resolved);
 const actual=hash(resolved);if(actual!==expected)throw Error('RESOLVED_MODULE_CHANGED:'+resolved);
 fs.appendFileSync(path.join(work,'imports.ndjson'),JSON.stringify({request,basedir:options.basedir,resolved,sha256:actual,verified:true})+'\\n');return resolved;};
"""
for k,v in [('QA',str(qa)),('WORK',str(work)),('FREEZEHASH',fh)]:resolver=resolver.replace(k,json.dumps(v))
(qa/'resolver.cjs').write_text(resolver)
current={'rootDir':str(root),'roots':[str(root/'tests/unit/runtime')],'testMatch':[],'moduleNameMapper':{},'setupFiles':[],'setupFilesAfterEnv':[]}
(qa/'current-guard-template.json').write_text(json.dumps(current,indent=2)+'\n')
print(json.dumps({'tests':tests,'officialPackages':len(official['packages']),'officialFiles':len(official['files']),'freezeHash':fh}))
