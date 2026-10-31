# Task 11: Scoped durable external graph projection

**Status:** Complete — original Task11 independently accepted PASS4.0 under acceptance-policy.md v2; all four requirements and three acceptance criteria met. Full goal and final audit remain open.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [09 accepted actual text/UI slice](09-text-client-slice.md), [03 authorization foundation](03-authorization.md#authorization-execution-gates), [08 Durable asynchronous memory and belief consistency](08-memory-pipeline.md)

This execution prerequisite means independently accepted **03-foundation**, not full03-final. All original Task03 functional criteria remain required at their mapped implementation gates and03-final before Task17. See [accepted sequencing contract](../qa/resume-dependency-refinement-c2/plan.md).

## Objective

Move graph orchestration off developer apps while preserving external graph storage boundaries.

## Requirements

- [x] Entry gate: qualify the actual graph runtime/network/service; a Node connector or trusted worker is required for this task, not for the earlier text slice.

- [x] Use tenant-scoped versioned outbox, leases, deduplicated receipts, bounded retry and explicit dead-letter status; atomic fact commits enqueue projection.
- [x] Deploy qualified Node connector or trusted worker seam; do not instantiate the SDK subscription worker in actions.
- [x] Apply remote revision/epoch fencing and transactional tombstones where supported; otherwise reconcile against authoritative state and keep strict graph freshness blocked until repair. A preflight local check alone cannot stop an already-issued stale external write. Graph expansion respects grant/profile/source revision; deletion and revoked work cannot restore nodes; expose graph lag separately and support strict barrier when requested.

## Acceptance Criteria

- [x] Actual qualified Neo4j/Memgraph service receives ordered, deduplicated updates after worker failure/retry.
- [x] Cross-tenant graph access is denied. An old worker whose lease expires during an external write cannot overwrite a newer revision or restore deleted content after delayed arrival; verify fencing or detected reconciliation, including strict freshness behavior.
- [x] Exhausted retry is failed rather than synced; app disconnect has no effect on eventual projection.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §5. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** convex-dev/graphSync.ts; src/graph/adapters/; backend graph connector/worker.

## Validation and Execution Notes

Profile graph/isolation skills with actual graph evidence. Missing services remain BLOCKED; external storage is not migrated into Convex.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.

## Independent functional acceptance — 2026-10-08

[One nonauthor review](../qa/local-resume-2026-10-05/task11-product-independent-review1/report1.md) and [verdict](../qa/local-resume-2026-10-05/task11-product-independent-review1/verdict1.json) accept the full original Task11. Installed Node ESM/CJS worker and actual Neo4j/Memgraph qualify ordered retry, deduplication, source/profile/lease/grant fencing, transitive retirement, held stale writes, network timeout recovery, explicit dead-letter/strict freshness and application-independent execution. Current final installation preserves seven unrelated host files and exact model-policy proofs.

[Native report](../qa/local-resume-2026-10-05/task11-graph-functional-v2-20261008/native-actual/final-native-report1.json) binds source and raw outcomes; author369, Root26 and independent16 controlled cases are separate scopes and are not summed. All historical failed intervals and oracle corrections are retained. Task11 makes no model calls; five prior attempts and full500000 uncertain liability remain with zero active slots. Both graph content sets are empty with twelve retained tombstone fences; eleven Task11 grants/scopes retired. Owned development target3174742 and two graph containers are explicitly retained for later authorized qualification and require final-goal retirement. This acceptance does not complete Task12+,03-final, aggregate outcomes or the final audit.
