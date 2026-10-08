# Task Judgment: Task03C2 offline live-harness preparation, review 1

## Verdict: REJECT

The freeze at `2026-10-03T11:58:44.330089+00:00` is byte-exact and its offline guard, SDK, type and lint checks pass. It is not ready for parent service use: the planned SDK logout assertion cannot establish cessation of delivery from a working subscription, the advertised request bounds do not cover many requests, the process ceiling loses the case receipt and can orphan trusted operator children, the SDK child rereads the deployment key despite its claimed isolation, and generic CLI/network permission errors can satisfy operator authorization-negative assertions. No backend implementation defect is inferred from these harness defects.

This verdict concerns offline harness preparation only. All 41 service outcomes remain UNEXECUTED. Whole Task03, Task09, canonical run/tool/transcript semantics, storage/private bytes/uploads/connector callbacks, automatic maintenance and UI remain PENDING. The rejected uncommitted memory/facts/schema/helper work is outside this verdict and must not be deployed.

## Evidence Review

Target: `/workspace/Project-Cortex`, branch `feat/convex-backend-runtime`, accepted HEAD `4fb3482c5e06fcab12ab8513b242a066ef761f2f`; backend accepted commit `c92d548368791386c62f39895e381ef6bde2dc86`. Read AGENTS, runtime/profile, pessimistic role, judge-task rubric, implementation prompt, authoritative decisions, architecture, goal and original Tasks03/09. Read every candidate executable script and the frozen provenance/report/matrix. Also read the separate parent provisioning helper without executing it.

Independent receipts are exclusively under `/tmp/task03c2-live-harness-review1-7m04c8w4`. Canonical candidate and Git status before/after are identical (`preservation.json`). No service/network/deploy/codegen/inference/target creation/signing/key generation/stage/commit operation occurred. No child agent was spawned. The existing private RSA was read only by the public-key comparison; neither PEM nor JWT/key material is in these receipts.

| Observed check | Result | Raw evidence |
| --- | --- | --- |
| 37 frozen guard cases, byte-exact private replay | 37 PASS, 0 skipped; network/subprocess/output 0 | `replay-repo/.../task03c2-live-fixture/evidence/guards-*.json` |
| Four actual frozen entrypoint imports in private replay | 4 PASS; network/subprocess/output 0 | `replay-repo/.../task03c2-live-fixture/evidence/entrypoints-*.json` |
| Original six offline prep assertions | PASS; final evidence write redirected to private review directory, canonical writes 0 | `client-prep-*.json`, `client-prep-interception.json` |
| Supplemental six assertions directly on packed SessionsAPI/HostCredentials | PASS; maintenance dispatches 0, invalid-credential operation callbacks 0 | `packed-offline.json`, `packed-offline.mjs` |
| Existing RSA/JWKS comparison | Match; new keys 0, signed tokens 0 | `packed-offline.json` |
| Accepted byte provenance | All 14 fixture copies equal both accepted commits; all 129 private archived SDK source/config bytes equal accepted HEAD | `integrity.json` |
| Private pack | SHA256 matches; 53 entries all equal extracted bytes; Cortex/HostCredentials/SessionsAPI/SessionCapabilityError/createAuthContext callable | `integrity.json`, `packed-offline.json` |
| Frozen/public/private inventory | All freeze and 69 public/202 private inventory hashes match; 71 current public files include inventories | `integrity.json`, `preservation.json` |
| Historical QA | 107 listed archives unchanged | `integrity.json` |
| Strict unchanged ES2021/DOM backend config | exit 0 | `commands.json`, `backend-types.txt` |
| Separate strict Node client type project | exit 0 | `commands.json`, `client-types.txt` |
| Actual root house scoped lint | 23 files, 0 errors/fatal, 21 warnings from accepted backend | `commands.json`, `scoped-house-lint.txt` |
| Frozen private selector applying the existing backend rules | 23 files, 0 errors/warnings/fatal | `private-selector-lint-command.json`, `private-selector-lint.json` |
| Ancillary root lint result supplied by parent | Actual npm12.2 root lint exit0, 0 errors/137 warnings; code-quality evidence only | canonical `qa/ci-followups/sdk-metadata-root-lint-rerun.{json,log}` inspected, not rerun by judge |
| Public secret-pattern scan | No PEM/signed JWT/deploy-key matches after recognizing the explicitly public offline standin | `integrity.json` |

