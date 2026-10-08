// convex-dev/schema.ts
import { defineSchema, defineTable as defineTable4 } from "convex/server";
import { v as v4 } from "convex/values";

// convex-dev/runtimeAuthSchema.ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
var runtimeCapability = v.union(
  v.literal("read"),
  v.literal("write"),
  v.literal("run"),
  v.literal("admin"),
  v.literal("tool"),
  v.literal("storage:read"),
  v.literal("storage:write")
);
var runtimeResourceAccess = v.union(v.literal("own"), v.literal("space"), v.literal("tenant"));
var runtimeActorKind = v.union(v.literal("user"), v.literal("service"));
var runtimeResourceType = v.union(
  v.literal("tenant"),
  v.literal("memorySpace"),
  v.literal("conversation"),
  v.literal("memory"),
  v.literal("fact"),
  v.literal("artifact"),
  v.literal("attachment"),
  v.literal("source"),
  v.literal("run"),
  v.literal("context"),
  v.literal("storage")
);
var runtimeAuthorityReference = v.object({
  principalId: v.string(),
  principalVersion: v.number(),
  membershipId: v.string(),
  membershipVersion: v.number(),
  grantId: v.string(),
  grantVersion: v.number(),
  tenantId: v.string(),
  tenantEpoch: v.number(),
  memorySpaceId: v.optional(v.string()),
  memorySpaceEpoch: v.optional(v.number())
});
var runtimeResource = v.object({
  resourceType: runtimeResourceType,
  resourceId: v.string(),
  tenantId: v.optional(v.string()),
  memorySpaceId: v.optional(v.string()),
  ownerPrincipalId: v.optional(v.string())
});
var runtimeAuthorityRequirement = v.object({
  capability: runtimeCapability,
  tenantId: v.optional(v.string()),
  memorySpaceId: v.optional(v.string()),
  resource: v.optional(runtimeResource),
  actorKind: v.optional(runtimeActorKind)
});
var runtimeAuthTables = {
  runtimeAuthPrincipals: defineTable({
    issuer: v.string(),
    subject: v.string(),
    actorKind: runtimeActorKind,
    metadataUserId: v.optional(v.string()),
    version: v.number(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number())
  }).index("by_issuer_subject", ["issuer", "subject"]),
  runtimeAuthMemberships: defineTable({
    principalId: v.id("runtimeAuthPrincipals"),
    tenantId: v.string(),
    version: v.number(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number())
  }).index("by_principal_tenant", ["principalId", "tenantId"]),
  runtimeAuthScopes: defineTable({
    tenantId: v.string(),
    memorySpaceId: v.optional(v.string()),
    epoch: v.number(),
    createdAt: v.number(),
    deletedAt: v.optional(v.number())
  }).index("by_tenant_space", ["tenantId", "memorySpaceId"]),
  runtimeAuthGrants: defineTable({
    principalId: v.id("runtimeAuthPrincipals"),
    membershipId: v.id("runtimeAuthMemberships"),
    tenantId: v.string(),
    memorySpaceId: v.optional(v.string()),
    tenantEpoch: v.number(),
    memorySpaceEpoch: v.optional(v.number()),
    capabilities: v.array(runtimeCapability),
    resourceAccess: runtimeResourceAccess,
    version: v.number(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number())
  }).index("by_membership", ["membershipId"]).index("by_membership_scope_version", ["membershipId", "memorySpaceId", "version"]),
  runtimeAuthTombstones: defineTable({
    tenantId: v.string(),
    memorySpaceId: v.optional(v.string()),
    resourceType: runtimeResourceType,
    resourceId: v.string(),
    deletedAt: v.number()
  }).index("by_resource", ["tenantId", "memorySpaceId", "resourceType", "resourceId"])
};

// convex-dev/runtimeMemorySchema.ts
import { defineTable as defineTable2 } from "convex/server";
import { v as v2 } from "convex/values";
var sourceReference = { sourceId: v2.string(), sourceEventId: v2.string(), sourceRevision: v2.number() };
var sourceLineage = v2.union(
  v2.object({ ...sourceReference, role: v2.literal("user"), trust: v2.literal("user_assertion") }),
  v2.object({ ...sourceReference, role: v2.literal("assistant"), trust: v2.literal("assistant_claim") }),
  v2.object({ ...sourceReference, role: v2.literal("tool"), trust: v2.literal("verified_tool_evidence"), operationId: v2.string() })
);
var embeddingProfile = v2.object({
  profileId: v2.string(),
  modelId: v2.string(),
  dimensions: v2.number(),
  normalization: v2.string(),
  chunking: v2.string(),
  indexName: v2.string()
});
var sourceContent = v2.object({
  tenantId: v2.string(),
  memorySpaceId: v2.string(),
  ownerPrincipalId: v2.string(),
  lineage: sourceLineage,
  content: v2.string(),
  contentHash: v2.string(),
  createdAt: v2.number(),
  tombstonedAt: v2.optional(v2.number())
});
var sourceChunk = v2.object({
  ...sourceReference,
  chunkId: v2.string(),
  tenantId: v2.string(),
  memorySpaceId: v2.string(),
  profileId: v2.string(),
  ordinal: v2.number(),
  start: v2.number(),
  end: v2.number(),
  text: v2.string(),
  textHash: v2.string()
});
var derivedVector = v2.object({
  ...sourceReference,
  vectorId: v2.string(),
  chunkId: v2.string(),
  tenantId: v2.string(),
  memorySpaceId: v2.string(),
  profile: embeddingProfile,
  embedding: v2.array(v2.float64()),
  processingReceiptId: v2.string()
});
var processingIdentity = v2.object({
  ...sourceReference,
  stage: v2.union(v2.literal("extract"), v2.literal("facts"), v2.literal("vectors")),
  semanticPolicyVersion: v2.string()
});
var factType = v2.union(
  v2.literal("preference"),
  v2.literal("identity"),
  v2.literal("knowledge"),
  v2.literal("relationship"),
  v2.literal("event"),
  v2.literal("observation"),
  v2.literal("custom")
);
var derivedFact = v2.object({
  _id: v2.string(),
  factId: v2.string(),
  tenantId: v2.optional(v2.string()),
  memorySpaceId: v2.string(),
  ownerPrincipalId: v2.string(),
  lineage: sourceLineage,
  extractionPolicyVersion: v2.string(),
  fact: v2.string(),
  factType,
  subject: v2.optional(v2.string()),
  predicate: v2.optional(v2.string()),
  object: v2.optional(v2.string()),
  confidence: v2.number(),
  sourceType: v2.union(v2.literal("conversation"), v2.literal("system"), v2.literal("tool"), v2.literal("manual"), v2.literal("a2a")),
  tags: v2.array(v2.string()),
  version: v2.number(),
  createdAt: v2.number(),
  updatedAt: v2.number(),
  validFrom: v2.optional(v2.number()),
  validUntil: v2.optional(v2.number()),
  supersededBy: v2.optional(v2.string()),
  supersedes: v2.optional(v2.string()),
  userId: v2.optional(v2.string()),
  participantId: v2.optional(v2.string()),
  entities: v2.optional(v2.array(v2.object({ name: v2.string(), type: v2.string(), fullValue: v2.optional(v2.string()) }))),
  relations: v2.optional(v2.array(v2.object({ subject: v2.string(), predicate: v2.string(), object: v2.string() })))
});
var commitDerivedInput = v2.object({
  source: v2.object(sourceReference),
  identity: processingIdentity,
  chunks: v2.optional(v2.array(sourceChunk)),
  vectors: v2.optional(v2.array(derivedVector)),
  facts: v2.optional(v2.array(derivedFact)),
  expectedFactVersions: v2.optional(v2.record(v2.string(), v2.number()))
});
var runtimeMemoryTables = {
  runtimeMemorySources: defineTable2(sourceContent.fields).index("by_scope_source", ["tenantId", "memorySpaceId", "lineage.sourceId"]).index("by_scope_event", ["tenantId", "memorySpaceId", "lineage.sourceEventId"]),
  runtimeMemoryChunks: defineTable2(sourceChunk.fields).index("by_scope_chunk", ["tenantId", "memorySpaceId", "chunkId"]),
  runtimeMemoryVectors: defineTable2({
    ...derivedVector.fields,
    profileId: v2.string(),
    scopeProfileKey: v2.string(),
    ownerPrincipalId: v2.string(),
    scopeProfileOwnerKey: v2.string()
  }).index("by_scope_vector", ["tenantId", "memorySpaceId", "vectorId"]).index("by_scope_source_revision", ["tenantId", "memorySpaceId", "sourceId", "sourceRevision"]).vectorIndex("by_default_embedding_v1", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["tenantId", "memorySpaceId", "profileId", "scopeProfileKey", "scopeProfileOwnerKey"]
  }),
  runtimeMemoryReceipts: defineTable2({
    tenantId: v2.string(),
    memorySpaceId: v2.string(),
    receiptId: v2.string(),
    identity: processingIdentity,
    canonicalIdentity: v2.string(),
    canonicalPayload: v2.string(),
    createdAt: v2.number()
  }).index("by_scope_receipt", ["tenantId", "memorySpaceId", "receiptId"])
};

