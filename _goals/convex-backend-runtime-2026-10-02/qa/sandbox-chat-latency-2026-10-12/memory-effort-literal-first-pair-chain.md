# Literal candidate first browser pair — actual chain

Source `86238bcc154ae8e2c58fe0171590d562058f379d`. Normal empty seed **3293.1ms passes6s**. Fast recent-context **3096.4ms misses3s by96.4ms**, with correct apricot answer. Both responses and asynchronous memory completed. This report uses the two exact runs only; Root continues later modes separately.

| Measured interval | Normal seed | Fast recent |
|---|---:|---:|
| Browser admission delivered |1026.0ms|1265.8ms|
| ↳ Client submit/start envelope |656.3ms|950.9ms|
| ↳ Independent post-admission session |362.4ms|307.0ms|
| Browser admission→first DOM commit |2251.8ms|1813.7ms|
| DOM commit→after-paint |15.3ms|16.9ms|
| Native prepare await from Action trace |436ms|528ms|
| Native prepare execution |418.463ms|510.228ms|
| ↳ Context lifecycle stage |10.8ms|13.0ms|
| ↳ Context route stage |162.6ms|178.1ms|
| ↳ Model candidate stage |63.0ms|64.5ms|
| ↳ Untraced native preparation remainder |182.063ms|254.628ms|
| Native first Action trace→main Gateway dispatch |926ms|954ms|
| Main admit/checkpoint |366ms|303ms|
| Gateway stream dispatch→first text |599ms|450ms|
| First visibility ledger RPC |228ms|204ms|
| First recordOutput native execution |190.097ms|181.851ms|
| Last client observation RPC before first paint |221.4ms|184.9ms|
| Following independent session |178.2ms|175.9ms|

**Do not sum nested rows or different clocks.** Browser admission→DOM→paint is one additive partition. Native three preparation stage performance spans are sequential and total236.4/255.6ms; subtracting from native execution leaves182.063/254.628ms untraced, including entry checks/gaps/native overhead. The remainder is not isolated DB CPU or wholly initial hydration. Mutation `Date.now` stays fixed, so all stage UTC begin/end pairs being equal does not mean0ms; the new recorded `durationMs` values are used. Official Action-start metadata precedes its first trace by117.559/254.947ms, another unallocated interval rather than a proven module-init span.

No query embedding or semantic recall appears in either exact Action. Normal uses one mandatory message; Fast uses three canonical messages, including two retained history entries. The new literal proof did not run this path. Gateway-internal routing, provider compute/queue and transit remain opaque;599/450ms is their combined invocation-to-first-text boundary.

The native preparation child reads163/209 documents and245888/352636bytes. V8 scope starts at [runtimeAgent.ts2217](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:2217); stage bodies are at [2226](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:2226), [2232](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:2232), [2236](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:2236). [runtimeAuth.ts271](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAuth.ts:271) shares bounded raw authority/metadata/transcript/source rows only within its native owner; [writer retention](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAuth.ts:361) does not cache mutable accounting. Direct execution/operation queries remain at [runtimeAgent.ts127](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:127) and [133](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:133); active-attempt/outbox checks remain at [runs.ts297](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runs.ts:297). These source call families are identifiable, but actual per-family duplicate counts/time are not in the log. Independent admission/output RPCs and client post-I/O session fences remain fresh; no global/time-based permit cache is justified.

The first-publication seam is a grounded **candidate to investigate, not an approved change or saving**: visibility228/204ms is followed by first recordOutput190/182ms. It is not a drop-in two-handler composition. Gateway awaits visibility **before** emitting the chunk ([runtimeGateway.ts1026](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeGateway.ts:1026)); the later Agent callback projects/flushed output at [runtimeAgent.ts1139](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:1139). The current visibility request has no delta/sequence, both bodies are inline registered mutations, and recordOutput appends without a new dedup key. Deferring visibility until the callback crosses the current pre-enqueue fence; prepublishing plus unchanged callback can duplicate output. A private pre-enqueue atomic publication port would need exact attempt→Agent run/account/semantic/ordinal/delta binding, one-publication behavior, unchanged source/authority/lease/output guards and failure/rollback handling. Existing model binding is at [runtimeAgent.ts947](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:947). Monotone visibility and matching output do not inherently need two financial settlement commits, but **terminal charge-only evidence capture and independently fenced result attachment must remain separate committed stages** ([runtimeGatewayBackend.ts53](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeGatewayBackend.ts:53), [runtimeAgent.ts1018](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts:1018)). No implementation is approved here.

OCC-bearing native completions belong to terminal capture/attachment after the initial durable output. The recorded browser after-paint UTC timestamps precede their start timestamps by2202/2798ms for Normal and470ms for Fast; these are cross-clock recorded ordering observations, not synchronized latency joins. Preserve `retryCount:0` and repeated native executions as reported; do not label them paid retries or attribute them to the initial96.4ms miss. Full transport completion8.170/5.769s is separate from first paint3.293/3.096s.

Exact Action/run/request/child joins, source line taxonomy, RPC timing lists, OCC details and explicit unknowns are in [the JSON analysis](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-literal-first-pair-chain.json). Official snapshot:380 executions/240 phases, no cap hit. Raw logs and source bytes were unchanged. No source edits, service/model calls, builds or reviews occurred. Historical c258 timings are context, not a controlled speed comparison.
