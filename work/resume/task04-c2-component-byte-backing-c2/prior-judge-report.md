# Task judgment: pinned C2 byte backing transport, fresh frozen review

## Verdict: NEEDS FIXES — transport helper only

The pinned historical archive is authentic and full restoration works. The helper nevertheless accepts source index/parts through a symlink ancestor, contradicting the input symlink denial contract. This review does not release Task04, any original 122 command, SOURCE/PARENT/ROOT/native/paid gate, or historical custody. The separately accepted launcher component remains a separate 4.4/5 component judgment.

## Evidence review

Read repository AGENTS, runtime/profile, pessimistic-judge, judge-task, feature-orchestrator, Task04 criteria, the accepted component-only report, actual pack script and complete helper/index/README. No subagents, Git, network, native target, paid operation, actual private keys or implementer/reviewer-original writes occurred. All large owned artifacts are confined to `/tmp/cortex-c2-backing-transport-fresh-review`; repository writes are only this review's new QA/work trees.

The original index is SHA256 `cf6314cb96d9b8b74be64839ff971a0e85068dc6a67c5b8bf8433850263b6866`; helper is `c40a76aa7dc4e4485b27bda53b6a05630617534e4fe2801c4ad9104ee70ef4ca`; README is `3aed00550475691b55179748dff262853529df1ee1af921217f170020697e147`. Independently copied these and all13 actual parts byte-for-byte into owned public input, directory0755/files0644, then joined and authenticated archive SHA256 `54acd89e701d3e49d4a239e857dac7d10fd5980072965536c28c74c62da06e42`,66753445 bytes. All301 literal source references were freshly read with final-component nofollow, ordinary single-link files, stable descriptor identity checks, byte length/hash authentication; every object was restored and independently authenticated against the index:156 objects,68361292 raw bytes. New output directories0700 and files0600. Genuine full materialization and unchanged idempotent verification each exited0.

Before actual helper dispatch, sourcePRE captured and losslessly gzip-archived all301 listed temporary payloads, all13 parts, helper/index/README, actual Python executable, actual pack script and reviewer harness. Every gzip archive was freshly decoded and compared. Continuation/additional harnesses were separately prearchived before their actual helper dispatch. sourcePOST reauthenticated the original inputs without modifications. Raw stdout/stderr, exact actual argv, repository cwd, UTC boundaries and exit codes exist per helper run in owned `runs/` directories. This is prospective scoped byte custody, not reconstructed historical identity or restored original inode/topology custody.

There are45 actual helper runs:44 match expected outcomes; one required source ancestry denial fails. Two genuine positives, one small positive and one explicit source ancestry acceptance observation exit0. The40 expected negative/error outcomes exit1. Invalid hash/CRC, trailing and concatenated gzip, decompression cap, TAR traversal/absolute names/links/duplicates/missing/oversize/hash/mode/trailing garbage, source part paths/types/bool lengths, archive/part caps, late missing part, literal input symlink/hardlink, destination mode/contents/symlink/ancestor/objects links and existing overwrite controls all assert observable effects. Invalid archive/input cases leave no destination; destination denial cases preserve sentinels. RLIMIT_FSIZE=1 produces an explicit one-byte partial object after destination creation; subsequent verification rejects that object without overwriting it. This OS failure is consistent with README's explicit partial-output limitation.

The initial reviewer harness exited1 at its own post-control sentinel read: `read()` requires nlink1, but the intentional hardlink fixture makes its owned foreign sentinel nlink2. All helper receipts preceding that stop remain preserved. No helper or assertion was weakened. Separately prearchived continuation/additional scripts completed remaining controls; initial source and lossless prebytes remain intact. The source-ancestry failure is a candidate defect, distinct from this reviewer fixture exception.

## Requirements review

| Requirement | Met? | Evidence |
|---|---|---|
| Authenticate actual13 parts, index/helper pins, all301 literal sources and156 objects | Yes | sourcePRE/POST; genuine full output independently bytechecked |
| Flat SHA content restoration, provenance labels never written | Yes | Genuine and small fixtures; arbitrary provenance label remains absent |
| Private owned output, existing verification without overwrite | Yes | Exact0700/0600; corrupted existing object preserved and rejected |
| Complete archive validation and cap before destination mutation | Yes | Invalid input/archive destinations absent; gzip cap and late part denied |
| Deny source symlinks/hardlinks including bound ancestry | No | `source-ancestor-symlink-required-denial`: expected1, actual0, output created |
| Safe destination ancestry and link/type handling | Yes, bounded | Actual destination symlink/ancestor/object-directory/object link controls |
| Explicit late OS partial failure | Yes | One-byte partial retained; next run denies without repair |
| Complete historical/native/product qualification | Outside scope, still held | Archive only; no original physical paths/inodes/topology restored |

## Issues found

### Important — blocks this helper's PASS

`materialize.py:6–10` inspects only the terminal input path and opens it with O_NOFOLLOW. It does not bind or inspect ancestor directories. In the actual required denial control, the owned source ancestor link resolves to a directory containing valid small index/part bytes; helper returns MATERIALIZED and creates the requested destination. `runs/source-ancestor-symlink-required-denial/receipt.json` records expectedExit1, exit0 and outcomeMatched=false; raw stdout proves restoration. The equivalent observation and its restored bytes are preserved independently.

Repair source reads using validated ordinary-directory ancestry and a descriptor-relative traversal (with nofollow and identity checks). Do not change archive/index pins or loosen this denial. Fresh judgment of repaired helper and its documentation is required.

### Minor

Dense helper formatting makes review harder. Broad input/index memory limits, Python optimization removing `assert` checks, malicious interpreter/process replacement and privileged races are not certified by these bounded controls. This report does not claim whole-OS/kernel/malicious-code process isolation. The actual Python executable was prospectively captured; shared libraries, kernel and every transitive interpreter dependency were not. Outer helper commands are recorded; outer reviewer orchestration/tool shell subprocesses are not a complete process-integrity recorder. The initial harness failure is preserved by unchanged source, prebytes and tool-observed traceback; it lacks a separately prospective outer-harness raw/UTC receipt and is not presented as a successful run.

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 3/5 | Actual source ancestry denial fails; archive/object requirements pass |
| Code Quality | 4/5 | Bounded validation/private descriptor-relative output, source ancestry gap |
| Test Quality | 4/5 |45 actual outcome controls, one preserved defect, initial fixture error transparent |
| Pattern Adherence | 4/5 | Separate owned scope, frozen inputs, prospective archives, held gates explicit |
| Completeness | 4/5 | Full156 restore/idempotence reachable; ancestry repair still required |

**Average:3.8/5.** NEEDS FIXES; Requirement Fulfillment is below required5. No acceptance is granted by this report.

## Seals and limits

Literal self-only QA/work/tmp manifests enumerate all entries under this review's respective roots using lstat and never traverse symlinks. Manifest files exclude only their own named entries to avoid recursive hashing; exclusions are explicit in each manifest. These seals cover reviewer artifacts, not original source identities or the independent original-eight-root transport. Symlink targets are literal text; intentionally linked negative fixtures remain links. SourcePRE/POST prove scoped original bytes unchanged; original historical metadata/topology is not claimed continuous. Parent ROOT must inspect this report, actual receipts, manifests and pins before deciding on the separate repair.
