# Task Judgment: raw-run sharing and elapsed retrieval-work repair

## Verdict: PASS

Independent non-author review of the coherent 11-file batch against base `9973b498e5d076457367b285858729917830e51a`. Acceptance-policy v2 governs: requirements/tests/completeness >=4, code/pattern >=3 and zero unresolved concrete breaking findings. **Source acceptance only:** this permits fresh qualified installation, not hosted SLO or goal completion.

## Evidence Review

Read the actual complete source diff, both new test files, the narrowed oracle changes, current raw-reader invalidation and delivery implementations, applicable schema/index and internal wiring, the author reports, and goal/runtime/profile/rubric instructions. All11 current SHA-256 values match the frozen manifests before and after verification.

Independently executed one coherent offline command using pinned Node24.15.0, explicit env with loopback:9 fixture URL and no service credentials: **14/14 suites,494/494 tests,0 failed,0 pending/todo/skipped, no interruption; natural exit0 in39.052s**. Counts below are freshly observed distinct tests, not sums of overlapping historical reports. Independent root `tsc --noEmit` exited0 naturally in14.792s; strict ESLint across all11 files with max-warnings0 and unused-disable checks exited0 naturally in7.291s; scoped diff-check exited0. See `memory-effort-budget-independent-check.json`, `.jest.json`, `.log` and the types/lint/diff companions for exact commands, environment, exits and raw results.

Root separately executed the fresh SDK/backend build and packed/browser contracts; the reviewer read their successful receipts and terminal logs: build2 natural0/32193ms, contracts1 natural0/2527ms. Root docs build2 natural0/5199ms and docs types1 natural0/1774ms are supporting check outcomes, not a new docs-source judgment. Original build1/docs-build1 lack terminal receipts and remain incomplete/unknown in `memory-effort-budget-interrupted-checks.json`.

## Requirements Review

