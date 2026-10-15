# Task Judgment: repaired literal-source recall and preparation tracing v2

## Verdict: PASS

**LSR-1 is closed for the exact v2 nine-file batch.** The new multi-fact proof now requires a nonempty lexical subject, predicate and object before selecting a seed or prospectively reading its canonical source, and requires the same structured evidence on every discovered candidate. Different absent values can no longer compare as two empty strings. Historical singleton behavior remains unchanged.

This is a non-author re-review of the same coherent source/test batch under adopted acceptance-policy v2, not a new preparation or receipt judgment. No unresolved breaking findings were found. The original **NEEDS FIXES** review, LSR-1, failing probes, v1 hashes and previous test/build receipts remain unchanged.

## Evidence review

Reviewed the actual source/test diff against base `c2582bb2f659c9889147b7c6c37fa2935c2c96d6`, the repaired function and surrounding retained proof/wiring, and all12 added regression cases. The v2 manifest changes only `src/domain/memory-direct-recall.ts` and the three rule/public/Agent test files. The other five paths exactly match v1. All nine hashes matched the v2 manifest before testing, after testing and at final review; exact `sourceHashes` are in the JSON report for packaging consumption.

The guard is at [memory-direct-recall.ts:33](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/memory-direct-recall.ts:33). Its use at55-62 ensures both prospective eligibility and later compatibility require actual structured values; line57 compares the now-proven values directly. Canonical validation at78 reuses the seed's verified structured value. The legacy singleton call remains first at74. An exact function-body comparison confirms `sufficientDirectFactLookup` and `literalPropertyEvidence` are byte-identical to the base, preserving the old optional-metadata interpretation.

Independent six-suite rerun: **332/332 PASS**, six passed suites, zero failed/skipped/pending/todo; natural exit0 in15.506s. Node24.15.0/npm12.2.0; `--watchman=false --runInBand --forceExit=false`; explicit offline environment with localhost port9. [Exact command/cwd/environment/version/exit receipt](memory-effort-literal-review-v2-check-tests.json), [raw log](memory-effort-literal-review-v2-check-tests.log), [native Jest results](memory-effort-literal-review-v2-check-tests.jest.json). A multiset comparison of suite path plus full case name confirms all320 previous cases still pass and12 new cases were added; [case/hash/compatibility summary](memory-effort-literal-review-v2-check-summary.json). Native expanded Jest cases establish332; the custom timing reporter's group count is not used as the test total.

Inspected author raw tests6 native results/log (332/332), types5 full root `tsc --noEmit` receipt and empty diagnostic log (exit0), lint5 all-nine-path strict ESLint receipt and empty log (exit0), and diff2 receipt/empty log (exit0). These are distinct from the reviewer's observed rerun. Root owns fresh build2/contracts2 against the same v2 hashes; this review does not invent an installed or cloud result.

## LSR-1 closure

Both original executable probes were replayed from their preserved stdin scripts with expected refusal and new receipt names. The native replay additionally checks successful original commit/traversal/delivery and absence of prospective source ID, ensuring that refusal was not caused by an unrelated setup failure.

| Counterexample/check | Repaired observed outcome |
| --- | --- |
| Canonical apricot source with two unstructured apricot/pear facts | proof=false, compatible=false, no prospective source ID |
| Canonical pear source with two unstructured apricot facts | proof=false, compatible=false, no prospective source ID |
| Original actual repository/traversal/delivery fixture | commit accepted; two current candidates; both inspected and bound; complete depth-bounded traversal and delivery version1; sourceProofAccepted=false and routeWouldAccept=false |
| Original pure and native replay exits | Both natural exit0; original failing exit1 receipts preserved |

Replay receipts and raw output: [pure](memory-effort-literal-review-v2-check-unstructured.json), [pure log](memory-effort-literal-review-v2-check-unstructured.log), [native](memory-effort-literal-review-v2-check-unstructured-native.json), [native log](memory-effort-literal-review-v2-check-unstructured-native.log).

The regressions are meaningful outcome assertions:

