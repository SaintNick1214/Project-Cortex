/**
 * Deploy and Update Commands
 *
 * Top-level commands for deploying and updating Cortex projects:
 * - deploy: Deploy schema and functions to Convex
 * - update: Update @cortexmemory/sdk and convex packages across deployments and apps
 */

import { Command } from "commander";
import ora from "ora";
import path from "path";
import fs from "fs-extra";
import type { CLIConfig, DeploymentConfig, AppConfig } from "../types.js";
import { resolveConfig, loadConfig } from "../utils/config.js";
import {
  selectDeployment,
  getEnabledDeployments,
} from "../utils/deployment-selector.js";
import { getDeploymentInfo } from "../utils/client.js";
import {
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printSection,
} from "../utils/formatting.js";
import { execCommand, execCommandLive } from "../utils/shell.js";
import {
  syncAppTemplate,
  checkTemplateSync,
  printTemplateSyncResult,
} from "../utils/app-template-sync.js";
import pc from "picocolors";

/**
 * Build environment for Convex commands, removing inherited CONVEX_* vars
 */
function buildConvexEnv(
  overrides?: Record<string, string>,
): typeof process.env {
  const cleanEnv = { ...process.env };

  // Find and remove all Convex-related env vars that might be inherited
  const convexVars = Object.keys(cleanEnv).filter(
    (key) =>
      key.startsWith("CONVEX_") ||
      key.startsWith("LOCAL_CONVEX_") ||
      key.startsWith("CLOUD_CONVEX_") ||
      key.startsWith("ENV_CONVEX_"),
  );

  for (const key of convexVars) {
    delete cleanEnv[key];
  }

  // Apply overrides
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      cleanEnv[key] = value;
    }
  }

  return cleanEnv;
}

/**
 * Execute a command with live output and clean Convex env
 */
