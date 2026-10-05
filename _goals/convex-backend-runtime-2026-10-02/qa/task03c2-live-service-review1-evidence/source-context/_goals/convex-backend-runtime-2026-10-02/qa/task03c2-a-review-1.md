# Task Judgment: Task03C2-A metadata SDK consumers, independent cycle 1

## Verdict: PASS

This verdict covers only signed base `c92d548368791386c62f39895e381ef6bde2dc86` plus the five frozen metadata SDK source/test overlays. It is not whole Task03, Task09, Task03C2, or full-service certification. No candidate source/test, canonical QA, schema, generated binding, deployment, commit, or release was changed by this judge. Builds, configuration adaptations, probe scripts, and outputs were confined to `/tmp/task03c2-a-review1-4cCdIR`; dependency installations were read through symlinks.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 5/5 | Every bounded requirement mapped below; independent baseline reproduces precisely five SDK compiler errors and the frozen candidate removes them. |
| Code Quality | 4/5 | Small, typed changes; safe field-by-field copied frozen receipt; awaited mutation; committed interpretation outside resilience; retained validation and merge behavior. Two baseline conditional lint warnings remain, with no errors. |
| Test Quality | 5/5 | 106 outcome test cases across 2 suites, 0 failures/skips/pending/todo; actual enabled/disabled/absent resilience; packed browser probes add null/default/copy/bulk-order outcomes. |
| Pattern Adherence | 4/5 | Capability error follows accepted GovernanceCapabilityError literals/class structure; existing public wrappers, return types, typed generated union, and backend-owned maintenance boundary retained. |
| Completeness | 5/5 | Root/module exports, packed ESM/CJS identity, strict DOM/types[] consumers, browser execution, root/scoped/backend types, lint, and disposable build all verified. |

**Average: 4.6/5.**

## Requirements Review

Locations below refer to the reviewed archive and identical frozen main overlays, not the unreviewed memory/fact changes in main.

