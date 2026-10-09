import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { installCiDemo, prepareCiDemoBackend } from "./install-ci-demo.mjs";

async function fixture(manager) {
  const directory = await mkdtemp(join(tmpdir(), "cortex-ci-install-"));
  const archives = {};
  for (const [label, name] of [["sdk", "@cortexmemory/sdk"], ["provider", "@cortexmemory/vercel-ai-provider"]]) {
    const source = join(directory, label);
    await mkdir(join(source, "package"), { recursive: true });
    await writeFile(join(source, "package/package.json"), JSON.stringify({
      name, version: "999.999.0", main: "index.cjs",
      ...(label === "provider" ? { dependencies: { "@cortexmemory/sdk": "^999.999.0" } } : {}),
    }));
    await writeFile(join(source, "package/index.cjs"), label === "sdk" ? 'module.exports = "candidate SDK";' : 'module.exports = require("@cortexmemory/sdk");');
    archives[label] = join(directory, `${label}.tgz`);
    execFileSync("tar", ["-czf", archives[label], "-C", source, "package"]);
  }
  const demo = join(directory, "demo");
  await mkdir(demo);
  const manifest = { name: "ci-fixture", version: "1.0.0", private: true, packageManager: manager,
    dependencies: { "@cortexmemory/sdk": "^999.999.0", "@cortexmemory/vercel-ai-provider": "^999.999.0" } };
  await writeFile(join(demo, "package.json"), JSON.stringify(manifest));
  return { directory, demo, archives, manifest };
}

for (const manager of ["npm@12.2.0", "pnpm@10.33.0"]) {
  test(`${manager} installs an unpublished transitive SDK candidate with ordinary frozen policy`, async () => {
    const f = await fixture(manager);
    try {
      const artifacts = await installCiDemo({ directory: f.demo, sdkArchive: f.archives.sdk, providerArchive: f.archives.provider });
      const installed = execFileSync(process.execPath, ["-e", 'console.log(require("@cortexmemory/vercel-ai-provider"))'], { cwd: f.demo, encoding: "utf8" });
      assert.equal(installed.trim(), "candidate SDK");
      const manifest = JSON.parse(await readFile(join(f.demo, "package.json"), "utf8"));
      assert.equal(manifest.dependencies["@cortexmemory/sdk"], `file:${await realpath(f.archives.sdk)}`);
      const lock = await readFile(join(f.demo, manager.startsWith("npm") ? "package-lock.json" : "pnpm-lock.yaml"), "utf8");
      for (const artifact of artifacts) assert.ok(lock.includes(artifact.integrity), `selected archive integrity missing for ${artifact.name}`);
      assert.ok(!lock.includes("https://registry.npmjs.org/@cortexmemory"));
    } finally { await rm(f.directory, { recursive: true, force: true }); }
  });
}

