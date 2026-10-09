import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createProgram } from "../../program.js";
import { acquireForegroundSignalHandler } from "../client.js";
import {
  nativeEnvironment,
  propagateNativeResult,
  resolveInstalledConvex,
  runConvex,
} from "../convex-runner.js";
import {
  backendPlan,
  directTargetEnvironment,
  exportSnapshot,
  importSnapshot,
  inspectSnapshot,
  resolveNativeTarget,
  updatePackages,
} from "../management.js";
import { diagnose } from "../../commands/doctor.js";
import { isSupportedNodeVersion, unsupportedNodeDiagnostic } from "../node-runtime.js";
import type { CLIConfig } from "../../types.js";
import type { Command } from "commander";

beforeAll(() => {
  if (
    !process.env.CORTEX_TEST_HOME_ROOT ||
    fs.realpathSync(os.homedir()) !==
      fs.realpathSync(process.env.CORTEX_TEST_HOME_ROOT)
  )
    throw new Error("Externally isolated native HOME required before imports");
});
const roots: string[] = [];
function fixture(script?: string): { root: string; config: CLIConfig } {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cortex-native-management-"),
  );
  roots.push(root);
  fs.mkdirSync(path.join(root, "node_modules/convex/bin"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    '{"name":"consumer","version":"1.0.0","packageManager":"npm@11.19.1"}',
  );
  fs.writeFileSync(
    path.join(root, "node_modules/convex/package.json"),
    '{"name":"convex","version":"1.46.0","bin":{"convex":"bin/main.js"},"type":"module"}',
  );
  fs.writeFileSync(
    path.join(root, "node_modules/convex/bin/main.js"),
    script ??
      `console.log(JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd(),keyMatches:process.env.CONVEX_SELF_HOSTED_ADMIN_KEY==='native-test-key',url:process.env.CONVEX_SELF_HOSTED_URL,selection:process.env.CONVEX_DEPLOYMENT,inheritedKey:process.env.CONVEX_DEPLOY_KEY, inheritedNodeOptions:process.env.NODE_OPTIONS??null}));`,
  );
  fs.mkdirSync(path.join(root, ".convex/local/default"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".convex/local/default/config.json"),
    JSON.stringify({
      deploymentName: "anonymous-test",
      adminKey: "native-test-key",
      backendVersion: "test",
      ports: { cloud: 45510, site: 45511 },
    }),
  );
  const config: CLIConfig = {
    deployments: {
      local: {
        projectPath: root,
        url: "http://127.0.0.1:45510",
        deployment: "local:anonymous-test",
        key: "native-test-key",
      },
    },
    default: "local",
    format: "table",
    confirmDangerous: true,
  };
  return { root, config };
}
function sdk(root: string): void {
  const dir = path.join(root, "node_modules/@cortexmemory/sdk");
  fs.mkdirSync(path.join(dir, "convex-dev"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"@cortexmemory/sdk","version":"0.38.0"}',
  );
  fs.writeFileSync(
    path.join(dir, "convex-dev/schema.ts"),
    "export default {};",
  );
  fs.writeFileSync(
    path.join(dir, "convex-dev/admin.ts"),
    `import {internalQuery,internalMutation} from './_generated/server';\n${["listTable", "countTable", "getAllCounts"].map((name) => `export const ${name}=internalQuery({});`).join("\n")}\n${["clearTable", "deleteRecord"].map((name) => `export const ${name}=internalMutation({});`).join("\n")}`,
  );
}
async function parse(config: CLIConfig, args: string[]): Promise<void> {
  const program = createProgram(config);
  const captureErrors = (command: Command): void => {
    command.exitOverride();
    command.configureOutput({ writeErr: () => {} });
    for (const child of command.commands) captureErrors(child);
  };
  captureErrors(program);
  await program.parseAsync(["node", "cortex", ...args]);
}
afterEach(() => {
  jest.restoreAllMocks();
  process.exitCode = 0;
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});
describe("selected installed-bin process boundary", () => {
  it("uses only project pinned bin, literal hostile argv and isolated exact authority", async () => {
    const { root, config } = fixture(),
      target = resolveNativeTarget(config, { deployment: "local" });
    const marker = path.join(root, "injection-marker");
    const hostile = `x="' ; $(touch ${marker}) && \\ =日本語`;
    process.env.CONVEX_DEPLOY_KEY = "inherited-conflict";
    const result = await runConvex(root, ["env", "set", "LITERAL", hostile], {
      capture: true,
      env: directTargetEnvironment(target),
      secrets: [target.key],
    });
    delete process.env.CONVEX_DEPLOY_KEY;
    const out = JSON.parse(result.stdout);
    expect(out.argv).toEqual(["env", "set", "LITERAL", hostile]);
    expect(out.cwd).toBe(fs.realpathSync(root));
    expect(out.keyMatches).toBe(true);
    expect(out.url).toBe(target.url);
    expect(out.inheritedKey).toBe("");
    expect(out.inheritedNodeOptions).toBeNull();
    expect(result.code).toBe(0);
    expect(fs.existsSync(marker)).toBe(false);
  });
  it.each(["npm", "pnpm-relative", "pnpm-absolute"] as const)(
    "resolves %s pinned package and runs literal argv with selected environment",
    async (layout) => {
      const { root, config } = fixture();
      const modules = path.join(root, "node_modules"), selected = path.join(modules, "convex");
      let packageRoot = selected;
      if (layout !== "npm") {
        packageRoot = path.join(modules, ".pnpm/convex@1.46.0_react@19.2.4/node_modules/convex");
        fs.mkdirSync(path.dirname(packageRoot), { recursive: true });
        fs.renameSync(selected, packageRoot);
        fs.symlinkSync(layout === "pnpm-relative" ? path.relative(modules, packageRoot) : packageRoot, selected, "dir");
      }
      expect(resolveInstalledConvex(root)).toBe(path.join(packageRoot, "bin/main.js"));
      const target = resolveNativeTarget(config, { deployment: "local" });
      const marker = path.join(root, "no-shell-marker"), hostile = `日本語=' ; $(touch ${marker})`;
      const result = await runConvex(root, ["dev", "--once", hostile], {
        capture: true, env: directTargetEnvironment(target), secrets: [target.key],
      });
      expect(result).toMatchObject({ code: 0, signal: null, timedOut: false, stderr: "" });
      expect(JSON.parse(result.stdout)).toEqual({argv:["dev", "--once", hostile], cwd:fs.realpathSync(root), keyMatches:true, url:target.url, selection:"", inheritedKey:"", inheritedNodeOptions:null});
      expect(fs.existsSync(marker)).toBe(false);
    },
  );
  it.each([
    "external-link", "intermediate-escape", "node-modules-link", "dangling-link",
    "manifest-link", "bin-link", "manifest-directory", "bin-directory",
    "missing-bin", "malformed-manifest", "wrong-name", "invalid-bin-metadata", "traversal-bin", "absolute-bin",
  ] as const)("refuses installed package %s before execution", async (change) => {
    const { root } = fixture("import fs from 'node:fs';fs.writeFileSync('SHOULD-NOT-RUN','x');");
    const { root: other } = fixture();
    const modules = path.join(root, "node_modules"), selected = path.join(modules, "convex"), manifest = path.join(selected, "package.json"), bin = path.join(selected, "bin/main.js");
    if (change === "external-link" || change === "dangling-link") {
      fs.rmSync(selected, { recursive: true }); fs.symlinkSync(path.join(other, change === "external-link" ? "node_modules/convex" : "absent"), selected, "dir");
    } else if (change === "intermediate-escape") {
      fs.rmSync(selected, { recursive: true }); fs.symlinkSync(path.join(other, "node_modules"), path.join(modules, ".pnpm"), "dir"); fs.symlinkSync(".pnpm/convex", selected, "dir");
    } else if (change === "node-modules-link") {
      fs.rmSync(modules, { recursive: true }); fs.symlinkSync(path.join(other, "node_modules"), modules, "dir");
    } else if (change === "manifest-link" || change === "bin-link") {
      const file = change === "manifest-link" ? manifest : bin;
      fs.renameSync(file, file + ".original"); fs.symlinkSync(path.basename(file) + ".original", file);
    } else if (change === "manifest-directory" || change === "bin-directory") {
      const file = change === "manifest-directory" ? manifest : bin; fs.rmSync(file); fs.mkdirSync(file);
    } else if (change === "missing-bin") fs.rmSync(bin);
    else if (change === "malformed-manifest") fs.writeFileSync(manifest, "{invalid");
    else {
      const value = JSON.parse(fs.readFileSync(manifest, "utf8"));
      if (change === "wrong-name") value.name = "another-package";
      else value.bin = change === "traversal-bin" ? "../escape.js" : change === "absolute-bin" ? path.join(other, "node_modules/convex/bin/main.js") : { another: "bin/main.js" };
      fs.writeFileSync(manifest, JSON.stringify(value));
    }
    expect(() => resolveInstalledConvex(root)).toThrow();
    await expect(runConvex(root, ["dev", "--once"], { capture: true })).rejects.toThrow();
    expect(fs.existsSync(path.join(root, "SHOULD-NOT-RUN"))).toBe(false);
    expect(fs.existsSync(path.join(other, "SHOULD-NOT-RUN"))).toBe(false);
  });
  it("rejects absent, wrong-version and symlinked bins without execution", () => {
    const { root } = fixture();
    fs.writeFileSync(
      path.join(root, "node_modules/convex/package.json"),
      '{"name":"convex","version":"1.45.0","bin":"bin/main.js"}',
    );
    expect(() => resolveInstalledConvex(root)).toThrow("1.46.0");
    fs.rmSync(path.join(root, "node_modules/convex"), { recursive: true });
    expect(() => resolveInstalledConvex(root)).toThrow(
      "no global or npx fallback",
    );
    fs.symlinkSync("/tmp", path.join(root, "node_modules/convex"));
    expect(() => resolveInstalledConvex(root)).toThrow("Symlink");
  });
  it("returns exact child failure, signal and timeout statuses", async () => {
    const { root } = fixture("process.exit(23)");
    expect((await runConvex(root, ["data"], { capture: true })).code).toBe(23);
    fs.writeFileSync(
      path.join(root, "node_modules/convex/bin/main.js"),
      "process.kill(process.pid,'SIGTERM')",
    );
    const signal = await runConvex(root, ["data"], { capture: true });
    expect(signal.signal).toBe("SIGTERM");
    expect(signal.code).toBe(143);
    fs.writeFileSync(
      path.join(root, "node_modules/convex/bin/main.js"),
      "setInterval(()=>{},1000)",
    );
    const timeout = await runConvex(root, ["data"], {
      capture: true,
      timeoutMs: 100,
    });
    expect(timeout.code).toBe(124);
    expect(timeout.timedOut).toBe(true);
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(propagateNativeResult(timeout)).toBe(false);
    expect(process.exitCode).toBe(124);
  });
  it("redacts credentials across split output chunks and bounds invalid inputs", async () => {
    const { root } = fixture(
      "const bytes=Buffer.from('日本語\\n');process.stdout.write('secret-'); setTimeout(()=>{console.log('token');process.stdout.write(bytes.subarray(0,1));setTimeout(()=>process.stdout.write(bytes.subarray(1)),10);},10)",
    );
    const output = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const result = await runConvex(root, ["logs"], {
      secrets: ["secret-token"],
    });
    expect(result.stdout).toBe("***\n日本語\n");
    expect(output.mock.calls.map((call) => call[0]).join("")).toBe(
      "***\n日本語\n",
    );
    await expect(runConvex(root, ["bad\0arg"])).rejects.toThrow(
      "Invalid native argument",
    );
    await expect(runConvex(root, ["data"], { timeoutMs: -1 })).rejects.toThrow(
      "Invalid native timeout",
    );
  });
  it("exclusive signal lease refuses concurrent child before spawn, without removing listeners", async () => {
    const { root } = fixture();
    const count = process.listenerCount("SIGINT");
    const release = acquireForegroundSignalHandler(async () => {});
    await expect(runConvex(root, ["data"], { capture: true })).rejects.toThrow(
      "already active",
    );
    expect(process.listenerCount("SIGINT")).toBe(count);
    release();
    expect((await runConvex(root, ["data"], { capture: true })).code).toBe(0);
  });
  it("supervises SIGINT and preserves an unrelated process", async () => {
    const { root } = fixture(
      "console.log('ready');process.on('SIGINT',()=>process.exit(0));setInterval(()=>{},1000)",
    );
    const unrelated = spawn(
      process.execPath,
      ["-e", "setInterval(()=>{},1000)"],
      { stdio: "ignore" },
    );
    try {
      const run = runConvex(root, ["dev"], {
        capture: true,
        protocol: (child) => {
          child.stdout?.once("data", () => process.emit("SIGINT"));
        },
      });
      expect((await run).code).toBe(130);
      expect(unrelated.exitCode).toBeNull();
    } finally {
      unrelated.kill("SIGTERM");
      await new Promise<void>((resolve) =>
        unrelated.once("exit", () => resolve()),
      );
    }
  });
  it("sanitizes every inherited selector and unsafe Node loader", () => {
    const before = process.env.NODE_OPTIONS;
    process.env.NODE_OPTIONS = "bad";
    const env = nativeEnvironment();
    expect(env.NODE_OPTIONS).toBeUndefined();
    expect(env.CONVEX_DEPLOYMENT).toBe("");
    if (before === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = before;
  });
});
describe("authority and real native registry", () => {
  it("rejects implicit mutations, project mismatch, wrong local URL/key/identity and flag conflicts", () => {
    const { root, config } = fixture();
    expect(() => resolveNativeTarget(config, {}, true)).toThrow(
      "explicit --deployment",
    );
    expect(() =>
      resolveNativeTarget(config, { deployment: "missing" }),
    ).toThrow("configured");
    expect(() =>
      resolveNativeTarget(config, { project: path.join(root, "another") }),
    ).toThrow("another project");
    expect(() => resolveNativeTarget(config, { prod: true })).toThrow(
      "--prod conflicts",
    );
    config.deployments.local.url = "http://127.0.0.1:45512";
    expect(() => resolveNativeTarget(config, {})).toThrow("authority");
    config.deployments.local.url = "http://127.0.0.1:45510";
    config.deployments.local.key = "wrong";
    expect(() => resolveNativeTarget(config, {})).toThrow("authority");
    config.deployments.local.key = "native-test-key";
    config.deployments.local.deployment = "local:other";
    expect(() => resolveNativeTarget(config, {})).toThrow("authority");
  });
  it("binds production URL/key/name and explicit intent; unsupported prod flag never reaches native", async () => {
    const { root, config } = fixture();
    config.deployments.prod = {
      projectPath: root,
      url: "https://chosen.convex.cloud",
      deployment: "prod:chosen",
      key: "prod:chosen|fake-key",
    };
    expect(() =>
      resolveNativeTarget(config, { deployment: "prod" }, true),
    ).toThrow("--prod");
    expect(() =>
      resolveNativeTarget(config, { deployment: "prod", local: true }),
    ).toThrow("--local");
    jest.spyOn(console, "log").mockImplementation(() => {});
    const record = path.join(root, "native-call.json");
    fs.writeFileSync(
      path.join(root, "node_modules/convex/bin/main.js"),
      `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(record)},JSON.stringify({argv:process.argv.slice(2),url:process.env.CONVEX_SELF_HOSTED_URL,credentialsMatch:process.env.CONVEX_SELF_HOSTED_ADMIN_KEY==='prod:chosen|fake-key',selector:process.env.CONVEX_DEPLOYMENT,deployKey:process.env.CONVEX_DEPLOY_KEY,cwd:process.cwd()}));`,
    );
    for (const authorization of ["--yes", "--push"]) {
      await parse(config, ["deploy", "-d", "prod", "--prod", authorization]);
      expect(JSON.parse(fs.readFileSync(record, "utf8"))).toEqual({
        argv: ["deploy", "--yes"],
        url: "https://chosen.convex.cloud",
        credentialsMatch: true,
        selector: "",
        deployKey: "",
        cwd: fs.realpathSync(root),
      });
    }
    await parse(config, [
      "convex",
      "deploy",
      "-d",
      "prod",
      "--prod",
      "--dry-run",
    ]);
    expect(JSON.parse(fs.readFileSync(record, "utf8")).argv).toEqual([
      "deploy",
      "--yes",
      "--dry-run",
    ]);
    fs.rmSync(record);
    await expect(
      parse(config, ["deploy", "-d", "prod", "--prod"]),
    ).rejects.toThrow("requires --yes");
    expect(fs.existsSync(record)).toBe(false);
    const mismatched = structuredClone(config);
    mismatched.deployments.prod.url = "https://other.convex.cloud";
    expect(() =>
      resolveNativeTarget(mismatched, { deployment: "prod" }),
    ).toThrow("cloud URL");
    mismatched.deployments.prod.url = "https://chosen.convex.cloud";
    mismatched.deployments.prod.key = "dev:chosen|key";
    expect(() =>
      resolveNativeTarget(mismatched, { deployment: "prod" }),
    ).toThrow("key does not match");
  });
  it("local dry-run performs no child/selection/schema/package/state writes", async () => {
    const { root, config } = fixture(
      `import fs from 'node:fs';fs.writeFileSync('SHOULD-NOT-RUN','x');`,
    );
    const before = fs.readFileSync(
      path.join(root, ".convex/local/default/config.json"),
    );
    const output = jest.spyOn(console, "log").mockImplementation(() => {});
    await parse(config, ["deploy", "-d", "local", "--dry-run"]);
    expect(fs.existsSync(path.join(root, "SHOULD-NOT-RUN"))).toBe(false);
    expect(
      fs.readFileSync(path.join(root, ".convex/local/default/config.json")),
    ).toEqual(before);
    expect(JSON.parse(String(output.mock.calls[0][0])).writes).toEqual([]);
  });
  it("explicit sync conflicts are fatal; default/skip-sync does not guess source ownership", async () => {
    const { root, config } = fixture();
    sdk(root);
    fs.mkdirSync(path.join(root, "convex"));
    fs.writeFileSync(path.join(root, "convex/schema.ts"), "custom-schema");
    const target = resolveNativeTarget(config, {});
    await expect(backendPlan(target, { sync: true })).rejects.toThrow("sync conflicts");
    await expect(backendPlan(target, { sync: true, skipSync: true })).rejects.toThrow(
      "mutually exclusive",
    );
    expect(await backendPlan(target, {})).toBeUndefined();
    expect(fs.readFileSync(path.join(root, "convex/schema.ts"), "utf8")).toBe(
      "custom-schema",
    );
  });
  it.each(["stop", "db backup", "db restore", "convex init"])(
    "retired %s fails before any target/bin access",
    async (leaf) => {
      const config: CLIConfig = {
        deployments: {},
        default: "",
        format: "table",
        confirmDangerous: true,
      };
      await expect(
        parse(config, [...leaf.split(" "), "--arbitrary-old-flag"]),
      ).rejects.toThrow("retired");
    },
  );
  it("guarded clear alias rejects unknown flags before target/bin access", async () => {
    const config: CLIConfig = {
      deployments: {},
      default: "",
      format: "table",
      confirmDangerous: true,
    };
    await expect(
      parse(config, ["db", "clear", "--arbitrary-old-flag"]),
    ).rejects.toThrow("unknown option '--arbitrary-old-flag'");
  });
  it.each([
    "--app x",
    "--apps-only",
    "--deployments-only",
    "--dev",
    "--sync-template",
    "--provider-version 1.0.0",
  ])("retired update option %s refuses before target", async (flag) => {
    const { config } = fixture();
    await expect(parse(config, ["update", ...flag.split(" ")])).rejects.toThrow(
      "retired",
    );
  });
  it("literal compatibility env assignment preserves all equals and masks echoed values", async () => {
    const { root, config } = fixture(
      `import fs from 'node:fs';fs.writeFileSync('argv.json',JSON.stringify(process.argv.slice(2)));console.log(process.argv.at(-1));`,
    );
    const output = jest.spyOn(console, "log").mockImplementation(() => {});
    await parse(config, [
      "convex",
      "env",
      "-d",
      "local",
      "--set",
      "NAME=a=b='x';$(echo nope)",
    ]);
    expect(
      JSON.parse(fs.readFileSync(path.join(root, "argv.json"), "utf8")),
    ).toEqual(["env", "set", "NAME", "a=b='x';$(echo nope)"]);
    expect(output.mock.calls.flat().join("")).toBe("Environment variable set");
    await expect(
      parse(config, ["convex", "env", "--list", "--set", "NAME=x"]),
    ).rejects.toThrow("mutually exclusive");
    await expect(
      parse(config, ["convex", "env", "--set", "INVALID"]),
    ).rejects.toThrow("NAME=value");
  });
  it.each(["0", "-1", "2.5", "1001", "bad"])(
    "logs bound %s refuses before native effects",
    async (lines) => {
      const { config } = fixture();
      await expect(
        parse(config, ["convex", "logs", "--lines", lines]),
      ).rejects.toThrow();
    },
  );
  it("doctor/status report real versions and unknown backend compatibility without config writes", async () => {
    const { root, config } = fixture();
    sdk(root);
    const before = JSON.stringify(config);
    const report = await diagnose(config, { graph: true });
    expect(report.ok).toBe(true);
    expect(report.node).toEqual({ version: process.version, supported: isSupportedNodeVersion(process.versions.node) });
    expect(report.dependencies.sdk).toBe("0.38.0");
    expect(report.dependencies.convex).toBe("1.46.0");
    expect(report.backend.compatibility).toBe("unknown");
    expect(report.graph.status).toBe("external-prerequisites");
    expect(JSON.stringify(config)).toBe(before);
    const missing = await diagnose({ ...config, deployments: {} }, {});
    expect(missing.ok).toBe(false);
    expect(missing.target).toBeNull();
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unreachable"));
    expect((await diagnose(config, { check: true })).backend.reachable).toBe(
      false,
    );
  });
  it("doctor shares the exact minimum including unsupported minor versions", async () => {
    const { root, config } = fixture();
    sdk(root);
    const node = Object.getOwnPropertyDescriptor(process.versions, "node")!;
    const version = Object.getOwnPropertyDescriptor(process, "version")!;
    try {
      for (const [value, supported] of [["20.20.2", false], ["22.15.99", false], ["24.14.99", false], ["24.15.0", true], ["26.0.0", true]] as const) {
        Object.defineProperty(process.versions, "node", { ...node, value });
        Object.defineProperty(process, "version", { ...version, value: `v${value}` });
        const report = await diagnose(config);
        expect(report.node).toEqual({ version: `v${value}`, supported });
        expect(report.ok).toBe(supported);
        expect(report.diagnostics).toEqual(supported ? [] : [unsupportedNodeDiagnostic(`v${value}`)]);
        expect(report.backend.reachable).toBeNull();
      }
    } finally {
      Object.defineProperty(process.versions, "node", node);
      Object.defineProperty(process, "version", version);
    }
  });
  it("targeted dependency plan rejects invalid versions/managers and uses accepted SDK validation", async () => {
    const { root, config } = fixture();
    sdk(root);
    await expect(
      updatePackages(config, { sdkVersion: "latest", dryRun: true }),
    ).rejects.toThrow("exact versions");
    jest.spyOn(console, "log").mockImplementation(() => {});
    await updatePackages(config, { dryRun: true });
    await updatePackages(config, { sdkVersion: "0.38.0", dryRun: true });
    expect(fs.existsSync(path.join(root, "convex"))).toBe(false);
    fs.writeFileSync(path.join(root, "yarn.lock"), "keep");
    await expect(
      updatePackages(config, { sdkVersion: "0.38.0", dryRun: true }),
    ).rejects.toThrow("lockfile");
  });
});
describe("native ZIP and lifecycle refusal", () => {
  function archive(root: string, table = "probe"): string {
    fs.mkdirSync(path.join(root, table), { recursive: true });
    fs.writeFileSync(path.join(root, table, "documents.jsonl"), "{}");
    execFileSync(
      "zip",
      ["-q", path.join(root, "snapshot.zip"), `${table}/documents.jsonl`],
      { cwd: root },
    );
    return path.join(root, "snapshot.zip");
  }
  it("verifies native ZIP paths and rejects legacy incomplete formats", () => {
    const { root } = fixture();
    const zip = archive(root);
    expect(inspectSnapshot(zip)).toEqual(["probe/documents.jsonl"]);
    expect(() => inspectSnapshot("legacy.json")).toThrow("legacy JSON");
    fs.writeFileSync(path.join(root, "bad.zip"), "bad");
    expect(() => inspectSnapshot(path.join(root, "bad.zip"))).toThrow(
      "cannot be verified",
    );
  });
  it("refuses ambiguous/dry-run/no-yes and lifecycle snapshots before any import", async () => {
    const { root, config } = fixture();
    const zip = archive(root, "cortexReferenceState");
    await expect(
      importSnapshot(config, zip, { deployment: "local", dryRun: true }),
    ).rejects.toThrow("no dry-run");
    await expect(
      importSnapshot(config, zip, { deployment: "local", yes: true }),
    ).rejects.toThrow("exactly one");
    await expect(
      importSnapshot(config, zip, { deployment: "local", append: true }),
    ).rejects.toThrow("--yes");
    await expect(
      importSnapshot(config, zip, {
        deployment: "local",
        replaceAll: true,
        yes: true,
      }),
    ).rejects.toThrow("writer barrier");
  });
  it.each(["cortexErasureReceipts", "runtimeAuthGrants", "runtimeMemorySources", "runtimeModelOperations"])(
    "refuses protected runtime archive %s before native effects", async (table) => {
      const { root, config } = fixture();
      const zip = archive(root, table);
      await expect(importSnapshot(config, zip, { deployment: "local", replaceAll: true, yes: true })).rejects.toThrow("writer barrier");
    },
  );
  it("refuses composed protected runtime schemas before native effects", async () => {
    const { root, config } = fixture();
    const zip = archive(root);
    fs.mkdirSync(path.join(root, "convex"), { recursive: true });
    fs.writeFileSync(path.join(root, "convex/schema.ts"), "export default defineSchema({...runtimeAuthTables})");
    await expect(importSnapshot(config, zip, { deployment: "local", append: true, yes: true })).rejects.toThrow("writer barrier");
  });
  it("refuses lifecycle-capable deployed targets even when local schema/ZIP lack ledgers", async () => {
    const { root, config } = fixture("console.log('cortexReferenceState')");
    const zip = archive(root);
    await expect(
      importSnapshot(config, zip, {
        deployment: "local",
        append: true,
        yes: true,
      }),
    ).rejects.toThrow("Deployed reference lifecycle");
  });
  it("refuses deployed protected runtime even when archive and installed schema are old", async () => {
    const { root, config } = fixture("console.log('runtimeModelOperations')");
    const zip = archive(root);
    await expect(importSnapshot(config, zip, { deployment: "local", append: true, yes: true })).rejects.toThrow("protected runtime");
  });
  it("exports only unoccupied ZIP paths and propagates failures", async () => {
    const { root, config } = fixture("process.exit(17)");
    await expect(
      exportSnapshot(config, { output: path.join(root, "legacy.json") }),
    ).rejects.toThrow("snapshot.zip");
    jest.spyOn(console, "error").mockImplementation(() => {});
    await exportSnapshot(config, { output: path.join(root, "snapshot.zip") });
    expect(process.exitCode).toBe(17);
    fs.writeFileSync(path.join(root, "snapshot.zip"), "existing");
    await expect(
      exportSnapshot(config, { output: path.join(root, "snapshot.zip") }),
    ).rejects.toThrow("already exist");
  });
});
