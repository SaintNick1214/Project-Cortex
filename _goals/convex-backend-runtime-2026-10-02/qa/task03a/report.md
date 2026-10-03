# Task Completion Report

## Status: COMPLETE — bounded substep03A only

Task03 remains incomplete until03B endpoint closure and03C client/negative cases
pass their own independent review. This report freezes contracts and source inventory;
it does not claim existing endpoints are protected or private byte delivery implemented.

## Changes Made

- `convex-dev/runtimeAuth.ts`: exact verified issuer/subject -> principal/membership/
  grant resolution; independent read/write/run/admin/tool/storage capabilities;
  explicit own/space/tenant resource access; exact pinned background references,
  scope epochs, revocation/expiry/deletion/tombstone fences; eight internal-only
  operator/action authorization registrations.
- `convex-dev/runtimeAuthSchema.ts`: five additive trusted control tables and shared
  validators. `convex-dev/schema.ts` has only an import and additive table spread.
- `src/auth/verified.ts`: browser-safe frozen references/types, with no SDK entrypoint
  export or change to existing caller-metadata AuthContext semantics.
- `tests/unit/runtimeAuth/`: outcome tests for real helpers/internal handler logic,
  using in-memory trusted table adapters and registered visibility assertions.
- This QA folder: all-path AST inventory, frozen contracts, bounded03B handoff and
  exact raw successful check receipts. No generated binding was handwritten.

## Requirements Checklist

- [x] Read repository runtime/profile/role/code-quality instructions, approved goal,
  decisions, architecture§9, schema/auth exemplars and Task01 frozen contracts.
- [x] Completeness-verified configured-directory inventory:240 existing public paths,
  3 existing internal helpers, 8 new internal auth registrations; all251 AST builder
  calls resolved to exports across22 source modules. Zero unresolved registration/
  re-export/HTTP routes. Exact source SHA256 hashes freeze the inspected source.
- [x] Every path has required disposition/capability/scope/canonical lookup/ownership/
  background checks plus applicable transcript/share/storage contracts.198 public
  paths retain guarded modern APIs;42 unsafe global/worker/raw-storage paths internalize.
- [x] Verified JWT pair maps only to trusted control records; claims/caller IDs/
  metadata/user registration never provision membership or privilege. Provisioning,
  revocation and deletion registrations are internal-only, not public admin impersonation.
- [x] Explicit capability and same-tenant cross-principal contracts; omitted selectors
  derive one eligible trusted scope or deny ambiguity. Missing row tenant/owner denies.
- [x] Persist exact grant/principal/membership IDs and versions plus scope epochs;
  recheck current authority and tombstones at reads/effects/commits. A tenant-wide
  background reference cannot silently acquire a concrete space after admission.
- [x] Grant replacements create new immutable generation; old grant references remain
  revoked. Membership/principal/scope and resource deletion fences cannot be cleared
  by provisioning. Ordinary observer logout is distinct from explicit revocation.
- [x] Freeze same-store admin transcript unlock/revision/invalidation, redacted read-only
  sharing, owned storage admission/private delivery, trusted tool/service/callback
  authentication contracts, without claiming their later implementations complete.
- [x] Keep host auth.config/HTTP routing, endpoint modules, generated APIs, SDK entrypoint,
  manifests/provider/CLI/demo and archived Python unchanged within03A ownership.
- [x] Record actual mock-only test/check outcomes and scoped limits. No deploy, live
  mutation, inference, external media storage, staging or commit performed by this agent.

## Files Modified

| File/group | Action | Notes |
|---|---|---|
| `convex-dev/runtimeAuth.ts` | Created | Pure/adapted authority and internal operator registrations |
| `convex-dev/runtimeAuthSchema.ts` | Created | Additive table/validator fragment for Task06 |
| `convex-dev/schema.ts` | Modified | Exactly two additive auth-fragment lines |
| `src/auth/verified.ts` | Created | Shared contract; no public entrypoint export yet |
| `tests/unit/runtimeAuth/authority.test.ts` | Created | Identity/scope/capability/background/currentness outcomes |
| `tests/unit/runtimeAuth/provisioning.test.ts` | Created | Internal visibility/bootstrap/revocation/deletion outcomes |
| `tests/unit/runtimeAuth/inventory.test.ts` | Created in cycle2; corrected in cycle3 |64 portable policy/drift outcomes against two retained generators and independent AST fixtures |
| `qa/task03a/` | Created | Frozen inventory/contracts/handoff/report/raw receipts |
| `work/backend-runtime/task03a/` | Created | AST/check runners and scoped strict configurations |

## Verification

All current selected scoped checks passed. The essential helper correction's final
raw command/cwd/args/environment/exit/time/stdout/stderr receipts are in
`checks/cycle3-grant-generation-fix/commands.json` and adjoining logs. Original
`checks/commands.json` and cycle2/pre-helper-cycle3 receipts remain historical.

