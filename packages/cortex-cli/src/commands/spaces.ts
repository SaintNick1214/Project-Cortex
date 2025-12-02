/**
 * Memory Space Commands
 *
 * Commands for managing memory spaces:
 * - list: List memory spaces
 * - create: Create a new memory space
 * - delete: Delete a memory space
 * - archive: Archive a memory space
 * - stats: Get memory space statistics
 * - participants: Manage participants
 */

import { Command } from "commander";
import ora from "ora";
import type { CLIConfig, OutputFormat, MemorySpaceStatus } from "../types.js";
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
  validateMemorySpaceType,
  validateMemorySpaceStatus,
  validateLimit,
  requireConfirmation,
  requireExactConfirmation,
} from "../utils/validation.js";

/**
 * Register memory space commands
 */
export function registerSpaceCommands(
  program: Command,
  config: CLIConfig,
): void {
  const spaces = program.command("spaces").description("Manage memory spaces");

  // spaces list
  spaces
    .command("list")
    .description("List all memory spaces")
    .option(
      "-t, --type <type>",
      "Filter by type: personal, team, project, custom",
    )
    .option("-s, --status <status>", "Filter by status: active, archived")
    .option("-l, --limit <number>", "Maximum number of results", "100")
    .option("-f, --format <format>", "Output format: table, json, csv")
    .action(async (options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading memory spaces...").start();

      try {
        const filterType = options.type
          ? validateMemorySpaceType(options.type)
          : undefined;
        const filterStatus = options.status
          ? validateMemorySpaceStatus(options.status)
          : undefined;
        const limit = validateLimit(parseInt(options.limit, 10));

        await withClient(config, globalOpts, async (client) => {
          const spacesList = await client.memorySpaces.list({
            type: filterType,
            status: filterStatus,
            limit,
          });

          spinner.stop();

          if (spacesList.length === 0) {
            printWarning("No memory spaces found");
            return;
          }

          // Format spaces for display
          const displayData = spacesList.map((s) => ({
            id: s.memorySpaceId,
            name: s.name ?? "-",
            type: s.type,
            status: s.status,
            participants: s.participants?.length ?? 0,
            created: formatRelativeTime(s.createdAt),
          }));

          console.log(
            formatOutput(displayData, format, {
              title: "Memory Spaces",
              headers: [
                "id",
                "name",
                "type",
                "status",
                "participants",
                "created",
              ],
            }),
          );

          printSuccess(
            `Found ${formatCount(spacesList.length, "memory space")}`,
          );
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to list spaces",
        );
        process.exit(1);
      }
    });

  // spaces create
  spaces
    .command("create <spaceId>")
    .description("Create a new memory space")
    .requiredOption(
      "-t, --type <type>",
      "Space type: personal, team, project, custom",
    )
    .option("-n, --name <name>", "Human-readable name")
    .option("-m, --metadata <json>", "JSON metadata", "{}")
    .action(async (spaceId, options) => {
      const globalOpts = program.opts();

      const spinner = ora("Creating memory space...").start();

      try {
        validateMemorySpaceId(spaceId);
        const spaceType = validateMemorySpaceType(options.type);
        const metadata = JSON.parse(options.metadata);

        await withClient(config, globalOpts, async (client) => {
          // Check if space already exists
          const existing = await client.memorySpaces.get(spaceId);
          if (existing) {
            spinner.stop();
            printError(`Memory space ${spaceId} already exists`);
            process.exit(1);
          }

          const space = await client.memorySpaces.register({
            memorySpaceId: spaceId,
            name: options.name,
            type: spaceType,
            metadata,
          });

          spinner.stop();
          printSuccess(`Created memory space ${spaceId}`);
          console.log(`  Type: ${space.type}`);
          console.log(`  Name: ${space.name ?? "-"}`);
          console.log(`  Created: ${formatTimestamp(space.createdAt)}`);
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Create failed");
        process.exit(1);
      }
    });

  // spaces get
  spaces
    .command("get <spaceId>")
    .description("Get memory space details")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (spaceId, options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading memory space...").start();

      try {
        validateMemorySpaceId(spaceId);

        await withClient(config, globalOpts, async (client) => {
          const space = await client.memorySpaces.get(spaceId);

          if (!space) {
            spinner.stop();
            printError(`Memory space ${spaceId} not found`);
            process.exit(1);
          }

          spinner.stop();

          if (format === "json") {
            console.log(formatOutput(space, "json"));
          } else {
            printSection(`Memory Space: ${spaceId}`, {
              ID: space.memorySpaceId,
              Name: space.name ?? "-",
              Type: space.type,
              Status: space.status,
              Participants: space.participants?.length ?? 0,
              Created: formatTimestamp(space.createdAt),
              Updated: formatTimestamp(space.updatedAt),
            });

            if (space.participants && space.participants.length > 0) {
              console.log("\n  Participants:");
              for (const p of space.participants) {
                console.log(
                  `    • ${p.id} (${p.type}) - joined ${formatRelativeTime(p.joinedAt)}`,
                );
              }
            }

            if (space.metadata && Object.keys(space.metadata).length > 0) {
              console.log("\n  Metadata:");
              for (const [key, value] of Object.entries(space.metadata)) {
                console.log(`    ${key}: ${JSON.stringify(value)}`);
              }
            }
          }
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to get space",
        );
        process.exit(1);
      }
    });

  // spaces delete (with cascade)
  spaces
    .command("delete <spaceId>")
    .description("Delete a memory space")
    .option(
      "--cascade",
      "Delete all data in the space (memories, facts, etc.)",
      false,
    )
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (spaceId, options) => {
      const globalOpts = program.opts();

      try {
        validateMemorySpaceId(spaceId);

        if (options.cascade && !options.yes) {
          console.log("\n⚠️  CASCADE DELETION");
          console.log(
            "This will permanently delete the memory space and ALL its data:",
          );
          console.log("  • All memories");
          console.log("  • All facts");
          console.log("  • All conversations");
          console.log("  • All contexts\n");

          const confirmed = await requireExactConfirmation(
            spaceId,
            `Type the space ID "${spaceId}" to confirm cascade deletion:`,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        } else if (!options.yes) {
          const confirmed = await requireConfirmation(
            `Delete memory space ${spaceId}?`,
            config,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora(
          options.cascade
            ? "Deleting memory space and all data..."
            : "Deleting memory space...",
        ).start();

        await withClient(config, globalOpts, async (client) => {
          const result = await client.memorySpaces.delete(spaceId, {
            cascade: options.cascade,
          });

          spinner.stop();

          if (result.deleted) {
            printSuccess(`Deleted memory space ${spaceId}`);
            if (result.cascaded) {
              printSuccess("All associated data was also deleted");
            }
          } else {
            printError("Memory space not found or could not be deleted");
          }
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Delete failed");
        process.exit(1);
      }
    });

  // spaces archive
  spaces
    .command("archive <spaceId>")
    .description("Archive a memory space (soft delete)")
    .option("-r, --reason <reason>", "Reason for archiving")
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (spaceId, options) => {
      const globalOpts = program.opts();

      try {
        validateMemorySpaceId(spaceId);

        if (!options.yes) {
          const confirmed = await requireConfirmation(
            `Archive memory space ${spaceId}?`,
            config,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora("Archiving memory space...").start();

        await withClient(config, globalOpts, async (client) => {
          const space = await client.memorySpaces.archive(spaceId, {
            reason: options.reason,
          });

          spinner.stop();
          printSuccess(`Archived memory space ${spaceId}`);
          console.log(`  Status: ${space.status}`);
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Archive failed");
        process.exit(1);
      }
    });

  // spaces reactivate
  spaces
    .command("reactivate <spaceId>")
    .description("Reactivate an archived memory space")
    .action(async (spaceId) => {
      const globalOpts = program.opts();

      const spinner = ora("Reactivating memory space...").start();

      try {
        validateMemorySpaceId(spaceId);

        await withClient(config, globalOpts, async (client) => {
          const space = await client.memorySpaces.reactivate(spaceId);

          spinner.stop();
          printSuccess(`Reactivated memory space ${spaceId}`);
          console.log(`  Status: ${space.status}`);
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Reactivate failed",
        );
        process.exit(1);
      }
    });

  // spaces stats
  spaces
    .command("stats <spaceId>")
    .description("Get statistics for a memory space")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (spaceId, options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading statistics...").start();

      try {
        validateMemorySpaceId(spaceId);

        await withClient(config, globalOpts, async (client) => {
          const stats = await client.memorySpaces.getStats(spaceId);

          spinner.stop();

          if (format === "json") {
            console.log(formatOutput(stats, "json"));
          } else {
            printSection(`Statistics for ${spaceId}`, {
              Conversations: stats.totalConversations,
              Memories: stats.totalMemories,
              Facts: stats.totalFacts,
              "Total Messages": stats.totalMessages,
              Participants: stats.participants?.length ?? 0,
              "Top Tags":
                stats.topTags.length > 0
                  ? stats.topTags.slice(0, 5).join(", ")
                  : "-",
            });
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

  // spaces participants
  spaces
    .command("participants <spaceId>")
    .description("List participants in a memory space")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (spaceId, options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading participants...").start();

      try {
        validateMemorySpaceId(spaceId);

        await withClient(config, globalOpts, async (client) => {
          const space = await client.memorySpaces.get(spaceId);

          if (!space) {
            spinner.stop();
            printError(`Memory space ${spaceId} not found`);
            process.exit(1);
          }

          spinner.stop();

          const participants = space.participants ?? [];

          if (participants.length === 0) {
            printWarning("No participants in this space");
            return;
          }

          const displayData = participants.map((p) => ({
            id: p.id,
            type: p.type,
            joined: formatRelativeTime(p.joinedAt),
          }));

          console.log(
            formatOutput(displayData, format, {
              title: `Participants in ${spaceId}`,
              headers: ["id", "type", "joined"],
            }),
          );

          printSuccess(`${formatCount(participants.length, "participant")}`);
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error
            ? error.message
            : "Failed to list participants",
        );
        process.exit(1);
      }
    });

  // spaces add-participant
  spaces
    .command("add-participant <spaceId>")
    .description("Add a participant to a memory space")
    .requiredOption("-i, --id <participantId>", "Participant ID")
    .requiredOption(
      "-t, --type <type>",
      "Participant type (e.g., user, ai-tool, ai-agent)",
    )
    .action(async (spaceId, options) => {
      const globalOpts = program.opts();

      const spinner = ora("Adding participant...").start();

      try {
        validateMemorySpaceId(spaceId);

        await withClient(config, globalOpts, async (client) => {
          const space = await client.memorySpaces.addParticipant(spaceId, {
            id: options.id,
            type: options.type,
            joinedAt: Date.now(),
          });

          spinner.stop();
          printSuccess(`Added participant ${options.id} to ${spaceId}`);
          console.log(
            `  Total participants: ${space.participants?.length ?? 0}`,
          );
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to add participant",
        );
        process.exit(1);
      }
    });

  // spaces remove-participant
  spaces
    .command("remove-participant <spaceId>")
    .description("Remove a participant from a memory space")
    .requiredOption("-i, --id <participantId>", "Participant ID to remove")
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (spaceId, options) => {
      const globalOpts = program.opts();

      try {
        validateMemorySpaceId(spaceId);

        if (!options.yes) {
          const confirmed = await requireConfirmation(
            `Remove participant ${options.id} from ${spaceId}?`,
            config,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora("Removing participant...").start();

        await withClient(config, globalOpts, async (client) => {
          const space = await client.memorySpaces.removeParticipant(
            spaceId,
            options.id,
          );

          spinner.stop();
          printSuccess(`Removed participant ${options.id} from ${spaceId}`);
          console.log(
            `  Remaining participants: ${space.participants?.length ?? 0}`,
          );
        });
      } catch (error) {
        printError(
          error instanceof Error
            ? error.message
            : "Failed to remove participant",
        );
        process.exit(1);
      }
    });

  // spaces update
  spaces
    .command("update <spaceId>")
    .description("Update a memory space")
    .option("-n, --name <name>", "New name")
    .option("-s, --status <status>", "New status: active, archived")
    .option("-m, --metadata <json>", "JSON metadata to merge")
    .action(async (spaceId, options) => {
      const globalOpts = program.opts();

      try {
        validateMemorySpaceId(spaceId);

        if (!options.name && !options.status && !options.metadata) {
          printError(
            "At least one of --name, --status, or --metadata is required",
          );
          process.exit(1);
        }

        const updates: {
          name?: string;
          status?: MemorySpaceStatus;
          metadata?: Record<string, unknown>;
        } = {};

        if (options.name) {
          updates.name = options.name;
        }
        if (options.status) {
          updates.status = validateMemorySpaceStatus(options.status);
        }
        if (options.metadata) {
          updates.metadata = JSON.parse(options.metadata);
        }

        const spinner = ora("Updating memory space...").start();

        await withClient(config, globalOpts, async (client) => {
          const space = await client.memorySpaces.update(spaceId, updates);

          spinner.stop();
          printSuccess(`Updated memory space ${spaceId}`);
          if (updates.name) console.log(`  Name: ${space.name}`);
          if (updates.status) console.log(`  Status: ${space.status}`);
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Update failed");
        process.exit(1);
      }
    });

  // spaces count
  spaces
    .command("count")
    .description("Count memory spaces")
    .option("-t, --type <type>", "Filter by type")
    .option("-s, --status <status>", "Filter by status")
    .action(async (options) => {
      const globalOpts = program.opts();

      const spinner = ora("Counting memory spaces...").start();

      try {
        const filterType = options.type
          ? validateMemorySpaceType(options.type)
          : undefined;
        const filterStatus = options.status
          ? validateMemorySpaceStatus(options.status)
          : undefined;

        await withClient(config, globalOpts, async (client) => {
          const count = await client.memorySpaces.count({
            type: filterType,
            status: filterStatus,
          });

          spinner.stop();
          printSuccess(`${formatCount(count, "memory space")}`);
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Count failed");
        process.exit(1);
      }
    });

  // spaces search
  spaces
    .command("search <query>")
    .description("Search memory spaces by name")
    .option("-t, --type <type>", "Filter by type")
    .option("-s, --status <status>", "Filter by status")
    .option("-l, --limit <number>", "Maximum results", "20")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (query, options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Searching memory spaces...").start();

      try {
        const filterType = options.type
          ? validateMemorySpaceType(options.type)
          : undefined;
        const filterStatus = options.status
          ? validateMemorySpaceStatus(options.status)
          : undefined;
        const limit = validateLimit(parseInt(options.limit, 10));

        await withClient(config, globalOpts, async (client) => {
          const results = await client.memorySpaces.search(query, {
            type: filterType,
            status: filterStatus,
            limit,
          });

          spinner.stop();

          if (results.length === 0) {
            printWarning("No memory spaces found matching your query");
            return;
          }

          const displayData = results.map((s) => ({
            id: s.memorySpaceId,
            name: s.name ?? "-",
            type: s.type,
            status: s.status,
          }));

          console.log(
            formatOutput(displayData, format, {
              title: `Search results for "${query}"`,
              headers: ["id", "name", "type", "status"],
            }),
          );

          printSuccess(`Found ${formatCount(results.length, "space")}`);
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Search failed");
        process.exit(1);
      }
    });
}
