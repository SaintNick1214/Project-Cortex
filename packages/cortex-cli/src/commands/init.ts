/**
 * Init Command
 *
 * Interactive wizard for setting up a new Cortex Memory project.
 * Replaces `npx create-cortex-memories` with a more integrated CLI experience.
 */

import { Command } from "commander";
import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import ora from "ora";
import { commandExists } from "../utils/shell.js";
import type { CLIConfig, DeploymentConfig } from "../types.js";
import { spawn } from "child_process";
import { loadConfig, validateAndCleanConfig } from "../utils/config.js";
import {
  startApp,
  stopApp,
  findAppPidFiles,
  isAppRunning,
  findProcessByPort,
  stopProcessByPort,
} from "../utils/init/quickstart-setup.js";
import {
  startGraphContainers,
  stopGraphContainers,
} from "../utils/init/graph-setup.js";
import { displayCleanupNotification } from "../utils/formatting.js";
import { developmentStartEnvironment } from "../utils/init/start-target.js";
import { validateInstallOptions, type InstallOptions } from "../utils/install.js";
import { runCatalogBasicInit, type TemplateCommandOptions, type TemplateCommandServices } from "./templates.js";
import { selectedGraphOptions } from "./graph.js";
import { resolveInteractiveGraph } from "../utils/graph/interactive.js";
import { installerOptions, printInstallResult, installWithGraph, GraphInstallPartialError } from "./install.js";
import type { GraphInteraction } from "../utils/graph/interactive.js";

/**
 * Register start and stop commands (lifecycle management)
 */
