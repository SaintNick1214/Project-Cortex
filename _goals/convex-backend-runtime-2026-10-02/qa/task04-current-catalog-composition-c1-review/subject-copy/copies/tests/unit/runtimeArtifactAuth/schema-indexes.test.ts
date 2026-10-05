import "/workspace/Project-Cortex/tests/unit/runtimeArtifactAuth/accepted-reader-compat";
import { describe, expect, test } from "@jest/globals";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import schema from "/workspace/Project-Cortex/convex-dev/schema";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";


import { fixture, native } from "/workspace/Project-Cortex/tests/unit/runtimeArtifactAuth/fixture";

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

  test("all exported tables, including runtime schema fragments, have unique index field sequences", () => {
    fs.mkdirSync(path.resolve("/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-composition-c1-review/subject-copy/test-scratch"), { recursive: true });
  const directory = fs.mkdtempSync(path.join(path.resolve("/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-composition-c1-review/subject-copy/test-scratch"), "cortex-current-schema-composition-"));
    let baselineNames: string[];
    try {
      const composition = JSON.parse(execFileSync(process.execPath, ["/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-current-catalog-composition-c1-review/subject-copy/current-compose.mjs", directory], { encoding: "utf8" }));
      const baseline = JSON.parse(fs.readFileSync(composition.exactCurrentRepair.nativeWitness, "utf8"));
      baselineNames = baseline.definitions.map((row: { table: string }) => row.table);
      expect(composition.currentComposition.baselineProjectionHash).toBe("07df1b0be4647848a3e9fbd1eb9d27d81ad78194f77d3c447c7ee4f2de419b1d");
      expect(composition.currentComposition.totals).toEqual({ baselineTables: 26, additiveTables: 5, currentTables: 31, indexes: 184, policyInternal: 16 });
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
    expect(fs.existsSync(directory)).toBe(false);
    expect(baselineNames!).toHaveLength(26);
    expect(Object.keys(schema.tables).filter(table => baselineNames!.includes(table))).toEqual(baselineNames!);
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
