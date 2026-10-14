# K26 ordinary browser pair — saved evidence

SaintNick1214/Project-Cortex source `9fb9687536af0b7abfcb7280e0aa26ef450051ea`, disposable `aromatic-penguin-118` / 6174441. Both ordinary replies and their observed memory completed; first visible paint was 6,544.8/7,045.4 ms. Both fail the 1,000 ms SLO. The first ordinary turn follows an earlier human-approved tool run, populated memory and a warmed SDK. It is not a matched empty-memory K25 first sample. The early tool's marker was READY46 rather than the planned TOOL46; its human-wait duration is excluded from ordinary SLOs.

| Disjoint native interval (ms) | First | Warm |
| --- | ---: | ---: |
| Admission epoch → direct preparation |693|930|
| Direct preparation |223|289|
| Context-input/preflight parent and caller |346|416|
| Recall |2,328|2,667|
| Recall return → save/candidate return |471|505|
| Prepared candidate → main admission |350|256|
| Main admission → dispatch |331|364|
| Total native pre-dispatch |4,742|5,427|
| Main dispatch → processed first text |577|549|
| First text → visibility acknowledgement |220|193|
| First text → first durable Cortex output |478|376|

The last two intervals overlap. Browser local monotonic SLO and native timestamps are separate clocks; do not add them. Main acquisition includes opaque official Gateway/provider/network processing, not an isolated provider TTFB.

Recall includes embedding acquisition 358/362 ms and a protected post-embedding tail 1,306/1,897 ms. Actual new parents reached both ordinary runs. `contextInputsAndEmbeddingV8` used 343/412 ms engine,236/280 ms native own-user metric and 171/427 document reads. `readMatchesAndDeliveryV8` used 328/369 ms engine,164/200 ms own-user and 295/514 documents. `saveAndPrepareContextV8` used 456/489 ms engine,82/109 ms own-user and 217/411 documents. Counts are actual aggregate native reads, not per-table reads, cache hits, or a controlled causal comparison with K25.

Warm embedding attachment 615 ms engine/135 ms own-user/63 documents and `prepareReadsV8`671/171/153 are the largest individual retained native nodes within its post-embedding tail. No OCC retry is recorded on those pre-first-text paths. A later warm main attachment retried against `runtimeBudgetAccounts`, writer `runtimeModelPolicy.js:captureTerminalEvidence`, after the first durable output; it does not explain the earlier pre-dispatch path. Engine-minus-own-user subdivisions remain UNAVAILABLE.

Final bounded selections are 1/3 messages, 3/3 memories, 1/1 facts, 0/0 pending and 2,282 context bytes each. Conservative input 28,416/29,558 is within 32,768. No source selection or qualification guard is inferred absent from a zero outer endpoint count: the new parents compose original local handlers.

Exactly one authorized browser snapshot completed exit0: `service-log-snapshot-k26-browser-post-pair-1792003599165.json`, SHA256 49369a0f23a80fc15a33e88738fa4f9e893c933e1faec7fae2590f8a0e90e35d. It retains 433 phases/1,000 executions and reaches the execution cap, with one unidentified completion. Both ordinary runs have all required checkpoints retained; earlier tool/bootstrap/global coverage may be truncated. Cursor 1792003598782.1555 is saved for the separately authorized incremental CLI snapshot. Original 16 MiB/1,000 execution/256 row/30 second bounds and privacy projection remain unchanged.

Exact owning request/execution IDs, checkpoints, native completion metrics and raw input hashes are in `k26-browser-critical-path-readonly.json`. No further native call, inference, source edit or speed claim accompanies this saved analysis. Full four-run analysis awaits CLI-phase GO/receipts; the latency follow-up goal remains 50%.
