import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const base=path.dirname(fileURLToPath(import.meta.url));
const root='/workspace/Project-Cortex';
const qa='_goals/convex-backend-runtime-2026-10-02/qa/';
const pinned=JSON.parse(fs.readFileSync(path.join(base,'source-pre.json'),'utf8')).sources;
const H=text=>crypto.createHash('sha256').update(text).digest('hex');
const read=(dir,name)=>fs.readFileSync(path.join(dir,name),'utf8');
const pins=new Map(pinned.map(r=>[r.path,r.sha256]));
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
export function compose(destination){
 const dest=path.resolve(destination);assert.ok(dest.startsWith(base+path.sep)||dest.startsWith(root+'/work/resume/task04-current-catalog-composition-c1/'),'Owned destination only');fs.mkdirSync(dest,{recursive:true});
 for(const r of pinned)assert.equal(H(fs.readFileSync(path.join(root,r.path))),r.sha256,`Current source drift ${r.path}`);
 const sources=Object.fromEntries(['convex-dev/schema.ts','convex-dev/runtimePolicySchema.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeGateway.ts'].map(name=>[name,read(root,name)]));
 const projection=verifySources(sources);const policy=policyAst(sources['convex-dev/runtimeModelPolicy.ts']);
 const replica=path.join(dest,'replica');fs.mkdirSync(replica,{recursive:true});
 for(const r of pinned){if(!r.path.startsWith('convex-dev/')&&!r.path.startsWith('src/')&&!r.path.startsWith(qa)&&!['package.json','convex.json'].includes(r.path))continue;const target=path.join(replica,r.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(base,'preimages',r.path),target)}
 fs.symlinkSync(path.join(root,'node_modules'),path.join(replica,'node_modules'),'dir');
 const env={PATH:'/usr/bin:/bin',TSX_DISABLE_CACHE:'1',NODE_OPTIONS:`--import ${path.join(base,'offline-guard.mjs')}`};
 const run=(args,cwd=replica)=>execFileSync(process.execPath,args,{cwd,env,encoding:'utf8',maxBuffer:16*1024*1024});
 const nativeFile=path.join(dest,'current-native.json');run(['--import','tsx',path.join(base,'native-probe.mts'),replica,nativeFile]);
 const native=JSON.parse(fs.readFileSync(nativeFile,'utf8'));
 fs.writeFileSync(path.join(replica,'convex-dev/schema.ts'),projection);
 const baseline=JSON.parse(run([qa+'task03-artifact-schema-index-repair/strict-compose.mjs',path.join(dest,'baseline-strict')]));
 const nativeBaseline=JSON.parse(fs.readFileSync(baseline.exactCurrentRepair.nativeWitness,'utf8'));const totals=verifyNative(native,nativeBaseline);
 // Exactly16 verified new registrations are separately classified, not dropped.
 fs.unlinkSync(path.join(replica,'convex-dev/runtimeModelPolicy.ts'));
 run([qa+'task03b2d/inventory.mjs',path.join(dest,'baseline-inventory')]);
 const historical=JSON.parse(fs.readFileSync(path.join(dest,'baseline-inventory/public-path-inventory.json'),'utf8'));
 assert.deepEqual(historical.completeness.unresolved,[]);assert.ok(!historical.endpoints.some(r=>r.path.startsWith('runtimeModelPolicy:')));
 const selected=historical.endpoints.filter(r=>/^(?:governance|admin|graphSync):/.test(r.path));assert.equal(selected.length,25);assert.equal(selected.filter(r=>r.visibility==='public').length,7);assert.equal(selected.filter(r=>r.visibility==='internal').length,18);
 const policyEndpoints=policy.map(r=>({...r,nativeContract:native.policyRegistrations[r.path.split(':')[1]],requiredCapability:['ensureBudget','installDeploymentPolicy','reconcileDeploymentLiability'].includes(r.path.split(':')[1])?'trusted deployment-operator internal invocation':'pinned verified runtime authority and current account/source/attempt fences',scope:'closed installed actual root plus exact canonical request, budget and receipt; no public caller installation',resourceLookup:'runtime policy/qualification/accounts/operations/attempts; source/revision/scope fences',ownership:'trusted ROOT or exact stored authority; internal visibility is not a runtime credential',sourceHash:pins.get('convex-dev/runtimeModelPolicy.ts')}));
 const inventory={...historical,classification:'CURRENT_COMPOSITION_OFFLINE_ONLY',additivePolicySourceHash:pins.get('convex-dev/runtimeModelPolicy.ts'),baselineCompleteness:historical.completeness,completeness:{...historical.completeness,counts:{...historical.completeness.counts,registered:historical.endpoints.length+16,internal:historical.completeness.counts.internal+16,registeredBuilderCalls:historical.completeness.counts.registeredBuilderCalls+16,resolvedExports:historical.completeness.counts.resolvedExports+16},sourceHashes:[...historical.completeness.sourceHashes,{file:'convex-dev/runtimeModelPolicy.ts',sha256:pins.get('convex-dev/runtimeModelPolicy.ts')}],unresolved:[]},endpoints:[...historical.endpoints,...policyEndpoints]};
 fs.writeFileSync(path.join(dest,'public-path-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
 const result={...baseline,currentComposition:{sourceHash:pins.get('convex-dev/schema.ts'),baselineProjectionHash:H(projection),soleAdditiveLines:[importLine,spreadLine],fragmentHash:pins.get('convex-dev/runtimePolicySchema.ts'),policyHash:pins.get('convex-dev/runtimeModelPolicy.ts'),totals,baselineEndpoints:historical.endpoints.length,currentEndpoints:inventory.endpoints.length,selected25Preserved:true,nativeWitness:nativeFile},classification:'NEW_CURRENT_OFFLINE_COMPOSITION_SOURCE_SERIALIZED_HOLD',nativeService:'NOT_RUN'};
 fs.writeFileSync(path.join(dest,'composition.json'),JSON.stringify(result,null,2)+'\n');return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert.ok(process.argv[2]);console.log(JSON.stringify(compose(process.argv[2])))}