| Bounded requirement | Met? | Evidence |
|---|---|---|
| Close only five accepted-metadata SDK compiler errors | Yes | `baseline-root-types.log`: exactly missing `sessions.expireIdle` and user result `data/version/createdAt/updatedAt`; `root-types.log` and `scoped-types-corrected.log`: exit 0. Only five overlays differ. |
| Preserve expireIdle signature and default evaluation | Yes | `src/sessions/index.ts:419`: unchanged `options?: ExpireSessionsOptions`, `Promise<{expired:number}>`; timeout evaluated with original nullish 30-minute default. Judge packed probe sees getter order `tenant,timeout` and zero dispatch. |
| Preserve tenant mismatch identity and precedence | Yes | `src/sessions/index.ts:422`; 3 resilience-mode mismatch cases assert `AuthValidationError/TENANT_SCOPE_MISMATCH`, field tenantId, no timeout access or dispatch; packed VM exercises public root identity. |
| Valid maintenance calls produce typed undispatched outcome before resilience/query/mutation/action | Yes | `src/sessions/index.ts:46` literal `BACKEND_MAINTENANCE_ONLY`, retryable false, outcome not_dispatched, requiredExecution trusted_backend_worker; `:426` throws directly. 27 session tests assert zero attempts in absent/disabled/enabled resilience. |
| No unsafe worker reference, maintenance credential, generated/public endpoint workaround, or fake auto-maintenance | Yes | Reviewed source diff removes the public call and introduces no worker binding. `src/sessions/index.ts:413` explicitly says it performs/schedules no automatic maintenance. All backend/generated/config files match base. Browser metadata excludes backend implementations. |
| Use actual immutable.store result union, including tenant-wide optional memorySpaceId | Yes | `convex-dev/immutable.ts:42` server safe branch; `src/users/index.ts:73` matches `string | undefined`; `:255` narrows via actual receipt discriminator. Tests use `FunctionReturnType<typeof api.immutable.store>` and typed receipt/hydrated fixtures, without receipt/profile casts. |
| Preserve hydrated mapping, initial get, merge/default behavior, tenant injection | Yes | `src/users/index.ts:226-246` initial validation/get/deepMerge/mutation byte unchanged; `:259` hydrated mapping byte unchanged. Positive unit results and independent packed probe verify server canonical fields and undefined data default `{}`. |
| Typed public committed error literals | Yes | `src/users/index.ts:83`: PROFILE_WRITE_COMMITTED_READ_UNAVAILABLE, retryable false, outcome committed, requiredCapability read; unit/ESM/CJS/DOM/browser identities and literals verified. |
| Receipt includes only safe server fields, copied/frozen; no private payload, caller fabrication, version/time, or cause | Yes | `src/users/index.ts:96`: explicit updated/type/id/tenantId/memorySpaceId/optional createdId copy then Object.freeze. Tests inject extra private properties; exact key/JSON assertions reject them. Judge browser probe mutates original server receipt afterward and confirms copy, undefined space, omitted createdId, server rather than caller values. |
| Interpret committed receipt after resilience resolves; one mutation and zero post-commit read/retry/action | Yes | `src/users/index.ts:237` awaits resilience; `:255` translates afterward. Tests assert underlying execute promise resolves receipt and exact query/write/execute/retry counts for all 3 resilience modes. Packed browser sees one query, one mutation, users:get then users:update, no action/network send/fetch. |
| Do not introduce blind write on initial read denial | Yes | Three public nested methods across all 3 modes assert same read error identity and zero mutation. Independent real packed enabled-resilience probe repeats denied update with one read/no write. |
| getOrCreate and merge propagate committed outcome and retain existing/default paths | Yes | `src/users/index.ts:745`, `:784` methods byte identical; tests assert two pre-write reads/one mutation, committed error receipt, existing-profile no-write, empty defaults, and hydrated merge/create behavior. |
| updateMany rethrows committed receipt rather than false zero/unsuccessful count, preserving earlier commits and stopping later items | Yes | `src/users/index.ts:1094-1100`: only committed error class is rethrown. Three-mode tests and fresh packed probe preserve `first,second` committed attempts, four reads/two writes, exact operation order, and no third item. |
| Preserve ordinary failures, bulk ordinary errors/missing rows/counts/dry run, and existing transient retry behavior | Yes | Unit tests retain mutation/read failure identity, skipped ordinary/missing bulk rows, successful counts, dry-run IDs, input validation before attempts. A genuine enabled-resilience transient write test asserts 3 attempts/2 retry callbacks and hydrated success. Judge packed probe additionally exercises ordinary bulk mutation denial followed by successful next item and null mutation fallback. |
| Both errors reachable through modules and root with stable ESM/CJS identities and unchanged public return types | Yes | `src/index.ts:785`, `:788`; packed exports checked in both module formats; strict DOM/types[] compilation checks update/getOrCreate/merge/updateMany/expireIdle promises and exact error literals. Negative type assertions deny receipt data/version/write/retry/dispatched claims. |
| Real packed Cortex.users/sessions with actual enabled resilience in browser VM; no Node globals, upstream key, inference or actual test-network dispatch | Yes | Both packed probes import extracted npm package, bundle platform browser, create actual Cortex + resilience, replace only public Convex network transport, assert no process/require, and guard all fetch/socket sends. Observed fetchCalls=0, socketSends=0, syntheticSockets=1. No provider key or model call supplied. |
| Existing provider/graph inputs only at unchanged reviewed baseline paths/bytes; no additions; provider-free root facade remains Task09 | Yes | Independent source graphs equal exactly; all input bytes independently hashed with only the three allowed source files differing; 819 existing provider/graph inputs retained at identical dependency paths. Browser platform bundling passes without Node builtin resolution. All 2,174 other tracked archive files, including lockfile, provider/graph sources and generated API, match actual git archive bytes. This is bounded baseline preservation, not certification of a provider-free root. |
| Preserve 36 other methods, 542 accepted files and 2,174 other archive files, exact five overlay/freeze hashes | Yes | `source-verification.json`, `method-verification.json`, `final-source-verification.json`; independently recomputed from git archive rather than trusting executor preservation booleans. All 43 frozen QA files match too. Root source change is exactly the two error re-exports. |
| Retain initial failed checks and evaluate corrections honestly | Yes | Executor initial scoped type failure retained/copied: receipt incorrectly required string memorySpaceId. Actual backend requires string|undefined, and final typed tenant-wide fixture passes. Initial browser assertion wrongly banned baseline provider/graph packages; diff replaces it with exact baseline graph equality plus explicit backend/builtin guards while preserving runtime/identity/count assertions. Judge's own first scratch-only scoped compile failed missing node/jest type libraries before scratch dependency symlink; initial failure retained, corrected setup passes with unchanged frozen source. |

