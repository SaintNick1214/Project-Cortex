# Task Judgment: frozen memory-effort literal priority batch

## Verdict: REJECT

This is one independent non-author source/test review of the coherent 13-file batch in `SaintNick1214/Project-Cortex`, branch `feat/convex-backend-runtime-completion`, HEAD/base `e9a9fb7bdbc1db1901ad3bb7f42db4b534c08cad`. It is not hosted correctness/SLO acceptance or the final goal audit. The goal's acceptance policy v2 governs the scores; numerical cycle limits are waived, real assertions remain required.

## Evidence Review

Read repository `AGENTS.md`, runtime adapter, project profile, pessimistic-judge role, judge-task rubric, acceptance policy, the full 13-file diff and relevant surrounding admission/transcript/definition/repository paths. Read the original diagnosis/eligibility receipts and reports, browser summary, implementation report, raw Jest results/logs, type/lint exits, source patch and hashes. Verified both diagnosis receipt hashes and all 13 frozen file hashes. The source patch is exactly the current tracked diff plus the untracked new test: 43,815 bytes, SHA256 `b563c5c108dc4dde0bad0490b9dd6bd2aaff1a9af825cefc74a4c361494bab36`.

Raw evidence retains the actual failure: Fast cross-conversation run selected four prior question memories at score 1.000000238418579 and zero facts; apricot was absent from prepared/admitted input. The production source-selection receipt admits its current source at cutoff13. Browser response/memory completed but the answer was wrong and first visible text took5,427.5ms. The original ANN/fact candidate order was not recorded; no claim is made to reconstruct it.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Fast2/Normal4-default/High8/Max uncapped depth and 4/8/16/null optional entries, existing work/input/deadline limits | Yes, source scope | Presets unchanged; memory-effort and traversal test outcomes cover independent caps/depth and Max. |
| New effective ranking pin persisted; omitted snapshots preserve original behavior | Yes | Resolver binds pin; `runs.ts:82,111` persists only on new run. `runtimeTranscript.ts:425` captures stored effort. Paired Agent pin=true/false test checks prepared and admitted input; original score/fitting paths remain when absent. |
| All matching current literal values outrank repeated questions through actual traversal | **No** | LP-1: expanded matching conflicts carry the flag but queue selection ignores it after seed sorting. |
| Private priority survives V2 whole-request fitting; required pending/current/tool/notice coverage and actual overflow preserved | Yes | New fit test checks both pins, pending, cap and actual overflow; composition reaches prepared/admitted main request. |
| Ambiguous/negative/mismatched/noncurrent cases retain conservative behavior and governed fallback | Yes for covered scope | Pure negatives and correction checks; Agent/public composition checks semantic route and exactly one governed embedding peer; existing currentness/revocation tests remain intact. |
| Authority/provenance/model/budget/strict barriers, public capability2/1, transcript storage and replay preserved | Yes, scoped inspection | No changes to those controls; current bind/save/final admission checks remain. Existing negative composition tests and replay path inspected. This is not whole-goal certification. |
| Caller cannot forge private priority via reachable public inputs | Yes, scoped inspection | Save endpoints use `internalMutation`; public strict definition schema excludes ranking pin; memory request validators expose no priority knob. |
| Relevant outcome assertions cover changed behavior | **No** | Current added conflict test starts both conflicts as direct seeds. It never checks final retention of an edge-only literal conflict among high-scoring question seeds. |

## Issues Found

### Important — blocks this batch

**LP-1 [P2]: Apply priority to edge-discovered evidence before the entry cap.** `src/domain/memory-traversal.ts:25` sorts only initial seeds. `add()` at line23 appends all expanded nodes and line37 stops at the cap. `convex-dev/runtimeMemoryTraversal.ts:51` marks matching current facts after source/fact checks, including edges produced at lines74/91, but that flag cannot change their position behind remaining seeds.

I executed the actual frozen domain modules by transpiling them in memory with the installed TypeScript compiler and importing data URLs, using Node v24.15.0. No files, services or models were involved. Inputs: pinned Fast depth2/cap4; four repeated question seeds at1.000000238418579; one apricot exact-property seed at.7; apricot expansion returns plum as an exact-entity edge at.7. Both actual literal match calls returntrue. Observed:

