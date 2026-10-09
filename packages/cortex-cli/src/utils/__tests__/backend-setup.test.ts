import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Command } from "commander";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { registerBackendCommands } from "../../commands/backend.js";
import { appendRuntimeEnvironment, parseDevelopmentPrincipal, parseDevelopmentTarget, parseJwtProvider, runDevelopmentSetup, setupBackend } from "../init/backend-setup.js";
import { addQuickstartScript, createQuickstartEnv, installVercelAIQuickstart, prepareVercelAIQuickstart } from "../init/quickstart-setup.js";
import { createEnvFile, generateEnvFile } from "../init/env-generator.js";
import { developmentStartEnvironment } from "../init/start-target.js";
import type { WizardConfig } from "../init/types.js";

let root: string, sdk: string, host: string;
const provider = { type: "customJwt" as const, issuer: "https://issuer.example", jwks: "https://issuer.example/jwks", algorithm: "RS256" as const, applicationID: "cortex" };
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-backend-setup-")); sdk = path.join(root, "sdk"); host = path.join(root, "host"); await fs.ensureDir(host);
  const files = new Map([
    ["_cortex/schema.ts", 'export const cortexTablesV1 = { runtimeRuns: {} };'],
    ["_cortex/components.config.ts", 'import agent from "@convex-dev/agent/convex.config"; import workflow from "@convex-dev/workflow/convex.config"; export function registerCortexComponentsV1(app) { app.use(agent, {name:"agent"}); app.use(workflow, {name:"workflow"}); }'],
    ["runs.ts", 'export const qualifiedRun = true;'],
  ]);
  for (const [name, content] of files) await fs.outputFile(path.join(sdk, "dist/backend/v1", name), content);
  await fs.outputJson(path.join(sdk, "dist/backend/v1/manifest.json"), { formatVersion: 1, distributionId: "fixture", sdkVersion: "fixture", tables: ["runtimeRuns"], components: ["agent", "workflow"], httpRoutes: [], dependencies: { convex: "^1.46.0", "@convex-dev/agent": "0.7.3", "@convex-dev/workflow": "0.4.8" }, files: [...files].map(([name, content]) => ({ path: name, sha256: createHash("sha256").update(content).digest("hex") })) });
});
afterEach(async () => { jest.restoreAllMocks(); await fs.remove(root); });
describe("modern additive setup", () => {
  it("real plan/install retains custom host functions, schema, config, auth, HTTP, env and scripts", async () => {
    const preserved: Record<string, string> = { "convex.json": '{"functions":"custom/backend/","node":{"externalPackages":["host-private"]}}',
      "custom/backend/schema.ts": 'import { defineSchema, defineTable } from "convex/server"; export default defineSchema({host:defineTable({})},{schemaValidation:true});',
      "custom/backend/convex.config.ts": 'import { defineApp } from "convex/server"; import host from "host/convex.config"; const app=defineApp(); app.use(host,{name:"hostAgent"}); export default app;',
      "custom/backend/auth.config.ts": 'export default {providers:[{domain:"https://host.example",applicationID:"host"}]};',
      "custom/backend/http.ts": 'import { httpRouter } from "convex/server"; const http=httpRouter(); http.route({path:"/host",method:"GET",handler:host}); export default http;',
      "custom/backend/host.ts": 'export const hostValue="keep";', ".env.local": 'HOST_SECRET=keep\n', "package.json": '{"scripts":{"build":"host-build","quickstart":"host-start"},"dependencies":{"host":"1"}}' };
    for (const [name, content] of Object.entries(preserved)) await fs.outputFile(path.join(host, name), content);
    const preview = await setupBackend({ projectPath: host, sdkPath: sdk, planOnly: true }); expect(preview.conflicts).toEqual([]); expect(preview.functionsDirectory).toBe("custom/backend/");
    for (const [name, content] of Object.entries(preserved)) expect(await fs.readFile(path.join(host, name), "utf8")).toBe(content);
    const result = await setupBackend({ projectPath: host, sdkPath: sdk }); expect(result.registered).toBe(false); expect(result.grantProvisioned).toBe(false);
    expect(result.requiredDependencies["@convex-dev/workflow"]).toBe("0.4.8");
    expect(await fs.readFile(path.join(host, "custom/backend/schema.ts"), "utf8")).toContain('host:defineTable({})');
    expect(await fs.readFile(path.join(host, "custom/backend/convex.config.ts"), "utf8")).toContain('app.use(host,{name:"hostAgent"})');
    for (const name of ["convex.json", "custom/backend/auth.config.ts", "custom/backend/http.ts", "custom/backend/host.ts", ".env.local", "package.json"]) expect(await fs.readFile(path.join(host, name), "utf8")).toBe(preserved[name]);
    const repeat = await setupBackend({ projectPath: host, sdkPath: sdk }); expect(repeat.changes).toEqual([]); expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
  });
  it("fresh command installs the exact reviewed JWT provider without claiming live capability", async () => {
    const providerFile = path.join(root, "provider.json"); await fs.writeJson(providerFile, provider);
    const program = new Command(); registerBackendCommands(program); const output = jest.spyOn(console, "log").mockImplementation(() => {});
    await program.parseAsync(["node", "cortex", "backend", "install", host, "--sdk-path", sdk, "--jwt-provider", providerFile]);
    const auth = await fs.readFile(path.join(host, "convex/auth.config.ts"), "utf8");
    expect(JSON.parse(auth.match(/providers:\s*\[([^\]]+)\]/)![1])).toEqual(provider);
    expect(output.mock.calls[0][0]).toContain('"registered": false'); expect(output.mock.calls[0][0]).not.toContain("providers");
  });
  it("an ambiguous host merge produces a proposal before any backend/env/script write", async () => {
    await fs.outputFile(path.join(host, "convex/schema.ts"), 'export default hiddenSchema;');
    const env = 'CUSTOM=preserve\n'; await fs.writeFile(path.join(host, ".env.local"), env);
    await expect(setupBackend({ projectPath: host, sdkPath: sdk })).rejects.toThrow("reviewed merge");
    expect(await fs.readFile(path.join(host, "convex/schema.ts"), "utf8")).toBe('export default hiddenSchema;');
    expect(await fs.pathExists(path.join(host, "convex/runs.ts"))).toBe(false); expect(await fs.readFile(path.join(host, ".env.local"), "utf8")).toBe(env);
    expect((await fs.readdir(host)).some(name => name.startsWith("cortex-backend-merge-proposal"))).toBe(true);
  });
  it("operator register refuses management-verified production before any command dispatch", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ name: "safe", deploymentType: "prod", kind: "cloud", projectId: 2, deploymentUrl: "https://safe.convex.cloud", id: 2, teamId: 1 })));
    await expect(runDevelopmentSetup({ projectPath: host, target: { teamId: 1, projectId: 2, deploymentName: "safe", deploymentUrl: "https://safe.convex.cloud", disposable: true }, managementToken: "private", deployKey: "dev:safe|private" })).rejects.toThrow("differs");
    expect(fetch).toHaveBeenCalledTimes(2); expect(await fs.readdir(host)).toEqual([]);
  });
  it("configure appends only public metadata and preserves exact existing env bytes/idempotence", async () => {
    const before = '# custom\r\nHOST_SECRET=preserve\r\nOPENAI_API_KEY=host-owned'; await fs.writeFile(path.join(host, ".env.local"), before);
    await appendRuntimeEnvironment(host, { NEXT_PUBLIC_CONVEX_URL: "https://safe.convex.cloud", NEXT_PUBLIC_CORTEX_AGENT_ID: "published", NEXT_PUBLIC_CORTEX_AGENT_VERSION: "1" });
    const after = await fs.readFile(path.join(host, ".env.local"), "utf8"); expect(after.startsWith(before)).toBe(true);
    await appendRuntimeEnvironment(host, { NEXT_PUBLIC_CONVEX_URL: "https://safe.convex.cloud" }); expect(await fs.readFile(path.join(host, ".env.local"), "utf8")).toBe(after);
    await expect(appendRuntimeEnvironment(host, { NEXT_PUBLIC_CONVEX_URL: "https://foreign.convex.cloud" })).rejects.toThrow("review");
    expect(await fs.readFile(path.join(host, ".env.local"), "utf8")).toBe(after);
  });
  it("configure writes the HTTP endpoint key consumed by the runtime quickstart", async () => {
    const program = new Command(); registerBackendCommands(program);
    jest.spyOn(console, "log").mockImplementation(() => {});
    await program.parseAsync(["node", "cortex", "backend", "configure", host, "--url", "https://safe.convex.cloud", "--http-url", "https://safe.convex.site"]);
    const env = await fs.readFile(path.join(host, ".env.local"), "utf8");
    expect(env).toContain("NEXT_PUBLIC_CORTEX_HTTP_URL=https://safe.convex.site\n");
    expect(env).not.toContain("CORTEX_ASSET_HTTP_URL");
  });
  const rejectedMetadata: Record<string, string>[] = [{ OPENAI_API_KEY: "private" }, { NEXT_PUBLIC_TOKEN: "private" }, { NEXT_PUBLIC_CONVEX_URL: "https://user:secret@safe.convex.cloud" }, { NEXT_PUBLIC_CONVEX_URL: "https://safe.convex.cloud?token=private" }, { NEXT_PUBLIC_CORTEX_HTTP_URL: "https://safe.convex.site/path" }, { NEXT_PUBLIC_CORTEX_AGENT_ID: "id\nTOKEN=private" }, { NEXT_PUBLIC_CORTEX_AGENT_VERSION: "0" }];
  it.each(rejectedMetadata)("rejects credential/injection/invalid metadata %j before writes", async values => {
    await expect(appendRuntimeEnvironment(host, values)).rejects.toThrow(); expect(await fs.pathExists(path.join(host, ".env.local"))).toBe(false);
  });
  it("init env and quickstart env have no inference credentials and preserve host scripts/env", async () => {
    const config: WizardConfig = { projectName: "test", projectPath: host, installationType: "existing", templateChoice: "vercel-ai-quickstart", convexSetupType: "existing", convexUrl: "https://safe.convex.cloud", graphEnabled: false, openaiApiKey: "do-not-copy" };
    expect(generateEnvFile(config)).not.toMatch(/OPENAI_API_KEY|do-not-copy/);
    await fs.writeFile(path.join(host, ".env.local"), 'HOST=keep\n'); await createEnvFile(host, config);
    const env = await fs.readFile(path.join(host, ".env.local"), "utf8"); expect(env.startsWith('HOST=keep\n')).toBe(true); expect(env).not.toMatch(/OPENAI_API_KEY|do-not-copy/);
    const quickstart = path.join(host, "quickstart"); await fs.ensureDir(quickstart); await createQuickstartEnv(quickstart, config.convexUrl!);
    expect(await fs.readFile(path.join(quickstart, ".env.local"), "utf8")).not.toMatch(/OPENAI|NEO4J_PASSWORD|CONVEX_DEPLOY_KEY/);
    const pkg = '{"scripts":{"quickstart":"custom","build":"host-build"},"host":true}'; await fs.writeFile(path.join(host, "package.json"), pkg); await addQuickstartScript(host);
    expect(await fs.readFile(path.join(host, "package.json"), "utf8")).toBe(pkg);
  });
  it("quickstart refuses an existing host-owned app before any template overwrite or backend copy", async () => {
    await fs.outputFile(path.join(host, "quickstart/package.json"), 'host app'); await fs.outputFile(path.join(host, "custom/backend/health.ts"), 'host health');
    await expect(installVercelAIQuickstart(host, "test", "https://safe.convex.cloud")).rejects.toThrow("reviewed merge");
    expect(await fs.readFile(path.join(host, "quickstart/package.json"), "utf8")).toBe('host app'); expect(await fs.pathExists(path.join(host, "convex"))).toBe(false); expect(await fs.readFile(path.join(host, "custom/backend/health.ts"), "utf8")).toBe('host health');
  });
  it("local quickstart preparation copies the actual app without any backend, credential or host-script overwrite", async () => {
    const pkg = '{"scripts":{"quickstart":"host-start","build":"host-build"},"host":true}';
    await fs.writeFile(path.join(host, "package.json"), pkg);
    await fs.outputFile(path.join(host, "custom/backend/host.ts"), "host-function");
    const config = await prepareVercelAIQuickstart(host, "0.37.0", "https://safe.convex.cloud");
    expect(config).toMatchObject({ projectPath: host, path: "quickstart", enabled: true });
    expect(await fs.pathExists(path.join(host, "quickstart/app/page.tsx"))).toBe(true);
    expect(await fs.pathExists(path.join(host, "quickstart/convex"))).toBe(false);
    expect(await fs.pathExists(path.join(host, "convex"))).toBe(false);
    expect(await fs.pathExists(path.join(host, "quickstart/node_modules"))).toBe(false);
    expect(await fs.readFile(path.join(host, "quickstart/.env.local"), "utf8")).toContain("NEXT_PUBLIC_CONVEX_URL=https://safe.convex.cloud");
    expect(await fs.readFile(path.join(host, "package.json"), "utf8")).toBe(pkg);
    expect(await fs.readFile(path.join(host, "custom/backend/host.ts"), "utf8")).toBe("host-function");
  });
  it("explicit setup JSON validates closed provider/target/grant fields and rejects unsupported selectors", () => {
    expect(parseJwtProvider(provider)).toEqual(provider);
    expect(() => parseJwtProvider({ ...provider, token: "private" })).toThrow("fields"); expect(() => parseDevelopmentTarget({ teamId: 1, projectId: 2, deploymentName: "safe", deploymentUrl: "https://safe.convex.cloud", disposable: false })).toThrow("disposable");
    const principal = { issuer: "https://issuer.example", subject: "owner", actorKind: "user", tenantId: "tenant", memorySpaceId: "space", capabilities: ["read", "run"], resourceAccess: "space" };
    expect(parseDevelopmentPrincipal(principal)).toEqual(principal); expect(() => parseDevelopmentPrincipal({ ...principal, capabilities: ["inference"] })).toThrow("supported"); expect(() => parseDevelopmentPrincipal({ ...principal, expiresAt: 1 })).toThrow("future");
  });
});
describe("development lifecycle authority", () => {
  it("removes inherited production authority and pins an explicitly matching development key", () => {
    const inherited = { CONVEX_DEPLOY_KEY: "prod:host|private", CONVEX_DEPLOYMENT: "prod:host", HOST_SETTING: "keep" };
    expect(developmentStartEnvironment(undefined, undefined, inherited)).toEqual({ HOST_SETTING: "keep" });
    expect(developmentStartEnvironment("https://safe.convex.cloud", "dev:safe|private", inherited)).toMatchObject({ CONVEX_DEPLOY_KEY: "dev:safe|private", CONVEX_DEPLOYMENT: "dev:safe", HOST_SETTING: "keep" });
    expect(inherited.CONVEX_DEPLOY_KEY).toBe("prod:host|private");
  });
  it.each(["prod:safe|private", "legacy-private", "dev:foreign|private", "dev:safe|private\nINJECT=value"])("refuses %s on start without spawning or production deployment", key => {
    expect(() => developmentStartEnvironment("https://safe.convex.cloud", key, {})).toThrow("separate explicit");
  });
});
