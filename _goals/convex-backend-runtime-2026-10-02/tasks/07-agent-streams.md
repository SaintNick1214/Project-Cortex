# Task 07: Agent execution and durable reactive output

**Status:** ACCEPTED — original requirements and criteria passed independent review under acceptance policy v2 on 2026-10-08.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [06 Additive backend development installation](06-additive-installation.md), [05 Canonical transcript, agent definitions and run admission](05-transcripts-runs.md)

## Objective

Execute a Cortex-scoped backend agent turn with reconnectable typed output.

## Requirements

- [x] Compose recent Agent history with bounded authorized Cortex context using context hooks; disable duplicate independent semantic retrieval by default.
- [x] Register server tools/connectors with operation IDs, grants and explicit side-effect retry/approval semantics; pin run context/policies.
- [x] Persist throttled typed deltas/tool/artifact/status parts; authorize observers, cancel and approval continuation; support final-only delivery.
- [x] Model failure/interruption creates explicit partial/unknown attempt state; finalization registers durable memory work using the qualified transaction or reconciliation design.

- [x] Pin transcript revision with run context. Detect unlocked edits during execution; reject/cancel/branch stale completion according to the qualified contract.

## Acceptance Criteria

- [x] The disposable development target installed in Task 06 accepts and executes the core runtime, proving the additive installation is wired to the qualified Agent/Workflow/Gateway contracts.
- [x] Authenticated live turn recalls scoped memory, executes a backend tool and streams correctly after client disconnect/reconnect and multiple observers.
- [x] One logical completed turn yields one final transcript and one ingestion receipt; failure between component completion and registration is recovered.
- [x] A manual unlocked edit cannot silently attach an obsolete completion to changed history or reuse stale injected memory. Interrupted model/tool effects are not blindly replayed; final/cancel/error events are distinguishable; tool secrets/context/raw reasoning are redacted.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §§3–5. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** backend Agent/Workflow adapters; run/event queries; context service; tool registry.

## Validation and Execution Notes

Provider/memory/isolation checks plus live native interface qualification. Saved-output replay must not be called upstream stream resumption.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.

## Independent acceptance

The reused non-author review accepts all five original requirements and four criteria, PASS4.0, with32 distinct controlled cases and actual installed live/control/recovery/cleanup evidence. See [independent acceptance handoff](../qa/local-resume-2026-10-05/task07-independent-acceptance-handoff1.json) and [actual report](../qa/local-resume-2026-10-05/task07-agent-execution-functional-v2-20261008/native-actual/actual-report-final1.json). Earlier failed intervals, static scopes, unavailable terminal cost and historical C7 limitations remain preserved. Tasks08–17 and the final goal audit remain open.

Final reviewer-authored packet: [review](../qa/local-resume-2026-10-05/task07-product-independent-review1/report1.md), [PASS4.0 verdict](../qa/local-resume-2026-10-05/task07-product-independent-review1/verdict1.json).
