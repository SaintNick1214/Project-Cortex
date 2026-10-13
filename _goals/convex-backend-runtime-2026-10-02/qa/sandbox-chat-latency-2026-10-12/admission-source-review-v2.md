# Judgment: repaired admission source batch v2

## Verdict: PASS

Source-and-controlled-test PASS under acceptance-policy v2 for the exact 20-file admission/SDK/remote-provider/Basic batch below. Both findings in the preserved v1 NEEDS FIXES review are repaired with relevant outcome regressions. The additive SDK/Basic latency diagnostics introduce no blocking source finding. This verdict does not qualify root's separate browser changes, Gateway/backend changes, artifacts/catalog, actual Convex OCC/scheduler rollback, installed consumers, service behavior, cleanup, or UNDER1SECOND.

Review checkout: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`. Applied the previously read AGENTS/runtime/profile, pessimistic-judge role, judge-task rubric, accepted plan/amendment and goal-specific acceptance-policy v2. Read the repaired executor report, v2 manifest, actual repaired source/tests and selected refreshed receipts. Native admission and remote-provider source/test hashes are unchanged from v1; their earlier independent review and scoped 75/288-test evidence remain relevant. The earlier verdict was not relabeled. No source/service/cloud/GitHub edit or call, live inference, process signal, test rerun, or unrelated scope review occurred; only this report was written. Existing selected receipts and precise source inspection supplied sufficient independent evidence without repeating unchanged suites.

## Repair and extension verification

| Requirement | Result and concrete evidence |
| --- | --- |
| Strict-prefix canonical truncation, complete final assembly, no duplicate final | **Met.** Basic printer accumulates final chunks and compares only at a drained terminal observation (`packages/cortex-cli/templates/basic/src/index.ts:24-37`). A matching longer final writes only its missing suffix; a shorter/different complete final writes one labeled canonical correction. The new test streams `Hello! Extra draft`, then assembles `Hel`/`lo`/`!` across a full terminal page plus residual page, asserts no early correction/close, exact final stdout, one unsubscribe and suppression of a later callback (`src/__tests__/cli.test.ts:62-75`). Equal, suffix and divergent cases remain (`19-60,76-82`). |
| First SIGINT/SIGTERM promptly releases owned command/watch/client | **Met.** Main owns an AbortController and passes its signal through createCli, withRuntime and both watch entry points (`index.ts:41,77,83-104`). First signal aborts and closes readline; abort exits the loop and finally removes both listeners. Basic watch synchronously marks itself inactive on abort, releases once, rejects, and ignores later callbacks; synchronous completion/error/abort subscription races retain one release (`chat.ts:25-37`). Direct command-abort and actual main on controlled readline streams exercise each registered SIGINT/SIGTERM handler, verifying one unsubscribe/close, original listeners restored, no later text, one admission, no implicit backend cancel (`cli.test.ts:84-105`). These tests invoke the registered handlers, not OS signals or live services. |
| Three-RPC admission, actual admitted attempt/current cursor, native queue/approval/replay/unknown-ack semantics | **Preserved.** Native mutation, contracts/validation, provider and native regression hashes are unchanged. SDK latency wrappers retain the original inSession pre/post authority envelope and call ownership; strict parsed admission and current-cursor logic remain. Existing exact RPC-count, generation/scope/principal/expiry, 104-part drainage, unknown acknowledgment, replay/approval/compatibility assertions remain covered by the refreshed SDK/native/delivery receipts. There is no extra get/start or app-side inference/memory loop. |
| Optional scalar SDK events; no sensitive payload/default-on work | **Met.** Public type and hook are optional; exact emitted construction contains only version/phase/time and fixed RPC ID/method/duration scalars (`src/client-runtime/client.ts:18-39,83-113`), and the type is explicitly browser-safe exported (`index.ts:3`). Fixed reference names supply methods; no RPC arguments, results, scope/actor IDs, credentials, signal markers or errors enter event DTOs. Hook-off methods directly invoke the original port and do not evaluate diagnostic clocks. Event tests assert frozen scalar keys, unique paired IDs, finite nondecreasing time, no sentinel/identity/token leakage, and exactly three admission calls (`tests/unit/client-runtime/client.test.ts:43-66`). |
| Diagnostic callback exceptions/rejected promises cannot change execution | **Met.** SDK wraps the hook in try/catch and retains a rejection handler for an accidentally asynchronous result (`client.ts:89-95`). Both throw/rejected-promise regressions preserve guarded admission and shared-client ownership (`client.test.ts:92-98`). Basic marker output is similarly exception-isolated (`index.ts:58-61`); the SDK wrapper isolates its Basic stderr hook. No diagnostic result is awaited or used as authority. |
| Preserve original port receiver/shared ownership and action fences | **Met.** Mutation/action closures still invoke `this.port.mutation` / `this.port.action` as methods (`client.ts:107-113`); the fixture asserts receiver equality, original call counts and that caller-owned ports are not closed (`client.test.ts:63-65,83-98`). Governed recall action tracing specifically retains two fresh session calls and one action without exposing its input/result (`83-90`). |
| Clock boundaries and accurate labels | **Met for diagnostic contract.** SDK uses performance.now with finite nondecreasing fallback and nonnegative local durations (`client.ts:83-105`); failure/backward-clock tests preserve admission (`client.test.ts:99-108`). SDK end/failed explicitly means official port promise settlement, including a late settlement after local suppression; it is not delivery authorization. Basic submission/print markers share the command clock and run only when explicitly opted in (`index.ts:43-63`). First print occurs after stdout's successful write callback for non-whitespace answer content (`10-16`), excluding request/status labels and whitespace. Tests exercise delayed write callback, leading whitespace, fallback and default-off behavior (`cli.test.ts:106-155`). These local markers alone do not prove actual external first-visible latency or support subtraction across different clock domains. |
| Basic diagnostics privacy and stdout separation | **Met.** `CORTEX_RUNTIME_LATENCY_TRACE=1` alone forwards the optional SDK hook and emits scalar JSON through console.error (`cortex.ts:46-49`). Basic answer bytes remain on stdout; submission/first-print markers contain fixed method, scalar timing and opaque per-CLI command counter. Basic hook/privacy/opt-in tests assert no token/result sentinel leakage (`src/__tests__/cortex.test.ts:37-48`) and CLI tests exclude prompt/output/token/request labels from trace JSON (`cli.test.ts:106-120`). |

## Evidence review and limits

Independently recomputed every source/test SHA256 and the sorted compact path→hash JSON aggregate. All 20 match `admission-batch-hashes.json` version2. Actual aggregate: **`ed1c9ad78b419c7b84bbc9e6981ba5b3a02c08b275f1cb1821c68a6b3da10f15`**. V1 aggregate remains `3e55e78307a658e61e3583f434f8b4f88abf04cffbe919216119eea5e589ea01` in the preserved historical manifest/review.

Selected raw refreshed JSON receipts were independently parsed:

| Receipt | Observed result | Interpretation |
| --- | --- | --- |
| `admission-repair-sdk-trace-final.json` | success true, 60/60, 0 failed/pending | Latest SDK suite includes the additional governed-action trace assertion. |
| `admission-repair-client-tests-final.json` | success true, 80/80, 0 failed/pending | 19 controlled native + 59 SDK + 2 expiry tests, before the additional action-trace assertion. It is not an 81-test fresh combined run. |
| `admission-repair-basic-tests-freeze.json` | success true, 129/129, 0 failed/pending | 18 CLI tests and 30 ownership/config tests among Basic's controlled suites; both repairs and new diagnostics outcomes included. |
| `admission-repair-basic-integration.json` | success true, 25/25, 0 failed/pending | Actual registered Basic HTTP routes against mocked SDK. |

The v1 raw 75 SDK/native/delivery and 288 provider-unit receipts were reviewed in the preceding source judgment and remain scoped historical evidence for unchanged native/provider paths. Executor also records successful affected TypeScript/lint/runtime-build/Basic checks and preserves repair-local failures. This re-review does not convert controlled transactional fixtures into real Convex OCC, scheduler rollback, billable execution or installed CLI/browser evidence. Extra root-owned Basic manifest/README/environment and browser files are outside these 20 reviewed hashes.

## Issues found

Critical: **none** in this scoped repaired batch.

Important: **none unresolved**. V1 truncation and signal findings are resolved as described above.

Nonblocking diagnostic limitation: fallback clocks guarantee finite nondecreasing values and isolation; they do not make a failed wall/monotonic clock a precise latency measurement. Actual SLO evidence should use a functioning monotonic submission/display clock. Promise settlement metadata must remain separately labeled from permitted private delivery and actual rendered/displayed text. This is an interpretation limit, not another required repair or mock campaign.

## Dimension scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement fulfillment | 4/5 | Both precise repairs complete; native/SDK/provider semantics retained; additive diagnostics meet privacy/default-off/isolation/count contract. |
| Code quality | 4/5 | Canonical final assembly, explicit active/release ownership, passed main abort signal, fixed scalar construction and handled callback rejection. |
| Test quality | 4/5 | Exact stdout over fragmented full/residual pages; actual main handler lifecycle; late callback and no redispatch/cancel assertions; RPC/receiver/privacy/action/fence regressions. |
| Pattern adherence | 4/5 | Existing backend-owned orchestration/authority and Basic withRuntime lifecycle retained; optional diagnostics stay outside authorization and paid work. |
| Completeness | 4/5 | Reachable combined APIs, public optional type/hook, both canonical caller paths, prompt signal cleanup, controlled checks and builds supplied; integration remains explicitly separate. |

Average: **4.0/5**. All mandatory source-batch minima under acceptance-policy v2 are satisfied; no average overrides an unresolved breaking finding.

## Exact reviewed hashes

| File relative to checkout | SHA256 |
| --- | --- |
| `convex-dev/runtimeClient.ts` | `e74ab9d69e5fe705fc136f5ca0d85077f9083b5bf41f77db60d679dacf9e3b98` |
| `src/client-runtime/client.ts` | `a65d86557705a7f6ca0a5d8807d063f94a664650b91873a2b5730c08b2f1b990` |
| `src/client-runtime/types.ts` | `9cb1678c2a1d2c5369aa796627f5134009434e3d689121b79794c5c815d01a06` |
| `src/client-runtime/validation.ts` | `2762b6e2f8e85c0871d3f9b5e9b406de35393fab2516ec93b93a0b8af24fcdf4` |
| `packages/vercel-ai-provider/src/remote/index.ts` | `cc78f108c8b95b1275542039bd72ed7ba8ee22aa8f4b7fd45e66d61ff89a9957` |
| `packages/vercel-ai-provider/tests/unit/remote.test.ts` | `39e350df1708066170694cfe44ffe887b14f5f9afa2ffbc21f1f8a469fe4deb8` |
| `packages/cortex-cli/templates/basic/src/chat.ts` | `c956aebd13f2bd8083bc648d620a5239bbbb5ebf364309c4ed8f51e0bd75c71c` |
| `packages/cortex-cli/templates/basic/src/cortex.ts` | `d096b737c7b40230b866d74a43d0a909deda0a8a60c2a22b82c786e03072fee7` |
| `packages/cortex-cli/templates/basic/src/index.ts` | `a0a6adbe35d0a594419f50e77d427bfed18dadd938bd69a570899be7d667fe08` |
| `packages/cortex-cli/templates/basic/src/__tests__/chat.test.ts` | `dc691b7243dcd98d35fa4df42556c939eee86370639cf1f94cabd24d2adf4581` |
| `packages/cortex-cli/templates/basic/src/__tests__/cli.test.ts` | `79f0f569a28fb4e66b684196899ba407654f36d58423277aefa63e0ac18158e0` |
| `packages/cortex-cli/templates/basic/src/__tests__/helpers/test-utils.ts` | `2656c56ab0b7c1db4b3d9fc20b12c8b3ef9ec0aac15bd02df5a9219f0d8959cb` |
| `packages/cortex-cli/templates/basic/src/__tests__/llm.test.ts` | `919572d9b9a715de2182169aa784d155d5190c3301ac3fc355dceb53b253446a` |
| `packages/cortex-cli/templates/basic/src/__tests__/local-runtime-request.test.ts` | `14d28bf8b84587609ea2c1d35cf7007e89b4c73372e03b45b00527a1f2519d58` |
| `packages/cortex-cli/templates/basic/src/__tests__/integration/chat-flow.test.ts` | `c3cfc16c2cf0162699324110fbaaa7c305b8898c5d9f8d207897c2fa2063d802` |
| `packages/cortex-cli/templates/basic/src/__tests__/integration/server.test.ts` | `141f586e6a06a5903c002747f4fe18c1801e05f5d3221f3979b2a384527ba07b` |
| `tests/unit/client-runtime/client.test.ts` | `8058a9afc70e3f9792a54d2b2c370941eeb0a6d5a6ebc73c202e4547ca95006d` |
| `tests/unit/client-runtime/admission-native.test.ts` | `7d4ee8db8eb661ded584399ec7ee01c841c0423a628a4f224f824912baa05d71` |
| `src/client-runtime/index.ts` | `9883aa4bc23735375ff17e3679cfb69d2cec79ca939124be5d8f06a44e5926ef` |
| `packages/cortex-cli/templates/basic/src/__tests__/cortex.test.ts` | `005706ecf54975886428d6609bc9e02e659ce8412de497c759170d2090e5bb88` |

## Recommendation

Accept this repaired source milestone and proceed to the coordinator's separate artifact/installed-consumer/live qualification. Keep exact candidate linkage, actual disposable positive/negative native classes and rollback, governed web/CLI reply sampling from submission to first real text, response/title/memory phase separation, independent final audit and owned-resource cleanup. Do not claim service PASS or subsecond latency from this source review or RPC count.
