# Task Judgment: frozen Task03B2C1, cycle3 (third and last)

## Verdict: REJECT

The previous create/source/lifecycle and private streaming-error defects are repaired, and all10 affected checks pass. A remaining bounded error-classification defect prevents acceptance: initial READ admission and dependent grant-candidate pruning accept any native ConvexError bearing code FORBIDDEN. Unexpected auth/control diagnostics with private extra fields can therefore become ordinary FORBIDDEN or, during independent initial READ admission, a successful safe write receipt with a committed effect. The strict outer error boundary cannot inspect an exception already swallowed by these catches. This violates the explicit failure/rollback/disposition contract and the requirement that unexpected failures never become FORBIDDEN or success.

This is the third completed fresh read-only judgment of exactly22 selected registrations (21 public text/metadata and1 internal operator purge). It is not acceptance of whole03, C2, Task05/12/16, private bytes, SDK consumers, service/live behavior or the goal. No fourth repair or review was started.

Candidate: /workspace/Project-Cortex/work/backend-runtime/task03b2c1-checkout. Base HEAD c0c40423b52e133b9a51f04d07fd21d38f27c7f2. Final source-freeze: 2026-10-03T12:34:57.395933+00:00, SHA256 4aec358642d0d01f4e668fe09d6ec1c49482148e5ffb3813c4a23d0f565d9675,622 records independently verified before and after. All reviewer writes and logs are under /tmp/task03b2c1-review3-eopdvclu. Candidate/main/source/current QA remained read-only. No codegen, build, network, model, deploy/live/target/secret access, edit/stage/commit/push or agent spawn occurred.

## Evidence Review

Read main AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task and feature-orchestrator; original Task03, Task05 and Task12, goal/implementation context, authoritative decision register and relevant architecture source/asset/auth sections. Read candidate report/contracts/requirements/freeze/change and cycle3 patches/error audit/corrections/preservation/commands, actual six owned files (artifact handlers, independent guard, artifact schema block/diff and all three tests), accepted runtimeAuth/verified contracts, generated schema inference and actual backend configs. Reviewed original cycle1/cycle2 rejected reports, original source/raw probe/assertion evidence, their manifests and the raw failed setup receipts. Main's memory/fact work is not imported or adopted.

All1,828 original tracked blobs were compared with the exact candidate: only convex-dev/artifacts.ts and convex-dev/schema.ts differ; the guard and three tests are the four permitted new code files. Schema changes are confined to optional artifact owner/actor/tombstone fields and scoped indexes. Attachments, authority source, generated bindings, manifests/config/SDK source and schema outside artifacts remain byte-identical. Independent native AST inventory is22 selected/21 public/1 internal/0 unresolved,5 excluded file registrations AST byte-identical. Ordinary inventory test creates its own mkdtemp and removes it in finally. Reviewer catalog/Jest/cache outputs were rerouted to scratch.

Original133 handler-test source remains a byte-identical prefix. Final native execution is2 suites,218 passed,0 failed,0 skipped/pending/todo. The85 appended cases make meaningful exact-data, mutation attempt/rollback, private-output, positive READ-control and actual-handler assertions. All public handlers have actual happy outcomes and missing-identity negatives. Every selected handler has an unexpected-artifact-query diagnostic case. Those cases omit earlier auth/control admission/pruning positions, which explains the new defect.

Initial cycle3 compile failure and210/216 failed native receipt remain intact. The six corrections are legitimate fixture/spec corrections: paused-to-final is valid (artifacts.ts:805), so a draft fixture selects the intended invalid-final-state branch; keepLatest0 is rejected by safeInteger at artifacts.ts:435 before the unreachable legacy string branch. Original133 expectations are unchanged. Later new unknown-error expectations were strengthened to the explicit house contract, and two extra cases added. The original expiry69/70 and all rejected history remain intact; none are relabeled PASS.

## Issues Found

### Critical: permissive initial-admission/pruning catches convert unexpected failure into denial or successful commit

