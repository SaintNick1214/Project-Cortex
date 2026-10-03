# Task03B2C1 execution report — awaiting fresh independent judgment

The isolated implementation is ready for review. Bounded text artifact metadata
closure only:22 original selected registrations,21 guarded public APIs and1 trusted
operator internal purge. Full C2 remains pending (five unchanged artifact file APIs
plus twelve untouched attachment APIs), as do storage/private bytes/media/live
qualification, whole Task03 and the overall goal. No deployment, codegen, build,
staging, commit, push, release, paid operation or live/storage effect was performed.

## Changes and observed behavior

`convex-dev/artifacts.ts` replaces selected handlers' actual global/caller-selected
lookups with independent03A canonical scope/owner selection. Text CRUD, history,
undo/redo and stream state APIs remain functional. Create/version/delete actor
fields derive the verified principal; caller labels and metadata never become grants.
`runtimeArtifactAuth.ts` pins READ/WRITE authority before effects, retains exact
source/link/anchor requirements, validates canonical version and state invariants,
rechecks full snapshots and trusted controls, and evaluates deadlines after the last
DB await. Initially unavailable READ returns a safe write receipt without retrying
after effects; later admitted-authority failure rolls back the mutation.

Only the artifacts schema block changed: optional ownerPrincipalId,
lastActorPrincipalId and tombstonedAt plus exact tenant/space and tenant/space/key
indexes. Existing runtimeAuth controls are retained and used for tombstones. No new
table or schema change outside artifacts was made. Five file registration AST byte
sequences and all attachments/source/auth/generated/manifests/config files are
unchanged, verified in preservation and native catalog receipts.

Every current/retained file version denies with `CAPABILITY_NOT_READY` before
mutation or file processing. Deletion retains a canonical tombstoned row and resource
control. Internal scoped operator purge preflights the entire batch before effects,
retains control records/foreign rows, and performs no storage deletion. Linked
operator-fixture cleanup is incomplete and explicitly capability-pending until
the canonical cleanup adapter and later Task05/12/16 dependencies are available.
No complete artifact lifecycle or linked purge coverage is claimed.
All public linked text paths retain their canonical READ/source witnesses. Current
conversations lack canonical ownerPrincipalId, so real current linked rows deny
before private messages hydrate; the native tests' typed fresh ownership seam does
not claim live transcript readiness. Details: `contracts.md` and original-requirement
coverage: `requirements-matrix.md`.

## Final observed verification

`commands.json` retains UTC commands, working directory, exit code and raw stdout/
stderr. The final npm12/private-cache check run observed:

- Actual unchanged `convex-dev/tsconfig.json` backend compilation, lib ES2021: PASS.
- Explicit scoped backend/test ES2021 compilation: PASS.
- Scoped ESLint, zero warnings/errors, and whitespace: PASS.
- Native tests:2 suites,84 passed,0 failed,0 skipped/todo. Discovery exactly the two
  owned test suites. All21 public handlers have missing-identity and meaningful
  actual happy-outcome tests; operator visibility/preflight/retention is asserted.
- Native import-aware AST catalog:22 selected registered exports,21 public,1 internal,
 0 unresolved; all five excluded original file registration byte sequences unchanged.
- Full isolated root typecheck: PASS, zero diagnostics. Original c0c40423 tracked-input
  compiler-host baseline with original artifacts/schema: PASS, zero diagnostics.
  This isolated result does not erase unrelated consumer failures observed in the
  coordinator's other/main workstreams.

Actual executable context: Node24.19.0, npm12.2.0 in the private npm12 cache,
TypeScript6.0.3, Convex1.46.0 and Jest30.5.2. `tool-versions-actual.json` identifies
the actual npm executable/package. The outer npx launcher's inherited user-agent
reports npm11.9.0; that inherited label was not used to claim npm12 execution.

Initial native run retained in `tests-initial.json`:69 passed/1 failed because the
clock hook threshold (>12) was never reached (then-current native path had10 tombstone reads).
The correction preserved the denial assertion. After the pre-hydration tightening,
the test independently measures the current successful path's final control-read
position, advances during exactly that awaited read and asserts injection count,
the exact final resource key and zero write attempts. `initial-harness-failure.json` retains the original failure message.
A later exploratory full-root compile caught overly broad safe-receipt return types
on read APIs. Read and write operation types were separated; final actual root and
backend checks pass. Raw exploratory diagnostics remain in `root-current.stdout`.

The independent fixture imports no unreviewed guard/fixture machinery, invokes
actual Convex native registrations' `_handler`, implements real scope/filter queries,
and restores mutation state on denial. Separate retained attempt logs verify batch
preflight performs zero attempted mutations, even when rollback would hide writes.
Tests cover wrong-tenant ID-first selection, same-tenant different-owner filtering,
resource tombstones excluding payloads before hydration, independent linked READ
before private source query,
forged labels/issuer/scope, ambiguity, collision fences, full source/version/anchor
checks, old linked control invalidation through later candidate work, READ admission,
late control/deadline failure, rollback, version overflow/gaps/branching, streaming
UTF-8 progress/history, file denial and operator control retention. They do not
qualify actual deployed subscriptions, Agent store, storage or external effects.

## Handoff

Parent is the sole integrator for shared schema, codegen, any deploy, staging,
commit and push. `change.patch` contains the full six-file API/schema/guard/test
change; `source-freeze.json` records final source/evidence hashes and preservation.
Fresh read-only pessimistic judgment is required before marking the bounded slice
COMPLETE. Failed memory/fact review and pending workflow exception remain separate;
this implementation imports or adopts none of that rejected machinery.
