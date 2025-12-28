/**
 * Interactive Dev Mode Command
 *
 * Expo-style interactive terminal with:
 * - Multi-deployment support (all enabled deployments)
 * - Live status dashboard
 * - Aggregated streaming logs from all instances
 * - Keyboard shortcuts for common actions
 */

import { Command } from "commander";
import { spawn, ChildProcess } from "child_process";
import pc from "picocolors";
import fs from "fs-extra";
import path from "path";
import type { CLIConfig, AppConfig } from "../types.js";
import { loadConfig } from "../utils/config.js";
import { commandExists, execCommand } from "../utils/shell.js";
import { runInitWizard } from "./init.js";

/**
 * State for a single deployment
 */
interface DeploymentState {
  name: string;
  url: string;
  key?: string;
  projectPath: string;
  isLocal: boolean;
  process: ChildProcess | null;
  convexRunning: boolean;
  graphRunning: boolean;
  graphType: "neo4j" | "memgraph" | null;
}

/**
 * State for a template app
 */
interface AppState {
  name: string;
  config: AppConfig;
  process: ChildProcess | null;
  running: boolean;
}

/**
 * Global dev mode state
 */
interface DevState {
  deployments: Map<string, DeploymentState>;
  apps: Map<string, AppState>;
  logs: string[];
  maxLogs: number;
  lastStatus: Date;
}

/**
 * Register dev commands
 */
export function registerDevCommands(
  program: Command,
  _config: CLIConfig,
): void {
  program
    .command("dev")
    .description("Start interactive development mode (Expo-style)")
    .option("-d, --deployment <name>", "Run specific deployment only")
    .option(
      "-l, --local",
      "Force local Convex instance for all deployments",
      false,
    )
    .action(async (options) => {
      const config = await loadConfig();
      await runInteractiveDevMode(config, options);
    });
}

/**
 * Collect deployments to run (same logic as start command)
 */
async function getDeploymentsToRun(
  config: CLIConfig,
  options: { deployment?: string; local?: boolean },
): Promise<DeploymentState[]> {
  const deployments: DeploymentState[] = [];

  if (options.deployment) {
    // Single deployment mode
    const deployment = config.deployments[options.deployment];

    if (!deployment) {
      console.error(
        pc.red(`\n   Deployment "${options.deployment}" not found`),
      );
      const names = Object.keys(config.deployments);
      if (names.length > 0) {
        console.log(pc.dim(`   Available: ${names.join(", ")}`));
      }
      process.exit(1);
    }

    const projectPath = deployment.projectPath || process.cwd();
    if (deployment.projectPath && !fs.existsSync(projectPath)) {
      console.error(pc.red(`\n   Project path not found: ${projectPath}`));
      process.exit(1);
    }

    // Check for graph config
    let graphType: "neo4j" | "memgraph" | null = null;
    const dockerComposePath = path.join(
      projectPath,
      "docker-compose.graph.yml",
    );
    if (fs.existsSync(dockerComposePath)) {
      const content = await fs.readFile(dockerComposePath, "utf-8");
      graphType = content.includes("memgraph") ? "memgraph" : "neo4j";
    }

    deployments.push({
      name: options.deployment,
      url: deployment.url,
      key: deployment.key,
      projectPath,
      isLocal: options.local || false,
      process: null,
      convexRunning: false,
      graphRunning: false,
      graphType,
    });
  } else {
    // All enabled deployments
    for (const [name, deployment] of Object.entries(config.deployments)) {
      const isDefault = name === config.default;
      const isEnabled =
        deployment.enabled === true ||
        (deployment.enabled === undefined && isDefault);

      if (!isEnabled) continue;

      if (!deployment.projectPath) {
        console.log(
          pc.yellow(`   Skipping "${name}" - no projectPath configured`),
        );
        continue;
      }

      if (!fs.existsSync(deployment.projectPath)) {
        console.log(pc.yellow(`   Skipping "${name}" - projectPath not found`));
        continue;
      }

      // Check for graph config
      let graphType: "neo4j" | "memgraph" | null = null;
      const dockerComposePath = path.join(
        deployment.projectPath,
        "docker-compose.graph.yml",
      );
      if (fs.existsSync(dockerComposePath)) {
        const content = await fs.readFile(dockerComposePath, "utf-8");
        graphType = content.includes("memgraph") ? "memgraph" : "neo4j";
      }

      deployments.push({
        name,
        url: deployment.url,
        key: deployment.key,
        projectPath: deployment.projectPath,
        isLocal: options.local || false,
        process: null,
        convexRunning: false,
        graphRunning: false,
        graphType,
      });
    }
  }

  return deployments;
}

