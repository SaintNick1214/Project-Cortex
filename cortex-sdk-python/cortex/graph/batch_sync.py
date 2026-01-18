"""
Cortex SDK - Graph Batch Sync

Functions for initial bulk sync of Cortex data to graph database.
"""

import time
from dataclasses import asdict
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional

from ..types import (
    BatchSyncError,
    BatchSyncLimits,
    BatchSyncOptions,
    BatchSyncResult,
    BatchSyncStats,
    GraphAdapter,
    ListMemorySpacesFilter,
    ListUsersFilter,
)
from . import (
    sync_a2a_relationships,
    sync_context_relationships,
    sync_context_to_graph,
    sync_conversation_relationships,
    sync_conversation_to_graph,
    sync_fact_relationships,
    sync_fact_to_graph,
    sync_memory_relationships,
    sync_memory_space_to_graph,
    sync_memory_to_graph,
)

if TYPE_CHECKING:
    from ..client import Cortex


async def initial_graph_sync(
    cortex: "Cortex",
    adapter: GraphAdapter,
    options: Optional[BatchSyncOptions] = None,
) -> BatchSyncResult:
    """
    Perform initial graph sync from Cortex.

    Syncs all existing Cortex data to the graph database.
    This should be run once after setting up a new graph database.

    Args:
        cortex: Cortex client instance
        adapter: Graph database adapter
        options: Batch sync options

    Returns:
        Batch sync result with statistics

    Example:
        >>> from cortex.graph.adapters import CypherGraphAdapter
        >>>
        >>> adapter = CypherGraphAdapter()
        >>> await adapter.connect(GraphConnectionConfig(
        ...     uri='bolt://localhost:7687',
        ...     username='neo4j',
        ...     password='password'
        ... ))
        >>>
        >>> result = await initial_graph_sync(cortex, adapter, BatchSyncOptions(
        ...     on_progress=lambda entity, current, total: print(f"Syncing {entity}: {current}/{total}")
        ... ))
        >>>
        >>> print(f"Sync complete: {result.memories.synced} memories synced")
    """
    start_time = int(time.time() * 1000)
    opts = options or BatchSyncOptions()
    limits = opts.limits or BatchSyncLimits()

    result = BatchSyncResult()
    sync_rels = opts.sync_relationships

    try:
        # Phase 1: Sync Memory Spaces
        print("📦 Phase 1: Syncing Memory Spaces...")
        memory_spaces_result = await _sync_memory_spaces(
            cortex, adapter, limits.memory_spaces, opts.on_progress
        )
        result.memory_spaces = memory_spaces_result["stats"]
        result.errors.extend(memory_spaces_result["errors"])

        # Phase 2: Sync Contexts
        print("📦 Phase 2: Syncing Contexts...")
        contexts_result = await _sync_contexts(
            cortex, adapter, sync_rels, limits.contexts, opts.on_progress
        )
        result.contexts = contexts_result["stats"]
        result.errors.extend(contexts_result["errors"])

        # Phase 3: Sync Conversations
        print("📦 Phase 3: Syncing Conversations...")
        conversations_result = await _sync_conversations(
            cortex, adapter, sync_rels, limits.conversations, opts.on_progress
        )
        result.conversations = conversations_result["stats"]
        result.errors.extend(conversations_result["errors"])

        # Phase 4: Sync Memories
        print("📦 Phase 4: Syncing Memories...")
        memories_result = await _sync_memories(
            cortex, adapter, sync_rels, limits.memories, opts.on_progress
        )
        result.memories = memories_result["stats"]
        result.errors.extend(memories_result["errors"])

        # Phase 5: Sync Facts
        print("📦 Phase 5: Syncing Facts...")
        facts_result = await _sync_facts(
            cortex, adapter, sync_rels, limits.facts, opts.on_progress
        )
        result.facts = facts_result["stats"]
        result.errors.extend(facts_result["errors"])

        # Phase 6: Sync Users
        print("📦 Phase 6: Syncing Users...")
        users_result = await _sync_users(cortex, adapter, limits.users, opts.on_progress)
        result.users = users_result["stats"]
        result.errors.extend(users_result["errors"])

        # Phase 7: Sync Agents
        print("📦 Phase 7: Syncing Agents...")
        agents_result = await _sync_agents(cortex, adapter, limits.agents, opts.on_progress)
        result.agents = agents_result["stats"]
        result.errors.extend(agents_result["errors"])

        print("✅ Initial graph sync complete!")

    except Exception as e:
        print(f"❌ Batch sync failed: {e}")
        raise

    result.duration = int(time.time() * 1000) - start_time
    return result


# ============================================================================
# Internal Sync Functions
# ============================================================================


