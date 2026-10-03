# Task 01: Stack and execution-boundary qualification

**Status:** Planning only — pending execution authorization.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** Later execution request and verified disposable prerequisites

## Objective

Qualify the composed stack and finalize the run/tool/stream/storage contracts before production implementation.

## Requirements

- [ ] Record a qualified lock matrix for AI SDK >=7.0.105, Gateway provider, Agent, Workflow/Workpool, Convex >=1.46 and the repository Node >=24.15.0 / npm 12.2.0 floor; isolate Node-only modules.
- [ ] Core bounded spikes: authenticated text/tool/structured output and native interface; persisted stream reconnect/cancel; component finalization transaction; interrupted external call; minimal TS/UI transport. Establish approved disposable test prerequisites and shared versioned text/run/event/error contracts. Media/storage/graph/vector service gates occur at their own task entry and do not block the core text slice.
- [ ] Identify eligible disposable deployment and real test identities/services without printing secrets; no production deployment. Freeze explicit capability errors and uncertain-outcome semantics.

## Acceptance Criteria

- [ ] Observed package/runtime/backend evidence distinguishes supported behavior from documented peers; missing service access is BLOCKED.
- [ ] Final-output/ingestion atomicity or cursor reconciliation is demonstrated with a forced failure boundary.
- [ ] The AI SDK UI transport contract is documented, model/tool effects are not duplicated after disconnect or retry.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §§3–4, 8, 10. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** Root/package manifests; convex.json; convex-dev component adapters; Vercel provider integration.

## Validation and Execution Notes

Profile §4/§9; retain spike receipts under qa/. No broad dependency upgrade or paid call before execution authorization.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.
