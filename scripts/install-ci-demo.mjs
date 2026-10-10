#!/usr/bin/env node
// Bind every Cortex SDK/provider edge to the archives under review before resolution.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const runtimeTemplateVersions = ["1.3.0", "1.4.0", "1.4.1"];

function run(command, args, cwd, capture = false) {
  return execFileSync(command, args, {
    cwd, encoding: "utf8", timeout: 10 * 60 * 1000,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 4 * 1024 * 1024,
  });
}

function assertSelectedOverrides(manifest, selected) {
  const object = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const inspect = (value, location) => {
    if (value === undefined) return;
    if (!object(value)) throw new Error(`RUNTIME_DEPENDENCY_OVERRIDE: invalid ${location}`);
    for (const [selector, override] of Object.entries(value)) {
      const leaf = selector.split(">").at(-1).trim();
      const name = Object.keys(selected).find(candidate => leaf === candidate || leaf.startsWith(`${candidate}@`));
      const specification = object(override) ? override["."] : override;
      if (name && specification !== undefined && specification !== selected[name] && specification !== `$${name}`)
        throw new Error(`RUNTIME_DEPENDENCY_OVERRIDE: ${location}.${selector} conflicts with qualified ${name}`);
      if (object(override)) inspect(override, `${location}.${selector}`);
      else if (name && typeof override !== "string") throw new Error(`RUNTIME_DEPENDENCY_OVERRIDE: invalid ${location}.${selector}`);
    }
  };
  inspect(manifest.overrides, "overrides");
  if (object(manifest.pnpm)) inspect(manifest.pnpm.overrides, "pnpm.overrides");
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

/** Versioned canonical consumers retain their distinct backend registration contracts. */
export async function prepareCiDemoBackend({ directory, sdkDirectory, cliSource, manifest }) {
  const template = manifest.name === "@cortexmemory/chat-sdk-quickstart" ? "chat-sdk" :
    manifest.name === "@cortexmemory/vercel-ai-quickstart" ? "vercel-ai-quickstart" : undefined;
  if (manifest.dependencies?.["@cortexmemory/vercel-ai-provider"] && !template)
    throw new Error("Unrecognized canonical demo for backend preparation");
  if (manifest.version !== "1.2.0" && !runtimeTemplateVersions.includes(manifest.version))
    throw new Error("Backend preparation requires an explicit canonical template version (1.2.0, 1.3.0, 1.4.0 or 1.4.1)");
  const cliRoot = await realpath(resolve(cliSource));
  const cliManifest = JSON.parse(await readFile(join(cliRoot, "package.json"), "utf8"));
  if (cliManifest.name !== "@cortexmemory/cli" || !/^\d+\.\d+\.\d+$/.test(cliManifest.version))
    throw new Error("Backend preparation requires an explicit built Cortex CLI package");
  let plan;
  if (runtimeTemplateVersions.includes(manifest.version)) {
    const { planRuntimeBackend, applySelectedBackendPlan } = await import(pathToFileURL(join(cliRoot, "dist/utils/runtime-backend.js")).href);
    plan = await planRuntimeBackend(directory, sdkDirectory);
    if (plan.conflicts.length) throw new Error(`Runtime backend preparation conflicts: ${plan.conflicts.join("; ")}`);
    const missing = Object.keys(plan.runtime.requiredDependencies).filter(name => !manifest.dependencies?.[name]);
    if (missing.length) throw new Error(`Runtime backend dependencies must be declared before installation: ${missing.join(", ")}`);
    const widerPins = Object.entries(plan.runtime.requiredDependencies)
      .filter(([name, version]) => /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) && manifest.dependencies[name] !== version)
      .map(([name]) => name);
    if (widerPins.length) throw new Error(`Runtime backend dependencies must match qualified pins before preparation: ${widerPins.join(", ")}`);
    const duplicateEdges = Object.keys(plan.runtime.requiredDependencies)
      .filter(name => ["devDependencies", "optionalDependencies"].some(section => Object.hasOwn(manifest[section] ?? {}, name)));
    if (duplicateEdges.length) throw new Error(`Runtime backend dependencies must have one selected app edge before preparation: ${duplicateEdges.join(", ")}`);
    assertSelectedOverrides(manifest, plan.runtime.requiredDependencies);
    await applySelectedBackendPlan(plan);
  } else {
    const { planBackendSync, applyBackendPlan } = await import(pathToFileURL(join(cliRoot, "dist/utils/schema-sync.js")).href);
    plan = planBackendSync(directory, sdkDirectory, template ? { template } : undefined);
    if (plan.conflicts.length) throw new Error(`Legacy backend preparation conflicts: ${plan.conflicts.join("; ")}`);
    applyBackendPlan(plan);
  }
  console.log(`Prepared ${template ?? "basic"} ${runtimeTemplateVersions.includes(manifest.version) ? "runtime" : "legacy private"} backend from the installed candidate; native Convex codegen is still required.`);
  return plan;
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
  const selectedEdges = new Set(artifacts.map(artifact => artifact.name));
  const match = /^(npm|pnpm)@(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(manifest.packageManager ?? "");
  if (!match) throw new Error("Demo must pin a supported npm or pnpm packageManager");
  const manager = match[1];
  const actualVersion = run(manager, ["--version"], cwd, true).trim();
  if (actualVersion !== match[2]) throw new Error(`Expected ${manager}@${match[2]}, found ${actualVersion}`);

  // Emitted Convex files are compiled in the app. Their dependencies must be
  // direct app edges before a strict package manager resolves the candidate.
  if (runtimeTemplateVersions.includes(manifest.version)) {
    const backend = JSON.parse(run("tar", ["-xOf", artifacts[0].file, "package/dist/backend/v1/manifest.json"], undefined, true));
    if (!backend.dependencies || typeof backend.dependencies !== "object" || Array.isArray(backend.dependencies)
      || Object.entries(backend.dependencies).some(([name, version]) => !name || typeof version !== "string" || !version))
      throw new Error("Candidate runtime distribution must declare its backend dependencies");
    // These are disposable canonical CI copies. Match the selected backend's
    // qualified versions before resolving, as the ordinary CLI installer does.
    for (const [name, version] of Object.entries(backend.dependencies)) {
      manifest.dependencies[name] = version;
      selectedEdges.add(name);
    }
  }
  for (const artifact of artifacts) manifest.dependencies[artifact.name] = `file:${artifact.file}`;
  for (const section of ["devDependencies", "optionalDependencies"]) {
    if (!manifest[section]) continue;
    for (const name of selectedEdges) delete manifest[section][name];
  }
  assertSelectedOverrides(manifest, Object.fromEntries([...selectedEdges].map(name => [name, manifest.dependencies[name]])));
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
    run(manager, ["install", "--lockfile-only", "--no-frozen-lockfile", "--ignore-scripts"], cwd);
    run(manager, ["install", "--frozen-lockfile", "--ignore-scripts"], cwd);
  } else {
    run(manager, ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--workspaces=false"], cwd);
    run(manager, ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--workspaces=false"], cwd);
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
  if (cliSource) await prepareCiDemoBackend({ directory: cwd, sdkDirectory: installed.get(sdk).directory, cliSource, manifest });
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
