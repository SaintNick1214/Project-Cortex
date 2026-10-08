# Task 05: Canonical transcript, agent definitions and run admission

**Status:** COMPLETE — independently accepted PASS4.0 under acceptance policy v2 on 2026-10-08. Original requirements and criteria retained; model execution remains Task07.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [02 Backend-friendly memory domain services](02-domain-services.md), [03 authorization foundation](03-authorization.md#authorization-execution-gates), [04 Per-function model policy and admission budgets](04-model-policy.md)

This execution prerequisite means independently accepted **03-foundation**, not full03-final. All original Task03 functional criteria remain required at their mapped implementation gates and03-final before Task17. See [accepted sequencing contract](../qa/resume-dependency-refinement-c2/plan.md).

## Objective

Create authoritative conversation/run identity and durably accept input without duplicate histories.

## Requirements

- [x] Map stable Cortex conversations to Agent threads; retain access/share/retention metadata and expose authoritative typed transcript through an adapter.
- [x] Introduce versioned executable agent definitions separate from existing discovery registry; registered tools/context/memory/policy/budgets are backend-owned.
- [x] Transactionally deduplicate input key, persist user event/reservation and enqueue execution where supported; default queue/serialize mutating runs per conversation and make branching explicit.
- [x] Define response/memory/graph statuses, attempts, cancellation, approval, output references and new-record export/delete behavior. Provide an administrator-controlled managed transcript write lock; authorized reads remain available. Unlocked append/edit/delete uses the same canonical store, tracks revisions and invalidates affected derived records.

## Acceptance Criteria

- [x] Same key/input returns one run; changed input/key reuse conflicts; concurrent inputs have deterministic queue/branch behavior.
- [x] Locked manual writes fail; authorized reads work. After administrator unlock, direct conversation append/edit/delete changes the authoritative transcript once, records actor/source revision and makes stale derived facts/vectors ineligible until repair.
- [x] Crash after acceptance leaves recoverable work; transcript projections can be rebuilt; raw hidden context/credentials do not enter public records.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §§3–4, 9. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** convex-dev/schema.ts; conversations.ts; agents.ts; new run/agent-definition adapters.

## Validation and Execution Notes

Profile backend patterns. Meaningful admission concurrency/transcript-policy fixtures and live component evidence; do not overwrite host schema.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.


## Implementation acceptance — 2026-10-08

All four original requirements and three original acceptance criteria are accepted by the single non-author [Task05 review](../qa/local-resume-2026-10-05/task05-product-independent-review1/report1.md), [verdict](../qa/local-resume-2026-10-05/task05-product-independent-review1/verdict1.json) and [closed raw binding](../qa/local-resume-2026-10-05/task05-product-independent-review1/ordinary-closed-review-receipt1.json). Current independent90 checks passed; author386 case instances and native source-scoped26 core3,6 final4 and8 final5 groups remain distinct coverage. Owned project3171801 was deleted200/readback404; private credentials remain privately0600, with no removal claim.

The original C3 global-history fence was refined after an actual ordinary queue failure: later queued input and its approval advance public history but preserve an earlier exact executable cutoff. Selected message/source revisions, current grants, manual edits and policy changes still fence execution. Snapshot delivery requires current export permission; optional unsupported maxViews/link/domain/custom-redaction variants fail closed and are not claimed functional. See [contract notes](../qa/local-resume-2026-10-05/task05-functional-v2-20261008/contract-notes1.md). Historical failures and scoped verdicts remain unchanged. Task06 installation, Task07 execution, Task08 asynchronous memory and all later original acceptance gates remain separate.
