// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeModelPolicy.ts
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
  const tenant = await reader.getScope(tenantId);
  if (!tenant || tenant.tenantId !== tenantId || tenant.memorySpaceId !== void 0 || tenant.deletedAt !== void 0 || !Number.isSafeInteger(tenant.epoch) || tenant.epoch < 1 || await reader.hasTombstone({ tenantId, resourceType: "tenant", resourceId: tenantId })) deny();
  if (memorySpaceId === void 0) return { tenantEpoch: tenant.epoch };
  const space = await reader.getScope(tenantId, memorySpaceId);
  if (!space || space.tenantId !== tenantId || space.memorySpaceId !== memorySpaceId || space.deletedAt !== void 0 || !Number.isSafeInteger(space.epoch) || space.epoch < 1 || await reader.hasTombstone({ tenantId, memorySpaceId, resourceType: "memorySpace", resourceId: memorySpaceId })) deny();
  return { tenantEpoch: tenant.epoch, memorySpaceEpoch: space.epoch };
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
  const rows = await query.take(2);
  if (rows.length > 1) throw new ConvexError({
    version: 1,
    code: "AUTHORITY_LOOKUP_AMBIGUOUS",
    message: "Authority lookup is ambiguous",
    retryable: false,
    outcome: "not_dispatched"
  });
  return rows[0] ?? null;
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
    const tenant = await ensureScope(ctx, args.tenantId);
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
    if (current[0] && JSON.stringify([...current[0].capabilities].sort()) === JSON.stringify(capabilities) && current[0].resourceAccess === args.resourceAccess && current[0].expiresAt === args.expiresAt && current[0].tenantEpoch === tenant.epoch && current[0].memorySpaceEpoch === space?.epoch) {
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
      tenantEpoch: tenant.epoch,
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
    const rows = await this.ctx.db.query("facts").withIndex("by_tenant_space", (q) => q.eq("tenantId", this.scope.tenantId).eq("memorySpaceId", this.scope.memorySpaceId)).filter((q) => q.and(
      ...authority.resourceAccess === "own" ? [q.eq(q.field("ownerPrincipalId"), authority.principalId)] : [],
      ...query.subject !== void 0 ? [q.eq(q.field("subject"), query.subject)] : [],
      ...query.factType !== void 0 ? [q.eq(q.field("factType"), query.factType)] : []
    )).take(1025);
    if (rows.length > 1024) memoryError("QUERY_TOO_BROAD", "Fact scope exceeds bounded scan; narrower indexed selection is required");
    const facts = [];
    const reader = createAuthorityReader(this.ctx);
    for (const row of rows) {
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
function validateModelRequest(snapshot, input) {
  const detached = JSON.parse(canonicalModelJson(input));
  const request = parse(requestSchema, detached);
  for (const key of ["promptVersion", "schemaVersion", "extractionVersion", "toolRegistryVersion"]) {
    if (request[key] !== snapshot.pins[key]) deny2("request changed pinned versions");
  }
  for (const key of ["inputTokens", "outputTokens", "toolSteps", "timeoutMs"]) {
    if (request[key] > snapshot.limits[key]) deny2("request exceeds bounded limits");
  }
  if (request.inputTokens + request.outputTokens > snapshot.limits.contextTokens || request.reservationUnits > snapshot.limits.operationBudgetUnits || request.reservationUnits < snapshot.costBound.maximumCostUnits) deny2("request exceeds context or operation budget");
  if (request.tools.some((tool) => !snapshot.allowedTools.includes(tool.name)) || new Set(request.tools.map((t) => t.name)).size !== request.tools.length || request.tools.length > 0 && (!snapshot.capabilities.includes("tools") || request.toolSteps === 0)) deny2("tools are not allowed");
  for (const key of Object.keys(request.options)) {
    if (key !== "maxRetries" && key !== "providerOptions" && !snapshot.allowedOptions.includes(key)) deny2("option is not allowed");
  }
  if (snapshot.nativeInterface === "responses") {
    if (request.options.providerOptions?.openai.store !== false) deny2("Responses requires openai.store:false");
  } else if (request.options.providerOptions) deny2("provider options are not allowed on this interface");
  const structured = MODEL_OPERATION_REGISTRY[snapshot.operationKey].capability === "structured";
  if (structured !== (request.outputSchema !== void 0)) deny2("operation schema mismatch");
  if (snapshot.semanticProfile) {
    if (!request.profile || !request.batch) throw new Error("PROFILE_NOT_READY: embedding profile and stable batch boundary required");
    assertProfileMatches(request.profile, snapshot.semanticProfile);
    if (request.batch.end - request.batch.start !== request.texts.length || request.texts.length > 512 || request.outputTokens || request.toolSteps || request.tools.length || request.outputSchema || request.messages) deny2("invalid embedding batch");
  } else if (request.profile || request.batch) deny2("nonembedding request has embedding parameters");
  const texts = request.texts.map(normalizeSourceText);
  const messages = request.messages?.map((message) => ({ ...message, parts: message.parts.map((part) => part.type === "text" ? { ...part, text: normalizeSourceText(part.text) } : part) }));
  if (!snapshot.semanticProfile) {
    if (!messages || canonicalModelJson(messages.flatMap((message) => message.parts.flatMap((part) => part.type === "text" ? [part.text] : []))) !== canonicalModelJson(texts)) {
      deny2("complete dispatch messages must match normalized text inputs");
    }
    for (const message of messages) for (const part of message.parts) {
      if (part.type === "tool-call" && message.role !== "assistant" || part.type === "tool-result" && message.role !== "tool" || message.role === "tool" && part.type !== "tool-result" || part.type !== "text" && (!snapshot.capabilities.includes("tools") || !snapshot.allowedTools.includes(part.toolName))) {
        deny2("invalid message role or unregistered tool part");
      }
    }
  }
  const normalized = { ...request, texts, ...messages ? { messages } : {} };
  const canonical2 = canonicalModelJson({ snapshot, request: normalized });
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
function canFallbackModel(snapshot, candidateModelId, input) {
  let detached;
  try {
    detached = JSON.parse(canonicalModelJson(input));
  } catch {
    return false;
  }
  const result = fallbackEvidenceSchema.safeParse(detached);
  if (!result.success) return false;
  const evidence2 = result.data;
  return !snapshot.semanticProfile && snapshot.fallbackCandidates.some((candidate) => candidate.modelId === candidateModelId) && (evidence2.outcome === "not_dispatched" && evidence2.proof === "pre_dispatch" || evidence2.outcome === "confirmed_rejected" && evidence2.proof === "qualified_rejection") && !evidence2.outputVisible && !evidence2.toolInputVisible && !evidence2.toolResultVisible && !evidence2.toolEffectCommitted && !evidence2.paidLiabilityUncertain && !evidence2.cancelled && evidence2.priorAttemptAccounted && evidence2.currentAuthorityChecked && evidence2.currentSourceChecked && evidence2.currentPolicyChecked;
}

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
function single(rows) {
  if (rows.length > 1) fail("POLICY_DENIED");
  return rows[0];
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
  const rows = await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", (q) => q.eq("scope", "deployment").eq("tenantId", void 0).eq("active", true)).take(65);
  if (!rows.length || rows.length > 64) fail("CAPABILITY_UNAVAILABLE");
  const root = rows[0].root;
  const manifest = await trustedRoot(root);
  if (manifest.dispatchEvidence.some((proof) => proof.checkedAt > Date.now() || Date.now() >= proof.expiresAt)) fail("CAPABILITY_UNAVAILABLE");
  if (rows.length !== manifest.policies.filter((p) => p.scope === "deployment").length || rows.some((row) => row.revokedAt !== void 0 || canonical(row.root) !== canonical(root) || !manifest.policies.some((policy) => policy.policyId === row.policyId && policy.version === row.version && canonical(policy) === row.canonical))) fail("POLICY_DENIED");
  for (const qualification of manifest.qualifications) {
    const row = single(await ctx.db.query("runtimeModelQualifications").withIndex("by_receipt", (q) => q.eq("receiptId", qualification.receiptId).eq("version", root.revision)).take(2));
    if (!row || !row.active || row.revokedAt !== void 0 || row.canonical !== canonical(qualification) || canonical(row.root) !== canonical(root)) fail("CAPABILITY_UNAVAILABLE");
  }
  return { manifest, root };
}
function evidence(manifest, snapshot) {
  const proof = single(manifest.dispatchEvidence.filter((entry) => entry.receiptId === snapshot.qualificationReceiptId));
  if (!proof || proof.modelId !== snapshot.modelId || proof.nativeInterface !== snapshot.nativeInterface) fail("CAPABILITY_UNAVAILABLE");
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
  const rows = await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active", (q) => q.eq("scope", "tenant").eq("tenantId", reference.tenantId).eq("active", true)).take(65);
  if (rows.length > 64) fail("POLICY_DENIED");
  const agentPolicies = agent ? (await readTrustedAgentPolicyVersion(ctx, reference, agent)).policies : [];
  const selected = [
    ...manifest.policies.filter((policy) => policy.scope === "deployment" && (!policy.operationKey || policy.operationKey === key)),
    ...agentPolicies.filter((policy) => !policy.operationKey || policy.operationKey === key)
  ];
  for (const row of rows) {
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
  const snapshot = resolveModelPolicy2(resolution);
  return { root, manifest, resolutionCanonical: canonical(resolution), snapshot };
}
function snapshotOf(record) {
  const snapshot = resolveModelPolicy2(decode(record.resolutionCanonical));
  if (canonical(snapshot) !== record.snapshotCanonical) fail("POLICY_DENIED");
  return snapshot;
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
  const snapshot = snapshotOf(operation);
  const current = await resolveCurrent(ctx, reference, operation.operationKey, run.runBudgetId, operation.source, operation.parentOperationId, run.agentId ? { agentId: run.agentId, version: run.agentVersion } : void 0);
  if (!current.snapshot.allowedModels.includes(snapshot.modelId) || !snapshot.capabilities.every((cap) => current.snapshot.capabilities.includes(cap)) || !current.manifest.qualifications.some((q) => q.receiptId === snapshot.qualificationReceiptId && q.modelId === snapshot.modelId && q.nativeInterface === snapshot.nativeInterface && q.priceRevision === snapshot.pins.priceRevision && q.boundRevision === snapshot.pins.boundRevision)) fail("POLICY_DENIED");
  return { snapshot, run, current };
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
  let tenant = single(await ctx.db.query("runtimeBudgetAccounts").withIndex("by_scope_current", (q) => q.eq("scopeKey", tenantScope).eq("current", true)).take(2));
  if (tenant && (tenant.windowEnd <= now || canonical(tenant.root) !== canonical(resolved.root))) {
    balanced(tenant);
    if (tenant.reservedUnits || tenant.uncertainUnits || tenant.activeConcurrency || tenant.overrun) fail("BUDGET_EXCEEDED");
    if (tenant.windowEnd > now) fail("POLICY_DENIED");
    await ctx.db.patch("runtimeBudgetAccounts", tenant._id, { current: false, version: add(tenant.version, 1) });
    tenant = void 0;
  }
  await finalActor(ctx, args.reference, args.operationKey);
  const counters = { reservedUnits: 0, settledUnits: 0, uncertainUnits: 0, activeConcurrency: 0, overrun: false, current: true, cancelled: false, version: 1, createdAt: now };
  const window = { windowId: canonical([args.reference.tenantId, start, end]), windowStart: start, windowEnd: end, currency: "USD", monetaryUnit: "micro-USD", root: resolved.root };
  if (!tenant) await ctx.db.insert("runtimeBudgetAccounts", {
    accountKey: await semanticHash(canonical([tenantScope, start, end])),
    scopeKey: tenantScope,
    kind: "tenant",
    tenantId: args.reference.tenantId,
    ...window,
    ...counters,
    limitUnits: resolved.snapshot.limits.tenantBudgetUnits,
    concurrencyLimit: resolved.snapshot.limits.concurrency
  });
  else if (tenant.limitUnits !== resolved.snapshot.limits.tenantBudgetUnits || tenant.concurrencyLimit !== resolved.snapshot.limits.concurrency) {
    await ctx.db.patch("runtimeBudgetAccounts", tenant._id, {
      limitUnits: Math.min(tenant.limitUnits, resolved.snapshot.limits.tenantBudgetUnits),
      concurrencyLimit: Math.min(tenant.concurrencyLimit, resolved.snapshot.limits.concurrency),
      version: add(tenant.version, 1)
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
  const snapshot = resolved.snapshot;
  const effectiveSnapshot = "current" in resolved ? resolved.current.snapshot : snapshot;
  const root = "root" in resolved ? resolved.root : run.root;
  const manifest = await trustedRoot(root);
  const proof = evidence(manifest, snapshot);
  const raw = decode(args.requestCanonical);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("INVALID_INPUT");
  const request = raw;
  const childCallId = await semanticHash(canonical([bindingHash, args.ordinal]));
  const preliminary = validateModelRequest2(snapshot, { ...request, semanticId: args.semanticId, childCallId, inputTokens: 1, reservationUnits: snapshot.costBound.maximumCostUnits });
  const bounded = { ...preliminary.request, inputTokens: deriveQualifiedInputBound(proof, preliminary.request) };
  const validated = validateModelRequest2(snapshot, bounded);
  validateModelRequest2({ ...snapshot, limits: effectiveSnapshot.limits, allowedOptions: effectiveSnapshot.allowedOptions, allowedTools: effectiveSnapshot.allowedTools }, validated.request);
  if (args.operationKey === "agent.respond" && args.ordinal > snapshot.limits.toolSteps || validated.request.batch && validated.request.batch.ordinal !== args.ordinal) fail("POLICY_DENIED");
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
  const tenant = single(await ctx.db.query("runtimeBudgetAccounts").withIndex("by_scope_current", (q) => q.eq("scopeKey", canonical(["tenant", args.reference.tenantId])).eq("current", true)).take(2));
  if (!tenant || tenant.windowId !== run.windowId || canonical(tenant.root) !== canonical(root)) fail("BUDGET_EXCEEDED");
  const ceiling = snapshot.costBound.maximumCostUnits;
  capacity(tenant, ceiling, effectiveSnapshot.limits.tenantBudgetUnits, effectiveSnapshot.limits.concurrency);
  capacity(run, ceiling, effectiveSnapshot.limits.runBudgetUnits, effectiveSnapshot.limits.concurrency);
  if (operation && (operation.overrun || operation.cancelled || add(operation.reservedUnits, operation.settledUnits, operation.uncertainUnits, ceiling) > Math.min(snapshot.limits.operationBudgetUnits, effectiveSnapshot.limits.operationBudgetUnits))) fail("BUDGET_EXCEEDED");
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
      snapshotCanonical: canonical(snapshot),
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
    snapshotCanonical: canonical(snapshot),
    inputProofCanonical: canonical({ proof, requestCanonical: canonical(validated.request), inputTokens: validated.request.inputTokens, outputTokens: validated.request.outputTokens }),
    measuredInputTokens: validated.request.inputTokens,
    maximumOutputTokens: validated.request.outputTokens,
    tenantAccountId: tenant._id,
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
  for (const account of [tenant, run]) await ctx.db.patch(
    "runtimeBudgetAccounts",
    account._id,
    { reservedUnits: add(account.reservedUnits, ceiling), activeConcurrency: add(account.activeConcurrency, 1), version: add(account.version, 1) }
  );
  await ctx.db.patch("runtimeModelOperations", operation._id, { reservedUnits: add(operation.reservedUnits, ceiling) });
  return { status: "reserved", operationId: operation._id, attemptId, snapshot, requestCanonical: canonical(validated.request) };
} });
function attemptSnapshot(attempt, operation, manifest) {
  const base = snapshotOf(operation);
  if (attempt.resolutionCanonical !== operation.resolutionCanonical) fail("POLICY_DENIED");
  let snapshot = base;
  if (attempt.fallbackModelId) {
    if (!attempt.priorAttemptId || !base.fallbackCandidates.some((candidate) => candidate.modelId === attempt.fallbackModelId)) fail("POLICY_DENIED");
    const qualification = single(manifest.qualifications.filter((entry) => entry.modelId === attempt.fallbackModelId && entry.nativeInterface === base.nativeInterface && base.fallbackCandidates.some((candidate) => candidate.qualificationReceiptId === entry.receiptId)));
    if (!qualification) fail("CAPABILITY_UNAVAILABLE");
    snapshot = { ...base, modelId: qualification.modelId, qualificationReceiptId: qualification.receiptId, costBound: qualification.costBound };
  } else if (attempt.priorAttemptId) fail("POLICY_DENIED");
  if (canonical(snapshot) !== attempt.snapshotCanonical || snapshot.costBound.maximumCostUnits !== attempt.reservationUnits) fail("POLICY_DENIED");
  return snapshot;
}
async function attemptContext(ctx, attemptId) {
  const attempt = await ctx.db.get("runtimeModelAttempts", attemptId);
  if (!attempt) fail("FORBIDDEN");
  const operation = await ctx.db.get("runtimeModelOperations", attempt.operationDocumentId);
  const tenant = await ctx.db.get("runtimeBudgetAccounts", attempt.tenantAccountId);
  const run = await ctx.db.get("runtimeBudgetAccounts", attempt.runAccountId);
  if (!operation || !tenant || !run || run._id !== operation.runAccountId || tenant.tenantId !== operation.tenantId || run.tenantId !== operation.tenantId || tenant.windowId !== run.windowId || tenant.kind !== "tenant" || run.kind !== "run") fail("FORBIDDEN");
  balanced(tenant);
  balanced(run);
  integer2(attempt.reservationUnits, 1);
  if (!run.reference || !sameAuthority(run.reference, operation.reference)) fail("POLICY_DENIED");
  const manifest = await trustedRoot(run.root);
  const snapshot = attemptSnapshot(attempt, operation, manifest);
  const proof = evidence(manifest, snapshot);
  return { attempt, operation, tenant, run, snapshot, proof };
}
var attemptArgs = { reference: runtimeAuthorityReference, attemptId: v5.id("runtimeModelAttempts") };
var checkpoint = internalMutation({ args: { ...attemptArgs, requestCanonical: v5.string() }, handler: async (ctx, args) => {
  const { attempt, operation, snapshot, proof, run, tenant } = await attemptContext(ctx, args.attemptId);
  const checked = await currentOperation(ctx, args.reference, operation);
  if (Date.now() >= run.windowEnd) fail("BUDGET_EXCEEDED");
  if (!checked.current.snapshot.allowedModels.includes(snapshot.modelId) || checked.current.snapshot.nativeInterface !== snapshot.nativeInterface || !checked.current.manifest.qualifications.some((q) => q.receiptId === snapshot.qualificationReceiptId && q.modelId === snapshot.modelId && q.nativeInterface === snapshot.nativeInterface && q.priceRevision === snapshot.pins.priceRevision && q.boundRevision === snapshot.pins.boundRevision)) fail("POLICY_DENIED");
  const raw = decode(args.requestCanonical);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("INVALID_INPUT");
  const request = raw;
  if (request.semanticId !== operation.semanticId || request.childCallId !== attempt.childCallId || request.inputTokens !== deriveQualifiedInputBound(proof, validateModelRequest2(snapshot, request).request) || request.reservationUnits !== attempt.reservationUnits) fail("IDEMPOTENCY_CONFLICT");
  const validated = validateModelRequest2(snapshot, request);
  validateModelRequest2({ ...snapshot, limits: checked.current.snapshot.limits, allowedOptions: checked.current.snapshot.allowedOptions, allowedTools: checked.current.snapshot.allowedTools }, validated.request);
  if (attempt.measuredInputTokens !== validated.request.inputTokens || attempt.maximumOutputTokens !== validated.request.outputTokens || attempt.inputProofCanonical !== canonical({ proof, requestCanonical: canonical(validated.request), inputTokens: validated.request.inputTokens, outputTokens: validated.request.outputTokens })) fail("POLICY_DENIED");
  assertModelRequestIdentity2({ canonical: attempt.canonical, hash: attempt.hash }, { canonical: validated.canonical, hash: await semanticHash(validated.canonical) });
  if (attempt.state !== "reserved") return { dispatchPermit: false, state: attempt.state, replayAllowed: false };
  const pinned = snapshotOf(operation).limits;
  const current = checked.current.snapshot.limits;
  if (operation.overrun || add(operation.reservedUnits, operation.uncertainUnits, operation.settledUnits) > Math.min(pinned.operationBudgetUnits, current.operationBudgetUnits)) fail("BUDGET_EXCEEDED");
  heldCapacity(tenant, Math.min(pinned.tenantBudgetUnits, current.tenantBudgetUnits), Math.min(pinned.concurrency, current.concurrency));
  heldCapacity(run, Math.min(pinned.runBudgetUnits, current.runBudgetUnits), Math.min(pinned.concurrency, current.concurrency));
  if (attempt.fallbackModelId) {
    const prior = await attemptContext(ctx, attempt.priorAttemptId);
    if (prior.operation._id !== operation._id || prior.attempt.childCallId !== attempt.childCallId || !fallbackAllowed(prior.attempt, operation, prior.snapshot, attempt.fallbackModelId) || !fallbackAllowed(prior.attempt, operation, checked.current.snapshot, attempt.fallbackModelId)) fail("POLICY_DENIED");
  }
  await finalActor(ctx, args.reference, operation.operationKey);
  if (proof.checkedAt > Date.now() || Date.now() >= proof.expiresAt) fail("CAPABILITY_UNAVAILABLE");
  await ctx.db.patch("runtimeModelAttempts", attempt._id, { state: "dispatch_pending", checkpointAt: Date.now() });
  return { dispatchPermit: true, dispatchIdentity: attempt.dispatchIdentity, snapshot, requestCanonical: canonical(validated.request) };
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
  const { attempt, operation, tenant, run } = state;
  if (attempt.state === "settled" || attempt.state === "not_dispatched" || attempt.state === "confirmed_rejected") return { state: attempt.state, replayAllowed: false };
  if (attempt.state === "reserved") fail("POLICY_DENIED");
  const newlyUnknown = attempt.state !== "uncertain";
  const release = Boolean(terminalCanonical) && !attempt.slotReleased;
  for (const account of [tenant, run]) await ctx.db.patch("runtimeBudgetAccounts", account._id, {
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
function validatedPrivateResult(snapshot, attempt, encoded) {
  if (!encoded || new TextEncoder().encode(encoded).length > MODEL_LEDGER_STORAGE_LIMITS.privateResultBytes) return void 0;
  try {
    const result = decode(encoded);
    if (snapshot.nativeInterface === "chat" && !snapshot.semanticProfile) {
      if (!z2.object({ text: z2.string().min(1) }).strict().safeParse(result).success) return void 0;
    } else if (snapshot.nativeInterface === "embedding" && snapshot.semanticProfile) {
      const parsed = z2.object({
        profile: z2.object({ profileId: z2.string(), modelId: z2.string(), dimensions: count, normalization: z2.string(), chunking: z2.string(), indexName: z2.string() }).strict(),
        vectors: z2.array(z2.array(z2.number().finite()))
      }).strict().safeParse(result);
      if (!parsed.success) return void 0;
      assertProfileMatches(parsed.data.profile, snapshot.semanticProfile);
      const original = decode(attempt.canonical);
      if (!original || typeof original !== "object" || Array.isArray(original)) return void 0;
      const request = validateModelRequest2(snapshot, original.request).request;
      if (parsed.data.vectors.length !== request.texts.length) return void 0;
      parsed.data.vectors.forEach((vector) => assertEmbeddingVector(vector, snapshot.semanticProfile));
    } else return void 0;
    return encoded;
  } catch {
    return void 0;
  }
}
async function settleAttempt(ctx, reference, attemptId, receiptCanonical, liabilityOnly, deploymentRetirement = false) {
  const state = await attemptContext(ctx, attemptId);
  const { attempt, operation, snapshot, proof, tenant, run } = state;
  if (deploymentRetirement) await retiredScope(ctx, operation);
  else if (liabilityOnly) await liabilityAuthority(ctx, reference, operation);
  else if (!sameAuthority(reference, operation.reference)) fail("FORBIDDEN");
  const canDeliver = !liabilityOnly && await permittedResult(ctx, reference, operation);
  if (!liabilityOnly) await currentAuthority(ctx, reference, operation.operationKey);
  const parsed = receiptSchema.safeParse(decode(receiptCanonical));
  if (!parsed.success) return await writeUnknown(ctx, state);
  const receipt = parsed.data;
  if (receipt.dispatchIdentity !== attempt.dispatchIdentity || receipt.modelId !== snapshot.modelId || receipt.nativeInterface !== snapshot.nativeInterface) fail("IDEMPOTENCY_CONFLICT", "uncertain");
  const { privateResultCanonical: _privateResult, ...chargeReceipt } = receipt;
  const chargeCanonical = canonical(chargeReceipt);
  const receiptHash = await semanticHash(chargeCanonical);
  if (attempt.receiptCanonical) {
    assertModelRequestIdentity2({ canonical: attempt.receiptCanonical, hash: attempt.receiptHash }, { canonical: chargeCanonical, hash: receiptHash }, "uncertain");
    const candidateResult = canDeliver ? validatedPrivateResult(snapshot, attempt, receipt.privateResultCanonical) : void 0;
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
  const privateResult = canDeliver && receipt.outcome === "confirmed" ? validatedPrivateResult(snapshot, attempt, receipt.privateResultCanonical) : void 0;
  const deliverResult = canDeliver && privateResult !== void 0;
  const fromUnknown = attempt.state === "uncertain";
  integer2(attempt.measuredInputTokens, 1);
  integer2(attempt.maximumOutputTokens);
  const overrun = cost > attempt.reservationUnits || receipt.usage?.inputTokens !== void 0 && receipt.usage.inputTokens > attempt.measuredInputTokens || receipt.usage?.outputTokens !== void 0 && receipt.usage.outputTokens > attempt.maximumOutputTokens;
  for (const account of [tenant, run]) await ctx.db.patch("runtimeBudgetAccounts", account._id, {
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
    costProvenance: canonical([proof.evidenceHash, snapshot.pins.priceRevision, receipt.costSource]),
    resultWithheld: !deliverResult,
    ...receipt.actualModel ? { actualModel: receipt.actualModel } : {},
    ...deliverResult ? { privateResultCanonical: privateResult } : {}
  });
  return { state: finalState, settledCostUnits: cost, resultWithheld: !deliverResult, overrun };
}
async function retiredScope(ctx, operation) {
  const reader = createAuthorityReader(ctx);
  const tenant = await reader.getScope(operation.tenantId);
  const space = await reader.getScope(operation.tenantId, operation.memorySpaceId);
  const retired = tenant?.deletedAt !== void 0 || space?.deletedAt !== void 0 || await reader.hasTombstone({ tenantId: operation.tenantId, resourceType: "tenant", resourceId: operation.tenantId }) || await reader.hasTombstone({ tenantId: operation.tenantId, memorySpaceId: operation.memorySpaceId, resourceType: "memorySpace", resourceId: operation.memorySpaceId });
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
  const { attempt, operation, tenant, run } = await attemptContext(ctx, args.attemptId);
  await currentOperation(ctx, args.reference, operation, true);
  if (attempt.state === "not_dispatched") return { state: "not_dispatched" };
  if (attempt.state !== "reserved" || attempt.checkpointAt !== void 0) fail("UNCERTAIN_OUTCOME", "uncertain");
  for (const account of [tenant, run]) await ctx.db.patch("runtimeBudgetAccounts", account._id, {
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
function fallbackAllowed(attempt, operation, snapshot, candidateModelId) {
  return candidateModelId !== snapshot.modelId && canFallbackModel(snapshot, candidateModelId, {
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
  const { attempt, operation, run, tenant, snapshot } = state;
  const checked = await currentOperation(ctx, args.reference, operation);
  if (!fallbackAllowed(attempt, operation, snapshot, args.candidateModelId) || !fallbackAllowed(attempt, operation, checked.current.snapshot, args.candidateModelId)) fail("POLICY_DENIED");
  const nextNumber = add(attempt.attemptNumber, 1);
  if (nextNumber > 64) fail("POLICY_DENIED");
  const existing = single(await ctx.db.query("runtimeModelAttempts").withIndex("by_child_attempt", (q) => q.eq("operationDocumentId", operation._id).eq("childCallId", attempt.childCallId).eq("attemptNumber", nextNumber)).take(2));
  if (existing) {
    if (existing.priorAttemptId !== attempt._id || existing.fallbackModelId !== args.candidateModelId) fail("IDEMPOTENCY_CONFLICT");
    return { status: "inflight", attemptId: existing._id };
  }
  const candidate = single(checked.current.manifest.qualifications.filter((q) => q.modelId === args.candidateModelId && q.nativeInterface === snapshot.nativeInterface && snapshot.fallbackCandidates.some((entry) => entry.qualificationReceiptId === q.receiptId)));
  if (!candidate) fail("CAPABILITY_UNAVAILABLE");
  const nextSnapshot = { ...snapshotOf(operation), modelId: candidate.modelId, qualificationReceiptId: candidate.receiptId, costBound: candidate.costBound };
  const proof = evidence(checked.current.manifest, nextSnapshot);
  const decoded = decode(attempt.canonical);
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) fail("POLICY_DENIED");
  const old = validateModelRequest2(snapshot, decoded.request);
  const next = validateModelRequest2(nextSnapshot, { ...old.request, inputTokens: deriveQualifiedInputBound(proof, old.request), reservationUnits: candidate.costBound.maximumCostUnits });
  const ceiling = candidate.costBound.maximumCostUnits;
  capacity(tenant, ceiling, Math.min(nextSnapshot.limits.tenantBudgetUnits, checked.current.snapshot.limits.tenantBudgetUnits), checked.current.snapshot.limits.concurrency);
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
    tenantAccountId: tenant._id,
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
  for (const account of [tenant, run]) await ctx.db.patch("runtimeBudgetAccounts", account._id, { reservedUnits: add(account.reservedUnits, ceiling), activeConcurrency: add(account.activeConcurrency, 1), version: add(account.version, 1) });
  await ctx.db.patch("runtimeModelOperations", operation._id, { reservedUnits: add(operation.reservedUnits, ceiling) });
  return { status: "reserved", operationId: operation._id, attemptId: nextId, snapshot: nextSnapshot, requestCanonical: canonical(next.request) };
} });
var checkFallback = internalQuery({ args: { ...attemptArgs, candidateModelId: v5.string() }, handler: async (ctx, args) => {
  const { attempt, operation, snapshot } = await attemptContext(ctx, args.attemptId);
  const checked = await currentOperation(ctx, args.reference, operation);
  return { allowed: fallbackAllowed(attempt, operation, snapshot, args.candidateModelId) && fallbackAllowed(attempt, operation, checked.current.snapshot, args.candidateModelId) };
} });
export {
  DEFAULT_EMBEDDING_PROFILE,
  installDeploymentPolicy,
  resolveModelPolicy,
  syntheticEmbeddingManifest,
  syntheticManifest
};
