# Task Completion Report

## Status: COMPLETE for bounded source repair; independent approval HELD

The new prospective coordinator is `task03-attempt5-private-coordinate.py` in this namespace. The parent draft and current candidate note are preserved byte for byte under `preimages/`; they remain unchanged at their original paths. No production approval was created. Actual public custody, actual private transfer, cryptographic/native acceptance, and full Task03 acceptance remain unperformed or held.

## Changes Made

- Source approval moves to this namespace's `independent-private-coordinator-source-review.json`, retains scope `TASK03_FIXED_RECIPE_COORDINATOR_SOURCE_ONLY`, and binds the new coordinator digest plus an exact set of 12 dependencies. Public common, source manifest, and recipe point to `Q5/coordinate-source/repair2`. No frozen Q5 preparation member changed.
- Public approval, complete dependency hashes, current preparation freeze, management/private-helper/selector pins, all three enabling review scopes, exact repair2 namespace/literal mounts/counts, and current transport binding are checked before any private scratch metadata, helper import, process, private bytes, or API attempt. The actual custody gate additionally binds operation, volume, all 1912 public files, repair2 manifest and binding hashes, and all-nine/full-content outcomes. A source-only verdict cannot satisfy this gate.
- A fresh resource check rejects any running container. The owned volume must have the exact name, operation and goal labels, local driver/scope, and no driver options. The receiver's immutable image, exact owned name/label, user, read-only root, network none, matched 512 MiB memory/swap, 2 CPUs, 64 PIDs, and exact volume-only mount/subpath recipe are checked before provision.
- The wrapper always requests a retained common-supervisor row and rejects terminal UNKNOWN, close errors or a failure class, including optional exit-code commands. Initial command failures remain in records. Zero exit code cannot certify terminal success. All cleanup operations check the owned name, operation and image before a kill/removal; exact terminality and an exact absent-object response are required after removal.
- Producer/descriptor/signal/reporting failures are retained individually. Each of the four owned names gets a separate final cleanup attempt. After any provision attempt, physical retirement is attempted through the unchanged reviewed management helper, even for an uncertain provision response. The helper still rejects absent or mismatched exclusive ownership before any retirement API; no numeric project guess or blind delete was added. A valid deletion-200/verification-404 retirement receipt is required before `retired=True`.
- Linux selector retirement now uses a named, labeled create/inspect/start/terminal/remove recipe, with the same isolation constraints and a 65536-byte finite input guard. It checks the helper result and terminal state and performs owned cleanup in `finally`. It runs only after verified physical retirement and an attempted receiver transfer. The selector helper itself is unchanged (`6ed06bdf...8550a`), including full EOF, all-nine identity checks, single-link ownership, private modes, exact preimage hash, two exclusive files, atomic replacement and durable fsync checks.
- The immutable private custody helper remains `ecb1eff9...c23e`. Shared repaired common remains `1f8f6005...fa0a2`. Pipe bounds 262144, common input bound 327692, stdin deadline 12 seconds and command maximum 190 seconds remain in the unchanged common. The coordinator's provision/retire bounds remain 190 seconds, receiver and selector command bounds remain 60 seconds, inspect/create/cleanup bounds remain 30 seconds, and finite completion wait remains 2400 seconds. No official CLI or native driver is dispatched. Original CLI120, typecheck/codegen, 21/20-minute native/driver limits, original assertion names/counts/deadlines and the foundation qualification gates were not edited.

`source-delta.diff` identifies every coordinator source change against the exact preserved parent draft. `dependency-pins.json` lists current public hashes and the absent actual-custody dependency. `preimages.json` binds the original parent source, selector and candidate note. Run1 source preimages and its 80 passing controls are preserved alongside the final source and expanded run2 controls.

## Requirements Checklist

- [x] Work confined to a new public QA namespace; original sources and receipts preserved.
- [x] Actual new private `main()` and `preflight()` run in explicit effect-blocked controls; production approval is never bypassed in source.
- [x] Approval/source/recipe/resource failures prove no modeled provision API or secret read.
- [x] Provision failures, ambiguous provision, transport failure, terminal UNKNOWN, and missing ownership exercise retirement attempts with sticky FAIL outcomes.
- [x] Close, signal, durable-report and cleanup failures do not suppress retirement or other owned cleanup attempts.
- [x] Known owned running containers are killed/terminally inspected/removed, with absence observed; foreign operation/image is refused and is never signaled or removed.
- [x] Selector present and absent paths plus negative filesystem/parser controls invoke the unchanged actual helper against new public dummy fixtures.
- [x] Fresh independent first-use review is prepared; no self-acceptance or actual dispatch occurred.

