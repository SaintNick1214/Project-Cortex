# Task Judgment: Task03C2 second independent offline harness review

## Verdict: REJECT

The FINAL freeze `2026-10-03T12:43:43.267462+00:00`, SHA256 `c36c94ff03fd68f74da4d44feb068c155d0c50e80c0199e6e384b07de86f2cf4`, preserves accepted fixture/SDK source and fixes the original SDK-child key access, positive logout/late-observer baseline, request bounds, case discovery, and setup gating. It still fails the required negative diagnostic and process-finalization guarantees. Three independent malformed diagnostic controls are accepted as authorization denial. One unchanged actual driver replay fails its no-running-grandchild assertion after a receipt says `REAPED`; two later replays pass, so the defect is intermittent. Deployment/cleanup also retain the second-preflight output-loss path that the qualification driver now avoids.

This is an OFFLINE harness verdict. All 41 canonical service outcomes remain UNEXECUTED. No service/network, target creation, model, signing, key generation/rotation, deploy/codegen, fixture cleanup/retirement, staging, commit, push or child-agent operation occurred. The ordinary test processes and their groups were disposable offline probes. No rejected main working-tree candidate was imported, copied or deployed.

The separate accepted metadata/shared-reader native ambiguity follow-up remains ACTIVE, isolated and unapplied. This review neither repairs nor certifies that defect. Parent service execution must remain BLOCKED until the follow-up independently passes, is integrated, both accepted helper fixture copies and provenance are refreshed, and an affected frozen-harness review passes. A future offline harness PASS would still require a separate actual 41-case service qualification and final review. Full Tasks03/09, Task05 run/transcript/tool semantics, private storage/bytes/uploads/media, connector callbacks, automatic maintenance and UI remain pending.

## Evidence Review

Reviewed `/workspace/Project-Cortex/AGENTS.md`, `.agents/CODEX-RUNTIME.md`, full project profile, pessimistic-judge role, judge-task rubric and feature-orchestrator workflow; original goal, Tasks03/09, decision register, and `qa/task03c2-live-preparation.md`. Read the full first FINAL REJECT2.6 judgment and its preserved judgment/probe/source evidence. Examined current README/report, freeze, both inventories, archive/source/SDK provenance, service matrix, all active executable/type files, private offline process/interception helpers, final command receipts and second-cycle initial failures. Inspected the installed Convex1.46 run/HTTP/ConvexError serialization source. The separate metadata native-error report was read only; its isolated implementation was not adopted.

All independent files are under `/tmp/task03c2-live-harness-review2-oj6uebre`. `commands.json` records exact argv, cwd, UTC start/end, exit and raw output for the recorded checks. `manifest.json` binds the report, raw logs, scripts, private replay sources and receipts, excluding itself and dependency `node_modules`/symlinks. Dependency versions are pinned and rechecked. The replay uses byte-identical candidate/SDK/archive files, exact accepted root package.json, and installed dependencies; it contains no target.json, deploy.env or private RSA. No canonical writer was executed: guard/entrypoint/prep/driver checks write only into the disposable replay tree. Actual backend/client typechecks and scoped lint are read-only on the real mainroot.

An initial judge replay omitted root package.json, causing tsx to choose CJS for top-level-await TypeScript. Both raw failed outputs and the full crash receipt are preserved; copying the exact accepted manifest corrected only that replay setup. The subsequent no-running-descendant assertion failure is separate and is not attributed to replay setup. `initial-failures.json` distinguishes these observations. No assertion or frozen source was changed to obtain a pass.

