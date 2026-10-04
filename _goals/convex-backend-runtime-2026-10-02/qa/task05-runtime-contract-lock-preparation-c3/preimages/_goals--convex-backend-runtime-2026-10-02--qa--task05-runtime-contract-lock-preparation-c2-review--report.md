# Task05 three-contract lock C2 independent design judgment

## Verdict: NEEDS_REVISION

Average **3.6/5**. The frozen public-v1 shape conflict is repaired, but the exact C2 detached mapping/binding helper does not enforce its declared strict JSON and canonical-size contract. Seven fresh counterexamples establish two concrete blocking evidence defects. This is a bounded design/evidence judgment, not a product admission vulnerability finding or Task05 implementation acceptance.

Reviewed C2 report SHA256 `29a2a6a7408329a2406188dfee820917818f7e51a09f7d3bbf451b1cfc4958fa` and manifest SHA256 `c890e00f80fd6e0685357ab00f1e8e98dbe10b2d014183e2f17bcb1e5bcdaa36`. Independently verified **109/109** artifact sizes and hashes with zero mismatches. Original preparation manifest is `d5223874d4b489eb15840355846965f903cdf2357136a1a0b7c1f84a2a5df729`; its separate count is **65**, and all65 rows remain unchanged. The predecessor's concatenated digest/count typo remains disclosed, not edited. Prior NEEDS_REVISION3.8 report `929a10afb6f49e283ce34033bd0e37b7c95fdc8307f6b5a2364e1978f230a2a5` and79-row manifest `6d436fc3822dedd53a2e59a515bbff4782f8c50e153d6b3e804eb47c4b69caf5` remain immutable failures.

## Critical issues requiring repair

1. **The reference normalizer accepts non-JSON graphs and invokes untrusted array behavior.** C2 report:64 requires rejecting inherited/accessor/non-JSON values while preserving exact ordered parts;:65–80 describes detached canonical mapping using existing canonicalModelJson. In `work/resume/task05-runtime-contract-lock-preparation-c2/mapping-probe.mjs:4`, object descriptors need only contain `value`, allowing nonenumerable fields. At:6, parts only passes Array.isArray/length before `input.parts.map`. Fresh `fresh-semantic.stdout` proves six accepted inputs: a sparse array canonicalized to a null part; an element accessor evaluated once; an overridden map executed once; an extra array key silently discarded; a foreign array prototype accepted; and a nonenumerable public agentId accepted. These are assertions against the exact helper body in its own VM realm, avoiding cross-realm prototype false positives. Actual `src/domain/model-policy.ts:240` canonicalModelJson rejects the sparse/accessor/extra-property/nonenumerable examples, with accessor call count zero. The standalone helper's permissive C at:3 is therefore not the declared existing canonical serializer. Repair the NEW reference validator to descriptor-validate the entire graph before reading/mapping, detach through the actual strict canonical serializer, and add all six rejection/no-execution outcomes. Preserve the existing11 mapping assertions and frozen public fields.

2. **The reference binding omits the canonical UTF8 byte ceiling.** C2 report:52 explicitly caps requestCanonical at180000UTF8 bytes before effects. `mapping-probe.mjs:7` serializes without measuring/rejecting the result. A valid120000-byte text consisting of U+0000 produces an accepted **720195-byte** requestCanonical. This is a valid JSON text-value expansion, independent of the hostile graph cases. Raw and escaped text byte counts are separately asserted in fresh-semantic.stdout. Enforce the cap on the completed sole wrapper `{version:1,identity,publicRequest}` before dedup allocation/budget binding, and demonstrate equality/over-boundary behavior including JSON-escaped text and multibyte text. Do not lower frozen expectations, trim text, collapse parts, or alter identity to make the check pass.

The requirements themselves are feasible. These defects affect the C2 semantic reference evidence offered for those requirements, which must be repaired and freshly reviewed before design acceptance. The original11/13 group probes passing does not override these uncovered outcomes; no future product validator was executed.

