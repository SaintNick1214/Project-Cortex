# Task Judgment: terminal capture proposal C2

## Verdict: scoped DESIGN PASS

The repaired design closes the two identified accounting/privacy gaps. PASS applies only to this frozen proposal, report SHA256 `052a3bd0e1a919994508ed59e88f296ff9c299d39fce320bef6daf17f1c599e4`. It does not certify implementation, tests, actual native OCC/rollback, target retirement, real token/price/interface readiness, whole Task04, full03 or the goal. The accepted B C2 fixture must finish and its target retire before proposed product changes. Numeric cycle limits alone were waived; independent review and original requirements remain mandatory.

## Evidence Review

Independently read the repository AGENTS, runtime/profile, pessimistic-judge, judge-task and feature-orchestrator instructions; original implementation prompt, goal, Task04, authoritative decision register and architecture; both preparation versions and rejected review. Inspected accepted runtimePolicySchema, runtimeModelPolicy, bootstrap, PURE domain and current Gateway helper. Every source hash in the C2 preparation matches the current file, including Gateway; the submitted report hash also matches. Source fingerprints and comparison results are recorded in source-evidence.json. No service, network, credential, target, application check, product/test/old-QA/Git mutation was performed. Existing untracked Gateway source/test work was preserved.

The current native state explains why the repair is necessary: runtimeModelPolicy.ts:622–629 routes ordinary settle through current origin authority, recover through scoped admin, and deployment reconciliation through positive retirement (:670–685). The proposed capture/refinement path uses stored checkpoint/dispatch and immutable historical root instead. attemptContext (:501–513) already resolves original attempt account IDs and checks original ownership/window bindings without demanding current origin authority. Existing accounting (:650–666) can remove uncertain R, add full C, retain original windows, latch overrun and honor slotReleased; it must become the shared transition helper, with explicit captured-row protections. writeUnknown (:579–595) currently can replace terminal evidence; ordinary first-known settlement (:648–666) currently can persist private result. These are implementation changes required by the proposal, not remaining omissions in its design.

## Requirements Review

| Original requirement or repair obligation | Design assessment and evidence |
|---|---|
| Register chat/extraction/conflict/summary/title/memory/query/text/code/sheet/suggestion/image/video keys | Preserved unchanged; proposal report:3,42 limits this extension to terminal accounting. Existing PURE operation registry remains exact. No claim that this slice completes every callsite/model gate. |
| Trusted deployment/tenant/agent/operation resolution; pinned model/interface/prompt/options/token/tool policy | Preserved; report:7,9,11,13 requires immutable stored qualification/checkpoint/dispatch/model/interface and rejects producer price attestation. Original resolve/admit/checkpoint controls are not relaxed. Historical qualification retention is explicit; unavailable root cannot be upgraded by receipt claims. |
| Atomic run/tenant/operation budget/concurrency; known once; unknown conservative; safe fallback | Met as a design obligation: report:9–15,21–27,38–40 specifies known-full-C, uncertain-R, original-window updates, overrun latch, terminal-proof-only slot release, no double release, and shared once-only transitions. Unknown remains nonreplayable; reserve/checkpoint/fallback eligibility stays unchanged. |
| Distinct allowed function models/correlated receipts/no hidden provider bypass | Preserved original requirement; report:7,13,40,42 adds no model selector/provider route or public proxy. Actual models/interfaces and full secondary callsite coverage remain outside design acceptance. |
| Concurrent submissions and child/secondary calls cannot bypass reserve/double settle; quota denies before mint | Preserved admission foundation. report:22–25,38–40 requires exact initial/final retries, equal refinement one delta, conflicting known loser zero writes, real parent rollback and no provider redispatch. These are planned outcomes, not executed evidence. |
| Fallback cannot repeat visible output/tools/ambiguous paid jobs or change profile | Preserved; report:15,32,36 and original preparation attachment validators require monotone visibility, closed unknown attachment, current delivery fences and exact persistence-only retries. No fallback/profile relaxation. |
| Trusted unknown→known capture after origin revocation while tenant/space remain LIVE | Repaired fully: report:11 provides unknown100→known150, immutable supported aggregate/proof, no origin/admin/tombstone requirement, full original-window accounting, overrun, zero extra slot decrement and closed attachment. This is liability-only authority; no data privilege is revived. |
| Immutable initial canonical/hash/evidenceId; compatible additions only | report:13,15,22–25 pins initial non-money version/dispatch/receipt/model/interface/outcome/proof and every known actualModel/usage fact. Only absent compatible facts can be added with complete supported money. Initial identity never changes; final receipt canonical/hash is once-only; exact bytes defeat digest collision. Intermediate unknown variants and conflicting final cost deny. |
| All settle/recover/operator/writeUnknown coexistence paths | report:26–30 explicitly shares compatibility/accounting and preserves actor/retirement fences, initial evidence and attachment state; captured receipts discard private payload; writeUnknown cannot downgrade or overwrite. Grant-renewal ordinary-settle known150+privateResult regression is concrete. |
| Legacy/partial-marker/closed attachment privacy | report:28–32 makes missing state closed for new attachment, partial marker fail-closed, legacy existing valid results preserved, and unknown closure permanent after renewal. Only attachTerminalResult can store captured-row private result. Current-authority/source/parent/policy/cancel checks and bounded result validators are retained from original preparation. |
| Minimal field/API and owner boundary; accepted fixture sequencing | report:3,7,32,40,42 retains two optional fields/two internal mutations, no table/index/worker/bootstrap/PURE/schema.ts/generated/config change. Gateway port/order changes have separate ownership. Accepted C2 closure remains frozen through completion and retirement. |

