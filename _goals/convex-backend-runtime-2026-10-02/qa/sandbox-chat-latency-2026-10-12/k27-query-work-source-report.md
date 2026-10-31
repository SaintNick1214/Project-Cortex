# K27 query-work source completion

Status: **COMPLETE for this source/test scope; joint review and native qualification pending.** Product baseline is `9fb9687536af0b7abfcb7280e0aa26ef450051ea`; HEAD `194bfd788e6fa7316707023ecd8d8bdcb813dc17` is the QA-only successor. No services, inference, SDK build, package, Git writes, Proofs or website edits were performed by A.

## Changes and retained boundaries

- `runtimeAuth.ts` adds a private same-owner traversal-reader factory on explicitly opted native source scopes. `withManagedSourceReads` stays unchanged as the K26 graph-only control. Its new validation view shares graph rows/writer epochs, but creates a fresh bounded detached authority reader for each `managedSourceIsCurrent` traversal. Existing full parent readers remain intact. The next source getter and final raw authority fence remain fresh. Every original permission, ancestry, source hash/currentness, clock/expiry and duplicate predicate still executes. Writers invalidate before/after success/error, with hit/population suppression while pending. Default/unbranded/wrong-owner contexts and child contexts cannot inherit the new view.
- `runtimeDataAuth.ts` changes only that traversal context adapter. `runtimeAgentRecall.ts` activates the explicit view in the existing trusted source branches; keeps final graph reset, unscoped native authority, independent delivery and fresh save/child boundaries.
- `runtimeMemory.ts` explicitly enables graph reuse in existing internal read entries. `readSource`, write paths and public Action bodies remain unchanged. Its existing `readFacts` registration accepts optional **internal-only** `includeBindings:true`: original `listFacts`, ordered original `getSource` and `captureRecallFact` run in one fresh snapshot and finish with raw authority recheck. Omission still returns the original fact array. No registration was added.
- `runtimeMemoryRepository.ts` preserves the entire `ConvexMemoryRepository` class. An explicit public-recall post-embedding option consumes the bound fact envelope instead of issuing one source RPC per fact. `runtimeMemoryQuery.ts` enables it only after the original governed embedding. Generic/injected adapters retain their original per-source path. Original vector-first staged error ordering, ranking, final independent `finalDelivery`, raw final grant/clock/source fence and Action real-clock check remain.

No policy verdict, source-return object, mutable finance/output/account/ledger/usage row, process, Action or cross-RPC decision cache was added. No ranking/candidate/selection, tool, canonical transcript, cap, deadline, paid retry or journal change was made.

## Controlled results against K26

| Actual handler control | K26 baseline | K27 | Evidence |
|---|---:|---:|---|
| Agent read/delivery, shared ancestry | 557 reads /310 returned docs | 261 /150 | Same unique raw identity set, complete output/state, mutable order, raw final fence |
| Agent read/delivery, distinct ancestry | 565 /314 | 285 /154 | Same controls |
| Save plus independent candidate child, shared/distinct | 207 /223 reads | 207 /223 | Exact output, writes, state and native readset; **no saving claimed** |
| Public populated three-fact Action: fact/source RPCs | 4 | 1 | Same generic result; one controlled embedding dispatch total, attached replay has no second dispatch |
| Public final delivery, shared/distinct graph | 61 /65 reads | 59 /65 | Exact raw identities/output and other read order; distinct graph has no duplicate to remove |

These are controlled native storage/component ports, not hosted timings. K26 public recall's observed 3,224.7 ms and all four SLO failures remain unchanged historical evidence. The batch makes no native speed or one-second acceptance claim.

## Verification

Pinned Node24.15.0/npm12.2.0 PATH; `CORTEX_TEST_ENV_MODE=explicit`, `CONVEX_URL=http://127.0.0.1:9`, userconfig `/dev/null`. The final selected **20 suites were discovered and passed: 893/893, zero skips/todos**, direct exit0 (`k27-affected-v1.{json,log}` and `-exit.json`). Owned plus transitive TypeScript and scoped ESLint both exit0. Original source/authority/profile/budget/deletion/expiry/currentness, stale-source/final-hash revocation, async callback fallback, rollback and writer in-flight/error tests remain green. New public bound-fact late revocation/revision/tombstone controls compare actual original and optimized results with zero handler writes. Root owns the one combined full quality/build/contracts and independent review.

Preserved failures: focused-v1 had four obsolete factory-toggle port comparisons (195/199); its fixture now toggles the new explicit entry factory with all original assertions. Focused-v2 exposed the rejected full-reader overwrite, including save read regressions 207→543 /223→639; the final implementation avoids that overwrite. Focused-v3's one new prospective distinct-graph reduction assertion was false (65→65); it now asserts equality there and reduction only for shared identity, retaining every functional oracle. Two QA-only textual checker failures (mask shorthand and token-stream substring) are retained; they caused no source/test change or broad rerun. Final equivalence records97 checks, unchanged registered name/kind sets, the exact original raw reader mapping, all original DataAuth predicates under one context mask, unchanged repository class, and92 exact original test callbacks. It is supporting evidence, not independent acceptance.

## Frozen files and handoff

Exact six production/five test hashes, check commands/exits and raw failure hashes are in `k27-source-freeze.json`; the original-body comparisons are in `k27-equivalence.json`. Five tests cover Auth managed-source scopes, Agent whole-recall, public query composition, delivery batching and entry activation. The sole existing test-fixture adjustment is its explicit new factory toggle; original test callbacks are unchanged. No further source edits or checks are planned. All A work is offline, with no native clients or owned service resources.
