# Task 15: Additive CLI, quickstart and template integration

**Status:** Planning only — pending execution authorization.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [11 Scoped durable external graph projection](11-graph-outbox.md), [14 TypeScript media, embedding and UI extensions](14-client-extensions.md)

## Objective

Ship a configurable backend-run installation without damaging host projects.

## Requirements

- [ ] Substep 15A: extend the Task 06 additive integration with complete fresh-install feature capability/setup UX; preserve host custom functions dir, host auth/http, unrelated functions and runtime config.
- [ ] Substep 15B: migrate canonical quickstart and basic template to registered backend tools/verified auth/run UI; sync only canonical quickstart mirror after source changes.
- [ ] Substep 15C: migrate chat-SDK title/text/code/sheet/suggestions/artifact paths to operation policy and backend tools; qualify its own package/runtime/browser flows.
- [ ] Document Gateway/media eligibility, Convex storage size policy and optional graph config, provisioning and actionable errors without requiring inference keys on app clients.

## Acceptance Criteria

- [ ] Fresh and customized new-install host fixtures retain tables/indexes, routes, functions and custom settings; installation refuses ambiguous merges safely.
- [ ] Canonical quickstart proves authenticated recall/chat/reconnect/artifact flow; templates separately prove their own runtime behavior.
- [ ] Basic offline TS/Vitest checks avoid deploy-linked build script; chat-SDK uses its own scoped lint/type/Vitest/Next/UI checks.
- [ ] No title/artifact/suggestion path silently uses Vercel Gateway/OpenAI/Anthropic direct credentials.

## Context and Research

[Architecture and primary evidence](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), Architecture §§6, 8, 10; earlier report installation review. Treat proposed contracts as designs; published metadata does not establish live compatibility. Keep Decisions, Python, legacy-Cortex migration tooling and external media storage excluded; preserve unrelated host application data during new installation.

**Likely areas:** packages/cortex-cli src/templates; canonical quickstart; sync-quickstart-template.js; fresh-install host helpers.

## Validation and Execution Notes

Serialize 15A/15B/15C and protect current CLI edits; CLI/provider/demo/UI modules. Do not use whole-tree/schema copy on existing installs.

No implementation, installation, paid inference, deployment or application testing is authorized by this task's presence. Re-read target AGENTS.md, Git status and manifests at execution. Use explicit working directories, preserve local work and record meaningful outcomes under this goal's qa/ directory.
