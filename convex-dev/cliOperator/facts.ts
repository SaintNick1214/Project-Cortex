/** Deployment-key administration of legacy rows. Public runtime APIs remain separate. */
import { graphMutation, currentGraphReceipts } from "../lib/graphSync";
import { checkArchiveFactAuthority } from "../lib/domainPaging";
import { domainGraphIdentity, domainFingerprint, checkFingerprint, domainBudget, selectedFactSource } from "../lib/domainPaging";
import { captureInsertedRow, reconcileRow, markDeletedRow } from "../lib/referenceLifecycle";
import { validateDomainScope } from "../lib/domainScope";
/**
 * Cortex SDK - Facts Store API (Layer 3)
 *
 * LLM-extracted, memorySpace-scoped, versioned facts
 * Structured knowledge with relationships
 */

import { v } from "convex/values";
import {
  type QueryCtx,
} from "../_generated/server";
import { operatorAction as action, operatorQuery as internalQuery, operatorQuery as query } from "../lib/operatorBoundary";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import {
  CaptureBudget,
  intentValidator,
  sourceFact,
  capture,
  prepareCapture,
  insertPrepared,
  provenance,
  replay,
  eventReceipt,
  endpoint,
  relationship,
  assertTail,
  fail,
} from "../lib/factHistoryProvenance";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Store a new fact
 */
export const store = graphMutation({
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
    historyIntent: v.optional(intentValidator),
  },
  handler: async (ctx, args) => {
    const budget = new CaptureBudget();
    const prior = await replay(ctx, args, args.historyIntent, args, budget);
    if (prior.length) {
      const result = prior[0].resultFactId
        ? await ctx.db.get(prior[0].resultFactId)
        : null;
      if (!result) fail("FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE");
      return budget.finish(ctx, {
        ...result,
        historyReceipt: eventReceipt(prior),
      });
    }
    const now = Date.now();
    const factId = `fact-${now}-${Math.random().toString(36).substring(2, 11)}`;

    const _id = await captureInsertedRow(ctx, "facts", {
      factId,
      memorySpaceId: args.memorySpaceId,
      participantId: args.participantId,
      userId: args.userId,
      tenantId: args.tenantId, // Store tenantId
      fact: args.fact,
      factType: args.factType,
      subject: args.subject,
      predicate: args.predicate,
      object: args.object,
      confidence: args.confidence,
      sourceType: args.sourceType,
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
      supersedesEndpoint: { state: "absent" },
      supersededByEndpoint: { state: "absent" },
      createdAt: now,
      updatedAt: now,
    });

    const result = await ctx.db.get(_id);
    if (!result) fail("FACT_HISTORY_SOURCE_REQUIRED");
    if (!args.historyIntent) return result;
    budget.write(result);
    const event = await capture(
      ctx,
      result,
      {
        action: "CREATE",
        newValue: result.fact,
        intent: args.historyIntent,
        role: "source",
        kind: "revision_store",
        request: args,
        affected: [_id],
        result: _id,
        publish: false,
      },
      budget,
    );
    return budget.finish(ctx, {
      ...result,
      historyReceipt: eventReceipt([event]),
    });
  },
});

/**
 * Update a fact (creates new version, marks old as superseded)
 */
