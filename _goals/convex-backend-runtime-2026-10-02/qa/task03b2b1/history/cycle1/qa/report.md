# Task Completion Report

## Status: COMPLETE — bounded 46-registration implementation; fresh judgment PENDING

The isolated Task03B2B1 slice closes the exact46 selected native registrations:
agents10, memorySpaces14 and contexts22. It contains43 guarded public registrations
and3 trusted operator internal purges. Execution checks pass; parent inspection and
fresh independent judgment must precede integration. This is not whole03B2B52,
wholeTask03, wholeGoal or live-runtime certification.

The checkout remains pinned at `a2c9827783e9dd49b9811a2899ba4acbeadc21cd`.
`source-freeze.json` records the FINAL immutable source/test/dependency hashes.
No further source or test writes occur after this freeze.

## Changes Made

- `convex-dev/runtimeRegistryAuth.ts`: independent frozen03A authorization adapter,
  scoped canonical owner selection, separately retained capabilities, whole-transaction
  witnesses, locally computed insert/edit/retirement expectations and final fences.
  Official Convex1.46 value validation/encoding preserves native config/data semantics.
- `convex-dev/agents.ts`: registry READ/WRITE and independent ADMIN, descriptive
  labels/config, private READ receipts, complete bulk preflight, retained retirement
  fences and internal operator purge. computeStats remains byte-frozen and pending.
- `convex-dev/memorySpaces.ts`: trusted existing-space registration/participant edits,
  canonical ownership/current grants, descriptive metadata, safe private receipts and
  durable space/resource/epoch barriers. deleteSpace explicitly reports derived cascade
  pending. getStats remains byte-frozen and pending.
- `convex-dev/contexts.ts`: exact-owner graph checks across independently granted spaces,
  strict bounded topology, whole-graph mutation preflight, actual verified revision
  writers, orphan/cascade repair and retained retired/source witnesses. Conversation
  references fail closed without raw hydration until canonical ownership is available.
- `convex-dev/schema.ts`:13 additive lines only in agents/memorySpaces/contexts:
  optional trusted owner/tombstone fields, optional agent space, optional current context
  writer and scoped indexes. `schema-additive.patch` is the exact parent integration diff.
- `tests/unit/runtimeRegistryAuth/`: independent native registered-handler and
  transaction-aware outcome fixtures. Inventory reproduction uses mkdtemp/finally cleanup.

## Requirements Checklist

- [x] Exact frozen46 native paths/visibility and validators — registered.test.ts;
  catalog/selected-path-inventory.json has43 public,3 internal,2 excluded stats,
 48 total module registrations and zero unresolved paths.
- [x] Every selected public path missing auth, forged verified subject and forged
  tenant denies; expected valid-authority outcomes are asserted for all43. The ownerless
  getByConversation seam's correct outcome is explicit denial before conversation reads.
- [x] Trusted tenant/actual space/owner precede ordinary hydration/limit; omitted
  selectors derive exactly one eligible trusted scope; descriptive labels never grant
  authority. Native descriptive/config values remain available.
- [x] Independent READ/WRITE/ADMIN references, first canonical witnesses and locally
  computed expected writes survive later checks. Initially unavailable READ permits a
  safe receipt; admitted late READ loss at actual insert/patch attempts denies/rolls back.
- [x] Bulk duplicate/collision/owner/lifecycle/native-shape/version/history/graph
  preflight precedes first effects. Late database/control/row/binary/int64 changes deny
  and roll back. Retirement keeps exact canonical/tombstone witnesses through the end.
- [x] Context links retain exact topology/version/owner/lifecycle and actual-space
  grants; repeated canonical admissions cannot adopt a later snapshot. Cross-space
  success, invalid links, peer revocation and earlier source rebind controls are present.
- [x] Actual verified revision writers are persisted; archived revisions retain their
  own prior writer. Missing prior actor remains unknown. Participants/access metadata
  never provision trusted control records.
- [x] Space deletion retains metadata, resource tombstone, scope epoch/deleted fence and
  all controls. Space and tenant-wide grants cannot bootstrap/revive the retired space.
  No raw derived-source cascade occurs; pendingTasks08/12/15 are returned explicitly.
