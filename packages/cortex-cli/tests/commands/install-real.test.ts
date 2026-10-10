/** Actual registrations and the emitted CLI, using externally isolated native HOME. */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createProgram } from "../../src/program.js";
import { hashBytes } from "../../src/utils/schema-sync.js";
import { createLegacySdkFixture } from "../../src/utils/__tests__/legacy-backend-fixture.js";
const config = {
  deployments: {},
  default: "",
  format: "table" as const,
  confirmDangerous: true,
};
let root: string;
let legacySdk: string;
const sdk = fileURLToPath(new URL("../../../../", import.meta.url));
const executable = fileURLToPath(
  new URL("../../dist/index.js", import.meta.url),
);
const options = [
  "--yes",
  "--local",
  "--no-install",
  "--no-deploy",
  "--sdk-package",
  sdk,
];
const tree = (directory: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name),
        relative = path.relative(directory, full);
      if (entry.isSymbolicLink())
        result[relative] = `link:${fs.readlinkSync(full)}`;
      else if (entry.isDirectory()) {
        result[relative + "/"] = "directory";
        walk(full);
      } else result[relative] = hashBytes(fs.readFileSync(full));
    }
  };
  walk(directory);
  return result;
};
const run = (args: string[], cwd = root) =>
  spawnSync(process.execPath, [executable, ...args], {
    cwd,
    input: "",
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CORTEX_TEST_HOME_ROOT: process.env.CORTEX_TEST_HOME_ROOT,
      CONVEX_URL_CLI: "http://127.0.0.1:1",
      CONVEX_URL: "http://127.0.0.1:1",
    },
  });
