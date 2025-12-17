/**
 * Init Command
 *
 * Interactive wizard for setting up a new Cortex Memory project.
 * Replaces `npx create-cortex-memories` with a more integrated CLI experience.
 */

import { Command } from "commander";
import prompts from "prompts";
import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import ora from "ora";
import type { CLIConfig, DeploymentConfig } from "../types.js";
import type { WizardConfig, GraphConfig } from "../utils/init/types.js";
import { spawn } from "child_process";
import { loadConfig, saveUserConfig } from "../utils/config.js";
import {
  isValidProjectName,
  isDirectoryEmpty,
  fetchLatestSDKMetadata,
  execCommand,
  commandExists,
} from "../utils/shell.js";
import {
  setupNewConvex,
  setupExistingConvex,
  deployToConvex,
} from "../utils/init/convex-setup.js";
import {
  getGraphConfig,
  setupGraphFiles,
  addGraphDependencies,
  createGraphExample,
  startGraphContainers,
  stopGraphContainers,
} from "../utils/init/graph-setup.js";
import {
  copyTemplate,
  deployCortexBackend,
  createConvexJson,
  ensureGitignore,
} from "../utils/init/file-operations.js";
import { createEnvFile, appendGraphEnvVars } from "../utils/init/env-generator.js";

/**
 * Register init commands
 */
