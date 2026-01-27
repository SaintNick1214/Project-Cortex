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
import { existsSync, readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import type {
  CLIConfig,
  ConvexCheckResult,
  DeploymentConfig,
  GlobalOptions,
  OutputFormat,
  ValidationOptions,
  ValidationResult,
} from "../types.js";
import { Cortex } from "@cortexmemory/sdk";

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
    apps: {
      ...target.apps,
      ...source.apps,
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
  enabled: boolean;
}> {
  return Object.entries(config.deployments).map(([name, deployment]) => ({
    name,
    url: deployment.url,
    isDefault: name === config.default,
    hasKey: Boolean(deployment.key),
    enabled: deployment.enabled ?? name === config.default,
  }));
}

/**
 * List all installed apps
 */
export function listApps(config: CLIConfig): Array<{
  name: string;
  type: string;
  path: string;
  enabled: boolean;
  port?: number;
}> {
  if (!config.apps) {
    return [];
  }

  return Object.entries(config.apps).map(([name, app]) => ({
    name,
    type: app.type,
    path: app.path,
    enabled: app.enabled,
    port: app.port,
  }));
}

/**
 * Discovered app that's not yet registered
 */
export interface DiscoveredApp {
  /** Suggested name for the app */
  name: string;
  /** Detected app type */
  type: "basic" | "vercel-ai-quickstart";
  /** Relative path from deployment root */
  path: string;
  /** Absolute path to deployment root */
  projectPath: string;
  /** Full path to the app directory */
  fullPath: string;
  /** Associated deployment name (if any) */
  deploymentName?: string;
}

/**
 * Detect app type from a directory by examining package.json
 */
function detectAppType(
  appPath: string,
): "basic" | "vercel-ai-quickstart" | null {
  const packageJsonPath = join(appPath, "package.json");

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for vercel-ai-quickstart pattern
    if (
      deps["@cortexmemory/vercel-ai-provider"] &&
      (deps["next"] || deps["@ai-sdk/react"])
    ) {
      return "vercel-ai-quickstart";
    }

    // Check for basic app pattern
    if (deps["@cortexmemory/sdk"] && !deps["next"]) {
      return "basic";
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Discover unregistered apps in deployment directories
 *
 * Scans all deployment directories for known app patterns that aren't
 * yet registered in the config's apps section.
 *
 * Patterns detected:
 * - quickstart/ folder with Next.js + @cortexmemory/vercel-ai-provider
 * - Any folder with @cortexmemory/sdk (basic app)
 *
 * @param config - Current CLI configuration
 * @returns Array of discovered apps not yet registered
 */
export function discoverUnregisteredApps(config: CLIConfig): DiscoveredApp[] {
  const discovered: DiscoveredApp[] = [];
  const registeredPaths = new Set<string>();

  // Build set of already-registered app paths
  if (config.apps) {
    for (const app of Object.values(config.apps)) {
      const fullPath = join(app.projectPath, app.path);
      registeredPaths.add(fullPath);
    }
  }

  // Scan each deployment directory
  for (const [deploymentName, deployment] of Object.entries(
    config.deployments,
  )) {
    if (!deployment.projectPath || !existsSync(deployment.projectPath)) {
      continue;
    }

    const projectPath = deployment.projectPath;

    // Check common app locations within deployment
    const appLocations = [
      { path: "quickstart", defaultName: `${deploymentName}-quickstart` },
      { path: "app", defaultName: `${deploymentName}-app` },
      { path: ".", defaultName: deploymentName }, // App in root
    ];

    for (const location of appLocations) {
      const appPath = join(projectPath, location.path);

      // Skip if already registered
      if (registeredPaths.has(appPath)) {
        continue;
      }

      // Skip if doesn't exist
      if (!existsSync(appPath)) {
        continue;
      }

      // Detect app type
      const appType = detectAppType(appPath);
      if (!appType) {
        continue;
      }

      // Generate unique name
      let name = location.defaultName;
      let counter = 1;
      while (config.apps?.[name] || discovered.some((d) => d.name === name)) {
        name = `${location.defaultName}-${counter}`;
        counter++;
      }

      discovered.push({
        name,
        type: appType,
        path: location.path,
        projectPath,
        fullPath: appPath,
        deploymentName,
      });
    }

    // Also scan for subdirectories that might be apps
    try {
      const entries = readdirSync(projectPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Skip common non-app directories
        if (
          [
            "node_modules",
            ".next",
            ".git",
            "convex",
            "dist",
            "build",
            "src",
          ].includes(entry.name)
        ) {
          continue;
        }

        // Skip already checked locations
        if (appLocations.some((l) => l.path === entry.name)) {
          continue;
        }

        const appPath = join(projectPath, entry.name);

        // Skip if already registered
        if (registeredPaths.has(appPath)) {
          continue;
        }

        // Detect app type
        const appType = detectAppType(appPath);
        if (!appType) {
          continue;
        }

        // Generate unique name
        let name = `${deploymentName}-${entry.name}`;
        let counter = 1;
        while (config.apps?.[name] || discovered.some((d) => d.name === name)) {
          name = `${deploymentName}-${entry.name}-${counter}`;
          counter++;
        }

        discovered.push({
          name,
          type: appType,
          path: entry.name,
          projectPath,
          fullPath: appPath,
          deploymentName,
        });
      }
    } catch {
      // Can't read directory, skip
    }
  }

  return discovered;
}

/**
 * Register a discovered app in the config
 */
export async function registerApp(
  app: DiscoveredApp,
  options?: {
    enabled?: boolean;
    port?: number;
  },
): Promise<CLIConfig> {
  const config = await loadConfig();

  if (!config.apps) {
    config.apps = {};
  }

  config.apps[app.name] = {
    type: app.type,
    path: app.path,
    projectPath: app.projectPath,
    enabled: options?.enabled ?? true,
    port: options?.port ?? (app.type === "vercel-ai-quickstart" ? 3000 : 3001),
  };

  await saveUserConfig(config);
  return config;
}

/**
 * Extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Determine if an error indicates an authentication failure
 *
 * Returns true for errors that indicate the deployment/key is invalid
 * and should be removed from config. Returns false for transient errors
 * (network issues, timeouts) where the deployment should be kept.
 */
function isAuthError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase();

  // HTTP status codes indicating auth failure
  if (msg.includes("401") || msg.includes("403")) {
    return true;
  }

  // Auth-related error messages
  const authPatterns = [
    "unauthorized",
    "forbidden",
    "invalid key",
    "invalid token",
    "authentication failed",
    "access denied",
  ];

  return authPatterns.some((pattern) => msg.includes(pattern));
}

/**
 * Check if a Convex URL is reachable and properly configured
 *
 * @param url - The Convex deployment URL to check
 * @param timeout - Timeout in milliseconds (default: 3000)
 * @returns Result indicating status of the check
 */
async function checkConvexUrl(
  url: string,
  timeout = 3000,
): Promise<ConvexCheckResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  let client: Cortex | undefined;

  try {
    client = new Cortex({ convexUrl: url });

    // Race the operation against the abort signal
    const checkPromise = client.memorySpaces.list({ limit: 1 });

    // Set up abort listener
    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new Error("Operation timed out"));
      });
    });

    await Promise.race([checkPromise, abortPromise]);

    return { status: "ok" };
  } catch (error) {
    if (controller.signal.aborted) {
      return { status: "timeout" };
    }
    if (isAuthError(error)) {
      return { status: "auth_error", message: getErrorMessage(error) };
    }
    // Default to network_error for any unrecognized error (fail-safe: keep deployment)
    return { status: "network_error", message: getErrorMessage(error) };
  } finally {
    clearTimeout(timeoutId);
    client?.close();
  }
}

