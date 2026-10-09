import { afterEach, beforeEach, expect, it } from "@jest/globals";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { applyAdditiveBackendInstallation, installAdditiveBackend, planAdditiveBackendInstallation } from "../init/additive-backend.js";

const repository = fileURLToPath(new URL("../../../../../", import.meta.url));
const execute = promisify(execFile);
let root: string;
let sdk: string;
let host: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-additive-tsconfig-"));
  sdk = path.join(root, "sdk");
  host = path.join(root, "host");
  await fs.ensureDir(host);
  // Controlled distribution: no services, generated bindings or runtime qualification.
  const files = new Map([
    ["_cortex/schema.ts", "export const cortexTablesV1 = {};\n"],
    ["_cortex/components.config.ts", 'import type { AppDefinition } from "convex/server"; export function registerCortexComponentsV1(_app: AppDefinition) {}\n'],
  ]);
  for (const [name, text] of files) await fs.outputFile(path.join(sdk, "dist/backend/v1", name), text);
  await fs.writeJson(path.join(sdk, "dist/backend/v1/manifest.json"), {
    formatVersion: 1, distributionId: "controlled-tsconfig", sdkVersion: "test",
    tables: [], components: [], httpRoutes: [], dependencies: { convex: "^1.46.0" },
    files: [...files].map(([name, text]) => ({ path: name, sha256: createHash("sha256").update(text).digest("hex") })),
  });
});
afterEach(async () => { await fs.remove(root); });

it("plans an absent config without writes and actually enables strict TypeScript checking", async () => {
  const plan = await planAdditiveBackendInstallation(host, sdk);
  const change = plan.changes.find(entry => entry.path === "convex/tsconfig.json");
  expect(change).toBeDefined();
  expect(change!.beforeSha256).toBeNull();
  expect(plan.observedFiles!["convex/tsconfig.json"]).toBeNull();
  expect(await fs.readdir(host)).toEqual([]);
  await applyAdditiveBackendInstallation(plan);
  const config = await fs.readJson(path.join(host, "convex/tsconfig.json"));
  expect(config).toEqual({
    compilerOptions: {
      allowJs: true, strict: true, moduleResolution: "Bundler", jsx: "react-jsx",
      skipLibCheck: true, allowSyntheticDefaultImports: true, target: "ESNext",
      lib: ["ES2023", "dom"], forceConsistentCasingInFileNames: true,
      module: "ESNext", isolatedModules: true, noEmit: true,
    },
    include: ["./**/*"], exclude: ["./_generated"],
  });
  await fs.symlink(path.join(repository, "node_modules"), path.join(host, "node_modules"), "dir");
  const compiler = path.join(repository, "node_modules/typescript/bin/tsc");
  const args = [compiler, "--project", path.join(host, "convex"), "--pretty", "false"];
  await execute(process.execPath, args, { cwd: host, timeout: 30000 });
  await fs.writeFile(path.join(host, "convex/strict-control.ts"), "export const value: string = 42;\n");
  await expect(execute(process.execPath, args, { cwd: host, timeout: 30000 })).rejects.toMatchObject({
    code: 2, stdout: expect.stringContaining("Type 'number' is not assignable to type 'string'"),
  });
  expect(await fs.pathExists(path.join(host, "convex/strict-control.js"))).toBe(false);
}, 60000);

it("initializes the selected custom functions root and preserves unrelated host bytes", async () => {
  const config = '{ "functions": "services/backend/", "codegen": { "staticApi": true } }\r\n';
  await fs.writeFile(path.join(host, "convex.json"), config);
  await fs.writeFile(path.join(host, "sentinel.txt"), "unrelated host\r\n");
  const first = await installAdditiveBackend(host, sdk);
  expect(first.installed).toContain("services/backend/tsconfig.json");
  expect(await fs.readFile(path.join(host, "convex.json"), "utf8")).toBe(config);
  expect(await fs.readFile(path.join(host, "sentinel.txt"), "utf8")).toBe("unrelated host\r\n");
  expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  expect((await installAdditiveBackend(host, sdk)).installed).toEqual([]);
});

