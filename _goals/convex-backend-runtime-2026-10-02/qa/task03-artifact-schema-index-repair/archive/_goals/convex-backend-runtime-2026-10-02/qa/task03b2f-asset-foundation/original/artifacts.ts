/**
 * Cortex SDK - Artifacts API
 *
 * Interactive, versioned documents with undo/redo capabilities.
 * Memory space-scoped with multi-tenancy support.
 *
 * Features:
 * - Full version history with navigation
 * - Undo/redo via version pointer
 * - Streaming lifecycle (draft → streaming → final)
 * - Conversation linkage
 * - File attachments
 * - Soft/hard delete
 */

import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { ArtifactOperation, artifactDeny, artifactHandler, nextArtifactVersion, safeInteger, validateArtifact } from "./runtimeArtifactAuth";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const artifactKindValidator = v.union(
  v.literal("text"),
  v.literal("code"),
  v.literal("sheet"),
  v.literal("image"),
  v.literal("diagram"),
  v.literal("html"),
  v.literal("custom"),
);

const streamingStateValidator = v.union(
  v.literal("draft"),
  v.literal("streaming"),
  v.literal("paused"),
  v.literal("final"),
  v.literal("error"),
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a new artifact with initial content
 */
export const create = mutation({
  args: {
    artifactId: v.optional(v.string()), // Auto-generate if not provided
    memorySpaceId: v.string(), // Required - memory space isolation
    participantId: v.optional(v.string()), // Hive Mode tracking
    tenantId: v.optional(v.string()), // Multi-tenancy
    userId: v.optional(v.string()), // GDPR linkage

    // Content (see 00-unified-specification.md for canonical kinds)
    kind: v.optional(artifactKindValidator), // Default: "text"
    title: v.optional(v.string()),
    content: v.string(),
    language: v.optional(v.string()),
    mimeType: v.optional(v.string()),

    // Initial streaming state (default: draft)
    streamingState: v.optional(streamingStateValidator),

    // Conversation linkage
    conversationRef: v.optional(
      v.object({
        conversationId: v.string(),
        messageId: v.optional(v.string()),
      }),
    ),

    // Display
    description: v.optional(v.string()),

    // Metadata & tags
    metadata: v.optional(v.any()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);
    const now = Date.now();
    const artifactId = args.artifactId ?? `art-${now}-${Math.random().toString(36).substring(2, 11)}`;
    if (!artifactId) artifactDeny("INVALID_ARGUMENT");
    await operation.collision(artifactId);
    const artifact = await operation.insert({
      artifactId, tenantId: operation.authority.tenantId, memorySpaceId: operation.authority.memorySpaceId,
      ownerPrincipalId: operation.authority.principalId, lastActorPrincipalId: operation.authority.principalId,
      userId: operation.authority.userId, participantId: args.participantId,
      kind: args.kind ?? "text", kindConfig: args.language || args.mimeType
        ? { language: args.language, mimeType: args.mimeType } : undefined,
      streamingState: args.streamingState ?? "draft", title: args.title ?? "Untitled",
      description: args.description, content: args.content, conversationRef: args.conversationRef,
      version: 1, versionPointer: 1, versionHistory: [{ version: 1, content: args.content,
        title: args.title ?? "Untitled", timestamp: now, changedBy: operation.authority.principalId,
        changeType: "create", changeSummary: "Initial creation" }],
      metadata: args.metadata, tags: args.tags ?? [], createdAt: now, updatedAt: now,
    });
    return await operation.complete(artifact);
  }),
});

/**
 * Update artifact content (creates new version in history)
 *
 * IMPORTANT: If user has undone and is not at the latest version,
 * this creates a new branch from current position, discarding future versions.
 */
export const update = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()), // For tenant-isolated lookup

    // Content updates (at least one required)
    content: v.optional(v.string()),
    title: v.optional(v.string()),
    language: v.optional(v.string()),
    mimeType: v.optional(v.string()),

    // Metadata updates
    metadata: v.optional(v.any()),
    tags: v.optional(v.array(v.string())),

    // Change description
    changeSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    // Cannot update deleted artifacts
    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    const now = Date.now();
    const newContent = args.content ?? artifact.content;
    const newTitle = args.title ?? artifact.title;

    // Calculate new version number
    const newVersion = nextArtifactVersion(artifact);

    // If versionPointer is not at the end, we're branching from an undo state
    // Discard all versions after versionPointer
    let versionHistory = [...artifact.versionHistory];
    if (artifact.versionPointer < artifact.version) {
      // Truncate history to versionPointer position
      versionHistory = versionHistory.filter(
        (v) => v.version <= artifact.versionPointer,
      );
    }

    // Add new version
    const newVersionEntry = {
      version: newVersion,
      content: newContent,
      title: newTitle,
      timestamp: now,
      changeType: "update" as const,
      changedBy: operation.authority.principalId,
      changeSummary: args.changeSummary,
    };
    versionHistory.push(newVersionEntry);

    // Build kindConfig update if language or mimeType provided
    const kindConfigUpdate =
      args.language !== undefined || args.mimeType !== undefined
        ? {
            ...artifact.kindConfig,
            language:
              args.language !== undefined
                ? args.language
                : artifact.kindConfig?.language,
            mimeType:
              args.mimeType !== undefined
                ? args.mimeType
                : artifact.kindConfig?.mimeType,
          }
        : artifact.kindConfig;

    // Update artifact
    await operation.patch(artifact._id, {
      content: newContent,
      title: newTitle,
      kindConfig: kindConfigUpdate,
      version: newVersion,
      versionPointer: newVersion, // Move pointer to new version
      versionHistory,
      metadata: args.metadata !== undefined ? args.metadata : artifact.metadata,
      tags: args.tags !== undefined ? args.tags : artifact.tags,
      updatedAt: now,
    });

    return await operation.complete(await ctx.db.get(artifact._id));
  }),
});

/**
 * Tombstone an artifact. Retain the canonical row and resource control.
 */
