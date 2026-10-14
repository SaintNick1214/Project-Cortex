import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const q=`${r}/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12`;
const baseline='6156ea97aa8776accee52879176cdcd12e802d89';
const hash=value=>createHash('sha256').update(value).digest('hex');
const edits={
 'convex-dev/runtimeAgent.ts':[
  ['export const hydrateExecution = internalQuery({ args: agentAttempt, handler: async (ctx, args) => await executionContext(createAuthorityReadScope(ctx, { nativeTranscript: true }), args) });',
   'export const hydrateExecution = internalQuery({ args: agentAttempt, handler: async (ctx, args) => await executionContext(ctx, args) });'],
  ['export const recordOutput = internalMutation({ args: { ...agentAttempt, parts: v.array(v.any()) }, handler: async (nativeCtx, args) => {\n  const ctx = createAuthorityReadScope(nativeCtx, { nativeTranscript: true });\n',
   'export const recordOutput = internalMutation({ args: { ...agentAttempt, parts: v.array(v.any()) }, handler: async (ctx, args) => {\n'],
 ],
 'convex-dev/runtimeModelPolicy.ts':[
  ['export const markVisible = internalMutation({ args: { ...attemptArgs, ...visibilityFields }, handler: async (nativeCtx, args) => {\n  const ctx = createAuthorityReadScope(nativeCtx, { nativeTranscript: true, policyMetadata: true });\n',
   'export const markVisible = internalMutation({ args: { ...attemptArgs, ...visibilityFields }, handler: async (ctx, args) => {\n'],
 ],
};
const entries=[];
for(const file of [...Object.keys(edits),'convex-dev/runtimeMemory.ts','convex-dev/runtimeAuth.ts','convex-dev/runtimeTranscript.ts']){
 const before=execFileSync('git',['show',`${baseline}:${file}`],{cwd:r,encoding:'utf8'}),current=readFileSync(`${r}/${file}`,'utf8');let inverse=current;
 for(const [added,original] of edits[file]??[]){assert.equal(inverse.split(added).length,2,`Exactly one scope addition: ${file}`);inverse=inverse.replace(added,original);}
 assert.equal(inverse,before,`Full original module byte equality after removing only scope constructors: ${file}`);
 entries.push({file,baselineSha256:hash(before),currentSha256:hash(current),inverseSha256:hash(inverse),inverseByteEqual:true,scopeConstructors:edits[file]?.length??0});
}
const receipt={baseline,entries,claims:['Only three explicitly scoped registration boundaries differ.','All original guards, body statements, validators, return values, writes, order and V1-V5 journal bodies are byte-identical.','finalDelivery, raw scope implementation, transcript logical reads and all source getters remain byte-identical.'],limits:['Literal source equivalence does not prove native OCC or latency.','Current/raw decisions are still recomputed; only the previously accepted reader is activated.']};
writeFileSync(`${q}/endpoint-raw-read-equivalence.json`,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({files:entries.length,scopeConstructors:3,inverseByteEqual:true}));