| Observed check | Result | Independent evidence |
| --- | --- | --- |
| Guard rejection cases | 37 PASS, skipped0; network/subprocess/output0 | `guard-check.log`, new replay guards receipt |
| Actual guarded entrypoint import interception | 4 PASS; network/subprocess/output0 | `entrypoint-check.log`, new replay entrypoints receipt |
| Original accepted SDK preparation | 6 PASS; dispatch/callback0 | `client-prep-retry.log`, new replay client-prep receipt |
| Supplemental actual packed SDK preparation | 6 PASS; dispatch/callback/network0 | `packed-prep.log`, new replay packed-prep receipt |
| Frozen classifier controls | 28 PASS, skipped0; network0 | `classifier-check.log` |
| Independent malformed operator diagnostic controls | **0PASS/3FAIL, skipped0, exit1; all3 falsely accepted** | `operator-lookalike-assertions.{mjs,json,log}`; original captures also preserved |
| Actual frozen driver/process checks, after replay setup fix | **First exit1**, then two exits0; passing replays discover **34**, not advertised35 | `driver-check-retry.log`, `driver-check-repeat2.log`, `driver-check-repeat3.log` |
| Failing whole-ceiling process receipt | All41 retained, active FAIL and dependents BLOCKED, but cleanup reports REAPED before the nonterminal grandchild assertion | replay `evidence/qualify-4729e92f-7700-44b0-b0c5-cee0c09cba59.json`, private descendant PID file |
| Read-only /proc audit on subsequent replays | Six sampled grandchildren Z; no assertion changed | `proc-audit.{mjs,jsonl}` |
| Focused actual frozen process-owner/engine probes | Two batches of10; sampled descendants Z and all41 retained; does not erase earlier failure | `process-race*.{mjs,json,log}`, own race receipts |
| Service/shutdown bounds coverage | 72 protected promise sites +4 configured ceilings =76; skipped0 | `bounds-check.log`, AST receipt; source reviewed beyond counts |
| Backend native accepted ES2021/DOM config | exit0 | `backend-types.log`, `commands.json` |
| Separate strict client type project | exit0 | `client-types.log`, `commands.json` |
| Actual house scoped lint | 35files,0errors/0fatal,21 accepted-source warnings | `house-lint.log` |
| Existing backend-policy selector | 35files,0errors/0warnings/0fatal | `backend-policy-lint.log`; selector inspected, no rule/ignore weakening |
| Current freeze and inventories | 54 active public +15 private executor bindings;511 public +214 private hashes exact | `integrity.json` |
| Accepted source and pack | 14 fixture copies exact at both4fb348/c92d548;129 SDK source/config copies exact4fb348;199 SDK provenance entries exact;53 tar entries exact | `integrity.json` |
| Pack SHA256 | `cd97dabc1428e2dc7f217bf316aff0d7bf4ebf0d843a214a5777a2228275193d` | `integrity.json` |
| Historical evidence |107 archived QA and280 preserved records exact; all407 original independent manifest bindings accounted for,208 preserved +199 private reproducible omissions | `integrity.json`; preservation manifest SHA57b40f90400b5d6b52d9656a35194c0a01c7f98e77c8516b2a4f18e224361942 |
| Existing RSA/JWKS comparison | Match, owned0600/unlinked; new keys0, signed tokens0 | `key-and-operator-controls-recorded.json`; RSA not copied or output |
| Public secret-pattern scan | No actual key/PEM/signed-JWT matches; explicit archived/offline standins recognized | `integrity.json` |
| Before/after preservation |727 canonical/private files byte/mode/UID/link metadata identical; Git status identical | `before.json`, `preservation.json` |
| Private output | Review directory0700, own top-level files0600/unlinked/owned; no target/env/RSA copied | `private-output-check.json` |
| Runtime |Node24.19.0/npm12.2.0; pinned Convex1.46.0/ws8.21.0/https-proxy-agent7.0.6/tsx4.23.15/TS6.0.3 | `node.log`, `npm12.log`, guard/version reads |

The exact failing operator grandchild later reached Z; no persistently running orphan or post-receipt service effect is claimed. Linux non-child zombies under container PID1 are expressly outside Node waitpid ownership. Subsequent passing runs are preserved, rather than substituted for the failed run.

## Requirements Review

