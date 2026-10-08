# Research prompt: Cortex as a Convex-hosted agent runtime

**Date:** 2026-10-02 (America/Los_Angeles)
**Phase:** Architecture research and planning only. Do not implement, install, invoke paid inference, deploy, commit, or publish.
**Target:** This `Project-Cortex` repository, resolved against the checkout root.

**Latest user scope:** [Decision register](../convex-ai-gateway-2026-10-02/decision-gates.md) supersedes broader requirements below. Python, legacy-Cortex data/deployment migrations and external media storage are excluded. Design clean-slate source/chunk/vector storage and compatible profile-aware retrieval without prior embedding architecture constraints; keep, a tracked administrator-controlled transcript write lock, Convex-only media within 20,000,000 bytes and a future image-analysis reference seam. Indexed-memory plus pending context, queued same-conversation runs and the remaining runtime defaults are aligned. Earlier independent PASS does not certify this revision.

## Context and user steering

Cortex currently offers TypeScript/Python memory APIs and a Vercel AI SDK wrapper. Application code owns model/tool execution; SDK code performs recall/context injection, extraction, belief revision, embeddings, and external graph synchronization. Convex persists conversations, memories, facts, vectors, artifacts, attachments, shares and governance metadata. The root SDK constructs a Convex client and local workers; it is not an action-native domain service.

Earlier research planned Gateway transport without changing orchestration ownership. That plan is superseded by this architecture investigation. The user approves an AI SDK 7 minimum and deprioritizes old-major compatibility. They want Cortex/Convex to own complete agent turns, context injection and asynchronous memory updates, and require reactive streaming and per-function model controls. Clean-slate embedding provenance and profile matching are in scope; legacy embedding migrations are excluded. They want image/video generation supported through the SDK and a comparison against the existing artifact module. They want explanations of public run API/defaults and authorization implications. Decisions/Jev/future decision APIs are explicitly excluded until after stability.

## Questions

1. Which work should Convex Agent, Workflow/Workpool, Gateway and Cortex respectively own? Compare a simple proxy, composed backend runtime, and a custom runtime.
2. What is the authoritative transcript? How can existing Cortex conversation identity, sharing, retention and export survive without two competing message writers?
3. How should admission, run state, cancellation, approval, partial attempts and reconnect work? Distinguish stored output replay from interrupted model execution recovery.
4. How can memory update asynchronously without losing work or making the next turn forget recent input? Specify watermarks, ordering, deduplication, source eligibility, conflict commits and failure isolation.
5. What model policy must cover every billable function? What restrictions apply to native interfaces, fallback, budgets and embedding spaces?
6. Do Gateway generation and Agent files replace artifacts, or complement them? Examine versions, media jobs, storage ownership, access URLs, retention/deletion and Python parity.
7. What becomes the TS/Python/Vercel public contract? Which extensions must move from caller closures to deployed handlers/connectors? Which infrastructure remains external?
8. What authenticated principal and trusted grant does a background run use? Identify alternate public endpoints that would bypass new guards, deletion races and private media constraints.

## Evidence and output

Use current official Convex documentation, published package metadata and read-only repository inspection. Record verified facts separately from proposed architecture; cite exact file locations and source URLs. Verify Agent/Gateway AI SDK 7 peer compatibility without installing packages. Do not assert live compatibility or exactly-once external effects.

Produce an architecture report with current/proposed diagrams, ownership decisions, a turn lifecycle, consistency guarantees, model policy requirements, artifact adoption recommendation, authentication implications, constraints and bounded qualification spikes. Revise planning artifacts into dependency-aware tasks and obtain independent architecture/plan review. An implementation handoff remains conditional on a later user execution request.
