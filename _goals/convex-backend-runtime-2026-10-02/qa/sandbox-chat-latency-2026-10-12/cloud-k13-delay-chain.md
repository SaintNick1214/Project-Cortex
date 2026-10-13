# K13 saved browser delay chain

Analysis milestone: 100%. Repository SaintNick1214/Project-Cortex; visibility unverified. Source `eb8c4c03a2457b79d3b7129a7e7af8da3ecd67bd`; exact K13 reminiscent-gazelle-386/6149177, session 90c168d7-c872-4e13-872a-808673687f18. Saved-only evidence: no source edit, service read or inference.

First/warm after-paint are **9897.800/9265.300ms**, admission 2475.400/1975.600ms. Both exact responses and native response/execution states are COMPLETE, while the original under-one-second outcomes remain FAIL. K12 was 20515.600/12415.300ms; changed scheduling/OCC/indexing conditions prevent attributing the whole difference to the source changes.

## Immediate start and consecutive server boundaries

Initial startContext/contextBarrier/prepareRoutedContext journal start stamps equal run.createdAt in both cases. The initial V4 prefix is now inside the authenticated submitAndStart native parent, with no independent initial Workflow worker wrapper in its joined prefix. Admission native engines1900.028/1272.857ms include that nested initialization (283/307aggregate documents); they cannot be compared to old admission as the same amount of work. Paid model Actions remain later scheduled steps.

| Successive same-server-epoch interval | First ms | Warm ms |
|---|---:|---:|
| run-created / immediate initial Workflow prefix → admission Completion log | 1917.678 | 1291.414 |
| admission Completion log → routed context first transaction start | 174.322 | 126.586 |
| routed context first transaction start → routed context first retry Completion log | 990.718 | 1049.422 |
| routed context first retry Completion log → routed context retry transaction start | 33.282 | 42.578 |
| routed context retry transaction start → routed context successful Completion log | 886.182 | 878.187 |
| routed context successful Completion log → resume Workflow transaction start | 1209.818 | 343.813 |
| resume Workflow transaction start → resume Workflow Completion log | 417.133 | 294.651 |
| resume Workflow Completion log → model Action entry | 271.053 | 241.167 |
| model Action entry → native stream dispatch | 1952.814 | 2434.182 |
| native stream dispatch → processed first native text | 716.000 | 556.000 |
| processed first native text → first public write stored/transaction stamp | 231.000 | 651.000 |
| first public write stored/transaction stamp → first public write Completion log | 233.348 | 196.016 |

Front before model is **5900.186/4267.818ms** (K12 9573.952/6595.686); protected preparation is **1952.814/2434.182ms** (K12 4918.048/2099.314). Dispatch→processed first text stamps span **716/556ms**. First trace duration715 versus epoch difference716ms is ordinary timestamp rounding/marker placement, not another interval. Acquisition remains opaque provider/network/processing and is not a universal vendor floor.

The partition is disjoint on the server epoch clock through first public write Completion. Do not add native engine/own-user/child/parent/retry/Workflow metrics to it or subtract server stamps from browser monotonic time. Official cached queries retain old snapshot/user metrics; count only their new tiny engine work. No native-write→paint or unseen network TTFB is invented.

## Remaining native context and model costs

Both full routed indexed-empty proof wrappers retry once. First attempts989.438/1048.578ms engine are followed by878.223/867.921ms success; per-attempt aggregate reads remain301/391documents. The wrappers are workflow/workpool internal Mutations, with own user7.926/8.155ms on the first attempt, not pure proof CPU attribution. Native occRetryCount increments on the successful successor; exact conflicting tables/rows are absent. Both browser branches have no original context Action, query embedding or contextSource retrieval; they are indexed-empty after exclusions, not an empty-database assertion.

