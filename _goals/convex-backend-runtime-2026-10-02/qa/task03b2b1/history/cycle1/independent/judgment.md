# FINAL Task Judgment: Task03B2B1 registry/context candidate

## Verdict: REJECT

The exact 46-registration candidate has substantial authorization and preservation evidence, but it fails required WRITE-only disclosure protection and permits a create operation to commit a graph exceeding its own supported bound. Passing 337 tests does not cover these outcomes. This is a judgment of the bounded candidate only; it neither rejects nor certifies the excluded stats/A2A paths, whole Task03 or the goal.

Reviewer scope: fresh independent, read-only review of `/workspace/Project-Cortex/work/backend-runtime/task03b2b1-checkout`, pinned Git HEAD `a2c9827783e9dd49b9811a2899ba4acbeadc21cd`. Accepted main comparison: exact archive of `4fb3482c5e06fcab12ab8513b242a066ef761f2f`. All independent artifacts are in `/tmp/task03b2b1-review1-5DtS9Q`. No candidate/main source, test or canonical QA writes; no network/service/paid inference/deployment/codegen/stage/commit/subagent operations.

## Evidence Review

Read the original implementation prompt, authoritative decision register, architecture (including authorization section 9), goal, Task03, AGENTS/runtime/profile, pessimistic-judge role and judge-task rubric. Inspected candidate report/contracts/requirement mapping, source freeze, preservation, exact schema patch, catalog, raw checks and historical correction receipts, native codec/dependency evidence and root diagnostic classification. Read all four owned implementation modules and all four test files, owned schema blocks and the frozen runtimeAuth dependency.

Independently reran actual backend tsc using the unchanged `convex-dev/tsconfig.json` (target ESNext with ES2021 library; no compiler uplift), scoped ES2021 tsc, scoped ESLint with zero warnings, discovery, all 337 registered-handler tests, exact catalog regeneration and diff check. These pass. Independent catalog equals 46 selected / 43 public / 3 internal / 48 total module registrations / 2 excluded stats / 0 unresolved. Three suites, zero failed/skipped/todo tests. Command arguments, UTC times, exits and raw streams are in `commands.json` and matching output files.

Ran 258 additional asserted authority outcomes: all 43 public registrations deny a forged issuer with valid subject, deleted principal, revoked membership, revoked grant, changed tenant epoch and deleted actual space before any domain hydration/effect. Results: `authority-probes.stdout.json`; source: `authority-probes.mts`.

Ran eight independent receipt/native error probes plus an explicit graph-boundary probe using the actual registered handlers. The duplicate-error probes reuse the installed Convex1.46 `QueryImpl.prototype.unique` implementation while delegating `take(2)` to the traced fixture; this is a handler-level native error proof, not a live deployed transport test. Raw outputs: `probes.stdout.json`, `graph-boundary.stdout.json`. The existing individual WRITE-only safe receipt is a passing positive control.

All npm invocations used the specified private npm12 cache with offline mode; observed Node v24.19.0 and npm12.2.0. No dependency installation or package/build step was used.

## Requirements Review

The original Task03 requires a trusted boundary for all reachable data paths, inventory/guarding, refreshed verified credentials/bootstrap, scoped direct/canonical endpoints, background revocation/deletion and appropriate subscription/byte/callback authentication. Only the following registry/context part is presently bounded for acceptance. Unimplemented original requirements remain pending explicitly, rather than being inferred away from executor prose.

