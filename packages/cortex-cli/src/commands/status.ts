import { Command } from "commander";
import type { CLIConfig } from "../types.js";
import { diagnose, printDiagnosis } from "./doctor.js";
import { targetOptions, type ManagementOptions } from "../utils/management.js";

export function registerStatusCommands(
  program: Command,
  config: CLIConfig,
): void {
  targetOptions(
    program
      .command("status")
      .description(
        "Read-only selected target diagnostics; unknown states remain explicit",
      ),
  )
    .option("--check", "Bounded backend liveness/identity check")
    .option(
      "-f, --format <format>",
      "Output format: dashboard, table, json, csv",
      "dashboard",
    )
    .action(async (options: ManagementOptions & { check?: boolean }) =>
      printDiagnosis(await diagnose(config, options), options),
    );
}
