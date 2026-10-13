# Fresh V3 context transaction separation

Status: source/test COMPLETE and three files frozen for one non-author review. Actual affected tests, root/backend/lint TypeScript, scoped ESLint, declaration/contract equivalence and owned whitespace checks passed. This is a source milestone; no V3 installation, native OCC result or latency acceptance is claimed. No service, inference, Proofs, package, compiled policy, generated binding or Git write occurred.

The saved K9 browser chain measured 12,433.3/12,882.5ms after-paint, with five real OCC retries before each successful initial V2 `workflow/workpool` wrapper transaction. Those transaction chains lasted 8,097.154/8,833.941ms; processed native text followed stream dispatch by 477/534ms. The exact conflicting document/table was not retained. K9 was subsequently cleaned by the coordinator. The one-second submission-to-visible-text goal remains unmet, and this edit predicts no subsecond outcome.

## Exact change and retained contracts

The only product file is `convex-dev/runtimeAgent.ts`. It adds the internal `executeTurnV3` Workflow registration and changes the fresh `startExecution` dispatcher reference from V2 to V3. V3 has the exact V2 layout and arguments with one difference: `prepareEmptyContext` uses `{ inline: false }`. The installed Workflow 0.4.8 API supports that explicit option; its executor persists an in-progress step and suspends, rather than invoking the context mutation in the current Workflow transaction.

Both historical `executeTurn` and `executeTurnV2` registrations and bodies remain byte-exact for their existing journals. There is no migration, reinterpretation, version flag from a caller or synchronous start. The original attempt tuple, `startAsync`, onComplete/context, strict barrier/sleep/deadline/failure ordering, guarded model/tool/approval loop, retry options, finalization/ingestion, optional title and completion handling remain unchanged. The existing typed API derives from the module; no generated file was edited.

`prepareEmptyContext`, `contextInputsHandler`, `saveContextHandler`, `executionContext`, every model/Gateway helper, and all other original declarations remain unchanged. The scheduled context mutation executes the exact original snapshot, pending/exclusion/empty-profile proof and fresh save re-probe: authority/revocation/tombstone, source/hash/witness, transcript/edit, cutoff, profile/index, lease/account/budget, completeness/warnings and size caps are retained. No network or model call was added to the mutation. `FAILED` still reaches the separate original durable `failContext`; `NEEDS_ACTION` still invokes the original governed `prepareContext` Action.

The declaration audit proves 65 original declarations byte-equal against the saved actual ae9 preimage, with only the one fresh dispatcher string changed. It proves V3's entire initializer equals V2's initializer after the registration name and that one scheduling option are substituted. Historical declaration SHA-256 values are `executeTurn` `653ae8dc0f5d8b3bead4ecd6f3cd61ec9c51a2aca3eaae1d398fefede8cc61e7` and V2 `e7f5167e129e3e38465fbf70432999c3834da2a10e3827dfbfc84a0ff8805178`. The whole product preimage is retained in `cloud-context-transaction-separation-preimage.ts`; the equivalence JSON includes full-file hashes and literal excerpts of the actual installed Workflow/workpool source.

The transaction boundary removes the context readset from the same Workflow journal transaction. The original context mutation still has a large, volatile readset and can itself OCC. An extra schedule/completion hop is added; its cost has not been measured. Populated/unknown indexed context still incurs the V2 probe before the unchanged Action re-probe/retrieval, so this batch does not remove that disclosed fallback cost. Versioned duplication is intentional for historical journal compatibility; all three layouts should remain covered when later changes are made.

## Actual checks and regression scope

Pinned Node 24.15.0/npm 12.2.0 and installed Workflow 0.4.8 were used. `cloud-context-transaction-separation-checks.json` records absolute cwd, command/arguments, input/dependency hashes and raw receipts.

| Check | Observed result |
| --- | --- |
| Affected serial offline Jest | 186/186 tests; four/four suites; zero skips; exit 0 |
| Root CI `tsc --noEmit` | exit 0 |
| Backend TypeScript | exit 0 |
| Lint TypeScript | exit 0 |
| Scoped ESLint: source and both changed tests | exit 0 |
| Original declarations/installed contracts audit | exit 0 |
| Owned tracked diff whitespace | exit 0 |

