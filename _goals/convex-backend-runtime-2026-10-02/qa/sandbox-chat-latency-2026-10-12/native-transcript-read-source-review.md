# Native transcript read reuse: joint source, tests and docs judgment

## Verdict: PASS

One independent nonauthor review accepts this frozen three-product-file/two-new-test-file batch and current v12 documentation at **4.0/5**, with **zero unresolved breaking findings identified**. All five dimensions score 4/5 and meet the adopted functional policy. This verdict covers source behavior and observed bounded checks; it does not accept hosted OCC/readset behavior, native latency, the subsecond SLO or full-goal completion.

Core checkout: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion` (SaintNick1214/Project-Cortex). Docs checkout: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs` (SaintNick1214/cortexmemory.dev). Current HEAD `2668cde1d3176d2902f8375ca35fe80112c9af96` changes QA artifacts only after product baseline `2c8689fac3aca2acf1fb1f46d8b10a87388e95cd`. All three retained product preimages independently match that actual baseline. Production scope is runtimeAuth.ts, runtimeTranscript.ts and runtimeAgent.ts; tests are native-transcript-read-scope and native-transcript-read-parent. No existing product assertions or Workflow journals were removed.

The already-read AGENTS.md, runtime/profile, pessimistic-judge role and judge-task rubric are applied under acceptance-policy v2: requirements/tests/completeness ≥4, code/pattern ≥3 and no breaking findings. Numerical review cycles are waived; product assertions and deadlines remain. No retired controller/custody/census gate or separate routine-receipt judgment was added.

## Requirements review

| Requirement | Met | Source and meaningful outcome evidence |
| --- | --- | --- |
| Keep both original logical native reads and all canonical/private/source checks | Yes | `hydrateCutoff` and `hydratePrivateCutoff` are byte exact (`runtimeTranscript.ts:352-408`); their two nativeById calls remain. verifyMessage, canonicalMessageHash, privateModelMessage and currentPrivateSources also match the baseline literally. Interleaved completed/pending/failed component-writer tests assert two actual official lookups and the completed writer's original STALE_TRANSCRIPT denial. The rejected global hydration shortcut remains historical, not accepted. |
| Reuse only exact raw official getMessagesByIds results with exact function/ordered-ID namespace keys | Yes | `runtimeAuth.ts:50-99` uses the complete official function address plus ordered messageIds as its key and invokes unchanged `{ messageIds }` arguments. `runtimeTranscript.ts:92-94` supplies the same installed Agent component reference. Installed Agent0.7.3 messages.js:591-595 reads each requested message ID and applies a pure field projection; first lookup retains the relevant raw component readset in the supported in-memory transaction. ID ordering, missing/null rows and detached values are asserted. No generic query/source/pagination or decision cache was added. |
| Bound retained values at sixteen entries and 250,000 accounted raw-value/key bytes; fall through safely | Yes | Capacity and byte accounting guard insertion at `runtimeAuth.ts:59-60,92-94`; overflowing calls still perform the original lookup. New scope tests reach the key limit and oversized message fallback. Recursive existing Convex-value cloning preserves detached values; mutations of a returned message do not alter later reads. These are retained raw-value accounting bounds, not a promise about JavaScript heap size. |
| Only three V5 native parents opt in; nested helpers share raw reader; no cross-invocation or Action state | Yes | Explicit activations are prepareTurnModel, prepareResolvedModelOperation and admitPreparedModelOperation (`runtimeAgent.ts:740,747,822`), each with nativeTranscript and existing policyMetadata options true. Native reader inheritance is limited to the hidden same-parent context symbol (`runtimeAuth.ts:143-149,198`). Raw-reader tests and actual installed-component fixture prove nested reuse and separate native/Action-query invocations. Default/unscoped callers remain uncached. |
| Every DB/component writer invalidates before/after, pending writers suppress hits/population, and late/errors cannot repopulate | Yes | Existing insert/patch/replace/delete and runMutation interception brackets the shared reader's write counter and epoch (`runtimeAuth.ts:178-201`). New scope tests cover all four DB writers, nested scopes, child success/failure, pending suppression, uncached read failure and fresh/write late-epoch refusal. Installed Agent updateMessage plus core DB insert expose updated values, and actual cross-component parent failure rolls both stores back. |
| Fresh original context-save fence clears both raw namespaces; no authorization/model/control bypass | Yes | `runtimeAgent.ts:628` clears policy metadata and raw transcript namespaces before the untouched saveContextHandler/re-probe. Existing metadata tests, current-policy/V5 admission/source/expiry/rollback tests remain in the final selection. Whole-parent differential tests compare actual original/current output and complete state, plus grant/native-content/bridge/cancel/lease/qualification refusal/rollback. Three-parent policyMetadata activation is reviewed as part of this batch, not silently inherited from a prior acceptance. |
| Preserve current canonical/private/owner/grant/deletion/tombstone/profile/budget/qualification/source/lease checks and journals | Yes | Independent read-only declaration comparison confirms runtimeAuth35, runtimeTranscript46 and runtimeAgent86 original declarations exact: **167 total**. Changed originals are only createAuthorityReadScope, nativeById, the fresh-save call and three parent registrations. All V1–V5 Workflow bodies and both callbacks are byte exact. execution/current model admission, cutoff, source/witness, terminal/delivery/observation and original Action bodies remain original; current validations still execute rather than retaining their decisions. |
| Meaningful affected checks and docs; no native speed acceptance | Yes | Raw standard Jest JSON has 1,924 passes/46 suites/no failed/pending/skipped/todo; discovery equals execution and retains all earlier44 suites. Current types, scoped/root lint, build and contracts pass after erased-only test typing correction. Actual installed Agent/convex-test fixture passes five checks without cloud/provider calls. v12 docs accurately preserve K14/K15 failing measurements and product-target limits; build/render evidence and six retained pages are verified. |

