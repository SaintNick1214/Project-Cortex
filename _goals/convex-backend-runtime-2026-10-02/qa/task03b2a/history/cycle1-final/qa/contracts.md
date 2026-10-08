# Task03B2A bounded metadata endpoint contract v1

This candidate closes only the reviewed inventory's immutable12/mutable11/users8/sessions10 paths:36 public guards and5 internal maintenance registrations. Task03 and all17 top-level tasks remain ongoing. This contract consumes reviewed03A generic authority only; no pending memory/fact or governance helper is imported. Detached reviewed base is2edd9435a545ecf0f1e3315fe7ae37c22c7b0623.

## Identity, capability and exact scope

Every public handler invokes `runtimeAuth.requireAuthority` through the owned helper with only tenantId/memorySpaceId selectors and its explicit read or write capability. Verified exact issuer/subject, operator principals/memberships/grants, immutable grant generations, scope epochs and retained fences govern admission. Admin implies neither read nor write. Public data/metadata/user profiles cannot mint authority. Public actor labels must match the trusted metadataUserId binding; omitted labels derive it. Own user-profile IDs must equal that binding. Explicit space/tenant access permits cross-principal metadata, with canonical owner still required on every row.

A generic tenant grant may authorize undefined-space metadata. Its omitted memorySpaceId selects exactly undefined-space rows, never all spaces. A concrete grant derives its one space when selectors are omitted. A tenant grant explicitly selecting memorySpaceId pins that registered space/epoch and selects its exact rows. Ambiguous omitted grants/tenants deny. All modern APIs now accept optional tenantId/memorySpaceId selectors. No orphan fallback or ownership adoption exists.

`by_runtime_key` is immutable[tenantId,memorySpaceId,type,id], mutable[tenantId,memorySpaceId,namespace,key], sessions[tenantId,memorySpaceId,sessionId]. Canonical key lookups filter own ownerPrincipalId in the database before hydration and use unique lookup. An exact scoped existence-only conflict query rejects foreign/missing-owner or duplicate canonical keys without using their private fields. This existence check is not a data-return path. `by_runtime_scope`[tenantId,memorySpaceId,ownerPrincipalId] constrains list/search/count/bulk candidates before collect/pagination/count; space/tenant grants omit only its owner suffix. Missing owners and typed row tombstones are filtered before materialization. Control tombstones exclude otherwise retained candidates before data/history/search use. Every permitted row is rechecked through its canonical resource before private use/effect/commit.

## Independent reads and write receipts

Mutations pre-admit independent READ for every target before writes. A distinct tenant READ plus concrete space WRITE is supported. Ineligible READ at initial admission (including a standalone already expired READ, stale scope or own READ for another owner) leaves a valid WRITE capable of returning a safe receipt. The adapter never catches an admitted READ failure or downgrades it to a receipt.

Hydrated mutation results require final pinned READ and WRITE checks. `finalChecks` reloads grants, rechecks every reference/resource in the same mutation and synchronously checks all captured expiry deadlines after the final awaited control read. Convex transactional snapshots supply control-record consistency; the synchronous deadline check handles wall-clock expiry during awaits. Receipts similarly require current final WRITE. Store/update/transaction write-only responses contain caller-supplied selectors and a created database ID only for a newly created record. Bulk write-only responses contain authorized counts, with no unsupplied IDs/keys, private prior value, versions or history.

Transactions authorize and validate the entire batch before its first write, simulate repeated-key numeric operations, reject invalid numeric operands/nonfinite results/undefined replacement values and forbid delete-then-recreate of a retained key. Native mutation rollback is represented by the owned02B-derived fixture's transaction snapshots, and tests assert both zero partial writes after preflight failure and rollback after a later lifecycle failure. Functional increment zero remains zero. Authorized mutable metadata retains explicit-null clearing semantics. Immutable versions/history/purgeVersions remain public authorized operations; keepLatest is a positive safe integer.

## Deletion and source identity

Public deletion retains typed row tombstonedAt and runtimeAuthTombstones; it never deletes control authority or resets fences. New store/set/version generation cannot reuse a fenced ID. Lists/counts/search exclude fences. User deletion affects only the authorized immutable user row. The two purgeAll registrations are trusted deployment-operator internal mutations, retain row/control tombstones and do not expose a global destructive public endpoint. This is fresh-install behavior, with no existing-data migration.

Frozen exported identity function:

```ts
sourceId(table: "immutable" | "mutable" | "sessions", first: string, second?: string): string
// immutable: `${"immutable"}:${JSON.stringify([type,id])}`
// mutable: `${"mutable"}:${JSON.stringify([namespace,key])}`
// sessions: `${"session"}:${JSON.stringify([sessionId])}`
```

All three use supported03A resourceType `source`; tenantId and optional memorySpaceId are separate canonical scope fields. JSON array encoding disambiguates colons, percent signs, quotes and unicode. Parent-approved MF integration must replace intermediate `immutable:${type}:${id}`/`mutable:${namespace}:${key}` source-link key construction with this identical contract and check canonical scoped row tombstonedAt. That integration remains separately reviewed; this candidate neither imports nor changes pending MF code, and it does not claim linked MF compatibility before that bridge.

## Sessions and background maintenance

Application sessionId is unique within exact tenant/optional-space scope; create rejects collisions and derives canonical owner/user label. Public create never accepts a reference credential. It stores a server-built immutable authorityReference and strips that internal reference from every public session read/create/list response. End/endAll are application state changes and never revoke trusted grants. Touch cannot restore ended or expired sessions.

expireIdle/incrementMessageCount/incrementMemoryCount are internal mutations. Internal arguments carry a trusted stored reference, not a JWT. Every target must have exactly the same stored immutable reference, canonical scope/owner/resource and active current write authority. Every read/effect/commit rechecks it; expiry validates all targets before effects. Counters reject malformed/overflowing counts and cannot modify ended/expired sessions. Expired/deleted/revoked references cannot bypass a same-ID record in another scope.

## Evidence and remaining gates

`check-receipts.json` contains exact argv/cwd/UTC start/end/exit codes. `checks/` contains unfiltered output. `source-hashes.json` pins candidate schema/backend/tests. `catalog/public-path-inventory.json` is an owned import-aware AST derivative of reviewed03A, limited to this41-path scope; reviewed03A baseline files are unchanged. `framework-registration.json` observes real installed Convex registrations and validators. No codegen/SDK/package build/pack, dependency changes, stage/commit/push/deploy/model call or production mutation occurred.

The registered-handler tests and native registration probe are offline evidence. Actual managed JWT transport/subscriptions/private bytes/callbacks/deployment are03C2 and later tasks, not an offline Task03 PASS. SDK adaptation is03C2/09: full-root types currently report five introduced consumer diagnostics, preserved unfiltered in checks/full-root-types.log and classified in unsupported-downstream-boundaries.json. The baseline in-memory HEAD compiler-host comparison has no diagnostics. Scoped backend/test strict types, scoped lint, selected Jest and exact registration probes must pass separately. Fresh independent judgment and parent integration are pending.
