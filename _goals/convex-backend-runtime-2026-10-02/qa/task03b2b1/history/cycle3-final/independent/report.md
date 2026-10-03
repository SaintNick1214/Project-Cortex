# FINAL THIRD Task Judgment: Task03B2B1 original46 registry/context closure

## Verdict: REJECT

The first two reviews' documented defects and the third candidate's database-read/admission defects are repaired in the frozen candidate. The original unexpected-failure contract remains incomplete at the identity adapter. An exact permission-looking exception from ctx.auth.getUserIdentity during initial optional READ is suppressed, and each of the three update handlers returns a successful receipt with one committed write. The original contract prohibits an infrastructure failure from becoming a successful committed receipt. Passing 1,146 registry and 133 core assertions does not cover this callback.

This is the THIRD and last independent review of the SAME original46 scope: agents10 + memorySpaces14 + contexts22, comprising 43 public and 3 trusted internal registrations. It does not reset the cycle/gate, reduce scope, approve a fourth attempt, or certify stats2/A2A4, whole03B2B52, Task03, full17, SDK integration or live services. Candidate HEAD is a2c9827783e9dd49b9811a2899ba4acbeadc21cd. Candidate/main source, tests, configuration and canonical QA were read-only. All reviewer writes are under /tmp/task03b2b1-review3-20261003.

## Critical finding C2: the identity adapter can impersonate a policy denial and commit a receipt

Source: convex-dev/runtimeRegistryAuth.ts:108-109 obtains identity by awaiting ctx.auth.getUserIdentity outside controlRead. At :235-239, optionalRead suppresses an exact FORBIDDEN envelope from that call as though resolveAuthority had made a legitimate initial READ eligibility decision. Every database adapter operation is wrapped at :95-105, but this other awaited infrastructure callback is not. Static shape validation does not establish the exception's policy origin.

Independent identity-read-probe.mts invokes the actual registered agents.update, memorySpaces.update and contexts.update handlers with initially healthy independent READ/WRITE/ADMIN authority. The callback returns the same valid issuer/subject normally, then rejects once at the actual optional READ (identity call4/5/4 respectively) with a real installed ConvexError having only this exact own static envelope: version1, code FORBIDDEN, message Access denied, retryable=false, outcome=not_dispatched. The shape qualifies for the whitelist, and optionalRead caches false. The actual native writer fixture is reached exactly once; the transaction resolves normally and commits its patch. Each result is accepted=true with the requested resource ID, instead of a failed operation. No raw private payload is returned, but the success/commit outcome violates the required failure contract.

The strengthened independent identity-required-outcomes.mts executes all36 sites: three module updates × initial/optional identity read × four exact safe codes, plus three module creates × post-insert identity read × four codes. All36 injections are reached. The expected REGISTRY_OPERATION_FAILED failed/rolled_back outcome mismatches in all36; exactly three optional-READ FORBIDDEN cases produce a successful committed receipt. Other faults abort with the wrong policy/readiness code. The required-outcome command actually exits1 after preserving every observation, rather than labeling a reproduction's exit0 as success. Raw data: raw/identity-required-outcomes.stdout; raw/identity-required-outcomes.stderr; raw/identity-required-outcomes.command.json. The initial three observed receipts are retained separately in raw/identity-read-probe.stdout.

This is a deliberate synthetic infrastructure fault on the real callback seam. It is not asserted that the installed authentication syscall ordinarily emits that ConvexError, that a caller can control it, that production was attacked, or that any deployed data leaked. Installed node_modules/convex/src/server/impl/authentication_impl.ts merely awaits performAsyncSyscall and does not make registry READ policy decisions; its source is preserved in context/native-authentication_impl.ts. This has the same original origin-sensitive failure-to-receipt concern as the already repaired permission-looking database failures, and is not a new service or identity-adoption scope. The accepted runtimeAuth03ec dependency is not changed or disputed by this finding.

