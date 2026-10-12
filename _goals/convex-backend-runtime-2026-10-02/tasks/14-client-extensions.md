# Task 14: TypeScript media, embedding and UI extensions

**Current acceptance scope — version3, 2026-10-11:** The user defers asynchronous video and its native/client outcome qualification after Convex Support confirms it cannot be enabled. Apply the [exact criterion map](../qa/video-deferral-2026-10-11/scope-amendment.md) to the requirements below. Every non-video requirement and shared safety gate remains. Current scoped acceptance is approved under version3 by the [independent final audit](../qa/video-deferral-2026-10-11/final-review.md); the original checkboxes, partial verdicts and historical completion figures below are preserved and do not become video PASS.

**Status:** ACCEPTED under scope-version3; video requirements deferred. [Independent final audit](../qa/video-deferral-2026-10-11/final-review.md).
**Historical original-scope status:** Partial independent acceptance: 3/4 original criteria accepted; genuine async-service outcomes and full task remain incomplete.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [09 Minimal text clients and UI vertical slice](09-text-client-slice.md), [10 Clean-slate embedding storage and retrieval](10-embedding-profiles.md), [12 Convex-owned assets and bounded private delivery](12-asset-lifecycle.md), [13 Gateway image and durable asynchronous video jobs](13-media-jobs.md)

## Objective

Extend the qualified text/run clients with embedding, media/upload and persisted artifact behavior.

## Requirements

- [ ] Substep 14A: extend the versioned shared contract and TS APIs for embedding profile guards, media jobs/artifacts/inputs, stage-specific strict barriers and capability errors; retain the existing text/run cursor semantics.
- [ ] Substep 14B: extend the qualified Vercel AI SDK 7 text transport/hooks with persisted multimodal/artifact/job state, renderers and restart/reconnect support; keep one backend tool and memory writer.
- [ ] Propagate config/auth through every factory, keep backend credentials/modules out of browser bundles and provide explicit unsupported capability errors.

## Acceptance Criteria

- [ ] TypeScript clients create and observe the same backend outcomes, with equivalent scope/error/cancel/media behavior and token refresh handling.
- [x] React reconnect rebuilds text/tool/artifact state without duplicate messages or local-only artifact loss.
- [x] AI SDK UI finishes before delayed memory work, tool execution occurs only in backend and factories require no provider keys.
- [x] Package exports and browser builds expose neither action credentials nor Node graph modules; unsupported deployments fail inference explicitly.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §8. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** src/index.ts and client namespaces; packages/vercel-ai-provider src/react.

## Validation and Execution Notes

Assign 14A/14B as bounded disjoint implementation substeps with separate receipts; freeze contract first. Provider/memory gates apply.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.


### Recorded partial acceptance

Checkboxes reflect the already recorded non-author [criterion verdict](../qa/local-resume-2026-10-05/task13-task14-product-independent-review1/verdict1.json). No new grant or unavailable-capability success is implied. Original criteria, failed intervals and service blockers remain unchanged.
