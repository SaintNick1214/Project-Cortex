/** Modern setup composes the accepted installer and explicit development operator APIs. */
import fs from "fs-extra";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSDKPath } from "../shell.js";
import { applyAdditiveBackendInstallation, planAdditiveBackendInstallation, type TrustedJwtProvider } from "./additive-backend.js";
import { verifyDisposableDevelopmentTarget, registerInstalledDevelopmentBackend, provisionDevelopmentPrincipal, type DisposableDevelopmentTarget, type TrustedDevelopmentBootstrap } from "./development-target.js";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an explicit setup JSON object.");
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (required.some(key => !(key in value)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) throw new Error("Unsupported or missing setup JSON fields.");
}
function string(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 4096 && value.trim() === value && !/[\r\n\0]/.test(value); }
export async function readSetupJson(file: string): Promise<unknown> {
  try { const text = await fs.readFile(path.resolve(file), "utf8"); if (Buffer.byteLength(text) > 65536) throw new Error("Setup JSON too large"); return JSON.parse(text); }
  catch { throw new Error(`Cannot read valid setup JSON from ${path.resolve(file)}.`); }
}
export function parseJwtProvider(input: unknown): TrustedJwtProvider {
  const value = object(input); exact(value, ["type", "issuer", "jwks", "algorithm", "applicationID"]);
  if (value.type !== "customJwt" || !string(value.issuer) || !string(value.jwks) || !string(value.applicationID) || (value.algorithm !== "RS256" && value.algorithm !== "ES256")) throw new Error("Use an explicit customJwt issuer, JWKS, applicationID and RS256/ES256 algorithm.");
  return { type: "customJwt", issuer: value.issuer, jwks: value.jwks, applicationID: value.applicationID, algorithm: value.algorithm };
}
export function parseDevelopmentTarget(input: unknown): DisposableDevelopmentTarget {
  const value = object(input); exact(value, ["teamId", "projectId", "deploymentName", "deploymentUrl", "disposable"]);
  if (value.disposable !== true || typeof value.teamId !== "number" || !Number.isSafeInteger(value.teamId) || value.teamId <= 0 || typeof value.projectId !== "number" || !Number.isSafeInteger(value.projectId) || value.projectId <= 0 || !string(value.deploymentName) || !string(value.deploymentUrl)) throw new Error("Select exact positive team/project IDs, deployment name/URL and disposable:true.");
  return { teamId: value.teamId, projectId: value.projectId, deploymentName: value.deploymentName, deploymentUrl: value.deploymentUrl, disposable: true };
}
export function parseDevelopmentPrincipal(input: unknown): TrustedDevelopmentBootstrap {
  const value = object(input); exact(value, ["issuer", "subject", "actorKind", "tenantId", "capabilities", "resourceAccess"], ["metadataUserId", "memorySpaceId", "expiresAt"]);
  const capabilities = ["read", "write", "run", "admin", "tool", "storage:read", "storage:write"] as const;
  if (!string(value.issuer) || !string(value.subject) || !string(value.tenantId) || (value.actorKind !== "user" && value.actorKind !== "service") || !Array.isArray(value.capabilities) || !value.capabilities.length || value.capabilities.some(item => !capabilities.includes(item)) || new Set(value.capabilities).size !== value.capabilities.length || (value.resourceAccess !== "own" && value.resourceAccess !== "space" && value.resourceAccess !== "tenant")) throw new Error("Select a trusted identity and exact supported grant scope/capabilities.");
  if ((value.metadataUserId !== undefined && !string(value.metadataUserId)) || (value.memorySpaceId !== undefined && !string(value.memorySpaceId))) throw new Error("Invalid optional principal/space selector.");
  if (value.expiresAt !== undefined && (typeof value.expiresAt !== "number" || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= Date.now())) throw new Error("Grant expiry must be a future Unix timestamp in milliseconds.");
  if ((value.resourceAccess === "space" && !value.memorySpaceId) || (value.resourceAccess === "tenant" && value.memorySpaceId !== undefined)) throw new Error("Select an explicit space for a space grant; tenant grants omit the space selector.");
  return { issuer: value.issuer, subject: value.subject, tenantId: value.tenantId, actorKind: value.actorKind, resourceAccess: value.resourceAccess,
    capabilities: value.capabilities.map(item => capabilities.find(capability => capability === item)!),
    ...(value.metadataUserId === undefined ? {} : { metadataUserId: value.metadataUserId }),
    ...(value.memorySpaceId === undefined ? {} : { memorySpaceId: value.memorySpaceId }),
    ...(value.expiresAt === undefined ? {} : { expiresAt: value.expiresAt }) };
}
export async function setupBackend(options: { projectPath: string; sdkPath?: string; jwtProvider?: TrustedJwtProvider; planOnly?: boolean }) {
  const sdk = options.sdkPath ?? getSDKPath(options.projectPath);
  if (!sdk) throw new Error("Install @cortexmemory/sdk in this host or select --sdk-path before additive setup.");
  const plan = await planAdditiveBackendInstallation(options.projectPath, sdk, { trustedJwtProvider: options.jwtProvider });
  const summary = { version: 1, distributionId: plan.distributionId, functionsDirectory: plan.functionsDirectory,
    changes: plan.changes.map(({ path, reason }) => ({ path, reason })), unchanged: plan.unchanged,
    conflicts: plan.conflicts.map(({ path, reason }) => ({ path, reason })), requiredDependencies: plan.requiredDependencies,
    authConfigPresent: plan.capabilities.authConfigured, registered: false, grantProvisioned: false };
  if (options.planOnly) return summary;
  await applyAdditiveBackendInstallation(plan);
  return summary;
}
/** Secrets stay in the environment/private verifier, never in .cortexrc or setup output. */
export async function runDevelopmentSetup(options: { projectPath: string; target: DisposableDevelopmentTarget; managementToken: string; deployKey: string; principal?: TrustedDevelopmentBootstrap }): Promise<void> {
  const receipt = await verifyDisposableDevelopmentTarget(options.target, options.managementToken);
  if (options.principal) await provisionDevelopmentPrincipal(receipt, options.projectPath, options.deployKey, options.principal);
  else await registerInstalledDevelopmentBackend(receipt, options.projectPath, options.deployKey);
}

