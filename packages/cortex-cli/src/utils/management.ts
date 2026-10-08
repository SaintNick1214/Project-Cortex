/** Fixed native management actions: selected project, endpoint and credential authority. */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";
import type { Command } from "commander";
import type { CLIConfig, GlobalOptions } from "../types.js";
import { validateConfigShape, resolveConfig } from "./config.js";
import { validateUrl } from "./validation.js";
import {
  applyBackendPlan,
  assertSafePath,
  findInstalledSdk,
  getFunctionsDirectory,
  planBackendSync,
  resolveProjectDirectory,
  SDK_VERSION,
  validateSdkPackage,
} from "./schema-sync.js";
import { CONVEX_VERSION, validateNpmProject } from "./install.js";
import {
  nativeEnvironment,
  propagateNativeResult,
  resolveInstalledConvex,
  runConvex,
  runNpmInstall,
  type NativeResult,
} from "./convex-runner.js";
import {
  acquireForegroundSignalHandler,
  setupClientCleanup,
} from "./client.js";
import type { ReadableStreamDefaultReader } from "node:stream/web";

export interface ManagementOptions extends GlobalOptions {
  project?: string;
  envFile?: string;
  local?: boolean;
  prod?: boolean;
  yes?: boolean;
  push?: boolean;
  skipSync?: boolean;
  sync?: boolean;
  once?: boolean;
  dryRun?: boolean;
  sdkVersion?: string;
  convexVersion?: string;
  sdkPackage?: string;
}
export interface NativeTarget {
  alias: string;
  project: string;
  url: string;
  key: string;
  kind: "local" | "dev" | "prod";
  deployment: string;
  bin: string;
  env: Record<string, string | undefined>;
  backendVersion?: string;
}
export function targetOptions(command: Command): Command {
  // Baseline short options belong to these paths, not every native leaf. In
  // particular convex env owns -l for --list, while start owns -f for foreground.
  const names: string[] = [];
  for (let node: Command | null = command; node?.parent; node = node.parent)
    names.unshift(node.name());
  const commandPath = names.join(" ");
  const localShort = [
    "start",
    "dev",
    "deploy",
    "convex deploy",
    "convex dev",
    "convex logs",
    "convex dashboard",
  ].includes(commandPath);
  const prodShort = [
    "deploy",
    "convex deploy",
    "convex logs",
    "convex dashboard",
    "convex env",
  ].includes(commandPath);
  return command
    .option("-d, --deployment <name>", "Explicit configured deployment alias")
    .option("--project <directory>", "Selected project directory")
    .option(
      "--env-file <file>",
      "Selected project's deployment credential file",
    )
    .option(
      localShort ? "-l, --local" : "--local",
      "Assert the selected target is local",
    )
    .option(
      prodShort ? "-p, --prod" : "--prod",
      "Explicit production intent; must match selected target",
    );
}
export function resolveNativeTarget(
  config: CLIConfig,
  options: ManagementOptions,
  mutation = false,
): NativeTarget {
  validateConfigShape(config);
  if (options.project) {
    const project = resolveProjectDirectory(options.project);
    const source = assertSafePath(project, "cortex.config.json");
    if (fs.existsSync(source)) {
      let value: unknown;
      try {
        value = JSON.parse(fs.readFileSync(source, "utf8"));
        validateConfigShape(value);
      } catch {
        throw new Error("Invalid selected project Cortex configuration");
      }
      config = {
        ...config,
        ...value,
        deployments: { ...config.deployments, ...value.deployments },
      };
    }
  }
  const alias = options.deployment ?? config.default;
  if (Object.keys(config.deployments).length === 0)
    throw new Error(
      "No deployments configured; configure an explicit native target first",
    );
  if (mutation && !options.deployment)
    throw new Error(
      "Native mutation requires explicit --deployment <configured alias>",
    );
  const dep = Object.hasOwn(config.deployments, alias)
    ? config.deployments[alias]
    : undefined;
  if (!dep) throw new Error("Select a configured deployment with --deployment");
  if (!dep.projectPath && !options.project)
    throw new Error(
      "Native management requires a declared projectPath or --project",
    );
  const project = resolveProjectDirectory(options.project ?? dep.projectPath!);
  if (dep.projectPath && resolveProjectDirectory(dep.projectPath) !== project)
    throw new Error(
      "Selected deployment belongs to another project; correct its projectPath explicitly",
    );
  if (!fs.existsSync(project))
    throw new Error("Selected project does not exist");
  const url = resolveConfig(config, { deployment: alias }).url;
  validateUrl(url);
  const origin = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (local && origin.protocol !== "http:")
    throw new Error("Native local target must use HTTP loopback");
  const envFile = options.envFile
    ? path.resolve(project, options.envFile)
    : path.join(project, ".env.local");
  const relative = path.relative(project, envFile);
  assertSafePath(project, relative);
  let environment: Record<string, string> = {};
  if (fs.existsSync(envFile)) environment = parse(fs.readFileSync(envFile));
  else if (options.envFile)
    throw new Error("Selected environment file does not exist");
  const deployment = dep.deployment ?? environment.CONVEX_DEPLOYMENT;
  let key =
    dep.key ??
    environment.CONVEX_SELF_HOSTED_ADMIN_KEY ??
    environment.CONVEX_DEPLOY_KEY;
  const kind = local
    ? "local"
    : deployment?.startsWith("prod:")
      ? "prod"
      : deployment?.startsWith("dev:")
        ? "dev"
        : undefined;
  if (!kind)
    throw new Error(
      "Remote native targets require a declared dev: or prod: deployment identity",
    );
  if (options.local && !local)
    throw new Error("--local conflicts with selected remote target");
  if (options.prod && kind !== "prod")
    throw new Error("--prod conflicts with selected non-production target");
  if (mutation && kind === "prod" && !options.prod)
    throw new Error(
      "Production mutation requires --prod and the explicit selected production target",
    );
  if (local) {
    const statePath = assertSafePath(
      project,
      ".convex/local/default/config.json",
    );
    if (!fs.existsSync(statePath))
      throw new Error(
        "No verified project-local deployment; configure native Convex locally first",
      );
    let state: {
      deploymentName?: string;
      adminKey?: string;
      ports?: { cloud?: number };
      backendVersion?: string;
    };
    try {
      state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch {
      throw new Error("Invalid native project-local state");
    }
    if (
      !state.deploymentName ||
      !state.adminKey ||
      !Number.isInteger(state.ports?.cloud) ||
      Number(origin.port || "80") !== state.ports?.cloud ||
      (deployment &&
        deployment.replace(/^(local|dev):/, "") !== state.deploymentName) ||
      (key && key !== state.adminKey)
    )
      throw new Error(
        "Selected URL/key/deployment does not match native project-local authority",
      );
    key = state.adminKey;
    if (
      environment.CONVEX_DEPLOYMENT &&
      environment.CONVEX_DEPLOYMENT.replace(/^(local|dev|anonymous):/, "") !==
        state.deploymentName
    )
      throw new Error(
        "Selected environment identity does not match verified project-local deployment",
      );
    if (
      environment.CONVEX_SELF_HOSTED_URL &&
      new URL(environment.CONVEX_SELF_HOSTED_URL).origin !== origin.origin
    )
      throw new Error(
        "Selected environment endpoint does not match verified project-local deployment",
      );
    if (
      environment.CONVEX_URL &&
      new URL(environment.CONVEX_URL).origin !== origin.origin
    )
      throw new Error(
        "Selected environment client URL does not match verified project-local deployment",
      );
    const fileKey =
      environment.CONVEX_SELF_HOSTED_ADMIN_KEY || environment.CONVEX_DEPLOY_KEY;
    if (fileKey && fileKey !== state.adminKey)
      throw new Error(
        "Selected environment credentials do not match verified project-local deployment",
      );
    return {
      alias,
      project,
      url: origin.origin,
      key,
      kind,
      deployment: `local:${state.deploymentName}`,
      bin: resolveInstalledConvex(project),
      env: {
        CONVEX_DEPLOYMENT: `local:${state.deploymentName}`,
        ...(state.deploymentName.startsWith("anonymous-")
          ? { CONVEX_AGENT_MODE: "anonymous" }
          : {}),
      },
      backendVersion: state.backendVersion,
    };
  }
  if (!key)
    throw new Error("Selected remote native target requires a deployment key");
  const expected = `${deployment}|`;
  if (!key.startsWith(expected))
    throw new Error("Deployment key does not match selected dev/prod identity");
  if (
    origin.hostname.endsWith(".convex.cloud") &&
    origin.hostname !== `${deployment!.split(":")[1]}.convex.cloud`
  )
    throw new Error("Selected cloud URL does not match deployment identity");
  return {
    alias,
    project,
    url: origin.origin,
    key,
    kind,
    deployment: deployment!,
    bin: resolveInstalledConvex(project),
    env: {},
  };
}
/** URL/admin-key env selection wins over all inherited/file selectors without secret argv. */
export function directTargetEnvironment(
  target: NativeTarget,
): Record<string, string | undefined> {
  return {
    CONVEX_SELF_HOSTED_URL: target.url,
    CONVEX_SELF_HOSTED_ADMIN_KEY: target.key,
  };
}
export async function nativeOperation(
  target: NativeTarget,
  argv: string[],
  capture = false,
  timeoutMs = 120000,
): Promise<NativeResult> {
  return await runConvex(target.project, argv, {
    env: directTargetEnvironment(target),
    secrets: [target.key],
    capture,
    timeoutMs,
  });
}
export function backendPlan(
  target: NativeTarget,
  options: ManagementOptions,
): ReturnType<typeof planBackendSync> | undefined {
  if (options.skipSync && options.sync)
    throw new Error("--sync and --skip-sync are mutually exclusive");
  if (!options.sync) return;
  const plan = planBackendSync(
    target.project,
    findInstalledSdk(target.project),
  );
  if (plan.conflicts.length)
    throw new Error(
      `Backend sync conflicts: ${plan.conflicts.join(", ")}; inspect cortex schema sync --dry-run`,
    );
  return plan;
}
export async function develop(
  config: CLIConfig,
  options: ManagementOptions,
): Promise<void> {
  const target = resolveNativeTarget(config, options, true);
  if (target.kind === "prod")
    throw new Error(
      "Use explicit deploy --prod for production; foreground dev is local/development only",
    );
  const plan = backendPlan(target, options);
  if (plan) applyBackendPlan(plan);
  const selectionEnv =
    target.kind === "local"
      ? target.env
      : { CONVEX_DEPLOY_KEY: target.key, CONVEX_DEPLOYMENT: target.deployment };
  // Native 1.46's select local requires cloud project lookup even for anonymous
  // deployments. Verified anonymous state uses its supported explicit env selection.
  if (target.env.CONVEX_AGENT_MODE !== "anonymous") {
    const selection = await runConvex(
      target.project,
      [
        "deployment",
        "select",
        target.kind === "local" ? "local" : target.deployment.split(":")[1],
      ],
      { env: selectionEnv, secrets: [target.key], timeoutMs: 60000 },
    );
    if (!propagateNativeResult(selection)) return;
  }
  const result = await runConvex(
    target.project,
    ["dev", ...(options.once ? ["--once"] : [])],
    {
      env: selectionEnv,
      secrets: [target.key],
      timeoutMs: options.once ? 120000 : 0,
    },
  );
  propagateNativeResult(result);
}
export async function deploy(
  config: CLIConfig,
  options: ManagementOptions,
): Promise<void> {
  const target = resolveNativeTarget(config, options, true);
  const plan = backendPlan(target, options);
  if (options.dryRun && target.kind !== "prod") {
    console.log(
      JSON.stringify({
        projectPath: target.project,
        alias: target.alias,
        url: target.url,
        action: "dev --once",
        dryRun: true,
        backendSync: plan
          ? { additions: plan.additions, updates: plan.updates }
          : "not requested",
        writes: [],
      }),
    );
    return;
  }
  if (target.kind === "prod") {
    if (!options.dryRun && !options.yes && !options.push)
      throw new Error("Production deploy requires --yes (or --push)");
    if (plan && !options.dryRun) applyBackendPlan(plan);
    // Native deploy selects the exact supplied endpoint, never its implicit prod default.
    propagateNativeResult(
      await nativeOperation(target, [
        "deploy",
        "--yes",
        ...(options.dryRun ? ["--dry-run"] : []),
      ]),
    );
  } else await develop(config, { ...options, once: true });
}
export async function updatePackages(
  config: CLIConfig,
  options: ManagementOptions,
): Promise<void> {
  const target = resolveNativeTarget(config, options);
  const manifest = validateNpmProject(target.project);
  if (options.sync && options.skipSync)
    throw new Error("--sync and --skip-sync are mutually exclusive");
  if (!options.sdkVersion && !options.convexVersion)
    options = {
      ...options,
      sdkVersion: SDK_VERSION,
      convexVersion: CONVEX_VERSION,
    };
  if (
    (options.sdkVersion && options.sdkVersion !== SDK_VERSION) ||
    (options.convexVersion && options.convexVersion !== CONVEX_VERSION)
  )
    throw new Error(
      `This compatibility baseline supports SDK ${SDK_VERSION} and Convex ${CONVEX_VERSION}; choose exact versions`,
    );
  if (options.sdkPackage && !options.sdkVersion)
    throw new Error("--sdk-package requires explicit --sdk-version");
  if (options.sync && !options.sdkVersion)
    throw new Error("SDK backend sync requires an SDK dependency selection");
  const dryRun = Boolean(options.dryRun || !options.yes);
  const source = options.sdkVersion
    ? updateSource(target.project, options, dryRun)
    : undefined;
  try {
    const specs = [
      options.sdkVersion && `@cortexmemory/sdk@${source!.spec}`,
      options.convexVersion && `convex@${options.convexVersion}`,
    ].filter((spec): spec is string => Boolean(spec));
    const plan = options.sync
      ? planBackendSync(target.project, source!.directory)
      : undefined;
    if (plan?.conflicts.length)
      throw new Error(
        `Backend sync conflicts: ${plan.conflicts.join(", ")}; use schema sync --dry-run`,
      );
    const result = {
      projectPath: target.project,
      packageManager: "npm",
      requested: {
        sdk: options.sdkVersion ?? null,
        convex: options.convexVersion ?? null,
      },
      packages: specs,
      dryRun,
      backendSync: plan
        ? { additions: plan.additions, updates: plan.updates }
        : "not requested",
      applyRequires: dryRun ? "--yes" : null,
      preservedScripts: manifest.scripts ?? null,
    };
    if (dryRun) {
      console.log(JSON.stringify(result));
      return;
    }
    const install = await runNpmInstall(target.project, specs, {
      capture: true,
    });
    if (!propagateNativeResult(install)) return;
    if (options.sdkVersion)
      validateSdkPackage(findInstalledSdk(target.project));
    if (options.convexVersion) resolveInstalledConvex(target.project);
    if (plan) applyBackendPlan(plan);
    console.log(JSON.stringify({ ...result, applied: true }));
  } finally {
    source?.cleanup();
  }
}
function updateSource(
  project: string,
  options: ManagementOptions,
  dryRun: boolean,
): { directory: string; spec: string; cleanup: () => void } {
  const supplied = options.sdkPackage && path.resolve(options.sdkPackage);
  if (
    supplied &&
    (!fs.existsSync(supplied) || fs.lstatSync(supplied).isSymbolicLink())
  )
    throw new Error(
      "--sdk-package must be a regular package directory or tarball",
    );
  if (supplied && fs.statSync(supplied).isDirectory()) {
    validateSdkPackage(supplied);
    return { directory: supplied, spec: `file:${supplied}`, cleanup: () => {} };
  }
  if (!supplied && dryRun) {
    const directory = findInstalledSdk(project);
    validateSdkPackage(directory);
    return { directory, spec: SDK_VERSION, cleanup: () => {} };
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-update-source-"));
  const cleanup = () => fs.rmSync(temp, { recursive: true, force: true });
  try {
    let tarball = supplied;
    if (!tarball) {
      try {
        const packed = execFileSync(
          "npm",
          [
            "pack",
            `@cortexmemory/sdk@${SDK_VERSION}`,
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            temp,
          ],
          {
            cwd: temp,
            env: nativeEnvironment(),
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 60000,
          },
        );
        tarball = path.join(temp, JSON.parse(packed)[0].filename);
      } catch {
        throw new Error(
          `SDK ${SDK_VERSION} registry release unavailable; provide --sdk-package <fixed candidate>. No older SDK fallback.`,
        );
      }
    }
    const entries = execFileSync("tar", ["-tzf", tarball], {
      encoding: "utf8",
      timeout: 10000,
    })
      .trim()
      .split("\n");
    if (
      entries.some(
        (entry) =>
          !entry.startsWith("package/") ||
          entry.split("/").includes("..") ||
          entry.includes("\\"),
      )
    )
      throw new Error("Unsafe SDK archive path");
    const listing = execFileSync("tar", ["-tvzf", tarball], {
      encoding: "utf8",
      timeout: 10000,
    })
      .trim()
      .split("\n");
    if (listing.some((entry) => !["-", "d"].includes(entry[0])))
      throw new Error("SDK archive links/special files refused");
    execFileSync("tar", ["-xzf", tarball, "-C", temp], {
      stdio: "pipe",
      timeout: 10000,
    });
    const directory = path.join(temp, "package");
    validateSdkPackage(directory);
    return {
      directory,
      spec: supplied ? `file:${supplied}` : SDK_VERSION,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
export function retired(message: string): never {
  throw new Error(message);
}
export function inspectSnapshot(file: string): string[] {
  const absolute = path.resolve(file);
  if (!absolute.toLowerCase().endsWith(".zip"))
    throw new Error(
      "Native snapshots require .zip; legacy JSON backups are incomplete and unsupported",
    );
  if (
    !fs.existsSync(absolute) ||
    fs.lstatSync(absolute).isSymbolicLink() ||
    !fs.statSync(absolute).isFile()
  )
    throw new Error("Snapshot must be an existing regular ZIP file");
  let listing: string;
  try {
    listing = execFileSync("unzip", ["-Z1", absolute], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 10000,
    });
  } catch {
    throw new Error("Snapshot ZIP directory cannot be verified");
  }
  const entries = listing.trim().split("\n");
  if (
    !entries.length ||
    entries.some(
      (entry) =>
        entry.startsWith("/") ||
        entry.includes("\\") ||
        entry.split("/").includes(".."),
    )
  )
    throw new Error("Unsafe snapshot ZIP directory");
  if (!entries.some((entry) => entry.endsWith("/documents.jsonl")))
    throw new Error("ZIP is not a native Convex snapshot");
  return entries;
}
const lifecycleTables = [
  "cortexErasureReceipts",
  "cortexReferenceTargets",
  "cortexReferenceEdges",
  "cortexReferenceState",
  "runtimeAuthPrincipals",
  "runtimeAuthMemberships",
  "runtimeAuthScopes",
  "runtimeAuthGrants",
  "runtimeAuthTombstones",
  "runtimeMemorySources",
  "runtimeMemoryChunks",
  "runtimeMemoryVectors",
  "runtimeMemoryReceipts",
  "runtimeModelPolicies",
  "runtimeModelQualifications",
  "runtimeBudgetAccounts",
  "runtimeModelOperations",
  "runtimeModelAttempts",
];
// Current schemas compose protected tables by imported spread, not inline names.
const lifecycleSchemaMarkers = [...lifecycleTables, "runtimeAuthTables", "runtimeMemoryTables", "runtimePolicyTables"];
export async function importSnapshot(
  config: CLIConfig,
  file: string,
  options: ManagementOptions & {
    append?: boolean;
    replace?: boolean;
    replaceAll?: boolean;
  },
): Promise<void> {
  const entries = inspectSnapshot(file);
  const target = resolveNativeTarget(config, options, true);
  if (options.dryRun)
    throw new Error(
      "Native import has no dry-run; inspect the ZIP offline, then choose an explicit import mode",
    );
  const modes = [
    options.append && "--append",
    options.replace && "--replace",
    options.replaceAll && "--replace-all",
  ].filter((mode): mode is string => Boolean(mode));
  if (modes.length !== 1)
    throw new Error(
      "Choose exactly one import mode: --append, --replace or --replace-all",
    );
  if (!options.yes)
    throw new Error("Snapshot import requires --yes and explicit target/mode");
  const functions = getFunctionsDirectory(target.project);
  const schema = assertSafePath(target.project, `${functions}/schema.ts`);
  if (
    entries.some((entry) =>
      lifecycleTables.some((table) => entry.split("/").includes(table)),
    ) ||
    (fs.existsSync(schema) &&
      lifecycleSchemaMarkers.some((table) =>
        fs.readFileSync(schema, "utf8").includes(table),
      ))
  )
    throw new Error(
      "Protected reference/runtime lifecycle snapshot import requires a surviving writer barrier and post-import schema migrate/audit; this CLI refuses until that fixed protocol is supported",
    );
  // Check the actual deployed table set too: installed source alone cannot certify it.
  const tables = await nativeOperation(target, ["data"], true);
  if (!propagateNativeResult(tables)) return;
  if (
    lifecycleTables.some((table) =>
      tables.stdout.split(/\r?\n/).includes(table),
    )
  )
    throw new Error(
      "Deployed reference lifecycle or protected runtime detected; native import refused without the supported barrier/rebuild protocol",
    );
  console.error(
    "Native snapshot import: full deployment tables; file storage only if included. Reference lifecycle protection unavailable on this older backend.",
  );
  propagateNativeResult(
    await nativeOperation(target, [
      "import",
      path.resolve(file),
      ...modes,
      "--yes",
    ]),
  );
}
export async function exportSnapshot(
  config: CLIConfig,
  options: ManagementOptions & {
    output?: string;
    includeFileStorage?: boolean;
  },
): Promise<void> {
  const output = path.resolve(options.output ?? "snapshot.zip");
  if (!output.toLowerCase().endsWith(".zip"))
    throw new Error(
      "Use --output snapshot.zip; legacy JSON exports are unsupported",
    );
  if (fs.existsSync(output))
    throw new Error("Snapshot output must not already exist");
  const target = resolveNativeTarget(config, options);
  console.error(
    `Native snapshot: all deployment tables; file storage ${options.includeFileStorage ? "included" : "excluded (use --include-file-storage)"}. External graph data is excluded.`,
  );
  propagateNativeResult(
    await nativeOperation(target, [
      "export",
      "--path",
      output,
      ...(options.includeFileStorage ? ["--include-file-storage"] : []),
    ]),
  );
}

/** Internal deployment-admin protocol adapter tested with native 1.46, not a public SDK API. */
export interface NativeLogLine {
  messages: string[];
  level: string;
  timestamp: number;
  isTruncated: boolean;
  [key: string]: unknown;
}
export interface NativeLogEvent {
  kind: "Completion" | "Progress";
  udfType: string;
  identifier: string;
  timestamp: number;
  logLines: NativeLogLine[];
  requestId: string;
  executionId: string;
  error?: string | null;
  [key: string]: unknown;
}
export interface FiniteLogChunk {
  formatVersion: 1;
  coverage: "available-native-log-chunk";
  requested: number;
  returned: number;
  newCursor: number;
  entries: NativeLogEvent[];
}
const LOG_BODY_LIMIT = 8 * 1024 * 1024;
const LOG_OUTPUT_LIMIT = 8 * 1024 * 1024;
function logObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function logNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function optionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}
export function validateNativeLogPayload(value: unknown): {
  entries: NativeLogEvent[];
  newCursor: number;
} {
  const invalid = (): never => {
    throw new Error(
      "Unsupported native log protocol; verify the tested Convex 1.46 backend capability",
    );
  };
  // Bounded additive fields; never recursively amplify untrusted arbitrary Value content.
  const pending: Array<{ value: unknown; depth: number }> = [
    { value, depth: 0 },
  ];
  let nodes = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++nodes > 100000 || item.depth > 16) invalid();
    if (typeof item.value === "object" && item.value !== null)
      for (const child of Object.values(item.value))
        pending.push({ value: child, depth: item.depth + 1 });
  }
  if (!logObject(value)) return invalid();
  if (
    !Array.isArray(value.entries) ||
    !logNumber(value.newCursor) ||
    value.entries.length > 10000
  )
    return invalid();
  for (const raw of value.entries) {
    if (
      !logObject(raw) ||
      !["Completion", "Progress"].includes(String(raw.kind)) ||
      !["Query", "Mutation", "Action", "HttpAction"].includes(
        String(raw.udfType),
      ) ||
      !["identifier", "requestId", "executionId"].every(
        (field) => typeof raw[field] === "string",
      ) ||
      !logNumber(raw.timestamp) ||
      !Array.isArray(raw.logLines) ||
      !optionalString(raw.componentPath)
    )
      invalid();
    for (const line of raw.logLines) {
      if (
        !logObject(line) ||
        !Array.isArray(line.messages) ||
        !line.messages.every((message) => typeof message === "string") ||
        !["LOG", "DEBUG", "INFO", "WARN", "ERROR"].includes(
          String(line.level),
        ) ||
        !logNumber(line.timestamp) ||
        typeof line.isTruncated !== "boolean" ||
        !optionalString(line.componentPath) ||
        !optionalString(line.udfPath) ||
        (line.systemMetadata !== undefined &&
          line.systemMetadata !== null &&
          (!logObject(line.systemMetadata) ||
            typeof line.systemMetadata.code !== "string"))
      )
        invalid();
    }
    if (raw.kind === "Completion") {
      if (
        !["cachedResult", "willRetry"].every(
          (field) => typeof raw[field] === "boolean",
        ) ||
        !["caller", "identityType", "environment"].every(
          (field) => typeof raw[field] === "string",
        ) ||
        !logNumber(raw.executionTime) ||
        !logNumber(raw.executionTimestamp) ||
        !optionalString(raw.parentExecutionId) ||
        !optionalString(raw.error) ||
        !logObject(raw.usageStats)
      )
        invalid();
      for (const field of ["userExecutionTime", "returnBytes"])
        if (
          raw[field] !== undefined &&
          raw[field] !== null &&
          !logNumber(raw[field])
        )
          invalid();
      for (const field of [
        "databaseReadBytes",
        "databaseWriteBytes",
        "databaseIoReadBytes",
        "databaseIoWriteBytes",
        "databaseReadDocuments",
        "databaseWriteDocuments",
        "databaseWriteIndexRows",
        "storageReadBytes",
        "storageWriteBytes",
        "vectorIndexReadBytes",
        "vectorIndexWriteBytes",
        "textIndexQueryBytes",
        "textIndexWriteQueryBytes",
        "vectorIndexReadQueryBytes",
        "vectorIndexWriteQueryBytes",
        "networkEgressBytes",
        "memoryUsedMb",
      ])
        if (!logNumber(raw.usageStats[field])) invalid();
      if (raw.occInfo !== undefined && raw.occInfo !== null) {
        if (!logObject(raw.occInfo)) invalid();
        for (const field of [
          "tableName",
          "documentId",
          "writeSource",
          "componentPath",
        ])
          if (!optionalString(raw.occInfo[field])) invalid();
        if (
          raw.occInfo.retryCount !== undefined &&
          raw.occInfo.retryCount !== null &&
          !logNumber(raw.occInfo.retryCount)
        )
          invalid();
      }
    }
  }
  return value as unknown as { entries: NativeLogEvent[]; newCursor: number };
}
export async function readFiniteLogs(
  target: NativeTarget,
  lines = 50,
): Promise<FiniteLogChunk> {
  if (!Number.isSafeInteger(lines) || lines < 1 || lines > 1000)
    throw new Error("--lines must be an integer from 1 to 1000");
  // Reverify installed capability immediately before the fixed read; no private code imports.
  resolveInstalledConvex(target.project);
  if (!target.key)
    throw new Error(
      "Selected administration key is required for finite native logs",
    );
  const controller = new AbortController();
  let signalCode: number | undefined;
  let drain: () => void = () => {};
  const drained = new Promise<void>((resolve) => {
    drain = resolve;
  });
  setupClientCleanup();
  const release = acquireForegroundSignalHandler(async (signal) => {
    signalCode ??= signal === "SIGINT" ? 130 : 143;
    controller.abort();
    await drained;
  });
  // Pinned native backends can legitimately long-poll an empty chunk for 60 seconds.
  const timer = setTimeout(() => controller.abort(), 70000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(
      `${target.url}/api/stream_function_logs?cursor=0`,
      {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Authorization: `Convex ${target.key}`,
          "Content-Type": "application/json",
          "Convex-Client": "npm-cli-1.46.0",
        },
      },
    );
    if (!response.ok)
      throw new Error(
        `Native log read failed (HTTP ${response.status}); verify selected administration credentials/capability`,
      );
    if (
      !/^application\/json(?:\s*;|$)/i.test(
        response.headers.get("content-type") ?? "",
      )
    )
      throw new Error("Unsupported native log response content type");
    if (!response.body) throw new Error("Missing native log response body");
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > LOG_BODY_LIMIT) {
        controller.abort();
        throw new Error("Native log chunk exceeds 8 MiB response limit");
      }
      chunks.push(part.value);
    }
    let raw: unknown;
    try {
      raw = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      );
    } catch {
      throw new Error("Malformed native log JSON response");
    }
    const payload = validateNativeLogPayload(raw);
    const selected = payload.entries.slice(-lines);
    const clean = (value: unknown): unknown => {
      if (typeof value === "string") return value.split(target.key).join("***");
      if (Array.isArray(value)) return value.map(clean);
      if (logObject(value))
        return Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, clean(item)]),
        );
      return value;
    };
    const entries = clean(selected) as NativeLogEvent[];
    const result: FiniteLogChunk = {
      formatVersion: 1,
      coverage: "available-native-log-chunk",
      requested: lines,
      returned: entries.length,
      newCursor: payload.newCursor,
      entries,
    };
    if (Buffer.byteLength(JSON.stringify(result)) > LOG_OUTPUT_LIMIT)
      throw new Error("Native logs exceed 8 MiB whole-event output budget");
    return result;
  } catch (error) {
    if (signalCode !== undefined) {
      process.exitCode = signalCode;
      throw new Error("Native log read interrupted", { cause: error });
    }
    if (controller.signal.aborted)
      throw new Error(
        "Native log read aborted or timed out; no history result was produced",
        { cause: error },
      );
    if (
      error instanceof Error &&
      /^(Native log|Unsupported native|Missing native|Malformed native)/.test(
        error.message,
      )
    )
      throw error;
    throw new Error(
      "Native log request failed; verify selected target and tested backend capability (redirects are refused)",
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    release();
    drain();
  }
}
/** Fixed field labels keep table layout from amplifying one wide value across every row. */
function* logMessageParts(
  entry: NativeLogEvent,
  success: boolean,
): Generator<string> {
  let first = true;
  for (const message of [
    ...entry.logLines.flatMap((line) => line.messages),
    ...(entry.error ? [String(entry.error)] : []),
    ...(success && entry.kind === "Completion" && !entry.error
      ? ["Function execution succeeded"]
      : []),
  ]) {
    if (!first) yield "\n";
    first = false;
    yield message;
  }
}
function logProjection(
  entry: NativeLogEvent,
  success: boolean,
): Array<[string, Iterable<string>]> {
  return [
    ["kind", [entry.kind]],
    ["function", [entry.identifier]],
    [
      "outcome",
      [
        entry.kind === "Progress"
          ? "progress"
          : entry.error
            ? "failure"
            : "success",
      ],
    ],
    ["timestamp", [String(entry.timestamp)]],
    ["message", logMessageParts(entry, success)],
  ];
}
export function printFiniteLogs(
  chunk: FiniteLogChunk,
  options: {
    format?: string;
    jsonl?: boolean;
    success?: boolean;
    quiet?: boolean;
  },
): void {
  // console.log adds one final LF. Charge it before every fragment and write nothing
  // until the complete representation fits. No value-dependent table padding exists.
  let bytes = 1;
  const fragments: string[] = [];
  const append = (value: string, quoteEscape = false): void => {
    let quotes = 0;
    if (quoteEscape)
      for (
        let at = value.indexOf('"');
        at !== -1;
        at = value.indexOf('"', at + 1)
      )
        quotes++;
    const added = Buffer.byteLength(value, "utf8") + quotes;
    if (added > LOG_OUTPUT_LIMIT - bytes)
      throw new Error("Native logs exceed 8 MiB whole-event output budget");
    bytes += added;
    // CSV expansion happens only after its exact bytes fit the remaining budget.
    fragments.push(quotes ? value.replaceAll('"', '""') : value);
  };
  if (options.jsonl) {
    chunk.entries.forEach((entry, index) => {
      if (index) append("\n");
      append(JSON.stringify(entry));
    });
  } else if (options.format === "json") append(JSON.stringify(chunk));
  else if (options.format === "csv") {
    append("kind,function,outcome,timestamp,message");
    for (const entry of chunk.entries) {
      append("\n");
      logProjection(entry, Boolean(options.success)).forEach(
        ([_field, parts], index) => {
          if (index) append(",");
          append('"');
          for (const part of parts) append(part, true);
          append('"');
        },
      );
    }
  } else if (!chunk.entries.length) append("No native log entries");
  else {
    chunk.entries.forEach((entry, index) => {
      if (index) append("\n\n");
      append(`Entry ${index + 1}\nfield     | value\n----------|------`);
      for (const [field, parts] of logProjection(
        entry,
        Boolean(options.success),
      )) {
        append(`\n${field.padEnd(9)} | `);
        for (const part of parts) append(part);
      }
    });
  }
  const rendered = fragments.join("");
  console.log(rendered);
  if (!options.quiet && (options.jsonl || options.format !== "json"))
    console.error(
      `Logs: ${chunk.returned}/${chunk.requested} entries; coverage=${chunk.coverage}; one available chunk, not complete historical retention`,
    );
}
