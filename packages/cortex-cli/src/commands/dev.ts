/**
 * Interactive Dev Mode Command
 *
 * Expo-style interactive terminal with:
 * - Live status dashboard
 * - Streaming logs
 * - Keyboard shortcuts for common actions
 */

import { Command } from "commander";
import { spawn, ChildProcess } from "child_process";
import pc from "picocolors";
import fs from "fs-extra";
import path from "path";
import type { CLIConfig } from "../types.js";
import { commandExists } from "../utils/shell.js";
import { execCommand } from "../utils/shell.js";
import { runInitWizard } from "./init.js";

interface DevState {
  convexProcess: ChildProcess | null;
  convexRunning: boolean;
  graphRunning: boolean;
  graphType: "neo4j" | "memgraph" | null;
  logs: string[];
  maxLogs: number;
  lastStatus: Date;
  projectPath: string;
  isLocal: boolean;
}

interface ConvexInstance {
  pid: string;
  port: string;
  name: string;
}

/**
 * Register dev commands
 */
export function registerDevCommands(program: Command, _config: CLIConfig): void {
  program
    .command("dev")
    .description("Start interactive development mode (Expo-style)")
    .option("-l, --local", "Force local Convex instance", false)
    .action(async (options) => {
      const cwd = process.cwd();
      const isLocal =
        options.local ||
        process.env.CONVEX_URL?.includes("localhost") ||
        process.env.CONVEX_URL?.includes("127.0.0.1") ||
        !process.env.CONVEX_URL;

      await runInteractiveDevMode(cwd, isLocal);
    });
}

/**
 * Check if Cortex/Convex is configured in the current directory
 */
function isCortexConfigured(projectPath: string): boolean {
  // Check for convex directory (indicates Convex is set up)
  const convexDir = path.join(projectPath, "convex");
  if (fs.existsSync(convexDir)) {
    return true;
  }
  
  // Check for .env.local with CONVEX_URL
  const envLocal = path.join(projectPath, ".env.local");
  if (fs.existsSync(envLocal)) {
    try {
      const content = fs.readFileSync(envLocal, "utf-8");
      if (content.includes("CONVEX_URL")) {
        return true;
      }
    } catch {
      // Ignore read errors
    }
  }
  
  return false;
}

/**
 * Show prompt when Cortex is not configured
 */
