import { Command } from "commander";
import {
  TemplateError,
  TemplateApplyError,
  TemplateIntegrationError,
  listCatalogTemplates,
  prepareTemplateInit,
  prepareTemplateUpdate,
  applyPreparedTemplateInit,
  applyPreparedTemplateUpdate,
  type CatalogOptions,
  type PreparedTemplate,
  type TemplateIntegration,
  type TemplateExecutionOutcome,
  createCatalogRegistry,
  installTemplateDependencies,
  isRepeatedTemplate,
  prepareTemplateIntegration,
  recoverCatalogTemplate,
  readTemplateBaseline,
  verifyTemplateManager,
} from "../utils/templates/index.js";
import type {
  PackageManager,
  TemplateId,
} from "../utils/templates/contract.js";
import type { GraphOptions } from "../utils/graph/contract.js";
import type { GraphServiceOptions } from "../utils/graph/service.js";
import { normalizeGraphOptions } from "../utils/graph/contract.js";

export interface TemplateCommandOptions extends CatalogOptions, GraphServiceOptions {
  template?: TemplateId;
  templateVersion?: string;
  to?: string;
  sdkPackage?: string;
  providerPackage?: string;
  yes?: boolean;
  install?: boolean;
  dryRun?: boolean;
  format?: "json" | "csv" | "table";
  local?:boolean; cloud?:boolean; deploy?:boolean; start?:boolean; quiet?:boolean; recover?:boolean;
}
export interface TemplateCommandServices {
  registry?: CatalogOptions["registry"];
  /** Supplied by final integration using actual13 composer and ONE accepted11 service. */
  integration?: (options: TemplateCommandOptions) => TemplateIntegration;
  install?: (
    directory: string,
    manager: PackageManager,
  ) => Promise<{ exitCode: number }>;
  output?: (value: unknown, options: TemplateCommandOptions) => void;
}
const templateIds = ["basic", "vercel-ai-quickstart", "chat-sdk"];
function validateOptions(options: TemplateCommandOptions): void {
  if (options.template !== undefined && !templateIds.includes(options.template))
    throw new TemplateError("TEMPLATE_IDENTITY_INVALID");
  if (
    options.graph !== undefined &&
    !["none", "neo4j", "memgraph"].includes(options.graph)
  )
    throw new TemplateError("TEMPLATE_GRAPH_INVALID");
  if (
    options.skipGraph &&
    options.graph !== undefined &&
    options.graph !== "none"
  )
    throw new TemplateError("TEMPLATE_GRAPH_CONFLICT");
  if (
    options.graphMode !== undefined &&
    !["local", "existing"].includes(options.graphMode)
  )
    throw new TemplateError("TEMPLATE_GRAPH_INVALID");
  const graphOptions: GraphOptions = {};
  for (const name of [
    "graph",
    "skipGraph",
    "graphMode",
    "graphUri",
    "boltPort",
    "httpPort",
  ] as const)
    if (options[name] !== undefined)
      Object.assign(graphOptions, { [name]: options[name] });
  normalizeGraphOptions(graphOptions);
}
const catalogOptions = (command: Command): Command =>
  command
    .option(
      "--catalog-version <version>",
      "Exact catalog release; never latest fallback",
    )
    .option(
      "--templates-package <path>",
      "Explicit local catalog directory or tarball",
    );
