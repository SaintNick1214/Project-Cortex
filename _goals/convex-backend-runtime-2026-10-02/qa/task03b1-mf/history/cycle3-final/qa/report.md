# Task Completion Report

## Status: third repaired candidate frozen; fresh cycle3 independent judgment pending

Both completed fresh judge cycles remain rejected: cycle1 REJECT3.0/5 and cycle2
FINAL REJECT3.2/5. See ../task03b1-mf-review-1.md and ../task03b1-mf-review-2.md.
The32 cycle1,38 open-cycle2 and44 final-cycle2 records remain byte-identical to the
parent's preservation manifests. No passing local check substitutes for judgment.

Cycle1's five findings and open-cycle2's distinct READ/WRITE delivery findings retain
all their outcome coverage. Final cycle2 additionally confirmed eight source/proof
failures: four memory/fact source tombstone or revision changes during final WRITE
hashing, two historical source tombstone/event changes, and two bulk deletion cases
with independent tenant-wide resource or source-row tombstones.

This third repair captures full immutable canonical source witnesses before crypto,
then reloads every actual scoped source and control fence after the final crypto and
authorizations. No hash follows final reload. Witnesses persist across current lists,
keyword selection, internal hydration, historical chains, source CAS and bulk effects.
The deletion authority reader exempts only the exact unchanged tombstone created by
this operation; it retains the full resource requirement and delegates every broader
resource/source control. Both current independent grants are checked after the last
await. All eight original injections now deny and roll back in registered handlers.

The first open-review bulk probe used the wrong patch signature and is non-certifying.
The final judge's corrected BEFORE mirror independently reproduced the old disclosure;
its original source/raw outcome remain preserved. No failed historical evidence was
rewritten. Executor replays of unchanged judge probes are not new independent verdicts.

Only memories/facts/shared scoped guards are covered. Whole Task03 remains incomplete;
this is not a claim that all alternate endpoints, client JWT refresh or live subscriptions
are qualified. Fresh independent review is the coordinator's next gate.

## Changes Made

- `convex-dev/runtimeDataAuth.ts`: shared current authority, scoped real DB selections,
  canonical owner/source/link/tombstone checks, trusted action references, manual source
  revisions, editor binding, deletion fences and explicit historical audit views.
  Private mutation responses now require independent current read authority; write-only
  callers receive safe successful receipts, and filter-selected bulk IDs require read.
  Canonical normalization + actual semanticHash checks run before current/history use or
  source revision. Active recursion rejects cycles and validates every requested version.
  Every source selector is checked; message-only, empty and conflicting anchors deny.
- `convex-dev/memories.ts`: all19 modern public handlers authorize; actual ID/space/keyword
  selection is scoped before processing. Partial writes/finalization advance source
  revisions and preserve assistant claims. All-ID deletes preflight; deletes tombstone.
  Two existing internal queries require stored read references; purge becomes internal.
- `convex-dev/facts.ts`: all18 modern public handlers authorize. Global ID/subject/relationship/
  history reads are scoped. Version/supersession/consolidation/bulk paths preflight peers;
  manual edits cannot retain tool evidence privilege. Existing internal hydration requires
  stored read references; purge becomes internal. One authoritative facts table remains.
- `convex-dev/schema.ts`: serialized authorized additions only: memories owner/lineage/
  tombstone/composite ID index; memories/facts keyword owner filters; typed optional
  runtimeEditor and server-only manualSourceBinding on both tables.02B's fragment/source/
  facts provenance additions remain intact. Third repair does not edit this file. The current combined hash
  231d351078ae7c168e3946a5ee3602f59e3c113f4145ae810a8bb02255168f53 includes the
  parent's separately reviewed Task03B2-D blocks/import. MF's prior12 additive lines
  remain unchanged; this executor claims ownership only of the approved MF additions.
- `tests/unit/runtimeEndpointAuth/`: actual registrations through a documented fixture cast
  to runtime _handler (absent from published registration types); transaction-aware DB. Assertions observe
  selected canonical rows, writes, rollback, ownership, source revisions and visibility.
- This QA folder: frozen shared contract,42-path AST closure inventory and source hashes,
  portable scoped configs, exact command receipts and reproduction scripts.

## Requirements Checklist

- [x] Preserved frozen03A inventory/contracts and reviewed auth/verified/domain sources.
- [x] Catalog42 actual registrations:39 baseline public+3 existing internal;37 modern public
  remain,2 operator purges become internal,3 existing internal helpers stay internal.
