import { afterEach, beforeEach, expect, it } from "@jest/globals";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { installSdk } from "../install.js";
import { installAdditiveBackend } from "../init/additive-backend.js";

const repository = fileURLToPath(new URL("../../../../../", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/runtime-typecheck-bindings/", import.meta.url));
const execute = promisify(execFile);
let root: string;
let candidate: string;
let host: string;
let runtimeFiles: string[];
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-full-runtime-types-"));
  candidate = path.join(root, "candidate");
  host = path.join(root, "host");
  // The actual generator builds the complete current source closure in this
  // owned candidate. No root dist, application payload or service is mutated.
  await execute(process.execPath, ["--input-type=module", "--eval", `import { buildBackendDistribution } from ${JSON.stringify(pathToFileURL(path.join(repository, "scripts/backend/build-distribution.mjs")).href)}; await buildBackendDistribution(${JSON.stringify({ sourceRoot: repository, outputRoot: path.join(candidate, "dist/backend/v1") })});`], { timeout: 30000 });
  await fs.copyFile(path.join(repository, "package.json"), path.join(candidate, "package.json"));
  for (const name of ["schema.ts", "admin.ts"]) {
    await fs.ensureDir(path.join(candidate, "convex-dev"));
    await fs.copyFile(path.join(repository, "convex-dev", name), path.join(candidate, "convex-dev", name));
  }
  const manifest = await fs.readJson(path.join(candidate, "dist/backend/v1/manifest.json"));
  runtimeFiles = manifest.files.map((entry: { path: string }) => entry.path);
  expect(runtimeFiles).toEqual(expect.arrayContaining(["runtimeGateway.ts", "runtimeMediaGateway.ts", "cliOperator/attachments.ts", "_cortex/shared/common/crypto.ts"]));
  expect(manifest.components).toEqual(["agent", "workflow"]);
  await fs.ensureDir(host);
});
afterEach(async () => { await fs.remove(root); });

/** Use the installed official pure template, not a permissive handwritten API. */
async function generatedApi(): Promise<string> {
  type OfficialApiCodegen = (paths: string[]) => { DTS: string; JS: string };
  const exportsByName = new Map<string, Record<string, unknown>>();
  async function load(name: string): Promise<Record<string, unknown>> {
    const source = await fs.readFile(path.join(repository, "node_modules/convex/src/cli/codegen_templates", `${name}.ts`), "utf8");
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const module = { exports: {} as Record<string, unknown> };
    new Function("require", "module", "exports", output)((specifier: string) => {
      if (specifier !== "./common.js") throw new Error(`Unexpected official template dependency: ${specifier}`);
      return exportsByName.get("common");
    }, module, module.exports);
    exportsByName.set(name, module.exports);
    return module.exports;
  }
  await load("common");
  const official = await load("api");
  const api = (official.apiCodegen as OfficialApiCodegen)(runtimeFiles.filter(name => !name.endsWith(".config.ts")));
  return api.DTS + await fs.readFile(path.join(fixture, "components.d.ts.txt"), "utf8");
}

async function positionOfflineBindings(functionsRoot = "convex"): Promise<void> {
  const provenance = await fs.readJson(path.join(fixture, "provenance.json"));
  for (const entry of provenance.files) {
    const bytes = await fs.readFile(path.join(fixture, `${entry.path}.txt`));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    if (entry.path !== "components.d.ts") await fs.outputFile(path.join(host, functionsRoot, "_generated", entry.path), bytes);
  }
  await fs.outputFile(path.join(host, functionsRoot, "_generated/api.d.ts"), await generatedApi());
  await fs.symlink(path.join(repository, "node_modules"), path.join(host, "node_modules"), "dir");
}

/** Reuse the installed official config generator, including its comments/options. */
async function officialTsconfig(): Promise<string> {
  const source = await fs.readFile(path.join(repository, "node_modules/convex/src/cli/codegen_templates/tsconfig.ts"), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} as { tsconfigCodegen?: () => string } };
  new Function("module", "exports", output)(module, module.exports);
  return module.exports.tsconfigCodegen!();
}

