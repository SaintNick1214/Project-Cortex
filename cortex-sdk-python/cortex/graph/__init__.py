"""
Cortex SDK - Graph Database Integration

Graph database integration for advanced relationship queries and knowledge graphs.
"""

from typing import Any, Dict, Optional

from ..types import GraphAdapter, GraphDeleteResult, GraphIdentity
from .batch_sync import (
    GraphRebuildPartialError,
    graph_rebuild_pages,
    initial_graph_sync,
)
from .erasure import (
    GraphErasureApplyResult,
    GraphErasureEvidence,
    GraphErasureItem,
    GraphErasureProgressError,
    GraphErasureStatus,
    PreparedGraphErasureItem,
    apply_graph_job,
    deliver_graph_job,
    erase_graph_item,
    graph_off_result,
    prepare_graph_erasure,
    requested_graph,
    verify_graph_erasure,
    write_graph_mutation,
    write_with_graph,
)
from .erasure_transport import (
    FixedGraphErasureTransport,
    create_graph_erasure_transport,
)

# Re-export error classes
from .errors import (
    GraphAuthenticationError,
    GraphCommittedPartial,
    GraphConnectionError,
    GraphDatabaseError,
    GraphJobUnresolved,
    GraphNotFoundError,
    GraphPrimaryOutcomeUnknown,
    GraphQueryError,
    GraphSchemaError,
    GraphSyncError,
)
from .identity import (
    MANAGED_LABELS,
    assert_identity_properties,
    identity_properties,
    primary_graph_identity,
)

# Re-export orphan detection
from .orphan_detection import (
    ORPHAN_RULES,
    DeleteResult,
    DeletionContext,
    OrphanCheckResult,
    OrphanRule,
    can_run_orphan_cleanup,
    create_deletion_context,
    delete_with_orphan_cleanup,
    detect_orphan,
)
from .rebuild_transport import (
    FixedGraphRebuildTransport,
    create_graph_rebuild_transport,
)
from .schema import assert_managed_graph_compatibility

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Helper Functions - Find and Ensure Nodes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def find_graph_node_id(label: str, cortex_id: str, adapter: GraphAdapter,
                             identity: Optional[GraphIdentity] = None) -> Optional[str]:
    if identity is None or identity.kind != label:
        raise GraphDatabaseError("Pass captured physical identity and exact scope for managed lookup.", "GRAPH_IDENTITY_REQUIRED")
    identity_properties(identity)
    display = {"Context": "contextId", "Conversation": "conversationId", "Memory": "memoryId", "Fact": "factId", "MemorySpace": "memorySpaceId", "Immutable": "id", "Mutable": "mutableKey", "Artifact": "artifactId"}
    reader, dialect = getattr(adapter, "managed_read", None), getattr(adapter, "managed_dialect", None)
    if not callable(reader) or not callable(dialect):
        raise GraphDatabaseError("Verified managed reads and engine dialect required.", "GRAPH_SCHEMA_MIGRATION_REQUIRED")
    engine = await dialect()
    if engine not in ("neo4j", "memgraph"):
        raise GraphDatabaseError("Unverified managed engine dialect.", "GRAPH_SCHEMA_MIGRATION_REQUIRED")
    native_id_function = "elementId" if engine == "neo4j" else "id"
    response = await reader(
        f"MATCH (n:{MANAGED_LABELS[identity.kind]} {{key:$key}}) RETURN {native_id_function}(n) AS id,properties(n) AS node LIMIT 2",
        {"key": identity.key},
    )
    if response.count > 1 or len(response.records) > 1:
        raise GraphDatabaseError("Managed physical graph identity is ambiguous.", "GRAPH_IDENTITY_MISMATCH")
    if not response.records:
        return None
    node, native_id = response.records[0].get("node"), response.records[0].get("id")
    if not isinstance(node, dict):
        raise GraphDatabaseError("Managed physical graph properties are invalid.", "GRAPH_IDENTITY_MISMATCH")
    # The ordinary adapter deserializes JSON-looking display properties. Managed
    # tupleJson is authoritative exact text and must be compared before that layer.
    assert_identity_properties(node, identity)
    valid_id = isinstance(native_id, str) and bool(native_id) if engine == "neo4j" else type(native_id) is int and native_id >= 0
    if node.get(display[label]) != cortex_id or not valid_id:
        raise GraphDatabaseError("Captured physical identity does not match requested display/native ID.", "GRAPH_IDENTITY_MISMATCH")
    return str(native_id)



