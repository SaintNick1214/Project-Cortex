import { describe, expect, it } from "@jest/globals";
import {
  authorize, createAuthorityReader, deletePrincipal, deleteScope, provision, recheck,
  recheckAuthority, requireAuthority, revokeGrant, revokeMembership, tombstoneResource,
} from "../../../convex-dev/runtimeAuth";
import { getFunctionName } from "convex/server";
import { retireAuthority as retireGraphAuthority } from "../../../convex-dev/runtimeGraph";
import { retireAuthority as retireAssetAuthority } from "../../../convex-dev/runtimeAssets";
import { DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import type { RuntimeActorKind, RuntimeAuthority, RuntimeAuthorityReference, RuntimeAuthorityRequirement, RuntimeCapability, RuntimeResourceAccess, RuntimeResourceType } from "../../../src/auth/verified";

/** Convex exposes this runtime test hook but strips it from its published .d.ts. */
function handler<Args, Result>(registration: unknown): (ctx: MutationCtx, args: Args) => Promise<Result> {
  return (registration as { _handler: (ctx: MutationCtx, args: Args) => Promise<Result> })._handler;
}
type ProvisionArgs = {
  issuer: string; subject: string; actorKind: RuntimeActorKind; metadataUserId?: string;
  tenantId: string; memorySpaceId?: string; capabilities: RuntimeCapability[];
  resourceAccess: RuntimeResourceAccess; expiresAt?: number;
};
const provisionHandler = handler<ProvisionArgs, RuntimeAuthority>(provision);
const authorizeHandler = handler<{ requirement: RuntimeAuthorityRequirement }, RuntimeAuthority>(authorize);
const recheckHandler = handler<{ reference: RuntimeAuthorityReference; requirement: RuntimeAuthorityRequirement }, RuntimeAuthority>(recheck);
const revokeGrantHandler = handler<{ grantId: Id<"runtimeAuthGrants"> }, void>(revokeGrant);
const revokeMembershipHandler = handler<{ membershipId: Id<"runtimeAuthMemberships"> }, void>(revokeMembership);
const deletePrincipalHandler = handler<{ principalId: Id<"runtimeAuthPrincipals"> }, void>(deletePrincipal);
const deleteScopeHandler = handler<{ tenantId: string; memorySpaceId?: string }, void>(deleteScope);
const tombstoneHandler = handler<{ tenantId: string; memorySpaceId?: string; resourceType: RuntimeResourceType; resourceId: string }, void>(tombstoneResource);

type Row = { _id: string; [field: string]: unknown };
/** In-memory adapter harness, not a substitute for Convex transaction/live endpoint QA in 03B. */
class MemoryDb {
  readonly rows = new Map<string, Row[]>();
  readonly writes: string[] = [];
  private next = 1;

  normalizeId(table: string, id: string) { return id.startsWith(`${table}/`) ? id : null; }
  query(table: string) {
    type Expr = (row: Row) => unknown;
    const field = (row: Row, key: string) => key.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined, row);
    const value = (input: unknown, row: Row) => typeof input === "function" ? (input as Expr)(row) : input;
    const predicates: Expr[] = [];
    const selected = () => (this.rows.get(table) ?? []).filter(row => predicates.every(test => test(row)));
    const filters = { field: (key: string): Expr => row => field(row, key), eq: (a: unknown, b: unknown): Expr => row => value(a, row) === value(b, row), and: (...tests: Expr[]): Expr => row => tests.every(test => test(row)) };
    const result = {
      withIndex: (_name: string, callback: (q: { eq(key: string, expected: unknown): unknown; gt(key: string, expected: unknown): unknown }) => unknown) => {
        const q = { eq: (key: string, expected: unknown) => { predicates.push(row => field(row, key) === expected); return q; }, gt: (key: string, expected: unknown) => { predicates.push(row => (field(row, key) as string) > (expected as string)); return q; } };
        callback(q); return result;
      },
      filter: (callback: (q: typeof filters) => Expr) => { predicates.push(callback(filters)); return result; },
      unique: async () => { const values = selected(); if (values.length > 1) throw new Error("Duplicate unique control record"); return values[0] ?? null; },
      take: async (limit: number) => selected().slice(0, limit), collect: async () => selected(),
      paginate: async (options: { cursor: string | null; numItems: number }) => { const rows = selected(); const offset = Number(options.cursor ?? 0); return { page: rows.slice(offset, offset + options.numItems), isDone: offset + options.numItems >= rows.length, continueCursor: String(offset + options.numItems) }; },
    };
    return result;
  }
  async get(table: string, id: string) { return (this.rows.get(table) ?? []).find((row) => row._id === id) ?? null; }
  async insert(table: string, fields: Record<string, unknown>) {
    const _id = `${table}/${this.next++}`;
    this.rows.set(table, [...(this.rows.get(table) ?? []), { ...fields, _id }]);
    this.writes.push(`insert:${table}`); return _id;
  }
  async patch(table: string, id: string, fields: Record<string, unknown>) {
    const row = await this.get(table, id);
    if (!row) throw new Error("Missing row");
    Object.assign(row, fields); this.writes.push(`patch:${table}`);
  }
  async replace(table: string, id: string, fields: Record<string, unknown>) {
    const row = await this.get(table, id); if (!row) throw new Error("Missing row");
    const rows = this.rows.get(table)!; rows[rows.indexOf(row)] = { ...fields, _id: id }; this.writes.push(`replace:${table}`);
  }
  async delete(table: string, id: string) { this.rows.set(table, (this.rows.get(table) ?? []).filter(row => row._id !== id)); this.writes.push(`delete:${table}`); }

}