Bounded correction, if later authorized: protect the identity callback with the strict untrusted-read failure boundary before passing its returned identity to the resolver. Preserve null/missing identity and normal current grant/capability decisions in the resolver, independent READ-less receipts, all admitted READ pins, and failed/rolled_back effects. A thrown adapter diagnostic cannot be an optional-READ eligibility decision. No correction was made during this read-only review. The original maximum-three gate is exhausted and the candidate remains held.

## Evidence reviewed and actually executed

Read complete bounded review prompt, AGENTS, runtime/profile, pessimistic-judge, judge-task and feature-orchestrator; original implementation prompt, decision register, architecture, goal and all17 task files; original03A policy and foundation contracts. Read current and historical registry contracts, mapping, reports, all owned modules, schema patch, codec/query/auth native dependencies, test/fixture sources and reached outcome assertions. Both full FINAL REJECT3.0/3.2 reports and their raw findings were reviewed. All original authority/topology/value/retirement requirements remained part of the assessment.

All commands use explicit candidate cwd, installed local dependencies and own /tmp configurations/caches, with sentinel Convex URLs at127.0.0.1:1. No environment-file loader, network, service, model, credential-file read, signing, deployment, codegen, install, Git mutation or child-agent invocation was performed. Observed Node24.19.0, npm12.2.0, TypeScript6.0.3 and Convex1.46.0. The actual unchanged backend configuration retains ES2021+DOM libraries; no Object.hasOwn/Array.at/library uplift was introduced.

| Check | Actual result |
|---|---|
| Actual convex-dev/tsconfig.json backend types | exit0 |
| Own exact scoped registry types / scoped ESLint max-warnings0 | exit0 / exit0 |
| Own core types / core ESLint max-warnings0 | exit0 / exit0 |
| Independent discovery / ordinary registry assertions | exit0;9 suites;1,146 passed;0 failed/skipped/todo |
| Core actual local replay | exit0;3 suites;133 passed;0 failed/skipped/todo |
| AST native catalog / diff check / schema byte comparison | exit0;46/43/3/48/2/0; exact13 additions/0 deletions |
| Immutable original authority/native probes | exit0;258 /8 asserted outcomes |
| Current required graph/accessor/stateful/admission runners | exit0;4 /88 /12 /44 asserted outcomes |
| Immutable old graph/accessor/stateful finding collectors | exit1 each, expected historical assertion incompatibility; not PASS |
| Fresh independent exact-code DB adapter matrix | exit0;132 asserted initial/post-effect query/get/normalizeId failures +6 ordinary READ/noREAD positive controls |
| Fresh identity callback observations | exit0 reproduction;3 actual erroneous committed receipts, not a passing behavior gate |
| Fresh identity callback REQUIRED outcomes | exit1;36 reached;36 mismatches;3 erroneous committed receipts |
| Isolated root tsc / lint-type diagnostics | exit2 /2;29 /27 diagnostics; integration pending |
| Archive/freeze/ordered outcome/preservation verifiers | final exit0; reviewer path-assumption failures retained separately |

Registry multiplicities are222 registered +108 adversarial +143 closure +7 catalog = original480, plus366 failure-boundary +99 prior admission +99 strengthened admission +66 core ambiguity +36 low-level read-context =666 added, total1,146. Every original337/480 per-suite ordered fullName, including duplicates, remains among the final outcomes. Core is54 authority +15 provisioning +64 inventory =133; this is an actual run, not an inference from main925.

The literal old core fixture's133/120pass/13fail is preserved. All13 failures are query.take is not a function. Current accepted provisioning54aca only supplies the missing take seam and exact ambiguity/no-effect assertion; original ordered names remain. accepted-provisioning.diff and accepted-core.diff retain independent inspected differences. Pure policy/resolver/pruning bytes before the dedicated bounded-control helper are unchanged.

