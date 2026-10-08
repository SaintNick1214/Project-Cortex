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
            format: options.format as OutputFormat,
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

/** Validate structural completeness before touching an existing destination. Keep SDK bytes unchanged. */
function validateExportPayload(
  result: { count: number; data: string; format: string },
  format: "json" | "csv",
): void {
  if (result.format !== format)
    throw new Error(
      `SDK returned ${result.format} for requested ${format} export`,
    );
  if (
    !Number.isSafeInteger(result.count) ||
    result.count < 0 ||
    typeof result.data !== "string"
  )
    throw new Error("SDK returned an invalid export receipt");
  if (format === "json") {
    const records: unknown = JSON.parse(result.data);
    if (!Array.isArray(records) || records.length !== result.count)
      throw new Error(
        "SDK JSON export is incomplete: record count does not match receipt",
      );
    return;
  }
  let quoted = false,
    cellStart = true,
    closed = false,
    pending = false;
  let columns = 1,
    width: number | undefined,
    rows = 0;
  const endRow = () => {
    if (width === undefined) width = columns;
    else if (width !== columns)
      throw new Error("SDK CSV export has inconsistent columns");
    rows++;
    columns = 1;
    cellStart = true;
    closed = false;
    pending = false;
  };
  for (let i = 0; i < result.data.length; i++) {
    const char = result.data[i];
    if (quoted) {
      if (char === '"') {
        if (result.data[i + 1] === '"') i++;
        else {
          quoted = false;
          closed = true;
        }
      }
      pending = true;
      continue;
    }
    if (char === '"') {
      if (!cellStart || closed)
        throw new Error("SDK CSV export has an invalid quote");
      quoted = true;
      cellStart = false;
      pending = true;
    } else if (char === ",") {
      columns++;
      cellStart = true;
      closed = false;
      pending = true;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && result.data[i + 1] === "\n") i++;
      endRow();
    } else {
      if (closed)
        throw new Error("SDK CSV export has content after a closing quote");
      cellStart = false;
      pending = true;
    }
  }
  if (quoted) throw new Error("SDK CSV export has an unterminated quote");
  if (pending) endRow();
  if (!rows || rows - 1 !== result.count)
    throw new Error(
      "SDK CSV export is incomplete: row count does not match receipt",
    );
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
import { validateMemoryId, validateSearchQuery } from "../utils/validation.js";
import type { SourceType } from "@cortexmemory/sdk";
function source(value?: string): SourceType | undefined {
  if (value === undefined) return undefined;
  if (
    !["conversation", "system", "tool", "a2a", "fact-extraction"].includes(
      value,
    )
  )
    throw new Error("Invalid source type");
  return value as SourceType;
}

