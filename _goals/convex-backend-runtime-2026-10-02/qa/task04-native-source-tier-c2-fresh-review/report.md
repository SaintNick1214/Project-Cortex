# Task Judgment: Task04 native source-tier C2 fresh independent design

## Verdict: PASS — DESIGN ONLY, CONDITIONAL

The corrected one-compiler-row proposal passes this bounded design review. It does not authorize reclassification, accept mutable C4, release SOURCE/PARENT/ROOT pins, or complete Task04. Adoption remains conditional on independently accepted exact NEW C4 sources, a distinct classification successor with reconciled contracts and fresh SOURCE/PARENT/ROOT acceptance, unchanged original actual controls, and native timing qualification.

Subject report SHA256: `c3fafbee8af6b97659c761ae2442041508111765da42c6cd5392989bb67c2c40`. Exact subject QA closure: manifest `da6c8ee6eaed45c6664ca60297f3cdb776ebaa4c9e3489f3bd1c011656775bbd`,61 rows/62 files including itself. Exact subject scratch closure: manifest `8f8308692593a0a920c1d2701a3c5d89d2d81faab18252757a38e313af140a11`,1 row/2 files including itself. Six recursive reference closures were independently verified before and after, including the frozen C1 proposal and its separate NEEDS FIXES DESIGN3.8 review; their hashes/counts are in `audit-receipt.json`. Prior review report `41b8739c2a9df2841736be4cab61a7c72bca016d4d79080a90eb1b0e0941986e` remains unchanged, never relabeled PASS.

## Requirements review

| Bounded design requirement | Met? | Independent evidence |
|---|---|---|
| Correct profile-specific exact tuple counts | Yes | `derived-profiles.json`, independent decompression of actual original inventories: extra100+18→99+19=118; extension98+18→97+19=116; regression97+16→96+17=113. Tools remain a separate4+14=18 partition in each profile. |
| Only compiler membership moves; full tuples retained | Yes | `audit.py` derives the move and compares complete sorted tuples with unique paths. Compiler is exactly `node_modules/typescript/lib/typescript.js`,9,144,216 bytes, SHA256 `569177652966bd528c319171c7dd22860dbf72bde116cbc4f644f1d02bb12e39`. Every other membership is unchanged. Independent loss/duplicate/hash/length/path adversaries are denied. |
| Preserve full/dispatch/runtime graph distinction | Yes, bounded static evidence | Independent edge traversal gives FULL118/116/113, runtime100/98/97, dispatch87/85/84. FULL graph equals original runner paths. Compiler is outside every dispatch closure and inside runtime/deployment union; CLI prerequisites and offline inventory remain compiler importers. Each declared dispatch entry and peer consumer were individually challenged with compiler, transitive CLI and unresolved imports; narrowed proof is denied. |
| First trust, unknown/default, current/legacy parent remain FULL | Yes as design obligation | Historical `guard.mjs:25,38–41` checks exact runner/tool partitions on each preflight, narrows only trusted explicit rpc, and latches expected pin/review/freeze after final revalidation. First explicit rpc defaults FULL. `parent-inputs.mjs:29` calls `livePreflight(phase)` without rpc tier; direct legacy entry imports/reexports and calls the same main. Unknown/default/non-rpc cannot obtain the reduced set. |
| Actual SDK callback and peer fences remain fresh | Yes as design obligation | `driver.mjs:22–24`: freshDispatch is invoked within the SDK's supplied HTTP callback immediately before actual fetch, after awaited tickets and queue entry. It checks original target, environment, publication, expected review pin and qualifier-window binding. `peer.mjs:5–7` repeats freshPeer after awaited ticket before fetch. Pre-enqueue checks alone cannot substitute. |
| Compiler/process/dynamic/management/publication/final FULL | Yes as design obligation | `process-owner.mjs:38–40` FULL precedes spawn with child-pin propagation; `cli-prerequisites.mjs:7` FULL precedes installed-source/compiler use and spawnSync; `management-transport.mjs:8,15` repeats FULL including final pre-fetch guard; `publication.mjs:6` uses default FULL with target/private/generated/stage/pin checks inside actual callback; `driver.mjs:41` final reviewed and preservation checks remain. Exact retained site maps contain25/27/25 dynamic/require/process sites; arbitrary external dynamic strings are not resolved by this evidence. |
| Awaited-build/import gap remains an adoption blocker | Yes | Old historical CLI gap is preserved. `context-audit-receipt.json` independently verifies C2-retained newer CLI differs only by immediate `reviewed();` after awaited build and before computed import, with extra `cd8cda37184d2d156fd83066aef1099d35df81b1dedb4fc12f457a592299a3c1`, extension `0b3e08264645f7c4dbd7bc063f2794e187133bc1b523f619c479c6b00b320004`, regression `7f44508af85a5b0c93663c7b0af8a1eaffc6362ebc75844b5841cb33e1613537`. This is static placement, not actual acceptance. |
| Explicit reconcile of literal complete-each-RPC contract | Yes, deferred distinct successor | Current `runtime-inputs.rootLoaderClosure` promises every-script complete graph each native RPC. C2 explicitly forbids silent contradiction: a new classification successor must reconcile the promise, pin both complete FULL and dispatch proof/metadata/freeze/whole QA closure, and retain full legacy/source/private coverage. Current C4 tiers stay unchanged. |
| Immutable lineage and complete original source corpus | Yes | All1,112 unique original source-before paths and gzip preimages independently validate to original lengths/hashes. C1 QA562/563 and scratch1/2, C1 fresh review QA93/94 and scratch11/12 are exact recursive closures including manifest-self distinction. C2 references complete closures rather than pretending its selected preimages are the complete corpus. |
| Original assertions/caps/private/source and timing gates retained | Yes, pending actual execution | C2 explicitly preserves all original contracts, required real controls, unchanged windows, private/target bindings and release gates; no timing or actual service PASS follows from static models. Numeric cycle waiver changes only cycle counts. |