export function registerInitCommands(
  program: Command,
  _config: CLIConfig,
): void {
  // Quick start command
  program
    .command("start")
    .description("Start development services (all enabled deployments)")
    .option("-d, --deployment <name>", "Start a specific deployment only")
    .option("-l, --local", "Use Convex local beta mode (starts a new local backend)", false)
    .option("-f, --foreground", "Run in foreground (only works with single deployment)", false)
    .option("--convex-only", "Only start Convex servers", false)
    .option("--graph-only", "Only start graph databases", false)
    .action(async (options) => {
      const config = await loadConfig();

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
          console.error(pc.red(`\n   Deployment "${options.deployment}" not found`));
          const names = Object.keys(config.deployments);
          if (names.length > 0) {
            console.log(pc.dim(`   Available: ${names.join(", ")}`));
          }
          console.log(pc.dim("   Run 'cortex config list' to see all deployments"));
          process.exit(1);
        }

        const projectPath = deployment.projectPath || process.cwd();
        if (deployment.projectPath && !fs.existsSync(projectPath)) {
          console.error(pc.red(`\n   Project path not found: ${projectPath}`));
          console.log(pc.dim("   Run 'cortex config set-path <deployment> <path>' to update"));
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
          const isEnabled = deployment.enabled === true || (deployment.enabled === undefined && isDefault);
          
          if (!isEnabled) continue;
          
          if (!deployment.projectPath) {
            console.log(pc.yellow(`   Skipping "${name}" - no projectPath configured`));
            console.log(pc.dim(`   Run 'cortex config set-path ${name} <path>' to configure\n`));
            continue;
          }
          
          if (!fs.existsSync(deployment.projectPath)) {
            console.log(pc.yellow(`   Skipping "${name}" - projectPath not found: ${deployment.projectPath}`));
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
        console.log(pc.dim("   Run 'cortex config enable <name>' to enable a deployment"));
        console.log(pc.dim("   Or use 'cortex start -d <name>' to start a specific one"));
        process.exit(0);
      }

      // Foreground mode only works with single deployment
      if (options.foreground && deploymentsToStart.length > 1) {
        console.error(pc.red("\n   Foreground mode only works with a single deployment"));
        console.log(pc.dim("   Use 'cortex start -d <name> -f' for foreground mode"));
        process.exit(1);
      }

      console.log(pc.cyan(`\n   Starting ${deploymentsToStart.length} deployment(s)...\n`));

      // Start each deployment
      for (const dep of deploymentsToStart) {
        console.log(pc.bold(`   ${dep.name}`));
        console.log(pc.dim(`   Project: ${dep.projectPath}`));
        console.log(pc.dim(`   URL: ${dep.url}\n`));

        // Start graph database if configured and not convex-only
        if (!options.convexOnly) {
          const dockerComposePath = path.join(dep.projectPath, "docker-compose.graph.yml");
          if (fs.existsSync(dockerComposePath)) {
            const composeContent = await fs.readFile(dockerComposePath, "utf-8");
            const graphType: "neo4j" | "memgraph" = composeContent.includes("memgraph")
              ? "memgraph"
              : "neo4j";
            await startGraphContainers(dep.projectPath, graphType);
          }
        }

        // Start Convex if not graph-only
        if (!options.graphOnly) {
          if (options.foreground) {
            // Foreground mode - blocking (single deployment only)
            console.log(pc.cyan("   Starting Convex development server...\n"));
            console.log(pc.dim("   Press Ctrl+C to stop\n"));

            const hasConvex = await commandExists("convex");
            const command = hasConvex ? "convex" : "npx";
            const args = hasConvex ? ["dev"] : ["convex", "dev"];
            if (dep.isLocal) args.push("--local");

            const env: Record<string, string | undefined> = { ...process.env };
            env.CONVEX_URL = dep.url;
            if (dep.key) env.CONVEX_DEPLOY_KEY = dep.key;

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
            await startConvexInBackground(dep.projectPath, dep.isLocal, dep.url, dep.key);
          }
        }
      }

      // Show summary
      if (!options.foreground) {
        console.log(pc.green("\n   ✓ All deployments started\n"));
        console.log(pc.dim("   Use 'cortex stop' to stop all services"));
        console.log(pc.dim("   Use 'cortex config list' to see deployment status"));
      }
    });

  // Stop command
  program
    .command("stop")
    .description("Stop background services (Convex and graph database)")
    .option("-d, --deployment <name>", "Stop specific deployment only")
    .option("--convex-only", "Only stop Convex server", false)
    .option("--graph-only", "Only stop graph database", false)
    .action(async (options) => {
      let stoppedSomething = false;
      let stoppedCount = 0;

      // Determine which deployments to stop
      const deploymentsToStop: Array<{ name: string; projectPath: string }> = [];

      if (options.deployment) {
        // Stop specific deployment
        const deployment = _config.deployments?.[options.deployment];
        if (!deployment) {
          console.error(pc.red(`\n   Error: Deployment "${options.deployment}" not found`));
          console.log(pc.dim("   Run 'cortex config list' to see available deployments\n"));
          process.exit(1);
        }
        if (!deployment.projectPath) {
          console.error(pc.red(`\n   Error: Deployment "${options.deployment}" has no project path`));
          console.log(pc.dim("   This deployment may be remote-only\n"));
          process.exit(1);
        }
        deploymentsToStop.push({ name: options.deployment, projectPath: deployment.projectPath });
      } else {
        // Stop all deployments that have running processes
        const deploymentEntries = Object.entries(_config.deployments || {}) as Array<[string, DeploymentConfig]>;
        
        if (deploymentEntries.length === 0) {
          // Fallback to current directory
          const cwd = process.cwd();
          deploymentsToStop.push({ name: "current directory", projectPath: cwd });
        } else {
          for (const [name, deployment] of deploymentEntries) {
            if (deployment.projectPath && fs.existsSync(deployment.projectPath)) {
              // Check if anything is running for this deployment
              const pidFile = path.join(deployment.projectPath, ".convex-dev.pid");
              const dockerCompose = path.join(deployment.projectPath, "docker-compose.graph.yml");
              
              const hasPidFile = fs.existsSync(pidFile);
              const hasDockerCompose = fs.existsSync(dockerCompose);
              
              if (hasPidFile || hasDockerCompose) {
                deploymentsToStop.push({ name, projectPath: deployment.projectPath });
              }
            }
          }
        }
      }

      if (deploymentsToStop.length === 0) {
        console.log(pc.yellow("\n   No deployments with running services found\n"));
        return;
      }

      console.log(pc.cyan(`\n   Stopping ${deploymentsToStop.length} deployment(s)...\n`));

      for (const { name, projectPath } of deploymentsToStop) {
        console.log(pc.bold(`   ${name}`));
        console.log(pc.dim(`   ${projectPath}`));
        
        let deploymentStopped = false;

        // Stop Convex if not graph-only
        if (!options.graphOnly) {
          const pidFile = path.join(projectPath, ".convex-dev.pid");

          try {
            const pid = await fs.readFile(pidFile, "utf-8");
            const pidNum = parseInt(pid.trim());

            try {
              process.kill(pidNum, "SIGTERM");
              console.log(pc.green(`   ✓ Convex stopped (PID: ${pidNum})`));
              stoppedSomething = true;
              deploymentStopped = true;
            } catch (e) {
              const err = e as { code?: string };
              if (err.code === "ESRCH") {
                console.log(pc.yellow("   Convex was already stopped"));
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
            } else if (!options.graphOnly) {
              console.log(pc.dim("   No Convex process running"));
            }
          }
        }

        // Stop graph containers if not convex-only
        if (!options.convexOnly) {
          const dockerComposePath = path.join(projectPath, "docker-compose.graph.yml");

          if (fs.existsSync(dockerComposePath)) {
            const stopped = await stopGraphContainers(projectPath);
            if (stopped) {
              console.log(pc.green("   ✓ Graph database stopped"));
              stoppedSomething = true;
              deploymentStopped = true;
            } else {
              console.log(pc.dim("   No graph container running"));
            }
          } else if (!options.convexOnly) {
            console.log(pc.dim("   No graph database configured"));
          }
        }

        if (deploymentStopped) {
          stoppedCount++;
        }
        console.log();
      }

      if (stoppedSomething) {
        console.log(pc.green(`   ✓ Stopped ${stoppedCount} deployment(s)\n`));
      } else {
        console.log(pc.yellow("   No services were running\n"));
      }
    });

  // Init command
  program
    .command("init [directory]")
    .description("Initialize a new Cortex Memory project")
    .option("--local", "Quick setup with local Convex only", false)
    .option("--cloud", "Quick setup with cloud Convex only", false)
    .option("--skip-graph", "Skip graph database setup", false)
    .option(
      "-t, --template <name>",
      "Template to use (default: basic)",
      "basic",
    )
    .option("-y, --yes", "Skip confirmation prompts", false)
    .option("--start", "Start Convex dev server after setup", false)
    .action(async (targetDir, options) => {
      try {
        await runInitWizard(targetDir, options);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "Setup cancelled") {
            process.exit(0);
          }
          console.error(pc.red("\n   Error:"), error.message);
        } else {
          console.error(pc.red("\n   An unexpected error occurred:"), error);
        }
        process.exit(1);
      }
    });
}

