# Task 05: Canonical transcript, agent definitions and run admission

**Status:** Planning only — pending execution authorization.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [02 Backend-friendly memory domain services](02-domain-services.md), [03 Verified identity, grants and alternate endpoint closure](03-authorization.md), [04 Per-function model policy and admission budgets](04-model-policy.md)

## Objective

Create authoritative conversation/run identity and durably accept input without duplicate histories.

## Requirements

- [ ] Map stable Cortex conversations to Agent threads; retain access/share/retention metadata and expose authoritative typed transcript through an adapter.
- [ ] Introduce versioned executable agent definitions separate from existing discovery registry; registered tools/context/memory/policy/budgets are backend-owned.
- [ ] Transactionally deduplicate input key, persist user event/reservation and enqueue execution where supported; default queue/serialize mutating runs per conversation and make branching explicit.
- [ ] Define response/memory/graph statuses, attempts, cancellation, approval, output references and new-record export/delete behavior. Provide an administrator-controlled managed transcript write lock; authorized reads remain available. Unlocked append/edit/delete uses the same canonical store, tracks revisions and invalidates affected derived records.

## Acceptance Criteria

- [ ] Same key/input returns one run; changed input/key reuse conflicts; concurrent inputs have deterministic queue/branch behavior.
- [ ] Locked manual writes fail; authorized reads work. After administrator unlock, direct conversation append/edit/delete changes the authoritative transcript once, records actor/source revision and makes stale derived facts/vectors ineligible until repair.
- [ ] Crash after acceptance leaves recoverable work; transcript projections can be rebuilt; raw hidden context/credentials do not enter public records.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §§3–4, 9. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** convex-dev/schema.ts; conversations.ts; agents.ts; new run/agent-definition adapters.

## Validation and Execution Notes

Profile backend patterns. Meaningful admission concurrency/transcript-policy fixtures and live component evidence; do not overwrite host schema.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.
