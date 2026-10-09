import { jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import { dataAuthorityReference, recheckActionDataAuthority } from "../../convex-dev/runtimeDataAuth";
import type { RuntimeAuthority } from "../../convex-dev/lib/runtimeDomain/auth/verified";
const authority: RuntimeAuthority = { principalId: "principal", principalVersion: 3, membershipId: "membership", membershipVersion: 4, grantId: "grant", grantVersion: 5, tenantId: "owned-tenant", tenantEpoch: 6, memorySpaceId: "owned-space", memorySpaceEpoch: 7, actorKind: "user", userId: "metadata-owner", capabilities: ["read"], resourceAccess: "own" };
it("pins every actual reference fence while excluding resolved authority labels from the internal recheck validator", async () => {
  const runQuery = jest.fn(async (_reference: unknown, _args: unknown) => authority);
  await recheckActionDataAuthority({ runQuery } as Parameters<typeof recheckActionDataAuthority>[0], authority, "read");
  const [reference, args] = runQuery.mock.calls[0]!;
  expect(getFunctionName(reference as Parameters<typeof getFunctionName>[0])).toBe("runtimeAuth:recheck");
  expect(args).toEqual({ reference: { principalId: "principal", principalVersion: 3, membershipId: "membership", membershipVersion: 4, grantId: "grant", grantVersion: 5, tenantId: "owned-tenant", tenantEpoch: 6, memorySpaceId: "owned-space", memorySpaceEpoch: 7 }, requirement: { capability: "read", tenantId: "owned-tenant", memorySpaceId: "owned-space" } });
  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(authority.capabilities).toEqual(["read"]);
});
it("preserves omitted optional scope and propagates a denied pinned reference without retry", async () => {
  const { memorySpaceId: _space, memorySpaceEpoch: _epoch, ...tenantAuthority } = authority;
  const pinned = dataAuthorityReference(tenantAuthority);
  expect(pinned).not.toHaveProperty("memorySpaceId"); expect(pinned).not.toHaveProperty("memorySpaceEpoch");
  const denied = new Error("revoked grant"); const runQuery = jest.fn(async (_reference: unknown, _args: unknown): Promise<never> => { throw denied; });
  await expect(recheckActionDataAuthority({ runQuery } as Parameters<typeof recheckActionDataAuthority>[0], authority, "read")).rejects.toBe(denied);
  expect(runQuery).toHaveBeenCalledTimes(1);
});
