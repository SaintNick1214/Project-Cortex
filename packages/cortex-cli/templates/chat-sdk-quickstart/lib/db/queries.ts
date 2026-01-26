/**
 * Chat SDK Query Functions
 *
 * These functions implement chat persistence using the Cortex SDK's Conversations API.
 * The Cortex Conversations API provides ACID-compliant, immutable storage for chat history.
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

import type {
  Chat,
  DBMessage,
  Document,
  Suggestion,
  Vote,
} from "@/lib/types";
import { getCortex, getMemorySpaceId, getAgentId } from "@/lib/cortex";
import type {
  Conversation,
  Message as CortexMessage,
  Artifact,
  ArtifactVersion,
} from "@cortexmemory/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// ============================================================================
// Convex Client Helper
// ============================================================================

let convexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    convexClient = new ConvexHttpClient(convexUrl);
  }
  return convexClient;
}

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
    title:
      (conversation.metadata?.title as string) ||
      "New Chat",
    visibility:
      conversation.visibility === "public" ? "public" : "private",
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
  };
}

/**
 * Convert a Cortex Message to a Chat SDK DBMessage
 */
function cortexMessageToDBMessage(
  message: CortexMessage,
  chatId: string
): DBMessage {
  // Map Cortex roles to Chat SDK roles
  const roleMap: Record<string, "user" | "assistant" | "system"> = {
    user: "user",
    agent: "assistant",
    system: "system",
  };

  // Parse content - Cortex stores as string, Chat SDK uses parts
  let parts: unknown;
  try {
    // Check if content is already JSON (for complex parts)
    parts = JSON.parse(message.content);
  } catch {
    // Simple text content - wrap in parts format
    parts = [{ type: "text", text: message.content }];
  }

  return {
    id: message.id,
    chatId,
    role: roleMap[message.role] || "assistant",
    parts,
    attachments: (message.metadata?.attachments as unknown[]) || [],
    createdAt: new Date(message.timestamp),
  };
}

/**
 * Convert Chat SDK message parts to Cortex content string
 */
function partsToContent(parts: unknown): string {
  if (typeof parts === "string") {
    return parts;
  }
  if (Array.isArray(parts)) {
    // Extract text from parts array
    const textParts = parts
      .filter((p: unknown) => {
        if (typeof p === "object" && p !== null && "type" in p) {
          return (p as { type: string }).type === "text";
        }
        return false;
      })
      .map((p: unknown) => {
        if (typeof p === "object" && p !== null && "text" in p) {
          return (p as { text: string }).text;
        }
        return "";
      });
    if (textParts.length > 0) {
      return textParts.join("\n");
    }
    // If no text parts, stringify the whole thing
    return JSON.stringify(parts);
  }
  return JSON.stringify(parts);
}

// ============================================================================
// User Queries
// ============================================================================

export async function getUser(
  email: string
): Promise<Array<{ id: string; email: string; password: string | null }>> {
  // User management is handled by NextAuth, not Cortex
  // This is a placeholder - actual implementation depends on your auth provider
  // For demo purposes, we return empty array (user not found)
  return [];
}

export async function createUser(
  email: string,
  password: string
): Promise<Array<{ id: string; email: string }>> {
  // User management is handled by NextAuth, not Cortex
  // For demo purposes, we generate a user ID
  const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  return [{ id, email }];
}

export async function createGuestUser(): Promise<
  Array<{ id: string; email: string }>
> {
  // Create a guest user with a random ID
  const id = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const email = `guest-${id}@example.com`;
  return [{ id, email }];
}

// ============================================================================
// Chat Queries (Cortex Conversations API)
// ============================================================================

