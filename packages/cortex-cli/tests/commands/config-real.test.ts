/** Real command registration plus actual binary regressions; no copied Commander definitions. */
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
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  statSync,
  existsSync,
  realpathSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parse as parseDotenv } from "dotenv";
import type { CLIConfig } from "../../src/types.js";
import {
  stageActualCLI,
  runActualCLI,
  captureConsole,
} from "../helpers/cli-test-utils.js";
const clients: Array<{
  url: string;
  admin: ReturnType<typeof jest.fn>;
  close: ReturnType<typeof jest.fn>;
}> = [];
let connectionFailure = false;
const query = jest.fn<() => Promise<unknown>>(async () => {
  if (connectionFailure) throw new Error("401 fixture-secret");
  return { spaces: [] };
});
const realOs = await import("os");
jest.unstable_mockModule("os", () => ({
  ...realOs,
  homedir: () => process.env.HOME!,
}));
jest.unstable_mockModule("convex/browser", () => ({ ConvexHttpClient: jest.fn(() => ({
  setAdminAuth: clients.at(-1)!.admin, query: jest.fn(), mutation: jest.fn(), action: jest.fn(),
})) }));
jest.unstable_mockModule("@cortexmemory/sdk", () => ({ createAuthContext: (value: unknown) => value,
  Cortex: jest.fn((options: { convexUrl: string }, runtime?: {initializeTransport?: (transport: unknown) => undefined}) => {
    const admin = jest.fn();
    const close = jest.fn();
    clients.push({ url: options.convexUrl, admin, close });
    const transport = {close, query: jest.fn(), mutation: jest.fn(), action: jest.fn(), setAdminAuth: admin};
    runtime?.initializeTransport?.(transport);
    return {
      getClient: () => transport,
      shutdown: async () => { await transport.close(); }, close: () => transport.close(),
      memorySpaces: { list: query },
    };
  }),
}));
const { createProgram } = await import("../../src/program.js");
const { loadConfig, getUserConfigPath } = await import(
  "../../src/utils/config.js"
);
let root: string;
let home: string;
let cwd: string;
let oldCwd: string;
let oldHome: string | undefined;
let binary: Awaited<ReturnType<typeof stageActualCLI>>;
const config = (): CLIConfig => ({
  deployments: {
    one: {
      url: "http://127.0.0.1:1",
      key: "fixture-secret",
      projectPath: "/missing-cortex-fixture",
    },
    two: { url: "http://127.0.0.1:2", key: "fixture-second" },
  },
  default: "one",
  format: "table",
  confirmDangerous: true,
  apps: {
    old: {
      type: "basic",
      path: "stale",
      projectPath: "/missing-cortex-fixture",
      enabled: false,
    },
  },
  version: 5,
});
beforeAll(async () => {
  binary = await stageActualCLI();
}, 30000);
afterAll(async () => {
  await binary.cleanup();
});
beforeEach(() => {
  oldCwd = process.cwd();
  oldHome = process.env.HOME;
  root = mkdtempSync(join(tmpdir(), "cortex-config-real-"));
  home = join(root, "home");
  cwd = join(root, "project");
  mkdirSync(home);
  mkdirSync(cwd);
  process.env.HOME = home;
  process.chdir(cwd);
  if (realOs.homedir() !== process.env.CORTEX_TEST_HOME_ROOT)
    throw new Error("Native HOME is not externally isolated");
  expect(getUserConfigPath()).toBe(join(home, ".cortexrc"));
  clients.length = 0;
  connectionFailure = false;
  jest.clearAllMocks();
});
afterEach(() => {
  process.chdir(oldCwd);
  if (oldHome === undefined) delete process.env.HOME;
  else process.env.HOME = oldHome;
  rmSync(root, { recursive: true, force: true });
});
async function registered(args: string[]) {
  const output = captureConsole();
  try {
    await createProgram(await loadConfig())
      .exitOverride()
      .parseAsync(args, { from: "user" });
    return output.output;
  } finally {
    output.restore();
  }
}
it.each([
  ["-d", "two", "--format", "json", "config", "test"],
  ["config", "test", "-d", "two", "--format", "json"],
  ["config", "-d", "two", "test", "--format", "json"],
])(
  "actual registered handler receives globals at every position: %j",
  async (...args) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    const output = await registered(args as string[]);
    const result = JSON.parse(output.logs.join("\n"));
    expect(result.connected).toBe(true);
    expect(result.url).toBe(config().deployments.two.url);
    expect(clients[0].url).toBe(config().deployments.two.url);
    expect(clients[0].admin).toHaveBeenCalledWith("fixture-second");
    expect(clients[0].close).toHaveBeenCalledTimes(1);
    expect(output.errors.join("\n")).toContain("Using: two");
  },
);
it("config show/list retain stale/auth-failing entries and bytes, redact secrets, emit parseable JSON", async () => {
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
  const before = readFileSync(join(home, ".cortexrc"), "utf-8");
  connectionFailure = true;
  for (const leaf of ["show", "list", "deployments"]) {
    const output = await registered(["--format", "json", "config", leaf]);
    const result = JSON.parse(output.logs.join("\n"));
    if (leaf === "show") {
      expect(result.deployments.one.key).toBe("***");
      expect(result.version).toBe(5);
      expect(result.apps.old.enabled).toBe(false);
    } else expect(result).toHaveLength(2);
    expect(JSON.stringify(output)).not.toContain("fixture-secret");
    expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
  }
  expect(clients.every((client) => client.close.mock.calls.length === 1)).toBe(
    true,
  );
});
it("deprecated config toggles always throw before save or client creation", async () => {
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
  const before = readFileSync(join(home, ".cortexrc"), "utf-8");
  for (const leaf of ["enable", "disable"])
    await expect(registered(["config", leaf, "one"])).rejects.toThrow(
      "is retired",
    );
  expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
  expect(clients).toHaveLength(0);
});
it("quiet suppresses selection and validation hints without dropping JSON", async () => {
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
  const output = await registered([
    "--quiet",
    "config",
    "test",
    "--format",
    "json",
  ]);
  expect(JSON.parse(output.logs.join("\n")).connected).toBe(true);
  expect(output.errors).toEqual([]);
});
it.each(["1.5", "2abc", "Infinity", "0", "1001"])(
  "real domain registry rejects strict limit %s before selection/network",
  async (limit) => {
    await expect(
      registered(["users", "list", "--limit", limit]),
    ).rejects.toThrow();
    expect(clients).toHaveLength(0);
  },
);
it("valid conversations txt export is accepted by the registry validation before target failure", async () => {
  await expect(
    registered([
      "conversations",
      "export",
      "conversation-id",
      "--format",
      "txt",
    ]),
  ).rejects.toThrow("No deployments");
});
it.each([
  ["users", "list"],
  ["spaces", "list"],
  ["memory", "list", "--space", "owned"],
  ["facts", "list", "--space", "owned"],
  ["conversations", "list"],
  ["db", "stats"],
])(
  "actual binary missing target fails with empty stdout: %j",
  async (...args) => {
    const result = await runActualCLI(
      binary.entry,
      args as string[],
      home,
      cwd,
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("No deployments configured");
  },
);
it("actual binary rejects malformed config and invalid options with nonzero status", async () => {
  writeFileSync(join(home, ".cortexrc"), "{");
  let result = await runActualCLI(
    binary.entry,
    ["config", "show", "--format", "json"],
    home,
    cwd,
  );
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Malformed configuration");
  rmSync(join(home, ".cortexrc"));
  for (const args of [
    ["--format", "bogus", "config", "show"],
    ["users", "list", "--limit", "1.5"],
    ["config", "show", "--unknown"],
  ]) {
    result = await runActualCLI(binary.entry, args, home, cwd);
    expect(result.status).toBe(1);
  }
});
it("actual binary persists/readbacks scoped use, default changes, private mode and redacted show", async () => {
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
  let result = await runActualCLI(binary.entry, ["use", "two"], home, cwd);
  expect(result.status).toBe(0);
  expect(statSync(join(home, ".cortex-current")).mode & 0o777).toBe(0o600);
  result = await runActualCLI(
    binary.entry,
    ["use", "--format", "json"],
    home,
    cwd,
  );
  expect(JSON.parse(result.stdout).current).toBe("two");
  result = await runActualCLI(
    binary.entry,
    ["config", "set", "default", "two"],
    home,
    cwd,
  );
  expect(result.status).toBe(0);
  expect(
    JSON.parse(readFileSync(join(home, ".cortexrc"), "utf-8")).default,
  ).toBe("two");
  expect(statSync(join(home, ".cortexrc")).mode & 0o777).toBe(0o600);
  result = await runActualCLI(binary.entry, ["use", "--clear"], home, cwd);
  expect(result.status).toBe(0);
  expect(
    JSON.parse(
      (await runActualCLI(binary.entry, ["use", "--format", "json"], home, cwd))
        .stdout,
    ).current,
  ).toBeNull();
});
it("actual binary unknown target/toggles fail without modifying config or opening transport", async () => {
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
  const before = readFileSync(join(home, ".cortexrc"), "utf-8");
  for (const args of [
    ["-d", "missing", "users", "list"],
    ["users", "list", "-d", "missing"],
    ["use", "missing"],
    ["config", "enable", "one"],
    ["config", "disable", "one"],
  ]) {
    const result = await runActualCLI(binary.entry, args, home, cwd);
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("Using:");
    expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
  }
});

it("built readonly show/list retain bytes on unreachable target with parseable redacted JSON", async () => {
  const saved = config();
  delete saved.deployments.two;
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(saved));
  const before = readFileSync(join(home, ".cortexrc"), "utf-8");
  for (const leaf of ["show", "list"]) {
    const result = await runActualCLI(
      binary.entry,
      ["--quiet", "config", leaf, "--format", "json"],
      home,
      cwd,
    );
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    if (leaf === "show") {
      expect(parsed.deployments.one.key).toBe("***");
      expect(parsed.apps.old.enabled).toBe(false);
    } else expect(parsed).toHaveLength(1);
    expect(result.stdout + result.stderr).not.toContain("fixture-secret");
    expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
  }
}, 15000);
it("built connection failure is structured, nonzero, redacted and leaves config intact", async () => {
  const saved = config();
  delete saved.deployments.two;
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(saved));
  const before = readFileSync(join(home, ".cortexrc"), "utf-8");
  const result = await runActualCLI(
    binary.entry,
    ["config", "test", "--format", "json"],
    home,
    cwd,
  );
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout).connected).toBe(false);
  expect(result.stderr).toContain("Connection failed");
  expect(result.stdout + result.stderr).not.toContain("fixture-secret");
  expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
}, 10000);
it("root/leaf debug diagnostic paths stay off JSON stdout", async () => {
  for (const args of [
    ["--debug", "--format", "json", "config", "path"],
    ["config", "path", "--debug", "--format", "json"],
  ]) {
    const result = await runActualCLI(binary.entry, args, home, cwd);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).userConfig).toBe(join(home, ".cortexrc"));
    expect(result.stderr).toContain("[DEBUG] cortex config path");
  }
});

