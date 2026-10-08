# Task Judgment: frozen Task03B2C1, cycle2

## Verdict: REJECT

The three cycle1 defects are repaired, but the original independent READ/private-output requirement still fails on streaming error responses. A WRITE-only space editor can read another canonical owner's stored streaming session ID by providing a wrong session ID. Six selected public handlers return that private value in ConvexError data before any mutation. The success-only safe-receipt gate does not cover these errors.

**Scores:** Requirement Fulfillment 2, Code Quality 3, Test Quality 3, Pattern Adherence 4, Completeness 3. **Average: 3.0/5.** This is the second completed independent cycle, not acceptance of whole C2/Task03/Task12 or the goal.

Candidate: `/workspace/Project-Cortex/work/backend-runtime/task03b2c1-checkout`.
Reviewed base: `c0c40423b52e133b9a51f04d07fd21d38f27c7f2`.
Freeze: `2026-10-03T11:55:35.271839+00:00`.
Freeze SHA256: `f148cf3740d422585743484c2acb19a9add3419f2e3adedd0388499f66ff0416`.
Private outputs: `/tmp/task03b2c1-review2-3it_0vsh`.

This review was read-only. No candidate source/test/QA/freeze/config/schema/generated/index/build file was edited. No build, deployment, service operation, storage access, paid call, stage, commit, push, merge or child agent was performed. All new probes, command receipts, catalogs, caches, verification records and this report are private scratch files. A combined historical-report read accidentally used main for a source excerpt; that excerpt was discarded as candidate evidence and immediately replaced by the explicit frozen-candidate read. Main's rejected memory/fact and concurrent work are not adopted.

## Evidence Review

Read AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge and judge-task; original implementation prompt, goal, Tasks03/05/12, authoritative decisions and architecture; candidate report/contracts/requirements/freeze and all six allowed source/test files; accepted03A runtimeAuth/verified contracts; schema; excluded registrations; inventory/baseline/check writers; historical rejection and preserved raw probes.

All 246 frozen source/evidence records match before and after execution. An independent blob comparison of all 1,828 tracked base files finds only artifacts.ts and schema.ts changed; the guard plus three tests are the permitted new code files. Schema diff is confined to artifacts' optional owner/actor/tombstone fields and two scoped indexes. All attachments/auth/generated/manifests/configs and schema outside artifacts are unchanged. All 95 cycle1 preservation records and 73 pre-codec preservation records verify exactly; the original 84-outcome handler file remains a byte-identical prefix. No history normalization or overwriting occurred.

Independent compiler/lint/discovery/native/catalog/whitespace checks all exit0: actual unchanged backend ES2021 config, explicit scoped ES2021 config, root compiler, original tracked c0c compiler-host overlay, ESLint zero warnings, exact two-suite discovery, native handler tests, native AST inventory and git diff --check. Both root compilers have zero diagnostics. Direct Node24.19.0 executed installed TS6.0.3, Convex1.46.0, Jest30.5.2 and ESLint10.11.0; no install/fetch was needed. The candidate's npm12 context is retained in its frozen evidence. Reviewer Jest/cache/catalog outputs were rerouted to scratch; ordinary inventory tests own mkdtemp output and remove it in finally.

Native result: 2 suites, 133 passed, 0 failed, 0 skipped/pending/todo. Every assertion case has meaningful outcome assertions. The new 49 cases cover repaired create admission, repeated conversation/memory owner/content/version/anchor/lifecycle edges, pre-hydration predicates, native codec compatibility and positives. Native codec uses the official Convex Value conversion, retains int64/bytes/NaN/infinities/negative-zero distinctions, sorts object keys, keeps typed optional-scope keys separate, and sanitizes codec errors before effects. This removes the native-value gap without a JSON-only metadata restriction or dependency change. The narrow Value assertion is a codec validation seam; malformed values are caught, not silently treated as native-valid.

## Issues Found

### Critical: private session metadata escapes without resource READ through errors

`convex-dev/runtimeArtifactAuth.ts:173-175` records unavailable READ; `:219-224` also permits a safe write receipt when independent scope READ cannot read the canonical owner. `:403-407` applies this restriction only to successful results. Streaming handlers throw row-derived ConvexErrors directly before complete:

