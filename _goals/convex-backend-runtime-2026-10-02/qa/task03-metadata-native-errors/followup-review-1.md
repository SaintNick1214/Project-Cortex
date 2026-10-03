# Task Judgment: accepted metadata/shared-reader native ambiguity correction

## Verdict: REJECT

**Average: 3.0/5.** This completed first independent review rejects the frozen five-path correction at detached accepted HEAD `c01ea6f06262d3a5eae9d171654e770c694ad409`. The supplied freeze SHA256, `5e6573ab586f867589835f9f7f3f4ffa32ed0294ccdcbffaee5c7102e0ef756e`, matches before and after review. A newly introduced error-class interaction changes fail-closed foreground admission into alternate-scope selection. Four independent actual-handler cases admit a read or commit a write where the accepted baseline denies.

This verdict concerns the full original 41 metadata registrations and the affected 03A shared reader, not merely six lookup bodies. The earlier original metadata cycle3 PASS remains historical and unchanged. No fourth MF repair or MF/artifact/registry certification is made. All required independent checks described below were completed despite the blocking finding.

Evidence directory: `/tmp/task03-metadata-native-errors-review1-7MWpo4Y1/`. Full command argv, cwd, UTC start/end, exit and safe environment are in `commands.json` and `receipts/`. Unfiltered stdout/stderr are in `logs/`; complete probe scripts and numbered source/context are retained. `manifest.sha256` and `manifest.json` cover the review evidence, excluding dependency symlinks and disposable compiler/Jest caches. This directory is the only reviewer write destination.

## Critical finding

**Control-record ambiguity is swallowed as ordinary candidate ineligibility.** At candidate `convex-dev/runtimeAuth.ts:208`, the new `boundedSingle` calls the existing `deny()`, creating a version1 `ConvexError` with code `FORBIDDEN`. The unchanged foreground resolver at `runtimeAuth.ts:174-177` catches that exact error while materializing a grant, discards that candidate and continues. `getScope` at :238 and `hasTombstone` at :240 now enter this pruning branch. The former installed native `.unique()` exception was an ordinary Error and propagated through the same catch, aborting the entire request.

Independent fixture: one verified principal/membership, two current concrete grants for `space-a` and `space-b`, both independently carrying the tested capability, and a private mutable row in `space-b`. Caller supplies neither tenant nor memory-space selectors. With healthy records, both scopes are eligible and the request correctly denies. Duplicating the `space-a` scope record or its exact memorySpace tombstone records reaches the new bounded ambiguity branch once; it removes `space-a` and allows `space-b` to become the single candidate. No grant capability union, forged identity or external service is involved.

| Actual registered-handler case | Frozen correction | Accepted baseline actual handler, installed native unique protocol |
|---|---|---|
| READ, healthy two spaces | Denied; 0 attempts/commits | Denied; 0 attempts/commits |
| READ, duplicate `space-a` scope | Returns `space-b` row, internal ID and `private-b-value` | Denied; reached native ambiguity; 0 attempts/commits |
| READ, duplicate `space-a` memorySpace tombstones | Returns the same private `space-b` row | Denied; reached native ambiguity; 0 attempts/commits |
| WRITE-only, healthy two spaces | Denied; 0 attempts/commits | Denied; 0 attempts/commits |
| WRITE-only, duplicate `space-a` scope | Replaces `space-b` value; safe receipt; 1 attempt/1 commit | Denied; reached native ambiguity; 0 attempts/commits |
| WRITE-only, duplicate `space-a` memorySpace tombstones | Same write/receipt; 1 attempt/1 commit | Denied; reached native ambiguity; 0 attempts/commits |

The row belongs to a separately valid grant; the defect is silent resolution of an omitted-selector request after encountering ambiguous trusted controls, not a claim that the principal lacks every grant to that row. That remains a material violation of this correction's required opaque ambiguity denial, zero effects and preserved original authorization behavior.

Evidence: `ambiguity-pruning-probe.mjs`, `ambiguity-pruning-outcomes.json`, `logs/ambiguity-pruning-with-baseline-handlers.*`, `receipts/ambiguity-pruning-with-baseline-handlers.json`. The probe has 18 observations: six candidate actual handlers, six byte-preserved accepted-baseline authority calls, and six accepted-baseline actual handlers. Installed `QueryImpl.prototype.unique` delegates to the exact fake-query `take(2)` on the baseline side. Copies of accepted runtimeAuth, metadata helper and mutable module preserve source bytes in `baseline-*.raw.ts.text`; executable copies change only module import locations. `regression-required-denial.mjs` checks the actual candidate observations against required denial and exits **1**, with four failed requirement cases saved in `regression-required-denial.json`.