export const update = graphMutation({
  args: {
    tenantId: v.optional(v.string()),
    expectedSourceFactId: v.optional(v.id("facts")),
    expectedSourceFingerprint: v.optional(v.string()),
    operationId: v.optional(v.string()),
    historyIntent: v.optional(intentValidator),
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
    const budget = new CaptureBudget(20);
    const intent = args.historyIntent ?? {
      operationId: args.operationId ?? crypto.randomUUID(),
      phase: "update",
    };
    const prior = await replay(ctx, args, intent, args, budget);
    if (prior.length) {
      const result = prior[0].resultFactId
        ? await ctx.db.get(prior[0].resultFactId)
        : null;
      if (!result) fail("FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE");
      return budget.finish(ctx, {
        ...result,
        historyReceipt: eventReceipt(prior),
      });
    }
    const existing = await sourceFact(
      ctx,
      args,
      args.factId,
      budget,
      args.expectedSourceFactId,
    );
    if (args.expectedSourceFingerprint !== undefined) {
      checkFingerprint(existing, args.expectedSourceFingerprint);
      await checkArchiveFactAuthority(ctx, existing);
    }
    const now = Date.now();
    const newFactId = `fact-${now}-${Math.random().toString(36).substring(2, 11)}`;

    assertTail(existing);
    await provenance(ctx, existing, budget);

    // Create new version (manually copy fields to avoid _id/_creationTime)
    const _id = await captureInsertedRow(ctx, "facts", {
      factId: newFactId,
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
      sourceType: existing.sourceType,
      sourceRef: existing.sourceRef,
      metadata: args.metadata || existing.metadata,
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
      supersedesEndpoint: endpoint(existing),
      supersededByEndpoint: { state: "absent" },
      createdAt: existing.createdAt, // Preserve original creation time across versions
      updatedAt: now,
    }, {cloneFrom: existing._id});

    const result = await ctx.db.get(_id);
    if (!result) fail("FACT_HISTORY_SOURCE_REQUIRED");
    const oldPatch = {
      supersededBy: newFactId,
      validUntil: now,
      supersededByEndpoint: endpoint(result),
      supersedesEndpoint: relationship(existing, "supersedes"),
    };
    budget.write(result);
    budget.write({ ...existing, ...oldPatch });
    const oldPrepared = await prepareCapture(
      ctx,
      { ...existing, ...oldPatch },
      {
        action: "SUPERSEDE",
        oldValue: existing.fact,
        newValue: result.fact,
        intent,
        role: "old",
        kind: "version_update",
        request: args,
        affected: [existing._id, _id],
        result: _id,
      },
      budget,
    );
    const freshPrepared = await prepareCapture(
      ctx,
      result,
      {
        action: "SUPERSEDE",
        oldValue: existing.fact,
        newValue: result.fact,
        intent,
        role: "new",
        kind: "version_update",
        request: args,
        affected: [existing._id, _id],
        result: _id,
      },
      budget,
    );
    const old = await insertPrepared(ctx, oldPrepared);
    const fresh = await insertPrepared(ctx, freshPrepared);
    await reconcileRow(ctx, existing._id, oldPatch);
    return budget.finish(ctx, {
      ...result,
      historyReceipt: eventReceipt([old, fresh]),
    });
  },
});

/**
 * Delete a fact (soft delete - mark as invalidated)
 */
export const deleteFact = graphMutation({
  args: {
    tenantId: v.optional(v.string()),
    operationId: v.optional(v.string()),
    memorySpaceId: v.string(),
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const budget = new CaptureBudget();
    const intent = {
      operationId: args.operationId ?? crypto.randomUUID(),
      phase: "delete",
    };
    const prior = await replay(ctx, args, intent, args, budget);
    if (prior.length)
      return {
        deleted: true,
        factId: args.factId,
        historyReceipt: eventReceipt(prior),
      };
    const fact = await sourceFact(ctx, args, args.factId, budget);
    const patch = { validUntil: Date.now(), updatedAt: Date.now() };
    budget.write({ ...fact, ...patch });
    const event = await capture(
      ctx,
      fact,
      {
        action: "DELETE",
        oldValue: fact.fact,
        intent,
        role: "source",
        kind: "soft_delete",
        request: args,
        affected: [fact._id],
      },
      budget,
    );
    await reconcileRow(ctx, fact._id, patch, { graphOperation: "delete" });
    return { deleted: true, factId: args.factId, historyReceipt: eventReceipt([{ ...event, graphJobs: currentGraphReceipts(ctx) }]) };
  },
});

/**
 * Supersede a fact with a new one (belief revision)
 * Marks the old fact as superseded and creates a relationship to the new fact
 */
