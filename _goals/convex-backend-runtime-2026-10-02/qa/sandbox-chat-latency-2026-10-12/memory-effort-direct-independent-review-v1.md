# Independent task judgment: memory-effort direct recall and native reads

## Verdict: NEEDSREVISION

This is the one non-author review of the coherent 17-file source/test batch against `f87d79a2687cfa5f2814f4136c049b4e88a1ae88`. Acceptance policy v2 governs. All 17 current hashes match the executor freezes; the unchanged `runtimeAuth.ts` kernel also matches. Source acceptance is blocked by the concrete low-cap conflict case below. This is not aggregate goal or hosted latency acceptance.

## Required revision

**[P2] DIRECT-LOWCAP-CONFLICT — Direct sufficiency ignores a discovered conflicting fact omitted by selection.** Both `convex-dev/runtimeAgentRecall.ts:241` and `convex-dev/runtimeMemoryQuery.ts:184` pass only `effortResult.items` into `directFactTraversalCompatible`. `src/domain/memory-traversal.ts:36` applies the entry ceiling before selecting the next queued node, after the preceding selected seed has already expanded; line58 returns only selected nodes. A current conflicting assertion can therefore be discovered and bound through an indexed entity edge yet disappear from the compatibility check. The shortcut then retains `direct-facts-v1` and skips semantic discovery despite having encountered ambiguity. An observable `entries` stop reason does not make that sufficiency decision correct.

A read-only execution of the actual three domain functions (transpiled in memory with Node24.15.0 and the current TypeScript compiler) confirmed: literal seed `User favorite season is autumn`, current same-subject/property exact-entity neighbor `User prefers spring`, Fast plus `maxEntries:1` => literal sufficiency true, conflict discovered, visited2/expanded2, selected only seed, stop reason `entries`, selected-only compatibility true. Checking the seed and discovered conflict together returns false. The existing public indexed-conflict test at `tests/unit/runtimeMemory/query-composition.test.ts:341` exercises the default cap4 and misses this branch.

Evaluate compatibility over all current fact candidates actually discovered/bound, independently of final selection. A private boolean/verdict is enough; omitted fact text need not cross the native boundary. Both public recall and Agent must keep semantic fallback on this conflict or a discovered correction. Add meaningful public and Agent cap1 regressions while preserving entry/input bounds, currentness and the exact governed fallback/financial boundaries.

## Requirement and evidence review

| Behavior | Judgment and evidence |
| --- | --- |
| Narrow literal lookup | Initial rule is conservative: one current candidate, full raw-page refusal, exact property/value grammar, no confidence threshold or invented aliases. Ambiguity/paraphrase/miss/correction tests retain one governed embedding. Low-cap discovered conflicts remain the blocking gap. |
| Real traversal and provenance | Uses existing native fact/entity/source traversal, depth1 fact and depth2 supporting source, facts-only permission handling, source/fact bindings and tombstone/currentness predicates. No general source-index exhaustion claim; route is explicitly versioned. |
| Agent safety and complete input | Current query/body/effort/cutoff/boundary pins remain. Independent save/preparation and native final admission repeat source and authority checks; actual model input still runs the existing whole-input fitter and qualified request preflight/admission. Revoke/edit negatives and real admission permit are asserted. |
| Capacity waiting | Exact native `ConvexError` code/outcome/origin/reason plus agent.respond/run/semantic/ordinal tuple only. Same canonical body is reused, fresh native admission executes each wake, original Gateway signal and bounded timeout/backoff64wakes apply. Existing reserved/inflight/UNKNOWN and nonconcurrency outcomes do not become provider retries. Tests cover rolled-back reservation, actual capacity predicates, one provider effect, cancellation/source/deadline/abort, money/account/window. This is controlled logic evidence, not actual hosted OCC evidence. |
| Invocation-local raw reuse | Session/admission/output/visibility opt into existing bounded raw readers. No permission/currentness result is cached. Exact safe table writers retain only allowed raw families; unknown, child and failed writes invalidate. Fresh scopes and predicates per RPC/delta remain; independent client post-I/O session/actor/generation and expiry fences are unchanged. |
| Optional trace enum | `src/client-runtime/validation.ts:73` accepts exactly direct-facts-v1 or semantic-v1 when present, leaves legacy omission structurally omitted, rejects undefined/unknown values and accessors before invoking user getters. |
| Compatibility and scope | Legacy root memory.recall, canonical one-message rows, configured model identifiers and financial capture/attachment boundaries are unchanged. New endpoint is internal and bound to the original public request/budget. No runtimeAuth kernel edit. |

## Test and build evidence

Observed raw receipts support223 passed tests in4 suites with zero skips and natural exit28.109s for the final direct/concurrency run. The performance reporter's209 count is not the official Jest total; the official footer is223. Companion final evidence composes1,154 tests across24 suites: unchanged passing suites from tests2 plus the final2-suite/240-test rerun. It is not a single1,154-test invocation. The earlier tests2 failure is preserved and was a stale schema inventory; the correction adds the already committed entity projection table and its exact3indexes rather than weakening assertions.

Full root TypeScript passed after corrected fixture typing. Affected direct lint passed with zero warnings; companion lint has2 unchanged unsafe-assignment warnings at validation.ts22-23. Root's observed build passed (174backend sources,79tables,2components; no deployment), full lint passed with243 existing warnings/zero errors, and packed root/runtime/graph ESM+CJS, manifest/declarations, URL and browser contract checks passed. Prior failing fixture/lint/test receipts were retained. These checks do not cover the newly identified cap1 conflict branch.

## Dimension scores

| Dimension | Score | Reason |
| --- | ---: | --- |
| Requirement fulfillment | 3/5 | Mandatory ambiguity fallback fails for discovered but unselected conflicts. |
| Test quality | 3/5 | Strong behavioral and negative assertions, but direct low-cap conflict behavior is uncovered. |
| Completeness | 4/5 | Reachable native/public/client wiring and affected build/contracts present. |
| Code quality | 3/5 | Existing safety boundaries reused; compressed helper/retry code remains maintainable enough. |
| Pattern adherence | 3/5 | Reasonable reuse of native scopes and shared services; no new permission cache. |

Average3.2/5; the mandatory requirement/test minima4 are not met. Fix the one finding, rerun the affected meaningful regressions, and return the coherent changed batch for this reviewer's revision check. No separate ceremony is requested.

## Remaining acceptance boundary

No changed-candidate actual latency, installed CLI/Chat outcome or final goal audit was run by this reviewer. Historical f87 Fast5.762s/Normal6.445s misses and the warm concurrency refusal remain history. The changed candidate still needs actual3/6/8/30s hosted qualification and the Root-owned installed consumer/outcome/final audit work. Video stays deferred. Source/test hashes, receipt paths and the read-only reproducer output are in the companion JSON. Reviewer performed no services, inference, native mutations, commits or GitHub actions and wrote only these two permitted review artifacts.
