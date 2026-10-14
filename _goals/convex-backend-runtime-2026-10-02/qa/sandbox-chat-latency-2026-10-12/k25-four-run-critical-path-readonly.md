# K25 saved four-run critical path

In SaintNick1214/Project-Cortex, source `6f5d31fc920c3ac06512348ebe79d955ccd92e92`, all four ordinary replies completed under the unchanged 30,000 ms deadline. All four failed the 1,000 ms target. This is saved receipt analysis, not a new service test or source acceptance. Diagnosis completion is 100%; the latency follow-up goal remains 50%.

| Sample | Browser paint / CLI first print (ms) | Native admission epoch → main dispatch (ms) | Dispatch → processed first text (ms) | First text → first durable Cortex output (ms) |
| --- | ---: | ---: | ---: | ---: |
| Browser first | 6,215.0 | 3,563 | 568 | 838.8 |
| Browser warm | 3,884.1 | 2,287 | 575 | 395.1 |
| CLI first | 7,249.5 | 4,805 | 517 | 449.9 |
| CLI warm | 10,243.8 | 8,270 | 575 | 490.5 |

The native admission epoch is the original submission transaction's timestamp; it is not the local user-click clock. Native dispatch-to-text combines official Gateway/provider/network processing up to the application's processed-text phase. Separate Gateway and provider TTFB are unavailable. Durable-output intervals include the visibility interval; these columns must not be added to the independently clocked client SLO.

The warm CLI's dominant measured region is the protected recall tail before the main model, not the main provider response or first-output commit. Recall took 4,479 ms: 407 ms from recall entry to embedding dispatch, 329 ms embedding acquisition, then 3,743 ms from embedding ready to recall return. Another 947 ms followed from recall return to the prepared main-model candidate. The first CLI used the same path with 1,803 ms recall (380 + 409 + 1,014 ms) and 497 ms afterward.

Native intervals below are consecutive boundaries on the same owning Action clock. They sum to each row's pre-dispatch value above; native handler engines and children listed later overlap these intervals.

| Sample | Epoch → direct start | Direct preparation | Context-input parent / caller | Recall | Recall → save/candidate return | Candidate → main admission | Main admission → dispatch |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Browser first | 779 | 1,620 | — | — | — | 348 | 816 |
| Browser warm | 1,195 | 592 | — | — | — | 240 | 260 |
| CLI first | 944 | 239 | 699 | 1,803 | 497 | 262 | 361 |
| CLI warm | 850 | 319 | 752 | 4,479 | 947 | 505 | 418 |

The browser path actually selected the local empty branch: selected history was one then three messages, with zero memories/facts/pending entries and zero context bytes. No recall phase or embedding operation exists on either owning browser Action. The warm conversation's earlier messages were represented by its selected recent canonical input. That observed branch does not show a missing new export or a retrieval failure.

The populated CLI actually reached both new private parents once per run: `contextInputsAndEmbeddingV8` and `readMatchesAndDeliveryV8`. The old `contextInputsV8`, separate query-embedding preflight, `readMatchesV8`, `finalDeliveryV8`, and individual/batch `contextSource` endpoints have zero outer completions on these owning Action request IDs. Their original handler predicates execute locally inside the parents. Zero outer completions therefore do not mean their checks were skipped. No Workflow completion is attached to these four direct Action request IDs.

| Actual native completion | Browser first engine / own user / documents | Browser warm | CLI first | CLI warm |
| --- | --- | --- | --- | --- |
| `submitAndStartEnvelope` | 537 / 165 / 184 | 957 / 175 / 188 | 802 / 142 / 190 | 730 / 230 / 188 |
| `prepareDirectTurnV8` | 1,603 / 442 / 276 | 578 / 354 / 422 | 227 / 98 / 55 | 310 / 144 / 271 |
| `contextInputsAndEmbeddingV8` | — | — | 695 / 285 / 177 | 749 / 413 / 874 |
| Embedding `admitV8` | — | — | 353 / 115 / 112 | 385 / 145 / 330 |
| Embedding `captureTerminalEvidenceV8` | — | — | 242 / 115 / 46 | 721 / 130 / 101 |
| Embedding `attachTerminalResultV8` | — | — | 153 / 88 / 38 | 743 / 140 / 93 |
| `prepareReadsV8` | — | — | 216 / 104 / 103 | 316 / 180 / 240 |
| `readMatchesAndDeliveryV8` | — | — | 362 / 178 / 437 | 1,914 / 381 / 899 |
| `saveAndPrepareContextV8` | — | — | 480 / 94 / 371 | 931 / 121 / 905 |
| Pre-model `hydrateExecution` | 125 / 77 / 23 | 147 / 86 / 30 | 183 / 79 / 47 | 378 / 128 / 102 |
| Main `admitPreparedModelOperationV8` | 789 / 176 / 107 | 240 / 148 / 141 | 339 / 175 / 251 | 401 / 252 / 573 |
| First `markVisible` | 482 / 133 / 38 | 191 / 106 / 45 | 239 / 102 / 62 | 237 / 104 / 117 |
| First `recordOutput` | 322 / 110 / 24 | 178 / 91 / 31 | 184 / 92 / 48 | 228 / 97 / 103 |

