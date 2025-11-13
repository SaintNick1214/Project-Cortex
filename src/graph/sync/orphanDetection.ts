/**
 * Graph Orphan Detection
 *
 * Sophisticated orphan detection with circular reference protection.
 * Prevents deletion of nodes that are still referenced, even in circular graphs.
 */

import type { GraphAdapter } from "../types";

/**
 * Orphan detection rules for different node types
 */
export interface OrphanRule {
  /** Node types that must reference this node to keep it alive */
  keepIfReferencedBy?: string[];

  /** Never auto-delete this node type */
  neverDelete?: boolean;

  /** Only delete if explicitly requested (not cascaded) */
  explicitOnly?: boolean;
}

/**
 * Default orphan rules for each node type
 */
export const ORPHAN_RULES: Record<string, OrphanRule> = {
  // Conversations: Keep if referenced by Memory, Fact, or Context
  Conversation: {
    keepIfReferencedBy: ["Memory", "Fact", "Context"],
  },

  // Entities: Keep if referenced by any Fact
  Entity: {
    keepIfReferencedBy: ["Fact"],
  },

  // Users: Never auto-delete (shared across memory spaces)
  User: {
    neverDelete: true,
  },

  // Participants: Never auto-delete (Hive Mode participants)
  Participant: {
    neverDelete: true,
  },

  // Memory Spaces: Never auto-delete (critical isolation boundary)
  MemorySpace: {
    neverDelete: true,
  },

  // Primary entities: Only delete if explicitly requested
  Memory: { explicitOnly: true },
  Fact: { explicitOnly: true },
  Context: { explicitOnly: true },
};

/**
 * Context for tracking deletions (prevents circular reference issues)
 */
export interface DeletionContext {
  /** Set of node IDs being deleted in this operation */
  deletedNodeIds: Set<string>;

  /** Reason for deletion (for logging/debugging) */
  reason: string;

  /** Timestamp of deletion */
  timestamp: number;

  /** Orphan rules to use (can be customized) */
  orphanRules?: Record<string, OrphanRule>;
}

/**
 * Result of orphan detection
 */
export interface OrphanCheckResult {
  /** Is this node an orphan? */
  isOrphan: boolean;

  /** Reason for orphan status */
  reason: string;

  /** IDs of nodes that reference this node */
  referencedBy: string[];

  /** Is this part of a circular orphan island? */
  partOfCircularIsland: boolean;

  /** If part of island, the full island node IDs */
  islandNodes?: string[];
}

/**
 * Result of cascading delete operation
 */
export interface DeleteResult {
  /** IDs of all nodes deleted (including cascaded orphans) */
  deletedNodes: string[];

  /** IDs of all edges deleted */
  deletedEdges: string[];

  /** Orphan islands that were removed */
  orphanIslands: Array<{
    nodes: string[];
    reason: string;
  }>;
}

/**
 * Detect if a node is an orphan (safe for circular references)
 *
 * Algorithm:
 * 1. Check orphan rules (neverDelete, explicitOnly)
 * 2. Find all incoming references
 * 3. Filter out nodes being deleted and self-references
 * 4. Check if remaining references include "anchor" types
 * 5. If no external refs, check for circular orphan island
 *
 * @param nodeId Node ID to check
 * @param nodeLabel Node label (e.g., 'Conversation', 'Entity')
 * @param deletionContext Context of current deletion operation
 * @param adapter Graph database adapter
 * @returns Orphan check result
 */
