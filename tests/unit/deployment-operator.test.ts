import { jest } from "@jest/globals";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { ConvexClient } from "convex/browser";
import type { MutationCtx, QueryCtx } from "../../convex-dev/_generated/server";
import { enableDeploymentOperator, isDeploymentOperatorClient } from "../../src/common/deploymentOperator";
import { operatorMutation, assertLegacyDomainScope } from "../../convex-dev/lib/operatorBoundary";
import * as spaces from "../../convex-dev/cliOperator/memorySpaces";
import * as publicSpaces from "../../convex-dev/memorySpaces";

describe("explicit deployment operator contract", () => {
  it("routes only allowlisted legacy references and preserves arguments/results", async () => {
    const names: string[] = [], selected = { tenantId: "tenant-A", memorySpaceId: "space-A", userId: "user-A" };
    const result = { persisted: true };
    const call = jest.fn(async (reference: unknown, args: unknown) => {
      names.push(getFunctionName(reference as Parameters<typeof getFunctionName>[0]));
      expect(args).toBe(selected);
      return result;
    });
    const client = { query: call, mutation: call, action: call, onUpdate: call } as unknown as ConvexClient;
    expect(isDeploymentOperatorClient(client)).toBe(false);
    enableDeploymentOperator(client); enableDeploymentOperator(client);
    expect(isDeploymentOperatorClient(client)).toBe(true);
    await expect(client.query(makeFunctionReference<"query">("memorySpaces:list"), selected)).resolves.toBe(result);
    await expect(client.mutation(makeFunctionReference<"mutation">("memories:update"), selected)).resolves.toBe(result);
    await expect(client.action(makeFunctionReference<"action">("facts:semanticSearch"), selected)).resolves.toBe(result);
    await expect(client.query(makeFunctionReference<"query">("runtimeMemory:recall"), selected)).resolves.toBe(result);
    await expect(client.query(makeFunctionReference<"query">("referenceMaintenance:status"), selected)).resolves.toBe(result);
    expect(names).toEqual(["cliOperator/memorySpaces:list", "cliOperator/memories:update", "cliOperator/facts:semanticSearch", "runtimeMemory:recall", "referenceMaintenance:status"]);
  });

  it("retains separate public and internal registrations", () => {
    expect(spaces.register.isInternal).toBe(true);
    expect(spaces.register).not.toHaveProperty("isPublic");
    expect(publicSpaces.register.isPublic).toBe(true);
    expect(publicSpaces.register).not.toHaveProperty("isInternal");
  });

  const write = operatorMutation({ args: { id: v.string(), value: v.number() },
    handler: async (ctx, args) => { await ctx.db.patch(args.id as never, { value: args.value }); return { updated: true }; } });

  function invoke(ctx: MutationCtx, args: { id: string; value: number }): Promise<{ updated: boolean }> {
    const registration: unknown = write;
    if (typeof registration !== "function" || !("_handler" in registration) || typeof registration._handler !== "function") throw new Error("Missing actual Convex registration handler");
    return Reflect.apply(registration._handler, registration, [ctx, args]) as Promise<{ updated: boolean }>;
  }

  function fixture(row: Record<string, unknown>) {
    const persisted = { ...row };
    const patch = jest.fn(async (_id: unknown, fields: Record<string, unknown>) => { Object.assign(persisted, fields); });
    const ctx = { db: { get: async () => persisted, patch } } as unknown as MutationCtx;
    return { ctx, persisted, patch };
  }

  it("internal legacy operation performs the promised persisted update", async () => {
    const f = fixture({ _id: "legacy-row", tenantId: "tenant-A", value: 1 });
    await expect(invoke(f.ctx, { id: "legacy-row", value: 2 })).resolves.toEqual({ updated: true });
    expect(f.persisted.value).toBe(2); expect(f.patch).toHaveBeenCalledTimes(1);
  });

  it.each(["ownerPrincipalId", "lineage", "runtimeEditor", "manualSourceBinding", "tombstonedAt", "authority", "authorityReference"])("refuses runtime %s before any persisted effect", async (field) => {
    const f = fixture({ _id: "protected-row", tenantId: "tenant-A", value: 1, [field]: "runtime-witness" });
    await expect(invoke(f.ctx, { id: "protected-row", value: 2 })).rejects.toMatchObject({ data: { code: "UNSUPPORTED_OPERATION", outcome: "not_dispatched" } });
    expect(f.persisted.value).toBe(1); expect(f.patch).not.toHaveBeenCalled();
  });

  it("refuses legacy complete export/erasure in a runtime scope, including deleted scopes", async () => {
    const selectors: unknown[] = [];
    const query = { eq: (name: string, value: unknown) => { selectors.push([name, value]); return query; } };
    const ctx = { db: { query: (table: string) => {
      expect(table).toBe("runtimeAuthScopes");
      return { withIndex: (name: string, select: (q: typeof query) => unknown) => {
        expect(name).toBe("by_tenant_space"); select(query); return { first: async () => ({ tenantId: "tenant-A", memorySpaceId: "space-A", deletedAt: 1 }) };
      } };
    } } } as unknown as QueryCtx;
    await expect(assertLegacyDomainScope(ctx, "tenant-A", "space-A")).rejects.toMatchObject({ data: { code: "UNSUPPORTED_OPERATION" } });
    expect(selectors).toEqual([["tenantId", "tenant-A"], ["memorySpaceId", "space-A"]]);
  });
});
