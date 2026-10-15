Measured source `3875d3238705a90cb191abbf824d3fa3517e42e5` in the core Project-Cortex worktree. Six actual browser cases: **5/6 timing passes (83.3%)**, **4/5 correct recall-question answers (80%)**. Fast cross-chat failed both correctness and its 3 s target. Response/memory completion is 6/6; completion status does not prove answer correctness. This report performs zero service/model calls and no source edits. Current BasicCLI/native acceptance, final finance and cleanup remain outside these inputs.

Raw authority: [memory-effort-singleton-browser-summary.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-singleton-browser-summary.json), [memory-effort-singleton-quiet-metadata.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-singleton-quiet-metadata.json), and the two official snapshot receipts listed in the JSON companion. Their continuous cursor union has 1206 distinct executions and 762 projected phases; both receipts were uncapped. Each run is joined by exact run ID to Action execution ID/request ID; Gateway phases additionally use that Action plus operation key and semantic ID. Old c258/862 reports are unchanged.

| Case | Visible first text / target | Correct recall | Browser admission | Admission → DOM | DOM → paint | Retrieval / selected / depth |
|---|---:|---|---:|---:|---:|---|
| normal-seed | 3010.7 / 6000 ms PASS | seed assertion | 854.3 | 2140.7 | 15.7 | 0 ms / 0 / 0 |
| fast-recent | 2728.7 / 3000 ms PASS | yes | 1113.6 | 1589.6 | 25.5 | 0 ms / 2 / 0 |
| normal-indexed | 5492.7 / 6000 ms PASS | yes | 959.3 | 4519.4 | 14.0 | 573 ms / 6 / 1 |
| high | 7129.8 / 8000 ms PASS | yes | 785.2 | 6331.9 | 12.7 | 745 ms / 8 / 1 |
| max | 9493.8 / 30000 ms PASS | yes | 969.4 | 8505.8 | 18.6 | 1170 ms / 10 / 1 |
| fast-cross | 6923.7 / 3000 ms MISS | **NO** | 1461.0 | 5444.3 | 18.4 | 848 ms / 0 / 0 |

**Where the serial backend time is going.** “Before dispatch” below starts at the native Action’s `direct.prepare.begin` and ends at its main Gateway `stream.begin`; it excludes earlier browser admission. The recall Action span contains the embedding rows in the next table. Native child execution durations are nested within the Action. Do not add the browser, native, Gateway and child tables together.

| Case | Before dispatch | Initial direct RPC | Context-input native | Recall Action | Save/candidate native | Main admission checkpoint | Remaining before dispatch |
|---|---:|---:|---:|---:|---:|---:|---:|
| normal-seed | 851.0 | 480.0 | 0.0 | 0.0 | 0.0 | 286.0 | 85.0 |
| fast-recent | 859.0 | 447.0 | 0.0 | 0.0 | 0.0 | 325.0 | 87.0 |
| normal-indexed | 2905.0 | 179.0 | 323.5 | 1609.0 | 330.3 | 358.0 | 105.1 |
| high | 4766.0 | 302.0 | 1375.2 | 2241.0 | 365.5 | 374.0 | 108.3 |
| max | 6588.0 | 434.0 | 732.0 | 2847.0 | 808.6 | 1395.0 | 371.4 |
| fast-cross | 4463.0 | 339.0 | 611.4 | 2702.0 | 388.0 | 317.0 | 105.7 |

All times are ms. The remaining bucket includes gaps and unpartitioned Agent preparation/component work; it is not assigned to DB CPU or Gateway routing. Native mutation `Date.now()` is snapshot-fixed: the three explicit preparation stages use their recorded `durationMs`, not end-minus-begin timestamps.

| Case | Lifecycle / route / candidate stages | Selected messages / facts / memories | Input units | Gateway stream → first text | First visibility | First output execution |
|---|---|---|---:|---:|---:|---:|
| normal-seed | 11.7 / 147.0 / 61.0 | 1 / 0 / 0 | 13076 | 570 | 176 | 142.8 |
| fast-recent | 13.5 / 170.9 / 69.3 | 3 / 0 / 0 | 14410 | 447 | 208 | 192.4 |
| normal-indexed | 10.6 / 8.5 / — | 1 / 2 / 4 | 28944 | 552 | 234 | 177.9 |
| high | 21.9 / 14.1 / — | 3 / 2 / 4 | 30068 | 505 | 251 | 224.6 |
| max | 41.5 / 21.2 / — | 5 / 2 / 4 | 31204 | 566 | 307 | 348.0 |
| fast-cross | 12.4 / 11.5 / — | 1 / 0 / 0 | 13058 | 517 | 219 | 174.4 |

