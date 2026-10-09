import { Command } from "commander";
import type { CLIConfig } from "../types.js";
import {
  develop,
  retired,
  targetOptions,
  type ManagementOptions,
} from "../utils/management.js";

export function registerDevCommands(program: Command, config: CLIConfig): void {
  targetOptions(
    program
      .command("dev")
      .description("Run one selected project's foreground native Convex child"),
  )
    .option("--once", "Push once; stop on native failure")
    .option("--sync", "Explicit ownership-safe SDK backend sync")
    .option("--skip-sync", "Compatibility: skip optional backend sync")
    .action((options: ManagementOptions) => develop(config, options));
}
export function registerNativeLifecycleCommands(
  program: Command,
  config: CLIConfig,
): void {
  targetOptions(
    program
      .command("start")
      .description("Compatibility alias for foreground dev"),
  )
    .option("-f, --foreground", "Deprecated no-op: start is always foreground")
    .option("--once", "Push once")
    .option("--convex-only", "Retired: use dev")
    .option("--graph-only", "Retired: use project graph commands")
    .action(
      (
        options: ManagementOptions & {
          convexOnly?: boolean;
          graphOnly?: boolean;
        },
      ) => {
        if (options.convexOnly || options.graphOnly)
          retired(
            "--convex-only/--graph-only are retired; use cortex dev or explicit cortex graph start",
          );
        return develop(config, options);
      },
    );
  program
    .command("stop")
    .description("Retired global supervisor; never inspects or kills processes")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(() =>
      retired(
        "stop is retired; press Ctrl-C in foreground cortex dev/start or use your own process manager",
      ),
    );
}