1. convex-dev/runtimeArtifactAuth.ts:219-226 catches any ConvexError with error.data.code === FORBIDDEN when independent initial READ is attempted. It does not require the exact accepted03A shape that safeArtifactErrorData validates at :68-72. A native unexpected error such as {code:FORBIDDEN,message:private diagnostic,privateDocumentId:...}, or the normal authority-shaped error plus a private extra field, sets readable=false and continues. complete at :454-457 then returns a safe receipt after the write.
2. The adapter invokes accepted runtimeAuth.requireAuthority at :213/:222/:336/:367. Its unchanged dependency runtimeAuth.ts:173-177 similarly prunes any materialize error bearing code FORBIDDEN. A malformed permission-looking runtimeAuthScopes diagnostic can be converted to a newly constructed static FORBIDDEN at runtimeAuth.ts:181-183, so the outer boundary sees a legitimate-looking replacement instead of the unexpected failure. On the WRITE phase this misclassifies failure as access denial; on the independent READ phase it feeds the first catch and can commit a safe receipt.

The outer artifactHandler at runtimeArtifactAuth.ts:80-90 correctly hides diagnostics that reach it. The existing six wrong-session and all state-output branches are generic, and no stored session is exposed now. The defect is swallowed failure disposition, not renewed private-session disclosure. It is also not a late-READ downgrade or a synthetic concurrent-snapshot demand: injections happen inside ordinary dependency calls before effects and use actual registered native handlers with the independent fixture.

Fresh exact probes (fresh-boundary.mts/results/summary and raw command/logs) give a normal read/write principal the actual fixture grant and inject one native ConvexError. For both create and update, a second getUserIdentity call throwing either malformed/private FORBIDDEN shape produces {success:true,artifactId:...}, attempts1 and committed1. Content is actually created/updated. The expected result is exact BACKEND_OPERATION_FAILED/version1/retryable:false/outcome:not_committed with zero effects. First runtimeAuthScopes lookup with either diagnostic shape returns ordinary static FORBIDDEN on get/create/update; third scopes lookup (independent READ) on create/update commits1 safe-receipt effect. All injections are reached once.

Controls: normal admitted READ returns the actual payload; exact ordinary denied initial READ retains the intended safe receipt; plain unexpected Error and a throwing native exception getter on that same READ path produce exact BACKEND_OPERATION_FAILED before any mutation. Unexpected errors in pinned later control reads propagate correctly and roll back post-effect mutations. Thus a broad change that removes safe receipts would be unjustified; recognition and propagation must distinguish exact expected authority denial from unknown diagnostics before any catch or candidate-pruning site.

Fresh exploratory matrix:36 cases,21 expected matches,14 failed expectations,1 explicitly unreached post-effect case for a read query (queries have no effects). Its collector exit0 only means evidence was written, not a passing acceptance suite. The14 failed expectations comprise4 identity-READ receipt commits,6 WRITE/query scope-diagnostic FORBIDDEN misclassifications and4 READ-scope receipt commits. No private output escapes these probes, but8 malformed-diagnostic cases commit1 effect instead of failing.

This finding is within the original bounded independent-admission/private-output/failure requirements and the final candidate's claimed error contract. It does not require implementing the17 excluded endpoints or whole accepted03A again. The previously accepted authority helper is unchanged; its composition with this new error boundary remains subject to the scoped failure contract. Protect dependency diagnostics before they can be erased, and recognize only exact permitted safe shapes at every swallow/pruning boundary.

### Important: tests cover artifact-query failure after the early catches, missing the decisive positions

Tests at handlers.test.ts:542-566 inject errors into artifact queries after initial authorization. The malformed getter at :578-586 uses the same late query location. They prove outer redaction, but not auth.getUserIdentity, initial scope lookup or independent READ materialize failures. Add meaningful exact-house-output/zero-effects negatives at these earlier dependency positions, plus existing ordinary-denial and admitted-READ positives, without changing original133 outcomes. Both create and update need coverage; query denial classification also needs a control. This coverage gap is demonstrated by fresh reached cases, not inferred from line/function counts.

### Minor

No additional minor blocker found. No new source retention, native codec, payload-output or ordinary text-flow defect found in the inspected/replayed bounded paths. Pending integration/service limits are explicit below.

## Original bounded requirements mapping

