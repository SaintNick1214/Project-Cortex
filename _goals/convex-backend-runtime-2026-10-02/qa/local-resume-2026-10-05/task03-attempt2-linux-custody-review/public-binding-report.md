# Task Judgment: Task03 attempt2 repair1 actual Linux public custody

## Verdict: PASS — actual public destination and current byte bindings only

This fresh independent judgment qualifies the prospective Linux public copy in `cortex-task03-attempt2-fixture-20261005-511363b3`, using immutable image `sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3`. It does not qualify private custody, an actual managed target, CLI dispatch, native service behavior, 03-foundation, full Task03 or the goal.

The repaired freeze is `cd5e0c71e1839f079906becb9c5e0a90aba2261890ec4fb7997bc2981db966f5`, with 833 frozen files. Actual full public membership is 840: all 833 frozen paths, the freeze, the exact preparation enabling attestation, and the 5 generated baseline files. Total bytes are 24,129,478. The actual volume receipt SHA256 is `c03b0270a3886bc8cbe283e20cacf19617cf93fb6cc97e97891247aeb6c601cd`.

The reviewer independently read runtime/profile, repository AGENTS/manifests/status, pessimistic-judge/judge-task, goal, original03/c2 requirements, guard/source recipe, finalized fresh preparation/management reports, enabling attestations, transfer helper and raw transfer/init/owner diagnostic receipts. Writes are confined to this new reviewer directory. Docker review mounts were read-only, with networknone, UID 501:GID 20, immutable linux/amd64 image and 512 MiB finite-memory limits. No private contents, service/native subjects, management mutators, official CLI, compiler/typecheck, inference, target or cohort effects were accessed or invoked.

## Requirements Review

| Bounded requirement | Met? | Evidence |
|---|---|---|
| Exact image and owned volume operation | Yes | Fresh `image-inspect.stdout` verifies actual engine ID/linux/amd64; `volume-inspect.stdout` verifies name and exact goal/operation labels |
| Exact 840 path membership with baseline generated hashes | Yes | `actual-public-custody.stdout`: no missing/extra path, all 833 freeze rows, exact 5 generated rows pinned by frozen baseline manifest, freeze and matching PASS attestation |
| Independent actual full source/destination read and frozen-byte equality | Yes | `public-custody.py` uses held O_NOFOLLOW FDs, reads to EOF, checks full size/SHA256 and exact source/destination bytes for every path |
| Actual all-nine held/path stability and no links | Yes | All 840 current source and destination reads check dev/ino/mode/nlink/uid/gid/size/mtimeNs/ctimeNs as decimal strings before/after held reads and pathname reads; directory FDs/path identities are also held and rechecked |
| Linux destination identity bound to original copy receipt | Yes | All 840 destination nine-field identities match the transfer receipt exactly; receipt itself is full-read, hashed and stable |
| Actual ownership and modes | Yes | All 840 regular one-link destination files are 501:20/0600; all 107 candidate directories and owned/private roots are 501:20/0700; no symlinks |
| No premature private copy | Yes | Exact owned root has candidate/private/public receipt; actual private directory is empty before and after public verification; private bytes read 0 |
| Actual source/dependency placement and runtime | Yes | `source-preflight-command.json` mounts read-only host repo at its real path, read-only deps volume subpathnode_modules at repo/node_modules, candidate volume subpathcandidate at exact QA path; actual Linux Node 24.15.0/npm 12.2.0 and required dependencies observed |
| Actual `sourcePreflight()` succeeds | Yes | `actual-source-preflight.stdout`: 161 source pins, 138 product-root membership paths, 138 managed copies, 833 exact candidate paths, 114 compiler projection files and 6 CLI pins verified by exact guard |
| Owned HOME/tmp and finite resource limit | Yes | Actual HOME=/tmp; owned tmpfs UID 501:GID 20/0700; literal 536870912-byte cgroup, before/after memory events unchanged, max/oom/kill 0 |
| Fresh preparation/management binding | Yes | `actual-parent-bindings.json`: report hashes match enabling attestations; repaired guard/freeze, current management helper and parsed-request SHA all match fresh independent reports |
| Historical failed operations and scope preserved | Yes | Root-user transfer raw FAIL, finite empty-volume initialization, UID 501 source probe, reviewer strict source-identity FAIL and setup failures remain saved; no historical/source tuple rewritten |

## Separate historical source identity comparison: FAIL

The reviewer initially applied a stricter supplementary check: current host source all-nine identity must equal its earlier source tuple in the transfer receipt. That assertion failed at `managed-fixture/fixture/.gitignore`. The complete 840-file diagnostic found exactly one differing field on exactly one source path: `st_ctime_ns`, recorded 1791262514872759351, observed 1791265947576207585. The dev, inode, mode, link count, UID/GID, size and mtime match. Full source and destination bytes/hash match the frozen pin. Every destination tuple matches its copy receipt. Every current full held/path read is stable.

