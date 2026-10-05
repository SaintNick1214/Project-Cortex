# Task Judgment: First actual Task03C2 original41 service qualification

## Verdict: FINAL REJECT — actual service qualification remains incomplete

Requirement Fulfillment2, Code Quality4, Test Quality3, Pattern Adherence4, Completeness2: **average3.0/5**. The preserved actual run discovered41, executed40, passed39, failed1 and dependency-blocked1, with0 todos. The failing sanitized-host-callback case has reason unexpected_unauthenticated; session-end-not-grant-revocation was never executed. It is neither a second failure nor a pass. This review does not supersede the accepted third offline readiness PASS4.6 or claim whole Task03/09/17 success.

The precise reproducible issue is the fixture’s immediate one-shot recovery query after a void asynchronous session notification, with a preceding native unauthenticated query result still cached. Actual accepted SDK/native code supports later recovery. No SDK source correction is established by this review. The actual receipt lacks subassertion, auth-transition and query-cache traces, so the particular cached-versus-inflight native state in the live failure is not proved. The source/native ordering conflict is established independently and reproduces without a service.

## Evidence review, integrity and preservation

Read the complete bounded prompt, AGENTS, runtime/profile, pessimistic-judge role, judge-task and feature-orchestrator skills; cloud-environment-runtime skill and read-only environment status. Read the approved implementation prompt, decision register, architecture, goal and all17 original task files. Read full accepted03A/03C1/metadata contracts and credential tests; metadata native-error follow-up and original41 endpoint mapping; current SDK metadata/session/governance requirements and relevant consumer tests. Read both complete rejected offline histories and the third accepted readiness report. Examined the entire actual fixture client, accepted deployed backend fixture and actual packed/source SDK credentials and index, actual operation receipts/private diagnostic, and installed native auth/query/cache code. Context and full raw reads are preserved here; tool display truncation does not imply missing raw files.

Canonical actual manifest SHA256 is **8659d4de0a9c8929e3fefd4065944026decc54cd07e9683eeb8d4b6b6038014d**. Verified every hash and byte count of47 records, the44 originals that are real paths,58 frozen public sources,199 SDK provenance rows plus tarball,14 per-row accepted backend Git bindings and the explicitly allowed private owned ledger. Three original labels are synthetic coordinator-auth-service-receipt labels rather than paths; their canonical records are verified. Accepted metadata core03ec/helper7ba6 bindings resolve to022e2e3d; source SDK bindings resolve to4fb3482c. All129 available SDK source/config rows match that accepted Git commit; all53 packed tar entries match qualified originals. Pack SHA256 is cd97dabc1428e2dc7f217bf316aff0d7bf4ebf0d843a214a5777a2228275193d.

Official generated api.js/api.d.ts/dataModel.d.ts/server.js/server.d.ts archive bytes match actual fixture originals. The140 copied compiler dependency files are regular files, exact matches to installed pinned TypeScript6.0.3 and the preparation receipt. Both rejected history manifests verify fully:280 and1304 saved records; respective199 and400 explicit historical reproducible private omissions were not reread. Third readiness report SHA256 independently matches **556643c11ca4a94a48a1c3d4ff91bdc185466a637e592c72db4db15193ffe9e4**.

Before/after freeze verifies496 relevant files and364 binding checks with0 mismatches and0 changed files. Additional2502 provenance/native/compiler/history bindings also remain unchanged. Private ledger binding is SHA2568f134ba514d9e642bc602a46c0732d98905a5cca9667c3d57eefbda3cf6a3212,19036 bytes; run/deployment,17 owned records,8 attempted scopes and32 operator operation names match the actual receipt. Ledger content is not copied or published.

Initial main HEAD was a1dcb487a732407d0cc15c2dd99835810ee579be; after-freeze HEAD is df49be9f2294e7c0538ea47d59e1546bff377612. The read-only Git diff confirms only coordinator QA summaries/current-gates and CI receipt additions advanced. Main dirty status remains the pre-existing facts.ts, memories.ts, schema.ts, runtimeDataAuth.ts and runtimeEndpointAuth tests. Relevant frozen sources/receipts are unchanged; global HEAD equality is not claimed. Git %G? reported E for both observed HEADs; this reviewer did not independently establish cryptographic signature verification or remote push state.

