# K15 collectors prepared — UNREADY, no service calls

The new collectors are preparation only. `k15-collector-pins.mjs` pins committed source `2c8689fac3aca2acf1fb1f46d8b10a87388e95cd` and kit `/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/manual-sandbox-latency-turn-consolidation-2026-10-13`; session/name/ID/expiry/image/manifest/SDK/run IDs remain deliberately UNREADY. Every native collector refuses before loading a session or making a network call until root supplies the exact READY pins. Two offline refusal checks passed. All seven prepared modules pass Node24.15 `--check`. Service, mutation and inference calls during preparation: **0**.

Original K14 memory, finance, cleanup, run-chain and log helpers and original K11 auth-close helper are preserved; before/after hashes, prepared hashes and syntax receipts are in `k15-controls-prepared.json`. No core/Proofs/package/source edits or Git writes were made.

## Finite capture sequence

1. Root submits browser READY35 then WARM35. After both COMPLETE and explicit per-phase GO, run **one** service-log snapshot with `CORTEX_K15_CAPTURE_GO=browser-post-pair`, arguments `SESSION browser-post-pair`. Retain this receipt before CLI. This is a metadata log snapshot, not a partial memory scan.
2. Root signs out/closes the browser, submits canonical CLI35 then CLW35 under the original 30,000ms deadlines. After both COMPLETE and explicit GO, run **one** snapshot with `CORTEX_K15_CAPTURE_GO=cli-post-pair`, arguments `SESSION cli-post-pair`.
3. After all-four COMPLETE/GO and four exact distinct run IDs are supplied, run **one** strict all-four native proof, **one** finance snapshot and bounded joined chains for the four supplied runs. No first-only or pair-only memory scans. All native clients close before root cleanup.
4. Only after root cleanup/CLEANED and explicit GO, run the fresh exact ABSENT collector. It does not clean or recreate resources.

The original native log execution cap remains 1,000, log bytes are bounded at 16,777,216, and every metadata table requires one complete 256-item page with the original 30,000ms timeout. The pre-CLI browser snapshot prevents later CLI volume from being the only retained browser evidence; capped/missing records remain unavailable rather than zero. Snapshot projection retains request/execution/component identity, engine/user execution, OCC/cache and safe phase scalars. New observed counts recognize `turnStepV5`, `prepareTurnModel`, `prepareResolvedModelOperation` and `admitPreparedModelOperation`. Joined Workflow metadata hashes official `workflowHandle`/step `handle`, projects ordinary `context and model turn N` Actions, and does not require obsolete separate context/model/finalize journal steps. Observations do not imply every conditional native parent must execute or supply additive SLO timing.

## Inputs and commands after explicit authorization

Use `/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node` from the core checkout; memory uses the installed root `--import tsx` loader. All helper paths are under this QA directory.

| Helper | Arguments / interlock |
| --- | --- |
| `service-log-snapshot-k15.mjs` | `SESSION browser-post-pair` or `SESSION cli-post-pair`; `CORTEX_K15_CAPTURE_GO` equals that exact phase |
| `verify-k15-four-run-memory-readonly.mjs` | `SESSION NAME ID BROWSER_FIRST BROWSER_WARM CLI_FIRST CLI_WARM`; `CORTEX_K15_MEMORY_TURN_COMPLETE_CONFIRMED=1` only after all-four GO |
| `capture-k15-financial-metadata.mjs` | `SESSION CLI_WARM NAME ID`; one snapshot after all four |
| `capture-k15-run-chain.mjs` | `SESSION EXACT_RUN_ID NAME ID`; only one of the four pinned supplied IDs |
| `verify-k15-cleanup.mjs` | No arguments; exact pinned session must be CLEANED and root must authorize the fresh ABSENT check |

The strict memory proof retains original complete chat/embedding usage rules, exact production JSON extraction framing/parser, current source hash/owner/lineage, grants/epochs/tombstones, selected profile/index/native-vector correspondence, processing receipts, no retries, distinct canonical event identity and contiguous watermarks through 2/4/6/8. Source pin comes from current host-prepared metadata, not a copied historical field. All-four native proof is a bounded per-table read, not a claim of one cross-table transaction. Finance and chains additionally perform full exact READY/source/image checks before and after each bounded read; management requests are GET only. Private prompts/results/fact strings/vectors/credentials stay in memory; retained reports contain bounded hashes/scalars. Reservation ceilings/UNKNOWN are not actual charges.

Optional `k15-auth-close-diagnostic-readonly.mjs` is retargeted to the new kit but not authorized to run. It requires exact READY session/name/ID/expiry/source/manifest/SDK archive/image paired arguments and `CORTEX_K15_AUTH_DIAGNOSTIC_GO=1`, plus optional `--owner-control 0|1`. Original official Convex client/custom logger/public-close projection, exact read-only session/profile registrations, before/after grant/data/finance hashes, original **4,000ms** deadline and **UNAUTHENTICATED** expectations remain. Historical K9 and later auth failures remain failures; timeout is never relabeled as authentication rejection. Its preparation makes no new auth/SLO claim.

Root must supply the fresh READY session/name/ID/expiry/image/manifest/SDK archive pins, then browser pair GO and IDs, CLI pair GO and IDs, all-four GO, and finally cleanup GO. Prepared controls are ready for those inputs; no runtime PASS or V5 speed claim is made.
