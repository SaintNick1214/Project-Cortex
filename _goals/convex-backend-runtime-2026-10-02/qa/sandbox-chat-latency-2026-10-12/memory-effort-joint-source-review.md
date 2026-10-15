# Task Judgment: Memory effort joint source, tests and canonical docs

## Verdict: PASS — controlled source review only

All five dimensions meet acceptance-policy v2 for this coherent batch, with **zero unresolved concrete breaking source findings**. The review includes the repairs requested during this same review. It authorizes continuing installed qualification; it does **not** accept the expanded goal, Chat's complete native build, real profile behavior, hosted latency or release readiness. Original 17-task acceptance remains historical within non-video scope-version3; C7 custody and original planning were not reopened.

Reviewed product baseline: `f87695783e8b21ffecf6298057a87cd8e69a3016`. Current HEAD `3756a53b2333598bc23f089794ee1a76437bba2e` adds QA only. R is the separate `SaintNick1214/Project-Cortex` checkout at `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`; W is `SaintNick1214/cortexmemory.dev` at `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs`. Root's prospective hosted-fixture scripts are QA preparation, not reviewed shipped functionality.

## Requirements review

| Requirement | Source/control outcome and evidence |
| --- | --- |
| Fast2/3s, Normal4/6s default, High8/8s, Max uncapped product depth/entry count with30s target | Met in `src/domain/memory-effort.ts`; effort tests assert numeric profiles, defaults and lower administrator/caller clamps. Targets remain unqualified. |
| Real logical hops, direct depth1 regardless age, scoped evidence relationships, dedupe/cycles | `src/domain/memory-traversal.ts` performs BFS; `convex-dev/runtimeMemoryTraversal.ts` uses exact entity and source/fact indexed adjacency. `memory-traversal.test.ts` isolates the seed, asserts2/not3,4/not5,8/not9, Max12, direct old/deep depth1, cycle dedupe and actual bounded index use. Hydration/auth joins add no hop. |
| One relevance-selected optional cap across history/evidence/pending, mandatory current input and tool groups | `model-input-selection.ts` now compares V2 optional history and evidence together. Actual populated-history dispatch keeps the matching old fact, seven optional history rows and current input within Normal8. Existing pending completeness and complete-tool-group tests remain. V1 removal/result interpretation remains exact. |
| Useful bounded Max and honest reached/count/stop metadata | Work/page/candidate-byte bounds, shortest bridges, context fitting and Action-clock deadlines are wired. Max selects12 independent direct facts and history beyond128; queued-payload/fanout tests exercise work/context bounds. Native raw fact/ANN cap hits report partial discovery even when stale rows reduce hydration. Fitting distinguishes `entries` from actual `input` overflow. Cancellation and whole-input/current-source safeguards remain; this is controlled evidence, not live cancellation qualification. |
| Same traversal in public recall and Agent; current identity/grant/source/bridge/tombstone fences | Both adapters call `traverseConvexMemory`. Prepared facts must equal current facts; selected evidence and intermediate shortest-path bridges survive through independent final delivery. Current source/fact/profile/authority checks and post-I/O expiry checks remain. Stale bridge, denied fact-only source edge, foreign/tombstoned adjacency and cross-RPC mutation tests assert outcomes. No optional external-service coverage is certified. |
| Per-call admission, financial capture/attachment boundaries, replay and no paid retry/app loop | Reviewed public and Agent embedding paths retain existing governed calls and separate financial commits; traversal adds no model call. Submission and public recall bindings include memory controls. Existing revocation/budget/no-duplicate-effect tests remain. Client/provider/apps introduce no model, tool or memory loop. |
| V8 selectionV2/registry4/handler2 while old definitions, snapshots and omitted requests remain supported | `agentDefinitions.ts`, `runs.ts`, `runtimeTranscript.ts`, and execution guards pin the effective policy. Registry hash is `5152bd0c3f8e35907c2d57c0a3467e2450e8db0dfb5174c552024c954554a515`. Legacy explicit memory rejects before admission effects; old omission and V1 policy interpretation remain. Legacy delivery envelopes201/101/262144 remain tested. |
| Typed browser-safe SDK requests/results, strict input validation | `/runtime` exports typed controls/trace, copies selected trace/path metadata and preserves omission. Null effort and malformed numeric ceilings reject. The registered public handler returns structured `INVALID_INPUT`/`not_dispatched` before budget/model effects. Packed ESM/CJS/declaration/browser contracts passed after final repair. |
| Closed remote `{memory}` body, immutable pending/replay controls, reconnect/approval/cancel semantics | Provider tests assert normalized equivalent replay, changed-effort conflict without redispatch, snapshotted controls and refused reconnect overrides. Existing reconnect/cursor/approval/cancel/abort outcomes remain. Actual SDK fixture retains admission/output envelopes and independent post-session checks. |
| Accessible Basic/Chat/Vercel choices | Basic local `/effort` parsing snapshots before awaited session work. Both web controls have labels, capability2/1 detection and disabled legacy status. Controlled app tests exercise propagation, unsupported definitions and auth races; actual runtime browser profiles remain later. |
| Append-only versions and unpublished package boundaries | SDK/CLI/provider remain0.39.0; apps1.5.0/catalog1.4.0. Catalog checks pass, and append verification preserves15 prior payloads while adding three1.5.0 trees. Installed-candidate qualification remains required. |
| Canonical docs distinguish legacy/unreleased, stage duration and user latency | W's Memory Effort guide, runtime/transport references and performance page match the contract. They label3/6/8/30s as targets and K29 as pre-effort observations. Strict build/types and10 consumer snippets pass. Reviewed saved Mermaid/performance screenshots corroborate actual docs rendering; this is not runtime UI qualification. No video implementation/release added. |

