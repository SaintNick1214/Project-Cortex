# Task Judgment: Private V8 control/hash retention and title source framing

## Verdict: PASS

This is one non-author source acceptance review of the frozen 11-file batch. It does **not** grant final goal acceptance, hosted latency acceptance, installed native qualification, or live model title quality acceptance. Acceptance policy v2 supersedes the older rubric score thresholds.

## Evidence Review

- Repository: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`.
- Base: `0d9199622f5f70af9604c07d2d4ac07c8c9f6bcd`.
- Frozen manifest: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-control-coherent-source-hashes.json`; SHA-256 `88bd2a56b2efa4df88b06658ca925792f04d733dc3731cbd04fe8ca587455161`.
- All 11 actual source/test hashes matched the manifest both before and after review.
- Read repository AGENTS.md, runtime adapter, project profile, pessimistic-judge role, judge-task rubric and goal acceptance policy. Examined all tracked deltas and both untracked test files, schema/index definitions, actual handler wiring, official installed Convex writer surfaces and the author reports.
- Independent five-suite run: **238 passed, 0 failed, 0 skipped, 0 todo**, natural exit 0 with `--forceExit=false` (28.81 seconds). Official Jest JSON is authoritative; the custom timing reporter collapses repeated names and reports 223 distinct timing entries.
- Independent full `tsc --noEmit`, ESLint over all 11 reviewed files, focused owner/identity probes and bounded `git diff --check` passed. Commands, cwd, versions, raw output and initial setup failure are retained in named receipts.

## Requirements Review

| Requirement | Met | Evidence and reachability |
|---|---|---|
| Exact private V8 owner activation; public/default/V7/native/source views remain original-read | Yes | Only explicit private V8 native scopes receive the own nonserialized symbols and self-bound reader. Spreads, inherited/copy descriptors, fake same-description symbols and db replacement cannot reuse it. Evidence: `convex-dev/runtimeAuth.ts:64-89`, `convex-dev/runtimeAuth.ts:177-201`, `convex-dev/runtimeAuth.ts:478-486`, `tests/unit/runtimeMemory/v8-control-read-scope.test.ts:24-38`, `memory-effort-control-independent-owner-probes.log` |
| Only original raw by_attempt execution take(2) and by_attempt kind=tool take(33) results retained | Yes | Original query/index/equality builders run on every logical call. singleTranscript, lease/reference/state/source/tool/budget predicates remain in their original caller and order; financial/model/by_operation reads are unchanged. Evidence: `convex-dev/runtimeAuth.ts:71-83`, `convex-dev/runtimeAgent.ts:127-135`, `convex-dev/runtimeAgentFence.ts:24-82`, `convex-dev/runtimeTranscript.ts:481-497` |
| Raw cloning, absence/duplicate/cardinality semantics and shared 512-entry/1,000,000-byte caps | Yes | Cache entries include key bytes, detached values and distinct operation identities. Saturation takes the original query/digest fallback; no result truncation is introduced. Evidence: `convex-dev/runtimeAuth.ts:100-101`, `convex-dev/runtimeAuth.ts:292-300`, `convex-dev/runtimeAuth.ts:402-410`, `tests/unit/runtimeMemory/v8-control-read-scope.test.ts:32-47`, `tests/unit/runtimeMemory/v8-control-read-scope.test.ts:75-79`, `tests/unit/runtimeMemory/v8-control-read-scope.test.ts:94-102` |
| Invalidate controls and hashes before/after all original writes, including pending/failed/unknown/fluent/component writes and late results | Yes | All installed native writer methods, fluent table writer methods and runMutation are fenced. New families are evicted independently of other-family retention; writers suppress hits/population and graphEpoch rejects late population. Evidence: `convex-dev/runtimeAuth.ts:435-476`, `tests/unit/runtimeMemory/v8-control-read-scope.test.ts:47-74`, `tests/unit/runtimeMemory/v8-control-read-scope.test.ts:85-102`, `node_modules/convex/src/server/impl/database_impl.ts:138-218` |
| Exact canonical byte SHA-256 success reuse only; canonicalization and validation/comparisons remain current | Yes | Only completed digest strings are stored by exact string key. Errors and in-flight promises are never stored. Every call still creates canonical bytes from its current input and performs the original digest comparison; wrapped message/revision changes reject with original rollback. Evidence: `convex-dev/runtimeAuth.ts:85-89`, `convex-dev/runtimeAuth.ts:402-410`, `convex-dev/runtimeAuth.ts:481-485`, `convex-dev/runtimeTranscript.ts:109-114`, `convex-dev/runtimeTranscript.ts:431-438`, `convex-dev/runtimeAgent.ts:207-218`, `tests/unit/runtimeAgent/v8-control-read-composition.test.ts:120-138` |
| Registered empty/recent/selected-source/whole recall on/off preserves body/output/state/effects/ordered predicates and noncandidate reads | Yes | Actual registered handlers are invoked through fixture native argument checks. All five inline empty-save candidate reads and four by_operation reads remain physical. Exact body, full state/native effects and original noncandidate read sequence are asserted. Evidence: `tests/unit/runtimeAgent/v8-control-read-composition.test.ts:96-138`, `tests/unit/runtimeAgent/whole-recall-composition.test.ts:621-646`, `memory-effort-control-independent-retry-jest.json`, `memory-effort-control-independent-retry-tests.log` |
| Historical tests retain assertions; isolate only new helpers in old mechanism comparisons, no production bypass | Yes | Exactly four preparation cases and five parameterized whole-recall cases opt out of only the new private helper reuse; all prior assertions remain. Defaults reset before each test; other 13 preparation cases and new differential cases exercise both mechanisms. No production disable option was added. Evidence: `tests/unit/runtimeAgent/v8-preparation-read-retention.test.ts:9-19`, `tests/unit/runtimeAgent/v8-preparation-read-retention.test.ts:39-40`, `tests/unit/runtimeAgent/whole-recall-composition.test.ts:18-37`, `tests/unit/runtimeAgent/whole-recall-composition.test.ts:59-60` |
| Title-only source framing and topic instruction in actual governed serialized provider body; other content and parser/caps/account behavior preserved | Yes | Standalone, automatic and artifact secondary title requests use a single JSON source data value. Official installed provider serialization matches the governed ledger request. Non-title primary source and system text stay unchanged, title parser is byte-for-byte unchanged, assembled-byte and governed cost/output limits remain. Fixed offline response does not establish live model quality. Evidence: `convex-dev/runtimeContentGateway.ts:33-46`, `src/domain/content.ts:44-60`, `tests/unit/runtimeContent/jobs.test.ts:44-56`, `tests/unit/runtimeContent/jobs.test.ts:147-198`, `tests/unit/runtimeContent/jobs.test.ts:124-136` |

