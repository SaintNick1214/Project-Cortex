import { loadConfig, resolveConfig } from "../utils/config.js";
import { selectDeployment } from "../utils/deployment-selector.js";
import { acquireForegroundSignalHandler } from "../utils/client.js";
import {
  createReferenceMaintenanceTransport,
  runReferenceMaintenance,
  ReferenceMaintenanceError,
} from "../utils/reference-lifecycle.js";
import { formatCSV } from "../utils/formatting.js";
import { Command } from "commander";
import {
  applyBackendPlan,
  findInstalledSdk,
  planBackendSync,
} from "../utils/schema-sync.js";

export function registerSchemaCommands(program: Command): void {
  const group = program
    .command("schema")
    .description("Inspect and synchronize the installed SDK backend source");
  for (const operation of ["status", "sync"]) {
    const command = group
      .command(`${operation} [directory]`)
      .description(
        operation === "status"
          ? "Inspect actual installed SDK source and ownership"
          : "Synchronize backend files using ownership/conflict preflight",
      );
    if (operation === "sync")
      command
        .option("--dry-run", "Plan with zero project writes")
        .option(
          "--overwrite",
          "Back up and replace conflicting backend files only",
        );
    command.action(
      (
        directory: string | undefined,
        options: {
          dryRun?: boolean;
          overwrite?: boolean;
          format?: string;
          quiet?: boolean;
        },
      ) => {
        const project = directory ?? process.cwd();
        const plan = planBackendSync(project, findInstalledSdk(project));
        const dryConflict =
          operation === "sync" &&
          options.dryRun &&
          plan.conflicts.length &&
          !options.overwrite;
        const backupPath =
          operation === "sync" && !dryConflict
            ? applyBackendPlan(plan, options)
            : undefined;
        const result = {
          sdk: plan.ownership.sdk,
          functions: plan.functions,
          files: Object.keys(plan.files),
          additions: plan.additions,
          updates: plan.updates,
          conflicts: plan.conflicts,
          dryRun: operation === "status" || Boolean(options.dryRun),
          backupPath,
        };
        if (options.format === "json") console.log(JSON.stringify(result));
        else if (options.format === "csv") console.log(formatCSV(result));
        else if (!options.quiet)
          console.log(
            `SDK ${plan.ownership.sdk.version}: ${plan.additions.length} additions, ${plan.updates.length} updates, ${plan.conflicts.length} conflicts${backupPath ? `; backup: ${backupPath}` : ""}`,
          );
        if (plan.conflicts.length && (operation === "status" || dryConflict))
          throw new Error(
            "Backend conflicts require resolution before synchronization",
          );
      },
    );
  }
  for (const operation of ["references", "migrate"] as const) {
    const command = group
      .command(operation)
      .description(
        operation === "references"
          ? "Inspect transactional reference coverage"
          : "Resume reference backfill and validate coverage",
      )
      .option("-d, --deployment <name>", "Deployment to administer")
      .option("-f, --format <format>", "Output format: table, json, csv")
      .option("--quiet", "Suppress human progress output");
    if (operation === "migrate")
      command.option(
        "--dry-run",
        "Read the fixed migration plan without writing deployment data",
      );
    command.action(async (_options: unknown, leaf: Command) => {
      const options = leaf.opts<{
        deployment?: string;
        format?: string;
        quiet?: boolean;
        dryRun?: boolean;
      }>();
      const controller = new AbortController();
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const cancel = () => controller.abort();
      const releaseSignal = acquireForegroundSignalHandler(async () => {
        cancel();
        await finished;
      });
      process.on("SIGINT", cancel);
      process.on("SIGTERM", cancel);
      let transport:
        | ReturnType<typeof createReferenceMaintenanceTransport>
        | undefined;
      const format = options.format ?? "table";
      const emit = (value: Record<string, unknown>) => {
        if (format === "json") console.log(JSON.stringify(value));
        else if (format === "csv")
          console.log(
            formatCSV([
              {
                operation,
                executed: value.executed ?? false,
                ready: value.ready ?? false,
                state: value.state ?? "unknown",
                generation: value.generation ?? "",
                error: value.error ?? "",
                resumable: value.resumable ?? false,
              },
            ]),
          );
        else if (!options.quiet)
          console.log(
            value.error
              ? `Reference maintenance refused: ${value.error}`
              : `Reference coverage ${value.state}; ready=${value.ready}; executed=${value.executed}`,
          );
      };
      try {
        if (!["table", "json", "csv"].includes(format))
          throw new ReferenceMaintenanceError(
            "REFERENCE_OUTPUT_FORMAT: use table, json or csv",
          );
        const config = await loadConfig();
        const selection = await selectDeployment(
          config,
          options,
          `schema ${operation}`,
        );
        if (!selection)
          throw new ReferenceMaintenanceError(
            "REFERENCE_DEPLOYMENT_SELECTION_REQUIRED",
          );
        const selected = resolveConfig(config, {
          ...options,
          deployment: selection.name,
          format: format as "table" | "json" | "csv",
        });
        if (!selected.key)
          throw new ReferenceMaintenanceError(
            "REFERENCE_DEPLOYMENT_KEY_REQUIRED",
          );
        transport = createReferenceMaintenanceTransport(
          selected.url,
          selected.key,
        );
        const result = await runReferenceMaintenance(
          transport,
          operation,
          Boolean(options.dryRun),
          controller.signal,
        );
        emit(result);
        if (operation === "references" && !result.ready) process.exitCode = 1;
      } catch (error) {
        let observed: Record<string, unknown> = {};
        if (
          transport &&
          (controller.signal.aborted ||
            (error instanceof ReferenceMaintenanceError &&
              error.outcomeUnknown))
        ) {
          try {
            observed = await transport.status();
          } catch {
            observed = { state: "unknown", ready: false };
          }
        }
        const code =
          error instanceof ReferenceMaintenanceError
            ? error.code
            : "REFERENCE_CONFIGURATION: verify the selected deployment configuration";
        emit({
          ...observed,
          executed: false,
          error: code,
          outcomeUnknown:
            error instanceof ReferenceMaintenanceError && error.outcomeUnknown,
          resumable: Boolean(observed.generation),
        });
        if (format === "table" && options.quiet) console.error(code);
        process.exitCode = controller.signal.aborted ? 130 : 1;
      } finally {
        process.removeListener("SIGINT", cancel);
        process.removeListener("SIGTERM", cancel);
        finish();
        releaseSignal();
      }
    });
  }
}
