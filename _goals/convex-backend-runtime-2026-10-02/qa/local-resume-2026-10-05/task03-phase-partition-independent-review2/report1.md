Independent successor5 code-conservation review: REJECT (2.8/5)

Scope is only the frozen task03-f2-phase-contract-repair5 source prototype, publications, original regression controls and independent SOURCE/MOCK controls. This review grants no Source eligibility, actual/native readiness, operative adapter adoption, Task03/04 functional acceptance or goal acceptance. Review1, A4, current F2/maps, Root history and candidate source were not edited.

The four A4 findings are repaired in the tested successor:
- Ledger and HeldBroker deep-copy nested rows, nines and edges; stored admission identity corruption is denied.
- Brokers sharing one Ledger enforce the 4096 simultaneous descriptor ceiling before a second open and allow sequential reuse after successful release.
- Every later phase rechecks union/reserves and exact approved corpus; late large and small admissions invalidate prior approval, while an exact duplicate preserves it.
- A proposed custody-only version is denied when any Source-role, program or current body-debt version shares its path.

These repairs pass fresh independent controls. One further P1 remains.

P1: unknown Source closure does not fence Source approval or readiness

In phase_partition3.py, Ledger.release_fd (lines130–136) sets unknown_close after an unsuccessful close. admit and can_open deny subsequent reads/opens. However, approval_binding (lines138–142) binds only rows/paths; preflight (lines161–180) checks budget/path/version conservation; PhaseMachine.advance (lines467–487, especially475–478) checks that preflight and corpus binding without denying unknown_close. The callback at471 is reached before those checks.

Six independently executed cases demonstrate the bypass. Each uses three mock Source descriptors, qualifies empty bodies through final_check, attempts every close once, and fails the first, last, or all closes before actual mock release. For each failure profile, both (a) closing before initial SOURCE_APPROVED and (b) closing after SOURCE_APPROVED reach every remaining phase through ACTUAL_READY. unknown_close stays True, no readiness denial is raised, and one or three mock handles remain unresolved. The normal-close control reaches ACTUAL_READY with zero residue and unknown_close=False.

Required behavior is sticky denial before Source approval or any later readiness transition, without invoking the independent callback or mutating phase/evidence. This is a concrete phase/resource conservation defect. The mock verifier is test instrumentation, not production authority; no actual cohort, key, private body, target, inference or service effect occurred. The prototype's protected_action still denies effects. Root must repair the gate before operative integration and obtain fresh independent review.

Test accounting

| Suite | Discovered/executed | PASS | FAIL | SKIP |
|---|---:|---:|---:|---:|
| Original held assertions, unchanged | 97/97 | 97 | 0 | 0 |
| Fresh main independent cases | 35/35 | 35 | 0 | 0 |
| Fresh sticky-close phase cases | 7/7 | 1 | 6 | 0 |
| Distinct control total | 139/139 | 133 | 6 | 0 |

independent-controls-raw1.json lists36 cases because it includes the original97 aggregate as one case. That aggregate is not an extra distinct assertion suite. Its stored original97 raw confirms97 executed/PASS, zeroFAIL/SKIP. The author retained111 outcomes (97+14) are separately inspected publisher evidence, not added to independent execution counts.

Main fresh coverage includes exact CAPS/COUNTS/ASSERTIONS/FIELDS equality to pinned A4 source; finite2155 cohort conservation; exact2021 mock custody-only set; no proof charging all2155; no JSON verdict authority; Source/program/debt mixed same-path denial; all original phase ordering; late corpus/64MiB+reserves denial; shared4096 mock-FD limit and release reuse; immutable row/edge ownership; fullEOF/final holding; first/last/all/after-detach close failure accounting and sticky future-open denial; first/middle/last open faults and partial cleanup; post-open tuple mismatch cleanup; hidden edge denial before any open; fixed oneDATA, no refund/reset, protected-action denial and owned fixture cleanup. The new seven cases preserve unresolved-close residue instead of retrying or treating a mock close exception as success.

Independent custody and finite publisher conservation

The final successor pins header is finite-publication-pins1.json (9803B, SHA256 d095fa4c961f07ebc3d5dbac73c9a5935bea56658eb25b042b4365f38331e63a). Its exact final STOP basename is final-writers-stopped1.json (689B, SHA256 3ead6dfba9ed47157c2ef2fb945f8cc32f42e94f91a1b842a689176aabeb0bd3), with no remaining writes.