The replay copies preserve script/source/provenance bytes and place every guard-test temporary path and evidence path under this fresh `/tmp` tree. No trusted key, live target, or private environment was copied. The original client prep was separately executed against the actual accepted private SDK with only its final write intercepted. The supplemental packed probe avoids relying on source-only SessionsAPI class identity.

## Requirements Review

| Requirement | Met? | Evidence / limit |
| --- | --- | --- |
| Restrict deployed fixture to accepted03A/03C1/03B2A metadata and accepted03C2-A SDK | Yes offline | 14 exact copies and 129 accepted SDK bytes; no rejected memory/facts functions in functions directory |
| Preserve historical107 QA and rejected dirty work | Yes | Independent hashes and before/after status; ancillary old helper handled separately below |
| Canonical paths, owned0700 scratch, owned0600 key/env/receipt, reject aliases/hardlinks, output exclusivity | Yes offline | guard.mjs:20-36,39-66,95-107; 37 guard/four entrypoint replay outcomes; secure key metadata verified; live env/receipt absent |
| Exact fresh qualification-auth request/name/slug/dev/cloud/URL/key/selectors; reject shared/prod/retired/product/mismatches before effects | Yes offline | guard.mjs:69-91; concrete project-request.json; invalid-path/selector replay; parent must still verify actual management state |
| Official Convex HTTP/reactive and actual packed consumer; real Node ws8.21/proxy/CA, no live mock | Prepared | client.ts:5-12,19-20; reactive-transport.mjs uses actual ws and exact wss origin; no live execution |
| No upstream/model/deploy key in SDK child | **No** for claimed child isolation | qualify.mjs:6 deletes env key, then passes private env-file selector at10; client.ts:19 calls guard which reads deploy.env and reconstructs full env at guard.mjs:105,113-114; operator.mjs:13 rereads it in the same child. Actual SDK/client construction uses JWT/endpoint and receives no deploy key in its config. Original Tasks03/09 establish that product boundary, but do not authorize claiming absent key access in this separately delegated child |
| Internal-only controls use official1.46 run --env-file; no SDK admin seam/public wrapper | Yes prepared | operator.mjs allowlist and officialCLI argv; official installed source uses admin auth internally. Public negatives are prepared in client.ts:194-210 |
| Real codegen uses dev --once --codegen enable --typecheck enable --tail-logs disable --env-file | Yes prepared | deploy.mjs:10-12; installed official dev.ts exposes these choices; standalone codegen has no env-file seam |
| 41 discovered outcomes with exact data/effect assertions and honest service state | Partial | Matrix exactly 41 UNEXECUTED; many meaningful prepared assertions, but logout and termination receipt gaps below |
| Twelve-second request/observation bounds,25-second operator bounds,10-minute ceiling | **No** for request/result guarantees | denied/waitFor bounded; many successful HTTP requests unbounded; hardkill has no fallback receipt/process-tree cleanup |
| Dependency BLOCKED vs actual assertion/service FAIL | Partial | Outer setup catch leaves not-reached cases BLOCKED, but test() makes every error FAIL, including provision/setup failures inside revocation(); no explicit dependent-case gating |
| Actual authorization denial rather than arbitrary network/timeout failure | **No** for operator classification | Public denied() requires known Convex/protocol auth classification; operatorDenied requires a specific sanitized message, but operator.mjs constructs that message from generic FORBIDDEN/Access denied stderr substrings |
| Private callback/error/log sanitization | Yes prepared | bounded in-memory diagnostics; suppressed raw client log output; allowlisted failure code/attempt fields; no raw payload in public receipts |
| Reactive wrong scopes, grant/principal/membership/scope/resource deletion | Prepared | Explicit denial, authorized baseline values, denied subsequent calls, trusted-reference recheck, changed-data quiet windows and stopped subscriptions; remains unexecuted |
| Packed SDK refresh/logout/late token/privacy/session capability | Partial | Refresh/late-token/query/header/callback/capability assertions prepared; logout callback ignores every delivery and lacks prior positive observation |
| Ordinary logout differs from trusted grant revocation; session ending differs from grant revocation | Prepared | Background counter increment after logout, zero memory effect after revoke, and recheck/data access after session end; session worker refuses ended sessions in accepted source |
| Owned UUID fixture cleanup and exact parent project retirement; no global purge | Prepared | Private ledger records trusted provision results, prefixes fence fixture scopes/users and principal IDs; cleanup only scope/principal tombstones; physical project retirement explicitly parent-owned and unexecuted |
| Root/SDK/browser/run/storage/media/UI whole-goal claims remain pending | Yes | README/report/matrix explicitly deny whole03/09/UI certification and retain Task05/12/13 pending semantics |

