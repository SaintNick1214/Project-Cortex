/** Actual built-index and relocated ignored-hook candidate outcomes, without runtime resources. */
import { afterEach, beforeAll, beforeEach, expect, it } from "@jest/globals";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync, symlinkSync, cpSync, lstatSync, realpathSync, readdirSync } from "node:fs";
import { dirname, join, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
const cli = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let stage: string;
let dependencyRoot: string;
let npmRoot: string;
function explicitDirectory(name: string): string {
  const value = process.env[name];
  if (!value || !isAbsolute(value)) throw new Error(`BOOTSTRAP_PROOF_INPUT_REQUIRED: ${name} must name an explicit absolute private/trusted directory`);
  const info = lstatSync(value);
  if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(value) !== value) throw new Error(`BOOTSTRAP_PROOF_INPUT_UNSAFE: ${name}`);
  return value;
}
function digest(path: string): string { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
beforeAll(async () => {
  const base = explicitDirectory("CORTEX_BOOTSTRAP_PROOF_ROOT");
  const info = lstatSync(base);
  if ((info.mode & 0o077) || (process.getuid && info.uid !== process.getuid()) || base === cli || base.startsWith(`${cli}/`))
    throw new Error("BOOTSTRAP_PROOF_ROOT_UNSAFE: require a private owned directory outside CLI sources");
  npmRoot = explicitDirectory("CORTEX_BOOTSTRAP_NPM_ROOT");
  dependencyRoot = explicitDirectory("CORTEX_BOOTSTRAP_DEPENDENCY_ROOT");
  const bindingPath = process.env.CORTEX_BOOTSTRAP_DEPENDENCY_BINDING;
  if (!bindingPath || !isAbsolute(bindingPath) || !lstatSync(bindingPath).isFile() || lstatSync(bindingPath).isSymbolicLink()) throw new Error("BOOTSTRAP_PROOF_INPUT_REQUIRED: explicit verified dependency binding JSON");
  const dependencyBinding = JSON.parse(readFileSync(bindingPath, "utf8"));
  const sdk = join(dependencyRoot, "@cortexmemory/sdk");
  if (digest(join(sdk, "package.json")) !== dependencyBinding.sdkManifestSHA256) throw new Error("BOOTSTRAP_PROOF_DEPENDENCY_CHANGED");
  for (const [path, hash] of Object.entries({ ...dependencyBinding.sdkArtifacts, ...dependencyBinding.generated }))
    if (digest(join(sdk, path)) !== hash) throw new Error("BOOTSTRAP_PROOF_DEPENDENCY_CHANGED");
  const npmManifest = JSON.parse(readFileSync(join(npmRoot, "package.json"), "utf8"));
  if (npmManifest.name !== "npm" || npmManifest.version !== "12.2.0") throw new Error("BOOTSTRAP_PROOF_NPM_UNVERIFIED: expected trusted npm 12.2.0");
  if (!existsSync(join(cli, "dist/index.js"))) throw new Error("BOOTSTRAP_PROOF_BUILD_REQUIRED: supply existing compiled CLI; tests never build SDK or CLI");
  expect(readFileSync(join(cli, "dist/index.js"), "utf8").split("\n")[0]).toBe("#!/usr/bin/env -S node --");
  expect(existsSync(join(cli, "dist/cli-main.js"))).toBe(true);
  expect(existsSync(join(cli, "dist/utils/node-runtime.js"))).toBe(true);
  stage = mkdtempSync(join(base, "command-suite-"));
  const fixtureHome = join(stage, "pack-home"); const packed = join(stage, "packed"); const relocated = join(stage, "relocated"); const packSource = join(stage, "pack-source");
  for (const path of [fixtureHome, packed, relocated, packSource]) mkdirSync(path, { mode: 0o700 });
  // Bootstrap archive only: existing compiled bytes/manifest and safe declared script files.
  // Template/full installable packaging remains a separate proof. No repository npmrc is copied.
  for (const path of ["package.json", "dist", "scripts/completions", "scripts/postinstall.js", "scripts/preuninstall.js", "README.md"]) {
    const target = join(packSource, path); mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    cpSync(join(cli, path), target, { recursive: true, dereference: false });
  }
  const result = spawnSync(process.execPath, ["--", join(npmRoot, "bin/npm-cli.js"), "pack", "--ignore-scripts", "--json", "--pack-destination", packed], {
    cwd: packSource, encoding: "utf8", timeout: 30000,
    env: { HOME: fixtureHome, PATH: process.env.PATH ?? "", npm_config_cache: join(stage, "npm-cache"), npm_config_userconfig: join(stage, "absent-user-npmrc"), npm_config_globalconfig: join(stage, "absent-global-npmrc"), npm_config_offline: "true" },
  });
  if (result.error || result.status !== 0) throw new Error("BOOTSTRAP_PROOF_PACK_FAILED: ignored-script local packing failed");
  const packedResult = JSON.parse(result.stdout);
  const inventory = Array.isArray(packedResult) ? packedResult : packedResult && typeof packedResult === "object" ? Object.values(packedResult) : [];
  if (!Array.isArray(inventory) || inventory.length !== 1 || typeof inventory[0].filename !== "string" || !/^[a-zA-Z0-9_.-]+\.tgz$/.test(inventory[0].filename)) throw new Error("BOOTSTRAP_PROOF_ARCHIVE_INVALID");
  const archive = join(packed, inventory[0].filename); const archiveSHA256 = digest(archive);
  const { createRequire } = await import("node:module"); const require = createRequire(import.meta.url);
  const tar = require(join(npmRoot, "node_modules/tar"));
  tar.t({ file: archive, sync: true, strict: true, onReadEntry(entry: { path: string; type: string }) {
    const members = entry.path.split("/");
    if (!entry.path.startsWith("package/") || members.includes("..") || members.includes(".") || entry.path.includes("\\") || !["File", "Directory"].includes(entry.type)) throw new Error("BOOTSTRAP_PROOF_ARCHIVE_UNSAFE");
  } });
  tar.x({ file: archive, cwd: relocated, sync: true, strict: true, preservePaths: false });
  if (digest(archive) !== archiveSHA256) throw new Error("BOOTSTRAP_PROOF_ARCHIVE_CHANGED");
  const bindings: Record<string, string> = { "package.json": digest(join(cli, "package.json")) };
  function bind(directory: string) {
    for (const entry of readdirSync(join(cli, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) bind(path);
      else if (entry.isFile()) bindings[path] = digest(join(cli, path));
      else throw new Error("BOOTSTRAP_PROOF_DIST_UNSAFE");
    }
  }
  bind("dist");
  for (const [path, hash] of Object.entries(bindings)) if (digest(join(relocated, "package", path)) !== hash) throw new Error("BOOTSTRAP_PROOF_SHIPPED_BYTES_CHANGED");
  symlinkSync(dependencyRoot, join(relocated, "package/node_modules"));
  writeFileSync(join(stage, "fixture-binding.json"), JSON.stringify({ archiveSHA256, shippedBytes: bindings, dependencyRoot, npmVersion: npmManifest.version, ignoredScripts: true, SDKBuild: false, normalHooks: false, fallbackInstall: false, archivePurpose: "bootstrap-only compiled CLI test fixture; templates/full installability excluded", dependencyBindingSHA256: digest(bindingPath) }, null, 2), { mode: 0o600 });
}, 40000);
let root: string; let home: string; let project: string; let outside: string;
let entry: string;
const defaults = { deployments: {}, default: "", format: "table", confirmDangerous: true };
beforeEach(() => {
  const fixtures = join(stage, "command-fixtures"); mkdirSync(fixtures, { recursive: true });
  root = mkdtempSync(join(fixtures, "case-")); home = join(root, "home"); project = join(root, "project"); outside = join(root, "outside");
  for (const path of [home, project, outside]) mkdirSync(path, { mode: 0o700 });
  entry = join(stage, "relocated/package/dist/index.js");
});
afterEach(() => rmSync(root, { force: true, recursive: true }));
function json(path: string, value: unknown, mode = 0o600) { writeFileSync(path, JSON.stringify(value), { mode }); }
function ordinaryConfig() { return { ...defaults, deployments: { normal: { url: "http://127.0.0.1:1", projectPath: project } }, default: "normal" }; }
function owned(location = join(project, "cortex.config.json"), configuredDefault = "owned") {
  const epoch = randomUUID(); const sessionId = randomUUID(); const ownerEpoch = randomUUID();
  const record = { sessionId, ownerEpoch, proposedAlias: "owned", registeredAlias: "owned", projectRealPath: project, configSourceIdentity: location, phase: "registered", everExposed: true, bindingDigest: "a".repeat(64) };
  const base = join(home, ".cortex", "restore"); const sessions = join(base, "sessions", sessionId);
  mkdirSync(sessions, { recursive: true, mode: 0o700 });
  json(join(base, "admission-registry.json"), { version: 1, epoch, sessions: [record] });
  json(join(sessions, "admission.json"), { version: 1, epoch, session: record });
  json(location, { ...defaults, deployments: { owned: { url: "http://127.0.0.1:1", projectPath: project, restoreRuntime: { version: 1, sessionId, ownerEpoch, bindingDigest: record.bindingDigest } } }, default: configuredDefault });
  return { sessionId, record, base, sessions, epoch };
}
function malicious(path: string, config: unknown = ordinaryConfig()) {
  // Both module evaluation and a child process have independent file sentinels.
  const file = join(root, "module-ran"); const child = join(root, "child-ran");
  writeFileSync(path, `require('node:fs').writeFileSync(${JSON.stringify(file)}, 'ran');require('node:child_process').execFileSync(process.execPath,['-e',${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(child)},'ran')`)}]);module.exports=${JSON.stringify(config)};`);
}
function instrument() {
  const trace = join(root, "env-access.jsonl"); const transportTrace = join(root, "transport-access.jsonl"); const childTrace = join(root, "child-access.jsonl"); const instrumentation = join(root, "observe.mjs");
  writeFileSync(instrumentation, `import fs from 'node:fs';import fsp from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';import net from 'node:net';import cp from 'node:child_process';
