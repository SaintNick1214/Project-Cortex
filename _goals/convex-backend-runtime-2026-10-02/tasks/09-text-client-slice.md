# Task 09: Minimal text clients and UI vertical slice

**Status:** Complete — all original requirements and five acceptance criteria independently accepted under policy v2, PASS4.0 on 2026-10-08. Full goal and Tasks10–17/03-final remain open.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [06 Additive backend development installation](06-additive-installation.md), [07 Agent execution and durable reactive output](07-agent-streams.md), [08 Durable asynchronous memory and belief consistency](08-memory-pipeline.md)

Text execution consumes accepted03-foundation and05/07/08 functional text authorization, not later03-assets or03-final. All original text/UI/native evidence is required before extensions.

## Objective

Prove the complete authenticated text architecture in modern TS and a small UI before media/vector/graph extension work.

## Requirements

- [x] Use Task 01 versioned text/run/event/error contracts for TS start/get/observe/cancel/approval and explicit memory receipts, with auth refresh and reconnect cursors. Pin server scope and run policy.
- [x] Provide an AI SDK 7 remote-run text UI transport and one canonical quickstart text path with a registered backend tool. The app has no model/tool loop or second remember writer.
- [x] Observe response finality separately from delayed memory status, expose strict memory barrier and context-overflow behavior, and keep unsupported inference capability errors explicit.
- [x] Maintain browser-safe package boundaries; backend/Node graph dependencies and tokens cannot leak into client bundles. Media/embedding/upload/artifact extensions are Task 14.

## Acceptance Criteria

- [x] Actual authenticated text turn recalls scoped Cortex memory, executes one backend tool and reaches final output while intentionally delayed indexing remains pending.
- [x] Disconnect/reconnect and a second observer reconstruct one transcript/output without duplicated tool or ingestion effects; cancellation and approval continuation produce typed terminal states.
- [x] An immediate next turn uses the eligible unprocessed tail. A strict barrier does not pass across a failed earlier event followed by a completed later event.
- [x] TS and the UI observe equivalent run/scope/error semantics without upstream provider keys; credential refresh and unauthorized observation are exercised.
- [x] The slice runs using Tasks 01–09 alone. No graph service, media enablement, private-video storage or alternate embedding-profile prerequisite is introduced.

## Context and Research

[Architecture](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), §§4–5, 8, 10. Qualify actual managed retrieval for the fresh core default profile selected in Task 01 and implemented in Tasks 02/04/08 before this task's PASS. Source revisions, declared dimensions and query/index policy must match; no prior vector architecture is reused. Additional profile qualification remains Task 10.

**Likely areas:** core TS client facade, Vercel remote UI transport, canonical quickstart text route and focused fixtures. Use bounded disjoint TS/UI substeps after the shared contract is fixed.

## Validation and Execution Notes

Apply affected provider/memory/isolation and scoped quickstart UI checks with actual auth/model/managed retrieval on the disposable target. Missing core prerequisites remain BLOCKED. This early slice is evidence for text behavior only, not completion of the full goal's media/graph/vector requirements.

No implementation, paid inference, testing or deployment is authorized by this planning file. Re-read target AGENTS.md, Git status and manifests at execution and preserve local work.

## Functional acceptance (2026-10-08)

One reused non-author original-task review PASS4.0 covers current browser-safe client/AI SDK7 remote transport, actual authenticated two-observer final/pending/next-tail outcomes, approved bounded continuation, cancellation, strict failed-earlier hole and context overflow. Current installed terminal projection is verified on the original rows without restart. Native target3173328 retired200/404; all24 governed attempts release slots and retain uncertain liability. Model quotation/rhetorical confirmation, narrow viewport unavailable and clipped agent field remain disclosed. Historical A/D/fixture failures are preserved. See `../qa/local-resume-2026-10-05/task09-product-independent-review1/` and Root/native09 reports. No extension or full-goal acceptance.
