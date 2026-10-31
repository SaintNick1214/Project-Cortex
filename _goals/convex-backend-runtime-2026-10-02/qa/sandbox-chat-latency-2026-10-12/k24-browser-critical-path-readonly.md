# K24 browser and CLI critical path (saved evidence only)

Repository: SaintNick1214/Project-Cortex. Installed source `be39655e09fdee69907a6ba81b096e5a44067945`, image `sha256:a762d002ee35db9d3b385a565b156d486326182da2de505a5a5ceac51161af8e`, disposable target `zany-cardinal-533` / 6171787. This packet extends the browser diagnosis with the saved incremental CLI snapshot. No native reads, inference, mutations, product edits, tests, builds or retries were performed.

Four ordinary responses completed under the unchanged 30,000-ms deadline, with zero paid retries. Browser visible paint: **3,665.200 / 3,263.700 ms**; CLI first stdout: **7,148.284 / 9,541.892 ms**. **0/4 meet 1,000 ms. Warm browser memory was observed FAILED.** Response completion does not repair that failure; its independent leaf/outcome verifier is separate.

## Disjoint native clock chain

Intervals use the exact run's admission parent and owning executeDirectV8 Action. Main and query-embedding phases are joined by that Action execution ID and operationKey; native children by its request ID. Capture/admission epoch is the fixed transaction trace epoch, not an extra mutable clock. The direct-entry prefix includes the admission transaction and scheduler interval; their nested durations are not added again.

| Interval | Browser first ms | Browser warm ms | CLI first ms | CLI warm ms |
| --- | ---: | ---: | ---: | ---: |
| Capture/admission epoch → direct entry | 691 | 478 | 673 | 670 |
| Direct preparation caller | 526 | 513 | 228 | 332 |
| Direct return → prepared (empty branch) | 0 | 1 | — | — |
| Direct return → recall (contextInputs) | — | — | 339 | 818 |
| Private populated recall | — | — | 2172 | 3729 |
| Recall return → saved/prepared candidate | — | — | 458 | 578 |
| Prepared candidate → main admit begin | 247 | 244 | 287 | 276 |
| Main admit begin → dispatch | 282 | 280 | 362 | 396 |
| Capture/admission epoch → main dispatch | 1746 | 1516 | 4519 | 6799 |
| Main dispatch → processed first text | 942 | 553 | 637 | 708 |
| Processed first text → first visibility acknowledgment | 189 | 256 | 286 | 241 |
| Processed first text → first durable output completion | 338.903 | 421.088 | 501.164 | 489.185 |

First durable output overlaps visibility and is not added to it. Both browser runs execute the local-empty context branch: selected messages **1 / 3**, memories/facts/pending **0**, context bytes **0**, conservative input tokens **13,334 / 14,590** against **32,768**. Both actually run indexed availability predicates inside prepareDirectTurnV8. The branch is selected by current authorized availability excluding the selected transcript and pending source keys (`runtimeAgent.ts:1727,1776,1941,2054`), not by missing module exports or an inferred relevance score. No private recall/query-embedding/read-matches/final-delivery outer completion belongs to either browser Action. Public runtimeMemory:recall and Workflow children are also zero for these four owning Action request IDs. Exact stored source keys are not projected, so this packet cannot independently adjudicate stale availability or the warm memory leaf.

The CLI runs select **1/3 messages, 3/3 memories, 1/1 fact, 1/1 pending**, **2,639/2,640 context bytes**, and **30,600/31,826** conservative input tokens against **32,768**. Their actual populated recall phases take **2,172 / 3,729 ms**. Query embedding dispatch→ready takes **456 / 1,427 ms**; recall entry→embedding dispatch takes **585 / 754 ms**, and embedding ready→protected recall return takes **1,131 / 1,548 ms**. The latter includes separate terminal capture/attach (**415 / 530 ms**), read preparation, ANN, match hydration and final consumed-source delivery. The warm combined embedding acquisition itself exceeds the entire 1,000-ms goal; its Gateway/provider/network split is opaque.