## Evidence review

Read AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge and judge-task, authoritative decision-gates, architecture, goal, Task04, both proposal reports and prior judgment, subject model sources/receipts and exact retained scripts/inventories/graphs. Independent own Python audit passed221 assertions (including provenance, tuples, graph adversaries and lexical source placement), zero skips. These are static checks, not221 actual runtime controls. Subject39 original and33 fresh controls were read and their frozen results verified; they were not rerun as actual implementation tests here. No frozen source module, compiler, helper, esbuild or native driver was executed.

Own audit inputs have genuine before/post lengths/hashes and compressed before bytes; subprocess argv/cwd/UTC/exit are recorded with raw stdout/stderr. Reference closure rows were individually hash-checked; complete original1,112 gzip preimages were validated through immutable corpus references. Recorded snapshots are exact consumed inputs, never repins of mutable C4. Newer CLI context came only from sealed C2-retained bytes. No current mutable C4 source was accepted or freshly certified by this review. C2's recorded12 historical changed paths and zero changes during its window are independently verified metadata facts, not a promise of subsequent stability. Known C4 cleanup-custody repair and all SOURCE/PARENT/ROOT acceptance remain pending.

## Issues found

### Critical

No new blocking defect in this explicitly conditional corrected design. Original await-build/import drift failures and pending source/native gates remain adoption blockers; neither is resolved by this verdict.

### Important — mandatory adoption gates

1. Independently accept exact final NEW C4 boundary and custody-repair sources. Reexecute all original unchanged actual assertions, including12 boundary controls reported by the executor, prior expected-zero computed-import drift witnesses and healthy one-import control. Executor-reported PASS is not independent source acceptance. Do not repin changing C4 or adopt classifications there.
2. Produce a distinct new classification candidate that explicitly reconciles `rootLoaderClosure`, pins complete and dispatch closures/metadata/freeze/whole recursive QA, preserves every other tuple and full current/legacy parent entry, and obtains fresh SOURCE/PARENT plus ROOT acceptance. New or unresolved dependency consumption invalidates reduced proof, requires FULL, and requires renewed graph review; FULL fallback alone does not establish a newly changed graph safe for release.
3. Retain and execute original first-trust/coherent review-freeze substitution; queued actual SDK and peer operational/product/browser/target/environment/publication/pin/window drift; compiler/process/dynamic management/publication/final; exact partition; private canonical/symlink/link/ownership; creation/custody/ticket/no-refund; errors/body/journal/cleanup/reaping/physical-retirement witnesses. No pre-enqueue denial replaces actual callback denial and no weaker cache/stat-only check replaces fresh bytes.
4. Establish source-derived critical-path schedule and authorized actual native timing qualification.9,144,216 bytes per reduced preflight and18,288,432 bytes per healthy enqueue+callback RPC are byte accounting. They do not prove latency, memory or20-minute feasibility. Fixed waits, synchronous canonical/hash work, sequential awaits, SDK queue serialization, concurrency and cleanup can add or overlap on the same path; waits and RPCs are not mutually exclusive.

