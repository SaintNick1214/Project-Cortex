# Task Completion Report

## Status: SOURCE/TEST COMPLETE; installed hosted qualification pending

Implemented the independently approved context-read batch. prepareContext now performs one initial internal contextInputs query, which sequentially executes the original execution hydration, pending-context reader and index-availability reader in one query snapshot. The original saveContext mutation still freshly rechecks authority, original attempt/lease, transcript, source witnesses, empty-index availability and profile after action I/O. No actual latency improvement or under-one-second achievement is claimed.

## Frozen changes

| File | Change | SHA-256 |
| --- | --- | --- |
| convex-dev/runtimeAgent.ts | Add one internal contextInputs query and typed reference; derive inputs from the original guarded Attempt; replace three initial action queries; preserve overflow failure order. | 66a21b39c1d07d5bc73ebcf21edf7c1c7a405fe482b4b05ad657367ceaaf0cca |
| tests/unit/runtimeAgent/context-latency.test.ts | Actual combined/helper/action/save coverage, derived input denials, overflow/fallback and post-read source/index/profile races. | 2f0d87c6b1dcd4e006f21decf154088274421b8bf271ce3be7c193521b726a6c |
| tests/unit/runtimeAgent/execution.test.ts | Coordinator-authorized two-line correction of obsolete pendingContext wrapper fault port to the actual nested embeddingProfile port, retaining original authority/budget/no-model assertions. | 3a3b5ffd831188bab1fe9f62a9edf6c699c0d87cdeb2091dcdbedfc7d432b324 |

These three source/test files are frozen for non-author review. No other product, Proofs, generated, schema, package or distribution files were changed by this batch. No service reads, paid calls, Docker, deploy, commit or GitHub operation occurred. Unrelated work and original failed receipts remain preserved.

## Requirements and behavior proof

- contextInputs is an internalQuery with the original exact agentAttempt validator. Full executionContext receives the supplied original tuple; current run/definition/reference, outbox lease/deadline, transcript edit/revision/hash/native position/media and source/artifact guards remain. State must already be started. Cutoff, scope, history keys, conversation boundary, pending maxBytes and run budget are derived only from those current authoritative records.
- Original readPendingContext and readIndexedContextAvailability run directly and sequentially on the same QueryCtx. Their current profile/readiness, bounded scans, current source permissions, original cutoff, represented/pending exclusions and conservative overflow/candidate result are retained. One action query replaces the three removed wrappers; nested native component/profile reads and the later save still run.
- Pending overflow under fail policy returns a marker before availability. The actual action then commits original failContext and throws CONTEXT_OVERFLOW. A regression uses thirty-three real pending sources plus a real incompatible vector generation: availability's independent PROFILE_NOT_READY error is not evaluated, and failure state remains durably recorded after the action throws. The fixture invokes prepare as an action, with individually transactional nested mutations rather than a fictitious enclosing mutation rollback.
- The plan's descriptive warning branch uses the existing native policy value `onFailure: "incomplete"`; no schema/value was introduced. Real overflow under that policy proceeds to availability and original governed retrieval. An existing barrier incompleteness/failure code also survives through actual combined read and original save.
- Indexed candidates and real bounded metadata overflow still reach the original embedding.query ledger resolution, with a controlled stop before native inference. Authorized pending text and source witnesses survive the empty-index shortcut; unknown indexing remains unknown and may supply authorized pending text. No context result fabricates memory-stage completion. Current cutoff, canonical history and future queue exclusions are exercised through the actual combined read.
- Exact native schema tests reject cutoff/maxBytes/exclusions/profile/budget extras. Actual handler negatives cover wrong scope/reference, stale original attempt/lease, exact lease expiry, cancellation/revocation, conversation tombstone/epoch, native input edit and invalid context state before readiness/model effects.
- Post-query actual DB/component changes exercise revocation/expiry, original lease change, cancellation, input edit, pending source revision/hash/tombstone/owner denial. Original save rejects; no canonical context/model operation/attempt appears. An awaiting-approval source becoming eligible/indexed inside the captured cutoff causes the fresh empty recheck to reject STALE_CONTEXT; an incompatible current vector generation rejects PROFILE_NOT_READY. Existing wrong profile-pin coverage remains. A real competing save wins, and the later action cannot overwrite its canonical context.
- Fourteen scoped TypeScript AST checks verify executionContext/hydrateExecution/execution, startHandler/startExecution, Workflow executeTurn, saveContext/startContext/contextBarrier/failContext, modelStepHandler/beginOperation/recordOutput are unchanged, and the new endpoint is internal with exact original validators. No model, admission, native ledger, barrier deadline or save predicate was removed. This is static equivalence evidence, separate from runtime fixture assertions.

