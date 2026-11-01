import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
const child = await import("node:child_process");
const calls: { args: string[]; options: { env: Record<string, unknown> } }[] = [];
let fail = false, outputOverride: string | undefined;
const counts = Object.fromEntries(["agents", "artifacts", "contexts", "conversations", "factHistory", "facts", "governanceEnforcement", "governancePolicies", "graphSyncQueue", "immutable", "memories", "memorySpaces", "mutable", "sessions"].map(name => [name, { count: name === "facts" ? 10000 : 7, truncated: name === "facts" }]));
const invoke = Object.assign(jest.fn(), { [promisify.custom]: async (_file: string, args: string[], options: { env: Record<string, unknown> }) => {
  calls.push({ args, options }); if (fail) throw new Error("private-secret-do-not-log"); return { stdout: outputOverride ?? (args.includes("admin:getAllCounts") ? JSON.stringify(counts) : "null"), stderr: "" };
} });
jest.unstable_mockModule("node:child_process", () => ({ ...child, execFile: invoke }));
const { runOperator } = await import("../operator.js");
const target = { teamId: 12, projectId: 34, deploymentName: "safe-test-123", deploymentUrl: "https://safe-test-123.convex.cloud", disposable: true };
let directory: string, file: string, management: jest.SpiedFunction<typeof globalThis.fetch>;
beforeEach(async () => {
  calls.length = 0; fail = false; outputOverride = undefined; directory = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-operator-test-")); file = path.join(directory, "target.json"); await fs.writeFile(file, JSON.stringify(target));
  process.env.CORTEX_TEST_MANAGEMENT = "private-management"; process.env.CORTEX_TEST_DEPLOY = "dev:safe-test-123|private-deploy"; process.env.CORTEX_AUTH_TOKEN = "private-host-token";
  management = jest.spyOn(globalThis, "fetch").mockImplementation(async input => new Response(JSON.stringify(String(input).includes("/deployments/") ? { name: target.deploymentName, deploymentType: "dev", projectId: target.projectId, deploymentUrl: target.deploymentUrl, kind: "cloud" } : { id: target.projectId, teamId: target.teamId }), { status: 200 }));
});
afterEach(async () => { jest.restoreAllMocks(); delete process.env.CORTEX_TEST_MANAGEMENT; delete process.env.CORTEX_TEST_DEPLOY; delete process.env.CORTEX_AUTH_TOKEN; await fs.rm(directory, { recursive: true, force: true }); });
const options = () => ({ target: file, project: process.cwd(), managementTokenEnv: "CORTEX_TEST_MANAGEMENT", deployKeyEnv: "CORTEX_TEST_DEPLOY" });
it("uses internal stats only after two exact management readbacks and preserves truncated counts", async () => {
  expect(await runOperator(options(), { kind: "stats" })).toEqual(counts); expect(management).toHaveBeenCalledTimes(4); expect(calls).toHaveLength(1);
  expect(calls[0].args).toContain("admin:getAllCounts"); expect(calls[0].args).toContain(target.deploymentUrl); expect(calls[0].options.env.CORTEX_AUTH_TOKEN).toBeUndefined(); expect(calls[0].options.env.CORTEX_TEST_MANAGEMENT).toBeUndefined();
});
it("retirement selects only exact tenant AND space, never table clears or global purge", async () => {
  expect(await runOperator(options(), { kind: "retireScope", tenantId: "owned", memorySpaceId: "owned-space" })).toEqual({ version: 1, retired: true, tenantId: "owned", memorySpaceId: "owned-space", physicalPurge: false });
  expect(calls[0].args).toContain("runtimeAuth:deleteScope"); expect(calls[0].args).toContain('{"tenantId":"owned","memorySpaceId":"owned-space"}'); expect(calls[0].args).not.toContain("admin:clearTable");
});
it("propagates operator failure without secret diagnostics, zero counts or mutation retries", async () => {
  fail = true; await expect(runOperator(options(), { kind: "stats" })).rejects.toThrow("maintenance failed"); expect(calls).toHaveLength(1);
});
it("recognizes the CLI's empty null retirement output while statistics still require JSON", async () => {
  outputOverride = "";
  await expect(runOperator(options(), { kind: "retireScope", tenantId: "owned", memorySpaceId: "owned-space" })).resolves.toMatchObject({ retired: true });
  await expect(runOperator(options(), { kind: "stats" })).rejects.toThrow("maintenance failed");
  outputOverride = "not-json";
  await expect(runOperator(options(), { kind: "retireScope", tenantId: "owned", memorySpaceId: "owned-space" })).rejects.toThrow("maintenance failed");
  expect(calls).toHaveLength(3);
});
it("rejects production/mismatched keys before any management or internal operation", async () => {
  process.env.CORTEX_TEST_DEPLOY = "prod:safe-test-123|private"; await expect(runOperator(options(), { kind: "stats" })).rejects.toThrow("target-bound"); expect(management).not.toHaveBeenCalled(); expect(calls).toHaveLength(0);
});
it("rejects a changed live target before dispatch", async () => {
  management.mockRestore(); jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ deploymentType: "prod" }), { status: 200 }));
  await expect(runOperator(options(), { kind: "stats" })).rejects.toThrow("differs"); expect(calls).toHaveLength(0);
});
it("rejects missing scoped retirement fields before management or mutation", async () => {
  await expect(runOperator(options(), { kind: "retireScope", tenantId: "owned", memorySpaceId: "" })).rejects.toThrow("exact tenant"); expect(calls).toHaveLength(0); expect(management).not.toHaveBeenCalled();
});
