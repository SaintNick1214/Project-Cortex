import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { payloadHash } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/packages/cortex-templates/scripts/assemble.mjs';
const r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const q=path.dirname(new URL(import.meta.url).pathname);
const kit='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-progress-source-batch-2026-10-13';
const commit='6156ea97aa8776accee52879176cdcd12e802d89';
const receipt=JSON.parse(fs.readFileSync(path.join(q,'artifact-receipt.json')));
assert.equal(receipt.sourceCommit,commit);
const ts=createRequire(path.join(r,'package.json'))('typescript');
const pack=receipt.packages.find(p=>p.role==='catalog');assert.equal(pack.name,'@cortexmemory/templates');assert.equal(pack.version,'1.3.1');
const archive=path.join(kit,'artifacts',commit,pack.filename);
const scratch=fs.mkdtempSync(path.join(q,'catalog-contract-'));
const digest=b=>createHash('sha256').update(b).digest('hex');
let result;
try {
 execFileSync('tar',['-xzf',archive,'-C',scratch]);
 const base=path.join(scratch,'package'),catalogBytes=fs.readFileSync(path.join(base,'catalog.json'));
 const committedCatalog=execFileSync('git',['show',commit+':packages/cortex-templates/catalog.json'],{cwd:r,maxBuffer:2*1024*1024});
 assert.deepEqual(catalogBytes,committedCatalog);
 const catalog=JSON.parse(catalogBytes),target=catalog.templates.find(t=>t.id==='vercel-ai-quickstart'&&t.version==='1.4.1');assert(target);assert.equal(target.files.length,74);
 const bytes=new Map();
 for(const file of target.files){
  const physical=file.storagePath??file.path;
  assert(!physical.startsWith('/')&&!physical.split('/').includes('..'));
  const name=path.join(base,'payloads/vercel-ai-quickstart/1.4.1',physical);
  assert(fs.lstatSync(name).isFile());const b=fs.readFileSync(name);assert.equal(b.length,file.bytes,file.path);assert.equal(digest(b),file.hash,file.path);bytes.set(file.path,b);
 }
 assert.equal(payloadHash(bytes),target.payloadHash);assert.equal(target.payloadHash,'235c967cc8d054aaa3639c6f48de6ae366d87f48f6998df4ac0d7480ab818909');
 const app=JSON.parse(bytes.get('package.json'));assert.equal(app.version,'1.4.1');assert.equal(app.devDependencies['@testing-library/react'],'16.3.3');assert.equal(app.devDependencies['jest-environment-jsdom'],'30.5.2');
 assert.equal(app.dependencies['@cortexmemory/sdk'],'^0.39.0');assert.equal(app.dependencies['@cortexmemory/vercel-ai-provider'],'^0.39.0');
 const component=bytes.get('components/RuntimeQuickstart.tsx'),test=bytes.get('tests/unit/runtime-observation.test.ts');
 for(const [name,b]of [['components/RuntimeQuickstart.tsx',component],['tests/unit/runtime-observation.test.ts',test]]){
  const source=execFileSync('git',['show',commit+':packages/vercel-ai-provider/quickstart/'+name],{cwd:r,maxBuffer:2*1024*1024});assert.deepEqual(b,source);
 }
 const ast=ts.createSourceFile('RuntimeQuickstart.tsx',component.toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let watchRunCalls=0,watchObservationCalls=0,finalOnlyLiteral=false,setRunCallback=false;
 function visit(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
   if(node.expression.name.text==='watchRun')watchRunCalls++;
   if(node.expression.name.text==='watchObservation'){
    watchObservationCalls++;const callback=node.arguments[1];setRunCallback=ts.isArrowFunction(callback)&&callback.body.getText(ast)==='setRun(value.run)';
    const options=node.arguments[3];finalOnlyLiteral=ts.isObjectLiteralExpression(options)&&options.properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(ast)==='finalOnly'&&p.initializer.kind===ts.SyntaxKind.TrueKeyword);
   }
  }ts.forEachChild(node,visit);
 }visit(ast);assert.equal(watchRunCalls,0);assert.equal(watchObservationCalls,1);assert(finalOnlyLiteral&&setRunCallback);
 result={sourceCommit:commit,actualFreshCatalogArchiveSha256:pack.sha256,catalogSha256:digest(catalogBytes),templateId:target.id,templateVersion:target.version,selectedPayloadFiles:target.files.length,payloadHash:target.payloadHash,allSelectedPayloadBytesMatchCatalog:true,exactQaDevPins:{'@testing-library/react':'16.3.3','jest-environment-jsdom':'30.5.2'},actualCommittedUiAndNewFixtureBytes:true,retainedUiFinalObserverCalls:watchObservationCalls,removedUiWatchRunCalls:watchRunCalls,finalOnlyOptionAndStatusCallbackPresent:true,transportSeparateOwnerPreservedByCommittedComponentIdentity:true,browserRenderOrFreshDependencyInstallProven:false,servicesStarted:0,inferenceCalls:0};
} finally { fs.rmSync(scratch,{recursive:true,force:true}); }
assert.equal(fs.existsSync(scratch),false);result.ownedScratchRemoved=true;
fs.writeFileSync(path.join(q,'packed-template-catalog.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
