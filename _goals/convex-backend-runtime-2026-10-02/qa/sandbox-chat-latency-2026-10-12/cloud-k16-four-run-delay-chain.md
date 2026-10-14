# K16 four-run native delay chain

**Functionality passed; the one-second latency goal did not.** The unchanged 30,000ms browser/Basic turns completed. Strict native proof passed all eight canonical events, their positive user facts, matching current-profile vectors, full native usage, source/hash/lineage/index provenance and current authority, with contiguous facts/vector/profile progress through eight. Browser-first latency is **UNAVAILABLE** because the initial client opt-in was wrong. Browser-warm after-paint is **5,197.2ms**; CLI first/warm first-stdout are **11,371.979422 / 14,704.853548ms**. Outcome: zero SLO PASS, three measured FAIL, one unavailable. The original opt-in/HMR gap is preserved; SDK timing logs remained zero after the old client survived HMR. No extra inference or paid retry repaired that gap.

Source is `2dd1c8474392322b71606a8dd8ee2df64b9fe0c5`, target charming-rabbit-938/6153416, session c530728c-fdc2-4876-8690-13317e55ef8d. Exact target expiry was 1792544402587 and all native reads retained fresh exact target/source/image/expiry checks. No observed expiry failure explains these samples. Cleanup is now fresh **ABSENT**, including the database, container and owned private directories. No resources or clients remain.

## Exact native boundaries

| Server region, milliseconds | Browser first | Browser warm | CLI first | CLI warm |
| --- | ---: | ---: | ---: | ---: |
| Run-created → Action prepare phase | 1,618 | 1,167 | 2,056 | 1,785 |
| Action turn.prepare bracket | 1,430 | 1,382 | 4,797 | 6,313 |
| Recall inside preparation | not observed | not observed | 3,594 | 4,466 |
| turn.model begin → billable admission begin | 412 | 256 | 290 | 452 |
| Atomic admission/checkpoint bracket | 282 | 324 | 415 | 1,735 |
| Native stream → first processed text | 616 | 546 | 579 | 481 |
| First current visibility fence | 395 | 527 | 841 | 313 |
| Run-created → first durable text row timestamp | 4,762 | 4,211 | 8,990 | 11,092 |
| First text row timestamp → recordOutput completion | 186.2 | 175.2 | 444.2 | 1,455.3 |
| Run-created → canonical final row timestamp | 5,910 | 6,014 | 11,619 | 16,727 |

These rows are not all disjoint: preparation includes recall; parent Actions await native children; output persistence overlaps subsequent visibility work. Do not sum the table. The text row timestamp is fixed at mutation start and precedes completion/commit; CLI warm’s first text row at +11.092s becomes a completed recordOutput only at +12.547s. Client submission/paint/stdout clocks have another origin: no client/server subtraction is used to invent network or observer residual. Native processed first text includes opaque vendor/transport/SDK work, not a universal provider floor. Journal startContext/barrier timestamps remain equal within their parent transaction and do not establish zero work.

The saved journals each have generation zero, the same exact V5 registration handle, explicit startContext/barrier steps and one `context and model turn 0` Action. All runs have one model Agent operation and one canonical assistant output. Both browser requests show indexed-probe phases within prepareTurnModel and no contextInputs/recall/prepareResolved calls. Both CLI requests show routing fallback, then original contextInputs, recall, fresh save and prepareResolved. This is an observed dispatch difference; no empty eligibility or guard omission is inferred merely from zero-duration probe logs.

## The remaining measured paths

**Browser preparation repeats on a specific ingestion write.** Each prepareTurnModel has one failed native attempt and one successful same-request attempt. Both report runtimeIngestionEvents conflicted by **runtimeIngestion.js:claim**; document digests are in the JSON. First failed/successful engine times are 686.6/623.7ms versus own-user 239.1/182.8ms; warm 724.0/583.5 versus 259.4/186.9. Each attempt reads 410 documents/642,377 bytes first, 526/833,911 warm. These aggregate reads are not unique-record counts. The complete Action preparation brackets remain 1.43/1.382s despite shorter successful parent work. Native admission before the Action also costs 1,259.8/937.2ms engine, versus 133.7/155.5ms own user. Both browser first-visibility checks retry on **runtimeRuns written by runtimeIngestion.js:persistStage**. Fresh guards still cost more than model acquisition; the actual conflict metadata does not justify deleting them.

