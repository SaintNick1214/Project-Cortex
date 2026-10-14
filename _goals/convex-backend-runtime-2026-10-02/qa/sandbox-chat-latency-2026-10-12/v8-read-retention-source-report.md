# V8 raw-read retention and profile composition

Repository: **SaintNick1214/Project-Cortex**. Baseline `3e55e7b9b45093f547699619c572fdbe09c1efde`. Status: **source implementation complete; independent review and native qualification pending**. No service calls, inference, build, packaging, deployment or Git writes were performed.

The repaired V8 path keeps every existing authority, current execution/run, source, transcript, policy, qualification, budget and request predicate. It reduces repeated raw reads within one native invocation and removes nested profile-query handoffs. It does not retain an authorization decision, cache mutable account/run/source rows or increase any deadline, cap or budget.

## Changes

- `runtimeAuth.ts`: additive `createV8AuthorityReadScope`, with an invocation-local, nonserialized brand. Default factory behavior stays fully invalidating. Nested helpers inherit the V8 scope only within that invocation. The four explicit local state tables—Agent executions/operations, run outbox and runs—may retain existing raw authority/policy/exact-message entries. Three financial tables—budget accounts, model operations and attempts—retain **raw authority only**, clearing policy/message entries before and after. Financial records are never cached.
- Every recognized update/delete proves exact table/ID identity through the native `normalizeId` contract and exact writer arity. Missing/refused normalization, opaque IDs, unknown/security tables, fluent writers and every component mutation use full invalidation. Writer-in-flight suppression, late-read epoch fencing, detached copies, entry/byte limits and exception propagation remain. Explicit fresh policy/message save fences remain.
- `runtimeAgent.ts`: only V8 entries opt in. New private main-admission registration shares the original binding/admit/checkpoint body and requires a current V8 snapshot. The shared Action selects that registration only for the original current V8 snapshot. Historical routing and controls remain.
- `runtimeMemoryContext.ts`: optional original profile-reader callback; the default/public/historical path is unchanged. V8 availability runs both original current profile checks locally, including the fresh empty-profile save re-probe.
- `runtimeAgentQueryEmbedding.ts` and `runtimeAgentRecall.ts`: additive private V8 preflight/admission/read/delivery registrations and Action functions. Old Action bodies and refs stay intact. Original source and final return guards receive the **unscoped native context**. V8 final delivery calls the original `checkDelivery` with an inline original profile helper and the raw context for its final authority/expiry check.

No financial handler was fused or reordered. The embedding checkpoint child still rolls back its own partial writes while a bounded refusal preserves the parent reservation. Capture and attachment remain independently durable. Context save/candidate child rollback, replay refusal, UNKNOWN liability, slots, strict barriers and canonical storage are unchanged.

## Observed checks

Pinned Node **24.15.0**, npm **12.2.0**. Offline Jest used explicit test mode, `CONVEX_URL=http://127.0.0.1:9`, in-band execution, `--watchman=false` and no forced exit. The latest actual result for each of **14 affected suites totals 454 passed, zero failed/skipped**. This aggregate combines the recorded original passing suites and targeted successors; it does not erase earlier failed runs.

Controlled **actual registered-handler** comparisons preserve exact return values, all persisted tables/effects and exact non-control DB read identities/argument order:

| Handler | Existing/default scope DB calls | V8 scope DB calls | Authority calls |
| --- | ---: | ---: | ---: |
| V8 preparation | 412 | 332 | 84 → 14 |
| V8 main admission/checkpoint | 140 | 111 | 42 → 14 |

These are fixture DB-call counts, not native document counts or cloud milliseconds. V8 private recall reproduces the original selected items/bindings/witnesses with zero application writes and **zero nested profile queries**, versus one for the same original delivery. Each availability check removes one nested profile query: successful empty preparation has two checks; populated preparation has one, plus one delivery check per distinct exact profile/run-budget group. The original logical profile checks remain.

Tests cover all seven recognized table classes/four writer forms; native ID mismatch/fallback; default/nested scope isolation; mutable state/account freshness; capability/expiry and cloned-row behavior; failed/in-flight/late writes; unknown/security/fluent/component invalidation; absent tombstones; explicit fresh fences; current principal/lease/profile/cutoff/boundary/request refusals; late final revocation; stale fact/source/profile/budget/tombstone/expiry delivery; replay; reserved UNKNOWN; and checkpoint revocation/partial-write/opaque failures. Existing source-getter and default invalidation assertions were preserved.

Production backend types pass. Owned files plus actual transitive dependency types pass; scoped ESLint passes without warnings. Source equivalence records **98/98** original function-body comparisons, with explicit masks limited to V8 routing/factory/version checks and the additive profile callback. The two new V8 Action bodies differ from their original counterparts only by three private references. This is source equivalence evidence, not native OCC proof.

## Preserved failures and limits

`auth-v1` is retained at **95/99**: four new fixture failures involved restoring a disabled normalizer, a fluent mock's table-dependent getter and applying `getFunctionName` to a component reference. The corrected new suite is **43/43**; the three original suites had passed unchanged. `parents-v1` remains **179/180**: one new fixture compared empty tables materialized by reads; its successor uses the original read's baseline and an explicit zero-write assertion. Owned types v1 retains its single unknown index-builder typing error; a fixture object guard repairs it. Successors and raw logs are recorded in `v8-read-retention-checks.json`.

Corrected K22 shows populated recall **2,336 / 3,346 / 3,886 / 4,566 ms**, direct native preparation **211 / 314 / 419 / 449 ms**, and four caller SLO failures. Those receipts qualify the previous source, not this candidate. Budget-account OCC, external model acquisition, Action handoffs, fresh save/current-execution checks and protected output/client delivery remain. No multi-second saving or subsecond success is claimed. Concurrent native revocation/OCC and actual installed latency remain for the next authorized disposable qualification.

**Milestone: bounded implementation and affected checks 100%; latency follow-up remains 50%, with K22 subsecond qualification 0/4.** One combined non-author review and shared root/build/packed gate remain owned by the parent.
