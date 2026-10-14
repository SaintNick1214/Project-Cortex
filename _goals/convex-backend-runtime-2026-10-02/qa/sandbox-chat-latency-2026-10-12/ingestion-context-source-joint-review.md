# Task Judgment: ingestion progress publication and ordered context-source batching

## Verdict: PASS

One independent coherent source/test/docs gate under acceptance-policy v2. All five dimensions score **4/5**, average **4.0/5**; zero unresolved breaking findings. Acceptance is limited to this frozen source batch. It does not accept hosted performance, the latency target or the full goal.

## Requirements review

| Requirement | Evidence and result |
| --- | --- |
| Separate operational activity from semantic readiness | `runtimeIngestion.ts:152` keeps stage running/lease writes on existing stages; terminal readiness compares a fresh same-transaction event row. `readiness:70` retains the same bounded reads and watermark scheduling, patching run memory status only on an actual change. |
| Preserve meaningful transitions and profile safety | Completion/failure/unknown/retry, tracked edits, eligibility, profile changes and profile completion still publish. `claim:225` skips only canonical-equivalent profile writes. `registerCompletedDerivedSource:458` checks actual vectors-stage pending before initial profile pinning. Public stage status retains running/attempt/failure/receipt. |
| Reduce ordered source handoffs without dropping guards | New internal `contextSourceBatch:551` invokes the original source handler and immediately merges each item before continuing. Both original source getters, expected event/revision/hash, exclusion, cutoff/boundary, ownership, revocation/expiry and tombstone predicates remain. Prior witnesses cannot authorize a source. |
| Preserve order, errors and final fences | `prepareContextHandler:556` issues one batch per nonempty branch. Fact guards still follow vector settlement; selection duplicates/order, witness permission union, provenance, binding commit and error priority remain. Failed branches produce no delivery/save. Fresh finalDelivery/save and subsequent model/source fences remain. |
| Preserve product bounds and compatibility | Native batch caps cover original 100-result reads: 100 items, 200 existing witnesses, 100 prior vector witnesses. Original 32-witness/context overflow checks remain. Single-source endpoint, V1–V5 journals/callbacks, empty/routed/model/save bodies remain; no schema, financial dispatch, replay or deadline change. |
| Meaningful verification | Final raw JSON: **1,247/44**, zero failed/skipped/todo, 44 distinct executed suites. This includes ingestion14, composition56 and new batch25 checks. Earlier ingestion1,054/35 overlaps and is not additive. Root/backend types, scoped lint, root lint, build and packed/browser contracts exit0. |
| Accurate docs | Performance source and six previously accepted MDX files match frozen hashes. Actual build0 and saved IAB DOM/pixels show K16 values and unavailable result; sampled warnings0/100, tab closed, preview exit130. No speed guarantee or new-batch native acceptance is asserted. |

## Evidence review

Compared the two production diffs against product baseline `2dd1c8474392322b71606a8dd8ee2df64b9fe0c5` (current QA-only HEAD `3a5c697becd61eddd227ae7ad673682743e019ef`). Inspected final test source, raw assertions/outcomes, failure receipts, registrations, source/readiness consumers, original guard composition and frozen packets. Current six source/test/docs hashes and referenced frozen checks match.

The tests assert exact unchanged event/run bytes for activity, genuine profile publication, complete watermarks, stale-event multi-stage import, claimed-worker pin safety, failure/retry, tracked-edit resets and denial/scheduler rollback. Source-batch tests compare original handler outputs/getter order at0/1/3/33/100 items, late refusals and filtering, duplicates, retained/prior witness conflicts, native argument bounds and later-item authorization. Action regressions retain exact context/binding/order assertions and post-batch delivery/save refusals. RPC-count expectations and fault hooks changed for the new batching boundary; functional assertions were retained.

Original failed evidence remains red: ingestion focused38/39 fixture lacked the extraction-parent operation; initial root types rejected scheduler-argument typing. Agent focused77/78 had a new physical endpoint expectation typo; initial types rejected an afterEach callback returning Jest. The later QA report-formatting TypeError is preserved separately. Corrected fixtures/type expressions/assertion target do not relax product assertions. Judge performed no suites, builds, services, inference, Git or Proofs writes.

## Dimension scores

| Dimension | Score | Basis |
| --- | --- | --- |
| Requirement fulfillment | 4/5 | Both structural repairs and retained product behavior supported by source and outcomes. |
| Code quality | 4/5 | Narrow helpers, fresh transaction comparison, existing stage rows, typed internal query. |
| Test quality | 4/5 | Exact outcomes plus relevant late denial, ordering, limits and rollback regressions. |
| Pattern adherence | 4/5 | Existing validators, internal registrations and original handlers/mergers retained. |
| Completeness | 4/5 | Reachable integration and affected finite gates passed; docs built/rendered. |

## Issues and scope limits

No critical or important breaking finding. Nonbreaking existing debt: root lint retains237 warnings; scoped lint has none. Genuine source/profile/readiness transitions can still cause legitimate conflicts. The batch retains all per-item source work; it reduces handoffs, not mandatory predicates.

Controlled-handler/DB-port tests do not establish hosted atomic-query/OCC performance. K16 is evidence for the **old2dd source**, with native functionality passed/cleanup absent but **0 SLO PASS,3 FAIL,1 unavailable**. Browser warm5,197.2ms; CLI11,371.979422/14,704.853548ms. These results are not relabeled as proof for this repair. Latency goal remains **2/4 =50%**.

## Recommendation

Proceed with packaging and one fresh installed hosted qualification. Source/test/docs acceptance is complete; native speed and full-goal acceptance remain open. Exact file and packet hashes are recorded in the companion JSON.
