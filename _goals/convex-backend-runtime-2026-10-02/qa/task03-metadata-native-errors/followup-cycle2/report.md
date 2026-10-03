# Task Completion Report — accepted metadata native-error followup, cycle 2

## Status: executor work COMPLETE; fresh SECOND independent verdict pending

The second of at most three authorized accepted-dependency correction cycles is implemented and verified in the same detached accepted-HEAD checkout. The first fresh original-scope judge returned FINAL REJECT 3.0: a static FORBIDDEN from a duplicated control lookup was treated as ordinary ineligible-grant pruning by the unchanged resolver. With two concrete grants and omitted selectors, four actual mutable read/write cases admitted another scope. The bounded reader now throws a distinct static nonpermission ambiguity error, so corruption aborts the whole operation. This report supplies executor evidence; it does not award a gate PASS.

Accepted baseline: `c01ea6f06262d3a5eae9d171654e770c694ad409`. Checkout: `/workspace/Project-Cortex/work/backend-runtime/task03-metadata-native-errors-checkout`. The original first report, first 5-source/114-QA freeze, literal failures, full judge records and historical QA remain unchanged. The first judge report SHA is `3991298b6270e08c0827003364ac762bd3f18bab878f6bf3c5478b057c11d136`; its manifest SHA is `e65a086c489d1717bf2a42a816b2f4b492f9ccc0d2a879f8a4b6e019b315216a`. Its complete 490-record archive is `../history/followup-cycle1-final/`, preservation manifest SHA `06c8c4e8b77b059ae3a12a05f5be9bc7a7ac23cbc259f0b4f28438362bbdbd5d`. Eighteen reproducible compiled/cache omissions remain private and were previously verified by the parent; no historical record was replaced.

This is the SECOND accepted-metadata/shared-reader cycle, distinct from the exhausted rejected-MF third gate and artifact/registry gate. There is no fourth MF/artifact repair, renamed gate or reset. Parent owns main integration, staging/commits, accepted live-fixture two-helper provenance refresh and the fresh independent review.

## Changes and exact scope

Only the ambiguity branch of the already bounded generic `boundedSingle` helper in `convex-dev/runtimeAuth.ts` changes in this cycle. It throws this complete constant ConvexError data envelope:

```json
{"version":1,"code":"AUTHORITY_LOOKUP_AMBIGUOUS","message":"Authority lookup is ambiguous","retryable":false,"outcome":"not_dispatched"}
```

All three reader lookup bodies, trusted selectors and take(2) operations remain byte-identical to the first candidate. The unchanged resolver catches FORBIDDEN for ordinary eligible-grant pruning; this distinct error propagates through admission, final checks and pinned-reference validation. Genuine infrastructure exceptions remain identical objects. No catch, resolver/pruning change, extra lookup rule, READ requirement or capability rule was added. Canonical metadata duplicates retain the first candidate's original static FORBIDDEN behavior, and `runtimeMetadataAuth.ts` is byte-identical to the first candidate. The cumulative source change from accepted HEAD remains confined to the three canonical owner-filtered row lookups and three shared reader lookups plus their minimal typed bounded-single helper.

Two parent-authorized expectation corrections reflect the new control-error API: the single duplicated-identity expectation in provisioning changes only the exact code/message; native-errors changes only the 42 control-denial expectations to the complete new static shape. Its canonical duplicate FORBIDDEN expectations and all privacy, reached, bounded-limit, attempted/committed effect, rollback and infrastructure identity assertions remain. `handlers.test.ts` is byte-identical to the first candidate, preserving the three previously authorized take(2) session-hook/reached corrections. Original test names, counts and multiplicities remain exact.

New `scope-ambiguity.test.ts` supplies 80 meaningful actual-handler outcomes using the real installed QueryImpl.unique protocol if native unique is reached. Fixtures cover two spaces in one tenant and two independent tenants, READ or WRITE-only grants, and both candidate iteration orders. Cases assert exact nonpermission errors, no private row/value/control IDs in message/stack/data, take(2) reached with both duplicate IDs, no alternative result or WRITE-only receipt, zero attempted/committed effects or rollback after the measured attempted effect. Eight explicit healthy-scope controls and 24 ordinary eligibility positives distinguish corruption from normal pruning. Twelve public-final/pinned-before/pinned-final cases inject corruption into the pinned scope and verify abort/rollback without scope switching. The fixture itself remains unchanged.

`cycle2-only.patch` shows the exact second-cycle three expectation/branch changes plus the new file; `changed-paths.patch` shows the complete six-path proposal against accepted HEAD. `cycle1-source/` preserves all five first candidate source files byte-exact, before any second-cycle expectation change. `final-source.json` pins six current source/test files and the installed native QueryImpl SHA. No schema, SDK/source bridge, registration/validator, generated binding, compiler configuration, dependency manifest/lockfile, other existing tests, internal provisioning, rejected MF/artifact code or live harness changed.