All reviewer writes are under this unique /tmp directory. No source, canonical QA, Git, installed library or global config mutation, service/network request, install, signer/key/token generation, credential-file/private-JWT read, management action, codegen/deploy, new target or agent spawn occurred. Only the explicitly allowed private owned ledger was read. Native supplemental checks use Node24.19.0, Convex1.46.0 and pinned existing dependencies. npm12.2.0 is accepted provenance, not a new reviewer npm execution. TypeScript6.0.3, tsx4.23.15, ws8.21.0 and https-proxy-agent7.0.6 package observations are preserved.

## Requirements review

| Required boundary/outcome | Met? | Evidence and limit |
| --- | --- | --- |
| Same41 case scope, append-only outcomes, exact discovery/dependency gating | Yes | Actual ordered receipt has41 unique names, multiplicity1; one true FAIL and one dependency BLOCKED. No exclusions substituted. |
| Trusted JWT issuer/subject, crypto and expiry; caller metadata is never authority | Yes, bounded live cases | Cases3–7,15–16,35 and exact customJwt RS256 auth config. No paid/provider identity claims. |
| Trusted tenant/space/owner and explicit capability; ADMIN is not READ/WRITE | Yes, bounded live cases | Cases8–14,24–25; accepted raw-current-generation ambiguity/epoch/version/retained-revocation policy reviewed. No broader240-endpoint closure claim. |
| Public/internal separation; metadata selectors and public rows cannot provision authority | Yes, bounded live cases | Cases16–18; accepted registration and worker-reference contracts. |
| Resource tombstones and current grant/principal/member/space/tenant fences | Yes, bounded live cases | Cases19–31,40 include positive baseline, negative effects and separately authenticated writes/readbacks where applicable. Quiet intervals are750ms observations, not unlimited delivery proof. |
| Packed metadata consumers and safe committed write/session receipts | Yes for actual positive slice and accepted affected prerequisites | Case32; full SDK receipt handling and relevant real resilience/no-redispatch tests inspected. Privileged write-only receipt branches were not newly replayed live. |
| Host getter/refresh/HTTP/null/logout and late fetch fences | Yes for actual covered outcomes | Cases33–37 plus actual logout/late delivery metrics. Reactive refresh41 may be cached; fresh HTTP41/force flag support narrower refresh evidence. Host must detach private observers/clear presentation on logout per03C1; fixture deliberately retains observer to test server fence. |
| Fixed code/attempt-only callback diagnostics plus later authorized recovery | **No complete actual outcome** | Case38 FAIL; exact source line310 queries during native async transition and can rethrow cached denial. Offline isolation/recovery checks support accepted eventual contract but do not replace live result. |
| Persisted background grants survive ordinary logout, fail explicit revocation | Yes, bounded live cases | Cases36/40 exact counters1/0; worker authority uses immutable reference and current recheck, not persisted JWT. Full durable inference/jobs remain pending. |
| Browser session maintenance receipt is typed and undispatched | Yes for actual typed outcome | Case39 active session plus accepted SDK expireIdle source and27 meaningful prior offline maintenance assertions; no new live wire counter is invented. |
| Session ending does not revoke separate authorization | **Not executed** | Case41 BLOCKED by case38; no full-live contract PASS. |
| Cleanup/fencing and physical exact target retirement | Yes, preserved parent receipts |33 terminal-verified process groups,0 remaining;24 cleanup completions,0 failures; exact project3135311 helpful-iguana-708 retirement POST200 followed by GET404. Target cannot replay. |
| Full root/core checks and original17 goal outcomes | Pending | Root remains BLOCKED_DIRTY_MF at3 maintenance references; CI skipped lint/types, SDK shards, CLI/provider and deployment. Wider original tasks remain pending below. |

## Test coverage analysis: entire original41 actual service scope

