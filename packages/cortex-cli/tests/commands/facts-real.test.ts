/** Executes the production createProgram registry; SDK transport is mocked, never live. */
import {
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "@jest/globals";
import {
  constants,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  statSync,
  readdirSync,
  realpathSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";
import type { CLIConfig } from "../../src/types.js";
import { stageActualCLI, runActualCLI } from "../helpers/cli-test-utils.js";
let accepted = false;
jest.unstable_mockModule("prompts", () => ({
  default: jest.fn(async () => ({ confirmed: accepted })),
}));
const realFs = await import("fs/promises");
let failStage: "open" | "write" | "sync" | "close" | "rename" | undefined;
let closedFailed = false;
const ioEvents: string[] = [];
const openMock = jest.fn(async (...args: Parameters<typeof realFs.open>) => {
  ioEvents.push("open");
  if (failStage === "open") throw new Error("staging open failed");
  const handle = await realFs.open(...args);
  return {
    writeFile: async (...values: Parameters<typeof handle.writeFile>) => {
      ioEvents.push("write");
      if (failStage === "write") throw new Error("staging write failed");
      return handle.writeFile(...values);
    },
    sync: async () => {
      ioEvents.push("sync");
      if (failStage === "sync") throw new Error("staging sync failed");
      return handle.sync();
    },
    close: async () => {
      ioEvents.push("close");
      if (failStage === "close" && !closedFailed) {
        closedFailed = true;
        throw new Error("staging close failed");
      }
      return handle.close();
    },
  };
});
const renameMock = jest.fn(
  async (...args: Parameters<typeof realFs.rename>) => {
    ioEvents.push("rename");
    if (failStage === "rename") throw new Error("staging rename failed");
    return realFs.rename(...args);
  },
);
jest.unstable_mockModule("fs/promises", () => ({
  ...realFs,
  open: (...args: Parameters<typeof realFs.open>) => {
    // Keep admission reads real and export staging observations distinct.
    if (typeof args[1] === "number" && (args[1] & (constants.O_WRONLY | constants.O_RDWR)) === 0)
      return realFs.open(...args);
    return openMock(...args);
  },
  rename: renameMock,
}));

const realOs = await import("os");
if (
  !process.env.CORTEX_TEST_HOME_ROOT ||
  realOs.homedir() !== process.env.CORTEX_TEST_HOME_ROOT
)
  throw new Error("Externally isolated native HOME required before imports");
jest.unstable_mockModule("os", () => ({
  ...realOs,
  homedir: () => process.env.HOME!,
}));
const memory = {
  memoryId: "mem-one",
  memorySpaceId: "space-one",
  content: "full content " + "x".repeat(90),
  contentType: "text",
  sourceType: "tool",
  userId: "user-one",
  tags: [],
  version: 1,
  accessCount: 0,
  importance: 70,
  createdAt: 1,
  updatedAt: 2,
};
const fact = {
  factId: "fact-one",
  memorySpaceId: "space-one",
  fact: 'A comma, quote" and\nnewline',
  factType: "knowledge",
  userId: "user-one",
  subject: "value,with,commas",
  predicate: 'a"quote',
  object: "line\nbreak",
  confidence: 90,
  tags: ["tag,one"],
  createdAt: 1,
  updatedAt: 2,
  version: 1,
  sourceType: "manual",
};
const messages = [
  { id: "msg-late", role: "agent", content: "Second", timestamp: 2 },
  { id: "msg-first", role: "user", content: "First", timestamp: 1 },
];
const conversation = {
  conversationId: "conv-one",
  memorySpaceId: "space-one",
  type: "user-agent",
  participants: { userId: "user-one", agentId: "agent-one" },
  messageCount: 2,
  messages,
  createdAt: 1,
  updatedAt: 2,
};
const methods = {
  memory: Object.fromEntries(
    [
      "list",
      "search",
      "get",
      "count",
      "delete",
      "deleteMany",
      "export",
      "archive",
      "restoreFromArchive",
    ].map((name) => [
      name,
      jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    ]),
  ),
  facts: Object.fromEntries(
    ["list", "search", "get", "count", "delete", "deleteMany", "export"].map(
      (name) => [name, jest.fn<(...args: unknown[]) => Promise<unknown>>()],
    ),
  ),
  conversations: Object.fromEntries(
    ["list", "get", "getHistory", "count", "delete", "deleteMany"].map(
      (name) => [name, jest.fn<(...args: unknown[]) => Promise<unknown>>()],
    ),
  ),
};
const clients: Array<{
  url: string;
  close: ReturnType<typeof jest.fn>;
  admin: ReturnType<typeof jest.fn>;
}> = [];
jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: jest.fn(() => ({
  setAdminAuth: clients.at(-1)!.admin, query: jest.fn(), mutation: jest.fn(), action: jest.fn(),
})) }));
jest.unstable_mockModule("@cortexmemory/sdk", () => ({ createAuthContext: (value: unknown) => value,
  Cortex: jest.fn((options: { convexUrl: string }, runtime?: {initializeTransport?: (transport: unknown) => undefined}) => {
    const close = jest.fn(),
      admin = jest.fn();
    clients.push({ url: options.convexUrl, close, admin });
    const transport = {close, query: jest.fn(), mutation: jest.fn(), action: jest.fn(), setAdminAuth: admin};
    runtime?.initializeTransport?.(transport);
    return { ...methods, memorySpaces: { list: jest.fn(async () => ({ spaces: [] })) }, shutdown: async () => { await transport.close(); }, close: () => transport.close(), getClient: () => transport };
  }),
}));
const { createProgram } = await import("../../src/program.js");
const { loadConfig } = await import("../../src/utils/config.js");
const { closeClient } = await import("../../src/utils/client.js");
const config: CLIConfig = {
  deployments: {
    one: { url: "http://127.0.0.1:1", key: "synthetic-one" },
    two: { url: "http://127.0.0.1:2", key: "synthetic-two" },
  },
  default: "one",
  format: "table",
  confirmDangerous: true,
};
let root: string,
  home: string,
  cwd: string,
  oldCwd: string,
  oldHome: string | undefined;
