import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {fileURLToPath} from 'node:url';
import {readExact,inspectAncestors} from './containment.mjs';
import {execute} from './private-compose.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const root='/workspace/Project-Cortex';
inspectAncestors(base);
const pinned=JSON.parse(readExact(path.join(base,'source-pre.json'),'81f5aa3db369433a701b64aea0a613cdb3a0fa01e43211f9b214abeb2d881a50').toString()).sources;
const H=text=>crypto.createHash('sha256').update(text).digest('hex');
const pins=new Map(pinned.map(r=>[r.path,r.sha256]));
const approvedBytes=readExact(path.join(base,'approved-additions.json'),'0f0c4f0ea80d9ec768ccd6c4dd53331d5071c7279341a35ef21ad66bfb97178b');
assert.equal(H(approvedBytes),'0f0c4f0ea80d9ec768ccd6c4dd53331d5071c7279341a35ef21ad66bfb97178b','Fixed source-derived approved native export bytes');
const approved=JSON.parse(approvedBytes);
for(const [name,expected] of Object.entries({'convex-dev/schema.ts':'b95bdd8b643b9d8d7f3d6ed2770181cff15e116110af3b3648bb4492e58495c2','convex-dev/runtimePolicySchema.ts':'4467a4d4e424fa57cd07de95bce702108765747cfb6afa8a0756fea253926534','convex-dev/runtimeModelPolicy.ts':'c8279d4496eb9b6eb5763732dbb7e54cefe27e028f285fe3e31a639af1535710','convex-dev/runtimeGateway.ts':'e796e43aafe70c37d8af7330a969e5b643eb58e86be7621cc7c08991ff1224be'}))assert.equal(pins.get(name),expected,'Accepted source pin');
export const POLICY_NAMES=Object.freeze(['ensureBudget','installDeploymentPolicy','provisionTenantPolicy','resolve','admit','checkpoint','markVisible','captureTerminalEvidence','attachTerminalResult','reconcileDeploymentLiability','settle','recover','releaseNotDispatched','cancelBudget','admitFallback','checkFallback']);
export const TABLE_NAMES=Object.freeze(['runtimeModelPolicies','runtimeModelQualifications','runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts']);
const importLine='import { runtimePolicyTables } from "./runtimePolicySchema";\n';
const spreadLine='  ...runtimePolicyTables,\n';
export function baselineProjection(source){
 for(const line of [importLine,spreadLine])assert.equal(source.split(line).length-1,1,'Exactly one approved additive line');
 const baseline=source.replace(importLine,'').replace(spreadLine,'');
 assert.equal(H(baseline),'07df1b0be4647848a3e9fbd1eb9d27d81ad78194f77d3c447c7ee4f2de419b1d','Exact26 baseline bytes');return baseline;
}
export function verifySources(current){
 for(const [name,text] of Object.entries(current))assert.equal(H(text),pins.get(name),`Exact pinned source ${name}`);
 return baselineProjection(current['convex-dev/schema.ts']);
}
export function policyAst(source){
 const ast=ts.createSourceFile('runtimeModelPolicy.ts',source,ts.ScriptTarget.Latest,true);const found=[];const calls=[];
 const aliases=new Map();
 for(const n of ast.statements)if(ts.isImportDeclaration(n)&&n.moduleSpecifier.text==='./_generated/server'&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings))for(const b of n.importClause.namedBindings.elements)aliases.set(b.name.text,b.propertyName?.text??b.name.text);
 function visit(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&aliases.has(n.expression.text))calls.push(n);ts.forEachChild(n,visit)}visit(ast);
 for(const n of ast.statements){assert.ok(!(ts.isExportDeclaration(n)&&n.moduleSpecifier),'No re-export');if(!ts.isVariableStatement(n)||!n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))continue;
  for(const d of n.declarationList.declarations){if(d.initializer&&calls.includes(d.initializer)){const kind=aliases.get(d.initializer.expression.text);assert.ok(['internalQuery','internalMutation'].includes(kind),'INTERNAL only');found.push({path:`runtimeModelPolicy:${d.name.text}`,kind,visibility:'internal'});calls.splice(calls.indexOf(d.initializer),1)}}
 }
 assert.equal(calls.length,0,'All builder calls resolved');assert.deepEqual(found.map(r=>r.path.split(':')[1]),POLICY_NAMES);return found;
}
export function verifyNative(native,baseline){
 assert.deepEqual(native.additions,approved.tables,'Every additive validator/index/search/vector exact');
 assert.deepEqual(native.policyRegistrations,approved.registrations,'Every16 additive native validator/returns/visibility exact');
 assert.deepEqual(native.additions.map(r=>r.table),TABLE_NAMES,'Approved five tables only');
 const old=native.definitions.filter(r=>!TABLE_NAMES.includes(r.table));assert.equal(old.length,26);assert.deepEqual(old,baseline.definitions,'Every26 validator/index/search/vector unchanged');
 assert.equal(native.definitions.length,old.length+TABLE_NAMES.length);
 for(const addition of native.additions)assert.deepEqual(native.definitions.find(r=>r.table===addition.table),addition,'Exact fragment native definition');
 const sequences=[];for(const row of native.definitions)for(const [i,index] of row.indexes.entries()){assert.ok(!row.indexes.slice(i+1).some(other=>JSON.stringify(index.fields)===JSON.stringify(other.fields)),`Duplicate ${row.table}`);sequences.push(index)}assert.equal(sequences.length,184);
 assert.deepEqual(native.artifactRegistrations,baseline.registrations,'All prior artifact args/returns/visibility');
 assert.deepEqual(Object.keys(native.policyRegistrations).sort(),[...POLICY_NAMES].sort());for(const r of Object.values(native.policyRegistrations)){assert.equal(r.isInternal,true);assert.equal(r.isPublic,undefined);assert.equal(JSON.parse(r.args).type,'object')}
 assert.equal(native.rootLookup,null);assert.equal(native.forgedRootTrusted,false);
 return {baselineTables:old.length,additiveTables:native.additions.length,currentTables:native.definitions.length,indexes:sequences.length,policyInternal:POLICY_NAMES.length};
}
function composeWithControls(destination,controls={}){
 assert.ok(controls&&Object.getPrototypeOf(controls)===Object.prototype);
 for(const key of Reflect.ownKeys(controls)){assert.ok(typeof key==='string'&&['sourceRoot','instrument','failAt','childFault'].includes(key),'UNKNOWN_CONTROL_OPTION');assert.ok('value' in Object.getOwnPropertyDescriptor(controls,key),'CONTROL_ACCESSOR_DENIED')}
 const sourceRoot=controls.sourceRoot??root;
 assert.equal(typeof sourceRoot,'string');if(sourceRoot!==root)assert.ok(path.resolve(sourceRoot).startsWith(base+path.sep)||path.resolve(sourceRoot).startsWith(root+'/work/resume/task04-current-catalog-composition-c2/'),'CONTROL_SOURCE_SCOPE');
 inspectAncestors(sourceRoot);
 // Immutable pin/metadata reads happen before execute performs any allocations.
 const sources=Object.fromEntries(['convex-dev/schema.ts','convex-dev/runtimePolicySchema.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeGateway.ts'].map(name=>[name,readExact(path.join(sourceRoot,name),pins.get(name)).toString()]));
 const projection=verifySources(sources);const policy=policyAst(sources['convex-dev/runtimeModelPolicy.ts']);
 return execute({base,root,pinned,destination,projection,policy,...controls,buildResult:({native,nativeBaseline,baseline,historical,policy,dest})=>{
 const totals=verifyNative(native,nativeBaseline);
 assert.deepEqual(historical.completeness.unresolved,[]);assert.ok(!historical.endpoints.some(r=>r.path.startsWith('runtimeModelPolicy:')));
 baseline.exactCurrentRepair.nativeWitness=path.join(dest,'exact-current-repair-native.json');
 const selected=historical.endpoints.filter(r=>/^(?:governance|admin|graphSync):/.test(r.path));assert.equal(selected.length,25);assert.equal(selected.filter(r=>r.visibility==='public').length,7);assert.equal(selected.filter(r=>r.visibility==='internal').length,18);
 const policyEndpoints=policy.map(r=>({...r,disposition:'retain-internal',nativeContract:native.policyRegistrations[r.path.split(':')[1]],requiredCapability:r.path.endsWith(':installDeploymentPolicy')?'trusted installed deployment manifest internal bootstrap':r.path.endsWith(':reconcileDeploymentLiability')?'internal deployment liability reconciliation through exact stored operation reference':r.path.endsWith(':provisionTenantPolicy')?'verified tenant-wide admin reference, strict policy/root rules, current final fences':'pinned verified runtime or stored operation authority and current account/source/attempt fences',scope:'requires trusted installed actual root (current registry EMPTY) plus exact canonical request, budget and receipt; no public caller installation',resourceLookup:'runtime policy/qualification/accounts/operations/attempts; source/revision/scope fences',ownership:'trusted ROOT or exact stored authority; internal visibility is not a runtime credential',sourceHash:pins.get('convex-dev/runtimeModelPolicy.ts')}));
 const inventory={...historical,classification:'CURRENT_COMPOSITION_OFFLINE_ONLY',additivePolicySourceHash:pins.get('convex-dev/runtimeModelPolicy.ts'),baselineCompleteness:historical.completeness,completeness:{...historical.completeness,counts:{...historical.completeness.counts,modules:historical.completeness.counts.modules+1,registered:historical.endpoints.length+16,internal:historical.completeness.counts.internal+16,registeredBuilderCalls:historical.completeness.counts.registeredBuilderCalls+16,resolvedExports:historical.completeness.counts.resolvedExports+16},sourceHashes:[...historical.completeness.sourceHashes.map(r=>r.file==='convex-dev/schema.ts'?{...r,sha256:pins.get('convex-dev/schema.ts')}:r),{file:'convex-dev/runtimeModelPolicy.ts',sha256:pins.get('convex-dev/runtimeModelPolicy.ts')}],unresolved:[]},endpoints:[...historical.endpoints,...policyEndpoints]};
 const result={...baseline,currentComposition:{sourceHash:pins.get('convex-dev/schema.ts'),baselineProjectionHash:H(projection),soleAdditiveLines:[importLine,spreadLine],fragmentHash:pins.get('convex-dev/runtimePolicySchema.ts'),policyHash:pins.get('convex-dev/runtimeModelPolicy.ts'),totals,baselineEndpoints:historical.endpoints.length,currentEndpoints:inventory.endpoints.length,selected25Preserved:true,nativeWitness:path.join(dest,'current-native.json')},classification:'NEW_CURRENT_OFFLINE_COMPOSITION_SOURCE_SERIALIZED_HOLD',nativeService:'NOT_RUN'};
 return {composition:result,inventory};
 }});
}
export function compose(destination){return composeWithControls(destination)}
/** Fixture-only dependency seam; never accepted by the CLI/default source path. */
export function composeForControls(destination,controls){return composeWithControls(destination,controls)}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert.ok(process.argv[2]);console.log(JSON.stringify(compose(process.argv[2])))}
