# Task Judgment: literal priority LP-1 repair, revision2

## Verdict: REJECT

The original LP-1 reproduction is fixed, with meaningful new public/Agent composition evidence. One boundary still violates the same exact-property priority requirement: frontier promotion depends on an extra queue iteration after reaching the entry cap. This is a source/test review only; installed correctness, SLO and final acceptance remain separate.

Repository `SaintNick1214/Project-Cortex`, branch `feat/convex-backend-runtime-completion`, base/HEAD `e9a9fb7bdbc1db1901ad3bb7f42db4b534c08cad`. Acceptance policy v2 controls the scores. Original v1 REJECT files were preserved unchanged.

## Evidence Review

Reviewed all4 changed-since-v1 files, current13-file hash receipt, exact v2 patch, implementation v2 reports, raw red/final Jest JSON/logs, type/lint exit receipts and the original review. Independently reran the original repro in memory against current modules:exit0, selected apricot,plum,q0,q1. The v2 patch exactly matches current tracked diff plus the untracked new test:56,529 bytes, SHA256 `675afce286c9fc8ced4bdee526bb8ff1bde0425143a682c565a1459b75c1a3d8`.

The new source leaves BFS discovery/queue/expansion intact and reselects already discovered matching evidence after the entry-bound stop. The indexed public/Agent tests assert the conflict is absent from the full initial bounded fact page, then verify its actual scoped depth2 path and final retention. The Agent test verifies both values in the prepared native body and successful current admission. These meaningfully resolve LP-1's original case.

## Issues Found

### Important — blocks this batch

**LP-2 [P2]: Apply priority when the cap is reached exactly at queue exhaustion.** At `src/domain/memory-traversal.ts:38`, `entryBoundReached` is set only when a subsequent iteration observes that selection is already full. Line56 gates all frontier replacement on that flag. If the final queue element brings the count to4, a previously context-skipped literal fact never gets reconsidered.

Independent actual-module reproduction, Node24.15.0/TypeScript6.0.3, in-memory transpilation/import, no files/services/models:

- Pinned Fast, maxEntries4, maxContextTokens500.
- Seeds: current apricot literal fact plus two repeated questions scored1.000000238418579.
- Apricot expands to a current matching plum fact and another question. The plum value is longer but passes the actual literal helper; apricot+plum cost490 complete traversal context units, within500.
- Apricot and both initial questions consume input first. Plum is skipped for aggregate input usage; the final question is selected. Queue ends with count4, so replacement never runs.

Observed exit1 at the required two-fact assertion:

```json
{"priorities":[true,true],"minimumBoth":490,"maxContextTokens":500,"selected":["fact:apricot","source:q0","source:q1","source:q2"],"selectedUnits":384,"visited":5,"stops":["input","depth"],"expansions":["fact:apricot","source:q0","source:q1"]}
```

Adding one irrelevant extra queue node triggers the next iteration and the repair pass; the result then correctly retains apricot+plum at490 units. This paired probe exited0 and also asserted that the omitted-pin result/trace exactly equals the e9 baseline. Priority should not depend on the presence of that irrelevant extra node.

Missing regression: an already discovered matching conflict skipped after weaker entries consume context must replace weaker outputs when the entry count reaches its cap exactly at queue exhaustion. Both facts fit without raising any bound. Current new tests use ample traversal context and do not exercise this condition.

No additional authorization, secret, model/budget or data-loss finding was found in the reviewed paths. This is not a full security or hosted audit.

## Requirements and Controls