const trace=${JSON.stringify(trace)};const log=(op,p)=>{if(typeof p==='string'&&/\\/\\.env[^/]*$/.test(p))fs.appendFileSync(trace,JSON.stringify({op})+'\\n')};
for(const name of ['existsSync','statSync','lstatSync','readFileSync','openSync','realpathSync']){const original=fs[name];fs[name]=function(p,...args){log(name,p);return original.call(this,p,...args)}};
for(const name of ['stat','lstat','readFile','open','realpath']){const original=fsp[name];fsp[name]=async function(p,...args){log(name,p);return original.call(this,p,...args)}};
const connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){fs.appendFileSync(${JSON.stringify(transportTrace)},'connect\\n');return connect.apply(this,args)};for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']){const original=cp[name];cp[name]=function(...args){fs.appendFileSync(${JSON.stringify(childTrace)},JSON.stringify({factory:name})+'\\n');return original.apply(this,args)}};syncBuiltinESMExports();`);
  return { trace, instrumentation, transportTrace, childTrace };
}
function run(args: string[], cwd = project, observe = true) {
  const observer = instrument();
  const result = spawnSync(process.execPath, [...(observe ? ["--import", observer.instrumentation] : []), "--", entry, ...args], {
    cwd, encoding: "utf8", timeout: 5000,
    env: { HOME: home, PATH: process.env.PATH ?? "", CORTEX_TEST_HOME_ROOT: home, CONVEX_DEPLOYMENT: "malicious-process-selector", CONVEX_DEPLOY_KEY: "fixture-process-key", DOTENV_CONFIG_PATH: join(root, "never.env") },
  });
  const envAccesses = existsSync(observer.trace) ? readFileSync(observer.trace, "utf8").trim().split("\n").length : 0;
  const transportAccesses = existsSync(observer.transportTrace) ? readFileSync(observer.transportTrace, "utf8").trim().split("\n").length : 0;
  const childAccesses = existsSync(observer.childTrace) ? readFileSync(observer.childTrace, "utf8").trim().split("\n").length : 0;
  if (envAccesses === 0) expect(transportAccesses).toBe(0);
  return { ...result, envAccesses, transportAccesses, childAccesses };
}
function zeroEffects() { expect(existsSync(join(root, "module-ran"))).toBe(false); expect(existsSync(join(root, "child-ran"))).toBe(false); }
it.each(["built", "packed"])("I111 %s nested project load/use/write and sibling selection stay scoped", carrier => {
  if (carrier === "built") entry = join(cli, "dist/index.js");
  const nested = join(project, "src", "deep"); mkdirSync(nested, { recursive: true });
  const observations: unknown[] = [];
  const observe = (args: string[], directory: string) => {
    const result = run(args, directory);
    observations.push({ argv: [process.execPath, "--", entry, ...args], cwd: directory, pid: result.pid, exit: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr, timeoutMs: 5000, transportAccesses: result.transportAccesses, childAccesses: result.childAccesses });
    expect(result.transportAccesses).toBe(0); expect(result.childAccesses).toBe(0);
    return result;
  };
  const user = { ...defaults, deployments: { shared: { url: "http://127.0.0.1:1001", key: "I111-user-fixture-key" }, userOnly: { url: "http://127.0.0.1:1002" } }, default: "userOnly" };
  const parent = { deployments: { shared: { url: "http://127.0.0.1:2001" }, chosen: { url: "http://127.0.0.1:2002" } }, default: "shared", marker: "parent" };
  json(join(home, ".cortexrc"), user); json(join(project, "cortex.config.json"), parent); const userBytes = readFileSync(join(home, ".cortexrc"));
  const show = observe(["config", "deployments", "--format", "json"], nested); expect(show.error).toBeUndefined(); expect(show.status).toBe(0);
  const shown = JSON.parse(show.stdout) as Array<Record<string, unknown>>; expect(shown.find(value => value.name === "shared")).toMatchObject({ url: "http://127.0.0.1:2001", hasKey: false, isDefault: true }); expect(shown.find(value => value.name === "userOnly")).toBeDefined(); expect(show.stdout).not.toContain("I111-user-fixture-key");
  const use = observe(["use", "chosen", "--format", "json"], nested); expect(use.status).toBe(0); expect(JSON.parse(use.stdout).current).toBe("chosen");
  const store = JSON.parse(readFileSync(join(home, ".cortex-current"), "utf8")); expect(store.selections).toEqual({ [project]: "chosen" });
  for (const directory of [project, nested]) { const selected = observe(["use", "--format", "json"], directory); expect(selected.status).toBe(0); expect(JSON.parse(selected.stdout).current).toBe("chosen"); }
  const sibling = observe(["use", "--format", "json"], outside); expect(sibling.status).toBe(0); expect(JSON.parse(sibling.stdout).current).toBeNull();
  const update = observe(["config", "set", "default", "chosen", "--format", "json"], nested); expect(update.status).toBe(0);
  expect(JSON.parse(readFileSync(join(project, "cortex.config.json"), "utf8"))).toEqual({ ...parent, default: "chosen" }); expect(readFileSync(join(home, ".cortexrc"))).toEqual(userBytes); expect(existsSync(join(nested, "cortex.config.json"))).toBe(false);
  json(join(project, "src", "cortex.config.json"), { deployments: { closer: { url: "http://127.0.0.1:3001" } }, default: "closer" });
  const closer = observe(["config", "deployments", "--format", "json"], nested); expect(closer.status).toBe(0); expect(JSON.parse(closer.stdout).find((value: { name: string }) => value.name === "closer")).toMatchObject({ isDefault: true });
  writeFileSync(join(project, "src", "cortex.config.json"), "{malformed"); const malformed = observe(["config", "deployments", "--format", "json"], nested); expect(malformed.status).toBe(1); expect(malformed.stdout).toBe(""); expect(malformed.stderr).toMatch(/ADMISSION_|Invalid project configuration/);
  writeFileSync(join(stage, `I111-config-${carrier}.json`), JSON.stringify({ carrier, observations, showExit: show.status, useExit: use.status, selectionScope: project, rootAndNestedSameScope: true, siblingSelection: null, effectiveWriteOnlyParent: true, closerExit: closer.status, malformedExit: malformed.status, noServices: true }), { mode: 0o600 });
});
it.each(["built", "packed"])("I111 %s ancestor owned/executable admission refuses effects from nested cwd", carrier => {
  if (carrier === "built") entry = join(cli, "dist/index.js");
  const nested = join(project, "src", "deep"); mkdirSync(nested, { recursive: true }); const fixture = owned(); malicious(join(project, "cortex.config.js"));
  expect(spawnSync("mkfifo", [join(nested, ".env.local")]).status).toBe(0);
  const safe = run(["config", "show", "--format", "json"], nested); expect(safe.error).toBeUndefined(); expect(safe.status).toBe(0); expect(JSON.parse(safe.stdout).deployments.owned.restoreRuntime.sessionId).toBe(fixture.sessionId); expect(safe.envAccesses).toBe(0); expect(safe.childAccesses).toBe(0); expect(safe.transportAccesses).toBe(0); zeroEffects();
  rmSync(join(project, "cortex.config.json")); const denied = run(["config", "show", "--format", "json"], nested); expect(denied.error).toBeUndefined(); expect(denied.status).toBe(1); expect(denied.stderr).toContain("ADMISSION_CONFIG_AMBIGUOUS"); expect(denied.stdout).toBe(""); expect(denied.envAccesses).toBe(0); expect(denied.childAccesses).toBe(0); expect(denied.transportAccesses).toBe(0); zeroEffects();
  writeFileSync(join(stage, `I111-admission-${carrier}.json`), JSON.stringify({ carrier, ownedExit: safe.status, executableRefusalExit: denied.status, envAccesses: [safe.envAccesses, denied.envAccesses], childAccesses: [safe.childAccesses, denied.childAccesses], transportAccesses: [safe.transportAccesses, denied.transportAccesses], moduleMarker: false, childMarker: false }), { mode: 0o600 });
});
it.each(["built", "packed"])("I111 %s legacy cwd selection preserves target or refuses changed endpoint before effects", carrier => {
  if (carrier === "built") entry = join(cli, "dist/index.js");
  const nested = join(project, "src", "deep"); mkdirSync(nested, { recursive: true });
  const configPath = join(project, "cortex.config.json"); const selectionPath = join(home, ".cortex-current");
  const user = { ...defaults, deployments: { shared: { url: "http://127.0.0.1:1001" }, chosen: { url: "http://127.0.0.1:2002" } }, default: "shared" };
  const parent = { ...defaults, deployments: { shared: { url: "http://127.0.0.1:2001" }, chosen: { url: "http://127.0.0.1:2002" } }, default: "shared" };
  json(join(home, ".cortexrc"), user); json(configPath, parent);
  const observations: unknown[] = [];
  let previousEnvAccesses = 0;
  const observe = (args: string[]) => {
    const captured = run(args, nested);
    const result = { ...captured, envAccesses: captured.envAccesses - previousEnvAccesses }; previousEnvAccesses = captured.envAccesses;
    expect(result.error).toBeUndefined(); expect(result.signal).toBeNull();
    expect(result.transportAccesses).toBe(0); expect(result.childAccesses).toBe(0);
    observations.push({ argv: [process.execPath, "--", entry, ...args], cwd: nested, pid: result.pid, exit: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr, envAccesses: result.envAccesses, transportAccesses: result.transportAccesses, childAccesses: result.childAccesses, timeoutMs: 5000 });
    writeFileSync(join(stage, `I111-legacy-${carrier}.json`), JSON.stringify({ carrier, complete: false, observations }), { mode: 0o600 });
    return result;
  };
  json(selectionPath, { version: 1, selections: { [nested]: "chosen" } }); const unchangedStore = readFileSync(selectionPath);
  const unchanged = observe(["use", "--format", "json"]); expect(unchanged.status).toBe(0); expect(JSON.parse(unchanged.stdout)).toMatchObject({ current: "chosen", default: "shared" }); expect(readFileSync(selectionPath)).toEqual(unchangedStore);
  json(selectionPath, { version: 1, selections: { [nested]: "shared" } }); const oldStore = readFileSync(selectionPath); const oldConfig = readFileSync(configPath);
  const changed = observe(["config", "set", "format", "json", "--format", "json"]); expect(changed.status).toBe(1); expect(changed.stderr).toMatch(/ADMISSION_LEGACY_SELECTION_CHANGED.*explicit -d.*use/); expect(changed.stdout).toBe(""); expect(changed.envAccesses).toBe(0); expect(readFileSync(selectionPath)).toEqual(oldStore); expect(readFileSync(configPath)).toEqual(oldConfig);
  const explicit = observe(["config", "deployments", "-d", "shared", "--format", "json"]); expect(explicit.status).toBe(0); expect(JSON.parse(explicit.stdout).find((value: { name: string }) => value.name === "shared").url).toBe("http://127.0.0.1:2001"); expect(readFileSync(selectionPath)).toEqual(oldStore);
  const replace = observe(["use", "shared", "--format", "json"]); expect(replace.status).toBe(0); expect(JSON.parse(readFileSync(selectionPath, "utf8")).selections).toEqual({ [project]: "shared" });
  const recovered = observe(["config", "set", "format", "json", "--format", "json"]); expect(recovered.status).toBe(0); expect(JSON.parse(readFileSync(configPath, "utf8")).format).toBe("json");
  json(selectionPath, { version: 1, selections: { [nested]: "shared", [project]: "shared" } }); const clear = observe(["use", "--clear", "--format", "json"]); expect(clear.status).toBe(0); expect(existsSync(selectionPath)).toBe(false);
  const fixture = owned(); malicious(join(project, "cortex.config.js")); json(selectionPath, { version: 1, selections: { [nested]: "owned" } });
  expect(spawnSync("mkfifo", [join(nested, ".env.local")]).status).toBe(0);
  const protectedLegacy = observe(["config", "show", "--format", "json"]); expect(protectedLegacy.status).toBe(1); expect(protectedLegacy.stderr).toContain("ADMISSION_LEGACY_SELECTION_CHANGED"); expect(protectedLegacy.envAccesses).toBe(0); zeroEffects();
  const protectedExplicit = observe(["config", "show", "-d", "owned", "--format", "json"]); expect(protectedExplicit.status).toBe(0); expect(JSON.parse(protectedExplicit.stdout).deployments.owned.restoreRuntime.sessionId).toBe(fixture.sessionId); expect(protectedExplicit.envAccesses).toBe(0); zeroEffects();
  writeFileSync(join(stage, `I111-legacy-${carrier}.json`), JSON.stringify({ carrier, complete: true, oldSameAliasURL: user.deployments.shared.url, newSameAliasURL: parent.deployments.shared.url, unchangedLegacyName: "chosen", changedEndpointRefused: true, readTimeStoreUnchanged: true, explicitUseParentScope: project, explicitClearRemovedBoth: true, protectedLegacyRefused: true, protectedExplicitStillDataOnly: true, observations }), { mode: 0o600 });
});
it.each([[], ["--help"], ["--version"], ["db", "import"], ["unknown"], ["config", "show", "--bogus"], ["memory", "list", "--limit", "1.2"], ["config", "show", "--format", "invalid"]].map(args => [args]))("cold parser route remains env/config free", args => {
  malicious(join(project, "cortex.config.js")); writeFileSync(join(project, ".env.local"), "ORDINARY_ENV=loaded\n");
  const result = run(args); expect(result.error).toBeUndefined(); expect(result.envAccesses).toBe(0); zeroEffects();
  expect(result.status).toBe(args.length === 0 || args.includes("--help") || args.includes("--version") ? 0 : 1);
});
it.each(["default", "singleton", "scoped", "explicit", "inherited"])("protected JSON %s selection skips FIFO env and shadowed executable", selection => {
  const fixture = owned(selection === "inherited" ? join(home, ".cortexrc") : undefined, selection === "singleton" || selection === "scoped" ? "" : "owned");
  if (selection === "scoped") json(join(home, ".cortex-current"), { version: 1, selections: { [project]: "owned" } });
  if (selection !== "inherited") malicious(join(project, "cortex.config.js"));
  else json(join(project, "cortex.config.json"), { format: "json" });
  expect(spawnSync("mkfifo", [join(project, ".env.local")]).status).toBe(0);
  const result = run(["config", "show", "--format", "json", ...(selection === "explicit" ? ["-d", "owned"] : [])]);
  expect(result.status).toBe(0); expect(result.error).toBeUndefined(); expect(result.envAccesses).toBe(0);
  const output = JSON.parse(result.stdout); expect(output.deployments.owned.restoreRuntime.sessionId).toBe(fixture.sessionId); zeroEffects();
});
it.each(["db", "convex"])("%s protected capture never falls through ordinary native export", group => {
  json(join(project, "cortex.config.json"), ordinaryConfig()); malicious(join(project, "cortex.config.js"));
  expect(spawnSync("mkfifo", [join(project, ".env.local")]).status).toBe(0);
  const result = run([group, "export", "--restore-bundle", "--include-file-storage", "--output", join(root, "new.zip"), "-d", "normal"]);
  expect(result.status).toBe(1); expect(result.stderr).toContain("RESTORE_RUNTIME_UNAVAILABLE"); expect(result.envAccesses).toBe(0); expect(existsSync(join(root, "new.zip"))).toBe(false); zeroEffects();
});
it.each(["db", "convex"].flatMap(group => ["built", "packed"].map(carrier => [group, carrier])))("I108 %s standalone provenance %s refuses an ordinary unowned target before effects", (group, carrier) => {
  if (carrier === "built") entry = join(cli, "dist/index.js");
  json(join(project, "cortex.config.json"), ordinaryConfig()); malicious(join(project, "cortex.config.js"));
  expect(spawnSync("mkfifo", [join(project, ".env.local")]).status).toBe(0);
  const input = join(root, "input.zip"); const sidecar = join(root, "unopened-provenance.json");
  const result = run([group, "import", input, "--provenance", sidecar, "-d", "normal", "--replace-all", "--yes"]);
  expect(result.error).toBeUndefined(); expect(result.signal).toBeNull(); expect(result.status).toBe(1);
  expect(result.stdout).toBe(""); expect(result.stderr).toContain("RESTORE_RUNTIME_UNAVAILABLE: protected restore is deferred and unsupported in this release");
  expect(result.envAccesses).toBe(0); expect(result.transportAccesses).toBe(0); expect(result.childAccesses).toBe(0);
  expect(existsSync(input)).toBe(false); expect(existsSync(sidecar)).toBe(false); expect(existsSync(join(home, ".cortex"))).toBe(false); zeroEffects();
  json(join(stage, `I108-${group}-${carrier}.json`), { group, carrier, pid: result.pid, exit: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr, envAccesses: result.envAccesses, childAccesses: result.childAccesses, transportAccesses: result.transportAccesses, moduleMarker: false, childMarker: false, inputCreated: false, sidecarCreated: false });
});
it.each(["db", "convex"])("I108 %s provenance refuses executable-only configuration before evaluation", group => {
  malicious(join(project, "cortex.config.js")); writeFileSync(join(project, ".env.local"), "ORDINARY_ENV=must-not-load\n");
  const result = run([group, "import", join(root, "input.zip"), "--provenance", join(root, "unopened-provenance.json"), "-d", "normal", "--replace-all", "--yes"]);
  expect(result.error).toBeUndefined(); expect(result.signal).toBeNull(); expect(result.status).toBe(1);
  expect(result.stderr).toContain("ADMISSION_CONFIG_AMBIGUOUS"); expect(result.envAccesses).toBe(0); expect(result.transportAccesses).toBe(0); expect(result.childAccesses).toBe(0); zeroEffects();
  json(join(stage, `I108-${group}-executable-config.json`), { group, pid: result.pid, exit: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr, envAccesses: result.envAccesses, childAccesses: result.childAccesses, transportAccesses: result.transportAccesses, moduleMarker: false, childMarker: false });
});
it.each(["db", "convex"])("I108 %s import without provenance keeps benign ordinary env and archive validation", group => {
  json(join(project, "cortex.config.json"), ordinaryConfig()); writeFileSync(join(project, ".env.local"), "ORDINARY_ENV=loaded\n");
  const result = run([group, "import", join(root, "missing-ordinary.zip"), "-d", "normal", "--replace-all", "--yes"]);
  expect(result.error).toBeUndefined(); expect(result.status).toBe(1);
  expect(result.stderr).toContain("Snapshot must be an existing regular ZIP file"); expect(result.stderr).not.toContain("RESTORE_RUNTIME_UNAVAILABLE");
  expect(result.envAccesses).toBeGreaterThan(0); expect(result.transportAccesses).toBe(0); expect(result.childAccesses).toBe(0); zeroEffects();
  json(join(stage, `I108-${group}-ordinary.json`), { group, pid: result.pid, exit: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr, envAccesses: result.envAccesses, childAccesses: result.childAccesses, transportAccesses: result.transportAccesses, ordinaryArchiveValidationReached: true, moduleMarker: false, childMarker: false });
});
it("snapshot create is protected without existing sessions", () => {
  malicious(join(project, "cortex.config.js")); writeFileSync(join(project, ".env.local"), "KEY=ignored\n");
  const result = run(["snapshot", "create", "fresh", "--project", project, "--yes"]);
  expect(result.status).toBe(1); expect(result.stderr).toContain("ADMISSION_CONFIG_AMBIGUOUS"); expect(result.envAccesses).toBe(0); zeroEffects(); expect(existsSync(join(home, ".cortex"))).toBe(false);
});
it("snapshot create with JSON reaches explicit unavailable boundary without resources", () => {
  json(join(project, "cortex.config.json"), ordinaryConfig());
  const result = run(["snapshot", "create", "fresh", "--project", project, "--yes"]);
  expect(result.status).toBe(1); expect(result.stderr).toContain("RESTORE_RUNTIME_UNAVAILABLE"); expect(result.envAccesses).toBe(0); expect(existsSync(join(home, ".cortex"))).toBe(false);
});
it.each(["status", "resume", "release", "stop", "discard"])("snapshot %s admits exact session fixture and refuses absent runtime", action => {
  const { sessionId } = owned();
  const result = run(["snapshot", action, sessionId, ...(action !== "status" ? ["--yes"] : []), ...(action === "discard" ? ["--confirm-name", "owned"] : [])], outside);
  expect(result.status).toBe(1); expect(result.stderr).toContain("RESTORE_RUNTIME_UNAVAILABLE"); expect(result.envAccesses).toBe(0);
});
it.each(["db", "convex"])("%s import admits session-bound project outside cwd", group => {
  const { sessionId } = owned(); const result = run([group, "import", join(root, "source.zip"), "--restore-session", sessionId, "--replace-all", "--yes"], outside);
  expect(result.status).toBe(1); expect(result.stderr).toContain("RESTORE_RUNTIME_UNAVAILABLE"); expect(result.envAccesses).toBe(0);
});
it.each(["db", "convex"])("%s capture explicit project outside cwd remains protected", group => {
  json(join(project, "cortex.config.json"), ordinaryConfig());
  const result = run([group, "export", "--restore-bundle", "--include-file-storage", "--output", join(root, "new.zip"), "--project", project, "-d", "normal"], outside);
  expect(result.status).toBe(1); expect(result.stderr).toContain("RESTORE_RUNTIME_UNAVAILABLE"); expect(result.envAccesses).toBe(0);
});
it.each(["db", "convex"])("%s capture forbids explicit env-file before even stat", group => {
  const file = join(outside, ".env.forbidden"); expect(spawnSync("mkfifo", [file]).status).toBe(0);
  const result = run([group, "export", "--restore-bundle", "--env-file", file]);
  expect(result.status).toBe(1); expect(result.stderr).toContain("ADMISSION_ENV_FILE_FORBIDDEN"); expect(result.envAccesses).toBe(0);
});
it("genuine owned registry plus active JS is ambiguity, never imported", () => {
  owned(); rmSync(join(project, "cortex.config.json")); malicious(join(project, "cortex.config.js"));
  const result = run(["status"]); expect(result.status).toBe(1); expect(result.stderr).toContain("ADMISSION_CONFIG_AMBIGUOUS"); expect(result.envAccesses).toBe(0); zeroEffects();
});
it.each(["js", "meta-js", "meta-json", "import", "yaml"])("protected %s active source rejects before executable/process/env effects", source => {
  owned();
  if (source === "js") { rmSync(join(project, "cortex.config.json")); malicious(join(project, "cortex.config.js")); }
  if (source === "meta-js") { mkdirSync(join(project, ".config")); malicious(join(project, ".config/config.js")); }
  if (source === "meta-json") json(join(project, "package.json"), { cosmiconfig: { searchPlaces: ["malicious.js"] } });
  if (source === "import") json(join(project, "cortex.config.json"), { $import: "./malicious.js" });
  if (source === "yaml") { rmSync(join(project, "cortex.config.json")); writeFileSync(join(project, ".cortexrc"), "deployments:\n  owned: value\n"); }
  const result = run(["config", "show", "--format", "json"]); expect(result.status).toBe(1); expect(result.stderr).toContain("ADMISSION_CONFIG_AMBIGUOUS"); expect(result.envAccesses).toBe(0); zeroEffects();
});
it.each(["symlink", "oversize", "fifo", "unreadable"])("unsafe active config %s refuses with bounded zero env effects", kind => {
  const path = join(project, "cortex.config.json");
  if (kind === "symlink") { json(join(root, "foreign.json"), ordinaryConfig()); symlinkSync(join(root, "foreign.json"), path); }
  if (kind === "oversize") writeFileSync(path, Buffer.alloc(8 * 1024 * 1024 + 1, 32));
  if (kind === "fifo") expect(spawnSync("mkfifo", [path]).status).toBe(0);
  if (kind === "unreadable") { json(path, ordinaryConfig()); chmodSync(path, 0); }
  const result = run(["snapshot", "create", "fresh", "--project", project, "--yes"]);
  expect(result.error).toBeUndefined(); expect(result.status).toBe(1); expect(result.stderr).toContain(kind === "unreadable" ? "ADMISSION_SOURCE_UNREADABLE" : "ADMISSION_SOURCE_UNSAFE"); expect(result.envAccesses).toBe(0);
});
it.each(["missing", "malformed", "incomplete", "epoch", "mode"])("retained %s metadata cannot permit an ordinary JS bypass", kind => {
  const fixture = owned(); rmSync(join(project, "cortex.config.json")); malicious(join(project, "cortex.config.js"));
  if (kind === "missing") rmSync(join(fixture.base, "admission-registry.json"));
  if (kind === "malformed") writeFileSync(join(fixture.base, "admission-registry.json"), "{malformed");
  if (kind === "incomplete") json(join(fixture.base, "admission-registry.json"), { version: 1, epoch: fixture.epoch, sessions: [] });
  if (kind === "epoch") json(join(fixture.sessions, "admission.json"), { version: 1, epoch: randomUUID(), session: fixture.record });
  if (kind === "mode") chmodSync(join(fixture.base, "admission-registry.json"), 0o644);
  const result = run(["status"]); expect(result.status).toBe(1); expect(result.stderr).toMatch(/ADMISSION_(REGISTRY|JSON|METADATA)/); expect(result.envAccesses).toBe(0); zeroEffects();
});
it("ordinary trusted JS and dotenv evaluation remain automatic with positive open/process sentinels", () => {
  malicious(join(project, "cortex.config.js")); writeFileSync(join(project, ".env.local"), "ORDINARY_CONTROL=loaded\n");
  const result = run(["config", "show", "--format", "json"]); expect(result.status).toBe(0); expect(result.envAccesses).toBeGreaterThan(0);
  expect(JSON.parse(result.stdout).default).toBe("normal"); expect(existsSync(join(root, "module-ran"))).toBe(true); expect(existsSync(join(root, "child-ran"))).toBe(true);
  expect(result.childAccesses).toBeGreaterThan(0);
});
it("ordinary JS can observe loaded env and user/project precedence", () => {
  json(join(home, ".cortexrc"), { ...ordinaryConfig(), future: "inherited", format: "table" });
  writeFileSync(join(project, ".env.local"), "ORDINARY_CONTROL=loaded\n");
  writeFileSync(join(project, "cortex.config.js"), "module.exports={format:'json',future:process.env.ORDINARY_CONTROL};");
  const result = run(["config", "show", "--format", "json"]); expect(result.status).toBe(0); expect(JSON.parse(result.stdout).future).toBe("loaded"); expect(result.envAccesses).toBeGreaterThan(0);
});
it("ordinary JS returned forged owned metadata fails without private authority/fallback", () => {
  writeFileSync(join(project, "cortex.config.js"), `module.exports=${JSON.stringify({ ...ordinaryConfig(), deployments: { fake: { url: "http://127.0.0.1:1", restoreRuntime: { version: 1 } } } })};`);
  const result = run(["config", "show", "--format", "json"]); expect(result.status).toBe(1); expect(result.stderr).toContain("ADMISSION_EXECUTABLE_OWNED_UNSUPPORTED"); expect(existsSync(join(home, ".cortex"))).toBe(false);
});
it("protected scoped use persists exact canonical scope without env/config effects", () => {
  owned(); const result = run(["use", "owned", "--format", "json"]);
  expect(result.status).toBe(0); expect(result.envAccesses).toBe(0); expect(JSON.parse(readFileSync(join(home, ".cortex-current"), "utf8")).selections[project]).toBe("owned");
});
it("protected config formatting save retains binding and user/source ownership", () => {
  const { sessionId } = owned(); json(join(home, ".cortexrc"), { ...defaults, future: "untouched" }); const user = readFileSync(join(home, ".cortexrc"));
  const result = run(["config", "set", "format", "json"]);
  expect(result.status).toBe(0); expect(result.envAccesses).toBe(0); expect(readFileSync(join(home, ".cortexrc"))).toEqual(user);
  const saved = JSON.parse(readFileSync(join(project, "cortex.config.json"), "utf8")); expect(saved.format).toBe("json"); expect(saved.deployments.owned.restoreRuntime.sessionId).toBe(sessionId);
});
it("protected identity mutation refuses before config/env writes", () => {
  owned(); const config = readFileSync(join(project, "cortex.config.json"));
  const result = run(["config", "set-url", "owned", "--url", "http://127.0.0.1:2", "--json-only"]);
  expect(result.status).toBe(1); expect(result.envAccesses).toBe(0); expect(readFileSync(join(project, "cortex.config.json"))).toEqual(config);
});
it("relocated ignored-hook CLI candidate runs actual protected index with fixture dependencies", () => {
  owned(); const moved = join(root, "moved cli"); mkdirSync(moved);
  const packed = join(stage, "relocated/package");
  cpSync(join(packed, "dist"), join(moved, "dist"), { recursive: true }); cpSync(join(packed, "package.json"), join(moved, "package.json"));
  expect(existsSync(join(packed, "scripts/postinstall.js"))).toBe(true);
  symlinkSync(dependencyRoot, join(moved, "node_modules")); entry = join(moved, "dist/index.js");
  expect(readFileSync(join(moved, "dist/cli-main.js"))).toEqual(readFileSync(join(cli, "dist/cli-main.js")));
  expect(readFileSync(join(moved, "dist/utils/node-runtime.js"))).toEqual(readFileSync(join(cli, "dist/utils/node-runtime.js")));
  const result = run(["config", "show", "--format", "json"]); expect(result.status).toBe(0); expect(JSON.parse(result.stdout).default).toBe("owned"); expect(result.envAccesses).toBe(0);
});
it.each(["executable", "npm-bin", "npm-sh"])("actual %s launcher places Node boundary before protected env-file FIFO", async launcher => {
  const { createRequire } = await import("node:module"); const require = createRequire(import.meta.url);
  const pkg = join(root, "installation", "node_modules", "@cortexmemory", "cli"); mkdirSync(pkg, { recursive: true });
  cpSync(join(cli, "dist"), join(pkg, "dist"), { recursive: true }); cpSync(join(cli, "package.json"), join(pkg, "package.json"));
  symlinkSync(dependencyRoot, join(pkg, "node_modules")); chmodSync(join(pkg, "dist/index.js"), 0o755);
  const manifest = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));
  await require(join(npmRoot, "node_modules/bin-links"))({ path: pkg, pkg: manifest, top: false, force: true });
  const generated = join(root, "shims", "cortex");
  const binLinkRequire = createRequire(join(npmRoot, "node_modules/bin-links/package.json"));
  await binLinkRequire("cmd-shim")(join(pkg, "dist/index.js"), generated);
  // npm12 cmd-shim selects an adjacent interpreter before its Windows PATH fallback.
  // Bind the actual chosen proof runtime for this cross-platform shell carrier.
  symlinkSync(process.execPath, join(root, "shims", "node"));
  const invocation = launcher === "executable" ? join(pkg, "dist/index.js") : launcher === "npm-bin" ? join(root, "installation/node_modules/.bin/cortex") : generated;
  const forbidden = join(outside, ".env.forbidden"); expect(spawnSync("mkfifo", [forbidden]).status).toBe(0);
  const observer = instrument(); const args = ["db", "export", "--restore-bundle", "--env-file", forbidden];
  const result = spawnSync(invocation, args, { cwd: project, encoding: "utf8", timeout: 5000, env: { HOME: home, PATH: process.env.PATH ?? "", NODE_OPTIONS: `--import=${observer.instrumentation}` } });
  expect(result.error).toBeUndefined(); expect(result.status).toBe(1); expect(result.stderr).toContain("ADMISSION_ENV_FILE_FORBIDDEN"); expect(existsSync(observer.trace)).toBe(false); expect(existsSync(observer.transportTrace)).toBe(false);
  expect(readFileSync(`${generated}.cmd`, "utf8")).toMatch(/"%_prog%" -- "/);
  expect(readFileSync(`${generated}.ps1`, "utf8")).toMatch(/node\$exe" -- "/);
});
it.each(["directory", "symlink", "unreadable"])("protected index skips env %s without even stat", kind => {
  owned(); const env = join(project, ".env.local");
  if (kind === "directory") mkdirSync(env);
  if (kind === "symlink") { writeFileSync(join(root, "foreign-env"), "CONTROL=ignored\n"); symlinkSync(join(root, "foreign-env"), env); }
  if (kind === "unreadable") { writeFileSync(env, "CONTROL=ignored\n"); chmodSync(env, 0); }
  writeFileSync(join(project, ".env.test"), "TEST_CONTROL=ignored\n");
  const result = run(["config", "show", "--format", "json"]);
  expect(result.error).toBeUndefined(); expect(result.status).toBe(0); expect(result.envAccesses).toBe(0); expect(JSON.parse(result.stdout).default).toBe("owned");
});
it("ordinary executable meta factory remains automatic after ordinary-only proof", () => {
  json(join(project, "cortex.config.json"), ordinaryConfig()); mkdirSync(join(project, ".config"));
  const meta = join(project, ".config/config.js"); malicious(meta);
  // Meta returns default options after its independent module/child side effects.
  writeFileSync(meta, readFileSync(meta, "utf8").replace(`module.exports=${JSON.stringify(ordinaryConfig())}`, "module.exports={}"));
  const result = run(["config", "show", "--format", "json"]);
  expect(result.status).toBe(0); expect(JSON.parse(result.stdout).default).toBe("normal"); expect(existsSync(join(root, "module-ran"))).toBe(true); expect(existsSync(join(root, "child-ran"))).toBe(true);
});
it("restore session explicit project mismatch refuses association before env/native effects", () => {
  const { sessionId } = owned(); const result = run(["db", "import", "input.zip", "--restore-session", sessionId, "--project", outside, "--replace-all", "--yes"]);
  expect(result.status).toBe(1); expect(result.stderr).toContain("ADMISSION_SESSION_PROJECT_MISMATCH"); expect(result.envAccesses).toBe(0);
});
it("protected capture requires actual explicit alias rather than config/default fallback", () => {
  json(join(project, "cortex.config.json"), ordinaryConfig()); const result = run(["db", "export", "--restore-bundle", "--include-file-storage", "--output", join(root, "new.zip")]);
  expect(result.status).toBe(1); expect(result.stderr).toContain("RESTORE_CAPTURE_ALIAS_REQUIRED"); expect(result.envAccesses).toBe(0); expect(existsSync(join(root, "new.zip"))).toBe(false);
});
it.each(["db", "convex"])("%s explicit normal selector cannot downgrade a restore-session import", group => {
  const { sessionId } = owned(); const result = run([group, "import", "input.zip", "--restore-session", sessionId, "-d", "owned", "--replace-all", "--yes"]);
  expect(result.status).toBe(1); expect(result.stderr).toContain("ADMISSION_SESSION_SELECTOR_CONFLICT"); expect(result.envAccesses).toBe(0);
});

