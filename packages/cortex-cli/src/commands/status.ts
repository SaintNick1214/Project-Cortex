/**
 * Status Dashboard Command
 *
 * Displays a comprehensive status dashboard showing:
 * - Environment variables
 * - Convex backend status
 * - Graph database status
 * - SDK version info
 * - Connection health
 */

import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CLIConfig } from "../types.js";
import type { StatusDashboard, SetupStatus } from "../utils/init/types.js";
import { testConnection } from "../utils/client.js";
import { execCommand } from "../utils/shell.js";
import { formatOutput } from "../utils/formatting.js";

/**
 * Load environment variables from .env.local file
 */
function loadEnvFile(cwd: string): Record<string, string> {
  const envVars: Record<string, string> = {};
  const envPath = join(cwd, ".env.local");
  
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIndex = trimmed.indexOf("=");
          if (eqIndex > 0) {
            const key = trimmed.substring(0, eqIndex).trim();
            const value = trimmed.substring(eqIndex + 1).trim();
            envVars[key] = value;
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  
  return envVars;
}

/**
 * Execute command with timeout
 */
async function execWithTimeout(
  command: string,
  args: string[],
  options: { cwd?: string; quiet?: boolean; timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  const timeoutMs = options.timeoutMs ?? 5000;
  
  const resultPromise = execCommand(command, args, { 
    cwd: options.cwd, 
    quiet: options.quiet ?? true 
  });
  
  const timeoutPromise = new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    setTimeout(() => {
      resolve({ stdout: "", stderr: "Timeout", code: -1 });
    }, timeoutMs);
  });
  
  return Promise.race([resultPromise, timeoutPromise]);
}

/**
 * Register status commands
 */
export function registerStatusCommands(
  program: Command,
  config: CLIConfig,
): void {
  program
    .command("status")
    .description("Show Cortex setup status dashboard")
    .option("--check", "Run health checks", false)
    .option("-f, --format <format>", "Output format: dashboard, json", "dashboard")
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        const spinner = ora("Gathering status information...").start();
        const status = await gatherStatus(config, globalOpts, options.check);
        spinner.stop();

        if (options.format === "json") {
          console.log(formatOutput(status, "json"));
        } else {
          displayDashboard(status);
        }
      } catch (error) {
        console.error(
          pc.red("\n   Error:"),
          error instanceof Error ? error.message : "Unknown error",
        );
        process.exit(1);
      }
    });
}

/**
 * Gather all status information
 */