- [x] Native Convex v.any values round-trip through create/edit/get and scoped
  list/search/history/export, including int64, bytes, special floats and signed zero.
  Native-invalid classes/cycles/int64 overflow deny. Earlier JSON-only Infinity-denial
  evidence is retained and explicitly specification-corrected; it is not a restriction.
- [x] Auth/generated/SDK/build/workflow/A2A sources remain untouched; schema outside
  the3 owned blocks remains byte-identical. Stats exports remain byte-identical and
  unexecuted by selected tests. preservation.json records these checks.

## Files Modified

| File | Action | Notes |
|---|---|---|
| convex-dev/agents.ts | Modified | Selected registry9 public +1 internal |
| convex-dev/memorySpaces.ts | Modified | Selected registry13 public +1 internal |
| convex-dev/contexts.ts | Modified | Selected graph21 public +1 internal |
| convex-dev/runtimeRegistryAuth.ts | Created | Independent frozen03A boundary |
| convex-dev/schema.ts | Modified | Exact additive13-line owned3-block patch |
| tests/unit/runtimeRegistryAuth/*.ts | Created |4 files;3 discovered suites |
| qa/task03b2b1/** | Created | Contracts, mapping, exact catalog, raw receipts, preserved failures, schema patch, dependency hashes and FINAL freeze |

## Verification

- [x] Actual Node `v24.19.0`, npm `12.2.0`, Convex `1.46.0` matching pinned lock.
- [x] `npm exec -- tsc --project convex-dev/tsconfig.json --noEmit`: PASS with the
  unchanged actual ES2021 backend config.
- [x] Scoped ES2021 tsc and ESLint `--max-warnings=0`: PASS.
- [x] Jest actual discovery:3 suites. Registered-handler outcomes:337 tests PASS,
 0 skipped,0 todo. `checks/tests-final.json` and raw stdout/stderr contain the results.
- [x] Exact AST catalog regeneration and `git diff --check`: PASS.
- [x] `finalize.py`: preservation/hash/count/schema/root-classification checks PASS.
- [ ] Whole-root compilation: intentionally reported as integration-pending, not PASS.
  Root tsc has28 diagnostics; lint-ts has26. The exact archived isolated base has1
  governance integration diagnostic in each gate, fixed in accepted `c0c40423` and
  inherited by observed accepted main `4fb3482c5e06fcab12ab8513b242a066ef761f2f`.
  It is not a global/current-main preexisting failure. The introduced diagnostics are
 25 agent SDK private-row receipt assumptions plus2 root cleanup public-purge references.
  Agent SDK/cleanup bytes on observed accepted main still match the isolated base;
  Task03C2/09 owns those adaptations. root-diagnostic-classification.json contains every
  diagnostic and exact baseline/current-main comparisons.

Commands use the private npm12 cache and are recorded with raw UTC/cwd/arguments/exits
in checks/commands.json. Historical lint, structuredClone shape, native-codec/null and
required-metadata specification failures remain in checks/history-* with successful
corrected reruns; no tests were skipped or assertions weakened to hide an implementation
failure. The orphan control now requires native field absence after undefined patch
deletion. Official codec dependencies and hashes are in codec-dependency.json.

## Notes for Reviewer

Assess the documented exact authorized-key Boolean collision/uniqueness exception:
Convex1.46 has no indexed existence projection, so these fences necessarily fetch a
server document and immediately discard its payload. No conflicting payload is used
for authority, canonical selection, processing, logs or delivery. There is no claim
of zero foreign hydration for this narrow exception. Ordinary scoped owner selection
and every other retained authority/effect assertion remain required.

Current conversation schema cannot prove a trusted owner. The independent typed seam
therefore denies before any raw transcript hydration; no canonical conversation,
message-anchor or private projection success is claimed. Durable derived cascade
08/12/15, canonical conversation/anchor03T/05, stats2, A2A4, MF/source bridge,
SDK/cleanup03C2/09 and full03/goal remain PENDING. No live/paid/Docker/deploy/codegen/
build/package/stage/commit/push action occurred in this checkout.
