import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, linkSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { checksumFor, cleanupCommandFixtures, dependencyBinding, npmRootFromPath, prepareCommandFixtures, probeSupportedRuntime, supportsFixtureRuntime } from "./command-fixtures.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function owned(testContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cortex-command-helper-")));
  testContext.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("official checksum selection requires exactly one exact safe file and accepts GNU binary marker", () => {
  const sha = "a".repeat(64), file = "node-v20.0.0-linux-x64.tar.xz";
  assert.equal(checksumFor(`${sha}  ${file}\n${"b".repeat(64)}  other.tar.xz\n`, file), sha);
  assert.equal(checksumFor(`${sha} *${file}\n`, file), sha);
  for (const text of [`${sha}  other.tar.xz`, `${sha}  ${file}\n${sha}  ${file}`, `not-a-hash ${file}`]) {
    assert.throws(() => checksumFor(text, file), /CHECKSUM_INVALID/);
  }
});
test("supported fixture runtime uses the actual running binary version and digest with the declared semver boundary", () => {
  const npmRoot = npmRootFromPath();
  for (const [version, supported] of [
    ["20.0.0", false], ["20.20.2", false], ["22.16.0", false], ["24.14.9", false],
    ["24.15.0", true], ["24.21.0", true], ["25.0.0", true], ["24.15.0-rc.1", false], ["invalid", false],
  ]) assert.equal(supportsFixtureRuntime(version, npmRoot), supported, version);
  const node = realpathSync(process.execPath), proof = probeSupportedRuntime(node, npmRoot);
  assert.equal(proof.version, process.versions.node);
  assert.equal(proof.requiredRange, ">=24.15.0");
  assert.equal(proof.binarySHA256, createHash("sha256").update(readFileSync(node)).digest("hex"));
});

test("current dependency view selects actual CLI overrides and binds genuine built SDK bytes", () => {
  const binding = dependencyBinding(repository, npmRootFromPath());
  assert.match(binding.sdkManifestSHA256, /^[a-f0-9]{64}$/);
  assert.ok(Object.keys(binding.sdkArtifacts).length > 156);
  assert.ok(binding.sdkArtifacts["dist/backend/v1/manifest.json"]);
  assert.ok(binding.dependencies.commander.version.startsWith("15."));
  assert.equal(binding.dependencies["@cortexmemory/sdk"].directory, repository);
  assert.deepEqual(binding.generated, {});
});

test("unbuilt fresh checkout fails before output or environment append", async t => {
  const root = owned(t), fake = join(root, "checkout"), output = join(root, "fixture"), env = join(root, "env");
  mkdirSync(join(fake, "packages/cortex-cli"), { recursive: true });
  writeFileSync(join(fake, "packages/cortex-cli/package.json"), '{"dependencies":{}}');
  writeFileSync(env, "UNCHANGED=1\n");
  await assert.rejects(prepareCommandFixtures({ root: fake, directory: output, envFile: env }), /CLI_BUILD_REQUIRED/);
  assert.equal(existsSync(output), false);
  assert.equal(readFileSync(env, "utf8"), "UNCHANGED=1\n");
});

test("existing, symlink and source outputs are refused without touching unrelated files", async t => {
  const root = owned(t), existing = join(root, "existing"), link = join(root, "link");
  mkdirSync(existing); writeFileSync(join(existing, "sentinel"), "unchanged"); symlinkSync(existing, link, "dir");
  for (const directory of [existing, link, join(repository, "unused-command-fixture")]) {
    await assert.rejects(prepareCommandFixtures({ directory }), /OUTPUT_/);
  }
  assert.equal(readFileSync(join(existing, "sentinel"), "utf8"), "unchanged");
});
test("actual workflow launch delivers an absent environment output as a script argument without native Node preloading", t => {
  const root = owned(t), existing = join(root, "existing"), envFile = join(root, "not-yet-created-env");
  mkdirSync(existing); writeFileSync(join(existing, "sentinel"), "unchanged");
  for (const name of ["pr-checks.yml", "managed-ci.yml"]) {
    const workflow = readFileSync(join(repository, ".github/workflows", name), "utf8");
    const launch = workflow.match(/run: (node(?: --)? scripts\/ci\/command-fixtures\.mjs) prepare/);
    assert.ok(launch, "Actual workflow preparation launch required");
    const result = spawnSync(process.execPath, [...launch[1].split(" ").slice(1), "prepare", "--directory", existing, "--env-file", envFile], {
      cwd: repository, encoding: "utf8", timeout: 10000,
      env: { PATH: process.env.PATH, HOME: root, TMPDIR: root, CI: "true" },
    });
    assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 1);
    assert.match(result.stderr, /COMMAND_FIXTURE_OUTPUT_ALREADY_EXISTS/);
    assert.equal(existsSync(envFile), false);
    assert.equal(readFileSync(join(existing, "sentinel"), "utf8"), "unchanged");
  }
});

