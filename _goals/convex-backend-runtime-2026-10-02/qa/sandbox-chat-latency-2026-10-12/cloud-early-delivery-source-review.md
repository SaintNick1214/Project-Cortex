# Judgment: cloud early-delivery repair

## Verdict: PASS

Independent non-author source/test PASS under practical acceptance-policy v2 for the exact three-file batch below. No unresolved breaking finding. This repair removes concrete scheduling/smoothing/publication delays while retaining the existing authority, source, cutoff, journal, order, cancellation and unknown-cost gates. It is ready for root's immutable rebuild and fresh hosted qualification/measurement. Source/test PASS does not establish service behavior, a successful browser flow or the under-one-second target.

Target: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion` (R); base `e89c3d0bb381bdb7ddd5e89b4eccc2590c25a403`. Read actual scoped diff/current source, both affected tests, manifests/workspace/runtime/profile, judge-task and acceptance-policy v2, executor report/freeze, installed primary contracts and selected raw checks. Recomputed all three frozen file hashes, raw Jest receipt and contract receipt hashes; independently checked every contract excerpt against the current installed file. No source/production/service/Docker/GitHub mutation, paid request, deployment, build or test rerun occurred. Read-only scoped `git diff --check` independently returned 0. Only this QA report was written; unrelated dirty/untracked work was preserved.

## Requirements review

| Requirement | Evidence and finding |
| --- | --- |
| Use real Workflow inline contract | **Met.** Only `startContext` and `contextBarrier` receive `{ inline: true }` (`runtimeAgent.ts:193,195`). Installed Workflow 0.4.8 accepts inline queries/mutations, rejects inline actions/scheduling overrides and preserves stable argument matching. `StepExecutor` executes native handlers then records success/failure in journal; completed inline journal entries enqueue no Workpool call. This is official component behavior, not an app-side replacement loop. |
| Keep context order, cutoff and strict barriers | **Met.** Same handlers, arguments and step order; `startContext` still validates execution context and records start once (`251-255`). `contextBarrier` still freshly validates, uses the snapshot ingestion cutoff/required stages, refreshes scope watermarks and applies its original deadline/failure policy only for explicit strict mode (`256-278`). Waiting still sleeps `min(1000,remainingMs)`; failed barriers still run failContext before throwing (`196-202`). Context/model/tool actions retain retry:false, and finalization/title scheduling is unchanged (`205-229`). |
| Preserve journal replay and failures | **Met at installed-contract/controlled level.** New test directly imports installed `StepExecutor` and `createWorkflowCtx`, invokes actual startContext/contextBarrier and records completed journal entries, then replays without another native mutation/write (`inline-barrier.test.ts:41-100`). Changed attempt args reject before native writes (`101-110`). Strict wait/deadline exercises real failContext; a separate installed-context test verifies actual sleep request metadata remains non-inline with exact delay (`111-137`). DB/journal/syscall ports and non-inline failure completion remain controlled. Hosted OCC/transaction execution is not certified here. |
| Remove delimiter buffering without per-character splitting | **Met.** Fixed detector returns the complete nonempty received buffer, otherwise null (`runtimeAgent.ts:528-531`). Agent 0.7.3 `mergeTransforms` supplies it to AI SDK smoothStream with no added delay; smoothStream validates a nonempty prefix and emits it immediately. The callback handles whole fragments, not each character. Installed Agent passes merged transforms into AI SDK; AI SDK applies transforms before its event processor and awaits onChunk. |
| Publish first safe text promptly | **Met at source/controlled level.** First nonempty projected public text flushes immediately through the real `recordOutput` mutation (`486-519`). Empty/start/private-only parts do not mark text published. The flag is set only after successful persistence; there is no optimistic publication on mutation denial. Real installed smoothing plus actual modelStepHandler/recordOutput preserves an `ABC` durable prefix before the controlled text-end/terminal release point (`model-owner.test.ts:88-117`), then retains `DEF`, text-end and unique ordered sequence. This removes the old dependency on text-end; it does not guarantee that the output commit beats an independently racing terminal attachment on every hosted run. |
| Serial callbacks, bounded later batches and cleanup | **Met.** Each callback chains/returns its awaited publication promise; subsequent parts retain the 32-pending-part/250ms event-triggered thresholds. Normal completion joins the queue before tail flush/operation finish; finally joins it before governed lifecycle completion and bridge disposal (`510-544`). A rejected queue prevents later callbacks from writing. Tests assert empty/start behavior, concurrent ordered batches `[3,32,32,1]`, later 249/250ms behavior, failure retaining only the early prefix, and cancellation during a blocked first write with no subsequent text and one lifecycle close (`118-193`). The 250ms rule is event-triggered, not a promised timer-driven maximum after an idle fragment. |
| Retain privacy/currentness/budget/terminal fences | **Met.** Early text still follows unchanged Gateway visibility fencing on each native delta (`runtimeGateway.ts:729-770`) and unchanged fresh `recordOutput` execution/authority/cutoff/source/artifact/transcript checks and public projection (`runtimeAgent.ts:120-143,438-445`). Native `markVisible` still checks current operation and pending/uncertain state on every delta (`runtimeModelPolicy.ts:734-746`). No admission, terminal attachment, settlement, no-retry, source witness, ledger or client code changed. Tests invoke actual recordOutput after revocation/cancellation/input edit and assert no text/ingestion; existing Gateway/admission suites cover retained known-charge/unknown-cost/cancellation/replay behavior. |
| Preserve supported size/order constraints | **Met.** Public records retain 16,384-byte/10,000-record bounds and monotone sequence (`runtimeAgent.ts:106-115`). Whole-fragment smoothing does not enlarge the governed text allowance: chat result proofs remain capped at 60,000 private-result bytes, while Gateway limits aggregate stream text to proof maximum/6 (`runtimeModelPolicy.ts:142`; `runtimeGateway.ts:757-761`). Projection strips provider metadata/reasoning/private tool input before RPC and repeats inside the native mutation. No public DTO or canonical transcript ownership changes. |

The installed Agent path still awaits stream consumption and final saved-message work before returning when `returnImmediately:false` (`node_modules/@convex-dev/agent/src/vercel/client/streamText.ts:179-185,281-325`). This remaining completion path does not force the public prefix to wait for return: onChunk now writes from the transformed stream as it is consumed. Actual Gateway terminal attachment remains independently governed and its final text-end/finish withholding is preserved. Failure can retain an eligible earlier prefix without fabricating canonical completion or ingestion.

## Raw evidence and limits

Raw Jest JSON independently parsed: **success true; 8/8 suites passed; 489/489 tests passed; 0 failed/pending/todo**, with every assertion status passed. Suites: inline barrier 7, model owner 20, execution 63, context latency 9, tool context 4, admission 140, Gateway backend 45, terminal composition 201. Raw totals are authoritative; the custom reporter's 428 count deduplicates parameterized names. All three frozen files and both receipt hashes match the executor freeze.

Toolchain recorded: Node 24.15.0, TypeScript 6.0.3, ESLint 10.11, Jest 30.5.2; manifest pins Workflow 0.4.8, Agent 0.7.3, AI SDK 7.0.127. Executor reports scoped lint/backend typecheck exit 0; their empty logs contain no diagnostics but do not independently encode exit status. The selected Jest run uses inert loopback bootstrap and controlled ports; no hosted/inference/browser coverage is inferred. The log's force-exit notice is not open-handle or hosted lifecycle certification. Focused assertions establish queue/order/denial outcomes in this batch; fresh installed hosted behavior remains next.

Historical discovery/fixture/narrowing failures remain preserved rather than relabeled. The reported latest hosted Basic first-stdout measurement remains **17,347.98009ms**, and prior failed CLI evidence remains failed. Scheduling/journal, native processing, terminal attachment and client intervals overlap; this review does not sum them into promised savings or claim a new timing result.

Nonblocking report correction: `cloud-early-delivery-repair-report.md` says six installed complete-file hashes; `cloud-early-delivery-primary-contracts.json` contains **five** entries. All five actual hashes/literal excerpts match. This count typo does not alter source/contracts/test results or require another acceptance cycle.

## Dimension scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement fulfillment |4/5| Official inline mutations, whole-fragment transform and immediate first safe text; mandatory gates retained. |
| Code quality |4/5| Narrow three-file change, serial awaited queue, success-only publication flag and unchanged ownership/finalization. |
| Test quality |4/5| Installed Workflow executor/context and smoothing, actual handlers/mutations, meaningful ordered prefix/failure/denial assertions; 489 selected passes. |
| Pattern adherence |4/5| Backend-owned Agent/Workflow/Gateway, native journal/replay and conservative terminal/unknown-cost controls unchanged. |
| Completeness |4/5| Existing registrations/public APIs unchanged and affected offline quality evidence supplied; immutable packaging/live measurement explicitly next. |

Average **4.0/5**, meeting policy v2 for this coherent source/test batch. No critical or important source repair required. Existing service qualifications are scoped history; materially changed runtime needs a new installed hosted outcome.

## Exact reviewed freeze and primary contracts

| R-relative file | Independently checked SHA256 |
| --- | --- |
| `convex-dev/runtimeAgent.ts` | `ced11c2881e242300f7950744906c3e0ee8a9a8f58ae8840d9f376cc520d8033` |
| `tests/unit/runtimeAgent/model-owner.test.ts` | `fa0c83346a476ad6be9428c220eebf4d42b7bcdbf7a5e32ffdbfef196a665105` |
| `tests/unit/runtimeAgent/inline-barrier.test.ts` | `e9090dc5dbfe7c72a78e0dfaaba43a7f145a22984054259610d7513ce0ad55cc` |

Raw test receipt SHA **`e7e379f608d0ef4d448deffba6278107a40f3c46bec4d70b1e5b73b876465869`**. Primary-contract receipt SHA **`8b3574e211eda6a31b4208a15284d91fd584181fd81fe5ec1b436f6e470848b0`**.

| Installed primary source | Independently checked SHA256 |
| --- | --- |
| `@convex-dev/workflow/src/client/workflowContext.ts` | `dcea75dd43d9d35ce8f01da168ef21562ee888a96574fa0ddfa414856800f6d8` |
| `@convex-dev/workflow/src/client/step.ts` | `b0af5d5e96b011c76cc816e3c329cfb3dfe9bc3dcaa641a91f208edb589ea5dc` |
| `@convex-dev/workflow/src/component/journal.ts` | `2cdfc1e6facb99ee21acb3d70e4ee3db86b91be5ce85c57520b144651168de2f` |
| `@convex-dev/agent/src/vercel/client/streaming.ts` | `c24c75556a2429da3d4e3da91cfbb74ca3ee111cc820bf23bac9423adb93c399` |
| `ai/src/generate-text/smooth-stream.ts` | `ce32873fc1beb1050a78b921fc67917544549401971bc1be318f094ec4e5e109` |

Recommendation: accept this source/test batch, rebuild the immutable 158-file backend/SDK generation and preserve prior failed/unknown-cost identities. Root then measures fresh installed canonical CLI/browser submission-to-first-visible behavior on a verified owned nondefault hosted cloud target, labels clocks/client conditions, checks relevant denials/final/cancellation behavior and owned cleanup. Local Convex results remain secondary. No unchanged full gate, additional routine receipt judge or synthetic custody cycle is requested.
