"""
Cortex SDK - Graph Orphan Detection

Sophisticated orphan detection with circular reference protection.
Prevents deletion of nodes that are still referenced, even in circular graphs.
"""

import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Set

if TYPE_CHECKING:
    from ..types import GraphAdapter

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class OrphanRule:
    """
    Orphan detection rules for different node types.

    Attributes:
        keep_if_referenced_by: Node types that must reference this node to keep it alive
        never_delete: Never auto-delete this node type
        explicit_only: Only delete if explicitly requested (not cascaded)
    """

    keep_if_referenced_by: Optional[List[str]] = None
    never_delete: bool = False
    explicit_only: bool = False


@dataclass
class DeletionContext:
    """
    Context for tracking deletions (prevents circular reference issues).

    Attributes:
        deleted_node_ids: Set of node IDs being deleted in this operation
        reason: Reason for deletion (for logging/debugging)
        timestamp: Timestamp of deletion
        orphan_rules: Optional custom orphan rules
    """

    deleted_node_ids: Set[str] = field(default_factory=set)
    reason: str = ""
    timestamp: int = 0
    orphan_rules: Optional[Dict[str, OrphanRule]] = None


@dataclass
class OrphanCheckResult:
    """
    Result of orphan detection.

    Attributes:
        is_orphan: Is this node an orphan?
        reason: Reason for orphan status
        referenced_by: IDs of nodes that reference this node
        part_of_circular_island: Is this part of a circular orphan island?
        island_nodes: If part of island, the full island node IDs
    """

    is_orphan: bool
    reason: str
    referenced_by: List[str]
    part_of_circular_island: bool
    island_nodes: Optional[List[str]] = None