// convex-dev/runtimePolicySchema.ts
import { defineTable as defineTable3 } from "convex/server";
import { v as v3 } from "convex/values";

// src/domain/model-policy.ts
import { z } from "zod";

// src/domain/profile.ts
var DEFAULT_EMBEDDING_PROFILE = Object.freeze({
  profileId: "cortex-text-small-1536-v1",
  modelId: "openai/text-embedding-3-small",
  dimensions: 1536,
  normalization: "text-nfc-lf-v1",
  chunking: "codepoint-1600-overlap-200-v1",
  indexName: "by_default_embedding_v1"
});
var DEFAULT_VECTOR_FILTER_FIELDS = Object.freeze([
  "tenantId",
  "memorySpaceId",
  "profileId"
]);

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
var MODEL_OPERATION_REGISTRY = Object.freeze(Object.fromEntries(MODEL_OPERATION_KEYS.map((key) => [key, Object.freeze({
  key,
  capability: key.startsWith("embedding.") ? "embedding" : key.startsWith("media.image") ? "image" : key.startsWith("media.video") ? "video" : key === "memory.extract" || key === "facts.resolve" ? "structured" : "text",
  interfaces: Object.freeze(key.startsWith("embedding.") ? ["embedding"] : key.startsWith("media.image") ? ["image"] : key.startsWith("media.video") ? ["video"] : ["chat", "responses"]),
  availableInThisPacket: !key.startsWith("media.")
})])));
var nonempty = z.string().min(1).max(256).refine((value) => value.trim() === value && value.trim().length > 0);
var integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
var positive = integer.min(1);
var modelId = z.string().regex(/^[a-z0-9][a-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/);
var operationKey = z.enum(MODEL_OPERATION_KEYS);
var nativeInterface = z.enum(["chat", "responses", "messages", "embedding", "image", "video"]);
var capability = z.enum(["text", "structured", "tools", "embedding", "image", "video"]);
var optionKey = z.enum(["temperature", "topP", "seed", "stopSequences"]);
var limitsSchema = z.object({
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
var pinsSchema = z.object({
  promptVersion: nonempty,
  schemaVersion: nonempty,
  extractionVersion: nonempty,
  toolRegistryVersion: nonempty,
  priceRevision: nonempty,
  boundRevision: nonempty
}).strict();
var rulesSchema = z.object({
  modelId: modelId.optional(),
  nativeInterface: nativeInterface.optional(),
  allowedModels: z.array(modelId).min(1).optional(),
  interfaces: z.array(nativeInterface).min(1).optional(),
  capabilities: z.array(capability).min(1).optional(),
  allowedOptions: z.array(optionKey).optional(),
  allowedTools: z.array(nonempty).optional(),
  fallbackModels: z.array(modelId).optional(),
  limits: limitsSchema.partial().optional(),
  pins: pinsSchema.partial().optional()
}).strict();
var policySchema = z.object({
  policyId: nonempty,
  version: positive,
  scope: z.enum(["deployment", "tenant", "agent"]),
  tenantId: nonempty.optional(),
  agentId: nonempty.optional(),
  agentVersion: positive.optional(),
  operationKey: operationKey.optional(),
  rules: rulesSchema,
  override: z.object({ actorPrincipalId: nonempty, changeRevision: positive, authorizationId: nonempty }).strict().optional()
}).strict();
var costBoundSchema = z.object({
  kind: z.literal("qualified-call-ceiling"),
  maximumCostUnits: positive,
  provenance: nonempty,
  coversAllProviderCharges: z.literal(true)
}).strict();
var qualificationSchema = z.object({
  receiptId: nonempty,
  modelId,
  nativeInterface,
  capabilities: z.array(capability).min(1),
  allowedOptions: z.array(optionKey),
  limits: limitsSchema,
  costBound: costBoundSchema,
  priceRevision: nonempty,
  boundRevision: nonempty
}).strict();
var scopeSchema = z.object({
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
var profileSchema = z.object({
  profileId: nonempty,
  modelId,
  dimensions: positive,
  normalization: nonempty,
  chunking: nonempty,
  indexName: nonempty
}).strict();
var contextSchema = z.object({
  scope: scopeSchema,
  agent: z.object({ agentId: nonempty, version: positive }).strict().optional(),
  operationKey,
  parentOperationId: nonempty.optional(),
  runBudgetId: nonempty,
  source: z.object({ sourceId: nonempty, sourceEventId: nonempty, sourceRevision: positive }).strict().optional(),
  semanticProfile: profileSchema.optional(),
  /** Exact override records authenticated by a separate backend policy-admin check. */
  authorizedOverrides: z.array(z.object({
    authorizationId: nonempty,
    actorPrincipalId: nonempty,
    changeRevision: positive,
    policyId: nonempty,
    policyVersion: positive
  }).strict())
}).strict();
var resolutionSchema = z.object({
  context: contextSchema,
  policies: z.array(policySchema).min(1),
  qualifications: z.array(qualificationSchema)
}).strict();
var canonicalRecordSchema = z.custom((value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
});
var partSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1) }).strict(),
  z.object({ type: z.literal("tool-call"), toolCallId: nonempty, toolName: nonempty, input: canonicalRecordSchema }).strict(),
  z.object({ type: z.literal("tool-result"), toolCallId: nonempty, toolName: nonempty, output: canonicalRecordSchema }).strict()
]);
var messageSchema = z.object({ role: z.enum(["system", "user", "assistant", "tool"]), parts: z.array(partSchema).min(1) }).strict();
var requestSchema = z.object({
  semanticId: nonempty,
  childCallId: nonempty,
  texts: z.array(z.string().min(1)).min(1),
  messages: z.array(messageSchema).min(1).optional(),
  inputTokens: positive,
  outputTokens: integer,
  toolSteps: integer,
  timeoutMs: positive,
  reservationUnits: positive,
  promptVersion: nonempty,
  schemaVersion: nonempty,
  extractionVersion: nonempty,
  toolRegistryVersion: nonempty,
  tools: z.array(z.object({ name: nonempty, definition: canonicalRecordSchema }).strict()),
  outputSchema: canonicalRecordSchema.optional(),
  options: z.object({
    maxRetries: z.literal(0),
    temperature: z.number().finite().min(0).max(2).optional(),
    topP: z.number().finite().min(0).max(1).optional(),
    seed: integer.optional(),
    stopSequences: z.array(z.string().min(1).max(256)).max(16).optional(),
    providerOptions: z.object({ openai: z.object({ store: z.literal(false) }).strict() }).strict().optional()
  }).strict(),
  profile: profileSchema.optional(),
  batch: z.object({ ordinal: integer, start: integer, end: positive }).strict().optional()
}).strict();
var fallbackEvidenceSchema = z.object({
  outcome: z.enum(["not_dispatched", "confirmed_rejected", "confirmed", "uncertain"]),
  proof: z.enum(["pre_dispatch", "qualified_rejection", "none"]),
  outputVisible: z.boolean(),
  toolInputVisible: z.boolean(),
  toolResultVisible: z.boolean(),
  toolEffectCommitted: z.boolean(),
  paidLiabilityUncertain: z.boolean(),
  cancelled: z.boolean(),
  priorAttemptAccounted: z.boolean(),
  currentAuthorityChecked: z.boolean(),
  currentSourceChecked: z.boolean(),
  currentPolicyChecked: z.boolean()
}).strict();

