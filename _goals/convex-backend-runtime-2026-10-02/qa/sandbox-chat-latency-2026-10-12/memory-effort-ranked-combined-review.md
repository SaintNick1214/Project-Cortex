# Task Judgment: final literal ranking and cancelled-input watermark repair

## Verdict: PASS — source/test batch only

One independent non-author review of the frozen 16-file batch in **SaintNick1214/Project-Cortex**, branch `feat/convex-backend-runtime-completion`, HEAD/base `e9a9fb7bdbc1db1901ad3bb7f42db4b534c08cad`. Acceptance policy v2 governs the scores. There are **zero unresolved breaking findings** in this reviewed batch. Hosted correctness, numerical SLO and final goal acceptance remain parent-owned pending work.

## Evidence Review

Read repository AGENTS, runtime/profile, pessimistic-judge role, judge-task rubric, acceptance policy and modified execution goal v4; both final author reports/receipts/patches; prior LP-1/LP-2 independent REJECTs and raw reproducers/red results. Inspected the actual 16 owned source/test files and surrounding transcript, approval, currentness, delivery, policy and watermark paths. All 16 current file hashes match their frozen receipts, including a final post-test verification. The ranking patch exactly equals the current tracked diff plus new test: 62,133 bytes, SHA-256 `8c00854ac3958e18bc9d1cbdd9d9006dc60b334486e7d265441fdfa3c70e5e53`. Both supplied patches pass reverse-apply check against current files. Cancellation diff hash matches its receipt.

Original LP-1/LP-2 REJECTs and red receipts remain intact. The v1 review hashes match the values preserved by v2; all four old review hashes are recorded in the JSON. The actual e9 repeated-question selection/wrong response and cancelled-event watermark failure remain historical failures. Nothing here establishes recovery of the cleaned old target.

## Requirements Review

| Requirement | Assessment and evidence |
|---|---|
| Every fitting explicit current same-property value outranks repeated-question evidence, including linked conflicts | Met within discovered/bounded candidates. `memory-direct-recall.ts:31` gives equal binary priority without declaring semantic sufficiency. `runtimeMemoryTraversal.ts:45` binds current authorized source/fact before applying priority; `memory-traversal.ts:56` considers every omitted discovered priority node. LP-1 and LP-2 probes now retain apricot and plum. Public/Agent indexed-edge tests verify the conflict is absent from the initial bounded fact page, present at depth2, and retained. |
| Preserve complete entries and count/input/work/depth/deadline/cancellation controls | Met. `memory-traversal.ts:17,35,56` keeps BFS discovery/read sequence and original counters; the local pass performs no expansion or additional read, recomputes complete-entry units, and checks the original cancellation/deadline. Exact LP-2 retains both facts at490/500 units from five visited nodes. Work/cancellation/deadline and too-small entry/input cases pass. |
| Preserve shortest paths, cycles, currentness and authorization | Met. First-seen BFS queue is unchanged; pure shortest-path/cycle tests and actual scoped traversal/final-delivery negatives pass. Selected paths retain intermediate bindings for fresh delivery. No unrelated same-conversation link is introduced. |
| Carry private priority into actual Agent final input without dropping mandatory groups | Met. `runtimeAgent.ts:1908,2064,2143`, schema and model-input comparator preserve private flags through registered save, stored entries and native candidate preparation/admission. Tests verify both values in the prepared native request and current admission; pending/current/whole tool groups/notices remain mandatory, and real numeric overflow still sheds optional complete entries or fails. |
| Exact omitted-pin compatibility and no public policy/model/budget change | Met for reviewed behavior. Independent deep equality against e9 output+trace passed96 bounded omitted-pin cases. Paired actual Agent snapshots retain old selection/admission when the pin is absent. Public strict definition/request schemas expose no priority flag; internal save/storage remain internal. Capability2/1, policyVersion1 and preset caps remain unchanged. No model, extra inference or paid retry is added. |
| Cancelled attempt0 waiting-approval input becomes safely skippable without fabricated processing | Met. `runs.ts:146` retains current auth/ownership/conversation checks, then terminally retires work. `runtimeIngestion.ts:185` requires exact cancelled/unapproved run, native bridge, source/revision/hash/authority/owner, three pristine stages and no job. It changes existing eligibility to `ineligible` and publishes readiness; canonical unapproved message, stage states/attempts/receipts remain intact. |
| Later strict facts/vector cutoff progresses; tracked edits after cancel stay ineligible | Met. Registered-handler tests at `cancelled-input-readiness.test.ts:42,88` verify same/different-conversation strict readiness, retained canonical revision history and no source/vector/model effect for cancelled revisions. Enqueue at `runtimeIngestion.ts:168` applies the same exact retirement atomically to a new unapproved revision. |
| Approved/running/job work, auth/revocation/deletion and late callbacks remain fenced | Met. Tests at `cancelled-input-readiness.test.ts:77,114,129,144,158,170` verify duplicate cancel/late worker zero effects, approved edit lifecycle, unauthorized and revoked refusal, approved/running ingestion job/account preservation, contradiction rollback and tombstone non-resurrection. Legacy message approval rejects run-owned bridges. |
| No historical backfill or live/SLO claims | Met. The repair is prospective. Old retained holes are not migrated, the old failed session is not relabeled, and controlled ports are explicitly distinguished from hosted outcomes. |

