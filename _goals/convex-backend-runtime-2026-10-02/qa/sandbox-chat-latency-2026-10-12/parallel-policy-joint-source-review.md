# Joint source-and-test judgment: parallel recall and routed policy metadata

## Verdict: PASS

This is one independent nonauthor review of the coherent seven-product-file/five-test-file latency repair batch and its two new documentation paragraphs. It passes the adopted functional policy: requirement fulfillment, test quality and completeness are each 4/5; code quality and pattern adherence are each 4/5. No unresolved breaking finding was identified in this batch. This verdict accepts source behavior and the observed offline checks, not native qualification, latency improvement or completion of the latency goal.

Reviewed checkout: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion` (SaintNick1214/Project-Cortex). Website checkout: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs` (SaintNick1214/cortexmemory.dev). Current HEAD is `1511e0e81ee873178fdac879ea6225635e215dc5`; its difference from product baseline `eb8c4c03a2457b79d3b7129a7e7af8da3ecd67bd` contains QA artifacts only. Existing unrelated local work was not changed.

The review first read target AGENTS.md, CODEX-RUNTIME.md, PROJECT-PROFILE.md, the pessimistic-judge role, judge-task rubric and acceptance-policy.md. The adopted goal policy overrides the older rubric's stricter score thresholds. The user waived numerical review-cycle limits; product bounds, assertions and original deadlines remain requirements. No retired custody/census/controller ceremony was imposed, and no separate judgment of routine receipts was created.

## Requirements review

| Mandatory behavior | Met | Source and meaningful outcome evidence |
| --- | --- | --- |
| Original request/text/read/authority/profile guards and one validated query embedding precede both reads | Yes | `runtimeMemoryServices.ts:83-108` retains every original guard before the optional seam. `parallel-recall.test.ts:39-75` blocks embedding completion, asserts exact guard/read order and query arguments, and checks eleven prior failures start neither branch. |
| Both settlements are owned; synchronous and late errors retain vector priority; failures never commit or deliver | Yes | Promise tasks plus `allSettled` at `runtimeMemoryServices.ts:106-112`; tests at `parallel-recall.test.ts:77-113` assert exact error identity for both completion orders, synchronous/late peer rejection, both synchronous throws and each single failure, including no commit/finalDelivery. |
| Exact successful vector-first delivery bindings, result/context bytes, provenance and witnesses | Yes | Action branches retain isolated binding envelopes and merge vector then fact at `runtimeMemoryRepository.ts:494-512`. Actual Action tests at `parallel-recall.test.ts:143-175` block both native ports and compare exact serial result/context and delivery envelope in both completion orders. Agent tests at `context-source-composition.test.ts:254-292` assert context bytes, source RPC order, ordered provenance/witness permissions and exact fact/vector identities. |
| Original source guards and first shared-source conflict keep priority; vector errors release the fact gate; failures never save context | Yes | Agent fact native reads overlap, but source guard RPCs await vector settlement; vector release is in `finally` (`runtimeAgent.ts:518-550`). Tests at `context-source-composition.test.ts:294-330` verify vector/fact/both source errors and first revision/hash witness conflict before a later fact fault, with no delivery/save. Existing post-delivery revision/hash/revocation/owner/tombstone/profile and lease/cancel/transcript/witness/competing-save refusals remain asserted at lines 208-252. |
| Older/unstaged and spread tool wrappers retain serial guarded behavior | Yes | Optional seam and serial fallback at `runtimeMemoryServices.ts:101-117`; Action seam is explicitly non-enumerable at `runtimeMemoryRepository.ts:516-519`. The unchanged spread wrapper in `runtimeAgentTools.ts:88-105` retains its current-attempt checks and witness capture. The previously failing unchanged `tool-context.test.ts` now passes all four cases in both final selections. Legacy read-preflight assertions remain; the only old test edit explicitly omits the added optional seam from its older adapter fixture. |
| Only routed context reuses the two exact raw policy metadata queries, detached values and finite 64-entry storage | Yes | `runtimeAuth.ts:48-72,116-148` retains deployment `by_scope_active`/deployment/undefined tenant/active/`take(65)` and qualification `by_receipt`/receipt/revision/`take(2)` selectors. The only production option activation is `prepareRoutedContext` at `runtimeAgent.ts:597`. `policy-metadata-read-scope.test.ts` asserts exact selectors/caps, distinct receipt/revision keys, detached nested records, opt-out, child/nested context isolation and capacity fallback. |
| Writers invalidate before/after, suppress hits/population while pending, preserve errors, and late reads cannot repopulate a newer namespace | Yes | Shared writer epoch plus separate metadata epoch at `runtimeAuth.ts:91-148`. New raw-reader tests cover insert/patch/replace/delete, child success/failure, pending/failed writer, uncached read failure and late pre-fresh/pre-writer reads. No model decision, authorization decision, source, Action/RPC result, final delivery or observation cache was added. |
| Fresh policy namespace immediately before original full save fence; all validators, historical Workflow V1-V4 and completion bodies remain | Yes | `freshPolicyMetadataReads(ctx)` is evaluated before `saveContextHandler` at `runtimeAgent.ts:590`; the save body itself is unchanged. Independent read-only AST comparison confirmed 361 original top-level statements byte exact and exactly eight intended changed original statements. Reviewed inverse normalization of four bodies matches baseline; eleven critical Agent statements, including parallel prepareContext, full save fence, Workflow V1-V4 and callbacks, remain exact. New routing tests compare exact result/state/non-metadata order and ten reached after-probe denial/rollback cases, with no saved context or model effect. |
| Docs describe current bounded behavior without a speed guarantee | Yes | `performance.mdx:28,36` accurately describes staged reads and transaction-local metadata with a fresh save fence. Removing only those two paragraphs independently restores accepted v7 hash exactly. The other six pages retain accepted v7 bytes. Generated HTML contains both paragraphs and the retained product-target limits; saved actual IAB screenshot inspected. Raw v8 build exits 0; browser observation is zero warning/errors only in a sample of 100. |