| Original or bounded requirement | Met? | Source/outcome evidence |
|---|---|---|
| Execute separately bounded 03A/03B/03C steps; preserve frozen authority contract | Yes for this dependency/slice | Frozen runtimeAuth/verified/generated hashes match all declared freeze entries and pinned base; original broader steps remain pending |
| Inventory and guard/internalize all selected alternate registry/context paths | Yes | `catalog/selected-path-inventory.json`, native validator/visibility assertions, independent regenerated catalog; 43 guarded public + 3 internal purges |
| Verified issuer/subject maps to trusted principal, membership, current grant and exact tenant/actual space | Yes in offline handler qualification | `RegistryAccess.open/admit/keep/fence`, frozen requireAuthority; existing complete-path negatives plus 258 fresh issuer/control outcomes with zero hydration/effects |
| Ordinary resource selection retains owner predicates before hydration/filter/pagination/count | Yes within declared exception | `agentsIn/agentAt/spacesIn/spaceAt/contextsIn/contextAt`; foreign-first tests trace actual selections; no deployment-wide public counts |
| Descriptive agent config, metadata, user/participant/access labels never grant authority | Yes | Source derives owner from verified principal; adversarial forged labels/no provisioning/target-grant checks; authority tables preserved |
| READ/WRITE/ADMIN are independently required and retained | Partially | Individual registry edits retain optional READ plus separate WRITE/ADMIN; late admitted READ loss rolls back; bulk/orphan identifier delivery lacks READ (F1) |
| Initial absent READ allows safe receipt; no private resource values in WRITE-only receipts/errors | No | Individual safe receipt passes, but bulk/orphan receipt identifier disclosure F1 and native duplicate identifier errors F3 fail fresh probes |
| First immutable witnesses survive repeated admissions, later candidates and final barriers | Yes for exercised paths | `witness` refuses rebinding; intentional `expect` only; complete matching sweeps; original repeated-root/late row/grant/binary/int64/retirement rollback outcomes pass |
| Complete duplicate/collision/native-shape/version/history/topology preflight precedes first effect | Partially | Existing bulk negatives deny before writes; create omits post-insert graph node-bound preflight and commits an unreadable 101-node graph (F2) |
| Exact native payload/owner/lifecycle witness exists before first post-insert reread and through completion | Yes for payload witness | `inserted` retains locally computed fields + native ID before awaiting; all three create paths with and without READ reject late owner/payload/collision changes; object-key reorder positive controls pass |
| Full actual-space grants and canonical graph owner/version/lifecycle/root/parent/depth/edges throughout delivery | Partially | Whole-root graph + exact bidirectional topology passes existing cross-space/revocation/malformed negatives, but create can exceed supported graph bound (F2) |
| Native Convex v.any config/data compatibility; required versus optional fields | Yes | Official convexToJson; int64 bounds, buffers, special floats, signed zero, null, roots/deep objects/merge/archive/history/export outcomes pass. Missing required space metadata denies while optional agent/context values remain allowed; no unsupported JSON-only grammar added |
| Context revisions attribute verified current editor and preserve prior writer without owner conflation | Yes for public revision operations | `revision`; child/edit/cross-principal/unknown-prior-actor/retirement assertions. Current verified principal differs from canonical owner where appropriate |
| Deletion retains metadata/tombstones/epochs/controls and prevents revival/provisioning | Yes for bounded retirement | Registry/context retained row/resource tombstones, exact retired-space barrier, late principal/fence rollback; both space/tenant-wide later registration/reactivation deny; no raw source cascade claimed |
| Conversation canonical owner/anchors must authorize before transcript hydration | Safe fail closed; positive path pending | `conversationAt` does zero conversation hydration and denies all current ownerless references. Typed metadata seam exists; capability-not-ready distinction is absent (F4). Positive canonical conversation/anchor and transcript lock/revision behavior remain Task03T/05 |
| Narrow Boolean authorized-key collision exception never selects/processes/delivers foreign payload | Yes for described exception | Exact tenant/actual-space/key `.first`/`.unique` probes immediately reduce to Boolean; `uniqueKey` catches errors; no unscoped scan/adoption. F3 concerns separate ordinary canonical lookups before that sanitized fence |
| Operator purges internal; preserve source/auth/metadata fences | Yes for bounded static/native outcome | Three native internalMutation registrations unavailable through public api; retained metadata/tombstones and auth/source rows asserted |
| Additive schema only in owned blocks; excluded paths and configs unchanged | Yes | Exact 13-line additive patch independently byte-matches; 33 source freeze entries and 364 canonical QA artifacts unchanged, including histories; stats2/A2A4 untouched and pending |
| Actual affected compilation/lint/discovery/tests and honest introduced diagnostics | Scoped checks yes; integration pending | All scoped/actual backend gates pass; root 28 and lint 26 reproduced; pinned base 1 each; accepted main 0 each. 25 introduced SDK receipt assumptions + 2 introduced public cleanup references remain pending (F5) |
| Refreshed clients, canonical unlocked transcript, subscriptions/uploads/downloads/callbacks/shares/paid invocation/background runtime effects across every alternate path | Pending outside this exact46 slice | Original Task03/architecture remain requirements; this candidate does not certify these service/client/transcript paths or whole Task03 |

## Issues Found

### Critical — blocks acceptance

