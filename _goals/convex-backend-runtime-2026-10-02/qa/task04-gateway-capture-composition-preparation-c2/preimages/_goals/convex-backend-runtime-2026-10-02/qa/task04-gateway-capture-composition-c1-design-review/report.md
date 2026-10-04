# Task Judgment: Gateway capture composition C1 design

## Verdict: NEEDS_REVISION

The atomic ordering, accounting independence, persistence-only attachment retry and historical preservation design are acceptable in principle. One exact-boundary mismatch prevents PASS_DESIGN_ONLY: the source contract calls a positive native revision nonnegative and leaves the available identifier-limit authority unfrozen. Repair the bounded source contract before authorizing implementation. No product or behavioral qualification is claimed.

Reviewed producer report SHA256 `81bfa16296c2c5f1c164c364e21a1012777e7a5fcfb0090bfa97c5b4361681df`, manifest SHA256 `21f26e9b9bc3c094779d7f49383f49b38fc2dc95fef159497bc942a88cb32c93`. Independent inspection verified all18 manifest rows,19 recursive files including the self-excluded manifest, and every submitted context source fingerprint. Gateway source and original test match the requested 5bd19780/fc58a25d freezes. Capture runtime files were inspected read-only and copied into this review's preimages; no capture qualification was attempted.

## Requirements Review

| Original criterion / bounded integration obligation | Assessment | Evidence |
|---|---|---|
| All registered operation keys | Preserved, whole-task incomplete | Producer report:90 preserves registry; Task04 and PURE registry remain authoritative. |
| Trusted deployment/tenant/agent/operation policy, pins/options/tools | Preserved with one source-contract correction required | Producer:29–39 preserves exact request/model/root validation; sourceRevision mismatch at:35 versus runtimeModelPolicy.ts:110 and PURE model-policy.ts:79. Structured/tools/Responses and real callers remain pending. |
| Atomic budgets/concurrency; known once, unknown conservative | Design preserved | Producer:43–59 specifies full original-window accounting, unknown reservation, once-only slot release, exact capture/refinement deduplication, no helper money arithmetic. Native extension remains a separate gate. |
| Distinct allowed models/correlated audit/no hidden provider bypass | Preserved, globally unproven | Producer:43,59,93 forbids redispatch/root upgrade; distinct actual models, monetary qualification and caller audit remain pending. |
| Concurrent child/secondary quota before mint/no double settlement | Preserved, globally unproven | Producer:43,74,94 retains admission/checkpoint/ordinal/token denial; equal/conflicting actual native races remain pending. |
| Safe fallback, no visible/tools/ambiguous replay or profile switch | Preserved | Producer:44–49,77 retains every-enqueue/final fences, current replay and exact default profile; no optional unsafe lane. |
| Capture→current attach→eligible delivery | Complete design | Producer:17,25,46–49 removes ordinary postcapture settle/markVisible; pre-part visibility remains. Sink minimum evidenceId is structural compatibility only. |
| Exact hostile RPC acknowledgments and narrow private output | Complete design apart from source rule | Producer:29–39 specifies exact capture/attachment unions, own data descriptors, no coercion, malformed late-promise handling, <=min(root,storage) private canonical bytes, nonempty chat/default dense1536 vector, no raw/reasoning/private charge leakage. |
| Shared finite persistence/late ownership | Complete design with minor clarification below | Producer:53–61 preserves100/1000/100 defaults, single terminal persistence budget, joined pending flights, dynamically joined tasks, sanitized errors and honest unresolved RPC counters. |
| Additive retryPendingTerminalAttachment | Accepted design surface | Producer:57 permits only retained exact previously issued attachment tuples; final withheld/conflict cannot reopen, failed native invocation never returns output, no provider/token/accounting replay. settlement pendingWork slot reuse is explicitly documented. |
| Original78 historical outcomes unchanged and current behavior verified separately | Feasible design; concrete runner qualification pending | Producer:15–21,81–84 explicitly preserves original74+2+2 exact bytes and old source only in HISTORICAL config; new suite must import actual current source and cover original unaffected outcomes plus new atomics. No historical PASS can certify current product. |

## Evidence Review

Read repository AGENTS, runtime/profile, pessimistic-judge, judge-task and feature-orchestrator instructions; original implementation prompt, decisions, architecture, goal and Task04; accepted capture preparation C2 and scoped design review; accepted Gateway source, original tests and C2 independent review; new producer report/source evidence/manifest. Original scope criteria are preserved above, not converted into scoped implementation success.

Static installed-source inspection and integrity verification are recorded in source-inspection.json, with exact argv/cwd/UTC, pre/post hashes, raw inspection output and skips. No behavioral test, discovery, application check, native/service/network/paid/UI action, environment/credential/Git/source/test/config mutation occurred. Exploratory missing-path rg/ls errors are disclosed as lookup failures, never behavior failures. Toolchain receipts are separate; the first ambient npm receipt reports11.9.0 and is not npm12.2 qualification. A corrected separate receipt prepends /workspace/Project-Cortex/work/resume/toolchain-bin and observes Node24.19.0/npm12.2.0 with exit0; the first mismatch is retained. Writes are restricted to this new review and uniquely assigned scratch directory.

