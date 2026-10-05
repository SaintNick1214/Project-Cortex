# Deep Research Request: Convex AI Gateway for Cortex

**Created:** 2026-10-02 (America/Los_Angeles)
**Execution:** Research in this chat using public primary sources and read-only local code inspection.

## Context

**Domain:** AI inference transport for a persistent-memory SDK backed by Convex.

Cortex is an npm workspace with a TypeScript memory SDK (`@cortexmemory/sdk` 0.36.0), Convex functions in `convex-dev/`, a CLI, and a Vercel AI SDK middleware/provider integration. A separate Python SDK mirrors the memory APIs. The Next.js quickstart and shipped CLI templates exercise chat, embeddings, fact extraction, streaming, and memory persistence. The core SDK has optional OpenAI and Anthropic peers and supports user-supplied model/embedding callbacks. The Vercel integration currently declares AI SDK 3–6 compatibility; the quickstart uses AI SDK 6. Convex dependency ranges start below the newly documented Gateway minimum.

The user proposes sending all model requests through Convex's newly built-in model router instead of maintaining direct provider requests in the SDK. Convex calls the feature AI Gateway. Determine what that proposal can actually cover and develop a staged, implementation-ready plan.

**Constraints:** Preserve the dirty checkout and ongoing CLI/admin-security changes. Planning only: no implementation, commits, dependency installs, deployment, production calls, account changes, or messages to other chats. Protect tenant/memory-space boundaries and provider credentials. Keep existing callbacks and compatibility unless a future breaking migration is explicitly chosen. Do not assume a paid Convex team, usable credentials, a disposable deployment, or live inference validation.

## Objective

Produce a cited capability assessment and a bounded plan for using Convex AI Gateway across Cortex's built-in inference while preserving public contracts, streaming, memory behavior, and TS/Python parity.

## Research Questions

1. What shipped, when, and under what access, version, hosting, and billing requirements? How does a Gateway differ from application-level model selection or fallback?
2. Which endpoints and model interfaces are supported: chat, embeddings, Messages, Responses, structured generation, tools, streams, multimedia? Which routing controls or stateful features are rejected?
3. Where can Gateway credentials be minted and used? Can a Node/Python SDK or browser call it directly? How should authenticated actions and HTTP streaming form the Cortex boundary?
4. What are the current model-call sites, callback contracts, auth rules, streaming semantics, vector dimensions, and package compatibility constraints in Cortex?
5. What architecture should centralize inference without moving arbitrary caller-defined tools into Convex or reimplementing an agent framework? Compare direct-provider compatibility, Gateway actions, and Agent component adoption.
6. What migration, reliability, cancellation, spend controls, tenant isolation, regression checks, and rollout criteria are necessary? Which uncertainties need a focused disposable spike?

## Scope

**In scope:** Built-in embeddings and fact extraction, Vercel chat generation transport, authentication and policy, scoped model configuration, Python parity, demo/templates/docs, and an ordered implementation plan.

**Out of scope:** Implementing or deploying the plan, replacing Cortex persistence with the Convex Agent component, unrelated CLI modernization, automatic embedding-model changes or backfills, and alpha media/decision integrations.

## Desired Output Format

Follow `.agents/skills/deep-research-orchestrator/templates/research-report.md` for findings, options, recommendations, decisions, risks, prerequisites, gaps, and primary sources. Separate verified documentation, code observations, architectural inferences, and live-unverified claims. Include source URLs, research date, local file/line evidence, and relevant package versions. Use the goal/task templates to produce `_goals/convex-ai-gateway-2026-10-02/goal.md` and a flat `tasks/NN-name.md` tree with dependencies, acceptance criteria, likely files, validation, and execution handoff.

## Success Criteria

- The report verifies the new feature against official Convex documentation and announcement.
- The recommendation addresses the action-only token boundary, authenticated streaming, caller-defined tools, unsupported hosting modes, billing risks, and embedding compatibility.
- Every migration phase has explicit acceptance checks and dependencies.
- The handoff can be reused by feature-orchestrator; execution still requires the user's request and its independent goal judge.
