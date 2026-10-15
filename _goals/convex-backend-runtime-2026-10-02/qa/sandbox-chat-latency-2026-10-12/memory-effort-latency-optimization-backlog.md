# Accepted functional milestone — remaining latency optimization

On2026-10-15 the user explicitly accepted functional completion and the measured latency milestone. These measurements remain misses against the stated optimization targets. They are not rewritten as timing PASS, percentiles or guarantees. All original product deadlines, authentication/currentness checks, model/budget controls and no-paid-retry rules remain.

| Observed workload | First answer | Target | Retained observation |
| --- | ---: | ---: | --- |
|374c Fast recent|3,326.5ms|3,000ms|Correct; missed326.5ms|
|374c Fast indexed/new conversation|4,095.1ms|3,000ms|Correct; missed1,095.1ms|
|374c Basic CLI Normal assertion|7,789.238ms|6,000ms|Correct; missed1,789.238ms|
|374c Basic CLI Normal recall|10,286.055ms|6,000ms|Correct; missed4,286.055ms|
|374c genuine Chat Normal|10,995.1ms|6,000ms|Correct; missed4,995.1ms|
|d4ba Vercel Normal assertion|6,260.1ms|6,000ms|Correct; missed260.1ms|

Normal indexed browser3,192.6ms, High3,627.9ms and Max4,844.8ms met their respective targets. These are unequal individual contexts, not a controlled comparison or distribution. All source/raw receipts retain their original scope.

## Evidence-backed next investigations

- **Protected semantic preparation:** actual ordinary CLI preparation3.822/4.751s and genuine Chat6.045s include recall2.804/2.628/3.898s. Five native siblings occupy70–76% of those preparation walls and read620/686/577 documents across invocations. Native execution is not pure CPU; metadata does not isolate per-predicate CPU, DB waiting or Gateway/provider internals. A future repair needs a newly measured material cause rather than another raw-read cache already present.
- **Observation conflicts:** d4ba logs show eight retrying observations among77 executions: execution-row conflicts5, run-row conflicts2, memory-progress1. A hot-row/projection redesign may warrant investigation if future representative runs establish a material critical-path effect. It must preserve transaction/OCC semantics, fresh source/authority checks and per-envelope independent SDK session validation. No speedup or design acceptance is asserted.
- **Retain actual provider bounds:** CLI query embeddings276/305ms and native-tool embedding326ms were much shorter than surrounding governed operations. Current Gateway/provider acquisition, queuing and transfer cannot be exclusively separated. Do not blame an unobserved routing stage or change models solely to improve a benchmark.

## Closed or unsupported proposals

Same-native-snapshot authority/source/conversation raw-row reuse is already implemented. Main context/preflight, query embedding admit/checkpoint, read/final-delivery and save/candidate compositions already run. The first normalized text frame already uses one visibility acknowledgement; the local per-frame delivery assertion is not another RPC. Replacing observe with a cached query, removing the fresh post-envelope session, or committing context/output before post-I/O expiry checks changes protected behavior and is not an accepted optimization. Shared slot contention was not observed in the examined ordinary samples. Native tool composition actually ran, but6,862.334ms versus prior6,804.213ms established no action-speed improvement.

Prior controller failures, actual runtime failures, original deadline failures, scoped mock/static coverage, missing C7 backing/custody and deferred asynchronous video remain unchanged. No additional inference, deployment or benchmark run is required merely to adopt the user's acceptance decision.
