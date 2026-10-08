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
import {
  validateFactId,
  validateFactType,
  validateSearchQuery,
} from "../utils/validation.js";

export function registerFactsCommands(
  program: Command,
  _config: CLIConfig,
): void {
  const facts = program.command("facts").description("Manage extracted facts");

  action(
    facts
      .command("list")
      .description("List facts in a memory space")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-t, --type <type>", "Filter by fact type")
      .option("-u, --user <id>", "Filter by user ID")
      .option("-l, --limit <number>", "Maximum number of results", "50")
      .option("-f, --format <format>", "Output format: table, json, csv"),
    async (id, o, config, run) => {
      const space = scope(o);
      const factType =
        o.type === undefined ? undefined : validateFactType(o.type);
      const limit = integer(o.limit!);
      await run(async (c) =>
        emit(
          await c.facts.list({
            memorySpaceId: space,
            factType,
            userId: o.user,
            limit,
          }),
          o,
          "Facts",
        ),
      );
    },
  );

  action(
    facts
      .command("search <query>")
      .description("Search facts by content")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-t, --type <type>", "Filter by fact type")
      .option("-l, --limit <number>", "Maximum number of results", "20")
      .option("-f, --format <format>", "Output format: table, json"),
    async (id, o, config, run) => {
      validateSearchQuery(id);
      const space = scope(o);
      const factType =
        o.type === undefined ? undefined : validateFactType(o.type);
      const limit = integer(o.limit!);
      await run(async (c) =>
        emit(
          await c.facts.search(space, id, { factType, limit }),
          o,
          "Search results",
        ),
      );
    },
  );

  action(
    facts
      .command("get <factId>")
      .description("Get fact details")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-f, --format <format>", "Output format: table, json"),
    async (id, o, config, run) => {
      validateFactId(id);
      const space = scope(o);
      await run(async (c) => {
        const result = await c.facts.get(space, id);
        if (!result) throw new Error(`Fact ${id} not found`);
        emit(result, o, "Fact");
      });
    },
  );

  action(
    facts
      .command("delete <factId>")
      .description("Delete a fact")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-y, --yes", "Skip confirmation prompt", false),
    async (id, o, config, run) => {
      validateFactId(id);
      const space = scope(o);
      if (!(await confirm(`Delete fact ${id} from ${space}?`, o, config)))
        return;
      await run(async (c) => {
        const result = await c.facts.delete(space, id);
        if (!result.deleted)
          throw new Error(`Fact ${id} not found or could not be deleted`);
        emit(result, o, "Deleted fact");
      });
    },
  );

  action(
    facts
      .command("export")
      .description("Export facts to a file")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-t, --type <type>", "Filter by fact type")
      .option("-o, --output <file>", "Output file path", "facts-export.json")
      .option("-f, --format <format>", "Export format: json, csv", "json"),
    async (id, o, config, run) => {
      const space = scope(o);
      const factType =
        o.type === undefined ? undefined : validateFactType(o.type);
      const output = exportPath(
        o,
        facts.commands.find((c) => c.name() === "export")!,
        "facts-export",
        ["json", "csv"],
      );
      const format = o.format as "json" | "csv";
      await run(async (c) => {
        const result = await c.facts.export({
          memorySpaceId: space,
          factType,
          format,
        });
        validateExportPayload(result, format);
        await writePrivateExport(output, result.data);
        emit(
          { output, count: result.count, format: result.format },
          { ...o, format: "json" },
          "Exported facts",
        );
      });
    },
  );

  action(
    facts
      .command("count")
      .description("Count facts in a memory space")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-t, --type <type>", "Filter by fact type"),
    async (id, o, config, run) => {
      const space = scope(o);
      const factType =
        o.type === undefined ? undefined : validateFactType(o.type);
      await run(async (c) =>
        emit(
          {
            memorySpaceId: space,
            count: await c.facts.count({ memorySpaceId: space, factType }),
          },
          o,
          "Fact count",
        ),
      );
    },
  );

  action(
    facts
      .command("clear")
      .description("Clear all facts in a memory space")
      .option("-d, --deployment <name>", "Target deployment")
      .requiredOption("-s, --space <id>", "Memory space ID")
      .option("-t, --type <type>", "Only clear facts of this type")
      .option("-y, --yes", "Skip confirmation prompt", false),
    async (id, o, config, run) => {
      const space = scope(o);
      const factType =
        o.type === undefined ? undefined : validateFactType(o.type);
      await run(async (c) => {
        // Physical clear covers retained history; ordinary count keeps the current-only default.
        const filter = { memorySpaceId: space, factType, includeSuperseded: true };
        const count = await c.facts.count(filter);
        if (!count) {
          emit({ deleted: 0 }, o, "No facts to delete");
          return;
        }
        if (!(await confirm(`Delete ${count} facts from ${space}?`, o, config)))
          return;
        const result = await c.facts.deleteMany(filter);
        const remaining = await c.facts.count(filter);
        emit({ ...result, remaining }, o, "Clear facts");
        verifyClear(result, count, remaining);
      });
    },
  );
}
