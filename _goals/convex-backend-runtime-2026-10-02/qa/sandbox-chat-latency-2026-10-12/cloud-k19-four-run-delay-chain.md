# K19: four original cloud reply delay chains

Repository: SaintNick1214/Project-Cortex. Installed source `126231a0102936998837dd14a64a77d2b4d09785`; disposable target `expert-bird-765` / `6158316`, session `03af6882-d97e-4c45-a965-fbbe951597b7`. This packet analyzes only the four original samples and their two original saved log snapshots. Later supplemental observations remain separate.

All four replies completed under the unchanged 30,000 ms CLI deadline, with no paid retry. **0/4 passed the 1,000 ms latency target.** Four authorized read-only chain collectors ran once each and closed their clients. Collection and this saved diagnosis are **100%** complete; the latency follow-up goal remains **50%**.

| Observed milestone (ms) | Browser first | Browser warm | CLI first | CLI warm |
|---|---:|---:|---:|---:|
| Client visible text / first stdout | 4,882.4 | 5,896.8 | 8,576.6 | 9,468.4 |
| Native run creation → answer dispatch | 2,997.0 | 3,580.0 | 6,074.0 | 6,974.0 |
| Dispatch → processed first answer text | 683.0 | 556.0 | 448.0 | 480.0 |
| First visibility guard bracket | 214.0 | 206.0 | 320.0 | 312.0 |
| First durable text row timestamp offset | 3,901.0 | 4,348.0 | 6,848.0 | 7,773.0 |
| First recordOutput native completion offset | 4,063.5 | 4,710.6 | 7,100.1 | 8,010.0 |
| Canonical final text row timestamp offset | 5,436.0 | 6,787.0 | 8,955.0 | 10,459.0 |

The critical delay is already several seconds before the answer model is dispatched. Browser preparation includes actual OCC retries; indexed CLI recall includes preflight, reservation/checkpoint, embedding settlement, guarded retrieval and delivery. The combined Gateway/provider interval is a smaller observed part of these runs. The first durable row timestamp is fixed transaction time, not a commit or paint measurement; the separate native completion offset is retained to avoid that conflation. Native timestamps cannot be subtracted from client monotonic timestamps to calculate a network or rendering remainder.

These same-server-clock partitions are disjoint and sum exactly to answer dispatch. Original recorded Gateway `durationMs` values are also preserved in JSON; a one-millisecond difference from a phase timestamp subtraction is not silently normalized. Engine/child durations in the later tables are diagnostic subdivisions, never added again.

| Disjoint pre-dispatch partition (ms) | Browser first | Browser warm | CLI first | CLI warm |
|---|---:|---:|---:|---:|
| Creation → direct preparation | 864.0 | 802.0 | 838.0 | 602.0 |
| Direct preparation bracket | 1,540.0 | 1,744.0 | 318.0 | 497.0 |
| Preparation → recall | — | — | 432.0 | 590.0 |
| Recall bracket | — | — | 2,987.0 | 3,700.0 |
| Recall → model preparation finished | — | — | 707.0 | 805.0 |
| Empty context preparation handoff | 0.0 | 1.0 | — | — |
| Model preparation finished → dispatch | 593.0 | 1,033.0 | 792.0 | 780.0 |

The four native executions report `executionMode: direct-v6`, a scheduled Action ID, COMPLETE execution/context, no workflow ID and zero ordinary turn journal steps. `directState` remains `started` in the saved record; it is not relabeled complete. No `start.workflow` timing exists for these samples. This establishes their ordinary direct scheduling path, not absence of Workflow/Workpool from asynchronous memory or strict/tool continuations.

The initial admission spans use the prospective mutation `performance.now()` instrumentation. The fixed submit alias joins by its parent execution ID; start/get carry the real run ID. Claim is nested inside start, so it is not added to start.

| Admission measurement (ms) | Browser first | Browser warm | CLI first | CLI warm |
|---|---:|---:|---:|---:|
| Original submit span | 452.5 | 247.6 | 317.6 | 185.2 |
| Original start span | 229.2 | 214.2 | 205.9 | 179.4 |
| Nested claimNext span | 195.0 | 187.8 | 176.2 | 150.1 |
| Original get span | 2.9 | 2.9 | 2.8 | 3.0 |
| Native parent engine duration | 760.9 | 702.5 | 739.0 | 452.3 |
| Native parent user duration | 119.8 | 162.8 | 182.6 | 118.0 |
| Native parent read documents | 179 | 181 | 183 | 181 |

Each parent has no reported OCC conflict. Parent engine duration includes the pre-session predicate, native helper/component activity and system work. Independently logged nested admission component rows are unavailable for these parent request IDs; the missing detail is not assigned to an invented writer or omitted guard.

Browser direct preparation has two completions per run. The first completion in each has `willRetry: true`, `occInfo.retryCount: 0`, table `runtimeIngestionScopes`, the same hashed row identity, and writer `runtimeMemoryContext.js:refreshWatermarks`. The following completion of that same execution succeeds. First/warm attempts read 467/602 documents again; native engine durations are 766.0 + 702.4 ms and 837.7 + 848.6 ms respectively, inside the 1,540/1,744 ms Action brackets. This is an actual watermark conflict, not an inferred Gateway stall. Browser-warm main admission also reruns after a `runtimeBudgetAccounts` conflict with writer `runtimeModelPolicy.js:admit`; its 697 ms bracket includes both completions.

