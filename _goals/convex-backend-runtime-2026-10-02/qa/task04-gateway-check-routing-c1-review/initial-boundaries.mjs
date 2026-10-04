import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from '../../../node_modules/typescript/lib/typescript.js';
import {ESLint} from '../../../node_modules/eslint/lib/api.js';
import {defineSchema} from 'convex/server';
const root=process.cwd(), subject=root+'/_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-check-routing-repair-c1', scratch=root+'/work/resume/task04-gateway-check-routing-c1-review';
const old='tests/unit/runtime/gateway-dispatch.test.ts', current='tests/unit/runtime/gateway-terminal-composition.test.ts', declaration='tests/unit/runtime/convex-schema-test-types.d.ts';
const cfg=f=>{const r=ts.readConfigFile(f,ts.sys.readFile);assert(!r.error);return r.config;};
const before=cfg(subject+'/preimages/tsconfig.json'),after=cfg('tsconfig.json');assert.deepEqual(after,{...before,exclude:[...before.exclude,old]});assert.equal(after.compilerOptions.strict,true);
const jestBefore=(await import(subject+'/preimages/jest.config.mjs')).default, jestAfter=(await import(root+'/jest.config.mjs')).default;
assert.deepEqual(jestAfter,{...jestBefore,testPathIgnorePatterns:['/node_modules/','^<rootDir>/tests/unit/runtime/gateway-dispatch\\.test\\.ts$']});
const lintBefore=(await import(subject+'/preimages/eslint.config.js')).default,lintAfter=(await import(root+'/eslint.config.js')).default;assert.deepEqual(lintAfter,[{ignores:[...lintBefore[0].ignores,old]},...lintBefore.slice(1)]);
const cases=[old,current,'tests/unit/runtime/gateway-dispatchXtest.ts','tests/unit/runtime/gateway-dispatch.testXts','tests/unit/runtime/gateway-dispatch.test.ts.bak','tests/unit/runtime/nested/gateway-dispatch.test.ts','tests/unit/runtime/Gateway-dispatch.test.ts','tests/unit/runtime/model-policy-admission.test.ts','other/tests/unit/runtime/gateway-dispatch.test.ts'];
const regex=new RegExp(jestAfter.testPathIgnorePatterns[1].replace('<rootDir>',root));const eslint=new ESLint();const pathResults=[];
for (const p of cases){const expected=p===old;assert.equal(regex.test(root+'/'+p),expected,p);assert.equal(await eslint.isPathIgnored(p),expected,p);pathResults.push({path:p,jestIgnored:expected,eslintIgnored:expected});}
const parsed=ts.parseJsonConfigFileContent(after,ts.sys,root);assert.equal(parsed.errors.length,0);const fileList=parsed.fileNames.map(p=>path.relative(root,p)).sort();assert(!fileList.includes(old));assert(fileList.includes(current));assert(fileList.includes(declaration));
const observed=JSON.parse(fs.readFileSync(subject+'/evidence/discovery-after/stdout.txt','utf8'));assert.deepEqual(fileList,observed.typeFiles);
for(const f of ['tsconfig.lint.json','tsconfig.build.json']){const c=ts.parseJsonConfigFileContent(cfg(f),ts.sys,root);assert(!c.fileNames.includes(root+'/'+declaration));}
const publicDts=fs.readFileSync(root+'/node_modules/convex/dist/esm-types/server/schema.d.ts','utf8');assert(publicDts.includes('class SchemaDefinition<Schema extends GenericSchema, StrictTableTypes extends boolean>'));assert(!publicDts.slice(publicDts.indexOf('class SchemaDefinition<'),publicDts.indexOf('export interface DefineSchemaOptions')).includes('export()'));
const runtimeSource=fs.readFileSync(root+'/node_modules/convex/src/server/schema.ts','utf8');assert(runtimeSource.includes('export(): string {'));const actual=defineSchema({});assert.equal(typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(actual),'export').value,'function');assert.deepEqual(JSON.parse(actual.export()).tables,[]);
const options={strict:true,noEmit:true,skipLibCheck:false,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,target:ts.ScriptTarget.ES2022,types:[],ignoreDeprecations:'6.0'};
const baseline=scratch+'/baseline.ts',positive=scratch+'/positive.ts';
fs.writeFileSync(baseline,'import { defineSchema } from "convex/server";\nconst s = defineSchema({});\ns.export();\n');
fs.writeFileSync(positive,'import { defineSchema, defineTable } from "convex/server";\nimport { v } from "convex/values";\nconst s = defineSchema({items:defineTable({name:v.string()})});\nconst text:string=s.export();\n// @ts-expect-error return type remains string\nconst wrong:number=s.export();\n// @ts-expect-error table names remain strict\ns.id("missing");\n// @ts-expect-error augmentation has no arbitrary methods\ns.fakeMethod();\ns.id("items");\n');
const diagnostic=files=>ts.getPreEmitDiagnostics(ts.createProgram(files,options)).map(d=>({code:d.code,file:d.file?.fileName,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
const bd=diagnostic([baseline]);assert.equal(bd.length,1,JSON.stringify(bd));assert.equal(bd[0].code,2339);const pd=diagnostic([positive,root+'/'+declaration]);assert.deepEqual(pd,[]);
const controls=[];for(const [name,modify] of [['broad historical omission',{...jestAfter,testPathIgnorePatterns:['gateway-.*']}],['current omission',{...jestAfter,testPathIgnorePatterns:[...jestAfter.testPathIgnorePatterns,current]}],['historical mapper',{...jestAfter,moduleNameMapper:{...jestAfter.moduleNameMapper,'runtimeGateway':'historical'}}],['old omission absent',{...jestAfter,testPathIgnorePatterns:['/node_modules/']}]] ) {assert.throws(()=>assert.deepEqual(modify,jestAfter));controls.push({name,denied:true});}
console.log(JSON.stringify({status:'PASS_CHECK_ROUTING_ONLY',node:process.version,configEqualityExceptExactRouting:true,strictUnchanged:true,pathResults,typeFiles:fileList,controls,baselineDiagnostics:bd,augmentedStrictDiagnostics:pd,skipLibCheckForIndependentDeclarationProbe:false,actualOfficialExportReturnsString:true,declarationNotIncludedInBuildOrLintTypeProject:true,noTestBodyExecution:true,skips:[]},null,2));
