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
    # Create unique constraints
    constraints = [
        "CREATE CONSTRAINT IF NOT EXISTS FOR (m:MemorySpace) REQUIRE m.memorySpaceId IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Context) REQUIRE c.contextId IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (m:Memory) REQUIRE m.memoryId IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (f:Fact) REQUIRE f.factId IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Conversation) REQUIRE c.conversationId IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.userId IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE",
    ]

    # Create indexes for performance
    indexes = [
        "CREATE INDEX IF NOT EXISTS FOR (m:Memory) ON (m.importance)",
        "CREATE INDEX IF NOT EXISTS FOR (m:Memory) ON (m.createdAt)",
        "CREATE INDEX IF NOT EXISTS FOR (m:Memory) ON (m.memorySpaceId)",
        "CREATE INDEX IF NOT EXISTS FOR (f:Fact) ON (f.subject)",
        "CREATE INDEX IF NOT EXISTS FOR (f:Fact) ON (f.factType)",
        "CREATE INDEX IF NOT EXISTS FOR (f:Fact) ON (f.confidence)",
        "CREATE INDEX IF NOT EXISTS FOR (c:Context) ON (c.status)",
        "CREATE INDEX IF NOT EXISTS FOR (c:Context) ON (c.depth)",
        "CREATE INDEX IF NOT EXISTS FOR (c:Conversation) ON (c.memorySpaceId)",
    ]

    # Execute constraints
    for constraint in constraints:
        try:
            await adapter.query(constraint)
        except Exception as e:
            print(f"Warning: Failed to create constraint: {e}")

    # Execute indexes
    for index in indexes:
        try:
            await adapter.query(index)
        except Exception as e:
            print(f"Warning: Failed to create index: {e}")


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

