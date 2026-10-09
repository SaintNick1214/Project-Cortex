#!/usr/bin/env node
// Bind every Cortex SDK/provider edge to the archives under review before resolution.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

function run(command, args, cwd, capture = false) {
  return execFileSync(command, args, {
    cwd, encoding: "utf8", timeout: 10 * 60 * 1000,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 4 * 1024 * 1024,
  });
}

async function archiveInfo(path, expectedName) {
  const file = await realpath(resolve(path));
  const manifest = JSON.parse(run("tar", ["-xOf", file, "package/package.json"], undefined, true));
  if (manifest.name !== expectedName || typeof manifest.version !== "string")
    throw new Error(`Expected an archive for ${expectedName}`);
  const integrity = `sha512-${createHash("sha512").update(await readFile(file)).digest("base64")}`;
  return { name: expectedName, version: manifest.version, file, integrity };
}

function installedManifest(require, name) {
  // SDK exports intentionally do not expose package.json. Walk from its real entrypoint.
  let directory = dirname(require.resolve(name));
  return (async () => {
    for (;;) {
      try {
        const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
        if (manifest.name === name) return { manifest, directory };
      } catch (error) { if (error.code !== "ENOENT") throw error; }
      const parent = dirname(directory);
      if (parent === directory) throw new Error(`Cannot locate installed ${name}`);
      directory = parent;
    }
  })();
}

export async function installCiDemo({ directory, sdkArchive, providerArchive, cliSource }) {
  const cwd = resolve(directory);
  const manifestPath = join(cwd, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const sdk = "@cortexmemory/sdk";
  const provider = "@cortexmemory/vercel-ai-provider";
  if (!manifest.dependencies?.[sdk]) throw new Error("Demo must declare the Cortex SDK dependency");
  const needsProvider = Boolean(manifest.dependencies[provider]);
  if (needsProvider && !providerArchive) throw new Error("Demo requires --provider-archive");
  const artifacts = [await archiveInfo(sdkArchive, sdk)];
  if (needsProvider) artifacts.push(await archiveInfo(providerArchive, provider));
  const match = /^(npm|pnpm)@(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(manifest.packageManager ?? "");
  if (!match) throw new Error("Demo must pin a supported npm or pnpm packageManager");
  const manager = match[1];
  const actualVersion = run(manager, ["--version"], cwd, true).trim();
  if (actualVersion !== match[2]) throw new Error(`Expected ${manager}@${match[2]}, found ${actualVersion}`);

  for (const artifact of artifacts) manifest.dependencies[artifact.name] = `file:${artifact.file}`;
  if (manager === "pnpm") {
    manifest.pnpm ??= {};
    manifest.pnpm.overrides ??= {};
    for (const artifact of artifacts) manifest.pnpm.overrides[artifact.name] = `$${artifact.name}`;
  } else {
    manifest.overrides ??= {};
    for (const artifact of artifacts) manifest.overrides[artifact.name] = `$${artifact.name}`;
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (manager === "pnpm") {
    run(manager, ["install", "--lockfile-only", "--no-frozen-lockfile"], cwd);
    run(manager, ["install", "--frozen-lockfile"], cwd);
  } else {
    run(manager, ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--workspaces=false"], cwd);
    run(manager, ["ci", "--no-audit", "--no-fund", "--workspaces=false"], cwd);
  }

  const require = createRequire(manifestPath);
  const installed = new Map();
  for (const artifact of artifacts) {
    const info = await installedManifest(require, artifact.name);
    if (info.manifest.version !== artifact.version) throw new Error(`Wrong installed ${artifact.name} version`);
    installed.set(artifact.name, info);
  }
  if (needsProvider) {
    const providerRequire = createRequire(join(installed.get(provider).directory, "package.json"));
    const nested = await installedManifest(providerRequire, sdk);
    if (await realpath(nested.directory) !== await realpath(installed.get(sdk).directory))
      throw new Error("Provider resolves a different SDK than the selected candidate");
  }
  if (cliSource) {
    const cliRoot = await realpath(resolve(cliSource));
    const cliManifest = JSON.parse(await readFile(join(cliRoot, "package.json"), "utf8"));
    if (cliManifest.name !== "@cortexmemory/cli" || !/^\d+\.\d+\.\d+$/.test(cliManifest.version))
      throw new Error("Backend preparation requires an explicit built Cortex CLI package");
    const { planBackendSync, applyBackendPlan } = await import(pathToFileURL(join(cliRoot, "dist/utils/schema-sync.js")).href);
    const template = manifest.name === "@cortexmemory/chat-sdk-quickstart" ? "chat-sdk" :
      manifest.name === "@cortexmemory/vercel-ai-quickstart" ? "vercel-ai-quickstart" : undefined;
    if (needsProvider && !template) throw new Error("Unrecognized canonical demo for backend preparation");
    const plan = planBackendSync(cwd, installed.get(sdk).directory, template ? { template } : undefined);
    applyBackendPlan(plan);
    console.log(`Prepared ${template ?? "basic"} backend from the installed candidate; native Convex codegen is still required.`);
  }
  console.log(JSON.stringify({ manager: `${manager}@${actualVersion}`, artifacts }, null, 2));
  return artifacts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: {
      directory: { type: "string" }, "sdk-archive": { type: "string" }, "provider-archive": { type: "string" }, "cli-source": { type: "string" },
    } });
    if (!values.directory || !values["sdk-archive"])
      throw new Error("Usage: install-ci-demo.mjs --directory <demo> --sdk-archive <archive> [--provider-archive <archive>] [--cli-source <built-cli-directory>]");
    await installCiDemo({ directory: values.directory, sdkArchive: values["sdk-archive"], providerArchive: values["provider-archive"], cliSource: values["cli-source"] });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