beforeAll(() => {
  if (
    !process.env.CORTEX_TEST_HOME_ROOT ||
    fs.realpathSync(os.homedir()) !==
      fs.realpathSync(process.env.CORTEX_TEST_HOME_ROOT)
  )
    throw new Error("Externally isolated native HOME required before imports");
  root = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-task02-command-"));
  legacySdk = createLegacySdkFixture();
});
afterAll(() => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(legacySdk, { recursive:true, force:true }); });
describe("real installer registry and binary", () => {
  it("registers install and all retained schema leaves through the actual program", async () => {
    const program = createProgram(config);
    expect(program.commands.map((c) => c.name())).toEqual(
      expect.arrayContaining(["init", "install", "schema"]),
    );
    expect(
      program.commands
        .find((c) => c.name() === "schema")!
        .commands.map((c) => c.name()),
    ).toEqual(["status", "sync", "references", "migrate"]);
    const directory = path.join(root, "registered-backend");
    await program.parseAsync([
      "node",
      "cortex",
      "init",
      directory,
      "--template",
      "none",
      ...options,
      "--quiet",
    ]);
    expect(fs.existsSync(path.join(directory, "convex/schema.ts"))).toBe(true);
    expect(fs.existsSync(path.join(directory, "src"))).toBe(false);
  });
  it("built non-TTY basic init writes deterministic files without prompts, secrets or generated bindings", () => {
    const directory = path.join(root, "built basic");
    const result = run(["init", directory, ...options, "--format", "json"]);
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.sdkVersion).toBe("0.39.0");
    expect(output.convexVersion).toBe("1.46.0");
    expect(output.deployment).toBe("staged");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, "package.json"), "utf8"),
    );
    expect(manifest.scripts.build).toBe("tsc");
    expect(manifest.version).toBe("1.3.0");
    expect(fs.existsSync(path.join(directory, ".env.local"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "convex/_generated"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(directory, "node_modules"))).toBe(false);
  });
  it("built existing-project install preserves data/config/lock and repeats byte-identically", () => {
    const directory = path.join(root, "existing");
    fs.mkdirSync(directory);
    fs.writeFileSync(
      path.join(directory, "package.json"),
      '{"name":"existing","private":true,"scripts":{"build":"custom build"}}',
    );
    fs.writeFileSync(
      path.join(directory, ".env.local"),
      "PRIVATE_SENTINEL=preserve\n",
    );
    fs.mkdirSync(path.join(directory, ".convex"));
    fs.writeFileSync(path.join(directory, ".convex/state"), "persistent");
    fs.writeFileSync(
      path.join(directory, "convex.json"),
      '{"functions":"backend/nested/","auth":{"custom":true}}',
    );
    fs.mkdirSync(path.join(directory, "backend/nested"), { recursive: true });
    fs.writeFileSync(
      path.join(directory, "backend/nested/custom.ts"),
      "custom",
    );
    fs.writeFileSync(
      path.join(directory, "package-lock.json"),
      '{"lockfileVersion":3,"packages":{}}',
    );
    const before = tree(directory);
    const result = run(["install", directory, ...options, "--format", "json"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).functions).toBe("backend/nested");
    const installed = tree(directory);
    for (const name of [
      ".env.local",
      ".convex/state",
      "package-lock.json",
      "convex.json",
      "backend/nested/custom.ts",
    ])
      expect(installed[name]).toBe(before[name]);
    expect(
      JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"))
        .scripts.build,
    ).toBe("custom build");
    const repeated = run([
      "install",
      directory,
      ...options,
      "--format",
      "json",
    ]);
    expect(repeated.status).toBe(0);
    expect(JSON.parse(repeated.stdout).additions).toEqual([]);
    expect(tree(directory)).toEqual(installed);
    fs.mkdirSync(path.join(directory, "node_modules/@cortexmemory"), {
      recursive: true,
    });
    fs.symlinkSync(sdk, path.join(directory, "node_modules/@cortexmemory/sdk"));
    const dryBefore = tree(directory);
    const dry = run([
      "schema",
      "sync",
      directory,
      "--dry-run",
      "--format",
      "json",
    ]);
    expect(dry.status).toBe(0);
    expect(JSON.parse(dry.stdout).files).toContain("schema.ts");
    expect(tree(directory)).toEqual(dryBefore);
  });
  it.each([
    ["--template", "chat-sdk"],
    ["--template", "vercel-ai-quickstart"],
    ["--start"],
    ["--cloud"],
    ["--graph", "neo4j"],
  ])(
    "built init refuses incompatible legacy/enabled options %j before destination creation",
    (flags) => {
      const directory = path.join(
        root,
        `refuse-${Math.random().toString(16).slice(2)}`,
      );
      const result = run(["init", directory, ...options, ...flags]);
      expect(result.status).toBe(1);
      expect(fs.existsSync(directory)).toBe(false);
      expect(result.stderr.length).toBeGreaterThan(0);
    },
  );
  it("current runtime dry-run/collision refuse writes; explicit legacy overwrite retains its exact backup", () => {
    const directory = path.join(root, "planned");
    const dry = run([
      "init",
      directory,
      ...options,
      "--dry-run",
      "--format",
      "json",
    ]);
    expect(dry.status).toBe(0);
    expect(JSON.parse(dry.stdout).dryRun).toBe(true);
    expect(fs.existsSync(directory)).toBe(false);
    fs.mkdirSync(directory);
    fs.writeFileSync(
      path.join(directory, "package.json"),
      '{"name":"planned"}',
    );
    fs.mkdirSync(path.join(directory, "convex"));
    fs.writeFileSync(
      path.join(directory, "convex/schema.ts"),
      "arbitrary original",
    );
    const before = tree(directory);
    const conflict = run(["install", directory, ...options]);
    expect(conflict.status).toBe(1);
    expect(tree(directory)).toEqual(before);
    const runtimeOverwrite = run(["install", directory, ...options, "--overwrite", "--format", "json"]);
    expect(runtimeOverwrite.status).toBe(1);
    const proposed = tree(directory);
    const proposals = Object.keys(proposed).filter(name => !Object.hasOwn(before, name));
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatch(/^cortex-backend-merge-proposal-[a-f0-9]{12}\.json$/);
    expect(Object.fromEntries(Object.entries(proposed).filter(([name]) => name !== proposals[0]))).toEqual(before);
    const proposal = JSON.parse(fs.readFileSync(path.join(directory, proposals[0]), "utf8"));
    expect(proposal.projectPath).toBe(directory);
    expect(proposal.conflicts.map((entry: {path: string}) => entry.path)).toContain("convex/schema.ts");
    const overwrite = run([
      "install",
      directory,
      ...options,
      "--sdk-package", legacySdk,
      "--overwrite",
      "--format",
      "json",
    ]);
    expect(overwrite.status).toBe(0);
    const backup = JSON.parse(overwrite.stdout).backupPath;
    expect(
      fs.readFileSync(path.join(directory, backup, "convex/schema.ts"), "utf8"),
    ).toBe("arbitrary original");
  });
});

