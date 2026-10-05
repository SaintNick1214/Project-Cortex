# Architecture decision gates: user alignment revision

**Date:** 2026-10-02 (America/Los_Angeles)
**Phase:** Planning only. This register governs over earlier broader requirements.
**Authority:** User's responses to the architecture summary and decision questions, including clean-slate embeddings and alignment on the remaining defaults. This records approved direction, not a claim that they reviewed every Markdown implementation detail.
**Architecture:** [Current proposal](architecture.md)
**Plan:** [Current goal](../../_goals/convex-backend-runtime-2026-10-02/goal.md)

## Confirmed scope

| Gate | Aligned direction |
|---|---|
| Holistic architecture | Cortex/Convex owns ordinary model/tool/context/run orchestration; app submits input and observes output. Compose Agent, Workflow and Gateway. |
| Transcript authority | One authoritative transcript. Direct endpoint access remains possible through authorized Cortex APIs; it does not introduce a second canonical history. |
| Transcript openness | Administrator-controlled write lock/policy, locked by default for managed conversations. Unlocking never disables authentication, tenant isolation or billable-operation controls. The user explicitly selected revision tracking and stale-memory detection for unlocked writes. |
| Asynchronous memory | Durable input immediately; context snapshot plus indexed memory and eligible pending transcript tail; response and memory stages have separate status. |
| Decisions | Jev/future Decisions APIs are excluded until after stability. |
| Media | Gateway generation feeds retained Cortex artifacts; image/video support stays in scope. |
| Media storage/delivery | Convex storage only; supported private delivery stays within a Cortex cap of 20,000,000 bytes per asset/response. No external media storage adapters, R2 or large-video delivery work. |
| Future image memory | Preserve artifact/source references and analysis version seams; no image understanding, captions/OCR or multimodal embedding implementation now. |
| Model controls | Versioned per-function backend selection, native interface/capability controls, allowlists, budgets, safe fallback and audit remain pillars. |
| Existing-data migrations | No old-architecture transcript import, ownership adoption/quarantine, embedding backfill/cutover/rollback, existing-Cortex deployment upgrades or compatibility bridge. Fresh-install target. |
| Embedding architecture | Clean-slate source, chunk and derived-vector design. Choose profiles, dimensions and indexes for the new runtime without retaining previous embedding architecture. Query/index model matching is inherent retrieval correctness; legacy formats, conversion and upgrade paths impose no constraints. |
| Public API/default | Primary runs facade and AI SDK 7 remote UI integration; Gateway preferred for eligible new installs and explicit unavailable capability errors. |
| Python | Deprecated by user instruction; no implementation, parity, observation transport, examples or Python QA in this goal. |
| Authorization | Verified identity/trusted grants across all reachable APIs, including direct writes; background revocation/deletion and source tombstones remain required. |
| Host installation | New Cortex installation must preserve unrelated host business tables, auth/routes/functions/settings. This is ordinary safe host integration, not a legacy Cortex migration promise. |

Reconciled baseline refresh (2026-10-03): #130/#131 are merged, remote dev is `3341d64ddc06f1de26ed525312ef2c1b89b16952`, and current main is its ancestor. Python is archived under `_DEPRECATED/`; root active manifests require Node >=24.15.0 and npm 12.2.0. Canonical documentation is in the sibling website repository, not `Documentation/`. The feature handoff excludes unrelated dirty source work in the original desktop checkout.

## Confirmed runtime defaults

The user's “Otherwise, aligned!” confirms the remaining defaults below. Embeddings follow the separate clean-slate instruction; the previous populated-space pinning/reindex question is superseded. No product decision question remains pending in this register.

1. **Unlocked transcript consistency:** Tracked writes to the same canonical store: revisions, actor/source metadata, invalidation of affected derived memory and explicit pending state. The user selected that bookkeeping; raw writes without consistency tracking are not the supported unlock contract. Direct storage mutation by a custom fork is inherently outside managed-runtime guarantees. A transcript unlock is not an authorization bypass.
2. **Default memory freshness:** Indexed memory plus deduplicated authorized pending events for ordinary chat, with a scoped cutoff watermark and bounded context. Fully indexed mode is an explicit operation/agent override when structured/index-backed completeness is required. If the required tail cannot fit or cannot be read, wait for required stages or return incomplete context; do not claim completeness by truncation.
3. **Conversation concurrency:** Serialize/queue mutating runs within a conversation. Explicit forks/new conversations can run concurrently. In unlocked mode, an edit concurrent with a run requires revision detection: reject/cancel/branch stale completion rather than silently attach it to a changed history. Exact low-level mechanics are a qualification gate.
4. **Memory source policy:** User assertions and verified tool results are eligible evidence; assistant output is attributed and cannot automatically become an authoritative user assertion. Manual developer writes retain explicit source role/trust and scope.
5. **Tool execution/approval:** Deployed backend tools/connectors; approval only for configured consequential operations. Browser/device tools and arbitrary caller closures are outside the ordinary backend-only path.
6. **Retry/cancel semantics:** Local deduplication and controlled retries; no blind replay of ambiguous paid calls/external effects. Cancellation stops future permitted work where possible, without promising upstream cost/effect reversal.
7. **Oversized media outcome:** Enforce the 20,000,000-byte cap on uploads, completed outputs and HTTP delivery. Prefer bounded model options, but size cannot always be predicted. Oversized generated output fails materialization with a typed error and cleanup; generation may already have been charged. No external-storage fallback.
8. **Clean-slate embeddings:** Separate logical source content/chunks from profile-specific derived vectors. Profile identity includes the selected model, dimensions and preprocessing contract. Declare supported index configurations for the new design; pin the resolved profile to each query/job and retrieve only matching, current, authorized vectors. Previous models, dimensions and schema layouts impose no compatibility requirements. Future profiles can have separate derived generations; no old-corpus conversion or general reindex orchestration is added to this goal.