Original Task03 requirements map as follows: the bounded inventory/principal/grant/bootstrap foundation is an accepted-source dependency; the metadata alternate paths/JWT scope tests are prepared here; complete public memory/facts/conversation/search/share/artifact/attachment/graph/policy closure remains pending; transcript unlock/revision bookkeeping is Task05 pending; background metadata/session reference checks are prepared; actual tool/upload/download/private callback/share semantics remain pending. None is silently dropped or marked whole-task complete.

Original Task09 requirements and acceptance remain pending: versioned start/get/observe/cancel/approval/memory receipts, AI SDK7 remote-run UI/backend tool, separate final response/indexing status, strict barriers/context overflow, actual managed recall/tool/finality/pending-tail, reconnect/cancellation/approval, equivalent TS/UI semantics and a Tasks01-09 standalone slice. This fixture supplies only accepted metadata/auth transport preparation and a packed browser-safe client consumer dependency; it does not satisfy the original vertical slice.

## Issues Found

### Critical (must fix; blocks parent service use)

1. **Logout can pass without ever having delivered an authorized observation, and ignores post-logout data.** In `scripts/client.ts:260-270`, the success callback is `() => {}`, logout happens immediately after subscribing, and the only observer assertion waits for a denial. An observer that never authenticates can pass; an observer that also delivers private data after logout can pass because successes are discarded. Require a positive authorized callback with the expected value before logout, record deliveries, perform a trusted owned writer update after logout, assert zero unauthorized deliveries over the stated quiet window, and retain stop/close ownership. Apply equivalent delivery fencing to the late-credential subscription scenario rather than relying only on a query after50ms.

2. **Request bounds are incomplete and the hard ceiling loses evidence and child ownership.** Examples of unbounded successful service awaits are `client.ts:134,137,152-153,166-171,190,218,240,256,276,294,298,302,306`; they bypass bounded(). `qualify.mjs:16` SIGKILLs the client, while the only 41-case receipt is written by that client in its finally block (`client.ts:311-323`). A hang therefore produces no discovered-case receipt, and any concurrently running official CLI operator child is not reaped by killing its parent; its25s timer belonged to the killed client. Bound each request/setup/cleanup path, track the full case ledger in the trusted driver or checkpoint it, emit a sanitized41-case failure/incomplete receipt on abnormal termination, and own/reap all spawned operator processes before concluding the invocation. The receipt must distinguish reached failures from dependency-blocked cases, even on timeout/crash.

3. **The stated deployment-key isolation of the SDK child is not implemented.** Removing CONVEX_DEPLOY_KEY from its environment (`qualify.mjs:6`) is undone as a boundary claim when `client.ts:19` calls livePreflight and `operator.mjs:13` calls it again: guard.mjs:105 reads deploy.env and113-114 return the full deployment-key environment inside the SDK child. No key exposure into SDK config, client bundles, or public evidence was found, and a trusted operator legitimately needs the private key. The frozen README:52-54/report claim that this child has no deploy key, however, is false and conflicts with the delegated isolation contract. Move trusted private preflight/operator/signing/ledger/evidence responsibilities to the parent driver, give the SDK child only the qualified endpoint/JWT/test references and a bounded allowlisted parent-owned operator protocol, then add an offline assertion that the child never reads the private deploy env/key and never receives a deploy-key value. Do not merely remove the sentence or label the reconstructed environment key-free; the original product boundary and the narrower delegated isolation must both remain honest.

4. **Generic CLI/network permission errors satisfy operator authorization-negative assertions.** `operator.mjs:32` classifies any exit1 stderr containing `FORBIDDEN` or `Access denied` as the exact `Operator authorization denied.` message accepted by `client.ts:67-69`. The same predicate returns true for proxy connection denial, a generic network FORBIDDEN error, or an env-file Access denied error; none demonstrates accepted runtime authority rejection. `operator-denial-predicate.json` records this offline analysis against the exact frozen expression without calling the operator. Require the official function invocation's actual accepted backend ConvexError diagnostic/structured payload and its FORBIDDEN code, fail closed on transport/CLI/file/proxy permission errors, and add offline classifier assertions for both accepted denial and unrelated permission failures. Preserve privacy by parsing only in memory and retaining allowlisted result codes.

