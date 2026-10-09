import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { Command } from "commander";
import type { CLIConfig } from "../../types.js";
const operator = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const publicClient = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule("../operator.js", () => ({ runOperator: operator }));
jest.unstable_mockModule("../client.js", () => ({ withClient: publicClient }));
const { registerDbCommands, verifiedCounts } = await import("../../commands/db.js");
const counts = Object.fromEntries(["agents", "artifacts", "contexts", "conversations", "factHistory", "facts", "governanceEnforcement", "governancePolicies", "graphSyncQueue", "immutable", "memories", "memorySpaces", "mutable", "sessions"].map(name => [name, { count: 10000, truncated: true }]));
const config: CLIConfig = { deployments: {}, default: "", format: "json", confirmDangerous: true };
let output: jest.SpiedFunction<typeof console.log>;
beforeEach(() => { jest.clearAllMocks(); output = jest.spyOn(console, "log").mockImplementation(() => undefined); });
afterEach(() => { jest.restoreAllMocks(); });
function program() { const p = new Command(); p.exitOverride(); p.configureOutput({ writeErr: () => undefined, writeOut: () => undefined }); registerDbCommands(p, config); return p; }
it("preserves actual truncated counts from internal operator results", async () => {
  operator.mockResolvedValue(counts); await program().parseAsync(["node", "test", "db", "stats", "--target", "target.json"]); expect(JSON.parse(output.mock.calls[0][0])).toEqual(counts); expect(publicClient).not.toHaveBeenCalled();
});
it("does not swallow failed stats or fabricate zero counts", async () => {
  operator.mockRejectedValue(new Error("real-operator-failure")); await expect(program().parseAsync(["node", "test", "db", "stats", "--target", "target.json"])).rejects.toThrow("real-operator-failure"); expect(output).not.toHaveBeenCalled();
});
it("requires exact tenant, space and explicit confirmation before lifecycle retirement", async () => {
  await expect(program().parseAsync(["node", "test", "db", "clear", "--target", "target.json", "--tenant-id", "owned", "--memory-space-id", "space"])).rejects.toThrow("--yes"); expect(operator).not.toHaveBeenCalled();
  operator.mockResolvedValue({ retired: true, physicalPurge: false }); await program().parseAsync(["node", "test", "db", "clear", "--target", "target.json", "--tenant-id", "owned", "--memory-space-id", "space", "--yes"]);
  expect(operator.mock.calls[0][1]).toEqual({ kind: "retireScope", tenantId: "owned", memorySpaceId: "space" });
});
it("legacy global clear and partial restore fail before any public/internal effect", async () => {
  await expect(program().parseAsync(["node", "test", "db", "clear", "--yes"])).rejects.toThrow();
  await expect(program().parseAsync(["node", "test", "db", "restore", "--input", "backup.json", "--yes"])).rejects.toThrow("LEGACY_RESTORE_UNSUPPORTED"); expect(operator).not.toHaveBeenCalled(); expect(publicClient).not.toHaveBeenCalled();
});
it("rejects incomplete/malformed counts and full backup rather than pretending completion", async () => {
  expect(() => verifiedCounts({ facts: 0 })).toThrow("COUNTS_INVALID");
  await expect(program().parseAsync(["node", "test", "db", "backup", "--include-all"])).rejects.toThrow("FULL_DATABASE_BACKUP_UNSUPPORTED"); expect(publicClient).not.toHaveBeenCalled();
});