**F1. WRITE-only bulk/orphan receipts disclose private stored resource identifiers.** `convex-dev/agents.ts:78`, `convex-dev/contexts.ts:144`, `convex-dev/contexts.ts:152`, `convex-dev/contexts.ts:156` return identifiers obtained from stored rows or descendants without independent READ admission. With a verified grant containing only WRITE and ADMIN, status-based `agents.unregisterMany` returns a stored agent ID absent from the request; filter-based `contexts.updateMany` and `deleteMany` return stored context IDs; `deleteContext(orphanChildren=true)` returns a stored child ID absent from the request. These are actual successful handler return values, not hypothetical logger behavior. They violate the explicit WRITE-only receipt restriction; ADMIN is independently retained and cannot imply READ. Raw proofs are the first four cases in `probes.stdout.json`. Fix by preflighting/retaining independent READ for every value to be disclosed, or returning a contractually safe opaque receipt when READ was initially unavailable. Preserve atomic denial/rollback if admitted READ is lost later. Add WRITE-only filter/cascade/orphan and late READ-loss assertions.

**F2. Child creation commits a graph that the API cannot subsequently read or repair.** `convex-dev/contexts.ts:81` validates only the existing parent graph; `:88` and `:90` insert and patch without checking the resulting node count against the bound at `:22`. A valid 100-node chain passes `getChain`, then `create(parentId=node-99)` commits a depth100 child and parent revision. The tree now has 101 rows; subsequent `getChain` throws FORBIDDEN. The fixture transaction records two committed writes rather than pre-effect denial/rollback. Raw proof: `graph-boundary.stdout.json` (beforeTotalNodes100, totalPersistedNodes101, writes2, failed after-read). Include the pending child in complete graph preflight, with a 99→100 success control and 100→101 denial before the first effect; check both readable and initially WRITE-only create paths.

### Important — address in the bounded repair

**F3. Ordinary canonical `.unique()` errors expose internal private document identifiers and remain unstructured.** `convex-dev/runtimeRegistryAuth.ts:209`, `:217`, `:260` call `.unique()` before `uniqueKey`'s catch at `:293`. With duplicate same-owner canonical rows and WRITE+ADMIN but no READ, all three public update handlers emit the native Error containing both internal `_id` values. Installed native source `node_modules/convex/src/server/impl/query_impl.ts:334-342` confirms that this is the real Convex1.46 error contract; fresh probes reuse its installed dist implementation. The candidate fixture's `unique` at `tests/unit/runtimeRegistryAuth/fixture.ts:53` substitutes a generic identifier-free error, so its existing duplicate negatives conceal this output difference. Normalize known ambiguous canonical lookup errors to opaque structured denial and assert serialized errors contain neither IDs nor payload/source/control values. Live transport masking was not exercised; this finding is the actual handler error plus native dependency, not a claim of a production request made here.

**F4. The staged conversation seam does not distinguish capability-not-ready from access denial.** `convex-dev/runtimeRegistryAuth.ts:345` returns default FORBIDDEN even for a valid verified authorized caller when the trusted canonical owner adapter is unavailable. This preserves privacy and is not a transcript bypass. The handoff expressly allows staged CAP_NOTREADY before transcript hydration; use that explicit typed capability error after authority checks, and retain separate FORBIDDEN for absent/invalid authority. No positive canonical conversation/anchor certification is warranted.

**F5. Root integration remains incomplete, with introduced failures clearly attributable.** Independently observed candidate root tsc28/lint26, pinned-base root/lint1, accepted-main root/lint0. Candidate introduces 25 SDK assumptions that register/update always return private rows and two public cleanup references removed by required purge internalization. The separate pinned-base governance diagnostic is historical to a2c982 and already fixed on accepted main; it is not current-main preexisting. This is a staged integration blocker owned by Task03C2/09, not an invitation to restore public purges or cast away the receipt union. Raw comparison: `diagnostic-comparison.json` and all six diagnostic streams.

### Minor

The compact multi-statement implementation style makes subtle preflight and delivery omissions harder to audit. No formatting change is required to resolve this verdict; keep any repair narrowly within ownership.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 2/5 | Required WRITE-only resource protection and whole-graph create preflight are not met |
| Code Quality | 3/5 | Strong retained refs/native serialization; unsanitized lookup errors and omitted post-create graph bound |
| Test Quality | 3/5 | 337 meaningful outcome tests, no skips, but missing WRITE-only bulk/orphan and graph limit creation negatives; fake unique masks native error IDs |
| Pattern Adherence | 4/5 | Native registrations/schema/indexes/frozen authority reuse and additive ownership observed |
| Completeness | 3/5 | All bounded registrations reachable; current defects and declared SDK/cleanup integration remain unresolved |

**Average: 3.0/5.** REJECT follows the rubric's any-dimension≤2 threshold and missing READ authorization for private receipt disclosures. Several positive dimensions do not offset a critical failed requirement.

## Test Coverage Analysis