Historical pre-admission44 retains34 wrong selections and16 fixture commits; current44 reaches the controls and denies with0 domain effects/attempts/commits. Earlier native-unique admission receipts are bound to the original core. Final admission uses the accepted bounded take(2) protocol, while ordinary canonical QueryImpl.unique is still the actual installed mechanism. No historical native behavior is silently relabeled as the final dependency's mechanism.

## Complete original requirements review

Met below means observed within the authorized offline original46 contract; pending rows are neither dropped nor certified.

| Original/bounded requirement | Result | Independent source and outcome evidence |
|---|---|---|
| Preserve distinct03A/03B/03C contracts and original scope | Met for slice | Original03A contracts/types and exact46 mapping; broader03C/Task03 stays pending |
| Exact native46 paths;43 public/3 internal; correct exports and validators | Met | Full function table below; native registration exports and fresh AST catalog match final validation catalog |
| Exact trusted issuer/subject and principal lookup | Met normal policy | RegistryAccess.open/resolveAuthority; all43 missing/forged subject/tenant outcomes plus258 issuer/control negatives before domain hydration |
| Active raw generation uniqueness before capability/expiry/owner pruning | Met | Unchanged boundGrants/assertSingleActiveGeneration/materialize policy; actual54 authority cases and accepted133 replay |
| One eligible omitted scope; malformed/ambiguous controls cannot select a peer | Met for DB controls | Strict registryReader;99+99 admission assertions, healthy11 ambiguity,33 absent/revoked/expired positives and11 explicit selections; current44 zero effects |
| Trusted tenant/actual optional space/owner predicates before ordinary selection/hydration/limit/count | Met within documented exception | agentsIn/agentAt, admittedSpaces/spacesIn/spaceAt, contextAt/contextsIn; foreign-first traces and canonical owner negatives |
| Orphan/ownerless/foreign rows never adopted | Met | Canonical owner checks; create/edit/delete collisions and zero-effect negatives |
| Agent config/metadata/user/participants/access labels never provision grants | Met | Verified owner/user binding; unchanged trusted control-table snapshots; descriptive grantAccess requires actual target authority |
| ADMIN remains independent from READ/WRITE | Met | Agent READ+ADMIN and registry WRITE+ADMIN; no wildcard; selected capability negatives |
| Initially unavailable READ yields only safe opaque/count receipt | Met for real policy; FAIL for identity infrastructure | Original noREAD positives and fresh six positives pass; C2 turns an identity fault into that receipt |
| Stored IDs selected by status/filter/cascade/orphan require every independent pre-effect READ | Met for real policy | closureRepair20 none/ownerDenied/partial/all cases; arrays wholly omitted if any initial READ unavailable |
| Every admitted partial READ pinned; late loss aborts, never downgrade | Met |20 before/after effect revocations, peer-owner narrowing, separate READ generations, creation and retirement rollback |
| Every cross-space graph/access edge independently authorized before delivery/effect | Met | Actual-space scopes, canonical target space metadata, cross-space positive/peer revocation and ungranted descriptive-edge denial |
| Complete bulk keys/duplicates/collisions/history/version/native payload/topology preflight before first effect | Met | Target/revision plans; missing/foreign/tombstone/shape/collision/overflow matrices with0 first writes |
| First computed create/patch/retirement expectations before await; no reread rebind | Met | inserted/witness/expect; all3 create READ/noREAD payload/owner/collision faults and reordered-key positive controls |
| Every earlier canonical source/control/grant/version/lifecycle witness retained through final sweep | Met | fence/fenceRetiredSpace two matching full sweeps; repeated-root/earlier-source/retired-peer changes deny and roll back |
| Full context graph100/depth100, cyclic/missing/duplicate/orphan/foreign/tombstone denial | Met | graph/contextAt preflight and all topology negatives; entire root/children selected with actual authority |
| Child99→100 allowed and100→101 INVALID_INPUT before insert/parent patch under R+W and W-only | Met | Four current boundary assertions and immutable exploit exit1 at corrected denial |
| Current revision editor verified; archived prior writer preserved/unknown | Met | revision and lastUpdatedBy; cross-principal editor, prior unknown actor, child/repair/retirement outcomes |
| Orphan repair/root-depth/parent child lists; cascade overlap once; export/history full topology | Met | Deletion/revision plans and actual orphan/cascade/history/export native-value assertions |
| Exact retirement/tombstone timestamps/native payload/retained READ; no resurrection | Met | Retired resources/witnesses; row/resource fence loss and later-peer changes roll back; new calls cannot reuse retired access |
| Space delete W+ADMIN/canonical owner/reason/cascade/confirmation | Met | deleteSpace preflight and scoped/tenant-wide controls; exact matching optional confirmation |
| Exact resource fence and epoch increment/deletedAt; all other principal/grant/tenant controls current | Met | fenceRetiredSpace retains exact intended epoch/timestamp; final principal revocation after3 writes rolls back |
| Scoped/tenant-wide bootstrap/registration/reactivation cannot revive a deleted space | Met | Retained scope/tombstone and actual later operation negatives; core provisioning controls preserved |
| Derived deletion counts0/status pending/tasks08/12/15 honest | Met as staged seam | deleteSpace returns explicit pending/zero counts; no raw conversation/memory/fact/byte cascade |
| Internal purges are trusted operator-only and retain source/auth/control metadata | Met bounded contract | All3 native internal flags; anonymous internal fixture invocation is not public authorization; retained source/auth/tombstone outcomes |
| Native v.any bytes/int64/special floats/-0 and all application fields/history | Met | Official installed codec; actual create/edit/get/list/search/history/export/merge/archive/root/depth55 positives; exact binary/int64 changed witness rollback |
| Native invalid classes/cycles/int64 overflow deny; no JSON-only/depth50 invention | Met | Native-invalid preflight negatives; original Infinity-negative retained only as justified historical specification correction |
| ConversationRef/getByConversation require current READ/final fences, then CAPABILITY_NOT_READY before hydration | Met staged seam | conversationAt; valid/missing/forged/absent/late-revoked controls; no raw conversations/messages queried; actual anchors remain pending03T/05 |
| Documented exact-key Boolean existence/uniqueness exception discards payload and never authorizes/adopts/returns/logs it | Met | conflict/uniqueKey exact tenant/space/key probes; Boolean retained witness; ordinary queries keep owner predicates |
| All46 unexpected failures total and opaque; no private message/ID/stack/cause/code or successful receipt | FAIL overall | Descriptor/getter/Proxy/native unique families repaired, but C2 admits successful infrastructure-fault receipts |
| Exact safe own complete envelopes captured once; hidden/symbol/accessor/Proxy/extra/stateful fields cannot escape | Met descriptor boundary | classifyFailure captures descriptors/literals and never invokes diagnostics;366 assertions plus88/12 required replays |
| Low-level infra errors never permission pruning; pinned ambiguity only aborts final refs | Partial | All8 DB reader operations and132 independent DB faults strict fail; exact36 DB cases pass; identity callback remains unwrapped(C2) |
| Mark actual mutations before writer; unexpected beforeeffect failed, attempted rolled_back; zero commitments | Partial | effect and all24 first-writer/post-effect faults pass; C2 optional identity faults resolve normally and commit |
| Both rejections/old native corrections/original assertions preserved without weakening | Met |450+970 archives,2286+67 raw originals,337/480 ordered assertions and exact five old test/support files verified |
| READY1110/1146 and pre-fix44 raw observations preserved with real byte bindings | Met |42 source/48 raw READY1110 records and later1146 snapshots verified; old core source resolved explicitly via immutable cycle2 mirror |
| Qualified core/provisioning change only; no MF/unreviewed bridge | Met | Actual03ec/54aca bytes equal signed accepted022 Git blobs; two explicit parent receipts;35 original entries identical |
| Source count50 separate from46 registrations, original37=34 project+3 native | Met | Full sourceRecords verified;6 new registry files,3 core tests and4 added original codec artifacts explicitly counted |
| Unchanged actual backend ES2021; affected scoped types/lint/discovery/no skip/diagnostics honest | Met scoped; root integration pending | Actual gates and raw counts above; root29/lint27 separate |
| Refreshed clients, canonical unlocked transcript, subscriptions/bytes/callback/shares/runtime background and paid effects across whole03 | Pending outside original46 | Tasks03C2/05/08/09/12/14/15 and actual service qualification remain necessary; no wholeTask03/goal PASS |

