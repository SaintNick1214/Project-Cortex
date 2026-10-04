# Task Judgment: Task04 evidence transport 30 C2

## Verdict: PASS — bounded transport repair only

C2 repairs C1's unbounded local-file read without changing the transport map, archive, original allowed path/content set, or path validation. An independent clean restore created all 63,544 originals in a new reviewer-owned replica. Independent full manifest verification checked every restored path, length, and SHA-256. Idempotence and read-only reruns created zero files and verified all 63,544 existing files. Original, C1, and C2 exact closures passed before and after review.

This verdict grants no application, task, goal, private, source/native, or paid qualification. It does not implement Git exclusions, commit, publish, remove originals, or certify a remote checkout.

## Frozen subjects and evidence

- C2 root `qa/task04-evidence-transport-30-c2`: 93 files including its exact-self-excluded manifest. Manifest SHA-256 `72585a1ecf6eeeb6adb619470c2e2a988e7c8e228a0f6f6b8e50b52bbb39009d`; report `a7040b4d4010889e547ee19d5a21b3e19244f76a64873898924d630b4f4f1022`; corrected helper `52127a96ba92de55b1b91996688ba77dd6add3ffa202c6fd6ba80861dcbd761d`.
- Original root `qa/task04-catalog-release-c4-fresh-review`: 63,544 files, 2,296,620,105 bytes; manifest `0b3f7f43fdfbd1b2e71cb420b7a24d1255773b3ca6973df0775dc4d1c0c5179d`. The complete 17,783,968-byte manifest is independently verified in the archive and restored replica.
- C1 root `qa/task04-evidence-transport-30`: all 53 files match `lineage/c1/` byte for byte. Its manifest is verified independently. Active C2 map and archive parts match C1 byte for byte.
- The map's complete path/hash/length set equals the original manifest rows plus its own exact bytes. The archive's 436 unique contents match their SHA-256 names and recorded lengths. All 93 candidate artifacts are individually at most 5 MiB (`packet-cap-receipt.json`); combined archive is 5,394,882 bytes. C1 deterministic recompression evidence remains historical; this review independently proves unchanged archive identity and full content correctness.
- `review.py`, `review-receipt.json`, and raw streams record the independent audit and subprocess argv, genuine UTC boundaries, and exits. `adverse-independent.py` preserves the audited C2 adverse assertions with only input/output/work routing changed to review-owned paths. The imported helper is always the frozen C2 helper. Bytecode writes are disabled.

Installed AGENTS/runtime/profile/pessimistic-judge/judge-task instructions and current package manifest were read. The user waived numeric cycles only; this review makes no further waiver.

## Requirements review

| Requirement | Met? | Independent evidence |
|---|---|---|
| Frozen exact C2 closure and exact C1 lineage | Yes | Every manifest row, exact file set, hash and length verified before/after; all 53 C1 files match lineage. |
| Only bounded-read code repair | Yes | Independently regenerated diff equals supplied `helper-change.diff`; unchanged `safe()` AST. Four call sites pass explicit trusted bounds. |
| Correct trusted bounds and no clipping | Yes | `materialize.py:30` checks regular-file `fstat` and length before read, requests maximum plus one, rejects extra bytes. Map bound is 5 MiB; chunk and original bounds are pinned exact lengths. Existing exact-size/hash checks remain. |
| Oversize rejection before buffering/creation | Yes | Read guard proves oversized existing input causes no buffered read. Executable-helper oversized map/chunk controls reject before target root creation. |
| Growth after initial stat and boundary behavior | Yes | Instrumented opened regular file reports initial size two, returns three bytes; observed request is exactly three and is rejected without clipping. Exact two-byte boundary succeeds; short existing input fails exact length/hash verification. |
| Original identity and lossless full clean restore | Yes | Before/post original full closure, exact map equality, archive member verification, 63,544 clean creations and independent restored closure. |
| Idempotence and read-only behavior | Yes | Both reruns verify all 63,544 existing files with zero creations. |
| Existing safety assertions and forbidden-character behavior | Yes | All 20 C2 adversaries rerun independently: original 15, actual backslash/NUL precreation denial, and three oversize controls. Foreign bytes and denied target absence are asserted. |
| Failure history and false finding preserved | Yes | C1 history exact; both genuine C2 construction-failure receipts/scripts/streams are retained. Direct AST constants `[92]` and `[0]` disprove escaped-display suspicion; no path-validation repair was needed or made. |
| Scope and qualification preserved | Yes | Writes only to new review packet and own work/replica. No frozen originals, source edits, Git/index/ref mutation, network, keys/environment changes, paid/native/private operations, or children. |

## Issues found

### Critical

None for the frozen bounded transport repair.

### Important

None that blocks the specified repair or complete lossless restoration.

### Minor

- `materialize.py:75` retains C1's visible failure behavior: a write failure may leave a newly created owned partial file. A later run rejects mismatched bytes rather than overwriting. No transactional rollback is implemented or claimed. This unchanged limitation does not invalidate the bounded-read repair.

The C1 allocation issue is resolved: oversized regular files reject from `fstat` before buffering; growth after `fstat` remains bounded by a maximum-plus-one request and rejects rather than truncates. This is a per-input read bound, not a claim that the entire process stays under 5 MiB: restored original manifest bytes can exceed that transport-part limit.

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 5/5 | All bounded repair and identity requirements independently verified. |
| Code Quality | 4/5 | Explicit trusted bounds, exact validations, safe exclusive writes; unchanged partial-file limitation disclosed. |
| Test Quality | 5/5 | Full independent restore/closure and 20 adverse controls plus growth-after-stat, exact boundary, and short-file rejection. |
| Pattern Adherence | 5/5 | Exact scoped repair, preserved failures/history, own targets, no qualification inflation. |
| Completeness | 5/5 | Corrected shipped helper restores all originals and manifests; final frozen closures unchanged. |

**Average: 4.8/5.**

## Failure accounting and execution limits

Initial read-only discovery used nonexistent shortened `goalqa/` paths and exited 2. `bootstrap-discovery-failure.json` preserves the exact error lines and command. That discovery did not capture UTC bounds; no retrospective times are invented. Subsequent substantive checks record genuine UTC bounds. All required new helper runs and independent assertions passed; no failed execution is relabeled successful.

Full application builds/tests and service qualification are outside this transport-only review. No further independent children were spawned. The new replica remains only in `work/resume/task04-transport30-c2-fresh-review/replica`; originals and frozen packets were never write targets, including same-byte writes.

## Recommendation

Accept the frozen C2 packet for bounded lossless evidence transport. Retain the original report directly and the complete sealed C2 packet; require materialization before verifying the original full closure. Preserve all existing qualification verdicts. Git representation and checkpoint operations remain separate coordinator actions.
