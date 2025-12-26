/**
 * Configuration Commands
 *
 * Commands for managing CLI configuration:
 * - config: Configuration management
 */

import { Command } from "commander";
import prompts from "prompts";
import ora from "ora";
import pc from "picocolors";
import type { CLIConfig, DeploymentConfig } from "../types.js";
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
import {
  getCurrentDeployment,
  setCurrentDeployment,
  clearCurrentDeployment,
} from "../utils/deployment-selector.js";
import { existsSync } from "fs";
import { join, resolve } from "path";

/**
 * Register config commands
 */
export function registerConfigCommands(
  program: Command,
  _config: CLIConfig,
): void {
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

  // config list - Table view of deployments
  configCmd
    .command("list")
    .description("List all deployments in table format")
    .action(async () => {
      try {
        const config = await loadConfig();
        const deployments = Object.entries(config.deployments);

        if (deployments.length === 0) {
          console.log(pc.yellow("\n  No deployments configured\n"));
          printInfo("To get started:");
          console.log(pc.dim("   • Run 'cortex init' to create a new project"));
          console.log(
            pc.dim(
              "   • Run 'cortex config add-deployment' to add an existing deployment",
            ),
          );
          return;
        }

        console.log();

        // Table dimensions
        const nameWidth = 20;
        const statusWidth = 10;
        const urlWidth = 40;
        const keyWidth = 6;
        const pathWidth = 35;

        // Deployments section header
        console.log(pc.bold("  Deployments"));
        console.log(
          pc.dim(
            "  " +
              "─".repeat(
                nameWidth + statusWidth + urlWidth + keyWidth + pathWidth,
              ),
          ),
        );
        console.log(
          pc.dim(
            "  " +
              "NAME".padEnd(nameWidth) +
              "STATUS".padEnd(statusWidth) +
              "URL".padEnd(urlWidth) +
              "KEY".padEnd(keyWidth) +
              "PROJECT PATH",
          ),
        );

        for (const [name, deployment] of deployments) {
          const isDefault = name === config.default;
          // Default deployment is implicitly enabled; others check enabled field
          const isEnabled =
            deployment.enabled === true ||
            (deployment.enabled === undefined && isDefault);
          const prefix = isDefault ? pc.green("→ ") : "  ";
          // Pad BEFORE applying color to avoid ANSI escape code length issues
          const namePadded = name.padEnd(nameWidth - 2);
          const nameDisplay = isDefault ? pc.cyan(namePadded) : namePadded;
          const statusText = isEnabled ? "enabled" : "disabled";
          const statusPadded = statusText.padEnd(statusWidth);
          const statusDisplay = isEnabled
            ? pc.green(statusPadded)
            : pc.dim(statusPadded);
          const keyText = deployment.key ? "yes" : "no";
          const keyPadded = keyText.padEnd(keyWidth);
          const keyStatus = deployment.key
            ? pc.green(keyPadded)
            : pc.dim(keyPadded);
          const urlDisplay = (
            deployment.url.length > urlWidth - 2
              ? deployment.url.substring(0, urlWidth - 5) + "..."
              : deployment.url
          ).padEnd(urlWidth);
          const pathDisplay = deployment.projectPath
            ? deployment.projectPath.length > pathWidth - 2
              ? "..." + deployment.projectPath.slice(-(pathWidth - 5))
              : deployment.projectPath
            : pc.dim("--");

          console.log(
            prefix +
              nameDisplay +
              statusDisplay +
              urlDisplay +
              keyStatus +
              pathDisplay,
          );
        }

        console.log();
        if (config.default) {
          console.log(
            pc.dim(
              `  Default: ${config.default} (→) • Enabled deployments started with 'cortex start'`,
            ),
          );
        }

        // Apps section
        const apps = Object.entries(config.apps || {});
        if (apps.length > 0) {
          console.log();
          console.log(pc.bold("  Apps"));
          console.log(pc.dim("  " + "─".repeat(nameWidth + statusWidth + urlWidth)));

          for (const [name, app] of apps) {
            const statusText = app.enabled ? "enabled" : "disabled";
            const statusPadded = statusText.padEnd(statusWidth);
            const statusDisplay = app.enabled
              ? pc.green(statusPadded)
              : pc.dim(statusPadded);
            const portInfo = app.port ? `port:${app.port}` : "";
            const typeDisplay = `${app.type} ${portInfo}`.padEnd(urlWidth);

            console.log(
              "  " +
                name.padEnd(nameWidth) +
                statusDisplay +
                pc.dim(typeDisplay),
            );
          }

          console.log();
          console.log(
            pc.dim("  Enabled apps started with 'cortex start'"),
          );
        }

        console.log();
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

  // config set-path - Set project path for a deployment
  configCmd
    .command("set-path <deployment> [path]")
    .description(
      "Set project path for a deployment (enables 'cortex start -d <name>' from anywhere)",
    )
    .action(async (deploymentName, pathArg) => {
      try {
        const config = await loadConfig();

        if (!config.deployments[deploymentName]) {
          printError(`Deployment "${deploymentName}" not found`);
          const names = Object.keys(config.deployments);
          if (names.length > 0) {
            printInfo(`Available deployments: ${names.join(", ")}`);
          }
          process.exit(1);
        }

        // If no path provided, use current directory
        const projectPath = pathArg ? resolve(pathArg) : process.cwd();

        // Verify path exists
        if (!existsSync(projectPath)) {
          printError(`Path does not exist: ${projectPath}`);
          process.exit(1);
        }

        // Update deployment with projectPath
        config.deployments[deploymentName] = {
          ...config.deployments[deploymentName],
          projectPath,
        };

        await saveUserConfig(config);
        printSuccess(`Set project path for "${deploymentName}"`);
        console.log(pc.dim(`   Path: ${projectPath}`));
        console.log();
        printInfo(`You can now run: cortex start -d ${deploymentName}`);
        console.log(pc.dim("   This will work from any directory"));
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Failed to set project path",
        );
        process.exit(1);
      }
    });

  // config enable - Enable a deployment or app for `cortex start`
  configCmd
    .command("enable <name>")
    .description("Enable a deployment or app (will be started with 'cortex start')")
    .action(async (name) => {
      try {
        const config = await loadConfig();

        // Check if it's a deployment
        if (config.deployments[name]) {
          config.deployments[name] = {
            ...config.deployments[name],
            enabled: true,
          };
          await saveUserConfig(config);
          printSuccess(`Enabled deployment "${name}"`);
          console.log(pc.dim("   Will be started with 'cortex start'"));
          return;
        }

        // Check if it's an app
        if (config.apps?.[name]) {
          config.apps[name] = {
            ...config.apps[name],
            enabled: true,
          };
          await saveUserConfig(config);
          printSuccess(`Enabled app "${name}"`);
          console.log(pc.dim("   Will be started with 'cortex start'"));
          return;
        }

        // Not found
        printError(`"${name}" not found`);
        const deploymentNames = Object.keys(config.deployments);
        const appNames = Object.keys(config.apps || {});
        if (deploymentNames.length > 0) {
          printInfo(`Available deployments: ${deploymentNames.join(", ")}`);
        }
        if (appNames.length > 0) {
          printInfo(`Available apps: ${appNames.join(", ")}`);
        }
        process.exit(1);
      } catch (error) {
        printError(
          error instanceof Error
            ? error.message
            : "Failed to enable",
        );
        process.exit(1);
      }
    });

  // config disable - Disable a deployment or app
  configCmd
    .command("disable <name>")
    .description(
      "Disable a deployment or app (will not be started with 'cortex start')",
    )
    .action(async (name) => {
      try {
        const config = await loadConfig();

        // Check if it's a deployment
        if (config.deployments[name]) {
          config.deployments[name] = {
            ...config.deployments[name],
            enabled: false,
          };
          await saveUserConfig(config);
          printSuccess(`Disabled deployment "${name}"`);
          console.log(pc.dim("   Will NOT be started with 'cortex start'"));
          return;
        }

        // Check if it's an app
        if (config.apps?.[name]) {
          config.apps[name] = {
            ...config.apps[name],
            enabled: false,
          };
          await saveUserConfig(config);
          printSuccess(`Disabled app "${name}"`);
          console.log(pc.dim("   Will NOT be started with 'cortex start'"));
          return;
        }

        // Not found
        printError(`"${name}" not found`);
        const deploymentNames = Object.keys(config.deployments);
        const appNames = Object.keys(config.apps || {});
        if (deploymentNames.length > 0) {
          printInfo(`Available deployments: ${deploymentNames.join(", ")}`);
        }
        if (appNames.length > 0) {
          printInfo(`Available apps: ${appNames.join(", ")}`);
        }
        process.exit(1);
      } catch (error) {
        printError(
          error instanceof Error
            ? error.message
            : "Failed to disable",
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

  // config set-key
  configCmd
    .command("set-key [deployment]")
    .description("Set or update the deploy key for a deployment")
    .option("-k, --key <key>", "Deploy key (will prompt if not provided)")
    .option("--json-only", "Only update ~/.cortexrc (skip .env.local)", false)
    .action(async (deploymentArg, options) => {
      try {
        const config = await loadConfig();
        let name = deploymentArg;

        // If no name provided, show interactive selection
        if (!name) {
          const deploymentNames = Object.keys(config.deployments);

          if (deploymentNames.length === 0) {
            printWarning("No deployments configured");
            console.log(
              pc.dim("   Run 'cortex config add-deployment' to add one\n"),
            );
            return;
          }

          const response = await prompts({
            type: "select",
            name: "name",
            message: "Select deployment to set key for:",
            choices: deploymentNames.map((n) => {
              const dep = config.deployments[n];
              const keyStatus = dep.key
                ? pc.green("(key set)")
                : pc.dim("(no key)");
              return {
                title: `${n} ${keyStatus}`,
                description: dep.url,
                value: n,
              };
            }),
          });

          if (!response.name) {
            printWarning("Cancelled");
            return;
          }
          name = response.name;
        }

        if (!config.deployments[name]) {
          printError(`Deployment "${name}" not found`);
          console.log(
            pc.dim(
              "   Run 'cortex config list' to see available deployments\n",
            ),
          );
          process.exit(1);
        }

        // Get key from option or prompt
        let key = options.key;
        if (!key) {
          const response = await prompts({
            type: "password",
            name: "key",
            message: `Enter deploy key for "${name}":`,
            validate: (v) => v.length > 0 || "Key cannot be empty",
          });

          if (!response.key) {
            printWarning("Cancelled");
            return;
          }
          key = response.key;
        }

        // Update the deployment with the new key
        const deployment = config.deployments[name];
        deployment.key = key;
        await updateDeployment(name, deployment);

        // Also update .env.local (unless --json-only)
        if (!options.jsonOnly) {
          await addDeploymentToEnv(name, deployment.url, key);
          const envKeys = getDeploymentEnvKeys(name);
          printSuccess(`Set deploy key for "${name}"`);
          printInfo(`Updated .env.local: ${envKeys.keyKey}=***`);
        } else {
          printSuccess(`Set deploy key for "${name}" in ~/.cortexrc`);
        }
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Failed to set key",
        );
        process.exit(1);
      }
    });

  // config set-url
  configCmd
    .command("set-url [deployment]")
    .description("Set or update the URL for a deployment")
    .option("-u, --url <url>", "Deployment URL (will prompt if not provided)")
    .option("--json-only", "Only update ~/.cortexrc (skip .env.local)", false)
    .action(async (deploymentArg, options) => {
      try {
        const config = await loadConfig();
        let name = deploymentArg;

        // If no name provided, show interactive selection
        if (!name) {
          const deploymentNames = Object.keys(config.deployments);

          if (deploymentNames.length === 0) {
            printWarning("No deployments configured");
            console.log(
              pc.dim("   Run 'cortex config add-deployment' to add one\n"),
            );
            return;
          }

          const response = await prompts({
            type: "select",
            name: "name",
            message: "Select deployment to set URL for:",
            choices: deploymentNames.map((n) => {
              const dep = config.deployments[n];
              return {
                title: n,
                description: dep.url,
                value: n,
              };
            }),
          });

          if (!response.name) {
            printWarning("Cancelled");
            return;
          }
          name = response.name;
        }

        if (!config.deployments[name]) {
          printError(`Deployment "${name}" not found`);
          console.log(
            pc.dim(
              "   Run 'cortex config list' to see available deployments\n",
            ),
          );
          process.exit(1);
        }

        // Get URL from option or prompt
        let url = options.url;
        if (!url) {
          const currentUrl = config.deployments[name].url;
          const response = await prompts({
            type: "text",
            name: "url",
            message: `Enter URL for "${name}":`,
            initial: currentUrl,
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

        // Validate URL
        validateUrl(url);

        // Update the deployment with the new URL
        const deployment = config.deployments[name];
        const oldUrl = deployment.url;
        deployment.url = url;
        await updateDeployment(name, deployment);

        // Also update .env.local (unless --json-only)
        if (!options.jsonOnly) {
          await addDeploymentToEnv(name, url, deployment.key);
          const envKeys = getDeploymentEnvKeys(name);
          printSuccess(`Updated URL for "${name}"`);
          printInfo(`${oldUrl} → ${url}`);
          printInfo(`Updated .env.local: ${envKeys.urlKey}=${url}`);
        } else {
          printSuccess(`Updated URL for "${name}" in ~/.cortexrc`);
          printInfo(`${oldUrl} → ${url}`);
        }
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Failed to set URL",
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
          deployments: {},
          default: "",
          format: "table",
          confirmDangerous: true,
        };

        await saveUserConfig(defaultConfig);
        printSuccess("Configuration reset to defaults");
        console.log();
        printInfo("No deployments configured. To get started:");
        console.log(pc.dim("   • Run 'cortex init' to create a new project"));
        console.log(
          pc.dim(
            "   • Run 'cortex config add-deployment' to add an existing deployment",
          ),
        );
      } catch (error) {
        printError(error instanceof Error ? error.message : "Reset failed");
        process.exit(1);
      }
    });

  // Top-level 'use' command for quick deployment switching
  program
    .command("use [deployment]")
    .description("Set current deployment for all commands (session context)")
    .option("--clear", "Clear the current deployment setting")
    .action(async (deploymentName, options) => {
      try {
        const config = await loadConfig();
        const deployments = Object.keys(config.deployments);

        // Handle --clear flag
        if (options.clear) {
          await clearCurrentDeployment();
          printSuccess("Cleared current deployment");
          console.log(
            pc.dim("   Commands will now prompt for deployment selection\n"),
          );
          return;
        }

        // If no deployment specified, show current and list available
        if (!deploymentName) {
          const current = await getCurrentDeployment();

          console.log();
          if (current && config.deployments[current]) {
            console.log(pc.bold("  Current deployment: ") + pc.cyan(current));
          } else if (current) {
            console.log(
              pc.yellow(`  Current deployment "${current}" no longer exists`),
            );
          } else {
            console.log(pc.dim("  No current deployment set"));
          }

          console.log();
          console.log(pc.bold("  Available deployments:"));
          if (deployments.length === 0) {
            console.log(pc.yellow("    No deployments configured"));
          } else {
            for (const name of deployments) {
              const isCurrent = name === current;
              const isDefault = name === config.default;
              const prefix = isCurrent ? pc.green("→") : " ";
              const suffix = isDefault ? pc.dim(" (default)") : "";
              console.log(`    ${prefix} ${pc.cyan(name)}${suffix}`);
            }
          }
          console.log();
          console.log(pc.dim("  Usage: cortex use <deployment>"));
          console.log(pc.dim("         cortex use --clear"));
          console.log();
          return;
        }

        // Validate deployment exists
        if (!config.deployments[deploymentName]) {
          printError(`Deployment "${deploymentName}" not found`);
          console.log(pc.dim(`   Available: ${deployments.join(", ")}\n`));
          process.exit(1);
        }

        // Set the current deployment
        await setCurrentDeployment(deploymentName);
        printSuccess(`Now using: ${deploymentName}`);
        console.log(
          pc.dim(`   All commands will target this deployment until changed\n`),
        );
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Failed to set deployment",
        );
        process.exit(1);
      }
    });
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
  const deploymentEntries = Object.entries(config.deployments);
  if (deploymentEntries.length === 0) {
    console.log(pc.yellow("    No deployments configured"));
    console.log();
    printInfo("To get started:");
    console.log(pc.dim("   • Run 'cortex init' to create a new project"));
    console.log(
      pc.dim(
        "   • Run 'cortex config add-deployment' to add an existing deployment",
      ),
    );
  } else {
    for (const [name, deployment] of deploymentEntries) {
      const isDefault = name === config.default;
      // Default deployment is implicitly enabled; others check enabled field
      const isEnabled =
        deployment.enabled === true ||
        (deployment.enabled === undefined && isDefault);
      const prefix = isDefault ? pc.green("→") : " ";
      const statusBadge = isEnabled
        ? pc.green("[enabled]")
        : pc.dim("[disabled]");
      const keyStatus = deployment.key ? pc.green("(key set)") : "";
      console.log(
        `  ${prefix} ${pc.cyan(name)}: ${deployment.url} ${statusBadge} ${keyStatus}`,
      );
      if (deployment.projectPath) {
        console.log(pc.dim(`      Project: ${deployment.projectPath}`));
      }
    }
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
