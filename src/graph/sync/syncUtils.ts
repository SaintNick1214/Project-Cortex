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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Belief Revision - Fact Supersession
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Sync fact supersession to graph database
 *
 * Creates a SUPERSEDES relationship from new fact to old fact.
 * Also marks the old fact as superseded.
 *
 * @param oldFact - The fact being superseded
 * @param newFact - The fact that supersedes
 * @param adapter - Graph adapter
 * @param reason - Optional reason for supersession
 */
export async function syncFactSupersession(
  oldFact: FactRecord,
  newFact: FactRecord,
  adapter: GraphAdapter,
  reason?: string,
): Promise<{ oldNodeId: string; newNodeId: string; relationshipId: string }> {
  // Ensure both facts exist in graph
  const oldNodeId = await syncFactToGraph(
    { ...oldFact, supersededBy: newFact.factId },
    adapter,
  );
  const newNodeId = await syncFactToGraph(
    { ...newFact, supersedes: oldFact.factId },
    adapter,
  );

  // Create SUPERSEDES relationship
  const relationshipId = await adapter.createEdge({
    from: newNodeId,
    to: oldNodeId,
    type: "SUPERSEDES",
    properties: {
      reason: reason || null,
      timestamp: Date.now(),
    },
  });

  // Mark old fact as inactive/superseded in graph
  await updateFactGraphStatus(oldFact.factId, "superseded", adapter);

  return { oldNodeId, newNodeId, relationshipId };
}

/**
 * Update fact status in graph database
 *
 * Updates the status property of a Fact node to reflect
 * its current state (active, superseded, deleted).
 */
export async function updateFactGraphStatus(
  factId: string,
  status: "active" | "superseded" | "deleted",
  adapter: GraphAdapter,
): Promise<void> {
  // Find the fact node
  const nodeId = await findGraphNodeId("Fact", factId, adapter);

  if (nodeId) {
    // Update the node properties
    await adapter.mergeNode(
      {
        label: "Fact",
        properties: {
          factId,
          status,
          statusUpdatedAt: Date.now(),
        },
      },
      { factId },
    );
  }
}

/**
 * Sync fact update in place to graph database
 *
 * Updates an existing Fact node with new content.
 * Used for UPDATE action in belief revision.
 */
export async function syncFactUpdateInPlace(
  fact: FactRecord,
  adapter: GraphAdapter,
): Promise<string> {
  return await adapter.mergeNode(
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
        status: "active",
        updatedAt: fact.updatedAt,
      },
    },
    { factId: fact.factId },
  );
}

/**
 * Create a REVISED_FROM relationship between facts
 *
 * Used when a fact is updated (refined) rather than superseded.
 * The relationship shows evolution without invalidation.
 */
export async function syncFactRevision(
  originalFact: FactRecord,
  revisedFact: FactRecord,
  adapter: GraphAdapter,
  reason?: string,
): Promise<{ originalNodeId: string; revisedNodeId: string; relationshipId: string }> {
  // Ensure both facts exist in graph
  const originalNodeId = await syncFactToGraph(originalFact, adapter);
  const revisedNodeId = await syncFactToGraph(revisedFact, adapter);

  // Create REVISED_FROM relationship
  const relationshipId = await adapter.createEdge({
    from: revisedNodeId,
    to: originalNodeId,
    type: "REVISED_FROM",
    properties: {
      reason: reason || "Content refinement",
      timestamp: Date.now(),
    },
  });

  return { originalNodeId, revisedNodeId, relationshipId };
}

/**
 * Get the supersession chain for a fact in the graph
 *
 * Returns all facts in the chain, from oldest to newest.
 */
export async function getFactSupersessionChainFromGraph(
  factId: string,
  adapter: GraphAdapter,
): Promise<Array<{ factId: string; fact: string; supersededAt?: number }>> {
  // Find all facts connected by SUPERSEDES relationships
  const cypherQuery = `
    MATCH path = (start:Fact)-[:SUPERSEDES*]->(end:Fact)
    WHERE start.factId = $factId OR end.factId = $factId
    WITH DISTINCT nodes(path) as chain
    UNWIND chain as node
    RETURN DISTINCT node.factId as factId, node.fact as fact, node.statusUpdatedAt as supersededAt
    ORDER BY node.createdAt ASC
  `;

  try {
    const result = await adapter.query(cypherQuery, { factId });
    return result.records as Array<{ factId: string; fact: string; supersededAt?: number }>;
  } catch {
    // Fallback if query fails - return just the current fact
    const node = await findGraphNodeId("Fact", factId, adapter);
    if (node) {
      return [{ factId, fact: "(unable to retrieve fact content)" }];
    }
    return [];
  }
}

/**
 * Remove supersession relationships for a fact
 *
 * Used when "undoing" a supersession or during fact deletion.
 */
export async function removeFactSupersessionRelationships(
  factId: string,
  adapter: GraphAdapter,
): Promise<number> {
  // Find and delete relationships
  const cypherQuery = `
    MATCH (f:Fact {factId: $factId})-[r:SUPERSEDES]-()
    DELETE r
    RETURN count(r) as deleted
  `;

  try {
    const result = await adapter.query(cypherQuery, { factId });
    return (result.records as Array<{ deleted: number }>)[0]?.deleted ?? 0;
  } catch {
    // If adapter doesn't support query, return 0
    return 0;
  }
}
