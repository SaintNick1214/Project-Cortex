"""
Cortex SDK - Graph Schema Initialization

Creates constraints and indexes for optimal graph database performance.
"""

from typing import TYPE_CHECKING

from ..types import GraphAdapter, SchemaVerificationResult
from .errors import GraphSchemaError

if TYPE_CHECKING:
    pass


async def initialize_graph_schema(adapter: GraphAdapter) -> None:
    """
    Initialize graph database schema.

    Creates unique constraints and performance indexes for all node types.
    This should be run once after connecting to a new graph database.

    Args:
        adapter: Graph database adapter

    Raises:
        GraphSchemaError: If schema initialization fails

    Example:
        >>> adapter = CypherGraphAdapter()
        >>> await adapter.connect(config)
        >>> await initialize_graph_schema(adapter)
    """
    print("📐 Initializing graph schema...")

    try:
        # Create unique constraints (these also create indexes)
        await _create_unique_constraints(adapter)

        # Create additional performance indexes
        await _create_performance_indexes(adapter)

        print("✅ Graph schema initialized successfully")
    except Exception as e:
        raise GraphSchemaError(
            f"Failed to initialize graph schema: {e}",
            cause=e if isinstance(e, Exception) else None,
        )


async def _create_unique_constraints(adapter: GraphAdapter) -> None:
    """
    Create unique constraints for all entity IDs.

    These constraints ensure data integrity and automatically create indexes.
    """
    print("  Creating unique constraints...")

    constraints = [
        # MemorySpace
        {"label": "MemorySpace", "property": "memorySpaceId", "name": "memory_space_id"},
        # Context
        {"label": "Context", "property": "contextId", "name": "context_id"},
        # Conversation
        {"label": "Conversation", "property": "conversationId", "name": "conversation_id"},
        # Memory
        {"label": "Memory", "property": "memoryId", "name": "memory_id"},
        # Fact
        {"label": "Fact", "property": "factId", "name": "fact_id"},
        # User
        {"label": "User", "property": "userId", "name": "user_id"},
        # Agent
        {"label": "Agent", "property": "agentId", "name": "agent_id"},
        # Participant (Hive Mode)
        {"label": "Participant", "property": "participantId", "name": "participant_id"},
        # Entity
        {"label": "Entity", "property": "name", "name": "entity_name"},
    ]

    for constraint in constraints:
        try:
            await adapter.query(
                f"""
                CREATE CONSTRAINT {constraint['name']} IF NOT EXISTS
                FOR (n:{constraint['label']})
                REQUIRE n.{constraint['property']} IS UNIQUE
                """,
            )
            print(f"    ✓ {constraint['label']}.{constraint['property']}")
        except Exception:
            # Constraint may already exist, which is fine
            print(f"    ~ {constraint['label']}.{constraint['property']} (already exists)")


async def _create_performance_indexes(adapter: GraphAdapter) -> None:
    """
    Create performance indexes for frequently queried properties.

    These indexes improve query performance for common access patterns.
    """
    print("  Creating performance indexes...")

    indexes = [
        # Context indexes
        {"label": "Context", "property": "status", "name": "context_status"},
        {"label": "Context", "property": "depth", "name": "context_depth"},
        {"label": "Context", "property": "memorySpaceId", "name": "context_memory_space"},
        {"label": "Context", "property": "userId", "name": "context_user"},
        {"label": "Context", "property": "parentId", "name": "context_parent"},
        # Conversation indexes
        {"label": "Conversation", "property": "type", "name": "conversation_type"},
        {"label": "Conversation", "property": "memorySpaceId", "name": "conversation_memory_space"},
        {"label": "Conversation", "property": "userId", "name": "conversation_user"},
        {"label": "Conversation", "property": "agentId", "name": "conversation_agent"},
        # Memory indexes
        {"label": "Memory", "property": "importance", "name": "memory_importance"},
        {"label": "Memory", "property": "sourceType", "name": "memory_source_type"},
        {"label": "Memory", "property": "memorySpaceId", "name": "memory_memory_space"},
        {"label": "Memory", "property": "userId", "name": "memory_user"},
        {"label": "Memory", "property": "agentId", "name": "memory_agent"},
        {"label": "Memory", "property": "contentType", "name": "memory_content_type"},
        # Fact indexes
        {"label": "Fact", "property": "factType", "name": "fact_type"},
        {"label": "Fact", "property": "confidence", "name": "fact_confidence"},
        {"label": "Fact", "property": "subject", "name": "fact_subject"},
        {"label": "Fact", "property": "memorySpaceId", "name": "fact_memory_space"},
        {"label": "Fact", "property": "sourceType", "name": "fact_source_type"},
        # MemorySpace indexes
        {"label": "MemorySpace", "property": "type", "name": "memory_space_type"},
        {"label": "MemorySpace", "property": "status", "name": "memory_space_status"},
        # Entity indexes
        {"label": "Entity", "property": "type", "name": "entity_type"},
        # Participant indexes (Hive Mode)
        {"label": "Participant", "property": "type", "name": "participant_type"},
    ]

    for index in indexes:
        try:
            await adapter.query(
                f"""
                CREATE INDEX {index['name']} IF NOT EXISTS
                FOR (n:{index['label']})
                ON (n.{index['property']})
                """,
            )
            print(f"    ✓ {index['label']}.{index['property']}")
        except Exception:
            # Index may already exist or not supported by the database
            print(f"    ~ {index['label']}.{index['property']} (already exists or not supported)")


