/**
 * Configuration Management
 *
 * Handles loading, saving, and managing CLI configuration from multiple sources:
 * 1. CLI flags (highest priority)
 * 2. Project config (./cortex.config.json or nearest supported project config)
 * 3. User config (~/.cortexrc)
 * Environment variables are not deployment overrides.
 */

import { cosmiconfig } from "cosmiconfig";
import { readFile, mkdir, open, rename, unlink, realpath } from "fs/promises";
import { existsSync, readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { join, dirname, isAbsolute, resolve as resolvePath } from "path";
import type {
  CLIConfig,
  ConvexCheckResult,
  DeploymentConfig,
  GlobalOptions,
  OutputFormat,
  ValidationOptions,
  ValidationResult,
} from "../types.js";
import { createClient, disposeClient } from "./client.js";
import {
  validateUrl,
  validateOutputFormat,
  validateFilePath,
} from "./validation.js";
import { randomUUID } from "crypto";
import { selectDeployment } from "./deployment-selector.js";
import { serializeEnvAssignment } from "./env-file.js";
import { projectSearchDirectories } from "./project-discovery.js";
import {
  attachAdmissionContext, contextForConfig, currentAdmissionContext,
  discoverAdmission, recheckAdmission, refreshAdmissionAfterSave,
  refuseExecutableOwnedConfig, withAdmissionContext,
  type DataSources,
} from "./bootstrap-admission.js";

/**
 * Default configuration
 */
interface ConfigProvenance {
  sourcePath: string;
  source: Partial<CLIConfig>;
  merged: CLIConfig;
  inherited: Partial<CLIConfig>;
}
const provenance = new WeakMap<CLIConfig, ConfigProvenance>();

const DEFAULT_CONFIG: CLIConfig = {
  deployments: {},
  default: "",
  format: "table",
  confirmDangerous: true,
};

/**
 * Explorer for loading configuration from various sources
 */
function ordinaryExplorer(atHome = false) { return cosmiconfig("cortex", {
  cache: false,
  searchStrategy: "none",
  searchPlaces: [
    "cortex.config.json",
    "cortex.config.js",
    ".cortexrc",
    ".cortexrc.json",
    "package.json",
  ].filter(place => !atHome || place !== ".cortexrc"),
}); }

async function nearestProjectConfig() {
  const home = await realpath(homedir()).catch(error => {
    if (isMissingFile(error)) return homedir();
    throw error;
  });
  for (const directory of projectSearchDirectories(process.cwd(), home)) {
    const result = await ordinaryExplorer(directory === home).search(directory);
    if (result) return result;
  }
  return null;
}

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
  const admitted = currentAdmissionContext();
  if (!admitted) {
    const context = await discoverAdmission();
    return withAdmissionContext(context, () => loadConfig());
  }
  if (admitted.mode === "owned-data-only") {
    await recheckAdmission(admitted);
    const safe = composeDataConfig(admitted.data);
    attachAdmissionContext(safe, admitted);
    return safe;
  }
  let config: CLIConfig = { ...DEFAULT_CONFIG, deployments: {} };
  const userPath = getUserConfigPath();
  let source: Partial<CLIConfig> = {};
  let sourcePath = userPath;
  let inherited: Partial<CLIConfig> = {};
  try {
    const raw: unknown = JSON.parse(await readFile(userPath, "utf-8"));
    validateConfigShape(raw);
    config = mergeConfig(config, raw);
    source = raw;
  } catch (error) {
    if (!isMissingFile(error))
      throw new Error(
        `Invalid user configuration at ${userPath}: ${safeConfigError(error)}`,
        { cause: error },
      );
  }
  try {
    const result = await nearestProjectConfig();
    if (result && result.filepath !== userPath) {
      validateConfigShape(result.config, true);
      inherited = structuredClone(source);
      source = result.config;
      sourcePath = result.filepath;
      config = mergeConfig(config, result.config);
    }
  } catch {
    throw new Error(
      "Invalid project configuration: malformed, unsafe or unreadable project config source",
    );
  }
  validateConfigShape(config);
  refuseExecutableOwnedConfig(config);
  attachAdmissionContext(config, admitted);
  provenance.set(config, {
    sourcePath,
    source: structuredClone(source),
    merged: structuredClone(config),
    inherited,
  });
  return config;
}