/**
 * Show prompt when no deployments configured
 */
async function showNotConfiguredPrompt(): Promise<boolean> {
  console.clear();
  console.log(pc.bold(pc.yellow("\n   ⚠ No Deployments Configured\n")));
  console.log(
    pc.dim("   No enabled deployments found with valid project paths.\n"),
  );
  console.log(pc.dim("   This could mean:"));
  console.log(pc.dim("   • No deployments are enabled"));
  console.log(pc.dim("   • Deployments don't have projectPath set"));
  console.log(pc.dim("   • Project paths don't exist\n"));
  console.log(
    `   Press ${pc.bold(pc.green("i"))} to run ${pc.cyan("cortex init")} and set up a project`,
  );
  console.log(`   Press ${pc.bold(pc.red("q"))} to quit\n`);

  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
    }

    const handler = async (key: string) => {
      if (key === "i" || key === "I") {
        process.stdin.removeListener("data", handler);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.clear();
        try {
          await runInitWizard(process.cwd(), { start: false });
          resolve(true);
        } catch (error) {
          if (error instanceof Error && error.message === "Setup cancelled") {
            console.log(pc.yellow("\n   Setup cancelled.\n"));
          } else {
            console.error(pc.red("\n   Setup failed:"), error);
          }
          resolve(false);
        }
      } else if (key === "q" || key === "Q" || key === "\u0003") {
        process.stdin.removeListener("data", handler);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        console.log(pc.dim("\n   Goodbye!\n"));
        resolve(false);
      }
    };

    process.stdin.on("data", handler);
  });
}

/**
 * Run the interactive dev mode
 */
async function runInteractiveDevMode(
  config: CLIConfig,
  options: { deployment?: string; local?: boolean },
): Promise<void> {
  // Get deployments to run
  let deploymentsList = await getDeploymentsToRun(config, options);

  if (deploymentsList.length === 0) {
    const shouldContinue = await showNotConfiguredPrompt();
    if (!shouldContinue) {
      process.exit(0);
    }
    // Reload config and try again
    const newConfig = await loadConfig();
    deploymentsList = await getDeploymentsToRun(newConfig, options);
    if (deploymentsList.length === 0) {
      console.log(
        pc.red(
          "\n   Still no deployments configured. Please run 'cortex init' manually.\n",
        ),
      );
      process.exit(1);
    }
  }

  // Collect enabled apps
  const enabledApps = Object.entries(config.apps || {})
    .filter(([, app]) => app.enabled)
    .map(
      ([name, appConfig]): AppState => ({
        name,
        config: appConfig,
        process: null,
        running: false,
      }),
    );

  const state: DevState = {
    deployments: new Map(deploymentsList.map((d) => [d.name, d])),
    apps: new Map(enabledApps.map((a) => [a.name, a])),
    logs: [],
    maxLogs: 100,
    lastStatus: new Date(),
  };

  // Setup stdin for raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
  }

  // Clear screen and show initial status
  console.clear();
  await refreshStatus(state);
  showHelp();
  console.log(
    pc.dim("  Logs streaming below. Press 'c' to clear, '?' for help.\n"),
  );

  // Start all services
  await startAllServices(state);

  // Track shutdown state
  let shuttingDown = false;
  let shutdownInProgress = false;

  // Handle keyboard input
  process.stdin.on("data", async (key: string) => {
    switch (key) {
      case "c":
        // Clear screen
        state.logs = [];
        console.clear();
        await refreshStatus(state);
        showHelp();
        console.log(pc.dim("  Logs cleared.\n"));
        break;

      case "r":
        // Restart all services
        console.log(pc.yellow("\n  Restarting all services...\n"));
        await stopAllServices(state, false);
        state.logs = [];
        console.clear();
        await refreshStatus(state);
        showHelp();
        console.log(pc.dim("  Restarting...\n"));
        await startAllServices(state);
        break;

      case "g":
        // Toggle graph - show menu if multiple deployments
        await handleGraphToggle(state);
        break;

      case "s":
        // Show status
        console.clear();
        await refreshStatus(state);
        showHelp();
        console.log(pc.dim("  Logs streaming below...\n"));
        // Re-print recent logs
        for (const log of state.logs.slice(-20)) {
          console.log(`  ${log}`);
        }
        break;

      case "q":
        if (!shutdownInProgress) {
          shuttingDown = true;
          shutdownInProgress = true;
          console.log(pc.yellow("\n\n   Shutting down...\n"));
          await performShutdown(state, false);
        }
        break;

      case "\u0003": // Ctrl+C
        if (shutdownInProgress) {
          break;
        }
        if (shuttingDown) {
          shutdownInProgress = true;
          console.log(pc.red("\n\n   Force killing...\n"));
          await performShutdown(state, true);
        } else {
          shuttingDown = true;
          shutdownInProgress = true;
          console.log(
            pc.yellow("\n\n   Shutting down... (Ctrl+C again to force)\n"),
          );
          await performShutdown(state, false);
        }
        break;

      case "?":
      case "h":
        console.clear();
        showDetailedHelp();
        console.log(pc.dim("\nPress any key to return to logs"));
        break;

      case "k":
        // Kill menu
        console.clear();
        await showKillMenu(state);
        break;
    }
  });

  // Handle SIGINT
  process.on("SIGINT", async () => {
    if (shutdownInProgress) {
      console.log(pc.red("\n\n   Force killing...\n"));
      process.exit(1);
    } else if (!shuttingDown) {
      shuttingDown = true;
      shutdownInProgress = true;
      console.log(
        pc.yellow("\n\n   Shutting down... (Ctrl+C again to force)\n"),
      );
      await performShutdown(state, false);
    }
  });
}