## Independent Checks

- **286/286 tests, 11 suites, zero failures or pending/skips; natural exit0.** Exact pinned Node24.15 argv, inert explicit environment, log/hash, Jest assertion results and exit are in `memory-effort-ranked-combined-review-tests.exit.json`, `-tests.log`, and `-tests.jest.json`. `--forceExit=false --watchman=false --cache=false`; Jest24.974s, process25.481s. This is a fresh combined run at the final16 hashes, not an invented composition of author runs.
- **LP-1 original actual-module probe: exit0.** Selected apricot,plum,q0,q1 with six visited nodes. **LP-2 outcome replay: exit0.** Selected apricot+plum at490/500 with five visited nodes and exactly the original three expansions. The old incidental exactly4 output-count assertion is replaced only by <=unchanged cap4 because correct fitting leaves no space for another complete question; the two-fact assertion is unchanged. Full scripts/results are retained in `memory-effort-ranked-combined-review-probes.json`.
- **Omitted-pin exact comparison:96/96 cases.** Actual current and git-e9 modules transpiled/imported in memory; entire nodes+trace deep-equal across entry/input/work limits, Fast/Normal/Max, an edge conflict and a cycle. Receipt: `memory-effort-ranked-combined-review-legacy.json`.
- Author raw receipts:224/224 affected tests plus108/108 after narrow callback typing repair; cancellation62/62. Reviewed the actual root `tsc --noEmit` exit0, strict13-file and3-file lint exit0/zero warnings, whitespace and raw failure history. Earlier lint-project TypeScript receipts are not treated as full root typing.
- Parent final combined root build and packed/browser contracts naturally exit0; raw logs and hashes match `memory-effort-ranked-root-build1.json` and `-contracts1.json`. These support packaging reachability; they are not live service acceptance. Reviewer ran no build.

## Test Coverage Analysis

| Changed behavior | Meaningful outcome coverage |
|---|---|
| Literal helper and direct sufficiency distinction | Exact/conflicting/corrected positives; ambiguous, negative, value mismatch and noncurrent negatives. |
| Traversal post-selection | LP-1, exact LP-2, work/deadline/cancel, insufficient bounds, shortest path/cycle; actual backend depth/currentness and public indexed-edge composition. |
| Agent save/final fitting | Paired pin branches, complete-entry and shared optional cap/overflow, mandatory pending/tools/notices, exact prepared body and current admission. |
| Cancel disposition and tracked revisions | Strict facts/vectors through later cutoff, unchanged canonical/stages, no derived effects, exact contradiction rollback, approved job/account non-interference, auth/revocation/deletion/late callback negatives. |

These are controlled registered-handler/DB/native/model-port checks. They do not prove hosted inference, native installation, browser behavior, graph service coverage or numerical latency.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment | 4/5 | All scoped mandatory source behavior is reachable with explicit outcome evidence. |
| Code quality | 4/5 | Bounded local selection and exact transactional retirement; existing resource/authority/accounting fences retained. |
| Test quality | 4/5 | Independent final combined286 pass, repaired prior repros, meaningful negative/boundary assertions and exact legacy comparison. |
| Pattern adherence | 4/5 | Shared domain policy/comparator, internal schema plumbing, indexed scoped reads and existing eligibility/readiness semantics. |
| Completeness | 4/5 | Source, schema, stored flags, final model input and cancellation/edit wiring are complete for this batch; root typing/lint/build/contracts support reachability. |

**Average:4.0/5.** All policy v2 minima met; no average waives a breaking finding.

## Issues Found

No actionable breaking source/test findings in the reviewed16-file batch. No assertions were weakened to hide LP-1/LP-2; new regressions cover the observed boundary failures.

## Recommendation and Limits

Accept this frozen source/test batch and proceed with the already-authorized fresh installed-candidate/native/UI/SLO qualification. Keep original live failures and the earlier rejected source reports. This PASS does not complete those gates or the goal. No historical migration/backfill is implemented or claimed.

Review activity: zero product edits, service/model calls, builds, deployments, commits, other-chat messages or subagents. Writes are only the new combined review and bounded independent repro/receipt artifacts under its prefix. Unrelated dirty work remains untouched. Exact16 hashes and evidence metadata are in the companion JSON.
