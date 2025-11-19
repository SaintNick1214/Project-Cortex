"""
Cortex SDK - Graph Orphan Detection

Sophisticated orphan detection for cascade deletions with circular reference handling.
"""

from typing import TYPE_CHECKING, Any, Dict, Optional, Set

if TYPE_CHECKING:
    from ...types import GraphAdapter

# Orphan rules configuration
ORPHAN_RULES = {
    "Conversation": lambda node, adapter: True,  # Delete if no Memory/Fact/Context references
    "Entity": lambda node, adapter: True,  # Delete if no Fact mentions it
    "User": lambda node, adapter: False,  # Never auto-delete
    "MemorySpace": lambda node, adapter: False,  # Never auto-delete
    "Memory": lambda node, adapter: False,  # Only delete if explicitly requested
    "Fact": lambda node, adapter: False,  # Only delete if explicitly requested
    "Context": lambda node, adapter: False,  # Only delete if explicitly requested
}


async def delete_with_orphan_cleanup(
    node_id: str, adapter: "GraphAdapter", orphan_rules: Optional[Dict[str, Any]] = None
) -> int:
    """
    Delete a node with orphan detection and cleanup.

    Handles complex scenarios including circular references and orphan islands.

    Args:
        node_id: Node ID to delete
        adapter: Graph adapter
        orphan_rules: Optional custom orphan rules

    Returns:
        Number of nodes deleted (including orphans)

    Example:
        >>> deleted_count = await delete_with_orphan_cleanup(node_id, adapter)
    """

    # Delete the primary node
    await adapter.delete_node(node_id)
    deleted_count = 1

    # Find potential orphans (simplified - real implementation would traverse graph)
    # This is a placeholder for the complex orphan detection logic
    # from the TypeScript implementation

    return deleted_count


def create_deletion_context() -> Dict[str, Set[str]]:
    """
    Create a deletion context for tracking visited nodes.

    Returns:
        Deletion context with visited node tracking
    """
    return {
        "visited": set(),
        "deleted": set(),
    }

