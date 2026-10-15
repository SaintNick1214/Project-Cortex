# E2 memory effort implementation — source freeze

Root joint SDK/backend build passed. E2 dependent checks and catalog append are recorded below; CLI discovery and its finite version-fixture rerun are complete. This is implementation evidence, not independent acceptance or installed cloud qualification. Product base f87695783e8b21ffecf6298057a87cd8e69a3016; current HEAD includes Root QA-only3756a53b2. Existing dirty QA/work files are preserved. No Git mutations, service calls, model calls, publishes, deployment, Proofs, website or UnionArena edits were performed by E2.

## Implemented

- Shared E1 types are exposed through the root SDK and browser-safe `/runtime`. Modern submit/recall accepts optional validated `memory`; absent memory preserves old canonical bindings. The new typed recall request preserves explicit caller limits without inventing application result caps. Public server trace and evidence depth/path are validated and copied; existing public recall attribution remains available. The legacy administrative `Cortex.memory.recall(RecallParams)` input is unchanged.
- Remote transport supports fixed `options.memory` and exact per-message `body: {memory}`. Each submission snapshots normalized controls into its replay binding. Changed controls with the same message ID fail `IDEMPOTENCY_CONFLICT`; reconnect cannot override the original request. Authority, models, tools, headers and arbitrary metadata remain outside this body. Optional server effort trace reaches official AI SDK7 message metadata/status/finality and React type exports.
- Basic adds local `/effort [show|fast|normal|high|max]`, Normal initially, and typed HTTP `/chat`/`/recall` controls. Local show/invalid choices do not authenticate or dispatch. Pending session work snapshots the choice. Both web apps use accessible Normal-first selectors, capability pair2/1 detection, legacy-disabled status, backend trace and partial/unavailable distinctions. No app memory/model traversal was added.
- Explicit Max public recall defaults to30s rather than the old12s RPC cutoff. Explicit `requestTimeoutMs` still wins, including shorter values; other SDK operations retain12s. Basic uses its actual configured total timeout rather than a hidden12s clamp. Text admission remains asynchronous and no operation retries automatically.
- The existing CI definition publisher selects V8 registryV4 hash5152bd0c3f8e35907c2d57c0a3467e2450e8db0dfb5174c552024c954554a515, relevant handler2 and inputSelection2, then verifies capability2/1 on readback. The existing CI installer recognizes deliberate canonical1.5.0 and still refuses unapproved versions.
- SDK/CLI/provider stay0.39.0. Three canonical apps are1.5.0; catalog package1.4.0. Lock edits are version metadata only. Deliberate append assembly added only three1.5.0 payloads. All15 historical payload trees (1836files), including immutable1.4.2, retained their physical byte hashes and catalog payload hashes. Existing packed ESM/CJS/types/browser checks gained effort assertions.

## Observed source checks

Commands/cwd/exits and full raw logs are in `memory-effort-e2-checks/*.receipt.json` and matching `.log`; `source-freeze1.json` binds40 owned source paths; `source-freeze2.json` records the finite test-only mock typing repair found by joint full tsc.

| Check | Observed outcome |
| --- | --- |
| SDK source `tsc -p tsconfig.lint.json --noEmit` | PASS exit0,11.286s |
| All9 client-runtime suites | PASS322/322, zero skips, natural exit12.383s |
| CI publisher + demo installer | PASS31/31, zero skips, natural exit9.750s |
| Selected actual SDK ESLint paths | exit0;19warnings,0errors (retained warning log) |
| Chat changed3files Biome check | PASS; applied formatting to owned files only |
| `git diff --check` | PASS at source freeze |

Earlier `ci-publisher1` retained the old expected registry hash, and `ci-publisher2` retained an old1.5.0-unapproved fixture. Both red logs are preserved. The concrete fixes assert currentV4 hash and accept approved1.5.0 while refusing1.5.1; `ci-publisher3` passes. Joint full tsc also found an empty-array inference in the populated recall attribution fixture. Its action mock now explicitly returns `RuntimeRecallResult` and the populated item is `RuntimeRecallItem`; the runtime assertions were retained and `client-unit4` passed106/106. Initial `source-lint1` had ignored package files; it is not evidence for package lint. `source-lint2` used the actual SDK paths only.

