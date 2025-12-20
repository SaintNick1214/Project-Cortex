/**
 * Deploy and Update Commands
 *
 * Top-level commands for deploying and updating Cortex projects:
 * - deploy: Deploy schema and functions to Convex
 * - update: Update @cortexmemory/sdk and convex packages
 */

import { Command } from "commander";
import ora from "ora";
import type { CLIConfig } from "../types.js";
import { resolveConfig, loadConfig } from "../utils/config.js";
import { selectDeployment } from "../utils/deployment-selector.js";
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
function buildConvexEnv(overrides?: Record<string, string>): typeof process.env {
  const cleanEnv = { ...process.env };
  
  // Find and remove all Convex-related env vars that might be inherited
  const convexVars = Object.keys(cleanEnv).filter(key => 
    key.startsWith('CONVEX_') || 
    key.startsWith('LOCAL_CONVEX_') || 
    key.startsWith('CLOUD_CONVEX_') ||
    key.startsWith('ENV_CONVEX_')
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
      const selection = await selectDeployment(currentConfig, options, "deploy");
      if (!selection) return;

      const { name: targetName, deployment } = selection;
      const projectPath = deployment.projectPath || process.cwd();

      try {
        const info = getDeploymentInfo(currentConfig, { deployment: targetName });

        console.log();
        printInfo(`Deploying to ${info.isLocal ? "local" : "cloud"} Convex...`);
        printInfo(`Project: ${projectPath}`);

        // Sync schema files from SDK before deploying
        if (!options.skipSync) {
          const { syncConvexSchema, printSyncResult } = await import("../utils/schema-sync.js");
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
          const resolved = resolveConfig(currentConfig, { deployment: targetName });
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
    .description("Update @cortexmemory/sdk and convex packages")
    .option("-d, --deployment <name>", "Target deployment")
    .option("--sdk-version <version>", "Specific Cortex SDK version to install")
    .option("--convex-version <version>", "Specific Convex version to install")
    .option("-y, --yes", "Auto-accept all updates", false)
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "update packages");
      if (!selection) return;

      const { deployment } = selection;
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
          const result = await execCommand(
            "npm",
            ["list", "convex", "--json"],
            { quiet: true, cwd: projectPath },
          );
          const data = JSON.parse(result.stdout);
          currentConvexVersion =
            data.dependencies?.convex?.version ?? "not installed";
        } catch {
          // Ignore errors
        }

        // Get latest Convex version from npm
        let latestConvexVersion = "unknown";
        try {
          const result = await execCommand(
            "npm",
            ["view", "convex", "version"],
            { quiet: true },
          );
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
          "Project Path": projectPath,
        });
        
        console.log();
        console.log(pc.bold("  @cortexmemory/sdk"));
        console.log(`    Current: ${currentSdkVersion === latestSdkVersion ? pc.green(currentSdkVersion) : pc.yellow(currentSdkVersion)}`);
        console.log(`    Latest:  ${latestSdkVersion}`);
        
        console.log();
        console.log(pc.bold("  convex"));
        console.log(`    Current: ${currentConvexVersion === latestConvexVersion ? pc.green(currentConvexVersion) : pc.yellow(currentConvexVersion)}`);
        console.log(`    Latest:  ${latestConvexVersion}`);
        if (sdkConvexPeerDep !== "unknown") {
          console.log(`    SDK requires: ${pc.dim(sdkConvexPeerDep)}`);
        }
        console.log();

        // Determine what needs updating
        const targetSdkVersion = options.sdkVersion ?? latestSdkVersion;
        const sdkNeedsUpdate = currentSdkVersion !== targetSdkVersion && currentSdkVersion !== "not installed";
        const sdkNeedsInstall = currentSdkVersion === "not installed";

        // Check if Convex has a patch update available beyond what SDK requires
        const parseVersion = (v: string) => {
          const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
          if (!match) return null;
          return { major: parseInt(match[1]), minor: parseInt(match[2]), patch: parseInt(match[3]) };
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

        const targetConvexVersion = options.convexVersion ?? (convexPatchAvailable ? latestConvexVersion : null);
        const convexNeedsUpdate = targetConvexVersion && currentConvexVersion !== targetConvexVersion;

        // Nothing to update
        if (!sdkNeedsUpdate && !sdkNeedsInstall && !convexNeedsUpdate && !convexPatchAvailable) {
          printSuccess("All packages are up to date!");
          return;
        }

        // Update Cortex SDK if needed
        if (sdkNeedsUpdate || sdkNeedsInstall) {
          console.log();
          printInfo(`${sdkNeedsInstall ? "Installing" : "Updating"} @cortexmemory/sdk@${targetSdkVersion}...`);
          console.log();

          const exitCode = await execCommandLive("npm", [
            "install",
            `@cortexmemory/sdk@${targetSdkVersion}`,
          ], { cwd: projectPath });

          if (exitCode === 0) {
            printSuccess(`${sdkNeedsInstall ? "Installed" : "Updated"} @cortexmemory/sdk to ${targetSdkVersion}`);
          } else {
            printError("SDK update failed");
            process.exit(1);
          }
        } else if (currentSdkVersion !== "not installed") {
          printSuccess("@cortexmemory/sdk is already up to date");
        }

        // Check for Convex patch update
        if (convexPatchAvailable && !options.convexVersion) {
          console.log();
          console.log(pc.cyan(`  Convex patch update available: ${currentConvexVersion} → ${latestConvexVersion}`));
          
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

            const exitCode = await execCommandLive("npm", [
              "install",
              `convex@${latestConvexVersion}`,
            ], { cwd: projectPath });

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

          const exitCode = await execCommandLive("npm", [
            "install",
            `convex@${options.convexVersion}`,
          ], { cwd: projectPath });

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
        printError(error instanceof Error ? error.message : "Update failed");
        process.exit(1);
      }
    });
}