The CLI private embedding path is present: exactly one `runtimeAgentQueryEmbedding:prepare` and one `:admit` per direct Action request ID. The original private admission source invokes its child checkpoint and preserves the reservation/child rollback boundary. Independently logged child checkpoint/profile completions are unavailable under those parent request IDs; overlapping generic background checkpoint rows are excluded.

| Disjoint recall partition (ms) | CLI first | CLI warm |
|---|---:|---:|
| Recall start → embedding dispatch | 717.0 | 946.0 |
| Native embedding call | 354.0 | 292.0 |
| Embedding ready → independently attached result | 476.0 | 696.0 |
| Attached result → recall finished | 1,440.0 | 1,766.0 |
| Total recall | 2,987.0 | 3,700.0 |

Embedding capture/attach remain separate original durable steps: 225/244 ms first and 343/346 ms warm. The retrieval tail preserves parallel fact/vector acquisition, vector-first staged source validation and final delivery. There are two `contextSourceBatch` calls and zero individual `contextSource` calls per CLI Action; guarded fact retrieval still calls `runtimeMemory:readSource` twice/three times. Parallel branches overlap and are not summed to fabricate a recall total.

| CLI native endpoint: engine / user ms; read documents | First | Warm |
|---|---:|---:|
| Private embedding prepare | 357.5 / 114.8; 121 | 482.0 / 158.9; 394 |
| Private embedding admit | 326.4 / 105.1; 112 | 435.6 / 131.8; 330 |
| Vector matches + guarded hydration | 346.6 / 67.6; 88 | 410.5 / 78.8; 183 |
| Final delivery mutation | 431.1 / 111.4; 433 | 565.7 / 170.2; 911 |
| Save context mutation | 255.7 / 98.5; 218 | 288.8 / 138.3; 563 |
| Fresh main model preparation | 421.9 / 186.0; 319 | 491.4 / 268.6; 749 |

The memory final-delivery endpoint remains an internal mutation with a snapshot and no application writes. Its guarded scope/source/profile/deadline checks, followed by separate save-context and current main-model preparation, occupy a substantial measured part of the recall/pre-dispatch chain. These engine durations include original helper activity and cannot be counted again on top of the disjoint recall bracket.

After the first processed answer text, original visibility validation takes 214/206/320/312 ms. The first `recordOutput` native completion occurs at the offsets in the first table. Remaining chunks, main terminal capture, fresh hydration, private attachment, operation finish and canonical finalization continue after first output. Browser-warm and both CLI main captures have actual `runtimeAgentExecutions` OCC conflicts attributed to `runtimeAgent.js:recordOutput`, then successful reruns. Their inclusive capture brackets are 607/758/800 ms; browser-first capture is 232 ms without a reported conflict. These later conflicts affect completion, not the already observed first text. Parent-title work begins after canonical final output and is excluded from the first-answer critical chain.

Client acquisition remains protected. Browser envelope RPCs take 1,001.6/1,462.6 ms, followed by independent fresh sessions of 603.6/223.4 ms. Two concurrent browser observation lanes remain visible in the client trace. A nearby first-output acquisition wave records observer RPCs of 205.3/320.3 ms followed by sessions of 271.6/247.6 ms first, and 496.6/620.1 ms followed by 211.8/199.1 ms warm. Payload-free logs cannot prove which wave carried the first text or align it to native commit time.

CLI authentication handshakes take 398.1/390.7 ms within submit-to-first-stdout. Initial client connection session reads take 297.1/230.9 ms before the envelope. The envelope RPCs take 862.3/568.8 ms; fresh post-sessions take 176.2/207.6 ms. Submit start → admission post-session end is 1,760.9/1,405.7 ms on the CLI clock, including these prerequisites. The last completed observation/session pair before first stdout takes 258.7 + 177.3 ms first and 286.6 + 265.1 ms warm. Observation start → first stdout is 437.8/553.2 ms; post-session end → stdout is 1.0/1.1 ms on that same client clock. This measures protected client acquisition, not provider/network TTFB. The browser authentication handshake occurred at page connection, outside its chat timing.

The saved strict native memory proof passes for these four runs and all eight events, including stored vector/index provenance and contiguous fact/vector progress. It is separate from latency and from later supplemental cases. No finance or cleanup claim is made here before its owner's final receipt.

Both original snapshots stay below their unchanged 1,000-execution / 16 MiB limits (587/984 completions; 718,131/1,271,315 raw bytes), with 208/452 phase projections. Four table collectors retain the original 256-row / 30-second bounds. Metadata projection and unlogged native internals still limit attribution. Gateway versus upstream-provider versus network time, native-completion-to-pixels transit, hidden nested component costs and private returned payload contents remain unavailable. Action user duration includes awaits; cached-result metadata and inherited user durations are preserved, not presented as new CPU work. An unmatched late CLI RPC begin is retained outside the two first-stdout windows.

No cross-generation causal speed ratio, source change, retry, deadline increase, new acceptance gate or further micro-optimization proposal is made by this packet. The remaining whole path consists of guarded admission and scheduling, context/model preparation, indexed recall when present, billable admission, Gateway/provider response, protected output persistence and authenticated client acquisition. All four runs already exceed one second before model dispatch.

Exact run IDs, request/execution joins, native completion rows, performance spans, source paths, SHA256 input receipts and precise client clocks are retained in [cloud-k19-four-run-delay-chain.json](cloud-k19-four-run-delay-chain.json). Source entry points are `runtimeClient.ts:19/57`, `runtimeAgent.ts:1122`, `runtimeAgentQueryEmbedding.ts:58/122/146`, and the unchanged recall tail at `runtimeMemoryServices.ts:104`.
