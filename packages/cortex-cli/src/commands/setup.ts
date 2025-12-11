/**
 * Setup and Configuration Commands
 *
 * Commands for setting up and configuring the CLI:
 * - setup: Interactive setup wizard
 * - config: Configuration management
 */

import { Command } from "commander";
import prompts from "prompts";
import ora from "ora";
import pc from "picocolors";
import type { CLIConfig, OutputFormat, DeploymentConfig } from "../types.js";
import {
  loadConfig,
  saveUserConfig,
  getUserConfigPath,
  getProjectConfigPath,
  listDeployments,
  setConfigValue,
  updateDeployment,
} from "../utils/config.js";
import { testConnection } from "../utils/client.js";
import {
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printSection,
  formatOutput,
} from "../utils/formatting.js";
import { validateUrl } from "../utils/validation.js";
import {
  addDeploymentToEnv,
  removeDeploymentFromEnv,
  getDeploymentEnvKeys,
} from "../utils/env-file.js";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Register setup and config commands
 */
export function registerSetupCommands(
  program: Command,
  _config: CLIConfig,
): void {
  // setup command
  program
    .command("setup")
    .description("Interactive setup wizard")
    .option("--auto", "Auto-configure from environment variables", false)
    .option("--local", "Set up local Convex development", false)
    .option("--cloud", "Set up cloud Convex deployment", false)
    .action(async (options) => {
      try {
        if (options.auto) {
          // Auto mode: configure from environment variables
          const config = await loadConfig();
          await autoSetup(config);
          return;
        }

        // Interactive setup
        await runInteractiveSetup({
          initialMode: options.local ? "local" : options.cloud ? "cloud" : undefined,
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Setup failed");
        process.exit(1);
      }
    });

  // config command group
  const configCmd = program
    .command("config")
    .description("Manage CLI configuration")
    .enablePositionalOptions()
    .passThroughOptions();

  // config show
  configCmd
    .command("show")
    .description("Show current configuration")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (options) => {
      try {
        const config = await loadConfig();
        await showConfiguration(config, options.format);
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Failed to load config",
        );
        process.exit(1);
      }
    });

  // config set
  configCmd
    .command("set <key> <value>")
    .description("Set a configuration value")
    .action(async (key, value) => {
      try {
        await setConfigValue(key, value);
        printSuccess(`Set ${key} = ${value}`);
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Failed to set config",
        );
        process.exit(1);
      }
    });

  // config test
  configCmd
    .command("test")
    .description("Test connection to Convex deployment")
    .option("-d, --deployment <name>", "Deployment to test")
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const deploymentName = options.deployment ?? config.default;
        await testAndShowConnection(config, deploymentName);
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Connection test failed",
        );
        process.exit(1);
      }
    });

  // config deployments
  configCmd
    .command("deployments")
    .description("List configured deployments")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (options) => {
      try {
        const config = await loadConfig();
        const deployments = listDeployments(config);

        if (deployments.length === 0) {
          printWarning(
            "No deployments configured. Run 'cortex setup' to configure.",
          );
          return;
        }

        if (options.format === "json") {
          console.log(formatOutput(deployments, "json"));
        } else {
          console.log();
          printSection("Configured Deployments", {});
          for (const d of deployments) {
            const indicator = d.isDefault ? pc.green("→") : " ";
            const keyStatus = d.hasKey ? pc.green("✓ key") : pc.dim("no key");
            console.log(
              `${indicator} ${pc.cyan(d.name.padEnd(15))} ${d.url.padEnd(40)} ${keyStatus}`,
            );
          }
          console.log();
        }
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Failed to list deployments",
        );
        process.exit(1);
      }
    });

  // config add-deployment
  configCmd
    .command("add-deployment [name]")
    .description(
      "Add a new deployment configuration\n\nExample: cortex config add-deployment cloud -u https://my-app.convex.cloud",
    )
    .option("-u, --url <url>", "Convex deployment URL")
    .option("-k, --key <key>", "Convex deploy key")
    .option("--default", "Set as default deployment", false)
    .option("--json-only", "Only save to ~/.cortexrc (skip .env.local)", false)
    .action(async (nameArg, options) => {
      try {
        // Prompt for missing values interactively
        let name = nameArg;
        let url = options.url;
        let key = options.key;

        if (!name) {
          const response = await prompts({
            type: "select",
            name: "name",
            message: "Deployment name:",
            choices: [
              {
                title: "local",
                description: "Local development",
                value: "local",
              },
              {
                title: "cloud",
                description: "Cloud/production",
                value: "cloud",
              },
              {
                title: "staging",
                description: "Staging environment",
                value: "staging",
              },
              {
                title: "custom",
                description: "Enter custom name",
                value: "__custom__",
              },
            ],
          });
          if (!response.name) {
            printWarning("Cancelled");
            return;
          }
          if (response.name === "__custom__") {
            const customResponse = await prompts({
              type: "text",
              name: "name",
              message: "Custom deployment name:",
              validate: (v) => v.length > 0 || "Name is required",
            });
            if (!customResponse.name) {
              printWarning("Cancelled");
              return;
            }
            name = customResponse.name;
          } else {
            name = response.name;
          }
        }

        if (!url) {
          const isLocal = name.toLowerCase() === "local";
          const response = await prompts({
            type: "text",
            name: "url",
            message: "Convex deployment URL:",
            initial: isLocal
              ? "http://127.0.0.1:3210"
              : "https://your-app.convex.cloud",
            validate: (v) => {
              try {
                new URL(v);
                return true;
              } catch {
                return "Please enter a valid URL";
              }
            },
          });
          if (!response.url) {
            printWarning("Cancelled");
            return;
          }
          url = response.url;
        }

        validateUrl(url);

        // Only prompt for key if not local and not already provided
        const isLocal = name.toLowerCase() === "local";
        if (!key && !isLocal) {
          const response = await prompts({
            type: "password",
            name: "key",
            message: "Convex deploy key (optional, press Enter to skip):",
          });
          key = response.key || undefined;
        }

        const deployment: DeploymentConfig = {
          url,
          key,
        };

        // Save to user config (~/.cortexrc)
        const config = await updateDeployment(name, deployment);

        if (options.default) {
          config.default = name;
          await saveUserConfig(config);
        }

        // Also save to .env.local (unless --json-only)
        if (!options.jsonOnly) {
          await addDeploymentToEnv(name, url, key);
          const envKeys = getDeploymentEnvKeys(name);
          printSuccess(`Added deployment "${name}"`);
          printInfo(`Updated .env.local: ${envKeys.urlKey}=${url}`);
          if (key) {
            printInfo(`Updated .env.local: ${envKeys.keyKey}=***`);
          }
        } else {
          printSuccess(`Added deployment "${name}" to ~/.cortexrc`);
        }

        if (options.default) {
          printInfo(`Set as default deployment`);
        }
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Failed to add deployment",
        );
        process.exit(1);
      }
    });

  // config remove-deployment
  configCmd
    .command("remove-deployment [name]")
    .description("Remove a deployment configuration")
    .option(
      "--json-only",
      "Only remove from ~/.cortexrc (skip .env.local)",
      false,
    )
    .action(async (nameArg, options) => {
      try {
        const config = await loadConfig();
        let name = nameArg;

        // If no name provided, show interactive selection
        if (!name) {
          const deploymentNames = Object.keys(config.deployments).filter(
            (n) => n !== config.default,
          );

          if (deploymentNames.length === 0) {
            printWarning(
              "No removable deployments found (cannot remove default)",
            );
            return;
          }

          const response = await prompts({
            type: "select",
            name: "name",
            message: "Select deployment to remove:",
            choices: deploymentNames.map((n) => ({
              title: n,
              description: config.deployments[n].url,
              value: n,
            })),
          });

          if (!response.name) {
            printWarning("Cancelled");
            return;
          }
          name = response.name;
        }

        if (!config.deployments[name]) {
          printError(`Deployment "${name}" not found`);
          process.exit(1);
        }

        if (config.default === name) {
          printError(
            `Cannot remove default deployment. Set a different default first.`,
          );
          process.exit(1);
        }

        // Confirm removal
        const confirm = await prompts({
          type: "confirm",
          name: "value",
          message: `Remove deployment "${name}" (${config.deployments[name].url})?`,
          initial: false,
        });

        if (!confirm.value) {
          printWarning("Cancelled");
          return;
        }

        // Remove from user config (~/.cortexrc)
        delete config.deployments[name];
        await saveUserConfig(config);

        // Also remove from .env.local (unless --json-only)
        if (!options.jsonOnly) {
          const envKeys = getDeploymentEnvKeys(name);
          await removeDeploymentFromEnv(name);
          printSuccess(`Removed deployment "${name}"`);
          printInfo(
            `Removed from .env.local: ${envKeys.urlKey}, ${envKeys.keyKey}`,
          );
        } else {
          printSuccess(`Removed deployment "${name}" from ~/.cortexrc`);
        }
      } catch (error) {
        printError(
          error instanceof Error
            ? error.message
            : "Failed to remove deployment",
        );
        process.exit(1);
      }
    });

  // config path
  configCmd
    .command("path")
    .description("Show configuration file paths")
    .action(async () => {
      const userPath = getUserConfigPath();
      const projectJsonPath = getProjectConfigPath();
      const projectEnvPath = join(process.cwd(), ".env.local");

      console.log();
      printSection("Configuration Paths", {
        "User config (~/.cortexrc)": userPath,
        "User config exists": existsSync(userPath) ? "Yes" : "No",
        "Project JSON config": projectJsonPath,
        "Project JSON exists": existsSync(projectJsonPath) ? "Yes" : "No",
        "Project env config": projectEnvPath,
        "Project env exists": existsSync(projectEnvPath) ? "Yes" : "No",
      });

      // Show which env vars are currently set
      const envVars = {
        LOCAL_CONVEX_URL: process.env.LOCAL_CONVEX_URL,
        LOCAL_CONVEX_DEPLOYMENT: process.env.LOCAL_CONVEX_DEPLOYMENT,
        CLOUD_CONVEX_URL: process.env.CLOUD_CONVEX_URL,
        CLOUD_CONVEX_DEPLOY_KEY: process.env.CLOUD_CONVEX_DEPLOY_KEY
          ? "***"
          : undefined,
        CONVEX_URL: process.env.CONVEX_URL,
        CONVEX_DEPLOY_KEY: process.env.CONVEX_DEPLOY_KEY ? "***" : undefined,
      };

      const setVars = Object.entries(envVars).filter(([, v]) => v);
      if (setVars.length > 0) {
        printSection("Environment Variables", Object.fromEntries(setVars));
      }
    });

  // config reset
  configCmd
    .command("reset")
    .description("Reset configuration to defaults")
    .option("-y, --yes", "Skip confirmation", false)
    .action(async (options) => {
      try {
        if (!options.yes) {
          const confirm = await prompts({
            type: "confirm",
            name: "value",
            message: "Reset configuration to defaults? This cannot be undone.",
            initial: false,
          });
          if (!confirm.value) {
            printWarning("Reset cancelled");
            return;
          }
        }

        const defaultConfig: CLIConfig = {
          deployments: {
            local: {
              url: "http://127.0.0.1:3210",
              deployment: "anonymous:anonymous-cortex-sdk-local",
            },
          },
          default: "local",
          format: "table",
          confirmDangerous: true,
        };

        await saveUserConfig(defaultConfig);
        printSuccess("Configuration reset to defaults");
      } catch (error) {
        printError(error instanceof Error ? error.message : "Reset failed");
        process.exit(1);
      }
    });
}

