# K17 four-run delay chain

**Functionality passed; all four one-second samples failed.** Foreground browser after-paint was 6,796.2/6,149 ms; Basic first stdout acknowledgement was 10,531.912421/14,391.614923 ms. All four exact replies completed under the unchanged 30,000 ms deadline, with no paid retry. The strict native proof passed all eight canonical events, positive user facts, matching current-profile vectors, complete usage and current source/authority/provenance, with contiguous facts/vector progress through eight. One fresh cleanup verification confirms the database, container and four owned private directories are ABSENT.

Repository SaintNick1214/Project-Cortex; source `6156ea97aa8776accee52879176cdcd12e802d89`, session `2b6876d8-e68b-4cb1-9a9e-6eee05c07245`, impartial-dodo-83/6154753, image fda79d59…6218. This report uses saved receipts only after the authorized collectors finished. No further service, inference, source or package work occurred.

## The critical prefix

These intervals use the same server clock, anchored to each committed run's creation. Preparation contains recall; the rows are not an additive engine-time table. The first durable row timestamp is the mutation's start, not its completion/commit or a client display marker.

| Native region, ms | Browser first | Browser warm | CLI first | CLI warm |
| --- | ---: | ---: | ---: | ---: |
| Run-created → prepare begins | 3,517 | 1,539 | 1,834 | 1,440 |
| Preparation bracket | 732 | 1,130 | 4,981 | 7,506 |
| Recall within preparation | unavailable / not observed | unavailable / not observed | 3,535 | 5,728 |
| Model begins → atomic admission begins | 303 | 325 | 318 | 400 |
| Atomic admission/checkpoint bracket | 350 | 795 | 372 | 947 |
| Native stream begins → first processed text | 549 | 746 | 508 | 586 |
| First current visibility fence | 245 | 269 | 312 | 379 |
| Run-created → first durable row timestamp | 5,707 | 4,814 | 8,335 | 11,268 |
| Row timestamp → recordOutput completion | 173.0 | 202.3 | 266.9 | 304.2 |
| Run-created → canonical final row timestamp | 7,116 | 6,952 | 10,698 | 14,336 |

The source and journals reach one V5 context/model action and one primary Agent operation per run. Browser requests use the indexed-empty preparation path; populated CLI requests fall back to the original guarded recall. The initial native admission alone already exceeds 1,000 ms in all four successful submissions. Answer dispatch occurs at +4,906/+3,793/+7,508/+10,298 ms, before the 0.51–0.75-second processed-text acquisition intervals. No provider/network first-byte measurement is exposed by that interval.

## Initial admission is large, but its nested attribution is missing

Successful submitAndStart engine/userExecution times are 3,169.6/231.2 ms first browser, 1,209.6/151.8 warm browser, 1,475.8/109.7 first CLI and 1,039.0/98.9 warm CLI. Their read counts are 283/307/291/973 documents. The first browser completion has no reported retry; its long engine duration cannot be labeled OCC backoff or JavaScript cost from these fields alone.

CLI warm also has an earlier failed native attempt under the **same requestId**. It takes 1,288.2 ms engine, reads 978 documents and reports a workers conflict in component workflow/workpool/batchWorker, written by **workflow/workpool/complete.js:complete**. It precedes committed run creation by 1,349 ms; the whole same-request submission envelope is 2,411.6 ms. This is a native transaction retry, not a new inference intent or paid retry.

There are **no distinct child Completion records sharing any submitAndStart requestId** in the saved snapshots. First/warm browser and first CLI each retain only their parent; warm CLI retains the failed and successful parent. Even the below-cap browser snapshot lacks child completions for claimNext, startContext, barrier, Workflow start/getHandlers or Agent component work. Current source calls those operations, but their separate native durations are unavailable. Other component rows with different requestIds cannot be assigned to admission merely because they overlap in time. No zero-work or component-nonexecution conclusion follows.

## Populated recall remains mostly governed work

The exact nonoverlapping Action-clock recall partition is:

| Recall region, ms | CLI first | CLI warm |
| --- | ---: | ---: |
| Read/profile/model preparation before native embedding begins | 1,155 | 2,390 |
| Native embedding | 404 | 382 |
| Native result ready → governed attachment completes | 458 | 1,124 |
| Subsequent facts/vector/source reads and fresh final delivery | 1,518 | 1,832 |
| Total recall | **3,535** | **5,728** |

Embedding therefore does not explain the 5.73-second recall. First/warm pre-embedding readiness is 255.5/437.3 ms engine; the first explicit policy resolution is 197.6/554.0 ms, and the second is a cached 0.042 ms first but a fresh 272.2 ms warm. Admission/checkpoint remain separate governed mutations. Warm embedding terminal capture retries on runtimeBudgetAccounts written by **runtimeModelPolicy.js:admit**; its full capture bracket is 779 ms, followed by 339 ms attachment. Capture retains liability independently of deliverable output, so fusing its charge commit with a fallible attachment would require a different accounting proof.