export async function getChatById({
  id,
}: {
  id: string;
}): Promise<Chat | null> {
  const cortex = getCortex();

  const conversation = await cortex.conversations.get(id);
  if (!conversation) {
    return null;
  }

  return conversationToChat(conversation);
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
  const cortex = getCortex();
  const memorySpaceId = getMemorySpaceId();

  // Cortex uses offset-based pagination, convert cursor to offset if needed
  // For now, we'll do a simple list with limit
  const result = await cortex.conversations.list({
    userId: id,
    memorySpaceId,
    limit,
    sortBy: "createdAt",
    sortOrder: "desc",
    includeMessages: false,
  });

  // Filter based on cursor if provided (client-side for now)
  let chats = result.conversations.map(conversationToChat);

  if (endingBefore) {
    const beforeIndex = chats.findIndex((c) => c.id === endingBefore);
    if (beforeIndex > 0) {
      chats = chats.slice(0, beforeIndex);
    }
  }

  if (startingAfter) {
    const afterIndex = chats.findIndex((c) => c.id === startingAfter);
    if (afterIndex >= 0) {
      chats = chats.slice(afterIndex + 1);
    }
  }

  return chats.slice(0, limit);
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
  const cortex = getCortex();
  const memorySpaceId = getMemorySpaceId();
  const agentId = getAgentId();

  // Check if conversation already exists
  const existing = await cortex.conversations.get(id);
  if (existing) {
    // Return existing conversation as Chat
    return conversationToChat(existing);
  }

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

  return conversationToChat(conversation);
}

export async function deleteChatById({ id }: { id: string }): Promise<Chat> {
  const cortex = getCortex();

  // Get the chat first to return it
  const conversation = await cortex.conversations.get(id);
  if (!conversation) {
    throw new Error(`Chat ${id} not found`);
  }

  const chat = conversationToChat(conversation);

  // Delete the conversation
  await cortex.conversations.delete(id);

  return chat;
}

export async function deleteAllChatsByUserId({
  userId,
}: {
  userId: string;
}): Promise<{ deletedCount: number }> {
  const cortex = getCortex();
  const memorySpaceId = getMemorySpaceId();

  // Delete all conversations for this user
  const result = await cortex.conversations.deleteMany({
    userId,
    memorySpaceId,
  });

  return { deletedCount: result.deleted || 0 };
}

/**
 * Update chat title by ID.
 * Updates the conversation metadata.title field directly via Convex mutation.
 */
export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}): Promise<void> {
  const client = getConvexClient();

  // Update the conversation metadata with the new title
  await client.mutation(api.conversations.setMetadata, {
    conversationId: chatId,
    metadata: { title },
  });
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}): Promise<void> {
  const cortex = getCortex();

  // Use the setVisibility API
  await cortex.conversations.setVisibility({
    conversationId: chatId,
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
  const cortex = getCortex();

  // Get conversation with messages
  const conversation = await cortex.conversations.get(id, {
    includeMessages: true,
  });

  if (!conversation || !conversation.messages) {
    return [];
  }

  // Filter out system messages that are metadata updates (e.g., title changes)
  // These are internal bookkeeping messages and should not appear in chat history
  const chatMessages = conversation.messages.filter((msg) => {
    // Keep all non-system messages
    if (msg.role !== "system") return true;
    // Filter out title-update system messages
    const metadata = msg.metadata as { type?: string } | undefined;
    if (metadata?.type === "title-update") return false;
    // Keep other system messages
    return true;
  });

  // Convert Cortex messages to DBMessages
  return chatMessages.map((msg) => cortexMessageToDBMessage(msg, id));
}

export async function getMessageById({
  id,
}: {
  id: string;
}): Promise<DBMessage[]> {
  // This function needs to find a message by its ID across conversations
  // Since Cortex doesn't have a global message search by ID,
  // we'd need to know the conversation ID. For now, return empty.
  // In a real implementation, you'd want to store a message-to-conversation mapping.
  throw new Error("getMessageById requires chatId; use getMessagesByChatId instead");
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}): Promise<number> {
  const cortex = getCortex();
  const memorySpaceId = getMemorySpaceId();

  // Get conversations for this user within the time window
  const since = Date.now() - differenceInHours * 60 * 60 * 1000;

  const result = await cortex.conversations.list({
    userId: id,
    memorySpaceId,
    createdAfter: since,
    includeMessages: true,
  });

  // Count messages across all conversations
  let messageCount = 0;
  for (const conv of result.conversations) {
    // Filter messages within the time window
    const recentMessages = (conv.messages || []).filter(
      (msg) => msg.timestamp >= since
    );
    messageCount += recentMessages.length;
  }

  return messageCount;
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
  const cortex = getCortex();

  // Map Chat SDK roles to Cortex roles
  const roleMap: Record<string, "user" | "agent" | "system"> = {
    user: "user",
    assistant: "agent",
    system: "system",
  };

  // Add messages to conversations
  for (const message of messages) {
    const content = partsToContent(message.parts);
    const cortexRole = roleMap[message.role] || "agent";

    await cortex.conversations.addMessage({
      conversationId: message.chatId,
      message: {
        id: message.id,
        role: cortexRole,
        content,
        metadata: {
          attachments: message.attachments,
          originalParts: message.parts,
        },
      },
    });
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: unknown;
}): Promise<void> {
  // Cortex messages are immutable by design
  // This would require knowing the conversation ID and implementing
  // a message replacement strategy
  throw new Error("Cortex messages are immutable");
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}): Promise<void> {
  // Cortex messages are immutable by design
  // Deletion would require creating a new conversation without the deleted messages
  // For now, this is a no-op with a warning
  throw new Error("Cortex messages are immutable");
}

