"""
Cortex SDK - Graph Schema Initialization

Schema management for graph database constraints and indexes
"""

from typing import TYPE_CHECKING, Any, Dict

if TYPE_CHECKING:
    from ...types import GraphAdapter


async def initialize_graph_schema(adapter: "GraphAdapter") -> None:
    """
    Create constraints and indexes (one-time setup).

    Args:
        adapter: Graph database adapter

    Example:
        >>> await initialize_graph_schema(graph_adapter)
    """
    print("📐 Initializing graph schema...")

    # Create unique constraints
    constraints = [
        # MemorySpace
        ("MemorySpace", "memorySpaceId", "memory_space_id"),
        # Context
        ("Context", "contextId", "context_id"),
        # Conversation
        ("Conversation", "conversationId", "conversation_id"),
        # Memory
        ("Memory", "memoryId", "memory_id"),
        # Fact
        ("Fact", "factId", "fact_id"),
        # User
        ("User", "userId", "user_id"),
        # Agent
        ("Agent", "agentId", "agent_id"),
        # Participant (Hive Mode)
        ("Participant", "participantId", "participant_id"),
        # Entity
        ("Entity", "name", "entity_name"),
    ]

    # Create unique constraints
    print("  Creating unique constraints...")
    for label, prop, name in constraints:
        try:
            await adapter.query(
                f"CREATE CONSTRAINT {name} IF NOT EXISTS "
                f"FOR (n:{label}) REQUIRE n.{prop} IS UNIQUE"
            )
            print(f"    ✓ {label}.{prop}")
        except Exception:
            print(f"    ~ {label}.{prop} (already exists)")

    # Create indexes for performance
    indexes = [
        # Context indexes
        ("Context", "status", "context_status"),
        ("Context", "depth", "context_depth"),
        ("Context", "memorySpaceId", "context_memory_space"),
        ("Context", "userId", "context_user"),
        ("Context", "parentId", "context_parent"),
        # Conversation indexes
        ("Conversation", "type", "conversation_type"),
        ("Conversation", "memorySpaceId", "conversation_memory_space"),
        ("Conversation", "userId", "conversation_user"),
        ("Conversation", "agentId", "conversation_agent"),
        # Memory indexes
        ("Memory", "importance", "memory_importance"),
        ("Memory", "sourceType", "memory_source_type"),
        ("Memory", "memorySpaceId", "memory_memory_space"),
        ("Memory", "userId", "memory_user"),
        ("Memory", "agentId", "memory_agent"),
        ("Memory", "contentType", "memory_content_type"),
        # Fact indexes
        ("Fact", "factType", "fact_type"),
        ("Fact", "confidence", "fact_confidence"),
        ("Fact", "subject", "fact_subject"),
        ("Fact", "memorySpaceId", "fact_memory_space"),
        ("Fact", "sourceType", "fact_source_type"),
        # MemorySpace indexes
        ("MemorySpace", "type", "memory_space_type"),
        ("MemorySpace", "status", "memory_space_status"),
        # Entity indexes
        ("Entity", "type", "entity_type"),
        # Participant indexes (Hive Mode)
        ("Participant", "type", "participant_type"),
    ]

    print("  Creating performance indexes...")
    for label, prop, name in indexes:
        try:
            await adapter.query(
                f"CREATE INDEX {name} IF NOT EXISTS FOR (n:{label}) ON (n.{prop})"
            )
            print(f"    ✓ {label}.{prop}")
        except Exception:
            print(f"    ~ {label}.{prop} (already exists or not supported)")

    print("✅ Graph schema initialized successfully")


async def verify_graph_schema(adapter: "GraphAdapter") -> Dict[str, Any]:
    """
    Check if schema is properly initialized.

    Args:
        adapter: Graph database adapter

    Returns:
        Schema status

    Example:
        >>> status = await verify_graph_schema(adapter)
        >>> print(f"Valid: {status['valid']}")
    """
    # Query for constraints
    constraints_result = await adapter.query("SHOW CONSTRAINTS")

    # Query for indexes
    indexes_result = await adapter.query("SHOW INDEXES")

    return {
        "valid": constraints_result.count > 0,
        "constraints": constraints_result.count,
        "indexes": indexes_result.count,
    }


async def drop_graph_schema(adapter: "GraphAdapter") -> None:
    """
    Remove all constraints and indexes (testing/reset).

    WARNING: This removes all schema constraints and indexes!

    Args:
        adapter: Graph database adapter

    Example:
        >>> await drop_graph_schema(adapter)
    """
    # Get all constraints
    constraints_result = await adapter.query("SHOW CONSTRAINTS")

    for record in constraints_result.records:
        constraint_name = record.get("name")
        if constraint_name:
            try:
                await adapter.query(f"DROP CONSTRAINT {constraint_name}")
            except Exception as e:
                print(f"Warning: Failed to drop constraint {constraint_name}: {e}")

    # Get all indexes
    indexes_result = await adapter.query("SHOW INDEXES")

    for record in indexes_result.records:
        index_name = record.get("name")
        if index_name:
            try:
                await adapter.query(f"DROP INDEX {index_name}")
            except Exception as e:
                print(f"Warning: Failed to drop index {index_name}: {e}")

