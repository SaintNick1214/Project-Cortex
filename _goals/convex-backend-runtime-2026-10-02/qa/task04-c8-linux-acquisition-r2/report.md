# Task Completion Report

## Status: COMPLETE — bounded acquisition and source baseline repair

The new r2 namespace has a fresh Linux baseline for the finite source inputs. The old C8 packet and failed physical pins remain unchanged. This completes acquisition/source preparation; Task04 runtime qualification remains held.

## Changes Made

- Created finite acquisition helpers under `work/resume/task04-c8-linux-acquisition-r2/` and the exclusive disk-backed Docker volume `cortex-runtime-c8-r2-acquisition-20261005-01`. The host repository was mounted read-only. Acquisition files are owned by Linux UID0/GID0 with directories0700/files0600; subsequent mounts explicitly use `volume-nocopy`.
- Authenticated six published content routes, all361 parts, full encoded/decoded hashes, all members, and single-gzip EOF/CRC. The sixth route contributes the mandatory historical `closure-audit.json`,13,909,295B, SHA256`fcba3f917eef5557eb6c3d4ed360e236f2bd9dfc9745d689d541c885768c3c62`, from139 parts/727,823,685 encoded bytes.
- Selectively retained489 objects/33,206,385 bytes in owned Linux files. Historical transport identities were not adopted as new subject identities. Existing positive owned object pins were reread and required equal; no failed pin was refreshed.
- Independently derived the historical70020 rows/3,001,521,619B from original declared manifests:59,756 current byte-valid files and10,264 physically missing paths, all with backing. FULL8 remains148,325 rows/148,295 regular/30 literal links and3,110,990,905 regular-path bytes,18995 objects/1,215,614,313 unique-object bytes. Required content missing:0 in either cohort. No full cohort was physically materialized.
- Acquired exactly seven official root-lock tarballs,17,420,689 encoded bytes,76,057,286 expanded regular bytes/3458 regular paths. All locked SHA512 integrity values, headers, member hashes, package names/versions, archive EOF/CRC passed. No extraction, installation, lifecycle, import, native/compiler execution occurred. All18 original package-file SHA256 obligations match.
- Copied only138 finite source aids:124 prospective candidate source files plus14 mandatory current/contract/recipe/residual inputs, then captured fresh owned full-byte/held-FD/all-nine identities. Source copies were never imported or evaluated.
- Preserved two acquisition helper failures. Attempt1 completed the six routes but lacked a finite manifest object. Attempt2 acquired the four additional manifest objects, derived coverage and seven package inventories, then failed on a historical row lacking a`bytes` field. The completion helper compared declared hashes and treated undeclared historical sizes as absent; it did not invent them or change frozen metadata.
- Preserved the incorrect prior image identifier. A fresh read-only lookup of`e69eda...` fails; the parent explicitly corrected that build-config digest to the actual engine immutable image/indexID`9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3`. This is Linux/amd64 Node24.15.0/npm12.2.0/Python3.12.15, canonicalPython`/usr/local/bin/python3.12`.

## Requirements Checklist

- [x] Six authenticated routes and exact mandatory extra object — `six-route-catalog-and-demand.json`, `archive-stream-proofs.json`, `acquisition-contract.json`.
- [x] Missing physical paths distinguished from content absence — `/repair/attempt2/report/historical70020-coverage.json` in the exclusive volume, full128,914,214B record; its full-byte/all-nine pin is in the completion and final Linux manifests. Large coverage metadata was not copied back wholesale.
- [x] Fresh selected operational source and current mandatory source identities — `selected-object-baselines.json`, `finite-source-baselines.json`, final Linux seal.
- [x] All original122 IDs/contract bytes, eight native20second recipes, whole120second absolute deadline, FULL/RPC source tiers retained — `original-gate-conservation.json`; original command SHA256`4db94b3105073be227e2ac3ab461336e3927f3cffe17f901413ca3bf301445dd`.
- [x] Source defects/residuals honest — prior candidate two writer stubs remain retired/nonreachable in source; their runtime behavior is unqualified. All501 IDs retained and301 semantic interpretations unresolved. This repair makes no additional semantic disposition or runtime claim.
- [x] Exact finite cohort/package/backing/preimage demand — `next-phase-demand-accounting.json`, `six-route-catalog-and-demand.json`.
- [x] Version conflict disposition based on exact original consumers — `runtime-version-disposition.json`, `version-source-inspection.json`.
- [x] Both failures and historical custody gaps preserved — `attempt1-preserved-failure.json`, `attempt2-preserved-failure.json`, original C8 untouched. The11 forensic references remain historical gaps; they are not invented runtime content blockers.
- [x] All script bytes and permissions finalized before fresh Linux seal. Self-seal inode was created before directory PRE captures; source files/directories are held and checked for full-byte/all-nine equality.

