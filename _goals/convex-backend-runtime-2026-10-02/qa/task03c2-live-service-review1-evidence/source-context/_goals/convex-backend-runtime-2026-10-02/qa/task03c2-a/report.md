# Task Completion Report

## Status: COMPLETE

Scoped implementation and offline verification are complete. This executor report
and frozen candidate require the parent's fresh independent task judge before
acceptance. Whole Task03/03C2, Task09, live transport and backend maintenance
execution remain incomplete.

## Changes Made

- `src/users/index.ts:71` adds a safe readonly receipt interface and browser-safe
  `UserProfileWriteReceiptError`. `update` narrows the actual backend response
  union after resilience completes, preserving hydrated mapping and translating
  safe receipts into an explicit committed, nonretryable read-unavailable outcome.
- `src/users/index.ts:1094` rethrows that exact committed error in updateMany.
  It does not return an unsuccessful count for an already committed item.
  Ordinary failure handling remains in place; earlier items may have committed.
- `src/sessions/index.ts:46` exports browser-safe `SessionCapabilityError`.
  `expireIdle` preserves its signature, tenant mismatch check and timeout/default
  evaluation, then rejects before any resilience/transport attempt. Its owned
  comment now says that it does not perform or schedule automatic maintenance.
- `src/index.ts:785` reexports both public error classes with existing errors.
- Two new actual API suites use disabled real Convex clients, actual absent/
  disabled/enabled ResilienceLayer variants and transport spies. A fixture-only
  branded document ID is the sole test type cast; no receipt-to-profile cast,
  any/ts-ignore or private-field suppression is used.

## Requirements Checklist

- [x] Close exactly five introduced metadata TS2339 consumer errors: removed
  session API reference and four receipt-union private-field assumptions. Full
  reviewed-archive root TypeScript passes; shared root now has only MF3 errors.
- [x] Valid maintenance request returns BACKEND_MAINTENANCE_ONLY,
  retryable:false, outcome:not_dispatched, requiredExecution:trusted_backend_worker.
  Validation/mismatch and valid paths have zero query/mutation/action/execute
  attempts. Existing timeout/default is evaluated before rejection; no new
  timeout validator or worker invocation was introduced.
- [x] Hydrated user result uses unchanged server profile mapping and deep merge.
  Receipt outcome is PROFILE_WRITE_COMMITTED_READ_UNAVAILABLE, retryable:false,
  outcome:committed, requiredCapability:read and a frozen copied safe server
  receipt. It includes no caller payload, profile fields or forwarded cause.
- [x] Exactly one dispatched mutation, no post-commit query/retry and actual
  resilience operation resolution before SDK error translation. Normal transient
  resilience retry behavior is separately exercised and preserved.
- [x] getOrCreate/merge propagate the receipt error; their method source remains
  byte-unchanged. Bulk propagation never reports committed receipt items as zero
  or unsuccessful, preserves preceding commits, and stops before subsequent items.
  Ordinary failures/missing rows/success counts, defaults and malformed-input
  validation retain meaningful outcomes. Initial read denial never becomes a blind write.
- [x] Root ESM/CJS/DOM declarations and real packed Cortex users/sessions browser
  methods retain exported error identities and literal error contracts. VM has no
  Node globals/provider keys/model call and performs zero fetch/socket sends.
- [x] Scoped ownership and accepted source/QA preservation verified. No schema,
  backend visibility, generated bindings, auth primitives, cleanup helper,
  interactive runner, governance test or manifest was edited.
- [x] Original requirement mapping and scoped limitations are in contracts.md.

## Files Modified

| File | Action | Notes |
|---|---|---|
| `src/users/index.ts` | Modified | Explicit safe committed-receipt boundary and truthful bulk propagation |
| `src/sessions/index.ts` | Modified | Typed undispatched maintenance boundary |
| `src/index.ts` | Modified | Necessary public error exports only |
| `tests/unit/runtimeWorkerClient/metadata-consumers.test.ts` | Created | 79 outcomes on real SDK/client/layer boundaries |
| `tests/unit/runtimeWorkerClient/sessions-maintenance.test.ts` | Created | 27 validation/capability outcomes |
| `qa/task03c2-a/**` | Created | Scoped configs, contracts, raw results/UTC commands, retained failures, archive/browser/source provenance, report/freeze |

