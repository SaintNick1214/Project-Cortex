# Task Judgment: literal-source recall and preparation tracing

## Verdict: NEEDS FIXES

One mandatory correctness finding blocks this frozen source batch. The six affected suites independently passed **320/320 tests**, zero failures/skips/pending/todo, with natural exit0. Passing tests do not cover the supported unstructured-fact false positive reproduced below. This is one non-author coherent source/test review under acceptance-policy v2; no separate preparation, receipt or custody judgment was added.

## Scope and evidence

Reviewed the actual nine-path diff against `c2582bb2f659c9889147b7c6c37fa2935c2c96d6`, the surrounding repository/source/traversal/Agent/policy code, the new assertions and controlled fixture ports, policy/default tests, and tracing implementation. Read repository AGENTS.md, runtime/profile, pessimistic-judge, judge-task, acceptance-policy v2 and modified-goal-execution-v4.md. All nine SHA256 values matched the frozen manifest before the independent run, after it and at review completion; full values are in the JSON report.

Independent run: Node24.15.0/npm12.2.0, explicit offline environment (`CORTEX_TEST_ENV_MODE=explicit`, `CONVEX_URL=http://127.0.0.1:9`, `CONVEX_TEST_MODE=local`, `GRAPH_TESTING_ENABLED=false`), `--watchman=false --runInBand --forceExit=false`. The exact command/cwd/environment/versions, 14.013s elapsed, exit0 and natural join are in [test receipt](memory-effort-literal-review-check-tests.json); [raw log](memory-effort-literal-review-check-tests.log) and [Jest outcomes](memory-effort-literal-review-check-tests.jest.json) were inspected. Counts: direct rule69, public composition71, Agent composition122, preparation17, policy10 and latency tracing31 =320. The custom performance reporter says232 individual tests, while Jest assertionResults and native totals contain320 expanded cases; this review uses the native320 count.

Inspected author tests5 raw receipts and native results (320/320), types4 full root TypeScript exit0, lint4 changed-file strict ESLint exit0 with empty output, and diff1 exit0. The earlier test1 discovery failure, tests2 304/312, tests3 311/312, tests4 318/320 and types2 exit2 remain preserved. The changed fixture now corrects only terminal-question punctuation at its native search port; scope/currentness/source traversal remain actual repository code. The revocation regression now crosses actual preparation/admission commits, and keeps `FORBIDDEN` plus zero paid-attempt assertions. No previous failure was counted as success.

## Requirements review

| Requirement | Met? | Evidence |
| --- | --- | --- |
| Retain Fast2/3s, Normal-default4/6s, High8/8s, Max context/30s policy | Yes | `src/domain/memory-effort.ts:34-38,46-66`; unchanged preset/default tests pass |
| Add only immutable `literalSourceProofVersion=1`; omitted historical pin keeps old singleton behavior | Yes | `src/domain/memory-effort.ts:16-18,62`; `src/domain/memory-direct-recall.ts:55,69`; Agent old-pin regression at `whole-recall-composition.test.ts:813-828` |
| Prove exact current canonical assertion and same literal property/value for every candidate | **No** | LSR-1: absent metadata collapses different literal values to the same empty string; canonical mismatches pass |
| Original observed three-projection shape is reachable in public and Agent pipelines without query embedding | Yes | Public composition `query-composition.test.ts:334-342`; Agent `whole-recall-composition.test.ts:802-811`; exact three facts and canonical source, zero embedding calls/attempts |
| Unknown/conflict/other-lineage/history/time-bound/work/entry/partial stops preserve fallback | Partial | Structured negatives and bounds pass at public `352-359`, Agent `813-828`, pure rule `108-139`; absent-metadata conflict branch fails independent probes |
| Inspect discovered facts before shedding and retain current source/fact/authority fences | Yes for inspected paths | `runtimeMemoryTraversal.ts:77,102,117-120`; complete-only decision `memory-direct-recall.ts:136-137`; final fences public `runtimeMemoryQuery.ts:197`, Agent `runtimeAgentRecall.ts:256`; fresh refusal assertions pass |
| Broad/work/mixed/unknown prospective misses add zero canonical-source gets | Yes for covered shapes | Public `query-composition.test.ts:344-350`; Agent `whole-recall-composition.test.ts:845-853`; unstructured new-proof candidates need the same conservative treatment during repair |
| Preserve billing/replay/current authority/pending/strict guards and old explicit limits | Yes in bounded evidence | No financial/boundary/strict changes in diff; original governed fallback/admission code retained; existing relevant composition tests pass |
| Three opt-in scalar spans preserve state/output/read order and expose no raw content | Yes | `runtimeAgent.ts:2226-2237`; exact enabled/disabled output/state/read sequence and scalar-key assertions `v8-preparation-read-retention.test.ts:76-89`; shared latency allowlist and31 trace tests pass |
| No new RPC/cache/table/index/unbounded scan/paid call or source edit by reviewer | Yes | Five product-file diff adds pure helper/private pin/wiring and three existing span wrappers only; independent probes use controlled in-memory ports |

