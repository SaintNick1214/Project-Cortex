import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, lstatSync, realpathSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, isAbsolute, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const actualOs = await import("node:os");
jest.unstable_mockModule("node:os", () => ({ ...actualOs, homedir: () => process.env.HOME! }));
jest.unstable_mockModule("os", () => ({ ...actualOs, homedir: () => process.env.HOME! }));
const { AdmissionComplete, commandIntent, createProgram, effectiveOptions, sameCommandIntent } = await import("../../program.js");
const { admissionMetadataPaths, composeAdmissionConfig, discoverAdmission, discoverDataSources,
  readAdmissionRegistry, readScopedSelection, recheckAdmission, structuralProtected, withAdmissionContext } = await import("../bootstrap-admission.js");
import type { CommandIntent } from "../bootstrap-admission.js";
const { getConfigScope, loadConfig, saveEffectiveConfig } = await import("../config.js");
const { createClient } = await import("../client.js");
const stage = process.env.CORTEX_BOOTSTRAP_PROOF_ROOT;
if (!stage || !isAbsolute(stage)) throw new Error("BOOTSTRAP_PROOF_INPUT_REQUIRED: CORTEX_BOOTSTRAP_PROOF_ROOT must name an explicit private directory");
const proofInfo = lstatSync(stage);
const testCLI = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
if (stage === testCLI || stage.startsWith(`${testCLI}/`) || !proofInfo.isDirectory() || proofInfo.isSymbolicLink() || realpathSync(stage) !== stage || (proofInfo.mode & 0o077) || (process.getuid && proofInfo.uid !== process.getuid())) throw new Error("BOOTSTRAP_PROOF_ROOT_UNSAFE");
let root: string; let home: string; let cwd: string; let originalHome: string | undefined; let originalCwd: string;
const defaults = { deployments: {}, default: "", format: "table" as const, confirmDangerous: true };
function json(path: string, value: unknown) { writeFileSync(path, JSON.stringify(value), { mode: 0o600 }); }
beforeEach(() => {
  mkdirSync(join(stage, "unit-fixtures"), { recursive: true }); root = mkdtempSync(join(stage, "unit-fixtures/case-"));
  home = join(root, "home"); cwd = join(root, "project"); mkdirSync(home, { mode: 0o700 }); mkdirSync(cwd, { mode: 0o700 });
  originalHome = process.env.HOME; originalCwd = process.cwd(); process.env.HOME = home; process.chdir(cwd);
});
afterEach(() => { process.chdir(originalCwd); if (originalHome === undefined) delete process.env.HOME; else process.env.HOME = originalHome; rmSync(root, { recursive: true, force: true }); });
function owned() {
  const epoch = randomUUID(); const sessionId = randomUUID(); const ownerEpoch = randomUUID(); const paths = admissionMetadataPaths(home);
  const record = { sessionId, ownerEpoch, proposedAlias: "owned", registeredAlias: "owned", projectRealPath: cwd, configSourceIdentity: join(cwd, "cortex.config.json"), phase: "registered", everExposed: true, bindingDigest: "a".repeat(64) };
  mkdirSync(join(paths.sessions, sessionId), { recursive: true, mode: 0o700 });
  json(paths.registry, { version: 1, epoch, sessions: [record] }); json(join(paths.sessions, sessionId, "admission.json"), { version: 1, epoch, session: record });
  json(record.configSourceIdentity, { ...defaults, deployments: { owned: { url: "http://127.0.0.1:1", projectPath: cwd, restoreRuntime: { version: 1, sessionId, ownerEpoch, bindingDigest: record.bindingDigest } } }, default: "owned" });
  return { record, paths, epoch };
}
async function intent(args: string[]) {
  const program = createProgram(defaults, { admissionOnly: true }).exitOverride().configureOutput({ writeErr: () => {}, writeOut: () => {} });
  try { await program.parseAsync(args, { from: "user" }); throw new Error("Admission was not intercepted"); }
  catch (error) { if (error instanceof AdmissionComplete) return error.intent; throw error; }
}
it.each([
  ["-d", "root", "db", "export", "-d", "leaf"],
  ["db", "-d", "ancestor", "export", "-d", "leaf"],
  ["db", "export", "-d", "leaf"],
].map(args => [args]))("actual closest explicit target wins at registered placements", async args => {
  const admitted = await intent(args); expect(admitted.options.deployment).toBe("leaf"); expect(admitted.sources.deployment).toBe("cli"); expect(admitted.path).toEqual(["db", "export"]);
});
it("actual root explicit option beats absent leaf value", async () => { const admitted = await intent(["-d", "root", "db", "export"]); expect(admitted.options.deployment).toBe("root"); });
it.each([
  [["convs", "export", "space", "--format", "txt"], ["conversations", "export"]],
  [["convex", "env", "-l"], ["convex", "env"]],
  [["start", "-f", "--format", "json"], ["start"]],
  [["db", "import", "--", "--literal.zip"], ["db", "import"]],
  [["convex", "export", "-o", "out.zip", "--restore-bundle"], ["convex", "export"]],
])("aliases and reserved flags use actual registry grammar", async (args, path) => {
  const admitted = await intent(args); expect(admitted.path).toEqual(path);
  if (path.join(" ") === "convex env") expect(admitted.options.list).toBe(true);
  if (path[0] === "start") { expect(admitted.options.foreground).toBe(true); expect(admitted.options.format).toBe("json"); }
  if (path.join(" ") === "db import") expect(admitted.args).toEqual(["--literal.zip"]);
});
it("same argv yields equal immutable intents in both real factory modes before handlers", async () => {
  const args = ["-d", "target", "config", "show", "--format", "json"];
  const first = await intent(args); let second: CommandIntent | undefined; const program = createProgram(defaults).exitOverride();
  // Observe actual execution leaf at the final factory hook; no duplicated definitions.
  program.hook("preAction", (_root, action) => { second = commandIntent(action); throw new Error("observed"); });
  await expect(program.parseAsync(args, { from: "user" })).rejects.toThrow("observed");
  // Execution may fill format from config only when not explicitly provided; this case stays byte-identical.
  expect(second).toEqual(first); expect(sameCommandIntent(first, second!)).toBe(true); expect(Object.isFrozen(first.options)).toBe(true); expect(Object.isFrozen(first.path)).toBe(true);
});
it.each(["db", "convex"])("I108 %s standalone provenance protects an unowned ordinary target before handlers", async group => {
  const config = { ...defaults, deployments: { normal: { url: "http://127.0.0.1:1", projectPath: cwd } }, default: "normal" };
  json(join(cwd, "cortex.config.json"), config);
  const sidecar = join(root, "not-opened-sidecar.json");
  const args = [group, "import", join(root, "input.zip"), "--provenance", sidecar, "-d", "normal", "--replace-all", "--yes"];
  const admitted = await intent(args);
  expect(admitted.options.provenance).toBe(sidecar);
  expect(structuralProtected(admitted)).toBe(true);
  const context = await discoverAdmission(admitted);
  expect(context.mode).toBe("owned-data-only");
  expect(context.selectedAlias).toBe("normal");
  expect(context.registry.sessions).toEqual([]);
  const program = createProgram(config).exitOverride();
  const laterHook = jest.fn<() => void>(); program.hook("preAction", laterHook);
  await expect(withAdmissionContext(context, () => program.parseAsync(args, { from: "user" }))).rejects.toThrow("RESTORE_RUNTIME_UNAVAILABLE: protected restore is deferred and unsupported in this release");
  expect(laterHook).not.toHaveBeenCalled();
  expect(existsSync(sidecar)).toBe(false);
  const ordinary = await intent([group, "import", join(root, "input.zip"), "-d", "normal", "--replace-all", "--yes"]);
  expect(structuralProtected(ordinary)).toBe(false);
  expect((await discoverAdmission(ordinary)).mode).toBe("ordinary-trusted");
});
it("deferred protected restore grammar is explicit in help", () => {
  const program = createProgram(defaults);
  expect(program.commands.find(command => command.name() === "snapshot")!.description()).toContain("deferred; unsupported in this release");
  for (const name of ["db", "convex"]) {
    const group = program.commands.find(command => command.name() === name)!;
    for (const command of group.commands) for (const option of command.options) {
      if (["restoreBundle", "restoreSession", "provenance"].includes(option.attributeName()))
        expect(option.description).toBe("Deferred protected restore; unsupported in this release");
    }
  }
});
it("different second-pass identity refuses before ordinary hooks and handler", async () => {
  const first = await intent(["config", "show", "-d", "first"]); const hook = jest.fn<() => void>();
  const program = createProgram(defaults, { expectedIntent: first }).exitOverride(); program.hook("preAction", hook);
  await expect(program.parseAsync(["config", "show", "-d", "second"], { from: "user" })).rejects.toThrow("ADMISSION_INTENT_CHANGED"); expect(hook).not.toHaveBeenCalled();
});
it("admission-only earliest hook suppresses subsequently registered hooks", async () => {
  const hook = jest.fn<() => void>(); const program = createProgram(defaults, { admissionOnly: true }).exitOverride(); program.hook("preAction", hook);
  await expect(program.parseAsync(["config", "show"], { from: "user" })).rejects.toBeInstanceOf(AdmissionComplete); expect(hook).not.toHaveBeenCalled();
});
it("both factory modes contain identical full registration/alias/argument/option grammar", () => {
  const grammar = (program: ReturnType<typeof createProgram>): unknown => ({ name: program.name(), aliases: program.aliases(), args: program.registeredArguments.map(arg => [arg.name(), arg.required, arg.variadic]), options: program.options.map(option => [option.flags, option.required, option.optional]), children: program.commands.map(grammar) });
  expect(grammar(createProgram(defaults, { admissionOnly: true }))).toEqual(grammar(createProgram(defaults)));
});
it("resolver is observational until execution propagation", () => {
  const program = createProgram(defaults); const group = program.commands.find(command => command.name() === "db")!; const leaf = group.commands.find(command => command.name() === "export")!;
  program.setOptionValueWithSource("deployment", "root", "cli"); group.setOptionValueWithSource("deployment", "group", "cli"); leaf.setOptionValueWithSource("deployment", "default", "default");
  expect(effectiveOptions(leaf).options.deployment).toBe("group"); expect(leaf.opts().deployment).toBe("default");
});
it("safe composition preserves project credential binding and unknown field/source ownership", async () => {
  json(join(home, ".cortexrc"), { ...defaults, deployments: { one: { url: "http://127.0.0.1:1", key: "fixture-key" } }, future: { retained: true } });
  json(join(cwd, "cortex.config.json"), { deployments: { one: { url: "http://127.0.0.1:2" } }, format: "json" });
  const safe = composeAdmissionConfig(await discoverDataSources(cwd, undefined, home));
  expect(safe.deployments.one.key).toBeUndefined(); expect(safe.format).toBe("json"); expect(safe.future).toEqual({ retained: true });
});
it("complete registry is distinct from absent registry and retained-session unknown", async () => {
  expect(await readAdmissionRegistry(home)).toEqual({ version: 1, epoch: "absent", sessions: [] }); const fixture = owned();
  expect((await readAdmissionRegistry(home)).sessions[0]).toEqual(fixture.record); rmSync(fixture.paths.registry);
  await expect(readAdmissionRegistry(home)).rejects.toThrow("ADMISSION_REGISTRY_INCOMPLETE");
});
it.each(["extra-summary", "wrong-record", "wrong-source", "unknown-field", "symlink-directory"])("registry completeness/identity fails closed: %s", async kind => {
  const fixture = owned();
  if (kind === "extra-summary") mkdirSync(join(fixture.paths.sessions, randomUUID()), { mode: 0o700 });
  if (kind === "wrong-record") json(join(fixture.paths.sessions, fixture.record.sessionId, "admission.json"), { version: 1, epoch: fixture.epoch, session: { ...fixture.record, bindingDigest: "b".repeat(64) } });
  if (kind === "wrong-source") json(fixture.paths.registry, { version: 1, epoch: fixture.epoch, sessions: [{ ...fixture.record, configSourceIdentity: "relative" }] });
  if (kind === "unknown-field") json(fixture.paths.registry, { version: 1, epoch: fixture.epoch, sessions: [{ ...fixture.record, secret: "not allowed" }] });
  if (kind === "symlink-directory") { const { symlinkSync } = await import("node:fs"); rmSync(join(fixture.paths.sessions, fixture.record.sessionId), { recursive: true }); symlinkSync(cwd, join(fixture.paths.sessions, fixture.record.sessionId)); }
  await expect(readAdmissionRegistry(home)).rejects.toThrow(/ADMISSION_/);
});
it("scoped selection reads exact scope and preserves legacy non-target semantics", async () => {
  json(join(home, ".cortex-current"), { version: 1, selections: { [cwd]: "owned", [home]: "other" } });
  expect(await readScopedSelection(cwd, home)).toBe("owned"); expect(await readScopedSelection(root, home)).toBeUndefined();
  writeFileSync(join(home, ".cortex-current"), "legacy"); expect(await readScopedSelection(cwd, home)).toBeUndefined();
});
it("stale protected scoped selection refuses rather than falls back", async () => {
  owned(); json(join(home, ".cortex-current"), { version: 1, selections: { [cwd]: "missing" } }); await expect(discoverAdmission()).rejects.toThrow("ADMISSION_TARGET_INVALID");
});
it("direct loader/scope reuse the data-only context and refuse newly active executable shadow", async () => {
  const fixture = owned(); const admitted = await discoverAdmission(); expect(admitted.mode).toBe("owned-data-only");
  await withAdmissionContext(admitted, async () => { expect(await getConfigScope()).toBe(cwd); expect((await loadConfig()).default).toBe("owned"); });
  rmSync(fixture.record.configSourceIdentity); writeFileSync(join(cwd, "cortex.config.js"), `require('node:fs').writeFileSync(${JSON.stringify(join(root, "ran"))},'ran');module.exports={};`);
  await expect(withAdmissionContext(admitted, () => loadConfig())).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS"); await expect(withAdmissionContext(admitted, () => getConfigScope())).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS"); expect(existsSync(join(root, "ran"))).toBe(false);
});
it("changed JSON content and changed registry epoch invalidate reload/save", async () => {
  const fixture = owned(); const context = await discoverAdmission(); const safe = await withAdmissionContext(context, () => loadConfig());
  const initial = JSON.parse(readFileSync(fixture.record.configSourceIdentity, "utf8")); json(fixture.record.configSourceIdentity, { ...initial, future: true });
  await expect(recheckAdmission(context)).rejects.toThrow("ADMISSION_SOURCE_CHANGED"); await expect(saveEffectiveConfig(safe)).rejects.toThrow("ADMISSION_SOURCE_CHANGED");
  const fresh = await discoverAdmission(); const nextEpoch = randomUUID(); json(fixture.paths.registry, { version: 1, epoch: nextEpoch, sessions: [fixture.record] }); json(join(fixture.paths.sessions, fixture.record.sessionId, "admission.json"), { version: 1, epoch: nextEpoch, session: fixture.record });
  await expect(recheckAdmission(fresh)).rejects.toThrow("ADMISSION_SOURCE_CHANGED");
});
it("source-safe permitted save refreshes admitted provenance for safe reload", async () => {
  const fixture = owned(); json(join(home, ".cortexrc"), { ...defaults, future: "retained" }); const user = readFileSync(join(home, ".cortexrc")); const context = await discoverAdmission();
  await withAdmissionContext(context, async () => { const safe = await loadConfig(); safe.format = "json"; await saveEffectiveConfig(safe); expect((await loadConfig()).format).toBe("json"); expect(await getConfigScope()).toBe(cwd); });
  expect(readFileSync(join(home, ".cortexrc"))).toEqual(user); expect(JSON.parse(readFileSync(fixture.record.configSourceIdentity, "utf8")).deployments.owned.restoreRuntime.sessionId).toBe(fixture.record.sessionId);
});
it("protected source-safe save cannot strip a genuine registered binding", async () => {
  const fixture = owned(); const context = await discoverAdmission(); const safe = await withAdmissionContext(context, () => loadConfig()); delete safe.deployments.owned.restoreRuntime;
  await expect(saveEffectiveConfig(safe)).rejects.toThrow("ADMISSION_OWNED_CONFIG_IMMUTABLE"); expect(JSON.parse(readFileSync(fixture.record.configSourceIdentity, "utf8")).deployments.owned.restoreRuntime).toBeDefined();
});
it("direct no-context loader admits JSON safely before any explorer", async () => { owned(); expect((await loadConfig()).default).toBe("owned"); expect(await getConfigScope()).toBe(cwd); });
it("I111 nested owned admission uses the ancestor scope and never executes its shadowed JS", async () => {
  const fixture = owned(); const marker = join(root, "ancestor-module-ran");
  writeFileSync(join(cwd, "cortex.config.js"), `require('node:fs').writeFileSync(${JSON.stringify(marker)},'ran');module.exports={};`);
  const nested = join(cwd, "src", "deep"); mkdirSync(nested, { recursive: true }); process.chdir(nested);
  const context = await discoverAdmission(); expect(context.mode).toBe("owned-data-only"); expect(context.data.scope).toBe(cwd); expect(context.data.sourcePath).toBe(fixture.record.configSourceIdentity);
  expect((await withAdmissionContext(context, () => loadConfig())).default).toBe("owned"); expect(await withAdmissionContext(context, () => getConfigScope())).toBe(cwd); expect(existsSync(marker)).toBe(false);
});
it("I111 retained ancestor proposal blocks active executable discovery from nested cwd", async () => {
  proposed(); const markers = proposedExecutable(); const nested = join(cwd, "nested"); mkdirSync(nested); process.chdir(nested);
  await expect(discoverAdmission()).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS"); expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it("serialized caller-provided admission context is rejected", async () => { const context = await discoverAdmission(); expect(() => withAdmissionContext(JSON.parse(JSON.stringify(context)), () => true)).toThrow("ADMISSION_CONTEXT_INVALID"); });
it("actual direct createClient rejects unverified owned endpoint before fetch/socket construction", async () => {
  owned(); const safe = await loadConfig(); const fetch = jest.spyOn(globalThis, "fetch"); await expect(createClient(safe, { deployment: "owned" })).rejects.toThrow("RESTORE_RUNTIME_UNAVAILABLE"); expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
});
it("actual direct createClient raw URL override cannot downgrade owned declaration", async () => { owned(); const safe = await loadConfig(); await expect(createClient(safe, { url: "http://127.0.0.1:2" })).rejects.toThrow("RESTORE_RUNTIME_UNAVAILABLE"); });
it("same bytes with replaced inode invalidate protected reload before effects", async () => {
  const { renameSync } = await import("node:fs"); const fixture = owned(); const context = await discoverAdmission();
  const replacement = join(cwd, "replacement.json"); writeFileSync(replacement, readFileSync(fixture.record.configSourceIdentity), { mode: 0o600 }); renameSync(replacement, fixture.record.configSourceIdentity);
  await expect(withAdmissionContext(context, () => loadConfig())).rejects.toThrow("ADMISSION_SOURCE_CHANGED");
});
it("private metadata permission change invalidates protected reload", async () => {
  const { chmodSync } = await import("node:fs"); const fixture = owned(); const context = await discoverAdmission(); chmodSync(fixture.paths.registry, 0o640);
  await expect(withAdmissionContext(context, () => loadConfig())).rejects.toThrow("ADMISSION_METADATA_PERMISSIONS");
});
it("owner epoch mutation cannot preserve a registered binding or permit fallback", async () => {
  const fixture = owned(); const context = await discoverAdmission(); const changed = { ...fixture.record, ownerEpoch: randomUUID() };
  json(fixture.paths.registry, { version: 1, epoch: fixture.epoch, sessions: [changed] }); json(join(fixture.paths.sessions, fixture.record.sessionId, "admission.json"), { version: 1, epoch: fixture.epoch, session: changed });
  await expect(withAdmissionContext(context, () => loadConfig())).rejects.toThrow("ADMISSION_BINDING_INVALID");
});
it("ctime-only same-mode metadata update retains actual stable source identity/bytes", async () => {
  const { chmodSync } = await import("node:fs"); const fixture = owned(); const context = await discoverAdmission(); chmodSync(fixture.paths.registry, 0o600);
  const safe = await withAdmissionContext(context, () => loadConfig()); expect(safe.deployments.owned.restoreRuntime?.ownerEpoch).toBe(fixture.record.ownerEpoch); expect(safe.default).toBe("owned");
});
it("create with absent project source records permitted project JSON registration location", async () => {
  const parsed = await intent(["snapshot", "create", "fresh", "--project", cwd, "--yes"]); const context = await discoverAdmission(parsed);
  expect(context.mode).toBe("owned-data-only"); expect(context.data.sourcePath).toBe(join(cwd, "cortex.config.json")); expect(existsSync(context.data.sourcePath)).toBe(false);
});

// I95: complete unregistered session summaries participate before executable selection.
function proposed(source = join(cwd, "cortex.config.json"), project = cwd, phase = "private-paused") {
  const epoch = randomUUID(); const sessionId = randomUUID(); const ownerEpoch = randomUUID(); const paths = admissionMetadataPaths(home);
  const record = { sessionId, ownerEpoch, proposedAlias: "proposed", projectRealPath: project, configSourceIdentity: source, phase, everExposed: false, bindingDigest: "b".repeat(64) };
  mkdirSync(join(paths.sessions, sessionId), { recursive: true, mode: 0o700 });
  json(paths.registry, { version: 1, epoch, sessions: [record] }); json(join(paths.sessions, sessionId, "admission.json"), { version: 1, epoch, session: record });
  return record;
}
function proposedExecutable(directory = cwd) {
  const moduleMarker = join(root, "I95-module-ran"); const childMarker = join(root, "I95-child-ran");
  writeFileSync(join(directory, "cortex.config.js"), `require('node:fs').writeFileSync(${JSON.stringify(moduleMarker)},'ran');require('node:child_process').execFileSync(process.execPath,['-e',${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(childMarker)},'ran')`)}]);module.exports=${JSON.stringify({ ...defaults, deployments: { proposed: { url: "http://127.0.0.1:1", projectPath: directory } }, default: "proposed" })};`);
  return { moduleMarker, childMarker };
}
it.each(["creating", "private-paused", "failed", "unknown", "stopped", "native-running-confirmed"])("I95 retained proposed %s session blocks no-context executable admission", async phase => {
  proposed(undefined, undefined, phase); const markers = proposedExecutable();
  await expect(discoverAdmission()).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS");
  expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it.each(["loadConfig", "getConfigScope"])("I95 direct %s cannot evaluate a genuine proposed session source", async operation => {
  proposed(); const markers = proposedExecutable();
  await expect(operation === "loadConfig" ? loadConfig() : getConfigScope()).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS");
  expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it.each([
  ["-d", "proposed", "config", "show"], ["config", "-d", "proposed", "show"], ["config", "show", "-d", "proposed"],
].map(args => [args]))("I95 real explicit proposed placements block before configuration", async args => {
  proposed(); const markers = proposedExecutable();
  await expect(discoverAdmission(await intent(args))).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS");
  expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it("I95 inherited proposed user-source association blocks unrelated-cwd executable", async () => {
  const other = join(root, "other-project"); mkdirSync(other); proposed(join(home, ".cortexrc"), other); json(join(home, ".cortexrc"), { format: "json" }); const markers = proposedExecutable();
  await expect(discoverAdmission()).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS"); expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it("I95 inherited JSON project reference makes proposed association reachable", async () => {
  const other = join(root, "other-project"); mkdirSync(other); proposed(join(other, "cortex.config.json"), other); json(join(home, ".cortexrc"), { deployments: { proposed: { url: "http://127.0.0.1:1", projectPath: other } } }); const markers = proposedExecutable();
  await expect(discoverAdmission()).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS"); expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it("I95 explicit project overlay is examined before executable evaluation", async () => {
  const other = join(root, "other-project"); mkdirSync(other); proposed(join(other, "cortex.config.json"), other); const markers = proposedExecutable(other);
  await expect(discoverAdmission(await intent(["status", "--project", other]))).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS"); expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it("I95 proposed scoped selection is examined before an unrelated executable", async () => {
  const other = join(root, "other-project"); mkdirSync(other); proposed(join(other, "cortex.config.json"), other); json(join(home, ".cortex-current"), { version: 1, selections: { [cwd]: "proposed" } }); const markers = proposedExecutable();
  await expect(discoverAdmission()).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS"); expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it("I95 inherited proposed default candidate is examined before executable", async () => {
  const other = join(root, "other-project"); mkdirSync(other); proposed(join(other, "cortex.config.json"), other); json(join(home, ".cortexrc"), { default: "proposed" }); const markers = proposedExecutable();
  await expect(discoverAdmission()).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS"); expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it("I95 exact unrelated explicit JSON target retains ordinary admission", async () => {
  proposed(); json(join(cwd, "cortex.config.json"), { ...defaults, deployments: { normal: { url: "http://127.0.0.1:1", projectPath: cwd } }, default: "normal" });
  const context = await discoverAdmission(await intent(["config", "show", "-d", "normal"])); expect(context.mode).toBe("ordinary-trusted"); expect(context.selectedAlias).toBe("normal");
});
it("I95 explicit JSON source/project disproves a foreign same-name proposal", async () => {
  const other = join(root, "other-project"); mkdirSync(other); proposed(join(other, "cortex.config.json"), other); json(join(cwd, "cortex.config.json"), { ...defaults, deployments: { proposed: { url: "http://127.0.0.1:1", projectPath: cwd } }, default: "proposed" });
  const context = await discoverAdmission(await intent(["config", "show", "-d", "proposed"])); expect(context.mode).toBe("ordinary-trusted"); expect(context.selectedAlias).toBe("proposed");
});
it("I95 unrelated proposed project does not globally retire ordinary executable config", async () => {
  const other = join(root, "other-project"); mkdirSync(other); proposed(join(other, "cortex.config.json"), other); proposedExecutable();
  const context = await discoverAdmission(await intent(["config", "show", "-d", "normal"])); expect(context.mode).toBe("ordinary-trusted"); expect(context.selectedAlias).toBe("normal");
});

it("I95 inherited symlink project reference associates a differently named proposal", async () => {
  const { symlinkSync } = await import("node:fs"); const other = join(root, "other-project"); mkdirSync(other); proposed(join(other, "cortex.config.json"), other);
  const reference = join(root, "project-reference"); symlinkSync(other, reference); json(join(home, ".cortexrc"), { deployments: { alternate: { url: "http://127.0.0.1:1", projectPath: reference } } });
  const markers = proposedExecutable(); await expect(discoverAdmission()).rejects.toThrow("ADMISSION_CONFIG_AMBIGUOUS"); expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});

function unresolvedEnvReference(order: string, name = ".env.local") {
  const other = join(root, "other-project"); mkdirSync(other); proposed(join(other, "cortex.config.json"), other);
  const irrelevant = { url: "http://127.0.0.1:1", projectPath: name.includes("/") ? `${cwd}/${name}` : join(cwd, name) }; const alternate = { url: "http://127.0.0.1:1", projectPath: other };
  json(join(home, ".cortexrc"), { deployments: order === "env-first" ? { irrelevant, alternate } : { alternate, irrelevant } }); return proposedExecutable();
}
it.each(["env-first", "project-first"])("I95R2 unknown mixed references %s refuse before no-context effects", async order => {
  const markers = unresolvedEnvReference(order); await expect(discoverAdmission()).rejects.toThrow("ADMISSION_PROJECT_REFERENCE_ENV_FORBIDDEN"); expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it.each(["loadConfig", "getConfigScope"])("I95R2 direct %s refuses unresolved env reference before effects", async operation => {
  const markers = unresolvedEnvReference("env-first"); await expect(operation === "loadConfig" ? loadConfig() : getConfigScope()).rejects.toThrow("ADMISSION_PROJECT_REFERENCE_ENV_FORBIDDEN"); expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
it.each([".env.custom", "nested/../.env.local"])("I95R2 normalized env reference %s refuses before effects", async name => {
  const markers = unresolvedEnvReference("project-first", name); await expect(discoverAdmission()).rejects.toThrow("ADMISSION_PROJECT_REFERENCE_ENV_FORBIDDEN"); expect(existsSync(markers.moduleMarker)).toBe(false); expect(existsSync(markers.childMarker)).toBe(false);
});
