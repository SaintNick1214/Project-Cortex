/** Tests execute createProgram's production registry with SDK transport mocks. */
import { it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from "@jest/globals";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync, symlinkSync } from "fs";
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
const realFs = await import("fs/promises");
const lstatMarker = jest.fn(realFs.lstat);
jest.unstable_mockModule("fs/promises", () => ({ ...realFs, lstat: lstatMarker }));
const profile = { id: "user-one", data: { name: "First", kept: true }, version: 2, createdAt: 1, updatedAt: 2 };
const history = [{ version: 1, data: { name: "Before" }, timestamp: 1 }, { version: 2, data: profile.data, timestamp: 2 }];
const space = { memorySpaceId: "space-one", name: "Space", type: "team", status: "active", metadata: { kept: true }, participants: [{ id: "p-one", type: "agent", joinedAt: 10 }], createdAt: 1, updatedAt: 2 };
const erasureReceipt = { version: 1, operationId: "space-operation-original", domain: { kind: "memorySpace", memorySpaceId: "space-one" },
  executed: true, complete: true, fullUserDataErased: false, totalDeleted: 10, planned: [{ table: "memorySpaces", id: "physical-space", action: "delete" }],
  outcomes: [{ table: "memorySpaces", id: "physical-space", state: "committed", deleted: 1 }], remaining: [], blockers: [],
  graph: { state: "notConfigured", jobs: [], nodesDeleted: 0 }, verification: { state: "complete", complete: true }, exclusions: ["sharedRegistry"], unknown: [], errors: [] };
