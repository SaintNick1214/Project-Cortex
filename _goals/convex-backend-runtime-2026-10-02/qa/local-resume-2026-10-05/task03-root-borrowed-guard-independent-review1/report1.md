# Independent Task03 Root borrowed G guard seam review

## Verdict: REJECT — 2.8/5

This is a bounded CODE/HOST judgment of Root's proposed borrowed guard, SHA f799f1b1bcfd971be32b89ee88285e7d4d820b870330f63a592c998a78ff1eed. It is not approval of the underlying facade I authored, the phase module, a complete Source graph, a protected action, or Task03. N1 REJECT2.6 and Root R6 REJECT2.8 remain unchanged.

The actual replay executed112 conditions: the exact18 bridge author controls and71 underlying facade regressions passed;23 fresh independent conditions yielded18PASS,4 candidate FAIL, and1 reviewer setup FAIL. The setup failure is excluded from candidate findings. No checks were skipped or retrospectively relabeled.

## Confirmed failures

### P1 — Metadata failure escapes the parent lifetime

In source-gates-borrowed1.py:155, acquire calls owner._fence before read's catch at159–165. Independent first/middle/last fixture rows0/2/5 inject a single changed fstat ctime into the actual real SourceSession/BorrowedSourceLease/RootBorrowedGuardLease assembly, using virtual IO. Each first read is denied, but restoring the original virtual metadata permits a subsequent ordinary read. The second required denial is absent. No parent failure remains sticky.

The three raw conditions are first_middle_last_metadata_failure_is_sticky_0, _2, and _5 in independent-control-results1.json. Each returns AssertionError: required denial absent at the second must_deny call. The owned fake descriptors are cleaned by the fixture; no real descriptor or protected input is involved.

Wrap the acquisition fence as part of the sticky failure boundary, including direct acquire callers. Preserve the original exception and record it on the Root owner before propagating it. Do not replace the original tuple or treat a later matching observation as recovery.

### P1 — Guard-local DATA cap failure is not sticky

In source-gates-borrowed1.py:168, the per-path RELEASE_DATA_NAMES assertion occurs after the sticky catch. A 32769-byte coordinator-status body violates its32768-byte cap but leaves the parent usable; after restoring the fixture methods, a normal guard read succeeds.

This unit control explicitly replaces only acquire, borrowed.read, and check_owner for the first local read boundary; G.read's actual held bytecode is unchanged. It restores all three methods before the subsequent whole normal read. This demonstrates the local guard defect, not an actual collector/dispatcher DATA delivery or physical oversized control. The raw condition is guard_local_release_DATA_limit_failure_stays_sticky.

Move the local cap and post-read owner checks inside the same retained failure boundary. Retain every original cap and assertion.

## Reviewer setup failure, not a candidate defect

post_constructor_cap_bytes_denies_before_body assigns Ledger.byte_count. It is a read-only property, so the oracle raises AttributeError: can't set attribute before exercising the guard. This interval and result stay immutable. This check supplies no candidate budget failure or PASS. No rerun is needed to establish the confirmed rejection; a separate future corrected oracle is required before positive byte-bound coverage.

## Preserved behavior and meaningful coverage

Executable AST comparison confirms all11 unrelated original function/class definitions, all28 original qualifier assertion nodes with multiplicity, and every original top-level import/assignment are identical. Only source_read and qualify_sources are adapted, plus the new RootBorrowedGuardLease definition. Original G remains unchanged.

The whole original qualifier succeeds with the complete modeled manifest/plan/approval graph. Projections expose no fd. Borrower release closes zero descriptors, changes no ledger byte count, and leaves all six with Root. Exact false/integer1/None external authority is denied before body reads. Unknown-close, existing primary, closed owner/borrow, and descriptor-cap states deny before body IO. A dirty external callback cannot enable a subsequent body; SystemExit remains the original exception. First/middle/last body-hash failures are sticky. First/middle/last Root close faults attempt all six owned closes once, mark UNKNOWN, transfer no close duty, and do not retry.

The71 facade regressions are scoped regression observations only. They do not independently judge or approve N, and they do not override its rejected unknown-registration behavior. The injected Root R6 code is similarly not adopted.