The status column is the observed case-level parent receipt, not an independent live rerun. Assertions listed describe reviewed unchanged source. For a failed case, source presence does not prove every preceding assertion ran. Every fullName appears exactly once; actual receipt’s skipped1 is the one dependency BLOCKED case.

| # | Original case | Actual | Required asserted outcome / practical limit |
| --- | --- | --- | --- |
| 1 | operator-provisioning | PASS | Four trusted owned principals and distinct IDs; operator setup is gated. |
| 2 | valid-owned-metadata | PASS | Exact immutable version1, mutable23, session messageCount0; no public authorityReference. |
| 3 | missing-identity | PASS | Public read and write reject absent verified identity. |
| 4 | forged-signature | PASS | Public read and write reject a forged signature. |
| 5 | wrong-issuer | PASS | Public read and write reject the wrong issuer. |
| 6 | wrong-audience | PASS | Public read and write reject the wrong audience. |
| 7 | expired-token | PASS | Public read and write reject an expired token. |
| 8 | wrong-tenant | PASS | Forged tenant selectors cannot authorize read or write (FORBIDDEN). |
| 9 | wrong-space | PASS | Forged space selectors cannot authorize read or write (FORBIDDEN). |
| 10 | owner-denied | PASS | A different own-scope principal cannot read or write the owner’s row. |
| 11 | explicit-space-read | PASS | Explicit broader space READ returns23; WRITE is denied. |
| 12 | admin-alone-read-denied | PASS | ADMIN alone cannot grant READ. |
| 13 | admin-alone-write-denied | PASS | ADMIN alone cannot grant WRITE. |
| 14 | ambiguous-omission-denied | PASS | A second trusted scope makes omission ambiguous; read/write denied and prior23 unchanged. |
| 15 | actor-binding-denied | PASS | Another actor’s immutable profile/session creation denied. |
| 16 | caller-metadata-no-principal | PASS | Persisted caller role/subject metadata never mints a trusted principal. |
| 17 | public-internal-provision-denied | PASS | Eight provision/revoke/delete/tombstone/authorize/recheck control functions remain internal. |
| 18 | public-internal-maintenance-denied | PASS | Counters and expireIdle reject public invocation. |
| 19 | immutable-delete-read-denied | PASS | Immutable purge/tombstone prevents later read. |
| 20 | immutable-delete-write-denied | PASS | Immutable tombstone prevents recreation/write. |
| 21 | mutable-delete-read-denied | PASS | Mutable deletion/tombstone prevents later read. |
| 22 | mutable-delete-write-denied | PASS | Mutable tombstone prevents recreation/write. |
| 23 | negative-effect-counts | PASS | Negative attempts leave mutable23, immutable version1 and session count0 unchanged. |
| 24 | reactive-wrong-tenant | PASS | Reactive wrong-tenant observer gets denial and zero successful callbacks. |
| 25 | reactive-wrong-space | PASS | Reactive wrong-space observer gets denial and zero successful callbacks. |
| 26 | resource-deletion-subscription | PASS | Working23 observer denied after deletion; recreation denied; all-success count unchanged for750ms. |
| 27 | grant-revocation | PASS | Working1 observer; revoked grant denies read/write/reference; separate authorized write/read2; no new success for750ms. |
| 28 | principal-deletion | PASS | Working1 observer; principal deletion denies read/write/reference; authorized write/read2; no new success for750ms. |
| 29 | membership-revocation | PASS | Working1 observer; membership revocation denies read/write/reference; authorized write/read2; no new success for750ms. |
| 30 | space-deletion | PASS | Working baseline; deleted space denies read/write/reference and broad writer/provision recreation; no new success for750ms. |
| 31 | tenant-deletion | PASS | Working baseline; deleted tenant denies read/write/reference and recreation; no new success for750ms. |
| 32 | sdk-metadata-consumers | PASS | Actual packed session create/get and users update/get marker43; public session strips authorityReference. |
| 33 | sdk-refresh | PASS | Exact reactive41 and fresh authenticated HTTP41; host force-refresh observed. Reactive result alone may be cached. |
| 34 | sdk-logout | PASS | Working private41 observer, null/logout, separate persisted/read42, successes1→1 for750ms; denial and empty headers. |
| 35 | sdk-labels-no-authority | PASS | Packed labels/admin claims with null host JWT confer no authority. |
| 36 | background-after-ordinary-logout | PASS | Trusted persisted reference still increments session messageCount to1 after ordinary host logout. |
| 37 | late-credential-fencing | PASS | Working42 observer, old fetch pending, null fence, old token released, separate persisted/read43; successes1→1 for750ms. |
| 38 | sanitized-host-callback | FAIL | Required: keys exactly attemptId/code, fixed failure code, unauthenticated denial, later exact43 recovery and cleared diagnostic. Case-level receipt reports unexpected_unauthenticated; full outcome is not established. |
| 39 | sdk-session-capability | PASS | Packed expireIdle gives typed BACKEND_MAINTENANCE_ONLY/not_dispatched; session stays active. Wire dispatch count is separately historical/offline evidence. |
| 40 | background-after-revocation | PASS | Explicit grant revocation prevents old reference memory-counter increment; independent auditor reads0. |
| 41 | session-end-not-grant-revocation | BLOCKED | Required: session ends/status ended, separate mutable43 and trusted scope reference remain valid. Not executed because sanitized-host-callback failed. |