**Required repair:** preserve a whole-operation opaque ambiguity denial that cannot be mistaken for ordinary grant ineligibility, while keeping genuine infrastructure errors distinct. Add multi-grant omitted-selector regressions for duplicate scopes and tombstones, with reached lookup, no private result, zero attempted/committed effects and preserved explicit-scope positives. The parent must determine the narrowly authorized implementation path; this read-only judge made no repair or candidate expansion.

## Requirements review

`original41-independent-requirement-mapping.json` includes every exact original path, its capability/scope/ownership/background/resource requirements, native visibility/validator evidence and exact ordinary endpoint outcome names. `affected03A-independent-requirement-mapping.json` covers original identity/provisioning/capability/grouping/reference/lifecycle/reader contracts and downstream limitations. Public path mappings explicitly mark the shared admission regression as FAIL; passing ordinary outcomes are not relabeled as complete requirements.

| Original or affected requirement | Finding | Evidence |
|---|---|---|
| Exactly immutable12/mutable11/users8/sessions10 = 41, 36 guarded public and 5 internal; no public reference credentials | Preserved | Independent AST/native registration, 41 exact unchanged validators, 0 unresolved; original2 registration tests |
| Exact Convex-verified issuer/subject; trusted controls; actor/profile metadata cannot mint privilege; independent capabilities | Preserved in tested contexts | Original public36 authorized+36 missing identity+36 forged tenant outcomes; accepted auth133; unchanged source |
| Omitted selectors and trusted-control ambiguity deny; no alternate-scope selection after ambiguous controls | **FAIL** | Four independent actual mutable read/write admissions; accepted baseline denies all six corresponding actual-handler cases |
| Exact tenant/optional-space/key/owner database predicates before private selection/list/count/search/limits; no orphan adoption | Source/predicates preserved; admission composition fails separately | Exact three metadata substitutions; original189; native traces; eight collection controls among33 extra probes |
| Trusted metadataUserId and own-profile eligibility; explicit broader profile grants remain available | Preserved | Original profile regressions, six initial READ eligibility cases and source barriers unchanged |
| Independent READ versus WRITE; safe committed receipts; no late admitted READ downgrade | Preserved for validated scopes; control ambiguity can choose a scope | Original receipt/expiry cases, native3 WRITE-only positives, 52 late read/write cases among118 boundaries |
| Full transaction/bulk preflight before ANY effect; foreign/missing-owner/duplicate/later invalid keys | Preserved after successful admission | Original15 duplicate bulk outcomes, 20 later bulk conflicts and8 later transaction cases; 0 attempts |
| Retained row/control tombstones, no resurrection, no privilege/revival | Preserved for validated single/pinned scopes; ambiguous control admission **fails** | Original fence/recreation/counts; native42 single-grant control denials and absent/single fence test; independent omitted-scope tombstone failures |
| Exact final authority/deadline barriers, active-session state after final awaited controls | Preserved | Original pre-/post-effect tests retain reached take(2), deadline and attempt/rollback assertions; independently measured last-await boundaries |
| Internal workers pin exact stored ref, canonical creator/owner/user/resource/scope; current grants/fences | Preserved offline | Native internal5; original internal cases, 15 malformed binding+15 late-fence cases, worker185 |
| JSON-array source IDs, optional-space separation, same IDs across scopes | Preserved | SourceId byte-identical; original collision tests; native undefined-space6 and cross-space/tenant3 positives |
| Null numeric operands reject, omitted default/zero preserved; safe versions/counters | Preserved | Original numeric/version outcomes; archived boundary invalid cases and19 adapted observations |
| Timestamp indexed-last-element compatibility preserves missing/null/order/inclusive semantics | Preserved | 72 old/current handler equality outcomes with 0 attempts; ES2021 source unchanged |
| Native ambiguity errors omit private IDs/fields, diagnostic positive controls are real | Preserved in single-grant/direct lookup contexts; **not sufficient globally** | Native106, actual installed QueryImpl hash, six diagnostic controls; multi-grant error is swallowed instead of delivered |
| Unknown infrastructure is identical infrastructure failure; final WRITE-only failure has no receipt and rolls back | Preserved | Native12 pre-effect infrastructure outcomes+3 final rollback outcomes; no new catch |
| Original189 metadata and133 auth names/multiplicity/assertions retained; changed hooks reached | Preserved | Independent names as multisets equal retained literal receipts; exact authorized patch; original three expiry hooks now assert take2/reached and remain denial/0 attempt tests |
| Schema/config/ES2021/validators/registrations/SDK/other tests unchanged; scoped/root types/lint and packed/browser contracts | Preserved and checks passed | Protected3453, actual ES2021+DOM compiler, independent gates, byte-matched private build/packed copy |
| Canonical QA/history/freeze preserve bytes; ordinary inventory releases temp outputs | Preserved candidate | Frozen5 source+114 QA, protected3453 including2340 original QA, archived69+101, snapshot3573; six exact callback cleanup outcomes |
| Entire Task03/live41/JWT/private bytes/callback/UI/all17 | **PENDING, outside this bounded offline verdict** | No services, JWT delivery/subscriptions/bytes/callbacks/UI or whole-goal execution performed; never reported PASS |