/**
 * Run interactive setup wizard
 * Can be called from the setup command or from dev mode menu
 */
export async function runInteractiveSetup(options: {
  initialMode?: "local" | "cloud";
} = {}): Promise<void> {
  console.log();
  console.log(pc.bold(pc.cyan("🧠 Cortex CLI Setup")));
  console.log(pc.dim("Configure your Cortex Memory deployment\n"));

  let config = await loadConfig();

  const setupMode = await prompts({
    type: "select",
    name: "mode",
    message: "What would you like to set up?",
    choices: [
      {
        title: "Local development",
        description: "Configure local Convex instance",
        value: "local",
      },
      {
        title: "Cloud deployment",
        description: "Configure Convex cloud deployment",
        value: "cloud",
      },
      {
        title: "Both",
        description: "Configure local and cloud deployments",
        value: "both",
      },
      {
        title: "View current configuration",
        description: "Show existing configuration",
        value: "view",
      },
    ],
    initial: options.initialMode === "local" ? 0 : options.initialMode === "cloud" ? 1 : 2,
  });

  if (!setupMode.mode) {
    printWarning("Setup cancelled");
    return;
  }

  if (setupMode.mode === "view") {
    await showConfiguration(config);
    return;
  }

  // Set up local deployment
  if (setupMode.mode === "local" || setupMode.mode === "both") {
    config = await setupLocalDeployment(config);
  }

  // Set up cloud deployment
  if (setupMode.mode === "cloud" || setupMode.mode === "both") {
    config = await setupCloudDeployment(config);
  }

  // Set default deployment
  if (setupMode.mode === "both") {
    const defaultChoice = await prompts({
      type: "select",
      name: "default",
      message: "Which deployment should be the default?",
      choices: [
        { title: "Local", value: "local" },
        { title: "Cloud", value: "cloud" },
      ],
    });
    if (defaultChoice.default) {
      config.default = defaultChoice.default;
    }
  } else {
    config.default = setupMode.mode;
  }

  // Set output format
  const formatChoice = await prompts({
    type: "select",
    name: "format",
    message: "Preferred output format?",
    choices: [
      { title: "Table (human-readable)", value: "table" },
      { title: "JSON (machine-readable)", value: "json" },
    ],
    initial: 0,
  });
  if (formatChoice.format) {
    config.format = formatChoice.format as OutputFormat;
  }

  // Confirm dangerous operations
  const confirmChoice = await prompts({
    type: "confirm",
    name: "confirm",
    message: "Require confirmation for dangerous operations (delete, clear)?",
    initial: true,
  });
  config.confirmDangerous = confirmChoice.confirm ?? true;

  // Save configuration
  await saveUserConfig(config);
  console.log();
  printSuccess(`Configuration saved to ${getUserConfigPath()}`);

  // Test connection
  const testChoice = await prompts({
    type: "confirm",
    name: "test",
    message: "Would you like to test the connection?",
    initial: true,
  });

  if (testChoice.test) {
    await testAndShowConnection(config, config.default);
  }

  console.log();
  printSuccess("Setup complete! 🎉");
  printInfo("Run 'cortex --help' to see available commands");
}

