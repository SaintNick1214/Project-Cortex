# Task Judgment: endpoint read scopes and mutation admission timing

## Verdict: PASS

One nonauthor source/test/docs gate under acceptance-policy v2. **Requirements4, code4, tests4, patterns4, completeness4; average4.0/5. Zero breaking findings.** This accepts the frozen four-production/four-test batch and latest K17 docs. It does not accept native speed, SLOs or the final goal.

## Requirements review

| Requirement | Evidence and result |
| --- | --- |
| Activate only existing invocation-local raw readers | `runtimeAgent.ts:168` hydration and `:859` output recording opt into authority/native transcript; `runtimeModelPolicy.ts:787` visibility also opts into raw policy metadata. Reader implementation and logical transcript calls remain unchanged. Exact keys, detached copies, bounds, writer invalidation/pending suppression, error handling and invocation isolation retain their existing tests. |
| Keep every current fence and final delivery | Original registered bodies retain authority, owner/scope/epoch/tombstone, canonical/private transcript, source witnesses, lease/cancellation, executable definition, qualification/control, budget/replay and monotone visibility predicates. Final delivery remains byte-identical and unscoped, retaining its uncached late-grant test. No source or authorization-decision cache is added. |
| Add prospective mutation spans only | `runtimeLatencyTrace.ts:19`–helper plus Client submit/start/get and Agent claimNext/Workflow-start wrappers preserve arguments, order, responses, writes and guard clocks. Default-off/process-absent paths touch no performance clock or console. Unavailable/invalid durations are omitted. Logs use original fixed scalar fields and hashed correlation; callback/result/error payloads are excluded. |
| Preserve compatibility and journals | Production diff against6156 and final equivalence packet retain validators, V1–V5 journals/callbacks, original execution/model bodies, APIs, deadlines, model/budget/replay controls and financial commit boundaries. Start-native retains18 original cases plus4 new cases. |
| Meaningful controlled outcomes and quality | Timing/client/context gate379/13 PASS, zero skips/todos. New endpoint scope26/26 PASS; installed Workflow library fixture22/22 PASS. Current handlers compare exact original result, stored state and non-raw read/write order; negatives cover late/current denials and component-write invalidation. Final joint types/lint/build/actual packed contracts pass. |
| Accurate K17 docs | Exact performance hash and six retained MDX hashes verified. Actual build0; saved IAB DOM/pixels show latest four failures, historical unavailable timing and no guarantee. Sampled warnings0/100, tab closed, server Ctrl-C exit1/port absent. |

## Test failure and applicability review

**The original dependency run remains FAIL:1,121/1,123 tests,23 suites, zero skips/todos.** Its unchanged tool-context test exceeded the original60,000ms limit (recorded401.160s), then the next one-embedding assertion observed2 calls. Scheduling cause remains **UNKNOWN**.

The separate unchanged tool-context suite passed **4/4 in2.266s**, after the original synchronous child exited. I verified its current bytes match6156 (`d40c1d5d71973ba4ec2e1ee3eb1680ecc18c25346f5830dffee24dfab8a43a67`). Its real tool-authority/memory path invokes none of the three modified registrations; the new mutation spans lie outside that path. No product source, assertion or deadline was changed to obtain the isolated result. The isolated pass supports this bounded behavior review; it does not explain or erase the original failure.

Four unchanged earlier passing suites supply176 cases. Selected sensitive coverage is1299 distinct cases across27 suites assembled from those receipts and the isolated suite, **not one new green broad run**. The timing379/13 and Workflow22/22 counts overlap other evidence and must not be added.

Initial focused201/202 and TypeScript failures remain retained: a new wrong-table fixture and context/union narrowing were corrected without weakening functional assertions. The wrong child-PATH Node26 lint run remains unqualified; the pinned Node24.15/npm12.2 run is the accepted lint receipt, with0errors/237existing warnings.

## Evidence and dimension scores

Reviewed current production diffs, all four affected test paths, original read-scope implementation, raw failed/passing outcomes, selected/discovered suite applicability, final source/log hashes, equivalence packets and saved docs evidence. All eight frozen source/test hashes match before and after review. Shared root/backend types, lint types/scoped ESLint, build and actual packed ESM/CJS/browser/consumer/backend contracts exited0; build remains157 backend files/72 tables/2 components.

| Dimension | Score | Basis |
| --- | --- | --- |
| Requirements | 4/5 | Narrow opt-ins and diagnostics preserve original behavior and safety boundaries. |
| Code quality | 4/5 | Existing bounded reader reused; small typed helper; controlled clock failure handling. |
| Test quality | 4/5 | Exact outcomes, fresh refusals, component writes, rollback and clock/privacy cases; failed-run limitation explicit. |
| Pattern adherence | 4/5 | Existing registrations/readers/trace allowlist and original Workflow behavior retained. |
| Completeness | 4/5 | Reachable integrations, finite checks and docs build/render complete for source scope. |

## Issues and remaining scope

No breaking or important issue found. Nonbreaking debt includes237 existing lint warnings and the unexplained broad-suite timeout/count failure. Enabled trace-output errors deliberately keep existing propagation: begin-log failure executes no callback; end/failure-log failure executes one, and a trace failure can supersede the callback error. Callback-once/result/error-identity evidence applies when tracing itself succeeds or is disabled; this report does not claim broken trace output is transparent.

The helper's mutation clock choice is consistent with [official Convex runtime documentation](https://docs.convex.dev/functions/runtimes), which distinguishes advancing mutation performance clocks from fixed query clocks. Prospective callback spans include awaited children; they do not supply missing historical subphase attribution or prove hosted duration savings.

K17 measured the **old6156 source**:8native events PASS, cleanup ABSENT, **0 latency PASS/4 FAIL**. Browser6,796.2/6,149ms; CLI10,531.912421/14,391.614923ms. The current scopes and timing helper have no fresh installed native qualification. Latency follow-up remains **50%**, and full-goal acceptance remains open.

Proceed to one fresh installed disposable qualification and actual latency/timing measurement. Judge performed no tests, builds, services, inference, Git, Proofs or product edits. Exact file/packet hashes are in the companion JSON.