All36 public paths share `authority`→`requireAuthority`→`resolveAuthority`; the failed shared requirement applies to the original metadata scope. The judge directly executed the adverse composition on mutable get/set and did not pretend to execute that adverse fixture against every endpoint. All36 ordinary per-path authorized/missing/forged cases did execute. The internal5 retain pinned or operator semantics and are independently mapped.

## Independent evidence and test quality

| Check | Observed result |
|---|---|
| Selected ordinary Jest | **787/787**,13 suites; 0 failed/pending/skipped/todo |
| Original metadata | **189/189** =187 handler+2 registration outcomes; names and multiplicity unchanged |
| Accepted03A | **133/133** =54 authority+15 provisioning+64 portable inventory outcomes |
| Workers | **185/185**,3 suites |
| SDK governance | **28/28**,1 suite |
| SDK metadata | **106/106**,2 suites =79 metadata consumers+27 session maintenance |
| Credentials included in selected | **40/40** |
| New native-error regressions | **106/106** =6 diagnostic controls+36 canonical/conflict denials+6 positives+42 control denials+1 fence semantics+15 infrastructure outcomes |
| Separate auth selection | **98/98**,3 suites =40 credentials+26 context+32 validators |
| Discovery / true testcase count | **15 discovered suites, all reached; 845 outcomes**. 787+98 overlap40; names with repeated each-case descriptions retain multiplicity. Neither885 nor842 unique strings is the correct testcase count. |
| Historical boundary replay | **118+33=151**, assertions retained, own outputs |
| Timestamp / cleanup replay | **72+6**, exact candidate callback with real cleanup and archived handler comparisons |
| Historical19 | **19 verified**, inherited unique→take method hooks and explicit reached checks retained; this is a method-adapted replay, not byte-exact archival execution |
| AST / installed native registration | **41=36+5**,0 unresolved; endpoint semantic catalog and native validators identical |
| Actual unchanged backend project | `node node_modules/typescript/bin/tsc -p convex-dev/tsconfig.json --pretty false`: **exit0**, actual ES2021+DOM |
| Scoped strict test types / lint | **exit0**, scoped lint0 errors/0 warnings |
| Accepted candidate root types / lint | **exit0**, root lint0 errors/118 warnings outside scoped changed files |
| Build / packed browser contracts | **exit0** in owned private copy of151 byte-matched source/config files; actual npm12.2 build/pack, ESM/CJS exports, declaration consumer, URL round trips and browser execution |
| Independent evidence verifier | **3805/3805**, retained final JSON; does not override separately failed behavioral requirement |
| New adverse requirement checker | **exit1**,4 requirement failures across actual read/write handlers |

The installed native QueryImpl SHA256 is `cb338c5d58d0ffbbdd311954e24456d7fa501f901b205784ce93d67e63206857`; its actual unique implementation calls take(2) and places both IDs in the duplicate diagnostic. New positive controls delegate that method rather than fabricate the message. Fake database transactions preserve independent attempted and committed write counters and rollback snapshots. This is meaningful offline handler/protocol evidence, not actual Convex service transaction/JWT transport certification.

The two old test adaptations are justified compatibility changes, not weakened expectations: exact typed denial replaces raw fixture text; zero effects are added; take(limit) reproduces bounded selection; session expiry arrangements now wrap the actually reached take(2), explicitly assert arming, retain grant-read thresholds and keep expiry/state/0 attempts or rollback expectations. No original name/count was dropped. The original raw failed runs remain185/189 and120/133, and every failed executor setup/compiler/npm log is preserved. The new control-denial tests at native-errors.test.ts:179-185 use one selected grant plus explicit scope, so they miss the multi-grant materialize/catch interaction. That test-coverage gap materially affects Test Quality.