/**
 * Run the interactive init wizard
 */
export async function runInitWizard(
  targetDir?: string,
  options: {
    local?: boolean;
    cloud?: boolean;
    skipGraph?: boolean;
    template?: string;
    yes?: boolean;
    start?: boolean;
  } = {},
): Promise<void> {
  console.log(pc.bold(pc.cyan("\n   Cortex Memory Project Setup\n")));
  console.log(pc.dim("   Setting up AI agent with persistent memory\n"));

  // Step 1: Project name and location
  const projectInfo = await getProjectInfo(targetDir);

  // Step 2: Installation type
  const installationType = await getInstallationType(projectInfo.projectPath);

  // Step 3: Convex setup
  const convexConfig = await getConvexSetup(options);

  // Step 4: Graph database (optional)
  let graphConfig: GraphConfig | null = null;
  if (!options.skipGraph) {
    graphConfig = await getGraphConfig();
  }

  // Step 5: CLI scripts option
  const installCLI = await getCliInstallOption();

  // Build wizard configuration
  const config: WizardConfig = {
    projectName: projectInfo.projectName,
    projectPath: projectInfo.projectPath,
    installationType,
    convexSetupType: convexConfig.type,
    convexUrl: convexConfig.config.convexUrl,
    deployKey: convexConfig.config.deployKey,
    graphEnabled: graphConfig !== null,
    graphType: graphConfig?.type || "skip",
    graphUri: graphConfig?.uri,
    graphUsername: graphConfig?.username,
    graphPassword: graphConfig?.password,
    installCLI,
  };

  // Show confirmation
  if (!options.yes) {
    await showConfirmation(config);
  }

  // Execute setup
  await executeSetup(config);

  // Ask to start Convex if not already specified
  let shouldStart = options.start;
  if (!shouldStart && !options.yes) {
    const response = await prompts({
      type: "confirm",
      name: "startNow",
      message: "Start Convex development server now?",
      initial: true,
    });
    shouldStart = response.startNow;
  }

  // Start Convex if requested
  if (shouldStart) {
    const isLocal = config.convexSetupType === "local";
    await startConvexInBackground(config.projectPath, isLocal);
    
    // Show running status dashboard
    console.log();
    await showRunningStatus(config.projectPath, isLocal);
  }
}

