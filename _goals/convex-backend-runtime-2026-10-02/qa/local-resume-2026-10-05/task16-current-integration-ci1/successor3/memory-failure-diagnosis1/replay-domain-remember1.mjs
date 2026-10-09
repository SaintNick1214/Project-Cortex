/** OFFLINE domain replay of retained bytes, using no-op repository controls.
 * Not current authorization, native inference, or a recovery/mutation claim. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rememberMemory } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryServices.ts';
import { DEFAULT_EMBEDDING_PROFILE } from '/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile.ts';
const q=dirname(fileURLToPath(import.meta.url)),priv='/Users/SaintNick/.codex/tmp/cortex-task16-ci-native-5b5ba39cd23b';
const read=async name=>JSON.parse(await readFile(join(priv,name),'utf8'));
const state=JSON.parse(await readFile(join(q,'outcomes1.json'),'utf8'));
const a=(await read('successor3-memory-failure-runtimeModelAttempts1.private.json')).find(x=>x._id===state.attempts[0]._id);
const source=(await read('successor3-memory-failure-runtimeMemorySources1.private.json')).find(x=>x._id===state.sources[0]._id);
const operation=(await read('successor3-memory-failure-runtimeModelOperations1.private.json')).find(x=>x._id===state.operations[0]._id);
const actual=JSON.parse(JSON.parse(a.privateResultCanonical).text);
const calls={authorityNoOp:0,persistNoOp:0,sourceReadNoOp:0,retainedResultExtract:0,embed:0,commit:0};
const adapters={repository:{scope:operation.reference,recheckAuthority:async()=>{calls.authorityNoOp++;},putSource:async()=>{calls.persistNoOp++;return{source,created:false};},getSource:async()=>{calls.sourceReadNoOp++;return source;},commitDerived:async()=>{calls.commit++;throw new Error('OFFLINE_COMMIT_MUST_NOT_OCCUR');}},model:{resolveProfile:async()=>({profile:DEFAULT_EMBEDDING_PROFILE}),extract:async()=>{calls.retainedResultExtract++;return actual;},embed:async()=>{calls.embed++;throw new Error('OFFLINE_EMBED_MUST_NOT_OCCUR');}},clock:{now:()=>source.createdAt}};
let code=null,sourceFrames=[],outcome='RETURNED';
try{await rememberMemory(adapters,{text:source.content,lineage:source.lineage});}catch(error){outcome='THREW';code=/^([A-Z_]+):/.exec(String(error.message))?.[1]??error.name;sourceFrames=[...new Set(String(error.stack).match(/(?:runtimeMemoryServices|sources)\.(?:js|ts):\d+:\d+/g)??[])];}
assert.equal(outcome,'THREW');assert.equal(code,'INVALID_INPUT');assert.equal(calls.retainedResultExtract,1);assert.equal(calls.embed,0);assert.equal(calls.commit,0);
const receipt={status:'OFFLINE_RETAINED_ACTUAL_REMEMBER_REFUSAL_CONFIRMED',attemptId:a._id,privateResultSha256:createHash('sha256').update(a.privateResultCanonical).digest('hex'),outcome,code,sourceFrames,offlineAdapterCalls:calls,extraResultFields:Object.keys(actual).filter(key=>key!=='facts'),extraSchemaKeywordType:typeof actual.additionalProperties,extraSchemaKeywordIsFalse:actual.additionalProperties===false,serviceRequests:0,modelRequests:0,mutations:0,scope:'Same actual result passed unchanged through real rememberMemory/extractSourceFacts/parseSourceFactsResponse. Repository checks are explicit no-op offline fixture controls; no current authority/commit/recovery is claimed.'};
await writeFile(join(q,'retained-remember-replay1.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
