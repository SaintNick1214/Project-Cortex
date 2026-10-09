# Task Completion Report

## Status: PARTIAL — bounded source batch complete; actual CI/runtime and legacy compatibility open

Source-only changes implement usable guarded setup, privileged internal provisioning/policy installation, signed JWT consumers, exact scope lifecycle cleanup with public denial verification, and a registered seven-case managed runtime suite. No deployment, inference, credential write, commit, push, acceptance count, or other owner's product source was changed.

## Changes made

- `.github/workflows/pr-checks.yml` uses five new `CORTEX_CI_*` secret selectors and five public variables. The four historical secret names remain untouched. The original exact dev-only, distinct SDK/CLI and URL/allowlist guard runs before auth config or deployment. It generates public customJwt configuration, deploys the approved candidate, installs a pinned compiled policy, provisions scoped fixtures, and issues per-job RS256 JWTs. Consumer jobs receive no deployment-admin keys. Tracked bindings allow check jobs to stay offline. Full original root/provider/CLI suite commands remain selected. Cleanup waits for all consumers and runs after a successful or failed setup; its successful result is required after successful setup.
- `scripts/ci/runtime-fixtures.mjs` implements exact per-attempt SDK/CLI tenant/space identities (owner, read-only peer, independently scoped outsider), RSA2048+ JWT issuance, public-only data-JWKS auth config, refusal to overwrite existing host auth, bounded pinned Convex internal operator invocation, compiled manifest installation, verified grant results, and lifecycle retirement. The operator subprocess gets no issuer private key/JWT/provider credentials; errors cannot become success. Tokens go into a masked private runner environment, never artifacts.
- `scripts/cleanup-test-data.ts` replaces unsupported unauthenticated `admin:clearTable`, generic Server Error retries and swallowed failure with exact `runtimeAuth:deleteScope` calls. It proves all three roles subsequently receive `FORBIDDEN` from the public session API. It reports retirement rather than global purge; tombstones/history/raw rows remain, and native ephemeral-target deletion remains necessary for complete physical disposal.
- `tests/env.ts` and CLI `tests/env.ts` preserve explicit native/CI targets against `.env.local`, alternate local and cloud selector substitution.
- `tests/helpers/runtime-fixtures.ts` provides current scoped JWT HTTP/reactive fixtures and fails explicitly for missing/mismatched/expired fixture metadata. Its local token checks catch setup mistakes; actual Convex transport performs signature/issuer/audience verification.
- `tests/integration/runtime-ci.test.ts` is registered in the existing root discovery. Seven prospective actual cases assert the same principal through HTTP/reactive clients; unauthenticated/substituted/cross-tenant denial; idempotent locked canonical transcript; read-only restrictions; admin-only unlock and stale revision refusal followed by one persisted message; `PROFILE_NOT_READY` for arbitrary legacy vectors; and governed real source-backed extraction/embedding/managed retrieval plus receipt replay. Missing qualified service/auth prerequisites fail; no typed-unavailable result is accepted as functional completion.
- Three new `scripts/ci/*.test.mjs` files cover real local cryptographic signatures, target/effect ordering, exact grants/results, public cleanup denial verification, preserved host auth, environment override isolation, private material boundaries and workflow wiring. Original 12 disposable-target assertions are unchanged.

## Requirements checklist

- [x] Preserve unrelated dirty work, owner boundaries, original guard assertions and service failures.
- [x] Implement finite current-auth/setup/cleanup source, rather than a plan-only foundation.
- [x] No production key classes, same-target SDK/CLI selectors or substituted origins allowed through the original guard.
- [x] Supported runtime vector suite requires real governed model/profile/source outcomes, with no arbitrary embeddings accepted as an actual pass.
- [x] Record discovery, prospective actual assertions, source/check receipts and exact native activation plan.
- [ ] Execute new actual suite and cleanup on two independently allocated verified CI dev targets; native sole executor owns this work.
- [ ] Establish full historical SDK/CLI compatibility: the old suites contain obsolete identity/embedding/cleanup/null-denial assumptions. They remain discovered and are not presented as passing.
- [ ] Complete Task16/full12 outcomes, including actual graph/media/run/reconnect/failure windows. This scoped source batch does not claim those outcomes.

## Verification

See `source-check-receipt.json` for exact commands, cwd, versions, file hashes and exit statuses. Node24.15/npm12.2 were selected from the agreed toolchain.

- Controlled Node tests: **30 PASS / 0 FAIL / 0 SKIP**, including all original12 guard assertions. No actual service calls.
- Root TypeScript, standalone cleanup TypeScript, affected root/CLI/CI lint: **PASS**, no final lint warnings.
- Workflow YAML parse and functional wiring assertions: **PASS** within the controlled tests.
- Default Jest discovery: **226 files**. Effective unchanged CI discovery: **226 files**, including the new modern suite. CI still overrides the default exclusion: `runtime/gateway-dispatch.test.ts` is selected by CI while one debug file is excluded. This pre-existing selection discrepancy was recorded, not silently changed.
- CLI E2E discovery: **five files**, unchanged.
- `git diff --check`: **PASS**.
- First standalone TS6 file invocation failed `TS5112` because `--ignoreConfig` was omitted; preserved in `cleanup-types.log`. The corrected final command passed.
- No service-dependent suite was executed before actual target/auth/policy prerequisites. No full build/package claim; Root owns the integrated candidate build/package gate.

