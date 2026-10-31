# K29 saved four-run critical path

Saved-receipt analysis only for source `f87695783e8b21ffecf6298057a87cd8e69a3016`, session `ee12c10d-424f-4c65-b1a5-1f4e64bdb8d2`, hosted cloud target `savory-pheasant-21`. No source edit, service access, paid call, retest or repeat measurement. Projection used the exact saved browser/CLI snapshots, existing scalar metadata projector and CLI log. All four observed visible timings remain above one second; this is not SLO acceptance.

## Observed client boundary

| Run | K28 observed ms | K29 observed ms | K29 minus K28 ms | Boundary |
| --- | ---: | ---: | ---: | --- |
| browser-first | 4,379.5 | 3,960.4 | -419.1 | Browser submit → first-text.after-paint |
| browser-warm | 3,765.6 | 3,579.6 | -186.0 | Browser submit → first-text.after-paint |
| cli-first | 7,705.0 | 6,855.5 | -849.5 | CLI submit.begin → answer.first_printed |
| cli-warm | 9,901.8 | 6,981.2 | -2,920.6 | CLI submit.begin → answer.first_printed |

These are four unequal saved contexts, with different selected inputs, indexing state, background concurrency and native retries. The deltas are observations, not a causal speed ratio or evidence of a distribution/SLO. Browser and CLI monotonic clocks are separate from each other and server timestamps. Client-visible durations are never added to server durations.

CLI first chunks were `CLI` then `49`, and `CL` then `W49`. Raw readiness reports facts/vectors complete through 6 before the warm request and through 8 after it. Direct Docker child close reports exit 0 and no signal. The new CLI timing JSON follows the K28 schema and leaves canonical verification PENDING because the timing projection does not independently establish transcript/native memory outcomes. Root subsequently supplied a separate ordinary-native-memory PASS receipt; it is not re-judged here.

## Disjoint server prefix

All numbers below are milliseconds on the saved server clock. Each column partitions admission entry → first successful recordOutput official native completion. Native engine/user durations and nested RPCs are not added to these intervals.

| Disjoint interval | Browser first | Browser warm | CLI first | CLI warm |
| --- | ---: | ---: | ---: | ---: |
| admissionEntryToDirectBegin | 950.0 | 674.0 | 666.0 | 646.0 |
| directPreparation | 421.0 | 417.0 | 381.0 | 336.0 |
| directReturnToRecallBegin | — | — | 365.0 | 456.0 |
| recall | — | — | 1,842.0 | 2,111.0 |
| recallReturnToPrepared | — | — | 484.0 | 517.0 |
| preparedToMainAdmitBegin | 417.0 | 302.0 | 305.0 | 329.0 |
| mainAdmitCheckpoint | 373.0 | 410.0 | 353.0 | 360.0 |
| admitReturnToMainDispatch | 7.0 | 5.0 | 4.0 | 4.0 |
| Main dispatch → processed first text | 597.0 | 748.0 | 463.0 | 646.0 |
| Processed first text → first durable output completion | 551.9 | 415.5 | 470.7 | 520.4 |
| **Total admission entry → first durable output completion** | **3,316.9** | **2,971.5** | **5,333.7** | **5,925.4** |

Pre-dispatch subtotals are 2,168/1,808/4,400/4,759ms. The saved projection checks that each pre-dispatch partition sums to its endpoint. A dash means no recall span occurred in the retained path, not zero-cost retrieval or proof of an empty database. Browser selected 0 memories/facts/context bytes; CLI selected 4 memories with 1 then 0 facts and 2,501 then 1,976 context bytes. Message counts were 1/3/1/3; conservative final input-bound units were 13,226/14,368/31,806/29,360 against 32,768. These are admitted bound units, not observed provider token usage.

## Actual CLI recall

| Component span | CLI first ms | CLI warm ms |
| --- | ---: | ---: |
| embeddingAdmitCheckpointMs | 379.0 | 476.0 |
| embeddingMs | 440.0 | 325.0 |
| captureMs | 222.0 | 243.0 |
| attachMs | 191.0 | 301.0 |
| postAttachReadTailMs | 595.0 | 747.0 |
| Other transition gaps within recall | 15.0 | 19.0 |
| **Total recall** | **1,842.0** | **2,111.0** |