/**
 * Get project name and location
 */
async function getProjectInfo(targetDir?: string): Promise<{
  projectName: string;
  projectPath: string;
}> {
  if (targetDir) {
    const projectPath = path.resolve(targetDir);
    const projectName =
      targetDir === "."
        ? path.basename(process.cwd())
        : path.basename(projectPath);

    return { projectName, projectPath };
  }

  const response = await prompts({
    type: "text",
    name: "projectName",
    message: "Project name:",
    initial: "my-cortex-agent",
    validate: (value) => {
      if (!value) return "Project name is required";
      if (!isValidProjectName(value)) {
        return "Project name must contain only lowercase letters, numbers, hyphens, and underscores";
      }
      return true;
    },
  });

  if (!response.projectName) {
    throw new Error("Project name is required");
  }

  const projectPath = path.resolve(response.projectName);
  return {
    projectName: response.projectName,
    projectPath,
  };
}

/**
 * Get installation type
 */
async function getInstallationType(
  projectPath: string,
): Promise<"new" | "existing"> {
  const exists = fs.existsSync(projectPath);
  const isEmpty = isDirectoryEmpty(projectPath);

  if (exists && !isEmpty) {
    const response = await prompts({
      type: "confirm",
      name: "addToExisting",
      message: `Directory ${path.basename(projectPath)} already exists. Add Cortex to existing project?`,
      initial: true,
    });

    if (!response.addToExisting) {
      throw new Error("Setup cancelled");
    }

    return "existing";
  }

  return "new";
}

/**
 * Get Convex setup configuration
 */
async function getConvexSetup(options: {
  local?: boolean;
  cloud?: boolean;
}): Promise<{
  type: "new" | "existing" | "local";
  config: { convexUrl: string; deployKey?: string };
}> {
  // Quick options
  if (options.local) {
    return {
      type: "local",
      config: { convexUrl: "http://127.0.0.1:3210" },
    };
  }

  if (options.cloud) {
    return {
      type: "new",
      config: { convexUrl: "" },
    };
  }

  console.log(pc.cyan("\n   Convex Database Setup"));
  console.log(pc.dim("   Cortex uses Convex as its backend database\n"));

  const response = await prompts({
    type: "select",
    name: "setupType",
    message: "How would you like to set up Convex?",
    choices: [
      {
        title: "Create new Convex project",
        description: "Full features including vector search",
        value: "new",
      },
      {
        title: "Use existing Convex deployment",
        description: "Connect to your existing deployment",
        value: "existing",
      },
    ],
    initial: 0,
  });

  if (!response.setupType) {
    throw new Error("Convex setup is required");
  }

  return {
    type: response.setupType,
    config: {
      convexUrl: "",
      deployKey: undefined,
    },
  };
}

