import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion', q=path.dirname(new URL(import.meta.url).pathname);
const ts=createRequire(path.join(r,'package.json'))('typescript');
const kit='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-turn-consolidation-2026-10-13';
const commit='2c8689fac3aca2acf1fb1f46d8b10a87388e95cd';
const artifact=JSON.parse(fs.readFileSync(path.join(q,'artifact-receipt.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(kit,'staging',commit,'dist/backend/v1/manifest.json')));
const archive=path.join(kit,'artifacts',commit,artifact.packages.find(p=>p.role==='sdk').filename);
const digest=b=>createHash('sha256').update(b).digest('hex');
function exportsOf(text,name) {
 const ast=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS); const names=[];
 for(const statement of ast.statements) {
  if(!statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)) continue;
  if(ts.isVariableStatement(statement)) for(const d of statement.declarationList.declarations) {assert(ts.isIdentifier(d.name)); names.push(d.name.text);}
  else if(statement.name && ts.isIdentifier(statement.name)) names.push(statement.name.text);
 }
 return names;
}
const paths=['convex-dev/agentDefinitions.ts','convex-dev/runtimeAgent.ts','convex-dev/runtimeAuth.ts','convex-dev/runtimeMemoryRepository.ts','convex-dev/runtimeMemoryServices.ts','convex-dev/runtimeModelPolicy.ts','convex-dev/runtimeClient.ts','convex-dev/runtimeMemory.ts'];
const files=paths.map(sourcePath=>{
 const row=manifest.files.find(f=>f.sourcePath===sourcePath); assert(row);
 const committed=execFileSync('git',['show',commit+':'+sourcePath],{cwd:r,maxBuffer:2*1024*1024});
 const packed=execFileSync('tar',['-xOf',archive,'package/dist/backend/v1/'+row.path],{maxBuffer:2*1024*1024});
 assert.equal(digest(committed),row.sourceSha256); assert.equal(digest(packed),row.sha256);
 const names=exportsOf(packed.toString(),row.path); assert.deepEqual(names,exportsOf(committed.toString(),sourcePath));
 if(sourcePath==='convex-dev/runtimeAuth.ts') for(const name of ['createAuthorityReadScope','readDeploymentPolicyRows','readQualificationRows','freshPolicyMetadataReads']) assert(names.includes(name),name);
 if(sourcePath==='convex-dev/runtimeAgent.ts') for(const name of ['executeTurn','executeTurnV2','executeTurnV3','executeTurnV4','prepareRoutedContext','prepareEmptyContext','contextSource','resolveModelOperation','admitModelOperation','onInitialWorkflowComplete','executeTurnV5','prepareTurnModel','prepareResolvedModelOperation','admitPreparedModelOperation','turnStepV5','turnStepV5Handler']) assert(names.includes(name),name);
 return {sourcePath,outputPath:row.path,sourceSha256:row.sourceSha256,packedOutputSha256:row.sha256,exportNames:names,exactCommittedExportsPreserved:true};
});
const receipt={sourceCommit:commit,files,rawAuthorityFactoryExportPresent:true,allHistoricalAndNewAgentParentsPresent:true,actualV5ParentAndTurnExportsPresent:true,actualFreshSdkArchive:true,serviceCalls:0};
fs.writeFileSync(path.join(q,'packed-backend-export-closure.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({sourceCommit:commit,checkedChangedBackendRoots:files.length,allExportsPreserved:true}));