## Complete native function mapping

Each public row has native validator/visibility, missing-auth/forged subject/forged tenant/authorized outcome,258 shared issuer/control negatives and the repaired unexpected DB/getter boundary. The three internal rows have native internal visibility and source/control-preserving operator outcomes. Targeted C2 observations below are additional actual callback evidence; a common helper defect does not mean an unexecuted per-path identity callback case was run.

| Original path | Native kind/source | Behavior and authority | Current outcome qualification |
|---|---|---|---|
| agents:count | query; convex-dev/agents.ts:25 | Independent READ+ADMIN; exact scope/owner/config delivery | Normal/native/DB-failure assertions pass |
| agents:exists | query; convex-dev/agents.ts:16 | Independent READ+ADMIN; exact scope/owner/config delivery | Normal/native/DB-failure assertions pass |
| agents:get | query; convex-dev/agents.ts:12 | Independent READ+ADMIN; exact scope/owner/config delivery | Normal/native/DB-failure assertions pass |
| agents:list | query; convex-dev/agents.ts:20 | Independent READ+ADMIN; exact scope/owner/config delivery | Normal/native/DB-failure assertions pass |
| agents:purgeAll | internalMutation; convex-dev/agents.ts:82 | Trusted internal operator retirement; retained metadata/source/auth fences | Normal/native/DB-failure assertions pass |
| agents:register | mutation; convex-dev/agents.ts:29 | Independent WRITE+ADMIN; whole target preflight; READ required for private row/stored-ID output | Normal/native/DB-failure assertions pass; C2 post-insert callback code mismatch, rollback0 |
| agents:unregister | mutation; convex-dev/agents.ts:59 | Independent WRITE+ADMIN; whole target preflight; READ required for private row/stored-ID output | Normal/native/DB-failure assertions pass |
| agents:unregisterMany | mutation; convex-dev/agents.ts:67 | Independent WRITE+ADMIN; whole target preflight; READ required for private row/stored-ID output | Normal/native/DB-failure assertions pass |
| agents:update | mutation; convex-dev/agents.ts:46 | Independent WRITE+ADMIN; whole target preflight; READ required for private row/stored-ID output | Normal/native/DB-failure assertions pass; C2 optional identity fault commits |
| agents:updateMany | mutation; convex-dev/agents.ts:52 | Independent WRITE+ADMIN; whole target preflight; READ required for private row/stored-ID output | Normal/native/DB-failure assertions pass |
| contexts:addParticipant | mutation; convex-dev/contexts.ts:98 | WRITE; complete topology/revision preflight; private values/stored IDs require independent READ | Normal/native/DB-failure assertions pass |
| contexts:count | query; convex-dev/contexts.ts:174 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:create | mutation; convex-dev/contexts.ts:74 | WRITE; complete topology/revision preflight; private values/stored IDs require independent READ | Normal/native/DB-failure assertions pass; C2 post-insert callback code mismatch, rollback0 |
| contexts:deleteContext | mutation; convex-dev/contexts.ts:143 | WRITE; complete topology/revision preflight; private values/stored IDs require independent READ | Normal/native/DB-failure assertions pass |
| contexts:deleteMany | mutation; convex-dev/contexts.ts:157 | WRITE; complete topology/revision preflight; private values/stored IDs require independent READ | Normal/native/DB-failure assertions pass |
| contexts:exportContexts | query; convex-dev/contexts.ts:209 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:findOrphaned | query; convex-dev/contexts.ts:192 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:get | query; convex-dev/contexts.ts:161 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:getAtTimestamp | query; convex-dev/contexts.ts:205 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:getByConversation | query; convex-dev/contexts.ts:187 | Current READ+final fences then CAPABILITY_NOT_READY;0 raw transcript hydration | Staged not-ready outcome only; canonical owner/anchor positive pending |
| contexts:getChain | query; convex-dev/contexts.ts:177 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:getChildren | query; convex-dev/contexts.ts:183 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:getHistory | query; convex-dev/contexts.ts:204 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:getRoot | query; convex-dev/contexts.ts:180 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:getVersion | query; convex-dev/contexts.ts:201 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:grantAccess | mutation; convex-dev/contexts.ts:102 | WRITE plus current target-space WRITE/canonical metadata; descriptive grant only | Normal/native/DB-failure assertions pass |
| contexts:list | query; convex-dev/contexts.ts:168 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:purgeAll | internalMutation; convex-dev/contexts.ts:220 | Trusted internal operator retirement; retained metadata/source/auth fences | Normal/native/DB-failure assertions pass |
| contexts:removeParticipant | mutation; convex-dev/contexts.ts:101 | WRITE; complete topology/revision preflight; private values/stored IDs require independent READ | Normal/native/DB-failure assertions pass |
| contexts:search | query; convex-dev/contexts.ts:171 | READ; complete canonical topology/owner/source/history checks | Normal/native/DB-failure assertions pass |
| contexts:update | mutation; convex-dev/contexts.ts:93 | WRITE; complete topology/revision preflight; private values/stored IDs require independent READ | Normal/native/DB-failure assertions pass; C2 optional identity fault commits |
| contexts:updateMany | mutation; convex-dev/contexts.ts:148 | WRITE; complete topology/revision preflight; private values/stored IDs require independent READ | Normal/native/DB-failure assertions pass |
| memorySpaces:addParticipant | mutation; convex-dev/memorySpaces.ts:34 | WRITE+ADMIN; descriptive registry edit; private return requires independent READ | Normal/native/DB-failure assertions pass |
| memorySpaces:archive | mutation; convex-dev/memorySpaces.ts:38 | WRITE+ADMIN; descriptive registry edit; private return requires independent READ | Normal/native/DB-failure assertions pass |
| memorySpaces:count | query; convex-dev/memorySpaces.ts:82 | Independent READ; actual spaces/owners; scoped lists/search/counts | Normal/native/DB-failure assertions pass |
| memorySpaces:deleteSpace | mutation; convex-dev/memorySpaces.ts:50 | WRITE+ADMIN; exact epoch/resource retirement; derived cascade pending08/12/15 | Normal/native/DB-failure assertions pass |
| memorySpaces:findByParticipant | query; convex-dev/memorySpaces.ts:85 | Independent READ; actual spaces/owners; scoped lists/search/counts | Normal/native/DB-failure assertions pass |
| memorySpaces:get | query; convex-dev/memorySpaces.ts:68 | Independent READ; actual spaces/owners; scoped lists/search/counts | Normal/native/DB-failure assertions pass |
| memorySpaces:list | query; convex-dev/memorySpaces.ts:76 | Independent READ; actual spaces/owners; scoped lists/search/counts | Normal/native/DB-failure assertions pass |
| memorySpaces:purgeAll | internalMutation; convex-dev/memorySpaces.ts:94 | Trusted internal operator retirement; retained metadata/source/auth fences | Normal/native/DB-failure assertions pass |
| memorySpaces:reactivate | mutation; convex-dev/memorySpaces.ts:42 | WRITE+ADMIN; descriptive registry edit; private return requires independent READ | Normal/native/DB-failure assertions pass |
| memorySpaces:register | mutation; convex-dev/memorySpaces.ts:19 | WRITE+ADMIN; descriptive registry edit; private return requires independent READ | Normal/native/DB-failure assertions pass; C2 post-insert callback code mismatch, rollback0 |
| memorySpaces:removeParticipant | mutation; convex-dev/memorySpaces.ts:37 | WRITE+ADMIN; descriptive registry edit; private return requires independent READ | Normal/native/DB-failure assertions pass |
| memorySpaces:search | query; convex-dev/memorySpaces.ts:88 | Independent READ; actual spaces/owners; scoped lists/search/counts | Normal/native/DB-failure assertions pass |
| memorySpaces:update | mutation; convex-dev/memorySpaces.ts:31 | WRITE+ADMIN; descriptive registry edit; private return requires independent READ | Normal/native/DB-failure assertions pass; C2 optional identity fault commits |
| memorySpaces:updateParticipants | mutation; convex-dev/memorySpaces.ts:43 | WRITE+ADMIN; descriptive registry edit; private return requires independent READ | Normal/native/DB-failure assertions pass |