| Requirement/control | Assessment |
|---|---|
| Original LP-1 edge-discovered conflict under ordinary Fast4 | Fixed; independent original repro and meaningful public/Agent native-handler outcome assertions. |
| Priority under valid entry/context ceilings | Incomplete; LP-2 independently fails although both matching facts fit together. |
| BFS shortest paths, cycles and dedup | Unchanged discovery; new shortest-path/cycle assertions passed. |
| Source/currentness/auth bindings for promoted frontier | Unchanged bind occurs before queue insertion; final retained set includes promoted node paths and current source/fact bindings. |
| Corrected/current conflicts and ambiguous/negative/mismatched/noncurrent inputs | Original helper gates and meaningful tests remain intact; passed in final218-test run. |
| Required pending/current/tool/notice groups and final whole-request fitting | Unchanged; existing outcome/overflow tests passed. |
| Omitted-pin/V1 behavior and replay | Legacy discovery comparator and selection unaffected; independent exact baseline equality plus existing paired snapshot/admission tests. |
| Private flag/caller forgery | Public strict schemas exclude pin/flag; save/storage endpoints remain internal; no new public endpoint. |
| Presets, full canonical transcript, authority/provenance/model/budget/strict barriers, public2/1 | Unchanged by4-file repair. No global completion claim. |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment | 3/5 | Original failing case repaired, but bounded context/count case still suppresses a known literal conflict. |
| Code quality | 4/5 | Local bounded reselection; no new reads or discovery-depth reorder. |
| Test quality | 3/5 | Good red→green composition/shortest-path coverage; exact-exhaustion context assertion missing and independently fails. |
| Pattern adherence | 4/5 | Existing domain traversal and internal backend bindings preserved. |
| Completeness | 3/5 | Reselection wiring works, but loop-break sentinel leaves a reachable selection state uncovered. |

**Average:3.4/5.** Requirements/test/completeness remain below policy minima4; LP-2 blocks PASS. Numerical cycle limits do not waive the real assertion.

## Raw Check Review

- Red filtered run:3 failed,1 passed,174 pending because of name filtering, natural exit1. The three failures correspond to pure original LP-1, public edge retention and Agent edge retention; shortest-path test already passed.
- Final affected run:218/218 passed, six suites, zero pending/skipped, natural exit0/15.929s. Raw Jest results, assertions and log inspected. The custom performance reporter counts191 test declarations; Jest's parameterized assertion count is218.
- Full TypeScript receipt:exit0/12.301s. Strict13-file lint:exit0/zero warnings/10.170s. No assertion weakening found.
- Independent original LP-1 repro:exit0. Independent LP-2 expected-outcome assertion:exit1. Paired extra-node/omitted-pin probe:exit0.

Unit logs explicitly disable graph and use mocked/native fixtures; no mocked result is claimed as live behavior. No source/test edits, build/model/service/browser/deployment calls, commits, GitHub calls, other-chat messages or subjudges were performed by this review. Only these v2 review artifacts were written. Original hosted failure and v1 REJECT remain history.

## Recommendation

Make pinned promotion depend on the actual candidate/selection state rather than only a later loop-break sentinel. Retain BFS discovery/read sequence, shortest paths, known frontier bindings, source/currentness/authority fences, all entry/input/work/depth/deadline ceilings and exact omitted-pin behavior. Add LP-2's count-at-queue-exhaustion/context case, rerun affected checks, and assess the repaired coherent batch. Fresh installed outcomes and numericalSLO remain parent-owned pending work.

## Exact Current Hashes Checked

- `src/domain/memory-effort.ts`: `4ed821962f63da02282875edaebbe0fc0bb82a426234a1d8fe4c7fa1eabddc1c`
- `src/domain/memory-direct-recall.ts`: `a03d252d9e6471b25d3407feb1443b9e21f716051a8ea220211f4b938ab8cc57`
- `src/domain/memory-traversal.ts`: `955b63c6df21701fe058ee64e84d250b8fdaa3e2fc6b738430871b404fa25711`
- `src/domain/model-input-selection.ts`: `6987bf36d2c6f2eb54c5cd92a7c546829f077ae27835cf2a957ece326ddc7d53`
- `convex-dev/runtimeMemoryTraversal.ts`: `8cc818f964cfb8b9bd412d8f2c36381612ea4a288077b5076fa0f0fa41bcbc0e`
- `convex-dev/runtimeAgentRecall.ts`: `b3c3b550bfc1be0be5d8a8f3344b88bd163883c7bc70ad15944d57993c9200e3`
- `convex-dev/runtimeMemoryQuery.ts`: `43674aa30d50a4237cbe9693723ac0572e64da808cfa456bd7f9c2ab5c4242a5`
- `convex-dev/runtimeAgent.ts`: `77973d2fc7d7f4a1f7cd32c8af7328887494a25d110b59dc3432923f6cb6989f`
- `convex-dev/runtimeAgentSchema.ts`: `a1fc448c67f44c0ee760a443e3eb0e3f1965037d843383c642b6f1e9a5c0562c`
- `tests/unit/runtimeMemory/literal-property-ranking.test.ts`: `ec6106c66c1f7db0c8c759d8ee5c447a810e1dd07ce4667b045f6dcabdf8eeac`
- `tests/unit/runtimeMemory/query-composition.test.ts`: `b444c475fff45e9738915d42da6f153678a5aa253a713468adcb707765261db2`
- `tests/unit/runtimeAgent/model-input-selection.test.ts`: `82dcb89f8c51c4110c0d1772a4a1a97c6f5c0c8585fdb573f92f246b97c9ed9d`
- `tests/unit/runtimeAgent/whole-recall-composition.test.ts`: `3fd4af6ab96939d173d5ea60f134be1c3a0b3156fe21b00c0e00f3139bf7429c`