## Runtime disposition and resources

The source-only inspection covered741 original JS/TS bodies and113 prospective helper sources. Zero literalNode24.19 source assertions were found; no reader accesses `toolchain.versions.node` or `parentDeclaredToolchain.versions.node`. Three `cli-prerequisites.mjs:9` consumers hash frozen package files and enforce package versions/npm12.2; three `deploy.mjs:11` consumers enforce the declared shim directory; three `guard.mjs:24` consumers enforce dependency-tier closure. Gateway references use actual process.version for runtime identification. Exact source texts/pins are recorded. Node24.15 satisfies the authorized minimum; no found executable assertion requires a new24.19 image. Original metadata continues to declare historical24.19 and cannot claim the new runtime. Next preparation must create separate actual executable/PATH baseline metadata under a new prospective namespace.

The completion resource PRE reserve was4,268,875,776B and POST reserve3,633,111,040B within a4GiB cgroup. Disk available was~865GB; memory.events contained zero limits/OOM events. Acquisition reserve threshold is128MiB; subjectNode reserve512MiB remains held. Every future phase needs a fresh measured preflight; storage must remain disk-backed, never `/dev/shm`.

Known next finite physical demand is6,226,454,141B:FULL8+HIST70020+original823(18,836,975B)+C6comparison823(19,047,356B)+seven expanded packages(76,057,286B). Full raw exact source-preimage demand is the same6,226,454,141B; combined subtotal12,452,908,282B with no deduplication/compression assumption. Six encoded backings remain on an existing read-only mount and are streamed, so broad archive copies add no owned storage demand. Their exact counts/sizes and decoded totals are separately recorded. Selected489 object bytes and tarballs already exist in the acquisition volume.

This subtotal excludes subject-generated closure snapshots, output tapes, ledgers and receipts. These must be calculated from exact fresh canonical dispatch closure rows/bytes/options and actual recipe/receipt counts before dispatch. Original formulas remain: compilerraw`32*(graphBytes+snapshotBytes)+8192*rows+16384` per stdout/stderr; encoded`rawLimit+ceil(rawLimit/65536)*64+1024` per stream; root combinedraw`32*closureBytes+16384`; each root receipt quota1GiB; original ProcessOwner raw256000. Overflow is failure/incomplete. No guessed totals authorize effects.

## Files Modified

Only new r2 work/QA files, private scratch and the exclusive new Docker acquisition volume were written. No product, generated root APIs, old C8 packet, published archives, original contracts/assertions or deployment files were changed. No git commit/publish occurred.

## Verification

- [x] Eleven helper Python sources parsed successfully; the additional final-document transfer helper is parsed before use.
- [x] Actual Linux acquisition/source-read helpers ran with the pinned amd64 image; separate preserved attempts and successful completion have resource/source/runtime receipts.
- [x] All six streams and seven locked package inputs passed content checks. Both large cohort catalogs are complete by required content.
- [x] Existing positive owned FD pins were required equal; fresh current aids received new owned pins.
- [x] Product builds, candidate/recorder/consumer tests, original122/native/private/paid effects were not run in this bounded scope.

## Notes for Reviewer

Use the final Linux manifest and read-only mount of `cortex-runtime-c8-r2-acquisition-20261005-01`, with`volume-nocopy`, to read all sealed source evidence. Host QA copies are content copies only; they do not preserve Linux physical identities. Review the acquisition contract, six full-stream proofs, selected pins, both failures, package inventory/comparison, exact demand, source version disposition, conservation and complete `/repair/attempt2/report/historical70020-coverage.json`. No raw reviewer coverage artifact from the previous review is claimed to exist.

Fresh independent review is required before larger physical preparation. Subsequent source preparation may materialize the proven FULL8/HIST cohorts in a new owned namespace, generate fresh lost operational inputs and actual toolchain/source pins, and calculate raw/ledger/receipt demand. Candidate/recorder/consumer/original122/eightnative20/whole120/ROOT/private/paid/deployment effects remain held until their original review/approval gates apply. No Task04 acceptance is claimed.