const erasureTransport = { kind: "cortex-erasure-v1", close: jest.fn() };
const createErasureTransport = jest.fn(() => erasureTransport);
const deletion = { userId: "user-one", deletedAt: 3, conversationsDeleted: 2, conversationMessagesDeleted: 4, immutableRecordsDeleted: 1, mutableKeysDeleted: 1, vectorMemoriesDeleted: 3, factsDeleted: 4, graphNodesDeleted: 0, totalDeleted: 11, deletedLayers: ["user-profile", "facts"], verification: { complete: true, issues: [] as string[] } };
const methods = {
  users: { list: jest.fn<(...args: unknown[]) => Promise<unknown>>(), get: jest.fn<(...args: unknown[]) => Promise<unknown>>(), getHistory: jest.fn<(...args: unknown[]) => Promise<unknown>>(), exists: jest.fn<(...args: unknown[]) => Promise<unknown>>(), delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(), merge: jest.fn<(...args: unknown[]) => Promise<unknown>>(), update: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
  memorySpaces: { list: jest.fn<(...args: unknown[]) => Promise<unknown>>(), get: jest.fn<(...args: unknown[]) => Promise<unknown>>(), register: jest.fn<(...args: unknown[]) => Promise<unknown>>(), delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(), archive: jest.fn<(...args: unknown[]) => Promise<unknown>>(), reactivate: jest.fn<(...args: unknown[]) => Promise<unknown>>(), getStats: jest.fn<(...args: unknown[]) => Promise<unknown>>(), addParticipant: jest.fn<(...args: unknown[]) => Promise<unknown>>(), removeParticipant: jest.fn<(...args: unknown[]) => Promise<unknown>>(), update: jest.fn<(...args: unknown[]) => Promise<unknown>>(), count: jest.fn<(...args: unknown[]) => Promise<unknown>>(), search: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
  memory: { count: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
  conversations: { count: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
  facts: { count: jest.fn<(...args: unknown[]) => Promise<unknown>>() },
};
const clients: Array<{ url: string; admin: ReturnType<typeof jest.fn>; close: ReturnType<typeof jest.fn> }> = [];
jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: jest.fn(() => ({
  setAdminAuth: clients.at(-1)!.admin, query: jest.fn(), mutation: jest.fn(), action: jest.fn(),
})) }));
jest.unstable_mockModule("@cortexmemory/sdk", () => ({ createAuthContext: (value: unknown) => value, Cortex: jest.fn((options: { convexUrl: string }, runtime?: {initializeTransport?: (transport: unknown) => undefined}) => {
  const admin = jest.fn(), close = jest.fn(); clients.push({ url: options.convexUrl, admin, close });
    const transport = {close, query: jest.fn(), mutation: jest.fn(), action: jest.fn(), setAdminAuth: admin};
    runtime?.initializeTransport?.(transport);
  return { ...methods, memorySpaces: { ...methods.memorySpaces, createErasureTransport }, getClient: () => transport, shutdown: async () => { await transport.close(); }, close: () => transport.close() };
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
  lstatMarker.mockReset(); lstatMarker.mockImplementation(realFs.lstat);
  clients.length = 0; promptConfirmed = false; promptText = ""; jest.clearAllMocks();
  for (const group of Object.values(methods)) for (const method of Object.values(group)) method.mockReset();
  methods.users.list.mockResolvedValue({ users: [profile], total: 1, limit: 50, offset: 0, hasMore: false });
  methods.users.get.mockResolvedValue(profile); methods.users.getHistory.mockResolvedValue(history); methods.users.exists.mockResolvedValue(true);
  methods.users.delete.mockResolvedValue(deletion); methods.users.merge.mockResolvedValue({ ...profile, version: 3 }); methods.users.update.mockResolvedValue({ ...profile, version: 1 });
  methods.memorySpaces.list.mockResolvedValue({ spaces: [space], total: 1, offset: 0, hasMore: false }); methods.memorySpaces.get.mockResolvedValue(space);
  methods.memorySpaces.register.mockResolvedValue(space); methods.memorySpaces.delete.mockResolvedValue({ memorySpaceId: space.memorySpaceId, deleted: true, cascade: { memoriesDeleted: 3, conversationsDeleted: 2, factsDeleted: 4, totalBytes: 10 }, erasure: erasureReceipt });
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

const cases: Array<{ args: string[]; method: keyof typeof methods.memorySpaces; call: unknown[]; expected: unknown }> = [
  { args: ["list", "--type", "team", "--status", "active", "--limit", "2", "--offset", "3"], method: "list", call: [{ type: "team", status: "active", limit: 2, offset: 3 }], expected: { spaces: [space], total: 1 } },
  { args: ["create", "space-one", "--type", "team", "--name", "Space", "--metadata", '{"kept":true}'], method: "register", call: [{ memorySpaceId: "space-one", type: "team", name: "Space", metadata: { kept: true } }], expected: space },
  { args: ["get", "space-one"], method: "get", call: ["space-one"], expected: space },
  { args: ["delete", "space-one", "--cascade", "--reason", "Owned cleanup", "--yes"], method: "delete", call: ["space-one", { cascade: true, reason: "Owned cleanup", confirmId: "space-one", dryRun: false, verify: true, tenantId: undefined, erasureTransport }], expected: { deleted: true, cascade: { memoriesDeleted: 3, conversationsDeleted: 2, factsDeleted: 4 } } },
  { args: ["archive", "space-one", "--reason", "Finished", "--yes"], method: "archive", call: ["space-one", { reason: "Finished" }], expected: { status: "archived" } },
  { args: ["reactivate", "space-one"], method: "reactivate", call: ["space-one"], expected: { status: "active" } },
  { args: ["stats", "space-one"], method: "getStats", call: ["space-one"], expected: { totalFacts: 4, totalMemories: 3 } },
  { args: ["participants", "space-one"], method: "get", call: ["space-one"], expected: space.participants },
  { args: ["add-participant", "space-one", "--id", "p-two", "--type", "tool"], method: "addParticipant", call: ["space-one", { id: "p-two", type: "tool", joinedAt: expect.any(Number) }], expected: space },
  { args: ["remove-participant", "space-one", "--id", "p-one", "--yes"], method: "removeParticipant", call: ["space-one", "p-one"], expected: { participants: [] } },
  { args: ["update", "space-one", "--name", "Next", "--status", "archived", "--metadata", '{"new":1}'], method: "update", call: ["space-one", { name: "Next", status: "archived", metadata: { kept: true, new: 1 } }], expected: space },
  { args: ["count", "--type", "team", "--status", "active"], method: "count", call: [{ type: "team", status: "active" }], expected: { count: 1201, type: "team", status: "active" } },
  { args: ["search", "Space", "--type", "team", "--status", "active", "--limit", "2"], method: "search", call: ["Space", { type: "team", status: "active", limit: 2 }], expected: [space] },
];
it.each(cases)("production spaces $args returns SDK outcome and exact args", async ({ args, method, call, expected }) => {
  if (args[0] === "create") methods.memorySpaces.get.mockResolvedValue(null);
  expect(await json(["spaces", ...args])).toMatchObject(expected as object); expect(methods.memorySpaces[method]).toHaveBeenCalledWith(...call);
  expect(clients[0].url).toBe(config.deployments.one.url); expect(clients[0].admin).toHaveBeenCalledWith("fixture-one"); expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it.each(cases)("production spaces $args propagates SDK failure and closes transport", async ({ args, method }) => {
  if (args[0] === "create") methods.memorySpaces.get.mockResolvedValue(null);
  methods.memorySpaces[method].mockRejectedValue(new Error("fixture failure"));
  if (method === "list") methods.memorySpaces.list.mockResolvedValueOnce({ spaces: [], hasMore: false });
  await expect(json(["spaces", ...args])).rejects.toThrow("fixture failure"); expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("spaces access rejection blocks all command reads/mutations and closes the selected client", async () => {
  methods.memorySpaces.list.mockRejectedValue(new Error("fixture-one secret-from-server"));
  await expect(json(["spaces", "create", "new-space", "--type", "team"])).rejects.toThrow("No command operation was started");
  expect(methods.memorySpaces.list).toHaveBeenCalledTimes(1);
  expect(methods.memorySpaces.list).toHaveBeenCalledWith({ limit: 1 });
  expect(methods.memorySpaces.get).not.toHaveBeenCalled();
  expect(methods.memorySpaces.register).not.toHaveBeenCalled();
  expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it.each(["root", "group", "leaf"])("spaces globals select authenticated target at %s", async position => {
  const flag = ["-d", "two", "--format", "json"];
  const args = position === "root" ? [...flag, "spaces", "get", "space-one"] : position === "group" ? ["spaces", ...flag, "get", "space-one"] : ["spaces", "get", "space-one", ...flag];
  const out = await registered(args); expect(JSON.parse(out.logs.join("\n"))).toEqual(space); expect(clients[0].url).toBe(config.deployments.two.url); expect(clients[0].admin).toHaveBeenCalledWith("fixture-two");
});
it("spaces empty list/search/participants are valid JSON without human headings", async () => {
  methods.memorySpaces.list.mockResolvedValue({ spaces: [], total: 0, offset: 0, hasMore: false }); methods.memorySpaces.search.mockResolvedValue([]); methods.memorySpaces.get.mockResolvedValue({ ...space, participants: [] });
  expect(await json(["spaces", "list"])).toEqual({ spaces: [], total: 0, offset: 0, hasMore: false }); expect(await json(["spaces", "search", "absent"])).toEqual([]); expect(await json(["spaces", "participants", "space-one"])).toEqual([]);
});
it.each(["get", "stats", "participants", "update", "remove-participant"])("spaces %s fails for absent space before mutations", async leaf => {
  methods.memorySpaces.get.mockResolvedValue(null);
  const opts = leaf === "update" ? ["--name", "Next"] : leaf === "remove-participant" ? ["--id", "p-one", "--yes"] : [];
  await expect(json(["spaces", leaf, "missing", ...opts])).rejects.toThrow("not found"); expect(methods.memorySpaces.update).not.toHaveBeenCalled(); expect(methods.memorySpaces.removeParticipant).not.toHaveBeenCalled();
});
it("spaces failed SDK deletion result exits failure; no cascade fails before client", async () => {
  await expect(json(["spaces", "delete", "space-one", "--yes"])).rejects.toThrow("requires --cascade"); expect(clients).toHaveLength(0);
  methods.memorySpaces.delete.mockResolvedValue({ deleted: false }); await expect(json(["spaces", "delete", "space-one", "--cascade", "--yes"])).rejects.toThrow("could not be deleted");
});
it("spaces metadata merge preserves existing keys; status-only update does not overwrite metadata", async () => {
  await json(["spaces", "update", "space-one", "--metadata", '{"new":2}']); expect(methods.memorySpaces.update).toHaveBeenCalledWith("space-one", { name: undefined, status: undefined, metadata: { kept: true, new: 2 } });
  await json(["spaces", "update", "space-one", "--status", "archived"]); expect(methods.memorySpaces.update).toHaveBeenLastCalledWith("space-one", { name: undefined, status: "archived", metadata: undefined });
});
it("spaces participant preserves attribution shape and rejects absent participant removal", async () => {
  expect(await json(["spaces", "participants", "space-one"])).toEqual(space.participants);
  await expect(json(["spaces", "remove-participant", "space-one", "--id", "absent", "--yes"])).rejects.toThrow("Participant absent not found"); expect(methods.memorySpaces.removeParticipant).not.toHaveBeenCalled();
});
it.each(["null", "[]", "true", '"x"', "bad"])("spaces invalid metadata %s fails before SDK creation", async metadata => {
  for (const args of [["create", "space-one", "--type", "team"], ["update", "space-one"]]) await expect(json(["spaces", ...args, "--metadata", metadata])).rejects.toThrow(); expect(clients).toHaveLength(0);
});
it.each([
  ["list", "--type", "wrong"], ["list", "--status", "deleted"], ["count", "--status", "deleted"], ["search", "x", "--type", "wrong"], ["search", " "], ["update", "space-one", "--status", "deleted"], ["add-participant", "space-one", "--id", " ", "--type", "agent"], ["add-participant", "space-one", "--id", "p", "--type", " "], ["remove-participant", "space-one", "--id", " ", "--yes"], ["update", "space-one"], ["update", "space-one", "--name", " "], ["list", "--offset", "1x"], ["list", "--limit", "1001"], ["search", "x", "--limit", "1x"],
])("spaces invalid options %j fail before client", async (...args) => {
  await expect(json(["spaces", ...args as string[]])).rejects.toThrow(); expect(clients).toHaveLength(0);
});
it.each(cases.filter(c => !["list", "count"].includes(c.args[0])))("spaces $args rejects missing positional ID/query", async ({ args }) => {
  await expect(json(["spaces", args[0]])).rejects.toThrow(); expect(clients).toHaveLength(0);
});
it("spaces duplicates fail before register and list/search warn on truncation", async () => {
  await expect(json(["spaces", "create", "space-one", "--type", "team"])).rejects.toThrow("already exists"); expect(methods.memorySpaces.register).not.toHaveBeenCalled();
  methods.memorySpaces.list.mockResolvedValue({ spaces: [space], total: 2, offset: 3, hasMore: true });
  const output = await registered(["spaces", "list", "--offset", "3", "--format", "json"]); expect(JSON.parse(output.logs.join("\n")).hasMore).toBe(true); expect(output.errors.join("\n")).toContain("--offset 4");
  const search = await registered(["spaces", "search", "x", "--limit", "1", "--format", "json"]); expect(search.errors.join("\n")).toContain("truncated");
});
it("actual binary invalid space options exit nonzero before network mutation", async () => {
  if (!binary) throw new Error("Native binary proof requires a separate build/subprocess lease");
  for (const args of [["spaces", "create", "space-one", "--type", "bad"], ["spaces", "delete", "space-one", "--yes"], ["spaces", "add-participant", "space-one", "--id", " ", "--type", "agent"], ["spaces", "update", "space-one", "--metadata", "null"]]) {
    const result = await runActualCLI(binary.entry, [...args, "--format", "json"], home, cwd); expect(result.status).toBe(1); expect(result.stdout).toBe(""); expect(result.stderr).toMatch(/type|cascade|empty|JSON/);
  }
});

it("spaces cancelled delete/archive/participant removal never instantiate clients", async () => {
  for (const args of [["delete", "space-one", "--cascade"], ["archive", "space-one"], ["remove-participant", "space-one", "--id", "p-one"]]) expect(await json(["spaces", ...args])).toEqual({ cancelled: true });
  expect(clients).toHaveLength(0); expect(methods.memorySpaces.delete).not.toHaveBeenCalled(); expect(methods.memorySpaces.archive).not.toHaveBeenCalled();
});
it("spaces unknown explicit target fails before client", async () => {
  await expect(json(["spaces", "get", "space-one", "-d", "absent"])).rejects.toThrow("not found"); expect(clients).toHaveLength(0);
});
it("spaces quiet preserves JSON and suppresses hints", async () => {
  const output = await registered(["spaces", "participants", "space-one", "--quiet", "--format", "json"]);
  expect(JSON.parse(output.logs.join("\n"))).toEqual(space.participants); expect(output.errors).toEqual([]);
});

it("spaces default table keeps full metadata and participant details readable", async () => {
  methods.memorySpaces.get.mockResolvedValue({ ...space, metadata: { nested: { value: "x".repeat(80) } } });
  const output = await registered(["spaces", "get", "space-one"]);
  expect(output.logs.join("\n")).toContain("x".repeat(80)); expect(output.logs.join("\n")).toContain("p-one");
});

it("spaces cascade binds selected authority/exact tenant without an ordinary-scope get", async () => {
  methods.memorySpaces.get.mockResolvedValue(null);
  const result = await json(["spaces", "delete", "space-one", "--cascade", "--yes", "--tenant", " tenant-A ", "-d", "two"]);
  expect(result.erasure).toEqual(erasureReceipt); expect(result.erasure.fullUserDataErased).toBe(false);
  expect(createErasureTransport).toHaveBeenCalledWith({ url: config.deployments.two.url, deploymentKey: "fixture-two" });
  expect(methods.memorySpaces.delete).toHaveBeenCalledWith("space-one", { cascade: true, reason: "Deleted via CLI", confirmId: "space-one", tenantId: " tenant-A ", dryRun: false, verify: true, erasureTransport });
  expect(methods.memorySpaces.get).not.toHaveBeenCalled(); expect(erasureTransport.close).toHaveBeenCalledTimes(1); expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("spaces dry-run and explicit no-verify preserve original incomplete receipt without false success claims", async () => {
  const receipt = { ...erasureReceipt, executed: false, complete: false, outcomes: [], totalDeleted: 0, verification: { state: "notExecuted", complete: false } };
  methods.memorySpaces.delete.mockResolvedValue({ memorySpaceId: "space-one", deleted: false, cascade: { memoriesDeleted: 0 }, erasure: receipt });
  expect((await json(["spaces", "delete", "space-one", "--cascade", "--dry-run"])).erasure).toEqual(receipt);
  expect(methods.memorySpaces.delete).toHaveBeenCalledWith("space-one", expect.objectContaining({ dryRun: true, verify: true }));
  methods.memorySpaces.delete.mockResolvedValue({ memorySpaceId: "space-one", deleted: true, erasure: { ...receipt, executed: true, verification: { state: "notRequested", complete: false } } });
  const result = await json(["spaces", "delete", "space-one", "--cascade", "--yes", "--no-verify"]); expect(result.erasure.complete).toBe(false);
  expect(methods.memorySpaces.delete).toHaveBeenLastCalledWith("space-one", expect.objectContaining({ verify: false }));
});
it("spaces incomplete verified receipt is printed intact before command rejection", async () => {
  const receipt = { ...erasureReceipt, complete: false, remaining: ["physical-remainder"] };
  methods.memorySpaces.delete.mockResolvedValue({ deleted: true, erasure: receipt });
  await expect(registered(["spaces", "delete", "space-one", "--cascade", "--yes", "--format", "json"], logs => {
    expect(JSON.parse(logs.join("\n"))).toEqual({ deleted: true, erasure: receipt });
  })).rejects.toThrow("incomplete"); expect(erasureTransport.close).toHaveBeenCalledTimes(1);
});
it.each([false, true])("spaces stopped partial/unknown receipt is emitted redacted with no resend (unknown=%s)", async unknown => {
  const receipt = { ...erasureReceipt, complete: false, remaining: ["physical-space"], unknown: unknown ? ["physical-space"] : [] };
  methods.memorySpaces.delete.mockRejectedValue(Object.assign(new Error("fixture-two stopped"), { receipt, cause: Object.assign(new Error("fixture-two cause"), { code: unknown ? "ERASURE_OUTCOME_UNKNOWN" : "ERASURE_BLOCKED" }) }));
  await expect(registered(["spaces", "delete", "space-one", "--cascade", "--yes", "-d", "two", "--format", "json", "--quiet"], logs => {
    const output = JSON.parse(logs.join("\n")); expect(output.receipt).toEqual(receipt); expect(output.complete).toBe(false); expect(output.error).toBe("*** stopped"); expect(output.cause.message).toBe("*** cause");
    expect(logs.join("\n")).not.toContain("fixture-two");
  })).rejects.toThrow("stopped"); expect(methods.memorySpaces.delete).toHaveBeenCalledTimes(1); expect(erasureTransport.close).toHaveBeenCalledTimes(1); expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("spaces authority/tenant refusal and cancelled confirmation create neither client nor erasure transport", async () => {
  await expect(json(["spaces", "delete", "space-one", "--cascade", "--yes", "--tenant", " "])).rejects.toThrow("nonempty");
  expect(await json(["spaces", "delete", "space-one", "--cascade"])).toEqual({ cancelled: true });
  writeFileSync(join(home, ".cortexrc"), JSON.stringify({ ...config, deployments: { one: { url: config.deployments.one.url } } }));
  await expect(json(["spaces", "delete", "space-one", "--cascade", "--yes"])).rejects.toThrow("administrator key");
  expect(clients).toHaveLength(0); expect(createErasureTransport).not.toHaveBeenCalled(); expect(methods.memorySpaces.delete).not.toHaveBeenCalled();
});
it.each(["directory", "symlink"])("spaces selected project %s graph marker refuses before primary effects", async kind => {
  const project = join(root, "selected-project"); mkdirSync(join(project, ".cortex"), { recursive: true }); const marker = join(project, ".cortex", "graph");
  if (kind === "directory") mkdirSync(marker); else symlinkSync(join(root, "missing-target"), marker);
  writeFileSync(join(home, ".cortexrc"), JSON.stringify({ ...config, deployments: { ...config.deployments, two: { ...config.deployments.two, projectPath: project } } }));
  await expect(json(["spaces", "delete", "space-one", "--cascade", "--yes", "-d", "two"])).rejects.toThrow(/GRAPH_|graph/);
  expect(clients).toHaveLength(0); expect(createErasureTransport).not.toHaveBeenCalled(); expect(methods.memorySpaces.delete).not.toHaveBeenCalled();
});
it("spaces absent selected marker works but non-ENOENT metadata failure refuses before effects", async () => {
  const project = join(root, "selected-empty"); mkdirSync(project); mkdirSync(join(cwd, ".cortex", "graph"), { recursive: true });
  writeFileSync(join(home, ".cortexrc"), JSON.stringify({ ...config, deployments: { ...config.deployments, two: { ...config.deployments.two, projectPath: project } } }));
  await json(["spaces", "delete", "space-one", "--cascade", "--yes", "-d", "two"]);
  expect(lstatMarker).toHaveBeenCalledWith(join(project, ".cortex", "graph")); expect(lstatMarker).not.toHaveBeenCalledWith(join(cwd, ".cortex", "graph"));
  methods.memorySpaces.delete.mockClear(); createErasureTransport.mockClear(); clients.length = 0;
  lstatMarker.mockRejectedValueOnce(Object.assign(new Error("marker denied"), { code: "EPERM" }));
  await expect(json(["spaces", "delete", "space-one", "--cascade", "--yes", "-d", "two"])).rejects.toThrow("marker denied");
  expect(clients).toHaveLength(0); expect(createErasureTransport).not.toHaveBeenCalled(); expect(methods.memorySpaces.delete).not.toHaveBeenCalled();
});
