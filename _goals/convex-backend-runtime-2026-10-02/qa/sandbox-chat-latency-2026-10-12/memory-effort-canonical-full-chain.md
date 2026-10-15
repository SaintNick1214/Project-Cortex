# Canonical actual delay chains

Measured source `07f669e35cc3221c0411d1e4dfd790e4b95aa54d`, target session `e9b26cd6-1a6c-481d-b426-9f031c2e46e3`. **4/6 browser first-answer targets pass**; 5/5 recall questions answer correctly. **0/2 CLI Normal targets pass**; both actual CLI replies are correct iris and exit naturally0 without retries. All eight exact chains are joined. Current native regression separately passes651 checks, actual2/4/8/12-hop topology and strict4/4 in7.305s; it includes4 real query embeddings,12 aggregate operations and1,200,000 UNKNOWN units. Historical663/direct0 is not this qualification.

| Case | First visible / target ms | Admission | Admission→DOM | DOM→paint | Before main dispatch | Initial prepare RPC / native | Route / candidate | Main checkpoint | Stream→text | First visibility | First output native |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|normal-seed|2957.1/6000 PASS|792.0|2153.8|11.3|777.0|442.0/425.5|147.2/61.2|253.0|501.0|199.0|150.6|
|fast-recent|3362.9/3000 MISS|1053.6|2287.9|21.4|1290.0|913.0/901.8|280.1/118.9|273.0|463.0|165.0|128.9|
|normal-indexed|3694.5/6000 PASS|1039.2|2633.0|22.3|1111.0|169.0/148.6|8.3/—|260.0|491.0|285.0|205.6|
|high|3810.9/8000 PASS|859.4|2937.4|14.1|1370.0|269.0/261.2|11.8/—|304.0|605.0|201.0|394.5|
|max|4010.8/30000 PASS|1257.7|2740.6|12.5|1535.0|314.0/307.9|14.7/—|340.0|496.0|219.0|166.0|
|fast-cross|3976.6/3000 MISS|1078.6|2884.6|13.4|1178.0|200.0/192.6|9.8/—|284.0|732.0|202.0|221.2|
|cli-normal-1|7406.5/6000 MISS|—|—|—|3884.0|213.0/205.7|10.3/—|399.0|465.0|716.0|204.3|
|cli-normal-2|6477.8/6000 MISS|—|—|—|3778.0|209.0/184.0|9.9/—|418.0|588.0|285.0|247.4|

Times are nested and measured on different clocks. The JSON preserves every exact run→Action execution→request→child join, Gateway operation+semantic identity, all native rows and client intervals. Mutation timestamps are snapshot-fixed; the three preparation stages use their explicit performance duration. Client/server intervals are not added or subtracted as a causal decomposition.

Fast recent is correct but misses3s at3362.9ms. Its initial prepare is901.8ms (436.2ms reported user execution), with31.2/280.1/118.9ms lifecycle/route/candidate. Earlier singleton Fast was2728.7ms with437.1ms native preparation and13.5/170.9/69.3ms spans; literal Fast was3096.4ms with510.2ms native preparation and13/178.1/64.5ms spans. Current checkpoint273ms, stream→first-text463ms and first visibility165ms are not larger than all historical equivalents. The marked change is preparation; the contexts/response bytes and ambient native timing are unequal, so this is not causal CPU or network attribution. Both current first cases take the empty/recent route, no query embedding/semantic recall or saveAndPrepareContextV8. The controlled root62→1 oracle therefore cannot be used to predict their timing.

## Browser/client delivery boundary

normal-seed: submit envelope563.8ms then independent fresh session217.8ms; last observed envelope before paint350.7ms then post-I/O session173.0ms. These sessions enforce generation/actor/scope/expiry after I/O and are not removable timing noise. Output publication and visibility are independent fresh protected boundaries; repeated visibility writes after first text affect completion but cannot all be assigned to first-answer delay.

fast-recent: submit envelope697.6ms then independent fresh session348.8ms; last observed envelope before paint257.8ms then post-I/O session210.2ms. These sessions enforce generation/actor/scope/expiry after I/O and are not removable timing noise. Output publication and visibility are independent fresh protected boundaries; repeated visibility writes after first text affect completion but cannot all be assigned to first-answer delay.

