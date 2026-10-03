# Task 02: Backend-friendly memory domain services

**Status:** Planning only — pending execution authorization.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [01 Stack and execution-boundary qualification](01-qualification.md)

## Objective

Separate reusable Cortex domain logic from application-held clients and workers.

## Requirements

- [ ] Execute bounded substeps with disjoint ownership and separate receipts: 02A pure normalization/ranking/context/extraction/conflict modules; 02B scoped backend repository/model/clock adapters and explicit remember/recall wiring. Freeze 02A interfaces before 02B. Implement the fresh default source/chunk/vector contract qualified in Task 01; additional profile qualification remains Task 10.
- [ ] Extract pure normalization/ranking/context-formatting/extraction schemas/prompts and conflict logic with explicit repository/model/clock adapters.
- [ ] Backend services use scoped Convex ctx operations and Gateway; clients never instantiate the backend runtime or bundle tokens.
- [ ] Route explicit modern remember/recall operations through shared domain services; deployed extensions replace local callback assumptions.

## Acceptance Criteria

- [ ] A backend action can invoke domain services without new Cortex(), ConvexClient, browser subscriptions or a local GraphSyncWorker.
- [ ] Existing normalization/ranking/extraction/conflict outcome fixtures remain equivalent where source-policy changes are not intended.
- [ ] Internal extraction/embedding calls cannot recursively enter the user-chat context/remember wrapper.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §§5, 8. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** src/memory/; src/facts/; src/llm/; src/index.ts; backend domain modules.

## Validation and Execution Notes

Profile §5 memory API exemplars; preserve dirty src/index.ts work. Meaningful domain fixtures and scoped backend typechecking after execution.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.