async def _sync_memory_spaces(
    cortex: "Cortex",
    adapter: GraphAdapter,
    limit: int,
    on_progress: Optional[Callable[[str, int, int], None]],
) -> Dict[str, Any]:
    """Sync memory spaces to graph."""
    stats = BatchSyncStats()
    errors: List[BatchSyncError] = []

    try:
        # List all memory spaces (API max limit is 1000)
        effective_limit = min(limit, 1000)
        memory_spaces_result = await cortex.memory_spaces.list(
            ListMemorySpacesFilter(limit=effective_limit)
        )
        memory_spaces = memory_spaces_result.spaces

        for i, memory_space in enumerate(memory_spaces):
            try:
                # Convert dataclass to dict for sync function
                memory_space_dict = asdict(memory_space)
                await sync_memory_space_to_graph(memory_space_dict, adapter)
                stats.synced += 1

                if on_progress:
                    on_progress("MemorySpaces", i + 1, len(memory_spaces))
            except Exception as e:
                stats.failed += 1
                errors.append(BatchSyncError(
                    entity_type="MemorySpace",
                    entity_id=memory_space.memory_space_id,
                    error=str(e),
                ))

    except Exception as e:
        print(f"Failed to list memory spaces: {e}")

    return {"stats": stats, "errors": errors}


async def _sync_contexts(
    cortex: "Cortex",
    adapter: GraphAdapter,
    sync_rels: bool,
    limit: int,
    on_progress: Optional[Callable[[str, int, int], None]],
) -> Dict[str, Any]:
    """Sync contexts to graph."""
    stats = BatchSyncStats()
    errors: List[BatchSyncError] = []

    try:
        # List all contexts (API max limit is 1000)
        effective_limit = min(limit, 1000)
        contexts = await cortex.contexts.list(limit=effective_limit)

        for i, context in enumerate(contexts):
            try:
                # Convert dataclass to dict for sync function
                context_dict = asdict(context)
                # Sync node
                node_id = await sync_context_to_graph(context_dict, adapter)
                stats.synced += 1

                # Sync relationships
                if sync_rels:
                    await sync_context_relationships(context_dict, node_id, adapter)

                if on_progress:
                    on_progress("Contexts", i + 1, len(contexts))
            except Exception as e:
                stats.failed += 1
                context_id = context.context_id if hasattr(context, 'context_id') else str(context)
                errors.append(BatchSyncError(
                    entity_type="Context",
                    entity_id=context_id,
                    error=str(e),
                ))

    except Exception as e:
        print(f"Failed to list contexts: {e}")

    return {"stats": stats, "errors": errors}


async def _sync_conversations(
    cortex: "Cortex",
    adapter: GraphAdapter,
    sync_rels: bool,
    limit: int,
    on_progress: Optional[Callable[[str, int, int], None]],
) -> Dict[str, Any]:
    """Sync conversations to graph."""
    stats = BatchSyncStats()
    errors: List[BatchSyncError] = []

    try:
        # List all conversations (API limit is 1000)
        from ..types import ListConversationsFilter
        conversations_result = await cortex.conversations.list(
            ListConversationsFilter(limit=min(limit, 1000))
        )
        conversations = conversations_result.conversations

        for i, conversation in enumerate(conversations):
            try:
                # Convert dataclass to dict for sync function
                conversation_dict = asdict(conversation)
                # Sync node
                node_id = await sync_conversation_to_graph(conversation_dict, adapter)
                stats.synced += 1

                # Sync relationships
                if sync_rels:
                    await sync_conversation_relationships(conversation_dict, node_id, adapter)

                if on_progress:
                    on_progress("Conversations", i + 1, len(conversations))
            except Exception as e:
                stats.failed += 1
                conv_id = conversation.conversation_id if hasattr(conversation, 'conversation_id') else str(conversation)
                errors.append(BatchSyncError(
                    entity_type="Conversation",
                    entity_id=conv_id,
                    error=str(e),
                ))

    except Exception as e:
        print(f"Failed to list conversations: {e}")

    return {"stats": stats, "errors": errors}


async def _sync_memories(
    cortex: "Cortex",
    adapter: GraphAdapter,
    sync_rels: bool,
    limit: int,
    on_progress: Optional[Callable[[str, int, int], None]],
) -> Dict[str, Any]:
    """Sync memories to graph."""
    stats = BatchSyncStats()
    errors: List[BatchSyncError] = []

    try:
        # Get all memory spaces to list memories
        memory_spaces_result = await cortex.memory_spaces.list(
            ListMemorySpacesFilter(limit=1000)
        )
        memory_spaces = memory_spaces_result.spaces

        processed_count = 0
        limit_per_space = limit // max(len(memory_spaces), 1)

        for memory_space in memory_spaces:
            if processed_count >= limit:
                break

            try:
                # List memories for this memory space
                memories = await cortex.vector.list(
                    memory_space.memory_space_id,
                    limit=limit_per_space,
                )

                for memory in memories:
                    if processed_count >= limit:
                        break

                    try:
                        # Convert dataclass to dict for sync function
                        memory_dict = asdict(memory)
                        # Sync node
                        node_id = await sync_memory_to_graph(memory_dict, adapter)
                        stats.synced += 1

                        # Sync relationships
                        if sync_rels:
                            await sync_memory_relationships(memory_dict, node_id, adapter)

                            # Check for A2A relationships
                            if memory.source_type == "a2a":
                                await sync_a2a_relationships(memory_dict, adapter)

                        processed_count += 1

                        if on_progress:
                            on_progress("Memories", processed_count, limit)
                    except Exception as e:
                        stats.failed += 1
                        errors.append(BatchSyncError(
                            entity_type="Memory",
                            entity_id=memory.memory_id,
                            error=str(e),
                        ))

            except Exception as e:
                print(f"Failed to list memories for space {memory_space.memory_space_id}: {e}")

    except Exception as e:
        print(f"Failed to sync memories: {e}")

    return {"stats": stats, "errors": errors}