async function gatherStatus(
  config: CLIConfig,
  globalOpts: Record<string, unknown>,
  runChecks: boolean,
): Promise<StatusDashboard> {
  const cwd = process.cwd();
  
  // Load .env.local from current directory
  const envFile = loadEnvFile(cwd);
  
  // Merge with process.env (process.env takes precedence)
  const convexUrl = process.env.CONVEX_URL || envFile.CONVEX_URL || 
                    process.env.LOCAL_CONVEX_URL || envFile.LOCAL_CONVEX_URL || null;
  const convexDeployKey = process.env.CONVEX_DEPLOY_KEY || envFile.CONVEX_DEPLOY_KEY || null;
  const neo4jUri = process.env.NEO4J_URI || envFile.NEO4J_URI || null;
  const openaiKey = process.env.OPENAI_API_KEY || envFile.OPENAI_API_KEY || null;
  
  const status: StatusDashboard = {
    environment: {
      convexUrl,
      convexDeployKey: Boolean(convexDeployKey),
      neo4jUri,
      openaiKey: Boolean(openaiKey),
    },
    convexBackend: {
      status: "not_configured",
      message: "Not checked",
    },
    graphDatabase: {
      status: "not_configured",
      message: "Not configured",
    },
    sdkVersion: {
      current: null,
      latest: null,
      upToDate: false,
    },
    connection: {
      status: "not_configured",
    },
  };

  // Check Convex backend
  const convexFolderExists = existsSync(join(cwd, "convex"));
  const envLocalExists = existsSync(join(cwd, ".env.local"));

  if (convexFolderExists) {
    // Count function files
    const functionCount = await countConvexFunctions();
    
    // Check if Convex dev server is running (check PID file)
    const pidFile = join(cwd, ".convex-dev.pid");
    let isRunning = false;
    if (existsSync(pidFile)) {
      try {
        const pid = readFileSync(pidFile, "utf-8").trim();
        process.kill(parseInt(pid), 0);
        isRunning = true;
      } catch {
        isRunning = false;
      }
    }
    
    status.convexBackend = {
      status: isRunning ? "ok" : "warning",
      message: isRunning ? "Running" : "Configured (not running)",
      functionCount,
    };
  } else if (envLocalExists && convexUrl) {
    status.convexBackend = {
      status: "warning",
      message: "Configured (convex/ folder missing)",
    };
  } else {
    status.convexBackend = {
      status: "not_configured",
      message: "Run 'cortex init' to set up",
    };
  }

  // Check graph database
  const dockerComposeExists = existsSync(join(cwd, "docker-compose.graph.yml"));
  
  if (neo4jUri || dockerComposeExists) {
    // Check if Docker container is running
    let containerRunning = false;
    const graphType = neo4jUri?.includes("memgraph") ? "memgraph" : "neo4j";
    
    try {
      const result = await execWithTimeout(
        "docker",
        ["ps", "--filter", `name=cortex-${graphType}`, "--format", "{{.Status}}"],
        { timeoutMs: 3000 },
      );
      containerRunning = result.stdout.includes("Up");
    } catch {
      // Docker not available or timeout
    }
    
    if (containerRunning) {
      status.graphDatabase = {
        status: "ok",
        message: "Running",
        type: graphType,
      };
    } else if (dockerComposeExists) {
      status.graphDatabase = {
        status: "warning",
        message: "Configured (not running)",
        type: graphType,
      };
    } else {
      status.graphDatabase = {
        status: "warning",
        message: "Configured (external)",
        type: graphType,
      };
    }
  } else {
    status.graphDatabase = {
      status: "not_configured",
      message: "Optional - run 'cortex init' to configure",
    };
  }

  // Check SDK version (with timeout)
  try {
    const currentResult = await execWithTimeout(
      "npm",
      ["list", "@cortexmemory/sdk", "--json"],
      { cwd, timeoutMs: 5000 },
    );
    if (currentResult.code === 0) {
      const data = JSON.parse(currentResult.stdout);
      status.sdkVersion.current =
        data.dependencies?.["@cortexmemory/sdk"]?.version || null;
    }

    // Only check latest if we have network (skip if local-only)
    if (currentResult.code !== -1) {
      const latestResult = await execWithTimeout(
        "npm",
        ["view", "@cortexmemory/sdk", "version"],
        { timeoutMs: 3000 },
      );
      if (latestResult.code === 0 && latestResult.stdout) {
        status.sdkVersion.latest = latestResult.stdout.trim();
      }
    }

    status.sdkVersion.upToDate =
      status.sdkVersion.current === status.sdkVersion.latest ||
      !status.sdkVersion.latest;
  } catch {
    // Ignore version check errors
  }

  // Check connection if requested (with timeout)
  if (runChecks && convexUrl) {
    try {
      const connectionResult = await Promise.race([
        testConnection(config, globalOpts),
        new Promise<{ connected: false; error: string; latency?: number }>((resolve) =>
          setTimeout(() => resolve({ connected: false, error: "Connection timeout" }), 5000)
        ),
      ]);
      status.connection = {
        status: connectionResult.connected ? "ok" : "error",
        latency: "latency" in connectionResult ? connectionResult.latency : undefined,
        error: connectionResult.error,
      };
    } catch (error) {
      status.connection = {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  } else if (convexUrl) {
    status.connection = {
      status: "warning",
      error: "Run with --check to test connection",
    };
  }

  return status;
}

/**
 * Count Convex function files
 */
async function countConvexFunctions(): Promise<number> {
  const convexPath = join(process.cwd(), "convex");
  if (!existsSync(convexPath)) return 0;

  try {
    const { readdir } = await import("fs/promises");
    const files = await readdir(convexPath);
    return files.filter((f) => f.endsWith(".ts") && f !== "schema.ts").length;
  } catch {
    return 0;
  }
}

/**
 * Display the status dashboard
 */
function displayDashboard(status: StatusDashboard): void {
  const width = 52;
  const line = "═".repeat(width);
  const thinLine = "─".repeat(width);

  console.log();
  console.log(pc.cyan("╔" + line + "╗"));
  console.log(
    pc.cyan("║") +
      pc.bold("   Cortex Memory Status Dashboard").padEnd(width) +
      pc.cyan("║"),
  );
  console.log(pc.cyan("╚" + line + "╝"));
  console.log();

  // Environment Section
  console.log(pc.bold(pc.white("  Environment")));
  console.log(pc.dim("  " + thinLine));
  printEnvVar("CONVEX_URL", status.environment.convexUrl);
  printEnvVar(
    "CONVEX_DEPLOY_KEY",
    status.environment.convexDeployKey ? "***" : null,
  );
  printEnvVar("NEO4J_URI", status.environment.neo4jUri);
  printEnvVar("OPENAI_API_KEY", status.environment.openaiKey ? "***" : null);
  console.log();

  // Convex Backend Section
  console.log(pc.bold(pc.white("  Convex Backend")));
  console.log(pc.dim("  " + thinLine));
  printStatusLine(
    status.convexBackend.status,
    status.convexBackend.message,
    status.convexBackend.functionCount
      ? `${status.convexBackend.functionCount} functions`
      : undefined,
  );
  console.log();

  // Graph Database Section
  console.log(pc.bold(pc.white("  Graph Database")));
  console.log(pc.dim("  " + thinLine));
  printStatusLine(
    status.graphDatabase.status,
    status.graphDatabase.message,
    status.graphDatabase.type,
  );
  console.log();

  // SDK Version Section
  console.log(pc.bold(pc.white("  SDK Version")));
  console.log(pc.dim("  " + thinLine));
  if (status.sdkVersion.current) {
    const versionStatus = status.sdkVersion.upToDate ? "ok" : "warning";
    const versionMsg = status.sdkVersion.upToDate
      ? "Up to date"
      : `Update available: ${status.sdkVersion.latest}`;
    printStatusLine(versionStatus, `v${status.sdkVersion.current}`, versionMsg);
  } else {
    printStatusLine("not_configured", "Not installed", "Run npm install");
  }
  console.log();

  // Connection Section
  console.log(pc.bold(pc.white("  Connection")));
  console.log(pc.dim("  " + thinLine));
  if (status.connection.status === "ok") {
    printStatusLine("ok", "Connected", `${status.connection.latency}ms latency`);
  } else if (status.connection.status === "error") {
    printStatusLine("error", "Failed", status.connection.error);
  } else if (status.connection.status === "warning") {
    printStatusLine("warning", "Not tested", status.connection.error);
  } else {
    printStatusLine("not_configured", "No URL configured", "Run cortex init");
  }
  console.log();

  // Quick actions
  console.log(pc.bold(pc.white("  Quick Actions")));
  console.log(pc.dim("  " + thinLine));
  console.log(
    pc.dim("   cortex init") + pc.dim("             # Initialize project"),
  );
  console.log(
    pc.dim("   cortex setup") + pc.dim("            # Configure deployments"),
  );
  console.log(
    pc.dim("   cortex convex status") + pc.dim("    # Detailed Convex status"),
  );
  console.log(
    pc.dim("   cortex db stats") + pc.dim("         # Database statistics"),
  );
  console.log();
}

/**
 * Print an environment variable line
 */
function printEnvVar(name: string, value: string | null): void {
  const nameStr = `   ${name}:`.padEnd(24);
  const valueStr = value || pc.dim("Not set");
  console.log(nameStr + valueStr);
}

/**
 * Print a status line with indicator
 */
function printStatusLine(
  status: SetupStatus,
  message: string,
  extra?: string,
): void {
  const indicator = getStatusIndicator(status);
  const extraStr = extra ? pc.dim(` (${extra})`) : "";
  console.log(`   ${indicator} ${message}${extraStr}`);
}

/**
 * Get colored status indicator
 */
function getStatusIndicator(status: SetupStatus): string {
  switch (status) {
    case "ok":
      return pc.green("●");
    case "warning":
      return pc.yellow("●");
    case "error":
      return pc.red("●");
    case "not_configured":
    default:
      return pc.dim("○");
  }
}
