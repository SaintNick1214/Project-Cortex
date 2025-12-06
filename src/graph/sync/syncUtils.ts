/**
 * Graph Sync Utilities
 *
 * Functions for syncing Cortex entities to graph database.
 * All sync operations use MERGE semantics for idempotency.
 */

import type { GraphAdapter } from "../types";
import type { Context } from "../../contexts";
import type {
  Conversation,
  MemoryEntry,
  FactRecord,
  MemorySpace,
} from "../../types";

/**
 * Sync a Context to graph database
 *
 * Creates or updates a Context node with properties.
 * Uses MERGE for idempotent operations.
 */
export async function syncContextToGraph(
  context: Context,
  adapter: GraphAdapter,
): Promise<string> {
  const nodeId = await adapter.mergeNode(
    {
      label: "Context",
      properties: {
        contextId: context.contextId,
        memorySpaceId: context.memorySpaceId,
        purpose: context.purpose,
        status: context.status,
        depth: context.depth,
        userId: context.userId || null,
        parentId: context.parentId || null,
        rootId: context.rootId || null,
        participants: context.participants,
        createdAt: context.createdAt,
        updatedAt: context.updatedAt,
        completedAt: context.completedAt || null,
      },
    },
    { contextId: context.contextId },
  );

  return nodeId;
}

/**
 * Sync a Conversation to graph database
 *
 * Creates or updates a Conversation node with properties.
 * Uses MERGE for idempotent operations.
 */