## Dimension Scores

This is a design gate. Code Quality is assessed as Design Quality; Test Quality as Validation Plan; Completeness as Design Completeness. Passing planned outcomes does not claim observed checks.

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 5/5 | Every original criterion is preserved with honest incomplete whole-task status; both prior blockers explicitly repaired at report:11–15,26–30. |
| Design Quality | 4/5 | Small attempt-row atomic design, immutable initial/final identities, explicit compatibility matrix and accounting-only authority. Minor Gateway semantic-contract wording below. |
| Validation Plan | 4/5 | Outcome/race/retry/collision/rollback/live-revocation/coexistence/legacy tests are concrete at report:38–40. No implementation or execution claimed. |
| Pattern Adherence | 5/5 | Internal Convex registrations, strict bounded canonical receipt, native IDs, original accounts and trusted immutable root; no caller trust flags or extra worker. |
| Design Completeness | 4/5 | Interfaces and shared-helper/attachment integration requirements cover the rejected gap; later implementation/native fixture freeze and real readiness remain distinct gates. |

**Average: 4.4/5.** All dimensions are at least4 and Requirement Fulfillment is5, satisfying judge-task's PASS threshold for this design scope.

## Issues Found

### Critical (must fix)

None in this design. The rejected live-revocation refinement and captured-row legacy privacy gaps are resolved explicitly.

### Important (should fix)

None blocking design acceptance. No consequential technical conflict requires a user decision.

### Minor (consider fixing)

Gateway runtimeGateway.ts:37–46 currently defines a capture-only sink that MUST NOT settle money, release slots or change visibility. Proposal report:36's `{evidenceId}` compatibility is structural only. The already-required future Gateway owner must update this semantic contract/comment as well as the typed attach port and terminal order (:250–279). Atomic capture must never be wired to the current frozen helper unchanged. This is an acknowledged integration dependency, covered by original preparation's explicit ordering conflict and C2's remove-postcapture-settle/markVisible requirement; it does not require a broader architecture or new user choice.

## Recommendation

Accept the repaired proposal as a DESIGN only. Finish and retire accepted B C2 against its exact frozen hashes, then freeze a separately owned extension candidate. Implement shared capture/refinement/legacy accounting protections and current-authority attachment before changing Gateway wiring; preserve all64 accepted C2 assertions. Obtain fresh implementation judgment, meaningful offline results, and actual nonpaid native OCC/rollback/internal-registration evidence for the new candidate. Keep actual tokenizer/price/model/interface readiness and remaining original Task04/goal requirements incomplete until separately observed.
