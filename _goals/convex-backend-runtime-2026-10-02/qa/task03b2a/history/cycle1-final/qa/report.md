# Task03B2A bounded completion report

## Status: COMPLETE implementation candidate; fresh independent review/integration pending

The isolated candidate closes exactly41 inventoried metadata paths:immutable12 (11public+1internal), mutable11 (10+1), users8 (8+0), sessions10 (7+3). All36 modern public APIs retain registrations and receive verified generic03A read/write authority. Five inventoried maintenance endpoints are internal. This is bounded offline evidence, not a whole Task03 or goal PASS.

## Changes made

- convex-dev/runtimeMetadataAuth.ts: shared generic metadata scope/owner/key checks, collision-safe source identities, independent READ admission, final joint WRITE/READ control/lifetime barrier, safe receipts and retained deletion fences.
- convex-dev/immutable.ts and mutable.ts: scoped exact lookups/lists/counts/search/history and validated batch/version/functional mutation behavior; public deletion retains fences; purgeAll internalized.
- convex-dev/users.ts: canonical immutable type=user adapters with trusted own metadata binding and explicit cross-principal access; profile data cannot provision runtime authority.
- convex-dev/sessions.ts: unique scoped application sessions, derived owner/user labels, private stored authority references, nonreviving touch/end semantics, internal reference-checked counters and expiry.
- convex-dev/schema.ts: only parent-approved immutable/mutable/session owner/scope/tombstone/reference fields and six composite indexes plus the validator import. No shared MF/governance schema or generated file changes.
- tests/unit/runtimeMetadataAuth/: owned reviewed02B-derived transaction fixture plus registered-handler outcome and exact-registration tests.

## Requirements checklist

- [x] Exact issuer/subject and explicit capabilities; forged labels/selectors/admin-only and absent identity denied.
- [x] Canonical owner and tenant/optional-space database selection before materialization, exact keys, duplicate/conflict denial, omitted selector ambiguity rejection.
- [x] Generic undefined-space tenant metadata and concrete-space granted metadata both work; defaults/selectors documented in contracts.md.
- [x] Immutable own user-profile binding; cross-principal metadata needs explicit space/tenant access; caller-created metadata never control authority.
- [x] Private prior versions/search/count/exists follow the same checks; read-less stores/updates/transactions and bulk operations return safe receipts.
- [x] Independent tenant READ+space WRITE, initially unavailable READ receipt, admitted READ later failure, and WRITE/READ wall-clock expiry during final awaited control lookup tested.
- [x] Full batch preflight and functional validation, foreign later target/invalid operation rejection before writes, later lifecycle failure rollback.
- [x] Retained control and typed row tombstones, no store/set/newversion resurrection, counts/list exclusion, collision-safe source identities.
- [x] Public user deletion affects only its authorized profile; ordinary public purgeVersions preserved; deployment purgeAll internal and control/fence preserving.
- [x] Session unique scoped IDs and trusted labels; application end does not revoke runtime grants; ended/expired touch cannot restore sessions.
- [x] Internal stored-reference maintenance checks every target/read/effect/commit; expired references and malformed pinned targets deny with no partial effects.
- [x] Native installed Convex and import-aware AST independently observe exact41=36+5 with zero unresolved. Reviewed03A inventory/control sources unchanged.
- [x] Scoped strict backend/source/test types, affected-file lint, registered-handler tests and diff checks observed passing. Raw full-root failures recorded separately.
- [ ] Fresh independent judge/integration: parent-owned pending gate.
- [ ] MF linked-source bridge, SDK adaptation, actual managed JWT/subscription/private byte/callback deployment evidence: separately owned downstream gates; not certified here.

## Files modified

| File | Action | Notes |
|---|---|---|
| convex-dev/immutable.ts | Modified |11publicguard/1internal |
| convex-dev/mutable.ts | Modified |10publicguard/1internal |
| convex-dev/users.ts | Modified |8publicguard, no users table |
| convex-dev/sessions.ts | Modified |7publicguard/3internal |
| convex-dev/runtimeMetadataAuth.ts | Created | Only reviewed03A authority dependency |
| convex-dev/schema.ts | Modified | Approved three-table fields/indexes only |
| tests/unit/runtimeMetadataAuth/* | Created | Handler/transaction and registration outcomes |
| qa/task03b2a/* | Created | Contract, source hashes, catalog, exact receipts/logs, report |

## Verification

- [x] Strict affected backend compilation PASS, exit0.
- [x] Strict source/test dependency compilation PASS, exit0.
- [x] Scoped lint including approved schema changes PASS, exit0, zero warnings/errors.
- [x] Actual selected Jest PASS:139/139 tests,2/2 suites,0 skipped/pending; sentinel CONVEX_URL=http://127.0.0.1:1, CONVEX_TEST_MODE=local.
- [x] Import-aware AST and installed native Convex registrations PASS:41registrations=36public+5internal,0 unresolved.
- [x] git diff --check PASS.
- [x] HEAD in-memory baseline comparison PASS:0diagnostics, no checkout mutation.
- [ ] Full-root typecheck FAIL, exit2:exactly5 introduced oldSDK consumer diagnostics (src/sessions/index.ts:421;src/users/index.ts:218-221). Unfiltered log and structured classification retained; no unrelated consumer edits.

Exact argv/cwd/UTC timestamps/exit codes are in check-receipts.json; raw output is in checks/. Candidate backend/schema/test source hashes are in source-hashes.json. AST/Convex validator observations are in catalog/ and framework-registration.json. Assertions target outcome/state and use real installed Convex registrations; they do not claim live managed-service authentication, transaction deployment, private byte delivery or subscription semantics.

## Notes for reviewer

Read contracts.md for exact optional-space defaults, sourceId JSON-array integration identity and initial-vs-admitted READ behavior. Parent must integrate only reviewed subsets and bridge MF keys in a separately judged integration change; this isolated executor never imports or edits pending MF helpers. Preserved untracked node_modules symlink existed before work. No main checkout writes, stage/commit/push, deployment, dependency/generated/SDK/build/pack/provider/CLI changes, model/network calls or subagent delegation occurred. No credentials are retained in QA. All17 top-level tasks remain ongoing.

Source/QA candidate is frozen after freeze.json creation; executor performs no further writes unless parent explicitly starts a bounded revision cycle. Parent owns fresh judgment and integration.
