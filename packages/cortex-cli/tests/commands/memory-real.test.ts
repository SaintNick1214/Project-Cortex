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
    args: ["list", "-s", "space-one", "-u", "user-one", "-l", "2"],
    method: "list",
    call: [{ memorySpaceId: "space-one", userId: "user-one", limit: 2 }],
    expected: [memory],
  },
  {
    args: ["search", "full", "-s", "space-one", "-u", "user-one", "-l", "3"],
    method: "search",
    call: ["space-one", "full", { userId: "user-one", limit: 3 }],
    expected: [memory],
  },
  {
    args: ["get", "mem-one", "-s", "space-one", "--include-conversation"],
    method: "get",
    call: ["space-one", "mem-one", { includeConversation: true }],
    expected: memory,
  },
  {
    args: ["delete", "mem-one", "-s", "space-one", "--cascade", "--yes"],
    method: "delete",
    call: ["space-one", "mem-one", { cascadeDeleteFacts: true }],
    expected: { deleted: true, factsDeleted: 2 },
  },
  {
    args: [
      "clear",
      "-s",
      "space-one",
      "-u",
      "user-one",
      "--source",
      "tool",
      "--yes",
    ],
    method: "deleteMany",
    call: [
      { memorySpaceId: "space-one", userId: "user-one", sourceType: "tool" },
    ],
    expected: { deleted: 1201, remaining: 0 },
  },
  {
    args: [
      "export",
      "-s",
      "space-one",
      "-u",
      "user-one",
      "--include-facts",
      "-o",
      "memory-export.json",
    ],
    method: "export",
    call: [
      {
        memorySpaceId: "space-one",
        userId: "user-one",
        includeFacts: true,
        format: "json",
      },
    ],
    expected: { output: "memory-export.json", count: 1, format: "json" },
  },
  {
    args: ["stats", "-s", "space-one"],
    method: "count",
    call: [{ memorySpaceId: "space-one", sourceType: "a2a" }],
    expected: { total: 1201, bySource: { "fact-extraction": 1201 } },
  },
  {
    args: ["archive", "mem-one", "-s", "space-one", "--yes"],
    method: "archive",
    call: ["space-one", "mem-one"],
    expected: { archived: true, factsArchived: 2 },
  },
  {
    args: ["restore", "mem-one", "-s", "space-one"],
    method: "restoreFromArchive",
    call: ["space-one", "mem-one"],
    expected: { restored: true, memory },
  },
];
const scopeArgs = ["-s", "space-one"],
  getArgs = ["get", "mem-one", ...scopeArgs],
  recordId = "mem-one";
const binaryArgs = getArgs,
  binaryValue = memory,
  binaryExpected = memory;

const optionInventory: Record<string, string[]> = {
  memory: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-u, --user <id>",
    "-l, --limit <number>",
    "-f, --format <format>",
    "--quiet",
    "--debug",
  ],
  list: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-u, --user <id>",
    "-l, --limit <number>",
    "-f, --format <format>",
    "--quiet",
    "--debug",
  ],
  search: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-u, --user <id>",
    "-l, --limit <number>",
    "-f, --format <format>",
    "--quiet",
    "--debug",
  ],
  delete: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "--cascade",
    "-y, --yes",
    "--quiet",
    "--debug",
    "-f, --format <format>",
  ],
  clear: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-u, --user <id>",
    "--source <type>",
    "-y, --yes",
    "--quiet",
    "--debug",
    "-f, --format <format>",
  ],
  export: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-u, --user <id>",
    "-o, --output <file>",
    "--include-facts",
    "-f, --format <format>",
    "--quiet",
    "--debug",
  ],
  stats: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-f, --format <format>",
    "--quiet",
    "--debug",
  ],
  get: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "--include-conversation",
    "-f, --format <format>",
    "--quiet",
    "--debug",
  ],
  archive: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "-y, --yes",
    "--quiet",
    "--debug",
    "-f, --format <format>",
  ],
  restore: [
    "-d, --deployment <name>",
    "-s, --space <id>",
    "--quiet",
    "--debug",
    "-f, --format <format>",
  ],
};

