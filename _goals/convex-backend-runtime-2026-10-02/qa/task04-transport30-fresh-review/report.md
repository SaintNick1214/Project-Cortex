# Task Judgment: Task04 evidence transport 30

## Verdict: PASS — bounded transport only

The frozen candidate is lossless for the complete frozen C4 fresh-review closure. Independent reconstruction created 63,544 original files in a new reviewer-owned replica; rerunning created zero files and verified all 63,544 existing files. Independent verification against the original manifest then checked the exact restored file set, SHA-256 values, and lengths. Original files and the candidate packet remained byte-exact before and after review.

This judgment does not grant application, task, source/native, private, paid, or goal qualification. It does not enact the recommended Git exclusions, delete originals, commit, push, or certify a remote checkout that has not been created.

## Frozen subjects and evidence review

- Candidate root: `qa/task04-evidence-transport-30`. Manifest SHA-256 `8e0571129a46c31c031a751a6f97d532d54a16e4c9c0de86b72e9a169094f4d8`; report SHA-256 `215a7457f0e769bf61b36adf45bcc86a8bd1b9361fd10a74c3d4043cee8688aa`. Its exact manifest contains 52 rows and 53 files including itself. The task payload's “53 rows” describes its total file count, not its actual manifest row count.
- Original root: `qa/task04-catalog-release-c4-fresh-review`. Manifest SHA-256 `0b3f7f43fdfbd1b2e71cb420b7a24d1255773b3ca6973df0775dc4d1c0c5179d`, exactly 17,783,968 bytes. Its 63,543 rows plus the manifest itself form 63,544 files totaling 2,296,620,105 bytes.
- Exact map SHA-256 `8462ee757b4f68bf281dc645a23c042369cc06c078f9d0f95ab9c2384c5c4d53`, 2,475,274 compressed bytes. Every map row matches the corresponding original manifest path/hash/length, including the exact original manifest added as a row. No original map path contains a backslash, NUL, absolute path, empty component, dot, or dot-dot component.
- Archive SHA-256 `f174ecf52fc762a8e05114db9ad738b9f279a7d7fc4f4d8d75ccb77af762fb86`, 5,394,882 compressed bytes. Its two chunk sizes are 5,242,880 and 152,002 bytes. All 436 unique regular-file members match the exact content set, lengths, and SHA-256 names. Archive and final map recompression were independently byte-identical.
- `reviewer-failed-audit-receipt.json` retains the successful clean materialization, repeat, read-only, original closure, exact-map, archive, and restored-closure checks, followed by a reviewer expectation failure. `completion-receipt.json` records corrected negative controls and final unchanged-subject checks. Raw streams and audit source preimage are preserved. `main-negative-receipt.json` records four additional executable-helper adverse checks.

The helper was read before execution. It uses descriptor-based `O_NOFOLLOW` directory traversal and exclusive file creation, verifies the entire pinned archive before target creation, prechecks existing allowed files, does not call tar extraction writers, and verifies the exact restored file set afterward. Reads and assertions cover the installed AGENTS/runtime/profile/pessimistic-judge/judge-task instructions.

## Requirements review

