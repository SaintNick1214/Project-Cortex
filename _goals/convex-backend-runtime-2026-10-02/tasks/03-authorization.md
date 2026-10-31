# Task 03: Verified identity, grants and alternate endpoint closure

**Status:** Complete — all five original requirements and three acceptance criteria independently accepted PASS4.0 under policy v2 on 2026-10-09. Full goal and genuine async-video qualification remain open.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [01 Stack and execution-boundary qualification](01-qualification.md)

## Objective

Establish one trusted authorization boundary for runtime and all reachable Cortex data paths.

## Requirements

- [x] Execute bounded substeps and record separate receipts: 03A public-path inventory and trusted principal/grant/bootstrap contracts; 03B guard/internalize the inventoried backend paths and background checks; 03C client JWT refresh and scoped subscription/byte/callback negative cases. Freeze 03A before dependent edits; serialize shared backend files.
- [x] Inventory public memory/facts/conversation/search/share/artifact/attachment/graph/user/agent/policy functions; guard or internalize bypass paths.
- [x] Attach refreshed host JWT credentials in clients; map verified issuer/subject to trusted memberships/grants. Establish trusted bootstrap/service provisioning; existing caller-created user metadata cannot grant privilege.
- [x] Direct endpoint access remains scoped/authenticated. Only trusted administrators can unlock transcript writes; unlocked writes target the same canonical store with revision tracking and stale-derived-memory detection. No write-lock setting disables authorization or billable controls.
- [x] Background run/service references recheck revocation/deletion; subscriptions, uploads/downloads and connector callbacks use appropriate scoped authentication. Protect administrative config; shares expose permitted redacted views.

## Acceptance Criteria

- [x] Missing/forged identity, omitted/mismatched tenant, unauthorized scope and public share cannot read/write/stream/invoke paid inference through any alternate path.
- [x] Cross-tenant subscription, tool execution, upload and storage reference tests deny access; internal helpers are not public.
- [x] Revoked grant or deletion stops later reads/effects/commits and cannot recreate deleted rows; ordinary logout semantics are documented.

## Context and Research

[Architecture §9](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), [authoritative decisions](../../../_research/convex-ai-gateway-2026-10-02/decision-gates.md), [backend schema](../../../convex-dev/schema.ts) and [current auth context](../../../src/auth/context.ts). Caller-provided identity metadata is reference material, not verified authorization.

**Likely areas:** convex-dev public functions; src/auth/; src/index.ts; host auth registration helpers.

## Validation and Execution Notes

Profile isolation skill and trusted identity fixtures. Preserve consumer auth.config/http routing. Do not infer access from AuthContext IDs.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.

## Authorization execution gates

03-foundation closes every current registered bypass with verified guards, safe internalization or typed authorized unavailability before private hydration/effects, with complete current endpoint guard inventory, meaningful live positive/negative outcomes for distinct authorization/effect classes and one non-author product review before04, under [acceptance policy v2](../acceptance-policy.md). It does not complete this task.

03-transcript completes05 single-Agent direct access, shares/redaction and tracked lock/unlock/revision;03-text-execution covers07/08/09 live tool/subscription/background/current source/derived repair;03-assets covers12/13/14 private bytes, storage ownership, media callbacks and client delivery.11 supplies actual graph late-write/deletion receipts. Each carries its original task criteria and fresh review.

03-final aggregates every original requirement above and every current/new registration, consuming16 adversarial outcomes;17 cannot complete without03-final. Authorized capability errors are intermediate safety receipts, never final functional feature acceptance. [Sequencing contract and exhaustive row ledger](../qa/resume-dependency-refinement-c2/plan.md).


## Original Task03 final acceptance — 2026-10-09

The same coherent non-author review grants all five original requirements and three criteria, with every rubric dimension4/5 and no known reachable authorization, data or private-delivery breaking findings. See [independent report2](../qa/local-resume-2026-10-05/task03-final-aggregate-functional-v2-20261009/independent-review1/report2.md) and [handoff2](../qa/local-resume-2026-10-05/task03-final-aggregate-functional-v2-20261009/independent-review1/handoff2.json). The current SDK5 candidate inventories461 registrations (270 public,191 internal) and five HTTP routes. Eighteen distinct authorization/effect classes combine applicable prior actual outcomes with nine new unpaid official-handler/RPC/HTTP/SDK groups; no alias Cartesian execution claim is made.

Current action/SDK delivery deadline and UI revocation defects are repaired and regressed. Exact-ID financial comparison preserves all49 previous accounts,65 uncertain attempts and two held slots; the two new03 accounts have zero liability. Both owned03 scopes retire, four signed roles receive FORBIDDEN, bytes/jobs are zero, the QA route/helper are removed, and canonical registration restores with typechecking enabled. Current fixture corrections and the configured118-suite/6633-test unit gate remain source checks, separately scoped from service outcomes.

Original pending review, all failures, historical C7 missing backing/custody and prospective candidate distinctions remain unchanged. Genuine async callback/poll/materialization is still unavailable503 and does not receive functional acceptance here. The main development target, private credentials and owned graph services are retained for16/final cleanup. No full13/14/16/17 or full-goal approval.
