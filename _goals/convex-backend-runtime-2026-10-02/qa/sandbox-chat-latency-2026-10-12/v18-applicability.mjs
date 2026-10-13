import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import ts from '../../../../node_modules/typescript/lib/typescript.js';
import {qualificationGroups,modes,sha,evaluateOutcome,evaluateFinancialStep} from '/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/sandbox-env/qualification.mjs';
const root=new URL('../../../../',import.meta.url), q=new URL('./',import.meta.url);
const sessionRoot='/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/.sandbox-env-runs/719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b/';
const receiptRoot=path.join(sessionRoot,'receipts');
const json=async name=>JSON.parse(await fs.readFile(path.join(receiptRoot,name),'utf8'));
const session=JSON.parse(await fs.readFile(path.join(sessionRoot,'session.json'),'utf8'));
const manifest=await json('candidate-final-manifest.json'), evidence=await json('actual-qualification-evidence.json');
assert.equal(sha(manifest),evidence.candidateManifestSha256);
assert.equal(evidence.actualSuccessfulMethods,8);assert.equal(evidence.dispatches,8);assert.equal(evidence.aggregateUsdComplete,false);
const records=[];
let before=await json('paid-batch-baseline.json');
for(const mode of modes){
 const rawBytes=await fs.readFile(path.join(receiptRoot,'raw-'+mode+'.json')), entry=evidence.entries.find(value=>value.mode===mode);
 assert.equal(sha(rawBytes),entry.sha256);assert.equal(rawBytes.length,entry.bytes);
 const raw=JSON.parse(rawBytes),issued=await json('issued-'+mode+'.json'),outcome=await json('outcome-'+mode+'.json');
 evaluateOutcome(mode,raw);
 assert.equal(issued.mode,mode);assert.equal(issued.maximumNewRequests,1);assert.equal(issued.noAutomaticRetry,true);
 assert.equal(issued.procedureApprovalDigest,evidence.procedureApprovalDigest);
 assert.equal(outcome.status,'ACTUAL_METHOD_AUTOMATIC_EVALUATION_PASS');assert.equal(outcome.newAttempts,1);assert.equal(outcome.observedActual,true);
 const after=await json('after-'+mode+'.json');evaluateFinancialStep(before,after,mode);before=after;
 records.push({mode,path:entry.path,sha256:entry.sha256,bytes:entry.bytes,issuedAt:issued.issuedAt,maximumNewRequests:1,newAttempts:1,
   nativeInterface:raw.terminalReceipts?.[0]?.receipt.nativeInterface,terminalCapturedAt:raw.terminalReceipts?.[0]?.capturedAt,
   usage:raw.terminalReceipts?.[0]?.receipt.usage,actualAutomaticOutcome:true});
}
const groups=[];
for(const group of qualificationGroups){
 const proof=manifest.dispatchEvidence[group.index],qualification=manifest.qualifications[group.index];
 const entries=group.modes.map(mode=>evidence.entries.find(entry=>entry.mode===mode));
 const raws=await Promise.all(group.modes.map(mode=>json('raw-'+mode+'.json')));
 assert.equal(sha(entries),proof.evidenceHash);assert.equal(proof.evidenceHash,proof.inputBound.proofHash);assert.equal(proof.evidenceHash,proof.resultBound.proofHash);
 assert.equal(proof.receiptId,qualification.receiptId);assert.equal(proof.inputBound.featureEnvelope,group.envelope);
 assert.equal(proof.checkedAt,Math.min(...raws.map(raw=>raw.terminalReceipts?.[0]?.capturedAt??raw.completedAt)));
 assert.equal(proof.expiresAt,Math.min(proof.checkedAt+7*86400000,evidence.target.expiresAt));assert.ok(Date.now()<proof.expiresAt);
 const relevant=evidence.pins.sourcePins.filter(row=>proof.nativeInterface==='image'?/image|ai-sdk-provider/.test(row.path)
  :proof.nativeInterface==='embedding'?/embedding|ai-sdk-provider/.test(row.path):/chat|ai-sdk-provider|post-to-api|runtimeGateway|runtimeMemoryGateway|model_policy/.test(row.path));
 assert.equal(sha(relevant),proof.inputBound.nativeTransformHash);
 groups.push({index:group.index,modes:group.modes,receiptId:proof.receiptId,evidenceHash:proof.evidenceHash,checkedAt:proof.checkedAt,expiresAt:proof.expiresAt,
  boundRevision:proof.boundRevision,priceRevision:proof.priceRevision,featureEnvelope:proof.inputBound.featureEnvelope,nativeTransformHash:proof.inputBound.nativeTransformHash});
}
const normalizeExecutable=text=>{
 const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext,removeComments:true}}).outputText;
 const source=ts.createSourceFile('normal.js',js,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const transformed=ts.transform(source,[context=>node=>ts.visitNode(node,function visit(value){
   if(ts.isImportDeclaration(value)&&ts.isStringLiteral(value.moduleSpecifier)&&value.moduleSpecifier.text.startsWith('.')){
    const name=path.basename(value.moduleSpecifier.text).replace(/\.(?:js|ts)$/,'').replaceAll('-','_');
    return ts.factory.updateImportDeclaration(value,value.modifiers,value.importClause,ts.factory.createStringLiteral(name),value.attributes);
   }
   return ts.visitEachChild(value,visit,context);
 })]);
 const normalized=ts.createPrinter({removeComments:true}).printFile(transformed.transformed[0]);transformed.dispose();return normalized;
};
function compareUnchangedBodies(local,current,historical){
 const parse=value=>ts.createSourceFile('executable.js',normalizeExecutable(value),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const old=parse(historical),changed=parse(current),printer=ts.createPrinter({removeComments:true});
 const functions=source=>new Map(source.statements.filter(ts.isFunctionDeclaration).map(node=>[node.name.text,node]));
 const oldFunctions=functions(old),newFunctions=functions(changed),checks=[];
 const compare=(name,a,b)=>{assert.ok(a&&b,'Required original contract body missing');
  const original=printer.printNode(ts.EmitHint.Unspecified,a,old),next=printer.printNode(ts.EmitHint.Unspecified,b,changed);
  assert.equal(sha(next),sha(original),local+' original body changed: '+name);checks.push({name,sha256:sha(original),unchanged:true});};
 for(const [name,node]of oldFunctions)if(!(local.endsWith('runtimeGateway.ts')&&name==='stateFor'))compare(name,node.body,newFunctions.get(name)?.body);
 if(local.endsWith('runtimeGateway.ts')){
  const nested=node=>new Map(node.body.statements.filter(ts.isFunctionDeclaration).map(value=>[value.name.text,value]));
  const original=nested(oldFunctions.get('stateFor')),next=nested(newFunctions.get('stateFor'));
  for(const [name,node]of original)if(name!=='admit')compare('stateFor.'+name,node.body,next.get(name)?.body);
 }
 if(local.endsWith('runtimeModelPolicy.ts')){
  for(const name of ['admit','checkpoint']){
   const declaration=old.statements.filter(ts.isVariableStatement).flatMap(node=>node.declarationList.declarations).find(node=>node.name.getText(old)===name);
   const handler=declaration.initializer.arguments[0].properties.find(node=>node.name.getText(old)==='handler').initializer;
   compare(name+' extracted original handler',handler.body,newFunctions.get(name+'Handler')?.body);
  }
 }
 return checks;
}
const sourceChecks=[];
const currentNested=new URL('node_modules/@ai-sdk/openai-compatible/node_modules/@ai-sdk/provider-utils/src/post-to-api.ts',root);
const qualifiedNested=path.join(session.backendDir,'node_modules/@ai-sdk/openai-compatible/node_modules/@ai-sdk/provider-utils/src/post-to-api.ts');
const currentNestedBytes=await fs.readFile(currentNested),qualifiedNestedBytes=await fs.readFile(qualifiedNested);
assert.equal(sha(currentNestedBytes),sha(qualifiedNestedBytes),'Actual resolved OpenAI-compatible transport changed');
sourceChecks.push({path:'resolved-openai-compatible/provider-utils/post-to-api.ts',sha256:sha(currentNestedBytes),currentDependencyBytesMatch:true});
for(const pin of evidence.pins.sourcePins){
 const installed=pin.path.startsWith('host/')?path.join(session.backendDir,pin.path.slice(5)):path.join(session.backendDir,'node_modules',pin.path);
 const bytes=await fs.readFile(installed);assert.equal(sha(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);
 let currentDependencyBytesMatch, currentExecutableMatch;
 if(!pin.path.startsWith('host/')){
  const current=await fs.readFile(new URL('node_modules/'+pin.path,root),'utf8');currentDependencyBytesMatch=sha(current)===pin.sha256;
  if(!currentDependencyBytesMatch){
   assert.equal(pin.path,'@ai-sdk/provider-utils/src/post-to-api.ts','Unexpected unqualified dependency drift');
   assert.equal(normalizeExecutable(current),normalizeExecutable(bytes.toString('utf8')),'Native post body executable changed');
   currentExecutableMatch=true;
  }
 }
 sourceChecks.push({path:pin.path,sha256:pin.sha256,actualPinnedBytes:true,currentDependencyBytesMatch,currentExecutableMatch});
}
for(const [local,installed]of [['convex-dev/runtimeGateway.ts','convex/runtimeGateway.ts'],['convex-dev/runtimeMemoryGateway.ts','convex/runtimeMemoryGateway.ts'],
 ['src/domain/model-policy.ts','convex/_cortex/shared/domain/model_policy.ts'],['src/domain/sources.ts','convex/_cortex/shared/domain/sources.ts'],['convex-dev/runtimeModelPolicy.ts','convex/runtimeModelPolicy.ts']]){
 const current=await fs.readFile(new URL(local,root),'utf8'), qualified=await fs.readFile(path.join(session.backendDir,installed),'utf8');
 const historical=execFileSync('git',['show','b0b4d3e454f5a13560ac9474b5fb2a397bb5cd2b:'+local],{cwd:new URL(root),encoding:'utf8'});
 assert.equal(sha(normalizeExecutable(historical)),sha(normalizeExecutable(qualified)),local+' actual baseline installed executable mismatch');
 if(['convex-dev/runtimeGateway.ts','convex-dev/runtimeModelPolicy.ts'].includes(local)){
  const bodyChecks=compareUnchangedBodies(local,current,historical);
  sourceChecks.push({path:local,sha256:sha(current),qualifiedBaselineSha256:sha(historical),qualifiedBaselineBytesUnchanged:current===historical,
   installedBaselineExecutableMatchesAfterTypeRemovalAndImportRelocation:true,unchangedOriginalBodyChecks:bodyChecks,
   separateBatchDelta:local.endsWith('runtimeGateway.ts')?'Optional Agent-only admit/checkpoint composition; original native request/wire, usage/output and model wrappers unchanged. Its source gate is separate.':'Original admit/checkpoint body extraction only; source gate separate.'});
 }else{
  assert.equal(current,historical,local+' current source differs from actual qualified source baseline');
  sourceChecks.push({path:local,sha256:sha(current),qualifiedBaselineBytesUnchanged:true,installedExecutableMatchesAfterTypeRemovalAndImportRelocation:true});
 }
}
for(const pin of evidence.pins.packagePins){
 const bytes=await fs.readFile(path.join(session.backendDir,'node_modules',pin.name,'package.json'));
 assert.equal(sha(bytes),pin.packageSha256);assert.equal(JSON.parse(bytes).version,pin.version);
 const currentVersion=JSON.parse(await fs.readFile(new URL('node_modules/'+pin.name+'/package.json',root),'utf8')).version;
 if(currentVersion!==pin.version){
  assert.equal(pin.name,'@ai-sdk/provider','Unexpected native package drift');
  for(const sourcePath of ['convex-dev/runtimeGateway.ts','convex-dev/runtimeMemoryGateway.ts','node_modules/@convex-dev/ai-sdk-provider/src/index.ts']){
   const text=await fs.readFile(new URL(sourcePath,root),'utf8');
   const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;
   const parsed=ts.createSourceFile('erased.js',js,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
   assert.equal(parsed.statements.some(row=>ts.isImportDeclaration(row)&&row.moduleSpecifier.text==='@ai-sdk/provider'),false,'Type-only provider became a runtime import');
  }
  for(const consumer of ['ai','@ai-sdk/openai-compatible']){
   const localRequire=createRequire(new URL('node_modules/'+consumer+'/package.json',root));
   const qualifiedRequire=createRequire(path.join(session.backendDir,'node_modules',consumer,'package.json'));
   const localPackage=JSON.parse(await fs.readFile(localRequire.resolve('@ai-sdk/provider/package.json'),'utf8'));
   const qualifiedPackage=JSON.parse(await fs.readFile(qualifiedRequire.resolve('@ai-sdk/provider/package.json'),'utf8'));
   assert.equal(localPackage.version,qualifiedPackage.version);
   const localHash=sha(await fs.readFile(localRequire.resolve('@ai-sdk/provider'))),qualifiedHash=sha(await fs.readFile(qualifiedRequire.resolve('@ai-sdk/provider')));
   assert.equal(localHash,qualifiedHash,'Actual consumer provider executable changed');
   sourceChecks.push({path:consumer+' resolved @ai-sdk/provider',version:localPackage.version,sha256:localHash,currentDependencyBytesMatch:true});
  }
  sourceChecks.push({path:'top-level @ai-sdk/provider/package.json',currentVersion,qualifiedRecordedVersion:pin.version,typeOnlyCoreAndFactoryImports:true,
   actualConsumerExecutableBytesMatch:true,nominalPackageLayoutMismatch:true});
 }
}
const output={version:1,passed:true,candidateManifestSha256:evidence.candidateManifestSha256,sourceCommit:'b0b4d3e454f5a13560ac9474b5fb2a397bb5cd2b',
 actualSuccessfulMethods:8,proofGroups:7,finiteQualificationExpiry:evidence.qualificationExpiresAt,sourceChecks,groups,records,
 originalActualManifestRoot:{manifestId:manifest.manifestId,revision:manifest.revision,artifactRevision:manifest.artifactRevision,evidenceHash:manifest.evidenceHash,acceptanceHash:manifest.acceptanceHash},
 noNewInference:true,noServiceReads:true,aggregateUsdComplete:false,fullUnknownLiabilityUnits:evidence.fullUnknownLiabilityUnits,
 rawPrivatePromptResultCopied:false,note:'Existing local receipts/source files inspected only; original issuer/session/Proofs artifacts remain unchanged. Source equivalence removes types and normalizes only relocated relative import basenames.'};
await fs.writeFile(new URL('v18-applicability.json',q),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,actualSuccessfulMethods:8,proofGroups:7,sourceChecks:sourceChecks.length,candidateManifestSha256:evidence.candidateManifestSha256,finiteQualificationExpiry:evidence.qualificationExpiresAt}));
