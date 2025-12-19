/**
 * Facts Commands
 *
 * Commands for managing facts:
 * - list: List facts
 * - search: Search facts
 * - delete: Delete a fact
 * - export: Export facts
 * - get: Get fact details
 */

import { Command } from "commander";
import ora from "ora";
import type { CLIConfig, OutputFormat } from "../types.js";
import { withClient } from "../utils/client.js";
import { resolveConfig, loadConfig } from "../utils/config.js";
import { selectDeployment } from "../utils/deployment-selector.js";
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
  validateFactId,
  validateFactType,
  validateLimit,
  validateFilePath,
  validateSearchQuery,
  requireConfirmation,
} from "../utils/validation.js";
import { writeFile } from "fs/promises";

/**
 * Register facts commands
 */
export function registerFactsCommands(
  program: Command,
  _config: CLIConfig,
): void {
  const facts = program.command("facts").description("Manage extracted facts");

  // facts list
  facts
    .command("list")
    .description("List facts in a memory space")
    .option("-d, --deployment <name>", "Target deployment")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-t, --type <type>", "Filter by fact type")
    .option("-u, --user <id>", "Filter by user ID")
    .option("-l, --limit <number>", "Maximum number of results", "50")
    .option("-f, --format <format>", "Output format: table, json, csv")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "list facts");
      if (!selection) return;

      const resolved = resolveConfig(currentConfig, { deployment: selection.name });
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading facts...").start();

      try {
        validateMemorySpaceId(options.space);
        const factType = options.type
          ? validateFactType(options.type)
          : undefined;
        const limit = validateLimit(parseInt(options.limit, 10));

        await withClient(currentConfig, { deployment: selection.name }, async (client) => {
          const factsList = await client.facts.list({
            memorySpaceId: options.space,
            factType,
            limit,
          });

          spinner.stop();

          if (factsList.length === 0) {
            printWarning("No facts found");
            return;
          }

          // Format facts for display
          const displayData = factsList.map((f) => ({
            id: f.factId,
            fact: f.fact.length > 50 ? f.fact.substring(0, 47) + "..." : f.fact,
            type: f.factType,
            confidence: f.confidence + "%",
            subject: f.subject ?? "-",
            created: formatRelativeTime(f.createdAt),
          }));

          console.log(
            formatOutput(displayData, format, {
              title: `Facts in ${options.space}`,
              headers: [
                "id",
                "fact",
                "type",
                "confidence",
                "subject",
                "created",
              ],
            }),
          );

          printSuccess(`Found ${formatCount(factsList.length, "fact")}`);
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to list facts",
        );
        process.exit(1);
      }
    });

  // facts search
  facts
    .command("search <query>")
    .description("Search facts by content")
    .option("-d, --deployment <name>", "Target deployment")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-t, --type <type>", "Filter by fact type")
    .option("-l, --limit <number>", "Maximum number of results", "20")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (query, options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "search facts");
      if (!selection) return;

      const resolved = resolveConfig(currentConfig, { deployment: selection.name });
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Searching facts...").start();

      try {
        validateSearchQuery(query);
        validateMemorySpaceId(options.space);
        const factType = options.type
          ? validateFactType(options.type)
          : undefined;
        const limit = validateLimit(parseInt(options.limit, 10));

        await withClient(currentConfig, { deployment: selection.name }, async (client) => {
          const results = await client.facts.search(options.space, query, {
            factType,
            limit,
          });

          spinner.stop();

          if (results.length === 0) {
            printWarning("No facts found matching your query");
            return;
          }

          const displayData = results.map((f) => ({
            id: f.factId,
            fact: f.fact.length > 60 ? f.fact.substring(0, 57) + "..." : f.fact,
            type: f.factType,
            confidence: f.confidence + "%",
          }));

          console.log(
            formatOutput(displayData, format, {
              title: `Search results for "${query}"`,
              headers: ["id", "fact", "type", "confidence"],
            }),
          );

          printSuccess(`Found ${formatCount(results.length, "fact")}`);
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Search failed");
        process.exit(1);
      }
    });

  // facts get
  facts
    .command("get <factId>")
    .description("Get fact details")
    .option("-d, --deployment <name>", "Target deployment")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (factId, options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "get fact");
      if (!selection) return;

      const resolved = resolveConfig(currentConfig, { deployment: selection.name });
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading fact...").start();

      try {
        validateFactId(factId);
        validateMemorySpaceId(options.space);

        await withClient(currentConfig, { deployment: selection.name }, async (client) => {
          const fact = await client.facts.get(options.space, factId);

          if (!fact) {
            spinner.stop();
            printError(`Fact ${factId} not found`);
            process.exit(1);
          }

          spinner.stop();

          if (format === "json") {
            console.log(formatOutput(fact, "json"));
          } else {
            printSection(`Fact: ${factId}`, {
              Fact: fact.fact,
              Type: fact.factType,
              Confidence: `${fact.confidence}%`,
              Subject: fact.subject ?? "-",
              Predicate: fact.predicate ?? "-",
              Object: fact.object ?? "-",
              "Source Type": fact.sourceType,
              Version: fact.version,
              Created: formatTimestamp(fact.createdAt),
              Updated: formatTimestamp(fact.updatedAt),
              Tags: fact.tags.length > 0 ? fact.tags.join(", ") : "-",
            });

            if (fact.validFrom || fact.validUntil) {
              console.log("\n  Temporal Validity:");
              if (fact.validFrom) {
                console.log(
                  `    Valid From: ${formatTimestamp(fact.validFrom)}`,
                );
              }
              if (fact.validUntil) {
                console.log(
                  `    Valid Until: ${formatTimestamp(fact.validUntil)}`,
                );
              }
            }

            if (fact.sourceRef) {
              console.log("\n  Source Reference:");
              if (fact.sourceRef.conversationId) {
                console.log(
                  `    Conversation: ${fact.sourceRef.conversationId}`,
                );
              }
              if (fact.sourceRef.memoryId) {
                console.log(`    Memory: ${fact.sourceRef.memoryId}`);
              }
            }
          }
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to get fact",
        );
        process.exit(1);
      }
    });

  // facts delete
  facts
    .command("delete <factId>")
    .description("Delete a fact")
    .option("-d, --deployment <name>", "Target deployment")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (factId, options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "delete fact");
      if (!selection) return;

      try {
        validateFactId(factId);
        validateMemorySpaceId(options.space);

        if (!options.yes) {
          const confirmed = await requireConfirmation(
            `Delete fact ${factId} from space ${options.space}?`,
            currentConfig,
          );
          if (!confirmed) {
            printWarning("Operation cancelled");
            return;
          }
        }

        const spinner = ora("Deleting fact...").start();

        await withClient(currentConfig, { deployment: selection.name }, async (client) => {
          await client.facts.delete(options.space, factId);

          spinner.stop();
          printSuccess(`Deleted fact ${factId}`);
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Delete failed");
        process.exit(1);
      }
    });

  // facts export
  facts
    .command("export")
    .description("Export facts to a file")
    .option("-d, --deployment <name>", "Target deployment")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-t, --type <type>", "Filter by fact type")
    .option("-o, --output <file>", "Output file path", "facts-export.json")
    .option("-f, --format <format>", "Export format: json, csv", "json")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "export facts");
      if (!selection) return;

      const spinner = ora("Exporting facts...").start();

      try {
        validateMemorySpaceId(options.space);
        validateFilePath(options.output);
        const factType = options.type
          ? validateFactType(options.type)
          : undefined;

        await withClient(currentConfig, { deployment: selection.name }, async (client) => {
          const factsList = await client.facts.list({
            memorySpaceId: options.space,
            factType,
            limit: 1000, // Get all facts
          });

          let content: string;
          if (options.format === "csv") {
            // CSV format
            const headers = [
              "factId",
              "fact",
              "factType",
              "confidence",
              "subject",
              "predicate",
              "object",
              "tags",
              "createdAt",
            ];
            const rows = factsList.map((f) => [
              f.factId,
              `"${f.fact.replace(/"/g, '""')}"`,
              f.factType,
              f.confidence.toString(),
              f.subject ?? "",
              f.predicate ?? "",
              f.object ?? "",
              f.tags.join(";"),
              new Date(f.createdAt).toISOString(),
            ]);
            content = [headers.join(","), ...rows.map((r) => r.join(","))].join(
              "\n",
            );
          } else {
            // JSON format
            content = JSON.stringify(factsList, null, 2);
          }

          await writeFile(options.output, content, "utf-8");

          spinner.stop();
          printSuccess(
            `Exported ${formatCount(factsList.length, "fact")} to ${options.output}`,
          );
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Export failed");
        process.exit(1);
      }
    });

  // facts count
  facts
    .command("count")
    .description("Count facts in a memory space")
    .option("-d, --deployment <name>", "Target deployment")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-t, --type <type>", "Filter by fact type")
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "count facts");
      if (!selection) return;

      const spinner = ora("Counting facts...").start();

      try {
        validateMemorySpaceId(options.space);
        const factType = options.type
          ? validateFactType(options.type)
          : undefined;

        await withClient(currentConfig, { deployment: selection.name }, async (client) => {
          const factsList = await client.facts.list({
            memorySpaceId: options.space,
            factType,
            limit: 1000,
          });

          spinner.stop();
          printSuccess(
            `${formatCount(factsList.length, "fact")} in ${options.space}`,
          );

          // Show breakdown by type
          const byType = new Map<string, number>();
          for (const fact of factsList) {
            byType.set(fact.factType, (byType.get(fact.factType) ?? 0) + 1);
          }

          if (byType.size > 1) {
            console.log("\n  By Type:");
            for (const [type, count] of byType) {
              console.log(`    ${type}: ${count}`);
            }
          }
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Count failed");
        process.exit(1);
      }
    });

  // facts clear
  facts
    .command("clear")
    .description("Clear all facts in a memory space")
    .option("-d, --deployment <name>", "Target deployment")
    .requiredOption("-s, --space <id>", "Memory space ID")
    .option("-t, --type <type>", "Only clear facts of this type")
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (options) => {
      const currentConfig = await loadConfig();
      const selection = await selectDeployment(currentConfig, options, "clear facts");
      if (!selection) return;

      try {
        validateMemorySpaceId(options.space);
        const factType = options.type
          ? validateFactType(options.type)
          : undefined;

        await withClient(currentConfig, { deployment: selection.name }, async (client) => {
          // List facts first
          const factsList = await client.facts.list({
            memorySpaceId: options.space,
            factType,
            limit: 1000,
          });

          if (factsList.length === 0) {
            printWarning("No facts found to delete");
            return;
          }

          if (!options.yes) {
            const scope = factType ? ` of type "${factType}"` : "";
            const confirmed = await requireConfirmation(
              `Delete ${formatCount(factsList.length, "fact")}${scope} from ${options.space}? This cannot be undone.`,
              currentConfig,
            );
            if (!confirmed) {
              printWarning("Operation cancelled");
              return;
            }
          }

          const spinner = ora(`Deleting ${factsList.length} facts...`).start();

          let deleted = 0;
          for (const fact of factsList) {
            try {
              await client.facts.delete(options.space, fact.factId);
              deleted++;
            } catch {
              // Continue on error
            }
          }

          spinner.stop();
          printSuccess(`Deleted ${formatCount(deleted, "fact")}`);
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Clear failed");
        process.exit(1);
      }
    });
}