/**
 * Get CLI installation option
 */
async function getCliInstallOption(): Promise<boolean> {
  console.log(pc.cyan("\n   CLI Scripts (Optional)"));
  console.log(pc.dim("   Add npm scripts for common Cortex commands\n"));

  const response = await prompts({
    type: "confirm",
    name: "installCLI",
    message: "Add Cortex CLI scripts to package.json?",
    initial: true,
  });

  return response.installCLI ?? false;
}

/**
 * Show confirmation screen
 */
async function showConfirmation(config: WizardConfig): Promise<void> {
  console.log(pc.cyan("\n   Configuration Summary"));
  console.log(pc.dim("   " + "─".repeat(46)));
  console.log(pc.bold("   Project:"), config.projectName);
  console.log(pc.bold("   Location:"), config.projectPath);
  console.log(
    pc.bold("   Type:"),
    config.installationType === "new" ? "New project" : "Add to existing",
  );
  console.log(
    pc.bold("   Convex:"),
    config.convexSetupType === "new" ? "New Convex project" : "Existing deployment",
  );
  console.log(
    pc.bold("   Graph DB:"),
    config.graphEnabled ? config.graphType : "Disabled",
  );
  console.log(
    pc.bold("   CLI Scripts:"),
    config.installCLI ? "Yes" : "No",
  );
  console.log(pc.dim("   " + "─".repeat(46)));

  const response = await prompts({
    type: "confirm",
    name: "confirm",
    message: "Proceed with setup?",
    initial: true,
  });

  if (!response.confirm) {
    console.log(pc.yellow("\n   Setup cancelled"));
    process.exit(0);
  }
}

/**
 * Execute the setup
 */
