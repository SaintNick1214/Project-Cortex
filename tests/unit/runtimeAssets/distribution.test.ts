import { afterEach, describe, expect, test } from "@jest/globals";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const run = promisify(execFile); const owned: string[] = [];
afterEach(async () => { await Promise.all(owned.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "cortex-assets-distribution-")); owned.push(root);
  const source = join(root, "source"); const output = join(root, "output"); await mkdir(join(source, "convex-dev"), { recursive: true });
  await writeFile(join(source, "package.json"), JSON.stringify({ version: "fixture", peerDependencies: { convex: "^1.46.0" }, dependencies: { "@convex-dev/agent": "0.7.3" } }));
  await writeFile(join(source, "convex-dev/schema.ts"), 'import { defineSchema, defineTable } from "convex/server"; export default defineSchema({ assets: defineTable({}) });');
  await writeFile(join(source, "convex-dev/convex.config.ts"), 'import { defineApp } from "convex/server"; import agent from "@convex-dev/agent/convex.config"; const app = defineApp(); app.use(agent, { name: "agent" }); export default app;');
  await writeFile(join(source, "convex-dev/runtimeAssetsHttp.ts"), 'export const uploadAsset = "upload"; export const downloadAsset = "download"; export const assetOptions = "options";');
  const http = 'import { httpRouter } from "convex/server";\nimport { uploadAsset, downloadAsset, assetOptions } from "./runtimeAssetsHttp";\nconst http = httpRouter();\nhttp.route({ path: "/cortex/assets/upload", method: "POST", handler: uploadAsset });\nhttp.route({ path: "/cortex/assets/download", method: "GET", handler: downloadAsset });\nhttp.route({ path: "/cortex/assets/upload", method: "OPTIONS", handler: assetOptions });\nhttp.route({ path: "/cortex/assets/download", method: "OPTIONS", handler: assetOptions });\nexport default http;\n';
  const httpPath = join(source, "convex-dev/http.ts"); await writeFile(httpPath, http);
  async function build() { await run(process.execPath, ["--input-type=module", "--eval", `import { buildBackendDistribution } from ${JSON.stringify(pathToFileURL(resolve("scripts/backend/build-distribution.mjs")).href)}; await buildBackendDistribution(${JSON.stringify({ sourceRoot: source, outputRoot: output })});`], { timeout: 10000 }); }
  return { source, output, http, httpPath, build };
}
describe("digest-bound additive private HTTP distribution", () => {
  test("the real generator preserves exact routes, fixed handler closure and original provenance", async () => {
    const f = await fixture(); await f.build();
    const manifest = JSON.parse(await readFile(join(f.output, "manifest.json"), "utf8")) as { httpRoutes: string[]; files: { path: string; sha256: string; sourcePath: string; sourceSha256: string }[] };
    expect(manifest.httpRoutes).toEqual(["GET /cortex/assets/download", "OPTIONS /cortex/assets/download", "OPTIONS /cortex/assets/upload", "POST /cortex/assets/upload"]);
    const helper = await readFile(join(f.output, "_cortex/http.ts"), "utf8");
    expect(helper).toContain('from "../runtimeAssetsHttp"'); expect(helper).toContain("export function registerCortexHttpRoutesV1");
    expect(helper).not.toContain("export default"); expect(helper.match(/http.route\(/g)).toHaveLength(4);
    expect(await readFile(join(f.output, "runtimeAssetsHttp.ts"), "utf8")).toContain('export const downloadAsset = "download"');
    const hash = (text: string) => createHash("sha256").update(text).digest("hex");
    expect(manifest.files.find(file => file.path === "_cortex/http.ts")).toEqual({ path: "_cortex/http.ts", sha256: hash(helper), sourcePath: "convex-dev/http.ts", sourceSha256: hash(f.http) });
  });
  test("an unsupported route is rejected before replacing the last complete distribution", async () => {
    const f = await fixture(); await f.build(); const before = await readFile(join(f.output, "manifest.json"), "utf8"); const helper = await readFile(join(f.output, "_cortex/http.ts"), "utf8");
    await writeFile(f.httpPath, f.http.replace('"/cortex/assets/download", method: "GET"', '"/private/other", method: "GET"'));
    await expect(f.build()).rejects.toThrow("Unsupported asset HTTP route");
    expect(await readFile(join(f.output, "manifest.json"), "utf8")).toBe(before); expect(await readFile(join(f.output, "_cortex/http.ts"), "utf8")).toBe(helper);
  });
});