const runtimeKeys = new Set(["CONVEX_URL", "NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CORTEX_HTTP_URL", "NEXT_PUBLIC_CORTEX_AGENT_ID", "NEXT_PUBLIC_CORTEX_AGENT_VERSION", "NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID"]);
export async function appendRuntimeEnvironment(projectPath: string, values: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (!runtimeKeys.has(key) || !string(value)) throw new Error("Only public runtime endpoint/agent/space metadata may be configured here.");
    if (key.endsWith("URL")) { const url = new URL(value); if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Use HTTPS runtime origins (loopback HTTP for development only), without credentials/path/query/fragment."); }
    if (key === "NEXT_PUBLIC_CORTEX_AGENT_VERSION" && (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value)))) throw new Error("Agent version must be a positive integer.");
  }
  const file = path.join(path.resolve(projectPath), ".env.local");
  let before: string | null = null;
  try { if ((await fs.lstat(file)).isSymbolicLink()) throw new Error("Refusing a symbolic-link environment destination."); before = await fs.readFile(file, "utf8"); }
  catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw error; }
  const additions: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const match = before?.match(new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.*)$`, "m"));
    if (match) { if (match[1].trim().replace(/^(["'])(.*)\1$/, "$2") !== value) throw new Error(`Existing ${key} differs; review .env.local instead of overwriting it.`); }
    else additions.push(`${key}=${value}`);
  }
  if (!additions.length) return;
  await fs.ensureDir(path.dirname(file));
  const content = (before ?? "") + (before && !before.endsWith("\n") ? "\n" : "") + "# Cortex backend runtime metadata; host-issued JWTs remain in memory.\n" + additions.join("\n") + "\n";
  if (before === null) { await fs.writeFile(file, content, { flag: "wx", mode: 0o600 }); return; }
  const temporary = `${file}.cortex-${randomUUID()}`;
  try {
    await fs.writeFile(temporary, content, { flag: "wx", mode: (await fs.stat(file)).mode });
    if (await fs.readFile(file, "utf8") !== before || (await fs.lstat(file)).isSymbolicLink()) throw new Error("Environment changed while planning; review and retry.");
    await fs.rename(temporary, file);
  } finally { await fs.remove(temporary); }
}

export const BACKEND_SETUP_GUIDANCE = `Backend setup readiness:
1. Install the reported dependencies; additive install preserves custom functions/schema/auth/http and refuses merge ambiguity.
2. Register only an explicitly verified disposable cloud-development target with backend register; production deployment is a separate operator action.
3. Configure a host JWT issuer/JWKS/audience and provision current identity/grants with backend provision. Supply fresh host tokens in memory, never labels as authority.
4. Publish a current executable Agent definition; Agent and Workflow components and qualified Gateway operation policies must be registered. Existing qualification covers only its exact model/envelope; unqualified image/video/tool options fail closed.
5. Configure public runtime/HTTP endpoints and agent metadata with backend configure. No application inference keys are required. Gateway billing/model eligibility and async-video configuration belong to the backend; unavailable is not ready.
6. Assets use authenticated private HTTP, immutable references and a 20,000,000-byte cap. No public storage URLs or external fallback.
7. Optional graph projection uses the Node-only @cortexmemory/sdk/runtime/graph trusted service-JWT worker and scoped Neo4j/Memgraph connector; Bolt credentials stay on that host. Graph lag/strict barriers remain separate from facts/vectors readiness.`;