let binary: Awaited<ReturnType<typeof stageActualCLI>>;
beforeAll(async () => {
  binary = await stageActualCLI();
  console.info(`task05 private compiled entry: ${binary.entry}`);
}, 30000);
afterAll(async () => {
  await binary.cleanup();
});
beforeEach(() => {
  oldCwd = process.cwd();
  oldHome = process.env.HOME;
  root = realpathSync(mkdtempSync(join(tmpdir(), "cortex-task05-real-")));
  home = join(root, "home");
  cwd = join(root, "project");
  mkdirSync(home);
  mkdirSync(cwd);
  process.env.HOME = home;
  process.chdir(cwd);
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config));
  clients.length = 0;
  failStage = undefined;
  closedFailed = false;
  ioEvents.length = 0;
  accepted = false;
  jest.clearAllMocks();
  for (const group of Object.values(methods))
    for (const method of Object.values(group)) method.mockReset();
  methods.memory.list.mockResolvedValue([memory]);
  methods.memory.search.mockResolvedValue([memory]);
  methods.memory.get.mockResolvedValue(memory);
  methods.memory.count.mockResolvedValue(1201);
  methods.memory.delete.mockResolvedValue({ deleted: true, factsDeleted: 2 });
  methods.memory.archive.mockResolvedValue({
    archived: true,
    factsArchived: 2,
  });
  methods.memory.restoreFromArchive.mockResolvedValue({
    restored: true,
    memory,
  });
  methods.memory.deleteMany.mockResolvedValue({
    deleted: 1201,
    memoryIds: ["mem-one"],
    factsDeleted: 2,
    factIds: ["fact-one"],
  });
  methods.memory.export.mockResolvedValue({
    format: "json",
    data: JSON.stringify([memory]),
    count: 1,
    exportedAt: 1,
  });
  methods.facts.list.mockResolvedValue([fact]);
  methods.facts.search.mockResolvedValue([fact]);
  methods.facts.get.mockResolvedValue(fact);
  methods.facts.count.mockResolvedValue(1201);
  methods.facts.delete.mockResolvedValue({ deleted: true, factId: "fact-one" });
  methods.facts.deleteMany.mockResolvedValue({
    deleted: 1201,
    memorySpaceId: "space-one",
  });
  methods.facts.export.mockResolvedValue({
    format: "json",
    data: JSON.stringify([fact]),
    count: 1,
    exportedAt: 1,
  });
  methods.conversations.list.mockResolvedValue({
    conversations: [conversation],
    total: 1201,
    limit: 50,
    offset: 0,
    hasMore: true,
  });
  methods.conversations.get.mockResolvedValue(conversation);
  methods.conversations.getHistory.mockResolvedValue({
    messages: [...messages].reverse(),
    total: 2,
    hasMore: false,
    conversationId: "conv-one",
  });
  methods.conversations.count.mockResolvedValue(1201);
  methods.conversations.delete.mockResolvedValue({
    deleted: true,
    messagesDeleted: 2,
    conversationId: "conv-one",
    deletedAt: 3,
    restorable: false,
  });
  methods.conversations.deleteMany.mockResolvedValue({
    deleted: 1201,
    conversationIds: ["conv-one"],
    totalMessagesDeleted: 2402,
  });
});
afterEach(async () => {
  await closeClient();
  process.chdir(oldCwd);
  if (oldHome === undefined) delete process.env.HOME;
  else process.env.HOME = oldHome;
  rmSync(root, { recursive: true, force: true });
});
async function registered(args: string[]) {
  const logs: string[] = [],
    errors: string[] = [];
  const log = jest
    .spyOn(console, "log")
    .mockImplementation((...values: unknown[]) => {
      logs.push(values.map(String).join(" "));
    });
  const error = jest
    .spyOn(console, "error")
    .mockImplementation((...values: unknown[]) => {
      errors.push(values.map(String).join(" "));
    });
  try {
    const program = createProgram(await loadConfig());
    const override = (command: typeof program): void => {
      command.exitOverride().configureOutput({
        writeErr: (text) => {
          errors.push(text);
        },
      });
      command.commands.forEach(override);
    };
    override(program);
    await program.parseAsync(args, { from: "user" });
    return { logs, errors };
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
}
async function json(args: string[]) {
  const result = await registered([...args, "--format", "json"]);
  return JSON.parse(result.logs.join("\n"));
}
const cases = [
  {
    args: [
      "list",
      "-s",
      "space-one",
      "-u",
      "user-one",
      "-t",
      "knowledge",
      "-l",
      "2",
    ],
    method: "list",
    call: [
      {
        memorySpaceId: "space-one",
        userId: "user-one",
        factType: "knowledge",
        limit: 2,
      },
    ],
    expected: [fact],
  },
  {
    args: ["search", "comma", "-s", "space-one", "-t", "knowledge", "-l", "3"],
    method: "search",
    call: ["space-one", "comma", { factType: "knowledge", limit: 3 }],
    expected: [fact],
  },
  {
    args: ["get", "fact-one", "-s", "space-one"],
    method: "get",
    call: ["space-one", "fact-one"],
    expected: fact,
  },
  {
    args: ["delete", "fact-one", "-s", "space-one", "--yes"],
    method: "delete",
    call: ["space-one", "fact-one"],
    expected: { deleted: true, factId: "fact-one" },
  },
  {
    args: [
      "export",
      "-s",
      "space-one",
      "-t",
      "knowledge",
      "-o",
      "facts-export.json",
    ],
    method: "export",
    call: [
      { memorySpaceId: "space-one", factType: "knowledge", format: "json" },
    ],
    expected: { output: "facts-export.json", count: 1, format: "json" },
  },
  {
    args: ["count", "-s", "space-one", "-t", "knowledge"],
    method: "count",
    call: [{ memorySpaceId: "space-one", factType: "knowledge" }],
    expected: { count: 1201 },
  },
  {
    args: ["clear", "-s", "space-one", "-t", "knowledge", "--yes"],
    method: "deleteMany",
    call: [{ memorySpaceId: "space-one", factType: "knowledge", includeSuperseded: true }],
    expected: { deleted: 1201, remaining: 0 },
  },
];
const scopeArgs = ["-s", "space-one"],
  getArgs = ["get", "fact-one", ...scopeArgs],
  recordId = "fact-one";
const binaryArgs = ["count", ...scopeArgs],
  binaryValue = 1201,
  binaryExpected = { memorySpaceId: "space-one", count: 1201 };

const optionInventory: Record<string, string[]> = {
  list: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-t, --type <type>",
    "-u, --user <id>",
    "-l, --limit <number>",
    "-f, --format <format>",
    "--quiet",
    "--debug",
  ],
  search: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-t, --type <type>",
    "-l, --limit <number>",
    "-f, --format <format>",
    "--quiet",
    "--debug",
  ],
  get: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-f, --format <format>",
    "--quiet",
    "--debug",
  ],
  delete: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-y, --yes",
    "--quiet",
    "--debug",
    "-f, --format <format>",
  ],
  export: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-t, --type <type>",
    "-o, --output <file>",
    "-f, --format <format>",
    "--quiet",
    "--debug",
  ],
  count: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-t, --type <type>",
    "--quiet",
    "--debug",
    "-f, --format <format>",
  ],
  clear: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-t, --type <type>",
    "-y, --yes",
    "--quiet",
    "--debug",
    "-f, --format <format>",
  ],
};

