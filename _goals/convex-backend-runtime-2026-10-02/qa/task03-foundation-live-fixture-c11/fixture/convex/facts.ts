/**
 * Cortex SDK - Facts Store API (Layer 3)
 *
 * LLM-extracted, memorySpace-scoped, versioned facts
 * Structured knowledge with relationships
 */

import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import type { CanonicalSourceWitness, HistoricalFactView } from "./runtimeDataAuth";
import { prepareMutationRowsWrite, finalizeMutationRowsRead, recheckSourceWitnesses, finalizeDataRead, factMutationResult, getHistoricalScopedFact, dataEditor, assertDataLinks, assertDataRow, bindDataActor, dataDenied, getScopedFact,
  listScopedFacts, manualDataSource, recheckDataAuthority,
  requireDataAuthority, requireActionDataAuthority, recheckActionDataAuthority,
  getScopedFactDocument, rejectUnqualifiedEmbedding, reviseDataSource, searchScopedFacts, tombstoneDataRow,
} from "./runtimeDataAuth";
import { Doc } from "./_generated/dataModel";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Store a new fact
 */
export const store = mutation({
  args: {
    memorySpaceId: v.string(),
    participantId: v.optional(v.string()), // Hive Mode: who extracted this fact
    userId: v.optional(v.string()), // GDPR compliance - links to user
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    fact: v.string(), // The fact statement
    factType: v.union(
      v.literal("preference"),
      v.literal("identity"),
      v.literal("knowledge"),
      v.literal("relationship"),
      v.literal("event"),
      v.literal("observation"),
      v.literal("custom"),
    ),
    subject: v.optional(v.string()), // Primary entity (e.g., "user-123")
    predicate: v.optional(v.string()), // Relationship (e.g., "prefers", "works_at")
    object: v.optional(v.string()), // Secondary entity (e.g., "dark mode")
    confidence: v.number(), // 0-100: extraction confidence
    sourceType: v.union(
      v.literal("conversation"),
      v.literal("system"),
      v.literal("tool"),
      v.literal("manual"),
      v.literal("a2a"),
      v.literal("fact-extraction"), // For fact-extracted content
    ),
    sourceRef: v.optional(
      v.object({
        conversationId: v.optional(v.string()),
        messageIds: v.optional(v.array(v.string())),
        memoryId: v.optional(v.string()),
      }),
    ),
    metadata: v.optional(v.any()),
    tags: v.array(v.string()),
    validFrom: v.optional(v.number()), // Temporal validity
    validUntil: v.optional(v.number()),
    // Enrichment fields (for bullet-proof retrieval)
    category: v.optional(v.string()), // Specific sub-category (e.g., "addressing_preference")
    searchAliases: v.optional(v.array(v.string())), // Alternative search terms
    semanticContext: v.optional(v.string()), // Usage context sentence
    entities: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          fullValue: v.optional(v.string()),
        }),
      ),
    ), // Extracted entities with types
    relations: v.optional(
      v.array(
        v.object({
          subject: v.string(),
          predicate: v.string(),
          object: v.string(),
        }),
      ),
    ), // Subject-predicate-object triples for graph
    // Embedding for semantic search (v0.30.0+)
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const capability = "write" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    const now = Date.now();
    const factId = `fact-${now}-${Math.random().toString(36).substring(2, 11)}`;
    rejectUnqualifiedEmbedding(args.embedding);
    bindDataActor(authority, args.userId);
    bindDataActor(authority, args.participantId);
    await assertDataLinks(ctx, authority, capability, args);
    const manualSourceBinding = { resourceType: "fact" as const, resourceId: factId };
    const lineage = await manualDataSource(ctx, authority, manualSourceBinding, args.fact);

    await ctx.db.insert("facts", {
      factId,
      ownerPrincipalId: authority.principalId,
      runtimeEditor: dataEditor(authority),
      lineage,
      manualSourceBinding,
      extractionPolicyVersion: "manual-assertion-v1",
      memorySpaceId: args.memorySpaceId,
      participantId: authority.userId,
      userId: authority.userId,
      tenantId: authority.tenantId, // Store tenantId
      fact: args.fact,
      factType: args.factType,
      subject: args.subject,
      predicate: args.predicate,
      object: args.object,
      confidence: args.confidence,
      sourceType: "manual",
      sourceRef: args.sourceRef,
      metadata: args.metadata,
      tags: args.tags,
      validFrom: args.validFrom || now,
      validUntil: args.validUntil,
      // Enrichment fields
      category: args.category,
      searchAliases: args.searchAliases,
      semanticContext: args.semanticContext,
      entities: args.entities,
      relations: args.relations,
      // Embedding for semantic search
      embedding: args.embedding,
      version: 1,
      supersededBy: undefined,
      supersedes: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return await factMutationResult(ctx, authority, factId, authority.principalId, "store");
  },
});

/**
 * Update a fact (creates new version, marks old as superseded)
 */
