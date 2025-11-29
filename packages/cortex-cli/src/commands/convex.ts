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
import { resolveConfig } from "../utils/config.js";
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
 * Execute a command with live output
 */
async function execCommandLive(
  command: string,
  args: string[],
  options?: { cwd?: string },
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      stdio: "inherit",
      shell: true,
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
  config: CLIConfig,
): void {
  const convex = program
    .command("convex")
    .description("Manage Convex deployments");

  // convex status
  convex
    .command("status")
    .description("Check Convex deployment status")
    .action(async () => {
      const globalOpts = program.opts();

      const spinner = ora("Checking deployment status...").start();

      try {
        const info = getDeploymentInfo(config, globalOpts);

        spinner.stop();

        printSection("Convex Deployment Status", {
          "URL": info.url,
          "Deployment": info.deployment ?? "-",
          "Deploy Key": info.hasKey ? "✓ Configured" : "✗ Not set",
          "Mode": info.isLocal ? "Local" : "Cloud",
        });

        // Try to get more info from Convex CLI
        const result = await execCommand("npx", ["convex", "dashboard", "--print-url"], {
          quiet: true,
        });

        if (result.exitCode === 0 && result.stdout.trim()) {
          console.log(`  Dashboard: ${result.stdout.trim()}`);
        }

        // Test connection
        const { testConnection } = await import("../utils/client.js");
        const connectionResult = await testConnection(config, globalOpts);

        console.log();
        if (connectionResult.connected) {
          printSuccess(`Connection OK (${connectionResult.latency}ms latency)`);
        } else {
          printError(`Connection failed: ${connectionResult.error}`);
        }
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Status check failed");
        process.exit(1);
      }
    });

  // convex deploy
  convex
    .command("deploy")
    .description("Deploy schema and functions to Convex")
    .option("-l, --local", "Deploy to local Convex instance")
    .option("-p, --prod", "Deploy to production")
    .option("--push", "Push without prompts", false)
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        const info = getDeploymentInfo(config, globalOpts);

        console.log();
        printInfo(`Deploying to ${info.isLocal ? "local" : "cloud"} Convex...`);
        console.log();

        const args = ["convex", "deploy"];

        if (options.local || info.isLocal) {
          const resolved = resolveConfig(config, globalOpts);
          args.push("--url", resolved.url);
        }

        if (options.prod) {
          args.push("--prod");
        }

        if (options.push) {
          args.push("--yes");
        }

        const exitCode = await execCommandLive("npx", args);

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
    .option("-l, --local", "Use local Convex instance")
    .option("--once", "Run once and exit", false)
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        const info = getDeploymentInfo(config, globalOpts);

        console.log();
        printInfo(
          `Starting Convex dev server (${info.isLocal ? "local" : "cloud"})...`,
        );
        console.log();

        const args = ["convex", "dev"];

        if (options.local || info.isLocal) {
          const resolved = resolveConfig(config, globalOpts);
          args.push("--url", resolved.url);
        }

        if (options.once) {
          args.push("--once", "--until-success");
        }

        await execCommandLive("npx", args);
      } catch (error) {
        printError(error instanceof Error ? error.message : "Dev server failed");
        process.exit(1);
      }
    });

  // convex logs
  convex
    .command("logs")
    .description("View Convex deployment logs")
    .option("-l, --local", "View local logs")
    .option("-p, --prod", "View production logs")
    .option("-t, --tail", "Tail logs continuously")
    .option("-n, --lines <number>", "Number of lines to show", "50")
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        const info = getDeploymentInfo(config, globalOpts);

        console.log();
        printInfo(`Viewing ${info.isLocal ? "local" : "cloud"} logs...`);
        console.log();

        const args = ["convex", "logs"];

        if (options.local || info.isLocal) {
          const resolved = resolveConfig(config, globalOpts);
          args.push("--url", resolved.url);
        }

        if (options.prod) {
          args.push("--prod");
        }

        await execCommandLive("npx", args);
      } catch (error) {
        printError(error instanceof Error ? error.message : "Logs failed");
        process.exit(1);
      }
    });

  // convex dashboard
  convex
    .command("dashboard")
    .description("Open Convex dashboard in browser")
    .option("-l, --local", "Open local dashboard")
    .option("-p, --prod", "Open production dashboard")
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        const info = getDeploymentInfo(config, globalOpts);

        printInfo("Opening Convex dashboard...");

        const args = ["convex", "dashboard"];

        if (options.local || info.isLocal) {
          const resolved = resolveConfig(config, globalOpts);
          args.push("--url", resolved.url);
        }

        if (options.prod) {
          args.push("--prod");
        }

        await execCommandLive("npx", args);
      } catch (error) {
        printError(error instanceof Error ? error.message : "Dashboard failed");
        process.exit(1);
      }
    });

  // convex update-sdk
  convex
    .command("update-sdk")
    .description("Update @cortexmemory/sdk to latest version")
    .option("-v, --version <version>", "Specific version to install")
    .option("--latest", "Install latest version", true)
    .action(async (options) => {
      const spinner = ora("Checking for SDK updates...").start();

      try {
        // Get current version
        let currentVersion = "unknown";
        try {
          const result = await execCommand(
            "npm",
            ["list", "@cortexmemory/sdk", "--json"],
            { quiet: true },
          );
          const data = JSON.parse(result.stdout);
          currentVersion =
            data.dependencies?.["@cortexmemory/sdk"]?.version ?? "not installed";
        } catch {
          // Ignore errors
        }

        // Get latest version from npm
        let latestVersion = "unknown";
        try {
          const result = await execCommand(
            "npm",
            ["view", "@cortexmemory/sdk", "version"],
            { quiet: true },
          );
          latestVersion = result.stdout.trim();
        } catch {
          // Ignore errors
        }

        spinner.stop();

        console.log();
        printSection("Cortex SDK Version", {
          "Current": currentVersion,
          "Latest": latestVersion,
        });

        const targetVersion = options.version ?? latestVersion;

        if (currentVersion === targetVersion) {
          printSuccess("SDK is already up to date!");
          return;
        }

        console.log();
        printInfo(`Installing @cortexmemory/sdk@${targetVersion}...`);
        console.log();

        const exitCode = await execCommandLive("npm", [
          "install",
          `@cortexmemory/sdk@${targetVersion}`,
        ]);

        if (exitCode === 0) {
          console.log();
          printSuccess(`Updated SDK to version ${targetVersion}`);

          // Check if Convex peer dependency is satisfied
          printInfo("Checking Convex peer dependency...");
          const convexResult = await execCommand(
            "npm",
            ["list", "convex", "--json"],
            { quiet: true },
          );
          const convexData = JSON.parse(convexResult.stdout);
          const convexVersion =
            convexData.dependencies?.convex?.version ?? "not found";
          console.log(`  Convex version: ${convexVersion}`);
        } else {
          printError("SDK update failed");
          process.exit(1);
        }
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
        printError(error instanceof Error ? error.message : "Schema info failed");
        process.exit(1);
      }
    });

  // convex init
  convex
    .command("init")
    .description("Initialize Convex in current project")
    .action(async () => {
      console.log();
      printInfo("Initializing Convex...");
      console.log();

      const exitCode = await execCommandLive("npx", ["convex", "dev", "--once"]);

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
    .option("-l, --list", "List environment variables")
    .option("-s, --set <key=value>", "Set environment variable")
    .option("-p, --prod", "Use production environment")
    .action(async (options) => {
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

        await execCommandLive("npx", args);
      } catch (error) {
        printError(error instanceof Error ? error.message : "Env command failed");
        process.exit(1);
      }
    });
}