async def ensure_user_node(
    user_id: str, adapter: GraphAdapter, tenant_id: Optional[str] = None
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def ensure_agent_node(
    agent_id: str, adapter: GraphAdapter, tenant_id: Optional[str] = None
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def ensure_participant_node(
    participant_id: str, adapter: GraphAdapter, tenant_id: Optional[str] = None
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def ensure_entity_node(
    entity_name: str,
    entity_type: str,
    adapter: GraphAdapter,
    tenant_id: Optional[str] = None,
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def ensure_enriched_entity_node(
    entity_name: str,
    entity_type: str,
    full_value: Optional[str],
    adapter: GraphAdapter,
    tenant_id: Optional[str] = None,
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Memory to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_memory_to_graph(
    memory: Dict[str, Any], adapter: GraphAdapter, tenant_id: Optional[str] = None
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def sync_memory_relationships(
    memory: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def delete_memory_from_graph(
    memory_id: str,
    adapter: GraphAdapter,
    enable_orphan_cleanup: bool = True,
) -> GraphDeleteResult:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Conversation to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_conversation_to_graph(
    conversation: Dict[str, Any], adapter: GraphAdapter, tenant_id: Optional[str] = None
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def sync_conversation_relationships(
    conversation: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def delete_conversation_from_graph(
    conversation_id: str,
    adapter: GraphAdapter,
    enable_orphan_cleanup: bool = True,
) -> GraphDeleteResult:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Fact to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_fact_to_graph(
    fact: Dict[str, Any], adapter: GraphAdapter, tenant_id: Optional[str] = None
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def sync_fact_relationships(
    fact: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def delete_fact_from_graph(
    fact_id: str,
    adapter: GraphAdapter,
    enable_orphan_cleanup: bool = True,
) -> GraphDeleteResult:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Fact Supersession (Belief Revision)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_fact_supersession(
    old_fact_id: str,
    new_fact_id: str,
    adapter: GraphAdapter,
    reason: Optional[str] = None,
) -> bool:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def sync_fact_revision(
    fact_id: str,
    adapter: GraphAdapter,
    reason: Optional[str] = None,
) -> bool:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def get_fact_supersession_chain_from_graph(fact_id: str, adapter: GraphAdapter,
                                                identity: Optional[GraphIdentity] = None) -> list[Dict[str, Any]]:
    if identity is None or identity.kind != "Fact":
        raise GraphDatabaseError("Pass captured physical Fact identity for a scoped chain.", "GRAPH_IDENTITY_REQUIRED")
    if await find_graph_node_id("Fact", fact_id, adapter, identity) is None:
        return []
    managed_read = getattr(adapter, "managed_read", None)
    if not callable(managed_read):
        raise GraphDatabaseError("Managed bounded reads required.", "GRAPH_SCHEMA_MIGRATION_REQUIRED")
    result = await managed_read("""MATCH path=(start:CortexV2Fact {key:$key})-[:SUPERSEDES|SUPERSEDED_BY*0..10]-(node:CortexV2Fact)
    WHERE all(n IN nodes(path) WHERE n.schemaVersion=2 AND n.kind='Fact' AND n.tenantTag=$tenantTag AND n.tenantValue=$tenantValue AND n.spaceTag='space' AND n.spaceValue=$space)
      AND all(r IN relationships(path) WHERE r.schemaVersion=2 AND r.sourceKey=startNode(r).key AND r.targetKey=endNode(r).key AND r.ownerKey=r.sourceKey)
    RETURN DISTINCT properties(node) AS node,length(path) AS hops ORDER BY node.createdAt ASC LIMIT 65""", {"key": identity.key, "tenantTag": "knownTenantless" if identity.tenant_id is None else "tenant", "tenantValue": identity.tenant_id or "", "space": identity.memory_space_id})
    if result.count > 64 or any(row.get("hops") == 10 for row in result.records):
        raise GraphDatabaseError("No truncated supersession chain is returned.", "GRAPH_QUERY_BUDGET")
    seen: set[str] = set()
    chain = []
    for row in result.records:
        node = row.get("node", {})
        captured = primary_graph_identity("Fact", node.get("physicalSourceId"), identity)
        assert_identity_properties(node, captured)
        if captured.key in seen:
            continue
        seen.add(captured.key)
        if not isinstance(node.get("factId"), str) or not isinstance(node.get("fact"), str):
            raise GraphDatabaseError("Malformed managed Fact projection.", "GRAPH_IDENTITY_MISMATCH")
        chain.append({"factId": node["factId"], "fact": node["fact"], **({"supersededAt": node["statusUpdatedAt"]} if type(node.get("statusUpdatedAt")) in (int, float) else {})})
    return chain


async def remove_fact_supersession_relationships(
    fact_id: str,
    adapter: GraphAdapter,
) -> int:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def update_fact_graph_status(
    fact_id: str,
    status: str,
    adapter: GraphAdapter,
) -> None:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def sync_fact_update_in_place(
    fact: Dict[str, Any],
    adapter: GraphAdapter,
    tenant_id: Optional[str] = None,
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def sync_fact_full_supersession(
    old_fact: Dict[str, Any],
    new_fact: Dict[str, Any],
    adapter: GraphAdapter,
    reason: Optional[str] = None,
    tenant_id: Optional[str] = None,
) -> Dict[str, str]:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def sync_fact_revision_relationship(
    original_fact: Dict[str, Any],
    revised_fact: Dict[str, Any],
    adapter: GraphAdapter,
    reason: Optional[str] = None,
    tenant_id: Optional[str] = None,
) -> Dict[str, str]:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Context to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_context_to_graph(
    context: Dict[str, Any], adapter: GraphAdapter, tenant_id: Optional[str] = None
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def sync_context_relationships(
    context: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def delete_context_from_graph(
    context_id: str,
    adapter: GraphAdapter,
    enable_orphan_cleanup: bool = True,
) -> GraphDeleteResult:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - MemorySpace to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_memory_space_to_graph(
    memory_space: Dict[str, Any], adapter: GraphAdapter, tenant_id: Optional[str] = None
) -> str:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def delete_memory_space_from_graph(
    memory_space_id: str,
    adapter: GraphAdapter,
) -> GraphDeleteResult:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - User/Agent Deletion
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def delete_user_from_graph(user_id: str, adapter: GraphAdapter) -> int:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def delete_agent_from_graph(agent_id: str, adapter: GraphAdapter) -> int:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Immutable/Mutable Deletion
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def delete_immutable_from_graph(
    immutable_type: str,
    immutable_id: str,
    adapter: GraphAdapter,
    enable_orphan_cleanup: bool = True,
) -> GraphDeleteResult:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


async def delete_mutable_from_graph(
    namespace: str,
    key: str,
    adapter: GraphAdapter,
) -> GraphDeleteResult:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - A2A Relationships
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_a2a_relationships(
    memory: Dict[str, Any],
    adapter: GraphAdapter,
) -> None:
    """Logical-ID compatibility entry point; uncaptured mutations refuse."""
    raise GraphDatabaseError(
        "Use graph-enabled domain writes and their original native jobs, or explicit administrator initial_graph_sync.",
        "GRAPH_CAPTURED_JOB_REQUIRED",
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Exports
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

__all__ = [
    "apply_graph_job", "deliver_graph_job", "graph_off_result",
    "primary_graph_identity", "assert_managed_graph_compatibility",
    # Error classes
    "GraphDatabaseError",
    "GraphCommittedPartial",
    "GraphJobUnresolved",
    "GraphPrimaryOutcomeUnknown",
    "GraphConnectionError",
    "GraphAuthenticationError",
    "GraphQueryError",
    "GraphNotFoundError",
    "GraphSchemaError",
    "GraphSyncError",
    # Orphan detection
    "OrphanRule",
    "DeletionContext",
    "OrphanCheckResult",
    "DeleteResult",
    "ORPHAN_RULES",
    "create_deletion_context",
    "can_run_orphan_cleanup",
    "detect_orphan",
    "delete_with_orphan_cleanup",
    # Helper functions
    "find_graph_node_id",
    "ensure_user_node",
    "ensure_agent_node",
    "ensure_participant_node",
    "ensure_entity_node",
    "ensure_enriched_entity_node",
    # Sync functions - Memory
    "sync_memory_to_graph",
    "sync_memory_relationships",
    "delete_memory_from_graph",
    # Sync functions - Conversation
    "sync_conversation_to_graph",
    "sync_conversation_relationships",
    "delete_conversation_from_graph",
    # Sync functions - Fact
    "sync_fact_to_graph",
    "sync_fact_relationships",
    "delete_fact_from_graph",
    # Sync functions - Fact Supersession (Belief Revision)
    "sync_fact_supersession",
    "sync_fact_revision",
    "get_fact_supersession_chain_from_graph",
    "remove_fact_supersession_relationships",
    "update_fact_graph_status",
    "sync_fact_update_in_place",
    "sync_fact_full_supersession",
    "sync_fact_revision_relationship",
    # Sync functions - Context
    "sync_context_to_graph",
    "sync_context_relationships",
    "delete_context_from_graph",
    # Sync functions - MemorySpace
    "sync_memory_space_to_graph",
    "delete_memory_space_from_graph",
    # Sync functions - User/Agent
    "delete_user_from_graph",
    "delete_agent_from_graph",
    # Sync functions - Immutable/Mutable
    "delete_immutable_from_graph",
    "delete_mutable_from_graph",
    # Sync functions - A2A
    "sync_a2a_relationships",
]


__all__ += ["initial_graph_sync", "GraphRebuildPartialError", "graph_rebuild_pages", "FixedGraphRebuildTransport", "create_graph_rebuild_transport", "write_graph_mutation", "write_with_graph", "requested_graph"]

__all__ += ["prepare_graph_erasure", "erase_graph_item", "verify_graph_erasure", "GraphErasureProgressError", "GraphErasureItem", "GraphErasureEvidence", "GraphErasureStatus", "GraphErasureApplyResult", "PreparedGraphErasureItem", "FixedGraphErasureTransport", "create_graph_erasure_transport"]