## Evidence review

Read AGENTS, runtime/profile, pessimistic-judge, judge-task and feature-orchestrator; original implementation prompt, authoritative decisions/architecture, goal and Task05; frozen01; accepted canonical preparation, consumed-contract review and acceptance; current policy/auth/memory contracts and installed Agent src/dist. Exact source/config/authority/probe preimages were saved before execution. Postimages and final source preservation compare the same bytes, with zero changes. Interactive discovery reads remain tool-transcript evidence, not retrospectively invented timed commands; initial shorthand qa did not exist and broad discovery output was narrowed after truncation.

Fresh Node24.19.0/npm12.2.0 observed after PATH prepend to work/resume/toolchain-bin. Original compatibility assertion remains RED exit1; the unchanged C2 same assertion exits0. Static output recognizes diagnostic quotations, so its pass alone is not compatibility proof. Copied mapping11 and hostile13 scripts preserve all existing assertions and pass11/11 and13/13 with no skipped groups. Fresh-semantic exits0 because it asserts and records the seven defects, plus independent fixed-field boundary/identity assertions and actual strict canonical serializer rejection. A successful counterexample probe is **failure evidence for the reviewed helper**, not a green qualification. Every probe retains argv/cwd/start/endUTC/exit/signal/rawstdout/stderr; capture runner itself was fingerprinted before execution. Administrative Python records files/hashes/argv only, not Python SDK QA.

The actual ledger existing-account branch returns runBudgetId separately from runAccountId, writes zero times on replay and conflicts on changed canonical payload, version or authority. Fake helper dependencies are explicit. Current budget initialization has zero counters and no full-envelope reservation; Contract1 scopes the identity to trusted tenant/space/principal, create/existing conversation and original client key, independent of text/model/context. Changed agent/text/part structure preserves identity and conflicts exact bytes; collision checks and absent-create resolved conversation reuse are specified. Replay checks current authority without rebinding. Parent bindTrustedBudget remains the sole admission seam; runDocId is never the ledger ID. New-account root resolution, OCC/concurrency and actual rollback remain NOT_RUN.

Contract2 retains the same-context owned immutable definition reader, source-resource authorization, scoped admin publication/revocation, exact version/hash and narrowed policy hook. Registry metadata supplies no authority; admin is not wildcard, tool/context permissions remain separately current, source-only jobs cannot bypass runner/definition currentness. Actual hostile scope probes admit exact owner and deny foreign owner/space/tenant. Policy pricing/interface/root qualifications remain current04 fences. No extra public privilege or approval/context input is introduced.

Installed Agent0.7.3 imported saveMessages accepts explicit mutation composition, forwards next order/no embeddings/failPendingSteps=false and returns all IDs. Actual installed list handler includes later same-order steps, widens missing/deleted anchors and denies foreign-thread anchors. Contract3 requires existence/thread/lexicographic position/exact-ID/source revision/hash fences, queue ownership and current authority. Exact cutoff is separate from final reconciliation; all final same-order assistant/tool parts must still register beyond100 across pages, with older pending holes, deletion/cursor repair, receipt tuple and exact canonical bytes. Actual custom contextHandler replaces the assembled messages, but recent/search retrieval and embedding work must be disabled and post-handler approval/localhost transformations qualified. Continuing promptMessageId saves no second input but creates a pending assistant with failPendingSteps; serialized attempt qualification remains mandatory. No impossible installed-source seam was established, and no docstring/string check is treated as product behavior.

## Requirements review

Covered means retained design obligation, never product complete.