Logout metric is baseline41/update42, successes before1/after1, observedValues[41],750ms. Late-fetch metric is baseline42/update43, successes before1/after1, observedValues[42],750ms. These demonstrate observers worked and had a concrete later delivery opportunity; they avoid a never-working-observer false pass. They are bounded observations, not indefinite absence guarantees.

## Original41 metadata endpoint requirements are a separate inventory

The accepted metadata endpoint inventory is41 registrations: immutable12, mutable11, sessions10 and users8;36 public and5 internal. It is not the same list as the41 live security/client scenarios. Read the original endpoint requirement mapping and full actual modules; shared auth requires current verified authority, trusted scope/owner, explicit read/write and retained epoch/version/deletion fences for every public path. Lists/count/search/bulk/transaction/history/version selectors never become authority; ambiguous omitted scope fails closed; privileged maintenance remains internal and receives current trusted references. Prior accepted native metadata qualification is prerequisite evidence, not new reviewer test execution or proof every endpoint was called live.

| Endpoint | Visibility | Required capability/execution |
| --- | --- | --- |
| immutable:store | public | write |
| immutable:get | public | read |
| immutable:getVersion | public | read |
| immutable:getHistory | public | read |
| immutable:getAtTimestamp | public | read |
| immutable:list | public | read |
| immutable:count | public | read |
| immutable:search | public | read |
| immutable:purge | public | write |
| immutable:purgeMany | public | write |
| immutable:purgeVersions | public | write |
| immutable:purgeAll | internal | trusted deployment-operator internal invocation |
| mutable:set | public | write |
| mutable:update | public | write |
| mutable:get | public | read |
| mutable:exists | public | read |
| mutable:list | public | read |
| mutable:count | public | read |
| mutable:deleteKey | public | write |
| mutable:purgeMany | public | write |
| mutable:purgeNamespace | public | write |
| mutable:transaction | public | write |
| mutable:purgeAll | internal | trusted deployment-operator internal invocation |
| sessions:create | public | write |
| sessions:get | public | read |
| sessions:touch | public | write |
| sessions:end | public | write |
| sessions:endAll | public | write |
| sessions:list | public | read |
| sessions:count | public | read |
| sessions:incrementMessageCount | internal | write |
| sessions:incrementMemoryCount | internal | write |
| sessions:expireIdle | internal | write |
| users:get | public | read |
| users:list | public | read |
| users:count | public | read |
| users:getVersion | public | read |
| users:getHistory | public | read |
| users:getAtTimestamp | public | read |
| users:exists | public | read |
| users:deleteUserProfile | public | write |

## Precise callback-recovery diagnosis

