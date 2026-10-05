# Scope discussion: AI SDK 7 and broader Convex AI capabilities

**Date:** 2026-10-02 (America/Los_Angeles)
**State:** Planning discussion. No implementation or live inference authorized by this discussion.

**Newest user scope:** [Decision register](decision-gates.md) governs: Python is deprecated/out of scope, old-architecture data/deployment migrations are excluded, media stays in Convex within 20 MB with no external storage adapter, and future image-artifact memory analysis is a reference/lineage seam only. Transcript writes may be unlocked by policy with revision tracking and stale-memory detection; authentication/isolation remain enforced. The earlier “embedding migration in scope” steering below is superseded by these exclusions; new-data vector profile integrity remains required for model control. The latest instruction chooses clean-slate embeddings without prior model/dimension/schema constraints and confirms the remaining runtime defaults; earlier embedding migration or populated-profile restrictions are superseded.

**Latest steering:** The user now prioritizes the full Cortex/Convex backend runtime, marks reactive streaming critical, makes per-function model controls a pillar, and includes embedding provenance/migration. Media support is desired; [the architecture revision](architecture.md) recommends Gateway generation feeding retained Cortex artifacts. Decisions/Jev and future decision APIs are explicitly out of scope until after stability. Public run/default and broader-auth implications are explained in that revision. The [new goal/task tree](../../_goals/convex-backend-runtime-2026-10-02/goal.md) supersedes the initial transport-only plan; recommendations and “only approved change” statements below are historical discussion.

## User steering

The user wants to discuss all previously excluded/future features, approves raising the minimum to AI SDK 7 when required, and places little value on maintaining legacy compatibility. Interest in a feature is not approval to include or implement it. The initial plan's independent PASS covered its earlier compatibility-focused scope; it does not certify the changed plan.

## Approved planning change

Plan for AI SDK >=7.0.105, the maintained `@convex-dev/ai-sdk-provider` >=0.2.1 inside Convex actions, Convex >=1.46 for linked-local parity, and Node >=22 where the provider package/tooling requires it. Official docs and read-only npm metadata were rechecked. AI SDK 3–6 adapter support is no longer an acceptance obligation for this feature. Default-runtime actions remain available; using the Node runtime requires the documented Node setting.

The maintained provider removes the compatibility rationale for hand-written upstream Gateway adapters. An authenticated transport between Cortex clients and Convex remains necessary. Final remote model/stream wire contracts depend on the choice of a caller-owned tool loop, a backend agent runtime, or both.

Direct/custom support for free/self-hosted/anonymous-local deployments is a separate product-capability decision. The Gateway's availability restrictions still apply. Provider callbacks can remain useful extension points without maintaining older AI SDK majors. A versioned migration guide and data/config preservation remain necessary even if old runtime/API support is removed.