**Populated CLI context spends 3.59/4.47s in recall.** Its native embedding bracket is only 330/440ms (first explicit logged duration is 329ms); the remaining bracket consists of required authority/profile/model-ledger, facts/vector/source and final-delivery work. Facts and vector paths overlap in the accepted parallel recall; their durations cannot be added blindly. Original contextSource queries remain sequential: six calls span 587.5ms first, nine span 917.4ms warm. Current finalDelivery takes 351.7/489.1ms engine (121.7/163.0ms own user), reading 433/911 documents and 546,386/1,071,493 bytes. This is real wrapper/guard work around retrieval rather than a 4.47s vector-provider call.

Before and after that recall, contextInputs engine is 455.0/686.2ms, fresh saveContext 204.0/338.0ms, and prepareResolvedModelOperation 374.5/516.3ms. The Action bracket splits exactly into 606+3,594+597ms first and 960+4,466+887ms warm. The route itself takes 145.8/268.4ms engine and intentionally delegates populated context to the original Action guards. Repeated source/witness and source-dependent final guard transactions are the concrete largest retrieval region left; there is no cached authority/source shortcut in these observations.

**CLI warm has another identified billable-parent conflict.** admitPreparedModelOperation retries on runtimeBudgetAccounts written by **runtimeModelPolicy.js:captureTerminalEvidence**, taking a 1,735ms bracket. Failed engine/user are 1,224.5/322.9ms; successful 465.9/247.9ms, each reading 596 documents/1,410,868 bytes. CLI first’s first markVisible instead retries on that same account written by **runtimeModelPolicy.js:admit**, producing an 841ms first fence. CLI warm first recordOutput has **no reported OCC retry** but 1,444.1ms engine/334.0ms own user; the overlapping next markVisible takes 1,358.3/230.0ms. Those long completions cannot be called OCC backoff or JavaScript cost without absent nested metadata. Later warm terminal capture retries on runtimeAgentExecutions by recordOutput, then runtimeRuns by commitVectors; those are completion-tail conflicts, not the first-text provider interval. Title is queued after canonical finalization and remains background.

## Evidence and coverage limits

Exactly one browser-post-pair snapshot contains 190 phases/666 executions, below cap; exactly one CLI-post-pair snapshot contains 428/1,000, at the original cap. Raw responses are 790,117 and 1,281,813 bytes, below 16MiB. The early browser snapshot preserves records later CLI traffic might truncate. Missing records are unavailable, never zero. Named nested official getMessagesByIds query completions are absent in both snapshots; this cannot certify a native 18→4 read count. Cached query rows retain original execution/user metadata and may show an old start with later cache-delivery completion; these are not repeated full execution durations.

The strict memory proof is one bounded per-table scan with 43 fresh management verifications, not one cross-table transaction. Finance reports 31 total native attempts, zero active slots, all slots released and 5,000,000 reservation-ceiling units with UNKNOWN cost. These are not actual charges, respond-call counts or paid retries. Root’s startup eight-method qualification and distinct memory proof do not establish an SLO PASS. All4 response completions, original client timing failures, opt-in gap, before/after source pins and full OCC metadata remain retained.

`cloud-k16-four-run-delay-chain.json` contains exact run/request/execution joins, every relevant core native completion with engine/user/read usage, conflict table/writer/document digest, canonical output timings, journal and receipt hashes. `k16-joined-chain-paths.json` lists all four original chains. `k16-native-controls-final-report.json` records collection/cleanup receipt hashes. No source, service, inference, package or review work is proposed or performed by this saved analysis.