## Files Modified

| File | Action | Notes |
|---|---|---|
| `task03-attempt5-private-coordinate.py` | Created | New active candidate; source approval still required |
| `task03-attempt5-retire-selector.py` | Created | Exact unchanged selector copy |
| `mocked-coordinator-controls.py` | Created | 86 final actual-flow cases; every external effect fake |
| `selector-filesystem-controls.py` | Created | 24 actual host filesystem and four parser controls |
| `preimages/`, `raw/`, `fixtures/` | Created | Exact original source bytes, both runs, explicit public dummy effects and per-case assertions |
| `dependency-pins.json`, `quality-check.json`, inventories and freeze | Created | Reviewable current sources and receipts |

## Verification

- [x] Syntax AST/compile checks PASS for all four affected QA Python files, without bytecode generation or helper execution.
- [x] `python3 -B .../mocked-coordinator-controls.py run2`: PASS, 86 controls; stdout/stderr and per-case events/commands/rows retained. Run1 PASS80 is historical to its preserved source preimage.
- [x] `python3 -B .../selector-filesystem-controls.py`: PASS, 24 actual host filesystem controls and four actual parser guards; full public fixture states and syscall read/write traces retained. Positive multi-read control observes the original and replacement EOFs.
- [x] Original parent source, selector and current candidate note match their exact preimages. Selector source bytes remain unchanged.
- [x] Current public repair2 manifest pin matches `73cde47e71c30a1fa63f8d9d04ee10c8950ef15d964ddd1a8f7dbfe01751b304` (11381 bytes, 23 regular members).
- [x] Actual Docker calls, Convex API calls, private/config directory reads, provisioned projects, official CLI dispatches and product/native effects: zero.
- [x] Affected QA primitive checks selected under code-quality; core npm build/lint/tests are outside this source-only QA repair and were not executed. No archived Python SDK was touched.

## Notes for Reviewer

The new coordinator is in this namespace; executing the old parent path still executes the old unreviewed draft. The production source gate expects a fresh independent attestation at the new path. Current preparation and management operational wrappers exist at their original exact paths and link source-only independent review; this does not certify runtime effects. The actual public custody wrapper remains absent, so first use is blocked even after source approval until actual transport and separate fresh custody judgment.

The future actual public custody scope is `TASK03_ACTUAL_PUBLIC_LINUX_CUSTODY_ONLY` at `P/task03-attempt5-linux-public-custody-review.json`. Required fields are `candidateSha256`, `operation`, `volume`, `publicFiles=1912`, `publicSourceManifestSha256`, `publicRecipeBindingSha256`, `allCurrentDestinationIdentities=PASS_ALL9`, and `currentSourceDestinationFullContent=PASS`, in addition to `verdict=PASS`, `independent=true` and exact scope. There is no existing current actual custody schema to claim as observed; these are explicit prospective source requirements for the parent/reviewer to inspect and satisfy from actual evidence.

The mocked source/hash/approval records are synthetic test objects in public fixture roots. No synthetic approval is written at an operational path. Controls run the actual candidate control flow but do not prove Docker metadata compatibility, physical API retirement, private helper native semantics or current private cryptography. The actual selector controls establish host primitive behavior only, not Linux/native qualification. Any unknown ownership/terminal condition remains sticky FAIL, including a provision result with no ownership receipt: retirement is attempted but the unchanged helper must refuse an unowned deletion. Exact cleanup may leave a modeled unknown/foreign container untouched; no false resource-absence claim is made for those cases.

Full ancestry remains at the referenced Q5 preparation freeze/manifest and the parent source candidate/preimages. Historical Q4 acquisition-version failure, exited-parent group failure, Q5 initial setup/readonly diagnostic failures, and all earlier Task03 failure/UNKNOWN judgments remain unchanged. This bundle supplies source and controls for a separate owner’s independent judgment; it is not Task03 acceptance, an enabling attestation, or a release.
