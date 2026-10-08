import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
const root=process.cwd();const goal='_goals/convex-backend-runtime-2026-10-02/qa/';const qa=goal+'task03-foundation-catalog-repair';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');const json=file=>JSON.parse(read(file));const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
function catalog(text) {
 const ast=ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);const rows=[];
 for(const statement of ast.statements) {
  if(!ts.isVariableStatement(statement)||!statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))continue;
  for(const declaration of statement.declarationList.declarations) {
   const call=declaration.initializer;if(!ts.isIdentifier(declaration.name)||!call||!ts.isCallExpression(call)||!ts.isIdentifier(call.expression))continue;
   if(!['query','mutation','internalQuery','internalMutation','action','internalAction'].includes(call.expression.text))continue;
   rows.push({name:declaration.name.text,builder:call.expression.text,text:declaration.getText(ast),statement:statement.getText(ast)});
  }
 }
 return rows;
}
const accepted22=json(goal+'task03b2f-asset-foundation/original/accepted22.json');
const assetFreeze=json(goal+'task03b2f-asset-foundation/candidate/source-hashes.json');
const assetOriginalFreeze=json(goal+'task03b2f-asset-foundation/original/source-hashes.json');
const statsFreeze=json(goal+'task03b2b2-stats/frozen-uniform-closure.json');
const historicalArtifact=read(goal+'task03b2f-asset-foundation/original/artifacts.ts');
assert.equal(hash(historicalArtifact),assetOriginalFreeze['convex-dev/artifacts.ts']);
const acceptedAsset=read(goal+'task03b2f-asset-foundation/candidate/convex-dev/artifacts.ts.text');
assert.equal(hash(acceptedAsset),assetFreeze['convex-dev/artifacts.ts']);
const sources=Object.fromEntries(['artifacts','agents','memorySpaces','runtimeRegistryStats'].map(name=>[name,read(`convex-dev/${name}.ts`)]));
function verify(current) {
 const artifacts=catalog(current.artifacts);const expected=catalog(acceptedAsset);assert.equal(artifacts.length,27);
 const names=new Set(accepted22.map(row=>row.path.split(':')[1]));
 for(const row of artifacts) {
  assert.equal(row.text,expected.find(x=>x.name===row.name)?.text,`Current approved declaration ${row.name}`);
  if(names.has(row.name))assert.equal(row.statement,accepted22.find(x=>x.path===`artifacts:${row.name}`)?.declaration,`Selected22 preservation ${row.name}`);
 }
 assert.equal(artifacts.filter(x=>names.has(x.name)).length,22);assert.equal(artifacts.filter(x=>!names.has(x.name)).length,5);
 for(const name of ['agents','memorySpaces','runtimeRegistryStats'])assert.equal(hash(current[name]),statsFreeze[`convex-dev/${name}.ts`],`Uniform statistics approved source ${name}`);
 return {selected22:22,approvedLaterFileDeclarations:5,approvedLaterStats:2,artifactModuleRegistrations:27,registryModuleRegistrations:48};
}
const counts=verify(sources);
let negativeControls=0;
for(const [name,needle] of [['artifacts','artifactHandler(async () => {'],['artifacts','runtimeAssetUnavailable('],['agents','statisticsUnavailable('],['memorySpaces','statisticsUnavailable(']]) {
 assert.ok(sources[name].includes(needle));const bad={...sources,[name]:sources[name].replace(needle,needle+'/* unauthorized tampering */')};assert.throws(()=>verify(bad));negativeControls++;
}
assert.ok(process.argv[2],'Owned scratch destination required');const destination=path.resolve(process.argv[2]);fs.mkdirSync(destination,{recursive:true});
// Original inventory code and its old assertions execute unchanged against the accepted pre-asset source.
const replica=path.join(destination,'historical-artifact');const oldBase=goal+'task03b2c1';
fs.mkdirSync(path.join(replica,'convex-dev'),{recursive:true});fs.mkdirSync(path.join(replica,oldBase),{recursive:true});
fs.writeFileSync(path.join(replica,'convex-dev/artifacts.ts'),historicalArtifact);
for(const file of ['inventory.mjs','frozen-catalog.json','excluded-baseline.ts.text'])fs.copyFileSync(path.join(root,oldBase,file),path.join(replica,oldBase,file));
fs.symlinkSync(path.join(root,'node_modules'),path.join(replica,'node_modules'),'dir');
const original=JSON.parse(execFileSync(process.execPath,[path.join(replica,oldBase,'inventory.mjs'),path.join(replica,'output')],{cwd:replica,encoding:'utf8'}));
assert.deepEqual(original.counts,{registered:22,public:21,internal:1,unresolved:0,pendingFileRegistrations:5});assert.ok(original.frozenFilePaths.every(x=>x.unchanged));
const result={status:'PASS',scope:'OFFLINE_CATALOG_COMPOSITION',counts,negativeControls,historicalOriginalInventory:original,liveService:'NOT_RUN'};
fs.writeFileSync(path.join(destination,'composition.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
