import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { applyAdditiveBackendInstallation, BackendMergeRequiredError, installAdditiveBackend, planAdditiveBackendInstallation } from "../init/additive-backend.js";
import { createConvexJson } from "../init/file-operations.js";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const provider = { type: "customJwt" as const, issuer: "https://issuer.example", jwks: "https://issuer.example/jwks", algorithm: "RS256" as const, applicationID: "cortex" };
let root: string;
let sdk: string;
let host: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-additive-test-"));
  sdk = path.join(root, "sdk"); host = path.join(root, "host");
  const files = new Map([
    ["_cortex/schema.ts", 'import { defineTable } from "convex/server"; export const cortexTablesV1 = { runtimeRuns: defineTable({}) };\n'],
    ["_cortex/components.ts", 'export function registerCortexComponentsV1(app: unknown) { void app; }\n'],
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
describe("additive backend installation", () => {
  it("registers a fresh host with explicit verified JWT settings and keeps runtime directives", async () => {
    const result = await installAdditiveBackend(host, sdk, { trustedJwtProvider: provider });
    expect(result.installed).toHaveLength(8);
    expect(await read("convex/schema.ts")).toContain("...cortexTablesV1");
    expect(await read("convex/convex.config.ts")).toContain("registerCortexComponentsV1(app)");
    expect((await read("convex/runs.ts")).startsWith('"use node"')).toBe(true);
    expect(await read("convex/auth.config.ts")).toContain('"algorithm":"RS256"');
    expect(result.capabilities.authConfigured).toBe(true);
    expect(result.capabilities.execution).toBe("task07-required");
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
    expect(await read("services/backend/convex.config.ts")).toContain("registerCortexComponentsV1(backend)");
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
    expect(result.installed).toHaveLength(5);
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
