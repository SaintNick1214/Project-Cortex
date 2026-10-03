import { describe, expect, it } from "@jest/globals";
import {
  assertResourceScope, resolveAuthority, resolveAuthorityReference,
  type AuthorityReader, type GrantRecord, type MembershipRecord, type PrincipalRecord,
  type ScopeRecord, type TombstoneKey,
} from "../../../convex-dev/runtimeAuth";
import type { RuntimeAuthority, RuntimeAuthorityRequirement, RuntimeResource } from "../../../src/auth/verified";

const identity = { issuer: "https://host.test", subject: "alice" };
const request: RuntimeAuthorityRequirement = { capability: "read", tenantId: "tenant-a", memorySpaceId: "space-a" };
const resource: RuntimeResource = {
  resourceType: "memory", resourceId: "memory-a", tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: "principal-a",
};

function fixture() {
  const principal: PrincipalRecord = { _id: "principal-a", ...identity, actorKind: "user", version: 1, metadataUserId: "metadata-alice" };
  const membership: MembershipRecord = { _id: "membership-a", principalId: principal._id, tenantId: "tenant-a", version: 1 };
  const grant: GrantRecord = {
    _id: "grant-a", principalId: principal._id, membershipId: membership._id, tenantId: "tenant-a", memorySpaceId: "space-a",
    tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "write", "run", "tool", "storage:read", "storage:write"], resourceAccess: "own", version: 1,
  };
  const principals = [principal];
  const memberships = [membership];
  const grants = [grant];
  const scopes: ScopeRecord[] = [{ tenantId: "tenant-a", epoch: 1 }, { tenantId: "tenant-a", memorySpaceId: "space-a", epoch: 1 }];
  const tombstones: TombstoneKey[] = [];
  const reader: AuthorityReader = {
    findPrincipal: async (issuer, subject) => principals.find((record) => record.issuer === issuer && record.subject === subject) ?? null,
    getPrincipal: async (id) => principals.find((record) => record._id === id) ?? null,
    listMemberships: async (id) => memberships.filter((record) => record.principalId === id),
    getMembership: async (id) => memberships.find((record) => record._id === id) ?? null,
    listGrants: async (id) => grants.filter((record) => record.membershipId === id),
    getGrant: async (id) => grants.find((record) => record._id === id) ?? null,
    getScope: async (tenantId, memorySpaceId) => scopes.find((record) => record.tenantId === tenantId && record.memorySpaceId === memorySpaceId) ?? null,
    hasTombstone: async (key) => tombstones.some((record) => record.tenantId === key.tenantId && record.memorySpaceId === key.memorySpaceId
      && record.resourceType === key.resourceType && record.resourceId === key.resourceId),
  };
  return { reader, principal, membership, grant, principals, memberships, grants, scopes, tombstones };
}
type Fixture = ReturnType<typeof fixture>;
const forbidden = { data: { code: "FORBIDDEN", retryable: false, outcome: "not_dispatched" } };

