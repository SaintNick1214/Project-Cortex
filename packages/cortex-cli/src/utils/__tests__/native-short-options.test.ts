/** Baseline aliases exercised through actual registration and emitted CLI actions. */
import {
  beforeAll,
  afterAll,
  afterEach,
  expect,
  it,
  jest,
} from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import type { CLIConfig } from "../../types.js";
import { createProgram } from "../../program.js";

let root: string;
let config: CLIConfig;
let server: http.Server;
let requests = 0;
const entry = fileURLToPath(new URL("../../../dist/index.js", import.meta.url));
const configFile = () => path.join(root, "cortex.config.json");
const journal = () => path.join(root, "native-journal.jsonl");
const records = (): unknown[] =>
  fs.existsSync(journal())
    ? fs
        .readFileSync(journal(), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
const clear = (): void => {
  fs.rmSync(journal(), { force: true });
  requests = 0;
};
function leaf(program: Command, names: string[]): Command {
  return names.reduce((command, name) => {
    const child = command.commands.find((item) => item.name() === name);
    if (!child) throw new Error(`Missing registered command ${name}`);
    return child;
  }, program);
}
beforeAll(async () => {
  if (
    !process.env.CORTEX_TEST_HOME_ROOT ||
    fs.realpathSync(os.homedir()) !==
      fs.realpathSync(process.env.CORTEX_TEST_HOME_ROOT)
  )
    throw new Error("External HOME must precede imports");
  root = fs.mkdtempSync(path.join(os.homedir(), "native-short-options-"));
  server = http.createServer((req, res) => {
    requests++;
    expect(req.url).toBe("/api/stream_function_logs?cursor=0");
    expect(req.headers.authorization).toBe("Convex synthetic-compat-key");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        newCursor: 2,
        entries: ["first", "second"].map((message) => ({
          kind: "Progress",
          identifier: "probe:compat",
          udfType: "Action",
          timestamp: 1,
          logLines: [
            {
              messages: [message],
              level: "LOG",
              timestamp: 1,
              isTruncated: false,
            },
          ],
          requestId: message,
          executionId: message,
        })),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Own HTTP listener absent");
  fs.mkdirSync(path.join(root, "node_modules/convex/bin"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    '{"name":"compat","version":"1.0.0","packageManager":"npm@11.19.1"}',
  );
  fs.writeFileSync(
    path.join(root, "node_modules/convex/package.json"),
    '{"name":"convex","version":"1.46.0","type":"module","bin":{"convex":"bin/main.js"}}',
  );
  fs.writeFileSync(
    path.join(root, "node_modules/convex/bin/main.js"),
    `import fs from 'node:fs';const argv=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(journal())},JSON.stringify({argv,cwd:process.cwd(),deployment:process.env.CONVEX_DEPLOYMENT??null,authorityMatches:['local:anonymous-compat','prod:compat'].includes(process.env.CONVEX_DEPLOYMENT)||(process.env.CONVEX_SELF_HOSTED_ADMIN_KEY||process.env.CONVEX_DEPLOY_KEY||'').endsWith('synthetic-compat-key')})+'\\n');console.log(argv[0]==='dashboard'?'http://127.0.0.1:${address.port}/dashboard':JSON.stringify({argv}));`,
  );
  fs.mkdirSync(path.join(root, ".convex/local/default"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".convex/local/default/config.json"),
    JSON.stringify({
      deploymentName: "anonymous-compat",
      adminKey: "synthetic-compat-key",
      ports: { cloud: address.port, site: 1 },
    }),
    { mode: 0o600 },
  );
  config = {
    deployments: {
      local: {
        projectPath: root,
        url: `http://127.0.0.1:${address.port}`,
        deployment: "local:anonymous-compat",
        key: "synthetic-compat-key",
      },
      prod: {
        projectPath: root,
        url: "https://compat.convex.cloud",
        deployment: "prod:compat",
        key: "prod:compat|synthetic-compat-key",
      },
    },
    default: "local",
    format: "table",
    confirmDangerous: true,
  };
  fs.writeFileSync(configFile(), JSON.stringify(config), { mode: 0o600 });
  if (!fs.existsSync(entry))
    throw new Error("Build emitted CLI before running these tests");
});
afterEach(() => {
  jest.restoreAllMocks();
  process.exitCode = 0;
  clear();
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(root, { recursive: true, force: true });
});

const ownership: Array<[string[], string, string]> = [
  [["start"], "local", "-l"],
  [["dev"], "local", "-l"],
  [["deploy"], "local", "-l"],
  [["deploy"], "prod", "-p"],
  [["convex", "deploy"], "local", "-l"],
  [["convex", "deploy"], "prod", "-p"],
  [["convex", "dev"], "local", "-l"],
  [["convex", "logs"], "local", "-l"],
  [["convex", "logs"], "prod", "-p"],
  [["convex", "logs"], "lines", "-n"],
  [["convex", "logs"], "tail", "-t"],
  [["convex", "dashboard"], "local", "-l"],
  [["convex", "dashboard"], "prod", "-p"],
  [["convex", "env"], "list", "-l"],
  [["convex", "env"], "set", "-s"],
  [["convex", "env"], "prod", "-p"],
  [["update"], "app", "-a"],
  [["convex", "update"], "app", "-a"],
  [["start"], "foreground", "-f"],
];
it.each(ownership)(
  "restores actual option ownership %j %s=%s",
  (names, attribute, short) => {
    const command = leaf(createProgram(config), names);
    expect(
      command.options.find((option) => option.attributeName() === attribute)
        ?.short,
    ).toBe(short);
    expect(
      command.options.filter((option) => option.short === short),
    ).toHaveLength(1);
  },
);
it("does not give local/prod short aliases to leaves without baseline ownership", () => {
  for (const names of [
    ["update"],
    ["convex", "update"],
    ["convex", "status"],
    ["convex", "env", "set"],
    ["db", "export"],
  ]) {
    const command = leaf(createProgram(config), names);
    expect(
      command.options.find((option) => option.attributeName() === "local")
        ?.short,
    ).toBeUndefined();
    expect(
      command.options.find((option) => option.attributeName() === "prod")
        ?.short,
    ).toBeUndefined();
  }
  expect(
    leaf(createProgram(config), ["convex", "env"]).options.find(
      (option) => option.attributeName() === "local",
    )?.short,
  ).toBeUndefined();
});
it.each([
  [
    ["-f", "csv", "start", "-f", "--format", "json"],
    { foreground: true, format: "json" },
  ],
  [["-f", "csv", "start", "-f"], { foreground: true, format: "csv" }],
  [["convex", "env", "-l", "--local"], { list: true, local: true }],
  [
    ["-d", "prod", "convex", "env", "-l", "-p"],
    { list: true, prod: true, deployment: "prod" },
  ],
])(
  "registry action preserves root/leaf collisions %j",
  async (args, expected) => {
    const program = createProgram(config).exitOverride();
    let seen: unknown;
    const names = args.includes("start") ? ["start"] : ["convex", "env"];
    leaf(program, names).action((options: unknown) => {
      seen = options;
    });
    await program.parseAsync(["node", "cortex", ...args]);
    expect(seen).toMatchObject(expected);
    expect(records()).toEqual([]);
    expect(requests).toBe(0);
  },
);
async function binary(args: string[]): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
  records: unknown[];
  requests: number;
}> {
  clear();
  const child = spawn(process.execPath, [entry, "-d", "local", ...args], {
    cwd: root,
    env: { HOME: os.homedir(), PATH: process.env.PATH ?? "", NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const out: Buffer[] = [],
    err: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
  const timeout = setTimeout(() => child.kill("SIGKILL"), 12000);
  try {
    const status = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    return {
      status,
      stdout: Buffer.concat(out).toString(),
      stderr: Buffer.concat(err).toString(),
      records: records(),
      requests,
    };
  } finally {
    clearTimeout(timeout);
  }
}
const equivalent: Array<[string[], string[], string[] | null]> = [
  [
    ["dev", "-l", "--once"],
    ["dev", "--local", "--once"],
    ["dev", "--once"],
  ],
  [
    ["start", "-l", "-f", "--once"],
    ["start", "--local", "--foreground", "--once"],
    ["dev", "--once"],
  ],
  [
    ["convex", "dev", "-l", "--once"],
    ["convex", "dev", "--local", "--once"],
    ["dev", "--once"],
  ],
  [["deploy", "-l", "--dry-run"], ["deploy", "--local", "--dry-run"], null],
  [
    ["convex", "deploy", "-l", "--dry-run"],
    ["convex", "deploy", "--local", "--dry-run"],
    null,
  ],
  [
    ["deploy", "-d", "prod", "-p", "--dry-run"],
    ["deploy", "-d", "prod", "--prod", "--dry-run"],
    ["deploy", "--yes", "--dry-run"],
  ],
  [
    ["convex", "deploy", "-d", "prod", "-p", "--dry-run"],
    ["convex", "deploy", "-d", "prod", "--prod", "--dry-run"],
    ["deploy", "--yes", "--dry-run"],
  ],
  [
    ["convex", "logs", "-l", "-n", "1", "-t"],
    ["convex", "logs", "--local", "--lines", "1", "--tail"],
    ["logs", "--history", "1"],
  ],
  [
    ["convex", "logs", "-d", "prod", "-p", "-n", "2", "-t"],
    ["convex", "logs", "-d", "prod", "--prod", "--lines", "2", "--tail"],
    ["logs", "--history", "2"],
  ],
  [
    ["convex", "logs", "-l", "-n", "1", "--format", "json"],
    ["convex", "logs", "--local", "--lines", "1", "--format", "json"],
    null,
  ],
  [
    ["convex", "dashboard", "-l", "--print-url"],
    ["convex", "dashboard", "--local", "--print-url"],
    ["dashboard", "--no-open"],
  ],
  [
    ["convex", "dashboard", "-d", "prod", "-p", "--print-url"],
    ["convex", "dashboard", "-d", "prod", "--prod", "--print-url"],
    ["dashboard", "--no-open"],
  ],
  [
    ["convex", "env", "-l"],
    ["convex", "env", "--list"],
    ["env", "list", "--names-only"],
  ],
  [
    ["convex", "env", "-s", "TOKEN=a=b;世界"],
    ["convex", "env", "--set", "TOKEN=a=b;世界"],
    ["env", "set", "TOKEN", "a=b;世界"],
  ],
  [
    ["convex", "env", "-d", "prod", "-p", "-l"],
    ["convex", "env", "-d", "prod", "--prod", "--list"],
    ["env", "list", "--names-only"],
  ],
  [
    ["-f", "csv", "start", "-f", "-l", "--once", "--format", "json"],
    [
      "--format",
      "csv",
      "start",
      "--foreground",
      "--local",
      "--once",
      "--format",
      "json",
    ],
    ["dev", "--once"],
  ],
];
it.each(equivalent)(
  "emitted CLI short/long actions agree: %j",
  async (short, long, argv) => {
    const a = await binary(short),
      b = await binary(long);
    expect({ status: a.status, stderr: a.stderr }).toMatchObject({ status: 0 });
    expect(b.status).toBe(0);
    expect(a).toEqual(b);
    if (argv)
      expect(a.records).toEqual([
        expect.objectContaining({ argv, cwd: root, authorityMatches: true }),
      ]);
    else expect(a.records).toEqual([]);
    if (short.includes("logs") && !short.includes("-t")) {
      expect(a.requests).toBe(1);
      expect(JSON.parse(a.stdout)).toMatchObject({ requested: 1, returned: 1 });
      expect(JSON.parse(a.stdout).entries[0].logLines[0].messages).toEqual([
        "second",
      ]);
    } else expect(a.requests).toBe(0);
  },
);
it.each([
  [
    ["update", "-a", "legacy"],
    /App\/bulk\/template update options are retired/,
  ],
  [
    ["convex", "update", "-a", "legacy"],
    /App\/bulk\/template update options are retired/,
  ],
  [["start", "-f", "--graph-only"], /--convex-only\/--graph-only are retired/],
  [["convex", "env", "-l", "-s", "TOKEN=x"], /mutually exclusive/],
  [["convex", "env", "-s", "bad"], /NAME=value/],
  [["convex", "logs", "-n", "0"], /positive integer|integer from/],
  [["convex", "logs", "-n", "1001"], /integer from|Limit cannot exceed/],
  [["deploy", "-p", "--dry-run"], /--prod conflicts/],
  [["dev", "-l", "-d", "prod", "--once"], /--local conflicts/],
  [["start", "-f", "--format", "invalid"], /Invalid output format/],
])(
  "invalid/retired short flags fail before effects: %j",
  async (args, message) => {
    const before = fs.readFileSync(configFile());
    const result = await binary(args);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(result.stdout).toBe("");
    expect(result.records).toEqual([]);
    expect(result.requests).toBe(0);
    expect(fs.readFileSync(configFile())).toEqual(before);
  },
);
