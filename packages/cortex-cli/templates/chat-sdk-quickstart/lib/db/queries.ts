/**
 * Chat SDK Query Functions
 *
 * Private app rows hold the current editable message and artifact view.
 * Cortex conversations and artifact versions retain their separate audit history.
 *
 * Schema Mapping:
 * | Chat SDK Field | Cortex Conversation Field |
 * |---------------|---------------------------|
 * | id            | conversationId            |
 * | userId        | participants.userId       |
 * | title         | metadata.title            |
 * | visibility    | visibility                |
 * | createdAt     | createdAt (as Date)       |
 * | updatedAt     | updatedAt (as Date)       |
 */

import type { Chat, DBMessage, Document, Suggestion, Vote } from "@/lib/types";
import {
  requireScope,
  withCortex,
  assertChatOwner,
  assertArtifactOwner,
  getMemorySpaceId,
  getAgentId,
} from "@/lib/cortex";
import { privateCall, privateConfiguration } from "@/lib/private-backend";
import { ChatSDKError } from "@/lib/errors";
import { randomUUID } from "node:crypto";
import { hash } from "bcrypt-ts";
import type {
  Conversation,
  Artifact,
  ArtifactVersion,
} from "@cortexmemory/sdk";
// ============================================================================
// Type Conversion Helpers
// ============================================================================

/**
 * Convert a Cortex Conversation to a Chat SDK Chat
 */
function conversationToChat(conversation: Conversation): Chat {
  return {
    id: conversation.conversationId,
    userId: conversation.participants?.userId || "",
    title: (conversation.metadata?.title as string) || "New Chat",
    visibility: conversation.visibility === "public" ? "public" : "private",
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
  };
}

// ============================================================================
// User Queries
// ============================================================================

export async function getUser(
  email: string
): Promise<Array<{ id: string; email: string; password: string | null }>> {
  const record = await privateCall<{
    id: string;
    email: string;
    password: string | null;
  } | null>("app/chatUsers:credentialByEmail", {
    email: email.trim().toLowerCase(),
  });
  return record ? [record] : [];
}

export async function createUser(
  email: string,
  password: string
): Promise<Array<{ id: string; email: string }>> {
  if (password.length < 6 || password.length > 1024)
    throw new ChatSDKError("bad_request:auth");
  const userId = randomUUID();
  const result = await privateCall<
    { id: string; email: string } | { error: string }
  >("app/chatUsers:register", {
    userId,
    email: email.trim().toLowerCase(),
    passwordHash: await hash(password, 12),
    tenantId: privateConfiguration().tenantId,
    memorySpaceId: getMemorySpaceId(userId),
  });
  if ("error" in result)
    throw new ChatSDKError("bad_request:auth", "Account already exists");
  return [result];
}

export async function createGuestUser(): Promise<
  Array<{ id: string; email: string }>
> {
  const userId = randomUUID();
  const result = await privateCall<{ id: string; email: string }>(
    "app/chatUsers:createGuest",
    {
      userId,
      email: `guest-${userId}@example.com`,
      tenantId: privateConfiguration().tenantId,
      memorySpaceId: getMemorySpaceId(userId),
    }
  );
  return [result];
}

// ============================================================================
// Chat Queries (Cortex Conversations API)
// ============================================================================

export async function getChatById({
  id,
}: {
  id: string;
}): Promise<Chat | null> {
  const scope = await requireScope();
  return withCortex(scope, async (cortex) => {
    const conversation = await cortex.conversations.get(id);
    if (!conversation) {
      return null;
    }

    assertChatOwner(conversation, scope);
    return conversationToChat(conversation);
  });
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}): Promise<Chat[]> {
  const scope = await requireScope(id);
  const rows = await privateCall<
    Array<
      Omit<Chat, "createdAt" | "updatedAt"> & {
        createdAt: number;
        updatedAt: number;
      }
    >
  >("app/chatData:listChats", {
    ...scope,
    limit,
    ...(startingAfter ? { startingAfter } : {}),
    ...(endingBefore ? { endingBefore } : {}),
  });
  return rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: "private" | "public";
}): Promise<Chat> {
  const scope = await requireScope(userId);
  return withCortex(scope, async (cortex) => {
    const memorySpaceId = scope.memorySpaceId;
    const agentId = getAgentId();

    // Check if conversation already exists
    const existing = await cortex.conversations.get(id);
    if (existing) {
      assertChatOwner(existing, scope);
      // Return existing conversation as Chat
      return conversationToChat(existing);
    }

    // Establish the physical owned registry before capturing conversation references.
    const registry = await cortex.memorySpaces.get(memorySpaceId);
    if (!registry)
      await cortex.memorySpaces.register({
        memorySpaceId,
        tenantId: scope.tenantId,
        type: "personal",
        participants: [{ id: scope.userId, type: "user" }],
      });

    // Create new conversation
    const conversation = await cortex.conversations.create({
      conversationId: id,
      memorySpaceId,
      type: "user-agent",
      participants: {
        userId,
        agentId,
      },
      metadata: {
        title,
      },
      visibility,
    });

    assertChatOwner(conversation, scope);
    return conversationToChat(conversation);
  }, process.env.CORTEX_GRAPH_SYNC === "true");
}

