import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { payloadHash, stableJson } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/packages/cortex-templates/scripts/assemble.mjs';
const r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const q=path.dirname(new URL(import.meta.url).pathname);
const kit='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-managed-source-2026-10-14';
const commit='9fb9687536af0b7abfcb7280e0aa26ef450051ea';
assert.match(commit,/^[a-f0-9]{40}$/,'Root accepted commit GO required');
const receipt=JSON.parse(fs.readFileSync(path.join(q,'artifact-receipt.json')));
assert.equal(receipt.sourceCommit,commit);
const ts=createRequire(path.join(r,'package.json'))('typescript');
const pack=receipt.packages.find(p=>p.role==='catalog');assert.equal(pack.name,'@cortexmemory/templates');assert.equal(pack.version,'1.3.3');
const archive=path.join(kit,'artifacts',commit,pack.filename);
const scratch=fs.mkdtempSync(path.join(q,'catalog-contract-'));
const digest=b=>createHash('sha256').update(b).digest('hex');
let result;
try {
 execFileSync('tar',['-xzf',archive,'-C',scratch]);
 const base=path.join(scratch,'package'),catalogBytes=fs.readFileSync(path.join(base,'catalog.json'));
 const committedCatalog=execFileSync('git',['show',commit+':packages/cortex-templates/catalog.json'],{cwd:r,maxBuffer:2*1024*1024});
 assert.deepEqual(catalogBytes,committedCatalog);
 const catalog=JSON.parse(catalogBytes),target=catalog.templates.find(t=>t.id==='vercel-ai-quickstart'&&t.version==='1.4.2');assert(target);assert.equal(target.files.length,74);
 const priorCatalog=JSON.parse(execFileSync('git',['show','126231a0102936998837dd14a64a77d2b4d09785:packages/cortex-templates/catalog.json'],{cwd:r,maxBuffer:2*1024*1024}));
 const k21CatalogBytes=execFileSync('git',['show','03256989da22bde35dff78023c1c3962391a68c6:packages/cortex-templates/catalog.json'],{cwd:r,maxBuffer:2*1024*1024});
 assert.equal(priorCatalog.templates.length,13);const retained=JSON.parse(k21CatalogBytes);assert.equal(retained.templates.length,14);
 assert.equal(catalog.templates.length,15);for(const prior of retained.templates)assert.deepEqual(catalog.templates.find(t=>t.id===prior.id&&t.version===prior.version),prior,'Historical immutable template tuple changed');
 const basic=catalog.templates.find(t=>t.id==='basic'&&t.version==='1.4.2');assert(basic);assert.equal(basic.files.length,38);assert.equal(basic.payloadHash,'b8a0e0ba1e266ec68abe45c0c0ae2dee16f963a35bd3805dd1c564cd98db99c1');
 const basicBytes=new Map();for(const file of basic.files){const physical=file.storagePath??file.path;assert(!physical.startsWith('/')&&!physical.split('/').includes('..'));const b=fs.readFileSync(path.join(base,'payloads/basic/1.4.2',physical));assert.equal(b.length,file.bytes,file.path);assert.equal(digest(b),file.hash,file.path);const source=execFileSync('git',['show',commit+':packages/cortex-cli/templates/basic/'+file.path],{cwd:r,maxBuffer:2*1024*1024});if(file.path==='package.json'){const canonical=JSON.parse(source);assert.equal(canonical.dependencies['@cortexmemory/sdk'],'file:../../../..');canonical.dependencies['@cortexmemory/sdk']='^0.39.0';assert.deepEqual(b,Buffer.from(stableJson(canonical)+'\n'));}else assert.deepEqual(b,source);basicBytes.set(file.path,b);}
 assert.equal(payloadHash(basicBytes),basic.payloadHash);assert.equal(JSON.parse(basicBytes.get('package.json')).version,'1.4.2');
 assert(catalog.templates.some(t=>t.id==='basic'&&t.version==='1.4.1'));
 const bytes=new Map();
 for(const file of target.files){
  const physical=file.storagePath??file.path;
  assert(!physical.startsWith('/')&&!physical.split('/').includes('..'));
  const name=path.join(base,'payloads/vercel-ai-quickstart/1.4.2',physical);
  assert(fs.lstatSync(name).isFile());const b=fs.readFileSync(name);assert.equal(b.length,file.bytes,file.path);assert.equal(digest(b),file.hash,file.path);bytes.set(file.path,b);
 }
 assert.equal(payloadHash(bytes),target.payloadHash);assert.equal(target.payloadHash,'ec60588d69878eb8f8ea45f53e0844e7b619ca183416fc62e4182942df3e0025');
 const app=JSON.parse(bytes.get('package.json'));assert.equal(app.version,'1.4.2');assert.equal(app.devDependencies['@testing-library/react'],'16.3.3');assert.equal(app.devDependencies['jest-environment-jsdom'],'30.5.2');
 assert.equal(app.dependencies['@cortexmemory/sdk'],'^0.39.0');assert.equal(app.dependencies['@cortexmemory/vercel-ai-provider'],'^0.39.0');
 const component=bytes.get('components/RuntimeQuickstart.tsx'),test=bytes.get('tests/unit/runtime-observation.test.ts');
 for(const [name,b]of [['components/RuntimeQuickstart.tsx',component],['tests/unit/runtime-observation.test.ts',test]]){
  const source=execFileSync('git',['show',commit+':packages/vercel-ai-provider/quickstart/'+name],{cwd:r,maxBuffer:2*1024*1024});assert.deepEqual(b,source);
 }
 const ast=ts.createSourceFile('RuntimeQuickstart.tsx',component.toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let watchRunCalls=0,watchObservationCalls=0,finalOnlyLiteral=false,setRunCallback=false;
 let onObservationCallback=false,retainedRunGuard=false;
 function visit(node){
  if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='onObservation'&&ts.isArrowFunction(node.initializer))onObservationCallback=node.initializer.body.getText(ast).includes('setRun(value.run)')&&node.initializer.body.getText(ast).includes('setApprovals(value.approvals)');
  if(ts.isIfStatement(node)&&node.expression.getText(ast)==='!handle || disconnected || retainedRunId !== handle.runId')retainedRunGuard=ts.isReturnStatement(node.thenStatement);
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
   if(node.expression.name.text==='watchRun')watchRunCalls++;
   if(node.expression.name.text==='watchObservation'){
    watchObservationCalls++;const callback=node.arguments[1];setRunCallback=ts.isArrowFunction(callback)&&callback.body.getText(ast)==='setRun(value.run)';
    const options=node.arguments[3];finalOnlyLiteral=ts.isObjectLiteralExpression(options)&&options.properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(ast)==='finalOnly'&&p.initializer.kind===ts.SyntaxKind.TrueKeyword);
   }
  }ts.forEachChild(node,visit);
 }visit(ast);assert.equal(watchRunCalls,0);assert.equal(watchObservationCalls,1);assert(finalOnlyLiteral&&setRunCallback);assert(onObservationCallback&&retainedRunGuard);
 result={sourceCommit:commit,actualFreshCatalogArchiveSha256:pack.sha256,catalogSha256:digest(catalogBytes),templateId:target.id,templateVersion:target.version,selectedPayloadFiles:target.files.length,payloadHash:target.payloadHash,allSelectedPayloadBytesMatchCatalog:true,exactQaDevPins:{'@testing-library/react':'16.3.3','jest-environment-jsdom':'30.5.2'},actualCommittedUiAndNewFixtureBytes:true,retainedUiFinalObserverCalls:watchObservationCalls,removedUiWatchRunCalls:watchRunCalls,finalOnlyOptionAndStatusCallbackPresent:true,transportObservationCallbackAndRetainedOnlyGuardPresent:onObservationCallback&&retainedRunGuard,historicalImmutableTuplesPreserved:priorCatalog.templates.length,k21ImmutableDescriptorsByteExact:14,newBasicVersion:basic.version,newBasicFiles:basic.files.length,newBasicPayloadHash:basic.payloadHash,newBasicCanonicalBytesMatch:true,basicManifestTransform:'official rewriteManifest SDK file:../../../.. to ^0.39.0 plus stableJson; no assembly invocation',totalDescriptors:15,browserRenderOrFreshDependencyInstallProven:false,servicesStarted:0,inferenceCalls:0};
} finally { fs.rmSync(scratch,{recursive:true,force:true}); }
assert.equal(fs.existsSync(scratch),false);result.ownedScratchRemoved=true;
fs.writeFileSync(path.join(q,'packed-template-catalog.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
