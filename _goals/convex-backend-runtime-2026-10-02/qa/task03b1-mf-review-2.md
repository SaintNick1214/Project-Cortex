# Independent Task03B1-MF judgment, cycle2

Final verdict: **REJECT, 3.2/5** from fresh read-only `task03b1_mf_review_2`.
Candidate freeze:2026-10-03T10:16:12.397Z. Both completed cycles remain REJECT;
a bounded repair and fresh third review are required. No dependent MF work is authorized
by these test passes alone.

| Dimension | Score |
|---|---:|
| Requirement fulfillment | 2 |
| Code quality | 3 |
| Test quality | 3 |
| Pattern adherence | 4 |
| Completeness | 4 |

The original five defects and the open-review independent READ/WRITE delivery issues
have passing controls.307 actual-handler/authority tests in5 suites pass,0 skipped;
strict affected types/lint/42-path closure/whitespace pass. Unchanged final-read6,
corrected adapter30 and additional opposite-grant expiry/deletion/proof12 probes pass.
All current freeze hashes and prior32/38 archive records match.

Two remaining findings block PASS:

1. Source lineage/lifecycle is checked before asynchronous hashing but not reloaded
   afterward. Tombstone/revision changes during the final WRITE hash permit memory
   restore and fact in-place update private delivery. Historical fact reading similarly
   permits late source tombstone/event change. Retain an immutable full source snapshot,
   then reload and compare identity/owner/lineage/content/hash/lifecycle after crypto.
2. Deletion proofs replace the entire resource requirement with undefined. This skips
   independent tenant-wide resource tombstones and source fences. Exempt only the exact
   newly created operation tombstone; preserve broader/resource/source checks and
   admitted canonical source witnesses. Correctly injected bulk probes disclose an
   unsupplied ID under the current candidate.

Eight new failures have explicit injection assertions. Raw reproduction is in
`/tmp/mf-cycle2-final-judge-edvgqmuw/`; parent preserved source/QA and relevant probes
under task03b1-mf/history/cycle2-final/ before further edits.

Evidence correction: the first bulk probe assumed the wrong patch signature and did
not inject revocation, so that original observation is non-certifying. A corrected
effective-ID hook against an isolated historical source mirror independently proves
the earlier bulk disclosure gap. The repaired current grant-revocation control rolls back.

Full-root types still fail on exactly the three existing removed-public-purge consumers
at tests/helpers/cleanup.ts:58,:77 and tests/interactive-runner.ts:380. No live transaction,
validator, subscription, concurrency, managed vector or UI behavior is certified.
These are stipulated offline handler checkpoint failures, not a live exploit claim.
No repository edits, codegen, deployment or inference were performed by the judge.
