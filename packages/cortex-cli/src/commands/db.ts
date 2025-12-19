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
import { resolveConfig, loadConfig } from "../utils/config.js";
import { selectDeployment } from "../utils/deployment-selector.js";
import {
  formatOutput,
  printSuccess,
  printError,
  printWarning,
  printSection,
  formatTimestamp,
  formatBytes,
} from "../utils/formatting.js";
import { validateFilePath, requireConfirmation } from "../utils/validation.js";
import { writeFile, readFile } from "fs/promises";
import pc from "picocolors";
import prompts from "prompts";

const MAX_LIMIT = 1000;

/**
 * Register database commands
 */
export function registerDbCommands(program: Command, _config: CLIConfig): void {
  const db = program.command("db").description("Database-wide operations");

  // db stats
  db.command("stats")
    .description("Show database statistics")
    .option("-d, --deployment <name>", "Target deployment")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "view stats");
      if (!selection) return;
      
      const { name: targetName, deployment } = selection;
      const targetUrl = deployment.url;
      const resolved = resolveConfig(currentConfig, { deployment: targetName });
      const format = (options.format ?? resolved.format) as OutputFormat;

      try {
        const spinner = ora(`Loading statistics for ${targetName}...`).start();

        await withClient(currentConfig, { deployment: targetName }, async (client) => {
          // Get deployment info
          const info = {
            url: targetUrl,
            isLocal:
              targetUrl.includes("127.0.0.1") ||
              targetUrl.includes("localhost"),
          };
          const rawClient = client.getClient();

          // Get comprehensive counts from all tables using admin function
          spinner.text = "Counting all tables...";
          let tableCounts: Record<string, number> = {};
          try {
            tableCounts = await rawClient.query(
              "admin:getAllCounts" as unknown as Parameters<
                typeof rawClient.query
              >[0],
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
            const convosResult = await client.conversations.list({
              limit: MAX_LIMIT,
            });
            for (const convo of convosResult.conversations) {
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
                    name: targetName,
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
              pc.bold(`📊 Database Statistics: ${pc.cyan(targetName)}`),
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
    .option("-d, --deployment <name>", "Target deployment")
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (options) => {
      const currentConfig = await loadConfig();
      
      console.log();
      console.log(pc.red(pc.bold("⚠️  DANGER: Clear Database")));

      const selection = await selectDeployment(currentConfig, options, "clear");
      if (!selection) return;
      
      const { name: targetName, deployment } = selection;
      const targetUrl = deployment.url;

      try {

        console.log();
        console.log("This will permanently delete:");
        console.log("  • All memory spaces and memories");
        console.log("  • All conversations and messages");
        console.log("  • All facts and user profiles");

        // Check if graph sync is enabled (same logic as Cortex.create())
        const neo4jUri = process.env.NEO4J_URI;
        const memgraphUri = process.env.MEMGRAPH_URI;
        const graphSyncEnabled =
          process.env.CORTEX_GRAPH_SYNC === "true" ||
          !!(neo4jUri || memgraphUri);

        // Debug: Show env var detection
        if (process.env.DEBUG || program.opts().debug) {
          console.log(
            pc.dim(
              `  [DEBUG] CORTEX_GRAPH_SYNC=${process.env.CORTEX_GRAPH_SYNC}`,
            ),
          );
          console.log(
            pc.dim(`  [DEBUG] NEO4J_URI=${neo4jUri ? "set" : "unset"}`),
          );
          console.log(
            pc.dim(`  [DEBUG] MEMGRAPH_URI=${memgraphUri ? "set" : "unset"}`),
          );
          console.log(pc.dim(`  [DEBUG] graphSyncEnabled=${graphSyncEnabled}`));
        }

        if (graphSyncEnabled) {
          const dbType = neo4jUri ? "Neo4j" : "Memgraph";
          console.log(
            `  • All graph database nodes and relationships (${dbType})`,
          );
        }
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

        await withClient(currentConfig, { deployment: targetName }, async (client) => {
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
                  "admin:clearTable" as unknown as Parameters<
                    typeof rawClient.mutation
                  >[0],
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
              const convosResult = await client.conversations.list({
                limit: MAX_LIMIT,
              });
              const convos = convosResult.conversations;
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
              const spacesResult = await client.memorySpaces.list({
                limit: MAX_LIMIT,
              });
              const spaces = spacesResult.spaces;
              if (spaces.length === 0) {
                hasMoreSpaces = false;
                break;
              }
              for (const space of spaces) {
                try {
                  await rawClient.mutation(
                    "memorySpaces:deleteSpace" as unknown as Parameters<
                      typeof rawClient.mutation
                    >[0],
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
              const usersResult = await client.users.list({ limit: MAX_LIMIT });
              const users = usersResult.users;
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
          await clearTableDirect(
            "governanceEnforcement",
            "governanceEnforcement",
          );

          // 12. Clear graph sync queue
          await clearTableDirect("graphSyncQueue", "graphSyncQueue");

          // 13. Clear graph database if graph sync is enabled
          // Check both explicit flag and auto-detection (same logic as Cortex.create())
          const neo4jUri = process.env.NEO4J_URI;
          const memgraphUri = process.env.MEMGRAPH_URI;
          const graphSyncEnabled =
            process.env.CORTEX_GRAPH_SYNC === "true" ||
            !!(neo4jUri || memgraphUri);

          if (graphSyncEnabled) {
            spinner.text = "Clearing graph database...";
            let graphCleared = false;

            try {
              if (neo4jUri || memgraphUri) {
                // Dynamically import neo4j-driver only when needed
                const neo4j = await import("neo4j-driver");

                // Determine which database to connect to
                const uri = neo4jUri || memgraphUri;
                const username = neo4jUri
                  ? process.env.NEO4J_USERNAME || "neo4j"
                  : process.env.MEMGRAPH_USERNAME || "memgraph";
                const password = neo4jUri
                  ? process.env.NEO4J_PASSWORD || ""
                  : process.env.MEMGRAPH_PASSWORD || "";

                // Connect to graph database
                const driver = neo4j.default.driver(
                  uri!,
                  neo4j.default.auth.basic(username, password),
                );

                // Verify connectivity
                await driver.verifyConnectivity();

                // Create session and clear all data
                const session = driver.session();
                try {
                  // DETACH DELETE removes nodes and all their relationships
                  // Works for both Neo4j and Memgraph
                  await session.run("MATCH (n) DETACH DELETE n");
                  graphCleared = true;
                } finally {
                  await session.close();
                }

                await driver.close();
              }
            } catch (error) {
              // Log warning but don't fail the entire operation
              const errorMsg =
                error instanceof Error ? error.message : "Unknown error";
              spinner.warn(
                pc.yellow(`Graph database clear failed: ${errorMsg}`),
              );
            }

            if (graphCleared) {
              // Only show success if we actually cleared
              deleted.graphSyncQueue = -1; // Use as flag to indicate graph was cleared
            }
          }

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
            "Graph Sync Queue":
              deleted.graphSyncQueue >= 0 ? deleted.graphSyncQueue : 0,
          };

          printSection("Core Entities", coreEntities);
          printSection("Memory Data", memoryData);
          printSection("Conversations", conversationData);
          printSection("Shared Stores", sharedStores);
          printSection("System Tables", systemTables);

          // Show graph database status if it was cleared
          if (deleted.graphSyncQueue === -1) {
            const dbType = process.env.NEO4J_URI ? "Neo4j" : "Memgraph";
            console.log();
            printSection("Graph Database", {
              [dbType]: pc.green("Cleared ✓"),
            });
          }
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Clear failed");
        process.exit(1);
      }
    });

  // db backup
  db.command("backup")
    .description("Backup database to a file")
    .option("-d, --deployment <name>", "Target deployment")
    .option("-o, --output <file>", "Output file path", "cortex-backup.json")
    .option("--include-all", "Include all data (may be large)", false)
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "backup");
      if (!selection) return;
      
      const { name: targetName, deployment } = selection;
      const targetUrl = deployment.url;

      try {
        validateFilePath(options.output);

        const spinner = ora(`Creating backup of ${targetName}...`).start();

        await withClient(currentConfig, { deployment: targetName }, async (client) => {
          const backup: BackupData = {
            version: "1.0",
            timestamp: Date.now(),
            deployment: targetUrl,
            data: {},
          };

          // Backup memory spaces (paginate if needed)
          spinner.text = "Backing up memory spaces...";
          const spacesResult = await client.memorySpaces.list({
            limit: MAX_LIMIT,
          });
          backup.data.memorySpaces = spacesResult.spaces;

          // Backup users (paginate if needed)
          spinner.text = "Backing up users...";
          const usersResult = await client.users.list({ limit: MAX_LIMIT });
          backup.data.users = usersResult.users;

          if (options.includeAll) {
            // Backup conversations
            spinner.text = "Backing up conversations...";
            const spaces = backup.data.memorySpaces as Array<{
              memorySpaceId: string;
            }>;
            backup.data.conversations = [];
            for (const space of spaces) {
              const convsResult = await client.conversations.list({
                memorySpaceId: space.memorySpaceId,
                limit: MAX_LIMIT,
              });
              (backup.data.conversations as unknown[]).push(...convsResult.conversations);
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
    .option("-d, --deployment <name>", "Target deployment")
    .requiredOption("-i, --input <file>", "Backup file path")
    .option("--dry-run", "Preview what would be restored", false)
    .option("-y, --yes", "Skip confirmation", false)
    .action(async (options) => {
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
        const currentConfig = await loadConfig();
        const selection = await selectDeployment(currentConfig, options, "restore to");
        if (!selection) return;
        const { name: targetName } = selection;

        if (!options.yes) {
          const confirmed = await requireConfirmation(
            `Restore this backup to ${targetName}? Existing data may be overwritten.`,
            currentConfig,
          );
          if (!confirmed) {
            printWarning("Restore cancelled");
            return;
          }
        }

        const spinner = ora(`Restoring backup to ${targetName}...`).start();

        await withClient(currentConfig, { deployment: targetName }, async (client) => {
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
    .option("-d, --deployment <name>", "Target deployment")
    .option("-o, --output <file>", "Output file path", "cortex-export.json")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "export");
      if (!selection) return;
      
      const { name: targetName, deployment } = selection;
      const targetUrl = deployment.url;

      try {
        validateFilePath(options.output);

        const spinner = ora(`Exporting data from ${targetName}...`).start();

        await withClient(currentConfig, { deployment: targetName }, async (client) => {
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