Durations in that table are milliseconds. Document counts are the native aggregate for the completion, not counts assigned to a table, predicate, component query, or authorization namespace. Engine minus own-user time has **UNAVAILABLE causal attribution**. It is not evidence of network time, provider work, CPU, a component wait, or a specific Convex internal bottleneck. There are no separately logged `getMessagesByIds` / `listMessagesByThreadId` query children on these owning Action request IDs, so their individual costs cannot be recovered from this projection. Component writes such as `messages:addMessages` and `streams:*` are retained in the JSON function counts; they overlap the owning native path and do not close the missing attribution.

No OCC retry is recorded in these pre-first-text preparations, admissions, embedding settlements, source reads, or saves. Later CLI first main capture retried on `runtimeBudgetAccounts`, writer `runtimeModelPolicy.js:admit`; later CLI warm main capture retried on `runtimeAgentExecutions`, writer `runtimeAgent.js:recordOutput`. First CLI finalization then retried against `runtimeRunMemoryProgress` / `runtimeIngestion.js:persistStage` and `runtimeIngestionScopes` / `runtimeMemoryContext.js:refreshWatermarks`. Every one began after the first durable output. These are real conflicts affecting later completion; they do not explain the warm 8.27-second pre-dispatch interval. OCC re-execution is not evidence of a second billable request or paid retry.

| Client observation | Browser first | Browser warm | CLI first | CLI warm |
| --- | ---: | ---: | ---: | ---: |
| Delivered admission from submit (ms) | 865.9 | 1,540.7 | 1,915.2 | 1,381.2 |
| Submission RPC (ms) | 655.9 | 1,336.6 | 922.2 | 845.4 |
| Fresh post-admission session RPC (ms) | 204.5 | 198.6 | 221.7 | 316.1 |
| Completed observation/session cycles before first text | 4 | 3 | 4 | 4 |
| Last protected observation + post-session span (ms) | 908.2 | 382.4 | 458.9 | 554.5 |

Browser auth was already connected before the measured submissions; CLI first auth took 405.6 ms and its initial session 330.1 ms. CLI warm reused its authenticated connection and had a fresh pre-admission session of 217.7 ms. The final CLI post-session ended 0.44 / 0.70 ms before printing. Browser DOM-to-paint was 24.2 / 17.1 ms. These real client RPCs overlap the native timeline; they cannot be added to it. Repeated wakeups do not establish identical payloads or unnecessary authorization calls. The original first-browser locator failure, caused by the rendered Cortex prefix, remains preserved with no resubmission.

The final conservative input bounds were 13,340 / 14,644 / 30,366 / 31,598 against 32,768. The CLI first/warm selections were respectively `1/3/2/0` and `3/3/2/0` messages/memories/facts/pending, with 2,604 / 2,605 UTF-8 context bytes. These scalars prove bounded final selection, not bounded total upstream guard reads. The retained payload does not expose candidate hit, complete ancestry, unique witness, or per-table read counts. No unknown count is filled with zero.

The next coherent repair should target the private V8 protected source/transcript read region spanning `readMatchesAndDeliveryV8` and the later save/candidate guards, together with the initial context parent. Source shows both ordered source branches call `contextSourceBatchHandler(nativeCtx)` (`runtimeAgentRecall.ts:82,99`), each source invokes `getSource` and a new `managedSourceIsCurrent` ancestry traversal (`runtimeMemoryRepository.ts:113`, `runtimeDataAuth.ts:190`), and save deliberately enters an independent child preparation invocation (`runtimeAgent.ts:1835`). This establishes repeated source work in code, not its measured per-predicate cost. A is investigating the exact amplification under those boundaries. Any change must keep every source/currentness/permission/expiry predicate, the final raw authority fence, fresh save/admission checks, and the child rollback/refusal durability. No positive authorization cache, witness pruning, cross-transaction reuse, cap increase, or dropped late-revocation assertion follows from this report. The roughly 0.4–0.8 second first-output region is material, but an output-compound implementation is not the next authorized repair and cannot resolve the 8.27-second warm pre-dispatch path.

K24's prior browser/CLI SLOs were 3,665.2 / 3,263.7 / 7,148.3 / 9,541.9 ms; its pre-dispatch intervals were 1,746 / 1,516 / 4,519 / 6,799 ms. K25 does not show consistent wall-time improvement across these separate generations and conditions. This comparison supplies no causal speed ratio or promised savings from the two new parents.

Both saved snapshots are below their 1,000-execution cap (542 browser, 391 incremental CLI; 208 / 252 phases). One browser completion is unidentified and remains so. Original 16 MiB response, 256-row page and 30-second limits remain unchanged. Exact input hashes, owning request/execution IDs, phases, mutation performance spans, native completion metrics and OCC hashes are retained in `k25-four-run-critical-path-readonly.json`. No extra native request, inference, source mutation, build, package, or review was performed for this analysis. Independent functional and cleanup outcomes remain root-owned and are not inferred here.