QA paths in the last row are relative to this goal's `_goals/convex-backend-runtime-2026-10-02/`.
Build/pack/scratch are isolated under `work/backend-runtime/task03c2a-checkout`;
exact baseline source-graph comparison uses `task03c2a-browser-baseline`. No shared
root dist/build, stage, commit, push, deployment or live/paid call occurred.

## Verification

Observed runtime is Node v24.19.0 and explicitly scoped npm12.2.0, using only the
private `work/backend-runtime/npm12-cache`. commands.json has exact argv/cwd,
UTC start/end, duration, exit and log paths. Final observations:

| Gate | Result |
|---|---|
| Scoped strict TypeScript | PASS |
| Owned source/test ESLint | PASS |
| Scoped discovery | Exactly the two new owned suites |
| Actual API outcomes | 106/106 tests, 2/2 suites; zero failed/pending/todo/skipped |
| Reviewed c92d archive full root TypeScript | PASS |
| Actual reviewed backend ES2021 project | PASS, unchanged project/config/lib |
| npm12.2 isolated SDK build | PASS: ESM/CJS/bundled declarations |
| Packed public literal errors/method return types | PASS: ESM/CJS + strict DOM/types[] consumer |
| Real packed Cortex browser outcomes | PASS: public error identities, query1/write1/action0 for user receipt; zero session/resilience attempts before the user operation |
| Browser network | fetch0/socket-send0; one inert synthetic socket for real Cortex construction/shutdown |
| Browser source graph | Exact reviewed baseline input graph; zero added inputs, no backend implementation/Node builtin inputs |
| Existing npm run test:contracts | PASS |
| Source/provenance preservation | PASS:36 other SDK methods unchanged,542 protected accepted03A/C1/metadata/governance files unchanged,2174 other tracked archive files unchanged |
| Owned diff whitespace | PASS |
| Actual shared root TypeScript | FAIL, exactly3 remaining MF purgeAll diagnostics outside this scope |

Shared-root diagnostics are `tests/helpers/cleanup.ts:58,77` and
`tests/interactive-runner.ts:380`. These references conflict with the unreviewed
concurrent memory/fact internalization. main-root-types.log preserves the actual
failure. There is no shared-root, whole-task, service, JWT/subscription/private-byte,
callback, inference, automatic maintenance or full thin-facade PASS claim.

## Notes for Reviewer

snapshot-provenance.json records reviewed signed c92d commit/tree, archive hash,
five exact source/test overlays and every other tracked file hash. It expressly
excludes main's unreviewed memory/fact/schema declarations from build certification.
The declaration contract preserves UserProfile return signatures; committed results
that cannot satisfy that signature are surfaced through a typed error with the
safe receipt. Tenant-wide grants can yield memorySpaceId:undefined; that exact
backend shape is typed and tested, with no invented scope.

Initial receipts are preserved. The initial103 outcomes passed but strict types
found that the first new receipt interface incorrectly required a string
memorySpaceId. It was corrected to string|undefined and a tenant-wide variant
added; the final106 outcomes/types/lint were rerun on the final source. Initial
commands/types/outcomes and source hashes are retained with `.initial` names.

An initial extra browser assertion forbade all provider/neo4j inputs. Existing
root exports already include819 browser-compatible provider/graph input files;
that assertion was broader than this bounded Node/backend/key/inference boundary.
Its exact script/log/failed command are preserved. The final QA compares direct
source input graphs against an untouched c92d archive and proves they are identical,
while actual platform:browser bundling, a VM without Node globals and zero network
execution verify this patch's browser behavior. No provider/graph source was widened
or removed to satisfy the gate. Existing browser package structure remains a later
facade concern; this task does not claim a provider-free root export.

The source preservation guard was then expanded to include the accepted03A/C1
QA/auth primitives explicitly. Its earlier416-file result and script remain
preserved; the final542-file result is in source-boundary.json and its separately
recorded successful final command. Production/test source did not change in these
QA-only checks.

source-freeze.json hashes the five source/test files and every retained local QA
artifact other than the freeze itself, with an exact corresponding archive copy.
The parent owns fresh independent judgment and any subsequent staging/commit.