async function executeSetup(config: WizardConfig): Promise<void> {
  console.log(pc.cyan("\n   Setting up Cortex...\n"));

  try {
    // Create project directory
    await fs.ensureDir(config.projectPath);

    // Fetch SDK metadata to get correct Convex version
    const metadataSpinner = ora("Fetching SDK metadata...").start();
    const sdkMetadata = await fetchLatestSDKMetadata();
    metadataSpinner.succeed(
      `SDK v${sdkMetadata.sdkVersion} (Convex ${sdkMetadata.convexVersion})`,
    );

    // Copy template files (check if package.json exists)
    const needsTemplate = !fs.existsSync(
      path.join(config.projectPath, "package.json"),
    );

    if (needsTemplate || config.installationType === "new") {
      const spinner = ora("Creating project files...").start();
      await copyTemplate(
        "basic",
        config.projectPath,
        config.projectName,
        sdkMetadata.convexVersion,
      );
      spinner.succeed("Project files created");
    } else {
      console.log(pc.dim("   Using existing project files"));
    }

    // Create .gitignore first (before any generated files)
    await ensureGitignore(config.projectPath);

    // Install dependencies FIRST - required for convex dev to work
    const installSpinner = ora("Installing dependencies...").start();
    const result = await execCommand("npm", ["install"], {
      cwd: config.projectPath,
      quiet: true,
    });
    if (result.code !== 0) {
      installSpinner.fail("Failed to install dependencies");
      console.error(pc.red(result.stderr));
      throw new Error("npm install failed");
    }
    installSpinner.succeed("Dependencies installed");

    // Verify convex was installed (required for convex dev)
    const convexCheck = fs.existsSync(
      path.join(config.projectPath, "node_modules", "convex"),
    );
    if (!convexCheck) {
      console.warn(
        pc.yellow("   Warning: convex package not found in node_modules"),
      );
      console.log(pc.dim("   This may cause Convex setup to fail"));
    }

    // Copy Cortex backend functions FIRST (before convex dev)
    // This way we deploy everything in ONE step
    const backendSpinner = ora("Setting up Cortex backend functions...").start();
    await deployCortexBackend(config.projectPath);
    await createConvexJson(config.projectPath);
    backendSpinner.succeed("Cortex backend files ready");

    // Setup and deploy Convex in ONE step
    let convexConfig;
    if (config.convexSetupType === "new") {
      // For new projects: prompt for project creation and deploy everything
      convexConfig = await setupNewConvex(config.projectPath);
    } else {
      // For existing projects: get URL/key, then deploy
      convexConfig = await setupExistingConvex();
      await deployToConvex(config.projectPath, convexConfig, false);
    }

    // Update config with actual Convex details
    config.convexUrl = convexConfig.convexUrl;
    config.deployKey = convexConfig.deployKey;

    // Create .env.local (may already exist from convex dev, but ensure our values)
    await createEnvFile(config.projectPath, config);

    // Read actual Convex URL from .env.local (convex dev may have created/updated it)
    const envLocalPath = path.join(config.projectPath, ".env.local");
    if (fs.existsSync(envLocalPath)) {
      try {
        const envContent = await fs.readFile(envLocalPath, "utf-8");
        const urlMatch = envContent.match(/CONVEX_URL=(.+)/);
        const keyMatch = envContent.match(/CONVEX_DEPLOY_KEY=(.+)/);
        
        if (urlMatch) {
          config.convexUrl = urlMatch[1].trim();
        }
        if (keyMatch && !config.deployKey) {
          config.deployKey = keyMatch[1].trim();
        }
      } catch {
        // Ignore read errors
      }
    }

    // Setup graph database if enabled
    if (config.graphEnabled && config.graphType !== "skip") {
      const graphSpinner = ora("Configuring graph database...").start();

      await setupGraphFiles(config.projectPath, {
        type: config.graphType as "neo4j" | "memgraph",
        uri: config.graphUri!,
        username: config.graphUsername!,
        password: config.graphPassword!,
      });

      // Add graph env vars to .env.local (after Convex may have modified it)
      await appendGraphEnvVars(config.projectPath, {
        graphUri: config.graphUri!,
        graphUsername: config.graphUsername!,
        graphPassword: config.graphPassword!,
      });

      await addGraphDependencies(config.projectPath);
      await createGraphExample(config.projectPath);
      graphSpinner.succeed("Graph database configured");

      // Start graph containers if local deployment
      const isLocalGraph =
        config.graphUri?.includes("localhost") ||
        config.graphUri?.includes("127.0.0.1");

      if (isLocalGraph) {
        console.log();
        await startGraphContainers(
          config.projectPath,
          config.graphType as "neo4j" | "memgraph",
        );
      }
    }

    // Add CLI scripts if requested
    if (config.installCLI) {
      await addCLIScripts(config.projectPath);
    }

    // Save deployment to user config (~/.cortexrc)
    await saveDeploymentToConfig(config);

    // Success!
    showSuccessMessage(config);
  } catch (error) {
    console.error(pc.red("\n   Setup failed:"), error);
    throw error;
  }
}

/**
 * Save deployment configuration to ~/.cortexrc
 */
async function saveDeploymentToConfig(config: WizardConfig): Promise<void> {
  // Skip if no URL was configured
  if (!config.convexUrl) {
    return;
  }

  try {
    const userConfig = await loadConfig();
    
    // Always use project name as deployment name (sanitized)
    // This keeps deployment names consistent regardless of URL type
    const deploymentName = config.projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    
    // Add the deployment
    userConfig.deployments[deploymentName] = {
      url: config.convexUrl,
      key: config.deployKey,
      projectPath: config.projectPath,
    };
    
    // Set as default if no default exists
    if (!userConfig.default) {
      userConfig.default = deploymentName;
    }
    
    await saveUserConfig(userConfig);
    console.log(pc.dim(`   Saved deployment "${deploymentName}" to config`));
  } catch {
    // Non-critical error - warn but don't fail
    console.warn(pc.yellow("   Warning: Could not save deployment to config"));
    console.log(pc.dim("   Run 'cortex config add-deployment' to add manually"));
  }
}

/**
 * Add CLI scripts to package.json
 */