Historical source preservation is technically feasible. Gateway's local runtime imports resolve to PURE model-policy/profile; authority, bootstrap and generated Id imports are types. Exact import-path mapping can redirect frozen test imports to an old Gateway snapshot, but placing that snapshot under QA changes its relative-import base. Producer:21 correctly makes a cataloged dependency closure and isolated runner review prerequisites. A closure that copies reviewed modules at the expected relative paths or explicitly resolves just those frozen dependencies can preserve the byte-exact old source; broad moving aliases or ledger/bootstrap replacement cannot qualify it. The accepted review's jest.unit.mjs already demonstrates bounded testMatch, empty setup and scoped discovery, though it does not yet implement the future historical runner. This design review accepts feasibility only: applied configs, import resolution/hashes, exact74+2+2 discovery/outcomes, zero skips and current-suite separation must still be observed independently before implementation/current acceptance. There is no hidden assertion-loss permission.

Lost-response/current-fence behavior is specified: capture retry cannot initiate attachment; attachment retry requires its own retained exact tuple, joins live RPC, repeats only completed persistence failure, rechecks native current rights, and returns bookkeeping only. A late commit cannot revive output or promise rollback. Both healthy and malformed/withheld acknowledgments have explicit dispositions. The original factory preliminary resolve remains outside entered-hook bounds and assigned to Task07. In-memory retention is honestly not durable action-survival recovery.

## Issues Found

### Important — blocks PASS_DESIGN_ONLY

Producer report:35 says sourceRevision is the accepted safe nonnegative integer and defers exact source ID limits to a future freeze. Current native runtimeModelPolicy.ts:110 explicitly requires `integer(source.sourceRevision,1)`. PURE src/domain/model-policy.ts:25 and:79 already define the source IDs as trimmed nonempty strings of at most256 code units and revision as positive safe integer; src/domain/sources.ts:32–36 likewise requires a positive revision. The trusted adapter blueprint therefore admits revision0 locally while claiming exact native parity, and omits a presently available concrete bound. Native denial prevents an authority bypass, but this is a contract error in the specific exact-boundary design being judged.

Repair: pin sourceRevision to1..Number.MAX_SAFE_INTEGER, sourceId/sourceEventId to the existing trimmed nonempty1..256 string rule plus the already-required valid Unicode, and contentHash to lowercase64hex. Cite/fingerprint the accepted PURE/native authority rather than inventing a limit. Add explicit revision0/1/unsafe and ID256/257/empty/whitespace/malformed-Unicode assertions to the planned source row. Keep descriptor-safe detachment and absent-source omission. No product edit is needed for this repair.

### Minor

Producer:53,55,57 should explicitly distinguish the original terminal operation's single shared deadline from a later owner-requested bookkeeping retry's finite persistence deadline. A retry after the original timeout must be meaningful without allocating a second phase budget inside the failed operation. Existing capturePending uses a fresh finite deadline for each explicit lifecycle retry (runtimeGateway.ts:289); the additive attachment retry should state the same bounded owner-call convention while still joining outstanding flights. This is a clarification, not permission for output revival or automatic retry loops.

## Dimension Scores

Code Quality/Test Quality/Completeness are assessed as design quality/validation plan/design completeness for this preparation-only gate.

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 4/5 | Original obligations preserved honestly; exact source adapter boundary requires correction. |
| Design Quality | 4/5 | Atomic liability/delivery separation and persistence-only ownership are explicit. |
| Validation Plan | 4/5 | Outcome/race/late/private/state matrix is concrete and NOT_RUN; add precise source boundaries. |
| Pattern Adherence | 4/5 | Internal native RPCs, original accounts and trusted roots; feasible historical catalog separation. |
| Design Completeness | 3/5 | Source contract contradicts native positive revision and defers available bound authority. |

Average:3.8/5. All dimensions>=4 and Requirement Fulfillment5 are required for this design PASS under judge-task; not met. No security or correctness auto-REJECT is attributed to an unapplied blueprint.

## Recommendation

Revise the source contract and boundary matrix, clarify explicit retry deadlines, then obtain fresh independent design judgment. Accept the historical/current catalog strategy and additive attachment bookkeeping method in principle, with their concrete runner/closure/behavioral gates held. Numeric cycle limits alone are waived; every independent acceptance gate remains. Capture extension/native aggregate acceptance, retirement, Gateway implementation/current tests/quality/independent review, Task07 real composition, actual root/model/token/complete price readiness, all-callsite integration, UI, wholeTask04/full03/Task17 and goal completion remain pending. B native C8 acceptance/retirement and capture122 offline PASS are parent-supplied separate facts, not requalified here.
