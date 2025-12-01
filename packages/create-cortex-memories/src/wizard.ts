/**
 * Interactive wizard for Cortex project setup
 */

import prompts from "prompts";
import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import ora from "ora";
import type { WizardConfig } from "./types.js";
import {
  isValidProjectName,
  isDirectoryEmpty,
  fetchLatestSDKMetadata,
} from "./utils.js";
import {
  setupNewConvex,
  setupExistingConvex,
  setupLocalConvex,
  deployConvexBackend,
} from "./convex-setup.js";
import {
  getGraphConfig,
  setupGraphFiles,
  addGraphDependencies,
  createGraphExample,
} from "./graph-setup.js";
import {
  copyTemplate,
  deployCortexBackend,
  createConvexJson,
  ensureGitignore,
} from "./file-operations.js";
import { createEnvFile } from "./env-generator.js";
import { execCommand } from "./utils.js";

/**
 * Run the interactive wizard
 */
export async function runWizard(targetDir?: string): Promise<void> {
  console.log(pc.bold(pc.cyan("\n✨ Create Cortex Memories\n")));
  console.log(pc.dim("   Setting up AI agent with persistent memory\n"));

  // Step 1: Project name and location
  const projectInfo = await getProjectInfo(targetDir);

  // Step 2: Installation type
  const installationType = await getInstallationType(projectInfo.projectPath);

  // Step 3: Convex setup
  const convexConfig = await getConvexSetup();

  // Step 4: Graph database (optional) - just get the config, don't create files yet
  const graphConfig = await getGraphConfig();

  // Step 5: Cortex CLI (optional)
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
  await showConfirmation(config);

  // Execute setup
  await executeSetup(config);
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
async function getConvexSetup(): Promise<{
  type: "new" | "existing" | "local";
  config: any;
}> {
  console.log(pc.cyan("\n🗄️  Convex Database Setup"));
  console.log(pc.dim("   Cortex uses Convex as its backend database\n"));

  const response = await prompts({
    type: "select",
    name: "setupType",
    message: "How would you like to set up Convex?",
    choices: [
      {
        title: "Local development (fast, no account needed)",
        description: "Start immediately with local Convex",
        value: "local",
      },
      {
        title: "Create new Convex database (cloud)",
        description: "Full features including vector search",
        value: "new",
      },
      {
        title: "Use existing Convex database",
        description: "Connect to your existing deployment",
        value: "existing",
      },
    ],
    initial: 0, // Default to local
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
  console.log(pc.cyan("\n🔧 Cortex CLI (Optional)"));
  console.log(pc.dim("   Command-line tools for database management\n"));

  const response = await prompts({
    type: "confirm",
    name: "installCLI",
    message: "Install Cortex CLI for database management?",
    initial: true,
  });

  return response.installCLI ?? false;
}

/**
 * Show confirmation screen
 */
async function showConfirmation(config: WizardConfig): Promise<void> {
  console.log(pc.cyan("\n📋 Configuration Summary"));
  console.log(pc.dim("─".repeat(50)));
  console.log(pc.bold("Project:"), config.projectName);
  console.log(pc.bold("Location:"), config.projectPath);
  console.log(
    pc.bold("Type:"),
    config.installationType === "new" ? "New project" : "Add to existing",
  );
  console.log(
    pc.bold("Convex:"),
    {
      new: "New cloud database",
      existing: "Existing database",
      local: "Local development",
    }[config.convexSetupType],
  );
  console.log(
    pc.bold("Graph DB:"),
    config.graphEnabled ? config.graphType : "Disabled",
  );
  console.log(
    pc.bold("CLI:"),
    config.installCLI ? "Install @cortexmemory/cli" : "Skip",
  );
  console.log(pc.dim("─".repeat(50)));

  const response = await prompts({
    type: "confirm",
    name: "confirm",
    message: "Proceed with setup?",
    initial: true,
  });

  if (!response.confirm) {
    console.log(pc.yellow("\nSetup cancelled"));
    process.exit(0);
  }
}

/**
 * Execute the setup
 */
async function executeSetup(config: WizardConfig): Promise<void> {
  console.log(pc.cyan("\n🚀 Setting up Cortex...\n"));

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

    // Setup Convex
    let convexConfig;
    if (config.convexSetupType === "new") {
      convexConfig = await setupNewConvex(config.projectPath);
    } else if (config.convexSetupType === "existing") {
      convexConfig = await setupExistingConvex();
    } else {
      convexConfig = await setupLocalConvex();
    }

    // Update config with actual Convex details
    config.convexUrl = convexConfig.convexUrl;
    config.deployKey = convexConfig.deployKey;

    // Create .env.local
    await createEnvFile(config.projectPath, config);

    // Create .gitignore
    await ensureGitignore(config.projectPath);

    // Install dependencies
    const installSpinner = ora("Installing dependencies...").start();
    const result = await execCommand("npm", ["install"], {
      cwd: config.projectPath,
    });
    if (result.code !== 0) {
      installSpinner.fail("Failed to install dependencies");
      console.error(pc.red(result.stderr));
      console.error(pc.dim("stdout:"), result.stdout);
      throw new Error("npm install failed");
    }
    installSpinner.succeed("Dependencies installed");

    // Debug: Verify SDK was actually installed
    const sdkCheck = fs.existsSync(
      path.join(config.projectPath, "node_modules", "@cortexmemory", "sdk"),
    );
    if (!sdkCheck) {
      console.warn(
        pc.yellow("⚠️  Warning: SDK not found in node_modules after install"),
      );
      console.log(pc.dim("   This may cause backend deployment to fail"));
    }

    // Deploy Cortex backend
    const backendSpinner = ora("Deploying Cortex backend functions...").start();
    await deployCortexBackend(config.projectPath);
    await createConvexJson(config.projectPath);
    backendSpinner.succeed("Cortex backend deployed");

    // Deploy to Convex (all modes now supported)
    await deployConvexBackend(
      config.projectPath,
      convexConfig,
      config.convexSetupType === "local",
    );

    // Setup graph database if enabled
    if (config.graphEnabled && config.graphType !== "skip") {
      const graphSpinner = ora("Configuring graph database...").start();

      // Create graph files (docker-compose, etc.)
      await setupGraphFiles(config.projectPath, {
        type: config.graphType as "neo4j" | "memgraph",
        uri: config.graphUri!,
        username: config.graphUsername!,
        password: config.graphPassword!,
      });

      await addGraphDependencies(config.projectPath);
      await createGraphExample(config.projectPath);
      graphSpinner.succeed("Graph database configured");
    }

    // Install Cortex CLI if requested
    if (config.installCLI) {
      const cliSpinner = ora("Installing Cortex CLI...").start();
      const cliResult = await execCommand(
        "npm",
        ["install", "--save-dev", "@cortexmemory/cli"],
        { cwd: config.projectPath },
      );
      if (cliResult.code !== 0) {
        cliSpinner.warn("CLI installation failed (non-critical)");
        console.log(
          pc.dim(
            "   You can install it later: npm install -D @cortexmemory/cli",
          ),
        );
      } else {
        cliSpinner.succeed("Cortex CLI installed");

        // Add CLI scripts to package.json
        await addCLIScripts(config.projectPath);
      }
    }

    // Success!
    showSuccessMessage(config);
  } catch (error) {
    console.error(pc.red("\n❌ Setup failed:"), error);
    throw error;
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

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  } catch {
    // Non-critical, skip silently
  }
}

/**
 * Show success message
 */
function showSuccessMessage(config: WizardConfig): void {
  console.log(
    pc.bold(pc.green("\n🎉 Cortex Memory successfully initialized!\n")),
  );

  console.log(pc.bold("📁 Project:"), config.projectName);
  console.log(
    pc.bold("🗄️  Database:"),
    config.convexSetupType === "local"
      ? "Local Convex (development)"
      : `Convex Cloud (${config.convexUrl})`,
  );

  if (config.graphEnabled && config.graphType !== "skip") {
    console.log(pc.bold("🕸️  Graph:"), config.graphType, "(configured)");
  }

  if (config.installCLI) {
    console.log(pc.bold("🔧 CLI:"), "@cortexmemory/cli (installed)");
  }

  console.log(pc.green("\n✅ Setup complete!\n"));

  console.log(pc.bold("🚀 Next steps:\n"));

  if (config.installationType === "new") {
    console.log(pc.cyan(`  cd ${config.projectName}`));
  }

  if (config.convexSetupType === "local") {
    console.log(
      pc.cyan("  npm run dev") + pc.dim("   # Start Convex in watch mode"),
    );
    console.log(pc.dim("  (Then in another terminal)"));
    console.log(pc.cyan("  npm start") + pc.dim("      # Run your AI agent"));
    console.log(pc.dim("\n  💡 Dashboard: http://127.0.0.1:3210"));
  } else {
    console.log(pc.cyan("  npm start") + pc.dim("  # Run your AI agent"));
    console.log(
      pc.dim(`\n  💡 Dashboard: ${config.convexUrl?.replace("/api", "")}`),
    );
  }

  // CLI commands if installed
  if (config.installCLI) {
    console.log(pc.bold("\n🔧 CLI Commands:\n"));
    console.log(
      pc.cyan("  npm run cortex:stats") +
        pc.dim("   # View database statistics"),
    );
    console.log(
      pc.cyan("  npm run cortex:spaces") + pc.dim("  # List memory spaces"),
    );
    console.log(
      pc.cyan("  npx cortex --help") + pc.dim("      # See all CLI commands"),
    );
  }

  console.log(pc.bold("\n📚 Learn more:\n"));
  console.log(
    pc.dim(
      "  Documentation: https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation",
    ),
  );
  console.log(
    pc.dim(
      "  Examples:      https://github.com/SaintNick1214/Project-Cortex/tree/main/Examples",
    ),
  );
  console.log(
    pc.dim(
      "  API Reference: https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation/03-api-reference",
    ),
  );

  console.log(pc.bold(pc.cyan("\nHappy building with Cortex! 🧠\n")));
}
