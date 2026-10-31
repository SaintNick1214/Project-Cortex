# Independent Linux Source adapter judgment

## Verdict: REJECT 3.0/5

**Bounded CODE_BEHAVIOR/HOST_SOURCE only.** The current stopped adapter does not deny every malformed sender document before fixture mutation. This is a concrete required-boundary failure, so it cannot receive independent Source approval. No candidate code was authored or changed by this reviewer.

## Critical finding

**[P1] Validate the complete prospective sender before preparing any fixture.** In `adapter/root_fixture_driver.py:204–205`, `execute` reserves Source capacity and constructs its runner, then reaches volume creation at224, writer creation at232, writer start at241, source seed at246 and full-ledger copy at257. The sender digest, scope/custody and exact-five checks occur only at285–292. `source_entry.py:27–37` checks manifest/approval, then forwards the sender through this driver without an earlier complete sender validation.

Three fresh independent controls call the unmodified actual `D.execute` under a finite, independently authored virtual effect interface. Wrong sender scope, `oldCustodyRepaired=true`, and a wrong `senderProspectiveNineSha256` each reach exactly13 non-cleanup commands and these six mutation labels before rejection: `source-volume-create-input`, `source-volume-create-result`, `source-writer-create`, `source-writer-start`, `source-seed`, `source-copy-full-ledger`. All three subsequently perform owned cleanup, retain the failure, and close their bridge once. Their cleanup success does not satisfy the required pre-effect denial.

`independent-run1.json` → `result.details.sender-observation-scope`, `sender-observation-custody`, and `sender-observation-binding` preserve complete ordered command and mutation lists. These are SOURCE/MOCK counterexamples, not actual Docker effects. Move digest and exact typed sender scope/custody/five-row/path/size/hash/nine validation before `services.runner` and every fixture effect; validate it once and carry the validated object forward. A fresh independent regression must assert zero fixture mutations for each malformed case.

## Important finding

**[P2] Require exact integer wire indices.** `adapter/linux_source_qualifier.py:52` compares the index list with `range(135)` using ordinary equality, which accepts `True` as index1. The actual `Q.validate_wire` accepts this mutated wire under `independent-wire-boolean-index-observation`. Apply `C.integer` to each index and require the exact position before path formatting. Current held wire bytes are valid and unchanged; this diagnostic induced no effect.

The tentative partial-destination race and DATA ABI questions were not independently established as additional defects and are not actionable findings in this verdict. Full parent DATA/ledger ABI integration remains a declared pending release seam.

## Evidence and scope

The current manifest199 rows/5,359,883 bytes and four self-excluded publishers/225,828 bytes were read against their exact expected bytes and original member nine vectors. Static acquisition held203 descriptors, all member FDs before member bodies, full EOF/hash/size, literal PRE/OPEN/POST/final nine, then203 once closes without errors. The four header bodies preceded later member acquisition; this is explicit staged discovery, not a claim that all203 FDs preceded the first header body.

The executable review held four stopped own bootstrap inputs, then all212 declared candidate/controlling inputs before any declared member body:216 descriptors/5,786,331 bytes. Every input full EOF/hash/size and nine check passed before candidate/control compilation. The same owners remained through all16 controls and all three owned local commands. Final full EOF/hash/size/path/descriptor nine checks passed for216;216 close attempts succeeded once, with no final or close errors. The interval took1.762515 seconds, below the separate48-second body deadline. Original candidate/member pins were never refreshed.

The fixed conservative16MiB reservation retains earlier preparation/inspection/control/raw/document admissions, with the current5,786,331-byte interval and one2MiB publication/DATA reservation counted inside64MiB. It is a bounded reviewer reservation, not an exact current whole-F2 census or an imported Root ABI. Full F2 Source remains OVER/UNKNOWN and ineligible; A4 phase partition was not adopted. Limits4096 unique and simultaneous Source FDs,64MiB aggregate,16MiB file and the single2MiB DATA allowance remain unchanged. No content-only dedup, graph reset, metadata exemption, truncation or alias was used to enable a Root effect.

The16 assertion-bearing independent controls comprise12 safeguards/closure outcomes and four counterexample observations. Safeguards cover exact all-nine/hash/size dedup and changed-nine charge; Source bytes/FD cap denial before open; primary plus first/last close failure with every owned close once/sticky denial; actual `E.run_from_closed_headers` approval-boolean, wrong physical nine and paid-boolean release denials; unknown-name cleanup prohibition; complete350,579-byte/280-row ledger export/inherit beyond327,692 stdin; and three actual held-source Common local-process outcomes.