/**
 * Validate and clean a configuration, removing invalid entries
 *
 * Performs the following validations:
 * 1. Deployment projectPath: removes if directory doesn't exist
 * 2. Deployment Convex URL: removes on auth errors, keeps on network errors
 * 3. App paths: removes if join(projectPath, path) doesn't exist
 * 4. Default deployment: reassigns if current default was removed
 *
 * @param config - The configuration to validate
 * @param options - Validation options
 * @returns Validation result with cleaned config and list of removed items
 */
export async function validateAndCleanConfig(
  config: CLIConfig,
  options?: ValidationOptions,
): Promise<ValidationResult> {
  const checkConvex = options?.checkConvex ?? true;
  const timeout = options?.timeout ?? 3000;

  const result: ValidationResult = {
    config: { ...config, deployments: { ...config.deployments } },
    modified: false,
    removed: {
      deployments: [],
      apps: [],
    },
  };

  // Copy apps if present
  if (config.apps) {
    result.config.apps = { ...config.apps };
  }

  // Validate deployments
  const deploymentNames = Object.keys(result.config.deployments);

  for (const name of deploymentNames) {
    const deployment = result.config.deployments[name];
    let shouldRemove = false;

    // Check 1: projectPath exists (filesystem validation)
    if (deployment.projectPath && !existsSync(deployment.projectPath)) {
      shouldRemove = true;
    }

    // Check 2: Convex URL is reachable (if enabled and not already marked for removal)
    if (!shouldRemove && checkConvex && deployment.url) {
      const checkResult = await checkConvexUrl(deployment.url, timeout);

      if (checkResult.status === "auth_error") {
        shouldRemove = true;
      }
      // Note: timeout and network_error do NOT trigger removal (fail-safe)
    }

    if (shouldRemove) {
      delete result.config.deployments[name];
      result.removed.deployments.push(name);
      result.modified = true;
    }
  }

  // Validate apps
  if (result.config.apps) {
    const appNames = Object.keys(result.config.apps);

    for (const name of appNames) {
      const app = result.config.apps[name];

      // Check: app path exists relative to projectPath
      const fullPath = join(app.projectPath, app.path);
      if (!existsSync(fullPath)) {
        delete result.config.apps[name];
        result.removed.apps.push(name);
        result.modified = true;
      }
    }
  }

  // Reassign default deployment if it was removed
  if (
    result.config.default &&
    !result.config.deployments[result.config.default]
  ) {
    const remaining = Object.keys(result.config.deployments).sort();
    result.config.default = remaining[0] || "";
    result.modified = true;
  }

  // Auto-save if modified
  if (result.modified) {
    await saveUserConfig(result.config);
  }

  return result;
}

/**
 * Load configuration and validate it, cleaning up invalid entries
 *
 * Combines loadConfig() with validateAndCleanConfig() for a single
 * function that returns a validated, cleaned configuration.
 *
 * @param options - Validation options
 * @returns The validated and cleaned configuration
 */
export async function loadConfigWithValidation(
  options?: ValidationOptions,
): Promise<CLIConfig> {
  const config = await loadConfig();
  const result = await validateAndCleanConfig(config, options);
  return result.config;
}