@dataclass
class DeleteResult:
    """
    Result of cascading delete operation.

    Attributes:
        deleted_nodes: IDs of all nodes deleted (including cascaded orphans)
        deleted_edges: IDs of all edges deleted
        orphan_islands: Orphan islands that were removed
    """

    deleted_nodes: List[str]
    deleted_edges: List[str]
    orphan_islands: List[Dict[str, Any]] = field(default_factory=list)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Default Orphan Rules
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ORPHAN_RULES: Dict[str, OrphanRule] = {
    # Conversations: Keep if referenced by Memory, Fact, or Context
    "Conversation": OrphanRule(
        keep_if_referenced_by=["Memory", "Fact", "Context"],
    ),
    # Entities: Keep if referenced by any Fact
    "Entity": OrphanRule(
        keep_if_referenced_by=["Fact"],
    ),
    # Users: Never auto-delete (shared across memory spaces)
    "User": OrphanRule(
        never_delete=True,
    ),
    # Participants: Never auto-delete (Hive Mode participants)
    "Participant": OrphanRule(
        never_delete=True,
    ),
    # Memory Spaces: Never auto-delete (critical isolation boundary)
    "MemorySpace": OrphanRule(
        never_delete=True,
    ),
    # Primary entities: Only delete if explicitly requested
    "Memory": OrphanRule(explicit_only=True),
    "Fact": OrphanRule(explicit_only=True),
    "Context": OrphanRule(explicit_only=True),
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def create_deletion_context(
    reason: str,
    orphan_rules: Optional[Dict[str, OrphanRule]] = None,
) -> DeletionContext:
    """
    Create deletion context for tracking cascading deletes.

    Args:
        reason: Reason for deletion
        orphan_rules: Optional custom orphan rules

    Returns:
        Deletion context

    Example:
        >>> ctx = create_deletion_context("Delete Memory mem-123", ORPHAN_RULES)
    """
    return DeletionContext(
        deleted_node_ids=set(),
        reason=reason,
        timestamp=int(time.time() * 1000),
        orphan_rules=orphan_rules,
    )


async def can_run_orphan_cleanup(adapter: "GraphAdapter") -> bool:
    """
    Check if orphan cleanup is safe to run.

    Validates that the graph database is accessible and ready for cleanup.

    Args:
        adapter: Graph adapter

    Returns:
        True if safe to run cleanup

    Example:
        >>> if await can_run_orphan_cleanup(adapter):
        ...     await delete_with_orphan_cleanup(node_id, "Memory", ctx, adapter)
    """
    try:
        connected = await adapter.is_connected()
        return connected
    except Exception:
        return False


async def detect_orphan(
    node_id: str,
    node_label: str,
    deletion_context: DeletionContext,
    adapter: "GraphAdapter",
) -> OrphanCheckResult:
    """
    Detect if a node is an orphan (safe for circular references).

    Algorithm:
    1. Check orphan rules (neverDelete, explicitOnly)
    2. Find all incoming references
    3. Filter out nodes being deleted and self-references
    4. Check if remaining references include "anchor" types
    5. If no external refs, check for circular orphan island

    Args:
        node_id: Node ID to check
        node_label: Node label (e.g., 'Conversation', 'Entity')
        deletion_context: Context of current deletion operation
        adapter: Graph database adapter

    Returns:
        Orphan check result

    Example:
        >>> result = await detect_orphan("node-123", "Entity", ctx, adapter)
        >>> if result.is_orphan:
        ...     print(f"Node is orphan: {result.reason}")
    """
    rules = deletion_context.orphan_rules or ORPHAN_RULES
    rule = rules.get(node_label)

    # Rule 1: Never delete certain node types
    if rule is not None and rule.never_delete:
        return OrphanCheckResult(
            is_orphan=False,
            reason="Never delete rule",
            referenced_by=[],
            part_of_circular_island=False,
        )

    # Rule 2: Only delete if explicitly requested (not cascaded)
    if rule is not None and rule.explicit_only:
        return OrphanCheckResult(
            is_orphan=False,
            reason="Explicit delete only",
            referenced_by=[],
            part_of_circular_island=False,
        )

    # Find all incoming references (nodes pointing TO this node)
    try:
        incoming = await adapter.query(
            """
            MATCH (referrer)-[r]->(target)
            WHERE id(target) = $nodeId
            RETURN id(referrer) as referrerId,
                   labels(referrer)[0] as refererLabel,
                   type(r) as relationshipType
            """,
            {"nodeId": node_id},
        )
    except Exception:
        # If query fails, assume not an orphan for safety
        return OrphanCheckResult(
            is_orphan=False,
            reason="Query failed - assuming not orphan",
            referenced_by=[],
            part_of_circular_island=False,
        )

    # Filter to external references (not being deleted, not self-reference)
    external_refs = [
        r
        for r in incoming.records
        if r.get("referrerId") not in deletion_context.deleted_node_ids
        and r.get("referrerId") != node_id
    ]

    # If no external references, check for circular island
    if len(external_refs) == 0:
        island_check = await _check_circular_island(
            node_id, node_label, deletion_context, adapter
        )

        return OrphanCheckResult(
            is_orphan=True,
            reason="Circular orphan island" if island_check["is_island"] else "No references",
            referenced_by=[],
            part_of_circular_island=island_check["is_island"],
            island_nodes=island_check.get("island_nodes"),
        )

    # Has external references - check if they're "anchor" types
    default_anchors = ["Memory", "Fact", "Context"]
    anchor_labels = (
        rule.keep_if_referenced_by if rule and rule.keep_if_referenced_by else default_anchors
    )
    has_anchor_ref = any(r.get("refererLabel") in anchor_labels for r in external_refs)

    if not has_anchor_ref:
        # Referenced only by non-anchor types
        return OrphanCheckResult(
            is_orphan=True,
            reason="No anchor references",
            referenced_by=[str(r.get("referrerId")) for r in external_refs if r.get("referrerId") is not None],
            part_of_circular_island=False,
        )

    return OrphanCheckResult(
        is_orphan=False,
        reason="Has anchor references",
        referenced_by=[str(r.get("referrerId")) for r in external_refs if r.get("referrerId") is not None],
        part_of_circular_island=False,
    )


async def _check_circular_island(
    node_id: str,
    node_label: str,
    deletion_context: DeletionContext,
    adapter: "GraphAdapter",
) -> Dict[str, Any]:
    """
    Check if node is part of a circular orphan island.

    An orphan island is a group of nodes that reference each other (circular)
    but have no external references to "anchor" nodes (Memory, Fact, Context).

    Example:
        Entity A -[:KNOWS]-> Entity B
        Entity B -[:KNOWS]-> Entity A
        Fact F1 -[:MENTIONS]-> Entity A

        If F1 is deleted, A and B form an orphan island (circular but no anchor).

    Args:
        node_id: Starting node
        node_label: Node label
        deletion_context: Deletion context
        adapter: Graph adapter

    Returns:
        Dict with is_island bool and island_nodes list
    """
    visited: Set[str] = set()
    island_nodes: Set[str] = {node_id}
    queue = [node_id]
    max_depth = 10  # Prevent infinite loops

    # BFS to explore connected component
    depth = 0
    while queue and depth < max_depth:
        current_batch = list(queue)
        queue.clear()

        for current in current_batch:
            if current in visited:
                continue
            visited.add(current)

            # Find all neighbors (undirected - both incoming and outgoing)
            try:
                neighbors = await adapter.query(
                    """
                    MATCH (n)--(neighbor)
                    WHERE id(n) = $currentId
                    RETURN DISTINCT id(neighbor) as neighborId,
                           labels(neighbor)[0] as neighborLabel
                    """,
                    {"currentId": current},
                )
            except Exception:
                continue

            for neighbor in neighbors.records:
                neighbor_id = neighbor.get("neighborId")
                neighbor_label = neighbor.get("neighborLabel")

                # Skip if being deleted
                if neighbor_id in deletion_context.deleted_node_ids:
                    continue

                # Check if neighbor is an anchor type (Memory, Fact, Context)
                if neighbor_label in ["Memory", "Fact", "Context"]:
                    # Found anchor! This is NOT an orphan island
                    return {"is_island": False, "island_nodes": []}

                # Add to island and continue BFS
                if neighbor_id is not None and neighbor_id not in visited:
                    island_nodes.add(str(neighbor_id))
                    queue.append(str(neighbor_id))

        depth += 1

    # Completed BFS with no anchors found = orphan island
    return {
        "is_island": True,
        "island_nodes": list(island_nodes),
    }


async def delete_with_orphan_cleanup(
    node_id: str,
    node_label: str,
    deletion_context: DeletionContext,
    adapter: "GraphAdapter",
) -> DeleteResult:
    """
    Delete a node and cascade to orphaned references.

    Uses sophisticated orphan detection to safely clean up related nodes
    while protecting against circular references.

    Args:
        node_id: Node to delete
        node_label: Node label
        deletion_context: Deletion context
        adapter: Graph adapter

    Returns:
        Delete result with all cascaded deletions

    Example:
        >>> ctx = create_deletion_context("Delete Memory mem-123", ORPHAN_RULES)
        >>> result = await delete_with_orphan_cleanup("node-123", "Memory", ctx, adapter)
        >>> print(f"Deleted {len(result.deleted_nodes)} nodes")
    """
    deleted_nodes: List[str] = [node_id]
    deleted_edges: List[str] = []
    orphan_islands: List[Dict[str, Any]] = []

    # Add this node to deletion context
    deletion_context.deleted_node_ids.add(node_id)

    # 1. Get all nodes this node references (outgoing edges)
    try:
        referenced_nodes = await adapter.query(
            """
            MATCH (n)-[r]->(referenced)
            WHERE id(n) = $nodeId
            RETURN id(referenced) as refId,
                   labels(referenced)[0] as refLabel,
                   id(r) as edgeId
            """,
            {"nodeId": node_id},
        )
    except Exception:
        referenced_nodes_records: List[Dict[str, Any]] = []
    else:
        referenced_nodes_records = referenced_nodes.records

    # 2. Delete the primary node (detach delete removes all edges)
    try:
        await adapter.delete_node(node_id, detach=True)
    except Exception:
        # Node may already be deleted
        pass

    # 3. Check each referenced node for orphan status
    for ref in referenced_nodes_records:
        ref_id = ref.get("refId")
        ref_label = ref.get("refLabel")

        if not ref_id or not ref_label:
            continue

        orphan_check = await detect_orphan(ref_id, ref_label, deletion_context, adapter)

        if orphan_check.is_orphan:
            if orphan_check.part_of_circular_island and orphan_check.island_nodes:
                # Delete entire orphan island
                for island_node_id in orphan_check.island_nodes:
                    if island_node_id not in deletion_context.deleted_node_ids:
                        try:
                            await adapter.delete_node(island_node_id, detach=True)
                            deleted_nodes.append(island_node_id)
                            deletion_context.deleted_node_ids.add(island_node_id)
                        except Exception:
                            pass  # Node may have already been deleted via cascade

                orphan_islands.append({
                    "nodes": orphan_check.island_nodes,
                    "reason": orphan_check.reason,
                })
            else:
                # Single orphan node - recursive delete with cascade
                cascade_result = await delete_with_orphan_cleanup(
                    ref_id, ref_label, deletion_context, adapter
                )

                deleted_nodes.extend(cascade_result.deleted_nodes)
                deleted_edges.extend(cascade_result.deleted_edges)
                orphan_islands.extend(cascade_result.orphan_islands)

    return DeleteResult(
        deleted_nodes=deleted_nodes,
        deleted_edges=deleted_edges,
        orphan_islands=orphan_islands,
    )


__all__ = [
    "OrphanRule",
    "DeletionContext",
    "OrphanCheckResult",
    "DeleteResult",
    "ORPHAN_RULES",
    "create_deletion_context",
    "can_run_orphan_cleanup",
    "detect_orphan",
    "delete_with_orphan_cleanup",
]