it("preserves existing commented custom config bytes and observes them for idempotence", async () => {
  await fs.writeFile(path.join(host, "convex.json"), '{"functions":"services/backend/"}');
  const bytes = Buffer.from('\uFEFF{\r\n // host-owned strict policy\r\n "compilerOptions": { "strict": true, "types": [] }, "include": ["./host.ts"]\r\n}\r\n');
  const relative = "services/backend/tsconfig.json";
  await fs.outputFile(path.join(host, relative), bytes);
  const plan = await planAdditiveBackendInstallation(host, sdk);
  expect(plan.changes.map(entry => entry.path)).not.toContain(relative);
  expect(plan.unchanged).toContain(relative);
  expect(plan.observedFiles![relative]).toBe(createHash("sha256").update(bytes).digest("hex"));
  await applyAdditiveBackendInstallation(plan);
  expect(await fs.readFile(path.join(host, relative))).toEqual(bytes);
  expect((await installAdditiveBackend(host, sdk)).installed).toEqual([]);
});

it("refuses a config created after planning before any backend source is written", async () => {
  const plan = await planAdditiveBackendInstallation(host, sdk);
  const owned = '{"compilerOptions":{"strict":true}}\n';
  await fs.outputFile(path.join(host, "convex/tsconfig.json"), owned);
  await expect(applyAdditiveBackendInstallation(plan)).rejects.toThrow("Host file changed after installation planning: convex/tsconfig.json");
  expect(await fs.readdir(path.join(host, "convex"))).toEqual(["tsconfig.json"]);
  expect(await fs.readFile(path.join(host, "convex/tsconfig.json"), "utf8")).toBe(owned);
});

it.each(["edited", "deleted"])("refuses an existing config %s after planning before source writes", async (change) => {
  const file = path.join(host, "convex/tsconfig.json");
  await fs.outputFile(file, '{"compilerOptions":{"strict":true}}');
  const plan = await planAdditiveBackendInstallation(host, sdk);
  if (change === "edited") await fs.writeFile(file, "host edit\n");
  else await fs.remove(file);
  await expect(applyAdditiveBackendInstallation(plan)).rejects.toThrow("Host file changed after installation planning: convex/tsconfig.json");
  expect(await fs.pathExists(path.join(host, "convex/_cortex"))).toBe(false);
});

it.each(["before planning", "before apply"])("refuses a config symlink %s without touching its target", async (phase) => {
  const target = path.join(root, "outside.json");
  await fs.writeFile(target, "outside sentinel\n");
  const plan = phase === "before apply" ? await planAdditiveBackendInstallation(host, sdk) : null;
  await fs.ensureDir(path.join(host, "convex"));
  await fs.symlink(target, path.join(host, "convex/tsconfig.json"));
  await expect(plan ? applyAdditiveBackendInstallation(plan) : planAdditiveBackendInstallation(host, sdk)).rejects.toThrow("symbolic-link destination");
  expect(await fs.readFile(target, "utf8")).toBe("outside sentinel\n");
  expect(await fs.readdir(path.join(host, "convex"))).toEqual(["tsconfig.json"]);
});

it("refuses a directory at the config path instead of replacing it", async () => {
  await fs.ensureDir(path.join(host, "convex/tsconfig.json"));
  await expect(planAdditiveBackendInstallation(host, sdk)).rejects.toMatchObject({ code: "EISDIR" });
  expect(await fs.readdir(path.join(host, "convex"))).toEqual(["tsconfig.json"]);
});

it("preserves a prospective template config after its exact bytes are staged", async () => {
  const bytes = Buffer.from('{"compilerOptions":{"strict":true,"target":"ESNext"}}\n');
  const plan = await planAdditiveBackendInstallation(host, sdk, { prospectiveFiles: new Map([["convex/tsconfig.json", bytes]]) });
  expect(plan.unchanged).toContain("convex/tsconfig.json");
  await fs.outputFile(path.join(host, "convex/tsconfig.json"), bytes);
  await applyAdditiveBackendInstallation(plan);
  expect(await fs.readFile(path.join(host, "convex/tsconfig.json"))).toEqual(bytes);
});