The actual recall spans are 1.842s and 2.111s; the earlier eight-second recall assumption does not apply. K28 observed recall was 1.976s/3.172s. Post-embedding-ready → recall-end is an inclusive 1,014/1,298ms (capture/attachment/read tail overlap that interval, so it is not another additive component). K29 native recall prepareReads engine times are 261.4/256.0ms; readMatchesAndDelivery engine times are 322.5/479.7ms, reading 143/230 documents and 620,138/972,908 bytes. These child-native measurements support a remaining read-tail hotspot without attributing unmeasured platform, CPU or network work.

## Remaining measurable hotspots

1. **Admission and serial preparation before dispatch:** browser 1.808–2.168s, CLI 4.400–4.759s. Admission-entry → direct-begin alone is 646–950ms; actual admission engine time is recorded separately, and the surrounding continuation gap remains distinct. Browser direct preparation is 417–421ms, followed by 302–417ms before main admission. CLI adds 365–456ms before recall, 484–517ms after recall and 305–329ms before main admission. These are the largest measured regions to target, while retaining fresh authority/source/budget checks.
2. **CLI recall and result selection:** 1.842–2.111s total, including 595–747ms after embedding attachment and 484–517ms subsequent save/prepare time outside recall. They are the current recall costs; no old eight-second block is carried forward.
3. **Main admission/checkpoint:** 353–410ms across all four. These are protected serial spans, not justification for dropping identity, source or uncertain-cost fencing.
4. **Main dispatch to first processed text:** 463–748ms. This inclusive observed native acquisition/stream interval cannot be split into Gateway HTTP, provider inference or network from these snapshots.
5. **Protected first output:** 415.5–551.9ms from processed text to first durable completion. First visibility-check engine rows are 205.0–287.2ms and first recordOutput engine rows 169.3–239.9ms. Other visibility calls can overlap that write; do not add every child row to the path.
6. **Client protected observe/session delivery:** the final completed pairs before visible text are 378.4/390.7/490.9/514.2ms. Browser completed session/submit/observe counts before paint are 4/1/3 and 3/1/2; CLI counts are 5/1/3 each. CLI warm begins another observe before printing; begun and completed counts are preserved separately. These pair durations are client-clock evidence, already inside the visible total, not an extra server term.

There is no pre-first-output main-admission OCC retry in the two K29 CLI paths. Browser-first has a terminal-capture retry overlapping the first output on runtimeAgentExecutions, attributed by native writeSource to recordOutput; it is not demonstrated to delay first output. CLI-warm has one terminal-capture retry after first output. The other two main request paths have none in these snapshots. A function-name writeSource alone does not identify a background semantic writer/account class, and retries outside the captured main request are not disproven.

## Boundaries and retained evidence

Browser snapshot: 549 executions/208 phases/691,867 bytes. CLI snapshot: 388 executions/248 phases/560,496 bytes. Neither reaches the 1,000-execution or 16MiB cap. Exact browser newCursor equals CLI requestCursor. The saved projection preserves native executions, own-user/engine/read metadata, scalar phases, selected-input counters, model bounds and OCC metadata. Missing child native rows do not prove an unexecuted nested function. Equal Date.now mutation phase timestamps do not mean zero execution time. Native official completion timestamps are used for output, never row createdAt.

No client/server absolute-clock stitching, inferred unavailable phase, synthetic provider duration or background-memory final update is used as first-visible response time. The public-phase companion snapshot is forthcoming and outside this completed saved four-run projection. No additional profiling or service call was made.

| Artifact | SHA256 |
| --- | --- |
| `k29-cli-pair-observed-timing.json` | `e2c57ad30e402f34f45dc2a7f344d902db587af237174c2802d811d42f320bd9` |
| `k29-four-run-critical-path-readonly.json` | `294fa5bed4eaecf3ca76e6bc05a443793de25b32641852450654bd38317df5c9` |
| `k29-cli-session-v1.log` | `00b789d8bc03c1c08b6bf685aa764f52278d5f3ee76099e4f63d165f895eec64` |
| `k29-cli-session-exit-v1.json` | `147556b09f14c5114e9e5f9a3f4a95d1bb8acabf66218f6f678f0c80c0f302c9` |
| `service-log-snapshot-k29-browser-post-pair-1792019164816.json` | `c85866308f94458463ef7b0cf1da75275914882d811227d755d841ee06495947` |
| `service-log-snapshot-k29-cli-post-pair-1792019453291.json` | `b265e0842eca9379d350b795306c35884e1556a211ba28a2026043bfb0b16ef4` |
| `k28-four-run-critical-path-readonly.json` | `5395902e911384c4a72c393ee06e2e6d01d6e5cc5e45227ae9eb0421913c3afe` |
