# Task judgment: Task04 native denial boundary qualification

## Verdict: REJECT current native boundary; bounded B repair warranted

This qualification is complete as a diagnosis and source proposal. It is not native PASS, B acceptance, or whole Task04 acceptance. The unchanged native assertion is valid. C6 rejects changed admitted identity correctly but loses the defined structured runtime error envelope. This is a backend normalization defect, not a fixture codec misunderstanding.

## Evidence review

Read AGENTS.md, .agents/CODEX-RUNTIME.md, PROJECT-PROFILE.md, pessimistic-judge and judge-task; original tasks/04-model-policy.md; PURE consumed contracts/report, contract-preparation/implementation-packets.md; admission-preparation/report.md and frozen admission native-api.md; native-admission-preparation/report.md and C6 scripts/cases.mjs. Existing instructions prohibit weakening assertions and require fresh acceptance for changed source.

Current source: `src/domain/model-policy.ts:363-365` throws ordinary Error on changed canonical or hash. `convex-dev/runtimeModelPolicy.ts:431,455,532,639` directly invokes that function. The actual C6 copy has a shifted line 459; the parent supplied sanitized actual server diagnostic points to precisely this identity guard. The first three native core cases passed, then identity-canonical failed at `assert.ok(error?.data?.code)`; no native completion is inferred. Parent reports owned cleanup complete, zero processes, target retired DELETE200/GET404. Those live facts are supplied context, not independently verified here; private physical IDs, keys, environment and service state were not read.

Native module own `fail` at lines30-32 throws ConvexError with version1/code/generic message/retryable false/outcome. `runtimeAuth.ts:45-48` follows the same structured convention. PURE intentionally has no Convex dependency: known errors are INVALID_INPUT, POLICY_DENIED, CAPABILITY_UNAVAILABLE, CAPABILITY_UNSUPPORTED, PROFILE_NOT_READY, IDEMPOTENCY_CONFLICT. Profile helpers also throw INVALID_INPUT/PROFILE_NOT_READY. Other callers are runtimeGateway and pure tests; changing PURE globally is unnecessary and expands scope.

Installed SDK `node_modules/convex/src/server/impl/registration_impl.ts:84-92,112-126` serializes error data only for the identifying ConvexError symbol. Ordinary Error passes through. `src/browser/http_client.ts:398-407,608-611` creates ConvexError and decoded `.data` only when response.errorData is present, otherwise ordinary Error. `src/values/errors.ts:5-16` owns the symbol and data. A fixture cannot reconstruct structured server errorData from missing data without synthesizing a replacement contract.

## Fresh observed probes

`handler-probes.txt`: 64 original native-handler tests PASS, two additional stronger expected-red probes FAIL, zero skips, exit1. Copied original tests differ only by import relocation; no product/original test edits. Both probes execute the actual registered admit `_handler` with existing synthetic trust/root/auth/database helpers. Changed admitted request yields bare IDEMPOTENCY_CONFLICT; nonzero maxRetries yields bare INVALID_INPUT. Both assert unchanged write count before the failed structured-code assertion. This controlled fake database does not certify native rollback, OCC, real transport or services. Initial expected-red.txt also retained: initial malformed-options expectation used POLICY_DENIED, then corrected to the source-defined INVALID_INPUT; final failure remains missing `.data`, not taxonomy ambiguity.

`codec.json`: actual installed ConvexHttpClient with a custom fetch producing synthetic 560 responses makes zero network calls. Missing errorData produces Error/data absent; valid Convex encoded errorData produces ConvexError with exact structured data. This validates installed client decoding, not native server response generation.

Source-before.json and source-after.json hash the examined product/tests/SDK/fixture assertion sources; unchanged=true. Only this new QA folder and unique work/resume directory were written. No Git, service, environment, credential, deployment, codegen, product, schema or capture edits.

## Concrete bounded implementation proposal

Production ownership: ONLY `convex-dev/runtimeModelPolicy.ts`. Review/test ownership: append regression cases to `tests/unit/runtime/model-policy-admission.test.ts`, preserving all original64 cases and assertions. Freeze PURE/domain/index/profile, runtimePolicySchema/schema, bootstrap/root qualification, runtimeGateway, capture and generated registration files. Keep all14 internal registrations, validators, arguments, exports, authority checks and transactional ordering unchanged.

Add one private synchronous adapter `domainControl<T>(call:()=>T, outcome="not_dispatched"):T`. Inside try return call(). Catch unknown; rethrow existing ConvexError unchanged. For an actual Error, extract only an anchored exact `CODE: ` prefix and accept only the closed six-code taxonomy above. On a known code call existing `fail(code,outcome)` so message is the existing sanitized generic string; never forward the PURE message, request, canonical bytes or identifiers. Rethrow all unknown errors unchanged. Do not accept arbitrary uppercase prefixes, arbitrary thrown objects or stringify unknown errors. Do not catch all async handlers or database/auth failures, downgrade unknowns to POLICY_DENIED, swallow exceptions, or return a successful denial union. No callback may perform writes or effects. The synchronous functions here require no async adapter.

