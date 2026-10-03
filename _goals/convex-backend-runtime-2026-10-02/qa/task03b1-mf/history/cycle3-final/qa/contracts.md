# Task03B1-MF scoped data guard freeze, repair cycle3

This candidate covers only the42 existing memories/facts registrations. Cycle1 remains
REJECT3.0/5 and cycle2 FINAL REJECT3.2/5; fresh third independent judgment is pending. Whole Task03
still needs03B1-T,03B2 and03C. The frozen03A catalog remains historical and unchanged.

## Shared API

`convex-dev/runtimeDataAuth.ts` exports:

- `ScopedDataAuthority`: trusted RuntimeAuthority with required concrete memorySpaceId/epoch.
- `requireDataAuthority(ctx, {tenantId?,memorySpaceId?}, capability)`: reload verified
  identity/current control records. Omitted selectors derive one trusted scope; raw
  tenant-wide grants can derive one undeleted registered concrete space, otherwise deny.
- `recheckDataAuthority(ctx, storedReference, capability)`: current trusted background
  generation/scope/tombstone checks; references are not public bearer credentials.
- `requireActionDataAuthority` / `recheckActionDataAuthority`: typed references to actual
  internal runtimeAuth registrations, inheriting Convex-verified auth; no caller JWT.
- `assertOwnedResource(ctx, authority, RuntimeCapability, canonicalResource)`: requires
  stored owner even for space/tenant access and rechecks independent capability/lifecycle.
- `bindDataActor`: actor label must equal trusted operator metadata binding, otherwise deny.
- `getScopedMemory` / `getScopedFact`: actual composite tenant+space+application-ID queries
  plus owner DB predicates before unique hydration, followed by source/resource/link checks.
  `getScopedFact` accepts an optional expectedVersion before the private witness collection and checks each requested edge
  before recursion. The active path is cleaned in finally; cycles deny and repeated DAG
  nodes are validated again instead of skipped.
- `listScopedMemories` / `listScopedFacts`: actual tenant+space index and owner/tombstone DB
  predicates before materialization; stale/unprovenanced candidates never reach handlers.
- `searchScopedMemories` / `searchScopedFacts`: actual search-index tenant+space+own-owner
  filters before keyword hydration, followed by current source/tombstone/link checks.
- `getScopedMemoryDocument` / `getScopedFactDocument`: scoped DB selection for storage IDs,
  not global `get(id)` before checking a different canonical application-ID row.
- `assertDataLinks` / `assertDataRow`: canonical conversation/message, fact/version,
  source memory, immutable/mutable, current source and permanent deletion fences.
- `CanonicalSourceWitness`: private immutable full runtimeMemorySources snapshot (including
  storage identity/creation time, tenant/space/owner, complete source/event/revision/role/
  trust/tool-operation tuple, content/hash and creation/deletion timestamps). Lineage is
  copied and frozen before crypto, avoiding aliases to mutable fixture/database rows.
- `recheckSourceWitnesses`: reauthorize current source controls, reload the actual scoped
  canonical rows plus scoped/tenant-wide source tombstones after all crypto, and compare
  every witness field. No further hash follows that final reload. Pinned grant lifetime is
  checked synchronously after the last await. Repeated source witnesses must be identical.
- `finalizeDataRead`: final read/source witness barrier for multirow history, keyword/list
  selection and internal hydration. Earlier candidates cannot become stale while a later
  candidate is hashed and then be delivered. All canonical selected resource controls
  are reauthorized after the last candidate hash, before the final source/lifetime fence.
- `manualSourceKey`: canonical identity from trusted tenant/space and server binding.
- `ManualSourceBinding`: server-only `{resourceType:"memory"|"fact",resourceId:string}`
  optional column on memories/facts. Public validators do not accept it. Arbitrary caller
  metadata and the frozen DerivedFact DTO cannot grant a source binding. New fact versions
  retain the original dedicated fact family binding.
