# Task 13: Gateway image and durable asynchronous video jobs

**Status:** Execution authorized — pending prerequisite implementation and independent acceptance.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [09 accepted actual text/UI slice](09-text-client-slice.md), [04 Per-function model policy and admission budgets](04-model-policy.md), [07 Agent execution and durable reactive output](07-agent-streams.md), [12 Convex-owned assets and bounded private delivery](12-asset-lifecycle.md)

## Objective

Generate media through governed backend jobs and materialize owned artifact outputs.

## Requirements

- [ ] Entry gate: qualify image models, async-video availability and callback/poll/download behavior on the disposable deployment. Capability configuration is required for full media completion, not the earlier text slice.

- [ ] Implement stable Cortex image/video adapters around qualified alpha provider methods; policy selects model/parameters and reserves costs.
- [ ] Create job/pending artifact before submit; store private operation/inference/webhook fields, verify/deduplicate raw signed callbacks and reconcile by polling.
- [ ] Disable blind paid-submission retries; track submission_unknown, expiry, downloading, ready, failure and cancellation honestly; download promptly once into owned storage.
- [ ] Backend tools return job/artifact references; workflow may await completion or emit pending output. No media base64 in Convex transcript/event documents. Enforce the 20,000,000-byte asset/delivery cap at input registration, download/materialization and delivery; oversized generated output returns a typed error, records incurred/unknown cost and cleans partial files with no external fallback.

## Acceptance Criteria

- [ ] Actual qualified image/video jobs create typed ready artifacts with model/input/usage/provenance and authorized download.
- [ ] Missed/duplicate/out-of-order callback and download retries produce one owned version; forged callback cannot mutate a job.
- [ ] Oversized generated output cannot become a ready artifact or be delivered; verify error/cost/cleanup. Lost submission response remains uncertain rather than duplicate paid request; cancel does not promise upstream cancellation or refund.
- [ ] Linked-local polling and unavailable async-video configuration produce the documented behavior/error.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §7. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** backend media tools/jobs/webhooks; artifact materialization; Gateway adapters.

## Validation and Execution Notes

Task 16 uses bounded paid fixtures only after execution request and disposable prerequisites. Standalone audio/edit APIs remain excluded.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.
