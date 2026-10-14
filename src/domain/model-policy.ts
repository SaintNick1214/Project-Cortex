import { z } from "zod";
import type { TrustedMemoryScope } from "./contracts.js";
import { assertProfileMatches, DEFAULT_EMBEDDING_PROFILE, embeddingProfileForModel, normalizeSourceText, semanticHash } from "./profile.js";
import { mediaEnvelopeSchema } from "./media-schemas.js";

/** Pure contracts: only a verified backend lookup may supply policy and qualifications. */
export const MODEL_OPERATION_KEYS = Object.freeze([
  "agent.respond", "memory.extract", "facts.resolve", "memory.summarize", "conversation.title",
  "artifact.text", "artifact.code", "artifact.sheet", "artifact.suggestions",
  "embedding.query", "embedding.memory", "media.image.generate", "media.video.generate",
] as const);
export type ModelOperationKey = typeof MODEL_OPERATION_KEYS[number];
export type NativeModelInterface = "chat" | "responses" | "messages" | "embedding" | "image" | "video";
export type ModelCapability = "text" | "structured" | "tools" | "embedding" | "image" | "video";
export const DEFAULT_CHAT_MODEL_ID = "openai/gpt-4o-mini";
/** Prospective closed lane. These constants confer no native qualification; a
 * separately observed compiled proof must select this exact envelope. */
export const MEMORY_JSON_OBJECT_CONTRACT = Object.freeze({
  modelId: DEFAULT_CHAT_MODEL_ID,
  promptVersion: "memory-extraction-json-object-prompt-v5",
  schemaVersion: "facts-v1",
  toolRegistryVersion: "none-v1",
  featureEnvelope: "memory-extract-json-object-v1",
  inputRule: "memory-json-object-chat-utf8-v1",
  boundRevision: "memory-json-object-8192-512-v1",
  maximumInputTokens: 8192, maximumContextTokens: 16384, maximumOutputTokens: 512,
  maximumPrivateResultBytes: 60000, maximumCostUnits: 100000,
} as const);
export const MODEL_OPERATION_REGISTRY = Object.freeze(Object.fromEntries(MODEL_OPERATION_KEYS.map((key) => [key, Object.freeze({
  key,
  capability: key.startsWith("embedding.") ? "embedding" : key.startsWith("media.image") ? "image" : key.startsWith("media.video") ? "video" : key === "memory.extract" || key === "facts.resolve" ? "structured" : "text",
  interfaces: Object.freeze(key.startsWith("embedding.") ? ["embedding"] : key.startsWith("media.image") ? ["image"] : key.startsWith("media.video") ? ["video"] : ["chat", "responses"]),
  availableInThisPacket: true,
})])) as Readonly<Record<ModelOperationKey, { readonly key: ModelOperationKey; readonly capability: ModelCapability; readonly interfaces: readonly string[]; readonly availableInThisPacket: boolean }>>);

