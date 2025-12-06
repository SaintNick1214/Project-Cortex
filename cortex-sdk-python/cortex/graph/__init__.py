"""
Cortex SDK - Graph Database Integration

Graph database integration for advanced relationship queries and knowledge graphs.
"""

from typing import Any, Dict

from ..types import GraphAdapter, GraphEdge, GraphNode

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
            "content": memory["content"][:200],  # Truncate for graph
            "importance": memory["importance"],
            "sourceType": memory["sourceType"],
            "tags": memory.get("tags", []),
            "createdAt": memory["createdAt"],
        },
    )

    return await adapter.merge_node(node, {"memoryId": memory["memoryId"]})


async def sync_memory_relationships(
    memory: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """
    Sync memory relationships to graph.

    Args:
        memory: Memory entry
        node_id: Memory node ID in graph
        adapter: Graph database adapter
    """
    # Create relationship to memory space
    try:
        space_nodes = await adapter.find_nodes(
            "MemorySpace", {"memorySpaceId": memory["memorySpaceId"]}, 1
        )
        if space_nodes:
            await adapter.create_edge(
                GraphEdge(type="IN_SPACE", from_node=node_id, to_node=space_nodes[0].id)  # type: ignore[arg-type]
            )
    except:
        pass

    # Create relationship to conversation if exists
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
                            "messageIds": memory["conversationRef"].get("messageIds", [])
                        },
                    )
                )
        except:
            pass

    # Create relationship to user if exists
    if memory.get("userId"):
        try:
            user_nodes = await adapter.find_nodes(
                "User", {"userId": memory["userId"]}, 1
            )
            if user_nodes:
                await adapter.create_edge(
                    GraphEdge(type="INVOLVES", from_node=node_id, to_node=user_nodes[0].id)  # type: ignore[arg-type]
                )
        except:
            pass


async def delete_memory_from_graph(
    memory_id: str, memory_space_id: str, adapter: GraphAdapter, orphan_cleanup: bool = True
) -> None:
    """
    Delete memory from graph with orphan cleanup.

    Args:
        memory_id: Memory ID
        memory_space_id: Memory space ID
        adapter: Graph database adapter
        orphan_cleanup: Enable orphan detection
    """
    nodes = await adapter.find_nodes("Memory", {"memoryId": memory_id}, 1)
    if nodes:
        await adapter.delete_node(nodes[0].id)  # type: ignore[arg-type]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Conversation to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_conversation_to_graph(
    conversation: Dict[str, Any], adapter: GraphAdapter
) -> str:
    """Sync conversation to graph. Uses MERGE for idempotent operations."""
    node = GraphNode(
        label="Conversation",
        properties={
            "conversationId": conversation["conversationId"],
            "memorySpaceId": conversation["memorySpaceId"],
            "type": conversation["type"],
            "messageCount": conversation["messageCount"],
            "createdAt": conversation["createdAt"],
        },
    )

    return await adapter.merge_node(
        node, {"conversationId": conversation["conversationId"]}
    )