async function addCLIScripts(projectPath: string): Promise<void> {
  const packageJsonPath = path.join(projectPath, "package.json");

  try {
    const packageJson = await fs.readJson(packageJsonPath);

    // Add CLI scripts
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts["cortex"] = "cortex";
    packageJson.scripts["cortex:setup"] = "cortex setup";
    packageJson.scripts["cortex:stats"] = "cortex db stats";
    packageJson.scripts["cortex:spaces"] = "cortex spaces list";
    packageJson.scripts["cortex:status"] = "cortex status";

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    console.log(pc.dim("   Added CLI scripts to package.json"));
  } catch {
    // Non-critical, skip silently
  }
}

/**
 * Show success message
 */
function showSuccessMessage(config: WizardConfig): void {
  console.log(
    pc.bold(pc.green("\n   Cortex Memory successfully initialized!\n")),
  );

  console.log(pc.bold("   Project:"), config.projectName);
  console.log(
    pc.bold("   Database:"),
    config.convexSetupType === "local"
      ? "Local Convex (development)"
      : `Convex Cloud (${config.convexUrl})`,
  );

  if (config.graphEnabled && config.graphType !== "skip") {
    console.log(pc.bold("   Graph:"), config.graphType, "(configured)");
  }

  console.log(pc.green("\n   Setup complete!\n"));

  console.log(pc.bold("   Next steps:\n"));

  if (config.installationType === "new") {
    console.log(pc.cyan(`   cd ${config.projectName}`));
  }

  if (config.convexSetupType === "local") {
    console.log(
      pc.cyan("   npm run dev") + pc.dim("   # Start Convex in watch mode"),
    );
    console.log(pc.dim("   (Then in another terminal)"));
    console.log(pc.cyan("   npm start") + pc.dim("      # Run your AI agent"));
    console.log(pc.dim("\n   Dashboard: http://127.0.0.1:3210"));
  } else {
    console.log(pc.cyan("   npm start") + pc.dim("  # Run your AI agent"));
    console.log(
      pc.dim(`\n   Dashboard: ${config.convexUrl?.replace("/api", "")}`),
    );
  }

  // CLI commands
  console.log(pc.bold("\n   CLI Commands:\n"));
  console.log(
    pc.cyan("   cortex status") +
      pc.dim("        # View setup status dashboard"),
  );
  console.log(
    pc.cyan("   cortex db stats") +
      pc.dim("      # View database statistics"),
  );
  console.log(
    pc.cyan("   cortex spaces list") + pc.dim("   # List memory spaces"),
  );
  console.log(
    pc.cyan("   cortex --help") + pc.dim("        # See all CLI commands"),
  );

  console.log(pc.bold("\n   Learn more:\n"));
  console.log(
    pc.dim(
      "   Documentation: https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation",
    ),
  );
  console.log(
    pc.dim(
      "   Examples:      https://github.com/SaintNick1214/Project-Cortex/tree/main/Examples",
    ),
  );

  console.log(pc.bold(pc.cyan("\n   Happy building with Cortex!\n")));
}

/**
 * Start Convex development server in background
 */
async function startConvexInBackground(
  projectPath: string,
  isLocal: boolean,
  deploymentUrl?: string,
  deploymentKey?: string,
): Promise<void> {
  const spinner = ora("Starting Convex development server...").start();

  const hasConvex = await commandExists("convex");
  const command = hasConvex ? "convex" : "npx";
  const args = hasConvex ? ["dev"] : ["convex", "dev"];

  if (isLocal) {
    args.push("--local");
  }

  // Create log file for the background process
  const logFile = path.join(projectPath, ".convex-dev.log");
  // Use fs.openSync to get a file descriptor (required for detached process stdio)
  const logFd = fs.openSync(logFile, "a");

  // Set up environment with deployment-specific URL/key if provided
  const env: Record<string, string | undefined> = { ...process.env };
  if (deploymentUrl) env.CONVEX_URL = deploymentUrl;
  if (deploymentKey) env.CONVEX_DEPLOY_KEY = deploymentKey;

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

  spinner.succeed("Convex development server started in background");
  console.log(pc.dim(`   PID: ${child.pid}`));
  console.log(pc.dim(`   Log: ${path.basename(logFile)}`));
}