| Original requirement | Met? | Actual evidence/disposition |
|---|---|---|
| Exact selected22/21 public/1 trusted operator internal native registrations | Structurally yes; gate fails error contract | Independent AST catalog; native flags; exact declaration table below. |
| Remaining5 artifact file+12 attachment registrations unchanged and pending | Yes |5 frozenFilePaths AST comparisons true; attachments included in1,828 tracked comparison; report/contracts explicitly pending. |
| Six owned source/test files, schema artifacts-only fields/indexes, preserve other work | Yes | tracked-preservation.json; actual schema diff; only artifacts/schema tracked changes and four permitted new code files. |
| Independent accepted03A adapter, no rejected guard/fixture adoption | Yes | runtimeArtifactAuth imports accepted runtimeAuth/verified/generated types only; independent actual-handler fixture. Dependency pruning interaction noted above. |
| Exact Convex-verified issuer/subject; trusted memberships/grants/generations | Yes for ordinary authorization; unexpected failure classification fails | begin:211-223 and accepted policy; all21 missing-identity cases; forged issuer/labels/scope negatives; fresh control diagnostics. |
| One current tenant/registered concrete space, omitted selectors unique only | Yes | begin:214; normal indexes constrain tenant/space; wrong/ambiguous omissions deny, explicit tenant grant narrowing positive. |
| Caller labels/participants/metadata/kinds confer no grant; admin not wildcard | Yes | original forged labels, admin-only independent get/update denial; no inference/budget authority added. |
| Canonical artifact owner/lifecycle/tombstone before hydration/count/limit | Yes | candidates:233-243 and list:303-316; foreign-first, other-owner and retained resource-tombstone query-ID assertions. |
| Canonical uniqueness; no orphan/adoption/global fallback | Yes | load:298-301 requires exactly1; list:313-316 duplicate IDs deny; explicit trusted scope; unowned rows never adopted. |
| Exact trusted tenant/space/key collision Boolean full-fetch exception only | Yes | collision:320-333 discards server row after Boolean comparison; opaque conflict native outcome. |
| Independent WRITE/READ admission before effects; exact source actor labels | Partial/fail | insert:425-433 admits locally expected resource first; actor fields/create/version/delete preserved. Unknown initial READ diagnostics can be swallowed and written successfully. Critical issue. |
| Initially unavailable READ may yield safe receipt, never newly adopt READ after writes | Ordinary path yes; unknown-error distinction fails | begin/readable and complete; original/create/update later-added READ probes pass. Fresh malformed errors wrongly counted as initial unavailable READ. |
| Initially admitted READ/WRITE retained; late loss/generation/version/epoch denies and rolls back | Yes on examined admitted paths | create same/distinct grant cases; update late principal/membership/scope/resource; original12 generation controls12/12; no READ witness removal after effects. |
| Retain first complete source/row/version/anchor across all candidates | Yes | remember:245-251 forbids overwrite; SourceEdge array and checkpoint:400-405;4 original repeated probes4/4, conversation/memory/native repeats. |
| Only local expected artifact patch advances witness; changed inserted/patched native payload rejects | Yes on tested artifact paths | advanceExpectedArtifact:253-260; patch/insert:414-438; expected codec before effects; post-effect native mutation rollback tests. |
| Exact principal/membership/grant/control/currentness before effects/final delivery | Ordinary controls yes; unknown admission control failures fail | controlSnapshot:152-195, checkpoint:397-412; late controls and final expiry actual reached; early materialize pruning masks unknown diagnostics. |
| Lifetime checked after last DB await and synchronous after local policy awaits | Yes within Convex transaction snapshot | now at :410 plus assertDeadlines at :412; final resource await measured and expiry denial reached. No impossible all-record atomic reread demand. |
| Canonical conversation precedes artifact label association; independent source READ/control before source query | Yes ordinary paths | artifacts getByConversation:585 before list; conversation:335-359/memory:366-382; linked READ negative0 hydration, tombstone negative0 hydration. Unknown auth-control classification caveat above. |
| Current ownerless conversation rows fail before private message hydration; no fake live adoption | Yes | structural owner predicate at guard:345-350; native ownerless source0 returned IDs; current schema unchanged. Typed fresh owner seam explicitly not live03T/05. |
| Exact source owner/lifecycle/version/message anchor; no private source/tool/reasoning output copied | Yes | lifecycle predicates before collect; unique requested message; full native snapshots; typed source tests and source control negatives; private messages not serialized. |
| Full native v.any codec retains int64/bytes/NaN/infinities/signed zero/sorted keys | Yes | official convexToJson:131-136; typed selector tuples:138-145; native create/get/update, repeat-positive and changed-native denied/rollback outcomes. Invalid-native codec inputs sanitized before effects. |
| Safe integer versions/pointers/history/order/uniqueness/gaps/overflow/counts/progress | Yes for bounded declared behavior | validateArtifact:100-117; next version/safeInteger; actual history/branch/overflow/pagination/state/UTF-8 outcomes. |
| CRUD/history/version/undo/redo/streaming behavior remains available | Yes ordinary outcomes; error gate incomplete | All21 actual happy native handlers; full stream pause-final/history; declaration table. |
| Stored session/state/private diagnostics must not escape through errors | Output privacy repaired; classification fails | Constant stored-state/session branches;48 matrix48/48, original6 no-ID output; strict outer safe shapes at :53-90. Early catches defeat failure classification. |
| Unexpected errors distinct BACKEND_OPERATION_FAILED/version1/false/not_committed, never FORBIDDEN/success/rawcause | No | Fresh36-case matrix gives14 failed expectations,8 malformed-diagnostic commits; critical finding. Plain/backend/posteffect/getter controls prove distinction. |
| Failure propagation, no blind retry, late failure rollback, no safeReceipt masking unexpected failure | Partial/fail | No retry loop introduced; post-effect unknown error rollback passes. Initial READ/pruning unknown errors masked as safe receipts/FORBIDDEN. |
| Tombstone retained, no revival or trusted-control/foreign-record deletion | Yes on bounded paths | delete:216-220; guard:439-450 retains artifact row+resource control, source/row and scope READ witness still checked after intentional resource retirement; repeated create/update deny; operator retains controls. |
| File current/history fails CAPABILITY_NOT_READY before effects/storage/private file work | Yes | guard:103-105; original20 current-file native matrix and20 historical-file independent cases;0 attempts; no selected storage effects. |
| Internal purge exact scope/trusted deployment operator, ordinary JWT no operator privilege | Yes | artifacts:505 internalMutation; concrete selectors:514; native visibility; no JWT-admin/URL credential claim. |
| Whole internal batch file/link/state preflight before first effect, controls/foreign retained | Yes for bounded eligible batches | artifacts:517-522; four obstacle cases0 attempts; positive two-row batch4 effects, foreign/grants retained. |
| Linked operator cleanup explicitly pending, eligible unlinked text purge works | Yes bounded disposition | CAPABILITY_NOT_READY before effect for links; no full lifecycle claim, Task05/12/16 adapters pending. |
| Actual unchanged ES2021+DOM backend/scoped compile; root0 typing only | Yes | actual unchanged convex-dev/tsconfig; scratch config explicit same libs; compiler/lint/root/baseline commands0; SDK semantics remain pending. |
| Native218/two suites/zero skips; original133 prefix retained; raw failures/histories immutable | Yes with decisive coverage gap | native-summary; original-test-prefix; history/preservation verification; initial210/216 and compiler failure retained, legitimate six new fixture corrections. |
| No whole03/C2/Task05/12/private bytes/inference/media/live/service/goal certification | Yes | Explicit bounded report/contracts; this verdict is REJECT and all remaining work stays pending. |

