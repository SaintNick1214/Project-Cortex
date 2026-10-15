# Current control delay chains

Source `ef094fc5f724a25470d5da0d74f287b638e83bf0`, session `d3c6dc04-af66-4894-acd4-bb75bf3d544b`, target calm-snake-661 (6192965). 3/5 available numerical browser cases meet their original targets. The single seed is functional-only/untimed and excluded from that denominator. 6 exact native chains are currently joined; later official snapshots stay pending. CLI, Chat and tools remain separate.

| Case | Visible/target ms | Result | Browser admission | Before main | Initial prepare RPC/native | Route/candidate stage | Main checkpoint | Provider first text | First visibility | First output native |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
|normal-seed|—/—|UNTIMED/PENDING|—|857.0|459.0/441.5|141.4/59.7|296.0|483.0|184.0|179.5|
|fast-recent|3312.6/3000.0|MISS|840.6|958.0|528.0/516.8|162.4/67.7|309.0|565.0|206.0|183.6|
|normal-indexed|3661.7/6000.0|PASS|773.1|1292.0|226.0/219.5|9.4/—|276.0|514.0|197.0|194.4|
|high|3776.0/8000.0|PASS|1082.3|1174.0|237.0/225.6|10.2/—|250.0|514.0|182.0|257.0|
|max|3661.6/30000.0|PASS|880.9|1599.0|209.0/202.2|12.7/—|465.0|454.0|226.0|206.8|
|fast-cross|3310.5/3000.0|MISS|774.3|1311.0|213.0/203.3|9.4/—|417.0|470.0|164.0|129.5|
|cli-normal-1|7294.3/6000.0|MISS|—|4135.0|168.0/154.4|9.9/—|1096.0|490.0|260.0|240.3|
|cli-normal-2|6330.5/6000.0|MISS|—|3547.0|178.0/160.6|10.9/—|414.0|742.0|259.0|274.8|

The JSON preserves exact run→Action execution→request child joins and Gateway semantic/run-budget identities. Seed has no frontend time; its native chain is backend evidence only. Targets are the original scenario targets, not new thresholds.

## Available cloud attribution

normal-seed: before main dispatch 857.0ms; initial preparation native 441.5ms (280.3ms reported user execution), contextInputs —ms, save/candidate —ms. Main checkpoint 296.0ms; provider first text 483.0ms; first visibility 184.0ms and native first output 179.5ms. No embedding.query phase occurs in this exact Action. These intervals do not establish a different QA scope used a direct route.

Against source 07f669e same-labelled observation: native initial prepare 425.5→441.5ms; before-main delta 80.0ms; frontend delta —ms. This is descriptive: history/context/input/reply/network and ambient service work differ. Read-count improvements are not a causal clock decomposition.

fast-recent: before main dispatch 958.0ms; initial preparation native 516.8ms (321.8ms reported user execution), contextInputs —ms, save/candidate —ms. Main checkpoint 309.0ms; provider first text 565.0ms; first visibility 206.0ms and native first output 183.6ms. No embedding.query phase occurs in this exact Action. These intervals do not establish a different QA scope used a direct route.

Against source 07f669e same-labelled observation: native initial prepare 901.8→516.8ms; before-main delta -332.0ms; frontend delta -50.3ms. This is descriptive: history/context/input/reply/network and ambient service work differ. Read-count improvements are not a causal clock decomposition.

normal-indexed: before main dispatch 1292.0ms; initial preparation native 219.5ms (104.3ms reported user execution), contextInputs 410.3ms, save/candidate 267.2ms. Main checkpoint 276.0ms; provider first text 514.0ms; first visibility 197.0ms and native first output 194.4ms. No embedding.query phase occurs in this exact Action. These intervals do not establish a different QA scope used a direct route.

Against source 07f669e same-labelled observation: native initial prepare 148.6→219.5ms; before-main delta 181.0ms; frontend delta -32.8ms. This is descriptive: history/context/input/reply/network and ambient service work differ. Read-count improvements are not a causal clock decomposition.

high: before main dispatch 1174.0ms; initial preparation native 225.6ms (158.3ms reported user execution), contextInputs 337.4ms, save/candidate 251.6ms. Main checkpoint 250.0ms; provider first text 514.0ms; first visibility 182.0ms and native first output 257.0ms. No embedding.query phase occurs in this exact Action. These intervals do not establish a different QA scope used a direct route.

