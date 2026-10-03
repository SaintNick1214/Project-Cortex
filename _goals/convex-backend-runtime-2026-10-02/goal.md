# Goal: Cortex-owned agent runs on Convex

**Created:** 2026-10-02 (America/Los_Angeles)
**Status:** Planning — product scope and runtime defaults aligned; implementation not started.
**Authorization:** Creating, committing and pushing this planning branch is authorized. Product implementation starts only when the implementation prompt is sent to the dedicated agent.
**Cloud handoff:** [Copy-paste implementation prompt](implementation-prompt.md).
**Research:** [Architecture and evidence](../../_research/convex-ai-gateway-2026-10-02/architecture.md)
**Supersedes:** The earlier transport-only proposal; historical findings in the Gateway report do not govern this scope.
**Current authority:** [User decision register](../../_research/convex-ai-gateway-2026-10-02/decision-gates.md). The [earlier planning PASS](qa/planning-review-2.md) covered a broader superseded scope; current revision requires independent goal review before execution. Live compatibility is unverified.
**Confirmed direction:** Indexed memory plus eligible pending context, queued mutating runs within a conversation, tracked transcript unlocks and the remaining tool/retry/default policies are aligned. Embeddings use a clean-slate design; previous models, dimensions and schema layouts impose no constraints. No product decision question remains pending.
**Target:** This `Project-Cortex` repository; resolve all paths against the cloud checkout root.
**Branch prerequisite:** COMPLETE: #130/#131 merged; remote dev `3341d64ddc06f1de26ed525312ef2c1b89b16952` contains current main and matches the CI-qualified reconciliation tree; [reconciliation report](../../_research/branch-reconciliation-2026-10-02/report.md). Refresh manifests, runtime floor and canonical documentation paths on that baseline before execution. Planning files were excluded from the reconciliation merge. The implementation handoff is on `feat/convex-backend-runtime`, based on that reconciled dev commit; no product implementation has started.

## Summary

Move ordinary agent-turn orchestration, context injection and built-in memory inference into Cortex's Convex backend. Compose Convex Agent, Workflow/Workpool and the official AI SDK 7 Gateway provider while Cortex owns authorization, model policy, semantic memory and artifacts. TypeScript/application code submits input and observes durable responses rather than owning the model/tool/memory loop.

## Success Criteria

- [ ] One authenticated request starts a scoped backend run with Cortex context and a registered backend tool; TypeScript clients require no upstream provider key.
- [ ] Cortex owns stable conversation/run identity; Agent owns one canonical executable transcript. Read/write/export/sharing endpoints target that store without independent duplicate message writers. An administrator-controlled write lock retains revision tracking and stale-memory detection when unlocked.
- [ ] Saved output supports authorized subscriptions, reconnect, multiple observers, typed UI/artifact/tool parts, final-only observation, cancellation and capability-driven approval continuation.
- [ ] Response completion does not wait for semantic indexing. Admission/finalization durably register ingestion work; next-turn pending-tail continuity and explicit strict-memory barriers handle indexing lag honestly.
- [ ] Stable event IDs, source eligibility, ordered/version-checked belief commits, stage receipts and tombstones prevent duplicate/stale/resurrected memory after retry, overlap or deletion.
- [ ] Every billable operation passes a versioned per-function model/interface/capability/budget policy. Secondary title/artifact/suggestion calls have no hidden direct-provider path.
- [ ] A clean-slate source/chunk/vector schema and supported indexes are chosen for the new runtime. Stored/query vectors carry matching semantic profile/model/dimension/index provenance, with current source revisions and authorization; no previous embedding architecture or upgrade tooling constrains the design.
- [ ] Image and durable async-video generation create owned Cortex artifact versions with provenance, reference-aware cleanup, authenticated Convex delivery within 20,000,000 bytes and TypeScript/UI parity. No external media storage is added; future image analysis is a lineage seam only. Alpha/unavailable configurations produce clear capability errors.
- [ ] Verified principals and trusted grants guard all external run/storage/search/share/tool/media/graph paths that could bypass the new boundary. Revocation and user/space deletion are exercised across background jobs.
- [ ] Modern clients share one backend domain implementation. Vercel AI SDK 7 integration acts as a remote-run UI transport without a second tool loop or memory writer.
- [ ] Fresh Cortex installation is additive to a host app: unrelated tables/functions, custom functions directory, HTTP/auth routes and Convex/runtime config survive installation retries/conflicts. Existing-Cortex deployments/data are not migrated.
- [ ] Required affected quality/module/UI checks and actual disposable-target service outcomes pass; missing credentials/services remain incomplete rather than implied success.