describe("verified principal and grant authority", () => {
  it("derives exact trusted scope and immutable versions from verified issuer/subject, including omitted selectors", async () => {
    const f = fixture();
    const authority = await resolveAuthority(f.reader, identity, { capability: "read" }, 1000);
    expect(authority).toEqual({
      principalId: "principal-a", principalVersion: 1, membershipId: "membership-a", membershipVersion: 1,
      grantId: "grant-a", grantVersion: 1, tenantId: "tenant-a", tenantEpoch: 1, memorySpaceId: "space-a", memorySpaceEpoch: 1,
      actorKind: "user", userId: "metadata-alice", capabilities: f.grant.capabilities, resourceAccess: "own",
    });
    authority.capabilities.pop();
    expect(f.grant.capabilities).toHaveLength(6);
  });

  it("rejects missing identity and never turns metadata into a membership", async () => {
    const f = fixture();
    await expect(resolveAuthority(f.reader, null, request)).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
    const forged = { issuer: identity.issuer, subject: "attacker", userId: "metadata-alice", tenantId: "tenant-a", claims: { roles: ["admin"] }, metadata: { grantId: "grant-a" } };
    await expect(resolveAuthority(f.reader, forged, request)).rejects.toMatchObject(forbidden);
    await expect(resolveAuthority(f.reader, { issuer: "https://other.test", subject: identity.subject }, request)).rejects.toMatchObject(forbidden);
    expect(f.principals).toHaveLength(1);
    expect(f.memberships).toHaveLength(1);
    expect(f.grants).toHaveLength(1);
  });

  const deniedStates: Array<[string, (f: Fixture) => void]> = [
    ["revoked principal", (f) => { f.principal.revokedAt = 0; }],
    ["deleted principal", (f) => { f.principal.deletedAt = 0; }],
    ["revoked membership", (f) => { f.membership.revokedAt = 0; }],
    ["deleted membership", (f) => { f.membership.deletedAt = 0; }],
    ["revoked grant", (f) => { f.grant.revokedAt = 0; }],
    ["deleted grant", (f) => { f.grant.deletedAt = 0; }],
    ["expired grant", (f) => { f.grant.expiresAt = 1000; }],
    ["missing read capability", (f) => { f.grant.capabilities = ["admin"]; }],
    ["mismatched grant tenant", (f) => { f.grant.tenantId = "tenant-b"; }],
    ["mismatched grant principal", (f) => { f.grant.principalId = "principal-b"; }],
    ["invalid grant version", (f) => { f.grant.version = 0; }],
    ["stale tenant epoch", (f) => { f.scopes[0]!.epoch = 2; }],
    ["stale memory space epoch", (f) => { f.scopes[1]!.epoch = 2; }],
    ["deleted tenant", (f) => { f.scopes[0]!.deletedAt = 0; }],
    ["deleted memory space", (f) => { f.scopes[1]!.deletedAt = 0; }],
    ["missing tenant", (f) => { f.scopes.shift(); }],
    ["tenant tombstone", (f) => { f.tombstones.push({ tenantId: "tenant-a", resourceType: "tenant", resourceId: "tenant-a" }); }],
    ["space tombstone", (f) => { f.tombstones.push({ tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "memorySpace", resourceId: "space-a" }); }],
  ];
  it.each(deniedStates)("denies %s before a sensitive read", async (_label, mutate) => {
    const f = fixture(); mutate(f);
    await expect(resolveAuthority(f.reader, identity, request, 1000)).rejects.toMatchObject(forbidden);
  });

  it("rejects tenant/space mismatch, resource mismatch and an unscoped canonical resource", async () => {
    const f = fixture();
    for (const requirement of [
      { ...request, tenantId: "tenant-b" }, { ...request, memorySpaceId: "space-b" },
      { ...request, resource: { ...resource, tenantId: "tenant-b" } },
      { ...request, resource: { ...resource, tenantId: undefined } },
    ]) await expect(resolveAuthority(f.reader, identity, requirement, 1000)).rejects.toMatchObject(forbidden);
  });

  it("denies omitted selectors when eligible grants span tenants or memory spaces", async () => {
    const f = fixture();
    f.scopes.push({ tenantId: "tenant-a", memorySpaceId: "space-b", epoch: 1 });
    f.grants.push({ ...f.grant, _id: "grant-b", memorySpaceId: "space-b" });
    await expect(resolveAuthority(f.reader, identity, { capability: "read" }, 1000)).rejects.toMatchObject(forbidden);
    expect((await resolveAuthority(f.reader, identity, request, 1000)).grantId).toBe("grant-a");
    f.grants.pop();
    f.memberships.push({ ...f.membership, _id: "membership-b", tenantId: "tenant-b" });
    f.grants.push({ ...f.grant, _id: "grant-b", membershipId: "membership-b", tenantId: "tenant-b" });
    f.scopes.push({ tenantId: "tenant-b", epoch: 1 }, { tenantId: "tenant-b", memorySpaceId: "space-a", epoch: 1 });
    await expect(resolveAuthority(f.reader, identity, { capability: "read", memorySpaceId: "space-a" }, 1000)).rejects.toMatchObject(forbidden);
  });

  it("fails closed on duplicate active grants rather than picking a permissive version", async () => {
    const f = fixture(); f.grants.push({ ...f.grant, _id: "grant-duplicate", version: 2, resourceAccess: "space" });
    await expect(resolveAuthority(f.reader, identity, request, 1000)).rejects.toMatchObject(forbidden);
  });

  it("rejects same-scope active read/write grants before capability pruning", async () => {
    const f = fixture(); f.grant.capabilities = ["read"];
    f.grants.push({ ...f.grant, _id: "grant-write", version: 2, capabilities: ["write"] });
    await expect(resolveAuthority(f.reader, identity, request, 1000)).rejects.toMatchObject(forbidden);
    await expect(resolveAuthority(f.reader, identity, { ...request, capability: "write" }, 1000)).rejects.toMatchObject(forbidden);
  });

  it("rejects same-scope own/space read grants before an ownership denial discards one", async () => {
    const f = fixture(); f.grant.capabilities = ["read"];
    f.grants.push({ ...f.grant, _id: "grant-space", version: 2, resourceAccess: "space" });
    await expect(resolveAuthority(f.reader, identity, { ...request, resource: { ...resource, ownerPrincipalId: "principal-b" } }, 1000)).rejects.toMatchObject(forbidden);
  });

  it.each(["revokedAt", "deletedAt"] as const)("excludes a retained %s generation without granting its capabilities/access", async (field) => {
    const f = fixture(); f.grant.capabilities = ["read"];
    f.grants.push({ ...f.grant, _id: "grant-retired", version: 2, capabilities: ["write", "read"], resourceAccess: "space", [field]: 0 });
    const authority = await resolveAuthority(f.reader, identity, request, 1000);
    expect(authority).toMatchObject({ grantId: "grant-a", capabilities: ["read"], resourceAccess: "own" });
    expect(await resolveAuthorityReference(f.reader, authority, request, 1001)).toEqual(authority);
    await expect(resolveAuthority(f.reader, identity, { ...request, capability: "write" }, 1000)).rejects.toMatchObject(forbidden);
    await expect(resolveAuthority(f.reader, identity, { ...request, resource: { ...resource, ownerPrincipalId: "principal-b" } }, 1000)).rejects.toMatchObject(forbidden);
  });

  it("does not let expiry/currentness pruning repair duplicate unrevoked generations", async () => {
    const f = fixture(); const reference = await resolveAuthority(f.reader, identity, request, 999);
    f.grants.push({ ...f.grant, _id: "grant-expired", version: 2, capabilities: ["write"], expiresAt: 1000 });
    await expect(resolveAuthority(f.reader, identity, request, 1001)).rejects.toMatchObject(forbidden);
    await expect(resolveAuthorityReference(f.reader, reference, request, 1001)).rejects.toMatchObject(forbidden);
    f.grants[1]!.revokedAt = 1001;
    expect((await resolveAuthority(f.reader, identity, request, 1002)).grantId).toBe("grant-a");
    expect(await resolveAuthorityReference(f.reader, reference, request, 1002)).toEqual(reference);
  });

  it("does not let a malformed version or stale epoch hide duplicate unrevoked generations", async () => {
    const f = fixture();
    f.grants.push({ ...f.grant, _id: "grant-malformed", version: 0, tenantEpoch: 99, capabilities: ["write"] });
    await expect(resolveAuthority(f.reader, identity, request, 1000)).rejects.toMatchObject(forbidden);
  });

  it("keeps other registered raw spaces independent even when one contains corrupt duplicates", async () => {
    const f = fixture(); const reference = await resolveAuthority(f.reader, identity, request, 1000);
    f.scopes.push({ tenantId: "tenant-a", memorySpaceId: "space-b", epoch: 1 });
    f.grants.push({ ...f.grant, _id: "grant-b-read", memorySpaceId: "space-b", capabilities: ["read"] },
      { ...f.grant, _id: "grant-b-write", memorySpaceId: "space-b", version: 2, capabilities: ["write"] });
    expect((await resolveAuthority(f.reader, identity, request, 1001)).grantId).toBe("grant-a");
    expect(await resolveAuthorityReference(f.reader, reference, request, 1001)).toEqual(reference);
    await expect(resolveAuthority(f.reader, identity, { ...request, memorySpaceId: "space-b" }, 1001)).rejects.toMatchObject(forbidden);
    await expect(resolveAuthority(f.reader, identity, { capability: "read", tenantId: "tenant-a" }, 1001)).rejects.toMatchObject(forbidden);
  });

  it("keeps other tenant memberships independent of the selected trusted tenant", async () => {
    const f = fixture(); const reference = await resolveAuthority(f.reader, identity, request, 1000);
    f.memberships.push({ ...f.membership, _id: "membership-b", tenantId: "tenant-b" });
    f.scopes.push({ tenantId: "tenant-b", epoch: 1 }, { tenantId: "tenant-b", memorySpaceId: "space-a", epoch: 1 });
    f.grants.push({ ...f.grant, _id: "grant-b-read", membershipId: "membership-b", tenantId: "tenant-b", capabilities: ["read"] },
      { ...f.grant, _id: "grant-b-write", membershipId: "membership-b", tenantId: "tenant-b", version: 2, capabilities: ["write"] });
    expect((await resolveAuthority(f.reader, identity, request, 1001)).grantId).toBe("grant-a");
    expect(await resolveAuthorityReference(f.reader, reference, request, 1001)).toEqual(reference);
    await expect(resolveAuthority(f.reader, identity, { ...request, tenantId: "tenant-b" }, 1001)).rejects.toMatchObject(forbidden);
  });

  it("groups tenant-wide and space-specific grants by raw scope before narrowing, preserving exact capabilities", async () => {
    const f = fixture(); f.grant.memorySpaceId = undefined; f.grant.memorySpaceEpoch = undefined;
    f.grant.resourceAccess = "tenant"; f.grant.capabilities = ["read"];
    f.grants.push({ ...f.grant, _id: "grant-space-write", memorySpaceId: "space-a", memorySpaceEpoch: 1, resourceAccess: "own", capabilities: ["write"] });
    const reference = await resolveAuthority(f.reader, identity, request, 1000);
    expect(reference).toMatchObject({ grantId: "grant-a", memorySpaceId: "space-a", capabilities: ["read"] });
    expect((await resolveAuthority(f.reader, identity, { ...request, capability: "write" }, 1000)).grantId).toBe("grant-space-write");
    expect(await resolveAuthorityReference(f.reader, reference, request, 1001)).toEqual(reference);
    await expect(resolveAuthorityReference(f.reader, reference, { ...request, capability: "write" }, 1001)).rejects.toMatchObject(forbidden);
    f.grants[1]!.capabilities = ["read"];
    await expect(resolveAuthority(f.reader, identity, request, 1001)).rejects.toMatchObject(forbidden); // Two eligible references, not a raw-group duplicate.
    expect(await resolveAuthorityReference(f.reader, reference, request, 1001)).toEqual(reference);
  });

  it("requires explicit cross-principal access within the same tenant", async () => {
    const f = fixture(); const otherOwner = { ...resource, ownerPrincipalId: "principal-b" };
    await expect(resolveAuthority(f.reader, identity, { ...request, resource: otherOwner }, 1000)).rejects.toMatchObject(forbidden);
    f.grant.resourceAccess = "space";
    expect((await resolveAuthority(f.reader, identity, { ...request, resource: otherOwner }, 1000)).resourceAccess).toBe("space");
    await expect(resolveAuthority(f.reader, identity, { ...request, resource: { ...otherOwner, memorySpaceId: "space-b" } }, 1000)).rejects.toMatchObject(forbidden);
  });

  it("allows a tenant-wide grant to narrow to an existing space while preserving its epoch", async () => {
    const f = fixture(); f.grant.memorySpaceId = undefined; f.grant.memorySpaceEpoch = undefined; f.grant.resourceAccess = "tenant";
    const authority = await resolveAuthority(f.reader, identity, { ...request, resource: { ...resource, ownerPrincipalId: "principal-b" } }, 1000);
    expect(authority).toMatchObject({ memorySpaceId: "space-a", memorySpaceEpoch: 1, grantId: "grant-a" });
    await expect(resolveAuthority(f.reader, identity, { ...request, memorySpaceId: "unregistered-space" }, 1000)).rejects.toMatchObject(forbidden);
  });

  it("separates explicit service/tool capabilities from caller claimed service roles", async () => {
    const f = fixture();
    await expect(resolveAuthority(f.reader, identity, { ...request, capability: "tool", actorKind: "service" }, 1000)).rejects.toMatchObject(forbidden);
    f.principal.actorKind = "service";
    expect((await resolveAuthority(f.reader, identity, { ...request, capability: "tool", actorKind: "service" }, 1000)).actorKind).toBe("service");
    f.grant.capabilities = ["read"];
    await expect(resolveAuthority(f.reader, identity, { ...request, capability: "tool" }, 1000)).rejects.toMatchObject(forbidden);
  });

  it("authorizes each private storage capability independently of read/run/admin", async () => {
    const f = fixture(); f.grant.capabilities = ["read", "admin", "run"];
    for (const capability of ["storage:read", "storage:write", "tool"] as const) {
      await expect(resolveAuthority(f.reader, identity, { ...request, capability }, 1000)).rejects.toMatchObject(forbidden);
    }
  });
});

