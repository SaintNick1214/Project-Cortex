import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import schema from "../../../convex-dev/schema";
import { fixture, seedSpace, seedContext, invoke } from "./fixture";
import * as spaces from "../../../convex-dev/memorySpaces";
import * as contexts from "../../../convex-dev/contexts";
import { backendSource, catalogDeclarations, catalogFixture, catalogInventory, sha256, withComposedCatalog } from "../../helpers/backend-catalog";
describe("portable inventory, actual schema exports and preserved sources", () => {
  it("maintained inventory writes only owned temporary outputs and always removes them", () => {
    withComposedCatalog((destination, files) => {
      const actual = catalogInventory(Object.fromEntries(["agents", "memorySpaces", "contexts"].map(module => [module, files[`${module}.ts`].toString()])));
      expect(actual.completeness.unresolved).toEqual([]);
      expect(actual.endpoints).toHaveLength(48);
      const excluded = ["agents:computeStats", "memorySpaces:getStats"];
      const endpoints = actual.endpoints.filter(row => !excluded.includes(row.path));
      const baseline = catalogFixture<{ baseline: { endpoints: { path: string }[] } }>("transcript-historical.json").baseline;
      const expected = baseline.endpoints.filter(row => /^(agents|memorySpaces|contexts):/.test(row.path) && !excluded.includes(row.path));
      const dependencies = ['convex-dev/agents.ts', 'convex-dev/memorySpaces.ts', 'convex-dev/contexts.ts', 'convex-dev/runtimeRegistryAuth.ts', 'convex-dev/schema.ts', 'convex-dev/runtimeAuth.ts', 'convex-dev/runtimeAuthSchema.ts', 'src/auth/verified.ts', 'convex-dev/tsconfig.json'];
      const hashes = dependencies.map(file => ({ file, sha256: sha256(fs.readFileSync(file)) }));
      const output = `${destination}/selected-path-inventory.json`;
      fs.writeFileSync(output, JSON.stringify({ counts: { selected: endpoints.length, public: endpoints.filter(row => row.visibility === "public").length,
        internal: endpoints.filter(row => row.visibility === "internal").length, moduleRegistrations: actual.endpoints.length,
        excludedStats: actual.endpoints.length - endpoints.length, unresolved: actual.completeness.unresolved.length }, hashes, endpoints }));
      const inventory = JSON.parse(fs.readFileSync(output, "utf8")) as { counts: unknown; hashes: { file: string; sha256: string }[]; endpoints: { path: string; kind: string }[] };
      expect(inventory.counts).toEqual({ selected: 46, public: 43, internal: 3, moduleRegistrations: 48, excludedStats: 2, unresolved: 0 });
      expect(new Set(inventory.endpoints.map(endpoint => endpoint.path)).size).toBe(46);
      expect(inventory.endpoints.map(endpoint => endpoint.path).sort()).toEqual(expected.map(endpoint => endpoint.path).sort());
      for (const hash of inventory.hashes) expect(sha256(fs.readFileSync(hash.file))).toBe(hash.sha256);
      expect(inventory.endpoints.filter(endpoint => endpoint.kind === "internalMutation").map(endpoint => endpoint.path).sort()).toEqual(["agents:purgeAll", "contexts:purgeAll", "memorySpaces:purgeAll"]);
    });
  });
  it("native schema includes only additive ownership/lifecycle/index/editor fields and retains host tables", () => {
    const serialize = (value: unknown) => JSON.parse((value as { export(): string }).export()) as { tables: { tableName: string; documentType: { value: Record<string, unknown> }; indexes: { indexDescriptor: string; fields: string[] }[] }[] };
    const exported = serialize(schema);
    for (const name of ["agents", "memorySpaces", "contexts"]) {
      const table = exported.tables.find((value) => value.tableName === name)!;
      expect(table.documentType.value.ownerPrincipalId).toBeDefined(); expect(table.documentType.value.tombstonedAt).toBeDefined();
      expect(table.indexes.some((index) => index.indexDescriptor === "by_runtime_scope_owner")).toBe(true);
    }
    expect(exported.tables.find((value) => value.tableName === "contexts")!.documentType.value.lastUpdatedBy).toBeDefined();
    expect(exported.tables.find((value) => value.tableName === "agents")!.documentType.value.memorySpaceId).toBeDefined();
    const combined = serialize(defineSchema({ hostTable: defineTable({ preserved: v.string() }), ...schema.tables }));
    expect(combined.tables.map((value) => value.tableName)).toContain("hostTable"); expect(combined.tables).toHaveLength(exported.tables.length + 1);
  });
  it.each([["agents", "computeStats"], ["memorySpaces", "getStats"]])("historical accepted %s excluded registration remains byte-for-byte frozen; current closure stays pinned", (module, name) => {
    const historical = catalogFixture<Record<string, { sourceHash: string; name: string; declaration: string; sha256: string }>>("registry-statistics-historical.json")[module];
    expect(historical.name).toBe(name);
    expect(sha256(historical.declaration)).toBe(historical.sha256);
    expect(historical.declaration).toMatch(new RegExp(`^export const ${name} = query`));
    expect(historical.declaration).toContain('.query("memories")');
    const later = catalogFixture<Record<string, { sourceHash: string; declaration: string; sha256: string }>>("statistics-historical.json")[module];
    expect(sha256(backendSource(module))).toBe(later.sourceHash);
    const current = catalogDeclarations(backendSource(module)).find(row => row.name === name)!.declaration;
    expect(current).toBe(later.declaration);
    expect(sha256(current)).toBe(later.sha256);
    expect(current).toContain('statisticsUnavailable(');
    expect(current).not.toContain('.query("memories")');
  });
  it("independent helper imports no unreviewed metadata/MF/worker bridge and no unsafe any/ts-ignore", () => {
    const source = fs.readFileSync("convex-dev/runtimeRegistryAuth.ts", "utf8");
    expect(source).not.toMatch(/from ["']\.\/(?:runtimeMemory|runtimeMetadata|runtimeWorker)/);
    expect(source).not.toMatch(/@ts-ignore|\bas any\b|:\s*any\b|Object\.hasOwn|\.at\(/);
  });
  it("space deletion final barrier notices a revoked principal after all intentional fence writes and rolls back", async () => {
    const f = fixture(); const row = seedSpace(f); const before = structuredClone(row); let changed = false;
    f.db.beforeRead = (table) => { if (!changed && table === "runtimeAuthPrincipals" && f.db.writes === 3) { changed = true; f.principal.revokedAt = 1000; } };
    await expect(f.db.transaction(async () => await invoke(spaces.deleteSpace, f.ctx, { tenantId: "tenant-a", memorySpaceId: "space-a", cascade: true, reason: "owned" }))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(changed).toBe(true); expect(f.db.writes).toBe(0); expect(f.db.table("memorySpaces")).toEqual([before]); expect(f.db.table("runtimeAuthTombstones")).toEqual([]);
  });
  it("reading a descriptive access edge requires the target's current independent grant", async () => {
    const f = fixture(); seedContext(f, { grantedAccess: [{ memorySpaceId: "ungranted", scope: "read-only", grantedAt: 1000 }] });
    await expect(invoke(contexts.get, f.ctx, { tenantId: "tenant-a", memorySpaceId: "space-a", contextId: "context-a" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } }); expect(f.db.writes).toBe(0);
  });
});