export const update = mutation({
  args: {
    memorySpaceId: v.string(),
    factId: v.string(),
    fact: v.optional(v.string()),
    confidence: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    validUntil: v.optional(v.number()),
    metadata: v.optional(v.any()),
    // Enrichment fields (for bullet-proof retrieval)
    category: v.optional(v.string()),
    searchAliases: v.optional(v.array(v.string())),
    semanticContext: v.optional(v.string()),
    entities: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          fullValue: v.optional(v.string()),
        }),
      ),
    ),
    relations: v.optional(
      v.array(
        v.object({
          subject: v.string(),
          predicate: v.string(),
          object: v.string(),
        }),
      ),
    ),
    // Embedding for semantic search (v0.30.0+)
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const capability = "write" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    rejectUnqualifiedEmbedding(args.embedding);
    const existing = await getScopedFact(ctx, authority, args.factId, capability);

    if (!existing) {
      throw new ConvexError("FACT_NOT_FOUND");
    }

    // Verify memorySpace owns this fact
    if (existing.memorySpaceId !== args.memorySpaceId) {
      throw new ConvexError("PERMISSION_DENIED");
    }

    if (existing.supersededBy || (existing.validUntil !== undefined && existing.validUntil <= Date.now())) dataDenied();
    const now = Date.now();
    const newFactId = `fact-${now}-${Math.random().toString(36).substring(2, 11)}`;

    // Create new version (manually copy fields to avoid _id/_creationTime)
    const { lineage, manualSourceBinding } = await reviseDataSource(ctx, authority, existing, args.fact ?? existing.fact, newFactId);
    await ctx.db.insert("facts", {
      factId: newFactId,
      ownerPrincipalId: existing.ownerPrincipalId,
      runtimeEditor: dataEditor(authority),
      lineage,
      manualSourceBinding,
      extractionPolicyVersion: "manual-assertion-v1",
      memorySpaceId: existing.memorySpaceId,
      participantId: existing.participantId,
      userId: existing.userId, // GDPR compliance - preserve user link across versions
      tenantId: existing.tenantId, // Multi-tenancy: preserve tenant isolation across versions
      fact: args.fact || existing.fact,
      factType: existing.factType,
      subject: existing.subject,
      predicate: existing.predicate,
      object: existing.object,
      confidence:
        args.confidence !== undefined ? args.confidence : existing.confidence,
      sourceType: "manual",
      sourceRef: existing.sourceRef,
      metadata: args.metadata !== undefined ? args.metadata : existing.metadata,
      tags: args.tags || existing.tags,
      validFrom: existing.validFrom,
      validUntil:
        args.validUntil !== undefined ? args.validUntil : existing.validUntil,
      // Enrichment fields - preserve from existing or update
      category: args.category !== undefined ? args.category : existing.category,
      searchAliases:
        args.searchAliases !== undefined
          ? args.searchAliases
          : existing.searchAliases,
      semanticContext:
        args.semanticContext !== undefined
          ? args.semanticContext
          : existing.semanticContext,
      entities: args.entities !== undefined ? args.entities : existing.entities,
      relations:
        args.relations !== undefined ? args.relations : existing.relations,
      // Embedding - use new if provided, else preserve existing
      embedding:
        args.embedding !== undefined ? args.embedding : existing.embedding,
      version: existing.version + 1,
      supersedes: existing.factId, // Link to previous
      supersededBy: undefined,
      createdAt: existing.createdAt, // Preserve original creation time across versions
      updatedAt: now,
    });

    // Mark old as superseded
    await ctx.db.patch(existing._id, {
      supersededBy: newFactId,
      validUntil: now,
    });

    return await factMutationResult(ctx, authority, newFactId, existing.ownerPrincipalId!, "update");
  },
});

/**
 * Delete a fact (soft delete - mark as invalidated)
 */
export const deleteFact = mutation({
  args: {
    memorySpaceId: v.string(),
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const capability = "write" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    const fact = await getScopedFact(ctx, authority, args.factId, capability);

    if (!fact) {
      throw new ConvexError("FACT_NOT_FOUND");
    }

    // Verify memorySpace owns this fact
    if (fact.memorySpaceId !== args.memorySpaceId) {
      throw new ConvexError("PERMISSION_DENIED");
    }

    await tombstoneDataRow(ctx, authority, "facts", fact);

    return { deleted: true, factId: args.factId };
  },
});

/**
 * Supersede a fact with a new one (belief revision)
 * Marks the old fact as superseded and creates a relationship to the new fact
 */
export const supersede = mutation({
  args: {
    memorySpaceId: v.string(),
    oldFactId: v.string(),
    newFactId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const capability = "write" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    const admittedSources: CanonicalSourceWitness[] = [];
    const oldFact = await getScopedFact(ctx, authority, args.oldFactId, capability, new Set<string>(), undefined, admittedSources);

    if (!oldFact) {
      throw new ConvexError("OLD_FACT_NOT_FOUND");
    }

    // Verify memorySpace owns this fact
    if (oldFact.memorySpaceId !== args.memorySpaceId) {
      throw new ConvexError("PERMISSION_DENIED");
    }

    const newFact = await getScopedFact(ctx, authority, args.newFactId, capability, new Set<string>(), undefined, admittedSources);

    if (!newFact) {
      throw new ConvexError("NEW_FACT_NOT_FOUND");
    }

    // Verify new fact is in the same memory space
    if (newFact.memorySpaceId !== args.memorySpaceId) {
      throw new ConvexError("FACTS_MUST_BE_IN_SAME_SPACE");
    }

    if (oldFact.factId === newFact.factId || oldFact.supersededBy || newFact.supersededBy
      || (oldFact.validUntil !== undefined && oldFact.validUntil <= Date.now())
      || (newFact.validUntil !== undefined && newFact.validUntil <= Date.now())) dataDenied();
    const now = Date.now();

    await recheckSourceWitnesses(ctx, authority, capability, admittedSources);
    // Mark old fact as superseded
    await ctx.db.patch(oldFact._id, { runtimeEditor: dataEditor(authority),
      supersededBy: args.newFactId,
      validUntil: now,
      updatedAt: now,
    });

    // Update new fact to reference old
    await ctx.db.patch(newFact._id, { runtimeEditor: dataEditor(authority),
      supersedes: args.oldFactId,
      updatedAt: now,
    });

    const witnesses = [...admittedSources, ...await assertDataRow(ctx, authority, capability, oldFact), ...await assertDataRow(ctx, authority, capability, newFact)];
    await recheckSourceWitnesses(ctx, authority, capability, witnesses);
    return {
      superseded: true,
      oldFactId: args.oldFactId,
      newFactId: args.newFactId,
      reason: args.reason,
    };
  },
});

/**
 * Update a fact in place (without creating new version)
 * Used by belief revision for UPDATE action
 */