## Snapshot/readset evidence and practical limits

The installed official lookup is a pure ordered set of component db.get calls followed by removal of private storage metadata fields. Reusing its raw result only before a writer in the same invocation preserves the data consumed by the unchanged validators; it does not save a permission or validation decision. Both source-level validation passes remain, so a writer between them forces the second official lookup. Native and policy reader clearing at the original save boundary ensures the later complete save fence remains fresh.

The separate convex-test0.0.61 fixture registers the actual installed Agent0.7.3 schema and component handlers with Convex1.46. All **five checks pass**: same-scope/nested detached reads, fresh-query isolation, component plus core write visibility, cross-component parent rollback, and separate Action query scopes. It records eleven official lookups, zero provider calls and zero cloud calls. This is actual supported **in-memory** component/transaction evidence, not hosted engine/OCC scheduling or a measured cloud readset reduction.

Differential controls retain original product TypeScript preimages and resolve their original modules; original Agent control imports original Transcript control. Exact output and complete rows/writes/native/effects/scheduled state compare equal for all three current parents. Raw official calls in that controlled graph are **32→9**, **16→3** and **12→3**, respectively. Those values are not K15's source-level nine-hydration/18-call subset, physical database-read counts, predicted wall savings or a guarantee of improved latency.

## Tests, types and final checks

The 46 unique discovered suites equal the standard Jest executed suite set. Every assertion status is passed: **1,924 passed, zero failed/pending/skipped/todo**, observed exit0. All earlier44 suites are retained; counts overlap and are not additive. The two new suites have thirteen raw-reader and nine full-parent cases. Outcome assertions cover exact payload/state equality, no effects on denial, error order, source canonical changes, writer races, failed/late reads, limits and isolation. Existing full V5 Action/reconcile/barrier/approval, auth, model/budget/fallback, transcript, memory and ingestion assertions remain selected.

The initial root typecheck remains exit2 for two overloaded bound-method spread types. Final correction changes only two erased Parameters/ReturnType casts and retains full argument forwarding. Independently reversing those casts restores exact retained/passing source SHA `feae1df339d3ed48e238be8ce0436bce052c47175a0b9f5e7c94f2d712838f46`. The before/after emitted-JavaScript hashes in the type-equivalence receipt are both `ecf660e38460b7384bc328565c9620cec49b6d3453175cdc98a0b30cdaf11a71`. Current root types v3 exit0 records all five current hashes. Thus the passing tests apply to the final executable/assertions without a redundant broad rerun.

Final backend types, scoped ESLint, root lint, build and packed contracts each have observed exit0 and current before/after hashes. Root lint retains **237 warnings/zero errors**; scoped lint is clean. Build retains **157 backend source files/72 tables/two components** with no deployment. Raw contracts explicitly pass packed root/runtime/graph ESM+CJS, backend manifest bytes, consumer declarations, URL round trips and browser execution. Node24.15.0/npm12.2 and explicit offline execution are recorded. The reviewer did not rerun product checks or the installed-component fixture.

## Final frozen inputs and documentation

All five current source/test hashes independently match `native-transcript-read-freeze.json`; all **28** recorded receipt hashes also match. The final source report, root-types-v3 receipt, remaining-checks packet and type-erasure applicability were read before issuing this verdict.