The immutable candidate’s scripts/client.ts:304–312 first calls notifySessionChanged with a throwing getter, requires only attemptId/code and HOST_TOKEN_FETCH_FAILED, and deliberately queries mutable:get under null/failed identity (line308). It then gets a current valid token and calls notifySessionChanged at line309, followed immediately by the one-shot exact43 query at line310 and diagnostic clearing assertion at line311. The unexpected_unauthenticated reason is compatible with this recovery query. No grant-revocation step precedes it; explicit sdk grant revocation occurs later in case40. The live receipt has no native cache stack or auth/server timing trace, so it cannot distinguish a cached denial from a still-inflight unauthenticated server update.

Accepted src/auth/credentials.ts:109–118 declares notifySessionChanged():void. configureReactiveAuth:125–190 cancels stale deferred deauth, clears any old identity, installs the official async setAuth adapter and forces the first current host fetch; it does not wait for token acquisition or server acknowledgment and promises no query-cache flush. Current getter success clears only the diagnostic at146–149. Host and observer failures remain contained and sanitized; version/attempt/closed fences protect recovery. The same source bytes occur in qualified SDK/source and main; actual index wiring validates credentials before allocation and binds this adapter to the official client. Caller labels/provider/env configuration do not replace the host JWT boundary in this actual minimized-env flow.

Installed Convex simple_client.ts:540–565 calls Base.localQueryResult before establishing its one-shot listener. A cached QueryFailed makes optimistic_updates_impl.ts:231–252 throw the native ConvexError immediately. Unsubscription does not synchronously purge that result; QueryRemoved/QueryUpdated from the server transition change remote/cache state. Base.setAuth at sync/client.ts:668–677 starts AuthenticationManager.setConfig with void; authentication_manager.ts:150–185 pauses, awaits token fetch, attaches User authentication then resumes. Valid identity confirmation arrives later via a server Transition. clearAuth changes identity/wire messages, not the query result cache. Thus even await-able token completion or authFailure===undefined is insufficient evidence that a previous denied query has recovered. Merely issuing repeated one-shot queries can continue consuming the same cached failure rather than keeping a listener alive for a fresh authorized update.

This is an asynchronous observation/setup defect at fixture lines309–310 relative to the accepted later-recovery contract. It is not established as an SDK credential-source defect. A valid immediate async getter also reproduces it, so arbitrary elapsed sleeps or merely waiting for a host diagnostic flag are inadequate fixes. Pre-notification clearAuth can additionally send None before new User confirmation; a fresh one-shot query can also race that transient denial. The exact live combination remains an evidentiary limit.

## Meaningful independent offline installed-client checks

Ran the actual qualified packed Cortex and installed native Convex modules under an explicit minimal environment containing only PATH and own TMPDIR. Before imports, fetch/http/https/net/tls/dns paths throw on any attempt; WebSocket is an inert in-memory transport restricted to ws://127.0.0.1:9. Synthetic compact token-shaped text has no signing/private key/private JWT and is never sent to a service. Synthetic QueryFailed/QueryRemoved/QueryUpdated protocol messages exercise the installed native client’s actual auth/cache/observer implementation. This does not authenticate a token or emulate a real server’s authority correctness.

| Check process | Discovered / executed / PASS / FAIL | Exit | Evidence |
| --- | --- | --- | --- |
| required-assertion |4 /4 /3 /1 |**1** |commands/offline-required-assertion.*, native-required-assertion.json; immediate original-purpose exact43 assertion remains failing with native ConvexError UNAUTHENTICATED. |
| deferred valid getter diagnosis |14 /14 /14 /0 |0 |commands/offline-deferred.*, native-deferred.json; native cached denial, current diagnostic clearing, no late None, persistent observer and exact43 after native transition. |
| immediate valid async getter diagnosis |13 /13 /13 /0 |0 |commands/offline-immediate.*, native-immediate.json; same cache failure and later exact43 recovery even with an immediate getter. |

