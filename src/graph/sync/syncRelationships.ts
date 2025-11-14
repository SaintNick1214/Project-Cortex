/**
 * Graph Sync Relationships
 *
 * Functions for syncing relationships between Cortex entities in graph database
 */

import type { GraphAdapter } from "../types";
import type { Context } from "../../contexts";
import type { Conversation, MemoryEntry, FactRecord } from "../../types";
import {
  findGraphNodeId,
  ensureUserNode,
  ensureParticipantNode,
  ensureEntityNode,
} from "./syncUtils";

/**
 * Sync Context relationships
 *
 * Creates:
 * - PARENT_OF / CHILD_OF relationships
 * - INVOLVES relationships to User
 * - IN_SPACE relationships to MemorySpace
 * - TRIGGERED_BY relationships to Conversation (if conversationRef exists)
 */
export async function syncContextRelationships(
  context: Context,
  contextNodeId: string,
  adapter: GraphAdapter,
): Promise<void> {
  // Parent-child relationships
  if (context.parentId) {
    const parentNodeId = await findGraphNodeId(
      "Context",
      context.parentId,
      adapter,
    );

    if (parentNodeId) {
      // Create CHILD_OF relationship
      await adapter.createEdge({
        type: "CHILD_OF",
        from: contextNodeId,
        to: parentNodeId,
        properties: {
          depth: context.depth,
          createdAt: context.createdAt,
        },
      });
    }
  }

  // User relationship
  if (context.userId) {
    const userNodeId = await ensureUserNode(context.userId, adapter);

    await adapter.createEdge({
      type: "INVOLVES",
      from: contextNodeId,
      to: userNodeId,
      properties: {
        createdAt: context.createdAt,
      },
    });
  }

  // MemorySpace relationship
  const memorySpaceNodeId = await findGraphNodeId(
    "MemorySpace",
    context.memorySpaceId,
    adapter,
  );

  if (memorySpaceNodeId) {
    await adapter.createEdge({
      type: "IN_SPACE",
      from: contextNodeId,
      to: memorySpaceNodeId,
      properties: {
        createdAt: context.createdAt,
      },
    });
  }

  // Conversation relationship
  if (context.conversationRef) {
    const conversationNodeId = await findGraphNodeId(
      "Conversation",
      context.conversationRef.conversationId,
      adapter,
    );

    if (conversationNodeId) {
      await adapter.createEdge({
        type: "TRIGGERED_BY",
        from: contextNodeId,
        to: conversationNodeId,
        properties: {
          messageIds: context.conversationRef.messageIds || [],
          createdAt: context.createdAt,
        },
      });
    }
  }

  // Grant access relationships (Collaboration Mode)
  if (context.grantedAccess) {
    for (const grant of context.grantedAccess) {
      const grantedMemorySpaceNodeId = await findGraphNodeId(
        "MemorySpace",
        grant.memorySpaceId,
        adapter,
      );

      if (grantedMemorySpaceNodeId) {
        await adapter.createEdge({
          type: "GRANTS_ACCESS_TO",
          from: contextNodeId,
          to: grantedMemorySpaceNodeId,
          properties: {
            scope: grant.scope,
            grantedAt: grant.grantedAt,
          },
        });
      }
    }
  }
}

/**
 * Sync Conversation relationships
 *
 * Creates:
 * - IN_SPACE relationships to MemorySpace
 * - INVOLVES relationships to User (if userId exists)
 * - PARTICIPANT relationships to Participant (Hive Mode)
 */
export async function syncConversationRelationships(
  conversation: Conversation,
  conversationNodeId: string,
  adapter: GraphAdapter,
): Promise<void> {
  // MemorySpace relationship
  const memorySpaceNodeId = await findGraphNodeId(
    "MemorySpace",
    conversation.memorySpaceId,
    adapter,
  );

  if (memorySpaceNodeId) {
    await adapter.createEdge({
      type: "IN_SPACE",
      from: conversationNodeId,
      to: memorySpaceNodeId,
      properties: {
        createdAt: conversation.createdAt,
      },
    });
  }

  // User relationship
  if (conversation.participants.userId) {
    const userNodeId = await ensureUserNode(
      conversation.participants.userId,
      adapter,
    );

    await adapter.createEdge({
      type: "INVOLVES",
      from: conversationNodeId,
      to: userNodeId,
      properties: {
        createdAt: conversation.createdAt,
      },
    });
  }

  // Participant relationship (Hive Mode)
  if (conversation.participantId) {
    const participantNodeId = await ensureParticipantNode(
      conversation.participantId,
      adapter,
    );

    await adapter.createEdge({
      type: "HAS_PARTICIPANT",
      from: conversationNodeId,
      to: participantNodeId,
      properties: {
        createdAt: conversation.createdAt,
      },
    });
  }
}

