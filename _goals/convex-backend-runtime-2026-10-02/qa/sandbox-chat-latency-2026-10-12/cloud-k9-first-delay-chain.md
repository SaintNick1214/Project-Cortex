# K9 browser delay chain and bounded next path

Actual browser submission→after-paint is **12433.3 ms first / 12882.5 ms warm**, versus the1,000ms goal. Canonical answer DOM commits are 14675.4/15378.4ms. Both responses and independently verified facts/vectors succeeded; neither latency passes. The dominant reachable path is the **V2 inline context/Workflow native transaction retry chain**, not measured provider first-text time.

Installed source ae9a836ff9c5e6a0ce9a279bdbdb96ad37c2a448, image sha256:dc90698021d55918e6b301fc9b3de5abdc08260b66a1093bcf77418801520ead; owned target hushed-cobra-213/6136804, session e8cccbc7-fc49-44ef-a61a-d12ca169d472. The full767-execution/186-phase snapshot covers both browser runs; earlier first-only snapshot has520executions/100phases. Only local saved metadata/source was read. Source-author attribution is not independent acceptance.

## Browser and server clocks

| Browser submission-relative boundary | First ms | Warm ms |
|---|---:|---:|
| Admission delivered | 1527.4 | 1311.0 |
| First text DOM commit | 12419.2 | 12863.6 |
| First text after-paint | 12433.3 | 12882.5 |
| Canonical answer DOM commit | 14675.4 | 15378.4 |

DOM→paint adds14.1/18.9ms; both callbacks report document visibility visible. The SDK admission pre/submit/post clusters span1521.8/1306.1ms, leaving5.6/4.9ms UI bookends. Overlapping observeEnvelope/post-session calls cannot be added into a client busy-time SLO or proven first-text carrier: trace omits cursor/payload/watcher linkage. Server-write→DOM is not computed by subtracting unrelated clock origins.

The following disjoint partition uses server epoch only. Inline stamp and final saved delta are transaction-start stamps; native successful Completion logs bound completion rather than exact commit. Nested engine/handler/retry metrics elsewhere are not added again.

| Successive server boundary | First ms | Warm ms |
|---|---:|---:|
| run-created stamp → first V2 context wrapper attempt start | 1263.0 | 685.0 |
| first V2 context wrapper attempt start → successful V2 context wrapper completion log | 8097.2 | 8833.9 |
| successful V2 context wrapper completion log → model action entry | 147.2 | 124.5 |
| model action entry → native stream begin | 1165.6 | 1237.6 |
| native stream begin → processed first native text | 477.0 | 534.0 |
| processed first native text → first durable mutation start/stored stamp | 202.0 | 198.0 |
| first durable mutation start/stored stamp → first durable mutation completion log | 152.7 | 188.8 |
| **Run-created stamp→first public write completion log** | **11504.7** | **11801.8** |

## Observed OCC and context classification

First context request b74dcf330e16ab2c and warm06ce7c9a04cdc921 each contain five distinct native willRetry=true attempts (occRetryCount0–4), then success. All have identifier worker:runMutationWrapper and componentPath workflow/workpool. The correlated context indexed-probe phases share those exact executionIds. The chains span **8097.2/8833.9ms**. Failed attempts committed zero write documents; each successful wrapper reports ten writes. These are real native OCC attempts, not adding Workflow replay stamps as timing. No exact conflict table/document was retained, so async ingestion contention is a plausible overlap rather than proven offending-row attribution.

First attempts read778–828documents/637,612–666,757bytes; warm911–917documents/781,843–783,136bytes. Across distinct retry attempts the resource counters sum4733/5487document reads and3858561/4695658bytes. This is repeated engine work, not unique stored documents. Wrapper userExecutionTime2–5ms does not measure the CPU/duration of all nested handler/component work; engine attempts last roughly1–1.5seconds.

The successful journals have startContext/contextBarrier/prepareEmptyContext followed directly by model0, no authorized-context Action or barrier sleep. By the installed exact V2 branch, this establishes that the successful original empty-proof/save path returned COMPLETE. This is **eligible indexed empty after represented/pending exclusions**, not proof no source rows exist. Current user ingestion was created at run admission and had facts/vectors complete by+6,894/+6,934ms, during retries; the successful wrapper starts+8,362/+8,376ms. Thus a pristine first UI scope is not described as an untouched empty database. Failed-attempt availability DTOs were not saved and are not retrospectively classified. No embedding.query Action ran on the successful browser path.

