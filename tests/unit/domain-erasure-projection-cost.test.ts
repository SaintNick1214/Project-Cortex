import { projectErasure } from "../../convex-dev/lib/domainErasureScope";
import { WRITER_MANIFEST_HASH } from "../../convex-dev/lib/referenceLifecycle";
import type { QueryCtx } from "../../convex-dev/_generated/server";

const space = { kind: "space" as const, tenantId: "selected", memorySpaceId: "root" };

/** Only database primitives are replaced; membership/projection run unchanged. */
function reader(target: Record<string, unknown> | null = null) {
  const queries: string[] = [];
  const ctx = {
    db: {
      query(table: string) {
        queries.push(table);
        return {
          withIndex(_index: string, select: (q: unknown) => unknown) {
            const q = { eq: () => q };
            select(q);
            return {
              take: async () => table === "cortexReferenceState"
                ? [{ generation: "g", writerManifestHash: WRITER_MANIFEST_HASH, status: "ready", unresolvedCount: 0 }]
                : target ? [target] : [],
              collect: async () => [],
            };
          },
        };
      },
    },
  } as unknown as QueryCtx;
  return { ctx, queries };
}

test.each([
  ["memorySpaces", { tenantId: "foreign", memorySpaceId: "root" }, "preserve", "foreignTenant"],
  ["memories", { tenantId: "selected", memorySpaceId: "other" }, "preserve", "otherSpace"],
  ["factHistory", { memorySpaceId: "root" }, "block", "SOURCE_PROVENANCE_UNRESOLVED"],
] as const)("%s direct %s disposition requires no unused target lookup", async (table, content, action, reason) => {
  const { ctx, queries } = reader();
  expect(await projectErasure(ctx, table, { _id: "record", ...content }, space))
    .toMatchObject({ id: "record", action, reason, dependencies: [], storageIds: [] });
  expect(queries).toEqual([]);
});

test("actionable root still resolves its physical target", async () => {
  const { ctx, queries } = reader();
  expect(await projectErasure(ctx, "memorySpaces", { _id: "root-id", tenantId: "selected", memorySpaceId: "root" }, space))
    .toMatchObject({ id: "root-id", action: "root" });
  expect(queries).toEqual(["cortexReferenceTargets"]);
});

test("ambiguous membership still refuses without physical preparation", async () => {
  const { ctx, queries } = reader();
  await expect(projectErasure(ctx, "factHistory", { _id: "history", tenantId: "selected", scopeVersion: 1, memorySpaceId: "other" }, space))
    .rejects.toThrow("REFERENCE_SOURCE_NOT_PREPARED");
  expect(queries).toEqual(["cortexReferenceTargets"]);
});

test("physically prepared foreign history retains authority reads before preservation", async () => {
  const { ctx, queries } = reader({ _id: "target", preparedGeneration: "g" });
  expect(await projectErasure(ctx, "factHistory", { _id: "history", tenantId: "selected", scopeVersion: 1, memorySpaceId: "other" }, space))
    .toMatchObject({ action: "preserve", reason: "foreignSourceOrActorOnly" });
  expect(queries).toEqual(["cortexReferenceTargets", "cortexReferenceState", "cortexReferenceEdges"]);
});
