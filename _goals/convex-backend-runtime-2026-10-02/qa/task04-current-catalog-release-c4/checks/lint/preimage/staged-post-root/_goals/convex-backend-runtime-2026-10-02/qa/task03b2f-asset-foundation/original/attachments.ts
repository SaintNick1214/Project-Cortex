/**
 * Cortex SDK - Attachments API
 *
 * Multi-modal file storage for images, PDFs, audio, video, and generic files.
 * Memory space-scoped with multi-tenancy support.
 *
 * Features:
 * - Convex native file storage integration
 * - Upload URL generation for direct client uploads
 * - Signed download URLs
 * - Memory space isolation
 * - Multi-tenancy support
 * - Conversation/message/memory/artifact linkage
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared Validators
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const attachmentTypeValidator = v.union(
  v.literal("image"),
  v.literal("audio"),
  v.literal("video"),
  v.literal("file"),
  v.literal("pdf"),
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a unique attachment ID
 */
function generateAttachmentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `attach-${timestamp}-${random}`;
}

/**
 * Helper to lookup attachment with tenant awareness
 */
async function lookupAttachment(
  ctx: { db: any },
  attachmentId: string,
  tenantId?: string,
) {
  if (tenantId) {
    return await ctx.db
      .query("attachments")
      .withIndex("by_tenant_attachmentId", (q: any) =>
        q.eq("tenantId", tenantId).eq("attachmentId", attachmentId),
      )
      .first();
  }

  const candidate = await ctx.db
    .query("attachments")
    .withIndex("by_attachmentId", (q: any) =>
      q.eq("attachmentId", attachmentId),
    )
    .first();

  // Security: Only match global records (no tenantId) to prevent cross-tenant access
  return candidate && !candidate.tenantId ? candidate : null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mutations (Write Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a pre-signed upload URL for file upload.
 *
 * This mutation creates a short-lived (1 hour) upload URL that clients
 * can use to upload files directly to Convex storage.
 *
 * @example
 * ```typescript
 * const { uploadUrl } = await cortex.attachments.generateUploadUrl();
 *
 * // Client uploads file to uploadUrl via POST
 * const response = await fetch(uploadUrl, { method: 'POST', body: file });
 * const { storageId } = await response.json();
 *
 * // Then register the attachment
 * await cortex.attachments.attach({ storageId, ... });
 * ```
 */
export const generateUploadUrl = mutation({
  args: {
    // Multi-tenancy (optional - passed by SDKs for consistency/auditing)
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx) => {
    // Generate upload URL (expires in 1 hour per Convex docs)
    // Note: tenantId is accepted for SDK consistency but not used here
    // since Convex storage is global; tenant isolation happens at attach()
    const uploadUrl = await ctx.storage.generateUploadUrl();

    return {
      uploadUrl,
    };
  },
});

/**
 * Register an uploaded file as an attachment.
 *
 * Call this after successfully uploading a file using the URL from generateUploadUrl.
 */
export const attach = mutation({
  args: {
    // Required fields
    storageId: v.id("_storage"), // Convex storage ID from upload
    memorySpaceId: v.string(), // Memory space isolation
    userId: v.string(), // User who owns this attachment
    type: attachmentTypeValidator, // Attachment type
    mimeType: v.string(), // MIME type (e.g., "image/png")
    filename: v.string(), // Original filename
    size: v.number(), // File size in bytes

    // Optional linkage
    conversationId: v.optional(v.string()), // Link to conversation
    messageId: v.optional(v.string()), // Link to specific message
    memoryId: v.optional(v.string()), // Link to memory
    artifactId: v.optional(v.string()), // Link to artifact

    // Optional type-specific metadata
    dimensions: v.optional(
      v.object({
        width: v.number(),
        height: v.number(),
      }),
    ), // Image/video dimensions
    duration: v.optional(v.number()), // Audio/video duration in seconds

    // Generic metadata
    metadata: v.optional(v.any()),

    // Multi-tenancy
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const attachmentId = generateAttachmentId();

    // Verify the storage ID exists
    const storageMetadata = await ctx.storage.getMetadata(args.storageId);
    if (!storageMetadata) {
      throw new ConvexError({
        code: "INVALID_STORAGE_ID",
        message: "The provided storageId does not exist or has expired.",
      });
    }

    const _id = await ctx.db.insert("attachments", {
      attachmentId,
      memorySpaceId: args.memorySpaceId,
      tenantId: args.tenantId,
      userId: args.userId,
      conversationId: args.conversationId,
      messageId: args.messageId,
      memoryId: args.memoryId,
      artifactId: args.artifactId,
      storageId: args.storageId,
      type: args.type,
      mimeType: args.mimeType,
      filename: args.filename,
      size: args.size,
      dimensions: args.dimensions,
      duration: args.duration,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(_id);
  },
});

/**
 * Delete a single attachment.
 *
 * Removes both the metadata record and the file from storage.
 */
export const remove = mutation({
  args: {
    attachmentId: v.string(),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const attachment = await lookupAttachment(
      ctx,
      args.attachmentId,
      args.tenantId,
    );

    if (!attachment) {
      throw new ConvexError({
        code: "ATTACHMENT_NOT_FOUND",
        message: `Attachment with ID '${args.attachmentId}' not found.`,
      });
    }

    // Delete file from storage
    try {
      await ctx.storage.delete(attachment.storageId);
    } catch (error) {
      // Log but don't fail - file might already be deleted or inaccessible
      console.warn(
        `Failed to delete file ${attachment.storageId}:`,
        error,
      );
    }

    // Delete the attachment record
    await ctx.db.delete(attachment._id);

    return {
      deleted: true,
      attachmentId: args.attachmentId,
      deletedAt: Date.now(),
    };
  },
});

/**
 * Bulk delete multiple attachments.
 *
 * Removes both the metadata records and files from storage.
 * Returns the count of successfully deleted attachments.
 */
export const removeMany = mutation({
  args: {
    attachmentIds: v.array(v.string()),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let deleted = 0;
    const errors: Array<{ attachmentId: string; error: string }> = [];

    for (const attachmentId of args.attachmentIds) {
      try {
        const attachment = await lookupAttachment(
          ctx,
          attachmentId,
          args.tenantId,
        );

        if (!attachment) {
          errors.push({
            attachmentId,
            error: "ATTACHMENT_NOT_FOUND",
          });
          continue;
        }

        // Delete file from storage
        try {
          await ctx.storage.delete(attachment.storageId);
        } catch (error) {
          console.warn(
            `Failed to delete file ${attachment.storageId}:`,
            error,
          );
        }

        // Delete the attachment record
        await ctx.db.delete(attachment._id);
        deleted++;
      } catch (error) {
        errors.push({
          attachmentId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      deleted,
      total: args.attachmentIds.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});

/**
 * Purge ALL attachments (TEST/DEV ONLY)
 *
 * WARNING: Permanently deletes all attachments and their files!
 */
export const purgeAll = mutation({
  args: {
    memorySpaceId: v.optional(v.string()), // Limit to memory space if provided
    tenantId: v.optional(v.string()), // Limit to tenant if provided
  },
  handler: async (ctx, args) => {
    // Safety check: Only allow in test/dev environments
    const siteUrl = process.env.CONVEX_SITE_URL || "";
    const isLocal =
      siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
    const isDevDeployment =
      siteUrl.includes(".convex.site") ||
      siteUrl.includes("dev-") ||
      siteUrl.includes("-dev") ||
      siteUrl.includes("preview") ||
      siteUrl.includes("staging");
    const isTestEnv =
      process.env.NODE_ENV === "test" ||
      process.env.CONVEX_ENVIRONMENT === "test" ||
      process.env.CONVEX_ENVIRONMENT === "development";

    if (!isLocal && !isDevDeployment && !isTestEnv) {
      throw new Error(
        "PURGE_DISABLED_IN_PRODUCTION: purgeAll is only available in test/dev environments.",
      );
    }

    let attachments;
    if (args.tenantId && args.memorySpaceId) {
      attachments = await ctx.db
        .query("attachments")
        .withIndex("by_tenant_space", (q) =>
          q
            .eq("tenantId", args.tenantId!)
            .eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else if (args.tenantId) {
      attachments = await ctx.db
        .query("attachments")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId!))
        .collect();
    } else if (args.memorySpaceId) {
      attachments = await ctx.db
        .query("attachments")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId!),
        )
        .collect();
    } else {
      attachments = await ctx.db.query("attachments").collect();
    }

    let filesDeleted = 0;
    for (const attachment of attachments) {
      // Delete file from storage
      try {
        await ctx.storage.delete(attachment.storageId);
        filesDeleted++;
      } catch (error) {
        console.warn(
          `Failed to delete file ${attachment.storageId}:`,
          error,
        );
      }

      // Delete the attachment record
      await ctx.db.delete(attachment._id);
    }

    return {
      deleted: attachments.length,
      filesDeleted,
    };
  },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Queries (Read Operations)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get a single attachment by ID.
 */
export const get = query({
  args: {
    attachmentId: v.string(),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await lookupAttachment(ctx, args.attachmentId, args.tenantId);
  },
});

/**
 * Get signed download URL for an attachment.
 */
export const getUrl = query({
  args: {
    attachmentId: v.string(),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const attachment = await lookupAttachment(
      ctx,
      args.attachmentId,
      args.tenantId,
    );

    if (!attachment) {
      return null;
    }

    // Get signed URL from storage
    const url = await ctx.storage.getUrl(attachment.storageId);

    if (!url) {
      return null;
    }

    return {
      url,
      attachmentId: attachment.attachmentId,
      mimeType: attachment.mimeType,
      filename: attachment.filename,
      size: attachment.size,
    };
  },
});

/**
 * List attachments with comprehensive filters and pagination.
 */
export const list = query({
  args: {
    memorySpaceId: v.string(), // Required - memory space isolation
    tenantId: v.optional(v.string()),

    // Optional filters
    conversationId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    memoryId: v.optional(v.string()),
    artifactId: v.optional(v.string()),
    userId: v.optional(v.string()),
    type: v.optional(attachmentTypeValidator),

    // Pagination
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),

    // Sorting
    sortBy: v.optional(v.union(v.literal("createdAt"), v.literal("updatedAt"))),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 50, 1000); // Max 1000 (matches SDK validators)

    // Select optimal index based on provided filters
    let attachments;

    if (args.tenantId) {
      attachments = await ctx.db
        .query("attachments")
        .withIndex("by_tenant_space", (q) =>
          q
            .eq("tenantId", args.tenantId!)
            .eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();
    } else if (args.type) {
      attachments = await ctx.db
        .query("attachments")
        .withIndex("by_memorySpace_type", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId).eq("type", args.type!),
        )
        .collect();
      // Security: Only match global records when no tenantId provided
      attachments = attachments.filter((a) => !a.tenantId);
    } else {
      attachments = await ctx.db
        .query("attachments")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();
      // Security: Only match global records when no tenantId provided
      attachments = attachments.filter((a) => !a.tenantId);
    }

    // Apply post-filters
    if (args.conversationId) {
      attachments = attachments.filter(
        (a) => a.conversationId === args.conversationId,
      );
    }
    if (args.messageId) {
      attachments = attachments.filter((a) => a.messageId === args.messageId);
    }
    if (args.memoryId) {
      attachments = attachments.filter((a) => a.memoryId === args.memoryId);
    }
    if (args.artifactId) {
      attachments = attachments.filter((a) => a.artifactId === args.artifactId);
    }
    if (args.userId) {
      attachments = attachments.filter((a) => a.userId === args.userId);
    }
    // Filter by type if not already filtered by index
    if (args.type && args.tenantId) {
      attachments = attachments.filter((a) => a.type === args.type);
    }

    // Get total before pagination
    const total = attachments.length;

    // Sort
    const sortBy = args.sortBy || "createdAt";
    const sortOrder = args.sortOrder || "desc";
    const multiplier = sortOrder === "desc" ? -1 : 1;

    attachments.sort((a, b) => {
      const aVal = sortBy === "updatedAt" ? a.updatedAt : a.createdAt;
      const bVal = sortBy === "updatedAt" ? b.updatedAt : b.createdAt;
      return (aVal - bVal) * multiplier;
    });

    // Handle cursor-based pagination
    let offset = 0;
    if (args.cursor) {
      try {
        const cursorData = JSON.parse(
          Buffer.from(args.cursor, "base64").toString("utf-8"),
        );
        offset = cursorData.offset || 0;
      } catch {
        // Invalid cursor, start from beginning
        offset = 0;
      }
    }

    // Paginate
    const paginated = attachments.slice(offset, offset + limit);

    // Generate next cursor
    const hasMore = offset + limit < total;
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ offset: offset + limit })).toString(
          "base64",
        )
      : undefined;

    return {
      attachments: paginated,
      total,
      cursor: nextCursor,
      hasMore,
    };
  },
});

/**
 * Count attachments matching filters.
 */
export const count = query({
  args: {
    memorySpaceId: v.string(),
    tenantId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    userId: v.optional(v.string()),
    type: v.optional(attachmentTypeValidator),
  },
  handler: async (ctx, args) => {
    let attachments;

    if (args.tenantId) {
      attachments = await ctx.db
        .query("attachments")
        .withIndex("by_tenant_space", (q) =>
          q
            .eq("tenantId", args.tenantId!)
            .eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();
    } else {
      attachments = await ctx.db
        .query("attachments")
        .withIndex("by_memorySpace", (q) =>
          q.eq("memorySpaceId", args.memorySpaceId),
        )
        .collect();
      // Security: Only match global records when no tenantId provided
      attachments = attachments.filter((a) => !a.tenantId);
    }

    // Apply filters
    if (args.conversationId) {
      attachments = attachments.filter(
        (a) => a.conversationId === args.conversationId,
      );
    }
    if (args.messageId) {
      attachments = attachments.filter((a) => a.messageId === args.messageId);
    }
    if (args.userId) {
      attachments = attachments.filter((a) => a.userId === args.userId);
    }
    if (args.type) {
      attachments = attachments.filter((a) => a.type === args.type);
    }

    return attachments.length;
  },
});

/**
 * Get multiple attachments by IDs.
 */
export const getByIds = query({
  args: {
    attachmentIds: v.array(v.string()),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results: Array<any> = [];

    for (const attachmentId of args.attachmentIds) {
      const attachment = await lookupAttachment(
        ctx,
        attachmentId,
        args.tenantId,
      );
      if (attachment) {
        results.push(attachment);
      }
    }

    return results;
  },
});

/**
 * Get attachments for a specific conversation.
 */
export const getByConversation = query({
  args: {
    conversationId: v.string(),
    tenantId: v.optional(v.string()),
    type: v.optional(attachmentTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 50, 100);

    let attachments = await ctx.db
      .query("attachments")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    // Tenant filtering
    if (args.tenantId) {
      attachments = attachments.filter((a) => a.tenantId === args.tenantId);
    } else {
      // Security: Only match global records when no tenantId provided
      attachments = attachments.filter((a) => !a.tenantId);
    }

    // Type filtering
    if (args.type) {
      attachments = attachments.filter((a) => a.type === args.type);
    }

    // Sort by createdAt descending (newest first)
    attachments.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit
    return attachments.slice(0, limit);
  },
});

/**
 * Get attachments for a specific message.
 */
export const getByMessage = query({
  args: {
    messageId: v.string(),
    tenantId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let attachments = await ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    // Tenant filtering
    if (args.tenantId) {
      attachments = attachments.filter((a) => a.tenantId === args.tenantId);
    } else {
      // Security: Only match global records when no tenantId provided
      attachments = attachments.filter((a) => !a.tenantId);
    }

    // Sort by createdAt ascending (order added)
    attachments.sort((a, b) => a.createdAt - b.createdAt);

    return attachments;
  },
});
