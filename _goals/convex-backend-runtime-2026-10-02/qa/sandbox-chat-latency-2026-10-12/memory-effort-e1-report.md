# E1 implementation report — source frozen

2026-10-14. Target `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`, initial HEAD `f87695783e8b21ffecf6298057a87cd8e69a3016`. Implementation began only after Root's K29 baseline GO. Product source is re-frozen after the existing independent source review repairs for a new combined E1/E2 build and the same non-author review. Original 17-task non-video acceptance is unchanged.

## Result

Implemented shared effort contracts and actual Convex-backed logical traversal for public recall and effort-aware Agent runs. Fast reaches2/not3, Normal4/not5, High8/not9 and Max through12 in a deterministic indexed chain; direct old/deep hits remain depth1. Max has no preset product depth/entry count and can select history beyond128 messages while qualified input/work remain.

- `src/domain/memory-effort.ts`: browser-safe request/policy/trace types, strict own-data request normalization, Normal default, Fast/Normal/High2/4/8 hops with4/8/16 shared optional-entry ceilings; Max null depth/entry bounds. Administrator/caller lower ceilings intersect with32768 qualified whole-input units and work/deadline limits. Hosted targets remain3000/6000/8000/30000 ms, unqualified here.
- Existing V8 execution path uses selection version2 and registry revision4 / `cortex.transcript.relevant` handler version2. Definition input may specify `inputSelection:{version:2}`; backend normalizes it. Actual registry hash is `5152bd0c3f8e35907c2d57c0a3467e2450e8db0dfb5174c552024c954554a515`. Definition readback exposes `inputSelectionVersion:2,memoryEffortPolicyVersion:1`.
- V1 policies, snapshot interpretation, explicit legacy limits and omitted legacy run requests retain their meaning. Explicit memory options on an old definition reject `INVALID_INPUT` before admission effects. Canonical submission/public-recall bindings include requested effort/ceilings and the new recall policy identity.
- `runtimeMemoryFactEntities` stores exact scoped entity/relationship membership, maintained through the existing current fact projection seam without an external connector. Existing source lineage plus a narrow source/fact keyset index provide source↔fact edges. Chunk/vector/source hydration is not counted as another hop.
- Bounded keyset adjacency pages use actual current fact/source authorization and currentness. Shortest-depth dedupe prevents cycles and duplicate evidence. Prepared fact payloads must still equal live rows: a new binding cannot validate stale prepared text. Final delivery retains selected evidence plus every intermediate bridge, not every discarded frontier row. Fact-only permissions skip optional full-message edges while preserving global authority and final bridge fences.
- Optional context fits one shared count across history/facts/memories/pending, then the existing qualified complete normalized model input. Current input and whole required tool groups remain mandatory. Pending/strict barriers retain their explicit fail/incomplete behavior.
- In-query work/pages and queued candidate bytes are bounded deterministically. Actual elapsed retrieval enforcement runs on the Action clock after governed embedding and its ledger complete, through protected delivery. Late optional results are dropped with `deadline`; no false elapsed claim is made from Convex's fixed query clock. Public and Agent regressions preserve Fast context after a slower preceding embedding stage. End-to-end user latency is measured separately later.
- Per-item `retrieval:{depth,path}` and content-free server `memoryEffort` trace report actual bounds, discovery/selection counts, final qualified input units, stage duration and stop/unavailable reasons. No new model or reranking call was introduced; original independent financial commit boundaries remain.

Exact current owned source/test file hashes, commands, absolute cwd, toolchain, exits and output hashes are in `memory-effort-e1-checks.json` and the focused `memory-effort-e1-review-repair-checks.json`. The initial freeze hash revision and all prior failed receipts remain retained. Shared public exports/client/provider/CLI/demos are E2-owned and excluded from the E1 source hash list.

## Observed checks

Pinned Node24.15.0/npm12.2.0. Unit fixtures used `CORTEX_TEST_ENV_MODE=explicit`, inert `CONVEX_URL=https://offline.invalid`, `--watchman=false`, `--runInBand`. No live services or credentials were used.

| Check | Outcome |
| --- | --- |
| Focused domain/backend/transcript/public/Agent regressions | PASS304 tests /10 suites,22.209s,exit0 |
| Full `tsc --noEmit`, after E2 fixture typing correction | PASS,exit0 |
| ESLint for20 E1 source files, unused-disable reporting | PASS,exit0,zero warnings |
| `git diff --check` | PASS,exit0 |
| Broader affected memory sweep before repairs | FAIL5 /546 tests;541 passed, historical failure retained |
| Targeted envelope/default/traversal repair rerun | PASS79 tests /3 suites,exit0 |
| Targeted K29 observation-test repair rerun | PASS33 tests /1 suite,exit0 |