/**
 * Auto-configure from environment variables
 */
async function autoSetup(config: CLIConfig): Promise<void> {
  const spinner = ora("Auto-configuring from environment...").start();

  let hasChanges = false;

  // Check for local config
  const localUrl = process.env.LOCAL_CONVEX_URL;
  const localDeployment = process.env.LOCAL_CONVEX_DEPLOYMENT;
  if (localUrl) {
    config.deployments.local = {
      url: localUrl,
      deployment: localDeployment,
    };
    hasChanges = true;
  }

  // Check for cloud config
  const cloudUrl = process.env.CLOUD_CONVEX_URL ?? process.env.CONVEX_URL;
  const cloudKey =
    process.env.CLOUD_CONVEX_DEPLOY_KEY ?? process.env.CONVEX_DEPLOY_KEY;
  if (
    cloudUrl &&
    !cloudUrl.includes("localhost") &&
    !cloudUrl.includes("127.0.0.1")
  ) {
    config.deployments.cloud = {
      url: cloudUrl,
      key: cloudKey,
    };
    hasChanges = true;
  }

  spinner.stop();

  if (!hasChanges) {
    printWarning("No environment variables found to configure");
    printInfo("Set LOCAL_CONVEX_URL or CONVEX_URL environment variables");
    return;
  }

  await saveUserConfig(config);
  printSuccess("Auto-configured from environment variables");
  await showConfiguration(config);
}