| Indexed case | Embedding admit | Native embed | Terminal capture | Result attach | Post-attach retrieval tail | prepareReads | readMatches + delivery |
|---|---:|---:|---:|---:|---:|---:|---:|
| normal-indexed | 326.0 | 295.0 | 222.0 | 172.0 | 575.0 | 190.8 | 374.7 |
| high | 630.0 | 327.0 | 260.0 | 250.0 | 748.0 | 248.1 | 489.4 |
| max | 635.0 | 331.0 | 386.0 | 303.0 | 1172.0 | 464.3 | 691.1 |
| fast-cross | 643.0 | 335.0 | 461.0 | 400.0 | 849.0 | 469.5 | 371.1 |

The actual external embedding work is approximately 0.30–0.34 s; governed secondary-call admission and terminal financial/result commits plus fresh retrieval are the larger surrounding chain. These are serial in [convex-dev/runtimeAgentQueryEmbedding.ts:153](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgentQueryEmbedding.ts:153) through line 171 and [convex-dev/runtimeAgentRecall.ts:205](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgentRecall.ts:205) through line 229. Capture and attach remain separately durable; combining or dropping them is not a finding of this report.

**Why the new proof did not improve these indexed cases.** All four exact runs log `context.direct.candidates.insufficient` with two candidates and no subsequent direct-traversal trace. Metadata records the same original pristine user source, `My favorite fruit is apricot.`, and two pristine v1 projections: exact favorite fruit and `User prefers apricot as their favorite fruit.` The latter is outside the finite neutral grammar at [src/domain/memory-direct-recall.ts:45](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/memory-direct-recall.ts:45)–63 and does not satisfy the literal copula rule at line 108. With two candidates, the historical singleton fallback also cannot apply (lines 22–27). The private parent therefore prepares governed semantic fallback at [convex-dev/runtimeAgent.ts:1890](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:1890)–1903. This is a matched source explanation, not evidence that broad synonym aliases or unbounded grammar changes are safe. The metadata is not a captured exact search-row result.

**Why Fast cross-chat had zero retained context.** Its 848 ms public retrieval exceeds the 750 ms server budget. The inherited retrieval origin is created *after* embedding and its capture/attach at [convex-dev/runtimeAgentQueryEmbedding.ts:169](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgentQueryEmbedding.ts:169)–171; it covers `prepareReads` → ANN → readMatches/delivery at [convex-dev/runtimeAgentRecall.ts:205](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgentRecall.ts:205)–229. The actual prepareReads/readMatches native executions were 469.5/371.1 ms. Before traversal, readMatches validates the current Agent, hydrates/binds vectors, checks vector sources, then fact sources; traversal itself checks expiry before and after source binding ([convex-dev/runtimeAgentRecall.ts:85](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgentRecall.ts:85)–143; [convex-dev/runtimeMemoryTraversal.ts:42](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryTraversal.ts:42)–83). The fact-source batch permission label is witness bookkeeping: its helper calls `getSource(sourceId)` without that requested permission; the explicit `canViewFacts` guard occurs in traversal binding. Earlier fact rows must not be described as already fact-permission-authorized. Vectors separately hydrate with `canViewMemories`. With mutation performance time advancing, that work can consume the remaining budget before a seed is accepted/selected. Actual selected/depth were 0/0. The logs do not identify the exact expiry check, so they cannot prove a particular DB getter consumed the last millisecond. Ranking-pinned late delivery at [convex-dev/runtimeMemoryServices.ts:150](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryServices.ts:150)–170 preserves **already selected** validated evidence; it does not create evidence after an empty traversal. This is a correctness failure despite complete response/memory status.

**History growth and the next structural investigation.** Normal indexed, High and Max took 5.493/7.130/9.494 s. Their candidate-fit message counts were 1/3/5, hence 0/2/4 prior history messages excluding the current user message. Displayed selected-entry totals were 6/8/10, comprising those history messages plus 2 facts and 4 memories. Input was 28,944/30,068/31,204 units; facts/memories remained 2/4. The relevant native reads grew as follows.