normal-indexed: submit envelope809.1ms then independent fresh session223.6ms; last observed envelope before paint215.2ms then post-I/O session304.2ms. These sessions enforce generation/actor/scope/expiry after I/O and are not removable timing noise. Output publication and visibility are independent fresh protected boundaries; repeated visibility writes after first text affect completion but cannot all be assigned to first-answer delay.

high: submit envelope647.1ms then independent fresh session204.0ms; last observed envelope before paint223.4ms then post-I/O session183.9ms. These sessions enforce generation/actor/scope/expiry after I/O and are not removable timing noise. Output publication and visibility are independent fresh protected boundaries; repeated visibility writes after first text affect completion but cannot all be assigned to first-answer delay.

max: submit envelope1021.9ms then independent fresh session228.1ms; last observed envelope before paint200.0ms then post-I/O session272.6ms. These sessions enforce generation/actor/scope/expiry after I/O and are not removable timing noise. Output publication and visibility are independent fresh protected boundaries; repeated visibility writes after first text affect completion but cannot all be assigned to first-answer delay.

fast-cross: submit envelope850.7ms then independent fresh session222.0ms; last observed envelope before paint210.4ms then post-I/O session293.6ms. These sessions enforce generation/actor/scope/expiry after I/O and are not removable timing noise. Output publication and visibility are independent fresh protected boundaries; repeated visibility writes after first text affect completion but cannot all be assigned to first-answer delay.

cli-normal-1: submit envelope526.6ms then independent fresh session280.7ms; last observed envelope before first stdout328.6ms then post-I/O session202.1ms. These sessions enforce generation/actor/scope/expiry after I/O and are not removable timing noise. Output publication and visibility are independent fresh protected boundaries; repeated visibility writes after first text affect completion but cannot all be assigned to first-answer delay.

cli-normal-2: submit envelope460.0ms then independent fresh session174.8ms; last observed envelope before first stdout296.8ms then post-I/O session331.9ms. These sessions enforce generation/actor/scope/expiry after I/O and are not removable timing noise. Output publication and visibility are independent fresh protected boundaries; repeated visibility writes after first text affect completion but cannot all be assigned to first-answer delay.

## Current direct recall cases

normal-indexed: context.direct.candidates.sufficient(facts=1,memories=0) → context.direct.traversal.ready(facts=1,memories=1) → context.direct.stop.exhausted. No embedding.query phase in this joined Action: true. Display: 356 ms. Stops: exhausted.. This observes a singleton candidate and ready traversal; it does not prove the newly added two-candidate grammar or late-prefix branch was exercised. Native qualification's four semantic calls are another QA scope.

high: context.direct.candidates.sufficient(facts=1,memories=0) → context.direct.traversal.ready(facts=1,memories=1) → context.direct.stop.exhausted. No embedding.query phase in this joined Action: true. Display: 398 ms. Stops: exhausted.. This observes a singleton candidate and ready traversal; it does not prove the newly added two-candidate grammar or late-prefix branch was exercised. Native qualification's four semantic calls are another QA scope.

max: context.direct.candidates.sufficient(facts=1,memories=0) → context.direct.traversal.ready(facts=1,memories=1) → context.direct.stop.exhausted. No embedding.query phase in this joined Action: true. Display: 473 ms. Stops: exhausted.. This observes a singleton candidate and ready traversal; it does not prove the newly added two-candidate grammar or late-prefix branch was exercised. Native qualification's four semantic calls are another QA scope.

fast-cross: context.direct.candidates.sufficient(facts=1,memories=0) → context.direct.traversal.ready(facts=1,memories=1) → context.direct.stop.depth. No embedding.query phase in this joined Action: true. Display: 339 ms. Stops: depth.. This observes a singleton candidate and ready traversal; it does not prove the newly added two-candidate grammar or late-prefix branch was exercised. Native qualification's four semantic calls are another QA scope.

## Actual CLI semantic chains