## Physical custody and limits

The exact three discovery headers40,846B and the exact15 Root-known member files172,129B passed descriptor-first fullEOF/hash/size/all-nine/final checks and3/15 once-closes without error. Source inspection is separate from the later controls. The fixed control interval held25 sources290,850B before member bodies, with minimum first-capture age282.418200494s. All25 original PRE/OPEN/POST/FINAL/path-final nines, exact SHA/size/fullEOF and final full-content hashes were confirmed; all25 closed once, zero errors. No primary, publication or close failure occurred in that actor interval.

A later first prospective producer-only capture held four closed documents79,214B, minimum age298.563052057s, before body reads; fullEOF/hash/size/all-nine/final and4 once-closes passed. It independently checked every25 source row and close entry and both bootstrap header rows against the same later25 graph. The current raw receipt is mature-control-receipt-confirmation1.json. Its publication, this report, verdict, finite manifest and final stop are selfexcluded until Root's later mature publisher-only read.

The conservative nonresetting debt is1,713,399B before author publication rendering: prior1,130,360 + headers40,846 + inspection172,129 + control graph290,850 + producer documents79,214. Repeated unchanged inspections are conservatively charged again. The one original4MiB MF +1MiB approval +2MiB DATA reserve remains7340032B; no per-subgraph budget reset or metadata exemption is used. The finite manifest logs additional author document-read debt and later publisher admission debts explicitly. The inherited path ceiling uses104 prior admissions conservatively, plus current declarations, with32 descriptor allowance; no inference of whole F2 fit follows.

Native fixed invocation code and ordinary author syntax/inspection tooling began before their own physical gates. The stopped native-bootstrap bytes are in the later25 held cohort, but that does not retroactively qualify earlier native execution. These limitations bar wholeSource claims. Code modules/control bodies themselves executed from verified held fullEOF bytes; no pyc or module-cache authority is claimed. No current private/native actual evidence contract or lifetime was changed.

## Original Task03 requirements

| Original requirement | Status | Scope of this packet |
|---|---|---|
|03A inventory/bootstrap,03B backend guards/background,03C client JWT and negative delivery |OPEN |Borrowed Source guard proposal only; no native/live foundation receipts |
|Inventory and guard/internalize all alternate public data paths |OPEN |No product endpoint edits or complete inventory acceptance |
|Refreshed client JWT, verified issuer/subject, trusted grants/provisioning |OPEN |External code-bridge authority test does not establish runtime identity |
|Scoped direct endpoint/transcript administration, canonical revisions and billable controls |OPEN |No transcript/direct endpoint or revision outcomes |
|Revocation/deletion for background/subscription/bytes/callbacks, protected config/redacted shares |OPEN |Resource UNKNOWN failure checks are not service revocation evidence |

All three original acceptance criteria remain OPEN: identity/tenant/scope/paid alternate-path denial; cross-tenant subscription/tool/upload/storage closure; revoked/deleted later-effect closure and logout semantics. Accepted C2 dependency order remains unchanged. FullTask03 criteria0/3; goal1/17 is only Task01 bounded acceptance; product0/12. The qualification registry remains empty.

## Dimension scores

| Dimension | Score | Basis |
|---|---|---|
|Requirement Fulfillment |3/5 |Borrowed ownership and assertion conservation are demonstrated; sticky metadata/cap requirements fail |
|Code Quality |2/5 |Failure handling omits acquisition and local cap boundaries |
|Test Quality |4/5 |111 meaningful outcome cases,4 candidate failures, explicit1 setup gap; full held/raw receipts |
|Pattern Adherence |3/5 |Original assertions/caps remain; whole-lifetime failure pattern is incomplete |
|Completeness |2/5 |Current bridge is rejected; real collector/G schema, whole read/import/compile/nonuse/debt closure and U3/B3/Root actual lifetimes remain pending |

Average2.8/5. Any dimension≤2 requires REJECT under judge-task. Source/control scope remains bounded even after a future repair. Human verdict publication occurs after the Source control descriptors closed; it does not claim those descriptors stayed held through this later report.

No Docker, Linux launch, service, credential, target, private input, inference, product, Git, or Root tracker mutation occurred.
