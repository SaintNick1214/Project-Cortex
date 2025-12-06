/**
 * User Commands
 *
 * Commands for managing users with GDPR cascade deletion support:
 * - list: List all users
 * - get: Get user profile
 * - delete: Delete user with optional cascade
 * - delete-many: Delete multiple users
 * - export: Export user data
 * - stats: Show user statistics
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
  validateUserId,
  validateLimit,
  validateFilePath,
  requireConfirmation,
  requireExactConfirmation,
} from "../utils/validation.js";
import { writeFile } from "fs/promises";

/**
 * Register user commands
 */
export function registerUserCommands(
  program: Command,
  config: CLIConfig,
): void {
  const users = program
    .command("users")
    .description("Manage user profiles and data");

  // users list
  users
    .command("list")
    .description("List all user profiles with usage stats")
    .option("-l, --limit <number>", "Maximum number of results", "50")
    .option("-f, --format <format>", "Output format: table, json, csv")
    .option("--no-stats", "Skip gathering usage stats (faster)")
    .action(async (options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading users...").start();

      try {
        const limit = validateLimit(parseInt(options.limit, 10));

        await withClient(config, globalOpts, async (client) => {
          const usersList = await client.users.list({ limit });

          if (usersList.length === 0) {
            spinner.stop();
            printWarning("No users found");
            return;
          }

          // Gather stats if not disabled
          let userStats: Map<
            string,
            { memories: number; conversations: number; facts: number }
          > = new Map();

          if (options.stats !== false) {
            spinner.text = `Loading stats for ${usersList.length} users...`;

            // Get all memory spaces once
            const spaces = await client.memorySpaces.list();

            for (const user of usersList) {
              let memories = 0;
              let conversations = 0;
              let facts = 0;

              for (const space of spaces) {
                try {
                  // Count memories for this user in this space
                  const memCount = await client.memory.count({
                    memorySpaceId: space.memorySpaceId,
                    userId: user.id,
                  });
                  memories += memCount;

                  // Count conversations
                  const convos = await client.conversations.list({
                    memorySpaceId: space.memorySpaceId,
                    userId: user.id,
                    limit: 1000,
                  });
                  conversations += convos.length;

                  // Count facts
                  const factsList = await client.facts.list({
                    memorySpaceId: space.memorySpaceId,
                    userId: user.id,
                    limit: 1000,
                  });
                  facts += factsList.length;
                } catch {
                  // Skip spaces that don't support userId filter
                }
              }

              userStats.set(user.id, { memories, conversations, facts });
            }
          }

          spinner.stop();

          // Format users for display
          const displayData = usersList.map((u) => {
            const stats = userStats.get(u.id);
            if (stats) {
              return {
                id: u.id,
                memories: stats.memories,
                conversations: stats.conversations,
                facts: stats.facts,
                version: u.version,
                updated: formatRelativeTime(u.updatedAt),
              };
            } else {
              // No stats mode - show basic info with a preview of data keys
              const dataKeys = Object.keys(u.data).slice(0, 3).join(", ");
              return {
                id: u.id,
                version: u.version,
                created: formatRelativeTime(u.createdAt),
                updated: formatRelativeTime(u.updatedAt),
                fields: dataKeys || "(empty)",
              };
            }
          });

          const headers =
            options.stats !== false
              ? [
                  "id",
                  "memories",
                  "conversations",
                  "facts",
                  "version",
                  "updated",
                ]
              : ["id", "version", "created", "updated", "fields"];

          console.log(
            formatOutput(displayData, format, {
              title: "User Profiles",
              headers,
            }),
          );

          printSuccess(`Found ${formatCount(usersList.length, "user")}`);
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to list users",
        );
        process.exit(1);
      }
    });

  // users get
  users
    .command("get <userId>")
    .description("Get user profile details")
    .option("-f, --format <format>", "Output format: table, json")
    .option("--include-history", "Include version history", false)
    .action(async (userId, options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading user...").start();

      try {
        validateUserId(userId);

        await withClient(config, globalOpts, async (client) => {
          const user = await client.users.get(userId);

          if (!user) {
            spinner.stop();
            printError(`User ${userId} not found`);
            process.exit(1);
          }

          // Get version history if requested
          let history = null;
          if (options.includeHistory) {
            history = await client.users.getHistory(userId);
          }

          spinner.stop();

          if (format === "json") {
            console.log(
              formatOutput(
                options.includeHistory ? { user, history } : user,
                "json",
              ),
            );
          } else {
            printSection(`User Profile: ${userId}`, {
              ID: user.id,
              Version: user.version,
              Created: formatTimestamp(user.createdAt),
              Updated: formatTimestamp(user.updatedAt),
            });

            console.log("\n  Profile Data:");
            for (const [key, value] of Object.entries(user.data)) {
              console.log(`    ${key}: ${JSON.stringify(value)}`);
            }

            if (history && history.length > 0) {
              console.log(`\n  Version History: ${history.length} versions`);
              for (const v of history.slice(0, 5)) {
                console.log(
                  `    v${v.version}: ${formatTimestamp(v.timestamp)}`,
                );
              }
              if (history.length > 5) {
                console.log(`    ... and ${history.length - 5} more`);
              }
            }
          }
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to get user",
        );
        process.exit(1);
      }
    });

  // users delete (with GDPR cascade)
  users
    .command("delete <userId>")
    .description("Delete user profile with optional GDPR cascade deletion")
    .option("--cascade", "Delete all user data across all layers (GDPR)", false)
    .option(
      "--dry-run",
      "Preview what would be deleted without actually deleting",
      false,
    )
    .option("--verify", "Verify deletion completeness after cascade", true)
    .option(
      "-y, --yes",
      "Skip confirmation prompt (not recommended for cascade)",
      false,
    )
    .action(async (userId, options) => {
      const globalOpts = program.opts();

      try {
        validateUserId(userId);

        // Require extra confirmation for cascade deletion
        if (options.cascade && !options.yes && !options.dryRun) {
          console.log("\n⚠️  GDPR CASCADE DELETION");
          console.log(
            "This will permanently delete ALL data for this user across:",
          );
          console.log("  • User profile");
          console.log("  • Conversations and messages");
          console.log("  • Memories (vector store)");
          console.log("  • Facts");
          console.log("  • Immutable records");
          console.log("  • Mutable records");
          console.log("  • Graph nodes (if configured)\n");

          const confirmed = await requireExactConfirmation(
            userId,
            `Type the user ID "${userId}" to confirm cascade deletion:`,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        } else if (!options.yes && !options.dryRun) {
          const confirmed = await requireConfirmation(
            `Delete user profile ${userId}?`,
            config,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora(
          options.dryRun
            ? "Analyzing deletion scope..."
            : options.cascade
              ? "Performing cascade deletion..."
              : "Deleting user...",
        ).start();

        await withClient(config, globalOpts, async (client) => {
          const result = await client.users.delete(userId, {
            cascade: options.cascade,
            dryRun: options.dryRun,
            verify: options.verify,
          });

          spinner.stop();

          if (options.dryRun) {
            console.log("\n📋 DRY RUN - No data was deleted\n");
            printSection(`Would delete for user ${userId}`, {
              "User Profile": "Yes",
              Conversations: result.conversationsDeleted,
              "Conversation Messages": result.conversationMessagesDeleted,
              "Immutable Records": result.immutableRecordsDeleted,
              "Mutable Keys": result.mutableKeysDeleted,
              "Vector Memories": result.vectorMemoriesDeleted,
              Facts: result.factsDeleted,
              "Graph Nodes": result.graphNodesDeleted ?? "N/A",
              "Total Records": result.totalDeleted,
              "Affected Layers": result.deletedLayers.join(", "),
            });
          } else {
            printSuccess(`Deleted user ${userId}`);

            if (options.cascade) {
              printSection("Cascade Deletion Summary", {
                Conversations: result.conversationsDeleted,
                Messages: result.conversationMessagesDeleted,
                Memories: result.vectorMemoriesDeleted,
                Facts: result.factsDeleted,
                "Immutable Records": result.immutableRecordsDeleted,
                "Mutable Keys": result.mutableKeysDeleted,
                "Graph Nodes": result.graphNodesDeleted ?? "N/A",
                "Total Deleted": result.totalDeleted,
              });

              // Show verification results
              if (options.verify && result.verification) {
                if (result.verification.complete) {
                  printSuccess("✓ Verification passed - all user data deleted");
                } else {
                  printWarning("Verification found potential issues:");
                  for (const issue of result.verification.issues) {
                    console.log(`  • ${issue}`);
                  }
                }
              }
            }
          }
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Delete failed");
        process.exit(1);
      }
    });

  // users delete-many
  users
    .command("delete-many <userIds...>")
    .description("Delete multiple users with optional GDPR cascade")
    .option("--cascade", "Delete all user data across all layers", false)
    .option("--dry-run", "Preview what would be deleted", false)
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (userIds, options) => {
      const globalOpts = program.opts();

      try {
        // Validate all user IDs
        for (const userId of userIds) {
          validateUserId(userId);
        }

        if (!options.yes && !options.dryRun) {
          const cascade = options.cascade ? " (with cascade)" : "";
          const confirmed = await requireConfirmation(
            `Delete ${formatCount(userIds.length, "user")}${cascade}? This cannot be undone.`,
            config,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora(`Deleting ${userIds.length} users...`).start();

        await withClient(config, globalOpts, async (client) => {
          const result = await client.users.deleteMany(userIds, {
            cascade: options.cascade,
            dryRun: options.dryRun,
          });

          spinner.stop();

          if (options.dryRun) {
            printWarning(
              `DRY RUN: Would delete ${formatCount(userIds.length, "user")}`,
            );
          } else {
            printSuccess(
              `Deleted ${formatCount(result.deleted, "user")} of ${userIds.length}`,
            );
            if (result.deleted < userIds.length) {
              printWarning(
                `${userIds.length - result.deleted} users not found or could not be deleted`,
              );
            }
          }
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Delete failed");
        process.exit(1);
      }
    });

  // users export
  users
    .command("export <userId>")
    .description("Export all user data (GDPR data portability)")
    .option("-o, --output <file>", "Output file path", "user-export.json")
    .action(async (userId, options) => {
      const globalOpts = program.opts();

      const spinner = ora("Exporting user data...").start();

      try {
        validateUserId(userId);
        validateFilePath(options.output);

        await withClient(config, globalOpts, async (client) => {
          // Get user profile
          const user = await client.users.get(userId);
          if (!user) {
            spinner.stop();
            printError(`User ${userId} not found`);
            process.exit(1);
          }

          // Get user history
          const history = await client.users.getHistory(userId);

          // Export the data
          const exportData = {
            userId,
            exportedAt: Date.now(),
            profile: user,
            versionHistory: history,
          };

          await writeFile(
            options.output,
            JSON.stringify(exportData, null, 2),
            "utf-8",
          );

          spinner.stop();
          printSuccess(`Exported user data to ${options.output}`);
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Export failed");
        process.exit(1);
      }
    });

  // users stats
  users
    .command("stats <userId>")
    .description("Show statistics for a user")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (userId, options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading user statistics...").start();

      try {
        validateUserId(userId);

        await withClient(config, globalOpts, async (client) => {
          // Check if user exists
          const user = await client.users.get(userId);
          if (!user) {
            spinner.stop();
            printError(`User ${userId} not found`);
            process.exit(1);
          }

          // Get version count
          const history = await client.users.getHistory(userId);

          // Get all memory spaces to count user's data
          const spaces = await client.memorySpaces.list();

          let totalMemories = 0;
          let totalConversations = 0;
          const spacesWithData: string[] = [];

          for (const space of spaces) {
            const memoryCount = await client.memory.count({
              memorySpaceId: space.memorySpaceId,
              userId,
            });
            if (memoryCount > 0) {
              totalMemories += memoryCount;
              spacesWithData.push(space.memorySpaceId);
            }

            // Try to count conversations (may not have userId filter)
            try {
              const conversations = await client.conversations.list({
                memorySpaceId: space.memorySpaceId,
                userId,
                limit: 1000,
              });
              totalConversations += conversations.length;
            } catch {
              // Skip if conversations don't support userId filter
            }
          }

          spinner.stop();

          const stats = {
            userId,
            profileVersions: history.length,
            totalMemories,
            totalConversations,
            memorySpaces: spacesWithData.length,
            spacesWithData,
            profileCreated: formatTimestamp(user.createdAt),
            lastUpdated: formatTimestamp(user.updatedAt),
          };

          if (format === "json") {
            console.log(formatOutput(stats, "json"));
          } else {
            printSection(`User Statistics: ${userId}`, {
              "Profile Versions": history.length,
              "Total Memories": totalMemories,
              "Total Conversations": totalConversations,
              "Memory Spaces with Data": spacesWithData.length,
              "Profile Created": formatTimestamp(user.createdAt),
              "Last Updated": formatTimestamp(user.updatedAt),
            });

            if (spacesWithData.length > 0) {
              console.log("\n  Spaces with user data:");
              for (const space of spacesWithData.slice(0, 5)) {
                console.log(`    • ${space}`);
              }
              if (spacesWithData.length > 5) {
                console.log(`    ... and ${spacesWithData.length - 5} more`);
              }
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

  // users update
  users
    .command("update <userId>")
    .description("Update user profile data")
    .option("-d, --data <json>", "JSON data to merge into profile")
    .option("-f, --file <path>", "JSON file with data to merge")
    .action(async (userId, options) => {
      const globalOpts = program.opts();

      try {
        validateUserId(userId);

        if (!options.data && !options.file) {
          printError("Either --data or --file is required");
          process.exit(1);
        }

        let data: Record<string, unknown>;
        if (options.file) {
          const { readFile } = await import("fs/promises");
          const content = await readFile(options.file, "utf-8");
          data = JSON.parse(content);
        } else {
          data = JSON.parse(options.data);
        }

        const spinner = ora("Updating user profile...").start();

        await withClient(config, globalOpts, async (client) => {
          const updated = await client.users.merge(userId, data);

          spinner.stop();
          printSuccess(
            `Updated user ${userId} (now version ${updated.version})`,
          );
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Update failed");
        process.exit(1);
      }
    });

  // users create
  users
    .command("create <userId>")
    .description("Create a new user profile")
    .option("-d, --data <json>", "JSON data for the profile", "{}")
    .action(async (userId, options) => {
      const globalOpts = program.opts();

      try {
        validateUserId(userId);

        const data = JSON.parse(options.data);

        const spinner = ora("Creating user profile...").start();

        await withClient(config, globalOpts, async (client) => {
          // Check if user exists
          const existing = await client.users.get(userId);
          if (existing) {
            spinner.stop();
            printError(`User ${userId} already exists`);
            process.exit(1);
          }

          const user = await client.users.update(userId, data);

          spinner.stop();
          printSuccess(`Created user ${userId}`);
          console.log(`  Version: ${user.version}`);
          console.log(`  Created: ${formatTimestamp(user.createdAt)}`);
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Create failed");
        process.exit(1);
      }
    });

  // users exists
  users
    .command("exists <userId>")
    .description("Check if a user exists")
    .action(async (userId) => {
      const globalOpts = program.opts();

      try {
        validateUserId(userId);

        await withClient(config, globalOpts, async (client) => {
          const exists = await client.users.exists(userId);

          if (exists) {
            printSuccess(`User ${userId} exists`);
          } else {
            printWarning(`User ${userId} does not exist`);
            process.exit(1);
          }
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Check failed");
        process.exit(1);
      }
    });
}
