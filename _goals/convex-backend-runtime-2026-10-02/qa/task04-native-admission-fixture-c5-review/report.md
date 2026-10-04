# Task Judgment: Task04 native admission fixture C5

## Verdict: PASS_PREPARATION_ONLY

Independent offline preparation review of final candidate C5. Report SHA256 `4d70c9968cdbbd3b74c35fe2610e030b5bf89b70f8069fc034f3c04b10b1f82e`; runtime freeze `b40d38cdcec3cd7346980d4cf2bb4af021c34e1d9d647925d3ad83428a5b3688`; recursive QA manifest `f1f4421bdb47f95487cf75ed5e06b732da62f5011860a4f163bb0f4f4b8f9dd2`. This verdict certifies the fixture's offline preparation only. No native C5 qualification or parent C3 adaptation acceptance follows.

## Requirements Review

| Requirement | Met within preparation? | Evidence |
|---|---|---|
| Frozen full candidate, product copies, accepted inputs and protected evidence | Yes | integrity-verification.json:238 recursive manifest rows/239 actual files;232 freeze entries;136 mapped sources, sole synthetic bootstrap divergence. reference-hash-checks.json:101 references all match; final-preservation.json:916 protected files unchanged. |
| Complete281 contracts/validators/equalities and opaque HTTP metadata, both phases | Yes | stdout.txt full281 writer/reader; actual production contract normalization/comparison and unmodified actual driver session; all281 equalities retained. |
| Exact bounded raw bytes before SDK result validation/comparison | Yes | publication.mjs:10-13 custom fetch captures byte-identical raw before returning Response; actual capture regression retains bytes on mismatch and refuses257000-byte body/overwrite. No extra query. |
| Strict source/phase/operation/target/chunk/hash/reconstruction binding | Yes | implementer's12 hostile mutations observed passing; independent-publication snapshot additionally rehashes enclosing manifest pointer so five context mutation failures reach QA_PUBLICATION_BINDING. All five artifact families deny pre-query attempt reuse. |
| Per-artifact256000 and aggregate8MiB/6000 unchanged | Yes | raw256000 each; bundle304972/304968; chunks128000/128000/48972 or48968; receipts1279/1267; BOTH phases1128104. Worst bound503719<512000. Reservation1634304bytes/16records; fresh actual-byte/row boundary tests reject admission before artifacts. |
| Actual driver independently validates before client/journal/RPC | Yes | original actual driver VM test passes full281 BOTH phases at0RPC; corruption does not create another client/journal. Fresh targeted execution also observed this test. |
| Actual installed CLI1.46 prerequisite/compiler/router path and full source equality | Yes | original assertions retained; review scratch path adaptation explained below; CLI followup5PASS, actual installed compiler2calls0installs/network; route handler export identity and HttpRouter.getRoutes. Source copies unchanged. |
| Original cases/native limits/physical provenance/security/storage requirements remain mandatory | Yes, preparation preservation | cases and budget bytes fixed against C4;49 scenarios;2991client+9nested;3000invocations/concurrency4/320live/783cumulative creations+deletions. README:30-32 requires operation/attempt current physical-ID provenance and EXACTLY TWO actual noJWT public storage handler denials after validator acceptance. These are UNEXECUTED requirements, not inferred from offline semantics. |
| Original failures preserved, no synthetic proof inflation | Yes | C4 packet all40 files protected; original C4 QA_BYTES/retirement retained; candidate offline-publication01 original cross-VM failure retained; synthetic281 evidence explicitly labelled offline. Production EMPTY trust root tested empty; no real provider/pricing qualification. |

## Observed Checks

The fresh full underlying35 discovery produced33PASS/2FAIL/0skipped. Both failures were QA_STAGE_PATH caused solely by redirecting test scratch from candidate-owned to authorized review-owned directory; full pre/raw/post evidence remains in result.json/stdout.txt/stderr.txt. Candidate source was untouched. The CLI helper's exact scratch allowlist prefix and static imports were redirected in a review-owned source copy; only affected CLI5 ran again and all5PASS. Original test assertions and installed source declarations/compiler/router were unchanged. This establishes all35 underlying outcomes through two executions; it is not represented as a pristine35PASS single run.

Two additional independent hostile tests passed. The targeted name pattern also selected the existing actual-driver test because its title contains “independently”; independent-result.json therefore correctly records3PASS/0FAIL/0skipped. The new tests exercise five rehashed context bindings, five existing-attempt artifact families, and exact aggregate byte/row admission failures. Actual frozen sourcePreflight passed. No broad application checks were rerun.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 5/5 | Every authorized preparation requirement accounted for; actual native assertions remain mandatory and openly unexecuted. |
| Code Quality | 4/5 | Append-only private exact writes, strict reconstruction, explicit limits, independent driver comparison; compact dense implementation reduces audit readability. |
| Test Quality | 5/5 | Actual-source writer/reader/driver outcomes, full281 worst raw both phases, preserved red C4 writer, corruption/context/budget/no-replay negatives. |
| Pattern Adherence | 4/5 | Frozen source/dependency/source-copy contracts respected and no service proof inferred; extensive VM harness requires explicit path adaptation. |
| Completeness | 5/5 | Offline preparation complete; immutable manifest/freeze/report and all supporting reader/writer/driver integration verified. |

**Average:4.6/5**

## Issues Found

### Critical
None within the authorized preparation scope.

### Important
None blocking preparation. Parent C3 adapters require their separate final independent acceptance before any fresh target. Existing C4 preparation PASS and deploy/codegen PASS cannot certify C5.

### Minor
publication-artifacts.mjs is densely formatted, making manual audit harder; the frozen behavior was checked through actual-source outcome tests. The review's first two stage-path failures are harness-adaptation failures, fully retained and explicitly resolved without editing candidate files.

## Scope and Recommendation

C5 may advance only after independently accepted matching parent inputs and a verified fresh owned disposable target. ALL actual native C5 deployment/codegen/publication, OCC/budget concurrency, authentication/HTTPS peer, management/signing, physical provenance, public storage handler denial, owned rows/deletions/cleanup and retirement remain NOT_RUN. WholeTask04/fullTask03/goal remain INCOMPLETE. Native limits, EMPTY production trust root, synthetic-only status and strict fail-closed assertions are unchanged. No target/key/env/credential/signing/network/service/model/storage or Git operation occurred in this review. Writes were limited to this new review packet and its unique review scratch. Numerical judge-cycle waiver did not waive assertions, limits or gates.