export const supersede = graphMutation({
  args: {
    tenantId: v.optional(v.string()),
    expectedSourceFactId: v.optional(v.id("facts")),
    operationId: v.optional(v.string()),
    historyIntent: v.optional(intentValidator),
    memorySpaceId: v.string(),
    expectedOldFactId: v.optional(v.id("facts")),
    expectedNewFactId: v.optional(v.id("facts")),
    oldFactId: v.string(),
    newFactId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const budget = new CaptureBudget(20);
    const intent = args.historyIntent ?? {
      operationId: args.operationId ?? crypto.randomUUID(),
      phase: "supersede",
      reason: args.reason,
    };
    const prior = await replay(ctx, args, intent, args, budget);
    if (prior.length)
      return budget.finish(ctx, {
        superseded: true,
        oldFactId: args.oldFactId,
        newFactId: args.newFactId,
        reason: args.reason,
        historyReceipt: eventReceipt(prior),
      });
    const old = await sourceFact(
      ctx,
      args,
      args.oldFactId,
      budget,
      args.expectedOldFactId,
    );
    const fresh = await sourceFact(
      ctx,
      args,
      args.newFactId,
      budget,
      args.expectedNewFactId,
    );
    if (old._id === fresh._id) fail("FACT_HISTORY_RELATIONSHIP_CONFLICT");
    assertTail(old);
    assertTail(fresh);
    if (relationship(fresh, "supersedes").state !== "absent")
      fail("FACT_HISTORY_RELATIONSHIP_CONFLICT");
    const now = Date.now();
    const oldPatch = {
      supersededBy: fresh.factId,
      supersededByEndpoint: endpoint(fresh),
      supersedesEndpoint: relationship(old, "supersedes"),
      validUntil: now,
      updatedAt: now,
    };
    const newPatch = {
      supersedes: old.factId,
      supersedesEndpoint: endpoint(old),
      supersededByEndpoint: relationship(fresh, "supersededBy"),
      updatedAt: now,
    };
    budget.write({ ...old, ...oldPatch });
    budget.write({ ...fresh, ...newPatch });
    const first = await prepareCapture(
      ctx,
      { ...old, ...oldPatch },
      {
        action: "SUPERSEDE",
        oldValue: old.fact,
        newValue: fresh.fact,
        intent,
        role: "old",
        kind: "supersede",
        request: args,
        affected: [old._id, fresh._id],
        result: fresh._id,
        publish: !args.historyIntent,
      },
      budget,
    );
    const second = await prepareCapture(
      ctx,
      { ...fresh, ...newPatch },
      {
        action: "SUPERSEDE",
        oldValue: old.fact,
        newValue: fresh.fact,
        intent,
        role: "new",
        kind: "supersede",
        request: args,
        affected: [old._id, fresh._id],
        result: fresh._id,
        publish: !args.historyIntent,
      },
      budget,
    );
    const inserted = [
      await insertPrepared(ctx, first),
      await insertPrepared(ctx, second),
    ];
    await reconcileRow(ctx, old._id, oldPatch);
    await reconcileRow(ctx, fresh._id, newPatch);
    return budget.finish(ctx, {
      superseded: true,
      oldFactId: args.oldFactId,
      newFactId: args.newFactId,
      reason: args.reason,
      fact: { ...fresh, ...newPatch },
      historyReceipt: eventReceipt(inserted),
    });
  },
});

/**
 * Update a fact in place (without creating new version)
 * Used by belief revision for UPDATE action
 */
