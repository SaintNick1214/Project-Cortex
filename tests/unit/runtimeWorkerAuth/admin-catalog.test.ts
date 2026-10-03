import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as admin from "../../../convex-dev/admin";
import * as graph from "../../../convex-dev/graphSync";
import * as governance from "../../../convex-dev/governance";
import schema from "../../../convex-dev/schema";
import { fixture, invoke, policy, type Registration } from "./fixture";
const internal = [
  ...Object.entries(admin).filter(([key]) => ["listTable", "deleteRecord", "clearTable", "countTable", "getAllCounts"].includes(key)).map(([key, value]) => [`admin:${key}`, value]),
  ...Object.entries(graph).map(([key, value]) => [`graphSync:${key}`, value]),
  ...["enforce", "purgeAllPolicies", "purgeAllEnforcement"].map((key) => [`governance:${key}`, (governance as unknown as Record<string, unknown>)[key]]),
] as [string, unknown][];
const publicPaths = ["setPolicy", "setAgentOverride", "getPolicy", "getTemplate", "simulate", "getComplianceReport", "getEnforcementStats"];
describe("internal deployment-operator maintenance", () => {
  it("listTable/countTable/getAllCounts operate without target grants and stay on the fixed Cortex allowlist", async () => {
    const f = fixture(); const row = f.db.seed("governancePolicies", { policy: "metadata" });
    f.grant.revokedAt = 1000;
    expect(await invoke(admin.listTable, f.anonymous, { table: "governancePolicies" })).toEqual([row]);
    expect(await invoke(admin.countTable, f.anonymous, { table: "governancePolicies" })).toEqual({ count: 1, truncated: false });
    const counts = await invoke<Record<string, unknown>>(admin.getAllCounts, f.anonymous, {});
    expect(counts.governancePolicies).toEqual({ count: 1, truncated: false });
    expect(Object.keys(counts)).toHaveLength(14);
    expect(counts.runtimeAuthTombstones).toBeUndefined(); expect(counts.runtimeMemorySources).toBeUndefined(); expect(counts._storage).toBeUndefined();
  });
  it.each(["listTable", "countTable", "clearTable", "deleteRecord"])("%s rejects forged/control table selectors with typed invalid input", async (key) => {
    const f = fixture();
    const registration = (admin as unknown as Record<string, unknown>)[key];
    await expect(invoke(registration, f.anonymous, { table: "runtimeAuthGrants", id: f.grant._id })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(f.db.writes).toBe(0);
  });
  it("deleteRecord validates table-ID equality before any deletion", async () => {
    const f = fixture(); const queue = f.db.seed("graphSyncQueue", { synced: false });
    await expect(invoke(admin.deleteRecord, f.anonymous, { table: "governancePolicies", id: queue._id })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(f.db.table("graphSyncQueue")).toEqual([queue]); expect(f.db.writes).toBe(0);
  });
  it("deleteRecord cleans policy log references and preserves auth/source/tombstone fences", async () => {
    const f = fixture(); const created = await invoke<{ policyId: string }>(governance.setPolicy, f.ctx, { policy });
    await invoke(governance.enforce, f.ctx, { policyId: created.policyId });
    const source = f.db.seed("runtimeMemorySources", { source: "retained" });
    const fence = f.db.seed("runtimeAuthTombstones", { resourceType: "source", resourceId: "retained" });
    f.grant.revokedAt = 1000;
    expect(await invoke(admin.deleteRecord, f.anonymous, { table: "governancePolicies", id: created.policyId })).toEqual({ deleted: true });
    expect(f.db.table("governancePolicies")).toHaveLength(0); expect(f.db.table("governanceEnforcement")).toHaveLength(0);
    expect(f.db.table("runtimeMemorySources")).toEqual([source]); expect(f.db.table("runtimeAuthTombstones")).toEqual([fence]);
    expect(f.db.table("runtimeAuthGrants")).toHaveLength(1);
  });
  it("clearTable removes bounded queue metadata, leaves canonical data and reports hasMore", async () => {
    const f = fixture(); f.db.seed("graphSyncQueue", { entityId: "a" }); f.db.seed("graphSyncQueue", { entityId: "b" });
    const fact = f.db.seed("facts", { fact: "retained" });
    expect(await invoke(admin.clearTable, f.anonymous, { table: "graphSyncQueue", limit: 1 })).toEqual({ deleted: 1, hasMore: true });
    expect(f.db.table("graphSyncQueue")).toHaveLength(1); expect(f.db.table("facts")).toEqual([fact]);
  });
  it.each(["agents", "artifacts", "contexts", "conversations", "factHistory", "facts", "immutable", "memories", "memorySpaces", "mutable", "sessions"])("unsafe %s deletion/clear has a typed unsupported lifecycle outcome", async (table) => {
    const f = fixture(); const row = f.db.seed(table, { content: "retained" });
    for (const [registration, args] of [[admin.deleteRecord, { table, id: row._id }], [admin.clearTable, { table }]]) {
      await expect(invoke(registration, f.anonymous, args)).rejects.toMatchObject({ data: { code: "UNSUPPORTED_OPERATION" } });
    }
    expect(f.db.table(table)).toEqual([row]); expect(f.db.writes).toBe(0);
  });
  it.each([0, -1, 1001, NaN, Infinity, 1.5])("invalid maintenance limit %s performs no destructive work", async (limit) => {
    const f = fixture(); f.db.seed("graphSyncQueue", { entityId: "a" });
    await expect(invoke(admin.clearTable, f.anonymous, { table: "graphSyncQueue", limit })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(f.db.table("graphSyncQueue")).toHaveLength(1); expect(f.db.writes).toBe(0);
  });
  it.each([[governance.purgeAllPolicies, "governancePolicies"], [governance.purgeAllEnforcement, "governanceEnforcement"], [graph.purgeAll, "graphSyncQueue"]])("operator purge cleans only selected metadata despite revoked target", async (registration, table) => {
    const f = fixture(); f.grant.revokedAt = 1000; f.db.seed(table as string, { metadata: true });
    const source = f.db.seed("runtimeMemorySources", { source: "permanent" });
    const fence = f.db.seed("runtimeAuthTombstones", { resourceId: "permanent" });
    expect(await invoke(registration, f.anonymous, {})).toEqual({ deleted: 1 });
    expect(f.db.table(table as string)).toHaveLength(0); expect(f.db.table("runtimeMemorySources")).toEqual([source]);
    expect(f.db.table("runtimeAuthTombstones")).toEqual([fence]); expect(f.db.table("runtimeAuthGrants")).toHaveLength(1);
  });
  it("clearTable rolls back earlier metadata deletions on a later database failure", async () => {
    const f = fixture(); const first = f.db.seed("graphSyncQueue", { entityId: "a" }); const second = f.db.seed("graphSyncQueue", { entityId: "b" });
    f.db.beforeRead = (table) => { if (table === "graphSyncQueue" && f.db.writes === 1) throw new Error("Transactional failure"); };
    await expect(f.db.transaction(async () => await invoke(admin.clearTable, f.anonymous, { table: "graphSyncQueue" }))).rejects.toThrow("Transactional failure");
    expect(f.db.table("graphSyncQueue")).toEqual([first, second]); expect(f.db.writes).toBe(0);
  });
});
describe("actual registered visibility and canonical schema/AST catalog", () => {
  it.each(internal)("%s has internal registration visibility, unavailable through api", (_key, registration) => {
    expect((registration as Registration).isInternal).toBe(true);
    expect((registration as Registration).isPublic).toBeUndefined();
    expect(typeof (registration as Registration)._handler).toBe("function");
  });
  it.each(publicPaths)("governance:%s stays public with guarded handler", (key) => {
    const registration = (governance as unknown as Record<string, Registration>)[key]!;
    expect(registration.isPublic).toBe(true); expect(registration.isInternal).toBeUndefined();
  });
  it("native Convex schema export retains all 02B/auth/host tables and scoped indexes", () => {
    const serialized = JSON.parse((schema as unknown as { export(): string }).export()) as { tables: { tableName: string; indexes: { indexDescriptor: string; fields: string[] }[] }[] };
    const policyTable = serialized.tables.find((table) => table.tableName === "governancePolicies")!;
    const graphTable = serialized.tables.find((table) => table.tableName === "graphSyncQueue")!;
    expect(policyTable.indexes).toContainEqual({ indexDescriptor: "by_runtime_scope_active", fields: ["tenantId", "memorySpaceId", "isActive"] });
    expect(graphTable.indexes).toContainEqual({ indexDescriptor: "by_runtime_worker_state", fields: ["tenantId", "memorySpaceId", "authority.grantId", "synced", "priority"] });
    expect(serialized.tables.some((table) => table.tableName === "runtimeAuthTombstones")).toBe(true);
    expect(serialized.tables.some((table) => table.tableName === "runtimeMemorySources")).toBe(true);
  });
  it("composing D metadata definitions preserves controlled host validators/indexes and trusted control tables", () => {
    // Historical fixed-base qualification remains in frozen QA. Normal tests exercise additive host
    // composition without constraining later approved changes to unrelated production tables.
    const existing = {
      hostOrders: defineTable({ accountId: v.string(), totalCents: v.number(), state: v.union(v.literal("open"), v.literal("paid")) })
        .index("by_account_state", ["accountId", "state"]),
      hostIdentityProviders: defineTable({ issuer: v.string(), audience: v.string(), enabled: v.boolean() })
        .index("by_issuer", ["issuer"]),
      runtimeAuthPrincipals: schema.tables.runtimeAuthPrincipals,
      runtimeAuthMemberships: schema.tables.runtimeAuthMemberships,
      runtimeAuthScopes: schema.tables.runtimeAuthScopes,
      runtimeAuthGrants: schema.tables.runtimeAuthGrants,
      runtimeAuthTombstones: schema.tables.runtimeAuthTombstones,
      runtimeMemorySources: schema.tables.runtimeMemorySources,
    };
    const additions = {
      governancePolicies: schema.tables.governancePolicies,
      governanceEnforcement: schema.tables.governanceEnforcement,
      graphSyncQueue: schema.tables.graphSyncQueue,
    };
    type NativeTable = { tableName: string; documentType: unknown; indexes: unknown[] };
    function exported(definition: unknown): NativeTable[] {
      return (JSON.parse((definition as { export(): string }).export()) as { tables: NativeTable[] }).tables;
    }
    const before = exported(defineSchema(existing));
    const after = exported(defineSchema({ ...existing, ...additions }));
    expect(after).toHaveLength(before.length + 3);
    for (const table of before) expect(after.find((candidate) => candidate.tableName === table.tableName)).toEqual(table);
    // Compare the complete native validator/index export for all three actual D definitions too.
    const production = exported(schema);
    for (const tableName of Object.keys(additions)) {
      expect(after.find((table) => table.tableName === tableName)).toEqual(production.find((table) => table.tableName === tableName));
    }
    expect(before.find((table) => table.tableName === "hostOrders")?.indexes).toContainEqual({ indexDescriptor: "by_account_state", fields: ["accountId", "state"] });
    expect(before.find((table) => table.tableName === "hostIdentityProviders")?.indexes).toContainEqual({ indexDescriptor: "by_issuer", fields: ["issuer"] });
  });
  it("native public/internal validators reject caller entity/admin metadata and require worker references", () => {
    function args(registration: unknown) {
      return JSON.parse((registration as { exportArgs(): string }).exportArgs()) as { value: Record<string, { optional: boolean }> };
    }
    expect(args(graph.queueForSync).value.entity).toBeUndefined();
    expect(args(graph.queueForSync).value.authority).toMatchObject({ optional: false });
    expect(args(graph.markSynced).value.authority).toMatchObject({ optional: false });
    expect(Object.keys(args(admin.getAllCounts).value)).toEqual([]);
    expect(args(governance.setPolicy).value.policy).toMatchObject({ optional: false });
  });
  it("AST inventory resolves exact 25 frozen paths with seven public and eighteen internal", () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-task03b2d-catalog-"));
    try {
      const run = spawnSync(process.execPath, ["_goals/convex-backend-runtime-2026-10-02/qa/task03b2d/inventory.mjs", target], { cwd: process.cwd(), encoding: "utf8" });
      expect({ status: run.status, stderr: run.stderr }).toEqual({ status: 0, stderr: "" });
      const inventory = JSON.parse(fs.readFileSync(path.join(target, "public-path-inventory.json"), "utf8")) as {
        completeness: { unresolved: string[] }; endpoints: { path: string; visibility: string }[];
      };
      expect(inventory.completeness.unresolved).toEqual([]);
      const selected = inventory.endpoints.filter((entry) => /^(?:governance|admin|graphSync):/.test(entry.path));
      expect(selected).toHaveLength(25); expect(selected.filter((entry) => entry.visibility === "public")).toHaveLength(7);
      expect(selected.filter((entry) => entry.visibility === "internal")).toHaveLength(18);
      for (const [key] of internal) expect(selected.find((entry) => entry.path === key)).toMatchObject({ visibility: "internal" });
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
    expect(fs.existsSync(target)).toBe(false);
  });
});
