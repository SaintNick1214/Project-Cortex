# First successful hosted cloud delay chain

Source `e89c3d0bb381bdb7ddd5e89b4eccc2590c25a403`, K3 canonical Basic1.4.1 on hosted `kindly-clam-401`, first chat after seven qualification calls. This run completed. Submission to first nonwhitespace answer stdout write acknowledgement was **17,347.98009ms**; the under-one-second goal is unmet. Terminal paint and browser visibility were not measured by this receipt. This is one observed run, not a universal hosted-platform floor.

The paired thin JSON retains input hashes, disjoint server intervals, journal and native scalar evidence. No live reads, inference or product/service changes were used for this analysis.

## Clock and accounting boundaries

Server offsets below use run.createdAt `1791863930807`. Client values use only the client's monotonic submit.begin `7625.371004`. These origins are not aligned. Journal start/end are scheduling and completion metadata, not handler CPU time. Date.now inside a mutation is transaction-fixed: claim.begin/end and finalize.begin/end matching timestamps do not mean zero work. Native Completion executionTime and userExecutionTime are different measurements; cached queries retain original executionTimestamp/userExecutionTime, so cached rows cannot be added as repeated full costs. Component wrappers, background work, action spans, nested RPCs and trace phases overlap and must not be summed together.

| Server stage | Offset from creation | Observed interval |
| --- | ---: | ---: |
| Admission/initial scheduling through first step | 0–1,792ms | 1,792ms |
| startContext journal | 1,792–3,218ms | 1,426ms |
| Continuation to contextBarrier | 3,218–3,685ms | 467ms |
| contextBarrier journal | 3,685–4,972ms | 1,287ms |
| Continuation to prepareContext | 4,972–5,417ms | 445ms |
| Authorized context journal | 5,417–7,643ms | 2,226ms |
| Continuation to model step | 7,643–8,737ms | 1,094ms |
| Model step scheduling to actual action entry | 8,737–9,306.270ms | 569.270ms |
| Actual model action entry to native request | 9,306.270–12,068ms | 2,761.730ms |
| Native request to first processed text | 12,068–12,533ms | 465ms by endpoint subtraction; trace duration466ms |
| First text native visibility | 12,533–12,747ms | 214ms by endpoints; trace213ms |
| Later deltas/terminal/transformed delivery to output RPC | 12,747–14,707ms | 1,960ms |
| Output RPC/native retry to durable delta row timestamp | 14,707–15,183ms | 476ms; successful RPC ends15,355ms |
| Durable delta timestamp to model journal completion | 15,183–17,445ms | 2,262ms |
| Continuation to finalize | 17,445–17,775ms | 330ms |
| Finalize journal | 17,775–18,737ms | 962ms; canonical final/ingestion row timestamp18,324ms |
| Continuation to optional title enqueue | 18,737–18,973ms | 236ms |
| Title enqueue journal | 18,973–20,003ms | 1,030ms |

These rows are sequential observation boundaries, not estimates of savings. The durable row timestamp is the successful transaction's fixed time; it is not its commit acknowledgement. Successful recordOutput's native Completion ends at15,355.015ms.

## Authoritative context and Workflow

The first three journal spans plus continuation before the model account for7.643s through context completion; model scheduling starts at8.737s. prepareContext's actual action entry is5,861.920ms and native Completion ends7,634.621ms, inside its2,226ms journal envelope. Serial reads include hydrateExecution (Completion execution571.464ms), pendingContext285.919ms and indexedContextAvailability377.312ms, followed by saveContext428.416ms. The probe trace spans379ms. **context.indexed.empty** occurs at7,193ms and context.recall.end immediately follows; the actual Agent account has only agent.respond and conversation.title. Query embedding was excluded in this run. Background memory.extract and embedding.memory phases still exist and are separate work.

Workflow0.4.8's installed primary contracts support `runMutation(..., { inline: true })`. StepExecutor executes the existing query/mutation through its ctx, records its result in the journal, and journal.startSteps does not enqueue already completed inline entries. Completed replay validates name/kind/args with unstableArgs false. Actions cannot be inline. This is the smallest supported way to remove separate Workpool scheduling/continuation envelopes for startContext/contextBarrier while continuing to call their real guards. Strict waiting/sleep, failures, cutoff and barrier deadline behavior must remain; changed timing needs a real benchmark. The journal cannot reveal exactly how much of each mutation span is inner handler versus wrapper/scheduler cost.

## Model preparation, native request and visibility

Before the native request, modelStep calls hydrateExecution, completedModelStep, beginOperation, startOperation, a fresh guard, ledger resolution, SDK generation/context setup, admission, parent binding and checkpoint. startOperation has two native executions sharing the same requestId: the first willRetry=true, the second commits at10,720ms transaction time. This is a native transaction retry, not a new billable model attempt. Duplicate hydrate/resolution queries include cached rows; they are not full repeated server executions. Initial ledger resolution trace187ms, nested cached construction resolution2ms, total construction6ms. Admit238ms, bindNativeOperation native execution158.493ms, checkpoint218ms. These sit inside the2.762s action-preparation span; they are not additional latency on top of it.