export const updateInPlace = graphMutation({
  args: {
    tenantId: v.optional(v.string()),
    expectedSourceFactId: v.optional(v.id("facts")),
    operationId: v.optional(v.string()),
    historyIntent: v.optional(intentValidator),
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
    const budget = new CaptureBudget(20);
    const intent = args.historyIntent ?? {
      operationId: args.operationId ?? crypto.randomUUID(),
      phase: "update",
    };
    const prior = await replay(ctx, args, intent, args, budget);
    if (prior.length) {
      const result = prior[0].resultFactId
        ? await ctx.db.get(prior[0].resultFactId)
        : null;
      if (!result) fail("FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE");
      return budget.finish(ctx, {
        ...result,
        historyReceipt: eventReceipt(prior),
      });
    }
    const existing = await sourceFact(
      ctx,
      args,
      args.factId,
      budget,
      args.expectedSourceFactId,
    );
    const now = Date.now();

    // Build update object with only provided fields
    const updates: Record<string, any> = {
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

    budget.write({ ...existing, ...updates });
    const event = args.historyIntent
      ? await capture(
          ctx,
          { ...existing, ...updates },
          {
            action: "UPDATE",
            oldValue: existing.fact,
            newValue: args.fact ?? existing.fact,
            intent,
            role: "source",
            kind: "revision_update",
            request: args,
            affected: [existing._id],
            result: existing._id,
            publish: false,
          },
          budget,
        )
      : undefined;
    await reconcileRow(ctx, existing._id, updates);

    const result = await ctx.db.get(existing._id);
    return budget.finish(ctx, {
      ...result,
      historyReceipt: event ? eventReceipt([event]) : undefined,
    });
  },
});

/**
 * Delete many facts matching filters
 */
export const deleteMany = graphMutation({
  args: {
    tenantId: v.optional(v.string()),
    selectedPhysicalId: v.optional(v.id("facts")),
    selectedMemoryDocumentId: v.optional(v.id("memories")),
    sourceMemoryExpectedFingerprint: v.optional(v.string()),
    expectedFingerprint: v.optional(v.string()),
    operationId: v.optional(v.string()),
    includeSuperseded: v.optional(v.boolean()),
    paginationOpts: v.optional(paginationOptsValidator),
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
    validateDomainScope(args.tenantId);
    if (args.selectedPhysicalId !== undefined) {
      const intent = {operationId: args.operationId ?? crypto.randomUUID(), phase: "physical_delete"};
      const budget = new CaptureBudget(20);
      const prior = await replay(ctx, args, intent, args, budget);
      if (prior.length) return budget.finish(ctx, {deleted: 1, memorySpaceId: args.memorySpaceId, physicalId: args.selectedPhysicalId, historyReceipt: eventReceipt(prior), page: [], isDone: true, continueCursor: ""});
      const fact = await ctx.db.get(args.selectedPhysicalId);
      if (!fact) return {deleted: 0, alreadyAbsent: true, memorySpaceId: args.memorySpaceId, physicalId: args.selectedPhysicalId, page: [], isDone: true, continueCursor: ""};
      budget.account([fact]);
      if (fact.tenantId !== args.tenantId || fact.memorySpaceId !== args.memorySpaceId || (args.includeSuperseded === false && fact.supersededBy !== undefined) ||
        (args.userId !== undefined && fact.userId !== args.userId) || (args.factType !== undefined && fact.factType !== args.factType) ) fail("DOMAIN_SELECTION_CHANGED");
      if (!args.expectedFingerprint) fail("DOMAIN_INVALID_FINGERPRINT");
      checkFingerprint(fact, args.expectedFingerprint);
      if (args.selectedMemoryDocumentId) {
        const memory = await ctx.db.get(args.selectedMemoryDocumentId);
        if (!memory || memory.tenantId !== args.tenantId || memory.memorySpaceId !== args.memorySpaceId || !args.sourceMemoryExpectedFingerprint || !(await selectedFactSource(ctx, fact, memory))) fail("SOURCE_PROVENANCE_UNRESOLVED");
        checkFingerprint(memory, args.sourceMemoryExpectedFingerprint);
      }
      const event = await capture(ctx, fact, {action: "DELETE", oldValue: fact.fact, intent, role: "source", kind: "physical_delete", request: args, affected: [fact._id]}, budget);
      const graphIdentity = await domainGraphIdentity(ctx, "facts", fact);
      await markDeletedRow(ctx, fact._id);
      return budget.finish(ctx, {deleted: 1, memorySpaceId: args.memorySpaceId, physicalId: fact._id, graphIdentity, historyReceipt: eventReceipt([event]), page: [], isDone: true, continueCursor: ""});
    }
    const scan = await ctx.db
      .query("facts")
      .withIndex("by_tenant_space", (q) =>
        q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId),
      )
      .paginate({
        ...(args.paginationOpts ?? { numItems: 1, cursor: null }),
        numItems: 1,
        maximumRowsRead: 1,
        maximumBytesRead: 1024 * 1024,
      });
    if (scan.pageStatus === "SplitRequired")
      return {
        ...scan,
        page: [],
        deleted: 0,
        memorySpaceId: args.memorySpaceId,
      };
    let deleted = 0;
    const budget = new CaptureBudget();
    budget.account(scan.page);
    for (const fact of scan.page) {
      if (
        (args.userId !== undefined && fact.userId !== args.userId) ||
        (args.factType !== undefined && fact.factType !== args.factType)
      )
        continue;
      await capture(
        ctx,
        fact,
        {
          action: "DELETE",
          oldValue: fact.fact,
          intent: {
            operationId: crypto.randomUUID(),
            phase: "physical_delete",
          },
          role: "source",
          kind: "physical_delete",
          request: args,
          affected: [fact._id],
        },
        budget,
      );
      await markDeletedRow(ctx, fact._id);
      deleted++;
    }
    return budget.finish(ctx, {
      ...scan,
      page: [],
      deleted,
      memorySpaceId: args.memorySpaceId,
    });
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
    validateDomainScope(args.tenantId);
    const rows = await ctx.db.query("facts").withIndex("by_runtime_scope_factId", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId).eq("factId", args.factId)).take(2);
    if (rows.length > 1) fail("DOMAIN_SCOPE_AMBIGUOUS");
    const fact = rows[0] ?? null;

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
    validateDomainScope(args.tenantId);
    let facts = await ctx.db
      .query("facts")
      .withIndex("by_tenant_space", (q) =>
        q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId),
      )
      .take(257);
    await domainBudget(ctx, facts);

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
    validateDomainScope(args.tenantId);
    let facts = await ctx.db
      .query("facts")
      .withIndex("by_tenant_space", (q) =>
        q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId),
      )
      .collect();

    // Filter out superseded by default
    if (!args.includeSuperseded) {
      facts = facts.filter((f) => f.supersededBy === undefined);
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
    // Keyword search on fact content
    const results = await ctx.db
      .query("facts")
      .withSearchIndex("by_content", (q) =>
        q.search("fact", args.query).eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId),
      )
      .take(257);
    await domainBudget(ctx, results);

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
  args: { ids: v.array(v.id("facts")) },
  handler: async (ctx, { ids }): Promise<Doc<"facts">[]> => {
    const results: Doc<"facts">[] = [];
    for (const id of ids) {
      const doc = await ctx.db.get(id);
      if (doc !== null) {
        results.push(doc);
      }
    }
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
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    let results: any[] = [];

    if (args.embedding && args.embedding.length > 0) {
      // Semantic search with vector similarity using ctx.vectorSearch()
      // This is the correct Convex API for vector search (only available in actions)
      const vectorResults = await ctx.vectorSearch("facts", "by_embedding", {
        vector: args.embedding,
        limit: Math.min(limit * 2, 256), // Fetch more for post-filtering, max 256
        filter: (q) => q.eq("memorySpaceId", args.memorySpaceId),
      });

      // Fetch full documents using internal query
      const ids = vectorResults.map((r) => r._id);
      const docs: Doc<"facts">[] = await ctx.runQuery(internal.cliOperator.facts.fetchFactsByIds, { ids });

      // Merge scores with documents (preserve order from vector search)
      const scoreMap = new Map(
        vectorResults.map((r) => [r._id.toString(), r._score]),
      );
      results = docs.map((doc) => ({
        ...doc,
        _score: scoreMap.get(doc._id.toString()) ?? 0,
      }));

      // Sort by score (should already be sorted, but ensure consistency)
      results.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
    }

    // Filter superseded unless explicitly requested
    let filtered = args.includeSuperseded
      ? results
      : results.filter((f) => f.supersededBy === undefined);

    // Tenant isolation filter
    if (args.tenantId) {
      filtered = filtered.filter((f) => f.tenantId === args.tenantId);
    }

    // Apply additional filters
    if (args.userId !== undefined) {
      filtered = filtered.filter((f) => f.userId === args.userId);
    }
    if (args.minConfidence !== undefined) {
      filtered = filtered.filter((f) => f.confidence >= args.minConfidence!);
    }
    if (args.tags && args.tags.length > 0) {
      filtered = filtered.filter((f) =>
        args.tags!.some((tag) => f.tags.includes(tag)),
      );
    }
    if (args.createdAfter !== undefined) {
      filtered = filtered.filter((f) => f.createdAt >= args.createdAfter!);
    }
    if (args.createdBefore !== undefined) {
      filtered = filtered.filter((f) => f.createdAt <= args.createdBefore!);
    }

    // Filter by minimum score
    if (args.minScore !== undefined) {
      filtered = filtered.filter((f: any) => {
        if (f._score !== undefined) {
          return f._score >= args.minScore!;
        }
        return true;
      });
    }

    // Apply final limit
    return filtered.slice(0, limit);
  },
});