/**
 * Sync Memory relationships
 *
 * Creates:
 * - REFERENCES relationships to Conversation (if conversationRef exists)
 * - RELATES_TO relationships to User (if userId exists)
 * - IN_SPACE relationships to MemorySpace
 * - SOURCED_FROM relationships to Fact (if immutableRef exists)
 * - PART_OF relationships to Context (if contextId in metadata)
 * - HAS_PARTICIPANT relationships (Hive Mode)
 */
export async function syncMemoryRelationships(
  memory: MemoryEntry,
  memoryNodeId: string,
  adapter: GraphAdapter,
): Promise<void> {
  // conversationRef → REFERENCES edge
  if (memory.conversationRef) {
    const conversationNodeId = await findGraphNodeId(
      "Conversation",
      memory.conversationRef.conversationId,
      adapter,
    );

    if (conversationNodeId) {
      await adapter.createEdge({
        type: "REFERENCES",
        from: memoryNodeId,
        to: conversationNodeId,
        properties: {
          messageIds: memory.conversationRef.messageIds,
          createdAt: memory.createdAt,
        },
      });
    }
  }

  // userId → RELATES_TO edge
  if (memory.userId) {
    const userNodeId = await ensureUserNode(memory.userId, adapter);

    await adapter.createEdge({
      type: "RELATES_TO",
      from: memoryNodeId,
      to: userNodeId,
      properties: {
        createdAt: memory.createdAt,
      },
    });
  }

  // MemorySpace → IN_SPACE edge
  const memorySpaceNodeId = await findGraphNodeId(
    "MemorySpace",
    memory.memorySpaceId,
    adapter,
  );

  if (memorySpaceNodeId) {
    await adapter.createEdge({
      type: "IN_SPACE",
      from: memoryNodeId,
      to: memorySpaceNodeId,
      properties: {
        createdAt: memory.createdAt,
      },
    });
  }

  // immutableRef (Fact) → SOURCED_FROM edge
  if (memory.immutableRef && memory.immutableRef.type === "fact") {
    const factNodeId = await findGraphNodeId(
      "Fact",
      memory.immutableRef.id,
      adapter,
    );

    if (factNodeId) {
      await adapter.createEdge({
        type: "SOURCED_FROM",
        from: memoryNodeId,
        to: factNodeId,
        properties: {
          version: memory.immutableRef.version,
          createdAt: memory.createdAt,
        },
      });
    }
  }

  // Participant relationship (Hive Mode)
  if (memory.participantId) {
    const participantNodeId = await ensureParticipantNode(
      memory.participantId,
      adapter,
    );

    await adapter.createEdge({
      type: "STORED_BY",
      from: memoryNodeId,
      to: participantNodeId,
      properties: {
        createdAt: memory.createdAt,
      },
    });
  }
}

/**
 * Sync Fact relationships
 *
 * Creates:
 * - MENTIONS relationships to Entity nodes (for subject, object)
 * - EXTRACTED_FROM relationships to Conversation (if sourceRef exists)
 * - IN_SPACE relationships to MemorySpace
 * - SUPERSEDES / SUPERSEDED_BY relationships (fact versioning)
 * - EXTRACTED_BY relationships to Participant (Hive Mode)
 */
