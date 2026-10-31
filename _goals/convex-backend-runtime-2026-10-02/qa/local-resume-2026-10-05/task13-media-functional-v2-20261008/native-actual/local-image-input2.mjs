// src/domain/model-policy.ts
import { z as z2 } from "zod";

// src/domain/profile.ts
var DEFAULT_EMBEDDING_PROFILE = Object.freeze({
  profileId: "cortex-text-small-1536-v1",
  modelId: "openai/text-embedding-3-small",
  dimensions: 1536,
  normalization: "text-nfc-lf-v1",
  chunking: "codepoint-1600-overlap-200-v1",
  indexName: "by_default_embedding_v1"
});
var LARGE_EMBEDDING_PROFILE = Object.freeze({
  profileId: "cortex-text-large-3072-v1",
  modelId: "openai/text-embedding-3-large",
  dimensions: 3072,
  normalization: "text-nfc-lf-v1",
  chunking: "codepoint-1600-overlap-200-v1",
  indexName: "by_large_embedding_v1"
});
var SUPPORTED_EMBEDDING_PROFILES = Object.freeze([DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE]);
function embeddingProfileForModel(modelId2) {
  const profile = SUPPORTED_EMBEDDING_PROFILES.find((value) => value.modelId === modelId2);
  if (!profile) throw new Error("CAPABILITY_UNSUPPORTED: embedding model has no supported profile/index");
  return profile;
}
var DEFAULT_VECTOR_FILTER_FIELDS = Object.freeze([
  "tenantId",
  "memorySpaceId",
  "profileId"
]);
function normalizeSourceText(text) {
  const normalized = text.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new Error("INVALID_INPUT: normalized text is empty");
  return normalized;
}
function assertProfileMatches(actual, expected = DEFAULT_EMBEDDING_PROFILE) {
  const fields = ["profileId", "modelId", "dimensions", "normalization", "chunking", "indexName"];
  if (fields.some((field) => actual[field] !== expected[field])) {
    throw new Error("PROFILE_NOT_READY: embedding profile does not match the pinned profile");
  }
}
async function semanticHash(value) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// src/domain/media-schemas.ts
import { z } from "zod";

// src/domain/assets.ts
var ASSET_MAX_BYTES = 2e7;
function assertAssetSize(size, cap = ASSET_MAX_BYTES) {
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > ASSET_MAX_BYTES || !Number.isSafeInteger(size) || size < 1) throw new Error("INVALID_ASSET_METADATA");
  if (size > cap) throw new Error("ASSET_TOO_LARGE");
}

// src/domain/media-schemas.ts
var identifier = z.string().min(1).max(256).refine((value) => value.trim() === value);
var mediaInputAssetSchema = z.object({
  assetId: identifier,
  assetVersion: z.number().int().positive(),
  versionId: identifier,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().min(1).max(ASSET_MAX_BYTES),
  mimeType: z.literal("image/png")
}).strict();
var imageOptions = z.object({ kind: z.literal("image"), n: z.literal(1), size: z.literal("1024x1024"), quality: z.literal("low"), outputFormat: z.literal("png") }).strict();
var videoOptions = z.object({ kind: z.literal("video"), n: z.literal(1), duration: z.literal(4), resolution: z.literal("720p"), generateAudio: z.literal(false) }).strict();
var mediaEnvelopeSchema = z.object({
  version: z.literal(1),
  prompt: z.string().min(1),
  options: z.discriminatedUnion("kind", [imageOptions, videoOptions]),
  input: mediaInputAssetSchema.optional(),
  webhookUrl: z.string().optional()
}).strict();
var mediaContractSchema = z.object({
  version: z.literal(1),
  options: z.discriminatedUnion("kind", [imageOptions, videoOptions]),
  inputProtocol: z.enum(["none", "immutable-image-inline-v1"]),
  maximumInputAssetBytes: z.number().int().min(0).max(4096),
  maximumResultBytes: z.number().int().min(1).max(ASSET_MAX_BYTES),
  callbacks: z.boolean(),
  terminalIdentity: z.enum(["requested-only", "observed-model-id"]),
  usage: z.enum(["optional", "tokens-required"])
}).strict();
var mediaResultSchema = z.object({
  version: z.literal(1),
  kind: z.literal("media"),
  jobId: identifier,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().min(1).max(ASSET_MAX_BYTES),
  mimeType: z.enum(["image/png", "video/mp4", "video/webm"])
}).strict();