export const updateInPlace = mutation({
  args: {
    memorySpaceId: v.string(),
    factId: v.string(),
    fact: v.optional(v.string()),
    confidence: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    validUntil: v.optional(v.number()),
    metadata: v.optional(v.any()),
    // Enrichment fields
    category: v.optional(v.string()),
    searchAliases: v.optional(v.array(v.string())),
    semanticContext: v.optional(v.string()),
    entities: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          fullValue: v.optional(v.string()),
        }),
      ),
    ),
    relations: v.optional(
      v.array(
        v.object({
          subject: v.string(),
          predicate: v.string(),
          object: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const capability = "write" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    const existing = await getScopedFact(ctx, authority, args.factId, capability);

    if (!existing) {
      throw new ConvexError("FACT_NOT_FOUND");
    }

    // Verify memorySpace owns this fact
    if (existing.memorySpaceId !== args.memorySpaceId) {
      throw new ConvexError("PERMISSION_DENIED");
    }

    if (existing.supersededBy || (existing.validUntil !== undefined && existing.validUntil <= Date.now())) dataDenied();
    const now = Date.now();

    // Build update object with only provided fields
    const updates: Partial<Omit<Doc<"facts">, "_id" | "_creationTime">> = {
      updatedAt: now,
    };

    if (args.fact !== undefined) updates.fact = args.fact;
    if (args.confidence !== undefined) updates.confidence = args.confidence;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.validUntil !== undefined) updates.validUntil = args.validUntil;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.category !== undefined) updates.category = args.category;
    if (args.searchAliases !== undefined)
      updates.searchAliases = args.searchAliases;
    if (args.semanticContext !== undefined)
      updates.semanticContext = args.semanticContext;
    if (args.entities !== undefined) updates.entities = args.entities;
    if (args.relations !== undefined) updates.relations = args.relations;

    const { lineage, manualSourceBinding } = await reviseDataSource(ctx, authority, existing, args.fact ?? existing.fact);
    await ctx.db.patch(existing._id, { ...updates, runtimeEditor: dataEditor(authority), lineage, manualSourceBinding, sourceType: "manual", extractionPolicyVersion: "manual-assertion-v1", version: existing.version + 1 });

    return await factMutationResult(ctx, authority, existing.factId, existing.ownerPrincipalId!, "updateInPlace");
  },
});

/**
 * Delete many facts matching filters
 */
export const deleteMany = mutation({
  args: {
    memorySpaceId: v.string(),
    userId: v.optional(v.string()),
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("observation"),
        v.literal("custom"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const capability = "write" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    let facts = await listScopedFacts(ctx, authority, capability);

    // Apply optional filters
    if (args.userId) {
      facts = facts.filter((f) => f.userId === args.userId);
    }
    if (args.factType) {
      facts = facts.filter((f) => f.factType === args.factType);
    }

    const admission = await prepareMutationRowsWrite(ctx, authority, facts);
    const deletions = [];
    let deleted = 0;
    for (const fact of facts) {
      deletions.push(await tombstoneDataRow(ctx, authority, "facts", fact));
      deleted++;
    }

    await finalizeMutationRowsRead(ctx, authority, admission, deletions);
    return { deleted, memorySpaceId: args.memorySpaceId };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get fact by ID
 */
export const get = query({
  args: {
    memorySpaceId: v.string(),
    factId: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
  },
  handler: async (ctx, args) => {
    const capability = "read" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    const fact = await getScopedFact(ctx, authority, args.factId, capability);

    if (!fact) {
      return null;
    }

    // Verify memorySpace owns this fact
    if (fact.memorySpaceId !== args.memorySpaceId) {
      return null; // Permission denied (silent)
    }

    // Verify tenant isolation if tenantId provided
    if (args.tenantId && fact.tenantId !== args.tenantId) {
      return null; // Cross-tenant access denied (silent)
    }

    return fact;
  },
});

/**
 * List facts with filters
 */
export const list = query({
  args: {
    memorySpaceId: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    // Fact-specific filters
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("observation"),
        v.literal("custom"),
      ),
    ),
    subject: v.optional(v.string()),
    predicate: v.optional(v.string()),
    object: v.optional(v.string()),
    minConfidence: v.optional(v.number()),
    confidence: v.optional(v.number()), // Exact match
    // Universal filters
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    tagMatch: v.optional(v.union(v.literal("any"), v.literal("all"))),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("manual"),
        v.literal("a2a"),
      ),
    ),
    createdBefore: v.optional(v.number()),
    createdAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()),
    updatedAfter: v.optional(v.number()),
    version: v.optional(v.number()),
    includeSuperseded: v.optional(v.boolean()),
    validAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const capability = "read" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    let facts = await listScopedFacts(ctx, authority, capability);

    // Filter out superseded by default
    if (!args.includeSuperseded) {
      facts = facts.filter((f) => f.supersededBy === undefined);
    }

    // Tenant isolation filter (apply early for security)
    if (args.tenantId) {
      facts = facts.filter((f) => f.tenantId === args.tenantId);
    }

    // Apply universal filters
    if (args.factType) {
      facts = facts.filter((f) => f.factType === args.factType);
    }
    if (args.subject !== undefined) {
      facts = facts.filter((f) => f.subject === args.subject);
    }
    if (args.predicate !== undefined) {
      facts = facts.filter((f) => f.predicate === args.predicate);
    }
    if (args.object !== undefined) {
      facts = facts.filter((f) => f.object === args.object);
    }
    if (args.userId !== undefined) {
      facts = facts.filter((f) => f.userId === args.userId);
    }
    if (args.participantId !== undefined) {
      facts = facts.filter((f) => f.participantId === args.participantId);
    }
    if (args.minConfidence !== undefined) {
      facts = facts.filter((f) => f.confidence >= args.minConfidence!);
    }
    if (args.confidence !== undefined) {
      facts = facts.filter((f) => f.confidence === args.confidence);
    }
    if (args.sourceType !== undefined) {
      facts = facts.filter((f) => f.sourceType === args.sourceType);
    }
    if (args.tags && args.tags.length > 0) {
      if (args.tagMatch === "all") {
        facts = facts.filter((f) =>
          args.tags!.every((tag) => f.tags.includes(tag)),
        );
      } else {
        // "any" is default
        facts = facts.filter((f) =>
          args.tags!.some((tag) => f.tags.includes(tag)),
        );
      }
    }
    if (args.createdAfter !== undefined) {
      facts = facts.filter((f) => f.createdAt >= args.createdAfter!);
    }
    if (args.createdBefore !== undefined) {
      facts = facts.filter((f) => f.createdAt <= args.createdBefore!);
    }
    if (args.updatedAfter !== undefined) {
      facts = facts.filter((f) => f.updatedAt >= args.updatedAfter!);
    }
    if (args.updatedBefore !== undefined) {
      facts = facts.filter((f) => f.updatedAt <= args.updatedBefore!);
    }
    if (args.version !== undefined) {
      facts = facts.filter((f) => f.version === args.version);
    }
    if (args.validAt !== undefined) {
      facts = facts.filter((f) => {
        const isValid =
          (!f.validFrom || f.validFrom <= args.validAt!) &&
          (!f.validUntil || f.validUntil > args.validAt!);
        return isValid;
      });
    }
    if (args.metadata !== undefined) {
      facts = facts.filter((f) => {
        if (!f.metadata) return false;
        // Match all provided metadata fields
        return Object.entries(args.metadata as Record<string, any>).every(
          ([key, value]) => f.metadata[key] === value,
        );
      });
    }

    // Apply sorting (safe - only if facts exist and sortBy is valid)
    if (args.sortBy && facts.length > 0) {
      // Validate sortBy is a valid field
      const validSortFields = [
        "createdAt",
        "updatedAt",
        "confidence",
        "version",
      ];
      if (validSortFields.includes(args.sortBy)) {
        const sortField = args.sortBy as
          | "createdAt"
          | "updatedAt"
          | "confidence"
          | "version";
        facts.sort((a, b) => {
          const aVal = a[sortField] as any;
          const bVal = b[sortField] as any;
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return args.sortOrder === "asc" ? comparison : -comparison;
        });
      }
    }

    // Apply pagination (offset and limit combined)
    const offset = args.offset || 0;
    const limit = args.limit !== undefined ? offset + args.limit : undefined;
    facts =
      limit !== undefined ? facts.slice(offset, limit) : facts.slice(offset);

    return facts;
  },
});