## Exact22 registration and outcome mapping

Each public row has an independently observed missing-identity negative and meaningful actual happy outcome in218 native tests. Every row has an actual unexpected-artifact-query boundary case. The initial admission classification defect applies to this shared adapter; this table establishes wiring and ordinary behavior, not aggregate acceptance.

| Registration | Candidate declaration | Native registration | Outcome examined |
|---|---|---|---|
| `create` | artifacts.ts:49 | mutation | Verified owner/user/changedBy; exact preinsert READ/WRITE; positive payload/receipt and revocation rollback. |
| `update` | artifacts.ts:111 | mutation | Text/version/history/actor; branching and native values; pinned late controls rollback. |
| `deleteArtifact` | artifacts.ts:205 | mutation | Retained row/resource tombstone, verified actor, no revival; resource retirement retains row/source/scope witnesses. |
| `undo` | artifacts.ts:230 | mutation | Nearest retained prior version and content, including history gaps. |
| `redo` | artifacts.ts:280 | mutation | Nearest retained next version and content, including history gaps. |
| `setStreamingState` | artifacts.ts:332 | mutation | State transition and timestamp; static invalid-state output. |
| `purgeVersions` | artifacts.ts:425 | mutation | Initial/current/latest retained; safe integer retention; exact history counts. |
| `purgeAll` | artifacts.ts:505 | internalMutation | Trusted internal operator; exact tenant/space; full batch file/link/state preflight before effects; retained controls/foreign rows. |
| `get` | artifacts.ts:548 | query | Canonical artifact and history, independent READ and owner scope. |
| `getByConversation` | artifacts.ts:575 | query | Canonical conversation precedes artifact association; exact anchors; current ownerless source fails closed. |
| `list` | artifacts.ts:596 | query | Owner/lifecycle/tombstone/source preflight before count, pagination and delivery. |
| `count` | artifacts.ts:643 | query | Same canonical preflight before count. |
| `getVersion` | artifacts.ts:669 | query | Exact historical version fields/current marker, version input validation. |
| `getHistory` | artifacts.ts:707 | query | Ordered/paginated version fields, pointer/latest/navigation. |
| `startStreaming` | artifacts.ts:826 | mutation | Generated session/state; generic denied-state error. |
| `appendContent` | artifacts.ts:895 | mutation | UTF-8 bytes/content/progress; generic denied-session/state errors. |
| `pauseStreaming` | artifacts.ts:969 | mutation | State change with retained content/session; generic denied-session/state errors. |
| `resumeStreaming` | artifacts.ts:1028 | mutation | Continuation/state with retained progress; generic denied-session/state errors. |
| `cancelStreaming` | artifacts.ts:1086 | mutation | Draft transition, preserve/clear content; generic missing/wrong session and state errors. |
| `finalizeStreaming` | artifacts.ts:1164 | mutation | Final state/history/version/actor; valid paused-to-final, generic wrong-session/state errors. |
| `setStreamingError` | artifacts.ts:1273 | mutation | Stored caller error/content/progress; generic wrong-session/state errors. |
| `retryFromError` | artifacts.ts:1334 | mutation | Draft transition, optional content clear; generic denied-state error. |