## Changed source, wiring and preservation

runtimeRegistryAuth.ts is the only registry-owned third source correction. Its descriptor classifier, strict DB reader, reference-only ambiguity, native codec and final effect/retirement fences were inspected completely. agents.ts/memorySpaces.ts/contexts.ts retain the preceding repair bytes; their46 native exports remain wired through operation. schema.ts is the exact13-line additive patch in the three owned blocks, with0 deletions. No SDK receipt cast, fabricated private row/ID, implicit capability, public purge restoration, unreviewed runtimeMemory/Metadata/Worker import or generated-binding edit hides integration.

The qualified runtimeAuth03ec correction changes the three control uniqueness lookups to take(2) and exact AUTHORITY_LOOKUP_AMBIGUOUS; provisioning54aca is the separately accepted dependent fixture correction. Exact blobs match accepted commit022e2e3d61161766e90e91dd572bb9b7063d5957. Dependency receipts bind independent reportSHA b608adce3d20d8fdac98f8c2541c243dfa72616b6204e21ca1e7cf0dc6d8a94d and freezea3c4411d7add6a8ebd56d970b2054391856be10a5a9671f509ea9ca82de440a8. This is not a new registry cycle or unreviewed MF bridge.

Before, after and terminal snapshots independently match all50 FINAL source hash/size records and all322 third QA records. All2,160 files in candidate QA remain byte-identical across review. Candidate HEAD and Git status are unchanged. Preservation independently verifies450 first archive +970 second archive records;2,286 first raw records including2,234 original private reproducible caches +67 second raw records;35 identical original source/config/test/native entries;42 READY1110 source records and48 raw records; ordered337/480/1110/1146 outcomes; original five registry test/support bytes; literal core failures; and the exact additive schema patch.