## Finite legacy migration and compatibility gaps

`discovery-compatibility-inventory.json` contains file-level static inventory. Root `.test.ts` files contain **147 Cortex constructors**; the earlier **156** count includes non-test helpers as well. Twenty test files contain embedding fixture patterns, and 31 have explicit or conditional skip patterns. This is a search inventory, not an assertion that all patterns are broken.

The smallest safe shared migration starts with an actual SDK fixture factory next to `tests/helpers/runtime-fixtures.ts`, plus trusted pre-provisioned per-suite identity/scope manifests consumed by `tests/helpers/tenancy.ts` and `tests/helpers/isolation.ts`. It must attach `fetchAuthToken`, use verified fixture metadata user/principal IDs, and seed only finite explicit tenant/space/agent grants through the privileged operator. A single broad token attached to all147 constructors cannot preserve multi-user/multi-space test guarantees. Constructor-only unit cases should be distinguished from live operations. Pure AuthContext metadata must remain metadata, never provisioning.

Apply that factory first to `tests/tenant-isolation.test.ts`, `tests/auth-context-injection.test.ts`, `tests/e2e/auth-integration.test.ts`, and the five CLI `tests/e2e/*-workflow.test.ts` files. Each currently uses caller-generated tenant/user/space/agent labels without a verified identity or trusted scope. API actor labels must match the provisioned identity; register/participant metadata cannot create grants. Existing random multi-scope tests require explicit fixture allocation, not remapping their different scopes into one space. Cross-tenant/unauthorized reads denied by the current contract return `FORBIDDEN`; old success/null assertions must remain disclosed compatibility changes and retain equivalent authorization-strength outcomes.

`tests/vector.test.ts`, `tests/memory-core.test.ts` and the other embedding-pattern files need qualified actual remember/recall/profile witnesses for positive semantic retrieval. Arbitrary mock1536 arrays and preserved-coordinate export expectations are unsupported under the clean-slate provenance contract. Current negative coverage should retain `PROFILE_NOT_READY` assertions; positive retrieval must prove actual matching profile/source/chunk lineage. Caller-produced conversation/fact history or direct app extraction loops are not a substitute for canonical locked transcript/backend ingestion. Global purges in `tests/helpers/cleanup.ts` and swallowed timeout/delete failures in CLI `tests/setup.ts` cannot certify cleanup; migrate to exact owned lifecycle outcomes and preserve unsupported physical deletion limits.

**CLI product conflicts, not edited:** `packages/cortex-cli/src/utils/client.ts` constructs a URL-only Cortex client and caches only by URL, without host JWT/grant session separation. `packages/cortex-cli/src/commands/db.ts` calls now-internal `admin:getAllCounts`/`admin:clearTable` through that public client, has incompatible counts shape and catches maintenance failures. `packages/cortex-cli/src/types.ts`/configuration/auth transport would need a coherent supported signed-JWT/operator contract before actual CLI command acceptance. Merely giving E2E SDK fixtures JWTs would not fix these command paths. Mocked CLI commands do not establish actual administrative compatibility. These files require expanded product scope from Root before edits.

## Native activation

`native-activation-plan.json` gives exact new selectors, issuer/audience, three-role grant DTOs, default profile, operator endpoints, command ordering, cleanup and exclusions. Native must allocate **two new cloud-dev targets in team325340**, distinct from each other and all historical targets. Project3174742/formal-husky-914 is retained and must never be purged; retired3176298/tidy-rooster-771 is not a CI target. Existing four production-valued secret names stay untouched.

Current compiled policy selection is `cortex-gateway-agent-defaults-2026-10-08` revision9; `runtimeModelPolicy:installDeploymentPolicy` enforces compiled reviewed-actual provenance and expiration. The earliest retained proof expires **2026-10-09T08:50:12.383Z**. Installation/paid cases must stop if expired; fresh actual qualification belongs to the product/native owner, with no timestamp extension or synthetic promotion. Empty production registries do not qualify anything. Confirm actual Convex Gateway access/eligibility for extraction, conflict resolution when needed, per-chunk embedding and query embedding. The positive suite requires exact `cortex-text-small-1536-v1` / `openai/text-embedding-3-small` /1536 / `text-nfc-lf-v1` / `codepoint-1600-overlap-200-v1` / `by_default_embedding_v1`.

No live result is implied by source tests or this plan. JWTs last1hour and grants6hours; fresh per-attempt scope IDs prevent reuse of retired scopes. CI retirement preserves tombstones/history. Native final ephemeral-target deletion must prove actual cleanup200/404 after owned work closes if physical disposal is required.

## Review handoff

Source writes are closed at the digest in `source-check-receipt.json`. Ready for the existing non-author coherent Task16 review; no new preparation/receipt judge requested. Goal denominators/status percentages remain untouched. The same agent is available for a later non-author Task15 source/actual review because no Task15 product source was authored here.
