# Task 14: TypeScript media, embedding and UI extensions

**Status:** Planning only — pending execution authorization.
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
- [ ] React reconnect rebuilds text/tool/artifact state without duplicate messages or local-only artifact loss.
- [ ] AI SDK UI finishes before delayed memory work, tool execution occurs only in backend and factories require no provider keys.
- [ ] Package exports and browser builds expose neither action credentials nor Node graph modules; unsupported deployments fail inference explicitly.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §8. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** src/index.ts and client namespaces; packages/vercel-ai-provider src/react.

## Validation and Execution Notes

Assign 14A/14B as bounded disjoint implementation substeps with separate receipts; freeze contract first. Provider/memory gates apply.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.