### Important (should fix in the same bounded harness revision)

5. **Dependency status handling is inconsistent with the advertised contract.** `client.ts:117-120` assigns FAIL to every exception. Provisioning prerequisites inside `revocation()` occur at132-133; operator setup unavailability there becomes a failed authorization outcome. Later outcomes also run after foundational data/session creation failed. Add explicit setup/dependency transitions so the prerequisite gets the appropriate failure/incomplete reason and dependent outcomes are BLOCKED, while actual auth/data/effect assertion failures remain FAIL. No network/timeout failure should satisfy a negative authorization case.

### Minor

No additional blocking source, package, lint, archive, target-selection, privacy or cleanup issue was found within this bounded preparation scope. The25000/12000/750ms observation limits are bounded evidence, not universal future nondelivery guarantees, and the frozen documents correctly acknowledge that limitation.

## Test Coverage Analysis: all41 prepared outcomes

Every row below is UNEXECUTED for service behavior. “Prepared” describes the meaningful assertion in source, not observed service PASS. Shared timeout/dependency defects affect the matrix as a whole.

| Case | Prepared assertion / gap |
| --- | --- |
| operator-provisioning | Four owned trusted principals; distinct principal IDs |
| valid-owned-metadata | Exact immutable version, mutable value, session counter and absence of internal reference |
| missing-identity | Read and write produce accepted auth denial |
| forged-signature | Read and write produce accepted auth denial |
| wrong-issuer | Read and write produce accepted auth denial |
| wrong-audience | Read and write produce accepted auth denial |
| expired-token | Read and write produce accepted auth denial |
| wrong-tenant | Read/write FORBIDDEN |
| wrong-space | Read/write FORBIDDEN |
| owner-denied | Other own principal read/write FORBIDDEN |
| explicit-space-read | Broader READ returns exact value; WRITE denied |
| admin-alone-read-denied | Admin without READ is FORBIDDEN |
| admin-alone-write-denied | Admin without WRITE is FORBIDDEN |
| ambiguous-omission-denied | Multiple trusted scopes reject omitted scope; exact prior value unchanged |
| actor-binding-denied | Other actor immutable identity/session creation denied |
| caller-metadata-no-principal | Caller metadata/claims do not provision trusted identity |
| public-internal-provision-denied | Provision/revoke/delete/tombstone/authorize/recheck inaccessible through public JWT client |
| public-internal-maintenance-denied | Increment/expireIdle remain internal-only |
| immutable-delete-read-denied | Tombstone denies read |
| immutable-delete-write-denied | Tombstone denies recreation |
| mutable-delete-read-denied | Tombstone denies read |
| mutable-delete-write-denied | Tombstone denies recreation |
| negative-effect-counts | Exact prior mutable value/immutable version/session zero counter; needs baseline dependency gate |
| reactive-wrong-tenant | Authorization error and zero successful callbacks |
| reactive-wrong-space | Authorization error and zero successful callbacks |
| resource-deletion-subscription | Positive exact baseline, subsequent denial, recreation denied, quiet-window unchanged delivery count |
| grant-revocation | Positive exact baseline, read/write/recheck denial, other authorized writer update, unchanged delivery count |
| principal-deletion | Same controls for deleted principal |
| membership-revocation | Same controls for revoked membership |
| space-deletion | Same controls plus broad writer/provision recreation denial |
| tenant-deletion | Same controls plus broad writer/provision recreation denial |
| sdk-metadata-consumers | Actual packed session create/get and user update/get exact values/no authority reference |
| sdk-refresh | New host JWT, reactive/HTTP exact value, force-refresh callback observed; HTTP positive unbounded |
| sdk-logout | **Gap:** no positive observer baseline or observed post-logout delivery counter; query denial/empty headers alone insufficient |
| sdk-labels-no-authority | Packed SDK caller labels/admin claim with nullJWT get UNAUTHENTICATED |
| background-after-ordinary-logout | Trusted reference increases exact session messageCount to1, independent of ordinary host logout |
| late-credential-fencing | Old pending token followed by null is fenced for query; **gap:** reactive delivery not counted and fixed50ms wait |
| sanitized-host-callback | Exact failure keys, only sanitized host-token code, unauthenticated query, successful recovery and cleared failure |
| sdk-session-capability | Packed capability error code/outcome; active session remains unchanged; zero dispatch independently proved offline |
| background-after-revocation | Old trusted reference denied worker effect; auditor reads exact memoryCount0 |
| session-end-not-grant-revocation | Ended session status; independent scoped read and trusted recheck still work |