/**
 * Count facts
 */
export const count = query({
  args: {
    memorySpaceId: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    // Fact-specific filters
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("observation"),
        v.literal("custom"),
      ),
    ),
    subject: v.optional(v.string()),
    predicate: v.optional(v.string()),
    object: v.optional(v.string()),
    minConfidence: v.optional(v.number()),
    confidence: v.optional(v.number()), // Exact match
    // Universal filters
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    tagMatch: v.optional(v.union(v.literal("any"), v.literal("all"))),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("manual"),
        v.literal("a2a"),
      ),
    ),
    createdBefore: v.optional(v.number()),
    createdAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()),
    updatedAfter: v.optional(v.number()),
    version: v.optional(v.number()),
    includeSuperseded: v.optional(v.boolean()),
    validAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const capability = "read" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    let facts = await listScopedFacts(ctx, authority, capability);

    // Filter out superseded by default
    if (!args.includeSuperseded) {
      facts = facts.filter((f) => f.supersededBy === undefined);
    }

    // Tenant isolation filter (apply early for security)
    if (args.tenantId) {
      facts = facts.filter((f) => f.tenantId === args.tenantId);
    }

    // Apply universal filters (same as list)
    if (args.factType) {
      facts = facts.filter((f) => f.factType === args.factType);
    }
    if (args.subject !== undefined) {
      facts = facts.filter((f) => f.subject === args.subject);
    }
    if (args.predicate !== undefined) {
      facts = facts.filter((f) => f.predicate === args.predicate);
    }
    if (args.object !== undefined) {
      facts = facts.filter((f) => f.object === args.object);
    }
    if (args.userId !== undefined) {
      facts = facts.filter((f) => f.userId === args.userId);
    }
    if (args.participantId !== undefined) {
      facts = facts.filter((f) => f.participantId === args.participantId);
    }
    if (args.minConfidence !== undefined) {
      facts = facts.filter((f) => f.confidence >= args.minConfidence!);
    }
    if (args.confidence !== undefined) {
      facts = facts.filter((f) => f.confidence === args.confidence);
    }
    if (args.sourceType !== undefined) {
      facts = facts.filter((f) => f.sourceType === args.sourceType);
    }
    if (args.tags && args.tags.length > 0) {
      if (args.tagMatch === "all") {
        facts = facts.filter((f) =>
          args.tags!.every((tag) => f.tags.includes(tag)),
        );
      } else {
        facts = facts.filter((f) =>
          args.tags!.some((tag) => f.tags.includes(tag)),
        );
      }
    }
    if (args.createdAfter !== undefined) {
      facts = facts.filter((f) => f.createdAt >= args.createdAfter!);
    }
    if (args.createdBefore !== undefined) {
      facts = facts.filter((f) => f.createdAt <= args.createdBefore!);
    }
    if (args.updatedAfter !== undefined) {
      facts = facts.filter((f) => f.updatedAt >= args.updatedAfter!);
    }
    if (args.updatedBefore !== undefined) {
      facts = facts.filter((f) => f.updatedAt <= args.updatedBefore!);
    }
    if (args.version !== undefined) {
      facts = facts.filter((f) => f.version === args.version);
    }
    if (args.validAt !== undefined) {
      facts = facts.filter((f) => {
        const isValid =
          (!f.validFrom || f.validFrom <= args.validAt!) &&
          (!f.validUntil || f.validUntil > args.validAt!);
        return isValid;
      });
    }
    if (args.metadata !== undefined) {
      facts = facts.filter((f) => {
        if (!f.metadata) return false;
        return Object.entries(args.metadata as Record<string, any>).every(
          ([key, value]) => f.metadata[key] === value,
        );
      });
    }

    return facts.length;
  },
});

/**
 * Search facts by content
 */
