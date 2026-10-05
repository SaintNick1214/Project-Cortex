This C2 packet changes only the transport helper's file-read bounds. The active compressed map and two archive blobs are byte-identical to frozen C1. All original paths, bytes, hashes, lengths, assertions, verdicts, and 5 MiB binary limits are unchanged. This packet grants no task, test, goal, source/native, private, or paid qualification.

Retain the original frozen review root `report.md` directly and this complete C2 packet; omit the other 63,543 frozen original Git paths. The original 17,783,968-byte root manifest is restored from the existing content archive before original QA closure verification.

```sh
python3 -B _goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30-c2/materialize.py --target _goals/convex-backend-runtime-2026-10-02/qa/task04-catalog-release-c4-fresh-review --materialize
python3 -B _goals/convex-backend-runtime-2026-10-02/qa/task04-evidence-transport-30-c2/materialize.py --target _goals/convex-backend-runtime-2026-10-02/qa/task04-catalog-release-c4-fresh-review
```

The helper checks each input's regular-file status and size before buffering, reads at most its trusted bound plus one byte, and rejects oversize rather than clipping. Maps use the unchanged 5 MiB cap; archive chunks use their exact recorded size; existing originals use their exact recorded original size. Existing exact files are verified; missing originals use exclusive creation with no overwrites. Archive member closure/content is fully checked before original creation, and unsafe paths, symlink ancestors, link/unknown/duplicate members, and mismatches are rejected.

`lineage/c1/` preserves the entire 53-file frozen C1 packet, including its old helper, report, README, manifest, and receipts. Those observations belong to C1, not C2. Two failed C2 preparation construction attempts are preserved under explicitly named lineage directories; neither wrote a helper or created a replica. New C2 receipts document the corrected helper's actual clean reconstruction, original 15 adverse assertions, actual single-backslash/NUL precreation controls, oversize controls, idempotence, and read-only verification.

The initial suspicion about C1 forbidden-character literals was not reproduced: direct AST/actual-character checks show C1 already rejects codepoint 92 and codepoint 0. C2 preserves those semantics and adds explicit actual-character controls. The confirmed C1 defect was its unbounded `read_at()` buffering before size/hash rejection.

Consult `report.md`, `summary.json`, and the exact-self-excluding root `qa-manifest.json`. Historical scripts/receipts are audit evidence, not preparation rerun instructions over a sealed packet. C2 requires its own fresh review before checkpoint use.