async function emit(
  value: unknown,
  options: TemplateCommandOptions,
  services: TemplateCommandServices,
): Promise<void> {
  if (services.output) services.output(value, options);
  else {
    const { formatOutput } = await import("../utils/formatting.js");
    console.log(formatOutput(value, options.format ?? "table"));
  }
}
async function integration(services:TemplateCommandServices,options:TemplateCommandOptions,prepared:PreparedTemplate):Promise<TemplateIntegration|undefined> {
  if(services.integration) return options.dryRun || isRepeatedTemplate(prepared) ? undefined : services.integration(options);
  // Production planning is pure, including dry-run. Runtime apply is a separate returned capability.
  return prepareTemplateIntegration(prepared,options);
}
function installer(
  services: TemplateCommandServices,
  options: TemplateCommandOptions,
  prepared: PreparedTemplate,
): (() => Promise<{ exitCode: number }>) | undefined {
  if (
    options.install === false ||
    options.dryRun ||
    isRepeatedTemplate(prepared)
  )
    return undefined;
  if (!services.install) throw new TemplateError("TEMPLATE_INSTALLER_REQUIRED");
  return () =>
    services.install!(prepared.directory, prepared.baseline.identity.manager);
}
async function observed(
  operation: () => Promise<TemplateExecutionOutcome>,
  options: TemplateCommandOptions,
  services: TemplateCommandServices,
): Promise<void> {
  try {
    await emit(await operation(), options, services);
  } catch (cause) {
    if (
      cause instanceof TemplateApplyError ||
      cause instanceof TemplateIntegrationError
    )
      await emit(cause.outcome, options, services);
    throw cause;
  }
}
/** Definition is isolated until root releases program integration; no source/service side effects on import. */
export function registerTemplatesCommands(
  program: Command,
  services: TemplateCommandServices = {},
): Command {
  services = {
    registry: createCatalogRegistry(),
    install: installTemplateDependencies,
    ...services,
  };
  const group = catalogOptions(
    program
      .command("templates")
      .description(
        "List, install and update independently versioned templates",
      ),
  );
  catalogOptions(
    group
      .command("list")
      .description("Read the current verified catalog offline"),
  ).action(async (_options, command: Command) => {
    const options = {
      ...command.optsWithGlobals(),
      registry: services.registry,
    } as TemplateCommandOptions;
    await emit(await listCatalogTemplates(options), options, services);
  });
  catalogOptions(
    group
      .command("init <directory>")
      .description(
        "Install a selected template into a new or identically owned project",
      ),
  )
    .requiredOption(
      "--template <id>",
      "basic, vercel-ai-quickstart or chat-sdk",
    )
    .option("--template-version <version>", "Exact template version")
    .option("--sdk-package <path>", "Explicit compatible local SDK candidate")
    .option(
      "--provider-package <path>",
      "Explicit compatible local provider candidate",
    )
    .option("--graph <provider>", "none, neo4j or memgraph")
    .option("--skip-graph", "Disable graph setup")
    .option("--graph-mode <mode>", "local or existing")
    .option("--graph-uri <uri>", "Credential-free existing graph URI")
    .option("--graph-bolt-port <port>", "Selected local Bolt port", Number)
    .option("--graph-http-port <port>", "Selected Neo4j HTTP port", Number)
    .option("--graph-credentials <file>", "Explicit private provider credential JSON")
    .option("--yes", "Deterministic noninteractive choices")
    .option("--no-install", "Do not run the matching dependency manager")
    .option(
      "--dry-run",
      "Plan without destination/env/ownership/dependency/service writes",
    )
    .action(async (directory: string, _options, command: Command) => {
      const selected = command.optsWithGlobals();
      const options = {
        ...selected,
        registry: selected.dryRun ? undefined : services.registry,
      } as TemplateCommandOptions;
      options.boltPort=selected.graphBoltPort as number|undefined;options.httpPort=selected.graphHttpPort as number|undefined;options.credentialsFile=selected.graphCredentials as string|undefined;
      validateOptions(options);
      const prepared = await prepareTemplateInit(
        directory,
        options.template!,
        options,
      );
      await executePreparedInit(prepared,options,services);
    });
  catalogOptions(
    group
      .command("update [directory]")
      .description(
        "Update recorded ownership using a full old/local/new preflight",
      ),
  )
    .option("--to <version>", "Exact target template version (required unless --recover)")
    .option("--recover", "Recover only the existing file journal; never replay dependencies/backend/graph")
    .option("--yes", "With --recover, acknowledge manually reconciled original external effects")
    .option("--sdk-package <path>", "Explicit compatible local SDK candidate")
    .option(
      "--provider-package <path>",
      "Explicit compatible local provider candidate",
    )
    .option("--dry-run", "No project/env/metadata/dependency/service writes")
    .option("--no-install", "Do not regenerate dependencies/locks")
    .action(
      async (directory: string | undefined, _options, command: Command) => {
        const selected = command.optsWithGlobals();
        const options = {
          ...selected,
          registry: selected.dryRun ? undefined : services.registry,
        } as TemplateCommandOptions;
        validateOptions(options);
        if (options.recover) {
          if (options.to || options.dryRun || options.sdkPackage || options.providerPackage)
            throw new TemplateError("TEMPLATE_RECOVERY_OPTIONS_CONFLICT");
          const root = directory ?? process.cwd();
          const owned: TemplateId[] = [];
          for (const id of templateIds as TemplateId[]) if (await readTemplateBaseline(root,id)) owned.push(id);
          if (owned.length !== 1) throw new TemplateError("TEMPLATE_OWNERSHIP_REQUIRED_OR_AMBIGUOUS");
          const result = await recoverCatalogTemplate(root,owned[0],{acknowledgeExternalEffects: options.yes});
          await emit(result,options,services);
          if (result.externalEffects === "reconciliation-required")
            throw new TemplateError("TEMPLATE_EXTERNAL_RECONCILIATION_REQUIRED: inspect the original operation receipt; reconcile dependency/native/graph state manually, then use --recover --yes to acknowledge; no operation is replayed");
          return;
        }
        if (!options.to) throw new TemplateError("TEMPLATE_EXACT_VERSION_REQUIRED");
        const prepared = await prepareTemplateUpdate(
          directory ?? process.cwd(),
          { ...options, to: options.to! },
        );
        if (prepared.plan.conflicts.length) {
          await emit(
            { status: "conflict", conflicts: prepared.plan.conflicts },
            options,
            services,
          );
          throw new TemplateError("TEMPLATE_CONFLICT");
        }
        if (!options.dryRun && options.install !== false && !isRepeatedTemplate(prepared) && services.install === installTemplateDependencies)
          await verifyTemplateManager(prepared.baseline.identity.manager,prepared.template.managerMinimum);
        const preview = await integration(services,options,prepared),
          configured = options.dryRun || isRepeatedTemplate(prepared) ? undefined : preview,
          install = installer(services, options, prepared);
        await observed(
          async () => ({ ...preview?.summary, ...await applyPreparedTemplateUpdate(prepared, {
              dryRun: options.dryRun,
              integration: configured,
              install,
            }) }),
          options,
          services,
        );
      },
    );
  return group;
}

async function executePreparedInit(prepared:PreparedTemplate,options:TemplateCommandOptions,services:TemplateCommandServices):Promise<void> {
  if (!options.dryRun && options.install !== false && !isRepeatedTemplate(prepared) && services.install === installTemplateDependencies)
    await verifyTemplateManager(prepared.baseline.identity.manager,prepared.template.managerMinimum);
  const preview=await integration(services,options,prepared),configured=options.dryRun || isRepeatedTemplate(prepared) ? undefined:preview;
  const install=installer(services,options,prepared);
  await observed(async()=>({...preview?.summary,...await applyPreparedTemplateInit(prepared,{dryRun:options.dryRun,integration:configured,install})}),options,services);
}
/** Basic init and explicit templates init share this exact preparation/apply service. */
export async function runCatalogBasicInit(directory:string,options:TemplateCommandOptions,services:TemplateCommandServices={}):Promise<void> {
  const selected={registry:createCatalogRegistry(),install:installTemplateDependencies,...services};
  validateOptions(options);
  const actual={...options,template:"basic" as const,registry:options.dryRun ? undefined:selected.registry};
  const prepared=await prepareTemplateInit(directory,"basic",actual);
  await executePreparedInit(prepared,actual,selected);
}