test("cleanup refuses unowned roots and links, and is harmless for absent output", t => {
  const root = owned(t), outside = join(root, "outside"), link = join(root, "link");
  mkdirSync(outside); writeFileSync(join(outside, "sentinel"), "unchanged"); symlinkSync(outside, link, "dir");
  assert.throws(() => cleanupCommandFixtures(outside));
  assert.throws(() => cleanupCommandFixtures(link), /DIRECTORY_UNSAFE/);
  assert.equal(readFileSync(join(outside, "sentinel"), "utf8"), "unchanged");
  assert.deepEqual(cleanupCommandFixtures(join(root, "absent")), { status: "ALREADY_ABSENT" });
});

test("marked cleanup rejects changed ownership and never follows an inner link into another host", t => {
  const root = owned(t), fixture = join(root, "fixture"), outside = join(root, "outside");
  mkdirSync(fixture, { mode: 0o700 }); mkdirSync(outside);
  writeFileSync(join(outside, "sentinel"), "unchanged"); symlinkSync(outside, join(fixture, "external"), "dir");
  const stat = lstatSync(fixture), marker = { purpose: "cortex-cli-offline-command-fixtures-v1", directory: fixture,
    uid: stat.uid, ino: stat.ino, dev: stat.dev };
  writeFileSync(join(fixture, "owner.json"), JSON.stringify({ ...marker, ino: stat.ino + 1 }));
  assert.throws(() => cleanupCommandFixtures(fixture), /CLEANUP_NOT_OWNED/);
  assert.equal(existsSync(join(fixture, "external")), true);
  writeFileSync(join(fixture, "owner.json"), JSON.stringify(marker));
  assert.deepEqual(cleanupCommandFixtures(fixture), { status: "OWNED_FIXTURES_REMOVED" });
  assert.equal(existsSync(fixture), false);
  assert.equal(readFileSync(join(outside, "sentinel"), "utf8"), "unchanged");
});

test("environment output links and a wrongly selected real runtime fail before output creation", async t => {
  const root = owned(t), file = join(root, "env"), link = join(root, "link"), hard = join(root, "hard");
  writeFileSync(file, "UNCHANGED=1\n"); symlinkSync(file, link); linkSync(file, hard);
  for (const envFile of [link, hard]) {
    const output = join(root, "fixture");
    await assert.rejects(prepareCommandFixtures({ directory: output, envFile }));
    assert.equal(existsSync(output), false);
  }
  await assert.rejects(prepareCommandFixtures({ directory: join(root, "fixture"),
    node20Paths: { "20.0.0": realpathSync(process.execPath), "20.20.2": realpathSync(process.execPath) } }), /NODE_VERSION_UNVERIFIED/);
  assert.equal(readFileSync(file, "utf8"), "UNCHANGED=1\n");
  assert.equal(existsSync(join(root, "fixture")), false);
});

test("runtime effect guard really refuses application writes, config reads and network factories", t => {
  const root = owned(t);
  for (const name of ["home", "tmp"]) mkdirSync(join(root, name), { mode: 0o700 });
  writeFileSync(join(root, "home/.env.local"), "CANARY=must-not-read\n");
  const audit = join(root, "audit.jsonl");
  for (const source of [
    `require('node:fs').writeFileSync(${JSON.stringify(join(root, "app-ran"))},'ran')`,
    `require('node:fs').readFileSync(${JSON.stringify(join(root, "home/.env.local"))})`,
    "require('node:https').get('https://example.invalid')",
  ]) {
    writeFileSync(audit, "", { mode: 0o600 });
    const result = spawnSync(process.execPath, ["--require", join(repository, "scripts/ci/command-runtime-guard.cjs"), "-e", source], {
      encoding: "utf8", timeout: 10000, env: { HOME: join(root, "home"), TMPDIR: join(root, "tmp"),
        NODE20_QUAL_ROOT: root, NODE20_QUAL_AUDIT: audit, LANG: "C" },
    });
    assert.equal(result.error, undefined); assert.equal(result.signal, null); assert.equal(result.status, 1);
    assert.match(result.stderr, /QUALIFICATION_EFFECT_DENIED/);
    const rows = readFileSync(audit, "utf8").trim().split("\n").map(line => JSON.parse(line));
    assert.equal(rows.filter(row => row.kind === "guard-ready").length, 1);
    assert.equal(rows.filter(row => row.kind === "factory-denied").length, 1);
    assert.equal(existsSync(join(root, "app-ran")), false);
  }
});