| Handler | Private-output location |
|---|---|
| appendContent | artifacts.ts:932-934: private session in message and expectedSessionId |
| pauseStreaming | artifacts.ts:1015: private session in message |
| resumeStreaming | artifacts.ts:1083: private session in message |
| cancelStreaming | artifacts.ts:1157: private session in message |
| finalizeStreaming | artifacts.ts:1238: private session in message |
| setStreamingError | artifacts.ts:1355: private session in message |

A private probe gives a verified principal one `capabilities:["write"], resourceAccess:"space"` grant, a correctly scoped text artifact owned by another canonical principal, and stored `streamingMetadata.sessionId:"private-owner-stream-session"`. Each handler is called with `sessionId:"guessed"` and otherwise valid args/state. All six reject `STREAMING_SESSION_INVALID`, all six error payloads contain the exact stored private session, and all six attempt zero mutations. appendContent additionally returns `expectedSessionId:"private-owner-stream-session"`. No READ grant exists.

A separate negative control supplies an independent tenant READ-own grant. Explicit `get(artifact-a, space-a)` rejects FORBIDDEN on the foreign canonical owner, but appendContent still returns that owner's session ID. An authorized tenant READ positive control can read the same metadata. Thus this is a missing resource READ output check, not missing identity or a wrong-scope fixture. No concurrent mutation or synthetic snapshot race is involved. Convex's native `invokeFunction` catches and serializes ConvexError.data through `serializeConvexErrorData` (`node_modules/convex/src/server/impl/registration_impl.ts:92,112-124`); this deliberately thrown data is externally visible, not a local debug-only message.

Related invalid-state branches expose row-derived `currentState` in start/append/pause/resume/cancel/finalize/error/retry errors at artifacts.ts:856-857,922-923,1004-1005,1072-1073,1140-1141,1227-1228,1344-1345,1411-1412. These share the same success-only output gap; the six private-session cases are the independently replayed decisive proof.

This violates independent READ before private write output. WRITE permission deliberately allows a bounded operation with only a safe receipt; it is not READ permission. Remove private row values from these error messages/data, or route all row-derived error output through an already-admitted resource READ/currentness gate. Do not newly adopt READ on an error path. Keep typed error codes and add no-READ and scope-READ-but-owner-denied negatives for every affected handler. Cover state metadata as well as session IDs. Generic errors are sufficient and avoid adding a new READ decision.

Raw proof: `write-error-output.mts`, `write-error-output-results.json`, raw stdout/stderr/receipt; `write-error-output-controls.mts`, its results and raw logs/receipt. The control probe's initial positive setup omitted explicit concrete scope for a tenant-wide READ and failed before the intended positive read; exact `.initial` source/log/receipt are preserved. The corrected control uses explicit registered space-a, with denial/authorized assertions retained.

### Important:133 passing outcomes miss private error-response admission

`tests/unit/runtimeArtifactAuth/handlers.test.ts:92-100` and cycle2 safe-receipt controls cover successful WRITE-only operations, and happy cases cover actual streaming outcomes. They do not assert that failed streaming operations hide stored session/state metadata when READ is absent or denied on the owner. The private reproduction passes its assertions because it confirms the defect; its exit0 is not acceptance PASS.

### Minor

No additional blocking source-scope or codec defect found. Live deployment/validator/transaction/storage limitations below remain explicit pending work, not code-review success.

## Original bounded requirements review

