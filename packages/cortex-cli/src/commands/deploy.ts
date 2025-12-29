/**
 * Deploy and Update Commands
 *
 * Top-level commands for deploying and updating Cortex projects:
 * - deploy: Deploy schema and functions to Convex
 * - update: Update @cortexmemory/sdk and convex packages
 */

import { Command } from "commander";
import ora from "ora";
import type { CLIConfig, DeploymentConfig } from "../types.js";
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
      "Update @cortexmemory/sdk and convex packages across all enabled deployments",
    )
    .option("-d, --deployment <name>", "Target a specific deployment only")
    .option("--sdk-version <version>", "Specific Cortex SDK version to install")
    .option("--convex-version <version>", "Specific Convex version to install")
    .option("-y, --yes", "Auto-accept all updates", false)
    .action(async (options) => {
      const currentConfig = await loadConfig();

      // If -d flag is provided, use single deployment mode (existing behavior)
      if (options.deployment) {
        const selection = await selectDeployment(
          currentConfig,
          options,
          "update packages",
        );
        if (!selection) return;

        const { name, deployment } = selection;
        await updateDeployment(name, deployment, options);
        return;
      }

      // Default behavior: check all enabled deployments
      const { deployments: enabledDeployments } =
        getEnabledDeployments(currentConfig);

      if (enabledDeployments.length === 0) {
        console.log(pc.red("\n   No enabled deployments found"));
        console.log(
          pc.dim(
            "   Run 'cortex init' or 'cortex config add-deployment' to add one",
          ),
        );
        console.log(
          pc.dim(
            "   Or use 'cortex config enable <name>' to enable a deployment\n",
          ),
        );
        return;
      }

      // Single enabled deployment - proceed directly
      if (enabledDeployments.length === 1) {
        const { name, deployment } = enabledDeployments[0];
        console.log(pc.dim(`   Using: ${name}`));
        await updateDeployment(name, deployment, options);
        return;
      }

      // Multiple deployments - show status and confirm
      console.log();
      printSection("Enabled Deployments", {});

      const spinner = ora("Checking package versions...").start();

      // Get latest versions once (shared across all deployments)
      let latestSdkVersion = "unknown";
      let latestConvexVersion = "unknown";
      let sdkConvexPeerDep = "unknown";

      try {
        const [sdkResult, convexResult, peerDepResult] = await Promise.all([
          execCommand("npm", ["view", "@cortexmemory/sdk", "version"], {
            quiet: true,
          }).catch(() => ({ stdout: "unknown" })),
          execCommand("npm", ["view", "convex", "version"], {
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
        try {
          const peerDeps = JSON.parse(peerDepResult.stdout);
          sdkConvexPeerDep = peerDeps?.convex ?? "unknown";
        } catch {
          // Ignore parse errors
        }
      } catch {
        // Ignore errors
      }

      // Gather status for each deployment
      interface DeploymentUpdateInfo {
        name: string;
        deployment: DeploymentConfig;
        projectPath: string;
        currentSdkVersion: string;
        currentConvexVersion: string;
        needsUpdate: boolean;
      }

      const deploymentInfos: DeploymentUpdateInfo[] = [];

      for (const { name, deployment, projectPath } of enabledDeployments) {
        let currentSdkVersion = "not installed";
        let currentConvexVersion = "not installed";

        try {
          const result = await execCommand(
            "npm",
            ["list", "@cortexmemory/sdk", "--json"],
            { quiet: true, cwd: projectPath },
          );
          const data = JSON.parse(result.stdout);
          currentSdkVersion =
            data.dependencies?.["@cortexmemory/sdk"]?.version ??
            "not installed";
        } catch {
          // Ignore errors
        }

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

        const targetSdkVersion = options.sdkVersion ?? latestSdkVersion;
        const needsUpdate =
          currentSdkVersion !== targetSdkVersion ||
          currentSdkVersion === "not installed";

        deploymentInfos.push({
          name,
          deployment,
          projectPath,
          currentSdkVersion,
          currentConvexVersion,
          needsUpdate,
        });
      }

      spinner.stop();

      // Display status table
      console.log();
      console.log(pc.bold("  Latest versions:"));
      console.log(`    @cortexmemory/sdk: ${pc.cyan(latestSdkVersion)}`);
      console.log(`    convex: ${pc.cyan(latestConvexVersion)}`);
      if (sdkConvexPeerDep !== "unknown") {
        console.log(`    SDK requires convex: ${pc.dim(sdkConvexPeerDep)}`);
      }
      console.log();

      // Show each deployment status
      const deploymentsNeedingUpdate = deploymentInfos.filter(
        (d) => d.needsUpdate,
      );

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
        console.log(
          `      Convex: ${info.currentConvexVersion === latestConvexVersion ? pc.green(info.currentConvexVersion) : pc.yellow(info.currentConvexVersion)}`,
        );
        console.log();
      }

      // Check if any updates needed
      if (deploymentsNeedingUpdate.length === 0) {
        printSuccess("All deployments are up to date!");
        return;
      }

      // Prompt for confirmation
      console.log(
        pc.cyan(
          `  ${deploymentsNeedingUpdate.length} of ${deploymentInfos.length} deployment(s) need updates`,
        ),
      );
      console.log();

      let shouldProceed = options.yes;
      if (!shouldProceed) {
        const { default: prompts } = await import("prompts");
        const response = await prompts({
          type: "confirm",
          name: "proceed",
          message: `Update all ${deploymentsNeedingUpdate.length} deployment(s)?`,
          initial: true,
        });
        shouldProceed = response.proceed;
      }

      if (!shouldProceed) {
        console.log(pc.yellow("\n   Operation cancelled\n"));
        console.log(
          pc.dim("   Tip: Use 'cortex update -d <name>' to update a specific deployment\n"),
        );
        return;
      }

      // Update each deployment that needs it
      console.log();
      let successCount = 0;
      let failCount = 0;

      for (const info of deploymentsNeedingUpdate) {
        console.log(pc.bold(`\n━━━ Updating ${info.name} ━━━\n`));
        try {
          await updateDeployment(info.name, info.deployment, {
            ...options,
            yes: true, // Auto-accept for batch mode
          });
          successCount++;
        } catch (error) {
          printError(
            `Failed to update ${info.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          failCount++;
        }
      }

      // Summary
      console.log();
      console.log(pc.bold("━━━ Summary ━━━"));
      console.log();
      if (successCount > 0) {
        printSuccess(`${successCount} deployment(s) updated successfully`);
      }
      if (failCount > 0) {
        printWarning(`${failCount} deployment(s) failed to update`);
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