Against source 07f669e same-labelled observation: native initial prepare 261.2→225.6ms; before-main delta -196.0ms; frontend delta -34.9ms. This is descriptive: history/context/input/reply/network and ambient service work differ. Read-count improvements are not a causal clock decomposition.

max: before main dispatch 1599.0ms; initial preparation native 202.2ms (122.5ms reported user execution), contextInputs 510.7ms, save/candidate 301.8ms. Main checkpoint 465.0ms; provider first text 454.0ms; first visibility 226.0ms and native first output 206.8ms. No embedding.query phase occurs in this exact Action. These intervals do not establish a different QA scope used a direct route.

Against source 07f669e same-labelled observation: native initial prepare 307.9→202.2ms; before-main delta 64.0ms; frontend delta -349.2ms. This is descriptive: history/context/input/reply/network and ambient service work differ. Read-count improvements are not a causal clock decomposition.

fast-cross: before main dispatch 1311.0ms; initial preparation native 203.3ms (105.5ms reported user execution), contextInputs 346.4ms, save/candidate 218.8ms. Main checkpoint 417.0ms; provider first text 470.0ms; first visibility 164.0ms and native first output 129.5ms. No embedding.query phase occurs in this exact Action. These intervals do not establish a different QA scope used a direct route.

Against source 07f669e same-labelled observation: native initial prepare 192.6→203.3ms; before-main delta 133.0ms; frontend delta -666.1ms. This is descriptive: history/context/input/reply/network and ambient service work differ. Read-count improvements are not a causal clock decomposition.

cli-normal-1: before main dispatch 4135.0ms; initial preparation native 154.4ms (93.7ms reported user execution), contextInputs 315.5ms, save/candidate 375.0ms. Main checkpoint 1096.0ms; provider first text 490.0ms; first visibility 260.0ms and native first output 240.3ms. A genuine governed query embedding is present.

Against source 07f669e same-labelled observation: native initial prepare 205.7→154.4ms; before-main delta 251.0ms; frontend delta -112.2ms. This is descriptive: history/context/input/reply/network and ambient service work differ. Read-count improvements are not a causal clock decomposition.

cli-normal-2: before main dispatch 3547.0ms; initial preparation native 160.6ms (97.9ms reported user execution), contextInputs 389.8ms, save/candidate 377.0ms. Main checkpoint 414.0ms; provider first text 742.0ms; first visibility 259.0ms and native first output 274.8ms. A genuine governed query embedding is present.

Against source 07f669e same-labelled observation: native initial prepare 184.0→160.6ms; before-main delta -231.0ms; frontend delta -147.3ms. This is descriptive: history/context/input/reply/network and ambient service work differ. Read-count improvements are not a causal clock decomposition.

## Client delivery and fresh guards

fast-recent: submit envelope 609.9ms, post-admission fresh session 222.8ms; last completed observe before visible 205.2ms followed by fresh session 356.2ms. Wake→observe gaps: 0.6/3.3/0.5/1.4ms. Pending wakes can arrive during an in-flight read/session; they do not show a polling timer.

normal-indexed: submit envelope 549.1ms, post-admission fresh session 217.8ms; last completed observe before visible 210.9ms followed by fresh session 291.5ms. Wake→observe gaps: 0.3/0.4/0.4/1.9ms. Pending wakes can arrive during an in-flight read/session; they do not show a polling timer.

high: submit envelope 867.9ms, post-admission fresh session 205.7ms; last completed observe before visible 308.5ms followed by fresh session 188.3ms. Wake→observe gaps: 0.5/0.5/0.3/3.7ms. Pending wakes can arrive during an in-flight read/session; they do not show a polling timer.

max: submit envelope 639.5ms, post-admission fresh session 235.0ms; last completed observe before visible 203.7ms followed by fresh session 181.2ms. Wake→observe gaps: 0.5/0.4/0.5ms. Pending wakes can arrive during an in-flight read/session; they do not show a polling timer.

fast-cross: submit envelope 540.9ms, post-admission fresh session 226.4ms; last completed observe before visible 267.9ms followed by fresh session 178.0ms. Wake→observe gaps: 0.3/0.7/1.0/31.5ms. Pending wakes can arrive during an in-flight read/session; they do not show a polling timer.

cli-normal-1: submit envelope 532.8ms, post-admission fresh session 190.8ms; last completed observe before visible 272.7ms followed by fresh session 183.6ms. Wake→observe gaps: 1.1/0.4/0.4ms. Pending wakes can arrive during an in-flight read/session; they do not show a polling timer.