export const search = query({
  args: {
    memorySpaceId: v.string(),
    tenantId: v.optional(v.string()), // Multi-tenancy: SaaS platform isolation
    query: v.string(),
    // Fact-specific filters
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("observation"),
        v.literal("custom"),
      ),
    ),
    subject: v.optional(v.string()),
    predicate: v.optional(v.string()),
    object: v.optional(v.string()),
    minConfidence: v.optional(v.number()),
    confidence: v.optional(v.number()), // Exact match
    // Universal filters
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    tagMatch: v.optional(v.union(v.literal("any"), v.literal("all"))),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("manual"),
        v.literal("a2a"),
      ),
    ),
    createdBefore: v.optional(v.number()),
    createdAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()),
    updatedAfter: v.optional(v.number()),
    version: v.optional(v.number()),
    includeSuperseded: v.optional(v.boolean()),
    validAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const capability = "read" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    // Keyword search on fact content
    const results = await searchScopedFacts(ctx, authority, args.query);

    // Filter superseded unless explicitly requested
    let filtered = args.includeSuperseded
      ? results
      : results.filter((f) => f.supersededBy === undefined);

    // Tenant isolation filter (apply early for security)
    if (args.tenantId) {
      filtered = filtered.filter((f) => f.tenantId === args.tenantId);
    }

    // Apply universal filters (same as list/count)
    if (args.factType) {
      filtered = filtered.filter((f) => f.factType === args.factType);
    }
    if (args.subject !== undefined) {
      filtered = filtered.filter((f) => f.subject === args.subject);
    }
    if (args.predicate !== undefined) {
      filtered = filtered.filter((f) => f.predicate === args.predicate);
    }
    if (args.object !== undefined) {
      filtered = filtered.filter((f) => f.object === args.object);
    }
    if (args.userId !== undefined) {
      filtered = filtered.filter((f) => f.userId === args.userId);
    }
    if (args.participantId !== undefined) {
      filtered = filtered.filter((f) => f.participantId === args.participantId);
    }
    if (args.minConfidence !== undefined) {
      filtered = filtered.filter((f) => f.confidence >= args.minConfidence!);
    }
    if (args.confidence !== undefined) {
      filtered = filtered.filter((f) => f.confidence === args.confidence);
    }
    if (args.sourceType !== undefined) {
      filtered = filtered.filter((f) => f.sourceType === args.sourceType);
    }
    if (args.tags && args.tags.length > 0) {
      if (args.tagMatch === "all") {
        filtered = filtered.filter((f) =>
          args.tags!.every((tag) => f.tags.includes(tag)),
        );
      } else {
        filtered = filtered.filter((f) =>
          args.tags!.some((tag) => f.tags.includes(tag)),
        );
      }
    }
    if (args.createdAfter !== undefined) {
      filtered = filtered.filter((f) => f.createdAt >= args.createdAfter!);
    }
    if (args.createdBefore !== undefined) {
      filtered = filtered.filter((f) => f.createdAt <= args.createdBefore!);
    }
    if (args.updatedAfter !== undefined) {
      filtered = filtered.filter((f) => f.updatedAt >= args.updatedAfter!);
    }
    if (args.updatedBefore !== undefined) {
      filtered = filtered.filter((f) => f.updatedAt <= args.updatedBefore!);
    }
    if (args.version !== undefined) {
      filtered = filtered.filter((f) => f.version === args.version);
    }
    if (args.validAt !== undefined) {
      filtered = filtered.filter((f) => {
        const isValid =
          (!f.validFrom || f.validFrom <= args.validAt!) &&
          (!f.validUntil || f.validUntil > args.validAt!);
        return isValid;
      });
    }
    if (args.metadata !== undefined) {
      filtered = filtered.filter((f) => {
        if (!f.metadata) return false;
        return Object.entries(args.metadata as Record<string, any>).every(
          ([key, value]) => f.metadata[key] === value,
        );
      });
    }

    // Apply sorting (safe - only if facts exist and sortBy is valid)
    if (args.sortBy && filtered.length > 0) {
      // Validate sortBy is a valid field
      const validSortFields = [
        "createdAt",
        "updatedAt",
        "confidence",
        "version",
      ];
      if (validSortFields.includes(args.sortBy)) {
        const sortField = args.sortBy as
          | "createdAt"
          | "updatedAt"
          | "confidence"
          | "version";
        filtered.sort((a, b) => {
          const aVal = a[sortField] as any;
          const bVal = b[sortField] as any;
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return args.sortOrder === "asc" ? comparison : -comparison;
        });
      }
    }

    // Apply pagination (offset and limit combined)
    const offset = args.offset || 0;
    const limit = args.limit !== undefined ? offset + args.limit : undefined;
    filtered =
      limit !== undefined
        ? filtered.slice(offset, limit)
        : filtered.slice(offset);

    return filtered;
  },
});

/**
 * Internal query to fetch facts by their IDs (used by semanticSearch action)
 */
export const fetchFactsByIds = internalQuery({
  args: { ids: v.array(v.id("facts")), reference: runtimeAuthorityReference },
  handler: async (ctx, args): Promise<Doc<"facts">[]> => {
    const authority = await recheckDataAuthority(ctx, args.reference, "read");
    const results: Doc<"facts">[] = []; const witnesses: CanonicalSourceWitness[] = [];
    for (const id of args.ids) {
      const row = await getScopedFactDocument(ctx, authority, id, witnesses);
      if (!row) dataDenied();
      results.push(row);
    }
    await finalizeDataRead(ctx, authority, witnesses, results);
    return results;
  },
});

/**
 * Semantic search for facts using vector embeddings (v0.30.0+)
 *
 * Uses cosine similarity to find semantically related facts.
 * Requires managed Convex with vector index support.
 *
 * Note: Vector search requires using ctx.vectorSearch() which is only
 * available in actions, so this is implemented as an action.
 */