## Verification and counts

| Evidence | Fresh observed result |
|---|---|
| Selected ordinary Jest | 867/867 testcase outcomes, 14 suites, 0 failures/skips/pending/todo |
| Original metadata | 189/189: 187 handler outcomes and 2 registration outcomes; names/multiplicities unchanged |
| Original native errors | 106/106: 6 genuine native diagnostics, 36 canonical/conflict duplicate denials, 6 normal/cross-scope/read/receipt positives, 42 control duplicate denials, 1 absent/single fence control, 15 infrastructure outcomes |
| New multi-grant ambiguity | 80/80: 16 omitted-selector corruption denials, 8 explicit corrupted-scope denials, 8 explicit healthy-scope positives, 4 healthy two-scope ordinary denials, 24 eligibility-pruning positives, 8 infrastructure identity cases, 12 final/pinned rollback cases |
| Accepted 03A shared dependency | 133/133: authority 54, provisioning 15, inventory 64; all original names/multiplicities retained |
| Accepted workers | 185/185: admin 58, governance 39, graph 88 |
| Accepted SDK consumers | Governance 28/28; metadata 106/106: metadata consumers 79, session maintenance 27 |
| Auth separate replay | 98/98 across 3 suites: credentials 40, context 26, validators 32; credentials overlap selected 867 |
| True outcome count and discovery | 925 testcase outcomes = 867 + 98 − 40 repeated credentials; all prior 845 retained plus 80 new; 16 discovered suites, all executed |
| Original judge comparison | Pre-repair exact 18 observations reproduced 4 admissions; original denial checker failed 4. Current asserted 18-case comparison denies all operations; original 6 denial predicates now fail 0 |
| Preserved obsolete finding collector | Exact original collector rerun after repair exits 1 on its obsolete expected-admission assertion; raw receipt retained honestly |
| Original parent native mechanisms | Fresh accepted-byte baseline canonical 6 and shared-control 6 actual-handler probes preserve real installed native diagnostics and zero attempts/commits |
| Historical current replays | Boundary 118 + extra 33 = 151; timestamp comparison 72; supplementary observations 19; cleanup controls 6; all assertions pass |
| Exact inventory and native registration | 41 paths, 36 guarded public, 5 internal, 0 unresolved; endpoint and native validator records identical to the first candidate |
| Actual unchanged backend ES2021 tsc | `node node_modules/typescript/bin/tsc -p convex-dev/tsconfig.json --pretty false`, exit 0; no override/config edit |
| Scoped strict types and lint | Exit 0; changed-file lint 0 errors and 0 warnings |
| Root accepted-checkout types/lint/build | Exit 0; root lint has 0 errors and 118 warnings outside the changed scoped files; CJS/ESM/declarations build succeeds |
| Actual packed contracts | npm 12.2 `npm run test:contracts`, exit 0; packed ESM/CJS exports, consumer declarations, URL round trips and browser execution pass |
| Preservation | 4,061 of 4,064 before-cycle2 records unchanged; the other 3 are the authorized branch/expectations. Original 3,453 protected tracked and 2,340 original QA records exact; first 5 source copies, 114 QA records and 490 archived candidate/judge records exact; metadata 69 + 101 older archive records exact |
| Temporary cleanup | No inventory or packed-contract temporary directories retained; all six original callback cleanup controls pass |

These are testcase outcome counts, retaining duplicate display-name multiplicities; they are not deduplicated string-name counts. The separate credential replay is explicitly counted once in the 925 total. The old 787 selected outcomes and all separate 98 names are preserved exactly; the literal historical failing metadata185/189 and auth120/133 receipts remain intact. No assertions were skipped or removed.

`commands.json` and `checks/*.receipt.json` record exact argv, cwd, UTC start/end, exit and the explicit nonsecret offline environment; unfiltered raw outputs are in `checks/*.log`. `test-summary.json` records every outcome name/status/file. Discovery equals the exact union of the 14 selected and 3 auth suites with one overlapping credential suite. `preservation.json` compares all pre-cycle2 records, verifies all older hashes and proves the exact source boundaries and name/multiplicity preservation. `verify.py.text` and `run-check.py.text` retain the verification and recording sources.

Node 24.19.0 and npm 12.2.0 were observed. Existing accepted dependencies were reused; no dependency installation occurred. An isolated local node_modules directory holds individual dependency symlinks, so pack scratch is local. Private npm cache/config/tmp directories are confined to `work/native-errors-cycle2/`; user/global configuration files are distinct empty private files. Sentinel Convex URLs point at `http://127.0.0.1:1`; no service/network, credential/signing, target, model, deploy, codegen, stage/commit/push or agent operation occurred.