async def sync_conversation_relationships(
    conversation: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """Sync conversation relationships."""
    # Create relationship to memory space
    try:
        space_nodes = await adapter.find_nodes(
            "MemorySpace", {"memorySpaceId": conversation["memorySpaceId"]}, 1
        )
        if space_nodes:
            await adapter.create_edge(
                GraphEdge(type="IN_SPACE", from_node=node_id, to_node=space_nodes[0].id)  # type: ignore[arg-type]
            )
    except:
        pass


async def delete_conversation_from_graph(
    conversation_id: str, adapter: GraphAdapter, orphan_cleanup: bool = True
) -> None:
    """Delete conversation from graph."""
    nodes = await adapter.find_nodes(
        "Conversation", {"conversationId": conversation_id}, 1
    )
    if nodes:
        await adapter.delete_node(nodes[0].id)  # type: ignore[arg-type]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Fact to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_fact_to_graph(fact: Dict[str, Any], adapter: GraphAdapter) -> str:
    """Sync fact to graph. Uses MERGE for idempotent operations."""
    node = GraphNode(
        label="Fact",
        properties={
            "factId": fact["factId"],
            "memorySpaceId": fact["memorySpaceId"],
            "fact": fact["fact"],
            "factType": fact["factType"],
            "subject": fact.get("subject"),
            "predicate": fact.get("predicate"),
            "object": fact.get("object"),
            "confidence": fact["confidence"],
            "createdAt": fact["createdAt"],
        },
    )

    return await adapter.merge_node(node, {"factId": fact["factId"]})


async def sync_fact_relationships(
    fact: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """Sync fact relationships."""
    # Create EXTRACTED_FROM relationship to conversation
    if fact.get("sourceRef", {}).get("conversationId"):
        try:
            conv_nodes = await adapter.find_nodes(
                "Conversation",
                {"conversationId": fact["sourceRef"]["conversationId"]},
                1,
            )
            if conv_nodes:
                await adapter.create_edge(
                    GraphEdge(
                        type="EXTRACTED_FROM", from_node=node_id, to_node=conv_nodes[0].id  # type: ignore[arg-type]
                    )
                )
        except:
            pass


async def delete_fact_from_graph(fact_id: str, adapter: GraphAdapter) -> None:
    """Delete fact from graph."""
    nodes = await adapter.find_nodes("Fact", {"factId": fact_id}, 1)
    if nodes:
        await adapter.delete_node(nodes[0].id)  # type: ignore[arg-type]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Sync Functions - Context to Graph
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def sync_context_to_graph(context: Dict[str, Any], adapter: GraphAdapter) -> str:
    """Sync context to graph. Uses MERGE for idempotent operations."""
    node = GraphNode(
        label="Context",
        properties={
            "contextId": context["id"],
            "memorySpaceId": context["memorySpaceId"],
            "purpose": context["purpose"],
            "status": context["status"],
            "depth": context["depth"],
            "parentId": context.get("parentId"),
            "rootId": context["rootId"],
            "createdAt": context["createdAt"],
        },
    )

    return await adapter.merge_node(node, {"contextId": context["id"]})


async def sync_context_relationships(
    context: Dict[str, Any], node_id: str, adapter: GraphAdapter
) -> None:
    """Sync context relationships."""
    # Create CHILD_OF relationship if has parent
    if context.get("parentId"):
        try:
            parent_nodes = await adapter.find_nodes(
                "Context", {"contextId": context["parentId"]}, 1
            )
            if parent_nodes:
                await adapter.create_edge(
                    GraphEdge(type="CHILD_OF", from_node=node_id, to_node=parent_nodes[0].id)  # type: ignore[arg-type]
                )
        except:
            pass


async def delete_context_from_graph(
    context_id: str, adapter: GraphAdapter, orphan_cleanup: bool = True
) -> None:
    """Delete context from graph."""
    nodes = await adapter.find_nodes("Context", {"contextId": context_id}, 1)
    if nodes:
        await adapter.delete_node(nodes[0].id)  # type: ignore[arg-type]


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
    # Find and delete user node
    user_nodes = await adapter.find_nodes("User", {"userId": user_id}, 1)
    nodes_deleted = 0

    if user_nodes:
        await adapter.delete_node(user_nodes[0].id)  # type: ignore[arg-type]
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
        await adapter.delete_node(agent_nodes[0].id)  # type: ignore[arg-type]
        nodes_deleted += 1

    # 2. Delete all nodes where participantId matches (memories, conversations, etc.)
    # Query for nodes with participantId = agent_id across all labels
    try:
        result = await adapter.query(
            "MATCH (n {participantId: $participantId}) RETURN elementId(n) as id",
            {"participantId": agent_id},
        )
        records = result.records if result else []
        for record in records:
            node_id = record.get("id")
            if node_id:
                try:
                    await adapter.delete_node(node_id)
                    nodes_deleted += 1
                except Exception:
                    pass  # Node may have already been deleted via cascade
    except Exception:
        pass  # Query not supported or no matches

    # 3. Delete nodes where agentId matches (conversations, memories owned by agent)
    try:
        result = await adapter.query(
            "MATCH (n {agentId: $agentId}) RETURN elementId(n) as id",
            {"agentId": agent_id},
        )
        records = result.records if result else []
        for record in records:
            node_id = record.get("id")
            if node_id:
                try:
                    await adapter.delete_node(node_id)
                    nodes_deleted += 1
                except Exception:
                    pass  # Node may have already been deleted
    except Exception:
        pass  # Query not supported or no matches

    return nodes_deleted


async def sync_memory_space_to_graph(
    memory_space: Dict[str, Any], adapter: GraphAdapter
) -> str:
    """Sync memory space to graph. Uses MERGE for idempotent operations."""
    node = GraphNode(
        label="MemorySpace",
        properties={
            "memorySpaceId": memory_space["memorySpaceId"],
            "name": memory_space.get("name"),
            "type": memory_space["type"],
            "status": memory_space["status"],
            "createdAt": memory_space["createdAt"],
        },
    )

    return await adapter.merge_node(
        node, {"memorySpaceId": memory_space["memorySpaceId"]}
    )


# Re-export for convenience
__all__ = [
    "sync_memory_to_graph",
    "sync_memory_relationships",
    "delete_memory_from_graph",
    "sync_conversation_to_graph",
    "sync_conversation_relationships",
    "delete_conversation_from_graph",
    "sync_fact_to_graph",
    "sync_fact_relationships",
    "delete_fact_from_graph",
    "sync_context_to_graph",
    "sync_context_relationships",
    "delete_context_from_graph",
    "delete_user_from_graph",
    "delete_agent_from_graph",
    "sync_memory_space_to_graph",
]

