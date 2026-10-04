# Independent C4 incident recovery judgment

Verdict: **PASS — recovery only**. Recovery acceptable: exact original content and self-only recursive filelike closure are restored. Native preparation acceptance, transport acceptance, and C5 acceptance remain outside this verdict. Custody continuity across the unauthorized incident is **not established**.

| Dimension | Score / 5 | Evidence |
|---|---:|---|
| Recovery requirements | 5 | Every original manifest row verified, exact recursive set, 752 archived members, 750 additions absent, two originals restored. |
| Recovery implementation | 4 | Checks all archived member content/modes and current source identities before mutation; restricts mutation to exact incident set. Non-atomic restoration and incomplete historical capture remain disclosed. |
| Outcome verification | 5 | Independent full current namespace read, literal links, sizes/hashes, before/after identity check, archive examination, original mirror comparisons. |
| Scope and preservation | 5 | Original manifest unchanged, history retained, declared negative hardlink fixtures retained, no native/network/Git operations. |
| Historical evidence completeness | 4 | Recorded incident preimages and verified six genuine command receipts/raw streams; explicitly incomplete preincident metadata and command coverage. |

Average: **4.6/5**. No recovery-blocking content defect found. Historical continuity is a separate blocked claim, not a recovery requirement silently waived.

## Independent observed checks

The actual verification command was `python3 work/resume/task04-c4-incident-recovery-fresh-review/verify.py`, cwd `/workspace/Project-Cortex`, tool session 14182, observed exit 0. Helper records resolved executable argv. It ran from **2026-10-04 15:37:25.281687 UTC** to **15:37:49.048731 UTC**, reading **2,043,566,235 regular-file bytes**. Saved stdout is exact command output; stderr is genuinely empty. Read-only hashing may update access times, which are intentionally excluded from stability comparisons.

| Requirement | Result | Evidence |
|---|---|---|
| Original manifest, no repin | PASS | SHA256 `0e3575cdb2978556896a4fa41e78a370d417d2b3352367717ad0a274b81e1901`, checked before/after; original self exclusion remains only `work-manifest.json`. |
| Exact recursive whole filelike set | PASS | 133,252 entries including manifest self; 133,251 unique manifest rows; traversal never follows symlink directories. |
| Every original content row | PASS | 133,221 regular files checked for exact SHA256 and size; 30 literal symlinks checked for literal target bytes/hash. |
| Stable inspected namespace | PASS | All 133,251 filelike lstat identities captured and matched after audit: dev/inode/mode/nlink/size/mtime/ctime. Self manifest independently byte-pinned. Capture is progressive per-row, not an atomic snapshot. |
| All incident preimages archived | PASS | Exactly 752 unique regular members, each exact source-before hash/size/mode; all 750 map additions match. Archive SHA256 `6a4d8a32576af62bd92c8201d1f549d31d8e15295ef20d7575262f54d942f046`. |
| Two originals restored | PASS | `extension/inventory-entry.ts`: 4,918 bytes, SHA256 `6bc9c3a78fa4ac48a135cbae7175733ba5a63d1c1b77390663ae82fc2be93bd2`; `extension/inventory-bundle.mjs`: 758,591 bytes, SHA256 `fdee53b7a6e9ad82f56be35d2cb83f153c717f4ef149e8c07101f3be80b1bcb4`. Both byte-identical to original manifest and read-only mirror, mode 0600. Current incident inode retained, nlink 1. |
| Only proven incident additions removed | PASS | Recovery removal actions correspond exactly to 750 source-before/map paths absent from original manifest; every removed preimage is archived; all 750 paths currently absent, including dangling-link check. |
| Negative hardlink fixtures retained | PASS current state | 32 manifest files form 16 exact original `.DUMMY-link` pairs with nlink 2 and common inode per pair. Full bytes match manifest and mirror, current mode matches mirror; all current ctimes precede incident. Audit identities remained stable. Mirror is transport-flattened nlink 1, so it cannot prove original inode metadata. |
| Incident history preserved | PASS | Unauthorized bytes preserved in archive plus both C5 retained overwritten files; both retained copies match archived/source-before bytes. Six linked receipts and compressed raw stdout/stderr checked against their recorded encoded and decoded hashes. |

## Recovery script review

`work/resume/task04-c4-incident-root-recovery.py` pins the original manifest hash and row count. Each addition must be an exact map member, safe relative path, manifest-absent regular file, nlink 1, exact byte size/hash. For the overwritten pair it verifies original recovery bytes against the manifest, requires incident bytes differ, and verifies current and original mirror modes 0600. It rejects symlink ancestors for all sensitive reads.