const nonempty = z.string().min(1).max(256).refine((value) => value.trim() === value && value.trim().length > 0);
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positive = integer.min(1);
const modelId = z.string().regex(/^[a-z0-9][a-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const operationKey = z.enum(MODEL_OPERATION_KEYS);
const nativeInterface = z.enum(["chat", "responses", "messages", "embedding", "image", "video"]);
const capability = z.enum(["text", "structured", "tools", "embedding", "image", "video"]);
const optionKey = z.enum(["temperature", "topP", "seed", "stopSequences"]);
export type ModelOptionKey = z.infer<typeof optionKey>;
const limitsSchema = z.object({
  inputTokens: positive, contextTokens: positive, outputTokens: positive, toolSteps: integer,
  timeoutMs: positive, operationBudgetUnits: positive, runBudgetUnits: positive,
  tenantBudgetUnits: positive, concurrency: positive,
}).strict();
export type ModelPolicyLimits = Readonly<z.infer<typeof limitsSchema>>;
export const MODEL_LIMIT_KEYS = Object.freeze(Object.keys(limitsSchema.shape) as (keyof ModelPolicyLimits)[]);
const pinsSchema = z.object({
  promptVersion: nonempty, schemaVersion: nonempty, extractionVersion: nonempty,
  toolRegistryVersion: nonempty, priceRevision: nonempty, boundRevision: nonempty,
}).strict();
export type ModelPolicyPins = Readonly<z.infer<typeof pinsSchema>>;
const rulesSchema = z.object({
  modelId: modelId.optional(), nativeInterface: nativeInterface.optional(),
  allowedModels: z.array(modelId).min(1).optional(), interfaces: z.array(nativeInterface).min(1).optional(),
  capabilities: z.array(capability).min(1).optional(), allowedOptions: z.array(optionKey).optional(),
  allowedTools: z.array(nonempty).optional(), fallbackModels: z.array(modelId).optional(),
  limits: limitsSchema.partial().optional(), pins: pinsSchema.partial().optional(),
}).strict();
export type ModelPolicyRules = z.infer<typeof rulesSchema>;
const policySchema = z.object({
  policyId: nonempty, version: positive, scope: z.enum(["deployment", "tenant", "agent"]),
  tenantId: nonempty.optional(), agentId: nonempty.optional(), agentVersion: positive.optional(),
  operationKey: operationKey.optional(), rules: rulesSchema,
  override: z.object({ actorPrincipalId: nonempty, changeRevision: positive, authorizationId: nonempty }).strict().optional(),
}).strict();
export type TrustedModelPolicyRecord = z.infer<typeof policySchema>;
const costBoundSchema = z.object({
  kind: z.literal("qualified-call-ceiling"), maximumCostUnits: positive, provenance: nonempty,
  coversAllProviderCharges: z.literal(true),
}).strict();
/** Trusted qualification attests this conservative ceiling for ALL charges at its complete caps. */
export type QualifiedModelCostBound = Readonly<z.infer<typeof costBoundSchema>>;
const qualificationSchema = z.object({
  receiptId: nonempty, modelId, nativeInterface, capabilities: z.array(capability).min(1),
  allowedOptions: z.array(optionKey), limits: limitsSchema, costBound: costBoundSchema, priceRevision: nonempty, boundRevision: nonempty,
}).strict();
export type TrustedModelQualification = z.infer<typeof qualificationSchema>;
const scopeSchema = z.object({
  tenantId: nonempty, tenantEpoch: positive, memorySpaceId: nonempty, memorySpaceEpoch: positive,
  principalId: nonempty, principalVersion: positive, membershipId: nonempty, membershipVersion: positive,
  grantId: nonempty, grantVersion: positive,
}).strict();
const profileSchema = z.object({ profileId: nonempty, modelId, dimensions: positive,
  normalization: nonempty, chunking: nonempty, indexName: nonempty }).strict();
const contextSchema = z.object({
  scope: scopeSchema, agent: z.object({ agentId: nonempty, version: positive }).strict().optional(),
  operationKey, parentOperationId: nonempty.optional(), runBudgetId: nonempty,
  source: z.object({ sourceId: nonempty, sourceEventId: nonempty, sourceRevision: positive }).strict().optional(),
  semanticProfile: profileSchema.optional(),
  /** Exact override records authenticated by a separate backend policy-admin check. */
  authorizedOverrides: z.array(z.object({ authorizationId: nonempty, actorPrincipalId: nonempty,
    changeRevision: positive, policyId: nonempty, policyVersion: positive }).strict()),
}).strict();
export type TrustedModelPolicyContext = z.infer<typeof contextSchema>;
const resolutionSchema = z.object({ context: contextSchema, policies: z.array(policySchema).min(1),
  qualifications: z.array(qualificationSchema) }).strict();

export interface ModelPolicySnapshotV1 {
  readonly version: 1;
  readonly operationKey: ModelOperationKey;
  readonly requestedModelId: string;
  readonly modelId: string;
  readonly nativeInterface: NativeModelInterface;
  readonly capabilities: readonly ModelCapability[];
  readonly allowedModels: readonly string[];
  readonly allowedOptions: readonly ModelOptionKey[];
  readonly allowedTools: readonly string[];
  readonly limits: ModelPolicyLimits;
  readonly pins: ModelPolicyPins;
  readonly policyVersions: readonly { readonly policyId: string; readonly version: number; readonly override?: TrustedModelPolicyRecord["override"] }[];
  readonly qualificationReceiptId: string;
  readonly costBound: QualifiedModelCostBound;
  readonly scope: TrustedMemoryScope;
  readonly agent?: TrustedModelPolicyContext["agent"];
  readonly runBudgetId: string;
  readonly parentOperationId?: string;
  readonly source?: TrustedModelPolicyContext["source"];
  readonly semanticProfile?: typeof DEFAULT_EMBEDDING_PROFILE;
  readonly fallbackCandidates: readonly { readonly modelId: string; readonly qualificationReceiptId: string }[];
  readonly currency: "USD";
  readonly monetaryUnit: "micro-USD";
}

function deny(message: string): never { throw new Error(`POLICY_DENIED: ${message}`); }
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error("INVALID_INPUT: invalid model policy contract");
  return result.data;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child: unknown) => freeze(child));
    Object.freeze(value);
  }
  return value;
}
function intersect<T>(left: readonly T[], right?: readonly T[]): T[] {
  return [...new Set(left.filter((item) => right === undefined || right.includes(item)))];
}
function tighten(left: ModelPolicyLimits, right?: Partial<ModelPolicyLimits>): ModelPolicyLimits {
  return Object.fromEntries(MODEL_LIMIT_KEYS.map((key) => [key, Math.min(left[key], right?.[key] ?? left[key])])) as unknown as ModelPolicyLimits;
}
function assertLimits(limits: ModelPolicyLimits): void {
  if (limits.inputTokens > limits.contextTokens || limits.outputTokens > limits.contextTokens ||
      limits.operationBudgetUnits > limits.runBudgetUnits || limits.runBudgetUnits > limits.tenantBudgetUnits) {
    deny("inconsistent token or monetary bounds");
  }
}