export const semanticSearch = action({
  args: {
    memorySpaceId: v.string(),
    embedding: v.array(v.float64()),
    tenantId: v.optional(v.string()),
    userId: v.optional(v.string()),
    minConfidence: v.optional(v.number()),
    includeSuperseded: v.optional(v.boolean()),
    minScore: v.optional(v.number()),
    limit: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    createdAfter: v.optional(v.number()),
    createdBefore: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"facts">[]> => {
    const authority = await requireActionDataAuthority(ctx, args, "read");
    await recheckActionDataAuthority(ctx, authority, "read");
    // Old fact vectors lack qualified profiles and cannot be treated as modern current vectors.
    rejectUnqualifiedEmbedding(args.embedding);
    return [];
  },
});

/**
 * Get fact version history
 */
export const getHistory = query({
  args: {
    memorySpaceId: v.string(),
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const capability = "read" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    const witnesses: CanonicalSourceWitness[] = [];
    const fact = await getHistoricalScopedFact(ctx, authority, args.factId, witnesses);

    if (!fact || fact.memorySpaceId !== args.memorySpaceId) {
      return [];
    }

    // Build version chain - start from given fact and go both directions
    const history: HistoricalFactView[] = [];

    // First, go backward to find oldest version
    const backward = new Set<string>([fact.factId]);
    let oldest = fact;
    while (oldest.supersedes) {
      const previous = await getHistoricalScopedFact(ctx, authority, oldest.supersedes!, witnesses);

      if (previous) {
        if (backward.has(previous.factId)) dataDenied("INVALID_INPUT", "Fact version cycle");
        backward.add(previous.factId);
        oldest = previous;
      } else {
        dataDenied();
      }
    }

    // Now go forward from oldest to build complete chain
    history.push(oldest);
    const forward = new Set<string>([oldest.factId]);
    let current = oldest;

    while (current.supersededBy) {
      const next = await getHistoricalScopedFact(ctx, authority, current.supersededBy!, witnesses);

      if (next) {
        if (forward.has(next.factId)) dataDenied("INVALID_INPUT", "Fact version cycle");
        forward.add(next.factId);
        history.push(next);
        current = next;
      } else {
        dataDenied();
      }
    }

    await finalizeDataRead(ctx, authority, witnesses, history);
    return history; // Already in chronological order
  },
});

/**
 * Query facts by subject (entity-centric)
 */
export const queryBySubject = query({
  args: {
    memorySpaceId: v.string(),
    subject: v.string(),
    // Fact-specific filters
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("observation"),
        v.literal("custom"),
      ),
    ),
    predicate: v.optional(v.string()),
    object: v.optional(v.string()),
    minConfidence: v.optional(v.number()),
    confidence: v.optional(v.number()), // Exact match
    // Universal filters
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    tagMatch: v.optional(v.union(v.literal("any"), v.literal("all"))),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("manual"),
        v.literal("a2a"),
      ),
    ),
    createdBefore: v.optional(v.number()),
    createdAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()),
    updatedAfter: v.optional(v.number()),
    version: v.optional(v.number()),
    includeSuperseded: v.optional(v.boolean()),
    validAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const capability = "read" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    let facts = (await listScopedFacts(ctx, authority, capability)).filter(row => row.subject === args.subject);

    // Filter superseded (unless explicitly requested)
    if (!args.includeSuperseded) {
      facts = facts.filter((f) => f.supersededBy === undefined);
    }

    // Apply universal filters
    if (args.factType) {
      facts = facts.filter((f) => f.factType === args.factType);
    }
    if (args.userId !== undefined) {
      facts = facts.filter((f) => f.userId === args.userId);
    }
    if (args.participantId !== undefined) {
      facts = facts.filter((f) => f.participantId === args.participantId);
    }
    if (args.predicate !== undefined) {
      facts = facts.filter((f) => f.predicate === args.predicate);
    }
    if (args.object !== undefined) {
      facts = facts.filter((f) => f.object === args.object);
    }
    if (args.minConfidence !== undefined) {
      facts = facts.filter((f) => f.confidence >= args.minConfidence!);
    }
    if (args.confidence !== undefined) {
      facts = facts.filter((f) => f.confidence === args.confidence);
    }
    if (args.sourceType !== undefined) {
      facts = facts.filter((f) => f.sourceType === args.sourceType);
    }
    if (args.tags && args.tags.length > 0) {
      if (args.tagMatch === "all") {
        facts = facts.filter((f) =>
          args.tags!.every((tag) => f.tags.includes(tag)),
        );
      } else {
        // "any" is default
        facts = facts.filter((f) =>
          args.tags!.some((tag) => f.tags.includes(tag)),
        );
      }
    }
    if (args.createdAfter !== undefined) {
      facts = facts.filter((f) => f.createdAt >= args.createdAfter!);
    }
    if (args.createdBefore !== undefined) {
      facts = facts.filter((f) => f.createdAt <= args.createdBefore!);
    }
    if (args.updatedAfter !== undefined) {
      facts = facts.filter((f) => f.updatedAt >= args.updatedAfter!);
    }
    if (args.updatedBefore !== undefined) {
      facts = facts.filter((f) => f.updatedAt <= args.updatedBefore!);
    }
    if (args.version !== undefined) {
      facts = facts.filter((f) => f.version === args.version);
    }
    if (args.validAt !== undefined) {
      facts = facts.filter((f) => {
        const isValid =
          (!f.validFrom || f.validFrom <= args.validAt!) &&
          (!f.validUntil || f.validUntil > args.validAt!);
        return isValid;
      });
    }
    if (args.metadata !== undefined) {
      facts = facts.filter((f) => {
        if (!f.metadata) return false;
        // Match all provided metadata fields
        return Object.entries(args.metadata as Record<string, any>).every(
          ([key, value]) => f.metadata[key] === value,
        );
      });
    }

    // Apply sorting (safe - only if facts exist and sortBy is valid)
    if (args.sortBy && facts.length > 0) {
      // Validate sortBy is a valid field
      const validSortFields = [
        "createdAt",
        "updatedAt",
        "confidence",
        "version",
      ];
      if (validSortFields.includes(args.sortBy)) {
        const sortField = args.sortBy as
          | "createdAt"
          | "updatedAt"
          | "confidence"
          | "version";
        facts.sort((a, b) => {
          const aVal = a[sortField] as any;
          const bVal = b[sortField] as any;
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return args.sortOrder === "asc" ? comparison : -comparison;
        });
      }
    }

    // Apply pagination (offset and limit combined)
    const offset = args.offset || 0;
    const limit = args.limit !== undefined ? offset + args.limit : undefined;
    facts =
      limit !== undefined ? facts.slice(offset, limit) : facts.slice(offset);

    return facts;
  },
});

