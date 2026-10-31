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


## K15 measured V5 continuation

The independently accepted V5 consolidation was packaged and installed at source `2c8689fac3`. It still failed all four latency samples: browser 7.499/6.9801 seconds, CLI 12.8364/14.6495 seconds. All four replies completed, the bounded native facts/vector/current-authority/provenance/usage proof passed 8/8 events, slots were released, and fresh cleanup verified ABSENT. Source acceptance is separate from SLO acceptance.

The early browser snapshot retains the empty/represented route: neither browser turn performed indexed recall or query embedding. Run creation to dispatch took 5.449/5.010 seconds, before 488/593 ms first-text acquisition. Preparation took 2.288/2.246 seconds; admission/checkpoint took 1.033/1.039 seconds. Each included one OCC retry; the exact conflicting rows are unavailable. In source, one private hydration reads identical official Agent message IDs twice without a writer between reads; empty preparation repeats nine hydrations. The next bounded batch reduces those raw reads within one native snapshot, invalidates them on all writes and reruns every original predicate. It has no acceptance or speed claim yet.

CLI context recall spans were 5.367/6.417 seconds. The detailed model, ledger, provenance and delivery breakdown is being completed from saved receipts. The published-version comparison and the reported near-instant historical workload remain separate evidence. Latency follow-up remains 50%; full completion is unapproved.
