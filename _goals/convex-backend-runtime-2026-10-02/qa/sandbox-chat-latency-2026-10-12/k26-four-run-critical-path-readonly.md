# K26 four-run saved critical path

SaintNick1214/Project-Cortex source `9fb9687536af0b7abfcb7280e0aa26ef450051ea`, image `5d261e62082b2fb04434eac7661f3f3903cd9a755e3eb7ff989525a711043105`, disposable `aromatic-penguin-118` /6174441. All four ordinary runs completed under the unchanged 30,000 ms deadline; all four fail the 1,000 ms SLO. CLI first is also a functional marker failure: its canonical answer and attached native result are READY46 instead of requested CLI46. CLI warm returned CLW46 correctly. No retry or resubmission followed the first failure; `/history` was a nonbillable observation (command2), and warm was command3.

Both browser ordinary samples follow an earlier successful human-approved tool turn, populated memory and a warmed SDK. That tool used READY46, not planned TOOL46, and is excluded from ordinary SLO because of the human wait. K25 browser samples were empty-context samples; a causal speed comparison with them is unsupported.

| Sample | Client paint/print ms | Native admission epoch → main dispatch | Recall | Embedding acquisition | Embedding ready → recall return | Recall return → prepared | Main acquisition | First text → durable output |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Browser first | 6,544.8 | 4,742.0 | 2,328.0 | 358.0 | 1,306.0 | 471.0 | 577.0 | 478.2 |
| Browser warm | 7,045.4 | 5,427.0 | 2,667.0 | 362.0 | 1,897.0 | 505.0 | 549.0 | 375.6 |
| CLI first | 6,934.2 | 4,297.0 | 1,914.0 | 336.0 | 1,239.0 | 485.0 | 475.0 | 562.7 |
| CLI warm | 12,684.2 | 9,377.0 | 3,736.0 | 1,174.0 | 1,993.0 | 1,678.0 | 506.0 | 1,547.0 |

The native prefix starts at the original submission mutation's timestamp; it is not the user's local click/submit clock. Consecutive native intervals are additive only within each owning Action timeline. Handler engine durations include/overlap children and cannot be summed with those phase intervals. Visibility overlaps first durable output. Gateway/provider/network subdivisions within acquisition, engine-minus-native-user causality and per-table/cache-hit attribution remain UNAVAILABLE.

| Disjoint native stage (ms) | Browser first | Browser warm | CLI first | CLI warm |
| --- | ---: | ---: | ---: | ---: |
| Admission epoch → direct start | 693 | 930 | 599 | 784 |
| Direct preparation | 223 | 289 | 193 | 382 |
| Context-input/preflight parent and caller | 346 | 416 | 358 | 730 |
| Recall | 2328 | 2667 | 1914 | 3736 |
| Recall → save/candidate return | 471 | 505 | 485 | 1678 |
| Prepared → main admission | 350 | 256 | 303 | 1390 |
| Main admission → dispatch | 331 | 364 | 445 | 677 |

Warm CLI's 9.38-second native pre-dispatch path contains 3.74 seconds recall, 1.68 seconds save/candidate, and 1.39 seconds prepared→main-admission. Its embedding acquisition alone took 1.17 seconds. The pre-model hydrate inside the prepared→admission region used 1,215 ms engine/219 ms native-user/234 document reads. Save/candidate used 1,665/120/751. Main admission used 659/384/489. These pre-first stages have no retained OCC retry, so retries are not their demonstrated explanation. The large unallocated engine portions cannot be called network, CPU or a specific Convex internal delay.

| Actual native completion: engine / native user / documents | Browser first | Browser warm | CLI first | CLI warm |
| --- | --- | --- | --- | --- |
| Direct preparation | 216 / 150 / 54 | 277 / 139 / 146 | 181 / 112 / 58 | 370 / 171 / 260 |
| Context-input + embedding parent | 343 / 236 / 171 | 412 / 280 / 427 | 356 / 222 / 183 | 727 / 430 / 709 |
| Embedding admission | 637 / 110 / 112 | 387 / 138 / 266 | 318 / 107 / 112 | 541 / 207 / 682 |
| Embedding capture | 390 / 154 / 46 | 192 / 107 / 71 | 214 / 97 / 46 | 566 / 162 / 101 |
| Embedding attachment | 287 / 126 / 38 | 615 / 135 / 63 | 188 / 99 / 38 | 258 / 112 / 93 |
| Read preparation | 258 / 119 / 86 | 671 / 171 / 153 | 216 / 115 / 137 | 373 / 167 / 249 |
| Matches + final delivery | 328 / 164 / 295 | 369 / 200 / 514 | 586 / 252 / 839 | 663 / 351 / 1252 |
| Save + candidate | 456 / 82 / 217 | 489 / 109 / 411 | 463 / 91 / 357 | 1665 / 120 / 751 |
| Pre-model hydrate | 226 / 91 / 39 | 175 / 104 / 78 | 219 / 98 / 91 | 1215 / 219 / 234 |
| Main admission | 312 / 169 / 161 | 344 / 211 / 279 | 419 / 228 / 251 | 659 / 384 / 489 |
| First visibility | 209 / 92 / 54 | 183 / 96 / 93 | 299 / 111 / 106 | 404 / 161 / 249 |
| First output | 246 / 123 / 40 | 170 / 90 / 79 | 235 / 100 / 92 | 1111 / 218 / 235 |