- `manualDataSource(ctx, authority, binding, text, owner?, role?)`: canonical runtimeMemorySources row with
  server ownership and user/user_assertion or assistant/assistant_claim provenance.
  Both source and event identity collisions deny without writes.
- `reviseDataSource(ctx, authority, row, text, newResourceId?)`: same-transaction current
  lineage CAS returning `{lineage,manualSourceBinding}`. Dedicated revision requires the
  exact server binding, full source tuple and owner, plus manual-assertion-v1/manual policy
  for facts. A manual: prefix cannot prove exclusivity. Unbound extracted/shared memory,
  transcript or tool fact edits create a separate user assertion source instead of changing
  the original source or sibling resources. Their original admitted source witnesses
  remain pinned while the separate assertion is hashed and created. Invalid existing
  server bindings deny.
- `memoryMutationResult` / `factMutationResult`: independently resolve current read
  authority before returning a hydrated row. Write-only success is a typed
  `{mutationReceipt:true,operation,memoryId? or factId?}` response containing the caller's
  resource selector or a newly created ID. Read denial never grants read via write.
  A failed read check on a read-capable writer propagates. A read-less writer's receipt
  still requires final current write authority, canonical row/source integrity and all
  link/lifecycle checks. Revocation, expiry, deletion or corruption after preparation
  aborts and rolls back. Hash computation is followed by fresh source/resource authority
  checks before source revision and private delivery. The CAS retains the full original canonical
  payload and performs the final WRITE/resource/source barrier before patching; valid
  independently replaced content/hash with the same revision cannot be overwritten.
  Independently admitted READ refs remain pinned through delivery, including a tenant READ
  grant distinct from the space WRITE grant. After the last WRITE/hash check, a shared
  delivery barrier rechecks both generations and synchronously inspects both current grant
  lifetimes after its final await. No private data is returned after admitted READ expiry/
  revocation, and no admitted READ failure is downgraded to receipt success.
- `MutationRowsReadAdmission` / `canReadMutationRows`: return pinned preflight READ targets
  plus all admitted canonical source witnesses and discloseIds, rather than a detached
  permission boolean. `prepareMutationRowsWrite` retains the same WRITE/source preflight
  for count-only or caller-ID delete paths without resolving or granting READ. Each independent READ is
  retained for the final barrier. Write-only bulk returns count + mutationReceipt.
- `DataDeletionProof` / `tombstoneDataRow`: a private server proof records the exact canonical
  resource, tombstone storage ID/deletion timestamp and full immutable tombstone payload
  created by this mutation. Single-row and caller-ID delete paths also retain WRITE/source
  fences before success. Existing
  tombstones deny; public args/metadata never accept proofs.
- `finalizeMutationRowsRead`: verifies each deletion proof against the unique exact current
  tombstone and the already authorized targets, then rechecks the pinned READ/WRITE refs and
  their current lifetimes. A delegating AuthorityReader ignores only the exact matching operation-created scoped
  tombstone with its unchanged storage ID/creation time/scope/resource/deletion payload.
  The full resource requirement is always retained; tenant-wide resource tombstones and
  all source row/control tombstones remain authoritative. Scope/owner checks use the
  predeletion canonical targets, and their admitted full canonical sources are reloaded
  after the final async checks. Public validators never accept proofs or witnesses. Late independent READ revocation,
  expiry or deletion rejects and rolls back rather than hiding behind valid WRITE authority.
  No deleted row is hydrated or returned. updateMany admits READ after its writes; an already
  read-less admission can therefore safely return a count receipt.
- `dataEditor`: typed server runtimeEditor column from verified authority, never metadata.
- `tombstoneDataRow`: retains row and authoritative runtimeAuthTombstones fence permanently.

Only read/write-scoped data selectors use the MF row APIs. Other modules may need
un-narrowed tenant authority for tenant-only metadata resources. The generic owned
resource guard accepts every explicit RuntimeCapability; admin remains independent.

## Source, actor, deletion and historical policy