async def verify_graph_schema(adapter: GraphAdapter) -> SchemaVerificationResult:
    """
    Verify schema is properly initialized.

    Checks if all constraints and indexes are in place.

    Args:
        adapter: Graph database adapter

    Returns:
        Schema verification result

    Example:
        >>> result = await verify_graph_schema(adapter)
        >>> if not result.valid:
        ...     print(f"Missing: {result.missing}")
    """
    try:
        # Query for existing constraints
        constraints_result = await adapter.query("SHOW CONSTRAINTS")

        # Query for existing indexes
        indexes_result = await adapter.query("SHOW INDEXES")

        constraints = [r.get("name", "unknown") for r in constraints_result.records]
        indexes = [r.get("name", "unknown") for r in indexes_result.records]

        # Check for required constraints
        required_constraints = [
            "memory_space_id",
            "context_id",
            "conversation_id",
            "memory_id",
            "fact_id",
            "user_id",
        ]

        missing = [name for name in required_constraints if name not in constraints]

        return SchemaVerificationResult(
            valid=len(missing) == 0,
            constraints=constraints,
            indexes=indexes,
            missing=missing,
        )
    except Exception as e:
        # Some graph databases may not support SHOW CONSTRAINTS/INDEXES
        print(f"Could not verify schema (may not be supported): {e}")
        return SchemaVerificationResult(
            valid=False,
            constraints=[],
            indexes=[],
            missing=["verification not supported"],
        )


async def drop_graph_schema(adapter: GraphAdapter) -> None:
    """
    Drop all constraints and indexes.

    WARNING: This removes all schema constraints and indexes!
    Use only for testing or when resetting the database.

    Args:
        adapter: Graph database adapter

    Raises:
        GraphSchemaError: If schema drop fails
    """
    print("⚠️  Dropping graph schema (constraints and indexes)...")

    try:
        # Get all constraints
        constraints_result = await adapter.query("SHOW CONSTRAINTS")

        # Drop each constraint
        for record in constraints_result.records:
            name = record.get("name")
            if name:
                try:
                    await adapter.query(f"DROP CONSTRAINT {name} IF EXISTS")
                    print(f"  ✓ Dropped constraint: {name}")
                except Exception as e:
                    print(f"  ✗ Failed to drop constraint {name}: {e}")

        # Get all indexes
        indexes_result = await adapter.query("SHOW INDEXES")

        # Drop each index (except constraint-backed indexes)
        for record in indexes_result.records:
            name = record.get("name")
            index_type = record.get("type")

            # Skip constraint-backed indexes (they're dropped with constraints)
            if name and index_type != "UNIQUENESS":
                try:
                    await adapter.query(f"DROP INDEX {name} IF EXISTS")
                    print(f"  ✓ Dropped index: {name}")
                except Exception as e:
                    print(f"  ✗ Failed to drop index {name}: {e}")

        print("✅ Schema dropped")
    except Exception as e:
        raise GraphSchemaError(
            f"Failed to drop graph schema: {e}",
            cause=e if isinstance(e, Exception) else None,
        )


__all__ = [
    "initialize_graph_schema",
    "verify_graph_schema",
    "drop_graph_schema",
]
