# Task Completion Report

## Status: COMPLETE (bounded executor; independent judgment pending)

Changed only the first-null branches inside `updatePartialMemory` and `finalizePartialMemory`, replacing their bare `ConvexError("MEMORY_NOT_FOUND")` with the existing `dataDenied()`. Both unmatched writes now emit the exact RuntimeErrorV1 denial `{version:1, code:"FORBIDDEN", message:"Access denied", retryable:false, outcome:"not_dispatched"}`. Absent IDs, foreign tenants and foreign owners remain indistinguishable. Current authority resolution, scoped index/filter, embedding guard, source revisions, writes, final checks and success response are unchanged.

## Changes Made

- `convex-dev/memories.ts:221/257`: only two statement replacements, retaining original surrounding bytes and braces.
- `tests/unit/runtimeEndpointAuth/partialMemoryDenials.test.ts`: eight actual native-handler regression tests through the unchanged transaction/index/filter-aware shared fixture. Six denial cases cover both mutations under foreign tenant, same-tenant foreign owner and absent ID. Each requires exact denial data, empty scoped memory selection, no source hydration, no foreign-row hydration, zero attempted writes and deep-equal persisted tables. Two owner controls assert success, content/version/source revision, persisted canonical source content/hash/revision, actor, metadata, attempted source/memory patches and operation-specific partial flags/tags.

## Requirements Checklist

- [x] Scope limited to two first-null branches (`source.diff`; `source-integrity.json` byte offsets 8435/9593 and exact replacement equality).
- [x] Exact authorized-denial contract for all six cases (new suite).
- [x] No unauthorized hydration or attempted/persisted effect (new suite reads/write log/snapshot assertions).
- [x] Healthy owner update/finalization controls (new suite).
- [x] Preserve original tests/helper/classifier/schema/generated code (all original runtime endpoint files compared equal to Git HEAD; original memory test also compared to pre-execution snapshot).
- [x] Historical defect witness remains unchanged in `../task03-partial-memory-denial-contract-review/`; original assessment retained as historical proof.
- [x] Capture exact original source and localized diff (`memories.preimage.ts.text`, `memories.postimage.ts.text`, `source.diff`, `source-integrity.json`).
- [x] Affected original tests, new tests, typechecks and scoped lint executed successfully (`commands.json`, logs).
- [x] SDK retry semantic documented below.
- [x] C8 provisional421 and its manifests/hashes were not written; no C9 fixture was created by this executor. C9 production remains dependent on a fresh independent FINAL PASS.

## Files Modified

| File | Action | Notes |
|------|--------|-------|
| `convex-dev/memories.ts` | Modified | Two denial statements only |
| `tests/unit/runtimeEndpointAuth/partialMemoryDenials.test.ts` | Created | Eight outcome tests |
| `work/resume/partial-memory-denial-repair/` | Created | Preimages, offline Jest config and command scratch |
| `qa/task03-partial-memory-denial-repair/` under this goal | Created | Report, snapshots, hashes, diff and execution receipts |

## Verification

- [x] Before repair: new suite observed 6 failures (old string envelope) and 2 passing owner controls; exit 1 (`red.stderr`). This establishes a meaningful defect-sensitive regression.
- [x] After repair: six suites / 408 tests PASS, no skipped tests reported; exit 0 (`tests.stderr`). Includes unchanged original memory (117 tests), facts, retained witnesses, optional read failures and original progressiveStorage suites, plus the eight new regressions. Scratch config omits service/env setup and retains ts-jest diagnostics; no services or credentials were accessed.
- [x] `npx --no-install tsc --noEmit`: PASS, exit 0.
- [x] `npx --no-install tsc --project tsconfig.lint.json --noEmit`: PASS, exit 0.
- [x] Scoped ESLint on the source and new test with unused-disable reporting: PASS, exit 0.
- [x] Exact source byte locality verified; preimage SHA256 `3208cb25973aa032fc4b22c62b21eefaf60ab91016ab9eb608d2a1e25037ecc4`, repaired SHA256 `988143530d6009ac655ba5cc4f918df6ba0721d808001faadd6e60098b179554`.

Commands and observed exit codes are enumerated in `commands.json`; empty stdout/stderr files for clean type/lint commands are included. Runtime was Node v24.19.0 / available npm 11.9.0; no package installation/update or lockfile mutation was performed. No build was required for this private backend error-shape repair; no export or registration changed.

## Notes for Reviewer

The source assessment at `../task03-partial-memory-denial-contract-review/report.md` establishes that this repair follows approved Task03 R2/A1 alternate-path closure and existing static RuntimeErrorV1 privacy/error semantics, with no consequential product choice outstanding. The historical assessment witness intentionally expects the old defective result and is not a post-repair acceptance suite; do not edit it to manufacture a PASS.

Caller-visible semantic change: `src/resilience/index.ts:207/246` recognizes bare MEMORY_NOT_FOUND as potentially retryable, whereas FORBIDDEN is terminal; both remain non-system failures for circuit-breaking. Unmatched writes to these two partial-memory endpoints now provide the explicit terminal `retryable:false` denial. Direct `ProgressiveStorageHandler.ts:117/159` calls are code-agnostic: update rejection returns false and finalize rejection is wrapped as a failed-finalize error. They do not use the generic resilience wrapper or branch on the legacy error code. Other get/update/delete not-found APIs remain unchanged; no compatibility bridge or classifier exception was added.

This executor result certifies bounded offline handler outcomes and scoped source quality only. Fresh independent repair judgment is still required. C8 FINAL/provisional421, Task03, foundation acceptance and Task04 remain held; separately verified disposable-target live denial/transport/subscription receipts are not supplied by these mocks. Numeric iteration waiver does not waive substantive acceptance.