READY1110 source bindings were verified using original locations for unchanged entries and explicitly named immutable mirror bytes for subsequent helper/core corrections. No copied-cache claim or fabricated omission is made. The two initial reviewer preservation-path assumptions (current core expected in READY location, and top-level cycle3 catalog assumed final) are recorded with their original verifier sources and failed streams; the final corrected verifier exits0. These are reviewer navigation errors, not candidate source failures.

Final authoritative catalog is cycle3/validation/catalog/selected-path-inventory.json and exactly equals this review's freshly generated catalog, including ce7a helper and03ec core hashes. Top-level cycle3/catalog retains earlier62a6/f298 hashes. Both have the same correct46 registrations, but the earlier one must be read as historical. This navigation ambiguity is a minor documentation observation, not the cause of REJECT.

Candidate FINAL report SHA256 f8353d0c35f7a1ae571aaacec3fc758c8ebc0d68e8712172f6744f9595e6caea.
Candidate FINAL source-freeze SHA256 5f2ca08969e62c6f5d3abf458f639b503eda6db4607c96390881a757d1a12530.
Candidate FINAL QA manifest SHA256 0f77a87fd1ae4b18689317ea521eec500990a8cb0d7ebfefa9b058826b74f67b.
Owned helper SHA256 ce7a0770803bef6b68440a0cd1b103228b2da20a5bf386a909a14d022101e8e5.
Qualified core SHA25603ec735f1791d2e9973a320e22dcc58d0f040432782398dcc95d0d65f99b0929.
Qualified provisioning SHA25654aca98b16f3ffb77d2d7740e986dfc68aa124e8baff56ae33486ccddc07b580.

