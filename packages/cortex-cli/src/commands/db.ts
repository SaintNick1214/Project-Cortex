import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { withClient } from "../utils/client.js";
import { runOperator } from "../utils/operator.js";
import { validateFilePath } from "../utils/validation.js";
import type { GlobalOptions } from "../types.js";
import type { CLIConfig } from "../types.js";
import {
  exportSnapshot,
  importSnapshot,
  nativeOperation,
  retired,
  resolveNativeTarget,
  targetOptions,
  type ManagementOptions,
} from "../utils/management.js";
import { propagateNativeResult } from "../utils/convex-runner.js";
import { formatCSV } from "../utils/formatting.js";

const tables = ["agents", "artifacts", "contexts", "conversations", "factHistory", "facts", "governanceEnforcement", "governancePolicies", "graphSyncQueue", "immutable", "memories", "memorySpaces", "mutable", "sessions"] as const;
export function verifiedCounts(value: unknown): Record<string, { count: number; truncated: boolean }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("OPERATOR_COUNTS_INVALID");
  const rows = value as Record<string, unknown>, result: Record<string, { count: number; truncated: boolean }> = {};
  if (Object.keys(rows).length !== tables.length) throw new Error("OPERATOR_COUNTS_INVALID");
  for (const table of tables) { const item = rows[table]; if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).length !== 2 || !("count" in item) || !("truncated" in item) || typeof item.count !== "number" || !Number.isSafeInteger(item.count) || item.count < 0 || item.count > 10000 || typeof item.truncated !== "boolean") throw new Error("OPERATOR_COUNTS_INVALID"); result[table] = { count: item.count, truncated: item.truncated }; }
  return result;
}
function operatorFlags(command: Command): Command { return command.requiredOption("--target <file>", "Exact disposable development team/project/name/URL JSON")
  .option("--project <directory>", "Host with the pinned Convex CLI", ".")
  .option("--management-token-env <name>", "Management token environment name", "CONVEX_ACCESS_TOKEN")
  .option("--deploy-key-env <name>", "Exact dev/name deploy-key environment name", "CONVEX_DEPLOY_KEY"); }

async function exportMetadata(config: CLIConfig, options: { output: string; includeAll?: boolean }, command: Command): Promise<void> {
  if (options.includeAll) throw new Error("FULL_DATABASE_BACKUP_UNSUPPORTED");
  validateFilePath(options.output);
  const data = await withClient(config, command.optsWithGlobals() as GlobalOptions, async client => {
    const spaces = await client.memorySpaces.list({ limit: 1000 }), users = await client.users.list({ limit: 1000 });
    if (spaces.spaces.length >= 1000 || users.users.length >= 1000) throw new Error("EXPORT_TOO_BROAD");
    const data = JSON.stringify({ version: 1, restorable: false, scope: { tenantId: client.auth?.tenantId, userId: client.auth?.userId }, memorySpaces: spaces.spaces, users: users.users }, null, 2);
    if (Buffer.byteLength(data) > 1048576) throw new Error("EXPORT_TOO_LARGE");
    return data;
  });
  await writeFile(options.output, data, { flag: "wx", mode: 0o600 });
  console.log(`Authorized metadata export written to ${options.output}; not a restorable database snapshot.`);
}
async function retire(options: {target?: string; project?: string; managementTokenEnv?: string; deployKeyEnv?: string; tenantId?: string; memorySpaceId?: string; yes?: boolean}): Promise<void> {
  if (!options.target || !options.tenantId || !options.memorySpaceId || !options.yes) throw new Error("GLOBAL_CLEAR_RETIRED: exact --target, --tenant-id, --memory-space-id and --yes are required for lifecycle retirement.");
  console.log(JSON.stringify(await runOperator({ ...options, target: options.target }, { kind: "retireScope", tenantId: options.tenantId, memorySpaceId: options.memorySpaceId }), null, 2));
}