- [x] Trusted omitted tenant/space derives one current scope or denies ambiguity/duplicates.
- [x] Actual composite/index/search owner/scope selection before handler processing; foreign
  tenant same-ID row inserted first cannot win canonical reads or mutations.
- [x] Missing ownership/provenance excluded; same-tenant foreign owner denied unless explicit
  trusted space/tenant access; admin does not imply read/write/storage/tool capabilities.
- [x] Independent read governs every private mutation response. Same-owner and space-grant
  foreign-owner write-only edits/store/restore succeed with safe receipts. Filter update/
  delete responses omit unsupplied IDs without read. Read+write retains full responses.
  Late grant/principal/membership/scope/resource/source invalidation, expiry and integrity
  failure after write preparation abort rather than become receipt success, including a
  corrupt later bulk row. Source hashes are followed by fresh authority checks and an exact full immutable
  canonical-source reload with no subsequent crypto.
  Distinct raw tenant READ/space WRITE references remain pinned through final delivery.
  Late admitted READ failure denies/rolls back; synchronous lifetime checks after the last
  await fence either grant's expiry. Filter delete IDs require exact mutation-created
  full tombstone proofs against the predeletion canonical owners and source witnesses;
  only the exact operation-created scoped tombstone is ignored. Independent tenant-wide
  resource/source row/control tombstones still deny; valid/read-less controls succeed.
- [x] Canonical normalization and exact semanticHash verified before current/history reads
  or edits; corrupt sources produce no writes and cannot be silently repaired.
  Empty normalized manual text rejects before source insertion/revision across store/edit/
  partial/finalize paths, with typed INVALID_INPUT and zero attempted writes.
- [x] Dedicated manual CAS requires server binding + exact full lineage + manual fact policy.
  Extracted fact edits create their own user assertion source, succeed with/without memory
  sourceRef, preserve original memory/source/sibling facts, and retain binding across versions.
- [x] Active path cleanup rejects cycles/wrong repeated edge versions while preserving valid
  repeated DAG checks. Every supplied selector is checked; malformed partial links deny.
- [x] Partial/finalize/version source CAS, linked resource checks, all-ID preflight, supersession/
  consolidation peer checks, rollback, tombstones and current fact/source revision checks.
- [x] Trusted editor column is server-bound; caller metadata/actor/tool/source/participant labels
  cannot grant ownership, privileged authorship or verified tool evidence.
- [x] Agent/stream output remains assistant_claim; manual facts remain user_assertion.
- [x] Stored read reference admission plus canonical internal candidate hydration prevents
  foreign IDs/confused deputy delivery; later grant/source/resource deletion denies delivery.
- [x] Historical audit view clearly labels old revisions; normal current retrieval still excludes
  stale lineage. Foreign/tombstoned/forged event/trust/future history revisions deny.
- [x] Unqualified old embedding routes retain public registrations and fail PROFILE_NOT_READY
  before any vector/inference dispatch; Task09/10 modern profile wiring remains explicit.
- [ ] Live direct public invocation/subscription and managed transaction qualification: parent
  authorized disposable target deployment/testing pending. No service evidence invented.

## Files Modified

| File/group | Action | Notes |
|---|---|---|
| `convex-dev/runtimeDataAuth.ts` | Created | Scoped authorization/data-layer machinery |
| `convex-dev/memories.ts`, `convex-dev/facts.ts` | Modified | All42 inventoried path dispositions |
| `convex-dev/schema.ts` | Modified | Serialized MF fields/index/filter additions, including server-only source binding; prior12 MF lines only, no third-repair edits;02B/D already integrated by parent |
| `tests/unit/runtimeEndpointAuth/{memory,facts}.test.ts` | Created | Actual endpoint outcome regressions |
| `tests/unit/runtimeEndpointAuth/sharedfixtures.ts` | Created | Transaction-aware database/context fixture |
| `qa/task03b1-mf/` | Created | Contracts/catalog/receipts/reproduction |
| `work/backend-runtime/task03b1-mf/` | Created, ignored | Intermediate rewrite/config scripts; not required for reproduction |

## Verification

Final exact results are in `checks/commands.json` and named stdout/stderr receipts.
Run `node _goals/convex-backend-runtime-2026-10-02/qa/task03b1-mf/checks.mjs` from
repository root; ignored work is not needed. The runner checks expected full-root
consumer diagnostic identities/count and rejects additional unrelated diagnostics.