/**
 * Get fact version history
 */
export const getHistory = query({
  args: {
    tenantId: v.optional(v.string()),
    sourceFactId: v.optional(v.id("facts")),
    memorySpaceId: v.string(),
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const budget = new CaptureBudget();
    const fact = await sourceFact(
      ctx,
      args,
      args.factId,
      budget,
      args.sourceFactId,
    );
    if (
      relationship(fact, "supersedes").state === "unknown" ||
      relationship(fact, "supersededBy").state === "unknown"
    )
      fail("FACT_HISTORY_RELATIONSHIP_UNRESOLVED");
    return budget.finish(ctx, [fact]);
  },
});

export const queryBySubject = query({
  args: {
    tenantId: v.optional(v.string()),
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
    const offset = args.offset ?? 0,
      limit = args.limit ?? 256;
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      offset + limit > 256
    )
      fail("FACT_HISTORY_PAGING_REQUIRED");
    const result = await factCandidatePage(ctx, args, {
      numItems: 256,
      cursor: null,
    });
    if (
      result.pageStatus === "SplitRequired" ||
      (!result.isDone &&
        (args.limit === undefined ||
          args.sortBy !== undefined ||
          result.page.length < offset + limit))
    )
      fail("FACT_HISTORY_PAGING_REQUIRED");
    const rows = result.page;
    if (
      args.sortBy &&
      ["createdAt", "updatedAt", "confidence", "version"].includes(args.sortBy)
    ) {
      const field = args.sortBy as
        | "createdAt"
        | "updatedAt"
        | "confidence"
        | "version";
      rows.sort(
        (a, b) =>
          (args.sortOrder === "asc" ? 1 : -1) *
          (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0),
      );
    }
    return rows.slice(offset, offset + limit);
  },
});