## Scope

### In Scope

AI SDK ≥7.0.105; official Gateway provider; Convex ≥1.46; qualified Agent/Workflow composition; backend domain services; canonical transcript/run resources; scoped authorization and bypass closure; deterministic model policy and budgets; reactive streams; durable asynchronous memory/graph projection; clean-slate embedding storage and retrieval; image/video job and artifact integration; bounded authenticated Convex asset delivery; TypeScript/Vercel clients; additive CLI/demo/template setup; new-install documentation and outcome validation.

Broader authorization is included only where required to protect this runtime and its data/alternate entry points, rather than unrelated security or CLI cleanup. Public API/default direction is aligned; exact types and component contracts remain subject to technical qualification. Planning approval is not execution authorization.

### Out of Scope

Decisions/Jev or future Decisions APIs; adaptive quality/cost model optimization; standalone speech/transcription/realtime audio and unqualified media-editing capabilities; arbitrary client closure execution; replacing Cortex semantic memory/artifacts with Agent features; implementing alternate self-hosted/direct inference providers; Python implementation/parity/QA; legacy-Cortex transcript/data/deployment migrations; vector backfills/cutover/rollback; external media storage/R2/large-asset delivery; old AI SDK major compatibility; unrelated sibling repositories/CLI modernization; production deployment; package publishing/releases; merging the implementation PR without a later request. Branch creation and committing/pushing this plan are authorized. The pasted implementation prompt can authorize implementation commits and a draft PR.

### Future Considerations

Explicit browser/device tool lane; measured adaptive routing/Decisions after stability; additional backend provider connectors; image artifact analysis/captions/OCR/visual embeddings; additional derived embedding generations. No image processor or general reindex workflow is built today. Extension seams may be defined without implementing these features.

## Affected Areas

| Profile layer | Areas | Required shift |
|---|---|---|
| Backend/contracts | `convex-dev/`, component setup, runtime config | Verified scope, run/policy ledgers, Agent/Workflow adapters, domain services, vector/media jobs |
| TS domain/client | `src/` | Separate pure domain logic from remote transport; thin run/memory/artifact APIs and tracked direct writes |
| CLI/provider | `packages/cortex-cli/`, `packages/vercel-ai-provider/` | Additive installation and AI SDK 7 remote-run UI integration |
| Demo/templates/docs | Canonical quickstart, basic/chat templates, package READMEs and canonical website documentation (separate repository) | Backend tools, auth/setup, reconnect/artifacts and fresh-install guide |
| Validation | Profile §4/§9 and `qa/` | Scoped security, memory, graph, provider, CLI and demo evidence |

## Key Decisions

| Decision | Aligned direction | Research |
|---|---|---|
| Runtime | Compose Agent + Workflow + Gateway under Cortex | Architecture §3–4 |
| Transcript | Agent executable history; Cortex access metadata; administrator write lock with tracked direct writes | §4 |
| Memory consistency | Durable async stages + pending tail; explicit strong barrier | §5 |
| Model controls | Deterministic backend policy per operation, pinned versions | §6 |
| Embeddings | Clean-slate source/chunk/vector design; compatible profile/index matching; no legacy constraints | §6 |
| Media | Gateway generation feeds retained Cortex artifacts; Convex delivery within 20,000,000 bytes; future analysis seam | §7 |
| Public surface | Runs facade + modern explicit memory APIs + UI transport | §8 |
| New-install default | Gateway when eligible; explicit capability error otherwise | §8 |
| Auth | Verified principal + trusted grant across every reachable path | §9 |
| Installation | New-install host integration preserves unrelated app config; no legacy-Cortex upgrade | §10 |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Two histories or memory writers | High | One canonical transcript + one ingestion receipt per event |
| Next-turn stale memory | High | Authorized raw-history/pending-tail overlay, watermark and strict barrier |
| Replayed external effects/paid calls | High | Stable operation IDs, checkpoints and uncertain outcomes; no blind retry |
| Authorization bypass/deletion resurrection | High | Inventory/close public paths, trusted grants, revocation and tombstones |
| Embedding-space mixing | High | Profile-isolated vectors/indexes and per-job resolution pinned to current source revisions |
| Private files exposed by bearer URL | High | Authenticated Convex HTTP serving with a 20,000,000-byte cap; oversize error/cleanup |
| Entire deployment disabled by spend cap | High | App admission limits; document Gateway deployment kill switch |
| Host config or dirty CLI work overwritten | High | Additive fixtures, status reread and disjoint editing ownership |
| Published peers do not imply live compatibility | High | First bounded qualification gate on a verified disposable target |