## Actual native execution work

Engine/own-user/docs below are native metrics, separate from caller intervals. They include nested native/component work as documented by the receipt; they are not additive critical-path totals. Each cell is engine ms / own-user ms / database-read documents. Retry attempts are shown separately.

| Owning native child | Browser first | Browser warm | CLI first | CLI warm |
| --- | --- | --- | --- | --- |
| Direct prepare | 510.724 / 316.687 / 276 | 504.048 / 322.383 / 422 | 218.437 / 145.807 / 55 | 323.38 / 194.862 / 239 |
| Context inputs | — | — | 335.516 / 210.493 / 124 | 807.367 / 275.434 / 492 |
| Query embedding prepare | — | — | 223.516 / 127.216 / 81 | 324.538 / 185.834 / 310 |
| Query embedding admission | — | — | 328.647 / 113.227 / 112 | 408.709 / 143.516 / 298 |
| Recall read preparation | — | — | 191.332 / 98.82 / 75 | 314.848 / 138.515 / 196 |
| Recall matches | — | — | 263.111 / 129.698 / 251 | 375.312 / 182.467 / 547 |
| Recall final delivery | — | — | 245.449 / 107.591 / 88 | 310.672 / 133.037 / 208 |
| Save/candidate parent | — | — | 447.63 / 90.596 / 331 | 555.78 / 127.212 / 785 |
| Main admission | 259.316 / 152.459 / 107 | 260.116 / 152.764 / 141 | 341.234 / 165.161 / 227 | 381.259 / 219.816 / 501 |

The new V8 terminal ports really execute: browser capture **170.548/186.537 ms, 46/53 docs**, attach **179.625/184.626 ms, 38/45 docs**. CLI embedding capture **175.944/262.469 ms, 46/93 docs**, attach **208.478/240.818 ms, 38/85 docs**. Main CLI capture has **66 / 113 docs**, attachment **58 / 105 docs**. Native CLI snapshot reports five capture and five attach V8 completions: four distinct main/embedding operations plus one capture OCC attempt and one attach OCC attempt; these are not five paid intents. Original unscoped terminal completions in the snapshots include startup and asynchronous memory work and are not assigned to foreground operations merely by count.

Both browser Action requests have **no recorded OCC** in their direct prep, main admission or terminal calls. First CLI main attachment retries against `runtimeBudgetAccounts`, writer `runtimeModelPolicy.js:admit`; warm CLI main capture retries against `runtimeAgentExecutions`, writer `runtimeAgent.js:recordOutput`. These occur **after first durable output**, so they do not explain its first-text pre-dispatch wait. CLI observer calls also retry against execution rows written by prepareDirectTurnV8 and finishOperation; the background warm checkpoint retries against runtimeRuns/saveAndPrepareContextV8. Browser post-first-text observer calls retry against execution/finishOperation and progress/finalize. Other background graph watermark/admission/claim conflicts are retained in the snapshots, not charged to the owning foreground critical path without a parent/request join. Exact conflicting row hashes are in the JSON/native receipts; private identifiers/content are absent.

## Client authentication and protected delivery

Browser auth is already connected before both submissions; there is no auth.begin/ready inside either measured submit window. Native submitAndStartEnvelope engine is **568.680 / 385.257 ms**, own-user **177.741 / 119.326 ms**, **184 / 188 docs**, no OCC. Prospective mutation spans submit/start/get are **255.1/176.2/5.4 ms** first and **141.9/147.8/5.3 ms** warm; claimNext (**151.1/124.2 ms**) is nested inside start. The native parent and child spans overlap, not extra costs.