/**
 * Start all services for all deployments
 */
async function startAllServices(state: DevState): Promise<void> {
  const hasConvex = await commandExists("convex");

  // Import schema sync utility
  const { syncConvexSchema } = await import("../utils/schema-sync.js");

  for (const [name, dep] of state.deployments) {
    // Sync schema files from SDK before anything else
    addLog(state, name, "Syncing schema from SDK...");
    const syncResult = await syncConvexSchema(dep.projectPath);
    if (syncResult.error) {
      addLog(
        state,
        name,
        pc.yellow(`Schema sync warning: ${syncResult.error}`),
      );
    } else if (syncResult.synced) {
      const source = syncResult.isDevOverride
        ? pc.magenta("[DEV]") + " local SDK"
        : `SDK v${syncResult.sdkVersion}`;
      const files = [...syncResult.filesUpdated, ...syncResult.filesAdded];
      addLog(state, name, pc.cyan(`Schema synced from ${source}`));
      if (files.length > 0 && files.length <= 3) {
        addLog(state, name, pc.dim(`  Files: ${files.join(", ")}`));
      } else if (files.length > 3) {
        addLog(state, name, pc.dim(`  Updated ${files.length} files`));
      }
    } else {
      const source = syncResult.isDevOverride
        ? pc.magenta("[DEV]") + " local SDK"
        : `SDK v${syncResult.sdkVersion}`;
      addLog(state, name, pc.dim(`Schema up to date (${source})`));
    }

    // Start graph if configured
    if (dep.graphType) {
      addLog(state, name, `Starting ${dep.graphType}...`);
      const started = await toggleGraph(dep.projectPath, dep.graphType, true);
      dep.graphRunning = started;
      if (started) {
        addLog(state, name, pc.green(`${dep.graphType} started`));
      } else {
        addLog(state, name, pc.yellow(`${dep.graphType} failed to start`));
      }
    }

    // Deploy to production first for cloud deployments with key
    if (dep.key && !dep.isLocal) {
      addLog(state, name, "Deploying functions to production...");
      try {
        const deployCmd = hasConvex ? "convex" : "npx";
        const deployArgs = hasConvex
          ? ["deploy", "--cmd", "echo deployed"]
          : ["convex", "deploy", "--cmd", "echo deployed"];

        // Build clean environment, removing inherited CONVEX_* vars
        const deployEnv = buildConvexEnv({
          CONVEX_URL: dep.url,
          CONVEX_DEPLOY_KEY: dep.key,
        });

        await new Promise<void>((resolve, reject) => {
          const child = spawn(deployCmd, deployArgs, {
            cwd: dep.projectPath,
            stdio: "pipe",
            env: deployEnv,
          });

          child.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Deploy failed with code ${code}`));
          });
          child.on("error", reject);
        });

        addLog(state, name, pc.green("Functions deployed"));
      } catch {
        addLog(state, name, pc.yellow("Deploy failed, continuing..."));
      }
    }

    // Start Convex dev
    addLog(state, name, "Starting Convex...");
    await startConvexProcess(state, name, dep, hasConvex);
  }

  // Start enabled apps
  for (const [name, app] of state.apps) {
    await startAppProcess(state, name, app);
  }
}

/**
 * Build a clean environment for Convex commands.
 * Removes inherited CONVEX_* variables so the target project's .env.local is used,
 * then applies any explicit overrides.
 */
function buildConvexEnv(
  overrides?: Record<string, string>,
): typeof process.env {
  const env = { ...process.env };

  // Remove inherited CONVEX_* variables that could conflict with target project
  // (e.g., from parent directory's .env.local being injected by dotenv)
  const convexVars = Object.keys(env).filter(
    (key) =>
      key.startsWith("CONVEX_") ||
      key.startsWith("LOCAL_CONVEX_") ||
      key.startsWith("CLOUD_CONVEX_") ||
      key.startsWith("ENV_CONVEX_"),
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
 * Start Convex dev process for a deployment
 */
async function startConvexProcess(
  state: DevState,
  name: string,
  dep: DeploymentState,
  hasConvex: boolean,
): Promise<void> {
  const command = hasConvex ? "convex" : "npx";
  const args = hasConvex ? ["dev"] : ["convex", "dev"];
  if (dep.isLocal) args.push("--local");

  // Build clean environment, removing inherited CONVEX_* vars
  const overrides: Record<string, string> = { CONVEX_URL: dep.url };
  if (dep.key) overrides.CONVEX_DEPLOY_KEY = dep.key;
  const env = buildConvexEnv(overrides);

  const child = spawn(command, args, {
    cwd: dep.projectPath,
    env,
    detached: true,
  });

  dep.process = child;

  // Handle stdout
  child.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      addLog(state, name, line);
    }
  });

  // Handle stderr (Convex outputs here)
  child.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      addLog(state, name, line);

      // Detect ready state
      if (line.includes("Convex functions ready") && !dep.convexRunning) {
        dep.convexRunning = true;
        printStatusUpdate(state);
      }
    }
  });

  child.on("exit", (code) => {
    const wasRunning = dep.convexRunning;
    dep.convexRunning = false;
    dep.process = null;
    if (code !== 0 && code !== null) {
      addLog(state, name, pc.red(`Convex exited with code ${code}`));
    }
    if (wasRunning) {
      printStatusUpdate(state);
    }
  });

  // Wait a moment for startup
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Start an app process
 */
async function startAppProcess(
  state: DevState,
  name: string,
  app: AppState,
): Promise<void> {
  const appPath = path.join(app.config.projectPath, app.config.path);

  if (!fs.existsSync(appPath)) {
    addLog(state, name, pc.yellow(`App not found at ${appPath}`));
    return;
  }

  addLog(state, name, `Starting ${app.config.type}...`);

  const command = app.config.startCommand || "npm run dev";
  const [cmd, ...args] = command.split(" ");

  const child = spawn(cmd, args, {
    cwd: appPath,
    env: {
      ...process.env,
      PORT: String(app.config.port || 3000),
    },
    detached: true,
  });

  app.process = child;

  // Helper to detect app ready state
  const checkAppReady = (line: string) => {
    // Detect ready state (Next.js outputs "Ready" to stdout with Turbopack)
    if (
      (line.includes("Ready") || line.includes("started server")) &&
      !app.running
    ) {
      app.running = true;
      addLog(
        state,
        name,
        pc.green(`App ready at http://localhost:${app.config.port || 3000}`),
      );
      printStatusUpdate(state);
    }
  };

  // Handle stdout
  child.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      addLog(state, name, line);
      checkAppReady(line);
    }
  });

  // Handle stderr
  child.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      addLog(state, name, line);
      checkAppReady(line);
    }
  });

  child.on("exit", (code) => {
    const wasRunning = app.running;
    app.running = false;
    app.process = null;
    if (code !== 0 && code !== null) {
      addLog(state, name, pc.red(`App exited with code ${code}`));
    }
    if (wasRunning) {
      printStatusUpdate(state);
    }
  });

  // Wait a moment for startup
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Stop all services
 */