```json
{"edgeInspected":true,"selected":["fact:apricot","source:q0","source:q1","source:q2"],"factIds":["apricot"],"visited":6,"stopReasons":["entries"]}
```

The matching plum fact is visited at depth2 but omitted in favor of questions, with capacity for both facts. The targeted outcome assertion exited1:

```javascript
assert.deepEqual(actualFactIds, ['apricot', 'plum'],
  'both currently matching property values should outrank repeated question memories within cap4');
```

The public added conflict regression places both facts in the initial fact plan. The earlier indexed-edge test checks fallback for a paraphrased assertion, without competing question seeds or an assertion that the final input preserves two explicit values. Neither detects LP-1.

### Critical security findings

None found in the reviewed changed paths. This does not assert full endpoint or hosted qualification.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment | 3/5 | Direct-seed and final-fit repair works; edge-discovered matching conflict priority is incomplete. |
| Code quality | 4/5 | Small additive pin and private typed flag; current fences and bounded processing retained. |
| Test quality | 3/5 | Meaningful positive/negative/legacy/overflow assertions, but mandatory edge branch missing and independently fails. |
| Pattern adherence | 4/5 | Domain comparator plus internal schema/save plumbing follows existing layering. |
| Completeness | 3/5 | Reachable seed/fitting behavior is wired; traversal priority does not cover accepted expanded nodes. |

**Average:3.4/5.** Requirements/test/completeness are below policy minima4. No average or numerical cycle limit overrides LP-1.

## Check Evidence

- Raw `tests2`:213/213 passed, six suites, zero pending/skipped, natural exit0. Raw `tests3`:28/28 passed, two suites, zero pending/skipped, natural exit0, including the final invalid-pin test. These are composed checks, not one final214-test invocation.
- Final `types2`:exit0; final `lint2`:exit0/zero warnings over all13 files. Initial pre-assertion test failure and warning-only lint failure remain preserved.
- Parent-owned combined build and packed contract receipts:exit0, natural exits. Reviewed their actual output, including root/runtime/graph ESM+CJS/browser and backend manifest checks; reviewer did not rerun them.
- Independent targeted edge-conflict assertion: **exit1**, expected both facts, actual onlyapricot. This is the blocking regression, not a passing test.

Unit logs explicitly disable graph service and use mocked/native fixtures with an inert Convex URL. No mocked result is claimed as live behavior. No original assertion was weakened by the frozen diff.

## Recommendation and Limits

Repair pinned retention/selection for already-discovered matching facts, preserving shortest permitted paths and every existing count/input/work/depth/deadline/authority/budget boundary. Preserve exact old omitted-pin behavior. Add an actual Agent or public composition regression with a matching current conflict discovered only through an allowed edge among high-scoring repeated-question seeds; assert both values reach selected/admitted input within cap4. Then rerun affected checks and review the repaired coherent batch.

Fresh installed correctness and numericalSLO outcomes remain pending separately. The original hosted failures remain failures. This review made no product edits, service calls, inference, deploys, commits, GitHub calls, other-chat messages or subjudges. Only the two permitted review artifacts were written; unrelated dirty QA/work/resume/P/W work was not edited.

## Exact Frozen Hashes Checked