| Original requirement | Met? | Evidence / disposition |
|---|---|---|
| Exact selected 22,21 guarded public and 1 operator internal | Yes structurally; closure fails Issue1 | AST inventory 22/21/1, 0 unresolved; exact registrations below. |
| Five named file registrations AST byte-unchanged; all attachments unchanged; remaining 17 pending | Yes | frozenFilePaths all unchanged; all tracked preservation includes attachments; explicit pending contracts. |
| Six allowed code files; schema only optional artifact owner/actor/tombstone/scoped indexes | Yes | 1,828 tracked comparison, six-file freeze and inspected schema diff. |
| Independent accepted03A only; no rejected guard/fixture dependencies | Yes | runtimeArtifactAuth imports runtimeAuth, verified types, generated types; actual independent artifacts fixture. |
| Exact Convex-verified issuer/subject, trusted principal/membership/grants/current generations | Yes | begin:159-177, accepted03A resolution; missing identity on all 21; forged issuer/labels/wrong-scope negatives. |
| One eligible tenant/registered concrete space; omitted selectors unique only | Yes | begin requires concrete authority.memorySpaceId; accepted current registered scopes; no global scan/adoption. Additional explicit tenant-grant narrowing control. |
| Caller labels no authority; admin no READ/WRITE wildcard | Yes | Explicit capability policy; forged labels and independent admin-only get/update probes deny zero attempts. |
| Canonical artifact owner/lifecycle before hydrate/count/limit | Yes | candidates:181-192 and list:252-267; foreign-first and own-vs-other-owner query-ID assertions; tombstone controls excluded before collect. |
| Exact trusted-key Boolean collision full-fetch exception only, immediate discard | Yes | collision:269-283 exact by_runtime_key first used only as Boolean; normal candidates retain owner filter. |
| Initial WRITE and independent READ before effects; safe initial absence; no later READ adoption | Partial / fail | begin/admitResource/insert capture before effects; initial absence stays safe on successful returns, including newly added separate READ. Errors bypass private-output READ. Issue1. |
| Later admitted READ/WRITE failure denies and rolls back, including create | Yes on examined effect/delivery paths | create resource requirements admitted from expected row before insert; original create revocation probe now denies one reached insert,0 commits. Additional exact READ generation/version/membership/space epoch replacements create/update deny one attempt,0 commits. |
| Full immutable source plus every typed link/version/anchor retained across all candidates | Yes | remember:194-201 refuses changed repeated snapshot; SourceEdge witnesses retained in array; only advanceExpectedArtifact:202-209 advances local expected artifact changes. Repeated-source4/4 and conversation/memory/native regressions. |
| Current controls through final sensitive DB await; expiry after final DB/local policy awaits | Yes within Convex transaction snapshot, except private error output scope gap | checkpoint:346-360 and controlSnapshot:105-148; reached final-await expiry test; retained exact grant generations. No impossible atomic reread demanded. |
| Canonical conversation before artifact label association; independent linked READ/control before private query | Yes | getByConversation:575-591; conversation:284-313 and memory:315-334; READ and requireLiveKey precede collect. |
| Actual ownerless current conversations fail closed before messages; typed source seam not actual05 | Yes | structural owner predicate before collect at293-302; current schema unchanged; typed fixture owner explicitly qualified. |
| Exact source owner/lifecycle/version/history/anchor ties; no private source/tool/reasoning serialization | Yes | source predicates before collect; full source and message snapshot plus unique requested anchor; safe version check; sources never copied into output. Repeated changed native source denies; reordered-key positives preserve witness. |
| Canonical/input versions/counts/progress safe integers, overflow, ordered unique history, gaps/state invariants | Yes for bounded declared behavior | validateArtifact:49-65, nextArtifactVersion:46-48, handler safeInteger calls; native overflow, malformed history, fractional pagination, gaps/branch/state/session/UTF-8 outcomes. |
| Text CRUD/history/gaps/branch/undo/redo/all stream state metadata available with meaningful outcomes | Functional Yes; security acceptance incomplete | All 21 happy native handlers assert actual stored/output behavior; full stream finalize history; Issue1 blocks safe error delivery. |
| Verified actor owner/editor distinct; derived changedBy/last actor/deletedBy | Yes | create:87-104, central patch:363-372 and tombstone:388-400; native actor outcomes and added cross-owner editor/delete positive. |
| Retain canonical row/tombstones; no resurrection/control deletion | Yes | public delete retained row/control; collision/tombstones fence reused keys; purge retains foreign/control records/no delete calls. |
| Any current/history file CAPABILITY_NOT_READY before private processing/effects/storage | Yes | validateArtifact file preflight; all 20 applicable non-create selected current-file native matrix, all 20 retained-file independent probes; 0 attempts/no storage. |
| Operator purge exact tenant/space trusted deployment-internal invocation | Yes | purgeAll:505 internalMutation; exact nonempty selectors required before scan; no JWT-admin or URL credential claim. |
| Entire purge batch file/link/malformed preflight before effects; controls/foreign retained/no storage | Yes for examined eligible candidate batches | purgeAll:518-523 before effect loop; independent current-file/history/link/malformed last-candidate probes all 0 attempts; positive two-row batch 4 effects retains foreign/grants. |
| Linked operator cleanup typed unready; unlinked text purge executes; limitation explicit | Yes bounded disposition | linked batch CAPABILITY_NOT_READY before effects; contracts/report preserve canonical cleanup05/12/16 pending, no full lifecycle PASS. |
| Official native value witness preserving int64/bytes/special floats/signed zero/key order; separate optional scope tuples | Yes | payloadWitness:80-86; selector/control keys:88-95; new native tests round trip, changed native values deny/rollback, reorder positives, sanitized invalid-native errors before effects. |
| Actual unchanged backend ES2021 plus scoped/root/baseline/lint/catalog/discovery | Yes | independent raw check receipts; zero diagnostics/skips; actual source/config unchanged. No root build performed. |
| Original84 preserved;133 meaningful native outcomes, discovery2/no skips; failed evidence retained | Yes, missing error READ cases block aggregate | prefix bytes independently identical; native-summary;95/73 archival hashes; original 6/40/4 probes unchanged except scratch path; initial 69/70 history retained. |
| No whole C2/Task03/transcript/private bytes/asset/media/service/goal PASS inferred | Yes | candid scoped contracts; all remaining 17 excluded; service and lifecycle pending below. |

