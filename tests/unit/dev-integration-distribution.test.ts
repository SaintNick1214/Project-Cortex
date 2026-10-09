import { afterEach, describe, expect, it } from "@jest/globals";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const run = promisify(execFile); const owned: string[] = [];
afterEach(async () => {await Promise.all(owned.splice(0).map(path => rm(path, {recursive: true, force: true})));});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "cortex-merged-closure-")); owned.push(root);
  const source = join(root, "source"), output = join(root, "output");
  async function save(path: string, text: string) {await mkdir(join(source, path, ".."), {recursive: true}); await writeFile(join(source, path), text);}
  await save("package.json", JSON.stringify({version: "0.38.0", peerDependencies: {convex: "^1.46.0"}, dependencies: {}}));
  await save("convex-dev/schema.ts", 'import { defineSchema, defineTable } from "convex/server"; import { tables } from "./lib/provenance"; export default defineSchema({ runtime: defineTable({}), ...tables });');
  await save("convex-dev/lib/provenance.ts", 'import { defineTable } from "convex/server"; export const tables = { references: defineTable({}) };');
  await save("convex-dev/convex.config.ts", 'import { defineApp } from "convex/server"; import agent from "@convex-dev/agent/convex.config"; const app = defineApp(); app.use(agent, {name: "agent"}); export default app;');
  await save("convex-dev/cliOperator/nested/admin.ts", 'import { internalQuery } from "../../_generated/server"; import type { Id } from "../../_generated/dataModel"; import { profile } from "../../../src/domain/profile"; export const get = internalQuery({args: {}, handler: () => profile});');
  await save("convex-dev/_generated/server.ts", 'throw new Error("HOST GENERATED SNAPSHOT MUST NOT BE PACKAGED");');
  await save("src/domain/profile.ts", 'export const profile = {dimensions: 3072, profileId: "current"};');
  await save("convex-dev/lib/runtimeDomain/domain/profile.ts", 'export const staleProfile = {dimensions: 1536, profileId: "old"};');
  async function build() {await run(process.execPath, ["--input-type=module", "--eval", `import {buildBackendDistribution} from ${JSON.stringify(pathToFileURL(resolve("scripts/backend/build-distribution.mjs")).href)}; await buildBackendDistribution(${JSON.stringify({sourceRoot: source, outputRoot: output})});`], {timeout: 15000});}
  return {source, output, build};
}
describe("merged backend recursive additive distribution", () => {
  it("includes nested operator registration, binds host codegen and derives canonical current shared source", async () => {
    const f = await fixture(); await f.build();
    const manifest = JSON.parse(await readFile(join(f.output, "manifest.json"), "utf8")) as {files: {path: string; sourcePath: string; sha256: string}[]; tables: string[]};
    const text = await readFile(join(f.output, "cliOperator/nested/admin.ts"), "utf8");
    expect(text).toContain('from "../../_generated/server"'); expect(text).toContain('from "../../_generated/dataModel"');
    expect(text).toContain('from "../../_cortex/shared/domain/profile"');
    expect(await readFile(join(f.output, "_cortex/shared/domain/profile.ts"), "utf8")).toContain("3072");
    expect(manifest.tables).toEqual(["references", "runtime"]);
    expect(manifest.files.some(file => file.path.includes("_generated/") || file.path.includes("runtimeDomain/"))).toBe(false);
    expect(manifest.files.find(file => file.path === "cliOperator/nested/admin.ts")).toMatchObject({sourcePath: "convex-dev/cliOperator/nested/admin.ts", sha256: createHash("sha256").update(text).digest("hex")});
  });
  it("preserves the prior complete manifest when a nested source has an unresolved import", async () => {
    const f = await fixture(); await f.build(); const before = await readFile(join(f.output, "manifest.json"), "utf8");
    await writeFile(join(f.source, "convex-dev/cliOperator/nested/admin.ts"), 'import { missing } from "../../lib/not-present"; export const get = missing;');
    await expect(f.build()).rejects.toThrow("Unresolved backend source import");
    expect(await readFile(join(f.output, "manifest.json"), "utf8")).toBe(before);
  });
});
