# Judgment: frozen native admission, SDK, remote provider and Basic batch

## Verdict: NEEDS FIXES

The native/SDK/provider admission and cursor changes have no blocking source finding in this review. The coherent 18-file batch cannot receive source acceptance yet because the newly automatic Basic CLI display misses a canonical truncation correction and its active command does not stop on the first SIGINT. Repair these two focused cases, rerun affected Basic checks, and review the changed batch once. Controlled receipts do not qualify actual Convex transactions, installed consumers, browser rendering, paid inference, or the subsecond target.

Reviewed independently in `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`, HEAD `f1f71559d`, branch `feat/convex-backend-runtime-completion`. Read the target AGENTS/runtime/profile, pessimistic-judge role and judge-task rubric, accepted plan and amendment reviews, acceptance-policy v2, executor report, actual source/test diff and selected raw receipts. Acceptance-policy v2 supplies the scoring minima and supersedes the stricter generic rubric. No source/service/cloud/GitHub mutation, inference, deployment, test execution or active sandbox access occurred. The only write is this report. Gateway instrumentation/backend repairs and root-owned artifact/live acceptance are outside this verdict.

## Issues Found

### Important — must fix before this source batch passes

1. **A canonical final answer that truncates the streamed prefix is not identified or displayed as the final answer.** In `packages/cortex-cli/templates/basic/src/index.ts:21-33`, `displayed.startsWith(finalText)` keeps `correction` false while the canonical text is shorter than what has already been printed; `finalText.startsWith(displayed)` is also false, so no suffix or correction is printed. Example: a delivered delta `Hello! Extra draft`, followed by final canonical text `Hello!` and complete status, leaves `Hello! Extra draft` on stdout with no final-answer label. This is supported by the public output contract and can occur when intermediate model-step text is streamed before the final step's canonical answer. Canonical final text is intentionally authoritative, as the existing divergent-answer reconciliation and web transport reset demonstrate. Current CLI tests cover equal text, a longer final suffix, and divergent final text, but not a shorter final prefix (`src/__tests__/cli.test.ts:19-59`). At terminal page drainage, compare the complete canonical text against the displayed stream and print a single labeled correction when a final projection exists and is shorter/different. Preserve chunked-final assembly and avoid corrections while a matching final prefix is still incomplete. Add outcomes for strict-prefix truncation across multiple final chunks/pages and retain equal/suffix/divergent tests.

2. **SIGINT/SIGTERM does not stop the active ordinary CLI observation.** Plain text now awaits `watch` inside the owned command (`index.ts:64-69`), but `main` installs `stop = () => rl.close()` and is blocked at `await command(line)` (`73-83`). Closing readline does not reject that command or unsubscribe its watch. `withRuntime` supports an AbortSignal but no signal is passed from main/createCli; it closes the client only after completion or its finite command deadline (`cortex.ts:42-63`). Thus a normal Ctrl+C during a waiting response/approval transition can leave the socket/subscription and command alive until a later event or deadline. This is a prompt-termination defect, not a claim of an infinite leak: the existing command deadline remains a backstop. Pass an owned abort signal from the signal handler into the command's `withRuntime` lifecycle so the first signal promptly releases the observation/client and exits. Preserve the distinction between disconnect and explicit backend cancellation; do not introduce a retry or paid redispatch. Add a controlled CLI main/signal outcome verifying prompt command rejection/exit, one unsubscribe/close, listener cleanup, no later text delivery, and no new submission. Existing denied-watch tests do not exercise process signals (`cli.test.ts:48-52`).

No authorization bypass, cross-scope access, new model/tool/memory loop, automatic retry, or duplicate native admission was found in the reviewed source. No additional style/census gate is requested.

## Requirements Review