The CLI cases have no selected prior history, but select6memories+1fact /5memories+2facts at30,612/30,876 input units. Both log direct candidates.insufficient (1/2 candidates) and perform genuine governed query embedding. Browser indexed cases select1fact+1memory via singleton direct recall. This route/evidence/input difference explains why a raw browser-versus-CLI transport comparison would be invalid; no additional grammar repair is inferred from an insufficiency label.

| CLI case | Before main | Whole recall | Embed admission | Native embed | Terminal capture | Result attach | Post-attach recall tail | prepareReads | readMatches+delivery | Save/candidate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|cli-normal-1|3884.0|2355.0|305.0|349.0|342.0|177.0|1163.0|350.6|688.8|396.9|
|cli-normal-2|3778.0|2278.0|305.0|371.0|240.0|215.0|1130.0|410.0|708.4|396.5|

The query model itself takes349/371ms. Its surrounding governed admission/capture/attachment and fresh retrieval remain legitimate serial boundaries; capture and attachment must stay separately durable. First CLI also includes cold client authentication and pre-submit session (the JSON retains each exact monotonic interval); warm CLI still misses. The selected first-publication candidate below targets a shared tail, not a claim that it alone removes the full1,406.5/477.8ms misses.

Observed OCC retries occur later: terminal capture conflicts with recordOutput in five browser runs, Fast-cross finishOperation conflicts with foreground-expiry, and CLI2 finalize conflicts with refreshed ingestion watermarks. They are retained in exact rows, after first output; they do not explain the named preparation/first-visibility misses. No OCC row is observed in those first-answer stages.

## Same-native source-authority candidate audit

freshManagedSourceValidation returns its input whenever authorityReadScope is already present. prepareDirectTurnV8 installs the full private V8 reader; createAuthorityReadScope preserves its V8 brand; withNativeSnapshotReads copies the full reader into the same-owner empty-save view. All managedSourceIsCurrent calls on these contexts already reuse parent raw authority. freshSourceReader separate maps are only constructed for graph-only source views without authorityReadScope. runtimeMemory.readBoundFactsHandler uses withManagedSourceValidationReads on a createMemorySourceReadScope (non-V8) parent. No production V8 caller of withManagedSourceValidationReads remains in convex-dev. Altering this factory cannot reduce the first two private preparation reads.

Full parent retains raw authority across explicitly normalized runtimeAgentExecutions/runtimeAgentOperations/runtimeRunOutbox/runtimeRuns and financial table writes; all writes advance epochs and suppress in flight, unknown/security/source/conversation/bridge/fluent/component writes invalidate; failed writers clear graph. Fresh traversal maps additionally clear on any parent epoch, including retained writers. Every materialize capability/generation/resource/scope/tombstone/expiry predicate still runs.

Within a native query/mutation, DB and official component runQuery share transaction snapshot; component runMutation remains wrapped invalidation. Awaited WebCrypto is pure work, not fresh authority. Separate Action RPCs, external model/embedding, post-I/O SDK session, final raw source/authority fences, admission, markVisible, capture and attachment stay independent; symbols do not cross serialized RPC.

A V8-only graph-only view could reuse the existing parent raw reader if exact owner, wrapped writes and original final unscoped fences are preserved; no authorization decision may be cached. But this adds no measured-path capability today and is not selected as a latency repair.

Deferred, not selected without transform measurements: exact-native-owner reuse of pure canonical message/policy/selection hashes and parsed immutable snapshot bytes. Each comparison, authority/currentness/deadline/duplicate/owner/attempt read must remain; full canonical input/operation key and detached parsed values are required. Actual preparation spans identify repeated executionContext/hydration work in route and candidate; native message rows already cache but contentHash/canonicalMessageHash and snapshot policy/selection SHA-256 still rerun. There is no per-transform count or time in these receipts, so dominance within the spans and hosted benefit remain unmeasured.

## One grounded next work candidate: first publication

Each first provider text delta awaits a fresh markVisible mutation, then reaches official Agent/AI SDK transforms and onChunk, whose first flush awaits recordOutput. These are two observed serial native fences. First2 visibility Action spans199/165ms and recordOutput native150.6/128.9ms are separately measured; their total is not a predicted removable delay.