/** Caller/env/client model claims are intentionally absent. Missing/ambiguous records fail closed. */
export function resolveModelPolicy(input: unknown): ModelPolicySnapshotV1 {
  canonicalModelJson(input);
  const { context, policies, qualifications } = parse(resolutionSchema, input);
  const operation = MODEL_OPERATION_REGISTRY[context.operationKey];
  if (!operation.availableInThisPacket || (operation.capability === "video" || operation.capability === "image") && !qualifications.some(receipt =>
    receipt.nativeInterface === operation.capability && receipt.capabilities.includes(operation.capability))) {
    throw new Error("CAPABILITY_UNAVAILABLE: media qualification belongs to its service gate");
  }
  const seen = new Set<string>();
  for (const policy of policies) {
    const target = `${policy.scope}:${policy.operationKey ?? "*"}`;
    if (seen.has(target)) deny("ambiguous policy scope");
    seen.add(target);
    if ((policy.operationKey && policy.operationKey !== context.operationKey) ||
        (policy.scope === "deployment" && (policy.tenantId || policy.agentId || policy.agentVersion)) ||
        (policy.scope !== "deployment" && policy.tenantId !== context.scope.tenantId) ||
        (policy.scope === "tenant" && (policy.agentId || policy.agentVersion)) ||
        (policy.scope === "agent" && (!context.agent || policy.agentId !== context.agent.agentId || policy.agentVersion !== context.agent.version))) {
      deny("policy scope does not match trusted context");
    }
    if (policy.scope === "deployment" && policy.override) deny("deployment hard bounds cannot be overridden");
    if (policy.override && !context.authorizedOverrides.some((auth) => auth.authorizationId === policy.override?.authorizationId &&
      auth.actorPrincipalId === policy.override.actorPrincipalId && auth.changeRevision === policy.override.changeRevision &&
      auth.policyId === policy.policyId && auth.policyVersion === policy.version)) deny("unauthorized policy override");
  }
  const rank = (policy: TrustedModelPolicyRecord): number => ["deployment", "tenant", "agent"].indexOf(policy.scope) + (policy.operationKey ? 3 : 0);
  const ordered = [...policies].sort((a, b) => rank(a) - rank(b));
  const deployment = ordered.find((policy) => policy.scope === "deployment" && !policy.operationKey);
  if (!deployment || deployment.override) deny("missing ordinary deployment hard bounds");
  const hard = deployment.rules;
  if (!hard.allowedModels || !hard.interfaces || !hard.capabilities || !hard.allowedOptions || !hard.allowedTools || !hard.fallbackModels) deny("incomplete deployment policy");
  const hardLimits = parse(limitsSchema, hard.limits);
  const hardPins = parse(pinsSchema, hard.pins);
  assertLimits(hardLimits);
  let limits = hardLimits;
  let models = [...hard.allowedModels], interfaces = [...hard.interfaces], capabilities = [...hard.capabilities];
  let options = [...hard.allowedOptions], tools = [...hard.allowedTools], fallbacks = [...hard.fallbackModels];
  let pins = hardPins;
  let selected = hard.modelId ?? (operation.capability === "embedding" ? DEFAULT_EMBEDDING_PROFILE.modelId : DEFAULT_CHAT_MODEL_ID);
  let selectedInterface: NativeModelInterface = hard.nativeInterface ?? (operation.capability === "embedding" ? "embedding" : "chat");
  for (const policy of ordered) {
    const rules = policy.rules;
    if (policy.override) {
      models = [...hard.allowedModels]; interfaces = [...hard.interfaces]; capabilities = [...hard.capabilities];
      options = [...hard.allowedOptions]; tools = [...hard.allowedTools]; fallbacks = [...hard.fallbackModels]; limits = hardLimits;
    }
    models = intersect(models, rules.allowedModels); interfaces = intersect(interfaces, rules.interfaces);
    capabilities = intersect(capabilities, rules.capabilities); options = intersect(options, rules.allowedOptions);
    tools = intersect(tools, rules.allowedTools); fallbacks = intersect(fallbacks, rules.fallbackModels);
    limits = tighten(limits, rules.limits); pins = { ...pins, ...rules.pins };
    selected = rules.modelId ?? selected; selectedInterface = rules.nativeInterface ?? selectedInterface;
  }
  // All deployment specializations remain hard bounds even after an authorized override.
  for (const policy of ordered.filter((record) => record.scope === "deployment" && record.operationKey)) {
    models = intersect(models, policy.rules.allowedModels); interfaces = intersect(interfaces, policy.rules.interfaces);
    capabilities = intersect(capabilities, policy.rules.capabilities); options = intersect(options, policy.rules.allowedOptions);
    tools = intersect(tools, policy.rules.allowedTools); fallbacks = intersect(fallbacks, policy.rules.fallbackModels);
    limits = tighten(limits, policy.rules.limits);
  }
  if (!models.includes(selected) || !interfaces.includes(selectedInterface) || !operation.interfaces.includes(selectedInterface) ||
      !capabilities.includes(operation.capability)) throw new Error("CAPABILITY_UNSUPPORTED: selection violates operation policy");
  const qualificationKeys = new Set<string>();
  for (const receipt of qualifications) {
    const key = canonicalModelJson([receipt.modelId, receipt.nativeInterface, receipt.priceRevision, receipt.boundRevision]);
    if (qualificationKeys.has(key)) deny("ambiguous qualification");
    qualificationKeys.add(key); assertLimits(receipt.limits);
  }
  const qualified = (candidate: string): TrustedModelQualification | undefined => qualifications.find((receipt) =>
    receipt.modelId === candidate && receipt.nativeInterface === selectedInterface && receipt.capabilities.includes(operation.capability) &&
    receipt.priceRevision === pins.priceRevision && receipt.boundRevision === pins.boundRevision);
  const receipt = qualified(selected);
  if (!receipt) throw new Error("CAPABILITY_UNAVAILABLE: missing qualified model/interface/price/bound receipt");
  limits = tighten(limits, receipt.limits); assertLimits(limits);
  if (receipt.costBound.maximumCostUnits > limits.operationBudgetUnits) deny("qualified cost ceiling exceeds operation budget");
  options = intersect(options, receipt.allowedOptions); capabilities = intersect(capabilities, receipt.capabilities);
  const semanticProfile = operation.capability === "embedding" ? embeddingProfileForModel(selected) : undefined;
  if (semanticProfile) {
    if (context.semanticProfile) assertProfileMatches(context.semanticProfile, semanticProfile);
    options = []; tools = []; capabilities = ["embedding"];
  } else if (context.semanticProfile) deny("text policy cannot select an embedding profile");
  const fallbackCandidates = fallbacks.filter((candidate) => candidate !== selected && models.includes(candidate)).map((candidate) => {
    const candidateReceipt = qualified(candidate);
    if (!candidateReceipt || candidateReceipt.costBound.maximumCostUnits > receipt.costBound.maximumCostUnits || options.some((option) => !candidateReceipt.allowedOptions.includes(option)) ||
      capabilities.some((cap) => !candidateReceipt.capabilities.includes(cap)) ||
      MODEL_LIMIT_KEYS.some((key) => candidateReceipt.limits[key] < limits[key]) || operation.capability === "embedding") {
      deny("unqualified or incompatible fallback candidate");
    }
    return { modelId: candidate, qualificationReceiptId: candidateReceipt.receiptId };
  });
  return freeze({ version: 1, operationKey: context.operationKey, requestedModelId: selected, modelId: selected,
    nativeInterface: selectedInterface, capabilities, allowedModels: models, allowedOptions: options, allowedTools: tools,
    limits, pins, policyVersions: ordered.map(({ policyId, version, override }) => ({ policyId, version, ...(override ? { override } : {}) })),
    qualificationReceiptId: receipt.receiptId, costBound: receipt.costBound, scope: context.scope, ...(context.agent ? { agent: context.agent } : {}),
    runBudgetId: context.runBudgetId, ...(context.parentOperationId ? { parentOperationId: context.parentOperationId } : {}),
    ...(context.source ? { source: context.source } : {}), ...(semanticProfile ? { semanticProfile } : {}),
    fallbackCandidates, currency: "USD", monetaryUnit: "micro-USD" });
}

