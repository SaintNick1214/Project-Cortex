# Task 08: Durable asynchronous memory and belief consistency

**Status:** Execution authorized — pending prerequisite implementation and independent acceptance.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [02 Backend-friendly memory domain services](02-domain-services.md), [05 Canonical transcript, agent definitions and run admission](05-transcripts-runs.md), [07 Agent execution and durable reactive output](07-agent-streams.md)

## Objective

Update Cortex memory independently of response delivery with explicit freshness and ordering guarantees.

## Requirements

- [ ] Execute bounded substeps with separate receipts: 08A durable source/stage records, pinned extraction and default-profile vector jobs; 08B ordered atomic belief/history/projection commits and tombstone/revision fencing; 08C contiguous watermarks, pending-tail context and strict barriers. Freeze shared records/interfaces before dependent edits and serialize schema/finalization writes. Prove the fresh default profile's source/chunk/vector and query-policy matching here; managed retrieval is a Task 09 acceptance prerequisite, while additional profiles remain Task 10.
- [ ] Persist source-role/trust/event lineage and pinned extraction versions; enqueue eligible user work during response and completed assistant work according to policy.
- [ ] Deduplicate per-stage extraction/fact/vector receipts; atomically version-check and apply belief revision/history/outbox; enforce source ordering for corrections.
- [ ] Implement scoped stage-specific indexedThrough watermarks defined by contiguous eligible completion, with explicit holes/failed receipts rather than the highest completed sequence, bounded eligible pending-tail context and strict stage-specific memory barrier; handle oversized tail/deadlines explicitly.
- [ ] Bound retries and dead-letter states; deletion tombstones, source revision changes and revoked grants block every late commit. Unlocked transcript edits invalidate affected derived data and reset stage readiness until eligible repair completes. Expose response success with indexing pending/failed.

## Acceptance Criteria

- [ ] Response reaches final before delayed extraction finishes, and next same-thread turn answers from unprocessed approved history.
- [ ] Cross-thread pending updates and strict barrier have documented measurable behavior; an earlier failed/pending event followed by a later completed event cannot advance the contiguous watermark across the hole. Tail overflow cannot silently claim fresh context.
- [ ] Duplicate jobs, reversed correction completion, concurrent fact mutation and delete-during-extraction cannot duplicate, restore stale or recreate facts. Editing a source while extraction is running rejects the obsolete result; stale derived memory is excluded until repair.
- [ ] Assistant speculation and cancelled partial output are not recorded as authoritative user assertions; failures remain observable and retryable.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §5. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** backend ingestion/outbox/watermark services; src/memory/ domain logic; facts/belief-revision; governance/deletion.

## Validation and Execution Notes

Memory and isolation skills; forced failure/race assertions rather than implementation-mirroring tests. Stage freshness is explicit.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.
