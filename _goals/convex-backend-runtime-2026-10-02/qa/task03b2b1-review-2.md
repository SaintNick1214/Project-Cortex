# FINAL SECOND Task Judgment: Task03B2B1 registry/context exact46

## Verdict: REJECT

The first-cycle stored-ID disclosure, graph overflow, installed native ambiguity and staged conversation defects are repaired in the inspected frozen candidate. The broader original failure-envelope requirement is still unmet: the shared sanitizer is neither exception-safe nor a stable exact-envelope classifier. Actual registered handlers leak a synthetic private diagnostic through escaping getter failures and through a public structured error code. An unexpected backend error with a hidden additional field can also be suppressed into a successful write receipt.

This is the SECOND independent original-scope review, not a whole03B2B52, Task03, SDK integration, live-service or goal verdict. It does not certify the excluded stats2/A2A4 registrations. Review is bounded to the exact authorized46: agents10, memorySpaces14, contexts22;43 public and3 trusted internal operator purges. The candidate is pinned at `a2c9827783e9dd49b9811a2899ba4acbeadc21cd`. No candidate/main source, test or canonical QA edits, stage/commit/deploy/codegen/service/model/network/Docker operations were performed. All review artifacts are in `/tmp/task03b2b1-review2-onz6ay2u`.

## Evidence Review

Read main AGENTS.md, .agents/CODEX-RUNTIME.md, PROJECT-PROFILE.md, pessimistic-judge, judge-task and feature-orchestrator. Read original goal, Task03 authorization, authoritative decisions and architecture, including authorization/canonical transcript/deletion constraints. The execution authorization overrides historical planning-only disclaimers; this review does not request permission.

Read actual `runtimeRegistryAuth.ts`, agents.ts, memorySpaces.ts, contexts.ts, all three owned schema blocks and frozen runtimeAuth dependency; read all five fixture/test files. Read report/contracts/requirements mapping, freeze/manifests/preservation, exact schema patch, codec/query dependencies, repair notes and raw check/probe records. Read full original FINAL REJECT3.0 in main and original cycle1 source/QA/independent evidence. Independently verified all2286 original judge records still exist with matching hashes and sizes: the2234 reproducible private compiled-cache records are preserved, not silently omitted as missing selected evidence. The archive's450 records independently match.

Actual unchanged ES2021-library backend compilation passes. Exact scoped ES2021 compilation, scoped ESLint with max-warnings0, actual discovery,480 tests/4 suites/0 skipped/0 todo, exact regenerated native AST catalog and diff-check pass. The first relocated owned-temp scoped config failed TS2688 because its implicit typeRoots resolved in /tmp rather than the checkout; that failed receipt is retained. Rerunning the exact frozen scoped config without writes passes. This is a reviewer relocation error, not a candidate failure or a compiler uplift.

Original independent258 authority probes and8 native receipt/error probes rerun byte-exact and pass. Original graph exploit remains unchanged and exits1 at corrected INVALID_INPUT (it assumes the prohibited101st insert succeeds); it is not relabeled ordinary PASS. The asserted repaired graph runner passes all4 READ+WRITE/WRITE-only99→100/100→101 cases. All original337 per-suite ordered names and multiplicity remain among480:108 adversarial,222 registered,7 catalog plus143 closure-repair outcomes; the original302 distinct displayed names include frozen duplicates.

Fresh independent fault probes execute the actual registered native handler objects and use reached injection and committed-effect assertions. `accessor-probes.stdout.json` has88 reproduced failures:46 initial driver-read message getters;24 actual first write attempts;18 three-module initial canonical/first-write/post-effect ConvexError data/code getter cases. All injected paths are reached; attempted effects roll back to zero committed writes. `stateful-envelope-probes-final.stdout.json` asserts9 cases emitting private structured codes and3 hidden-extra backend faults adopted into successful receipts/one committed write.

These exception shapes are deliberately synthetic. They are not claimed to be emitted by installed QueryImpl.unique, nor directly attacker-controlled user input. The real installed Convex1.46 unique error is an ordinary Error; its diagnostic sanitization now passes independent native probes. No deployed transport or live leakage request is claimed. The failures are directly observable registered-handler contract violations of the requested unexpected-runtime/private-error boundary, including a real ConvexError produced by the candidate with the private marker in its public data.

## Critical Issue C1: classification itself can fail, reread untrusted fields, or suppress unexpected backend errors

