# Task03A frozen verified authority contracts — v1

This freezes substep03A only. Task03 is incomplete until03B closes the inventoried
endpoints and03C verifies client JWT refresh, subscriptions and negative byte/callback
cases. No existing endpoint is protected by this substep, and no live mutation,
deployment, inference, host auth.config change or HTTP route change was performed.

Authority: approved decision register, architecture§9, Task01 frozen contracts and
fresh qualification PASS. This is a fresh-install contract; no existing ownership
adoption, legacy import, Python implementation or external media storage is added.

## Verified identity and operator provisioning

`ctx.auth.getUserIdentity()` supplies the identity after the host-configured Convex
JWT issuer/audience/signature/expiry verification. Cortex maps the **exact** verified
`issuer` and `subject` pair to `runtimeAuthPrincipals`, then reads trusted memberships,
scope epochs and grants. `tokenIdentifier`, JWT roles/tenant/user/email claims,
AuthContext, caller IDs and caller-created users/agents/participants are never grants.
Issuer strings are not normalized into another issuer. Host auth.config and unrelated
HTTP routes remain host-owned; Task06 composes additive installation fragments.

The internal `runtimeAuth:provision` mutation is invoked by the authenticated trusted
deployment operator through internal Convex tooling/host provisioning. It never accepts
a public JWT admin assertion as a provisioning credential. Its optional
`metadataUserId` is an immutable operator binding used to adapt existing metadata API
labels; public writes derive that binding from authority, never adopt a caller label.
Public user/agent/memory-space registration cannot change trusted control records.

Provisioning creates one principal per issuer/subject, one membership per
principal/tenant, registered tenant/space scopes and one active grant per
membership/space selector. Repeating identical provisioning is idempotent. Changing
capabilities/scope access/expiry creates a new immutable grant ID/version and revokes
the prior generation. Explicit operator provisioning after grant revocation may issue
a later grant generation; the old reference remains invalid forever. Principal deletion,
membership revocation/deletion, scope deletion and resource tombstones are retained
fences, with no public or internal reset/revival API. A new supported resource generation
uses a new resource ID and still requires an active current scope. No data adoption is
implied by control-table provisioning.

Foreground admission and pinned background rechecks enforce one unrevoked,
undeleted generation per trusted **raw** `(principalId,membershipId,tenantId,
memorySpaceId)` group before capability, ownership, expiry, version/epoch or
tombstone pruning. Different capabilities/access levels cannot hide a duplicate.
Expiry does not repair duplicate generations: an expired-but-unrevoked record still
counts for this invariant; operator replacement revokes it first. A lone expired
grant remains unusable. Revoked/deleted retained generations do not count. Malformed
versions cannot conceal a second unrevoked generation. This is a fail-closed control
record invariant, not a capability union or an authorization wildcard.

Foreground checks groups relevant to the trusted selected tenant/raw space (including
a tenant-wide undefined-space group); other explicitly unselected spaces/tenants
remain independent. Background rechecks enumerate the pinned grant's exact raw
membership/scope group and require the pinned grant to remain present. A tenant-wide
grant narrowed at admission still uses its raw undefined-space group for uniqueness.
Distinct raw tenant-wide/space grants are not duplicates; public admission still
denies multiple eligible candidate references, while an already pinned reference
checks its own exact group and explicit capability. A duplicate introduced after
admission blocks subsequent background sensitive work, even if the new grant has
different capabilities or would fail that resource's ownership/currentness check.

## Frozen types and helper signatures

Shared browser-safe types are in `src/auth/verified.ts`; they are not yet re-exported
from the SDK entrypoint. Backend implementation is `convex-dev/runtimeAuth.ts`.

