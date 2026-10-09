/** Controlled handler/component port. Actual Convex OCC/rollback is verified separately on the disposable Agent target. */
import { jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { DeploymentPolicyManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import type { TrustedModelPolicyRecord } from "../../../src/domain/model-policy";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { semanticHash } from "../../../src/domain/profile";
import { LARGE_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import { DEFAULT_GATEWAY_POLICY_MANIFEST } from "../../../convex-dev/runtimeGatewayQualifications";
import { AGENT_NATIVE_TOOLS, AGENT_TOOL_REGISTRY_VERSION } from "../../../src/domain/agent-tools";
import { AGENT_NATIVE_TOOLS_V2, AGENT_TOOL_REGISTRY_VERSION_V2 } from "../../../src/domain/agent-tools";

const lookup = jest.fn<(id: string, revision: number) => DeploymentPolicyManifest | undefined>();
const bootstrap = await import("../../../convex-dev/runtimeModelPolicyBootstrap");
let root: DeploymentPolicyManifest;
jest.unstable_mockModule("../../../convex-dev/runtimeModelPolicyBootstrap", () => ({ ...bootstrap,
  lookupDeploymentManifest: lookup, isTrustedDeploymentManifest: (value: DeploymentPolicyManifest) => value === root }));
export const definitions = await import("../../../convex-dev/agentDefinitions");
export const transcript = await import("../../../convex-dev/runtimeTranscript");
export const runs = await import("../../../convex-dev/runs");
export const ledger = await import("../../../convex-dev/runtimeModelPolicy");
export const clock = 1_000_000;
const limits = { inputTokens: 160_000, contextTokens: 250_000, outputTokens: 2000, toolSteps: 0, timeoutMs: 10_000,
  operationBudgetUnits: 100, runBudgetUnits: 500, tenantBudgetUnits: 1000, concurrency: 8 };
const pins = { promptVersion: "prompt-1", schemaVersion: "schema-1", extractionVersion: "extract-1", toolRegistryVersion: "tools-1", priceRevision: "price-1", boundRevision: "bound-1" };
const policy: TrustedModelPolicyRecord = { policyId: "deployment", version: 1, scope: "deployment", rules: { modelId: "openai/gpt-4o-mini", nativeInterface: "chat",
  allowedModels: ["openai/gpt-4o-mini"], interfaces: ["chat"], capabilities: ["text"], allowedOptions: [], allowedTools: [], fallbackModels: [], limits, pins } };
export function installMockRoot(options: { tools?: boolean } = {}) {
  const hash = "a".repeat(64);
  const activePolicy: TrustedModelPolicyRecord = options.tools ? { ...policy, rules: { ...policy.rules, capabilities: ["text", "tools"],
    allowedTools: ["memory_recall", "memory_remember"], limits: { ...limits, toolSteps: 4 }, pins: { ...pins, toolRegistryVersion: AGENT_TOOL_REGISTRY_VERSION } } } : policy;
  root = { manifestId: "transcript-offline-root", revision: 1, artifactRevision: "offline", evidenceHash: hash, acceptanceHash: hash,
    classification: "fixture-synthetic", budgetWindowMs: 60_000, policies: [activePolicy],
    qualifications: [{ receiptId: "offline-chat", modelId: "openai/gpt-4o-mini", nativeInterface: "chat", capabilities: options.tools ? ["text", "tools"] : ["text"], allowedOptions: [], limits: activePolicy.rules.limits as typeof limits,
      costBound: { kind: "qualified-call-ceiling", maximumCostUnits: 100, provenance: "OFFLINE_ONLY", coversAllProviderCharges: true }, priceRevision: "price-1", boundRevision: "bound-1" }],
    dispatchEvidence: [{ receiptId: "offline-chat", evidenceHash: hash, providerVersion: "OFFLINE_ONLY", modelId: "openai/gpt-4o-mini", nativeInterface: "chat",
      inputBound: { ruleId: options.tools ? "agent-tools-chat-utf8-v1" : "plain-chat-cookbook-utf8-v1", revision: 1, featureEnvelope: options.tools ? "agent-tools-chat-v1" : "plain-chat-v1", nativeTransformHash: hash, documentHash: hash, proofHash: hash },
      ...(options.tools ? { toolContract: { registryVersion: AGENT_TOOL_REGISTRY_VERSION, toolsCanonical: canonicalModelJson(AGENT_NATIVE_TOOLS), maximumToolCalls: 4 } } : {}),
      resultBound: { maximumPrivateResultBytes: 60_000, maximumOutputTokens: 2000, maximumEmbeddingValues: 1, proofHash: hash },
      checkedAt: clock - 1, expiresAt: clock + 100_000, terminalCost: "gateway-aggregate-usd-v1", terminalProof: "provider-terminal-v1", priceRevision: "price-1", boundRevision: "bound-1" }] };
  lookup.mockReset(); lookup.mockImplementation((id, revision) => id === root.manifestId && revision === root.revision ? root : undefined);
  jest.spyOn(Date, "now").mockReturnValue(clock);
}
/** Provisional CODE-only envelope. Never an installed production qualification. */
export function installMediaMockRoot(options: { callbacks?: boolean; v2?: boolean } = {}) {
  installMockRoot({ tools: true }); const hash = "a".repeat(64);
  const image = "openai/gpt-image-1", video = "google/veo-3.1-fast-generate-preview";
  const toolVersion = options.v2 ? AGENT_TOOL_REGISTRY_VERSION_V2 : AGENT_TOOL_REGISTRY_VERSION;
  const catalog = options.v2 ? AGENT_NATIVE_TOOLS_V2 : AGENT_NATIVE_TOOLS;
  root = { ...root, policies: root.policies.map(item => ({ ...item, rules: { ...item.rules, allowedModels: [...item.rules.allowedModels!, image, video],
    interfaces: ["chat", "image", "video"], capabilities: ["text", "tools", "image", "video"], allowedTools: catalog.map(tool => tool.name), pins: { ...item.rules.pins, toolRegistryVersion: toolVersion } } })),
    dispatchEvidence: root.dispatchEvidence.map(proof => ({ ...proof, inputBound: { ...proof.inputBound, featureEnvelope: options.v2 ? "agent-tools-chat-v2" : "agent-tools-chat-v1" }, toolContract: { ...proof.toolContract!, registryVersion: toolVersion, toolsCanonical: canonicalModelJson(catalog) } })),
    qualifications: [...root.qualifications, ...(["image", "video"] as const).map(kind => ({ ...root.qualifications[0]!, receiptId: `offline-${kind}`, modelId: kind === "image" ? image : video, nativeInterface: kind, capabilities: [kind] }))] };
  root = { ...root, policies: [...root.policies, ...(["image", "video"] as const).map(kind => ({ policyId: `offline-${kind}`, version: 1, scope: "deployment" as const, operationKey: kind === "image" ? "media.image.generate" as const : "media.video.generate" as const,
    rules: { modelId: kind === "image" ? image : video, nativeInterface: kind, capabilities: [kind], allowedTools: [], limits: { toolSteps: 0 } } }))],
    dispatchEvidence: [...root.dispatchEvidence, ...(["image", "video"] as const).map(kind => ({ ...root.dispatchEvidence[0]!, receiptId: `offline-${kind}`, modelId: kind === "image" ? image : video, nativeInterface: kind, toolContract: undefined,
      inputBound: { ruleId: "media-native-utf8-v1" as const, revision: 1, featureEnvelope: kind === "image" ? "media-image-v1" as const : "media-video-async-v1" as const, nativeTransformHash: hash, documentHash: hash, proofHash: hash },
      resultBound: { ...root.dispatchEvidence[0]!.resultBound, maximumOutputTokens: 0 }, terminalCost: "unavailable" as const,
      mediaContract: { version: 1 as const, options: kind === "image" ? { kind, n: 1 as const, size: "1024x1024" as const, quality: "low" as const, outputFormat: "png" as const } : { kind, n: 1 as const, duration: 4 as const, resolution: "720p" as const, generateAudio: false as const },
        inputProtocol: "none" as const, maximumInputAssetBytes: 0, maximumResultBytes: 20_000_000, callbacks: kind === "video" && !!options.callbacks, terminalIdentity: "requested-only" as const, usage: "optional" as const } }))] };
  root = JSON.parse(JSON.stringify(root)) as DeploymentPolicyManifest;
}
/** Same native policy handlers with controlled installed-manifest time; no service/model claim. */
export function installIngestionMockRoot(options: { large?: boolean } = {}) {
  const installed = clone(DEFAULT_GATEWAY_POLICY_MANIFEST);
  root = { ...installed, manifestId: "ingestion-offline-root", classification: "fixture-synthetic",
    dispatchEvidence: installed.dispatchEvidence.map(proof => ({ ...proof, checkedAt: clock - 1, expiresAt: clock + 600_000 })) };
  if (options.large) {
    const old = root.qualifications.find(item => item.modelId === "openai/text-embedding-3-small")!;
    const proof = root.dispatchEvidence.find(item => item.modelId === old.modelId)!;
    const receiptId = "offline-large-profile";
    const large = root.qualifications.find(item => item.modelId === LARGE_EMBEDDING_PROFILE.modelId);
    const largeProof = large && root.dispatchEvidence.find(item => item.receiptId === large.receiptId);
    if (large && !largeProof) throw new Error("Missing installed large-profile proof");
    const selected = large ?? { ...old, receiptId, modelId: LARGE_EMBEDDING_PROFILE.modelId };
    root = { ...root, revision: root.revision + 1, qualifications: large ? root.qualifications : [...root.qualifications, selected],
      dispatchEvidence: largeProof ? root.dispatchEvidence : [...root.dispatchEvidence, { ...proof, receiptId, modelId: LARGE_EMBEDDING_PROFILE.modelId,
        terminalModelId: "text-embedding-3-large", embeddingProfile: LARGE_EMBEDDING_PROFILE,
        inputBound: { ...proof.inputBound, ruleId: "profile-embedding-utf8-v1", featureEnvelope: "profile-embedding-v1" },
        resultBound: { ...proof.resultBound, maximumPrivateResultBytes: 131072 } }],
      policies: [...root.policies.map(item => ({ ...item, policyId: `${item.policyId}-large-fixture`, version: item.version + 1, rules: { ...item.rules,
        ...(item.rules.allowedModels ? { allowedModels: [...new Set([...item.rules.allowedModels, LARGE_EMBEDDING_PROFILE.modelId])] } : {}) } })),
      ...(["embedding.memory", "embedding.query"] as const).map(operationKey => ({ policyId: `offline-large-${operationKey}`, version: 1,
        scope: "deployment" as const, operationKey, rules: { modelId: LARGE_EMBEDDING_PROFILE.modelId, nativeInterface: "embedding" as const,
          pins: { priceRevision: selected.priceRevision, boundRevision: selected.boundRevision } } }))] };
  }
  lookup.mockReset(); lookup.mockImplementation((id, revision) => id === root.manifestId && revision === root.revision ? root : undefined);
  jest.spyOn(Date, "now").mockReturnValue(clock);
}
export function currentMockRootSelection() { return { manifestId: root.manifestId, expectedRevision: root.revision }; }
// Keep controlled persisted records in the Jest realm, like Convex JSON-decoded values.
export function clone<T>(value: T): T {
  if (value instanceof Map) return new Map([...value].map(([key, item]) => [key, clone(item)])) as T;
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T;
  return value;
}
type Row = Record<string, unknown> & { _id: string; _creationTime: number };
function field(row: Row, path: string): unknown { return path.split(".").reduce<unknown>((v, key) => v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined, row); }
export class TranscriptDb {
  rows = new Map<string, Row[]>(); sequence = 0; writes = 0;
  table(name: string) { if (!this.rows.has(name)) this.rows.set(name, []); return this.rows.get(name)!; }
  seed(table: string, value: Record<string, unknown>) { const row: Row = { ...value, _id: typeof value._id === "string" ? value._id : `${table}:${++this.sequence}`, _creationTime: clock }; this.table(table).push(row); return row; }
  query(table: string) {
    const filters: ((row: Row) => boolean)[] = []; let keys: string[] = []; let direction = 1;
    const selected = () => this.table(table).filter(row => filters.every(f => f(row))).sort((a, b) => {
      for (const key of keys) { const av = field(a, key); const bv = field(b, key); if (av !== bv) return direction * ((av as number | string) < (bv as number | string) ? -1 : 1); }
      return direction * this.table(table).indexOf(a) - direction * this.table(table).indexOf(b);
    });
    const builder = {
      withIndex: (name: string, callback: (q: unknown) => unknown) => {
        const q = { eq: (key: string, value: unknown) => { filters.push(row => field(row, key) === value); return q; },
          gt: (key: string, value: number | string) => { filters.push(row => (field(row, key) as typeof value) > value); return q; },
          lte: (key: string, value: number) => { filters.push(row => (field(row, key) as number) <= value); return q; } };
        callback(q);
        keys = table === "runtimeAssetReferences" && name === "by_owner" ? ["ownerVersion"]
          : table === "runtimeGraphDependencies" && name === "by_upstream" ? ["dependentSourceId"]
          : table === "runtimeGraphSources" ? name === "by_tenant_source" ? ["memorySpaceId"] : ["tenantId", "memorySpaceId", "sourceId"]
          : name === "by_scope_revision" ? ["revision"] : name === "by_queue" ? ["revision", "createdAt"] : name === "by_scope_sequence" || name === "by_owner_sequence" ? ["sequence"] : name === "by_scoped_version" ? ["version"] : name === "by_conversation_status" || name === "by_conversation_queue" || name === "by_conversation" ? ["queueSequence", "sequence"] : name === "by_conversation_position" ? ["order", "stepOrder"] : [];
        return builder;
      },
      filter: (callback: (q: { field(path: string): (row: Row) => unknown; eq(a: unknown, b: unknown): (row: Row) => boolean;
        gt(a: unknown, b: number): (row: Row) => boolean; and(...items: ((row: Row) => boolean)[]): (row: Row) => boolean;
        or(...items: ((row: Row) => boolean)[]): (row: Row) => boolean }) => (row: Row) => boolean) => {
        const expr = { field: (path: string) => (row: Row) => field(row, path),
          eq: (a: unknown, b: unknown) => (row: Row) => (typeof a === "function" ? a(row) : a) === (typeof b === "function" ? b(row) : b),
          gt: (a: unknown, b: number) => (row: Row) => (typeof a === "function" ? a(row) : a) > b,
          or: (...items: ((row: Row) => boolean)[]) => (row: Row) => items.some(item => item(row)),
          and: (...items: ((row: Row) => boolean)[]) => (row: Row) => items.every(item => item(row)) };
        filters.push(callback(expr)); return builder;
      },
      order: (value: string) => { direction = value === "desc" ? -1 : 1; return builder; },
      take: async (n: number) => clone(selected().slice(0, n)), collect: async () => clone(selected()),
      first: async () => selected()[0] ? clone(selected()[0]) : null,
      unique: async () => { const rows = selected(); if (rows.length > 1) throw new Error("Duplicate rows"); return rows[0] ? clone(rows[0]) : null; },
      paginate: async (opts: { cursor: string | null; numItems: number }) => { const rows = selected(); const offset = Number(opts.cursor ?? 0); return { page: clone(rows.slice(offset, offset + opts.numItems)), isDone: offset + opts.numItems >= rows.length, continueCursor: String(offset + opts.numItems) }; },
    }; return builder;
  }
  normalizeId(table: string, id: string) { return id.startsWith(`${table}:`) ? id : null; }
  async get(table: string, id: string) { const row = this.table(table).find(row => row._id === id); return row ? clone(row) : null; }
  async insert(table: string, value: Record<string, unknown>) { this.writes++; return this.seed(table, clone(value))._id; }
  async patch(table: string, id: string, value: Record<string, unknown>): Promise<void>;
  async patch(id: string, value: Record<string, unknown>): Promise<void>;
  async patch(tableOrId: string, idOrValue: string | Record<string, unknown>, value?: Record<string, unknown>) {
    const table = typeof idOrValue === "string" ? tableOrId : tableOrId.split(":")[0];
    const id = typeof idOrValue === "string" ? idOrValue : tableOrId; const patch = typeof idOrValue === "string" ? value! : idOrValue;
    const row = this.table(table).find(row => row._id === id); if (!row) throw new Error("Missing row"); Object.assign(row, clone(patch)); this.writes++;
  }
  async replace(table: string, id: string, value: Record<string, unknown>) { const row = this.table(table).find(row => row._id === id); if (!row) throw new Error("Missing row"); const index = this.table(table).indexOf(row); this.table(table)[index] = { ...clone(value), _id: id, _creationTime: row._creationTime }; this.writes++; }
  async delete(table: string, id: string) { this.rows.set(table, this.table(table).filter(row => row._id !== id)); this.writes++; }
}
export async function invoke<T = unknown>(registration: unknown, ctx: MutationCtx, args: unknown): Promise<T> {
  return await (registration as { _handler(ctx: MutationCtx, args: unknown): Promise<T> })._handler(ctx, args);
}
export async function transcriptFixture(options: { maxContextTokens?: number } = {}) {
  const db = new TranscriptDb();
  const principal = db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "user-a", metadataUserId: "user-a", actorKind: "user", version: 1 });
  const membership = db.seed("runtimeAuthMemberships", { principalId: principal._id, tenantId: "tenant-a", version: 1 });
  db.seed("runtimeAuthScopes", { tenantId: "tenant-a", epoch: 1 }); db.seed("runtimeAuthScopes", { tenantId: "tenant-a", memorySpaceId: "space-a", epoch: 1 });
  const grant = db.seed("runtimeAuthGrants", { principalId: principal._id, membershipId: membership._id, tenantId: "tenant-a", memorySpaceId: "space-a",
    tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "write", "run", "admin"], resourceAccess: "own", version: 1 });
  const reference = { principalId: principal._id, principalVersion: 1, membershipId: membership._id, membershipVersion: 1, grantId: grant._id, grantVersion: 1,
    tenantId: "tenant-a", tenantEpoch: 1, memorySpaceId: "space-a", memorySpaceEpoch: 1 };
  const native = { threads: new Map<string, Record<string, unknown>>(), messages: new Map<string, Record<string, unknown>>(), sequence: 0 };
  const effects = { saves: 0, edits: 0, deletes: 0, budgets: 0 };
  const scheduled: { name: string; args: unknown }[] = [];
  let identity: { issuer: string; subject: string } | null = { issuer: "https://host.test", subject: "user-a" };
  const context = { db, auth: { getUserIdentity: async () => identity }, scheduler: { runAfter: async (_delay: number, ref: unknown, args: unknown) => {
    scheduled.push({ name: getFunctionName(ref as Parameters<typeof getFunctionName>[0]), args }); return `scheduled:${scheduled.length}`;
  } },
  runQuery: async (ref: unknown, input: unknown) => {
    const path = (ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    const args = input as Record<string, unknown>;
    if (!path && getFunctionName(ref as Parameters<typeof getFunctionName>[0]) === "runtimeModelPolicy:embeddingProfile") return await invoke(ledger.embeddingProfile, ctx, args);
    if (path?.endsWith("/getMessagesByIds")) return (args.messageIds as string[]).map(id => native.messages.get(id) ?? null);
    if (path?.endsWith("/listMessagesByThreadId")) {
      const anchor = typeof args.upToAndIncludingMessageId === "string" ? native.messages.get(args.upToAndIncludingMessageId) : undefined;
      const pagination = args.paginationOpts as { cursor: string | null; numItems: number };
      const statuses = args.statuses as string[] | undefined;
      const all = [...native.messages.values()].filter(m => m.threadId === args.threadId && (!statuses || statuses.includes(m.status as string)) && (!anchor || (m.order as number) <= (anchor.order as number)))
        .sort((a, b) => (args.order === "desc" ? -1 : 1) * ((a.order as number) - (b.order as number) || (a.stepOrder as number) - (b.stepOrder as number)));
      const offset = Number(pagination.cursor ?? 0); return { page: all.slice(offset, offset + pagination.numItems), isDone: offset + pagination.numItems >= all.length, continueCursor: String(offset + pagination.numItems) };
    }
    throw new Error("Unexpected query " + path);
  },
  runMutation: async (ref: unknown, input: unknown) => {
    const path = (ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")]; const args = input as Record<string, unknown>;
    if (path?.endsWith("/createThread")) { const id = `thread:${++native.sequence}`; native.threads.set(id, { _id: id, ...args }); return { _id: id }; }
    if (path?.endsWith("/addMessages")) {
      effects.saves++; const threadId = args.threadId as string; const existing = [...native.messages.values()].filter(m => m.threadId === threadId);
      const prompt = typeof args.promptMessageId === "string" ? native.messages.get(args.promptMessageId) : undefined;
      const order = prompt ? prompt.order as number : typeof args.order === "number" ? args.order : Math.max(-1, ...existing.map(m => m.order as number)) + 1;
      let step = Math.max(-1, ...existing.filter(m => m.order === order).map(m => m.stepOrder as number));
      const messages = (args.messages as { message: Record<string, unknown>; status?: string }[]).map(wrapper => {
        const id = `native:${++native.sequence}`; const value = { _id: id, _creationTime: clock, threadId, order, stepOrder: ++step,
          status: wrapper.status ?? "success", tool: false, message: wrapper.message, userId: args.userId };
        native.messages.set(id, value); return value;
      }); return { messages };
    }
    if (path?.endsWith("/updateMessage")) { effects.edits++; const row = native.messages.get(args.messageId as string); if (!row) throw new Error("Missing native row"); Object.assign(row, args.patch); return row; }
    if (path?.endsWith("/deleteByIds")) { effects.deletes++; for (const id of args.messageIds as string[]) native.messages.delete(id); return null; }
    if (path?.endsWith("/deleteAllForThreadIdAsync")) { effects.deletes++; for (const [id, m] of native.messages) if (m.threadId === args.threadId) native.messages.delete(id); native.threads.delete(args.threadId as string); return null; }
    const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]);
    if (name === "runtimeMemory:finalDelivery") return await invoke((await import("../../../convex-dev/runtimeMemory")).finalDelivery, ctx, args);
    if (name === "runtimeAssets:retireAuthority") return await invoke((await import("../../../convex-dev/runtimeAssets")).retireAuthority, ctx, args);
    if (name === "runtimeGraph:retireAuthority") return await invoke((await import("../../../convex-dev/runtimeGraph")).retireAuthority, ctx, args);
    if (name === "runtimeGraph:reconcileScoped") return await invoke((await import("../../../convex-dev/runtimeGraph")).reconcileScoped, ctx, args);
    if (name === "runtimeModelPolicy:cancelBudget") return await invoke(ledger.cancelBudget, ctx, args);
    if (name === "runtimeModelPolicy:cancelAgentBudget") return await invoke(ledger.cancelAgentBudget, ctx, args);
    throw new Error("Unexpected mutation " + name);
  } };
  const ctx = context as unknown as MutationCtx;
  const transaction = async <T>(fn: () => Promise<T>) => {
    const before = clone({ rows: db.rows, writes: db.writes, sequence: db.sequence, native, effects, scheduled });
    try { return await fn(); } catch (error) {
      db.rows = before.rows; db.writes = before.writes; db.sequence = before.sequence; Object.assign(native, before.native); Object.assign(effects, before.effects); scheduled.splice(0, scheduled.length, ...before.scheduled); throw error;
    }
  };
  const call = async <T = unknown>(registration: unknown, args: unknown) => await transaction(async () => await invoke<T>(registration, ctx, args));
  await call(ledger.installDeploymentPolicy, { manifestId: root.manifestId, expectedRevision: root.revision });
  const definitionInput = { instructions: { text: "HIDDEN instructions PROVIDER_SECRET", promptVersion: "prompt-1" }, tools: [],
    context: { handlerId: "cortex.transcript", handlerVersion: 1, registryHash: await definitions.executableRegistryHash(), memoryMode: "indexed-plus-pending", requiredStages: [], maxContextTokens: options.maxContextTokens ?? 160_000 },
    policies: [{ policyId: "agent-default", version: 1, rules: { limits: { toolSteps: 0 } } }] };
  const published = await call<{ agentId: string; version: number; definitionHash: string }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "publish-1", expectedPreviousVersion: 0, definitionInput });
  const request = (key = "input-1", conversationId?: string) => ({ version: 1 as const, agentId: published.agentId, agentVersion: published.version, clientRequestId: key,
    ...(conversationId === undefined ? {} : { conversationId }), parts: [{ type: "text" as const, text: "Hello " }, { type: "text" as const, text: "world!" }] });
  const run = async (key = "input-1", conversationId?: string) => await call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: request(key, conversationId) });
  return { db, native, effects, scheduled, ctx, reference, published, definitionInput, request, run, call, transaction,
    get grant() { return db.table("runtimeAuthGrants").find(r => r._id === grant._id)!; },
    principal, membership, identity: (value: typeof identity) => { identity = value; },
    hash: semanticHash, canonical: canonicalModelJson };
}