## Findings resolved during this review

1. **V2 history saturation dropped every retrieved fact/memory.** A reviewer-run pure production-selector reproduction retained eight unrelated history rows and removed a relevance1 fact. V2 now compares history/evidence relevance; actual candidate dispatch and paired V1 regressions pass.
2. **Agent direct discovery retained the old10 boundary without honest truncation.** Effort-aware limits now derive from pinned work/context/candidate-byte policy, up to the bounded native100 maximum; legacy10 remains exact. Actual Max composition retains12 independent depth1 facts. Public/Agent raw fact and ANN page caps now report work/partial coverage, including a tombstoned raw hit.
3. **Entry pruning was mislabeled input overflow.** V2 carries actual omission reasons; populated-history dispatch asserts `entries` and absence of `input` when input fits.
4. **Null effort silently became Normal; raw numeric-ceiling errors were untyped.** Explicit null rejects, and direct public negatives assert structured refusal with zero policy/model/search/account/derived effects.
5. **The Vercel selector referenced an undefined variable.** Its finite variable correction is covered by actual type/build and selector tests; failed receipts remain preserved.

No unresolved critical, important or minor source finding was established after these repairs.

## Evidence review

- Read actual changed/new product and test files, E1/E2 reports and raw logs/JSON, canonical website changes and relevant instructions/rubrics. The only reviewer execution beyond reads/hash checks was one bounded pure-function reproduction and `git diff --check`; no duplicate service or broad suite was run.
- Final E1 repair batch: **191/5 suites**, natural exit0,20.128s; direct public validation: **31/1 suite**, natural exit0,4.741s. Full tsc and affected-source/test ESLint exit0. Original304/10, envelope79/3 and authority33/1 receipts used forced exit and establish assertions only. The earlier546-test sweep remains failed; it was not relabeled or rerun for ceremony.
- Root final SDK/backend build: exit0,27.206s; final packed public contracts: exit0,2.024s, both after E1 freeze. Root full lint2 exit0,35.761s preceded final repair; later full tsc/changed-file lint provide affected coverage. No claim of a fresh whole-root lint after the last repair.
- E2: client322/322; publisher/installer31/31; provider263 initial unit/React plus repaired37 remote assertions,74 mocked integration assertions; Basic151 unit plus25 controlled integration; Vercel156 assertions and actual production build; Chat253 controlled assertions and lint; catalog24/24. CLI's1065 discovery retained five stale-version failures; the two affected suites later pass42/42 with all assertions retained. These are separate observed runs, not a fabricated single all-green rerun. Warning logs remain disclosed in E2's report.
- W strict Docusaurus build/types and10 extracted consumer snippets pass. Root render receipt records the visible guide/Mermaid and distinct pre-effort timings; screenshots were inspected. Root's verification tab7 closed and docs server exited130. Prior stale tab6/internal-error cleanup remains a disclosed final-cleanup item.
- Independently verified current hashes:20 E1 source,10 E1 tests,43 E2 paths and16 website files; **no mismatches**. E1 log/receipt hashes also match. E1 repair-manifest SHA256: `ef157cec9cc83233dd9a7a6e5fd3e5bb8266b0c01843bc207bf665aef8e3dd2e`. Grouped source/test/docs manifest digest: `58e33d11a4832dfa61b40305e53a15f1578e76601ce7150ffa04b2f7643fc3ab`.

## Dimension scores

| Dimension | Score | Basis |
| --- | ---: | --- |
| Requirement fulfillment |4/5| Mandatory changed source behavior is wired and supported by outcome controls; later native qualification is explicitly open. |
| Test quality |4/5| Relevant positive, failure/race and no-effect assertions; actual adapters/dispatch fitting exercised, with controlled/live limits preserved. |
| Completeness |4/5| Source exports, registration, clients, controls, catalog and docs are present; installation/native qualification is a distinct remaining phase. |
| Code quality |4/5| Bounded pure traversal and native adapters retain current authority/effect boundaries; compact existing house style remains maintainable enough. |
| Pattern adherence |4/5| Existing governed runtime, public contracts, versioned snapshots, independent financial commits and append-only catalog patterns are retained. |

Average **4.0/5**. Policy minima4/4/4/3/3 are met. No average overrides a blocker.

## Remaining gates — not PASS

Chat's complete tsc/Next build remains **INCOMPLETE** because genuine `convex/_generated/server` output is absent. Its official offline-codegen attempt failed before generation on unavailable `@sentry/node`; no substitute bindings or weaker TypeScript settings were introduced. Close this prerequisite through genuine native codegen in the verified installed disposable target and rerun the full app checks.

The changed installed packages, real managed-vector/public/Agent depth outcomes and negatives, runtime desktop/phone effort/reconnect/approval/cancel flows, representative profile latency targets, relevant actual graph coverage, owned-resource cleanup and final independent audit remain required. This source PASS cannot be used as their evidence. No GitHub calls, services, paid inference, deployments, commits, publishing, production or Union Arena work occurred in this review.