async function showNotConfiguredPrompt(projectPath: string): Promise<boolean> {
  console.clear();
  console.log(pc.bold(pc.yellow("\n   ⚠ Cortex Not Configured\n")));
  console.log(pc.dim("   No Cortex/Convex configuration found in this directory.\n"));
  console.log(`   ${pc.cyan("Current directory:")} ${projectPath}\n`);
  console.log(pc.dim("   This could mean:"));
  console.log(pc.dim("   • You're in the wrong directory"));
  console.log(pc.dim("   • Cortex hasn't been set up yet\n"));
  console.log(`   Press ${pc.bold(pc.green("i"))} to run ${pc.cyan("cortex init")} and set up your project`);
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
          await runInitWizard(projectPath, { start: false });
          resolve(true); // Init completed, continue to dev mode
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
  projectPath: string,
  isLocal: boolean,
): Promise<void> {
  // Check if Cortex is configured
  if (!isCortexConfigured(projectPath)) {
    const shouldContinue = await showNotConfiguredPrompt(projectPath);
    if (!shouldContinue) {
      process.exit(0);
    }
    // Re-check after init
    if (!isCortexConfigured(projectPath)) {
      console.log(pc.red("\n   Configuration still not found. Please run 'cortex init' manually.\n"));
      process.exit(1);
    }
  }

  const state: DevState = {
    convexProcess: null,
    convexRunning: false,
    graphRunning: false,
    graphType: null,
    logs: [],
    maxLogs: 50,
    lastStatus: new Date(),
    projectPath,
    isLocal,
  };

  // Check for graph config
  const dockerComposePath = path.join(projectPath, "docker-compose.graph.yml");
  if (fs.existsSync(dockerComposePath)) {
    const content = await fs.readFile(dockerComposePath, "utf-8");
    state.graphType = content.includes("memgraph") ? "memgraph" : "neo4j";
    
    // Check if graph is already running
    try {
      const checkResult = await execCommand(
        "docker",
        ["ps", "--filter", `name=cortex-${state.graphType}`, "--format", "{{.Status}}"],
        { quiet: true },
      );
      state.graphRunning = checkResult.stdout.includes("Up");
    } catch {
      state.graphRunning = false;
    }
  }

  // Setup stdin for raw mode (keyboard input)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
  }

  // Clear screen and show initial status
  console.clear();
  await refreshStatus(state);
  showHelp();
  console.log(pc.dim("  Logs streaming below. Status updates automatically. Press 'c' to clear.\n"));

  // Start services (logs will stream as they come)
  await startServices(state);

  // Track shutdown state (prevents re-entry race conditions)
  let shuttingDown = false;
  let shutdownInProgress = false;

  // Handle keyboard input
  process.stdin.on("data", async (key: string) => {
    switch (key) {
      case "c":
        // Clear screen and show status
        state.logs = [];
        console.clear();
        await refreshStatus(state);
        showHelp();
        console.log(pc.dim("  Logs cleared. Streaming below...\n"));
        break;

      case "r":
        // Restart services
        console.log(pc.yellow("\n  Restarting services...\n"));
        await stopServices(state);
        state.logs = [];
        console.clear();
        await refreshStatus(state);
        showHelp();
        console.log(pc.dim("  Restarting...\n"));
        await startServices(state);
        break;

      case "g":
        // Toggle graph
        if (state.graphType) {
          if (state.graphRunning) {
            printLog("Stopping graph database...");
            const stopped = await toggleGraph(state.projectPath, state.graphType, false);
            state.graphRunning = !stopped;
            printLog(stopped ? pc.green("Graph database stopped") : pc.red("Failed to stop graph"));
          } else {
            printLog("Starting graph database...");
            const started = await toggleGraph(state.projectPath, state.graphType, true);
            state.graphRunning = started;
            printLog(started ? pc.green("Graph database started") : pc.red("Failed to start graph"));
          }
        } else {
          printLog(pc.yellow("No graph database configured. Run 'cortex init' to set up."));
        }
        break;

      case "q":
        // Clean quit - guard against multiple calls
        if (!shutdownInProgress) {
          shuttingDown = true;
          shutdownInProgress = true;
          console.log(pc.yellow("\n\n   Shutting down...\n"));
          await performShutdown(state, false);
        }
        break;

      case "\u0003": // Ctrl+C
        // First Ctrl+C = clean shutdown, tracked for force kill on second
        if (shutdownInProgress) {
          // Already shutting down - ignore (force kill handled by SIGINT)
          break;
        }
        if (shuttingDown) {
          // Second Ctrl+C = force kill
          shutdownInProgress = true;
          console.log(pc.red("\n\n   Force killing...\n"));
          await performShutdown(state, true);
        } else {
          shuttingDown = true;
          shutdownInProgress = true;
          console.log(pc.yellow("\n\n   Shutting down... (Ctrl+C again to force)\n"));
          await performShutdown(state, false);
        }
        break;

      case "?":
      case "h":
        // Help
        console.clear();
        showDetailedHelp();
        console.log(pc.dim("\nPress any key to return to logs"));
        break;

      case "k":
        // Kill Convex instances
        console.clear();
        await showKillMenu(state);
        break;
    }
  });

  // Handle SIGINT from terminal (separate from raw mode Ctrl+C)
  process.on("SIGINT", async () => {
    if (shutdownInProgress) {
      // Already shutting down - only allow force kill if clean shutdown is in progress
      if (!shuttingDown) {
        // This shouldn't happen, but handle it
        return;
      }
      // Force kill - but don't call performShutdown again, just exit
      console.log(pc.red("\n\n   Force killing...\n"));
      process.exit(1);
    } else if (shuttingDown) {
      // shuttingDown but not shutdownInProgress means we already started once
      // This case shouldn't happen with the new logic, but handle gracefully
      return;
    } else {
      shuttingDown = true;
      shutdownInProgress = true;
      console.log(pc.yellow("\n\n   Shutting down... (Ctrl+C again to force)\n"));
      await performShutdown(state, false);
    }
  });
}

