import { Command } from "commander";
import type { Cortex } from "@cortexmemory/sdk";
import type { CLIConfig, OutputFormat } from "../types.js";
import { withClient, getErasureGraphParticipant } from "../utils/client.js";
import { loadConfig, resolveConfig } from "../utils/config.js";
import { selectDeployment } from "../utils/deployment-selector.js";
import { formatJSON, formatOutput, printWarning, redactSecrets } from "../utils/formatting.js";
import { requireConfirmation, requireExactConfirmation } from "../utils/validation.js";

type Options = { deployment?: string; scopeUser?: string; graphSync?: "auto" | "off" | "required"; tenant?: string; format?: OutputFormat; quiet?: boolean; limit?: string; offset?: string; stats?: boolean; includeHistory?: boolean; cascade?: boolean; dryRun?: boolean; verify?: boolean; yes?: boolean; data?: string; file?: string; output?: string; type?: string; status?: string; name?: string; metadata?: string; reason?: string; id?: string };
function objectJSON(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("JSON must be an object");
  return value as Record<string, unknown>;
}
function integer(text: string, minimum = 1, maximum = 1000): number {
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < minimum || Number(text) > maximum)
    throw new Error(`Expected an integer from ${minimum} to ${maximum}`);
  return Number(text);
}
function emit(value: unknown, options: Options, title: string, headers?: string[]): void {
  const format = options.format ?? "table";
  console.log(formatOutput(value, format, { title, headers }));
  // Preserve human access to nested profile/metadata/history fields which tables abbreviate.
  if (format === "table" && value && typeof value === "object" && !Array.isArray(value))
    for (const [key, nested] of Object.entries(value))
      if (nested !== null && typeof nested === "object")
        console.log(`${key}:\n${formatJSON(nested)}`);
}
// Fixed maintenance authority remains separate from ordinary caller scope.
async function erasureTarget(config: CLIConfig, selected: string, options: Options) {
  if (options.tenant !== undefined && !options.tenant.trim()) throw new Error("--tenant must be nonempty");
  const resolved = resolveConfig(config, { deployment: selected });
  if (!resolved.key?.trim()) throw new Error("Cascade erasure requires a deployment administrator key");
  return { url: resolved.url, deploymentKey: resolved.key };
}
function redactedErasure(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactedErasure);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, redactedErasure(nested)]));
  return value;
}
function emitErasureFailure(error: unknown, options: Options): void {
  const failure = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = failure.cause && typeof failure.cause === "object" ? failure.cause as Record<string, unknown> : {};
  emit(redactedErasure({ complete: false, error: error instanceof Error ? error.message : "Erasure failed",
    receipt: failure.receipt ?? cause.receipt, deleted: failure.deleted, userIds: failure.userIds,
    outcomes: failure.outcomes, unstarted: failure.unstarted,
    cause: { code: cause.code, outcome: cause.outcome, message: cause instanceof Error ? cause.message : undefined },
  }), options, "Erasure stopped");
}
function action(command: Command, operation: (args: unknown[], options: Options, config: CLIConfig, run: <T>(fn: (client: Cortex) => Promise<T>) => Promise<T>, selected: string) => Promise<void>): void {
  command.action(async (...args: unknown[]) => {
    const leaf = args[args.length - 1] as Command;
    const options = leaf.opts<Options>();
    const config = await loadConfig();
    const selection = await selectDeployment(config, options, leaf.name());
    if (!selection) throw new Error("No deployment selected");
    await operation(args.slice(0, -2), options, config, fn => withClient(config, { ...options, deployment: selection.name, maintenance: leaf.name() === "delete" && Boolean(options.cascade) }, fn), selection.name);
  });
}
async function confirmed(id: string, options: Options, config: CLIConfig): Promise<boolean> {
  if (options.yes || options.dryRun) return true;
  return options.cascade
    ? requireExactConfirmation(id, `Type "${id}" to confirm cascade deletion:`)
    : requireConfirmation(`Continue operation for ${id}?`, config);
}
import { validateMemorySpaceId, validateMemorySpaceType, validateMemorySpaceStatus } from "../utils/validation.js";
function filters(o: Options) {
  return { type: o.type ? validateMemorySpaceType(o.type) : undefined, status: o.status ? validateMemorySpaceStatus(o.status) : undefined };
}
function nonempty(value: string | undefined, field: string): string {
  if (!value?.trim()) throw new Error(`${field} must not be empty`);
  return value;
}
export function registerSpaceCommands(program: Command, _config: CLIConfig): void {
  const spaces = program.command("spaces").description("Manage memory spaces");
  const leaf = (name: string, description: string) => spaces.command(name).description(description).option("-d, --deployment <name>", "Target deployment");
  const filterOptions = (cmd: Command) => cmd.option("-t, --type <type>", "personal, team, project, custom").option("-s, --status <status>", "active, archived");
  action(filterOptions(leaf("list", "List a page of memory spaces"))
    .option("-l, --limit <number>", "Page size (1-1000)", "100")
    .option("--offset <number>", "Page offset", "0")
    .option("-f, --format <format>", "Output format: table, json, csv"), async (_args, o, _config, run) => {
      const filter = { ...filters(o), limit: integer(o.limit!), offset: integer(o.offset!, 0, Number.MAX_SAFE_INTEGER) };
      await run(async client => {
        const page = await client.memorySpaces.list(filter);
        emit(o.format === "json" ? page : page.spaces, o, "Memory Spaces");
        if (page.hasMore) printWarning(`More spaces available; continue with --offset ${filter.offset + page.spaces.length}`);
      });
    });
  action(leaf("create <spaceId>", "Create a memory space")
    .requiredOption("-t, --type <type>", "personal, team, project, custom")
    .option("-n, --name <name>", "Human-readable name")
    .option("-m, --metadata <json>", "JSON metadata object", "{}"), async ([id], o, _config, run) => {
      validateMemorySpaceId(id as string);
      const type = validateMemorySpaceType(o.type!), metadata = objectJSON(o.metadata!);
      if (o.name !== undefined) nonempty(o.name, "name");
      await run(async client => {
        if (await client.memorySpaces.get(id as string)) throw new Error(`Memory space ${id} already exists`);
        emit(await client.memorySpaces.register({ memorySpaceId: id as string, type, name: o.name, metadata }), o, `Created memory space ${id}`);
      });
    });
  action(leaf("get <spaceId>", "Get memory space details")
    .option("-f, --format <format>", "Output format: table, json, csv"), async ([id], o, _config, run) => {
      validateMemorySpaceId(id as string);
      await run(async client => {
        const space = await client.memorySpaces.get(id as string);
        if (!space) throw new Error(`Memory space ${id} not found`);
        emit(space, o, `Memory Space: ${id}`);
      });
    });
  action(leaf("delete <spaceId>", "Delete space and its SDK-supported data; --cascade required")
    .option("--cascade", "Required SDK cascade acknowledgement", false)
    .option("--tenant <tenantId>", "Exact maintenance tenant scope (omitted: tenantless only)")
    .option("--dry-run", "Preview supported deletion scope", false)
    .option("--verify", "Verify cascade completeness (default)", true)
    .option("--no-verify", "Explicitly skip cascade verification")
    .option("-r, --reason <reason>", "Deletion audit reason")
    .option("-y, --yes", "Skip confirmation", false), async ([id], o, config, run, selected) => {
      validateMemorySpaceId(id as string);
      if (!o.cascade) throw new Error("Memory-space deletion requires --cascade; use spaces archive to preserve data");
      if (o.tenant !== undefined && !o.tenant.trim()) throw new Error("--tenant must be nonempty");
      if (o.reason !== undefined) nonempty(o.reason, "reason");
      if (!await confirmed(id as string, o, config)) { emit({ cancelled: true }, o, "Cancelled"); return; }
      const target = await erasureTarget(config, selected, o);
      await run(async client => {
        const graphParticipant = await getErasureGraphParticipant(client, target);
        const transport = client.memorySpaces.createErasureTransport(target);
        let result;
        try { result = await client.memorySpaces.delete(id as string, { cascade: true, reason: o.reason ?? "Deleted via CLI", confirmId: id as string,
          dryRun: o.dryRun, verify: o.verify, tenantId: o.tenant, erasureTransport: transport, ...(graphParticipant ? { graphParticipant } : {}) }); }
        catch (error) { emitErasureFailure(error, o); throw error; }
        finally { transport.close(); }
        emit(redactedErasure(result), o, o.dryRun ? "Space deletion preview" : "Space deletion result");
        if (!o.dryRun && !result.deleted) throw new Error(`Memory space ${id} could not be deleted`);
        if (!o.dryRun && o.verify !== false && !result.erasure?.complete) throw new Error("Space deletion incomplete; inspect original receipt");
      });
    });
  action(leaf("archive <spaceId>", "Archive a memory space, preserving data")
    .option("-r, --reason <reason>", "Archive audit reason")
    .option("-y, --yes", "Skip confirmation", false), async ([id], o, config, run) => {
      validateMemorySpaceId(id as string);
      if (o.reason !== undefined) nonempty(o.reason, "reason");
      if (!await confirmed(id as string, o, config)) { emit({ cancelled: true }, o, "Cancelled"); return; }
      await run(async client => emit(await client.memorySpaces.archive(id as string, { reason: o.reason }), o, `Archived memory space ${id}`));
    });
  action(leaf("reactivate <spaceId>", "Reactivate an archived space"), async ([id], o, _config, run) => {
    validateMemorySpaceId(id as string);
    await run(async client => emit(await client.memorySpaces.reactivate(id as string), o, `Reactivated memory space ${id}`));
  });
  action(leaf("stats <spaceId>", "Get memory space statistics")
    .option("-f, --format <format>", "Output format: table, json, csv"), async ([id], o, _config, run) => {
      validateMemorySpaceId(id as string);
      await run(async client => {
        if (!await client.memorySpaces.get(id as string)) throw new Error(`Memory space ${id} not found`);
        emit(await client.memorySpaces.getStats(id as string), o, `Statistics for ${id}`);
      });
    });
  action(leaf("participants <spaceId>", "List participant attribution records")
    .option("-f, --format <format>", "Output format: table, json, csv"), async ([id], o, _config, run) => {
      validateMemorySpaceId(id as string);
      await run(async client => {
        const space = await client.memorySpaces.get(id as string);
        if (!space) throw new Error(`Memory space ${id} not found`);
        emit(space.participants ?? [], o, `Participants in ${id}`, ["id", "type", "joinedAt"]);
      });
    });
  action(leaf("add-participant <spaceId>", "Add a participant attribution record")
    .requiredOption("-i, --id <participantId>", "Participant ID")
    .requiredOption("-t, --type <type>", "Participant type"), async ([id], o, _config, run) => {
      validateMemorySpaceId(id as string);
      const participant = { id: nonempty(o.id, "participant ID"), type: nonempty(o.type, "participant type"), joinedAt: Date.now() };
      await run(async client => emit(await client.memorySpaces.addParticipant(id as string, participant), o, `Added participant ${o.id}`));
    });
  action(leaf("remove-participant <spaceId>", "Remove a participant attribution record")
    .requiredOption("-i, --id <participantId>", "Participant ID")
    .option("-y, --yes", "Skip confirmation", false), async ([id], o, config, run) => {
      validateMemorySpaceId(id as string); nonempty(o.id, "participant ID");
      if (!await confirmed(id as string, o, config)) { emit({ cancelled: true }, o, "Cancelled"); return; }
      await run(async client => {
        const space = await client.memorySpaces.get(id as string);
        if (!space) throw new Error(`Memory space ${id} not found`);
        if (!space.participants?.some(p => p.id === o.id)) throw new Error(`Participant ${o.id} not found in ${id}`);
        emit(await client.memorySpaces.removeParticipant(id as string, o.id!), o, `Removed participant ${o.id}`);
      });
    });
  action(leaf("update <spaceId>", "Update name/status and shallow-merge metadata")
    .option("-n, --name <name>", "New name")
    .option("-s, --status <status>", "active, archived")
    .option("-m, --metadata <json>", "JSON object to shallow-merge"), async ([id], o, _config, run) => {
      validateMemorySpaceId(id as string);
      if (o.name === undefined && o.status === undefined && o.metadata === undefined) throw new Error("At least one of --name, --status, --metadata is required");
      const name = o.name === undefined ? undefined : nonempty(o.name, "name");
      const status = o.status === undefined ? undefined : validateMemorySpaceStatus(o.status);
      const metadata = o.metadata === undefined ? undefined : objectJSON(o.metadata);
      await run(async client => {
        const existing = await client.memorySpaces.get(id as string);
        if (!existing) throw new Error(`Memory space ${id} not found`);
        const updates = { name, status, metadata: metadata === undefined ? undefined : { ...existing.metadata, ...metadata } };
        emit(await client.memorySpaces.update(id as string, updates), o, `Updated memory space ${id}`);
      });
    });
  action(filterOptions(leaf("count", "Exact count of matching spaces")), async (_args, o, _config, run) => {
    const filter = filters(o);
    await run(async client => emit({ count: await client.memorySpaces.count(filter), ...filter }, o, "Memory space count"));
  });
  action(filterOptions(leaf("search <query>", "Search spaces by name/metadata"))
    .option("-l, --limit <number>", "Maximum results (1-1000)", "20")
    .option("-f, --format <format>", "Output format: table, json, csv"), async ([query], o, _config, run) => {
      nonempty(query as string, "query"); const filter = { ...filters(o), limit: integer(o.limit!) };
      await run(async client => {
        const results = await client.memorySpaces.search(query as string, filter);
        emit(results, o, `Search results for ${query}`);
        if (results.length === filter.limit) printWarning("Result limit reached; search may be truncated");
      });
    });
}
