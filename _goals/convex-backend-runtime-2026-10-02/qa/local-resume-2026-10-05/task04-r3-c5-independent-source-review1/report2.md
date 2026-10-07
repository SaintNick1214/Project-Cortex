# Independent Task04 R3/C5 source judgment

**REJECT — 2.6/5.** Four confirmed candidate cleanup defects block source eligibility. Original Task04 functional acceptance remains0/3.

This packet separates immutable candidate-source findings and observed SOURCE/MOCK controls from the reviewer’s failed custody interval. The first verdict publisher stopped before any report/verdict write. The original holder then retained all1593 expected tuples, read complete bytes, and attempted every1593 owned close exactly once with zero close errors and zero retries. Six reviewer-owned inputs changed only ctime; their bytes/hashes stayed exact. That whole interval remains FAILED/UNKNOWN and is not retrospectively qualified. All1535 upstream and Root197 original candidate/reference tuples, hashes and EOF checks were exact at its final diagnostic before closure.

Observed controls:133PASS/12FAIL across145 unique conditions (152 raw rows; seven repeated conditions counted once). These are scoped source/history observations, not145 qualified acceptance conditions. The four raw receipts below preserve their exact scope; controls3 and the control6 source have failed original final custody. Bootstrap11 and export/terminal20 positive observations do not grant eligibility.

## Confirmed blocking findings

- **F1 [P1] Final source close failure abandons later owned FDs** — [ci-run.py](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-repair3/source/ci-run.py:439). Static path is reachable in the current unchanged source; isolated observed proof: R3.ci_entry.close.1/.2 (with and without primary). Detach ownership, attempt every close once, and collect sticky failures after all attempts.
- **F2 [P1] Cleanup report write failure skips every held source close** — [ci-run.py](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-repair3/source/ci-run.py:438). Static path is reachable in the current unchanged source; isolated observed proof: R3.ci_entry.cleanup-report.1.primary. Protect all source closes with an outer lifetime independent of report publication and retain primary/report/close errors.
- **F3 [P1] Native export close failure abandons later owned FDs** — [native_export.py](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-repair3/source/native_export.py:112). Static path is reachable in the current unchanged source; isolated observed proof: R3.native_export.manifest.close.1/.2 and close-and-primary.1/.2. Attempt every owned detached close once; collect primary and close failures without retry.
- **F4 [P1] Ledger update may fail before new FD ownership is recorded** — [consumer.py](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-current-producer-native-public-consumer-repair3/programs/consumer.py:75). Static path is reachable in the current unchanged source; isolated observed proof: C5.open_inputs.opened.1/.2/.3 (MemoryError). Give every newly opened FD a cleanup owner before ledger accounting or any fallible setup.

The isolated tests use finite owned fixture descriptors and rescue only never-attempted owned FDs. Unknown failed closes are never retried. No foreign process or FD, Docker, private file, credentials, service, target, CLI runtime or inference is used.

## Original requirements and acceptance criteria

| Original item | Status | Limit |
|---|---|---|
| Register operation keys for every named billable operation | OPEN | No accepted backend operation registry implementation. |
| Trusted deployment/tenant/agent/operation policy; pin and validate model/interface/prompt/options/tokens/tools | OPEN | No accepted application policy enforcement evidence. |
| Atomic budget/concurrency reservation, once settlement, conservative uncertainty and safe fallback | OPEN | No accepted application admission/settlement evidence. |
| Distinct allowed model policies, correlated audit and no hidden direct provider bypass | OPEN | No accepted application policy/audit evidence. |
| Concurrent/child calls cannot bypass reservation or settle twice; quota exhaustion before token mint | OPEN | No accepted application concurrency/quota evidence. |
| Fallback never duplicates visible output/tools/ambiguous paid jobs or changes embedding profile | OPEN | No accepted application fallback evidence. |

Original100 byte preimages and110 unchanged executable members were observed preserved by reference; stable113/336 maps and all119 historical ctime failures stay unchanged. Missing C7 backing/transport, original122, native20/whole120 and actualROOT remain incomplete. The old full REJECT2.8 and static-only recorder4.25 do not become functional acceptance. Proposed workflow remains inactive. Only numerical review-cycle limits were waived.

