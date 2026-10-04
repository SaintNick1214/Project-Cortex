# Task04 native source-tier design C2

## Status: CORRECTED DESIGN PROPOSAL — FRESH DESIGN JUDGMENT REQUIRED

C2 corrects C1's regression runner partition error. Exact retained source tuples yield extra **99+19=118**, extension **97+19=116**, and regression **96+17=113** after the proposed one-row move. C1's claim96+19=113 was wrong and its independent NEEDS FIXES DESIGN ONLY3.8 verdict remains preserved. No classification is adopted; existing C4 tier scope and compiler membership are unchanged by this investigation. No implementation, SOURCE, PARENT, ROOT, actual timing, native, private, paid, Task04, or goal release follows.

## Exact correction and independent derivation

| Profile | Original RPC runner | Original boundary runner | Complete runner tuples | Proposed RPC runner | Proposed boundary runner |
|---|---:|---:|---:|---:|---:|
| extra | 100 | 18 | 118 | 99 | 19 |
| extension | 98 | 18 | 116 | 97 | 19 |
| regression | 97 | 16 | 113 | 96 | 17 |

The tool partition is a separate inventory: all profiles retain **4 RPC +14 boundary =18 tools**, unchanged. Regression's16 original boundary runner rows must not be confused with14 boundary tool rows or18 total tools.

`repair.py` independently decompresses actual retained `dependency-tiers.json` and `runner-dependency-inventory.json` source bytes for each profile. It removes exactly the original compiler tuple from RPC runner and appends the same tuple to boundary runner, then asserts the proposed sorted union equals every original full tuple with no duplicate path. Profile counts are derived from these arrays, not copied from C1 prose. `profile-partitions.json` records original/proposed counts and exact tuple identity.

The single proposed compiler tuple remains `node_modules/typescript/lib/typescript.js`,9,144,216bytes, SHA-256 `569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39`. Every other runner tuple and every tool tuple retains its existing membership. No cap, assertion, source/hash/length, full/legacy-parent entry, or dependency is removed.

## Preserved immutable evidence

`immutable-reference-map.json` binds complete verified before/post closures rather than copying the entire corpus:

- C1 design QA: manifest `353a1fe4a7402880d299f8ca1c65bd03a732514bb6c6283c4246901b64e06ebe`,562rows/563files; scratch `de2bce1a3920e4e26ac248e29968bea65f0a3aa70f94dadab16802bde3848229`,1row/2files. C1 report `e49d3a54c08135e0991666852707d60261202665b109ceb9cff8092f99380894` and its first-investigation/first-adversary failures remain unchanged.
- Fresh C1 DESIGN review: report `41b8739c2a9df2841736be4cab61a7c72bca016d4d79080a90eb1b0e0941986e`, NEEDS FIXES3.8; QA manifest `9a5143e287e70a5db693d896a2bcc487dee2a3d931563c6e4ffea247e32ba71f`,93rows/94files; scratch manifest `03fa4dd6b1d46a44e5874b6af84191413b4024565987cdd5358b864289aab2c0`,11rows/12files. These row counts explain the shorthand93QA/11scratch; manifests themselves add one file each. The genuine first reviewer model failure and corrected33 results remain unchanged.
- Original1,112 source-before pins: `source-before.json` SHA-256 `ac932b4a18255591e5d8b36ddec3699a80d47f7b02dda4a1321f8c8687ff0f39`. C2 independently decompresses and validates all1,112 referenced original preimages. They remain references to the sealed C1 corpus, never repinned to mutable C4.

C2 includes only needed actual historical preimages, three exact graph artifacts, source-derived model sources/results and current drift context. The compiler's complete original bytes are retained in the exact C1 closure; C2 does not duplicate its9MB body merely to restate its unchanged tuple.

## New observed model verification

Both source-derived models were read before running. Only input/output routing was adapted to C2-owned retained bytes. No subject JavaScript, compiler, CLI or native module was executed.

- Original39 graph/placement controls passed with no failures or skips. Direct driver/compiler and transitive peer/CLI imports invalidate exclusion; unresolved/new imports invalidate narrow proof; exact full tuple loss, duplicate and hash alteration are denied. Original first-call/unknown FULL selection, immutable latches, callback/peer and process/compiler placements remain asserted. The old awaited-build/import gap remains detected in the historical source.
- The fresh reviewer's corrected33 model controls passed again. They independently assert profile-specific99/19,97/19,96/17 membership; exact all-tuple equality and unchanged loss/duplicate/hash denials; first-call FULL and immutable latches; old gap preserved; currently observed immediate FULL after build/before computed import is exactly the intended insertion; compiler spawn remains immediately FULL. These are static assertions, not actual effect-boundary acceptance.