export async function detectOrphan(
  nodeId: string,
  nodeLabel: string,
  deletionContext: DeletionContext,
  adapter: GraphAdapter,
): Promise<OrphanCheckResult> {
  const rules = deletionContext.orphanRules ?? ORPHAN_RULES;
  const rule: OrphanRule | undefined = rules[nodeLabel];

  // Rule 1: Never delete certain node types
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (rule !== undefined && rule.neverDelete) {
    return {
      isOrphan: false,
      reason: "Never delete rule",
      referencedBy: [],
      partOfCircularIsland: false,
    };
  }

  // Rule 2: Only delete if explicitly requested (not cascaded)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (rule !== undefined && rule.explicitOnly) {
    return {
      isOrphan: false,
      reason: "Explicit delete only",
      referencedBy: [],
      partOfCircularIsland: false,
    };
  }

  // Find all incoming references (nodes pointing TO this node)
  const incoming = await adapter.query(
    `
    MATCH (referrer)-[r]->(target)
    WHERE id(target) = $nodeId
    RETURN id(referrer) as referrerId, 
           labels(referrer)[0] as refererLabel,
           type(r) as relationshipType
  `,
    { nodeId },
  );

  // Filter to external references (not being deleted, not self-reference)
  const externalRefs = incoming.records.filter(
    (r) =>
      !deletionContext.deletedNodeIds.has(r.referrerId) &&
      r.referrerId !== nodeId,
  );

  // If no external references, check for circular island
  if (externalRefs.length === 0) {
    const islandCheck = await checkCircularIsland(
      nodeId,
      nodeLabel,
      deletionContext,
      adapter,
    );

    return {
      isOrphan: true,
      reason: islandCheck.isIsland ? "Circular orphan island" : "No references",
      referencedBy: [],
      partOfCircularIsland: islandCheck.isIsland,
      islandNodes: islandCheck.islandNodes,
    };
  }

  // Has external references - check if they're "anchor" types
  const defaultAnchors: string[] = ["Memory", "Fact", "Context"];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const anchorLabels: string[] = rule
    ? rule.keepIfReferencedBy || defaultAnchors
    : defaultAnchors;
  const hasAnchorRef = externalRefs.some((r) =>
    anchorLabels.includes(r.refererLabel),
  );

  if (!hasAnchorRef) {
    // Referenced only by non-anchor types
    return {
      isOrphan: true,
      reason: "No anchor references",
      referencedBy: externalRefs.map((r) => r.referrerId),
      partOfCircularIsland: false,
    };
  }

  return {
    isOrphan: false,
    reason: "Has anchor references",
    referencedBy: externalRefs.map((r) => r.referrerId),
    partOfCircularIsland: false,
  };
}

/**
 * Check if node is part of a circular orphan island
 *
 * An orphan island is a group of nodes that reference each other (circular)
 * but have no external references to "anchor" nodes (Memory, Fact, Context).
 *
 * Example:
 *   Entity A -[:KNOWS]-> Entity B
 *   Entity B -[:KNOWS]-> Entity A
 *   Fact F1 -[:MENTIONS]-> Entity A
 *
 *   If F1 is deleted, A and B form an orphan island (circular but no anchor).
 *
 * @param nodeId Starting node
 * @param nodeLabel Node label
 * @param deletionContext Deletion context
 * @param adapter Graph adapter
 * @returns Island check result
 */
async function checkCircularIsland(
  nodeId: string,
  nodeLabel: string,
  deletionContext: DeletionContext,
  adapter: GraphAdapter,
): Promise<{ isIsland: boolean; islandNodes: string[] }> {
  const visited = new Set<string>();
  const islandNodes = new Set<string>([nodeId]);
  const queue = [nodeId];
  const maxDepth = 10; // Prevent infinite loops

  // BFS to explore connected component
  let depth = 0;
  while (queue.length > 0 && depth < maxDepth) {
    const currentBatch = [...queue];
    queue.length = 0;

    for (const current of currentBatch) {
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all neighbors (undirected - both incoming and outgoing)
      const neighbors = await adapter.query(
        `
        MATCH (n)--(neighbor)
        WHERE id(n) = $currentId
        RETURN DISTINCT id(neighbor) as neighborId,
               labels(neighbor)[0] as neighborLabel
      `,
        { currentId: current },
      );

      for (const neighbor of neighbors.records) {
        // Skip if being deleted
        if (deletionContext.deletedNodeIds.has(neighbor.neighborId)) {
          continue;
        }

        // Check if neighbor is an anchor type (Memory, Fact, Context)
        if (["Memory", "Fact", "Context"].includes(neighbor.neighborLabel)) {
          // Found anchor! This is NOT an orphan island
          return { isIsland: false, islandNodes: [] };
        }

        // Add to island and continue BFS
        if (!visited.has(neighbor.neighborId)) {
          islandNodes.add(neighbor.neighborId);
          queue.push(neighbor.neighborId);
        }
      }
    }

    depth++;
  }

  // Completed BFS with no anchors found = orphan island
  return {
    isIsland: true,
    islandNodes: Array.from(islandNodes),
  };
}