Excluded unchanged declarations: setFileRef:369, generateArtifactUploadUrl:1408, completeArtifactUpload:1475, getArtifactFileUrl:1591, detachFile:1661. The12 attachment registrations are unchanged/pending.

## Every original Task03 requirement and acceptance disposition

| Original Task03 item | Bounded disposition |
|---|---|
| R1 bounded03A inventory/freeze;03B guards/background;03C JWT/subscription/bytes/callback receipts | This is only22-reg03B2C1; accepted03A frozen controls reused; full03B/03C and background/client/live receipts pending. This third gate rejects. |
| R2 inventory memory/facts/conversation/search/share/artifact/attachment/graph/user/agent/policy; guard/internalize bypasses | Only selected22 artifacts structurally guarded/internalized here, remaining17 C2 pending. Other family closure not assessed/adopted. |
| R3 refreshed host JWT and exact verified issuer/subject mapped to trusted memberships/grants/bootstrap; metadata no privilege | Backend accepted03A ordinary identity/grant outcomes observed; callers cannot self-grant by labels. Client refresh/bootstrap/service provisioning are outside this slice/pending; unexpected dependency errors fail classification. |
| R4 direct authenticated/scoped access; admin unlock canonical transcript revisions/stale memory; controls never disabled | Ordinary manual text artifact scope checks observed. No transcript writer/unlock implementation;03T/05 remains pending. Manual writes grant no inference/budget permission. |
| R5 background recheck deletion/revocation; scoped subscriptions/uploads/downloads/callbacks; admin config/shares | Artifact mutation/read checkpoints and tombstones observed. No live/background callback/private byte/admin-config/share acceptance claimed. |
| A1 missing/forged identity, wrong/omitted scope/share cannot alternate read/write/stream/infer | Selected public artifact unit negatives observed; unique omission deliberately derives only1 eligible space. Whole alternate paths/share/inference/service acceptance pending. |
| A2 cross-tenant subscription/tools/upload/storage-reference denial; helpers internal | Selected unit scope/file capability-negative outcomes,1 internal operator registration observed. Actual subscriptions/tools/storage references/bytes pending. |
| A3 revoked grants/deletion stop later reads/effects/commits/no revival; ordinary logout documented | Pinned admitted artifact/control revocation rollback and retained tombstones observed. Unexpected initial READ failure wrongly commits; whole deletion/background/logout/live semantics not certified. |