function proposed(location = join(project, "cortex.config.json"), associatedProject = project, phase = "private-paused") {
  const epoch = randomUUID(); const sessionId = randomUUID(); const ownerEpoch = randomUUID();
  const record = { sessionId, ownerEpoch, proposedAlias: "proposed", projectRealPath: associatedProject, configSourceIdentity: location, phase, everExposed: false, bindingDigest: "b".repeat(64) };
  const base = join(home, ".cortex", "restore"); const sessions = join(base, "sessions", sessionId); mkdirSync(sessions, { recursive: true, mode: 0o700 });
  json(join(base, "admission-registry.json"), { version: 1, epoch, sessions: [record] }); json(join(sessions, "admission.json"), { version: 1, epoch, session: record });
  return record;
}
function proposedConfig(associatedProject = project) { return { ...defaults, deployments: { proposed: { url: "http://127.0.0.1:1", projectPath: associatedProject } }, default: "proposed" }; }
function proposedRefusal(args = ["config", "show", "--format", "json"], cwd = project) {
  const result = run(args, cwd); expect(result.error).toBeUndefined(); expect(result.status).toBe(1); expect(result.stderr).toContain("ADMISSION_CONFIG_AMBIGUOUS"); expect(result.envAccesses).toBe(0); expect(result.transportAccesses).toBe(0); zeroEffects();
}
it.each(["creating", "private-paused", "failed", "unknown", "stopped", "native-running-confirmed"])("I95 actual index proposed %s session refuses JS/default/env before effects", phase => {
  proposed(undefined, undefined, phase); malicious(join(project, "cortex.config.js"), proposedConfig()); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n"); proposedRefusal();
});
it.each([
  ["-d", "proposed", "config", "show", "--format", "json"], ["config", "-d", "proposed", "show", "--format", "json"], ["config", "show", "-d", "proposed", "--format", "json"],
].map(args => [args]))("I95 actual index proposed explicit placements preserve zero effects", args => {
  proposed(); malicious(join(project, "cortex.config.js"), proposedConfig()); expect(spawnSync("mkfifo", [join(project, ".env.local")]).status).toBe(0); proposedRefusal(args);
});
it("I95 actual index inherited proposed user-source blocks current JS", () => {
  proposed(join(home, ".cortexrc"), outside); json(join(home, ".cortexrc"), { format: "json" }); malicious(join(project, "cortex.config.js"), proposedConfig(outside)); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n"); proposedRefusal();
});
it("I95 actual index inherited JSON project association blocks current JS", () => {
  proposed(join(outside, "cortex.config.json"), outside); json(join(home, ".cortexrc"), { deployments: proposedConfig(outside).deployments }); malicious(join(project, "cortex.config.js"), proposedConfig(outside)); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n"); proposedRefusal();
});
it("I95 actual index explicit project blocks proposal JS outside cwd", () => {
  proposed(); malicious(join(project, "cortex.config.js"), proposedConfig()); writeFileSync(join(outside, ".env.local"), "I95_CONTROL=loaded\n"); proposedRefusal(["status", "--project", project, "--format", "json"], outside);
});
it("I95 actual index proposed scoped-use selection blocks unrelated JS", () => {
  proposed(join(outside, "cortex.config.json"), outside); json(join(home, ".cortex-current"), { version: 1, selections: { [project]: "proposed" } }); malicious(join(project, "cortex.config.js"), proposedConfig(outside)); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n"); proposedRefusal();
});
it("I95 actual index inherited proposed default blocks current JS", () => {
  proposed(join(outside, "cortex.config.json"), outside); json(join(home, ".cortexrc"), { default: "proposed" }); malicious(join(project, "cortex.config.js"), proposedConfig(outside)); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n"); proposedRefusal();
});
it("I95 actual index explicit proposed alias blocks unresolved foreign association", () => {
  proposed(join(outside, "cortex.config.json"), outside); malicious(join(project, "cortex.config.js"), proposedConfig(outside)); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n"); proposedRefusal(["config", "show", "-d", "proposed", "--format", "json"]);
});
it("I95 actual index proposed metadata applies to active executable meta configuration", () => {
  proposed(); json(join(project, "cortex.config.json"), proposedConfig()); mkdirSync(join(project, ".config")); malicious(join(project, ".config/config.js"), proposedConfig()); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n"); proposedRefusal();
});
it("I95 unrelated proposed scope retains ordinary JS/env positive controls", () => {
  proposed(join(outside, "cortex.config.json"), outside); malicious(join(project, "cortex.config.js")); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n");
  const result = run(["config", "show", "--format", "json"]); expect(result.error).toBeUndefined(); expect(result.status).toBe(0); expect(JSON.parse(result.stdout).default).toBe("normal"); expect(result.envAccesses).toBeGreaterThan(0); expect(existsSync(join(root, "module-ran"))).toBe(true); expect(existsSync(join(root, "child-ran"))).toBe(true);
});
it("I95 closest explicit ordinary target excludes a foreign proposed ancestor", () => {
  proposed(join(outside, "cortex.config.json"), outside); malicious(join(project, "cortex.config.js")); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n");
  const result = run(["-d", "proposed", "config", "show", "-d", "normal", "--format", "json"]); expect(result.status).toBe(0); expect(JSON.parse(result.stdout).default).toBe("normal"); expect(result.envAccesses).toBeGreaterThan(0); expect(existsSync(join(root, "module-ran"))).toBe(true); expect(existsSync(join(root, "child-ran"))).toBe(true);
});
it("I95 exact explicit ordinary JSON alias retains env despite same-project proposal", () => {
  proposed(); json(join(project, "cortex.config.json"), ordinaryConfig()); malicious(join(project, "cortex.config.js")); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n");
  const result = run(["config", "show", "-d", "normal", "--format", "json"]); expect(result.status).toBe(0); expect(JSON.parse(result.stdout).default).toBe("normal"); expect(result.envAccesses).toBeGreaterThan(0); zeroEffects();
});
it("I95 exact unrelated JSON source/project keeps same-name ordinary alias", () => {
  proposed(join(outside, "cortex.config.json"), outside); json(join(project, "cortex.config.json"), proposedConfig()); malicious(join(project, "cortex.config.js")); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n");
  const result = run(["config", "show", "-d", "proposed", "--format", "json"]); expect(result.status).toBe(0); expect(JSON.parse(result.stdout).deployments.proposed.projectPath).toBe(project); expect(result.envAccesses).toBeGreaterThan(0); zeroEffects();
});

