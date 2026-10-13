# Cloud early-delivery repair

Status: COMPLETE for the bounded implementation and offline checks; frozen for non-author review. The latest actual hosted Basic measurement remains17,347.98009ms to first stdout acknowledgement. The under-one-second goal is not achieved or certified by this batch. Root owns prospective review, immutable packaging/deployment and a new hosted measurement.

Only runtimeAgent.ts and two focused test files changed. Base/source before this patch is `e89c3d0bb381bdb7ddd5e89b4eccc2590c25a403`. No Gateway/helper/ledger/source-fence/client/Proofs/generated artifacts were edited; no service access, inference, deploy, Docker operation or Git mutation occurred. Backend distribution remains158 files.

## Behavior

- startContext and contextBarrier use official Workflow0.4.8 `{ inline: true }` while retaining the same handlers, arguments, step order and journal names. Their current authority/transcript/source/definition/lease checks still run. Explicit strict-stage cutoff/deadline evaluation, waiting/sleep and failure handling remain. Model/context/tool actions retain retry:false; finalize/title scheduling stays unchanged. Only these two mutations acquire inline options.
- Agent0.7.3 saveStreamDeltas receives a fixed ChunkDetector returning the whole nonempty received buffer, including whitespace-free fragments, avoiding a per-character explosion. The first nonempty projected public text forces an immediate fresh recordOutput mutation. Empty/start parts do not consume that first-text state. Subsequent publication keeps250ms event-triggered buffering and the32-pending-part threshold.
- onChunk callbacks are serialized through an awaited queue, including controlled concurrent invocation. Publication success alone marks firstTextPublished. Both normal completion and failure cleanup join the queue; errors still propagate and the governed lifecycle closes once. Each Gateway visibility fence and each actual recordOutput current-authority/source/transcript/public-projection check remains.

The evidence in cloud-first-delay-chain.md/json motivated these changes: initial mutation journal spans1.426/1.287s and continuation gaps; first native processed text12.533s after creation; native stream first text466ms; native attachment completes14.703s immediately before first output RPC14.707s. These overlapping intervals are not summed into estimated savings. The installed default Agent transform held a synthetic whitespace-free short answer until text-end, while explicit whole-fragment chunking emitted before text-end. A new actual hosted run is required to measure any improvement.

## Installed primary contracts

cloud-early-delivery-primary-contracts.json preserves five complete-file SHA256 values and literal line-numbered excerpts from installed Workflow0.4.8, Agent0.7.3 and AI SDK source. Key exact contracts include `inline: true; runAt?: never; runAfter?: never;`, `inline: inline ?? false`, `unstableArgs: unstableArgs ?? defaults?.unstableArgs ?? false`, and journal's `// Already completed inline by the caller — nothing to enqueue.` Agent's documented `chunking?: "word" | "line" | RegExp | ChunkDetector;` accepts the fixed internal detector; smoothStream detects each nonempty whole buffer and preserves text.

The installed StepExecutor and createWorkflowCtx are exercised directly in the new test suite. DB/journal/syscall ports are controlled fixtures, not hosted Convex/Workpool/OCC certification. Both existing native startContext/contextBarrier handlers execute, recorded success is replayed without another mutation, mismatched replay arguments reject, inline scheduling overrides/actions reject, and actual Workflow sleep metadata retains its exact non-inline runAfter delay. Strict barrier wait/timeout and real failContext are exercised; the unchanged non-inline failure completion is a controlled port in this harness. Fresh revocation/input edits and strict run-budget cancellation deny before context/model dispatch.

The model-owner suite calls actual modelStepHandler and recordOutput. It invokes installed Agent mergeTransforms/AI smoothing, verifies the first durable prefix before its controlled text-end/terminal release point, checks combined text/order/unique output sequence, empty/start behavior,32-part growth threshold,250ms later threshold, failure prefix, real publication denial after revocation/cancellation/input edit, and cancellation while callbacks are queued. Provider/Agent model ports are controlled; these tests do not claim paid live inference or browser visibility.

## Checks and receipts

Toolchain Node24.15.0: `/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node`; local TypeScript6.0.3/ESLint10.11/Jest30.5.2. Explicit cwd is the backend-runtime-completion worktree.

- PASS: backend types `node node_modules/typescript/bin/tsc --noEmit -p convex-dev/tsconfig.json`, exit0, cloud-early-delivery-backend-types-v2.log.
- PASS: scoped ESLint with --report-unused-disable-directives on the three files below, exit0/no warnings, cloud-early-delivery-final-lint.log.
- PASS: eight selected Jest suites, **489 passed,0 failed,0 skipped/pending/todo**, raw cloud-early-delivery-final-tests.json/log. Includes all five runtimeAgent suites; model-policy admission; Gateway backend and terminal composition. The custom timing reporter deduplicates parameterized names and prints428; raw Jest totals489 are authoritative.
- PASS: git diff --check on tracked changed source/tests (read-only Git), exit0.

Jest used `CORTEX_TEST_ENV_MODE=explicit CONVEX_URL=http://127.0.0.1:9 node --experimental-vm-modules node_modules/jest/bin/jest.js --watchman=false --testTimeout=10000 --runInBand --runTestsByPath tests/unit/runtimeAgent/inline-barrier.test.ts tests/unit/runtimeAgent/model-owner.test.ts tests/unit/runtimeAgent/execution.test.ts tests/unit/runtimeAgent/context-latency.test.ts tests/unit/runtimeAgent/tool-context.test.ts tests/unit/runtime/model-policy-admission.test.ts tests/unit/runtime/gateway-backend.test.ts tests/unit/runtime/gateway-terminal-composition.test.ts --json --outputFile=.../cloud-early-delivery-final-tests.json`. Loopback port9 only satisfies inert bootstrap; selected tests contact no service.

Initial red receipts are preserved: missing inert Convex bootstrap before discovery; controlled-reader cancellation/hanging fixture and expected retained text-id issues; missing component-reference routing; incorrect non-strict budget fixture; one introduced TypeScript union narrowing error. Fixes retained actual contracts: readers now cancel on callback rejection, real runs:cancel is routed, expected IDs remain, component references use the original fixture, strict stage budget case uses strict mode, and firstTextPublished inspects the typed projected parts. Intermediate logs/json were retained. No negative guard or assertion was loosened to hide a product failure.

## Frozen files

- `convex-dev/runtimeAgent.ts` — `ced11c2881e242300f7950744906c3e0ee8a9a8f58ae8840d9f376cc520d8033`
- `tests/unit/runtimeAgent/model-owner.test.ts` — `fa0c83346a476ad6be9428c220eebf4d42b7bcdbf7a5e32ffdbfef196a665105`
- `tests/unit/runtimeAgent/inline-barrier.test.ts` — `e9090dc5dbfe7c72a78e0dfaaba43a7f145a22984054259610d7513ce0ad55cc`

cloud-early-delivery-freeze.json contains these exact hashes, final raw test receipt hash and installed primary-contract receipt hash. No new helper or registration changes were added. No further source edits will be made unless review findings are routed.