Use direct wrapper calls or private local aliases around actual throwing PURE imports: canonicalModelJson in canonical(); resolveModelPolicy in resolveCurrent(), snapshotOf(), installation validation; every validateModelRequest invocation; all four assertModelRequestIdentity sites. Keep the invocation positions exactly where they are. This closes adjacent missing-envelope denials without changing PURE semantics or transactions. canFallbackModel already catches bad evidence and returns false; preserve it. Profile/vector validators are currently inside validatedPrivateResult's existing try/catch that returns undefined and withholds malformed results while accounting money; retain that behavior and do not turn it into a thrown transaction rollback.

Outcome must not erase prior paid liability. Admission/resolve/install/request guards use existing not_dispatched semantics for this refused action. Settlement receipt identity conflict at current line639 should explicitly use uncertain, consistent with the explicit receipt-binding fail at line633; it must not release/reset/rebill the original attempt or infer original no-dispatch. If adapter coverage is expanded into shared canonical/snapshot helpers used after checkpoint, review the envelope outcome against stored attempt state; never infer zero liability from a domain exception. Preserve balances/replay state regardless of envelope code. This is a targeted control error repair, not terminal-capture expansion.

## Required regression and acceptance work

1. Exact changed text and forced equal-hash/different-canonical admission failures assert ConvexError.data version1, IDEMPOTENCY_CONFLICT, sanitized message, retryable false, exact outcome, and full ledger/operation/attempt/account/no-peer-effect equality.
2. Malformed options/canonical contract assert INVALID_INPUT; forbidden option/pinned-version/limits assert POLICY_DENIED; unqualified model selection/resolver media/profile failures preserve the exact known codes. Check no partial writes, token or peer effects.
3. Checkpoint canonical mismatch remains a structured identity denial without permit or state effects. Conflicting settlement receipt remains structured, unchanged original-window balances and conservative liability, with no replay/rebill or private result.
4. Adapter-specific tests verify unknown plain Error and thrown non-Error propagate unchanged, existing ConvexError unchanged, exact closed prefixes only, no raw detail leaks. Preserve invalid-private-result money-accounting behavior and fallback false behavior.
5. Re-run all unchanged source64 tests plus new regressions, affected domain checks, scoped lint/typecheck,14-registration/API-validator inventory and source freeze. Fresh independent B review is mandatory; previous B16/PURE acceptance does not cover changed B source. Root-wide unrelated repairs are excluded.
6. Prepare a NEW native fixture derived from the newly accepted exact B bytes; preserve C6 originals/failure, original49 case/deny assertions and no-effects snapshots, limits and ownership. New source/fixture freeze and independent fixture/parent-input review precede new owned disposable target. Native official deployment/codegen/publication, complete core/guard/OCC/crash/EMPTY/storage matrix, cleanup/process terminal/retirement and fresh evidence judgment remain required. Offline green never certifies native PASS.

A fixture-only codec repair is justified only if an observed real raw response already contains valid structured errorData and the fixture incorrectly discards it. The installed client and supplied bare-Error server diagnostic provide opposite evidence. Parsing human diagnostic text, relaxing `.data.code`, accepting any rejection, excluding identity cases or deleting tests is rejected.

## Requirements review

| Requirement | Result | Evidence |
|---|---|---|
| Genuine B versus codec qualification | Met | SDK source + actual handler reds + codec probe |
| Smallest source-bound repair, PURE frozen | Met | One production file/private synchronous closed adapter |
| Denial/no-effects/assertion preservation | Met | Original fixture assertion unchanged,64 originals retained |
| Registration/transaction/capture bounds | Met for proposal |14 registrations untouched; no handler catch or writes |
| Native success and repair acceptance | Not claimed | Native re-run still required |

## Five-dimension rubric for current boundary

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5| Structured denial contract fails actual identity case |
| Code Quality |2/5| Direct raw domain errors escape native structured boundary |
| Test Quality |4/5|64 originals meaningful but generic rejects miss envelope; native exact assert catches it |
| Pattern Adherence |2/5| Deviates from local fail and auth ConvexError envelope |
| Completeness |2/5| Native matrix stops at fourth core case; repair unimplemented |

Average:2.4/5. REJECT applies to current boundary/native acceptance, not to the completed bounded qualification. Proceed only with scoped reviewed B repair; retain every failed native/offline prefix and all deferred gates.