## Issues found

### Important, must fix for this batch: LSR-1 [P2] — absent structured values admit contradictory canonical proofs

Location: [memory-direct-recall.ts:52](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/memory-direct-recall.ts:52), with seed admission at55-57 and canonical check at73. `literalPropertyEvidence` deliberately accepts a self assertion with no structured fields (`114-118`); that pre-existing singleton behavior is supported by the existing test at `direct-fact-rule.test.ts:12`. The new branch compares `words(fact.object ?? "")` to `words(seed.object ?? "")`. With both objects omitted, the comparison succeeds for both `My favorite fruit is apricot.` and `My favorite fruit is pear.`. Replacing the seed text with canonical source text at73 still has absent metadata, so it verifies the property without verifying the value.

This is supported input, not a cast-only hypothetical: `FactRecord` makes subject/predicate/object optional (`src/types/index.ts:1228-1230`), the registered `derivedFact` validator keeps them optional (`runtimeMemorySchema.ts:45-46`), and actual `ConvexMemoryRepository.commitDerived` accepted the reproduced records. The new helper is consumed directly by both public (`runtimeMemoryQuery.ts:185-197`) and Agent (`runtimeAgentRecall.ts:240-256`) direct readers.

Two exact probes are saved with executable stdin scripts, commands, raw output, exits and natural joins:

- [Pure counterexamples](memory-effort-literal-review-check-unstructured.json), [output](memory-effort-literal-review-check-unstructured.log): source apricot with unstructured apricot/pear facts returns proof=true and compatible=true; source pear with two unstructured apricot facts also returns proof=true. Both should refuse. The child deliberately exits1 for the observed false positives.
- [Actual repository/traversal/delivery composition](memory-effort-literal-review-check-unstructured-native.json), [output](memory-effort-literal-review-check-unstructured-native.log): `memoryFixture` + actual `putSource`/`commitDerived` + scoped `searchFactCandidates` returned two current facts with no candidate work bound. Actual traversal inspected and bound both contradictory facts, returned `stopReasons=["depth"]`, no unavailable stage and complete=true; actual `checkDelivery` succeeded. Applying the exact direct-reader acceptance predicates yields `routeWouldAccept=true`, child exit1. This does not claim a cloud endpoint run; it establishes the shared source path and that existing final currentness fences do not reject the incorrect semantic proof.

Required repair: constrain only the new multi-fact proof to a supported nonempty structured literal value before its prospective source read, or compare parsed exact assertion values independently of optional metadata. Preserve old singleton interpretation. Add pure and public/Agent composition regressions for absent-metadata same-source contradiction and canonical-source value mismatch, including conservative source-read behavior. Rerun affected checks and have this repaired coherent batch reviewed once. No source was changed in this review.

No additional authorization, cross-scope or financial bypass was observed. No speculative stylistic issues are presented as blockers.

## Dimension scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement fulfillment | 3/5 | Observed structured repair and tracing work, but mandatory exact-value/conflict fallback contract fails for a supported shape |
| Code quality | 3/5 | Bounded pure proof and existing fences are maintainable; absent-value equality creates the specific correctness gap |
| Test quality | 3/5 | Strong actual composition/failure/equivalence assertions and320 passing tests; unstructured-value branch lacks the required regression |
| Pattern adherence | 4/5 | Existing snapshots, ports, source authority, bounded traversal and trace wrappers retained |
| Completeness | 4/5 | Both public/Agent wiring and new pin are reachable; scoped checks and relevant supporting changes are present |

**Average: 3.4/5.** Acceptance-policy v2 requires requirement/test/completeness>=4 and quality/pattern>=3. Requirement and test quality are below the minima; no average overrides LSR-1. Verdict remains **NEEDS FIXES**.

## Boundaries

This source-batch verdict does not accept native latency, installed consumers, real service behavior or the entire follow-up. The expanded goal stays **4/6=66.7%**, with native profile SLO qualification and final audit open. The independent review made no service/inference/GitHub calls, commits, package operations, deployment, website/Proofs/Union Arena changes or product edits. All review subprocesses exited naturally; no owned service was started.