## Original Task03 / Task09 context and limits

Every original requirement was reviewed for applicability, without treating accepted prerequisites as newly certified service outcomes.

| Original item | This boundary's coverage / status |
|---|---|
| 03 bounded A inventory/authority, B guarding/background, C credentials/subscriptions/callbacks | Separate bounded SDK consumer receipt only. Accepted inventory/metadata/worker/governance/auth sources are hash-preserved; whole03 remains in progress. |
| 03 public inventory and alternate bypass closure | Removes obsolete client maintenance reference; no backend visibility change. Other inventories/backend bypass closure belong to accepted or pending 03 substeps. |
| 03 refreshed host JWT, trusted issuer/subject memberships/bootstrap, metadata cannot provision privilege | Accepted03C1/auth/principal source preserved. No live JWT-refresh/bootstrap certification here. |
| 03 scoped direct access, administrator transcript lock, revision tracking, billable controls | These metadata wrappers retain pre-read/mutation scope semantics and cannot invoke maintenance. Transcript/admin/billable behavior is outside this five-file boundary. |
| 03 background revocation/deletion, authenticated subscriptions/assets/callbacks, admin config/redacted shares | Client idle expiration refuses dispatch; backend workers and those services are unchanged and not recertified. |
| 03 missing/forged identity or mismatched/omitted tenant/share cannot access alternate paths | SDK tenant mismatch and denied read/write handling verified. Complete forged/omitted/share backend inventory coverage remains outside this boundary. |
| 03 cross-tenant subscription/tool/upload/storage and helpers internal | No public worker helper reintroduced. No live subscription/tool/upload/storage access tested. |
| 03 revocation/deletion prevents later effects/resurrection, logout semantics | Initial denial prevents blind update; this is not live revocation/deletion/job or logout certification. |
| 09 versioned run/event/error clients, auth refresh/cursors/server scope/policy | Typed metadata errors/return contracts verified; run transport/auth refresh/reconnect is pending09. |
| 09 AI SDK7 remote-run UI transport, canonical quickstart backend tool, no second loop/writer | Unchanged and outside this boundary; no UI/agent-loop certification. |
| 09 separate response/memory finality, strict barriers/context overflow/capability errors | Explicit idle-maintenance and committed-read capability outcomes only; those run/memory features remain pending. |
| 09 browser-safe package boundaries | Candidate introduces no inputs/backend code/Node globals/network operations; allowed baseline provider/graph inputs retained. Full provider-free thin root facade remains09. |
| 09 live scoped text recall/tool/delayed indexing, two observers/reconnect/cancel/approval, pending tail/barrier, equivalent UI/TS semantics/refresh, slice independent of extensions | Not exercised or claimed by this offline metadata boundary. No graph/media prerequisites added. |

## Actual observations and discovery