async function stopAllServices(state: DevState, force: boolean): Promise<void> {
  const signal = force ? "SIGKILL" : "SIGTERM";

  // Stop deployments
  for (const dep of state.deployments.values()) {
    // Stop Convex
    if (dep.process && dep.process.pid) {
      try {
        process.kill(-dep.process.pid, signal);
      } catch {
        // Already dead
      }
      dep.process = null;
      dep.convexRunning = false;
    }

    // Stop graph
    if (dep.graphRunning && dep.graphType) {
      await toggleGraph(dep.projectPath, dep.graphType, false);
      dep.graphRunning = false;
    }
  }

  // Stop apps
  for (const app of state.apps.values()) {
    if (app.process && app.process.pid) {
      try {
        process.kill(-app.process.pid, signal);
      } catch {
        // Already dead
      }
      app.process = null;
      app.running = false;
    }
  }

  if (!force) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Perform full shutdown
 */
async function performShutdown(state: DevState, force: boolean): Promise<void> {
  console.log(pc.dim("  Stopping all services..."));
  await stopAllServices(state, force);
  console.log(pc.green("  ✓ All services stopped"));

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.exit(0);
}

/**
 * Handle graph toggle (with menu for multiple deployments)
 */
async function handleGraphToggle(state: DevState): Promise<void> {
  // Find deployments with graph configured
  const withGraph = Array.from(state.deployments.values()).filter(
    (d) => d.graphType,
  );

  if (withGraph.length === 0) {
    printLog("No graph databases configured");
    return;
  }

  if (withGraph.length === 1) {
    // Single deployment - toggle directly
    const dep = withGraph[0];
    if (dep.graphRunning) {
      printLog(`Stopping ${dep.graphType} for ${dep.name}...`);
      const stopped = await toggleGraph(dep.projectPath, dep.graphType!, false);
      dep.graphRunning = !stopped;
      printLog(
        stopped ? pc.green("Graph stopped") : pc.red("Failed to stop graph"),
      );
    } else {
      printLog(`Starting ${dep.graphType} for ${dep.name}...`);
      const started = await toggleGraph(dep.projectPath, dep.graphType!, true);
      dep.graphRunning = started;
      printLog(
        started ? pc.green("Graph started") : pc.red("Failed to start graph"),
      );
    }
  } else {
    // Multiple - show menu
    console.log("\n" + pc.bold("  Select deployment to toggle graph:"));
    withGraph.forEach((dep, i) => {
      const status = dep.graphRunning
        ? pc.green("running")
        : pc.yellow("stopped");
      console.log(
        `    ${pc.cyan(String(i + 1))} ${dep.name} (${dep.graphType}) - ${status}`,
      );
    });
    console.log(`    ${pc.dim("Press 1-9 or any other key to cancel")}\n`);

    const key = await waitForKey();
    const num = parseInt(key);
    if (num >= 1 && num <= withGraph.length) {
      const dep = withGraph[num - 1];
      if (dep.graphRunning) {
        printLog(`Stopping ${dep.graphType} for ${dep.name}...`);
        const stopped = await toggleGraph(
          dep.projectPath,
          dep.graphType!,
          false,
        );
        dep.graphRunning = !stopped;
        printLog(
          stopped ? pc.green("Graph stopped") : pc.red("Failed to stop graph"),
        );
      } else {
        printLog(`Starting ${dep.graphType} for ${dep.name}...`);
        const started = await toggleGraph(
          dep.projectPath,
          dep.graphType!,
          true,
        );
        dep.graphRunning = started;
        printLog(
          started ? pc.green("Graph started") : pc.red("Failed to start graph"),
        );
      }
    }
  }
  printStatusUpdate(state);
}

/**
 * Toggle graph database
 */
async function toggleGraph(
  projectPath: string,
  graphType: "neo4j" | "memgraph",
  start: boolean,
): Promise<boolean> {
  const dockerComposePath = path.join(projectPath, "docker-compose.graph.yml");
  const containerName = `cortex-${graphType}`;

  if (!fs.existsSync(dockerComposePath)) {
    return false;
  }

  try {
    if (start) {
      // Check if already running
      const checkResult = await execCommand(
        "docker",
        ["ps", "--filter", `name=${containerName}`, "--format", "{{.Status}}"],
        { quiet: true },
      );

      if (checkResult.stdout.includes("Up")) {
        return true;
      }

      // Check if container exists but stopped
      const existsResult = await execCommand(
        "docker",
        [
          "ps",
          "-a",
          "--filter",
          `name=${containerName}`,
          "--format",
          "{{.Names}}",
        ],
        { quiet: true },
      );

      if (existsResult.stdout.includes(containerName)) {
        const startResult = await execCommand(
          "docker",
          ["start", containerName],
          { quiet: true },
        );
        if (startResult.code === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return true;
        }
        await execCommand("docker", ["rm", "-f", containerName], {
          quiet: true,
        });
      }

      // Start via docker-compose
      const result = await execCommand(
        "docker",
        ["compose", "-f", "docker-compose.graph.yml", "up", "-d"],
        { cwd: projectPath, quiet: true },
      );

      if (result.code === 0) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return true;
      }
      return false;
    } else {
      const result = await execCommand("docker", ["stop", containerName], {
        quiet: true,
      });
      return result.code === 0;
    }
  } catch {
    return false;
  }
}