runtimeGateway.ts1026 awaits state.visible before emit at1031. state.visible(runtimeGateway.ts893) sends only reference/attemptId/visibility flags via runtimeGatewayBackend.ts106; no delta is available in this ledger method. runtimeAgent.ts1136–1166 queues official onChunk and flushes its first text through refs.output; registered recordOutput at1008 repeats executionContext, tool projection and writeParts. The two calls cannot be directly batched at onChunk: moving markVisible there would emit unguarded private output beforehand; waiting for onChunk inside markVisible would deadlock.

A private backend Agent composition hook before Gateway emit could carry the bounded exact delta and native Model attempt plus Agent run/attempt/lease/operation/ordinal. One Action RPC would invoke a native parent that executes the original markVisible guards/monotone visibility update, then original first recordOutput executionContext/tool projection/writeParts, ordered before emission. To retain original output-failure effects, run original recordOutput as a native child subtransaction/savepoint, catch only its bounded refusal in the parent, commit conservative visibility and return the refusal to the Action for rethrow. Official Convex registration.ts149 documents child-write rollback. Child validation/isolated-context overhead remains. This stays in official Gateway/Agent server composition, with no new app loop or public bypass.

Before either effect, bind exact runtimeModelAttempts.operationDocumentId to runtimeAgentOperations.nativeModelOperationId, the already-bound Agent op semanticId/ordinal, current runAccountId/tenant/reference, lease and direct producer. Existing bindNativeOperationHandler947–958 supplies the invariants. A same-user unrelated model attempt cannot publish for another run. Replay/cancel/UNKNOWN dispatch rules stay intact.

Original markVisible is a separate committed conservative effect before the output handler can fail. Naively inlining both helpers and throwing changes rollback semantics. A caught native output child failure can preserve original conservative visibility while rolling back only output writes, then rethrow from the Action. No text/component/callback may emit before the successful publication acknowledgment; UNKNOWN liability remains separately captured. Parent-wide fatal failure still rolls back its transaction before emission and must never be construed as not-dispatched or authorize a paid retry. This requires regression, not happy-path proof.

Gateway currently catches visibility errors and normalizes DELIVERY_AUTHORITY_REVOKED/STREAM_INTERRUPTED, whereas output errors arise later from Agent onChunk/chunkQueue and trigger original Agent cleanup. A combined port must preserve phase-specific error classification: output-child refusal must not fall into the generic visibility catch, suppress ledger terminal capture, or skip chunkQueue/stream cleanup. Bounded original code/data and first-error order require actual tests.

A durable exact first-publication receipt keyed by producer/native attempt/operation/ordinal/sequence and payload must acknowledge the inserted output. The later official onChunk must consume only the corresponding exact text once, preserving every remaining chunk/tool/error and transform order. An in-memory boolean or deleting the first callback is insufficient for lost acknowledgment, duplicate callbacks, replays, chunk splitting/coalescing or another producer. Failing/mismatched duplicate publishes must not append twice or mark an uncommitted output visible.

Every billable admission/checkpoint/qualification/model/budget guard remains before dispatch; each subsequent delta keeps the original fresh visibility fence. Terminal charge-only capture and independent result attachment remain two separately committed RPCs. SDK observe/post-I/O session, current source/artifact/attempt/lease/cancellation/permission/deadline fences and official canonical transcript storage remain.

The exact negative oracle is:

- Compare real registered first publisher plus official Gateway stream/Agent onChunk pipeline against current visible→output path: exact ordered bytes/output rows, monotone visibility, native transcript, ledger liability and final state, one output append and no paid retry.
- Revoke grant/share or expire qualification/source retention, patch/delete source/bridge/conversation/run, cancel run/account or change lease immediately before combined publication: same first refusal, no output/visibility commit, no pre-ack text or native component delta; capture still records actual/UNKNOWN liability.
- Wrong native model attempt/Agent op/runBudget/semanticId/ordinal/reference/tenant, old attempt, mismatched payload and replay must refuse before effects. Test first handler failure, second handler failure, commit success/lost ack, duplicated/reordered/split/coalesced onChunk and concurrent first producers; at most one exact first append.
- Exercise tool-first and empty/nonstreaming results, failure before/after native stream emission, observer cancellation during RPC, deadline expiry after await and terminal capture/attachment failure; every original cleanup/finance/replay rule remains.

