import { Command } from "commander";
import type { CLIConfig } from "../types.js";
import {
  deploy,
  retired,
  targetOptions,
  updatePackages,
  type ManagementOptions,
} from "../utils/management.js";

export function deployOptions(command: Command): Command {
  return targetOptions(command)
    .option("--push", "Alias for --yes")
    .option("-y, --yes", "Authorize explicit production deploy")
    .option(
      "--dry-run",
      "Local/dev zero-write plan; native production deploy dry-run",
    )
    .option("--sync", "Explicit ownership-safe backend sync")
    .option("--skip-sync", "Compatibility: skip optional backend sync");
}
export function updateOptions(command: Command): Command {
  return targetOptions(command)
    .option("--sdk-version <version>", "Exact compatible SDK version")
    .option("--convex-version <version>", "Exact compatible Convex version")
    .option(
      "--sdk-package <path>",
      "Fixed local SDK candidate directory or tarball",
    )
    .option(
      "--dry-run",
      "Review dependency/backend plan with zero project writes",
    )
    .option(
      "--sync",
      "Explicit ownership-safe SDK backend sync after dependency apply",
    )
    .option("--skip-sync", "Compatibility: skip optional backend sync")
    .option("-y, --yes", "Apply selected dependency plan")
    .option("-a, --app <name>", "Retired app updater")
    .option("--apps-only", "Retired app updater")
    .option("--deployments-only", "Retired bulk updater")
    .option("--dev [path]", "Retired development linking")
    .option("--sync-template", "Retired automatic app replacement")
    .option("--provider-version <version>", "Retired app dependency updater");
}
export async function updateAction(
  config: CLIConfig,
  options: ManagementOptions & Record<string, unknown>,
): Promise<void> {
  if (
    [
      "app",
      "appsOnly",
      "deploymentsOnly",
      "dev",
      "syncTemplate",
      "providerVersion",
    ].some((key) => options[key] !== undefined && options[key] !== false)
  )
    retired(
      "App/bulk/template update options are retired; use your application's package manager or cortex templates update separately",
    );
  await updatePackages(config, options);
}
export function registerDeployCommands(
  program: Command,
  config: CLIConfig,
): void {
  deployOptions(
    program
      .command("deploy")
      .description("Deploy only the explicitly selected native target"),
  ).action((options: ManagementOptions) => deploy(config, options));
  updateOptions(
    program
      .command("update")
      .description(
        "Plan/apply selected dependency versions (default pinned SDK 0.38.0 + Convex 1.46.0 pair)",
      ),
  ).action((options: ManagementOptions & Record<string, unknown>) =>
    updateAction(config, options),
  );
}
