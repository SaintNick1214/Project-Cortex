# Task 04: Per-function model policy and admission budgets

**Status:** Execution authorized — pending prerequisite implementation and independent acceptance.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [01 Stack and execution-boundary qualification](01-qualification.md), [03 authorization foundation](03-authorization.md#authorization-execution-gates)

This execution prerequisite means independently accepted **03-foundation**, not full03-final. All original Task03 functional criteria remain required at their mapped implementation gates and03-final before Task17. See [accepted sequencing contract](../qa/resume-dependency-refinement-c2/plan.md).

## Objective

Resolve and enforce versioned operation/model/capability and cost policy for every billable call.

## Requirements

- [ ] Register operation keys for chat, extraction, conflict, summaries/titles, memory/query embeddings, text/code/sheet/suggestions and image/video generation.
- [ ] Resolve deployment/tenant/agent/operation policy with trusted overrides; pin model/interface/prompt versions and validate options, token limits and tools.
- [ ] Atomically reserve run/tenant operation budget and concurrency; settle known usage once, retain uncertain paid outcomes conservatively; explicit safe fallbacks only.

## Acceptance Criteria

- [ ] Distinct function policies select different allowed models with correlated audit receipts; no hidden direct provider call bypasses policy.
- [ ] Concurrent submissions and child/secondary calls cannot bypass reservation or settle twice; exhausted quotas fail before token mint.
- [ ] Fallback never repeats visible output, tools or ambiguous paid jobs, and never changes an embedding profile.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §6. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** src/config.ts; backend policy/admission/usage schema and helpers; provider secondary-call integrations.

## Validation and Execution Notes

Concurrency/outcome fixtures with controlled failure injection; actual model/interface evidence in Task 14. Gateway deployment kill switch is not the application quota.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.
