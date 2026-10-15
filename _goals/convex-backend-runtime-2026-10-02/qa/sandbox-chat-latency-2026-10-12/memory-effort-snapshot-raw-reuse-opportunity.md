# Snapshot raw-reader reuse opportunity

**Already implemented on the ordinary V8 path; no new material safe reuse patch established.** `freshManagedSourceValidation` (`runtimeAuth.ts:163`) returns its context unchanged whenever it already carries an authority reader. `withNativeSnapshotReads` (`:186`) validates the native owner and passes that same reader to source/witness views. `createAuthorityReader` (`:696`) then returns the retained reader. Starting a new `managedSourceIsCurrent` traversal creates fresh cycle/work/verified bookkeeping, not a new raw principal/grant/scope/tombstone cache on this path. Every permission, source/currentness and deadline predicate still runs.

`prepareReadsV8`, `readMatchesAndDeliveryV8` and `contextInputsAndEmbeddingV8` already use this owner/view chain. Their native source getters, fact/vector selection and traversal callbacks share successful cloned raw authority values within one invocation. Later RPCs get new scopes; final raw authority and delivery deadline checks deliberately use the original unscoped native context; final managed graph reads explicitly reset. Writer epochs/invalidation remain intact.

Previously saved controlled test evidence confirms this exact existing mechanism:

| Fixture | Plan authority calls old→current | Tail authority calls old→current | Documents plan / tail old→current |
|---|---:|---:|---|
| shared ancestry | 60→26 | 179→43 | 52→32 / 131→63 |
| unshared ancestry | 68→30 | 199→47 | 54→34 / 135→67 |

These are existing controlled fixture results from the final dependency log, not new runs, live600-document attribution or hosted latency. The existing test (`whole-recall-composition.test.ts:797`) requires exact result/state/read identity set and a raw final grant read; adjacent cases retain source/hash/tombstone/duplicate/revocation/expiry/profile/fact refusals and later independent-save invalidation. Root's actual tool6.862s versus old6.804s remains no speed gain.

One legacy `runtimeMemory:readFacts` binding helper still uses the graph-only view and traversal-local readers (`runtimeMemory.ts:51`). Current ordinary V8 CLI/Chat and native approved-tool paths do not use that helper; it cannot explain their observed chain. The cache also does not coalesce concurrent initial misses, but currentRead warms shared authority before the prepare branches, and no saved per-key trace establishes material residual duplicate misses. Neither is a justified new common optimization batch.

The600-ish official total includes several separate native invocations and derived/source/control/financial rows. It does not show authority-key multiplicity. Keep all external-I/O, writer, expiry, independent native and final delivery fences cold. No source/tests/helpers were edited; no tests/builds/services/models/Git operations ran. Companion JSON records inspected hashes and existing evidence.
