import { describe, expect, it } from "@jest/globals";
import { ConvexError } from "convex/values";
import * as memories from "../../../convex-dev/memories";
import { semanticHash } from "../../../src/domain/profile";
import { harness, identity } from "./sharedfixtures";

// Static public contract: absent and inaccessible resources must be indistinguishable.
const denial = { version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" };
const operations = ["updatePartialMemory", "finalizePartialMemory"] as const;

describe("partial-memory initial lookup authorization contract", () => {
  for (const operation of operations) {
    it.each(["foreign-tenant", "foreign-owner", "missing"] as const)(`${operation} denies %s without hydration or effects`, async fixture => {
      const h = harness(); const owner = await h.provisionScope();
      const id = await h.seedData("memories", owner, "known-owner", { isPartial: true, tags: ["partial", "streaming", "keep"] });
      const sourceId = h.db.rows.get("runtimeMemorySources")![0]._id;
      if (fixture !== "missing") {
        await h.provisionScope({ tenantId: fixture === "foreign-tenant" ? "tenant-b" : "tenant-a", subject: "bob" });
        h.setIdentity({ ...identity, subject: "bob" });
      }
      const before = structuredClone(h.db.rows); h.db.reads = []; h.db.attemptedWrites = [];
      let caught: unknown;
      try {
        await h.invoke(memories[operation], { memoryId: fixture === "missing" ? "absent" : "known-owner", content: "Unauthorized edit", metadata: { attempted: true } });
      } catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(ConvexError);
      if (!(caught instanceof ConvexError)) throw new Error("Expected a structured Convex denial");
      expect(caught.data).toEqual(denial);
      expect(h.db.attemptedWrites).toEqual([]);
      expect(h.db.rows).toEqual(before);
      expect(h.db.reads.filter(read => read.table === "memories")).toEqual([
        { table: "memories", index: "by_runtime_scope_memoryId", ids: [] },
      ]);
      expect(h.db.reads.filter(read => read.table === "runtimeMemorySources")).toEqual([]);
      expect(h.db.reads.flatMap(read => read.ids)).not.toContain(id);
      expect(h.db.reads.flatMap(read => read.ids)).not.toContain(sourceId);
    });

    it(`${operation} preserves owner content, source revision and partial lifecycle`, async () => {
      const h = harness(); const owner = await h.provisionScope();
      const id = await h.seedData("memories", owner, "known-owner", { isPartial: true, tags: ["partial", "streaming", "keep"] });
      const content = "Owner revised assertion"; const contentHash = await semanticHash(content);
      h.db.attemptedWrites = [];
      expect(await h.invoke(memories[operation], { memoryId: "known-owner", content, metadata: { marker: 1 } })).toEqual({ success: true });
      const row = await h.db.get(id);
      expect(row).toMatchObject({ content, version: 2, lineage: { sourceRevision: 2 }, partialMetadata: { marker: 1 },
        ownerPrincipalId: owner.principalId, runtimeEditor: { principalId: owner.principalId, userId: owner.userId },
        isPartial: operation === "finalizePartialMemory" ? false : true,
        tags: operation === "finalizePartialMemory" ? ["keep"] : ["partial", "streaming", "keep"] });
      expect(h.db.rows.get("runtimeMemorySources")).toHaveLength(1);
      expect(h.db.rows.get("runtimeMemorySources")![0]).toMatchObject({ content, contentHash, lineage: { sourceRevision: 2 }, ownerPrincipalId: owner.principalId });
      expect(h.db.attemptedWrites).toContain(`patch:${id}`);
      expect(h.db.attemptedWrites).toContainEqual(expect.stringMatching(/^patch:runtimeMemorySources\//));
    });
  }
});
