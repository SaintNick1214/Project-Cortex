# Recall native-entry authority-scope report

Status: implementation and tests frozen; **combined source gate FAIL** with four existing sensitive assertions. Root activation decision is pending for finalDelivery and observeEnvelope. No existing test or fixture was edited. The new registered-handler suite passes29/29; the selected dependency run passes772/776 across18 suites, zero skips. Backend/root/lint TypeScript and scoped ESLint all exit0. This batch does not establish native latency/OCC/inference results or the 1-second goal.

## Exact bounded changes

One explicit raw-authority scope is created at each selected native registration. Four memory entries readFacts/checkProfileReady/readVectorMatches/finalDelivery pass that view to their original ConvexMemoryRepository. Standalone embeddingProfile/resolve/admit/checkpoint and client submitAndStart/observeEnvelope pass it into their original helpers. No helper body, validator, endpoint, call order, budget/account/replay/UNKNOWN logic, output/interface or policy limit is rewritten.

All three complete original files can be reconstructed byte-exact by removing only the entry factory wiring and imports, as observed in equivalence.json. Each repository receives the scoped context itself; read repositories have no writer. Original ledger/client helper chains receive the scoped MutationCtx and its DB/runMutation writer ports, so writes and child mutations go through the factory's before/after invalidation. No action, RPC argument or process state carries a scope between invocations.

readSource stays unscoped as required; checkAuthority/defaultProfile and public runtimeClient:session/signal are unchanged. The SDK post-response session RPC is unchanged. runtimeAgent/runtimeAuth are independently owned and untouched by this author. ContextSource's strict getter remains an independent source exception.

## Actual new-handler tests and bounded fixture counts

The new test loads the real registered handlers and installed raw reader factory. A test-only toggle sends their exact original code an unscoped context for reference, then replays with actual scopes. Real transcript/DB/component ports, repositories and policy helpers execute; no fake helper substitutes for a guard. Positive mutation references execute in the fixture transaction and roll back after result capture, permitting exact result/state/non-auth read and writer-order comparison. This fixture rollback is not native OCC proof.

Three-source fixture raw authority DB get/query call counts, preserved from the passing count cases in focused-v3 (that receipt also contains two unrelated enum-assertion failures, corrected in the final29/29 suite):

| Actual registration | Unscoped | Scoped | Non-auth read/write sequence entries |
|---|---:|---:|---:|
| readFacts |50|20|4|
| readVectorMatches |52|22|22|
| finalDelivery |223|28|34|
| checkProfileReady |28|18|9|

These are controlled raw DB method-call counts, not native documents, read bytes, engine duration or an expected cloud saving. The minimal standalone profile/resolve account makes one authority pass and stays8→8; that exact absence of reduction is asserted honestly. Measured Agent/source-parent cases can have additional guards; their native performance is not inferred from this small fixture.

The29 actual-handler tests retain exact positive results, all non-auth operation order and state; native argument validators; repeated admission identity/reservations and one attempt; checkpoint dispatch_pending/replayAllowed:false; fresh RPC revocation and current source/hash/tombstone/fact/vector/owner/epoch/duplicate-grant denials; distinct verified issuer/subject raw keys; time-only expiry re-evaluation; unchanged standalone session; strict unscoped source getter rechecks; and real child-writer invalidation with rollback. No paid model/network call occurs.

## Preserved compatibility failures: activation decision required

1. runtimeMemory:finalDelivery — vector-delivery-batch.test.ts:322 revokes the raw fixture grant after the last vector hash within one invocation and expects the original final authority check to see FORBIDDEN. The scoped entry returns the invocation's original raw snapshot instead.
2. runtimeClient:observeEnvelope — observation-native.test.ts pre-session revoke, pre-session expiresAt edit, and late private-row projection revocation each mutate the grant behind the same context. The scoped entry retains its original raw row and returns the observation instead of the expected FORBIDDEN.

All four existing assertions remain untouched, and the original FAIL receipt is retained. These cases do not cross a native RPC/write boundary in the controlled fixture; separate invocation revocation, clock-only expiry and distinct-identity denials still pass. The source gate remains FAIL until root decides whether to defer those exact registrations or authorizes a concrete correction. This report does not reinterpret those existing failures as PASS or claim native equivalence from static snapshot reasoning.

## Red fixture receipts and corrections

Focused v1:18/24. New test mistakes included expecting a read reduction for a one-pass profile account, counting all legitimate background schedules as Workflows, an incomplete exact source binding, missing actual embedding request pins/profile/batch, and changing content without its tracked source hash.

Focused v2:21/24. The remaining three fixtures were correctly rejected by the actual native validator/profile guard: source binding spread role/trust into an exact native binding; admit/checkpoint omitted profile and stable batch.

Focused v3:27/29. Two new assertions guessed the original ledger response enums. Actual source uses inflight on reserved replay and dispatch_pending after checkpoint. Corrected both to exact original transitions and added an explicit second-checkpoint denial of dispatch/replay. Final affected receipt contains all29 new tests passing.

Earlier type failures from the Auth author's combined tree are retained there. New test corrected its schedulable function reference to explicit mutation and narrowed actual module keys with literal unions. Final root tsc here exits0 with the frozen new test. No any cast or disabled flag was added.

## Check scope, tooling and exclusions

Node24.15.0 at the pinned runtime path; npm12.2.0 manifest/toolchain requirement is retained. Offline explicit Jest configuration avoids environment-file loading and service setup, with CONVEX_URL pointing at127.0.0.1:9. Discovery lists18 suites: memory entries/repository/profiles/services/public boundaries/functional closure/vector delivery; ingestion context/permissions/cache compatibility; client admission/observation/delivery; model admission/drift/profile selection; raw authority scope dependencies. Types cover the backend, root and lint project; ESLint covers the four owned source/test files only.

Source changes add no file to the distribution closure and change no generated bindings, versions, artifacts, current deployment, Proofs, docs or provider. No parallel source/fact/vector restoration, bare Promise.all, order change, new endpoint, paid retry or guard skip was introduced. User latency goal remains unmet.

## Frozen hashes

- `convex-dev/runtimeMemory.ts` SHA256 `14889e44b160386fdcbb16fe4bc81dad668521fed7223c78f924ed36945bcd24`
- `convex-dev/runtimeModelPolicy.ts` SHA256 `865ed4d1d7d2c5fe5beca6f81dd9063382b8b4f626816b40b4e00860944f0eef`
- `convex-dev/runtimeClient.ts` SHA256 `55fdfe9ce6e6d23535655c493ae6e25a0155b54d582806dc6b0c5a59295cfde2`
- `tests/unit/runtimeMemory/authority-scope-entries.test.ts` SHA256 `c117fba18c3bab7432df2bba520afae678eab24d7e092f79f1e1359bc2e0097e`
- `cloud-recall-authority-entries-checks.json` SHA256 `330495c80e437c43eaae68308a383af672ef4a692aa2998ffa907592924b4118`
- `cloud-recall-authority-entries-equivalence.json` SHA256 `759533bf675ff6c3b5f1c84ba0fcb65d056b25a60ac30d3f5b368b2724a589dd`
- `cloud-recall-authority-entries-affected-v1.json` SHA256 `f649813266c8e3b82cd88d5a8272fc01cbb13280a967bc2cf519e12d1d7472ed`
- `cloud-recall-authority-entries-fixture-counts.json` SHA256 `9290c3131bdc480863cde9954184481a7c7d9d181b4cf80a48f3fd2ac1020124`

Pending root activation decision is the concrete remaining source acceptance issue. All original tests, raw failures and earlier installed K11 outcomes remain preserved.
