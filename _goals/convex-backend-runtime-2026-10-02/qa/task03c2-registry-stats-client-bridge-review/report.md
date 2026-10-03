# Task Judgment: Task03C2 bounded SDK optional-statistics bridge

## Verdict: REJECT

The bounded gate does not pass because removal of the existing getStats error handler changes supported non-capability errors in absent/disabled resilience modes. This is a concrete narrower regression against the provided requirement that other errors retain existing behavior. Exact capability handling and profile-only methods otherwise satisfy the bounded requirements. This does not reject the authorized omission of optional profile statistics.

## Evidence review

Read AGENTS.md, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task and feature-orchestrator; Task03 and authoritative decisions; all six frozen SDK/test files; prior source copies; candidate commands/logs/outcomes. Independently verified current six SHA256s and prior six SHA256s. Reviewed root imports/exports and the unchanged ResilienceLayer; backend modifications belong to the separately reviewed safety substep, not this SDK executor.

Fresh rerun of the native two-suite gate with inert CONVEX_URL: **76 passed, 0 failed, 0 skipped**, exit 0. The first invocation lacked the required bootstrap URL and exited 1; the corrected invocation is the observed passing run. Executor root compiler/lint compiler/scoped ESLint/build/packed-browser receipts are exit 0 and their raw logs corroborate the report. No service, network, deployment, model call, code edit, commit, or child delegation occurred in this review.

Fresh actual-method probes in `work/resume/sdk-stats-review/probe.mts` used disabled clients and the actual classes across absent/disabled/enabled resilience. A copied HEAD MemorySpacesAPI, with imports resolved to the current unchanged dependencies, supplies actual baseline comparisons. `probes.json` records results. Exact native capability errors retain identity and issue one query in each mode, configured tenant selector is concrete, and readable get retains the official profile without a stats query. Ordinary native errors differ from baseline in absent/disabled modes. Enabled malformed error.data getter is read once by unchanged global resilience, with its thrown error reaching the caller; this is consistent with the executor's explicitly bounded classifier-only claim.

## Requirements review

| Requirement | Met? | Evidence |
|---|---|---|
| Readable register/get/update return real official profiles without implicit stats or repeated mutations | Yes | index.ts mappings, retained six profile/graph cases and fresh actual get probe |
| Optional stats absent rather than fabricated | Yes | Exact returned-object assertions and fresh get |
| READ-less receipt handling and other prior 33 criteria preserved | Yes | prior/current diff changes only six enrichment expectations; 76 native cases pass |
| Explicit export stats preserve exact typed unready with selected official tenant/space | Yes | index.ts explicit helper scope and native selected-row query assertions |
| Memory-space optional tenant selector/mismatch rejection before dispatch | Yes | resolveTenantId before execute; native assertions; fresh configured tenant query |
| Narrow static browser-safe capability recognition, other envelopes not falsely admitted | Yes | statistics.ts descriptors/exact keys/native checks and adverse-envelope tests |
| Other errors retain existing behavior | **No** | getStats lines 553–573 removes outer handleConvexError; fresh actual baseline comparison below |
| Exports/build/types/lint and bounded scope | Yes | helper not public; compiler/lint/build/packed browser receipts; memory-space diff confined to imports/getStats |
| Whole Task03, live new guards, canonical functional counts, full runtime | Pending | Intentionally outside this bounded review; no certification |

## Issues found

### Blocking

`src/memorySpaces/index.ts:553` no longer surrounds executeWithResilience with its previous error-normalization catch. In absent and disabled modes, an ordinary `new ConvexError('MEMORY_SPACE_NOT_FOUND')` or object denial now reaches callers as the same `ConvexError`; the actual accepted baseline instead returns a new `Error` containing data. Enabled mode retains the baseline conversion because resilience already performs it. Thus behavior for ordinary typed errors depends on resilience mode and violates the specified unchanged-other-error contract. The new generic infrastructure Error test does not detect this regression because handleConvexError already rethrows plain Error.

Restore the old catch for all other errors while keeping exact known capability errors outside that conversion (strict classifier pass-through followed by handleConvexError, or catch only around the execute call with the capability sentinel throw afterward). Keep configured tenant mismatch rejection before dispatch. Add meaningful native string and object ordinary-error expectations in all modes. No global ResilienceLayer changes are needed.

### Limitations, not new defects

Classifier zero-getter safety does not extend to rejected malformed errors through unchanged global resilience. Fresh enabled actual-method probe observes one getter access and the getter-thrown Error. Do not market this substep as complete hostile-error sanitization. The executor already documents this limit; it is not an additional basis for rejection. Retaining existing conversion may also retain legacy accessor behavior absent/disabled, which should be stated accurately.

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 3/5 | Main bounded outcomes proven; explicit other-error preservation fails |
| Code Quality | 4/5 | Static descriptor classifier, no getter reads there, exact narrow sentinel |
| Test Quality | 4/5 | 76 meaningful outcomes; missing ordinary native-error regression control |
| Pattern Adherence | 4/5 | Namespaces/resilience/browser boundaries retained except identified error-handler change |
| Completeness | 4/5 | Wiring, selectors, compiler/build/public-browser evidence present |

**Average: 3.8/5.** REJECT is the definitive requested gate result because all dimensions must be at least 4; no security auto-failure is asserted. The reference three-way rubric would call the repairable score-3 result NEEDS FIXES; neither permits advancing the dependent execution gate.

## Recommendation

Apply the narrow error-catch repair and native-error regression controls, rerun affected quality/native checks, freeze revised source hashes and obtain fresh independent review. Keep Task04 held under the current plan sequencing while this new review gate is unresolved. Functional canonical statistics, Task03/new-guard live acceptance and full runtime remain pending regardless of the bounded result.
