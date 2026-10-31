# Task Judgment: Backend reply repair and Gateway phase tracing

## Verdict: PASS

Independent source-and-controlled-test acceptance of the thirteen-file backend executor batch and the three-file corrected Gateway trace batch pinned below. Zero unresolved breaking findings were identified in this scope. Acceptance-policy v2 governs the scores; this accepts the backend work milestone, not the SDK batch, installed artifacts, real services, final audit, or under-one-second target.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Remove outer visibility hydration only with equivalent atomic checks | Yes | `runtimeAgent.ts:469-470` delegates to native visibility; `runtimeAgentFence.ts:18-84` retains current attempt/authority/definition, private cutoff, saved pins/hash/thread/status, source/artifact/media and active-tool/approval checks. Lines 65-66 now enforce the previously missing anchor order and after-anchor position. Three matching-pin/outside-anchor regressions exercise the actual fence. |
| Skip unchanged visibility writes while rechecking current authorization | Yes | `runtimeModelPolicy:markVisible` performs current-operation and state validation before comparing monotone flags. Actual-handler tests assert zero additional patches and rejection after revocation despite unchanged flags. |
| Finalize canonical response and ingestion before independent optional title | Yes | `runtimeAgent.ts:211-220` commits finalization first and only enqueues title afterward. `enqueueContent` starts the durable content Workflow asynchronously. The slow-native-title test asserts completed run/execution/public final status and registered ingestion while title remains running, then joins title completion. No inline title action or paid retry remains in the answer Workflow. |
| Completed title retains the exact original parent/account and all native controls | Yes | Internal optional `completedParentTitle` schema records original attempt/lease. `runtimeAgentFence.ts:30-51` requires completed run/outbox/attempt, live original lease, final-message/ingestion identity, exact final Agent model parent/account/reference and the one allowed registration revision. `runtimeContentFence` derives the exception only from the running internal automatic-title job with exact identity; model resolve/admit/current-operation use it narrowly. Tests exercise native visibility, attachment/publication and original account/parent. |
| Completion cannot reopen general answer/tool/content admission | Yes | Completed-parent tests reject answer/query-embedding/artifact resolution/admission, public completed-parent content, late tool operation and invented title semantic identity. Wrong parent/run, definition retirement, edit, cancellation, lease expiry and tombstone reject while completed answer/ingestion and liabilities remain. |
| Retain replay and conservative uncertain cost without hidden retry | Yes | Title replay pays once and retains balances; lost terminal invokes actual ledger recovery, keeps uncertain liability/held slot, rejects reclaim/reconcile and preserves final text. Existing governing lifecycle/settlement paths are retained. |
| Empty eligible context skips embedding without losing pending/history or provenance | Yes | `runtimeMemoryContext.ts:133-154` checks current authorized owner/scope metadata, captured cutoff, exclusions, conversation boundary and selected-profile readiness. Any eligible candidate or scan overflow uses ordinary recall. `runtimeAgent.ts:239-244` atomically repeats the empty proof/profile pin before saving; pending sources and witnesses remain in context. Tests cover empty, pending, indexed candidate, history/cutoff/future input, overflow, stale profile, approval change and revocation. Existing strict barrier/context-permission regressions pass. |
| Trace remains optional, metadata-only and preserves native effects/errors | Yes | `runtimeLatencyTrace.ts` checks exact opt-in before hashing/logging, hashes arbitrary semantic/nonopaque correlation values and copies a fixed scalar allowlist. Agent/context and Gateway trace calls add no model dispatch, authorization cache or timing mutation. Controlled Gateway tests assert unchanged streamed text, known-cost settlement, exact error identity and one failed RPC invocation without retry. |
| Gateway acquisition labels reflect observable boundaries | Yes | Native stream acquisition is labeled begin/ready; first processed part and first nonempty native text are separately labeled. Source/report explicitly leave service-token acquisition, HTTP first byte and provider-internal queue subphases opaque. No browser/provider latency is inferred from these fixtures. |
| Schema, registration and source distribution wiring remain usable | Yes, source scope | New availability registration is internal in an already registered module; the title schema field is optional for existing jobs. New helper imports are included by the existing backend source-closure collector. Source type/lint receipts pass. Packed/build/installed-consumer qualification remains root's next gate. |

## Evidence Reviewed

Read the current source changes against the inspected baseline, full relevant guards/handlers, new outcome assertions and retained existing tests; reviewed the approved plan/amendment, runtime/profile, pessimistic-judge and judge-task instructions, and acceptance-policy v2. All sixteen final file hashes were independently computed and matched the reported final frozen values. No implementation edit, service call, inference, deployment or unrelated repository access was performed by this reviewer.

Raw `backend-final-tests.json/log` records **13 suites / 654 passed / 0 failed / 0 pending or skipped**. Raw `backend-trace-privacy-tests.json/log` records **5 passed / 0 failed or skipped**. Backend/SDK TypeScript and scoped ESLint are recorded exit 0 with empty diagnostic logs. The selected fixtures route actual native handlers/helpers through controlled component/model peers; inert loopback bootstrap and disabled graph prerequisites are not live service coverage.

Raw `gateway-trace-final-tests.json/log` records the original trace batch's **319 passed / 0 failed or skipped** across three controlled adapter/dispatch/terminal suites. The corrected adapter then ran `gateway-trace-interleaving-tests.json`: **45 passed / 0 failed or skipped**, with refreshed root lint typecheck and scoped ESLint recorded exit 0. The unchanged dispatch/terminal suites were not redundantly rerun. These aggregates overlap and must not be summed as unique test counts.

