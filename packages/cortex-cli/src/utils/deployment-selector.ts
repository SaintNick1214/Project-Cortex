/**
 * Deployment Selection Utility
 *
 * Provides consistent deployment selection across all CLI commands.
 * Priority order: -d flag > cortex use > interactive/single
 */

import { existsSync } from "fs";
import { readFile, writeFile, unlink } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import prompts from "prompts";
import pc from "picocolors";
import type { CLIConfig, DeploymentConfig } from "../types.js";

/**
 * Path to the current deployment file
 */
const CURRENT_DEPLOYMENT_PATH = join(homedir(), ".cortex-current");

/**
 * Get the current deployment set via `cortex use`
 */
export async function getCurrentDeployment(): Promise<string | null> {
  if (!existsSync(CURRENT_DEPLOYMENT_PATH)) {
    return null;
  }
  try {
    const content = await readFile(CURRENT_DEPLOYMENT_PATH, "utf-8");
    return content.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Set the current deployment via `cortex use`
 */
export async function setCurrentDeployment(name: string): Promise<void> {
  await writeFile(CURRENT_DEPLOYMENT_PATH, name, "utf-8");
}

/**
 * Clear the current deployment
 */
export async function clearCurrentDeployment(): Promise<void> {
  if (existsSync(CURRENT_DEPLOYMENT_PATH)) {
    await unlink(CURRENT_DEPLOYMENT_PATH);
  }
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
 * 2. cortex use (~/.cortex-current)
 * 3. Single deployment → use it
 * 4. Multiple deployments → interactive prompt
 *
 * Always prints "Using: <name>" hint.
 *
 * @param config - CLI configuration
 * @param options - Command options (may contain deployment)
 * @param actionDescription - Optional description for the prompt (e.g., "list memories")
 * @returns Selected deployment or null if cancelled
 */
export async function selectDeployment(
  config: CLIConfig,
  options: { deployment?: string },
  actionDescription?: string,
): Promise<DeploymentSelection | null> {
  const deployments = Object.entries(config.deployments);

  if (deployments.length === 0) {
    console.log(pc.red("\n   No deployments configured"));
    console.log(
      pc.dim(
        "   Run 'cortex init' or 'cortex config add-deployment' to add one\n",
      ),
    );
    return null;
  }

  let selectedName: string | null = null;

  // Priority 1: -d flag
  if (options.deployment) {
    if (!config.deployments[options.deployment]) {
      console.log(pc.red(`\n   Deployment "${options.deployment}" not found`));
      const names = Object.keys(config.deployments);
      console.log(pc.dim(`   Available: ${names.join(", ")}\n`));
      return null;
    }
    selectedName = options.deployment;
  }

  // Priority 2: cortex use
  if (!selectedName) {
    const current = await getCurrentDeployment();
    if (current) {
      if (config.deployments[current]) {
        selectedName = current;
      }
      // If current deployment no longer exists, ignore it silently
    }
  }

  // Priority 3: Single deployment
  if (!selectedName && deployments.length === 1) {
    selectedName = deployments[0][0];
  }

  // Priority 4: Interactive prompt for multiple deployments
  if (!selectedName) {
    const action = actionDescription ? ` to ${actionDescription}` : "";
    const response = await prompts({
      type: "select",
      name: "deployment",
      message: `Select deployment${action}:`,
      choices: deployments.map(([name, dep]) => ({
        title: name === config.default ? `${name} (default)` : name,
        description: dep.url,
        value: name,
      })),
      initial: deployments.findIndex(([name]) => name === config.default),
    });

    if (!response.deployment) {
      console.log(pc.yellow("\n   Operation cancelled\n"));
      return null;
    }
    selectedName = response.deployment;
  }

  // Get the deployment config
  const deployment = config.deployments[selectedName!];

  // Always show "Using: X" hint
  console.log(pc.dim(`   Using: ${selectedName}`));

  return {
    name: selectedName!,
    deployment,
  };
}

/**
 * Get the path to the current deployment file (for display purposes)
 */
export function getCurrentDeploymentPath(): string {
  return CURRENT_DEPLOYMENT_PATH;
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
