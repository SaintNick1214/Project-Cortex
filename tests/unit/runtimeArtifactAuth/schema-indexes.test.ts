import "./accepted-reader-compat";
import { describe, expect, test } from "@jest/globals";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import schema from "../../../convex-dev/schema";


import { fixture, native } from "./fixture";
import { catalogFixture, historicalRepairSources, repairedHistoricalSources, sha256, withComposedCatalog, type NativeDefinition, type HistoricalRepair } from "../../helpers/backend-catalog";

type NativeIndex = { indexDescriptor: string; fields: string[] };
function duplicateIndexes(indexes: NativeIndex[]) {
  return indexes.flatMap((index, position) => indexes.slice(position + 1)
    .filter((other) => JSON.stringify(index.fields) === JSON.stringify(other.fields))
    .map((other) => [index.indexDescriptor, other.indexDescriptor]));
}

describe("deployable native schema indexes", () => {
  test("detects the rejected artifact field duplication despite different index names", () => {
    const rejected = defineTable({ tenantId: v.optional(v.string()), memorySpaceId: v.string() })
      .index("by_runtime_scope", ["tenantId", "memorySpaceId"])
      .index("by_tenant_space", ["tenantId", "memorySpaceId"]);
    expect(duplicateIndexes(rejected[" indexes"]())).toEqual([["by_runtime_scope", "by_tenant_space"]]);
  });

  test("all exported tables, including runtime schema fragments, have unique index field sequences", async () => {
    const historical = catalogFixture<{ classification: string; baselineProjectionHash: string; tables: NativeDefinition[]; registrations: Record<string, { isInternal: boolean; isPublic?: boolean }>; totals: Record<string, number> }>("policy-composition-historical.json");
    expect(historical.classification).toBe("HISTORICAL_CURRENT_COMPOSITION_2026_10_03_ONLY");
    expect(historical.baselineProjectionHash).toBe("07df1b0be4647848a3e9fbd1eb9d27d81ad78194f77d3c447c7ee4f2de419b1d");
    expect(sha256(repairedHistoricalSources(historicalRepairSources())["convex-dev/schema.ts"])).toBe(historical.baselineProjectionHash);
    expect(historical.totals).toEqual({ baselineTables: 26, additiveTables: 5, currentTables: 31, indexes: 184, policyInternal: 16 });
    const baseline = catalogFixture<HistoricalRepair>("index-repair-historical.json").before.definitions;
    const repaired = structuredClone(baseline);
    const artifacts = repaired.find(table => table.table === "artifacts")!;
    artifacts.exported.indexes = artifacts.exported.indexes.filter(index => index.indexDescriptor !== "by_runtime_scope");
    expect(repaired).toHaveLength(26);
    expect(historical.tables).toHaveLength(5);
    const composed = [...repaired, ...historical.tables];
    expect(composed).toHaveLength(31);
    expect(composed.reduce((count, table) => count + table.exported.indexes.length, 0)).toBe(184);
    for (const table of composed) expect(duplicateIndexes(table.exported.indexes)).toEqual([]);
    expect(Object.values(historical.registrations)).toHaveLength(16);
    for (const registration of Object.values(historical.registrations)) {
      expect(registration.isInternal).toBe(true);
      expect(registration.isPublic).toBeUndefined();
    }
    const baselineNames = baseline.map(table => table.table);
    expect(Object.keys(schema.tables).filter(table => baselineNames.includes(table))).toEqual(baselineNames);
    // Historical31 is explicit above. Every newer approved native fragment is
    // checked below and copied exactly by the maintained current planner.
    await withComposedCatalog((_directory, files) => {
      expect(files["schema.ts"].toString()).toContain("...cortexTablesV1");
      expect(files["_cortex/schema.ts"].toString()).toContain("...runtimePolicyTables");
    });
    for (const [table, definition] of Object.entries(schema.tables)) {
      expect({ table, duplicates: duplicateIndexes(definition[" indexes"]()) })
        .toEqual({ table, duplicates: [] });
    }
  });

  test("artifact scope queries retain the original tenant and space index", () => {
    const indexes = schema.tables.artifacts[" indexes"]();
    expect(indexes.filter((index) => index.fields.join(",") === "tenantId,memorySpaceId"))
      .toEqual([{ indexDescriptor: "by_tenant_space", fields: ["tenantId", "memorySpaceId"] }]);
    expect(indexes.some((index) => index.indexDescriptor === "by_runtime_scope")).toBe(false);
    expect(indexes.find((index) => index.indexDescriptor === "by_runtime_key"))
      .toEqual({ indexDescriptor: "by_runtime_key", fields: ["tenantId", "memorySpaceId", "artifactId"] });
  });

  test.each(["count", "purgeAll"])("native %s uses the registered index with identical tenant and space bounds", async (name) => {
    const f = fixture(); const own = f.row();
    const foreignTenant = f.row({ tenantId: "foreign-tenant" });
    const foreignSpace = f.row({ memorySpaceId: "foreign-space" });
    const result = await f.invoke(name, { tenantId: "tenant-a", memorySpaceId: "space-a" });
    expect(result).toEqual(name === "count" ? 1 : { deleted: 1 });
    const selections = f.db.reads.filter((read) => read.table === "artifacts");
    expect(selections.length).toBeGreaterThan(0);
    for (const read of selections) {
      expect(read.index).toBe("by_tenant_space");
      expect(read.filters).toEqual([["tenantId", "tenant-a"], ["memorySpaceId", "space-a"]]);
      expect(read.ids).toEqual([own._id]);
    }
    expect(f.db.rows("artifacts").find((row) => row._id === foreignTenant._id)?.isDeleted).toBeUndefined();
    expect(f.db.rows("artifacts").find((row) => row._id === foreignSpace._id)?.isDeleted).toBeUndefined();
    expect(native.purgeAll.isInternal).toBe(true);
    expect(native.count.isPublic).toBe(true);
  });

});