it.each(cases)(
  "production facts $args emits the SDK outcome and exact arguments",
  async ({ args, method, call, expected }) => {
    if (args[0] === "clear")
      methods.facts.count.mockResolvedValueOnce(1201).mockResolvedValueOnce(0);
    const result = await json(["facts", ...args]);
    expect(result).toMatchObject(expected);
    expect(methods.facts[method]).toHaveBeenCalledWith(...call);
    expect(clients[0].url).toBe(config.deployments.one.url);
    expect(clients[0].admin).toHaveBeenCalledWith("synthetic-one");
    expect(clients[0].close).toHaveBeenCalledTimes(1);
  },
);
it.each(cases)(
  "production facts $args propagates the SDK failure and closes",
  async ({ args, method }) => {
    methods.facts[method].mockRejectedValue(new Error("fixture denied"));
    await expect(json(["facts", ...args])).rejects.toThrow("fixture denied");
    expect(clients[0].close).toHaveBeenCalledTimes(1);
    if (args[0] === "export")
      expect(existsSync("facts-export.json")).toBe(false);
  },
);
it("production facts registry preserves each retained leaf and tested option", () => {
  const group = createProgram(config).commands.find(
    (c) => c.name() === "facts",
  )!;
  expect(group.commands.map((c) => c.name()).sort()).toEqual(
    cases.map((c) => c.args[0]).sort(),
  );
  for (const leaf of group.commands) {
    for (const global of ["deployment", "format", "quiet", "debug"])
      expect(leaf.options.map((o) => o.attributeName())).toContain(global);
    expect(leaf.options.map((o) => o.flags).sort()).toEqual(
      [...optionInventory[leaf.name()], "--scope-user <id>", "--tenant <id>", "--graph-sync <mode>"].sort(),
    );
  }
});
it.each(["root", "group", "leaf"])(
  "facts effective globals select the target at %s",
  async (placement) => {
    const flags = ["-d", "two", "--format", "json", "--quiet"];
    const args =
      placement === "root"
        ? [...flags, "facts", ...getArgs]
        : placement === "group"
          ? ["facts", ...flags, ...getArgs]
          : ["facts", ...getArgs, ...flags];
    const out = await registered(args);
    expect(JSON.parse(out.logs.join("\n"))).toBeTruthy();
    expect(out.errors).toEqual([]);
    expect(clients[0].url).toBe(config.deployments.two.url);
  },
);
it("facts nearest explicit global value wins", async () => {
  const out = await registered([
    "-d",
    "two",
    "--format",
    "csv",
    "facts",
    ...getArgs,
    "-d",
    "one",
    "--format",
    "json",
  ]);
  expect(JSON.parse(out.logs.join("\n"))).toBeTruthy();
  expect(clients[0].url).toBe(config.deployments.one.url);
});
it.each(["1x", "1.2", "1e2", "0", "-1", "1001", "9007199254740993"])(
  "facts rejects partial or unsafe limit %s before client",
  async (value) => {
    await expect(
      json(["facts", "list", ...scopeArgs, "--limit", value]),
    ).rejects.toThrow();
    expect(clients).toHaveLength(0);
  },
);
it("facts invalid format and unknown deployment never instantiate a client", async () => {
  await expect(
    registered(["facts", ...getArgs, "--format", "yaml"]),
  ).rejects.toThrow();
  await expect(json(["facts", ...getArgs, "-d", "absent"])).rejects.toThrow(
    "not found",
  );
  expect(clients).toHaveLength(0);
});
it("facts missing selected deployment fails nonzero instead of succeeding", async () => {
  writeFileSync(
    join(home, ".cortexrc"),
    JSON.stringify({ deployments: {}, format: "json" }),
  );
  await expect(json(["facts", ...getArgs])).rejects.toThrow();
  expect(clients).toHaveLength(0);
});