| Requirement | Result | Evidence |
| --- | --- | --- |
| One native parent transaction composing original guarded routes | Met at source/controlled level | `convex-dev/runtimeClient.ts:20-43` invokes registered submit/start/get, exact selectors, immutable identity/attempt comparison; original handlers retain authority, executable definition, transcript, budget, claim, approval and Workflow/outbox semantics. |
| Run/write/read authority and rollback including scheduling | Met at source/controlled level | Native registered-handler fixture tests missing read/write/run, cross-scope/unauthenticated/revoked, revocation between nested calls, final metadata mismatch after Workflow insertion; snapshots compare transcript/native/scheduled/effect state (`admission-native.test.ts:114-140`). Actual Convex OCC/scheduler rollback remains a live gate. |
| Queue head, explicit input approval, streaming replay and legacy compatibility | Met at source/controlled level | Native fixture covers queued-head parent rollback, running/waiting head new durable queued request, explicit approval only, oversized-prefix failed disposition, same request/account/execution/Workflow reuse, changed input/streaming rejection, legacy submit/start then combined replay (`42-113,142-146`). No caller-selected model/context/tool field is accepted. |
| SDK three-RPC admission with unchanged pre/post fences | Met | `client.ts:159-169,190-203`, strict DTO parsing `validation.ts:94-118`; exact session→combined mutation→session assertions (`client.test.ts:42-57`), post-I/O scope/principal/time expiry tests (`80-95`), generation and uncertain deadline tests. Delivered malformed/changed identity remains uncertain. |
| Actual admitted attempt and current cursor on every fresh read | Met | Provider initializes attempt from admitted run (`remote/index.ts:84-94`); SDK obtains cursor at each read (`client.ts:275-286`); 104 unique sequences and `[0,2,102]` cursors verified after a short then full terminal page (`client.test.ts:186-213`). Attempt replacement resubscribes from zero; full-page drainage preserved. |
| Provider consumes remote output, with reconnect/approval/cancel and no extra start | Met | Actual built SDK/transport fixture asserts three pre-watch RPCs and one subscription (`remote.test.ts:32-61`); actual AI SDK parser reconstructs one canonical answer; request replay retains original selector; explicit stop/abort and abort during admission retain accepted handle and close observation (`101-125,166-207`). Ambiguous admission is manually replayed only with the same retained request; no automatic paid retry. |
| Basic uses one client/combined admission and displays ordinary text | Partially met | `chat.ts:9-14`, `index.ts:46-69`; tests verify live deltas within the controlled owned client, no separate start/get/recall, terminal page drainage, explicit approval wait, no auto-approval, and closure on denial. Prefix truncation and SIGINT are unresolved. |
| Existing endpoints and exports remain reachable | Met at source/build level | Original SDK submit/start/attach/observe methods retained, exported type-star includes admission/start DTOs, named native registration is reachable via existing module; runtime/provider builds visibly succeed. Final backend distribution/catalog/installed route qualification is coordinator-owned and unexecuted here. |

## Evidence Review

Independently recomputed all 18 SHA256 values from current files and the sorted compact path→SHA256 JSON aggregate. All matched the freeze manifest. Aggregate: `3e55e78307a658e61e3583f434f8b4f88abf04cffbe919216119eea5e589ea01`.

Selected raw JSON receipts independently parsed:

| Receipt | Observed result | Scope |
| --- | --- | --- |
| `admission-client-tests-accepted.json` | success true; 75 passed, 0 failed/pending; 3 suites | 19 actual registered-handler controlled native tests, 54 SDK tests, 2 delivery-expiry tests. |
| `admission-provider-unit.json` | success true; 288 passed, 0 failed/pending; 11 suite results | Core/React/remote unit evidence; 25 remote tests. |
| `admission-basic-tests-complete.json` | success true; 119 passed, 0 failed/pending | Basic controlled unit/CLI/actual SDK-port callers, including 9 CLI display tests and 16 chat tests. |
| `admission-basic-integration.json` | success true; 25 passed, 0 failed/pending; 3 suite results | Actual registered Basic HTTP callers against mocked SDK, not native service. |

Reviewed successful SDK CJS/ESM/declaration and provider remote build tails, ESLint's zero errors/11 warnings, plus Basic build/test-typecheck logs with no diagnostics. The latter empty logs alone do not independently establish exit codes; the executor's report records exit0. No passing receipt contains a truncation or SIGINT assertion. Test changes replacing submit spies with combined-admission spies reflect the approved API change; existing outcome/security assertions were retained. No failed intermediate receipt was relabeled in this review.

## Dimension Scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement fulfillment | 3/5 | Native/SDK/provider fulfilled with clear controlled evidence; changed Basic canonical display and prompt signal termination incomplete. |
| Code quality | 4/5 | Native guard composition, strict boundaries, synchronized cursor reads, maintained post-I/O fences and uncertain acknowledgments; two focused lifecycle/display repairs needed. |
| Test quality | 3/5 | Meaningful native negative/rollback/compatibility, actual SDK-port RPC, parser, cursor, replay, approval and ordinary display outcomes; two reachable Basic branches missed. |
| Pattern adherence | 4/5 | Canonical backend-owned orchestration/account/transcript, fresh private delivery and existing Basic withRuntime ownership retained. |
| Completeness | 3/5 | Reachable APIs/types/callers and successful builds; ordinary CLI path requires the two repairs before source acceptance. |