## Implementation Phases and Tasks

All tasks are planning-only and flat under `tasks/`. Relative effort is guidance, not a time estimate. Shared interfaces must be fixed before dependent writes. Each task requires its own observed acceptance evidence during later execution.

| Phase | Task | Depends on | Effort |
|---|---|---|---|
| Core qualification | [01 Stack and text-boundary qualification](tasks/01-qualification.md) | Execution request + disposable core prerequisites | M |
| Foundation | [02 Backend domain separation](tasks/02-domain-services.md) | 01 | L |
| Foundation | [03 Identity and scoped endpoint access](tasks/03-authorization.md) | 01 | L |
| Foundation | [04 Model policy and admission budgets](tasks/04-model-policy.md) | 01, 03 | M |
| Runtime | [05 Transcript and run ledger](tasks/05-transcripts-runs.md) | 02, 03, 04 | M |
| Early integration | [06 Additive backend installation](tasks/06-additive-installation.md) | 03, 05 | M |
| Runtime | [07 Agent execution and reactive output](tasks/07-agent-streams.md) | 05, 06 | L |
| Memory | [08 Durable memory consistency](tasks/08-memory-pipeline.md) | 02, 05, 07 | L |
| First vertical slice | [09 Text clients and UI](tasks/09-text-client-slice.md) | 06, 07, 08 | M |
| Memory extension | [10 Clean-slate embeddings and retrieval](tasks/10-embedding-profiles.md) | 04, 08, own service gate | M |
| Memory extension | [11 Durable graph projection](tasks/11-graph-outbox.md) | 03, 08, own service gate | M |
| Media foundation | [12 Convex assets and bounded delivery](tasks/12-asset-lifecycle.md) | 03, 05, own storage gate | M |
| Media extension | [13 Gateway media jobs](tasks/13-media-jobs.md) | 04, 07, 12, own media gate | M |
| Client extensions | [14 TypeScript and UI extensions](tasks/14-client-extensions.md) | 09, 10, 12, 13 | L; bounded substeps |
| Full integration | [15 CLI/demo/template integration](tasks/15-product-integration.md) | 06, 11, 14 | L; bounded substeps |
| Verification | [16 Cross-layer outcomes](tasks/16-outcome-validation.md) | 10–15 | L |
| Handoff | [17 Documentation and independent gate](tasks/17-docs-audit.md) | 15, 16 | M |

Tasks 01–09 form the first complete vertical slice, independent of media/storage/graph service access. It proves an authenticated text turn, scoped recall, one backend tool, reconnect, immediate next-turn continuity and durable ingestion. Full media/vector/graph scope follows the same foundation. TypeScript/UI substeps may parallelize once the shared contract is stable; serialize overlapping provider/demo/CLI/mirror work and preserve unrelated local work. The handoff branch excludes the dirty local source work from other sessions.

## Open Gates and Definition of Done

Task 01 qualifies core text eligibility, cross-component transaction/finalization semantics, AI SDK 7 UI/tools/reasoning/cancel contracts, interrupted execution and TypeScript UI transport. Tasks 10–13 independently qualify managed embedding profile matching, graph runtime/network, bounded private Convex file delivery and media availability at their entry gates; they cannot block Tasks 01–09. Unsupported features must produce a bounded contract revision; they cannot be silently omitted while claiming success.

Completion requires all success criteria and task evidence, scoped module/quality/UI checks, observed live service outcomes and independent final audit. Use the profile's core modules rather than all workspace siblings. Fresh-install host business data/config must be preserved. Old Cortex deployment/data migrations, Python and external media storage are explicitly excluded by user instruction, overriding broader historical profile/plan obligations.

On the reconciled main baseline, the basic template's `build` is offline TypeScript and `build:convex` separately deploys Convex; use offline TypeScript/Vitest for quality checks without deployment authorization. Chat-SDK template gets its own package checks and title/artifact/suggestions/browser outcomes; canonical quickstart checks alone do not qualify both templates.

When implementation is explicitly requested, invoke feature-orchestrator, reuse this plan, reread current Git status/manifests and run its independent goal judge before Task 01. No application tests, package installation, codegen, paid inference or deployment were performed during planning. This document does not activate the separate goal API.