## Exact 22 registration mapping

All rows were found by independent native AST resolution. Each of the21 public handlers has observed missing-identity denial before artifact hydration/effects and an observed actual happy outcome in native 133. “No further issue” means within this bounded offline review, not live/full lifecycle acceptance.

| Registration | Candidate declaration | Disposition and outcome review |
|---|---:|---|
| create | artifacts.ts:49 | Public; create data/verified owner/actor; repaired preinsert READ and rollback probes pass. |
| update | 111 | Public; version3/content/history/actor; generation rollback and safe receipt pass. |
| deleteArtifact | 205 | Public; retained row/control, nonrestorable fence, verified actor. |
| undo | 230 | Public; pointer/content/gaps/redo eligibility. |
| redo | 280 | Public; pointer/content/gaps/undo eligibility. |
| setStreamingState | 332 | Public; actual transition outcome; generic invalid transition. |
| purgeVersions | 425 | Public; initial/current/latest retained, actual pruned history. |
| purgeAll | 505 | Internal; unlinked scoped text tombstones; full obstacle preflight0 attempts; linked lifecycle unready. |
| get | 548 | Public; actual canonical text/history; resource ownership denial. |
| getByConversation | 575 | Public; canonical source first/anchor links; ownerless real schema fails closed. |
| list | 596 | Public; scoped count/pagination/owner/source preflight. |
| count | 643 | Public; owner/lifecycle/source checks precede count. |
| getVersion | 669 | Public; exact version payload/current marker. |
| getHistory | 707 | Public; history/pointer/latest/navigation. |
| startStreaming | 826 | Public; actual generated session/state; row-derived invalid-state error also requires output repair. |
| appendContent | 900 | Public; UTF-8 progress/content; private session error reproduced. |
| pauseStreaming | 983 | Public; state/content/session retained; private session error reproduced. |
| resumeStreaming | 1050 | Public; actual continuation; private session error reproduced. |
| cancelStreaming | 1116 | Public; draft/content behavior; private session error reproduced. |
| finalizeStreaming | 1205 | Public; final/history/version output; private session error reproduced. |
| setStreamingError | 1322 | Public; error/content preserved; private session error reproduced. |
| retryFromError | 1391 | Public; draft/content clear/preserve; row-derived invalid-state error also requires output repair. |

Excluded and unchanged: setFileRef369, generateArtifactUploadUrl1470, completeArtifactUpload1537, getArtifactFileUrl1653, detachFile1723; all 12 attachments remain pending.

## Replay outcomes and transaction qualification

Original probes are byte-identical except the scratch output-prefix replacement, with original/executed SHA256s recorded in probe-provenance. Four repeated-source expectations now all match: unchanged positive resolves; replaced first anchor/content/version denies; all second-query injections reached,0 effects.

Original 40 adversarial cases have 37 matching expectations. Repaired create READ revocation, all three source lifecycle-before-hydrate cases, all 20 historical-file cases, admin-only denial, purge obstacles and positive retention match. The same three final-DB-await cases retain their raw failing expectations and resolve after measured await 67/injection 1: earlier source resource tombstone/anchor/deletion synthetically changes after it was already read. The final read is the unscoped artifact tombstone control for second. They remain qualified mutable-fixture failures, not40-case PASS and not new deployed exploit findings. Real Convex query/mutation reads share one serializable transaction snapshot; no external transaction can replace an earlier source inside that snapshot. Lost/replaced witnesses would still block, but the repaired code now retains them.

