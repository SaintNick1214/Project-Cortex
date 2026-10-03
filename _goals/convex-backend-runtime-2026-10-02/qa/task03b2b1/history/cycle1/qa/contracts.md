# Task03B2B1 independent registry/context closure contract

This is the bounded46-registration slice on isolated `a2c9827783e9dd49b9811a2899ba4acbeadc21cd`.
It consumes frozen03A directly and imports no unreviewed MF, metadata or worker bridge.
It is not whole03B2B52, wholeTask03 or wholeGoal certification. Stats2 and A2A4 remain pending.

## Trusted admission and actual row selection

Every selected public registration remains public and begins from Convex-verified exact issuer/subject,
current principal/membership/grant generations and current tenant/space epochs. Omitted selectors
must derive exactly one eligible trusted scope. There is no old global fallback or ownership adoption.
Agent configuration/metadata, caller user/agent labels, participants and descriptive grantedAccess
never create or authorize trusted control records. Agent registry writes require independent WRITE
and ADMIN; registry reads of configuration metadata require independent READ and ADMIN. Space
registry mutations require independent WRITE and ADMIN. Context domain operations require their
actual READ/WRITE capability, with independent current authorization for every actual cross-space edge.

Ordinary delivery, hierarchy and bulk candidate queries constrain trusted tenant/actual space and
canonical owner in the database before hydration. Lists verify eligible canonical candidates before
filters/pagination; counts never scan deployment data. Tenant-wide space/context selection enumerates
trusted control scopes and independently admits each actual space before selecting domain data.
Missing/empty owners deny targeted operations and never become caller-owned. Descriptive native
v.string fields may remain empty; resource/link identifiers and stored trusted actor IDs independently
require meaningful nonempty strings. Tombstoned metadata is retained
and excluded by scoped list predicates; targeted access cannot revive it. Agent labels use source
resource IDs `JSON.stringify(["agents", agentId])`; tenant/optional-space are separate tombstone key fields.

Convex1.46 has no indexed existence/count projection. The authorized, exact-key Boolean collision
exception necessarily fetches server documents, immediately discards the payload and retains only
existence/uniqueness. Create/register rejects any existing key. Mutation preflight after normal
owner-filtered admission rejects nonunique exact keys, including a foreign/unowned collision that
would share a tombstone namespace. These probes never use payload/owner/config for admission,
processing, canonical selection, logs or delivery; their Boolean witnesses remain through final
checks. There is no claim of zero foreign hydration for this narrowly documented exception. Ordinary
read/delivery/hierarchy/bulk candidate selection retains owner predicates. Fresh independent judgment
must assess the exception; it is not an unscoped scan or an adoption path.

## Retained reads, whole-transaction preflight and fences

An initial ineligible READ on a private write-return path yields only `{accepted:true,resourceType,
resourceId}`. If READ was admitted, its exact immutable reference is retained independently from
WRITE/ADMIN and late failure denies/rolls back. No late failure is downgraded to a successful receipt.

RegistryAccess retains every admitted scope/resource reference and the first canonical snapshot for
all referenced rows. Repeated admission cannot overwrite/rebind a previous witness. Intentional
writes update only their expected snapshots. Inserts retain the validated locally computed application
payload and native returned ID before any subsequent awaited check; server-assigned _creationTime is
excluded only from this initial expectation. This also applies when initial READ is unavailable.
The official Convex1.46 convexToJson codec validates native values and normalizes object-key order
while retaining every exact application field, array order, bytes/int64, special float and signed-zero
value; a post-insert reread cannot replace the original expected payload/owner/lifecycle. Final bounded matching sweeps recheck all capabilities
and witnesses, including earlier links after later admissions. Convex supplies one atomic query/
mutation snapshot; the transaction fixture also exercises adversarial awaited seams and rollback.

Bulk targets fully preflight duplicates, collisions, missing/foreign owners, tombstones, persisted
native schema shapes, native Convex-serializable input, version/history overflow and all graph links before the
first write. No catch-and-continue suppresses a target or database failure. Agent/context retirement
retains locally computed canonical retired-row snapshots and exact timestamped resource tombstone
witnesses through the final barrier; it removes only each intentionally invalidated exact resource
reference while keeping all independent scope/grant references. Operator purges are native internalMutation
registrations; they retain canonical/source/auth/control barriers and cannot be invoked through api.

## Context hierarchy and revisions

Every referenced root/parent/child/sibling/ancestor/descendant is selected only from independently
admitted current actual spaces, must have exactly one canonical match, and retains actual owner,
version, lifecycle, root/parent/depth and child topology through the final barrier. Full root graph
preflight bounds100 nodes and depth100; cycles, duplicate edges/IDs, missing/foreign links, mismatched
root/parent/depth, stale rows or an ambiguous cross-space match deny the entire operation. Missing
parents are not delivered as a partially authorized orphan graph.