export const deleteArtifact = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    hard: v.optional(v.boolean()), // Default: false (soft delete)
    deletedBy: v.optional(v.string()), // Optional: track who deleted
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);
    await operation.tombstone(artifact);
    return await operation.complete({ deleted: true, artifactId: artifact.artifactId,
      deletedAt: Date.now(), permanent: true, restorable: false,
      versionsPurged: 0, requestedHardDelete: args.hard === true });
  }),
});

/**
 * Undo - move to previous version in history
 *
 * Does NOT delete current version, just moves the pointer back.
 * Allows redo to restore the undone version.
 */
export const undo = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    // Find the nearest previous version (handles gaps from purgeVersions)
    // Sort versions below current pointer in descending order and take the first
    const previousVersions = artifact.versionHistory
      .filter((v) => v.version < artifact.versionPointer)
      .sort((a, b) => b.version - a.version);

    if (previousVersions.length === 0) {
      throw new ConvexError("UNDO_NOT_AVAILABLE");
    }

    const targetVersion = previousVersions[0];
    const newPointer = targetVersion.version;

    // Update artifact to reflect undone state
    // Restore content, title, and fileRef from the target version
    await operation.patch(artifact._id, {
      content: targetVersion.content,
      title: targetVersion.title,
      fileRef: targetVersion.fileRef,
      versionPointer: newPointer,
      updatedAt: Date.now(),
    });

    return await operation.complete({
      success: true,
      artifactId: args.artifactId,
      previousVersion: artifact.versionPointer,
      currentVersion: newPointer,
      canUndo: canUndoTo(artifact.versionHistory, newPointer),
      canRedo: canRedoTo(artifact.versionHistory, newPointer, artifact.version),
    });
  }),
});

/**
 * Redo - move forward to next version in history
 *
 * Only available if user has previously undone.
 */
export const redo = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    // Find the nearest next version (handles gaps from purgeVersions)
    // Sort versions above current pointer in ascending order and take the first
    const nextVersions = artifact.versionHistory
      .filter((v) => v.version > artifact.versionPointer)
      .sort((a, b) => a.version - b.version);

    if (nextVersions.length === 0) {
      throw new ConvexError("REDO_NOT_AVAILABLE");
    }

    const targetVersion = nextVersions[0];
    const newPointer = targetVersion.version;

    // Update artifact to reflect redone state
    // Restore content, title, and fileRef from the target version
    await operation.patch(artifact._id, {
      content: targetVersion.content,
      title: targetVersion.title,
      fileRef: targetVersion.fileRef,
      versionPointer: newPointer,
      updatedAt: Date.now(),
    });

    return await operation.complete({
      success: true,
      artifactId: args.artifactId,
      previousVersion: artifact.versionPointer,
      currentVersion: newPointer,
      canUndo: canUndoTo(artifact.versionHistory, newPointer),
      canRedo: canRedoTo(artifact.versionHistory, newPointer, artifact.version),
    });
  }),
});

/**
 * Update artifact streaming state (streaming lifecycle)
 *
 * Lifecycle: draft → streaming ↔ paused → final
 * Error state can transition back to draft for retry
 * See 00-unified-specification.md for valid transitions
 */
export const setStreamingState = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    streamingState: streamingStateValidator,
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    if (!isValidTransition(artifact.streamingState, args.streamingState)) artifactDeny("INVALID_STATE_TRANSITION");
    const now = Date.now();
    const previousState = artifact.streamingState;

    await operation.patch(artifact._id, {
      streamingState: args.streamingState,
      updatedAt: now,
    });

    return await operation.complete({
      success: true,
      artifactId: args.artifactId,
      previousState,
      currentState: args.streamingState,
      updatedAt: now,
    });
  }),
});

/**
 * Set file reference for an artifact
 *
 * NOTE: Schema uses single fileRef, not attachedFiles array.
 * Use completeArtifactUpload for file uploads via storage.
 */
export const setFileRef = mutation({
  args: {
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    fileRef: v.object({
      storageId: v.id("_storage"),
      mimeType: v.string(),
      size: v.number(),
      checksum: v.optional(v.string()),
      originalFilename: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Lookup artifact (tenant-aware)
    let artifact;
    if (args.tenantId) {
      artifact = await ctx.db
        .query("artifacts")
        .withIndex("by_tenant_artifactId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("artifactId", args.artifactId),
        )
        .first();
    } else {
      const candidate = await ctx.db
        .query("artifacts")
        .withIndex("by_artifactId", (q) => q.eq("artifactId", args.artifactId))
        .first();
      artifact = candidate && !candidate.tenantId ? candidate : null;
    }

    if (!artifact) {
      throw new ConvexError("ARTIFACT_NOT_FOUND");
    }

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    const now = Date.now();

    await ctx.db.patch(artifact._id, {
      fileRef: args.fileRef,
      content: undefined, // fileRef and content are mutually exclusive
      updatedAt: now,
    });

    return await ctx.db.get(artifact._id);
  },
});

/**
 * Purge old versions based on retention policy
 *
 * Keeps the most recent N versions and removes older ones.
 * Always preserves version 1 (initial creation) and current active version.
 */
export const purgeVersions = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    keepLatest: v.number(), // Number of versions to keep
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    if (safeInteger(args.keepLatest, 1) < 1) {
      throw new ConvexError("KEEP_LATEST_MUST_BE_POSITIVE");
    }

    const artifact = await operation.load(args.artifactId);

    const totalVersions = artifact.versionHistory.length;

    if (totalVersions <= args.keepLatest) {
      return await operation.complete({
        versionsPurged: 0,
        versionsRemaining: totalVersions,
      });
    }

    // Calculate how many to remove (from oldest, excluding v1)
    const versionsToKeep = args.keepLatest;

    // Keep latest N versions, but ALWAYS preserve version 1 (initial creation)
    // and the version at versionPointer
    const latestVersions = artifact.versionHistory.slice(-versionsToKeep);
    const version1 = artifact.versionHistory.find((v) => v.version === 1);

    // Start with latest versions
    let prunedHistory = [...latestVersions];

    // Always preserve version 1 if not already included
    if (version1 && !prunedHistory.some((v) => v.version === 1)) {
      prunedHistory = [version1, ...prunedHistory];
    }

    // Ensure version at versionPointer is preserved
    const pointerVersionExists = prunedHistory.some(
      (v) => v.version === artifact.versionPointer,
    );
    if (!pointerVersionExists) {
      const pointerVersion = artifact.versionHistory.find(
        (v) => v.version === artifact.versionPointer,
      );
      if (pointerVersion) {
        // Insert pointer version in correct position (after v1 if present)
        const insertIdx = prunedHistory.findIndex(
          (v) => v.version > artifact.versionPointer,
        );
        if (insertIdx === -1) {
          prunedHistory.push(pointerVersion);
        } else {
          prunedHistory.splice(insertIdx, 0, pointerVersion);
        }
      }
    }

    // Calculate actual versions purged
    const versionsToRemove = totalVersions - prunedHistory.length;

    await operation.patch(artifact._id, {
      versionHistory: prunedHistory,
    });

    return await operation.complete({
      versionsPurged: versionsToRemove,
      versionsRemaining: prunedHistory.length,
    });
  }),
});