- `direct-fact-rule.test.ts:140-169`: both original counterexamples, matching unstructured candidates, each missing/empty/whitespace/punctuation-only structured field, discovery compatibility refusal, retained singleton success, and actual repository/traversal/current-delivery outcomes.
- `query-composition.test.ts:345-355`: both supported counterexamples produce no direct result and zero prospective `getSource` calls; the actual registered public recall returns `semantic-v1`, retains both facts, makes exactly one governed controlled-provider embedding call/attempt and captures terminal evidence before result attachment.
- `whole-recall-composition.test.ts:815-829`: both counterexamples produce no direct result/source read, retain the original governed embedding proposal, invoke one controlled semantic recall peer, retain both facts and prepare the model request. No attempt exists before main admission; admission creates exactly one. This controlled Agent peer is not represented as external provider coverage.

The unchanged observed three-projection public/Agent positives, omitted policy pin, conservative unknown/conflict/history/time/work/entry fallback, source-edit/fact-expiry/revocation fences and exact opt-in trace output/state/read-order equivalence all pass in the same rerun. No regression assertion was weakened to close LSR-1.

## Requirements review

| Requirement | Result | Evidence |
| --- | --- | --- |
| Preserve Fast2/3s, Normal-default4/6s, High8/8s, Max context/30s | Met | Unchanged policy file hash and passing policy/default cases |
| Only new immutable `literalSourceProofVersion=1` enables new proof; historical omission retains old rule | Met | Existing pin/wiring unchanged; old-pin and exact singleton compatibility checks pass |
| Exact property/value, one current canonical assertion, same scoped owner/immutable pristine lineage | Met | Structured guard closes LSR-1; current canonical/lineage/pristine checks retained; structured positive and both mismatch negatives pass |
| Unknown, contradictory, historical, partial and bound outcomes retain governed semantic fallback | Met | Original negatives plus new public/Agent unstructured regressions; original probes refuse |
| Every discovered fact inspected before shedding; all current source/fact/final authority bindings retained | Met | Traversal callbacks unchanged; native regression verifies both fact IDs inspected/bound and successful currentness delivery without confusing it with semantic proof |
| Broad/work/mixed/unknown prospective misses add no source gets | Met | Existing four-class public/Agent checks and new unstructured checks pass |
| Public and Agent reachability, billing/replay, pending/strict and old limits retained | Met within source scope | Same registered wiring, governed fallback and admission cases pass; no new RPC/cache/table/index/paid call or budget boundary |
| Three scalar opt-in spans preserve output/state/exact read order without raw content | Met | Span code/test hashes unchanged; enabled/disabled equivalence and latency suites pass |

## Dimension scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement fulfillment | 4/5 | Mandatory source-proof gap closed with exact original and composed regressions |
| Code quality | 4/5 | Small typed guard, direct value comparison, bounded existing flow, no unrelated changes |
| Test quality | 4/5 |332 observed passing outcome cases,12 focused regressions, both original executable probes now refuse |
| Pattern adherence | 4/5 | Existing snapshot pin, authority/source ports, conservative fallback and tracing patterns retained |
| Completeness | 4/5 | Shared rule reaches public and Agent paths; supporting assertions/type/lint evidence present |

**Average:4.0/5.** All adopted policy-v2 minima are met. **Findings: none unresolved. Breaking findings: none found.**

## Limits and recommendation

Accept this exact frozen v2 source/test batch. The finite projection grammar remains deliberately conservative; unstructured multi-fact and unknown wording use governed semantic fallback. This is an intended limitation, not a claim of general semantic proof. Controlled native/provider/component ports do not establish actual cloud/OCC/latency outcomes.

The expanded goal remains **4/6=66.7%**. Native profile SLOs, installed consumers and final goal audit are not accepted by this review. Root's fresh build/contracts and later installed/native work remain separate gates. The reviewer made no product edits, service/inference/GitHub calls, commits, package operations, deployments or website/Proofs/Union Arena changes; every owned subprocess exited naturally.
