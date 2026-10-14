# K28 actual cloud critical path

Repository: SaintNick1214/Project-Cortex. Immutable source `a773bd545c22e3c6eeb228b800d4c3a679375c5b`, disposable target `resilient-ptarmigan-738` / 6177151. All four ordinary replies completed with the requested visible markers. All four fail the unchanged 1,000 ms latency target. Browser paint was 4,379.5 / 3,765.6 ms; CLI first stdout was 7,704.97 / 9,901.85 ms under its original 30,000 ms deadline. No early tool prefix or paid retry occurred. Canonical/memory qualification is separately owned by Root/A.

Backend tracing was enabled and read back before every measured turn. The browser snapshot contains 548 native executions, 208 phases and 14 bound records; the incremental CLI snapshot contains 382 executions, 236 phases and 21 bound records. Neither reaches the original 1,000-execution cap. Both collectors ran once, exited 0 and closed. A separately authorized public-recall snapshot contains 232 executions, 106 phases and two bound records, also without reaching the cap. No additional live read is needed for these joins.

## Whole ordinary path

These durations use a single server clock. Admission entry is the native submit-envelope mutation entry, not the user's click. First output means the successful first `recordOutput` mutation completion, not a row's fixed `createdAt`. Browser and CLI latency clocks remain separate.

| Interval, ms | Browser first | Browser warm | CLI first | CLI warm |
|---|---:|---:|---:|---:|
| Native admission entry → main-model dispatch | 2,223 | 2,087 | 5,305 | 6,949 |
| Main dispatch → processed first text | 668 | 481 | 497 | 535 |
| Processed first text → first output mutation completion | 637.2 | 502.9 | 556.8 | 1,023.2 |
| Admission entry → first output mutation completion | 3,528.2 | 3,070.9 | 6,358.8 | 8,507.2 |

Every run already exceeds one second before main inference. The 0.48–0.67 second model interval includes official Gateway routing, provider work, transfer and local stream processing. None of those internal subdivisions is separately measured.

The disjoint pre-dispatch chain is retained in JSON. The browser chain is admission → direct preparation → fresh pre-storage hydrate/Agent preparation → native main admission/checkpoint → dispatch. Its direct preparation took 712 / 618 ms wall time. Both browser fits contain zero retrieved memory/facts/pending and zero context bytes, so the absence of recall phases is supported by actual selected-input metadata, not inferred from zero endpoint names.

CLI first/warm split into 725 / 843 ms from native admission entry to direct preparation, 306 / 362 ms direct preparation, 467 / 526 ms context/profile/embedding preparation, 1,976 / 3,172 ms recall, 844 / 827 ms save/candidate preparation, 512 / 392 ms before main admission, 472 / 823 ms main admission/checkpoint, and 3 / 4 ms to dispatch. These segments are disjoint; nested engine/CPU measurements below must not be added again.

## Recall and native control work

| CLI recall interval, ms | First | Warm |
|---|---:|---:|
| Governed embedding admission/checkpoint | 395 | 542 |
| Actual embedding dispatch → ready | 312 | 336 |
| Independent terminal capture | 262 | 410 |
| Independent result attachment | 231 | 311 |
| After attachment → recall returned | 751 | 1,554 |
| Whole recall | 1,976 | 3,172 |

After embedding became ready, 1,256 / 2,281 ms still remained before recall returned; that inclusive interval contains capture and attachment. It must not be added to those rows. The warm read tail contains an 875 ms `prepareReadsV8` query and a 667 ms match/final-delivery mutation.

Selected native completions below show engine ms / own-user ms / read documents. Child functions and their owning Action overlap.

| Native function | Browser first | Browser warm | CLI first | CLI warm |
|---|---|---|---|---|
| submitAndStartEnvelope | 682 / 185 / 176 | 672 / 212 / 172 | 576 / 144 / 182 | 685 / 176 / 172 |
| prepareDirectTurnV8 | 687 / 376 / 276 | 598 / 376 / 419 | 292 / 158 / 55 | 350 / 179 / 148 |
| contextInputsAndEmbeddingV8 | — | — | 463 / 248 / 174 | 522 / 295 / 407 |
| embedding admitV8 | — | — | 375 / 114 / 95 | 521 / 156 / 282 |
| prepareReadsV8 | — | — | 253 / 115 / 136 | 875 / 199 / 199 |
| readMatchesAndDeliveryV8 | — | — | 486 / 196 / 449 | 667 / 253 / 602 |
| saveAndPrepareContextV8 | — | — | 823 / 108 / 219 | 809 / 140 / 393 |
| Fresh pre-storage hydrateExecution | 174 / 88 / 23 | 227 / 104 / 30 | 400 / 121 / 47 | 288 / 106 / 102 |
| Successful main admission | 335 / 171 / 107 | 301 / 158 / 141 | 451 / 193 / 164 | 392 / 195 / 270 |
| First recordOutput | 164 / 79 / 24 | 176 / 93 / 31 | 228 / 89 / 48 | 661 / 155 / 103 |
| New terminal attachModelResultV8 | 268 / 121 / 61 | 269 / 109 / 75 | 357 / 152 / 87 | 831 / 291 / 125 |