- `src/domain/memory-effort.ts`: `4ed821962f63da02282875edaebbe0fc0bb82a426234a1d8fe4c7fa1eabddc1c`
- `src/domain/memory-direct-recall.ts`: `a03d252d9e6471b25d3407feb1443b9e21f716051a8ea220211f4b938ab8cc57`
- `src/domain/memory-traversal.ts`: `ca399ce0a37402ebaa6620fb6ae027761159aa9e92b7694718b372d6788bf544`
- `src/domain/model-input-selection.ts`: `6987bf36d2c6f2eb54c5cd92a7c546829f077ae27835cf2a957ece326ddc7d53`
- `convex-dev/runtimeMemoryTraversal.ts`: `8cc818f964cfb8b9bd412d8f2c36381612ea4a288077b5076fa0f0fa41bcbc0e`
- `convex-dev/runtimeAgentRecall.ts`: `b3c3b550bfc1be0be5d8a8f3344b88bd163883c7bc70ad15944d57993c9200e3`
- `convex-dev/runtimeMemoryQuery.ts`: `43674aa30d50a4237cbe9693723ac0572e64da808cfa456bd7f9c2ab5c4242a5`
- `convex-dev/runtimeAgent.ts`: `77973d2fc7d7f4a1f7cd32c8af7328887494a25d110b59dc3432923f6cb6989f`
- `convex-dev/runtimeAgentSchema.ts`: `a1fc448c67f44c0ee760a443e3eb0e3f1965037d843383c642b6f1e9a5c0562c`
- `tests/unit/runtimeMemory/literal-property-ranking.test.ts`: `5903a789713df26eff6e33b2c584a14b0e91e50945b237b32a07a36e20ef32ae`
- `tests/unit/runtimeMemory/query-composition.test.ts`: `71125b2ad25a68288c97fab29020d870abf886a48e0a50cd1ee8042a771ebc45`
- `tests/unit/runtimeAgent/model-input-selection.test.ts`: `82dcb89f8c51c4110c0d1772a4a1a97c6f5c0c8585fdb573f92f246b97c9ed9d`
- `tests/unit/runtimeAgent/whole-recall-composition.test.ts`: `3a90af32eed10d48dfe6766e9aae25d1d4a789a973b2ce63919482380a55b7a0`

## Runnable Read-only Reproducer

Run from the review cwd with Node v24.15.0 and TypeScript 6.0.3; the script transpiles/imports in memory, writes no files, and exits1 at the missing outcome assertion.

```sh
/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node --input-type=module <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const effortUri=uri(compile('src/domain/memory-effort.ts'));
const {resolveMemoryEffortPolicy}=await import(effortUri);
const {traverseMemoryEvidence}=await import(uri(compile('src/domain/memory-traversal.ts').replace('"./memory-effort.js"',JSON.stringify(effortUri))));
const {literalPropertyEvidence}=await import(uri(compile('src/domain/memory-direct-recall.ts')));
const fact=v=>({_id:'',factId:v,tenantId:'t',memorySpaceId:'s',ownerPrincipalId:'owner',lineage:{sourceId:v,sourceEventId:v,sourceRevision:1,role:'user',trust:'user_assertion'},extractionPolicyVersion:'v1',fact:`User's favorite fruit is ${v}.`,factType:'preference',subject:'User',predicate:'is_favorite_fruit',object:v,confidence:100,tags:[],version:1,sourceType:'conversation',createdAt:1,updatedAt:1});
const node=v=>{const f=fact(v);return {key:`fact:${v}`,item:{type:'fact',id:v,content:f.fact,score:.7,source:'facts',fact:f},lineage:f.lineage,literalPropertyPriority:literalPropertyEvidence('What is my favorite fruit?',f,3)}};
const apricot=node('apricot'),plum=node('plum'),questions=Array.from({length:4},(_,i)=>({key:`source:q${i}`,item:{type:'memory',id:`q${i}`,content:'What is my favorite fruit?',score:1.000000238418579,source:'vector'},lineage:apricot.lineage}));
let inspected=false;
const result=await traverseMemoryEvidence({seeds:[...questions,apricot],policy:resolveMemoryEffortPolicy({effort:'fast'}),now:()=>0,expand:async n=>{if(n.key===apricot.key){inspected=true;return {edges:[{node:plum,relationship:'exact-entity'}],cursor:null}}return {edges:[],cursor:null}}});
assert.equal(apricot.literalPropertyPriority,true);assert.equal(plum.literalPropertyPriority,true);assert.equal(inspected,true);assert.equal(result.trace.maxDepth,2);assert.equal(result.trace.maxEntries,4);assert.equal(result.trace.reachedDepth,2);assert.equal(result.nodes.length,4);
const actual=result.nodes.filter(n=>n.item.type==='fact').map(n=>n.item.id).sort();
console.log(JSON.stringify({edgeInspected:inspected,selected:result.nodes.map(n=>n.key),factIds:actual,visited:result.trace.visited,stopReasons:result.trace.stopReasons}));
assert.deepEqual(actual,['apricot','plum'],'both currently matching property values should outrank repeated question memories within cap4');
JS
```