Location: `convex-dev/runtimeRegistryAuth.ts:18`,`:19`,`:21`,`:22`,`:24`,`:31`,`:56`,`:58`, with `optionalRead` suppression at`:182`.

1. `operation` calls `safeErrorCode(error)` and then reads `error.message.startsWith(...)` inside its catch without any protective classification boundary. A throwing Error.message accessor becomes an uncaught new Error carrying its private diagnostic. The same occurs when ConvexError.data or data.code throws during canonical read/first-write/post-effect classification. The operation's finally removes the attempted-effect marker, but no REGISTRY_OPERATION_FAILED envelope is produced. All46 selected registrations reproduce the first read case; all24 mutations reproduce a reached first-writer rejection; first/later writes roll back but the public outcome contract and private-error protection fail.
2. `safeErrorCode` reads data.code three times. A getter can return `FORBIDDEN` during both validation reads and `private-driver-payload-in-public-code` on the final return. All three update handlers then emit a newly constructed ConvexError whose data.code and message contain the private marker. Canonical read returns outcome not_dispatched; first attempt/post-effect reload returns rolled_back. Those accurate outcomes do not make the private code safe. Nine independently asserted actual-handler cases reproduce this.
3. `Object.keys(shape)` does not enforce all own keys. An exact-looking FORBIDDEN envelope with a non-enumerable `privateDriverPayload` is accepted. Injecting that error at the initial optional READ of each module produces an opaque success receipt and commits the write instead of REGISTRY_OPERATION_FAILED. The three independent assertions prove reached faults, exact safe-receipt return and one committed write even though the caller originally has READ. This contradicts the required narrow control-reader protection against unexpected permission-looking backend failures becoming successful receipts. Enumerable private extras are covered and correctly rejected by candidate tests; hidden-own extras are not.

Recommended bounded repair: treat all thrown values and their properties as untrusted diagnostic data. Make classification total and failure-safe. Admit only static own data descriptors with the exact allowed key set and fixed validated code/message combinations, retaining a once-read validated code. Guard instanceof/prototype/descriptor/message inspection against throwing proxies/accessors, rejecting accessor or extra-field shapes to the generic operation failure. Preserve the separate unexpected/authority/input/readiness codes, exact native ambiguity handling and effect-attempt outcomes. Add meaningful registered-handler tests at pre-effect, first attempted write and post-effect reload, plus optional-READ control failures; do not remove the boundary, weaken output restrictions or restore private IDs/public purges. Obtain the required fresh third review after a frozen repair.

## Requirements Review

Original Task03 covers identity/client credential attachment, trusted grant/bootstrap, all alternate paths, canonical transcript locks, background revocation and subscriptions/bytes/callbacks/shares. Only its specified registry/context46 portion is eligible for this bounded acceptance. Other original requirements remain pending explicitly.

