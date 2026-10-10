import {
  internalQuery,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { v } from "convex/values";
const scope = {
  userId: v.string(),
  tenantId: v.string(),
  memorySpaceId: v.string(),
};
type Scope = { userId: string; tenantId: string; memorySpaceId: string };
async function account(ctx: QueryCtx | MutationCtx, args: Scope) {
  const user = await ctx.db
    .query("chatUsers")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .unique();
  if (
    !user ||
    user.tenantId !== args.tenantId ||
    user.memorySpaceId !== args.memorySpaceId
  )
    throw new Error("Resource unavailable");
}
async function chat(
  ctx: QueryCtx | MutationCtx,
  args: Scope & { chatId: string },
) {
  await account(ctx, args);
  const parent = await ctx.db
    .query("conversations")
    .withIndex("by_conversationId", (q) => q.eq("conversationId", args.chatId))
    .unique();
  if (
    !parent ||
    parent.participants.userId !== args.userId ||
    parent.tenantId !== args.tenantId ||
    parent.memorySpaceId !== args.memorySpaceId
  )
    throw new Error("Resource unavailable");
  return parent;
}
async function artifact(
  ctx: QueryCtx | MutationCtx,
  args: Scope & { documentId: string },
) {
  await account(ctx, args);
  const parent = await ctx.db
    .query("artifacts")
    .withIndex("by_artifactId", (q) => q.eq("artifactId", args.documentId))
    .unique();
  if (
    !parent ||
    parent.userId !== args.userId ||
    parent.tenantId !== args.tenantId ||
    parent.memorySpaceId !== args.memorySpaceId
  )
    throw new Error("Resource unavailable");
  return parent;
}
function owned(row: Partial<Scope>, args: Scope) {
  if (
    row.userId !== args.userId ||
    row.tenantId !== args.tenantId ||
    row.memorySpaceId !== args.memorySpaceId
  )
    throw new Error("Resource unavailable");
}
export const messages = internalQuery({
  args: { ...scope, chatId: v.string() },
  handler: async (ctx, args) => {
    await chat(ctx, args);
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    rows.forEach((row) => owned(row, args));
    return rows
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(({ messageId, chatId, role, parts, attachments, createdAt }) => ({
        id: messageId,
        chatId,
        role,
        parts,
        attachments,
        createdAt,
      }));
  },
});
export const message = internalQuery({
  args: { ...scope, messageId: v.string() },
  handler: async (ctx, args) => {
    await account(ctx, args);
    const row = await ctx.db
      .query("chatMessages")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();
    if (!row) return null;
    owned(row, args);
    await chat(ctx, { ...args, chatId: row.chatId });
    return {
      id: row.messageId,
      chatId: row.chatId,
      role: row.role,
      parts: row.parts,
      attachments: row.attachments,
      createdAt: row.createdAt,
    };
  },
});
const messageValue = v.object({
  id: v.string(),
  chatId: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
  parts: v.any(),
  attachments: v.array(v.any()),
  createdAt: v.number(),
});
export const saveMessages = internalMutation({
  args: { ...scope, messages: v.array(messageValue) },
  handler: async (ctx, args) => {
    // Validate the entire batch before writes; native mutation rollback is authoritative.
    for (const message of args.messages) {
      await chat(ctx, { ...args, chatId: message.chatId });
      const existing = await ctx.db
        .query("chatMessages")
        .withIndex("by_message", (q) => q.eq("messageId", message.id))
        .unique();
      if (existing) {
        owned(existing, args);
        if (existing.chatId !== message.chatId)
          throw new Error("Resource unavailable");
      }
    }
    for (const message of args.messages) {
      const existing = await ctx.db
        .query("chatMessages")
        .withIndex("by_message", (q) => q.eq("messageId", message.id))
        .unique();
      const value = {
        messageId: message.id,
        chatId: message.chatId,
        userId: args.userId,
        tenantId: args.tenantId,
        memorySpaceId: args.memorySpaceId,
        role: message.role,
        parts: message.parts,
        attachments: message.attachments,
        createdAt: message.createdAt,
      };
      if (existing)
        await ctx.db.patch(existing._id, {
          parts: message.parts,
          attachments: message.attachments,
        });
      else await ctx.db.insert("chatMessages", value);
    }
    return null;
  },
});
export const updateMessage = internalMutation({
  args: { ...scope, messageId: v.string(), parts: v.any() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("chatMessages")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();
    if (!row) throw new Error("Resource unavailable");
    owned(row, args);
    await chat(ctx, { ...args, chatId: row.chatId });
    await ctx.db.patch(row._id, { parts: args.parts });
    return null;
  },
});
export const truncate = internalMutation({
  args: { ...scope, chatId: v.string(), timestamp: v.number() },
  handler: async (ctx, args) => {
    await chat(ctx, args);
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    rows.forEach((row) => owned(row, args));
    for (const row of rows)
      if (row.createdAt >= args.timestamp) await ctx.db.delete(row._id);
    const votes = await ctx.db
      .query("chatVotes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.chatId))
      .collect();
    votes.forEach((row) => owned(row, args));
    for (const vote of votes)
      if (
        rows.some(
          (row) =>
            row.messageId === vote.messageId && row.createdAt >= args.timestamp,
        )
      )
        await ctx.db.delete(vote._id);
    const branch = await ctx.db
      .query("chatBranches")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .unique();
    if (branch) {
      owned(branch, args);
      await ctx.db.patch(branch._id, { edited: true });
    } else
      await ctx.db.insert("chatBranches", {
        userId: args.userId,
        tenantId: args.tenantId,
        memorySpaceId: args.memorySpaceId,
        chatId: args.chatId,
        edited: true,
      });
    return null;
  },
});
export const branchEdited = internalQuery({
  args: { ...scope, chatId: v.string() },
  handler: async (ctx, args) => {
    await chat(ctx, args);
    const branch = await ctx.db
      .query("chatBranches")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .unique();
    if (branch) owned(branch, args);
    return !!branch?.edited;
  },
});
export const setTitle = internalMutation({
  args: { ...scope, chatId: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const parent = await chat(ctx, args);
    if (!args.title.trim() || args.title.length > 200)
      throw new Error("Invalid title");
    await ctx.db.patch(parent._id, {
      metadata: { ...parent.metadata, title: args.title },
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const setVisibility = internalMutation({
  args: {
    ...scope,
    chatId: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    const parent = await chat(ctx, args);
    await ctx.db.patch(parent._id, {
      visibility: args.visibility,
      updatedAt: Date.now(),
    });
    return null;
  },
});
export const votes = internalQuery({
  args: { ...scope, chatId: v.string() },
  handler: async (ctx, args) => {
    await chat(ctx, args);
    const rows = await ctx.db
      .query("chatVotes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.chatId))
      .collect();
    rows.forEach((row) => owned(row, args));
    return rows.map((row) => ({
      chatId: row.sessionId,
      messageId: row.messageId,
      isUpvoted: row.isUpvoted,
    }));
  },
});
export const vote = internalMutation({
  args: {
    ...scope,
    chatId: v.string(),
    messageId: v.string(),
    type: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    await chat(ctx, args);
    const message = await ctx.db
      .query("chatMessages")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();
    if (!message || message.chatId !== args.chatId)
      throw new Error("Resource unavailable");
    owned(message, args);
    const rows = await ctx.db
      .query("chatVotes")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    rows.forEach((row) => owned(row, args));
    if (rows.length > 1) throw new Error("Resource unavailable");
    if (rows[0])
      await ctx.db.patch(rows[0]._id, { isUpvoted: args.type === "up" });
    else
      await ctx.db.insert("chatVotes", {
        sessionId: args.chatId,
        messageId: args.messageId,
        userId: args.userId,
        tenantId: args.tenantId,
        memorySpaceId: args.memorySpaceId,
        isUpvoted: args.type === "up",
        createdAt: Date.now(),
      });
    return null;
  },
});
export const suggestions = internalQuery({
  args: { ...scope, documentId: v.string() },
  handler: async (ctx, args) => {
    await artifact(ctx, args);
    const rows = await ctx.db
      .query("suggestions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    rows.forEach((row) => owned(row, args));
    return rows.map((row) => ({
      id: row.suggestionId,
      documentId: row.documentId,
      documentCreatedAt: row.documentCreatedAt,
      originalText: row.originalText,
      suggestedText: row.suggestedText,
      description: row.description || null,
      isResolved: row.isResolved,
      userId: row.userId,
      createdAt: row.createdAt,
    }));
  },
});
const suggestionValue = v.object({
  id: v.string(),
  documentId: v.string(),
  documentCreatedAt: v.number(),
  originalText: v.string(),
  suggestedText: v.string(),
  description: v.optional(v.string()),
  isResolved: v.boolean(),
  userId: v.string(),
  createdAt: v.number(),
});
export const saveSuggestions = internalMutation({
  args: { ...scope, suggestions: v.array(suggestionValue) },
  handler: async (ctx, args) => {
    for (const row of args.suggestions) {
      if (row.userId !== args.userId) throw new Error("Resource unavailable");
      await artifact(ctx, { ...args, documentId: row.documentId });
    }
    for (const row of args.suggestions) {
      const { id, ...value } = row;
      await ctx.db.insert("suggestions", {
        ...value,
        suggestionId: id,
        tenantId: args.tenantId,
        memorySpaceId: args.memorySpaceId,
      });
    }
    return null;
  },
});
export const recordStream = internalMutation({
  args: { ...scope, chatId: v.string(), streamId: v.string() },
  handler: async (ctx, args) => {
    await chat(ctx, args);
    await ctx.db.insert("chatStreams", { ...args, createdAt: Date.now() });
    return null;
  },
});
/** Intentional server share gateway: text only, current visibility, no private metadata. */
export const publicShare = internalQuery({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const parent = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.chatId),
      )
      .unique();
    if (!parent || parent.visibility !== "public") return null;
    const user = await ctx.db
      .query("chatUsers")
      .withIndex("by_user", (q) =>
        q.eq("userId", parent.participants.userId || ""),
      )
      .unique();
    if (
      !user ||
      user.tenantId !== parent.tenantId ||
      user.memorySpaceId !== parent.memorySpaceId
    )
      return null;
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    rows.forEach((row) =>
      owned(row, {
        userId: user.userId,
        tenantId: user.tenantId,
        memorySpaceId: user.memorySpaceId,
      }),
    );
    return {
      title:
        typeof parent.metadata?.title === "string"
          ? parent.metadata.title
          : "Shared chat",
      createdAt: parent.createdAt,
      messages: rows
        .filter((row) => row.role !== "system")
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((row) => ({
          role: row.role,
          text: Array.isArray(row.parts)
            ? row.parts
                .filter(
                  (part) =>
                    part &&
                    part.type === "text" &&
                    typeof part.text === "string",
                )
                .map((part) => part.text)
                .join("\n")
            : "",
        })),
    };
  },
});

export const recallBranches = internalQuery({
  args: scope,
  handler: async (ctx, args) => {
    await account(ctx, args);
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("participants.userId", args.userId))
      .collect();
    const rows = conversations.filter(
      (row) =>
        row.tenantId === args.tenantId &&
        row.memorySpaceId === args.memorySpaceId,
    );
    return Promise.all(
      rows.map(async (row) => {
        const branch = await ctx.db
          .query("chatBranches")
          .withIndex("by_chat", (q) => q.eq("chatId", row.conversationId))
          .unique();
        if (branch) owned(branch, args);
        return { conversationId: row.conversationId, edited: !!branch?.edited };
      }),
    );
  },
});

export const documentVersions = internalQuery({
  args: { ...scope, documentId: v.string() },
  handler: async (ctx, args) => {
    await artifact(ctx, args);
    const row = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();
    if (row) owned(row, args);
    return row?.versions || null;
  },
});
export const setDocumentVersions = internalMutation({
  args: { ...scope, documentId: v.string(), versions: v.array(v.number()) },
  handler: async (ctx, args) => {
    const parent = await artifact(ctx, args);
    if (
      !args.versions.length ||
      args.versions.some(
        (version) =>
          !Number.isInteger(version) || version < 1 || version > parent.version,
      ) ||
      new Set(args.versions).size !== args.versions.length
    )
      throw new Error("Invalid active versions");
    const row = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();
    if (row) {
      owned(row, args);
      await ctx.db.patch(row._id, {
        versions: args.versions,
        selectedVersion: args.versions[args.versions.length - 1],
      });
    } else
      await ctx.db.insert("documentVersions", {
        ...args,
        selectedVersion: args.versions[args.versions.length - 1],
      });
    return null;
  },
});
export const clearChat = internalMutation({
  args: { ...scope, chatId: v.string() },
  handler: async (ctx, args) => {
    await account(ctx, args);
    const parent = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.chatId),
      )
      .unique();
    if (parent) await chat(ctx, args);
    const rows = [
      ...(await ctx.db
        .query("chatMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
        .collect()),
      ...(await ctx.db
        .query("chatVotes")
        .withIndex("by_session", (q) => q.eq("sessionId", args.chatId))
        .collect()),
      ...(await ctx.db
        .query("chatBranches")
        .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
        .collect()),
      ...(await ctx.db
        .query("chatStreams")
        .filter((q) => q.eq(q.field("chatId"), args.chatId))
        .collect()),
    ];
    rows.forEach((row) => owned(row, args));
    for (const row of rows) await ctx.db.delete(row._id);
    return null;
  },
});
export const clearAllChats = internalMutation({
  args: scope,
  handler: async (ctx, args) => {
    await account(ctx, args);
    for (const table of [
      "chatMessages",
      "chatVotes",
      "chatBranches",
      "chatStreams",
    ] as const) {
      const rows = await ctx.db
        .query(table)
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.userId),
            q.eq(q.field("tenantId"), args.tenantId),
            q.eq(q.field("memorySpaceId"), args.memorySpaceId),
          ),
        )
        .collect();
      rows.forEach((row) => owned(row, args));
      for (const row of rows) await ctx.db.delete(row._id);
    }
    return null;
  },
});

export const documentSelection = internalQuery({
  args: { ...scope, documentId: v.string() },
  handler: async (ctx, args) => {
    await artifact(ctx, args);
    const row = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();
    if (row) owned(row, args);
    return row?.selectedVersion || null;
  },
});
export const selectDocumentVersion = internalMutation({
  args: { ...scope, documentId: v.string(), version: v.number() },
  handler: async (ctx, args) => {
    await artifact(ctx, args);
    const row = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();
    if (!row) throw new Error("Resource unavailable");
    owned(row, args);
    if (!row.versions.includes(args.version))
      throw new Error("Resource unavailable");
    await ctx.db.patch(row._id, { selectedVersion: args.version });
    return null;
  },
});

export const registerUpload = internalMutation({
  args: { ...scope, attachmentId: v.string(), url: v.string() },
  handler: async (ctx, args) => {
    await account(ctx, args);
    const attachment = await ctx.db
      .query("attachments")
      .withIndex("by_attachmentId", (q) =>
        q.eq("attachmentId", args.attachmentId),
      )
      .unique();
    if (!attachment) throw new Error("Resource unavailable");
    owned(attachment, args);
    if (
      !["image/png", "image/jpeg"].includes(attachment.mimeType) ||
      (!args.url.startsWith("https://") &&
        !args.url.startsWith("http://127.0.0.1:") &&
        !args.url.startsWith("http://localhost:") &&
        !args.url.startsWith("http://[::1]:"))
    )
      throw new Error("Invalid upload");
    const existing = await ctx.db
      .query("chatUploads")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();
    if (existing) {
      owned(existing, args);
      if (existing.attachmentId !== args.attachmentId)
        throw new Error("Resource unavailable");
      return;
    }
    await ctx.db.insert("chatUploads", {
      ...args,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
    });
  },
});
export const verifyUploads = internalQuery({
  args: {
    ...scope,
    files: v.array(
      v.object({ url: v.string(), name: v.string(), mediaType: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    await account(ctx, args);
    if (args.files.length > 10) throw new Error("Too many uploads");
    for (const file of args.files) {
      const upload = await ctx.db
        .query("chatUploads")
        .withIndex("by_url", (q) => q.eq("url", file.url))
        .unique();
      if (!upload) throw new Error("Resource unavailable");
      owned(upload, args);
      const attachment = await ctx.db
        .query("attachments")
        .withIndex("by_attachmentId", (q) =>
          q.eq("attachmentId", upload.attachmentId),
        )
        .unique();
      if (!attachment) throw new Error("Resource unavailable");
      owned(attachment, args);
      if (file.name !== upload.filename || file.mediaType !== upload.mimeType)
        throw new Error("Resource unavailable");
    }
    return true;
  },
});

export const listChats = internalQuery({
  args: {
    ...scope,
    limit: v.number(),
    startingAfter: v.optional(v.string()),
    endingBefore: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await account(ctx, args);
    if (
      !Number.isInteger(args.limit) ||
      args.limit < 1 ||
      args.limit > 101 ||
      (args.startingAfter && args.endingBefore)
    )
      throw new Error("Invalid history request");
    const rows = (
      await ctx.db
        .query("conversations")
        .withIndex("by_user", (q) => q.eq("participants.userId", args.userId))
        .collect()
    )
      .filter(
        (row) =>
          row.tenantId === args.tenantId &&
          row.memorySpaceId === args.memorySpaceId,
      )
      .sort(
        (a, b) =>
          b.createdAt - a.createdAt ||
          b.conversationId.localeCompare(a.conversationId),
      );
    const cursor = args.endingBefore || args.startingAfter;
    const index = cursor
      ? rows.findIndex((row) => row.conversationId === cursor)
      : -1;
    if (cursor && index < 0) throw new Error("Resource unavailable");
    // The shipped sidebar uses ending_before to request older pages. IDs break timestamp ties.
    const page = args.endingBefore
      ? rows.slice(index + 1)
      : args.startingAfter
        ? rows.slice(0, index)
        : rows;
    return page.slice(0, args.limit).map((row) => ({
      id: row.conversationId,
      userId: row.participants.userId,
      title:
        typeof row.metadata?.title === "string"
          ? row.metadata.title
          : "New Chat",
      visibility: row.visibility === "public" ? "public" : "private",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});
export const messageCount = internalQuery({
  args: { ...scope, since: v.number() },
  handler: async (ctx, args) => {
    await account(ctx, args);
    if (!Number.isFinite(args.since)) throw new Error("Invalid message window");
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return rows.filter(
      (row) =>
        row.tenantId === args.tenantId &&
        row.memorySpaceId === args.memorySpaceId &&
        row.createdAt >= args.since,
    ).length;
  },
});