| Input | SHA-256 |
| --- | --- |
| runtimeAuth.ts | `a69c9089b017b82fb0307df8fffac7fab9766a1715959fa0de0e3c10ba8f7817` |
| runtimeTranscript.ts | `3685b510a76589246d0ff8ccdc2d2e90a9f2470b2857f35b0cb65d1ff8533765` |
| runtimeAgent.ts | `0abf300d9a6431c4b3525e10a1f89d645511f30c97844ab2a7dd775be7881e7e` |
| native-transcript-read-scope.test.ts | `769b378fe6065c9d9b888e72797aed0a20e3fe5b28f307067acaa5955ae77d4f` |
| native-transcript-read-parent.test.ts | `13ced23472fe28af13918e7310b1017d3b27c6f7eff53dfac0a0afb85a692768` |
| Source report | `4894161fdd5b82133969ecbf5ed7fe14704b8e25ada6c0f2ba21ae219b23f26c` |
| Five-file freeze | `eb0a8ac143529c20b3ef910b62363bf002fcaa24e175bc4794e5a2eaef30703b` |
| Current performance MDX v12 | `8d1568cbd7815687b93d7d0b222dad8143c27d42d82cc2ce8738a85506b4c155` |

All seven relevant doc pages were checked: only performance.mdx changed, and the other six match prior accepted bytes. Current MDX, generated HTML markers, raw Docusaurus build exit0, actual IAB observation and saved v12 screenshot agree on V5 and the latest K15 result table. Browser zero warning/error observations are scoped to100 entries. Browser is closed; the recorded documentation server exit after Ctrl-C is1, not a claimed successful normal server run. No publication or new whole-site QA is claimed.

The authorized Q-only fixture scratch is absent. Its exact lock/integrity/module receipts remain, and current core package/lock hashes match their before/after cleanup hashes. Original control modules remain required fixtures for the new differential tests; retain them or their reproducible generation inputs with the coherent batch. This is a supporting dependency note, not a separate custody gate.

## Dimension scores

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement fulfillment | 4/5 | Bounded raw-read behavior, original logical reads/fences, parent activation and docs are reachable and evidenced; hosted qualification remains explicit. |
| Code quality | 4/5 | Narrow opt-in, detached values, finite retention, exact namespaces, shared writer epochs and explicit fresh save avoid decision/stale-state caching. |
| Test quality | 4/5 | Actual original/current parents, interleaved writers and real installed-component transaction cases verify meaningful outcomes; discovery/type applicability clear. |
| Pattern adherence | 4/5 | Existing native authority scope, raw-value clone and writer interception extended; original validators, journals and model/delivery paths retained. |
| Completeness | 4/5 | Three parents wired, helpers/types/tests/controls, current checks and accurate rendered docs complete this source milestone. |

**Average: 4.0/5.** No average overrides a blocker.

## Findings, retained failures and remaining native scope

**Breaking findings: none identified.** No concrete authorization/model/budget bypass, cross-scope access, secret exposure, wrong-target effect, data resurrection/corruption, duplicate paid/visible action, unsafe retry/cancellation, normal-use leak or supported API break was identified in this batch.

Nonbreaking debt/limits: root lint retains237 warnings. Raw-value accounting is not a JavaScript heap ceiling, and extra cloning/transaction work may offset fewer lookup invocations. Source and in-memory checks provide no hosted OCC or latency acceptance. Differential controls are supporting test fixtures; the optional real-component helper requires recreation of its removed owned scratch from retained lock inputs.

Earlier failures remain failed: new-v1 has10 passes/8 failures (missing test import); focused-v2 has69/1 (new exact-ID count fixture); new-v2 has17/2 (new observational counts); new-v3 has17/5 (updated original-read counts and new interleaved fixture setup); initial root types retain exit2. The global hydration shortcut is explicitly rejected; both original logical calls and their interleaved-writer regression remain in the final candidate. Final assertions still require exact original outputs/state/denials, rollback and the second lookup. No original assertion/deadline was weakened or failed run relabeled PASS.

The saved K15 packet belongs to older product source2c868 and records browser first/warm7,499.000/6,980.100ms and CLI12,836.418/14,649.508ms under the original30,000ms deadline: **all four subsecond SLOs FAIL**. Its capped snapshots, nested engine sums, fixed clocks, opaque acquisition and discarded conflict-attribution fields remain limitations; this cache batch cannot recover that absent data or turn source call reductions into measured savings. K15 functional facts/vectors/usage and cleanup evidence do not qualify this new candidate.

Fresh installed native qualification, readset/OCC/concurrency and actual provider/original-deadline measurements remain required before claiming runtime performance or full-goal completion. The latency follow-up remains **2/4=50%**, with no completion credit from this source verdict.

Reviewer actions were read-only inspection and the two requested review reports. No core/test/docs/package edits, build/test/browser/service/inference/deployment execution, Git network operations, commits or unrelated repository changes were performed. Recommendation: accept this bounded source/test/docs batch and continue the existing fresh native qualification and measured latency gates without relabeling historical results.