export function registerLifecycleCommands(
  program: Command,
  _config: CLIConfig,
): void {
  // Quick start command
  program
    .command("start")
    .description("Start development services (all enabled deployments)")
    .option("-d, --deployment <name>", "Start a specific deployment only")
    .option(
      "-l, --local",
      "Use Convex local beta mode (starts a new local backend)",
      false,
    )
    .option(
      "-f, --foreground",
      "Run in foreground (only works with single deployment)",
      false,
    )
    .option("--convex-only", "Only start Convex servers", false)
    .option("--graph-only", "Only start graph databases", false)
    .action(async (options) => {
      let config = await loadConfig();

      // Validate paths only (skip Convex URL check for speed)
      try {
        const validation = await validateAndCleanConfig(config, {
          checkConvex: false,
        });
        if (validation.modified) {
          displayCleanupNotification(validation);
        }
        config = validation.config;
      } catch {
        // Continue with unvalidated config
      }

      // Determine which deployments to start
      interface DeploymentToStart {
        name: string;
        url: string;
        key?: string;
        projectPath: string;
        isLocal: boolean;
      }

      const deploymentsToStart: DeploymentToStart[] = [];

      if (options.deployment) {
        // Start specific deployment
        const deployment = config.deployments[options.deployment];

        if (!deployment) {
          console.error(
            pc.red(`\n   Deployment "${options.deployment}" not found`),
          );
          const names = Object.keys(config.deployments);
          if (names.length > 0) {
            console.log(pc.dim(`   Available: ${names.join(", ")}`));
          }
          console.log(
            pc.dim("   Run 'cortex config list' to see all deployments"),
          );
          process.exit(1);
        }

        const projectPath = deployment.projectPath || process.cwd();
        if (deployment.projectPath && !fs.existsSync(projectPath)) {
          console.error(pc.red(`\n   Project path not found: ${projectPath}`));
          console.log(
            pc.dim(
              "   Run 'cortex config set-path <deployment> <path>' to update",
            ),
          );
          process.exit(1);
        }

        deploymentsToStart.push({
          name: options.deployment,
          url: deployment.url,
          key: deployment.key,
          projectPath,
          // Only use --local flag if explicitly requested
          // Self-hosted backends (localhost URLs) should NOT use --local
          // as that starts a new local server instead of connecting to existing one
          isLocal: options.local,
        });
      } else {
        // Start all enabled deployments
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
            console.log(
              pc.dim(
                `   Run 'cortex config set-path ${name} <path>' to configure\n`,
              ),
            );
            continue;
          }

          if (!fs.existsSync(deployment.projectPath)) {
            console.log(
              pc.yellow(
                `   Skipping "${name}" - projectPath not found: ${deployment.projectPath}`,
              ),
            );
            continue;
          }

          deploymentsToStart.push({
            name,
            url: deployment.url,
            key: deployment.key,
            projectPath: deployment.projectPath,
            // Only use --local flag if explicitly requested
            // Self-hosted backends (localhost URLs) should NOT use --local
            isLocal: options.local,
          });
        }
      }

      if (deploymentsToStart.length === 0) {
        console.log(pc.yellow("\n   No deployments to start"));
        console.log(
          pc.dim("   Run 'cortex config enable <name>' to enable a deployment"),
        );
        console.log(
          pc.dim("   Or use 'cortex start -d <name>' to start a specific one"),
        );
        process.exit(0);
      }

      // Foreground mode only works with single deployment
      if (options.foreground && deploymentsToStart.length > 1) {
        console.error(
          pc.red("\n   Foreground mode only works with a single deployment"),
        );
        console.log(
          pc.dim("   Use 'cortex start -d <name> -f' for foreground mode"),
        );
        process.exit(1);
      }

      // Collect enabled apps for summary
      const apps = Object.entries(config.apps || {});
      const enabledApps = apps.filter(([, app]) => app.enabled);

      // Show summary header
      console.log();
      console.log(
        pc.bold(
          "  ═══════════════════════════════════════════════════════════",
        ),
      );
      console.log(pc.bold("  Cortex Start"));
      console.log(
        pc.bold(
          "  ═══════════════════════════════════════════════════════════",
        ),
      );
      console.log();

      // Deployments section
      console.log(
        pc.bold(pc.cyan(`  Deployments (${deploymentsToStart.length})`)),
      );
      console.log(
        pc.dim("  ───────────────────────────────────────────────────────────"),
      );

      // Start each deployment
      for (const dep of deploymentsToStart) {
        console.log(`  ${pc.green("●")} ${pc.cyan(dep.name)}`);
        console.log(pc.dim(`    Project: ${dep.projectPath}`));
        console.log(pc.dim(`    URL: ${dep.url}`));
        console.log();

        // Validate development authority before starting any selected services.
        const developmentEnv = developmentStartEnvironment(dep.url, dep.key);

        // Start graph database if configured and not convex-only
        if (!options.convexOnly) {
          const dockerComposePath = path.join(
            dep.projectPath,
            "docker-compose.graph.yml",
          );
          if (fs.existsSync(dockerComposePath)) {
            const composeContent = await fs.readFile(
              dockerComposePath,
              "utf-8",
            );
            const graphType: "neo4j" | "memgraph" = composeContent.includes(
              "memgraph",
            )
              ? "memgraph"
              : "neo4j";
            await startGraphContainers(dep.projectPath, graphType);
          }
        }

        // Start Convex if not graph-only
        if (!options.graphOnly) {
          const hasConvex = await commandExists("convex");
          const env = developmentEnv;

          if (options.foreground) {
            // Foreground mode - blocking (single deployment only)
            console.log(pc.cyan("   Starting Convex development server...\n"));
            console.log(pc.dim("   Press Ctrl+C to stop\n"));

            const command = hasConvex ? "convex" : "npx";
            const args = hasConvex ? ["dev"] : ["convex", "dev"];
            if (dep.isLocal) args.push("--local");

            const child = spawn(command, args, {
              cwd: dep.projectPath,
              stdio: "inherit",
              env,
            });

            await new Promise<void>((resolve) => {
              child.on("close", () => resolve());
            });
          } else {
            // Background mode
            await startConvexInBackground(
              dep.projectPath,
              dep.isLocal,
              dep.url,
              dep.key,
            );
          }
        }
      }

      // Start enabled apps (unless convex-only or graph-only)
      if (!options.convexOnly && !options.graphOnly && !options.foreground) {
        if (enabledApps.length > 0) {
          console.log(pc.bold(pc.cyan(`  Apps (${enabledApps.length})`)));
          console.log(
            pc.dim(
              "  ───────────────────────────────────────────────────────────",
            ),
          );

          for (const [name, app] of enabledApps) {
            console.log(`  ${pc.green("●")} ${pc.cyan(name)}`);
            console.log(pc.dim(`    Type: ${app.type}`));
            console.log(
              pc.dim(`    Path: ${path.join(app.projectPath, app.path)}`),
            );
            console.log(pc.dim(`    Port: ${app.port || 3000}`));
            console.log();
            await startApp(name, app);
          }
        }
      }

      // Show summary
      if (!options.foreground) {
        const totalStarted =
          deploymentsToStart.length + (enabledApps.length || 0);
        console.log(
          pc.bold(
            "  ═══════════════════════════════════════════════════════════",
          ),
        );
        console.log(pc.green(`  ✓ Started ${totalStarted} service(s)`));
        console.log(
          pc.bold(
            "  ═══════════════════════════════════════════════════════════",
          ),
        );
        console.log();
        console.log(pc.dim("  Use 'cortex stop' to stop all services"));
        console.log(
          pc.dim("  Use 'cortex config list' to see deployment status"),
        );
        console.log();
      }
    });

  // Stop command
  program
    .command("stop")
    .description("Stop background services (Convex, graph database, and apps)")
    .option("-d, --deployment <name>", "Stop specific deployment only")
    .option("-a, --app <name>", "Stop specific app only")
    .option("--convex-only", "Only stop Convex server", false)
    .option("--graph-only", "Only stop graph database", false)
    .option("--apps-only", "Only stop template apps", false)
    .action(async (options) => {
      // Load fresh config to get current state
      const config = await loadConfig();

      let stoppedSomething = false;
      let stoppedCount = 0;
      let stoppedAppsCount = 0;

      // If stopping specific app only
      if (options.app) {
        const appConfig = config.apps?.[options.app];

        if (!appConfig) {
          // Try to find app in current directory
          const cwd = process.cwd();
          const appPidFiles = await findAppPidFiles(cwd);
          const matchingApp = appPidFiles.find((a) => a.name === options.app);

          if (!matchingApp) {
            console.error(pc.red(`\n   Error: App "${options.app}" not found`));
            console.log(
              pc.dim("   Run 'cortex config list' to see available apps\n"),
            );
            process.exit(1);
          }

          // Stop from current directory
          const stopped = await stopApp(options.app, cwd);
          if (stopped) {
            console.log(pc.green(`\n   ✓ App "${options.app}" stopped\n`));
          } else {
            console.log(
              pc.yellow(`\n   App "${options.app}" was not running\n`),
            );
          }
          return;
        }

        // Stop specific configured app
        const stopped = await stopApp(options.app, appConfig.projectPath);
        if (stopped) {
          console.log(pc.green(`\n   ✓ App "${options.app}" stopped\n`));
        } else {
          console.log(pc.yellow(`\n   App "${options.app}" was not running\n`));
        }
        return;
      }

      // Determine which deployments/project paths to stop
      const deploymentsToStop: Array<{ name: string; projectPath: string }> =
        [];

      if (options.deployment) {
        // Stop specific deployment
        const deployment = config.deployments?.[options.deployment];
        if (!deployment) {
          console.error(
            pc.red(`\n   Error: Deployment "${options.deployment}" not found`),
          );
          console.log(
            pc.dim(
              "   Run 'cortex config list' to see available deployments\n",
            ),
          );
          process.exit(1);
        }
        if (!deployment.projectPath) {
          console.error(
            pc.red(
              `\n   Error: Deployment "${options.deployment}" has no project path`,
            ),
          );
          console.log(pc.dim("   This deployment may be remote-only\n"));
          process.exit(1);
        }
        deploymentsToStop.push({
          name: options.deployment,
          projectPath: deployment.projectPath,
        });
      } else {
        // Stop all deployments that have running processes
        const deploymentEntries = Object.entries(
          config.deployments || {},
        ) as Array<[string, DeploymentConfig]>;

        // Collect project paths from both deployments and apps
        const projectPaths = new Map<string, string>(); // path -> name

        if (deploymentEntries.length === 0 && !config.apps) {
          // Fallback to current directory
          const cwd = process.cwd();
          projectPaths.set(cwd, "current directory");
        } else {
          // Add deployment project paths
          for (const [name, deployment] of deploymentEntries) {
            if (
              deployment.projectPath &&
              fs.existsSync(deployment.projectPath)
            ) {
              projectPaths.set(deployment.projectPath, name);
            }
          }

          // Add app project paths (may overlap with deployments)
          if (config.apps) {
            for (const [appName, app] of Object.entries(config.apps)) {
              if (app.projectPath && fs.existsSync(app.projectPath)) {
                // Use app name if no deployment for this path
                if (!projectPaths.has(app.projectPath)) {
                  projectPaths.set(app.projectPath, `app:${appName}`);
                }
              }
            }
          }
        }

        // Check each project path for running services
        for (const [projectPath, name] of projectPaths) {
          // Check if anything is running for this deployment
          const pidFile = path.join(projectPath, ".convex-dev.pid");
          const dockerCompose = path.join(
            projectPath,
            "docker-compose.graph.yml",
          );
          const appPidFiles = await findAppPidFiles(projectPath);

          const hasPidFile = fs.existsSync(pidFile);
          const hasDockerCompose = fs.existsSync(dockerCompose);
          const hasApps = appPidFiles.length > 0;

          if (hasPidFile || hasDockerCompose || hasApps) {
            deploymentsToStop.push({ name, projectPath });
          }
        }
      }

      if (deploymentsToStop.length === 0) {
        console.log(
          pc.yellow("\n   No deployments with running services found"),
        );
        console.log(
          pc.dim(
            "   Note: Services started without PID files cannot be auto-detected.\n" +
              "   Use 'ps aux | grep convex' or 'ps aux | grep next' to find running processes.\n",
          ),
        );
        return;
      }

      console.log(
        pc.cyan(`\n   Stopping ${deploymentsToStop.length} deployment(s)...\n`),
      );

      for (const { name, projectPath } of deploymentsToStop) {
        console.log(pc.bold(`   ${name}`));
        console.log(pc.dim(`   ${projectPath}`));

        let deploymentStopped = false;
        let convexStopped = false;

        // Stop Convex if not graph-only and not apps-only
        if (!options.graphOnly && !options.appsOnly) {
          const pidFile = path.join(projectPath, ".convex-dev.pid");

          try {
            const pid = await fs.readFile(pidFile, "utf-8");
            const pidNum = parseInt(pid.trim());

            try {
              process.kill(pidNum, "SIGTERM");
              console.log(pc.green(`   ✓ Convex stopped (PID: ${pidNum})`));
              stoppedSomething = true;
              deploymentStopped = true;
              convexStopped = true;
            } catch (e) {
              const err = e as { code?: string };
              if (err.code === "ESRCH") {
                console.log(pc.yellow("   Convex was already stopped"));
                convexStopped = true; // Consider it handled
              } else {
                throw e;
              }
            }

            // Clean up pid file
            await fs.remove(pidFile);
          } catch (e) {
            const err = e as { code?: string };
            if (err.code !== "ENOENT") {
              console.error(pc.red("   Error stopping Convex:"), e);
            }
            // No PID file - will try port-based detection below
          }

          // Fallback: try to stop by port if no PID file and deployment is local
          if (!convexStopped) {
            // Check if this is a local deployment (port 3210)
            const deploymentConfig = Object.values(
              config.deployments || {},
            ).find((d) => d.projectPath === projectPath);
            const isLocal =
              deploymentConfig?.url?.includes("127.0.0.1:3210") ||
              deploymentConfig?.url?.includes("localhost:3210");

            if (isLocal) {
              const convexPid = await findProcessByPort(3210);
              if (convexPid) {
                console.log(
                  pc.yellow(`   Found Convex on port 3210 (no PID file)`),
                );
                const stopped = await stopProcessByPort(3210);
                if (stopped) {
                  console.log(
                    pc.green(
                      `   ✓ Convex stopped (port 3210, PID: ${convexPid})`,
                    ),
                  );
                  stoppedSomething = true;
                  deploymentStopped = true;
                }
              } else {
                console.log(pc.dim("   No Convex process running"));
              }
            } else if (!options.graphOnly && !options.appsOnly) {
              console.log(
                pc.dim("   No Convex process running (PID file not found)"),
              );
            }
          }
        }

        // Stop graph containers if not convex-only and not apps-only
        if (!options.convexOnly && !options.appsOnly) {
          const dockerComposePath = path.join(
            projectPath,
            "docker-compose.graph.yml",
          );

          if (fs.existsSync(dockerComposePath)) {
            const stopped = await stopGraphContainers(projectPath);
            if (stopped) {
              console.log(pc.green("   ✓ Graph database stopped"));
              stoppedSomething = true;
              deploymentStopped = true;
            } else {
              console.log(pc.dim("   No graph container running"));
            }
          } else if (!options.convexOnly && !options.appsOnly) {
            console.log(pc.dim("   No graph database configured"));
          }
        }

        // Stop apps if not convex-only and not graph-only
        if (!options.convexOnly && !options.graphOnly) {
          const appPidFiles = await findAppPidFiles(projectPath);
          const stoppedAppNames = new Set<string>();

          // First, try to stop apps with PID files
          if (appPidFiles.length > 0) {
            for (const { name: appName } of appPidFiles) {
              const appStatus = await isAppRunning(appName, projectPath);
              if (appStatus.running) {
                const stopped = await stopApp(appName, projectPath);
                if (stopped) {
                  console.log(
                    pc.green(
                      `   ✓ App "${appName}" stopped (PID: ${appStatus.pid})`,
                    ),
                  );
                  stoppedSomething = true;
                  stoppedAppsCount++;
                  deploymentStopped = true;
                  stoppedAppNames.add(appName);
                }
              } else {
                // Clean up stale PID file (already handled by isAppRunning)
                console.log(pc.dim(`   App "${appName}" was not running`));
              }
            }
          }

          // Also check configured apps that might not have PID files
          // (started before PID tracking was added)
          if (config.apps) {
            for (const [appName, appConfig] of Object.entries(config.apps)) {
              // Skip if already stopped via PID file or not matching this project
              if (stoppedAppNames.has(appName)) continue;
              if (appConfig.projectPath !== projectPath) continue;

              const port = appConfig.port || 3000;
              const pid = await findProcessByPort(port);

              if (pid) {
                console.log(
                  pc.yellow(
                    `   Found app "${appName}" on port ${port} (no PID file)`,
                  ),
                );
                const stopped = await stopProcessByPort(port);
                if (stopped) {
                  console.log(
                    pc.green(
                      `   ✓ App "${appName}" stopped (port ${port}, PID: ${pid})`,
                    ),
                  );
                  stoppedSomething = true;
                  stoppedAppsCount++;
                  deploymentStopped = true;
                }
              }
            }
          }

          if (appPidFiles.length === 0 && !config.apps && options.appsOnly) {
            console.log(pc.dim("   No apps configured"));
          }
        }

        if (deploymentStopped) {
          stoppedCount++;
        }
        console.log();
      }

      // Summary
      if (stoppedSomething) {
        const parts: string[] = [];
        if (stoppedCount > 0 && !options.appsOnly) {
          parts.push(`${stoppedCount} deployment(s)`);
        }
        if (stoppedAppsCount > 0) {
          parts.push(`${stoppedAppsCount} app(s)`);
        }
        console.log(pc.green(`   ✓ Stopped ${parts.join(" and ")}\n`));
      } else {
        console.log(pc.yellow("   No services were running\n"));
      }
    });
}

