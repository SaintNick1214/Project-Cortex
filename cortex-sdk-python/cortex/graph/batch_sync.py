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
    sync_fact_relationships,
    sync_fact_to_graph,
    sync_memory_relationships,
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
        # Phase 1: Sync Memories
        print("📦 Phase 1: Syncing Memories...")
        memories_result = await _sync_memories(
            cortex, adapter, sync_rels, limits.memories, opts.on_progress
        )
        result.memories = memories_result["stats"]
        result.errors.extend(memories_result["errors"])

        # Phase 2: Sync Facts
        print("📦 Phase 2: Syncing Facts...")
        facts_result = await _sync_facts(
            cortex, adapter, sync_rels, limits.facts, opts.on_progress
        )
        result.facts = facts_result["stats"]
        result.errors.extend(facts_result["errors"])

        # Phase 3: Sync Users (placeholder)
        print("📦 Phase 3: Syncing Users...")
        users_result = await _sync_users(cortex, adapter, limits.users, opts.on_progress)
        result.users = users_result["stats"]
        result.errors.extend(users_result["errors"])

        # Phase 4: Sync Agents (placeholder)
        print("📦 Phase 4: Syncing Agents...")
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
