Actual installed Basic CLI on Project-Cortex source `3875d3238705a90cb191abbf824d3fa3517e42e5`: **2/2 correct canonical answers, 0/2 Normal timing passes**. First stdout was **10,333.3 ms** and **6,031.7 ms** against 6,000 ms. Neither completed intent was retried. The unchanged installed interactive process exited naturally 0, closed clients, and each intent used `/new` with default Normal.

Inputs: [memory-effort-singleton-cli-iris-1792055242480.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-singleton-cli-iris-1792055242480.json) and [memory-effort-singleton-service-log-snapshot-cli-post-pair-1792055482220.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-singleton-service-log-snapshot-cli-post-pair-1792055482220.json). The official snapshot contains 566 executions/276 phases, uncapped; exact run → Action execution/request → operation-key/semantic ID joins are retained in the [JSON companion](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-singleton-cli-chain.json). SDK archive `dc3221f0…108fb`, CLI archive `847367ab…5f8b`; installed demo 1.5.0 / SDK 0.39.0.

Timing is `submit.begin` → first nonblank answer stdout-write acknowledgement in the actual installed Basic process. Docker/npm startup is excluded. The first intent includes 386.5 ms client authentication plus a 459.8 ms initial fresh session after submission began; the second already had an authenticated client. Only the installed stdout callback acknowledgement exists. There are no SDK callback begin/end brackets or source patches.

| Actual run | Native before main dispatch | Direct RPC | Context inputs | Recall Action | Save/candidate | Main admission | Unallocated before dispatch |
|---|---:|---:|---:|---:|---:|---:|---:|
| ordinary-iris-seed | 6538.0 | 665.0 | 428.9 | 4293.0 | 506.2 | 314.0 | 331.0 |
| fresh-chat-iris-question | 3626.0 | 179.0 | 385.3 | 2184.0 | 389.9 | 368.0 | 119.8 |

| Actual run | Embedding admit / model / capture / attach | Post-attach tail | prepareReads | readMatches + delivery | Main model → first text | First visibility | First output execution |
|---|---|---:|---:|---:|---:|---:|---:|
| ordinary-iris-seed | 892 / 345 / 293 / 476 | 2251 | 215.8 | 1927.9 | 485 | 604 | 196.1 |
| fresh-chat-iris-question | 332 / 317 / 186 / 196 | 1136 | 241.0 | 883.4 | 465 | 301 | 214.0 |

All times are ms. The recall span includes the embedding and tail rows; child executions are nested within Action spans. They must not be added again. The main model/Gateway first text was only 485/465 ms, whereas pre-dispatch consumed 6.538/3.626 s. The 10.333 s seed had a 4.293 s recall Action, including 2.250 s retrieval after embedding and its terminal commits. The warm question had a 2.184 s recall Action and 1.133 s public retrieval.

| Actual run | Initial session | Submit envelope | Fresh post-submit session | Last observe before stdout | Following fresh session | Session end → stdout acknowledgement |
|---|---:|---:|---:|---:|---:|---:|
| ordinary-iris-seed | 459.8 | 569.3 | 431.9 | 233.7 | 318.0 | 2.8 |
| fresh-chat-iris-question | 179.0 | 434.7 | 177.6 | 324.1 | 195.8 | 1.7 |

Browser/client and native clocks are not synchronized. Client RPCs overlap native work; the final observe plus fresh session cannot be added to the entire native table as a partition. Native first text must pass visibility and durable output before observation; the remaining UI/transport/scheduling portion has no exact native-to-client correlation.

Both native gates were `context.direct.candidates.insufficient`, with 2 candidates for the ordinary compound seed and 4 for the question. Both ran `semantic-v1`. The compound seed “My favorite flower is iris. Acknowledge it in one brief sentence.” is outside the literal property-question grammar; no fruit-only projection fix is claimed to improve this intent. The four question candidates are counted but exact search-return bodies are not captured, so mixed-source content cannot be inferred from counts alone.

Both canonical conversations contain separate successful user/assistant rows and correctly answer “Your favorite flower is iris.” Memory was **pending at first terminal print**, then completed through ordinary async processing; final readonly redisplay created no generation. Facts/vectors readiness later covered cutoffs 14 and 16. The receipt’s independent-native-verification field remains pending Root readback; this report does not substitute for that separate check.

The seed reached a deadline stop after 2250 ms yet retained 4 selected entries (2 facts, 2 memories). This demonstrates the existing validated-prefix retention can work when traversal has selected evidence. It does not repair Fast cross-chat’s earlier 0-entry result. The question selected 7 entries with entry/input stops; it stayed below 32,768 units at 31,686.

The seed has an actual **pre-output `markVisible` OCC conflict** on `runtimeBudgetAccounts`, with write source `runtimeModelPolicy.js:admit` and retryCount 0 on the conflicted attempt. Its first visibility Action span is 604 ms. This conflict is part of its first-output path, but the entire 604 ms cannot be attributed to OCC alone. The seed’s terminal-capture conflict is later.

The second run has official OCC rows during later terminal attachment/finalization, all starting after the first durable output commit. They cannot explain native first text/first output. The files do not synchronize the stdout acknowledgement to those server events, so no stronger after-stdout claim is made.

No services/models were called and no source changed for this analysis. Raw receipts are unchanged. No current financial totals, final cleanup, model-internal routing breakdown or controlled historical savings is claimed. The structural repeated-hydration/source-processing finding is documented in [the six-browser-chain report](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-singleton-full-chain.md).