| Check | Result |
|---|---|
| Strict touched backend types | PASS |
| Strict touched root/test types | PASS |
| Affected backend/schema/test/QA ESLint | PASS, zero warnings/errors |
| Bounded AST closure | PASS,42 resolved registrations/42 exports/0 unresolved |
| Endpoint + frozen authority/policy unit checks | PASS,5 suites/361 tests:228 MF outcomes +133 authority/policy outcomes, zero skips |
| Full root `tsc --noEmit` | FAIL with exactly4 expected integration diagnostics below |
| Unchanged judge source-fence probes, executor replay | PASS,6/6, every injection reached |
| Unchanged judge historical-source probes, executor replay | PASS,3/3 including positive |
| Unchanged distinct-grant final-read probes, executor replay | PASS,6/6 |
| Touched whitespace check | PASS |

Full-root errors are exactly `tests/helpers/cleanup.ts(58,62)` (memories.purgeAll),
`tests/helpers/cleanup.ts(77,59)` (facts.purgeAll), `tests/interactive-runner.ts(380,55)`
(memories.purgeAll), plus `src/governance/index.ts(380,28)` (enforce) from the parent's
independently FINAL PASS Task03B2-D worker visibility integration. Their client/QA consumer updates belong to
03C/coordinator; this executor did not patch out-of-owned files or report full root PASS.

Tests use only the sentinel CONVEX_URL=http://127.0.0.1:1 and local loader mode, no
Convex client construction/network requests. They invoke actual registered handler
bodies and simulate transactional rollback; they do not prove real Convex transaction,
subscription/managed vector/private byte/callback behavior. No deploy/codegen/inference,
staging/commit/push, SDK/CLI/provider/UI edits or additional agent spawning occurred.

## Notes for Reviewer

Parent integrated independently reviewed D at cd5671449beb64ed1ca4a284a761cad60ab70525
while this repair ran. That commit changes no MF/source/schema bytes from the prior
integration notice. Current HEAD already contains02B/D; the remaining schema diff is
exactly MF's12 prior approved additive lines. No MF source was staged or committed. Shared guard
APIs/contracts are frozen in contracts.md. Historical-only stale annotations never flow
through current retrieval helpers. Typed runtimeEditor is separate from arbitrary metadata.
The exact raw command report is authoritative for final test totals and counts. An
intermediate history return omission was caught by4 retained positive outcomes and the
unchanged historical positive probe; return was restored without weakening assertions.
checks/local-history-return-regression.* retains that non-final failure receipt; final
results come from commands.json and its named unprefixed outputs.
`repair-evidence.md` maps each independent defect to source changes and outcome regressions.
The retained original110 MF outcomes and64 prior-repair outcomes remain.54 third-repair
outcomes add full source tuple/owner/scope/content/hash/lifecycle/timestamp changes,
valid payload CAS replacement and retained supersession/consolidation peer witnesses, multirow list/search/internal hydration, history,
earlier resource controls during later candidate hashing, precise deletion controls and read-less/late-WRITE rollback controls. Private mutation
responses retain raw tenant READ/space WRITE positive controls. Current/history READ
expiry and opposite READ/WRITE expiry are injected during the final source reload after
raw grant fetches. These expiry tests retain rollback and injection assertions; they
were adapted from the old two-lookup path to the new three-lookup source-authorization
path and now advance time later, after the final grant checks have awaited.

The final361 outcomes are228 MF (117 memory,111 facts) +133 unchanged frozen authority,
5 suites,0 skipped. Historical cycle2's307 tests and6+30+12 independent checks remain
historical evidence, not claimed reruns here. Current unchanged judge replays total15
outcomes (source6/history3/final-read6); fresh third judgment remains pending.

checks/third-repair-archive-integrity.json records zero mismatches across32/38/44 records;
archive-integrity.mjs reproduces the read-only manifest verification. Prior checks/open-
final-read-probe receipts remain historical; current replays use checks/probe-* outputs
and the latest commands.json.
The whole-schema hash changed only because of the parent's authorized D integration;
MF did not edit schema during this repair. Reviewed runtimeAuth/verified hashes remain
unchanged. freeze.json records current source and QA hashes. No writes occur after freeze
until the parent requests an essential bounded fix.

Remaining boundaries:03B1-T conversation/share/snapshot/factHistory,03B2 remaining157
public paths,03C JWT/client/actual subscription negatives; Task05 Agent routing; Task08
ordered ingestion/history/outbox; Task09/10 qualified semantic adapters. Existing linked
rows without fresh trusted ownership fail closed, with no legacy adoption/bridge.
Task08 must attribute manual edits using runtimeEditor, including cross-principal edits;
source owner alone is not the editor. SourceContent and the frozen DerivedFact DTO remain
unchanged; DerivedFact cannot supply the new server-only source binding.