export async function deleteChatById({ id }: { id: string }): Promise<Chat> {
  const scope = await requireScope();
  return withCortex(scope, async (cortex) => {
    // Get the chat first to return it
    const conversation = await cortex.conversations.get(id);
    if (!conversation) {
      throw new Error(`Chat ${id} not found`);
    }

    assertChatOwner(conversation, scope);
    const chat = conversationToChat(conversation);

    // Delete the conversation
    await cortex.conversations.delete(id);
    await privateCall("app/chatData:clearChat", { ...scope, chatId: id });

    return chat;
  }, process.env.CORTEX_GRAPH_SYNC === "true");
}

export async function deleteAllChatsByUserId({
  userId,
}: {
  userId: string;
}): Promise<{ deletedCount: number }> {
  const scope = await requireScope(userId);
  return withCortex(scope, async (cortex) => {
    const memorySpaceId = scope.memorySpaceId;

    // Delete all conversations for this user
    const result = await cortex.conversations.deleteMany({
      userId,
      memorySpaceId,
    });

    await privateCall("app/chatData:clearAllChats", scope);
    return { deletedCount: result.deleted || 0 };
  }, process.env.CORTEX_GRAPH_SYNC === "true");
}

/**
 * Update chat title by ID.
 * Updates the conversation metadata.title field directly via Convex mutation.
 * Requires userId for authorization - only the conversation owner can update the title.
 */
export async function updateChatTitleById({
  chatId,
  title,
  userId,
}: {
  chatId: string;
  title: string;
  userId: string;
}): Promise<void> {
  const scope = await requireScope(userId);
  await privateCall("app/chatData:setTitle", { ...scope, chatId, title });
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}): Promise<void> {
  const scope = await requireScope();
  await privateCall("app/chatData:setVisibility", {
    ...scope,
    chatId,
    visibility,
  });
}

// ============================================================================
// Message Queries (Cortex Conversations API)
// ============================================================================

export async function getMessagesByChatId({
  id,
}: {
  id: string;
}): Promise<DBMessage[]> {
  const scope = await requireScope();
  const rows = await privateCall<
    Array<Omit<DBMessage, "createdAt"> & { createdAt: number }>
  >("app/chatData:messages", { ...scope, chatId: id });
  return rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt) }));
}

export async function getMessageById({
  id,
}: {
  id: string;
}): Promise<DBMessage[]> {
  const scope = await requireScope();
  const row = await privateCall<
    (Omit<DBMessage, "createdAt"> & { createdAt: number }) | null
  >("app/chatData:message", { ...scope, messageId: id });
  return row ? [{ ...row, createdAt: new Date(row.createdAt) }] : [];
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}): Promise<number> {
  const scope = await requireScope(id);
  if (!Number.isFinite(differenceInHours) || differenceInHours <= 0)
    throw new ChatSDKError("bad_request:chat");
  return privateCall<number>("app/chatData:messageCount", {
    ...scope,
    since: Date.now() - differenceInHours * 3600000,
  });
}