/** Query facts by relationship (graph traversal). */
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
    let facts = await ctx.db
      .query("facts")
      .withIndex("by_memorySpace_subject", (q) =>
        q.eq("memorySpaceId", args.memorySpaceId).eq("subject", args.subject),
      )
      .collect();

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
    tenantId: v.optional(v.string()),
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
    validateDomainScope(args.tenantId);
    let facts = await ctx.db
      .query("facts")
      .withIndex("by_tenant_space", (q) =>
        q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId),
      )
      .take(257);
    await domainBudget(ctx, facts);

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
export const consolidate = graphMutation({
  args: {
    tenantId: v.optional(v.string()),
    expectedFactIds: v.optional(
      v.array(v.object({ factId: v.string(), factDocumentId: v.id("facts") })),
    ),
    operationId: v.optional(v.string()),
    historyIntent: v.optional(intentValidator),
    memorySpaceId: v.string(),
    factIds: v.array(v.string()), // Facts to merge
    keepFactId: v.string(), // Fact to keep
  },
  handler: async (ctx, args) => {
    if (
      args.factIds.length < 2 ||
      args.factIds.length > 3 ||
      new Set(args.factIds).size !== args.factIds.length
    )
      fail("FACT_HISTORY_CONSOLIDATION_BUDGET");
    if (!args.factIds.includes(args.keepFactId)) fail("KEEP_FACT_NOT_IN_LIST");
    const budget = new CaptureBudget(24);
    const intent = args.historyIntent ?? {
      operationId: args.operationId ?? crypto.randomUUID(),
      phase: "consolidate",
    };
    const prior = await replay(ctx, args, intent, args, budget);
    if (prior.length)
      return budget.finish(ctx, {
        consolidated: true,
        keptFactId: args.keepFactId,
        mergedCount: args.factIds.length - 1,
        historyReceipt: eventReceipt(prior),
      });
    const guards = new Map(
      args.expectedFactIds?.map((guard) => [
        guard.factId,
        guard.factDocumentId,
      ]),
    );
    if (
      args.expectedFactIds &&
      (guards.size !== args.factIds.length ||
        args.expectedFactIds.length !== args.factIds.length ||
        args.factIds.some((id) => !guards.has(id)))
    )
      fail("FACT_HISTORY_SOURCE_MISMATCH");
    const facts = [];
    for (const id of args.factIds)
      facts.push(await sourceFact(ctx, args, id, budget, guards.get(id)));
    for (const fact of facts) assertTail(fact);
    const kept = facts.find((f) => f.factId === args.keepFactId)!;
    const now = Date.now();
    const confidence = Math.round(
      facts.reduce((n, f) => n + f.confidence, 0) / facts.length,
    );
    const planned = facts.map((f) => ({
      fact: f,
      patch:
        f._id === kept._id
          ? {
              confidence,
              updatedAt: now,
              supersedesEndpoint: relationship(f, "supersedes"),
              supersededByEndpoint: relationship(f, "supersededBy"),
            }
          : {
              supersededBy: kept.factId,
              supersededByEndpoint: endpoint(kept),
              supersedesEndpoint: relationship(f, "supersedes"),
              validUntil: now,
            },
    }));
    for (const item of planned) budget.write({ ...item.fact, ...item.patch });
    const events = [];
    for (const item of planned)
      events.push(
        await prepareCapture(
          ctx,
          { ...item.fact, ...item.patch },
          {
            action: item.fact._id === kept._id ? "UPDATE" : "SUPERSEDE",
            oldValue: item.fact.fact,
            newValue: kept.fact,
            intent,
            role:
              item.fact._id === kept._id ? "kept" : `source:${item.fact._id}`,
            kind: "consolidate",
            request: args,
            affected: facts.map((f) => f._id),
            result: kept._id,
          },
          budget,
        ),
      );
    const inserted = [];
    for (const event of events) inserted.push(await insertPrepared(ctx, event));
    for (const item of planned) await reconcileRow(ctx, item.fact._id, item.patch);
    return budget.finish(ctx, {
      consolidated: true,
      keptFactId: kept.factId,
      mergedCount: facts.length - 1,
      historyReceipt: eventReceipt(inserted),
    });
  },
});

/**
 * Find facts by structural match (subject + predicate + object)
 * Used for cross-session deduplication
 */
export const findByStructure = query({
  args: {
    tenantId: v.optional(v.string()),
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
    const limit = args.limit ?? 256;
    if (!Number.isInteger(limit) || limit < 1 || limit > 256)
      fail("FACT_HISTORY_PAGING_REQUIRED");
    const result = await factCandidatePage(ctx, args, {
      numItems: 256,
      cursor: null,
    });
    if (
      result.pageStatus === "SplitRequired" ||
      (!result.isDone &&
        (args.limit === undefined || result.page.length < limit))
    )
      fail("FACT_HISTORY_PAGING_REQUIRED");
    return result.page.slice(0, limit);
  },
});