## Verification and retained failure

All commands ran in `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion` using pinned Node `/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node` version 24.15.0 and npm CLI 12.2.0. Checks used existing TypeScript/ESLint/Jest installations.

| Check | Observed result | Raw receipt |
| --- | --- | --- |
| First four-suite run | FAIL, exit 1; 115/116 tests passed, 0 skips/todo; only obsolete execution fixture port failed | cloud-context-batch-jest-v1.log / .json |
| Corrected execution suite | PASS, exit 0; 63/63, 0 skips/todo | cloud-context-batch-execution-recheck-v2.log / .json |
| Final coherent four suites | PASS, exit 0; 116/116, 4/4 suites, 0 skips/todo/failures | cloud-context-batch-jest-final-v3.log / .json |
| Backend tsc --noEmit -p convex-dev/tsconfig.json | PASS, exit 0, empty diagnostics | cloud-context-batch-backend-types-v1.log |
| Lint tsc --noEmit -p tsconfig.lint.json | PASS, exit 0, empty diagnostics | cloud-context-batch-lint-types-v1.log |
| Initial two-file scoped ESLint | PASS, exit 0, empty diagnostics | cloud-context-batch-eslint-v1.log |
| Expanded final three-file scoped ESLint | PASS, exit 0, empty diagnostics | cloud-context-batch-eslint-v2.log |
| Scoped git diff --check | PASS, exit 0 | Recorded in cloud-context-batch-checks-v3.json |
| Fourteen AST equivalence checks | PASS, exit 0 | cloud-context-batch-equivalence-v1.json |

Final discovery: context-latency 42, inline-barrier 7, execution 63, tool-context 4. Context tests add thirty-three outcome cases to nine existing cases. The unchanged inline-barrier suite exercises actual installed Workflow inline/replay/scheduler semantics and original strict deadline/error cases under controlled ports.

The first failure was not relabeled: the old execution test intercepted runtimeMemoryContext:pendingContext, a wrapper intentionally removed by this change, and expected a stop sentinel. It now intercepts the actual nested runtimeModelPolicy:embeddingProfile query used by original profile readiness, asserting the same reference, embedding.query operation and owned runBudgetId, then stops before model effects. The coordinator expressly expanded test ownership for this routine regression correction. Production did not change after the initial checks; only that test port changed. The failed suite and final four-suite reruns were justified by this observed failure/edit; passing type checks were not repeated without reason.

Exact commands, exit statuses, discovered counts, source hashes and every raw receipt hash are in `cloud-context-batch-checks-v3.json`, SHA-256 `cd4b13d67712d80c4d5610415d5c196319249f33430b9e0f5429cfcfde2451a8`. Jest used `CORTEX_TEST_ENV_MODE=explicit CONVEX_URL=http://127.0.0.1:9 CORTEX_RUNTIME_LATENCY_TRACE=0`, VM modules, watchman=false, testTimeout=10000, runInBand and exactly the four approved paths. The inert bootstrap URL is not contacted by these selected fixture tests.

## Reviewer limits and next qualification

The tests execute actual registered Agent/query/save/failure handlers and unchanged memory/profile/source helper bodies on controlled database/component/scheduler ports. They do not prove native OCC scheduling, deployed endpoint registration, paid inference, actual query cache timing or hosted SLO performance. The governed fallback test stops at real ledger policy resolution before inference and makes no billing or retrieval-result claim.

The new query deliberately uses one coherent initial read snapshot. Every later action/native write remains separately current; its result is not a write authorization. The empty/profile/source rechecks in original saveContext remain atomic. Trace probe markers moved beside the actual availability helper; fixed query timestamps are phase markers, not CPU-duration measurements. Default tracing behavior and helper code are unchanged.

No new file/dependency was added, so expected backend closure remains 158 pending root's actual immutable build verification. Explicit typed internal references follow the existing runtime pattern; no generated file was hand-edited. Root owns non-author source/test acceptance, installed candidate/codegen/endpoint inventory, actual hosted positive/negative/OCC/race qualification, browser/Basic first-visible/final measurements and cleanup. Prior K4 observations, failed memory outcomes and the under-one-second goal remain unchanged; admission and context savings both await an actual working installed measurement.
