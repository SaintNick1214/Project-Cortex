# Task Completion Report

## Status: SOURCE/TEST COMPLETE; installed cloud timing pending

Implemented the independently approved `cloud-next-batch-plan.md` admission optimization. The combined mutation now awaits the original submit, start and get handler bodies directly, retaining the same arguments and order. It avoids their three nested function wrappers while keeping all original authoritative checks and nested claim/component/Workflow operations. No latency improvement or under-one-second achievement is claimed from this offline batch.

## Changes made and frozen files

| File | Change | SHA-256 |
| --- | --- | --- |
| convex-dev/runs.ts | Extract unchanged get body into getHandler; existing registration/validators use it. | 6cb60d04a373f1123e41951c257c57089fce9a00b167fead16fd0424a4f8ec3e |
| convex-dev/runtimeAgent.ts | Extract unchanged start body into startHandler; existing registration/validators use it. | e86ec3e1aecc293aa49fcb7fe7f6b37defee4593af986b45d043e0a54d3cce61 |
| convex-dev/runtimeClient.ts | Sequential original submit/start/get helpers with identical arguments; remove only obsolete references/types/imports. | 8d9b97f2d270cbc8efdbd47ff04c0fec0e9c7b819d949d0c542ca5e96c07fd45 |
| tests/unit/client-runtime/admission-native.test.ts | Preserve existing admission outcomes; replace removed-wrapper fault hooks with actual DB/scheduler/component ports; add thirteen negative/failure cases. | b4607fb622bed54a156782cb9b5ddd88a99a205ee349ac1ef0b3ba66bd80e4eb |

These four files are frozen for non-author review. No other product, client, Proofs, schema, generated, package or distribution files were edited by this task. Existing unrelated QA modifications and untracked work were preserved. No Git write, service read, inference, deploy or Docker invocation occurred.

## Requirements and meaningful proof

- Original get/start bodies and registered argument validators are identical to the prior HEAD source. The scoped TypeScript AST receipt also verifies submitHandler, startExecution and modelStepHandler are unchanged; the direct calls retain identical argument expressions and await order; final identity check/return, outer endpoint validator and session/signal declarations are unchanged. All seventeen scoped source-equivalence checks passed. This is static evidence, separate from the actual-handler tests.
- Successful admission creates one native canonical input, original account, scoped run/outbox/attempt, and Workflow. Tests now require zero submit/start/get wrapper invocations and retain the exact nested claim reference, conversation and 300,000ms lease. Explicit selectors and streaming=false survive in authoritative rows and the returned scoped handle.
- Existing exact request/streaming replay, legacy submit/start interoperability, explicit approval, waiting/running queue head, wrong queue head refusal and supported oversized-prefix failed retirement remain covered. No new model admission, funding, retry, fallback or approval lane exists.
- Revocation is injected into the actual grant after submit's final DB read, before start's own fresh authority lookup. The actual start body denies; the entire transactional fixture returns to its prior transcript, accounts, run/outbox/attempt, component effects and scheduler state.
- After Workflow insertion, actual grant read permission/expiry, conversation retention expiry/tombstone/epoch and run tombstone changes are freshly denied by get/currentControlRun. A changed authoritative run definitionHash is projected by real getHandler and rejected by the unchanged final tuple check. Each case proves Workflow insertion was reached and every effect subsequently rolled back.
- Retired/changed definition and native input content edit before claim are rejected by the original start/claim checks. Exact grant expiry at now == expiresAt rejects without effects. Partial native save, completed native claim and appended Workflow scheduling failures each occur after real fixture writes and reject with complete parent rollback.
- Model/context/ledger guards and the original action attempt/lease binding remain untouched. Client fresh pre/post sessions and finite expiry are unchanged. Nested claim/component subtransactions and supported terminal return dispositions remain intact; there is no new catch around the direct helpers.

## Verification

All checks ran in `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion` with pinned Node `/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node`, version 24.15.0; npm CLI version 12.2.0. Installed TypeScript 6.0.3, Convex 1.46.0, Jest 30.5.2 and ESLint 10.11.0 were verified.

| Check | Result | Raw receipt in this directory |
| --- | --- | --- |
| Five selected Jest suites | PASS, exit 0; 172/172 tests, 5/5 suites, 0 failed/skipped/todo | cloud-admission-direct-jest-v1.log / .json |
| Backend tsc --noEmit -p convex-dev/tsconfig.json | PASS, exit 0, empty diagnostics | cloud-admission-direct-backend-types-v1.log |
| Lint tsc --noEmit -p tsconfig.lint.json | PASS, exit 0, empty diagnostics | cloud-admission-direct-lint-types-v1.log |
| Scoped ESLint on these four files, report-unused-disable-directives | PASS, exit 0, empty diagnostics | cloud-admission-direct-eslint-v1.log |
| Scoped git diff --check | PASS, exit 0 | Recorded in cloud-admission-direct-checks-v1.json |
| Seventeen AST equivalence checks | PASS, exit 0 | cloud-admission-direct-equivalence-v1.json |

Jest discovery: admission-native 32, client 60, observe-delivery 2, managed transcript 15, Agent execution 63. Exact commands, versions, exit statuses, counts, source hashes and raw receipt hashes are recorded in `cloud-admission-direct-checks-v1.json`, SHA-256 `5c52be00348f3f6067044a690ad4574d90f1357f85924650869d5af1b29c274b`. All checks passed on their first invocation; there is no failed interval to relabel or discard.

Jest used `CORTEX_TEST_ENV_MODE=explicit CONVEX_URL=http://127.0.0.1:9 CORTEX_RUNTIME_LATENCY_TRACE=0`, `--experimental-vm-modules`, `--watchman=false`, `--testTimeout=10000`, `--runInBand`, and `--runTestsByPath` for exactly the five approved paths. The inert loopback URL satisfies test bootstrap; these selected tests invoke no service. The actual registered/shared handler bodies execute on the existing controlled transactional/native-component fixture; Workflow scheduling is a controlled fixture, not a live Workflow execution or native OCC proof.

## Notes for reviewer and remaining qualification

The outer combined mutation has no catch. Any thrown helper/identity error rejects the parent, while original queued/waiting-approval and bounded-prefix failed return values intentionally commit. Direct helpers use the outer mutation clock; original expiry/window/lease predicates and timestamp expressions remain unchanged, and exact-boundary expiry denial is tested. Fixed mutation timestamps must not be used as wall-clock latency measurements.

No endpoint or dependency was added; the expected distribution closure remains 158 files, pending the root-owned actual immutable build/source-output verification. Non-author source/test acceptance, packed candidate checks, fresh hosted positive/negative admission, native OCC/expiry qualification and actual browser/Basic first-visible/final measurements remain root-owned. K4's observed 1,500.2/1,359.8ms combined client admission and 11,159.8/8,260.5ms after-paint first visibility are historical boundaries, not prospective savings or SLO success. Prior failed memory and latency receipts remain valid history.