/**
 * Tombstone scoped text artifacts through trusted operator internal tooling.
 * Retained file/link resources await their full ownership admission adapters.
 */
export const purgeAll = internalMutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    tenantId: v.optional(v.string()), // Limit to tenant if provided
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    // Only authenticated Convex deployment-operator internal tooling may invoke
    // this registration. URL/environment names and public JWT admin labels are
    // never operator credentials. This does not remove other control tables.
    if (!args.tenantId || !args.memorySpaceId) artifactDeny("INVALID_ARGUMENT");
    const rows = await ctx.db.query("artifacts").withIndex("by_runtime_scope", (q) =>
      q.eq("tenantId", args.tenantId!).eq("memorySpaceId", args.memorySpaceId!)).collect();
    // Full preflight, including retained history, before the first mutation.
    for (const row of rows) {
      if (row.fileRef || row.versionHistory.some((entry) => entry.fileRef)) artifactDeny("CAPABILITY_NOT_READY");
      if (row.conversationRef || row.memoryRefs?.length) artifactDeny("CAPABILITY_NOT_READY");
      if (!row.isDeleted && row.tombstonedAt === undefined) validateArtifact(row);
    }
    const now = Date.now();
    let deleted = 0;
    for (const row of rows) {
      if (row.isDeleted || row.tombstonedAt !== undefined) continue;
      await ctx.db.patch(row._id, { isDeleted: true, deletedAt: now, tombstonedAt: now,
        deletedBy: "trusted-deployment-operator", updatedAt: now });
      const target = { tenantId: args.tenantId, memorySpaceId: args.memorySpaceId,
        resourceType: "artifact" as const, resourceId: row.artifactId };
      const existing = await ctx.db.query("runtimeAuthTombstones").withIndex("by_resource", (q) =>
        q.eq("tenantId", target.tenantId).eq("memorySpaceId", target.memorySpaceId)
          .eq("resourceType", target.resourceType).eq("resourceId", target.resourceId)).unique();
      if (!existing) await ctx.db.insert("runtimeAuthTombstones", { ...target, deletedAt: now });
      deleted += 1;
    }
    return { deleted };
  }),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get a single artifact by ID
 */
export const get = query({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    includeVersionHistory: v.optional(v.boolean()), // Default: true
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, false);

    const artifact = await operation.load(args.artifactId);

    // Optionally exclude version history for smaller response
    if (args.includeVersionHistory === false) {
      return await operation.complete({
        ...artifact,
        versionHistory: [], // Omit for performance
      });
    }

    return await operation.complete(artifact);
  }),
});

/**
 * Get all artifacts linked to a specific conversation
 */
export const getByConversation = query({
  args: {
    memorySpaceId: v.optional(v.string()),
    conversationId: v.string(),
    tenantId: v.optional(v.string()),
    streamingState: v.optional(streamingStateValidator),
    includeVersionHistory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, false);
    await operation.conversation({ conversationId: args.conversationId });
    let artifacts = await operation.list();
    artifacts = artifacts.filter((row) => row.conversationRef?.conversationId === args.conversationId);
    if (args.streamingState !== undefined) artifacts = artifacts.filter((row) => row.streamingState === args.streamingState);
    return await operation.complete(args.includeVersionHistory === false ? artifacts.map((row) => ({ ...row, versionHistory: [] })) : artifacts);
  }),
});

/**
 * List artifacts with comprehensive filters and pagination
 */