On the separate browser monotonic clock, submitAndStartEnvelope RPC is **683.5 / 658.8 ms**, fresh post-session **223.9 / 193.8 ms**, admission delivered **916.3 / 858.0 ms**. Three protected observeEnvelope/post-session cycles finish before each first DOM commit. The final cycle is **244.1+170.7 ms** first and **232.4+178.4 ms** warm. Their durations contain server/network/client work and overlap the native chain; no browser→server clock subtraction is used. DOM→paint adds **21.1 / 29.5 ms** on the browser's own elapsed clock.

CLI creates an authenticated client for each command: auth readiness **467.494 / 368.939 ms**, initial session **303.038 / 227.306 ms**. SubmitEnvelope RPC **627.126 / 667.355 ms** and fresh post-session **230.707 / 224.681 ms** bring command submit→post-admission to **1,653.155 / 1,493.086 ms**. Four protected observe/post-session cycles precede stdout. The final cycle is **266.541+174.776 ms** first and **257.689+406.153 ms** warm; the stdout acknowledgment follows the latter session by **0.468 / 0.874 ms**. These are separate client-clock observations, not sums added to the server clock. No guard/deadline should be removed to manufacture a fast response.

## Remaining measured region and one prospective repair seam

The dominant region remains **before main dispatch**: **1.746/1.516 seconds** for the no-recall browser path, **4.519/6.799 seconds** for populated CLI. Main processed-text acquisition is **942/553/637/708 ms**, still a combined official Gateway/provider/network interval. Terminal retention is actually selected but cannot solve admission/preparation/recall by itself. First visible/printed output also waits for the required native markVisible→recordOutput and protected observe→post-session fences.

The next minimal source candidate grounded by these receipts is **private V8 recall read-parent composition**, not a positive authorization cache: preserve the original current context-input predicates before conditionally invoking original query-embedding preparation in one fresh read snapshot; after ANN, preserve ordered original readMatches then original finalDelivery consumed-resource predicates in one fresh internal mutation snapshot. Current first/warm context-input and embedding-prepare outer waits are **335.516+223.516 / 807.367+324.538 ms**; readMatches and finalDelivery waits are **263.111+245.449 / 375.312+310.672 ms**. These pairs are sequential in source (`runtimeAgent.ts:1837`, `runtimeAgentQueryEmbedding.ts:145`, `runtimeAgentRecall.ts:159,165,168`); their exact effect on native time or document count after composition is unmeasured. Keep original pending-overflow durable fail-before-profile precedence, every mutable run/source/qualification/accounting predicate, vector-first/fact-error order, final unscoped authority fence and real Action-clock expiry after return. Save/candidate child rollback and independent charge-only capture/attachment remain separate. Generic public recall and V1–V7 remain unchanged. This candidate reduces two outer handoffs in the populated branch; it is not an accepted implementation or a promised multi-second saving. The empty branch and the warm 1.427-second embedding interval require separate evidence; this composition alone cannot establish the subsecond goal.

K23 browser was 3.927/8.495 seconds and CLI 9.305/9.716 seconds under different observed selected sources, conflicts and acquisition conditions. K24's terminal V8 call names and scoped document counts establish reachability; they do not establish a controlled causal ratio. The browser warm memory FAILED is retained even though both replies and all four timing samples completed.

Original snapshots: browser **526 executions /192 phases /657,478 bytes**; incremental CLI **353 /216 /500,437**, each below the original 1,000-execution/16-MiB caps, retaining exact cursor progression. Browser has one unidentified execution row; none are filled in. Arguments/raw content, cache-hit statistics, ANN provider clocks, exact source identities and internal Gateway TTFB are unavailable. Two outer snapshots do not guarantee every nested component completion is separately logged. Initial wrong browser diagnostic filter (`cortex.latency`, 0 matches) remains preserved; corrected saved `cortex-` logs involve no additional inference. A local analysis path typo failed before reading any receipt, then used the actual Q path; no native collector was retried.

Diagnosis milestone **100%**. Overall latency follow-up **50%**, unchanged; actual cloud SLO **0/4**. Independent memory acceptance, cleanup and any later source repair are parent-owned.
