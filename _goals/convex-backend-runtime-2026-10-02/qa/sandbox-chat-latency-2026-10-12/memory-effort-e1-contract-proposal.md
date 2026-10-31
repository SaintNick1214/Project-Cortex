# E1 contract proposal — memory effort

2026-10-14. Preparation only at `f87695783e8b21ffecf6298057a87cd8e69a3016`; product edits/checks/services remain on HOLD until Root's GO after K29. The accepted v4 amendment and acceptance-policy v2 govern. Original 17-task acceptance is not reopened.

## Shared public contract

Add browser-safe `src/domain/memory-effort.ts`, exporting:

```ts
type MemoryEffort = "fast" | "normal" | "high" | "max";
interface MemoryEffortRequest {
  effort?: MemoryEffort; // omitted => normal for new effort-aware use
  maxEntries?: number;  // optional lower ceiling, integer >= 0
  maxContextTokens?: number; // optional lower ceiling, positive integer
}
```

Also export `MemoryEffortPolicyV1`, `EffectiveMemoryEffortPolicy`, `MemoryEffortTrace`, `MemoryEffortStopReason`, `MEMORY_EFFORT_POLICY_V1`, `normalizeMemoryEffortRequest`, and `resolveMemoryEffortPolicy`. Exact request fields are validated; callers cannot supply depth, administrator policy, model, work budgets or effective metadata. Domain helpers stay free of backend/Node imports.

- Public runtime recall accepts `memory?: MemoryEffortRequest` beside existing `text/requestId/limit`. Text submissions accept the same optional `memory` field. Root/E2 owns additions/re-exports in `src/types/index.ts`, `src/index.ts`, `src/client-runtime/*`, provider/CLI/consumer files; E1 owns domain/transcript normalization and backend propagation. Use one shared type definition, not independently maintained enums.
- Existing explicit `recall.limit` remains a lower result ceiling. Omitted limit becomes the effort ceiling for effort-aware use; Max does not inherit a hidden ten-item cap. Legacy API envelopes with explicit limits retain those limits. Mandatory current input/tool groups keep their current admission semantics.
- Fast/Normal/High resolve to depth 2/4/8, optional entries 4/8/16 and hosted targets 3000/6000/8000 ms. Max depth/entry ceilings are `null`, meaning no preset product cap; its target is 30000 ms. Caller lower ceilings, administrator settings, qualified model/context/output limits and work/deadline limits intersect; nothing raises a bound. The current 32768 qualified conservative input ceiling remains.
- New results/public run metadata expose `memoryEffort?: MemoryEffortTrace`: version/policy version, requested/effective effort and effective ceilings, reached depth; visited/expanded/selected/deduplicated counts and counts by kind; selected conservative input units; retrieval duration/stage timings; stop reasons and unavailable stages. Per-item logical depth/path metadata is additive. No evidence text enters ordinary telemetry. No matches and unavailable search are distinct. Retrieval metadata does not assert the hosted target passed.

## Compatibility and snapshots

Keep existing V8 registrations, execution journal and direct/workflow paths. Add a discriminated V2 selection policy/metadata to `src/domain/model-input-selection.ts` and the V8 cutoff's `inputSelection` union in `src/domain/transcript.ts`. V1 policies and V8 `inputSelection.version:1` retain exact existing interpretation and hashes. New effort-aware immutable definitions use the new selection version, pinned normalized administrator effort policy and policy hash. Add a registry revision/handler version only where needed to distinguish this contract; no parallel V9 endpoint family.

`runs.submit` resolves and pins effective request policy before admission; capture/rehydration validates the pinned policy against the immutable definition and request. New effort-aware use with omitted request effort is Normal. Old definitions/snapshots retain V1 behavior rather than acquiring invented missing fields. Explicit effort on a definition that cannot interpret it must fail clearly, not disappear. Add the optional normalized request field to canonical submission binding: a replay with changed effort/ceilings conflicts before effects. Public recall's exact budget-request binding includes the requested effort/ceilings and policy identity consistently in both the action and native preparation/admission; preserve recognition of legacy binding envelopes and reject incompatible reuse. Effective trace is server output, never caller authority.

## Actual logical traversal

Add pure `src/domain/memory-traversal.ts` (`MemoryEvidenceNode`, `MemoryEvidenceEdge`, `MemoryEvidencePage`, `traverseMemoryEvidence`) and backend `convex-dev/runtimeMemoryTraversal.ts`. Direct relevant vector/fact/pending matches are depth1 regardless of age. Hydration/source verification/index membership rows add no hops. Expand breadth-first with deterministic relevance/tie ordering and shortest-depth visited identities. Useful edges are:

