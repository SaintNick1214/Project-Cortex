#!/usr/bin/env node
/**
 * Cortex CLI - Command Line Interface for Cortex Memory SDK
 *
 * A powerful tool for managing Cortex deployments, performing administrative tasks,
 * and streamlining development workflows.
 */

import { Command } from "commander";
import pc from "picocolors";
import { registerMemoryCommands } from "./commands/memory.js";
import { registerUserCommands } from "./commands/users.js";
import { registerSpaceCommands } from "./commands/spaces.js";
import { registerFactsCommands } from "./commands/facts.js";
import { registerConversationsCommands } from "./commands/conversations.js";
import { registerConvexCommands } from "./commands/convex.js";
import { registerSetupCommands } from "./commands/setup.js";
import { registerDbCommands } from "./commands/db.js";
import { registerDevCommands } from "./commands/dev.js";
import { loadConfig } from "./utils/config.js";

// Package version - will be read from package.json in build
const VERSION = "0.1.0";

const program = new Command();

program
  .name("cortex")
  .description(
    "CLI tool for managing Cortex Memory deployments and performing administrative tasks",
  )
  .version(VERSION)
  .option("-d, --deployment <name>", "Deployment name to use (from config)")
  .option("-u, --url <url>", "Convex deployment URL (overrides config)")
  .option("-k, --key <key>", "Convex deploy key (overrides config)")
  .option("-f, --format <format>", "Output format: table, json, csv", "table")
  .option("-q, --quiet", "Suppress non-essential output", false)
  .option("--debug", "Enable debug output", false);

// Load config and register commands
async function main() {
  try {
    // Load configuration
    const config = await loadConfig();

    // Register all command groups
    registerMemoryCommands(program, config);
    registerUserCommands(program, config);
    registerSpaceCommands(program, config);
    registerFactsCommands(program, config);
    registerConversationsCommands(program, config);
    registerConvexCommands(program, config);
    registerSetupCommands(program, config);
    registerDbCommands(program, config);
    registerDevCommands(program, config);

    // Parse arguments and execute
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

// Show help if no command provided
if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

main();