function isMissingFile(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  );
}
function safeConfigError(error: unknown): string {
  // JSON parser errors may contain slices of credentials; never echo source content.
  return error instanceof SyntaxError
    ? "Malformed configuration syntax"
    : error instanceof Error
      ? error.message
      : "Cannot read configuration";
}

/** Preserve future fields, but reject prototype keys even in nested extension fields. */
export function validateConfigShape(
  value: unknown,
  partialDeployments = false,
): asserts value is Partial<CLIConfig> {
  function object(
    raw: unknown,
    label: string,
  ): asserts raw is Record<string, unknown> {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      !(
        Object.getPrototypeOf(raw) === null ||
        (Object.getPrototypeOf(Object.getPrototypeOf(raw)) === null &&
          Object.getPrototypeOf(raw).constructor?.name === "Object")
      )
    ) {
      throw new Error(`${label} must be an object`);
    }
  }
  function safe(raw: unknown): void {
    if (!raw || typeof raw !== "object") return;
    if (!Array.isArray(raw)) object(raw, "Configuration field");
    for (const [key, child] of Object.entries(raw)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw new Error("Unsafe configuration key");
      safe(child);
    }
  }
  function string(raw: unknown, label: string, empty = false): void {
    if (
      typeof raw !== "string" ||
      (!empty && !raw.trim()) ||
      raw.length > 4096 ||
      [...raw].some((char) => char.charCodeAt(0) < 32)
    )
      throw new Error(`Invalid ${label}`);
  }
  object(value, "Configuration");
  safe(value);
  if (value.default !== undefined)
    string(value.default, "default deployment", true);
  if (value.format !== undefined) {
    if (
      typeof value.format !== "string" ||
      !["table", "json", "csv"].includes(value.format)
    )
      throw new Error("Invalid configuration format; use table, json, csv");
  }
  if (
    value.confirmDangerous !== undefined &&
    typeof value.confirmDangerous !== "boolean"
  )
    throw new Error("confirmDangerous must be true or false");
  if (value.deployments !== undefined) {
    object(value.deployments, "deployments");
    for (const [name, dep] of Object.entries(value.deployments)) {
      validateDeploymentName(name);
      object(dep, "Deployment");
      if (!partialDeployments || dep.url !== undefined) {
        string(dep.url, "deployment URL");
        validateUrl(dep.url as string);
      }
      for (const key of ["key", "deployment", "projectPath"])
        if (dep[key] !== undefined) string(dep[key], `deployment ${key}`);
      if (
        dep.projectPath !== undefined &&
        !isAbsolute(dep.projectPath as string)
      )
        throw new Error("Deployment projectPath must be absolute");
      if (dep.enabled !== undefined && typeof dep.enabled !== "boolean")
        throw new Error("Deployment enabled must be boolean");
    }
  }
  if (value.apps !== undefined) {
    object(value.apps, "apps");
    for (const [name, app] of Object.entries(value.apps)) {
      validateDeploymentName(name);
      object(app, "App");
      for (const key of ["type", "path", "projectPath"])
        string(app[key], `app ${key}`);
      if (!isAbsolute(app.projectPath as string))
        throw new Error("App projectPath must be absolute");
      if (typeof app.enabled !== "boolean")
        throw new Error("App enabled must be boolean");
      if (
        app.port !== undefined &&
        (!Number.isInteger(app.port) ||
          Number(app.port) < 1 ||
          Number(app.port) > 65535)
      )
        throw new Error("App port must be an integer from 1 to 65535");
      if (app.startCommand !== undefined)
        string(app.startCommand, "app startCommand");
    }
  }
}

export function validateDeploymentName(name: string): void {
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,254}$/.test(name) ||
    ["__proto__", "constructor", "prototype"].includes(name)
  )
    throw new Error(
      "Invalid deployment/app name; use letters, numbers, dots, underscores or hyphens",
    );
}

/** URLs are validated origins; spelling differences for the same origin retain credentials. */
function sameEndpoint(first: string, second: string): boolean {
  return new URL(first).origin === new URL(second).origin;
}

