/**
 * Conversations Commands
 *
 * Commands for managing conversations:
 * - list: List conversations
 * - get: Get conversation with messages
 * - delete: Delete a conversation
 * - export: Export conversation
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
  validateConversationId,
  validateUserId,
  validateLimit,
  validateFilePath,
  requireConfirmation,
} from "../utils/validation.js";
import { writeFile } from "fs/promises";
import pc from "picocolors";

/**
 * Register conversations commands
 */
export function registerConversationsCommands(
  program: Command,
  config: CLIConfig,
): void {
  const conversations = program
    .command("conversations")
    .alias("convs")
    .description("Manage conversations");

  // conversations list
  conversations
    .command("list")
    .description("List conversations")
    .option("-s, --space <id>", "Filter by memory space ID")
    .option("-u, --user <id>", "Filter by user ID")
    .option("-t, --type <type>", "Filter by type: user-agent, agent-agent")
    .option("-l, --limit <number>", "Maximum number of results", "50")
    .option("-f, --format <format>", "Output format: table, json, csv")
    .action(async (options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading conversations...").start();

      try {
        if (options.space) {
          validateMemorySpaceId(options.space);
        }
        if (options.user) {
          validateUserId(options.user);
        }
        const limit = validateLimit(parseInt(options.limit, 10));

        await withClient(config, globalOpts, async (client) => {
          const convList = await client.conversations.list({
            memorySpaceId: options.space,
            userId: options.user,
            type: options.type,
            limit,
          });

          spinner.stop();

          if (convList.length === 0) {
            printWarning("No conversations found");
            return;
          }

          // Format conversations for display
          const displayData = convList.map((c) => ({
            id: c.conversationId,
            space: c.memorySpaceId,
            type: c.type,
            messages: c.messageCount,
            user: c.participants?.userId ?? "-",
            created: formatRelativeTime(c.createdAt),
            updated: formatRelativeTime(c.updatedAt),
          }));

          console.log(
            formatOutput(displayData, format, {
              title: "Conversations",
              headers: [
                "id",
                "space",
                "type",
                "messages",
                "user",
                "created",
                "updated",
              ],
            }),
          );

          printSuccess(`Found ${formatCount(convList.length, "conversation")}`);
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error
            ? error.message
            : "Failed to list conversations",
        );
        process.exit(1);
      }
    });

  // conversations get
  conversations
    .command("get <conversationId>")
    .description("Get conversation details with messages")
    .option("-m, --messages <number>", "Number of messages to show", "20")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (conversationId, options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading conversation...").start();

      try {
        validateConversationId(conversationId);
        const messageLimit = validateLimit(
          parseInt(options.messages, 10),
          1000,
        );

        await withClient(config, globalOpts, async (client) => {
          const conversation = await client.conversations.get(conversationId);

          if (!conversation) {
            spinner.stop();
            printError(`Conversation ${conversationId} not found`);
            process.exit(1);
          }

          spinner.stop();

          if (format === "json") {
            console.log(formatOutput(conversation, "json"));
          } else {
            printSection(`Conversation: ${conversationId}`, {
              ID: conversation.conversationId,
              "Memory Space": conversation.memorySpaceId,
              Type: conversation.type,
              "Message Count": conversation.messageCount,
              "User ID": conversation.participants?.userId ?? "-",
              "Participant ID": conversation.participants?.participantId ?? "-",
              Created: formatTimestamp(conversation.createdAt),
              Updated: formatTimestamp(conversation.updatedAt),
            });

            // Show messages
            const messages =
              conversation.messages?.slice(0, messageLimit) ?? [];
            if (messages.length > 0) {
              console.log("\n  Messages:");
              console.log("  " + "─".repeat(60));

              for (const msg of messages) {
                const roleColor =
                  msg.role === "user"
                    ? pc.cyan
                    : msg.role === "agent"
                      ? pc.green
                      : pc.yellow;
                const timestamp = formatTimestamp(msg.timestamp);

                console.log(
                  `\n  ${roleColor(`[${msg.role.toUpperCase()}]`)} ${pc.dim(timestamp)}`,
                );

                // Word wrap content
                const maxWidth = 58;
                const words = msg.content.split(" ");
                let line = "    ";
                for (const word of words) {
                  if (line.length + word.length > maxWidth) {
                    console.log(line);
                    line = "    ";
                  }
                  line += word + " ";
                }
                if (line.trim()) {
                  console.log(line);
                }
              }

              console.log("\n  " + "─".repeat(60));

              if (conversation.messageCount > messageLimit) {
                console.log(
                  pc.dim(
                    `  ... and ${conversation.messageCount - messageLimit} more messages`,
                  ),
                );
              }
            }
          }
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to get conversation",
        );
        process.exit(1);
      }
    });

  // conversations delete
  conversations
    .command("delete <conversationId>")
    .description("Delete a conversation")
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (conversationId, options) => {
      const globalOpts = program.opts();

      try {
        validateConversationId(conversationId);

        // Get conversation first to show info
        await withClient(config, globalOpts, async (client) => {
          const conversation = await client.conversations.get(conversationId);

          if (!conversation) {
            printError(`Conversation ${conversationId} not found`);
            process.exit(1);
          }

          if (!options.yes) {
            const confirmed = await requireConfirmation(
              `Delete conversation ${conversationId} with ${conversation.messageCount} messages?`,
              config,
            );
            if (!confirmed) {
              printWarning("Operation cancelled");
              return;
            }
          }

          const spinner = ora("Deleting conversation...").start();

          await client.conversations.delete(conversationId);

          spinner.stop();
          printSuccess(`Deleted conversation ${conversationId}`);
          console.log(
            `  ${formatCount(conversation.messageCount, "message")} removed`,
          );
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Delete failed");
        process.exit(1);
      }
    });

  // conversations export
  conversations
    .command("export <conversationId>")
    .description("Export a conversation to a file")
    .option(
      "-o, --output <file>",
      "Output file path",
      "conversation-export.json",
    )
    .option("-f, --format <format>", "Export format: json, txt", "json")
    .action(async (conversationId, options) => {
      const globalOpts = program.opts();

      const spinner = ora("Exporting conversation...").start();

      try {
        validateConversationId(conversationId);
        validateFilePath(options.output);

        await withClient(config, globalOpts, async (client) => {
          const conversation = await client.conversations.get(conversationId);

          if (!conversation) {
            spinner.stop();
            printError(`Conversation ${conversationId} not found`);
            process.exit(1);
          }

          let content: string;
          if (options.format === "txt") {
            // Human-readable text format
            const lines = [
              `Conversation: ${conversation.conversationId}`,
              `Space: ${conversation.memorySpaceId}`,
              `Type: ${conversation.type}`,
              `Messages: ${conversation.messageCount}`,
              `Created: ${new Date(conversation.createdAt).toISOString()}`,
              "",
              "---",
              "",
            ];

            for (const msg of conversation.messages ?? []) {
              lines.push(
                `[${msg.role.toUpperCase()}] ${new Date(msg.timestamp).toISOString()}`,
              );
              lines.push(msg.content);
              lines.push("");
            }

            content = lines.join("\n");
          } else {
            // JSON format
            content = JSON.stringify(conversation, null, 2);
          }

          await writeFile(options.output, content, "utf-8");

          spinner.stop();
          printSuccess(`Exported conversation to ${options.output}`);
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Export failed");
        process.exit(1);
      }
    });

  // conversations count
  conversations
    .command("count")
    .description("Count conversations")
    .option("-s, --space <id>", "Filter by memory space ID")
    .option("-u, --user <id>", "Filter by user ID")
    .option("-t, --type <type>", "Filter by type")
    .action(async (options) => {
      const globalOpts = program.opts();

      const spinner = ora("Counting conversations...").start();

      try {
        if (options.space) {
          validateMemorySpaceId(options.space);
        }
        if (options.user) {
          validateUserId(options.user);
        }

        await withClient(config, globalOpts, async (client) => {
          const count = await client.conversations.count({
            memorySpaceId: options.space,
            userId: options.user,
            type: options.type,
          });

          spinner.stop();

          let scope = "";
          if (options.space) scope += ` in space ${options.space}`;
          if (options.user) scope += ` for user ${options.user}`;
          if (options.type) scope += ` of type ${options.type}`;

          printSuccess(`${formatCount(count, "conversation")}${scope}`);
        });
      } catch (error) {
        spinner.stop();
        printError(error instanceof Error ? error.message : "Count failed");
        process.exit(1);
      }
    });

  // conversations clear
  conversations
    .command("clear")
    .description("Clear conversations")
    .option("-s, --space <id>", "Memory space ID (required)")
    .option("-u, --user <id>", "Only clear for this user")
    .option("-y, --yes", "Skip confirmation prompt", false)
    .action(async (options) => {
      const globalOpts = program.opts();

      try {
        if (!options.space && !options.user) {
          printError("Either --space or --user is required");
          process.exit(1);
        }

        if (options.space) {
          validateMemorySpaceId(options.space);
        }
        if (options.user) {
          validateUserId(options.user);
        }

        // Count first
        await withClient(config, globalOpts, async (client) => {
          const count = await client.conversations.count({
            memorySpaceId: options.space,
            userId: options.user,
          });

          if (count === 0) {
            printWarning("No conversations found to delete");
            return;
          }

          if (!options.yes) {
            const scope = options.user
              ? `for user ${options.user}`
              : `in space ${options.space}`;
            const confirmed = await requireConfirmation(
              `Delete ${formatCount(count, "conversation")} ${scope}? This cannot be undone.`,
              config,
            );
            if (!confirmed) {
              printWarning("Operation cancelled");
              return;
            }
          }

          const spinner = ora(`Deleting ${count} conversations...`).start();

          // Get all conversations
          const convList = await client.conversations.list({
            memorySpaceId: options.space,
            userId: options.user,
            limit: 10000,
          });

          let deleted = 0;
          for (const conv of convList) {
            try {
              await client.conversations.delete(conv.conversationId);
              deleted++;
            } catch {
              // Continue on error
            }
          }

          spinner.stop();
          printSuccess(`Deleted ${formatCount(deleted, "conversation")}`);
        });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Clear failed");
        process.exit(1);
      }
    });

  // conversations messages
  conversations
    .command("messages <conversationId>")
    .description("List messages in a conversation")
    .option("-l, --limit <number>", "Maximum number of messages", "50")
    .option("-f, --format <format>", "Output format: table, json")
    .action(async (conversationId, options) => {
      const globalOpts = program.opts();
      const resolved = resolveConfig(config, globalOpts);
      const format = (options.format ?? resolved.format) as OutputFormat;

      const spinner = ora("Loading messages...").start();

      try {
        validateConversationId(conversationId);
        const limit = validateLimit(parseInt(options.limit, 10), 1000);

        await withClient(config, globalOpts, async (client) => {
          const conversation = await client.conversations.get(conversationId);

          if (!conversation) {
            spinner.stop();
            printError(`Conversation ${conversationId} not found`);
            process.exit(1);
          }

          spinner.stop();

          const messages = conversation.messages?.slice(0, limit) ?? [];

          if (messages.length === 0) {
            printWarning("No messages in this conversation");
            return;
          }

          if (format === "json") {
            console.log(formatOutput(messages, "json"));
          } else {
            const displayData = messages.map((m) => ({
              id: m.id,
              role: m.role,
              content:
                m.content.length > 60
                  ? m.content.substring(0, 57) + "..."
                  : m.content,
              time: formatTimestamp(m.timestamp),
            }));

            console.log(
              formatOutput(displayData, "table", {
                title: `Messages in ${conversationId}`,
                headers: ["id", "role", "content", "time"],
              }),
            );

            if (conversation.messageCount > limit) {
              console.log(
                pc.dim(
                  `\nShowing ${limit} of ${conversation.messageCount} messages`,
                ),
              );
            }
          }
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "Failed to list messages",
        );
        process.exit(1);
      }
    });
}