export const list = query({
  args: {
    memorySpaceId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    userId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    kind: v.optional(artifactKindValidator),
    streamingState: v.optional(streamingStateValidator),
    tags: v.optional(v.array(v.string())), // Filter by tags (AND logic)
    includeDeleted: v.optional(v.boolean()), // Default: false
    createdAfter: v.optional(v.number()),
    createdBefore: v.optional(v.number()),
    updatedAfter: v.optional(v.number()),
    updatedBefore: v.optional(v.number()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(v.union(v.literal("createdAt"), v.literal("updatedAt"))),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    includeVersionHistory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, false);
    let artifacts = await operation.list();
    if (args.userId !== undefined) artifacts = artifacts.filter((row) => row.userId === args.userId);
    if (args.participantId !== undefined) artifacts = artifacts.filter((row) => row.participantId === args.participantId);
    if (args.kind !== undefined) artifacts = artifacts.filter((row) => row.kind === args.kind);
    if (args.streamingState !== undefined) artifacts = artifacts.filter((row) => row.streamingState === args.streamingState);
    if (args.tags?.length) artifacts = artifacts.filter((row) => args.tags!.every((tag) => row.tags.includes(tag)));
    if (args.createdAfter !== undefined) { if (!Number.isFinite(args.createdAfter)) artifactDeny("INVALID_ARGUMENT"); artifacts = artifacts.filter((row) => row.createdAt > args.createdAfter!); }
    if (args.createdBefore !== undefined) { if (!Number.isFinite(args.createdBefore)) artifactDeny("INVALID_ARGUMENT"); artifacts = artifacts.filter((row) => row.createdAt < args.createdBefore!); }
    if (args.updatedAfter !== undefined) { if (!Number.isFinite(args.updatedAfter)) artifactDeny("INVALID_ARGUMENT"); artifacts = artifacts.filter((row) => row.updatedAt > args.updatedAfter!); }
    if (args.updatedBefore !== undefined) { if (!Number.isFinite(args.updatedBefore)) artifactDeny("INVALID_ARGUMENT"); artifacts = artifacts.filter((row) => row.updatedAt < args.updatedBefore!); }
    const total = artifacts.length;
    const limit = Math.min(safeInteger(args.limit ?? 50, 1), 100);
    const offset = safeInteger(args.offset ?? 0);
    const sortBy = args.sortBy ?? "createdAt";
    artifacts.sort((left, right) => (left[sortBy] - right[sortBy]) * (args.sortOrder === "asc" ? 1 : -1));
    const selected = artifacts.slice(offset, offset + limit);
    return await operation.complete({ artifacts: args.includeVersionHistory === false
      ? selected.map((row) => ({ ...row, versionHistory: [] })) : selected,
      total, limit, offset, hasMore: offset + limit < total });
  }),
});

/**
 * Count artifacts matching filters
 */
export const count = query({
  args: {
    memorySpaceId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    userId: v.optional(v.string()),
    kind: v.optional(artifactKindValidator),
    streamingState: v.optional(streamingStateValidator),
    includeDeleted: v.optional(v.boolean()), // Default: false
    createdAfter: v.optional(v.number()),
    createdBefore: v.optional(v.number()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, false);
    let artifacts = await operation.list();
    if (args.userId !== undefined) artifacts = artifacts.filter((row) => row.userId === args.userId);
    if (args.kind !== undefined) artifacts = artifacts.filter((row) => row.kind === args.kind);
    if (args.streamingState !== undefined) artifacts = artifacts.filter((row) => row.streamingState === args.streamingState);
    if (args.createdAfter !== undefined) { if (!Number.isFinite(args.createdAfter)) artifactDeny("INVALID_ARGUMENT"); artifacts = artifacts.filter((row) => row.createdAt > args.createdAfter!); }
    if (args.createdBefore !== undefined) { if (!Number.isFinite(args.createdBefore)) artifactDeny("INVALID_ARGUMENT"); artifacts = artifacts.filter((row) => row.createdAt < args.createdBefore!); }
    return await operation.complete(artifacts.length);
  }),
});

/**
 * Get a specific version of an artifact
 */
export const getVersion = query({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    version: v.number(),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, false);

    safeInteger(args.version, 1);
    const artifact = await operation.load(args.artifactId);

    // Find version in history
    const versionEntry = artifact.versionHistory.find(
      (v) => v.version === args.version,
    );

    if (!versionEntry) {
      return await operation.complete(null);
    }

    return await operation.complete({
      artifactId: artifact.artifactId,
      version: versionEntry.version,
      content: versionEntry.content,
      title: versionEntry.title,
      timestamp: versionEntry.timestamp,
      changeType: versionEntry.changeType,
      changeSummary: versionEntry.changeSummary,
      isCurrent: versionEntry.version === artifact.versionPointer,
    });
  }),
});

/**
 * Get full version history for an artifact
 */
export const getHistory = query({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, false);

    const artifact = await operation.load(args.artifactId);

    let history = [...artifact.versionHistory];

    // Sort by version (asc = oldest first, desc = newest first)
    const sortOrder = args.sortOrder || "asc";
    if (sortOrder === "desc") {
      history.reverse();
    }

    const total = history.length;
    const offset = safeInteger(args.offset ?? 0);
    const limit = Math.min(safeInteger(args.limit ?? 50, 1), 100); // Max 100

    // Paginate
    history = history.slice(offset, offset + limit);

    // Add current version indicator
    const enrichedHistory = history.map((v) => ({
      ...v,
      artifactId: artifact.artifactId,
      isCurrent: v.version === artifact.versionPointer,
    }));

    return await operation.complete({
      history: enrichedHistory,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
      currentVersion: artifact.versionPointer,
      latestVersion: artifact.version,
      canUndo: canUndoTo(artifact.versionHistory, artifact.versionPointer),
      canRedo: canRedoTo(artifact.versionHistory, artifact.versionPointer, artifact.version),
    });
  }),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Streaming Mutations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Helper to generate unique session ID
 * Uses the same pattern as artifactId generation (line 86) for consistency
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `stream-${timestamp}-${random}`;
}

/**
 * Helper to check if undo is possible by verifying the previous version exists
 * Accounts for version gaps created by purgeVersions
 */
function canUndoTo(
  versionHistory: { version: number }[],
  currentPointer: number,
): boolean {
  if (currentPointer <= 1) return false;
  // Check if any version exists with version < currentPointer
  return versionHistory.some((v) => v.version < currentPointer);
}

/**
 * Helper to check if redo is possible by verifying the next version exists
 * Accounts for version gaps created by purgeVersions
 */
function canRedoTo(
  versionHistory: { version: number }[],
  currentPointer: number,
  maxVersion: number,
): boolean {
  if (currentPointer >= maxVersion) return false;
  // Check if any version exists with version > currentPointer
  return versionHistory.some((v) => v.version > currentPointer);
}

/**
 * Valid state transitions map
 * See 00-unified-specification.md Section 5.2
 */
const VALID_STREAMING_TRANSITIONS: Record<string, string[]> = {
  draft: ["streaming", "error"],
  streaming: ["paused", "final", "error", "draft"], // draft via cancel
  paused: ["streaming", "final", "draft", "error"], // final to complete partial content
  final: ["draft"], // New version via update
  error: ["draft"], // Retry
};