## Main context and root limitations

Observed main began at022e2e3d61161766e90e91dd572bb9b7063d5957 and advanced through coordinator QA preservation commits. The terminal observed main HEAD is a19d5aaf42fe7b1cb870d8dfbb03552352864099. Main status has the separate memories/facts/schema/runtimeDataAuth and runtimeEndpointAuth fixture work; that status is recorded in full, without inferring global source or QA equality. The parent reported accepted harness QA-only commit b54bc105c9492732add2375315b4a1f889d825f4 and further QA receipts. This reviewer performed no main compiler/service run and does not certify later main state from a prior925 receipt.

Actual isolated root diagnostic counts remain src/agents26 +cleanup2 +historical isolated governance1 =29; lint types has SDK26 +governance1 =27. SDK private-row/count-only assumptions and public cleanup consumers remain pending03C2/09. The old governance error is already corrected on accepted main, so it is not called a current-main preexisting failure. No root PASS is claimed and no casts/public purge/READ wildcard are recommended to hide required receipt changes.

## Issues and dimension scores

Critical: C2 identity infrastructure fault can become a successful committed receipt; the original complete boundary claim is not met.
Important: isolated SDK/cleanup integration remains pending under separate scope; real services and canonical downstream seams remain unqualified.
Minor: historical/final catalog location ambiguity and compact multi-statement source style make audit navigation harder.

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5 | Required unexpected failure-to-receipt prohibition fails in three reached identity callbacks |
| Code Quality |3/5 | Stable total descriptor classifier and DB wrappers; missing identity infrastructure boundary allows safe-looking fault suppression |
| Test Quality |4/5 |1,146+133 meaningful outcome assertions, preserved original corpus; fresh callback family identifies uncovered failure origin |
| Pattern Adherence |4/5 | Native registrations/validators/indexes/schema/export wiring and explicit accepted dependency boundaries |
| Completeness |3/5 | Original46 reachable and earlier fixes retained; required public failure contract remains incomplete |

Average:3.2/5. REJECT follows Requirement Fulfillment≤2 and a requirement marked complete despite independently observed contradictory outcomes. No number of successful unrelated checks offsets this failed requirement.

## Remaining scope and handoff

Hold this original46 candidate; no integration or live certification follows this review. Do not reduce the gate to the passing classifier/database cases, relabel the new required-outcome failure, or automatically grant a fourth cycle.

Stats2, A2A4, whole03B2B52, MF/source bridge, canonical conversation/owner/message-anchor03T/05, transcript unlock/revisions, durable derived cascade08/12/15, SDK/internal-cleanup03C2/09, clients/runtime09/14/15, live all03, wholeTask03, full17 and the goal remain pending. Real JWT signature/audience/expiry configuration, target/graph/subscription/private-byte/callback/background/external-effect/paid model/UI outcomes were not run or certified. Native codec/QueryImpl/auth source observations and transaction-fixture assertions are explicitly offline evidence.

All commands completed before this FINAL. manifest.json enumerates the report, required source contexts, scripts/configurations, raw command/time/cwd/exit/unfiltered streams, discovery/test outputs, preserved failure receipts and reproducible caches with exact bytes/hashes and explicit exclusions. Candidate/main writes remain0. Reviewer writes stop at native FINAL.
