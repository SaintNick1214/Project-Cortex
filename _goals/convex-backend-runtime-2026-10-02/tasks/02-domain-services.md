# Task 02: Backend-friendly memory domain services

**Status:** COMPLETE — independently accepted PASS4.0 under acceptance-policy v2 on2026-10-08; original criteria retained.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [01 Stack and execution-boundary qualification](01-qualification.md)

## Objective

Separate reusable Cortex domain logic from application-held clients and workers.

## Requirements

- [x] Execute bounded substeps with disjoint ownership and separate receipts: 02A pure normalization/ranking/context/extraction/conflict modules; 02B scoped backend repository/model/clock adapters and explicit remember/recall wiring. Freeze 02A interfaces before 02B. Implement the fresh default source/chunk/vector contract qualified in Task 01; additional profile qualification remains Task 10.
- [x] Extract pure normalization/ranking/context-formatting/extraction schemas/prompts and conflict logic with explicit repository/model/clock adapters.
- [x] Backend services use scoped Convex ctx operations and Gateway; clients never instantiate the backend runtime or bundle tokens.
- [x] Route explicit modern remember/recall operations through shared domain services; deployed extensions replace local callback assumptions.

## Acceptance Criteria

- [x] A backend action can invoke domain services without new Cortex(), ConvexClient, browser subscriptions or a local GraphSyncWorker.
- [x] Existing normalization/ranking/extraction/conflict outcome fixtures remain equivalent where source-policy changes are not intended.
- [x] Internal extraction/embedding calls cannot recursively enter the user-chat context/remember wrapper.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §§5, 8. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** src/memory/; src/facts/; src/llm/; src/index.ts; backend domain modules.

## Validation and Execution Notes

Profile §5 memory API exemplars; preserve dirty src/index.ts work. Meaningful domain fixtures and scoped backend typechecking after execution.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.


Current independent acceptance: [coherent Task02/04 verdict](../qa/local-resume-2026-10-05/task04-backend-gateway-independent-review1/verdict1.json), [report](../qa/local-resume-2026-10-05/task04-backend-gateway-independent-review1/report1.md). Original requirements/criteria completed at accepted C2/C3 boundaries. Full Task03, executable Agent/Workflow05/07, additive installation06, further profiles/stream/tools/media and full goal remain outside this verdict. Historical planning-only authorization paragraphs do not override the user execution instruction. All historical QA failures and scoped verdicts are preserved.