/**
 * Set up local deployment
 */
async function setupLocalDeployment(config: CLIConfig): Promise<CLIConfig> {
  console.log();
  console.log(pc.bold("Local Development Setup"));
  console.log(pc.dim("Configure connection to local Convex instance\n"));

  const urlPrompt = await prompts({
    type: "text",
    name: "url",
    message: "Local Convex URL:",
    initial: config.deployments.local?.url ?? "http://127.0.0.1:3210",
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return "Please enter a valid URL";
      }
    },
  });

  const deploymentPrompt = await prompts({
    type: "text",
    name: "deployment",
    message: "Local deployment name (optional):",
    initial:
      config.deployments.local?.deployment ??
      "anonymous:anonymous-cortex-sdk-local",
  });

  config.deployments.local = {
    url: urlPrompt.url,
    deployment: deploymentPrompt.deployment || undefined,
  };

  return config;
}

/**
 * Set up cloud deployment
 */
async function setupCloudDeployment(config: CLIConfig): Promise<CLIConfig> {
  console.log();
  console.log(pc.bold("Cloud Deployment Setup"));
  console.log(pc.dim("Configure connection to Convex cloud\n"));

  const urlPrompt = await prompts({
    type: "text",
    name: "url",
    message: "Convex cloud URL:",
    initial:
      config.deployments.cloud?.url ?? "https://your-deployment.convex.cloud",
    validate: (value) => {
      try {
        const url = new URL(value);
        if (!url.hostname.includes("convex")) {
          return "URL should be a Convex cloud URL";
        }
        return true;
      } catch {
        return "Please enter a valid URL";
      }
    },
  });

  const keyPrompt = await prompts({
    type: "password",
    name: "key",
    message: "Convex deploy key (optional):",
    initial: config.deployments.cloud?.key ?? "",
  });

  config.deployments.cloud = {
    url: urlPrompt.url,
    key: keyPrompt.key || undefined,
  };

  return config;
}