it.each([
  ["official Convex default", "convex", false, false],
  ["custom explicit empty types", "services/private", true, false],
  ["narrow host-only includes", "functions", true, true],
] as const)("the full installed runtime compiles under preserved %s and still rejects a bad host function", async (_label, functionsRoot, emptyTypes, narrow) => {
  const configPath = path.join(host, functionsRoot, "tsconfig.json");
  let bytes = await officialTsconfig();
  if (emptyTypes) bytes = '\uFEFF' + bytes.replace('"allowJs": true,', '"allowJs": true,\n    "types": [],')
    .replace('"include": ["./**/*"]', narrow ? '"include": ["./host.ts"]' : '"include": ["./**/*"]')
    .replaceAll("\n", "\r\n");
  await fs.outputFile(configPath, bytes);
  const functionsConfig = JSON.stringify({ functions: `${functionsRoot}/` }) + "\r\n";
  await fs.writeFile(path.join(host, "convex.json"), functionsConfig);
  await fs.writeJson(path.join(host, "package.json"), { name: "preserved-config-runtime-host" });
  await fs.writeFile(path.join(host, "sentinel.txt"), "unrelated host bytes\r\n");
  await installSdk(host, { sdkPackage: candidate, install: false, deploy: false });
  await positionOfflineBindings(functionsRoot);
  // The narrow entry reaches the genuine full API and component declarations
  // through ordinary imports, without expanding the host-owned include list.
  await fs.writeFile(path.join(host, functionsRoot, "host.ts"), 'import { query } from "./_generated/server";\nimport "./convex.config";\nexport type RuntimeApi = typeof import("./_generated/api");\nexport type ComponentInstaller = typeof import("./_cortex/components.config.js").registerCortexComponentsV1;\nexport const own = query({ args: {}, handler: ctx => ctx.db.query("facts").collect() });\n');
  const args = [path.join(repository, "node_modules/typescript/bin/tsc"), "--project", path.join(host, functionsRoot), "--pretty", "false"];
  const checked = await execute(process.execPath, args, { cwd: host, timeout: 60000 })
    .then(result => ({ code: 0, ...result }), (error: { code: number; stdout: string; stderr: string }) => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
  expect(checked).toEqual({ code: 0, stdout: "", stderr: "" });
  expect(await fs.readFile(configPath, "utf8")).toBe(bytes);
  expect(await fs.readFile(path.join(host, "convex.json"), "utf8")).toBe(functionsConfig);
  expect(await fs.readFile(path.join(host, "sentinel.txt"), "utf8")).toBe("unrelated host bytes\r\n");
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => { throw new Error("Installed config could not be parsed"); } })!;
  expect(parsed.errors).toEqual([]);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const compiled = new Set(program.getSourceFiles().map(file => path.resolve(file.fileName)));
  expect(runtimeFiles.filter(file => !compiled.has(path.resolve(host, functionsRoot, file)))).toEqual([]);
  await fs.appendFile(path.join(host, functionsRoot, "host.ts"), 'export const bad = query({ args: {}, handler: () => { const value: string = 42; return value; } });\n');
  await expect(execute(process.execPath, args, { cwd: host, timeout: 60000 })).rejects.toMatchObject({
    code: 2, stdout: expect.stringContaining("Type 'number' is not assignable to type 'string'"),
  });
  expect(await fs.pathExists(path.join(host, functionsRoot, "host.js"))).toBe(false);
  expect(await fs.readFile(configPath, "utf8")).toBe(bytes);
}, 120000);

it("the full installed runtime typechecks with fresh defaults and still rejects a bad app function", async () => {
  await fs.writeJson(path.join(host, "package.json"), { name: "fresh-runtime-host" });
  await installSdk(host, { sdkPackage: candidate, install: false, deploy: false });
  await positionOfflineBindings();
  // Reused genuine typed server/data model/component bytes plus the official
  // current API template are an offline oracle. Actual enabled codegen remains
  // required in CI; this check does not claim to have run it or deployed.
  const args = [path.join(repository, "node_modules/typescript/bin/tsc"), "--project", path.join(host, "convex"), "--pretty", "false"];
  const checked = await execute(process.execPath, args, { cwd: host, timeout: 60000 })
    .then(result => ({ code: 0, ...result }), (error: { code: number; stdout: string; stderr: string }) => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
  expect(checked).toEqual({ code: 0, stdout: "", stderr: "" });
  await fs.writeFile(path.join(host, "convex/invalidApp.ts"), 'import { query } from "./_generated/server"; export const bad = query({ args: {}, handler: () => { const value: string = 42; return value; } });\n');
  await expect(execute(process.execPath, args, { cwd: host, timeout: 60000 })).rejects.toMatchObject({
    code: 2, stdout: expect.stringContaining("Type 'number' is not assignable to type 'string'"),
  });
  expect(await fs.pathExists(path.join(host, "convex/invalidApp.js"))).toBe(false);
}, 120000);

it("a plain existing host receives the selected Node declaration edge while unrelated dependencies survive", async () => {
  await fs.writeJson(path.join(host, "package.json"), {
    name: "dependency-host", dependencies: { unrelated: "^1.0.0" },
    devDependencies: { "@types/node": "^20.0.0", typescript: "~6.0.3" },
    optionalDependencies: { "@types/node": "^18.0.0", unrelatedOptional: "^2.0.0" },
  });
  await installSdk(host, { sdkPackage: candidate, install: false, deploy: false });
  const manifest = await fs.readJson(path.join(host, "package.json"));
  expect(manifest.dependencies["@types/node"]).toBe("26.6.4");
  expect(manifest.dependencies.unrelated).toBe("^1.0.0");
  expect(manifest.devDependencies).toEqual({ typescript: "~6.0.3" });
  expect(manifest.optionalDependencies).toEqual({ unrelatedOptional: "^2.0.0" });
  expect((await fs.readJson(path.join(host, "convex/tsconfig.json"))).compilerOptions.types).toEqual(["node"]);
});

it.each([
  { overrides: { "@types/node": "20.0.0" } },
  { pnpm: { overrides: { "parent>@types/node": "20.0.0" } } },
])("a conflicting Node declaration override refuses installation before host writes: %j", async (overrides) => {
  const original = JSON.stringify({ name: "preserved-host", ...overrides }) + "\n";
  await fs.writeFile(path.join(host, "package.json"), original);
  await fs.writeFile(path.join(host, "sentinel.txt"), "preserve\n");
  await expect(installSdk(host, { sdkPackage: candidate, install: false, deploy: false })).rejects.toThrow("RUNTIME_DEPENDENCY_OVERRIDE");
  expect(await fs.readFile(path.join(host, "package.json"), "utf8")).toBe(original);
  expect((await fs.readdir(host)).sort()).toEqual(["package.json", "sentinel.txt"]);
});

it("the full runtime composer retains an existing custom host config byte for byte", async () => {
  const bytes = Buffer.from('\uFEFF{\r\n // host types stay explicit\r\n "compilerOptions": { "types": ["node", "custom"], "strict": true }\r\n}\r\n');
  await fs.writeFile(path.join(host, "convex.json"), '{"functions":"functions/private/"}\n');
  await fs.outputFile(path.join(host, "functions/private/tsconfig.json"), bytes);
  await installAdditiveBackend(host, candidate);
  expect(await fs.readFile(path.join(host, "functions/private/tsconfig.json"))).toEqual(bytes);
  expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
});