export type CanonicalModelJson = null | boolean | number | string | readonly CanonicalModelJson[] | { readonly [key: string]: CanonicalModelJson };
/** Exact stable serialization, not permissive JSON.stringify coercion. */
export function canonicalModelJson(input: unknown): string {
  const active = new Set<object>();
  function visit(value: unknown): string {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return JSON.stringify(value);
    if (typeof value !== "object" || active.has(value)) throw new Error("INVALID_INPUT: noncanonical JSON");
    active.add(value);
    let result: string;
    if (Array.isArray(value)) {
      const descriptors: Record<string, PropertyDescriptor | undefined> = Object.getOwnPropertyDescriptors(value);
      if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length ||
        Object.keys(descriptors).length !== value.length + 1) throw new Error("INVALID_INPUT: nonplain array");
      const entries: string[] = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new Error("INVALID_INPUT: sparse/accessor array");
        entries.push(visit(descriptor.value));
      }
      result = `[${entries.join(",")}]`;
    } else {
      if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error("INVALID_INPUT: nonplain JSON");
      if (Object.getOwnPropertySymbols(value).length || Object.values(Object.getOwnPropertyDescriptors(value)).some((d) => !d.enumerable || !('value' in d))) throw new Error("INVALID_INPUT: noncanonical object");
      const record = value as Record<string, unknown>;
      result = `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${visit(record[key])}`).join(",")}}`;
    }
    active.delete(value);
    return result;
  }
  return visit(input);
}
// These private leaves receive only the descriptor-validated, JSON-parsed graph.
// Preserve every own JSON key verbatim: z.record drops an ordinary __proto__ key.
// No assigning/merging arbitrary keys into another object's prototype is involved.
const canonicalRecordSchema = z.custom<Record<string, unknown>>((value: unknown) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
});
const partSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1) }).strict(),
  z.object({ type: z.literal("tool-call"), toolCallId: nonempty, toolName: nonempty, input: canonicalRecordSchema }).strict(),
  z.object({ type: z.literal("tool-result"), toolCallId: nonempty, toolName: nonempty, output: canonicalRecordSchema }).strict(),
]);
const messageSchema = z.object({ role: z.enum(["system", "user", "assistant", "tool"]), parts: z.array(partSchema).min(1) }).strict();
const requestSchema = z.object({
  semanticId: nonempty, childCallId: nonempty, texts: z.array(z.string().min(1)).min(1),
  messages: z.array(messageSchema).min(1).optional(),
  inputTokens: positive, outputTokens: integer, toolSteps: integer, timeoutMs: positive,
  reservationUnits: positive, promptVersion: nonempty, schemaVersion: nonempty,
  extractionVersion: nonempty, toolRegistryVersion: nonempty,
  tools: z.array(z.object({ name: nonempty, definition: canonicalRecordSchema }).strict()),
  toolChoice: z.discriminatedUnion("type", [z.object({ type: z.literal("auto") }).strict(), z.object({ type: z.literal("none") }).strict(),
    z.object({ type: z.literal("required") }).strict(), z.object({ type: z.literal("tool"), toolName: nonempty }).strict()]).optional(),
  outputSchema: canonicalRecordSchema.optional(),
  responseFormat: z.object({ type: z.literal("json") }).strict().optional(),
  options: z.object({ maxRetries: z.literal(0), temperature: z.number().finite().min(0).max(2).optional(),
    topP: z.number().finite().min(0).max(1).optional(), seed: integer.optional(),
    stopSequences: z.array(z.string().min(1).max(256)).max(16).optional(),
    providerOptions: z.object({ openai: z.object({ store: z.literal(false) }).strict() }).strict().optional(),
  }).strict(),
  profile: profileSchema.optional(),
  media: mediaEnvelopeSchema.optional(),
  batch: z.object({ ordinal: integer, start: integer, end: positive }).strict().optional(),
}).strict();
export type ModelCallRequest = z.infer<typeof requestSchema>;
/** Exact schema-free official compatible-provider body. No hidden schema or
 * caller options enter this projection. The owned byte bound retains the same
 * cookbook framing assumption and actual-usage fence as qualified plain chat. */
export function memoryJsonObjectRequestBody(messages: ModelCallRequest["messages"], outputTokens: number) {
  const checked = parse(z.array(messageSchema).length(2), JSON.parse(canonicalModelJson(messages)));
  if (checked[0]!.role !== "system" || checked[1]!.role !== "user" || !Number.isSafeInteger(outputTokens)
    || outputTokens < 1 || outputTokens > MEMORY_JSON_OBJECT_CONTRACT.maximumOutputTokens) deny("invalid JSON-object request body");
  const content = checked.map(message => {
    const part = message.parts[0];
    if (message.parts.length !== 1 || part.type !== "text") deny("JSON-object requires two text messages");
    for (const point of part.text) {
      const code = point.codePointAt(0)!;
      if (code >= 0xd800 && code <= 0xdfff) throw new Error("INVALID_INPUT: malformed Unicode");
    }
    return part.text;
  });
  return freeze({ model: MEMORY_JSON_OBJECT_CONTRACT.modelId, max_tokens: outputTokens,
    response_format: { type: "json_object" as const },
    messages: [{ role: "system" as const, content: content[0]! }, { role: "user" as const, content: content[1]! }] });
}
export function memoryJsonObjectInputBound(messages: ModelCallRequest["messages"], outputTokens: number): number {
  return new TextEncoder().encode(JSON.stringify(memoryJsonObjectRequestBody(messages, outputTokens))).length + 9;
}
export interface ValidatedModelRequest {
  readonly request: Readonly<ModelCallRequest>;
  readonly canonical: string;
}
export interface ModelRequestInputOverflow {
  readonly dimension: "inputTokens" | "contextTokens";
  readonly effectiveLimit: number;
  readonly computedValue: number;
}
class InputOverflow extends Error {
  constructor(readonly bound: ModelRequestInputOverflow) { super("POLICY_DENIED: request exceeds input limits"); }
}
/** Selection-only diagnosis. Every non-input guard still runs; this is no admission. */
export function checkModelRequestInputBounds(snapshot: ModelPolicySnapshotV1, input: unknown):
  { withinBound: true; validated: ValidatedModelRequest } | { withinBound: false; bound: ModelRequestInputOverflow } {
  try { return { withinBound: true, validated: validateRequest(snapshot, input, true) }; }
  catch (error) {
    if (error instanceof InputOverflow) return { withinBound: false, bound: error.bound };
    throw error;
  }
}
/**
 * Ledger identity binds complete ordered role/part/tool-call IDs, not a lossy text projection.
 * The final Gateway adapter must dispatch these normalized messages exactly and reject
 * low-level params outside this whitelist. Token counts must be independently established
 * by that adapter; this helper does not prove a caller's token estimate or authenticate it.
 */
export function validateModelRequest(snapshot: ModelPolicySnapshotV1, input: unknown): ValidatedModelRequest {
  return validateRequest(snapshot, input, false);
}
function validateRequest(snapshot: ModelPolicySnapshotV1, input: unknown, diagnoseInput: boolean): ValidatedModelRequest {
  // Descriptor-safe canonicalization rejects accessors before parsing. Parsing its
  // JSON bytes detaches every nested unknown leaf, so freezing cannot mutate callers.
  const detached: unknown = JSON.parse(canonicalModelJson(input));
  const request = parse(requestSchema, detached);
  for (const key of ["promptVersion", "schemaVersion", "extractionVersion", "toolRegistryVersion"] as const) {
    if (request[key] !== snapshot.pins[key]) deny("request changed pinned versions");
  }
  const jsonObject = snapshot.pins.promptVersion === MEMORY_JSON_OBJECT_CONTRACT.promptVersion
    || snapshot.pins.boundRevision === MEMORY_JSON_OBJECT_CONTRACT.boundRevision || request.responseFormat !== undefined;
  if (jsonObject) {
    if (snapshot.operationKey !== "memory.extract" || snapshot.nativeInterface !== "chat"
      || snapshot.modelId !== MEMORY_JSON_OBJECT_CONTRACT.modelId
      || snapshot.pins.promptVersion !== MEMORY_JSON_OBJECT_CONTRACT.promptVersion
      || snapshot.pins.boundRevision !== MEMORY_JSON_OBJECT_CONTRACT.boundRevision
      || snapshot.pins.schemaVersion !== MEMORY_JSON_OBJECT_CONTRACT.schemaVersion
      || snapshot.pins.toolRegistryVersion !== MEMORY_JSON_OBJECT_CONTRACT.toolRegistryVersion
      || canonicalModelJson(request.responseFormat) !== '{"type":"json"}'
      || request.tools.length || request.toolChoice || request.toolSteps || request.media || request.profile || request.batch
      || canonicalModelJson(request.options) !== '{"maxRetries":0}') deny("JSON-object extraction contract mismatch");
    memoryJsonObjectRequestBody(request.messages, request.outputTokens);
    if (request.inputTokens > MEMORY_JSON_OBJECT_CONTRACT.maximumInputTokens
      || request.inputTokens + request.outputTokens > MEMORY_JSON_OBJECT_CONTRACT.maximumContextTokens) deny("JSON-object request exceeds bounded limits");
  }
  let inputOverflow: ModelRequestInputOverflow | undefined;
  for (const key of ["inputTokens", "outputTokens", "toolSteps", "timeoutMs"] as const) {
    if (diagnoseInput && key === "inputTokens" && request[key] > snapshot.limits[key]) {
      inputOverflow = { dimension: key, effectiveLimit: snapshot.limits[key], computedValue: request[key] }; continue;
    }
    if (request[key] > snapshot.limits[key]) deny("request exceeds bounded limits");
  }
  if (diagnoseInput && request.inputTokens + request.outputTokens > snapshot.limits.contextTokens) {
    inputOverflow ??= { dimension: "contextTokens", effectiveLimit: snapshot.limits.contextTokens, computedValue: request.inputTokens + request.outputTokens };
  }
  if ((!diagnoseInput && request.inputTokens + request.outputTokens > snapshot.limits.contextTokens) ||
    request.reservationUnits > snapshot.limits.operationBudgetUnits || request.reservationUnits < snapshot.costBound.maximumCostUnits) deny("request exceeds context or operation budget");
  if (request.tools.some((tool) => !snapshot.allowedTools.includes(tool.name)) || new Set(request.tools.map((t) => t.name)).size !== request.tools.length ||
    (request.tools.length > 0 && (!snapshot.capabilities.includes("tools") || request.toolSteps === 0))) deny("tools are not allowed");
  const toolChoice = request.toolChoice;
  if (toolChoice && (!snapshot.capabilities.includes("tools") || !request.tools.length
    || (toolChoice.type === "tool" && !request.tools.some(tool => tool.name === toolChoice.toolName)))) deny("tool choice is not allowed");
  for (const key of Object.keys(request.options)) {
    if (key !== "maxRetries" && key !== "providerOptions" && !snapshot.allowedOptions.includes(key as ModelOptionKey)) deny("option is not allowed");
  }
  if (snapshot.nativeInterface === "responses") {
    if (request.options.providerOptions?.openai.store !== false) deny("Responses requires openai.store:false");
  } else if (request.options.providerOptions) deny("provider options are not allowed on this interface");
  const structured = MODEL_OPERATION_REGISTRY[snapshot.operationKey].capability === "structured";
  if (structured !== (request.outputSchema !== undefined)) deny("operation schema mismatch");
  if (snapshot.semanticProfile) {
    if (!request.profile || !request.batch) throw new Error("PROFILE_NOT_READY: embedding profile and stable batch boundary required");
    assertProfileMatches(request.profile, snapshot.semanticProfile);
    if (request.batch.end - request.batch.start !== request.texts.length || request.texts.length > 512 || request.outputTokens || request.toolSteps || request.tools.length || request.toolChoice || request.outputSchema || request.messages) deny("invalid embedding batch");
  } else if (request.profile || request.batch) deny("nonembedding request has embedding parameters");
  const media = snapshot.nativeInterface === "image" || snapshot.nativeInterface === "video";
  if ((!media && request.media !== undefined) || request.media !== undefined && (request.media.options.kind !== snapshot.nativeInterface
    || request.outputTokens || request.toolSteps || request.tools.length || request.toolChoice || request.outputSchema
    || request.texts.length !== 1 || request.media.prompt !== request.texts[0])) deny("media envelope mismatch");
  const texts = request.texts.map(normalizeSourceText);
  const messages = request.messages?.map((message) => ({ ...message, parts: message.parts.map((part) =>
    part.type === "text" ? { ...part, text: normalizeSourceText(part.text) } : part) }));
  if (!snapshot.semanticProfile) {
    if (!messages || canonicalModelJson(messages.flatMap((message) => message.parts.flatMap((part) => part.type === "text" ? [part.text] : []))) !== canonicalModelJson(texts)) {
      deny("complete dispatch messages must match normalized text inputs");
    }
    for (const message of messages) for (const part of message.parts) {
      if ((part.type === "tool-call" && message.role !== "assistant") || (part.type === "tool-result" && message.role !== "tool") ||
        (message.role === "tool" && part.type !== "tool-result") ||
        (part.type !== "text" && (!snapshot.capabilities.includes("tools") || !snapshot.allowedTools.includes(part.toolName)))) {
        deny("invalid message role or unregistered tool part");
      }
    }
  }
  const normalized = { ...request, texts, ...(messages ? { messages } : {}) };
  const canonical = canonicalModelJson({ snapshot, request: normalized });
  if (inputOverflow) throw new InputOverflow(inputOverflow);
  return freeze({ request: normalized, canonical });
}
export interface ModelRequestIdentity { readonly canonical: string; readonly hash: string }
export async function createModelRequestIdentity(request: ValidatedModelRequest): Promise<ModelRequestIdentity> {
  return freeze({ canonical: request.canonical, hash: await semanticHash(request.canonical) });
}
/** Digests only index lookups. The ledger must call this before reusing any stored result. */
export function assertModelRequestIdentity(existing: ModelRequestIdentity, incoming: ModelRequestIdentity): void {
  if (!existing.canonical || !incoming.canonical || !existing.hash || !incoming.hash || existing.canonical !== incoming.canonical || existing.hash !== incoming.hash) {
    throw new Error("IDEMPOTENCY_CONFLICT: model request identity changed");
  }
}
const fallbackEvidenceSchema = z.object({
  outcome: z.enum(["not_dispatched", "confirmed_rejected", "confirmed", "uncertain"]),
  proof: z.enum(["pre_dispatch", "qualified_rejection", "none"]),
  outputVisible: z.boolean(), toolInputVisible: z.boolean(), toolResultVisible: z.boolean(),
  toolEffectCommitted: z.boolean(), paidLiabilityUncertain: z.boolean(), cancelled: z.boolean(),
  priorAttemptAccounted: z.boolean(), currentAuthorityChecked: z.boolean(), currentSourceChecked: z.boolean(),
  currentPolicyChecked: z.boolean(),
}).strict();
export type ModelFallbackEvidence = z.infer<typeof fallbackEvidenceSchema>;
/** Eligibility only; every candidate still requires a new atomic reservation/checkpoint. */
export function canFallbackModel(snapshot: ModelPolicySnapshotV1, candidateModelId: string, input: unknown): boolean {
  let detached: unknown;
  try {
    // Unknown evidence follows the same descriptor-safe boundary as requests;
    // getters/iterators are never evaluated to determine fallback eligibility.
    detached = JSON.parse(canonicalModelJson(input));
  } catch {
    return false;
  }
  const result = fallbackEvidenceSchema.safeParse(detached);
  if (!result.success) return false;
  const evidence = result.data;
  return !snapshot.semanticProfile && snapshot.fallbackCandidates.some((candidate) => candidate.modelId === candidateModelId) &&
    ((evidence.outcome === "not_dispatched" && evidence.proof === "pre_dispatch") ||
      (evidence.outcome === "confirmed_rejected" && evidence.proof === "qualified_rejection")) &&
    !evidence.outputVisible && !evidence.toolInputVisible && !evidence.toolResultVisible && !evidence.toolEffectCommitted &&
    !evidence.paidLiabilityUncertain && !evidence.cancelled && evidence.priorAttemptAccounted &&
    evidence.currentAuthorityChecked && evidence.currentSourceChecked && evidence.currentPolicyChecked;
}
