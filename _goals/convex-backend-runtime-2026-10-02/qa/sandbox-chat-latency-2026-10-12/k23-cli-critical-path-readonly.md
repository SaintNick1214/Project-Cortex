# K23 populated recall and four-run critical path

Repository: SaintNick1214/Project-Cortex. Actual installed source `efcc91d2317dadcb143c5cf1929504bd0cbee3a6`. The preserved browser packet is `k23-browser-critical-path-readonly.md/json`. The CLI extension uses only the saved incremental CLI snapshot (369 executions / 232 phases), its original browser cursor, and saved timing receipts. No native reads, inference, mutations, source changes, tests or retries were performed.

All four replies completed, under the original 30,000-ms deadline. Visible browser first/warm: **3,927.2 / 8,495.3 ms**. CLI first/warm stdout: **9,304.917 / 9,716.291 ms**. **0/4 meet 1,000 ms.** Memory was pending at the captured CLI UI read; this diagnosis does not replace the independent strict native memory proof.

Both CLI runs actually execute the complete new populated path: 2 prepareV8, 3 admitV8 native executions (one OCC retry), 2 prepareReadsV8, 2 readMatchesV8, 2 finalDeliveryV8, 2 saveAndPrepareContextV8 and 2 main admitPreparedModelOperationV8. Individual contextSource and contextSourceBatch outer calls are zero on this composed readMatches path. Two executeDirectV8 Actions are observed, with no Workflow child creation/execution attached to those exact Action request IDs. Zero browser recall counts are a different, successfully proven local-empty branch; they do not imply broken exports.

## Populated CLI delay split

| Disjoint same owning Action/server epoch interval | First ms | Warm ms |
| --- | ---: | ---: |
| Fixed admission epoch → direct prepare entry | 687 | 674 |
| Direct preparation caller interval | 437 | 338 |
| Direct return → recall entry (contextInputs included) | 417 | 469 |
| Recall entry → embedding dispatch | 1479 | 952 |
| Combined embedding acquisition | 386 | 379 |
| Embedding ready → protected recall return | 1399 | 2422 |
| Recall return → saved/prepared candidate | 495 | 634 |
| Candidate → main admission begin | 294 | 314 |
| Main admission begin → main dispatch | 365 | 579 |
| Admission epoch → main dispatch (sum above) | 5959 | 6761 |
| Main dispatch → processed first text | 545 | 565 |
| First text → first visibility acknowledgment | 806 | 612 |
| First text → first recordOutput completion | 1082.915 | 839.343 |

Private recall itself is **3,264 / 3,753 ms**. Embedding model acquisition is only 386 / 379 ms of that. The protected delivery row overlaps visibility and is not added to it. Enclosing native engine durations include children; native engine metrics and source/server phase intervals are deliberately kept separate.

First selected input: 1 message, 4 memories, 1 fact, 0 pending, 2,525 context bytes, conservative input bound 29,892 / 32,768. Warm: 3 messages, 2 memories, 3 facts, 0 pending, 2,610 context bytes, 31,574 / 32,768. All fit fields are actual trace scalars. They do not reveal canonical content or authorize reuse of prior source checks.

## Native control work still measured on the actual V8 branch

| Native function | First engine ms / docs | Warm engine ms / docs |
| --- | --- | --- |
| prepareDirectTurnV8 | 430.642 / 55 | 330.988 / 271 |
| contextInputsV8 | 406.595 / 117 | 465.598 / 547 |
| query embedding prepareV8 | 564.782 / 82 | 399.101 / 351 |
| query embedding admitV8 | 396.343 conflicted + 381.957 success / 112 each | 526.567 success / 330 |
| Embedding captureTerminalEvidence | 225.311 / 118 | 402.695 / 463 |
| Embedding attachTerminalResult | 222.766 / 110 | 437.893 / 455 |
| prepareReadsV8 | 276.288 / 157 | 313.705 / 294 |
| readMatchesV8 | 334.671 / 439 | 655.685 / 769 |
| finalDeliveryV8 | 291.025 / 120 | 534.157 / 254 |
| saveAndPrepareContextV8 | 479.983 / 371 | 622.880 / 905 |
| Fresh main hydrateExecution | 200.562 / 47 | 221.670 / 102 |
| Main admitPreparedModelOperationV8 | 344.166 / 251 | 558.535 / 573 |
| Main captureTerminalEvidence | 358.902 conflicted + 274.023 success / 286 each | 680.808 conflicted + 345.357 success / 631 each |
| Main attachTerminalResult | 332.838 / 278 | 436.197 / 623 |