/**
 * Validate streaming state transition
 */
function isValidTransition(from: string, to: string): boolean {
  const validTargets = VALID_STREAMING_TRANSITIONS[from];
  return validTargets ? validTargets.includes(to) : false;
}

/**
 * Start streaming content to an artifact
 *
 * Transitions: draft → streaming
 * Generates a unique sessionId for this streaming session.
 *
 * See 00-unified-specification.md Section 3.5
 */
export const startStreaming = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    streamSource: v.optional(
      v.union(
        v.literal("ai_generation"),
        v.literal("import"),
        v.literal("transform"),
      ),
    ),
    estimatedTotal: v.optional(v.number()), // Estimated total bytes
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    // Validate state: only draft can start streaming
    // Note: We explicitly check for draft rather than using isValidTransition because
    // paused → streaming is valid for resumeStreaming, not startStreaming
    if (artifact.streamingState !== "draft") {
      artifactDeny("INVALID_STATE_TRANSITION");
    }

    if (args.estimatedTotal !== undefined) safeInteger(args.estimatedTotal);
    const now = Date.now();
    const sessionId = generateSessionId();

    // Update artifact to streaming state with metadata
    // Note: streamingMetadata schema only supports: sessionId, startedAt, lastChunkAt,
    // bytesReceived, estimatedTotal, errorMessage, errorCode
    await operation.patch(artifact._id, {
      streamingState: "streaming",
      streamingMetadata: {
        sessionId,
        startedAt: now,
        lastChunkAt: undefined,
        bytesReceived: 0,
        estimatedTotal: args.estimatedTotal,
        errorMessage: undefined,
        errorCode: undefined,
      },
      updatedAt: now,
    });

    return await operation.complete({
      success: true,
      sessionId,
      artifactId: args.artifactId,
      startedAt: now,
      previousState: artifact.streamingState,
      currentState: "streaming",
    });
  }),
});

/**
 * Append content chunk during streaming
 *
 * Requires: artifact in 'streaming' state with matching sessionId.
 * Updates streamingMetadata with progress information.
 */
export const appendContent = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    sessionId: v.string(),
    chunk: v.string(),
    chunkIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    // Verify artifact is in streaming state
    if (artifact.streamingState !== "streaming") {
      artifactDeny("INVALID_STATE_TRANSITION");
    }

    // Verify sessionId matches current streaming session
    const currentSessionId = artifact.streamingMetadata?.sessionId;
    if (currentSessionId !== args.sessionId) {
      artifactDeny("STREAMING_SESSION_INVALID");
    }

    if (args.chunkIndex !== undefined) safeInteger(args.chunkIndex);
    const now = Date.now();
    const chunkBytes = new TextEncoder().encode(args.chunk).length;
    const currentContent = artifact.content || "";
    const newContent = currentContent + args.chunk;
    const newBytesReceived = safeInteger((artifact.streamingMetadata?.bytesReceived || 0) + chunkBytes);

    // Update artifact with appended content
    await operation.patch(artifact._id, {
      content: newContent,
      streamingMetadata: {
        ...artifact.streamingMetadata,
        lastChunkAt: now,
        bytesReceived: newBytesReceived,
      },
      updatedAt: now,
    });

    // Calculate progress percentage if estimatedTotal is available
    const estimatedTotal = artifact.streamingMetadata?.estimatedTotal;
    const progress =
      estimatedTotal && estimatedTotal > 0
        ? Math.min((newBytesReceived / estimatedTotal) * 100, 100)
        : undefined;

    return await operation.complete({
      success: true,
      artifactId: args.artifactId,
      sessionId: args.sessionId,
      chunkIndex: args.chunkIndex,
      chunkBytes,
      totalBytesReceived: newBytesReceived,
      contentLength: newContent.length,
      progress,
      timestamp: now,
    });
  }),
});

/**
 * Pause active streaming
 *
 * Transitions: streaming → paused
 * Preserves content and session for later resumption.
 */
export const pauseStreaming = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    sessionId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    // Validate state transition: streaming → paused
    if (!isValidTransition(artifact.streamingState, "paused")) {
      artifactDeny("INVALID_STATE_TRANSITION");
    }

    // Verify sessionId matches
    const currentSessionId = artifact.streamingMetadata?.sessionId;
    if (currentSessionId !== args.sessionId) {
      artifactDeny("STREAMING_SESSION_INVALID");
    }

    const now = Date.now();

    // Note: Schema streamingMetadata doesn't have pausedAt/pauseReason fields
    // We transition to paused state but can't store pause metadata in schema
    await operation.patch(artifact._id, {
      streamingState: "paused",
      streamingMetadata: {
        ...artifact.streamingMetadata,
      },
      updatedAt: now,
    });

    return await operation.complete({
      success: true,
      artifactId: args.artifactId,
      sessionId: args.sessionId,
      pausedAt: now,
      previousState: "streaming",
      currentState: "paused",
      bytesReceived: artifact.streamingMetadata?.bytesReceived || 0,
      contentPreserved: true,
    });
  }),
});

/**
 * Resume paused streaming
 *
 * Transitions: paused → streaming
 * Continues from where streaming was paused.
 */
export const resumeStreaming = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    // Validate state: only paused can be resumed
    // Note: We explicitly check for paused rather than using isValidTransition because
    // draft → streaming is valid for startStreaming, not resumeStreaming
    if (artifact.streamingState !== "paused") {
      artifactDeny("INVALID_STATE_TRANSITION");
    }

    // Verify sessionId matches
    const currentSessionId = artifact.streamingMetadata?.sessionId;
    if (currentSessionId !== args.sessionId) {
      artifactDeny("STREAMING_SESSION_INVALID");
    }

    const now = Date.now();

    // Note: Schema streamingMetadata doesn't have pausedAt/resumedAt/totalPauseDuration fields
    await operation.patch(artifact._id, {
      streamingState: "streaming",
      streamingMetadata: {
        ...artifact.streamingMetadata,
      },
      updatedAt: now,
    });

    return await operation.complete({
      success: true,
      artifactId: args.artifactId,
      sessionId: args.sessionId,
      resumedAt: now,
      previousState: "paused",
      currentState: "streaming",
      bytesReceived: artifact.streamingMetadata?.bytesReceived || 0,
    });
  }),
});