// convex-dev/runtimePolicySchema.ts
var modelOperationKey = v3.union(...MODEL_OPERATION_KEYS.map((key) => v3.literal(key)));
var modelSource = v3.object({ sourceId: v3.string(), sourceEventId: v3.string(), sourceRevision: v3.number(), contentHash: v3.string() });
var rootProvenance = v3.object({
  manifestId: v3.string(),
  revision: v3.number(),
  canonical: v3.string(),
  hash: v3.string(),
  artifactRevision: v3.string(),
  evidenceHash: v3.string(),
  acceptanceHash: v3.string()
});
var policyState = v3.union(
  v3.literal("reserved"),
  v3.literal("dispatch_pending"),
  v3.literal("settled"),
  v3.literal("not_dispatched"),
  v3.literal("confirmed_rejected"),
  v3.literal("uncertain")
);
var visibilityFields = { outputVisible: v3.boolean(), toolInputVisible: v3.boolean(), toolResultVisible: v3.boolean(), toolEffectCommitted: v3.boolean() };
var runtimePolicyTables = {
  runtimeModelPolicies: defineTable3({
    policyId: v3.string(),
    version: v3.number(),
    scope: v3.union(v3.literal("deployment"), v3.literal("tenant"), v3.literal("agent")),
    tenantId: v3.optional(v3.string()),
    agentId: v3.optional(v3.string()),
    agentVersion: v3.optional(v3.number()),
    operationKey: v3.optional(modelOperationKey),
    canonical: v3.string(),
    root: rootProvenance,
    actorReference: v3.optional(runtimeAuthorityReference),
    active: v3.boolean(),
    revokedAt: v3.optional(v3.number()),
    createdAt: v3.number()
  }).index("by_policy_version", ["policyId", "version"]).index("by_scope_active", ["scope", "tenantId", "active"]),
  runtimeModelQualifications: defineTable3({
    receiptId: v3.string(),
    version: v3.number(),
    canonical: v3.string(),
    root: rootProvenance,
    active: v3.boolean(),
    revokedAt: v3.optional(v3.number()),
    createdAt: v3.number()
  }).index("by_receipt", ["receiptId", "version"]).index("by_active", ["active"]),
  runtimeBudgetAccounts: defineTable3({
    accountKey: v3.string(),
    scopeKey: v3.string(),
    kind: v3.union(v3.literal("tenant"), v3.literal("run")),
    tenantId: v3.string(),
    runBudgetId: v3.optional(v3.string()),
    reference: v3.optional(runtimeAuthorityReference),
    requestCanonical: v3.optional(v3.string()),
    agentId: v3.optional(v3.string()),
    agentVersion: v3.optional(v3.number()),
    windowId: v3.string(),
    windowStart: v3.number(),
    windowEnd: v3.number(),
    currency: v3.literal("USD"),
    monetaryUnit: v3.literal("micro-USD"),
    root: rootProvenance,
    limitUnits: v3.number(),
    reservedUnits: v3.number(),
    settledUnits: v3.number(),
    uncertainUnits: v3.number(),
    concurrencyLimit: v3.number(),
    activeConcurrency: v3.number(),
    overrun: v3.boolean(),
    current: v3.boolean(),
    cancelled: v3.boolean(),
    predecessor: v3.optional(v3.id("runtimeBudgetAccounts")),
    version: v3.number(),
    createdAt: v3.number()
  }).index("by_account_key", ["accountKey"]).index("by_scope_current", ["scopeKey", "current"]).index("by_run", ["runBudgetId"]),
  runtimeModelOperations: defineTable3({
    operationId: v3.string(),
    reference: runtimeAuthorityReference,
    tenantId: v3.string(),
    memorySpaceId: v3.string(),
    principalId: v3.string(),
    semanticId: v3.string(),
    operationKey: modelOperationKey,
    runAccountId: v3.id("runtimeBudgetAccounts"),
    parentOperationId: v3.optional(v3.id("runtimeModelOperations")),
    source: v3.optional(modelSource),
    resolutionCanonical: v3.string(),
    snapshotCanonical: v3.string(),
    identityCanonical: v3.string(),
    identityHash: v3.string(),
    reservedUnits: v3.number(),
    settledUnits: v3.number(),
    uncertainUnits: v3.number(),
    overrun: v3.boolean(),
    cancelled: v3.boolean(),
    createdAt: v3.number()
  }).index("by_identity", ["tenantId", "memorySpaceId", "principalId", "semanticId", "operationKey"]),
  runtimeModelAttempts: defineTable3({
    operationDocumentId: v3.id("runtimeModelOperations"),
    childCallId: v3.string(),
    ordinal: v3.number(),
    attemptNumber: v3.number(),
    fallbackModelId: v3.optional(v3.string()),
    priorAttemptId: v3.optional(v3.id("runtimeModelAttempts")),
    canonical: v3.string(),
    hash: v3.string(),
    resolutionCanonical: v3.string(),
    snapshotCanonical: v3.string(),
    inputProofCanonical: v3.string(),
    measuredInputTokens: v3.number(),
    maximumOutputTokens: v3.number(),
    tenantAccountId: v3.id("runtimeBudgetAccounts"),
    runAccountId: v3.id("runtimeBudgetAccounts"),
    reservationUnits: v3.number(),
    state: policyState,
    dispatchIdentity: v3.string(),
    checkpointAt: v3.optional(v3.number()),
    slotReleased: v3.boolean(),
    ...visibilityFields,
    receiptCanonical: v3.optional(v3.string()),
    receiptHash: v3.optional(v3.string()),
    settledCostUnits: v3.optional(v3.number()),
    costProvenance: v3.optional(v3.string()),
    actualModel: v3.optional(v3.string()),
    privateResultCanonical: v3.optional(v3.string()),
    resultWithheld: v3.boolean(),
    terminalEvidenceCanonical: v3.optional(v3.string()),
    createdAt: v3.number()
  }).index("by_child_attempt", ["operationDocumentId", "childCallId", "attemptNumber"]).index("by_operation", ["operationDocumentId"]).index("by_state_checkpoint", ["state", "checkpointAt"])
};