it.each(["mixed", "superseded-only"])(
  "facts clear removes complete %s history and preserves foreign scopes",
  async (history) => {
    type Selector = { memorySpaceId: string; factType?: string; includeSuperseded?: boolean };
    const selected = [
      ...(history === "mixed" ? [{ id: "current", memorySpaceId: "space-one", factType: "knowledge", superseded: false }] : []),
      { id: "previous", memorySpaceId: "space-one", factType: "knowledge", superseded: true },
    ];
    const foreign = [
      { id: "other-space", memorySpaceId: "space-two", factType: "knowledge", superseded: true },
      { id: "other-type", memorySpaceId: "space-one", factType: "preference", superseded: false },
    ];
    let rows = [...selected, ...foreign];
    const matches = (row: (typeof rows)[number], selector: Selector, destructive: boolean) =>
      row.memorySpaceId === selector.memorySpaceId &&
      (selector.factType === undefined || row.factType === selector.factType) &&
      ((selector.includeSuperseded ?? destructive) || !row.superseded);
    methods.facts.count.mockImplementation(async (input) =>
      rows.filter((row) => matches(row, input as Selector, false)).length,
    );
    methods.facts.deleteMany.mockImplementation(async (input) => {
      const selector = input as Selector;
      const removed = rows.filter((row) => matches(row, selector, true));
      rows = rows.filter((row) => !matches(row, selector, true));
      return { deleted: removed.length, memorySpaceId: selector.memorySpaceId };
    });
    expect(await json(["facts", "count", ...scopeArgs, "--type", "knowledge"])).toEqual({ memorySpaceId: "space-one", count: history === "mixed" ? 1 : 0 });
    expect(await json(["facts", "clear", ...scopeArgs, "--type", "knowledge", "--yes"])).toEqual({ memorySpaceId: "space-one", deleted: selected.length, remaining: 0 });
    const selector = { memorySpaceId: "space-one", factType: "knowledge", includeSuperseded: true };
    expect(methods.facts.count.mock.calls).toEqual([
      [{ memorySpaceId: "space-one", factType: "knowledge" }],
      [selector],
      [selector],
    ]);
    expect(methods.facts.deleteMany.mock.calls).toEqual([[selector]]);
    expect(rows).toEqual(foreign);
    expect(clients.every((client) => client.close.mock.calls.length === 1)).toBe(true);
  },
);