/**
 * Show current configuration
 */
async function showConfiguration(
  config: CLIConfig,
  format?: string,
): Promise<void> {
  if (format === "json") {
    // Don't show keys in JSON output
    const safeConfig = {
      ...config,
      deployments: Object.fromEntries(
        Object.entries(config.deployments).map(([name, d]) => [
          name,
          { ...d, key: d.key ? "***" : undefined },
        ]),
      ),
    };
    console.log(formatOutput(safeConfig, "json"));
    return;
  }

  console.log();
  printSection("Current Configuration", {
    "Config file": getUserConfigPath(),
    "Default deployment": config.default,
    "Output format": config.format,
    "Confirm dangerous ops": config.confirmDangerous ? "Yes" : "No",
  });

  console.log("  Deployments:");
  for (const [name, deployment] of Object.entries(config.deployments)) {
    const isDefault = name === config.default;
    const prefix = isDefault ? pc.green("→") : " ";
    const keyStatus = deployment.key ? pc.green("(key set)") : "";
    console.log(`  ${prefix} ${pc.cyan(name)}: ${deployment.url} ${keyStatus}`);
  }
  console.log();
}

/**
 * Test connection and show results
 */
async function testAndShowConnection(
  config: CLIConfig,
  deploymentName: string,
): Promise<void> {
  const spinner = ora(`Testing connection to ${deploymentName}...`).start();

  const result = await testConnection(config, { deployment: deploymentName });

  spinner.stop();

  if (result.connected) {
    printSuccess(`Connected to ${result.url}`);
    console.log(`  Latency: ${result.latency}ms`);
  } else {
    printError(`Connection failed: ${result.error}`);
    printInfo("Check your URL and ensure Convex is running");
  }
}