// ============================================================================
// Document Queries (Cortex Artifacts API)
// Documents are stored as Cortex Artifacts with full versioning support.
// ============================================================================

/**
 * Map Chat SDK artifact kinds to Cortex artifact kinds
 */
type CortexArtifactKind = "text" | "code" | "sheet" | "image" | "diagram" | "html" | "custom";

function mapToCortexKind(chatSdkKind: string): CortexArtifactKind {
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

function mapFromCortexKind(cortexKind: CortexArtifactKind): string {
  // Direct mapping since Chat SDK kinds are a subset of Cortex kinds
  return cortexKind;
}

/**
 * Convert a Cortex Artifact to a Chat SDK Document
 */
function artifactToDocument(artifact: Artifact): Document {
  return {
    id: artifact.artifactId,
    title: artifact.title,
    content: artifact.content || null,
    kind: mapFromCortexKind(artifact.kind),
    userId: artifact.userId || "",
    createdAt: new Date(artifact.createdAt),
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
    content: version.content || null,
    kind,
    userId,
    createdAt: new Date(version.timestamp),
    updatedAt: new Date(version.timestamp),
  };
}

export async function getDocumentById({
  id,
}: {
  id: string;
}): Promise<Document | null> {
  const cortex = getCortex();

  const artifact = await cortex.artifacts.get(id);
  if (!artifact) {
    return null;
  }

  return artifactToDocument(artifact);
}

export async function getDocumentsById({
  id,
}: {
  id: string;
}): Promise<Document[]> {
  const cortex = getCortex();

  // Get the current artifact
  const artifact = await cortex.artifacts.get(id);
  if (!artifact) {
    return [];
  }

  // Get version history to return all versions as documents
  const history = await cortex.artifacts.getHistory(id, {
    sortOrder: "desc",
  });

  if (!history || history.length === 0) {
    // No version history, return just the current document
    return [artifactToDocument(artifact)];
  }

  // Convert all versions to documents
  return history.map((version) =>
    artifactVersionToDocument(
      artifact.artifactId,
      version,
      artifact.userId || "",
      artifact.kind
    )
  );
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
  const cortex = getCortex();
  const memorySpaceId = getMemorySpaceId();

  // Check if artifact already exists
  const existing = await cortex.artifacts.get(id);

  if (existing) {
    // Update existing artifact (creates new version)
    const updated = await cortex.artifacts.update(id, content, {
      title,
      changeSummary: `Updated via Chat SDK`,
    });
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

  return artifactToDocument(artifact);
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
}): Promise<{ deletedCount: number }> {
  const cortex = getCortex();

  // Get the artifact
  const artifact = await cortex.artifacts.get(id);
  if (!artifact) {
    return { deletedCount: 0 };
  }

  // Check if the artifact was created after the timestamp
  if (artifact.createdAt >= timestamp.getTime()) {
    // Delete the entire artifact
    await cortex.artifacts.delete(id, true);
    return { deletedCount: 1 };
  }

  // For partial deletion (versions after timestamp), we use undo to restore
  // to a previous version. Get the version history to find the right version.
  const history = await cortex.artifacts.getHistory(id, {
    sortOrder: "asc",
  });

  if (!history || history.length <= 1) {
    return { deletedCount: 0 };
  }

  // Find the last version before the timestamp
  let targetVersion: number | null = null;
  let deletedCount = 0;
  for (const version of history) {
    if (version.timestamp < timestamp.getTime()) {
      targetVersion = version.version;
    } else {
      deletedCount++;
    }
  }

  if (targetVersion === null || deletedCount === 0) {
    return { deletedCount: 0 };
  }

  // Undo to restore to the target version
  // Note: This uses repeated undo calls to get back to the target version
  const currentVersion = artifact.version;
  const undoCount = currentVersion - targetVersion;

  for (let i = 0; i < undoCount; i++) {
    await cortex.artifacts.undo(id);
  }

  return { deletedCount };
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
  const cortex = getCortex();

  const artifact = await cortex.artifacts.get(id);
  if (!artifact) {
    return null;
  }

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
  const cortex = getCortex();
  const memorySpaceId = getMemorySpaceId();

  const artifacts = await cortex.artifacts.list({
    memorySpaceId,
    userId,
    limit,
    sortBy: "updatedAt",
    sortOrder: "desc",
  });

  return artifacts.map(artifactToDocument);
}

/**
 * Get documents linked to a specific conversation
 */
export async function getDocumentsByConversationId({
  conversationId,
}: {
  conversationId: string;
}): Promise<Document[]> {
  const cortex = getCortex();
  const memorySpaceId = getMemorySpaceId();

  // List artifacts and filter by conversationRef
  // Note: In a production system, you'd want an index for this query
  const artifacts = await cortex.artifacts.list({
    memorySpaceId,
    limit: 100,
  });

  const linkedArtifacts = artifacts.filter(
    (artifact) => artifact.conversationRef?.conversationId === conversationId
  );

  return linkedArtifacts.map(artifactToDocument);
}

/**
 * Undo the last change to a document
 */
export async function undoDocumentChange({
  id,
}: {
  id: string;
}): Promise<{ success: boolean; version: number }> {
  const cortex = getCortex();

  try {
    const result = await cortex.artifacts.undo(id);
    return {
      success: result.success,
      version: result.currentVersion,
    };
  } catch {
    return { success: false, version: 0 };
  }
}

/**
 * Redo a previously undone change to a document
 */
export async function redoDocumentChange({
  id,
}: {
  id: string;
}): Promise<{ success: boolean; version: number }> {
  const cortex = getCortex();

  try {
    const result = await cortex.artifacts.redo(id);
    return {
      success: result.success,
      version: result.currentVersion,
    };
  } catch {
    return { success: false, version: 0 };
  }
}

// ============================================================================
// Vote Queries
// Note: Votes are stored in conversation message metadata
// ============================================================================

// In-memory vote storage (replace with conversation metadata in production)
const voteStore = new Map<string, Vote[]>();

export async function getVotesByChatId({
  id,
}: {
  id: string;
}): Promise<Vote[]> {
  return voteStore.get(id) || [];
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
  const votes = voteStore.get(chatId) || [];
  const existingIndex = votes.findIndex((v) => v.messageId === messageId);

  const vote: Vote = {
    chatId,
    messageId,
    isUpvoted: type === "up",
  };

  if (existingIndex >= 0) {
    votes[existingIndex] = vote;
  } else {
    votes.push(vote);
  }

  voteStore.set(chatId, votes);
}

// ============================================================================
// Suggestion Queries
// Note: Suggestions are stored separately from conversations
// ============================================================================

// In-memory suggestion storage
const suggestionStore = new Map<string, Suggestion[]>();

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}): Promise<Suggestion[]> {
  return suggestionStore.get(documentId) || [];
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}): Promise<void> {
  for (const suggestion of suggestions) {
    const existing = suggestionStore.get(suggestion.documentId) || [];
    existing.push(suggestion);
    suggestionStore.set(suggestion.documentId, existing);
  }
}

// ============================================================================
// Stream Queries
// Note: Stream tracking for resumable streams
// ============================================================================

// In-memory stream storage
const streamStore = new Map<string, string>();

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}): Promise<void> {
  streamStore.set(streamId, chatId);
}