The exact strict comparison remains **FAIL**, preserved in `actual-public-custody.stderr.source-identity-diagnostic`, its command receipt/preimage, and `actual-public-custody.stdout`'s difference ledger. The cause of the host ctime change is unknown; no metadata-operation receipt proves it. It is not attributed to Git, Docker or another actor, and its earlier source tuple is not rewritten.

The source helper's `read_owned_source()` promises all-nine stability while it holds and fully reads each source FD. The actual-copy recipe requires rehashed frozen/current bytes, canonical ownership and the new Linux copy; guard `sourcePreflight()` checks bytes, membership, dependencies and canonical paths. Original03 and c2 criteria require current-source fingerprints and service/authorization outcomes. None establishes continuous equality of host-source metadata after copy. Therefore this stricter historical-source comparison failure does not become a claimed PASS and does not negate the independently verified operational Linux destination/current-byte gate. Task04's separate C8 continuous closure/pidfd contract is outside this review.

## Evidence and setup corrections

The original root-user transfer exits1 at the source UID/GID assertion before copy/init effects. Its raw command/stderr are independently rehashed. The separately saved finite initialization observes the exact new empty volume root change 0:0→501:20/0700, and the UID 501 source probe plus actual UID 501 successful transfer remain distinct. The current transfer helper SHA is `7aae094c5a6789268c1c86bc08fb78a84c3a50236dc5ad1f7d2a6cd5eb161cc8`; its fresh actual copy exited0. This reviewer did not execute any transfer or mutate the volume.

Two reviewer setup assumptions were corrected without altering product/candidate assertions. The parent shorthand “onlylabel operation” was initially interpreted as a single-label predicate; the observed volume has exactly the matching goal and operation labels, which the parent clarified were both in its creation command. The failed pre-container label assertion and clarification are saved. The reviewer also guessed an unnecessary Linux esbuild version 0.28.1; the actual installed/root-lockfile pin is 0.27.0. That setup assertion failed before sourcePreflight. Its source/raw/command are preserved; the final check derives esbuild/linux-x64 versions from the frozen current root lockfile rather than a guess. Required Convex 1.46.0, TS 6.0.3, ws 8.21.0 and https-proxy-agent 7.0.6 assertions are unchanged.

The raw actual-public diagnostic stores the 840 per-path prospective identities, full SHA/size and source/destination flags, plus 107 directory identities. The actual sourcePreflight raw output records runtime, placement, dependency versions and cgroup receipts. `actual-parent-bindings.json` stores full held-read current identities/hashes for enabling reports/helper/request and prior transfer receipts. `evidence-manifest.json` hashes every reviewer-owned source/raw/report artifact. Current observations establish these prospective copies; they do not adopt historical private/service results or claim continuous monitoring between observations.

## Issues Found

### Critical

- None within the stated actual public destination and current byte gate.

### Important

- Private target/env/key custody and actual target validation remain a separate requested phase before CLI/native use. No private or native acceptance follows from this report.
- The supplementary historical host-source all-nine comparison remains FAIL with unknown ctime-change cause. Preserve this exact result and avoid using its old source tuple as current metadata evidence.

### Minor

- Parent label wording and reviewer esbuild-version assumption required the documented setup corrections. No assertions from the accepted candidate or prior failed outcomes were weakened.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment |5/5| Every bounded actual-public requirement has observed exact byte, identity, membership, ownership, runtime and binding evidence |
| Code Quality |4/5| Reviewed copier and independent verifier hold/close FDs, read full bytes, reject links and recheck identities; no continuous-host/atomic closure claim |
| Test Quality |4/5| Actual read-only840-file comparison plus actual sourcePreflight; failed supplementary/setup checks retained rather than recast |
| Pattern Adherence |5/5| Explicit checkout, disjoint reviewer writes, secret-free receipts, no effects, finalized fresh evidence bindings and distinct historical/prospective scope |
| Completeness |4/5| Actual public gate complete; actual private target/custody, CLI and unchanged native/foundation/final gates are deliberately separate |

**Average:4.4/5.**

## Recommendation

Accept only this actual Linux public-destination/current-byte binding. After coordinator inspection, the separately accepted management helper may provision the exact fresh owned request, followed by its bounded private transfer. Require an explicitly requested fresh phase2 actual-private custody/target validation review before CLI dispatch. Keep foundation acceptance open until official codegen/typecheck, all required native cases, no-effect/cleanup/process-terminal/retirement receipts and fresh independent live aggregate review pass. Full original Task03 remains open at its unchanged functional restoration/final gates.