function mergeDeployment(
  inherited: DeploymentConfig | undefined,
  override: Partial<DeploymentConfig> | undefined,
): DeploymentConfig {
  const merged = { ...inherited, ...override } as DeploymentConfig;
  // Alias equality is insufficient to bind a deployment credential to an endpoint.
  if (
    inherited &&
    override?.url &&
    !sameEndpoint(inherited.url, override.url) &&
    !Object.hasOwn(override, "key")
  )
    delete merged.key;
  return merged;
}

/** A spread of the previous deployment is not an intentional new endpoint credential. */
function bindUpdatedCredential(
  previous: DeploymentConfig | undefined,
  updated: DeploymentConfig,
): DeploymentConfig {
  const bound = { ...updated };
  if (
    previous &&
    !sameEndpoint(previous.url, updated.url) &&
    updated.key === previous.key
  )
    delete bound.key;
  return bound;
}

function ownEntry<T>(
  map: Record<string, T> | undefined,
  name: string,
): T | undefined {
  return map && Object.hasOwn(map, name) ? map[name] : undefined;
}

function mergeConfig(target: CLIConfig, source: Partial<CLIConfig>): CLIConfig {
  return {
    ...target,
    ...source,
    deployments: Object.fromEntries(
      [
        ...new Set([
          ...Object.keys(target.deployments),
          ...Object.keys(source.deployments ?? {}),
        ]),
      ].map((name) => [
        name,
        mergeDeployment(
          getDeployment(target, name) ?? undefined,
          ownEntry(source.deployments, name),
        ),
      ]),
    ),
    ...(target.apps || source.apps
      ? { apps: { ...target.apps, ...source.apps } }
      : {}),
  };
}

/** Data-only composition retains the existing01 merge and writable-source provenance. */
export function composeDataConfig(data: DataSources): CLIConfig {
  let config = mergeConfig({ ...DEFAULT_CONFIG, deployments: {} }, data.user);
  let inherited = structuredClone(data.user);
  let source = data.project;
  config = mergeConfig(config, data.project);
  if (data.overlay) {
    inherited = structuredClone(config);
    source = data.overlay;
    config = mergeConfig(config, data.overlay);
  } else if (data.sourcePath === data.userPath) {
    source = data.user; inherited = {};
  }
  validateConfigShape(config);
  provenance.set(config, { sourcePath: data.sourcePath, source: structuredClone(source), merged: structuredClone(config), inherited });
  return config;
}

/** Atomic replacement prevents partial JSON and makes credentials private even for existing files. */
export async function atomicPrivateWrite(
  path: string,
  content: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(content, "utf-8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error: unknown) => {
      if (!isMissingFile(error)) throw error;
    });
  }
}

export async function saveUserConfig(config: CLIConfig): Promise<void> {
  if ((currentAdmissionContext() ?? contextForConfig(config))?.mode === "owned-data-only")
    throw new Error("ADMISSION_SAVE_SCOPE_UNSUPPORTED: use the admitted effective JSON source");
  validateConfigShape(config);
  await atomicPrivateWrite(
    getUserConfigPath(),
    JSON.stringify(config, null, 2),
  );
}
export async function saveProjectConfig(config: CLIConfig): Promise<void> {
  if ((currentAdmissionContext() ?? contextForConfig(config))?.mode === "owned-data-only")
    throw new Error("ADMISSION_SAVE_SCOPE_UNSUPPORTED: use the admitted effective JSON source");
  validateConfigShape(config);
  await atomicPrivateWrite(
    getProjectConfigPath(),
    JSON.stringify(config, null, 2),
  );
}

/** Config mutations persist to the active project JSON if present, otherwise the user file.
 * Refuse a non-JSON project source rather than creating a shadowed user setting.
 */
