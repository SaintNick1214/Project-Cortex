"""
Cortex SDK - Graph Database Integration

Graph database integration for advanced relationship queries and knowledge graphs.
"""

import time
from typing import Any, Dict, Optional

from ..types import GraphAdapter, GraphDeleteResult, GraphEdge, GraphNode

# Re-export error classes
from .errors import (
    GraphConnectionError,
    GraphDatabaseError,
    GraphNotFoundError,
    GraphQueryError,
    GraphSchemaError,
    GraphSyncError,
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

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Helper Functions - Find and Ensure Nodes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def find_graph_node_id(
    label: str,
    cortex_id: str,
    adapter: GraphAdapter,
) -> Optional[str]:
    """
    Find a graph node ID by Cortex entity ID.

    Helper function to look up nodes created from Cortex entities.

    Args:
        label: Node label (e.g., 'Context', 'Memory', 'Fact')
        cortex_id: The Cortex entity ID
        adapter: Graph database adapter

    Returns:
        Graph node ID, or None if not found

    Example:
        >>> node_id = await find_graph_node_id("Memory", "mem-123", adapter)
    """
    # Determine property name based on label
    property_map = {
        "Context": "contextId",
        "Conversation": "conversationId",
        "Memory": "memoryId",
        "Fact": "factId",
        "MemorySpace": "memorySpaceId",
        "User": "userId",
        "Agent": "agentId",
        "Participant": "participantId",
    }

    property_name = property_map.get(label)
    if not property_name:
        raise ValueError(f"Unknown label: {label}")

    # Find node by property
    nodes = await adapter.find_nodes(label, {property_name: cortex_id}, 1)
    return nodes[0].id if nodes else None


async def ensure_user_node(user_id: str, adapter: GraphAdapter) -> str:
    """
    Ensure a User node exists in the graph.

    Uses MERGE for idempotent creation.

    Args:
        user_id: User ID
        adapter: Graph database adapter

    Returns:
        Graph node ID

    Example:
        >>> node_id = await ensure_user_node("user-123", adapter)
    """
    return await adapter.merge_node(
        GraphNode(
            label="User",
            properties={
                "userId": user_id,
                "createdAt": int(time.time() * 1000),
            },
        ),
        {"userId": user_id},
    )


async def ensure_agent_node(agent_id: str, adapter: GraphAdapter) -> str:
    """
    Ensure an Agent node exists in the graph.

    Uses MERGE for idempotent creation.

    Args:
        agent_id: Agent ID
        adapter: Graph database adapter

    Returns:
        Graph node ID

    Example:
        >>> node_id = await ensure_agent_node("agent-123", adapter)
    """
    return await adapter.merge_node(
        GraphNode(
            label="Agent",
            properties={
                "agentId": agent_id,
                "createdAt": int(time.time() * 1000),
            },
        ),
        {"agentId": agent_id},
    )


async def ensure_participant_node(participant_id: str, adapter: GraphAdapter) -> str:
    """
    Ensure a Participant node exists in the graph (Hive Mode).

    Uses MERGE for idempotent creation.

    Args:
        participant_id: Participant ID
        adapter: Graph database adapter

    Returns:
        Graph node ID

    Example:
        >>> node_id = await ensure_participant_node("participant-123", adapter)
    """
    return await adapter.merge_node(
        GraphNode(
            label="Participant",
            properties={
                "participantId": participant_id,
                "createdAt": int(time.time() * 1000),
            },
        ),
        {"participantId": participant_id},
    )


async def ensure_entity_node(
    entity_name: str,
    entity_type: str,
    adapter: GraphAdapter,
) -> str:
    """
    Ensure an Entity node exists in the graph.

    Helper for fact entity relationships.
    Uses MERGE for idempotent creation.

    Args:
        entity_name: Entity name
        entity_type: Entity type (e.g., 'subject', 'object')
        adapter: Graph database adapter

    Returns:
        Graph node ID

    Example:
        >>> node_id = await ensure_entity_node("John", "subject", adapter)
    """
    return await adapter.merge_node(
        GraphNode(
            label="Entity",
            properties={
                "name": entity_name,
                "type": entity_type,
                "createdAt": int(time.time() * 1000),
            },
        ),
        {"name": entity_name},
    )


async def ensure_enriched_entity_node(
    entity_name: str,
    entity_type: str,
    full_value: Optional[str],
    adapter: GraphAdapter,
) -> str:
    """
    Ensure an enriched Entity node exists in the graph.

    Creates Entity nodes with additional metadata from enriched extraction:
    - entity_type: Specific type (e.g., "preferred_name", "full_name", "company")
    - full_value: Full value if available (e.g., "Alexander Johnson" for "Alex")

    Uses MERGE for idempotent creation with property updates.

    Args:
        entity_name: Entity name
        entity_type: Specific entity type
        full_value: Full value if available
        adapter: Graph database adapter

    Returns:
        Graph node ID

    Example:
        >>> node_id = await ensure_enriched_entity_node(
        ...     "Alex", "preferred_name", "Alexander Johnson", adapter
        ... )
    """
    now = int(time.time() * 1000)
    return await adapter.merge_node(
        GraphNode(
            label="Entity",
            properties={
                "name": entity_name,
                "type": entity_type,
                "entityType": entity_type,
                "fullValue": full_value,
                "createdAt": now,
                "updatedAt": now,
            },
        ),
        {"name": entity_name},
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Memory to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_memory_to_graph(memory: Dict[str, Any], adapter: GraphAdapter) -> str:
    """
    Sync a memory to the graph database.

    Uses MERGE for idempotent operations.

    Args:
        memory: Memory entry to sync
        adapter: Graph database adapter

    Returns:
        Node ID in graph

    Example:
        >>> node_id = await sync_memory_to_graph(memory, graph_adapter)
    """
    node = GraphNode(
        label="Memory",
        properties={
            "memoryId": memory["memoryId"],
            "memorySpaceId": memory["memorySpaceId"],
            "participantId": memory.get("participantId"),
            "userId": memory.get("userId"),
            "agentId": memory.get("agentId"),
            "content": memory["content"][:200],  # Truncate for graph
            "contentType": memory.get("contentType"),
            "sourceType": memory["sourceType"],
            "sourceUserId": memory.get("sourceUserId"),
            "importance": memory["importance"],
            "tags": memory.get("tags", []),
            "version": memory.get("version", 1),
            "createdAt": memory["createdAt"],
            "updatedAt": memory.get("updatedAt", memory["createdAt"]),
        },
    )

    return await adapter.merge_node(node, {"memoryId": memory["memoryId"]})


async def sync_memory_relationships(
    memory: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """
    Sync memory relationships to graph.

    Creates:
    - REFERENCES relationships to Conversation (if conversationRef exists)
    - RELATES_TO relationships to User (if userId exists)
    - RELATES_TO relationships to Agent (if agentId exists)
    - IN_SPACE relationships to MemorySpace
    - SOURCED_FROM relationships to Fact (if immutableRef exists)
    - STORED_BY relationships to Participant (Hive Mode)

    Args:
        memory: Memory entry
        node_id: Memory node ID in graph
        adapter: Graph database adapter
    """
    now = int(time.time() * 1000)

    # conversationRef → REFERENCES edge
    if memory.get("conversationRef"):
        try:
            conv_nodes = await adapter.find_nodes(
                "Conversation",
                {"conversationId": memory["conversationRef"]["conversationId"]},
                1,
            )
            if conv_nodes:
                await adapter.create_edge(
                    GraphEdge(
                        type="REFERENCES",
                        from_node=node_id,
                        to_node=conv_nodes[0].id,  # type: ignore[arg-type]
                        properties={
                            "messageIds": memory["conversationRef"].get("messageIds", []),
                            "createdAt": memory.get("createdAt", now),
                        },
                    )
                )
        except Exception:
            pass

    # userId → RELATES_TO edge
    if memory.get("userId"):
        try:
            user_node_id = await ensure_user_node(memory["userId"], adapter)
            await adapter.create_edge(
                GraphEdge(
                    type="RELATES_TO",
                    from_node=node_id,
                    to_node=user_node_id,
                    properties={"createdAt": memory.get("createdAt", now)},
                )
            )
        except Exception:
            pass

    # agentId → RELATES_TO edge
    if memory.get("agentId"):
        try:
            agent_node_id = await ensure_agent_node(memory["agentId"], adapter)
            await adapter.create_edge(
                GraphEdge(
                    type="RELATES_TO",
                    from_node=node_id,
                    to_node=agent_node_id,
                    properties={"createdAt": memory.get("createdAt", now)},
                )
            )
        except Exception:
            pass

    # MemorySpace → IN_SPACE edge
    try:
        space_nodes = await adapter.find_nodes(
            "MemorySpace", {"memorySpaceId": memory["memorySpaceId"]}, 1
        )
        if space_nodes:
            await adapter.create_edge(
                GraphEdge(
                    type="IN_SPACE",
                    from_node=node_id,
                    to_node=space_nodes[0].id,  # type: ignore[arg-type]
                    properties={"createdAt": memory.get("createdAt", now)},
                )
            )
    except Exception:
        pass

    # immutableRef (Fact) → SOURCED_FROM edge
    if memory.get("immutableRef") and memory["immutableRef"].get("type") == "fact":
        try:
            fact_node_id = await find_graph_node_id(
                "Fact", memory["immutableRef"]["id"], adapter
            )
            if fact_node_id:
                await adapter.create_edge(
                    GraphEdge(
                        type="SOURCED_FROM",
                        from_node=node_id,
                        to_node=fact_node_id,
                        properties={
                            "version": memory["immutableRef"].get("version"),
                            "createdAt": memory.get("createdAt", now),
                        },
                    )
                )
        except Exception:
            pass

    # Participant relationship (Hive Mode)
    if memory.get("participantId"):
        try:
            participant_node_id = await ensure_participant_node(
                memory["participantId"], adapter
            )
            await adapter.create_edge(
                GraphEdge(
                    type="STORED_BY",
                    from_node=node_id,
                    to_node=participant_node_id,
                    properties={"createdAt": memory.get("createdAt", now)},
                )
            )
        except Exception:
            pass


async def delete_memory_from_graph(
    memory_id: str,
    adapter: GraphAdapter,
    enable_orphan_cleanup: bool = True,
) -> GraphDeleteResult:
    """
    Delete memory from graph with orphan cleanup.

    Deletes the memory node and checks if referenced Conversation becomes orphaned.

    Args:
        memory_id: Memory ID
        adapter: Graph database adapter
        enable_orphan_cleanup: Enable orphan detection

    Returns:
        Delete result with deleted nodes/edges
    """
    # Find memory node
    node_id = await find_graph_node_id("Memory", memory_id, adapter)
    if not node_id:
        return GraphDeleteResult(deleted_nodes=[], deleted_edges=[], orphan_islands=[])

    if not enable_orphan_cleanup:
        # Simple delete without orphan cleanup
        await adapter.delete_node(node_id, detach=True)
        return GraphDeleteResult(deleted_nodes=[node_id], deleted_edges=[], orphan_islands=[])

    # Delete with orphan cleanup
    deletion_context = create_deletion_context(f"Delete Memory {memory_id}", ORPHAN_RULES)
    result = await delete_with_orphan_cleanup(node_id, "Memory", deletion_context, adapter)

    # Convert orphan_islands from List[Dict] to List[List[str]]
    orphan_islands_list = [
        island.get("nodes", []) for island in result.orphan_islands
    ]

    return GraphDeleteResult(
        deleted_nodes=result.deleted_nodes,
        deleted_edges=result.deleted_edges,
        orphan_islands=orphan_islands_list,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Conversation to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_conversation_to_graph(
    conversation: Dict[str, Any], adapter: GraphAdapter
) -> str:
    """
    Sync conversation to graph.

    Uses MERGE for idempotent operations.

    Args:
        conversation: Conversation data
        adapter: Graph database adapter

    Returns:
        Node ID in graph
    """
    participants = conversation.get("participants", {})
    node = GraphNode(
        label="Conversation",
        properties={
            "conversationId": conversation["conversationId"],
            "memorySpaceId": conversation["memorySpaceId"],
            "participantId": conversation.get("participantId"),
            "type": conversation["type"],
            "userId": participants.get("userId"),
            "agentId": participants.get("agentId"),
            "messageCount": conversation["messageCount"],
            "createdAt": conversation["createdAt"],
            "updatedAt": conversation.get("updatedAt", conversation["createdAt"]),
        },
    )

    return await adapter.merge_node(
        node, {"conversationId": conversation["conversationId"]}
    )


async def sync_conversation_relationships(
    conversation: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """
    Sync conversation relationships.

    Creates:
    - IN_SPACE relationships to MemorySpace
    - INVOLVES relationships to User (if userId exists)
    - INVOLVES relationships to Agent (if agentId exists)
    - HAS_PARTICIPANT relationships to Participant (Hive Mode)

    Args:
        conversation: Conversation data
        node_id: Conversation node ID in graph
        adapter: Graph database adapter
    """
    now = int(time.time() * 1000)
    participants = conversation.get("participants", {})

    # MemorySpace relationship
    try:
        space_nodes = await adapter.find_nodes(
            "MemorySpace", {"memorySpaceId": conversation["memorySpaceId"]}, 1
        )
        if space_nodes:
            await adapter.create_edge(
                GraphEdge(
                    type="IN_SPACE",
                    from_node=node_id,
                    to_node=space_nodes[0].id,  # type: ignore[arg-type]
                    properties={"createdAt": conversation.get("createdAt", now)},
                )
            )
    except Exception:
        pass

    # User relationship
    if participants.get("userId"):
        try:
            user_node_id = await ensure_user_node(participants["userId"], adapter)
            await adapter.create_edge(
                GraphEdge(
                    type="INVOLVES",
                    from_node=node_id,
                    to_node=user_node_id,
                    properties={"createdAt": conversation.get("createdAt", now)},
                )
            )
        except Exception:
            pass

    # Agent relationship
    if participants.get("agentId"):
        try:
            agent_node_id = await ensure_agent_node(participants["agentId"], adapter)
            await adapter.create_edge(
                GraphEdge(
                    type="INVOLVES",
                    from_node=node_id,
                    to_node=agent_node_id,
                    properties={"createdAt": conversation.get("createdAt", now)},
                )
            )
        except Exception:
            pass

    # Participant relationship (Hive Mode)
    if conversation.get("participantId"):
        try:
            participant_node_id = await ensure_participant_node(
                conversation["participantId"], adapter
            )
            await adapter.create_edge(
                GraphEdge(
                    type="HAS_PARTICIPANT",
                    from_node=node_id,
                    to_node=participant_node_id,
                    properties={"createdAt": conversation.get("createdAt", now)},
                )
            )
        except Exception:
            pass


async def delete_conversation_from_graph(
    conversation_id: str,
    adapter: GraphAdapter,
    enable_orphan_cleanup: bool = True,
) -> GraphDeleteResult:
    """
    Delete conversation from graph.

    Args:
        conversation_id: Conversation ID
        adapter: Graph database adapter
        enable_orphan_cleanup: Enable orphan detection

    Returns:
        Delete result with deleted nodes/edges
    """
    node_id = await find_graph_node_id("Conversation", conversation_id, adapter)
    if not node_id:
        return GraphDeleteResult(deleted_nodes=[], deleted_edges=[], orphan_islands=[])

    if not enable_orphan_cleanup:
        await adapter.delete_node(node_id, detach=True)
        return GraphDeleteResult(deleted_nodes=[node_id], deleted_edges=[], orphan_islands=[])

    deletion_context = create_deletion_context(
        f"Delete Conversation {conversation_id}", ORPHAN_RULES
    )
    result = await delete_with_orphan_cleanup(
        node_id, "Conversation", deletion_context, adapter
    )

    # Convert orphan_islands from List[Dict] to List[List[str]]
    orphan_islands_list = [
        island.get("nodes", []) for island in result.orphan_islands
    ]

    return GraphDeleteResult(
        deleted_nodes=result.deleted_nodes,
        deleted_edges=result.deleted_edges,
        orphan_islands=orphan_islands_list,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Fact to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_fact_to_graph(fact: Dict[str, Any], adapter: GraphAdapter) -> str:
    """
    Sync fact to graph.

    Uses MERGE for idempotent operations.

    Args:
        fact: Fact data
        adapter: Graph database adapter

    Returns:
        Node ID in graph
    """
    node = GraphNode(
        label="Fact",
        properties={
            "factId": fact["factId"],
            "memorySpaceId": fact["memorySpaceId"],
            "participantId": fact.get("participantId"),
            "fact": fact["fact"],
            "factType": fact["factType"],
            "subject": fact.get("subject"),
            "predicate": fact.get("predicate"),
            "object": fact.get("object"),
            "confidence": fact["confidence"],
            "sourceType": fact.get("sourceType"),
            "tags": fact.get("tags", []),
            "version": fact.get("version", 1),
            "supersededBy": fact.get("supersededBy"),
            "supersedes": fact.get("supersedes"),
            "createdAt": fact["createdAt"],
            "updatedAt": fact.get("updatedAt", fact["createdAt"]),
        },
    )

    return await adapter.merge_node(node, {"factId": fact["factId"]})


async def sync_fact_relationships(
    fact: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """
    Sync fact relationships.

    Creates:
    - MENTIONS relationships to Entity nodes (for subject, object)
    - Entity nodes from enriched extraction (with types and fullValues)
    - Relationship edges from enriched relations array
    - EXTRACTED_FROM relationships to Conversation (if sourceRef exists)
    - IN_SPACE relationships to MemorySpace
    - SUPERSEDES / SUPERSEDED_BY relationships (fact versioning)
    - EXTRACTED_BY relationships to Participant (Hive Mode)

    Args:
        fact: Fact data
        node_id: Fact node ID in graph
        adapter: Graph database adapter
    """
    now = int(time.time() * 1000)
    entity_node_ids: Dict[str, str] = {}

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Sync enriched entities from bullet-proof extraction
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if fact.get("entities"):
        for entity in fact["entities"]:
            try:
                entity_node_id = await ensure_enriched_entity_node(
                    entity["name"],
                    entity["type"],
                    entity.get("fullValue"),
                    adapter,
                )
                entity_node_ids[entity["name"].lower()] = entity_node_id

                # Create MENTIONS relationship from Fact to Entity
                await adapter.create_edge(
                    GraphEdge(
                        type="MENTIONS",
                        from_node=node_id,
                        to_node=entity_node_id,
                        properties={
                            "role": entity["type"],
                            "fullValue": entity.get("fullValue"),
                            "createdAt": fact.get("createdAt", now),
                        },
                    )
                )
            except Exception:
                pass

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Sync enriched relations from bullet-proof extraction
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if fact.get("relations"):
        for relation in fact["relations"]:
            try:
                # Get or create subject and object entity nodes
                subject_key = relation["subject"].lower()
                if subject_key not in entity_node_ids:
                    entity_node_ids[subject_key] = await ensure_entity_node(
                        relation["subject"], "subject", adapter
                    )

                object_key = relation["object"].lower()
                if object_key not in entity_node_ids:
                    entity_node_ids[object_key] = await ensure_entity_node(
                        relation["object"], "object", adapter
                    )

                # Create relationship edge with predicate as type
                relationship_type = relation["predicate"].upper().replace(" ", "_")
                await adapter.create_edge(
                    GraphEdge(
                        type=relationship_type,
                        from_node=entity_node_ids[subject_key],
                        to_node=entity_node_ids[object_key],
                        properties={
                            "factId": fact["factId"],
                            "confidence": fact["confidence"],
                            "category": fact.get("category"),
                            "createdAt": fact.get("createdAt", now),
                        },
                    )
                )
            except Exception:
                pass

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Legacy: Create Entity nodes from subject/object fields (fallback)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if fact.get("subject") and fact["subject"].lower() not in entity_node_ids:
        try:
            subject_node_id = await ensure_entity_node(
                fact["subject"], "subject", adapter
            )
            await adapter.create_edge(
                GraphEdge(
                    type="MENTIONS",
                    from_node=node_id,
                    to_node=subject_node_id,
                    properties={
                        "role": "subject",
                        "createdAt": fact.get("createdAt", now),
                    },
                )
            )
        except Exception:
            pass

    if fact.get("object") and fact["object"].lower() not in entity_node_ids:
        try:
            object_node_id = await ensure_entity_node(
                fact["object"], "object", adapter
            )
            await adapter.create_edge(
                GraphEdge(
                    type="MENTIONS",
                    from_node=node_id,
                    to_node=object_node_id,
                    properties={
                        "role": "object",
                        "createdAt": fact.get("createdAt", now),
                    },
                )
            )
        except Exception:
            pass

    # If we have subject, object, predicate but no enriched relations, create typed relationship
    if (
        fact.get("subject")
        and fact.get("object")
        and fact.get("predicate")
        and not fact.get("relations")
    ):
        try:
            subject_nodes = await adapter.find_nodes(
                "Entity", {"name": fact["subject"]}, 1
            )
            object_nodes = await adapter.find_nodes(
                "Entity", {"name": fact["object"]}, 1
            )

            if subject_nodes and object_nodes:
                relationship_type = fact["predicate"].upper().replace(" ", "_")
                await adapter.create_edge(
                    GraphEdge(
                        type=relationship_type,
                        from_node=subject_nodes[0].id,  # type: ignore[arg-type]
                        to_node=object_nodes[0].id,  # type: ignore[arg-type]
                        properties={
                            "factId": fact["factId"],
                            "confidence": fact["confidence"],
                            "createdAt": fact.get("createdAt", now),
                        },
                    )
                )
        except Exception:
            pass

    # sourceRef → EXTRACTED_FROM edge
    source_ref = fact.get("sourceRef") or {}
    if source_ref.get("conversationId"):
        try:
            conv_node_id = await find_graph_node_id(
                "Conversation", source_ref["conversationId"], adapter
            )
            if conv_node_id:
                await adapter.create_edge(
                    GraphEdge(
                        type="EXTRACTED_FROM",
                        from_node=node_id,
                        to_node=conv_node_id,
                        properties={
                            "messageIds": source_ref.get("messageIds", []),
                            "createdAt": fact.get("createdAt", now),
                        },
                    )
                )
        except Exception:
            pass

    # MemorySpace → IN_SPACE edge
    try:
        space_node_id = await find_graph_node_id(
            "MemorySpace", fact["memorySpaceId"], adapter
        )
        if space_node_id:
            await adapter.create_edge(
                GraphEdge(
                    type="IN_SPACE",
                    from_node=node_id,
                    to_node=space_node_id,
                    properties={"createdAt": fact.get("createdAt", now)},
                )
            )
    except Exception:
        pass

    # Fact versioning relationships
    if fact.get("supersedes"):
        try:
            superseded_fact_node_id = await find_graph_node_id(
                "Fact", fact["supersedes"], adapter
            )
            if superseded_fact_node_id:
                await adapter.create_edge(
                    GraphEdge(
                        type="SUPERSEDES",
                        from_node=node_id,
                        to_node=superseded_fact_node_id,
                        properties={
                            "version": fact.get("version"),
                            "createdAt": fact.get("createdAt", now),
                        },
                    )
                )
        except Exception:
            pass

    # Participant relationship (Hive Mode)
    if fact.get("participantId"):
        try:
            participant_node_id = await ensure_participant_node(
                fact["participantId"], adapter
            )
            await adapter.create_edge(
                GraphEdge(
                    type="EXTRACTED_BY",
                    from_node=node_id,
                    to_node=participant_node_id,
                    properties={"createdAt": fact.get("createdAt", now)},
                )
            )
        except Exception:
            pass


async def delete_fact_from_graph(
    fact_id: str,
    adapter: GraphAdapter,
    enable_orphan_cleanup: bool = True,
) -> GraphDeleteResult:
    """
    Delete fact from graph with Entity orphan cleanup.

    Deletes the fact node and checks if mentioned Entities become orphaned.

    Args:
        fact_id: Fact ID
        adapter: Graph database adapter
        enable_orphan_cleanup: Enable orphan detection

    Returns:
        Delete result with deleted nodes/edges
    """
    node_id = await find_graph_node_id("Fact", fact_id, adapter)
    if not node_id:
        return GraphDeleteResult(deleted_nodes=[], deleted_edges=[], orphan_islands=[])

    if not enable_orphan_cleanup:
        await adapter.delete_node(node_id, detach=True)
        return GraphDeleteResult(deleted_nodes=[node_id], deleted_edges=[], orphan_islands=[])

    deletion_context = create_deletion_context(f"Delete Fact {fact_id}", ORPHAN_RULES)
    result = await delete_with_orphan_cleanup(node_id, "Fact", deletion_context, adapter)

    # Convert orphan_islands from List[Dict] to List[List[str]]
    orphan_islands_list = [
        island.get("nodes", []) for island in result.orphan_islands
    ]

    return GraphDeleteResult(
        deleted_nodes=result.deleted_nodes,
        deleted_edges=result.deleted_edges,
        orphan_islands=orphan_islands_list,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Context to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_context_to_graph(context: Dict[str, Any], adapter: GraphAdapter) -> str:
    """
    Sync context to graph.

    Uses MERGE for idempotent operations.

    Args:
        context: Context data
        adapter: Graph database adapter

    Returns:
        Node ID in graph
    """
    # Handle both 'id' and 'contextId' field names
    context_id = context.get("contextId") or context.get("id")
    node = GraphNode(
        label="Context",
        properties={
            "contextId": context_id,
            "memorySpaceId": context["memorySpaceId"],
            "purpose": context["purpose"],
            "status": context["status"],
            "depth": context["depth"],
            "userId": context.get("userId"),
            "parentId": context.get("parentId"),
            "rootId": context.get("rootId"),
            "participants": context.get("participants", []),
            "createdAt": context["createdAt"],
            "updatedAt": context.get("updatedAt", context["createdAt"]),
            "completedAt": context.get("completedAt"),
        },
    )

    return await adapter.merge_node(node, {"contextId": context_id})


async def sync_context_relationships(
    context: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """
    Sync context relationships.

    Creates:
    - PARENT_OF / CHILD_OF relationships
    - INVOLVES relationships to User
    - IN_SPACE relationships to MemorySpace
    - TRIGGERED_BY relationships to Conversation (if conversationRef exists)
    - GRANTS_ACCESS_TO relationships (Collaboration Mode)

    Args:
        context: Context data
        node_id: Context node ID in graph
        adapter: Graph database adapter
    """
    now = int(time.time() * 1000)

    # Parent-child relationships
    if context.get("parentId"):
        try:
            parent_node_id = await find_graph_node_id(
                "Context", context["parentId"], adapter
            )
            if parent_node_id:
                await adapter.create_edge(
                    GraphEdge(
                        type="CHILD_OF",
                        from_node=node_id,
                        to_node=parent_node_id,
                        properties={
                            "depth": context["depth"],
                            "createdAt": context.get("createdAt", now),
                        },
                    )
                )
        except Exception:
            pass

    # User relationship
    if context.get("userId"):
        try:
            user_node_id = await ensure_user_node(context["userId"], adapter)
            await adapter.create_edge(
                GraphEdge(
                    type="INVOLVES",
                    from_node=node_id,
                    to_node=user_node_id,
                    properties={"createdAt": context.get("createdAt", now)},
                )
            )
        except Exception:
            pass

    # MemorySpace relationship
    try:
        space_node_id = await find_graph_node_id(
            "MemorySpace", context["memorySpaceId"], adapter
        )
        if space_node_id:
            await adapter.create_edge(
                GraphEdge(
                    type="IN_SPACE",
                    from_node=node_id,
                    to_node=space_node_id,
                    properties={"createdAt": context.get("createdAt", now)},
                )
            )
    except Exception:
        pass

    # Conversation relationship
    if context.get("conversationRef"):
        try:
            conv_node_id = await find_graph_node_id(
                "Conversation",
                context["conversationRef"]["conversationId"],
                adapter,
            )
            if conv_node_id:
                await adapter.create_edge(
                    GraphEdge(
                        type="TRIGGERED_BY",
                        from_node=node_id,
                        to_node=conv_node_id,
                        properties={
                            "messageIds": context["conversationRef"].get("messageIds", []),
                            "createdAt": context.get("createdAt", now),
                        },
                    )
                )
        except Exception:
            pass

    # Grant access relationships (Collaboration Mode)
    if context.get("grantedAccess"):
        for grant in context["grantedAccess"]:
            try:
                granted_space_node_id = await find_graph_node_id(
                    "MemorySpace", grant["memorySpaceId"], adapter
                )
                if granted_space_node_id:
                    await adapter.create_edge(
                        GraphEdge(
                            type="GRANTS_ACCESS_TO",
                            from_node=node_id,
                            to_node=granted_space_node_id,
                            properties={
                                "scope": grant.get("scope"),
                                "grantedAt": grant.get("grantedAt"),
                            },
                        )
                    )
            except Exception:
                pass


async def delete_context_from_graph(
    context_id: str,
    adapter: GraphAdapter,
    enable_orphan_cleanup: bool = True,
) -> GraphDeleteResult:
    """
    Delete context from graph with relationship cleanup.

    Deletes the context node and checks if referenced Conversation becomes orphaned.

    Args:
        context_id: Context ID
        adapter: Graph database adapter
        enable_orphan_cleanup: Enable orphan detection

    Returns:
        Delete result with deleted nodes/edges
    """
    node_id = await find_graph_node_id("Context", context_id, adapter)
    if not node_id:
        return GraphDeleteResult(deleted_nodes=[], deleted_edges=[], orphan_islands=[])

    if not enable_orphan_cleanup:
        await adapter.delete_node(node_id, detach=True)
        return GraphDeleteResult(deleted_nodes=[node_id], deleted_edges=[], orphan_islands=[])

    deletion_context = create_deletion_context(
        f"Delete Context {context_id}", ORPHAN_RULES
    )
    result = await delete_with_orphan_cleanup(
        node_id, "Context", deletion_context, adapter
    )

    # Convert orphan_islands from List[Dict] to List[List[str]]
    orphan_islands_list = [
        island.get("nodes", []) for island in result.orphan_islands
    ]

    return GraphDeleteResult(
        deleted_nodes=result.deleted_nodes,
        deleted_edges=result.deleted_edges,
        orphan_islands=orphan_islands_list,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - MemorySpace to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_memory_space_to_graph(
    memory_space: Dict[str, Any], adapter: GraphAdapter
) -> str:
    """
    Sync memory space to graph.

    Uses MERGE for idempotent operations.

    Args:
        memory_space: Memory space data
        adapter: Graph database adapter

    Returns:
        Node ID in graph
    """
    participants = memory_space.get("participants", [])
    node = GraphNode(
        label="MemorySpace",
        properties={
            "memorySpaceId": memory_space["memorySpaceId"],
            "name": memory_space.get("name"),
            "type": memory_space["type"],
            "status": memory_space["status"],
            "participantCount": len(participants),
            "createdAt": memory_space["createdAt"],
            "updatedAt": memory_space.get("updatedAt", memory_space["createdAt"]),
        },
    )

    return await adapter.merge_node(
        node, {"memorySpaceId": memory_space["memorySpaceId"]}
    )


async def delete_memory_space_from_graph(
    memory_space_id: str,
    adapter: GraphAdapter,
) -> GraphDeleteResult:
    """
    Delete a Memory Space from graph (careful - usually explicit only).

    WARNING: Deleting a memory space should be rare!
    This does NOT cascade to memories/contexts in that space.

    Args:
        memory_space_id: Memory space ID
        adapter: Graph database adapter

    Returns:
        Delete result with deleted nodes/edges
    """
    node_id = await find_graph_node_id("MemorySpace", memory_space_id, adapter)
    if not node_id:
        return GraphDeleteResult(deleted_nodes=[], deleted_edges=[], orphan_islands=[])

    # Simple delete (no cascade - MemorySpace is neverDelete rule)
    await adapter.delete_node(node_id, detach=True)
    return GraphDeleteResult(deleted_nodes=[node_id], deleted_edges=[], orphan_islands=[])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - User/Agent Deletion
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def delete_user_from_graph(user_id: str, adapter: GraphAdapter) -> int:
    """
    Delete all graph nodes for a user.

    Args:
        user_id: User ID
        adapter: Graph database adapter

    Returns:
        Number of nodes deleted
    """
    user_nodes = await adapter.find_nodes("User", {"userId": user_id}, 1)
    nodes_deleted = 0

    if user_nodes:
        await adapter.delete_node(user_nodes[0].id, detach=True)  # type: ignore[arg-type]
        nodes_deleted += 1

    return nodes_deleted


async def delete_agent_from_graph(agent_id: str, adapter: GraphAdapter) -> int:
    """
    Delete all graph nodes for an agent.

    Deletes:
    - Agent node itself (agentId match)
    - All nodes with participantId = agent_id
    - All relationships connected to deleted nodes

    Args:
        agent_id: Agent ID (participantId)
        adapter: Graph database adapter

    Returns:
        Number of nodes deleted
    """
    nodes_deleted = 0

    # 1. Delete Agent node by agentId
    agent_nodes = await adapter.find_nodes("Agent", {"agentId": agent_id}, 1)
    if agent_nodes:
        await adapter.delete_node(agent_nodes[0].id, detach=True)  # type: ignore[arg-type]
        nodes_deleted += 1

    # 2. Delete all nodes where participantId matches
    try:
        result = await adapter.query(
            "MATCH (n {participantId: $participantId}) RETURN elementId(n) as id",
            {"participantId": agent_id},
        )
        for record in result.records:
            node_id = record.get("id")
            if node_id:
                try:
                    await adapter.delete_node(node_id, detach=True)
                    nodes_deleted += 1
                except Exception:
                    pass
    except Exception:
        pass

    # 3. Delete nodes where agentId matches
    try:
        result = await adapter.query(
            "MATCH (n {agentId: $agentId}) RETURN elementId(n) as id",
            {"agentId": agent_id},
        )
        for record in result.records:
            node_id = record.get("id")
            if node_id:
                try:
                    await adapter.delete_node(node_id, detach=True)
                    nodes_deleted += 1
                except Exception:
                    pass
    except Exception:
        pass

    return nodes_deleted


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Immutable/Mutable Deletion
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def delete_immutable_from_graph(
    immutable_type: str,
    immutable_id: str,
    adapter: GraphAdapter,
    enable_orphan_cleanup: bool = True,
) -> GraphDeleteResult:
    """
    Delete an Immutable record from graph.

    Args:
        immutable_type: Immutable type
        immutable_id: Immutable ID
        adapter: Graph database adapter
        enable_orphan_cleanup: Enable orphan detection

    Returns:
        Delete result with deleted nodes/edges
    """
    # For facts, use the dedicated fact delete
    if immutable_type == "fact":
        return await delete_fact_from_graph(immutable_id, adapter, enable_orphan_cleanup)

    # Generic immutable delete (no specific orphan rules)
    nodes = await adapter.find_nodes(
        "Immutable", {"immutableId": immutable_id, "type": immutable_type}, 1
    )

    if not nodes:
        return GraphDeleteResult(deleted_nodes=[], deleted_edges=[], orphan_islands=[])

    await adapter.delete_node(nodes[0].id, detach=True)  # type: ignore[arg-type]
    return GraphDeleteResult(
        deleted_nodes=[nodes[0].id],  # type: ignore[list-item]
        deleted_edges=[],
        orphan_islands=[],
    )


async def delete_mutable_from_graph(
    namespace: str,
    key: str,
    adapter: GraphAdapter,
) -> GraphDeleteResult:
    """
    Delete a Mutable record from graph.

    Args:
        namespace: Mutable namespace
        key: Mutable key
        adapter: Graph database adapter

    Returns:
        Delete result with deleted nodes/edges
    """
    nodes = await adapter.find_nodes("Mutable", {"namespace": namespace, "key": key}, 1)

    if not nodes:
        return GraphDeleteResult(deleted_nodes=[], deleted_edges=[], orphan_islands=[])

    await adapter.delete_node(nodes[0].id, detach=True)  # type: ignore[arg-type]
    return GraphDeleteResult(
        deleted_nodes=[nodes[0].id],  # type: ignore[list-item]
        deleted_edges=[],
        orphan_islands=[],
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - A2A Relationships
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_a2a_relationships(
    memory: Dict[str, Any],
    adapter: GraphAdapter,
) -> None:
    """
    Sync A2A (Agent-to-Agent) communication relationships.

    Creates SENT_TO relationships between memory spaces for A2A memories.

    Args:
        memory: Memory entry with A2A metadata
        adapter: Graph database adapter
    """
    # Only process A2A memories
    if memory.get("sourceType") != "a2a":
        return

    # Extract A2A metadata
    to_memory_space = memory.get("toMemorySpace")
    from_memory_space = memory.get("fromMemorySpace")

    if not to_memory_space or not from_memory_space:
        return

    # Find memory space nodes
    from_node_id = await find_graph_node_id("MemorySpace", from_memory_space, adapter)
    to_node_id = await find_graph_node_id("MemorySpace", to_memory_space, adapter)

    if not from_node_id or not to_node_id:
        return

    # Create SENT_TO relationship
    try:
        await adapter.create_edge(
            GraphEdge(
                type="SENT_TO",
                from_node=from_node_id,
                to_node=to_node_id,
                properties={
                    "messageId": memory.get("messageId") or memory.get("memoryId"),
                    "importance": memory.get("importance"),
                    "timestamp": memory.get("sourceTimestamp"),
                    "memoryId": memory.get("memoryId"),
                },
            )
        )
    except Exception:
        pass


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Exports
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

__all__ = [
    # Error classes
    "GraphDatabaseError",
    "GraphConnectionError",
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
