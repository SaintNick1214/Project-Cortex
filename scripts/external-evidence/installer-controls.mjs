/** Public CLI installation qualification in throwaway hosts; no deployment or provider calls. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

export const PUBLISHED_CONTROLS = Object.freeze({
  cli: { name: "@cortexmemory/cli", version: "0.39.0", sha256: "cbff7c3415ffc710a4517d386861253374b575a37872d3b56a12f8cc602eb24d" },
  sdk: { name: "@cortexmemory/sdk", version: "0.39.0", sha256: "f50b44f3b9ba5ca60f3199d6befa5dd3d1b7da3ce034ab0efa4c309001eb412f" },
});
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

export async function regularFiles(root, prefix = "") {
  const result = {};
  for (const entry of (await fs.readdir(path.join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isSymbolicLink()) throw new Error("Unexpected host symlink: " + relative);
    if (entry.isDirectory()) Object.assign(result, await regularFiles(root, relative));
    else if (entry.isFile()) result[relative] = await fs.readFile(path.join(root, relative));
    else throw new Error("Unexpected special host file: " + relative);
  }
  return result;
}

async function write(root, name, bytes) { await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true }); await fs.writeFile(path.join(root, name), bytes); }

/** Download is forbidden here: exact published distributions must already be in npm cache. */
export async function publishedControls(sourceRoot) {
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "cortex-external-installer-")));
  const modules = path.join(temporary, "node_modules"), scope = path.join(modules, "@cortexmemory");
  await fs.mkdir(scope, { recursive: true });
  const artifacts = {};
  try {
    for (const [kind, expected] of Object.entries(PUBLISHED_CONTROLS)) {
      const packed = JSON.parse(execFileSync("npm", ["pack", expected.name + "@" + expected.version, "--offline", "--ignore-scripts", "--workspaces=false", "--json", "--pack-destination", temporary], { cwd: temporary, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }))[0];
      const archive = path.join(temporary, packed.filename), bytes = await fs.readFile(archive);
      assert.equal(hash(bytes), expected.sha256, "Published " + kind + " differs from the prepared assessment");
      const listing = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n");
      assert.ok(listing.every(name => name.startsWith("package/") && !name.includes("\\") && !name.split("/").includes("..")));
      const directory = path.join(scope, kind);
      await fs.mkdir(directory, { recursive: true });
      execFileSync("tar", ["-xzf", archive, "--strip-components=1", "-C", directory], { stdio: "pipe" });
      const manifest = JSON.parse(await fs.readFile(path.join(directory, "package.json"), "utf8"));
      assert.equal(manifest.name, expected.name); assert.equal(manifest.version, expected.version);
      artifacts[kind] = { directory, sha256: hash(bytes), version: manifest.version };
    }
    // Other dependencies are borrowed without installation or lifecycle scripts.
    // The two published packages above are real independent bytes, not workspace links.
    const sourceModules = path.join(sourceRoot, "node_modules");
    for (const entry of await fs.readdir(sourceModules, { withFileTypes: true })) {
      if (entry.name === ".bin" || entry.name.startsWith(".")) continue;
      if (entry.name.startsWith("@")) {
        await fs.mkdir(path.join(modules, entry.name), { recursive: true });
        for (const child of await fs.readdir(path.join(sourceModules, entry.name))) {
          if (entry.name === "@cortexmemory" && ["sdk", "cli"].includes(child)) continue;
          const destination = path.join(modules, entry.name, child);
          await fs.symlink(await fs.realpath(path.join(sourceModules, entry.name, child)), destination, "dir");
        }
      } else await fs.symlink(await fs.realpath(path.join(sourceModules, entry.name)), path.join(modules, entry.name));
    }
    // npm's workspace graph keeps version-conflicting CLI dependencies nested
    // (Commander15 versus tsup's Commander4). Mirror that actual resolution.
    const nested = path.join(sourceRoot, "packages/cortex-cli/node_modules");
    for (const entry of await fs.readdir(nested, { withFileTypes: true }).catch(error => { if (error.code === "ENOENT") return []; throw error; })) {
      if (entry.name.startsWith(".")) continue;
      const destination = path.join(artifacts.cli.directory, "node_modules", entry.name);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.symlink(await fs.realpath(path.join(nested, entry.name)), destination, "dir");
    }
    return { temporary, ...artifacts, cleanup: () => fs.rm(temporary, { recursive: true, force: true }) };
  } catch (error) { await fs.rm(temporary, { recursive: true, force: true }); throw error; }
}

function firstJson(text) {
  const start = text.indexOf("{");
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i >= 0 && i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error("Public CLI did not return its JSON installation summary");
}

