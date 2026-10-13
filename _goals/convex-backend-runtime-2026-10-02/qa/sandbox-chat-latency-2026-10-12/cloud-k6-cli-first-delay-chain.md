# K6 first canonical CLI delay chain

Read-only saved-evidence analysis, 2026-10-13; no source/P/service/test/Git operation. This is not an acceptance gate.

The first canonical Basic 1.4.1 hosted reply completed. Submit → stdout write acknowledgement was **9349.773 ms**; under one second remains unachieved. This boundary is separate from browser paint. The first submit/printed events match the open raw transcript; later appended commands are excluded.

| Disjoint server partition from run creation | Duration ms |
| --- | ---: |
| Initial inline Workflow step | 1496.000 |
| Initial step → context action entry | 738.005 |
| Context action → context journal completion | 924.995 |
| Context journal completion → model journal start | 403.000 |
| Model journal start → model action entry | 325.995 |
| Model preparation → native Gateway stream request | **2449.005** |
| Gateway stream request → first processed text | 568.000 |
| First processed text → first recordOutput completion-log proxy | 446.312 |

The server total to that first completed-write proxy is **7351.312 ms**. The exact storage visibility instant is not supplied; this is not a client delivery timestamp. Mutation clocks are fixed: zero claim/index-probe timestamp differences do not mean zero work. Native combined admission execution was1178.389ms (userExecutionTime143.908ms), contained within the initial partition. Context action execution was924.609ms, containing contextInputs495.687ms and saveContext361.389ms. Do not add those nested values again.

Model preparation is the largest remaining owned partition. Its actual admit trace476ms, binding160.216ms, fresh post-binding original hydration141.448ms and checkpoint trace496ms occupy the1289ms admit-begin→native-request span. Initial resolve182ms and constructor's cached second resolve2ms are distinct; removing the first merely moves the required miss. Cached repeated hydration costs are tiny; original action tuple binding is still mandatory.

The Gateway's568ms to first processed text includes service-token, transport, routing/queuing and model work with no supplied internal separation. Ready/first-part were509/510ms. This single call proves neither pure model latency nor a universal external floor. First visibility245ms precedes output recording188.759ms; later visibility/terminal work overlaps the first write and cannot be charged serially to first durability. Background title starts after this path.

On the CLI clock,1226.026ms elapsed before combined admission began: auth389.006ms, the additional Basic outer initial session510.545ms and SDK pre-session301.537ms plus local gaps. Combined admission RPC was1288.828ms; SDK post-session170.580ms. Seven separate pre-session→observe→post-session groups completed before stdout, spanning636.007,529.317,580.750,579.502,677.380,562.347 and581.331ms. They overlap backend execution/waiting and are not another additive server delay. Trace carries no payload ownership, so the final group cannot be asserted to be the earliest group that could have printed a delta.

The final delivery group was **185.432ms pre-session +203.355ms observe +192.314ms post-session**; stdout acknowledgement followed its last post-session by0.831ms. The outer Basic final session RPC26 had begun0.260ms before that acknowledgement but had no completed duration in the cutoff: do not assign it a blocking delay. There were17 completed session RPCs, seven observe RPCs and one admission RPC; their aggregate RPC busy time is not the submission SLO.

Prioritize the existing safe candidates from `next-cloud-latency-findings.md`: (1) compose original Agent prepare/admit/bind/checkpoint handlers while preserving every fresh guard and UNKNOWN/replay rule; the2449ms preparation/1289ms containing segment is not promised savings; (2) fuse context plus first model into a versioned Workflow action, targeting the measured **728.995ms** journal/dispatch boundary while retaining strict barrier, durable save and crash recovery; (3) combine observer pre-session with observe while keeping a fresh post-session, targeting one185.432ms boundary in the final group. A smaller Basic wrapper cleanup could address the extra510.545ms initial session after proving equivalent scope/generation checks. Do not blindly remove final checks, action hydration or switch startAsync:false; prior callback-identity ordering concerns remain.

Client/server absolute clocks were not subtracted, and K6 CLI is not causally compared with K4 browser timings. Ordinary memory provenance/readiness and the helper's erroneous embedding output-token expectation are separate; the false original record remains preserved. Exact metadata, correlations and input hashes are in `cloud-k6-cli-first-delay-chain.json`.