it("built use mutations and reset emit one JSON result without prose", async () => {
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
  for (const [args, expected] of [
    [["use", "two", "--format", "json"], { current: "two", scoped: true }],
    [["--format", "json", "use", "--clear"], { cleared: true, current: null }],
    [
      ["config", "set", "format", "json", "--format", "json"],
      { updated: true, key: "format", value: "json" },
    ],
    [["config", "reset", "--yes", "--format", "json"], { reset: true }],
  ] as Array<[string[], Record<string, unknown>]>) {
    const result = await runActualCLI(binary.entry, args, home, cwd);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expected);
  }
});

it("registered use CSV quotes its deployments array as one cell", async () => {
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
  const output = await registered(["use", "--format", "csv"]);
  expect(output.logs.join("\n")).toBe(
    'current,default,deployments\n,one,"[""one"",""two""]"',
  );
});

it("built configuration credential/env saves are private and machine results redact the value", async () => {
  const result = await runActualCLI(
    binary.entry,
    [
      "config",
      "add-deployment",
      "owned",
      "--url",
      "http://127.0.0.1:1",
      "--key",
      "owned-credential-fixture",
      "--default",
      "--format",
      "json",
    ],
    home,
    cwd,
  );
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    added: true,
    deployment: "owned",
    url: "http://127.0.0.1:1",
    hasKey: true,
    default: true,
  });
  expect(result.stdout + result.stderr).not.toContain(
    "owned-credential-fixture",
  );
  expect(statSync(join(home, ".cortexrc")).mode & 0o777).toBe(0o600);
  expect(statSync(join(cwd, ".env.local")).mode & 0o777).toBe(0o600);
  expect(readFileSync(join(cwd, ".env.local"), "utf-8")).toContain(
    "OWNED_CONVEX_DEPLOY_KEY=owned-credential-fixture",
  );
});

