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
import type {
  CLIConfig,
  OutputFormat,
  DatabaseStats,
  BackupData,
} from "../types.js";
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
import prompts from "prompts";
import { listDeployments } from "../utils/config.js";

const MAX_LIMIT = 1000;

/**
 * Paginate through all results using cursor-based pagination
 */
async function paginateAll<T>(
  fetchFn: (cursor?: string) => Promise<{ data: T[]; cursor?: string }>,
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetchFn(cursor);
    results.push(...response.data);
    cursor = response.cursor;
  } while (cursor);

  return results;
}

/**
 * Fetch all items using simple limit-based pagination (no cursor)
 */
async function fetchAllWithLimit<T>(
  fetchFn: (limit: number) => Promise<T[]>,
  batchSize: number = MAX_LIMIT,
): Promise<T[]> {
  // For APIs without cursor pagination, just fetch max allowed
  return await fetchFn(batchSize);
}

/**
 * Select a database deployment interactively or from options
 * Returns updated globalOpts with the selected deployment
 */
async function selectDatabase(
  config: CLIConfig,
  globalOpts: Record<string, unknown>,
  actionDescription: string,
): Promise<{
  globalOpts: Record<string, unknown>;
  targetName: string;
  targetUrl: string;
} | null> {
  const deployments = listDeployments(config);

  if (deployments.length === 0) {
    printError("No deployments configured. Run 'cortex setup' first.");
    return null;
  }

  // Determine target deployment
  let targetDeployment = deployments.find((d) => d.isDefault);
  let targetUrl = targetDeployment?.url ?? "";
  let targetName = targetDeployment?.name ?? config.default;

  // If --deployment flag was passed, use that
  if (globalOpts.deployment) {
    const specified = deployments.find(
      (d) => d.name === globalOpts.deployment,
    );
    if (specified) {
      targetDeployment = specified;
      targetUrl = specified.url;
      targetName = specified.name;
    } else {
      printError(`Deployment "${globalOpts.deployment}" not found`);
      return null;
    }
  }

  // If multiple deployments and none specified, ask which one
  if (deployments.length > 1 && !globalOpts.deployment) {
    console.log();
    console.log(
      `Current target: ${pc.cyan(targetName)} (${pc.dim(targetUrl)})`,
    );
    console.log();

    const selectResponse = await prompts({
      type: "select",
      name: "deployment",
      message: `Select database to ${actionDescription}:`,
      choices: deployments.map((d) => ({
        title: d.isDefault ? `${d.name} (default)` : d.name,
        description: d.url,
        value: d.name,
      })),
      initial: deployments.findIndex((d) => d.name === targetName),
    });

    if (!selectResponse.deployment) {
      printWarning("Operation cancelled");
      return null;
    }

    targetName = selectResponse.deployment;
    const selected = deployments.find((d) => d.name === targetName);
    targetUrl = selected?.url ?? "";

    // Update globalOpts to use selected deployment
    globalOpts = { ...globalOpts, deployment: targetName };
  }

  return { globalOpts, targetName, targetUrl };
}

/**
 * Register database commands
 */
