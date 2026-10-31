# Fast recent critical path

Run `run:e3f217047a639a6fddc52da5f26d3a4fccde68d2a36570acb9dc8a667f72f6e7`, source `9973b498e5d076457367b285858729917830e51a`, session `50567f65-1574-42bd-8941-00cd1c1ed581`. Actual first paint **3156.6ms: 156.6ms over 3000ms**. Admission delivery was1001.5ms; admission→paint2155.1ms. This is an unchanged failure, with no inference or live collection by this analysis.

All four official snapshots form a cursor chain, none capped. The first three contain no scalar phases for this run; the post-pair receipt contains it. Submission joins by execution `7bd4b2fd…`/request `60dc5b8daa9790be`; preparation and main Gateway phases join Action execution `b713794e…`/request `7492a4c7f31fbb4a` and budget `ca4bb07c…`. Detailed exact records/hashes are in the JSON companion.

The browser admission chain is submit-envelope RPC821.2ms → fresh post-session170.5ms →9.8ms other local elapsed =1001.5ms. It then runs two observation/post-session rounds before text. Those rounds overlap server preparation/model work. The text-bearing observation RPC48 is203.9ms, followed by fresh sessionRPC49 at183.3ms; start-to-session-end is387.9ms. DOM commit is3106.8ms; after-paint adds49.8ms. Console ISO logging is a coarse join only: do not use its asynchronous timestamps to infer exact browser/server clock offsets.

One disjoint server chronology follows. Times are reported seconds within1792042110–2113; native completion timestamps and Action phase times form this chronology, not a sum added to browser elapsed:

| Interval | Reported span |
|---|---:|
| Native submit begin0.799→completion1.422659 |623.7ms wall;605.2ms execution |
| Completion→direct.prepare.begin1.529 |106.3ms |
| Direct prepare1.529→2.019 |490ms awaited;476.6ms native execution |
| Prepare end→admit/checkpoint begin2.118 |99ms; official message/stream setup also occurs here |
| Admit/checkpoint2.118→2.440 |322ms awaited;305.1ms native execution |
| Dispatch boundary→first native text2.924 |4ms setup+480ms governed stream boundary |
| First text→visibility completion3.142 |218ms awaited;211.3ms native execution |
| Visibility end→first recordOutput completion3.304544 |162.5ms;recordOutput150.9ms execution |
| Output completion→signal completion3.413005 |108.5ms;signal103.9ms execution |
| Signal completion→text observation start3.516 |103.0ms including intervening client/network scheduling |
| Text observation3.516→completion3.617319 |101.3ms wall;95.8ms execution |
| Observation completion→post-session start3.704 |86.7ms including client boundary |
| Post-session3.704→completion3.801736 |97.7ms wall;90.2ms execution |

These service milestones span3002.7ms. They are **not** an independent SLO measurement or a decomposition to subtract from3156.6ms. Backend mutation phase `Date.now` is fixed; native execution timings and measured spans are used instead. Later markVisible calls, stream component writes and later output publication overlap the above first-text delivery; the full4351.3ms Action includes later generation/finalization. Never add them all. The Gateway480ms boundary does not expose a separate provider/network/internal split.

The main path selects3 canonical messages,0 indexed memory,0 fact,0 pending,0 context bytes, qualified input14518/32768. The indexed availability probe remains and preparation returns the prepared model without external recall/query embedding. Neither direct fact eligibility nor query-vector reuse can reduce this sample.

The largest measured native calls are submit605.2ms/138docs/159782bytes; prepare476.6ms/234docs/488348bytes; fresh admission305.1ms/106docs/301698bytes. Submit's measured250.3ms submit,67.9ms start and3.9ms get leave283.1ms parent time unattributed; claim43.1ms is inside start. These aggregate counters do not identify tables, duplicate call sites, raw-reader hits or a CPU/database split. First visibility211.3ms/45docs/121473bytes and output150.9ms/32docs/40674bytes precede the guarded delivery chain.

The smallest source-supported change is `runs.ts`'s `runById` raw lookup. It currently repeats the exact `runtimeRuns.by_scoped_id(...).take(2)` DB query on every `currentControlRun`/`activeAttempt`. The existing `readManagedSourceRunRows` already implements that same query with bounded invocation-local raw-row reuse. Its run family is evicted by every known `runtimeRuns` write; unknown/component/failed writers clear it, and unscoped callers keep the original direct query. Routing this single raw lookup through that helper preserves duplicate/absence ordering, every tombstone/ownership/authority/conversation-epoch predicate, every admission/visibility/financial commit, and every SDK transport/session fence. It does not cache `executionContext` or permission decisions and needs no new cache protocol/version.

This targets the repeated row work in actual preparation/admission, with focused counter/read-after-write/revocation tests needed before any measurement. The existing aggregate logs cannot quantify how much belongs to that lookup. **Whether it saves156.6ms is unknown.** Keep the full canonical context and all current source/financial guards. Dropping post-session, coalescing visibility permissions across invocations or declaring pure conversion the cause is not supported by this receipt. No product edits were made for this analysis.