## Original 41-path and affected 03A requirement coverage

The complete exact-path capability/scope/owner/resource/background mapping and current original outcome evidence are in `original41-requirement-mapping.json`; the affected accepted shared-reader contract is mapped in `affected03A-requirement-mapping.json`. All 41 endpoint records and native registrations/validators are unchanged. Public handlers retain authorized, missing verified identity and forged tenant outcomes. Internal handlers retain exact operator/creator/currentness/reference checks and measured effect/rollback assertions, backed by the original registrations, workers and current historical boundaries.

- Verified issuer/subject and trusted grants derive exact tenant/optional-space before private lookup. Original metadata189/03A133 and the original36 guarded public-handler triplets remain. Caller metadata cannot mint authority; own resource/user-profile binding and explicit broader resourceAccess remain unchanged.
- Scope, owner and profile filtering precede hydration/list/count/search/limit. Original traced collection controls and native owner-filtered exact-key traces remain; multi-grant omitted-selector corruption now aborts before any mutable resource query, regardless of candidate order. Explicit valid scope remains available when corrupted controls belong only to an unselected scope.
- READ and WRITE stay independently eligible. WRITE-only success returns only the existing safe receipt; final control corruption or infrastructure failure returns no receipt and rolls back. All readResourceAuthority/response/finalChecks bytes remain unchanged. Original late read/write outcomes and 52 historical late barriers remain alongside the new final/pinned cases.
- Trusted actor/profile alias remains exact. Own user-profile binding and explicit eligible cross-principal profile controls retain all assertions. No additional READ was introduced to suppress WRITE-only disclosure.
- All-key preflight remains before every bulk/transaction effect, including foreign/missing-owner collisions and later-invalid keys. Canonical FORBIDDEN ambiguity, all 36 canonical/conflict native outcomes, original 15 bulk duplicate controls, 20 later-bulk and 8 transaction replay controls preserve zero attempted/committed effects. Exact-key conflict probes and all transaction bodies remain untouched.
- Row/control tombstones cannot confer privilege or revival. Original retention/recreation/list/count tests remain. Duplicate principal/scope/resource-or-tenant fence controls fail safely; missing/single-row/foreign-scope fence semantics remain. Normal single tombstone, deleted/missing scope and revoked/expired/absent grant pruning still select one healthy scope, while corrupt duplicated controls abort the entire omitted-selector operation.
- Final exact authority/lifetime/active-session barriers remain. All original before-effect and after-effect expiry/attempt/rollback assertions are preserved and reach actual take(2); 151 historical boundaries include last-control session crossings. Infrastructure exceptions remain identical objects before or after an attempted effect, including the multi-grant case with another eligible candidate. New pinned/final ambiguity never falls back to another scope.
- All five internal workers retain trusted stored exact-reference validation, canonical owner/user/resource, scope, current grants, versions/epochs and fences. Original creator/binding/currentness/expiry, 15 malformed-reference and 15 late internal-fence replays, workers185, and pinned internal increment outcomes retain no-effect/rollback assertions. Internal visibility itself does not confer authority.
- Exact optional scope, collision-safe JSON-array source IDs and same-ID cross-scope coexistence remain. Original collision/undefined-space tests, native undefined-space duplicates and cross-space/tenant positives pass. The source-ID/MF bridge is unchanged and separately owned.
- Original accepted03A policy, resolver, FORBIDDEN eligibility pruning and internal provisioning are byte-identical. Only reader ambiguity uses the distinct nonpermission envelope. Authority54/provisioning15/inventory64 retain original outcome names/counts, and 24 new normal pruning positives confirm those semantics remain.
- Historical preservation, actual unchanged ES2021, scoped/root accepted quality, exact41 discovery and genuine native diagnostic mechanisms pass as stated. Independent original-scope judgment remains pending; these checks do not establish managed transport or service behavior.

The report's appended path table lists every original endpoint. Each public entry also carries the shared requirements above; each internal entry retains native registration, trusted-reference and zero-effect/currentness controls.

## Preserved replay methodology and failures

Before this second source repair, the exact first-judge original 18-observation collector and denial checker were replayed against the first candidate, reproducing the four admissions and four failed denial predicates. The preserved collector's fixtures, accepted baseline raw bytes and real native unique protocol remain untouched. After repair, the exact collector stops with exit 1 on its expected-admission finding assertion; that result is retained. A separate current verifier changes only candidate finding expectations to required static denial/zero attempts/zero commits/no private output, while preserving the full 18 scenario fixtures and accepted baseline comparisons. The separate current denial checker retains all original six outcome predicates, including all four regressions. This is documented in `judge-replay-provenance.json` and `current-required18-provenance.json`; no obsolete collector is relabeled as passing.