export async function saveMessages({
  messages,
}: {
  messages: Array<{
    id: string;
    chatId: string;
    role: string;
    parts: unknown;
    attachments: unknown[];
    createdAt: Date;
  }>;
}): Promise<void> {
  const scope = await requireScope();
  if (
    messages.some(
      (message) => !["user", "assistant", "system"].includes(message.role)
    )
  )
    throw new ChatSDKError("bad_request:chat");
  await privateCall("app/chatData:saveMessages", {
    ...scope,
    messages: messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.getTime(),
    })),
  });
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: unknown;
}): Promise<void> {
  const scope = await requireScope();
  await privateCall("app/chatData:updateMessage", {
    ...scope,
    messageId: id,
    parts,
  });
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}): Promise<void> {
  const scope = await requireScope();
  if (!Number.isFinite(timestamp.getTime()))
    throw new ChatSDKError("bad_request:chat");
  await privateCall("app/chatData:truncate", {
    ...scope,
    chatId,
    timestamp: timestamp.getTime(),
  });
}

// ============================================================================
// Document Queries (Cortex Artifacts API)
// Documents are stored as Cortex Artifacts with full versioning support.
// ============================================================================

/**
 * Map Chat SDK artifact kinds to Cortex artifact kinds
 */
type CortexArtifactKind =
  | "text"
  | "code"
  | "sheet"
  | "image"
  | "diagram"
  | "html"
  | "custom";

function mapToCortexKind(chatSdkKind: string): CortexArtifactKind {
  mapFromCortexKind(chatSdkKind);
  switch (chatSdkKind) {
    case "text":
      return "text";
    case "code":
      return "code";
    case "sheet":
      return "sheet";
    case "image":
      return "image";
    default:
      return "custom";
  }
}

function mapFromCortexKind(cortexKind: string): Document["kind"] {
  if (
    cortexKind === "text" ||
    cortexKind === "code" ||
    cortexKind === "image" ||
    cortexKind === "sheet"
  ) {
    return cortexKind;
  }
  // The Chat UI has no renderer for other SDK artifact kinds; refuse rather than mislabel them.
  throw new ChatSDKError("bad_request:document", "Unsupported document kind");
}

/**
 * Convert a Cortex Artifact to a Chat SDK Document
 */
function artifactToDocument(artifact: Artifact): Document {
  return {
    id: artifact.artifactId,
    title: artifact.title,
    content: artifact.content ?? null,
    kind: mapFromCortexKind(artifact.kind),
    userId: artifact.userId || "",
    createdAt: new Date(artifact.updatedAt),
    updatedAt: new Date(artifact.updatedAt),
  };
}

/**
 * Convert an Artifact version to a Document (for version history)
 */
function artifactVersionToDocument(
  artifactId: string,
  version: ArtifactVersion,
  userId: string,
  kind: string
): Document {
  return {
    id: artifactId,
    title: version.title || "",
    content: version.content ?? null,
    kind: mapFromCortexKind(kind),
    userId,
    createdAt: new Date(version.timestamp),
    updatedAt: new Date(version.timestamp),
  };
}

async function activeArtifactToDocument(
  cortex: import("@cortexmemory/sdk").Cortex,
  scope: import("@/lib/cortex").AppScope,
  artifact: Artifact
): Promise<Document> {
  assertArtifactOwner(artifact, scope);
  const active = await privateCall<number[] | null>(
    "app/chatData:documentVersions",
    { ...scope, documentId: artifact.artifactId }
  );
  const selected = await privateCall<number | null>(
    "app/chatData:documentSelection",
    { ...scope, documentId: artifact.artifactId }
  );
  const versionNumber = selected ?? active?.at(-1);
  if (versionNumber && versionNumber !== artifact.version) {
    const version = await cortex.artifacts.getVersion(
      artifact.artifactId,
      versionNumber
    );
    if (!version) throw new ChatSDKError("offline:document");
    return artifactVersionToDocument(
      artifact.artifactId,
      version,
      scope.userId,
      artifact.kind
    );
  }
  return artifactToDocument(artifact);
}

export async function getDocumentById({
  id,
}: {
  id: string;
}): Promise<Document | null> {
  const scope = await requireScope();
  return withCortex(scope, async (cortex) => {
    const artifact = await cortex.artifacts.get(id);
    if (artifact) assertArtifactOwner(artifact, scope);
    if (!artifact) {
      return null;
    }

    return activeArtifactToDocument(cortex, scope, artifact);
  });
}