Total is3 processes,31 named check executions,30PASS/1 deliberately preserved failing outcome,0 skipped/todos. There are15 unique fullNames with explicit multiplicities in execution-summary.json: the3 setup names run3 times,10 shared diagnostic names run2 times, deferred-diagnostic persistence once and the exact required immediate outcome once. These are supplemental checks, not31 product cases or passing original41 replay. Reviewer actual live/original41 replays are0. All3 clients closed, zero unhandled rejection and zero network attempts. A rejected diagnostic observer is deliberately exercised. Required reproduction raw stack reaches native optimistic query cache, Base.localQueryResult and ConvexClient.query.

Offline scripts were not edits to fixture or SDK. A discovered-count-only own script metadata correction made immediate mode advertise13 rather than14 before that mode ran; the required value43 assertion and diagnosis assertions were unchanged. The required-assertion invocation’s pre-edit whole-script SHA was not separately frozen; current script plus raw executed assertion/result and this exact one-line metadata delta are preserved. The source line317 comment in the own script refers to the original recovery assertion’s purpose; the actual qualified fixture line is310. No changed supplemental success is substituted for the original nonzero reproduction.

## Parent operation history and raw-evidence limits

| Parent operation | Actual outcome / preserved limitation |
| --- | --- |
| First direct provisioning attempt |ECONNREFUSED IPv4 observation; no captured raw diagnostic or exact start/end/exit. Initial observation explicitly contains null timestamps; do not invent them. |
| Proxy exact-name reconciliation |2026-10-03T14:13:09.691Z–14:13:10.075Z HTTP200, zero exact matches. |
| Exact provisioning retry |14:17:42.853682–14:17:46.303655 UTC, exit0. |
| First mandatory official deploy/codegen |Wrapper exit1; official diagnostics discarded by unchanged wrapper. |
| Unchanged private-directory direct CLI diagnostic |14:19:48.278–14:19:50.231 UTC, exit1. Official Convex1.46 could not find cwd-relative tsc; its “Skipping typecheck” diagnostic is not a successful disabled compiler gate. |
| Pinned dependency preparation |14:20:35.708918–14:20:35.784667 UTC;140 regular TS6.0.3 files copied from installed package; no network install, symlink, source/config edit or ES2021 uplift. |
| Guarded official deploy/codegen retry |14:20:35.924–14:20:40.209 UTC, exit0; dev --once --codegen enable --typecheck enable --tail-logs disable --env-file. Successful raw CLI diagnostics intentionally discarded by accepted wrapper. Official generated bindings are real. |
| Original41 actual qualification |14:20:57.052–14:21:44.287 UTC case receipt; parent wrapper completed14:21:46.293 with exit1.39PASS/1FAIL/1BLOCKED. |
| Owned fixture cleanup |14:22:19.952503–14:22:44.818548 UTC, exit0;24 completed,0 failures. |
| Physical exact project retirement |14:22:55.972–14:22:56.112 UTC; POST200, confirming GET404. |

The parent’s collector initially assumed every evidence JSON was an object and recalled129 source-only SDK rows as199 total provenance rows. Those archive preparation assumptions were corrected without changing candidate bytes/assertions; preservation verifies actual47/58/199. They are not another implementation/judge repair cycle.

Reviewer commands have argv/cwd/UTC start/end/exit and separate full stdout/stderr. Four recorded exit1 commands are retained: expected original-purpose native reproduction, initial freeze treating a synthetic original label as a file, an exploratory wrong cache filename, and a later third-report SHA read using the wrong filename. Corrected read-only provenance/path checks pass; none is erased or miscounted as a live test failure. Some initial exploratory prompt/skill/AGENT/path/setup tool reads lacked individual raw-file/UTC captures; the omissions file identifies them and no timestamps are fabricated. House lint/types/unit suites were not rerun because there is no reviewer source change and the new failure is qualified with the actual installed native client; prior accepted tests/type/lint receipts remain historical.

CI summary at a1dcb487 reports actual package/browser contracts, Neo4j/Memgraph contracts and four demo builds PASS; aggregate completed14:27:40 UTC. Lint/types, SDK shards, CLI/provider and deployment were SKIPPED by QA-only path detection. Reading this cached summary is not a new CI execution or full core green. Last root compiler remains BLOCKED_DIRTY_MF at3 rejected maintenance references; no root/type/module/core PASS was newly obtained here.

