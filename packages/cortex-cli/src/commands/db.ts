/** Public scoped exports and explicitly verified development-operator maintenance. */
import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import type { CLIConfig, GlobalOptions } from "../types.js";
import { withClient } from "../utils/client.js";
import { runOperator } from "../utils/operator.js";
import { validateFilePath } from "../utils/validation.js";
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
export function registerDbCommands(program: Command, config: CLIConfig): void {
  const db = program.command("db").description("Verified development maintenance and authorized scoped metadata exports");
  operatorFlags(db.command("stats").description("Internal operator table counts; truncated counts stay explicit"))
    .option("-f, --format <format>", "Output format: table or json", "json")
    .action(async options => {
      if (!["json", "table"].includes(options.format)) throw new Error("Use table or json for bounded statistics.");
      const counts = verifiedCounts(await runOperator(options, { kind: "stats" }));
      if (options.format === "json") console.log(JSON.stringify(counts, null, 2));
      else console.table(Object.entries(counts).map(([table, row]) => ({ table, count: row.count, truncated: row.truncated }))); });
  operatorFlags(db.command("clear").description("Retire an exact tenant+space on an owned disposable dev target; preserves history/billing"))
    .requiredOption("--tenant-id <id>", "Exact owned test tenant")
    .requiredOption("--memory-space-id <id>", "Exact owned test space")
    .option("-y, --yes", "Explicitly authorize this exact lifecycle retirement", false)
    .action(async options => { if (!options.yes) throw new Error("Select --yes for the exact tenant+space retirement. Global purge is unsupported.");
      console.log(JSON.stringify(await runOperator(options, { kind: "retireScope", tenantId: options.tenantId, memorySpaceId: options.memorySpaceId }), null, 2)); });
  db.command("restore").description("Unsupported: generic legacy restore cannot recreate canonical authority/history")
    .requiredOption("-i, --input <file>", "Legacy backup input")
    .option("--dry-run", "Legacy flag retained; restoration remains unsupported", false).option("-y, --yes", "Legacy flag retained", false)
    .action(() => { throw new Error("LEGACY_RESTORE_UNSUPPORTED: no rows were restored. Use supported explicit resource APIs with current authority; generic migration/overwrite is unavailable."); });
  for (const name of ["backup", "export"] as const) db.command(name).description("Export bounded authorized space/user metadata, not a restorable database backup")
    .option("-d, --deployment <name>", "Public deployment selector")
    .option("-o, --output <file>", "New private output file", "cortex-scoped-export.json")
    .option("--include-all", "Unsupported legacy full database option", false)
    .action(async (options, command: Command) => {
      if (options.includeAll) throw new Error("FULL_DATABASE_BACKUP_UNSUPPORTED: select resource-specific supported exports; no partial backup was claimed.");
      validateFilePath(options.output);
      const data = await withClient(config, command.optsWithGlobals() as GlobalOptions, async client => {
        const spaces = await client.memorySpaces.list({ limit: 1000 }), users = await client.users.list({ limit: 1000 });
        if (spaces.spaces.length >= 1000 || users.users.length >= 1000) throw new Error("EXPORT_TOO_BROAD: use bounded resource exports; no truncated backup was written.");
        const data = JSON.stringify({ version: 1, restorable: false, scope: { tenantId: client.auth?.tenantId, userId: client.auth?.userId }, memorySpaces: spaces.spaces, users: users.users }, null, 2);
        if (Buffer.byteLength(data) > 1048576) throw new Error("EXPORT_TOO_LARGE");
        return data;
      });
      await writeFile(options.output, data, { flag: "wx", mode: 0o600 });
      console.log(`Authorized metadata export written to ${options.output}; this is not a full/restorable database backup.`);
    });
}
