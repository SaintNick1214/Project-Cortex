/**
 * Development Commands
 *
 * Commands for development and testing:
 * - seed: Seed test data
 * - clear-test-data: Clear test data
 * - generate-data: Generate sample data
 * - debug: Debugging utilities
 */

import { Command } from "commander";
import ora from "ora";
import type { CLIConfig, OutputFormat } from "../types.js";
import { withClient } from "../utils/client.js";
import { resolveConfig } from "../utils/config.js";
import {
  formatOutput,
  printSuccess,
  printError,
  printWarning,
  printSection,
  formatCount,
  formatTimestamp,
} from "../utils/formatting.js";
import {
  validateMemorySpaceId,
  validateMemoryId,
  validateSearchQuery,
  requireConfirmation,
} from "../utils/validation.js";
import pc from "picocolors";

/**
 * Generate a random ID
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Sample data templates
 */
const DATA_TEMPLATES = {
  chatbot: {
    name: "AI Chatbot",
    conversations: [
      {
        user: "What's the weather like today?",
        agent:
          "I don't have access to real-time weather data, but I can help you find a weather service!",
      },
      {
        user: "Can you recommend a good restaurant?",
        agent:
          "I'd be happy to help! What cuisine are you in the mood for, and what's your location?",
      },
      {
        user: "Tell me a joke",
        agent:
          "Why did the programmer quit his job? Because he didn't get arrays! 😄",
      },
    ],
    facts: [
      { fact: "User prefers helpful and friendly responses", type: "preference" },
      { fact: "User enjoys humor in conversations", type: "preference" },
    ],
  },
  ecommerce: {
    name: "E-commerce Assistant",
    conversations: [
      {
        user: "I'm looking for running shoes",
        agent:
          "Great! I can help you find the perfect running shoes. What's your budget and preferred brand?",
      },
      {
        user: "What's your return policy?",
        agent:
          "We offer a 30-day return policy for unworn items with original tags. Would you like more details?",
      },
    ],
    facts: [
      { fact: "User is interested in running shoes", type: "preference" },
      { fact: "Customer values clear return policies", type: "observation" },
    ],
  },
  "knowledge-base": {
    name: "Knowledge Base Agent",
    conversations: [
      {
        user: "How do I reset my password?",
        agent:
          "To reset your password, go to Settings > Security > Change Password. You'll need to verify your email.",
      },
      {
        user: "What are the system requirements?",
        agent:
          "The minimum requirements are: 8GB RAM, 2GHz processor, and 10GB free disk space.",
      },
    ],
    facts: [
      {
        fact: "Password reset is done through Settings > Security",
        type: "knowledge",
      },
      {
        fact: "Minimum RAM requirement is 8GB",
        type: "knowledge",
      },
    ],
  },
};

/**
 * Register development commands
 */
