/**
 * Cortex Memory - CLI Demo
 *
 * Interactive command-line interface for demonstrating Cortex Memory SDK.
 * Shows the "thinking" behind each memory layer as messages are processed.
 *
 * Usage:
 *   npm start              # Start CLI mode
 *   npm run server         # Start HTTP server mode
 *
 * Commands:
 *   /recall <query>        # Search memories without storing
 *   /facts                 # List all stored facts
 *   /history               # Show conversation history
 *   /new                   # Start a new conversation
 *   /config                # Show current configuration
 *   /clear                 # Clear the screen
 *   /exit                  # Exit the demo
 */

import * as readline from "readline";
import { closeCortex, initCortex, CONFIG } from "./cortex.js";
import {
  chat,
  recallMemories,
  listFacts,
  getHistory,
  newConversation,
  printConfig,
  getConversationId,
} from "./chat.js";
import { printWelcome, printError, printInfo, printSuccess } from "./display.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLI Interface
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Process a line of input
 */
async function processInput(input: string): Promise<boolean> {
  const trimmed = input.trim();

  if (!trimmed) {
    return true; // Continue
  }

  // Handle commands
  if (trimmed.startsWith("/")) {
    return handleCommand(trimmed);
  }

  // Regular chat message
  try {
    console.log("");
    const result = await chat(trimmed);

    // Print assistant response
    console.log("\x1b[36mAssistant:\x1b[0m");
    console.log(result.response);
    console.log("");

    return true;
  } catch (error) {
    printError("Failed to process message", error instanceof Error ? error : undefined);
    return true;
  }
}

/**
 * Handle slash commands
 */
async function handleCommand(input: string): Promise<boolean> {
  const parts = input.slice(1).split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  switch (command) {
    case "exit":
    case "quit":
    case "q":
      printInfo("Goodbye!");
      return false;

    case "clear":
    case "cls":
      console.clear();
      printWelcome("cli");
      return true;

    case "recall":
    case "search":
      if (!args) {
        printInfo("Usage: /recall <query>");
      } else {
        await recallMemories(args);
      }
      return true;

    case "facts":
      await listFacts();
      return true;

    case "history":
    case "h":
      await getHistory();
      return true;

    case "new":
      newConversation();
      return true;

    case "config":
    case "status":
      printConfig();
      return true;

    case "help":
    case "?":
      printHelp();
      return true;

    default:
      printInfo(`Unknown command: /${command}. Type /help for available commands.`);
      return true;
  }
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log("");
  console.log("📖 Available Commands:");
  console.log("");
  console.log("  /recall <query>  Search memories without storing");
  console.log("  /facts           List all stored facts");
  console.log("  /history         Show conversation history");
  console.log("  /new             Start a new conversation");
  console.log("  /config          Show current configuration");
  console.log("  /clear           Clear the screen");
  console.log("  /help            Show this help message");
  console.log("  /exit            Exit the demo");
  console.log("");
}

/**
 * Prompt for input
 */
function prompt(): void {
  rl.question("\x1b[33mYou:\x1b[0m ", async (input) => {
    const shouldContinue = await processInput(input);

    if (shouldContinue) {
      prompt();
    } else {
      cleanup();
    }
  });
}

/**
 * Cleanup on exit
 */
function cleanup(): void {
  closeCortex();
  rl.close();
  process.exit(0);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Entry Point
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main(): Promise<void> {
  // Check for required environment
  if (!process.env.CONVEX_URL) {
    printError(
      "CONVEX_URL is required. Set it in .env.local or run: cortex init",
    );
    process.exit(1);
  }

  // Print welcome
  printWelcome("cli");

  // Initialize Cortex client (async for graph support)
  // v0.29.0+: Uses Cortex.create() for automatic graph configuration
  try {
    await initCortex();
    // Check if graph is actually configured (flag + URI)
    const hasGraphUri = !!(process.env.NEO4J_URI || process.env.MEMGRAPH_URI);
    if (CONFIG.enableGraphMemory && hasGraphUri) {
      printSuccess("Graph memory connected (auto-sync active)");
    } else if (CONFIG.enableGraphMemory && !hasGraphUri) {
      printInfo("Graph sync enabled but no database URI configured (NEO4J_URI or MEMGRAPH_URI)");
    }
  } catch (error) {
    printError("Failed to initialize Cortex", error instanceof Error ? error : undefined);
    process.exit(1);
  }

  // Initialize conversation
  const convId = getConversationId();
  printSuccess(`Conversation: ${convId}`);
  console.log("");

  // Handle signals
  process.on("SIGINT", () => {
    console.log("");
    cleanup();
  });

  process.on("SIGTERM", () => {
    cleanup();
  });

  // Start prompt loop
  prompt();
}

// Run
main().catch((error) => {
  printError("Fatal error", error instanceof Error ? error : undefined);
  process.exit(1);
});