The broader sweep found three global-envelope regressions, one old public-default assertion, and one stale K27 observation performance test. Legacy201-source/101-fact/262144-byte delivery bounds were restored exactly; new bounded traversal uses a trusted version2 envelope. The default assertion now checks the actual Normal request binding. Root authorized updating the K27 equality/no-scope assumptions to K29's read reduction and distinct fresh native observation scope; exact observation/effects/non-auth reads, separate session and revocation assertions remain. The old failed sweep and intermediate failed test remain failures; targeted reruns verify their repairs. The whole546-test sweep was not repeated.

Earlier unit startup attempts ran no suites because the environment setup lacked a Convex URL; an explicit inert fixture environment corrected that prerequisite. Early focused failures and type errors were corrected before the accepted checks. No resource-failing test rerun was used.

## Root handoff

The deterministic12-fact fixture is `tests/unit/runtimeMemory/memory-traversal.test.ts:12` (`chain`). Each fact connects exact `entity-(i-1)` to `entity-i` and has its own current source. Only fact1 is seeded for depth assertions. Actual indexed reads are asserted; source canonical rows remain byte-for-byte unchanged across profiles.

For a temporary internal hosted fixture, obtain the current seed with `repository.getFact(factId)`, then `factEvidenceNode(currentFact)`. Call `traverseConvexMemory(ctx,repository,seeds,resolveMemoryEffortPolicy({effort}),bindings,eligible?)`; finish with the original `repository.checkDelivery(bindings)` authority/bridge fence. The seed must contain the actual persisted native `_id`, not a constructed pre-insert placeholder. Exports are in `convex-dev/runtimeMemoryTraversal.ts:12-30`. No public test endpoint or shipped fixture was added.

Root owns the single combined SDK/backend build, independent coherent source/test review, installation/codegen/package contract checks, actual managed-vector/hosted/public/Agent/browser/CLI profile outcomes, latency repair/measurement and final audit. These are unexecuted here and are not claimed PASS. E1 made no builds, deployments, paid inference, GitHub calls, commits, pushes or production changes. Unrelated QA, `work/resume`, other repositories and Union Arena were preserved.


## Independent source review repairs — final E1 freeze

The same source review found and E1 repaired four concrete behaviors without a new endpoint or policy version:

- V2 shared optional fitting now compares history and evidence by relevance. Optional history uses deterministic overlap with the current question; a populated eight-history dispatch regression retains the older matching fact, at most seven optional history rows and the mandatory current question. V1 keeps its exact earlier removal behavior. Fitting publishes `entries` for shared-count pruning, and `input` only for actual whole-request overflow.
- Explicit `effort:null` rejects instead of becoming Normal; omitted/undefined effort keeps Normal semantics. The registered public recall handler translates malformed numeric ceilings to structured `INVALID_INPUT` / `not_dispatched` before any financial/model effects. Four direct-handler negatives assert zero policy requests, query/model attempts, run accounts, searches and derived writes.
- Effort-aware Agent seeds use effective work/context/candidate-byte limits with a bounded native maximum100, replacing the hidden old10. The actual Agent composition selects twelve independent direct matches (all depth1, no connecting edges), including the eleventh/twelfth. The legacy candidate limit remains10.
- Raw fact/ANN cap hits now mark conservative `work` plus an explicit candidate-bound unavailable-stage reason for both Agent and public recall. The fact flag survives stale/tombstoned top-row hydration, so a short returned list cannot falsely claim complete discovery. Explicit caller limits remain lower selection ceilings and do not prove exhaustion.

| Current repair validation | Observed outcome |
| --- | --- |
| Effort/selection/populated-history/Agent/public-query five-suite batch | PASS191 tests /5 suites, Jest19.816s, subprocess20.128s, natural exit0 |
| Public-handler functional suite with four numeric-ceiling negatives | PASS31 tests /1 suite, Jest4.426s, subprocess4.741s, natural exit0 |
| Full `tsc --noEmit` after final public-boundary fix | PASS,exit0 |
| ESLint seven changed selection/discovery source files, then final public source/test | PASS,exit0,zero warnings |
| Final `git diff --check` | PASS,exit0 |

Both final Jest subprocesses used `--forceExit=false`, completed within a90-second child timeout, and recorded `timed_out:false`. An earlier review-repair148-test /4-suite run also exited naturally. Earlier304/10,79/3 and33/1 receipts used forced exit and establish assertions only; this report does not treat them as natural shutdown evidence. No broad sweep was repeated for ceremony. The earlier combined build/contracts apply to the earlier candidate; Root must build and qualify these frozen product hashes anew. No E1 build, service, credential or paid-model operation occurred.
