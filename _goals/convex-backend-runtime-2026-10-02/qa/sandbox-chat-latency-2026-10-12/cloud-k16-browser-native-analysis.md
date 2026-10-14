# K16 browser native delay and conflicts

The authorized single browser-post-pair snapshot completed with exit zero: `service-log-snapshot-k16-browser-post-pair-1791939989485.json` contains **190 phases and 666 executions**, below the unchanged 1,000 cap; raw response is 790,117 bytes, below 16MiB. Its SHA256 is `c59e0d6acf36acf3487ef2e2dfc40c0625f808b01bcde4d0613bf3f753c300df`. No service reads were used for this analysis, and no memory/finance/chain scan was invoked. HTTP collection ended; no persistent native client remains. Root may proceed CLI.

The first browser submission’s client latency is **UNAVAILABLE**, not PASS: root preserved the wrong initial opt-in and later same-transcript HMR repair in `k16-client-timing-opt-in-repair.json` and `browser/k16-readiness-observation.json`. Warm after-paint is **5,197.2ms**, admission **1,565.9ms**, and SDK timing logs remain absent from the retained pre-HMR client. Native backend trace is present for both runs. No paid retry or new turn was introduced by collection.

| Native region | Browser first | Browser warm |
| --- | ---: | ---: |
| submitAndStart engine / own user | 1,259.8 / 133.7ms | 937.2 / 155.5ms |
| admission completion → Action preparation phase | 337.1ms | 209.2ms |
| Action turn.prepare bracket | 1,430ms | 1,382ms |
| prepareTurnModel failed attempt engine / own user | 686.6 / 239.1ms | 724.0 / 259.4ms |
| prepareTurnModel successful attempt engine / own user | 623.7 / 182.8ms | 583.5 / 186.9ms |
| turn.model begin → atomic admit/checkpoint start | 412ms | 256ms |
| fresh atomic admit/checkpoint bracket | 282ms | 324ms |
| native stream start → first processed part / text | 512 / 616ms | 484 / 546ms |
| first fresh visibility fence bracket | 395ms | 527ms |

These are separate clocks/boundaries. Parent engine and user durations include different work; child intervals are not summed again into Action duration. Native stream acquisition/processing is opaque transport/vendor work rather than a proven universal provider floor. Indexed-probe logs inside each mutation have identical fixed Date.now stamps; they do not establish zero work or indexed-empty eligibility by themselves. Canonical run-created and first durable text row timestamps will come from the later authorized four joins. First recordOutput completion is retained as a mutation boundary, not asserted to be the public first-text row.

## Exact conflict evidence

Both `prepareTurnModel` first attempts have `willRetry:true`, native retryCount zero (the zero-based first failed attempt), and then a second same-request attempt succeeds. The native conflict is **runtimeIngestionEvents written by runtimeIngestion.js:claim**. The first document hash is `53de27afc5a2c2b964d9041534645fa62dacdc9725719b3859340bc59d9ccea4`; warm is `6907d3dcdddff0cb000ed53f5b5ee7ea0c8bbb91276b053f9f678535b29c23ae`. Reads per attempt are 410 documents/642,377 bytes first and 526/833,911 warm. This is now actual table/writer evidence, not an inference about which row collided. It shows ingestion claim activity still forces the broad context/model parent to repeat; successful own-user work is under 200ms while native engine remains around 0.6s. The metadata alone does not authorize dropping the fresh ingestion/context guards.

Both first `markVisible` attempts similarly retry on **runtimeRuns written by runtimeIngestion.js:persistStage**. This adds an actual conflict to first visibility (395/527ms total fresh-fence brackets), independently of model acquisition. Warm terminal capture retries on runtimeBudgetAccounts written by runtimeModelPolicy.js:admit; this occurs after first text and belongs to canonical completion rather than first-text latency. Snapshot also preserves observer conflicts on runtimeRuns/output/execution rows and watermark self-conflicts; unrelated startup/background records are not attributed to a browser critical path without request correlation.

The substantial reachable prefix remains admission plus the repeated protected context/model parent and first visibility. Raw transcript reuse did not eliminate those fresh transaction conflicts. This packet identifies the measured boundary; it proposes no unsafe read-set/guard removal and claims no causal cross-generation improvement. Original K15 failures and K16 first-client timing gap remain intact. Awaiting CLI/all-four GO before the one strict native proof, finance snapshot and four joins.