it("built invalid credential input fails before config/env creation", async () => {
  const result = await runActualCLI(
    binary.entry,
    [
      "config",
      "add-deployment",
      "owned",
      "--url",
      "http://127.0.0.1:1",
      "--key",
      "bad\nINJECTED=value",
      "--format",
      "json",
    ],
    home,
    cwd,
  );
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(() => statSync(join(home, ".cortexrc"))).toThrow();
  expect(() => statSync(join(cwd, ".env.local"))).toThrow();
});

it.each([
  [{ url: "http://127.0.0.1:3" }, undefined],
  [{ url: "http://127.0.0.1:1/" }, "fixture-secret"],
  [{ url: "http://127.0.0.1:3", key: "project-secret" }, "project-secret"],
])(
  "actual registry binds admin credential to effective endpoint %j",
  async (overlay, key) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    writeFileSync(
      "cortex.config.json",
      JSON.stringify({ deployments: { one: overlay } }),
    );
    const userBefore = readFileSync(join(home, ".cortexrc"), "utf-8");
    const projectBefore = readFileSync("cortex.config.json", "utf-8");
    const output = await registered([
      "-d",
      "one",
      "config",
      "test",
      "--format",
      "json",
    ]);
    expect(JSON.parse(output.logs.join("\n")).connected).toBe(true);
    expect(clients[0].url).toBe(overlay.url);
    if (key) expect(clients[0].admin).toHaveBeenCalledWith(key);
    else expect(clients[0].admin).not.toHaveBeenCalled();
    expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(userBefore);
    expect(readFileSync("cortex.config.json", "utf-8")).toBe(projectBefore);
  },
);

const mutationPositions = ["root", "group", "leaf"] as const;
function targetArgs(
  position: (typeof mutationPositions)[number],
  leaf: string,
  tail: string[],
) {
  if (position === "root") return ["-d", "two", "config", leaf, ...tail];
  if (position === "group") return ["config", "-d", "two", leaf, ...tail];
  return ["config", leaf, "-d", "two", ...tail];
}
it.each(mutationPositions)(
  "registered key/url/remove handlers honor explicit target at %s",
  async (position) => {
    const path = join(home, ".cortexrc");
    writeFileSync(path, JSON.stringify(config()));
    let output = await registered(
      targetArgs(position, "set-key", [
        "--key",
        "updated-secret",
        "--json-only",
        "--format",
        "json",
      ]),
    );
    expect(JSON.parse(output.logs.join("\n")).deployment).toBe("two");
    expect((await loadConfig()).deployments.two.key).toBe("updated-secret");
    output = await registered(
      targetArgs(position, "set-url", [
        "--url",
        "http://127.0.0.1:3",
        "--json-only",
        "--format",
        "json",
      ]),
    );
    expect(JSON.parse(output.logs.join("\n")).deployment).toBe("two");
    expect((await loadConfig()).deployments.two).toEqual({
      url: "http://127.0.0.1:3",
    });
    output = await registered(
      targetArgs(position, "remove-deployment", [
        "--yes",
        "--json-only",
        "--format",
        "json",
      ]),
    );
    expect(JSON.parse(output.logs.join("\n"))).toEqual({
      removed: true,
      deployment: "two",
    });
    expect((await loadConfig()).deployments.two).toBeUndefined();
    expect((await loadConfig()).deployments.one).toEqual(
      config().deployments.one,
    );
  },
);

it.each(mutationPositions)(
  "built key/url/remove handlers honor explicit target at %s and preserve other aliases",
  async (position) => {
    const path = join(home, ".cortexrc");
    writeFileSync(path, JSON.stringify(config()));
    const mutations = [
      [
        "set-key",
        ["--key", "updated-secret"],
        { updated: true, deployment: "two", hasKey: true },
      ],
      [
        "set-url",
        ["--url", "http://127.0.0.1:3"],
        { updated: true, deployment: "two", url: "http://127.0.0.1:3" },
      ],
      ["remove-deployment", ["--yes"], { removed: true, deployment: "two" }],
    ] as const;
    for (const [leaf, tail, expected] of mutations) {
      const result = await runActualCLI(
        binary.entry,
        targetArgs(position, leaf, [
          ...tail,
          "--json-only",
          "--format",
          "json",
        ]),
        home,
        cwd,
      );
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual(expected);
      expect(result.stdout + result.stderr).not.toContain("updated-secret");
      const saved = await loadConfig();
      expect(saved.deployments.one).toEqual(config().deployments.one);
      if (leaf === "set-key")
        expect(saved.deployments.two.key).toBe("updated-secret");
      if (leaf === "set-url")
        expect(saved.deployments.two).toEqual({ url: "http://127.0.0.1:3" });
      if (leaf === "remove-deployment")
        expect(saved.deployments.two).toBeUndefined();
    }
    expect(existsSync(join(cwd, ".env.local"))).toBe(false);
  },
);