| Check | Observed result |
|---|---|
| Exact npm invocation | npm12.2.0 PASS, offline cached invocation; no package install by03A |
| Node runtime | v24.19.0 PASS |
| AST registration/export completeness |251 calls/251 exports; zero unresolved; PASS |
| Strict backend touched-file typecheck | PASS exit0 |
| Strict root contract/test touched-file typecheck | PASS exit0 |
| Scoped ESLint including additive schema | PASS exit0, zero warnings/errors |
| Current authority outcome unit tests (helper corrected in cycle3) |2 suites/69 tests passed in full current run; zero skipped; PASS exit0 |
| Inventory policy unit tests (review cycle3) |1 suite/64 portable fixture outcomes passed across both retained actual runners; zero skipped; PASS exit0 |
| Full current authority + policy run |3 suites/133 tests passed in one invocation; zero skipped; PASS exit0 |
| Git diff whitespace check | PASS exit0 |

Jest used `CONVEX_URL=http://127.0.0.1:1` and `CONVEX_TEST_MODE=local` exclusively as
the repository loader's sentinel for mock-only execution. No Convex browser client,
HTTP/backend request, paid model or actual service mutation is constructed by these
tests. The timing reporter counts parameterized test groups differently; the
original historical Jest result was55 individual authority tests; those receipts do
not certify the corrected helper. The current full run passes69 authority plus64
portable policy tests. Cycle2's16 earlier policy tests remain historical evidence.
Convex transactions/actual public
invocation/subscription/storage bytes/callbacks are not certified by these unit tests.
Full root/backend/lint/core or service/UI gates were not selected for this bounded
foundation; the selected strict checks compile the complete newly imported helpers,
auth schema and shared contracts, not a declaration-only stub.

## Notes for Reviewer

Use `contracts.md`, `public-path-inventory.json` and `task03b-handoff.md` as the
authoritative frozen inputs for03B.03B1 owns83 public paths (74 guard,9 internalize)
plus3 existing internal helpers.03B2 owns157 public paths (124 guard,33 internalize).
The inventory flags actual index usage but handler-local flags do not imply that a
shared helper is safe; review shared helpers and every row touched. A guard that
verifies another tenant's same-ID row before an unchanged unscoped `first()` handler
is explicitly prohibited.

Current inventory/policy reproduction needs no ignored work directory. From repository
root run `node _goals/convex-backend-runtime-2026-10-02/qa/task03a/cycle3-grant-generation-checks.mjs`.
The prior `cycle3-checks.mjs` is historical and requires replaying its historical
source state; it does not qualify current sources. It remains
historical; it does not certify current helper source.
For a new catalog alone use retained
`node _goals/convex-backend-runtime-2026-10-02/qa/task03a/inventory.mjs <output-directory>`.
Explicit historical QA compares the preserved cycle2 source hashes/counts; active
unit tests only inspect independent temporary AST fixtures, allowing production source
and endpoint-count evolution. Preserve frozen catalogs before03B production changes.
`reproduction/` also retains original cycle1/2 runners/configs with their historical
relative paths for replay after copying those older files back to their recorded
work directory. That historical replay is separate from current active policy tests.
The repository ignores untracked goal/work evidence by default; the coordinator
must intentionally force-add requested QA evidence when committing. This agent has
not staged or committed any file.

Initial test-harness strict typing exposed TypeScript6's inferred rootDir and Convex's
published types stripping its runtime `_handler` test hook. The scoped config now
sets repository rootDir, and the mock handler adapter documents its bounded cast.
Final observed strict checks pass without production escape hatches or modified
assertions. Generated API registration/codegen is deferred to the coordinator's
authorized next substep; the schema-derived DataModel already includes these tables.

## Review cycle2 inventory correction

Fresh cycle1 review returned NEEDS FIXES (3.8/5) for the eight internal auth inventory
entries inheriting generic mutation data policy. The helper implementation and its55
outcomes/typechecks/lint passed independent review. This correction changes only the
inventory policy, policy-regression tests and affected evidence.

`authorize` and `recheck` now require `requirement.capability`, with distinct inherited
Convex-verified issuer/subject and exact persisted-reference boundaries. Recheck
metadata explicitly records pinned principal/membership/grant versions, tenant/space
epochs and optional space equality including absence. The six operator controls now
require trusted deployment-operator internal invocation; tenant write, public JWT
admin, resource ownership or the target's current background grant cannot authorize
them. A revoked/deleted target therefore does not invalidate operator lifecycle
invocation; each handler still applies its target lifecycle/idempotence rules.

