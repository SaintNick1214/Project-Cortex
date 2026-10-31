# K21 observed whole-path delay

Repository: **SaintNick1214/Project-Cortex**. Installed source: `03256989da22bde35dff78023c1c3962391a68c6`; disposable session `2d6e9566-0948-4dd7-8df5-5d7626598a60`, deployment `next-turtle-281` / `6164369`, image `1f28446423b5da71e8e8a22a32c6ad874acae565710c0cb6fa4c187984952c8b`.

All four original replies completed, but **0/4 met the 1,000 ms target**. The dominant delay remains protected Convex admission and preparation before the main model dispatch. The combined Gateway/network/provider interval to processed first text is approximately 0.46–0.52 seconds; this receipt cannot divide that interval into Gateway, network and provider clocks.

| Actual sample | Caller submission → first visible text | Run creation → main dispatch | Main dispatch → processed first text | First visibility guard |
| --- | ---: | ---: | ---: | ---: |
| Browser first | 3,781.1 ms, after paint | 2,373 ms | 518 ms | 157 ms |
| Browser warm | 7,182.6 ms, after paint | 5,428 ms | 484 ms | 162 ms |
| CLI first | 10,605.956 ms, stdout | 8,327 ms | 461 ms | 232 ms |
| CLI warm | 10,822.097 ms, stdout | 7,216 ms | 479 ms | 498 ms |

Caller durations use their own monotonic clocks. Server intervals use the same Action epoch clock. The first visibility values use retained `durationMs`; phase subtraction can differ by one millisecond. These columns overlap and must not be added to form a new total.

Browser authentication completed during Connect, before both samples. Browser admission delivery itself took 1,133.7 / 2,009.2 ms: envelope RPC 918.8 / 1,840.9 ms followed by fresh post-session RPC 206.5 / 162.8 ms. Both are already above the entire target before waiting for a reply. Browser DOM text commits occurred at 3,764.8 / 7,165.2 ms; the subsequent paint took approximately 16.3 / 17.4 ms.

Each Basic CLI command created a fresh authenticated client. Authentication took 381.4 / 404.9 ms, pre-session 220.0 / 229.9 ms, envelope 1,145.3 / 735.9 ms and fresh post-session 173.5 / 187.3 ms. The retained fresh admission return boundary was 1,952.4 / 1,562.9 ms after command submission. The CLI kept its original 30,000 ms deadline. No paid retry or resubmission occurred.

Prospective native mutation timings expose submit 343.6 / 536.5 / 360.8 / 215.0 ms and start 189.8 / 755.7 / 198.3 / 202.3 ms, in sample order. `claimNext` is inside start, taking 161.9 / 647.0 / 172.9 / 175.4 ms; it is not another additive stage. These are the opt-in `performance.now()` spans, rather than differences between fixed mutation `Date.now()` values.

The JSON contains a contiguous, disjoint server-clock chain for each run. For example, CLI first reaches main dispatch through 1,116 ms from creation to preparation entry, 517 ms initial preparation, 920 ms context handoff, 4,050 ms recall, 949 ms save/candidate completion, 309 ms preparation-to-admission handoff and 466 ms admission-to-dispatch. Their sum is exactly 8,327 ms. The handoff intervals include original fresh execution checks and cannot be classified as pure network or scheduler time. The corresponding CLI warm intervals are 713, 392, 568, 2,868, 806, 1,348 and 521 ms, summing to 7,216 ms.

Private Agent recall is not the public `runtimeSDK.recall` endpoint. Its measured split is:

| Private recall stage | CLI first | CLI warm |
| --- | ---: | ---: |
| Recall entry → query-embedding dispatch | 1,034 ms | 782 ms |
| Combined embedding acquisition | 1,088 ms | 248 ms |
| Embedding ready → protected recall return | 1,928 ms | 1,838 ms |
| Total | **4,050 ms** | **2,868 ms** |

The pre-embedding segment includes original preflight and admission/checkpoint: the latter spans 789 / 457 ms. After embedding, charge capture spans 251 / 354 ms and attachment approximately 487 / 306 ms; guarded fact/source/vector retrieval and final delivery follow. These subspans are contained in the recall total, not extra costs. The full Action preparation interval is 6,436 / 4,634 ms for the CLI. Neither browser sample entered this private recall branch.

Selected actual native completions show where the remaining work occurs. Engine time can include children, while own user time excludes system overhead; they are not independent additive measurements.

| Native function | Browser first engine / user / documents | Browser warm | CLI first | CLI warm |
| --- | --- | --- | --- | --- |
| `submitAndStartEnvelope` | 812 / 161 ms / 177 | 1,567 / 210 / 181 | 1,023 / 246 / 183 | 615 / 142 / 181 |
| `prepareDirectTurnV8` | 819 / 296 / 436 | **2,711 / 479 / 600** | 508 / 150 / 85 | 381 / 210 / 305 |
| `contextInputsV8` | branch absent | branch absent | 917 / 231 / 156 | 564 / 249 / 590 |
| Query-embedding preflight | branch absent | branch absent | 234 / 135 / 82 | 314 / 172 / 351 |
| `prepareReads` | branch absent | branch absent | 296 / 105 / 103 | 322 / 133 / 240 |
| `readMatches` | branch absent | branch absent | 329 / 140 / 349 | 433 / 182 / 679 |
| `finalDelivery` internal mutation | branch absent | branch absent | 547 / 95 / 133 | 403 / 101 / 269 |
| `saveAndPrepareContextV8` | in initial parent | in initial parent | 935 / 139 / 570 | 791 / 140 / 1,398 |
| First main `hydrateExecution` | 158 / 72 / 23 | 574 / 106 / 30 | 212 / 92 / 47 | **1,248 / 186 / 102** |
| Main admission/checkpoint | 309 / 150 / 128 | 269 / 154 / 164 | 448 / 210 / 272 | 505 / 249 / 596 |
| First `recordOutput` | 122 / 68 / 24 | 340 / 119 / 31 | 170 / 79 / 48 | 252 / 114 / 103 |

