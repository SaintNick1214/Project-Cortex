import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { httpActionGeneric, httpRouter, type HttpRouter } from "convex/server";
import { applyAdditiveBackendInstallation, BackendMergeRequiredError, installAdditiveBackend, planAdditiveBackendInstallation } from "../init/additive-backend.js";
import { createConvexJson } from "../init/file-operations.js";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const execute = promisify(execFile);
const builder = fileURLToPath(new URL("../../../../../scripts/backend/build-distribution.mjs", import.meta.url));
const provider = { type: "customJwt" as const, issuer: "https://issuer.example", jwks: "https://issuer.example/jwks", algorithm: "RS256" as const, applicationID: "cortex" };
let root: string;
let sdk: string;
let host: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-additive-test-"));
  sdk = path.join(root, "sdk"); host = path.join(root, "host");
  const files = new Map([
    ["_cortex/schema.ts", 'import { defineTable } from "convex/server"; export const cortexTablesV1 = { runtimeRuns: defineTable({}) };\n'],
    ["_cortex/components.config.ts", 'import type { AppDefinition } from "convex/server"; import agent from "@convex-dev/agent/convex.config";\nexport function registerCortexComponentsV1(app: AppDefinition) { app.use(agent, { name: "agent" }); }\n'],
    ["runs.ts", '"use node";\nexport const qualifiedRun = true;\n'],
    ["_cortex/shared/domain/profile.ts", 'export const profile = "qualified";\n'],
  ]);
  await fs.ensureDir(path.join(sdk, "dist/backend/v1")); await fs.ensureDir(host);
  for (const [name, text] of files) { await fs.outputFile(path.join(sdk, "dist/backend/v1", name), text); }
  await fs.writeJson(path.join(sdk, "dist/backend/v1/manifest.json"), { formatVersion: 1, distributionId: "cortex-backend-v1-sdk-test", sdkVersion: "test", tables: ["runtimeRuns"], components: ["agent"], httpRoutes: [], dependencies: { convex: "^1.46.0", "@convex-dev/agent": "0.7.3" }, files: [...files].map(([name, text]) => ({ path: name, sha256: hash(text) })) });
});
afterEach(async () => { jest.restoreAllMocks(); await fs.remove(root); });
async function put(name: string, text: string) { await fs.outputFile(path.join(host, name), text); }
async function read(name: string) { return fs.readFile(path.join(host, name), "utf8"); }
const assetRouteNames = ["POST /cortex/assets/upload", "GET /cortex/assets/download", "OPTIONS /cortex/assets/upload", "OPTIONS /cortex/assets/download"];
const mediaRouteName = "POST /cortex/media/video/webhook";
function mediaHttpHelper(mediaImport = 'import { videoWebhook } from "../runtimeMediaHttp";', mediaRoute = 'router.route({method:"POST",path:"/cortex/media/video/webhook",handler:videoWebhook});') {
  return 'import type { HttpRouter } from "convex/server"; import { upload, download, preflight } from "../runtimeAssetsHttp";\n' + mediaImport
    + '\nexport function registerCortexHttpRoutesV1(router: HttpRouter) {\n' + assetRouteNames.map(key => {
      const [method, routePath] = key.split(" ");
      return `router.route({ method: ${JSON.stringify(method)}, path: ${JSON.stringify(routePath)}, handler: ${method === "OPTIONS" ? "preflight" : method === "POST" ? "upload" : "download"} });\n`;
    }).join("") + mediaRoute + "\n}\n";
}
async function addHttpDistribution(routeNames = assetRouteNames, helperText?: string) {
  const helper = helperText ?? 'import type { HttpRouter } from "convex/server"; import { upload, download, preflight } from "../runtimeAssetsHttp";\nexport function registerCortexHttpRoutesV1(router: HttpRouter) {\n' + assetRouteNames.map(key => {
    const [method, routePath] = key.split(" ");
    return `router.route({ method: ${JSON.stringify(method)}, path: ${JSON.stringify(routePath)}, handler: ${method === "OPTIONS" ? "preflight" : method === "POST" ? "upload" : "download"} });\n`;
  }).join("") + "}\n";
  await fs.outputFile(path.join(sdk, "dist/backend/v1/_cortex/http.ts"), helper);
  const manifest = await fs.readJson(path.join(sdk, "dist/backend/v1/manifest.json"));
  manifest.files.push({ path: "_cortex/http.ts", sha256: hash(helper) }); manifest.httpRoutes = routeNames;
  if (helper.includes("../runtimeMediaHttp")) {
    const media = 'import { httpActionGeneric } from "convex/server"; export const videoWebhook = httpActionGeneric(async () => new Response("webhook"));\n';
    await fs.outputFile(path.join(sdk, "dist/backend/v1/runtimeMediaHttp.ts"), media);
    manifest.files.push({ path: "runtimeMediaHttp.ts", sha256: hash(media) });
  }
  await fs.writeJson(path.join(sdk, "dist/backend/v1/manifest.json"), manifest);
}
/** Execute the installed composition against Convex's real router, without a deployment. */
async function installedHttpRouter(relative = "convex/http.ts"): Promise<HttpRouter> {
  const handler = httpActionGeneric(async () => new Response("fixture"));
  const evaluate = (text: string, required: (name: string) => unknown): Record<string, unknown> => {
    const output = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: Record<string, unknown> = {};
    new Function("require", "exports", output)(required, exports);
    return exports;
  };
  const helper = evaluate(await fs.readFile(path.join(sdk, "dist/backend/v1/_cortex/http.ts"), "utf8"), () => ({ upload: handler, download: handler, preflight: handler, videoWebhook: handler }));
  const exports = evaluate(await read(relative), name => name === "convex/server" ? { httpRouter, httpActionGeneric } : helper);
  return exports.default as HttpRouter;
}
describe("additive backend installation", () => {
  it("registers a fresh host with explicit verified JWT settings and keeps runtime directives", async () => {
    const result = await installAdditiveBackend(host, sdk, { trustedJwtProvider: provider });
    expect(result.installed).toHaveLength(9);
    expect(await fs.pathExists(path.join(host, "convex/_cortex/components.config.ts"))).toBe(true);
    expect(await fs.pathExists(path.join(host, "convex/_cortex/components.ts"))).toBe(false);
    expect(await read("convex/schema.ts")).toContain("...cortexTablesV1");
    expect(await read("convex/convex.config.ts")).toContain('import _cortex_component_agent from "@convex-dev/agent/convex.config";');
    expect(await read("convex/convex.config.ts")).toContain('app.use(_cortex_component_agent, { name: "agent" });');
    expect(await read("convex/convex.config.ts")).not.toContain("registerCortexComponentsV1");
    expect((await read("convex/runs.ts")).startsWith('"use node"')).toBe(true);
    expect(await read("convex/auth.config.ts")).toContain('"algorithm":"RS256"');
    expect(result.capabilities.authConfigured).toBe(true);
    expect(result.capabilities.execution).toBe("task07-required");
  });
  it("rejects an ordinary scanned component helper before host writes", async () => {
    const manifest = await fs.readJson(path.join(sdk, "dist/backend/v1/manifest.json"));
    const helper = manifest.files.find((entry: { path: string }) => entry.path === "_cortex/components.config.ts");
    await fs.rename(path.join(sdk, "dist/backend/v1", helper.path), path.join(sdk, "dist/backend/v1/_cortex/components.ts"));
    helper.path = "_cortex/components.ts";
    await fs.writeJson(path.join(sdk, "dist/backend/v1/manifest.json"), manifest);
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow("lacks additive schema/component helpers");
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it("preserves a custom directory, unrelated tables/indexes, schema options, functions, auth, HTTP and components", async () => {
    const config = '{ "functions": "services/backend/", "node": { "externalPackages": ["custom"] }, "codegen": { "staticApi": true } }\n';
    const table = 'tasks: defineTable({ title: v.string() }).index("by_title", ["title"])';
    const schema = `import { defineSchema, defineTable } from "convex/server"; import { v } from "convex/values";\nexport default defineSchema({ ${table} }, { schemaValidation: true });\n`;
    const components = 'import { defineApp } from "convex/server"; import custom from "custom/convex.config";\nconst backend = defineApp(); backend.use(custom, { name: "hostQueue" });\nexport default backend;\n';
    const http = "// unrelated route owner\nexport default hostHttp;\n";
    const auth = 'export default { providers: [{ domain: "https://host.example", applicationID: "host" }] };\n';
    await put("convex.json", config); await put("services/backend/schema.ts", schema); await put("services/backend/convex.config.ts", components);
    await put("services/backend/http.ts", http); await put("services/backend/auth.config.ts", auth); await put("services/backend/hostFunctions.ts", "export const host = 42;\n");
    await installAdditiveBackend(host, sdk, { trustedJwtProvider: provider });
    expect(await read("convex.json")).toBe(config);
    expect(await read("services/backend/schema.ts")).toContain(table);
    expect(await read("services/backend/schema.ts")).toContain("{ schemaValidation: true }");
    expect(await read("services/backend/convex.config.ts")).toContain('backend.use(custom, { name: "hostQueue" })');
    expect(await read("services/backend/convex.config.ts")).toContain('backend.use(_cortex_component_agent, { name: "agent" });');
    expect(await read("services/backend/auth.config.ts")).toContain('domain: "https://host.example"');
    expect(await read("services/backend/http.ts")).toBe(http);
    expect(await read("services/backend/hostFunctions.ts")).toBe("export const host = 42;\n");
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it("retries a complete installation without writes, duplicate schema spreads or duplicate providers", async () => {
    await installAdditiveBackend(host, sdk, { trustedJwtProvider: provider });
    const result = await installAdditiveBackend(host, sdk, { trustedJwtProvider: provider });
    expect(result.installed).toEqual([]);
    expect((await read("convex/schema.ts")).match(/\.\.\.cortexTablesV1/g)).toHaveLength(1);
    expect((await read("convex/auth.config.ts")).match(/https:\/\/issuer.example\/jwks/g)).toHaveLength(1);
    expect((await read("convex/convex.config.ts")).match(/app\.use\(_cortex_component_agent/g)).toHaveLength(1);
  });
  it("imports every declared component directly from the root config, including Workflow", async () => {
    const fragment = 'import type { AppDefinition } from "convex/server"; import agent from "@convex-dev/agent/convex.config"; import workflow from "@convex-dev/workflow/convex.config";\nexport function registerCortexComponentsV1(app: AppDefinition) { app.use(agent, { name: "agent" }); app.use(workflow, { name: "workflow" }); }\n';
    await fs.writeFile(path.join(sdk, "dist/backend/v1/_cortex/components.config.ts"), fragment);
    const manifest = await fs.readJson(path.join(sdk, "dist/backend/v1/manifest.json"));
    manifest.components.push("workflow");
    manifest.files.find((entry: { path: string }) => entry.path === "_cortex/components.config.ts").sha256 = hash(fragment);
    await fs.writeJson(path.join(sdk, "dist/backend/v1/manifest.json"), manifest);
    await installAdditiveBackend(host, sdk);
    const config = await read("convex/convex.config.ts");
    const ast = ts.createSourceFile("convex.config.ts", config, ts.ScriptTarget.Latest, true);
    const directConfigImports = ast.statements.filter(ts.isImportDeclaration).map(node => (node.moduleSpecifier as ts.StringLiteral).text).filter(specifier => specifier.includes(".config"));
    expect(directConfigImports).toEqual(["@convex-dev/agent/convex.config", "@convex-dev/workflow/convex.config"]);
    expect(config).toContain('app.use(_cortex_component_workflow, { name: "workflow" });');
    expect(config).not.toContain("./_cortex/components");
    expect((await installAdditiveBackend(host, sdk)).installed).toEqual([]);
  });
  it.each([
    ['import { defineApp } from "convex/server"; import { registerCortexComponentsV1 } from "./_cortex/components"; const app = defineApp(); registerCortexComponentsV1(app); export default app;', "Indirect Cortex"],
    ['import { defineApp } from "convex/server"; const _cortex_component_agent = "host"; const app = defineApp(); export default app;', "Host binding"],
    ['import { defineApp } from "convex/server"; import _cortex_component_agent from "@convex-dev/agent/convex.config"; const app = defineApp(); function defer() { app.use(_cortex_component_agent, { name: "agent" }); } export default app;', "top level"],
    ['import { defineApp } from "convex/server"; import _cortex_component_agent from "@convex-dev/agent/convex.config"; const app = defineApp(); app.use(_cortex_component_agent, { name: "agent", name: "host" }); export default app;', "Host component"],
  ])("preserves an ambiguous component configuration and emits a concrete merge proposal", async (config, reason) => {
    await put("convex/convex.config.ts", config);
    const plan = await planAdditiveBackendInstallation(host, sdk);
    expect(plan.conflicts).toContainEqual(expect.objectContaining({ path: "convex/convex.config.ts", reason: expect.stringContaining(reason), currentContent: config }));
    await expect(applyAdditiveBackendInstallation(plan)).rejects.toBeInstanceOf(BackendMergeRequiredError);
    expect(await read("convex/convex.config.ts")).toBe(config);
    expect(await fs.pathExists(path.join(host, "convex/runs.ts"))).toBe(false);
  });
  it("an atomic schema-write failure retains the original host schema and supports partial retry", async () => {
    const original = 'import { defineSchema, defineTable } from "convex/server"; export default defineSchema({ hostTasks: defineTable({}) });';
    await put("convex/schema.ts", original);
    const write = fs.writeFile.bind(fs);
    const failure = jest.spyOn(fs, "writeFile").mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
      if (String(args[0]).includes("schema.ts.cortex-v1-") && String(args[0]).endsWith(".tmp")) throw Object.assign(new Error("injected write failure"), { code: "EIO" });
      return write(...args);
    });
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow("injected write failure");
    expect(await read("convex/schema.ts")).toBe(original);
    expect((await fs.readdir(path.join(host, "convex"))).some((entry) => entry.endsWith(".tmp"))).toBe(false);
    failure.mockRestore();
    const retry = await installAdditiveBackend(host, sdk);
    expect(retry.unchanged.length).toBeGreaterThan(0);
    expect(await read("convex/schema.ts")).toContain("hostTasks: defineTable({})");
    expect(await read("convex/schema.ts")).toContain("...cortexTablesV1");
  });
  it("recovers an interrupted per-file install by replanning identical completed files", async () => {
    const plan = await planAdditiveBackendInstallation(host, sdk);
    await applyAdditiveBackendInstallation({ ...plan, changes: plan.changes.slice(0, 2) });
    const result = await installAdditiveBackend(host, sdk);
    expect(result.unchanged).toHaveLength(2);
    expect(result.installed).toHaveLength(6);
  });
  it.each([
    ["schema.ts", 'import { defineSchema, defineTable } from "convex/server"; export default defineSchema({ runtimeRuns: defineTable({}) });', "Host table"],
    ["schema.ts", 'import { defineSchema } from "convex/server"; export default defineSchema({ ...customTables });', "unrecognized schema spread"],
    ["schema.ts", 'export default makeHostSchema();', "explicit default defineSchema"],
    ["convex.config.ts", 'import { defineApp } from "convex/server"; const app = defineApp(); app.use(host, { name: "agent" }); export default app;', "Host component"],
    ["convex.config.ts", 'import { defineApp } from "convex/server"; const app = defineApp(); app.use(host); export default app;', "implicit or dynamic name"],
    ["convex.config.ts", 'export default buildCustomApp();', "named defineApp"],
    ["runs.ts", 'export const hostRun = "do not replace";', "Existing file differs"],
  ])("refuses %s conflicts before product writes and publishes a precise merge proposal", async (name, content, reason) => {
    await put("convex/" + name, content);
    const plan = await planAdditiveBackendInstallation(host, sdk);
    expect(plan.conflicts.some((conflict) => conflict.reason.includes(reason))).toBe(true);
    await expect(applyAdditiveBackendInstallation(plan)).rejects.toBeInstanceOf(BackendMergeRequiredError);
    expect(await read("convex/" + name)).toBe(content);
    const proposalFile = (await fs.readdir(host)).find((entry) => entry.startsWith("cortex-backend-merge-proposal-") && entry.endsWith(".json"))!;
    const proposal = await fs.readJson(path.join(host, proposalFile));
    expect(proposal.conflicts.some((entry: { path: string; proposedContent: string }) => entry.path === "convex/" + name && entry.proposedContent)).toBe(true);
    expect(await fs.pathExists(path.join(host, "convex/_cortex/schema.ts"))).toBe(false);
  });
  it("preserves existing provider configuration on conflicting issuer settings", async () => {
    const auth = 'export default { providers: [{ type: "customJwt", issuer: "https://issuer.example", jwks: "https://different.example/keys", algorithm: "RS256" }] };';
    await put("convex/auth.config.ts", auth);
    await expect(installAdditiveBackend(host, sdk, { trustedJwtProvider: provider })).rejects.toBeInstanceOf(BackendMergeRequiredError);
    expect(await read("convex/auth.config.ts")).toBe(auth);
  });
  it("detects a host edit after planning before any installation writes", async () => {
    const plan = await planAdditiveBackendInstallation(host, sdk);
    await put("convex/schema.ts", "// host edit after planning\n");
    await expect(applyAdditiveBackendInstallation(plan)).rejects.toThrow("changed after installation planning");
    expect(await fs.pathExists(path.join(host, "convex/runs.ts"))).toBe(false);
  });
  it("refuses out-of-project custom directories and symbolic links", async () => {
    await put("convex.json", '{"functions":"../foreign"}');
    await expect(planAdditiveBackendInstallation(host, sdk)).rejects.toThrow("inside the explicit host");
    await put("convex.json", '{"functions":"functions/"}');
    await fs.ensureDir(path.join(root, "foreign")); await fs.symlink(path.join(root, "foreign"), path.join(host, "functions"));
    await expect(planAdditiveBackendInstallation(host, sdk)).rejects.toThrow("symbolic-link destination");
  });
  it("refuses tampered distribution sources before product writes", async () => {
    await fs.writeFile(path.join(sdk, "dist/backend/v1/runs.ts"), "tampered");
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow("digest mismatch");
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it("supports official inline public JWKS while retaining the explicit audience", async () => {
    const jwks = "data:text/plain;charset=utf-8;base64," + Buffer.from(JSON.stringify({ keys: [{ kid: "public-test", kty: "RSA", n: "public-modulus", e: "AQAB", alg: "RS256" }] })).toString("base64");
    const result = await installAdditiveBackend(host, sdk, { trustedJwtProvider: { ...provider, jwks } });
    expect(result.capabilities.authConfigured).toBe(true);
    expect(await read("convex/auth.config.ts")).toContain('"applicationID":"cortex"');
    expect(await read("convex/auth.config.ts")).toContain(jwks);
  });
  it("rejects private material in inline JWKS before any installation writes", async () => {
    const jwks = "data:application/json;base64," + Buffer.from(JSON.stringify({ keys: [{ kid: "private-test", kty: "RSA", n: "modulus", e: "AQAB", d: "private-material" }] })).toString("base64");
    await expect(installAdditiveBackend(host, sdk, { trustedJwtProvider: { ...provider, jwks } })).rejects.toThrow("without private key material");
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it("requires an explicit application audience for a new Cortex provider", async () => {
    await expect(installAdditiveBackend(host, sdk, { trustedJwtProvider: { ...provider, applicationID: "" } })).rejects.toThrow("explicit JWT application audience");
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it("reports absent auth as incomplete capability rather than installing permissive auth", async () => {
    const result = await installAdditiveBackend(host, sdk);
    expect(result.capabilities.authConfigured).toBe(false);
    expect(await fs.pathExists(path.join(host, "convex/auth.config.ts"))).toBe(false);
  });
  it("createConvexJson preserves existing custom configuration byte-for-byte", async () => {
    const value = '{ "functions": "custom/", "node": { "externalPackages": ["host"] } }\n';
    await put("convex.json", value); await createConvexJson(host);
    expect(await read("convex.json")).toBe(value);
  });
});
describe("additive authenticated HTTP routes", () => {
  it("installs a fresh real Convex router and retries without duplicate routes or writes", async () => {
    await addHttpDistribution();
    const first = await installAdditiveBackend(host, sdk);
    expect(first.installed).toContain("convex/http.ts");
    const router = await installedHttpRouter();
    expect(router.getRoutes().map(([routePath, method]) => `${method} ${routePath}`).sort()).toEqual([...assetRouteNames].sort());
    const original = await read("convex/http.ts");
    expect((await installAdditiveBackend(host, sdk)).installed).toEqual([]);
    expect(await read("convex/http.ts")).toBe(original);
  });
  it("preserves custom host HTTP handlers and permits a different method on the same path", async () => {
    await addHttpDistribution();
    await put("convex.json", '{"functions":"custom/backend/"}\n');
    const original = 'import { httpRouter as makeRouter, httpActionGeneric } from "convex/server";\nconst hostHttp = makeRouter();\n// host route and handler remain owned by the host\nhostHttp.route({ path: "/host-health", method: "GET", handler: httpActionGeneric(async () => new Response("host-preserved")) });\nhostHttp.route({ path: "/cortex/assets/download", method: "POST", handler: httpActionGeneric(async () => new Response("host-post")) });\nexport default hostHttp;\n';
    await put("custom/backend/http.ts", original);
    const plan = await planAdditiveBackendInstallation(host, sdk);
    expect(plan.conflicts).toEqual([]);
    await applyAdditiveBackendInstallation(plan);
    const installed = await read("custom/backend/http.ts");
    expect(installed.replace('import { registerCortexHttpRoutesV1 } from "./_cortex/http";\n', "").replace("registerCortexHttpRoutesV1(hostHttp);\n", "")).toBe(original);
    expect(await read(`custom/backend/http.ts.cortex-v1-before-${hash(original)}.txt`)).toBe(original);
    const router = await installedHttpRouter("custom/backend/http.ts");
    expect(router.getRoutes().map(([routePath, method]) => `${method} ${routePath}`).sort()).toEqual([...assetRouteNames, "GET /host-health", "POST /cortex/assets/download"].sort());
    expect((await installAdditiveBackend(host, sdk)).installed).toEqual([]);
  });
  it.each([
    ['http.route({ path: "/cortex/assets/download", method: "GET", handler: host });', "conflicts"],
    ['http.route({ pathPrefix: "/cortex/", method: "GET", handler: host });', "conflicts"],
    ['http.route({ pathPrefix: "/", method: "OPTIONS", handler: host });', "conflicts"],
    ['http.route({ path: hostPath, method: "GET", handler: host });', "literal"],
    ['http.route({ path: "/host", method: hostMethod, handler: host });', "literal"],
    ['http.route({ ...hostRoute });', "Dynamic"],
    ['const alias = http; alias.route({ path: "/host", method: "GET", handler: host });', "Aliased"],
    ['auth.addHttpRoutes(http);', "Aliased"],
    ['if (enabled) http.route({ path: "/host", method: "GET", handler: host });', "Nested"],
    ['const registerCortexHttpRoutesV1 = () => {};', "Host binding"],
  ])("refuses ambiguous or overlapping host HTTP before any installation write", async (route, reason) => {
    await addHttpDistribution();
    const original = `import { httpRouter } from "convex/server"; const http = httpRouter(); ${route}\nexport default http;\n`;
    await put("convex/http.ts", original);
    const plan = await planAdditiveBackendInstallation(host, sdk);
    expect(plan.conflicts).toContainEqual(expect.objectContaining({ path: "convex/http.ts", reason: expect.stringContaining(reason), currentContent: original }));
    await expect(applyAdditiveBackendInstallation(plan)).rejects.toBeInstanceOf(BackendMergeRequiredError);
    expect(await read("convex/http.ts")).toBe(original);
    expect(await fs.pathExists(path.join(host, "convex/_cortex/http.ts"))).toBe(false);
    expect(await fs.pathExists(path.join(host, "convex/runs.ts"))).toBe(false);
  });
  it.each([
    'import { registerCortexHttpRoutesV1 } from "./foreign"; registerCortexHttpRoutesV1(http);',
    'import { registerCortexHttpRoutesV1 } from "./_cortex/http"; registerCortexHttpRoutesV1(http); registerCortexHttpRoutesV1(http);',
    'import { registerCortexHttpRoutesV1 } from "./_cortex/http"; function later() { registerCortexHttpRoutesV1(http); }',
  ])("rejects wrong, duplicate or deferred managed registration without adopting it", async registration => {
    await addHttpDistribution();
    const original = `import { httpRouter } from "convex/server"; const http = httpRouter();\n${registration}\nexport default http;\n`;
    await put("convex/http.ts", original);
    await expect(installAdditiveBackend(host, sdk)).rejects.toBeInstanceOf(BackendMergeRequiredError);
    expect(await read("convex/http.ts")).toBe(original);
  });
  it.each([
    [assetRouteNames.slice(1), undefined],
    [[], undefined],
    [[...assetRouteNames, assetRouteNames[0]], undefined],
    [assetRouteNames, 'export function registerCortexHttpRoutesV1(router: unknown) { registerDynamic(router); }'],
  ])("requires the digest-checked static helper to match every manifest route before writes", async (names, helper) => {
    await addHttpDistribution(names, helper);
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow(/HTTP/);
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it("rejects computed helper handlers instead of executing arbitrary router mutations", async () => {
    const helper = 'export function registerCortexHttpRoutesV1(router: unknown) { router.route({path:"/cortex/assets/upload",method:"POST",handler:mutate(router)}); }';
    await addHttpDistribution([assetRouteNames[0]], helper);
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow("direct static runtimeAssetsHttp imports");
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it("retains host HTTP after atomic write failure and recovers a partial install once", async () => {
    await addHttpDistribution();
    const original = 'import { httpRouter } from "convex/server"; const http = httpRouter(); export default http;\n';
    await put("convex/http.ts", original);
    const write = fs.writeFile.bind(fs);
    const failure = jest.spyOn(fs, "writeFile").mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
      if (String(args[0]).includes("http.ts.cortex-v1-") && String(args[0]).endsWith(".tmp")) throw new Error("injected HTTP write failure");
      return write(...args);
    });
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow("injected HTTP write failure");
    expect(await read("convex/http.ts")).toBe(original);
    expect((await fs.readdir(path.join(host, "convex"))).some(name => name.endsWith(".tmp"))).toBe(false);
    failure.mockRestore();
    const retry = await installAdditiveBackend(host, sdk);
    expect(retry.unchanged).toContain("convex/_cortex/http.ts");
    expect(retry.installed).toContain("convex/http.ts");
    expect((await installedHttpRouter()).getRoutes()).toHaveLength(4);
    expect((await installAdditiveBackend(host, sdk)).installed).toEqual([]);
  });
  it("checks the host HTTP preimage before installing any source", async () => {
    await addHttpDistribution();
    await put("convex/http.ts", 'import { httpRouter } from "convex/server"; const http = httpRouter(); export default http;');
    const plan = await planAdditiveBackendInstallation(host, sdk);
    await put("convex/http.ts", "// changed by host after planning\n");
    await expect(applyAdditiveBackendInstallation(plan)).rejects.toThrow("changed after installation planning");
    expect(await fs.pathExists(path.join(host, "convex/_cortex/http.ts"))).toBe(false);
    expect(await read("convex/http.ts")).toBe("// changed by host after planning\n");
  });
});

describe("additive fixed media webhook", () => {
  it("composes all five real router registrations while preserving a custom host and zero-write retry", async () => {
    await addHttpDistribution([...assetRouteNames, mediaRouteName], mediaHttpHelper());
    await put("convex.json", '{"functions":"custom/backend/"}\n');
    const original = 'import { httpRouter, httpActionGeneric } from "convex/server";\nconst host = httpRouter();\nhost.route({path:"/host-health",method:"GET",handler:httpActionGeneric(async () => new Response("host"))});\nexport default host;\n';
    await put("custom/backend/http.ts", original);
    await put("custom/backend/hostNode.ts", '"use node";\nexport const sentinel = 42;\n');
    const plan = await planAdditiveBackendInstallation(host, sdk);
    expect(plan.conflicts).toEqual([]);
    await applyAdditiveBackendInstallation(plan);
    const installed = await read("custom/backend/http.ts");
    expect(installed.replace('import { registerCortexHttpRoutesV1 } from "./_cortex/http";\n', "").replace("registerCortexHttpRoutesV1(host);\n", "")).toBe(original);
    expect(await read(`custom/backend/http.ts.cortex-v1-before-${hash(original)}.txt`)).toBe(original);
    expect(await read("custom/backend/hostNode.ts")).toBe('"use node";\nexport const sentinel = 42;\n');
    const router = await installedHttpRouter("custom/backend/http.ts");
    expect(router.getRoutes().map(([routePath, method]) => `${method} ${routePath}`).sort()).toEqual([...assetRouteNames, mediaRouteName, "GET /host-health"].sort());
    expect((await installAdditiveBackend(host, sdk)).installed).toEqual([]);
    expect(await read("custom/backend/http.ts")).toBe(installed);
  });
  it("accepts a direct named alias of only the fixed webhook export", async () => {
    await addHttpDistribution([...assetRouteNames, mediaRouteName], mediaHttpHelper('import { videoWebhook as callback } from "../runtimeMediaHttp.js";', 'router.route({method:"POST",path:"/cortex/media/video/webhook",handler:callback});'));
    await installAdditiveBackend(host, sdk);
    expect((await installedHttpRouter()).getRoutes()).toHaveLength(5);
  });
  it.each([
    'import { arbitrary as videoWebhook } from "../runtimeMediaHttp";',
    'import videoWebhook from "../runtimeMediaHttp";',
    'import * as videoWebhook from "../runtimeMediaHttp";',
    'import { videoWebhook } from "../foreign";',
  ])("rejects an unqualified media import before any host write: %s", async mediaImport => {
    await addHttpDistribution([...assetRouteNames, mediaRouteName], mediaHttpHelper(mediaImport));
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow(/runtimeMediaHttp|videoWebhook/);
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it.each([
    ["GET /cortex/media/video/webhook", 'router.route({method:"GET",path:"/cortex/media/video/webhook",handler:videoWebhook});'],
    ["POST /cortex/arbitrary", 'router.route({method:"POST",path:"/cortex/arbitrary",handler:videoWebhook});'],
    [mediaRouteName, 'router.route({method:"POST",path:"/cortex/media/video/webhook",handler:upload});'],
  ])("binds the new handler exclusively to its fixed route: %s", async (routeName, declaration) => {
    await addHttpDistribution([...assetRouteNames, routeName], mediaHttpHelper(undefined, declaration));
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow("only the exact POST /cortex/media/video/webhook");
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it("rejects overlapping local bindings from the asset and media modules", async () => {
    await addHttpDistribution([...assetRouteNames, mediaRouteName], mediaHttpHelper('import { videoWebhook as upload } from "../runtimeMediaHttp";', 'router.route({method:"POST",path:"/cortex/media/video/webhook",handler:upload});'));
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow("must not overlap");
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it.each([
    'http.route({path:"/cortex/media/video/webhook",method:"POST",handler:host});',
    'http.route({pathPrefix:"/cortex/media/",method:"POST",handler:host});',
  ])("preserves a conflicting host exact or prefix route before all source writes", async declaration => {
    await addHttpDistribution([...assetRouteNames, mediaRouteName], mediaHttpHelper());
    const original = `import { httpRouter } from "convex/server"; const http = httpRouter(); ${declaration}\nexport default http;\n`;
    await put("convex/http.ts", original);
    const plan = await planAdditiveBackendInstallation(host, sdk);
    expect(plan.conflicts).toContainEqual(expect.objectContaining({ path: "convex/http.ts", currentContent: original, reason: expect.stringContaining("conflicts") }));
    await expect(applyAdditiveBackendInstallation(plan)).rejects.toBeInstanceOf(BackendMergeRequiredError);
    expect(await read("convex/http.ts")).toBe(original);
    expect(await fs.pathExists(path.join(host, "convex/_cortex/http.ts"))).toBe(false);
    expect(await fs.pathExists(path.join(host, "convex/runs.ts"))).toBe(false);
  });
  it("rejects a manifest omitting the fifth helper route before installation", async () => {
    await addHttpDistribution(assetRouteNames, mediaHttpHelper());
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow("differ from the versioned manifest");
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it("rejects a webhook module missing from the digest-bound source manifest", async () => {
    await addHttpDistribution([...assetRouteNames, mediaRouteName], mediaHttpHelper());
    const manifest = await fs.readJson(path.join(sdk, "dist/backend/v1/manifest.json"));
    manifest.files = manifest.files.filter((entry: { path: string }) => entry.path !== "runtimeMediaHttp.ts");
    await fs.writeJson(path.join(sdk, "dist/backend/v1/manifest.json"), manifest);
    await expect(installAdditiveBackend(host, sdk)).rejects.toThrow("digest-bound runtimeMediaHttp.ts source");
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
});

describe("generated Convex module layout", () => {
  async function buildFixture(entry: string, shared: Record<string, string>) {
    const source = path.join(root, "generator-source");
    await fs.outputJson(path.join(source, "package.json"), { version: "test", peerDependencies: { convex: "^1.46.0" }, dependencies: { "@convex-dev/agent": "0.7.3" }, devDependencies: { "@types/node": "^26.6.4" } });
    await fs.outputFile(path.join(source, "convex-dev/schema.ts"), 'import { defineSchema, defineTable } from "convex/server"; export default defineSchema({ runtimeRuns: defineTable({}) });\n');
    await fs.outputFile(path.join(source, "convex-dev/convex.config.ts"), 'import { defineApp } from "convex/server"; import agent from "@convex-dev/agent/convex.config"; const app = defineApp(); app.use(agent, { name: "agent" }); export default app;\n');
    await fs.outputFile(path.join(source, "convex-dev/runs.ts"), entry);
    for (const [name, text] of Object.entries(shared)) await fs.outputFile(path.join(source, name), text);
    return { source, output: path.join(sdk, "dist/backend/v1") };
  }
  async function build(source: string, output: string) {
    // Invoke the real generator with explicit fixture roots; importing it must not build the checkout.
    return execute(process.execPath, ["--input-type=module", "--eval", `import { buildBackendDistribution } from ${JSON.stringify(pathToFileURL(builder).href)}; await buildBackendDistribution(${JSON.stringify({ sourceRoot: source, outputRoot: output })});`], { timeout: 20_000, maxBuffer: 262_144 });
  }
  it("pins the required Node declarations to the existing SDK declaration base version", async () => {
    const { source, output } = await buildFixture('export const value = process.version;\n', {});
    await build(source, output);
    expect((await fs.readJson(path.join(output, "manifest.json"))).dependencies["@types/node"]).toBe("26.6.4");
  });
  it.each([null, "*", ">=26.6.4"])("refuses a missing or ambiguous Node declaration before replacing the previous distribution: %s", async (declaration) => {
    const { source, output } = await buildFixture('export const value = process.version;\n', {});
    await build(source, output);
    const previous = await fs.readFile(path.join(output, "manifest.json"));
    const pkg = await fs.readJson(path.join(source, "package.json"));
    if (declaration === null) delete pkg.devDependencies["@types/node"];
    else pkg.devDependencies["@types/node"] = declaration;
    await fs.writeJson(path.join(source, "package.json"), pkg);
    await expect(build(source, output)).rejects.toThrow("Backend distribution requires a deterministic SDK @types/node declaration");
    expect(await fs.readFile(path.join(output, "manifest.json"))).toEqual(previous);
  });
  it("installs valid shared paths with working rewritten imports, original provenance and unchanged public/host bindings", async () => {
    const entry = '"use node";\nimport type { QueryCtx } from "./_generated/server";\nimport { base } from "../src/domain/model-policy.js";\nimport { increment } from "../src/type space/with-á.js";\nexport { base } from "../src/domain/model-policy.js";\nexport type Witness = import("../src/domain/model-policy.js").Witness;\nexport const answer = () => increment(base);\nexport const load = () => import("../src/domain/model-policy.js");\n';
    const shared = { "src/domain/model-policy.ts": 'export const base = 41; export type Witness = { exact: true };\n',
      "src/type space/with-á.ts": 'import { base } from "../domain/model-policy.js"; export const increment = (value: number) => value + (base === 41 ? 1 : 0);\n' };
    const { source, output } = await buildFixture(entry, shared);
    await build(source, output);
    const manifest = await fs.readJson(path.join(output, "manifest.json")) as { files: { path: string; sha256: string; sourcePath: string; sourceSha256: string }[] };
    expect(manifest.files.map(file => file.path)).toEqual(["_cortex/components.config.ts", "_cortex/schema.ts", "_cortex/shared/domain/model_policy.ts", "_cortex/shared/type_space/with__.ts", "runs.ts"]);
    const compiled = path.join(root, "compiled");
    for (const file of manifest.files) {
      expect(file.path.split("/").every(piece => /^[A-Za-z0-9_.]+$/.test(piece))).toBe(true);
      const generated = await fs.readFile(path.join(output, file.path), "utf8");
      expect(file.sha256).toBe(hash(generated));
      expect(file.sourceSha256).toBe(hash(await fs.readFile(path.join(source, file.sourcePath), "utf8")));
      const ast = ts.createSourceFile(file.path, generated, ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node) => {
        const literal = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
          : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal
          : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
        if (literal && ts.isStringLiteral(literal) && literal.text.startsWith(".") && !literal.text.startsWith("./_generated/")) {
          expect(manifest.files.some(target => target.path === path.posix.normalize(path.posix.join(path.posix.dirname(file.path), literal.text)) + ".ts")).toBe(true);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
      await fs.outputFile(path.join(compiled, file.path.replace(/\.ts$/, ".js")), ts.transpileModule(generated, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText);
    }
    const generatedEntry = await fs.readFile(path.join(output, "runs.ts"), "utf8");
    expect(generatedEntry.startsWith('"use node";')).toBe(true);
    expect(generatedEntry).toContain('from "./_generated/server"');
    expect(generatedEntry).toContain('import("./_cortex/shared/domain/model_policy")');
    const executed = await execute(process.execPath, ["--eval", `const run = require(${JSON.stringify(path.join(compiled, "runs.js"))}); run.load().then(value => console.log(JSON.stringify({ answer: run.answer(), loaded: value.base })));`], { timeout: 10_000, maxBuffer: 262_144 });
    expect(JSON.parse(executed.stdout)).toEqual({ answer: 42, loaded: 41 });
    await put("convex.json", '{"functions":"services/backend/"}\n');
    await installAdditiveBackend(host, sdk, { trustedJwtProvider: provider });
    expect(await read("services/backend/runs.ts")).toBe(generatedEntry);
    expect(await read("services/backend/_cortex/shared/domain/model_policy.ts")).toBe(shared["src/domain/model-policy.ts"]);
    expect(await fs.pathExists(path.join(host, "services/backend/_cortex/shared/domain/model-policy.ts"))).toBe(false);
    expect(await read("convex.json")).toBe('{"functions":"services/backend/"}\n');
  });
  it.each([
    ["file", "src/domain/model-policy.ts", "src/domain/model_policy.ts"],
    ["directory", "src/unit-tests/first.ts", "src/unit_tests/second.ts"],
  ])("rejects a %s normalization collision before replacing any previous distribution", async (_kind, first, second) => {
    const entry = `import { one } from ${JSON.stringify("../" + first.replace(/\.ts$/, ".js"))}; import { two } from ${JSON.stringify("../" + second.replace(/\.ts$/, ".js"))}; export const answer = one + two;\n`;
    const { source, output } = await buildFixture(entry, { [first]: "export const one = 1;\n", [second]: "export const two = 2;\n" });
    const previous = await fs.readFile(path.join(output, "manifest.json"), "utf8");
    const oldRun = await fs.readFile(path.join(output, "runs.ts"), "utf8");
    await expect(build(source, output)).rejects.toThrow("normalization collision");
    expect(await fs.readFile(path.join(output, "manifest.json"), "utf8")).toBe(previous);
    expect(await fs.readFile(path.join(output, "runs.ts"), "utf8")).toBe(oldRun);
    expect(await fs.pathExists(path.join(output, "_cortex/shared/domain/model_policy.ts"))).toBe(false);
  });
});

describe("prospective app-private schema composition", () => {
  it("plans without creating an absent destination and composes private app tables without changing registrations", async () => {
    await fs.remove(host);
    const app = 'import { defineSchema, defineTable } from "convex/server"; export default defineSchema({ appMessages: defineTable({}) });\n';
    const schema = 'import { defineSchema } from "convex/server"; import appSchema from "./app.schema"; export default defineSchema({ ...appSchema.tables }, { schemaValidation: true });\n';
    const prospective = new Map([["convex/schema.ts", Buffer.from(schema)], ["convex/app.schema.ts", Buffer.from(app)], ["convex/sdk.registration.ts", Buffer.from('export { internalQuery as query } from "./_generated/server";\n')]]);
    const plan = await planAdditiveBackendInstallation(host, sdk, { prospectiveFiles: prospective });
    expect(plan.conflicts).toEqual([]); expect(await fs.pathExists(host)).toBe(false);
    expect(plan.changes.find(item => item.path === "convex/schema.ts")?.content).toContain("...appSchema.tables");
    expect(plan.changes.find(item => item.path === "convex/schema.ts")?.content).toContain("...cortexTablesV1");
    expect(plan.changes.some(item => item.path === "convex/sdk.registration.ts")).toBe(false);
    for (const [name, bytes] of prospective) await fs.outputFile(path.join(host, name), bytes);
    await applyAdditiveBackendInstallation(plan);
    expect(await read("convex/app.schema.ts")).toBe(app);
    expect(await read("convex/sdk.registration.ts")).toContain("internalQuery as query");
    expect((await planAdditiveBackendInstallation(host, sdk)).changes).toEqual([]);
  });
  it("rejects a hidden private-app collision and dynamic spread before any installation", async () => {
    await put("convex/schema.ts", 'import { defineSchema } from "convex/server"; import appSchema from "./app.schema"; export default defineSchema({ ...appSchema.tables });');
    await put("convex/app.schema.ts", 'import { defineSchema, defineTable } from "convex/server"; export default defineSchema({ runtimeRuns: defineTable({}) });');
    const plan = await planAdditiveBackendInstallation(host, sdk); expect(plan.conflicts[0].reason).toContain("Host app table conflicts");
    await expect(applyAdditiveBackendInstallation(plan)).rejects.toBeInstanceOf(BackendMergeRequiredError);
    expect(await fs.pathExists(path.join(host,"convex/runs.ts"))).toBe(false);
    await put("convex/app.schema.ts", 'export default defineSchema({ ...unknownTables });');
    await expect(planAdditiveBackendInstallation(host,sdk)).rejects.toThrow("Dynamic app schema");
  });
});
