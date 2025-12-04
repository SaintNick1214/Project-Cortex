/**
 * Memory Commands
 *
 * Commands for managing memories:
 * - clear: Clear memories for a user or space
 * - list: List memories
 * - search: Search memories
 * - delete: Delete a specific memory
 * - export: Export memories
 * - stats: Show memory statistics
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
  formatRelativeTime,
} from "../utils/formatting.js";
import {
  validateMemorySpaceId,
  validateUserId,
  validateMemoryId,
  validateSearchQuery,
  validateLimit,
  validateFilePath,
  requireConfirmation,
} from "../utils/validation.js";
import { writeFile } from "fs/promises";

/**
 * Register memory commands
 */
export function registerMemoryCommands(
  program: Command,
  config: CLIConfig,
): void {
  const memory = program
    .command("memory")
    .description("Manage memories (vector store)");

  // memory list
  memory
    .command("list")
    .description("List memories in a memory space")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-u, --user <id>", "Filter by user ID")
    .option("-l, --limit <number>", "Maximum number of results", "50")
    .option("-f, --format <format>", "Output format: table, json, csv")
    .action(async (options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading memories...").start();

      try {
        validateMemorySpaceId(options.space);
        if (options.user) {
          validateUserId(options.user);
        }
        const limit = validateLimit(parseInt(options.limit, 10));

        await withClient(config, globalOpts, async (client) => {
          const memories = await client.memory.list({
            memorySpaceId: options.space,
            userId: options.user,
            limit,
          });

          spinner.stop();

          if (memories.length === 0) {
            printWarning("No memories found");
            return;
          }

          // Format memories for display
          const displayData = memories.map((m) => {
            // Handle both MemoryEntry and EnrichedMemory types
            const memory = "memory" in m ? m.memory : m;
            return {
              id: memory.memoryId,
              content:
                memory.content.length > 50
                  ? memory.content.substring(0, 47) + "..."
                  : memory.content,
              type: memory.contentType,
              source: memory.sourceType,
              user: memory.userId ?? "-",
              importance: memory.importance,
              created: formatRelativeTime(memory.createdAt),
            };
          });

          console.log(
            formatOutput(displayData, format, {
              title: `Memories in ${options.space}`,
              headers: [
                "id",
                "content",
                "type",
                "source",
                "user",
                "importance",
                "created",
              ],
            }),
          );

          printSuccess(
            `Found ${formatCount(memories.length, "memory", "memories")}`,
          );
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to list memories",
        );
        process.exit(1);
      }
    });

  // memory search
  memory
    .command("search <query>")
    .description("Search memories by content")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-u, --user <id>", "Filter by user ID")
    .option("-l, --limit <number>", "Maximum number of results", "20")
    .option("-f, --format <format>", "Output format: table, json, csv")
    .action(async (query, options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Searching memories...").start();

      try {
        validateSearchQuery(query);
        validateMemorySpaceId(options.space);
        if (options.user) {
          validateUserId(options.user);
        }
        const limit = validateLimit(parseInt(options.limit, 10));

        await withClient(config, globalOpts, async (client) => {
          const memories = await client.memory.search(options.space, query, {
            userId: options.user,
            limit,
          });

          spinner.stop();

          if (memories.length === 0) {
            printWarning("No memories found matching your query");
            return;
          }

          // Format memories for display
          const displayData = memories.map((m) => {
            const memory = "memory" in m ? m.memory : m;
            return {
              id: memory.memoryId,
              content:
                memory.content.length > 60
                  ? memory.content.substring(0, 57) + "..."
                  : memory.content,
              type: memory.contentType,
              source: memory.sourceType,
              user: memory.userId ?? "-",
              importance: memory.importance,
            };
          });

          console.log(
            formatOutput(displayData, format, {
              title: `Search results for "${query}"`,
              headers: [
                "id",
                "content",
                "type",
                "source",
                "user",
                "importance",
              ],
            }),
          );

          printSuccess(
            `Found ${formatCount(memories.length, "memory", "memories")}`,
          );
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Search failed");
        process.exit(1);
      }
    });

  // memory delete
  memory
    .command("delete <memoryId>")
    .description("Delete a specific memory")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("--cascade", "Also delete associated facts", false)
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (memoryId, options) => {
      const globalOpts = program.opts();

      try {
        validateMemoryId(memoryId);
        validateMemorySpaceId(options.space);

        if (!options.yes) {
          const confirmed = await requireConfirmation(
            `Delete memory ${memoryId} from space ${options.space}?`,
            config,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora("Deleting memory...").start();

        await withClient(config, globalOpts, async (client) => {
          const result = await client.memory.delete(options.space, memoryId, {
            cascadeDeleteFacts: options.cascade,
          });

          spinner.stop();

          if (result.deleted) {
            printSuccess(`Deleted memory ${memoryId}`);
            if (result.factsDeleted && result.factsDeleted > 0) {
              printSuccess(
                `Also deleted ${formatCount(result.factsDeleted, "associated fact")}`,
              );
            }
          } else {
            printError("Memory not found or could not be deleted");
          }
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Delete failed");
        process.exit(1);
      }
    });

  // memory clear
  memory
    .command("clear")
    .description("Clear multiple memories")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-u, --user <id>", "Only clear memories for this user")
    .option("--source <type>", "Only clear memories of this source type")
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        validateMemorySpaceId(options.space);
        if (options.user) {
          validateUserId(options.user);
        }

        await withClient(config, globalOpts, async (client) => {
          // Count memories first
          const count = await client.memory.count({
            memorySpaceId: options.space,
            userId: options.user,
            sourceType: options.source,
          });

          if (count === 0) {
            printWarning("No memories found to delete");
            return;
          }

          if (!options.yes) {
            const scope = options.user
              ? `for user ${options.user} in space ${options.space}`
              : `in space ${options.space}`;
            const confirmed = await requireConfirmation(
              `Delete ${formatCount(count, "memory", "memories")} ${scope}? This cannot be undone.`,
              config,
            );
            if (!confirmed) {
              printWarning("Operation cancelled");
              return;
            }
          }

          const spinner = ora(`Deleting ${count} memories...`).start();

          const result = await client.memory.deleteMany({
            memorySpaceId: options.space,
            userId: options.user,
            sourceType: options.source,
          });

          spinner.stop();

          printSuccess(
            `Deleted ${formatCount(result.deleted, "memory", "memories")}`,
          );
          if (result.factsDeleted && result.factsDeleted > 0) {
            printSuccess(
              `Also deleted ${formatCount(result.factsDeleted, "associated fact")}`,
            );
          }
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Clear failed");
        process.exit(1);
      }
    });

  // memory export
  memory
    .command("export")
    .description("Export memories to a file")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-u, --user <id>", "Only export memories for this user")
    .option("-o, --output <file>", "Output file path", "memories-export.json")
    .option("--include-facts", "Include associated facts", false)
    .option("-f, --format <format>", "Export format: json, csv", "json")
    .action(async (options) => {
      const globalOpts = program.opts();

      const spinner = ora("Exporting memories...").start();

      try {
        validateMemorySpaceId(options.space);
        if (options.user) {
          validateUserId(options.user);
        }
        validateFilePath(options.output);

        await withClient(config, globalOpts, async (client) => {
          const result = await client.memory.export({
            memorySpaceId: options.space,
            userId: options.user,
            format: options.format,
            includeFacts: options.includeFacts,
          });

          await writeFile(options.output, result.data, "utf-8");

          spinner.stop();

          printSuccess(
            `Exported ${formatCount(result.count, "memory", "memories")} to ${options.output}`,
          );
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Export failed");
        process.exit(1);
      }
    });

  // memory stats
  memory
    .command("stats")
    .description("Show memory statistics for a space")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading statistics...").start();

      try {
        validateMemorySpaceId(options.space);

        await withClient(config, globalOpts, async (client) => {
          // Get counts
          const [totalCount, conversationCount, systemCount, toolCount] =
            await Promise.all([
              client.memory.count({ memorySpaceId: options.space }),
              client.memory.count({
                memorySpaceId: options.space,
                sourceType: "conversation",
              }),
              client.memory.count({
                memorySpaceId: options.space,
                sourceType: "system",
              }),
              client.memory.count({
                memorySpaceId: options.space,
                sourceType: "tool",
              }),
            ]);

          // Get recent memories
          const recentMemories = await client.memory.list({
            memorySpaceId: options.space,
            limit: 5,
          });

          spinner.stop();

          if (format === "json") {
            console.log(
              formatOutput(
                {
                  memorySpaceId: options.space,
                  total: totalCount,
                  bySource: {
                    conversation: conversationCount,
                    system: systemCount,
                    tool: toolCount,
                  },
                  recentCount: recentMemories.length,
                },
                "json",
              ),
            );
          } else {
            printSection(`Memory Statistics for ${options.space}`, {
              "Total Memories": totalCount,
              "From Conversations": conversationCount,
              "From System": systemCount,
              "From Tools": toolCount,
            });

            if (recentMemories.length > 0) {
              const lastMemory =
                "memory" in recentMemories[0]
                  ? recentMemories[0].memory
                  : recentMemories[0];
              console.log(
                `  Last Activity: ${formatTimestamp(lastMemory.createdAt)}`,
              );
            }
          }
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to load statistics",
        );
        process.exit(1);
      }
    });

  // memory get
  memory
    .command("get <memoryId>")
    .description("Get details of a specific memory")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("--include-conversation", "Include source conversation", false)
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (memoryId, options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading memory...").start();

      try {
        validateMemoryId(memoryId);
        validateMemorySpaceId(options.space);

        await withClient(config, globalOpts, async (client) => {
          const result = await client.memory.get(options.space, memoryId, {
            includeConversation: options.includeConversation,
          });

          spinner.stop();

          if (!result) {
            printError("Memory not found");
            process.exit(1);
          }

          if (format === "json") {
            console.log(formatOutput(result, "json"));
          } else {
            // Handle both MemoryEntry and EnrichedMemory types
            const memory = "memory" in result ? result.memory : result;
            printSection(`Memory: ${memory.memoryId}`, {
              Content: memory.content,
              "Content Type": memory.contentType,
              "Source Type": memory.sourceType,
              "User ID": memory.userId ?? "-",
              Importance: memory.importance,
              Version: memory.version,
              Created: formatTimestamp(memory.createdAt),
              Updated: formatTimestamp(memory.updatedAt),
              "Access Count": memory.accessCount,
              Tags: memory.tags.length > 0 ? memory.tags.join(", ") : "-",
            });

            // Show enriched data if available
            if ("memory" in result && result.sourceMessages) {
              console.log("\n  Source Messages:");
              for (const msg of result.sourceMessages) {
                console.log(
                  `    [${msg.role}]: ${msg.content.substring(0, 100)}...`,
                );
              }
            }

            if ("memory" in result && result.facts && result.facts.length > 0) {
              console.log(`\n  Related Facts: ${result.facts.length}`);
            }
          }
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to get memory",
        );
        process.exit(1);
      }
    });

  // memory archive
  memory
    .command("archive <memoryId>")
    .description("Archive a memory (soft delete)")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (memoryId, options) => {
      const globalOpts = program.opts();

      try {
        validateMemoryId(memoryId);
        validateMemorySpaceId(options.space);

        if (!options.yes) {
          const confirmed = await requireConfirmation(
            `Archive memory ${memoryId}? It can be restored later.`,
            config,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora("Archiving memory...").start();

        await withClient(config, globalOpts, async (client) => {
          const result = await client.memory.archive(options.space, memoryId);

          spinner.stop();

          if (result.archived) {
            printSuccess(`Archived memory ${memoryId}`);
            if (result.factsArchived && result.factsArchived > 0) {
              printSuccess(
                `Also archived ${formatCount(result.factsArchived, "associated fact")}`,
              );
            }
          } else {
            printError("Memory not found or could not be archived");
          }
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Archive failed");
        process.exit(1);
      }
    });

  // memory restore
  memory
    .command("restore <memoryId>")
    .description("Restore an archived memory")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .action(async (memoryId, options) => {
      const globalOpts = program.opts();

      const spinner = ora("Restoring memory...").start();

      try {
        validateMemoryId(memoryId);
        validateMemorySpaceId(options.space);

        await withClient(config, globalOpts, async (client) => {
          const result = await client.memory.restoreFromArchive(
            options.space,
            memoryId,
          );

          spinner.stop();

          if (result.restored) {
            printSuccess(`Restored memory ${memoryId}`);
          } else {
            printError("Memory not found or could not be restored");
          }
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Restore failed");
        process.exit(1);
      }
    });
}