it("facts clear uses complete SDK bulk result and refuses partial completion", async () => {
  methods.facts.count.mockResolvedValueOnce(1201).mockResolvedValueOnce(1);
  await expect(json(["facts", "clear", ...scopeArgs, "--yes"])).rejects.toThrow(
    "Clear incomplete",
  );
  expect(methods.facts.deleteMany).toHaveBeenCalledTimes(1);
  expect(methods.facts.list).not.toHaveBeenCalled();
  expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("facts clear count failure never mutates", async () => {
  methods.facts.count.mockRejectedValue(new Error("count denied"));
  await expect(json(["facts", "clear", ...scopeArgs, "--yes"])).rejects.toThrow(
    "count denied",
  );
  expect(methods.facts.deleteMany).not.toHaveBeenCalled();
  expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("facts empty clear and cancelled clear never mutate and close transport", async () => {
  methods.facts.count.mockResolvedValueOnce(0);
  expect(await json(["facts", "clear", ...scopeArgs])).toEqual({ deleted: 0 });
  expect(await json(["facts", "clear", ...scopeArgs])).toEqual({
    cancelled: true,
  });
  expect(methods.facts.deleteMany).not.toHaveBeenCalled();
  expect(clients.every((c) => c.close.mock.calls.length === 1)).toBe(true);
});
it("facts delete confirmation cancels before client creation", async () => {
  expect(await json(["facts", "delete", recordId, ...scopeArgs])).toEqual({
    cancelled: true,
  });
  expect(clients).toHaveLength(0);
  expect(methods.facts.delete).not.toHaveBeenCalled();
});
it("facts absent get and false delete are honest failures", async () => {
  methods.facts.get.mockResolvedValue(null);
  await expect(json(["facts", ...getArgs])).rejects.toThrow("not found");
  methods.facts.delete.mockResolvedValue({ deleted: false });
  await expect(
    json(["facts", "delete", recordId, ...scopeArgs, "--yes"]),
  ).rejects.toThrow("not found");
  expect(clients.every((c) => c.close.mock.calls.length === 1)).toBe(true);
});
it("actual facts binary rejects malformed input before network and emits no stdout", async () => {
  for (const args of [
    ["facts", "list", ...scopeArgs, "--limit", "1x"],
    ["facts", "get"],
    ["facts", ...getArgs, "--format", "yaml"],
  ]) {
    const out = await runActualCLI(binary.entry, args, home, cwd);
    expect(out.status).toBe(1);
    expect(out.stdout).toBe("");
    expect(out.stderr).toMatch(/integer|argument|format|required/);
  }
});
it("actual compiled facts binary emits parseable success JSON and nonzero SDK failure", () => {
  // A private ESM loader replaces only SDK transport. This is actual index/registry proof, not a live API claim.
  const loader = join(root, "loader.mjs"),
    sdk = join(root, "sdk.mjs");
  writeFileSync(
    loader,
    `export async function resolve(s, c, next) { if(s === "@cortexmemory/sdk") return { url: new URL("./sdk.mjs", import.meta.url).href, shortCircuit: true }; return next(s,c); }`,
  );
  const response = JSON.stringify(binaryValue);
  writeFileSync(
    sdk,
    String.raw`import { appendFileSync } from "fs"; const trace = ${JSON.stringify(join(root, "calls.jsonl"))}; export const createAuthContext = value => value; export class Cortex { constructor(o,r) { r?.initializeTransport?.({close:()=>Promise.resolve(),query(){},mutation(){},action(){}}); this.memorySpaces = {list: async () => ({spaces: []})}; appendFileSync(trace, JSON.stringify({url:o.convexUrl}) + "\n"); for(const group of ["memory","facts","conversations"]) this[group] = new Proxy({}, {get:(_,method)=> async (...args)=> { appendFileSync(trace, JSON.stringify({group,method,args}) + "\n"); if(process.env.TEST_FAIL === "1") throw new Error("fixture SDK failure"); return ${response}; }}); } getClient() { return {setAdminAuth() {}}; } async shutdown() { this.close(); } close() { appendFileSync(trace, "closed\n"); } }`,
  );
  const run = (fail: boolean) =>
    spawnSync(
      process.execPath,
      [
        "--no-warnings",
        "--experimental-loader",
        loader,
        binary.entry,
        "facts",
        ...binaryArgs,
        "--quiet",
        "--format",
        "json",
      ],
      {
        cwd,
        encoding: "utf8",
        timeout: 10000,
        env: {
          HOME: home,
          PATH: process.env.PATH ?? "",
          NO_COLOR: "1",
          DOTENV_CONFIG_QUIET: "true",
          TEST_FAIL: fail ? "1" : "0",
        },
      },
    );
  const good = run(false);
  if (good.error) throw good.error;
  expect(good.status).toBe(0);
  expect(JSON.parse(good.stdout)).toEqual(binaryExpected);
  expect(good.stderr).toBe("");
  const bad = run(true);
  if (bad.error) throw bad.error;
  expect(bad.status).toBe(1);
  expect(bad.stdout).toBe("");
  expect(bad.stderr).toContain("fixture SDK failure");
  expect(
    readFileSync(join(root, "calls.jsonl"), "utf-8").match(/closed/g),
  ).toHaveLength(2);
});
it("facts exports 1201 full records via export and count uses true count only", async () => {
  const entries = Array.from({ length: 1201 }, (_, n) => ({
    ...fact,
    factId: `fact-${n}`,
  }));
  methods.facts.export.mockResolvedValue({
    format: "json",
    data: JSON.stringify(entries),
    count: 1201,
  });
  expect(await json(["facts", "export", ...scopeArgs])).toEqual({
    output: "facts-export.json",
    count: 1201,
    format: "json",
  });
  expect(JSON.parse(readFileSync("facts-export.json", "utf-8"))).toEqual(
    entries,
  );
  expect(await json(["facts", "count", ...scopeArgs])).toEqual({
    memorySpaceId: "space-one",
    count: 1201,
  });
  expect(methods.facts.list).not.toHaveBeenCalled();
});
it("facts CSV is the SDK bytes with format-aware filename and explicit path retained", async () => {
  const csv =
    'factId,fact,subject,predicate,object,tags\nfact-one,"comma,quote"" and\nline","sub,ject","a""quote","line\nbreak","tag,one"';
  methods.facts.export.mockResolvedValue({
    format: "csv",
    data: csv,
    count: 1,
  });
  const out = await registered([
    "facts",
    "export",
    ...scopeArgs,
    "--format",
    "csv",
  ]);
  expect(JSON.parse(out.logs.join("\n"))).toEqual({
    output: "facts-export.csv",
    count: 1,
    format: "csv",
  });
  expect(readFileSync("facts-export.csv", "utf-8")).toBe(csv);
  await registered([
    "facts",
    "export",
    ...scopeArgs,
    "--format",
    "csv",
    "--output",
    "exact-name.data",
  ]);
  expect(readFileSync("exact-name.data", "utf-8")).toBe(csv);
});
it("facts export refuses format mismatch and failed file writes", async () => {
  methods.facts.export.mockResolvedValue({
    format: "csv",
    data: "a,b",
    count: 1,
  });
  await expect(json(["facts", "export", ...scopeArgs])).rejects.toThrow(
    "SDK returned",
  );
  expect(existsSync("facts-export.json")).toBe(false);
  methods.facts.export.mockResolvedValue({
    format: "json",
    data: "[]",
    count: 0,
  });
  await expect(
    json(["facts", "export", ...scopeArgs, "--output", "missing/file.json"]),
  ).rejects.toThrow();
});
it("facts validates retained type/user and empty search query before client", async () => {
  for (const leaf of ["list", "search", "count", "export", "clear"])
    await expect(
      json([
        "facts",
        leaf,
        ...(leaf === "search" ? ["query"] : []),
        ...scopeArgs,
        "--type",
        "unknown",
      ]),
    ).rejects.toThrow();
  await expect(
    json(["facts", "list", ...scopeArgs, "--user", " "]),
  ).rejects.toThrow();
  await expect(json(["facts", "search", " ", ...scopeArgs])).rejects.toThrow();
  expect(clients).toHaveLength(0);
});
it("facts JSON retains empty results and original comma/quote/newline values", async () => {
  methods.facts.list.mockResolvedValue([]);
  expect(await json(["facts", "list", ...scopeArgs])).toEqual([]);
  expect(await json(["facts", ...getArgs])).toEqual(fact);
  methods.facts.list.mockResolvedValue([fact]);
  const csv = await registered([
    "facts",
    "list",
    ...scopeArgs,
    "--format",
    "csv",
  ]);
  expect(csv.logs.join("\n")).toContain("fact");
});

it("facts partial clear emits a structured receipt before nonzero failure", async () => {
  methods.facts.count.mockResolvedValueOnce(1201).mockResolvedValueOnce(1);
  methods.facts.deleteMany.mockResolvedValue({ deleted: 1200 });
  const logs: string[] = [];
  const spy = jest
    .spyOn(console, "log")
    .mockImplementation((...values: unknown[]) => {
      logs.push(values.map(String).join(" "));
    });
  try {
    await expect(
      createProgram(await loadConfig()).parseAsync(
        ["facts", "clear", ...scopeArgs, "--yes", "--format", "json"],
        { from: "user" },
      ),
    ).rejects.toThrow("Clear incomplete");
  } finally {
    spy.mockRestore();
  }
  expect(JSON.parse(logs.join("\n"))).toEqual({ deleted: 1200, remaining: 1 });
  expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("facts empty record ID and unsafe export path fail before SDK", async () => {
  await expect(json(["facts", "get", " ", ...scopeArgs])).rejects.toThrow();
  await expect(
    json(["facts", "export", ...[], ...scopeArgs, "--output", " "]),
  ).rejects.toThrow();
  expect(clients).toHaveLength(0);
});

it.each(cases)(
  "actual compiled facts $args preserves JSON outcomes and failure exits",
  ({ args, expected }) => {
    const loader = join(root, "all-loader.mjs"),
      sdk = join(root, "all-sdk.mjs");
    writeFileSync(
      loader,
      `export async function resolve(s,c,next) { if(s === "@cortexmemory/sdk") return {url: new URL("./all-sdk.mjs", import.meta.url).href,shortCircuit:true}; return next(s,c); }`,
    );
    const results = {
      memory: {
        list: [memory],
        search: [memory],
        get: memory,
        delete: { deleted: true, factsDeleted: 2 },
        deleteMany: {
          deleted: 1201,
          memoryIds: [recordId],
          factsDeleted: 2,
          factIds: ["fact-one"],
        },
        archive: { archived: true, factsArchived: 2 },
        restoreFromArchive: { restored: true, memory },
        export: { format: "json", data: JSON.stringify([memory]), count: 1 },
      },
      facts: {
        list: [fact],
        search: [fact],
        get: fact,
        delete: { deleted: true, factId: "fact-one" },
        deleteMany: { deleted: 1201, memorySpaceId: "space-one" },
        export: { format: "json", data: JSON.stringify([fact]), count: 1 },
      },
      conversations: {
        list: {
          conversations: [conversation],
          total: 1201,
          limit: 50,
          offset: 0,
          hasMore: true,
        },
        get: conversation,
        getHistory: {
          messages: [...messages].reverse(),
          total: 2,
          hasMore: false,
          conversationId: recordId,
        },
        delete: { deleted: true, messagesDeleted: 2 },
        deleteMany: {
          deleted: 1201,
          conversationIds: [recordId],
          totalMessagesDeleted: 2402,
        },
      },
    };
    writeFileSync(
      sdk,
      String.raw`import {appendFileSync} from "fs"; const results = ${JSON.stringify(results)}; const trace = ${JSON.stringify(join(root, "all-trace.jsonl"))}; export const createAuthContext = value => value; export class Cortex { constructor(o,r) { r?.initializeTransport?.({close:()=>Promise.resolve(),query(){},mutation(){},action(){}}); this.memorySpaces = {list: async () => ({spaces: []})}; let counted = false; for(const group of ["memory","facts","conversations"]) this[group] = new Proxy({}, { get:(_,method)=> async (...args)=> { appendFileSync(trace, JSON.stringify({group,method,args}) + "\n"); if(process.env.TEST_FAIL === "1") throw new Error("fixture SDK failure"); if(method === "count") { if(process.argv.includes("clear") && counted) return process.env.TEST_PARTIAL === "1" ? 1 : 0; counted = true; return 1201; } if(method === "deleteMany" && process.env.TEST_PARTIAL === "1") return {deleted:1200}; return results[group][method]; }}); } getClient() { return {setAdminAuth(){}}; } async shutdown() {this.close();} close() {appendFileSync(trace,"closed\n");} }`,
    );
    const run = (fail: boolean, partial = false) =>
      spawnSync(
        process.execPath,
        [
          "--no-warnings",
          "--experimental-loader",
          loader,
          binary.entry,
          "facts",
          ...args,
          "--format",
          "json",
          "--quiet",
        ],
        {
          cwd,
          encoding: "utf8",
          timeout: 10000,
          env: {
            HOME: home,
            PATH: process.env.PATH ?? "",
            NO_COLOR: "1",
            DOTENV_CONFIG_QUIET: "true",
            TEST_FAIL: fail ? "1" : "0",
            TEST_PARTIAL: partial ? "1" : "0",
          },
        },
      );
    const good = run(false);
    if (good.error) throw good.error;
    expect(good.stderr).toBe("");
    expect(good.status).toBe(0);
    expect(JSON.parse(good.stdout)).toMatchObject(expected);
    const bad = run(true);
    if (bad.error) throw bad.error;
    expect(bad.status).toBe(1);
    expect(bad.stdout).toBe("");
    expect(bad.stderr).toContain("fixture SDK failure");
    if (args[0] === "clear") {
      const partial = run(false, true);
      if (partial.error) throw partial.error;
      expect(partial.status).toBe(1);
      expect(JSON.parse(partial.stdout)).toEqual({
        deleted: 1200,
        remaining: 1,
      });
      expect(partial.stderr).toContain("Clear incomplete");
    }
    expect(
      readFileSync(join(root, "all-trace.jsonl"), "utf-8").match(/closed/g),
    ).toHaveLength(args[0] === "clear" ? 3 : 2);
  },
);

it.each(cases.filter((c) => c.args[0] !== "export"))(
  "production facts $args retains useful table output",
  async ({ args }) => {
    if (args[0] === "clear")
      methods.facts.count.mockResolvedValueOnce(1201).mockResolvedValueOnce(0);
    const out = await registered([
      "facts",
      ...args,
      "--format",
      "table",
      "--quiet",
    ]);
    expect(out.logs.join("\n").length).toBeGreaterThan(0);
    expect(out.errors).toEqual([]);
    expect(clients[0].close).toHaveBeenCalledTimes(1);
  },
);

it("facts export atomically replaces the destination with a private complete file", async () => {
  const destination = "protected-export.json";
  writeFileSync(destination, "old complete export", { mode: 0o644 });
  await json(["facts", "export", ...[], ...scopeArgs, "--output", destination]);
  expect(JSON.parse(readFileSync(destination, "utf-8"))).toEqual([fact]);
  expect(statSync(destination).mode & 0o777).toBe(0o600);
  expect(ioEvents).toEqual(["open", "write", "sync", "close", "rename"]);
  expect(openMock.mock.calls[0][1]).toBe("wx");
  expect(openMock.mock.calls[0][2]).toBe(0o600);
  expect(
    readdirSync(cwd).filter((file) => file.includes(".cortex-export-")),
  ).toEqual([]);
});
it.each(["open", "write", "sync", "close", "rename"] as const)(
  "facts %s failure preserves destination and removes staging files",
  async (failure) => {
    const destination = "protected-export.json";
    writeFileSync(destination, "old complete export", { mode: 0o644 });
    failStage = failure;
    await expect(
      json(["facts", "export", ...[], ...scopeArgs, "--output", destination]),
    ).rejects.toThrow(`staging ${failure} failed`);
    expect(readFileSync(destination, "utf-8")).toBe("old complete export");
    expect(statSync(destination).mode & 0o777).toBe(0o644);
    expect(
      readdirSync(cwd).filter((file) => file.includes(".cortex-export-")),
    ).toEqual([]);
    expect(clients[0].close).toHaveBeenCalledTimes(1);
    if (failure !== "open") expect(ioEvents).toContain("close");
    if (failure !== "rename") expect(renameMock).not.toHaveBeenCalled();
  },
);

it.each([
  { format: "json", data: "not JSON", count: 1 },
  { format: "json", data: "{}", count: 1 },
  { format: "json", data: "[]", count: 1 },
  { format: "json", data: "[]", count: -1 },
  { format: "csv", data: 'id,value\nrow,"unterminated', count: 1 },
  { format: "csv", data: "id,value\nrow,value,extra", count: 1 },
  { format: "csv", data: 'id,value\nrow,"closed"junk', count: 1 },
  { format: "csv", data: "id,value\nrow,value", count: 2 },
])(
  "facts rejects malformed/incomplete export payload $format $data before opening files",
  async (receipt) => {
    const destination = "protected-export.data";
    writeFileSync(destination, "previous export");
    methods.facts.export.mockResolvedValue(receipt);
    await expect(
      registered([
        "facts",
        "export",
        ...scopeArgs,
        "--format",
        receipt.format,
        "--output",
        destination,
      ]),
    ).rejects.toThrow();
    expect(readFileSync(destination, "utf-8")).toBe("previous export");
    expect(openMock).not.toHaveBeenCalled();
    expect(renameMock).not.toHaveBeenCalled();
    expect(clients[0].close).toHaveBeenCalledTimes(1);
  },
);

it.each([{"method": "deleteMany", "args": ["facts", "clear", "-s", "space-one", "--yes"]}])(
  "facts $method preserves named Task22 partial failure and closes without retry",
  async ({ method, args }) => {
    const partial: import("@cortexmemory/sdk").DomainPartial = {
      outcomes: [
        { physicalId: "committed-row", disposition: "knownCommitted" as const },
        { physicalId: "unknown-row", disposition: "outcomeUnknown" as const },
        { physicalId: "unstarted-row", disposition: "unstarted" as const },
      ],
      confirmedCount: 1, possibleCount: 2,
      confirmedPhysicalIds: ["committed-row"], unknownPhysicalIds: ["unknown-row"],
      remainingPhysicalIds: [], unstartedPhysicalIds: ["unstarted-row"],
    };
    // The package exposes the partial type, but no public runtime error constructor.
    const failure = Object.assign(new Error("facts:" + method + " stopped: 1 confirmed, 1 unknown"), {
      name: "DomainOperationPartialError", operation: "facts:" + method,
      partial, originalCause: new Error("fixture transport stopped"),
    });
    methods.facts[method].mockRejectedValue(failure);
    await expect(json(args)).rejects.toBe(failure);
    expect(failure.partial).toEqual(partial);
    expect(methods.facts[method]).toHaveBeenCalledTimes(1);
    expect(methods.facts.count).toHaveBeenCalledTimes(method === "deleteMany" ? 1 : 0);
    expect(clients[0].close).toHaveBeenCalledTimes(1);
  },
);