export function registerMemoryCommands(
  program: Command,
  _config: CLIConfig,
): void {
  const memory = program
    .command("memory")
    .description("Manage memories (vector store)");

  action(
    memory
      .command("list")
      .description("List memories in a memory space")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-u, --user <id>", "Filter by user ID")
      .option("-l, --limit <number>", "Maximum number of results", "50")
      .option("-f, --format <format>", "Output format: table, json, csv"),
    async (id, o, config, run) => {
      const space = scope(o);
      const limit = integer(o.limit!);
      await run(async (c) =>
        emit(
          await c.memory.list({ memorySpaceId: space, userId: o.user, limit }),
          o,
          "Memories",
        ),
      );
    },
  );

  action(
    memory
      .command("search <query>")
      .description(
        "Search memory text (CLI does not configure an embedding provider)",
      )
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-u, --user <id>", "Filter by user ID")
      .option("-l, --limit <number>", "Maximum number of results", "20")
      .option("-f, --format <format>", "Output format: table, json, csv"),
    async (id, o, config, run) => {
      validateSearchQuery(id);
      const space = scope(o);
      const limit = integer(o.limit!);
      await run(async (c) =>
        emit(
          await c.memory.search(space, id, { userId: o.user, limit }),
          o,
          "Search results",
        ),
      );
    },
  );

  action(
    memory
      .command("delete <memoryId>")
      .description("Delete a specific memory")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("--cascade", "Also delete associated facts", false)
      .option("-y, --yes", "Skip confirmation prompt", false),
    async (id, o, config, run) => {
      validateMemoryId(id);
      const space = scope(o);
      if (!(await confirm(`Delete memory ${id} from ${space}?`, o, config)))
        return;
      await run(async (c) => {
        const result = await c.memory.delete(space, id, {
          cascadeDeleteFacts: o.cascade,
        });
        if (!result.deleted)
          throw new Error(`Memory ${id} not found or could not be deleted`);
        emit(result, o, "Deleted memory");
      });
    },
  );

  action(
    memory
      .command("clear")
      .description("Clear multiple memories")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-u, --user <id>", "Only clear memories for this user")
      .option("--source <type>", "Only clear memories of this source type")
      .option("-y, --yes", "Skip confirmation prompt", false),
    async (id, o, config, run) => {
      const space = scope(o);
      const sourceType = source(o.source);
      await run(async (c) => {
        const filter = { memorySpaceId: space, userId: o.user, sourceType };
        const count = await c.memory.count(filter);
        if (!count) {
          emit({ deleted: 0 }, o, "No memories to delete");
          return;
        }
        if (
          !(await confirm(`Delete ${count} memories from ${space}?`, o, config))
        )
          return;
        const result = await c.memory.deleteMany(filter);
        const remaining = await c.memory.count(filter);
        emit({ ...result, remaining }, o, "Clear memories");
        verifyClear(result, count, remaining);
      });
    },
  );

  action(
    memory
      .command("export")
      .description("Export memories to a file")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-u, --user <id>", "Only export memories for this user")
      .option("-o, --output <file>", "Output file path", "memories-export.json")
      .option("--include-facts", "Include associated facts", false)
      .option("-f, --format <format>", "Export format: json, csv", "json"),
    async (id, o, config, run) => {
      const space = scope(o);
      const output = exportPath(
        o,
        memory.commands.find((c) => c.name() === "export")!,
        "memories-export",
        ["json", "csv"],
      );
      const format = o.format as "json" | "csv";
      await run(async (c) => {
        const result = await c.memory.export({
          memorySpaceId: space,
          userId: o.user,
          format,
          includeFacts: o.includeFacts,
        });
        validateExportPayload(result, format);
        await writePrivateExport(output, result.data);
        emit(
          { output, count: result.count, format: result.format },
          { ...o, format: "json" },
          "Exported memories",
        );
      });
    },
  );

  action(
    memory
      .command("stats")
      .description("Show memory statistics for a space")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-f, --format <format>", "Output format: table, json"),
    async (id, o, config, run) => {
      const space = scope(o);
      await run(async (c) => {
        const [total, conversation, system, tool, a2a] =
          await Promise.all([
            c.memory.count({ memorySpaceId: space }),
            ...(["conversation", "system", "tool", "a2a"] as const).map((sourceType) =>
              c.memory.count({ memorySpaceId: space, sourceType }),
            ),
          ]);
        // The native schema's remaining source is fact-extraction, but the
        // public count filter accepts only the four ordinary source types.
        const extraction = total - conversation - system - tool - a2a;
        if (![total, conversation, system, tool, a2a, extraction].every(
          (count) => Number.isSafeInteger(count) && count >= 0,
        )) throw new Error("Memory counts changed or are invalid; retry statistics");
        const recent = await c.memory.list({ memorySpaceId: space, limit: 5 });
        const lastActivity = recent.length
          ? Math.max(
              ...recent.map(
                (entry) => ("memory" in entry ? entry.memory : entry).createdAt,
              ),
            )
          : null;
        emit(
          {
            memorySpaceId: space,
            total,
            recentCount: recent.length,
            lastActivity,
            bySource: {
              conversation,
              system,
              tool,
              a2a,
              "fact-extraction": extraction,
            },
          },
          o,
          "Memory statistics",
        );
      });
    },
  );

  action(
    memory
      .command("get <memoryId>")
      .description("Get details of a specific memory")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("--include-conversation", "Include source conversation", false)
      .option("-f, --format <format>", "Output format: table, json"),
    async (id, o, config, run) => {
      validateMemoryId(id);
      const space = scope(o);
      await run(async (c) => {
        const result = await c.memory.get(space, id, {
          includeConversation: o.includeConversation,
        });
        if (!result) throw new Error(`Memory ${id} not found`);
        emit(result, o, "Memory");
      });
    },
  );

  action(
    memory
      .command("archive <memoryId>")
      .description("Archive a memory (soft delete)")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-y, --yes", "Skip confirmation prompt", false),
    async (id, o, config, run) => {
      validateMemoryId(id);
      const space = scope(o);
      if (!(await confirm(`Archive memory ${id}?`, o, config))) return;
      await run(async (c) => {
        const result = await c.memory.archive(space, id);
        if (!result.archived)
          throw new Error(`Memory ${id} could not be archived`);
        emit(result, o, "Archived memory");
      });
    },
  );

  action(
    memory
      .command("restore <memoryId>")
      .description("Restore an archived memory")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID"),
    async (id, o, config, run) => {
      validateMemoryId(id);
      const space = scope(o);
      await run(async (c) => {
        const result = await c.memory.restoreFromArchive(space, id);
        if (!result.restored)
          throw new Error(`Memory ${id} could not be restored`);
        emit(result, o, "Restored memory");
      });
    },
  );
}
