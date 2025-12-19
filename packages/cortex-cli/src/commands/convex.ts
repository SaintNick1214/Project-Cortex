/**
 * Convex Deployment Management Commands
 *
 * Commands for managing Convex deployments:
 * - deploy: Deploy schema updates
 * - status: Check deployment status
 * - logs: View logs
 * - update-sdk: Update SDK version
 * - schema: Schema operations
 */

import { Command } from "commander";
import ora from "ora";
import { spawn } from "child_process";
import type { CLIConfig } from "../types.js";
import { resolveConfig, loadConfig } from "../utils/config.js";
import { selectDeployment } from "../utils/deployment-selector.js";
import { getDeploymentInfo } from "../utils/client.js";
import {
  printSuccess,
  printError,
  printWarning,
  printSection,
  printInfo,
} from "../utils/formatting.js";
import pc from "picocolors";

/**
 * Execute a command and return the output
 */
async function execCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; quiet?: boolean },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    const child = spawn(command, args, {
      cwd: options?.cwd,
      shell: true,
    });

    child.stdout?.on("data", (data: Buffer) => {
      const str = data.toString();
      stdout += str;
      if (!options?.quiet) {
        process.stdout.write(str);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const str = data.toString();
      stderr += str;
      if (!options?.quiet) {
        process.stderr.write(str);
      }
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    child.on("error", (error) => {
      stderr += error.message;
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}

/**
 * Build a clean environment for Convex commands.
 * Removes inherited CONVEX_* variables so the target project's .env.local is used,
 * then applies any explicit overrides.
 */
function buildConvexEnv(overrides?: Record<string, string>): typeof process.env {
  const env = { ...process.env };
  
  // Remove inherited CONVEX_* variables that could conflict with target project
  const convexVars = Object.keys(env).filter(key => 
    key.startsWith('CONVEX_') || 
    key.startsWith('LOCAL_CONVEX_') || 
    key.startsWith('CLOUD_CONVEX_') ||
    key.startsWith('ENV_CONVEX_')
  );
  for (const key of convexVars) {
    delete env[key];
  }
  
  // Apply explicit overrides
  if (overrides) {
    Object.assign(env, overrides);
  }
  
  return env;
}

/**
 * Execute a command with live output
 */
async function execCommandLive(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string>; cleanConvexEnv?: boolean },
): Promise<number> {
  return new Promise((resolve) => {
    // Build environment: if cleanConvexEnv is true, remove inherited CONVEX_* vars
    const env = options?.cleanConvexEnv 
      ? buildConvexEnv(options.env) 
      : (options?.env ? { ...process.env, ...options.env } : process.env);

    const child = spawn(command, args, {
      cwd: options?.cwd,
      stdio: "inherit",
      shell: true,
      env,
    });

    child.on("close", (code) => {
      resolve(code ?? 0);
    });

    child.on("error", () => {
      resolve(1);
    });
  });
}

/**
 * Register Convex management commands
 */
export function registerConvexCommands(
  program: Command,
  _config: CLIConfig,
): void {
  const convex = program
    .command("convex")
    .description("Manage Convex deployments");

  // convex status
  convex
    .command("status")
    .description("Check Convex deployment status")
    .option("-d, --deployment <name>", "Target deployment")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "check status");
      if (!selection) return;

      const { name: targetName, deployment } = selection;
      const projectPath = deployment.projectPath || process.cwd();

      const spinner = ora("Checking deployment status...").start();

      try {
        const info = getDeploymentInfo(currentConfig, { deployment: targetName });

        spinner.stop();

        printSection("Convex Deployment Status", {
          URL: info.url,
          Deployment: info.deployment ?? "-",
          "Deploy Key": info.hasKey ? "✓ Configured" : "✗ Not set",
          Mode: info.isLocal ? "Local" : "Cloud",
          "Project Path": projectPath,
        });

        // Try to get more info from Convex CLI
        const result = await execCommand(
          "npx",
          ["convex", "dashboard", "--print-url"],
          {
            quiet: true,
            cwd: projectPath,
          },
        );

        if (result.exitCode === 0 && result.stdout.trim()) {
          console.log(`  Dashboard: ${result.stdout.trim()}`);
        }

        // Test connection
        const { testConnection } = await import("../utils/client.js");
        const connectionResult = await testConnection(currentConfig, { deployment: targetName });

        console.log();
        if (connectionResult.connected) {
          printSuccess(`Connection OK (${connectionResult.latency}ms latency)`);
        } else {
          printError(`Connection failed: ${connectionResult.error}`);
        }
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Status check failed",
        );
        process.exit(1);
      }
    });

  // convex deploy
  convex
    .command("deploy")
    .description("Deploy schema and functions to Convex")
    .option("-d, --deployment <name>", "Target deployment")
    .option("-l, --local", "Deploy to local Convex instance")
    .option("-p, --prod", "Deploy to production")
    .option("--push", "Push without prompts", false)
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
        console.log();

        const args = ["convex", "deploy"];

        // Build environment variables for the Convex command
        // This ensures we use the config values, not inherited env vars from parent process
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

        const exitCode = await execCommandLive("npx", args, { 
          cwd: projectPath,
          env: convexEnv,
          cleanConvexEnv: true, // Remove inherited CONVEX_* vars from parent process
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

  // convex dev
  convex
    .command("dev")
    .description("Start Convex in development mode")
    .option("-d, --deployment <name>", "Target deployment")
    .option("-l, --local", "Use local Convex instance")
    .option("--once", "Run once and exit", false)
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "start dev");
      if (!selection) return;

      const { name: targetName, deployment } = selection;
      const projectPath = deployment.projectPath || process.cwd();

      try {
        const info = getDeploymentInfo(currentConfig, { deployment: targetName });

        console.log();
        printInfo(
          `Starting Convex dev server (${info.isLocal ? "local" : "cloud"})...`,
        );
        printInfo(`Project: ${projectPath}`);
        console.log();

        const args = ["convex", "dev"];

        if (options.local || info.isLocal) {
          const resolved = resolveConfig(currentConfig, { deployment: targetName });
          args.push("--url", resolved.url);
        }

        if (options.once) {
          args.push("--once", "--until-success");
        }

        await execCommandLive("npx", args, { 
          cwd: projectPath, 
          cleanConvexEnv: true,
        });
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Dev server failed",
        );
        process.exit(1);
      }
    });

  // convex logs
  convex
    .command("logs")
    .description("View Convex deployment logs")
    .option("-d, --deployment <name>", "Target deployment")
    .option("-l, --local", "View local logs")
    .option("-p, --prod", "View production logs")
    .option("-t, --tail", "Tail logs continuously")
    .option("-n, --lines <number>", "Number of lines to show", "50")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "view logs");
      if (!selection) return;

      const { name: targetName, deployment } = selection;
      const projectPath = deployment.projectPath || process.cwd();

      try {
        const info = getDeploymentInfo(currentConfig, { deployment: targetName });

        console.log();
        printInfo(`Viewing ${info.isLocal ? "local" : "cloud"} logs...`);
        console.log();

        const args = ["convex", "logs"];

        if (options.local || info.isLocal) {
          const resolved = resolveConfig(currentConfig, { deployment: targetName });
          args.push("--url", resolved.url);
        }

        if (options.prod) {
          args.push("--prod");
        }

        await execCommandLive("npx", args, { 
          cwd: projectPath, 
          cleanConvexEnv: true,
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Logs failed");
        process.exit(1);
      }
    });

  // convex dashboard
  convex
    .command("dashboard")
    .description("Open Convex dashboard in browser")
    .option("-d, --deployment <name>", "Target deployment")
    .option("-l, --local", "Open local dashboard")
    .option("-p, --prod", "Open production dashboard")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "open dashboard");
      if (!selection) return;

      const { name: targetName, deployment } = selection;
      const projectPath = deployment.projectPath || process.cwd();

      try {
        const info = getDeploymentInfo(currentConfig, { deployment: targetName });

        printInfo("Opening Convex dashboard...");

        const args = ["convex", "dashboard"];

        if (options.local || info.isLocal) {
          const resolved = resolveConfig(currentConfig, { deployment: targetName });
          args.push("--url", resolved.url);
        }

        if (options.prod) {
          args.push("--prod");
        }

        await execCommandLive("npx", args, { 
          cwd: projectPath, 
          cleanConvexEnv: true,
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Dashboard failed");
        process.exit(1);
      }
    });

  // convex update (updates both Cortex SDK and Convex)
  convex
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

  // convex schema
  convex
    .command("schema")
    .description("View schema information")
    .action(async () => {
      const spinner = ora("Loading schema info...").start();

      try {
        // Run convex to get schema info
        spinner.stop();

        console.log();
        printInfo("Cortex SDK Schema Tables:");
        console.log();

        const tables = [
          {
            name: "conversations",
            description: "Immutable conversation history",
            layer: "Layer 1a",
          },
          {
            name: "immutable",
            description: "Versioned immutable data store",
            layer: "Layer 1b",
          },
          {
            name: "mutable",
            description: "Live operational data",
            layer: "Layer 1c",
          },
          {
            name: "memories",
            description: "Vector-searchable memories",
            layer: "Layer 2",
          },
          {
            name: "facts",
            description: "LLM-extracted facts",
            layer: "Layer 3",
          },
          {
            name: "memorySpaces",
            description: "Memory space registry",
            layer: "Coordination",
          },
          {
            name: "contexts",
            description: "Hierarchical context chains",
            layer: "Coordination",
          },
          {
            name: "agents",
            description: "Agent registry (deprecated)",
            layer: "Coordination",
          },
          {
            name: "governancePolicies",
            description: "Data retention policies",
            layer: "Governance",
          },
          {
            name: "governanceEnforcement",
            description: "Enforcement audit log",
            layer: "Governance",
          },
          {
            name: "graphSyncQueue",
            description: "Graph sync queue",
            layer: "Sync",
          },
        ];

        for (const table of tables) {
          console.log(
            `  ${pc.cyan(table.name.padEnd(22))} ${pc.dim(table.layer.padEnd(14))} ${table.description}`,
          );
        }

        console.log();
        printInfo(
          "Run 'cortex convex dashboard' to view full schema in Convex dashboard",
        );
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Schema info failed",
        );
        process.exit(1);
      }
    });

  // convex init
  convex
    .command("init")
    .description("Initialize Convex in current project")
    .option("-d, --deployment <name>", "Target deployment")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "initialize Convex");
      if (!selection) return;

      const { deployment } = selection;
      const projectPath = deployment.projectPath || process.cwd();

      console.log();
      printInfo("Initializing Convex...");
      printInfo(`Project: ${projectPath}`);
      console.log();

      const exitCode = await execCommandLive("npx", [
        "convex",
        "dev",
        "--once",
      ], { 
        cwd: projectPath, 
        cleanConvexEnv: true,
      });

      if (exitCode === 0) {
        console.log();
        printSuccess("Convex initialized successfully!");
        printInfo("Run 'cortex convex dev' to start the development server");
      } else {
        console.log();
        printWarning(
          "Convex initialization may require additional setup. Check the output above.",
        );
      }
    });

  // convex env
  convex
    .command("env")
    .description("Manage environment variables")
    .option("-d, --deployment <name>", "Target deployment")
    .option("-l, --list", "List environment variables")
    .option("-s, --set <key=value>", "Set environment variable")
    .option("-p, --prod", "Use production environment")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "manage env");
      if (!selection) return;

      const { deployment } = selection;
      const projectPath = deployment.projectPath || process.cwd();

      try {
        const args = ["convex", "env"];

        if (options.list) {
          args.push("list");
        } else if (options.set) {
          const [key, value] = options.set.split("=");
          args.push("set", key, value);
        }

        if (options.prod) {
          args.push("--prod");
        }

        await execCommandLive("npx", args, { 
          cwd: projectPath, 
          cleanConvexEnv: true,
        });
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Env command failed",
        );
        process.exit(1);
      }
    });
}