| Original bounded requirement | Met offline? | Evidence / practical limit |
| --- | --- | --- |
| Accepted03A/03C1/metadata/backend dependencies and accepted SDK bytes only | Yes |14/129 exact Git comparisons, frozen pack/provenance; isolated functions directory excludes MF/artifact/registry/run/inference/storage candidates |
| Preserve original QA, rejected freeze and complete independent history | Yes |107/280/407 independent checks;199 omissions remain unchanged private bindings |
| Canonical paths, alias/hardlink rejection, private0700/0600, exclusive outputs before effects | Yes |guard.mjs:20-66,95-107;37 guard and4 actual entrypoint checks; no live receipt/env exists |
| Fresh purpose/name/slug/ID/URL/dev/cloud/active/nonretired receipt and matching development selectors/key | Prepared |guard.mjs:69-91 and request; actual trusted management verification remains parent-only/unexecuted |
| No handwritten generated API; actual official codegen later | Prepared |API absent; deploy.mjs:11 uses official dev --once --codegen enable --typecheck enable --tail-logs disable --env-file; no codegen executed |
| Real official HTTP/reactive client, ws8.21 proxy/CA and packed Cortex/HostCredentials | Prepared |client.ts:2-9,21; reactive-transport exact wss origin; fake transport confined to explicit OFFLINE prep/probes |
| Trusted parent driver alone owns key/target/sign/operator/ledger/evidence; SDK child gets endpoint/JWT/testrefs/minimal env | Yes for code/import/env/IPC boundary |driver.mjs:12-42; protocol/parent-channel; actual child interception and reviewed import graph; not an OS sandbox on same UID |
|12s HTTP/SDK/setup/shutdown/observation,25s CLI,600s driver/cleanup,120s deploy limits | Prepared, source bounds present |72 protected sites and inspected loops/timeouts; timer cutoff includes bounded subsequent process finalization, not instantaneous OS shutdown |
| All41 append-only FAIL/BLOCKED outcomes survive startup/crash/SIGKILL/hang/whole timeout/inflight operator | Yes for ledger retention |CaseLedger/driver-engine; actual failure and passing offline receipts discover41; driver externalSIGKILL remains explicit trusted-parent limitation |
| Direct children waited and all group descendants terminal before successful cleanup claim | **No stable evidence** |one actual required process assertion fails; ProcessOwner deletes based on leader close; REAPED depends only on its Set size |
| Final abnormal outputs use initial binding, no second failing key/target preflight | Qualification yes; **deployment/cleanup no** |driver.mjs captures validatedOutput and writeDriverReceipt; deploy:17/cleanup:41 still call writeEvidence -> livePreflight again |
| Authorization-negative operator classification requires authentic exact official invocation/server/ConvexError shape; unrelated/lookalike errors never PASS | **No** |three malformed in-memory controls accepted by unchanged classifier; substring rather than complete envelope/body parsing |
| Setup availability BLOCKED; true service/assertion FAIL; explicit dependent gating | Prepared and offline mechanism verified |client.ts:66-105,150-168,219-223,232-251,294-322; actual SDK setup-unavailable receipt all41BLOCKED |
| Actual packed logout/late observation first proves41/42, counts all success, null/late fences, independently persists/reads42/43, then750ms no new delivery | Prepared correctly |client.ts:252-282,290-303; bounded window only; original never-working-observer defect removed |
| Private callbacks/errors/receipts carry only allowlisted statuses/codes/counts/numeric observer values | Prepared |console suppression, in-memory parsing, metrics validation; no private row/token/raw diagnostic saved |
| Owned partial setup cleanup, attempted scopes journaled, known principals only, exact parent retirement for unknown IDs | Prepared |AuthorityProtocol/driver checkpoint; cleanup:14-46; no global purge or SDK admin/public worker seam; cleanup/retirement unexecuted |
| Honest scope and full Tasks03/09 pending; metadata native-error dependency hold | Yes |README/report/matrix explicitly retain all broader requirements and service hold; no accepted helper refresh made |

Original Task03 inventory/trusted grant/bootstrap and client lifecycle are accepted dependencies here. This fixture prepares metadata alternate-path closure, verified JWT scope, reactive revocation, session references and tombstones. Full memory/fact/conversation/search/share/artifact/attachment/graph/policy closure, transcript administrator unlock/revision tracking, actual paid tool/upload/download/private byte/callback/share behavior remain pending. Ordinary host logout is distinct from trusted grant revocation; session ending is distinct from scope/grant revocation. No whole-Task03 claim is made.

Original Task09 start/get/observe/cancel/approval/memory receipt contracts, remote AI SDK7 UI/backend tool, response versus indexing finality, strict barriers/context overflow, live scoped recall/finality/pending tail, reconnect/multiple observers/cancel/approval, TS/UI parity and the full Tasks01-09 vertical slice remain pending. This bounded fixture supplies metadata/auth transport preparation and packed client consumer checks only. No upstream/model key enters its SDK child.

## Original Five Findings Mapping

1. **Logout/late observer evidence:** fixed in prepared source; exact positive baseline, all-delivery count, independent authenticated mutation/read and750ms quiet window are present. Real service outcome remains UNEXECUTED.
2. **Bounds/lost receipt/process ownership:** request/shutdown bounds, trusted41-case ledger and crash receipt are fixed. Descendant terminal-state verification remains defective/intermittent; see Critical2. Deployment/cleanup initial output binding also needs completion.
3. **SDK child deployment-key access:** fixed. Trusted guard/key/operator imports are absent from the child; exact minimal env/IPC and actual child interceptions support the narrower code boundary. No OS isolation is claimed.
4. **Generic permission stderr falsePASS:** ordinary examples are fixed, but broader malformed lookalikes/wrong outer function still pass; see Critical1. The28 supplied controls do not cover these cases.
5. **Setup/dependency status:** fixed for prepared foundation/revocation/SDK flows, with actual offline BLOCKED setup evidence and all41 discovery.