it.each(["set-key", "set-url", "remove-deployment", "use"])(
  "built %s refuses conflicting target selectors before any write",
  async (leaf) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    writeFileSync(
      ".env.local",
      "# preserve\nTWO_CONVEX_DEPLOY_KEY=env-secret\n",
    );
    const before = readFileSync(join(home, ".cortexrc"), "utf-8");
    const envBefore = readFileSync(".env.local", "utf-8");
    const extra =
      leaf === "set-key"
        ? ["--key", "new-secret"]
        : leaf === "set-url"
          ? ["--url", "http://127.0.0.1:3"]
          : leaf === "remove-deployment"
            ? ["--yes"]
            : [];
    const args = [
      "-d",
      "one",
      ...(leaf === "use" ? [] : ["config"]),
      leaf,
      "two",
      ...extra,
      "--format",
      "json",
    ];
    const result = await runActualCLI(binary.entry, args, home, cwd);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Conflicting deployment targets");
    expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
    expect(readFileSync(".env.local", "utf-8")).toBe(envBefore);
    expect(existsSync(join(home, ".cortex-current"))).toBe(false);
    expect(result.stderr).not.toContain("new-secret");
  },
);

it.each(["set-key", "set-url", "use"])(
  "built invalid %s alias emits only stderr including quiet JSON",
  async (leaf) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    const before = readFileSync(join(home, ".cortexrc"), "utf-8");
    for (const quiet of [false, true]) {
      const extra =
        leaf === "set-key"
          ? ["--key", "new-secret"]
          : leaf === "set-url"
            ? ["--url", "http://127.0.0.1:3"]
            : [];
      const args = [
        ...(leaf === "use" ? [] : ["config"]),
        leaf,
        "missing",
        ...extra,
        "--format",
        "json",
        ...(quiet ? ["--quiet"] : []),
      ];
      const result = await runActualCLI(binary.entry, args, home, cwd);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("not found");
      expect(result.stderr).not.toContain("new-secret");
      expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
      expect(existsSync(join(cwd, ".env.local"))).toBe(false);
      expect(existsSync(join(home, ".cortex-current"))).toBe(false);
    }
  },
);

it.each([false, true])(
  "built effective remove/reset refuses inherited or mixed alias (overlay %s) and preserves config/env/readback",
  async (overlay) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    writeFileSync(
      "cortex.config.json",
      JSON.stringify({
        marker: "keep",
        ...(overlay
          ? { deployments: { two: { url: "http://127.0.0.1:3" } } }
          : {}),
      }),
    );
    writeFileSync(
      ".env.local",
      "# preserve\nTWO_CONVEX_URL=http://127.0.0.1:3\nTWO_CONVEX_DEPLOY_KEY=env-secret\n",
    );
    const paths = [join(home, ".cortexrc"), "cortex.config.json", ".env.local"];
    const before = paths.map((path) => readFileSync(path, "utf-8"));
    const effective = await loadConfig();
    for (const args of [
      ["config", "remove-deployment", "two", "--yes"],
      ["config", "reset", "--yes"],
    ]) {
      const result = await runActualCLI(
        binary.entry,
        [...args, "--format", "json"],
        home,
        cwd,
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Cannot remove inherited");
      expect(paths.map((path) => readFileSync(path, "utf-8"))).toEqual(before);
      expect(await loadConfig()).toEqual(effective);
    }
  },
);

it("built URL change removes previous owned config/env key; same endpoint retains key", async () => {
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
  writeFileSync(
    ".env.local",
    "# preserve\nTWO_CONVEX_URL=http://127.0.0.1:2\nTWO_CONVEX_DEPLOY_KEY=fixture-second\nOTHER=value\n",
  );
  for (const url of ["http://127.0.0.1:2/", "http://127.0.0.1:3"]) {
    const result = await runActualCLI(
      binary.entry,
      ["config", "set-url", "two", "--url", url, "--format", "json"],
      home,
      cwd,
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).url).toBe(url);
    const same = url === "http://127.0.0.1:2/";
    expect((await loadConfig()).deployments.two.key).toBe(
      same ? "fixture-second" : undefined,
    );
    const env = readFileSync(".env.local", "utf-8");
    expect(env.includes("TWO_CONVEX_DEPLOY_KEY")).toBe(same);
    expect(env).toContain("OTHER=value");
    expect(env).toContain("# preserve");
  }
});

it("built convex-url setter drops old credential in user source; project partial URL change never copies user key", async () => {
  const path = join(home, ".cortexrc");
  writeFileSync(path, JSON.stringify(config()));
  const changed = await runActualCLI(
    binary.entry,
    ["config", "set", "convex-url", "http://127.0.0.1:3", "--format", "json"],
    home,
    cwd,
  );
  expect(changed.status).toBe(0);
  expect(JSON.parse(changed.stdout).updated).toBe(true);
  expect((await loadConfig()).deployments.one.key).toBeUndefined();
  writeFileSync(path, JSON.stringify(config()));
  const userBefore = readFileSync(path, "utf-8");
  writeFileSync("cortex.config.json", JSON.stringify({ marker: "keep" }));
  const projectChange = await runActualCLI(
    binary.entry,
    [
      "config",
      "set-url",
      "one",
      "--url",
      "http://127.0.0.1:3",
      "--json-only",
      "--format",
      "json",
    ],
    home,
    cwd,
  );
  expect(projectChange.status).toBe(0);
  expect(JSON.parse(projectChange.stdout).deployment).toBe("one");
  expect(readFileSync(path, "utf-8")).toBe(userBefore);
  expect(JSON.parse(readFileSync("cortex.config.json", "utf-8"))).toEqual({
    marker: "keep",
    deployments: { one: { url: "http://127.0.0.1:3" } },
  });
  expect((await loadConfig()).deployments.one.key).toBeUndefined();
});

it("built agreeing positional/flag targets are accepted and scoped use honors flag-only target", async () => {
  writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
  const update = await runActualCLI(
    binary.entry,
    [
      "-d",
      "two",
      "config",
      "set-key",
      "two",
      "--key",
      "new-secret",
      "--json-only",
      "--format",
      "json",
    ],
    home,
    cwd,
  );
  expect(update.status).toBe(0);
  expect(JSON.parse(update.stdout).deployment).toBe("two");
  expect((await loadConfig()).deployments.two.key).toBe("new-secret");
  const use = await runActualCLI(
    binary.entry,
    ["use", "-d", "two", "--format", "json"],
    home,
    cwd,
  );
  expect(use.status).toBe(0);
  expect(JSON.parse(use.stdout).current).toBe("two");
  const store = JSON.parse(
    readFileSync(join(home, ".cortex-current"), "utf-8"),
  );
  expect(store.selections[realpathSync(cwd)]).toBe("two");
});