Both retained runners regenerate the corrected JSON/Markdown. Sixteen outcome
assertions invoke both actual generators into isolated temporary work directories,
then verify every auth path's capability/scope/ownership/background metadata.
Cycle2 strict root typecheck, affected runner/test ESLint and all16 policy outcomes
passed with npm12.2.0. Raw receipts are in
`checks/cycle2-inventory-policy-fix/commands.json`; `preserved-boundaries.json`
records unchanged251/240 endpoint totals, all source hashes, all non-auth policies
and byte-identical retained runners. Original passing helper/backend receipts remain
valid because no backend/shared authority source changed. `fix-history.md` records
the bounded review correction. No deployment, live tests, staging or commits occurred.

## Bounded cycle3 inventory correction before the essential helper probe

Fresh cycle2 review returned NEEDS FIXES (3.4/5). All findings were addressed without
changing authority helpers/schema/contracts or production endpoint source:

- Three existing internal query helpers now require `read`: `facts:fetchFactsByIds`,
  `memories:fetchMemoriesByIds`, `memories:keywordSearchMemories`.
- Five arbitrary-table admin paths and13 deployment-wide purge paths retain
  `internalize` and explicitly require trusted deployment-operator internal invocation,
  operator scope/target lookup/ownership and lifecycle/maintenance rules. No target
  tenant/current background grant or runtime admin/write/tool/storage capability
  authorizes deployment maintenance. Exact paths/changed fields are recorded in
  `checks/cycle3-inventory-portability-fix/historical-qualification.json`.
- Active policy tests use retained physical `inventory.mjs` and
  `reproduction/inventory.mjs`, create independent temporary convex.json/AST fixtures,
  and invoke those generators with each fixture as child cwd. Each child has no work
  parent/runner before or after. Tests require no ignored scratch tree and never read
  current production source bytes or frozen production counts/hashes. Explicit drift
  cases append source newlines and add a query while preserving existing policies.

Both retained generators, affected strict root test typecheck, runner/test ESLint and
64 fixture policy outcomes passed using npm12.2.0, with zero warnings/skips. Exact raw
receipts are in `checks/cycle3-inventory-portability-fix/commands.json`. Historical
qualification verifies exactly21 intentional non-auth path changes, unchanged251
registration/240 public counts, all22 source hashes and all eight cycle2 auth policies.
Cycle1/2 receipts remain intact; the previous cycle2 JSON/Markdown is preserved in
`history/cycle2/`. Original55 helper outcomes/backend type/lint evidence stayed valid
at this pre-helper stage; the essential amendment below supersedes their coverage
of the current helper source.
Fresh final independent review remains the coordinator's next gate; whole03 remains
pending03B/03C. No staging, commits, codegen, deployment or live tests occurred.

## Essential helper correction within the still-pending cycle3 review

The final judge found capability/ownership pruning could hide a second active grant
in the same trusted raw membership/scope group, and pinned rechecks only fetched
their exact grant. No final cycle3 verdict had been issued. This essential correction
remains inside that review cycle and does not open a completed-verdict retry loop.

`resolveAuthority` now checks relevant trusted raw grant groups before capability,
ownership, expiry, version/epoch or tombstone pruning. `resolveAuthorityReference`
enumerates the pinned grant's exact raw group, enforces the same uniqueness invariant
and requires the pinned grant to remain present. Different capabilities/access do
not hide corruption. Expired-but-unrevoked generations still count until explicitly
revoked; a lone expired grant cannot authorize work. Revoked/deleted generations do
not count. Distinct raw scopes remain independent, including a tenant-wide grant
narrowed at admission; candidate ambiguity and explicit capabilities remain enforced.
The frozen contract now defines these distinctions.

Fourteen additional exact positive/error cases cover read/write and own/space
duplicates, foreign owners, duplicates added after admission, expired/malformed/
stale generations, revoked/deleted exclusions, independent registered spaces/tenants,
raw tenant-wide narrowing and missing pinned-group membership. All current checks
were rerun: both strict backend/root configs, affected ESLint and the full3-suite/
133-test authority + portable policy run pass with zero warnings/skips. Original55
outcome receipts no longer certify this changed helper.

Current catalog qualification records **one intentional backend hash change**:
`convex-dev/runtimeAuth.ts`; the other21 backend hashes and counts are unchanged.
All semantic endpoint policy fields (including eight auth policies) equal the
pre-helper cycle3 catalog. Eight runtimeAuth registration line numbers shifted by28
and are recorded separately, rather than claiming full endpoint-object byte equality.
The21 earlier non-auth inventory-policy corrections remain preserved and unchanged.
Exact hashes/location shifts are in
`checks/cycle3-grant-generation-fix/historical-qualification.json`.

Before this source fix, the cycle3 JSON/Markdown, qualified policy diff and source
text were preserved under `history/cycle3-pre-grant-invariant/`. Prior receipts were
not rewritten. No schema/shared verified contract, other backend endpoint, host config,
manifest, generated binding, staging/commit/deploy/live mutation changed. The judge
will independently recheck final source and receipts before its single final cycle3
verdict; passing local checks do not substitute for that gate.