export async function getDocumentsById({
  id,
}: {
  id: string;
}): Promise<Document[]> {
  const scope = await requireScope();
  return withCortex(scope, async (cortex) => {
    // Get the current artifact
    const artifact = await cortex.artifacts.get(id);
    if (artifact) assertArtifactOwner(artifact, scope);
    if (!artifact) {
      return [];
    }

    // Get version history to return all versions as documents
    const history = await cortex.artifacts.getHistory(id, {
      sortOrder: "asc",
    });

    if (!history || history.length === 0) {
      // No version history, return just the current document
      return [artifactToDocument(artifact)];
    }

    // Convert all versions to documents
    const active = await privateCall<number[] | null>(
      "app/chatData:documentVersions",
      { ...scope, documentId: id }
    );
    return history
      .filter((version) => !active || active.includes(version.version))
      .map((version) =>
        artifactVersionToDocument(
          artifact.artifactId,
          version,
          artifact.userId || "",
          artifact.kind
        )
      );
  });
}

export async function saveDocument({
  id,
  content,
  title,
  kind,
  userId,
  conversationId,
  messageId,
}: {
  id: string;
  content: string;
  title: string;
  kind: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
}): Promise<Document> {
  mapFromCortexKind(kind);
  const scope = await requireScope(userId);
  return withCortex(scope, async (cortex) => {
    const memorySpaceId = scope.memorySpaceId;

    if (conversationId) {
      const parent = await cortex.conversations.get(conversationId);
      assertChatOwner(parent, scope);
    }
    if (messageId) {
      if (!conversationId) throw new ChatSDKError("bad_request:document");
      const [message] = await getMessageById({ id: messageId });
      if (!message || message.chatId !== conversationId)
        throw new ChatSDKError("not_found:document");
    }
    // Check if artifact already exists
    const existing = await cortex.artifacts.get(id);

    if (existing) {
      assertArtifactOwner(existing, scope);
      // Read the active view before the version-creating SDK operation.
      const active = await privateCall<number[] | null>(
        "app/chatData:documentVersions",
        { ...scope, documentId: id }
      );
      const selected = active
        ? await privateCall<number | null>("app/chatData:documentSelection", {
            ...scope,
            documentId: id,
          })
        : null;
      // Update existing artifact (creates new version)
      const updated = await cortex.artifacts.update(id, content, {
        title,
        changeSummary: `Updated via Chat SDK`,
      });
      assertArtifactOwner(updated, scope);
      if (active) {
        // SDK update and app view are separate transactions. A failed view commit is
        // a partial save; never resend the version-creating SDK operation implicitly.
        try {
          await privateCall("app/chatData:setDocumentVersions", {
            ...scope,
            documentId: id,
            versions: [
              ...active.slice(
                0,
                selected ? active.indexOf(selected) + 1 : active.length
              ),
              updated.version,
            ],
          });
        } catch {
          throw new ChatSDKError(
            "offline:document",
            "Artifact audit version was saved, but active history update did not finish. Reload before retrying."
          );
        }
      }
      return artifactToDocument(updated);
    }

    // Create new artifact
    const artifact = await cortex.artifacts.create({
      artifactId: id,
      memorySpaceId,
      kind: mapToCortexKind(kind),
      title,
      content,
      userId,
      streamingState: "final",
      // Link to conversation if provided
      conversationRef: conversationId
        ? {
            conversationId,
            messageId,
          }
        : undefined,
    });

    assertArtifactOwner(artifact, scope);
    return artifactToDocument(artifact);
  });
}

/**
 * Save a document with explicit conversation linkage
 */
