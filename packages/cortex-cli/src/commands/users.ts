import { Command } from "commander";
import type { Cortex, UserExportEvent, UserExportBlob } from "@cortexmemory/sdk";
import { createHash, randomUUID } from "crypto";
import { dirname, basename, join } from "path";
import { open, unlink, readFile } from "fs/promises";
import { renameSync } from "fs";
import type { FileHandle } from "fs/promises";
import type { CLIConfig, OutputFormat } from "../types.js";
import { withClient, getErasureGraphParticipant, acquireForegroundSignalHandler } from "../utils/client.js";
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
// The CLI preserves its existing-profile target contract; the SDK still supports orphan erasure.
async function requireCascadeProfiles(client: Cortex, target: { url: string; deploymentKey: string }, userIds: string[], tenantId?: string): Promise<void> {
  const controller = new AbortController();
  const transport = client.users.createExportTransport(target);
  const scope = tenantId === undefined ? { kind: "tenantless" as const } : { kind: "tenant" as const, tenantId };
  try {
    for (const userId of userIds) {
      const missing = () => new Error(`User ${userId} has no profile in the selected tenant scope; CLI cascade requires an existing profile. Use the SDK supported-erasure API for orphan data`);
      let inspected;
      try { inspected = await transport.inspect({ userId, scope }, { signal: controller.signal }); }
      catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "EXPORT_PROFILE_NOT_FOUND") throw missing();
        throw error;
      }
      if (!inspected.profile) throw missing();
    }
  } finally { controller.abort(); }
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
    await operation(args.slice(0, -2), options, config, fn => withClient(config, { ...options, deployment: selection.name, maintenance: leaf.name() === "export" || (Boolean(options.cascade) && ["delete", "delete-many"].includes(leaf.name())) }, fn), selection.name);
  });
}
async function confirmed(id: string, options: Options, config: CLIConfig): Promise<boolean> {
  if (options.yes || options.dryRun) return true;
  return options.cascade
    ? requireExactConfirmation(id, `Type "${id}" to confirm cascade deletion:`)
    : requireConfirmation(`Continue operation for ${id}?`, config);
}
import { validateUserId, validateFilePath } from "../utils/validation.js";

