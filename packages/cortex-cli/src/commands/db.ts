import { Command } from "commander";
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
    .action(
      (
        options: ManagementOptions & {
          output?: string;
          includeFileStorage?: boolean;
        },
      ) => exportSnapshot(config, options),
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
  for (const [name, message] of [
    [
      "clear",
      "db clear is retired; use scoped SDK deletion commands or explicit db import --replace-all for intentional restoration",
    ],
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
