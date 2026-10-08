/**
 * Deployment Selection Utility
 *
 * Provides consistent deployment selection across all CLI commands.
 * Priority order: -d flag > scoped cortex use > configured default > singleton
 */

import { existsSync } from "fs";
import { readFile, unlink } from "fs/promises";
import { homedir } from "os";
import { join, isAbsolute } from "path";
import pc from "picocolors";
import { currentAdmissionContext, readAdmissionFile, recheckAdmission } from "./bootstrap-admission.js";
import type { CLIConfig, DeploymentConfig } from "../types.js";
import {
  atomicPrivateWrite,
  getConfigScope,
  validateDeploymentName,
} from "./config.js";

/**
 * Path to the current deployment file
 */
function currentPath(): string {
  return join(homedir(), ".cortex-current");
}
interface SelectionStore {
  version: 1;
  selections: Record<string, string>;
  legacy?: string;
}
async function readStore(): Promise<SelectionStore> {
  try {
    const context = currentAdmissionContext();
    if (context?.mode === "owned-data-only") await recheckAdmission(context);
    const safe = context?.mode === "owned-data-only" ? await readAdmissionFile(currentPath()) : undefined;
    const content = context?.mode === "owned-data-only" ? (safe?.bytes.toString("utf8") ?? "{\"version\":1,\"selections\":{}}") : await readFile(currentPath(), "utf-8");
    // Preserve legacy global selection but do not let it silently target another project.
    if (!content.trim().startsWith("{"))
      return { version: 1, selections: {}, legacy: content.trim() };
    const raw: unknown = JSON.parse(content);
    if (
      !raw ||
      typeof raw !== "object" ||
      !("version" in raw) ||
      raw.version !== 1 ||
      !("selections" in raw) ||
      !raw.selections ||
      typeof raw.selections !== "object" ||
      Array.isArray(raw.selections)
    )
      throw new Error("Invalid scoped selection");
    for (const [scope, name] of Object.entries(raw.selections)) {
      if (!isAbsolute(scope) || typeof name !== "string")
        throw new Error("Invalid scoped selection");
      validateDeploymentName(name);
    }
    return raw as SelectionStore;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return { version: 1, selections: {} };
    throw new Error(
      "Cannot read scoped target selection; inspect the .cortex-current file before selecting a target",
    );
  }
}
export async function getCurrentDeployment(): Promise<string | null> {
  const selections = (await readStore()).selections;
  const scope = await getConfigScope();
  // Older single-directory discovery stored explicit use under cwd. Preserve
  // that choice until an explicit use/clear replaces it; reads never migrate it.
  const cwd = process.cwd();
  if (Object.hasOwn(selections, cwd)) return selections[cwd];
  return Object.hasOwn(selections, scope) ? selections[scope] : null;
}
export async function setCurrentDeployment(name: string): Promise<void> {
  validateDeploymentName(name);
  const store = await readStore();
  const scope = await getConfigScope();
  if (process.cwd() !== scope) delete store.selections[process.cwd()];
  store.selections[scope] = name;
  await atomicPrivateWrite(currentPath(), JSON.stringify(store, null, 2));
}
export async function clearCurrentDeployment(): Promise<void> {
  const store = await readStore();
  delete store.selections[await getConfigScope()];
  delete store.selections[process.cwd()];
  if (Object.keys(store.selections).length || store.legacy)
    await atomicPrivateWrite(currentPath(), JSON.stringify(store, null, 2));
  else
    await unlink(currentPath()).catch((error: unknown) => {
      if (
        !(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        )
      )
        throw error;
    });
}

/**
 * Result of deployment selection
 */
export interface DeploymentSelection {
  name: string;
  deployment: DeploymentConfig;
}

/**
 * Select a deployment for an operation.
 *
 * Priority order:
 * 1. -d flag (options.deployment)
 * 2. Scoped cortex use (~/.cortex-current)
 * 3. Configured default
 * 4. Single deployment
 * 5. Actionable failure for missing, stale or ambiguous targets
 *
 * Prints a stderr selection hint unless quiet.
 *
 * @param config - CLI configuration
 * @param options - Command options (may contain deployment)
 * @param actionDescription - Compatibility description for callers
 * @returns Selected deployment; invalid selection throws
 */
export async function selectDeployment(
  config: CLIConfig,
  options: { deployment?: string; quiet?: boolean },
  actionDescription?: string,
): Promise<DeploymentSelection | null> {
  const names = Object.keys(config.deployments);
  if (!names.length)
    throw new Error(
      "No deployments configured. Run 'cortex init' or 'cortex config add-deployment'",
    );
  const current = options.deployment ? null : await getCurrentDeployment();
  const selectedName =
    options.deployment ??
    current ??
    (config.default || (names.length === 1 ? names[0] : undefined));
  if (!selectedName)
    throw new Error(
      `Choose a deployment with -d <name>, 'cortex use <name>' or 'cortex config set default <name>'. Available: ${names.join(", ")}`,
    );
  validateDeploymentName(selectedName);
  if (!Object.hasOwn(config.deployments, selectedName))
    throw new Error(
      `Deployment "${selectedName}" not found. Available: ${names.join(", ")}; select -d <name> or clear a stale selection with 'cortex use --clear'`,
    );
  if (!options.quiet)
    console.error(
      pc.dim(
        `   Using: ${selectedName}${actionDescription ? ` (${actionDescription})` : ""}`,
      ),
    );
  return { name: selectedName, deployment: config.deployments[selectedName] };
}

/**
 * Get the path to the current deployment file (for display purposes)
 */
export function getCurrentDeploymentPath(): string {
  return currentPath();
}

/**
 * Result of getting all enabled deployments
 */
export interface EnabledDeploymentsResult {
  deployments: Array<{
    name: string;
    deployment: DeploymentConfig;
    projectPath: string;
  }>;
}

/**
 * Get all enabled deployments that have valid project paths.
 *
 * A deployment is considered enabled if:
 * 1. enabled === true explicitly
 * 2. enabled === undefined AND it's the default deployment
 *
 * @param config - CLI configuration
 * @returns Array of enabled deployments with their project paths
 */
export function getEnabledDeployments(
  config: CLIConfig,
): EnabledDeploymentsResult {
  const deployments = Object.entries(config.deployments);
  const enabled: EnabledDeploymentsResult["deployments"] = [];

  for (const [name, deployment] of deployments) {
    const isDefault = name === config.default;
    const isEnabled =
      deployment.enabled === true ||
      (deployment.enabled === undefined && isDefault);

    if (!isEnabled) continue;

    // Require a project path for update operations
    const projectPath = deployment.projectPath || process.cwd();

    // Only include if project path exists
    if (existsSync(projectPath)) {
      enabled.push({
        name,
        deployment,
        projectPath,
      });
    }
  }

  return { deployments: enabled };
}
