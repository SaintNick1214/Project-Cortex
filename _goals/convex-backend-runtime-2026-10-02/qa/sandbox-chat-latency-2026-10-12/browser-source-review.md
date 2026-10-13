# Task Judgment: Browser timing diagnostics and candidate packaging metadata

## Verdict: PASS

Independent acceptance of the corrected fourteen-file root-owned source batch below under acceptance-policy v2. Zero unresolved breaking findings were identified in this scope. This does not accept the separately reviewed SDK/provider/Basic behavior batch, assembled catalog or packed artifacts, actual browser/CLI/service outcomes, cleanup, final audit, or subsecond latency.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Time real submission through new assistant DOM commit | Yes, source scope | The actual submit handler calls `latency.begin(chat.messages.length)` before `chat.sendMessage`. `useLayoutEffect` inspects committed chat messages. The helper examines only entries beyond the pre-submit count, requires assistant role and non-whitespace text, and ignores old transcript/user/status content. The clock is browser `performance.now()`. |
| Record a subsequent paint checkpoint with visibility | Yes, source scope | The browser port schedules two animation frames; the callback emits only the current generation and records `document.visibilityState`. New submission and disposal cancel owned pending frames and invalidate stale callbacks. Tests prove generation cancellation and distinguish DOM commit from the later injected checkpoint. Actual paint remains a browser integration gate. |
| Distinguish status metadata, normal transport completion and completed answer DOM | Yes after correction | The status layout effect includes current run ID in its dependencies and calls `responseStatusComplete(run.runId)`; the helper requires the bound run and labels it `response.status.dom-commit`. Successful `useChat.onFinish` requires no abort/disconnect/error and stop reason, then pins the current assistant ID for `transport.complete`. A later layout effect with that assistant emits `answer.complete.dom-commit`. Metadata-only completion cannot trigger that event. |
| Diagnostics are optional, private and have no inference/delivery effect | Yes | Exact `NEXT_PUBLIC_CORTEX_LATENCY_TRACE=1` opts in. The helper emits only fixed phase/elapsed/run/visibility metadata and accepts only generated opaque run IDs. Message text is inspected for display eligibility but never emitted. Emit/paint failures are isolated, the disabled path invokes no diagnostic clock/emit/paint ports, and the source adds no network/model request, authorization cache or app-side loop. |
| Avoid render-time clock/DOM work and preserve React purity | Yes | Render constructs the controller/port callbacks; `browserNow`, document visibility and animation frames are invoked only by submission/effect diagnostics. No lint rule was disabled. Refreshed scoped lint and Next/TypeScript receipts pass. |
| Use the actual typed optional SDK callback | Yes, consumer wiring only | Quickstart imports public `RuntimeLatencyEvent` from `@cortexmemory/sdk/runtime` and conditionally supplies `onLatencyEvent`. The inspected public shape contains scalar phase/clock/RPC metadata. The changing SDK implementation is outside this review and still requires its separate acceptance. |
| Document timing/API/CLI behavior without claiming measured success | Yes | Root README documents combined admission while retaining separate methods. Basic README documents streamed plain text, handle-only `/send`, explicit approvals, local observation cleanup and separate backend cancellation. Quickstart/Basic timing examples are commented optional. Docs require actual measurements and distinguish hidden-page checkpoints and opaque Gateway subphases. |
| Keep candidate version/lock metadata consistent and preserve immutable prior tuples | Yes, preparation scope | Basic and Vercel manifests and both lockfile identities agree at local 1.4.1; catalog manifest and root workspace lock agree at local 1.3.1. No dependency update or publication is part of this batch. Existing `appendExistingCatalog` validates old payload bytes/hash/executable state and rejects changed old tuples. Actual append assembly/source matching remains root's next gate. |

## Evidence Reviewed

Read `browser-trace-report.md`, the initial and corrected diagnostic source/test changes, all fourteen selected file diffs/contents and manifest/lock metadata, the actual public latency-event type/export, and the existing catalog append workflow. Applied the approved latency plan/amendment, runtime/profile, judge-task rubric and practical acceptance-policy v2. Independently computed all fourteen final hashes and matched `browser-packaging-hashes.json`. No implementation edit, service call, inference, browser execution or unrelated repository access was performed by this reviewer.

Raw `browser-trace-corrected-tests.json/log` records **5 passed, 0 failed/pending/skipped**. Assertions cover new assistant DOM eligibility, old/private text exclusion, separate boundaries, current-run completion, stale generation cancellation, disabled diagnostics, opaque identity and callback failure isolation. Raw `quickstart-offline-tests.json/log` records the earlier **140 passed across seven unit/mocked route suites, 0 failed/pending/skipped**; that aggregate includes the diagnostic suite and is not additional unique coverage or a React/service result.

Refreshed `quickstart-build-corrected.log` records successful Next 16.3.8 compilation/typechecking/prerendering for the corrected source. `browser-trace-corrected-typecheck.log` and `browser-trace-corrected-lint.log` contain no diagnostics; the coordinator recorded exit 0. Earlier missing-hook typing, purity lint and concurrent-build generated-type failures remain preserved. Sequential post-build checks passed without disabling a rule.