## Model, publication and stored-byte observations

Model entry→native stream begin is1,165.6/1,237.6ms. prepareModelOperation remains one mutation,254.1/266.2ms engine with197/233documents and151,897/194,465read bytes. Fresh hydration and initial resolve remain; the repeated constructor resolution is cached in both. Composed admission/bind/checkpoint spans385/398ms, engine360.9/383.3ms,369/414documents and420,014/477,523bytes, with no saved admission OCC. Native stream ready is438/463ms after begin; processed first text477/534ms after begin (warm trace duration rounds533). Acquisition/provider internals remain opaque.

First visibility spans196/192ms, retaining original native current guards. First recordOutput engines are141.9/175.4ms,49/58documents and37,900/48,461bytes. First durable delta stamps are+11,352/+11,613ms; successful write logs+11,504.749/+11,801.809ms. Both precede terminal capture and attachment. Finalization completes before optional title work; first title is READY after canonical completion and does not account for first text. UNKNOWN financial liability remains100,000units per observed Agent attempt with released slots and attached result; no known zero cost is fabricated.

Same-shape K7 admission telemetry read249/267documents and1,122,231/about1.16million bytes; K9 reads249/267documents and177,178/197,820bytes. Native first resolve now reads87,812bytes versus K7first731,242bytes, with98documents in each first sample. These observed aggregate payload reductions are consistent with compact stored provenance, but native telemetry gives no per-table/row byte attribution and multiple source/qualification/condition changes prevent isolated latency attribution. K7first/warm after-paint8,349.1/8,916.0ms had eligible-empty context Action query/save rather than V2's retrying inline compound transaction. Lower bytes did not yield a measured faster K9 browser outcome. Historical CLI17.14/17.35seconds and all failures remain preserved.

Explicit native verifier receipt k9-memory-native-v2-first-warm-verification-1791893934893.json PASSES both users' durable facts, current matching vectors, source/hash/lineage/receipt/usage/authority and contiguous facts/vector/profile coverage through the expected2/4events (current observed scope4). Response COMPLETE alone does not prove memory health. Graph remains pending separately.

## One smallest prospective change

Use an additive executeTurnV3 with the exact V2 layout except prepareEmptyContext is a **non-inline mutation**, and route only fresh starts toV3. Preserve executeTurn andV2 byte-exact for existing journals; keep the original contextInputs/saveContext/prepareEmptyContext handlers, all current authority/source/transcript/profile/cutoff/witness/lease/budget checks, strict barrier/sleep/deadlines, separate durable failContext, nonempty Action fallback, tool loop and final/title jobs.

Installed Workflow0.4.8 step.ts164–189 invokes an inline step through its current mutation ctx.runMutation before journaling; non-inline defaults false in workflowContext.ts297. Workpool worker.ts60–62 already documents separating completion to reduce OCC windows. Exact primary-source hashes are in JSON. The observed retry component is the Workflow wrapper, not a separately scheduled context mutation, supporting this narrow transaction-boundary change. Exact conflict rows are not exposed: the separated context mutation can still OCC, and an extra schedule/completion hop remains. No claim all8seconds are removable, no measured300ms hop assertion, and no subsecond forecast. Reverting fresh execution to the historical Action layout would be broader than this containment.

## Later saved CLI condition comparison

The coordinator subsequently measured CLI first stdout17,135.7/warm19,593.3ms in the populated scope after browser turns, both COMPLETE with positive native facts/vectors reported through8events. Their successful journals explicitly take NEEDS_ACTION then original authorized context Action: they are not empty-browser reproductions or a causal client comparison. Inline parent retry counts are2/3; wrapper chains4,406.4/5,698.5ms. Original context Action engines4,985.6/6,722.4ms, containing recall4,304/5,710ms. Model prefix1,681.0/2,302.2ms; processed native firsttext736/498ms after dispatch. First durable stamps+15,068/+17,628ms use the server clock; they are not subtracted from CLI monotonic stdout for transport estimates. These cases independently retain the same early inline transaction retry path, plus required populated retrieval. JSON carries their exact children and disjoint server partitions.

Latest CLI snapshot is1000execution records/366phases and begins after the first browser prefix; the earlier767-record snapshot is used for complete browser attribution. No missing browser prefix is invented from that truncated later capture. Only the two requested delay-chain artifacts were written; no service, paid call, source/Proofs change, test rerun or Git action occurred in this read-only task.