| Requirement | Met | Evidence |
|---|---|---|
| Identical scoped by_scoped_id take(2) lookup and unscoped fallback | Yes | convex-dev/runs.ts:32-35; convex-dev/runtimeAuth.ts:82-85; convex-dev/runtimeAuth.ts:448-449; convex-dev/runtimeTranscriptSchema.ts:72; raw-run-read-reuse: exact bounded lookup, detached rows, missing/duplicate/scope negatives; v8-preparation-read-retention: exact keys/limits and reduced query count; whole-recall-composition: exact raw-run identity set and take(2) |
| Current ambiguity, authority, source, grant, lease, approval and financial predicates remain executed; no cross-invocation reuse | Yes | convex-dev/runs.ts:39-54 (unchanged); convex-dev/runtimeAuth.ts:261-453 (existing reader); convex-dev/runtimeAgentRecall.ts:143,177-182; raw-run-read-reuse 23 tests; managed-source-read-scope 67 tests; admission/native-claim/client-admission/whole-recall composition selected negatives |
| Run writes and unknown/failed child writers invalidate raw run rows; mutable financial rows remain fresh | Yes | convex-dev/runtimeAuth.ts:365-394; convex-dev/runtimeAuth.ts:396-422; raw-run-read-reuse: patch/replace/delete, insert cached absence, duplicate insert, failed writer and unknown child success/failure; managed-source-read-scope: in-flight writers, late reads, fluent/unknown writers; v8-preparation-read-retention: exact permit/accounts/attempt and non-control read order |
| Narrow query classification changes only exact reusable runtimeRuns/by_scoped_id; other mutable/effect/auth-order assertions preserved | Yes | tests/unit/runtimeAgent/v8-preparation-read-retention.test.ts:60-105; tests/unit/runtimeAgent/whole-recall-composition.test.ts:493-521; Both composed suites pass with exact full key/limit identities, query reduction and durable state equality |
| Carry original per-route Action retrieval epoch across RPCs with invocation-local native origin before handler pre-read awaits | Yes | convex-dev/runtimeMemoryTraversal.ts:13-21,42-53; convex-dev/runtimeAgentRecall.ts:85,129,205-229,234-246; convex-dev/runtimeMemoryQuery.ts:113,142,162-173,177-188,204; deadline-delivery: independent invocation origins, 700ms pre-read plus 50ms in-flight fact, Agent/public original-start RPC propagation |
| No retrieval deadline enlargement or restart across native RPCs; future/invalid private origins fail closed or clamp | Yes | src/domain/memory-traversal.ts:14-15,28-41; convex-dev/runtimeMemoryTraversal.ts:50-53; deadline-delivery: invalid starts NaN/Infinity/-1, invalid elapsed clocks, future-start clamp, spent inherited entry starts no traversal reads |
| Respect fixed query-clock limits; stop new traversal/source/page/adjacency work when advancing clock expires | Yes | convex-dev/runtimeMemoryTraversal.ts:45-53,61-113; src/domain/memory-traversal.ts:28-59; deadline-delivery: fixed query clock, in-flight page crossing, no next page/source/adjacency after work deadline |
| Keep already validated and fitted selection after final RPC returns beyond work deadline; retain actual elapsed and deadline trace | Yes | convex-dev/runtimeMemoryServices.ts:150-170; convex-dev/runtimeMemoryTraversal.ts:137; deadline-delivery: actual repository-backed Fast semantic 785ms return preserves apricot fact, selected counts, units, final check and deadline; memory-traversal: pinned late selected result retained with final authority fence |
| Grant/source/fact delivery expiry, tombstone, revocation and authoritative final delivery remain enforced | Yes | convex-dev/runtimeMemoryServices.ts:154-158; convex-dev/runtimeAgentRecall.ts:177-182,225-228,253; convex-dev/runtimeMemoryQuery.ts:152-158,172,194; deadline-delivery: late grant/fact expiry refuses, current tombstone/revocation refuses; vector-delivery-batch: source/share/conversation expiry, grant revocation, cancellation, lease and final raw fences; whole-recall-composition: final revocation and fresh save refusal |
| Cancellation, relevance, depth/entry/context/work/candidate bounds and later Agent whole-input admission remain intact | Yes | src/domain/memory-traversal.ts:22-31,43-59,68-88; convex-dev/runtimeMemoryTraversal.ts:63-65,82,136; convex-dev/runtimeAgent.ts:1908-1920 and later admission (unchanged); deadline-delivery: cancellation, cap1, tiny context and relevance; memory-traversal: real depth2/4/8, Max9+, shortest paths, cycles, high fan-out, work/input bounds; whole-recall and admission suites: whole context, strict/pending, current save/admission, cancellation |
| Historical omitted private ranking pin retains old all-or-nothing late delivery behavior | Yes | convex-dev/runtimeMemoryTraversal.ts:51-53,137; convex-dev/runtimeMemoryServices.ts:166; src/domain/memory-traversal.ts:15,35,39; deadline-delivery: omitted ranking pin still yields selected0 after actual 785ms late return |
| Private tracing adds only existing scalar allowlist and fixed phases; no new text/IDs/content/reads/RPCs/models/commit boundaries | Yes | convex-dev/runtimeAgentRecall.ts:240-250; convex-dev/runtimeMemoryQuery.ts:184-192; convex-dev/runtimeLatencyTrace.ts:1-29 (unchanged allowlist); Static complete diff review; direct route and whole-recall composition suites preserve outputs/effects/call boundaries |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 4/5 | All mandatory behavior of this scoped source/test repair has code and meaningful offline evidence; installed runtime acceptance excluded. |
| Code Quality | 4/5 | Existing bounded invocation-local reader reused; finite clock validation and explicit historical pin; no new service or storage protocol. |
| Test Quality | 4/5 | 494 independently executed outcome tests across14 distinct suites, including real repository-backed expiry/refusal and 785/750 regression, zero skips. |
| Pattern Adherence | 4/5 | Existing private internal validators, fresh delivery fences, query indexes and current financial boundaries preserved. |
| Completeness | 4/5 | Reachable handlers and optional private validators wired; independent tsc/lint pass; fresh Root build/contracts read as successful. Fresh installed validation remains a separate open gate. |

**Average:4.0/5.** All policy minima satisfied for this source/test batch.

## Issues Found

### Critical / breaking

None found. No unresolved concrete authorization, source-currentness, financial, compatibility, cancellation, deadline-extension or duplicate-effect defect was demonstrated in the reviewed changes.

### Important / minor

No source repair required. The coverage limits below remain explicit and do not grant live acceptance.

## Test Coverage Analysis

| Independently executed suite | Passed | Skipped |
|---|---:|---:|
| `tests/unit/runtimeAgent/whole-recall-composition.test.ts` | 108 | 0 |
| `tests/unit/runtimeMemory/query-composition.test.ts` | 55 | 0 |
| `tests/unit/runtimeAuth/managed-source-read-scope.test.ts` | 67 | 0 |
| `tests/unit/runtimeMemory/vector-delivery-batch.test.ts` | 38 | 0 |
| `tests/unit/client-runtime/admission-native.test.ts` | 42 | 0 |
| `tests/unit/runtimeAgent/v8-preparation-read-retention.test.ts` | 16 | 0 |
| `tests/domain/memoryEffort/deadline-delivery.test.ts` | 20 | 0 |
| `tests/unit/runtimeRuns/admission.test.ts` | 20 | 0 |
| `tests/unit/runtimeAgent/native-claim-composition.test.ts` | 13 | 0 |
| `tests/unit/runtimeRuns/raw-run-read-reuse.test.ts` | 23 | 0 |
| `tests/unit/runtimeMemory/literal-property-ranking.test.ts` | 21 | 0 |
| `tests/unit/runtimeMemory/memory-traversal.test.ts` | 15 | 0 |
| `tests/unit/runtimeMemory/direct-fact-rule.test.ts` | 46 | 0 |
| `tests/unit/runtimeMemory/memory-effort.test.ts` | 10 | 0 |