/**
 * Start all services
 */
async function startServices(state: DevState): Promise<void> {
  // Start graph if configured
  if (state.graphType) {
    addLog(state, `Starting ${state.graphType}...`);
    const graphStarted = await toggleGraph(state.projectPath, state.graphType, true);
    state.graphRunning = graphStarted;
    if (graphStarted) {
      addLog(state, `${state.graphType} started`);
    } else {
      addLog(state, pc.yellow(`${state.graphType} failed to start`));
    }
  }

  // Start Convex
  addLog(state, "Starting Convex...");
  await startConvexProcess(state);
}

/**
 * Toggle graph database (start/stop without spinners)
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
        return true; // Already running
      }

      // Check if container exists but stopped
      const existsResult = await execCommand(
        "docker",
        ["ps", "-a", "--filter", `name=${containerName}`, "--format", "{{.Names}}"],
        { quiet: true },
      );

      if (existsResult.stdout.includes(containerName)) {
        // Try to start existing container
        const startResult = await execCommand(
          "docker",
          ["start", containerName],
          { quiet: true },
        );

        if (startResult.code === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return true;
        }

        // Remove old container if start failed
        await execCommand("docker", ["rm", "-f", containerName], { quiet: true });
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
      // Stop - use docker stop directly (not docker-compose) because the container
      // might have been started from a different compose project
      try {
        const result = await execCommand(
          "docker",
          ["stop", containerName],
          { quiet: true },
        );
        return result.code === 0;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}

/**
 * Stop all services
 */
/**
 * Perform full shutdown
 */
async function performShutdown(state: DevState, force: boolean): Promise<void> {
  if (force) {
    console.log(pc.dim("  Killing Convex..."));
  } else {
    console.log(pc.dim("  Stopping Convex..."));
  }
  
  await stopServices(state, force);
  
  console.log(pc.green("  ✓ All services stopped"));
  
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.exit(0);
}

async function stopServices(state: DevState, force: boolean = false): Promise<void> {
  // Stop Convex process - kill entire process group to stop all child processes
  if (state.convexProcess && state.convexProcess.pid) {
    const pid = state.convexProcess.pid;
    try {
      // Kill the entire process group (negative PID) to kill all child processes
      // This is crucial because convex dev spawns child processes
      const signal = force ? "SIGKILL" : "SIGTERM";
      process.kill(-pid, signal);
      if (!force) {
        // Wait a moment for clean shutdown
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch {
      // Process may already be dead, that's fine
    }
    state.convexProcess = null;
    state.convexRunning = false;
  }

  // Stop graph database if running
  if (state.graphRunning && state.graphType) {
    console.log(pc.dim("  Stopping graph database..."));
    await toggleGraph(state.projectPath, state.graphType, false);
    state.graphRunning = false;
  }
}

/**
 * Start Convex dev process
 */
async function startConvexProcess(state: DevState): Promise<void> {
  const hasConvex = await commandExists("convex");
  const command = hasConvex ? "convex" : "npx";
  const args = hasConvex ? ["dev"] : ["convex", "dev"];
  if (state.isLocal) args.push("--local");

  // Spawn in detached mode so we can kill the entire process group
  const child = spawn(command, args, {
    cwd: state.projectPath,
    env: { ...process.env },
    detached: true,
  });

  state.convexProcess = child;

  child.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      addLog(state, line);
    }
  });

  // Convex outputs to stderr, not stdout - so we detect ready state here
  child.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      addLog(state, line);
      
      // Detect when Convex is ready and show status update
      if (line.includes("Convex functions ready") && !state.convexRunning) {
        state.convexRunning = true;
        printStatusLine(state);
      }
    }
  });

  child.on("exit", (code) => {
    const wasRunning = state.convexRunning;
    state.convexRunning = false;
    state.convexProcess = null;
    if (code !== 0 && code !== null) {
      addLog(state, pc.red(`Convex exited with code ${code}`));
    }
    // Show status update if state changed
    if (wasRunning) {
      printStatusLine(state);
    }
  });

  // Don't assume running - wait for actual ready signal
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Print a compact inline status line
 */