Average: **3.4/5**. Requirement/test/completeness minima of 4 under acceptance-policy v2 are not met. Missing live integration is honestly separate and does not inflate this source verdict or become a further source defect.

## Exact reviewed file hashes

| Path relative to checkout | SHA256 |
| --- | --- |
| `convex-dev/runtimeClient.ts` | `e74ab9d69e5fe705fc136f5ca0d85077f9083b5bf41f77db60d679dacf9e3b98` |
| `src/client-runtime/client.ts` | `d1ecccaf9e141d671a78ab212805adbdd26154df72c083d930e1427ee21426bd` |
| `src/client-runtime/types.ts` | `9cb1678c2a1d2c5369aa796627f5134009434e3d689121b79794c5c815d01a06` |
| `src/client-runtime/validation.ts` | `2762b6e2f8e85c0871d3f9b5e9b406de35393fab2516ec93b93a0b8af24fcdf4` |
| `packages/vercel-ai-provider/src/remote/index.ts` | `cc78f108c8b95b1275542039bd72ed7ba8ee22aa8f4b7fd45e66d61ff89a9957` |
| `packages/vercel-ai-provider/tests/unit/remote.test.ts` | `39e350df1708066170694cfe44ffe887b14f5f9afa2ffbc21f1f8a469fe4deb8` |
| `packages/cortex-cli/templates/basic/src/chat.ts` | `40c8c43350376d81a38c1b4cb230be54f433ea0a9f398fdf6f2f6ddee709072a` |
| `packages/cortex-cli/templates/basic/src/cortex.ts` | `a3b1ab5a90b37dc4f9f2f0f34d707e40d03b78efbef2f2a862bc437bc1b16c8a` |
| `packages/cortex-cli/templates/basic/src/index.ts` | `13c097c18c63c9f669150e9496819b91a13bc9c59ffbad5b52db4dc7e53cdfa6` |
| `packages/cortex-cli/templates/basic/src/__tests__/chat.test.ts` | `dc691b7243dcd98d35fa4df42556c939eee86370639cf1f94cabd24d2adf4581` |
| `packages/cortex-cli/templates/basic/src/__tests__/cli.test.ts` | `81f7a3970a5bcc152b9ca38795d8dd357323b00dbb9b13219b8ba09fcc550d43` |
| `packages/cortex-cli/templates/basic/src/__tests__/helpers/test-utils.ts` | `2656c56ab0b7c1db4b3d9fc20b12c8b3ef9ec0aac15bd02df5a9219f0d8959cb` |
| `packages/cortex-cli/templates/basic/src/__tests__/llm.test.ts` | `919572d9b9a715de2182169aa784d155d5190c3301ac3fc355dceb53b253446a` |
| `packages/cortex-cli/templates/basic/src/__tests__/local-runtime-request.test.ts` | `14d28bf8b84587609ea2c1d35cf7007e89b4c73372e03b45b00527a1f2519d58` |
| `packages/cortex-cli/templates/basic/src/__tests__/integration/chat-flow.test.ts` | `c3cfc16c2cf0162699324110fbaaa7c305b8898c5d9f8d207897c2fa2063d802` |
| `packages/cortex-cli/templates/basic/src/__tests__/integration/server.test.ts` | `141f586e6a06a5903c002747f4fe18c1801e05f5d3221f3979b2a384527ba07b` |
| `tests/unit/client-runtime/client.test.ts` | `8e43d59e2c3263f19e6bd3816201e67464c8071ea37f254f933b0f587148570b` |
| `tests/unit/client-runtime/admission-native.test.ts` | `7d4ee8db8eb661ded584399ec7ee01c841c0423a628a4f224f824912baa05d71` |

## Recommendation

Repair the two Basic findings with focused outcomes, rebuild/recheck the affected Basic batch, update its coherent hash manifest/report, and perform the affected non-author re-review. Preserve the already-good native admission, fresh post-I/O fences, current attempt/cursor, and conservative unknown acknowledgment behavior. Coordinator then owns actual disposable Convex positive/negative classes, native scheduler/OCC rollback, installed canonical CLI/browser functionality, submission-to-first-visible timing, title/memory separation, final audit and cleanup. Do not infer UNDER1SECOND or live PASS from the three-RPC count or controlled timing.