| Native stage | Normal docs / bytes | High docs / bytes | Max docs / bytes |
|---|---|---|---|
| contextInputs | 131 / 204,902 | 309 / 632,440 | 484 / 1,047,057 |
| prepareReads | 50 / 72,324 | 81 / 143,889 | 109 / 205,274 |
| readMatchesAndDelivery | 283 / 803,282 | 340 / 1,012,144 | 392 / 1,215,009 |
| saveAndPrepare | 143 / 398,403 | 257 / 674,026 | 371 / 948,499 |
| mainAdmission | 122 / 438,989 | 194 / 609,038 | 266 / 778,225 |

This is not isolated depth scaling: effort, history and ambient service timing changed together. High contextInputs was 1375 ms versus Max 732 ms, and Max main admission was 1395 ms; row count alone does not explain that variance. No OCC retry is present on these named execution rows. Official execution/user-execution fields do not establish DB CPU, network or queueing splits.

The significant source pattern is repeated **full transcript hydration and source checks inside one native preparation**, followed by another full pass in each fresh native boundary. On the ordinary uncompleted path, saveAndPrepare invokes at least eight `executionContext` calls: save; initial prepare; completed-step lookup; two resolutions; post-selection reload; begin operation; start operation ([convex-dev/runtimeAgent.ts:1908](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:1908)–1951, [convex-dev/runtimeAgent.ts:2134](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:2134)–2171, lines 227–230 and 782–839). Each enters selected-cutoff hydration, then two ordered history passes (`hydratePrivateCutoff` first calls `hydrateCutoff`): [convex-dev/runtimeTranscript.ts:431](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeTranscript.ts:431)–505. Owner-run source witnesses and media/artifact predicates are revisited for history rows. This is concrete repeated logical work. Existing bounded native message/bridge/metadata raw readers already avoid some physical duplicates; it would be false to multiply all logical passes into physical reads.

A bounded next candidate is a private native helper composition that passes original immutable selected-row batches/current projections between these local preparation helpers while preserving every ordered predicate and write invalidation. No cross-RPC authority/finance verdict may be retained: [convex-dev/runtimeAuth.ts:128](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAuth.ts:128)–147 and 268–274 restrict the scope to the same native owner; lines 370–421 handle writers. Fresh source/delivery fences at [convex-dev/runtimeAgentRecall.ts:175](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgentRecall.ts:175)–200 remain independent. This analysis does **not** prove a safe elimination or a savings amount; actual per-helper read attribution is missing. It is a structural investigation target, beyond adding one more wording alias.

**Client delivery remains visible but overlaps backend work.** The table shows actual submit-envelope RPC and its independent post-I/O session, then the last observe/session RPC before first paint. These are actual client intervals, not server CPU. Profile requests and additional sessions overlap; they are listed individually in the JSON, never added as critical-path totals.

| Case | Submit envelope | Fresh post-submit session | Other admission | Last observe | Following session |
|---|---:|---:|---:|---:|---:|
| normal-seed | 602.2 | 243.7 | 8.4 | 198.9 | 175.6 |
| fast-recent | 713.2 | 394.4 | 6.0 | 186.8 | 169.1 |
| normal-indexed | 668.0 | 283.4 | 7.9 | 264.9 | 310.4 |
| high | 581.3 | 197.1 | 6.8 | 338.7 | 309.6 |
| max | 770.4 | 191.2 | 7.8 | 323.9 | 197.9 |
| fast-cross | 951.7 | 501.2 | 8.1 | 221.0 | 224.1 |

Fresh post-I/O sessions are explicit at [src/client-runtime/client.ts:260](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/client-runtime/client.ts:260)–284 and enforce current scope/principal before delivery. They must remain. The remaining native first-text path has Gateway visibility before output enqueue, then durable output, then client observation/session and DOM paint. First visibility alone cost 176–307 ms in these samples; it cannot be folded after publication without changing the safety order. No native-to-browser synchronized monotonic clock or exact RPC correlation joins exist, so a transport/observer/UI remainder is not split into invented categories.

**Practical ranking.** First, the actual literal-proof miss keeps the entire governed semantic route on every indexed question. Second, repeated transcript/source processing plus additional fresh native handoffs grow with history and dominate the preparation path; preserve currentness and billable-call boundaries while measuring that work. Third, serial authenticated client delivery and first-output publication add smaller visible costs. The main Gateway stream itself reached first text in 447–570 ms and therefore is not the multi-second regression in this window. Provider/Gateway-internal routing remains opaque. No controlled source comparison, current CLI/native acceptance, final budget or cleanup claim is made here.

JSON evidence: [memory-effort-singleton-full-chain.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-singleton-full-chain.json). Original inputs were hashed before and after analysis and remain unchanged.