function configArgs(
  position: (typeof mutationPositions)[number],
  parts: string[],
  target: string,
): string[] {
  if (position === "root")
    return ["-d", target, "config", ...parts, "--format", "json"];
  if (position === "group")
    return ["config", "-d", target, ...parts, "--format", "json"];
  return [
    "config",
    parts[0],
    "-d",
    target,
    ...parts.slice(1),
    "--format",
    "json",
  ];
}
async function registeredFailure(args: string[]) {
  const output = captureConsole();
  const exit = jest.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`fixture exit ${code}`);
  });
  try {
    await expect(
      createProgram(await loadConfig())
        .exitOverride()
        .parseAsync(args, { from: "user" }),
    ).rejects.toThrow("fixture exit 1");
    expect(exit).toHaveBeenCalledWith(1);
    return {
      stdout: output.output.logs.join("\n"),
      stderr: output.output.errors.join("\n"),
    };
  } finally {
    exit.mockRestore();
    output.restore();
  }
}
function prototypeSnapshot() {
  return {
    object: Object.getOwnPropertyDescriptors(Object),
    prototype: Object.getOwnPropertyDescriptors(Object.prototype),
    functions: Object.fromEntries(
      Object.entries(Object.getOwnPropertyDescriptors(Object.prototype))
        .filter(([, entry]) => typeof entry.value === "function")
        .map(([name, entry]) => [
          name,
          Object.getOwnPropertyDescriptors(entry.value),
        ]),
    ),
  };
}
async function configResult(
  mode: "registered" | "binary",
  args: string[],
  failure = false,
) {
  if (mode === "binary") {
    const result = await runActualCLI(binary.entry, args, home, cwd);
    expect(result.status).toBe(failure ? 1 : 0);
    return result;
  }
  if (failure) return registeredFailure(args);
  const output = await registered(args);
  return { stdout: output.logs.join("\n"), stderr: output.errors.join("\n") };
}
const executionModes = ["registered", "binary"] as const;
it.each(
  executionModes.flatMap((mode) =>
    mutationPositions.map((position) => [mode, position] as const),
  ),
)(
  "%s remaining target mutations honor %s selectors, requested readback and other-alias preservation",
  async (mode, position) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    const ownPath = join(cwd, "owned-path");
    mkdirSync(ownPath);
    const actions = [
      { parts: ["set-path", "two", ownPath], target: "two" },
      { parts: ["set", "convex-key", "selected-key"], target: "two" },
      { parts: ["set", "convex-url", "http://127.0.0.1:7"], target: "two" },
      {
        parts: [
          "add-deployment",
          "--url",
          "http://127.0.0.1:8",
          "--key",
          "created-key",
          "--json-only",
        ],
        target: "created",
      },
      {
        parts: [
          "add-deployment",
          "agree",
          "--url",
          "http://127.0.0.1:9",
          "--json-only",
        ],
        target: "agree",
      },
    ];
    for (const { parts, target } of actions) {
      const output = await configResult(
        mode,
        configArgs(position, parts, target),
      );
      expect(JSON.parse(output.stdout)).toBeDefined();
      expect(output.stdout + output.stderr).not.toContain("selected-key");
      expect(output.stdout + output.stderr).not.toContain("created-key");
      const readback = await loadConfig();
      expect(readback.deployments.one).toEqual(config().deployments.one);
      expect(readback.default).toBe("one");
      if (parts[0] === "set-path")
        expect(readback.deployments.two.projectPath).toBe(ownPath);
      if (parts[1] === "convex-key")
        expect(readback.deployments.two.key).toBe("selected-key");
      if (parts[1] === "convex-url") {
        expect(readback.deployments.two.url).toBe("http://127.0.0.1:7");
        expect(readback.deployments.two.key).toBeUndefined();
        expect(readback.deployments.two.projectPath).toBe(ownPath);
      }
      if (target === "created")
        expect(readback.deployments.created).toEqual({
          url: "http://127.0.0.1:8",
          key: "created-key",
        });
      if (target === "agree")
        expect(readback.deployments.agree).toEqual({
          url: "http://127.0.0.1:9",
        });
    }
    expect(existsSync(join(cwd, ".env.local"))).toBe(false);
    expect(existsSync(join(home, ".cortex-current"))).toBe(false);
    expect(clients).toHaveLength(0);
  },
  20000,
);

it.each(
  executionModes.flatMap((mode) =>
    mutationPositions.map((position) => [mode, position] as const),
  ),
)(
  "%s %s unknown/conflicting and unsupported mutation selectors preserve config/env/current before effects",
  async (mode, position) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    writeFileSync(".env.local", "# keep\nOTHER=value\n");
    await configResult(mode, ["use", "two", "--format", "json"]);
    const files = [
      join(home, ".cortexrc"),
      join(cwd, ".env.local"),
      join(home, ".cortex-current"),
    ];
    const before = files.map((path) => readFileSync(path, "utf-8"));
    const cases = [
      { parts: ["set-path", "two", cwd], target: "one" },
      { parts: ["set-path", "two", cwd], target: "missing" },
      { parts: ["set-path", "missing", cwd], target: "missing" },
      { parts: ["set", "convex-key", "fake-secret"], target: "missing" },
      { parts: ["set", "convex-url", "http://127.0.0.1:7"], target: "missing" },
      {
        parts: ["add-deployment", "two", "--url", "http://127.0.0.1:7"],
        target: "one",
      },
      {
        parts: ["add-deployment", "two", "--url", "http://127.0.0.1:7"],
        target: "missing",
      },
      { parts: ["reset"], target: "two" },
      { parts: ["reset", "--yes"], target: "missing" },
      { parts: ["set", "default", "two"], target: "missing" },
      { parts: ["set", "format", "csv"], target: "two" },
      { parts: ["set", "confirmDangerous", "false"], target: "two" },
    ];
    const protos = prototypeSnapshot();
    for (const { parts, target } of cases) {
      const output = await configResult(
        mode,
        configArgs(position, parts, target),
        true,
      );
      expect(output.stdout).toBe("");
      expect(output.stderr).not.toContain("fake-secret");
      if (
        ["reset", "set"].includes(parts[0]) &&
        !["convex-url", "convex-key"].includes(parts[1])
      )
        expect(output.stderr).toContain("does not support --deployment");
      else
        expect(output.stderr).toMatch(
          /Conflicting deployment targets|not found/,
        );
      expect(files.map((path) => readFileSync(path, "utf-8"))).toEqual(before);
      expect(await loadConfig()).toEqual(config());
      expect(prototypeSnapshot()).toEqual(protos);
    }
    expect(clients).toHaveLength(0);
  },
  20000,
);