Fresh explicit facts use the one authoritative facts table plus a canonical manual
source, user_assertion lineage and manual-assertion-v1 policy. Caller tool/system/source
labels cannot create verified tool evidence. Explicit agent memories and streaming
partial/finalized memories retain assistant_claim lineage. Assistant-derived claims are
excluded from current fact get/list/count/keyword paths.

Public writes derive owner/tenant and bind user/participant/source-user actors. Existing
owner remains canonical on cross-principal edits admitted by trusted space/tenant access;
optional typed runtimeEditor records the actual current editor. Caller metadata keeps
its shape and cannot overwrite that server column. Old fact versions retain their
original editor when a new content version is created.

Missing owner/tenant/provenance is never adopted. Normal reads and writes require exact
current source lineage, owner and positive revision. Every canonical source used by a
current or historical read/revision must already be normalized NFC/LF/outer-trim and have
the exact semanticHash of its actual content. Immutable full source witnesses are then
reloaded and compared after the last crypto/authorization before read delivery, CAS or
bulk completion, without hashing again after that reload. Corrupt hashes are rejected, never repaired
by a public edit. Canonical source identities/lineage/timestamps satisfy frozen SourceContent
invariants. Empty/whitespace-only manual text produces typed INVALID_INPUT before insertion
or revision, including partial/finalize writes. Source/resource/scope deletion and
revocation fence later stages. Query executions reload authority for subscription
reevaluation. Keyword actions recheck after admission and perform final scoped candidate
hydration after filtering, so deletion/revocation between stages prevents delivery.

`getHistoricalScopedFact` is exclusively an audited-history reader. Its typed view adds
`historical:true`, `stale:boolean`, `currentSourceRevision:number`. It verifies current
source lifecycle/ownership, normalization/hash and exact source event/role/trust/tool-operation identity;
only a positive revision no greater than current can be historical. It never feeds
get/list/search/context/write selection. Missing/foreign/tombstoned history peers deny;
cycles deny. Raw historical provenance is retained, not relabeled current.

All supplied reference selectors are validated together. Message IDs require their own
nonempty conversation anchor; empty IDs/anchors, conflicting anchors, foreign messages,
and mismatched conversation/memory selectors deny before writes. Supplying one valid
selector cannot mask another invalid selector. Stored references are rechecked on reads
and edits, including partial/finalization paths.

Archives remain reversible tags; deletion creates permanent tombstones. Purges are
internal deployment-operator maintenance and preserve auth/source tombstone control
records. Their existing environment check remains a secondary safeguard, not authority.

## Qualified semantic boundary and downstream work

Unqualified legacy embedding arguments at memories.store/update/finalize/search and
facts.store/update/semanticSearch return typed PROFILE_NOT_READY after authorization,
before vector dispatch. No old embedding is assumed to have the new profile, and no
paid query embedding or silent keyword fallback is introduced. Registrations stay public
for Task09/10 to wire the qualified clean-slate runtimeMemoryVectors retrieval path.

Task08 still owns durable source enqueue/ordered fact history/readiness/outbox. This gate
provides atomic source CAS and stale-data exclusion, not that pipeline. Task03B1-T/03B2
must consume these independent-read mutation response semantics if returning private data.
Task08 must use the trusted runtimeEditor as the actual actor/audit attribution when a
cross-principal edit becomes ingestion input; canonical resource/source ownership alone
does not identify the editor. The reviewed SourceContent schema is unchanged. Third repair changes no schema; the
current combined schema includes the parent's separately reviewed Task03B2-D integration.
MF's prior12 approved additive lines remain unchanged. Parent integration baseline is
cd5671449beb64ed1ca4a284a761cad60ab70525; no MF staging/commits occurred.
Task03B1-T/03B2
must add trusted fresh ownership for linked conversation/immutable/mutable resources;
existing linked rows lacking those fields fail closed. MF rejects linked conversation
participant spaces outside its concrete scope. Task05 owns canonical Agent transcript
routing. Parent-owned authorized codegen/deployment and03C actual subscription/JWT
negative tests remain pending; fixture evidence does not certify live services.
