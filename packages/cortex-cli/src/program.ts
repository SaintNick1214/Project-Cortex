/** Reusable real registry. Importing this module neither parses argv nor loads env. */
import { Command } from "commander";
import pc from "picocolors";
import type { CLIConfig } from "./types.js";
import {
  currentAdmissionContext, discoverAdmission, recheckAdmission, structuralProtected,
  type CommandIntent,
} from "./utils/bootstrap-admission.js";
import { validateOutputFormat, validateLimit } from "./utils/validation.js";
import { configureDiagnostics } from "./utils/formatting.js";
import { validateClientScope } from "./utils/client.js";
// Core commands
import { registerInitCommand } from "./commands/init.js";
import { registerInstallCommand } from "./commands/install.js";
import { registerGraphCommands } from "./commands/graph.js";
import { registerSchemaCommands } from "./commands/schema.js";
import { registerTemplatesCommands, type TemplateCommandServices } from "./commands/templates.js";
import { registerStatusCommands } from "./commands/status.js";
import { registerConfigCommands } from "./commands/setup.js";
import { registerDbCommands } from "./commands/db.js";
import {
  registerDevCommands,
  registerNativeLifecycleCommands,
} from "./commands/dev.js";
import { registerDoctorCommands } from "./commands/doctor.js";
// Memory operations
import { registerMemoryCommands } from "./commands/memory.js";
import { registerUserCommands } from "./commands/users.js";
import { registerSpaceCommands } from "./commands/spaces.js";
import { registerFactsCommands } from "./commands/facts.js";
import { registerConversationsCommands } from "./commands/conversations.js";
// Convex operations
import { registerConvexCommands } from "./commands/convex.js";
// Deploy/update commands (top-level)
import { registerDeployCommands } from "./commands/deploy.js";
// Shell completion
import { registerCompletionCommand } from "./commands/completion.js";