it.each(
  executionModes.flatMap((mode) =>
    [
      "constructor",
      "__proto__",
      "prototype",
      "toString",
      "hasOwnProperty",
      "missing",
    ].map((name) => [mode, name] as const),
  ),
)(
  "%s absent alias %s cannot mutate defaults, targets, files or functions",
  async (mode, name) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    writeFileSync(".env.local", "# keep\nOTHER=value\n");
    const files = [join(home, ".cortexrc"), join(cwd, ".env.local")];
    const before = files.map((path) => readFileSync(path, "utf-8"));
    const protos = prototypeSnapshot();
    const cases = [
      ["config", "set", "default", name],
      ["config", "remove-deployment", name, "--yes"],
      ["config", "set-path", name, cwd],
      ["config", "set-key", name, "--key", "fake-secret"],
      ["config", "set-url", name, "--url", "http://127.0.0.1:7"],
      ["config", "set", "convex-key", "fake-secret", "-d", name],
      ["config", "set", "convex-url", "http://127.0.0.1:7", "-d", name],
      ["use", name],
      ["config", "test", "-d", name],
    ];
    for (const args of cases) {
      const output = await configResult(
        mode,
        [...args, "--format", "json"],
        true,
      );
      expect(output.stdout).toBe("");
      expect(output.stderr).toMatch(/Invalid deployment\/app name|not found/);
      expect(output.stderr).not.toContain("fake-secret");
      expect(files.map((path) => readFileSync(path, "utf-8"))).toEqual(before);
      expect(await loadConfig()).toEqual(config());
      expect(existsSync(join(home, ".cortex-current"))).toBe(false);
      expect(prototypeSnapshot()).toEqual(protos);
    }
    expect(clients).toHaveLength(0);
  },
  20000,
);

it.each(executionModes)(
  "%s legitimate owned prototype-style alias works through creation, updates, default/use and removal",
  async (mode) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    const protos = prototypeSnapshot();
    const actions = [
      [
        "config",
        "add-deployment",
        "toString",
        "--url",
        "http://127.0.0.1:8",
        "--json-only",
      ],
      ["config", "set-path", "toString", cwd, "-d", "toString"],
      ["config", "set-key", "toString", "--key", "own-secret", "--json-only"],
      ["config", "set", "default", "toString"],
      ["config", "set", "convex-url", "http://127.0.0.1:9"],
      ["use", "toString"],
      ["config", "set", "default", "one"],
      ["use", "--clear"],
      ["config", "remove-deployment", "toString", "--yes", "--json-only"],
    ];
    for (const args of actions) {
      const output = await configResult(mode, [...args, "--format", "json"]);
      expect(JSON.parse(output.stdout)).toBeDefined();
      expect(output.stdout + output.stderr).not.toContain("own-secret");
      expect(prototypeSnapshot()).toEqual(protos);
    }
    const saved = await loadConfig();
    expect(Object.hasOwn(saved.deployments, "toString")).toBe(false);
    expect(saved.default).toBe("one");
    expect(saved.deployments.one).toEqual(config().deployments.one);
    expect(saved.deployments.two).toEqual(config().deployments.two);
  },
  20000,
);

it.each(executionModes)(
  "%s convex config setters honor scoped/default/singleton fallback and stale defaults fail without writes",
  async (mode) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    await configResult(mode, ["use", "two", "--format", "json"]);
    await configResult(mode, [
      "config",
      "set",
      "convex-key",
      "scoped-secret",
      "--format",
      "json",
    ]);
    expect((await loadConfig()).deployments.two.key).toBe("scoped-secret");
    expect((await loadConfig()).deployments.one).toEqual(
      config().deployments.one,
    );
    await configResult(mode, ["use", "--clear", "--format", "json"]);
    await configResult(mode, [
      "config",
      "set",
      "convex-key",
      "default-secret",
      "--format",
      "json",
    ]);
    expect((await loadConfig()).deployments.one.key).toBe("default-secret");
    for (const name of ["missing", "constructor", "toString"]) {
      const fixture = config();
      fixture.default = name;
      writeFileSync(join(home, ".cortexrc"), JSON.stringify(fixture));
      const before = readFileSync(join(home, ".cortexrc"), "utf-8");
      for (const args of [
        ["config", "set", "convex-key", "fake-secret"],
        ["config", "test"],
      ]) {
        const output = await configResult(
          mode,
          [...args, "--format", "json"],
          true,
        );
        expect(output.stdout).toBe("");
        expect(output.stderr).toMatch(/Invalid deployment\/app name|not found/);
        expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
      }
    }
    const singleton = config();
    delete singleton.deployments.two;
    singleton.default = "";
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(singleton));
    await configResult(mode, [
      "config",
      "set",
      "convex-key",
      "singleton-secret",
      "--format",
      "json",
    ]);
    expect((await loadConfig()).deployments.one.key).toBe("singleton-secret");
    expect(clients).toHaveLength(0);
  },
  20000,
);