## Test Coverage Analysis: All41 Original Service Cases

Every row is UNEXECUTED on a real service. “Prepared” describes assertions, not observed service success. Diagnostic classification/process-finalization findings affect adoption of the entire harness.

| Case | Prepared outcome assertion |
| --- | --- |
| operator-provisioning |4 trusted owned principals; distinct IDs; setup operator availability BLOCKED |
| valid-owned-metadata |Exact immutable version1, mutable23, session messageCount0, absent authorityReference; gates dependents |
| missing-identity |Both public read/write auth denial |
| forged-signature |Both public read/write verified-token auth denial |
| wrong-issuer |Both public read/write auth denial |
| wrong-audience |Both public read/write auth denial |
| expired-token |Both public read/write auth denial |
| wrong-tenant |Read/write FORBIDDEN |
| wrong-space |Read/write FORBIDDEN |
| owner-denied |Other own principal read/write FORBIDDEN |
| explicit-space-read |Explicit broader READ returns23; WRITE FORBIDDEN |
| admin-alone-read-denied |ADMIN without READ is FORBIDDEN |
| admin-alone-write-denied |ADMIN without WRITE is FORBIDDEN |
| ambiguous-omission-denied |Additional trusted scope; omitted scope read/write denied; exact prior23 unchanged |
| actor-binding-denied |Other actor immutable identity and session creation denied |
| caller-metadata-no-principal |Caller labels/admin metadata never provisions trusted principal |
| public-internal-provision-denied |Provision/revoke/delete/tombstone/authorize/recheck not public |
| public-internal-maintenance-denied |Increment and expireIdle not public |
| immutable-delete-read-denied |Purge/tombstone then read FORBIDDEN |
| immutable-delete-write-denied |Tombstone prohibits recreation; explicit dependency |
| mutable-delete-read-denied |Resource deletion then read FORBIDDEN; explicit dependency |
| mutable-delete-write-denied |Tombstone prohibits recreation; explicit dependency |
| negative-effect-counts |Prior mutable23, immutable version1 and session count0 remain exact |
| reactive-wrong-tenant |Auth error, zero successful callbacks |
| reactive-wrong-space |Auth error, zero successful callbacks |
| resource-deletion-subscription |Positive23 baseline; deletion denial; recreation denied; count unchanged750ms |
| grant-revocation |Positive1 baseline; read/write/reference denial; other authorized write/read2; quiet count unchanged |
| principal-deletion |Same controls for deleted principal |
| membership-revocation |Same controls for revoked membership |
| space-deletion |Positive baseline; denial/recheck; broad writer/provision recreation denied; quiet count unchanged |
| tenant-deletion |Same controls for deleted tenant |
| sdk-metadata-consumers |Actual packed session create/get, user update/get marker43; no authorityReference; SDK dependent gate |
| sdk-refresh |New host JWT; official reactive/HTTP exact41; force-refresh callback observed |
| sdk-logout |Actual packed positive41; null fence; independent persisted/read42; all success count unchanged750ms; query/header denial |
| sdk-labels-no-authority |Packed SDK labels/admin claims with null JWT cannot grant access |
| background-after-ordinary-logout |Trusted reference increases exact session messageCount1 despite host logout |
| late-credential-fencing |Positive42; pending old token; null fence; release old token; independent persisted/read43; all success count unchanged750ms |
| sanitized-host-callback |Only attemptId/code, exact HOST_TOKEN_FETCH_FAILED; denied query; successful43 recovery clears failure |
| sdk-session-capability |Actual packed typed BACKEND_MAINTENANCE_ONLY/not_dispatched; session still active; zero dispatch separately proved offline |
| background-after-revocation |Old trusted reference cannot increment; auditor reads memoryCount0 |
| session-end-not-grant-revocation |Ended session status, independent mutable43 and trusted scope recheck still succeed |

## Issues Found

### Critical (must fix; blocks PASS)

1. **Malformed lookalikes still produce operator authorization-negative PASS.** `scripts/operator-classifier.mjs:8` searches for the expected envelope anywhere in stderr. Lines11-12 search for a request marker and `Uncaught ConvexError` anywhere after it. They do not establish that the top-level official envelope belongs to the requested function or that the immediate ConvexError body has the installed server-error serialization. `operator-lookalike-assertions.json` records expected=false/actual=true and failed assertions for: a proxy description that merely contains the server marker/structured JSON; an EACCES body that prints an example marker/JSON; and an outer `runtimeAuth:authorize` envelope whose diagnostic merely mentions `runtimeAuth:recheck`. None has the required actual context/body shape, yet it yields OPERATOR_AUTHORIZATION_DENIED through operator.mjs:16 and satisfies client.ts:59. Require one complete official invocation envelope with the exact actual function and an anchored immediate server-error/structured ConvexError body; reject nested/quoted/mixed envelopes, diagnostic examples and unrelated error prefixes. Keep raw parsing in memory, add these independent falsepositive controls, and retain live compatibility as unexecuted/fail-closed. This is an offline predicate defect, not an asserted deployed exploit.