Original six exploratory outcomes: both create READ removals deny/rollback; conversation/memory lifecycle cases deny without source IDs; changed postwrite payload denies/rollback; synthetic earlier-source mutation at final control await still resolves as previously qualified. Twelve additional independent generation/safe-receipt/editor/scope cases all assert their expected outcomes. The new six private-error cases and denied/authorized READ controls demonstrate a deterministic output authorization defect without injection. They cannot be explained by serializable-snapshot limits.

## Original Task03/05/12 disposition and practical service limits

Task03 bounded inventory/guarding is partly delivered and still rejected here. Accepted03A supplies exact verified identity/grants; whole 03B/C2 remains incomplete. Client JWT refresh, actual scoped subscriptions/bytes/callbacks, background runs, shares, admin configuration, tools and paid negative cases remain pending. Unit metadata and retained tombstones do not certify every alternate public path. Successful safe receipts and revocation rollback now work, but private streaming errors violate resource READ.

All Task05 requirements/acceptance remain pending: actual Agent-thread mapping/canonical transcript adapter, executable agent definitions, deduplicated transaction admission/reservation/queue/branching, statuses/approval/cancellation, managed lock/unlock with actor/revision/stale-derived detection, crash recovery/projection rebuild and actual component behavior. This artifact slice creates no second transcript writer. Typed source-owner fixtures cannot certify actual current ownerless sources or Agent routing.

All Task12 requirements/live acceptance remain pending: Convex cross-owner asset catalog/video/binary provenance, actual 20,000,000-byte upload/materialization/HTTP cap and cleanup, credential-bearing private HTTP/blob delivery, idempotent ready versions/reference-aware byte cleanup/history/orphans/cancel/cascades, immutable asset lineage, provider input/protocol limits, actual below-cap/oversize/revoked byte tests. No five file paths or attachments are accepted here. Text history/undo and file-denial preflight are observed; complete linked cleanup and file lifecycle are not certified. Task04/14 inference/budgets remain outside this manual text slice.

No deployed Convex validator/transaction commit engine, subscription, Agent/Workflow, storage/HTTP bytes, Gateway/inference, callback, external effect, browser or media behavior was exercised. Native _handler probes use the independent in-memory rollback fixture and actual exported registrations. Source seams carry trusted owner fields the real current conversation schema cannot write. Offline compile and complete base preservation are actual evidence only for the frozen source, not live service qualification.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 2/5 | Independent READ output boundary still bypassed by six selected error responses; other original bounded repairs verified. |
| Code Quality | 3/5 | Clear scoped/immutable/native guard; success-only output gate leaves deliberate ConvexError output unguarded. |
| Test Quality | 3/5 |133 meaningful native passes and original failures retained; no WRITE-only/resource-READ-denied error-redaction negatives. |
| Pattern Adherence | 4/5 | Accepted03A only, preserved excluded code/schema/config, native registration and scratch output ownership. |
| Completeness | 3/5 | Exact 22 wiring and offline checks complete; bounded authorization closure incomplete while error output leaks. |

**Average: 3.0/5.** Requirement Fulfillment <= 2 and missing READ authorization on private output require REJECT. Passing native checks or review-cycle limits cannot override this finding.

## Recommendation and raw evidence

Repair row-derived error output in the selected streaming APIs, add the denied-READ/error-output matrix with positive typed-error/state/session behavior, rerun affected checks, preserve this candidate/rejection/raw outcomes, and use the remaining allowed third completed fresh judge cycle. Keep whole C2/Task03/05/12/16/live/goal gates pending. The reviewer made no implementation edits.

Scratch contains report.md; commands.json plus raw check logs; native-tests.json/native-summary.json; catalog/public-path-inventory.json; original probe sources/provenance/receipts/results; additional generation probes/results/receipt; new private-error probes/results/raw logs/receipts and initial control failure; tracked-preservation.json; history-verification.json; original-test-prefix.json; before/after source verification; tool-versions.json; final manifest.json with file SHA256/bytes. Jest compiled cache is intentionally outside the deliverable manifest. Parent must inspect before canonical preservation/adoption. Source verification and final report/manifest hashes are delivered separately.