it.each(executionModes)(
  "%s unsupported creation aliases fail before files and selector-free global settings/reset remain functional",
  async (mode) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    const before = readFileSync(join(home, ".cortexrc"), "utf-8");
    for (const name of ["constructor", "prototype", "__proto__"]) {
      const output = await configResult(
        mode,
        [
          "config",
          "add-deployment",
          "-d",
          name,
          "--url",
          "http://127.0.0.1:8",
          "--format",
          "json",
        ],
        true,
      );
      expect(output.stdout).toBe("");
      expect(readFileSync(join(home, ".cortexrc"), "utf-8")).toBe(before);
      expect(existsSync(join(cwd, ".env.local"))).toBe(false);
    }
    for (const [key, value] of [
      ["default", "two"],
      ["format", "json"],
      ["confirmDangerous", "false"],
    ]) {
      const output = await configResult(mode, [
        "config",
        "set",
        key,
        value,
        "--format",
        "json",
      ]);
      expect(JSON.parse(output.stdout).updated).toBe(true);
    }
    const readback = await loadConfig();
    expect(readback.default).toBe("two");
    expect(readback.format).toBe("json");
    expect(readback.confirmDangerous).toBe(false);
    expect(readback.deployments).toEqual(config().deployments);
    const reset = await configResult(mode, [
      "config",
      "reset",
      "--yes",
      "--format",
      "json",
    ]);
    expect(JSON.parse(reset.stdout).reset).toBe(true);
    expect((await loadConfig()).deployments).toEqual({});
    expect((await loadConfig()).default).toBe("");
  },
  20000,
);

const envUnrelated =
  '# keep comment\r\nOTHER="first\r\nTWO_CONVEX_DEPLOY_KEY=embedded\r\nTWO_CONVEX_URL=http://unrelated.invalid\r\nlast"\r\nUNRELATED = " edge # value " # keep inline\r\n';
it.each(executionModes)(
  "%s env-mirroring callers normalize duplicates and ordinary loader forms with exact literal readback",
  async (mode) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    const env = join(cwd, ".env.local");
    writeFileSync(
      env,
      envUnrelated +
        "TWO_CONVEX_URL=http://127.0.0.1:2\r\n# duplicate comment\r\n export TWO_CONVEX_URL = http://127.0.0.1:4\r\nTWO_CONVEX_DEPLOY_KEY=old-first\r\n TWO_CONVEX_DEPLOY_KEY: old-last\r\n",
    );
    const key = " literal#key ";
    const update = await configResult(mode, [
      "config",
      "set-key",
      "two",
      "--key",
      key,
      "--format",
      "json",
    ]);
    expect(JSON.parse(update.stdout).hasKey).toBe(true);
    expect(update.stdout + update.stderr).not.toContain(key);
    let raw = readFileSync(env, "utf-8");
    expect(parseDotenv(raw).TWO_CONVEX_URL).toBe("http://127.0.0.1:2");
    expect(parseDotenv(raw).TWO_CONVEX_DEPLOY_KEY).toBe(key);
    expect((await loadConfig()).deployments.two.key).toBe(key);
    expect(raw).toContain(envUnrelated);
    expect(raw).toContain("# duplicate comment\r\n");
    expect(raw).not.toContain("old-first");
    expect(raw).not.toContain("old-last");
    await configResult(mode, [
      "config",
      "set-key",
      "two",
      "--key",
      key,
      "--format",
      "json",
    ]);
    expect(readFileSync(env, "utf-8")).toBe(raw);
    await configResult(mode, [
      "config",
      "set-url",
      "two",
      "--url",
      "http://127.0.0.1:7",
      "--format",
      "json",
    ]);
    raw = readFileSync(env, "utf-8");
    expect(parseDotenv(raw).TWO_CONVEX_URL).toBe("http://127.0.0.1:7");
    expect(Object.hasOwn(parseDotenv(raw), "TWO_CONVEX_DEPLOY_KEY")).toBe(
      false,
    );
    expect((await loadConfig()).deployments.two.key).toBeUndefined();
    expect(raw).toContain(envUnrelated);
    await configResult(mode, [
      "config",
      "remove-deployment",
      "two",
      "--yes",
      "--format",
      "json",
    ]);
    raw = readFileSync(env, "utf-8");
    expect(Object.hasOwn(parseDotenv(raw), "TWO_CONVEX_URL")).toBe(false);
    expect(Object.hasOwn(parseDotenv(raw), "TWO_CONVEX_DEPLOY_KEY")).toBe(
      false,
    );
    expect(raw).toContain(envUnrelated);
    expect((await loadConfig()).deployments.two).toBeUndefined();
    expect(statSync(env).mode & 0o777).toBe(0o600);
    expect((await loadConfig()).deployments.one).toEqual(
      config().deployments.one,
    );
    expect(clients).toHaveLength(0);
  },
  20000,
);