## Corrected Finding

The initial `response.complete.dom-commit` effect was driven solely by `run.responseStatus`. An independent metadata watch can report server completion while output pages are still draining or final text has not committed. Successive complete runs could also miss the effect because run ID was not a dependency. Root corrected the label and current-run check, added normal transport-finish gating for answer DOM completion, and strengthened the existing regression to prove that early status and stale prior-run signals cannot certify final DOM completion. The final hashes and refreshed five-test/build/type/lint evidence below cover the correction; initial hashes remain in `browser-packaging-hashes-initial.json`.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement fulfillment | 4/5 | Selected timing/privacy/version/documentation behavior is present; the inaccurate completion attribution was corrected and regressed. |
| Test quality | 4/5 | Meaningful controlled state/clock/privacy/generation/current-run assertions; actual React paint and services are explicitly deferred to integration. |
| Completeness | 4/5 | Real submit, layout and finish callbacks are wired; type/lint/build pass. SDK acceptance and final assembly/installed consumers remain separate prerequisites. |
| Code quality | 4/5 | Small diagnostic controller, exact optional flag, fixed metadata shape, owned paint cancellation and no render-time effect or additional request. |
| Pattern adherence | 4/5 | Existing canonical quickstart/transport, public SDK types, immutable version tuples and local package/lock conventions are retained. |

**Average: 4.0/5.** Meets the adopted policy's source acceptance minima, with no unresolved critical finding in this batch.

## Remaining Acceptance Boundaries

- DOM commit and a double-animation-frame checkpoint are diagnostic boundaries, not proof of a visible on-screen answer or real service latency. Root must verify the actual canonical page/answer and reported visibility during fresh browser sampling before a first-visible/SLO claim. No actual UI or under-one-second result is accepted here.
- Use deliberate append assembly (`npm run assemble -- --append`) only after the SDK source is frozen and accepted; preserve and compare prior immutable tuples. Version metadata alone does not certify the new catalog, packed source closure, future launcher capsule, or installed consumers.
- Both this review and the separate SDK review must pass before accepting the combined client milestone. The already-planned fresh governed CLI/browser/service evidence, owned cleanup and final independent audit remain mandatory.

## Exact Reviewed File Hashes

| File | SHA-256 |
|---|---|
| `packages/vercel-ai-provider/quickstart/components/RuntimeQuickstart.tsx` | `e227f91cbb6fd1a6c2a2d84888c4634de499bede2a48f0a180f3b5855e9d14fc` |
| `packages/vercel-ai-provider/quickstart/lib/chat-latency.ts` | `03620311c96ec7d2ea2723ee3572d580b45703619546b2f0b4d3f04f68c9f8b1` |
| `packages/vercel-ai-provider/quickstart/tests/unit/chat-latency.test.ts` | `ff8a0087d6d13a9e815aa21b2c1c3a793bd8b63cf508c15ae7817272cb905833` |
| `packages/vercel-ai-provider/quickstart/README.md` | `5b261b1dc1c796405e48f6ce496a6d77aacc583d66784163b00d07cb6a941ee7` |
| `packages/vercel-ai-provider/quickstart/.env.local.example` | `61037dc94013d677cc64433807f99cc4eda38c2f9d84b142918f3fab8ac8725f` |
| `packages/vercel-ai-provider/quickstart/package.json` | `d65f5c227187b50763e762ed20cb842963c972647465b02f0009bfb1ba5ab25c` |
| `packages/vercel-ai-provider/quickstart/package-lock.json` | `e13c4c9fbb78188bbe690bd4d81c8c7b075b1df6e9058cc7d01f8d5c921fbd64` |
| `README.md` | `85ec934c782f70b091334ab61e90766a25b538f7ab71a9fad209532a7a08ffed` |
| `packages/cortex-cli/templates/basic/README.md` | `6f70f5e23a64b103838ccf0e45a5d572f2bd817997a2b7d7ea8193211e2900c9` |
| `packages/cortex-cli/templates/basic/.env.local.example` | `eef296af16d4a5f8981d68e4f9fd1b48645ae682da7b5756dbdcbc32457d8282` |
| `packages/cortex-cli/templates/basic/package.json` | `444b91637929ad6fb94470429e161bcddd9e803defb14f7ceb50682f4f06f60f` |
| `packages/cortex-cli/templates/basic/package-lock.json` | `ef443c6dc097927d86fab6a8337fb453116166461771aad11519289218b6af32` |
| `packages/cortex-templates/package.json` | `d5d05071145bef4d5c6001ee61fc6890c72ffbb206aeccbad975b31ace819baf` |
| `package-lock.json` | `ac739a04b864afd9989cd1e26b8a76fa05aee1b4a724262e3c3418e2a13353be` |

## Recommendation

Accept this root-owned source batch and proceed after the separate SDK batch passes. Preserve the corrected attribution finding and initial receipts as history. No extra harness or full UI acceptance ceremony is required for this source decision; actual installed-candidate behavior and measurements remain the next gate.
