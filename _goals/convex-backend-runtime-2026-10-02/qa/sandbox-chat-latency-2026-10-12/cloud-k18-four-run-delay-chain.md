# K18 four-run delay chain

Functionality passed; all four one-second samples failed. Browser after-paint was 5,914.4/4,714.1 ms; Basic first stdout was 10,428.896546/9,919.051588 ms, under the unchanged 30,000 ms deadline, with no paid retry. Strict native proof passed all four replies/eight canonical memory events and 43 fresh target verifications. The exact database/container/private directories are freshly ABSENT. Repository SaintNick1214/Project-Cortex, source f7c906b2888a410deb81c6a181e4863ca148e43c. This diagnosis uses saved receipts only.

## Critical prefix

The following brackets use each run's committed creation and same native Action wall clock. Preparation contains recall; first row timestamps are mutation start, not committed visibility or browser pixels. Nested engine times are not added to caller brackets.

| Native region, ms | Browser first | Browser warm | CLI first | CLI warm |
|---|---:|---:|---:|---:|
| Created → prepare | 1740.0 | 1157.0 | 1546.0 | 1229.0 |
| Preparation | 1290.0 | 783.0 | 4873.0 | 5426.0 |
| Recall within preparation | unavailable | unavailable | 3584.0 | 4059.0 |
| Model → atomic begin | 276.0 | 295.0 | 708.0 | 281.0 |
| Atomic admission bracket | 575.0 | 819.0 | 465.0 | 419.0 |
| Created → answer dispatch | 3885.0 | 3060.0 | 7596.0 | 7359.0 |
| Stream begin → processed first text | 688.0 | 474.0 | 525.0 | 525.0 |
| First current visibility | 416.0 | 191.0 | 302.0 | 239.0 |
| Created → first row timestamp | 4994.0 | 3730.0 | 8428.0 | 8128.0 |
| First row → output completion | 142.5 | 144.6 | 292.4 | 210.5 |
| Created → canonical final row | 7189.0 | 5335.0 | 10267.0 | 10667.0 |

Even the empty browser path dispatches answer inference only at +3,885/+3,060 ms. The populated CLI path dispatches at +7,596/+7,359 ms. The 1,000 ms target is exceeded before provider text acquisition. The measured 473–688 ms stream interval combines Gateway/network/provider/stream processing; those internals and network TTFB remain unavailable.

## Admission child timing is now measured

These are prospective performance.now mutation callback durations, joined by the exact submit executionId to its requestId and actual run. The fixed pre-submit correlation label is not used to merge different requests. Start is inclusive of claim and Workflow start; do not sum the nested rows again.

| Mutation callback, ms | Browser first | Browser warm | CLI first | CLI warm |
|---|---:|---:|---:|---:|
| admission.submit.end | 288.0 | 193.0 | 179.6 | 168.3 |
| admission.start.end | 1122.9 | 639.9 | 995.7 | 744.4 |
| start.claimNext.end | 172.3 | 163.4 | 156.6 | 139.3 |
| start.workflow.end | 935.4 | 460.5 | 824.5 | 590.5 |
| admission.get.end | 3.1 | 3.9 | 3.1 | 3.1 |

Successful parent engine/user times are 1,512.0/156.5, 939.5/148.8, 1,242.2/107.9 and 967.8/104.4 ms; documents read are 283/307/291/973. Workflow.start dominates the inclusive start callback. This closes K17's absent child-span gap without inventing child Completion records. The actual start.claimNext labels survived the narrow K18 parser fix. The original admission guards and immediate V5 path remain in the installed source.

## Recall is mostly governed control and retrieval

The exact nonoverlapping CLI recall partitions are 1056 + 326 + 716 + 1486 = 3,584 ms and 1585 + 413 + 575 + 1486 = 4,059 ms: pre-embedding authority/profile/prepare/admission; native embedding; result-ready through independently committed attachment; remaining staged reads/source batches/final delivery. Native embedding itself is 326/413 ms. Preparation's disjoint partitions are 662 + 3,584 + 627 = 4,873 ms and 645 + 4,059 + 722 = 5,426 ms.