Product direction and defaults are aligned. Exact contracts and technical qualification of component transactions, streams/tools, embedding/index configurations, graph runtime/network and media availability remain later execution work. Planning alignment does not authorize implementation.

## Indexed memory versus fully indexed state

Index use and waiting for all relevant indexing are different decisions. Ordinary runs still use existing indexed memory. The pending tail supplies recent evidence that has been stored durably but has not completed extraction, embedding or graph projection. This is processing lag, not absence of the source message from storage.

Convex documents immediate vector-search visibility once a vector is written. The barrier therefore waits for the relevant Cortex processing receipts/commits, not an assumed eventual vector-index refresh. [Vector search](https://docs.convex.dev/search/vector-search).

“Fully indexed” means the selected eligible sources have completed the stages required by that operation as of a captured cutoff watermark. It does not mean every future event in a busy space must finish, every memory must fit in context, or recall/extraction is infallible.

| Example job | Required behavior |
|---|---|
| “My favorite color is purple” → immediate follow-up | Ordinary indexed recall plus recent authoritative message tail; no wait for extraction/vector work. |
| Continue revising a draft after a just-completed turn | Recent typed transcript and current artifact version can be read directly; no global indexing barrier. |
| Normal question about established project knowledge | Retrieve already indexed memory and authorized relevant pending context; ordinary mode suffices unless caller requires complete coverage. |
| Return exact structured current facts changed by a recent message | Wait for extraction/conflict commits through the relevant fact watermark; free-form tail text cannot substitute for an exact normalized facts query. |
| Semantic search that must include every newly submitted source in a batch | Wait for those sources' embedding/index stages. A small tail can be examined manually, but cannot guarantee complete semantic coverage of a large batch. |
| Exhaustive cross-conversation summary through a stated time | Require bounded relevant corpus coverage through a cutoff, or an explicit incomplete result. A local conversation tail alone is insufficient. |
| Graph query over relationships just extracted | Wait for relevant graph projection, not merely fact/vector stages. |
| Display final response, run state or a ready artifact | Read authoritative run/transcript/artifact records directly; no semantic-memory barrier required. |

Authorization and deletion checks always use trusted current control records. They never wait on, or accept substitutes from, LLM-derived semantic memory.

## Transcript lock design

Reads remain available subject to scope/access policy. The lock governs mutation of runtime-managed history, not ordinary authenticated read access. `conversations.append/edit/delete` would target the same authoritative store via backend adapters. Agent supports manual message save/delete and configurable automatic storage; exact edit/version mechanics must be qualified. [Agent messages](https://docs.convex.dev/agents/messages).

For tracked unlocked writes, proposed bookkeeping is message/source revision, actor, history revision, affected ingestion invalidation and repair status. Cached facts/vectors based on the old source are excluded/marked stale until repaired according to memory policy. Tool-call/result ordering and active-run revisions need validation. Custom forks may bypass managed bookkeeping at their own responsibility; the supported unlock policy retains it and never labels stale derived state complete.

## Future image-memory seam

Keep stable artifact IDs/version IDs/content checksums, MIME/type metadata, authorized source references and lineage from any future analysis to the exact asset version and analysis model. A later processor can create captions/OCR/visual embeddings as separate derived records and feed artifact references into recall. No current generic text vector is labeled a visual embedding, and the image bytes are not embedded in transcript/stream documents.

## Removed obligations

Remove Python APIs/tests/docs from Tasks 01/09/14/16/17, historical ownership adoption/import from Tasks 03/05, old-generation vector migration/rollback from Task 10, external media delivery from Task 12, and legacy existing-Cortex upgrades from Tasks 06/15. Keep host-preservation fixtures for new installation in a host app. Earlier review PASS applies only to the previous scope and is superseded; independent goal review precedes implementation.

No implementation, dependency install, paid inference, application tests, deployment, commits or publication occurred during this alignment revision.
