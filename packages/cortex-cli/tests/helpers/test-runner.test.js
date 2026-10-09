import { afterEach, expect, it } from "@jest/globals";
import fs from "node:fs";
import process from "node:process";
import { mkdtemp, readFile, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { runCliTests, testEnvironment } from "../../scripts/test-runner.js";
import {
  cliTestTarget,
  cliTestCredentials,
  configureCliTestEnvironment,
} from "./test-environment.js";

const roots = [],
  helpers = dirname(fileURLToPath(import.meta.url));
const ts = createRequire(import.meta.url)("typescript");
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "cortex-runner-control-"));
  roots.push(root);
  await mkdir(join(root, "helpers"));
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await writeFile(
    join(root, "helpers/test-environment.js"),
    await readFile(join(helpers, "test-environment.js")),
  );
  for (const [name, source] of [
    ["offline", join(helpers, "../env.ts")],
    ["live", join(helpers, "live-env.ts")],
  ]) {
    const text = ts.transpileModule(await readFile(source, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
    await writeFile(
      join(root, name + ".js"),
      name === "live"
        ? text.replace(
            '"./test-environment.js"',
            '"./helpers/test-environment.js"',
          )
        : text,
    );
  }
  const entry = join(root, "probe.mjs"),
    trace = join(root, "trace.json");
  await writeFile(
    entry,
    `import fs from 'node:fs'; import path from 'node:path';
const args=process.argv.slice(2), trace=args[args.indexOf('--trace')+1], module=args[args.indexOf('--environment-module')+1];
const opens=[]; for(const name of ['readFileSync','openSync']) {const original=fs[name]; fs[name]=function(file,...rest){if(/(?:^|\\/)\\.env(?:\\.|$)/.test(String(file))){opens.push(String(file));throw new Error('ENV_OPEN_REFUSED');}return original.call(this,file,...rest);};}
await import(module);
const data={environment:process.env, args, envOpens:opens, homeMode:fs.statSync(process.env.HOME).mode&511, bootstrapMode:fs.statSync(process.env.CORTEX_BOOTSTRAP_PROOF_ROOT).mode&511, bootstrapRealpath:fs.realpathSync(process.env.CORTEX_BOOTSTRAP_PROOF_ROOT)};
fs.writeFileSync(trace,JSON.stringify(data));
if(args.includes('--wait')){process.on('SIGTERM',()=>{fs.writeFileSync(trace,JSON.stringify({...data,signal:'SIGTERM',homeExistedDuringSignal:fs.existsSync(process.env.HOME)}));setTimeout(()=>{fs.writeFileSync(trace,JSON.stringify({...data,joinedChildDone:true,homeExistedBeforeExit:fs.existsSync(process.env.HOME)}));process.exit(0);},30);});setInterval(()=>{},1000);}else {const index=args.indexOf('--status');process.exitCode=index<0?0:Number(args[index+1]);}
`,
  );
  return {
    root,
    entry,
    trace,
    module: pathToFileURL(join(root, "offline.js")).href,
  };
}
const canaries = {
  HOME: "/inherited-home-canary",
  CONVEX_URL: "https://generic.invalid",
  CONVEX_URL_CLI: "https://dedicated.invalid",
  LOCAL_CONVEX_URL: "http://127.0.0.1:9",
  CLOUD_CONVEX_URL: "https://cloud.invalid",
  CONVEX_DEPLOYMENT: "dev:canary",
  CONVEX_DEPLOY_KEY: "synthetic-deploy-canary",
  OPENAI_API_KEY: "synthetic-llm-canary",
  NEO4J_PASSWORD: "synthetic-graph-canary",
  MEMGRAPH_PASSWORD: "synthetic-other-graph-canary",
  DOTENV_CONFIG_PATH: "/never-open.env",
  NODE_OPTIONS: "--import=/never-import.mjs",
};
it.each([
  undefined,
  "",
  " ",
  "https://user:synthetic@example.com",
  "https://x.invalid/path",
  "https://x.invalid?q=1",
  "https://x.invalid/#fragment",
  "file:///tmp",
  "not-url",
])(
  "refuses invalid/missing explicit target %j without generic fallback",
  (value) => {
    expect(() =>
      cliTestTarget({
        CONVEX_URL_CLI: value,
        CONVEX_URL: "https://fallback.invalid",
      }),
    ).toThrow("CONVEX_URL_CLI");
  },
);
it("uses only the explicit valid target, and offline setup removes targets", () => {
  const env = { ...canaries, CONVEX_URL_CLI: "http://127.0.0.1:3217", CORTEX_TEST_EXPECTED_CONVEX_URL: "http://127.0.0.1:3217" };
  configureCliTestEnvironment(env, true);
  expect(env.CONVEX_URL).toBe("http://127.0.0.1:3217");
  expect(env.CONVEX_DEPLOYMENT_TYPE).toBe("local");
  expect(env.LOCAL_CONVEX_URL).toBeUndefined();
  expect(env.CONVEX_DEPLOY_KEY).toBe(canaries.CONVEX_DEPLOY_KEY);
  configureCliTestEnvironment(env);
  expect(env.CONVEX_URL).toBeUndefined();
  expect(env.CONVEX_URL_CLI).toBeUndefined();
  expect(env.CONVEX_DEPLOY_KEY).toBeUndefined();
});
it.each([
  {},
  { CORTEX_TEST_EXPECTED_CONVEX_URL: "https://other.invalid", CONVEX_DEPLOY_KEY: "synthetic-test-key" },
  { CORTEX_TEST_EXPECTED_CONVEX_URL: "http://127.0.0.1:3217" },
  { CORTEX_TEST_EXPECTED_CONVEX_URL: "http://127.0.0.1:3217", CONVEX_DEPLOY_KEY: "\nsynthetic-test-key" },
])("refuses unqualified live administrative credentials before creating a child %j", async (selection) => {
  const f = await fixture();
  const environment = { CONVEX_URL_CLI: "http://127.0.0.1:3217", ...selection };
  expect(() => cliTestCredentials(environment)).toThrow("CONVEX_DEPLOY_KEY");
  await expect(runCliTests("e2e", ["--trace", f.trace], { environment, jestEntry: f.entry, stdio: "ignore" })).rejects.toThrow("CONVEX_DEPLOY_KEY");
  expect(fs.existsSync(f.trace)).toBe(false);
});
it("drops inherited target/credential/preload canaries and keeps only explicit public tool inputs", () => {
  const env = testEnvironment(
    { ...canaries, CORTEX_BOOTSTRAP_NPM_ROOT: "/public-tool" },
    "/owned-root",
    false,
  );
  for (const name of Object.keys(canaries).filter((name) => name !== "HOME"))
    expect(env[name]).toBeUndefined();
  expect(env.HOME).toBe("/owned-root/home");
  expect(env.CORTEX_TEST_HOME_ROOT).toBe(env.HOME);
  expect(env.CORTEX_BOOTSTRAP_NPM_ROOT).toBe("/public-tool");
});
it.each([0, 7])(
  "sets fresh private HOME before actual setup imports, joins exit%s and cleans owned roots",
  async (status) => {
    const f = await fixture();
    const result = await runCliTests(
      "unit",
      [
        "--trace",
        f.trace,
        "--status",
        String(status),
        "--environment-module",
        f.module,
      ],
      { environment: canaries, jestEntry: f.entry, stdio: "ignore" },
    );
    expect(result).toBe(status);
    const observation = JSON.parse(await readFile(f.trace, "utf8"));
    expect(observation.homeMode).toBe(0o700);
    expect(observation.bootstrapMode).toBe(0o700);
    expect(observation.envOpens).toEqual([]);
    expect(observation.environment.HOME).not.toBe(canaries.HOME);
    expect(observation.environment.CORTEX_TEST_HOME_ROOT).toBe(
      observation.environment.HOME,
    );
    for (const name of Object.keys(canaries).filter((name) => name !== "HOME"))
      expect(observation.environment[name]).toBeUndefined();
    expect(observation.args).not.toContain("--forceExit");
    expect(fs.existsSync(dirname(observation.environment.HOME))).toBe(false);
  },
);
it("refuses live startup and forceExit before spawning a child", async () => {
  const f = await fixture();
  for (const mode of ["all", "e2e"])
    await expect(
      runCliTests(mode, ["--trace", f.trace], {
        environment: { CONVEX_URL: "https://fallback.invalid" },
        jestEntry: f.entry,
      }),
    ).rejects.toThrow("CONVEX_URL_CLI");
  for (const flag of ["--forceExit", "--force-exit", "-c", "--select-projects"])
    await expect(
      runCliTests("unit", [flag], { jestEntry: f.entry }),
    ).rejects.toThrow("forceExit");
  expect(fs.existsSync(f.trace)).toBe(false);
});
it("live setup rejects a malformed dedicated target before any test/service module is admitted", async () => {
  const f = await fixture(),
    env = {
      CONVEX_URL_CLI: "http://127.0.0.1:3217/path",
      CONVEX_URL: "https://fallback.invalid",
    };
  const result = spawnSync(
    process.execPath,
    [
      f.entry,
      "--trace",
      f.trace,
      "--environment-module",
      pathToFileURL(join(f.root, "live.js")).href,
    ],
    { env, encoding: "utf8", timeout: 5000, maxBuffer: 128 * 1024 },
  );
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("explicit CONVEX_URL_CLI");
  expect(fs.existsSync(f.trace)).toBe(false);
});
it("imports real live setup with the explicit target and forwards useful Jest/watch flags", async () => {
  const f = await fixture(),
    target = "http://127.0.0.1:3217";
  const result = await runCliTests(
    "e2e",
    [
      "--trace",
      f.trace,
      "--environment-module",
      pathToFileURL(join(f.root, "live.js")).href,
      "--watch",
      "--json",
    ],
    {
      environment: { ...canaries, CONVEX_URL_CLI: target, CORTEX_TEST_EXPECTED_CONVEX_URL: target },
      jestEntry: f.entry,
      stdio: "ignore",
    },
  );
  expect(result).toBe(0);
  const observed = JSON.parse(await readFile(f.trace, "utf8"));
  expect(observed.environment.CONVEX_URL).toBe(target);
  expect(observed.environment.CONVEX_URL_CLI).toBe(target);
  expect(observed.environment.CONVEX_DEPLOY_KEY).toBe(canaries.CONVEX_DEPLOY_KEY);
  expect(observed.environment.CORTEX_TEST_EXPECTED_CONVEX_URL).toBe(target);
  expect(observed.environment.OPENAI_API_KEY).toBeUndefined();
  expect(observed.envOpens).toEqual([]);
  expect(observed.args).toEqual(expect.arrayContaining(["--watch", "--json"]));
  expect(fs.existsSync(dirname(observed.environment.HOME))).toBe(false);
});
it("forwards cancellation, awaits the actual child exit, then removes HOME", async () => {
  const f = await fixture(),
    owner = join(f.root, "owner.mjs");
  const runner = pathToFileURL(
    join(helpers, "../../scripts/test-runner.js"),
  ).href;
  await writeFile(
    owner,
    `import {runCliTests} from ${JSON.stringify(runner)};process.exitCode=await runCliTests('unit',${JSON.stringify(["--trace", f.trace, "--wait", "--environment-module", f.module])},{jestEntry:${JSON.stringify(f.entry)},stdio:'ignore'});`,
  );
  const child = spawn(process.execPath, [owner], {
    env: { PATH: process.env.PATH },
    stdio: "ignore",
  });
  const closed = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  try {
    for (let n = 0; n < 200 && !fs.existsSync(f.trace); n++) await pause(10);
    expect(fs.existsSync(f.trace)).toBe(true);
    child.kill("SIGTERM");
    expect(await closed).toEqual({ code: 143, signal: null });
    const observed = JSON.parse(await readFile(f.trace, "utf8"));
    expect(observed.joinedChildDone).toBe(true);
    expect(observed.homeExistedBeforeExit).toBe(true);
    expect(fs.existsSync(dirname(observed.environment.HOME))).toBe(false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await closed;
    }
  }
}, 10000);

it("gives the actual child a canonical bootstrap root under an owned symlinked TMPDIR", async () => {
  const f = await fixture(),
    actualTemp = join(f.root, "actual-temp"),
    aliasTemp = join(f.root, "alias-temp"),
    owner = join(f.root, "symlink-owner.mjs");
  await mkdir(actualTemp, { mode: 0o700 });
  await symlink(actualTemp, aliasTemp, "dir");
  const runner = pathToFileURL(join(helpers, "../../scripts/test-runner.js")).href;
  await writeFile(
    owner,
    `import {runCliTests} from ${JSON.stringify(runner)};process.exitCode=await runCliTests('unit',${JSON.stringify(["--trace", f.trace, "--environment-module", f.module])},{jestEntry:${JSON.stringify(f.entry)},stdio:'inherit'});`,
  );
  const child = spawnSync(process.execPath, [owner], {
    env: { PATH: process.env.PATH, TMPDIR: aliasTemp },
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 128 * 1024,
  });
  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.status).toBe(0);
  const observed = JSON.parse(await readFile(f.trace, "utf8"));
  expect(observed.bootstrapMode).toBe(0o700);
  expect(observed.bootstrapRealpath).toBe(observed.environment.CORTEX_BOOTSTRAP_PROOF_ROOT);
  expect(observed.bootstrapRealpath.startsWith(actualTemp + "/")).toBe(true);
  expect(fs.existsSync(dirname(observed.environment.HOME))).toBe(false);
  expect(fs.realpathSync(aliasTemp)).toBe(actualTemp);
});