it.each(cases)(
  "production memory $args emits the SDK outcome and exact arguments",
  async ({ args, method, call, expected }) => {
    if (args[0] === "stats")
      methods.memory.count.mockImplementation(async (args: {sourceType?: string}) => args.sourceType ? 0 : 1201);
    if (args[0] === "clear")
      methods.memory.count.mockResolvedValueOnce(1201).mockResolvedValueOnce(0);
    const result = await json(["memory", ...args]);
    expect(result).toMatchObject(expected);
    expect(methods.memory[method]).toHaveBeenCalledWith(...call);
    expect(clients[0].url).toBe(config.deployments.one.url);
    expect(clients[0].admin).toHaveBeenCalledWith("synthetic-one");
    expect(clients[0].close).toHaveBeenCalledTimes(1);
  },
);
it.each(cases)(
  "production memory $args propagates the SDK failure and closes",
  async ({ args, method }) => {
    methods.memory[method].mockRejectedValue(new Error("fixture denied"));
    await expect(json(["memory", ...args])).rejects.toThrow("fixture denied");
    expect(clients[0].close).toHaveBeenCalledTimes(1);
    if (args[0] === "export")
      expect(existsSync("memory-export.json")).toBe(false);
  },
);
it("production memory registry preserves each retained leaf and tested option", () => {
  const group = createProgram(config).commands.find(
    (c) => c.name() === "memory",
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
  "memory effective globals select the target at %s",
  async (placement) => {
    const flags = ["-d", "two", "--format", "json", "--quiet"];
    const args =
      placement === "root"
        ? [...flags, "memory", ...getArgs]
        : placement === "group"
          ? ["memory", ...flags, ...getArgs]
          : ["memory", ...getArgs, ...flags];
    const out = await registered(args);
    expect(JSON.parse(out.logs.join("\n"))).toBeTruthy();
    expect(out.errors).toEqual([]);
    expect(clients[0].url).toBe(config.deployments.two.url);
  },
);
it("memory nearest explicit global value wins", async () => {
  const out = await registered([
    "-d",
    "two",
    "--format",
    "csv",
    "memory",
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
  "memory rejects partial or unsafe limit %s before client",
  async (value) => {
    await expect(
      json(["memory", "list", ...scopeArgs, "--limit", value]),
    ).rejects.toThrow();
    expect(clients).toHaveLength(0);
  },
);
it("memory invalid format and unknown deployment never instantiate a client", async () => {
  await expect(
    registered(["memory", ...getArgs, "--format", "yaml"]),
  ).rejects.toThrow();
  await expect(json(["memory", ...getArgs, "-d", "absent"])).rejects.toThrow(
    "not found",
  );
  expect(clients).toHaveLength(0);
});
it("memory missing selected deployment fails nonzero instead of succeeding", async () => {
  writeFileSync(
    join(home, ".cortexrc"),
    JSON.stringify({ deployments: {}, format: "json" }),
  );
  await expect(json(["memory", ...getArgs])).rejects.toThrow();
  expect(clients).toHaveLength(0);
});
it("memory clear uses complete SDK bulk result and refuses partial completion", async () => {
  methods.memory.count.mockResolvedValueOnce(1201).mockResolvedValueOnce(1);
  await expect(
    json(["memory", "clear", ...scopeArgs, "--yes"]),
  ).rejects.toThrow("Clear incomplete");
  expect(methods.memory.deleteMany).toHaveBeenCalledTimes(1);
  expect(methods.memory.list).not.toHaveBeenCalled();
  expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("memory clear count failure never mutates", async () => {
  methods.memory.count.mockRejectedValue(new Error("count denied"));
  await expect(
    json(["memory", "clear", ...scopeArgs, "--yes"]),
  ).rejects.toThrow("count denied");
  expect(methods.memory.deleteMany).not.toHaveBeenCalled();
  expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("memory empty clear and cancelled clear never mutate and close transport", async () => {
  methods.memory.count.mockResolvedValueOnce(0);
  expect(await json(["memory", "clear", ...scopeArgs])).toEqual({ deleted: 0 });
  expect(await json(["memory", "clear", ...scopeArgs])).toEqual({
    cancelled: true,
  });
  expect(methods.memory.deleteMany).not.toHaveBeenCalled();
  expect(clients.every((c) => c.close.mock.calls.length === 1)).toBe(true);
});
it("memory delete confirmation cancels before client creation", async () => {
  expect(await json(["memory", "delete", recordId, ...scopeArgs])).toEqual({
    cancelled: true,
  });
  expect(clients).toHaveLength(0);
  expect(methods.memory.delete).not.toHaveBeenCalled();
});
it("memory absent get and false delete are honest failures", async () => {
  methods.memory.get.mockResolvedValue(null);
  await expect(json(["memory", ...getArgs])).rejects.toThrow("not found");
  methods.memory.delete.mockResolvedValue({ deleted: false });
  await expect(
    json(["memory", "delete", recordId, ...scopeArgs, "--yes"]),
  ).rejects.toThrow("not found");
  expect(clients.every((c) => c.close.mock.calls.length === 1)).toBe(true);
});
it("actual memory binary rejects malformed input before network and emits no stdout", async () => {
  for (const args of [
    ["memory", "list", ...scopeArgs, "--limit", "1x"],
    ["memory", "get"],
    ["memory", ...getArgs, "--format", "yaml"],
  ]) {
    const out = await runActualCLI(binary.entry, args, home, cwd);
    expect(out.status).toBe(1);
    expect(out.stdout).toBe("");
    expect(out.stderr).toMatch(/integer|argument|format|required/);
  }
});
it("actual compiled memory binary emits parseable success JSON and nonzero SDK failure", () => {
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
        "memory",
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
it.each(["conversation", "system", "tool", "a2a", "fact-extraction"])(
  "memory clear forwards retained source %s",
  async (source) => {
    methods.memory.count.mockResolvedValueOnce(1201).mockResolvedValueOnce(0);
    await json(["memory", "clear", ...scopeArgs, "--source", source, "--yes"]);
    expect(methods.memory.deleteMany).toHaveBeenCalledWith({
      memorySpaceId: "space-one",
      sourceType: source,
      userId: undefined,
    });
  },
);
it("memory rejects invalid source, space, user and empty query before client", async () => {
  for (const args of [
    ["clear", ...scopeArgs, "--source", "unknown", "--yes"],
    ["list", "-s", "bad space"],
    ["list", ...scopeArgs, "--user", " "],
    ["search", " ", ...scopeArgs],
  ])
    await expect(json(["memory", ...args])).rejects.toThrow();
  expect(clients).toHaveLength(0);
});
it("memory export preserves all 1201 records and returned CSV bytes including facts", async () => {
  const entries = Array.from({ length: 1201 }, (_, n) => ({
    ...memory,
    memoryId: `mem-${n}`,
  }));
  methods.memory.export.mockResolvedValue({
    format: "json",
    data: JSON.stringify(entries),
    count: 1201,
  });
  expect(await json(["memory", "export", ...scopeArgs])).toEqual({
    output: "memories-export.json",
    count: 1201,
    format: "json",
  });
  expect(JSON.parse(readFileSync("memories-export.json", "utf-8"))).toEqual(
    entries,
  );
  expect(methods.memory.list).not.toHaveBeenCalled();
  const csv =
    'memoryId,content,facts\nmem-one,"comma,quote"" and\nline","[{""fact"":""a,b""}]"';
  methods.memory.export.mockResolvedValue({
    format: "csv",
    data: csv,
    count: 1,
  });
  const out = await registered([
    "memory",
    "export",
    ...scopeArgs,
    "--include-facts",
    "--format",
    "csv",
  ]);
  expect(JSON.parse(out.logs.join("\n"))).toEqual({
    output: "memories-export.csv",
    count: 1,
    format: "csv",
  });
  expect(readFileSync("memories-export.csv", "utf-8")).toBe(csv);
  expect(methods.memory.export).toHaveBeenLastCalledWith({
    memorySpaceId: "space-one",
    userId: undefined,
    includeFacts: true,
    format: "csv",
  });
});
it("memory export refuses mismatched SDK format and surfaces filesystem failure", async () => {
  methods.memory.export.mockResolvedValue({
    format: "csv",
    data: "a,b",
    count: 1,
  });
  await expect(json(["memory", "export", ...scopeArgs])).rejects.toThrow(
    "SDK returned",
  );
  expect(existsSync("memories-export.json")).toBe(false);
  methods.memory.export.mockResolvedValue({
    format: "json",
    data: "[]",
    count: 0,
  });
  await expect(
    json(["memory", "export", ...scopeArgs, "--output", "missing/file.json"]),
  ).rejects.toThrow();
  expect(clients.every((c) => c.close.mock.calls.length === 1)).toBe(true);
});
it("memory archive cancellation and false archive/restore fail honestly", async () => {
  expect(await json(["memory", "archive", recordId, ...scopeArgs])).toEqual({
    cancelled: true,
  });
  expect(clients).toHaveLength(0);
  methods.memory.archive.mockResolvedValue({ archived: false });
  await expect(
    json(["memory", "archive", recordId, ...scopeArgs, "--yes"]),
  ).rejects.toThrow("could not be archived");
  methods.memory.restoreFromArchive.mockResolvedValue({ restored: false });
  await expect(
    json(["memory", "restore", recordId, ...scopeArgs]),
  ).rejects.toThrow("could not be restored");
});
it("memory JSON keeps empty results and full enriched source records", async () => {
  methods.memory.list.mockResolvedValue([]);
  expect(await json(["memory", "list", ...scopeArgs])).toEqual([]);
  const enriched = { memory, sourceMessages: messages, facts: [fact] };
  methods.memory.get.mockResolvedValue(enriched);
  expect(await json(["memory", ...getArgs, "--include-conversation"])).toEqual(
    enriched,
  );
});
it("memory table and CSV keep readable full content", async () => {
  for (const format of ["table", "csv"]) {
    const out = await registered([
      "memory",
      "list",
      ...scopeArgs,
      "--format",
      format,
    ]);
    expect(out.logs.join("\n")).toContain(memory.memoryId);
    if (format === "csv") expect(out.logs.join("\n")).toContain(memory.content);
  }
});

it("memory partial clear emits a structured receipt before nonzero failure", async () => {
  methods.memory.count.mockResolvedValueOnce(1201).mockResolvedValueOnce(1);
  methods.memory.deleteMany.mockResolvedValue({ deleted: 1200 });
  const logs: string[] = [];
  const spy = jest
    .spyOn(console, "log")
    .mockImplementation((...values: unknown[]) => {
      logs.push(values.map(String).join(" "));
    });
  try {
    await expect(
      createProgram(await loadConfig()).parseAsync(
        ["memory", "clear", ...scopeArgs, "--yes", "--format", "json"],
        { from: "user" },
      ),
    ).rejects.toThrow("Clear incomplete");
  } finally {
    spy.mockRestore();
  }
  expect(JSON.parse(logs.join("\n"))).toEqual({ deleted: 1200, remaining: 1 });
  expect(clients[0].close).toHaveBeenCalledTimes(1);
});
it("memory empty record ID and unsafe export path fail before SDK", async () => {
  await expect(json(["memory", "get", " ", ...scopeArgs])).rejects.toThrow();
  await expect(
    json(["memory", "export", ...[], ...scopeArgs, "--output", " "]),
  ).rejects.toThrow();
  expect(clients).toHaveLength(0);
});
it("memory stats retains recent activity and propagates its read failure", async () => {
  methods.memory.count.mockImplementation(async (args: {sourceType?: string}) => args.sourceType ? 0 : 1201);
  const result = await json(["memory", "stats", ...scopeArgs]);
  expect(result.recentCount).toBe(1);
  expect(result.lastActivity).toBe(1);
  methods.memory.list.mockRejectedValue(new Error("recent denied"));
  await expect(json(["memory", "stats", ...scopeArgs])).rejects.toThrow(
    "recent denied",
  );
});

it("memory stats reports the five native sources using only supported count filters", async () => {
  const counts: Record<string, number> = {conversation: 2, system: 3, tool: 4, a2a: 5};
  methods.memory.count.mockImplementation(async (args: {sourceType?: string}) => args.sourceType ? counts[args.sourceType] : 17);
  const result = await json(["memory", "stats", ...scopeArgs]);
  expect(result.total).toBe(17);
  expect(result.bySource).toEqual({...counts, "fact-extraction": 3});
  expect(methods.memory.count.mock.calls).toEqual([
    [{memorySpaceId: "space-one"}],
    ...Object.keys(counts).map(sourceType => [{memorySpaceId: "space-one", sourceType}]),
  ]);
  expect(clients[0].close).toHaveBeenCalledTimes(1);
});

it("memory stats refuses inconsistent observations rather than inventing a residual count", async () => {
  methods.memory.count.mockResolvedValue(1);
  await expect(json(["memory", "stats", ...scopeArgs])).rejects.toThrow("Memory counts changed or are invalid");
  expect(clients[0].close).toHaveBeenCalledTimes(1);
});

it.each(cases)(
  "actual compiled memory $args preserves JSON outcomes and failure exits",
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
      String.raw`import {appendFileSync} from "fs"; const results = ${JSON.stringify(results)}; const trace = ${JSON.stringify(join(root, "all-trace.jsonl"))}; export const createAuthContext = value => value; export class Cortex { constructor(o,r) { r?.initializeTransport?.({close:()=>Promise.resolve(),query(){},mutation(){},action(){}}); this.memorySpaces = {list: async () => ({spaces: []})}; let counted = false; for(const group of ["memory","facts","conversations"]) this[group] = new Proxy({}, { get:(_,method)=> async (...args)=> { appendFileSync(trace, JSON.stringify({group,method,args}) + "\n"); if(process.env.TEST_FAIL === "1") throw new Error("fixture SDK failure"); if(method === "count") { if(process.argv.includes("clear") && counted) return process.env.TEST_PARTIAL === "1" ? 1 : 0; counted = true; return process.argv.includes("stats") && args[0]?.sourceType ? 0 : 1201; } if(method === "deleteMany" && process.env.TEST_PARTIAL === "1") return {deleted:1200}; return results[group][method]; }}); } getClient() { return {setAdminAuth(){}}; } async shutdown() {this.close();} close() {appendFileSync(trace,"closed\n");} }`,
    );
    const run = (fail: boolean, partial = false) =>
      spawnSync(
        process.execPath,
        [
          "--no-warnings",
          "--experimental-loader",
          loader,
          binary.entry,
          "memory",
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
  "production memory $args retains useful table output",
  async ({ args }) => {
    if (args[0] === "stats")
      methods.memory.count.mockImplementation(async (args: {sourceType?: string}) => args.sourceType ? 0 : 1201);
    if (args[0] === "clear")
      methods.memory.count.mockResolvedValueOnce(1201).mockResolvedValueOnce(0);
    const out = await registered([
      "memory",
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

it("memory export atomically replaces the destination with a private complete file", async () => {
  const destination = "protected-export.json";
  writeFileSync(destination, "old complete export", { mode: 0o644 });
  await json([
    "memory",
    "export",
    ...[],
    ...scopeArgs,
    "--output",
    destination,
  ]);
  expect(JSON.parse(readFileSync(destination, "utf-8"))).toEqual([memory]);
  expect(statSync(destination).mode & 0o777).toBe(0o600);
  expect(ioEvents).toEqual(["open", "write", "sync", "close", "rename"]);
  expect(openMock.mock.calls[0][1]).toBe("wx");
  expect(openMock.mock.calls[0][2]).toBe(0o600);
  expect(
    readdirSync(cwd).filter((file) => file.includes(".cortex-export-")),
  ).toEqual([]);
});
it.each(["open", "write", "sync", "close", "rename"] as const)(
  "memory %s failure preserves destination and removes staging files",
  async (failure) => {
    const destination = "protected-export.json";
    writeFileSync(destination, "old complete export", { mode: 0o644 });
    failStage = failure;
    await expect(
      json(["memory", "export", ...[], ...scopeArgs, "--output", destination]),
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
  "memory rejects malformed/incomplete export payload $format $data before opening files",
  async (receipt) => {
    const destination = "protected-export.data";
    writeFileSync(destination, "previous export");
    methods.memory.export.mockResolvedValue(receipt);
    await expect(
      registered([
        "memory",
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

it.each([{"method": "delete", "args": ["memory", "delete", "mem-one", "-s", "space-one", "--yes"]}, {"method": "deleteMany", "args": ["memory", "clear", "-s", "space-one", "--yes"]}, {"method": "archive", "args": ["memory", "archive", "mem-one", "-s", "space-one", "--yes"]}])(
  "memory $method preserves named Task22 partial failure and closes without retry",
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
    const failure = Object.assign(new Error("memory:" + method + " stopped: 1 confirmed, 1 unknown"), {
      name: "DomainOperationPartialError", operation: "memory:" + method,
      partial, originalCause: new Error("fixture transport stopped"),
    });
    methods.memory[method].mockRejectedValue(failure);
    await expect(json(args)).rejects.toBe(failure);
    expect(failure.partial).toEqual(partial);
    expect(methods.memory[method]).toHaveBeenCalledTimes(1);
    expect(methods.memory.count).toHaveBeenCalledTimes(method === "deleteMany" ? 1 : 0);
    expect(clients[0].close).toHaveBeenCalledTimes(1);
  },
);

it("memory archive preserves the Task22 receipt and restore claims only the restored memory", async () => {
  const archived = {
    archived: true, memoryId: recordId, restorable: true, factsArchived: 1, factIds: ["fact-one"],
    partial: {
      outcomes: [{ physicalId: "memory-row", disposition: "knownCommitted" }],
      confirmedCount: 1, possibleCount: 1, confirmedPhysicalIds: ["memory-row"],
      unknownPhysicalIds: [], remainingPhysicalIds: [], unstartedPhysicalIds: [],
    },
    intent: { memorySpaceId: "space-one", memoryId: recordId, memoryPhysicalId: "memory-row", memoryFingerprint: "fixture-fingerprint", facts: [] },
  };
  methods.memory.archive.mockResolvedValue(archived);
  expect(await json(["memory", "archive", recordId, ...scopeArgs, "--yes"])).toEqual(archived);
  const restored = { restored: true, memoryId: recordId, memory };
  methods.memory.restoreFromArchive.mockResolvedValue(restored);
  expect(await json(["memory", "restore", recordId, ...scopeArgs])).toEqual(restored);
  expect(methods.memory.restoreFromArchive).toHaveBeenCalledWith("space-one", recordId);
  for (const method of Object.values(methods.facts)) expect(method).not.toHaveBeenCalled();
  expect(clients.every((client) => client.close.mock.calls.length === 1)).toBe(true);
});