The new main attachment parent is actually observed for all four runs. It occurs after the first output, so its reduced handoff cannot explain first-paint improvement. `checkpointRecall` has zero separately logged completions: it is a nested child selected by the frozen V8 admission source. The parent admission and actual embedding are observed; an exact child duration is unavailable. Public read parents do not occur in ordinary Agent recall; their separate actual API case is below.

## Conflicts, bounds and protected client delivery

Warm CLI main admission retries after a budget-account conflict whose write source is `runtimeModelPolicy.js:admit`. The conflicting document hash and both execution IDs are retained in JSON. The writer's semantic stage and tenant-versus-run account identity are unavailable; a function name alone does not establish either. This retry is inside the 823 ms main admission interval.

Later conflicts are distinct: browser-warm terminal capture conflicts with `recordOutput` on an Agent execution; CLI-first terminal capture conflicts on a budget account; CLI-warm terminal capture conflicts with `recordOutput`; CLI finalization conflicts with ingestion memory progress / belief publication. The warm CLI capture begins during the last 28 ms of its first output mutation; its conflict/retry follows that output commit. The other listed later conflicts follow first output. Their inclusive settlement/finalization waits are not added as serial first-output stages.

Final fitted inputs were: browser 1 / 3 messages and zero recalled entries; CLI 1 message + 4 memories + 1 fact, and 3 messages + 2 memories + 2 facts. Pending count is zero. CLI context bytes were 2,507 / 2,077; final conservative input bounds were 31,842 / 29,966, below 32,768. Pure fitting first rejected larger optional-entry candidates. Those refusals are not paid model retries.

Before first visible/printed text, completed observe-envelope RPCs were 3 / 2 / 3 / 3; completed session RPCs were 4 / 3 / 5 / 5. Browser warm also had one observation already in flight at paint. The final protected observe-plus-post-session pair took 572.5 / 429.5 / 475.2 / 881.1 ms on its own client clock. These intervals overlap server work and cannot be added to the server table. Browser capture includes 14 observation and 23 session completions overall, including connection and later memory-status observation. CLI includes 11 observation and 25 session completions overall, including readiness commands. Full client events and windows are retained in JSON.

## Actual public memory.recall

Root/A's one genuine public recall returned five items and 279 context bytes with current profile and scoped positive preference. The API took **3,702.19 ms**. Its actual action RPC took 3,332.806 ms in the wrapper timer (3,332.872 ms in SDK tracing), surrounded by 173.67 / 194.72 ms pre/post session checks. This is separate from Agent's private recall API.

The exact native Action request is `146cc0ccb10347df`. All three new public read parents are observed once. There is no OCC retry in this public chain.

| Disjoint public server interval | ms |
|---|---:|
| Action entry → native preparation returned, including authority and budget setup | 643.6 |
| Preparation return → governed admission begin | 9.6 |
| Admission/checkpoint | 236 |
| Admission return → embedding dispatch | 2 |
| Embedding dispatch → ready | 317 |
| Ready → capture begin | 9 |
| Capture | 346 |
| Capture return → attachment begin | 1 |
| Attachment | 155 |
| Attachment return → first read parent entry | 5 |
| prepareReads parent | 344.6 |
| ANN plus Action/handoff gap | 80.4 |
| readMatches parent | 285.8 |
| Ranking plus final-mutation handoff gap | 8.2 |
| Independent finalRecallDelivery | 757.9 |
| Final mutation return → Action completion | 12.5 |

The native Action spans 3,213.6 ms between its recorded entry/completion (3,214.9 ms engine). Before embedding dispatch it already spends about 891 ms. After embedding becomes ready, another 2,005 ms elapses. The three public parents read 30 / 93 / 67 documents with 346 / 286 / 760 ms engine and 81 / 89 / 133 ms own-user time. Engine minus own-user time remains unattributed; it is not proof of network delay. The observed installed 9→3 source-level read handoff composition therefore does not establish subsecond recall.

## Coverage and limits

Exact native request/execution joins, raw receipt hashes, phase timelines, conflict projections, selection scalars and client RPC windows are in `k28-four-run-critical-path-readonly.json` and `k28-public-recall-critical-path-readonly.json`. All three capture closure receipts and original failures remain retained. Browser credential preflight scripting failures sent zero requests, per its original outcome receipt; no clean-console assertion is made.

There is no causal K27/K28 speed ratio. Source, selected context, indexed memory, warm state and concurrency differ. Historical claims about a 200 ms API or version 0.35/0.37 are not measured by this run. Native engine overhead, per-table read attribution, exact ANN-only/ranking-only time and Gateway/provider internals remain unavailable. No new service calls, models, retries, source edits or next implementation were performed by this saved analysis.