export async function saveDocumentWithConversation({
  id,
  content,
  title,
  kind,
  userId,
  conversationId,
  messageId,
}: {
  id: string;
  content: string;
  title: string;
  kind: string;
  userId: string;
  conversationId: string;
  messageId?: string;
}): Promise<Document> {
  return saveDocument({
    id,
    content,
    title,
    kind,
    userId,
    conversationId,
    messageId,
  });
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}): Promise<{
  deletedCount: number;
  retiredVersionCount?: number;
  auditHistoryRetained?: true;
}> {
  const scope = await requireScope();
  return withCortex(scope, async (cortex) => {
    // Get the artifact
    const artifact = await cortex.artifacts.get(id);
    if (artifact) assertArtifactOwner(artifact, scope);
    if (!artifact) {
      return { deletedCount: 0 };
    }

    if (!Number.isFinite(timestamp.getTime()))
      throw new ChatSDKError("bad_request:document");
    const history = await cortex.artifacts.getHistory(id, { sortOrder: "asc" });
    const active = await privateCall<number[] | null>(
      "app/chatData:documentVersions",
      { ...scope, documentId: id }
    );
    const visible = history.filter(
      (version) => !active || active.includes(version.version)
    );
    const kept = visible.filter(
      (version) => version.timestamp <= timestamp.getTime()
    );
    if (!kept.length || kept.length === visible.length)
      return { deletedCount: 0 };
    // The active document/history uses these real SDK version numbers. SDK audit
    // bytes and version records are retained; this is logical retirement only.
    await privateCall("app/chatData:setDocumentVersions", {
      ...scope,
      documentId: id,
      versions: kept.map((version) => version.version),
    });
    return {
      deletedCount: visible.length - kept.length,
      retiredVersionCount: visible.length - kept.length,
      auditHistoryRetained: true,
    };
  });
}

/**
 * Get a specific version of a document
 */
export async function getDocumentVersion({
  id,
  version,
}: {
  id: string;
  version: number;
}): Promise<Document | null> {
  const scope = await requireScope();
  return withCortex(scope, async (cortex) => {
    const artifact = await cortex.artifacts.get(id);
    if (artifact) assertArtifactOwner(artifact, scope);
    if (!artifact) {
      return null;
    }

    const active = await privateCall<number[] | null>(
      "app/chatData:documentVersions",
      { ...scope, documentId: id }
    );
    if (
      !Number.isInteger(version) ||
      version < 1 ||
      (active && !active.includes(version))
    )
      return null;
    const versionData = await cortex.artifacts.getVersion(id, version);
    if (!versionData) {
      return null;
    }

    return artifactVersionToDocument(
      artifact.artifactId,
      versionData,
      artifact.userId || "",
      artifact.kind
    );
  });
}

/**
 * Get all documents for a user
 */
export async function getDocumentsByUserId({
  userId,
  limit = 50,
}: {
  userId: string;
  limit?: number;
}): Promise<Document[]> {
  const scope = await requireScope(userId);
  return withCortex(scope, async (cortex) => {
    const memorySpaceId = scope.memorySpaceId;

    const artifacts = await cortex.artifacts.list({
      memorySpaceId,
      userId,
      limit,
      sortBy: "updatedAt",
      sortOrder: "desc",
    });

    artifacts.forEach((artifact) => assertArtifactOwner(artifact, scope));
    return Promise.all(
      artifacts.map((artifact) =>
        activeArtifactToDocument(cortex, scope, artifact)
      )
    );
  });
}

/**
 * Get documents linked to a specific conversation
 */
export async function getDocumentsByConversationId({
  conversationId,
}: {
  conversationId: string;
}): Promise<Document[]> {
  const scope = await requireScope();
  return withCortex(scope, async (cortex) => {
    const parent = await cortex.conversations.get(conversationId);
    assertChatOwner(parent, scope);

    const memorySpaceId = scope.memorySpaceId;

    // List artifacts and filter by conversationRef
    // Note: In a production system, you'd want an index for this query
    const artifacts = await cortex.artifacts.list({
      memorySpaceId,
      userId: scope.userId,
      limit: 100,
    });

    const linkedArtifacts = artifacts.filter(
      (artifact) => artifact.conversationRef?.conversationId === conversationId
    );

    linkedArtifacts.forEach((artifact) => assertArtifactOwner(artifact, scope));
    return Promise.all(
      linkedArtifacts.map((artifact) =>
        activeArtifactToDocument(cortex, scope, artifact)
      )
    );
  });
}

/**
 * Undo the last change to a document
 */
