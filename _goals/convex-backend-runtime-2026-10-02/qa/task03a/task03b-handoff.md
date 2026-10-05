# Bounded Task03B closure handoff

03A freezes contracts and inventory only.03B must record one disposition and actual
guard/visibility evidence for every inventoried path;03C remains separate. New
registrations must be appended to the AST catalog and independently reviewed.

## 03B1: shared guards plus memory/transcript/share/history

Own shared guard machinery and `memories`, `facts`, `conversations`,
`conversationShares`, `conversationSnapshots`, `factHistory`. Baseline:83 public
paths (74 guard,9 internalize) plus3 existing internal helpers.40 entries flag
global-ID indexes and24 flag handler-local conditional scope filters. Root/common
schema edits, if needed, are serialized with03B2. Freeze shared guards before03B2
adapters consume them.

Required handler/data-layer work:

- `memories` and `facts`: derive tenant/space even when optional tenant selectors
  are absent; replace actual global ID/version/history/subject/relationship selections;
  constrain vector/keyword candidate lookup plus source/revision/tombstone checks.
  Check partial writes, finalize, supersession/consolidation peers and each bulk ID.
  Caller user/source/participant IDs cannot grant ownership or authoritative tool trust.
- `conversations`: replace raw first-by-conversation-ID in reads, access checks,
  metadata/visibility/messages/approval/delete/getOrCreate and bulk helpers; select
  the same trusted row subsequently written. Bind every participant/source/recipient
  space and privileged approvedBy/owner labels. Canonical Agent lock/revision routing
  is Task05, whose frozen contract this closure must preserve.
- `conversationShares`: do not accept grantedBy/revokedBy/user/domain labels as
  identity, do not grant runtime privilege from canContinue/canFork, and do not expose
  raw private grant/participant rows via a public-share exception. Join the same
  authorized canonical conversation and source/recipient scope for create/revoke/list/
  checkAccess/get. Internalize view-count helper; redacted view comes from Task05.
- `conversationSnapshots`: snapshot ID -> same canonical conversation ownership;
  check creators, snapshot source and list-by-user owner, including omitted filters.
- `factHistory`: tenant is absent from current event rows; join authoritative scoped
  fact/source or add fresh-install ownership fields. Every historical read/count/chain
  verifies its fact scope. Log/deletion/purge helper functions become internal and
  reload trusted job refs; historical actor fields are not authority.

Meaningful fixtures: duplicate application IDs in two tenants (foreign tenant inserted
first), omitted selectors, both space and tenant ambiguity, same-tenant different owner,
cross-space participants/relationships, forged user/admin/share-recipient labels, partial
write/finalization/bulk rollback, vector/action internal candidate confused-deputy denial,
history joins, share serialization privacy, revoked/deleted refs before delayed stages.
Use actual handler selection/mutation assertions and then disposable-target direct
function/subscription negatives; a mock wrapper that never calls the handler is insufficient.

## 03B2: remaining scoped modules, storage and worker/admin closure

Own `artifacts`, `attachments`, `contexts`, `memorySpaces`, `agents`, `users`,
`sessions`, `a2a`, `immutable`, `mutable`, `governance`, `graphSync`, `admin`.
Baseline:157 public paths (124 guard,33 internalize).63 entries flag global-ID indexes,
62 flag conditional scope filtering and9 contain storage operations. Consume the
reviewed03B1 shared guard; serialize schema/shared writes through the coordinator.

Required handler/data-layer work:

- Artifact/attachment get/update/streaming/version/bulk/linked reads must select the
  canonical trusted tenant/space row and check owner/source links. `attach`,
  `completeArtifactUpload`, `setFileRef` and detach/remove cannot accept arbitrary
  _storage IDs or erase bytes owned by another resource. Require scoped owned
  upload/materialization receipts and reference-aware deletion. Raw upload/getUrl
  functions internalize; actual private byte transport and callback tests are later12/13.
- Context chains/access lists check parent/root/child and every granted cross-space
  relationship; metadata grants/participants cannot become runtime memberships.
- Space registration/participant edits require explicit admin scope; deleting a space
  fences authority and delayed jobs rather than only erasing metadata.
- Agent config writes/read-stat metadata derive trusted tenant and admin capability;
  no caller config/roles or participant registration provisions grants.
- Users' current immutable `type=user,id` global first() requires trusted tenant plus
  immutable operator metadata-user binding; another user's profile/deletion requires
  explicit cross-principal authority. Profile rows never grant membership. Sessions
  derive owner, scope and audit actor; expire/counter helpers internalize.
- A2A/broadcast verifies both source and every destination space inside the trusted
  tenant; caller agent/source/recipient labels cannot authorize cross-space writes.
- Immutable/mutable store keys are `(trusted tenant,type,id)` or `(trusted tenant,
  namespace,key)` including histories and each transaction/bulk entry. Optional
  selectors cannot invoke global namespace fallback. PurgeAll internalizes.
- Governance currently lacks tenant ownership on policy/enforcement rows and accepts
  nested arbitrary policy payloads. Add fresh trusted tenant/scope ownership and strict
  admin mutation/resource binding, including agent overrides and compliance statistics.
  Organization or space IDs alone do not select globally. Enforce/purge workers internalize.
- All graphSync queue read/update/stats/cleanup functions and arbitrary admin
  table/list/count/delete/clear functions internalize. Internal workers still recheck
  persisted grant/source/scope before read/effect/projection commit. Deployment
  maintenance remains trusted operator scope and cannot reuse public admin claims.

Meaningful fixtures: wrong-tenant duplicate global IDs selected first, unqualified list/
count, cross-principal profiles, forged admin metadata, cross-space context/A2A graphs,
atomic multi-target foreign row denial, caller-created storage IDs/references, foreign
linked resources and deletion, worker revoked refs, governance nested forged scope,
public invocation of each internalized registration.03B storage receipts establish
metadata admission ownership; do not report private byte delivery as complete until
the later delivery implementation and actual HTTP negative cases pass.

## Shared implementation rules

Use `requireAuthority` on external read/write entry and `recheckAuthority` on trusted
background references. Public subscribers re-evaluate current grants on every query
execution. Bind privileged args server-side, constrain real query/index selection,
and check every affected canonical row before mutations. Never authorize one scoped
row and allow an unchanged unscoped handler to fetch a different same-ID row. Broad
JSON filtering cannot repair unscoped writes, counts, external effects or reads into
private processing. Keep existing modern guarded APIs available; only the frozen
unsafe global/worker/raw-byte paths internalize. Internal visibility does not replace
current grant/tombstone checks in job code.

02 domain adapters accept trusted scope; they must not reintroduce caller AuthContext
authority. Task04 retains independent policy/billing admission even with run/tool
capability.03B codegen is authorized later by the coordinator; do not hand-edit
generated bindings or deploy/rewrite host config to make a local check pass.