it.each(executionModes)(
  "%s add-deployment normalizes URL/key duplicates; removal clears export/space/colon/local deployment variants",
  async (mode) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    const env = join(cwd, ".env.local");
    const variants =
      "export TWO_CONVEX_URL = http://127.0.0.1:2\n TWO_CONVEX_URL: http://127.0.0.1:4\nexport TWO_CONVEX_DEPLOY_KEY=old\n TWO_CONVEX_DEPLOY_KEY = late-old\n";
    writeFileSync(env, envUnrelated + variants);
    const output = await configResult(mode, [
      "config",
      "add-deployment",
      "two",
      "--url",
      "http://127.0.0.1:8",
      "--key",
      " trailing#literal ",
      "--format",
      "json",
    ]);
    expect(JSON.parse(output.stdout).added).toBe(true);
    let raw = readFileSync(env, "utf-8");
    expect(parseDotenv(raw).TWO_CONVEX_URL).toBe("http://127.0.0.1:8");
    expect(parseDotenv(raw).TWO_CONVEX_DEPLOY_KEY).toBe(" trailing#literal ");
    expect((await loadConfig()).deployments.two.key).toBe(" trailing#literal ");
    expect(raw).toContain(envUnrelated);
    expect(raw).not.toContain("late-old");
    writeFileSync(env, envUnrelated + variants);
    await configResult(mode, [
      "config",
      "remove-deployment",
      "two",
      "--yes",
      "--format",
      "json",
    ]);
    raw = readFileSync(env, "utf-8");
    expect(Object.hasOwn(parseDotenv(raw), "TWO_CONVEX_URL")).toBe(false);
    expect(Object.hasOwn(parseDotenv(raw), "TWO_CONVEX_DEPLOY_KEY")).toBe(
      false,
    );
    expect(raw).toContain(envUnrelated);
    await configResult(mode, [
      "config",
      "add-deployment",
      "local",
      "--url",
      "http://127.0.0.1:9",
      "--json-only",
      "--format",
      "json",
    ]);
    writeFileSync(
      env,
      envUnrelated +
        "export LOCAL_CONVEX_URL = http://127.0.0.1:9\nLOCAL_CONVEX_DEPLOY_KEY: stale\n LOCAL_CONVEX_DEPLOYMENT = anonymous:fixture\n",
    );
    await configResult(mode, [
      "config",
      "remove-deployment",
      "local",
      "--yes",
      "--format",
      "json",
    ]);
    raw = readFileSync(env, "utf-8");
    for (const key of [
      "LOCAL_CONVEX_URL",
      "LOCAL_CONVEX_DEPLOY_KEY",
      "LOCAL_CONVEX_DEPLOYMENT",
    ])
      expect(Object.hasOwn(parseDotenv(raw), key)).toBe(false);
    expect(raw).toContain(envUnrelated);
    expect(clients).toHaveLength(0);
  },
  20000,
);

it.each(executionModes)(
  "%s unsupported literal encoding uniformly refuses before config/env/current writes",
  async (mode) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    writeFileSync(
      ".env.local",
      envUnrelated +
        "TWO_CONVEX_URL=http://127.0.0.1:2\nTWO_CONVEX_DEPLOY_KEY=old\n",
    );
    await configResult(mode, ["use", "two", "--format", "json"]);
    const files = [
      join(home, ".cortexrc"),
      join(cwd, ".env.local"),
      join(home, ".cortex-current"),
    ];
    const before = files.map((path) => readFileSync(path, "utf-8"));
    const key = "bad'\"`#literal";
    for (const args of [
      ["config", "set-key", "two", "--key", key],
      ["config", "set-key", "two", "--key", key, "--json-only"],
      [
        "config",
        "add-deployment",
        "new",
        "--url",
        "http://127.0.0.1:7",
        "--key",
        key,
        "--default",
      ],
      [
        "config",
        "add-deployment",
        "new",
        "--url",
        "http://127.0.0.1:7",
        "--key",
        key,
        "--json-only",
      ],
      ["config", "set", "convex-key", key, "-d", "two"],
    ]) {
      const output = await configResult(
        mode,
        [...args, "--format", "json"],
        true,
      );
      expect(output.stdout).toBe("");
      expect(output.stderr).toContain(
        "Cannot save environment value literally",
      );
      expect(output.stderr).not.toContain(key);
      expect(files.map((path) => readFileSync(path, "utf-8"))).toEqual(before);
      expect(await loadConfig()).toEqual(config());
    }
    const existing = config();
    existing.deployments.two.key = key;
    writeFileSync(files[0], JSON.stringify(existing));
    // Even a same-endpoint set-url must preflight the existing credential before touching files.
    const ownedBefore = readFileSync(files[0], "utf-8");
    const failed = await configResult(
      mode,
      [
        "config",
        "set-url",
        "two",
        "--url",
        "http://127.0.0.1:2/",
        "--format",
        "json",
      ],
      true,
    );
    expect(failed.stderr).toContain("Cannot save environment value literally");
    expect(readFileSync(files[0], "utf-8")).toBe(ownedBefore);
    expect(readFileSync(files[1], "utf-8")).toBe(before[1]);
    const globalFailed = await configResult(
      mode,
      [
        "config",
        "set",
        "convex-url",
        "http://127.0.0.1:2/",
        "-d",
        "two",
        "--format",
        "json",
      ],
      true,
    );
    expect(globalFailed.stderr).toContain(
      "Cannot save environment value literally",
    );
    expect(readFileSync(files[0], "utf-8")).toBe(ownedBefore);
    expect(readFileSync(files[1], "utf-8")).toBe(before[1]);
    for (const args of [
      ["config", "set-key", "two", "--key", "mixed'\"`#line\nbreak"],
      ["config", "set", "convex-key", "mixed'\"`#line\nbreak", "-d", "two"],
    ]) {
      const result = await configResult(
        mode,
        [...args, "--format", "json"],
        true,
      );
      expect(result.stdout).toBe("");
      expect(readFileSync(files[0], "utf-8")).toBe(ownedBefore);
      expect(readFileSync(files[1], "utf-8")).toBe(before[1]);
      expect(readFileSync(files[2], "utf-8")).toBe(before[2]);
    }
    expect(clients).toHaveLength(0);
  },
  20000,
);

it.each(mutationPositions)(
  "built startup and action debug respect quiet at %s with owned env fixture",
  async (position) => {
    writeFileSync(join(home, ".cortexrc"), JSON.stringify(config()));
    writeFileSync(".env.local", "# owned debug fixture\nOTHER=value\n");
    const path = join(cwd, ".env.local");
    const before = readFileSync(path, "utf-8");
    let args =
      position === "root"
        ? ["--debug", "--quiet", "config", "path"]
        : position === "group"
          ? ["config", "--debug", "--quiet", "path"]
          : ["config", "path", "--debug", "--quiet"];
    const result = await runActualCLI(
      binary.entry,
      [...args, "--format", "json"],
      home,
      cwd,
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).projectEnv).toBe(realpathSync(path));
    expect(result.stderr).toBe("");
    const noisy = await runActualCLI(
      binary.entry,
      ["--debug", "config", "path", "--format", "json"],
      home,
      cwd,
    );
    expect(noisy.status).toBe(0);
    expect(noisy.stderr).toContain("Loaded project environment");
    expect(noisy.stderr).toContain("[DEBUG]");
    expect(readFileSync(path, "utf-8")).toBe(before);
  },
);