test("missing provider and wrong archive identity fail before manifest mutation", async () => {
  const f = await fixture("pnpm@10.33.0");
  try {
    const original = await readFile(join(f.demo, "package.json"), "utf8");
    await assert.rejects(installCiDemo({ directory: f.demo, sdkArchive: f.archives.sdk }), /requires --provider-archive/);
    await assert.rejects(installCiDemo({ directory: f.demo, sdkArchive: f.archives.provider, providerArchive: f.archives.provider }), /Expected an archive for @cortexmemory\/sdk/);
    assert.equal(await readFile(join(f.demo, "package.json"), "utf8"), original);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("unsupported manager fails before manifest mutation", async () => {
  const f = await fixture("yarn@4.0.0");
  try {
    const original = await readFile(join(f.demo, "package.json"), "utf8");
    await assert.rejects(installCiDemo({ directory: f.demo, sdkArchive: f.archives.sdk, providerArchive: f.archives.provider }), /supported npm or pnpm/);
    assert.equal(await readFile(join(f.demo, "package.json"), "utf8"), original);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("CLI invocation through a symlink validates required arguments and exits with failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cortex-ci-cli-"));
  try {
    const script = join(directory, "install-ci-demo.mjs");
    await symlink(fileURLToPath(new URL("./install-ci-demo.mjs", import.meta.url)), script);
    assert.throws(() => execFileSync(process.execPath, [script], { encoding: "utf8", stdio: "pipe" }), error => {
      assert.equal(error.status, 1);
      assert.match(error.stderr, /Usage: install-ci-demo\.mjs/);
      return true;
    });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function backendFixture(version) {
  const directory = await mkdtemp(join(tmpdir(), "cortex-ci-compose-"));
  const demo = join(directory, "demo"), sdk = join(directory, "sdk"), cli = join(directory, "cli");
  await mkdir(join(demo, "convex"), { recursive: true });
  await mkdir(join(sdk, "dist/backend/v1"), { recursive: true });
  await mkdir(join(cli, "dist/utils"), { recursive: true });
  await writeFile(join(cli, "package.json"), JSON.stringify({ name: "@cortexmemory/cli", version: "0.38.0", type: "module" }));
  await writeFile(join(demo, "convex/sdk.registration.ts"), "export { internalMutation as mutation } from './_generated/server';\n");
  await writeFile(join(sdk, "dist/backend/v1/manifest.json"), JSON.stringify({ files: ["runtimeRuns.ts", "runtimeMediaDelivery.ts"] }));
  for (const file of ["runtimeRuns.ts", "runtimeMediaDelivery.ts"])
    await writeFile(join(sdk, "dist/backend/v1", file), `export const candidate = ${JSON.stringify(file)};\n`);
  await writeFile(join(cli, "dist/utils/runtime-backend.js"), `
    import { readFile, writeFile } from 'node:fs/promises';
    import { join } from 'node:path';
    export async function planRuntimeBackend(project, sdk) {
      const manifest = JSON.parse(await readFile(join(sdk, 'dist/backend/v1/manifest.json'), 'utf8'));
      const files = Object.fromEntries(await Promise.all(manifest.files.map(async name => [name, await readFile(join(sdk, 'dist/backend/v1', name))])));
      return { project, sdk, files, conflicts: [], runtime: { files: manifest.files, requiredDependencies: manifest.dependencies ?? { "fast-sha256": "1.3.0" } } };
    }
    export async function applySelectedBackendPlan(plan) {
      for (const [name, bytes] of Object.entries(plan.files)) await writeFile(join(plan.project, 'convex', name), bytes);
      await writeFile(join(plan.project, 'runtime-selection.json'), JSON.stringify({ sdk: plan.sdk, files: Object.keys(plan.files) }));
    }
  `);
  await writeFile(join(cli, "dist/utils/schema-sync.js"), `
    import { writeFileSync } from 'node:fs';
    import { join } from 'node:path';
    export function planBackendSync(project, sdk, options) { return { project, sdk, options, conflicts: [] }; }
    export function applyBackendPlan(plan) { writeFileSync(join(plan.project, 'legacy-selection.json'), JSON.stringify(plan)); }
  `);
  const manifest = { name: "@cortexmemory/vercel-ai-quickstart", version, dependencies: { "@cortexmemory/vercel-ai-provider": "file:candidate", "fast-sha256": "1.3.0" } };
  return { directory, demo, sdk, cli, manifest };
}

test("1.3 runtime preparation awaits the selected additive composer and preserves the private app registration", async () => {
  const f = await backendFixture("1.3.0");
  try {
    const shim = await readFile(join(f.demo, "convex/sdk.registration.ts"));
    const plan = await prepareCiDemoBackend({ directory: f.demo, sdkDirectory: f.sdk, cliSource: f.cli, manifest: f.manifest });
    assert.deepEqual(Object.keys(plan.files), ["runtimeRuns.ts", "runtimeMediaDelivery.ts"]);
    for (const file of Object.keys(plan.files)) assert.deepEqual(await readFile(join(f.demo, "convex", file)), await readFile(join(f.sdk, "dist/backend/v1", file)));
    assert.deepEqual(await readFile(join(f.demo, "convex/sdk.registration.ts")), shim);
    assert.deepEqual(JSON.parse(await readFile(join(f.demo, "runtime-selection.json"))), { sdk: f.sdk, files: Object.keys(plan.files) });
    await assert.rejects(readFile(join(f.demo, "legacy-selection.json")), { code: "ENOENT" });
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("immutable 1.2 explicitly retains the recognized legacy private composer even with runtime bytes present", async () => {
  const f = await backendFixture("1.2.0");
  try {
    const shim = await readFile(join(f.demo, "convex/sdk.registration.ts"));
    await prepareCiDemoBackend({ directory: f.demo, sdkDirectory: f.sdk, cliSource: f.cli, manifest: f.manifest });
    const selected = JSON.parse(await readFile(join(f.demo, "legacy-selection.json")));
    assert.deepEqual(selected.options, { template: "vercel-ai-quickstart" });
    assert.equal(selected.sdk, f.sdk);
    assert.deepEqual(await readFile(join(f.demo, "convex/sdk.registration.ts")), shim);
    await assert.rejects(readFile(join(f.demo, "runtime-selection.json")), { code: "ENOENT" });
    await assert.rejects(readFile(join(f.demo, "convex/runtimeRuns.ts")), { code: "ENOENT" });
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("runtime composition missing its distribution fails without falling back to legacy or changing app bytes", async () => {
  const f = await backendFixture("1.3.0");
  try {
    const shim = await readFile(join(f.demo, "convex/sdk.registration.ts"));
    await rm(join(f.sdk, "dist/backend/v1/manifest.json"));
    await assert.rejects(prepareCiDemoBackend({ directory: f.demo, sdkDirectory: f.sdk, cliSource: f.cli, manifest: f.manifest }), { code: "ENOENT" });
    assert.deepEqual(await readFile(join(f.demo, "convex/sdk.registration.ts")), shim);
    await assert.rejects(readFile(join(f.demo, "legacy-selection.json")), { code: "ENOENT" });
    await assert.rejects(readFile(join(f.demo, "runtime-selection.json")), { code: "ENOENT" });
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("unreviewed template versions and unknown provider templates refuse before composition", async () => {
  const f = await backendFixture("1.4.0");
  try {
    await assert.rejects(prepareCiDemoBackend({ directory: f.demo, sdkDirectory: f.sdk, cliSource: f.cli, manifest: f.manifest }), /explicit canonical template version/);
    await assert.rejects(prepareCiDemoBackend({ directory: f.demo, sdkDirectory: f.sdk, cliSource: f.cli, manifest: { ...f.manifest, name: "unknown", version: "1.3.0" } }), /Unrecognized canonical demo/);
    await assert.rejects(readFile(join(f.demo, "legacy-selection.json")), { code: "ENOENT" });
    await assert.rejects(readFile(join(f.demo, "runtime-selection.json")), { code: "ENOENT" });
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});


test("direct runtime preparation refuses missing app dependencies before writing backend files", async () => {
  const f = await backendFixture("1.3.0");
  try {
    delete f.manifest.dependencies["fast-sha256"];
    await assert.rejects(prepareCiDemoBackend({ directory: f.demo, sdkDirectory: f.sdk, cliSource: f.cli, manifest: f.manifest }), /must be declared before installation: fast-sha256/);
    await assert.rejects(readFile(join(f.demo, "convex/runtimeRuns.ts")), { code: "ENOENT" });
    await assert.rejects(readFile(join(f.demo, "runtime-selection.json")), { code: "ENOENT" });
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("direct runtime preparation refuses a wider AI SDK range before writing qualified backend files", async () => {
  const f = await backendFixture("1.3.0");
  try {
    const backend = JSON.parse(await readFile(join(f.sdk, "dist/backend/v1/manifest.json"), "utf8"));
    backend.dependencies = { "fast-sha256": "1.3.0", ai: "7.0.127" };
    await writeFile(join(f.sdk, "dist/backend/v1/manifest.json"), JSON.stringify(backend));
    f.manifest.dependencies.ai = "^7.0.127";
    await assert.rejects(prepareCiDemoBackend({ directory: f.demo, sdkDirectory: f.sdk, cliSource: f.cli, manifest: f.manifest }), /must match qualified pins.*ai/);
    await assert.rejects(readFile(join(f.demo, "convex/runtimeRuns.ts")), { code: "ENOENT" });
    await assert.rejects(readFile(join(f.demo, "runtime-selection.json")), { code: "ENOENT" });
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("direct runtime preparation refuses a competing optional qualified dependency before backend writes", async () => {
  const f = await backendFixture("1.3.0");
  try {
    f.manifest.optionalDependencies = { "fast-sha256": "^1.3.0" };
    await assert.rejects(prepareCiDemoBackend({ directory: f.demo, sdkDirectory: f.sdk, cliSource: f.cli, manifest: f.manifest }), /must have one selected app edge.*fast-sha256/);
    await assert.rejects(readFile(join(f.demo, "convex/runtimeRuns.ts")), { code: "ENOENT" });
    await assert.rejects(readFile(join(f.demo, "runtime-selection.json")), { code: "ENOENT" });
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("selected npm and pnpm override conflicts refuse before backend writes while unrelated overrides survive", async () => {
  const f = await backendFixture("1.3.0");
  try {
    for (const override of [
      { overrides: { "fast-sha256": "^1.3.0" } },
      { overrides: { "fast-sha256@1.3.0": "^1.3.0" } },
      { overrides: { parent: { "fast-sha256": "^1.3.0" } } },
      { pnpm: { overrides: { "parent>fast-sha256": "^1.3.0" } } },
    ]) {
      await assert.rejects(prepareCiDemoBackend({ directory: f.demo, sdkDirectory: f.sdk, cliSource: f.cli, manifest: { ...f.manifest, ...override } }), /RUNTIME_DEPENDENCY_OVERRIDE/);
      await assert.rejects(readFile(join(f.demo, "convex/runtimeRuns.ts")), { code: "ENOENT" });
      await assert.rejects(readFile(join(f.demo, "runtime-selection.json")), { code: "ENOENT" });
    }
    const manifest = { ...f.manifest, overrides: { "fast-sha256": "$fast-sha256", unrelated: "2.0.0" } };
    await prepareCiDemoBackend({ directory: f.demo, sdkDirectory: f.sdk, cliSource: f.cli, manifest });
    assert.deepEqual(manifest.overrides, { "fast-sha256": "$fast-sha256", unrelated: "2.0.0" });
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("pnpm resolves emitted runtime dependencies as direct app edges before the frozen install", async () => {
  const f = await fixture("pnpm@10.33.0");
  try {
    const dependency = join(f.directory, "runtime-dependency");
    await mkdir(dependency);
    await writeFile(join(dependency, "package.json"), JSON.stringify({name:"runtime-fixture-dependency",version:"1.0.0",main:"index.cjs"}));
    await writeFile(join(dependency, "index.cjs"), 'module.exports = "runtime dependency";');
    const backendDirectory = join(f.directory, "sdk/package/dist/backend/v1");
    await mkdir(backendDirectory, {recursive:true});
    await writeFile(join(backendDirectory, "manifest.json"), JSON.stringify({dependencies:{"runtime-fixture-dependency":`file:${dependency}`}}));
    execFileSync("tar", ["-czf", f.archives.sdk, "-C", join(f.directory, "sdk"), "package"]);
    f.manifest.version="1.3.0";
    // An existing app edge must not supersede the selected runtime contract.
    f.manifest.dependencies["runtime-fixture-dependency"] = "file:missing-old-runtime";
    f.manifest.devDependencies = { "runtime-fixture-dependency": "file:missing-dev-runtime" };
    f.manifest.optionalDependencies = { "runtime-fixture-dependency": "file:missing-optional-runtime" };
    await writeFile(join(f.demo,"package.json"),JSON.stringify(f.manifest));
    await installCiDemo({directory:f.demo,sdkArchive:f.archives.sdk,providerArchive:f.archives.provider});
    const appManifest=JSON.parse(await readFile(join(f.demo,"package.json"),"utf8"));
    assert.equal(appManifest.dependencies["runtime-fixture-dependency"],`file:${dependency}`);
    assert.equal(Object.hasOwn(appManifest.devDependencies, "runtime-fixture-dependency"), false);
    assert.equal(Object.hasOwn(appManifest.optionalDependencies, "runtime-fixture-dependency"), false);
    await mkdir(join(f.demo,"convex"));
    await writeFile(join(f.demo,"convex/consumer.cjs"),'module.exports = require("runtime-fixture-dependency");');
    const resolved=execFileSync(process.execPath,["-e",'console.log(require("./convex/consumer.cjs"))'],{cwd:f.demo,encoding:"utf8"});
    assert.equal(resolved.trim(),"runtime dependency");
  } finally { await rm(f.directory, {recursive:true,force:true}); }
});