| Original/bounded requirement | Result | Concrete evidence |
|---|---|---|
| Separate bounded03A/03B/03C; frozen03A identity/grant contracts preserved | Met for dependency/slice | runtimeAuth/verified/schema hashes equal pinned base; broader03C/full03 pending |
| Exact selected46 inventory/native validators/43 public+3 internal | Met | regenerated catalog exactly equals frozen catalog; registered tests counts/visibility/argument validators |
| Exact verified issuer+subject; trusted membership/grant generation/current tenant/actual-space epochs | Met offline | frozen resolveAuthority/reference; all43 missing/forged subject/tenant negatives;258 unchanged issuer/deleted principal/revoked membership/grant/tenant epoch/space deletion assertions |
| Omitted selectors derive one eligible scope; ambiguity denies before domain reads | Met | original omitted-selector and native authority tests; no labels provision scopes |
| Owner-before-ordinary hydration, filters, limits, counts | Met within exact Boolean exception | scoped owner filters in agentAt/spaceAt/contextAt and enumerable paths; foreign-first traces in all3 modules |
| Labels/config/participants/access metadata are descriptive | Met | owner derives verified principal; control-table equality; grantAccess independently admits actual target-space grants/metadata |
| Independent WRITE+ADMIN registry control and READ private config/output | Met for repaired resource outcomes | optionalRead/readAll pin distinct READ; native single capability negatives; initial noREAD private-safe receipts |
| Stored-ID status/filter/cascade/orphan output requires pre-effect independent READ | Met |20 initial none/owner-denied/partial/all cases; retained partial READ20 before/after revocations;5 owner-narrowing after effects; original8 probes now no leaks |
| Initially absent READ may use count/opaque receipt; admitted READ never downgraded after late loss | Met apart from unexpected backend fault suppression C1 | cached first decisions and retained refs; actual insertion/patch/retirement rollback tests; hidden-extra driver error improperly creates receipt |
| Every public/internal unexpected error is opaque, distinct failure rather than permission/success | Not met | C1:88 raw accessor escapes;9 newly constructed private-code ConvexErrors;3 unexpected-fault successes |
| Known exact safe authority/input/readiness outcome not_dispatched; attempted-write failure rolled_back | Partial | normal static/native errors pass all selected paths/24 mutation attempts; C1 classifications escape or accept unvalidated private code |
| Same-key foreign/unowned collisions cannot be adopted or affect deletion | Met | Boolean conflict/unique witnesses;2 create/6 edit-retirement/late-bulk collision cases; original native duplicate probes opaque |
| Complete duplicates/canonical schema/native input/version/history/topology preflight before first effect | Met for normal input | missing/foreign/tombstoned/duplicate/malformed bulk, invalid native classes/cycles/int64overflow, version/history overflow, participant collision; resulting graph bound repaired |
| Immutable first source/control/row/version/lifecycle through later admission/await/effects | Met for inspected contract | witness refuses rebind; exact expected patches/insertions; final matching sweeps; repeated-root/payload/grant/topology/retirement/tombstone negatives |
| Locally computed inserts and exact patches/retirement known before post-write reread | Met | inserted retains native returned ID plus validated local payload before await; excludes only server _creationTime; all3 create paths READ/noREAD rebind/collision controls |
| Whole context graph actual-space grants/owner/version/lifecycle/root/parent/depth/edges | Met | whole-root graph preflight, cross-space positive/revoked peer, cycle/duplicate/missing/depth/owner/ambiguous negatives |
| Resulting graph stays within100 before child insert/parent patch | Met |99→100 readable;100→101 INVALID_INPUT/0 attempts under READ+WRITE and WRITE-only; unmodified exploit rejects |
| Current revision actor verified; previous unknown actor not fabricated | Met | revision persists principal; cross-principal writer !=owner; prior writer retained/unknown remains undefined; child/orphan/cascade/retirement assertions |
| Every descriptive target edge requires actual trusted target-space grant/metadata | Met | graph target checks and grantAccess; stale descriptive target denial; no trusted control mutation |
| Orphan/cascade/bulk repair complete topology and preflight overflow; overlap once | Met | descendants root/depth, parent child-list repair, attributed revisions,2 overlapping tombstones exactly once |
| Scope/resource retirement plus epoch prevents revival including tenantwide grants | Met | retained resource READ/WRITE/ADMIN refs and exact tombstone-reader exception; late row/fence/owner/partial-read changes rollback; scoped+tenantwide bootstrap/register/reactivate deny |
| Space deletion retains controls/source/current refs; cannot waive principal/grant loss | Met | exact expected scope epoch/timestamp witness and final principal loss rollback after3 writes; auth/source rows retained |
| Derived deletion is explicit pending rather than unsafe raw cascade | Met as staged seam | pending08/12/15/zero derived deletion counts; actual durable cascade remains pending |
| Operator purges native internal rather than public | Met |3 internalMutation native flags; actual internal outcomes preserve controls/source/metadata barriers; not callable through public api |
| Canonical conversation ownership/anchors before transcript/private hydration | Staged safe capability; positive pending | valid/current READ+final fences→CAPABILITY_NOT_READY/zero raw conversation hydration;5 missing/invalid/absent/valid/late revoked controls;03T/05 owner/anchors positive pending |
| Native v.any compatibility, bytes/int64/special floats/-0/sorted object witnesses | Met | official codec dependency exact; create/edit/get/list/search/history/export/root/depth55/archive/merge/replacement positives; binary/int64 changed witness rollback; invalid class/cycle/int64overflow denies |
| No invented JSON-only/depth50 restriction | Met | old Infinity denial preserved only historical specification correction; native-valid values stay available; cycle2 keeps original native correction evidence |
| Narrow authorized-key Boolean collision exception immediately discards fetched foreign payload | Met as documented | no indexed projection in Convex1.46; exact tenant/actual-space/key; only existence/uniqueness retained, no ownership adoption/process/log/output; ordinary owner constraints preserved |
| Additive schema13 only owned3 blocks; auth/generated/SDK/config/stats/A2A untouched | Met | actual diff exactly equals frozen13-line patch,0 deletions;19 independent preserved source/base comparisons; all37 freeze/864QA/450archive hashes |
| Original failed judgment/evidence/tests not weakened or deleted | Met |2286 raw originals hash+size;450 archive;337 ordered/multiplicity preserved; only explicit staged-capability/raw-private-error expectation corrections, reached injection/rollback retained |
| Affected backend/scoped lint/types/discovery/tests observed | Met | exact ES2021 backend/scoped compile; ESLint0;480/4 suites/0skip/todo; catalog/diff0; raw argv/cwd/UTC/exits |
| Honest SDK/root diagnostic separation | Met in reporting; integrated SDK remains pending | candidate root29/lint27; exact pinned archive1/1; current accepted-main archive0/0;26 SDK assumptions+2 cleanup+historical isolated governance1 separately attributed |
| Refreshed clients, private subscriptions/bytes/callbacks/shares/paid runtime across all paths | Pending outside gate |03C2/09,03T/05,08/12/15,MF/source bridge,stats2/A2A4 and full03/goal remain pending |