## Dispatch composition audit

runtimeAgent.ts961-1005 already runs the original admitHandler, bindNativeOperationHandler, fresh executionContext and checkpointHandler inside one admitPreparedModelOperationV8 native transaction. There is no second Action checkpoint RPC to remove. Eight joined main calls have exactly one Action admission/checkpoint span each.

Earlier prepareDirectTurnV8/saveAndPrepareContextV8 returns the selected context, operation and tentative resolutions. The Action then builds the governed model and invokes official Agent.streamText; startGeneration creates a pending native message, and DeltaStreamer creates the stream. Actual joined messages:addMessages and streams:create rows occur before every final main admission. Actual SDK-normalized params pass languageParams and nativeIdentity comparison only at the middleware. Moving reservation/permit into the earlier preparation crosses real component I/O and loses the current final post-I/O source/lease/cancellation/body fence. The permit must remain after those writes and actual request normalization.

Both prepared native resolutions are tentative and consumed in order. createGovernedGatewayModel validates the qualification proof and constructs the official provider synchronously; it does not acquire a service token or call the model. The installed ai-sdk-provider index.ts42-48 performs getServiceToken and fetch only inside gatewayFetch, reached by doStream/doEmbed after the final permit. Provider acquisition therefore does not itself require a separate preparation commit, but the main Agent component I/O and actual body validation do.

runtimeAgentQueryEmbedding.ts98-120 already composes admission and checkpoint in one admitV8 Action RPC. Its ctx.runMutation(checkpointRecall) is a same-transaction child/savepoint, not a separately committed Action RPC. It preserves admission reservations when exact reserved-body validation or the checkpoint refuses; the child rollback also contains injected partial writes. Existing query-embedding-composition.test.ts130-142,250-265 exercises that consequential behavior. Official Convex registration.ts149-155 documents the savepoint plus argument/return/context overhead. The saved scalar capture provides no separate child timing; 305 ms cannot be assigned to that child.

The actual CLI contextInputsAndEmbeddingV8 native query performs direct-candidate checks first, then original ordered query preparation only on semantic fallback. After its return, the Action constructs repository/selection closures, hashes the request ID, validates the exact proposal, consumes both resolutions, constructs the official provider, checks profile/model identity, and runs embedding transformParams (field, abort signal, one-value, Unicode, byte bound, normalized text, profile/batch/request validation) before fresh admitV8. No external/provider I/O is observed between those prepared proposals and admission; replay refresh remains its own native query.

A future semantic-only context-input mutation could derive the exact normalized embedding request with the same pure middleware normalizer, validate all current original local pre-admission checks, then invoke the original admission plus checkpoint savepoint and return one exact-use permit. This would require moving those local validators ahead of reservation, pinning every actual value/profile/batch/snapshot/binding byte, preserving fresh Action cancellation/deadline checks, replay/uncertain behavior, and proving no intervening Action I/O. It removes a semantic-only Action admission boundary at most; it cannot cover the six measured browser cases, which do not dispatch query embedding. No implementation or timing saving is claimed. Simply treating the prepared proposal as a permit is unsafe.

No remaining main dispatch pair exists. Do not remove query checkpoint savepoints, cache attempts, move a permit across official component I/O, or use a preparation proposal as authority. Keep this seam unchanged under the bounded shared-latency repair scope.

| Case | Main admission + checkpoint Action ms | Native ms | Query admission + checkpoint Action ms | Component writes between preparation and main admission |
|---|---:|---:|---:|---|
|normal-seed|253.0|239.8|—|messages:addMessages: 33.7 ms; streams:create: 25.3 ms|
|fast-recent|273.0|255.3|—|messages:addMessages: 47.3 ms; streams:create: 40.4 ms|
|normal-indexed|260.0|250.7|—|messages:addMessages: 41.6 ms; streams:create: 89.6 ms|
|high|304.0|288.2|—|messages:addMessages: 48.6 ms; streams:create: 33.0 ms|
|max|340.0|299.7|—|messages:addMessages: 45.0 ms; streams:create: 24.9 ms|
|fast-cross|284.0|261.8|—|messages:addMessages: 42.6 ms; streams:create: 29.8 ms|
|cli-normal-1|399.0|384.5|305.0|messages:addMessages: 55.4 ms; streams:create: 27.7 ms|
|cli-normal-2|418.0|407.4|305.0|messages:addMessages: 47.9 ms; streams:create: 24.8 ms|

