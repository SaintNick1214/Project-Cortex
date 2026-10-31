# c258 CLI latency chain — two retained Normal misses

Actual first printed-answer acknowledgements were **7807.054ms /6682.274ms**, both above6000ms; both functional outcomes and async memory passed. This is the installed Basic CLI's same-command monotonic `submit.begin→answer.first_printed` clock. Docker/npm/tsx startup, prior `/new`, later history/readiness and full-memory completion are excluded. It measures stdout acknowledgement, not terminal pixels.

| Observed span | First compound iris seed | Warm iris question |
|---|---:|---:|
| Initial auth when present |365.275ms|No new auth event|
| Initial fresh-session RPC |324.981ms|172.162ms|
| Submit/start envelope RPC |729.815ms|455.252ms|
| Post-admission fresh-session RPC |213.245ms|168.283ms|
| **Native direct preparation start→main Gateway dispatch** |**4038ms**|**4204ms**|
| Native initial preparation envelope |436ms|193ms|
| Native initial context/direct gate envelope |440ms|485ms|
| **Whole governed semantic recall** |**2281ms**|**2568ms**|
| ↳ Query embedding admit/checkpoint; capture; attach |412;411;212ms|732;203;217ms|
| ↳ Actual Gateway query embedding invocation |247ms|307ms|
| ↳ Embedding attach end→recall end |977ms|1092ms|
| Native post-recall save/fit/handoff |389ms|464ms|
| Main setup/admit envelope before dispatch |492ms|494ms|
| ↳ Main admit/checkpoint |407ms|412ms|
| **Main Gateway dispatch→first text** |**496ms**|**470ms**|
| First visibility ledger call |268ms|309ms|
| First recordOutput native execution |232.416ms|249.449ms|
| Last completed observe RPC before stdout |816.411ms|303.654ms|
| Following fresh-session RPC before stdout |203.156ms|226.598ms|

**Rows are nested or on different clocks; do not sum this table.** The five native pre-main envelope rows form the4038/4204ms server Action partition. The entire query embedding/ledger/retrieval sequence is already inside recall. Native child execution times overlap parent Action spans; the public traversal duration975/1091ms covers only part of whole recall. Both Action parent request IDs and execution IDs are joined through exact run traces, not proximity. Client RPCs have their own monotonic rpcIds, with no exact native execution identifier bridge. Gateway first-text timing cannot split internal routing, transit and external-provider queue/compute.

Five completed fresh-session RPCs precede each first print. The last completed observation is followed by a203.156/226.598ms fresh session and then0.984/1.192ms to stdout acknowledgement. In the warm case a subsequent observe RPC has already begun before that write callback, so it is retained as open, not counted as another completed pre-answer fetch. Client waiting after the first post-admission session is6154.334/5884.661ms; this contains concurrent server work and later delivery RPCs and is not assigned to DB CPU or network.

The main measured opportunity remains the governed semantic path and its serial durable operations. Both direct gates reported `context.direct.candidates.insufficient` (1/2 candidate facts), so query embedding and semantic traversal ran. Main Gateway first text is under0.5s. Reducing unnecessary semantic fallback for **proven** direct propositions is grounded by this trace. The new literal-proof fix only joins projections of one immutable source/lineage. It does not prove mixed sources. The later five-fact census contains three apricot projections on one lineage, a separate iris favorite-flower source and a still-later fox favorite-animal source. The CLI trace records candidate counts1/2 but no returned IDs/propositions: a shared full-text “favorite” match is a hypothesis, not established query membership. **Do not claim that the fix resolves either iris CLI turn**, especially the compound seed, or predicts a saving. Fresh-session/delivery work is another observed cost whose authority checks must be preserved.

Run IDs: `run:c377ac0356544095c08ab634208d46adbf61cf65af2e15f58bf61600f13f32f7` and `run:5b489b08844c5e0d6fbf2b419a35103a79908794f507cf6c3376a910164f9d8f`. Exact raw joins, timing partitions, native child references, input counts and remaining unknowns are in [the JSON analysis](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-budget-cli-chain.json). The official incremental receipt contains554 executions/256 phases without a cap hit. All four consulted input files remained byte-identical. No service/model calls, source edits, builds or reviews occurred; the target was already deleted.