/**
 * Add a log entry with service name prefix
 */
function addLog(state: DevState, serviceName: string, message: string): void {
  const timestamp = new Date().toLocaleTimeString();
  const totalServices = state.deployments.size + state.apps.size;
  const prefix =
    totalServices > 1 ? pc.cyan(`[${serviceName}]`.padEnd(18)) : "";
  const logLine = `${pc.dim(timestamp)} ${prefix}${message}`;

  state.logs.push(logLine);

  if (state.logs.length > state.maxLogs) {
    state.logs = state.logs.slice(-state.maxLogs);
  }

  console.log(`  ${logLine}`);
}

/**
 * Print a log without deployment prefix
 */
function printLog(message: string): void {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`  ${pc.dim(timestamp)} ${message}`);
}

/**
 * Print inline status update
 */
function printStatusUpdate(state: DevState): void {
  const statuses: string[] = [];

  // Deployment statuses
  for (const [name, dep] of state.deployments) {
    const convexIcon = dep.convexRunning ? pc.green("●") : pc.yellow("○");
    let status = `${convexIcon} ${name}`;

    if (dep.graphType) {
      const graphIcon = dep.graphRunning ? pc.green("●") : pc.yellow("○");
      status += ` ${graphIcon}${dep.graphType}`;
    }

    statuses.push(status);
  }

  // App statuses
  for (const [name, app] of state.apps) {
    const appIcon = app.running ? pc.green("●") : pc.yellow("○");
    statuses.push(`${appIcon} ${name}`);
  }

  console.log();
  console.log(
    pc.cyan("  ══════════════════════════════════════════════════════════════"),
  );
  console.log(`  ${pc.bold("Status:")} ${statuses.join("  │  ")}`);
  console.log(
    pc.cyan("  ══════════════════════════════════════════════════════════════"),
  );
  console.log();
}

