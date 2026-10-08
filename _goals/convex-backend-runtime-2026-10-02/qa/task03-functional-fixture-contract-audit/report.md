# Independent functional fixture contract audit

Scope: read-only production/C10 candidate inspection plus isolated synthetic native-handler probes. This is a technical audit of the C10 functional expectations, **not a fresh C11 preparation judgment**, actual service qualification, or aggregate foundation PASS. No services, credentials, signatures, deployments or source/candidate writes occurred. Numeric cycle limits alone were waived; original Task03, sequencing, independent gates and approved product scope remain.

## Findings

1. **Two confirmed C10 fixture defects.** `convex-dev/admin.ts:15` always returns the object `{ deleted: boolean }`, but C10 `cases/metadata-worker-domain.mjs:158` and `:186` require literal `true`. The native helper returns `false` for an absent supported row (`runtimeWorkerAuth.ts:182`, `:188`, `:192`), and the registration wraps that as `{deleted:false}`. The exact repair is strict `deepEqual(receipt,{deleted:true})`, accompanied by absence of the exact owned row. A truthiness check would incorrectly accept `{deleted:false}`. The graph case currently lacks an explicit post-admin row-absence assertion at :186; add one. Do not alter the source deletion, failed worker access, snapshots or revocation assertions at :180–185.

2. **The schema-only MWD check does not execute functional descriptors.** `work/backend-runtime/task03-foundation-live-c10/offline-mwd.ts:18–24` validates collected seed objects against actual table validators, compares ledger schemas, and checks descriptor/registration counts. It never invokes `descriptor.cases[].run`; `collectOfflineFixtureRows` at MWD :263–266 collects only selected seed shapes. Its receipt is appropriately marked `OFFLINE_AUTHOR_ONLY`, `liveStatus:NOT_RUN`, but it cannot establish agreement between native return values and functional expectations. A bounded native admin receipt/effect regression is therefore meaningful and necessary for this correction.

3. **A timing assumption can fail separately.** MWD :177 expects one deletion immediately after `markSynced`, passing `olderThanMs:0`. Native `graphSync.ts:122–123` selects `syncedAt < Date.now()-age` through `selectedItems` :22, a strict boundary. The in-memory probe initially observed `deleted:0` when both operations shared one millisecond. Advancing only the synthetic probe clock allowed the original unchanged descriptor to reach the confirmed receipt failure at :186. This is a fixture timing concern, not a return-shape mismatch or demonstrated live defect. Future offline reuse should ensure the row is strictly older before asserting deletion. A bounded live clock check can be added if actual qualification exhibits this flake; do not weaken the deletion assertion to accept zero.

## Observed native-handler probes

`work/resume/functional-fixture-contract-audit/probe.mjs` bundles current native registrations and `tests/unit/runtimeMemory/fixture.ts`; it extends that actual fixture DB with persistence-only patch/delete, filter comparison and order support. All fixture content is synthetic. Native handlers and original C10 descriptors are unchanged. Arguments are passed directly to `_handler`, so this is not Convex wire argument/ID validation. No graph adapter, vector search service, inference or WebSocket transport is involved.

| Probe | Observed outcome |
| --- | --- |
| Native admin delete of owned policy | Strict `{deleted:true}`; policy and policy-linked governance log absent; unrelated log preserved |
| Native admin repeat delete | Strict `{deleted:false}` |
| Original literal boolean assertion on native receipt | Throws `ERR_ASSERTION` |
| Native admin unsupported facts deletion | Exact `UNSUPPORTED_OPERATION`; full DB unchanged |
| Original C10 graph descriptor with advancing synthetic clock | All original assertions through :185 pass; :186 fails on native object receipt, with queue row already absent |
| Original C10 domain-owned/current-reference descriptor | PASS: actual six native internal handlers, including all original tombstone and grant-revocation assertions |
| Original C10 domain-policy-intermediate descriptor | PASS: ten owned/foreign/foreign-owner/ownerless/missing closure calls and three unauthorized capability/scope controls |