## Exact scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 2/5 | Required ownership/cleanup safety fails; all original functional criteria remain open. |
| Code Quality | 2/5 | Four reachable candidate defects need repair. |
| Test Quality | 3/5 | Many meaningful author/independent observations; blocking paths were missed and own whole custody failed. |
| Pattern Adherence | 4/5 | Finite references, honest scopes, literal identities and original assertion conservation are preserved. |
| Completeness | 2/5 | Source eligibility, complete cleanup and original functional/native acceptance are absent. |

**Average:2.6/5.** Repair in a distinct author namespace and obtain a fresh independent review. This REJECT authorizes no runtime or product acceptance.

## Evidence and failed intervals

- [independent-controls3.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1/independent-controls3.json) — SHA75ad0488fbf6d1c5177c80e5bde103d9062e5e2f52ea6cb44ce51d760b74d904, 40936 bytes; ORIGINAL_FINAL_CTIME_FAILED_UNQUALIFIED_HISTORY.
- [independent-controls5.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1/independent-controls5.json) — SHA8dffe32e690fbd6dd29cb3e8ee078c39e21f053b987244779c573e38d2637364, 13594 bytes; ORIGINAL_FINAL_EXACT_SCOPED_SOURCE_OBSERVATION.
- [independent-bootstrap-controls2.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1/independent-bootstrap-controls2.json) — SHAea7716c056fff680d43bb2f76584ad08891b6292efef02277d706e48d78bfa69, 8713 bytes; ORIGINAL_FINAL_EXACT_SCOPED_SOURCE_OBSERVATION.
- [independent-export-controls1.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1/independent-export-controls1.json) — SHAe5c7280925d71c95499652c3eff8e907814cab8ea3b11e99c4568edf7f946155, 12191 bytes; RAW_FINAL_EXACT_BUT_CONTROL6_SOURCE_FINAL_CTIME_FAILED_UNQUALIFIED_WHOLE_INTERVAL.
- [Original holder2 failed closure](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task04-r3-c5-independent-source-review1/holder2-final-UNKNOWN-closure1.json) — SHA724f4e5336d468fa76f8dd00c1fd72c1d49b5426010cc35f993d8bda35f23232,265821 bytes. Contains all six literal expected/current nine pairs, unchanged full-byte hashes, complete per-index final checks and all1593 explicit close calls.

Preserved own setup failures include the first wrong recorder locator, holder1 incomplete union, controls1 preimage locator, controls2 syntax, controls3/5 premature maturity and unheld execution, initial oracle close-order/unreachable-lstat mistakes, and the bootstrap oracle’s missed structured closeFailures field. Corrected oracle observations are distinct files; old failed bytes and tuples remain immutable. These setup errors are not candidate defects.

Read-only metadata investigation found flags64 and only the com.apple.provenance attribute name on sampled files; no attribute values were read. Exact-path lsof showed only the reviewer’s read-only held FD; no writer/copy process was observed. Cause remainsUNKNOWN.

The final publication reads a small stopped mature reference subset with allFD-before-content, fullEOF/hash/nine checks and held subject-source pins matching literal Root197 originals. Its ledger adds every genuinely new input to the old66083601-byte ledger without resetting or exempting metadata. It does not reopen or qualify the failed whole original interval. Publisher report/verdict/manifest/stop files remain self-excluded until Root’s later mature physical readback.


Final own publisher2 denied before report publication because its author-byte expectation omitted one trailing newline; its11 owned inputs closed once. Own publisher3 then denied before report publication because the draft compared Root197 decimal-string nine-field objects to ordered integer tuples; its14 inputs closed once. Both original failed intervals and expected pins remain unchanged. This explicit publisher adapter validates all nine exact Root field names and decimal-string values before converting them to the existing tuple order; it neither changes candidate bytes nor refreshes any historical tuple. The two failed publisher receipts and diagnosis are part of the finite reference manifest.