Before any source mutation it saves source-before identities, writes the archive, independently verifies all 752 archived members and their modes/bytes, then rechecks every current source identity against the saved identity. Restoration uses O_NOFOLLOW and verifies dev/inode/nlink, writes/fsyncs in place, rereads exact restored bytes. Deletion is restricted to the saved 750 map paths after content rechecks. Directory removal is limited to now-empty addition ancestors absent from original declared directory ancestry. It pins unchanged manifest bytes at completion. My whole-namespace check supplies the broader post-recovery closure check the script labels pending.

The sequence is not transactional: a failed write could leave a partially restored file, and deletion rechecks content rather than the full saved inode identity immediately before unlink. These are race/crash limits, not observed failures; archive preimages and current exact post-state were verified. The script does not snapshot the whole namespace before mutation and cannot reconstruct its preincident inode/timestamp metadata.

ROOT reports actual recovery tool session 17074 exit 0. Source-before records actual recovery argv and UTC 15:35:32.816800; final receipt UTC 15:35:35.913796. These are internal observation times, not independently reconstructed process start/end. ROOT's raw terminal trace was not copied into recovery QA; this judge does not fabricate one. The current recovery script hash is saved in supplemental evidence; its original preexecution byte image/hash is unavailable. ROOT postincident verifier receipt is separately preserved, with 15:35:41.411823–15:35:56.695095 UTC and exact closure outcome; this report derives its verdict from the independent scan.

## Preserved failures and custody blocker

Verified handoff receipts retain six actual commands. Full argv, times, source row counts, raw hashes, and paths are in `verification.json`. Commands execute the C5 QA scripts `inventory.mjs --verify`, `offline-extension.mjs`, and `offline-runtime-freeze.mjs`, using `node --experimental-vm-modules`. The 15:26 inventory and outcomes commands both exited **1**; their later 15:31 counterparts exited **0**. Both freeze commands exited 0. Earlier failures remain part of the record; later success does not erase them. All commands declare native `NOT_RUN`.

The initial receipts contain 1,249 pre and post rows; later receipts contain 1,253 pre and post rows. **None of the six inventories contains any C4 scratch namespace row**, including the overwritten pair or additions. Their broad scope label is therefore insufficient for C4 custody. The additions were already observed around 15:26:30 during the first freeze command, while the original C4 manifest observedAt was 14:31:13.556277. The unauthorized mutation broke the original freeze claim in fact, even though original content is now recovered.

Consequential blocker: subsequent independent transport/C5 reviewers must retain and acknowledge this incident and qualify evidence from the recovered pinned bytes under a new genuine preexecution capture. They may proceed with a new byte-based transport review after explicit recovered-state provenance and verified source inventories; they may not claim unbroken historical custody, promote these incomplete command inventories to full C4 coverage, or treat this recovery PASS as original native preparation/C5 acceptance. Preincident inode/mtime/ctime cannot be recovered and must remain unknown. No amount of manifest repinning can repair that historical gap.

My own helper lacks a separately saved preexecution byte hash; its preserved current script and postexecution hash are recorded honestly. During early inspection one `rg` discovery exited 1, a shorthand `qa/` read failed because canonical QA is under the goal tree, and a bulk handoff read was truncated. Structured canonical JSON/raw-channel checks replaced these incomplete reads; no verification assertion failed. These capture gaps are recorded in supplemental evidence rather than relabeled as successful initial reads.

## Artifacts and scope

`verification.json` holds independent numeric outcomes and actual command details. `source-pre-post-identities.json.gz` holds all current per-file identities with exact post equality. `supplemental.json` records current input hashes, hardlink checks, C4 inventory omission, capture gaps and inspection failures. `verify.stdout`/`verify.stderr` preserve real output. Own `qa-manifest.json` and `work-manifest.json` use exact recursive self-only closure. They inventory only these review namespaces, exclude only their own manifest, and do not modify or duplicate the original manifest.

Only this review QA directory and `work/resume/task04-c4-incident-recovery-fresh-review` were written. No original candidate, existing QA, mirror, Git, native preparation, network, key material, second mirror, or cleanup operation was changed/run. Runtime/profile/reviewer/feature-orchestrator instructions were read; this is a fresh delegated read-only reviewer and no child agents were created.