async function execConvexCommandLive(
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<number> {
  const { spawn } = await import("child_process");

  return new Promise((resolve) => {
    const env = buildConvexEnv(options.env);

    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit",
      shell: true,
      env,
    });

    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

/**
 * Register deploy and update commands on the program
 */
export function registerDeployCommands(
  program: Command,
  _config: CLIConfig,
): void {
  // cortex deploy
  program
    .command("deploy")
    .description("Deploy schema and functions to Convex")
    .option("-d, --deployment <name>", "Target deployment")
    .option("-l, --local", "Deploy to local Convex instance")
    .option("-p, --prod", "Deploy to production")
    .option("--push", "Push without prompts", false)
    .option("--skip-sync", "Skip automatic schema sync from SDK")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(
        currentConfig,
        options,
        "deploy",
      );
      if (!selection) return;

      const { name: targetName, deployment } = selection;
      const projectPath = deployment.projectPath || process.cwd();

      try {
        const info = getDeploymentInfo(currentConfig, {
          deployment: targetName,
        });

        console.log();
        printInfo(`Deploying to ${info.isLocal ? "local" : "cloud"} Convex...`);
        printInfo(`Project: ${projectPath}`);

        // Sync schema files from SDK before deploying
        if (!options.skipSync) {
          const { syncConvexSchema, printSyncResult } = await import(
            "../utils/schema-sync.js"
          );
          const syncResult = await syncConvexSchema(projectPath);
          printSyncResult(syncResult);
          if (syncResult.error) {
            printWarning("Continuing with existing schema files...");
          }
        }

        console.log();

        const args = ["convex", "deploy"];

        // Build environment variables for the Convex command
        const convexEnv: Record<string, string> = {};

        if (options.local || info.isLocal) {
          const resolved = resolveConfig(currentConfig, {
            deployment: targetName,
          });
          args.push("--url", resolved.url);
          convexEnv.CONVEX_URL = resolved.url;
        } else {
          // For cloud deployments, explicitly set the URL and deploy key from config
          convexEnv.CONVEX_URL = deployment.url;
          if (deployment.key) {
            convexEnv.CONVEX_DEPLOY_KEY = deployment.key;
          }
          if (deployment.deployment) {
            convexEnv.CONVEX_DEPLOYMENT = deployment.deployment;
          }
        }

        if (options.prod) {
          args.push("--prod");
        }

        if (options.push) {
          args.push("--yes");
        }

        const exitCode = await execConvexCommandLive("npx", args, {
          cwd: projectPath,
          env: convexEnv,
        });

        if (exitCode === 0) {
          console.log();
          printSuccess("Deployment complete!");
        } else {
          console.log();
          printError("Deployment failed");
          process.exit(1);
        }
      } catch (error) {
        printError(error instanceof Error ? error.message : "Deploy failed");
        process.exit(1);
      }
    });

  // cortex update
  program
    .command("update")
    .description(
      "Update @cortexmemory/sdk and convex packages across all enabled deployments and apps",
    )
    .option("-d, --deployment <name>", "Target a specific deployment only")
    .option("-a, --app <name>", "Target a specific app only")
    .option("--apps-only", "Only update apps (skip deployments)", false)
    .option("--deployments-only", "Only update deployments (skip apps)", false)
    .option("--dev", "Use dev mode (link to local SDK via CORTEX_SDK_DEV_PATH)", false)
    .option("--sync-template", "Sync app template files (components, routes, etc.)", false)
    .option("--sdk-version <version>", "Specific Cortex SDK version to install")
    .option("--convex-version <version>", "Specific Convex version to install")
    .option("--provider-version <version>", "Specific vercel-ai-provider version to install")
    .option("-y, --yes", "Auto-accept all updates", false)
    .action(async (options) => {
      const currentConfig = await loadConfig();

      // Check for dev mode
      const devPath = process.env.CORTEX_SDK_DEV_PATH;
      const isDevMode = options.dev || !!devPath;

      if (isDevMode && !devPath) {
        console.log(pc.red("\n   Dev mode requires CORTEX_SDK_DEV_PATH environment variable"));
        console.log(pc.dim("   Set it to the path of your local Project-Cortex repo:"));
        console.log(pc.dim("   export CORTEX_SDK_DEV_PATH=/path/to/Project-Cortex\n"));
        return;
      }

      // If -a flag is provided, use single app mode
      if (options.app) {
        const app = currentConfig.apps?.[options.app];
        if (!app) {
          console.log(pc.red(`\n   App "${options.app}" not found`));
          const appNames = Object.keys(currentConfig.apps || {});
          if (appNames.length > 0) {
            console.log(pc.dim(`   Available: ${appNames.join(", ")}`));
          } else {
            console.log(pc.dim("   No apps configured. Run 'cortex init' to add one."));
          }
          return;
        }
        try {
          await updateApp(options.app, app, {
            ...options,
            devPath: isDevMode ? devPath : undefined,
            syncTemplate: options.syncTemplate,
          });
        } catch (error) {
          printError(
            `Failed to update app "${options.app}": ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
        return;
      }

      // If -d flag is provided, use single deployment mode (existing behavior)
      if (options.deployment) {
        const selection = await selectDeployment(
          currentConfig,
          options,
          "update packages",
        );
        if (!selection) return;

        const { name, deployment } = selection;
        try {
          await updateDeployment(name, deployment, options);
        } catch (error) {
          printError(
            `Failed to update deployment "${name}": ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
        return;
      }

      // Determine what to update based on flags
      const updateDeployments = !options.appsOnly;
      const updateApps = !options.deploymentsOnly;

      // Get enabled deployments and apps
      const { deployments: enabledDeployments } = getEnabledDeployments(currentConfig);
      const enabledApps = Object.entries(currentConfig.apps || {})
        .filter(([, app]) => app.enabled)
        .map(([name, app]) => ({ name, app }));

      const hasDeployments = enabledDeployments.length > 0;
      const hasApps = enabledApps.length > 0;

      if (updateDeployments && !hasDeployments && !options.appsOnly) {
        console.log(pc.yellow("\n   No enabled deployments found"));
      }

      if (updateApps && !hasApps && !options.deploymentsOnly) {
        console.log(pc.yellow("\n   No enabled apps found"));
      }

      if ((!updateDeployments || !hasDeployments) && (!updateApps || !hasApps)) {
        console.log(pc.red("\n   Nothing to update"));
        console.log(
          pc.dim(
            "   Run 'cortex init' to configure deployments and apps\n",
          ),
        );
        return;
      }

      // Single deployment + no apps - proceed directly (backwards compatibility)
      if (updateDeployments && enabledDeployments.length === 1 && (!updateApps || !hasApps)) {
        const { name, deployment } = enabledDeployments[0];
        console.log(pc.dim(`   Using: ${name}`));
        await updateDeployment(name, deployment, options);
        return;
      }

      // Multiple targets or apps - show status dashboard
      console.log();

      const spinner = ora("Checking package versions...").start();

      // Get latest versions - from local source in dev mode, from npm otherwise
      let latestSdkVersion = "unknown";
      let latestConvexVersion = "unknown";
      let latestProviderVersion = "unknown";
      let latestAiVersion = "unknown";
      let sdkConvexPeerDep = "unknown";

      if (isDevMode && devPath) {
        // In dev mode, read versions from local source package.json files
        try {
          const sdkPkgPath = path.join(devPath, "package.json");
          const providerPkgPath = path.join(devPath, "packages", "vercel-ai-provider", "package.json");

          if (await fs.pathExists(sdkPkgPath)) {
            const sdkPkg = await fs.readJson(sdkPkgPath);
            latestSdkVersion = sdkPkg.version || "unknown";
            // Also get peerDependencies from local source
            sdkConvexPeerDep = sdkPkg.peerDependencies?.convex ?? "unknown";
          }

          if (await fs.pathExists(providerPkgPath)) {
            const providerPkg = await fs.readJson(providerPkgPath);
            latestProviderVersion = providerPkg.version || "unknown";
          }

          // Still fetch convex and ai versions from npm (external dependencies)
          const [convexResult, aiResult] = await Promise.all([
            execCommand("npm", ["view", "convex", "version"], {
              quiet: true,
            }).catch(() => ({ stdout: "unknown" })),
            execCommand("npm", ["view", "ai", "version"], {
              quiet: true,
            }).catch(() => ({ stdout: "unknown" })),
          ]);

          latestConvexVersion = convexResult.stdout.trim() || "unknown";
          latestAiVersion = aiResult.stdout.trim() || "unknown";
        } catch {
          // Ignore errors, versions will remain "unknown"
        }
      } else {
        // Normal mode: fetch all versions from npm
        try {
          const [sdkResult, convexResult, providerResult, aiResult, peerDepResult] = await Promise.all([
            execCommand("npm", ["view", "@cortexmemory/sdk", "version"], {
              quiet: true,
            }).catch(() => ({ stdout: "unknown" })),
            execCommand("npm", ["view", "convex", "version"], {
              quiet: true,
            }).catch(() => ({ stdout: "unknown" })),
            execCommand("npm", ["view", "@cortexmemory/vercel-ai-provider", "version"], {
              quiet: true,
            }).catch(() => ({ stdout: "unknown" })),
            execCommand("npm", ["view", "ai", "version"], {
              quiet: true,
            }).catch(() => ({ stdout: "unknown" })),
            execCommand(
              "npm",
              ["view", "@cortexmemory/sdk", "peerDependencies", "--json"],
              { quiet: true },
            ).catch(() => ({ stdout: "{}" })),
          ]);

          latestSdkVersion = sdkResult.stdout.trim() || "unknown";
          latestConvexVersion = convexResult.stdout.trim() || "unknown";
          latestProviderVersion = providerResult.stdout.trim() || "unknown";
          latestAiVersion = aiResult.stdout.trim() || "unknown";
          try {
            const peerDeps = JSON.parse(peerDepResult.stdout);
            sdkConvexPeerDep = peerDeps?.convex ?? "unknown";
          } catch {
            // Ignore parse errors
          }
        } catch {
          // Ignore errors
        }
      }

      // Gather status for each deployment
      interface DeploymentUpdateInfo {
        name: string;
        deployment: DeploymentConfig;
        projectPath: string;
        currentSdkVersion: string;
        currentProviderVersion: string;
        currentAiVersion: string;
        currentConvexVersion: string;
        needsUpdate: boolean;
      }

      interface AppUpdateInfo {
        name: string;
        app: AppConfig;
        appPath: string;
        currentSdkVersion: string;
        currentProviderVersion: string;
        currentConvexVersion: string;
        currentAiVersion: string;
        needsUpdate: boolean;
        isDevLinked: boolean;
        templateFilesToUpdate: number;
        templateFilesToAdd: number;
        needsTemplateSync: boolean;
      }

      const deploymentInfos: DeploymentUpdateInfo[] = [];
      const appInfos: AppUpdateInfo[] = [];

      // Check deployments
      if (updateDeployments && hasDeployments) {
        for (const { name, deployment, projectPath } of enabledDeployments) {
          let currentSdkVersion = "not installed";
          let currentProviderVersion = "not installed";
          let currentAiVersion = "not installed";
          let currentConvexVersion = "not installed";

          // Check all packages in one npm list call for efficiency
          try {
            const result = await execCommand(
              "npm",
              ["list", "@cortexmemory/sdk", "@cortexmemory/vercel-ai-provider", "convex", "ai", "--json"],
              { quiet: true, cwd: projectPath },
            );
            const data = JSON.parse(result.stdout);
            currentSdkVersion =
              data.dependencies?.["@cortexmemory/sdk"]?.version ?? "not installed";
            currentProviderVersion =
              data.dependencies?.["@cortexmemory/vercel-ai-provider"]?.version ?? "not installed";
            currentAiVersion =
              data.dependencies?.ai?.version ?? "not installed";
            currentConvexVersion =
              data.dependencies?.convex?.version ?? "not installed";
          } catch {
            // Ignore errors
          }

          const targetSdkVersion = options.sdkVersion ?? latestSdkVersion;
          const needsUpdate =
            currentSdkVersion !== targetSdkVersion ||
            currentSdkVersion === "not installed";

          deploymentInfos.push({
            name,
            deployment,
            projectPath,
            currentSdkVersion,
            currentProviderVersion,
            currentAiVersion,
            currentConvexVersion,
            needsUpdate,
          });
        }
      }

      // Check apps
      if (updateApps && hasApps) {
        for (const { name, app } of enabledApps) {
          const appPath = path.join(app.projectPath, app.path);
          let currentSdkVersion = "not installed";
          let currentProviderVersion = "not installed";
          let currentConvexVersion = "not installed";
          let currentAiVersion = "not installed";
          let isDevLinked = false;

          // Check package.json for file: references (dev linked)
          try {
            const packageJsonPath = path.join(appPath, "package.json");
            if (await fs.pathExists(packageJsonPath)) {
              const pkg = await fs.readJson(packageJsonPath);
              const sdkDep = pkg.dependencies?.["@cortexmemory/sdk"];
              const providerDep = pkg.dependencies?.["@cortexmemory/vercel-ai-provider"];
              isDevLinked = sdkDep?.startsWith("file:") || providerDep?.startsWith("file:");
            }
          } catch {
            // Ignore errors
          }

          // Get installed versions
          try {
            const result = await execCommand(
              "npm",
              ["list", "@cortexmemory/sdk", "@cortexmemory/vercel-ai-provider", "convex", "ai", "--json"],
              { quiet: true, cwd: appPath },
            );
            const data = JSON.parse(result.stdout);
            currentSdkVersion =
              data.dependencies?.["@cortexmemory/sdk"]?.version ?? "not installed";
            currentProviderVersion =
              data.dependencies?.["@cortexmemory/vercel-ai-provider"]?.version ?? "not installed";
            currentConvexVersion =
              data.dependencies?.convex?.version ?? "not installed";
            currentAiVersion =
              data.dependencies?.ai?.version ?? "not installed";
          } catch {
            // Ignore errors
          }

          const targetSdkVersion = isDevMode ? "dev" : (options.sdkVersion ?? latestSdkVersion);
          const needsUpdate = isDevMode
            ? !isDevLinked // Dev mode: needs update if not already dev-linked
            : (currentSdkVersion !== targetSdkVersion || currentSdkVersion === "not installed");

          // Check template sync status if --sync-template is enabled
          let templateFilesToUpdate = 0;
          let templateFilesToAdd = 0;
          let needsTemplateSync = false;

          if (options.syncTemplate) {
            try {
              const templateStatus = await checkTemplateSync(app);
              templateFilesToUpdate = templateStatus.filesOutdated.length;
              templateFilesToAdd = templateStatus.filesMissing.length;
              needsTemplateSync = templateStatus.needsSync;
            } catch {
              // Ignore errors
            }
          }

          appInfos.push({
            name,
            app,
            appPath,
            currentSdkVersion,
            currentProviderVersion,
            currentConvexVersion,
            currentAiVersion,
            needsUpdate,
            isDevLinked,
            templateFilesToUpdate,
            templateFilesToAdd,
            needsTemplateSync,
          });
        }
      }

      spinner.stop();

      // Display status dashboard
      if (isDevMode) {
        console.log(pc.magenta("  ═══ DEV MODE ═══"));
        console.log(pc.dim(`  SDK path: ${devPath}`));
        console.log();
      }

      // Use "Source versions" in dev mode to indicate local package.json versions
      const versionsLabel = isDevMode ? "Source versions" : "Latest versions";
      console.log(pc.bold(`  ${versionsLabel}:`));
      console.log(`    @cortexmemory/sdk: ${pc.cyan(latestSdkVersion)}`);
      console.log(`    @cortexmemory/vercel-ai-provider: ${pc.cyan(latestProviderVersion)}`);
      console.log(`    convex: ${pc.cyan(latestConvexVersion)}`);
      console.log(`    ai: ${pc.cyan(latestAiVersion)}`);
      if (sdkConvexPeerDep !== "unknown") {
        console.log(`    SDK requires convex: ${pc.dim(sdkConvexPeerDep)}`);
      }
      console.log();

      // Show deployment status
      if (deploymentInfos.length > 0) {
        printSection("Deployments", {});
        console.log();

        for (const info of deploymentInfos) {
          const isDefault = info.name === currentConfig.default;
          const defaultBadge = isDefault ? pc.cyan(" (default)") : "";
          const statusIcon = info.needsUpdate
            ? pc.yellow("●")
            : pc.green("●");

          console.log(`  ${statusIcon} ${pc.bold(info.name)}${defaultBadge}`);
          console.log(pc.dim(`      Path: ${info.projectPath}`));
          console.log(
            `      SDK: ${info.currentSdkVersion === latestSdkVersion ? pc.green(info.currentSdkVersion) : pc.yellow(info.currentSdkVersion)}`,
          );
          // Only show provider and AI if they're installed (frontend packages)
          if (info.currentProviderVersion !== "not installed") {
            console.log(
              `      Provider: ${info.currentProviderVersion === latestProviderVersion ? pc.green(info.currentProviderVersion) : pc.yellow(info.currentProviderVersion)}`,
            );
          }
          if (info.currentAiVersion !== "not installed") {
            console.log(
              `      AI: ${info.currentAiVersion === latestAiVersion ? pc.green(info.currentAiVersion) : pc.yellow(info.currentAiVersion)}`,
            );
          }
          console.log(
            `      Convex: ${info.currentConvexVersion === latestConvexVersion ? pc.green(info.currentConvexVersion) : pc.yellow(info.currentConvexVersion)}`,
          );
          console.log();
        }
      }

      // Show app status
      if (appInfos.length > 0) {
        printSection("Apps", {});
        console.log();

        for (const info of appInfos) {
          const devBadge = info.isDevLinked ? pc.magenta(" [DEV]") : "";
          const needsAnyUpdate = info.needsUpdate || info.needsTemplateSync;
          const statusIcon = needsAnyUpdate
            ? pc.yellow("●")
            : pc.green("●");

          console.log(`  ${statusIcon} ${pc.bold(info.name)}${devBadge}`);
          console.log(pc.dim(`      Path: ${info.appPath}`));
          console.log(
            `      SDK: ${info.isDevLinked ? pc.magenta("file:...") : (info.currentSdkVersion === latestSdkVersion ? pc.green(info.currentSdkVersion) : pc.yellow(info.currentSdkVersion))}`,
          );
          console.log(
            `      Provider: ${info.isDevLinked ? pc.magenta("file:...") : (info.currentProviderVersion === latestProviderVersion ? pc.green(info.currentProviderVersion) : pc.yellow(info.currentProviderVersion))}`,
          );
          console.log(
            `      AI: ${info.currentAiVersion === latestAiVersion ? pc.green(info.currentAiVersion) : pc.yellow(info.currentAiVersion)}`,
          );
          console.log(
            `      Convex: ${info.currentConvexVersion === latestConvexVersion ? pc.green(info.currentConvexVersion) : pc.yellow(info.currentConvexVersion)}`,
          );
          // Show template sync status if --sync-template is enabled
          if (options.syncTemplate) {
            const totalTemplateChanges = info.templateFilesToUpdate + info.templateFilesToAdd;
            if (totalTemplateChanges > 0) {
              console.log(
                `      Template: ${pc.yellow(`${totalTemplateChanges} file(s) to sync`)}`,
              );
            } else {
              console.log(
                `      Template: ${pc.green("up to date")}`,
              );
            }
          }
          console.log();
        }
      }

      // Count updates needed
      const deploymentsNeedingUpdate = deploymentInfos.filter((d) => d.needsUpdate);
      const appsNeedingUpdate = appInfos.filter((a) => a.needsUpdate || (options.syncTemplate && a.needsTemplateSync));
      const totalNeedingUpdate = deploymentsNeedingUpdate.length + appsNeedingUpdate.length;

      // Check if any updates needed
      if (totalNeedingUpdate === 0) {
        printSuccess("Everything is up to date!");
        return;
      }

      // Prompt for confirmation
      const updateParts: string[] = [];
      if (deploymentsNeedingUpdate.length > 0) {
        updateParts.push(`${deploymentsNeedingUpdate.length} deployment(s)`);
      }
      if (appsNeedingUpdate.length > 0) {
        updateParts.push(`${appsNeedingUpdate.length} app(s)`);
      }

      console.log(
        pc.cyan(`  ${updateParts.join(" and ")} need updates`),
      );
      console.log();

      let shouldProceed = options.yes;
      if (!shouldProceed) {
        const { default: prompts } = await import("prompts");
        const response = await prompts({
          type: "confirm",
          name: "proceed",
          message: `Update all ${totalNeedingUpdate} target(s)?`,
          initial: true,
        });
        shouldProceed = response.proceed;
      }

      if (!shouldProceed) {
        console.log(pc.yellow("\n   Operation cancelled\n"));
        console.log(
          pc.dim("   Tip: Use '-d <name>' for deployments or '-a <name>' for apps\n"),
        );
        return;
      }

      // Perform updates
      console.log();
      let deploymentSuccessCount = 0;
      let deploymentFailCount = 0;
      let appSuccessCount = 0;
      let appFailCount = 0;

      // Update deployments
      for (const info of deploymentsNeedingUpdate) {
        console.log(pc.bold(`\n━━━ Updating deployment: ${info.name} ━━━\n`));
        try {
          await updateDeployment(info.name, info.deployment, {
            ...options,
            yes: true,
          });
          deploymentSuccessCount++;
        } catch (error) {
          printError(
            `Failed to update ${info.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          deploymentFailCount++;
        }
      }

      // Update apps
      for (const info of appsNeedingUpdate) {
        console.log(pc.bold(`\n━━━ Updating app: ${info.name} ━━━\n`));
        try {
          await updateApp(info.name, info.app, {
            ...options,
            devPath: isDevMode ? devPath : undefined,
            syncTemplate: options.syncTemplate,
            yes: true,
          });
          appSuccessCount++;
        } catch (error) {
          printError(
            `Failed to update ${info.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          appFailCount++;
        }
      }

      // Summary
      console.log();
      console.log(pc.bold("━━━ Summary ━━━"));
      console.log();
      if (deploymentSuccessCount > 0) {
        printSuccess(`${deploymentSuccessCount} deployment(s) updated successfully`);
      }
      if (deploymentFailCount > 0) {
        printWarning(`${deploymentFailCount} deployment(s) failed to update`);
      }
      if (appSuccessCount > 0) {
        printSuccess(`${appSuccessCount} app(s) updated successfully`);
      }
      if (appFailCount > 0) {
        printWarning(`${appFailCount} app(s) failed to update`);
      }
    });
}

/**
 * Update packages for a single deployment
 */
async function updateDeployment(
  name: string,
  deployment: DeploymentConfig,
  options: {
    sdkVersion?: string;
    convexVersion?: string;
    yes?: boolean;
  },
): Promise<void> {
  const projectPath = deployment.projectPath || process.cwd();

  const spinner = ora("Checking for updates...").start();

  try {
    // Get current Cortex SDK version
    let currentSdkVersion = "not installed";
    try {
      const result = await execCommand(
        "npm",
        ["list", "@cortexmemory/sdk", "--json"],
        { quiet: true, cwd: projectPath },
      );
      const data = JSON.parse(result.stdout);
      currentSdkVersion =
        data.dependencies?.["@cortexmemory/sdk"]?.version ?? "not installed";
    } catch {
      // Ignore errors
    }

    // Get latest Cortex SDK version from npm
    let latestSdkVersion = "unknown";
    try {
      const result = await execCommand(
        "npm",
        ["view", "@cortexmemory/sdk", "version"],
        { quiet: true },
      );
      latestSdkVersion = result.stdout.trim();
    } catch {
      // Ignore errors
    }

    // Get current Convex version
    let currentConvexVersion = "not installed";
    try {
      const result = await execCommand("npm", ["list", "convex", "--json"], {
        quiet: true,
        cwd: projectPath,
      });
      const data = JSON.parse(result.stdout);
      currentConvexVersion =
        data.dependencies?.convex?.version ?? "not installed";
    } catch {
      // Ignore errors
    }

    // Get latest Convex version from npm
    let latestConvexVersion = "unknown";
    try {
      const result = await execCommand("npm", ["view", "convex", "version"], {
        quiet: true,
      });
      latestConvexVersion = result.stdout.trim();
    } catch {
      // Ignore errors
    }

    // Get Cortex SDK's peer dependency on Convex
    let sdkConvexPeerDep = "unknown";
    try {
      const result = await execCommand(
        "npm",
        ["view", "@cortexmemory/sdk", "peerDependencies", "--json"],
        { quiet: true },
      );
      const peerDeps = JSON.parse(result.stdout);
      sdkConvexPeerDep = peerDeps?.convex ?? "unknown";
    } catch {
      // Ignore errors
    }

    spinner.stop();

    // Display current status
    console.log();
    printSection("Package Status", {
      Deployment: name,
      "Project Path": projectPath,
    });

    console.log();
    console.log(pc.bold("  @cortexmemory/sdk"));
    console.log(
      `    Current: ${currentSdkVersion === latestSdkVersion ? pc.green(currentSdkVersion) : pc.yellow(currentSdkVersion)}`,
    );
    console.log(`    Latest:  ${latestSdkVersion}`);

    console.log();
    console.log(pc.bold("  convex"));
    console.log(
      `    Current: ${currentConvexVersion === latestConvexVersion ? pc.green(currentConvexVersion) : pc.yellow(currentConvexVersion)}`,
    );
    console.log(`    Latest:  ${latestConvexVersion}`);
    if (sdkConvexPeerDep !== "unknown") {
      console.log(`    SDK requires: ${pc.dim(sdkConvexPeerDep)}`);
    }
    console.log();

    // Determine what needs updating
    const targetSdkVersion = options.sdkVersion ?? latestSdkVersion;
    const sdkNeedsUpdate =
      currentSdkVersion !== targetSdkVersion &&
      currentSdkVersion !== "not installed";
    const sdkNeedsInstall = currentSdkVersion === "not installed";

    // Check if Convex has a patch update available beyond what SDK requires
    const parseVersion = (v: string) => {
      const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
      if (!match) return null;
      return {
        major: parseInt(match[1]),
        minor: parseInt(match[2]),
        patch: parseInt(match[3]),
      };
    };

    const currentConvex = parseVersion(currentConvexVersion);
    const latestConvex = parseVersion(latestConvexVersion);

    let convexPatchAvailable = false;
    if (currentConvex && latestConvex) {
      // Patch update = same major.minor, higher patch
      convexPatchAvailable =
        currentConvex.major === latestConvex.major &&
        currentConvex.minor === latestConvex.minor &&
        currentConvex.patch < latestConvex.patch;
    }

    const targetConvexVersion =
      options.convexVersion ??
      (convexPatchAvailable ? latestConvexVersion : null);
    const convexNeedsUpdate =
      targetConvexVersion && currentConvexVersion !== targetConvexVersion;

    // Nothing to update
    if (
      !sdkNeedsUpdate &&
      !sdkNeedsInstall &&
      !convexNeedsUpdate &&
      !convexPatchAvailable
    ) {
      printSuccess("All packages are up to date!");
      return;
    }

    // Update Cortex SDK if needed
    if (sdkNeedsUpdate || sdkNeedsInstall) {
      console.log();
      printInfo(
        `${sdkNeedsInstall ? "Installing" : "Updating"} @cortexmemory/sdk@${targetSdkVersion}...`,
      );
      console.log();

      const exitCode = await execCommandLive(
        "npm",
        ["install", `@cortexmemory/sdk@${targetSdkVersion}`],
        { cwd: projectPath },
      );

      if (exitCode === 0) {
        printSuccess(
          `${sdkNeedsInstall ? "Installed" : "Updated"} @cortexmemory/sdk to ${targetSdkVersion}`,
        );
      } else {
        printError("SDK update failed");
        throw new Error("SDK update failed");
      }
    } else if (currentSdkVersion !== "not installed") {
      printSuccess("@cortexmemory/sdk is already up to date");
    }

    // Check for Convex patch update
    if (convexPatchAvailable && !options.convexVersion) {
      console.log();
      console.log(
        pc.cyan(
          `  Convex patch update available: ${currentConvexVersion} → ${latestConvexVersion}`,
        ),
      );

      let shouldUpdate = options.yes;
      if (!shouldUpdate) {
        const { default: prompts } = await import("prompts");
        const response = await prompts({
          type: "confirm",
          name: "update",
          message: "Update Convex to latest patch version?",
          initial: true,
        });
        shouldUpdate = response.update;
      }

      if (shouldUpdate) {
        console.log();
        printInfo(`Updating convex@${latestConvexVersion}...`);
        console.log();

        const exitCode = await execCommandLive(
          "npm",
          ["install", `convex@${latestConvexVersion}`],
          { cwd: projectPath },
        );

        if (exitCode === 0) {
          printSuccess(`Updated convex to ${latestConvexVersion}`);
        } else {
          printWarning("Convex update failed, but SDK update was successful");
        }
      } else {
        console.log(pc.dim("  Skipping Convex update"));
      }
    } else if (options.convexVersion) {
      // Explicit version requested
      console.log();
      printInfo(`Updating convex@${options.convexVersion}...`);
      console.log();

      const exitCode = await execCommandLive(
        "npm",
        ["install", `convex@${options.convexVersion}`],
        { cwd: projectPath },
      );

      if (exitCode === 0) {
        printSuccess(`Updated convex to ${options.convexVersion}`);
      } else {
        printWarning("Convex update failed");
      }
    }

    console.log();
    printSuccess("Update complete!");
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Update packages for a single app
 */
async function updateApp(
  name: string,
  app: AppConfig,
  options: {
    sdkVersion?: string;
    providerVersion?: string;
    convexVersion?: string;
    devPath?: string;
    yes?: boolean;
    syncTemplate?: boolean;
  },
): Promise<void> {
  const appPath = path.join(app.projectPath, app.path);
  const isDevMode = !!options.devPath;

  if (!await fs.pathExists(appPath)) {
    printError(`App path not found: ${appPath}`);
    throw new Error(`App path not found: ${appPath}`);
  }

  const spinner = ora("Checking for updates...").start();

  try {
    // Read package.json
    const packageJsonPath = path.join(appPath, "package.json");
    if (!await fs.pathExists(packageJsonPath)) {
      spinner.stop();
      printError(`No package.json found at ${appPath}`);
      throw new Error(`No package.json found at ${appPath}`);
    }

    const pkg = await fs.readJson(packageJsonPath);

    // Check current versions
    let currentSdkVersion = "not installed";
    let currentProviderVersion = "not installed";
    let currentConvexVersion = "not installed";
    let currentAiVersion = "not installed";
    let isDevLinked = false;

    // Check if already dev-linked
    const sdkDep = pkg.dependencies?.["@cortexmemory/sdk"];
    const providerDep = pkg.dependencies?.["@cortexmemory/vercel-ai-provider"];
    isDevLinked = sdkDep?.startsWith("file:") || providerDep?.startsWith("file:");

    // Get installed versions
    try {
      const result = await execCommand(
        "npm",
        ["list", "@cortexmemory/sdk", "@cortexmemory/vercel-ai-provider", "convex", "ai", "--json"],
        { quiet: true, cwd: appPath },
      );
      const data = JSON.parse(result.stdout);
      currentSdkVersion =
        data.dependencies?.["@cortexmemory/sdk"]?.version ?? "not installed";
      currentProviderVersion =
        data.dependencies?.["@cortexmemory/vercel-ai-provider"]?.version ?? "not installed";
      currentConvexVersion =
        data.dependencies?.convex?.version ?? "not installed";
      currentAiVersion =
        data.dependencies?.ai?.version ?? "not installed";
    } catch {
      // Ignore errors
    }

    // Get latest versions - from local source in dev mode, from npm otherwise
    let latestSdkVersion = "unknown";
    let latestProviderVersion = "unknown";
    let latestConvexVersion = "unknown";
    let latestAiVersion = "unknown";

    if (isDevMode && options.devPath) {
      // In dev mode, read versions from local source package.json files
      try {
        const sdkPkgPath = path.join(options.devPath, "package.json");
        const providerPkgPath = path.join(options.devPath, "packages", "vercel-ai-provider", "package.json");

        if (await fs.pathExists(sdkPkgPath)) {
          const sdkPkg = await fs.readJson(sdkPkgPath);
          latestSdkVersion = sdkPkg.version || "unknown";
        }

        if (await fs.pathExists(providerPkgPath)) {
          const providerPkg = await fs.readJson(providerPkgPath);
          latestProviderVersion = providerPkg.version || "unknown";
        }

        // Still fetch convex and ai versions from npm (external dependencies)
        const [convexResult, aiResult] = await Promise.all([
          execCommand("npm", ["view", "convex", "version"], { quiet: true }).catch(() => ({ stdout: "unknown" })),
          execCommand("npm", ["view", "ai", "version"], { quiet: true }).catch(() => ({ stdout: "unknown" })),
        ]);

        latestConvexVersion = convexResult.stdout.trim() || "unknown";
        latestAiVersion = aiResult.stdout.trim() || "unknown";
      } catch {
        // Ignore errors, versions will remain "unknown"
      }
    } else {
      // Normal mode: fetch all versions from npm
      try {
        const [sdkResult, providerResult, convexResult, aiResult] = await Promise.all([
          execCommand("npm", ["view", "@cortexmemory/sdk", "version"], { quiet: true }).catch(() => ({ stdout: "unknown" })),
          execCommand("npm", ["view", "@cortexmemory/vercel-ai-provider", "version"], { quiet: true }).catch(() => ({ stdout: "unknown" })),
          execCommand("npm", ["view", "convex", "version"], { quiet: true }).catch(() => ({ stdout: "unknown" })),
          execCommand("npm", ["view", "ai", "version"], { quiet: true }).catch(() => ({ stdout: "unknown" })),
        ]);

        latestSdkVersion = sdkResult.stdout.trim() || "unknown";
        latestProviderVersion = providerResult.stdout.trim() || "unknown";
        latestConvexVersion = convexResult.stdout.trim() || "unknown";
        latestAiVersion = aiResult.stdout.trim() || "unknown";
      } catch {
        // Ignore errors
      }
    }

    spinner.stop();

    // Display current status
    console.log();
    printSection("App Package Status", {
      App: name,
      Type: app.type,
      Path: appPath,
    });

    if (isDevMode) {
      console.log();
      console.log(pc.magenta("  ═══ DEV MODE ═══"));
      console.log(pc.dim(`  Will link to: ${options.devPath}`));
    }

    // Use "Source" label in dev mode to indicate local package.json version
    const cortexVersionLabel = isDevMode ? "Source" : "Latest";

    console.log();
    console.log(pc.bold("  @cortexmemory/sdk"));
    if (isDevLinked) {
      console.log(`    Current: ${pc.magenta("file:... (dev linked)")}`);
    } else {
      console.log(
        `    Current: ${currentSdkVersion === latestSdkVersion ? pc.green(currentSdkVersion) : pc.yellow(currentSdkVersion)}`,
      );
    }
    console.log(`    ${cortexVersionLabel}:  ${latestSdkVersion}`);

    console.log();
    console.log(pc.bold("  @cortexmemory/vercel-ai-provider"));
    if (isDevLinked) {
      console.log(`    Current: ${pc.magenta("file:... (dev linked)")}`);
    } else {
      console.log(
        `    Current: ${currentProviderVersion === latestProviderVersion ? pc.green(currentProviderVersion) : pc.yellow(currentProviderVersion)}`,
      );
    }
    console.log(`    ${cortexVersionLabel}:  ${latestProviderVersion}`);

    console.log();
    console.log(pc.bold("  convex"));
    console.log(
      `    Current: ${currentConvexVersion === latestConvexVersion ? pc.green(currentConvexVersion) : pc.yellow(currentConvexVersion)}`,
    );
    console.log(`    Latest:  ${latestConvexVersion}`);

    console.log();
    console.log(pc.bold("  ai (Vercel AI SDK)"));
    console.log(
      `    Current: ${currentAiVersion === latestAiVersion ? pc.green(currentAiVersion) : pc.yellow(currentAiVersion)}`,
    );
    console.log(`    Latest:  ${latestAiVersion}`);
    console.log();

    // Determine update strategy
    if (isDevMode) {
      // Dev mode: update package.json with file: references
      if (isDevLinked) {
        printSuccess("App is already dev-linked. Running npm install to refresh...");
      } else {
        printInfo("Switching to dev mode with local SDK...");
      }

      // Update package.json with file: references
      const devSdkPath = options.devPath!;
      const devProviderPath = path.join(devSdkPath, "packages", "vercel-ai-provider");

      pkg.dependencies = pkg.dependencies || {};
      pkg.dependencies["@cortexmemory/sdk"] = `file:${devSdkPath}`;
      pkg.dependencies["@cortexmemory/vercel-ai-provider"] = `file:${devProviderPath}`;

      await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
      console.log(pc.cyan("   Updated package.json with file: references"));

      // Run npm install
      console.log();
      printInfo("Running npm install...");
      console.log();

      const exitCode = await execCommandLive(
        "npm",
        ["install", "--legacy-peer-deps"],
        { cwd: appPath },
      );

      if (exitCode === 0) {
        console.log();
        printSuccess("Dev mode linking complete!");
        console.log(pc.dim(`   SDK linked to: ${devSdkPath}`));
        console.log(pc.dim(`   Provider linked to: ${devProviderPath}`));
      } else {
        printError("npm install failed");
        throw new Error("npm install failed");
      }
    } else {
      // Normal mode: update to latest versions from npm
      const targetSdkVersion = options.sdkVersion ?? latestSdkVersion;
      const targetProviderVersion = options.providerVersion ?? latestProviderVersion;

      // Check if we need to remove dev links first
      if (isDevLinked) {
        printInfo("Removing dev links and switching to npm packages...");

        pkg.dependencies["@cortexmemory/sdk"] = `^${targetSdkVersion}`;
        pkg.dependencies["@cortexmemory/vercel-ai-provider"] = `^${targetProviderVersion}`;

        await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
        console.log(pc.cyan("   Updated package.json with npm versions"));
      }

      // Determine what needs updating
      const sdkNeedsUpdate = currentSdkVersion !== targetSdkVersion || isDevLinked;
      const providerNeedsUpdate = currentProviderVersion !== targetProviderVersion || isDevLinked;

      // Nothing to update
      if (!sdkNeedsUpdate && !providerNeedsUpdate) {
        printSuccess("All packages are up to date!");
        return;
      }

      // Build install command
      const packagesToInstall: string[] = [];

      if (sdkNeedsUpdate) {
        packagesToInstall.push(`@cortexmemory/sdk@${targetSdkVersion}`);
      }
      if (providerNeedsUpdate) {
        packagesToInstall.push(`@cortexmemory/vercel-ai-provider@${targetProviderVersion}`);
      }

      if (packagesToInstall.length > 0) {
        console.log();
        printInfo(`Installing: ${packagesToInstall.join(", ")}...`);
        console.log();

        const exitCode = await execCommandLive(
          "npm",
          ["install", ...packagesToInstall, "--legacy-peer-deps"],
          { cwd: appPath },
        );

        if (exitCode === 0) {
          printSuccess("Packages updated successfully");
        } else {
          printError("Package update failed");
          throw new Error("Package update failed");
        }
      }

      console.log();
      printSuccess("Package update complete!");
    }

    // Template sync (if enabled)
    if (options.syncTemplate) {
      console.log();
      printSection("Template Sync", {});
      console.log();

      try {
        const templateResult = await syncAppTemplate(app, { dryRun: false });

        if (templateResult.error) {
          printWarning(`Template sync skipped: ${templateResult.error}`);
        } else if (templateResult.synced) {
          printTemplateSyncResult(templateResult);

          // Run npm install if package.json was updated with new dependencies
          if (templateResult.packageJsonUpdated) {
            const totalNewDeps = templateResult.depsAdded.length + templateResult.devDepsAdded.length;
            if (totalNewDeps > 0) {
              console.log();
              printInfo(`Installing ${totalNewDeps} new dependencies...`);
              console.log(pc.dim(`   Running in: ${templateResult.appPath}`));
              console.log();

              const exitCode = await execCommandLive(
                "npm",
                ["install", "--legacy-peer-deps"],
                { cwd: templateResult.appPath },
              );

              if (exitCode === 0) {
                printSuccess("Dependencies installed");
              } else {
                printWarning("npm install failed - you may need to run it manually");
              }
            }
          }
        } else {
          console.log(pc.dim("   Template files are up to date"));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        printWarning(`Template sync failed: ${message}`);
      }
    }

    console.log();
    printSuccess("Update complete!");
  } catch (error) {
    spinner.stop();
    throw error;
  }
}
