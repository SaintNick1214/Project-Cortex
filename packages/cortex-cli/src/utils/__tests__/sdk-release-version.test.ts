import { afterEach, expect, it } from "@jest/globals";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { SDK_VERSION } from "../schema-sync.js";

const execute = promisify(execFile);
const roots: string[] = [];
const cli = fileURLToPath(new URL("../../../", import.meta.url));
const repository = fileURLToPath(new URL("../../../../../", import.meta.url));

afterEach(async () => {
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

async function composer(metadata: unknown): Promise<{ module: string; cwd: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-release-sdk-"));
  roots.push(root);
  const owner = path.join(root, "cli"), utils = path.join(owner, "dist/utils"), cwd = path.join(root, "host");
  await fs.mkdir(utils, { recursive: true });
  await fs.mkdir(cwd);
  // Load the actual built composer, with only its package metadata isolated.
  for (const file of ["schema-sync.js", "safe-file.js", "template-backend.js"])
    await fs.copyFile(path.join(cli, "dist/utils", file), path.join(utils, file));
  // Let malformed owning metadata reach the product check, before Node parses it.
  await fs.writeFile(path.join(owner, "dist/package.json"), JSON.stringify({ type: "module" }));
  await fs.writeFile(path.join(owner, "package.json"), typeof metadata === "string" ? metadata : JSON.stringify(metadata));
  await fs.writeFile(path.join(cwd, "package.json"), JSON.stringify({
    name: "@cortexmemory/cli", type: "module", dependencies: { "@cortexmemory/sdk": "^99.0.0" },
  }));
  return { module: pathToFileURL(path.join(utils, "schema-sync.js")).href, cwd };
}

const metadata = (dependency: unknown) => ({
  name: "@cortexmemory/cli", type: "module", dependencies: { "@cortexmemory/sdk": dependency },
});

async function exportedVersion(value: unknown): Promise<string> {
  const fixture = await composer(value);
  const result = await execute(process.execPath, ["--input-type=module", "-e", `
    const { SDK_VERSION } = await import(process.argv[1]);
    console.log(SDK_VERSION);
  `, fixture.module], { cwd: fixture.cwd, timeout: 10000, maxBuffer: 16384 });
  return result.stdout.trim();
}

it("keeps the source baseline target and ignores a host package's dependency", async () => {
  expect(SDK_VERSION).toBe("0.39.0");
  const ownedManifest = JSON.parse(await fs.readFile(path.join(cli, "package.json"), "utf8"));
  expect(await exportedVersion(ownedManifest)).toBe("0.39.0");
});

it("the release plan changes the actual exported target while package and backend guards stay exact", async () => {
  // Execute the real offline release contract; no registry request or real manifest write.
  const planned = await execute(process.execPath, ["--input-type=module", "-e", `
    import { readFileSync } from "node:fs";
    import { join } from "node:path";
    const { createReleasePlan, releasePackages } = await import(process.argv[1]);
    const manifests = Object.fromEntries(releasePackages.map(pkg => [pkg.folder,
      JSON.parse(readFileSync(join(process.argv[2], pkg.folder, "package.json"), "utf8"))]));
    const sourceSha = "a".repeat(40);
    const plan = createReleasePlan({ paths: { sha: sourceSha, sdk: true }, sourceSha,
      readManifest: folder => manifests[folder],
      registry: name => { const pkg = releasePackages.find(pkg => pkg.name === name);
        return { version: manifests[pkg.folder].version, gitHead: "b".repeat(40) }; },
      diffPaths: () => "",
    });
    const cli = plan.packages.find(pkg => pkg.key === "cli"), manifest = manifests[cli.folder];
    manifest.version = cli.version;
    for (const dependency of plan.packages)
      if (manifest.dependencies?.[dependency.name]) manifest.dependencies[dependency.name] = "^" + dependency.version;
    console.log(JSON.stringify({ manifest, sdk: plan.packages[0].version,
      sdkChanged: plan.packages[0].changed, cliChanged: cli.changed }));
  `, pathToFileURL(path.join(repository, "scripts/release-contract.mjs")).href, repository], {
    cwd: cli, timeout: 10000, maxBuffer: 16384,
  });
  const plan = JSON.parse(planned.stdout);
  expect(plan).toMatchObject({ sdk: "0.39.1", sdkChanged: true, cliChanged: true });
  expect(plan.manifest.dependencies["@cortexmemory/sdk"]).toBe("^0.39.1");
  const fixture = await composer(plan.manifest);
  const result = await execute(process.execPath, ["--input-type=module", "-e", `
    const { SDK_VERSION, validateSdkPackage, hashBytes } = await import(process.argv[1]);
    const expected = process.argv[2], payload = Buffer.from("guarded backend fixture");
    function check(version, sdkVersion, name = "@cortexmemory/sdk") {
      const view = {
        manifest: Buffer.from(JSON.stringify({ name, version })), entries: [],
        files: { "schema.ts": Buffer.from("export default {};"), "admin.ts": Buffer.from("fixture") },
        distribution: {
          "manifest.json": Buffer.from(JSON.stringify({ formatVersion: 1, sdkVersion,
            files: [{ path: "runtimeClient.ts", sha256: hashBytes(payload) }] })),
          "runtimeClient.ts": payload,
        },
      };
      try { return { accepted: true, version: validateSdkPackage(process.cwd(), view).version }; }
      catch (error) { return { accepted: false, error: error.message }; }
    }
    console.log(JSON.stringify({ target: SDK_VERSION, exact: check(expected, expected),
      oldPackage: check("0.39.0", expected), newerPackage: check("0.39.2", expected),
      oldBackend: check(expected, "0.39.0"), newerBackend: check(expected, "0.39.2"),
      wrongIdentity: check(expected, expected, "other-sdk") }));
  `, fixture.module, plan.sdk], { cwd: fixture.cwd, timeout: 10000, maxBuffer: 16384 });
  expect(JSON.parse(result.stdout)).toEqual({
    target: "0.39.1", exact: { accepted: true, version: "0.39.1" },
    oldPackage: { accepted: false, error: "Use a fixed @cortexmemory/sdk@0.39.1 candidate; package identity/version rejected" },
    newerPackage: { accepted: false, error: "Use a fixed @cortexmemory/sdk@0.39.1 candidate; package identity/version rejected" },
    oldBackend: { accepted: false, error: "Invalid current backend distribution" },
    newerBackend: { accepted: false, error: "Invalid current backend distribution" },
    wrongIdentity: { accepted: false, error: "Use a fixed @cortexmemory/sdk@0.39.1 candidate; package identity/version rejected" },
  });
});

it.each([
  undefined, null, "", "0.39.1", "~0.39.1", ">=0.39.1", "^0.39.1 || ^0.40.0", "*",
  "workspace:^", "file:../sdk", "^0.39", "^00.39.1", "^0.39.1-beta.0", "^0.39.1+build",
  " ^0.39.1", "^0.39.1\n", "^9007199254740992.0.0", 39, ["^0.39.1"],
])("unsupported SDK dependency metadata fails closed: %j", async (dependency) => {
  await expect(exportedVersion(metadata(dependency))).rejects.toThrow("Invalid CLI release metadata");
});

it.each([
  null, [], {}, { name: "other", dependencies: { "@cortexmemory/sdk": "^0.39.1" } },
  { name: "@cortexmemory/cli", dependencies: null }, { name: "@cortexmemory/cli", dependencies: [] },
  "{malformed-json",
])("malformed or foreign owning metadata fails clearly: %j", async (value) => {
  await expect(exportedVersion(value)).rejects.toThrow("Invalid CLI release metadata");
});
