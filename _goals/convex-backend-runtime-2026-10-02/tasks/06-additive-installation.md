# Task 06: Additive backend development installation

**Status:** Planning only — pending execution authorization.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [03 Verified identity, grants and alternate endpoint closure](03-authorization.md), [05 Canonical transcript, agent definitions and run admission](05-transcripts-runs.md)

## Objective

Install the core backend components and schema safely enough to qualify the first live text slice before optional media/graph extensions.

## Requirements

- [ ] Ship versioned additive schema fragments/component registration/helper functions and route/auth integration for the qualified core contracts. Respect custom functions directories and Node/default-runtime separation.
- [ ] Preserve existing host tables/indexes, unrelated backend functions, HTTP/auth routes, component setup and Convex runtime/configuration. Detect conflicts and require a reviewable merge rather than replacement.
- [ ] Provide a bounded development-target capability/provisioning helper with trusted auth/bootstrap configuration, without production deployment or implicit project creation.
- [ ] Install core run/transcript/policy/ingestion capability incrementally; later graph/vector/media tasks extend the same additive mechanism. Full CLI UX is Task 15.

## Acceptance Criteria

- [ ] Fresh-host and customized-host-without-Cortex fixtures register core components/schema/routes without removing unrelated objects or changing the host functions directory.
- [ ] A verified disposable development target can accept the core runtime after Task 07; incomplete backend capability returns an actionable error.
- [ ] New-install retry/partial-failure and ambiguous merge fixtures preserve unrelated host data/configuration. No wholesale backend tree or schema copy is used.

## Context and Research

[Architecture](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), §§8–10; earlier installation review in [Gateway report](../../../_research/convex-ai-gateway-2026-10-02/report.md). This task unblocks text qualification rather than waiting on video/object-storage/graph prerequisites.

**Likely areas:** backend distribution/component setup, schema helpers, scoped CLI development integration and custom-host fixtures. Protect ongoing CLI work and serialize overlapping writes.

## Validation and Execution Notes

Use offline host-preservation fixtures first, then scoped codegen/backend checks on the verified disposable target when execution is requested. Preserve consumer auth/http configuration; do not hand-edit generated APIs. Full CLI/template behavior is separately validated in Task 15. Existing-Cortex deployment upgrades are excluded; collisions with an old Cortex installation fail clearly rather than resetting it.

No implementation, installation, paid inference or deployment is authorized by this planning file. Re-read AGENTS.md, Git status and manifests at execution; use explicit working directories.
