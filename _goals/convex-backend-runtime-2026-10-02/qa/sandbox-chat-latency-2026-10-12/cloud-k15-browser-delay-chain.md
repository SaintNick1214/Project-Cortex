# K15 V5 browser delay chain

Browser analysis milestone: **100% complete**. Repository SaintNick1214/Project-Cortex, source `2c8689fac3aca2acf1fb1f46d8b10a87388e95cd`, disposable target formal-newt-698/6152307. Both browser replies completed, but **7,499.000 / 6,980.100ms** after paint remain **0/2 under1,000ms**. Admission took2,006.900 /1,737.900ms. This analysis used saved receipts and immutable source only; no services, inference, source, Proofs or Git writes occurred.

V5 was actually reached: each journal has inline startContext/barrier and one `context and model turn0` Action. The native snapshot has640 executions and190 phases, below its1,000-record cap, and retains both complete early browser chains. Later capped CLI evidence does not replace it. A valid HttpAction lacks an identifier; the initial selector's KeyError is recorded in JSON diagnostics and was corrected without discarding the native record.

The disjoint same-server-clock path uses milliseconds from native run creation:

| Stage boundary | First | Warm |
| --- | ---: | ---: |
| Admission Completion |1,504.800|1,177.409|
| V5 Action entry |1,769.932|1,380.521|
| Preparation begins |1,859|1,426|
| Preparation ends/model begins |4,147|3,672|
| Admission/checkpoint begins |4,411|3,965|
| Admission/checkpoint ends |5,445|5,004|
| Answer dispatch |5,449|5,010|
| Processed first native text |5,937|5,603|
| First visibility complete |6,497|5,898|
| First public row transaction stamp |6,502|5,904|
| First public write Completion |6,695.522|6,121.062|

Adjacent intervals are retained in JSON. Browser performance.now, CLI process monotonic time and native epochs are separate; their subtraction cannot establish a network or paint residual. Mutation Date.now is fixed within its snapshot. Action/worker engine and user envelopes contain awaited children and are not CPU time. The processed native first-text marker is not network TTFB; Gateway/provider subphases are opaque.

Preparation took **2,288 /2,246ms**, with one OCC retry each. First prepareTurnModel attempt engines were1,162.542 /1,017.580ms, with433 documents each and223.836 /191.458ms own user time. Warm attempt engines were1,078.429 /1,103.640ms, with595 documents each and222.958 /197.490ms own user time. Admission/checkpoint reported1,033 /1,039ms and also retried once each:467.073 /445.521ms engine with193 documents first,489.824 /473.458ms with247 documents warm. Exact conflicting rows are not retained; framework transaction retries are not inference retries.

The original Agent context-hook hydrateExecution still runs before final admission:159.220 /201.130ms and48 /57 documents. Native Agent prompt/stream writes overlap admission and must not be added twice. Actual model acquisition takes488 /593ms. First visibility takes560 /295ms, retrying only first; public recordOutput follows at181.582 /192.843ms. Later capture, attachment, finish, finalization, title and asynchronous memory do not precede first public text. The full7.231 /7.321s Action includes that later work and is not the first-text interval.

Neither browser request invokes indexed recall, query embedding, readSource, readFacts, readVectorMatches, contextSource or finalDelivery RPCs. The represented/empty route executes the original local pending, provenance, empty and save guards inside preparation; it does not bypass them or establish an empty database. Recalled-source batching cannot repair these browser timings. Populated CLI analysis is in the separate four-run extension.

The next bounded candidate is repeated **raw official Agent message reads within one native parent**. hydratePrivateCutoff first invokes hydrateCutoff, which fetches IDs in100-pin chunks, then rereads those exact IDs before its private canonical/current-source/witness predicates. No writer lies between those two raw reads. A successful fresh empty prepareTurnModel calls executionContext nine times: routed, context inputs, context save; model current/completed/begin/start; and two resolutions. For a one-chunk cutoff, the source graph therefore has18 getMessagesByIds calls per attempt. These are source-level counts: native per-helper counters and timing are unavailable. listMessagesByThreadId occurs in cutoff capture/claim/public paging, not these hydration loops.

A parent-local raw reader could reuse exact function/arguments across four original writer epochs: before context save; model current/completed/begin before operation insertion; start before its writes; and the two resolutions afterward. The theoretical18→4 is not a native result or savings guarantee. Before activation, prove parent/component snapshot and OCC readset consistency, exact original-handler results/state/errors/guard order, detached bounded Convex-value copies, no cached errors, inflight/late-epoch fencing and invalidation before and after **all** core/component writes, including failures. Reexecute every authorization, transcript, canonical hash, current source, provenance, profile, expiry, lease and cancellation predicate. Reuse no authorization decision or result across Actions, transactions or processes. The directly evidenced minimum is one raw chunk read serving both original validation passes inside a readonly hydratePrivateCutoff. Existing raw-policy opt-in on new parents needs fresh whole-handler namespace/write-fence tests as well; no native saving is assumed.

The roughly1.1s preparation engine versus roughly0.2s own-user time is consistent with component/database overhead, but the logs do not separate those costs. Native submitAndStart engine alone is1,479.469 /1,147.349ms, already above the whole target. K14 paint7,836.100 /8,928.600ms and warm dispatch7,237ms are separate samples; its first early native trace was capped. No causal ratio follows.

Legacy MemoryAPI.recall.queryTimeMs measures method entry through search, deduplication, ranking and context formatting. It includes embedding generated inside recall but excludes provider recallContext embedding generated before calling it, model response, governed output and observation. Current backend context.recall starts after contextInputs and ends after governed recall/finalDelivery/format, before saveContext/model. Browser after-paint measures the broader submission path. The historical roughly200ms remains unverified, neither dismissed nor replaced by a different Battle workload.

The original compressed report is preserved as cloud-k15-browser-delay-chain-v1.md with SHA-256 `c0f3033588234e0e0bf43fdd75beb1a0e5d8f052270e11fcb2f53ef61e9e128f`; this revision changes readability only. Exact source/receipt hashes and limitations remain in cloud-k15-browser-delay-chain.json. No cache implementation or native performance acceptance is granted by this report.