Native stream acquisition to ready is411ms in its own trace; first processed part412ms and first processed nonempty text466ms. Provider service-token acquisition, HTTP/header timing and raw provider first-token remain opaque within this boundary. First native text is observed3 bytes. Three visibility mutations run serially with trace durations213/553/562ms (1,328ms total), each retaining the current authority/source/transcript/policy fence. Terminal capture291ms and attachment535ms follow. Native stream and action end timings are different boundaries.

## First publication and client delivery

The installed Agent0.7.3 `mergeTransforms` adds AI SDK smoothStream whenever saveStreamDeltas is enabled. Our object omits chunking; smoothStream's default is word matching `/\S+\s+/m`. A short whitespace-free answer therefore buffers until text-end. Gateway emits text-end only after terminal capture/attachment. Attachment completes at14,703ms; first recordOutput starts14,707ms. That first mutation has willRetry=true; successful recordOutput begins15,183ms and ends15,355.015ms. This source behavior and actual timing explain why the public delta follows terminal attachment despite native text arriving earlier. The existing250ms onChunk flush is event-triggered, not a hard timer, and text-start can reset its timer before first text.

An offline invocation of the **installed** Agent transform with a synthetic6-byte whitespace-free stream emits zero text deltas before text-end under current options. Explicit fixed `/[\s\S]+/u` whole-fragment chunking emits both received fragments before text-end, preserving all combined text. This validates the chunking contract, not a latency SLO. Pair it with immediate flush of the first nonempty projected public text so status/text-start does not defer that text. Later250ms/bounded buffering, serialization/cleanup and every native visibility/publication fence must remain.

The retained metadata reader mistakenly counts nonempty text only for type:text; its text-delta nonemptyText=false/textBytes=0 fields are not evidence of empty native output. The first durable **text-delta row** timestamp is15,183ms. Root is correcting that QA reader; no product change is needed.

Client auth.ready occurs423.169ms after submit (auth begin→ready396.038ms), followed by two session calls378.289/327.578ms before submitAndStart, whose RPC is1,287.990ms. Its native Completion executionTime is1,172.694ms, overlapping this client RPC. Post-admission session is169.265ms. Before first print the client completed17 session RPCs, seven observe RPCs and one submitAndStart RPC; watcher notifications and reads overlap server progress.

The delivery cycle immediately preceding first print has watcher wake at16,073.919ms after client submission, pre-session329.712ms, observe761.773ms, post-session178.723ms, then first stdout acknowledgement17,347.980ms. Wake→ack is1,274.061ms, including those fresh session fences and delivery validation. This cycle is a client-monotonic interval, not an extra duration to add to server15.183s. Without UTC alignment, exact client submission→run creation and durable commit→stdout cannot be separated. Their combined residual against the durable transaction timestamp is2,164.980ms; it is not pure network/transport time and includes transaction commit. Client batching requires its own current-identity/delivery-equivalence work and is deferred.

## Canonical completion, title, memory and liability

Canonical final text/status and answer ingestion registration share transaction timestamp18,324ms. Title enqueue is the next journal step; the job is created19,511ms, starts its ledger work21,931ms, and reaches ready28,758ms. Native title generation is863ms inside this independent lane. The observed answer completed before title; the prior inline-title tail is removed for this run. This is not a comparable end-to-end34.283→18.324 claim: prior baseline17.597s first durable/model start15.363s/final34.283s used different boundaries.

The Agent account's two native attempts are attached/outputVisible, slotReleased, state:uncertain with100000 uncertain units each. Actual successful output did not refund or bypass unknown-cost liability. User ingestion facts/vectors are complete; assistant facts are skipped and vectors complete. Both graphState fields remain pending. The run's later updatedAt20,701ms is an ingestion update, not canonical finalization time. Background extraction/indexing overlaps the answer and may contribute contention, but this thin log does not identify conflicting documents. There are native willRetry flags on startOperation, publication and observation, plus other concurrent functions; exact conflict causality is unproven.

## Smallest justified next batch

1. Execute only the existing startContext/contextBarrier mutation steps using official Workflow inline options; retain the same journal names/args/order, handlers and strict barrier loop/deadline/cutoff. Test installed scheduling/replay behavior and actual handler negative cases.
2. Specify fixed whole-received-fragment chunking in Agent streaming and immediately flush first nonempty projected public text; test actual installed transforms and output callback before text-end/terminal, order/bounds/empty/status handling, cleanup/failure/revocation/cancellation. Keep all current Gateway visibility and recordOutput checks.

These changes target measured internal scheduling and buffering, without changing provider route, model, budgets, parent bindings, source witnesses or admission/replay policy. Combining context reads or model preparation could reduce serial RPCs later, but needs a separate equivalence proof and actual post-batch measurement. Client triple-fenced observer batching is separate. Neither this diagnosis nor offline contract execution establishes subsecond hosted performance.
