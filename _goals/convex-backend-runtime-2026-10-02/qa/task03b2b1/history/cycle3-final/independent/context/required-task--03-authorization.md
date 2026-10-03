# Task 03: Verified identity, grants and alternate endpoint closure

**Status:** In progress — execution authorized; Task01 independent PASS. Bounded foundation substeps active.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [01 Stack and execution-boundary qualification](01-qualification.md)

## Objective

Establish one trusted authorization boundary for runtime and all reachable Cortex data paths.

## Requirements

- [ ] Execute bounded substeps and record separate receipts: 03A public-path inventory and trusted principal/grant/bootstrap contracts; 03B guard/internalize the inventoried backend paths and background checks; 03C client JWT refresh and scoped subscription/byte/callback negative cases. Freeze 03A before dependent edits; serialize shared backend files.
- [ ] Inventory public memory/facts/conversation/search/share/artifact/attachment/graph/user/agent/policy functions; guard or internalize bypass paths.
- [ ] Attach refreshed host JWT credentials in clients; map verified issuer/subject to trusted memberships/grants. Establish trusted bootstrap/service provisioning; existing caller-created user metadata cannot grant privilege.
- [ ] Direct endpoint access remains scoped/authenticated. Only trusted administrators can unlock transcript writes; unlocked writes target the same canonical store with revision tracking and stale-derived-memory detection. No write-lock setting disables authorization or billable controls.
- [ ] Background run/service references recheck revocation/deletion; subscriptions, uploads/downloads and connector callbacks use appropriate scoped authentication. Protect administrative config; shares expose permitted redacted views.

## Acceptance Criteria

- [ ] Missing/forged identity, omitted/mismatched tenant, unauthorized scope and public share cannot read/write/stream/invoke paid inference through any alternate path.
- [ ] Cross-tenant subscription, tool execution, upload and storage reference tests deny access; internal helpers are not public.
- [ ] Revoked grant or deletion stops later reads/effects/commits and cannot recreate deleted rows; ordinary logout semantics are documented.

## Context and Research

[Architecture §9](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), [authoritative decisions](../../../_research/convex-ai-gateway-2026-10-02/decision-gates.md), [backend schema](../../../convex-dev/schema.ts) and [current auth context](../../../src/auth/context.ts). Caller-provided identity metadata is reference material, not verified authorization.

**Likely areas:** convex-dev public functions; src/auth/; src/index.ts; host auth registration helpers.

## Validation and Execution Notes

Profile isolation skill and trusted identity fixtures. Preserve consumer auth.config/http routing. Do not infer access from AuthContext IDs.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.