export function registerSnapshotCommands(
  group: Command,
  config: CLIConfig,
): void {
  targetOptions(
    group
      .command("export")
      .description(
        "Native ZIP snapshot of all tables; external graphs excluded",
      ),
  )
    .option(
      "-o, --output <file>",
      "Unoccupied .zip output path",
      "snapshot.zip",
    )
    .option("--include-file-storage", "Include native stored file bytes")
    .option("--metadata", "Authorized metadata-only export; cannot combine native storage/target flags")
    .action(
      (
        options: ManagementOptions & {
          output?: string;
          includeFileStorage?: boolean; metadata?: boolean;
        },
        command: Command,
      ) => {
        if (options.metadata) {
          if (options.includeFileStorage || options.local || options.prod || options.envFile || options.project) throw new Error("METADATA_EXPORT_MODE_CONFLICT");
          return exportMetadata(config, { output: command.getOptionValueSource("output") === "cli" ? options.output! : "cortex-scoped-export.json" }, command);
        }
        return exportSnapshot(config, options);
      },
    );
  targetOptions(
    group
      .command("import <snapshot>")
      .description(
        "Import a verified native ZIP with explicit target and mode",
      ),
  )
    .option(
      "--append",
      "Append rows; snapshot table IDs must match existing tables",
    )
    .option("--replace", "Atomically replace tables mentioned in snapshot")
    .option("--replace-all", "Replace deployment; clear absent schema tables")
    .option("-y, --yes", "Authorize selected snapshot import")
    .option("--dry-run", "Unsupported: native imports cannot be simulated")
    .action(
      (
        snapshot: string,
        options: ManagementOptions & {
          append?: boolean;
          replace?: boolean;
          replaceAll?: boolean;
        },
      ) => importSnapshot(config, snapshot, options),
    );
}
export function registerDbCommands(program: Command, config: CLIConfig): void {
  const db = program
    .command("db")
    .description("Native deployment snapshots and honest scoped statistics");
  registerSnapshotCommands(db, config);
  for (const name of ["retire-scope", "clear"]) {
    const command = db.command(name).description(name === "clear" ? "Deprecated guarded alias of retire-scope; bare/global clear is retired" : "Retire exact owned runtime tenant+space on verified disposable dev target");
    // Clear accepts the historical guarded shape, but bare/native clear fails before any RPC.
    command.option("--target <file>", "Exact disposable development identity JSON")
      .option("--project <directory>", "Host with the pinned Convex CLI", ".")
      .option("--management-token-env <name>", "Management token environment name", "CONVEX_ACCESS_TOKEN")
      .option("--deploy-key-env <name>", "Target-bound dev key environment name", "CONVEX_DEPLOY_KEY")
      .option("--tenant-id <id>", "Exact runtime tenant")
      .option("--memory-space-id <id>", "Exact runtime space")
      .option("-y, --yes", "Authorize exact lifecycle retirement")
      .action(retire);
  }
  operatorFlags(db.command("runtime-stats").description("Internal bounded runtime counts, including explicit truncation"))
    .option("-f, --format <format>", "json or table", "json")
    .action(async options => {
      if (!["json", "table"].includes(options.format)) throw new Error("Use table or json for bounded statistics.");
      const counts = verifiedCounts(await runOperator(options, { kind: "stats" }));
      if (options.format === "json") console.log(JSON.stringify(counts, null, 2));
      else console.table(Object.entries(counts).map(([table, row]) => ({ table, ...row })));
    });
  db.command("export-metadata").description("Authorized bounded metadata; not a restorable native snapshot")
    .option("-o, --output <file>", "New private file", "cortex-scoped-export.json")
    .action((options, command) => exportMetadata(config, options, command));

  for (const [name, message] of [
    [
      "backup",
      "db backup is retired; use db export --output snapshot.zip (optional --include-file-storage)",
    ],
    [
      "restore",
      "db restore is retired; use db import <snapshot.zip> with explicit target and append/replace/replace-all mode",
    ],
  ])
    db.command(name)
      .allowUnknownOption(true)
      .allowExcessArguments(true)
      .action(() => retired(message));
  targetOptions(
    db
      .command("stats")
      .description(
        "List actual deployed tables; exact counts unavailable through this management channel",
      ),
  ).action(async (options: ManagementOptions) => {
    const target = resolveNativeTarget(config, options);
    const result = await nativeOperation(target, ["data"], true);
    if (!propagateNativeResult(result)) return;
    const tables = result.stdout.trim().split(/\r?\n/).filter(Boolean);
    const stats = {
      alias: target.alias,
      scope: "deployment",
      tables: tables.map((table) => ({
        table,
        count: null,
        availability: "unavailable",
        reason: "Native table listing has no exact aggregate count",
      })),
    };
    if (options.format === "json") console.log(JSON.stringify(stats));
    else if (options.format === "csv") console.log(formatCSV(stats.tables));
    else
      console.log(
        tables.length
          ? stats.tables
              .map((table) => `${table.table}: count unavailable`)
              .join("\n")
          : "No deployed tables; exact aggregate counts unavailable",
      );
  });
}
