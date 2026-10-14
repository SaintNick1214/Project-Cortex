# Task Completion Report

## Status: COMPLETE — bounded source/check batch; independent review and native qualification pending

Repository: SaintNick1214/Project-Cortex. Accepted baseline `be39655e09fdee69907a6ba81b096e5a44067945`. K24 was already cleaned with independent ABSENT verification before edits. This batch makes no native latency, memory acceptance or subsecond claim. Historical K24 four SLO failures and warm browser memory failure remain unchanged.

## Changes made

- `convex-dev/runtimeAgent.ts`: new internal query `contextInputsAndEmbeddingV8` executes the original context-input handler, then the original query-embedding preflight in the same fresh native snapshot only for populated context. It derives text, requestId and limit from the current server run. Pending-failure and empty branches return without embedding preparation. The private Action consumes tentative data; fresh admission, dispatch, save and model guards remain. Unsupported/custom context callbacks retain their original three arguments and original ports.
- `convex-dev/runtimeAgentQueryEmbedding.ts`: V8 recall can consume that native proposal. It retains the original independent refresh, exact-bound admission/checkpoint, official Gateway, capture, attachment and generic fallback. A proposal never represents an authorization decision. Tests change grant, budget, profile and ordinal after preparation and prove zero billable peer calls/effects on refusal.
- `convex-dev/runtimeAgentRecall.ts`: new internal mutation `readMatchesAndDeliveryV8` performs the original ordered match/source guards followed by the original consumed-resource final delivery in one native snapshot, without application writes. Only invocation-local raw control readers share the snapshot. Per-source checks and the final authority/deadline fence retain the original raw native context. The same original original-mode exports remain registered.

The composed tail is selected only by a private, nonserialized marker attached at the production context assembler's synchronous Map bookkeeping callback. That callback performs no asynchronous I/O or dependent native reads between the precomputed final fence and consumption. Arbitrary/unbranded callbacks retain the original read → callback → final-delivery sequence, including callback-triggered revocation and failure behavior. The marker is nonenumerable and is not an RPC field, authorization proof or process cache.

The native parent defers only recognized existing Convex/Gateway refusal data so the Action's synchronous selection/ranking failures retain precedence. Unknown/foreign failures are rethrown unchanged, rather than projected into a typed outcome or success. Tests preserve foreign error identity, original typed code/data, and callback/rank ordering. The original real Action-clock expiration check executes after the parent returns. A grant change after that return is refused by the retained fresh save fence. Financial reservation/checkpoint rollback, UNKNOWN ceilings, terminal capture/attachment independence, save/candidate child rollback and all original deadlines/caps are untouched.

## Requirements checklist

- [x] Original context and query-embedding guards share one native read parent; input is server-derived; pending/empty precedence remains.
- [x] Ordered original vector/fact/source/currentness guards and final raw delivery fence share a native read parent; zero application writes.
- [x] Every qualification/profile/lease/scope/hash/owner/tombstone/budget predicate and actual Action expiry remains; only tentative proposals cross the network.
- [x] Canonical transcript, bounded selection, strict barriers, generic/public recall, historical V1–V7 bodies, and original exports remain unchanged.
- [x] Unsupported callbacks retain the original route; no asynchronous callback gap is introduced on the composed private path.
- [x] Exact-handler return/error/state/mutable-read-order comparisons; negative revocation, expiry, stale source/fact, profile, boundary, size, pending, typed/unknown error and fresh-save cases pass.
- [x] Finite affected tests, backend/owned test types and scoped lint pass; original failures retained.
- [ ] Independent source acceptance and actual installed cloud outcomes: parent-owned next gate, not performed here.

## Files modified

Three production files above and three scoped tests: `tests/unit/runtimeAgent/whole-recall-composition.test.ts`, `query-embedding-composition.test.ts`, and `bounded-context-v8.test.ts`. No Auth, ModelPolicy, GatewayBackend, MemoryContext, Ingestion, MemoryGateway, domain, client, Proofs or website source was edited. No services, inference, deployment, Git/GitHub, build, package or image operations were performed.

## Verification

