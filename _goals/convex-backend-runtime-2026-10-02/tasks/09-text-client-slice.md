# Task 09: Minimal text clients and UI vertical slice

**Status:** Planning only — pending execution authorization.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [06 Additive backend development installation](06-additive-installation.md), [07 Agent execution and durable reactive output](07-agent-streams.md), [08 Durable asynchronous memory and belief consistency](08-memory-pipeline.md)

## Objective

Prove the complete authenticated text architecture in modern TS and a small UI before media/vector/graph extension work.

## Requirements

- [ ] Use Task 01 versioned text/run/event/error contracts for TS start/get/observe/cancel/approval and explicit memory receipts, with auth refresh and reconnect cursors. Pin server scope and run policy.
- [ ] Provide an AI SDK 7 remote-run text UI transport and one canonical quickstart text path with a registered backend tool. The app has no model/tool loop or second remember writer.
- [ ] Observe response finality separately from delayed memory status, expose strict memory barrier and context-overflow behavior, and keep unsupported inference capability errors explicit.
- [ ] Maintain browser-safe package boundaries; backend/Node graph dependencies and tokens cannot leak into client bundles. Media/embedding/upload/artifact extensions are Task 14.

## Acceptance Criteria

- [ ] Actual authenticated text turn recalls scoped Cortex memory, executes one backend tool and reaches final output while intentionally delayed indexing remains pending.
- [ ] Disconnect/reconnect and a second observer reconstruct one transcript/output without duplicated tool or ingestion effects; cancellation and approval continuation produce typed terminal states.
- [ ] An immediate next turn uses the eligible unprocessed tail. A strict barrier does not pass across a failed earlier event followed by a completed later event.
- [ ] TS and the UI observe equivalent run/scope/error semantics without upstream provider keys; credential refresh and unauthorized observation are exercised.
- [ ] The slice runs using Tasks 01–09 alone. No graph service, media enablement, private-video storage or alternate embedding-profile prerequisite is introduced.

## Context and Research

[Architecture](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), §§4–5, 8, 10. Existing same-profile vector retrieval can be qualified for text recall; alternate profile selection/guards remain Task 10.

**Likely areas:** core TS client facade, Vercel remote UI transport, canonical quickstart text route and focused fixtures. Use bounded disjoint TS/UI substeps after the shared contract is fixed.

## Validation and Execution Notes

Apply affected provider/memory/isolation and scoped quickstart UI checks with actual auth/model/managed retrieval on the disposable target. Missing core prerequisites remain BLOCKED. This early slice is evidence for text behavior only, not completion of the full goal's media/graph/vector requirements.

No implementation, paid inference, testing or deployment is authorized by this planning file. Re-read target AGENTS.md, Git status and manifests at execution and preserve local work.