- Qualified runtime: Node v24.19.0; cached npm 12.2.0 CLI used offline for build/pack, not the ambient npm 11.9.0.
- Discovery exactly 2 intended suites: metadata-consumers (79 cases), sessions-maintenance (27 cases). 106 passed, 0 failed/pending/todo, no skipped tests.
- Candidate root TypeScript, corrected scoped TypeScript and actual backend configuration (`lib: ES2021, dom`, no target widening) exited 0. Build emitted ESM/CJS plus d.ts/d.cts successfully.
- Owned ESLint exited 0 with 2 pre-existing no-unnecessary-condition warnings at user lines248/696. Baseline independently has corresponding lines210/652 plus 4 warnings caused by the five SDK type failures; no new warning introduced. Whitespace check passed.
- Main root independently still exits2 with exactly three unreviewed memory/fact `purgeAll` diagnostics at `tests/helpers/cleanup.ts:58`, `:77`, `tests/interactive-runner.ts:380`. No source/test repair made here. Candidate isolated root has none.
- Supplied corrected packed contract and fresh adversarial packed browser probe passed. Existing broad public contract also passed. Its first rerun retained the stock uninstrumented browser socket harness and therefore is not evidence of zero network attempts; an additional guarded version preserved assertions and independently observed zero fetch/socket sends (one inert synthetic socket).
- Base archive SHA256 matches supplied provenance. Local gpg signature checking reports missing public key; independently queried GitHub REST commit verification reports `verified:true, reason:valid` for exactly c92d.
- No live backend, actual JWT/subscription/service worker, full browser UI, graph, model, media, migration, deletion/revocation, or full-service gate was attempted/certified. No paid/service mutation/deployment/staging/commit/push/child agent.

## Issues Found

### Critical
None within this frozen boundary.

### Important
None within this frozen boundary.

### Minor
No introduced issue. Retained pre-existing lint warnings and unreviewed main diagnostics are recorded above and are not silently converted into green checks.

## Evidence paths and integrity

All judge evidence is under `/tmp/task03c2-a-review1-4cCdIR`:

- `report.md`, `evidence-manifest.json`, `commands.json`.
- `source-verification.json`, `method-verification.json`, `final-source-verification.json`, `reviewed-source.diff`.
- `tests.json`, `discovery.log`, `scoped-outcomes.log`, `owned-lint.log`, `baseline-owned-lint.log`, `owned-whitespace.log`.
- `root-types.log`, `backend-ES2021.log`, `scoped-types.log` (initial setup failure), `scoped-types-corrected.log`, `baseline-root-types.log`, `main-unreviewed-root-types.log`, `build.log`.
- `packed-browser-contract.mjs`, `packed-browser-contract.log`, `browser-outcomes.json`, `browser-metafile.json`, `browser-input-verification.json`.
- `adversarial-browser-probe.mjs`, `adversarial-browser-probe.log`, `adversarial-browser-outcomes.json`, `adversarial-browser-metafile.json`.
- `public-contracts.mjs`, `existing-public-contracts.log`, `public-contracts-guarded.mjs`, `existing-public-contracts-guarded.log`.
- `executor-*` raw retained initial receipts plus `executor-browser-correction.diff`.
- `base-signature.log`, `base-github-verification.json`, `base.tar`.

Source freeze SHA256: `76ced4206a6f5f8d2d638a016574ed4969c5cfd932d2f41da20693f010a715fb`.

Archive SHA256: `e2275d3829891df38d47c471232f2fd11bb8b35d6f6e8cf75b872910ed18c8b8`.

Five overlay SHA256 values:

| File | SHA256 |
|---|---|
| src/users/index.ts | e30af7422e442f5ac823a8f227e79dee17f6409fa6e7332550841d7aee70447f |
| src/sessions/index.ts | 4fbf811980bfaa56fa8f419d3adc62afbf57962106c748bfb00478991f9df11a |
| src/index.ts | a86f08d50c4b8ae37ea23439afdfbcf36597cd195cc7544ef1f9ec0c0dced46f |
| tests/unit/runtimeWorkerClient/metadata-consumers.test.ts | 8fc8e46015d80932a618479e4532e340a9ba75a54759e36431185167a7ffac2c |
| tests/unit/runtimeWorkerClient/sessions-maintenance.test.ts | dd6c22a9b34d94d1c4f70c501491e0de0315e061580681c33dbe3c074436618a |

The evidence manifest records SHA256 and byte count of every top-level raw evidence/probe/report file; parent should copy/inspect before recording this independent bounded PASS.

## Recommendation

Accept only this frozen bounded Task03C2-A metadata SDK consumer change. Continue the pending Task03/09 and memory/fact work under separate review; this gate supplies no broad live-service certification.
