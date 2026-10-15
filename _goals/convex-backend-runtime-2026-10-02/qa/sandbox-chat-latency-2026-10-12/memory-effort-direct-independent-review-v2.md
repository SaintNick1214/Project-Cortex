# Independent task judgment v2: memory-effort direct recall repair

## Verdict: PASS — source and tests only

The focused revision resolves `DIRECT-LOWCAP-CONFLICT`. There are zero unresolved concrete breaking findings in this reviewed batch. Acceptance policy v2 applies; scores are requirement fulfillment **4**, test quality **4**, completeness **4**, code quality **3**, pattern adherence **3** (average **3.6/5**). This accepts the current source/test repair, without granting hosted latency, installed-consumer or aggregate goal acceptance.

The original v1 NEEDSREVISION remains preserved unchanged. I reviewed the actual revision and meaningful test assertions, checked the raw receipts, re-executed the original narrow domain reproduction against the repair, and verified all **20** current source/test hashes against the 12-file direct v2 freeze and unchanged 8-file companion freeze. The unchanged raw-reader kernel also matches. Hashes and evidence are recorded in the companion JSON.

## Finding resolution

`convex-dev/runtimeMemoryTraversal.ts:50`, `:72` and `:88` now inspect current authorized seed/derived/indexed facts before selection or queue pruning. The existing current-fact/source predicates still execute. Both direct handlers accumulate only a monotone private compatibility boolean; no omitted fact payload or additional public trace field is returned. Selected-only bindings still retain only selected evidence and required bridges.

`src/domain/memory-direct-recall.ts:52` additionally refuses direct sufficiency when discovery stops for entries, input, work, deadline, cancellation, relevance, unavailable coverage, or any unavailable stage. The configured depth horizon remains an intentional limit and does not claim semantic corpus exhaustion. This is conservative: incomplete discovery may require the original single semantic call even without an observed conflict. The user/admin ceilings are unchanged.

The preserved cap-one domain reproduction still visits the conflict and selects only the seed, but the new completeness check is false, all-discovered-fact compatibility is false, and direct eligibility is false. This directly closes the original selected-only bypass. Source/authority exceptions still propagate; the repair introduces no exception-to-paid-fallback catch.

## Meaningful regressions

| Evidence | Observed outcome |
| --- | --- |
| Public indexed conflict, `tests/unit/runtimeMemory/query-composition.test.ts:341` | Caps 1 and 4 retain semantic-v1, exactly one governed embedding, the requested ceiling, no more than that many output entries, one released/attached attempt and capture before attachment. |
| Actual Agent composition, `tests/unit/runtimeAgent/query-embedding-composition.test.ts:304` | Fast/maxEntries1 passes through actual prepareContextV8 and Gateway/native handlers with controlled peers; exactly one native embedding and admitV8, semantic-v1, no more than one selected entry, separate capture and attachment. |
| Private traversal, `tests/unit/runtimeMemory/memory-traversal.test.ts:18` | Observer sees omitted f2 while output and bindings retain only f1; omitted fact text is absent from serialized result. |
| Rule negatives, `tests/unit/runtimeMemory/direct-fact-rule.test.ts:17` | Discovered conflict/correction and every incomplete stop refuse direct sufficiency; configured depth/exhaustion without unavailable coverage remain eligible. |

Before the fix, the actual public and Agent cap-one regressions both failed and the cap-four control passed. That intentionally focused red receipt has 99 unselected/skipped tests and is preserved as failure history, not qualification evidence. After the fix, the official Jest footer reports **247/247 tests in 5 suites**, zero skips, natural exit **28.475 s**. After two lint-only optional-chain assertion cleanups, the affected traversal suite passed **15/15**, natural exit **7.807 s**. These counts overlap and are not added together.

Full root TypeScript passed after the final changes (**18.555 s**). All 12 owned files passed strict lint with zero errors/warnings (**11.051 s**); the earlier strict-warning receipt remains intact. The owned diff check exited 0. Root's post-repair backend build passed with **174 source files, 79 tables, 2 components**, without deployment, and public package/browser/declaration contracts passed. Prior unchanged SDK build, full lint and companion checks remain scoped evidence; no unchanged broad gate was repeated for this review.

## Retained composition and limits

The unchanged portions of v1 retain their reviewed safety properties: exact trusted unreserved concurrency waiting only, same prepared request identity/body, original Gateway abort and timeout bounds, fresh native guards on every wake, no provider retry; invocation-local bounded raw rows with unknown/child/failed-writer invalidation; independent SDK post-I/O session/actor/generation/expiry checks; strict optional route parsing and legacy omission; actual whole-input fitting and final qualified admission. No model, history, source/tombstone, financial capture/attachment or public request contract change was introduced by this repair.

Current-candidate hosted submit-to-visible-text qualification for **3/6/8/30 seconds**, installed CLI/Chat outcomes and the final independent goal audit remain pending. Historical f87 misses and the warm refusal remain failures. Video remains deferred. No new live speedup is claimed. The reviewer performed no services, inference, native mutations, product edits, commits or GitHub actions and wrote only the permitted review artifacts.