cli-normal-2: submit envelope 498.4ms, post-admission fresh session 198.2ms; last completed observe before visible 267.2ms followed by fresh session 256.0ms. Wake→observe gaps: 0.2/0.1/0.5/1.7ms. Pending wakes can arrive during an in-flight read/session; they do not show a polling timer.

## CLI semantic fallback evidence

Receipt memory-effort-control-cli-iris-1792064219011.json: CLI_PAIR_FUNCTIONAL_PASS_NORMAL_TIMING_MISS, exit {"exitCode":0,"signal":null,"endedAt":"2026-10-15T11:37:36.946Z","source":"Direct docker child close event; no pipeline or tee"}, clientsClosed true. Canonical seed: `My favorite flower is iris. Acknowledge it in one brief sentence.`; canonical warm input: `What is my favorite flower?`.

cli-normal-1: context.direct.candidates.insufficient(facts=1). Selected evidence {"memory":6,"fact":1,"pending":0,"history":0}, selected input units 30612. Query embedding: admission 315.0ms, native 405.0ms, capture 243.0ms, attach 180.0ms; whole recall Action 2010.0ms. The broader semantic evidence/history differs from browser singleton direct lookup.

cli-normal-2: context.direct.candidates.insufficient(facts=2). Selected evidence {"memory":5,"fact":2,"pending":0,"history":0}, selected input units 30924. Query embedding: admission 345.0ms, native 442.0ms, capture 179.0ms, attach 188.0ms; whole recall Action 2082.0ms. The broader semantic evidence/history differs from browser singleton direct lookup.

The instruction suffix in the exact approved canonical seed is confirmed locally. A direct-source grammar rejection caused by that suffix is a hypothesis only: selected fact text/lineage and an exact proof-rejection reason are absent from these saved CLI/scalar receipts. Recorded insufficient candidates must not be relabelled as a specific rejection code or justify stripping instructions, changing the old case, or expanding the closed proof grammar.

Root source diagnosis: no programmed polling; the next idle observation follows watcher wake promptly. Each post-envelope session is an independent generation/actor/scope/expiry/revocation guard. Neither dropping it nor fusing it into an earlier protected read is selected.

## Next safe source decision

NO_ADDITIONAL_BEHAVIOR_CHANGE_SELECTED_FROM_CURRENT_SCALAR_TIMINGS. Remaining contextInputs/save-candidate and first publication/admission spans are concretely observed. Existing span timers do not isolate pure transforms, DB/official component work or immutable parsing. A narrow per-transform measurement inside those existing native stages is the safe next diagnostic; no authorization/cancellation/currentness/session boundary is removed. Hosted benefit is unmeasured. The earlier first-publication fusion is not revived: a pre-emit append changes post-visibility-ACK abort/effect ordering. Current scalar spans support a focused diagnostic of remaining stage work, not another authority bypass or a promised millisecond saving.

## Qualification and limits

Current native qualification: PASS, 654 checks; 12 actual operations, 1200000 conservative UNKNOWN units, 4 actual public query embeddings. These results are separate from browser SLOs and old native663/651.

- Seed was submitted without frontend timing, never replayed; backend durations do not reconstruct a first-paint SLO.
- Action/server wall at, native executionTime/userExecutionTime, per-stage performance durations, client monotonic atMs and browser elapsedMs retain distinct clocks. Convex mutation Date.now is fixed per transaction: zero phase delta is not zero traversal/native execution.
- Original browser .ax.txt files are diff-only saves; no full accessibility-tree inspection is claimed from them. Root saved genuine CUA states/screenshots and separate full Fast-cross evidence; native final readback remains separate.
- Native stages are nested; published component/visibility/output durations are not additive with parent spans or client total.
- ExecutionTime minus reported userExecutionTime is unclassified runtime/DB/scheduling/component time, not exclusive CPU/network.
- Snapshot union is one verified cursor chain; missing later cases stay pending. No polling/repeated large-file wait is performed.
- OCC/late completion rows are retained but cannot explain first-answer delay unless their exact interval is before that answer.
- No fine-grained per-transform profile or client RPC→server execution bridge exists. No causal source attribution or predicted latency reduction is claimed.

Input hashes record the exact saved bytes read once in this pass; no globally atomic snapshot is claimed. No services/models/private/Proofs/source/Git/test operations occurred. CLI/Chat/tool snapshots and remaining browser completion are incorporated only after Root supplies their completion message.
