# Task Completion Report

## Status: COMPLETE — bounded source/test implementation

The planner now carries an explicit, private binding for each source-derived candidate through its original resolution and native atomic commit. The K24 ordinal-0 model operation was correctly bound to candidate 0; the missing distinction was in planning the remaining unequal candidates under the same owner/normalized slot. This change does not merge, discard or reinterpret those unequal candidates, reuse candidate 0's result for candidate 1, or alter the qualified native prompt/JSON schema.

## Changes Made

- `src/domain/belief-plan.ts`: derives stable full-candidate/source identities, original extraction ordinals, retained ordinals and the original semantic operation identity. Bound decisions must match exactly. Unequal candidates are independently resolved against the original virtual matching state; exact duplicates use the existing normalization rule. Legacy unbound unequal inputs still refuse.
- `convex-dev/runtimeMemoryGateway.ts`: validates the selected candidate against the worker-owned extraction and exact operation after the original fresh authority/source reads, before reservation or dispatch. Current source hash/owner/lineage must match. Native request bytes, prompt assembly, JSON schemas, policy limits and ordinal-zero native attempts per distinct operation remain unchanged.
- `convex-dev/runtimeIngestion.ts`: passes the original owned source/extraction/attempt into that private Gateway guard, then binds each returned or deterministic duplicate decision to its candidate. Each original planned secondary call remains independently governed; no extraction, attempt, retry or funding lane was added.
- `convex-dev/runtimeBeliefs.ts`: reconstructs and validates every candidate binding from current source/extraction and the current lease during commit and no-inference CAS replan. Truncated, reordered or tampered candidate plans cannot partially commit.
- New `tests/unit/runtimeIngestion/candidate-binding.test.ts` and the affected legacy negative in `framing-invalid-output.test.ts` exercise the actual worker, Gateway, ledger, commit and failure handlers with controlled provider/DB ports.

## Requirements Checklist

- [x] Preserve full canonical source/extraction and unequal truth, value, wording, confidence, tags, entities, relations and lineage. The actual-handler test commits both independently bound ADD candidates; exact duplicates remain deduplicated.
- [x] Bind each resolver result to the source-owned candidate/ordinal and original semantic identity. A sibling candidate under ordinal 0 is refused before provider dispatch/reservation; candidate 0's binding cannot authorize candidate 1.
- [x] Revalidate native source/authority/lease/policy/read versions and whole-candidate coverage. Tampered IDs/ordinals/operation IDs/semantic IDs/hashes, missing bindings and truncation all refuse without facts/history/outbox effects.
- [x] Preserve legacy unbound ambiguity, replay safety, original accounting and UNKNOWN. A lost commit retains the full bound draft and confirmed attached results; repeated worker delivery does not call the model again.
- [x] Preserve original CAS representability. UPDATE/SUPERSEDE of an in-plan target is refused before persistence; it is not silently converted to ADD or a merged fact.

## Files Modified

Four production files and two test files, exactly listed with before/current hashes in [source-freeze](./k25-candidate-binding-source-freeze.json). No Agent, QueryEmbedding, Recall, Auth, client, ModelPolicy, schema, public endpoint, package, Proofs or website files were edited by this batch.

## Verification

- Affected discovery: 13 exact test paths; Jest JSON records **293 passed / 293 total, 13 suites, 0 failed, 0 skipped, 0 todo**, exit 0. The timing reporter aggregates 269 unique test labels; the complete Jest assertion records contain all 293 outcomes. Raw: `k25-candidate-binding-{discovery-v1,affected-v1}.json`, affected log and exit JSON.
- Backend TypeScript: exit 0, `k25-candidate-binding-backend-types-v1.{log,-exit.json}`.
- Scoped ESLint over all six files: exit 0, zero warnings/errors, `k25-candidate-binding-scoped-lint-v1.{log,-exit.json}`.
- Node 24.15.0 / npm 12.2.0 pinned toolchain, explicit offline test environment with `127.0.0.1:9`. No native service, inference, deployment, build, package, Git write or paid call occurred.
- One final shared root/lint type/build/contracts gate and non-author joint review are owned by Root. They are not claimed complete by this author report.

## Notes for Reviewer

All original failures remain. The first focused gate was 26/40, with thirteen new fixture failures caused by invalid controlled extraction output (an unsupported entity type and missing mandatory native output arrays), and one affected legacy oracle. A one-test setup isolation failed and skipped 17 unselected tests; it is not a full gate. Fixture outputs were corrected to the original strict schema, and the original parser plus JSON persistence now produces the stored optional-field shape. The corrected new suite passed 18/18 before four additional cases; the final affected gate includes all 22 new cases.

The old framing negative explicitly asserted that *unbound* conflicting values never reach a resolver. Its successor invokes the actual legacy native commit and confirmed-failure handlers, preserving every dead-letter/no-additional-funding/no-retry assertion. Fresh bound worker behavior is tested separately. No negative assertion was deleted to obtain green coverage. The original failing receipt remains `k25-candidate-binding-focused-v1.json`; the legacy successor is `k25-candidate-binding-legacy-v2.json` (22/22).

Accounting is per original candidate call, not one reused group result. A future source with two independently conflicting candidates can complete two original planned facts.resolve calls where K24 stopped after its first one. Each call has its own existing operation/attempt, admission, checkpoint, source and budget fences; this is not a paid retry or a cap increase. The historical failed K24 event was not replayed or repaired.

The original native CAS cannot represent UPDATE/SUPERSEDE of a freshly produced in-plan target. Such decisions remain typed refusals with atomic rollback. ADD/NONE paths retain all candidates and their original metadata. This bounded repair does not guarantee that every arbitrary same-source correction chain can be applied; it does not narrow the goal or claim native functional acceptance for that unsupported chain.

Private binding metadata is not authorization or a cached policy decision. Current native checks still run. [Equivalence evidence](./k25-candidate-binding-equivalence.json) records the unchanged extraction framing and native text request assembly and the intentional helper deltas. K24's original native ambiguity, QA projection failures, indexing hole and 0/4 latency outcome remain preserved. No native K25 qualification or subsecond result is claimed.
