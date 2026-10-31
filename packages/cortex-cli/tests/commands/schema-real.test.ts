import { it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  realpathSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { captureConsole, preventCommandExit } from "../helpers/cli-test-utils.js";
const actualOs = await import("os");
jest.unstable_mockModule("os", () => ({
  ...actualOs,
  homedir: () => process.env.HOME!,
}));
const { createProgram } = await import("../../src/program.js");
const { loadConfig } = await import("../../src/utils/config.js");
let root: string,
  cwd: string,
  home: string,
  oldCwd: string,
  oldHome: string | undefined,
  fetchBefore: typeof fetch;
const hash = "a".repeat(64),
  ready = {
    version: 1,
    state: "ready",
    ready: true,
    generation: "owned-generation",
    writerManifestHash: hash,
    expectedWriterManifestHash: hash,
    backfill: null,
    validation: null,
  };
const requests: Array<{
  url: string;
  path: string;
  authorization: string | null;
}> = [];
let response: unknown = ready;
beforeEach(() => {
  oldCwd = process.cwd();
  oldHome = process.env.HOME;
  root = realpathSync(mkdtempSync(join(tmpdir(), "task23-schema-real-")));
  cwd = join(root, "project");
  home = join(root, "home");
  mkdirSync(cwd);
  mkdirSync(home);
  process.chdir(cwd);
  process.env.HOME = home;
  requests.length = 0;
  process.exitCode = 0;
  fetchBefore = globalThis.fetch;
  globalThis.fetch = (async (u: unknown, o?: RequestInit) => {
    const body = JSON.parse(String(o?.body));
    requests.push({
      url: String(u),
      path: body.path,
      authorization: new Headers(o?.headers).get("Authorization"),
    });
    return new Response(
      JSON.stringify({
        status: "success",
        value: body.path.endsWith(":planPage")
          ? {
              version: 1,
              executed: false,
              ready: false,
              table: "attachments",
              rows: 1,
              storageOccurrences: 1,
              done: true,
              nextCursor: null,
            }
          : response,
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  response = ready;
});
afterEach(() => {
  globalThis.fetch = fetchBefore;
  process.chdir(oldCwd);
  if (oldHome === undefined) delete process.env.HOME;
  else process.env.HOME = oldHome;
  process.exitCode = 0;
  rmSync(root, { recursive: true, force: true });
});
function config(key = "fixture-key") {
  writeFileSync(
    join(home, ".cortexrc"),
    JSON.stringify({
      deployments: {
        one: { url: "http://127.0.0.1:1", key, type: "local" },
        two: {
          url: "http://127.0.0.1:2",
          key: "second-fixture-key",
          type: "local",
        },
      },
      default: "one",
      format: "table",
      confirmDangerous: true,
    }),
  );
}
async function invoke(args: string[]) {
  const out = captureConsole();
  try {
    await preventCommandExit(createProgram(await loadConfig()))
      .parseAsync(args, { from: "user" });
    return out.output;
  } finally {
    out.restore();
  }
}
it("real registry exposes fixed maintenance leaves/options without changing status/sync", async () => {
  const p = createProgram(await loadConfig()),
    schema = p.commands.find((c) => c.name() === "schema")!;
  expect(schema.commands.map((c) => c.name())).toEqual([
    "status",
    "sync",
    "references",
    "migrate",
  ]);
  for (const name of ["references", "migrate"]) {
    const leaf = schema.commands.find((c) => c.name() === name)!;
    expect(leaf.registeredArguments).toHaveLength(0);
    expect(leaf.options.map((o) => o.long)).toEqual(
      expect.arrayContaining(["--deployment", "--format", "--quiet"]),
    );
    expect(leaf.options.some((o) => o.long === "--overwrite")).toBe(false);
  }
  expect(requests).toHaveLength(0);
});
it.each([
  ["-d", "two", "--format", "json", "schema", "references"],
  ["schema", "references", "-d", "two", "--format", "json"],
  ["schema", "-d", "two", "references", "--format", "json"],
])(
  "real createProgram honors selected deployment and JSON at every placement %j",
  async (...args) => {
    config();
    const out = await invoke(args as string[]);
    expect(out.logs).toHaveLength(1);
    expect(JSON.parse(out.logs[0])).toMatchObject({
      executed: false,
      ready: true,
      state: "ready",
    });
    expect(requests).toEqual([
      {
        url: "http://127.0.0.1:2/api/query",
        path: "referenceMaintenance:status",
        authorization: "Convex second-fixture-key",
      },
    ]);
    expect(process.exitCode).toBe(0);
  },
);
it("closest explicit selection survives a conflicting root option", async () => {
  config();
  await invoke([
    "-d",
    "one",
    "schema",
    "references",
    "-d",
    "two",
    "-f",
    "json",
  ]);
  expect(requests[0].url).toBe("http://127.0.0.1:2/api/query");
});
it("quiet JSON remains one payload and listeners are restored", async () => {
  config();
  const before = [
    process.listenerCount("SIGINT"),
    process.listenerCount("SIGTERM"),
  ];
  const out = await invoke(["schema", "references", "--quiet", "-f", "json"]);
  expect(out.logs).toHaveLength(1);
  expect(out.errors).toHaveLength(0);
  expect([
    process.listenerCount("SIGINT"),
    process.listenerCount("SIGTERM"),
  ]).toEqual(before);
});
it("nonready references is a truthful nonzero structured result", async () => {
  config();
  response = { ...ready, state: "building", ready: false };
  const out = await invoke(["schema", "references", "-f", "json"]);
  expect(JSON.parse(out.logs[0])).toMatchObject({
    ready: false,
    state: "building",
  });
  expect(process.exitCode).toBe(1);
});
it("dry-run uses queries only, leaves configuration exact and reports executable nonready plan", async () => {
  config();
  response = { ...ready, state: "building", ready: false };
  const before = readFileSync(join(home, ".cortexrc"));
  const out = await invoke([
    "schema",
    "migrate",
    "--dry-run",
    "--quiet",
    "-f",
    "json",
  ]);
  expect(JSON.parse(out.logs[0])).toMatchObject({
    ready: false,
    executed: false,
    plan: { attachments: { rows: 1, storageOccurrences: 1 } },
  });
  expect(requests.map((r) => r.path)).toEqual([
    "referenceMaintenance:status",
    "referenceMaintenance:planPage",
  ]);
  expect(requests.every((r) => r.url.endsWith("/api/query"))).toBe(true);
  expect(readFileSync(join(home, ".cortexrc"))).toEqual(before);
  expect(process.exitCode).toBe(0);
});
it("invalid output is refused before request/configuration handler", async () => {
  const program = preventCommandExit(createProgram(await loadConfig()));
  await expect(
    program.parseAsync(["schema", "migrate", "--format", "invalid"], {
      from: "user",
    }),
  ).rejects.toThrow(/Invalid output format/);
  expect(requests).toHaveLength(0);
});
it("missing explicit key refuses before network with sanitized JSON", async () => {
  config();
  const path = join(home, ".cortexrc"),
    valid = JSON.parse(readFileSync(path, "utf8"));
  delete valid.deployments.one.key;
  writeFileSync(path, JSON.stringify(valid));
  const out = await invoke(["schema", "references", "-f", "json"]);
  expect(JSON.parse(out.logs[0]).error).toMatch(/KEY_REQUIRED|CONFIGURATION/);
  expect(requests).toHaveLength(0);
  expect(process.exitCode).toBe(1);
});
it("CSV emits one stable terminal projection", async () => {
  config();
  const out = await invoke(["schema", "references", "-f", "csv"]);
  expect(out.logs).toHaveLength(1);
  expect(out.logs[0]).toContain(
    "operation,executed,ready,state,generation,error,resumable",
  );
  expect(out.logs[0]).not.toContain("fixture-key");
});