function printStatusLine(state: DevState): void {
  const convexStatus = state.convexRunning 
    ? pc.green("● Convex") 
    : pc.yellow("○ Convex");
  
  let graphStatus = "";
  if (state.graphType) {
    graphStatus = state.graphRunning 
      ? pc.green(` ● ${state.graphType}`)
      : pc.yellow(` ○ ${state.graphType}`);
  }
  
  console.log(); // Empty line before status
  console.log(pc.cyan("  ══════════════════════════════════════════════════════════"));
  console.log(`  ${pc.bold("Status:")} ${convexStatus}${graphStatus}`);
  console.log(pc.cyan("  ══════════════════════════════════════════════════════════"));
  console.log(); // Empty line after status
}

/**
 * Print a log entry immediately to stdout
 */
function printLog(message: string): void {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`  ${pc.dim(timestamp)} ${message}`);
}

/**
 * Add a log entry (stores for history, also prints)
 */
function addLog(state: DevState, message: string): void {
  const timestamp = new Date().toLocaleTimeString();
  const logLine = `${pc.dim(timestamp)} ${message}`;
  state.logs.push(logLine);
  
  // Trim old logs (keep history for 'l' command)
  if (state.logs.length > state.maxLogs) {
    state.logs = state.logs.slice(-state.maxLogs);
  }
  
  // Print immediately
  console.log(`  ${logLine}`);
}

/**
 * Refresh and display status
 */
async function refreshStatus(state: DevState): Promise<void> {
  const width = 60;
  const line = "═".repeat(width);
  const thinLine = "─".repeat(width);

  console.log();
  console.log(pc.cyan("╔" + line + "╗"));
  console.log(
    pc.cyan("║") +
      pc.bold("   Cortex Dev Mode").padEnd(width) +
      pc.cyan("║"),
  );
  console.log(pc.cyan("╚" + line + "╝"));
  console.log();

  // Services
  console.log(pc.bold(pc.white("  Services")));
  console.log(pc.dim("  " + thinLine));

  // Convex status
  if (state.convexRunning) {
    console.log(`   ${pc.green("●")} Convex      ${pc.green("Running")}`);
    if (state.isLocal) {
      console.log(pc.dim("                  Dashboard: http://127.0.0.1:3210"));
    }
  } else {
    console.log(`   ${pc.yellow("○")} Convex      ${pc.yellow("Starting...")}`);
  }

  // Graph status
  if (state.graphType) {
    if (state.graphRunning) {
      console.log(`   ${pc.green("●")} ${state.graphType.padEnd(10)} ${pc.green("Running")}`);
      if (state.graphType === "neo4j") {
        console.log(pc.dim("                  Browser: http://localhost:7474"));
      } else {
        console.log(pc.dim("                  Lab: http://localhost:3000"));
      }
    } else {
      console.log(`   ${pc.yellow("○")} ${state.graphType.padEnd(10)} ${pc.yellow("Not running")}`);
    }
  }

  console.log();
}

/**
 * Show logs
 */
/**
 * Show keyboard shortcut help
 */
function showHelp(): void {
  console.log(pc.dim("  ────────────────────────────────────────────────────────────"));
  console.log(
    pc.dim("  ") +
    pc.cyan("c") + pc.dim(" clear  ") +
    pc.cyan("r") + pc.dim(" restart  ") +
    pc.cyan("g") + pc.dim(" graph  ") +
    pc.cyan("k") + pc.dim(" kill  ") +
    pc.cyan("q") + pc.dim(" quit  ") +
    pc.cyan("?") + pc.dim(" help")
  );
  console.log();
}

/**
 * Show detailed help
 */
