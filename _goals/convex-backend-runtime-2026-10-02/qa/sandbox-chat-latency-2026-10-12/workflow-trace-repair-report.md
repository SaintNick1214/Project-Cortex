# First actual CLI failure diagnosis and surgical trace repair

Status: COMPLETE for diagnosis and the authorized source/regression repair; fresh immutable packaging/deployment and actual canonical CLI/browser retest remain root-owned. The failed run stays FAILED. No first-visible text or subsecond SLO result exists for it.

## Actual cause

Freshly verified READY session `8a1aa585-aff0-4383-acda-c221c6d405e1` belongs to disposable `energized-wildcat-602`, ID6129766, reference `dev/cortex-sandbox-8a1aa585-aff0-4383-acda-c221c6d405e1`, Cortex team325340/project3200658. The read-only diagnostic used exact target assertions, three fresh cloud identity verifications, private scoped operator credentials, installed official WebSocket system-query reads and one native log GET per completed diagnostic read. Persist/receipt callbacks were overridden to keep all diagnostic writes inside this QA directory; no Proofs journal/receipt/config was altered. No prompts, answer output, tokens, raw exceptions or raw log payloads were retained or printed.

Exact run `run:f4d14aabf2582a430af257b90deae750fe96b0e8762ce6a69f69a0363d57a70a` has `responseStatus=failed`, `failureCode=EXECUTION_FAILED`, attempt1 and zero canonical output messages. Its Agent execution failed; Workflow `jd728h9gjh7jhrazd6wdjnke7h8g64x5` persisted a failed result at generation0 with **zero journaled steps**, zero Agent operations, zero native model operations/attempts on that Agent run account. This does not assert zero global/background paid calls; root separately observed the seven qualification attempts plus two asynchronous memory attempts on other accounts.

The privately inspected actual Workflow error is a TypeError with the fixed undefined-`env` access signature and stack location in `runtimeLatencyTrace.ts` called at `runtimeAgent:executeTurn` entry. Its retained nonsecret fingerprint is `81a912c7f63b6b1d28f460be89991d56032aa37787b96a7d088074dadd99ec31` (393bytes); `first-cli-failure-diagnosis.json` stores classifications and source locations, not raw text. Installed Workflow0.4.8 `setupEnvironment` sets `globalThis.process=undefined` before calling handlers. The trace helper unconditionally dereferenced `process.env` before the first journaled `startContext` call. That concrete source/runtime mismatch caused this failure; policy, context retrieval and the answer provider had not started.

Native Completion `error` fields in the bounded post-run window were absent: the Workflow wrapper catches this exception and records its logical failed `runResult`. Therefore the authoritative failure evidence is the actual Workflow result and stack, rather than a guessed provider/network error or the coarse Completion error flag.

An initial HTTP attempt to the CLI system-table endpoint was unsupported and made no mutation. The diagnostic then used the installed official system-query WebSocket protocol; subscriptions and client were closed after the bounded reads.

## Trace collector correction

Actual native log lines are structured objects with `messages: string[]`, `level`, `timestamp`, `isTruncated`, `systemMetadata`, and sometimes `componentPath`/`udfPath`. The two emitted claim messages contain JSON wrapped in one matching outer **single-quote pair**. Direct `JSON.parse(message)` therefore misses them. Stripping that matching pair, then parsing JSON recovers actual `claim.begin` and `claim.end` events for this exact run. The original collector/snapshot were preserved; the QA diagnosis helper records the observed decoder sequence `single-quote-wrapper → json-object`.

Smallest correction for root-owned `service-log-snapshot.mjs`: normalize one matching outer single-quote pair before `JSON.parse`; optionally parse a returned JSON string once more for genuinely JSON-serialized strings. Retain its existing strict scalar projection/run/phase checks, bounded payload, no raw-error retention and current target verification. No eval/unrestricted log forwarding is needed. The trace env was enabled in native admission; phases0 was a decoder issue, separate from the Workflow failure.

## Surgical product change and meaningful regression

Only `convex-dev/runtimeLatencyTrace.ts` and `tests/unit/runtime/latency-trace.test.ts` changed. The helper now returns before env access when `typeof process === "undefined"`. It does not cache/bypass a flag at module load, pass a new caller-controlled flag into Workflow, swallow arbitrary exceptions, or change a model/auth/budget/source fence. In deterministic Workflow handlers tracing safely defaults off. Ordinary native mutations/actions retain their existing opt-in tracing, scalar allowlist and hashed correlations.

The regression imports and executes the **real installed Workflow0.4.8 `dist/client/environment.js` setupEnvironment**, proves it disables process, calls the actual trace helper and reaches code afterward without an exception, restores the environment, then proves opted-in native traces still emit. Existing privacy/default-off/hash/extra-secret-field tests remain. An enabled native console failure still propagates, proving no broad catch was introduced.

No native per-stage insertion or caller flag is needed. Actual Workflow journal step names/start/completion times and native Completion metadata identify barrier/context/model/finalize stages; existing native action context/probe/recall and Gateway/ledger traces plus the canonical client monotonic clocks cover the timing chain. Workflow replay logs are not additive timing, and a mutation's clock may be fixed within its transaction.

## Verification and frozen files

Node24.15.0 at `/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node`; explicit cwd `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`.

- PASS: focused Jest trace suite **7 passed, 0 failed, 0 skipped**, `workflow-trace-repair-tests.json/log`. Same explicit inert bootstrap (`CORTEX_TEST_ENV_MODE=explicit CONVEX_URL=http://127.0.0.1:9`), `--experimental-vm-modules --watchman=false --runInBand --runTestsByPath tests/unit/runtime/latency-trace.test.ts`.
- PASS: two-file scoped ESLint, `--report-unused-disable-directives`, exit0/no warnings, `workflow-trace-repair-lint.log`.
- PASS: focused TypeScript `--ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --types node` on those two files, exit0, `workflow-trace-repair-typecheck.log`.

No paid inference, deployment, service mutation, Proofs/artifact edit, Git write, GitHub or Union Arena access occurred. Actual failed-run/zero-Agent-model evidence and original generation artifacts remain intact. Root owns independent review, new generation, disposable target and real installed retest.

| File | SHA-256 |
|---|---|
| `convex-dev/runtimeLatencyTrace.ts` | `3d99b70457ce6111d526422d55a44552e6de307096ef84e1f903123aaa01185c` |
| `tests/unit/runtime/latency-trace.test.ts` | `d4e064ca8298ca9084522ef575f1156c49537257e88bd40827da535b4703510d` |
