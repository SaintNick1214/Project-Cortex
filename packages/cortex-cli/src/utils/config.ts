/**
 * Configuration Management
 *
 * Handles loading, saving, and managing CLI configuration from multiple sources:
 * 1. CLI flags (highest priority)
 * 2. Environment variables
 * 3. Project config (./cortex.config.json)
 * 4. User config (~/.cortexrc)
 */

import { cosmiconfig } from "cosmiconfig";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import type {
  CLIConfig,
  DeploymentConfig,
  GlobalOptions,
  OutputFormat,
} from "../types.js";

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CLIConfig = {
  deployments: {},
  default: "",
  format: "table",
  confirmDangerous: true,
};

/**
 * Explorer for loading configuration from various sources
 */
const explorer = cosmiconfig("cortex", {
  searchPlaces: [
    "cortex.config.json",
    "cortex.config.js",
    ".cortexrc",
    ".cortexrc.json",
    "package.json",
  ],
});

/**
 * Get the path to the user config file
 */
export function getUserConfigPath(): string {
  return join(homedir(), ".cortexrc");
}

/**
 * Get the path to the project config file
 */
export function getProjectConfigPath(): string {
  return join(process.cwd(), "cortex.config.json");
}

/**
 * Load configuration from all sources
 */
export async function loadConfig(): Promise<CLIConfig> {
  let config: CLIConfig = { ...DEFAULT_CONFIG };

  // Try to load from cosmiconfig (searches up directory tree)
  try {
    const result = await explorer.search();
    if (result && result.config) {
      config = mergeConfig(config, result.config as Partial<CLIConfig>);
    }
  } catch {
    // No config file found, use defaults
  }

  // Try to load user config from ~/.cortexrc
  const userConfigPath = getUserConfigPath();
  if (existsSync(userConfigPath)) {
    try {
      const userConfigContent = await readFile(userConfigPath, "utf-8");
      const userConfig = JSON.parse(userConfigContent) as Partial<CLIConfig>;
      config = mergeConfig(config, userConfig);
    } catch {
      // Invalid user config, skip
    }
  }

  // Override with environment variables
  config = applyEnvOverrides(config);

  return config;
}

/**
 * Merge two configurations, with source overriding target
 */
function mergeConfig(target: CLIConfig, source: Partial<CLIConfig>): CLIConfig {
  return {
    deployments: {
      ...target.deployments,
      ...source.deployments,
    },
    default: source.default ?? target.default,
    format: source.format ?? target.format,
    confirmDangerous: source.confirmDangerous ?? target.confirmDangerous,
  };
}

/**
 * Apply environment variable overrides.
 *
 * The CLI config (~/.cortexrc) is the source of truth.
 * Environment variables from .env.local are NOT used to override config
 * because they are project-specific and would cause confusion when
 * managing multiple deployments from different directories.
 *
 * To override a deployment's URL/key at runtime, use CLI flags:
 *   cortex --url <url> --key <key> <command>
 */
function applyEnvOverrides(config: CLIConfig): CLIConfig {
  // No automatic overrides - config file is source of truth
  return config;
}

/**
 * Save configuration to user config file
 */
export async function saveUserConfig(config: CLIConfig): Promise<void> {
  const configPath = getUserConfigPath();
  const configDir = dirname(configPath);

  // Ensure directory exists
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Save configuration to project config file
 */
export async function saveProjectConfig(config: CLIConfig): Promise<void> {
  const configPath = getProjectConfigPath();
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Get a specific deployment configuration
 */
export function getDeployment(
  config: CLIConfig,
  name?: string,
): DeploymentConfig | null {
  const deploymentName = name ?? config.default;
  return config.deployments[deploymentName] ?? null;
}

/**
 * Resolve final configuration from global options and config
 */
export function resolveConfig(
  config: CLIConfig,
  options: GlobalOptions,
): {
  url: string;
  key?: string;
  deployment?: string;
  format: OutputFormat;
  quiet: boolean;
  debug: boolean;
} {
  // CLI flags have highest priority
  if (options.url) {
    return {
      url: options.url,
      key: options.key,
      format: options.format ?? config.format,
      quiet: options.quiet ?? false,
      debug: options.debug ?? false,
    };
  }

  // Look up deployment from config
  const deploymentConfig = getDeployment(config, options.deployment);
  if (!deploymentConfig) {
    throw new Error(
      `Deployment "${options.deployment ?? config.default}" not found in configuration. ` +
        `Run 'cortex setup' to configure deployments.`,
    );
  }

  return {
    url: deploymentConfig.url,
    key: deploymentConfig.key ?? options.key,
    deployment: deploymentConfig.deployment,
    format: options.format ?? config.format,
    quiet: options.quiet ?? false,
    debug: options.debug ?? false,
  };
}

/**
 * Update a single deployment in the config
 */
export async function updateDeployment(
  name: string,
  deployment: DeploymentConfig,
  saveToUser = true,
): Promise<CLIConfig> {
  const config = await loadConfig();
  config.deployments[name] = deployment;

  if (saveToUser) {
    await saveUserConfig(config);
  }

  return config;
}

/**
 * Set the default deployment
 */
export async function setDefaultDeployment(name: string): Promise<void> {
  const config = await loadConfig();

  if (!config.deployments[name]) {
    throw new Error(`Deployment "${name}" not found`);
  }

  config.default = name;
  await saveUserConfig(config);
}

/**
 * Set a configuration value
 */
export async function setConfigValue(
  key: string,
  value: string,
): Promise<void> {
  const config = await loadConfig();

  switch (key) {
    case "default":
      if (!config.deployments[value]) {
        throw new Error(`Deployment "${value}" not found`);
      }
      config.default = value;
      break;
    case "format":
      if (!["table", "json", "csv"].includes(value)) {
        throw new Error(`Invalid format: ${value}. Use table, json, or csv`);
      }
      config.format = value as OutputFormat;
      break;
    case "confirmDangerous":
      config.confirmDangerous = value === "true";
      break;
    case "convex-url":
      config.deployments[config.default] = {
        ...config.deployments[config.default],
        url: value,
      };
      break;
    case "convex-key":
      config.deployments[config.default] = {
        ...config.deployments[config.default],
        key: value,
      };
      break;
    default:
      throw new Error(`Unknown config key: ${key}`);
  }

  await saveUserConfig(config);
}

/**
 * List all deployments
 */
export function listDeployments(config: CLIConfig): Array<{
  name: string;
  url: string;
  isDefault: boolean;
  hasKey: boolean;
}> {
  return Object.entries(config.deployments).map(([name, deployment]) => ({
    name,
    url: deployment.url,
    isDefault: name === config.default,
    hasKey: Boolean(deployment.key),
  }));
}
