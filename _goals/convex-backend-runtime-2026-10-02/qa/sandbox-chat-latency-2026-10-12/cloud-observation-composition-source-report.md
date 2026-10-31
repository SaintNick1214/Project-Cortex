# Private observation composition — source/test handoff

The bounded source batch is implemented and frozen for non-author review. Independent acceptance and installed/native/browser performance qualification remain pending. No new latency measurement, deployment, inference, browser interaction, Proofs change, Git commit, or release was performed by this executor. The coordinator's K6 browser measurements use the earlier installed source and cannot certify this batch.

Repository: `SaintNick1214/Project-Cortex`, continuation checkout `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`. Source base at final freeze: `4c2bc7cffafd57b5493f6305f48e390621528793`; other authors concurrently changed separate Agent/ledger and observed qualification files. Only the two permitted production files and three corresponding test files were edited. No generated binding, schema, public SDK type, model policy, gateway, template, or other application edit was necessary.

## Resulting contract

`runtimeClient.observeEnvelope` is a registered authenticated mutation with exact native arguments. It directly composes the unchanged original `sessionHandler` and `runtimeAgent.observeHandler` in one parent transaction. The new handle supplies expected immutable identity only; its principal, tenant and space do not grant authority. Original optional configuration selectors stay optional when deriving the pre-session, so an ambiguous omitted scope cannot be filled from the handle. The actual actor must match the handle's principal and scope before observation, and the returned run must match its run/conversation/agent/version/definition/scope tuple. Original read, resource, context/artifact/media witness, source and delivery-deadline guards remain inside the reused observation body. The original session and observation endpoints remain callable. The cached reactive signal remains unchanged and payload-free.

The SDK requests this strict versioned envelope, validates its session and projected observation, and then obtains a **separate fresh post-session** before delivering any value. Auth generation, current authenticated state, scope/principal identity, closed-client behavior, bounded calls and actor expiry remain checked. Existing one-shot `trackDelivery` and watcher deadline logic still consume protected-source expiry before return/callback, preserving their cleanup dispositions. No authority cache, shared private-payload cache, skipped post-I/O transaction, automatic retry, model call, or deadline relaxation was introduced.

Ordinary one-shot and private watcher page acquisition use two client RPCs: envelope, then independent post-session. Old-attempt one-shot reset makes two such acquisitions, retaining four calls and discarding the old cursor result before return. Existing watcher active/epoch checks, burst coalescing, disposal, reauthentication, cursor/attempt reset, approval state, ordered page drains, terminal output and reconnect subscriptions are retained. Generic `inSession` for every other operation is unchanged. This removes one client RPC boundary per ordinary observation acquisition in the controlled tests; it does not predict any time saving or establish subsecond hosted replies.

## Evidence

Node `24.15.0`, declared npm `12.2.0`, TypeScript `6.0.3`; explicit local installed tools. Checks ran with absolute cwd above. Final hashes and raw receipt hashes are in `cloud-observation-composition-source-checks.json`.

| Check | Observed outcome |
|---|---|
| Complete client-runtime unit regression suite | **248/248 PASS**, 8 suites, zero failed/skipped/todo; final v4 JSON/log, 5.363s |
| Original-handler observation fixture | 30 cases within the final suite: exact original projections, optional/ambiguous selectors, immutable identity, resource/actor denial, late grant revocation/expiry, original delivery recheck, controlled rollback and exact native argument graph |
| Root TypeScript | v2 exit 0 after the separate author's qualification-test narrowing repair |
| Backend TypeScript | exit 0 |
| Lint TypeScript | exit 0 |
| Scoped ESLint on both source and all three changed tests | final v2 exit 0 |
| Scoped Git whitespace check | exit 0 |
| AST equivalence | 16 unchanged original handler/fence bodies/registrations; session extraction, original private observation, generic inSession, auth/session/call/deadline/close, watcher public cursor/drain bodies, admission/cancel and payload-free signal |

Meaningful SDK regressions assert exact envelope/post-session order and selectors, retained four-call cursor restart, denied private projection under a changed actor, fresh post-session principal/tenant/space/revocation withholding, rejected unknown envelope/session/payload branches, source-expiry withholding with original authentication cleanup, late response after observer disposal in both envelope and post-session phases, abandoned pre-refresh output followed by fresh reacquisition, no duplicate signal burst reads, complete 104-part terminal drain, handled time-only deadline and no redispatch/delivery after a stalled private envelope.

Final test command:

```text
CORTEX_TEST_ENV_MODE=explicit CONVEX_URL=http://127.0.0.1:9 /Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --watchman=false --forceExit --testPathPatterns=tests/unit/client-runtime --json --outputFile=_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/cloud-observation-composition-jest-v4.json
```

Quality commands used that same Node path with local `node_modules/typescript/bin/tsc --noEmit`, `--project convex-dev/tsconfig.json --noEmit`, `--project tsconfig.lint.json --noEmit`, and `node_modules/eslint/bin/eslint.js` over the five named source/test paths with `--report-unused-disable-directives`. The AST helper and receipt declare their exact frozen base and checked body hashes. Test handlers use controlled DB/native component ports; no actual Convex OCC, remote rollback, deployed endpoint, service or browser success is inferred from them. Packed/browser contracts and installed consumers belong to the coordinator's integration gate.

## Preserved failures and limits

The original v1 focused Jest receipt remains **135 PASS / 1 FAIL**. The added three-envelope count assertion encountered a test override that recorded cursor reads but omitted its mocked calls from the fixture's call log. The successor records each actual call in that override and retains the assertion; no cursor/output/deadline assertion was removed. v2 then passed 136/136; v3/v4 include the full module suite and additional stalled-response/deadline cleanup coverage.

Root TypeScript v1 exited 2 solely for two `operationKey` union-narrowing errors in another author's `tests/unit/runtime/observed-json-qualifications.test.ts:86`. The coordinator was informed, this executor did not edit that file, its author repaired it, and final v2 exited 0. Both raw logs are retained.

Unrelated original `work/resume/task04-c8-*` files and the existing `workflow-trace-repair-report.md` dirt were preserved. Historical C7 failures/custody gaps and all K3/K4/K5/K6 observations remain scoped history. This source handoff does not change goal/task completion percentages or approve a live target; the non-author review, fresh artifact build/public contracts, actual installed endpoint/client/race outcomes, cleanup and final audit remain outstanding for this new candidate.