Facts and vector retrieval overlap. Vector hydration engine/user is 354.4/72.1 ms first and 480.1/76.9 warm, reading 88/183 documents. The preserved fact-source reads use two/three individual source queries. The new Agent source batches are actually reached: **two per CLI run, four total, and zero individual contextSource calls**. Their engine times are 161.5+119.4 ms first and 253.4+149.4 warm; sequential completion envelopes are 282.0/404.5 ms. The original per-item source/cutoff/witness guards remain. This proves the installed handoff change, not a causal cross-generation speed ratio.

Fresh finalDelivery still costs 420.0/593.5 ms engine, versus 107.9/170.4 ms userExecution, reading 433/911 documents and 546,227/1,071,267 bytes. Fresh saveContext adds 233.4/303.7 ms engine and 218/563 reads; resolved model preparation adds 454.8/455.9 ms and 319/749 reads. Preparation's exact partitions are 724+3,535+722 ms first and 992+5,728+786 warm.

## Current guard and protected-output costs

These are native completion observations. Caller envelopes contain children, and recordOutput overlaps later visibility/capture work; do not sum the following costs into first-visible latency.

| Guard-heavy completion | CLI first engine ms / reads | CLI warm engine ms / reads |
| --- | --- | --- |
| hydrateExecution before model | 238.6 / 216 | 311.1 / 561 |
| Main admission, successful attempt | 352.9 / 272 | 447.0 / 596 |
| First markVisible | 298.9 / 271 | 367.4 / 616 |
| First recordOutput | 251.4 / 217 | 292.9 / 562 |
| Main terminal capture, successful attempt | 293.2 / 286 | 329.1 / 631 |
| hydrateExecution before attachment | 376.4 / 216 | 299.7 / 561 |
| Main attachment, successful attempt | 358.2 / 278 | 363.4 / 623 |

Warm main admission retries on runtimeBudgetAccounts written by **runtimeModelPolicy.js:captureTerminalEvidence**, producing its 947 ms bracket. Warm main capture retries on runtimeAgentExecutions written by **runtimeAgent.js:recordOutput**, producing an 801 ms bracket. First CLI attachment retries on the shared budget account written by **runtimeModelPolicy.js:admit**. Browser warm main admission has the same admit/account conflict; its terminal capture also conflicts with recordOutput. Browser preparation and first visibility have no reported retries in the retained records; the prior K16 claim/persistStage conflicts are not present on those K17 attempts. This observation does not prove the removal of all ingestion or budget contention.

The largest measured safe next source region is the repeated guard-heavy parent work, including final delivery and Agent hydration/visibility/output/terminal checks. The existing raw authority/native transcript reader is opted into only selected preparation/admission parents. A bounded extension can reuse raw rows within each native invocation while rerunning every predicate, preserving detached values and write/component-mutation invalidation. Keep the original contextSource getters, per-resource guards, freshness across invocations and all charge-only capture/attachment commit semantics. Missing official nested message-reader completions prevent a native raw-call reduction count; controlled handler counts and an actual installed measurement remain separate requirements. This is a source-batch candidate, not accepted source or promised savings. The initial admission's missing child attribution remains an additional unresolved boundary, rather than grounds for an orchestration redesign.

## Client and evidence boundaries

The original readiness observation used the wrong SDK log filter. The separately saved console projection contains **216 entries: 14 browser markers and 202 SDK latency events**; client timing is available for both turns. SDK submitAndStart RPC durations are 3,292.3/1,529.3 ms on their own client clock. DOM-to-after-paint gaps are 52.0/43.2 ms on the browser clock. Basic retained 125 timing events. Private acquisition still uses the two qualified observer lanes and a fresh post-session fence. None of these client intervals can be subtracted from server offsets to manufacture network, observer or rendering residuals.

The browser snapshot has 186 phases/627 executions and 750,157 raw response bytes. The later CLI snapshot has 426/1,000 and 1,281,488 bytes, reaching the original execution cap while remaining below 16 MiB. The earlier browser snapshot is preserved; absent records remain unavailable, cached query metadata is distinguished from fresh execution, and only retained OCC table/writer fields are attributed. All system tables retained 256-row/30-second bounds and the strict proof's 43 fresh target verifications; it is not one cross-table snapshot.

Finance reports 31 native ledger attempts, zero active slots, all slots released and 5,000,000 UNKNOWN reservation-ceiling units. These are not actual charges, respond-call counts or paid retries. Cleanup was checked once after launcher exit 130. No 0.35→0.37 measured ratio, historical custody repair or overall-goal completion is claimed. Diagnosis/collection is complete; latency remains **0 PASS / 4 FAIL** and the overall follow-up remains 50% as reported by the coordinator.

`cloud-k17-four-run-delay-chain.json` retains exact request/execution/run joins, engine/user/read metadata, conflict writers and hashed document IDs, journals, client timings, source-batch observations, strict proof/finance/cleanup pointers and input digests. The original redacted receipts are unchanged.
