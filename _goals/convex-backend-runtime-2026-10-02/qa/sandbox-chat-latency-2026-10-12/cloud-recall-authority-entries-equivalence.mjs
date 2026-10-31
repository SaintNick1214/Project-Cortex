import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const cwd='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion',q=`${cwd}/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12`,hash=x=>createHash('sha256').update(x).digest('hex');
const entries={runtimeMemory:['readFacts','checkProfileReady','readVectorMatches'],runtimeModelPolicy:['embeddingProfile','resolve','admit','checkpoint'],runtimeClient:['submitAndStart']};
const files=[];
for(const [name,names] of Object.entries(entries)){
 const before=readFileSync(`${q}/cloud-recall-authority-entries-${name}.preimage.ts`,'utf8'),after=readFileSync(`${cwd}/convex-dev/${name}.ts`,'utf8');
 let normalized=after.replace('import { createAuthorityReadScope } from "./runtimeAuth";\n','').replace('createAuthorityReader, recheckAuthority, createAuthorityReadScope','createAuthorityReader, recheckAuthority');
 for(const helper of ['resolve','admit','checkpoint','submitAndStart','observeEnvelope']) normalized=normalized.replace(`handler: (ctx, args) => ${helper}Handler(createAuthorityReadScope(ctx), args)`,`handler: ${helper}Handler`);
 normalized=normalized.replaceAll('createAuthorityReadScope(ctx)','ctx');
 files.push({path:`convex-dev/${name}.ts`,baselineSha256:hash(before),afterSha256:hash(after),scopedEntries:names,entireOriginalFileAfterRemovingOnlyEntryFactoryWiring:before===normalized});
}
const result={version:1,files,allOriginalHelperBodiesValidatorsCallOrderAndUnselectedRegistrationsUnchanged:files.every(x=>x.entireOriginalFileAfterRemovingOnlyEntryFactoryWiring),factoryOwnership:'Each selected registration constructs one explicit scope and passes its view to the original repository or handler. No factory/scope passed through RPC arguments or retained between invocations.',deferredDueToPreservedExistingSensitiveAssertions:['runtimeMemory:finalDelivery','runtimeClient:observeEnvelope'],sourceGetterAndSessionExceptions:['runtimeMemory:readSource','runtimeClient:session','runtimeAgent:contextSource'],productionScope:'No runtimeAgent/runtimeAuth product edits by this author; those bytes are independently owned.'};
writeFileSync(`${q}/cloud-recall-authority-entries-equivalence-final.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.allOriginalHelperBodiesValidatorsCallOrderAndUnselectedRegistrationsUnchanged,files:files.map(x=>({path:x.path,sha256:x.afterSha256}))}));if(!result.allOriginalHelperBodiesValidatorsCallOrderAndUnselectedRegistrationsUnchanged)process.exitCode=1;