Machine observations: `results.json` in this QA directory. The native probe script and bundled intermediate stay in the audit scratch directory.

## Remaining contract reconciliation

Graph: `queueForSync` returns a string ID (`graphSync.ts:58`, `:61`); duplicate replay returns that same ID. Query helpers return arrays (:93–103), statistics return an object (:112–116), and clear returns `{deleted:number}` (:129). `markSynced`, `markFailed` and `deleteSyncItem` have void native returns; the fixture correctly checks persisted effects, not a success boolean. Workers require current TOOL and READ authority and canonical owned fact/source records. `runtimeWorkerAuth.ts:104–138` performs source/fact checks, digest validation, independent current authority checks and final canonical reloads. After source removal, original fixture :182–184 proves no mark/delete/reenqueue and no recreation; :185 proves revoked grant denial. Admin cleanup intentionally has operator authority and does not require the deleted source; it removes queue metadata, not source controls. The strict object repair preserves these boundaries.

Domain: `runtimeMemoryRepository.ts:27–31` declares the native adapter shapes: authority object, nullable source, `{source,created:boolean}`, `{receiptId,created:boolean}`, fact array and vector-match array. Native implementations return those shapes at :99, :114/:120, :135/:218, :271 and :297. Original MWD :192–218 agrees. New derived receipt with empty derived output is a real receipt-only commit, not an extraction/model success. Synthetic chunk/vector hydration is a native DB hydration test, not actual managed vector search. Tombstoned sources hide derived facts/vector matches (:226–235) and stop later write/admission/derived commits; revoked grants deny all six handler classes. The unchanged descriptor passed these exact assertions in the audit.

Foreground domain: Original MWD :233–242 uses uniform fixed `CAPABILITY_UNAVAILABLE`, `not_dispatched` envelopes and whole DB comparisons. All ten variants passed native action handlers. This remains intermediate safety acceptance under the sequencing contract and cannot certify functional inference/retrieval.

Authority: `scripts/auth-boundaries.mjs:7–26` expects mutable readable rows for READ+WRITE principals, only a truthy write receipt for writer-only principals, then verifies stored values in snapshots before grant expiry. Scope/grant/membership lifecycle handlers are awaited for effects, not assumed boolean returns. Native `runtimeAuth.ts:355–408` revokes/deletes by patching versions/epochs and control tombstones, returning void. No remaining shape mismatch was found. Actual timed expiry and membership revocation require the live stage; the offline domain probe cannot certify these separately. The membership schema has no expiry field; do not invent coverage for membership expiry.

SDK: `scripts/lifecycle.mjs:23–46` correctly expects mutable readable rows, refresh requests, empty authorization headers after null/logout, and frozen `{code:'HOST_TOKEN_FETCH_FAILED',attemptId:positiveInteger}` callback objects. `src/auth/credentials.ts:140–169`, :193–211 backs those shapes. Writes are verified with a subsequent native get and revoke is checked via denial plus complete no-effect snapshot. No admin boolean receipt assumption appears here. Reactive logout, late-token suppression, cross-tenant subscriptions and recovery still require real WebSocket observations. Source inspection and fake transports cannot establish their outcome.

## Evidence boundary

C10 retained actual execution reports all 1400 identity negatives, 200 complete no-effect controls, 262 closures, 118 visibility cases and 122 memory/registry/artifact scenarios PASS, plus the first four MWD scenarios. The next governance scenario remains FAIL. The remaining graph/domain/policy, authority and SDK stages are incomplete/NOT_RUN in C10; supplemental native audit PASS does not retroactively complete them. The retired sole target was project 3138098, bright-donkey-547, DELETE200/GET404 at 2026-10-04T00:26:17.254Z, as recorded in the retained C10 failure packet. No successful live payload was inspected or republished in this audit.

Recommended correction scope: the two strict receipt assertions, exact graph-row absence, and native admin receipt/deletion/no-effect regression. Preserve C10 failure evidence, every passing scenario, original Task03 scope and all acceptance gates. Then a fresh independent preparation judge and complete actual qualification are still required before aggregate foundation acceptance or Task04.