async def _sync_facts(
    cortex: "Cortex",
    adapter: GraphAdapter,
    sync_rels: bool,
    limit: int,
    on_progress: Optional[Callable[[str, int, int], None]],
) -> Dict[str, Any]:
    """Sync facts to graph."""
    stats = BatchSyncStats()
    errors: List[BatchSyncError] = []

    try:
        # Get all memory spaces to list facts
        memory_spaces_result = await cortex.memory_spaces.list(
            ListMemorySpacesFilter(limit=1000)
        )
        memory_spaces = memory_spaces_result.spaces

        processed_count = 0
        limit_per_space = limit // max(len(memory_spaces), 1)

        for memory_space in memory_spaces:
            if processed_count >= limit:
                break

            try:
                # List facts for this memory space
                from ..types import ListFactsFilter
                facts = await cortex.facts.list(ListFactsFilter(
                    memory_space_id=memory_space.memory_space_id,
                    limit=limit_per_space,
                ))

                for fact in facts:
                    if processed_count >= limit:
                        break

                    try:
                        # Convert dataclass to dict for sync function
                        fact_dict = asdict(fact)
                        # Sync node
                        node_id = await sync_fact_to_graph(fact_dict, adapter)
                        stats.synced += 1

                        # Sync relationships
                        if sync_rels:
                            await sync_fact_relationships(fact_dict, node_id, adapter)

                        processed_count += 1

                        if on_progress:
                            on_progress("Facts", processed_count, limit)
                    except Exception as e:
                        stats.failed += 1
                        errors.append(BatchSyncError(
                            entity_type="Fact",
                            entity_id=fact.fact_id,
                            error=str(e),
                        ))

            except Exception as e:
                print(f"Failed to list facts for space {memory_space.memory_space_id}: {e}")

    except Exception as e:
        print(f"Failed to sync facts: {e}")

    return {"stats": stats, "errors": errors}


async def _sync_users(
    cortex: "Cortex",
    adapter: GraphAdapter,
    limit: int,
    on_progress: Optional[Callable[[str, int, int], None]],
) -> Dict[str, Any]:
    """Sync users to graph."""
    stats = BatchSyncStats()
    errors: List[BatchSyncError] = []

    try:
        # List all users
        users_result = await cortex.users.list(ListUsersFilter(limit=limit))
        users = users_result.users if hasattr(users_result, 'users') else []

        for i, user in enumerate(users):
            try:
                # Sync user node
                from . import ensure_user_node
                # Access user_id attribute from UserProfile dataclass
                user_id = user.user_id if hasattr(user, 'user_id') else str(user)
                await ensure_user_node(user_id, adapter)
                stats.synced += 1

                if on_progress:
                    on_progress("Users", i + 1, len(users))
            except Exception as e:
                stats.failed += 1
                user_id = user.user_id if hasattr(user, 'user_id') else str(user)
                errors.append(BatchSyncError(
                    entity_type="User",
                    entity_id=user_id,
                    error=str(e),
                ))

    except Exception as e:
        print(f"Failed to sync users: {e}")

    return {"stats": stats, "errors": errors}


async def _sync_agents(
    cortex: "Cortex",
    adapter: GraphAdapter,
    limit: int,
    on_progress: Optional[Callable[[str, int, int], None]],
) -> Dict[str, Any]:
    """Sync agents to graph."""
    stats = BatchSyncStats()
    errors: List[BatchSyncError] = []

    try:
        # List all agents - returns List[RegisteredAgent]
        agents = await cortex.agents.list()
        # Apply limit client-side
        agents = agents[:limit] if len(agents) > limit else agents

        for i, agent in enumerate(agents):
            try:
                # Sync agent node
                from . import ensure_agent_node
                # Access agent_id attribute from RegisteredAgent dataclass
                agent_id = agent.agent_id if hasattr(agent, 'agent_id') else str(agent)
                await ensure_agent_node(agent_id, adapter)
                stats.synced += 1

                if on_progress:
                    on_progress("Agents", i + 1, len(agents))
            except Exception as e:
                stats.failed += 1
                agent_id = agent.agent_id if hasattr(agent, 'agent_id') else str(agent)
                errors.append(BatchSyncError(
                    entity_type="Agent",
                    entity_id=agent_id,
                    error=str(e),
                ))

    except Exception as e:
        print(f"Failed to sync agents: {e}")

    return {"stats": stats, "errors": errors}


__all__ = [
    "initial_graph_sync",
]
