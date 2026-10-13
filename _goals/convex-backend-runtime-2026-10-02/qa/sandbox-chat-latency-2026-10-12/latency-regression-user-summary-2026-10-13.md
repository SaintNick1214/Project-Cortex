# What changed in the measured Cortex response path

The affected backend/SDK repository is SaintNick1214/Project-Cortex. Canonical website work belongs to the separate SaintNick1214/cortexmemory.dev repository. GitHub access is unavailable; repository visibility is not inferred.

The new backend runtime added serial admission/claim, Workflow scheduling, pending/indexed-context proof, per-call model preparation/resolution/admission/checkpoint and protected output/delivery work. Those operations repeatedly validate authority, transcript/source, profiles, qualifications and budgets. The currently measured implementation is the unreleased0.39 candidate8917f3250; published0.35 and0.37 legacy recall retain the same four awaited expressions and parallel vector/fact reads. This identifies the changed execution path but does not reconstruct an exact same-environment0.35→0.37 historical benchmark or dismiss the reported near-instant historical workload.

| K14 actual canonical measurement | First | Warm |
| --- | ---: | ---: |
| Browser submission→visible after paint | 7.84s | 8.93s |
| Basic CLI submission→first stdout acknowledgement | 12.84s | 15.01s |
| Native run creation→model Action entry, browser | 3.90s | 5.40s |
| Native run creation→model Action entry, CLI | 7.66s | 9.87s |
| Protected model preparation, CLI | 2.54s | 2.54s |
| Processed first answer acquisition, CLI | 0.509s | 0.506s |

CLI recall envelopes were3.714/6.081s; query embedding acquisition within them was0.316/0.340s. The remainder is governed retrieval/ledger/profile/source/delivery work, not pure vector lookup. The warm browser model acquisition was0.519s; the first browser early Gateway markers are unavailable because the original native log cap omitted them. Client and server clocks are separate, and nested envelopes are not added again.

The current response path is overbuilt before inference. Source validation batching alone cannot meet one second: empty browser context still takes multiple seconds before model execution. The next bounded repair consolidates ordinary context/model orchestration and original native guard handlers into fewer durable handoffs, while retaining strict barriers, tools/approvals, current authorization, budget/accounting, canonical transcript and replay protection. It is in progress and has no source or runtime acceptance yet.

All four K14 replies completed; all four failed the1,000ms target. One native proof passed attributed facts, matching vectors, complete usage, current authority/source/profile provenance and contiguous indexing through8/8. All accounting slots were released, and fresh cleanup verified the disposable cloud database and Docker container absent. Overall latency follow-up remains2/4=50%; final acceptance remains incomplete.

Detailed evidence: [K14 delay chain](cloud-k14-delay-chain.md), [installed outcomes](k14-outcomes.md), [published-version comparison and historical limits](version-regression-measured-k12-supplement.md). Local QA commitc47c1fd3e preserves the current results and failures; GitHub push/PR delivery is unavailable.