function showDetailedHelp(): void {
  const width = 60;
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
  console.log(`   ${pc.cyan("r")}  Restart all services`);
  console.log(`   ${pc.cyan("g")}  Toggle graph database`);
  console.log(`   ${pc.cyan("k")}  Kill Convex instances (port conflicts)`);
  console.log(`   ${pc.cyan("q")}  Quit (Ctrl+C)`);
  console.log(`   ${pc.cyan("?")}  Show this help`);
  console.log();
}

/**
 * Find running Convex instances
 */
async function findConvexInstances(): Promise<ConvexInstance[]> {
  const instances: ConvexInstance[] = [];
  const ports = ["3210", "3211", "3212", "3213", "3214", "3215"];
  const seenPids = new Set<string>();

  for (const port of ports) {
    try {
      // Use lsof to find processes listening on the port (TCP LISTEN only)
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
            
            // Get process name and command line
            const nameResult = await execCommand(
              "ps",
              ["-p", pid, "-o", "comm="],
              { quiet: true },
            );
            let name = nameResult.stdout.trim() || "unknown";
            
            // Try to get more detail about what's running
            const cmdResult = await execCommand(
              "ps",
              ["-p", pid, "-o", "args="],
              { quiet: true },
            );
            const cmdLine = cmdResult.stdout.trim();
            
            // Identify if it's Convex-related
            if (cmdLine.includes("convex")) {
              name = "convex";
            } else if (cmdLine.includes("local-backend") || cmdLine.includes("convex-local-backend")) {
              name = "convex-local-backend";
            }
            
            // Include all processes on these ports (they're likely Convex-related)
            instances.push({ pid, port, name });
          }
        }
      }
    } catch {
      // Port not in use or lsof not available
    }
  }

  // Also try to find convex-local-backend processes directly
  try {
    const result = await execCommand(
      "pgrep",
      ["-f", "convex.*local"],
      { quiet: true },
    );
    
    if (result.code === 0 && result.stdout.trim()) {
      const pids = result.stdout.trim().split("\n");
      for (const pid of pids) {
        if (pid && !seenPids.has(pid)) {
          seenPids.add(pid);
          
          // Get what port it might be on
          const lsofResult = await execCommand(
            "lsof",
            ["-p", pid, "-i", "-sTCP:LISTEN"],
            { quiet: true },
          );
          
          let port = "unknown";
          const portMatch = lsofResult.stdout.match(/:(\d+)\s+\(LISTEN\)/);
          if (portMatch) {
            port = portMatch[1];
          }
          
          instances.push({ pid, port, name: "convex-local-backend" });
        }
      }
    }
  } catch {
    // pgrep not available or no matches
  }

  return instances;
}

/**
 * Show kill menu for Convex instances
 */
async function showKillMenu(state: DevState): Promise<void> {
  const width = 60;
  const line = "═".repeat(width);
  const thinLine = "─".repeat(width);

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
  console.log(pc.dim("  " + thinLine));

  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    console.log(
      `   ${pc.cyan(`${i + 1}`)}  Port ${pc.yellow(inst.port)}  PID ${inst.pid}  ${pc.dim(inst.name)}`,
    );
  }

  console.log();
  console.log(pc.dim("   Press 1-9 to kill, 'a' to kill all, or any other key to cancel"));
  console.log();

  // Wait for user input
  const key = await waitForKey();

  if (key === "a") {
    // Kill all
    console.log(pc.yellow("\n   Killing all instances..."));
    for (const inst of instances) {
      try {
        process.kill(parseInt(inst.pid), "SIGTERM");
        console.log(pc.green(`   ✓ Killed PID ${inst.pid} (port ${inst.port})`));
      } catch {
        console.log(pc.red(`   ✗ Failed to kill PID ${inst.pid}`));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } else {
    const num = parseInt(key);
    if (num >= 1 && num <= instances.length) {
      const inst = instances[num - 1];
      console.log(pc.yellow(`\n   Killing PID ${inst.pid} on port ${inst.port}...`));
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