Observed Node 24.15.0 / npm 12.2.0; pinned PATH applies to child processes. Jest uses explicit offline mode, CONVEX_URL=http://127.0.0.1:9, --runInBand --watchman=false --forceExit=false. Latest per-file union is **318/318 tests across 9 files, zero skipped/todo**, not one aggregate invocation:

| Test file | Latest receipt | Passed |
| --- | --- | ---: |
| whole-recall-composition | focused-v4 | 69 |
| query-embedding-composition | focused-v2 | 47 |
| bounded-context-v8 | focused-v3 | 21 |
| context-routing | dependencies-v1 | 52 |
| v8-preparation-read-retention | dependencies-v1 | 7 |
| context-source-composition | dependencies-v1 | 56 |
| empty-context-inline | dependencies-v1 | 39 |
| context-source-batch | dependencies-v1 | 25 |
| bounded-context-workflow-v8 | dependencies-v1 | 2 |

Final backend plus owned test TypeScript checks (`final-types-v1`) exit 0; final scoped six-file ESLint (`scoped-lint-v2`) exits 0 with no warnings. All owned check processes closed. No root-wide build/packed contracts were run; parent will run the one shared gate.

Controlled real-handler instrumentation proves exact returned data, state, mutable-get and mutable-query sequence equivalence with zero application writes. Initial raw gets **6→3**, query constructions **238→219**; tail raw gets **39→36**, query constructions **158→139**. These are fixture port calls, not native document counts, CPU or measured cloud savings. The normal private populated branch removes **two outer handoffs**: context inputs + embedding preparation become one query; post-ANN matches + final delivery become one mutation. ANN, billing, capture, attachment, save/candidate and main admission remain separate. Empty context gains no embedding work; its existing native guard work remains.

Source equivalence uses the existing immutable K24 kit's original three staged source files, verified against its retained accepted backend source manifest; it creates no archive, source-preimage or evidence copy. **71 original function bodies** are byte-identical, **3** helper bodies have only declared raw-reader/proposal masks, **3** V8 routing bodies explicitly change, and **121 original constants/registrations** are byte-identical. Guard/predicate bodies are not rewritten. The receipt lists exact current/baseline hashes and masks.

## Preserved failures and repairs

- `focused-v1`: 106/107 passed. A new test expected the composed parent to throw a deliberately deferred final typed refusal immediately. The successor unwraps the exact refusal at the existing Action delivery boundary and compares the full original error; it does not weaken the outcome assertion.
- `backend-types-v1`: union narrowing permitted an optional undefined refusal. The source now checks the actual refusal value before rethrowing it. Successor backend types and final combined types pass.
- `focused-v2`: 134/136 passed. One new test called restoreAllMocks mid-case, accidentally removing the fixed test clock and expiring the next genuine lease; it now restores only its own two spies. Another new test disabled a qualification already required by the original pending scanner, incorrectly expecting pending overflow first. It now faults the actual later embedding-preparation-only guard and proves that guard is not called on pending failure. The original scanner/profile predicates remain unchanged.
- `owned-types-v1`: the temporary QA tsconfig inherited a default rootDir at its own QA directory. The successor explicitly selects the actual repository root; no production/type assertions changed.
- One unapplied patch used an incorrect existing test title and failed before editing. A local diagnostic lookup referenced a nonexistent fixture filename; no source or native state changed. Originals remain in tool history.

## Notes for reviewer

The K24 observed populated prefix still contains warm combined embedding acquisition 1.427 seconds, and its empty browser path already takes 1.5–1.7 seconds before main dispatch. Removing these two handoffs is not a promise of a one-second result. The new final-delivery snapshot is mutation-registered because the original final fence was an internal mutation, even though this parent performs no application writes; it must not be described as a Convex query registration. Final native source/authority fences, actual Action expiry, and fresh saved-context/model guards remain distinct and required. Arbitrary callbacks retain their old fencing interval; the composed callback is internal synchronous bookkeeping only.

Implementation/check milestone: **100%**. Overall latency follow-up: **50%**, unchanged. Source-only status awaits the one joint nonauthor review and subsequent installed qualification.