Original review artifacts preserved:

- `memory-effort-literal-priority-independent-review.md`: `0b40f119658c2622fc21c811604c20831e26a2a8ff2919262ce28f62785e5e65`
- `memory-effort-literal-priority-independent-review.json`: `86f540ae15e0a33d3f0b4d6db6ba53da9fc8d00d13fafdafaa953cdc14d0cdaa`

## Runnable Read-only LP-2 Reproducer

From the review cwd:

```sh
/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node --input-type=module <<'JS'
import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),effortUri=uri(compile('src/domain/memory-effort.ts'));
const {resolveMemoryEffortPolicy}=await import(effortUri),{traverseMemoryEvidence}=await import(uri(compile('src/domain/memory-traversal.ts').replace('"./memory-effort.js"',JSON.stringify(effortUri)))),{literalPropertyEvidence}=await import(uri(compile('src/domain/memory-direct-recall.ts')));
const fact=v=>({_id:'',factId:v,tenantId:'t',memorySpaceId:'s',ownerPrincipalId:'owner',lineage:{sourceId:v,sourceEventId:v,sourceRevision:1,role:'user',trust:'user_assertion'},extractionPolicyVersion:'v1',fact:`User's favorite fruit is ${v}.`,factType:'preference',subject:'User',predicate:'is_favorite_fruit',object:v,confidence:100,tags:[],version:1,sourceType:'conversation',createdAt:1,updatedAt:1});
const node=(id,value)=>{const f=fact(value);return {key:`fact:${id}`,item:{type:'fact',id,content:f.fact,score:.7,source:'facts',fact:f},lineage:f.lineage,literalPropertyPriority:literalPropertyEvidence('What is my favorite fruit?',f,3)}};
const apricot=node('apricot','apricot'),plum=node('plum','plum '+('variety '.repeat(35)).trim());
const q=i=>({key:`source:q${i}`,item:{type:'memory',id:`q${i}`,content:'What is my favorite fruit?',score:1.000000238418579,source:'vector'},lineage:apricot.lineage});
const units=(n,depth,path)=>Buffer.byteLength(JSON.stringify({content:n.item.content,key:n.key,depth,path}));
const minimumBoth=units(apricot,1,[apricot.key])+units(plum,2,[apricot.key,plum.key]);
const policy={...resolveMemoryEffortPolicy({effort:'fast'}),maxContextTokens:minimumBoth+10};
const expansions=[];const result=await traverseMemoryEvidence({seeds:[apricot,q(0),q(1)],policy,now:()=>0,expand:async n=>{expansions.push(n.key);return {edges:n.key===apricot.key?[{node:plum,relationship:'exact-entity'},{node:q(2),relationship:'supporting-source'}]:[],cursor:null}}});
assert.equal(apricot.literalPropertyPriority,true);assert.equal(plum.literalPropertyPriority,true);assert.ok(minimumBoth<=policy.maxContextTokens);assert.equal(result.nodes.length,4);
const facts=result.nodes.filter(n=>n.item.type==='fact').map(n=>n.item.id).sort();console.log(JSON.stringify({priorities:[apricot.literalPropertyPriority,plum.literalPropertyPriority],minimumBoth,maxContextTokens:policy.maxContextTokens,selected:result.nodes.map(n=>n.key),selectedUnits:result.trace.selectedInputUnits,visited:result.trace.visited,stops:result.trace.stopReasons,expansions}));
assert.deepEqual(facts,['apricot','plum'],'known literal conflict that fits with its peer must replace weaker questions when count4 is reached exactly at queue exhaustion');
JS
```
