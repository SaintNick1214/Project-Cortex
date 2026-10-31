/** Explicit cloud-development target verification and bounded operator provisioning. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

export interface DisposableDevelopmentTarget {
  teamId: number;
  projectId: number;
  deploymentName: string;
  deploymentUrl: string;
  /** Explicit operator assertion; development type alone does not mean disposable. */
  disposable: true;
}
interface VerifiedState { target: Readonly<DisposableDevelopmentTarget>; token: string; expiresAt: number }
const verifiedTargets = new WeakMap<object, VerifiedState>();
export interface VerifiedDevelopmentTarget { readonly target: Readonly<DisposableDevelopmentTarget>; readonly verifiedAt: string }
async function managementRead(token: string, route: string): Promise<unknown> {
  const response = await fetch(`https://api.convex.dev/v1${route}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!response.ok) throw new Error(`Development-target verification failed (HTTP ${response.status}); no mutation dispatched.`);
  return response.json();
}
async function inspect(target: DisposableDevelopmentTarget, token: string): Promise<void> {
  if (target.disposable !== true || !Number.isSafeInteger(target.teamId) || target.teamId <= 0 || !Number.isSafeInteger(target.projectId) || target.projectId <= 0 || !/^[a-z0-9-]+$/.test(target.deploymentName)) throw new Error("An explicit disposable team/project/deployment identity is required.");
  const url = new URL(target.deploymentUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".convex.cloud") || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash || !url.hostname.startsWith(target.deploymentName + ".")) throw new Error("Expected development deployment URL is invalid.");
  const [deployment, project] = await Promise.all([
    managementRead(token, `/deployments/${encodeURIComponent(target.deploymentName)}`),
    managementRead(token, `/projects/${target.projectId}`),
  ]) as [{ name?: unknown; deploymentType?: unknown; projectId?: unknown; deploymentUrl?: unknown; kind?: unknown }, { id?: unknown; teamId?: unknown }];
  if (deployment.name !== target.deploymentName || deployment.deploymentType !== "dev" || deployment.kind !== "cloud" || deployment.projectId !== target.projectId || project.id !== target.projectId || project.teamId !== target.teamId || typeof deployment.deploymentUrl !== "string" || new URL(deployment.deploymentUrl).origin !== url.origin) throw new Error("Target identity/type differs from the explicitly selected disposable development target; no mutation dispatched.");
}
/** Never creates a project or deployment. Credentials are held privately, not returned in receipts. */
export async function verifyDisposableDevelopmentTarget(target: DisposableDevelopmentTarget, managementToken: string): Promise<VerifiedDevelopmentTarget> {
  if (!managementToken) throw new Error("Convex management access is required to verify the explicit development target.");
  const immutable = Object.freeze({ ...target });
  await inspect(immutable, managementToken);
  const verifiedAt = new Date().toISOString();
  const receipt = Object.freeze({ target: immutable, verifiedAt });
  verifiedTargets.set(receipt, { target: immutable, token: managementToken, expiresAt: Date.now() + 300000 });
  return receipt;
}
export interface TrustedDevelopmentBootstrap {
  issuer: string; subject: string; actorKind: "user" | "service"; metadataUserId?: string;
  tenantId: string; memorySpaceId?: string;
  capabilities: ("read" | "write" | "run" | "admin" | "tool" | "storage:read" | "storage:write")[];
  resourceAccess: "own" | "space" | "tenant"; expiresAt?: number;
}
async function boundedCommand(projectPath: string, args: string[], deployKey: string, target: DisposableDevelopmentTarget): Promise<void> {
  const requireFromHost = createRequire(path.join(path.resolve(projectPath), "package.json"));
  const convexPackage = requireFromHost.resolve("convex/package.json");
  const cli = path.join(path.dirname(convexPackage), "bin/main.js");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-dev-operation-"));
  await fs.chmod(temporary, 0o700);
  const envFile = path.join(temporary, "target.env");
  await fs.writeFile(envFile, `CONVEX_DEPLOY_KEY=${deployKey}\nCONVEX_DEPLOYMENT=dev:${target.deploymentName}\n`, { mode: 0o600 });
  const env: Record<string, string | undefined> = { ...process.env, CONVEX_DEPLOY_KEY: deployKey, CONVEX_DEPLOYMENT: `dev:${target.deploymentName}` };
  delete env.CONVEX_SELF_HOSTED_URL; delete env.CONVEX_SELF_HOSTED_ADMIN_KEY; delete env.CONVEX_PROVISION_HOST;
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [cli, ...args, "--env-file", envFile], { cwd: path.resolve(projectPath), env, stdio: ["ignore", "ignore", "ignore"] });
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); }, 120000);
      const force = setTimeout(() => child.kill("SIGKILL"), 125000);
      child.once("error", () => { clearTimeout(timeout); clearTimeout(force); reject(new Error("Convex development command could not start; no implicit target creation attempted.")); });
      child.once("close", (code) => {
        clearTimeout(timeout); clearTimeout(force);
        if (timedOut) reject(new Error("Convex development operation timed out; inspect the selected target before retrying an uncertain mutation."));
        else if (code !== 0) reject(new Error(`Convex development command failed (exit ${code}); inspect backend capability/configuration on the selected target.`));
        else resolve();
      });
    });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
/** Recheck target immediately before mutation and accept only a key explicitly bound to dev/name. */
async function checkedOperation(receipt: VerifiedDevelopmentTarget, projectPath: string, deployKey: string, args: string[]): Promise<void> {
  const state = verifiedTargets.get(receipt);
  if (!state || Date.now() >= state.expiresAt) throw new Error("A current verified development-target receipt is required; verify again before mutation.");
  if (!deployKey.startsWith(`dev:${state.target.deploymentName}|`) || /[\r\n]/.test(deployKey)) throw new Error("The deploy key is not explicitly bound to the verified development deployment.");
  await inspect(state.target, state.token);
  await boundedCommand(projectPath, args, deployKey, state.target);
}
export async function registerInstalledDevelopmentBackend(receipt: VerifiedDevelopmentTarget, projectPath: string, deployKey: string): Promise<void> {
  await checkedOperation(receipt, projectPath, deployKey, ["dev", "--once"]);
}
/** This is operator administration, never a public JWT-claim/bootstrap endpoint. */
export async function provisionDevelopmentPrincipal(receipt: VerifiedDevelopmentTarget, projectPath: string, deployKey: string, bootstrap: TrustedDevelopmentBootstrap): Promise<void> {
  if (!bootstrap.issuer || !bootstrap.subject || !bootstrap.tenantId || !bootstrap.capabilities.length || (bootstrap.resourceAccess === "space" && !bootstrap.memorySpaceId) || (bootstrap.resourceAccess === "tenant" && bootstrap.memorySpaceId !== undefined)) throw new Error("Explicit trusted identity, grant scope and capabilities are required for operator provisioning.");
  await checkedOperation(receipt, projectPath, deployKey, ["run", "runtimeAuth:provision", JSON.stringify(bootstrap)]);
}
export function assertDevelopmentBackendCapability(capability: { authConfigured: boolean; bootstrapConfigured: boolean; coreRegistered: boolean }): void {
  const missing = Object.entries(capability).filter(([, ready]) => !ready).map(([name]) => name);
  if (missing.length) throw new Error(`Cortex backend capability is incomplete: ${missing.join(", ")}. Configure verified JWT auth, provision trusted operator grants, and register the additive core on the selected development target.`);
}