/**
 * Query facts by relationship (graph traversal)
 */
export const queryByRelationship = query({
  args: {
    memorySpaceId: v.string(),
    subject: v.string(),
    predicate: v.string(),
    // Fact-specific filters
    object: v.optional(v.string()),
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("observation"),
        v.literal("custom"),
      ),
    ),
    minConfidence: v.optional(v.number()),
    confidence: v.optional(v.number()), // Exact match
    // Universal filters
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    tagMatch: v.optional(v.union(v.literal("any"), v.literal("all"))),
    sourceType: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("system"),
        v.literal("tool"),
        v.literal("manual"),
        v.literal("a2a"),
      ),
    ),
    createdBefore: v.optional(v.number()),
    createdAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()),
    updatedAfter: v.optional(v.number()),
    version: v.optional(v.number()),
    includeSuperseded: v.optional(v.boolean()),
    validAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const capability = "read" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    let facts = (await listScopedFacts(ctx, authority, capability)).filter(row => row.subject === args.subject);

    // Filter by predicate and superseded
    facts = facts.filter((f) => f.predicate === args.predicate);
    if (!args.includeSuperseded) {
      facts = facts.filter((f) => f.supersededBy === undefined);
    }

    // Apply universal filters
    if (args.object !== undefined) {
      facts = facts.filter((f) => f.object === args.object);
    }
    if (args.factType) {
      facts = facts.filter((f) => f.factType === args.factType);
    }
    if (args.userId !== undefined) {
      facts = facts.filter((f) => f.userId === args.userId);
    }
    if (args.participantId !== undefined) {
      facts = facts.filter((f) => f.participantId === args.participantId);
    }
    if (args.minConfidence !== undefined) {
      facts = facts.filter((f) => f.confidence >= args.minConfidence!);
    }
    if (args.confidence !== undefined) {
      facts = facts.filter((f) => f.confidence === args.confidence);
    }
    if (args.sourceType !== undefined) {
      facts = facts.filter((f) => f.sourceType === args.sourceType);
    }
    if (args.tags && args.tags.length > 0) {
      if (args.tagMatch === "all") {
        facts = facts.filter((f) =>
          args.tags!.every((tag) => f.tags.includes(tag)),
        );
      } else {
        facts = facts.filter((f) =>
          args.tags!.some((tag) => f.tags.includes(tag)),
        );
      }
    }
    if (args.createdAfter !== undefined) {
      facts = facts.filter((f) => f.createdAt >= args.createdAfter!);
    }
    if (args.createdBefore !== undefined) {
      facts = facts.filter((f) => f.createdAt <= args.createdBefore!);
    }
    if (args.updatedAfter !== undefined) {
      facts = facts.filter((f) => f.updatedAt >= args.updatedAfter!);
    }
    if (args.updatedBefore !== undefined) {
      facts = facts.filter((f) => f.updatedAt <= args.updatedBefore!);
    }
    if (args.version !== undefined) {
      facts = facts.filter((f) => f.version === args.version);
    }
    if (args.validAt !== undefined) {
      facts = facts.filter((f) => {
        const isValid =
          (!f.validFrom || f.validFrom <= args.validAt!) &&
          (!f.validUntil || f.validUntil > args.validAt!);
        return isValid;
      });
    }
    if (args.metadata !== undefined) {
      facts = facts.filter((f) => {
        if (!f.metadata) return false;
        // Match all provided metadata fields
        return Object.entries(args.metadata as Record<string, any>).every(
          ([key, value]) => f.metadata[key] === value,
        );
      });
    }

    // Apply sorting (safe - only if facts exist and sortBy is valid)
    if (args.sortBy && facts.length > 0) {
      // Validate sortBy is a valid field
      const validSortFields = [
        "createdAt",
        "updatedAt",
        "confidence",
        "version",
      ];
      if (validSortFields.includes(args.sortBy)) {
        const sortField = args.sortBy as
          | "createdAt"
          | "updatedAt"
          | "confidence"
          | "version";
        facts.sort((a, b) => {
          const aVal = a[sortField] as any;
          const bVal = b[sortField] as any;
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return args.sortOrder === "asc" ? comparison : -comparison;
        });
      }
    }

    // Apply pagination (offset and limit combined)
    const offset = args.offset || 0;
    const limit = args.limit !== undefined ? offset + args.limit : undefined;
    facts =
      limit !== undefined ? facts.slice(offset, limit) : facts.slice(offset);

    return facts;
  },
});

/**
 * Export facts
 */