export function runBackendInstall(cliDirectory, host, sdkDirectory, { plan = false } = {}) {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) if (/^(?:CONVEX|CORTEX|OPENAI|ANTHROPIC|GOOGLE|GEMINI|NEO4J|MEMGRAPH)_/.test(name)) delete environment[name];
  const args = [path.join(cliDirectory, "dist/index.js"), "backend", "install", host, "--sdk-path", sdkDirectory, ...(plan ? ["--plan"] : [])];
  const child = spawnSync(process.execPath, args, { cwd: host, env: environment, encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  if (child.error) throw child.error;
  return { code: child.status, summary: child.status === 0 ? firstJson(child.stdout) : undefined,
    diagnostic: child.status === 0 ? undefined : String(child.stderr || child.stdout).slice(0, 8_000) };
}

export async function seedHost(host, { collisionTable } = {}) {
  await fs.mkdir(host, { recursive: true });
  const files = {
    "package.json": JSON.stringify({ name: "external-evidence-owned-host", version: "1.0.0", private: true, type: "module" }, null, 2) + "\n",
    "convex.json": '{ "functions": "backend/" }\n',
    "backend/app.schema.ts": 'import { defineSchema, defineTable } from "convex/server"; import { v } from "convex/values";\nexport default defineSchema({ hunt_records: defineTable({ text: v.string() }).index("by_text", ["text"])' + (collisionTable ? ', ' + collisionTable + ': defineTable({ hostOwned: v.string() })' : '') + ' });\n',
    "backend/schema.ts": 'import { defineSchema } from "convex/server"; import appSchema from "./app.schema";\nexport default defineSchema({ ...appSchema.tables }, { schemaValidation: true });\n',
    "backend/huntFunctions.ts": 'import { query } from "./_generated/server"; export const list = query({ args: {}, handler: async () => "host-owned" });\n',
    "backend/huntHttp.ts": 'import { httpAction } from "./_generated/server"; export const ping = httpAction(async () => new Response("host-owned"));\n',
    "backend/http.ts": 'import { httpRouter } from "convex/server"; import { ping } from "./huntHttp";\nconst http = httpRouter();\nhttp.route({ path: "/hunt/ping", method: "GET", handler: ping });\nexport default http;\n',
    "backend/auth.config.ts": 'export default { providers: [{ domain: "https://host-identity.example", applicationID: "hunt-host" }] };\n',
    "backend/convex.config.ts": 'import { defineApp } from "convex/server"; const app = defineApp(); export default app;\n',
    "host-sentinel.txt": "Host application state is not Cortex-owned.\n",
  };
  for (const [name, bytes] of Object.entries(files)) await write(host, name, bytes);
  return files;
}

function preserveOwned(snapshot, seeded) {
  for (const name of ["package.json", "convex.json", "backend/app.schema.ts", "backend/huntFunctions.ts", "backend/huntHttp.ts", "backend/auth.config.ts", "host-sentinel.txt"]) {
    assert.equal(snapshot[name]?.toString(), seeded[name], "Host-owned bytes changed: " + name);
  }
  assert.ok(snapshot["backend/http.ts"].toString().includes('http.route({ path: "/hunt/ping", method: "GET", handler: ping });'));
  assert.ok(snapshot["backend/schema.ts"].toString().includes("...appSchema.tables"));
  assert.ok(snapshot["backend/schema.ts"].toString().includes("schemaValidation: true"));
}

/** Controlled upgrade evidence only. Actual candidate qualification must rerun on its exact bytes. */
export async function controlledCandidate(oldSdk, destination) {
  await fs.cp(oldSdk, destination, { recursive: true });
  const root = path.join(destination, "dist/backend/v1"), manifestPath = path.join(root, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifest.distributionId += "-immutable-installer-control";
  const existing = manifest.files.find(entry => entry.path === "runtimeClient.ts");
  assert.ok(existing);
  const changed = (await fs.readFile(path.join(root, existing.path), "utf8")) + "\n// Immutable controlled upgrade fixture; not a product feature.\n";
  await fs.writeFile(path.join(root, existing.path), changed); existing.sha256 = hash(changed);
  for (const suffix of ["A", "B"]) {
    const name = "externalInstallerControl" + suffix + ".ts", content = 'export const qualificationControl = "immutable-' + suffix + '";\n';
    await fs.writeFile(path.join(root, name), content); manifest.files.push({ path: name, sha256: hash(content) });
  }
  manifest.files.sort((a, b) => a.path.localeCompare(b.path));
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return destination;
}

async function reviewedManagedUpdate(host, oldSdk, candidateSdk, proposal) {
  const previous = JSON.parse(await fs.readFile(path.join(oldSdk, "dist/backend/v1/manifest.json"), "utf8"));
  const next = JSON.parse(await fs.readFile(path.join(candidateSdk, "dist/backend/v1/manifest.json"), "utf8"));
  const oldByPath = new Map(previous.files.map(entry => ["backend/" + entry.path, entry]));
  const nextByPath = new Map(next.files.map(entry => ["backend/" + entry.path, entry]));
  const updates = [];
  for (const conflict of proposal.conflicts) {
    const old = oldByPath.get(conflict.path), selected = nextByPath.get(conflict.path);
    assert.ok(old && selected, "Review refuses non-distribution/host-owned conflict: " + conflict.path);
    const before = await fs.readFile(path.join(host, conflict.path));
    assert.equal(hash(before), old.sha256, "Managed preimage has an application edit; manual merge required");
    assert.equal(hash(conflict.proposedContent), selected.sha256);
    updates.push({ path: conflict.path, before, after: conflict.proposedContent });
  }
  // Every preimage is checked before the first reviewed replacement.
  for (const update of updates) assert.equal(hash(await fs.readFile(path.join(host, update.path))), hash(update.before));
  for (const update of updates) {
    await fs.writeFile(path.join(host, update.path + ".qualification-before-" + hash(update.before) + ".txt"), update.before, { flag: "wx" });
    const temporary = path.join(host, update.path + ".qualification-" + randomUUID() + ".tmp");
    await fs.writeFile(temporary, update.after, { flag: "wx" }); await fs.rename(temporary, path.join(host, update.path));
  }
  return updates.map(update => update.path);
}

export async function qualifyUpgrade({ cliDirectory, oldSdk, candidateSdk, host }) {
  const seeded = await seedHost(host);
  const firstPlan = runBackendInstall(cliDirectory, host, oldSdk, { plan: true });
  assert.equal(firstPlan.code, 0, firstPlan.diagnostic); assert.deepEqual(firstPlan.summary.conflicts, []);
  assert.equal(Object.keys(await regularFiles(host)).length, Object.keys(seeded).length, "Planning wrote host files");
  assert.equal(runBackendInstall(cliDirectory, host, oldSdk).code, 0);
  const baseline = await regularFiles(host); preserveOwned(baseline, seeded);
  const upgrade = runBackendInstall(cliDirectory, host, candidateSdk, { plan: true });
  assert.equal(upgrade.code, 0, upgrade.diagnostic); assert.ok(upgrade.summary.conflicts.length > 0);
  const refused = runBackendInstall(cliDirectory, host, candidateSdk);
  assert.equal(refused.code, 1);
  const afterRefusal = await regularFiles(host);
  for (const [name, bytes] of Object.entries(baseline)) assert.deepEqual(afterRefusal[name], bytes, "Conflict mutated pre-existing bytes: " + name);
  const additionsAfterRefusal = Object.keys(afterRefusal).filter(name => !(name in baseline));
  assert.ok(additionsAfterRefusal.length === 1 && /^cortex-backend-merge-proposal-[a-f0-9]+\.json$/.test(additionsAfterRefusal[0]), "Only a review proposal may be created on refusal");
  const proposal = JSON.parse(afterRefusal[additionsAfterRefusal[0]].toString());
  const reviewed = await reviewedManagedUpdate(host, oldSdk, candidateSdk, proposal);
  // An interrupted install may have committed one already-identical new file.
  const pending = proposal.changes.filter(change => change.beforeSha256 === null && change.reason === "versioned Cortex backend source");
  assert.ok(pending.length > 0);
  await write(host, pending[0].path, pending[0].content);
  const resumed = runBackendInstall(cliDirectory, host, candidateSdk);
  assert.equal(resumed.code, 0, resumed.diagnostic);
  const repeated = runBackendInstall(cliDirectory, host, candidateSdk);
  assert.equal(repeated.code, 0, repeated.diagnostic); assert.deepEqual(repeated.summary.changes, []);
  const final = await regularFiles(host); preserveOwned(final, seeded);
  for (const entry of JSON.parse(await fs.readFile(path.join(candidateSdk, "dist/backend/v1/manifest.json"), "utf8")).files) {
    assert.equal(hash(final["backend/" + entry.path]), entry.sha256, "Final backend differs from selected distribution");
  }
  return { hostOwnedBytesPreserved: true, hostRouteAndSchemaLogicPreserved: true, refusedBeforeBackendWrites: true,
    reviewedManagedFiles: reviewed, resumedAfterIdenticalPartialFile: pending[0].path, idempotentRetry: true,
    previousSdkVersion: firstPlan.summary.distributionId, candidateDistributionId: upgrade.summary.distributionId };
}

export async function qualifyTableCollision({ cliDirectory, sdk, host }) {
  const manifest = JSON.parse(await fs.readFile(path.join(sdk, "dist/backend/v1/manifest.json"), "utf8"));
  const seeded = await seedHost(host, { collisionTable: manifest.tables[0] });
  const result = runBackendInstall(cliDirectory, host, sdk);
  assert.equal(result.code, 1);
  const final = await regularFiles(host);
  for (const [name, bytes] of Object.entries(seeded)) assert.equal(final[name]?.toString(), bytes);
  assert.ok(!final["backend/_cortex/schema.ts"], "Collision wrote a managed backend helper");
  return { table: manifest.tables[0], refusedBeforeBackendWrites: true };
}
