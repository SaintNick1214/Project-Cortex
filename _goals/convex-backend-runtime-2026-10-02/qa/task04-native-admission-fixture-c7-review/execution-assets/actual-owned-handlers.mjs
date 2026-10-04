var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeModelPolicy.ts
var runtimeModelPolicy_exports = {};
__export(runtimeModelPolicy_exports, {
  MODEL_LEDGER_STORAGE_LIMITS: () => MODEL_LEDGER_STORAGE_LIMITS,
  admit: () => admit,
  admitFallback: () => admitFallback,
  bindTrustedBudget: () => bindTrustedBudget,
  cancelBudget: () => cancelBudget,
  checkFallback: () => checkFallback,
  checkpoint: () => checkpoint,
  costMicroUnits: () => costMicroUnits,
  deriveQualifiedInputBound: () => deriveQualifiedInputBound,
  ensureBudget: () => ensureBudget,
  installDeploymentPolicy: () => installDeploymentPolicy,
  markVisible: () => markVisible,
  provisionTenantPolicy: () => provisionTenantPolicy,
  readTrustedAgentPolicyVersion: () => readTrustedAgentPolicyVersion,
  reconcileDeploymentLiability: () => reconcileDeploymentLiability,
  recover: () => recover,
  releaseNotDispatched: () => releaseNotDispatched,
  resolve: () => resolve,
  settle: () => settle
});
import { ConvexError as ConvexError4, v as v5 } from "convex/values";
import { z as z2 } from "zod";

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/_generated/server.js
import {
  actionGeneric,
  httpActionGeneric,
  queryGeneric,
  mutationGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric
} from "convex/server";
var internalQuery = internalQueryGeneric;
var internalMutation = internalMutationGeneric;
var env = process.env;

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeAuthSchema.ts
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

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeAuth.ts
import { ConvexError, v as v2 } from "convex/values";
function deny(code = "FORBIDDEN") {
  throw new ConvexError({
    version: 1,
    code,
    message: code === "UNAUTHENTICATED" ? "Verified identity required" : code === "INVALID_INPUT" ? "Invalid authority configuration" : "Access denied",
    retryable: false,
    outcome: "not_dispatched"
  });
}
function active(record) {
  return record !== null && Number.isSafeInteger(record.version) && record.version > 0 && record.revokedAt === void 0 && record.deletedAt === void 0;
}
function boundGrants(grants, principalId, membership, memorySpaceId, exactScope = false) {
  return grants.filter((grant) => grant.principalId === principalId && grant.membershipId === membership._id && grant.tenantId === membership.tenantId && (exactScope ? grant.memorySpaceId === memorySpaceId : memorySpaceId === void 0 || grant.memorySpaceId === void 0 || grant.memorySpaceId === memorySpaceId));
}
function assertSingleActiveGeneration(grants) {
  const groups = /* @__PURE__ */ new Set();
  for (const grant of grants) {
    if (grant.revokedAt !== void 0 || grant.deletedAt !== void 0) continue;
    const key = JSON.stringify([grant.principalId, grant.membershipId, grant.tenantId, grant.memorySpaceId]);
    if (groups.has(key)) deny();
    groups.add(key);
  }
}
function validateRequirement(requirement) {
  const resource = requirement.resource;
  if (resource && (!resource.tenantId || !resource.resourceId || requirement.tenantId !== void 0 && requirement.tenantId !== resource.tenantId || requirement.memorySpaceId !== void 0 && requirement.memorySpaceId !== resource.memorySpaceId)) deny();
  if (requirement.tenantId === "" || requirement.memorySpaceId === "") deny();
}
function assertResourceScope(authority, resource) {
  if (!resource.tenantId || resource.tenantId !== authority.tenantId || authority.memorySpaceId !== void 0 && resource.memorySpaceId !== authority.memorySpaceId) deny();
  if (authority.resourceAccess === "own" && resource.ownerPrincipalId !== authority.principalId) deny();
  if (authority.resourceAccess === "space" && (authority.memorySpaceId === void 0 || resource.memorySpaceId !== authority.memorySpaceId)) deny();
}
async function assertCurrentScope(reader, tenantId, memorySpaceId) {
  const tenant2 = await reader.getScope(tenantId);
  if (!tenant2 || tenant2.tenantId !== tenantId || tenant2.memorySpaceId !== void 0 || tenant2.deletedAt !== void 0 || !Number.isSafeInteger(tenant2.epoch) || tenant2.epoch < 1 || await reader.hasTombstone({ tenantId, resourceType: "tenant", resourceId: tenantId })) deny();
  if (memorySpaceId === void 0) return { tenantEpoch: tenant2.epoch };
  const space = await reader.getScope(tenantId, memorySpaceId);
  if (!space || space.tenantId !== tenantId || space.memorySpaceId !== memorySpaceId || space.deletedAt !== void 0 || !Number.isSafeInteger(space.epoch) || space.epoch < 1 || await reader.hasTombstone({ tenantId, memorySpaceId, resourceType: "memorySpace", resourceId: memorySpaceId })) deny();
  return { tenantEpoch: tenant2.epoch, memorySpaceEpoch: space.epoch };
}
async function materialize(reader, principal, membership, grant, requirement, now, pinned) {
  const tenantId = requirement.resource?.tenantId ?? requirement.tenantId ?? pinned?.tenantId ?? grant.tenantId;
  const memorySpaceId = requirement.resource?.memorySpaceId ?? requirement.memorySpaceId ?? pinned?.memorySpaceId ?? grant.memorySpaceId;
  if (!active(principal) || !active(membership) || !active(grant) || membership.principalId !== principal._id || grant.principalId !== principal._id || grant.membershipId !== membership._id || membership.tenantId !== grant.tenantId || tenantId !== grant.tenantId || !grant.capabilities.includes(requirement.capability) || requirement.actorKind !== void 0 && requirement.actorKind !== principal.actorKind || grant.expiresAt !== void 0 && (!Number.isFinite(grant.expiresAt) || now >= grant.expiresAt) || grant.memorySpaceId !== void 0 && grant.memorySpaceId !== memorySpaceId || grant.resourceAccess === "space" && grant.memorySpaceId === void 0 || grant.resourceAccess === "tenant" && grant.memorySpaceId !== void 0) deny();
  const epochs = await assertCurrentScope(reader, tenantId, memorySpaceId);
  if (epochs.tenantEpoch !== grant.tenantEpoch || grant.memorySpaceId !== void 0 && epochs.memorySpaceEpoch !== grant.memorySpaceEpoch) deny();
  const authority = {
    principalId: principal._id,
    principalVersion: principal.version,
    membershipId: membership._id,
    membershipVersion: membership.version,
    grantId: grant._id,
    grantVersion: grant.version,
    tenantId,
    ...epochs,
    ...memorySpaceId === void 0 ? {} : { memorySpaceId },
    actorKind: principal.actorKind,
    userId: principal.metadataUserId ?? principal._id,
    capabilities: [...grant.capabilities],
    resourceAccess: grant.resourceAccess
  };
  if (pinned && (pinned.principalId !== authority.principalId || pinned.principalVersion !== authority.principalVersion || pinned.membershipId !== authority.membershipId || pinned.membershipVersion !== authority.membershipVersion || pinned.grantId !== authority.grantId || pinned.grantVersion !== authority.grantVersion || pinned.tenantId !== authority.tenantId || pinned.tenantEpoch !== authority.tenantEpoch || pinned.memorySpaceId !== authority.memorySpaceId || pinned.memorySpaceEpoch !== authority.memorySpaceEpoch)) deny();
  if (requirement.resource) {
    assertResourceScope(authority, requirement.resource);
    const key = {
      tenantId,
      memorySpaceId: requirement.resource.memorySpaceId,
      resourceType: requirement.resource.resourceType,
      resourceId: requirement.resource.resourceId
    };
    if (await reader.hasTombstone(key) || key.memorySpaceId !== void 0 && await reader.hasTombstone({ ...key, memorySpaceId: void 0 })) deny();
  }
  return authority;
}
async function resolveAuthority(reader, identity, requirement, now = Date.now()) {
  if (!identity?.issuer || !identity.subject) deny("UNAUTHENTICATED");
  validateRequirement(requirement);
  const principal = await reader.findPrincipal(identity.issuer, identity.subject);
  if (!principal || !active(principal) || principal.issuer !== identity.issuer || principal.subject !== identity.subject) deny();
  const candidates = [];
  const tenantId = requirement.resource?.tenantId ?? requirement.tenantId;
  const memorySpaceId = requirement.resource?.memorySpaceId ?? requirement.memorySpaceId;
  for (const membership of await reader.listMemberships(principal._id)) {
    if (!active(membership) || membership.principalId !== principal._id || tenantId !== void 0 && membership.tenantId !== tenantId) continue;
    const grants = boundGrants(await reader.listGrants(membership._id), principal._id, membership, memorySpaceId);
    assertSingleActiveGeneration(grants);
    for (const grant of grants) {
      if (!active(grant) || !grant.capabilities.includes(requirement.capability)) continue;
      try {
        candidates.push(await materialize(reader, principal, membership, grant, requirement, now));
      } catch (error) {
        if (!(error instanceof ConvexError) || error.data.code !== "FORBIDDEN") throw error;
      }
    }
  }
  const scopes = new Set(candidates.map((candidate) => JSON.stringify([candidate.tenantId, candidate.memorySpaceId])));
  if (scopes.size !== 1) deny();
  if (candidates.length !== 1) deny();
  return candidates[0];
}
async function resolveAuthorityReference(reader, reference, requirement, now = Date.now()) {
  validateRequirement(requirement);
  const principal = await reader.getPrincipal(reference.principalId);
  const membership = await reader.getMembership(reference.membershipId);
  const grant = await reader.getGrant(reference.grantId);
  if (!principal || !membership || !grant) deny();
  const grants = boundGrants(await reader.listGrants(membership._id), principal._id, membership, grant.memorySpaceId, true);
  assertSingleActiveGeneration(grants);
  if (!grants.some((candidate) => candidate._id === grant._id)) deny();
  return await materialize(reader, principal, membership, grant, requirement, now, reference);
}
async function boundedSingle(query) {
  const rows2 = await query.take(2);
  if (rows2.length > 1) throw new ConvexError({
    version: 1,
    code: "AUTHORITY_LOOKUP_AMBIGUOUS",
    message: "Authority lookup is ambiguous",
    retryable: false,
    outcome: "not_dispatched"
  });
  return rows2[0] ?? null;
}
function createAuthorityReader(ctx) {
  return {
    findPrincipal: async (issuer, subject) => await boundedSingle(ctx.db.query("runtimeAuthPrincipals").withIndex("by_issuer_subject", (q) => q.eq("issuer", issuer).eq("subject", subject))),
    getPrincipal: async (id) => {
      const normalized = ctx.db.normalizeId("runtimeAuthPrincipals", id);
      return normalized ? await ctx.db.get("runtimeAuthPrincipals", normalized) : null;
    },
    listMemberships: async (id) => {
      const normalized = ctx.db.normalizeId("runtimeAuthPrincipals", id);
      return normalized ? await ctx.db.query("runtimeAuthMemberships").withIndex("by_principal_tenant", (q) => q.eq("principalId", normalized)).collect() : [];
    },
    getMembership: async (id) => {
      const normalized = ctx.db.normalizeId("runtimeAuthMemberships", id);
      return normalized ? await ctx.db.get("runtimeAuthMemberships", normalized) : null;
    },
    listGrants: async (id) => {
      const normalized = ctx.db.normalizeId("runtimeAuthMemberships", id);
      return normalized ? await ctx.db.query("runtimeAuthGrants").withIndex("by_membership", (q) => q.eq("membershipId", normalized)).collect() : [];
    },
    getGrant: async (id) => {
      const normalized = ctx.db.normalizeId("runtimeAuthGrants", id);
      return normalized ? await ctx.db.get("runtimeAuthGrants", normalized) : null;
    },
    getScope: async (tenantId, memorySpaceId) => await boundedSingle(ctx.db.query("runtimeAuthScopes").withIndex("by_tenant_space", (q) => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId))),
    hasTombstone: async (key) => await boundedSingle(ctx.db.query("runtimeAuthTombstones").withIndex("by_resource", (q) => q.eq("tenantId", key.tenantId).eq("memorySpaceId", key.memorySpaceId).eq("resourceType", key.resourceType).eq("resourceId", key.resourceId))) !== null
  };
}
async function requireAuthority(ctx, requirement) {
  return await resolveAuthority(createAuthorityReader(ctx), await ctx.auth.getUserIdentity(), requirement);
}
async function recheckAuthority(ctx, reference, requirement) {
  return await resolveAuthorityReference(createAuthorityReader(ctx), reference, requirement);
}
var authorize = internalQuery({
  args: { requirement: runtimeAuthorityRequirement },
  handler: async (ctx, args) => await requireAuthority(ctx, args.requirement)
});
var recheck = internalQuery({
  args: { reference: runtimeAuthorityReference, requirement: runtimeAuthorityRequirement },
  handler: async (ctx, args) => await recheckAuthority(ctx, args.reference, args.requirement)
});
function nonempty(value) {
  if (!value.trim()) deny("INVALID_INPUT");
}
async function ensureScope(ctx, tenantId, memorySpaceId) {
  const existing = await ctx.db.query("runtimeAuthScopes").withIndex("by_tenant_space", (q) => q.eq("tenantId", tenantId).eq("memorySpaceId", memorySpaceId)).unique();
  if (existing) {
    if (existing.deletedAt !== void 0) deny();
    return existing;
  }
  if (await createAuthorityReader(ctx).hasTombstone({
    tenantId,
    memorySpaceId,
    resourceType: memorySpaceId === void 0 ? "tenant" : "memorySpace",
    resourceId: memorySpaceId ?? tenantId
  })) deny();
  const scope = { tenantId, ...memorySpaceId === void 0 ? {} : { memorySpaceId }, epoch: 1, createdAt: Date.now() };
  await ctx.db.insert("runtimeAuthScopes", scope);
  return scope;
}
var provision = internalMutation({
  args: {
    issuer: v2.string(),
    subject: v2.string(),
    actorKind: runtimeActorKind,
    metadataUserId: v2.optional(v2.string()),
    tenantId: v2.string(),
    memorySpaceId: v2.optional(v2.string()),
    capabilities: v2.array(runtimeCapability),
    resourceAccess: runtimeResourceAccess,
    expiresAt: v2.optional(v2.number())
  },
  handler: async (ctx, args) => {
    [args.issuer, args.subject, args.tenantId].forEach(nonempty);
    if (args.memorySpaceId !== void 0) nonempty(args.memorySpaceId);
    if (args.metadataUserId !== void 0) nonempty(args.metadataUserId);
    if (args.capabilities.length === 0 || args.resourceAccess === "space" && args.memorySpaceId === void 0 || args.resourceAccess === "tenant" && args.memorySpaceId !== void 0 || args.expiresAt !== void 0 && (!Number.isFinite(args.expiresAt) || args.expiresAt <= Date.now())) deny("INVALID_INPUT");
    const now = Date.now();
    const reader = createAuthorityReader(ctx);
    const tenant2 = await ensureScope(ctx, args.tenantId);
    const space = args.memorySpaceId === void 0 ? void 0 : await ensureScope(ctx, args.tenantId, args.memorySpaceId);
    let principal = await ctx.db.query("runtimeAuthPrincipals").withIndex("by_issuer_subject", (q) => q.eq("issuer", args.issuer).eq("subject", args.subject)).unique();
    if (principal && (!active(principal) || principal.actorKind !== args.actorKind || principal.metadataUserId !== args.metadataUserId)) deny();
    if (!principal) {
      const id2 = await ctx.db.insert("runtimeAuthPrincipals", {
        issuer: args.issuer,
        subject: args.subject,
        actorKind: args.actorKind,
        ...args.metadataUserId === void 0 ? {} : { metadataUserId: args.metadataUserId },
        version: 1,
        createdAt: now
      });
      principal = await ctx.db.get("runtimeAuthPrincipals", id2);
    }
    if (!principal) deny();
    let membership = await ctx.db.query("runtimeAuthMemberships").withIndex("by_principal_tenant", (q) => q.eq("principalId", principal._id).eq("tenantId", args.tenantId)).unique();
    if (membership && !active(membership)) deny();
    if (!membership) {
      const id2 = await ctx.db.insert("runtimeAuthMemberships", {
        principalId: principal._id,
        tenantId: args.tenantId,
        version: 1,
        createdAt: now
      });
      membership = await ctx.db.get("runtimeAuthMemberships", id2);
    }
    if (!membership) deny();
    const previous = (await reader.listGrants(membership._id)).filter((grant2) => grant2.memorySpaceId === args.memorySpaceId);
    const capabilities = [...new Set(args.capabilities)].sort();
    const current = previous.filter((grant2) => active(grant2));
    if (current.length > 1) deny();
    if (current[0] && JSON.stringify([...current[0].capabilities].sort()) === JSON.stringify(capabilities) && current[0].resourceAccess === args.resourceAccess && current[0].expiresAt === args.expiresAt && current[0].tenantEpoch === tenant2.epoch && current[0].memorySpaceEpoch === space?.epoch) {
      return await materialize(reader, principal, membership, current[0], { capability: capabilities[0] }, now);
    }
    for (const old of current) {
      const id2 = ctx.db.normalizeId("runtimeAuthGrants", old._id);
      if (!id2) deny();
      await ctx.db.patch("runtimeAuthGrants", id2, { revokedAt: now });
    }
    const id = await ctx.db.insert("runtimeAuthGrants", {
      principalId: principal._id,
      membershipId: membership._id,
      tenantId: args.tenantId,
      ...args.memorySpaceId === void 0 ? {} : { memorySpaceId: args.memorySpaceId, memorySpaceEpoch: space.epoch },
      tenantEpoch: tenant2.epoch,
      capabilities,
      resourceAccess: args.resourceAccess,
      version: Math.max(0, ...previous.map((grant2) => grant2.version)) + 1,
      createdAt: now,
      ...args.expiresAt === void 0 ? {} : { expiresAt: args.expiresAt }
    });
    const grant = await ctx.db.get("runtimeAuthGrants", id);
    if (!grant) deny();
    return await materialize(reader, principal, membership, grant, { capability: capabilities[0] }, now);
  }
});
var revokeGrant = internalMutation({
  args: { grantId: v2.id("runtimeAuthGrants") },
  handler: async (ctx, args) => {
    const grant = await ctx.db.get("runtimeAuthGrants", args.grantId);
    if (grant && grant.revokedAt === void 0) await ctx.db.patch("runtimeAuthGrants", grant._id, { revokedAt: Date.now() });
  }
});
var revokeMembership = internalMutation({
  args: { membershipId: v2.id("runtimeAuthMemberships") },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get("runtimeAuthMemberships", args.membershipId);
    if (membership && membership.revokedAt === void 0) await ctx.db.patch(
      "runtimeAuthMemberships",
      membership._id,
      { revokedAt: Date.now(), version: membership.version + 1 }
    );
  }
});
var deletePrincipal = internalMutation({
  args: { principalId: v2.id("runtimeAuthPrincipals") },
  handler: async (ctx, args) => {
    const principal = await ctx.db.get("runtimeAuthPrincipals", args.principalId);
    if (principal && principal.deletedAt === void 0) await ctx.db.patch(
      "runtimeAuthPrincipals",
      principal._id,
      { deletedAt: Date.now(), version: principal.version + 1 }
    );
  }
});
var deleteScope = internalMutation({
  args: { tenantId: v2.string(), memorySpaceId: v2.optional(v2.string()) },
  handler: async (ctx, args) => {
    const scope = await ctx.db.query("runtimeAuthScopes").withIndex("by_tenant_space", (q) => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId)).unique();
    if (scope && scope.deletedAt === void 0) await ctx.db.patch(
      "runtimeAuthScopes",
      scope._id,
      { deletedAt: Date.now(), epoch: scope.epoch + 1 }
    );
    const key = {
      ...args,
      resourceType: args.memorySpaceId === void 0 ? "tenant" : "memorySpace",
      resourceId: args.memorySpaceId ?? args.tenantId
    };
    if (!await createAuthorityReader(ctx).hasTombstone(key)) await ctx.db.insert("runtimeAuthTombstones", { ...key, deletedAt: Date.now() });
  }
});
var tombstoneResource = internalMutation({
  args: { tenantId: v2.string(), memorySpaceId: v2.optional(v2.string()), resourceType: runtimeResourceType, resourceId: v2.string() },
  handler: async (ctx, args) => {
    nonempty(args.tenantId);
    nonempty(args.resourceId);
    if (!await createAuthorityReader(ctx).hasTombstone(args)) await ctx.db.insert("runtimeAuthTombstones", { ...args, deletedAt: Date.now() });
  }
});

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeMemoryRepository.ts
import { ConvexError as ConvexError2 } from "convex/values";
import { makeFunctionReference } from "convex/server";

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/src/domain/profile.ts
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
function normalizeSourceText(text2) {
  const normalized = text2.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new Error("INVALID_INPUT: normalized text is empty");
  return normalized;
}
function assertProfileMatches(actual, expected = DEFAULT_EMBEDDING_PROFILE) {
  const fields = ["profileId", "modelId", "dimensions", "normalization", "chunking", "indexName"];
  if (fields.some((field) => actual[field] !== expected[field])) {
    throw new Error("PROFILE_NOT_READY: embedding profile does not match the pinned profile");
  }
}
function assertEmbeddingVector(vector, profile = DEFAULT_EMBEDDING_PROFILE) {
  if (!Number.isSafeInteger(profile.dimensions) || profile.dimensions <= 0 || !Array.isArray(vector) || vector.length !== profile.dimensions || Array.from(vector).some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error(`INVALID_INPUT: expected ${profile.dimensions} finite embedding coordinates`);
  }
}
async function semanticHash(value) {
  const digest3 = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest3), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function chunkNormalizedText(text2) {
  if (!text2 || normalizeSourceText(text2) !== text2) {
    throw new Error("INVALID_INPUT: chunking requires normalized source text");
  }
  const points = Array.from(text2);
  const windows = [];
  for (let start = 0; start < points.length; start += 1400) {
    const end = Math.min(start + 1600, points.length);
    windows.push({ ordinal: windows.length, start, end, text: points.slice(start, end).join("") });
    if (end === points.length) break;
  }
  return windows;
}

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/src/domain/sources.ts
function nonempty2(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function validTimestamp(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 864e13;
}
function assertTrustedScope(scope) {
  const identifiers = ["tenantId", "memorySpaceId", "principalId", "membershipId", "grantId"];
  const versions = ["tenantEpoch", "memorySpaceEpoch", "principalVersion", "membershipVersion", "grantVersion"];
  if (!isRecord(scope) || identifiers.some((field) => !nonempty2(scope[field])) || versions.some((field) => !Number.isSafeInteger(scope[field]) || scope[field] < 1)) {
    throw new Error("INVALID_INPUT: a trusted tenant, memory space, principal, membership and grant with positive versions are required");
  }
}
function assertSourceReference(source) {
  if (!isRecord(source) || !nonempty2(source.sourceId) || !nonempty2(source.sourceEventId) || !Number.isSafeInteger(source.sourceRevision) || source.sourceRevision < 1) {
    throw new Error("INVALID_INPUT: source requires stable IDs and a positive revision");
  }
}
function assertSourceContent(source) {
  if (!isRecord(source)) throw new Error("INVALID_INPUT: source content record is required");
  assertSourceLineage(source.lineage);
  if (![source.tenantId, source.memorySpaceId, source.ownerPrincipalId].every(nonempty2) || typeof source.content !== "string" || normalizeSourceText(source.content) !== source.content || typeof source.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(source.contentHash) || !validTimestamp(source.createdAt) || source.tombstonedAt !== void 0 && !validTimestamp(source.tombstonedAt)) {
    throw new Error("INVALID_INPUT: source requires normalized content, scope/owner, SHA-256 hash and valid timestamps");
  }
}
function assertSourceLineage(source) {
  if (!isRecord(source) || !nonempty2(source.sourceId) || !nonempty2(source.sourceEventId) || typeof source.sourceRevision !== "number" || !Number.isSafeInteger(source.sourceRevision) || source.sourceRevision < 1) {
    throw new Error("INVALID_INPUT: source requires stable IDs and a positive revision");
  }
  const eligible = source.role === "user" && source.trust === "user_assertion" || source.role === "assistant" && source.trust === "assistant_claim" || source.role === "tool" && source.trust === "verified_tool_evidence" && nonempty2(source.operationId);
  if (!eligible) throw new Error("INVALID_INPUT: invalid source role/trust attribution");
}
function sameReference(a, b) {
  return a.sourceId === b.sourceId && a.sourceEventId === b.sourceEventId && a.sourceRevision === b.sourceRevision;
}
async function prepareSourceContent(scope, lineage, text2, clock, profile = DEFAULT_EMBEDDING_PROFILE) {
  assertSourceLineage(lineage);
  assertProfileMatches(profile);
  assertTrustedScope(scope);
  const content = normalizeSourceText(text2);
  const createdAt = clock.now();
  if (!validTimestamp(createdAt)) throw new Error("INVALID_INPUT: clock must return a finite valid timestamp");
  const source = {
    tenantId: scope.tenantId,
    memorySpaceId: scope.memorySpaceId,
    ownerPrincipalId: scope.principalId,
    lineage: { ...lineage },
    content,
    contentHash: await semanticHash(content),
    createdAt
  };
  const chunks = await Promise.all(chunkNormalizedText(content).map(async (window) => ({
    ...window,
    sourceId: lineage.sourceId,
    sourceEventId: lineage.sourceEventId,
    sourceRevision: lineage.sourceRevision,
    tenantId: scope.tenantId,
    memorySpaceId: scope.memorySpaceId,
    profileId: profile.profileId,
    chunkId: await semanticHash(JSON.stringify([
      scope.tenantId,
      scope.memorySpaceId,
      lineage.sourceId,
      lineage.sourceEventId,
      lineage.sourceRevision,
      profile.profileId,
      window.ordinal,
      window.text
    ])),
    textHash: await semanticHash(window.text)
  })));
  return { source, chunks };
}
async function processingIdentityKey(identity) {
  if (!nonempty2(identity.sourceId) || !nonempty2(identity.sourceEventId) || !Number.isSafeInteger(identity.sourceRevision) || identity.sourceRevision < 1 || !["extract", "facts", "vectors"].includes(identity.stage) || !nonempty2(identity.semanticPolicyVersion)) {
    throw new Error("INVALID_INPUT: invalid processing identity");
  }
  return semanticHash(JSON.stringify([
    identity.sourceEventId,
    identity.sourceRevision,
    identity.stage,
    identity.semanticPolicyVersion
  ]));
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCurrentAuthorizedVector(vector, source, chunk, scope, profile = DEFAULT_EMBEDDING_PROFILE) {
  assertTrustedScope(scope);
  assertSourceContent(source);
  assertSourceReference(vector);
  assertSourceReference(chunk);
  if (![
    vector.vectorId,
    vector.chunkId,
    vector.tenantId,
    vector.memorySpaceId,
    vector.processingReceiptId,
    chunk.chunkId,
    chunk.tenantId,
    chunk.memorySpaceId,
    chunk.profileId
  ].every(nonempty2)) {
    throw new Error("INVALID_INPUT: vector and chunk require stable IDs, scope and processing provenance");
  }
  assertProfileMatches(vector.profile, profile);
  assertEmbeddingVector(vector.embedding, profile);
  return source.tombstonedAt === void 0 && [source, vector, chunk].every((record) => record.tenantId === scope.tenantId && record.memorySpaceId === scope.memorySpaceId) && sameReference(vector, source.lineage) && sameReference(chunk, source.lineage) && vector.chunkId === chunk.chunkId && chunk.profileId === profile.profileId;
}

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeMemoryRepository.ts
function internalQueryRef(name) {
  return makeFunctionReference(name);
}
function internalMutationRef(name) {
  return makeFunctionReference(name);
}
var memoryReferences = {
  recheck: internalQueryRef("runtimeMemory:checkAuthority"),
  getSource: internalQueryRef("runtimeMemory:readSource"),
  putSource: internalMutationRef("runtimeMemory:writeSource"),
  commitDerived: internalMutationRef("runtimeMemory:writeDerived"),
  listFacts: internalQueryRef("runtimeMemory:readFacts"),
  hydrateVectors: internalQueryRef("runtimeMemory:readVectorMatches")
};
function memoryError(code, message) {
  throw new ConvexError2({ version: 1, code, message, retryable: false, outcome: "not_dispatched" });
}
function memoryScope(reference) {
  if (!reference.memorySpaceId || !Number.isSafeInteger(reference.memorySpaceEpoch) || reference.memorySpaceEpoch < 1) {
    memoryError("FORBIDDEN", "A concrete authorized memory space is required");
  }
  return { ...reference, memorySpaceId: reference.memorySpaceId, memorySpaceEpoch: reference.memorySpaceEpoch };
}
function boundedLimit(limit) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) memoryError("INVALID_INPUT", "Limit must be between 1 and 100");
}
function sameReference2(a, b) {
  return a.sourceId === b.sourceId && a.sourceEventId === b.sourceEventId && a.sourceRevision === b.sourceRevision;
}
function canonicalMemoryValue(value) {
  if (value === void 0) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalMemoryValue).join(",")}]`;
  const record = value;
  return `{${Object.keys(record).filter((key) => record[key] !== void 0).sort().map((key) => `${JSON.stringify(key)}:${canonicalMemoryValue(record[key])}`).join(",")}}`;
}
function stripSystem(row) {
  const { _id, _creationTime, ...value } = row;
  return value;
}
function sourceResource(source) {
  return {
    resourceType: "source",
    resourceId: source.lineage.sourceId,
    tenantId: source.tenantId,
    memorySpaceId: source.memorySpaceId,
    ownerPrincipalId: source.ownerPrincipalId
  };
}
function conflict(message) {
  return memoryError("IDEMPOTENCY_CONFLICT", message);
}
function vectorScopeKey(tenantId, memorySpaceId, profileId) {
  return JSON.stringify([tenantId, memorySpaceId, profileId]);
}
function vectorOwnerScopeKey(tenantId, memorySpaceId, profileId, principalId) {
  return JSON.stringify([tenantId, memorySpaceId, profileId, principalId]);
}
var ConvexMemoryRepository = class {
  constructor(ctx, reference, capability3, writer, clock = { now: () => Date.now() }) {
    this.ctx = ctx;
    this.reference = reference;
    this.capability = capability3;
    this.writer = writer;
    this.clock = clock;
    this.scope = memoryScope(reference);
  }
  scope;
  async authority(resource, capability3 = this.capability) {
    return await recheckAuthority(this.ctx, this.reference, {
      capability: capability3,
      tenantId: this.scope.tenantId,
      memorySpaceId: this.scope.memorySpaceId,
      ...resource ? { resource } : {}
    });
  }
  async recheckAuthority() {
    await this.authority();
  }
  writeDb() {
    if (!this.writer || this.capability !== "write") memoryError("FORBIDDEN", "A write-authorized mutation is required");
    return this.writer;
  }
  async getSource(sourceId) {
    await this.authority();
    const row = await this.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceId", sourceId)).unique();
    if (!row) return null;
    const source = stripSystem(row);
    await this.authority(sourceResource(source));
    if (source.tombstonedAt !== void 0) memoryError("FORBIDDEN", "Source was deleted");
    return source;
  }
  async putSource(source) {
    const db = this.writeDb();
    await this.authority(sourceResource(source));
    assertSourceLineage(source.lineage);
    if (source.ownerPrincipalId !== this.scope.principalId || source.tombstonedAt !== void 0 || normalizeSourceText(source.content) !== source.content || await semanticHash(source.content) !== source.contentHash || !Number.isFinite(source.createdAt) || source.createdAt < 0 || source.createdAt > 864e13) {
      memoryError("INVALID_INPUT", "Source must have canonical content, hash, attribution and owner");
    }
    const existing = await this.getSource(source.lineage.sourceId);
    if (existing) {
      if (canonicalMemoryValue({ ...source, createdAt: existing.createdAt }) !== canonicalMemoryValue(existing)) conflict("Source identity was reused with different content or attribution");
      return { source: existing, created: false };
    }
    const event = await db.query("runtimeMemorySources").withIndex("by_scope_event", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceEventId", source.lineage.sourceEventId)).unique();
    if (event) conflict("Source event already belongs to another canonical source");
    await db.insert("runtimeMemorySources", source);
    return { source, created: true };
  }
  async commitDerived(input) {
    const db = this.writeDb();
    const source = await this.getSource(input.source.sourceId);
    if (!source || !sameReference2(source.lineage, input.source) || !sameReference2(source.lineage, input.identity)) {
      memoryError("STALE_SOURCE", "Source event/revision is no longer current");
    }
    const receiptId = await processingIdentityKey(input.identity);
    const canonicalIdentity = canonicalMemoryValue(input.identity);
    const canonicalPayload = canonicalMemoryValue(input);
    const receipt = await db.query("runtimeMemoryReceipts").withIndex("by_scope_receipt", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("receiptId", receiptId)).unique();
    if (receipt) {
      if (receipt.canonicalIdentity !== canonicalIdentity || receipt.canonicalPayload !== canonicalPayload) conflict("Processing receipt identity/hash was reused with a different canonical payload");
      return { receiptId, created: false };
    }
    const prepared = await prepareSourceContent(this.scope, source.lineage, source.content, { now: () => source.createdAt });
    const expectedChunks = new Map(prepared.chunks.map((chunk) => [chunk.chunkId, chunk]));
    const chunks = /* @__PURE__ */ new Map();
    for (const chunk of input.chunks ?? []) {
      if (chunks.has(chunk.chunkId) || canonicalMemoryValue(chunk) !== canonicalMemoryValue(expectedChunks.get(chunk.chunkId))) memoryError("INVALID_INPUT", "Chunk does not match canonical source/profile/window");
      chunks.set(chunk.chunkId, chunk);
    }
    const vectorIds = /* @__PURE__ */ new Set();
    for (const vector of input.vectors ?? []) {
      assertProfileMatches(vector.profile);
      assertEmbeddingVector(vector.embedding);
      const chunk = chunks.get(vector.chunkId) ?? await this.findChunk(vector.chunkId);
      if (vectorIds.has(vector.vectorId) || vector.processingReceiptId !== receiptId || !chunk || !isCurrentAuthorizedVector(vector, source, chunk, this.scope)) memoryError("INVALID_INPUT", "Vector has invalid provenance or duplicate identity");
      vectorIds.add(vector.vectorId);
    }
    const factIds = /* @__PURE__ */ new Set();
    const factRows = /* @__PURE__ */ new Map();
    for (const [factId, expected] of Object.entries(input.expectedFactVersions ?? {})) {
      if (!Number.isSafeInteger(expected) || expected < 0) memoryError("INVALID_INPUT", "Expected fact versions must be nonnegative integers");
      const existing = await db.query("facts").withIndex("by_runtime_scope_factId", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("factId", factId)).unique();
      if (expected !== (existing?.version ?? 0)) memoryError("FACT_VERSION_CONFLICT", "A resolution candidate changed before commit");
      if (existing) {
        await this.authority({
          resourceType: "fact",
          resourceId: existing.factId,
          tenantId: existing.tenantId,
          memorySpaceId: existing.memorySpaceId,
          ownerPrincipalId: existing.ownerPrincipalId
        });
        if (existing.tombstonedAt !== void 0) memoryError("FORBIDDEN", "Resolution candidate was deleted");
      }
    }
    for (const fact of input.facts ?? []) {
      if (factIds.has(fact.factId) || fact.ownerPrincipalId !== source.ownerPrincipalId || fact.tenantId !== source.tenantId || fact.memorySpaceId !== source.memorySpaceId || canonicalMemoryValue(fact.lineage) !== canonicalMemoryValue(source.lineage) || source.lineage.role === "assistant" || !fact.extractionPolicyVersion.trim() || !Number.isFinite(fact.confidence) || fact.confidence < 0 || fact.confidence > 100 || !fact.fact.trim() || !Number.isSafeInteger(fact.version) || fact.version < 1) memoryError("INVALID_INPUT", "Invalid attributed fact");
      factIds.add(fact.factId);
      await this.authority({
        resourceType: "fact",
        resourceId: fact.factId,
        tenantId: fact.tenantId,
        memorySpaceId: fact.memorySpaceId,
        ownerPrincipalId: fact.ownerPrincipalId
      });
      const existing = await db.query("facts").withIndex("by_runtime_scope_factId", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("factId", fact.factId)).unique();
      if (existing) {
        if (!existing.ownerPrincipalId || existing.tombstonedAt !== void 0) memoryError("FORBIDDEN", "Fact has no current runtime owner");
        await this.authority({
          resourceType: "fact",
          resourceId: existing.factId,
          tenantId: existing.tenantId,
          memorySpaceId: existing.memorySpaceId,
          ownerPrincipalId: existing.ownerPrincipalId
        });
      }
      const expected = input.expectedFactVersions?.[fact.factId];
      if (expected === void 0 || !Number.isSafeInteger(expected) || expected < 0 || expected !== (existing?.version ?? 0) || fact.version !== expected + 1) memoryError("FACT_VERSION_CONFLICT", "Fact commit must compare the current version");
      factRows.set(fact.factId, existing);
    }
    for (const chunk of chunks.values()) {
      const existing = await this.findChunk(chunk.chunkId);
      if (existing && canonicalMemoryValue(existing) !== canonicalMemoryValue(chunk)) conflict("Chunk identity collision");
    }
    for (const vector of input.vectors ?? []) {
      const existing = await db.query("runtimeMemoryVectors").withIndex("by_scope_vector", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("vectorId", vector.vectorId)).unique();
      if (existing && canonicalMemoryValue(stripVector(existing)) !== canonicalMemoryValue(vector)) conflict("Vector identity collision");
    }
    await this.authority(sourceResource(source));
    await db.insert("runtimeMemoryReceipts", {
      tenantId: this.scope.tenantId,
      memorySpaceId: this.scope.memorySpaceId,
      receiptId,
      identity: input.identity,
      canonicalIdentity,
      canonicalPayload,
      createdAt: source.createdAt
    });
    for (const chunk of chunks.values()) if (!await this.findChunk(chunk.chunkId)) await db.insert("runtimeMemoryChunks", chunk);
    for (const vector of input.vectors ?? []) {
      const existing = await db.query("runtimeMemoryVectors").withIndex("by_scope_vector", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("vectorId", vector.vectorId)).unique();
      if (!existing) await db.insert("runtimeMemoryVectors", {
        ...vector,
        embedding: [...vector.embedding],
        profileId: vector.profile.profileId,
        scopeProfileKey: vectorScopeKey(vector.tenantId, vector.memorySpaceId, vector.profile.profileId),
        ownerPrincipalId: source.ownerPrincipalId,
        scopeProfileOwnerKey: vectorOwnerScopeKey(vector.tenantId, vector.memorySpaceId, vector.profile.profileId, source.ownerPrincipalId)
      });
    }
    for (const fact of input.facts ?? []) {
      const { _id, ...fields } = fact;
      const existing = factRows.get(fact.factId);
      const record = { ...fields, processingReceiptId: receiptId };
      if (existing) await db.replace("facts", existing._id, record);
      else await db.insert("facts", record);
    }
    return { receiptId, created: true };
  }
  async findChunk(chunkId) {
    const row = await this.ctx.db.query("runtimeMemoryChunks").withIndex("by_scope_chunk", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("chunkId", chunkId)).unique();
    return row ? stripSystem(row) : null;
  }
  /** Derived rows whose source was deleted/changed are excluded; grant denial still throws. */
  async visibleSource(sourceId, authority) {
    const row = await this.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceId", sourceId)).unique();
    if (!row || row.tombstonedAt !== void 0 || authority.resourceAccess === "own" && row.ownerPrincipalId !== authority.principalId) return null;
    const reader = createAuthorityReader(this.ctx);
    if (await reader.hasTombstone({ tenantId: this.scope.tenantId, memorySpaceId: this.scope.memorySpaceId, resourceType: "source", resourceId: sourceId }) || await reader.hasTombstone({ tenantId: this.scope.tenantId, resourceType: "source", resourceId: sourceId })) return null;
    const source = stripSystem(row);
    await this.authority(sourceResource(source), "read");
    return source;
  }
  async listFacts(query) {
    boundedLimit(query.limit);
    const authority = await this.authority(void 0, "read");
    const rows2 = await this.ctx.db.query("facts").withIndex("by_tenant_space", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId)).filter((q) => q.and(
      ...authority.resourceAccess === "own" ? [q.eq(q.field("ownerPrincipalId"), authority.principalId)] : [],
      ...query.subject !== void 0 ? [q.eq(q.field("subject"), query.subject)] : [],
      ...query.factType !== void 0 ? [q.eq(q.field("factType"), query.factType)] : []
    )).take(1025);
    if (rows2.length > 1024) memoryError("QUERY_TOO_BROAD", "Fact scope exceeds bounded scan; narrower indexed selection is required");
    const facts = [];
    const reader = createAuthorityReader(this.ctx);
    for (const row of rows2) {
      if (!row.ownerPrincipalId || !row.lineage || !row.extractionPolicyVersion || row.tombstonedAt !== void 0 || row.supersededBy || row.validUntil !== void 0 && row.validUntil <= this.clock.now() || query.subject !== void 0 && row.subject !== query.subject || query.factType !== void 0 && row.factType !== query.factType || authority.resourceAccess === "own" && row.ownerPrincipalId !== authority.principalId) continue;
      assertResourceScope(authority, {
        resourceType: "fact",
        resourceId: row.factId,
        tenantId: row.tenantId,
        memorySpaceId: row.memorySpaceId,
        ownerPrincipalId: row.ownerPrincipalId
      });
      if (await reader.hasTombstone({ tenantId: this.scope.tenantId, memorySpaceId: this.scope.memorySpaceId, resourceType: "fact", resourceId: row.factId }) || await reader.hasTombstone({ tenantId: this.scope.tenantId, resourceType: "fact", resourceId: row.factId })) continue;
      const source = await this.visibleSource(row.lineage.sourceId, authority);
      if (!source || !sameReference2(source.lineage, row.lineage) || source.ownerPrincipalId !== row.ownerPrincipalId || row.lineage.role === "assistant" || canonicalMemoryValue(row.lineage) !== canonicalMemoryValue(source.lineage)) continue;
      const {
        _creationTime,
        tombstonedAt: _tombstonedAt,
        processingReceiptId: _receipt,
        lineage,
        ownerPrincipalId,
        extractionPolicyVersion,
        ...record
      } = row;
      if (record.sourceType === "fact-extraction") continue;
      const sourceType = record.sourceType;
      facts.push({ ...record, sourceType, lineage, ownerPrincipalId, extractionPolicyVersion });
      if (facts.length === query.limit) break;
    }
    return facts;
  }
  async hydrateVectors(hits) {
    if (hits.length > 100) memoryError("INVALID_INPUT", "Too many vector candidates");
    const authority = await this.authority(void 0, "read");
    const matches = [];
    for (const hit of hits) {
      const row = await this.ctx.db.get("runtimeMemoryVectors", hit.id);
      if (!row || row.tenantId !== this.scope.tenantId || row.memorySpaceId !== this.scope.memorySpaceId || row.profileId !== DEFAULT_EMBEDDING_PROFILE.profileId || !Number.isFinite(hit.score)) continue;
      const sourceRow = await this.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("lineage.sourceId", row.sourceId)).unique();
      if (!sourceRow || sourceRow.tombstonedAt !== void 0 || row.ownerPrincipalId !== sourceRow.ownerPrincipalId || authority.resourceAccess === "own" && sourceRow.ownerPrincipalId !== authority.principalId) continue;
      const source = await this.visibleSource(row.sourceId, authority);
      const chunk = await this.findChunk(row.chunkId);
      const vector = stripVector(row);
      const receipt = await this.ctx.db.query("runtimeMemoryReceipts").withIndex("by_scope_receipt", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId).eq("receiptId", vector.processingReceiptId)).unique();
      if (!source || !chunk || !receipt || !sameReference2(source.lineage, receipt.identity)) continue;
      try {
        if (isCurrentAuthorizedVector(vector, source, chunk, this.scope)) matches.push({ vector, source, chunk, score: hit.score });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith("PROFILE_NOT_READY:")) throw error;
      }
    }
    return matches;
  }
};
function stripVector(row) {
  const {
    profileId: _profileId,
    scopeProfileKey: _scopeProfileKey,
    ownerPrincipalId: _owner,
    scopeProfileOwnerKey: _ownerKey,
    ...vector
  } = stripSystem(row);
  return vector;
}

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeWorkerAuth.ts
import { ConvexError as ConvexError3, v as v3 } from "convex/values";
function sameAuthority(a, b) {
  return canonicalMemoryValue(authorityReferenceFields(a)) === canonicalMemoryValue(authorityReferenceFields(b));
}
function authorityReferenceFields(a) {
  return [
    a.principalId,
    a.principalVersion,
    a.membershipId,
    a.membershipVersion,
    a.grantId,
    a.grantVersion,
    a.tenantId,
    a.tenantEpoch,
    a.memorySpaceId ?? null,
    a.memorySpaceEpoch ?? null
  ];
}
var maintenanceTable = v3.union(
  v3.literal("agents"),
  v3.literal("artifacts"),
  v3.literal("contexts"),
  v3.literal("conversations"),
  v3.literal("factHistory"),
  v3.literal("facts"),
  v3.literal("governanceEnforcement"),
  v3.literal("governancePolicies"),
  v3.literal("graphSyncQueue"),
  v3.literal("immutable"),
  v3.literal("memories"),
  v3.literal("memorySpaces"),
  v3.literal("mutable"),
  v3.literal("sessions")
);

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/src/domain/model-policy.ts
import { z } from "zod";
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
  availableInThisPacket: !key.startsWith("media.")
})])));
var nonempty3 = z.string().min(1).max(256).refine((value) => value.trim() === value && value.trim().length > 0);
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
  promptVersion: nonempty3,
  schemaVersion: nonempty3,
  extractionVersion: nonempty3,
  toolRegistryVersion: nonempty3,
  priceRevision: nonempty3,
  boundRevision: nonempty3
}).strict();
var rulesSchema = z.object({
  modelId: modelId.optional(),
  nativeInterface: nativeInterface.optional(),
  allowedModels: z.array(modelId).min(1).optional(),
  interfaces: z.array(nativeInterface).min(1).optional(),
  capabilities: z.array(capability).min(1).optional(),
  allowedOptions: z.array(optionKey).optional(),
  allowedTools: z.array(nonempty3).optional(),
  fallbackModels: z.array(modelId).optional(),
  limits: limitsSchema.partial().optional(),
  pins: pinsSchema.partial().optional()
}).strict();
var policySchema = z.object({
  policyId: nonempty3,
  version: positive,
  scope: z.enum(["deployment", "tenant", "agent"]),
  tenantId: nonempty3.optional(),
  agentId: nonempty3.optional(),
  agentVersion: positive.optional(),
  operationKey: operationKey.optional(),
  rules: rulesSchema,
  override: z.object({ actorPrincipalId: nonempty3, changeRevision: positive, authorizationId: nonempty3 }).strict().optional()
}).strict();
var costBoundSchema = z.object({
  kind: z.literal("qualified-call-ceiling"),
  maximumCostUnits: positive,
  provenance: nonempty3,
  coversAllProviderCharges: z.literal(true)
}).strict();
var qualificationSchema = z.object({
  receiptId: nonempty3,
  modelId,
  nativeInterface,
  capabilities: z.array(capability).min(1),
  allowedOptions: z.array(optionKey),
  limits: limitsSchema,
  costBound: costBoundSchema,
  priceRevision: nonempty3,
  boundRevision: nonempty3
}).strict();
var scopeSchema = z.object({
  tenantId: nonempty3,
  tenantEpoch: positive,
  memorySpaceId: nonempty3,
  memorySpaceEpoch: positive,
  principalId: nonempty3,
  principalVersion: positive,
  membershipId: nonempty3,
  membershipVersion: positive,
  grantId: nonempty3,
  grantVersion: positive
}).strict();
var profileSchema = z.object({
  profileId: nonempty3,
  modelId,
  dimensions: positive,
  normalization: nonempty3,
  chunking: nonempty3,
  indexName: nonempty3
}).strict();
var contextSchema = z.object({
  scope: scopeSchema,
  agent: z.object({ agentId: nonempty3, version: positive }).strict().optional(),
  operationKey,
  parentOperationId: nonempty3.optional(),
  runBudgetId: nonempty3,
  source: z.object({ sourceId: nonempty3, sourceEventId: nonempty3, sourceRevision: positive }).strict().optional(),
  semanticProfile: profileSchema.optional(),
  /** Exact override records authenticated by a separate backend policy-admin check. */
  authorizedOverrides: z.array(z.object({
    authorizationId: nonempty3,
    actorPrincipalId: nonempty3,
    changeRevision: positive,
    policyId: nonempty3,
    policyVersion: positive
  }).strict())
}).strict();
var resolutionSchema = z.object({
  context: contextSchema,
  policies: z.array(policySchema).min(1),
  qualifications: z.array(qualificationSchema)
}).strict();
function deny2(message) {
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
function assertLimits(limits2) {
  if (limits2.inputTokens > limits2.contextTokens || limits2.outputTokens > limits2.contextTokens || limits2.operationBudgetUnits > limits2.runBudgetUnits || limits2.runBudgetUnits > limits2.tenantBudgetUnits) {
    deny2("inconsistent token or monetary bounds");
  }
}
function resolveModelPolicy(input) {
  canonicalModelJson(input);
  const { context, policies: policies2, qualifications: qualifications2 } = parse(resolutionSchema, input);
  const operation = MODEL_OPERATION_REGISTRY[context.operationKey];
  if (!operation.availableInThisPacket) throw new Error("CAPABILITY_UNAVAILABLE: media qualification belongs to its service gate");
  const seen = /* @__PURE__ */ new Set();
  for (const policy of policies2) {
    const target = `${policy.scope}:${policy.operationKey ?? "*"}`;
    if (seen.has(target)) deny2("ambiguous policy scope");
    seen.add(target);
    if (policy.operationKey && policy.operationKey !== context.operationKey || policy.scope === "deployment" && (policy.tenantId || policy.agentId || policy.agentVersion) || policy.scope !== "deployment" && policy.tenantId !== context.scope.tenantId || policy.scope === "tenant" && (policy.agentId || policy.agentVersion) || policy.scope === "agent" && (!context.agent || policy.agentId !== context.agent.agentId || policy.agentVersion !== context.agent.version)) {
      deny2("policy scope does not match trusted context");
    }
    if (policy.scope === "deployment" && policy.override) deny2("deployment hard bounds cannot be overridden");
    if (policy.override && !context.authorizedOverrides.some((auth) => auth.authorizationId === policy.override?.authorizationId && auth.actorPrincipalId === policy.override.actorPrincipalId && auth.changeRevision === policy.override.changeRevision && auth.policyId === policy.policyId && auth.policyVersion === policy.version)) deny2("unauthorized policy override");
  }
  const rank = (policy) => ["deployment", "tenant", "agent"].indexOf(policy.scope) + (policy.operationKey ? 3 : 0);
  const ordered = [...policies2].sort((a, b) => rank(a) - rank(b));
  const deployment = ordered.find((policy) => policy.scope === "deployment" && !policy.operationKey);
  if (!deployment || deployment.override) deny2("missing ordinary deployment hard bounds");
  const hard = deployment.rules;
  if (!hard.allowedModels || !hard.interfaces || !hard.capabilities || !hard.allowedOptions || !hard.allowedTools || !hard.fallbackModels) deny2("incomplete deployment policy");
  const hardLimits = parse(limitsSchema, hard.limits);
  const hardPins = parse(pinsSchema, hard.pins);
  assertLimits(hardLimits);
  let limits2 = hardLimits;
  let models = [...hard.allowedModels], interfaces = [...hard.interfaces], capabilities = [...hard.capabilities];
  let options = [...hard.allowedOptions], tools = [...hard.allowedTools], fallbacks = [...hard.fallbackModels];
  let pins2 = hardPins;
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
      limits2 = hardLimits;
    }
    models = intersect(models, rules.allowedModels);
    interfaces = intersect(interfaces, rules.interfaces);
    capabilities = intersect(capabilities, rules.capabilities);
    options = intersect(options, rules.allowedOptions);
    tools = intersect(tools, rules.allowedTools);
    fallbacks = intersect(fallbacks, rules.fallbackModels);
    limits2 = tighten(limits2, rules.limits);
    pins2 = { ...pins2, ...rules.pins };
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
    limits2 = tighten(limits2, policy.rules.limits);
  }
  if (!models.includes(selected) || !interfaces.includes(selectedInterface) || !operation.interfaces.includes(selectedInterface) || !capabilities.includes(operation.capability)) throw new Error("CAPABILITY_UNSUPPORTED: selection violates operation policy");
  const qualificationKeys = /* @__PURE__ */ new Set();
  for (const receipt2 of qualifications2) {
    const key = `${receipt2.modelId}:${receipt2.nativeInterface}`;
    if (qualificationKeys.has(key)) deny2("ambiguous qualification");
    qualificationKeys.add(key);
    assertLimits(receipt2.limits);
  }
  const qualified = (candidate) => qualifications2.find((receipt2) => receipt2.modelId === candidate && receipt2.nativeInterface === selectedInterface && receipt2.capabilities.includes(operation.capability) && receipt2.priceRevision === pins2.priceRevision && receipt2.boundRevision === pins2.boundRevision);
  const receipt = qualified(selected);
  if (!receipt) throw new Error("CAPABILITY_UNAVAILABLE: missing qualified model/interface/price/bound receipt");
  limits2 = tighten(limits2, receipt.limits);
  assertLimits(limits2);
  if (receipt.costBound.maximumCostUnits > limits2.operationBudgetUnits) deny2("qualified cost ceiling exceeds operation budget");
  options = intersect(options, receipt.allowedOptions);
  capabilities = intersect(capabilities, receipt.capabilities);
  if (operation.capability === "embedding") {
    if (!context.semanticProfile) throw new Error("PROFILE_NOT_READY: embedding profile is required");
    assertProfileMatches(context.semanticProfile);
    options = [];
    tools = [];
    capabilities = ["embedding"];
    if (selected !== DEFAULT_EMBEDDING_PROFILE.modelId) throw new Error("PROFILE_NOT_READY: embedding model changed");
  } else if (context.semanticProfile) deny2("text policy cannot select an embedding profile");
  const fallbackCandidates = fallbacks.filter((candidate) => candidate !== selected && models.includes(candidate)).map((candidate) => {
    const candidateReceipt = qualified(candidate);
    if (!candidateReceipt || candidateReceipt.costBound.maximumCostUnits > receipt.costBound.maximumCostUnits || options.some((option2) => !candidateReceipt.allowedOptions.includes(option2)) || capabilities.some((cap) => !candidateReceipt.capabilities.includes(cap)) || MODEL_LIMIT_KEYS.some((key) => candidateReceipt.limits[key] < limits2[key]) || operation.capability === "embedding") {
      deny2("unqualified or incompatible fallback candidate");
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
    limits: limits2,
    pins: pins2,
    policyVersions: ordered.map(({ policyId, version, override }) => ({ policyId, version, ...override ? { override } : {} })),
    qualificationReceiptId: receipt.receiptId,
    costBound: receipt.costBound,
    scope: context.scope,
    ...context.agent ? { agent: context.agent } : {},
    runBudgetId: context.runBudgetId,
    ...context.parentOperationId ? { parentOperationId: context.parentOperationId } : {},
    ...context.source ? { source: context.source } : {},
    ...context.semanticProfile ? { semanticProfile: context.semanticProfile } : {},
    fallbackCandidates,
    currency: "USD",
    monetaryUnit: "micro-USD"
  });
}
function canonicalModelJson(input) {
  const active2 = /* @__PURE__ */ new Set();
  function visit(value) {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return JSON.stringify(value);
    if (typeof value !== "object" || active2.has(value)) throw new Error("INVALID_INPUT: noncanonical JSON");
    active2.add(value);
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
    active2.delete(value);
    return result;
  }
  return visit(input);
}
var canonicalRecordSchema = z.custom((value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
});
var partSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1) }).strict(),
  z.object({ type: z.literal("tool-call"), toolCallId: nonempty3, toolName: nonempty3, input: canonicalRecordSchema }).strict(),
  z.object({ type: z.literal("tool-result"), toolCallId: nonempty3, toolName: nonempty3, output: canonicalRecordSchema }).strict()
]);
var messageSchema = z.object({ role: z.enum(["system", "user", "assistant", "tool"]), parts: z.array(partSchema).min(1) }).strict();
var requestSchema = z.object({
  semanticId: nonempty3,
  childCallId: nonempty3,
  texts: z.array(z.string().min(1)).min(1),
  messages: z.array(messageSchema).min(1).optional(),
  inputTokens: positive,
  outputTokens: integer,
  toolSteps: integer,
  timeoutMs: positive,
  reservationUnits: positive,
  promptVersion: nonempty3,
  schemaVersion: nonempty3,
  extractionVersion: nonempty3,
  toolRegistryVersion: nonempty3,
  tools: z.array(z.object({ name: nonempty3, definition: canonicalRecordSchema }).strict()),
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
function validateModelRequest(snapshot2, input) {
  const detached = JSON.parse(canonicalModelJson(input));
  const request = parse(requestSchema, detached);
  for (const key of ["promptVersion", "schemaVersion", "extractionVersion", "toolRegistryVersion"]) {
    if (request[key] !== snapshot2.pins[key]) deny2("request changed pinned versions");
  }
  for (const key of ["inputTokens", "outputTokens", "toolSteps", "timeoutMs"]) {
    if (request[key] > snapshot2.limits[key]) deny2("request exceeds bounded limits");
  }
  if (request.inputTokens + request.outputTokens > snapshot2.limits.contextTokens || request.reservationUnits > snapshot2.limits.operationBudgetUnits || request.reservationUnits < snapshot2.costBound.maximumCostUnits) deny2("request exceeds context or operation budget");
  if (request.tools.some((tool) => !snapshot2.allowedTools.includes(tool.name)) || new Set(request.tools.map((t) => t.name)).size !== request.tools.length || request.tools.length > 0 && (!snapshot2.capabilities.includes("tools") || request.toolSteps === 0)) deny2("tools are not allowed");
  for (const key of Object.keys(request.options)) {
    if (key !== "maxRetries" && key !== "providerOptions" && !snapshot2.allowedOptions.includes(key)) deny2("option is not allowed");
  }
  if (snapshot2.nativeInterface === "responses") {
    if (request.options.providerOptions?.openai.store !== false) deny2("Responses requires openai.store:false");
  } else if (request.options.providerOptions) deny2("provider options are not allowed on this interface");
  const structured = MODEL_OPERATION_REGISTRY[snapshot2.operationKey].capability === "structured";
  if (structured !== (request.outputSchema !== void 0)) deny2("operation schema mismatch");
  if (snapshot2.semanticProfile) {
    if (!request.profile || !request.batch) throw new Error("PROFILE_NOT_READY: embedding profile and stable batch boundary required");
    assertProfileMatches(request.profile, snapshot2.semanticProfile);
    if (request.batch.end - request.batch.start !== request.texts.length || request.texts.length > 512 || request.outputTokens || request.toolSteps || request.tools.length || request.outputSchema || request.messages) deny2("invalid embedding batch");
  } else if (request.profile || request.batch) deny2("nonembedding request has embedding parameters");
  const texts = request.texts.map(normalizeSourceText);
  const messages = request.messages?.map((message) => ({ ...message, parts: message.parts.map((part) => part.type === "text" ? { ...part, text: normalizeSourceText(part.text) } : part) }));
  if (!snapshot2.semanticProfile) {
    if (!messages || canonicalModelJson(messages.flatMap((message) => message.parts.flatMap((part) => part.type === "text" ? [part.text] : []))) !== canonicalModelJson(texts)) {
      deny2("complete dispatch messages must match normalized text inputs");
    }
    for (const message of messages) for (const part of message.parts) {
      if (part.type === "tool-call" && message.role !== "assistant" || part.type === "tool-result" && message.role !== "tool" || message.role === "tool" && part.type !== "tool-result" || part.type !== "text" && (!snapshot2.capabilities.includes("tools") || !snapshot2.allowedTools.includes(part.toolName))) {
        deny2("invalid message role or unregistered tool part");
      }
    }
  }
  const normalized = { ...request, texts, ...messages ? { messages } : {} };
  const canonical2 = canonicalModelJson({ snapshot: snapshot2, request: normalized });
  return freeze({ request: normalized, canonical: canonical2 });
}
function assertModelRequestIdentity(existing, incoming) {
  if (!existing.canonical || !incoming.canonical || !existing.hash || !incoming.hash || existing.canonical !== incoming.canonical || existing.hash !== incoming.hash) {
    throw new Error("IDEMPOTENCY_CONFLICT: model request identity changed");
  }
}
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
function canFallbackModel(snapshot2, candidateModelId, input) {
  let detached;
  try {
    detached = JSON.parse(canonicalModelJson(input));
  } catch {
    return false;
  }
  const result = fallbackEvidenceSchema.safeParse(detached);
  if (!result.success) return false;
  const evidence2 = result.data;
  return !snapshot2.semanticProfile && snapshot2.fallbackCandidates.some((candidate) => candidate.modelId === candidateModelId) && (evidence2.outcome === "not_dispatched" && evidence2.proof === "pre_dispatch" || evidence2.outcome === "confirmed_rejected" && evidence2.proof === "qualified_rejection") && !evidence2.outputVisible && !evidence2.toolInputVisible && !evidence2.toolResultVisible && !evidence2.toolEffectCommitted && !evidence2.paidLiabilityUncertain && !evidence2.cancelled && evidence2.priorAttemptAccounted && evidence2.currentAuthorityChecked && evidence2.currentSourceChecked && evidence2.currentPolicyChecked;
}

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeModelPolicyBootstrap.ts
var runtimeModelPolicyBootstrap_exports = {};
__export(runtimeModelPolicyBootstrap_exports, {
  isTrustedDeploymentManifest: () => isTrustedDeploymentManifest,
  lookupDeploymentManifest: () => lookupDeploymentManifest
});

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/qualificationManifest.ts
function freeze2(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze2(child);
    Object.freeze(value);
  }
  return value;
}
var digest = "f".repeat(64);
var limits = {
  inputTokens: 1e3,
  contextTokens: 2e3,
  outputTokens: 500,
  toolSteps: 4,
  timeoutMs: 1e4,
  operationBudgetUnits: 1e4,
  runBudgetUnits: 2e4,
  tenantBudgetUnits: 5e4,
  concurrency: 4
};
var pins = {
  promptVersion: "qa-prompt-1",
  schemaVersion: "qa-schema-1",
  extractionVersion: "qa-extract-1",
  toolRegistryVersion: "qa-tools-1",
  priceRevision: "qa-price-1",
  boundRevision: "qa-bound-1"
};
var chat = "openai/gpt-4o-mini";
var fallback = "fixture/fallback";
var qualifications = [chat, fallback, DEFAULT_EMBEDDING_PROFILE.modelId].map((modelId2) => ({
  receiptId: modelId2 === chat ? "qa-chat" : modelId2 === fallback ? "qa-fallback" : "qa-embedding",
  modelId: modelId2,
  nativeInterface: modelId2 === DEFAULT_EMBEDDING_PROFILE.modelId ? "embedding" : "chat",
  capabilities: modelId2 === DEFAULT_EMBEDDING_PROFILE.modelId ? ["embedding"] : ["text"],
  allowedOptions: ["temperature"],
  limits,
  costBound: {
    kind: "qualified-call-ceiling",
    maximumCostUnits: modelId2 === fallback ? 80 : 100,
    provenance: "fixture-synthetic-bookkeeping-only",
    coversAllProviderCharges: true
  },
  priceRevision: pins.priceRevision,
  boundRevision: pins.boundRevision
}));
var fixed = {
  manifestId: "qa-task04-synthetic-v1",
  revision: 1,
  artifactRevision: "qa-c2-ledger-only",
  evidenceHash: digest,
  acceptanceHash: digest,
  classification: "fixture-synthetic",
  budgetWindowMs: 6e4,
  policies: [{ policyId: "qa-deployment", version: 1, scope: "deployment", rules: {
    allowedModels: [chat, fallback, DEFAULT_EMBEDDING_PROFILE.modelId],
    interfaces: ["chat", "embedding"],
    capabilities: ["text", "embedding"],
    allowedOptions: ["temperature"],
    allowedTools: [],
    fallbackModels: [fallback],
    limits,
    pins
  } }, { policyId: "qa-agent-policy", version: 1, scope: "agent", tenantId: "admission-a6f48c36ac2cd274d7b26ff3e6fbbf8a-agent-selector-denial", agentId: "qa-agent", agentVersion: 7, rules: { limits: { outputTokens: 100 } } }],
  qualifications: qualifications.filter((q) => q.nativeInterface === "chat"),
  dispatchEvidence: qualifications.filter((q) => q.nativeInterface === "chat").map((q) => ({
    receiptId: q.receiptId,
    evidenceHash: digest,
    providerVersion: "fixture-synthetic-0",
    nativeInterface: q.nativeInterface,
    modelId: q.modelId,
    inputBound: {
      ruleId: q.nativeInterface === "embedding" ? "default-embedding-utf8-v1" : "plain-chat-cookbook-utf8-v1",
      revision: 1,
      featureEnvelope: q.nativeInterface === "embedding" ? "default-embedding-v1" : "plain-chat-v1",
      nativeTransformHash: digest,
      documentHash: digest,
      proofHash: digest
    },
    resultBound: { maximumPrivateResultBytes: 6e4, maximumOutputTokens: 500, maximumEmbeddingValues: 1, proofHash: digest },
    checkedAt: 0,
    expiresAt: 41024448e5,
    terminalCost: "gateway-aggregate-usd-v1",
    terminalProof: "provider-terminal-v1",
    priceRevision: q.priceRevision,
    boundRevision: q.boundRevision
  }))
};
var syntheticManifest = freeze2(fixed);
var embeddingQualifications = qualifications.filter((q) => q.nativeInterface === "embedding");
var embedding = {
  ...fixed,
  manifestId: "qa-task04-synthetic-embedding-v1",
  policies: [{ ...fixed.policies[0], policyId: "qa-embedding-deployment", rules: { ...fixed.policies[0].rules, fallbackModels: [] } }],
  qualifications: embeddingQualifications,
  dispatchEvidence: embeddingQualifications.map((q) => ({
    ...fixed.dispatchEvidence[0],
    receiptId: q.receiptId,
    modelId: q.modelId,
    nativeInterface: q.nativeInterface,
    inputBound: { ...fixed.dispatchEvidence[0].inputBound, ruleId: "default-embedding-utf8-v1", featureEnvelope: "default-embedding-v1" }
  }))
};
var syntheticEmbeddingManifest = freeze2(embedding);

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeModelPolicyBootstrap.ts
var manifests = Object.freeze([syntheticManifest, syntheticEmbeddingManifest]);
function lookupDeploymentManifest(id, revision) {
  const selected = manifests.filter((entry) => entry.manifestId === id && entry.revision === revision);
  return selected.length === 1 ? selected[0] : void 0;
}
function isTrustedDeploymentManifest(manifest) {
  return manifest.classification === "fixture-synthetic" && ["qa-task04-synthetic-v1", "qa-task04-synthetic-embedding-v1"].includes(manifest.manifestId) && manifest.revision === 1 && manifests.some((entry) => entry === manifest);
}

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimePolicySchema.ts
import { defineTable as defineTable2 } from "convex/server";
import { v as v4 } from "convex/values";
var modelOperationKey = v4.union(...MODEL_OPERATION_KEYS.map((key) => v4.literal(key)));
var modelSource = v4.object({ sourceId: v4.string(), sourceEventId: v4.string(), sourceRevision: v4.number(), contentHash: v4.string() });
var rootProvenance = v4.object({
  manifestId: v4.string(),
  revision: v4.number(),
  canonical: v4.string(),
  hash: v4.string(),
  artifactRevision: v4.string(),
  evidenceHash: v4.string(),
  acceptanceHash: v4.string()
});
var policyState = v4.union(
  v4.literal("reserved"),
  v4.literal("dispatch_pending"),
  v4.literal("settled"),
  v4.literal("not_dispatched"),
  v4.literal("confirmed_rejected"),
  v4.literal("uncertain")
);
var visibilityFields = { outputVisible: v4.boolean(), toolInputVisible: v4.boolean(), toolResultVisible: v4.boolean(), toolEffectCommitted: v4.boolean() };
var runtimePolicyTables = {
  runtimeModelPolicies: defineTable2({
    policyId: v4.string(),
    version: v4.number(),
    scope: v4.union(v4.literal("deployment"), v4.literal("tenant"), v4.literal("agent")),
    tenantId: v4.optional(v4.string()),
    agentId: v4.optional(v4.string()),
    agentVersion: v4.optional(v4.number()),
    operationKey: v4.optional(modelOperationKey),
    canonical: v4.string(),
    root: rootProvenance,
    actorReference: v4.optional(runtimeAuthorityReference),
    active: v4.boolean(),
    revokedAt: v4.optional(v4.number()),
    createdAt: v4.number()
  }).index("by_policy_version", ["policyId", "version"]).index("by_scope_active", ["scope", "tenantId", "active"]),
  runtimeModelQualifications: defineTable2({
    receiptId: v4.string(),
    version: v4.number(),
    canonical: v4.string(),
    root: rootProvenance,
    active: v4.boolean(),
    revokedAt: v4.optional(v4.number()),
    createdAt: v4.number()
  }).index("by_receipt", ["receiptId", "version"]).index("by_active", ["active"]),
  runtimeBudgetAccounts: defineTable2({
    accountKey: v4.string(),
    scopeKey: v4.string(),
    kind: v4.union(v4.literal("tenant"), v4.literal("run")),
    tenantId: v4.string(),
    runBudgetId: v4.optional(v4.string()),
    reference: v4.optional(runtimeAuthorityReference),
    requestCanonical: v4.optional(v4.string()),
    agentId: v4.optional(v4.string()),
    agentVersion: v4.optional(v4.number()),
    windowId: v4.string(),
    windowStart: v4.number(),
    windowEnd: v4.number(),
    currency: v4.literal("USD"),
    monetaryUnit: v4.literal("micro-USD"),
    root: rootProvenance,
    limitUnits: v4.number(),
    reservedUnits: v4.number(),
    settledUnits: v4.number(),
    uncertainUnits: v4.number(),
    concurrencyLimit: v4.number(),
    activeConcurrency: v4.number(),
    overrun: v4.boolean(),
    current: v4.boolean(),
    cancelled: v4.boolean(),
    predecessor: v4.optional(v4.id("runtimeBudgetAccounts")),
    version: v4.number(),
    createdAt: v4.number()
  }).index("by_account_key", ["accountKey"]).index("by_scope_current", ["scopeKey", "current"]).index("by_run", ["runBudgetId"]),
  runtimeModelOperations: defineTable2({
    operationId: v4.string(),
    reference: runtimeAuthorityReference,
    tenantId: v4.string(),
    memorySpaceId: v4.string(),
    principalId: v4.string(),
    semanticId: v4.string(),
    operationKey: modelOperationKey,
    runAccountId: v4.id("runtimeBudgetAccounts"),
    parentOperationId: v4.optional(v4.id("runtimeModelOperations")),
    source: v4.optional(modelSource),
    resolutionCanonical: v4.string(),
    snapshotCanonical: v4.string(),
    identityCanonical: v4.string(),
    identityHash: v4.string(),
    reservedUnits: v4.number(),
    settledUnits: v4.number(),
    uncertainUnits: v4.number(),
    overrun: v4.boolean(),
    cancelled: v4.boolean(),
    createdAt: v4.number()
  }).index("by_identity", ["tenantId", "memorySpaceId", "principalId", "semanticId", "operationKey"]),
  runtimeModelAttempts: defineTable2({
    operationDocumentId: v4.id("runtimeModelOperations"),
    childCallId: v4.string(),
    ordinal: v4.number(),
    attemptNumber: v4.number(),
    fallbackModelId: v4.optional(v4.string()),
    priorAttemptId: v4.optional(v4.id("runtimeModelAttempts")),
    canonical: v4.string(),
    hash: v4.string(),
    resolutionCanonical: v4.string(),
    snapshotCanonical: v4.string(),
    inputProofCanonical: v4.string(),
    measuredInputTokens: v4.number(),
    maximumOutputTokens: v4.number(),
    tenantAccountId: v4.id("runtimeBudgetAccounts"),
    runAccountId: v4.id("runtimeBudgetAccounts"),
    reservationUnits: v4.number(),
    state: policyState,
    dispatchIdentity: v4.string(),
    checkpointAt: v4.optional(v4.number()),
    slotReleased: v4.boolean(),
    ...visibilityFields,
    receiptCanonical: v4.optional(v4.string()),
    receiptHash: v4.optional(v4.string()),
    settledCostUnits: v4.optional(v4.number()),
    costProvenance: v4.optional(v4.string()),
    actualModel: v4.optional(v4.string()),
    privateResultCanonical: v4.optional(v4.string()),
    resultWithheld: v4.boolean(),
    terminalEvidenceCanonical: v4.optional(v4.string()),
    createdAt: v4.number()
  }).index("by_child_attempt", ["operationDocumentId", "childCallId", "attemptNumber"]).index("by_operation", ["operationDocumentId"]).index("by_state_checkpoint", ["state", "checkpointAt"])
};

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeModelPolicy.ts
var MODEL_LEDGER_STORAGE_LIMITS = Object.freeze({ canonicalBytes: 18e4, privateResultBytes: 6e4, embeddingValuesPerCall: 1 });
var MAX_CANONICAL_BYTES = MODEL_LEDGER_STORAGE_LIMITS.canonicalBytes;
var digest2 = /^[a-f0-9]{64}$/;
function fail(code, outcome = "not_dispatched") {
  throw new ConvexError4({ version: 1, code, message: "Model operation control failed.", retryable: false, outcome });
}
function domainControl(call, outcome = "not_dispatched") {
  try {
    return call();
  } catch (error) {
    let message;
    try {
      if (typeof error !== "object" || error === null || Object.getPrototypeOf(error) !== Error.prototype) throw error;
      const descriptor = Object.getOwnPropertyDescriptor(error, "message");
      if (!descriptor || !("value" in descriptor)) throw error;
      message = descriptor.value;
    } catch {
      throw error;
    }
    if (typeof message === "string") {
      const code = /^(INVALID_INPUT|POLICY_DENIED|CAPABILITY_UNAVAILABLE|CAPABILITY_UNSUPPORTED|PROFILE_NOT_READY|IDEMPOTENCY_CONFLICT): /.exec(message)?.[1];
      if (code) fail(code, outcome);
    }
    throw error;
  }
}
function canonicalModelJson2(value) {
  return domainControl(() => canonicalModelJson(value), "uncertain");
}
function resolveModelPolicy2(value) {
  return domainControl(() => resolveModelPolicy(value), "uncertain");
}
function validateModelRequest2(...args) {
  return domainControl(() => validateModelRequest(...args));
}
function assertModelRequestIdentity2(...args) {
  domainControl(() => assertModelRequestIdentity(args[0], args[1]), args[2]);
}
function integer2(value, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) fail("INVALID_INPUT");
  return value;
}
function add(...values) {
  return integer2(values.reduce((sum, value) => integer2(sum + integer2(value)), 0));
}
function subtract(value, amount) {
  return integer2(integer2(value) - integer2(amount));
}
function text(value) {
  if (!value || value.trim() !== value || value.length > 256) fail("INVALID_INPUT");
  return value;
}
function canonical(value) {
  const encoded = canonicalModelJson2(value);
  if (new TextEncoder().encode(encoded).length > MAX_CANONICAL_BYTES) fail("INVALID_INPUT");
  return encoded;
}
function decode(value) {
  if (new TextEncoder().encode(value).length > MAX_CANONICAL_BYTES) fail("INVALID_INPUT");
  let decoded;
  try {
    decoded = JSON.parse(value);
  } catch {
    return fail("INVALID_INPUT");
  }
  if (canonical(decoded) !== value) fail("INVALID_INPUT");
  return decoded;
}
function single(rows2) {
  if (rows2.length > 1) fail("POLICY_DENIED");
  return rows2[0];
}
function purpose(key) {
  return key === "embedding.query" ? "read" : key === "memory.extract" || key === "facts.resolve" || key === "embedding.memory" ? "write" : "run";
}
async function currentAuthority(ctx, reference, key) {
  memoryScope(reference);
  return await recheckAuthority(ctx, reference, { capability: purpose(key), tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId });
}
async function finalActor(ctx, reference, key) {
  const grant = await createAuthorityReader(ctx).getGrant(reference.grantId);
  await currentAuthority(ctx, reference, key);
  if (!grant || grant.expiresAt !== void 0 && Date.now() >= grant.expiresAt) fail("FORBIDDEN");
}
async function checkSource(ctx, reference, key, source) {
  if (!source) {
    if (key === "memory.extract" || key === "embedding.memory" || key === "facts.resolve") fail("FORBIDDEN");
    return;
  }
  integer2(source.sourceRevision, 1);
  const capability3 = purpose(key) === "write" ? "write" : "read";
  const row = await new ConvexMemoryRepository(ctx, reference, capability3).getSource(source.sourceId);
  if (!row || row.lineage.sourceEventId !== source.sourceEventId || row.lineage.sourceRevision !== source.sourceRevision || row.contentHash !== source.contentHash) fail("FORBIDDEN");
  if (await semanticHash(row.content) !== source.contentHash) fail("FORBIDDEN");
}
function validManifest(manifest) {
  if (!manifest || !isTrustedDeploymentManifest(manifest) || !digest2.test(manifest.evidenceHash) || !digest2.test(manifest.acceptanceHash) || !manifest.artifactRevision || !manifest.policies.length || !manifest.qualifications.length || manifest.policies.length > 64 || manifest.qualifications.length > 64) fail("CAPABILITY_UNAVAILABLE");
  integer2(manifest.revision, 1);
  integer2(manifest.budgetWindowMs, 1);
  if (manifest.policies.some((policy) => policy.override || (policy.scope === "deployment" ? Boolean(policy.tenantId || policy.agentId) : policy.scope !== "agent" || !policy.tenantId || !policy.agentId || !Number.isSafeInteger(policy.agentVersion) || policy.agentVersion < 1))) fail("POLICY_DENIED");
  for (const qualification of manifest.qualifications) {
    const proof = single(manifest.dispatchEvidence.filter((entry) => entry.receiptId === qualification.receiptId));
    if (!proof || !digest2.test(proof.evidenceHash) || !digest2.test(proof.inputBound.proofHash) || !proof.providerVersion || proof.modelId !== qualification.modelId || proof.nativeInterface !== qualification.nativeInterface || proof.priceRevision !== qualification.priceRevision || proof.boundRevision !== qualification.boundRevision || !digest2.test(proof.inputBound.nativeTransformHash) || !digest2.test(proof.inputBound.documentHash) || proof.terminalProof !== "provider-terminal-v1") fail("CAPABILITY_UNAVAILABLE");
    if (!digest2.test(proof.resultBound.proofHash) || proof.resultBound.maximumPrivateResultBytes > MODEL_LEDGER_STORAGE_LIMITS.privateResultBytes || proof.resultBound.maximumEmbeddingValues !== 1) fail("CAPABILITY_UNAVAILABLE");
    integer2(proof.resultBound.maximumPrivateResultBytes, 1);
    integer2(proof.resultBound.maximumOutputTokens);
    integer2(proof.inputBound.revision, 1);
    integer2(proof.checkedAt);
    integer2(proof.expiresAt, 1);
    if (proof.checkedAt >= proof.expiresAt) fail("CAPABILITY_UNAVAILABLE");
  }
}
async function provenance(manifest) {
  const encoded = canonical(manifest);
  return {
    manifestId: manifest.manifestId,
    revision: manifest.revision,
    canonical: encoded,
    hash: await semanticHash(encoded),
    artifactRevision: manifest.artifactRevision,
    evidenceHash: manifest.evidenceHash,
    acceptanceHash: manifest.acceptanceHash
  };
}
async function trustedRoot(root) {
  const manifest = lookupDeploymentManifest(root.manifestId, root.revision);
  validManifest(manifest);
  if (canonical(await provenance(manifest)) !== canonical(root)) fail("POLICY_DENIED");
  return manifest;
}
async function activeRoot(ctx) {
  const rows2 = await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", (q) => q.eq("scope", "deployment").eq("tenantId", void 0).eq("active", true)).take(65);
  if (!rows2.length || rows2.length > 64) fail("CAPABILITY_UNAVAILABLE");
  const root = rows2[0].root;
  const manifest = await trustedRoot(root);
  if (manifest.dispatchEvidence.some((proof) => proof.checkedAt > Date.now() || Date.now() >= proof.expiresAt)) fail("CAPABILITY_UNAVAILABLE");
  if (rows2.length !== manifest.policies.filter((p) => p.scope === "deployment").length || rows2.some((row) => row.revokedAt !== void 0 || canonical(row.root) !== canonical(root) || !manifest.policies.some((policy) => policy.policyId === row.policyId && policy.version === row.version && canonical(policy) === row.canonical))) fail("POLICY_DENIED");
  for (const qualification of manifest.qualifications) {
    const row = single(await ctx.db.query("runtimeModelQualifications").withIndex("by_receipt", (q) => q.eq("receiptId", qualification.receiptId).eq("version", root.revision)).take(2));
    if (!row || !row.active || row.revokedAt !== void 0 || row.canonical !== canonical(qualification) || canonical(row.root) !== canonical(root)) fail("CAPABILITY_UNAVAILABLE");
  }
  return { manifest, root };
}
function evidence(manifest, snapshot2) {
  const proof = single(manifest.dispatchEvidence.filter((entry) => entry.receiptId === snapshot2.qualificationReceiptId));
  if (!proof || proof.modelId !== snapshot2.modelId || proof.nativeInterface !== snapshot2.nativeInterface) fail("CAPABILITY_UNAVAILABLE");
  return proof;
}
var option = z2.enum(["temperature", "topP", "seed", "stopSequences"]);
var capability2 = z2.enum(["text", "structured", "tools", "embedding", "image", "video"]);
var nativeInterface2 = z2.enum(["chat", "responses", "messages", "embedding", "image", "video"]);
var count = z2.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
var limitsSchema2 = z2.object({
  inputTokens: count.min(1),
  contextTokens: count.min(1),
  outputTokens: count.min(1),
  toolSteps: count,
  timeoutMs: count.min(1),
  operationBudgetUnits: count.min(1),
  runBudgetUnits: count.min(1),
  tenantBudgetUnits: count.min(1),
  concurrency: count.min(1)
});
var rulesSchema2 = z2.object({
  modelId: z2.string().optional(),
  nativeInterface: nativeInterface2.optional(),
  allowedModels: z2.array(z2.string()).optional(),
  interfaces: z2.array(nativeInterface2).optional(),
  capabilities: z2.array(capability2).optional(),
  allowedOptions: z2.array(option).optional(),
  allowedTools: z2.array(z2.string()).optional(),
  fallbackModels: z2.array(z2.string()).optional(),
  limits: limitsSchema2.partial().optional(),
  pins: z2.object({
    promptVersion: z2.string(),
    schemaVersion: z2.string(),
    extractionVersion: z2.string(),
    toolRegistryVersion: z2.string(),
    priceRevision: z2.string(),
    boundRevision: z2.string()
  }).partial().optional()
}).strict();
var tenantPolicySchema = z2.object({
  policyId: z2.string().min(1),
  version: count.min(1),
  scope: z2.literal("tenant"),
  tenantId: z2.string().min(1),
  operationKey: z2.enum([
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
  ]).optional(),
  rules: rulesSchema2,
  override: z2.object({ actorPrincipalId: z2.string(), changeRevision: count.min(1), authorizationId: z2.string() }).strict().optional()
}).strict();
async function readTrustedAgentPolicyVersion(ctx, reference, agent) {
  text(agent.agentId);
  integer2(agent.version, 1);
  await currentAuthority(ctx, reference, "agent.respond");
  const { manifest, root } = await activeRoot(ctx);
  const selected = manifest.policies.filter((policy) => policy.scope === "agent" && policy.tenantId === reference.tenantId && policy.agentId === agent.agentId && policy.agentVersion === agent.version);
  if (!selected.length) fail("CAPABILITY_UNAVAILABLE");
  for (const policy of selected) {
    const row = single(await ctx.db.query("runtimeModelPolicies").withIndex("by_policy_version", (q) => q.eq("policyId", policy.policyId).eq("version", policy.version)).take(2));
    if (!row || !row.active || row.revokedAt !== void 0 || row.scope !== "agent" || row.tenantId !== reference.tenantId || row.agentId !== agent.agentId || row.agentVersion !== agent.version || row.canonical !== canonical(policy) || canonical(row.root) !== canonical(root)) fail("POLICY_DENIED");
  }
  return { tenantId: reference.tenantId, agent, policies: selected };
}
async function policies(ctx, manifest, root, reference, key, agent) {
  const rows2 = await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", (q) => q.eq("scope", "tenant").eq("tenantId", reference.tenantId).eq("active", true)).take(65);
  if (rows2.length > 64) fail("POLICY_DENIED");
  const agentPolicies = agent ? (await readTrustedAgentPolicyVersion(ctx, reference, agent)).policies : [];
  const selected = [
    ...manifest.policies.filter((policy) => policy.scope === "deployment" && (!policy.operationKey || policy.operationKey === key)),
    ...agentPolicies.filter((policy) => !policy.operationKey || policy.operationKey === key)
  ];
  for (const row of rows2) {
    if (row.revokedAt !== void 0 || canonical(row.root) !== canonical(root) || !row.actorReference) fail("POLICY_DENIED");
    await recheckAuthority(ctx, row.actorReference, { capability: "admin", tenantId: reference.tenantId, memorySpaceId: row.actorReference.memorySpaceId });
    const parsed = tenantPolicySchema.safeParse(decode(row.canonical));
    if (!parsed.success || parsed.data.policyId !== row.policyId || parsed.data.version !== row.version || parsed.data.tenantId !== reference.tenantId) fail("POLICY_DENIED");
    if (parsed.data.override) {
      const expected = await semanticHash(canonical([row.actorReference, parsed.data.policyId, parsed.data.version]));
      if (parsed.data.override.actorPrincipalId !== row.actorReference.principalId || parsed.data.override.changeRevision !== parsed.data.version || parsed.data.override.authorizationId !== expected) fail("POLICY_DENIED");
    }
    if (!parsed.data.operationKey || parsed.data.operationKey === key) selected.push(parsed.data);
  }
  return selected;
}
function resolutionContext(reference, key, runBudgetId, source, parentOperationId, agent) {
  return {
    scope: memoryScope(reference),
    operationKey: key,
    runBudgetId,
    authorizedOverrides: [],
    ...agent ? { agent } : {},
    ...source ? { source: { sourceId: source.sourceId, sourceEventId: source.sourceEventId, sourceRevision: source.sourceRevision } } : {},
    ...parentOperationId ? { parentOperationId } : {},
    ...key.startsWith("embedding.") ? { semanticProfile: DEFAULT_EMBEDDING_PROFILE } : {}
  };
}
async function resolveCurrent(ctx, reference, key, runBudgetId, source, parentOperationId, agent) {
  const { manifest, root } = await activeRoot(ctx);
  const records = await policies(ctx, manifest, root, reference, key, agent);
  const context = resolutionContext(reference, key, runBudgetId, source, parentOperationId, agent);
  context.authorizedOverrides = records.flatMap((record) => record.override ? [{ ...record.override, policyId: record.policyId, policyVersion: record.version }] : []);
  const resolution = { context, policies: records, qualifications: manifest.qualifications };
  const snapshot2 = resolveModelPolicy2(resolution);
  return { root, manifest, resolutionCanonical: canonical(resolution), snapshot: snapshot2 };
}
function snapshotOf(record) {
  const snapshot2 = resolveModelPolicy2(decode(record.resolutionCanonical));
  if (canonical(snapshot2) !== record.snapshotCanonical) fail("POLICY_DENIED");
  return snapshot2;
}
async function currentOperation(ctx, reference, operation, permitCancelled = false) {
  if (!sameAuthority(reference, operation.reference)) fail("FORBIDDEN");
  await currentAuthority(ctx, reference, operation.operationKey);
  await checkSource(ctx, reference, operation.operationKey, operation.source);
  if (operation.cancelled && !permitCancelled) fail("RUN_CANCELLED");
  const run = await ctx.db.get("runtimeBudgetAccounts", operation.runAccountId);
  if (!run || !run.reference || !sameAuthority(run.reference, reference) || run.tenantId !== reference.tenantId || run.cancelled && !permitCancelled) fail("FORBIDDEN");
  let parentId = operation.parentOperationId;
  const visited = /* @__PURE__ */ new Set([operation._id]);
  while (parentId) {
    if (visited.has(parentId) || visited.size > 16) fail("FORBIDDEN");
    visited.add(parentId);
    const parent = await ctx.db.get("runtimeModelOperations", parentId);
    if (!parent || !sameAuthority(reference, parent.reference) || parent.runAccountId !== operation.runAccountId || parent.cancelled) fail("FORBIDDEN");
    await currentAuthority(ctx, reference, parent.operationKey);
    await checkSource(ctx, reference, parent.operationKey, parent.source);
    parentId = parent.parentOperationId;
  }
  const snapshot2 = snapshotOf(operation);
  const current = await resolveCurrent(ctx, reference, operation.operationKey, run.runBudgetId, operation.source, operation.parentOperationId, run.agentId ? { agentId: run.agentId, version: run.agentVersion } : void 0);
  if (!current.snapshot.allowedModels.includes(snapshot2.modelId) || !snapshot2.capabilities.every((cap) => current.snapshot.capabilities.includes(cap)) || !current.manifest.qualifications.some((q) => q.receiptId === snapshot2.qualificationReceiptId && q.modelId === snapshot2.modelId && q.nativeInterface === snapshot2.nativeInterface && q.priceRevision === snapshot2.pins.priceRevision && q.boundRevision === snapshot2.pins.boundRevision)) fail("POLICY_DENIED");
  return { snapshot: snapshot2, run, current };
}
function balanced(account) {
  [account.limitUnits, account.reservedUnits, account.settledUnits, account.uncertainUnits, account.activeConcurrency, account.concurrencyLimit, account.version].forEach((value) => integer2(value));
  add(account.reservedUnits, account.settledUnits, account.uncertainUnits);
}
function capacity(account, ceiling, limit = account.limitUnits, concurrency = account.concurrencyLimit) {
  balanced(account);
  if (!account.current || account.cancelled || account.overrun || Date.now() < account.windowStart || Date.now() >= account.windowEnd || add(account.reservedUnits, account.settledUnits, account.uncertainUnits, ceiling) > Math.min(account.limitUnits, integer2(limit, 1)) || account.activeConcurrency >= Math.min(account.concurrencyLimit, integer2(concurrency, 1))) fail("BUDGET_EXCEEDED");
}
function heldCapacity(account, limit, concurrency) {
  balanced(account);
  if (!account.current || account.cancelled || account.overrun || Date.now() < account.windowStart || Date.now() >= account.windowEnd || add(account.reservedUnits, account.settledUnits, account.uncertainUnits) > Math.min(account.limitUnits, integer2(limit, 1)) || account.activeConcurrency > Math.min(account.concurrencyLimit, integer2(concurrency, 1))) fail("BUDGET_EXCEEDED");
}
var bindingArgs = { reference: runtimeAuthorityReference, operationKey: modelOperationKey, requestId: v5.string(), requestCanonical: v5.string(), agentId: v5.optional(v5.string()), agentVersion: v5.optional(v5.number()) };
async function bindTrustedBudget(ctx, args) {
  await currentAuthority(ctx, args.reference, args.operationKey);
  text(args.requestId);
  decode(args.requestCanonical);
  const bindingKey = canonical(["run", args.reference.tenantId, args.reference.memorySpaceId, args.reference.principalId, args.operationKey, args.requestId]);
  const runBudgetId = await semanticHash(bindingKey);
  const existing = single(await ctx.db.query("runtimeBudgetAccounts").withIndex("by_run", (q) => q.eq("runBudgetId", runBudgetId)).take(2));
  if (existing) {
    if (!existing.reference || !sameAuthority(existing.reference, args.reference) || existing.scopeKey !== bindingKey || existing.requestCanonical !== args.requestCanonical || existing.agentId !== args.agentId || existing.agentVersion !== args.agentVersion) fail("IDEMPOTENCY_CONFLICT");
    return { runBudgetId, runAccountId: existing._id };
  }
  if (args.agentId === void 0 !== (args.agentVersion === void 0)) fail("INVALID_INPUT");
  if (args.agentId) {
    text(args.agentId);
    integer2(args.agentVersion, 1);
  }
  const agent = args.agentId ? { agentId: args.agentId, version: args.agentVersion } : void 0;
  const resolved = await resolveCurrent(ctx, args.reference, args.operationKey, runBudgetId, void 0, void 0, agent);
  const now = integer2(Date.now());
  const start = Math.floor(now / resolved.manifest.budgetWindowMs) * resolved.manifest.budgetWindowMs;
  const end = add(start, resolved.manifest.budgetWindowMs);
  const tenantScope = canonical(["tenant", args.reference.tenantId]);
  let tenant2 = single(await ctx.db.query("runtimeBudgetAccounts").withIndex("by_scope_current", (q) => q.eq("scopeKey", tenantScope).eq("current", true)).take(2));
  if (tenant2 && (tenant2.windowEnd <= now || canonical(tenant2.root) !== canonical(resolved.root))) {
    balanced(tenant2);
    if (tenant2.reservedUnits || tenant2.uncertainUnits || tenant2.activeConcurrency || tenant2.overrun) fail("BUDGET_EXCEEDED");
    if (tenant2.windowEnd > now) fail("POLICY_DENIED");
    await ctx.db.patch("runtimeBudgetAccounts", tenant2._id, { current: false, version: add(tenant2.version, 1) });
    tenant2 = void 0;
  }
  await finalActor(ctx, args.reference, args.operationKey);
  const counters = { reservedUnits: 0, settledUnits: 0, uncertainUnits: 0, activeConcurrency: 0, overrun: false, current: true, cancelled: false, version: 1, createdAt: now };
  const window = { windowId: canonical([args.reference.tenantId, start, end]), windowStart: start, windowEnd: end, currency: "USD", monetaryUnit: "micro-USD", root: resolved.root };
  if (!tenant2) await ctx.db.insert("runtimeBudgetAccounts", {
    accountKey: await semanticHash(canonical([tenantScope, start, end])),
    scopeKey: tenantScope,
    kind: "tenant",
    tenantId: args.reference.tenantId,
    ...window,
    ...counters,
    limitUnits: resolved.snapshot.limits.tenantBudgetUnits,
    concurrencyLimit: resolved.snapshot.limits.concurrency
  });
  else if (tenant2.limitUnits !== resolved.snapshot.limits.tenantBudgetUnits || tenant2.concurrencyLimit !== resolved.snapshot.limits.concurrency) {
    await ctx.db.patch("runtimeBudgetAccounts", tenant2._id, {
      limitUnits: Math.min(tenant2.limitUnits, resolved.snapshot.limits.tenantBudgetUnits),
      concurrencyLimit: Math.min(tenant2.concurrencyLimit, resolved.snapshot.limits.concurrency),
      version: add(tenant2.version, 1)
    });
  }
  const runAccountId = await ctx.db.insert("runtimeBudgetAccounts", {
    accountKey: runBudgetId,
    scopeKey: bindingKey,
    kind: "run",
    tenantId: args.reference.tenantId,
    runBudgetId,
    reference: args.reference,
    requestCanonical: args.requestCanonical,
    ...agent ? { agentId: agent.agentId, agentVersion: agent.version } : {},
    ...window,
    ...counters,
    limitUnits: resolved.snapshot.limits.runBudgetUnits,
    concurrencyLimit: resolved.snapshot.limits.concurrency
  });
  return { runBudgetId, runAccountId };
}
var ensureBudget = internalMutation({ args: bindingArgs, handler: bindTrustedBudget });
var installDeploymentPolicy = internalMutation({ args: { manifestId: v5.string(), expectedRevision: v5.number() }, handler: async (ctx, args) => {
  text(args.manifestId);
  integer2(args.expectedRevision, 1);
  const manifest = lookupDeploymentManifest(args.manifestId, args.expectedRevision);
  validManifest(manifest);
  if (manifest.dispatchEvidence.some((proof) => proof.checkedAt > Date.now() || Date.now() >= proof.expiresAt)) fail("CAPABILITY_UNAVAILABLE");
  const root = await provenance(manifest);
  const old = await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", (q) => q.eq("scope", "deployment").eq("tenantId", void 0).eq("active", true)).take(65);
  if (old.length > 64) fail("POLICY_DENIED");
  const previous = old[0]?.root;
  if (previous && canonical(previous) !== canonical(root) && args.expectedRevision <= previous.revision) fail("IDEMPOTENCY_CONFLICT");
  const proofScope = {
    tenantId: "bootstrap-validation",
    memorySpaceId: "bootstrap-validation",
    principalId: "bootstrap-validation",
    principalVersion: 1,
    membershipId: "bootstrap-validation",
    membershipVersion: 1,
    grantId: "bootstrap-validation",
    grantVersion: 1,
    tenantEpoch: 1,
    memorySpaceEpoch: 1
  };
  for (const qualification of manifest.qualifications) {
    const key = qualification.nativeInterface === "embedding" ? "embedding.query" : "agent.respond";
    resolveModelPolicy2({ context: {
      scope: proofScope,
      operationKey: key,
      runBudgetId: "bootstrap-validation",
      authorizedOverrides: [],
      ...key.startsWith("embedding.") ? { semanticProfile: DEFAULT_EMBEDDING_PROFILE } : {}
    }, policies: manifest.policies.filter((p) => p.scope === "deployment" && (!p.operationKey || p.operationKey === key)), qualifications: manifest.qualifications });
  }
  for (const row of old) if (canonical(row.root) !== canonical(root)) await ctx.db.patch("runtimeModelPolicies", row._id, { active: false });
  for (const policy of manifest.policies) {
    const existing = single(await ctx.db.query("runtimeModelPolicies").withIndex("by_policy_version", (q) => q.eq("policyId", policy.policyId).eq("version", policy.version)).take(2));
    if (existing) {
      if (existing.canonical !== canonical(policy) || canonical(existing.root) !== canonical(root) || existing.revokedAt !== void 0) fail("IDEMPOTENCY_CONFLICT");
      if (!existing.active) await ctx.db.patch("runtimeModelPolicies", existing._id, { active: true });
    } else await ctx.db.insert("runtimeModelPolicies", {
      policyId: policy.policyId,
      version: policy.version,
      scope: policy.scope === "agent" ? "agent" : "deployment",
      ...policy.scope === "agent" ? { tenantId: policy.tenantId, agentId: policy.agentId, agentVersion: policy.agentVersion } : {},
      ...policy.operationKey ? { operationKey: policy.operationKey } : {},
      canonical: canonical(policy),
      root,
      active: true,
      createdAt: Date.now()
    });
  }
  for (const qualification of manifest.qualifications) {
    const existing = single(await ctx.db.query("runtimeModelQualifications").withIndex("by_receipt", (q) => q.eq("receiptId", qualification.receiptId).eq("version", root.revision)).take(2));
    if (existing) {
      if (existing.canonical !== canonical(qualification) || canonical(existing.root) !== canonical(root) || existing.revokedAt !== void 0) fail("IDEMPOTENCY_CONFLICT");
    } else await ctx.db.insert("runtimeModelQualifications", { receiptId: qualification.receiptId, version: root.revision, canonical: canonical(qualification), root, active: true, createdAt: Date.now() });
  }
  return { manifestId: manifest.manifestId, revision: manifest.revision };
} });
var provisionTenantPolicy = internalMutation({ args: { reference: runtimeAuthorityReference, policyCanonical: v5.string(), overrideRequested: v5.optional(v5.boolean()) }, handler: async (ctx, args) => {
  const authority = await recheckAuthority(ctx, args.reference, { capability: "admin", tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId });
  if (authority.resourceAccess !== "tenant" || args.reference.memorySpaceId !== void 0) fail("FORBIDDEN");
  const parsed = tenantPolicySchema.safeParse(decode(args.policyCanonical));
  if (!parsed.success || parsed.data.tenantId !== args.reference.tenantId) fail("POLICY_DENIED");
  if (parsed.data.override) fail("POLICY_DENIED");
  const policy = { ...parsed.data, ...args.overrideRequested ? { override: {
    actorPrincipalId: authority.principalId,
    changeRevision: parsed.data.version,
    authorizationId: await semanticHash(canonical([args.reference, parsed.data.policyId, parsed.data.version]))
  } } : {} };
  const policyCanonical = canonical(policy);
  const { manifest, root } = await activeRoot(ctx);
  const hard = manifest.policies.find((entry) => entry.scope === "deployment" && !entry.operationKey);
  if (!hard) fail("POLICY_DENIED");
  const rules = policy.rules;
  for (const key of MODEL_LIMIT_KEYS) if (rules.limits?.[key] !== void 0 && rules.limits[key] > (hard.rules.limits?.[key] ?? 0)) fail("POLICY_DENIED");
  for (const key of ["allowedModels", "interfaces", "capabilities", "allowedOptions", "allowedTools", "fallbackModels"]) {
    const baseline = hard.rules[key] ?? [];
    if (rules[key]?.some((entry) => !baseline.includes(entry))) fail("POLICY_DENIED");
  }
  if (rules.modelId && !hard.rules.allowedModels?.includes(rules.modelId)) fail("POLICY_DENIED");
  if (rules.nativeInterface && !hard.rules.interfaces?.includes(rules.nativeInterface)) fail("POLICY_DENIED");
  if (rules.pins && Object.entries(rules.pins).some(([key, value]) => value !== hard.rules.pins?.[key])) fail("POLICY_DENIED");
  const sameId = single(await ctx.db.query("runtimeModelPolicies").withIndex("by_policy_version", (q) => q.eq("policyId", policy.policyId).eq("version", policy.version)).take(2));
  if (sameId) {
    if (sameId.scope !== "tenant" || sameId.tenantId !== args.reference.tenantId || sameId.canonical !== policyCanonical || !sameId.actorReference || !sameAuthority(sameId.actorReference, args.reference) || sameId.revokedAt !== void 0) fail("IDEMPOTENCY_CONFLICT");
    return { policyId: policy.policyId, version: policy.version };
  }
  const old = await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", (q) => q.eq("scope", "tenant").eq("tenantId", args.reference.tenantId).eq("active", true)).take(65);
  if (old.length > 64) fail("POLICY_DENIED");
  for (const row of old.filter((entry) => entry.operationKey === policy.operationKey)) {
    if (policy.version <= row.version || row.policyId !== policy.policyId) fail("IDEMPOTENCY_CONFLICT");
    await ctx.db.patch("runtimeModelPolicies", row._id, { active: false });
  }
  await recheckAuthority(ctx, args.reference, { capability: "admin", tenantId: args.reference.tenantId });
  await ctx.db.insert("runtimeModelPolicies", {
    policyId: policy.policyId,
    version: policy.version,
    scope: "tenant",
    tenantId: policy.tenantId,
    ...policy.operationKey ? { operationKey: policy.operationKey } : {},
    canonical: policyCanonical,
    root,
    actorReference: args.reference,
    active: true,
    createdAt: Date.now()
  });
  return { policyId: policy.policyId, version: policy.version };
} });
async function runAccount(ctx, reference, runBudgetId) {
  const run = single(await ctx.db.query("runtimeBudgetAccounts").withIndex("by_run", (q) => q.eq("runBudgetId", runBudgetId)).take(2));
  if (!run || run.kind !== "run" || !run.reference || !sameAuthority(run.reference, reference) || run.tenantId !== reference.tenantId) fail("FORBIDDEN");
  return run;
}
var resolveArgs = { reference: runtimeAuthorityReference, operationKey: modelOperationKey, runBudgetId: v5.string(), source: v5.optional(modelSource) };
var resolve = internalQuery({ args: resolveArgs, handler: async (ctx, args) => {
  await currentAuthority(ctx, args.reference, args.operationKey);
  const run = await runAccount(ctx, args.reference, args.runBudgetId);
  await checkSource(ctx, args.reference, args.operationKey, args.source);
  const resolved = await resolveCurrent(ctx, args.reference, args.operationKey, args.runBudgetId, args.source, void 0, run.agentId ? { agentId: run.agentId, version: run.agentVersion } : void 0);
  return { snapshot: resolved.snapshot, dispatchEvidence: evidence(resolved.manifest, resolved.snapshot), storageLimits: MODEL_LEDGER_STORAGE_LIMITS };
} });
function deriveQualifiedInputBound(proof, request) {
  if (request.outputTokens > proof.resultBound.maximumOutputTokens || proof.nativeInterface === "embedding" && request.texts.length > proof.resultBound.maximumEmbeddingValues) fail("POLICY_DENIED");
  const bytes = (value) => {
    for (const point of value) {
      const code = point.codePointAt(0);
      if (code >= 55296 && code <= 57343) fail("INVALID_INPUT");
    }
    return new TextEncoder().encode(value).length;
  };
  if (proof.inputBound.ruleId === "default-embedding-utf8-v1" && proof.inputBound.featureEnvelope === "default-embedding-v1" && proof.nativeInterface === "embedding") {
    if (request.texts.length > 512) fail("POLICY_DENIED");
    const counts = request.texts.map(bytes);
    if (counts.some((n) => n > 8192) || add(...counts) > 3e5) fail("POLICY_DENIED");
    return add(...counts);
  }
  if (proof.inputBound.ruleId !== "plain-chat-cookbook-utf8-v1" || proof.inputBound.featureEnvelope !== "plain-chat-v1" || proof.nativeInterface !== "chat" || !request.messages || request.tools.length || request.outputSchema || request.options.providerOptions) fail("CAPABILITY_UNAVAILABLE");
  let bound = 3;
  for (const message of request.messages) {
    const part = message.parts[0];
    if (message.role === "tool" || message.parts.length !== 1 || !part || part.type !== "text") fail("CAPABILITY_UNAVAILABLE");
    bound = add(bound, 3, bytes(message.role), bytes(part.text));
  }
  return integer2(bound, 1);
}
var admitArgs = { ...resolveArgs, semanticId: v5.string(), ordinal: v5.number(), requestCanonical: v5.string(), parentOperationId: v5.optional(v5.id("runtimeModelOperations")) };
var _admissionValidator = v5.object(admitArgs);
var admit = internalMutation({ args: admitArgs, handler: async (ctx, args) => {
  await currentAuthority(ctx, args.reference, args.operationKey);
  integer2(args.ordinal);
  text(args.semanticId);
  await checkSource(ctx, args.reference, args.operationKey, args.source);
  const run = await runAccount(ctx, args.reference, args.runBudgetId);
  if (args.parentOperationId) {
    const parent = await ctx.db.get("runtimeModelOperations", args.parentOperationId);
    if (!parent || parent.runAccountId !== run._id) fail("FORBIDDEN");
    await currentOperation(ctx, args.reference, parent);
  }
  let operation = single(await ctx.db.query("runtimeModelOperations").withIndex("by_identity", (q) => q.eq("tenantId", args.reference.tenantId).eq("memorySpaceId", args.reference.memorySpaceId).eq("principalId", args.reference.principalId).eq("semanticId", args.semanticId).eq("operationKey", args.operationKey)).take(2));
  const binding = canonical({
    reference: args.reference,
    operationKey: args.operationKey,
    semanticId: args.semanticId,
    runAccountId: run._id,
    ...args.source ? { source: args.source } : {},
    ...args.parentOperationId ? { parentOperationId: args.parentOperationId } : {}
  });
  const bindingHash = await semanticHash(binding);
  const resolved = operation ? { ...await currentOperation(ctx, args.reference, operation), resolutionCanonical: operation.resolutionCanonical } : await resolveCurrent(ctx, args.reference, args.operationKey, args.runBudgetId, args.source, args.parentOperationId, run.agentId ? { agentId: run.agentId, version: run.agentVersion } : void 0);
  if (operation) assertModelRequestIdentity2({ canonical: operation.identityCanonical, hash: operation.identityHash }, { canonical: binding, hash: bindingHash });
  const snapshot2 = resolved.snapshot;
  const effectiveSnapshot = "current" in resolved ? resolved.current.snapshot : snapshot2;
  const root = "root" in resolved ? resolved.root : run.root;
  const manifest = await trustedRoot(root);
  const proof = evidence(manifest, snapshot2);
  const raw = decode(args.requestCanonical);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("INVALID_INPUT");
  const request = raw;
  const childCallId = await semanticHash(canonical([bindingHash, args.ordinal]));
  const preliminary = validateModelRequest2(snapshot2, { ...request, semanticId: args.semanticId, childCallId, inputTokens: 1, reservationUnits: snapshot2.costBound.maximumCostUnits });
  const bounded = { ...preliminary.request, inputTokens: deriveQualifiedInputBound(proof, preliminary.request) };
  const validated = validateModelRequest2(snapshot2, bounded);
  validateModelRequest2({ ...snapshot2, limits: effectiveSnapshot.limits, allowedOptions: effectiveSnapshot.allowedOptions, allowedTools: effectiveSnapshot.allowedTools }, validated.request);
  if (args.operationKey === "agent.respond" && args.ordinal > snapshot2.limits.toolSteps || validated.request.batch && validated.request.batch.ordinal !== args.ordinal) fail("POLICY_DENIED");
  const requestHash = await semanticHash(validated.canonical);
  if (operation) {
    const attempts = await ctx.db.query("runtimeModelAttempts").withIndex("by_child_attempt", (q) => q.eq("operationDocumentId", operation._id).eq("childCallId", childCallId)).take(65);
    if (attempts.length > 64 || new Set(attempts.map((entry) => entry.attemptNumber)).size !== attempts.length) fail("POLICY_DENIED");
    const existing = attempts.sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
    if (existing) {
      const priorSnapshot = attemptSnapshot(existing, operation, manifest);
      const incoming = validateModelRequest2(priorSnapshot, { ...validated.request, inputTokens: deriveQualifiedInputBound(evidence(manifest, priorSnapshot), validated.request), reservationUnits: priorSnapshot.costBound.maximumCostUnits });
      assertModelRequestIdentity2({ canonical: existing.canonical, hash: existing.hash }, { canonical: incoming.canonical, hash: await semanticHash(incoming.canonical) });
      if (existing.state === "settled" && existing.privateResultCanonical && !existing.resultWithheld) return { status: "replay", operationId: operation._id, resultCanonical: existing.privateResultCanonical };
      if (existing.state === "settled" || existing.state === "confirmed_rejected" || existing.state === "not_dispatched") fail("CAPABILITY_UNAVAILABLE");
      if (existing.state === "uncertain" || existing.state === "dispatch_pending") return { status: "uncertain", operationId: operation._id, attemptId: existing._id, replayAllowed: false };
      return { status: "inflight", operationId: operation._id, attemptId: existing._id };
    }
  }
  const tenant2 = single(await ctx.db.query("runtimeBudgetAccounts").withIndex("by_scope_current", (q) => q.eq("scopeKey", canonical(["tenant", args.reference.tenantId])).eq("current", true)).take(2));
  if (!tenant2 || tenant2.windowId !== run.windowId || canonical(tenant2.root) !== canonical(root)) fail("BUDGET_EXCEEDED");
  const ceiling = snapshot2.costBound.maximumCostUnits;
  capacity(tenant2, ceiling, effectiveSnapshot.limits.tenantBudgetUnits, effectiveSnapshot.limits.concurrency);
  capacity(run, ceiling, effectiveSnapshot.limits.runBudgetUnits, effectiveSnapshot.limits.concurrency);
  if (operation && (operation.overrun || operation.cancelled || add(operation.reservedUnits, operation.settledUnits, operation.uncertainUnits, ceiling) > Math.min(snapshot2.limits.operationBudgetUnits, effectiveSnapshot.limits.operationBudgetUnits))) fail("BUDGET_EXCEEDED");
  await finalActor(ctx, args.reference, args.operationKey);
  if (proof.checkedAt > Date.now() || Date.now() >= proof.expiresAt) fail("CAPABILITY_UNAVAILABLE");
  if (!operation) {
    const operationDocumentId = await ctx.db.insert("runtimeModelOperations", {
      operationId: bindingHash,
      reference: args.reference,
      tenantId: args.reference.tenantId,
      memorySpaceId: args.reference.memorySpaceId,
      principalId: args.reference.principalId,
      semanticId: args.semanticId,
      operationKey: args.operationKey,
      runAccountId: run._id,
      ...args.source ? { source: args.source } : {},
      ...args.parentOperationId ? { parentOperationId: args.parentOperationId } : {},
      resolutionCanonical: resolved.resolutionCanonical,
      snapshotCanonical: canonical(snapshot2),
      identityCanonical: binding,
      identityHash: bindingHash,
      reservedUnits: 0,
      settledUnits: 0,
      uncertainUnits: 0,
      overrun: false,
      cancelled: false,
      createdAt: Date.now()
    });
    operation = await ctx.db.get("runtimeModelOperations", operationDocumentId);
  }
  const attemptId = await ctx.db.insert("runtimeModelAttempts", {
    operationDocumentId: operation._id,
    childCallId,
    ordinal: args.ordinal,
    attemptNumber: 1,
    canonical: validated.canonical,
    hash: requestHash,
    resolutionCanonical: resolved.resolutionCanonical,
    snapshotCanonical: canonical(snapshot2),
    inputProofCanonical: canonical({ proof, requestCanonical: canonical(validated.request), inputTokens: validated.request.inputTokens, outputTokens: validated.request.outputTokens }),
    measuredInputTokens: validated.request.inputTokens,
    maximumOutputTokens: validated.request.outputTokens,
    tenantAccountId: tenant2._id,
    runAccountId: run._id,
    reservationUnits: ceiling,
    state: "reserved",
    dispatchIdentity: await semanticHash(canonical([bindingHash, childCallId, 1])),
    slotReleased: false,
    outputVisible: false,
    toolInputVisible: false,
    toolResultVisible: false,
    toolEffectCommitted: false,
    resultWithheld: false,
    createdAt: Date.now()
  });
  for (const account of [tenant2, run]) await ctx.db.patch(
    "runtimeBudgetAccounts",
    account._id,
    { reservedUnits: add(account.reservedUnits, ceiling), activeConcurrency: add(account.activeConcurrency, 1), version: add(account.version, 1) }
  );
  await ctx.db.patch("runtimeModelOperations", operation._id, { reservedUnits: add(operation.reservedUnits, ceiling) });
  return { status: "reserved", operationId: operation._id, attemptId, snapshot: snapshot2, requestCanonical: canonical(validated.request) };
} });
function attemptSnapshot(attempt, operation, manifest) {
  const base = snapshotOf(operation);
  if (attempt.resolutionCanonical !== operation.resolutionCanonical) fail("POLICY_DENIED");
  let snapshot2 = base;
  if (attempt.fallbackModelId) {
    if (!attempt.priorAttemptId || !base.fallbackCandidates.some((candidate) => candidate.modelId === attempt.fallbackModelId)) fail("POLICY_DENIED");
    const qualification = single(manifest.qualifications.filter((entry) => entry.modelId === attempt.fallbackModelId && entry.nativeInterface === base.nativeInterface && base.fallbackCandidates.some((candidate) => candidate.qualificationReceiptId === entry.receiptId)));
    if (!qualification) fail("CAPABILITY_UNAVAILABLE");
    snapshot2 = { ...base, modelId: qualification.modelId, qualificationReceiptId: qualification.receiptId, costBound: qualification.costBound };
  } else if (attempt.priorAttemptId) fail("POLICY_DENIED");
  if (canonical(snapshot2) !== attempt.snapshotCanonical || snapshot2.costBound.maximumCostUnits !== attempt.reservationUnits) fail("POLICY_DENIED");
  return snapshot2;
}
async function attemptContext(ctx, attemptId) {
  const attempt = await ctx.db.get("runtimeModelAttempts", attemptId);
  if (!attempt) fail("FORBIDDEN");
  const operation = await ctx.db.get("runtimeModelOperations", attempt.operationDocumentId);
  const tenant2 = await ctx.db.get("runtimeBudgetAccounts", attempt.tenantAccountId);
  const run = await ctx.db.get("runtimeBudgetAccounts", attempt.runAccountId);
  if (!operation || !tenant2 || !run || run._id !== operation.runAccountId || tenant2.tenantId !== operation.tenantId || run.tenantId !== operation.tenantId || tenant2.windowId !== run.windowId || tenant2.kind !== "tenant" || run.kind !== "run") fail("FORBIDDEN");
  balanced(tenant2);
  balanced(run);
  integer2(attempt.reservationUnits, 1);
  if (!run.reference || !sameAuthority(run.reference, operation.reference)) fail("POLICY_DENIED");
  const manifest = await trustedRoot(run.root);
  const snapshot2 = attemptSnapshot(attempt, operation, manifest);
  const proof = evidence(manifest, snapshot2);
  return { attempt, operation, tenant: tenant2, run, snapshot: snapshot2, proof };
}
var attemptArgs = { reference: runtimeAuthorityReference, attemptId: v5.id("runtimeModelAttempts") };
var checkpoint = internalMutation({ args: { ...attemptArgs, requestCanonical: v5.string() }, handler: async (ctx, args) => {
  const { attempt, operation, snapshot: snapshot2, proof, run, tenant: tenant2 } = await attemptContext(ctx, args.attemptId);
  const checked = await currentOperation(ctx, args.reference, operation);
  if (Date.now() >= run.windowEnd) fail("BUDGET_EXCEEDED");
  if (!checked.current.snapshot.allowedModels.includes(snapshot2.modelId) || checked.current.snapshot.nativeInterface !== snapshot2.nativeInterface || !checked.current.manifest.qualifications.some((q) => q.receiptId === snapshot2.qualificationReceiptId && q.modelId === snapshot2.modelId && q.nativeInterface === snapshot2.nativeInterface && q.priceRevision === snapshot2.pins.priceRevision && q.boundRevision === snapshot2.pins.boundRevision)) fail("POLICY_DENIED");
  const raw = decode(args.requestCanonical);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("INVALID_INPUT");
  const request = raw;
  if (request.semanticId !== operation.semanticId || request.childCallId !== attempt.childCallId || request.inputTokens !== deriveQualifiedInputBound(proof, validateModelRequest2(snapshot2, request).request) || request.reservationUnits !== attempt.reservationUnits) fail("IDEMPOTENCY_CONFLICT");
  const validated = validateModelRequest2(snapshot2, request);
  validateModelRequest2({ ...snapshot2, limits: checked.current.snapshot.limits, allowedOptions: checked.current.snapshot.allowedOptions, allowedTools: checked.current.snapshot.allowedTools }, validated.request);
  if (attempt.measuredInputTokens !== validated.request.inputTokens || attempt.maximumOutputTokens !== validated.request.outputTokens || attempt.inputProofCanonical !== canonical({ proof, requestCanonical: canonical(validated.request), inputTokens: validated.request.inputTokens, outputTokens: validated.request.outputTokens })) fail("POLICY_DENIED");
  assertModelRequestIdentity2({ canonical: attempt.canonical, hash: attempt.hash }, { canonical: validated.canonical, hash: await semanticHash(validated.canonical) });
  if (attempt.state !== "reserved") return { dispatchPermit: false, state: attempt.state, replayAllowed: false };
  const pinned = snapshotOf(operation).limits;
  const current = checked.current.snapshot.limits;
  if (operation.overrun || add(operation.reservedUnits, operation.uncertainUnits, operation.settledUnits) > Math.min(pinned.operationBudgetUnits, current.operationBudgetUnits)) fail("BUDGET_EXCEEDED");
  heldCapacity(tenant2, Math.min(pinned.tenantBudgetUnits, current.tenantBudgetUnits), Math.min(pinned.concurrency, current.concurrency));
  heldCapacity(run, Math.min(pinned.runBudgetUnits, current.runBudgetUnits), Math.min(pinned.concurrency, current.concurrency));
  if (attempt.fallbackModelId) {
    const prior = await attemptContext(ctx, attempt.priorAttemptId);
    if (prior.operation._id !== operation._id || prior.attempt.childCallId !== attempt.childCallId || !fallbackAllowed(prior.attempt, operation, prior.snapshot, attempt.fallbackModelId) || !fallbackAllowed(prior.attempt, operation, checked.current.snapshot, attempt.fallbackModelId)) fail("POLICY_DENIED");
  }
  await finalActor(ctx, args.reference, operation.operationKey);
  if (proof.checkedAt > Date.now() || Date.now() >= proof.expiresAt) fail("CAPABILITY_UNAVAILABLE");
  await ctx.db.patch("runtimeModelAttempts", attempt._id, { state: "dispatch_pending", checkpointAt: Date.now() });
  return { dispatchPermit: true, dispatchIdentity: attempt.dispatchIdentity, snapshot: snapshot2, requestCanonical: canonical(validated.request) };
} });
var markVisible = internalMutation({ args: { ...attemptArgs, ...visibilityFields }, handler: async (ctx, args) => {
  const { attempt, operation } = await attemptContext(ctx, args.attemptId);
  await currentOperation(ctx, args.reference, operation);
  if (attempt.state !== "dispatch_pending" && attempt.state !== "uncertain") fail("POLICY_DENIED");
  await ctx.db.patch("runtimeModelAttempts", attempt._id, {
    outputVisible: attempt.outputVisible || args.outputVisible,
    toolInputVisible: attempt.toolInputVisible || args.toolInputVisible,
    toolResultVisible: attempt.toolResultVisible || args.toolResultVisible,
    toolEffectCommitted: attempt.toolEffectCommitted || args.toolEffectCommitted
  });
  return { recorded: true };
} });
var receiptSchema = z2.object({
  version: z2.literal(1),
  dispatchIdentity: z2.string(),
  receiptId: z2.string().min(1),
  modelId: z2.string(),
  nativeInterface: nativeInterface2,
  outcome: z2.enum(["confirmed", "confirmed_rejected"]),
  proof: z2.literal("provider-terminal-v1"),
  costSource: z2.enum(["gateway-aggregate-usd-v1", "unavailable"]),
  aggregateCostUsd: z2.string().regex(/^\d+(?:\.\d+)?$/).optional(),
  usage: z2.object({ inputTokens: count.optional(), outputTokens: count.optional(), totalTokens: count.optional(), cachedInputTokens: count.optional(), reasoningTokens: count.optional() }).strict().optional(),
  actualModel: z2.string().optional(),
  privateResultCanonical: z2.string().optional()
}).strict();
function costMicroUnits(usd) {
  if (!/^\d+(?:\.\d+)?$/.test(usd) || usd.length > 80) fail("INVALID_INPUT");
  const [whole, fractional = ""] = usd.split(".");
  const scale = 10n ** BigInt(fractional.length);
  const numerator = BigInt(whole) * scale + BigInt(fractional || "0");
  const cost = (numerator * 1000000n + scale - 1n) / scale;
  if (cost > BigInt(Number.MAX_SAFE_INTEGER)) fail("INVALID_INPUT");
  return Number(cost);
}
async function permittedResult(ctx, reference, operation) {
  try {
    const checked = await currentOperation(ctx, reference, operation, true);
    return !operation.cancelled && !checked.run.cancelled;
  } catch {
    return false;
  }
}
async function writeUnknown(ctx, state, terminalCanonical) {
  const { attempt, operation, tenant: tenant2, run } = state;
  if (attempt.state === "settled" || attempt.state === "not_dispatched" || attempt.state === "confirmed_rejected") return { state: attempt.state, replayAllowed: false };
  if (attempt.state === "reserved") fail("POLICY_DENIED");
  const newlyUnknown = attempt.state !== "uncertain";
  const release = Boolean(terminalCanonical) && !attempt.slotReleased;
  for (const account of [tenant2, run]) await ctx.db.patch("runtimeBudgetAccounts", account._id, {
    reservedUnits: newlyUnknown ? subtract(account.reservedUnits, attempt.reservationUnits) : account.reservedUnits,
    uncertainUnits: newlyUnknown ? add(account.uncertainUnits, attempt.reservationUnits) : account.uncertainUnits,
    activeConcurrency: release ? subtract(account.activeConcurrency, 1) : account.activeConcurrency,
    version: add(account.version, 1)
  });
  await ctx.db.patch("runtimeModelOperations", operation._id, {
    reservedUnits: newlyUnknown ? subtract(operation.reservedUnits, attempt.reservationUnits) : operation.reservedUnits,
    uncertainUnits: newlyUnknown ? add(operation.uncertainUnits, attempt.reservationUnits) : operation.uncertainUnits
  });
  await ctx.db.patch("runtimeModelAttempts", attempt._id, {
    state: "uncertain",
    resultWithheld: true,
    slotReleased: attempt.slotReleased || release,
    ...terminalCanonical ? { terminalEvidenceCanonical: terminalCanonical } : {}
  });
  return { state: "uncertain", replayAllowed: false };
}
async function liabilityAuthority(ctx, reference, operation) {
  const authority = await recheckAuthority(ctx, reference, { capability: "admin", tenantId: operation.tenantId, memorySpaceId: operation.memorySpaceId });
  if (authority.resourceAccess === "own" && authority.principalId !== operation.principalId) fail("FORBIDDEN");
}
function validatedPrivateResult(snapshot2, attempt, encoded) {
  if (!encoded || new TextEncoder().encode(encoded).length > MODEL_LEDGER_STORAGE_LIMITS.privateResultBytes) return void 0;
  try {
    const result = decode(encoded);
    if (snapshot2.nativeInterface === "chat" && !snapshot2.semanticProfile) {
      if (!z2.object({ text: z2.string().min(1) }).strict().safeParse(result).success) return void 0;
    } else if (snapshot2.nativeInterface === "embedding" && snapshot2.semanticProfile) {
      const parsed = z2.object({
        profile: z2.object({ profileId: z2.string(), modelId: z2.string(), dimensions: count, normalization: z2.string(), chunking: z2.string(), indexName: z2.string() }).strict(),
        vectors: z2.array(z2.array(z2.number().finite()))
      }).strict().safeParse(result);
      if (!parsed.success) return void 0;
      assertProfileMatches(parsed.data.profile, snapshot2.semanticProfile);
      const original = decode(attempt.canonical);
      if (!original || typeof original !== "object" || Array.isArray(original)) return void 0;
      const request = validateModelRequest2(snapshot2, original.request).request;
      if (parsed.data.vectors.length !== request.texts.length) return void 0;
      parsed.data.vectors.forEach((vector) => assertEmbeddingVector(vector, snapshot2.semanticProfile));
    } else return void 0;
    return encoded;
  } catch {
    return void 0;
  }
}
async function settleAttempt(ctx, reference, attemptId, receiptCanonical, liabilityOnly, deploymentRetirement = false) {
  const state = await attemptContext(ctx, attemptId);
  const { attempt, operation, snapshot: snapshot2, proof, tenant: tenant2, run } = state;
  if (deploymentRetirement) await retiredScope(ctx, operation);
  else if (liabilityOnly) await liabilityAuthority(ctx, reference, operation);
  else if (!sameAuthority(reference, operation.reference)) fail("FORBIDDEN");
  const canDeliver = !liabilityOnly && await permittedResult(ctx, reference, operation);
  if (!liabilityOnly) await currentAuthority(ctx, reference, operation.operationKey);
  const parsed = receiptSchema.safeParse(decode(receiptCanonical));
  if (!parsed.success) return await writeUnknown(ctx, state);
  const receipt = parsed.data;
  if (receipt.dispatchIdentity !== attempt.dispatchIdentity || receipt.modelId !== snapshot2.modelId || receipt.nativeInterface !== snapshot2.nativeInterface) fail("IDEMPOTENCY_CONFLICT", "uncertain");
  const { privateResultCanonical: _privateResult, ...chargeReceipt } = receipt;
  const chargeCanonical = canonical(chargeReceipt);
  const receiptHash = await semanticHash(chargeCanonical);
  if (attempt.receiptCanonical) {
    assertModelRequestIdentity2({ canonical: attempt.receiptCanonical, hash: attempt.receiptHash }, { canonical: chargeCanonical, hash: receiptHash }, "uncertain");
    const candidateResult = canDeliver ? validatedPrivateResult(snapshot2, attempt, receipt.privateResultCanonical) : void 0;
    if (attempt.privateResultCanonical && candidateResult && attempt.privateResultCanonical !== candidateResult) fail("IDEMPOTENCY_CONFLICT");
    return { state: attempt.state, settledCostUnits: attempt.settledCostUnits, resultWithheld: attempt.resultWithheld || !canDeliver };
  }
  if (attempt.state !== "dispatch_pending" && attempt.state !== "uncertain") fail("POLICY_DENIED");
  if (proof.terminalCost !== "gateway-aggregate-usd-v1" || receipt.costSource !== proof.terminalCost || receipt.aggregateCostUsd === void 0) return await writeUnknown(ctx, state, chargeCanonical);
  let cost;
  try {
    cost = costMicroUnits(receipt.aggregateCostUsd);
  } catch {
    return await writeUnknown(ctx, state, chargeCanonical);
  }
  const privateResult = canDeliver && receipt.outcome === "confirmed" ? validatedPrivateResult(snapshot2, attempt, receipt.privateResultCanonical) : void 0;
  const deliverResult = canDeliver && privateResult !== void 0;
  const fromUnknown = attempt.state === "uncertain";
  integer2(attempt.measuredInputTokens, 1);
  integer2(attempt.maximumOutputTokens);
  const overrun = cost > attempt.reservationUnits || receipt.usage?.inputTokens !== void 0 && receipt.usage.inputTokens > attempt.measuredInputTokens || receipt.usage?.outputTokens !== void 0 && receipt.usage.outputTokens > attempt.maximumOutputTokens;
  for (const account of [tenant2, run]) await ctx.db.patch("runtimeBudgetAccounts", account._id, {
    reservedUnits: fromUnknown ? account.reservedUnits : subtract(account.reservedUnits, attempt.reservationUnits),
    uncertainUnits: fromUnknown ? subtract(account.uncertainUnits, attempt.reservationUnits) : account.uncertainUnits,
    settledUnits: add(account.settledUnits, cost),
    activeConcurrency: attempt.slotReleased ? account.activeConcurrency : subtract(account.activeConcurrency, 1),
    overrun: account.overrun || overrun,
    version: add(account.version, 1)
  });
  await ctx.db.patch("runtimeModelOperations", operation._id, {
    reservedUnits: fromUnknown ? operation.reservedUnits : subtract(operation.reservedUnits, attempt.reservationUnits),
    uncertainUnits: fromUnknown ? subtract(operation.uncertainUnits, attempt.reservationUnits) : operation.uncertainUnits,
    settledUnits: add(operation.settledUnits, cost),
    overrun: operation.overrun || overrun
  });
  const finalState = receipt.outcome === "confirmed_rejected" ? "confirmed_rejected" : "settled";
  await ctx.db.patch("runtimeModelAttempts", attempt._id, {
    state: finalState,
    slotReleased: true,
    receiptCanonical: chargeCanonical,
    receiptHash,
    settledCostUnits: cost,
    costProvenance: canonical([proof.evidenceHash, snapshot2.pins.priceRevision, receipt.costSource]),
    resultWithheld: !deliverResult,
    ...receipt.actualModel ? { actualModel: receipt.actualModel } : {},
    ...deliverResult ? { privateResultCanonical: privateResult } : {}
  });
  return { state: finalState, settledCostUnits: cost, resultWithheld: !deliverResult, overrun };
}
async function retiredScope(ctx, operation) {
  const reader = createAuthorityReader(ctx);
  const tenant2 = await reader.getScope(operation.tenantId);
  const space = await reader.getScope(operation.tenantId, operation.memorySpaceId);
  const retired = tenant2?.deletedAt !== void 0 || space?.deletedAt !== void 0 || await reader.hasTombstone({ tenantId: operation.tenantId, resourceType: "tenant", resourceId: operation.tenantId }) || await reader.hasTombstone({ tenantId: operation.tenantId, memorySpaceId: operation.memorySpaceId, resourceType: "memorySpace", resourceId: operation.memorySpaceId });
  if (!retired) fail("FORBIDDEN");
}
var reconcileDeploymentLiability = internalMutation({ args: { attemptId: v5.id("runtimeModelAttempts"), receiptCanonical: v5.string() }, handler: async (ctx, args) => {
  const { operation } = await attemptContext(ctx, args.attemptId);
  return await settleAttempt(ctx, operation.reference, args.attemptId, args.receiptCanonical, true, true);
} });
var settle = internalMutation({ args: { ...attemptArgs, receiptCanonical: v5.string() }, handler: async (ctx, args) => await settleAttempt(ctx, args.reference, args.attemptId, args.receiptCanonical, false) });
var recover = internalMutation({ args: { ...attemptArgs, receiptCanonical: v5.optional(v5.string()) }, handler: async (ctx, args) => {
  if (args.receiptCanonical !== void 0) return await settleAttempt(ctx, args.reference, args.attemptId, args.receiptCanonical, true);
  const state = await attemptContext(ctx, args.attemptId);
  await liabilityAuthority(ctx, args.reference, state.operation);
  if (state.attempt.state === "reserved" && state.attempt.checkpointAt === void 0) {
    for (const account of [state.tenant, state.run]) await ctx.db.patch("runtimeBudgetAccounts", account._id, {
      reservedUnits: subtract(account.reservedUnits, state.attempt.reservationUnits),
      activeConcurrency: subtract(account.activeConcurrency, 1),
      version: add(account.version, 1)
    });
    await ctx.db.patch("runtimeModelOperations", state.operation._id, { reservedUnits: subtract(state.operation.reservedUnits, state.attempt.reservationUnits) });
    await ctx.db.patch("runtimeModelAttempts", state.attempt._id, {
      state: "not_dispatched",
      slotReleased: true,
      resultWithheld: true,
      terminalEvidenceCanonical: canonical({ kind: "native-no-checkpoint-v1", actorReference: args.reference, reconciledAt: Date.now() })
    });
    return { state: "not_dispatched", replayAllowed: false };
  }
  return await writeUnknown(ctx, state);
} });
var releaseNotDispatched = internalMutation({ args: attemptArgs, handler: async (ctx, args) => {
  const { attempt, operation, tenant: tenant2, run } = await attemptContext(ctx, args.attemptId);
  await currentOperation(ctx, args.reference, operation, true);
  if (attempt.state === "not_dispatched") return { state: "not_dispatched" };
  if (attempt.state !== "reserved" || attempt.checkpointAt !== void 0) fail("UNCERTAIN_OUTCOME", "uncertain");
  for (const account of [tenant2, run]) await ctx.db.patch("runtimeBudgetAccounts", account._id, {
    reservedUnits: subtract(account.reservedUnits, attempt.reservationUnits),
    activeConcurrency: subtract(account.activeConcurrency, 1),
    version: add(account.version, 1)
  });
  await ctx.db.patch("runtimeModelOperations", operation._id, { reservedUnits: subtract(operation.reservedUnits, attempt.reservationUnits) });
  await ctx.db.patch("runtimeModelAttempts", attempt._id, { state: "not_dispatched", slotReleased: true });
  return { state: "not_dispatched" };
} });
var cancelBudget = internalMutation({ args: { reference: runtimeAuthorityReference, runBudgetId: v5.string() }, handler: async (ctx, args) => {
  const run = await runAccount(ctx, args.reference, args.runBudgetId);
  await recheckAuthority(ctx, args.reference, { capability: "run", tenantId: run.tenantId, memorySpaceId: args.reference.memorySpaceId });
  await ctx.db.patch("runtimeBudgetAccounts", run._id, { cancelled: true, version: add(run.version, 1) });
  return { cancelled: true };
} });
function fallbackAllowed(attempt, operation, snapshot2, candidateModelId) {
  return candidateModelId !== snapshot2.modelId && canFallbackModel(snapshot2, candidateModelId, {
    outcome: attempt.state === "not_dispatched" ? "not_dispatched" : attempt.state === "confirmed_rejected" ? "confirmed_rejected" : "uncertain",
    proof: attempt.state === "not_dispatched" ? "pre_dispatch" : attempt.state === "confirmed_rejected" && attempt.receiptCanonical ? "qualified_rejection" : "none",
    outputVisible: attempt.outputVisible,
    toolInputVisible: attempt.toolInputVisible,
    toolResultVisible: attempt.toolResultVisible,
    toolEffectCommitted: attempt.toolEffectCommitted,
    paidLiabilityUncertain: attempt.state === "uncertain" || attempt.state === "dispatch_pending",
    cancelled: operation.cancelled,
    priorAttemptAccounted: attempt.state === "not_dispatched" || attempt.state === "confirmed_rejected",
    currentAuthorityChecked: true,
    currentSourceChecked: true,
    currentPolicyChecked: true
  });
}
var admitFallback = internalMutation({ args: { ...attemptArgs, candidateModelId: v5.string() }, handler: async (ctx, args) => {
  const state = await attemptContext(ctx, args.attemptId);
  const { attempt, operation, run, tenant: tenant2, snapshot: snapshot2 } = state;
  const checked = await currentOperation(ctx, args.reference, operation);
  if (!fallbackAllowed(attempt, operation, snapshot2, args.candidateModelId) || !fallbackAllowed(attempt, operation, checked.current.snapshot, args.candidateModelId)) fail("POLICY_DENIED");
  const nextNumber = add(attempt.attemptNumber, 1);
  if (nextNumber > 64) fail("POLICY_DENIED");
  const existing = single(await ctx.db.query("runtimeModelAttempts").withIndex("by_child_attempt", (q) => q.eq("operationDocumentId", operation._id).eq("childCallId", attempt.childCallId).eq("attemptNumber", nextNumber)).take(2));
  if (existing) {
    if (existing.priorAttemptId !== attempt._id || existing.fallbackModelId !== args.candidateModelId) fail("IDEMPOTENCY_CONFLICT");
    return { status: "inflight", attemptId: existing._id };
  }
  const candidate = single(checked.current.manifest.qualifications.filter((q) => q.modelId === args.candidateModelId && q.nativeInterface === snapshot2.nativeInterface && snapshot2.fallbackCandidates.some((entry) => entry.qualificationReceiptId === q.receiptId)));
  if (!candidate) fail("CAPABILITY_UNAVAILABLE");
  const nextSnapshot = { ...snapshotOf(operation), modelId: candidate.modelId, qualificationReceiptId: candidate.receiptId, costBound: candidate.costBound };
  const proof = evidence(checked.current.manifest, nextSnapshot);
  const decoded = decode(attempt.canonical);
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) fail("POLICY_DENIED");
  const old = validateModelRequest2(snapshot2, decoded.request);
  const next = validateModelRequest2(nextSnapshot, { ...old.request, inputTokens: deriveQualifiedInputBound(proof, old.request), reservationUnits: candidate.costBound.maximumCostUnits });
  const ceiling = candidate.costBound.maximumCostUnits;
  capacity(tenant2, ceiling, Math.min(nextSnapshot.limits.tenantBudgetUnits, checked.current.snapshot.limits.tenantBudgetUnits), checked.current.snapshot.limits.concurrency);
  capacity(run, ceiling, Math.min(nextSnapshot.limits.runBudgetUnits, checked.current.snapshot.limits.runBudgetUnits), checked.current.snapshot.limits.concurrency);
  if (operation.overrun || add(operation.reservedUnits, operation.uncertainUnits, operation.settledUnits, ceiling) > Math.min(nextSnapshot.limits.operationBudgetUnits, checked.current.snapshot.limits.operationBudgetUnits)) fail("BUDGET_EXCEEDED");
  await finalActor(ctx, args.reference, operation.operationKey);
  const nextId = await ctx.db.insert("runtimeModelAttempts", {
    operationDocumentId: operation._id,
    childCallId: attempt.childCallId,
    ordinal: attempt.ordinal,
    attemptNumber: nextNumber,
    fallbackModelId: candidate.modelId,
    priorAttemptId: attempt._id,
    canonical: next.canonical,
    hash: await semanticHash(next.canonical),
    resolutionCanonical: operation.resolutionCanonical,
    snapshotCanonical: canonical(nextSnapshot),
    inputProofCanonical: canonical({ proof, requestCanonical: canonical(next.request), inputTokens: next.request.inputTokens, outputTokens: next.request.outputTokens }),
    measuredInputTokens: next.request.inputTokens,
    maximumOutputTokens: next.request.outputTokens,
    tenantAccountId: tenant2._id,
    runAccountId: run._id,
    reservationUnits: ceiling,
    state: "reserved",
    dispatchIdentity: await semanticHash(canonical([operation.operationId, attempt.childCallId, nextNumber, candidate.modelId])),
    slotReleased: false,
    outputVisible: false,
    toolInputVisible: false,
    toolResultVisible: false,
    toolEffectCommitted: false,
    resultWithheld: false,
    createdAt: Date.now()
  });
  for (const account of [tenant2, run]) await ctx.db.patch("runtimeBudgetAccounts", account._id, { reservedUnits: add(account.reservedUnits, ceiling), activeConcurrency: add(account.activeConcurrency, 1), version: add(account.version, 1) });
  await ctx.db.patch("runtimeModelOperations", operation._id, { reservedUnits: add(operation.reservedUnits, ceiling) });
  return { status: "reserved", operationId: operation._id, attemptId: nextId, snapshot: nextSnapshot, requestCanonical: canonical(next.request) };
} });
var checkFallback = internalQuery({ args: { ...attemptArgs, candidateModelId: v5.string() }, handler: async (ctx, args) => {
  const { attempt, operation, snapshot: snapshot2 } = await attemptContext(ctx, args.attemptId);
  const checked = await currentOperation(ctx, args.reference, operation);
  return { allowed: fallbackAllowed(attempt, operation, snapshot2, args.candidateModelId) && fallbackAllowed(attempt, operation, checked.current.snapshot, args.candidateModelId) };
} });

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/qualificationOwned.ts
import { v as v9 } from "convex/values";
import { makeFunctionReference as makeFunctionReference2 } from "convex/server";
import { ConvexError as ConvexError5 } from "convex/values";

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/schema.ts
import { defineSchema as defineSchema2, defineTable as defineTable5 } from "convex/server";
import { v as v8 } from "convex/values";

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/productionSchema.ts
import { defineSchema, defineTable as defineTable4 } from "convex/server";
import { v as v7 } from "convex/values";

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeMemorySchema.ts
import { defineTable as defineTable3 } from "convex/server";
import { v as v6 } from "convex/values";
var sourceReference = { sourceId: v6.string(), sourceEventId: v6.string(), sourceRevision: v6.number() };
var sourceLineage = v6.union(
  v6.object({ ...sourceReference, role: v6.literal("user"), trust: v6.literal("user_assertion") }),
  v6.object({ ...sourceReference, role: v6.literal("assistant"), trust: v6.literal("assistant_claim") }),
  v6.object({ ...sourceReference, role: v6.literal("tool"), trust: v6.literal("verified_tool_evidence"), operationId: v6.string() })
);
var embeddingProfile = v6.object({
  profileId: v6.string(),
  modelId: v6.string(),
  dimensions: v6.number(),
  normalization: v6.string(),
  chunking: v6.string(),
  indexName: v6.string()
});
var sourceContent = v6.object({
  tenantId: v6.string(),
  memorySpaceId: v6.string(),
  ownerPrincipalId: v6.string(),
  lineage: sourceLineage,
  content: v6.string(),
  contentHash: v6.string(),
  createdAt: v6.number(),
  tombstonedAt: v6.optional(v6.number())
});
var sourceChunk = v6.object({
  ...sourceReference,
  chunkId: v6.string(),
  tenantId: v6.string(),
  memorySpaceId: v6.string(),
  profileId: v6.string(),
  ordinal: v6.number(),
  start: v6.number(),
  end: v6.number(),
  text: v6.string(),
  textHash: v6.string()
});
var derivedVector = v6.object({
  ...sourceReference,
  vectorId: v6.string(),
  chunkId: v6.string(),
  tenantId: v6.string(),
  memorySpaceId: v6.string(),
  profile: embeddingProfile,
  embedding: v6.array(v6.float64()),
  processingReceiptId: v6.string()
});
var processingIdentity = v6.object({
  ...sourceReference,
  stage: v6.union(v6.literal("extract"), v6.literal("facts"), v6.literal("vectors")),
  semanticPolicyVersion: v6.string()
});
var factType = v6.union(
  v6.literal("preference"),
  v6.literal("identity"),
  v6.literal("knowledge"),
  v6.literal("relationship"),
  v6.literal("event"),
  v6.literal("observation"),
  v6.literal("custom")
);
var derivedFact = v6.object({
  _id: v6.string(),
  factId: v6.string(),
  tenantId: v6.optional(v6.string()),
  memorySpaceId: v6.string(),
  ownerPrincipalId: v6.string(),
  lineage: sourceLineage,
  extractionPolicyVersion: v6.string(),
  fact: v6.string(),
  factType,
  subject: v6.optional(v6.string()),
  predicate: v6.optional(v6.string()),
  object: v6.optional(v6.string()),
  confidence: v6.number(),
  sourceType: v6.union(v6.literal("conversation"), v6.literal("system"), v6.literal("tool"), v6.literal("manual"), v6.literal("a2a")),
  tags: v6.array(v6.string()),
  version: v6.number(),
  createdAt: v6.number(),
  updatedAt: v6.number(),
  validFrom: v6.optional(v6.number()),
  validUntil: v6.optional(v6.number()),
  supersededBy: v6.optional(v6.string()),
  supersedes: v6.optional(v6.string()),
  userId: v6.optional(v6.string()),
  participantId: v6.optional(v6.string()),
  entities: v6.optional(v6.array(v6.object({ name: v6.string(), type: v6.string(), fullValue: v6.optional(v6.string()) }))),
  relations: v6.optional(v6.array(v6.object({ subject: v6.string(), predicate: v6.string(), object: v6.string() })))
});
var commitDerivedInput = v6.object({
  source: v6.object(sourceReference),
  identity: processingIdentity,
  chunks: v6.optional(v6.array(sourceChunk)),
  vectors: v6.optional(v6.array(derivedVector)),
  facts: v6.optional(v6.array(derivedFact)),
  expectedFactVersions: v6.optional(v6.record(v6.string(), v6.number()))
});
var runtimeMemoryTables = {
  runtimeMemorySources: defineTable3(sourceContent.fields).index("by_scope_source", ["tenantId", "memorySpaceId", "lineage.sourceId"]).index("by_scope_event", ["tenantId", "memorySpaceId", "lineage.sourceEventId"]),
  runtimeMemoryChunks: defineTable3(sourceChunk.fields).index("by_scope_chunk", ["tenantId", "memorySpaceId", "chunkId"]),
  runtimeMemoryVectors: defineTable3({
    ...derivedVector.fields,
    profileId: v6.string(),
    scopeProfileKey: v6.string(),
    ownerPrincipalId: v6.string(),
    scopeProfileOwnerKey: v6.string()
  }).index("by_scope_vector", ["tenantId", "memorySpaceId", "vectorId"]).index("by_scope_source_revision", ["tenantId", "memorySpaceId", "sourceId", "sourceRevision"]).vectorIndex("by_default_embedding_v1", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["tenantId", "memorySpaceId", "profileId", "scopeProfileKey", "scopeProfileOwnerKey"]
  }),
  runtimeMemoryReceipts: defineTable3({
    tenantId: v6.string(),
    memorySpaceId: v6.string(),
    receiptId: v6.string(),
    identity: processingIdentity,
    canonicalIdentity: v6.string(),
    canonicalPayload: v6.string(),
    createdAt: v6.number()
  }).index("by_scope_receipt", ["tenantId", "memorySpaceId", "receiptId"])
};

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/productionSchema.ts
var productionSchema_default = defineSchema({
  ...runtimeAuthTables,
  ...runtimeMemoryTables,
  ...runtimePolicyTables,
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1a: Conversations (ACID, Immutable)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversations: defineTable4({
    // Identity
    conversationId: v7.string(),
    // Unique ID (e.g., "conv-abc123")
    // Memory Space (NEW - fundamental isolation boundary)
    memorySpaceId: v7.string(),
    // Which memory space owns this conversation
    participantId: v7.optional(v7.string()),
    // Hive Mode: which participant created this
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v7.optional(v7.string()),
    // Tenant ID for isolation
    // Type: user-agent (user ↔ participant) or agent-agent (space ↔ space)
    type: v7.union(v7.literal("user-agent"), v7.literal("agent-agent")),
    // Participants (based on type)
    participants: v7.object({
      // user-agent conversations (single user)
      userId: v7.optional(v7.string()),
      // The primary human user in the conversation
      agentId: v7.optional(v7.string()),
      // The agent/assistant in the conversation
      // Collaborative conversations (Phase 4) - multiple human participants
      userIds: v7.optional(v7.array(v7.string())),
      // Multiple human users
      // Hive Mode tracking (which tool/agent in shared space created this)
      participantId: v7.optional(v7.string()),
      // agent-agent conversations (Collaboration Mode - cross-space)
      memorySpaceIds: v7.optional(v7.array(v7.string()))
      // Both spaces involved
    }),
    // Collaborative settings (Phase 4)
    collaborativeSettings: v7.optional(
      v7.object({
        // Whether messages from non-owners require approval
        requireApproval: v7.boolean(),
        // The owner who can approve messages (defaults to first userId/userIds[0])
        ownerUserId: v7.optional(v7.string()),
        // IDs of approved participants (others require approval)
        approvedParticipants: v7.optional(v7.array(v7.string()))
      })
    ),
    // Messages (append-only, immutable)
    messages: v7.array(
      v7.object({
        id: v7.string(),
        // Message ID
        role: v7.union(
          v7.literal("user"),
          v7.literal("agent"),
          v7.literal("system")
        ),
        content: v7.string(),
        timestamp: v7.number(),
        // Optional fields
        participantId: v7.optional(v7.string()),
        // Which participant sent this (Hive Mode/Collaborative)
        metadata: v7.optional(v7.any()),
        // Flexible metadata
        attachmentIds: v7.optional(v7.array(v7.string())),
        // Multi-modal attachment references
        // Collaborative approval (Phase 4)
        approvalStatus: v7.optional(
          v7.union(
            v7.literal("pending"),
            v7.literal("approved"),
            v7.literal("rejected")
          )
        ),
        approvedBy: v7.optional(v7.string()),
        // userId who approved
        approvedAt: v7.optional(v7.number())
        // Approval timestamp
      })
    ),
    // Statistics
    messageCount: v7.number(),
    // Metadata (flexible)
    metadata: v7.optional(v7.any()),
    // Timestamps
    createdAt: v7.number(),
    updatedAt: v7.number(),
    // Visibility for shareable chats (Phase 1)
    // - 'private': Only owner can access (default)
    // - 'space': Anyone in the memory space can access
    // - 'public': Anyone with the conversationId can access
    visibility: v7.optional(
      v7.union(
        v7.literal("private"),
        v7.literal("space"),
        v7.literal("public")
      )
    )
  }).index("by_conversationId", ["conversationId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_type", ["type"]).index("by_user", ["participants.userId"]).index("by_agent", ["participants.agentId"]).index("by_memorySpace_user", ["memorySpaceId", "participants.userId"]).index("by_memorySpace_agent", ["memorySpaceId", "participants.agentId"]).index("by_created", ["createdAt"]).index("by_visibility", ["visibility"]).index("by_memorySpace_visibility", ["memorySpaceId", "visibility"]),
  // Space + visibility
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Shares (Shareable Chats Phase 2)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversationShares: defineTable4({
    // Identity
    shareId: v7.string(),
    // Public-facing identifier for share links
    conversationId: v7.string(),
    // Granter (owner)
    grantedBy: v7.string(),
    // userId who shared
    sourceMemorySpaceId: v7.string(),
    // Recipient(s)
    grantType: v7.union(
      v7.literal("user"),
      // Specific user
      v7.literal("space"),
      // Entire memory space
      v7.literal("link"),
      // Anyone with link
      v7.literal("domain")
      // Anyone from email domain
    ),
    grantedTo: v7.optional(v7.string()),
    // userId, memorySpaceId, or domain
    // Permissions
    permissions: v7.object({
      canView: v7.boolean(),
      // See messages
      canViewFacts: v7.boolean(),
      // See extracted facts
      canViewMemories: v7.boolean(),
      // See related memories
      canContinue: v7.boolean(),
      // Add new messages
      canFork: v7.boolean(),
      // Create a copy
      canExport: v7.boolean()
      // Download transcript
    }),
    // Constraints
    expiresAt: v7.optional(v7.number()),
    // Time-limited sharing
    maxViews: v7.optional(v7.number()),
    // View-limited sharing
    viewCount: v7.number(),
    // Redaction
    redactBefore: v7.optional(v7.number()),
    // Hide messages before timestamp
    redactSensitive: v7.boolean(),
    // Auto-redact PII
    // Status
    status: v7.union(
      v7.literal("active"),
      v7.literal("revoked"),
      v7.literal("expired")
    ),
    // Multi-tenancy
    tenantId: v7.optional(v7.string()),
    // Timestamps
    createdAt: v7.number(),
    revokedAt: v7.optional(v7.number())
  }).index("by_shareId", ["shareId"]).index("by_conversation", ["conversationId"]).index("by_grantedTo", ["grantedTo"]).index("by_grantedBy", ["grantedBy"]).index("by_status", ["status"]).index("by_tenant_shareId", ["tenantId", "shareId"]).index("by_tenant_conversation", ["tenantId", "conversationId"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Conversation Snapshots (Shareable Chats Phase 3)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversationSnapshots: defineTable4({
    // Identity
    snapshotId: v7.string(),
    conversationId: v7.string(),
    // Source conversation
    // Snapshot content (immutable after creation)
    messages: v7.array(
      v7.object({
        id: v7.string(),
        role: v7.union(
          v7.literal("user"),
          v7.literal("agent"),
          v7.literal("system")
        ),
        content: v7.string(),
        timestamp: v7.number(),
        participantId: v7.optional(v7.string())
        // Note: PII-redacted version stored here
      })
    ),
    // Original conversation metadata
    conversationType: v7.union(
      v7.literal("user-agent"),
      v7.literal("agent-agent")
    ),
    participants: v7.object({
      userId: v7.optional(v7.string()),
      agentId: v7.optional(v7.string()),
      participantId: v7.optional(v7.string()),
      memorySpaceIds: v7.optional(v7.array(v7.string()))
    }),
    // Snapshot metadata
    messageCount: v7.number(),
    // What was included
    includedContent: v7.object({
      messages: v7.boolean(),
      facts: v7.boolean(),
      memories: v7.boolean()
    }),
    // Redaction info
    redaction: v7.object({
      piiRedacted: v7.boolean(),
      messagesRedactedBefore: v7.optional(v7.number()),
      // Timestamp
      customRedactions: v7.optional(
        v7.array(
          v7.object({
            pattern: v7.string(),
            replacement: v7.string()
          })
        )
      )
    }),
    // Associated facts snapshot (if included)
    facts: v7.optional(
      v7.array(
        v7.object({
          factId: v7.string(),
          fact: v7.string(),
          factType: v7.string(),
          confidence: v7.number()
        })
      )
    ),
    // Owner info
    createdBy: v7.string(),
    // userId
    memorySpaceId: v7.string(),
    // Multi-tenancy
    tenantId: v7.optional(v7.string()),
    // Status
    status: v7.union(
      v7.literal("active"),
      v7.literal("archived"),
      v7.literal("deleted")
    ),
    // Timestamps
    createdAt: v7.number(),
    snapshotOf: v7.number()
    // Timestamp of when the snapshot was taken
  }).index("by_snapshotId", ["snapshotId"]).index("by_conversation", ["conversationId"]).index("by_createdBy", ["createdBy"]).index("by_memorySpace", ["memorySpaceId"]).index("by_status", ["status"]).index("by_tenant_snapshotId", ["tenantId", "snapshotId"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1b: Immutable Store (ACID, Versioned, Shared)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  immutable: defineTable4({
    // Identity (composite key: type + id)
    type: v7.string(),
    // Entity type: 'kb-article', 'policy', 'audit-log', 'feedback', 'user'
    id: v7.string(),
    // Type-specific logical ID
    // Data (flexible, immutable once stored)
    data: v7.any(),
    // GDPR support (optional)
    userId: v7.optional(v7.string()),
    // Links to user for cascade deletion
    // Multi-tenancy (NEW - for non-critical path isolation)
    tenantId: v7.optional(v7.string()),
    // Trusted tenant selector
    ownerPrincipalId: v7.optional(v7.string()),
    tombstonedAt: v7.optional(v7.number()),
    memorySpaceId: v7.optional(v7.string()),
    // Optional trusted grant scope
    // Versioning
    version: v7.number(),
    // Current version number (starts at 1)
    previousVersions: v7.array(
      v7.object({
        version: v7.number(),
        data: v7.any(),
        timestamp: v7.number(),
        metadata: v7.optional(v7.any())
      })
    ),
    // Metadata (flexible - any JSON-serializable object)
    metadata: v7.optional(v7.any()),
    // Timestamps
    createdAt: v7.number(),
    updatedAt: v7.number()
  }).index("by_runtime_scope", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_runtime_key", ["tenantId", "memorySpaceId", "type", "id"]).index("by_type_id", ["type", "id"]).index("by_type", ["type"]).index("by_tenantId", ["tenantId"]).index("by_tenant_type_id", ["tenantId", "type", "id"]).index("by_userId", ["userId"]).index("by_created", ["createdAt"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1c: Mutable Store (ACID, No Versioning, Shared)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  mutable: defineTable4({
    // Composite key: namespace + key
    namespace: v7.string(),
    // Logical grouping: 'inventory', 'config', 'counters', etc.
    key: v7.string(),
    // Unique key within namespace
    // Value (flexible, mutable)
    value: v7.any(),
    // GDPR support (optional)
    userId: v7.optional(v7.string()),
    // Links to user for cascade deletion
    // Multi-tenancy (NEW - for non-critical path isolation)
    tenantId: v7.optional(v7.string()),
    // Trusted tenant selector
    ownerPrincipalId: v7.optional(v7.string()),
    tombstonedAt: v7.optional(v7.number()),
    memorySpaceId: v7.optional(v7.string()),
    // Optional trusted grant scope
    // Metadata (optional)
    metadata: v7.optional(v7.any()),
    // Timestamps
    createdAt: v7.number(),
    updatedAt: v7.number()
  }).index("by_runtime_scope", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_runtime_key", ["tenantId", "memorySpaceId", "namespace", "key"]).index("by_namespace_key", ["namespace", "key"]).index("by_namespace", ["namespace"]).index("by_tenantId", ["tenantId"]).index("by_tenant_namespace", ["tenantId", "namespace"]).index("by_tenant_namespace_key", ["tenantId", "namespace", "key"]).index("by_userId", ["userId"]).index("by_updated", ["updatedAt"]),
  // Recent changes
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 2: Vector Memory (Searchable, memorySpace-scoped, Versioned)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memories: defineTable4({
    // Fresh runtime ownership/provenance; old unowned rows are never adopted.
    ownerPrincipalId: v7.optional(v7.string()),
    runtimeEditor: v7.optional(v7.object({ principalId: v7.string(), userId: v7.string(), editedAt: v7.number() })),
    manualSourceBinding: v7.optional(v7.object({ resourceType: v7.union(v7.literal("memory"), v7.literal("fact")), resourceId: v7.string() })),
    lineage: v7.optional(sourceLineage),
    tombstonedAt: v7.optional(v7.number()),
    // Identity
    memoryId: v7.string(),
    // Unique ID for this memory
    memorySpaceId: v7.string(),
    // NEW: Memory space isolation (was agentId)
    participantId: v7.optional(v7.string()),
    // NEW: Hive Mode participant tracking
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v7.optional(v7.string()),
    // Tenant ID for isolation
    // Content
    content: v7.string(),
    contentType: v7.union(
      v7.literal("raw"),
      v7.literal("summarized"),
      v7.literal("fact")
      // NEW: For facts indexed in vector layer
    ),
    embedding: v7.optional(v7.array(v7.float64())),
    // Optional for keyword-only
    // Source (flattened for indexing performance)
    sourceType: v7.union(
      v7.literal("conversation"),
      v7.literal("system"),
      v7.literal("tool"),
      v7.literal("a2a"),
      v7.literal("fact-extraction")
      // NEW: For facts
    ),
    sourceUserId: v7.optional(v7.string()),
    sourceUserName: v7.optional(v7.string()),
    sourceTimestamp: v7.number(),
    // Message role (for conversation memories) - helps with semantic search weighting
    messageRole: v7.optional(
      v7.union(v7.literal("user"), v7.literal("agent"), v7.literal("system"))
    ),
    // Owner Attribution (at least one required for proper tracking)
    userId: v7.optional(v7.string()),
    // For user-owned memories (GDPR cascade)
    agentId: v7.optional(v7.string()),
    // For agent-owned memories (agent deletion cascade)
    // References to Layer 1 (mutually exclusive, all optional)
    conversationRef: v7.optional(
      v7.object({
        conversationId: v7.string(),
        messageIds: v7.array(v7.string())
      })
    ),
    immutableRef: v7.optional(
      v7.object({
        type: v7.string(),
        id: v7.string(),
        version: v7.optional(v7.number())
      })
    ),
    mutableRef: v7.optional(
      v7.object({
        namespace: v7.string(),
        key: v7.string(),
        snapshotValue: v7.any(),
        snapshotAt: v7.number()
      })
    ),
    // NEW: Reference to Layer 3 fact
    factsRef: v7.optional(
      v7.object({
        factId: v7.string(),
        version: v7.optional(v7.number())
      })
    ),
    // Metadata (flattened for indexing/filtering)
    importance: v7.number(),
    // 0-100 (flattened for filtering)
    tags: v7.array(v7.string()),
    // Flattened for filtering
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Enrichment Fields (for bullet-proof retrieval)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    enrichedContent: v7.optional(v7.string()),
    // Concatenated searchable content for embedding
    factCategory: v7.optional(v7.string()),
    // Category for filtering (e.g., "addressing_preference")
    // Flexible metadata (for source-specific data like A2A direction, messageId, etc.)
    metadata: v7.optional(v7.any()),
    // Versioning (like immutable)
    version: v7.number(),
    previousVersions: v7.array(
      v7.object({
        version: v7.number(),
        content: v7.string(),
        embedding: v7.optional(v7.array(v7.float64())),
        timestamp: v7.number()
      })
    ),
    // Timestamps & Access
    createdAt: v7.number(),
    updatedAt: v7.number(),
    lastAccessed: v7.optional(v7.number()),
    accessCount: v7.number(),
    // Streaming support (NEW - for progressive storage)
    isPartial: v7.optional(v7.boolean()),
    // Flag for in-progress streaming memories
    partialMetadata: v7.optional(v7.any())
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
    ownerPrincipalId: v7.optional(v7.string()),
    runtimeEditor: v7.optional(v7.object({ principalId: v7.string(), userId: v7.string(), editedAt: v7.number() })),
    manualSourceBinding: v7.optional(v7.object({ resourceType: v7.union(v7.literal("memory"), v7.literal("fact")), resourceId: v7.string() })),
    lineage: v7.optional(sourceLineage),
    extractionPolicyVersion: v7.optional(v7.string()),
    processingReceiptId: v7.optional(v7.string()),
    tombstonedAt: v7.optional(v7.number()),
    // Identity
    factId: v7.string(),
    // Unique ID for this fact
    memorySpaceId: v7.string(),
    // Memory space isolation
    participantId: v7.optional(v7.string()),
    // Hive Mode: which participant extracted this
    userId: v7.optional(v7.string()),
    // GDPR compliance - links to user
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v7.optional(v7.string()),
    // Tenant ID for isolation
    // Fact content
    fact: v7.string(),
    // The fact statement
    factType: v7.union(
      v7.literal("preference"),
      v7.literal("identity"),
      v7.literal("knowledge"),
      v7.literal("relationship"),
      v7.literal("event"),
      v7.literal("observation"),
      v7.literal("custom")
    ),
    // Triple structure (subject-predicate-object)
    subject: v7.optional(v7.string()),
    // Primary entity (e.g., "user-123")
    predicate: v7.optional(v7.string()),
    // Relationship (e.g., "prefers", "works_at")
    object: v7.optional(v7.string()),
    // Secondary entity (e.g., "dark mode")
    // Quality & Source
    confidence: v7.number(),
    // 0-100: extraction confidence
    sourceType: v7.union(
      v7.literal("conversation"),
      v7.literal("system"),
      v7.literal("tool"),
      v7.literal("manual"),
      v7.literal("a2a"),
      v7.literal("fact-extraction")
      // For fact-extracted content
    ),
    sourceRef: v7.optional(
      v7.object({
        conversationId: v7.optional(v7.string()),
        messageIds: v7.optional(v7.array(v7.string())),
        memoryId: v7.optional(v7.string())
      })
    ),
    // Metadata & Tags
    metadata: v7.optional(v7.any()),
    tags: v7.array(v7.string()),
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Enrichment Fields (for bullet-proof retrieval)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    category: v7.optional(v7.string()),
    // Specific sub-category (e.g., "addressing_preference")
    searchAliases: v7.optional(v7.array(v7.string())),
    // Alternative search terms
    semanticContext: v7.optional(v7.string()),
    // Usage context sentence
    entities: v7.optional(
      v7.array(
        v7.object({
          name: v7.string(),
          type: v7.string(),
          fullValue: v7.optional(v7.string())
        })
      )
    ),
    // Extracted entities with types
    relations: v7.optional(
      v7.array(
        v7.object({
          subject: v7.string(),
          predicate: v7.string(),
          object: v7.string()
        })
      )
    ),
    // Subject-predicate-object triples for graph
    // Temporal validity
    validFrom: v7.optional(v7.number()),
    validUntil: v7.optional(v7.number()),
    // Versioning (creates immutable chain)
    version: v7.number(),
    supersededBy: v7.optional(v7.string()),
    // factId of newer version
    supersedes: v7.optional(v7.string()),
    // factId this replaces
    // Timestamps
    createdAt: v7.number(),
    updatedAt: v7.number(),
    // Embedding for semantic search (v0.30.0+)
    embedding: v7.optional(v7.array(v7.float64()))
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
    eventId: v7.string(),
    // Unique event ID
    factId: v7.string(),
    // The fact this event relates to
    memorySpaceId: v7.string(),
    // Memory space for scoping
    // Action that was taken
    action: v7.union(
      v7.literal("CREATE"),
      v7.literal("UPDATE"),
      v7.literal("SUPERSEDE"),
      v7.literal("DELETE")
    ),
    // Values (for tracking changes)
    oldValue: v7.optional(v7.string()),
    // Previous fact text
    newValue: v7.optional(v7.string()),
    // New fact text
    // Relationships
    supersededBy: v7.optional(v7.string()),
    // factId that replaced this
    supersedes: v7.optional(v7.string()),
    // factId this replaced
    // Decision context
    reason: v7.optional(v7.string()),
    // Why this action was taken
    confidence: v7.optional(v7.number()),
    // Confidence in the decision
    // Pipeline info
    pipeline: v7.optional(
      v7.object({
        slotMatching: v7.optional(v7.boolean()),
        semanticMatching: v7.optional(v7.boolean()),
        llmResolution: v7.optional(v7.boolean())
      })
    ),
    // Source context
    userId: v7.optional(v7.string()),
    // User who triggered the change
    participantId: v7.optional(v7.string()),
    // Participant who triggered
    conversationId: v7.optional(v7.string()),
    // Conversation context
    // Timestamps
    timestamp: v7.number()
  }).index("by_eventId", ["eventId"]).index("by_factId", ["factId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_memorySpace_timestamp", ["memorySpaceId", "timestamp"]).index("by_action", ["action"]).index("by_userId", ["userId"]).index("by_timestamp", ["timestamp"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Memory Spaces Registry (Hive/Collaboration Mode Management)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  memorySpaces: defineTable4({
    // Identity
    memorySpaceId: v7.string(),
    // Unique memory space ID
    name: v7.optional(v7.string()),
    // Human-readable name
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v7.optional(v7.string()),
    // Tenant ID for isolation
    ownerPrincipalId: v7.optional(v7.string()),
    // Trusted verified resource owner
    tombstonedAt: v7.optional(v7.number()),
    // Retained deletion fence
    type: v7.union(
      v7.literal("personal"),
      v7.literal("team"),
      v7.literal("project"),
      v7.literal("custom")
    ),
    // Participants (for Hive Mode)
    participants: v7.array(
      v7.object({
        id: v7.string(),
        // Participant ID (e.g., 'cursor', 'claude', 'my-bot')
        type: v7.string(),
        // 'ai-tool', 'human', 'ai-agent', 'system'
        joinedAt: v7.number()
      })
    ),
    // Metadata (flexible)
    metadata: v7.any(),
    // Status
    status: v7.union(v7.literal("active"), v7.literal("archived")),
    // Timestamps
    createdAt: v7.number(),
    updatedAt: v7.number()
  }).index("by_runtime_scope_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_memorySpaceId", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_memorySpaceId", ["tenantId", "memorySpaceId"]).index("by_tenant_status", ["tenantId", "status"]).index("by_status", ["status"]).index("by_type", ["type"]).index("by_created", ["createdAt"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Contexts (Hierarchical Coordination, memorySpace-scoped with cross-space support)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  contexts: defineTable4({
    // Identity
    contextId: v7.string(),
    // Unique ID
    memorySpaceId: v7.string(),
    // NEW: Which memory space owns this context
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v7.optional(v7.string()),
    // Tenant ID for isolation
    ownerPrincipalId: v7.optional(v7.string()),
    // Trusted verified resource owner
    tombstonedAt: v7.optional(v7.number()),
    // Retained deletion fence
    // Purpose
    purpose: v7.string(),
    // What this context is for
    description: v7.optional(v7.string()),
    // Optional description
    // Hierarchy
    parentId: v7.optional(v7.string()),
    // Parent context (can be cross-space)
    rootId: v7.optional(v7.string()),
    // Root context
    depth: v7.number(),
    // 0 for root, increments with depth
    childIds: v7.array(v7.string()),
    // Child contexts
    // Status
    status: v7.union(
      v7.literal("active"),
      v7.literal("completed"),
      v7.literal("cancelled"),
      v7.literal("blocked")
    ),
    // Source conversation (optional)
    conversationRef: v7.optional(
      v7.object({
        conversationId: v7.string(),
        messageIds: v7.optional(v7.array(v7.string()))
      })
    ),
    // User association (GDPR)
    userId: v7.optional(v7.string()),
    // Participants (for tracking)
    participants: v7.array(v7.string()),
    // Memory spaces or participants involved
    // Cross-space access control
    grantedAccess: v7.optional(
      v7.array(
        v7.object({
          memorySpaceId: v7.string(),
          // Which space has access
          scope: v7.string(),
          // 'read-only', 'context-only', etc.
          grantedAt: v7.number()
        })
      )
    ),
    // Data (flexible)
    data: v7.optional(v7.any()),
    // Metadata
    metadata: v7.optional(v7.any()),
    // Versioning (automatic version tracking for updates)
    lastUpdatedBy: v7.optional(v7.string()),
    // Actual verified writer of the current revision
    version: v7.number(),
    // Current version number (starts at 1)
    previousVersions: v7.array(
      v7.object({
        version: v7.number(),
        status: v7.string(),
        data: v7.optional(v7.any()),
        timestamp: v7.number(),
        updatedBy: v7.optional(v7.string())
        // Agent/participant that made the change
      })
    ),
    // Timestamps
    createdAt: v7.number(),
    updatedAt: v7.number(),
    completedAt: v7.optional(v7.number())
  }).index("by_runtime_scope_context", ["tenantId", "memorySpaceId", "contextId"]).index("by_runtime_scope_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_contextId", ["contextId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_contextId", ["tenantId", "contextId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_parentId", ["parentId"]).index("by_rootId", ["rootId"]).index("by_status", ["status"]).index("by_memorySpace_status", ["memorySpaceId", "status"]).index("by_userId", ["userId"]).index("by_created", ["createdAt"]),
  // Chronological
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Agents Registry (Optional Metadata Layer)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  agents: defineTable4({
    // Identity
    agentId: v7.string(),
    // Unique agent identifier
    memorySpaceId: v7.optional(v7.string()),
    // Optional trusted space scope
    // Multi-tenancy (NEW - critical for SaaS isolation)
    tenantId: v7.optional(v7.string()),
    // Tenant ID for isolation
    ownerPrincipalId: v7.optional(v7.string()),
    // Trusted verified resource owner
    tombstonedAt: v7.optional(v7.number()),
    // Retained deletion fence
    // Metadata
    name: v7.string(),
    // Display name
    description: v7.optional(v7.string()),
    // What this agent does
    metadata: v7.optional(v7.any()),
    // Flexible metadata (team, capabilities, etc.)
    // Configuration
    config: v7.optional(v7.any()),
    // Agent-specific configuration
    // Status
    status: v7.union(
      v7.literal("active"),
      v7.literal("inactive"),
      v7.literal("archived")
    ),
    // Timestamps
    registeredAt: v7.number(),
    updatedAt: v7.number(),
    lastActive: v7.optional(v7.number())
    // Last time agent created data
  }).index("by_runtime_scope_agent", ["tenantId", "memorySpaceId", "agentId"]).index("by_runtime_scope_owner", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_agentId", ["agentId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_status", ["tenantId", "status"]).index("by_status", ["status"]).index("by_registered", ["registeredAt"]),
  // Chronological ordering
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Sessions (Native Session Management)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  sessions: defineTable4({
    // Identity
    sessionId: v7.string(),
    // Unique session ID
    userId: v7.string(),
    // User this session belongs to
    // Multi-tenancy (NEW - critical for isolation)
    tenantId: v7.optional(v7.string()),
    // Trusted tenant selector
    ownerPrincipalId: v7.optional(v7.string()),
    tombstonedAt: v7.optional(v7.number()),
    authorityReference: v7.optional(runtimeAuthorityReference),
    // Server-pinned maintenance authority
    // Memory space association
    memorySpaceId: v7.optional(v7.string()),
    // Memory space for this session
    // Session state
    status: v7.union(v7.literal("active"), v7.literal("idle"), v7.literal("ended")),
    startedAt: v7.number(),
    // When session started
    lastActiveAt: v7.number(),
    // Last activity timestamp
    endedAt: v7.optional(v7.number()),
    // When session ended
    expiresAt: v7.optional(v7.number()),
    // When session expires (from governance policy)
    // Fully extensible metadata (v.any() allows any shape)
    metadata: v7.optional(v7.any()),
    // Statistics
    messageCount: v7.number(),
    // Messages in this session
    memoryCount: v7.number()
    // Memories created in this session
  }).index("by_runtime_scope", ["tenantId", "memorySpaceId", "ownerPrincipalId"]).index("by_runtime_key", ["tenantId", "memorySpaceId", "sessionId"]).index("by_sessionId", ["sessionId"]).index("by_userId", ["userId"]).index("by_tenantId", ["tenantId"]).index("by_tenant_user", ["tenantId", "userId"]).index("by_status", ["status"]).index("by_memorySpace", ["memorySpaceId"]).index("by_lastActive", ["lastActiveAt"]).index("by_tenant_status", ["tenantId", "status"]),
  // Tenant + status
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Governance Policies (Data Retention, Purging, and Compliance)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  governancePolicies: defineTable4({
    // Fresh verified ownership; handlers reject missing fields rather than adopt rows.
    tenantId: v7.optional(v7.string()),
    ownerPrincipalId: v7.optional(v7.string()),
    authority: v7.optional(runtimeAuthorityReference),
    // Scope
    organizationId: v7.optional(v7.string()),
    memorySpaceId: v7.optional(v7.string()),
    // Memory space override
    // Policy configuration (full JSON structure)
    policy: v7.any(),
    // GovernancePolicy structure
    // Metadata
    isActive: v7.boolean(),
    appliedBy: v7.optional(v7.string()),
    // Who applied this policy
    // Timestamps
    createdAt: v7.number(),
    updatedAt: v7.number()
  }).index("by_organization", ["organizationId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_active", ["isActive", "organizationId"]).index("by_updated", ["updatedAt"]).index("by_runtime_scope_active", ["tenantId", "memorySpaceId", "isActive"]),
  // Governance Enforcement Log (Audit Trail)
  governanceEnforcement: defineTable4({
    policyId: v7.optional(v7.id("governancePolicies")),
    simulation: v7.optional(v7.boolean()),
    // Fresh verified ownership; handlers reject missing fields rather than adopt rows.
    tenantId: v7.optional(v7.string()),
    ownerPrincipalId: v7.optional(v7.string()),
    authority: v7.optional(runtimeAuthorityReference),
    // Scope
    organizationId: v7.optional(v7.string()),
    memorySpaceId: v7.optional(v7.string()),
    // Enforcement details
    enforcementType: v7.union(v7.literal("automatic"), v7.literal("manual")),
    layers: v7.array(v7.string()),
    // Which layers were enforced
    rules: v7.array(v7.string()),
    // Which rules were enforced
    // Results
    versionsDeleted: v7.number(),
    recordsPurged: v7.number(),
    storageFreed: v7.number(),
    // MB
    // Metadata
    triggeredBy: v7.optional(v7.string()),
    // Timestamps
    executedAt: v7.number()
  }).index("by_organization", ["organizationId", "executedAt"]).index("by_memorySpace", ["memorySpaceId", "executedAt"]).index("by_executed", ["executedAt"]).index("by_runtime_scope_executed", ["tenantId", "memorySpaceId", "executedAt"]).index("by_runtime_policy", ["policyId"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Graph Sync Queue (Real-time Graph Database Synchronization)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  graphSyncQueue: defineTable4({
    memorySpaceId: v7.optional(v7.string()),
    entityDocumentId: v7.optional(v7.id("facts")),
    entityVersion: v7.optional(v7.number()),
    sourceId: v7.optional(v7.string()),
    sourceEventId: v7.optional(v7.string()),
    sourceRevision: v7.optional(v7.number()),
    // Fresh verified ownership; handlers reject missing fields rather than adopt rows.
    tenantId: v7.optional(v7.string()),
    ownerPrincipalId: v7.optional(v7.string()),
    authority: v7.optional(runtimeAuthorityReference),
    // Entity identification
    table: v7.string(),
    // "memories", "facts", "contexts", "conversations", etc.
    entityId: v7.string(),
    // Cortex entity ID
    // Operation type
    operation: v7.union(
      v7.literal("insert"),
      v7.literal("update"),
      v7.literal("delete")
    ),
    // Entity data (full object for sync)
    entity: v7.optional(v7.any()),
    // Null for deletes
    // Sync status
    synced: v7.boolean(),
    syncedAt: v7.optional(v7.number()),
    // Retry tracking
    failedAttempts: v7.optional(v7.number()),
    lastError: v7.optional(v7.string()),
    // Priority (for ordering)
    priority: v7.optional(v7.string()),
    // "high", "normal", "low"
    // Timestamps
    createdAt: v7.number()
  }).index("by_synced", ["synced"]).index("by_table", ["table"]).index("by_table_entity", ["table", "entityId"]).index("by_priority", ["priority", "synced"]).index("by_created", ["createdAt"]).index("by_runtime_worker_entity", ["tenantId", "memorySpaceId", "authority.grantId", "table", "entityId"]).index("by_runtime_worker_state", ["tenantId", "memorySpaceId", "authority.grantId", "synced", "priority"]),
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Artifacts (Interactive Versioned Documents, memorySpace-scoped)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  artifacts: defineTable4({
    // Identity
    artifactId: v7.string(),
    memorySpaceId: v7.string(),
    participantId: v7.optional(v7.string()),
    // Multi-tenancy
    tenantId: v7.optional(v7.string()),
    // Fresh trusted ownership; caller user/participant labels never grant access.
    ownerPrincipalId: v7.optional(v7.string()),
    lastActorPrincipalId: v7.optional(v7.string()),
    tombstonedAt: v7.optional(v7.number()),
    // Ownership
    userId: v7.optional(v7.string()),
    agentId: v7.optional(v7.string()),
    // Kind
    kind: v7.union(
      v7.literal("text"),
      v7.literal("code"),
      v7.literal("sheet"),
      v7.literal("image"),
      v7.literal("diagram"),
      v7.literal("html"),
      v7.literal("custom")
    ),
    kindConfig: v7.optional(
      v7.object({
        customKind: v7.optional(v7.string()),
        mimeType: v7.optional(v7.string()),
        language: v7.optional(v7.string()),
        framework: v7.optional(v7.string()),
        schema: v7.optional(v7.any())
      })
    ),
    // Content (mutually exclusive)
    content: v7.optional(v7.string()),
    fileRef: v7.optional(
      v7.object({
        storageId: v7.id("_storage"),
        mimeType: v7.string(),
        size: v7.number(),
        checksum: v7.optional(v7.string()),
        originalFilename: v7.optional(v7.string())
      })
    ),
    // Streaming
    streamingState: v7.union(
      v7.literal("draft"),
      v7.literal("streaming"),
      v7.literal("paused"),
      v7.literal("final"),
      v7.literal("error")
    ),
    streamingMetadata: v7.optional(
      v7.object({
        sessionId: v7.optional(v7.string()),
        startedAt: v7.optional(v7.number()),
        lastChunkAt: v7.optional(v7.number()),
        bytesReceived: v7.optional(v7.number()),
        estimatedTotal: v7.optional(v7.number()),
        errorMessage: v7.optional(v7.string()),
        errorCode: v7.optional(v7.string()),
        errorAt: v7.optional(v7.number())
      })
    ),
    // Display
    title: v7.string(),
    description: v7.optional(v7.string()),
    tags: v7.array(v7.string()),
    // References
    conversationRef: v7.optional(
      v7.object({
        conversationId: v7.string(),
        messageId: v7.optional(v7.string()),
        turnIndex: v7.optional(v7.number())
      })
    ),
    memoryRefs: v7.optional(
      v7.array(
        v7.object({
          memoryId: v7.string(),
          relevance: v7.optional(v7.number())
        })
      )
    ),
    // Versioning (Undo/Redo)
    version: v7.number(),
    versionPointer: v7.number(),
    versionHistory: v7.array(
      v7.object({
        version: v7.number(),
        content: v7.optional(v7.string()),
        fileRef: v7.optional(
          v7.object({
            storageId: v7.id("_storage"),
            mimeType: v7.string(),
            size: v7.number(),
            checksum: v7.optional(v7.string()),
            originalFilename: v7.optional(v7.string())
          })
        ),
        title: v7.optional(v7.string()),
        timestamp: v7.number(),
        changedBy: v7.optional(v7.string()),
        changeType: v7.union(
          v7.literal("create"),
          v7.literal("update"),
          v7.literal("undo"),
          v7.literal("redo")
        ),
        changeSummary: v7.optional(v7.string())
      })
    ),
    // Collaboration
    collaborators: v7.optional(
      v7.array(
        v7.object({
          id: v7.string(),
          type: v7.union(v7.literal("user"), v7.literal("agent")),
          role: v7.union(
            v7.literal("owner"),
            v7.literal("editor"),
            v7.literal("viewer")
          ),
          addedAt: v7.number(),
          lastEditAt: v7.optional(v7.number())
        })
      )
    ),
    // Stats
    stats: v7.optional(
      v7.object({
        characterCount: v7.optional(v7.number()),
        wordCount: v7.optional(v7.number()),
        lineCount: v7.optional(v7.number()),
        tokenCount: v7.optional(v7.number())
      })
    ),
    // Metadata
    metadata: v7.optional(v7.any()),
    // Timestamps
    createdAt: v7.number(),
    updatedAt: v7.number(),
    lastAccessedAt: v7.optional(v7.number()),
    accessCount: v7.optional(v7.number()),
    // Soft Delete
    isDeleted: v7.optional(v7.boolean()),
    deletedAt: v7.optional(v7.number()),
    deletedBy: v7.optional(v7.string())
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
    attachmentId: v7.string(),
    // Unique attachment ID
    memorySpaceId: v7.string(),
    // Memory space isolation
    // Multi-tenancy
    tenantId: v7.optional(v7.string()),
    // Tenant ID for SaaS isolation
    // Ownership
    userId: v7.string(),
    // User who uploaded this attachment
    conversationId: v7.optional(v7.string()),
    // Linked conversation
    messageId: v7.optional(v7.string()),
    // Linked message
    memoryId: v7.optional(v7.string()),
    // Linked memory
    artifactId: v7.optional(v7.string()),
    // Linked artifact
    // File storage (Convex native)
    storageId: v7.id("_storage"),
    // Convex file storage reference
    // File metadata
    type: v7.union(
      v7.literal("image"),
      v7.literal("audio"),
      v7.literal("video"),
      v7.literal("file"),
      v7.literal("pdf")
    ),
    mimeType: v7.string(),
    // MIME type (e.g., "image/png")
    filename: v7.string(),
    // Original filename
    size: v7.number(),
    // File size in bytes
    // Extracted content (for future search/RAG - Phase 2+)
    extractedText: v7.optional(v7.string()),
    // OCR/PDF text extraction
    transcript: v7.optional(v7.string()),
    // Audio/video transcription
    embedding: v7.optional(v7.array(v7.float64())),
    // Semantic search embedding
    // Type-specific metadata
    dimensions: v7.optional(
      v7.object({
        width: v7.number(),
        height: v7.number()
      })
    ),
    // Image/video dimensions
    duration: v7.optional(v7.number()),
    // Audio/video duration in seconds
    // Generic metadata
    metadata: v7.optional(v7.any()),
    // Timestamps
    createdAt: v7.number(),
    updatedAt: v7.number()
  }).index("by_attachmentId", ["attachmentId"]).index("by_memorySpace", ["memorySpaceId"]).index("by_memorySpace_type", ["memorySpaceId", "type"]).index("by_memorySpace_created", ["memorySpaceId", "createdAt"]).index("by_tenantId", ["tenantId"]).index("by_tenant_space", ["tenantId", "memorySpaceId"]).index("by_tenant_attachmentId", ["tenantId", "attachmentId"]).index("by_conversation", ["conversationId"]).index("by_message", ["messageId"]).index("by_memory", ["memoryId"]).index("by_artifact", ["artifactId"]).index("by_userId", ["userId"]).index("by_memorySpace_user", ["memorySpaceId", "userId"]).index("by_created", ["createdAt"]).index("by_updated", ["updatedAt"]).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    // OpenAI text-embedding-3-small / ada-002
    filterFields: ["memorySpaceId", "tenantId", "type"]
  })
});

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/schema.ts
var schema_default = defineSchema2({
  ...productionSchema_default.tables,
  qaAdmissionPeerEffects: defineTable5({
    run: v8.string(),
    dispatchDigest: v8.string(),
    requestCount: v8.number(),
    effectCount: v8.number(),
    createdAt: v8.number(),
    marker: v8.optional(v8.string())
  }).index("by_run_dispatch", ["run", "dispatchDigest"])
}, { schemaValidation: productionSchema_default.schemaValidation, strictTableNameTypes: true });

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/qualificationOwned.ts
function valid(run) {
  if (!/^admission-[a-f0-9]{32}$/.test(run)) throw new Error("QA_OWNERSHIP_REJECTED");
}
function tenant(run, value) {
  valid(run);
  if (!value.startsWith(run + "-")) throw new Error("QA_OWNERSHIP_REJECTED");
}
async function rows(ctx, run) {
  valid(run);
  const result = [];
  for (const table of Object.keys(schema_default.tables)) {
    const selected = await ctx.db.query(table).take(321);
    if (selected.length > 320) throw new Error("QA_ROW_CEILING");
    for (const row of selected) result.push({ table, id: row._id, row });
  }
  if (result.length > 320) throw new Error("QA_ROW_CEILING");
  return result;
}
var seed = internalMutation({ args: { run: v9.string(), caseId: v9.string(), subject: v9.string() }, handler: async (ctx, args) => {
  valid(args.run);
  if (!/^[a-z][a-z0-9-]{1,64}$/.test(args.caseId) || !args.subject.startsWith(args.run + "-")) throw new Error("QA_OWNERSHIP_REJECTED");
  const tenantId = args.run + "-" + args.caseId, memorySpaceId = tenantId + "-space", now = Date.now();
  if ((await ctx.db.query("runtimeAuthMemberships").take(321)).some((row) => row.tenantId === tenantId)) throw new Error("QA_DUPLICATE_SEED");
  const principalId = await ctx.db.insert("runtimeAuthPrincipals", { issuer: "https://cortex-qualification.invalid", subject: args.subject, actorKind: "user", version: 1, createdAt: now });
  const membershipId = await ctx.db.insert("runtimeAuthMemberships", { principalId, tenantId, version: 1, createdAt: now });
  const tenantScopeId = await ctx.db.insert("runtimeAuthScopes", { tenantId, epoch: 1, createdAt: now });
  const spaceScopeId = await ctx.db.insert("runtimeAuthScopes", { tenantId, memorySpaceId, epoch: 1, createdAt: now });
  const grantId = await ctx.db.insert("runtimeAuthGrants", { principalId, membershipId, tenantId, memorySpaceId, tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "write", "run", "admin"], resourceAccess: "own", version: 1, createdAt: now });
  const adminGrantId = await ctx.db.insert("runtimeAuthGrants", { principalId, membershipId, tenantId, tenantEpoch: 1, capabilities: ["admin"], resourceAccess: "tenant", version: 1, createdAt: now });
  const reference = { principalId, principalVersion: 1, membershipId, membershipVersion: 1, grantId, grantVersion: 1, tenantId, tenantEpoch: 1, memorySpaceId, memorySpaceEpoch: 1 };
  const adminReference = { principalId, principalVersion: 1, membershipId, membershipVersion: 1, grantId: adminGrantId, grantVersion: 1, tenantId, tenantEpoch: 1 };
  const content = "hello", contentHash = await semanticHash(content), sourceId = tenantId + "-source", sourceEventId = tenantId + "-event";
  const sourceDocumentId = await ctx.db.insert("runtimeMemorySources", { tenantId, memorySpaceId, ownerPrincipalId: principalId, lineage: { sourceId, sourceEventId, sourceRevision: 1, role: "user", trust: "user_assertion" }, content, contentHash, createdAt: now });
  return { reference, adminReference, createdRefs: [{ table: "runtimeAuthPrincipals", id: principalId }, { table: "runtimeAuthMemberships", id: membershipId }, { table: "runtimeAuthScopes", id: tenantScopeId }, { table: "runtimeAuthScopes", id: spaceScopeId }, { table: "runtimeAuthGrants", id: grantId }, { table: "runtimeAuthGrants", id: adminGrantId }, { table: "runtimeMemorySources", id: sourceDocumentId }], source: { sourceId, sourceEventId, sourceRevision: 1, contentHash } };
} });
var snapshot = internalQuery({ args: { run: v9.string() }, handler: async (ctx, args) => await rows(ctx, args.run) });
var fault = v9.union(v9.literal("grant-version"), v9.literal("grant-expiry"), v9.literal("principal-revoke"), v9.literal("membership-revoke"), v9.literal("tenant-delete"), v9.literal("space-delete"), v9.literal("scope-absence"), v9.literal("source-edit"), v9.literal("source-delete"), v9.literal("parent-cancel"), v9.literal("policy-revoke"), v9.literal("qualification-revoke"), v9.literal("identity-collision"), v9.literal("corrupt-counter"), v9.literal("agent-policy-revoke"));
var change = internalMutation({ args: { run: v9.string(), reference: runtimeAuthorityReference, fault, operationId: v9.optional(v9.id("runtimeModelOperations")), attemptId: v9.optional(v9.id("runtimeModelAttempts")) }, handler: async (ctx, args) => {
  tenant(args.run, args.reference.tenantId);
  const now = Date.now();
  const reference = args.reference;
  const deletedRefs = [];
  if (args.fault === "agent-policy-revoke") {
    const selected = await ctx.db.query("runtimeModelPolicies").withIndex("by_policy_version", (q) => q.eq("policyId", "qa-agent-policy").eq("version", 1)).take(2);
    if (selected.length !== 1 || selected[0].tenantId !== reference.tenantId) throw new Error("QA_UNOWNED");
    await ctx.db.patch("runtimeModelPolicies", selected[0]._id, { revokedAt: now });
  } else if (args.fault === "grant-version" || args.fault === "grant-expiry") {
    const id = ctx.db.normalizeId("runtimeAuthGrants", reference.grantId);
    if (!id) throw new Error("QA_BAD_ID");
    const row = await ctx.db.get("runtimeAuthGrants", id);
    if (!row || row.tenantId !== reference.tenantId) throw new Error("QA_UNOWNED");
    await ctx.db.patch("runtimeAuthGrants", id, args.fault === "grant-version" ? { version: row.version + 1 } : { expiresAt: now });
  } else if (args.fault === "principal-revoke") {
    const id = ctx.db.normalizeId("runtimeAuthPrincipals", reference.principalId);
    if (!id) throw new Error("QA_BAD_ID");
    const row = await ctx.db.get("runtimeAuthPrincipals", id);
    if (!row || !row.subject.startsWith(args.run + "-")) throw new Error("QA_UNOWNED");
    await ctx.db.patch("runtimeAuthPrincipals", id, { revokedAt: now });
  } else if (args.fault === "membership-revoke") {
    const id = ctx.db.normalizeId("runtimeAuthMemberships", reference.membershipId);
    if (!id) throw new Error("QA_BAD_ID");
    const row = await ctx.db.get("runtimeAuthMemberships", id);
    if (!row || row.tenantId !== reference.tenantId) throw new Error("QA_UNOWNED");
    await ctx.db.patch("runtimeAuthMemberships", id, { revokedAt: now });
  } else if (["tenant-delete", "space-delete", "scope-absence"].includes(args.fault)) {
    const scopes = await ctx.db.query("runtimeAuthScopes").withIndex("by_tenant_space", (q) => q.eq("tenantId", reference.tenantId)).take(3);
    if (args.fault === "scope-absence") {
      for (const row of scopes) {
        deletedRefs.push({ table: "runtimeAuthScopes", id: row._id });
        await ctx.db.delete("runtimeAuthScopes", row._id);
      }
    } else {
      const space = args.fault === "space-delete";
      await ctx.db.insert("runtimeAuthTombstones", { tenantId: reference.tenantId, ...space ? { memorySpaceId: reference.memorySpaceId } : {}, resourceType: space ? "memorySpace" : "tenant", resourceId: space ? reference.memorySpaceId : reference.tenantId, deletedAt: now });
    }
  } else if (args.fault === "source-edit" || args.fault === "source-delete") {
    const sources = await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) => q.eq("tenantId", reference.tenantId).eq("memorySpaceId", reference.memorySpaceId)).take(2);
    if (sources.length !== 1) throw new Error("QA_SOURCE_AMBIGUOUS");
    const source = sources[0];
    await ctx.db.patch("runtimeMemorySources", source._id, args.fault === "source-edit" ? { lineage: { ...source.lineage, sourceRevision: 2 }, content: "changed", contentHash: await semanticHash("changed") } : { tombstonedAt: now });
  } else if (args.fault === "parent-cancel") {
    if (!args.operationId) throw new Error("QA_BAD_ID");
    const row = await ctx.db.get("runtimeModelOperations", args.operationId);
    if (!row || row.tenantId !== reference.tenantId) throw new Error("QA_UNOWNED");
    await ctx.db.patch("runtimeModelOperations", row._id, { cancelled: true });
  } else if (args.fault === "policy-revoke" || args.fault === "qualification-revoke") {
    if (args.fault === "policy-revoke") {
      const selected = await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", (q) => q.eq("scope", "deployment").eq("tenantId", void 0).eq("active", true)).take(2);
      for (const row of selected) {
        if (row.root.manifestId !== "qa-task04-synthetic-v1") throw new Error("QA_UNOWNED");
        await ctx.db.patch("runtimeModelPolicies", row._id, { revokedAt: now });
      }
    } else {
      const selected = await ctx.db.query("runtimeModelQualifications").withIndex("by_receipt", (q) => q.eq("receiptId", "qa-chat").eq("version", 1)).take(2);
      for (const row of selected) {
        if (row.root.manifestId !== "qa-task04-synthetic-v1") throw new Error("QA_UNOWNED");
        await ctx.db.patch("runtimeModelQualifications", row._id, { revokedAt: now });
      }
    }
  } else if (args.fault === "identity-collision") {
    if (!args.attemptId) throw new Error("QA_BAD_ID");
    const row = await ctx.db.get("runtimeModelAttempts", args.attemptId);
    if (!row) throw new Error("QA_BAD_ID");
    const op = await ctx.db.get("runtimeModelOperations", row.operationDocumentId);
    if (op?.tenantId !== reference.tenantId) throw new Error("QA_UNOWNED");
    await ctx.db.patch("runtimeModelAttempts", row._id, { canonical: canonicalModelJson({ forcedCollision: true }) });
  } else if (args.fault === "corrupt-counter") {
    const accounts = await ctx.db.query("runtimeBudgetAccounts").take(321);
    for (const row of accounts) if (row.tenantId === reference.tenantId) await ctx.db.patch("runtimeBudgetAccounts", row._id, { reservedUnits: Number.MAX_SAFE_INTEGER });
  }
  return { changed: true, deletedRefs };
} });
var parentRollback = internalMutation({ args: { run: v9.string(), reference: runtimeAuthorityReference }, handler: async (ctx, args) => {
  tenant(args.run, args.reference.tenantId);
  await ctx.db.insert("qaAdmissionPeerEffects", { run: args.run, dispatchDigest: "0".repeat(64), requestCount: 0, effectCount: 0, createdAt: Date.now(), marker: "rollback" });
  const bound = await bindTrustedBudget(ctx, { reference: args.reference, operationKey: "agent.respond", requestId: "parent-rollback", requestCanonical: canonicalModelJson({ text: "hello" }) });
  const request = { semanticId: "parent-rollback", childCallId: "estimate", texts: ["hello"], messages: [{ role: "user", parts: [{ type: "text", text: "hello" }] }], inputTokens: 1, outputTokens: 20, toolSteps: 0, timeoutMs: 1e3, reservationUnits: 1, promptVersion: "qa-prompt-1", schemaVersion: "qa-schema-1", extractionVersion: "qa-extract-1", toolRegistryVersion: "qa-tools-1", tools: [], options: { maxRetries: 0 } };
  const reserved = await ctx.runMutation(makeFunctionReference2("runtimeModelPolicy:admit"), { reference: args.reference, operationKey: "agent.respond", runBudgetId: bound.runBudgetId, semanticId: "parent-rollback", ordinal: 0, requestCanonical: canonicalModelJson(request) });
  if (reserved.status !== "reserved") throw new Error("QA_RESERVATION_NOT_OBSERVED");
  throw new ConvexError5({ version: 1, code: "QA_ROLLBACK", message: "Expected fixture transaction rollback", retryable: false, outcome: "rolled_back" });
} });
function isOwned(run, table, row) {
  if (table === "runtimeAuthPrincipals") return typeof row.subject === "string" && row.subject.startsWith(run + "-");
  if (table === "qaAdmissionPeerEffects") return row.run === run;
  if (table === "runtimeModelPolicies" || table === "runtimeModelQualifications") return ["qa-task04-synthetic-v1", "qa-task04-synthetic-embedding-v1"].includes(row.root?.manifestId ?? "");
  if (table === "runtimeModelAttempts") return false;
  return typeof row.tenantId === "string" && row.tenantId.startsWith(run + "-");
}
var cleanup = internalMutation({ args: { run: v9.string() }, handler: async (ctx, args) => {
  const all = await rows(ctx, args.run);
  const ownedOperations = new Set(all.filter((entry) => entry.table === "runtimeModelOperations" && isOwned(args.run, entry.table, entry.row)).map((entry) => String(entry.id)));
  let deleted = 0;
  const deletedRefs = [];
  for (const table of Object.keys(schema_default.tables).reverse()) for (const entry of all.filter((entry2) => entry2.table === table)) {
    if (isOwned(args.run, table, entry.row) || table === "runtimeModelAttempts" && ownedOperations.has(String(entry.row.operationDocumentId))) {
      deletedRefs.push({ table, id: entry.id });
      await ctx.db.delete(entry.id);
      deleted++;
    }
  }
  return { deleted, deletedRefs };
} });
var fabricateRoot = internalMutation({ args: { run: v9.string() }, handler: async (ctx, args) => {
  valid(args.run);
  const manifest = syntheticManifest, canonical2 = canonicalModelJson(manifest);
  const root = { manifestId: manifest.manifestId, revision: manifest.revision, canonical: canonical2, hash: await semanticHash(canonical2), artifactRevision: manifest.artifactRevision, evidenceHash: manifest.evidenceHash, acceptanceHash: manifest.acceptanceHash };
  for (const policy of manifest.policies) await ctx.db.insert("runtimeModelPolicies", { policyId: policy.policyId, version: policy.version, scope: policy.scope === "agent" ? "agent" : "deployment", canonical: canonicalModelJson(policy), root, active: true, createdAt: Date.now(), ...policy.scope === "agent" ? { tenantId: policy.tenantId, agentId: policy.agentId, agentVersion: policy.agentVersion } : {}, ...policy.operationKey ? { operationKey: policy.operationKey } : {} });
  for (const q of manifest.qualifications) await ctx.db.insert("runtimeModelQualifications", { receiptId: q.receiptId, version: manifest.revision, canonical: canonicalModelJson(q), root, active: true, createdAt: Date.now() });
  return { fabricated: true };
} });
export {
  runtimeModelPolicyBootstrap_exports as bootstrap,
  cleanup,
  runtimeModelPolicy_exports as ledger
};