/** Delete-by-ID scalar audit compatibility; larger erasure belongs task19. */
export const deleteByIds = graphMutation({
  args: {
    tenantId: v.optional(v.string()),
    memorySpaceId: v.optional(v.string()),
    factIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.factIds.length !== 1) fail("FACT_HISTORY_DELETE_BATCH_REQUIRED");
    const budget = new CaptureBudget();
    budget.reserve(2);
    const rows = await ctx.db
      .query("facts")
      .withIndex("by_history_tenant_fact", (q) =>
        q.eq("tenantId", args.tenantId).eq("factId", args.factIds[0]),
      )
      .take(2);
    budget.account(rows);
    if (rows.length > 1) fail("FACT_HISTORY_SOURCE_AMBIGUOUS");
    const fact = rows[0];
    if (!fact) return { deleted: 0, factIds: [] };
    if (
      args.memorySpaceId !== undefined &&
      fact.memorySpaceId !== args.memorySpaceId
    )
      fail("FACT_HISTORY_SCOPE_MISMATCH");
    const patch = { validUntil: Date.now(), updatedAt: Date.now() };
    budget.write({ ...fact, ...patch });
    await capture(
      ctx,
      fact,
      {
        action: "DELETE",
        oldValue: fact.fact,
        intent: { operationId: crypto.randomUUID(), phase: "soft_delete" },
        role: "source",
        kind: "soft_delete",
        request: args,
        affected: [fact._id],
      },
      budget,
    );
    await reconcileRow(ctx, fact._id, patch);
    return { deleted: 1, factIds: [fact.factId] };
  },
});

/**
 * Purge all facts (TEST/DEV ONLY)
 */
export const purgeAll = graphMutation({
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
      await markDeletedRow(ctx, fact._id);
    }

    return { deleted: allFacts.length };
  },
});

type CandidateSelection = {
  tenantId?: string;
  memorySpaceId: string;
  subject?: string;
  predicate?: string;
  object?: string;
  userId?: string;
  participantId?: string;
  factType?: string;
  includeSuperseded?: boolean;
  minConfidence?: number;
  confidence?: number;
  sourceType?: string;
  tags?: string[];
  tagMatch?: "any" | "all";
  createdBefore?: number;
  createdAfter?: number;
  updatedBefore?: number;
  updatedAfter?: number;
  version?: number;
  validAt?: number;
  metadata?: unknown;
  query?: string;
  sourceMemoryId?: string;
};
async function factCandidatePage(
  ctx: QueryCtx,
  args: CandidateSelection,
  opts: { numItems: number; cursor: string | null; endCursor?: string | null },
) {
  if (
    opts.numItems < 1 ||
    opts.numItems > 256 ||
    !Number.isInteger(opts.numItems)
  )
    fail("FACT_HISTORY_INVALID_PAGE_SIZE");
  validateDomainScope(args.tenantId);
  const selected = args.query === undefined
    ? ctx.db.query("facts").withIndex("by_tenant_space", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId))
    : ctx.db.query("facts").withSearchIndex("by_content", q => q.search("fact", args.query!).eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId));
  const result = await selected.paginate({...opts, maximumRowsRead: 256, maximumBytesRead: 1024 * 1024});
  const native = await ctx.meta.getTransactionMetrics();
  if (native.bytesRead.used > 2 * 1024 * 1024 || native.documentsRead.used > 256) fail("FACT_HISTORY_BUDGET_EXCEEDED");
  const page = result.page.filter(
    (f) =>
      (args.includeSuperseded || !f.supersededBy) &&
      (args.sourceMemoryId === undefined || f.sourceRef?.memoryId === args.sourceMemoryId) &&
      (args.subject === undefined || f.subject === args.subject) &&
      (args.predicate === undefined || f.predicate === args.predicate) &&
      (args.object === undefined || f.object === args.object) &&
      (args.userId === undefined || f.userId === args.userId) &&
      (args.participantId === undefined ||
        f.participantId === args.participantId) &&
      (args.factType === undefined || f.factType === args.factType) &&
      (args.minConfidence === undefined ||
        f.confidence >= args.minConfidence) &&
      (args.confidence === undefined || f.confidence === args.confidence) &&
      (args.sourceType === undefined || f.sourceType === args.sourceType) &&
      (args.createdBefore === undefined || f.createdAt <= args.createdBefore) &&
      (args.createdAfter === undefined || f.createdAt >= args.createdAfter) &&
      (args.updatedBefore === undefined || f.updatedAt <= args.updatedBefore) &&
      (args.updatedAfter === undefined || f.updatedAt >= args.updatedAfter) &&
      (args.version === undefined || f.version === args.version) &&
      (args.validAt === undefined ||
        ((!f.validFrom || f.validFrom <= args.validAt) &&
          (!f.validUntil || f.validUntil > args.validAt))) &&
      (!args.tags?.length ||
        (args.tagMatch === "all"
          ? args.tags.every((tag) => f.tags.includes(tag))
          : args.tags.some((tag) => f.tags.includes(tag)))) &&
      (args.metadata === undefined ||
        (f.metadata &&
          typeof args.metadata === "object" &&
          args.metadata !== null &&
          Object.entries(args.metadata).every(
            ([key, value]) => f.metadata[key] === value,
          ))),
  );
  return { ...result, page };
}