/**
 * Refresh and display full status
 */
async function refreshStatus(state: DevState): Promise<void> {
  const width = 66;
  const line = "═".repeat(width);
  const thinLine = "─".repeat(width);
  const deployCount = state.deployments.size;
  const appCount = state.apps.size;

  console.log();
  console.log(pc.cyan("╔" + line + "╗"));
  console.log(
    pc.cyan("║") + pc.bold(`   Cortex Dev Mode`).padEnd(width) + pc.cyan("║"),
  );
  console.log(pc.cyan("╚" + line + "╝"));
  console.log();

  // Deployments section
  console.log(pc.bold(pc.white(`  Deployments (${deployCount})`)));
  console.log(pc.dim("  " + thinLine));

  for (const [name, dep] of state.deployments) {
    // Convex status
    const convexStatus = dep.convexRunning
      ? pc.green("Running")
      : pc.yellow("Starting...");
    const convexIcon = dep.convexRunning ? pc.green("●") : pc.yellow("○");

    // Graph status
    let graphStatus = pc.dim("N/A");
    if (dep.graphType) {
      graphStatus = dep.graphRunning
        ? pc.green(`Running (${dep.graphType})`)
        : pc.yellow(`Stopped (${dep.graphType})`);
    }

    console.log(
      `   ${convexIcon} ${pc.cyan(name.padEnd(16))} Convex: ${convexStatus.padEnd(20)} Graph: ${graphStatus}`,
    );

    // Show URLs for running services
    if (dep.convexRunning) {
      const isLocal =
        dep.url.includes("localhost") || dep.url.includes("127.0.0.1");
      if (isLocal) {
        console.log(pc.dim(`     Dashboard: http://127.0.0.1:3210`));
      }
    }
    if (dep.graphRunning && dep.graphType) {
      const url =
        dep.graphType === "neo4j"
          ? "http://localhost:7474"
          : "http://localhost:3000";
      console.log(pc.dim(`     ${dep.graphType}: ${url}`));
    }
  }

  // Apps section (if any)
  if (appCount > 0) {
    console.log();
    console.log(pc.bold(pc.white(`  Apps (${appCount})`)));
    console.log(pc.dim("  " + thinLine));

    for (const [name, app] of state.apps) {
      const appStatus = app.running
        ? pc.green("Running")
        : pc.yellow("Starting...");
      const appIcon = app.running ? pc.green("●") : pc.yellow("○");

      console.log(`   ${appIcon} ${pc.cyan(name.padEnd(16))} ${appStatus}`);

      // Show URL for running apps
      if (app.running) {
        console.log(
          pc.dim(`     URL: http://localhost:${app.config.port || 3000}`),
        );
      }
    }
  }

  console.log();
}