### Minor

Static edge metadata and lexical site inventories do not resolve arbitrary computed imports within all external dependencies. This limitation is explicitly acknowledged and must remain acknowledged in successor reviews; no fresh independent esbuild reconstruction is claimed.

## Dimension scores

Scores concern corrected DESIGN scope only; implementation/runtime completeness is unaccepted.

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |5/5| All bounded correction requirements independently verified, exact regression count fixed, distinct-successor and source/runtime conditions explicit. |
| Code Quality |4/5| Minimal unchanged tuple operation with immutable latches and fresh consumption boundaries; lexical/model evidence has disclosed limits. |
| Test Quality |4/5| Independent graph and tuple adversaries,221 observed static checks, retained genuine reviewer failure; required actual controls remain mandatory. |
| Pattern Adherence |4/5| Read-only design review, scope/caps/hard rules preserved, complete immutable provenance, no source/private/native release. |
| Completeness |4/5| Corrected design packet is complete; subsequent implementation and runtime work explicitly gated. |

**Average:4.2/5.** All dimensions≥4 and requirement fulfillment5 meet the bounded design PASS rubric. Applying these scores to Task04 implementation would be unsupported.

## Original fences retained

3,000logical RPC;2,963native plus nested37;cleanup40;concurrency4;qualifier1,200,000ms;driver1,440,000ms;RPC12,000ms;CLI120,000ms;64scenarios;320rows;storage0;peer8/24;8MiB evidence;6processes/2groups. Original43+22+26;parent106+16;watcher17/body18;287validator equalities;public1400/state200/internal174/maintenance20/peer5;original source/private/security/creation/custody/consumed-ticket/no-refund/fault/body/journal/error/cleanup/reaping/retirement controls all remain. No budget/window expansion, memoization across preflights, quota refund, compiler final-check omission, skipped required service coverage or paid/private/native acceptance follows.

## Provenance and reviewer failures

Bootstrap read-only discovery and tool displays precede formal audit capture and have tool-log evidence only, without retrospective UTC or exact before-byte claims. Initial `.agents` lookup outside the repository and shorthand `goalqa` lookup failed; corrected repository paths were used. Some large displays were truncated; full source files were independently consumed by the captured audit.

First own recorded model failed exit1 after26 assertions because runtime entries are basename strings while dispatch entries are qualified paths. Exact failed script, UTC/input receipt and raw streams remain in `first-failed-model/`. Only the reviewer routing was corrected to prefix the known base/scripts path; all original denial assertions remain, corrected audit exits0. A subsequent tool-only retained-context probe failed exit1 because the reviewer searched for `livePreflight()` while parent actually uses `livePreflight(phase)`; no completed receipt was produced and no retrospective one is invented. Corrected saved `context.py` asserts actual default-tier call and exact three retained CLI insertions, exits0 with raw streams and genuine UTC/hashes. These are reviewer model mistakes, not subject regressions.

Writes are only this NEW QA and its own NEW scratch tree. No old QA, source, current C4, progress, private/environment/keys, Git, dependencies, network, native, paid or subagents were changed or invoked. Skill application used local `.agents/skills/judge-task/SKILL.md` and pessimistic role solely as review criteria.

## Recommendation

Accept this corrected C2 proposal as CONDITIONAL DESIGN ONLY. Preserve the frozen prior NEEDS FIXES result. Advance only through exact NEW C4 independent acceptance and a distinct reconciled classification SOURCE/PARENT/ROOT candidate with unchanged actual controls and timing qualification. Do not adopt tiers, issue actual pins or claim Task04/full03/goal completion from this verdict. Final own QA/scratch seals and exact self-excluding rows/files-including-self are recorded by `seal-receipt.json` and returned separately; no self-referential manifest hash is embedded here.
