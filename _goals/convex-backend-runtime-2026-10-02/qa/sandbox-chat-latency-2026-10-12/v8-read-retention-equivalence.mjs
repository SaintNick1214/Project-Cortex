import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const baseline='3e55e7b9b45093f547699619c572fdbe09c1efde';
const root=process.cwd(), q=path.join(root,'_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12');
const results=[];
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function functions(file,text){const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);const map=new Map();for(const node of source.statements)if(ts.isFunctionDeclaration(node)&&node.name&&node.body)map.set(node.name.text,node.body.getText(source));return map;}
function check(file,name,oldBody,currentBody){const pass=oldBody===currentBody;results.push({file,name,pass,baselineBodySha256:digest(oldBody),candidateBodySha256:digest(currentBody)});}
for(const file of ['convex-dev/runtimeAgent.ts','convex-dev/runtimeAuth.ts','convex-dev/runtimeAgentQueryEmbedding.ts','convex-dev/runtimeAgentRecall.ts','convex-dev/runtimeMemoryContext.ts']){
 const old=functions(file,execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8',maxBuffer:2_000_000}));const current=functions(file,fs.readFileSync(path.join(root,file),'utf8'));
 for(const [name,body] of old){
  if(file.endsWith('runtimeAgent.ts')&&name.includes('V8'))continue;
  if(file.endsWith('runtimeAuth.ts')&&['createAuthorityReadScope','createNativeTranscriptReader'].includes(name))continue;
  let actual=current.get(name);if(actual===undefined)throw Error(`Missing original function ${file}:${name}`);
  if(file.endsWith('runtimeAgent.ts')&&name==='admitPreparedModelOperationHandler')actual=actual.replace('\n  if (expectedVersion === 8 && current.snapshot.version !== 8) transcriptDenied("INVALID_STATE");','');
  if(file.endsWith('runtimeAgent.ts')&&name==='executePreparedModelStep')actual=actual.replace('current.snapshot.version === 8 ? admitPreparedModelOperationV8Ref : refs.admitPreparedModelOperation','refs.admitPreparedModelOperation');
  if(file.endsWith('runtimeAgentQueryEmbedding.ts')){
   actual=actual.replace('\n  if (expectedVersion === 8 && current.snapshot.version !== 8) memoryError("INVALID_STATE", "V8 recall required");','');
   if(name==='admitAgentQueryEmbeddingHandler')actual=actual.replace('const { current, text } = await currentQuery(ctx, args);\n  const selected = await queryBinding(ctx, args, text, current.run.runBudgetId);','const { current, text } = await currentQuery(ctx, args), selected = await queryBinding(ctx, args, text, current.run.runBudgetId);');
  }
  if(file.endsWith('runtimeAgentRecall.ts')){
   actual=actual.replace('\n  if (expectedVersion === 8 && current.snapshot.version !== 8) memoryError("INVALID_STATE", "V8 recall required");','').replace('expectedVersion === 8 ? createV8AuthorityReadScope(nativeCtx) : createAuthorityReadScope(nativeCtx, { nativeTranscript: true, policyMetadata: true })','createAuthorityReadScope(nativeCtx, { nativeTranscript: true, policyMetadata: true })').replaceAll('currentRead(ctx, args, expectedVersion)','currentRead(ctx, args)');
  }
  if(file.endsWith('runtimeMemoryContext.ts')&&name==='readIndexedContextAvailability')actual=actual.replace('new ConvexMemoryRepository(ctx, args.reference, "read", undefined, { now: () => Date.now() }, profileReader)','new ConvexMemoryRepository(ctx, args.reference, "read")');
  check(file,name,body,actual);
 }
 if(file.endsWith('runtimeAgentQueryEmbedding.ts'))check(file,'new V8 Action differs only by three references',old.get('recallAgentMemory'),current.get('recallAgentMemoryV8').replaceAll('prepareV8Ref','prepareRef').replaceAll('admitV8Ref','admitRef').replace('finishAgentRecallV8(','finishAgentRecall('));
 if(file.endsWith('runtimeAgentRecall.ts'))check(file,'new V8 recall tail differs only by three references',old.get('finishAgentRecall'),current.get('finishAgentRecallV8').replaceAll('prepareV8Ref','prepareRef').replaceAll('matchesV8Ref','matchesRef').replace('deliveryV8Ref','memoryReferences.finalDelivery'));
}
const receipt={baseline,scope:'Source body equivalence with explicit V8 routing/factory/version masks; not native speed or default-mode writer proof',checks:results.length,passed:results.filter(value=>value.pass).length,failed:results.filter(value=>!value.pass),results};
fs.writeFileSync(path.join(q,'v8-read-retention-equivalence.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({checks:receipt.checks,passed:receipt.passed,failed:receipt.failed.map(value=>[value.file,value.name])}));process.exit(receipt.failed.length?1:0);
