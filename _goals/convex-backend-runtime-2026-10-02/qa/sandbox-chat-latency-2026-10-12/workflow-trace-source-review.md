# Judgment: Workflow trace crash repair

## Verdict: PASS

Independent source/test PASS under practical acceptance-policy v2 for the exact two-file guard repair below. The real Workflow crash path is addressed without a new caller flag, handler parameter, journal mutation, catch-all suppression, product file or authorization/model/budget change. Earlier coherent source acceptance remains applicable except that immutable artifacts containing this helper now need a fresh rebuild and qualification. The failed actual CLI run remains FAILED; this review claims no successful answer, UI prompt or subsecond outcome.

Read-only review in `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`. Applied the previously read workspace/runtime/profile, judge-task and goal-specific policy. Awaited `workflow-trace-repair-report.md` freeze, then inspected actual source/diff/test bytes, recorded diagnosis, actual installed Workflow0.4.8 environment, focused test JSON/log and reported affected ESLint/TypeScript checks. No source/service/GitHub mutation, inference, deployment, artifact change or test rerun occurred. Only this review was written.

## Evidence and requirements

| Requirement | Finding |
| --- | --- |
| Repair the concrete actual crash | **Met at source/controlled level.** Retained diagnosis identifies a TypeError reading env in `runtimeLatencyTrace.ts` at executeTurn entry, before any journaled step. The installed Workflow environment disables process (`node_modules/@convex-dev/workflow/dist/client/environment.js:68-118`). Helper now checks `typeof process === "undefined"` first and returns before env/hash/Date/console access (`convex-dev/runtimeLatencyTrace.ts:8-15`). |
| Keep deterministic handlers safe and native tracing available | **Met.** No module-load cached flag or caller-supplied bypass is added. Deterministic Workflow handlers emit no diagnostics; native mutations/actions still require exactly `CORTEX_RUNTIME_LATENCY_TRACE === "1"` and keep the existing scalar allowlist/correlation hashing. Native action/Gateway phases and journal/Completion metadata remain available for later measurement; replay logs are not invented additive timing. |
| Meaningful regression using actual dependency | **Met.** Test directly imports installed Workflow `setupEnvironment`, opts tracing in, proves process is absent, invokes the actual helper and reaches code afterward without an exception, restores the environment in finally, verifies original process identity/no output, then verifies opted-in tracing emits again (`tests/unit/runtime/latency-trace.test.ts:50-66`). This does not mock the disappearing global or substitute a duplicated guard. The next-step flag proves execution passes the former crash point; it does not claim actual Convex journal execution. |
| Product errors remain unsuppressed | **Met.** No broad catch appears in the helper. A native enabled console dependency failure still throws the original error (`latency-trace.test.ts:67-72`). Error handling at the Workflow owner is unchanged; model/context/auth fences are outside and unaffected by this guard. |
| Existing privacy/default-off behavior retained | **Met.** Undefined,0 andtrue flags remain off; opaque/hash correlation, extra-key exclusion and prompt/output/secret sentinel assertions remain (`latency-trace.test.ts:14-49`). Trace metadata shape and clock behavior are unchanged. |
| Focused affected quality evidence and narrow scope | **Met.** Raw Jest JSON independently parsed: success true,7 passed,0 failed/pending; actual test names include the dependency regression and enabled-error propagation. Executor records scoped ESLint exit0/no warnings and focused strict TypeScript exit0. Their empty logs contain no diagnostics but do not themselves independently encode exit status. No broader unchanged mocked recertification is needed. |

The diagnosis is scope-specific: zero journaled steps, Agent operations and answer-model attempts on the failed Agent run account. It does not imply zero billable calls globally; root separately observed seven qualification calls and two asynchronous-memory calls on other accounts. Its retained error fingerprint is `81a912c7f63b6b1d28f460be89991d56032aa37787b96a7d088074dadd99ec31`,393bytes; no raw prompt/output/error/credential content was consumed or retained by this reviewer. The log collector's single-quote wrapper decoding issue is separately documented and outside these two source files.

## Dimension scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement fulfillment | 4/5 | Exact absent-process guard addresses observed pre-step crash; native opt-in and all product fences retained. |
| Code quality | 4/5 | One early-return condition with explanation; no new parameter, state, retry, catch-all or service effect. |
| Test quality | 4/5 | Actual dependency environment, execution past crash point, restoration/native emission and error/privacy outcomes;7/7 recorded. |
| Pattern adherence | 4/5 | Diagnostic-only default-off helper and fixed scalar/correlation rules preserved; deterministic Workflow orchestration unchanged. |
| Completeness | 4/5 | Shared helper covers its existing Workflow callers; affected quality evidence supplied; fresh artifact/live acceptance explicitly pending. |

Average: **4.0/5**, satisfying acceptance-policy v2. **No blocking finding.**

Nonblocking upstream test-environment detail: Workflow's deterministic Date factory assigns the shared `Date.prototype.constructor`; its restore function restores the global Date reference but does not explicitly restore that constructor descriptor. This does not undo the reviewed guard or change native product source. Explicitly restoring that original descriptor would improve test teardown hygiene if this helper test is later expanded; it is not an additional acceptance gate or reason for a new broad test run.

## Exact reviewed hashes

Independently recomputed current bytes and matched the executor freeze:

| Source/test | SHA256 |
| --- | --- |
| `convex-dev/runtimeLatencyTrace.ts` | `3d99b70457ce6111d526422d55a44552e6de307096ef84e1f903123aaa01185c` |
| `tests/unit/runtime/latency-trace.test.ts` | `d4e064ca8298ca9084522ef575f1156c49537257e88bd40827da535b4703510d` |

Actual installed dependency: `@convex-dev/workflow`0.4.8; environment.js SHA256 **`18b20bcd510070db4ccbbc3c0c787519a6a7efb637b043c2420e056aa50d510b`**. Review receipt: `workflow-trace-repair-tests.json`,7/7 with zero pending/skipped; the original failed diagnostic and earlier artifact generation remain preserved.

## Recommendation

Accept this surgical source repair. Root rebuilds a new immutable generation, verifies updated source/output/archive/image/procedure linkage, then qualifies a fresh owned hosted Convex disposable target and retests actual canonical CLI/browser behavior. The user's primary latency boundary remains cloud submission to first visible answer, with Docker client conditions labeled; local Convex testing is secondary. Preserve prior failed run/uncertain liability, no paid identity retry, actual clock boundaries and owned cleanup. Source/test PASS is not live chat or SLO acceptance.