| Root first occurrence | K12→K13 first docs | K12→K13 warm docs | First engine ms K12→K13 | Warm engine ms K12→K13 |
|---|---:|---:|---:|---:|
| runtimeAgent:prepareModelOperation | 197→89 | 233→125 | 1067.949→530.163 | 368.673→316.876 |
| runtimeAgent:resolveModelOperation | 68→68 | 86→86 | 641.889→370.273 | 358.152→370.101 |
| runtimeAgent:admitModelOperation | 175→175 | 220→220 | 1231.986→434.844 | 496.767→490.597 |
| runtimeModelPolicy:markVisible | 103→103 | 112→112 | 682.376→216.643 | 240.272→392.801 |
| routed context first attempt | 301→301 | 391→391 | 2146.522→989.438 | 2268.418→1048.578 |

The new prepareModelOperation entry scope is actually reachable: native reads197→89/233→125 (54.8%/46.4% reduction per compared attempt). Resolve68/86, admission175/220 and visibility103/112 stay matched to K12. Source factory scope is invocation-local; no cross-operation/currentness interval has been removed. Aggregate native counts do not expose exact raw-reader hit identities.

First model prepare/admit/first visibility have no native retry; warm prepare, admission and first visibility each retry once. First terminal capture retries once after first text; warm capture has no retry. First resolves run twice uncached (370.273 and211.364ms engine), while warm second resolve is an official cached0.037ms result of its original86-document snapshot. Do not call the cached historical user105.896ms new work. First fresh current visibility225ms/warm639ms and public write224.394/184.497ms engines remain; later final capture/attachment/finalization/title overlap after first text and are not added to TTFT again.

## Actual two-owner browser observation

The committed UI now has exactly its continuous finalOnly status/authorization watcher and the remote transport watcher. Actual SDK starts repeatedly form pairs; no near-concurrent begin group within25ms has more than2 in either submission-to-paint window. First completed14observeEnvelope plus15session calls; warm12 plus13. The original K12 windows had21/16 completed observations and21/16sessions. Their wall durations overlap and the windows differ, so these are capture counts, not serial latency sums or a causal per-intent saving. Each observation still has its own fresh post-I/O session fence. Captured SDK records omit cursor/page/finalOnly/run identity and private payloads, so neither exact first-text carrier nor every warm RPC run attribution is established. No further client cache or one-lane lifecycle handoff is proposed by this trace.

The largest remaining serial region is full indexed-empty proof plus Workflow scheduling, followed by governed model preparation. One concrete next investigation is original-handler DB instrumentation for the routed/empty proof: compare exact read identities/query arguments and writer epochs, locate repeated/unrelated dependencies without removing original current profile/cutoff/readiness/budget/source/grant/expiry/tombstone predicates or error ordering, then correlate actual OCC conflicts if native metadata exposes them. Aggregate retry flags alone do not justify naming a conflicting row, dropping a witness, fusing durable failure into rollback, relaxing a guard or increasing a deadline.

Saved native capture covers 754executions/178phases, below1000cap; SDK captures 251records, below400bound. Exact run/request/execution joins, OCC/cache/read-byte/own-user data, source/input hashes and both clock partitions are in cloud-k13-delay-chain.json. No CLI, independent memory-stage qualification, charge, auth-code repair or SLO PASS is inferred; earlier failures and UNKNOWN ceilings remain preserved.

## Actual CLI first and warm under their original deadlines

The first/warm original commands first printed at **16083.247049/17513.351050ms** and completed under the unchanged30,000ms deadline. No resubmission, tool or paid retry was added. Both still fail the1,000ms target. Parent reports Basic process17511exit0; exact raw commandId1/2 and stdout clocks remain in k13-cli-first.typescript. The CLI follows both browser turns and uses indexed context; empty-browser versus populated-CLI totals are not a controlled causal comparison.

| Measured CLI region | First ms | Warm ms |
|---|---:|---:|
| run-created → context Action entry | 2779.440 | 3208.130 |
| context entry → recall begins | 521.560 | 612.870 |
| complete governed indexed recall | 5167.000 | 6988.000 |
| native query embedding acquisition, inside recall | 389.000 | 1205.000 |
| remaining governed/retrieval/delivery work, inside recall | 4778.000 | 5783.000 |
| run-created → model Action entry | 9734.762 | 11874.061 |
| model entry → native answer dispatch | 1605.238 | 2556.939 |
| answer dispatch → processed first native answer text | 495.000 | 609.000 |

