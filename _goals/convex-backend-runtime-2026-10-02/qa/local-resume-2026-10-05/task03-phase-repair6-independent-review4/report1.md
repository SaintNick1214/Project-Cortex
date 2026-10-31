# Independent Task03 close-fence repair6 judgment

Verdict: **REJECT — 2.8/5**, limited to the current CODE/HOST contract artifact. The three intended sticky-close guards work: the unchanged original 97 checks plus 35, 7 and 26 independent checks passed. Six additional reachable ownership checks failed. Nothing in this packet approves the whole Source epoch, an adapter integration, private effects, or Task03.

## Critical finding

**P1 — successful-open registration failure loses the newest owned descriptor.** In [phase_partition4.py](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-f2-close-fence-repair6/phase_partition4.py:412), a successful open is followed by insertion into `self.held` at line413, then ledger registration at414. A MemoryError during the first insertion step has no fallback close. The later close loop only sees descriptors already inserted. The independent first/middle/last controls retained one virtual handle100/101/102, attempted zero/one/two preceding closes, and kept the primary MemoryError. The ledger reported zero owned handles and unknown_close=false. With the same mock externally verified original receipt, all phases could still reach ACTUAL_READY. These readiness observations are contract-level mocks; no actual effect or Root release occurred.

The defect is inherited unchanged from A5; R6's three new guards did not introduce it. It still blocks acceptance of the current exported resource contract. Register ownership with a guarded immediate fallback for the newly opened descriptor, preserve primary/cleanup failures, attempt every known close exactly once, and never retry unknown state. Review the adjacent ledger-registration seam in the same narrow successor.

## Bound requirements and original requirements

| Bounded requirement | Result | Evidence |
|---|---|---|
| Reject known sticky unknown-close before preflight, binding and transition callbacks | Met | Direct guards and all six phase first/last/all close controls |
| Conserve original counts/caps, all97 assertions and original phase order | Met |165 PASS; held original controls; AST delta only three methods |
| Complete owned-descriptor lifetime and fail-closed readiness | Unmet | Six registration faults; newest virtual descriptor untracked |
| Independent held-source/cleanup evidence and honest scope | Met |61-input replay,4-input affected controls, separate mature six-document confirmation |
| No actual effects or self-JSON Source authority | Met |Protected action remains denied; all controls use owned fixtures/virtual handles |

All five original Task03 requirements remain OPEN:03A/03B/03C bounded work; full public-path inventory/guards; refreshed trusted identity/bootstrap; scoped direct access and transcript controls; background/revocation/subscription/byte/callback closure. All three original acceptance criteria remain OPEN:alternate-path identity/tenant/scope/share denial; cross-tenant subscription/tool/upload/storage denial; revoked/deleted-grant effects and logout semantics. This contract review runs none of those live application cases. Task03 remains0/3; goal1/17 is bounded Task01 only; product0/12.

## Dimension scores

| Dimension | Score | Reason |
|---|---:|---|
| Requirement fulfillment |3/5|Intended guards pass; complete resource lifetime remains unmet |
| Code quality |2/5|Reachable allocation-registration failure loses an owned handle |
| Test quality |4/5|171 meaningful outcomes,165 PASS/6 FAIL; first/middle/last evidence and state comparisons |
| Pattern adherence |3/5|Constants/authority/order conserved; immediate ownership fallback absent |
| Completeness |2/5|Current exported broker cannot meet its lifetime contract on every path |

Average:2.8/5. No positive Source or functional eligibility.

## Exact execution and custody scope

The replay used exact `/usr/bin/python3`3.9.6 and compiled captured source bytes, without pyc trust. Prepared review3 controls had no earlier literal-nine physical baseline; their first prospective mature capture is explicitly recorded and does not recover historical custody. Control output/fixture binding changed only to this reviewer namespace. Original control loader assignments at lines14/15 were omitted exactly as already specified; assertions and candidate function bytes were unchanged.

The prospective documentary successor changes only the one reviewer receipt's physical baseline after explicit Root authorization. It keeps the failed old tuple and charges both versions. All other original candidate/K/code pins remain strict. The165 replay held61 input descriptors before member bodies, with minimum first-capture age298.491834441seconds; all original-nine/EOF/hash/size checks passed again at the final fence. All61 inner and3 bootstrap descriptors closed once without error. The affected six controls held4 source descriptors; all4 plus3 bootstrap descriptors passed final-nine/EOF/hash/size and closed once. A later mature six-document readback independently confirmed these exact fields and the same R6 pin across intervals, with minimum document age427.196021715seconds and six once-closes.

The final human report is published after those closed control intervals. It is not a claim that all source descriptors remained open through this later documentary publication. Final publishers self-exclude from the source/control intervals and require Root's fresh mature physical readback.

The reviewer uses one cumulative source accounting:64 unique qualified source paths plus six qualified control documents, with the6446-byte failed historical document version additionally charged. Before final publisher-author reads this is831726bytes; the finite manifest records any additional publisher-body read debt and retains the one4MiB MF+1MiB approval+2MiB DATA reservation. The largest simultaneous qualification cohort is64 real source descriptors including bootstrap; virtual4096-handle tests exercise the original ledger cap. No global F2-fit result follows from this small review graph. Original4096/64MiB/16MiB bounds and distinct1914/3828/114/161/138/1907 actual phases remain unchanged and unexecuted.

## Preserved failures and limitations

Prior review2's133PASS/6FAIL REJECT2.8 remains unchanged. The original author/prepared evidence is context, not substitute acceptance. A declarative builder NameError was a reviewer setup fault, preserved with three header closes. The first complete interval denied before member bodies/controls because own source-plan-build-header-receipt2.json changed only ctime; causeUNKNOWN. Its52 inner and3 bootstrap once-closes are preserved, with no retrospective qualification. A native store(undefined) orchestration error lost the returned text but did not change those physical receipts. The disjoint documentary epoch2 neither refunds that version nor refreshes candidate pins.

Whole-current Source census/nonuse/read-debt closure, external authority, current collector/G schema agreement, U3/B3/Root delivery and actual Linux/private/native/retirement gates remain outside this result. My authored facade/U4 packets were not independently judged here. The new Root G candidate was not read in this cohort. No Docker, network, credential, private, target, inference, Git, product or Root tracker mutation occurred.

Exact raw evidence, original/current nines, hashes, closures and stopped producer references are in finite-review-reference-manifest1.json. Root should consume the final named publisher set after genuine current>=240seconds; no producer's own JSON is an adoption authority.