The first attempt to relocate the archived baseline executables used `.ts` instead of their retained `.ts.text` archival names. The copy setup raised FileNotFoundError before source edits; the two initial recorded nonexistent-script executions both exit 1 and remain in `cycle1-exact18-before-repair` and `cycle1-required-denial-before-repair`. Correcting only archive filename selection/import/output relocation produced the literal reproduced pre-repair findings. No test assertion or production change arose from that setup correction. Original first-cycle harness/type/npm setup failures and all initial old-suite failures remain in the untouched first QA directory and archived history.

Current 151/72/6 historical scripts change only candidate root and temporary output locations; original assertions remain. Timestamp comparison executes archived endpoint bodies against the current authority/fixture, not the entire archived dependency set. The historical19 scripts retain the first parent-authorized unique-to-take(2) session-hook adaptation with bounded-limit/explicit reached assertions; this second replay changes only output/read destinations. Raw historical method prose is retained, and `replay-provenance.json` states the current-executor qualification. No canonical historical writer was directed into an original QA directory.

Both original parent six-probe mechanisms were executed against private exact accepted-HEAD raw copies of immutable/mutable/sessions/runtimeMetadataAuth/runtimeAuth, with only executable import/output locations relocated. Their diagnostic controls still expose the synthetic stored IDs under installed native QueryImpl.unique and report zero attempted/committed effects. New native106 also retains six genuine installed-protocol diagnostic controls. These establish the actual native mechanism, not an identifier-free substitute. They are baseline executor confirmations, not an independent verdict or deployed exploit proof.

The historical dirty-main compiler receipt `_goals/convex-backend-runtime-2026-10-02/qa/task03c2-a-main-integration/root-types.log`, with its commands.json UTC11:32:21–33 exit2 and source-context.json, contains three rejected-MF TS2339 diagnostics: two removed public purgeAll references in tests/helpers/cleanup.ts and one in tests/interactive-runner.ts. It remains historical observed dirty-main evidence, not a fresh aggregate run. This accepted isolated candidate's fresh backend/root compiler, build and packed receipts are separate. Main rejected-MF/SDK source was not copied or mutated here; no current-main/full-goal PASS is claimed.

## Freeze and remaining gates

`freeze.json` is written last and pins all six current source/test files and all second-cycle QA bytes, plus the preserved first freeze/history hashes. All permitted writes stop at FINAL. Fresh SECOND independent judge must inspect the full original41 and affected03A requirements, the narrow compatibility corrections, original 845 outcomes, new 80 cases, raw findings and current verification before acceptance. No additional repair follows this freeze without parent feedback and bounded authorization.

Parent integration and accepted live-fixture two-helper provenance refresh remain pending. Actual managed JWT delivery/subscriptions/private bytes/callbacks, live41 service cases, managed concurrency, UI, whole Task03 and all17 completion remain UNEXECUTED/incomplete here. The rejected MF and artifact/registry gates retain their separate historical verdicts.

## Exact original endpoint table

| Path | Visibility | Capability | Current retained evidence |
|---|---|---|---|
| immutable:store | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:get | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:getVersion | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:getHistory | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:getAtTimestamp | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:list | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:count | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:search | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:purge | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:purgeMany | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:purgeVersions | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| immutable:purgeAll | internal | trusted deployment-operator internal invocation | Exact native registration; trusted reference/operator/creator/currentness; original and151 boundary effect/rollback controls |
| mutable:set | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| mutable:update | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| mutable:get | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| mutable:exists | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| mutable:list | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| mutable:count | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| mutable:deleteKey | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| mutable:purgeMany | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| mutable:purgeNamespace | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| mutable:transaction | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| mutable:purgeAll | internal | trusted deployment-operator internal invocation | Exact native registration; trusted reference/operator/creator/currentness; original and151 boundary effect/rollback controls |
| sessions:create | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| sessions:get | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| sessions:touch | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| sessions:end | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| sessions:endAll | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| sessions:list | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| sessions:count | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| sessions:incrementMessageCount | internal | write | Exact native registration; trusted reference/operator/creator/currentness; original and151 boundary effect/rollback controls |
| sessions:incrementMemoryCount | internal | write | Exact native registration; trusted reference/operator/creator/currentness; original and151 boundary effect/rollback controls |
| sessions:expireIdle | internal | write | Exact native registration; trusted reference/operator/creator/currentness; original and151 boundary effect/rollback controls |
| users:get | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| users:list | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| users:count | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| users:getVersion | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| users:getHistory | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| users:getAtTimestamp | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| users:exists | public | read | Authorized outcome; missing verified identity; forged tenant; shared controls above |
| users:deleteUserProfile | public | write | Authorized outcome; missing verified identity; forged tenant; shared controls above |
