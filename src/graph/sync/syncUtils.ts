/**
 * Graph Sync Utilities
 *
 * Functions for syncing Cortex entities to graph database
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
 * Creates a Context node with properties
 */
export async function syncContextToGraph(
  context: Context,
  adapter: GraphAdapter,
): Promise<string> {
  // Create Context node
  const nodeId = await adapter.createNode({
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
  });

  return nodeId;
}

/**
 * Sync a Conversation to graph database
 *
 * Creates a Conversation node with properties
 */
export async function syncConversationToGraph(
  conversation: Conversation,
  adapter: GraphAdapter,
): Promise<string> {
  // Create Conversation node
  const nodeId = await adapter.createNode({
    label: "Conversation",
    properties: {
      conversationId: conversation.conversationId,
      memorySpaceId: conversation.memorySpaceId,
      participantId: conversation.participantId || null,
      type: conversation.type,
      userId: conversation.participants.userId || null,
      messageCount: conversation.messageCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    },
  });

  return nodeId;
}

/**
 * Sync a Memory to graph database
 *
 * Creates a Memory node with truncated content (graph DBs aren't for full-text storage)
 */
export async function syncMemoryToGraph(
  memory: MemoryEntry,
  adapter: GraphAdapter,
): Promise<string> {
  // Create Memory node (truncate content for graph)
  const nodeId = await adapter.createNode({
    label: "Memory",
    properties: {
      memoryId: memory.memoryId,
      memorySpaceId: memory.memorySpaceId,
      participantId: memory.participantId || null,
      userId: memory.userId || null,
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
  });

  return nodeId;
}

/**
 * Sync a Fact to graph database
 *
 * Creates a Fact node and optionally creates Entity nodes and relationships
 */
export async function syncFactToGraph(
  fact: FactRecord,
  adapter: GraphAdapter,
): Promise<string> {
  // Create Fact node
  const nodeId = await adapter.createNode({
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
  });

  return nodeId;
}

/**
 * Sync a MemorySpace to graph database
 *
 * Creates a MemorySpace node
 */
export async function syncMemorySpaceToGraph(
  memorySpace: MemorySpace,
  adapter: GraphAdapter,
): Promise<string> {
  // Create MemorySpace node
  const nodeId = await adapter.createNode({
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
  });

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
 * Create or get a User node
 *
 * Helper for ensuring User nodes exist before creating relationships
 */
export async function ensureUserNode(
  userId: string,
  adapter: GraphAdapter,
): Promise<string> {
  // Try to find existing node
  const existingId = await findGraphNodeId("User", userId, adapter);
  if (existingId) {
    return existingId;
  }

  // Create new User node
  return await adapter.createNode({
    label: "User",
    properties: {
      userId,
      createdAt: Date.now(),
    },
  });
}

/**
 * Create or get a Participant node
 *
 * Helper for ensuring Participant nodes exist for Hive Mode
 */
export async function ensureParticipantNode(
  participantId: string,
  adapter: GraphAdapter,
): Promise<string> {
  // Try to find existing node
  const existingId = await findGraphNodeId(
    "Participant",
    participantId,
    adapter,
  );
  if (existingId) {
    return existingId;
  }

  // Create new Participant node
  return await adapter.createNode({
    label: "Participant",
    properties: {
      participantId,
      createdAt: Date.now(),
    },
  });
}

/**
 * Create or get an Entity node
 *
 * Helper for fact entity relationships
 * Uses findNodes + createNode pattern with error handling
 */
export async function ensureEntityNode(
  entityName: string,
  entityType: string,
  adapter: GraphAdapter,
): Promise<string> {
  // Try to find existing node by name
  const nodes = await adapter.findNodes("Entity", { name: entityName }, 1);

  if (nodes.length > 0) {
    return nodes[0].id!;
  }

  // Create new Entity node if not found
  try {
    return await adapter.createNode({
      label: "Entity",
      properties: {
        name: entityName,
        type: entityType,
        createdAt: Date.now(),
      },
    });
  } catch (error) {
    // If creation failed due to constraint (race condition), try finding again
    const retryNodes = await adapter.findNodes(
      "Entity",
      { name: entityName },
      1,
    );
    if (retryNodes.length > 0) {
      return retryNodes[0].id!;
    }
    throw error;
  }
}

/**
 * Create or get an enriched Entity node (for bullet-proof fact retrieval)
 *
 * Creates Entity nodes with additional metadata from enriched extraction:
 * - entityType: Specific type (e.g., "preferred_name", "full_name", "company")
 * - fullValue: Full value if available (e.g., "Alexander Johnson" for "Alex")
 *
 * Uses findNodes + createNode pattern with update for existing nodes
 */
export async function ensureEnrichedEntityNode(
  entityName: string,
  entityType: string,
  fullValue: string | undefined,
  adapter: GraphAdapter,
): Promise<string> {
  // Try to find existing node by name
  const nodes = await adapter.findNodes("Entity", { name: entityName }, 1);

  if (nodes.length > 0) {
    const existingNode = nodes[0];

    // Update node if we have enriched data that wasn't there before
    if (fullValue && existingNode.properties.fullValue !== fullValue) {
      await adapter.updateNode(existingNode.id!, {
        fullValue,
        entityType, // Update type if we have more specific info
        updatedAt: Date.now(),
      });
    }

    return existingNode.id!;
  }

  // Create new enriched Entity node if not found
  try {
    return await adapter.createNode({
      label: "Entity",
      properties: {
        name: entityName,
        type: entityType,
        entityType, // Specific entity type (e.g., "preferred_name")
        fullValue: fullValue || null, // Full value if available
        createdAt: Date.now(),
      },
    });
  } catch (error) {
    // If creation failed due to constraint (race condition), try finding again
    const retryNodes = await adapter.findNodes(
      "Entity",
      { name: entityName },
      1,
    );
    if (retryNodes.length > 0) {
      return retryNodes[0].id!;
    }
    throw error;
  }
}