## Changed-file coverage

| File | Review focus |
|---|---|
| `convex-dev/runtimeAuth.ts` | Self-bound own-symbol reader, exact raw query/digest keys, shared caps, cloned values, writer/epoch fences and view exclusions. |
| `convex-dev/runtimeAgent.ts` | Raw execution helper wiring, current pin/selection digest checks, unchanged by_operation reads and ordered candidate guards. |
| `convex-dev/runtimeAgentFence.ts` | Original run/source/authority/lease/budget checks and tool cardinality/approval loop remain. |
| `convex-dev/runtimeTranscript.ts` | Current canonicalization/hash comparisons and historical-owner source/pin guards remain; original reads outside exact V8 owner. |
| `convex-dev/runtimeContentGateway.ts` | Title-only JSON data framing before original assembled-byte guard and governed dispatch. |
| `src/domain/content.ts` | Only title system wording changes; parser and non-title system branches unchanged. |
| `tests/unit/runtimeMemory/v8-control-read-scope.test.ts` | 25 cases: exact context/lane identity, clone/null-equivalent absence/cardinality/error/caps, all writer families, pending and late reads/digests. |
| `tests/unit/runtimeAgent/v8-control-read-composition.test.ts` | 11 actual registered positive/negative/tamper cases comparing complete outputs/state, logical guard sequence, query builders and noncandidate reads. |
| `tests/unit/runtimeAgent/v8-preparation-read-retention.test.ts` | 17 cases retained; four old mechanism comparisons isolate only new helpers; remaining 13 keep them active. |
| `tests/unit/runtimeAgent/whole-recall-composition.test.ts` | 141 cases; one whole registered recall differential added; five old mechanism instances isolate only new helpers. |
| `tests/unit/runtimeContent/jobs.test.ts` | 44 cases, official-provider serialized-body and governed-ledger assertions; stale scheduler expectations strengthened to exact direct-V6 and title Workflow refs/payloads. |