1. fact → its exact current supporting source/message;
2. source/message → its current derived facts, using existing `facts.by_runtime_source` with tenant, space, source and revision;
3. fact → another fact with an exact scoped entity/explicit relationship endpoint supported by stored `subject/object/entities/relations`. The membership join is one evidence connection, not an extra synthetic entity hop.

Add `runtimeMemoryFactEntities` in `runtimeMemorySchema.ts`: tenant/space, owner, exact normalized entity key, fact ID/version and source event/revision. Index `by_scope_entity` (tenant,space,entityKey,factId), `by_owner_entity` (tenant,space,owner,entityKey,factId), and `by_scope_fact` (tenant,space,factId). Populate/replace bounded memberships atomically from current derived fact commits; share the existing projection producer seam in `runtimeGraph.ts`/`enqueueFactProjection` where needed for current fact updates. Projection is Convex-backed and runs without an external graph connector. Add only narrow subject/object indexes on `facts` if required for existing scalar links. No broad fact scan or legacy backfill. Missing older entity projection is observable partial coverage; never claim exhaustion of unavailable links. External-only graph coverage remains explicitly unavailable unless actually connected and verified.

Every candidate is hydrated against the current fact and supporting source; compare membership fact version and source lineage, then apply current scope/owner/grant/tombstone/supersession/validity predicates. Bind intermediate path facts as well as returned evidence to final delivery, so a revoked or changed bridge cannot justify a result. Agent reads additionally apply the existing cutoff/boundary/excluded-source and witness rules. No same-conversation link is invented.

Bound seed reads, adjacency pages, entity-key processing, candidate bytes and total visited/expanded work separately from selected count. Check cancellation/deadline before and after awaited pages; allocate retrieval time within the hosted target. Page/work limits can stop Max with useful results and an explicit partial reason. Max has no disguised depth/entry cap. Count source/chunk/vector/message aliases once; allow a fact plus a distinct supporting message. Keep chronological executable message order and whole required tool groups. V2 fitting uses one relevance-ranked optional-entry cap across history, facts, memories and pending evidence; required pending coverage still triggers the original explicit incomplete/fail policy on overflow, never silent completeness.

## Intended E1 edits and proof

Domain: new `memory-effort.ts`, `memory-traversal.ts`; existing `contracts.ts` (optional bounded evidence-read seam), `model-input-selection.ts` (V2 shared cap/fitting), `transcript.ts` (request binding and versioned selected cutoff), `recall.ts` (depth-aware dedupe metadata only where needed).

Backend: `runtimeMemoryTraversal.ts`, `runtimeMemorySchema.ts`, `schema.ts`, `runtimeMemoryRepository.ts`, `runtimeMemoryServices.ts`, `runtimeMemoryQuery.ts`, `runtimeMemory.ts`, `runtimeAgentRecall.ts`, `runtimeAgentQueryEmbedding.ts`, `runtimeAgentContext.ts`, `runtimeAgent.ts`, `runs.ts`, `runtimeTranscript.ts`, `runtimeTranscriptSchema.ts`, `runtimeAgentSchema.ts`, `agentDefinitions.ts`, and scalar allowlist additions in `runtimeLatencyTrace.ts`. `runtimeGraph.ts` only for the existing fact-projection producer seam. Generated bindings/mirrors come from normal codegen/build, never hand editing. Add internal registrations to the existing authorization inventory when applicable.

Tests: extend `tests/unit/runtimeMemory/fixture.ts` and corresponding repository/services/public binding tests, `runtimeAgent/model-input-selection.test.ts`, `runtimeAgent/bounded-context-v8.test.ts`, `runtimeTranscript/contracts.test.ts` and `managed.test.ts`; add `runtimeMemory/memory-effort.test.ts`, `memory-traversal.test.ts`, and narrow schema/index/registration assertions. Preserve old-version tests.

Use a uniquely labeled 12-fact chain with current source provenance and alternating explicit entity endpoints; only node1 is a seed. Assert cumulative reachable evidence: Fast reaches2/not3, Normal4/not5, High8/not9, Max9+ while context/work remain. Separately seed a deep/old node directly and assert depth1. Exercise actual repository indexed expansion, not a precomputed list or integer mapping. Assert bounded page reads under fan-out; cycles/shortest alternate paths; vector/chunk/source dedupe; lower ceiling clamps; missing projection; stale/revoked/deleted/changed bridge rejection; pending/strict behavior; cancellation/deadline/work/context stops; intact tools; and unchanged canonical rows/count/content across modes. Public and Agent paths must use the same traversal, not only a pure helper fixture. Run affected lint/type/build/unit/contract checks only after GO; hosted profile/installed/browser results belong to later qualification.

No builds, tests, codegen, services, inference, credentials, source edits, commits, pushes or archive copying were performed for this proposal.