The warm browser parent is costly without a retained retry on that parent. It would be incorrect to attribute its 2.71-second engine duration entirely to OCC or its 479 ms of own user code. The CLI warm 1.25-second fresh execution hydration similarly accounts for most of its 1,348 ms preparation-to-admission handoff. The JSON retains exact execution/request joins and largest observed official Agent component children without adding their durations to parent engine time.

First processed text still passes `markVisible` and the durable output mutation, followed by authenticated observer acquisition and its fresh post-session guard. First text to the output mutation's fixed timestamp is 163 / 168 / 237 / 505 ms. The timestamp is the mutation snapshot start, not commit visibility. The corresponding first output native engine durations are 122 / 340 / 170 / 252 ms. Browser/client logs retain all guard RPC durations, but do not retain response payloads that would establish exactly which observer carried the first text. A residual obtained by subtracting different clocks would not be a valid client delivery measurement.

Actual retained OCC conflicts identify two hot documents. Browser first attachment and CLI first embedding attachment conflict on the same hashed `runtimeBudgetAccounts` row (`099a8d0e…637c`), with writer `runtimeModelPolicy.js:captureTerminalEvidence`; CLI first embedding admission conflicts on that row with writer `runtimeModelPolicy.js:admit`. Browser warm finalization conflicts on `runtimeIngestionScopes` row hash `e6967677…c2f7`, with writer `runtimeMemoryContext.js:refreshWatermarks`. The failed executions have `willRetry:true` with retry counter zero on their first attempt; successor completions are retained. These are native transaction retries, not additional application inference intents. The retained conflicts do not show a memory-publication write to `runtimeRuns`. Absence of another conflict in a capped snapshot is not proof it cannot occur.

The new path is reached: all four saved runs have `executionMode:direct-v8`, a direct scheduled action, and zero ordinary Workflow journal steps. The snapshot contains four `executeDirectV8`, four `prepareDirectTurnV8`, four `submitAndStartEnvelope` and four original shared `admitPreparedModelOperation` completions. Both CLI runs reach the new query-embedding preflight/admission and private read parents. Three embedding-admission completions reflect the observed native retry. Separate candidate/source outer completions are absent because their original handlers execute inside the registered parents. The collector's anticipated `admitPreparedModelOperationV8` name is not an exported endpoint; the actual shared original name is used. No export failure is inferred.

Bounded V8 selection is installed, but selected recent/memory/fact/pending counts and assembled context bytes were not retained by the original scalar projection. They are **unavailable**, not zero. Native main request bounds are input 13,148 / 14,188 / 32,568 / 30,404 against 32,768, with no exceeded dimensions. These are the conservative qualified input dimensions, not provider-reported input usage or independently measured context bytes. The CLI first input approaches its existing cap; this does not establish a causal latency effect or authorize raising that cap.

K20's prior caller observations were 4,465.2 / 4,332.8 / 9,946.163 / 14,619.114 ms, also four failures. Its run-to-main-dispatch intervals were 2,760 / 2,720 / 6,298 / 11,208 ms. K21 and K20 use different disposable sources, datasets, auth lifecycles and background jobs, so these observations do not establish a causal optimization ratio, a controlled historical 0.35-to-0.37 regression, or a Gateway-only regression. The main request's combined acquisition interval stays below the multi-second Convex prefix in every K21 sample.

Collection was finite: four original read-only chain collectors, then one official bounded log GET, no retries, mutations or paid calls. The snapshot retained 474 phases and reached the 1,000-execution cap; original 16 MiB, 256-row and 30-second bounds remain. All four joined foreground chains have the cited phases/completions, but uncaptured nested rows cannot be invented. Error projection keeps only `errorPresent`; private background failure leaf classifications are not recoverable from this snapshot. Later dedicated ordinary-memory QA captures are excluded from these four-run joins and do not inherit the foreground memory proof's acceptance.

The root's separate strict verifier passed the four foreground positive facts and eight vectors/provenance/current-authority events, and its four HTTP auth cases passed. That does not erase the previous WebSocket authentication failure, selector failures, other QA capture failures, or any latency failure. Root owns final finance and cleanup; this packet makes no new cleanup assertion.

**Milestone: saved K21 diagnosis 100%; latency follow-up remains 50%, with native subsecond qualification 0/4.** No source changes, image builds or further service calls follow from this diagnostic packet. Raw input hashes, exact joins, native statistics and disjoint intervals are in `k21-whole-path-delay-diagnosis.json`; the saved-only derivation is `k21-delay-chain-saved-analysis.py`.