2. **Process cleanup can claim REAPED before its owned grandchild is terminal.** `scripts/process-owner.mjs:14-16` sends SIGKILL, awaits only the direct leader's `closed`, then deletes the record. `driver-engine.mjs:72-75` derives remaining groups and REAPED solely from that Set. The unchanged actual driver probe, after the accepted root manifest correction, exits1 at driver-check.mjs:80/88: the whole-timeout operator grandchild is neither Z nor X when checked after the41-case receipt. That receipt still says REAPED/remaining0. The PID is65508, recorded in its private replay file, and later reaches Z. Two later full replays and20 focused probes sample terminal descendants, so the failure is intermittent rather than a persistent orphan. There is no bounded group-member terminal-state wait in the frozen ProcessOwner implementation. Keep direct-child waiting, then verify owned descendants are terminal/absent under a bounded Linux check before clearing ownership and emitting REAPED; inability to establish this must retain FAIL. Do not claim waitpid ownership of PID1 zombies or introduce an OS-sandbox claim. Preserve the failed check and ensure the stable required process assertion passes after repair.

### Important (should fix in the same bounded revision)

3. **Deployment/cleanup still lose final operation evidence if key/target preflight becomes unavailable after shutdown.** `deploy.mjs:8` and `cleanup.mjs:11` validate initial output names but discard the output binding. After operator/process shutdown, deploy:17 and cleanup:41 call writeEvidence, whose guard.mjs:133 runs livePreflight again, rereading target/env/key/provenance. A failure there prevents the operation receipt even though work already occurred. The qualification driver correctly retains validatedOutput and uses writeDriverReceipt, proving the required pattern is available, but it is restricted to qualify basenames. Apply the initially validated exclusive binding to deployment and cleanup result/error finalization too, retaining canonical/no-alias/exclusive checks without a second target/key dependency. This finding is from the exact source path; no live deployment/cleanup or target/key mutation was performed to demonstrate it.

### Minor

4. **Advertised driver discovery is35, actual final discovery is34.** README/report repeatedly state35 driver assertions; the preserved final2-driver.txt and driver-check-d5211e5c-0792-4763-8d71-64fba648fbcf.json both say34. Both successful independent replays likewise discover34 with skipped0. Correct the documents/count or supply the missing meaningful assertion; do not relabel34 as35. The live case list remains exactly41.

No additional accepted-byte, SDK package, target-selector, private output, archive preservation, type or scoped lint defect was found. The accepted native helper ambiguity issue remains a separate unresolved dependency; it is not downgraded or certified by this review.

## Dimension Scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement Fulfillment |2/5 |Major original repairs verified, but exact negative classification and stable descendant finalization fail; deployment/cleanup binding criterion incomplete |
| Code Quality |3/5 |Clear parent/child boundary, explicit bounded calls and ledger; substring context parser and leader-only cleanup completion need repair |
| Test Quality |2/5 |Many exact data/effect assertions; independent falsepositive controls contradict negativePASS claim; actual required process check fails intermittently |
| Pattern Adherence |4/5 |Exact accepted source, official CLI/clients, separate native type configs, owned scratch and honest scope/OS limits |
| Completeness |2/5 |Offline candidate cannot meet its remaining adoption guarantees; three entrypoint output/finalization paths need consistent completion |

**Average:2.6/5.** Judge-task requires Requirement Fulfillment5 and every dimension at least4 for PASS. The supplied35-check claim and later passing replays cannot override the independent failures. No requirement or assertion was weakened during this review.

## Recommendations

Preserve this rejected second freeze and all raw receipts. Within the remaining bounded harness repair cycle, fix the diagnostic context/body parser, bounded group terminal-state verification and initial-binding deployment/cleanup receipts; correct discovery documentation; rerun affected original and new meaningful offline checks, freeze and obtain a fresh independent verdict. Keep the accepted4fb/c92 dependency freeze until the parent separately authorizes the independently qualified native helper refresh. No actual target/service phase should proceed from this verdict. After every dependency/harness gate passes, the parent must execute official guarded codegen, all41 real cases, owned fencing and exact project retirement, followed by an independent service verdict. All broader goal requirements remain pending.