| Requirement | Met? | Independent evidence |
|---|---|---|
| Complete frozen packet closure | Yes | All 52 candidate manifest rows plus its exact-self-excluded manifest verified before and after; no unknown file, symlink, or hash/length mismatch. |
| Exact original path/hash/length map and complete manifest preservation | Yes | Map equals the original 63,543 rows plus the exact 17,783,968-byte manifest; its archive content equals original manifest bytes. Original closure rehashed before and after. |
| Lossless full clean reconstruction | Yes | 63,544 creations, full independent restored manifest closure and exact original manifest equality. Replica is only in reviewer-owned work. |
| Deterministic content archive and map | Yes | Independently recompressed ordered normalized USTAR/gzip archive and canonical JSON/gzip map equal the frozen bytes. |
| Bounded transport artifacts | Yes | Map and both archive parts are individually at most 5 MiB; candidate closure has no oversized artifact. Largest restored original is 17,783,968 bytes and is transported compressed. |
| Exclusive creates and existing-byte preservation | Yes | Clean run, zero-create repeat, unchanged existing mismatch fixtures, direct exclusive-create rejection, and no existing-file overwrites observed. |
| Idempotence and read-only verification | Yes | Both helper rerun modes verified 63,544 existing files and created zero. |
| Symlink ancestor/member, traversal, unknown/duplicate, missing member, hash rejection | Yes | 21 direct negative rejections plus four main-helper negative rejections; outcome assertions check foreign bytes and outside directories. |
| Failure ownership | Yes | Injected write error leaves only the new reviewer-owned empty partial file. Foreign file bytes remain unchanged. Automatic rollback is neither implemented nor claimed. |
| Truthful qualification and scope | Yes | Candidate explicitly claims transport preparation only. No review network, Git/index/ref, key/environment, product/source, native, private, paid operations, or child agents. Writes remained in the two reviewer-authorized paths. |

## Issues found

### Critical

None for this frozen bounded transport candidate.

### Important

None that blocks this frozen candidate's losslessness, closure, or safe restoration into an owned target.

### Minor

- `materialize.py:30–36` reads an entire local regular file before its caller checks its expected size/hash. The frozen transport files are bounded and verified, but the helper does not impose a read allocation ceiling on an unexpectedly oversized corrupted local file. This PASS covers actual bounded transport artifacts; it does not certify bounded peak memory against arbitrary local substitutions. Future generalization should use the expected length plus one byte, or streaming hashes.
- A failed write can leave a newly created owned partial file (`materialize.py:68–81`). This preserves foreign files and makes the failure visible; a subsequent run rejects its mismatched bytes until the operator handles that owned partial file. There is no transactional rollback guarantee.

The suspected escape-validation issue is disproved. AST inspection of `materialize.py:12` found the tested constants have codepoints `[92]` and `[0]`: one backslash and an actual NUL. Independent probes reject both. An initial reviewer acceptance expectation misread JSON-escaped tool output and failed correctly; the failed source, raw traceback, and correction are retained in `literal-inspection-correction.json` and the failed-audit evidence. No candidate fix was necessary.

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 5/5 | Every bounded transport requirement has independent outcome evidence. |
| Code Quality | 4/5 | Pinned map/chunks, full prevalidation, descriptor-based paths, exclusive writes; allocation/rollback limitations explicitly bounded above. |
| Test Quality | 5/5 | Full independent restore/closure/determinism and 25 adverse outcome rejections, including main-helper corruption and symlink targets. |
| Pattern Adherence | 4/5 | Scoped transport-only review, own fixtures, preserved failures, untouched source/qualification. |
| Completeness | 5/5 | Exact original closure including its manifest is recoverable with the shipped helper, map, and two parts. |

**Average: 4.6/5.**

## Review execution limitations and failure accounting

The first read-only discovery command used nonexistent shortened `goalqa/` paths and exited 2. Its genuine raw output is preserved in `bootstrap-discovery-failure.json`; it did not emit UTC bounds, so no retrospective timestamps are invented. Subsequent reads and all substantive checks have genuine UTC bounds. A supplementary reviewer fixture setup also failed because the first path's already-created parent was passed to `mkdir` without `exist_ok=True`; no subject helper ran before that failure. It was corrected in a fresh own fixture root and its exact traceback is preserved. The third observed failure was the reviewer escape expectation described above; corrected negative controls passed. These reviewer failures are not omitted or represented as subject successes.

The 63,544-file reviewer replica remains solely in `work/resume/task04-transport30-fresh-review/replica`; none of its materializations targeted original paths, even when bytes would have matched. No frozen artifact was edited. Original report/manifest hashes and the candidate exact closure remain unchanged.

## Recommendation

Accept the frozen packet for the bounded evidence transport representation: retain the original report directly and the complete sealed candidate packet; require materialization before checking the original full report/manifest closure. Keep qualification verdicts unchanged. Any later Git representation operation is a separate coordinator action and must preserve the exact original report, complete packet, and local originals.