export interface ProgramOptions {
  version?: string;
  /** Entrypoint metadata for quiet-aware diagnostics; registry imports never load env. */
  environmentPath?: string;
  admissionOnly?: boolean;
  onAdmission?: (intent: CommandIntent) => void;
  expectedIntent?: CommandIntent;
  /** Explicit template service seams; no work is started by registry construction. */
  templateServices?: TemplateCommandServices;
}
export class AdmissionComplete extends Error {
  constructor(readonly intent: CommandIntent) { super("Internal admission complete"); }
}
/** One closest-explicit resolver for both real Commander passes. Defaults never hide explicit ancestors. */
export function effectiveOptions(action: Command): { options: Record<string, unknown>; sources: Record<string, string> } {
  const ancestors: Command[] = [];
  for (let node: Command | null = action; node; node = node.parent) ancestors.unshift(node);
  const options: Record<string, unknown> = {}; const sources: Record<string, string> = {};
  for (const node of ancestors) {
    for (const [name, value] of Object.entries(node.opts())) {
      const source = node.getOptionValueSource(name) ?? "default";
      if (source === "cli" || sources[name] !== "cli") { options[name] = value; sources[name] = source; }
    }
  }
  return { options, sources };
}
export function commandIntent(action: Command): CommandIntent {
  const path: string[] = [];
  for (let node: Command | null = action; node?.parent; node = node.parent) path.unshift(node.name());
  const resolved = effectiveOptions(action);
  return Object.freeze({ path: Object.freeze(path), args: Object.freeze([...action.processedArgs]), options: Object.freeze(resolved.options), sources: Object.freeze(resolved.sources) });
}
export function sameCommandIntent(first: CommandIntent, second: CommandIntent): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}
function validateActionOptions(path: string, resolved: Record<string, unknown>): void {
  if (resolved.format !== undefined) {
    const formats = path === "conversations export" ? ["json", "txt"]
      : ["memory export", "facts export", "users export"].includes(path) ? ["json", "csv"]
      : ["status", "convex status"].includes(path) ? ["table", "json", "csv", "dashboard"] : ["table", "json", "csv"];
    if (!formats.includes(String(resolved.format))) throw new Error(`Invalid output format for ${path}: use ${formats.join(", ")}`);
  }
  for (const name of ["limit", "messages", "lines"]) if (resolved[name] !== undefined) {
    const value = String(resolved[name]);
    if (!/^\d+$/.test(value)) throw new Error(`--${name} must be a positive integer`);
    validateLimit(Number(value));
  }
}
/** Retain deferred grammar solely for explicit refusal; no ordinary-operation fallback. */
function registerAdmissionGrammar(program: Command): void {
  const snapshot = program.command("snapshot").description("Protected restore (deferred; unsupported in this release)");
  snapshot.command("create <name>").requiredOption("--project <directory>", "Canonical project association").requiredOption("--yes", "Authorize fresh create")
    .option("--offline", "Use only verified local assets").option("--asset-dir <path>", "Verified asset location").action(() => { throw new Error("RESTORE_RUNTIME_UNAVAILABLE: protected restore is deferred and unsupported in this release"); });
  for (const name of ["status", "resume", "release", "stop", "discard"]) {
    const leaf = snapshot.command(`${name} <sessionId>`);
    if (name !== "status") leaf.requiredOption("--yes", "Authorize owned operation");
    if (name === "release") leaf.option("--select", "Select released alias in its scope");
    if (name === "discard") leaf.requiredOption("--confirm-name <name>", "Exact proposed alias");
    leaf.action(() => { throw new Error("RESTORE_RUNTIME_UNAVAILABLE: protected restore is deferred and unsupported in this release"); });
  }
  for (const groupName of ["db", "convex"]) {
    const group = program.commands.find(command => command.name() === groupName)!;
    group.commands.find(command => command.name() === "export")!.option("--restore-bundle", "Deferred protected restore; unsupported in this release");
    group.commands.find(command => command.name() === "import")!.option("--restore-session <sessionId>", "Deferred protected restore; unsupported in this release").option("--provenance <path>", "Deferred protected restore; unsupported in this release");
  }
}
export function createProgram(
  config: CLIConfig,
  options: ProgramOptions = {},
): Command {
  const program = new Command();
  program
    .name("cortex")
    .description(
      "Manage Cortex Memory deployments and administrative operations",
    )
    .version(options.version ?? "0.36.0")
    .option("-d, --deployment <name>", "Deployment alias from configuration")
    .option("-f, --format <format>", "Output format: table, json, csv")
    .option("--quiet", "Suppress diagnostic hints")
    .option("--debug", "Show diagnostic details on stderr")
    .configureHelp({ sortSubcommands: false, sortOptions: false });
  // This factory hook is installed before every ordinary hook/registration.
  program.hook("preAction", async (_root, action) => {
    const intent = commandIntent(action);
    validateActionOptions(intent.path.join(" "), intent.options as Record<string, unknown>);
    const path = intent.path.join(" ");
    const maintenance = path === "users export" || (["users delete", "users delete-many", "spaces delete"].includes(path) && intent.options.cascade === true);
    validateClientScope({ ...intent.options, maintenance });
    if (maintenance) {
      const tenants: string[] = [];
      for (let node: Command | null = action; node; node = node.parent)
        if (node.getOptionValueSource("tenant") === "cli") tenants.push(String(node.opts().tenant));
      if (new Set(tenants).size > 1) throw new Error("Conflicting explicit maintenance tenant selections; supply one exact target tenant");
    }
    if (options.admissionOnly) {
      options.onAdmission?.(intent);
      throw new AdmissionComplete(intent);
    }
    if (options.expectedIntent && !sameCommandIntent(options.expectedIntent, intent))
      throw new Error("ADMISSION_INTENT_CHANGED: execution must use the admitted argv");
    const bound = currentAdmissionContext();
    const context = bound ?? await discoverAdmission(intent);
    if (context.mode === "owned-data-only") {
      if (!bound) throw new Error("ADMISSION_CONTEXT_REQUIRED: direct protected handlers need an internal action context");
      await recheckAdmission(context);
      const route = intent.path.join(" ");
      const readOrSafeConfig = ["config show", "config list", "config deployments", "config set", "use"].includes(route);
      if (structuralProtected(intent) || !readOrSafeConfig)
        throw new Error("RESTORE_RUNTIME_UNAVAILABLE: protected restore is deferred and unsupported in this release");
      if (route === "config set" && !["format", "default", "confirmDangerous"].includes(String(intent.args[0])))
        throw new Error("ADMISSION_OWNED_CONFIG_IMMUTABLE: release/discard owns registered bindings");
    }
  });
  // Register core commands (in display order)
  registerNativeLifecycleCommands(program, config); // foreground start, retired stop
  registerDeployCommands(program, config); // deploy, update (top-level for easy access)
  registerStatusCommands(program, config); // status
  registerDoctorCommands(program, config);
  registerConfigCommands(program, config); // config
  registerInitCommand(program, config, options.templateServices); // init
  registerInstallCommand(program);
  registerGraphCommands(program);
  registerSchemaCommands(program);
  registerTemplatesCommands(program, options.templateServices);
  registerDbCommands(program, config); // db
  registerDevCommands(program, config); // dev

  // Register memory operations (hidden from main list, shown in custom section)
  registerMemoryCommands(program, config);
  registerUserCommands(program, config);
  registerSpaceCommands(program, config);
  registerFactsCommands(program, config);
  registerConversationsCommands(program, config);

  // Register Convex operations
  registerConvexCommands(program, config);

  registerAdmissionGrammar(program);

  // Register shell completion command
  registerCompletionCommand(program);

  // Hide memory operation commands from main list (will show in custom section)
  const memoryOpsCommands = [
    "memory",
    "users",
    "spaces",
    "facts",
    "conversations",
  ];
  for (const cmd of program.commands) {
    if (memoryOpsCommands.includes(cmd.name())) {
      // Commander.js uses _hidden property internally
      (cmd as unknown as { _hidden: boolean })._hidden = true;
    }
  }

  // Add custom help section for memory operations
  program.addHelpText(
    "after",
    `
${pc.bold("Memory Operations:")}
  memory                      Manage memories (vector store)
  users                       Manage user profiles and data
  spaces                      Manage memory spaces
  facts                       Manage extracted facts
  conversations|convs         Manage conversations
`,
  );

  // Register the same global flags at every path so both placements are accepted.
  // Explicit values beat defaults, closest explicit option beats an ancestor.
  const walk = (command: Command): void => {
    command.passThroughOptions(false).enablePositionalOptions();
    for (const [name, flags, description] of [
      [
        "deployment",
        "-d, --deployment <name>",
        "Deployment alias from configuration",
      ],
      ["format", "-f, --format <format>", "Output format: table, json, csv"],
      ["quiet", "--quiet", "Suppress diagnostic hints"],
      ["debug", "--debug", "Diagnostic details on stderr"],
      ["scopeUser", "--scope-user <id>", "Explicit caller scope user (not a target/filter)"],
      ["tenant", "--tenant <id>", "Exact tenant scope (ordinary operations require --scope-user)"],
      ["graphSync", "--graph-sync <mode>", "Graph policy: auto, off, required"],
    ])
      if (!command.options.some((option) => option.attributeName() === name)) {
        const short = flags.split(",")[0];
        const availableFlags =
          flags.includes(",") &&
          command.options.some((option) => option.short === short)
            ? flags.split(", ")[1]
            : flags;
        command.option(availableFlags, description);
      }
    command.commands.forEach(walk);
  };
  walk(program);
  program.hook("preAction", (_root, action) => {
    const effective = effectiveOptions(action);
    for (const [name, value] of Object.entries(effective.options))
      if (effective.sources[name] === "cli") action.setOptionValueWithSource(name, value, "cli");
    if (action.opts().format === undefined)
      action.setOptionValueWithSource("format", config.format, "config");
    const resolved = action.opts();
    const path = commandIntent(action).path.join(" ");
    validateActionOptions(path, resolved);
    if (program.getOptionValueSource("format") === "cli") validateOutputFormat(program.opts().format);
    configureDiagnostics({
      format: resolved.format ?? config.format,
      quiet: Boolean(resolved.quiet),
      secrets: Object.values(config.deployments)
        .map((deployment) => deployment.key)
        .filter((key): key is string => Boolean(key)),
    });
    if (resolved.debug && !resolved.quiet) {
      if (options.environmentPath)
        console.error(
          `[DEBUG] Loaded project environment from ${options.environmentPath}`,
        );
      console.error(
        `[DEBUG] cortex ${path}; format=${resolved.format}; explicit target=${resolved.deployment ? "yes" : "no"}`,
      );
    }
  });
  // Each command disposes only its own handle; postAction must not drain concurrent operations.
  return program;
}