Earlier failed receipts remain historical. Component-reference routing failures were repaired by distinguishing native function names from component references. The lost-terminal test now invokes real `ledger.recover` and asserts conservative uncertain liability with `slotReleased: false`; its earlier expectation of pending attachment after an absent terminal was incorrect. The Workflow action-list assertion changed because title work moved to a separate Workflow, with a stronger held-title/final-answer outcome regression added. These are justified fixture/contract corrections, not removed failure assertions.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement fulfillment | 4/5 | Every bounded backend/trace behavior has source and meaningful controlled outcome evidence; live performance is explicitly outside this gate. |
| Test quality | 4/5 | Actual helper/handler assertions cover successful completion, currentness races, negative admission, replay, unknown liability, empty-proof races and trace privacy/interleaving. |
| Completeness | 4/5 | Optional schema and internal registrations are wired; source quality passes. Fresh artifact/consumer/service integration remains separately required. |
| Code quality | 4/5 | Changes are bounded, retain existing native governors and owned durable work, and avoid a second inference loop or unjoined background action. |
| Pattern adherence | 4/5 | Existing Convex validators, current-authority fences, scoped indexes, durable Workflow and native accounting conventions are retained. |

**Average: 4.0/5.** Meets acceptance-policy v2's requirement/test/completeness minimum 4 and code/pattern minimum 3. The older rubric's requirement-5 threshold does not override the adopted policy.

## Issues Found

### Critical (blocks PASS)

- None unresolved in this source batch.

### Corrected during review

- The initial Gateway adapter stored a shared mutable correlation value after awaiting admission. Out-of-order concurrent admits could associate an attempt with the other call's trace metadata. Root replaced it with an immutable per-invocation local correlation (`runtimeGatewayBackend.ts:78-82`). The new regression (`gateway-backend.test.ts:516-540`) holds the first admission, completes the second, then asserts both visibility events retain their original run. The final hashes below cover that correction and the 45-test passing rerun.

### Important acceptance boundaries

- Controlled native peers do not prove real Convex/Gateway behavior, title scheduling on the installed backend, real asynchronous memory, installed CLI/browser behavior, cleanup, or any latency improvement. Those remain mandatory in root's fresh installed-candidate integration and final independent audit. Keep the subsecond result unaccepted until actual submission-to-first-visible-text measurements establish it under the reported conditions.
- The optional empty-context probe conservatively falls back for candidates/overflow and adds profile/metadata work to nonempty retrieval. Its net latency effect needs the already-planned real phase measurements; source correctness is not evidence of a universal speedup.

## Exact Reviewed File Hashes

| File | SHA-256 |
|---|---|
| `convex-dev/runtimeAgent.ts` | `1988cf817dc098593fe2110f0c8be49d477754d0d2acb11197522e0c4ec042e2` |
| `convex-dev/runtimeAgentFence.ts` | `3969de14ba28b38409ecccea53719f95186cb1ccceab6a33568077385ddb764d` |
| `convex-dev/runtimeContentJobs.ts` | `ba40b90dd57c89f5a7368de6bb0ab16aa1475950eb678a720f813d43c5ee379d` |
| `convex-dev/runtimeContentFence.ts` | `068092215a1fe50345921ca63a71b1b8697a9abf1e5a61565172ebff0ced3c72` |
| `convex-dev/runtimeContentJobsSchema.ts` | `64838343876a9b7570e882a1b60be0216a6452d3bc05fb2c7b686371412f2ebf` |
| `convex-dev/runtimeModelPolicy.ts` | `eac62c399488ba4872a75b012cda49f83cae76bf2a443ef97d21af13a0231046` |
| `convex-dev/runtimeMemoryContext.ts` | `ee5072db5bff9809f2db27e70ec20beadc5f49db698ca39472488849a5a1e9e5` |
| `convex-dev/runtimeLatencyTrace.ts` | `0bf086927cdf685cb8ce53a6e2ca1c79662dfcf62fc8a01084b22a455fb5f1ca` |
| `tests/unit/runtimeContent/jobs.test.ts` | `eb84dc51c414e318184df59deaa5f9f4290203b6e8a7dee6f023ee21d6a9253a` |
| `tests/unit/runtimeAgent/execution.test.ts` | `1cdfe25dd35eca8e662b2c59155986531ee89ba4509729d4ac2a7b649b152264` |
| `tests/unit/runtimeAgent/context-latency.test.ts` | `0c628dcb90b17202f716176d91f7334a09a41e795204356cb003d1b8c5f2c300` |
| `tests/unit/runtime/model-policy-admission.test.ts` | `6dac85981b3f8d4abd401f4ffb7eb54b882d9f79ba3c19704246402486a46530` |
| `tests/unit/runtime/latency-trace.test.ts` | `b19cb3f2cc8f74ee5530c3e2e88edaef9e69f956ebdf776b3bdca9246d8f4150` |
| `convex-dev/runtimeGateway.ts` | `56f8fe9f6de93033554b25034887cbbceedf77811433e0617eda3f32edb9366b` |
| `convex-dev/runtimeGatewayBackend.ts` | `e641eaf46b615ec11aa4b9b1305d83d77be57acc444233ecfe1a0ab70e400702` |
| `tests/unit/runtime/gateway-backend.test.ts` | `5c7f40eca48d27d50b64baa08b50ef3559b8012cb17c4bd8ba11da2bf755b0e1` |

## Recommendation

Accept this bounded backend source milestone and proceed to the separately reviewed SDK batch and fresh artifact/consumer integration. Retain the earlier failures and superseded Gateway hashes as history. No new harness, preparation judgment or full-core recertification is warranted for this source decision. The actual governed browser/CLI outcomes, measured delay chain, owned cleanup and final independent audit remain the completion gates.