The manifest declares17 references/170323B. Relative and absolute references to source-input-plan1.json and source-writers-stopped1.json normalize to two exact duplicates:15 physical member paths/155793B,14530B duplicate reference charge. No reference was dropped. All15 physical member FDs were acquired before the first member body, every available declared PRE9 matched the captured current tuple before any member body, and each physical EOF size/hash matched every one of17 references. The finite actual candidate directory contained exactly its13 physical files. No alias or symlink was substituted. Headers were staged discovery, so this does not claim all member FDs preceded the first header body.

Candidate program phase_partition3.py is25242B/SHA25602321e86b53b2bfd60acfa0a2674fa9dd3cf7e4ce77b13af4713b9d4f5e0132b. Original A4 phase_partition2.py and partition_controls2.py pins also matched; only four AST disk-loader statements at original lines14–15 were replaced with the exact retained candidate module. All original assertions remained. Fixtures were created only under review2 and removed.

The successful review actor retained24 distinct physical rows/214609B, including its own executable and STOP, successor publishers, original source, and both frozen independent control programs/STOPS. Two additional ordinary-bootstrap FDs for the same own runner/STOP remained retained through actor work. Thus26 descriptors passed final fullEOF/hash/size/literal9 comparisons and closed exactly once with zero errors. Actual minimum current age was247.7115306854248s across actor inputs; candidate-input minimum1079.4138188362122s. Receipt acquisition-raw2.json contains all24 final rows; bootstrap-ordinary-raw3.json contains the two outside descriptors. Startup/bootstrap is explicitly ordinary debt and is not retroactively self-qualified Source authority.

Publisher receipt inspection confirmed the author eleven retained inputs had PRE=OPEN=POST=FINAL9, fullEOF records and eleven once-close/no-error records. Its original97+14 outcomes and359.187095114s minimum are author evidence. They do not replace these independent test outcomes.

Preserved review setup history

bootstrap-ordinary-raw1.json records a wrapper-only codeSHA256/codeSha256 field-case error before successor bodies. bootstrap-ordinary-raw2.json and acquisition-failure1.json record a pinsSHA/pinsSha256 command-protocol error after opening both headers but before header bodies. Both epochs closed all owned descriptors once. A read-only raw-diagnostic comparison initially included atime, then was corrected to the literal nine fields. runner-preparation-amendment3.json records these mistakes. Runners1–4, STOPs and preparation amendments remain; runner4 only changed its STOP/output filenames to preserve prior failures. No failed epoch was converted to PASS, overwritten or used as Source approval.

Judgment dimensions

| Dimension | Score | Decision |
|---|---:|---|
| Requirements adherence | 2/5 | REJECT: sticky unknown closure permits false readiness |
| Code quality | 2/5 | REJECT: closure state omitted from approval/preflight/phase guard |
| Testing | 3/5 | NEEDS_REVISION: author cases covered future-open denial but missed approval/readiness after failure |
| Pattern compliance | 4/5 | PASS within bounded scope: unchanged assertions, owned publications, no operative adoption |
| Completeness | 3/5 | NEEDS_REVISION: four repairs verified, new P1 unresolved |

Overall REJECT2.8, bounded CODE_CONSERVATION only. The current conservative Source census, exact present-use/import/control/IO map, approved enabling programs, concrete collector/G/U3/B3/Root edges, shared parent Linux/DATA ABI, fitting whole-ledger conservation and independent closure witness remain internal implementation work. This review does not prove intrinsic impossibility, omit historical rows by label, refund current reads, reset caps, reserve a permanent duplicate Root pool or grant a source-cap waiver. Original actual1914/3828FDs/67266864 pair bytes, compiler114 pairs, source161/copy138/frozen1907, all13 comparands/current32/current129/Mac130113 and original deadlines/assertions/61 criteria remain required in their original phases before protected actions. The stopped L packet and later Root receipts require prospective admission; they are not permanently missing.

Task03/04 functional criteria remain0/3 each; accepted goal gates remain1/17 (5.9%, boundedTask01 only), product0%. This review's publisher files require later genuine mature external capture and inclusion in any relied-on Source body debt; a JSON verdict cannot authorize a closed nonuse witness.

All review2 code/control execution is finished. This report and verdict are new ordinary publications. A final own finite pins/STOP packet will self-exclude only those two publishing headers and declare no remaining writes.