| Requirement | Finding |
|---|---|
| Frozen flat public `{version,agentId,agentVersion,conversationId?,clientRequestId,parts}` | Explicitly preserved; distinctly named NormalizedAdmissionV1 maps optional creation, agent selector and exact ordered text parts |
| Strict public limits/detachment/canonical exact bytes | Specified, but reference evidence has the two blocking defects above |
| No undeclared metadata/privacy/approval/branch inputs | Preserved; trusted current backend defaults recorded on first acceptance; current policy can deny replay without changing accepted identity |
| Full richer creation/fork/access/share/retention | Remains mandatory through separately authorized conversation/fork flow; no scope exclusion or Task05 completion claim |
| Stable conversation map/typed transcript/access/share/retention R1 | Sole Agent store and original restoration/statistics/A2A/share criteria retained |
| Executable definitions/backend tools/context/policy R2 | Immutable/current owned reader and policy composition hook retained |
| Atomic input/dedup/budget/enqueue, deterministic queue/explicit forks R3/A1 | Exact identity/bytes, sole parent binding/durable intent specified; native convergence/rollback/recovery mandatory |
| Statuses/attempts/cancel/approval/output/export/delete R4 | Retained without conflating response/memory completion or reusing stale output |
| Administrator lock, authorized reads, unlocked same-store edits/revisions/invalidation A2 | Original criteria remain mandatory; lock never grants authorization or denies otherwise eligible reads |
| Recoverability/projection rebuild/private context exclusion A3 | Durable intent/full outbox and allowlisted DTO/privacy tests retained; actual crash/serialized privacy/UI NOT_RUN |
| Exact IDs/positions/revisions/hash/anchor cutoff and pending eligibility | Contract3 retained; actual native context/cursor/currentness gates remain required |
| Original mapped03/current ledger/assertions/full05 functional coverage | Preserved, no unavailable/fake-zero substitute or dropped original criteria |

Contracts2/3 are independently compared byte-for-byte with the predecessor in preservation-comparisons.json. Original hostile13 script equals the prior independent review's script; the original preparation's distinct smaller probe is separately identified and never mislabeled as the13-group source.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment |4/5|Frozen public repair and all original obligations retained; strict/size evidence incomplete |
| Contract/reference quality |3/5|Feasible seams, but exact helper admits non-JSON behavior and oversize canonical request |
| Test/evidence quality |3/5|109 hashes and original11/13 assertions preserved; seven fresh gaps block semantic freeze |
| Pattern adherence |5/5|Scoped immutable review, same Agent store/current grants/one ledger binding, no product or history mutation |
| Design completeness |3/5|Two bounded reference/evidence repairs required before fresh design acceptance |

**Average:3.6/5.** Blocking findings prevent PASS_DESIGN_ONLY regardless of numeric review-cycle waiver; waiver does not waive acceptance gates.

## Preservation and remaining gates

Only NEW qa/task05-runtime-contract-lock-preparation-c2-review and unique work/resume/task05-runtime-contract-lock-preparation-c2-review were written. No product/tests/oldQA/generated/Git/subagents/private C8 target or scratch contents/network/keys/env/JWT/signing/services/RPC/native/paid/UI actions occurred. No application runner, build, lint or native checks ran; those remain NOT_RUN, and no skipped required coverage is labeled PASS.

Parent context updates actualB source to `bed10cc3934aac6743ff0cb08911765d84e9db18446cd8aebff979815068207f` and reports completed nonpaid C8 qualification with retired delete200404 and736 created/deleted, now under a separate aggregate judge. Those are coordination facts, not independent observations here. The reviewed report's active-C8 wording records its creation time. This review neither changes B/C8 nor substitutes for accepted terminal capture implementation/full04 aggregate. Task05 implementation remains HELD until all original accepted prerequisites/full04 gates complete. Historic canonical/consumed acceptances retain their exact scope; this new NEEDS_REVISION remains independent and immutable.

Repair only a new bounded preparation packet/reference helper, preserve all historical reports/failures/expectations, then rerun the unchanged11/13 groups plus these exact hostile/size outcomes and obtain a fresh independent review. Final self-excluding recursive evidence-manifest hashes all review and unique scratch artifacts; its own digest is returned separately.