it("I95 inherited symlink project reference associates a differently named proposed session", () => {
  proposed(join(outside, "cortex.config.json"), outside); const reference = join(root, "project-reference"); symlinkSync(outside, reference);
  json(join(home, ".cortexrc"), { deployments: { alternate: { url: "http://127.0.0.1:1", projectPath: reference } } });
  malicious(join(project, "cortex.config.js")); writeFileSync(join(project, ".env.local"), "I95_CONTROL=loaded\n"); proposedRefusal();
});

it.each(["regular", "fifo"])("I95 already protected proposal never resolves irrelevant env %s project reference", kind => {
  proposed(); const env = join(project, ".env.local");
  if (kind === "fifo") expect(spawnSync("mkfifo", [env]).status).toBe(0); else writeFileSync(env, "I95_CONTROL=ignored\n");
  json(join(project, "cortex.config.json"), { ...ordinaryConfig(), deployments: { ...ordinaryConfig().deployments, irrelevant: { url: "http://127.0.0.1:1", projectPath: env } } });
  mkdirSync(join(project, ".config")); malicious(join(project, ".config/config.js")); proposedRefusal();
});

function envReferenceRefusal() {
  const result = run(["config", "show", "--format", "json"]); expect(result.error).toBeUndefined(); expect(result.status).toBe(1); expect(result.stderr).toContain("ADMISSION_PROJECT_REFERENCE_ENV_FORBIDDEN"); expect(result.envAccesses).toBe(0); expect(result.transportAccesses).toBe(0); zeroEffects();
}
it.each(["regular", "fifo", "symlink"].flatMap(kind => ["env-first", "project-first"].map(order => [kind, order])))("I95R2 unknown proposed mixed %s references %s never inspect env", (kind, order) => {
  proposed(join(outside, "cortex.config.json"), outside); const env = join(project, ".env.local");
  if (kind === "fifo") expect(spawnSync("mkfifo", [env]).status).toBe(0); else if (kind === "symlink") symlinkSync(outside, env); else writeFileSync(env, "I95_CONTROL=ignored\n");
  const irrelevant = { url: "http://127.0.0.1:1", projectPath: env }; const alternate = { url: "http://127.0.0.1:1", projectPath: outside };
  json(join(home, ".cortexrc"), { deployments: order === "env-first" ? { irrelevant, alternate } : { alternate, irrelevant } }); malicious(join(project, "cortex.config.js")); envReferenceRefusal();
});
it.each([".env.local", ".env.custom", "nested/../.env.local"])("I95R2 env-named canonical %s reference refuses before lookup", name => {
  proposed(join(outside, "cortex.config.json"), outside); const env = name.includes("/") ? `${project}/${name}` : join(project, name); symlinkSync(outside, resolve(env));
  json(join(home, ".cortexrc"), { deployments: { alternate: { url: "http://127.0.0.1:1", projectPath: env } } }); malicious(join(project, "cortex.config.js")); envReferenceRefusal();
});
it.each(["empty", "foreign-explicit"])("I95R2 %s ordinary JSON target retains automatic env with env-named project field", kind => {
  if (kind === "foreign-explicit") proposed(join(outside, "cortex.config.json"), outside); const env = join(project, ".env.local"); writeFileSync(env, "I95_CONTROL=loaded\n");
  json(join(project, "cortex.config.json"), { ...ordinaryConfig(), deployments: { normal: { url: "http://127.0.0.1:1", projectPath: env } } }); malicious(join(project, "cortex.config.js"));
  const result = run(["config", "show", "--format", "json", ...(kind === "foreign-explicit" ? ["-d", "normal"] : [])]); expect(result.error).toBeUndefined(); expect(result.status).toBe(0); expect(JSON.parse(result.stdout).default).toBe("normal"); expect(result.envAccesses).toBeGreaterThan(0); zeroEffects();
});