## Preservation, failures and scope qualifications

Before/after candidate snapshots contain3573 records: protected3453 plus five changed/new source records,114 frozen QA records and freeze itself. Every candidate record, HEAD and full Git status is identical. Protected3453 includes2340 original QA files. Both archived metadata histories verify all69 and101 records against their own original manifests. Other schema/generated/SDK/compiler/validators/registrations/original tests and current live harness remained byte-identical. Metadata source differs from baseline only at the three exact bounded substitutions; authority pure policy/resolver/pruning prefix and require/recheck/internal provisioning suffix remain byte-identical. There are precisely four tracked source/test changes plus the one new native test.

Main changed concurrently through coordinator-authorized QA commit `e994640235dba44fc0d07e06587eea75e6b6ffb9`. Main tracked count grew5135→6441:1306 new live-fixture-history/report/preservation records; the sole initially tracked file changed was execution-progress.md. Coordinator confirmed1307 QA-only changed files and an empty index. Main Git dirty status remained identical; every initial backend/SDK/test/config/original historical byte stayed identical. This report **does not claim global main-tree byte identity**. See `main-concurrent-observation.json`, snapshots and `preservation-final.json`.

The old dirty-main root compiler log is preserved in source-context/historical-main--root-types.log with its source/command context: it has the three rejected-MF maintenance-reference diagnostics. Passing root compilation/build in the frozen accepted candidate and own exact private copy does not certify dirty MAIN, the rejected MF candidate, live fixture or whole Task03.

Reviewer setup failures remain explicit. Initial unrecorded-bootstrap cat reads used missing root aliases for profile/roles/skills and a wrong Jest config suffix; corrected paths are .agents and jest.config.mjs. No source was changed. Pre-runner read tool output has no UTC field; the reviewer does not invent timestamps for it. All independent execution gates have exact UTC receipts. The review verifier's first private attempt had Python's reserved pass keyword; the second assumed archive manifests had a different name and counted testcase identities as unique name strings; a third archive attempt assumed every manifest record used path instead of mixed file/path keys. Initial scripts, failed stdout/stderr, receipts and second JSON are retained. The corrected verifier uses each actual archive preservation schema and testcase counters preserving multiplicity;3805 assertions pass. These are private reviewer harness corrections, not implementation fixes or erased failure receipts.

No agent spawning, model changes, service/target calls, credentials readout/rotation, signing, staging/commit, deployment, codegen, dependency installation or candidate/main/config write was performed by this reviewer. npm12.2 reused installed authorized cache tooling, with distinct own empty user/global config; no home/global package configuration was modified. Sentinel URLs are127.0.0.1:1. Parent canonical inventory scripts were only invoked with explicit own output directories; build/pack output stayed in own private copy.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | **2/5** | Required whole-operation control-ambiguity denial/zero-effect and preserved omitted-selector behavior fail in four actual-handler outcomes. Full original41 and affected03A mapping supplied. |
| Code Quality | **3/5** | Minimal typed/indexed bounded operations and strong surrounding barriers, but existing FORBIDDEN pruning swallows the new ambiguity state. |
| Test Quality | **3/5** |845 retained/new testcase outcomes and extensive meaningful replays; one-grant explicit-scope control tests miss critical multi-grant composition. |
| Pattern Adherence | **3/5** | Native Convex/index/schema/static denial styles retained, but fail-closed trusted-control ambiguity no longer survives existing resolution patterns. |
| Completeness | **4/5** | Exact41 wiring, current strict quality/build/packed gates and preservation complete for review; no claimed live/broader gate. |

**Average: 3.0/5.** Requirement Fulfillment≤2 makes this **REJECT** under the strict judge-task rubric. No score or passing suite overrides the reproduced requirement failure.

## Issues and recommendation

Critical: the control-ambiguity pruning regression described above must be fixed before acceptance/integration. Important: add multi-grant omitted-selector scope/tombstone denial regressions so the fix is exercised through the public resolver and actual handlers. No additional minor source repair is requested.

Keep this candidate frozen and preserve all prior verdicts/receipts. Parent should review this finding, authorize any necessary exact bounded repair scope, and obtain a fresh independent original-scope review with the new regression. This judge grants no extra cycle and performs no repair. Only after accepted helper integration and exact live-fixture dependency provenance refresh/review may the parent proceed to later real41 execution. Live41, managed JWT/subscription/private-byte/callback/UI/full03/full17 remain pending and are not rejection reasons by themselves.