export async function syncConversationToGraph(
  conversation: Conversation,
  adapter: GraphAdapter,
): Promise<string> {
  const nodeId = await adapter.mergeNode(
    {
      label: "Conversation",
      properties: {
        conversationId: conversation.conversationId,
        memorySpaceId: conversation.memorySpaceId,
        participantId: conversation.participantId || null,
        type: conversation.type,
        userId: conversation.participants.userId || null,
        agentId: conversation.participants.agentId || null,
        messageCount: conversation.messageCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    },
    { conversationId: conversation.conversationId },
  );

  return nodeId;
}

/**
 * Sync a Memory to graph database
 *
 * Creates or updates a Memory node with truncated content.
 * Uses MERGE for idempotent operations.
 */
export async function syncMemoryToGraph(
  memory: MemoryEntry,
  adapter: GraphAdapter,
): Promise<string> {
  const nodeId = await adapter.mergeNode(
    {
      label: "Memory",
      properties: {
        memoryId: memory.memoryId,
        memorySpaceId: memory.memorySpaceId,
        participantId: memory.participantId || null,
        userId: memory.userId || null,
        agentId: memory.agentId || null,
        content: memory.content.substring(0, 200), // Truncate for graph
        contentType: memory.contentType,
        sourceType: memory.sourceType,
        sourceUserId: memory.sourceUserId || null,
        importance: memory.importance,
        tags: memory.tags,
        version: memory.version,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      },
    },
    { memoryId: memory.memoryId },
  );

  return nodeId;
}

/**
 * Sync a Fact to graph database
 *
 * Creates or updates a Fact node.
 * Uses MERGE for idempotent operations.
 */
export async function syncFactToGraph(
  fact: FactRecord,
  adapter: GraphAdapter,
): Promise<string> {
  const nodeId = await adapter.mergeNode(
    {
      label: "Fact",
      properties: {
        factId: fact.factId,
        memorySpaceId: fact.memorySpaceId,
        participantId: fact.participantId || null,
        fact: fact.fact,
        factType: fact.factType,
        subject: fact.subject || null,
        predicate: fact.predicate || null,
        object: fact.object || null,
        confidence: fact.confidence,
        sourceType: fact.sourceType,
        tags: fact.tags,
        version: fact.version,
        supersededBy: fact.supersededBy || null,
        supersedes: fact.supersedes || null,
        createdAt: fact.createdAt,
        updatedAt: fact.updatedAt,
      },
    },
    { factId: fact.factId },
  );

  return nodeId;
}

/**
 * Sync a MemorySpace to graph database
 *
 * Creates or updates a MemorySpace node.
 * Uses MERGE for idempotent operations.
 */
export async function syncMemorySpaceToGraph(
  memorySpace: MemorySpace,
  adapter: GraphAdapter,
): Promise<string> {
  const nodeId = await adapter.mergeNode(
    {
      label: "MemorySpace",
      properties: {
        memorySpaceId: memorySpace.memorySpaceId,
        name: memorySpace.name || null,
        type: memorySpace.type,
        status: memorySpace.status,
        participantCount: memorySpace.participants.length,
        createdAt: memorySpace.createdAt,
        updatedAt: memorySpace.updatedAt,
      },
    },
    { memorySpaceId: memorySpace.memorySpaceId },
  );

  return nodeId;
}

/**
 * Find a graph node ID by Cortex entity ID
 *
 * Helper function to look up nodes created from Cortex entities
 */
export async function findGraphNodeId(
  label: string,
  cortexId: string,
  adapter: GraphAdapter,
): Promise<string | null> {
  // Determine property name based on label
  let propertyName: string;
  switch (label) {
    case "Context":
      propertyName = "contextId";
      break;
    case "Conversation":
      propertyName = "conversationId";
      break;
    case "Memory":
      propertyName = "memoryId";
      break;
    case "Fact":
      propertyName = "factId";
      break;
    case "MemorySpace":
      propertyName = "memorySpaceId";
      break;
    case "User":
      propertyName = "userId";
      break;
    case "Agent":
      propertyName = "agentId";
      break;
    case "Participant":
      propertyName = "participantId";
      break;
    default:
      throw new Error(`Unknown label: ${label}`);
  }

  // Find node by property
  const nodes = await adapter.findNodes(label, { [propertyName]: cortexId }, 1);

  return nodes.length > 0 ? nodes[0].id! : null;
}

/**
 * Ensure a User node exists in the graph
 *
 * Uses MERGE for idempotent creation.
 */
export async function ensureUserNode(
  userId: string,
  adapter: GraphAdapter,
): Promise<string> {
  return await adapter.mergeNode(
    {
      label: "User",
      properties: {
        userId,
        createdAt: Date.now(),
      },
    },
    { userId },
  );
}

/**
 * Ensure an Agent node exists in the graph
 *
 * Uses MERGE for idempotent creation.
 */
export async function ensureAgentNode(
  agentId: string,
  adapter: GraphAdapter,
): Promise<string> {
  return await adapter.mergeNode(
    {
      label: "Agent",
      properties: {
        agentId,
        createdAt: Date.now(),
      },
    },
    { agentId },
  );
}

/**
 * Ensure a Participant node exists in the graph (Hive Mode)
 *
 * Uses MERGE for idempotent creation.
 */
export async function ensureParticipantNode(
  participantId: string,
  adapter: GraphAdapter,
): Promise<string> {
  return await adapter.mergeNode(
    {
      label: "Participant",
      properties: {
        participantId,
        createdAt: Date.now(),
      },
    },
    { participantId },
  );
}

/**
 * Ensure an Entity node exists in the graph
 *
 * Helper for fact entity relationships.
 * Uses MERGE for idempotent creation.
 */
export async function ensureEntityNode(
  entityName: string,
  entityType: string,
  adapter: GraphAdapter,
): Promise<string> {
  return await adapter.mergeNode(
    {
      label: "Entity",
      properties: {
        name: entityName,
        type: entityType,
        createdAt: Date.now(),
      },
    },
    { name: entityName },
  );
}

/**
 * Ensure an enriched Entity node exists in the graph
 *
 * Creates Entity nodes with additional metadata from enriched extraction:
 * - entityType: Specific type (e.g., "preferred_name", "full_name", "company")
 * - fullValue: Full value if available (e.g., "Alexander Johnson" for "Alex")
 *
 * Uses MERGE for idempotent creation with property updates.
 */
export async function ensureEnrichedEntityNode(
  entityName: string,
  entityType: string,
  fullValue: string | undefined,
  adapter: GraphAdapter,
): Promise<string> {
  return await adapter.mergeNode(
    {
      label: "Entity",
      properties: {
        name: entityName,
        type: entityType,
        entityType, // Specific entity type (e.g., "preferred_name")
        fullValue: fullValue || null, // Full value if available
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
    { name: entityName },
  );
}