`repair-receipt.json` records genuine UTC, argv, cwd, raw stream paths, exits and exact before/post reference closures. All required new commands exited0. Their necessary historical bytes and newly observed CLI bytes are in C2 preimages before execution; current-source before/post hashes cover all1,112 paths. No expected-denial assertion was relaxed to repair counts.

## Unchanged safety contract and adoption blockers

Complete all-script graphs remain extra118/extension116/regression113; declared runtime-entry unions100/98/97 and dispatch-entry closures87/85/84 remain historical source-derived graph results. Deployment reaches compiler through `deploy → cli-prerequisites`; offline `inventory` is the second FULL importer. Compiler is absent from all declared dispatch closures, but it is actually used by deployment/compiler analysis. These graphs were traversed from retained source metadata; no new esbuild execution or arbitrary dynamic-string resolution is claimed.

Initial verification and first explicit RPC before trusted latches remain FULL. Every unknown/default caller, current and direct legacy-parent entry, dynamic load, process/CLI/compiler/deploy, publication/management and final verification remains FULL. Exact partition equality is freshly checked eachRPC. Operational/capsule/product/accepted/external-parent/compiled/Gateway/browser/guard sources stay fresh at actual SDK and peer dispatch. Target/private environment/publication/generated bindings, immutable expected review pin/review/freeze, original window/deadlines, canonical/symlink/link checks, complete source and preservation inventories remain mandatory. Pre-enqueue freshness does not replace queued actual callback freshness. No cross-preflight unchecked cache or stat-only approval is introduced.

Current `runtime-inputs.rootLoaderClosure` literally promises complete every-script graph each native RPC. A row move cannot silently contradict that promise. A distinct successor must explicitly reconcile its classification contract, preserve complete FULL/legacy/source/private graph and all original fences, pin new dispatch proof/metadata/freeze/whole QA closure, and receive independent SOURCE/PARENT plus ROOT acceptance. New/unresolved imports deny classification and require FULL plus renewed graph review. Fresh independent DESIGN judgment of this C2 proposal is required first.

The immediate FULL after awaited build and before computed import has been observed as exact new source text only. Its prior expected-zero drift failures and healthy control remain original mandatory witnesses; exact new C4 source acceptance remains required. Mutable C4 is also completing a separate known-creation cleanup custody repair. This design neither adopts nor certifies that repair or any changing C4 source. Later SOURCE/PARENT/ROOT judgment must use its exact final bytes and unchanged original controls.

All original limits and outcomes remain:3,000logical RPC;2,963native plus nested37;cleanup40;concurrency4;qualifier1,200,000ms;driver1,440,000ms;RPC12,000ms;CLI120,000ms;64scenarios;320rows;storage0;peer8/24;8MiB evidence;6processes/2groups. Original43+22+26, parent106+16, watcher17/body18,287validators, public1400/state200/internal174/maintenance20/peer5, source/private/security/creation/custody/ticket/no-refund/fault/body/journal/error/cleanup/reaping/retirement assertions are neither waived nor claimed executed. Numeric cycle waiver changes count only.

## Timing and drift limits

The proposed one-row move saves9,144,216 source bytes per eligible reduced preflight,18,288,432 for a healthy logical RPC with enqueue and actual callback preflights. C1's extra current public-source set23,267,689B/preflight becomes14,123,473B in the proposed design; original FULL remains35,646,211B. This is historical byte accounting, not native latency, memory or20-minute feasibility acceptance. Fixed waits, sequential awaits, SDK queue serialization, synchronous hash/canonical work, concurrency and cleanup may overlap or add on the same critical path. They are not mutually exclusive. Require a source-derived schedule and authorized actual timing qualification under unchanged windows before release.

At the new commands' observed before/post window,12 current source paths differ from the sealed historical snapshot; zero paths changed during these commands. `current-source-after.json` retains each historical hash/preimage reference and exact newly observed bytes/hash as separate context. The old1,112 source pins and all four frozen reference closures stayed unchanged. Subsequent mutable C4 changes remain possible and require final exact source judgment; this packet does not claim current C4 acceptance or stability after its recorded UTC window.

Bootstrap read-only discovery preceded capture of genuine per-operation UTC/preimages, so it is context only. A discovery probe requested nonexistent fresh-review `summary.json`; its raw tool error was visible, but no retrospective UTC is invented. `bootstrap-limits.json` discloses this. Required substantive commands and all model outcomes have genuine captures; no new substantive command failure occurred. Existing failed C1 executions and first failed independent model remain sealed references, not relabeled successes.

## Recommendation

Rejudge this corrected sealed C2 proposal with a fresh independent DESIGN judge. Preserve the prior NEEDS FIXES result and all historical source pins. Even a bounded design PASS remains conditional on independently accepted exact NEW C4 source, a distinct classification successor with fresh SOURCE/PARENT/ROOT gates, original actual assertions and timing qualification. Keep current C4 tiers unchanged and do not issue implementation release from this correction.