export function registerDevCommands(program: Command, config: CLIConfig): void {
  const dev = program
    .command("dev")
    .description("Development and testing utilities");

  // dev seed
  dev
    .command("seed")
    .description("Seed test data into the database")
    .option("-u, --users <number>", "Number of test users to create", "5")
    .option("-s, --spaces <number>", "Number of memory spaces to create", "3")
    .option("-m, --memories <number>", "Number of memories per space", "10")
    .option("-c, --conversations <number>", "Conversations per space", "5")
    .option("--prefix <prefix>", "Prefix for test data IDs", "test")
    .option("-y, --yes", "Skip confirmation", false)
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        const numUsers = parseInt(options.users, 10);
        const numSpaces = parseInt(options.spaces, 10);
        const numMemories = parseInt(options.memories, 10);
        const numConversations = parseInt(options.conversations, 10);
        const prefix = options.prefix;

        if (!options.yes) {
          console.log();
          console.log(pc.bold("This will create:"));
          console.log(`  • ${numUsers} test users`);
          console.log(`  • ${numSpaces} memory spaces`);
          console.log(`  • ${numMemories * numSpaces} memories`);
          console.log(`  • ${numConversations * numSpaces} conversations`);
          console.log();

          const confirmed = await requireConfirmation(
            "Proceed with seeding test data?",
            config,
          );
          if (!confirmed) {
            printWarning("Seeding cancelled");
            return;
          }
        }

        const spinner = ora("Seeding test data...").start();

        await withClient(config, globalOpts, async (client) => {
          const created = {
            users: 0,
            spaces: 0,
            memories: 0,
            conversations: 0,
            facts: 0,
          };

          // Create test users
          spinner.text = "Creating test users...";
          for (let i = 0; i < numUsers; i++) {
            const userId = `${prefix}-user-${i + 1}`;
            try {
              await client.users.update(userId, {
                displayName: `Test User ${i + 1}`,
                email: `user${i + 1}@test.example`,
                createdBy: "cortex-cli-seed",
              });
              created.users++;
            } catch {
              // Skip if exists
            }
          }

          // Create memory spaces
          spinner.text = "Creating memory spaces...";
          const spaceIds: string[] = [];
          for (let i = 0; i < numSpaces; i++) {
            const spaceId = `${prefix}-space-${i + 1}`;
            try {
              await client.memorySpaces.register({
                memorySpaceId: spaceId,
                name: `Test Space ${i + 1}`,
                type: "project",
                metadata: { createdBy: "cortex-cli-seed" },
              });
              spaceIds.push(spaceId);
              created.spaces++;
            } catch {
              spaceIds.push(spaceId); // Still try to use it
            }
          }

          // Create conversations and memories
          for (const spaceId of spaceIds) {
            spinner.text = `Seeding ${spaceId}...`;

            // Create conversations
            for (let i = 0; i < numConversations; i++) {
              const conversationId = generateId(`${prefix}-conv`);
              const userId = `${prefix}-user-${(i % numUsers) + 1}`;

              try {
                await client.memory.remember({
                  memorySpaceId: spaceId,
                  conversationId,
                  userMessage: `Test message ${i + 1} from user`,
                  agentResponse: `Test response ${i + 1} from agent`,
                  userId,
                  userName: `Test User ${(i % numUsers) + 1}`,
                });
                created.conversations++;
                created.memories += 2; // User + agent message
              } catch {
                // Skip on error
              }
            }

            // Create additional standalone memories
            for (let i = 0; i < numMemories; i++) {
              try {
                await client.vector.store(spaceId, {
                  content: `Test memory content ${i + 1} for space ${spaceId}`,
                  contentType: "raw",
                  source: {
                    type: "system",
                    timestamp: Date.now(),
                  },
                  metadata: {
                    importance: Math.floor(Math.random() * 100),
                    tags: ["test", "seed", `batch-${i + 1}`],
                  },
                });
                created.memories++;
              } catch {
                // Skip on error
              }
            }
          }

          spinner.stop();

          printSuccess("Test data seeded successfully!");
          printSection("Created", {
            Users: created.users,
            "Memory Spaces": created.spaces,
            Memories: created.memories,
            Conversations: created.conversations,
          });
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Seeding failed");
        process.exit(1);
      }
    });

  // dev clear-test-data
  dev
    .command("clear-test-data")
    .description("Clear test data from the database")
    .option("--prefix <prefix>", "Prefix of test data to clear", "test")
    .option("-y, --yes", "Skip confirmation", false)
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        const prefix = options.prefix;

        if (!options.yes) {
          const confirmed = await requireConfirmation(
            `Delete all data with prefix "${prefix}"?`,
            config,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora("Clearing test data...").start();

        await withClient(config, globalOpts, async (client) => {
          const deleted = {
            users: 0,
            spaces: 0,
          };

          // Find and delete test spaces
          spinner.text = "Finding test memory spaces...";
          const spaces = await client.memorySpaces.list({ limit: 10000 });
          const testSpaces = spaces.filter((s) =>
            s.memorySpaceId.startsWith(prefix),
          );

          for (const space of testSpaces) {
            try {
              await client.memorySpaces.delete(space.memorySpaceId, {
                cascade: true,
              });
              deleted.spaces++;
            } catch {
              // Continue on error
            }
          }

          // Find and delete test users
          spinner.text = "Finding test users...";
          const users = await client.users.list({ limit: 10000 });
          const testUsers = users.filter((u) => u.id.startsWith(prefix));

          for (const user of testUsers) {
            try {
              await client.users.delete(user.id, { cascade: true });
              deleted.users++;
            } catch {
              // Continue on error
            }
          }

          spinner.stop();

          printSuccess("Test data cleared");
          printSection("Deleted", {
            "Memory Spaces": deleted.spaces,
            Users: deleted.users,
          });
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Clear failed");
        process.exit(1);
      }
    });

  // dev generate-data
  dev
    .command("generate-data")
    .description("Generate sample data from templates")
    .requiredOption(
      "-t, --template <template>",
      "Template: chatbot, ecommerce, knowledge-base",
    )
    .option("-s, --space <id>", "Memory space ID (creates new if not specified)")
    .option("-u, --user <id>", "User ID", "demo-user")
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        const templateName = options.template as keyof typeof DATA_TEMPLATES;
        const template = DATA_TEMPLATES[templateName];

        if (!template) {
          printError(
            `Unknown template: ${templateName}. Available: ${Object.keys(DATA_TEMPLATES).join(", ")}`,
          );
          process.exit(1);
        }

        const spinner = ora(`Generating ${template.name} data...`).start();

        await withClient(config, globalOpts, async (client) => {
          // Create or use existing space
          const spaceId = options.space ?? `demo-${templateName}`;

          spinner.text = "Creating memory space...";
          try {
            await client.memorySpaces.register({
              memorySpaceId: spaceId,
              name: template.name,
              type: "project",
              metadata: { template: templateName },
            });
          } catch {
            // Space may already exist
          }

          // Create user
          spinner.text = "Creating demo user...";
          const userId = options.user;
          try {
            await client.users.update(userId, {
              displayName: "Demo User",
              template: templateName,
            });
          } catch {
            // User may already exist
          }

          // Create conversations
          spinner.text = "Creating conversations...";
          let conversationCount = 0;
          for (const conv of template.conversations) {
            const conversationId = generateId("demo-conv");
            try {
              await client.memory.remember({
                memorySpaceId: spaceId,
                conversationId,
                userMessage: conv.user,
                agentResponse: conv.agent,
                userId,
                userName: "Demo User",
              });
              conversationCount++;
            } catch {
              // Skip on error
            }
          }

          // Create facts
          spinner.text = "Creating facts...";
          let factCount = 0;
          for (const factData of template.facts) {
            try {
              await client.facts.store({
                memorySpaceId: spaceId,
                fact: factData.fact,
                factType: factData.type as
                  | "preference"
                  | "identity"
                  | "knowledge"
                  | "observation"
                  | "relationship"
                  | "event"
                  | "custom",
                confidence: 80,
                sourceType: "system",
                tags: ["demo", templateName],
              });
              factCount++;
            } catch {
              // Skip on error
            }
          }

          spinner.stop();

          printSuccess(`Generated ${template.name} demo data`);
          printSection("Created", {
            "Memory Space": spaceId,
            "User": userId,
            "Conversations": conversationCount,
            "Facts": factCount,
          });
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Generation failed");
        process.exit(1);
      }
    });

  // dev debug
  const debug = dev.command("debug").description("Debugging utilities");

  // debug search
  debug
    .command("search <query>")
    .description("Test vector search")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-l, --limit <number>", "Number of results", "5")
    .option("--verbose", "Show detailed results", false)
    .action(async (query, options) => {
      const globalOpts = program.opts();

      try {
        validateSearchQuery(query);
        validateMemorySpaceId(options.space);

        const spinner = ora("Performing vector search...").start();
        const startTime = Date.now();

        await withClient(config, globalOpts, async (client) => {
          const results = await client.memory.search(options.space, query, {
            limit: parseInt(options.limit, 10),
          });

          const duration = Date.now() - startTime;
          spinner.stop();

          console.log();
          printSection("Search Debug", {
            "Query": query,
            "Space": options.space,
            "Results": results.length,
            "Duration": `${duration}ms`,
          });

          if (results.length > 0) {
            console.log("\n  Results:");
            for (let i = 0; i < results.length; i++) {
              const result = results[i];
              // Type guard for EnrichedMemory vs MemoryEntry
              const memory = result && typeof result === "object" && "memory" in result
                ? (result as { memory: { memoryId: string; content: string; contentType: string; importance: number; createdAt: number; tags: string[] } }).memory
                : result as { memoryId: string; content: string; contentType: string; importance: number; createdAt: number; tags: string[] };
              console.log(`\n  ${pc.cyan(`[${i + 1}]`)} ${memory.memoryId}`);
              console.log(
                `      ${pc.dim("Content:")} ${memory.content.substring(0, 100)}...`,
              );
              console.log(`      ${pc.dim("Type:")} ${memory.contentType}`);
              console.log(`      ${pc.dim("Importance:")} ${memory.importance}`);

              if (options.verbose) {
                console.log(
                  `      ${pc.dim("Created:")} ${formatTimestamp(memory.createdAt)}`,
                );
                console.log(
                  `      ${pc.dim("Tags:")} ${memory.tags.join(", ") || "-"}`,
                );
              }
            }
          } else {
            printWarning("No results found");
          }
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Search failed");
        process.exit(1);
      }
    });

  // debug inspect
  debug
    .command("inspect <memoryId>")
    .description("Inspect a memory in detail")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .action(async (memoryId, options) => {
      const globalOpts = program.opts();

      try {
        validateMemoryId(memoryId);
        validateMemorySpaceId(options.space);

        const spinner = ora("Loading memory...").start();

        await withClient(config, globalOpts, async (client) => {
          const result = await client.memory.get(options.space, memoryId, {
            includeConversation: true,
          });

          spinner.stop();

          if (!result) {
            printError("Memory not found");
            process.exit(1);
          }

          const memory = "memory" in result ? result.memory : result;

          console.log();
          console.log(pc.bold(pc.cyan("Memory Inspection")));
          console.log(pc.dim("─".repeat(50)));
          console.log();

          // Basic info
          console.log(pc.bold("Basic Info:"));
          console.log(`  ID: ${memory.memoryId}`);
          console.log(`  Space: ${memory.memorySpaceId}`);
          console.log(`  Version: ${memory.version}`);
          console.log();

          // Content
          console.log(pc.bold("Content:"));
          console.log(`  Type: ${memory.contentType}`);
          console.log(`  Length: ${memory.content.length} characters`);
          console.log(`  Content:\n    ${memory.content}`);
          console.log();

          // Source
          console.log(pc.bold("Source:"));
          console.log(`  Type: ${memory.sourceType}`);
          console.log(`  User: ${memory.userId ?? "-"}`);
          console.log(`  Timestamp: ${formatTimestamp(memory.sourceTimestamp)}`);
          console.log();

          // Metadata
          console.log(pc.bold("Metadata:"));
          console.log(`  Importance: ${memory.importance}`);
          console.log(`  Tags: ${memory.tags.join(", ") || "-"}`);
          console.log(`  Access Count: ${memory.accessCount}`);
          console.log();

          // Embedding
          console.log(pc.bold("Embedding:"));
          if (memory.embedding) {
            console.log(`  Dimensions: ${memory.embedding.length}`);
            console.log(
              `  Sample: [${memory.embedding.slice(0, 5).map((n) => n.toFixed(4)).join(", ")}, ...]`,
            );
          } else {
            console.log("  No embedding stored");
          }
          console.log();

          // Timestamps
          console.log(pc.bold("Timestamps:"));
          console.log(`  Created: ${formatTimestamp(memory.createdAt)}`);
          console.log(`  Updated: ${formatTimestamp(memory.updatedAt)}`);
          if (memory.lastAccessed) {
            console.log(`  Last Accessed: ${formatTimestamp(memory.lastAccessed)}`);
          }

          // Version history
          if (memory.previousVersions && memory.previousVersions.length > 0) {
            console.log();
            console.log(pc.bold(`Version History: ${memory.previousVersions.length} previous versions`));
          }
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Inspect failed");
        process.exit(1);
      }
    });

  // debug connection
  debug
    .command("connection")
    .description("Test and debug connection")
    .action(async () => {
      const globalOpts = program.opts();

      console.log();
      printSection("Connection Debug", {});

      const { testConnection, getDeploymentInfo } = await import(
        "../utils/client.js"
      );

      const info = getDeploymentInfo(config, globalOpts);
      console.log(`  URL: ${info.url}`);
      console.log(`  Mode: ${info.isLocal ? "Local" : "Cloud"}`);
      console.log(`  Deploy Key: ${info.hasKey ? "Set" : "Not set"}`);
      console.log();

      const spinner = ora("Testing connection...").start();
      const result = await testConnection(config, globalOpts);
      spinner.stop();

      if (result.connected) {
        printSuccess(`Connected (${result.latency}ms latency)`);
      } else {
        printError(`Connection failed: ${result.error}`);
      }
    });
}
