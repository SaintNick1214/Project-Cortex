# Task03A review fix history

## Cycle1 finding

Independent review returned NEEDS FIXES,3.8/5. The frozen inventory's generic
builder/module heuristic incorrectly treated all eight internal runtimeAuth entries
as tenant data writes with generic owner/current-background-grant checks. The
authority implementation and55 helper outcomes/typechecks/lint passed independent
review; no helper implementation change was requested.

## Bounded cycle2 correction

- `authorize`: explicit `requirement.capability`; inherited Convex-verified exact
  issuer/subject -> trusted control records and optional canonical resource checks.
- `recheck`: explicit `requirement.capability`; trusted persisted reference with exact
  principal/membership/grant IDs/versions, tenant/space epochs and optional space
  equality including absence; sessionless currentness checks at sensitive boundaries.
- `provision`, `revokeGrant`, `revokeMembership`, `deletePrincipal`, `deleteScope`,
  `tombstoneResource`: explicit trusted deployment-operator internal invocation and
  control-record targets. Public JWT admin, tenant write, resource-owner claims and
  the target's current background grant do not authorize these lifecycle controls.
  Target state may already be revoked/deleted; each handler's own creation/lifecycle/
  idempotence rules still apply.
- Both retained generator copies updated identically; corrected JSON/Markdown
  regenerated. No non-auth path policy changed.
- Added16 outcome assertions that run each retained generator, then inspect its
  actual generated metadata for every auth registration. Test outputs use isolated
  temporary work directories and preserve the frozen QA inventory.

## Observed checks

All affected checks PASS: work/reproduction inventory generation, strict root
typecheck including the new test, affected runner/test ESLint with zero warnings,
and1 suite/16 inventory-policy tests with zero skipped. npm12.2.0 was invoked offline.
Raw command/args/cwd/sentinel environment/exit/time/stdout/stderr receipts are in
`checks/cycle2-inventory-policy-fix/`.

`preserved-boundaries.json` verifies counts and backend source hashes unchanged,
non-auth classifications unchanged, and identical retained runners. Existing55
authority outcome tests and backend type/lint receipts remain valid. No helper,
schema, shared contract, endpoint, generated API, manifest or host config changed;
no deployment/live test/staging/commit performed. Task03B/03C remain separate gates.

## Cycle2 findings and final cycle3 correction

Fresh cycle2 verdict NEEDS FIXES,3.4/5 is retained in `qa/task03a-review-2.md`.
The eight auth policies and helper implementation passed; four inventory/test
portability findings remained. Final bounded cycle3 addresses all four:

1. Internal read helpers explicitly require read, including `facts:fetchFactsByIds`,
   `memories:fetchMemoriesByIds`, `memories:keywordSearchMemories`.
2. Five admin operations plus13 purges are explicitly deployment-operator maintenance,
   retaining internalize. Their capability/scope/resource lookup/ownership/background
   rules require no public JWT admin or target runtime admin/write/tool/storage/current
   background grant. Targets can already be revoked/deleted; lifecycle/tombstone and
   reference-aware cleanup remain mandatory operator maintenance requirements.
3. The active unit test depends only on two retained physical QA generators and
   creates its own independent OS temporary AST fixtures. The generator executes
   physically from the repository for TypeScript resolution, with child cwd set to
   each fixture. Child work parent and runner are asserted absent before/after.
   No shared work directory was moved or disrupted to prove this isolation.
4. Active assertions inspect maintained fixture policies, with no current production
   sources/counts/hash snapshot comparison. Drift tests append source bytes and add
   one query, then verify existing policies survive. Exact historical source/count
   qualification stays solely in the explicit QA runner/evidence.

The21 intentional non-auth changes are exactly:

- Three internal readers listed above.
- `admin:listTable`, `admin:deleteRecord`, `admin:clearTable`, `admin:countTable`,
  `admin:getAllCounts`.
