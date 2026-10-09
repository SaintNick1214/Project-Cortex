import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { installCiDemo } from "./install-ci-demo.mjs";

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