/** Fixed writer-discovery selectors; retained legacy query return shapes remain arrays. */
export const candidatePage = query({
  args: {
    operation: v.union(
      v.literal("list"),
      v.literal("queryBySubject"),
      v.literal("findByStructure"),
    ),
    tenantId: v.optional(v.string()),
    query: v.optional(v.string()),
    sourceMemoryId: v.optional(v.string()),
    selectedMemoryDocumentId: v.optional(v.id("memories")),
    selectionMode: v.optional(v.union(v.literal("read"), v.literal("delete"), v.literal("archive"))),
    archiveAt: v.optional(v.number()),
    archiveOperationPrefix: v.optional(v.string()),
    deleteOperationPrefix: v.optional(v.string()),
    memorySpaceId: v.string(),
    subject: v.optional(v.string()),
    predicate: v.optional(v.string()),
    object: v.optional(v.string()),
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
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
    includeSuperseded: v.optional(v.boolean()),
    minConfidence: v.optional(v.number()),
    confidence: v.optional(v.number()),
    sourceType: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    tagMatch: v.optional(v.union(v.literal("any"), v.literal("all"))),
    createdBefore: v.optional(v.number()), createdAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()), updatedAfter: v.optional(v.number()),
    version: v.optional(v.number()), validAt: v.optional(v.number()), metadata: v.optional(v.any()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (args.operation === "queryBySubject" && args.subject === undefined)
      fail("FACT_HISTORY_SUBJECT_REQUIRED");
    const scan = await factCandidatePage(ctx, args, args.paginationOpts);
    let page = scan.pageStatus === "SplitRequired" ? [] : scan.page;
    if (args.selectionMode && args.selectionMode !== "read") {
      if (!args.selectedMemoryDocumentId || !args.sourceMemoryId) fail("SOURCE_PROVENANCE_UNRESOLVED");
      const memory = await ctx.db.get(args.selectedMemoryDocumentId);
      if (!memory || memory.tenantId !== args.tenantId || memory.memorySpaceId !== args.memorySpaceId || memory.memoryId !== args.sourceMemoryId) fail("SOURCE_PROVENANCE_UNRESOLVED");
      const eligible: Doc<"facts">[] = [];
      for (const fact of page) if (await selectedFactSource(ctx, fact, memory)) eligible.push(fact);
      page = eligible;
    }
    if (args.selectionMode === "archive" && (args.archiveAt === undefined || !Number.isFinite(args.archiveAt) || !args.archiveOperationPrefix)) fail("DOMAIN_INVALID_ARCHIVE_INTENT");
    const archiveIntents = args.selectionMode === "archive" ? page.map(row => {
      const operationId = args.archiveOperationPrefix! + ":" + row._id;
      const tags = [...row.tags.filter(tag => tag !== "archived"), "archived"];
      const expectedSourceFingerprint = domainFingerprint(row);
      const request = {memorySpaceId: args.memorySpaceId, tenantId: args.tenantId, factId: row.factId, expectedSourceFactId: row._id, expectedSourceFingerprint, operationId, tags, validUntil: args.archiveAt!};
      return {memorySpaceId: args.memorySpaceId, tenantId: args.tenantId, physicalId: row._id, factId: row.factId, expectedSourceFingerprint, operationId, requestDigest: domainFingerprint(request), tags, validUntil: args.archiveAt!};
    }) : undefined;
    const selectedMemory = args.selectedMemoryDocumentId ? await ctx.db.get(args.selectedMemoryDocumentId) : null;
    const deleteIntents = args.deleteOperationPrefix ? page.map(row => {
      const request = {memorySpaceId: args.memorySpaceId, tenantId: args.tenantId, userId: args.userId, factType: args.factType, includeSuperseded: args.includeSuperseded ?? true, selectedPhysicalId: row._id, expectedFingerprint: domainFingerprint(row), operationId: args.deleteOperationPrefix! + ":" + row._id,
        ...(selectedMemory ? {selectedMemoryDocumentId: selectedMemory._id, sourceMemoryExpectedFingerprint: domainFingerprint(selectedMemory)} : {})};
      return {physicalId: row._id, operationId: request.operationId, requestDigest: domainFingerprint(request), request};
    }) : undefined;
    const result = {...scan, page, ...(archiveIntents ? {archiveIntents} : {}), ...(deleteIntents ? {deleteIntents} : {}), fingerprints: Object.fromEntries(page.map(row => [row._id, domainFingerprint(row)]))};
    await domainBudget(ctx, result); return result;
  },
});