describe("background rechecks and deletion fences", () => {
  it.each(["different-capability", "foreign-owner"])("detects %s duplicate introduced after pinned admission", async (variant) => {
    const f = fixture(); f.grant.capabilities = ["read"];
    if (variant === "foreign-owner") f.grant.resourceAccess = "space";
    const requirement = variant === "foreign-owner" ? { ...request, resource: { ...resource, ownerPrincipalId: "principal-b" } } : request;
    const reference = await resolveAuthority(f.reader, identity, requirement, 1000);
    f.grants.push({ ...f.grant, _id: "grant-late", version: 2, capabilities: variant === "different-capability" ? ["write"] : ["read"], resourceAccess: "own" });
    await expect(resolveAuthorityReference(f.reader, reference, requirement, 1001)).rejects.toMatchObject(forbidden);
  });

  it("detects a duplicate tenant-wide raw grant after its reference was narrowed to a concrete space", async () => {
    const f = fixture(); f.grant.memorySpaceId = undefined; f.grant.memorySpaceEpoch = undefined;
    f.grant.resourceAccess = "tenant"; f.grant.capabilities = ["read"];
    const reference = await resolveAuthority(f.reader, identity, request, 1000);
    f.grants.push({ ...f.grant, _id: "grant-wide-late", version: 2, capabilities: ["write"] });
    await expect(resolveAuthorityReference(f.reader, reference, request, 1001)).rejects.toMatchObject(forbidden);
  });

  it("requires the pinned grant to remain present in its trusted raw membership/scope group", async () => {
    const f = fixture(); const reference = await resolveAuthority(f.reader, identity, request, 1000);
    f.reader.listGrants = async () => [];
    await expect(resolveAuthorityReference(f.reader, reference, request, 1001)).rejects.toMatchObject(forbidden);
  });

  it("a lone grant permits work before expiry and rejects both admission and pinned work at expiry", async () => {
    const f = fixture(); f.grant.expiresAt = 1000;
    const reference = await resolveAuthority(f.reader, identity, request, 999);
    expect(await resolveAuthorityReference(f.reader, reference, request, 999)).toEqual(reference);
    await expect(resolveAuthority(f.reader, identity, request, 1000)).rejects.toMatchObject(forbidden);
    await expect(resolveAuthorityReference(f.reader, reference, request, 1000)).rejects.toMatchObject(forbidden);
  });

  it("continues after ordinary observer logout and stops on subsequent grant revocation", async () => {
    const f = fixture(); const reference = await resolveAuthority(f.reader, identity, request, 1000);
    // Background execution reads its persisted reference and never asks for a session identity.
    expect(await resolveAuthorityReference(f.reader, reference, request, 1001)).toEqual(reference);
    f.grant.revokedAt = 1002;
    await expect(resolveAuthorityReference(f.reader, reference, request, 1003)).rejects.toMatchObject(forbidden);
  });

  it.each(["principalVersion", "membershipVersion", "grantVersion", "tenantEpoch", "memorySpaceEpoch"] as const)(
    "rejects a changed or forged pinned %s", async (field) => {
      const f = fixture(); const reference = await resolveAuthority(f.reader, identity, request, 1000);
      await expect(resolveAuthorityReference(f.reader, { ...reference, [field]: reference[field]! + 1 }, request, 1001)).rejects.toMatchObject(forbidden);
    },
  );

  it("rejects identity/scope substitution and cannot widen a pinned space grant", async () => {
    const f = fixture(); const reference = await resolveAuthority(f.reader, identity, request, 1000);
    for (const override of [
      { principalId: "principal-b" }, { membershipId: "membership-b" }, { grantId: "grant-b" },
      { tenantId: "tenant-b" }, { memorySpaceId: "space-b" },
    ]) await expect(resolveAuthorityReference(f.reader, { ...reference, ...override }, request, 1001)).rejects.toMatchObject(forbidden);
    await expect(resolveAuthorityReference(f.reader, reference, { ...request, memorySpaceId: "space-b" }, 1001)).rejects.toMatchObject(forbidden);
  });

  it("requires admission to pin the concrete space before tenant-wide background work reads that space", async () => {
    const f = fixture(); f.grant.memorySpaceId = undefined; f.grant.memorySpaceEpoch = undefined; f.grant.resourceAccess = "tenant";
    const tenantReference = await resolveAuthority(f.reader, identity, { capability: "read", tenantId: "tenant-a" }, 1000);
    expect(tenantReference.memorySpaceId).toBeUndefined();
    await expect(resolveAuthorityReference(f.reader, tenantReference, request, 1001)).rejects.toMatchObject(forbidden);
    const spaceReference = await resolveAuthority(f.reader, identity, request, 1000);
    expect(await resolveAuthorityReference(f.reader, spaceReference, request, 1001)).toEqual(spaceReference);
  });

  it.each(["read", "effect", "commit"])("stops a later sensitive %s after a resource tombstone without relying on a session", async () => {
    const f = fixture(); const scoped = { ...request, resource };
    const reference = await resolveAuthority(f.reader, identity, scoped, 1000);
    f.tombstones.push({ tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "memory", resourceId: "memory-a" });
    await expect(resolveAuthorityReference(f.reader, reference, scoped, 1001)).rejects.toMatchObject(forbidden);
  });

  it("rejects tenant-wide resource tombstones and deletion even if a row was physically recreated", async () => {
    const f = fixture(); const reference = await resolveAuthority(f.reader, identity, request, 1000);
    f.tombstones.push({ tenantId: "tenant-a", resourceType: "memory", resourceId: "memory-a" });
    await expect(resolveAuthorityReference(f.reader, reference, { ...request, resource }, 1001)).rejects.toMatchObject(forbidden);
    f.tombstones.length = 0; f.scopes[1]!.deletedAt = 1001; f.scopes[1]!.epoch = 2;
    await expect(resolveAuthorityReference(f.reader, reference, request, 1002)).rejects.toMatchObject(forbidden);
  });

  it("checks ownership synchronously without accepting missing owner/tenant fields", async () => {
    const f = fixture(); const authority: RuntimeAuthority = await resolveAuthority(f.reader, identity, request, 1000);
    expect(() => assertResourceScope(authority, resource)).not.toThrow();
    for (const row of [{ ...resource, ownerPrincipalId: undefined }, { ...resource, tenantId: undefined }, { ...resource, memorySpaceId: "space-b" }]) {
      expect(() => assertResourceScope(authority, row)).toThrow("Access denied");
    }
  });
});
