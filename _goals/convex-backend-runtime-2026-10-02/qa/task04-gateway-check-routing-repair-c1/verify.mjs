import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import ts from '../../../node_modules/typescript/lib/typescript.js';
import { defineSchema } from 'convex/server';
const qa = '_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-check-routing-repair-c1';
const read = p => JSON.parse(fs.readFileSync(p,'utf8'));
const old = 'tests/unit/runtime/gateway-dispatch.test.ts';
const current = 'tests/unit/runtime/gateway-terminal-composition.test.ts';
const declaration = 'tests/unit/runtime/convex-schema-test-types.d.ts';
const before = read(qa+'/evidence/discovery-before/stdout.txt');
const after = read(qa+'/evidence/discovery-after/stdout.txt');
const jb = read(qa+'/evidence/jest-discovery-before/stdout.txt').sort();
const ja = read(qa+'/evidence/jest-discovery-after/stdout.txt').sort();
assert.deepEqual(after.unitFiles, before.unitFiles);
assert.deepEqual(before.eslintIgnoredUnit, []);
assert.deepEqual(after.eslintIgnoredUnit, [old]);
assert.deepEqual(after.typeFiles.filter(p=>p!==declaration), before.typeFiles.filter(p=>p!==old));
assert(after.typeFiles.includes(current)); assert(after.typeFiles.includes(declaration));
assert.deepEqual(ja,jb.filter(p=>!p.endsWith('/'+old)));
assert(ja.some(p=>p.endsWith('/'+current)));
const oldHash = crypto.createHash('sha256').update(fs.readFileSync(old)).digest('hex');
assert.equal(oldHash,'fc58a25d9c5cf9526e65838ab1b25c4fcf5cda024885082a560e3cf6faa029f2');
const tc = ts.readConfigFile('tsconfig.json',ts.sys.readFile).config;
const tb = ts.readConfigFile(qa+'/preimages/tsconfig.json',ts.sys.readFile).config;
assert.deepEqual(tc,{...tb,exclude:[...tb.exclude,old]});
const {default: jc} = await import('../../../jest.config.mjs');
const {default: jbefore} = await import('../../../'+qa+'/preimages/jest.config.mjs');
const expectedIgnore = ['/node_modules/','^<rootDir>/tests/unit/runtime/gateway-dispatch\\.test\\.ts$'];
assert.deepEqual(jc,{...jbefore,testPathIgnorePatterns:expectedIgnore});
assert.deepEqual(jc.moduleNameMapper,jbefore.moduleNameMapper);
const regex = new RegExp(jc.testPathIgnorePatterns[1].replace('<rootDir>',process.cwd()));
assert(regex.test(process.cwd()+'/'+old));
for(const other of [current,'tests/unit/runtime/gateway-dispatchXtest.ts','tests/unit/runtime/gateway-dispatch.test.ts.extra','tests/unit/runtime/sub/gateway-dispatch.test.ts','tests/unit/runtime/model-policy-admission.test.ts']) assert(!regex.test(process.cwd()+'/'+other));
const controls = [];
function guard(config) { assert.deepEqual(config.testPathIgnorePatterns,expectedIgnore); assert.deepEqual(config.moduleNameMapper,jbefore.moduleNameMapper); }
for(const [name, modified] of [
 ['broad Gateway omission',{...jc,testPathIgnorePatterns:['/node_modules/','gateway-.*']}],
 ['hidden required current omission',{...jc,testPathIgnorePatterns:[...expectedIgnore,current]}],
 ['current historical mapping',{...jc,moduleNameMapper:{...jc.moduleNameMapper,'runtimeGateway':'historical/catalog'}}],
 ['missing exact historical routing',{...jc,testPathIgnorePatterns:['/node_modules/']}],
]) { assert.throws(()=>guard(modified)); controls.push({name,status:'denied'}); }
const instance=defineSchema({});
const descriptor=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(instance),'export');
assert.equal(typeof descriptor?.value,'function');
const exported=instance.export(); assert.equal(typeof exported,'string'); assert.deepEqual(JSON.parse(exported).tables,[]);
const configFiles={};
for(const filename of ['tsconfig.lint.json','tsconfig.build.json']) {
 const loaded=ts.readConfigFile(filename,ts.sys.readFile);
 const parsed=ts.parseJsonConfigFileContent(loaded.config,ts.sys,process.cwd());
 assert(!parsed.fileNames.some(p=>p.endsWith('/'+declaration)));
 configFiles[filename]={testDeclarationIncluded:false};
}
const sourceFile=ts.createSourceFile(declaration,fs.readFileSync(declaration,'utf8'),ts.ScriptTarget.Latest,true);
assert(sourceFile.isDeclarationFile);
assert(!fs.existsSync(declaration.replace(/\.d\.ts$/,'.js')));
console.log(JSON.stringify({status:'PASS_ROUTING_ONLY',unitBefore:jb.length,unitAfter:ja.length,onlyRemoved:old,currentIncluded:current,oldTestSHA256:oldHash,typeOnlyAdded:declaration,configFiles,prototypeExport:'actual installed SchemaDefinition.prototype.export returned string',declarationOnly:true,noJavaScriptGenerated:true,controls,testExecution:false,skips:[],historicalQualification:'inherited accepted 78/78, four suites, transpile-only; not rerun here'},null,2));