/**
 * Show keyboard shortcut help
 */
function showHelp(): void {
  console.log(
    pc.dim(
      "  ──────────────────────────────────────────────────────────────────",
    ),
  );
  console.log(
    pc.dim("  ") +
      pc.cyan("c") +
      pc.dim(" clear  ") +
      pc.cyan("s") +
      pc.dim(" status  ") +
      pc.cyan("r") +
      pc.dim(" restart  ") +
      pc.cyan("g") +
      pc.dim(" graph  ") +
      pc.cyan("k") +
      pc.dim(" kill  ") +
      pc.cyan("q") +
      pc.dim(" quit  ") +
      pc.cyan("?") +
      pc.dim(" help"),
  );
  console.log();
}

/**
 * Show detailed help
 */
function showDetailedHelp(): void {
  const width = 66;
  const line = "═".repeat(width);

  console.log();
  console.log(pc.cyan("╔" + line + "╗"));
  console.log(
    pc.cyan("║") +
      pc.bold("   Keyboard Shortcuts").padEnd(width) +
      pc.cyan("║"),
  );
  console.log(pc.cyan("╚" + line + "╝"));
  console.log();

  console.log(`   ${pc.cyan("c")}  Clear screen & show status`);
  console.log(`   ${pc.cyan("s")}  Show status dashboard`);
  console.log(`   ${pc.cyan("r")}  Restart all services`);
  console.log(
    `   ${pc.cyan("g")}  Toggle graph database (select deployment if multiple)`,
  );
  console.log(`   ${pc.cyan("k")}  Kill Convex instances (port conflicts)`);
  console.log(`   ${pc.cyan("q")}  Quit (Ctrl+C)`);
  console.log(`   ${pc.cyan("?")}  Show this help`);
  console.log();
}

/**
 * Show kill menu
 */