const identity = { issuer: "https://host.test", subject: "alice", tokenIdentifier: "ignored-token-identifier" };
const provisionArgs = {
  issuer: identity.issuer, subject: identity.subject, actorKind: "user" as const, metadataUserId: "metadata-alice",
  tenantId: "tenant-a", memorySpaceId: "space-a", capabilities: ["read", "write", "run"] as Array<"read" | "write" | "run">,
  resourceAccess: "own" as const,
};
const requirement = { capability: "read" as const, tenantId: "tenant-a", memorySpaceId: "space-a" };
const forbidden = { data: { code: "FORBIDDEN" } };
function harness(verified: Record<string, unknown> | null = identity) {
  const db = new MemoryDb();
  let identityReads = 0;
  // The harness implements only operations consumed by these handlers; production ctx is Convex-owned.
  const childCalls: { name: string; args: Record<string, unknown> }[] = [];
  const scheduled: { name: string; args: unknown }[] = [];
  const ctx = { db, auth: { getUserIdentity: async () => { identityReads++; return verified; } },
    scheduler: { runAfter: async (_delay: number, ref: Parameters<typeof getFunctionName>[0], args: unknown) => { scheduled.push({ name: getFunctionName(ref), args }); return `scheduled/${scheduled.length}`; } },
    runMutation: async (ref: Parameters<typeof getFunctionName>[0], args: Record<string, unknown>) => {
      const name = getFunctionName(ref); childCalls.push({ name, args });
      const registrations: Record<string, unknown> = { "runtimeGraph:retireAuthority": retireGraphAuthority, "runtimeAssets:retireAuthority": retireAssetAuthority };
      const registration = registrations[name]; if (!registration) throw new Error(`Unexpected child mutation ${name}`);
      return await handler<Record<string, unknown>, unknown>(registration)(ctx as unknown as MutationCtx, args);
    },
  } as unknown as MutationCtx;
  return { db, ctx, childCalls, scheduled, identityReads: () => identityReads };
}