All eight main admission/checkpoints and two query admission/checkpoints are already ten Action RPCs total. No standalone checkpoint Completion row appears in these exact request children. Query checkpoint remains a nested savepoint; the scalar receipt has no separate duration for that child. Component writes can overlap other work; their durations are not additive.

## First publication rejected

The earlier prospective design above is **rejected under exact failure/effect requirements**. No product implementation is selected.

- The original markVisible mutation succeeds and commits its conservative outputVisible flag.
- The Action receives that acknowledgment, then its delivery signal aborts before Gateway emits the first delta, or the official SDK observes abort before its first onChunk.
- Original state.visible asserts delivery after await and Gateway checks canDeliver before enqueue; AI SDK also checks abort after reader.read before transforms/onChunk. Therefore recordOutput is never invoked and runtimeAgentOutput remains unchanged.
- A fused pre-emit native parent has already committed both visibility and first output before this acknowledgment. The same abort leaves an extra durable runtimeAgentOutput row and advanced nextOutputSequence. A child savepoint can only roll back a failure inside that parent transaction, not an abort/transform/consumer failure after it committed.

Keeping native first output provisional until real onChunk cannot satisfy pre-ACK emission prohibition: onChunk is reached only after Gateway emits that text. Waiting for onChunk before acknowledging visibility blocks the emit needed to enter onChunk. Sending it through the official pipeline before the acknowledgment violates the requested pre-ACK callback/component prohibition.

An exact durable payload/producer/operation/native attempt receipt can prevent duplicate append or suppress a matching split/coalesced callback. It cannot make already-committed output conditional on a future SDK callback or undo a post-ACK abort. A receipt mismatch can refuse later delivery, but the extra durable output/effect has already occurred. Catching an output child refusal preserves conservative visibility for that one failure phase only.

To proceed, the product would have to accept first output being durably published at the earlier pre-emit linearization point, including when a later SDK abort/transform/consumer failure prevents onChunk; or allow an official pipeline staging callback before the publication acknowledgment. Neither follows from the exact original failure/effect requirement and emit-nothing-before-ACK constraint. No unsafe bypass is implemented.

Negative oracle: At a fixed registered-handler fixture state, arrange an AbortController abort immediately after visibility RPC resolution and before Gateway emit. Compare original and proposed handler plus official stream pipeline: exact runtimeAgentOutput rows, nextOutputSequence, native message/stream state, visibility, first error, ledger capture/attachment, and paid call count. Original has conservative visibility with zero first-output append. A pre-emit append cannot match. Add abort after transformed read but before first onChunk, transform/consumer refusal, output-child refusal, lost ACK, wrong lease/source/attempt, tool-first and split/coalesced matching. Preserve terminal UNKNOWN/capture and independent attachment; never pay again.

## Limits

- No calibrated browser/server clock or RPC→execution ID correlation. Browser/client and native/Gateway spans overlap; do not add them.
- Official executionTime and userExecutionTime retained by name. Their difference is unclassified native runtime/DB/scheduling/component time, not exclusive CPU or network.
- All named rows are joined exactly; no observed retry is not proof of zero unrelated load. No per-transform/read/call-duration profile or child Query completion durations.
- Controlled source-root62→1 is no hosted speed proof. First two empty/recent cases do not enter saveAndPrepareContextV8/query embedding at all.
- No paid retries, source implementation, target calls or new review loop from this analysis. All eight browser/CLI receipts are joined; first-publication fusion is rejected under exact failure/effect ordering.

Inputs are hash-checked unchanged. No service/model/credential calls, product edits, Git operations or new tests were performed.