export function registerDbCommands(program: Command, config: CLIConfig): void {
  const db = program.command("db").description("Database-wide operations");

  // db stats
  db.command("stats")
    .description("Show database statistics")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (options) => {
      let globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      try {
        // Select database
        const selection = await selectDatabase(config, globalOpts, "view stats for");
        if (!selection) return;
        globalOpts = selection.globalOpts;
        const { targetName, targetUrl } = selection;

        const spinner = ora(`Loading statistics for ${targetName}...`).start();

        await withClient(config, globalOpts, async (client) => {
          // Get deployment info
          const info = { url: targetUrl, isLocal: targetUrl.includes("127.0.0.1") || targetUrl.includes("localhost") };
          const rawClient = client.getClient();

          // Get comprehensive counts from all tables using admin function
          spinner.text = "Counting all tables...";
          let tableCounts: Record<string, number> = {};
          try {
            tableCounts = await rawClient.query(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              "admin:getAllCounts" as any,
              {},
            );
          } catch {
            // Fall back to individual counts if admin function not available
            tableCounts = {
              agents: 0,
              contexts: 0,
              conversations: 0,
              facts: 0,
              governanceEnforcement: 0,
              governancePolicies: 0,
              graphSyncQueue: 0,
              immutable: 0,
              memories: 0,
              memorySpaces: 0,
              mutable: 0,
            };
          }

          // Get user count from SDK (users may be managed separately)
          let usersCount = 0;
          try {
            usersCount = await client.users.count();
          } catch {
            // Users API may not be available
          }

          // Count messages in conversations
          spinner.text = "Counting messages...";
          let totalMessages = 0;
          try {
            const convos = await client.conversations.list({ limit: MAX_LIMIT });
            for (const convo of convos) {
              totalMessages += convo.messageCount ?? 0;
            }
          } catch {
            // Skip if not available
          }

          spinner.stop();

          const stats: DatabaseStats = {
            memorySpaces: tableCounts.memorySpaces ?? 0,
            conversations: tableCounts.conversations ?? 0,
            memories: tableCounts.memories ?? 0,
            facts: tableCounts.facts ?? 0,
            users: usersCount,
            immutableRecords: tableCounts.immutable ?? 0,
            mutableRecords: tableCounts.mutable ?? 0,
            contexts: tableCounts.contexts ?? 0,
          };

          if (format === "json") {
            console.log(
              formatOutput(
                {
                  ...stats,
                  agents: tableCounts.agents ?? 0,
                  messages: totalMessages,
                  governancePolicies: tableCounts.governancePolicies ?? 0,
                  governanceEnforcement: tableCounts.governanceEnforcement ?? 0,
                  graphSyncQueue: tableCounts.graphSyncQueue ?? 0,
                  deployment: {
                    name:
                      globalOpts.deployment ?? config.default ?? "default",
                    url: info.url,
                    isLocal: info.isLocal,
                  },
                },
                "json",
              ),
            );
          } else {
            console.log();
            console.log(
              pc.bold(
                `📊 Database Statistics: ${pc.cyan(targetName)}`,
              ),
            );
            console.log(pc.dim("─".repeat(45)));
            console.log();

            // Core entities
            console.log(pc.bold("  Core Entities"));
            console.log(
              `    Memory Spaces:    ${pc.yellow(String(stats.memorySpaces))}`,
            );
            console.log(
              `    Users:            ${pc.yellow(String(stats.users))}`,
            );
            console.log(
              `    Agents:           ${pc.yellow(String(tableCounts.agents ?? 0))}`,
            );
            console.log();

            // Memory data
            console.log(pc.bold("  Memory Data"));
            console.log(
              `    Memories:         ${pc.yellow(String(stats.memories))}`,
            );
            console.log(
              `    Facts:            ${pc.yellow(String(stats.facts))}`,
            );
            console.log(
              `    Contexts:         ${pc.yellow(String(stats.contexts))}`,
            );
            console.log();

            // Conversation data
            console.log(pc.bold("  Conversations"));
            console.log(
              `    Conversations:    ${pc.yellow(String(stats.conversations))}`,
            );
            console.log(
              `    Messages:         ${pc.yellow(String(totalMessages))}`,
            );
            console.log();

            // Shared stores
            console.log(pc.bold("  Shared Stores"));
            console.log(
              `    Immutable:        ${pc.yellow(String(stats.immutableRecords))}`,
            );
            console.log(
              `    Mutable:          ${pc.yellow(String(stats.mutableRecords))}`,
            );
            console.log();

            // System tables
            console.log(pc.bold("  System Tables"));
            console.log(
              `    Gov. Policies:    ${pc.yellow(String(tableCounts.governancePolicies ?? 0))}`,
            );
            console.log(
              `    Gov. Logs:        ${pc.yellow(String(tableCounts.governanceEnforcement ?? 0))}`,
            );
            console.log(
              `    Graph Sync Queue: ${pc.yellow(String(tableCounts.graphSyncQueue ?? 0))}`,
            );
            console.log();

            // Deployment info
            console.log(pc.bold("  Deployment"));
            console.log(`    URL:              ${pc.dim(info.url)}`);
            console.log(
              `    Mode:             ${info.isLocal ? pc.green("Local") : pc.blue("Cloud")}`,
            );
            console.log();
          }
        });
      } catch (error) {
        printError(
          error instanceof Error ? error.message : "Failed to load statistics",
        );
        process.exit(1);
      }
    });

  // db clear
  db.command("clear")
    .description("Clear entire database (DANGEROUS!)")
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (options) => {
      let globalOpts = program.opts();

      try {
        console.log();
        console.log(
          pc.red(pc.bold("⚠️  DANGER: Clear Database")),
        );

        // Select database
        const selection = await selectDatabase(config, globalOpts, "clear");
        if (!selection) return;
        globalOpts = selection.globalOpts;
        const { targetName, targetUrl } = selection;

        console.log();
        console.log("This will permanently delete:");
        console.log("  • All memory spaces and memories");
        console.log("  • All conversations and messages");
        console.log("  • All facts and user profiles");
        console.log();

        // Simple y/N confirmation
        if (!options.yes) {
          const confirmResponse = await prompts({
            type: "confirm",
            name: "confirmed",
            message: `Clear ALL data from ${pc.red(targetName)}?`,
            initial: false,
          });

          if (!confirmResponse.confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora(`Clearing ${targetName}...`).start();

        await withClient(config, globalOpts, async (client) => {
          const deleted = {
            agents: 0,
            contexts: 0,
            conversations: 0,
            messages: 0,
            facts: 0,
            memories: 0,
            memorySpaces: 0,
            immutable: 0,
            mutable: 0,
            users: 0,
            governancePolicies: 0,
            governanceEnforcement: 0,
            graphSyncQueue: 0,
          };

          // Get raw Convex client for direct table access via admin functions
          const rawClient = client.getClient();

          // Helper to clear a table using the admin:clearTable mutation
          const clearTableDirect = async (
            tableName: string,
            counter: keyof typeof deleted,
          ) => {
            let hasMore = true;
            while (hasMore) {
              spinner.text = `Clearing ${tableName}... (${deleted[counter]} deleted)`;
              try {
                const result = await rawClient.mutation(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  "admin:clearTable" as any,
                  { table: tableName, limit: MAX_LIMIT },
                );
                deleted[counter] += result.deleted;
                hasMore = result.hasMore;
              } catch {
                hasMore = false;
              }
            }
          };

          // 1. Clear agents (using SDK for proper unregister)
          let hasMoreAgents = true;
          while (hasMoreAgents) {
            spinner.text = `Clearing agents... (${deleted.agents} deleted)`;
            try {
              const agents = await client.agents.list({ limit: MAX_LIMIT });
              if (agents.length === 0) {
                hasMoreAgents = false;
                break;
              }
              for (const agent of agents) {
                try {
                  await client.agents.unregister(agent.id, { cascade: false });
                  deleted.agents++;
                } catch {
                  // Continue on error
                }
              }
              if (agents.length < MAX_LIMIT) {
                hasMoreAgents = false;
              }
            } catch {
              // Fall back to direct table clear if SDK fails
              await clearTableDirect("agents", "agents");
              hasMoreAgents = false;
            }
          }

          // 2. Clear contexts (using SDK for cascade)
          let hasMoreContexts = true;
          while (hasMoreContexts) {
            spinner.text = `Clearing contexts... (${deleted.contexts} deleted)`;
            try {
              const contexts = await client.contexts.list({ limit: MAX_LIMIT });
              if (contexts.length === 0) {
                hasMoreContexts = false;
                break;
              }
              for (const ctx of contexts) {
                try {
                  await client.contexts.delete(ctx.contextId, {
                    cascadeChildren: true,
                  });
                  deleted.contexts++;
                } catch {
                  // Continue on error
                }
              }
              if (contexts.length < MAX_LIMIT) {
                hasMoreContexts = false;
              }
            } catch {
              await clearTableDirect("contexts", "contexts");
              hasMoreContexts = false;
            }
          }

          // 3. Clear conversations (count messages)
          let hasMoreConvos = true;
          while (hasMoreConvos) {
            spinner.text = `Clearing conversations... (${deleted.conversations} deleted, ${deleted.messages} messages)`;
            try {
              const convos = await client.conversations.list({ limit: MAX_LIMIT });
              if (convos.length === 0) {
                hasMoreConvos = false;
                break;
              }
              for (const convo of convos) {
                try {
                  deleted.messages += convo.messageCount || 0;
                  await client.conversations.delete(convo.conversationId);
                  deleted.conversations++;
                } catch {
                  // Continue on error
                }
              }
              if (convos.length < MAX_LIMIT) {
                hasMoreConvos = false;
              }
            } catch {
              await clearTableDirect("conversations", "conversations");
              hasMoreConvos = false;
            }
          }

          // 4. Clear facts (direct table clear)
          await clearTableDirect("facts", "facts");

          // 5. Clear memories (direct table clear)
          await clearTableDirect("memories", "memories");

          // 6. Clear memory spaces (using raw client for invalid IDs)
          let hasMoreSpaces = true;
          while (hasMoreSpaces) {
            spinner.text = `Clearing memorySpaces... (${deleted.memorySpaces} deleted)`;
            try {
              const spaces = await client.memorySpaces.list({ limit: MAX_LIMIT });
              if (spaces.length === 0) {
                hasMoreSpaces = false;
                break;
              }
              for (const space of spaces) {
                try {
                  await rawClient.mutation(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    "memorySpaces:deleteSpace" as any,
                    { memorySpaceId: space.memorySpaceId, cascade: true },
                  );
                  deleted.memorySpaces++;
                } catch {
                  // Continue on error
                }
              }
              if (spaces.length < MAX_LIMIT) {
                hasMoreSpaces = false;
              }
            } catch {
              await clearTableDirect("memorySpaces", "memorySpaces");
              hasMoreSpaces = false;
            }
          }

          // 7. Clear immutable (using SDK)
          let hasMoreImmutable = true;
          while (hasMoreImmutable) {
            spinner.text = `Clearing immutable... (${deleted.immutable} deleted)`;
            try {
              const records = await client.immutable.list({ limit: MAX_LIMIT });
              if (records.length === 0) {
                hasMoreImmutable = false;
                break;
              }
              for (const record of records) {
                try {
                  await client.immutable.purge(record.type, record.id);
                  deleted.immutable++;
                } catch {
                  // Continue on error
                }
              }
              if (records.length < MAX_LIMIT) {
                hasMoreImmutable = false;
              }
            } catch {
              await clearTableDirect("immutable", "immutable");
              hasMoreImmutable = false;
            }
          }

          // 8. Clear mutable (direct table clear)
          await clearTableDirect("mutable", "mutable");

          // 9. Clear users (using SDK for cascade - users table is virtual/SDK-managed)
          let hasMoreUsers = true;
          while (hasMoreUsers) {
            spinner.text = `Clearing users... (${deleted.users} deleted)`;
            try {
              const users = await client.users.list({ limit: MAX_LIMIT });
              if (users.length === 0) {
                hasMoreUsers = false;
                break;
              }
              for (const user of users) {
                try {
                  await client.users.delete(user.id, { cascade: true });
                  deleted.users++;
                } catch {
                  // Continue on error
                }
              }
              if (users.length < MAX_LIMIT) {
                hasMoreUsers = false;
              }
            } catch {
              hasMoreUsers = false;
            }
          }

          // 10. Clear governance policies
          await clearTableDirect("governancePolicies", "governancePolicies");

          // 11. Clear governance enforcement logs
          await clearTableDirect("governanceEnforcement", "governanceEnforcement");

          // 12. Clear graph sync queue
          await clearTableDirect("graphSyncQueue", "graphSyncQueue");

          spinner.stop();

          printSuccess(`Database "${targetName}" cleared`);
          console.log();
          printSection("Deletion Summary", {
            Database: targetName,
            URL: targetUrl,
          });
          console.log();

          // Show counts with categories
          const coreEntities = {
            Agents: deleted.agents,
            Users: deleted.users,
            "Memory Spaces": deleted.memorySpaces,
          };
          const memoryData = {
            Memories: deleted.memories,
            Facts: deleted.facts,
            Contexts: deleted.contexts,
          };
          const conversationData = {
            Conversations: deleted.conversations,
            Messages: deleted.messages,
          };
          const sharedStores = {
            Immutable: deleted.immutable,
            Mutable: deleted.mutable,
          };
          const systemTables = {
            "Governance Policies": deleted.governancePolicies,
            "Governance Logs": deleted.governanceEnforcement,
            "Graph Sync Queue": deleted.graphSyncQueue,
          };

          printSection("Core Entities", coreEntities);
          printSection("Memory Data", memoryData);
          printSection("Conversations", conversationData);
          printSection("Shared Stores", sharedStores);
          printSection("System Tables", systemTables);
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
      let globalOpts = program.opts();

      try {
        validateFilePath(options.output);

        // Select database
        const selection = await selectDatabase(config, globalOpts, "backup");
        if (!selection) return;
        globalOpts = selection.globalOpts;
        const { targetName, targetUrl } = selection;

        const spinner = ora(`Creating backup of ${targetName}...`).start();

        await withClient(config, globalOpts, async (client) => {
          const backup: BackupData = {
            version: "1.0",
            timestamp: Date.now(),
            deployment: targetUrl,
            data: {},
          };

          // Backup memory spaces (paginate if needed)
          spinner.text = "Backing up memory spaces...";
          backup.data.memorySpaces = await client.memorySpaces.list({
            limit: MAX_LIMIT,
          });

          // Backup users (paginate if needed)
          spinner.text = "Backing up users...";
          backup.data.users = await client.users.list({ limit: MAX_LIMIT });

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
                limit: MAX_LIMIT,
              });
              (backup.data.conversations as unknown[]).push(...convs);
            }

            // Backup memories
            spinner.text = "Backing up memories...";
            backup.data.memories = [];
            for (const space of spaces) {
              const memories = await client.memory.list({
                memorySpaceId: space.memorySpaceId,
                limit: MAX_LIMIT,
              });
              (backup.data.memories as unknown[]).push(...memories);
            }

            // Backup facts
            spinner.text = "Backing up facts...";
            backup.data.facts = [];
            for (const space of spaces) {
              const facts = await client.facts.list({
                memorySpaceId: space.memorySpaceId,
                limit: MAX_LIMIT,
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
            Timestamp: formatTimestamp(backup.timestamp),
            "Memory Spaces":
              (backup.data.memorySpaces as unknown[])?.length ?? 0,
            Users: (backup.data.users as unknown[])?.length ?? 0,
            Conversations: options.includeAll
              ? ((backup.data.conversations as unknown[])?.length ?? 0)
              : "Not included",
            Memories: options.includeAll
              ? ((backup.data.memories as unknown[])?.length ?? 0)
              : "Not included",
            Facts: options.includeAll
              ? ((backup.data.facts as unknown[])?.length ?? 0)
              : "Not included",
          });
        });
      } catch (error) {
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
      let globalOpts = program.opts();

      try {
        validateFilePath(options.input);

        // Read backup file first to show info before selecting target
        const content = await readFile(options.input, "utf-8");
        const backup = JSON.parse(content) as BackupData;

        // Validate backup format
        if (!backup.version || !backup.timestamp || !backup.data) {
          printError("Invalid backup file format");
          process.exit(1);
        }

        console.log();
        printSection("Backup Information", {
          Version: backup.version,
          Created: formatTimestamp(backup.timestamp),
          Source: backup.deployment,
          "Memory Spaces": (backup.data.memorySpaces as unknown[])?.length ?? 0,
          Users: (backup.data.users as unknown[])?.length ?? 0,
          Conversations:
            (backup.data.conversations as unknown[])?.length ?? "N/A",
          Memories: (backup.data.memories as unknown[])?.length ?? "N/A",
          Facts: (backup.data.facts as unknown[])?.length ?? "N/A",
        });

        if (options.dryRun) {
          printWarning("DRY RUN - No data will be restored");
          return;
        }

        // Select target database
        const selection = await selectDatabase(config, globalOpts, "restore to");
        if (!selection) return;
        globalOpts = selection.globalOpts;
        const { targetName } = selection;

        if (!options.yes) {
          const confirmed = await requireConfirmation(
            `Restore this backup to ${targetName}? Existing data may be overwritten.`,
            config,
          );
          if (!confirmed) {
            printWarning("Restore cancelled");
            return;
          }
        }

        const spinner = ora(`Restoring backup to ${targetName}...`).start();

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
            Users: restored.users,
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
      let globalOpts = program.opts();

      try {
        validateFilePath(options.output);

        // Select database
        const selection = await selectDatabase(config, globalOpts, "export");
        if (!selection) return;
        globalOpts = selection.globalOpts;
        const { targetName, targetUrl } = selection;

        const spinner = ora(`Exporting data from ${targetName}...`).start();

        await withClient(config, globalOpts, async (client) => {
          const exportData = {
            exportedAt: Date.now(),
            deployment: { name: targetName, url: targetUrl },
            memorySpaces: await client.memorySpaces.list({ limit: MAX_LIMIT }),
            users: await client.users.list({ limit: MAX_LIMIT }),
          };

          const content = JSON.stringify(exportData, null, 2);
          await writeFile(options.output, content, "utf-8");

          spinner.stop();
          printSuccess(`Exported data to ${options.output}`);
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Export failed");
        process.exit(1);
      }
    });
}