- `agents:purgeAll`, `artifacts:purgeAll`, `attachments:purgeAll`, `contexts:purgeAll`,
  `conversations:purgeAll`, `facts:purgeAll`, `graphSync:purgeAll`, `immutable:purgeAll`,
  `memories:purgeAll`, `memorySpaces:purgeAll`, `mutable:purgeAll`,
  `governance:purgeAllPolicies`, `governance:purgeAllEnforcement`.

All64 policy/drift assertions passed, plus affected strict root test typecheck and
ESLint with zero warnings; zero skipped. Both retained generators reproduce the
corrected current JSON/Markdown. Raw command/args/cwd/environment/exits/logs and exact
path/field diffs are in `checks/cycle3-inventory-portability-fix/`. Historical
qualification verifies unchanged counts/source hashes/auth policies and identical
retained generators. The cycle2 catalog is preserved under `history/cycle2/`, and
cycle1/2 raw receipts are unchanged. Original55 helper outcomes remained valid at
this pre-helper stage; the essential correction below supersedes current coverage.

Pre-helper cycle3 CLI reproduction ran directly from retained files:

```sh
node _goals/convex-backend-runtime-2026-10-02/qa/task03a/cycle3-checks.mjs
node _goals/convex-backend-runtime-2026-10-02/qa/task03a/inventory.mjs /tmp/cortex-inventory-review
```

No authority/helper/schema/verified contract or endpoint source changed; no codegen,
manifest change, deployment/live test, staging or commit occurred. The coordinator
will obtain the final fresh judgment; passing checks do not substitute for that verdict.

## Essential grant-generation correction before cycle3's final verdict

The still-active fresh judge found a genuine helper defect before issuing a final
verdict: capability/ownership candidate pruning hid corrupt duplicate same-scope
grants, and stored-reference rechecks did not enumerate duplicates added later.
This is an essential correction within the current third review cycle, not a new
completed-verdict loop.

Relevant trusted raw `(principalId,membershipId,tenantId,memorySpaceId)` groups now
enforce one unrevoked/undeleted generation before capability/ownership/currentness
pruning. Expiry and malformed/stale state cannot repair duplicate generations;
operator replacement revokes old generations first. A single expired grant still
denies. Revoked/deleted generations are excluded. Exact pinned references enumerate
their own raw group, detect new duplicates and require group membership. Independent
spaces/tenants remain independent; raw tenant-wide undefined-space grants can still
narrow at admission without being confused with a different space-specific grant.
No capabilities are combined or implied.

Fourteen new positive/error regressions bring authority coverage to69 outcomes.
The complete current run passed3 suites/133 tests (69 authority +64 portable policy),
zero skipped, plus both strict backend/root configs and affected ESLint with zero
warnings. Exact command/args/cwd/environment/exits/raw logs are in
`checks/cycle3-grant-generation-fix/`. Earlier55-outcome receipts remain historical
and do not certify this changed helper.

Before fixing source, `history/cycle3-pre-grant-invariant/` preserved the current
catalog JSON/Markdown, qualified21-path inventory diff and helper source bytes.
Current historical qualification separates source locations from policy semantics:
only runtimeAuth.ts has an intentional hash change; the other21 backend hashes and
all counts remain unchanged. Eight auth registration locations shift by28 lines;
all endpoint semantic policies are unchanged from the pre-helper cycle3 catalog.
The earlier21 non-auth policy changes remain intact relative to cycle2.

Current full reproduction uses retained files without ignored work dependencies:

```sh
node _goals/convex-backend-runtime-2026-10-02/qa/task03a/cycle3-grant-generation-checks.mjs
```

No other backend/schema/verified source, generated API, manifest, host configuration,
deployment/live mutation, staging or commit changed. The current judge will rerun
independent probes and checks before the cycle's single final verdict. A failing
final verdict remains an incomplete gate; successful local checks cannot override it.
