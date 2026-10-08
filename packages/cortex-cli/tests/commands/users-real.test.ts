/** Tests execute createProgram's production registry with SDK transport mocks. */
import { it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from "@jest/globals";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, statSync, realpathSync, symlinkSync } from "fs";
import { createHash } from "crypto";
import { convexToJson } from "convex/values";
import type { UserExportEvent } from "@cortexmemory/sdk";
import { join } from "path";
import { tmpdir } from "os";
import type { CLIConfig } from "../../src/types.js";
import { stageActualCLI, runActualCLI } from "../helpers/cli-test-utils.js";
let promptConfirmed = false;
let promptText = "";
jest.unstable_mockModule("prompts", () => ({ default: jest.fn(async () => ({ confirmed: promptConfirmed, confirmation: promptText })) }));
const realOs = await import("os");
if (!process.env.CORTEX_TEST_HOME_ROOT || realOs.homedir() !== process.env.CORTEX_TEST_HOME_ROOT)
  throw new Error("Externally isolated native HOME required before imports");
jest.unstable_mockModule("os", () => ({ ...realOs, homedir: () => process.env.HOME! }));
const profile = { id: "user-one", data: { name: "First", kept: true }, version: 2, createdAt: 1, updatedAt: 2 };
const history = [{ version: 1, data: { name: "Before" }, timestamp: 1 }, { version: 2, data: profile.data, timestamp: 2 }];
const domains = ["immutable", "mutable", "conversations", "memories", "facts", "factHistory", "contexts", "sessions", "artifacts", "attachments", "conversationShares", "conversationSnapshots", "memorySpaces", "agents", "governancePolicies", "governanceEnforcement", "graphSyncQueue"] as const;
const bytes = Buffer.from([0, 255, 128, 10, 1]);
const digest = createHash("sha256").update(bytes).digest("hex");
function exportEvents(tenantId?: string): UserExportEvent[] {
  const identity = { userId: "user-one", scope: tenantId === undefined ? { kind: "tenantless" as const } : { kind: "tenant" as const, tenantId } };
  const node = { domain: "attachments" as const, id: "attachment-owned" as never };
  const blob = { storageId: "storage-owned", size: bytes.length, mimeType: "application/octet-stream", sha256: digest, referrers: [{ node }] };
  return [
    { type: "header", version: 1, format: "cortex-user-export", identity, consistency: "rolling-read", startedAt: 1 },
    { type: "record", node: { domain: "immutable", id: "profile-owned" as never }, disposition: "record", fingerprint: "a".repeat(64), record: convexToJson({ _id: "profile-owned", _creationTime: 0.01, ...profile, versionHistory: history, raw: { integer: 9223372036854775807n, bytes: new Uint8Array(bytes).buffer, floats: [NaN, Infinity, -Infinity, -0], ordered: ["z", "a"], unicode: { "10": 10, "2": 2, value: "😀\uE000" } } }) },
    { type: "record", node: { domain: "factHistory", id: "history-owned" as never }, disposition: "record", fingerprint: "b".repeat(64), record: { _id: "history-owned", _creationTime: 2, ownerUserId: "user-one", scopeVersion: 1, deletedSource: "immutable-original" } },
    { type: "record", node, disposition: "record", fingerprint: "c".repeat(64), record: { _id: "attachment-owned", storageId: "storage-owned", userId: "user-one" } },
    { type: "blob", ...blob },
    { type: "chunk", storageId: blob.storageId, sequence: 0, byteLength: 2, data: bytes.subarray(0, 2).toString("base64") },
    { type: "chunk", storageId: blob.storageId, sequence: 1, byteLength: 3, data: bytes.subarray(2).toString("base64") },
    { type: "blobEnd", storageId: blob.storageId, chunks: 2, size: bytes.length, sha256: digest },
    { type: "manifest", version: 1, complete: true, identity, consistency: "rolling-read", startedAt: 1, endedAt: 3, tableManifest: domains.map(domain => ({ domain, records: ["immutable", "factHistory", "attachments"].includes(domain) ? 1 : 0, projections: 0, pages: 0 })), pageCount: 0, projectionCount: 3, pageObservations: [], blobs: [blob], diagnostics: [], exclusions: ["purgedRecordsAndPurgedHistory"] },
  ];
}
const realFs = await import("fs/promises");
const configReadFile = jest.fn(realFs.readFile);
const lstatMarker = jest.fn(realFs.lstat);
const realCrypto = await import("crypto");
let forcedStageId: string | undefined;
jest.unstable_mockModule("crypto", () => ({ ...realCrypto, randomUUID: () => forcedStageId ?? realCrypto.randomUUID() }));
let diskFailure: "open" | "write" | "zero-write" | "sync" | "close" | "rename" | "unlink" | undefined;
let shortWrites = false;
let abortAt: "sync" | "close" | undefined;
const openedStages: string[] = [];
let stageOpenAttempts = 0;
const openStage = jest.fn(async (...args: Parameters<typeof realFs.open>) => {
  if (!String(args[0]).endsWith(".stage")) return realFs.open(...args);
  stageOpenAttempts++;
  if (diskFailure === "open") throw new Error("fixture open failed");
  const handle = await realFs.open(...args); openedStages.push(String(args[0]));
  let closeAttempts = 0;
  return {
    write: async (buffer: Buffer, offset: number, length: number, position: null) => {
      if (diskFailure === "write") throw new Error("fixture write failed");
      if (diskFailure === "zero-write") return { bytesWritten: 0, buffer };
      return handle.write(buffer, offset, shortWrites ? Math.min(3, length) : length, position);
    },
    sync: async () => { if (diskFailure === "sync") throw new Error("fixture sync failed"); await handle.sync(); if (abortAt === "sync") process.emit("SIGINT"); },
    close: async () => { if (diskFailure === "close" && closeAttempts++ === 0) throw new Error("fixture close failed"); await handle.close(); if (abortAt === "close") process.emit("SIGTERM"); },
  };
});
jest.unstable_mockModule("fs/promises", () => ({ ...realFs, open: openStage, readFile: configReadFile, lstat: lstatMarker,
  unlink: jest.fn(async (...args: Parameters<typeof realFs.unlink>) => { if (diskFailure === "unlink") throw new Error("fixture unlink failed"); return realFs.unlink(...args); }),
}));
const realNativeFs = await import("fs");
const commitRename = jest.fn((...args: Parameters<typeof realNativeFs.renameSync>) => { if (diskFailure === "rename") throw new Error("fixture rename failed"); return realNativeFs.renameSync(...args); });
jest.unstable_mockModule("fs", () => ({ ...realNativeFs,
  renameSync: commitRename,
}));
const { serializeUserExportEvent } = await import("../../../../src/users/export.js");
const exportData = jest.fn<(userId: string, options: { tenantId?: string; signal?: AbortSignal }) => AsyncGenerator<UserExportEvent>>();
const serializeExportEvent = jest.fn(serializeUserExportEvent);
const inspectCascadeProfile = jest.fn<(...args: unknown[]) => Promise<{ profile: { domain: string; id: string } | null }>>();
const createExportTransport = jest.fn(() => ({ fixture: "separate-admin-transport", inspect: inspectCascadeProfile }));
const space = { memorySpaceId: "space-one", name: "Space", type: "team", status: "active", metadata: { kept: true }, participants: [{ id: "p-one", type: "agent", joinedAt: 10 }], createdAt: 1, updatedAt: 2 };
const erasureReceipt = { version: 1, operationId: "operation-original", domain: { kind: "user", userId: "user-one" },
  executed: true, complete: true, fullUserDataErased: false, totalDeleted: 11, planned: [{ table: "immutable", id: "physical-profile", action: "delete" }],
  outcomes: [{ table: "immutable", id: "physical-profile", state: "committed", deleted: 1 }], remaining: [], blockers: [],
  graph: { state: "notConfigured", jobs: [], nodesDeleted: 0 }, verification: { state: "complete", complete: true }, exclusions: ["sharedRegistry"], unknown: [], errors: [] };
