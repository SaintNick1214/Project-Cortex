/** Additive fresh-install fragment. Host auth.config and HTTP routes remain host-owned. */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const runtimeCapability = v.union(
  v.literal("read"), v.literal("write"), v.literal("run"), v.literal("admin"),
  v.literal("tool"), v.literal("storage:read"), v.literal("storage:write"),
);
export const runtimeResourceAccess = v.union(v.literal("own"), v.literal("space"), v.literal("tenant"));
export const runtimeActorKind = v.union(v.literal("user"), v.literal("service"));
export const runtimeResourceType = v.union(
  v.literal("tenant"), v.literal("memorySpace"), v.literal("conversation"),
  v.literal("memory"), v.literal("fact"), v.literal("artifact"), v.literal("attachment"),
  v.literal("source"), v.literal("run"), v.literal("context"), v.literal("storage"),
);

export const runtimeAuthorityReference = v.object({
  principalId: v.string(), principalVersion: v.number(),
  membershipId: v.string(), membershipVersion: v.number(),
  grantId: v.string(), grantVersion: v.number(),
  tenantId: v.string(), tenantEpoch: v.number(),
  memorySpaceId: v.optional(v.string()), memorySpaceEpoch: v.optional(v.number()),
});
export const runtimeResource = v.object({
  resourceType: runtimeResourceType, resourceId: v.string(),
  tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()),
  ownerPrincipalId: v.optional(v.string()),
});
export const runtimeAuthorityRequirement = v.object({
  capability: runtimeCapability, tenantId: v.optional(v.string()),
  memorySpaceId: v.optional(v.string()), resource: v.optional(runtimeResource),
  actorKind: v.optional(runtimeActorKind),
});

export const runtimeAuthTables = {
  runtimeAuthPrincipals: defineTable({
    issuer: v.string(), subject: v.string(), actorKind: runtimeActorKind,
    metadataUserId: v.optional(v.string()), version: v.number(), createdAt: v.number(),
    revokedAt: v.optional(v.number()), deletedAt: v.optional(v.number()),
  }).index("by_issuer_subject", ["issuer", "subject"]),
  runtimeAuthMemberships: defineTable({
    principalId: v.id("runtimeAuthPrincipals"), tenantId: v.string(),
    version: v.number(), createdAt: v.number(),
    revokedAt: v.optional(v.number()), deletedAt: v.optional(v.number()),
  }).index("by_principal_tenant", ["principalId", "tenantId"]),
  runtimeAuthScopes: defineTable({
    tenantId: v.string(), memorySpaceId: v.optional(v.string()), epoch: v.number(),
    createdAt: v.number(), deletedAt: v.optional(v.number()),
  }).index("by_tenant_space", ["tenantId", "memorySpaceId"]),
  runtimeAuthGrants: defineTable({
    principalId: v.id("runtimeAuthPrincipals"), membershipId: v.id("runtimeAuthMemberships"),
    tenantId: v.string(), memorySpaceId: v.optional(v.string()),
    tenantEpoch: v.number(), memorySpaceEpoch: v.optional(v.number()),
    capabilities: v.array(runtimeCapability), resourceAccess: runtimeResourceAccess,
    version: v.number(), createdAt: v.number(), expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()), deletedAt: v.optional(v.number()),
  }).index("by_membership", ["membershipId"])
    .index("by_membership_scope_version", ["membershipId", "memorySpaceId", "version"]),
  runtimeAuthTombstones: defineTable({
    tenantId: v.string(), memorySpaceId: v.optional(v.string()),
    resourceType: runtimeResourceType, resourceId: v.string(), deletedAt: v.number(),
  }).index("by_resource", ["tenantId", "memorySpaceId", "resourceType", "resourceId"]),
};