/**
 * Delete a node and cascade to orphaned references
 *
 * Uses sophisticated orphan detection to safely clean up related nodes
 * while protecting against circular references.
 *
 * @param nodeId Node to delete
 * @param nodeLabel Node label
 * @param deletionContext Deletion context
 * @param adapter Graph adapter
 * @returns Delete result with all cascaded deletions
 */
export async function deleteWithOrphanCleanup(
  nodeId: string,
  nodeLabel: string,
  deletionContext: DeletionContext,
  adapter: GraphAdapter,
): Promise<DeleteResult> {
  const deletedNodes: string[] = [nodeId];
  const deletedEdges: string[] = [];
  const orphanIslands: Array<{ nodes: string[]; reason: string }> = [];

  // Add this node to deletion context
  deletionContext.deletedNodeIds.add(nodeId);

  // 1. Get all nodes this node references (outgoing edges)
  const referencedNodes = await adapter.query(
    `
    MATCH (n)-[r]->(referenced)
    WHERE id(n) = $nodeId
    RETURN id(referenced) as refId, 
           labels(referenced)[0] as refLabel,
           id(r) as edgeId
  `,
    { nodeId },
  );

  // 2. Delete the primary node (detach delete removes all edges)
  await adapter.deleteNode(nodeId, true);

  // 3. Check each referenced node for orphan status
  for (const ref of referencedNodes.records) {
    const orphanCheck = await detectOrphan(
      ref.refId,
      ref.refLabel,
      deletionContext,
      adapter,
    );

    if (orphanCheck.isOrphan) {
      if (orphanCheck.partOfCircularIsland && orphanCheck.islandNodes) {
        // Delete entire orphan island
        for (const islandNodeId of orphanCheck.islandNodes) {
          if (!deletionContext.deletedNodeIds.has(islandNodeId)) {
            await adapter.deleteNode(islandNodeId, true);
            deletedNodes.push(islandNodeId);
            deletionContext.deletedNodeIds.add(islandNodeId);
          }
        }

        orphanIslands.push({
          nodes: orphanCheck.islandNodes,
          reason: orphanCheck.reason,
        });
      } else {
        // Single orphan node - recursive delete with cascade
        const cascadeResult = await deleteWithOrphanCleanup(
          ref.refId,
          ref.refLabel,
          deletionContext,
          adapter,
        );

        deletedNodes.push(...cascadeResult.deletedNodes);
        deletedEdges.push(...cascadeResult.deletedEdges);
        orphanIslands.push(...cascadeResult.orphanIslands);
      }
    }
  }

  return {
    deletedNodes,
    deletedEdges,
    orphanIslands,
  };
}

/**
 * Create deletion context for tracking cascading deletes
 *
 * @param reason Reason for deletion
 * @param orphanRules Optional custom orphan rules
 * @returns Deletion context
 */
export function createDeletionContext(
  reason: string,
  orphanRules?: Record<string, OrphanRule>,
): DeletionContext {
  return {
    deletedNodeIds: new Set(),
    reason,
    timestamp: Date.now(),
    orphanRules,
  };
}

/**
 * Check if orphan cleanup is safe to run
 *
 * Validates that the graph database is accessible and ready for cleanup.
 *
 * @param adapter Graph adapter
 * @returns True if safe to run cleanup
 */
export async function canRunOrphanCleanup(
  adapter: GraphAdapter,
): Promise<boolean> {
  try {
    const connected = await adapter.isConnected();
    return connected;
  } catch {
    return false;
  }
}