Descriptive access edges also require a current independent target-space grant and canonical target
space metadata. grantAccess writes description only; it never provisions a membership/grant. Context
participants remain arbitrary audit/discovery labels. Child creation, ordinary edits, participant/
access changes, hierarchy repairs and retirement create attributed revisions. New current writer
lastUpdatedBy derives verified principalId. An archived revision retains its own persisted writer;
missing prior actor stays unknown. No owner/space/caller label is fabricated as its prior editor.

Orphaning repairs every affected descendant root/depth and parent child list. Cascading and overlapping
bulk deletion preflight the whole graph and retire each canonical row once. All revision plans,
including retired targets, validate history/safe integer limits before effects. Export/history routes
verify the same canonical graph and do not authorize historic/source references from metadata.

## Space deletion and downstream pending work

Space deletion requires the actual canonical owner/access, current WRITE plus ADMIN, a matching optional
confirmation ID, cascade=true and a nonempty reason. It retains canonical metadata, writes a memorySpace
resource tombstone and increments/deletes the exact trusted space scope. Principals/memberships/grants,
tenant scopes and every other control/source remain. Both space grants and tenant-wide grants are
blocked on later access/bootstrap/registration. Operator provisioning cannot revive a deleted scope.

The final deletion check recognizes only this transaction's exact expected new scope epoch/deletedAt
and matching tombstone timestamp, while rechecking principal/membership/immutable grants/tenant and
all other resource fences plus retained canonical witnesses. It does not admit a subsequent operation;
that operation must open() and fails on the retained deleted scope before obtaining this access object.
Late principal/grant loss after intentional fence writes rolls back the mutation.

No raw conversation/memory/fact/storage cascade occurs here. The receipt explicitly reports cascade
status=pending, zero derived deletion counts and pendingTasks08/12/15. Durable derived cascade and
actual byte/service lifecycle are pending and cannot be called complete from this slice.

## Conversation structural seam and honest limitations

Current conversations schema lacks a trusted canonical owner. ConversationRef/getByConversation
therefore fail closed before any raw conversation query/hydration, even if legacy messages contain
matching IDs. The independently typed TrustedConversationMetadata seam allows only scoped owner/
lifecycle plus message-anchor metadata; no content, raw reasoning, system/private tool fields,
credentials or arbitrary metadata projection is permitted. Task03T/05 must implement canonical owner,
current tenant/actual-space lifecycle and every requested unique anchor before any delivery. No live
canonical conversation or anchor/projection success is claimed here. Contexts without such a source
remain fully guarded and available. Transcript locking/canonical Agent routing stays Task05.

Excluded agents:computeStats and memorySpaces:getStats registrations remain byte-for-byte unchanged,
are explicitly pending, and are never executed/read/certified by the selected tests. A2A4 is untouched.
No live/paid/Docker/deploy/codegen/build/package/stage/commit/push operation occurs in this checkout.
SDK receipt adaptation and internal purge test consumers remain Task03C2/09 integration work; root
compiler diagnostics are reported separately from this bounded ES2021 backend/test gate.

## Native descriptive values and specification correction

Registry config/metadata and context data retain their actual native v.any contract. The official
Convex1.46 value codec validates these unknown values and supplies deterministic exact witness/export
encoding, including signed int64 BigInt, ArrayBuffer, NaN/Infinity and signed zero. Ordinary JSON-like
values remain available. Date/Map/classes/cycles, unsupported native object fields and out-of-range
int64 deny before effects. There is no invented depth50 restriction or JSON-only payload grammar.
The sole narrow Value cast is at this unknown-value codec validation seam; it grants no authority
and hides no receipt type. Meaningful versions/counts/lifecycle audit timestamps retain their explicit
finite/safe-integer semantics. Context record patches merge records, while native non-record root
values replace explicitly; descriptive-only edits preserve the root. Space archive preserves native
non-record metadata; only record metadata receives descriptive archive fields.

The old JSON-only assumption incorrectly denied Infinity in arbitrary config. Its prior passing and
failed receipts remain under checks/history-json-contract-specification-correction and earlier history.
That assertion is specification-corrected rather than retained as a required denial: the original
v.any contract had no approved JSON-only restriction. Native-valid round-trip controls, deep-native
object controls, exact binary/int64 witness change rollback negatives, and native-invalid class/cycle/
int64 overflow negatives replace that invented expectation. All original authority, scope, ownership,
whole-preflight and zero-effect/rollback outcomes remain required. The native transaction fixture uses
the same official value codec for backend-realm values and actual undefined patch deletion semantics.