Actual suite counts: `execution.test.ts` 86, `empty-context-inline.test.ts` 39, `context-latency.test.ts` 42, `empty-context-workflow.test.ts` 19. The static discovery banner counted 182 before parameter expansion; the JSON contains the actual 186 passing outcomes. Tests used explicit offline URL `http://127.0.0.1:9`, trace off, serial Jest and no Watchman. All selected checks passed on their first run; raw logs/JSON are retained. Unchanged broader policy/Gateway/ingestion dependencies were not recertified again.

The new Workflow regressions use the real installed `StepExecutor` and `createWorkflowCtx` with controlled durable journal/storage ports and the actual registered product context/barrier/failure handlers. They prove that the parent reaches a persisted pending mutation with no context invocation/save/model dispatch; the original handler runs separately; completed context journal replay invokes no context handler and repeats no context writes; and a parent journal-port failure occurs before a context save. They preserve original NEEDS_ACTION governed fallback, overflow's FAILED marker before original durable failure, strict sleep/deadline/warning outcomes, and current revocation/lease/cancellation/tombstone denial after queueing but before save. Fresh start routing still checks duplicate ownership, asynchronous start and original completion reference.

A separate installed-executor test journals model, canonical-finalize and title steps in order. Controlled model/terminal-job result ports test Workflow scheduling and replay; they do not assert native publication from a fabricated model result. Actual model/finalization guards are exercised by the retained 86-case execution suite. Optional title failure completes the Workflow through the unchanged original title catch boundary. All original V2/historical Workflow assertions remain; the single fresh routing expectation changes to V3 as required.

Fake transaction rollback fixtures establish controlled failure propagation/state outcomes, not native Convex OCC/isolation or resource behavior. Actual V3 registration/install/readback, context-vs-Workflow retry behavior, current authority/native negative outcomes and end-to-end cloud measurements remain the successor disposable-candidate checks owned by the coordinator. No speed gain is accepted from these tests.

## Bounded documentation alignment

The coordinator changed one prospective performance paragraph in its isolated `SaintNick1214/cortexmemory.dev` backend-runtime docs worktree, leaving the other six previously reviewed pages unchanged. `docs/architecture/performance.mdx` SHA-256 is `fa34b456a9b0743f2eea8b8ccb4772b4732c04aa4abedef0e1086302ead4b211`. The paragraph states separate fresh-context mutation, preserved old V2 journals/fresh guards, possible context OCC and the nonempty extra probe; it asserts no speed guarantee.

The coordinator-owned `docs-context-separation-build-v5.log` observes build exit 0; its retained build output contains the existing stale Browserslist database notice. `docs-context-separation-browser-v5.json` records the actual `/architecture/performance` render/screenshot, no browser errors/warnings, closed owned tab and stopped loopback server, no publication. These bounded receipts are included in the checks JSON for the same source/test review. This author did not rerun or review the whole website and did not edit docs.

## Frozen files

| File | SHA-256 |
| --- | --- |
| `convex-dev/runtimeAgent.ts` | `c5a5038d15e3dad1cef2df772ff1ff2286fb80804d6dbc8dd61ea6a9a6084a54` |
| `tests/unit/runtimeAgent/empty-context-inline.test.ts` | `ececfb002289eac6663d8bc2b1cf756bacf27781c3c01e17ef41eb9555235af1` |
| `tests/unit/runtimeAgent/empty-context-workflow.test.ts` | `7a4fd364feabd9603f2cacad4d6e3b824e654eede01d2880a091de59ca3e3912` |

Source baseline is `ae9a836ff9c5e6a0ce9a279bdbdb96ad37c2a448`. Only these three core files and this batch's prefixed QA artifacts were changed. Frozen policy/qualification/Gateway/helper files, unrelated QA/local work, the historical kit and deployed K9 generation were preserved.