Task05's four requirements and three acceptance criteria remain pending: Agent-thread/canonical transcript mapping, executable versioned agents/tools/policy, deduplicated reservation/queued input/branches, statuses/approval/cancel/export/deletion, administrator lock/unlock revisions/stale-derived repair, deterministic admission concurrency, crash recovery/projection rebuild and actual component behavior. Typed source-owner tests are an offline seam only. No duplicated transcript writer was added.

## Every original Task12 requirement and acceptance disposition

| Original Task12 item | Bounded disposition |
|---|---|
| R1 Convex cross-owner catalog across versions/attachments/Agent;video/binary provenance | Pending. Current/history files fail capability preflight; five file/all attachment APIs unaccepted. |
| R2 enforce20,000,000-byte uploads/generated ready/delivery; typed oversize cleanup/no external fallback | Pending actual asset/materialization/HTTP cap qualification. UTF-8 text progress alone is not this cap. |
| R3 authenticated private HTTP actions and credential fetch/bounded blobs; no raw bearer URLs | Pending. No selected bytes/storage URL delivery is introduced or certified. |
| R4 idempotent ready/version commits; reference-aware history/undo/orphan/cancel/user/space cleanup | Text version/undo metadata outcomes observed; file ownership/idempotent ready/reference cleanup pending. Linked operator cleanup intentionally typed unready before effects. |
| R5 stable immutable asset/version IDs/hash/MIME/source lineage/future processor seam | Pending full asset/provenance implementation. Text IDs/history retained; no analysis processor implemented. |
| R6 qualify private provider input/protocol limits; no external storage/large-media path | Pending; no network/provider/storage/media qualification performed. No external fallback added. |
| A1 actual under-cap private delivery and above-cap no-ready/no-return incl HTTP boundaries | Pending live byte acceptance. |
| A2 attachment delete retains artifact versions;final-owner/failed cleanup removes bytes under retention | Pending reference-aware bytes. No storage deletion in selected operations. |
| A3 tenant/share metadata/byte denial/revocation; delayed tombstone commits | Selected artifact metadata negatives/tombstone fences observed; whole share/bytes/delayed asset commits remain pending. |
| A4 undo/redo/export lineage/exact immutable asset version | Text navigation observed; full asset/export lineage pending. |

Task04/14 inference/budget/secondary-operation policies remain pending; no inference is added. SDK existing casts/legacy graph consumers and Resilience retry handling remain unchanged and pending03C2. Root compiler0 does not certify safe-receipt consumers, graph followups or committed-outcome propagation. No fabricated SDK payload/session/clock/version is accepted by this review.

## Independent actual commands, discovery and receipts

All commands execute installed candidate dependencies directly with Node24.19.0; cached npm12.2.0 was independently verified by its existing private-cache CLI, with no fetch/install/network. TypeScript6.0.3, Convex1.46.0, Jest30.5.2 and ESLint10.11.0. Working directory for every check/probe: /workspace/Project-Cortex/work/backend-runtime/task03b2c1-checkout. commands.json records exact argv,cwd,UTC start/end,exit code and raw log paths. Scratch configs change only output/cache/path resolution, not source/test outcomes or ES2021+DOM libs.