## Selected native function review — all46

Each public row below has actual native registration/validators, missing-auth, forged-subject, forged-tenant and explicit valid-authority outcome assertions in registered.test.ts plus six independent issuer/control denials. All selected rows share the C1 unexpected-error boundary defect; this column does not silently certify them as PASS. Internal rows have native internal visibility and trusted operator outcomes; all46 reached private-read fault probes are retained. Authoritative line/registration count is independently regenerated catalog.

| Path | Kind | Source line | Functional/scope outcome | Failure-boundary result |
| `agents:count` | query | convex-dev/agents.ts:25 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `agents:exists` | query | convex-dev/agents.ts:16 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `agents:get` | query | convex-dev/agents.ts:12 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `agents:list` | query | convex-dev/agents.ts:20 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `agents:purgeAll` | internalMutation | convex-dev/agents.ts:82 | Trusted internal retirement; source/auth retained | C1 raw accessor fault reproduced |
| `agents:register` | mutation | convex-dev/agents.ts:29 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `agents:unregister` | mutation | convex-dev/agents.ts:59 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `agents:unregisterMany` | mutation | convex-dev/agents.ts:67 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `agents:update` | mutation | convex-dev/agents.ts:46 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `agents:updateMany` | mutation | convex-dev/agents.ts:52 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:addParticipant` | mutation | convex-dev/contexts.ts:98 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:count` | query | convex-dev/contexts.ts:174 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:create` | mutation | convex-dev/contexts.ts:74 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:deleteContext` | mutation | convex-dev/contexts.ts:143 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:deleteMany` | mutation | convex-dev/contexts.ts:157 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:exportContexts` | query | convex-dev/contexts.ts:209 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:findOrphaned` | query | convex-dev/contexts.ts:192 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:get` | query | convex-dev/contexts.ts:161 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:getAtTimestamp` | query | convex-dev/contexts.ts:205 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:getByConversation` | query | convex-dev/contexts.ts:187 | CAPABILITY_NOT_READY before raw conversation reads; positive pending | C1 raw accessor fault reproduced |
| `contexts:getChain` | query | convex-dev/contexts.ts:177 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:getChildren` | query | convex-dev/contexts.ts:183 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:getHistory` | query | convex-dev/contexts.ts:204 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:getRoot` | query | convex-dev/contexts.ts:180 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:getVersion` | query | convex-dev/contexts.ts:201 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:grantAccess` | mutation | convex-dev/contexts.ts:102 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:list` | query | convex-dev/contexts.ts:168 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:purgeAll` | internalMutation | convex-dev/contexts.ts:220 | Trusted internal retirement; source/auth retained | C1 raw accessor fault reproduced |
| `contexts:removeParticipant` | mutation | convex-dev/contexts.ts:101 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:search` | query | convex-dev/contexts.ts:171 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:update` | mutation | convex-dev/contexts.ts:93 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `contexts:updateMany` | mutation | convex-dev/contexts.ts:148 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:addParticipant` | mutation | convex-dev/memorySpaces.ts:34 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:archive` | mutation | convex-dev/memorySpaces.ts:38 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:count` | query | convex-dev/memorySpaces.ts:82 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:deleteSpace` | mutation | convex-dev/memorySpaces.ts:50 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:findByParticipant` | query | convex-dev/memorySpaces.ts:85 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:get` | query | convex-dev/memorySpaces.ts:68 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:list` | query | convex-dev/memorySpaces.ts:76 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:purgeAll` | internalMutation | convex-dev/memorySpaces.ts:94 | Trusted internal retirement; source/auth retained | C1 raw accessor fault reproduced |
| `memorySpaces:reactivate` | mutation | convex-dev/memorySpaces.ts:42 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:register` | mutation | convex-dev/memorySpaces.ts:19 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:removeParticipant` | mutation | convex-dev/memorySpaces.ts:37 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:search` | query | convex-dev/memorySpaces.ts:88 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:update` | mutation | convex-dev/memorySpaces.ts:31 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |
| `memorySpaces:updateParticipants` | mutation | convex-dev/memorySpaces.ts:43 | Observed expected authorized result; exact scope/denial controls | C1 raw accessor fault reproduced |

## File Review

| File/group | Independent inspection and result |
|---|---|
| runtimeRegistryAuth.ts | Scope/owner/refs/witnesses/native codec/expected insert-retirement checks inspected; C1 shared error classification blocks acceptance |
| agents.ts |9 guarded public+1 internal selected; independent ADMIN+WRITE/READ, status-ID correction, complete bulk plans/retirement; excluded computeStats unchanged/pending |
| memorySpaces.ts |13 guarded public+1 internal; current actual scope/owner, description-only participants, native metadata/search, exact epoch/tombstone space retirement; excluded getStats unchanged/pending |
| contexts.ts |21 guarded public+1 internal; actual-space bounded graph, resulting child bound, READ IDs, actor/history, hierarchy repair, staged capability; positive conversation/anchors pending |
| schema.ts owned3 blocks |13 additive lines byte-exact cycle1,0 deletions; no other schema changes |
| fixture.ts |Real installed QueryImpl.unique delegated take(2), native codec/undefined patch behavior, actual transaction rollback and reached read/write seams |
| registered.test.ts |Exact46/43 and native validators/internal flags;222 cases cover missing/forged/valid expected outcomes and retained controls |
| adversarial.test.ts |108 original cases retained ordered; outcome-based assertions across owners/capabilities/bulk/graphs/retirement/values; two justified public-error expectations corrected, effect assertions retained |
| closureRepair.test.ts |143 focused cycle2 outcomes cover first F1–F4 repairs; accessor/exact-descriptor boundary family absent, C1 independently reproduces |
| catalog.test.ts |7 native schema/catalog/preservation/late space barrier cases; owned temporary catalog always cleaned |
| Frozen deps/config/client/generated/A2A/stats |Independent exact base/dependency hashes and schema diff checked; these are preservation, not broader behavioral acceptance |

## Actual Check and Diagnostic Results

Every command's exact argv, explicit cwd, UTC start/end, raw stdout/stderr and exit is in `commands.json`, `probe-commands.json` and `comparison-commands.json`. npm commands used the private npm12 cache with `npm_config_offline=true`, existing candidate deps, Node24.19.0/npm12.2.0/Convex1.46.0; no install/network call. npm12 notices are preserved, not interpreted as diagnostics.

| Check | Observed exit/result |
|---|---|
| node/npm versions |0 / v24.19.0,12.2.0 |
| Actual unchanged convex-dev/tsconfig.json tsc --noEmit |0; unchanged ES2021 lib |
| Owned-temp relocated scoped tsc |2; TS2688 caused by reviewer /tmp implicit typeRoots; raw retained |
| Exact frozen scoped ES2021 config tsc --noEmit rerun |0 |
| Scoped ESLint --max-warnings=0 |0 |
| Actual Jest discovery |0;4 specific suites |
| Native registered-handler Jest |0;480 passed,4 suites,0 skipped,0 todo |
| Catalog reproduction to owned temp/diff |0;exact46/43/3/48/2/0 and exact JSON equality |
| git diff --check |0 |
| Original unchanged authority probes |0;258 asserted outcomes |
| Original unchanged native probes |0;8 results, no private stored/document-ID leaks |
| Original unchanged graph exploit |1;expected corrected INVALID_INPUT denial; not ordinary PASS |
| New asserted graph boundary controls |0;4 cases |
| Independent accessor fault reproductions |0;88 assertions prove remaining failure |
| Stateful/hidden-extra envelope reproductions, final strengthened run |0;9 public private-code leaks+3 unexpected-fault write successes asserted |
| Candidate root tsc diagnostic |2;29 diagnostics |
| Candidate lint-ts diagnostic |2;27 diagnostics |
| Exact pinned a2c982 root/lint archive |2/2;1/1 governance diagnostic |
| Accepted main a793b406 root/lint archive |0/0;0/0 diagnostics; own temporary archives removed |

Candidate root diagnostics independently count src/agents26, tests/helpers/cleanup2, src/governance1; lint has SDK26+governance1. Cycle1 introduced25 private-row receipt assumptions; cycle2 adds1 count-only unregisterMany assumption at src/agents/index.ts:730. Two cleanup failures follow required public purge removal. The isolated pinned governance error is already fixed on accepted main; it is not current-main preexisting. Fresh main HEAD advanced from the report's b3ebea observation to the independently checked a793b406 snapshot, then c01ea6f by final preservation through parent work; this reviewer changed none of them. Both gates for the archived a793b406 snapshot are green; no claim is made that this independently certifies later c01ea6f work. The declared root classification is accurate, and the integrated SDK gate remains pending. This review does not invite casts, fabricated rows/IDs, requiring READ for authorized WRITE or restoring public purges to conceal it.

## Exact Freeze and Preservation

Before and after verification must match all declared values; `before-preservation.json`, `after-preservation.json`, `independent-preservation.json`, `corpus-preservation.json` and `original-judge-record-verification.json` provide the records. Frozen source37, current QA864 and cycle1 archive450 match all hashes/sizes. Original raw judge2286 all match. Actual schema diff equals schema-additive.patch (13 additions/0 deletions);19 frozen source/base comparisons, native codec hashes and exact catalog JSON pass. No candidate Git status change occurred; main workspace/HEAD may advance through parent work, reported separately.

Source freeze UTC `2026-10-03T12:35:12.526058+00:00`, SHA256 `79d07762b40acc137bdf267632c5588c4979bb9655ebc2e9308ccdd2933b4b3f`.

QA evidence manifest SHA256 `13b7ed4d511ac782bb5d173767b08e4a07b1fc929cb57c3a4be4d41825bde072`.

Cycle1 preservation manifest SHA256 `19bf653d2f4f2b11c8ef6d32b6d11d04dd47243b385896578983ef8fed4bcf23`.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5 |Original all46 private unexpected-failure requirement fails; raw escapes, structured private code and swallowed backend faults independently observed |
| Code Quality |3/5 |Strong frozen authorization/native values/retained exact witnesses, but shared diagnostic classifier reads untrusted fields unsafely/repeatedly and incompletely |
| Test Quality |4/5 |480 meaningful native-handler outcomes/no skips with original337 preserved and repair matrices; independent accessor/exact-own-data family identifies residual gap |
| Pattern Adherence |4/5 |Native registrations/schema/indexes/frozen03A reuse/additive ownership/current offline configs preserved |
| Completeness |3/5 |46 reachable, known first defects repaired, but shared error-boundary contract incomplete; supporting SDK/cleanup explicitly pending |

**Average:3.2/5.** REJECT follows Requirement Fulfillment≤2 and the rubric's uncaught-public-error auto-fail. The synthetic fault limitation is explicit; successful normal/native checks do not erase a required unexpected-error contract failure. PASS requires Requirement Fulfillment5 and every dimension≥4.

## Recommendation and Practical Limits

Repair C1 within exact owned source/test files, freeze, rerun the failed fault families plus appropriate existing checks and obtain the fresh third independent original-scope gate. Preserve this second failure, all historical first failures/corrections and the complete original corpus. The three-cycle limit cannot turn a failed gate into PASS.

Keep stats2/A2A4, whole03B2B52, MF/source bridge, canonical conversation03T/05/anchor-positive, derived cascade08/12/15, SDK safe-receipt/cleanup03C2/09, whole03 and wholeGoal PENDING. This is offline actual-registration/transaction-fixture qualification. Real JWT signature/audience configuration, live target behavior, subscriptions/private bytes, background/external service revocation, paid inference, canonical deployed anchors and durable downstream cascade were not run or certified. The native codec and installed unique outcomes are actual dependency behavior; the fixture models atomic rollback and adversarial await seams without claiming a deployed transport.

The exact Boolean authorized-key existence exception is legitimate as documented for Convex1.46's lack of indexed projection, and does not waive ordinary owner restrictions or permit payload adoption. Broad root SDK integration remains pending despite scoped backend checks passing. Independent artifact hashes are enumerated in `manifest.json`; this FINAL verdict supersedes only this reviewer's preliminary commentary and messages.