export async function saveEffectiveConfig(config: CLIConfig): Promise<void> {
  const context = currentAdmissionContext() ?? contextForConfig(config) ?? await discoverAdmission();
  if (context.mode === "owned-data-only") await recheckAdmission(context);
  validateConfigShape(config);
  const metadata =
    provenance.get(config) ?? provenance.get(await withAdmissionContext(context, () => loadConfig()))!;
  if (context.mode === "owned-data-only") {
    for (const session of context.registry.sessions) {
      const name = session.registeredAlias;
      if (name && JSON.stringify(metadata.merged.deployments[name]) !== JSON.stringify(config.deployments[name]))
        throw new Error("ADMISSION_OWNED_CONFIG_IMMUTABLE: release/discard owns registered bindings");
    }
  }
  if (
    !["cortex.config.json", ".cortexrc", ".cortexrc.json"].includes(
      metadata.sourcePath.split("/").pop() ?? "",
    )
  )
    throw new Error(
      "Active project config is not a writable JSON config; edit that source explicitly",
    );
  for (const [name, deployment] of Object.entries(config.deployments)) {
    config.deployments[name] = bindUpdatedCredential(
      getDeployment(metadata.merged, name) ?? undefined,
      deployment,
    );
  }
  const saved = structuredClone(metadata.source) as Record<string, unknown>;
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  for (const key of new Set([
    ...Object.keys(metadata.merged),
    ...Object.keys(config),
  ])) {
    const updatedValue = ownEntry(config, key);
    const originalValue = ownEntry(metadata.merged, key);
    if (same(updatedValue, originalValue)) continue;
    if (["deployments", "apps"].includes(key)) {
      const original = (originalValue ?? {}) as Record<
        string,
        Record<string, unknown>
      >;
      const updated = (updatedValue ?? {}) as Record<
        string,
        Record<string, unknown>
      >;
      const own = {
        ...((ownEntry(saved, key) as Record<string, Record<string, unknown>>) ??
          {}),
      };
      for (const name of new Set([
        ...Object.keys(original),
        ...Object.keys(updated),
      ])) {
        const updatedEntry = ownEntry(updated, name);
        const originalEntry = ownEntry(original, name);
        if (same(updatedEntry, originalEntry)) continue;
        if (!updatedEntry) {
          if (
            !Object.hasOwn(own, name) ||
            Object.hasOwn(metadata.inherited[key] ?? {}, name)
          )
            throw new Error(
              `Cannot remove inherited ${key} entry; edit its user configuration source explicitly`,
            );
          delete own[name];
          continue;
        }
        const fields = { ...ownEntry(own, name) };
        for (const field of new Set([
          ...Object.keys(originalEntry ?? {}),
          ...Object.keys(updatedEntry),
        ])) {
          const value = ownEntry(updatedEntry, field);
          if (same(value, ownEntry(originalEntry, field))) continue;
          if (value === undefined) delete fields[field];
          else fields[field] = value;
        }
        own[name] = fields;
      }
      saved[key] = own;
    } else if (updatedValue === undefined) delete saved[key];
    else saved[key] = updatedValue;
  }
  // User entries need complete URLs; project entries may override individual fields.
  validateConfigShape(saved, metadata.sourcePath !== getUserConfigPath());
  if (context.mode === "owned-data-only") await recheckAdmission(context);
  await atomicPrivateWrite(metadata.sourcePath, JSON.stringify(saved, null, 2));
  if (context.mode === "owned-data-only") await refreshAdmissionAfterSave(context);
  provenance.set(config, {
    sourcePath: metadata.sourcePath,
    source: saved,
    merged: structuredClone(config),
    inherited: metadata.inherited,
  });
}

/** Scope a use selection to the nearest project configuration, otherwise this directory. */
export async function getConfigScope(): Promise<string> {
  const context = currentAdmissionContext() ?? await discoverAdmission();
  if (context.mode === "owned-data-only") {
    await recheckAdmission(context);
    return context.data.scope;
  }
  const result = await nearestProjectConfig();
  return result && result.filepath !== getUserConfigPath()
    ? dirname(result.filepath)
    : process.cwd();
}

/**
 * Get a specific deployment configuration
 */