it("built path refuses a destination symlink without touching its target", () => {
  const outside = path.join(root, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "sentinel"), "keep");
  const link = path.join(root, "linked");
  fs.symlinkSync(outside, link);
  const before = tree(outside);
  const result = run(["init", link, ...options]);
  expect(result.status).toBe(1);
  expect(tree(outside)).toEqual(before);
});
it.each([0, 7])(
  "built explicit legacy backend-only init propagates native exit %s and strips inherited target environment",
  (exit) => {
    const bin = path.join(root, `fake-bin-${exit}`),
      directory = path.join(root, `native-outcome-${exit}`);
    fs.mkdirSync(bin);
    const installer = `#!/usr/bin/env node
const fs=require("node:fs"),path=require("node:path");fs.mkdirSync("node_modules/convex/bin",{recursive:true});fs.writeFileSync("node_modules/convex/package.json",JSON.stringify({version:"1.46.0",type:"module"}));fs.writeFileSync("node_modules/convex/bin/main.js",${JSON.stringify('import fs from "node:fs"; fs.writeFileSync("native-proof.json",JSON.stringify({args:process.argv.slice(2),agent:process.env.CONVEX_AGENT_MODE,hasKey:Boolean(process.env.CONVEX_DEPLOY_KEY),hasDeployment:Boolean(process.env.CONVEX_DEPLOYMENT),hasUrl:Boolean(process.env.CONVEX_URL)})); console.log("native diagnostic"); process.exit(EXIT);')}.replace("EXIT",String(${exit})));console.log("npm diagnostic");
`;
    fs.writeFileSync(path.join(bin, "npm"), installer, { mode: 0o700 });
    const result = spawnSync(
      process.execPath,
      [
        executable,
        "init",
        directory,
        "--yes",
        "--local",
        "--template",
        "none",
        "--sdk-package",
        legacySdk,
        "--format",
        "json",
      ],
      {
        cwd: root,
        input: "",
        encoding: "utf8",
        env: {
          PATH: bin + path.delimiter + process.env.PATH,
          HOME: process.env.HOME,
          CORTEX_TEST_HOME_ROOT: process.env.CORTEX_TEST_HOME_ROOT,
          CONVEX_URL: "http://127.0.0.1:1",
          CONVEX_DEPLOYMENT: "prod:sentinel",
          CONVEX_DEPLOY_KEY: "fixture-secret",
        },
      },
    );
    expect(result.status).toBe(exit === 0 ? 0 : 1);
    const native = JSON.parse(
      fs.readFileSync(path.join(directory, "native-proof.json"), "utf8"),
    );
    expect(native).toEqual({
      args: ["dev", "--once", "--typecheck", "enable"],
      agent: "anonymous",
      hasKey: false,
      hasDeployment: false,
      hasUrl: false,
    });
    expect(fs.existsSync(path.join(directory, "convex/schema.ts"))).toBe(true);
    expect(fs.existsSync(path.join(directory, ".cortex/backend.json"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(directory, "package.json"))).toBe(true);
    expect(result.stderr).not.toContain("fixture-secret");
    if (exit === 0) {
      expect(JSON.parse(result.stdout).deployment).toBe("anonymous-local");
      expect(result.stderr).toContain("npm diagnostic");
      expect(result.stderr).toContain("native diagnostic");
    } else
      expect(result.stderr).toContain("Project staged; native setup failed");
  },
);

it("built npm failure restores scaffold and unpublished registry version never falls back", () => {
  const bin = path.join(root, "failing-npm-bin"),
    directory = path.join(root, "install-failure");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "npm"), "#!/bin/sh\nexit 9\n", {
    mode: 0o700,
  });
  const environment = {
    PATH: bin + path.delimiter + process.env.PATH,
    HOME: process.env.HOME,
    CORTEX_TEST_HOME_ROOT: process.env.CORTEX_TEST_HOME_ROOT,
  };
  const failure = spawnSync(
    process.execPath,
    [
      executable,
      "init",
      directory,
      "--yes",
      "--local",
      "--template",
      "none",
      "--no-deploy",
      "--sdk-package",
      sdk,
    ],
    { cwd: root, input: "", encoding: "utf8", env: environment },
  );
  expect(failure.status).toBe(1);
  expect(failure.stderr).toContain("npm failed (9)");
  expect(fs.existsSync(directory)).toBe(false);
  const unavailable = spawnSync(
    process.execPath,
    [executable, "init", directory, "--template", "none", "--yes", "--local", "--no-deploy"],
    { cwd: root, input: "", encoding: "utf8", env: environment },
  );
  expect(unavailable.status).toBe(1);
  expect(unavailable.stderr).toContain(
    "@cortexmemory/sdk@0.39.0 registry release unavailable",
  );
  expect(unavailable.stderr).toContain("No older SDK fallback");
  expect(fs.existsSync(directory)).toBe(false);
});

