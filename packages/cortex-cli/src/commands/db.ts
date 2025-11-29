/**
 * Database Commands
 *
 * Commands for database-wide operations:
 * - stats: Show database statistics
 * - clear: Clear entire database
 * - backup: Backup database
 * - restore: Restore from backup
 */

import { Command } from "commander";
import ora from "ora";
import type { CLIConfig, OutputFormat, DatabaseStats, BackupData } from "../types.js";
import { withClient } from "../utils/client.js";
import { resolveConfig } from "../utils/config.js";
import {
  formatOutput,
  printSuccess,
  printError,
  printWarning,
  printSection,
  formatTimestamp,
  formatBytes,
} from "../utils/formatting.js";
import {
  validateFilePath,
  requireConfirmation,
  requireExactConfirmation,
} from "../utils/validation.js";
import { writeFile, readFile } from "fs/promises";
import pc from "picocolors";

/**
 * Register database commands
 */
export function registerDbCommands(program: Command, config: CLIConfig): void {
  const db = program
    .command("db")
    .description("Database-wide operations");

  // db stats
  db.command("stats")
    .description("Show database statistics")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading database statistics...").start();

      try {
        await withClient(config, globalOpts, async (client) => {
          // Get counts from all tables
          const [
            spacesCount,
            usersCount,
          ] = await Promise.all([
            client.memorySpaces.count(),
            client.users.count(),
          ]);

          // Get space-level statistics
          const spaces = await client.memorySpaces.list({ limit: 1000 });

          let totalMemories = 0;
          let totalConversations = 0;
          let totalFacts = 0;

          for (const space of spaces) {
            try {
              const stats = await client.memorySpaces.getStats(space.memorySpaceId);
              totalMemories += stats.totalMemories;
              totalConversations += stats.totalConversations;
              totalFacts += stats.totalFacts;
            } catch {
              // Skip if stats not available
            }
          }

          spinner.stop();

          const stats: DatabaseStats = {
            memorySpaces: spacesCount,
            conversations: totalConversations,
            memories: totalMemories,
            facts: totalFacts,
            users: usersCount,
            immutableRecords: 0, // Would need separate query
            mutableRecords: 0, // Would need separate query
            contexts: 0, // Would need separate query
          };

          if (format === "json") {
            console.log(formatOutput(stats, "json"));
          } else {
            console.log();
            printSection("Database Statistics", {
              "Memory Spaces": stats.memorySpaces,
              "Total Memories": stats.memories,
              "Total Conversations": stats.conversations,
              "Total Facts": stats.facts,
              "User Profiles": stats.users,
            });

            // Show deployment info
            const info = (await import("../utils/client.js")).getDeploymentInfo(
              config,
              globalOpts,
            );
            console.log(`  ${pc.dim("Deployment:")} ${info.url}`);
            console.log(`  ${pc.dim("Mode:")} ${info.isLocal ? "Local" : "Cloud"}`);
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

  // db clear
  db.command("clear")
    .description("Clear entire database (DANGEROUS!)")
    .option(
      "--confirm <text>",
      'Confirmation text: "I understand this is irreversible"',
    )
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        // Require exact confirmation text
        const expectedText = "I understand this is irreversible";

        if (options.confirm !== expectedText) {
          console.log();
          console.log(
            pc.red(pc.bold("⚠️  DANGER: This will DELETE ALL DATA in the database!")),
          );
          console.log();
          console.log("This operation will permanently delete:");
          console.log("  • All memory spaces");
          console.log("  • All memories");
          console.log("  • All conversations");
          console.log("  • All facts");
          console.log("  • All user profiles");
          console.log("  • All immutable and mutable records");
          console.log("  • All contexts");
          console.log();
          console.log(pc.yellow("This cannot be undone!"));
          console.log();

          const confirmed = await requireExactConfirmation(
            expectedText,
            `To proceed, type exactly: "${expectedText}"`,
          );

          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora("Clearing database...").start();

        await withClient(config, globalOpts, async (client) => {
          // Delete all memory spaces (with cascade)
          const spaces = await client.memorySpaces.list({ limit: 10000 });
          let deletedSpaces = 0;

          for (const space of spaces) {
            try {
              await client.memorySpaces.delete(space.memorySpaceId, {
                cascade: true,
              });
              deletedSpaces++;
            } catch {
              // Continue on error
            }
          }

          // Delete all users
          const users = await client.users.list({ limit: 10000 });
          let deletedUsers = 0;

          for (const user of users) {
            try {
              await client.users.delete(user.id, { cascade: true });
              deletedUsers++;
            } catch {
              // Continue on error
            }
          }

          spinner.stop();

          printSuccess("Database cleared");
          printSection("Deletion Summary", {
            "Memory Spaces": deletedSpaces,
            "Users": deletedUsers,
          });
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Clear failed");
        process.exit(1);
      }
    });

  // db backup
  db.command("backup")
    .description("Backup database to a file")
    .option("-o, --output <file>", "Output file path", "cortex-backup.json")
    .option("--include-all", "Include all data (may be large)", false)
    .action(async (options) => {
      const globalOpts = program.opts();

      const spinner = ora("Creating backup...").start();

      try {
        validateFilePath(options.output);

        await withClient(config, globalOpts, async (client) => {
          const backup: BackupData = {
            version: "1.0",
            timestamp: Date.now(),
            deployment: resolveConfig(config, globalOpts).url,
            data: {},
          };

          // Backup memory spaces
          spinner.text = "Backing up memory spaces...";
          backup.data.memorySpaces = await client.memorySpaces.list({
            limit: 10000,
          });

          // Backup users
          spinner.text = "Backing up users...";
          backup.data.users = await client.users.list({ limit: 10000 });

          if (options.includeAll) {
            // Backup conversations
            spinner.text = "Backing up conversations...";
            const spaces = backup.data.memorySpaces as Array<{
              memorySpaceId: string;
            }>;
            backup.data.conversations = [];
            for (const space of spaces) {
              const convs = await client.conversations.list({
                memorySpaceId: space.memorySpaceId,
                limit: 10000,
              });
              (backup.data.conversations as unknown[]).push(...convs);
            }

            // Backup memories
            spinner.text = "Backing up memories...";
            backup.data.memories = [];
            for (const space of spaces) {
              const memories = await client.memory.list({
                memorySpaceId: space.memorySpaceId,
                limit: 10000,
              });
              (backup.data.memories as unknown[]).push(...memories);
            }

            // Backup facts
            spinner.text = "Backing up facts...";
            backup.data.facts = [];
            for (const space of spaces) {
              const facts = await client.facts.list({
                memorySpaceId: space.memorySpaceId,
                limit: 10000,
              });
              (backup.data.facts as unknown[]).push(...facts);
            }
          }

          // Write backup file
          spinner.text = "Writing backup file...";
          const content = JSON.stringify(backup, null, 2);
          await writeFile(options.output, content, "utf-8");

          spinner.stop();

          const size = Buffer.byteLength(content, "utf-8");
          printSuccess(`Backup created: ${options.output}`);
          printSection("Backup Summary", {
            "File Size": formatBytes(size),
            "Timestamp": formatTimestamp(backup.timestamp),
            "Memory Spaces": (backup.data.memorySpaces as unknown[])?.length ?? 0,
            "Users": (backup.data.users as unknown[])?.length ?? 0,
            "Conversations": options.includeAll
              ? (backup.data.conversations as unknown[])?.length ?? 0
              : "Not included",
            "Memories": options.includeAll
              ? (backup.data.memories as unknown[])?.length ?? 0
              : "Not included",
            "Facts": options.includeAll
              ? (backup.data.facts as unknown[])?.length ?? 0
              : "Not included",
          });
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Backup failed");
        process.exit(1);
      }
    });

  // db restore
  db.command("restore")
    .description("Restore database from a backup file")
    .requiredOption("-i, --input <file>", "Backup file path")
    .option("--dry-run", "Preview what would be restored", false)
    .option("-y, --yes", "Skip confirmation", false)
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        validateFilePath(options.input);

        // Read backup file
        const content = await readFile(options.input, "utf-8");
        const backup = JSON.parse(content) as BackupData;

        // Validate backup format
        if (!backup.version || !backup.timestamp || !backup.data) {
          printError("Invalid backup file format");
          process.exit(1);
        }

        console.log();
        printSection("Backup Information", {
          "Version": backup.version,
          "Created": formatTimestamp(backup.timestamp),
          "Source": backup.deployment,
          "Memory Spaces": (backup.data.memorySpaces as unknown[])?.length ?? 0,
          "Users": (backup.data.users as unknown[])?.length ?? 0,
          "Conversations": (backup.data.conversations as unknown[])?.length ?? "N/A",
          "Memories": (backup.data.memories as unknown[])?.length ?? "N/A",
          "Facts": (backup.data.facts as unknown[])?.length ?? "N/A",
        });

        if (options.dryRun) {
          printWarning("DRY RUN - No data will be restored");
          return;
        }

        if (!options.yes) {
          const confirmed = await requireConfirmation(
            "Restore this backup? Existing data may be overwritten.",
            config,
          );
          if (!confirmed) {
            printWarning("Restore cancelled");
            return;
          }
        }

        const spinner = ora("Restoring backup...").start();

        await withClient(config, globalOpts, async (client) => {
          let restored = {
            spaces: 0,
            users: 0,
            conversations: 0,
            memories: 0,
            facts: 0,
          };

          // Restore memory spaces
          if (backup.data.memorySpaces) {
            spinner.text = "Restoring memory spaces...";
            for (const space of backup.data.memorySpaces as Array<{
              memorySpaceId: string;
              name?: string;
              type: "personal" | "team" | "project" | "custom";
              metadata?: unknown;
            }>) {
              try {
                await client.memorySpaces.register({
                  memorySpaceId: space.memorySpaceId,
                  name: space.name,
                  type: space.type,
                  metadata: space.metadata as Record<string, unknown>,
                });
                restored.spaces++;
              } catch {
                // Skip if exists
              }
            }
          }

          // Restore users
          if (backup.data.users) {
            spinner.text = "Restoring users...";
            for (const user of backup.data.users as Array<{
              id: string;
              data: Record<string, unknown>;
            }>) {
              try {
                await client.users.update(user.id, user.data);
                restored.users++;
              } catch {
                // Skip if exists
              }
            }
          }

          spinner.stop();

          printSuccess("Restore complete");
          printSection("Restore Summary", {
            "Memory Spaces": restored.spaces,
            "Users": restored.users,
          });

          printWarning(
            "Note: Full data restore (conversations, memories, facts) requires --include-all in backup",
          );
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Restore failed");
        process.exit(1);
      }
    });

  // db export
  db.command("export")
    .description("Export all data to JSON")
    .option("-o, --output <file>", "Output file path", "cortex-export.json")
    .action(async (options) => {
      const globalOpts = program.opts();

      const spinner = ora("Exporting data...").start();

      try {
        validateFilePath(options.output);

        await withClient(config, globalOpts, async (client) => {
          const exportData = {
            exportedAt: Date.now(),
            memorySpaces: await client.memorySpaces.list({ limit: 10000 }),
            users: await client.users.list({ limit: 10000 }),
          };

          const content = JSON.stringify(exportData, null, 2);
          await writeFile(options.output, content, "utf-8");

          spinner.stop();
          printSuccess(`Exported data to ${options.output}`);
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Export failed");
        process.exit(1);
      }
    });
}