/** SDK-only initialization. Application templates have a separate explicit channel. */
export function registerInitCommand(
  program: Command,
  _config: CLIConfig,
  services: TemplateCommandServices = {},
): void {
  installerOptions(
    program
      .command("init [directory]")
      .description("Create a basic or backend-only Cortex project"),
  )
    .option("-t, --template <name>", "Template: basic or none", "basic")
    .option("--templates-package <path>", "Explicit catalog directory or tarball for Basic")
    .option("--catalog-version <version>", "Exact independent catalog version")
    .option("--template-version <version>", "Exact Basic template version")
    .option("--start", "Retired: use separate foreground cortex dev")
    .action(
      async (
        directory: string | undefined,
      options: TemplateCommandOptions,
        command: Command,
      ) => {
        await runInitWizard(directory, options,
          { graphExplicit: command.getOptionValueSource("graph") === "cli" }, services);
      },
    );
}
export async function runInitWizard(
  directory?: string,
  options: InstallOptions & TemplateCommandOptions = {},
  interaction: GraphInteraction = {},
  services: TemplateCommandServices = {},
): Promise<void> {
  // Deterministic SDK workflows need no graph, API-key, login or global-config prompts.
  const resolved = { ...options };
  if (!resolved.local && !resolved.cloud && resolved.deploy !== false)
    resolved.local = true;
  validateInstallOptions({ ...resolved, graph: "none", skipGraph: true, graphMode: undefined, graphUri: undefined });
  if (!resolved.template || resolved.template === "basic") {
    const selected = await resolveInteractiveGraph(selectedGraphOptions({ ...resolved }), resolved, interaction);
    await runCatalogBasicInit(directory ?? "cortex-project", { ...resolved, ...selected, deploy: resolved.deploy !== false }, services);
    return;
  }
  try {
    printInstallResult(
      await installWithGraph(directory ?? "cortex-project", resolved, true, interaction),
      options,
    );
  } catch (error) {
    if (error instanceof GraphInstallPartialError)
      printInstallResult(error.result, options);
    throw error;
  }
}

