import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import schema from "../../../convex-dev/schema";
import { fixture, seedSpace, seedContext, invoke } from "./fixture";
import * as spaces from "../../../convex-dev/memorySpaces";
import * as contexts from "../../../convex-dev/contexts";
const qa = "_goals/convex-backend-runtime-2026-10-02/qa/task03b2b1";
describe("portable inventory, actual schema exports and preserved sources", () => {
  it("ordinary inventory reproduction writes only owned temporary outputs and always removes them", () => {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-registry-catalog-"));
    try {
      const result = spawnSync(process.execPath, [`${qa}/inventory.mjs`, destination], { encoding: "utf8" }); expect(result.status).toBe(0);
      const inventory = JSON.parse(fs.readFileSync(path.join(destination, "selected-path-inventory.json"), "utf8")) as { counts: unknown; hashes: { file: string; sha256: string }[]; endpoints: { path: string; kind: string }[] };
      expect(inventory.counts).toEqual({ selected: 46, public: 43, internal: 3, moduleRegistrations: 48, excludedStats: 2, unresolved: 0 });
      expect(new Set(inventory.endpoints.map((endpoint) => endpoint.path)).size).toBe(46);
      for (const hash of inventory.hashes) expect(crypto.createHash("sha256").update(fs.readFileSync(hash.file)).digest("hex")).toBe(hash.sha256);
      expect(inventory.endpoints.filter((endpoint) => endpoint.kind === "internalMutation").map((endpoint) => endpoint.path).sort()).toEqual(["agents:purgeAll", "contexts:purgeAll", "memorySpaces:purgeAll"]);
    } finally { fs.rmSync(destination, { recursive: true, force: true }); }
    expect(fs.existsSync(destination)).toBe(false);
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
  it.each([["convex-dev/agents.ts", "computeStats", "stats-agents.frozen.txt"], ["convex-dev/memorySpaces.ts", "getStats", "stats-spaces.frozen.txt"]])("excluded %s registration remains byte-for-byte frozen", (file, name, frozen) => {
    const source = fs.readFileSync(file, "utf8"); const start = source.indexOf(`export const ${name} =`); const end = source.indexOf("\n});", start) + 4;
    expect(source.slice(start, end)).toBe(fs.readFileSync(`${qa}/${frozen}`, "utf8"));
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