| Check | Exact argv | Exit | Raw logs under /tmp/task03b2c1-review3-eopdvclu |
|---|---|---:|---|
| tools | `node -e console.log(JSON.stringify({node:process.version,typescript:require('typescript/package.json').version,convex:require('convex/package.json').version,jest:require('jest/package.json').version,eslint:require('eslint/package.json').version}))` | 0 | `tools.stdout`, `tools.stderr` |
| backend-types | `node node_modules/typescript/bin/tsc --project convex-dev/tsconfig.json --noEmit --pretty false` | 0 | `backend-types.stdout`, `backend-types.stderr` |
| scoped-types | `node node_modules/typescript/bin/tsc --project /tmp/task03b2c1-review3-eopdvclu/tsconfig.json --noEmit --pretty false` | 0 | `scoped-types.stdout`, `scoped-types.stderr` |
| lint | `node node_modules/eslint/bin/eslint.js convex-dev/artifacts.ts convex-dev/runtimeArtifactAuth.ts tests/unit/runtimeArtifactAuth --max-warnings=0` | 0 | `lint.stdout`, `lint.stderr` |
| discovery | `node --experimental-vm-modules node_modules/jest/bin/jest.js --config /tmp/task03b2c1-review3-eopdvclu/jest.cjs --listTests --runInBand` | 0 | `discovery.stdout`, `discovery.stderr` |
| unit | `node --experimental-vm-modules node_modules/jest/bin/jest.js --config /tmp/task03b2c1-review3-eopdvclu/jest.cjs --runInBand --json --outputFile /tmp/task03b2c1-review3-eopdvclu/native-tests.json` | 0 | `unit.stdout`, `unit.stderr` |
| inventory | `node /workspace/Project-Cortex/work/backend-runtime/task03b2c1-checkout/_goals/convex-backend-runtime-2026-10-02/qa/task03b2c1/inventory.mjs /tmp/task03b2c1-review3-eopdvclu/catalog` | 0 | `inventory.stdout`, `inventory.stderr` |
| root-types | `node node_modules/typescript/bin/tsc --noEmit --pretty false` | 0 | `root-types.stdout`, `root-types.stderr` |
| baseline-root-types | `node /workspace/Project-Cortex/work/backend-runtime/task03b2c1-checkout/_goals/convex-backend-runtime-2026-10-02/qa/task03b2c1/baseline-types.mjs` | 0 | `baseline-root-types.stdout`, `baseline-root-types.stderr` |
| whitespace | `git diff --check` | 0 | `whitespace.stdout`, `whitespace.stderr` |

Separate cached npm command is in npm-version-command.json (exit0). Discovery is exactly handlers.test.ts and inventory.test.ts. Native JSON contains218 assertions across2 passed suites,0 pending/skipped/todo/failed; native-summary.json extracts actual counts. Actual backend/scoped/root compilers emit zero diagnostics. Baseline compiler-host overlay uses original tracked inputs and only restores original artifacts/schema; independently verified remaining tracked input bytes justify its comparison. Both root compilers0 establish typing only.

Original replay commands are in probe-commands.json and probe-provenance.json with original/executed hashes. Each original source is unchanged apart from the scratch output directory; imports/cases/assertions/expected denial counts are unchanged. All use node --import /workspace/Project-Cortex/work/backend-runtime/task03b2c1-checkout/node_modules/tsx/dist/loader.mjs with reviewer .mts path. No canonical writer was invoked into QA.