const erasureTransport = { kind: "cortex-erasure-v1", close: jest.fn() };
const createErasureTransport = jest.fn(() => erasureTransport);
const deletion = { userId: "user-one", deletedAt: 3, conversationsDeleted: 2, conversationMessagesDeleted: 4, immutableRecordsDeleted: 1, mutableKeysDeleted: 1, vectorMemoriesDeleted: 3, factsDeleted: 4, graphNodesDeleted: 0, totalDeleted: 11, deletedLayers: ["user-profile", "facts"], verification: { complete: true, issues: [] as string[] }, erasure: erasureReceipt };
const methods = {
  users: { deleteMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(), export: jest.fn<(...args: unknown[]) => Promise<unknown>>(), list: jest.fn<(...args: unknown[]) => Promise<unknown>>(), get: jest.fn<(...args: unknown[]) => Promise<unknown>>(), getHistory: jest.fn<(...args: unknown[]) => Promise<unknown>>(), exists: jest.fn<(...args: unknown[]) => Promise<unknown>>(), delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(), merge: jest.fn<(...args: unknown[]) => Promise<unknown>>(), update: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
  memorySpaces: { list: jest.fn<(...args: unknown[]) => Promise<unknown>>(), get: jest.fn<(...args: unknown[]) => Promise<unknown>>(), register: jest.fn<(...args: unknown[]) => Promise<unknown>>(), delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(), archive: jest.fn<(...args: unknown[]) => Promise<unknown>>(), reactivate: jest.fn<(...args: unknown[]) => Promise<unknown>>(), getStats: jest.fn<(...args: unknown[]) => Promise<unknown>>(), addParticipant: jest.fn<(...args: unknown[]) => Promise<unknown>>(), removeParticipant: jest.fn<(...args: unknown[]) => Promise<unknown>>(), update: jest.fn<(...args: unknown[]) => Promise<unknown>>(), count: jest.fn<(...args: unknown[]) => Promise<unknown>>(), search: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
  memory: { count: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
  conversations: { count: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
  facts: { count: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
};
const clients: Array<{ url: string; auth?: unknown; admin: ReturnType<typeof jest.fn>; close: ReturnType<typeof jest.fn> }> = [];
jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: jest.fn(() => ({
  setAdminAuth: clients.at(-1)!.admin, function: jest.fn(), query: jest.fn(), mutation: jest.fn(), action: jest.fn(),
})) }));
jest.unstable_mockModule("@cortexmemory/sdk", () => ({ createAuthContext: (value: unknown) => value, Cortex: jest.fn((options: { convexUrl: string; auth?: unknown }, runtime?: {initializeTransport?: (transport: unknown) => undefined}) => {
  const admin = jest.fn(), close = jest.fn(); clients.push({ url: options.convexUrl, auth: options.auth, admin, close });
    const transport = {close, query: jest.fn(), mutation: jest.fn(), action: jest.fn(), setAdminAuth: admin};
    runtime?.initializeTransport?.(transport);
  return { ...methods, users: { ...methods.users, exportData, serializeExportEvent, createExportTransport, createErasureTransport }, getClient: () => transport, shutdown: async () => { await transport.close(); }, close: () => transport.close() };
}) }));
const { createProgram } = await import("../../src/program.js");
const { loadConfig } = await import("../../src/utils/config.js");
const { closeClient } = await import("../../src/utils/client.js");
let root: string, home: string, cwd: string, oldCwd: string, oldHome: string | undefined;
let binary: Awaited<ReturnType<typeof stageActualCLI>>;
const config: CLIConfig = { deployments: { one: { url: "http://127.0.0.1:1", key: "fixture-one" }, two: { url: "http://127.0.0.1:2", key: "fixture-two" } }, default: "one", format: "table", confirmDangerous: true };
beforeAll(async () => { if (process.env.CORTEX_TASK04_SOURCE_ONLY !== "1") binary = await stageActualCLI(); }, 30000);
afterAll(async () => { if (binary) await binary.cleanup(); });
beforeEach(() => {
  oldCwd = process.cwd(); oldHome = process.env.HOME;
  root = realpathSync(mkdtempSync(join(tmpdir(), "cortex-domain-real-"))); home = join(root, "home"); cwd = join(root, "project"); mkdirSync(home); mkdirSync(cwd);
  process.env.HOME = home; process.chdir(cwd); writeFileSync(join(home, ".cortexrc"), JSON.stringify(config));
  diskFailure = undefined; shortWrites = false; abortAt = undefined; forcedStageId = undefined; openedStages.length = 0; stageOpenAttempts = 0;
  inspectCascadeProfile.mockReset(); inspectCascadeProfile.mockResolvedValue({ profile: { domain: "immutable", id: "physical-profile" } });
  exportData.mockReset(); exportData.mockImplementation((_id, options) => (async function* () { yield* exportEvents(options.tenantId); })());
  serializeExportEvent.mockReset(); serializeExportEvent.mockImplementation(serializeUserExportEvent); createExportTransport.mockClear(); openStage.mockClear();
  lstatMarker.mockReset(); lstatMarker.mockImplementation(realFs.lstat);
  clients.length = 0; promptConfirmed = false; promptText = ""; jest.clearAllMocks();
  for (const group of Object.values(methods)) for (const method of Object.values(group)) method.mockReset();
  methods.users.list.mockResolvedValue({ users: [profile], total: 1, limit: 50, offset: 0, hasMore: false });
  methods.users.get.mockResolvedValue(profile); methods.users.getHistory.mockResolvedValue(history); methods.users.exists.mockResolvedValue(true);
  methods.users.deleteMany.mockResolvedValue({ deleted: 2, userIds: ["user-one", "user-two"], complete: true, outcomes: [deletion, { ...deletion, userId: "user-two" }], unstarted: [] });
  methods.users.delete.mockResolvedValue(deletion); methods.users.merge.mockResolvedValue({ ...profile, version: 3 }); methods.users.update.mockResolvedValue({ ...profile, version: 1 });
  methods.memorySpaces.list.mockResolvedValue({ spaces: [space], total: 1, offset: 0, hasMore: false }); methods.memorySpaces.get.mockResolvedValue(space);
  methods.memorySpaces.register.mockResolvedValue(space); methods.memorySpaces.delete.mockResolvedValue({ memorySpaceId: space.memorySpaceId, deleted: true, cascade: { memoriesDeleted: 3, conversationsDeleted: 2, factsDeleted: 4, totalBytes: 10 } });
  methods.memorySpaces.archive.mockResolvedValue({ ...space, status: "archived" }); methods.memorySpaces.reactivate.mockResolvedValue(space);
  methods.memorySpaces.getStats.mockResolvedValue({ memorySpaceId: space.memorySpaceId, totalMemories: 3, totalConversations: 2, totalFacts: 4, totalMessages: 5, topTags: [], participants: [] });
  methods.memorySpaces.addParticipant.mockResolvedValue(space); methods.memorySpaces.removeParticipant.mockResolvedValue({ ...space, participants: [] }); methods.memorySpaces.update.mockResolvedValue(space);
  methods.memorySpaces.count.mockResolvedValue(1201); methods.memorySpaces.search.mockResolvedValue([space]);
  methods.memory.count.mockResolvedValue(1001); methods.conversations.count.mockResolvedValue(1200); methods.facts.count.mockResolvedValue(1300);
});
afterEach(async () => { await closeClient(); process.chdir(oldCwd); if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome; rmSync(root, { recursive: true, force: true }); });
async function registered(args: string[], onFailure?: (logs: string[]) => void) {
  const logs: string[] = [], errors: string[] = [];
  const log = jest.spyOn(console, "log").mockImplementation((...values: unknown[]) => { logs.push(values.map(String).join(" ")); });
  const error = jest.spyOn(console, "error").mockImplementation((...values: unknown[]) => { errors.push(values.map(String).join(" ")); });
  try {
    const program = createProgram(await loadConfig());
    const override = (command: typeof program): void => { command.exitOverride().configureOutput({ writeErr: text => { errors.push(text); } }); command.commands.forEach(override); };
    override(program);
    await program.parseAsync(args, { from: "user" }); return { logs, errors };
  }
  catch (error) { onFailure?.(logs); throw error; }
  finally { log.mockRestore(); error.mockRestore(); }
}
async function json(args: string[]) { const output = await registered([...args, "--format", "json"]); return JSON.parse(output.logs.join("\n")); }
async function noReceipt(args: string[]) { return registered([...args, "--format", "json"], logs => { expect(logs).toEqual([]); }); }

const cases: Array<{ args: string[]; method: keyof typeof methods.users; call: unknown[]; expected: unknown }> = [
  { args: ["list", "--no-stats", "--limit", "2", "--offset", "3"], method: "list", call: [{ limit: 2, offset: 3 }], expected: { users: [profile] } },
  { args: ["get", "user-one", "--include-history"], method: "getHistory", call: ["user-one"], expected: { user: profile, history } },
  { args: ["delete", "user-one", "--cascade", "--yes", "--dry-run"], method: "delete", call: ["user-one", { cascade: true, dryRun: true, verify: true, tenantId: undefined, erasureTransport }], expected: { ...deletion, dryRun: true } },
  { args: ["delete-many", "user-one", "user-two", "--cascade", "--yes"], method: "deleteMany", call: [["user-one", "user-two"], { cascade: true, dryRun: false, verify: true, tenantId: undefined, erasureTransport }], expected: { dryRun: false, deleted: 2, userIds: ["user-one", "user-two"], outcomes: [deletion, { ...deletion, userId: "user-two" }], unstarted: [], complete: true } },
  { args: ["stats", "user-one"], method: "getHistory", call: ["user-one"], expected: { totalMemories: 1001, totalConversations: 1200, totalFacts: 1300, spacesWithData: ["space-one"] } },
  { args: ["update", "user-one", "--data", '{"nested":{"x":1}}'], method: "merge", call: ["user-one", { nested: { x: 1 } }], expected: { version: 3 } },
  { args: ["create", "user-one", "--data", '{"name":"New"}'], method: "update", call: ["user-one", { name: "New" }], expected: { version: 1 } },
  { args: ["exists", "user-one"], method: "exists", call: ["user-one"], expected: { userId: "user-one", exists: true } },
];
it.each(cases)("production users $args returns SDK outcome and exact arguments", async ({ args, method, call, expected }) => {
  if (args[0] === "create") methods.users.get.mockResolvedValue(null);
  const result = await json(["users", ...args]); expect(result).toMatchObject(expected as object); expect(methods.users[method]).toHaveBeenCalledWith(...call);
  expect(clients[0].url).toBe(config.deployments.one.url); expect(clients[0].admin).toHaveBeenCalledWith("fixture-one"); expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it.each(cases)("production users $args propagates SDK failure and closes transport", async ({ args, method }) => {
  if (args[0] === "create") methods.users.get.mockResolvedValue(null);
  methods.users[method].mockRejectedValue(new Error("fixture failure"));
  await expect(json(["users", ...args])).rejects.toThrow("fixture failure");
  expect(clients[0].close).toHaveBeenCalledTimes(1);
  
});
it.each(["root", "group", "leaf"])("users globals select correct authenticated target at %s", async position => {
  const flag = ["-d", "two", "--format", "json"];
  const args = position === "root" ? [...flag, "users", "get", "user-one"] : position === "group" ? ["users", ...flag, "get", "user-one"] : ["users", "get", "user-one", ...flag];
  const out = await registered(args); expect(JSON.parse(out.logs.join("\n"))).toEqual(profile); expect(clients[0].url).toBe(config.deployments.two.url); expect(clients[0].admin).toHaveBeenCalledWith("fixture-two");
});
it("users empty page retains machine-readable paging metadata", async () => {
  methods.users.list.mockResolvedValue({ users: [], total: 0, limit: 50, offset: 0, hasMore: false });
  expect(await json(["users", "list"])).toEqual({ users: [], total: 0, limit: 50, offset: 0, hasMore: false }); expect(methods.memorySpaces.list.mock.calls).toEqual([[{ limit: 1 }]]);
});
it("users counts page every space and do not cap conversation/fact totals at 1000", async () => {
  methods.memorySpaces.list.mockResolvedValueOnce({ spaces: [], hasMore: false }).mockResolvedValueOnce({ spaces: [space], hasMore: true, total: 2, offset: 0 }).mockResolvedValueOnce({ spaces: [{ ...space, memorySpaceId: "space-two" }], hasMore: false, total: 2, offset: 1 });
  const result = await json(["users", "stats", "user-one"]);
  expect(result.totalConversations).toBe(2400); expect(result.totalFacts).toBe(2600); expect(result.totalMemories).toBe(2002);
  expect(methods.memorySpaces.list.mock.calls).toEqual([[{ limit: 1 }], [{ limit: 1000, offset: 0 }], [{ limit: 1000, offset: 1 }]]);
  expect(methods.conversations.count).toHaveBeenCalledWith({ memorySpaceId: "space-two", userId: "user-one" });
});
it.each(["list", "stats"])("users %s does not swallow partial counting failures", async leaf => {
  methods.facts.count.mockRejectedValue(new Error("count denied"));
  await expect(json(["users", leaf, ...(leaf === "stats" ? ["user-one"] : [])])).rejects.toThrow("count denied");
});
it("users list surfaces hasMore and exports original fields in JSON", async () => {
  methods.users.list.mockResolvedValue({ users: [profile], total: 20, limit: 1, offset: 2, hasMore: true });
  const result = await json(["users", "list", "--limit", "1", "--offset", "2", "--no-stats"]); expect(result).toEqual({ users: [profile], total: 20, limit: 1, offset: 2, hasMore: true });
});
it.each(["get", "stats", "delete"])("users %s fails on missing profile", async leaf => {
  methods.users.get.mockResolvedValue(null); methods.users.exists.mockResolvedValue(false);
  await expect(json(["users", leaf, "missing", ...(leaf === "delete" ? ["--yes"] : [])])).rejects.toThrow("not found"); expect(methods.users.delete).not.toHaveBeenCalled(); expect(existsSync("user-export.json")).toBe(false);
});
it("users exists emits false result then fails; duplicate create never updates", async () => {
  methods.users.exists.mockResolvedValue(false); await expect(json(["users", "exists", "missing"])).rejects.toThrow("does not exist");
  await expect(json(["users", "create", "user-one"])).rejects.toThrow("already exists"); expect(methods.users.update).not.toHaveBeenCalled();
});
it("users cascade incomplete verification and partial bulk deletion fail", async () => {
  methods.users.delete.mockResolvedValue({ ...deletion, verification: { complete: false, issues: ["facts remain"] } });
  await expect(json(["users", "delete", "user-one", "--cascade", "--yes"])).rejects.toThrow("facts remain");
  methods.users.deleteMany.mockResolvedValue({ deleted: 1, userIds: ["user-one"], complete: false, outcomes: [deletion], unstarted: ["user-two"] });
  await expect(json(["users", "delete-many", "user-one", "user-two", "--cascade", "--yes"])).rejects.toThrow("incomplete");
  expect(methods.users.delete).toHaveBeenCalledTimes(1); expect(methods.users.deleteMany).toHaveBeenCalledTimes(1);
});
it("users --no-verify explicitly forwards false", async () => {
  await json(["users", "delete", "user-one", "--cascade", "--yes", "--no-verify"]);
  expect(methods.users.delete).toHaveBeenCalledWith("user-one", { cascade: true, dryRun: false, verify: false, tenantId: undefined, erasureTransport });
});
it.each(["null", "[]", "2", "true", '"x"', "bad"])("users rejects non-object profile data %s before client", async data => {
  for (const leaf of ["create", "update"]) await expect(json(["users", leaf, "user-one", "--data", data])).rejects.toThrow(); expect(clients).toHaveLength(0);
});
it("users update validates file, exclusivity and retains supplied object", async () => {
  writeFileSync("data.json", '{"kept":true}'); await json(["users", "update", "user-one", "-f", "data.json"]); expect(methods.users.merge).toHaveBeenCalledWith("user-one", { kept: true });
  for (const args of [[], ["--file", "missing.json"], ["--file", "data.json", "--data", "{}"]]) await expect(json(["users", "update", "user-one", ...args])).rejects.toThrow();
});
it.each(["1.5", "1e2", "1x", "0", "1001", "-1"])("users rejects invalid limit %s before SDK", async limit => {
  await expect(json(["users", "list", "--limit", limit])).rejects.toThrow(); expect(clients).toHaveLength(0);
});
it.each(cases.filter(c => c.args[0] !== "list" && c.args[0] !== "delete-many"))("users $args rejects missing positional ID", async ({ args }) => {
  await expect(json(["users", args[0]])).rejects.toThrow(); expect(clients).toHaveLength(0);
});
it("actual binary invalid inputs exit nonzero before any network mutation", async () => {
  if (!binary) throw new Error("Native binary proof requires a separate build/subprocess lease");
  for (const args of [["users", "create", "user-one", "--data", "null"], ["users", "list", "--limit", "1x"], ["users", "update", "user-one"], ["users", "delete-many", "same", "same", "--yes"]]) {
    const result = await runActualCLI(binary.entry, [...args, "--format", "json"], home, cwd); expect(result.status).toBe(1); expect(result.stdout).toBe(""); expect(result.stderr).toMatch(/JSON|integer|required|exactly|distinct/);
  }
});

it("users bulk result redacts configured credentials and preserves per-user failure", async () => {
  methods.users.delete.mockRejectedValueOnce(new Error("fixture-one denied"));
  const lines: string[] = [];
  const log = jest.spyOn(console, "log").mockImplementation((...values: unknown[]) => { lines.push(values.map(String).join(" ")); });
  try {
    await expect(createProgram(await loadConfig()).parseAsync(["users", "delete-many", "user-one", "--yes", "--format", "json"], { from: "user" })).rejects.toThrow("Some users");
  } finally { log.mockRestore(); }
  expect(lines.join("\n")).not.toContain("fixture-one");
  expect(JSON.parse(lines.join("\n")).results).toEqual([{ userId: "user-one", error: "*** denied" }]);
  expect(methods.users.delete).toHaveBeenCalledWith("user-one", { cascade: false, dryRun: false, verify: true });
});

it("users confirmation cancellation and failed exact cascade confirmation do not instantiate clients", async () => {
  expect(await json(["users", "delete", "user-one"])).toEqual({ cancelled: true });
  expect(await json(["users", "delete", "user-one", "--cascade"])).toEqual({ cancelled: true });
  expect(await json(["users", "delete-many", "user-one"])).toEqual({ cancelled: true });
  expect(clients).toHaveLength(0); expect(methods.users.delete).not.toHaveBeenCalled();
});
it("users stats rejects pagination without progress", async () => {
  methods.memorySpaces.list.mockResolvedValue({ spaces: [], total: 2, offset: 0, hasMore: true });
  await expect(json(["users", "stats", "user-one"])).rejects.toThrow("no progress"); expect(methods.memory.count).not.toHaveBeenCalled();
});
it("users unknown explicit target never instantiates a client", async () => {
  await expect(json(["users", "get", "user-one", "-d", "absent"])).rejects.toThrow("not found"); expect(clients).toHaveLength(0);
});
it("users quiet preserves JSON and suppresses hints", async () => {
  const output = await registered(["users", "get", "user-one", "--quiet", "--format", "json"]);
  expect(JSON.parse(output.logs.join("\n"))).toEqual(profile); expect(output.errors).toEqual([]);
});

it("users default table keeps full nested profile values readable", async () => {
  methods.users.get.mockResolvedValue({ ...profile, data: { long: "x".repeat(80), nested: { value: "readable" } } });
  const output = await registered(["users", "get", "user-one"]);
  expect(output.logs.join("\n")).toContain("x".repeat(80)); expect(output.logs.join("\n")).toContain("readable");
});

it("complete export persists canonical raw/history events and recoverable binary chunks with exact receipt", async () => {
  shortWrites = true;
  const result = await json(["users", "export", "user-one", "--output", "owned-export.json"]);
  const expectedManifest = exportEvents().find(event => event.type === "manifest") as Extract<UserExportEvent, { type: "manifest" }>;
  expect(result).toEqual({ output: "owned-export.json", userId: "user-one", version: 1, complete: true, consistency: "rolling-read", records: 3, projections: 0, blobs: 1, tableManifest: expectedManifest.tableManifest, exclusions: expectedManifest.exclusions });
  expect(result.tableManifest.map((entry: { domain: string }) => entry.domain)).toEqual(domains);
  expect(result.tableManifest).toHaveLength(17); expect(result.exclusions.length).toBeGreaterThan(0);
  const text = readFileSync("owned-export.json", "utf8"), bundle = JSON.parse(text);
  const expected = exportEvents();
  expect(bundle.header).toEqual(expected[0]); expect(bundle.records).toEqual(expected.slice(1, 4)); expect(bundle.manifest).toEqual(expected[8]);
  expect(text).toContain(serializeUserExportEvent(expected[1]));
  expect(text).toContain('"10":10,"2":2');
  expect(bundle.records[0].record.versionHistory).toEqual(history);
  expect(bundle.records[0].record.raw.ordered).toEqual(["z", "a"]);
  expect(bundle.records[0].record.raw.integer).toEqual({ $integer: "/////////38=" });
  const recovered = Buffer.concat(bundle.blobs[0].chunks.map((chunk: { data: string }) => Buffer.from(chunk.data, "base64")));
  expect(recovered).toEqual(bytes); expect(createHash("sha256").update(recovered).digest("hex")).toBe(bundle.blobs[0].end.sha256);
  expect(statSync("owned-export.json").mode & 0o777).toBe(0o600);
  expect(openStage).toHaveBeenCalledWith(expect.stringMatching(/\.owned-export\.json\..*\.stage$/), "wx", 0o600);
  expect(readdirSync(cwd)).toEqual(["owned-export.json"]);
  expect(createExportTransport).toHaveBeenCalledWith({ url: config.deployments.one.url, deploymentKey: "fixture-one" });
  const [, options] = exportData.mock.calls[0]; expect(options).not.toHaveProperty("tenantId"); expect(options).toMatchObject({ transport: { fixture: "separate-admin-transport" }, signal: expect.any(AbortSignal) });
  expect(methods.users.get).not.toHaveBeenCalled(); expect(methods.users.getHistory).not.toHaveBeenCalled(); expect(methods.users.export).not.toHaveBeenCalled();
  expect(serializeExportEvent).toHaveBeenCalledTimes(10); expect(clients[0].close).toHaveBeenCalledTimes(1);
});

it.each(["root", "group", "leaf"])("complete export resolves exact target credentials and tenant at %s", async placement => {
  const flags = ["-d", "two", "--format", "json"];
  const command = ["export", "user-one", "--tenant", " tenant-A "];
  const args = placement === "root" ? [...flags, "users", ...command] : placement === "group" ? ["users", ...flags, ...command] : ["users", ...command, ...flags];
  await registered(args);
  expect(createExportTransport).toHaveBeenCalledWith({ url: config.deployments.two.url, deploymentKey: "fixture-two" });
  expect(exportData).toHaveBeenCalledWith("user-one", expect.objectContaining({ tenantId: " tenant-A " }));
  expect(JSON.parse(readFileSync("user-export.json", "utf8")).manifest.identity.scope).toEqual({ kind: "tenant", tenantId: " tenant-A " });
  expect(clients[0].url).toBe(config.deployments.two.url);
});

it("complete export honors scoped use different from default and singleton selection", async () => {
  writeFileSync(join(home, ".cortex-current"), JSON.stringify({ version: 1, selections: { [cwd]: "two" } }));
  await json(["users", "export", "user-one"]);
  expect(createExportTransport).toHaveBeenLastCalledWith({ url: config.deployments.two.url, deploymentKey: "fixture-two" });
  rmSync(join(home, ".cortex-current"));
  writeFileSync(join(home, ".cortexrc"), JSON.stringify({ ...config, deployments: { two: config.deployments.two }, default: "" }));
  await json(["users", "export", "user-one"]);
  expect(createExportTransport).toHaveBeenLastCalledWith({ url: config.deployments.two.url, deploymentKey: "fixture-two" });
});

it.each([["--tenant", ""], ["--tenant", "  "], ["--format", "csv"], ["--format", "table"], ["-d", "missing"]])("complete export invalid %s has zero client/stream/file effects", async (...flags) => {
  await expect(registered(["users", "export", "user-one", ...flags])).rejects.toThrow();
  expect(clients).toHaveLength(0); expect(exportData).not.toHaveBeenCalled(); expect(createExportTransport).not.toHaveBeenCalled(); expect(stageOpenAttempts).toBe(0); expect(readdirSync(cwd)).toEqual([]);
});

it("complete export missing key and ambiguous target fail before client or staging", async () => {
  writeFileSync(join(home, ".cortexrc"), JSON.stringify({ ...config, deployments: { one: { url: config.deployments.one.url } } }));
  await expect(json(["users", "export", "user-one"])).rejects.toThrow("administrator key");
  writeFileSync(join(home, ".cortexrc"), JSON.stringify({ ...config, default: "" }));
  await expect(json(["users", "export", "user-one"])).rejects.toThrow("Choose a deployment");
  expect(clients).toHaveLength(0); expect(stageOpenAttempts).toBe(0); expect(exportData).not.toHaveBeenCalled();
});

it("complete export missing positional ID and unsupported credential flags have zero effects", async () => {
  for (const args of [["users", "export"], ["users", "export", "user-one", "--url", "http://127.0.0.1:2"], ["users", "export", "user-one", "--key", "fixture-key"]])
    await expect(registered(args)).rejects.toThrow();
  expect(clients).toHaveLength(0); expect(stageOpenAttempts).toBe(0);
});

const invalidStreams: Array<[string, (events: UserExportEvent[]) => UserExportEvent[]]> = [
  ["missing manifest", events => events.slice(0, -1)],
  ["missing header", events => events.slice(1)],
  ["duplicate header", events => [events[0], ...events]],
  ["duplicate manifest", events => [...events, events[events.length - 1]]],
  ["post-terminal data", events => [...events, events[1]]],
  ["missing blob end", events => events.filter(event => event.type !== "blobEnd")],
  ["duplicate record", events => [events[0], events[1], ...events.slice(1)]],
  ["wrong version", events => events.map(event => event.type === "manifest" ? { ...event, version: 2 } as unknown as UserExportEvent : event)],
  ["wrong user", events => events.map(event => event.type === "manifest" ? { ...event, identity: { ...event.identity, userId: "foreign-user" } } : event)],
  ["wrong scope", events => events.map(event => event.type === "header" ? { ...event, identity: { ...event.identity, scope: { kind: "tenant", tenantId: "foreign" } } } : event)],
  ["incomplete terminal", events => events.map(event => event.type === "manifest" ? { ...event, complete: false } as unknown as UserExportEvent : event)],
  ["malformed terminal", events => events.map(event => event.type === "manifest" ? { ...event, tableManifest: [] } : event)],
  ["wrong counts", events => events.map(event => event.type === "manifest" ? { ...event, tableManifest: event.tableManifest.map(row => ({ ...row, records: row.records + 1 })) } : event)],
  ["bad sequence", events => events.map(event => event.type === "chunk" ? { ...event, sequence: 4 } : event)],
  ["bad chunk data", events => events.map(event => event.type === "chunk" ? { ...event, data: "not base64" } : event)],
  ["bad checksum", events => events.map(event => event.type === "blobEnd" ? { ...event, sha256: "0".repeat(64) } : event)],
  ["bad raw codec", events => events.map(event => event.type === "record" ? { ...event, record: { bad: { $integer: "bad" } } } : event)],
];
it.each(invalidStreams)("complete export refuses %s without publishing either destination state", async (_name, mutate) => {
  const initialInt = process.listenerCount("SIGINT"), initialTerm = process.listenerCount("SIGTERM");
  for (const existing of [false, true]) {
    if (existing) writeFileSync("failed.json", "old-final-exact-bytes");
    exportData.mockImplementation(() => (async function* () { yield* mutate(exportEvents()); })());
    await expect(noReceipt(["users", "export", "user-one", "--output", "failed.json"])).rejects.toThrow();
    expect(existsSync("failed.json")).toBe(existing);
    if (existing) expect(readFileSync("failed.json", "utf8")).toBe("old-final-exact-bytes");
    expect(readdirSync(cwd).filter(name => name.endsWith(".stage"))).toEqual([]);
  }
  expect(process.listenerCount("SIGINT")).toBe(initialInt); expect(process.listenerCount("SIGTERM")).toBe(initialTerm);
});

it.each(["open", "write", "zero-write", "sync", "close", "rename"] as const)("complete export %s disk failure preserves final bytes and joins cleanup", async kind => {
  for (const existing of [false, true]) {
    diskFailure = kind;
    if (existing) writeFileSync("failed.json", "old-final-exact-bytes");
    await expect(noReceipt(["users", "export", "user-one", "--output", "failed.json"])).rejects.toThrow();
    expect(existsSync("failed.json")).toBe(existing);
    if (existing) expect(readFileSync("failed.json", "utf8")).toBe("old-final-exact-bytes");
    expect(readdirSync(cwd).filter(name => name.endsWith(".stage"))).toEqual([]);
  }
});

it.each(["read", "late-read", "wrong-key", "serializer"])("complete export %s failure emits no receipt and awaits iterator return", async kind => {
  writeFileSync("failed.json", "old-final-exact-bytes");
  let joined = false;
  exportData.mockImplementation(() => (async function* () {
    try {
      if (kind === "wrong-key") throw new Error("fixture-one authorization denied");
      yield* (kind === "read" ? exportEvents().slice(0, 4) : exportEvents());
      if (kind === "read" || kind === "late-read") throw new Error("fixture-one read failed");
    } finally { await new Promise(resolve => setImmediate(resolve)); joined = true; }
  })());
  if (kind === "serializer") serializeExportEvent.mockImplementation(event => { if (event.type === "manifest") throw new Error("fixture-one serializer failed"); return serializeUserExportEvent(event); });
  const lines: string[] = [], log = jest.spyOn(console, "log").mockImplementation((...values: unknown[]) => { lines.push(values.map(String).join(" ")); });
  try {
    const program = createProgram(await loadConfig());
    await expect(program.parseAsync(["users", "export", "user-one", "--output", "failed.json"], { from: "user" })).rejects.toThrow(/\*\*\*/);
  } finally { log.mockRestore(); }
  expect(joined).toBe(true); expect(lines).toEqual([]); expect(readFileSync("failed.json", "utf8")).toBe("old-final-exact-bytes");
  expect(readdirSync(cwd)).toEqual(["failed.json"]); expect(clients[0].close).toHaveBeenCalledTimes(1);
});

it.each(["SIGINT", "SIGTERM"] as const)("complete export %s aborts actual iterator and joins resource/listener cleanup", async signal => {
  let joined = false, aborted = false;
  const initial = process.listenerCount(signal);
  exportData.mockImplementation((_id, options) => (async function* () {
    try {
      yield exportEvents()[0];
      await new Promise<void>(resolve => {
        const listener = () => { aborted = true; options.signal!.removeEventListener("abort", listener); resolve(); };
        options.signal!.addEventListener("abort", listener);
        setImmediate(() => process.emit(signal));
      });
      throw new Error("fixture cancelled read");
    } finally { await new Promise(resolve => setImmediate(resolve)); joined = true; }
  })());
  await expect(json(["users", "export", "user-one"])).rejects.toThrow();
  expect(aborted).toBe(true); expect(joined).toBe(true); expect(process.listenerCount(signal)).toBe(initial); expect(readdirSync(cwd)).toEqual([]);
});

it("complete export reports staging cleanup failure and never publishes or deletes unrelated stage", async () => {
  diskFailure = "unlink"; writeFileSync("foreign.stage", "other-owner");
  exportData.mockImplementation(() => (async function* () { yield exportEvents()[0]; throw new Error("primary read failed"); })());
  await expect(json(["users", "export", "user-one"])).rejects.toThrow("primary read failed; staging removal failed");
  expect(existsSync("user-export.json")).toBe(false); expect(readFileSync("foreign.stage", "utf8")).toBe("other-owner");
  expect(openedStages).toHaveLength(1); expect(existsSync(openedStages[0])).toBe(true);
});

it.each([undefined, null, 0, false, ""])("complete export late falsey throw %s is failure with no published file or receipt", async thrown => {
  for (const existing of [false, true]) {
    if (existing) writeFileSync("failed.json", "old-final-exact-bytes");
    exportData.mockImplementation(() => (async function* () { yield* exportEvents(); throw thrown; })());
    await expect(noReceipt(["users", "export", "user-one", "--output", "failed.json"])).rejects.toThrow("User export failed");
    expect(existsSync("failed.json")).toBe(existing);
    if (existing) expect(readFileSync("failed.json", "utf8")).toBe("old-final-exact-bytes");
    expect(readdirSync(cwd).filter(name => name.endsWith(".stage"))).toEqual([]);
  }
});

it("complete export iterator return failure refuses publication after terminal completion", async () => {
  let returns = 0;
  exportData.mockImplementation(() => {
    const iterator = (async function* () { yield* exportEvents(); })();
    iterator.return = async () => { returns++; throw new Error("fixture iterator cleanup failed"); };
    return iterator;
  });
  await expect(noReceipt(["users", "export", "user-one"])).rejects.toThrow("fixture iterator cleanup failed; iterator cleanup failed");
  expect(returns).toBe(2); expect(readdirSync(cwd)).toEqual([]); expect(clients[0].close).toHaveBeenCalledTimes(1);
});

it("complete export canonical text seam retains UTF16 arbitrary event keys and empty binary", async () => {
  const events = exportEvents();
  const record = events[1] as Extract<UserExportEvent, { type: "record" }>;
  // Convex storage names are ASCII; the public encoded event-text seam additionally
  // defines UTF16 ordering for arbitrary keys. This is seam coverage, not native storage evidence.
  record.record = { ...(record.record as Record<string, unknown>), keys: { "2": "two", "10": "ten", "\uffff": "last", "🧠": "beforeLast" } } as typeof record.record;
  const emptyDigest = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
  for (const event of events) {
    if (event.type === "blob" || event.type === "blobEnd") { event.size = 0; event.sha256 = emptyDigest; }
    if (event.type === "blobEnd") event.chunks = 0;
    if (event.type === "manifest") { event.blobs[0].size = 0; event.blobs[0].sha256 = emptyDigest; }
  }
  exportData.mockImplementation(() => (async function* () { yield* events.filter(event => event.type !== "chunk"); })());
  await json(["users", "export", "user-one"]);
  const text = readFileSync("user-export.json", "utf8"), bundle = JSON.parse(text);
  expect(text).toContain('"keys":{"10":"ten","2":"two","🧠":"beforeLast","\uffff":"last"}');
  expect(bundle.blobs[0].chunks).toEqual([]); expect(bundle.blobs[0].end).toMatchObject({ chunks: 0, size: 0, sha256: emptyDigest });
});

it.each(["sync", "close"] as const)("complete export abort observed at awaited %s blocks the synchronous commit", async boundary => {
  writeFileSync("failed.json", "old-final-exact-bytes"); abortAt = boundary;
  const initialInt = process.listenerCount("SIGINT"), initialTerm = process.listenerCount("SIGTERM");
  await expect(noReceipt(["users", "export", "user-one", "--output", "failed.json"])).rejects.toThrow("cancelled");
  expect(commitRename).not.toHaveBeenCalled(); expect(readFileSync("failed.json", "utf8")).toBe("old-final-exact-bytes");
  expect(readdirSync(cwd)).toEqual(["failed.json"]); expect(process.listenerCount("SIGINT")).toBe(initialInt); expect(process.listenerCount("SIGTERM")).toBe(initialTerm);
});

it("complete export exclusive stage collision preserves both final and unowned stage", async () => {
  forcedStageId = "collision";
  writeFileSync("failed.json", "old-final-exact-bytes"); writeFileSync(".failed.json.collision.stage", "unowned-stage");
  await expect(noReceipt(["users", "export", "user-one", "--output", "failed.json"])).rejects.toThrow();
  expect(readFileSync("failed.json", "utf8")).toBe("old-final-exact-bytes");
  expect(readFileSync(".failed.json.collision.stage", "utf8")).toBe("unowned-stage");
  expect(openedStages).toEqual([]); expect(commitRename).not.toHaveBeenCalled();
});

it("complete export retains artifact version order and every version referrer on deduplicated storage", async () => {
  const events = exportEvents(), artifactNode = { domain: "artifacts" as const, id: "artifact-owned" as never };
  const artifact = { _id: "artifact-owned", userId: "user-one", versionPointer: 4, fileRef: { storageId: "storage-owned" }, versionHistory: [{ version: 1, fileRef: { storageId: "storage-owned" }, metadata: { label: "oldest" } }, { version: 3, fileRef: { storageId: "storage-owned" }, metadata: { label: "retained-gap" } }] };
  events.splice(3, 0, { type: "record", node: artifactNode, fingerprint: "d".repeat(64), disposition: "record", record: artifact });
  const blob = events.find(event => event.type === "blob") as Extract<UserExportEvent, { type: "blob" }>;
  blob.referrers = [...[1, 3, 4].map(version => ({ node: artifactNode, version })), ...blob.referrers];
  const manifest = events.find(event => event.type === "manifest") as Extract<UserExportEvent, { type: "manifest" }>;
  manifest.blobs[0].referrers = blob.referrers; manifest.projectionCount = 4;
  manifest.tableManifest.find(entry => entry.domain === "artifacts")!.records = 1;
  exportData.mockImplementation(() => (async function* () { yield* events; })());
  const receipt = await json(["users", "export", "user-one"]), bundle = JSON.parse(readFileSync("user-export.json", "utf8"));
  expect(receipt).toMatchObject({ records: 4, blobs: 1 });
  expect(bundle.records.find((event: { node: { domain: string } }) => event.node.domain === "artifacts").record).toEqual(artifact);
  expect(bundle.blobs).toHaveLength(1); expect(bundle.blobs[0].metadata.referrers).toEqual(blob.referrers); expect(bundle.manifest.blobs[0].referrers).toEqual(blob.referrers);
});

it("actual registered export leaf help states administrator/version1/supported/history/binary/scope/consistency without config or client effects", async () => {
  const output: string[] = [], program = createProgram(config);
  const override = (command: typeof program): void => {
    command.exitOverride().configureOutput({ writeOut: text => { output.push(text); }, writeErr: text => { output.push(text); } });
    command.commands.forEach(override);
  };
  override(program);
  await expect(program.parseAsync(["users", "export", "--help"], { from: "user" })).rejects.toMatchObject({ code: "commander.helpDisplayed", exitCode: 0 });
  const text = output.join("");
  expect(text).toContain("version1 SDK-supported user data");
  expect(text).toContain("deployment administrator authority and a deployment key");
  expect(text).toContain("all eligible retained histories and binary files");
  expect(text).toContain("tenantless only when --tenant is omitted");
  expect(text).toContain("an explicit --tenant selects exactly that tenant");
  expect(text).toContain("rolling-read"); expect(text).toContain("no atomic snapshot is guaranteed");
  expect(text).toContain("user-export.json"); expect(text).toContain("--output <file>"); expect(text).toContain("--tenant <tenantId>");
  expect(text).not.toContain("fixture-one"); expect(text).not.toContain("fixture-two");
  expect(openStage).not.toHaveBeenCalled(); expect(configReadFile).not.toHaveBeenCalled();
  expect(clients).toHaveLength(0); expect(createExportTransport).not.toHaveBeenCalled(); expect(exportData).not.toHaveBeenCalled();
  expect(serializeExportEvent).not.toHaveBeenCalled(); expect(stageOpenAttempts).toBe(0); expect(commitRename).not.toHaveBeenCalled();
  expect(readdirSync(cwd)).toEqual([]);
});

// Accepted Task19 is the data oracle; these controls exercise the production command boundary.
it.each(["delete", "delete-many"])("users %s cascade binds the selected endpoint/key and exact whitespace-preserving tenant without exists", async leaf => {
  methods.users.exists.mockResolvedValue(false);
  const ids = leaf === "delete" ? ["user-one"] : ["user-one", "user-two"];
  await json(["users", leaf, ...ids, "--cascade", "--yes", "--tenant", " tenant-A ", "-d", "two"]);
  expect(createErasureTransport).toHaveBeenCalledTimes(1);
  expect(createErasureTransport).toHaveBeenCalledWith({ url: config.deployments.two.url, deploymentKey: "fixture-two" });
  const method = leaf === "delete" ? methods.users.delete : methods.users.deleteMany;
  expect(method).toHaveBeenCalledWith(leaf === "delete" ? "user-one" : ids, expect.objectContaining({ tenantId: " tenant-A ", cascade: true, erasureTransport }));
  expect(methods.users.exists).not.toHaveBeenCalled(); expect(erasureTransport.close).toHaveBeenCalledTimes(1);
  if (leaf === "delete-many") expect(methods.users.delete).not.toHaveBeenCalled();
});
it.each(["delete", "delete-many"])("users %s rejects missing administrator authority and malformed tenant before client/transport", async leaf => {
  await expect(json(["users", leaf, "user-one", "--cascade", "--yes", "--tenant", " "])).rejects.toThrow("nonempty");
  writeFileSync(join(home, ".cortexrc"), JSON.stringify({ ...config, deployments: { one: { url: config.deployments.one.url } } }));
  await expect(json(["users", leaf, "user-one", "--cascade", "--yes"])).rejects.toThrow("administrator key");
  expect(clients).toHaveLength(0); expect(createErasureTransport).not.toHaveBeenCalled(); expect(methods.users.delete).not.toHaveBeenCalled(); expect(methods.users.deleteMany).not.toHaveBeenCalled();
});
it("users profile-only rejects a maintenance tenant and retains ordinary existence/delete behavior", async () => {
  await expect(json(["users", "delete", "user-one", "--yes", "--tenant", "tenant-A"])).rejects.toThrow("requires an explicit --scope-user");
  expect(clients).toHaveLength(0);
  await json(["users", "delete", "user-one", "--yes"]);
  expect(methods.users.exists).toHaveBeenCalledWith("user-one");
  expect(methods.users.delete).toHaveBeenCalledWith("user-one", { cascade: false, dryRun: false, verify: true });
  expect(createErasureTransport).not.toHaveBeenCalled();
});
it("users bulk later-target preflight rejection invokes one whole-bulk request with zero individual mutations", async () => {
  methods.users.deleteMany.mockRejectedValue(Object.assign(new Error("later target blocked"), {
    receipt: { ...erasureReceipt, executed: false, complete: false, totalDeleted: 0, outcomes: [], remaining: ["physical-later"], blockers: [{ id: "physical-later", reason: "foreign incoming source" }] },
  }));
  await expect(registered(["users", "delete-many", "user-one", "user-two", "--cascade", "--yes", "--format", "json"], logs => {
    const output = JSON.parse(logs.join("\n"));
    expect(output.complete).toBe(false); expect(output.receipt.outcomes).toEqual([]); expect(output.receipt.executed).toBe(false);
    expect(output.receipt.blockers[0].id).toBe("physical-later");
  })).rejects.toThrow("later target blocked");
  expect(methods.users.deleteMany).toHaveBeenCalledTimes(1); expect(methods.users.delete).not.toHaveBeenCalled(); expect(methods.users.exists).not.toHaveBeenCalled();
  expect(erasureTransport.close).toHaveBeenCalledTimes(1); expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it.each([false, true])("users bulk stopped receipt retains exact committed/unstarted/unknown sets (unknown=%s) and never retries", async unknown => {
  const receipt = { ...erasureReceipt, operationId: "original-no-resend", complete: false, remaining: ["physical-pending"], unknown: unknown ? ["physical-pending"] : [] };
  methods.users.deleteMany.mockRejectedValue(Object.assign(new Error("fixture-two partial"), {
    receipt, deleted: 1, userIds: ["user-one"], outcomes: [deletion], unstarted: ["user-three"],
    cause: Object.assign(new Error("fixture-two cause"), { code: unknown ? "ERASURE_OUTCOME_UNKNOWN" : "ERASURE_BLOCKED", receipt }),
  }));
  await expect(registered(["users", "delete-many", "user-one", "user-two", "user-three", "--cascade", "--yes", "-d", "two", "--format", "json", "--quiet"], logs => {
    const output = JSON.parse(logs.join("\n"));
    expect(output).toMatchObject({ complete: false, deleted: 1, userIds: ["user-one"], unstarted: ["user-three"], outcomes: [deletion], receipt, cause: { code: unknown ? "ERASURE_OUTCOME_UNKNOWN" : "ERASURE_BLOCKED" } });
    expect(logs.join("\n")).not.toContain("fixture-two"); expect(output.error).toBe("*** partial");
  })).rejects.toThrow("partial");
  expect(methods.users.deleteMany).toHaveBeenCalledTimes(1); expect(methods.users.delete).not.toHaveBeenCalled(); expect(erasureTransport.close).toHaveBeenCalledTimes(1); expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("users bulk dry-run/no-verify retains incomplete truth without implying verified deletion", async () => {
  methods.users.deleteMany.mockResolvedValue({ deleted: 0, userIds: ["user-one", "user-two"], complete: false, outcomes: [{ ...deletion, totalDeleted: 0, verification: { complete: false, issues: [] }, erasure: { ...erasureReceipt, executed: false, complete: false, outcomes: [], totalDeleted: 0 } }], unstarted: [] });
  const preview = await json(["users", "delete-many", "user-one", "user-two", "--cascade", "--dry-run"]);
  expect(preview).toMatchObject({ deleted: 0, complete: false, dryRun: true }); expect(preview.outcomes[0].erasure.executed).toBe(false);
  const unverified = await json(["users", "delete-many", "user-one", "user-two", "--cascade", "--yes", "--no-verify"]);
  expect(unverified.complete).toBe(false); expect(methods.users.deleteMany).toHaveBeenLastCalledWith(["user-one", "user-two"], expect.objectContaining({ verify: false }));
});
it("users single cascade failure emits original receipt and sanitized cause before rejection", async () => {
  methods.users.delete.mockRejectedValue(Object.assign(new Error("fixture-one stop"), { cause: Object.assign(new Error("fixture-one unknown"), { code: "ERASURE_OUTCOME_UNKNOWN", receipt: { ...erasureReceipt, complete: false, unknown: ["physical-profile"] } }) }));
  await expect(registered(["users", "delete", "user-one", "--cascade", "--yes", "--format", "json"], logs => {
    const output = JSON.parse(logs.join("\n")); expect(output.receipt.operationId).toBe(erasureReceipt.operationId); expect(output.receipt.unknown).toEqual(["physical-profile"]); expect(output.complete).toBe(false); expect(output.cause.message).toBe("*** unknown");
  })).rejects.toThrow("stop");
  expect(methods.users.delete).toHaveBeenCalledTimes(1); expect(erasureTransport.close).toHaveBeenCalledTimes(1);
});
it("users partial CSV remains a single valid row containing the original receipt and quoted sets", async () => {
  methods.users.deleteMany.mockRejectedValue(Object.assign(new Error("partial, stopped"), { receipt: { ...erasureReceipt, complete: false }, deleted: 1, userIds: ["user-one"], unstarted: ["user-two"] }));
  await expect(registered(["users", "delete-many", "user-one", "user-two", "--cascade", "--yes", "--format", "csv"], logs => {
    expect(logs).toHaveLength(1); const lines = logs[0].split("\n"); expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("receipt,deleted,userIds"); expect(lines[1]).toContain('"partial, stopped"'); expect(lines[1]).toContain('""operationId"":""operation-original""');
  })).rejects.toThrow("partial");
});
it.each(["directory", "file", "symlink"])("users selected project graph %s marker refuses before effects", async kind => {
  const project = join(root, "selected-project"); mkdirSync(join(project, ".cortex"), { recursive: true });
  const marker = join(project, ".cortex", "graph");
  if (kind === "directory") mkdirSync(marker); else if (kind === "file") writeFileSync(marker, "incomplete"); else symlinkSync(join(root, "missing-target"), marker);
  writeFileSync(join(home, ".cortexrc"), JSON.stringify({ ...config, deployments: { ...config.deployments, two: { ...config.deployments.two, projectPath: project } } }));
  await expect(json(["users", "delete-many", "user-one", "user-two", "--cascade", "--yes", "-d", "two"])).rejects.toThrow(/GRAPH_|graph/);
  expect(clients).toHaveLength(0); expect(createErasureTransport).not.toHaveBeenCalled(); expect(methods.users.deleteMany).not.toHaveBeenCalled();
});
it("users uses only selected explicit graph path: absent marker is off; unrelated cwd marker is not read", async () => {
  mkdirSync(join(cwd, ".cortex", "graph"), { recursive: true }); const project = join(root, "selected-empty"); mkdirSync(project);
  writeFileSync(join(home, ".cortexrc"), JSON.stringify({ ...config, deployments: { ...config.deployments, two: { ...config.deployments.two, projectPath: project } } }));
  await json(["users", "delete", "user-one", "--cascade", "--yes", "-d", "two"]);
  expect(lstatMarker).toHaveBeenCalledWith(join(project, ".cortex", "graph")); expect(lstatMarker).not.toHaveBeenCalledWith(join(cwd, ".cortex", "graph")); expect(methods.users.delete).toHaveBeenCalledTimes(1);
});
it("users graph filesystem errors propagate before client rather than silently treating graph as off", async () => {
  const project = join(root, "selected-error"); mkdirSync(project);
  writeFileSync(join(home, ".cortexrc"), JSON.stringify({ ...config, deployments: { ...config.deployments, one: { ...config.deployments.one, projectPath: project } } }));
  lstatMarker.mockRejectedValueOnce(Object.assign(new Error("marker denied"), { code: "EACCES" }));
  await expect(json(["users", "delete", "user-one", "--cascade", "--yes"])).rejects.toThrow("marker denied"); expect(clients).toHaveLength(0); expect(createErasureTransport).not.toHaveBeenCalled();
});

it.each(["delete", "delete-many"])("I156 users %s missing exact selected profile refuses before any erasure and closes readonly signal", async leaf => {
  const ids = leaf === "delete" ? ["user-one"] : ["user-one", "user-two"];
  if (leaf === "delete-many") inspectCascadeProfile.mockResolvedValueOnce({ profile: { domain: "immutable", id: "physical-first" } });
  inspectCascadeProfile.mockResolvedValue({ profile: null });
  await expect(registered(["users", leaf, ...ids, "--cascade", "--yes", "-d", "two", "--tenant", " tenant-A ", "--format", "json"], logs => { expect(logs).toEqual([]); })).rejects.toThrow("no profile in the selected tenant scope");
  expect(createExportTransport).toHaveBeenCalledWith({ url: config.deployments.two.url, deploymentKey: "fixture-two" });
  expect(inspectCascadeProfile.mock.calls.map(call => call[0])).toEqual(ids.map(userId => ({ userId, scope: { kind: "tenant", tenantId: " tenant-A " } })));
  for (const call of inspectCascadeProfile.mock.calls) expect((call[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
  expect(methods.users.exists).not.toHaveBeenCalled(); expect(createErasureTransport).not.toHaveBeenCalled(); expect(methods.users.delete).not.toHaveBeenCalled(); expect(methods.users.deleteMany).not.toHaveBeenCalled();
  expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it.each(["delete", "delete-many"])("I156 users %s native missing-profile refusal is actionable and does not erase foreign/tenantless profiles", async leaf => {
  inspectCascadeProfile.mockRejectedValue(Object.assign(new Error("Fixed export inspect refused"), { code: "EXPORT_PROFILE_NOT_FOUND" }));
  await expect(json(["users", leaf, "missing", "--cascade", "--yes", "--tenant", "tenant-A"])).rejects.toThrow("Use the SDK supported-erasure API for orphan data");
  expect(inspectCascadeProfile).toHaveBeenCalledWith({ userId: "missing", scope: { kind: "tenant", tenantId: "tenant-A" } }, { signal: expect.any(AbortSignal) });
  expect(methods.users.get).not.toHaveBeenCalled(); expect(methods.users.exists).not.toHaveBeenCalled(); expect(methods.users.delete).not.toHaveBeenCalled(); expect(methods.users.deleteMany).not.toHaveBeenCalled(); expect(createErasureTransport).not.toHaveBeenCalled();
  expect((inspectCascadeProfile.mock.calls[0][1] as { signal: AbortSignal }).signal.aborted).toBe(true); expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("I156 bulk checks all exact tenantless profiles before the one SDK whole-bulk operation", async () => {
  const order: string[] = [];
  inspectCascadeProfile.mockImplementation(async request => { order.push((request as { userId: string }).userId); return { profile: { domain: "immutable", id: "physical-selected" } }; });
  methods.users.deleteMany.mockImplementation(async () => { order.push("bulk-erasure"); return { deleted: 2, userIds: ["user-one", "user-two"], complete: true, outcomes: [deletion], unstarted: [] }; });
  const output = await json(["users", "delete-many", "user-one", "user-two", "--cascade", "--yes"]);
  expect(order).toEqual(["user-one", "user-two", "bulk-erasure"]); expect(output.deleted).toBe(2);
  expect(inspectCascadeProfile.mock.calls.map(call => call[0])).toEqual(["user-one", "user-two"].map(userId => ({ userId, scope: { kind: "tenantless" } })));
  expect(methods.users.deleteMany).toHaveBeenCalledTimes(1); expect(methods.users.delete).not.toHaveBeenCalled(); expect(erasureTransport.close).toHaveBeenCalledTimes(1);
  for (const call of inspectCascadeProfile.mock.calls) expect((call[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
});
it("I156 readonly inspection denial/ambiguity remains a refusal with no fabricated profile or erasure", async () => {
  for (const code of ["EXPORT_AUTHORIZATION", "EXPORT_PROFILE_AMBIGUOUS"]) {
    inspectCascadeProfile.mockRejectedValueOnce(Object.assign(new Error(code), { code }));
    await expect(json(["users", "delete", "user-one", "--cascade", "--yes"])).rejects.toThrow(code);
  }
  expect(createErasureTransport).not.toHaveBeenCalled(); expect(methods.users.delete).not.toHaveBeenCalled(); expect(methods.users.exists).not.toHaveBeenCalled();
  for (const call of inspectCascadeProfile.mock.calls) expect((call[1] as { signal: AbortSignal }).signal.aborted).toBe(true);
});
it("I156 missing profile dry-run refuses rather than reporting an empty complete preview", async () => {
  inspectCascadeProfile.mockResolvedValue({ profile: null });
  await expect(json(["users", "delete", "missing", "--cascade", "--dry-run"])).rejects.toThrow("existing profile");
  expect(createErasureTransport).not.toHaveBeenCalled(); expect(methods.users.delete).not.toHaveBeenCalled();
});

it.each(["root", "group", "leaf"])("Task21 ordinary scope flags at %s reach AuthContext and never derive caller from users target", async position => {
  const flags = ["--scope-user", "caller-one", "--tenant", "tenant-A", "--graph-sync", "off"];
  const args = position === "root" ? [...flags, "users", "get", "user-one"] : position === "group" ? ["users", ...flags, "get", "user-one"] : ["users", "get", "user-one", ...flags];
  expect(await json(args)).toEqual(profile); expect(clients[0].auth).toEqual({ userId: "caller-one", tenantId: "tenant-A" }); expect(methods.users.get).toHaveBeenCalledWith("user-one");
});
it("Task21 closest ordinary explicit scope wins over ancestors but maintenance tenant conflicts refuse before client", async () => {
  await json(["--scope-user", "root-caller", "--tenant", "root-tenant", "users", "--scope-user", "group-caller", "get", "user-one", "--scope-user", "leaf-caller", "--tenant", "leaf-tenant", "--graph-sync", "off"]);
  expect(clients[0].auth).toEqual({ userId: "leaf-caller", tenantId: "leaf-tenant" });
  clients.length = 0; createErasureTransport.mockClear(); createExportTransport.mockClear();
  await expect(json(["--tenant", "tenant-A", "users", "delete", "user-one", "--tenant", "tenant-B", "--cascade", "--yes"])).rejects.toThrow("Conflicting explicit maintenance tenant");
  expect(clients).toHaveLength(0); expect(createErasureTransport).not.toHaveBeenCalled(); expect(createExportTransport).not.toHaveBeenCalled();
});
it("Task21 maintenance caller scope never substitutes the target user and does not require a caller", async () => {
  await json(["users", "delete", "user-one", "--cascade", "--yes", "--tenant", "tenant-A", "--scope-user", "separate-caller", "--graph-sync", "off"]);
  expect(clients[0].auth).toEqual({ userId: "separate-caller", tenantId: "tenant-A" });
  expect(inspectCascadeProfile).toHaveBeenCalledWith({ userId: "user-one", scope: { kind: "tenant", tenantId: "tenant-A" } }, { signal: expect.any(AbortSignal) });
  expect(methods.users.delete).toHaveBeenCalledWith("user-one", expect.objectContaining({ tenantId: "tenant-A" }));
  await json(["users", "delete", "user-two", "--cascade", "--yes", "--tenant", "tenant-A", "--graph-sync", "off"]);
  expect(clients[1].auth).toBeUndefined(); expect(methods.users.delete).toHaveBeenLastCalledWith("user-two", expect.objectContaining({ tenantId: "tenant-A" }));
});
it.each([["--scope-user", " "], ["--tenant", "A"], ["--graph-sync", "maybe"]])("Task21 invalid ordinary caller options %j refuse before clients or target reads", async flags => {
  await expect(json(["users", "get", "user-one", ...flags])).rejects.toThrow(); expect(clients).toHaveLength(0); expect(methods.users.get).not.toHaveBeenCalled();
});
it("Task21 ordinary profile-only explicit tenant now uses caller AuthContext rather than a maintenance transport", async () => {
  await json(["users", "delete", "user-one", "--yes", "--scope-user", "caller-A", "--tenant", "tenant-A", "--graph-sync", "off"]);
  expect(clients[0].auth).toEqual({ userId: "caller-A", tenantId: "tenant-A" }); expect(methods.users.exists).toHaveBeenCalledWith("user-one"); expect(createErasureTransport).not.toHaveBeenCalled(); expect(inspectCascadeProfile).not.toHaveBeenCalled();
});
