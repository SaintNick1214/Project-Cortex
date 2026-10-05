# Independent partial-memory denial contract assessment

Assessment: the narrowly bounded repair is routine, reversible, and consistent with the existing approved authorization/privacy direction. No consequential unresolved product choice or permission question was identified. This report authorizes nothing independently: it assesses the parent session authorization and exact proposed change. C8 FINAL and foundation acceptance remain held until implementation, affected checks, and fresh independent judgment are complete.

## Current and desired behavior

`convex-dev/memories.ts:218/254` first obtains current write authority with omitted selectors, then queries `getScopedMemory`. `runtimeDataAuth.ts:343` uses `by_runtime_scope_memoryId` on verified tenant/space/ID and an own-access owner filter. A foreign tenant, same-tenant foreign owner, and missing resource all produce null without hydrating the foreign row. The first-null branches at memories.ts:220/256 throw a bare string `ConvexError("MEMORY_NOT_FOUND")`. There is no data disclosure or mutation bypass in this witnessed path; the defect is the externally visible authorization error contract/classification. The unchanged foundation `authDenial` correctly rejects this bare error.

Proposed exact scope: change ONLY these two first-null branches to `if (!memory) dataDenied();` using the existing imported helper. Keep requireDataAuthority, index/filter, embedding qualification, source revision, owner mutation behavior, final write rechecks and response shapes unchanged. Do not probe an unscoped ID to distinguish absent/foreign rows. Do not alter other not-found APIs, the classifier, original assertions, approved task rows, or frozen runtime contracts.

Desired result for an unmatched authorized write lookup is the exact known static envelope `{version:1, code:"FORBIDDEN", message:"Access denied", retryable:false, outcome:"not_dispatched"}`. Both nonexistent and unauthorized IDs deliberately remain indistinguishable. An actually owned row continues to return `{success:true}` and persist the content/source revision. No new error enum or API argument is needed.

## Governing evidence and acceptance

- Task03 original requirement R2 and acceptance A1 require scoped closure for every alternate memory path; its foundation/currentguard gate is explicitly still incomplete.
- Original03A `qa/task03a/public-path-inventory.json` records both as write/guard, replacing global IDs with trusted scope/owner. Current `qa/resume-dependency-refinement-c2/registration-ledger.json` preserves these exact policies and makes existing bounded offline acceptance conditional on current source fingerprints and live negatives.
- The sequencing plan preserves original criteria and requires exact no-output/no-effect negatives and healthy functional controls. Its error section preserves Task01 RuntimeErrorV1 fields/outcomes. Existing dataDenied already emits the required envelope.
- The authoritative decision register excludes old deployment upgrades/migration/compatibility bridging. Profile hard rules explicitly say old code is evidence rather than immutable constraints for this clean-slate runtime.
- Runtime/Profile and feature-orchestrator call for the smallest routine consistent repair, asking only consequential unanswered questions. judge-task prohibits weakening assertions; this repair changes production behavior to satisfy the existing negative contract.

## Executable evidence

Command: `node --experimental-vm-modules node_modules/jest/bin/jest.js --config work/resume/partial-memory-denial-contract-review/jest.config.mjs --runInBand`.

Observed PASS: 2 suites, 126 tests, no skipped tests reported. This includes unchanged original `tests/unit/runtimeEndpointAuth/memory.test.ts` (117 tests) and 9 independent scratch witnesses. Native handlers are invoked through the existing transaction-aware, scope/index/filter-aware FixtureDb harness; no services, secrets, signing or network were used. Runtime source and original test files were not edited.

Six witnesses cover both mutations under foreign-tenant principal, same-tenant foreign owner, and absent ID. Each asserts the bare MEMORY_NOT_FOUND error, unchanged classifier rejection, empty indexed selection, no foreign-row hydration, zero attempted writes and identical persisted tables. Two legitimate owner controls assert success, persisted content/version/sourceRevision, source content/revision, and finalization flags/tags. The ninth proves existing dataDenied exactly matches the static envelope and is accepted by unchanged authDenial. Source/config snapshots and command output accompany this report. These tests intentionally pass while recording the present defect; they are a negative witness, not a repair PASS.

## Existing tests and SDK impact

The unchanged memory endpoint suite already exercises both owner mutations, missing verified identity, scope ambiguity, late revocation/deletion and source/revision controls. It lacked the exact initial-null foreign-resource denial cases; retain it and add meaningful exact-envelope regressions for both mutations (foreign tenant/owner and missing ID), with no hydration/no-write outcomes and owner functionality. Reuse the current foundation classifier unchanged for live cases. C7 batch harness eligibility is a separate provisional C8 concern and is not a reason to admit MEMORY_NOT_FOUND.

`src/memory/streaming/ProgressiveStorageHandler.ts:117/159` calls ConvexClient directly: any update rejection returns false; any finalize rejection is wrapped as `Failed to finalize partial memory: ...`. Neither branches on MEMORY_NOT_FOUND. The mocked tests in `tests/streaming/progressiveStorage.test.ts` likewise check generic failure behavior; they reimplement the helper and are not native backend evidence. Existing SDK public get/update/delete MEMORY_NOT_FOUND paths are separate and must not be changed by this repair.

One real caller-observable semantic change: generic `src/resilience/index.ts:207/246` considers MEMORY_NOT_FOUND potentially retryable, while FORBIDDEN is terminal; both are non-system failures for circuit-breaking. The direct progressive helper does not use that wrapper. External callers that retry the old bare not-found now receive an explicitly terminal authorization envelope for these two unmatched writes, consistent with retryable:false and the approved boundary. No documented partial-mutation guarantee requiring legacy not-found was found in the inspected source/tests/contracts. This minor error-shape change should be recorded in the repair report, not expanded into a compatibility bridge or classifier weakening.

## Recommendation and limits

Proceed within the existing approved Task03 implementation scope with a bounded executor for the two production branches plus meaningful regressions, then affected source checks and fresh independent judge. Freeze updated source hashes and preserve prior failures. Requalify C8 source preparation and require actual separately verified disposable-target foundation negatives before claiming foundation PASS. This source-level assessment does not certify subscriptions, Convex transport, live services, aggregate Task03, or C8 FINAL. The user waived only numeric iteration caps; all substantive gates remain.