/**
 * Cancel streaming and revert to draft state
 *
 * Transitions: streaming|paused → draft
 * Preserves partial content (does not lose data).
 */
export const cancelStreaming = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    sessionId: v.string(),
    reason: v.optional(v.string()),
    preserveContent: v.optional(v.boolean()), // Default: true
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    // Validate state: only streaming or paused can be cancelled
    // Note: We explicitly check states rather than using isValidTransition because
    // final → draft is valid for update operations, but not for cancel operations
    if (artifact.streamingState !== "streaming" && artifact.streamingState !== "paused") {
      artifactDeny("INVALID_STATE_TRANSITION");
    }

    // Verify sessionId matches - required for active streaming sessions
    const currentSessionId = artifact.streamingMetadata?.sessionId;
    if (!currentSessionId) {
      artifactDeny("STREAMING_SESSION_INVALID");
    }
    if (currentSessionId !== args.sessionId) {
      artifactDeny("STREAMING_SESSION_INVALID");
    }

    const now = Date.now();
    const preserveContent = args.preserveContent !== false; // Default true
    const bytesReceived = artifact.streamingMetadata?.bytesReceived || 0;
    const contentLength = artifact.content?.length || 0;

    // Revert to draft, optionally preserving content
    // Note: Schema streamingMetadata only supports limited fields
    await operation.patch(artifact._id, {
      streamingState: "draft",
      content: preserveContent ? artifact.content : "",
      streamingMetadata: {
        // Clear active session data
        sessionId: undefined,
        startedAt: undefined,
        lastChunkAt: undefined,
        bytesReceived: undefined,
        estimatedTotal: undefined,
        errorMessage: undefined,
        errorCode: undefined,
      },
      updatedAt: now,
    });

    return await operation.complete({
      success: true,
      artifactId: args.artifactId,
      sessionId: args.sessionId,
      cancelledAt: now,
      previousState: artifact.streamingState,
      currentState: "draft",
      contentPreserved: preserveContent,
      bytesReceived,
      contentLength: preserveContent ? contentLength : 0,
    });
  }),
});

/**
 * Finalize streaming and mark artifact as complete
 *
 * Transitions: streaming → final
 * Clears streamingMetadata and ensures content is complete.
 * Optionally creates a new version in history.
 */
export const finalizeStreaming = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    sessionId: v.string(),
    createVersion: v.optional(v.boolean()), // Default: true - create version history entry
    changeSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    // Validate state transition: streaming → final
    if (!isValidTransition(artifact.streamingState, "final")) {
      artifactDeny("INVALID_STATE_TRANSITION");
    }

    // Verify sessionId matches
    const currentSessionId = artifact.streamingMetadata?.sessionId;
    if (currentSessionId !== args.sessionId) {
      artifactDeny("STREAMING_SESSION_INVALID");
    }

    const now = Date.now();
    const startedAt = artifact.streamingMetadata?.startedAt || now;
    const totalDurationMs = now - startedAt;
    const bytesReceived = artifact.streamingMetadata?.bytesReceived || 0;
    const finalContent = artifact.content || "";
    const createVersion = args.createVersion !== false; // Default true

    // Prepare version history update if requested
    let versionUpdate = {};
    if (createVersion) {
      const newVersion = nextArtifactVersion(artifact);

      // Truncate history if user had undone (branching from undo state)
      let versionHistory = [...artifact.versionHistory];
      if (artifact.versionPointer < artifact.version) {
        versionHistory = versionHistory.filter(
          (v) => v.version <= artifact.versionPointer,
        );
      }

      // Add new version entry for finalized streaming content
      versionHistory.push({
        version: newVersion,
        content: finalContent,
        title: artifact.title,
        timestamp: now,
        changeType: "update" as const,
        changedBy: operation.authority.principalId,
        changeSummary: args.changeSummary || "Streaming content finalized",
      });

      versionUpdate = {
        version: newVersion,
        versionPointer: newVersion,
        versionHistory,
      };
    }

    // Finalize: transition to final state, clear streaming metadata
    // Note: Schema streamingMetadata only supports limited fields
    await operation.patch(artifact._id, {
      streamingState: "final",
      streamingMetadata: {
        // Clear all active streaming fields
        sessionId: undefined,
        startedAt: undefined,
        lastChunkAt: undefined,
        bytesReceived: undefined,
        estimatedTotal: undefined,
        errorMessage: undefined,
        errorCode: undefined,
      },
      ...versionUpdate,
      updatedAt: now,
    });

    return await operation.complete({
      success: true,
      artifactId: args.artifactId,
      sessionId: args.sessionId,
      finalizedAt: now,
      previousState: artifact.streamingState,
      currentState: "final",
      contentLength: finalContent.length,
      bytesReceived,
      totalDurationMs,
      versionCreated: createVersion,
      version: createVersion
        ? nextArtifactVersion(artifact)
        : artifact.versionPointer,
    });
  }),
});

/**
 * Set streaming error state
 *
 * Transitions: streaming|paused|draft → error
 * Records error details while preserving content.
 */