// Version1 uses the accepted SDK table order. Store event text, never re-encode raw records.
const exportDomains = ["immutable", "mutable", "conversations", "memories", "facts", "factHistory", "contexts", "sessions", "artifacts", "attachments", "conversationShares", "conversationSnapshots", "memorySpaces", "agents", "governancePolicies", "governanceEnforcement", "graphSyncQueue"] as const;
type ExportManifest = Extract<UserExportEvent, { type: "manifest" }>;
function protocol(condition: unknown): asserts condition {
  if (!condition) throw new Error("Invalid or incomplete version1 user export stream");
}
function natural(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
async function publishExport(client: Cortex, userId: string, options: Options, url: string, deploymentKey: string): Promise<ExportManifest> {
  const controller = new AbortController();
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const cancel = () => { controller.abort(); };
  const releaseSignal = acquireForegroundSignalHandler(async () => { cancel(); await finished; });
  process.on("SIGINT", cancel); process.on("SIGTERM", cancel);
  const checkAbort = () => { if (controller.signal.aborted) throw new Error("User export cancelled"); };
  let iterator: AsyncGenerator<UserExportEvent> | undefined, file: FileHandle | undefined;
  let ownedStage: string | undefined, result: ExportManifest | undefined, failure: unknown, failed = false;
  const cleanupFailures: string[] = [];
  try {
    checkAbort();
    const transport = client.users.createExportTransport({ url, deploymentKey });
    iterator = client.users.exportData(userId, { transport, signal: controller.signal, ...(options.tenant === undefined ? {} : { tenantId: options.tenant }) });
    const stage = join(dirname(options.output!), `.${basename(options.output!)}.${randomUUID()}.stage`);
    file = await open(stage, "wx", 0o600); ownedStage = stage;
    async function write(text: string): Promise<void> {
      const bytes = Buffer.from(text, "utf8");
      for (let offset = 0; offset < bytes.length;) {
        checkAbort();
        const { bytesWritten } = await file!.write(bytes, offset, bytes.length - offset, null);
        protocol(Number.isInteger(bytesWritten) && bytesWritten > 0 && bytesWritten <= bytes.length - offset);
        offset += bytesWritten;
      }
    }
    let header: Extract<UserExportEvent, { type: "header" }> | undefined;
    let phase: "header" | "records" | "blobs" | "terminal" = "header";
    let firstRecord = true, firstBlob = true, firstChunk = true;
    const counts = new Map<string, { records: number; projections: number }>();
    const seenRecords = new Set<string>(), blobs = new Map<string, string>();
    let current: { metadata: UserExportBlob; chunks: number; bytes: number; hash: ReturnType<typeof createHash> } | undefined;
    let previousDomain = -1;
    function identityMatches(identity: Extract<UserExportEvent, { type: "header" }> ["identity"]): boolean {
      return Boolean(identity && identity.userId === userId && identity.scope && (options.tenant === undefined
        ? identity.scope.kind === "tenantless" && !("tenantId" in identity.scope)
        : identity.scope.kind === "tenant" && identity.scope.tenantId === options.tenant));
    }
    for (;;) {
      checkAbort();
      const next = await iterator.next(); checkAbort();
      if (next.done) break;
      const event = next.value;
      protocol(event && typeof event === "object" && phase !== "terminal");
      // The actual SDK seam also rejects malformed raw Convex tags and noncanonical values.
      const text = client.users.serializeExportEvent(event);
      switch (event.type) {
        case "header":
          protocol(phase === "header" && !header && event.version === 1 && event.format === "cortex-user-export" && event.consistency === "rolling-read" && natural(event.startedAt) && identityMatches(event.identity));
          header = event; phase = "records";
          await write(`{"header":${text},"records":[`); break;
        case "record": {
          protocol(header && phase === "records" && event.node && typeof event.node.id === "string" && event.node.id.length && /^[a-f0-9]{64}$/.test(event.fingerprint) && ["record", "membershipProjection"].includes(event.disposition) && event.record && typeof event.record === "object" && !Array.isArray(event.record));
          const domain = exportDomains.indexOf(event.node.domain), key = `${event.node.domain}:${event.node.id}`;
          protocol(domain >= previousDomain && domain >= 0 && !seenRecords.has(key)); previousDomain = domain; seenRecords.add(key);
          const count = counts.get(event.node.domain) ?? { records: 0, projections: 0 };
          count[event.disposition === "record" ? "records" : "projections"]++; counts.set(event.node.domain, count);
          await write(`${firstRecord ? "" : ","}${text}`); firstRecord = false; break;
        }
        case "blob":
          protocol(header && (phase === "records" || phase === "blobs") && !current && typeof event.storageId === "string" && event.storageId.length && !blobs.has(event.storageId) && natural(event.size) && typeof event.mimeType === "string" && /^[a-f0-9]{64}$/.test(event.sha256) && Array.isArray(event.referrers) && event.referrers.length && event.referrers.every(ref => ref.node && seenRecords.has(`${ref.node.domain}:${ref.node.id}`) && (ref.version === undefined || natural(ref.version))));
          if (phase === "records") { await write('],"blobs":['); phase = "blobs"; }
          blobs.set(event.storageId, text);
          current = { metadata: event, chunks: 0, bytes: 0, hash: createHash("sha256") }; firstChunk = true;
          await write(`${firstBlob ? "" : ","}{"metadata":${text},"chunks":[`); firstBlob = false; break;
        case "chunk": {
          protocol(phase === "blobs" && current && event.storageId === current.metadata.storageId && event.sequence === current.chunks && natural(event.byteLength) && typeof event.data === "string");
          const bytes = Buffer.from(event.data, "base64");
          protocol(bytes.toString("base64") === event.data && bytes.length === event.byteLength && current.bytes + bytes.length <= current.metadata.size);
          current.hash.update(bytes); current.bytes += bytes.length; current.chunks++;
          await write(`${firstChunk ? "" : ","}${text}`); firstChunk = false; break;
        }
        case "blobEnd":
          protocol(phase === "blobs" && current && event.storageId === current.metadata.storageId && event.chunks === current.chunks && event.size === current.bytes && event.size === current.metadata.size && event.sha256 === current.metadata.sha256 && event.sha256 === current.hash.digest("hex"));
          await write(`],"end":${text}}`); current = undefined; break;
        case "manifest": {
          protocol(header && !current && ["records", "blobs"].includes(phase) && event.version === 1 && event.complete === true && identityMatches(event.identity) && event.consistency === "rolling-read" && event.startedAt === header.startedAt && natural(event.endedAt) && event.endedAt >= event.startedAt && Array.isArray(event.tableManifest) && event.tableManifest.length === exportDomains.length && Array.isArray(event.pageObservations) && Array.isArray(event.diagnostics) && Array.isArray(event.exclusions) && event.exclusions.every(value => typeof value === "string") && Array.isArray(event.blobs) && event.blobs.length === blobs.size && natural(event.pageCount) && natural(event.projectionCount));
          let pageCount = 0;
          event.tableManifest.forEach((entry, index) => {
            const count = counts.get(entry.domain) ?? { records: 0, projections: 0 };
            protocol(entry.domain === exportDomains[index] && natural(entry.pages) && entry.pages === event.pageObservations.filter(observation => observation.domain === entry.domain).length && entry.records === count.records && entry.projections === count.projections);
            pageCount += entry.pages;
          });
          protocol(pageCount === event.pageCount && event.pageObservations.length === event.pageCount && event.projectionCount >= seenRecords.size && (counts.get("immutable")?.records ?? 0) > 0 && event.pageObservations.every(observation => exportDomains.includes(observation.domain) && ["rootProjections", "closureProjections"].includes(observation.selection) && natural(observation.observationTime)));
          const manifestBlobs = new Set<string>();
          for (const blob of event.blobs) {
            protocol(!manifestBlobs.has(blob.storageId) && blobs.get(blob.storageId) === client.users.serializeExportEvent({ type: "blob", ...blob }));
            manifestBlobs.add(blob.storageId);
          }
          if (phase === "records") await write('],"blobs":[');
          await write(`],"manifest":${text}}\n`); result = event; phase = "terminal"; break;
        }
        default: protocol(false);
      }
    }
    protocol(result && phase === "terminal");
    // Return/join the real iterator before publication, including post-terminal failures.
    await iterator.return(undefined); iterator = undefined; checkAbort();
    await file.sync(); checkAbort();
    await file.close(); file = undefined; checkAbort();
    // One synchronous metadata commit: JS signal handlers cannot interleave after
    // the final abort check and before rename. Signals observed after commit do
    // not retroactively turn a published bundle into an aborted stream.
    renameSync(ownedStage!, options.output!); ownedStage = undefined;
  } catch (error) { failed = true; failure = error; controller.abort(); }
  finally {
    if (iterator) try { await iterator.return(undefined); } catch { cleanupFailures.push("iterator cleanup failed"); }
    if (file) try { await file.close(); } catch { cleanupFailures.push("staging close failed"); }
    if (ownedStage) try { await unlink(ownedStage); } catch { cleanupFailures.push("staging removal failed"); }
    process.removeListener("SIGINT", cancel); process.removeListener("SIGTERM", cancel); releaseSignal(); finish();
  }
  if (failed || cleanupFailures.length) {
    const primary = failure instanceof Error ? failure.message : "User export failed";
    throw new Error(redactSecrets(`${primary}${cleanupFailures.length ? `; ${cleanupFailures.join("; ")}` : ""}`).split(deploymentKey).join("***"));
  }
  return result!;
}

// Page every registered space; default SDK list() returns only 100 rows.
async function allSpaces(client: Cortex) {
  const spaces = [];
  let offset = 0;
  for (;;) {
    const page = await client.memorySpaces.list({ limit: 1000, offset });
    spaces.push(...page.spaces);
    if (!page.hasMore) return spaces;
    if (!page.spaces.length) throw new Error("Memory-space pagination made no progress");
    offset += page.spaces.length;
  }
}
async function usage(client: Cortex, userId: string, spaces: Awaited<ReturnType<typeof allSpaces>>) {
  let memories = 0, conversations = 0, facts = 0;
  const spacesWithData: string[] = [];
  for (const space of spaces) {
    const filter = { memorySpaceId: space.memorySpaceId, userId };
    // Exact count APIs avoid list caps; failures propagate instead of silently undercounting.
    const m = await client.memory.count(filter);
    const c = await client.conversations.count(filter);
    const f = await client.facts.count(filter);
    memories += m; conversations += c; facts += f;
    if (m || c || f) spacesWithData.push(space.memorySpaceId);
  }
  return { memories, conversations, facts, spacesWithData };
}
export function registerUserCommands(program: Command, _config: CLIConfig): void {
  const users = program.command("users").description("Manage user profiles and data");
  const leaf = (name: string, description: string) => users.command(name).description(description).option("-d, --deployment <name>", "Target deployment");
  action(leaf("list", "List a page of user profiles with exact usage counts")
    .option("-l, --limit <number>", "Page size (1-1000)", "50")
    .option("--offset <number>", "Page offset", "0")
    .option("-f, --format <format>", "Output format: table, json, csv")
    .option("--no-stats", "Skip usage counts"), async (_args, o, _config, run) => {
      const limit = integer(o.limit!), offset = integer(o.offset!, 0, Number.MAX_SAFE_INTEGER);
      await run(async client => {
        const page = await client.users.list({ limit, offset });
        const spaces = o.stats === false || !page.users.length ? [] : await allSpaces(client);
        const rows = [];
        for (const user of page.users) rows.push(o.stats === false ? user : { ...user, usage: await usage(client, user.id, spaces) });
        emit(o.format === "json" ? { ...page, users: rows } : rows.map(u => ({ id: u.id, version: u.version, ...( "usage" in u ? u.usage : { data: u.data }) })), o, "User Profiles");
        if (page.hasMore) printWarning(`More users available; continue with --offset ${offset + page.users.length}`);
      });
    });
  action(leaf("get <userId>", "Get user profile details")
    .option("-f, --format <format>", "Output format: table, json, csv")
    .option("--include-history", "Include version history", false), async ([id], o, _config, run) => {
      validateUserId(id as string);
      await run(async client => {
        const user = await client.users.get(id as string);
        if (!user) throw new Error(`User ${id} not found`);
        const result = o.includeHistory ? { user, history: await client.users.getHistory(id as string) } : user;
        emit(result, o, `User Profile: ${id}`);
      });
    });
  action(leaf("delete <userId>", "Delete profile or perform supported administrator cascade")
    .option("--cascade", "Delete linked supported user data through the SDK", false)
    .option("--tenant <tenantId>", "Exact cascade tenant scope (omitted: tenantless only)")
    .option("--dry-run", "Preview SDK deletion scope", false)
    .option("--verify", "Verify cascade completeness (default)", true)
    .option("--no-verify", "Explicitly skip cascade verification")
    .option("-y, --yes", "Skip confirmation", false), async ([id], o, config, run, selected) => {
      validateUserId(id as string);
      if (o.tenant !== undefined && !o.tenant.trim()) throw new Error("--tenant must be nonempty");
      if (!await confirmed(id as string, o, config)) { emit({ cancelled: true }, o, "Cancelled"); return; }
      const target = o.cascade ? await erasureTarget(config, selected, o) : undefined;
      await run(async client => {
        let result;
        if (target) {
          await requireCascadeProfiles(client, target, [id as string], o.tenant);
          const graphParticipant = await getErasureGraphParticipant(client, target);
          const transport = client.users.createErasureTransport(target);
          try { result = await client.users.delete(id as string, { cascade: true, dryRun: o.dryRun, verify: o.verify, tenantId: o.tenant, erasureTransport: transport, ...(graphParticipant ? { graphParticipant } : {}) }); }
          catch (error) { emitErasureFailure(error, o); throw error; }
          finally { transport.close(); }
        } else {
          if (!await client.users.exists(id as string)) throw new Error(`User ${id} not found`);
          result = await client.users.delete(id as string, { cascade: false, dryRun: o.dryRun, verify: o.verify });
        }
        emit(target ? redactedErasure({ ...result, dryRun: Boolean(o.dryRun) }) : { ...result, dryRun: Boolean(o.dryRun) }, o, o.dryRun ? "Deletion preview" : "Deletion result");
        if (o.cascade && !o.dryRun && o.verify !== false && !result.verification?.complete)
          throw new Error(`Deletion incomplete: ${result.verification?.issues.join("; ") ?? "verification unavailable"}`);
      });
    });
  action(leaf("delete-many <userIds...>", "Delete up to 100 users with whole-bulk cascade preflight")
    .option("--cascade", "Delete linked supported user data", false)
    .option("--tenant <tenantId>", "Exact cascade tenant scope (omitted: tenantless only)")
    .option("--dry-run", "Preview deletion", false)
    .option("--verify", "Verify cascade completeness (default)", true)
    .option("--no-verify", "Explicitly skip cascade verification")
    .option("-y, --yes", "Skip confirmation", false), async ([ids], o, config, run, selected) => {
      const userIds = ids as string[];
      userIds.forEach(validateUserId);
      if (userIds.length > 100 || new Set(userIds).size !== userIds.length) throw new Error("Supply 1-100 distinct user IDs");
      if (o.tenant !== undefined && !o.tenant.trim()) throw new Error("--tenant must be nonempty");
      if (!await confirmed(userIds.join(", "), o, config)) { emit({ cancelled: true }, o, "Cancelled"); return; }
      const target = o.cascade ? await erasureTarget(config, selected, o) : undefined;
      await run(async client => {
        if (target) {
          await requireCascadeProfiles(client, target, userIds, o.tenant);
          const graphParticipant = await getErasureGraphParticipant(client, target);
          const transport = client.users.createErasureTransport(target);
          let result;
          try { result = await client.users.deleteMany(userIds, { cascade: true, dryRun: o.dryRun, verify: o.verify, tenantId: o.tenant, erasureTransport: transport, ...(graphParticipant ? { graphParticipant } : {}) }); }
          catch (error) { emitErasureFailure(error, o); throw error; }
          finally { transport.close(); }
          emit(redactedErasure({ ...result, dryRun: Boolean(o.dryRun) }), o, o.dryRun ? "Bulk deletion preview" : "Bulk deletion results");
          if (!o.dryRun && o.verify !== false && !result.complete) throw new Error("Bulk deletion incomplete; inspect original outcomes and receipts");
          return;
        }
        const results: Array<{ userId: string; result?: Awaited<ReturnType<Cortex["users"]["delete"]>>; error?: string }> = [];
        for (const userId of userIds) {
          try {
            if (!await client.users.exists(userId)) throw new Error("User not found");
            const result = await client.users.delete(userId, { cascade: false, dryRun: o.dryRun, verify: o.verify });
            results.push({ userId, result });
          } catch (error) { results.push({ userId, error: redactSecrets(error instanceof Error ? error.message : "Deletion failed") }); }
        }
        emit({ dryRun: Boolean(o.dryRun), results }, o, "Bulk deletion results");
        if (results.some(r => r.error)) throw new Error("Some users could not be deleted; inspect per-user results");
      });
    });
  action(leaf("export <userId>", "Export complete version1 SDK-supported user data")
    .addHelpText("after", "\nRequires deployment administrator authority and a deployment key.\nIncludes all eligible retained histories and binary files.\nScope: tenantless only when --tenant is omitted; an explicit --tenant selects exactly that tenant.\nConsistency: rolling-read across reads; no atomic snapshot is guaranteed.")
    .option("-o, --output <file>", "JSON output file", "user-export.json")
    .option("--tenant <tenantId>", "Exact tenant scope (omitted: tenantless only)")
    .option("--format <format>", "JSON export receipt", "json"), async ([id], o, config, run, selected) => {
      validateUserId(id as string); validateFilePath(o.output!);
      if (o.format !== "json") throw new Error("Complete user export supports JSON only; use --format json");
      if (o.tenant !== undefined && !o.tenant.trim()) throw new Error("--tenant must be nonempty");
      const resolved = resolveConfig(config, { deployment: selected });
      if (!resolved.key?.trim()) throw new Error("Complete user export requires a deployment administrator key");
      await run(async client => {
        const manifest = await publishExport(client, id as string, o, resolved.url, resolved.key!);
        emit({ output: o.output, userId: id, version: manifest.version, complete: true, consistency: manifest.consistency,
          records: manifest.tableManifest.reduce((sum, entry) => sum + entry.records, 0),
          projections: manifest.tableManifest.reduce((sum, entry) => sum + entry.projections, 0), blobs: manifest.blobs.length,
          tableManifest: manifest.tableManifest, exclusions: manifest.exclusions }, o, "User export receipt");
      });
    });
  action(leaf("stats <userId>", "Exact counts of user data in registered spaces")
    .option("-f, --format <format>", "Output format: table, json, csv"), async ([id], o, _config, run) => {
      validateUserId(id as string);
      await run(async client => {
        const profile = await client.users.get(id as string);
        if (!profile) throw new Error(`User ${id} not found`);
        const history = await client.users.getHistory(id as string);
        const counts = await usage(client, id as string, await allSpaces(client));
        emit({ userId: id, scope: "registered-memory-spaces", profileVersions: history.length, totalMemories: counts.memories, totalConversations: counts.conversations, totalFacts: counts.facts, memorySpaces: counts.spacesWithData.length, spacesWithData: counts.spacesWithData, profileCreated: profile.createdAt, lastUpdated: profile.updatedAt }, o, `User Statistics: ${id}`);
      });
    });
  action(leaf("update <userId>", "Merge user profile data")
    .option("--data <json>", "JSON object to merge")
    .option("-f, --file <path>", "JSON object file to merge"), async ([id], o, _config, run) => {
      validateUserId(id as string);
      if (Boolean(o.data) === Boolean(o.file)) throw new Error("Supply exactly one of --data or --file");
      const data = objectJSON(o.file ? await readFile(o.file, "utf-8") : o.data!);
      await run(async client => emit(await client.users.merge(id as string, data), o, `Updated user ${id}`));
    });
  action(leaf("create <userId>", "Create a user profile")
    .option("--data <json>", "JSON profile object", "{}"), async ([id], o, _config, run) => {
      validateUserId(id as string); const data = objectJSON(o.data!);
      await run(async client => {
        if (await client.users.get(id as string)) throw new Error(`User ${id} already exists`);
        emit(await client.users.update(id as string, data), o, `Created user ${id}`);
      });
    });
  action(leaf("exists <userId>", "Check user existence (absent exits nonzero)"), async ([id], o, _config, run) => {
    validateUserId(id as string);
    await run(async client => {
      const exists = await client.users.exists(id as string);
      emit({ userId: id, exists }, o, "User existence");
      if (!exists) throw new Error(`User ${id} does not exist`);
    });
  });
}