## Dimension scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement Fulfillment |2/5 |39 complete case-level outcomes; required callback recovery fails and session/grant independence is unexecuted. All41 are retained; no full-service PASS possible. |
| Code Quality |4/5 |Accepted auth and metadata source validate boundaries, sanitize diagnostics, fence stale async/deferred state and preserve internal worker references. No required SDK source defect established. Fixture ordering defect is recorded explicitly. |
| Test Quality |3/5 |Meaningful real positive/negative effect and observer controls cover39 cases, but recovery setup assumes void notification refreshes cached one-shot query synchronously; reactive refresh positive can be cached. |
| Pattern Adherence |4/5 |Official native/client/CLI and exact accepted bytes; minimal environment/owned ledger/process/target boundaries, honest counts and exclusions, no forbidden assertion/source changes. |
| Completeness |2/5 |Actual qualification lacks2 required successful outcomes and retired target prevents replay; old offline/type/CI evidence does not certify a correction. |

**Average3.0/5.** judge-task requires all dimensions≥4 and Requirement Fulfillment5 for PASS. Scores≤2 require REJECT. The new actual failure is not excused by accepted offline readiness or supplemental positive observations.

## Issues found and minimum necessary next step

### Critical: incorrect recovery observation setup

Fixture scripts/client.ts:309–310 must establish later authenticated result delivery before its existing exact43/cleared-diagnostic checks. A bounded persistent onUpdate recovery observation can survive the known transient cached UNAUTHENTICATED result and await a fresh exact43 server update. Retain the preceding required denial, exact sanitized keys/codes, current/force-refresh semantics, existing exact43 query and authFailure===undefined assertions, all41 identities/dependencies and existing time ceilings. Release the observer on all paths. Unexpected FORBIDDEN/service/infrastructure errors must still fail; do not swallow arbitrary errors, change43, remove denial or merely mark callback case optional. Waiting only for diagnostic clearing/getAuth/token resolution is insufficient. No source fix was made by this reviewer.

### Critical: dependent session/grant contract has no actual outcome

After a separately implemented/reviewed bounded correction, rerun the original actual41 failing QA scope on a fresh exact owned disposable target; the retired original target cannot be reused. Preserve this failed run and obtain a fresh independent actual-service judgment. Session-end-not-grant-revocation must actually execute and verify its original ended-status/separate43/reference outcomes. An offline PASS cannot close it.

### Gate distinction and technical conflict

The original OFFLINE harness readiness gate has exactly3 completed independent reviews: REJECT2.6, REJECT2.6 and final PASS4.6. Its original rejected mechanics are exhausted, preserved and not reopened/reset. This is the first ACTUAL service QA failure/review, with a different previously unexecuted outcome. `.agents/skills/feature-orchestrator/SKILL.md:64–65` explicitly says “For QA issues: create bounded fixes, delegate implementation, rejudge, and rerun the failing QA gate.” A bounded correction to asynchronous observation setup for this newly actual QA failure can preserve every original41 assertion and accepted later-recovery semantics; it need not constitute a fourth repair of the previously completed failed offline mechanics. It must be tracked as this actual QA issue with affected checks/fresh independent review. The old third readiness PASS certifies its frozen bytes and does not certify changed fixture bytes.

`.agents/skills/judge-task/SKILL.md:190–201` protects expected behavior and permits incorrect test setup correction; its parenthetical example is wrong mock data. Treating a void notification as a completed server/cache transition is demonstrably incorrect asynchronous setup under the source contract. This is the reviewer’s application of that exception, not an instruction to weaken an assertion or authority to override max3 cycles. If a proposed change modifies expected outcomes, classifier/process guarantees or other previously exhausted issues, that classification would need separate treatment and cannot inherit this diagnosis. This reviewer authorizes no implementation/exception, resets no gate and creates no fourth offline acceptance claim.