export async function undoDocumentChange({
  id,
}: {
  id: string;
}): Promise<{ success: boolean; version: number }> {
  return selectAdjacentDocumentVersion(id, -1);
}
export async function redoDocumentChange({
  id,
}: {
  id: string;
}): Promise<{ success: boolean; version: number }> {
  return selectAdjacentDocumentVersion(id, 1);
}
async function selectAdjacentDocumentVersion(
  id: string,
  direction: -1 | 1
): Promise<{ success: boolean; version: number }> {
  const scope = await requireScope();
  return withCortex(scope, async (cortex) => {
    const artifact = await cortex.artifacts.get(id);
    assertArtifactOwner(artifact, scope);
    let active = await privateCall<number[] | null>(
      "app/chatData:documentVersions",
      { ...scope, documentId: id }
    );
    const selected = await privateCall<number | null>(
      "app/chatData:documentSelection",
      { ...scope, documentId: id }
    );
    if (!active) {
      active = (
        await cortex.artifacts.getHistory(id, { sortOrder: "asc" })
      ).map((version) => version.version);
      await privateCall("app/chatData:setDocumentVersions", {
        ...scope,
        documentId: id,
        versions: active,
      });
    }
    const current = selected || artifact.version;
    const target = active[active.indexOf(current) + direction];
    if (!target) return { success: false, version: current };
    await privateCall("app/chatData:selectDocumentVersion", {
      ...scope,
      documentId: id,
      version: target,
    });
    return { success: true, version: target };
  });
}

// ============================================================================
// Vote Queries
// Votes are durable private app records.
// ============================================================================

export async function getVotesByChatId({
  id,
}: {
  id: string;
}): Promise<Vote[]> {
  const scope = await requireScope();
  return privateCall<Vote[]>("app/chatData:votes", { ...scope, chatId: id });
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}): Promise<void> {
  const scope = await requireScope();
  if (type !== "up" && type !== "down")
    throw new ChatSDKError("bad_request:vote");
  await privateCall("app/chatData:vote", { ...scope, chatId, messageId, type });
}

// ============================================================================
// Suggestion Queries
// Note: Suggestions are stored separately from conversations
// ============================================================================

// Suggestions are durable private app records.

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}): Promise<Suggestion[]> {
  const scope = await requireScope();
  const rows = await privateCall<
    Array<
      Omit<Suggestion, "createdAt" | "documentCreatedAt"> & {
        createdAt: number;
        documentCreatedAt: number;
      }
    >
  >("app/chatData:suggestions", { ...scope, documentId });
  return rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt),
    documentCreatedAt: new Date(row.documentCreatedAt),
  }));
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}): Promise<void> {
  const scope = await requireScope();
  if (suggestions.some((row) => row.userId !== scope.userId))
    throw new ChatSDKError("forbidden:suggestions");
  await privateCall("app/chatData:saveSuggestions", {
    ...scope,
    suggestions: suggestions.map((row) => ({
      ...row,
      description: row.description || undefined,
      createdAt: row.createdAt.getTime(),
      documentCreatedAt: row.documentCreatedAt.getTime(),
    })),
  });
}

// ============================================================================
// Stream Queries
// Note: Stream tracking for resumable streams
// ============================================================================

// Stream IDs are durable private app records.

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}): Promise<void> {
  const scope = await requireScope();
  await privateCall("app/chatData:recordStream", {
    ...scope,
    streamId,
    chatId,
  });
}

export async function isBranchEdited(chatId: string): Promise<boolean> {
  const scope = await requireScope();
  return privateCall<boolean>("app/chatData:branchEdited", {
    ...scope,
    chatId,
  });
}
export type PublicShare = {
  title: string;
  createdAt: number;
  messages: Array<{ role: "user" | "assistant"; text: string }>;
};
export function getPublicShare(chatId: string): Promise<PublicShare | null> {
  return privateCall("app/chatData:publicShare", { chatId });
}

/** New messages are caller input; regeneration of an existing user turn must match the durable owner record. */
export async function prepareChatMessages({
  chatId,
  message,
  regenerate,
}: {
  chatId: string;
  message: import("@/lib/types").ChatMessage;
  regenerate: boolean;
}): Promise<DBMessage[]> {
  const [existing] = await getMessageById({ id: message.id });
  if (existing) {
    if (
      !regenerate ||
      existing.chatId !== chatId ||
      existing.role !== "user" ||
      JSON.stringify(existing.parts) !== JSON.stringify(message.parts)
    )
      throw new ChatSDKError("bad_request:chat");
    await deleteMessagesByChatIdAfterTimestamp({
      chatId,
      timestamp: existing.createdAt,
    });
  }
  return getMessagesByChatId({ id: chatId });
}