```ts
type RuntimeCapability = "read" | "write" | "run" | "admin" | "tool"
  | "storage:read" | "storage:write";
type RuntimeResourceAccess = "own" | "space" | "tenant";
type RuntimeActorKind = "user" | "service";

interface RuntimeAuthorityReference {
  principalId: string; principalVersion: number;
  membershipId: string; membershipVersion: number;
  grantId: string; grantVersion: number;
  tenantId: string; tenantEpoch: number;
  memorySpaceId?: string; memorySpaceEpoch?: number;
}
interface RuntimeAuthority extends RuntimeAuthorityReference {
  actorKind: RuntimeActorKind;
  userId: string; // trusted operator metadataUserId binding, else principalId
  capabilities: RuntimeCapability[];
  resourceAccess: RuntimeResourceAccess;
}
interface RuntimeAuthorityRequirement {
  capability: RuntimeCapability;
  tenantId?: string; memorySpaceId?: string;
  resource?: RuntimeResource; // backend constructs from the canonical persisted row
  actorKind?: RuntimeActorKind;
}
interface RuntimeResource {
  resourceType: RuntimeResourceType; resourceId: string;
  tenantId?: string; memorySpaceId?: string; ownerPrincipalId?: string;
}

requireAuthority(ctx: Pick<QueryCtx,"auth"|"db">,
  requirement: RuntimeAuthorityRequirement): Promise<RuntimeAuthority>;
recheckAuthority(ctx: Pick<QueryCtx,"db">, reference: RuntimeAuthorityReference,
  requirement: RuntimeAuthorityRequirement): Promise<RuntimeAuthority>;
resolveAuthority(reader: AuthorityReader,
  verifiedIdentity: Pick<UserIdentity,"issuer"|"subject"> | null,
  requirement: RuntimeAuthorityRequirement, now?: number): Promise<RuntimeAuthority>;
resolveAuthorityReference(reader: AuthorityReader, reference: RuntimeAuthorityReference,
  requirement: RuntimeAuthorityRequirement, now?: number): Promise<RuntimeAuthority>;
assertResourceScope(authority: RuntimeAuthority, resource: RuntimeResource): void;
createAuthorityReader(ctx: Pick<QueryCtx,"db">): AuthorityReader;
```

`resolveAuthority` is pure except reads through its injected trusted control-table
adapter. Only Convex-verified identity enters it. `assertResourceScope` is the
synchronous scope/ownership portion; callers still use a current `requireAuthority`
or `recheckAuthority` with a resource to enforce lifecycle/tombstone fences. It cannot
replace the asynchronous currentness check. A client-provided reference is an ID
structure, never a bearer credential and never accepted as public authorization.

Internal registrations are `authorize`, `recheck`, `provision`, `revokeGrant`,
`revokeMembership`, `deletePrincipal`, `deleteScope`, and `tombstoneResource`.
Actions call the internal `authorize` query with inherited verified Convex auth;
background actions call internal `recheck`. Generated API references are deferred
to authorized codegen in later substeps; none are handwritten here. Query/mutation
adapters call the helpers directly. A domain adapter narrows optional memorySpaceId
to required scoped domain memorySpaceId and maps the authority versions/epochs.

## Direct API policy and row selection

Every capability is explicit: `admin` does not imply read/write/run/tool/storage.
`own` requires a canonical `ownerPrincipalId` matching the verified principal.
`space` explicitly grants cross-principal access in its one space, and `tenant`
explicitly grants cross-principal access in its tenant. Tenant membership alone
does not grant data access. JWT subject equality to a caller user ID is insufficient.

Selectors narrow grants. Omitted tenant/space derives one eligible trusted scope;
zero eligible grants, multiple eligible scopes or corrupt duplicate active grants
deny. A tenant-wide grant is explicit and can narrow to an existing registered
space. Optional list/count/search filters never authorize a global scan. Missing
tenant ownership on a persisted row denies public access. No legacy ownership
adoption or global-orphan fallback is provided.

Guarded modern memory/fact/artifact/read/write APIs remain available.03B must rewrite
the actual row selection and mutation path: use trusted composite keys and check
every row/relationship/version/source touched, not authorize a different same-ID
tenant row before the old handler performs an unscoped `first()`. Bulk operations
precheck every target before mutation. Scoped lists/search/counts constrain database
selection and verify canonical returned candidates; vector/keyword internal helpers
also recheck current source revision and tombstones. JSON result filtering alone is
insufficient for counts, private reads or effects. Caller IDs such as userId,
participantId, agentId, approvedBy, grantedBy/revokedBy, source/recipient spaces,
file IDs and tenantId are selectors/audit labels only; privileged actor fields are
derived and foreign references checked.