## Ancillary lint-only changes

`eslint.config.js` adds exactly one project-selection override for the new fixture backend/client paths. No ignore or rule changes were introduced. The historical metadata-cycle3 helper changes only unused `{ line: _line, ...row }` destructuring to an equivalent own-enumerable object spread followed by `delete row.line`. All assertions are unchanged. Original helper bytes match accepted Gitc92 at SHA256 `e668463ba73703a3a08d0edb664ef7c46d3aa82d65b66e0fd30aed30d8d31891`, preserved in `qa/ci-followups/history/metadata-cycle3-pre-lint/verify.mjs.text`; original artifact-hashes and freeze also match accepted Git and current canonical files. I did not execute the historical verifier that writes canonical verification. These ancillary changes PASS their narrow lint/provenance review; they are not a fourth authorization implementation repair.

Parent root lint receipt covers the actual dirty checkout and records that distinction. Its successful exit is code-quality evidence only. Independent actual house scoped lint found21 warnings from accepted backend code; the private selector applies the existing backend rule policy and has0 warnings, consistent with the frozen scoped result. Neither outcome certifies rejected MF auth correctness.

The parent-only management helper has exact fresh request/type verification, observed project/deployment binding,30s management timeouts and an exclusive0600 ownership record immediately after creation for partial-provision recovery. It was inspected only; project creation must wait until a revised frozen candidate receives an independent PASS.

## Dimension Scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement Fulfillment | 2/5 | Offline provenance/guards pass, but delegated child isolation, complete bounded evidence and logout delivery requirements are unmet |
| Code Quality | 3/5 | Clear guards/privacy/official API choices; unbounded awaits and unowned process descendants undermine failure handling |
| Test Quality | 2/5 | Strong data/effect tests, but generic operator permission failures can pass negative cases; logout can pass with a never-working observer and late reactive delivery is absent |
| Pattern Adherence | 4/5 | Accepted exact backend, separate configs, official CLI, typed SDK and private ownership/evidence conventions |
| Completeness | 2/5 | Service harness is not reviewable on timeout/crash and cannot fulfill its SDK-child isolation claim |

**Average:** 2.6/5. Under judge-task, any dimension at2 requires REJECT. The preparation report's COMPLETE label is scoped honestly to offline work, but it does not override missing necessary harness guarantees.

## Recommendations

Preserve this rejected freeze and receipts. Make one bounded harness revision addressing the five findings without changing accepted backend/SDK source or weakening assertions; rerun offline guard/actual-entrypoint/packed SDK/type/lint/provenance checks; freeze a new candidate and obtain fresh independent review before parent target creation, deployment/codegen or service calls. On a later PASS, execute all41 real cases, observe owned cleanup and exact project retirement, and obtain a separate final service qualification verdict. Preserve all original Task03/09 pending requirements.

## Binding hashes

| Artifact | SHA256 |
| --- | --- |
| source-freeze.json | `8a2b01205fda1fd3edbf371983090062729e9e7002ff3a22a7ee0122edbfc75b` |
| report.md | `dc6036f8058f8de6a649851a0978c5f16c76c68d6f6c90b2fd643433f5969221` |
| file-inventory.json | `375c50fbd00a63e12563dbf24a3886506feb664b7b74e1e228504c9194eab7fb` |
| private-file-inventory.json | `f718db8bdffe6a219b36f245443930c55be390ecf297dca5ac3780e4ee400670` |
| source-provenance.json | `9e316d793381cf996d2b01a21fa96b7cb33cf39d12937d39f85d93a3c08fc74f` |
| sdk-provenance.json | `e9cfa5fe7509c69e0398bd0956840624612405e7c186c20d181f4c709b9c1655` |
| private npm pack | `cd97dabc1428e2dc7f217bf316aff0d7bf4ebf0d843a214a5777a2228275193d` |
| parent root lint rerun receipt | `38219067cec812ec105c635b8684ea7d5c3fa738618c240e97bb2559a3933072` |

`manifest.json` binds every independent private raw receipt/script and replay byte to its hash, excluding only itself to avoid recursive self-hashing. These review artifacts are private handoff evidence, not canonical QA writes or user output deliverables.