## Test coverage and actual checks

The standard Jest outcome JSON, raw logs, discovery arrays and exact command/cwd/exit receipts were inspected. The final combined run discovers and executes the same 41 unique suites: **1,855 passed, zero failed/pending/skipped/todo**, exit 0, `--forceExit=false`. Every recorded assertion status is passed. This selection includes all 23 suites of the earlier frozen parallel run (**839 passed, zero skipped**); counts overlap and are not additive.

Focused changed behavior has meaningful assertions: parallel settlement 22 cases; Agent source composition 53; policy metadata scope 12; routed metadata 15; unchanged tool context 4. The selection also covers existing auth/isolation, ingestion/source/cutoff, model policy/admission/profile/budget, transcript and Workflow dependencies. These are actual registered-handler/source tests with controlled DB/component/model ports; they do not certify native ANN, native OCC or paid provider behavior.

Root and backend TypeScript, scoped ESLint, root lint, root build and packed/browser/backend/consumer contracts each have observed exit 0. Root lint reports **0 errors and 237 warnings**; scoped lint has no warnings/errors. Build retains 157 backend source files, 72 tables and 2 components without deployment. Final contract log explicitly passes packed root/runtime/graph ESM+CJS, backend manifest bytes, consumer declarations, URL round trips and browser execution. Node 24.15.0/npm 12.2.0 and the explicit offline URL are recorded in receipts. The reviewer did not rerun these checks.

Controlled empty/represented/warning routing comparisons retain exact result, transaction/native/scheduler state and non-metadata read/write order. With the declared four-policy/five-qualification fixture, returned metadata rows decrease 97 to 52 and total returned rows 201 to 156; two separate native profile queries remain. These assertions establish bounded raw-row reduction in that controlled fixture only, not native K13 aggregate counts or elapsed-time improvement. `context-read-cost-report.md` remains diagnosis, not runtime proof.

## Frozen input verification

All twelve current product/test hashes independently match `context-policy-read-freeze.json`, as do its 26 recorded evidence hashes. Final checks' before/after hashes match the current metadata files. The six non-Agent parallel freeze files remain exact; Agent's parallel recall statement is unchanged within the final composed file. Scope is seven product files and five meaningful test files, with no new production module, registered endpoint or distribution module.