## Independent outcomes

| Controlled path | Original / retained raw reads | Original / retained digests | Additional assertions |
|---|---|---|---|
| Empty, normal | execution 25 / 9; all candidates 34 / 13 | 302 / 242 | 5 inline empty-save physical reads remain; 4 by_operation reads remain. |
| One recent pair, fast | execution 25 / 9; all candidates 34 / 13 | 446 / 284 | Exact output/body/state/effects/predicate/builder and noncandidate read order. |
| Two recent pairs, normal | execution 25 / 9; all candidates 34 / 13 | 590 / 302 | Same assertions. |
| Whole registered recall + save/candidate | 45 / 11 | 412 / 327 | Exact model/state/guard sequence and every noncandidate read. |

The extra independent live-import probe verifies same-description Symbol forgery, descriptor-copy owner mismatch, replacement of `db` on the exact owner, original query-builder execution on every logical call and fallback for -0/NaN/Infinity/noninteger attempt numbers. It performs no network calls.

## Issues Found

### Critical (must fix)
- None. No observed or concretely reachable breaking finding in this reviewed batch.

### Important (should fix)
- None for source acceptance.

### Minor (consider fixing)
- None requiring source changes. The implementation remains deliberately private and bounded; future native writer API additions must remain covered by the existing writer fence, as with the pre-existing scope design.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 4/5 | All scoped behaviors are wired and covered by source inspection and observed offline outcomes. |
| Code Quality | 4/5 | Reuses the existing bounded raw graph design, explicit helpers, self-owned symbols and independent invalidation. |
| Test Quality | 4/5 | Full-output/state/read-order differential tests plus relevant negative, writer, tamper, cardinality and cap outcomes; no assertion weakening. |
| Pattern Adherence | 4/5 | Existing Convex scoped queries/indexes, internal handler registration, validators and governed model ledger retained. |
| Completeness | 4/5 | All source helpers are reachable in actual internal V8 handlers and actual content Gateway; typecheck/lint/focused suite pass. |

**Average: 4.0/5.** v2 minima 4/3/4/3/4, average >=3.6, and zero unresolved breaking findings are met.

## Check receipts and preserved history

- `memory-effort-control-independent-tests-receipt.json` / `-tests.log`: initial setup exit 1 with no tests, because no CONVEX_URL or dotenv configuration existed. Watchman recrawl warning is retained.
- `memory-effort-control-independent-retry-tests-receipt.json` / `-retry-tests.log` / `-retry-jest.json`: corrected only test environment to explicit mode with dummy `http://127.0.0.1:1`, minimal nonsecret inherited environment; 238/238 pass, natural exit. Watchman setting unchanged.
- `memory-effort-control-independent-static-receipt.json`, `-typecheck.log`, `-lint.log`: full typecheck and all 11-file lint exit 0.
- `memory-effort-control-independent-owner-probes.mjs`, `-owner-probes-receipt.json`, `-owner-probes.log`: independently authored source-level ownership probes pass.
- `memory-effort-control-independent-hashes-before.json`, `-hashes-after.json`: identical actual hashes for all 11 inputs and exact manifest SHA.
- `memory-effort-control-independent-diff-check.log`: exit 0. Read-only Git commands were used for base/status/delta checks; no Git mutations occurred.
- Author historical 806-pass/9-fail old-mechanism receipt remains unchanged. Exactly those old-mechanism instances retain their original assertions with narrow test-local new-helper isolation. This review does not relabel that failure.
- Title author report retains then-concurrent test typing failures and its stale status. The frozen combined source has an independently observed full typecheck PASS.

## Limitations and recommendation

Accept this exact frozen source/test batch. The broader author 863-case/21-suite result is supporting reported evidence; this reviewer independently ran the five affected suites once after the setup correction. SDK build/contracts are coordinator-owned and were not duplicated here. No services, credentials, deployments, paid models or browser paths were used. Official provider body evidence uses fixed offline terminal responses and establishes request framing/account behavior, not live model title quality. Installed/native, live title and hosted latency outcomes remain for the existing functional qualification; no further preparation-review ceremony is required.

Actual before/final hashes are recorded in the companion JSON and are identical to the frozen manifest.