export function getDeployment(
  config: CLIConfig,
  name?: string,
): DeploymentConfig | null {
  const deploymentName = name ?? config.default;
  return ownEntry(config.deployments, deploymentName) ?? null;
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
  tenantId?: string;
  memorySpaceId?: string;
  tokenEnv?: string;
  tokenFile?: string;
} {
  validateConfigShape(config);
  const selected = options.deployment ?? currentAdmissionContext()?.selectedAlias ?? config.default;
  const candidate = selected ? getDeployment(config, selected) : undefined;
  if (candidate?.restoreRuntime !== undefined || candidate?.kind === "owned-restore" ||
      ((options.url || options.key) && Object.values(config.deployments).some(dep => dep.restoreRuntime !== undefined || dep.kind === "owned-restore")))
    throw new Error("RESTORE_RUNTIME_UNAVAILABLE: owned endpoints require later verified runtime proof");
  if (options.format !== undefined) validateOutputFormat(options.format);
  // CLI flags have highest priority
  if (options.url) {
    validateUrl(options.url);
    if (options.deployment)
      throw new Error("Use either --url or --deployment, not both");
    return {
      url: options.url,
      key: options.key,
      format: options.format ?? config.format,
      quiet: options.quiet ?? false,
      debug: options.debug ?? false,
      tenantId: options.tenantId,
      memorySpaceId: options.memorySpaceId,
      tokenEnv: options.tokenEnv,
      tokenFile: options.tokenFile,
    };
  }

  // Look up deployment from config
  const deploymentConfig = getDeployment(config, options.deployment);
  if (!deploymentConfig) {
    throw new Error(
      `Deployment "${options.deployment ?? config.default}" not found in configuration. ` +
        `Run 'cortex config add-deployment' to configure deployments.`,
    );
  }

  return {
    url: deploymentConfig.url,
    key: options.key ?? deploymentConfig.key,
    deployment: deploymentConfig.deployment,
    format: options.format ?? config.format,
    quiet: options.quiet ?? false,
    debug: options.debug ?? false,
    tenantId: options.tenantId ?? deploymentConfig.tenantId,
    memorySpaceId: options.memorySpaceId ?? deploymentConfig.memorySpaceId,
    tokenEnv: options.tokenEnv ?? deploymentConfig.tokenEnv,
    tokenFile: options.tokenFile ?? deploymentConfig.tokenFile,
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
  validateDeploymentName(name);
  const config = await loadConfig();
  config.deployments[name] = bindUpdatedCredential(
    getDeployment(config, name) ?? undefined,
    deployment,
  );

  if (saveToUser) {
    await saveEffectiveConfig(config);
  }

  return config;
}

/**
 * Set the default deployment
 */
export async function setDefaultDeployment(name: string): Promise<void> {
  validateDeploymentName(name);
  const config = await loadConfig();

  if (!getDeployment(config, name)) {
    throw new Error(`Deployment "${name}" not found`);
  }

  config.default = name;
  await saveEffectiveConfig(config);
}

/**
 * Set a configuration value
 */
export async function setConfigValue(
  key: string,
  value: string,
  options: GlobalOptions = {},
): Promise<void> {
  const targeted = ["convex-url", "convex-key"].includes(key);
  if (!targeted && options.deployment !== undefined)
    throw new Error(
      `Global config setting "${key}" does not support --deployment; omit -d`,
    );
  if (options.deployment !== undefined)
    validateDeploymentName(options.deployment);
  const config = await loadConfig();
  const selected = targeted
    ? (await selectDeployment(config, { ...options, quiet: true }))!
    : undefined;

  switch (key) {
    case "default":
      validateDeploymentName(value);
      if (!getDeployment(config, value)) {
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
      if (!["true", "false"].includes(value))
        throw new Error("confirmDangerous must be true or false");
      config.confirmDangerous = value === "true";
      break;
    case "convex-url": {
      validateUrl(value);
      serializeEnvAssignment("CORTEX_CONVEX_URL", value);
      const updated = bindUpdatedCredential(selected!.deployment, {
        ...selected!.deployment,
        url: value,
      });
      if (updated.key !== undefined)
        serializeEnvAssignment("CORTEX_DEPLOY_KEY", updated.key);
      config.deployments[selected!.name] = updated;
      break;
    }
    case "convex-key":
      validateFilePath(value);
      serializeEnvAssignment("CORTEX_DEPLOY_KEY", value);
      config.deployments[selected!.name] = {
        ...selected!.deployment,
        key: value,
      };
      break;
    case "token-env":
    case "token-file":
    case "tenant-id":
    case "memory-space-id": {
      const deployment = config.deployments[config.default];
      if (!deployment) throw new Error("Select a configured deployment before setting credential locations or scope selectors.");
      if (!value || value.trim() !== value || /[\r\n\0]/.test(value) || value.length > 4096 || key === "token-env" && !/^[A-Z_][A-Z0-9_]*$/.test(value)) throw new Error("Set a valid credential location or scope selector, never a JWT/provider key.");
      if (key === "token-env") { deployment.tokenEnv = value; delete deployment.tokenFile; }
      else if (key === "token-file") {
        const { credentialSource } = await import("./host-auth.js");
        await credentialSource({ tokenFile: value })({ forceRefreshToken: true });
        deployment.tokenFile = resolvePath(value); delete deployment.tokenEnv;
      }
      else if (key === "tenant-id") deployment.tenantId = value;
      else deployment.memorySpaceId = value;
      break;
    }
    default:
      throw new Error(`Unknown config key: ${key}`);
  }

  await saveEffectiveConfig(config);
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
      while (
        (config.apps && Object.hasOwn(config.apps, name)) ||
        discovered.some((d) => d.name === name)
      ) {
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
        while (
          (config.apps && Object.hasOwn(config.apps, name)) ||
          discovered.some((d) => d.name === name)
        ) {
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
  validateDeploymentName(app.name);
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

  await saveEffectiveConfig(config);
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
 * for diagnostics only. Returns false for transient errors
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
  config: CLIConfig,
  name: string,
  timeout: number,
): Promise<ConvexCheckResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let client: Awaited<ReturnType<typeof createClient>> | undefined;
  try {
    client = await createClient(config, { deployment: name, graphSync: "off" });
    await Promise.race([
      client.memorySpaces.list({ limit: 1 }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Operation timed out")),
          timeout,
        );
      }),
    ]);
    return { status: "ok" };
  } catch (error) {
    // Diagnostics carry classifications, never server text which could include credentials.
    if (getErrorMessage(error) === "Operation timed out")
      return { status: "timeout" };
    return isAuthError(error)
      ? {
          status: "auth_error",
          message:
            "Authentication/access failed; check deployment credentials and tenant access separately",
        }
      : {
          status: "network_error",
          message: "Connection failed; configuration retained",
        };
  } finally {
    clearTimeout(timeoutId);
    if (client) await disposeClient(client);
  }
}

/** Compatibility name: validation is strictly observational and never cleans or saves. */
export async function validateAndCleanConfig(
  config: CLIConfig,
  options?: ValidationOptions,
): Promise<ValidationResult> {
  validateConfigShape(config);
  const timeout = options?.timeout ?? 3000;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000)
    throw new Error("Validation timeout must be an integer from 1 to 60000 ms");
  const result: ValidationResult = {
    config,
    modified: false,
    removed: { deployments: [], apps: [] },
    diagnostics: [],
  };
  for (const [name, deployment] of Object.entries(config.deployments)) {
    if (deployment.projectPath && !existsSync(deployment.projectPath))
      result.diagnostics.push({
        name,
        kind: "stale_path",
        message: "Project path is missing; configuration retained",
      });
    if (options?.checkConvex ?? true) {
      const check = await checkConvexUrl(config, name, timeout);
      if (check.status !== "ok")
        result.diagnostics.push({
          name,
          kind: check.status,
          message: "Connectivity/access check failed; configuration retained",
        });
    }
  }
  for (const [name, app] of Object.entries(config.apps ?? {})) {
    if (!existsSync(join(app.projectPath, app.path)))
      result.diagnostics.push({
        name,
        kind: "stale_path",
        message: "App path is missing; configuration retained",
      });
  }
  return result;
}

/**
 * Load configuration and report validation without modifying entries
 *
 * Combines loadConfig() with validateAndCleanConfig() for a single
 * function that returns the original configuration after observational validation.
 *
 * @param options - Validation options
 * @returns The original configuration
 */
export async function loadConfigWithValidation(
  options?: ValidationOptions,
): Promise<CLIConfig> {
  const config = await loadConfig();
  const result = await validateAndCleanConfig(config, options);
  return result.config;
}