[Gateway setup](https://docs.convex.dev/ai-gateway/setup), [Gateway availability](https://docs.convex.dev/ai-gateway/overview), [published provider](https://www.npmjs.com/package/@convex-dev/ai-sdk-provider/v/0.2.1).

## Capabilities under discussion

### Convex Agent and durable execution

The Agent component manages prompting, threads, messages, tools and search context. It also provides debugging and usage hooks. Workflow/Workpool components supply persistent multi-step execution and bounded workers. These components predate the Gateway and can now use it for model access. [Agent overview](https://docs.convex.dev/agents/overview), [Workflows](https://docs.convex.dev/agents/workflows).

**Candidate Cortex architecture:** Agent owns model/tool/run execution; Cortex owns its semantic memory, facts, belief revision, graph and governance. Inject Cortex recall through context hooks/tools and ingest completed turns once. Define canonical transcript ownership, identifiers, retention/deletion/export and indexing rules rather than letting both systems become competing records. Context hooks are supported; this composition remains a design proposal requiring a prototype. [Context control](https://docs.convex.dev/agents/context).

Server-registered tools can receive Convex context; arbitrary caller closures still need an explicit execution lane. Agent tools support persisted human approval and continuation. Use conditional approvals only where the product needs them. [Tools](https://docs.convex.dev/agents/tools), [Tool approval](https://docs.convex.dev/agents/tool-approval).

Scheduled/workflow tool contexts may have no logged-in auth user. Bind a trusted principal/grant to the run when it starts, and check authorization/revocation at consequential steps. This is not covered merely by request-level JWT validation.

### Reactive streams and reconnectable runs

Agent delta streaming writes batched chunks and allows subscribers to reconnect or multiple clients to observe the same run. DeltaStreamer can be used with plain AI SDK streaming without adopting all Agent thread management. [Streaming](https://docs.convex.dev/agents/streaming).

**Recommendation:** Strong candidate for core scope. Choose run state, subscriptions, cancellation, terminal states and retention deliberately. Reconnecting to persisted output does not itself guarantee that interrupted upstream generation resumes; durable workflows and step idempotency address a different failure boundary. Stored deltas incur writes/bandwidth, so throttle/chunk rather than persist every token.

### Decisions with Jev

`convexGateway.evaluationModel` plus experimental evaluate supports choice, score and boolean/probability decisions. Decisions is alpha. Potential Cortex uses include memory importance, relevance, conflict classification, retrieval-strategy selection or an agent/model policy signal. These are proposed uses, not benchmarked quality improvements. [Setup / Decisions](https://docs.convex.dev/ai-gateway/setup), [HTTP Decisions](https://docs.convex.dev/ai-gateway/api#post-alphadecisions).

**Recommendation:** Optional experimental decision adapter with measured fixtures and confidence/abstention policy. Preserve semantic evidence; do not automatically delete/supersede facts or treat probability as calibrated truth.

### Image/video generation and audio

The maintained provider exposes image and experimental video generation. Async video submission returns a handle; cloud callbacks require signature verification and deduplication, while status polling recovers missed callbacks. Availability may need configuration with Convex. Cancellation/lost response can still be charged. These capabilities are alpha. [Images and videos](https://docs.convex.dev/ai-gateway/images-and-videos).

**Candidate Cortex use:** Store generated outputs as artifacts/attachments with tenant scope, provenance and job state. Image generation is smaller scope; reliable video entails durable submission/status/download/storage and cost controls.

The reviewed overview lists no standalone speech/transcription/realtime-audio endpoint. Video options can include generated audio and audio references; this does not establish a general audio product API. [Gateway overview](https://docs.convex.dev/ai-gateway/overview).

### Model policy and fallback

Gateway chooses how a requested model is served and rejects several upstream routing controls. Cortex can separately select an allowed model by operation, budget/capability, or a measured decision signal. Native provider interfaces still differ. [HTTP API](https://docs.convex.dev/ai-gateway/api).

**Recommendation:** Deterministic per-operation policy first. Adaptive routing is a later evaluated policy, including latency, quality and total cost. Fallback is permitted only with explicit rules and known failure semantics; no replay of partially emitted output or tool effects, and no arbitrary embedding-model fallback.

### Embedding provenance and migration

Current Cortex indexes are fixed at 1536 dimensions. Convex index dimensions are fixed and query vectors must match. Switching models also changes semantic space even when dimensions match. [Vector search](https://docs.convex.dev/search/vector-search).

**Recommendation:** Add model/version/dimension provenance to new vectors if broad model choice is included. Changing existing embedding models requires a versioned backfill/dual-index/cutover design with recall measurements, cost accounting and rollback. Removing legacy SDK support does not make existing user data disposable.

### Public inference API and Gateway defaults

A new Cortex inference namespace or model/run facade could carry scope, models, usage, tracing and decisions consistently across TS/Python. It expands Cortex's public contract and may overlap standard AI SDK methods. Define it around Cortex-specific run/memory/scoping value, with a model facade where AI SDK integration is desired.

**Recommendation:** Gateway as the preferred/default inference path for eligible new deployments is reasonable to consider given the user's priorities. Decide deliberately whether unsupported deployments receive a modern direct/custom escape hatch or an explicit unsupported error. Neither choice was approved merely by approving AI SDK 7.

### Existing storage authorization and operational scope

Inference guards remain mandatory. Moving transcripts, tool execution and reactive subscriptions into Convex increases the protected surface and could justify broadening storage authorization too. That expansion affects reads, search, sharing, grants and governance; it is a product-security workstream rather than a Gateway toggle.

Unrelated CLI modernization, actual production deployment, commits and publishing remain outside this planning discussion. Relevant CLI setup/backend integration remains part of the inference plan.

## Suggested scope for the next planning revision

1. Core foundation: official AI SDK 7 provider, authenticated scoped inference, required native model interfaces, configured embeddings and modern client contracts.
2. Strong additions to evaluate: reactive run streaming and a Cortex-to-Convex-Agent integration that preserves one canonical transcript/memory ingestion lifecycle.
3. Experimental optional capabilities: Jev decisions and image generation; videos as a separate durable job capability.
4. Further design decisions: model-policy/fallback guarantees, embedding backfills, broader auth, and unsupported-host product support.

Only the AI SDK 7/minimum-version/legacy-priority change is approved so far. The feature combinations above remain proposals for discussion. After selecting scope, revise the full task tree and independently judge that new version before implementation.
