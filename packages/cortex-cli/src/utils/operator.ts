/** Allowlisted deployment-operator maintenance on an exact freshly verified disposable target. */
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseDevelopmentTarget, readSetupJson } from "./init/backend-setup.js";
import { verifyDisposableDevelopmentTarget } from "./init/development-target.js";
export interface OperatorOptions { target: string; project?: string; managementTokenEnv?: string; deployKeyEnv?: string }
export type OperatorIntent = { kind: "stats" } | { kind: "retireScope"; tenantId: string; memorySpaceId: string };
const execute = promisify(execFile);
function selector(value: string): boolean { return !!value && value.length <= 256 && value.trim() === value && [...value].every(character => character.charCodeAt(0) >= 32); }
export async function runOperator(options: OperatorOptions, intent: OperatorIntent): Promise<unknown> {
  if (intent.kind !== "stats" && intent.kind !== "retireScope" || intent.kind === "retireScope" && (!selector(intent.tenantId) || !selector(intent.memorySpaceId))) throw new Error("Select an exact tenant AND memory-space lifecycle retirement; global purge is unsupported.");
  const target = parseDevelopmentTarget(await readSetupJson(options.target));
  const managementName = options.managementTokenEnv ?? "CONVEX_ACCESS_TOKEN", deployName = options.deployKeyEnv ?? "CONVEX_DEPLOY_KEY";
  if (![managementName, deployName].every(name => /^[A-Z_][A-Z0-9_]*$/.test(name))) throw new Error("Select credential environment variable names, not values.");
  const managementToken = process.env[managementName], deployKey = process.env[deployName];
  if (!managementToken || !deployKey || !deployKey.startsWith(`dev:${target.deploymentName}|`) || /[\r\n\0]/.test(deployKey)) throw new Error("Current management access and the exact target-bound dev key are required; no operation dispatched.");
  await verifyDisposableDevelopmentTarget(target, managementToken);
  const project = path.resolve(options.project ?? ".");
  const convex = createRequire(path.join(project, "package.json")).resolve("convex/package.json");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-maintenance-")); await fs.chmod(temporary, 0o700);
  const envFile = path.join(temporary, "target.env");
  try {
    await fs.writeFile(envFile, `CONVEX_DEPLOY_KEY=${deployKey}\nCONVEX_DEPLOYMENT=dev:${target.deploymentName}\n`, { mode: 0o600 });
    // Recheck live ownership/type immediately before the only allowlisted internal call.
    await verifyDisposableDevelopmentTarget(target, managementToken);
    const name = intent.kind === "stats" ? "admin:getAllCounts" : "runtimeAuth:deleteScope";
    const args = intent.kind === "stats" ? {} : { tenantId: intent.tenantId, memorySpaceId: intent.memorySpaceId };
    const result = await execute(process.execPath, [path.join(path.dirname(convex), "bin/main.js"), "run", name, JSON.stringify(args), "--url", target.deploymentUrl, "--env-file", envFile], {
      cwd: project, timeout: 60000, killSignal: "SIGKILL", maxBuffer: 65536,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: "true", CONVEX_DEPLOY_KEY: deployKey, CONVEX_DEPLOYMENT: `dev:${target.deploymentName}` },
    });
    if (intent.kind === "retireScope") {
      // The pinned Convex CLI omits stdout when the mutation returns null.
      if (result.stdout.trim() !== "" && JSON.parse(result.stdout.trim()) !== null) throw new Error("Unexpected retirement response");
      return { version: 1, retired: true, tenantId: intent.tenantId, memorySpaceId: intent.memorySpaceId, physicalPurge: false };
    }
    try { return JSON.parse(result.stdout.trim()); } catch { throw new Error("Operator statistics returned invalid JSON; counts are unavailable."); }
  } catch { throw new Error("Development operator maintenance failed. No fallback, inferred zero counts or blind mutation retry was performed; inspect the exact selected target."); }
  finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
