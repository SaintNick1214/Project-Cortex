# Task Completion Report

## Status: COMPLETE — bounded transport helper repair only

C2 corrects the confirmed C1 `read_at()` robustness defect: C1 buffered an entire input before its caller rejected an oversized body. C2 checks regular-file status and byte length with `fstat` before buffering, reads at most the trusted bound plus one byte, and rejects oversize without clipping. All four call sites retain existing exact hashes/length checks: the map uses the unchanged 5 MiB limit; archive chunks use exact recorded lengths; existing originals use exact allowed-row lengths. `helper-change.diff` shows the complete change.

## Scope and Immutable Identity

Only this new packet and its own work directory were written. C1's exact 53-file closure, report, helper, README, manifest, raw receipts, and all history were verified and copied under explicit `lineage/c1/`; that directory contains C1 observations, not new C2 results. Final C1 closure was checked again unchanged. Active map and both archive blobs are byte-identical to C1. The map has SHA-256 `8462ee757b4f68bf281dc645a23c042369cc06c078f9d0f95ab9c2384c5c4d53` and length 2,475,274; two archive blobs total 5,394,882 bytes, with no binary blob exceeding 5,242,880 bytes. The complete original allowed path/content set remains 63,544 files, 2,296,620,105 bytes, and 436 unique contents. No assertions, verdicts, caps, or qualification claims were loosened.

Frozen original root manifest SHA-256 remains `0b3f7f43fdfbd1b2e71cb420b7a24d1255773b3ca6973df0775dc4d1c0c5179d`; its 17,783,968-byte body is present in the unchanged archive. Retain original root `report.md` directly plus this entire C2 packet; omit the other 63,543 original paths from the Git representation while preserving all local originals. Materialize before verifying original QA closure.

## Finding Correction and Preserved Failures

The initial suspicion that C1's `safe()` rejected only escaped textual sequences was **NOT_REPRODUCED**. Direct AST inspection and actual-character execution show the original literals already forbid single backslash (codepoint 92) and NUL (codepoint 0). My initial confirmation misinterpreted escaped display output. C2 preserves `safe()` semantics exactly and adds explicit precreation controls using the actual characters. The confirmed defect is only the unbounded read, with an owned C1 baseline witness showing 128 bytes returned before the caller's 2-byte expected-length check.

Two real C2 preparation-construction attempts failed before writing a helper or creating a reconstruction replica: first a malformed replacement triggered a syntax error; then an assertion that the already-correct safe literals must change failed. Both original scripts, argv/UTC receipts, stdout/stderr, and failure details are unchanged under `lineage/c2-construction-failure/` and `lineage/c2-construction-failure-2/`. These failures are disclosed rather than relabeled as successful runs. The corrected preparation and all final C2 verification runs exited zero.

## Requirements Checklist

- [x] Frozen original full SHA-256 closure and exact actual file set verified before and after corrected preparation and new reconstruction; `prepare-c2-receipt.json` and `verification-receipt.json` preserve raw UTC boundaries.
- [x] Exact C1 map/archive identity and 53-file lineage closure preserved and reverified. No original files were modified.
- [x] Corrected helper independently reconstructed all 63,544 originals into its own initially absent clean replica; `clean-materialize.stdout` and `verification-receipt.json`.
- [x] New corrected-helper idempotence and read-only reruns: zero creations, 63,544 existing files verified; new C2 `idempotence.stdout` and `readonly.stdout`.
- [x] All original 15 adverse assertions preserved unchanged; two actual-character controls prove safe/create denial before target directories/original creation; three oversize controls reject an existing original before buffered reads and corrupt map/chunk packets before restoration target creation; `adverse-receipt.json` records 20 observed expected rejections.
- [x] Exclusive creates, no overwrite, symlink ancestor rejection, exact archive-entry validation, unknown/duplicate/link/hash rejection, and original full closure verification remain intact. No tar extraction API writes paths.
- [x] argv, UTC pre/post, exit codes, raw stdout/stderr, prior helper/report/preimages, observed baseline, and construction failures are preserved.
- [x] Own new report, metadata, and root exact-self-excluding manifest sealed; nested lineage manifests are included.

## Verification and Review Boundary

C2 transport reconstruction, exact original closure, idempotence, read-only verification, original adverse controls, actual forbidden-character controls, and oversize controls passed through observed new executions. C1 historical deterministic recompression receipts remain historical evidence; archive byte identity was newly verified in C2. Application builds/tests, services, paid/native/private/source qualification experiments, Git/network/index/ref operations, and product writes were not performed. This representation/helper change grants no new test, task, goal, private/source/native, or paid qualification. A separate fresh C2 review is required before checkpoint use.

## Files Modified

Created only this new packet's active corrected helper, exact copied map/archive, complete explicit C1 lineage, preserved failed preparation lineage, new scripts/logs/receipts, helper diff/structure evidence, README/report/metadata, and manifest. Created the clean own replica and scratch fixtures under `work/resume/task04-evidence-transport-30-c2`.