All four ordinary runs actually invoke the new private context-input/embedding parent and matches/final-delivery parent once per owning Action. Their original individual source/final-delivery guards execute locally; outer endpoint zeros are not skipped predicates. Read/delivery documents are 295/514/839/1,252 and save/candidate 217/411/357/751 in these four samples. They are aggregate native read metrics. More documents in one run do not establish which ancestry, authority or table caused them. Final bounded input is respectively messages/memories/facts/pending `1/3/1/0`, `3/3/1/0`, `1/4/1/0`, `3/4/0/0`; context bytes 2,282/2,282/2,838/2,313; qualified input 28,416/29,558/31,872/29,696 stays within 32,768.

The browser first/warm embedding tail used 1,306/1,897 ms after acquisition. Warm browser's embedding attachment used 615 ms engine/135 ms native user, and read preparation 671/171. First CLI's corresponding tail was 1,239 ms. Warm CLI's 1,993 ms tail includes capture566/162, attachment258/112, read preparation373/167 and matches/final delivery663/351; those completion spans are nested in the tail, not extra time to add.

The warm CLI first-output interval is 1,547 ms, including first visibility404 ms engine and first output1,111 ms engine/218 ms native user/235 documents. It overlaps the concurrent later visibility RPC. Later browser warm attachment retried against runtimeBudgetAccounts (writer captureTerminalEvidence), later CLI first attachment against runtimeBudgetAccounts (writer admit), and later CLI warm finalize against runtimeIngestionScopes (writer refreshWatermarks). All begin after their first durable output. These later conflicts remain real but cannot explain their earlier prefixes. OCC re-execution is not a paid retry.

| Client-only measurement (ms) | Browser first | Browser warm | CLI first | CLI warm |
| --- | ---: | ---: | ---: | ---: |
| Delivered admission from submit | 902.8 | 1329.8 | 1495.2 | 1365.8 |
| Submission RPC | 699.6 | 1115.9 | 605.4 | 776.3 |
| Fresh post-admission session | 198.2 | 208.3 | 252.0 | 232.4 |
| Last protected observation + post-session span | 400.2 | 435.4 | 605.0 | 563.1 |

Browsers were authenticated before both ordinary submits; CLI first auth took 390.4 ms and its initial fresh session 216.4 ms. CLI warm reused its connection and still made a 355.6 ms fresh pre-admission session. Completed observation/session cycles before first text were 4/4/4/5. Last post-session→CLI print was 1.19/0.69 ms; browser DOM→paint 17.2/15.2 ms. Client cycles overlap native execution and are not additive to the native prefix. Their wakeups alone do not prove identical payloads or unnecessary guards.

## Exact first-CLI request finding

One authorized diagnosis read six bounded official system-table pages, then closed the client. It tied Agent model ordinal 0 to its matching native model operation and exactly one attempt. The current canonical user and bound governed request both retain the topaz/CLI46 directive. Actual governed message roles/order are `[system instructions, user CLI46, system Cortex context]`. The last system message contains two READY46 markers, the exact older READY46 reply directive, and one WARM46 marker. Attached native output and canonical assistant both contain READY46, so this is not a CLI formatter replacement or a lost current input.

The persisted bounded candidate-entry pool contains the older READY46 directives in memory entries 0/1. The diagnostic field named `selectedEntries` projects `execution.modelInputEntries`; it does not separately retain exact final entry-key membership. Final fit counts above provide that separate bounded selection observation. Independently of this bookkeeping label, the actual bound trailing system message proves the older directive was included. Source `convex-dev/runtimeAgent.ts:1055` appends authorized context as a system-role message after fresh captured messages, even though its wrapper labels the text untrusted evidence. This is a concrete request trust/order finding relevant to the observed functional failure, not proof of the model's internal causal reasoning. Provider-internal transformations remain unobserved. No instruction was removed, cap changed, or source modified during diagnosis.

The next coherent source repair should address that demonstrated recalled-instruction composition before accepting this failed functional outcome. Performance work should target the measured populated recall/control/save/hydrate path and first-output interval, not assume another small raw-row change will deliver 1-second latency. This report authorizes no source change, cache, guard bypass or financial transaction merge.

K25's four local SLOs were 6,215.0/3,884.1/7,249.5/10,243.8 ms and native prefixes 3,563/2,287/4,805/8,270 ms. K26's context and prior tool/marker history differ. Neither this comparison nor controlled K26 read savings proves a causal native speed ratio.

The once-per-pair snapshots retain 1,000 browser executions/433 phases (cap reached, one unidentified completion) and 388 incremental CLI executions/250 phases. All ordinary required checkpoints are individually present; global earlier tool/bootstrap retention remains bounded. Original 16 MiB/1,000-execution/256-row/30-second limits are preserved. The CLI request diagnosis has no full private payload or credential output; only hashes, roles, counts and known synthetic marker checks are retained. No global financial before/after attribution was made while root's isolated memory controls ran concurrently.

Raw receipts and exact joins/hashes are linked in `k26-four-run-critical-path-readonly.json`; request receipt is `k26-request-order-diagnosis-1792003978819.json` (SHA256 1b624b7139d24ef1300fa12630ff432cfe5d8393d030b1cab66c4eb26c2a6a8d). B performed two authorized log GETs and one six-page request diagnosis, no tool-chain scan because it was unnecessary, no model calls/mutations/retries. All B native ports closed. Full four-run saved diagnosis is 100%; latency goal remains 50%; all four SLO failures and first CLI functional failure remain preserved.