/**
 * Show running services status dashboard
 */
async function showRunningStatus(
  projectPath: string,
  isLocal: boolean,
): Promise<void> {
  const width = 56;
  const line = "═".repeat(width);
  const thinLine = "─".repeat(width);

  console.log(pc.cyan("╔" + line + "╗"));
  console.log(
    pc.cyan("║") +
      pc.bold("   Cortex Development Environment").padEnd(width) +
      pc.cyan("║"),
  );
  console.log(pc.cyan("╚" + line + "╝"));
  console.log();

  // Convex Status
  console.log(pc.bold(pc.white("  Convex Backend")));
  console.log(pc.dim("  " + thinLine));

  const pidFile = path.join(projectPath, ".convex-dev.pid");
  let convexRunning = false;
  let convexPid: string | null = null;

  try {
    convexPid = await fs.readFile(pidFile, "utf-8");
    // Check if process is running
    try {
      process.kill(parseInt(convexPid), 0);
      convexRunning = true;
    } catch {
      convexRunning = false;
    }
  } catch {
    convexRunning = false;
  }

  if (convexRunning) {
    console.log(`   ${pc.green("●")} Running (PID: ${convexPid})`);
    if (isLocal) {
      console.log(pc.dim("     Dashboard: http://127.0.0.1:3210"));
    } else {
      console.log(pc.dim(`     URL: ${process.env.CONVEX_URL || "configured"}`));
    }
  } else {
    console.log(`   ${pc.yellow("○")} Not running`);
    console.log(pc.dim("     Run: cortex start"));
  }
  console.log();

  // Graph Database Status
  console.log(pc.bold(pc.white("  Graph Database")));
  console.log(pc.dim("  " + thinLine));

  const hasGraphConfig =
    process.env.NEO4J_URI || fs.existsSync(path.join(projectPath, "docker-compose.graph.yml"));

  if (hasGraphConfig) {
    // Check if Docker container is running
    try {
      const result = await execCommand(
        "docker",
        ["ps", "--filter", "name=cortex-neo4j", "--format", "{{.Status}}"],
        { quiet: true },
      );
      if (result.stdout.includes("Up")) {
        console.log(`   ${pc.green("●")} Neo4j running`);
        console.log(pc.dim("     Browser: http://localhost:7474"));
        console.log(pc.dim("     Bolt: bolt://localhost:7687"));
      } else {
        console.log(`   ${pc.yellow("○")} Neo4j configured but not running`);
        console.log(pc.dim("     Start: docker-compose -f docker-compose.graph.yml up -d"));
      }
    } catch {
      console.log(`   ${pc.yellow("○")} Neo4j configured but Docker not available`);
      console.log(pc.dim("     Start Docker Desktop first"));
    }
  } else {
    console.log(`   ${pc.dim("○")} Not configured`);
  }
  console.log();

  // Quick Actions
  console.log(pc.bold(pc.white("  Quick Actions")));
  console.log(pc.dim("  " + thinLine));
  console.log(pc.dim("   cortex status") + pc.dim("           # Full status dashboard"));
  console.log(pc.dim("   cortex start -f") + pc.dim("         # Foreground mode (see logs)"));
  console.log(pc.dim("   cortex stop") + pc.dim("             # Stop background services"));
  console.log(pc.dim("   npm start") + pc.dim("               # Run your AI agent"));
  console.log();

  // Log file hint
  const logFile = path.join(projectPath, ".convex-dev.log");
  if (fs.existsSync(logFile)) {
    console.log(pc.dim(`  View logs: tail -f ${path.basename(logFile)}`));
  }
  console.log();
}