Recall 5167/6988ms is the main pre-LLM region; actual query embedding is389/1205ms nested within it, not the entire Gateway contribution. The original policy resolve, admit, checkpoint, terminal capture/attachment, initial/fresh profile readiness, indexed vector/fact retrieval, source and final-delivery fences account for the remainder4,778/5,783ms. First embedding admission, checkpoint and attachment each retry once; warm has no observed query-embedding ledger retry. First finalDelivery is540.082ms engine/131.632ms own user (496docs/582505bytes); warm552.805/178.642ms (974docs/1109867bytes). Original fresh saveContext costs277.183/351.057ms engine. These metrics are nested in recall/context; do not add them again.

The source-cutoff parents are still called serially: **7/10 contextSource queries**, summing **701.166/1102.290ms native engine**, plus **3/4 independent fact readSource bindings** at **265.402/423.002ms**. No cached contextSource result is observed; original cutoff and late source helpers remain. These are actual nested call costs, not a promised wall saving.

Original model preparation is1,605.238/2,556.939ms. Scoped prepareModelOperation reads185/413documents (warm retries once); fresh composed resolve116/230 (second native cached), separate original hydrate216/561, and combined admission/checkpoint295/580documents with no observed admission retry. Native answer acquisition495/609ms and first current visibility316/432ms remain. First public write Completion is+13,231.824/+15,809.813ms on the server clock; CLI stdout stays on its own clock, so no server→stdout network subtraction is made. First recordOutput engine1061.768ms/153.892ms own user, warm319.508/137.932ms. Later writes/capture/attachment/finalization/title overlap after first text.

## Exact current routing predicate and one next implementation

At immutable runtimeAgent.ts:562–580, prepareRoutedContext checks the complete original execution and started state, then repository authority. It selects owner-only by_owner_sequence or authorized-space by_scope_sequence at the captured immutable ingestion cutoff; **take(1025)** includes all event metadata. Overflow>1024 or any eligible lineage not represented by the captured canonical transcript requests NEEDS_ACTION. That hint does not test current source/boundary/pending/index-readiness predicates and cannot certify emptiness. Otherwise the entire original empty-proof handler still reads authorized pending context, validates current embedding profile/readiness and evaluates original indexed availability with withinConversationBoundary. The tiny K13 corpus does not prove1025scan size as a dominant cost. Exact declaration/hash is retained in JSON.

The concrete subsequent change is an **Agent-only source-validation batch query** at the existing retrieval stage: execute the original contextSource/readSource/cutoff helpers serially for the already-selected candidate batch, preserving per-item order/error precedence, every resource/currentness/hash/grant/profile/budget/boundary/cap/expiry/tombstone predicate and independent finalDelivery/save/model fences. Keep generic exports; no authorization decision or cross-phase/snapshot cache, no paid call/application writes in the parent, no retry/refund/deadline/UNKNOWN/intent/transcript advantage. The measured7/10contextSource RPCs are a real target. The coordinator's parallel-recall source work is distinct and already stages vector-first deterministic bindings/witnesses with original per-source RPC order plus legacy serial fallback; batching should consume that frozen stage later. Controlled RPC reduction must be reported separately from fresh native cloud timings, with no SLO saving promise.

The latest snapshot is at its1000execution cap with334phases; older startup/browser records can be omitted. Exact CLI context/model Action request IDs and all expected child classes are present. Empty phases in run-chain files do not imply no native phases; the joined snapshot is authoritative. The original754browser snapshot and initial browser-only report/JSON remain separately preserved as cloud-k13-delay-chain-browser-v1.*.

Root's strict native four-run receipt k13-memory-native-v2-four-run-verification-1791927604019.json independently passes attributed facts/vectors/current authorities/source/complete usage and selected contiguous memory through8events. Its SHA-256 isfb6476e11dcda7ac7fed30fd41eb6df763c563fefb6e7df8795b668b855ecab8. Finance retains30attempts, zero active slots/all released and4,900,000UNKNOWN reservation ceiling units; these are not measured charges. Root's fresh cleanup receipt isABSENT; all clients/launcher are closed. This saved-only analysis makes no new service call, source change or inference. Original auth/deadline/SLO failures remain; no broad task or whole-goal acceptance is inferred.
