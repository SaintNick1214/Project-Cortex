# Bounded03B2C1 text artifact contract

This closes only the original22 selected artifact registrations:21 guarded public
metadata/text CRUD, history, versions and streaming-state APIs;1 internal operator
purge. `catalog/public-path-inventory.json` records the exact native AST inventory.
Whole C2 remains pending: five unchanged artifact file registrations and twelve
unchanged attachment registrations. Task12 owned uploads, reference-aware files,
private byte delivery, Agent/media outputs and live qualification remain pending.
No partial C2 closure authorizes deployment.

## Authority and canonical selection

The independent adapter imports only the accepted03A `runtimeAuth` policy and
`src/auth/verified` contracts. It does not import memory/fact, metadata, registry or
worker guard machinery or their fixtures. Their current sources and earlier review
verdicts are not adopted as authority for this slice.

Every public handler requires the exact Convex-verified issuer/subject, trusted
principal/membership/grant generation, explicit read or write capability and one
eligible registered tenant/space. Omitted selectors derive one eligible concrete
space; no global scan, orphan fallback or ownership adoption exists. An optional
`memorySpaceId` selector was added to APIs that previously only accepted tenant/ID.
A tenant-wide grant must narrow to an explicit registered concrete space.

Actual artifact queries constrain trusted tenant and space, then canonical owner,
application key and lifecycle before collect/hydration/limit. Own access excludes
other owners; explicit space/tenant grants may access another canonical owner.
Known resource tombstones deny before payload selection, and lists/counts exclude
retained tombstone keys before hydration. Independent linked READ is captured before
private source queries. Every candidate and retained version is validated and every source link is checked
before count, pagination, output or effects. Missing canonical ownership denies.
Caller user/participant/metadata/kind/stream-source/config labels confer no grant;
create derives user/owner, all mutations derive last actor, new versions derive
changedBy, and deletion derives deletedBy from the actual verified principal.
These are authenticated manual artifact operations, with no inference, budget
assumption, canonical transcript writer or duplicated SDK loop.

Creation's collision fence queries only exact trusted tenant/space/application key,
returns a Boolean conflict and immediately discards the full server document.
Convex lacks an indexed Boolean projection. The document's payload/owner does not
enter authorization, private processing, logs or delivery. Retained IDs conflict
opaquely and cannot be recreated.

## Admission, links and finalization

Write admission captures WRITE and an independent READ decision before effects.
Initially unavailable READ returns only `{success:true,artifactId?}` after an
admitted write; it is never retried after writes to adopt newly gained privilege.
Create captures exact resource READ/WRITE from its locally expected row before
insertion, and no admitted READ witness is ever removed. Resource READ owner denial
can produce a safe receipt before effects while preserving the admitted scope READ
grant. Initially admitted READ/WRITE requirements pin the exact principal, membership,
immutable grant versions, epochs, capability and canonical resource. A later failure
denies the mutation and Convex rolls back effects. Read queries re-evaluate grants
on every execution, including subscriptions; actual live subscription evidence is
pending03C.

Typed linked-row witnesses retain exact canonical conversation or memory scope,
owner, lifecycle, READ requirement, full source snapshot and requested message
anchor. Repeated sources must match the first immutable snapshot, and only locally computed
artifact patches can advance an artifact witness. Every typed source/anchor/version
edge remains independently retained. Later candidates cannot replace earlier witnesses. Conversation lookup
checks a real scoped canonical row, rather than merely matching an artifact label;
requested message IDs must identify exactly one canonical message. Canonical source
isDeleted/deletedAt/tombstonedAt predicates apply before private hydration. No private
message content, reasoning, tool output or injected context is delivered or copied
into artifact payload by the link adapter. The current conversation schema lacks trusted ownerPrincipalId.
The structural owner predicate therefore denies real current rows before messages
are hydrated. Tests explicitly supply a typed fresh trusted owner seam; they do not
certify live conversation/Agent readiness. Full canonical adapter routing remains
03T/Task05. Existing memory links similarly require trusted ownership and current
source controls; no unreviewed memory fixture is adopted.

Every checkpoint reloads full expected canonical row snapshots and all retained
trusted controls, then replays the accepted03A policy against that transaction
snapshot. Expiry is evaluated after the last DB await and checked synchronously
again after local policy awaits. Convex's serializable query/mutation snapshot
provides consistent row/control reads; the adapter does not claim cross-service or
nontransactional atomicity. Expected writes are computed locally; changed inserted
or patched payloads are not adopted. Full owner/version/link/anchor snapshots,
resource tombstones and scope/grant generations remain pinned through completion.
Full row/message payload witnesses use the official Convex native codec, preserving
int64, bytes, special floats and object-key-order independence. Typed control/selector
keys are separate tuples with explicit optional scope. Codec errors never include
private values; expected insert/patch payloads are serialized before effects.
Arbitrary native-valid v.any metadata remains supported; no JSON-only restriction
is inferred from witness serialization.

## Text lifecycle and files

Text update preserves history branching; undo/redo navigate real versions including
gaps; purge preserves initial/current/latest versions; stream start/append/pause/
resume/cancel/final/error/retry retain meaningful state/content/history behavior.
Canonical version numbers and pointers, history order/uniqueness, input pagination,
retention counts, byte progress and version overflow are safe-integer validated.
Illegal state/session transitions deny before effects.

Any current or retained file version is beyond this text slice and returns typed
`CAPABILITY_NOT_READY` before mutation, private file processing or storage effects.
No selected delete/purge/history/undo path deletes file bytes. Read-only file
metadata has no ownership/private-delivery claim; this slice denies file-bearing
payloads conservatively. The five original file registrations are byte-identical,
unaccepted and explicitly pending full C2/Task12 admission.

Public deletion retains the canonical row, trusted owner, link/history metadata and
resource tombstone. Both hard and soft selectors produce a retained, nonrestorable
lifecycle fence; hard deletion does not bypass retention or erase controls.
Internal purge requires exact tenant/space and Convex trusted deployment-operator
internal invocation; JWT admin claims or deployment URL names are not credentials.
It preflights the entire batch for files, links and canonical text state before the
first mutation, tombstones rows and retains all existing control/foreign records.
Linked operator-fixture cleanup remains incomplete and returns typed
CAPABILITY_NOT_READY before any effect until canonical cleanup adapters and later
Task05/12/16 dependencies exist; full artifact lifecycle is not certified.
