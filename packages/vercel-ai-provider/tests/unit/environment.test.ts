import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as path from "node:path";
import ts from "typescript";

const providerSetup = readFileSync(resolve(__dirname, "../helpers/setup.ts"), "utf8");
const demoConfig = readFileSync(resolve(__dirname, "../../quickstart/jest.config.js"), "utf8");

function runProvider(env: Record<string, string>) {
  const calls: string[] = [];
  const output = ts.transpileModule(providerSetup, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(output, {
    exports: {},
    __dirname: "/isolated-provider/tests/helpers",
    process: { env, cwd: () => "/isolated-provider" },
    require: (name: string) => {
      if (name === "path") return path;
      if (name === "dotenv") return { config: ({ path: filename }: { path: string }) => { calls.push(filename); } };
      throw new Error(`Unexpected setup dependency: ${name}`);
    },
  });
  return calls;
}

function runDemo(env: Record<string, string>) {
  const calls: string[] = [];
  const loaded: { exports?: unknown } = {};
  runInNewContext(demoConfig, {
    module: loaded,
    __dirname: "/isolated-demo",
    process: { env, loadEnvFile: (filename: string) => { calls.push(filename); } },
    require: (name: string) => {
      if (name === "node:fs") return { existsSync: () => true };
      if (name === "node:path") return path;
      if (name === "./tsconfig.json") return { compilerOptions: { strict: true } };
      throw new Error(`Unexpected config dependency: ${name}`);
    },
  });
  expect(loaded.exports).toHaveProperty("projects");
  return calls;
}

for (const [name, env] of [
  ["CI", { CI: "true" }],
  ["explicit environment", { CORTEX_TEST_ENV_MODE: "explicit" }],
] as const) {
  it(`provider ${name} selection never invokes a local or parent env loader`, () => {
    expect(runProvider({ ...env, CONVEX_URL: "https://verified-selector.invalid" })).toEqual([]);
  });
  it(`demo ${name} selection ignores even an existing local env file`, () => {
    expect(runDemo({ ...env, CONVEX_URL: "https://verified-selector.invalid" })).toEqual([]);
  });
}

it("provider ordinary local setup retains all six existing env lookup paths", () => {
  expect(runProvider({ CI: "false" })).toEqual([
    "/isolated-provider/tests/helpers/.env.local",
    "/isolated-provider/tests/helpers/.env",
    "/isolated-provider/.env.local",
    "/isolated-provider/.env",
    "/.env.local",
    "/.env",
  ]);
});

it("demo ordinary local config retains its existing env-file loader", () => {
  expect(runDemo({ CI: "false" })).toEqual(["/isolated-demo/.env.local"]);
});