Before embedding, selected-profile query engines are 164.3/206.1 ms, profile readiness 238.8/290.1 ms and first policy resolve 165.0/208.1 ms. The second identical resolve is cached at 0.038/0.053 ms; its retained userExecutionTime is not a fresh CPU measurement. Separate query admission and checkpoint brackets are 183+212 ms first, 546+235 warm. Warm admission retries on runtimeConversations written by workflow/workpool/worker.js:runMutationWrapper. First embedding terminal capture retries on runtimeBudgetAccounts written by runtimeModelPolicy.js:captureTerminalEvidence; its 507 ms bracket retains separate accounting.

Facts and vector retrieval overlap. Vector hydration engines are 427.6/360.3 ms, with 88/183 reads. Facts still make two/three sequential original source reads. The two ordered Agent source batches per CLI are reached: four total; individual contextSource is zero. Their engines are 141.1+115.7 and 182.8+120.3 ms, with 180+90 and 342+112 reads. Fresh finalDelivery remains 370.5/458.7 ms and 433/911 reads; fresh saveContext is 271.2/264.1 ms and 218/563 reads; resolved model preparation is 315.2/415.4 ms and 319/749 reads. These are nested native observations, not additive savings.

## Read scopes worked; serial orchestration remains

Compared with the separate K17 generation, first/warm CLI hydration reads fell from 216/561 to 47/102; first visibility from 271/616 to 62/117; first output from 217/562 to 48/103. This is an actual installed read-count change. It is not a controlled cross-generation speed ratio. First CLI hydration still took 594.3 ms with 47 reads, while warm took 194.9 ms with 102 reads; read counts alone do not explain native engine latency. Later hydration took 169.6/523.0 ms.

Browser main atomic admissions both retry on runtimeBudgetAccounts written by runtimeModelPolicy.js:admit, yielding 575/819 ms brackets. First browser visibility retries on the same account written by captureTerminalEvidence; finalization retries twice on runtimeIngestionScopes written by runtimeMemoryContext.js:refreshWatermarks. Those finalization retries occur after first text. First CLI attachment also retries on the shared account written by captureTerminalEvidence. Specific attribution uses retained OCC table/writer/hashed-row fields only; absent metadata is not evidence of no contention.

The next major source region is ordinary startup/orchestration plus the Agent-only query-embedding preflight/admission handoffs, rather than another isolated metadata namespace. Existing readCurrentEmbeddingProfile/resolveHandler/admitHandler/checkpointHandler bodies and createBackendGatewayComposition's optional atomic callback provide the narrow seam. Derive the original Agent Attempt/reference/current budget, context request ID, profile/semantic and ordinal 0 on the server; do not accept a new source/parent/model lane. Generic public recall and ingestion stay on their original ports.

A naive combined admission/checkpoint parent would erase the old committed reservation on checkpoint failure. The upcoming implementation must preserve reservation commit, roll back checkpoint partial writes, return a bounded internal refusal and rethrow it from the Action, or retain the original checkpoint boundary. Charge-only terminal capture and fallible private attachment remain independently durable. This is a feasibility/safety finding and authorized source direction, not implementation acceptance or a promised SLO.

## Evidence limits and retained failures

The browser snapshot preserves 210 phases/632 executions; CLI preserves 468/1,000 and reaches the original cap. Original 16 MiB/256-row/30-second bounds remain. Missing older completions remain unavailable. Browser DOM-to-paint is 18.6/15.3 ms on its own clock; client and server clocks are kept separate. UI pending CONTEXT_INCOMPLETE, one warning and the wrong-format selector timeout remain preserved alongside later readiness recovery; no clean-console claim is made.

Finance retains 31 attempts, zero active slots/all released and 5,000,000 UNKNOWN ceiling units, not actual charges or paid retry counts. Cleanup was checked once after launcher exit 130. The JSON packet retains exact native request/execution/run joins, callback durations, engine/user/read/OCC data, source batches, canonical rows, journal and input hashes. Diagnosis is 100%; latency remains 0 PASS/4 FAIL and overall follow-up 50%. No service/source/package work occurred during this analysis.
