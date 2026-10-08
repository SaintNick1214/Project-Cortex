/** Owned executable versions; the discovery registry never supplies execution authority. */
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import { canonicalModelJson, MODEL_OPERATION_KEYS, resolveModelPolicy } from "../src/domain/model-policy";
import type { ModelOperationKey, TrustedModelPolicyRecord } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { assertUnicode, boundedIdentifier, clientRequestKey, utf8Bytes } from "../src/domain/transcript";
import { requireDataAuthority, dataAuthorityReference } from "./runtimeDataAuth";
import { recheckAuthority } from "./runtimeAuth";
import { lookupDeploymentManifest } from "./runtimeModelPolicyBootstrap";
import { NATIVE_TOOL_NAMES } from "../src/domain/agent-tools";

export const EXECUTABLE_REGISTRY = Object.freeze({ version: 1,
  tools: Object.freeze({ "memory.remember": 1, "memory.recall": 1 }),
  contexts: Object.freeze({ "cortex.transcript": 1 }) });
export async function executableRegistryHash(): Promise<string> { return await semanticHash(canonicalModelJson(EXECUTABLE_REGISTRY)); }
function denied(code = "POLICY_DENIED"): never {
  throw new ConvexError({ version: 1, code, message: "Agent definition control failed.", retryable: false, outcome: "not_dispatched" });
}
function unicode(s: string): boolean { try { assertUnicode(s); return true; } catch { return false; } }
const text = z.string().min(1).max(256).refine(s => s.trim() === s && unicode(s));
const positive = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const rules = z.object({ modelId: text.optional(), nativeInterface: z.enum(["chat", "responses", "messages", "embedding", "image", "video"]).optional(),
  allowedModels: z.array(text).min(1).optional(), interfaces: z.array(z.enum(["chat", "responses", "messages", "embedding", "image", "video"])).min(1).optional(),
  capabilities: z.array(z.enum(["text", "structured", "tools", "embedding", "image", "video"])).min(1).optional(),
  allowedOptions: z.array(z.enum(["temperature", "topP", "seed", "stopSequences"])).optional(), allowedTools: z.array(text).optional(), fallbackModels: z.array(text).optional(),
  limits: z.object({ inputTokens: positive, contextTokens: positive, outputTokens: positive, toolSteps: count, timeoutMs: positive,
    operationBudgetUnits: positive, runBudgetUnits: positive, tenantBudgetUnits: positive, concurrency: positive }).partial().strict().optional(),
  pins: z.object({ promptVersion: text, schemaVersion: text, extractionVersion: text, toolRegistryVersion: text, priceRevision: text, boundRevision: text }).partial().strict().optional(),
}).strict();
const policyInput = z.object({ policyId: text, version: positive, operationKey: z.enum(MODEL_OPERATION_KEYS).optional(), rules }).strict();
const definitionInput = z.object({ instructions: z.object({ text: z.string().max(60_000).refine(unicode), promptVersion: text }).strict(),
  tools: z.array(z.object({ toolId: text, toolVersion: positive, registryHash: z.string().regex(/^[a-f0-9]{64}$/),
    requiredCapability: z.literal("tool"), approval: z.enum(["none", "explicit"]) }).strict()).max(32),
  context: z.object({ handlerId: text, handlerVersion: positive, registryHash: z.string().regex(/^[a-f0-9]{64}$/),
    memoryMode: z.enum(["indexed-plus-pending", "strict"]), requiredStages: z.array(z.enum(["facts", "vectors", "graph"])).max(3), maxContextTokens: positive,
    barrier: z.object({ deadlineMs: z.number().int().min(1).max(120_000), onFailure: z.enum(["fail", "incomplete"]) }).strict().optional() }).strict(),
  policies: z.array(policyInput).min(1).max(32),
}).strict();
export type ExecutableDefinitionV1 = Omit<z.infer<typeof definitionInput>, "policies"> & {
  version: 1; agentId: string; agentVersion: number; tenantId: string; memorySpaceId: string; ownerPrincipalId: string;
  policies: TrustedModelPolicyRecord[];
};
function one<T>(rows: T[]): T | undefined { if (rows.length > 1) denied(); return rows[0]; }
function decodeInput(input: unknown): z.infer<typeof definitionInput> {
  let detached: unknown;
  try { const bytes = canonicalModelJson(input); if (utf8Bytes(bytes) > 180_000) denied("INVALID_INPUT"); detached = JSON.parse(bytes); }
  catch { return denied("INVALID_INPUT"); }
  const parsed = definitionInput.safeParse(detached);
  if (!parsed.success) denied("INVALID_INPUT");
  return parsed.data;
}
async function registry(input: z.infer<typeof definitionInput>): Promise<void> {
  const hash = await executableRegistryHash();
  const seen = new Set<string>();
  for (const tool of input.tools) {
    if (seen.has(tool.toolId) || !Object.prototype.hasOwnProperty.call(EXECUTABLE_REGISTRY.tools, tool.toolId)
      || EXECUTABLE_REGISTRY.tools[tool.toolId as keyof typeof EXECUTABLE_REGISTRY.tools] !== tool.toolVersion || tool.registryHash !== hash) denied();
    seen.add(tool.toolId);
  }
  if (!Object.prototype.hasOwnProperty.call(EXECUTABLE_REGISTRY.contexts, input.context.handlerId)
    || EXECUTABLE_REGISTRY.contexts[input.context.handlerId as keyof typeof EXECUTABLE_REGISTRY.contexts] !== input.context.handlerVersion
    || input.context.registryHash !== hash || new Set(input.context.requiredStages).size !== input.context.requiredStages.length) denied();
  if (new Set(input.policies.map(p => p.operationKey ?? "*")).size !== input.policies.length
    || !input.policies.some(p => p.operationKey === undefined || p.operationKey === "agent.respond")) denied();
}
/** Same root/tenant narrowing as the existing policy resolver, with no second budget implementation. */
async function narrowPolicies(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, definition: ExecutableDefinitionV1): Promise<void> {
  const roots = await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", q => q.eq("scope", "deployment").eq("tenantId", undefined).eq("active", true)).take(65);
  const root = roots[0]?.root;
  const manifest = root && lookupDeploymentManifest(root.manifestId, root.revision);
  if (!manifest || !roots.length || roots.length > 64 || roots.some(row => row.revokedAt !== undefined || canonicalModelJson(row.root) !== canonicalModelJson(root))) denied("CAPABILITY_UNAVAILABLE");
  if (root!.canonical !== canonicalModelJson(manifest) || root!.hash !== await semanticHash(root!.canonical)) denied();
  const tenantRows = await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", q => q.eq("scope", "tenant").eq("tenantId", reference.tenantId).eq("active", true)).take(65);
  if (tenantRows.length > 64 || tenantRows.some(row => row.revokedAt !== undefined || canonicalModelJson(row.root) !== canonicalModelJson(root))) denied();
  const tenantPolicies = tenantRows.map(row => JSON.parse(row.canonical) as TrustedModelPolicyRecord);
  const keys = [...new Set(definition.policies.map(p => p.operationKey ?? "agent.respond"))];
  for (const key of keys) {
    const policies = [...manifest.policies.filter(p => p.scope === "deployment" && (!p.operationKey || p.operationKey === key)),
      ...tenantPolicies.filter(p => !p.operationKey || p.operationKey === key), ...definition.policies.filter(p => !p.operationKey || p.operationKey === key)];
    try {
      const resolved = resolveModelPolicy({ context: { scope: reference, agent: { agentId: definition.agentId, version: definition.agentVersion },
        operationKey: key, runBudgetId: "definition-validation", authorizedOverrides: [] }, policies, qualifications: manifest.qualifications });
      if (definition.context.maxContextTokens > resolved.limits.contextTokens || definition.tools.some(t => !resolved.allowedTools.includes(NATIVE_TOOL_NAMES[t.toolId as keyof typeof NATIVE_TOOL_NAMES]))) denied();
    } catch { denied(); }
  }
}
async function rowFor(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, agent: { agentId: string; version: number }) {
  return one(await ctx.db.query("runtimeAgentDefinitions").withIndex("by_scoped_version", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).eq("agentId", agent.agentId).eq("version", agent.version)).take(2));
}
async function checkRow(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, row: Doc<"runtimeAgentDefinitions">,
  capability: "run" | "admin", allowRevoked = false): Promise<ExecutableDefinitionV1> {
  if (!reference.memorySpaceId || row.tenantId !== reference.tenantId || row.memorySpaceId !== reference.memorySpaceId
    || (!allowRevoked && row.revokedAt !== undefined)) denied();
  await recheckAuthority(ctx, reference, { capability, resource: { resourceType: "source", resourceId: canonicalModelJson(["executable-agent", row.agentId, row.version]),
    tenantId: row.tenantId, memorySpaceId: row.memorySpaceId, ownerPrincipalId: row.ownerPrincipalId } });
  let value: ExecutableDefinitionV1;
  try { value = JSON.parse(row.definitionCanonical) as ExecutableDefinitionV1; } catch { return denied(); }
  if (canonicalModelJson(value) !== row.definitionCanonical || await semanticHash(row.definitionCanonical) !== row.definitionHash
    || value.version !== 1 || value.agentId !== row.agentId || value.agentVersion !== row.version || value.tenantId !== row.tenantId
    || value.memorySpaceId !== row.memorySpaceId || value.ownerPrincipalId !== row.ownerPrincipalId) denied();
  const { version: _version, agentId: _agentId, agentVersion: _agentVersion, tenantId: _tenantId, memorySpaceId: _memorySpaceId,
    ownerPrincipalId: _owner, policies: fullPolicies, ...input } = value;
  const policies = fullPolicies.map(policy => {
    if (policy.scope !== "agent" || policy.tenantId !== row.tenantId || policy.agentId !== row.agentId || policy.agentVersion !== row.version || policy.override) denied();
    const { scope: _scope, tenantId: _tenant, agentId: _agent, agentVersion: _agentV, ...body } = policy;
    return body;
  });
  const decoded = decodeInput({ ...input, policies }); await registry(decoded);
  return value;
}
export async function readCurrentExecutableDefinition(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference,
  selector: { agentId: string; version: number }, requirement: { capability: "run" | "admin"; operationKey?: ModelOperationKey }) {
  boundedIdentifier(selector.agentId); if (!Number.isSafeInteger(selector.version) || selector.version < 1) denied("INVALID_INPUT");
  const row = await rowFor(ctx, reference, selector); if (!row) denied("CAPABILITY_UNAVAILABLE");
  const definition = await checkRow(ctx, reference, row, requirement.capability);
  await narrowPolicies(ctx, reference, definition);
  await recheckAuthority(ctx, reference, { capability: requirement.capability, tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId });
  return { definitionDocId: row._id, definitionHash: row.definitionHash, definitionCanonical: row.definitionCanonical,
    definition, tenantId: row.tenantId, agent: selector, policies: definition.policies };
}
export const publishVersion = mutation({ args: { memorySpaceId: v.string(), clientMutationId: v.string(), agentId: v.optional(v.string()),
  expectedPreviousVersion: v.number(), definitionInput: v.any() }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, { memorySpaceId: args.memorySpaceId }, "admin");
  const reference = dataAuthorityReference(actor); clientRequestKey(args.clientMutationId);
  if (!Number.isSafeInteger(args.expectedPreviousVersion) || args.expectedPreviousVersion < 0) denied("INVALID_INPUT");
  if (args.agentId !== undefined) boundedIdentifier(args.agentId);
  const input = decodeInput(args.definitionInput); await registry(input);
  const identity = canonicalModelJson(["agent.publish.v1", actor.tenantId, actor.memorySpaceId, actor.principalId,
    args.agentId === undefined ? ["create"] : ["existing", args.agentId], args.clientMutationId]);
  const hash = await semanticHash(identity); const request = canonicalModelJson({ identity, expectedPreviousVersion: args.expectedPreviousVersion, definitionInput: input });
  if (utf8Bytes(request) > 180_000) denied("INVALID_INPUT");
  const replay = one(await ctx.db.query("runtimeAgentDefinitions").withIndex("by_scoped_publish", q => q.eq("tenantId", actor.tenantId)
    .eq("memorySpaceId", actor.memorySpaceId).eq("publishPrincipalId", actor.principalId).eq("publishIdentityHash", hash)).take(2));
  if (replay) {
    if (replay.publishIdentityCanonical !== identity || replay.publishRequestCanonical !== request) denied("IDEMPOTENCY_CONFLICT");
    await checkRow(ctx, reference, replay, "admin");
    return { agentId: replay.agentId, version: replay.version, definitionHash: replay.definitionHash };
  }
  let owner = actor.principalId;
  if (args.agentId !== undefined) {
    const previous = one(await ctx.db.query("runtimeAgentDefinitions").withIndex("by_scoped_version", q => q.eq("tenantId", actor.tenantId)
      .eq("memorySpaceId", actor.memorySpaceId).eq("agentId", args.agentId!)).order("desc").take(1));
    if (!previous || previous.version !== args.expectedPreviousVersion) denied("IDEMPOTENCY_CONFLICT");
    await checkRow(ctx, reference, previous, "admin"); owner = previous.ownerPrincipalId;
  } else if (args.expectedPreviousVersion !== 0) denied("IDEMPOTENCY_CONFLICT");
  const agentId = args.agentId ?? `agent:${hash}`; const version = args.expectedPreviousVersion + 1;
  if (!Number.isSafeInteger(version)) denied("INVALID_INPUT");
  const definition: ExecutableDefinitionV1 = { version: 1, agentId, agentVersion: version, tenantId: actor.tenantId,
    memorySpaceId: actor.memorySpaceId, ownerPrincipalId: owner, ...input,
    policies: input.policies.map(policy => ({ ...policy, scope: "agent", tenantId: actor.tenantId, agentId, agentVersion: version })) };
  const encoded = canonicalModelJson(definition); if (utf8Bytes(encoded) > 180_000) denied("INVALID_INPUT");
  await narrowPolicies(ctx, reference, definition);
  const definitionHash = await semanticHash(encoded);
  await recheckAuthority(ctx, reference, { capability: "admin", tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId });
  await ctx.db.insert("runtimeAgentDefinitions", { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId, ownerPrincipalId: owner,
    agentId, version, definitionCanonical: encoded, definitionHash, authorReference: reference, createdAt: Date.now(),
    publishPrincipalId: actor.principalId, publishIdentityCanonical: identity, publishIdentityHash: hash, publishRequestCanonical: request });
  return { agentId, version, definitionHash };
} });
export const revokeVersion = mutation({ args: { memorySpaceId: v.string(), agentId: v.string(), version: v.number(), expectedDefinitionHash: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireDataAuthority(ctx, { memorySpaceId: args.memorySpaceId }, "admin"); const reference = dataAuthorityReference(actor);
    boundedIdentifier(args.reason, 1024);
    const row = await rowFor(ctx, reference, { agentId: args.agentId, version: args.version }); if (!row) denied();
    await checkRow(ctx, reference, row, "admin", true);
    if (row.definitionHash !== args.expectedDefinitionHash) denied("IDEMPOTENCY_CONFLICT");
    if (row.revokedAt === undefined) await ctx.db.patch("runtimeAgentDefinitions", row._id,
      { revokedAt: Date.now(), revocationActorReference: reference, revocationReason: args.reason });
    return { revoked: true as const };
  } });
export const get = query({ args: { memorySpaceId: v.string(), tenantId: v.optional(v.string()), agentId: v.string(), version: v.number() }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId }, "run");
  const current = await readCurrentExecutableDefinition(ctx, dataAuthorityReference(actor), { agentId: args.agentId, version: args.version }, { capability: "run" });
  return { agentId: args.agentId, version: args.version, definitionHash: current.definitionHash,
    tools: current.definition.tools.map(tool => ({ toolId: tool.toolId, toolVersion: tool.toolVersion })), memoryMode: current.definition.context.memoryMode };
} });