| Original probe | Exit | Actual result |
|---|---:|---|
| cycle1 exploratory6 |0 | Create initial READ removal/distinct revocation deny rollback; lifecycle no source hydration; postpatch changed payload denies. Final snapshot exploratory limitation preserved. |
| cycle1 repeated-source4 |0 |4/4 outcomes match; all second-source injections reached; changed anchor/content/version denies, unchanged positive succeeds. |
| cycle1 adversarial40 |0 |37/40 expectations match; same3 qualified final-await limitations;40-case set is not PASS. |
| cycle2 generation/receipt/editor/scope12 |0 |12/12 expected outcomes match, reached effects/rollback and safe-receipt controls. |
| cycle2 six session-error probes |0 |6 codes preserved,0 private-session error outputs,0 attempts. Old source remains a defect-finding collector, not rewritten. |
| cycle2 original disclosure control |1 |Unchanged expectedSessionId assertion fails after redaction. Raw failed stderr retained; no controls-results file fabricated, and no disclosure demanded for green. |
| candidate additional privacy admission48 |0 |48/48 exact output/negative and positive READ-controls,0 private output/0 attempts/0 committed effects. Source assertion matrix unchanged except output prefix. |
| reviewer fresh boundary36 |0 collector |21 expected matches,14 failed expectations,1 explicitly unreached query post-effect; new blocking evidence, not PASS. |

The same3 original adversarial failures have finalAwait67,calls67,injection1; final query is the unscoped artifact tombstone key for second. They mutate an earlier source/control after that record was already read. A real Convex query/mutation uses one serializable snapshot, so these synthetic mutable-fixture cases do not establish a cross-transaction exploit or require impossible simultaneous rereads. Original40 denial assertions remain intact. Immutable first source/anchor witnesses and intentional deletion retirement were separately inspected; current code retains row/source/scope/grant READ witnesses and pre-effect lifecycle controls. New early exception injections do not depend on this limitation.

## Preservation and practical limits

Frozen622 records match before and after. Additional preservation snapshot protects625 files (including the freeze itself and main original reviews); all625 hashes remain identical. Archives independently verified: cycle1:95 records, manifest8fa8e0ba1d8aaaba78f6f0073216f4ceb66168b44c57f2a44ab28590fae19097; cycle2:313 records, manifest344313d04cc4f15409341cb79828494dd58f587846ba9885e90ad8dfa7979ca0; cycle2-pre-codec:73 records, manifestfe3cc4529e758ae16ef4569aaf593f9930c7e4dea607039838c19fc528da50c4; cycle3-pre-house-errors:8 records, manifesta839a5a9a2639f5af4a8a0eb0cbd6fabf7c8fa8f6fa941bdf52acb48ce9ced90. All zero mismatches. Verification JSON and before/after manifests are included.

Native _handler execution uses the actual exported registrations but an independent in-memory database/rollback fixture. No deployed Convex validator/transaction commit engine/subscription, Agent/Workflow, storage/HTTP bytes, Gateway, callback, external effects, browser, media or service behavior is exercised. Current conversation schema cannot write the trusted owner seam supplied by tests. These are scoped source/unit outcomes, not live acceptance. Review tooling encountered mistaken exploratory historical-path reads, corrected to actual candidate/manifest paths; no candidate file was written or failed receipt overwritten. Those path reads do not affect test/gate verdicts.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment |2/5 | Unknown admission/control diagnostics become FORBIDDEN or successful committed receipts, contradicting explicit bounded failure/output contract. |
| Code Quality |3/5 | Independent scoped/native witness adapter and strict outer redaction; permissive earlier catches/pruning erase failure identity. |
| Test Quality |3/5 |218 meaningful tests and original preserved assertions/receipts; early auth/control error locations remain uncovered and fail reached probes. |
| Pattern Adherence |4/5 | Accepted03A contracts only, native registrations, preserved source scope/config, native codec and owned scratch output. |
| Completeness |3/5 | Exact22 wiring and all affected offline checks complete; bounded error boundary is not complete while unknown failures can commit success. |

Average3.0/5. Requirement Fulfillment<=2 mandates REJECT;218 passing tests and the three-cycle limit cannot turn this into PASS.

## Recommendation

Keep Task03B2C1 incomplete and preserve this third rejection/raw evidence. Repair is needed at early expected-denial recognition and dependency-pruning boundaries, retaining only exact authorized safe shapes and propagating all unknown/malformed/native diagnostics to the house failure before effects. Add reached initial WRITE/READ/query control negatives and ordinary-denial/admitted positives; preserve all original outcomes and pending scope. The reviewer has made no repair. This is the last permitted cycle, so no fourth repair/review may be silently started or accepted by exhausting the limit. Continue only independent authorized work while this gate remains unresolved.