| Behavior group | Meaningful coverage | Residual gap |
|---|---|---|
| All43 public handlers | Native validators/visibility, missing auth, forged subject/tenant, explicit valid-authority outcome; fresh six issuer/control scenarios each | Conversation positive delivery is explicitly pending |
| Individual create/edit private return | No-READ opaque receipts; admitted independent READ revoked at insert/patch rolls back; exact local insertion expectations | Bulk/filter/orphan delivery not gated by READ (F1) |
| Bulk targets and source shapes | Missing/foreign/tombstoned/duplicate/malformed/version/history/native-invalid cases; zero first effects/rollback | Native ambiguity error contract differs from fake fixture (F3) |
| Graph selection/edit/retirement | Cross-space grants, missing/ambiguous/cyclic/depth/owner/topology links, later grant/row witness changes, orphan repair and overlapping cascade | Create at full100-node graph not covered (F2) |
| Native data/exports | int64/bytes/special floats/signed zero/null/root/deep/merge/archive/history/export plus exact changed binary/int64 witnesses | No service-native transport/size qualification claimed |
| Deletion/internal purge | Retained controls/sources/metadata/tombstones/epochs; late retired fence/owner change rollback; blocked later revival | Derived cascade and real background service lifecycle explicitly pending |

## Exact Freeze and Preservation

Independent `final-freeze-verification.json` confirms all33 source hashes match the declared FINAL freeze and remain unchanged, all364 canonical QA hashes (including historical failures/corrections) remain unchanged, Git status remains unchanged, and the actual schema patch byte-matches the declared exact additive patch.

Declared source-freeze SHA256: `4af7261badb96b6ac87ea00c6302a0a3464d51f461bf2dc39a87caeb70e7862c`.

| Owned file | SHA256 |
|---|---|
| convex-dev/agents.ts | eb221ff828a0d7d382af833d4e9300dfd18c24775700a243739c959d2eb2975c |
| convex-dev/memorySpaces.ts | c7d8449ba1ac4dc9afedea76f78dc021ad5eeb2db1f7fba10cbe9a91e3cf3939 |
| convex-dev/contexts.ts | f5c463e6216d5001b51f92b1c553607bd5344fd2eba5045cb7b4b01dc29f0059 |
| convex-dev/runtimeRegistryAuth.ts | a95e1662a32ada540f1da4a9513405983d13f304095980aceb147001c9c76fe6 |
| convex-dev/schema.ts | 4863a3445f58692a7f5b264c880cb069783971be0182fc0dfe77010111fc5e93 |
| tests/unit/runtimeRegistryAuth/adversarial.test.ts | 14ed46d24493036d855edce6cd6b68501febc8d2483962988efb3bad93b80c1a |
| tests/unit/runtimeRegistryAuth/catalog.test.ts | 0ce1d029a2bfb2de957c78432ab5661b07af9ebe498160e17698a9b2a123d281 |
| tests/unit/runtimeRegistryAuth/fixture.ts | 7117fc8df3c21e7f1eee3f240f43b45d8010b4750490297386b496d48d787ec3 |
| tests/unit/runtimeRegistryAuth/registered.test.ts | 53285e7c6665ce5de9b39964fd07ceeb38bc3fd5282e08575b3d97f9a2db4a7c |

Installed native Convex version1.46.0, value codec SHA256 `f38318738cbb17bfb7826c6baecefd042f0ee32c973c0ece410079a5886f53f0`, native QueryImpl SHA256 `cb338c5d58d0ffbbdd311954e24456d7fa501f901b205784ce93d67e63206857`.

## Unresolved Coverage and Recommendation

Repair F1–F3 within the exact owned candidate, clarify the explicit not-ready seam F4, rerun meaningful affected checks and obtain a fresh independent judgment. Complete SDK/cleanup adaptation under its separate ownership before claiming an integrated root gate.

Keep stats2, A2A4, whole03B2B52, MF/source bridge, positive canonical conversation/anchors Task03T/05, derived cascade Tasks08/12/15, SDK/cleanup Tasks03C2/09, wholeTask03 and wholeGoal pending. This review provides offline registered-handler/transaction evidence only; live JWT signature/audience configuration, real subscriptions/private byte delivery, background/service revocation, paid inference and deployed canonical anchors were not executed or certified. The narrow collision existence exception is accepted as described; it does not authorize broader foreign payload hydration or private output.

Independent artifact hashes and command/probe records are enumerated in `manifest.json`. This FINAL judgment supersedes only this reviewer's preliminary messages; it is not a permission request or an implementation change.
