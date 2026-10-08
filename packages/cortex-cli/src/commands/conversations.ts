import { Command } from "commander";
import type { Cortex } from "@cortexmemory/sdk";
import type { CLIConfig, OutputFormat } from "../types.js";
import { withClient } from "../utils/client.js";
import { loadConfig } from "../utils/config.js";
import { selectDeployment } from "../utils/deployment-selector.js";
import { formatJSON, formatOutput } from "../utils/formatting.js";
import {
  validateMemorySpaceId,
  validateUserId,
  validateLimit,
  validateFilePath,
  requireConfirmation,
} from "../utils/validation.js";
import { open, rename, unlink } from "fs/promises";
import { basename, dirname, join } from "path";
import { randomUUID } from "crypto";

type Options = {
  deployment?: string;
  scopeUser?: string;
  tenant?: string;
  graphSync?: "auto" | "off" | "required";
  format?: string;
  quiet?: boolean;
  debug?: boolean;
  space?: string;
  user?: string;
  type?: string;
  source?: string;
  limit?: string;
  messages?: string;
  output?: string;
  cascade?: boolean;
  yes?: boolean;
  includeFacts?: boolean;
  includeConversation?: boolean;
};
function integer(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error("Expected a positive integer");
  return validateLimit(Number(value));
}
function emit(value: unknown, options: Options, title: string): void {
  const format =
    options.format === "csv"
      ? "csv"
      : options.format === "json"
        ? "json"
        : "table";
  console.log(formatOutput(value, format, { title }));
  if (
    format === "table" &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    for (const [key, nested] of Object.entries(value))
      if (nested && typeof nested === "object")
        console.log(`${key}:\n${formatJSON(nested)}`);
}
function action(
  command: Command,
  operation: (
    id: string,
    options: Options,
    config: CLIConfig,
    run: <T>(fn: (client: Cortex) => Promise<T>) => Promise<T>,
  ) => Promise<void>,
): void {
  command.action(async (...args: unknown[]) => {
    const leaf = args[args.length - 1] as Command;
    const options = leaf.opts<Options>();
    const config = await loadConfig();
    const selection = await selectDeployment(config, options, leaf.name());
    if (!selection) throw new Error("No deployment selected");
    await operation(
      args.length > 2 ? String(args[0]) : "",
      options,
      config,
      (fn) =>
        withClient(
          config,
          {
            ...options,
            // Transcript format is file content; the shared client accepts display formats.
            format:
              options.format === "txt"
                ? "json"
                : (options.format as OutputFormat),
            deployment: selection.name,
          },
          fn,
        ),
    );
  });
}
function scope(options: Options, required = true): string {
  if (required || options.space !== undefined)
    validateMemorySpaceId(options.space ?? "");
  if (options.user !== undefined) validateUserId(options.user);
  return options.space ?? "";
}
async function confirm(
  message: string,
  options: Options,
  config: CLIConfig,
): Promise<boolean> {
  if (options.yes || (await requireConfirmation(message, config))) return true;
  emit({ cancelled: true }, options, "Operation cancelled");
  return false;
}

/** Stage privately beside the destination so rename is atomic on the same filesystem. */
async function writePrivateExport(
  destination: string,
  data: string,
): Promise<void> {
  const staging = join(
    dirname(destination),
    `.${basename(destination)}.cortex-export-${randomUUID()}.tmp`,
  );
  let file: Awaited<ReturnType<typeof open>> | undefined;
  let created = false;
  try {
    file = await open(staging, "wx", 0o600);
    created = true;
    await file.writeFile(data, "utf-8");
    await file.sync();
    await file.close();
    file = undefined;
    await rename(staging, destination);
  } catch (error) {
    const errors: unknown[] = [error];
    if (file) {
      try {
        await file.close();
      } catch (closeError) {
        errors.push(closeError);
      }
    }
    if (created) {
      try {
        await unlink(staging);
      } catch (cleanupError) {
        if (
          !(
            cleanupError &&
            typeof cleanupError === "object" &&
            "code" in cleanupError &&
            cleanupError.code === "ENOENT"
          )
        )
          errors.push(cleanupError);
      }
    }
    if (errors.length > 1)
      throw new AggregateError(
        errors,
        "Export failed and staging cleanup reported an error",
        { cause: error },
      );
    throw error;
  }
}

function exportPath(
  options: Options,
  command: Command,
  fallback: string,
  supported: string[],
): string {
  if (!supported.includes(options.format ?? ""))
    throw new Error(`Export format must be ${supported.join(" or ")}`);
  const output =
    command.getOptionValueSource("output") === "default"
      ? `${fallback}.${options.format}`
      : options.output!;
  validateFilePath(output);
  return output;
}
function verifyClear(
  result: { deleted: number },
  before: number,
  remaining: number,
): void {
  if (
    !Number.isSafeInteger(result.deleted) ||
    result.deleted < 0 ||
    remaining !== 0 ||
    result.deleted !== before
  )
    throw new Error(
      `Clear incomplete: deleted ${result.deleted} of ${before}; ${remaining} remain`,
    );
}
import { validateConversationId } from "../utils/validation.js";
function conversationType(
  value?: string,
): "user-agent" | "agent-agent" | undefined {
  if (value === undefined || value === "user-agent" || value === "agent-agent")
    return value;
  throw new Error("Invalid conversation type: use user-agent or agent-agent");
}

export function registerConversationsCommands(
  program: Command,
  _config: CLIConfig,
): void {
  const conversations = program
    .command("conversations")
    .alias("convs")
    .description("Manage conversations");

  action(
    conversations
      .command("list")
      .description("List conversations")
      .option("-d, --deployment <name>", "Target deployment")
      .option("-s, --space <id>", "Filter by memory space ID")
      .option("-u, --user <id>", "Filter by user ID")
      .option("-t, --type <type>", "Filter by type: user-agent, agent-agent")
      .option("-l, --limit <number>", "Maximum number of results", "50")
      .option("-f, --format <format>", "Output format: table, json, csv"),
    async (id, o, config, run) => {
      scope(o, false);
      const type = conversationType(o.type);
      const limit = integer(o.limit!);
      await run(async (c) =>
        emit(
          await c.conversations.list({
            memorySpaceId: o.space,
            userId: o.user,
            type,
            limit,
          }),
          o,
          "Conversations",
        ),
      );
    },
  );

  action(
    conversations
      .command("get <conversationId>")
      .description("Get conversation details with messages")
      .option("-d, --deployment <name>", "Target deployment")
      .option("-m, --messages <number>", "Number of messages to show", "20")
      .option("-f, --format <format>", "Output format: table, json"),
    async (id, o, config, run) => {
      validateConversationId(id);
      const messageLimit = integer(o.messages!);
      await run(async (c) => {
        const result = await c.conversations.get(id, {
          includeMessages: true,
          messageLimit,
        });
        if (!result) throw new Error(`Conversation ${id} not found`);
        emit(result, o, "Conversation");
      });
    },
  );

  action(
    conversations
      .command("delete <conversationId>")
      .description("Delete a conversation")
      .option("-d, --deployment <name>", "Target deployment")
      .option("-y, --yes", "Skip confirmation prompt", false),
    async (id, o, config, run) => {
      validateConversationId(id);
      if (!(await confirm(`Delete conversation ${id}?`, o, config))) return;
      await run(async (c) => {
        const result = await c.conversations.delete(id);
        if (!result.deleted)
          throw new Error(
            `Conversation ${id} not found or could not be deleted`,
          );
        emit(result, o, "Deleted conversation");
      });
    },
  );

  action(
    conversations
      .command("export <conversationId>")
      .description("Export a conversation to a file")
      .option("-d, --deployment <name>", "Target deployment")
      .option(
        "-o, --output <file>",
        "Output file path",
        "conversation-export.json",
      )
      .option("-f, --format <format>", "Export format: json, txt", "json"),
    async (id, o, config, run) => {
      validateConversationId(id);
      const output = exportPath(
        o,
        conversations.commands.find((c) => c.name() === "export")!,
        "conversation-export",
        ["json", "txt"],
      );
      await run(async (c) => {
        const conversation = await c.conversations.get(id, {
          includeMessages: true,
        });
        if (!conversation) throw new Error(`Conversation ${id} not found`);
        if ((conversation.messages?.length ?? 0) !== conversation.messageCount)
          throw new Error("Conversation export is incomplete");
        const content =
          o.format === "json"
            ? formatJSON(conversation)
            : [
                `Conversation: ${conversation.conversationId}`,
                `Space: ${conversation.memorySpaceId}`,
                `Type: ${conversation.type}`,
                `Messages: ${conversation.messageCount}`,
                "",
                ...(conversation.messages ?? []).flatMap((m) => [
                  `[${m.role.toUpperCase()}] ${new Date(m.timestamp).toISOString()}`,
                  m.content,
                  "",
                ]),
              ].join("\n");
        await writePrivateExport(output, content);
        emit(
          { output, count: conversation.messageCount, format: o.format },
          { ...o, format: "json" },
          "Exported conversation",
        );
      });
    },
  );

  action(
    conversations
      .command("count")
      .description("Count conversations")
      .option("-d, --deployment <name>", "Target deployment")
      .option("-s, --space <id>", "Filter by memory space ID")
      .option("-u, --user <id>", "Filter by user ID")
      .option("-t, --type <type>", "Filter by type"),
    async (id, o, config, run) => {
      scope(o, false);
      const type = conversationType(o.type);
      await run(async (c) =>
        emit(
          {
            count: await c.conversations.count({
              memorySpaceId: o.space,
              userId: o.user,
              type,
            }),
          },
          o,
          "Conversation count",
        ),
      );
    },
  );

  action(
    conversations
      .command("clear")
      .description("Clear conversations")
      .option("-d, --deployment <name>", "Target deployment")
      .option("-s, --space <id>", "Memory space ID (required)")
      .option("-u, --user <id>", "Only clear for this user")
      .option("-y, --yes", "Skip confirmation prompt", false),
    async (id, o, config, run) => {
      scope(o, false);
      if (!o.space && !o.user)
        throw new Error("Either --space or --user is required");
      await run(async (c) => {
        const filter = { memorySpaceId: o.space, userId: o.user };
        const count = await c.conversations.count(filter);
        if (!count) {
          emit({ deleted: 0 }, o, "No conversations to delete");
          return;
        }
        if (!(await confirm(`Delete ${count} conversations?`, o, config)))
          return;
        const result = await c.conversations.deleteMany(filter, {
          // Authorize only the count displayed before confirmation. A concurrent increase fails.
          confirmationThreshold: count,
        });
        const remaining = await c.conversations.count(filter);
        emit({ ...result, remaining }, o, "Clear conversations");
        verifyClear(result, count, remaining);
      });
    },
  );

  action(
    conversations
      .command("messages <conversationId>")
      .description("List messages in a conversation")
      .option("-d, --deployment <name>", "Target deployment")
      .option("-l, --limit <number>", "Maximum number of messages", "50")
      .option("-f, --format <format>", "Output format: table, json"),
    async (id, o, config, run) => {
      validateConversationId(id);
      const limit = integer(o.limit!);
      await run(async (c) =>
        emit(
          await c.conversations.getHistory(id, {
            limit,
            offset: 0,
            sortOrder: "asc",
          }),
          o,
          "Messages",
        ),
      );
    },
  );
}
