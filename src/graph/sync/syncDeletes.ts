/**
 * Graph Delete Operations
 *
 * Delete operations with sophisticated orphan cleanup and cascade logic.
 */

import type { GraphAdapter } from "../types";
import {
  deleteWithOrphanCleanup,
  createDeletionContext,
  ORPHAN_RULES,
  type DeleteResult,
} from "./orphanDetection";
import { findGraphNodeId } from "./syncUtils";

/**
 * Delete a Memory from graph with orphan cleanup
 *
 * Deletes the memory node and checks if referenced Conversation becomes orphaned.
 */
export async function deleteMemoryFromGraph(
  memoryId: string,
  adapter: GraphAdapter,
  enableOrphanCleanup: boolean = true,
): Promise<DeleteResult> {
  // Find memory node
  const nodeId = await findGraphNodeId("Memory", memoryId, adapter);
  if (!nodeId) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }

  if (!enableOrphanCleanup) {
    // Simple delete without orphan cleanup
    await adapter.deleteNode(nodeId, true);
    return { deletedNodes: [nodeId], deletedEdges: [], orphanIslands: [] };
  }

  // Delete with orphan cleanup
  const deletionContext = createDeletionContext(
    `Delete Memory ${memoryId}`,
    ORPHAN_RULES,
  );

  return await deleteWithOrphanCleanup(
    nodeId,
    "Memory",
    deletionContext,
    adapter,
  );
}

/**
 * Delete a Fact from graph with Entity orphan cleanup
 *
 * Deletes the fact node and checks if mentioned Entities become orphaned.
 */
export async function deleteFactFromGraph(
  factId: string,
  adapter: GraphAdapter,
  enableOrphanCleanup: boolean = true,
): Promise<DeleteResult> {
  // Find fact node
  const nodeId = await findGraphNodeId("Fact", factId, adapter);
  if (!nodeId) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }

  if (!enableOrphanCleanup) {
    // Simple delete
    await adapter.deleteNode(nodeId, true);
    return { deletedNodes: [nodeId], deletedEdges: [], orphanIslands: [] };
  }

  // Delete with orphan cleanup (will cascade to orphaned Entities)
  const deletionContext = createDeletionContext(
    `Delete Fact ${factId}`,
    ORPHAN_RULES,
  );

  return await deleteWithOrphanCleanup(
    nodeId,
    "Fact",
    deletionContext,
    adapter,
  );
}

/**
 * Delete a Context from graph with relationship cleanup
 *
 * Deletes the context node and checks if referenced Conversation becomes orphaned.
 */
export async function deleteContextFromGraph(
  contextId: string,
  adapter: GraphAdapter,
  enableOrphanCleanup: boolean = true,
): Promise<DeleteResult> {
  // Find context node
  const nodeId = await findGraphNodeId("Context", contextId, adapter);
  if (!nodeId) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }

  if (!enableOrphanCleanup) {
    // Simple delete
    await adapter.deleteNode(nodeId, true);
    return { deletedNodes: [nodeId], deletedEdges: [], orphanIslands: [] };
  }

  // Delete with orphan cleanup
  const deletionContext = createDeletionContext(
    `Delete Context ${contextId}`,
    ORPHAN_RULES,
  );

  return await deleteWithOrphanCleanup(
    nodeId,
    "Context",
    deletionContext,
    adapter,
  );
}

/**
 * Delete a Conversation from graph
 *
 * Simple delete - conversations are usually leaf nodes or referenced by Memory/Context.
 * Orphan cleanup happens when Memory/Context is deleted.
 */
export async function deleteConversationFromGraph(
  conversationId: string,
  adapter: GraphAdapter,
  enableOrphanCleanup: boolean = true,
): Promise<DeleteResult> {
  // Find conversation node
  const nodeId = await findGraphNodeId(
    "Conversation",
    conversationId,
    adapter,
  );
  if (!nodeId) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }

  if (!enableOrphanCleanup) {
    // Simple delete
    await adapter.deleteNode(nodeId, true);
    return { deletedNodes: [nodeId], deletedEdges: [], orphanIslands: [] };
  }

  // Delete with orphan cleanup
  const deletionContext = createDeletionContext(
    `Delete Conversation ${conversationId}`,
    ORPHAN_RULES,
  );

  return await deleteWithOrphanCleanup(
    nodeId,
    "Conversation",
    deletionContext,
    adapter,
  );
}

/**
 * Delete a Memory Space from graph (careful - usually explicit only)
 *
 * WARNING: Deleting a memory space should be rare!
 * This does NOT cascade to memories/contexts in that space.
 */
export async function deleteMemorySpaceFromGraph(
  memorySpaceId: string,
  adapter: GraphAdapter,
): Promise<DeleteResult> {
  // Find memory space node
  const nodeId = await findGraphNodeId("MemorySpace", memorySpaceId, adapter);
  if (!nodeId) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }

  // Simple delete (no cascade - MemorySpace is neverDelete rule)
  await adapter.deleteNode(nodeId, true);
  return {
    deletedNodes: [nodeId],
    deletedEdges: [],
    orphanIslands: [],
  };
}

/**
 * Delete an Immutable record from graph
 */
export async function deleteImmutableFromGraph(
  immutableType: string,
  immutableId: string,
  adapter: GraphAdapter,
  enableOrphanCleanup: boolean = true,
): Promise<DeleteResult> {
  // Immutable records can be various types
  // For now, handle facts specially, others generically
  if (immutableType === "fact") {
    return await deleteFactFromGraph(immutableId, adapter, enableOrphanCleanup);
  }

  // Generic immutable delete (no specific orphan rules)
  const nodes = await adapter.findNodes("Immutable", {
    immutableId,
    type: immutableType,
  });

  if (nodes.length === 0) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }

  await adapter.deleteNode(nodes[0].id!, true);
  return {
    deletedNodes: [nodes[0].id!],
    deletedEdges: [],
    orphanIslands: [],
  };
}

/**
 * Delete a Mutable record from graph
 */
export async function deleteMutableFromGraph(
  namespace: string,
  key: string,
  adapter: GraphAdapter,
): Promise<DeleteResult> {
  // Mutable records - simple delete (no cascading)
  const nodes = await adapter.findNodes("Mutable", {
    namespace,
    key,
  });

  if (nodes.length === 0) {
    return { deletedNodes: [], deletedEdges: [], orphanIslands: [] };
  }

  await adapter.deleteNode(nodes[0].id!, true);
  return {
    deletedNodes: [nodes[0].id!],
    deletedEdges: [],
    orphanIslands: [],
  };
}