it.each([
  {"@cortexmemory/sdk":{name:"@cortexmemory/sdk",version:"0.37.0",filename:"sdk.tgz"}},
  {"@cortexmemory/sdk":{name:"@cortexmemory/sdk",version:"0.39.0",filename:"../escape.tgz"}},
])("built registry-source selection rejects substituted npm pack metadata before archive/install/backend writes: %j",packed=>{
  const suffix=packed["@cortexmemory/sdk"].version+packed["@cortexmemory/sdk"].filename.replace(/[^A-Za-z0-9]/g,""),bin=path.join(root,"pack-refusal-"+suffix),host=path.join(root,"pack-host-"+suffix);
  fs.mkdirSync(bin);fs.mkdirSync(host);
  fs.writeFileSync(path.join(host,"package.json"),JSON.stringify({name:"host",scripts:{custom:"preserve"}}));
  fs.writeFileSync(path.join(host,"sentinel.txt"),"unrelated");
  fs.writeFileSync(path.join(bin,"npm"),'#!/usr/bin/env node\nconsole.log('+JSON.stringify(JSON.stringify(packed))+');\n',{mode:0o700});
  const marker=path.join(root,"unexpected-tar-"+suffix);
  fs.writeFileSync(path.join(bin,"tar"),'#!/usr/bin/env node\nrequire("node:fs").writeFileSync('+JSON.stringify(marker)+',"unexpected");process.exit(1);\n',{mode:0o700});
  const before=tree(host),result=spawnSync(process.execPath,[executable,"install",host,"--yes","--no-deploy"],{cwd:root,input:"",encoding:"utf8",timeout:15000,env:{PATH:bin+path.delimiter+process.env.PATH,HOME:process.env.HOME,CORTEX_TEST_HOME_ROOT:process.env.CORTEX_TEST_HOME_ROOT}});
  expect(result.error).toBeUndefined();expect(result.status).toBe(1);expect(result.stderr).toContain("No older SDK fallback");
  expect(tree(host)).toEqual(before);expect(fs.existsSync(marker)).toBe(false);
});