Rows use exact Action request IDs plus native execution IDs, not a nearest unrelated child. First query embedding admit conflicts on the same hashed `runtimeBudgetAccounts` row as both browser main-admit conflicts, writer `runtimeModelPolicy.js:admit`. Both CLI first visibility calls also retry against this row. These are native OCC retries, not evidence of paid retries. Both main capture calls retry against their exact `runtimeAgentExecutions` row, writer `runtimeAgent.js:recordOutput`. This conflict occurs after processed first text and preserves charge/attachment independence.

The first two native snapshots remain below the original 1000-execution cap and preserve their cursor boundary. Projected rows omit original function arguments/raw payloads. Exact authority/source identities and raw-scope hit counts are therefore unavailable. A changed read count alone cannot establish an improvement ratio or normalization failure.

## Whole-path priorities and precise remaining boundaries

The next measured private-V8 control region is **embedding captureTerminalEvidence + attachTerminalResult**, caller spans **477 / 858 ms**, still using original unscoped native ports. The same terminal guard family later costs 286/278 and 631/623 docs for main output. Original `runtimeModelPolicy.ts:1135,1179` bodies can be exposed through fresh private V8 scope wrappers and compiled V8 producer selection. Every mutable attempt/account/run/source/lease and authorization predicate must re-execute; only already proven same-invocation raw metadata/exact-message readers may be used. Capture and attachment must remain **two independently committed mutations**, with charge liability surviving revoked/denied private attachment and no new pre-account access gate. This scope has measured pre-main relevance through embedding terminal work; no saving is promised.

The other sizeable native regions are the existing **contextInputsV8 → query embedding prepareV8** queries and **readMatchesV8 → finalDeliveryV8** handoff. A single read parent can run both original bodies in one fresh snapshot, preserving initial pending/probe failure priority and returning only tentative proposals. An ordered read-matches/final-delivery parent must preserve every source/witness/profile/hash check and the original final raw authority/expiry fence. The real Action-clock expiry check after the response remains mandatory. Saving/candidate startup cannot be moved before that check without changing failure/commit semantics. The existing save/candidate rollback isolation and main fresh prompt hydration remain separate; generic public recall and V1–V7 are outside this private scope.

For the empty browser pair, the largest delay is warm main admission/checkpoint **2,355 ms**, with 1,166 / 1,146-ms native attempts at 141 docs. The shared account's atomic liability/concurrency invariants explain a concrete OCC surface but do not justify caching accounts or changing financial contracts. Any safe candidate→dispatch preparation reuse is limited to one fresh invocation; the Action must still hydrate the actual official Agent prompt freshly before exact-bound admission.

Browser protected return contributes additional observed waiting. On the same browser monotonic clock, the last observation/post-session cycle immediately before first DOM content is 212.5 + 172.0 ms first, and **1,693.7 + 267.5 ms warm** (RPCs 23/24 and 43/44). These waits include native/network/SDK time and overlap the native critical path; they are not an extra additive server cost. The final independent post-session authority guard remains required. Native payload projection does not identify which individual run/source checks dominated those observation calls, so that attribution remains unavailable.

K22 had recall 2,336/3,346/3,886/4,566 ms and different selected context/source conditions. K23 browser empty and CLI populated conditions are explicit. No causal source-speed ratio, inferred provider-only latency or native acceptance follows from comparing generations. Known observed control/OCC costs already consume multiple seconds before main inference; mandatory guards and billable accounting cannot be bypassed to manufacture a 1-second result.

Diagnosis milestone: **100% complete**. Overall latency follow-up: **50%**, unchanged. Product edits and native qualification remain root-owned and require a separate authorized batch.