// convex-dev/schema.ts
var schema_default = defineSchema({
  ...runtimeAuthTables,
  ...runtimeMemoryTables,
  ...runtimePolicyTables,
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1a: Conversations (ACID, Immutable)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversations: defineTable4({
    // Identity
    conversationId: v4.string(),
    // Unique ID (e.g., "conv-abc123")
    // Memory Space (NEW - fundamental isolation boundary)
    memorySpaceId: v4.string(),
    // Which memory space owns this conversation
    participantId: v4.optional(v4.string()),
    // Hive Mode: which participant created this
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v4.optional(v4.string()),
    // Tenant ID for isolation
    // Type: user-agent (user ↔ participant) or agent-agent (space ↔ space)
    type: v4.union(v4.literal("user-agent"), v4.literal("agent-agent")),
    // Participants (based on type)
    participants: v4.object({
      // user-agent conversations (single user)
      userId: v4.optional(v4.string()),
      // The primary human user in the conversation
      agentId: v4.optional(v4.string()),
      // The agent/assistant in the conversation
      // Collaborative conversations (Phase 4) - multiple human participants
      userIds: v4.optional(v4.array(v4.string())),
      // Multiple human users
      // Hive Mode tracking (which tool/agent in shared space created this)
      participantId: v4.optional(v4.string()),
      // agent-agent conversations (Collaboration Mode - cross-space)
      memorySpaceIds: v4.optional(v4.array(v4.string()))
      // Both spaces involved
    }),
    // Collaborative settings (Phase 4)
    collaborativeSettings: v4.optional(
      v4.object({
        // Whether messages from non-owners require approval
        requireApproval: v4.boolean(),
        // The owner who can approve messages (defaults to first userId/userIds[0])
        ownerUserId: v4.optional(v4.string()),
        // IDs of approved participants (others require approval)
        approvedParticipants: v4.optional(v4.array(v4.string()))
      })
    ),
    // Messages (append-only, immutable)
    messages: v4.array(
      v4.object({
        id: v4.string(),
        // Message ID
        role: v4.union(
          v4.literal("user"),
          v4.literal("agent"),
          v4.literal("system")
        ),
        content: v4.string(),
        timestamp: v4.number(),
        // Optional fields
        participantId: v4.optional(v4.string()),
        // Which participant sent this (Hive Mode/Collaborative)
        metadata: v4.optional(v4.any()),
        // Flexible metadata
        attachmentIds: v4.optional(v4.array(v4.string())),
        // Multi-modal attachment references
        // Collaborative approval (Phase 4)
        approvalStatus: v4.optional(
          v4.union(
            v4.literal("pending"),
            v4.literal("approved"),
            v4.literal("rejected")
          )
        ),
        approvedBy: v4.optional(v4.string()),
        // userId who approved
        approvedAt: v4.optional(v4.number())
        // Approval timestamp
      })
    ),
    // Statistics
    messageCount: v4.number(),
    // Metadata (flexible)
    metadata: v4.optional(v4.any()),
    // Timestamps
    createdAt: v4.number(),
    updatedAt: v4.number(),
    // Visibility for shareable chats (Phase 1)
    // - 'private': Only owner can access (default)
    // - 'space': Anyone in the memory space can access
    // - 'public': Anyone with the conversationId can access
    visibility: v4.optional(
      v4.union(
        v4.literal("private"),
        v4.literal("space"),
        v4.literal("public")
      )
    )
  }).index("by_conversationId", ["conversationId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_type", ["type"]).index("by_user", ["participants.userId"]).index("by_agent", ["participants.agentId"]).index("by_memorySpace_user", ["memorySpaceId", "participants.userId"]).index("by_memorySpace_agent", ["memorySpaceId", "participants.agentId"]).index("by_created", ["createdAt"]).index("by_visibility", ["visibility"]).index("by_memorySpace_visibility", ["memorySpaceId", "visibility"]),
  // Space + visibility
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Shares (Shareable Chats Phase 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversationShares: defineTable4({
    // Identity
    shareId: v4.string(),
    // Public-facing identifier for share links
    conversationId: v4.string(),
    // Granter (owner)
    grantedBy: v4.string(),
    // userId who shared
    sourceMemorySpaceId: v4.string(),
    // Recipient(s)
    grantType: v4.union(
      v4.literal("user"),
      // Specific user
      v4.literal("space"),
      // Entire memory space
      v4.literal("link"),
      // Anyone with link
      v4.literal("domain")
      // Anyone from email domain
    ),
    grantedTo: v4.optional(v4.string()),
    // userId, memorySpaceId, or domain
    // Permissions
    permissions: v4.object({
      canView: v4.boolean(),
      // See messages
      canViewFacts: v4.boolean(),
      // See extracted facts
      canViewMemories: v4.boolean(),
      // See related memories
      canContinue: v4.boolean(),
      // Add new messages
      canFork: v4.boolean(),
      // Create a copy
      canExport: v4.boolean()
      // Download transcript
    }),
    // Constraints
    expiresAt: v4.optional(v4.number()),
    // Time-limited sharing
    maxViews: v4.optional(v4.number()),
    // View-limited sharing
    viewCount: v4.number(),
    // Redaction
    redactBefore: v4.optional(v4.number()),
    // Hide messages before timestamp
    redactSensitive: v4.boolean(),
    // Auto-redact PII
    // Status
    status: v4.union(
      v4.literal("active"),
      v4.literal("revoked"),
      v4.literal("expired")
    ),
    // Multi-tenancy
    tenantId: v4.optional(v4.string()),
    // Timestamps
    createdAt: v4.number(),
    revokedAt: v4.optional(v4.number())
  }).index("by_shareId", ["shareId"]).index("by_conversation", ["conversationId"]).index("by_grantedTo", ["grantedTo"]).index("by_grantedBy", ["grantedBy"]).index("by_status", ["status"]).index("by_tenant_shareId", ["tenantId", "shareId"]).index("by_tenant_conversation", ["tenantId", "conversationId"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Snapshots (Shareable Chats Phase 3)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversationSnapshots: defineTable4({
    // Identity
    snapshotId: v4.string(),
    conversationId: v4.string(),
    // Source conversation
    // Snapshot content (immutable after creation)
    messages: v4.array(
      v4.object({
        id: v4.string(),
        role: v4.union(
          v4.literal("user"),
          v4.literal("agent"),
          v4.literal("system")
        ),
        content: v4.string(),
        timestamp: v4.number(),
        participantId: v4.optional(v4.string())
        // Note: PII-redacted version stored here
      })
    ),
    // Original conversation metadata
    conversationType: v4.union(
      v4.literal("user-agent"),
      v4.literal("agent-agent")
    ),
    participants: v4.object({
      userId: v4.optional(v4.string()),
      agentId: v4.optional(v4.string()),
      participantId: v4.optional(v4.string()),
      memorySpaceIds: v4.optional(v4.array(v4.string()))
    }),
    // Snapshot metadata
    messageCount: v4.number(),
    // What was included
    includedContent: v4.object({
      messages: v4.boolean(),
      facts: v4.boolean(),
      memories: v4.boolean()
    }),
    // Redaction info
    redaction: v4.object({
      piiRedacted: v4.boolean(),
      messagesRedactedBefore: v4.optional(v4.number()),
      // Timestamp
      customRedactions: v4.optional(
        v4.array(
          v4.object({
            pattern: v4.string(),
            replacement: v4.string()
          })
        )
      )
    }),
    // Associated facts snapshot (if included)
    facts: v4.optional(
      v4.array(
        v4.object({
          factId: v4.string(),
          fact: v4.string(),
          factType: v4.string(),
          confidence: v4.number()
        })
      )
    ),
    // Owner info
    createdBy: v4.string(),
    // userId
    memorySpaceId: v4.string(),
    // Multi-tenancy
    tenantId: v4.optional(v4.string()),
    // Status
    status: v4.union(
      v4.literal("active"),
      v4.literal("archived"),
      v4.literal("deleted")
    ),
    // Timestamps
    createdAt: v4.number(),
    snapshotOf: v4.number()
    // Timestamp of when the snapshot was taken
  }).index("by_snapshotId", ["snapshotId"]).index("by_conversation", ["conversationId"]).index("by_createdBy", ["createdBy"]).index("by_memorySpace", ["memorySpaceId"]).index("by_status", ["status"]).index("by_tenant_snapshotId", ["tenantId", "snapshotId"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1b: Immutable Store (ACID, Versioned, Shared)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  immutable: defineTable4({
    // Identity (composite key: type + id)
    type: v4.string(),
    // Entity type: 'kb-article', 'policy', 'audit-log', 'feedback', 'user'
    id: v4.string(),
    // Type-specific logical ID
    // Data (flexible, immutable once stored)
    data: v4.any(),
    // GDPR support (optional)
    userId: v4.optional(v4.string()),
    // Links to user for cascade deletion
    // Multi-tenancy (NEW - for non-critical path isolation)
    tenantId: v4.optional(v4.string()),
    // Trusted tenant selector
    ownerPrincipalId: v4.optional(v4.string()),
    tombstonedAt: v4.optional(v4.number()),
    memorySpaceId: v4.optional(v4.string()),
    // Optional trusted grant scope
    // Versioning
    version: v4.number(),
    // Current version number (starts at 1)
    previousVersions: v4.array(
      v4.object({
        version: v4.number(),
        data: v4.any(),
        timestamp: v4.number(),
        metadata: v4.optional(v4.any())
      })
    ),
    // Metadata (flexible - any JSON-serializable object)
    metadata: v4.optional(v4.any()),
    // Timestamps
    createdAt: v4.number(),
    updatedAt: v4.number()
  }).index("by_runtime_scope", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_runtime_key", ["tenantId", "memorySpaceId", "type", "id"]).index("by_type_id", ["type", "id"]).index("by_type", ["type"]).index("by_tenantId", ["tenantId"]).index("by_tenant_type_id", ["tenantId", "type", "id"]).index("by_userId", ["userId"]).index("by_created", ["createdAt"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1c: Mutable Store (ACID, No Versioning, Shared)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  mutable: defineTable4({
    // Composite key: namespace + key
    namespace: v4.string(),
    // Logical grouping: 'inventory', 'config', 'counters', etc.
    key: v4.string(),
    // Unique key within namespace
    // Value (flexible, mutable)
    value: v4.any(),
    // GDPR support (optional)
    userId: v4.optional(v4.string()),
    // Links to user for cascade deletion
    // Multi-tenancy (NEW - for non-critical path isolation)
    tenantId: v4.optional(v4.string()),
    // Trusted tenant selector
    ownerPrincipalId: v4.optional(v4.string()),
    tombstonedAt: v4.optional(v4.number()),
    memorySpaceId: v4.optional(v4.string()),
    // Optional trusted grant scope
    // Metadata (optional)
    metadata: v4.optional(v4.any()),
    // Timestamps
    createdAt: v4.number(),
    updatedAt: v4.number()
  }).index("by_runtime_scope", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_runtime_key", ["tenantId", "memorySpaceId", "namespace", "key"]).index("by_namespace_key", ["namespace", "key"]).index("by_namespace", ["namespace"]).index("by_tenantId", ["tenantId"]).index("by_tenant_namespace", ["tenantId", "namespace"]).index("by_tenant_namespace_key", ["tenantId", "namespace", "key"]).index("by_userId", ["userId"]).index("by_updated", ["updatedAt"]),
  // Recent changes
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 2: Vector Memory (Searchable, memorySpace-scoped, Versioned)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memories: defineTable4({
    // Fresh runtime ownership/provenance; old unowned rows are never adopted.
    ownerPrincipalId: v4.optional(v4.string()),
    runtimeEditor: v4.optional(v4.object({ principalId: v4.string(), userId: v4.string(), editedAt: v4.number() })),
    manualSourceBinding: v4.optional(v4.object({ resourceType: v4.union(v4.literal("memory"), v4.literal("fact")), resourceId: v4.string() })),
    lineage: v4.optional(sourceLineage),
    tombstonedAt: v4.optional(v4.number()),
    // Identity
    memoryId: v4.string(),
    // Unique ID for this memory
    memorySpaceId: v4.string(),
    // NEW: Memory space isolation (was agentId)
    participantId: v4.optional(v4.string()),
    // NEW: Hive Mode participant tracking
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v4.optional(v4.string()),
    // Tenant ID for isolation
    // Content
    content: v4.string(),
    contentType: v4.union(
      v4.literal("raw"),
      v4.literal("summarized"),
      v4.literal("fact")
      // NEW: For facts indexed in vector layer
    ),
    embedding: v4.optional(v4.array(v4.float64())),
    // Optional for keyword-only
    // Source (flattened for indexing performance)
    sourceType: v4.union(
      v4.literal("conversation"),
      v4.literal("system"),
      v4.literal("tool"),
      v4.literal("a2a"),
      v4.literal("fact-extraction")
      // NEW: For facts
    ),
    sourceUserId: v4.optional(v4.string()),
    sourceUserName: v4.optional(v4.string()),
    sourceTimestamp: v4.number(),
    // Message role (for conversation memories) - helps with semantic search weighting
    messageRole: v4.optional(
      v4.union(v4.literal("user"), v4.literal("agent"), v4.literal("system"))
    ),
    // Owner Attribution (at least one required for proper tracking)
    userId: v4.optional(v4.string()),
    // For user-owned memories (GDPR cascade)
    agentId: v4.optional(v4.string()),
    // For agent-owned memories (agent deletion cascade)
    // References to Layer 1 (mutually exclusive, all optional)
    conversationRef: v4.optional(
      v4.object({
        conversationId: v4.string(),
        messageIds: v4.array(v4.string())
      })
    ),
    immutableRef: v4.optional(
      v4.object({
        type: v4.string(),
        id: v4.string(),
        version: v4.optional(v4.number())
      })
    ),
    mutableRef: v4.optional(
      v4.object({
        namespace: v4.string(),
        key: v4.string(),
        snapshotValue: v4.any(),
        snapshotAt: v4.number()
      })
    ),
    // NEW: Reference to Layer 3 fact
    factsRef: v4.optional(
      v4.object({
        factId: v4.string(),
        version: v4.optional(v4.number())
      })
    ),
    // Metadata (flattened for indexing/filtering)
    importance: v4.number(),
    // 0-100 (flattened for filtering)
    tags: v4.array(v4.string()),
    // Flattened for filtering
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Enrichment Fields (for bullet-proof retrieval)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    enrichedContent: v4.optional(v4.string()),
    // Concatenated searchable content for embedding
    factCategory: v4.optional(v4.string()),
    // Category for filtering (e.g., "addressing_preference")
    // Flexible metadata (for source-specific data like A2A direction, messageId, etc.)
    metadata: v4.optional(v4.any()),
    // Versioning (like immutable)
    version: v4.number(),
    previousVersions: v4.array(
      v4.object({
        version: v4.number(),
        content: v4.string(),
        embedding: v4.optional(v4.array(v4.float64())),
        timestamp: v4.number()
      })
    ),
    // Timestamps & Access
    createdAt: v4.number(),
    updatedAt: v4.number(),
    lastAccessed: v4.optional(v4.number()),
    accessCount: v4.number(),
    // Streaming support (NEW - for progressive storage)
    isPartial: v4.optional(v4.boolean()),
    // Flag for in-progress streaming memories
    partialMetadata: v4.optional(v4.any())
    // Metadata for partial/streaming memories
  }).index("by_memorySpace", ["memorySpaceId"]).index("by_memoryId", ["memoryId"]).index("by_runtime_scope_memoryId", ["tenantId", "memorySpaceId", "memoryId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_userId", ["userId"]).index("by_agentId", ["agentId"]).index("by_memorySpace_created", ["memorySpaceId", "createdAt"]).index("by_memorySpace_userId", ["memorySpaceId", "userId"]).index("by_memorySpace_agentId", ["memorySpaceId", "agentId"]).index("by_participantId", ["participantId"]).searchIndex("by_content", {
    searchField: "content",
    filterFields: [
      "ownerPrincipalId",
      "memorySpaceId",
      "tenantId",
      "sourceType",
      "userId",
      "agentId",
      "participantId"
    ]
    // Updated filters
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    // Default: OpenAI text-embedding-3-small
    filterFields: [
      "memorySpaceId",
      "tenantId",
      "userId",
      "agentId",
      "participantId"
    ]
    // Updated: tenantId for isolation
  }),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 3: Facts Store (NEW - memorySpace-scoped, Versioned)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  facts: defineTable4({
    // Trusted runtime provenance; unrelated explicit facts share this authoritative table.
    ownerPrincipalId: v4.optional(v4.string()),
    runtimeEditor: v4.optional(v4.object({ principalId: v4.string(), userId: v4.string(), editedAt: v4.number() })),
    manualSourceBinding: v4.optional(v4.object({ resourceType: v4.union(v4.literal("memory"), v4.literal("fact")), resourceId: v4.string() })),
    lineage: v4.optional(sourceLineage),
    extractionPolicyVersion: v4.optional(v4.string()),
    processingReceiptId: v4.optional(v4.string()),
    tombstonedAt: v4.optional(v4.number()),
    // Identity
    factId: v4.string(),
    // Unique ID for this fact
    memorySpaceId: v4.string(),
    // Memory space isolation
    participantId: v4.optional(v4.string()),
    // Hive Mode: which participant extracted this
    userId: v4.optional(v4.string()),
    // GDPR compliance - links to user
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v4.optional(v4.string()),
    // Tenant ID for isolation
    // Fact content
    fact: v4.string(),
    // The fact statement
    factType: v4.union(
      v4.literal("preference"),
      v4.literal("identity"),
      v4.literal("knowledge"),
      v4.literal("relationship"),
      v4.literal("event"),
      v4.literal("observation"),
      v4.literal("custom")
    ),
    // Triple structure (subject-predicate-object)
    subject: v4.optional(v4.string()),
    // Primary entity (e.g., "user-123")
    predicate: v4.optional(v4.string()),
    // Relationship (e.g., "prefers", "works_at")
    object: v4.optional(v4.string()),
    // Secondary entity (e.g., "dark mode")
    // Quality & Source
    confidence: v4.number(),
    // 0-100: extraction confidence
    sourceType: v4.union(
      v4.literal("conversation"),
      v4.literal("system"),
      v4.literal("tool"),
      v4.literal("manual"),
      v4.literal("a2a"),
      v4.literal("fact-extraction")
      // For fact-extracted content
    ),
    sourceRef: v4.optional(
      v4.object({
        conversationId: v4.optional(v4.string()),
        messageIds: v4.optional(v4.array(v4.string())),
        memoryId: v4.optional(v4.string())
      })
    ),
    // Metadata & Tags
    metadata: v4.optional(v4.any()),
    tags: v4.array(v4.string()),
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Enrichment Fields (for bullet-proof retrieval)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    category: v4.optional(v4.string()),
    // Specific sub-category (e.g., "addressing_preference")
    searchAliases: v4.optional(v4.array(v4.string())),
    // Alternative search terms
    semanticContext: v4.optional(v4.string()),
    // Usage context sentence
    entities: v4.optional(
      v4.array(
        v4.object({
          name: v4.string(),
          type: v4.string(),
          fullValue: v4.optional(v4.string())
        })
      )
    ),
    // Extracted entities with types
    relations: v4.optional(
      v4.array(
        v4.object({
          subject: v4.string(),
          predicate: v4.string(),
          object: v4.string()
        })
      )
    ),
    // Subject-predicate-object triples for graph
    // Temporal validity
    validFrom: v4.optional(v4.number()),
    validUntil: v4.optional(v4.number()),
    // Versioning (creates immutable chain)
    version: v4.number(),
    supersededBy: v4.optional(v4.string()),
    // factId of newer version
    supersedes: v4.optional(v4.string()),
    // factId this replaces
    // Timestamps
    createdAt: v4.number(),
    updatedAt: v4.number(),
    // Embedding for semantic search (v0.30.0+)
    embedding: v4.optional(v4.array(v4.float64()))
  }).index("by_factId", ["factId"]).index("by_runtime_scope_factId", ["tenantId", "memorySpaceId", "factId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_memorySpace_subject", ["memorySpaceId", "subject"]).index("by_participantId", ["participantId"]).index("by_userId", ["userId"]).searchIndex("by_content", {
    searchField: "fact",
    filterFields: ["memorySpaceId", "tenantId", "factType", "ownerPrincipalId"]
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    // OpenAI text-embedding-3-small / ada-002
    filterFields: ["memorySpaceId", "tenantId"]
  }),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Fact History (Belief Revision Audit Trail)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  factHistory: defineTable4({
    // Identity
    eventId: v4.string(),
    // Unique event ID
    factId: v4.string(),
    // The fact this event relates to
    memorySpaceId: v4.string(),
    // Memory space for scoping
    // Action that was taken
    action: v4.union(
      v4.literal("CREATE"),
      v4.literal("UPDATE"),
      v4.literal("SUPERSEDE"),
      v4.literal("DELETE")
    ),
    // Values (for tracking changes)
    oldValue: v4.optional(v4.string()),
    // Previous fact text
    newValue: v4.optional(v4.string()),
    // New fact text
    // Relationships
    supersededBy: v4.optional(v4.string()),
    // factId that replaced this
    supersedes: v4.optional(v4.string()),
    // factId this replaced
    // Decision context
    reason: v4.optional(v4.string()),
    // Why this action was taken
    confidence: v4.optional(v4.number()),
    // Confidence in the decision
    // Pipeline info
    pipeline: v4.optional(
      v4.object({
        slotMatching: v4.optional(v4.boolean()),
        semanticMatching: v4.optional(v4.boolean()),
        llmResolution: v4.optional(v4.boolean())
      })
    ),
    // Source context
    userId: v4.optional(v4.string()),
    // User who triggered the change
    participantId: v4.optional(v4.string()),
    // Participant who triggered
    conversationId: v4.optional(v4.string()),
    // Conversation context
    // Timestamps
    timestamp: v4.number()
  }).index("by_eventId", ["eventId"]).index("by_factId", ["factId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_memorySpace_timestamp", ["memorySpaceId", "timestamp"]).index("by_action", ["action"]).index("by_userId", ["userId"]).index("by_timestamp", ["timestamp"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Spaces Registry (Hive/Collaboration Mode Management)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memorySpaces: defineTable4({
    // Identity
    memorySpaceId: v4.string(),
    // Unique memory space ID
    name: v4.optional(v4.string()),
    // Human-readable name
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v4.optional(v4.string()),
    // Tenant ID for isolation
    ownerPrincipalId: v4.optional(v4.string()),
    // Trusted verified resource owner
    tombstonedAt: v4.optional(v4.number()),
    // Retained deletion fence
    type: v4.union(
      v4.literal("personal"),
      v4.literal("team"),
      v4.literal("project"),
      v4.literal("custom")
    ),
    // Participants (for Hive Mode)
    participants: v4.array(
      v4.object({
        id: v4.string(),
        // Participant ID (e.g., 'cursor', 'claude', 'my-bot')
        type: v4.string(),
        // 'ai-tool', 'human', 'ai-agent', 'system'
        joinedAt: v4.number()
      })
    ),
    // Metadata (flexible)
    metadata: v4.any(),
    // Status
    status: v4.union(v4.literal("active"), v4.literal("archived")),
    // Timestamps
    createdAt: v4.number(),
    updatedAt: v4.number()
  }).index("by_runtime_scope_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_memorySpaceId", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_memorySpaceId", ["tenantId", "memorySpaceId"]).index("by_tenant_status", ["tenantId", "status"]).index("by_status", ["status"]).index("by_type", ["type"]).index("by_created", ["createdAt"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Contexts (Hierarchical Coordination, memorySpace-scoped with cross-space support)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  contexts: defineTable4({
    // Identity
    contextId: v4.string(),
    // Unique ID
    memorySpaceId: v4.string(),
    // NEW: Which memory space owns this context
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v4.optional(v4.string()),
    // Tenant ID for isolation
    ownerPrincipalId: v4.optional(v4.string()),
    // Trusted verified resource owner
    tombstonedAt: v4.optional(v4.number()),
    // Retained deletion fence
    // Purpose
    purpose: v4.string(),
    // What this context is for
    description: v4.optional(v4.string()),
    // Optional description
    // Hierarchy
    parentId: v4.optional(v4.string()),
    // Parent context (can be cross-space)
    rootId: v4.optional(v4.string()),
    // Root context
    depth: v4.number(),
    // 0 for root, increments with depth
    childIds: v4.array(v4.string()),
    // Child contexts
    // Status
    status: v4.union(
      v4.literal("active"),
      v4.literal("completed"),
      v4.literal("cancelled"),
      v4.literal("blocked")
    ),
    // Source conversation (optional)
    conversationRef: v4.optional(
      v4.object({
        conversationId: v4.string(),
        messageIds: v4.optional(v4.array(v4.string()))
      })
    ),
    // User association (GDPR)
    userId: v4.optional(v4.string()),
    // Participants (for tracking)
    participants: v4.array(v4.string()),
    // Memory spaces or participants involved
    // Cross-space access control
    grantedAccess: v4.optional(
      v4.array(
        v4.object({
          memorySpaceId: v4.string(),
          // Which space has access
          scope: v4.string(),
          // 'read-only', 'context-only', etc.
          grantedAt: v4.number()
        })
      )
    ),
    // Data (flexible)
    data: v4.optional(v4.any()),
    // Metadata
    metadata: v4.optional(v4.any()),
    // Versioning (automatic version tracking for updates)
    lastUpdatedBy: v4.optional(v4.string()),
    // Actual verified writer of the current revision
    version: v4.number(),
    // Current version number (starts at 1)
    previousVersions: v4.array(
      v4.object({
        version: v4.number(),
        status: v4.string(),
        data: v4.optional(v4.any()),
        timestamp: v4.number(),
        updatedBy: v4.optional(v4.string())
        // Agent/participant that made the change
      })
    ),
    // Timestamps
    createdAt: v4.number(),
    updatedAt: v4.number(),
    completedAt: v4.optional(v4.number())
  }).index("by_runtime_scope_context", ["tenantId", "memorySpaceId", "contextId"]).index("by_runtime_scope_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_contextId", ["contextId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_contextId", ["tenantId", "contextId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_parentId", ["parentId"]).index("by_rootId", ["rootId"]).index("by_status", ["status"]).index("by_memorySpace_status", ["memorySpaceId", "status"]).index("by_userId", ["userId"]).index("by_created", ["createdAt"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Agents Registry (Optional Metadata Layer)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  agents: defineTable4({
    // Identity
    agentId: v4.string(),
    // Unique agent identifier
    memorySpaceId: v4.optional(v4.string()),
    // Optional trusted space scope
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v4.optional(v4.string()),
    // Tenant ID for isolation
    ownerPrincipalId: v4.optional(v4.string()),
    // Trusted verified resource owner
    tombstonedAt: v4.optional(v4.number()),
    // Retained deletion fence
    // Metadata
    name: v4.string(),
    // Display name
    description: v4.optional(v4.string()),
    // What this agent does
    metadata: v4.optional(v4.any()),
    // Flexible metadata (team, capabilities, etc.)
    // Configuration
    config: v4.optional(v4.any()),
    // Agent-specific configuration
    // Status
    status: v4.union(
      v4.literal("active"),
      v4.literal("inactive"),
      v4.literal("archived")
    ),
    // Timestamps
    registeredAt: v4.number(),
    updatedAt: v4.number(),
    lastActive: v4.optional(v4.number())
    // Last time agent created data
  }).index("by_runtime_scope_agent", ["tenantId", "memorySpaceId", "agentId"]).index("by_runtime_scope_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_agentId", ["agentId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_status", ["tenantId", "status"]).index("by_status", ["status"]).index("by_registered", ["registeredAt"]),
  // Chronological ordering
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Sessions (Native Session Management)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  sessions: defineTable4({
    // Identity
    sessionId: v4.string(),
    // Unique session ID
    userId: v4.string(),
    // User this session belongs to
    // Multi-tenancy (NEW - critical for isolation)
    tenantId: v4.optional(v4.string()),
    // Trusted tenant selector
    ownerPrincipalId: v4.optional(v4.string()),
    tombstonedAt: v4.optional(v4.number()),
    authorityReference: v4.optional(runtimeAuthorityReference),
    // Server-pinned maintenance authority
    // Memory space association
    memorySpaceId: v4.optional(v4.string()),
    // Memory space for this session
    // Session state
    status: v4.union(v4.literal("active"), v4.literal("idle"), v4.literal("ended")),
    startedAt: v4.number(),
    // When session started
    lastActiveAt: v4.number(),
    // Last activity timestamp
    endedAt: v4.optional(v4.number()),
    // When session ended
    expiresAt: v4.optional(v4.number()),
    // When session expires (from governance policy)
    // Fully extensible metadata (v.any() allows any shape)
    metadata: v4.optional(v4.any()),
    // Statistics
    messageCount: v4.number(),
    // Messages in this session
    memoryCount: v4.number()
    // Memories created in this session
  }).index("by_runtime_scope", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_runtime_key", ["tenantId", "memorySpaceId", "sessionId"]).index("by_sessionId", ["sessionId"]).index("by_userId", ["userId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_user", ["tenantId", "userId"]).index("by_status", ["status"]).index("by_memorySpace", ["memorySpaceId"]).index("by_lastActive", ["lastActiveAt"]).index("by_tenant_status", ["tenantId", "status"]),
  // Tenant + status
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Governance Policies (Data Retention, Purging, and Compliance)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  governancePolicies: defineTable4({
    // Fresh verified ownership; handlers reject missing fields rather than adopt rows.
    tenantId: v4.optional(v4.string()),
    ownerPrincipalId: v4.optional(v4.string()),
    authority: v4.optional(runtimeAuthorityReference),
    // Scope
    organizationId: v4.optional(v4.string()),
    memorySpaceId: v4.optional(v4.string()),
    // Memory space override
    // Policy configuration (full JSON structure)
    policy: v4.any(),
    // GovernancePolicy structure
    // Metadata
    isActive: v4.boolean(),
    appliedBy: v4.optional(v4.string()),
    // Who applied this policy
    // Timestamps
    createdAt: v4.number(),
    updatedAt: v4.number()
  }).index("by_organization", ["organizationId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_active", ["isActive", "organizationId"]).index("by_updated", ["updatedAt"]).index("by_runtime_scope_active", ["tenantId", "memorySpaceId", "isActive"]),
  // Governance Enforcement Log (Audit Trail)
  governanceEnforcement: defineTable4({
    policyId: v4.optional(v4.id("governancePolicies")),
    simulation: v4.optional(v4.boolean()),
    // Fresh verified ownership; handlers reject missing fields rather than adopt rows.
    tenantId: v4.optional(v4.string()),
    ownerPrincipalId: v4.optional(v4.string()),
    authority: v4.optional(runtimeAuthorityReference),
    // Scope
    organizationId: v4.optional(v4.string()),
    memorySpaceId: v4.optional(v4.string()),
    // Enforcement details
    enforcementType: v4.union(v4.literal("automatic"), v4.literal("manual")),
    layers: v4.array(v4.string()),
    // Which layers were enforced
    rules: v4.array(v4.string()),
    // Which rules were enforced
    // Results
    versionsDeleted: v4.number(),
    recordsPurged: v4.number(),
    storageFreed: v4.number(),
    // MB
    // Metadata
    triggeredBy: v4.optional(v4.string()),
    // Timestamps
    executedAt: v4.number()
  }).index("by_organization", ["organizationId", "executedAt"]).index("by_memorySpace", ["memorySpaceId", "executedAt"]).index("by_executed", ["executedAt"]).index("by_runtime_scope_executed", ["tenantId", "memorySpaceId", "executedAt"]).index("by_runtime_policy", ["policyId"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Graph Sync Queue (Real-time Graph Database Synchronization)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  graphSyncQueue: defineTable4({
    memorySpaceId: v4.optional(v4.string()),
    entityDocumentId: v4.optional(v4.id("facts")),
    entityVersion: v4.optional(v4.number()),
    sourceId: v4.optional(v4.string()),
    sourceEventId: v4.optional(v4.string()),
    sourceRevision: v4.optional(v4.number()),
    // Fresh verified ownership; handlers reject missing fields rather than adopt rows.
    tenantId: v4.optional(v4.string()),
    ownerPrincipalId: v4.optional(v4.string()),
    authority: v4.optional(runtimeAuthorityReference),
    // Entity identification
    table: v4.string(),
    // "memories", "facts", "contexts", "conversations", etc.
    entityId: v4.string(),
    // Cortex entity ID
    // Operation type
    operation: v4.union(
      v4.literal("insert"),
      v4.literal("update"),
      v4.literal("delete")
    ),
    // Entity data (full object for sync)
    entity: v4.optional(v4.any()),
    // Null for deletes
    // Sync status
    synced: v4.boolean(),
    syncedAt: v4.optional(v4.number()),
    // Retry tracking
    failedAttempts: v4.optional(v4.number()),
    lastError: v4.optional(v4.string()),
    // Priority (for ordering)
    priority: v4.optional(v4.string()),
    // "high", "normal", "low"
    // Timestamps
    createdAt: v4.number()
  }).index("by_synced", ["synced"]).index("by_table", ["table"]).index("by_table_entity", ["table", "entityId"]).index("by_priority", ["priority", "synced"]).index("by_created", ["createdAt"]).index("by_runtime_worker_entity", ["tenantId", "memorySpaceId", "authority.grantId", "table", "entityId"]).index("by_runtime_worker_state", ["tenantId", "memorySpaceId", "authority.grantId", "synced", "priority"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Artifacts (Interactive Versioned Documents, memorySpace-scoped)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  artifacts: defineTable4({
    // Identity
    artifactId: v4.string(),
    memorySpaceId: v4.string(),
    participantId: v4.optional(v4.string()),
    // Multi-tenancy
    tenantId: v4.optional(v4.string()),
    // Fresh trusted ownership; caller user/participant labels never grant access.
    ownerPrincipalId: v4.optional(v4.string()),
    lastActorPrincipalId: v4.optional(v4.string()),
    tombstonedAt: v4.optional(v4.number()),
    // Ownership
    userId: v4.optional(v4.string()),
    agentId: v4.optional(v4.string()),
    // Kind
    kind: v4.union(
      v4.literal("text"),
      v4.literal("code"),
      v4.literal("sheet"),
      v4.literal("image"),
      v4.literal("diagram"),
      v4.literal("html"),
      v4.literal("custom")
    ),
    kindConfig: v4.optional(
      v4.object({
        customKind: v4.optional(v4.string()),
        mimeType: v4.optional(v4.string()),
        language: v4.optional(v4.string()),
        framework: v4.optional(v4.string()),
        schema: v4.optional(v4.any())
      })
    ),
    // Content (mutually exclusive)
    content: v4.optional(v4.string()),
    fileRef: v4.optional(
      v4.object({
        storageId: v4.id("_storage"),
        mimeType: v4.string(),
        size: v4.number(),
        checksum: v4.optional(v4.string()),
        originalFilename: v4.optional(v4.string())
      })
    ),
    // Streaming
    streamingState: v4.union(
      v4.literal("draft"),
      v4.literal("streaming"),
      v4.literal("paused"),
      v4.literal("final"),
      v4.literal("error")
    ),
    streamingMetadata: v4.optional(
      v4.object({
        sessionId: v4.optional(v4.string()),
        startedAt: v4.optional(v4.number()),
        lastChunkAt: v4.optional(v4.number()),
        bytesReceived: v4.optional(v4.number()),
        estimatedTotal: v4.optional(v4.number()),
        errorMessage: v4.optional(v4.string()),
        errorCode: v4.optional(v4.string()),
        errorAt: v4.optional(v4.number())
      })
    ),
    // Display
    title: v4.string(),
    description: v4.optional(v4.string()),
    tags: v4.array(v4.string()),
    // References
    conversationRef: v4.optional(
      v4.object({
        conversationId: v4.string(),
        messageId: v4.optional(v4.string()),
        turnIndex: v4.optional(v4.number())
      })
    ),
    memoryRefs: v4.optional(
      v4.array(
        v4.object({
          memoryId: v4.string(),
          relevance: v4.optional(v4.number())
        })
      )
    ),
    // Versioning (Undo/Redo)
    version: v4.number(),
    versionPointer: v4.number(),
    versionHistory: v4.array(
      v4.object({
        version: v4.number(),
        content: v4.optional(v4.string()),
        fileRef: v4.optional(
          v4.object({
            storageId: v4.id("_storage"),
            mimeType: v4.string(),
            size: v4.number(),
            checksum: v4.optional(v4.string()),
            originalFilename: v4.optional(v4.string())
          })
        ),
        title: v4.optional(v4.string()),
        timestamp: v4.number(),
        changedBy: v4.optional(v4.string()),
        changeType: v4.union(
          v4.literal("create"),
          v4.literal("update"),
          v4.literal("undo"),
          v4.literal("redo")
        ),
        changeSummary: v4.optional(v4.string())
      })
    ),
    // Collaboration
    collaborators: v4.optional(
      v4.array(
        v4.object({
          id: v4.string(),
          type: v4.union(v4.literal("user"), v4.literal("agent")),
          role: v4.union(
            v4.literal("owner"),
            v4.literal("editor"),
            v4.literal("viewer")
          ),
          addedAt: v4.number(),
          lastEditAt: v4.optional(v4.number())
        })
      )
    ),
    // Stats
    stats: v4.optional(
      v4.object({
        characterCount: v4.optional(v4.number()),
        wordCount: v4.optional(v4.number()),
        lineCount: v4.optional(v4.number()),
        tokenCount: v4.optional(v4.number())
      })
    ),
    // Metadata
    metadata: v4.optional(v4.any()),
    // Timestamps
    createdAt: v4.number(),
    updatedAt: v4.number(),
    lastAccessedAt: v4.optional(v4.number()),
    accessCount: v4.optional(v4.number()),
    // Soft Delete
    isDeleted: v4.optional(v4.boolean()),
    deletedAt: v4.optional(v4.number()),
    deletedBy: v4.optional(v4.string())
  }).index("by_runtime_key", ["tenantId", "memorySpaceId", "artifactId"]).index("by_artifactId", ["artifactId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_memorySpace_created", ["memorySpaceId", "createdAt"]).index("by_memorySpace_updated", ["memorySpaceId", "updatedAt"]).index("by_memorySpace_kind", ["memorySpaceId", "kind"]).index("by_memorySpace_state", ["memorySpaceId", "streamingState"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_tenant_artifactId", ["tenantId", "artifactId"]).index("by_tenant_space_kind", ["tenantId", "memorySpaceId", "kind"]).index("by_conversation", ["conversationRef.conversationId"]).index("by_memorySpace_conversation", [
    "memorySpaceId",
    "conversationRef.conversationId"
  ]).index("by_userId", ["userId"]).index("by_agentId", ["agentId"]).index("by_memorySpace_user", ["memorySpaceId", "userId"]).index("by_memorySpace_agent", ["memorySpaceId", "agentId"]).index("by_participantId", ["participantId"]).index("by_streamingState", ["streamingState"]).index("by_memorySpace_streaming", [
    "memorySpaceId",
    "streamingState",
    "updatedAt"
  ]).index("by_created", ["createdAt"]).index("by_updated", ["updatedAt"]).index("by_lastAccessed", ["lastAccessedAt"]).searchIndex("by_content", {
    searchField: "content",
    filterFields: [
      "memorySpaceId",
      "tenantId",
      "kind",
      "userId",
      "agentId",
      "participantId",
      "streamingState"
    ]
  }).searchIndex("by_title", {
    searchField: "title",
    filterFields: ["memorySpaceId", "tenantId", "kind"]
  }),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Attachments (Multi-modal File Storage, memorySpace-scoped)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  attachments: defineTable4({
    // Identity
    attachmentId: v4.string(),
    // Unique attachment ID
    memorySpaceId: v4.string(),
    // Memory space isolation
    // Multi-tenancy
    tenantId: v4.optional(v4.string()),
    // Tenant ID for SaaS isolation
    // Ownership
    userId: v4.string(),
    // User who uploaded this attachment
    conversationId: v4.optional(v4.string()),
    // Linked conversation
    messageId: v4.optional(v4.string()),
    // Linked message
    memoryId: v4.optional(v4.string()),
    // Linked memory
    artifactId: v4.optional(v4.string()),
    // Linked artifact
    // File storage (Convex native)
    storageId: v4.id("_storage"),
    // Convex file storage reference
    // File metadata
    type: v4.union(
      v4.literal("image"),
      v4.literal("audio"),
      v4.literal("video"),
      v4.literal("file"),
      v4.literal("pdf")
    ),
    mimeType: v4.string(),
    // MIME type (e.g., "image/png")
    filename: v4.string(),
    // Original filename
    size: v4.number(),
    // File size in bytes
    // Extracted content (for future search/RAG - Phase 2+)
    extractedText: v4.optional(v4.string()),
    // OCR/PDF text extraction
    transcript: v4.optional(v4.string()),
    // Audio/video transcription
    embedding: v4.optional(v4.array(v4.float64())),
    // Semantic search embedding
    // Type-specific metadata
    dimensions: v4.optional(
      v4.object({
        width: v4.number(),
        height: v4.number()
      })
    ),
    // Image/video dimensions
    duration: v4.optional(v4.number()),
    // Audio/video duration in seconds
    // Generic metadata
    metadata: v4.optional(v4.any()),
    // Timestamps
    createdAt: v4.number(),
    updatedAt: v4.number()
  }).index("by_attachmentId", ["attachmentId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_memorySpace_type", ["memorySpaceId", "type"]).index("by_memorySpace_created", ["memorySpaceId", "createdAt"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_tenant_attachmentId", ["tenantId", "attachmentId"]).index("by_conversation", ["conversationId"]).index("by_message", ["messageId"]).index("by_memory", ["memoryId"]).index("by_artifact", ["artifactId"]).index("by_userId", ["userId"]).index("by_memorySpace_user", ["memorySpaceId", "userId"]).index("by_created", ["createdAt"]).index("by_updated", ["updatedAt"]).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    // OpenAI text-embedding-3-small / ada-002
    filterFields: ["memorySpaceId", "tenantId", "type"]
  })
});

// <stdin>
var stdin_default = JSON.parse(schema_default.export());
export {
  stdin_default as default
};
