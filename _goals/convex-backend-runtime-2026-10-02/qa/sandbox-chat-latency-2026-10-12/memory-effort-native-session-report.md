# Task Completion Report

## Status: source and focused checks complete; Root review and hosted qualification pending

Standalone sessions now share only trusted raw authority rows inside their own fresh native invocation. The existing submitAndStartEnvelope uses the established native V8 raw scope to retain rows across proven unrelated control writes. Every original handler, current predicate, actor/deadline and transactional effect remains. The independent SDK post-I/O session call and generation checks are unchanged.

The existing markVisible endpoint now uses createMemorySourceReadScope, adding bounded raw ancestry and executable metadata reuse within one delta's native fence. Every delta still executes currentOperation and its complete source/policy/authority predicates, including monotone visibility no-ops. No financial transaction was merged. The backend executor owns the companion recordOutput constructor and retrieval implementation.

The client trace parser accepts only the optional retrievalRoute enum direct-facts-v1 or semantic-v1. Omitted legacy traces remain structurally unchanged. Unknown values, an explicitly undefined present field and accessors are refused; user getters are never invoked.

## Changes Made

| File | Change |
| --- | --- |
| convex-dev/runtimeClient.ts | Existing session and admission registrations opt into invocation-local raw scopes |
| convex-dev/runtimeModelPolicy.ts | Existing per-delta visibility fence opts into managed raw reads |
| src/client-runtime/validation.ts | Strict additive optional retrieval route enum |
| tests/unit/client-runtime/session-native.test.ts | New actor/deadline/raw identity/read-count and next-RPC revocation/expiry tests |
| tests/unit/client-runtime/admission-native.test.ts | Exact supported admission/effect parity, controlled raw reuse and current effort-aware V8 scheduling/revocation |
| tests/unit/client-runtime/client.test.ts | Enum round trips through admission/recall, legacy shape and invalid route rejection |
| tests/unit/runtimeAgent/endpoint-raw-read-scopes.test.ts | Expanded factory observation, prior-scope visibility parity/read counts, fresh every-delta source and writer outcomes |
| tests/unit/runtime/model-policy-admission.test.ts | Correct stale schema inventory to require the already committed entity projection table and its three indexes |

runtimeAuth.ts and observeEnvelope are unchanged. The existing reader kernel already provides the required exact-table retention, unknown/child writer invalidation, in-flight suppression, epochs, detached copies and bounds. Reusing it avoids another caching layer.

## Verification

- PASS: composed final evidence covers 1,154 tests in 24 suites, zero failed/skipped. This is **not one 1,154-test invocation**: unchanged passing suites from tests2 plus the final two changed suites in tests3 (240/240). All runs used pinned Node 24.15.0, an explicit inert loopback URL, detectOpenHandles and forceExit=false; observed direct exits are recorded.
- PASS: exact current actor/deadline, unchanged transactional admission results/effects and useful current V8 direct scheduling; no duplicate save/attempt/dispatch.
- PASS: next-RPC revocation/expiry, immutable actor/scope/generation and independent protected-output suppression; source edits/tombstones, lease/cancellation, policy/qualification/account changes and interleaved child writes remain refused.
- PASS: lint TypeScript, affected ESLint (zero errors; two pre-existing unsafe-assignment warnings at validation.ts22-23) and allowed-file diff check.
- PASS: full root TypeScript (types4, observed exit 0), rerun after the backend owner corrected the dynamic-import test fixture with InstanceType. Prior failing logs remain preserved.

Controlled physical reads: standalone session16→10; admission query/component calls167→156; visibility managed graph6→5 and policy metadata9→7 versus its previous raw scope. Identical returned data, durable state, unique raw read identities and unaffected operation ordering are asserted. **These are controlled read counts, not measured hosted speedups.**

## Preserved Red Receipts

- types1 exited2 for a readonly userId fixture assignment. The test now uses Reflect.set to simulate runtime DTO mutation while retaining the readonly public contract and fresh-session outcome assertion.
- visibility-tests1 exited1 because the expanded mock newly records finalDelivery's pre-existing managed-reader factory. The corrected test asserts a distinct fresh scope on each invocation and later revocation refusal. Product finalDelivery is unchanged.
- tests2 passed1,152/failed1 because its old schema inventory omitted runtimeMemoryFactEntities, which was already in HEAD. The exact member and its three current index expectations were added; the final two-suite rerun passed240/240. No schema was changed and no assertion was dropped.
- types3 exited2 for the concurrent backend type error noted above. The backend owner corrected the fixture; types4 passed with exit0.

## Requirements Checklist

- [x] Invocation-local raw rows only; no session/permission/currentness verdict reuse.
- [x] Original post-I/O session, actor, generation, expiry and output suppression retained.
- [x] All visibility and source fences execute on every native invocation.
- [x] Unknown/component writer invalidation and fresh final authority checks retained.
- [x] Strict optional route enum; legacy omission unchanged.
- [x] No services, credentials, inference, deployment, builds, commits or GitHub operations.
- [x] Full root TypeScript rerun after the backend owner's correction.
- [ ] Root's coherent independent source review and actual hosted qualification.

## Source Freeze

- convex-dev/runtimeClient.ts: 6d2b11fbeb6c5ed72ab80bb64254579fa079d1869ab7f71bd6d96899390375d6
- convex-dev/runtimeModelPolicy.ts: a78c7c7c4c036b65dd74b6aad401c4c6ed1eae325bc6b59ccb8bffa51a7b8e70
- src/client-runtime/validation.ts: ff8c40bd31e6cba7c0cd470a9e56f8578e0b2c837c686be910af396e731f395b
- tests/unit/client-runtime/admission-native.test.ts: 24b74294d1c825fef9238ebd658e4e22416d39f991dee1813957f567a5e190c1
- tests/unit/client-runtime/client.test.ts: 56a20fc35901648ecb8863d7523e9ea5101a048c8a844851952ed7d213a6e4b4
- tests/unit/client-runtime/session-native.test.ts: 717581170583980450ef8a82661aeb10c5826227aef4c05908700752a4d795e3
- tests/unit/runtimeAgent/endpoint-raw-read-scopes.test.ts: 8b0a5999945d2bfeadfd877491f2628660da5bb9197c76881fab0422656c7124
- tests/unit/runtime/model-policy-admission.test.ts: 32d023eee1d4398a3ab53c7a4a17ebf2db5eb0654863c6527d732f45b2c70e65

Observed exits, composed suite provenance, hashes, failures and final TypeScript command are in memory-effort-native-session-checks.json. The source diff including the new test is memory-effort-native-session-diff.patch. No further owned source edits are planned.
