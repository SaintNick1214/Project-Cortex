# Independent source/test review: direct admission composition

**PASS — 4.0/5 under acceptance-policy v2.** No unresolved breaking finding in this bounded batch. This accepts the admission source/test change only; immutable artifact/installed hosted qualification and actual browser/Basic latency remain pending. No speedup or subsecond claim is accepted here.

Read repository/runtime/profile and pessimistic-judge/judge-task instructions. Applied v2 minima: requirements, tests and completeness at least 4; code and patterns at least 3. Reviewer authored none of the four candidate files. Only this report and its bounded verification receipt were written; no source/P/JSON changes, services, deployment, inference or GitHub access. No tests were rerun.

## Requirements and evidence

| Requirement | Finding |
| --- | --- |
| Exact original get/start bodies and standalone validation | The scoped diff against HEAD `75432bc0787d50bdf21c69d3c88d4a9cf395489e` only extracts the original bodies into `runs.getHandler` (line 115) and `runtimeAgent.startHandler` (line 154). Original registered argument validators still wrap those helpers; no return validator existed to lose. The 17-check AST receipt corroborates unchanged bodies/validators, submit/startExecution/modelStep and session/signal. |
| Sequential original arguments and immutable return | `runtimeClient.ts:17–34` awaits submit, start and get with the identical argument expressions and `streaming ?? true`. The exact final run/attempt/conversation/agent/version/definition/scope tuple and return remain unchanged. There is no catch, retry, cached authority or alternate dispatch path. |
| Original authority, source/model and effect fences | Helpers retain separate run/write/read checks and current run/definition/conversation checks. Nested claim, component operations and async Workflow insertion are unchanged. Original action attempt/lease and model/context/ledger guards remain outside the diff. No new registration, dependency, schema or client protocol is added. |
| Queue, approval, streaming, replay and legacy compatibility | Admission tests lines 52–132 and 220–223 assert one canonical save/account/attempt/Workflow; zero removed wrapper calls but the exact retained nested claim; selector/streaming rows; exact replay/no new effects; changed payload/streaming denial; explicit approval; queued/running/waiting heads; wrong-head rollback; supported bounded-prefix failed retirement and legacy submit/start interoperability. |
| Meaningful late faults and parent rollback | Tests lines 134–218 inject into actual DB, scheduler or native-component ports, leaving actual shared bodies in use. Every late hook asserts it was reached. Revocation, missing read, expiry, tombstones/epoch, definition/transcript edits, identity mismatch, save/claim/scheduler failure reject and compare the complete prior rows, native state, counters and scheduled work. The existing fixture performs parent rollback; its mock root freezes `Date.now()`, so expiry at equality is actually tested. |
| Affected quality and coherent evidence | Reviewed the author check manifest, full raw Jest JSON/log, empty type/lint diagnostic logs and exact diff. Independently recomputed all four source hashes and six raw receipt hashes: every match. Raw Jest records 172/172 tests, 5/5 suites, zero failed/pending/todo, including 32 admission cases. Recorded backend/lint typecheck, scoped ESLint and diff-check exits are zero. |

## Scores

| Dimension | Score | Reason |
| --- | --- | --- |
| Requirement fulfillment | 4/5 | Approved narrow optimization is fully represented without guard/model changes. |
| Test quality | 4/5 | Actual shared handlers, reached fault ports, effect/rollback assertions and relevant compatibility/negative outcomes. |
| Completeness | 4/5 | Original endpoints remain wired and typed; affected checks pass. Installed artifact/service qualification is explicitly separate. |
| Code quality | 4/5 | Small typed helper extraction and sequential awaited composition; failures propagate to the parent. |
| Pattern adherence | 4/5 | Reuses the existing submit-helper convention and original backend mutation guards. |

Average: **4.0/5**. Critical/important/minor findings: none requiring a candidate change.

## Frozen candidate and limits

| File | SHA-256 |
| --- | --- |
| convex-dev/runs.ts | 6cb60d04a373f1123e41951c257c57089fce9a00b167fead16fd0424a4f8ec3e |
| convex-dev/runtimeAgent.ts | e86ec3e1aecc293aa49fcb7fe7f6b37defee4593af986b45d043e0a54d3cce61 |
| convex-dev/runtimeClient.ts | 8d9b97f2d270cbc8efdbd47ff04c0fec0e9c7b819d949d0c542ca5e96c07fd45 |
| tests/unit/client-runtime/admission-native.test.ts | b4607fb622bed54a156782cb9b5ddd88a99a205ee349ac1ef0b3ba66bd80e4eb |

Bindings/counts: `cloud-admission-direct-source-review-verification-v1.json`. Author evidence: `cloud-admission-direct-checks-v1.json`, `cloud-admission-direct-equivalence-v1.json`, `cloud-admission-direct-jest-v1.json/log`, type/lint logs and `cloud-admission-direct-report.md`.

The controlled fixture mocks component storage and Workflow scheduling. It demonstrates production handler predicates and simulated parent rollback, not native OCC, live Workflow execution, a shipped distribution count or hosted performance. The reviewed log's graph-disabled notice is outside this admission selection; no graph/service PASS is claimed. Proceed to the root-owned immutable build, installed hosted positive/negative/freshness outcomes and actual canonical-client measurements, preserving all prior latency/memory failures.