async function startConvexInBackground(
  projectPath: string,
  isLocal: boolean,
  deploymentUrl?: string,
  deploymentKey?: string,
): Promise<void> {
  const hasConvex = await commandExists("convex");
  const command = hasConvex ? "convex" : "npx";

  // Set up environment with deployment-specific URL/key if provided
  const env = developmentStartEnvironment(deploymentUrl, deploymentKey);

  // Start convex dev in background for watch mode
  const devSpinner = ora("Starting Convex development server...").start();

  const args = hasConvex ? ["dev"] : ["convex", "dev"];
  if (isLocal) {
    args.push("--local");
  }

  // Create log file for the background process
  const logFile = path.join(projectPath, ".convex-dev.log");
  // Use fs.openSync to get a file descriptor (required for detached process stdio)
  const logFd = fs.openSync(logFile, "a");

  // Spawn detached process
  const child = spawn(command, args, {
    cwd: projectPath,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env,
  });

  // Close the file descriptor in parent process (child keeps it open)
  fs.closeSync(logFd);

  // Unref so parent can exit independently
  child.unref();

  // Save PID for later management
  const pidFile = path.join(projectPath, ".convex-dev.pid");
  await fs.writeFile(pidFile, String(child.pid));

  // Wait a moment for startup
  await new Promise((resolve) => setTimeout(resolve, 2000));

  devSpinner.succeed("Convex development server started in background");
  console.log(pc.dim(`   PID: ${child.pid}`));
  console.log(pc.dim(`   Log: ${path.basename(logFile)}`));
}