The accepted credential-source gate03C1 has exactly1 completed independent review, FINAL PASS4.2, including an essential correction during that first open review. No evidence here requires SDK correction. If later meaningful evidence shows eventual recovery fails even after current authenticated server delivery, an actual required SDK change belongs to an affected continuation of that credential gate, not automatically a fourth offline-harness repair. Do not change credential source merely to make this immediate-query fixture pass. Rejected memory/fact42, artifact22 and registry46 scopes remain unintegrated/held at exhausted third gates; their pending exceptions are unaffected.

## Original goal coverage and pending work

| Original task/success area | What this review establishes / remains pending |
| --- | --- |
|01 stack/execution boundary |Accepted qualification is prerequisite; no new whole-task review or paid inference run. |
|02 backend-friendly domain services |Accepted bounded foundations are prerequisites; rejected memory/fact work is held; full extraction remains pending. |
|03 verified identity/grants/all alternate paths |Only actual39/41 scoped metadata/security/client cases supported; failed callback and blocked session case open. Full memory/fact/conversation/search/share/artifact/attachment/graph/policy/240-endpoint closure and transcript administrative unlock/revision tracking remain pending. |
|04 model policy/admission budgets |Provider-qualified operation policy, budget reservations/cost/concurrency/fallback/audit and paid inference remain pending. |
|05 canonical transcript/agent/run admission |Canonical administrator-controlled edits/revisions, start/get/observe/cancel/approval, idempotent admission and backend tools remain pending. |
|06 additive installation |Bounded fixture/official codegen only; safe full host/development integration remains pending. |
|07 Agent/durable reactive output |No Agent/tool run, reconnect/cursor/multiple observer/cancel/approval/finality certification. |
|08 durable asynchronous memory/belief |Persisted grant counters only; full durable pipeline, exact processing receipts, indexing versus response finality, pending-tail/barrier/context-overflow/revocation-at-effect/commit remain pending. |
|09 minimal TS/native UI vertical slice |Packed metadata/host credential slice only; remote AI SDK7 transport/hooks, actual native UI, live scoped recall/finality/reconnect/cancel/approval/parity and full01–09 vertical slice remain pending. |
|10 clean-slate embeddings |Profile/dimension/source-revision compatibility, derived generation/readiness and retrieval extension remain pending. |
|11 external graph outbox |Cached CI graph contracts are not live scoped durable graph/projection/revocation acceptance. |
|12 assets/private delivery |No authenticated uploads/downloads, reference-aware bytes/cascades/storage/callback/private HTTP20,000,000-byte outcomes; private provider input delivery remains pending. |
|13 Gateway image/video jobs |No media/model request, provider callback verification/dedup/poll/cancellation/materialization/retention/cost outcome. Host token callback test is not connector/media callback qualification. |
|14 TS media/embedding/UI extensions |All extension client/native UI outcomes remain pending. |
|15 additive CLI/quickstarts/templates |Demo builds are narrow cached CI evidence; full safe installation/product CLI behavior remains pending. |
|16 cross-layer live/adversarial outcomes |This scoped failed metadata/auth/client run is not full cross-layer service/storage/media/graph/UI acceptance. |
|17 docs/quality/final gate |Full independent goal audit, module QA/core green, docs/install proof and final17-task acceptance remain pending. |

No all03/endpoints/transcript/bytes/paid-inference/native-UI/full-isolation PASS is claimed. Same-UID code/import/env/IPC boundaries are not an OS sandbox. Cleanup/retirement success is separate from product qualification success. All original requirements and exhausted holds remain visible.

## Evidence artifacts

This report, execution-summary.json, source-context, source SDK provenance files, complete packed archive/files, installed native ESM/cache observations, before/after freezes, integrity-extra.json, private-ledger hash binding, all recorded commands/raw streams and all own check sources/results are bound by preservation-manifest.json. Explicit exclusions are in omissions.json and the manifest. The manifest and its detached hash necessarily exclude themselves to avoid a recursive digest. Final creation/display bookkeeping is separately disclosed; no late command is claimed as a product check.
