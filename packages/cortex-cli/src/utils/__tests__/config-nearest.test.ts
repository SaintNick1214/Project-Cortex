import { beforeEach, afterEach, expect, it, jest } from "@jest/globals";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const actualOs = await import("node:os");
jest.unstable_mockModule("os", () => ({ ...actualOs, homedir: () => process.env.HOME! }));
jest.unstable_mockModule("node:os", () => ({ ...actualOs, homedir: () => process.env.HOME! }));
const { loadConfig, getConfigScope, saveEffectiveConfig, resolveConfig } = await import("../config.js");
const { discoverDataSources, discoverAdmission, withAdmissionContext } = await import("../bootstrap-admission.js");
const { setCurrentDeployment, getCurrentDeployment, clearCurrentDeployment, selectDeployment } = await import("../deployment-selector.js");
let root: string, home: string, project: string, nested: string, previousCwd: string, previousHome: string | undefined;
function json(path: string, value: unknown) { writeFileSync(path, JSON.stringify(value), { mode: 0o600 }); }
const user = { deployments: { shared: { url: "http://127.0.0.1:1001", key: "user-fixture-key" }, userOnly: { url: "http://127.0.0.1:1002" } }, default: "userOnly", format: "table", confirmDangerous: true };
const parent = { deployments: { shared: { url: "http://127.0.0.1:2001" }, other: { url: "http://127.0.0.1:2002" } }, default: "shared", marker: "parent-only" };
beforeEach(() => {
  previousCwd = process.cwd(); previousHome = process.env.HOME;
  root = realpathSync(mkdtempSync(join(tmpdir(), "cortex-nearest-"))); home = join(root, "home"); project = join(home, "project"); nested = join(project, "src", "deep");
  mkdirSync(nested, { recursive: true, mode: 0o700 }); process.env.HOME = home; process.chdir(nested);
  json(join(home, ".cortexrc"), user); json(join(project, "cortex.config.json"), parent);
});
afterEach(() => { process.chdir(previousCwd); if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome; rmSync(root, { recursive: true, force: true }); });
it("I111 nested load uses nearest project precedence without inheriting credentials for its changed URL", async () => {
  const config = await loadConfig();
  expect(config.default).toBe("shared"); expect(config.deployments.shared).toEqual({ url: "http://127.0.0.1:2001" });
  expect(config.deployments.userOnly).toEqual(user.deployments.userOnly); expect(resolveConfig(config, {}).key).toBeUndefined();
  const data = await discoverDataSources(nested, undefined, home); expect(data.sourcePath).toBe(join(project, "cortex.config.json")); expect(data.scope).toBe(project);
});
it("I111 root and nested use share one project scope while sibling fallback is isolated", async () => {
  expect(await getConfigScope()).toBe(project); await setCurrentDeployment("other");
  process.chdir(project); expect(await getConfigScope()).toBe(project); expect(await getCurrentDeployment()).toBe("other");
  process.chdir(nested); expect(await getCurrentDeployment()).toBe("other");
  const sibling = join(home, "sibling"); mkdirSync(sibling); process.chdir(sibling);
  expect(await getConfigScope()).toBe(sibling); expect(await getCurrentDeployment()).toBeNull(); expect((await loadConfig()).default).toBe("userOnly");
});
it("I111 legacy cwd selection remains ahead of the new parent default without readonly rewrites", async () => {
  json(join(home, ".cortexrc"), { ...user, deployments: { ...user.deployments, other: parent.deployments.other } });
  const path = join(home, ".cortex-current"); json(path, { version: 1, selections: { [nested]: "other" } }); const before = readFileSync(path);
  const config = await loadConfig(); expect(config.default).toBe("shared");
  expect(await getCurrentDeployment()).toBe("other"); expect((await selectDeployment(config, { quiet: true }))!.name).toBe("other");
  expect((await discoverAdmission()).selectedAlias).toBe("other");
  expect((await selectDeployment(config, { deployment: "shared", quiet: true }))!.name).toBe("shared"); expect(readFileSync(path)).toEqual(before);
});
it("I111 legacy cwd selection is replaced or cleared only by explicit use and preserves other scopes", async () => {
  json(join(home, ".cortexrc"), { ...user, deployments: { ...user.deployments, other: parent.deployments.other } });
  const path = join(home, ".cortex-current"); const sibling = join(home, "sibling");
  json(path, { version: 1, selections: { [nested]: "other", [project]: "shared", [sibling]: "userOnly" } });
  expect(await getCurrentDeployment()).toBe("other"); await setCurrentDeployment("shared");
  expect(JSON.parse(readFileSync(path, "utf8")).selections).toEqual({ [project]: "shared", [sibling]: "userOnly" });
  expect(await getCurrentDeployment()).toBe("shared");
  json(path, { version: 1, selections: { [nested]: "other", [project]: "shared", [sibling]: "userOnly" } }); await clearCurrentDeployment();
  expect(JSON.parse(readFileSync(path, "utf8")).selections).toEqual({ [sibling]: "userOnly" }); expect(await getCurrentDeployment()).toBeNull();
});
it("I111 legacy stale cwd selection refuses instead of falling back to the new parent default", async () => {
  json(join(home, ".cortex-current"), { version: 1, selections: { [nested]: "missing" } });
  await expect(loadConfig()).rejects.toThrow(/ADMISSION_LEGACY_SELECTION_CHANGED.*use --clear/);
});
it("I111 legacy same alias changed endpoint refuses before selecting the new parent URL", async () => {
  const path = join(home, ".cortex-current"); json(path, { version: 1, selections: { [nested]: "shared" } }); const before = readFileSync(path);
  await expect(loadConfig()).rejects.toThrow(/ADMISSION_LEGACY_SELECTION_CHANGED.*explicit -d.*use/);
  expect(readFileSync(path)).toEqual(before);
  const context = await discoverAdmission({ path: ["config", "deployments"], args: [], options: { deployment: "shared" }, sources: { deployment: "cli" } });
  await withAdmissionContext(context, async () => expect((await loadConfig()).deployments.shared.url).toBe(parent.deployments.shared.url)); expect(readFileSync(path)).toEqual(before);
});
it("I111 nested effective writes update the ancestor source without copying inherited user fields", async () => {
  const before = readFileSync(join(home, ".cortexrc")); const config = await loadConfig(); config.default = "other"; await saveEffectiveConfig(config);
  expect(JSON.parse(readFileSync(join(project, "cortex.config.json"), "utf8"))).toEqual({ ...parent, default: "other" });
  expect(readFileSync(join(home, ".cortexrc"))).toEqual(before); expect(existsSync(join(nested, "cortex.config.json"))).toBe(false);
});
it("I111 closer child configuration wins without merging an unrelated ancestor project", async () => {
  json(join(project, "src", "cortex.config.json"), { deployments: { child: { url: "http://127.0.0.1:3001", key: "child-fixture-key" } }, default: "child" });
  const config = await loadConfig(); expect(config.default).toBe("child"); expect(config.deployments.other).toBeUndefined(); expect(resolveConfig(config, {}).key).toBe("child-fixture-key"); expect(await getConfigScope()).toBe(join(project, "src"));
});
it("I111 malformed closest configuration errors rather than searching past it", async () => {
  writeFileSync(join(project, "src", "cortex.config.json"), "{malformed");
  await expect(loadConfig()).rejects.toThrow(/project configuration|ADMISSION_JSON_INVALID/); await expect(getConfigScope()).rejects.toThrow();
});
it("I111 empty/no-cortex child sources do not hide the supported ancestor", async () => {
  writeFileSync(join(project, "src", "cortex.config.json"), " \n"); json(join(project, "src", "package.json"), { name: "no-cortex-field" });
  expect((await loadConfig()).default).toBe("shared"); expect(await getConfigScope()).toBe(project);
});
it.each(["package", "javascript"])("I111 ordinary ancestor %s configuration remains supported", async kind => {
  rmSync(join(project, "cortex.config.json"));
  if (kind === "package") json(join(project, "package.json"), { name: "fixture", cortex: parent });
  else writeFileSync(join(project, "cortex.config.js"), `module.exports=${JSON.stringify(parent)};`);
  const config = await loadConfig(); expect(config.default).toBe("shared"); expect(await getConfigScope()).toBe(project);
  config.default = "other"; await expect(saveEffectiveConfig(config)).rejects.toThrow("not a writable JSON config");
});
it("I111 HOME stops ancestor discovery and the user file is not treated twice as project config", async () => {
  json(join(root, "cortex.config.json"), parent); process.chdir(home);
  const config = await loadConfig(); expect(config.default).toBe("userOnly"); expect(config.deployments.other).toBeUndefined();
  const data = await discoverDataSources(home, undefined, home); expect(data.sourcePath).toBe(join(home, ".cortexrc")); expect(data.project).toEqual({}); expect(data.fingerprints.filter(row => row.path === data.userPath)).toHaveLength(1);
});