The local commands use supported Python3.14 and exact candidate Common/anchor bytes. Positive output is exact, nonzero exit19 remains terminal, timeout returns `TimeoutError`/exit-9 after verified owned reconciliation. All three receipts have `ownedGroup.absenceObserved=true`, `unknownOwnershipNeverSignaled=true`, terminal true and no close errors. Only these three actual Common commands ran. No Docker, CI, network, services, private inputs, credentials/keys, targets, inference or actual Linux fixture ran.

The author raw `held-source-replay3.json` was independently acquired and parsed:351 SOURCE/MOCK PASS/0FAIL, three terminal positive/exit7/timeout local outcomes, ledger188 inputs/4,919,241 bytes/peak189/live0. Those author passes and the46/48 command matrix are documentary evidence, not independent execution of that entire matrix here. The Source constants/schedule preserve distinct48 commands,190-second Common maximum,48-second body,12-second/327,692 stdin and262,144 per pipe. Each malformed-sender mock case completes within21 commands including cleanup. No assertion/deadline was widened. With the blocking counterexample established, no blind full author-control rerun was performed.

Finite independent carry/proof document assertions confirm135/2,628,874 bytes,130 original Mac rows,113 unique declared original subset rows, exact carry digest binding, and explicit false historical physical adoption. Linux UID/inode/timestamp fields never replace original Mac130/113 pins. This review does not replay or promote the old FAILED_UNKNOWN E2 interval.

## Custody chronology and preserved prefixes

Initial publisher metadata showed ctimes around179141701658…; later metadata changed to max1791417170123662205 while sizes/mtimes stayed unchanged. The initial wait was interrupted before any publisher FD/body; exit130/KeyboardInterrupt is preserved in `publisher-maturity-interruption1.json`. A distinct prospective document attempt at1791417409319128000 denied current maturity before any FD/body (`publisher-document-acquisition2.json`). A later distinct attempt after actual current age>=240 qualified all four (`publisher-document-acquisition3.json`), without changing any member original pin. No interrupted/denied interval was repaired or promoted.

Own controls/plan/bootstrap/STOP were genuinely stopped, and `pre-execution-metadata1.json` records actual current ages249.924s minimum before the first execution. Late own ctimes were retained as current prospective first-bootstrap facts; no earlier own executable interval existed. Four own FDs preceded their own four bodies; all212 later FDs preceded those212 bodies. Own report/verdict/raw/manifest/STOP publishers remain self-excluded from source approval and require a distinct later Root reader with genuine current>=240, all-FD/EOF/hash/nine/final/all-once-close qualification.

## Requirements and rubric

`requirement-outcomes1.json` separately maps every bounded Source obligation and every original Task03 R1–R5/A1–A3 and Task04 R1–R3/A1–A3 row. None of those original functional rows is completed by this review.

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment |2| Required sender pre-effect denial fails in three independent counterexamples |
| Code Quality |2| Sender validation ordering permits fixture mutation; typed index gap |
| Test Quality |5| Fresh assertion-bearing boundary controls, detailed effect traces, real owned-process and resource closure |
| Pattern Adherence |4| Disjoint reviewer ownership, staged custody, unchanged original pins, honest prefix/future gate limits |
| Completeness |2| Reachable entry/driver sender boundary remains incomplete |
| Average |3.0| REJECT: a critical requirement failure and dimensions<=2 |

Accepted plan/design PASS4.4 (`task03-attempt6-u4-independent-source-review1/linux-plan-independent-*`) and U4 original CODE/HOST PASS4.4 (`task03-u4-original-source-code-independent-review2`) remain unchanged and limited to their named scopes. Neither qualifies the current whole Source publication. Preserve G/B3/Root current source-owner context and the same nonresetting parent ledger before any future release; DATA caps262144/65536/65536 (aggregate393216 inside the original single2MiB) and full ABI/census still require actual integration.

Original Mac interpreter/high-FD/native/currentguard/runtime/function gates remain required; no new Linux9 exists. Task03 and Task04 original functional acceptance remain0/3 each; qualified goal tasks1/17 (bounded Task01 only,5.9%); product0%. All17 tasks and61 original criteria remain required. This publication grants no Source eligibility, Docker release, foundation/full03, Task04, runtime, function or full-goal acceptance.
