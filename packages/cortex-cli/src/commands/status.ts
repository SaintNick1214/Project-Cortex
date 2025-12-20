/**
 * Status Dashboard Command
 *
 * Displays a comprehensive status dashboard showing:
 * - All configured deployments
 * - Convex backend status per deployment
 * - Graph database status per deployment
 * - SDK version info
 * - Connection health
 */

import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CLIConfig, DeploymentConfig } from "../types.js";
import type { SetupStatus } from "../utils/init/types.js";
import { execCommand } from "../utils/shell.js";
import { formatOutput } from "../utils/formatting.js";

/**
 * Status for a single deployment
 */
interface DeploymentStatus {
  name: string;
  isDefault: boolean;
  isEnabled: boolean;
  url: string;
  hasKey: boolean;
  projectPath?: string;
  projectExists: boolean;
  convexFolder: boolean;
  graphConfigured: boolean;
  graphRunning: boolean;
  graphType?: string;
  convexRunning: boolean;
}

/**
 * Multi-deployment status dashboard
 */
interface MultiDeploymentDashboard {
  deployments: DeploymentStatus[];
  sdkVersion: {
    current: string | null;
    latest: string | null;
    upToDate: boolean;
  };
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
    quiet: options.quiet ?? true,
  });

  const timeoutPromise = new Promise<{
    stdout: string;
    stderr: string;
    code: number;
  }>((resolve) => {
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
    .description("Show Cortex setup status dashboard for all deployments")
    .option(
      "-d, --deployment <name>",
      "Show status for specific deployment only",
    )
    .option("--check", "Run health checks", false)
    .option(
      "-f, --format <format>",
      "Output format: dashboard, json",
      "dashboard",
    )
    .action(async (options) => {
      try {
        const spinner = ora("Gathering status information...").start();
        const status = await gatherMultiDeploymentStatus(
          config,
          options.deployment,
          options.check,
        );
        spinner.stop();

        if (options.format === "json") {
          console.log(formatOutput(status, "json"));
        } else {
          displayMultiDeploymentDashboard(status);
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
 * Gather status for all configured deployments
 */
async function gatherMultiDeploymentStatus(
  config: CLIConfig,
  specificDeployment: string | undefined,
  _runChecks: boolean,
): Promise<MultiDeploymentDashboard> {
  const deploymentStatuses: DeploymentStatus[] = [];

  // Get deployments to check
  const deploymentEntries = Object.entries(config.deployments || {});

  if (deploymentEntries.length === 0) {
    // No deployments configured
    return {
      deployments: [],
      sdkVersion: {
        current: null,
        latest: null,
        upToDate: false,
      },
    };
  }

  // Filter to specific deployment if requested
  const deploymentsToCheck = specificDeployment
    ? deploymentEntries.filter(([name]) => name === specificDeployment)
    : deploymentEntries;

  if (specificDeployment && deploymentsToCheck.length === 0) {
    throw new Error(`Deployment "${specificDeployment}" not found in config`);
  }

  for (const [name, deployment] of deploymentsToCheck) {
    const status = await gatherDeploymentStatus(
      name,
      deployment,
      config.default || "",
    );
    deploymentStatuses.push(status);
  }

  // Check SDK version (from current directory)
  const sdkVersion = await checkSdkVersion();

  return {
    deployments: deploymentStatuses,
    sdkVersion,
  };
}

/**
 * Gather status for a single deployment
 */
async function gatherDeploymentStatus(
  name: string,
  deployment: DeploymentConfig,
  defaultDeployment: string,
): Promise<DeploymentStatus> {
  const isDefault = name === defaultDeployment;
  const isEnabled =
    deployment.enabled === true ||
    (deployment.enabled === undefined && isDefault);

  const status: DeploymentStatus = {
    name,
    isDefault,
    isEnabled,
    url: deployment.url,
    hasKey: Boolean(deployment.key),
    projectPath: deployment.projectPath,
    projectExists: false,
    convexFolder: false,
    graphConfigured: false,
    graphRunning: false,
    convexRunning: false,
  };

  // Check if project path exists
  if (deployment.projectPath) {
    status.projectExists = existsSync(deployment.projectPath);

    if (status.projectExists) {
      // Check for convex folder
      status.convexFolder = existsSync(join(deployment.projectPath, "convex"));

      // Check for graph docker-compose
      const dockerComposeExists = existsSync(
        join(deployment.projectPath, "docker-compose.graph.yml"),
      );
      if (dockerComposeExists) {
        status.graphConfigured = true;

        // Try to detect graph type from file
        try {
          const composeContent = readFileSync(
            join(deployment.projectPath, "docker-compose.graph.yml"),
            "utf-8",
          );
          status.graphType = composeContent.includes("memgraph")
            ? "memgraph"
            : "neo4j";
        } catch {
          status.graphType = "unknown";
        }

        // Check if graph container is running
        try {
          const containerName = `cortex-${status.graphType || "neo4j"}`;
          const result = await execWithTimeout(
            "docker",
            [
              "ps",
              "--filter",
              `name=${containerName}`,
              "--format",
              "{{.Status}}",
            ],
            { timeoutMs: 3000 },
          );
          status.graphRunning = result.stdout.includes("Up");
        } catch {
          // Docker not available
        }
      }

      // Check if Convex dev server is running (check PID file)
      const pidFile = join(deployment.projectPath, ".convex-dev.pid");
      if (existsSync(pidFile)) {
        try {
          const pid = readFileSync(pidFile, "utf-8").trim();
          process.kill(parseInt(pid), 0);
          status.convexRunning = true;
        } catch {
          status.convexRunning = false;
        }
      }
    }
  }

  return status;
}

/**
 * Check SDK version
 */
async function checkSdkVersion(): Promise<{
  current: string | null;
  latest: string | null;
  upToDate: boolean;
}> {
  const cwd = process.cwd();
  const result = {
    current: null as string | null,
    latest: null as string | null,
    upToDate: false,
  };

  try {
    const currentResult = await execWithTimeout(
      "npm",
      ["list", "@cortexmemory/sdk", "--json"],
      { cwd, timeoutMs: 5000 },
    );
    if (currentResult.code === 0) {
      const data = JSON.parse(currentResult.stdout);
      result.current =
        data.dependencies?.["@cortexmemory/sdk"]?.version || null;
    }

    if (currentResult.code !== -1) {
      const latestResult = await execWithTimeout(
        "npm",
        ["view", "@cortexmemory/sdk", "version"],
        { timeoutMs: 3000 },
      );
      if (latestResult.code === 0 && latestResult.stdout) {
        result.latest = latestResult.stdout.trim();
      }
    }

    result.upToDate = result.current === result.latest || !result.latest;
  } catch {
    // Ignore version check errors
  }

  return result;
}

/**
 * Display the multi-deployment status dashboard
 */
function displayMultiDeploymentDashboard(
  status: MultiDeploymentDashboard,
): void {
  const width = 60;
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

  // Deployments Section
  if (status.deployments.length === 0) {
    console.log(pc.bold(pc.white("  Deployments")));
    console.log(pc.dim("  " + thinLine));
    console.log(pc.dim("   No deployments configured"));
    console.log();
    console.log(pc.yellow("   Run 'cortex init' to set up a new project"));
    console.log(
      pc.yellow("   Or 'cortex config add-deployment' to add existing"),
    );
    console.log();
  } else {
    // Count enabled deployments
    const enabledCount = status.deployments.filter((d) => d.isEnabled).length;
    const runningCount = status.deployments.filter(
      (d) => d.convexRunning,
    ).length;

    console.log(
      pc.bold(
        pc.white(
          `  Deployments (${enabledCount} enabled, ${runningCount} running)`,
        ),
      ),
    );
    console.log(pc.dim("  " + thinLine));
    console.log();

    for (const deployment of status.deployments) {
      displayDeploymentStatus(deployment);
    }
  }

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
    printStatusLine(
      "not_configured",
      "Not installed in current directory",
      "Run npm install",
    );
  }
  console.log();

  // Quick actions
  console.log(pc.bold(pc.white("  Quick Actions")));
  console.log(pc.dim("  " + thinLine));
  console.log(
    pc.dim("   cortex start") +
      pc.dim("            # Start all enabled deployments"),
  );
  console.log(
    pc.dim("   cortex start -d <name>") +
      pc.dim("  # Start specific deployment"),
  );
  console.log(
    pc.dim("   cortex config list") + pc.dim("      # List all deployments"),
  );
  console.log(
    pc.dim("   cortex config enable <name>") +
      pc.dim("  # Enable a deployment"),
  );
  console.log();
}

/**
 * Display status for a single deployment
 */
function displayDeploymentStatus(deployment: DeploymentStatus): void {
  // Name line with indicators
  const defaultBadge = deployment.isDefault ? pc.cyan(" (default)") : "";
  const enabledBadge = deployment.isEnabled
    ? pc.green(" [enabled]")
    : pc.dim(" [disabled]");

  console.log(`   ${pc.bold(deployment.name)}${defaultBadge}${enabledBadge}`);

  // URL and key
  const keyStatus = deployment.hasKey ? pc.green("✓ key") : pc.dim("no key");
  console.log(`   ${pc.dim("URL:")} ${deployment.url} ${keyStatus}`);

  // Project path and status
  if (deployment.projectPath) {
    const pathStatus = deployment.projectExists
      ? pc.green("✓")
      : pc.red("✗ not found");
    console.log(
      `   ${pc.dim("Path:")} ${deployment.projectPath} ${pathStatus}`,
    );
  } else {
    console.log(`   ${pc.dim("Path:")} ${pc.dim("not set (remote only)")}`);
  }

  // Convex status
  if (deployment.projectExists) {
    const convexIndicator = getStatusIndicator(
      deployment.convexRunning
        ? "ok"
        : deployment.convexFolder
          ? "warning"
          : "not_configured",
    );
    const convexStatus = deployment.convexRunning
      ? "Running"
      : deployment.convexFolder
        ? "Configured (not running)"
        : "No convex/ folder";
    console.log(`   ${pc.dim("Convex:")} ${convexIndicator} ${convexStatus}`);
  }

  // Graph status
  if (deployment.projectExists) {
    const graphIndicator = getStatusIndicator(
      deployment.graphRunning
        ? "ok"
        : deployment.graphConfigured
          ? "warning"
          : "not_configured",
    );
    const graphStatus = deployment.graphRunning
      ? `Running (${deployment.graphType})`
      : deployment.graphConfigured
        ? `Configured (${deployment.graphType}, not running)`
        : "Not configured";
    console.log(`   ${pc.dim("Graph:")} ${graphIndicator} ${graphStatus}`);
  }

  console.log();
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
