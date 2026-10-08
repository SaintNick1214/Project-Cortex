/** Existing runtimes only; early refusal must precede the application graph. */
import { afterEach, beforeAll, beforeEach, expect, it } from "@jest/globals";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const cli = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let base: string;
let root: string;
let guard: string;
let minimum: string;
const unsupported: Record<string, string> = {};
function input(name: string): string {
  const value = process.env[name];
  if (!value || !isAbsolute(value) || !existsSync(value)) throw new Error(`RUNTIME_PROOF_INPUT_REQUIRED: ${name}`);
  return value;
}
beforeAll(() => {
  base = input("CORTEX_BOOTSTRAP_PROOF_ROOT");
  const info = lstatSync(base);
  if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(base) !== base || (info.mode & 0o077) || (process.getuid && info.uid !== process.getuid()))
    throw new Error("RUNTIME_PROOF_ROOT_UNSAFE");
  guard = input("CORTEX_RUNTIME_GUARD");
  minimum = input("CORTEX_RUNTIME_NODE_MINIMUM");
  unsupported["20.0.0"] = input("CORTEX_RUNTIME_NODE20_0");
  unsupported["20.20.2"] = input("CORTEX_RUNTIME_NODE20_20");
  if (!existsSync(join(cli, "dist/utils/node-runtime.js"))) throw new Error("RUNTIME_PROOF_BUILD_REQUIRED");
});
beforeEach(() => {
  root = mkdtempSync(join(base, "runtime-case-"));
  for (const name of ["home", "home/project", "tmp", "package/dist/utils"]) mkdirSync(join(root, name), { recursive: true, mode: 0o700 });
  writeFileSync(join(root, "package/package.json"), '{"type":"module"}');
  for (const name of ["index.js", "utils/node-runtime.js"]) cpSync(join(cli, "dist", name), join(root, "package/dist", name));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
function run(node: string, args: string[]) {
  const audit = join(root, "audit.jsonl");
  writeFileSync(audit, "", { mode: 0o600 });
  const result = spawnSync(node, ["--require", guard, "--", join(root, "package/dist/index.js"), ...args], {
    cwd: join(root, "home/project"), encoding: "utf8", timeout: 20000, maxBuffer: 512 * 1024,
    env: { HOME: join(root, "home"), TMPDIR: join(root, "tmp"), PATH: `${dirname(node)}:/usr/bin:/bin`, LANG: "C", NO_COLOR: "1", NODE20_QUAL_ROOT: root, NODE20_QUAL_AUDIT: audit },
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(1024 * 1024);
  const events = readFileSync(audit, "utf8").trim().split("\n").map(line => JSON.parse(line));
  expect(events.filter(event => event.kind === "guard-ready")).toHaveLength(1);
  expect(events.filter(event => event.kind === "factory-denied" && event.phase === "product")).toEqual([]);
  expect(existsSync(join(root, "app-ran"))).toBe(false);
  expect(existsSync(join(root, "config-ran"))).toBe(false);
  return result;
}
it.each(["20.0.0", "20.20.2"].flatMap(version => [[], ["--version"], ["--help"], ["doctor"], ["db", "backup"]].map(args => [version, args] as const)))(
  "Node%s refuses %j before linking app/config/env/client factories",
  (version, args) => {
    writeFileSync(join(root, "package/dist/cli-main.js"), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(join(root, "app-ran"))},'ran');throw new Error('APPLICATION_LINKED_BEFORE_RUNTIME_CHECK');`);
    writeFileSync(join(root, "home/project/cortex.config.js"), `require('node:fs').writeFileSync(${JSON.stringify(join(root, "config-ran"))},'ran');module.exports={};`);
    writeFileSync(join(root, "home/project/.env.local"), "RUNTIME_CANARY=must-not-be-loaded\n");
    const result = run(unsupported[version], [...args]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(`Cortex CLI requires Node.js >=22.16.0; found v${version}. Upgrade to a supported Node.js LTS release.\n`);
    expect(existsSync(join(root, "home/.cortexrc"))).toBe(false);
  },
);
it("supported minimum reports application import failure plainly without formatter fallback", () => {
  // cli-main deliberately absent: the supported branch must attempt the import.
  const result = run(minimum, ["--version"]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Unable to start Cortex CLI:");
  expect(result.stderr).toContain("cli-main.js");
  expect(result.stderr).not.toContain("requires Node.js");
});