export const setStreamingError = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    errorCode: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    // Validate state transition: most states can go to error
    if (!isValidTransition(artifact.streamingState, "error")) {
      artifactDeny("INVALID_STATE_TRANSITION");
    }

    // If sessionId provided, verify it matches (optional for error state)
    const currentSessionId = artifact.streamingMetadata?.sessionId;
    if (args.sessionId && currentSessionId && currentSessionId !== args.sessionId) {
      artifactDeny("STREAMING_SESSION_INVALID");
    }

    const now = Date.now();

    await operation.patch(artifact._id, {
      streamingState: "error",
      streamingMetadata: {
        ...artifact.streamingMetadata,
        errorCode: args.errorCode,
        errorMessage: args.errorMessage,
        errorAt: now,
      },
      updatedAt: now,
    });

    return await operation.complete({
      success: true,
      artifactId: args.artifactId,
      previousState: artifact.streamingState,
      currentState: "error",
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      contentPreserved: true,
      bytesReceived: artifact.streamingMetadata?.bytesReceived || 0,
    });
  }),
});

/**
 * Retry from error state (revert to draft)
 *
 * Transitions: error → draft
 * Allows re-attempting streaming after an error.
 */
export const retryFromError = mutation({
  args: {
    memorySpaceId: v.optional(v.string()),
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    clearContent: v.optional(v.boolean()), // Default: false - preserve content
  },
  handler: async (ctx, args) => artifactHandler(async () => {
    const operation = await ArtifactOperation.begin(ctx, args, true);

    const artifact = await operation.load(args.artifactId);

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    // Validate state transition: error → draft
    if (artifact.streamingState !== "error") {
      artifactDeny("INVALID_STATE_TRANSITION");
    }

    const now = Date.now();
    const clearContent = args.clearContent === true; // Default false

    // Note: Schema streamingMetadata only supports limited fields
    await operation.patch(artifact._id, {
      streamingState: "draft",
      content: clearContent ? "" : artifact.content,
      streamingMetadata: {
        // Clear all fields for retry
        sessionId: undefined,
        startedAt: undefined,
        lastChunkAt: undefined,
        bytesReceived: undefined,
        estimatedTotal: undefined,
        errorMessage: undefined,
        errorCode: undefined,
      },
      updatedAt: now,
    });

    return await operation.complete({
      success: true,
      artifactId: args.artifactId,
      previousState: "error",
      currentState: "draft",
      contentCleared: clearContent,
      contentLength: clearContent ? 0 : (artifact.content?.length || 0),
    });
  }),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// File Storage Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a pre-signed upload URL for artifact file upload.
 *
 * This mutation creates a short-lived (1 hour) upload URL that clients
 * can use to upload files directly to Convex storage.
 *
 * @example
 * ```typescript
 * const { uploadUrl, expiresAt } = await ctx.runMutation(api.artifacts.generateArtifactUploadUrl, {
 *   artifactId: 'art-abc123',
 *   mimeType: 'image/png',
 *   filename: 'diagram.png',
 * });
 *
 * // Client uploads file to uploadUrl via POST
 * await fetch(uploadUrl, { method: 'POST', body: file });
 * ```
 */
export const generateArtifactUploadUrl = mutation({
  args: {
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    mimeType: v.string(),
    filename: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Lookup artifact (tenant-aware)
    let artifact;
    if (args.tenantId) {
      artifact = await ctx.db
        .query("artifacts")
        .withIndex("by_tenant_artifactId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("artifactId", args.artifactId),
        )
        .first();
    } else {
      const candidate = await ctx.db
        .query("artifacts")
        .withIndex("by_artifactId", (q) => q.eq("artifactId", args.artifactId))
        .first();
      artifact = candidate && !candidate.tenantId ? candidate : null;
    }

    if (!artifact) {
      throw new ConvexError("ARTIFACT_NOT_FOUND");
    }

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    // Generate upload URL (expires in 1 hour per Convex docs)
    const uploadUrl = await ctx.storage.generateUploadUrl();

    // Calculate expiration (1 hour from now)
    const expiresAt = Date.now() + 60 * 60 * 1000;

    return {
      uploadUrl,
      expiresAt,
      artifactId: args.artifactId,
      mimeType: args.mimeType,
      filename: args.filename,
    };
  },
});

/**
 * Complete artifact upload after file is uploaded to storage.
 *
 * This mutation attaches the uploaded file to the artifact,
 * clearing any existing inline content (fileRef and content are mutually exclusive).
 *
 * @example
 * ```typescript
 * // After uploading file and receiving storageId
 * await ctx.runMutation(api.artifacts.completeArtifactUpload, {
 *   artifactId: 'art-abc123',
 *   storageId: uploadedStorageId,
 *   mimeType: 'image/png',
 *   size: 102400,
 *   originalFilename: 'diagram.png',
 * });
 * ```
 */
export const completeArtifactUpload = mutation({
  args: {
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    size: v.number(),
    originalFilename: v.optional(v.string()),
    checksum: v.optional(v.string()),
    // If true, transition streamingState to "final"
    markFinal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Lookup artifact (tenant-aware)
    let artifact;
    if (args.tenantId) {
      artifact = await ctx.db
        .query("artifacts")
        .withIndex("by_tenant_artifactId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("artifactId", args.artifactId),
        )
        .first();
    } else {
      const candidate = await ctx.db
        .query("artifacts")
        .withIndex("by_artifactId", (q) => q.eq("artifactId", args.artifactId))
        .first();
      artifact = candidate && !candidate.tenantId ? candidate : null;
    }

    if (!artifact) {
      throw new ConvexError("ARTIFACT_NOT_FOUND");
    }

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    const now = Date.now();

    // Build the fileRef object
    const fileRef = {
      storageId: args.storageId,
      mimeType: args.mimeType,
      size: args.size,
      checksum: args.checksum,
      originalFilename: args.originalFilename,
    };

    // If versionPointer is not at the end, truncate future versions (branch)
    let versionHistory = [...artifact.versionHistory];
    if (artifact.versionPointer < artifact.version) {
      versionHistory = versionHistory.filter(
        (v) => v.version <= artifact.versionPointer,
      );
    }

    // Create version history entry for file attachment
    // Use versionPointer + 1 to maintain version continuity after undo
    const newVersion = artifact.versionPointer + 1;

    const newVersionEntry = {
      version: newVersion,
      content: undefined as string | undefined,
      fileRef,
      title: artifact.title,
      timestamp: now,
      changeType: "update" as const,
      changeSummary: `File attached: ${args.originalFilename || "unnamed"}`,
    };
    versionHistory.push(newVersionEntry);

    // Prepare update - content and fileRef are mutually exclusive
    const updates: Record<string, unknown> = {
      fileRef,
      content: undefined, // Clear inline content
      version: newVersion,
      versionPointer: newVersion,
      versionHistory,
      updatedAt: now,
    };

    // Optionally mark as final
    if (args.markFinal) {
      updates.streamingState = "final";
    }

    await ctx.db.patch(artifact._id, updates);

    return {
      success: true,
      artifactId: args.artifactId,
      fileRef,
      version: newVersion,
      updatedAt: now,
    };
  },
});

/**
 * Get a signed URL to download an artifact's file.
 *
 * Returns the URL along with file metadata. Returns null if no file is attached.
 *
 * @example
 * ```typescript
 * const fileData = await ctx.runQuery(api.artifacts.getArtifactFileUrl, {
 *   artifactId: 'art-abc123',
 * });
 *
 * if (fileData) {
 *   // Use fileData.url to download or display the file
 *   const response = await fetch(fileData.url);
 * }
 * ```
 */
export const getArtifactFileUrl = query({
  args: {
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Lookup artifact (tenant-aware)
    let artifact;
    if (args.tenantId) {
      artifact = await ctx.db
        .query("artifacts")
        .withIndex("by_tenant_artifactId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("artifactId", args.artifactId),
        )
        .first();
    } else {
      const candidate = await ctx.db
        .query("artifacts")
        .withIndex("by_artifactId", (q) => q.eq("artifactId", args.artifactId))
        .first();
      artifact = candidate && !candidate.tenantId ? candidate : null;
    }

    if (!artifact) {
      return null;
    }

    // Check if file is attached
    if (!artifact.fileRef) {
      return null;
    }

    // Get signed URL from storage
    const url = await ctx.storage.getUrl(artifact.fileRef.storageId);

    if (!url) {
      return null;
    }

    return {
      url,
      mimeType: artifact.fileRef.mimeType,
      size: artifact.fileRef.size,
      checksum: artifact.fileRef.checksum,
      originalFilename: artifact.fileRef.originalFilename,
      artifactId: artifact.artifactId,
    };
  },
});

/**
 * Detach (remove) file reference from an artifact.
 *
 * Optionally deletes the file from storage if deleteFile is true.
 * Creates a new version entry recording the detachment.
 *
 * @example
 * ```typescript
 * // Detach file but keep it in storage
 * await ctx.runMutation(api.artifacts.detachFile, {
 *   artifactId: 'art-abc123',
 * });
 *
 * // Detach AND delete file from storage
 * await ctx.runMutation(api.artifacts.detachFile, {
 *   artifactId: 'art-abc123',
 *   deleteFile: true,
 * });
 * ```
 */
export const detachFile = mutation({
  args: {
    artifactId: v.string(),
    tenantId: v.optional(v.string()),
    deleteFile: v.optional(v.boolean()), // Default: false
  },
  handler: async (ctx, args) => {
    // Lookup artifact (tenant-aware)
    let artifact;
    if (args.tenantId) {
      artifact = await ctx.db
        .query("artifacts")
        .withIndex("by_tenant_artifactId", (q) =>
          q.eq("tenantId", args.tenantId!).eq("artifactId", args.artifactId),
        )
        .first();
    } else {
      const candidate = await ctx.db
        .query("artifacts")
        .withIndex("by_artifactId", (q) => q.eq("artifactId", args.artifactId))
        .first();
      artifact = candidate && !candidate.tenantId ? candidate : null;
    }

    if (!artifact) {
      throw new ConvexError("ARTIFACT_NOT_FOUND");
    }

    if (artifact.isDeleted) {
      throw new ConvexError("ARTIFACT_IS_DELETED");
    }

    if (!artifact.fileRef) {
      throw new ConvexError("NO_FILE_ATTACHED");
    }

    const now = Date.now();
    const previousFileRef = artifact.fileRef;

    // Delete file from storage if requested
    if (args.deleteFile) {
      try {
        await ctx.storage.delete(artifact.fileRef.storageId);
      } catch (error) {
        // Log but don't fail - file might already be deleted or inaccessible
        console.warn(
          `Failed to delete file ${artifact.fileRef.storageId}:`,
          error,
        );
      }
    }

    // If versionPointer is not at the end, truncate future versions (branch)
    let versionHistory = [...artifact.versionHistory];
    if (artifact.versionPointer < artifact.version) {
      versionHistory = versionHistory.filter(
        (v) => v.version <= artifact.versionPointer,
      );
    }

    // Create version history entry for detachment
    // Use versionPointer + 1 to maintain version continuity after undo
    const newVersion = artifact.versionPointer + 1;

    const newVersionEntry = {
      version: newVersion,
      content: artifact.content,
      fileRef: undefined as
        | {
            storageId: typeof previousFileRef.storageId;
            mimeType: string;
            size: number;
            checksum?: string;
            originalFilename?: string;
          }
        | undefined,
      title: artifact.title,
      timestamp: now,
      changeType: "update" as const,
      changeSummary: `File detached: ${previousFileRef.originalFilename || "unnamed"}${args.deleteFile ? " (deleted from storage)" : ""}`,
    };
    versionHistory.push(newVersionEntry);

    // Clear the fileRef
    await ctx.db.patch(artifact._id, {
      fileRef: undefined,
      version: newVersion,
      versionPointer: newVersion,
      versionHistory,
      updatedAt: now,
    });

    return {
      success: true,
      artifactId: args.artifactId,
      previousFileRef: {
        storageId: previousFileRef.storageId,
        mimeType: previousFileRef.mimeType,
        size: previousFileRef.size,
        originalFilename: previousFileRef.originalFilename,
      },
      fileDeleted: args.deleteFile ?? false,
      version: newVersion,
      updatedAt: now,
    };
  },
});