describe("internal bootstrap and trusted control table adapters", () => {
  it("exposes no public provisioning, revocation, deletion, or action authority resolver", () => {
    for (const registration of [authorize, recheck, provision, revokeGrant, revokeMembership, deletePrincipal, deleteScope, tombstoneResource]) {
      expect(registration.isInternal).toBe(true);
      expect("isPublic" in registration).toBe(false);
    }
  });

  it("provisions only trusted control records, returns immutable references and is idempotent", async () => {
    const h = harness(null);
    const first = await provisionHandler(h.ctx, provisionArgs);
    const writeCount = h.db.writes.length;
    const second = await provisionHandler(h.ctx, provisionArgs);
    expect(second).toEqual(first);
    expect(h.db.writes).toHaveLength(writeCount);
    expect(first).toMatchObject({ principalVersion: 1, membershipVersion: 1, grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1, userId: "metadata-alice" });
    expect(h.db.rows.get("runtimeAuthGrants")).toHaveLength(1);
    expect(h.identityReads()).toBe(0); // Operator internal invocation does not impersonate a public JWT admin.
  });

  it("resolves public identity through Convex auth and never uses tokenIdentifier or admin metadata", async () => {
    const h = harness({ ...identity, tenantId: "tenant-forged", userId: "forged", roles: ["admin"] });
    await provisionHandler(h.ctx, provisionArgs);
    const writeCount = h.db.writes.length;
    const resolved = await requireAuthority(h.ctx, requirement);
    expect(resolved).toMatchObject({ tenantId: "tenant-a", userId: "metadata-alice" });
    expect(h.identityReads()).toBe(1);
    expect(h.db.writes).toHaveLength(writeCount);
    await expect(requireAuthority(h.ctx, { ...requirement, capability: "admin" })).rejects.toMatchObject(forbidden);
    const attacker = harness({ ...identity, subject: "attacker", tokenIdentifier: `${identity.issuer}|alice`, userId: "metadata-alice", roles: ["admin"] });
    await provisionHandler(attacker.ctx, provisionArgs);
    await expect(requireAuthority(attacker.ctx, requirement)).rejects.toMatchObject(forbidden);
  });

  it("returns UNAUTHENTICATED for missing auth without self-provisioning", async () => {
    const h = harness(null);
    await expect(authorizeHandler(h.ctx, { requirement })).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
    expect(h.db.writes).toEqual([]);
    expect(h.db.rows.size).toBe(0);
  });

  it("adapts internal action authorization and sessionless background rechecks without mutating authority", async () => {
    const h = harness(); const reference = await provisionHandler(h.ctx, provisionArgs);
    expect(await authorizeHandler(h.ctx, { requirement })).toEqual(reference);
    const reads = h.identityReads();
    expect(await recheckAuthority(h.ctx, reference, requirement)).toEqual(reference);
    expect(await recheckHandler(h.ctx, { reference, requirement })).toEqual(reference);
    expect(h.identityReads()).toBe(reads);
    await expect(recheckHandler(h.ctx, { reference: { ...reference, grantVersion: 999 }, requirement })).rejects.toMatchObject(forbidden);
  });

  it("replaces changed capabilities with a new grant generation and invalidates pending old work", async () => {
    const h = harness(); const first = await provisionHandler(h.ctx, provisionArgs);
    const second = await provisionHandler(h.ctx, { ...provisionArgs, capabilities: ["read"] });
    expect(second.grantId).not.toBe(first.grantId);
    expect(second.grantVersion).toBe(2);
    expect(second.capabilities).toEqual(["read"]);
    expect(h.db.rows.get("runtimeAuthGrants")?.[0]?.revokedAt).toEqual(expect.any(Number));
    await expect(recheckAuthority(h.ctx, first, requirement)).rejects.toMatchObject(forbidden);
    expect(await recheckAuthority(h.ctx, second, requirement)).toEqual(second);
    await expect(requireAuthority(h.ctx, { ...requirement, capability: "run" })).rejects.toMatchObject(forbidden);
  });

  it("revokes an exact grant permanently; only an explicit trusted new generation can issue later authority", async () => {
    const h = harness(); const first = await provisionHandler(h.ctx, provisionArgs);
    await revokeGrantHandler(h.ctx, { grantId: first.grantId as Id<"runtimeAuthGrants"> });
    const writes = h.db.writes.length;
    await revokeGrantHandler(h.ctx, { grantId: first.grantId as Id<"runtimeAuthGrants"> });
    expect(h.db.writes).toHaveLength(writes);
    await expect(requireAuthority(h.ctx, requirement)).rejects.toMatchObject(forbidden);
    const second = await provisionHandler(h.ctx, provisionArgs);
    expect(second.grantVersion).toBe(2);
    await expect(recheckAuthority(h.ctx, first, requirement)).rejects.toMatchObject(forbidden);
    expect(await requireAuthority(h.ctx, requirement)).toEqual(second);
  });

  it("retains membership revocation fences and refuses to re-provision the same membership", async () => {
    const h = harness(); const first = await provisionHandler(h.ctx, provisionArgs);
    await revokeMembershipHandler(h.ctx, { membershipId: first.membershipId as Id<"runtimeAuthMemberships"> });
    await expect(recheckAuthority(h.ctx, first, requirement)).rejects.toMatchObject(forbidden);
    await expect(provisionHandler(h.ctx, provisionArgs)).rejects.toMatchObject(forbidden);
    const writes = h.db.writes.length;
    await revokeMembershipHandler(h.ctx, { membershipId: first.membershipId as Id<"runtimeAuthMemberships"> });
    expect(h.db.writes).toHaveLength(writes);
    expect(h.db.rows.get("runtimeAuthMemberships")).toHaveLength(1);
  });

  it("retains principal deletion fences and refuses issuer/subject recreation", async () => {
    const h = harness(); const first = await provisionHandler(h.ctx, provisionArgs);
    await deletePrincipalHandler(h.ctx, { principalId: first.principalId as Id<"runtimeAuthPrincipals"> });
    await expect(recheckAuthority(h.ctx, first, requirement)).rejects.toMatchObject(forbidden);
    await expect(provisionHandler(h.ctx, provisionArgs)).rejects.toMatchObject(forbidden);
    const writes = h.db.writes.length;
    await deletePrincipalHandler(h.ctx, { principalId: first.principalId as Id<"runtimeAuthPrincipals"> });
    expect(h.db.writes).toHaveLength(writes);
    expect(h.db.rows.get("runtimeAuthPrincipals")).toHaveLength(1);
  });

  it.each([undefined, "space-a"])("fences deleted scope %s and prevents bootstrap recreation", async (memorySpaceId) => {
    const h = harness(); const first = await provisionHandler(h.ctx, provisionArgs);
    await deleteScopeHandler(h.ctx, { tenantId: "tenant-a", memorySpaceId });
    await expect(recheckAuthority(h.ctx, first, requirement)).rejects.toMatchObject(forbidden);
    await expect(provisionHandler(h.ctx, provisionArgs)).rejects.toMatchObject(forbidden);
    const writes = h.db.writes.length;
    await deleteScopeHandler(h.ctx, { tenantId: "tenant-a", memorySpaceId });
    expect(h.db.writes).toHaveLength(writes);
    const deleted = h.db.rows.get("runtimeAuthScopes")?.find((row) => row.memorySpaceId === memorySpaceId);
    expect(deleted).toMatchObject({ epoch: 2, deletedAt: expect.any(Number) });
    expect(h.db.rows.get("runtimeAuthTombstones")).toHaveLength(1);
  });

  it("records deletion even before a scope is provisioned, preventing later resurrection", async () => {
    const h = harness();
    await deleteScopeHandler(h.ctx, { tenantId: "tenant-a", memorySpaceId: "space-a" });
    await expect(provisionHandler(h.ctx, provisionArgs)).rejects.toMatchObject(forbidden);
    expect(h.db.rows.get("runtimeAuthPrincipals")).toBeUndefined();
  });

  it("tombstones a resource idempotently and rejects its delayed read/commit", async () => {
    const h = harness(); const first = await provisionHandler(h.ctx, provisionArgs);
    const key = { tenantId: "tenant-a", memorySpaceId: "space-a", resourceType: "memory" as const, resourceId: "memory-a" };
    await tombstoneHandler(h.ctx, key);
    const writes = h.db.writes.length;
    await tombstoneHandler(h.ctx, key);
    expect(h.db.writes).toHaveLength(writes);
    await expect(recheckAuthority(h.ctx, first, { ...requirement, resource: { ...key, ownerPrincipalId: first.principalId } })).rejects.toMatchObject(forbidden);
    expect(h.db.rows.get("runtimeAuthTombstones")).toHaveLength(1);
    await expect(tombstoneHandler(h.ctx, { ...key, resourceId: " " })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
  });

  it("revocation dispatches actual retirement and replaces only the matching graph intent with a tombstone", async () => {
    const h = harness(); const authority = await provisionHandler(h.ctx, provisionArgs);
    const common = { tenantId: "tenant-a", memorySpaceId: "space-a", sourceEventId: "event-a", sourceRevision: 1, contentHash: "a".repeat(64), ownerPrincipalId: authority.principalId,
      profile: DEFAULT_EMBEDDING_PROFILE, revision: 1, payloadHash: "b".repeat(64), operation: "replace", state: "complete", updatedAt: 1 };
    const owned = await h.db.insert("runtimeGraphSources", { ...common, sourceId: "owned-source", authorityReference: authority });
    const other = await h.db.insert("runtimeGraphSources", { ...common, sourceId: "other-source", authorityReference: { ...authority, grantId: "runtimeAuthGrants/other" } });
    await revokeGrantHandler(h.ctx, { grantId: authority.grantId as Id<"runtimeAuthGrants"> });
    expect(h.childCalls).toEqual([{ name: "runtimeGraph:retireAuthority", args: { grantId: authority.grantId } }]);
    expect(await h.db.get("runtimeGraphSources", owned)).toMatchObject({ operation: "tombstone", state: "pending", revision: 1 });
    expect((await h.db.get("runtimeGraphSources", owned))?.authorityReference).toBeUndefined();
    expect(await h.db.get("runtimeGraphSources", other)).toMatchObject({ operation: "replace", authorityReference: { grantId: "runtimeAuthGrants/other" } });
    expect(h.db.rows.get("runtimeGraphPayloads")).toHaveLength(1);
    expect(JSON.parse(String(h.db.rows.get("runtimeGraphPayloads")![0].payloadCanonical))).toMatchObject({ operation: "tombstone", facts: [], source: { sourceId: "owned-source" } });
    await expect(recheckAuthority(h.ctx, authority, requirement)).rejects.toMatchObject(forbidden);
  });

  it("scope deletion dispatches actual asset retirement while preserving other-scope edges", async () => {
    const h = harness(); await provisionHandler(h.ctx, provisionArgs);
    const owned = await h.db.insert("runtimeAssetReferences", { tenantId: "tenant-a", memorySpaceId: "space-a", versionId: "absent-version", active: true });
    const other = await h.db.insert("runtimeAssetReferences", { tenantId: "tenant-b", memorySpaceId: "space-a", versionId: "other-version", active: true });
    await deleteScopeHandler(h.ctx, { tenantId: "tenant-a", memorySpaceId: "space-a" });
    expect(h.childCalls.map(call => call.name)).toEqual(["runtimeGraph:retireAuthority", "runtimeAssets:retireAuthority"]);
    expect(await h.db.get("runtimeAssetReferences", owned)).toMatchObject({ active: false });
    expect(await h.db.get("runtimeAssetReferences", other)).toMatchObject({ active: true });
    expect(h.scheduled).toEqual([]);
  });

  it("rejects invalid provisioning, actor rebinding and metadata-user rebinding", async () => {
    const h = harness();
    for (const args of [
      { ...provisionArgs, issuer: " " }, { ...provisionArgs, capabilities: [] },
      { ...provisionArgs, resourceAccess: "space" as const, memorySpaceId: undefined },
      { ...provisionArgs, resourceAccess: "tenant" as const }, { ...provisionArgs, expiresAt: 1 },
    ]) await expect(provisionHandler(h.ctx, args)).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(h.db.writes).toEqual([]);
    await provisionHandler(h.ctx, provisionArgs);
    await expect(provisionHandler(h.ctx, { ...provisionArgs, actorKind: "service" })).rejects.toMatchObject(forbidden);
    await expect(provisionHandler(h.ctx, { ...provisionArgs, metadataUserId: "metadata-bob" })).rejects.toMatchObject(forbidden);
  });

  it("uses table-specific ID normalization and rejects duplicate exact issuer/subject records", async () => {
    const h = harness(); await provisionHandler(h.ctx, provisionArgs);
    const reader = createAuthorityReader(h.ctx);
    expect(await reader.getPrincipal("forged-principal")).toBeNull();
    expect(await reader.getMembership("forged-membership")).toBeNull();
    expect(await reader.getGrant("forged-grant")).toBeNull();
    expect(await reader.listMemberships("forged-principal")).toEqual([]);
    expect(await reader.listGrants("forged-membership")).toEqual([]);
    await h.db.insert("runtimeAuthPrincipals", { issuer: identity.issuer, subject: identity.subject, actorKind: "user", version: 1 });
    const writes = [...h.db.writes];
    await expect(requireAuthority(h.ctx, requirement)).rejects.toHaveProperty("data", {
      version: 1, code: "AUTHORITY_LOOKUP_AMBIGUOUS", message: "Authority lookup is ambiguous", retryable: false, outcome: "not_dispatched",
    });
    expect(h.db.writes).toEqual(writes);
  });
});