export async function syncFactRelationships(
  fact: FactRecord,
  factNodeId: string,
  adapter: GraphAdapter,
): Promise<void> {
  // Create Entity nodes and MENTIONS relationships
  if (fact.subject) {
    const subjectNodeId = await ensureEntityNode(
      fact.subject,
      "subject",
      adapter,
    );

    await adapter.createEdge({
      type: "MENTIONS",
      from: factNodeId,
      to: subjectNodeId,
      properties: {
        role: "subject",
        createdAt: fact.createdAt,
      },
    });
  }

  if (fact.object) {
    const objectNodeId = await ensureEntityNode(fact.object, "object", adapter);

    await adapter.createEdge({
      type: "MENTIONS",
      from: factNodeId,
      to: objectNodeId,
      properties: {
        role: "object",
        createdAt: fact.createdAt,
      },
    });
  }

  // If we have a predicate, create a typed relationship between subject and object
  if (fact.subject && fact.object && fact.predicate) {
    // Find entity nodes by name (entities use name as unique identifier)
    const subjectNodes = await adapter.findNodes(
      "Entity",
      { name: fact.subject },
      1,
    );
    const objectNodes = await adapter.findNodes(
      "Entity",
      { name: fact.object },
      1,
    );

    if (subjectNodes.length > 0 && objectNodes.length > 0) {
      // Create relationship with predicate as type (e.g., WORKS_AT, KNOWS)
      const relationshipType = fact.predicate
        .toUpperCase()
        .replace(/\s+/g, "_");

      await adapter.createEdge({
        type: relationshipType,
        from: subjectNodes[0].id!,
        to: objectNodes[0].id!,
        properties: {
          factId: fact.factId,
          confidence: fact.confidence,
          createdAt: fact.createdAt,
        },
      });
    }
  }

  // sourceRef → EXTRACTED_FROM edge
  if (fact.sourceRef?.conversationId) {
    const conversationNodeId = await findGraphNodeId(
      "Conversation",
      fact.sourceRef.conversationId,
      adapter,
    );

    if (conversationNodeId) {
      await adapter.createEdge({
        type: "EXTRACTED_FROM",
        from: factNodeId,
        to: conversationNodeId,
        properties: {
          messageIds: fact.sourceRef.messageIds || [],
          createdAt: fact.createdAt,
        },
      });
    }
  }

  // MemorySpace → IN_SPACE edge
  const memorySpaceNodeId = await findGraphNodeId(
    "MemorySpace",
    fact.memorySpaceId,
    adapter,
  );

  if (memorySpaceNodeId) {
    await adapter.createEdge({
      type: "IN_SPACE",
      from: factNodeId,
      to: memorySpaceNodeId,
      properties: {
        createdAt: fact.createdAt,
      },
    });
  }

  // Fact versioning relationships
  if (fact.supersedes) {
    const supersededFactNodeId = await findGraphNodeId(
      "Fact",
      fact.supersedes,
      adapter,
    );

    if (supersededFactNodeId) {
      await adapter.createEdge({
        type: "SUPERSEDES",
        from: factNodeId,
        to: supersededFactNodeId,
        properties: {
          version: fact.version,
          createdAt: fact.createdAt,
        },
      });
    }
  }

  // Participant relationship (Hive Mode)
  if (fact.participantId) {
    const participantNodeId = await ensureParticipantNode(
      fact.participantId,
      adapter,
    );

    await adapter.createEdge({
      type: "EXTRACTED_BY",
      from: factNodeId,
      to: participantNodeId,
      properties: {
        createdAt: fact.createdAt,
      },
    });
  }
}

/**
 * Sync A2A (Agent-to-Agent) communication relationships
 *
 * Creates SENT_TO relationships between memory spaces for A2A memories
 */
export async function syncA2ARelationships(
  memory: MemoryEntry,
  adapter: GraphAdapter,
): Promise<void> {
  // Only process A2A memories
  if (memory.sourceType !== "a2a") {
    return;
  }

  // Extract A2A metadata (if available)
  // Note: A2A metadata is stored in custom fields, not in a metadata object
  type A2AMemory = MemoryEntry & {
    toMemorySpace?: string;
    fromMemorySpace?: string;
    messageId?: string;
  };
  const a2aMemory = memory as A2AMemory;
  const toMemorySpace = a2aMemory.toMemorySpace;
  const fromMemorySpace = a2aMemory.fromMemorySpace;

  if (!toMemorySpace || !fromMemorySpace) {
    return;
  }

  // Find memory space nodes
  const fromNodeId = await findGraphNodeId(
    "MemorySpace",
    fromMemorySpace,
    adapter,
  );
  const toNodeId = await findGraphNodeId("MemorySpace", toMemorySpace, adapter);

  if (!fromNodeId || !toNodeId) {
    return;
  }

  // Create SENT_TO relationship
  await adapter.createEdge({
    type: "SENT_TO",
    from: fromNodeId,
    to: toNodeId,
    properties: {
      messageId: a2aMemory.messageId || memory.memoryId,
      importance: memory.importance,
      timestamp: memory.sourceTimestamp,
      memoryId: memory.memoryId,
    },
  });
}