## Dependent checks after the joint build

All raw command receipts use declared Node24.15/npm12.2, explicit inert unit URLs and existing mocks. Child process environments omit service credentials. Canonical private env files remain untouched. No deployment, model call or service mutation was run by E2.

| Check | Observed outcome |
| --- | --- |
| Root joint SDK/backend build (Root-owned) | PASS exit0,26.871s; root-sdk-build1 receipt |
| Provider types and ESM/CJS/React/remote declarations/build | PASS |
| Provider unit/React |263/263 passed in initial discovery; failed remote suite repaired and37/37 passed (300 current assertions total) |
| Provider mocked integration | PASS5suites74/74 |
| CLI typecheck/build | PASS |
| CLI lint | FIXED existing Basic main namespace no-undef via exact imported node:readline ReadLineOptions input/output types; final exit0 |
| Basic types/build | PASS; type-only lint repair checked again |
| Basic units / controlled Hono integration | PASS11suites151/151 +2suites25/25 |
| Canonical Vercel types/lint/build | PASS after exact select-variable repair |
| Canonical Vercel unit+mocked integration | PASS8suites156/156 |
| Chat lint / unit+integration | exit0 (164 retained lint warnings); PASS24suites253/253 |
| Chat complete tsc / Next production build | INCOMPLETE: observed exits2/1 from missing official convex/_generated/server and resulting implicit-any errors; no replacement bindings or exclusions added |
| Catalog1.4.0 append | PASS: exactly Basic/Chat/Vercel1.5.0 added; all15old payloads byte-identical |
| Catalog types/lint/tests | PASS24/24,0skips |
| CLI units on final catalog | Full discovery43suites1065tests:1060PASS/5 stale-version failures; exact approved1.5.0 literal repairs then both affected suites42/42PASS, all original assertions retained (1023 unaffected +42 final passing assertions) |

`catalog-preimage1.json` and `catalog-append-verification1.json` bind preservation. New payload hashes:

- Basic1.5.0: d125015b42450777a35a29b57fe2d6c3014bdfad811b280ebc045e538d2ac040
- Chat1.5.0: 6512666f75fa4907908eeaa612d27a46d806678bf278f2c649c693ac4e58f2a9
- Vercel1.5.0: 0038a593fd760d29fd3e2623b8e4b85e8430815f4a5196a3f4a658678bf27c9b

The provider actual-SDK fixture predated native admission/observation envelopes. Its old handler/call sequence failed after the real current SDK build. The repaired fixture asserts submitAndStartEnvelope + independent fresh post-session, then observeEnvelope + independent fresh post-session, with exact call order, no separate get/start and unexpected query/action refusal retained. This reflects the current optimized native protocol rather than removing the authentication assertions.

The Vercel compact select had one inconsistent renamed variable; actual tsc and the new Max-selection test failed before repair and both pass after. Raw red logs are retained. Neither repair changed SDK product source after the Root build. Basic's imported type preserves the exact public readline stream contracts and has no emitted runtime effect.

## Remaining installed qualification

Chat's complete types/build requires genuine native generated bindings in an installed disposable host. Root identified the genuine local `doCodegen` helper. Its one attempted invocation failed before initialization/generation because installed Convex source requires unavailable `@sentry/node`. No bindings were written. The first command incorrectly used a temporary child HOME; that override was removed, its owned temporary directory was automatically cleaned, and no credential/config state was changed. The failed raw log/receipt is retained. Root directed the local helper path to stop without installing dependencies or stubbing its context. Official native codegen on the verified fresh disposable deployment remains required; no bypass, fabricated bindings or weaker TS was introduced. Browser/cloud effort profiles, real hop reachability, latency and the one independent combined review remain Root-owned. The source/controlled checks and static builds do not certify those outcomes. Overall E2 qualification is INCOMPLETE until that prerequisite closes.


## Final handoff

`source-final1.json` binds43 owned code/manifest paths plus `catalog-final1.json` binds all18 payload trees. `provider-dist1.json` binds15 built output files. CLI's full red log and affected2-suite green rerun are retained; the five failures were only approved-version expectations. No tests were removed, skipped, or forced to exit. All other selected offline checks passed with the warning counts stated above. Chat full type/build remains required in Root's installed native qualification, and no independent acceptance is asserted here.
