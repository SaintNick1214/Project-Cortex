#!/usr/bin/env node
import { registerBackendCommands } from "./commands/backend.js";
/**
 * Cortex CLI - Command Line Interface for Cortex Memory SDK
 *
 * A powerful tool for managing Cortex deployments, performing administrative tasks,
 * and streamlining development workflows.
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";
import { Command } from "commander";
import pc from "picocolors";

// Core commands
import {
  registerLifecycleCommands,
  registerInitCommand,
} from "./commands/init.js";
import { registerStatusCommands } from "./commands/status.js";
import { registerConfigCommands } from "./commands/setup.js";
import { registerDbCommands } from "./commands/db.js";
import { registerDevCommands } from "./commands/dev.js";
// Memory operations
import { registerMemoryCommands } from "./commands/memory.js";
import { registerUserCommands } from "./commands/users.js";
import { registerSpaceCommands } from "./commands/spaces.js";
import { registerFactsCommands } from "./commands/facts.js";
import { registerConversationsCommands } from "./commands/conversations.js";
// Convex operations
import { registerConvexCommands } from "./commands/convex.js";
// Deploy/update commands (top-level)
import { registerDeployCommands } from "./commands/deploy.js";
// Shell completion
import { registerCompletionCommand } from "./commands/completion.js";
import { loadConfig } from "./utils/config.js";
import { configureClientOptions, setupClientCleanup } from "./utils/client.js";

// Read version dynamically from package.json to ensure CLI version always matches published version
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const VERSION: string = packageJson.version;

// Auto-load .env.local if it exists in current directory
const envLocalPath = join(process.cwd(), ".env.local");
const envLoaded = existsSync(envLocalPath);
if (envLoaded) {
  const result = loadEnv({ path: envLocalPath });
  // Debug: log if env file was loaded (only when --debug flag is used)
  if (process.argv.includes("--debug")) {
    console.log(
      `[DEBUG] Loaded ${Object.keys(result.parsed || {}).length} env vars from ${envLocalPath}`,
    );
  }
}

const program = new Command();

program
  .name("cortex")
  .description(
    "CLI tool for managing Cortex Memory deployments and performing administrative tasks",
  )
  .version(VERSION)
  .enablePositionalOptions()
  .option("-d, --deployment <name>", "Deployment name to use (from config)")
  .option("--token-env <name>", "Environment variable with a fresh host-issued JWT (default CORTEX_AUTH_TOKEN)")
  .option("--token-file <path>", "Private host-issued JWT file, reread on refresh; never copied to config")
  .option("--tenant-id <id>", "Verified tenant selector; does not grant authority")
  .option("--memory-space-id <id>", "Verified memory-space selector; does not grant authority")
  .option("--debug", "Enable debug output", false)
  .configureHelp({
    // Custom sort to ensure our order is preserved
    sortSubcommands: false,
    sortOptions: false,
  });
program.addHelpText("after", "\nAuthenticated data commands require a host-issued JWT and current backend grants. Use --token-file /private/host.jwt or --token-env CORTEX_AUTH_TOKEN before the command; files must be owned/private and are reread on refresh. Scope flags are selectors, never authority. Deploy/provider keys do not authenticate public clients.\nDatabase stats require an exact disposable-development --target and operator credentials. db clear retires only the explicitly confirmed tenant+space, preserving tombstones/billing. Generic purge/restore are unsupported.\n");

// Load config and register commands
async function main() {
  try {
    // Load configuration
    const config = await loadConfig();

    // Register core commands (in display order)
    registerLifecycleCommands(program, config); // start, stop
    registerDeployCommands(program, config); // deploy, update (top-level for easy access)
    registerStatusCommands(program, config); // status
    registerConfigCommands(program, config); // config
    registerInitCommand(program, config); // init
    registerBackendCommands(program); // additive runtime install/provision/configure
    registerDbCommands(program, config); // db
    registerDevCommands(program, config); // dev

    // Register memory operations (hidden from main list, shown in custom section)
    registerMemoryCommands(program, config);
    registerUserCommands(program, config);
    registerSpaceCommands(program, config);
    registerFactsCommands(program, config);
    registerConversationsCommands(program, config);

    // Register Convex operations
    registerConvexCommands(program, config);

    // Register shell completion command
    registerCompletionCommand(program);

    // Hide memory operation commands from main list (will show in custom section)
    const memoryOpsCommands = [
      "memory",
      "users",
      "spaces",
      "facts",
      "conversations",
    ];
    for (const cmd of program.commands) {
      if (memoryOpsCommands.includes(cmd.name())) {
        // Commander.js uses _hidden property internally
        (cmd as unknown as { _hidden: boolean })._hidden = true;
      }
    }

    // Add custom help section for memory operations
    program.addHelpText(
      "after",
      `
${pc.bold("Memory Operations:")}
  memory                      Manage memories (vector store)
  users                       Manage user profiles and data
  spaces                      Manage memory spaces
  facts                       Manage extracted facts
  conversations|convs         Manage conversations
`,
    );

    // Show help if no command provided (after commands are registered)
    if (process.argv.length === 2) {
      program.outputHelp();
      process.exit(0);
    }

    // Parse arguments and execute
    setupClientCleanup();
    program.hook("preAction", () => { configureClientOptions(program.opts()); });
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red(`\n✖ Error: ${error.message}\n`));
      if (process.env.DEBUG || program.opts().debug) {
        console.error(error.stack);
      }
    } else {
      console.error(pc.red(`\n✖ An unexpected error occurred\n`));
    }
    process.exit(1);
  }
}

main();
