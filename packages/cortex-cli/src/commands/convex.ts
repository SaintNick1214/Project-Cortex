import { Command } from "commander";
import type { CLIConfig } from "../types.js";
import {
  develop,
  deploy,
  nativeOperation,
  printFiniteLogs,
  readFiniteLogs,
  resolveNativeTarget,
  retired,
  targetOptions,
  type ManagementOptions,
} from "../utils/management.js";
import { propagateNativeResult, runConvex } from "../utils/convex-runner.js";
import { findInstalledSdk, planBackendSync } from "../utils/schema-sync.js";
import { diagnose, printDiagnosis } from "./doctor.js";
import { deployOptions, updateAction, updateOptions } from "./deploy.js";
import { registerSnapshotCommands } from "./db.js";

function envName(value: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))
    throw new Error("Environment name must be a valid variable identifier");
}
function positive(
  value: unknown,
  name: string,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > max)
    throw new Error(`${name} must be an integer from 1 to ${max}`);
  return Number(value);
}
export function registerConvexCommands(
  program: Command,
  config: CLIConfig,
): void {
  const convex = program
    .command("convex")
    .description("Selected project's installed native Convex 1.46 management");
  deployOptions(
    convex.command("deploy").description("Alias to explicit targeted deploy"),
  ).action((options: ManagementOptions) => deploy(config, options));
  updateOptions(
    convex
      .command("update")
      .description("Alias to targeted dependency plan/apply"),
  ).action((options: ManagementOptions & Record<string, unknown>) =>
    updateAction(config, options),
  );
  targetOptions(
    convex.command("dev").description("Alias to selected foreground dev"),
  )
    .option("--once", "Push once; stop on failure")
    .option("--sync", "Explicit ownership-safe sync")
    .option("--skip-sync", "Compatibility: skip optional sync")
    .action((options: ManagementOptions) => develop(config, options));
  targetOptions(
    convex.command("status").description("Read-only target diagnostics"),
  )
    .option("--check", "Bounded backend identity check")
    .action(async (options: ManagementOptions & { check?: boolean }) =>
      printDiagnosis(await diagnose(config, options), options),
    );
  convex
    .command("init")
    .description("Retired; install then explicit dev/codegen")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(() =>
      retired(
        "convex init is retired; use cortex install [directory], then explicit cortex dev or convex codegen",
      ),
    );
  convex
    .command("schema")
    .description("Alias to installed schema status; never modifies schema")
    .option("--project <directory>", "Selected project directory")
    .action((options: { project?: string; format?: string }) => {
      const project = options.project ?? process.cwd();
      const plan = planBackendSync(project, findInstalledSdk(project));
      const result = {
        sdk: plan.ownership.sdk,
        functions: plan.functions,
        files: Object.keys(plan.files),
        additions: plan.additions,
        updates: plan.updates,
        conflicts: plan.conflicts,
        dryRun: true,
      };
      console.log(
        options.format === "json"
          ? JSON.stringify(result)
          : `SDK ${result.sdk.version}; ${result.files.length} installed backend files; ${result.conflicts.length} conflicts`,
      );
      if (result.conflicts.length)
        throw new Error(
          "Backend conflicts require explicit schema sync review",
        );
    });
  targetOptions(
    convex
      .command("dashboard")
      .description("Native dashboard URL/open for the selected target"),
  )
    .option(
      "--print-url",
      "Print the native dashboard URL without opening browser",
    )
    .action(async (options: ManagementOptions & { printUrl?: boolean }) => {
      const target = resolveNativeTarget(config, options);
      const env =
        target.kind === "local"
          ? target.env
          : {
              CONVEX_DEPLOY_KEY: target.key,
              CONVEX_DEPLOYMENT: target.deployment,
            };
      const result = await runConvex(
        target.project,
        ["dashboard", "--no-open"],
        { env, secrets: [target.key], capture: true },
      );
      if (!propagateNativeResult(result)) return;
      const url = result.stdout.trim();
      if (!/^https?:\/\/\S+$/.test(url))
        throw new Error(
          "Native dashboard is unavailable for this selected target; start its native dev dashboard first",
        );
      console.log(url);
      if (!options.printUrl)
        propagateNativeResult(
          await runConvex(target.project, ["dashboard"], {
            env,
            secrets: [target.key],
          }),
        );
    });
  targetOptions(
    convex
      .command("logs")
      .description(
        "Finite available native log chunk (quiet deployments may wait about 60 seconds; 70-second request deadline); --tail explicitly streams",
      ),
  )
    .option(
      "-n, --lines <number>",
      "Most recent entries in available chunk (1..1000)",
      "50",
    )
    .option("-t, --tail", "Stream native logs until Ctrl-C")
    .option("--jsonl", "Raw native log events as JSONL")
    .option("--success", "Include successful execution summaries")
    .action(
      async (
        options: ManagementOptions & {
          lines?: string;
          tail?: boolean;
          jsonl?: boolean;
          success?: boolean;
        },
      ) => {
        const lines = positive(options.lines, "--lines", 1000);
        const target = resolveNativeTarget(config, options);
        if (!options.tail) {
          try {
            printFiniteLogs(await readFiniteLogs(target, lines), options);
          } catch (error) {
            if ([130, 143].includes(Number(process.exitCode))) {
              console.error("Native log read interrupted");
              return;
            }
            throw error;
          }
          return;
        }
        propagateNativeResult(
          await nativeOperation(
            target,
            [
              "logs",
              "--history",
              String(lines),
              ...(options.jsonl || options.format === "json"
                ? ["--jsonl"]
                : []),
              ...(options.success ? ["--success"] : []),
            ],
            false,
            0,
          ),
        );
      },
    );
  const env = targetOptions(
    convex
      .command("env")
      .description(
        "Native environment management; list defaults to names only",
      ),
  )
    .option("-l, --list", "Compatibility: list variable names")
    .option(
      "-s, --set <assignment>",
      "Compatibility: NAME=value, preserving all characters after first equals",
    )
    .action(
      async (options: ManagementOptions & { list?: boolean; set?: string }) => {
        if (options.list && options.set !== undefined)
          throw new Error("--list and --set are mutually exclusive");
        let argv = ["env", "list", "--names-only"];
        if (options.set !== undefined) {
          const equals = options.set.indexOf("=");
          if (equals < 1) throw new Error("Use --set NAME=value");
          const name = options.set.slice(0, equals),
            value = options.set.slice(equals + 1);
          envName(name);
          argv = ["env", "set", name, value];
        }
        const target = resolveNativeTarget(
          config,
          options,
          options.set !== undefined,
        );
        const result = await nativeOperation(
          target,
          argv,
          options.set !== undefined,
        );
        if (propagateNativeResult(result) && options.set !== undefined)
          console.log("Environment variable set");
      },
    );
  env
    .command("list")
    .description("List names; --values explicitly prints native values")
    .option("--values", "Explicitly include environment variable values")
    .action(async (options: { values?: boolean }, command: Command) => {
      const target = resolveNativeTarget(config, command.optsWithGlobals());
      propagateNativeResult(
        await nativeOperation(target, [
          "env",
          "list",
          ...(options.values ? [] : ["--names-only"]),
        ]),
      );
    });
  env
    .command("get <name>")
    .description("Explicitly print one variable's native value")
    .action(async (name: string, _options: unknown, command: Command) => {
      envName(name);
      propagateNativeResult(
        await nativeOperation(
          resolveNativeTarget(config, command.optsWithGlobals()),
          ["env", "get", name],
        ),
      );
    });
  env
    .command("set <name> <value>")
    .description("Set exact literal value; never echo it in diagnostics")
    .action(
      async (
        name: string,
        value: string,
        _options: unknown,
        command: Command,
      ) => {
        envName(name);
        const result = await nativeOperation(
          resolveNativeTarget(config, command.optsWithGlobals(), true),
          ["env", "set", name, value],
          true,
        );
        if (propagateNativeResult(result))
          console.log("Environment variable set");
      },
    );
  env
    .command("remove <name>")
    .description("Remove selected variable")
    .action(async (name: string, _options: unknown, command: Command) => {
      envName(name);
      propagateNativeResult(
        await nativeOperation(
          resolveNativeTarget(config, command.optsWithGlobals(), true),
          ["env", "remove", name],
        ),
      );
    });
  targetOptions(
    convex
      .command("codegen")
      .description(
        "Generate bindings using selected native endpoint; no implicit sync",
      ),
  )
    .option("--dry-run", "Native codegen dry-run")
    .action(async (options: ManagementOptions) => {
      propagateNativeResult(
        await nativeOperation(resolveNativeTarget(config, options), [
          "codegen",
          ...(options.dryRun ? ["--dry-run"] : []),
        ]),
      );
    });
  targetOptions(
    convex
      .command("run <function> [arguments]")
      .description("Run a native function with explicit selected authority"),
  ).action(
    async (
      fn: string,
      args: string | undefined,
      options: ManagementOptions,
    ) => {
      if (args !== undefined) {
        try {
          const value = JSON.parse(args);
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error();
        } catch {
          throw new Error("Function arguments must be a JSON object");
        }
      }
      propagateNativeResult(
        await nativeOperation(resolveNativeTarget(config, options, true), [
          "run",
          fn,
          args ?? "{}",
        ]),
      );
    },
  );
  targetOptions(
    convex
      .command("data [table]")
      .description("Native table/data inspection; a positive limit is a cap"),
  )
    .option(
      "--limit <number>",
      "Maximum documents (capped native result)",
      "100",
    )
    .option("--order <order>", "Creation order asc|desc", "desc")
    .action(
      async (
        table: string | undefined,
        options: ManagementOptions & { limit?: string; order?: string },
      ) => {
        const limit = positive(options.limit, "--limit");
        if (!["asc", "desc"].includes(options.order ?? ""))
          throw new Error("--order must be asc or desc");
        if (options.format === "csv")
          throw new Error(
            "Native data supports table or json; CSV is unavailable",
          );
        propagateNativeResult(
          await nativeOperation(resolveNativeTarget(config, options), [
            "data",
            ...(table ? [table] : []),
            "--limit",
            String(limit),
            "--order",
            options.order!,
            "--format",
            options.format === "json" ? "json" : "pretty",
          ]),
        );
      },
    );
  registerSnapshotCommands(convex, config);
  const deployment = targetOptions(
    convex
      .command("deployment")
      .description(
        "Select only an already verified project's native development target",
      ),
  );
  deployment
    .command("select")
    .description(
      "Verify/select a local/dev target; anonymous state uses environment selection",
    )
    .action(async (_options: unknown, command: Command) => {
      const target = resolveNativeTarget(
        config,
        command.optsWithGlobals(),
        true,
      );
      if (target.kind === "prod")
        throw new Error(
          "Native selecting production for dev is unsupported; use explicit deploy --prod",
        );
      if (target.env.CONVEX_AGENT_MODE === "anonymous") {
        console.log(
          JSON.stringify({
            alias: target.alias,
            deployment: target.deployment,
            selection: "verified project-local environment",
            instructions:
              "Run cortex dev with the same explicit target; native deployment select local requires cloud-linked project authorization in Convex 1.46",
          }),
        );
        return;
      }
      propagateNativeResult(
        await runConvex(
          target.project,
          [
            "deployment",
            "select",
            target.kind === "local" ? "local" : target.deployment.split(":")[1],
          ],
          {
            env:
              target.kind === "local"
                ? target.env
                : { CONVEX_DEPLOY_KEY: target.key },
            secrets: [target.key],
          },
        ),
      );
    });
  targetOptions(
    convex
      .command("insights")
      .description(
        "Native cloud-only insights; requires native user authentication",
      ),
  )
    .option("--details", "Include native recent events")
    .option("--json", "Native insight JSON")
    .action(
      async (
        options: ManagementOptions & { details?: boolean; json?: boolean },
      ) => {
        const target = resolveNativeTarget(config, options);
        if (target.kind === "local")
          throw new Error(
            "Insights are available only for authenticated cloud deployments; local insights are unsupported",
          );
        propagateNativeResult(
          await runConvex(
            target.project,
            [
              "insights",
              "--deployment",
              target.deployment.split(":")[1],
              ...(options.details ? ["--details"] : []),
              ...(options.json || options.format === "json" ? ["--json"] : []),
            ],
            {
              env: { CONVEX_DEPLOYMENT: target.deployment },
              secrets: [target.key],
            },
          ),
        );
      },
    );
}
