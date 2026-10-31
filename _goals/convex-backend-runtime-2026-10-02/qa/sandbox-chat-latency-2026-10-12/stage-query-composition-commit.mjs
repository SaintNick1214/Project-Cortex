import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile),q=path.dirname(new URL(import.meta.url).pathname);
const r='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const sha=x=>createHash('sha256').update(x).digest('hex');
const frozen={
 'convex-dev/runtimeAgent.ts':'d2d108e0e019d94e846acf1ea875b8ad7202edbf6bb52e061129b29fc36f7ddd',
 'convex-dev/runtimeMemoryContext.ts':'6c3ecab80b4953e0e4f3c94ca4396217ab5a51738da1ab3bb29163450deaa070',
 'convex-dev/runtimeModelPolicy.ts':'c4a76cef99abffd103004345d93643f184a835ef5a29a3d5142305a33ef2e921',
 'tests/unit/runtimeAgent/model-owner.test.ts':'58244b0cdfae21138a0feaf7b32bfd5070553814b3bdbcad8308aa4bb17c2659',
 'tests/unit/runtimeAgent/resolution-composition.test.ts':'53a3aa58e2f80f9bdd7efe33f2993c8bb67c9ce90290ec0b21d4f1b7cbc5daf4',
 'tests/unit/runtimeAgent/context-source-composition.test.ts':'f4e3dc440cd33929cd82f2dd6943a05fe090d34dfc44b4d0f9119768d4758c4a'};
for(const [name,hash]of Object.entries(frozen))assert.equal(sha(await fs.readFile(r+'/'+name)),hash,name);
assert.equal(sha(await fs.readFile(q+'/cloud-query-composition-source-review.md')),'b35add945c147f4728ce566a691babde481a7bd5548c04a1699da94b63c846ed');
assert.equal((await execute('git',['diff','--cached','--name-only'],{cwd:r})).stdout.trim(),'','Do not mix an existing staged change');
const selected=[...Object.keys(frozen),'_goals/convex-backend-runtime-2026-10-02/qa/execution-progress.md'];
const localBacking=[];
for(const sub of ['', 'browser']){
 for(const name of await fs.readdir(path.join(q,sub))){
  const owned=sub==='browser'?/^k10-/.test(name):/^(?:k10-|capture-k10-|verify-k10-|prepare-k10-|record-k10-|cloud-k10-|cloud-agent-resolution-composition|cloud-context-source-composition|cloud-query-composition-source-review|prepare-query-composition-kit-controls|query-composition-kit-control-baseline|stage-query-composition-commit|service-log-snapshot-179191|run-chain-(?:1bda782038b6|3f3407144833|d72401624d04|f7718e7e768e))/.test(name);
  if(!owned)continue;
  const absolute=path.join(q,sub,name),stat=await fs.lstat(absolute);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink());
  const bytes=await fs.readFile(absolute),relative=path.relative(r,absolute);
  const include=bytes.length<=262144;
  localBacking.push({path:relative,bytes:bytes.length,sha256:sha(bytes),includedInThisCommit:include,backing:include?'Git candidate':'Original local QA file only; hash is not recoverable content'});
  if(include)selected.push(relative);
 }
}
for(const name of ['status.json','completion-notices.jsonl'])selected.push(path.relative(r,q+'/'+name));
const manifest={observedAt:new Date().toISOString(),scope:'Exact reviewed source plus owned bounded K10/implementation/review receipts',sourceReview:'cloud-query-composition-source-review.md',frozen,
  localBacking,largeEvidencePolicy:'Preserve every original local file; omit oversized receipts from Git. No transport, historical custody or content-recovery claim.',unrelatedWork:'workflow-trace-repair-report.md, work/resume, sibling repositories and other untracked evidence excluded'};
const manifestPath=q+'/query-composition-commit-evidence-manifest.json';
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});selected.push(path.relative(r,manifestPath));
await execute('git',['add','-f','--',...selected],{cwd:r,maxBuffer:2_000_000});
console.log(JSON.stringify({stagedFiles:selected.length,sourceFiles:Object.keys(frozen).length,oversizedRetainedLocally:localBacking.filter(v=>!v.includedInThisCommit).length,unrelatedStaged:false}));