async function showKillMenu(state: DevState): Promise<void> {
  const width = 66;
  const line = "═".repeat(width);

  console.log();
  console.log(pc.cyan("╔" + line + "╗"));
  console.log(
    pc.cyan("║") +
      pc.bold("   Kill Convex Instances").padEnd(width) +
      pc.cyan("║"),
  );
  console.log(pc.cyan("╚" + line + "╝"));
  console.log();

  console.log(pc.dim("   Scanning for running Convex instances..."));

  const instances = await findConvexInstances();

  console.clear();
  console.log();
  console.log(pc.cyan("╔" + line + "╗"));
  console.log(
    pc.cyan("║") +
      pc.bold("   Kill Convex Instances").padEnd(width) +
      pc.cyan("║"),
  );
  console.log(pc.cyan("╚" + line + "╝"));
  console.log();

  if (instances.length === 0) {
    console.log(pc.green("   No Convex instances found on common ports."));
    console.log(pc.dim("\n   Press any key to return..."));

    await waitForKey();
    console.clear();
    await refreshStatus(state);
    showHelp();
    return;
  }

  console.log(pc.bold(pc.white("  Running Instances")));
  console.log(pc.dim("  " + "─".repeat(60)));

  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    console.log(
      `   ${pc.cyan(`${i + 1}`)}  Port ${pc.yellow(inst.port)}  PID ${inst.pid}  ${pc.dim(inst.name)}`,
    );
  }

  console.log();
  console.log(
    pc.dim("   Press 1-9 to kill, 'a' to kill all, or any other key to cancel"),
  );
  console.log();

  const key = await waitForKey();

  if (key === "a") {
    console.log(pc.yellow("\n   Killing all instances..."));
    for (const inst of instances) {
      try {
        process.kill(parseInt(inst.pid), "SIGTERM");
        console.log(
          pc.green(`   ✓ Killed PID ${inst.pid} (port ${inst.port})`),
        );
      } catch {
        console.log(pc.red(`   ✗ Failed to kill PID ${inst.pid}`));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } else {
    const num = parseInt(key);
    if (num >= 1 && num <= instances.length) {
      const inst = instances[num - 1];
      console.log(
        pc.yellow(`\n   Killing PID ${inst.pid} on port ${inst.port}...`),
      );
      try {
        process.kill(parseInt(inst.pid), "SIGTERM");
        console.log(pc.green(`   ✓ Killed successfully`));
      } catch {
        console.log(pc.red(`   ✗ Failed to kill`));
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.clear();
  await refreshStatus(state);
  showHelp();
  console.log(pc.dim("  Logs streaming below...\n"));
}

/**
 * Find running Convex instances
 */
async function findConvexInstances(): Promise<
  Array<{ pid: string; port: string; name: string }>
> {
  const instances: Array<{ pid: string; port: string; name: string }> = [];
  const ports = ["3210", "3211", "3212", "3213", "3214", "3215"];
  const seenPids = new Set<string>();

  for (const port of ports) {
    try {
      const result = await execCommand(
        "lsof",
        ["-i", `:${port}`, "-sTCP:LISTEN", "-t"],
        { quiet: true },
      );

      if (result.code === 0 && result.stdout.trim()) {
        const pids = result.stdout.trim().split("\n");
        for (const pid of pids) {
          if (pid && !seenPids.has(pid)) {
            seenPids.add(pid);

            const nameResult = await execCommand(
              "ps",
              ["-p", pid, "-o", "comm="],
              { quiet: true },
            );
            let name = nameResult.stdout.trim() || "unknown";

            const cmdResult = await execCommand(
              "ps",
              ["-p", pid, "-o", "args="],
              { quiet: true },
            );
            const cmdLine = cmdResult.stdout.trim();

            if (cmdLine.includes("convex")) {
              name = "convex";
            } else if (cmdLine.includes("local-backend")) {
              name = "convex-local-backend";
            }

            instances.push({ pid, port, name });
          }
        }
      }
    } catch {
      // Port not in use
    }
  }

  return instances;
}

/**
 * Wait for a single keypress
 */
function waitForKey(): Promise<string> {
  return new Promise((resolve) => {
    const handler = (data: string) => {
      process.stdin.removeListener("data", handler);
      resolve(data);
    };
    process.stdin.once("data", handler);
  });
}