export const exportFacts = query({
  args: {
    memorySpaceId: v.string(),
    format: v.union(v.literal("json"), v.literal("jsonld"), v.literal("csv")),
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("observation"),
        v.literal("custom"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const capability = "read" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    let facts = await listScopedFacts(ctx, authority, capability);

    // Filter superseded
    facts = facts.filter((f) => f.supersededBy === undefined);

    if (args.factType) {
      facts = facts.filter((f) => f.factType === args.factType);
    }

    const exportedAt = Date.now();

    if (args.format === "json") {
      return {
        format: "json",
        data: JSON.stringify(facts, null, 2),
        count: facts.length,
        exportedAt,
      };
    }

    if (args.format === "jsonld") {
      // JSON-LD format for semantic web
      const jsonld = {
        "@context": "https://schema.org/",
        "@graph": facts.map((f) => ({
          "@type": "Fact",
          "@id": f.factId,
          subject: f.subject,
          predicate: f.predicate,
          object: f.object,
          factStatement: f.fact,
          confidence: f.confidence,
          factType: f.factType,
          dateCreated: new Date(f.createdAt).toISOString(),
          validFrom: f.validFrom
            ? new Date(f.validFrom).toISOString()
            : undefined,
          validThrough: f.validUntil
            ? new Date(f.validUntil).toISOString()
            : undefined,
        })),
      };

      return {
        format: "jsonld",
        data: JSON.stringify(jsonld, null, 2),
        count: facts.length,
        exportedAt,
      };
    }

    // CSV format
    const headers = [
      "factId",
      "fact",
      "factType",
      "subject",
      "predicate",
      "object",
      "confidence",
      "sourceType",
      "tags",
      "createdAt",
    ];
    const rows = facts.map((f) => [
      f.factId,
      `"${f.fact.replace(/"/g, '""')}"`, // Escape quotes
      f.factType,
      f.subject || "",
      f.predicate || "",
      f.object || "",
      f.confidence.toString(),
      f.sourceType,
      f.tags.join(";"),
      new Date(f.createdAt).toISOString(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return {
      format: "csv",
      data: csv,
      count: facts.length,
      exportedAt,
    };
  },
});

/**
 * Consolidate duplicate facts
 */
export const consolidate = mutation({
  args: { memorySpaceId: v.string(), factIds: v.array(v.string()), keepFactId: v.string() },
  handler: async (ctx, args) => {
    const authority = await requireDataAuthority(ctx, args, "write");
    const ids = [...new Set(args.factIds)];
    if (!ids.includes(args.keepFactId)) dataDenied("INVALID_INPUT", "Keep fact must be included");
    const facts: Doc<"facts">[] = []; const admittedSources: CanonicalSourceWitness[] = [];
    for (const id of ids) {
      const fact = await getScopedFact(ctx, authority, id, "write", new Set<string>(), undefined, admittedSources);
      if (!fact || fact.supersededBy || (fact.validUntil !== undefined && fact.validUntil <= Date.now())) dataDenied();
      facts.push(fact);
    }
    await recheckSourceWitnesses(ctx, authority, "write", admittedSources);
    const kept = facts.find(f => f.factId === args.keepFactId)!;
    const now = Date.now();
    for (const fact of facts) {
      await assertDataRow(ctx, authority, "write", fact);
      if (fact.factId !== kept.factId) await ctx.db.patch(fact._id, { runtimeEditor: dataEditor(authority), supersededBy: kept.factId, validUntil: now, updatedAt: now });
    }
    await ctx.db.patch(kept._id, { runtimeEditor: dataEditor(authority), confidence: Math.round(facts.reduce((total, fact) => total + fact.confidence, 0) / facts.length), updatedAt: now });
    const witnesses: CanonicalSourceWitness[] = [...admittedSources];
    for (const fact of facts) witnesses.push(...await assertDataRow(ctx, authority, "write", fact));
    await recheckSourceWitnesses(ctx, authority, "write", witnesses);
    return { consolidated: true, keptFactId: kept.factId, mergedCount: facts.length - 1 };
  },
});

/**
 * Find facts by structural match (subject + predicate + object)
 * Used for cross-session deduplication
 */
export const findByStructure = query({
  args: {
    memorySpaceId: v.string(),
    subject: v.optional(v.string()),
    predicate: v.optional(v.string()),
    object: v.optional(v.string()),
    userId: v.optional(v.string()),
    factType: v.optional(
      v.union(
        v.literal("preference"),
        v.literal("identity"),
        v.literal("knowledge"),
        v.literal("relationship"),
        v.literal("event"),
        v.literal("observation"),
        v.literal("custom"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const capability = "read" as const;
    const authority = await requireDataAuthority(ctx, args, capability);
    // Start with memorySpace filter
    let facts = await listScopedFacts(ctx, authority, capability);

    // Filter out superseded facts
    facts = facts.filter((f) => f.supersededBy === undefined);

    // Apply structural filters
    if (args.subject !== undefined) {
      facts = facts.filter((f) => f.subject === args.subject);
    }
    if (args.predicate !== undefined) {
      facts = facts.filter((f) => f.predicate === args.predicate);
    }
    if (args.object !== undefined) {
      facts = facts.filter((f) => f.object === args.object);
    }
    if (args.userId !== undefined) {
      facts = facts.filter((f) => f.userId === args.userId);
    }
    if (args.factType !== undefined) {
      facts = facts.filter((f) => f.factType === args.factType);
    }

    // Apply limit
    const limit = args.limit ?? 10;
    return facts.slice(0, limit);
  },
});

/**
 * Delete multiple facts by their IDs (batch delete for cascade operations)
 * Much faster than calling deleteFact multiple times
 * Uses index lookups instead of full table scan to avoid memory issues with large tables
 */
export const deleteByIds = mutation({
  args: { factIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const authority = await requireDataAuthority(ctx, {}, "write");
    const rows: Doc<"facts">[] = [];
    for (const id of [...new Set(args.factIds)]) {
      const row = await getScopedFact(ctx, authority, id, "write");
      if (!row) dataDenied();
      rows.push(row);
    }
    const admission = await prepareMutationRowsWrite(ctx, authority, rows);
    const deletions = [];
    for (const row of rows) deletions.push(await tombstoneDataRow(ctx, authority, "facts", row));
    await finalizeMutationRowsRead(ctx, authority, admission, deletions);
    return { deleted: rows.length, factIds: rows.map(row => row.factId) };
  },
});

/**
 * Purge all facts (TEST/DEV ONLY)
 */
export const purgeAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Safety check: Only allow in test/dev environments
    const siteUrl = process.env.CONVEX_SITE_URL || "";
    const isLocal =
      siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
    const isDevDeployment =
      siteUrl.includes(".convex.site") ||
      siteUrl.includes("dev-") ||
      siteUrl.includes("convex.cloud");
    const isTestEnv =
      process.env.NODE_ENV === "test" ||
      process.env.CONVEX_ENVIRONMENT === "test";

    if (!isLocal && !isDevDeployment && !isTestEnv) {
      throw new Error(
        "PURGE_DISABLED_IN_PRODUCTION: purgeAll is only available in test/dev environments.",
      );
    }

    const allFacts = await ctx.db.query("facts").collect();

    for (const fact of allFacts) {
      await ctx.db.delete(fact._id);
    }

    return { deleted: allFacts.length };
  },
});
