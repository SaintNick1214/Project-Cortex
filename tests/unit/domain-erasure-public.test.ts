import type { ConvexClient } from "convex/browser";
import { jest } from "@jest/globals";
import type { ErasureReceipt, ErasureProjection, PreparedErasure } from "../../src/users/erasure";
const actual = await import("../../src/users/erasure");
const prepare = jest.fn<(...args: unknown[]) => Promise<PreparedErasure>>();
const execute = jest.fn<(...args: unknown[]) => Promise<ErasureReceipt>>();
jest.unstable_mockModule("../../src/users/erasure", () => ({ ...actual, prepareErasure: prepare, executeErasure: execute }));
const { UsersAPI, CascadeDeletionError } = await import("../../src/users/index");
function receipt(userId = "a", mode = "profile"): ErasureReceipt {
  const root: ErasureProjection = { table: "immutable", id: `${userId}-root`, action: "root", fingerprint: "a".repeat(64), dependencies: [], messages: 0, retainedVersions: 0, serializedBytes: 1, storageIds: [] };
  const planned = mode === "profile" ? [root] : [root, { ...root, id: `${userId}-other`, action: "delete" as const }, { ...root, table: "memories" as const, id: `${userId}-memory`, action: "delete" as const }];
  const outcomes = mode === "preview" ? [] : planned.map(row => ({ protocolVersion: 1 as const, observationTime: 1, domain: { kind: "user" as const, userId }, operationId: `${userId}-operation`, itemKey: `${row.table}:${row.id}`, id: row.id, table: row.table, state: mode === "absent" && row.action === "root" ? "alreadyAbsent" as const : "committed" as const, deleted: mode === "absent" && row.action === "root" ? 0 : 1, detached: 0, messages: 0, retainedVersions: 0, blobs: [], graphJobs: [] }));
  const perTable: ErasureReceipt["perTable"] = {};
  for (const table of ["immutable", "memories"]) perTable[table] = { deleted: outcomes.filter(item => item.table === table).reduce((sum, item) => sum + item.deleted, 0), detached: 0, preserved: 0, alreadyAbsent: 0, retainedVersions: 0 };
  return { version: 1, operationId: `${userId}-operation`, domain: { kind: "user", userId }, deletionScope: "exclusiveSupportedPrimary", executed: outcomes.length > 0, complete: mode !== "preview", fullUserDataErased: false, startedAt: 1, endedAt: 2, planned, outcomes, remaining: [], blockers: [], perTable, totalDeleted: outcomes.reduce((sum, item) => sum + item.deleted, 0), graph: { state: mode === "graph" ? "complete" : "notConfigured", jobs: [], nodesDeleted: mode === "graph" ? 2 : 0 }, verification: { state: mode === "preview" ? "notExecuted" : "verified", complete: mode !== "preview" }, exclusions: ["protectedOperationalProvenance"], errors: [], unknown: [] };
}
beforeEach(() => { prepare.mockReset(); execute.mockReset(); prepare.mockImplementation(async () => ({ receipt: receipt(), order: [], graph: [], options: {} })); });
test.each([
  ["profile", 0, ["user-profile"], 1, 0],
  ["mixed", 1, ["immutable", "vector", "user-profile"], 3, 0],
  ["graph", 1, ["immutable", "vector", "graph", "user-profile"], 3, 2],
  ["preview", 0, [], 0, 0],
  ["absent", 1, ["immutable", "vector"], 2, 0],
] as const)("public cascade preserves detailed counts/layers for %s", async (mode, immutable, layers, total, graph) => {
  const original = receipt("a", mode); execute.mockResolvedValueOnce(original);
  const result = await new UsersAPI({} as ConvexClient).delete("a", { cascade: true, dryRun: mode === "preview" });
  expect(result).toMatchObject({ immutableRecordsDeleted: immutable, totalDeleted: total, graphNodesDeleted: graph, deletedLayers: [...layers] });
  expect(result.erasure).toBe(original); expect(original.perTable.immutable.deleted).toBe(mode === "mixed" || mode === "graph" ? 2 : mode === "preview" ? 0 : 1);
});
test.each(["partial", "unknown", "zero", "absent"])("bulk keeps exact current receipt and truthful unstarted on %s", async mode => {
  const first = receipt("a"), current = receipt("b", "preview");
  if (mode === "partial") { current.outcomes = receipt("b").outcomes; current.executed = true; current.totalDeleted = 1; }
  if (mode === "unknown") current.unknown = ["b-root"];
  if (mode === "absent") { current.outcomes = [{ ...receipt("b").outcomes[0], state: "alreadyAbsent", deleted: 0 }]; current.executed = true; }
  const cause = new actual.ErasureError("controlled-stop", current); execute.mockResolvedValueOnce(first).mockRejectedValueOnce(cause);
  let error: unknown; try { await new UsersAPI({} as ConvexClient).deleteMany(["a", "b", "c"], { cascade: true }); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(CascadeDeletionError); expect(error).toMatchObject({ cause, receipt: current, deleted: 1, userIds: ["a"], outcomes: [expect.objectContaining({ userId: "a", totalDeleted: 1 })], unstarted: mode === "zero" ? ["b", "c"] : ["c"] });
  expect(prepare).toHaveBeenCalledTimes(3); expect(execute).toHaveBeenCalledTimes(2); expect(execute.mock.calls[1][0]).toBeDefined();
});
