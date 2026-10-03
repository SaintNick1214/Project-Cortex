# Task 11: Scoped durable external graph projection

**Status:** Planning only — pending execution authorization.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [03 Verified identity, grants and alternate endpoint closure](03-authorization.md), [08 Durable asynchronous memory and belief consistency](08-memory-pipeline.md)

## Objective

Move graph orchestration off developer apps while preserving external graph storage boundaries.

## Requirements

- [ ] Entry gate: qualify the actual graph runtime/network/service; a Node connector or trusted worker is required for this task, not for the earlier text slice.

- [ ] Use tenant-scoped versioned outbox, leases, deduplicated receipts, bounded retry and explicit dead-letter status; atomic fact commits enqueue projection.
- [ ] Deploy qualified Node connector or trusted worker seam; do not instantiate the SDK subscription worker in actions.
- [ ] Apply remote revision/epoch fencing and transactional tombstones where supported; otherwise reconcile against authoritative state and keep strict graph freshness blocked until repair. A preflight local check alone cannot stop an already-issued stale external write. Graph expansion respects grant/profile/source revision; deletion and revoked work cannot restore nodes; expose graph lag separately and support strict barrier when requested.

## Acceptance Criteria

- [ ] Actual qualified Neo4j/Memgraph service receives ordered, deduplicated updates after worker failure/retry.
- [ ] Cross-tenant graph access is denied. An old worker whose lease expires during an external write cannot overwrite a newer revision or restore deleted content after delayed arrival; verify fencing or detected reconciliation, including strict freshness behavior.
- [ ] Exhausted retry is failed rather than synced; app disconnect has no effect on eventual projection.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §5. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** convex-dev/graphSync.ts; src/graph/adapters/; backend graph connector/worker.

## Validation and Execution Notes

Profile graph/isolation skills with actual graph evidence. Missing services remain BLOCKED; external storage is not migrated into Convex.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.