The frozen inventory classifies 240 existing public endpoints:198 guard and42
internalize. Three existing internal memory/fact fetch/search helpers remain
internal with scoped currentness checks. Eight new auth registrations are internal.
All251 AST builder calls resolve to exports; there are no registered HTTP routes or
connector callbacks in the configured baseline. `public-path-inventory.json` has
exact per-path validators, indexes, risk flags, required scope/permission/resource
lookup, ownership, background and extension contracts. Unsafe deployment-wide
admin/purge/worker paths are internalized, without disabling modern APIs wholesale.

## Background lifecycle, deletion and logout

Runs/jobs store the immutable reference above, never the caller JWT, provider key,
Gateway token or full identity claims. Memory-space jobs pin a concrete space and its
epoch, even when admitted by a tenant-wide grant. Recheck the exact principal and
membership versions, exact immutable grant ID/version/capability/expiry, tenant and
space epochs and resource tombstones before every sensitive read, external dispatch
and final commit. Deletion/revocation fences are authoritative control records,
never inferred from semantic memory. The commit check occurs in the same mutation
that writes the sensitive result/source state. Delayed stages cannot recreate a
tombstoned ID. Cleanup retains tombstones and reference-aware ownership checks.

Ordinary logout detaches that user's observers and prevents new authenticated public
calls, but does not revoke a trusted run grant. Explicit grant/membership revocation
or principal/scope deletion blocks later reads/effects/sensitive commits/delivery.
Already dispatched upstream work may finish or be charged; a revocation cannot
reverse an external effect. Preserve sanitized operation/usage/audit reconciliation
through trusted internal lifecycle controls without delivering private output or
resurrecting source rows. The external dispatch race is bounded by an admission
checkpoint plus the immediately preceding current authority check; no instantaneous
cross-service cancellation guarantee or blind replay is claimed.

## Transcript, shares, storage, tools and callbacks

Transcript reads use authorized canonical Agent state. Managed transcript mutation
is locked by default. A trusted `admin` capability may change the lock; direct
append/edit/delete still requires applicable `write` capability and current scope,
targets the same canonical store, records actor/source and revision, invalidates
derived memory, and fences stale run commits. Unlock never grants run/billing
permission.03B guards existing access; Task05 completes canonical store routing.

Existing share management endpoints require verified scoped grants and derive their
actor. Task05's dedicated public share view can authorize a server-issued, expiring,
revocable token solely for its approved redacted canonical transcript/artifact view.
It reconstructs allowlisted fields, excluding injected private context, raw reasoning,
memory/facts, credentials, private tool results and webhook secrets. It is read-only
and confers no continuation/fork/inference/tool/private-storage capability. Caller
user/email/domain claims do not establish the recipient identity.03A does not claim
that the existing raw share records are a safe public redacted view.

Storage admission/read require independent `storage:write`/`storage:read` capability,
an owned scoped upload/materialization receipt and authorization of every linked
conversation/memory/artifact/attachment. A caller _storage ID never proves ownership.
Raw upload/getUrl delivery functions are internalized pending scoped admission and
private authenticated HTTP delivery in Task12. Uploads/completed outputs/responses
have the20,000,000-byte cap. No external media storage or large bearer URL fallback
is added. Private bytes, upload expiry/abandonment and actual cross-tenant delivery
tests remain Task12/13 and03C coverage, not claimed by these pure unit tests.

Backend tools/connector services have explicit tool capability and pinned scope;
service actors are operator-provisioned verified issuer/subject principals or trusted
internal execution with a stored owner grant. Arbitrary caller closures and caller
service-role metadata are excluded. A later connector callback authenticates the
provider signature or an approved verified service identity, binds a persisted job
and one-time/idempotent callback identity, and rechecks its stored grant and deletion
fences before admitting result bytes/effects/commit. Payload tenant/grant/job IDs
cannot establish authority. Host HTTP routing is composed additively in later tasks.