// src/domain/model-policy.ts
var MODEL_OPERATION_KEYS = Object.freeze([
  "agent.respond",
  "memory.extract",
  "facts.resolve",
  "memory.summarize",
  "conversation.title",
  "artifact.text",
  "artifact.code",
  "artifact.sheet",
  "artifact.suggestions",
  "embedding.query",
  "embedding.memory",
  "media.image.generate",
  "media.video.generate"
]);
var DEFAULT_CHAT_MODEL_ID = "openai/gpt-4o-mini";
var MODEL_OPERATION_REGISTRY = Object.freeze(Object.fromEntries(MODEL_OPERATION_KEYS.map((key) => [key, Object.freeze({
  key,
  capability: key.startsWith("embedding.") ? "embedding" : key.startsWith("media.image") ? "image" : key.startsWith("media.video") ? "video" : key === "memory.extract" || key === "facts.resolve" ? "structured" : "text",
  interfaces: Object.freeze(key.startsWith("embedding.") ? ["embedding"] : key.startsWith("media.image") ? ["image"] : key.startsWith("media.video") ? ["video"] : ["chat", "responses"]),
  availableInThisPacket: true
})])));
var nonempty = z2.string().min(1).max(256).refine((value) => value.trim() === value && value.trim().length > 0);
var integer = z2.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
var positive = integer.min(1);
var modelId = z2.string().regex(/^[a-z0-9][a-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/);
var operationKey = z2.enum(MODEL_OPERATION_KEYS);
var nativeInterface = z2.enum(["chat", "responses", "messages", "embedding", "image", "video"]);
var capability = z2.enum(["text", "structured", "tools", "embedding", "image", "video"]);
var optionKey = z2.enum(["temperature", "topP", "seed", "stopSequences"]);
var limitsSchema = z2.object({
  inputTokens: positive,
  contextTokens: positive,
  outputTokens: positive,
  toolSteps: integer,
  timeoutMs: positive,
  operationBudgetUnits: positive,
  runBudgetUnits: positive,
  tenantBudgetUnits: positive,
  concurrency: positive
}).strict();
var MODEL_LIMIT_KEYS = Object.freeze(Object.keys(limitsSchema.shape));
var pinsSchema = z2.object({
  promptVersion: nonempty,
  schemaVersion: nonempty,
  extractionVersion: nonempty,
  toolRegistryVersion: nonempty,
  priceRevision: nonempty,
  boundRevision: nonempty
}).strict();
var rulesSchema = z2.object({
  modelId: modelId.optional(),
  nativeInterface: nativeInterface.optional(),
  allowedModels: z2.array(modelId).min(1).optional(),
  interfaces: z2.array(nativeInterface).min(1).optional(),
  capabilities: z2.array(capability).min(1).optional(),
  allowedOptions: z2.array(optionKey).optional(),
  allowedTools: z2.array(nonempty).optional(),
  fallbackModels: z2.array(modelId).optional(),
  limits: limitsSchema.partial().optional(),
  pins: pinsSchema.partial().optional()
}).strict();
var policySchema = z2.object({
  policyId: nonempty,
  version: positive,
  scope: z2.enum(["deployment", "tenant", "agent"]),
  tenantId: nonempty.optional(),
  agentId: nonempty.optional(),
  agentVersion: positive.optional(),
  operationKey: operationKey.optional(),
  rules: rulesSchema,
  override: z2.object({ actorPrincipalId: nonempty, changeRevision: positive, authorizationId: nonempty }).strict().optional()
}).strict();
var costBoundSchema = z2.object({
  kind: z2.literal("qualified-call-ceiling"),
  maximumCostUnits: positive,
  provenance: nonempty,
  coversAllProviderCharges: z2.literal(true)
}).strict();
var qualificationSchema = z2.object({
  receiptId: nonempty,
  modelId,
  nativeInterface,
  capabilities: z2.array(capability).min(1),
  allowedOptions: z2.array(optionKey),
  limits: limitsSchema,
  costBound: costBoundSchema,
  priceRevision: nonempty,
  boundRevision: nonempty
}).strict();
var scopeSchema = z2.object({
  tenantId: nonempty,
  tenantEpoch: positive,
  memorySpaceId: nonempty,
  memorySpaceEpoch: positive,
  principalId: nonempty,
  principalVersion: positive,
  membershipId: nonempty,
  membershipVersion: positive,
  grantId: nonempty,
  grantVersion: positive
}).strict();
var profileSchema = z2.object({
  profileId: nonempty,
  modelId,
  dimensions: positive,
  normalization: nonempty,
  chunking: nonempty,
  indexName: nonempty
}).strict();
var contextSchema = z2.object({
  scope: scopeSchema,
  agent: z2.object({ agentId: nonempty, version: positive }).strict().optional(),
  operationKey,
  parentOperationId: nonempty.optional(),
  runBudgetId: nonempty,
  source: z2.object({ sourceId: nonempty, sourceEventId: nonempty, sourceRevision: positive }).strict().optional(),
  semanticProfile: profileSchema.optional(),
  /** Exact override records authenticated by a separate backend policy-admin check. */
  authorizedOverrides: z2.array(z2.object({
    authorizationId: nonempty,
    actorPrincipalId: nonempty,
    changeRevision: positive,
    policyId: nonempty,
    policyVersion: positive
  }).strict())
}).strict();
var resolutionSchema = z2.object({
  context: contextSchema,
  policies: z2.array(policySchema).min(1),
  qualifications: z2.array(qualificationSchema)
}).strict();
function deny(message) {
  throw new Error(`POLICY_DENIED: ${message}`);
}
function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error("INVALID_INPUT: invalid model policy contract");
  return result.data;
}
function freeze(value) {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child) => freeze(child));
    Object.freeze(value);
  }
  return value;
}
function intersect(left, right) {
  return [...new Set(left.filter((item) => right === void 0 || right.includes(item)))];
}
function tighten(left, right) {
  return Object.fromEntries(MODEL_LIMIT_KEYS.map((key) => [key, Math.min(left[key], right?.[key] ?? left[key])]));
}
function assertLimits(limits) {
  if (limits.inputTokens > limits.contextTokens || limits.outputTokens > limits.contextTokens || limits.operationBudgetUnits > limits.runBudgetUnits || limits.runBudgetUnits > limits.tenantBudgetUnits) {
    deny("inconsistent token or monetary bounds");
  }
}
function resolveModelPolicy(input) {
  canonicalModelJson(input);
  const { context, policies, qualifications } = parse(resolutionSchema, input);
  const operation = MODEL_OPERATION_REGISTRY[context.operationKey];
  if (!operation.availableInThisPacket || (operation.capability === "video" || operation.capability === "image") && !qualifications.some((receipt2) => receipt2.nativeInterface === operation.capability && receipt2.capabilities.includes(operation.capability))) {
    throw new Error("CAPABILITY_UNAVAILABLE: media qualification belongs to its service gate");
  }
  const seen = /* @__PURE__ */ new Set();
  for (const policy of policies) {
    const target = `${policy.scope}:${policy.operationKey ?? "*"}`;
    if (seen.has(target)) deny("ambiguous policy scope");
    seen.add(target);
    if (policy.operationKey && policy.operationKey !== context.operationKey || policy.scope === "deployment" && (policy.tenantId || policy.agentId || policy.agentVersion) || policy.scope !== "deployment" && policy.tenantId !== context.scope.tenantId || policy.scope === "tenant" && (policy.agentId || policy.agentVersion) || policy.scope === "agent" && (!context.agent || policy.agentId !== context.agent.agentId || policy.agentVersion !== context.agent.version)) {
      deny("policy scope does not match trusted context");
    }
    if (policy.scope === "deployment" && policy.override) deny("deployment hard bounds cannot be overridden");
    if (policy.override && !context.authorizedOverrides.some((auth) => auth.authorizationId === policy.override?.authorizationId && auth.actorPrincipalId === policy.override.actorPrincipalId && auth.changeRevision === policy.override.changeRevision && auth.policyId === policy.policyId && auth.policyVersion === policy.version)) deny("unauthorized policy override");
  }
  const rank = (policy) => ["deployment", "tenant", "agent"].indexOf(policy.scope) + (policy.operationKey ? 3 : 0);
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
  let selectedInterface = hard.nativeInterface ?? (operation.capability === "embedding" ? "embedding" : "chat");
  for (const policy of ordered) {
    const rules = policy.rules;
    if (policy.override) {
      models = [...hard.allowedModels];
      interfaces = [...hard.interfaces];
      capabilities = [...hard.capabilities];
      options = [...hard.allowedOptions];
      tools = [...hard.allowedTools];
      fallbacks = [...hard.fallbackModels];
      limits = hardLimits;
    }
    models = intersect(models, rules.allowedModels);
    interfaces = intersect(interfaces, rules.interfaces);
    capabilities = intersect(capabilities, rules.capabilities);
    options = intersect(options, rules.allowedOptions);
    tools = intersect(tools, rules.allowedTools);
    fallbacks = intersect(fallbacks, rules.fallbackModels);
    limits = tighten(limits, rules.limits);
    pins = { ...pins, ...rules.pins };
    selected = rules.modelId ?? selected;
    selectedInterface = rules.nativeInterface ?? selectedInterface;
  }
  for (const policy of ordered.filter((record) => record.scope === "deployment" && record.operationKey)) {
    models = intersect(models, policy.rules.allowedModels);
    interfaces = intersect(interfaces, policy.rules.interfaces);
    capabilities = intersect(capabilities, policy.rules.capabilities);
    options = intersect(options, policy.rules.allowedOptions);
    tools = intersect(tools, policy.rules.allowedTools);
    fallbacks = intersect(fallbacks, policy.rules.fallbackModels);
    limits = tighten(limits, policy.rules.limits);
  }
  if (!models.includes(selected) || !interfaces.includes(selectedInterface) || !operation.interfaces.includes(selectedInterface) || !capabilities.includes(operation.capability)) throw new Error("CAPABILITY_UNSUPPORTED: selection violates operation policy");
  const qualificationKeys = /* @__PURE__ */ new Set();
  for (const receipt2 of qualifications) {
    const key = canonicalModelJson([receipt2.modelId, receipt2.nativeInterface, receipt2.priceRevision, receipt2.boundRevision]);
    if (qualificationKeys.has(key)) deny("ambiguous qualification");
    qualificationKeys.add(key);
    assertLimits(receipt2.limits);
  }
  const qualified = (candidate) => qualifications.find((receipt2) => receipt2.modelId === candidate && receipt2.nativeInterface === selectedInterface && receipt2.capabilities.includes(operation.capability) && receipt2.priceRevision === pins.priceRevision && receipt2.boundRevision === pins.boundRevision);
  const receipt = qualified(selected);
  if (!receipt) throw new Error("CAPABILITY_UNAVAILABLE: missing qualified model/interface/price/bound receipt");
  limits = tighten(limits, receipt.limits);
  assertLimits(limits);
  if (receipt.costBound.maximumCostUnits > limits.operationBudgetUnits) deny("qualified cost ceiling exceeds operation budget");
  options = intersect(options, receipt.allowedOptions);
  capabilities = intersect(capabilities, receipt.capabilities);
  const semanticProfile = operation.capability === "embedding" ? embeddingProfileForModel(selected) : void 0;
  if (semanticProfile) {
    if (context.semanticProfile) assertProfileMatches(context.semanticProfile, semanticProfile);
    options = [];
    tools = [];
    capabilities = ["embedding"];
  } else if (context.semanticProfile) deny("text policy cannot select an embedding profile");
  const fallbackCandidates = fallbacks.filter((candidate) => candidate !== selected && models.includes(candidate)).map((candidate) => {
    const candidateReceipt = qualified(candidate);
    if (!candidateReceipt || candidateReceipt.costBound.maximumCostUnits > receipt.costBound.maximumCostUnits || options.some((option) => !candidateReceipt.allowedOptions.includes(option)) || capabilities.some((cap) => !candidateReceipt.capabilities.includes(cap)) || MODEL_LIMIT_KEYS.some((key) => candidateReceipt.limits[key] < limits[key]) || operation.capability === "embedding") {
      deny("unqualified or incompatible fallback candidate");
    }
    return { modelId: candidate, qualificationReceiptId: candidateReceipt.receiptId };
  });
  return freeze({
    version: 1,
    operationKey: context.operationKey,
    requestedModelId: selected,
    modelId: selected,
    nativeInterface: selectedInterface,
    capabilities,
    allowedModels: models,
    allowedOptions: options,
    allowedTools: tools,
    limits,
    pins,
    policyVersions: ordered.map(({ policyId, version, override }) => ({ policyId, version, ...override ? { override } : {} })),
    qualificationReceiptId: receipt.receiptId,
    costBound: receipt.costBound,
    scope: context.scope,
    ...context.agent ? { agent: context.agent } : {},
    runBudgetId: context.runBudgetId,
    ...context.parentOperationId ? { parentOperationId: context.parentOperationId } : {},
    ...context.source ? { source: context.source } : {},
    ...semanticProfile ? { semanticProfile } : {},
    fallbackCandidates,
    currency: "USD",
    monetaryUnit: "micro-USD"
  });
}
function canonicalModelJson(input) {
  const active = /* @__PURE__ */ new Set();
  function visit(value) {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return JSON.stringify(value);
    if (typeof value !== "object" || active.has(value)) throw new Error("INVALID_INPUT: noncanonical JSON");
    active.add(value);
    let result;
    if (Array.isArray(value)) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length || Object.keys(descriptors).length !== value.length + 1) throw new Error("INVALID_INPUT: nonplain array");
      const entries = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new Error("INVALID_INPUT: sparse/accessor array");
        entries.push(visit(descriptor.value));
      }
      result = `[${entries.join(",")}]`;
    } else {
      if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error("INVALID_INPUT: nonplain JSON");
      if (Object.getOwnPropertySymbols(value).length || Object.values(Object.getOwnPropertyDescriptors(value)).some((d) => !d.enumerable || !("value" in d))) throw new Error("INVALID_INPUT: noncanonical object");
      const record = value;
      result = `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${visit(record[key])}`).join(",")}}`;
    }
    active.delete(value);
    return result;
  }
  return visit(input);
}
var canonicalRecordSchema = z2.custom((value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
});
var partSchema = z2.discriminatedUnion("type", [
  z2.object({ type: z2.literal("text"), text: z2.string().min(1) }).strict(),
  z2.object({ type: z2.literal("tool-call"), toolCallId: nonempty, toolName: nonempty, input: canonicalRecordSchema }).strict(),
  z2.object({ type: z2.literal("tool-result"), toolCallId: nonempty, toolName: nonempty, output: canonicalRecordSchema }).strict()
]);
var messageSchema = z2.object({ role: z2.enum(["system", "user", "assistant", "tool"]), parts: z2.array(partSchema).min(1) }).strict();
var requestSchema = z2.object({
  semanticId: nonempty,
  childCallId: nonempty,
  texts: z2.array(z2.string().min(1)).min(1),
  messages: z2.array(messageSchema).min(1).optional(),
  inputTokens: positive,
  outputTokens: integer,
  toolSteps: integer,
  timeoutMs: positive,
  reservationUnits: positive,
  promptVersion: nonempty,
  schemaVersion: nonempty,
  extractionVersion: nonempty,
  toolRegistryVersion: nonempty,
  tools: z2.array(z2.object({ name: nonempty, definition: canonicalRecordSchema }).strict()),
  toolChoice: z2.discriminatedUnion("type", [
    z2.object({ type: z2.literal("auto") }).strict(),
    z2.object({ type: z2.literal("none") }).strict(),
    z2.object({ type: z2.literal("required") }).strict(),
    z2.object({ type: z2.literal("tool"), toolName: nonempty }).strict()
  ]).optional(),
  outputSchema: canonicalRecordSchema.optional(),
  options: z2.object({
    maxRetries: z2.literal(0),
    temperature: z2.number().finite().min(0).max(2).optional(),
    topP: z2.number().finite().min(0).max(1).optional(),
    seed: integer.optional(),
    stopSequences: z2.array(z2.string().min(1).max(256)).max(16).optional(),
    providerOptions: z2.object({ openai: z2.object({ store: z2.literal(false) }).strict() }).strict().optional()
  }).strict(),
  profile: profileSchema.optional(),
  media: mediaEnvelopeSchema.optional(),
  batch: z2.object({ ordinal: integer, start: integer, end: positive }).strict().optional()
}).strict();
function validateModelRequest(snapshot, input) {
  const detached = JSON.parse(canonicalModelJson(input));
  const request = parse(requestSchema, detached);
  for (const key of ["promptVersion", "schemaVersion", "extractionVersion", "toolRegistryVersion"]) {
    if (request[key] !== snapshot.pins[key]) deny("request changed pinned versions");
  }
  for (const key of ["inputTokens", "outputTokens", "toolSteps", "timeoutMs"]) {
    if (request[key] > snapshot.limits[key]) deny("request exceeds bounded limits");
  }
  if (request.inputTokens + request.outputTokens > snapshot.limits.contextTokens || request.reservationUnits > snapshot.limits.operationBudgetUnits || request.reservationUnits < snapshot.costBound.maximumCostUnits) deny("request exceeds context or operation budget");
  if (request.tools.some((tool) => !snapshot.allowedTools.includes(tool.name)) || new Set(request.tools.map((t) => t.name)).size !== request.tools.length || request.tools.length > 0 && (!snapshot.capabilities.includes("tools") || request.toolSteps === 0)) deny("tools are not allowed");
  const toolChoice = request.toolChoice;
  if (toolChoice && (!snapshot.capabilities.includes("tools") || !request.tools.length || toolChoice.type === "tool" && !request.tools.some((tool) => tool.name === toolChoice.toolName))) deny("tool choice is not allowed");
  for (const key of Object.keys(request.options)) {
    if (key !== "maxRetries" && key !== "providerOptions" && !snapshot.allowedOptions.includes(key)) deny("option is not allowed");
  }
  if (snapshot.nativeInterface === "responses") {
    if (request.options.providerOptions?.openai.store !== false) deny("Responses requires openai.store:false");
  } else if (request.options.providerOptions) deny("provider options are not allowed on this interface");
  const structured = MODEL_OPERATION_REGISTRY[snapshot.operationKey].capability === "structured";
  if (structured !== (request.outputSchema !== void 0)) deny("operation schema mismatch");
  if (snapshot.semanticProfile) {
    if (!request.profile || !request.batch) throw new Error("PROFILE_NOT_READY: embedding profile and stable batch boundary required");
    assertProfileMatches(request.profile, snapshot.semanticProfile);
    if (request.batch.end - request.batch.start !== request.texts.length || request.texts.length > 512 || request.outputTokens || request.toolSteps || request.tools.length || request.toolChoice || request.outputSchema || request.messages) deny("invalid embedding batch");
  } else if (request.profile || request.batch) deny("nonembedding request has embedding parameters");
  const media = snapshot.nativeInterface === "image" || snapshot.nativeInterface === "video";
  if (!media && request.media !== void 0 || request.media !== void 0 && (request.media.options.kind !== snapshot.nativeInterface || request.outputTokens || request.toolSteps || request.tools.length || request.toolChoice || request.outputSchema || request.texts.length !== 1 || request.media.prompt !== request.texts[0])) deny("media envelope mismatch");
  const texts = request.texts.map(normalizeSourceText);
  const messages = request.messages?.map((message) => ({ ...message, parts: message.parts.map((part) => part.type === "text" ? { ...part, text: normalizeSourceText(part.text) } : part) }));
  if (!snapshot.semanticProfile) {
    if (!messages || canonicalModelJson(messages.flatMap((message) => message.parts.flatMap((part) => part.type === "text" ? [part.text] : []))) !== canonicalModelJson(texts)) {
      deny("complete dispatch messages must match normalized text inputs");
    }
    for (const message of messages) for (const part of message.parts) {
      if (part.type === "tool-call" && message.role !== "assistant" || part.type === "tool-result" && message.role !== "tool" || message.role === "tool" && part.type !== "tool-result" || part.type !== "text" && (!snapshot.capabilities.includes("tools") || !snapshot.allowedTools.includes(part.toolName))) {
        deny("invalid message role or unregistered tool part");
      }
    }
  }
  const normalized = { ...request, texts, ...messages ? { messages } : {} };
  const canonical = canonicalModelJson({ snapshot, request: normalized });
  return freeze({ request: normalized, canonical });
}
async function createModelRequestIdentity(request) {
  return freeze({ canonical: request.canonical, hash: await semanticHash(request.canonical) });
}
function assertModelRequestIdentity(existing, incoming) {
  if (!existing.canonical || !incoming.canonical || !existing.hash || !incoming.hash || existing.canonical !== incoming.canonical || existing.hash !== incoming.hash) {
    throw new Error("IDEMPOTENCY_CONFLICT: model request identity changed");
  }
}
var fallbackEvidenceSchema = z2.object({
  outcome: z2.enum(["not_dispatched", "confirmed_rejected", "confirmed", "uncertain"]),
  proof: z2.enum(["pre_dispatch", "qualified_rejection", "none"]),
  outputVisible: z2.boolean(),
  toolInputVisible: z2.boolean(),
  toolResultVisible: z2.boolean(),
  toolEffectCommitted: z2.boolean(),
  paidLiabilityUncertain: z2.boolean(),
  cancelled: z2.boolean(),
  priorAttemptAccounted: z2.boolean(),
  currentAuthorityChecked: z2.boolean(),
  currentSourceChecked: z2.boolean(),
  currentPolicyChecked: z2.boolean()
}).strict();
function canFallbackModel(snapshot, candidateModelId, input) {
  let detached;
  try {
    detached = JSON.parse(canonicalModelJson(input));
  } catch {
    return false;
  }
  const result = fallbackEvidenceSchema.safeParse(detached);
  if (!result.success) return false;
  const evidence = result.data;
  return !snapshot.semanticProfile && snapshot.fallbackCandidates.some((candidate) => candidate.modelId === candidateModelId) && (evidence.outcome === "not_dispatched" && evidence.proof === "pre_dispatch" || evidence.outcome === "confirmed_rejected" && evidence.proof === "qualified_rejection") && !evidence.outputVisible && !evidence.toolInputVisible && !evidence.toolResultVisible && !evidence.toolEffectCommitted && !evidence.paidLiabilityUncertain && !evidence.cancelled && evidence.priorAttemptAccounted && evidence.currentAuthorityChecked && evidence.currentSourceChecked && evidence.currentPolicyChecked;
}

// src/domain/media-jobs.ts
import { z as z3 } from "zod";

// src/domain/transcript.ts
function invalid() {
  throw new Error("INVALID_INPUT: invalid text submission");
}
function utf8Bytes(text) {
  return new TextEncoder().encode(text).length;
}
function assertUnicode(text) {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code >= 55296 && code <= 56319) {
      const next = text.charCodeAt(++index);
      if (!(next >= 56320 && next <= 57343)) invalid();
    } else if (code >= 56320 && code <= 57343) invalid();
  }
}

// src/domain/media-jobs.ts
var MEDIA_JOB_STATES = ["pending", "submitting", "submission_unknown", "processing", "downloading", "ready", "failed", "cancelled", "expired"];
var MEDIA_LEASE_MS = 12e4;
var MEDIA_OPERATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1e3;
var MEDIA_MAX_DOWNLOAD_ATTEMPTS = 3;
var MEDIA_MAX_POLLS = 2048;
var identifier2 = z3.string().min(1).max(256).refine((value) => value.trim() === value);
var mediaSubmitSchema = z3.object({
  requestId: identifier2,
  kind: z3.enum(["image", "video"]),
  prompt: z3.string().min(1).refine((value) => {
    try {
      assertUnicode(value);
      return !!value.trim() && utf8Bytes(value) <= 1024;
    } catch {
      return false;
    }
  }),
  inputAsset: z3.object({ assetId: identifier2, version: z3.number().int().positive() }).strict().optional(),
  conversationId: identifier2.optional()
}).strict();
function assertMediaBytes(bytes, mimeType) {
  const matches = mimeType === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) : mimeType === "video/webm" ? [26, 69, 223, 163].every((value, index) => bytes[index] === value) : bytes.length >= 12 && [102, 116, 121, 112].every((value, index) => bytes[index + 4] === value);
  if (!matches) throw new Error("MEDIA_OUTPUT_INVALID");
}
function mediaInputBound(input, contractInput, modelId2) {
  const envelope = mediaEnvelopeSchema.parse(JSON.parse(canonicalModelJson(input)));
  const contract = mediaContractSchema.parse(JSON.parse(canonicalModelJson(contractInput)));
  assertUnicode(envelope.prompt);
  if (!envelope.prompt.trim() || utf8Bytes(envelope.prompt) > 1024 || canonicalModelJson(envelope.options) !== canonicalModelJson(contract.options) || envelope.input !== void 0 !== (contract.inputProtocol === "immutable-image-inline-v1") || envelope.options.kind === "image" && (envelope.input || envelope.webhookUrl || contract.callbacks) || envelope.webhookUrl !== void 0 !== contract.callbacks) throw new Error("POLICY_DENIED: media envelope differs from qualification");
  if (envelope.input && (envelope.input.sizeBytes > contract.maximumInputAssetBytes || envelope.options.kind !== "video")) throw new Error("POLICY_DENIED: private input exceeds qualified envelope");
  if (envelope.webhookUrl) {
    const url = new URL(envelope.webhookUrl);
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.convex\.site$/.test(url.hostname) || url.username || url.password || url.port || url.pathname !== "/cortex/media/video/webhook" || url.hash || [...url.searchParams.keys()].join() !== "jobId" || !url.searchParams.get("jobId")) throw new Error("POLICY_DENIED: unsupported callback origin");
  }
  const body = mediaWireBody(envelope, modelId2, envelope.input ? "" : void 0);
  return utf8Bytes(canonicalModelJson(body)) + (envelope.input ? 4 * Math.ceil(envelope.input.sizeBytes / 3) : 0);
}
function mediaWireBody(envelope, modelId2, privateBase64) {
  const options = envelope.options;
  return options.kind === "image" ? { model: modelId2, prompt: envelope.prompt, n: 1, size: options.size, quality: options.quality, output_format: options.outputFormat } : {
    model: modelId2,
    prompt: envelope.prompt,
    duration: options.duration,
    resolution: options.resolution,
    generate_audio: options.generateAudio,
    ...envelope.input ? { frame_images: [{ type: "image_url", frame_type: "first_frame", image_url: { url: `data:${envelope.input.mimeType};base64,${privateBase64 ?? ""}` } }] } : {},
    ...envelope.webhookUrl ? { webhook_url: envelope.webhookUrl } : {}
  };
}
function decodeMediaBytes(input, cap = ASSET_MAX_BYTES) {
  if (input instanceof Uint8Array) {
    assertAssetSize(input.byteLength, cap);
    return new Uint8Array(input);
  }
  if (!input || input.length > 4 * Math.ceil(cap / 3) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input)) throw new Error(input.length > 4 * Math.ceil(cap / 3) ? "ASSET_TOO_LARGE" : "MEDIA_OUTPUT_INVALID");
  const padding = input.endsWith("==") ? 2 : input.endsWith("=") ? 1 : 0;
  assertAssetSize(input.length / 4 * 3 - padding, cap);
  const binary = atob(input);
  if (btoa(binary) !== input) throw new Error("MEDIA_OUTPUT_INVALID");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
export {
  DEFAULT_CHAT_MODEL_ID,
  MEDIA_JOB_STATES,
  MEDIA_LEASE_MS,
  MEDIA_MAX_DOWNLOAD_ATTEMPTS,
  MEDIA_MAX_POLLS,
  MEDIA_OPERATION_RETENTION_MS,
  MODEL_LIMIT_KEYS,
  MODEL_OPERATION_KEYS,
  MODEL_OPERATION_REGISTRY,
  assertMediaBytes,
  assertModelRequestIdentity,
  canFallbackModel,
  canonicalModelJson,
  createModelRequestIdentity,
  decodeMediaBytes,
  mediaContractSchema,
  mediaEnvelopeSchema,
  mediaInputAssetSchema,
  mediaInputBound,
  mediaResultSchema,
  mediaSubmitSchema,
  mediaWireBody,
  resolveModelPolicy,
  validateModelRequest
};