The785ms regression uses a real `ConvexMemoryRepository.checkDelivery` and proves content, selected count, units, elapsed/deadline reporting and the final check. Separate tests preserve expiry, revocation and tombstone refusal; the Action-clock grant/fact expiry tests intentionally hold native Date fixed and prove `deliveryExpiresAt` refusal. Invocation-local work clocks cover inherited elapsed, future clamp, invalid inputs, fixed query limitations, no new source/page/adjacency after advancing deadline, cancellation and original caps. Raw-run tests prove exact bounded lookup reduction, detached rows, duplicates/scopes, failure identity and all run/unknown writer invalidations. Composed tests preserve exact other mutable query order, durable state, permit/accounts/attempt and final fresh fences.

## Exact Frozen SHA-256 Hashes

| File | SHA-256 |
|---|---|
| `convex-dev/runs.ts` | `b4fb8141c5ce43302e199850c34a42b02dd8d08d8dba3b8bbc887296151d86bb` |
| `tests/unit/runtimeRuns/raw-run-read-reuse.test.ts` | `4d3761575036d795feeb15643b8d7eed717caeb6c9e6920973caa86fbd493495` |
| `tests/unit/runtimeAgent/v8-preparation-read-retention.test.ts` | `fc2ef43f5ddaf520487df3dc3a2830aed5cbade27a9224cf3448c21bf0bdcc9f` |
| `tests/unit/runtimeAgent/whole-recall-composition.test.ts` | `ab31c928e901151e3a7b82a4585e2a9d21168fc03caea7afee76bc282fb13c7a` |
| `src/domain/memory-traversal.ts` | `b705b41b267e13e9e4efa46618a660f7c643e6f53f26b9cf740213090359e4d6` |
| `convex-dev/runtimeMemoryTraversal.ts` | `8f5ce2f1c557baaa667f5d2934ea18ea80de442276e1a74d6078d0087764da67` |
| `convex-dev/runtimeMemoryServices.ts` | `b515a1ba9cb0f71787af11603e6cbd5dd70825d5d47147ba62a9bd728f1679e7` |
| `convex-dev/runtimeAgentRecall.ts` | `d2f07dda5e7e3ec7c7f12d71034cd8aed24a246e68a5abbd883df5a258233f70` |
| `convex-dev/runtimeMemoryQuery.ts` | `e714e5a03168ba6c5f147ccc6eeec08bb4273639c1174c7d2e21f53dda1224e8` |
| `tests/unit/runtimeMemory/memory-traversal.test.ts` | `67076801172536e2f5b44d1bf8d450b5ff8500f374414776cf68243c761b7e4b` |
| `tests/domain/memoryEffort/deadline-delivery.test.ts` | `2dc358fd46ab50a69f28b50fe5c80edfcf8049ab19157e1dad8c48679cd57b80` |

## Limits and Historical Outcomes

- This is the single independent non-author source/test review of this coherent batch. It permits a fresh qualified installation; it does not accept hosted runtime correctness, latency, the milestone5/6 gates, or overall goal completion.
- Native Convex query performance clocks are fixed. The inherited budget already spent at entry suppresses traversal; polling cannot preempt an in-flight fixed-clock query. Candidate/page/work/input bounds and fresh final delivery remain required.
- No live services, browser, Docker, deployment, inference, credential lookup, Git mutation or installed-candidate latency run was performed by this reviewer. No actual changed-source 785ms hosted positive or SLO improvement is measured.
- Original direct-miss -> governed embedding -> semantic retrieval boundaries are unchanged. The no-restart check covers each original per-route retrieval origin across its RPCs; this patch does not introduce an end-to-end deadline spanning the existing fallback/model phase.
- No exhaustive fault cross-product, native transaction timing/load/race model, or proof against every possible undiscovered defect is claimed. Existing negative tests and source invariants are proportionate source-acceptance evidence.
- Root separately owns builds/contracts/docs and subsequent install/service qualification. No second receipt/controller/custody judgment was created.

Coordinator-reported installed9973 outcomes remain unchanged: browser5/6 correctness and3/6 timing, CLI2/2 correctness with both6s timing misses, Fast cross-conversation zero entries. This reviewer did not remeasure those live runs. Old785ms native failure remains failed. Controlled offline checks establish this prospective source behavior, not a changed-source hosted outcome.

## Recommendation

Proceed to the fresh qualified installation and required hosted/consumer qualification. Keep milestone5, final audit and overall completion open until their required real outcomes exist. No additional source or routine receipt judge is required for this accepted batch.