| Final reviewed input | SHA-256 |
| --- | --- |
| `runtimeAgent.ts` | `83a3a37d5b38c35e2aa5bfa20dbbb360de9da7ff093e94816f8dca0ae332c5d2` |
| `runtimeAuth.ts` | `a4c00ccc04536f316e1d9849176791662162e6c285c7b587621dbfca525a46a9` |
| `runtimeModelPolicy.ts` | `50d0fc4418fdb52abfd185237424495f3b8be89cab6208c5b974ac40c4519126` |
| `agentDefinitions.ts` | `17b42ce25e941d16d61fe91673a056d39a35f6792f27ffdb65d68eda5415eb61` |
| Combined twelve-file freeze | `701fb27b9d40237b961643451d4fdacdbe8c013e45162e21c71f45c280382b79` |
| Final check receipts | `b723cb0f39c4245ab5f6d0b8c05a4b69e2aa14b46f5ccd560bd8d3c60f614fea` |
| Predicate/body equivalence | `9b92af8e8fbc5d553a8a31654a1fd7a63bba899435a36f90296bff218dfdeabd` |
| Metadata source report | `bc0806a4f47913042f6a779402c9a92b691dc4e19360e035b6f31f88d2c9044e` |
| Current performance MDX v8 | `0aafdbb9bb5f01e2ba8753f77c60467e5f77fa3013d657d8dab80c88a068ef4a` |
| Exact two-paragraph inverse to accepted v7 | `b13f9f390c286bd5969bf254c33b8e06cd64e2f807ec6575aa066741b6df9cac` |

Full product/test/docs and reviewed evidence hashes are recorded in the companion JSON.

## Dimension scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement fulfillment | 4/5 | All mandatory behavior in this bounded batch is reachable and evidenced; native qualification remains explicitly outside this source gate. |
| Code quality | 4/5 | Isolated read envelopes, owned settlements, deterministic merges, private opt-in and writer/fresh epochs preserve failure and authority boundaries. |
| Test quality | 4/5 | Outcome assertions cover ordering, exact context/envelopes, guard/error priorities, compatibility, fresh save denials and rollback; discovery matches execution with no skips. |
| Pattern adherence | 4/5 | Existing repository/native handlers and invocation scope retained; optional adapter compatibility and exact policy query substitutions remain narrow. |
| Completeness | 4/5 | Runtime wiring, exported contract, five test files, build/package/browser contracts and accurate rendered docs present for the source milestone. |

**Average: 4.0/5.** Adopted minima are met; the average does not override a blocker.

## Findings, retained history and limits

**Breaking findings: none identified.** No authorization bypass, cross-scope access, secret exposure, wrong-target mutation, corrupt/resurrected data, duplicate paid/visible effect, model/budget bypass, unsafe retry/cancellation, normal-use leak or broken supported compatibility was found in the inspected change.

Nonbreaking debt: root lint retains 237 repository warnings. Concurrent failure handling waits for the peer settlement; every original caller/backend deadline is retained, but this source review supplies no native wall-clock or OCC proof. The staged seam is an explicit adapter contract: wrappers that deliberately opt in own their staging guards/bookkeeping.

Observed earlier failures remain failures. The initial parallel affected run has 838 passes/1 failed unchanged tool-witness regression; non-enumerable staging repairs the concrete product bug and the final combined selection reruns that unchanged regression. Earlier incomplete new fixtures and deliberately terminated focused runs are preserved in the parallel report/raw receipts. Metadata focused v1 remains 107 passes/11 failures; focused v2 remains 14 passes/1 failure, with corrections limited to new fixture observer cleanup/count setup. The first QA AST parser refusal remains historical. No original assertion was weakened or dropped.

The K13 installed candidate was the older eb8 product baseline: all four turns completed and native facts/vectors reached 8/8, while all four under-one-second SLOs failed. It supplies no native qualification for this new batch. The latency follow-up remains **2/4 = 50%**, with **0/4** earlier subsecond outcomes; this review does not change those metrics or grant full-goal acceptance. Fresh installed candidate qualification and latency measurement remain necessary before an improvement claim.

No product/docs edits, build/test/browser/service/inference/deployment actions, Git network operations or commits were performed by this reviewer. Only this Markdown report and its companion JSON were written. Review did not access Union Arena or alter unrelated local work. Recommendation: accept this bounded source-and-test batch; continue the existing native/installed latency and final audit gates without relabeling prior failures.
