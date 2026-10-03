# Task Completion Report

## Status: COMPLETE — bounded SECOND repair candidate; fresh SECOND judgment PENDING

The isolated Task03B2B1 slice closes the exact46 selected native registrations:
agents10, memorySpaces14 and contexts22. It contains43 guarded public registrations
and3 trusted operator internal purges. The first judgment was FINAL REJECT3.0 and remains
immutable in history/cycle1. Second-cycle execution checks pass; parent inspection and
fresh SECOND independent judgment must precede integration. This is not whole03B2B52,
wholeTask03, wholeGoal or live-runtime certification.

The checkout remains pinned at `a2c9827783e9dd49b9811a2899ba4acbeadc21cd`.
`source-freeze.json` records the FINAL immutable source/test/dependency hashes.
No further source or test writes occur after this freeze.

## Changes Made

- `convex-dev/runtimeRegistryAuth.ts`: independent frozen03A authorization adapter,
  scoped canonical owner selection, separately retained capabilities, whole-transaction
  witnesses, locally computed insert/edit/retirement expectations and final fences.
  Official Convex1.46 value validation/encoding preserves native config/data semantics.
  Every selected native handler sanitizes known native ambiguity and separates unexpected
  private backend failures from permission denials. Real write attempts remain observable
  through accurate failed/rolled_back outcomes, with no raw diagnostic/cause disclosure.
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
  references return typed CAPABILITY_NOT_READY under valid/current READ without raw
  hydration until canonical ownership is available. Resulting graph size is checked
  before child insert:99→100 succeeds/readable;100→101 has zero write attempts.
- `convex-dev/schema.ts`:13 additive lines only in agents/memorySpaces/contexts, byte-frozen
  from cycle1 and unchanged throughout cycle2:
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
  getByConversation seam's staged outcome is CAPABILITY_NOT_READY before conversation
  reads; missing/invalid/revoked authority remains denied accurately.
- [x] Trusted tenant/actual space/owner precede ordinary hydration/limit; omitted
  selectors derive exactly one eligible trusted scope; descriptive labels never grant
  authority. Native descriptive/config values remain available.
- [x] Independent READ/WRITE/ADMIN references, first canonical witnesses and locally
  computed expected writes survive later checks. Initially unavailable READ permits a
  safe receipt; admitted late READ loss at actual insert/patch attempts denies/rolls back.
- [x] Stored IDs from status/filter/cascade/orphan results require independent READ for
  every disclosed resource before effects. Incomplete initial READ returns a count-only
  receipt. Admitted partial READ remains retained even for count-only results. Late READ
  revocation or owner-eligibility narrowing denies and rolls back after retirement too.
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
| tests/unit/runtimeRegistryAuth/*.ts | Created |5 files;4 discovered suites |
| qa/task03b2b1/** | Created | Contracts, mapping, exact catalog, raw receipts, preserved failures, schema patch, dependency hashes and FINAL freeze |

## Verification

- [x] Actual Node `v24.19.0`, npm `12.2.0`, Convex `1.46.0` matching pinned lock.
- [x] `npm exec -- tsc --project convex-dev/tsconfig.json --noEmit`: PASS with the
  unchanged actual ES2021 backend config.
- [x] Scoped ES2021 tsc and ESLint `--max-warnings=0`: PASS.
- [x] Jest actual discovery:4 suites. Registered-handler outcomes:480 tests PASS
  (exact original337 per-suite ordered outcomes/multiplicity plus143 focused repair outcomes),
 0 skipped,0 todo. `checks/tests-final.json` and raw stdout/stderr contain the results.
- [x] Original independent258 authority probes and8 native probes rerun byte-exact:
  PASS, no private stored/document ID leaks. Original graph exploit script remains
  unchanged and exits1 on the corrected INVALID_INPUT denial. The asserted boundary
  runner passes all4 READ/WRITE-only99→100 and100→101 cases. Raw commands/UTC/source
  hashes/results remain in cycle2/probe-commands.json and adjacent receipts.
- [x] All450 cycle1 source/QA/judge archive records, manifest hash19bf653d… and
  frozen schema bytes verify unchanged. Parent provenance preserves original2286 judge
  records, including2234 reproducible private compiled caches and52 raw records.
- [x] Exact AST catalog regeneration and `git diff --check`: PASS.
- [x] `finalize.py`: preservation/hash/count/schema/root-classification checks PASS.
- [ ] Whole-root compilation: intentionally reported as integration-pending, not PASS.
  Root tsc has29 diagnostics; lint-ts has27. The exact archived isolated base has1
  governance integration diagnostic in each gate, fixed in accepted `c0c40423` and
  inherited by observed accepted main recorded freshly in root-diagnostic-classification.json.
  It is not a global/current-main preexisting failure. The introduced diagnostics are
 25 cycle1 agent SDK private-row receipt assumptions,1 additional cycle2 SDK assumption
  that unregisterMany always returns agentIds, plus2 cleanup public-purge references.
  The additional TS2322 at src/agents/index.ts:730 is introduced by the required F1
  count-only receipt; it cannot be hidden by disclosing stored IDs, imposing READ on
  authorized WRITE operations, restoring public purges or casting a private receipt.
  Agent SDK/cleanup bytes on observed accepted main still match the isolated base;
  Task03C2/09 owns those adaptations. root-diagnostic-classification.json contains every
  diagnostic and exact baseline/current-main comparisons.

Commands use the private npm12 cache and are recorded with raw UTC/cwd/arguments/exits
in checks/commands.json. Historical lint, structuredClone shape, native-codec/null and
required-metadata specification failures remain in checks/history-* with successful
corrected reruns; no tests were skipped or assertions weakened to hide an implementation
failure. The orphan control now requires native field absence after undefined patch
deletion. Official codec dependencies and hashes are in codec-dependency.json.
Cycle2's first full check passed480 outcomes but exposed two fixture-only TS errors:
the native function narrowing did not survive a closure, and ConvexError's generic
required Value. Those exact failed receipts remain in cycle2/history-first-full-checks;
the narrow fixture typing corrections pass scoped/backend ES2021 and lint. No test
was removed or skipped. The preliminary direct internal-module import TS7016 diagnostic
is recorded in cycle2/repair-notes.md, with no invented raw timestamp.

Two original public-error expectations are narrowly specification-corrected: unavailable
valid-authority conversation capability reports CAPABILITY_NOT_READY; an unexpected
atomic DB failure reports REGISTRY_OPERATION_FAILED/rolled_back rather than its raw
message. Original bytes/history remain immutable. Reached injection and zero-commit
rollback assertions remain required and are strengthened by native private-error probes.

## Notes for Reviewer

Assess the documented exact authorized-key Boolean collision/uniqueness exception:
Convex1.46 has no indexed existence projection, so these fences necessarily fetch a
server document and immediately discard its payload. No conflicting payload is used
for authority, canonical selection, processing, logs or delivery. There is no claim
of zero foreign hydration for this narrow exception. Ordinary scoped owner selection
and every other retained authority/effect assertion remain required.

Current conversation schema cannot prove a trusted owner. The independent typed seam
therefore reports CAPABILITY_NOT_READY after valid/current authority before raw transcript
hydration (invalid authority stays denied); no canonical conversation,
message-anchor or private projection success is claimed. Durable derived cascade
08/12/15, canonical conversation/anchor03T/05, stats2, A2A4, MF/source bridge,
SDK/cleanup03C2/09 and full03/goal remain PENDING. No live/paid/Docker/deploy/codegen/
build/package/stage/commit/push action occurred in this checkout.
