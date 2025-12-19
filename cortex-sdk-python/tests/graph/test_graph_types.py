"""
Graph Types Unit Tests

Unit tests for graph types, orphan detection, and error classes.
These tests don't require a database connection.
"""

import pytest
from dataclasses import asdict

from cortex.types import (
    GraphNode,
    GraphEdge,
    GraphPath,
    GraphQuery,
    GraphQueryResult,
    QueryStatistics,
    GraphOperation,
    GraphDeleteResult,
    TraversalConfig,
    ShortestPathConfig,
    BatchSyncLimits,
    BatchSyncOptions,
    BatchSyncStats,
    BatchSyncError,
    BatchSyncResult,
    SchemaVerificationResult,
    OrphanRule,
    DeletionContext,
    OrphanCheckResult,
)

from cortex.graph.errors import (
    GraphDatabaseError,
    GraphConnectionError,
    GraphQueryError,
    GraphNotFoundError,
    GraphSchemaError,
    GraphSyncError,
)

from cortex.graph.orphan_detection import (
    ORPHAN_RULES,
    create_deletion_context,
)


# ============================================================================
# Graph Node/Edge Types Tests
# ============================================================================


class TestGraphNode:
    """Tests for GraphNode dataclass."""

    def test_create_node_minimal(self):
        """Test creating node with minimal fields."""
        node = GraphNode(label="Person", properties={"name": "Alice"})
        assert node.label == "Person"
        assert node.properties == {"name": "Alice"}
        assert node.id is None

    def test_create_node_with_id(self):
        """Test creating node with ID."""
        node = GraphNode(label="Person", properties={"name": "Bob"}, id="node-123")
        assert node.id == "node-123"

    def test_node_properties_dict(self):
        """Test node properties can contain various types."""
        props = {
            "string": "value",
            "number": 42,
            "float": 3.14,
            "boolean": True,
            "list": [1, 2, 3],
            "nested": {"key": "value"},
        }
        node = GraphNode(label="Test", properties=props)
        assert node.properties == props


class TestGraphEdge:
    """Tests for GraphEdge dataclass."""

    def test_create_edge_minimal(self):
        """Test creating edge with minimal fields."""
        edge = GraphEdge(type="KNOWS", from_node="node-1", to_node="node-2")
        assert edge.type == "KNOWS"
        assert edge.from_node == "node-1"
        assert edge.to_node == "node-2"
        assert edge.properties is None

    def test_create_edge_with_properties(self):
        """Test creating edge with properties."""
        edge = GraphEdge(
            type="WORKS_WITH",
            from_node="node-1",
            to_node="node-2",
            properties={"since": 2020, "department": "Engineering"},
        )
        assert edge.properties == {"since": 2020, "department": "Engineering"}


class TestGraphPath:
    """Tests for GraphPath dataclass."""

    def test_create_path(self):
        """Test creating a path."""
        nodes = [
            GraphNode(label="Person", properties={"name": "A"}, id="1"),
            GraphNode(label="Person", properties={"name": "B"}, id="2"),
        ]
        edges = [
            GraphEdge(type="KNOWS", from_node="1", to_node="2", id="e1"),
        ]
        path = GraphPath(nodes=nodes, relationships=edges, length=1)
        
        assert len(path.nodes) == 2
        assert len(path.relationships) == 1
        assert path.length == 1


# ============================================================================
# Graph Query Types Tests
# ============================================================================


class TestGraphQuery:
    """Tests for GraphQuery dataclass."""

    def test_create_query_simple(self):
        """Test creating simple query."""
        query = GraphQuery(cypher="MATCH (n) RETURN n")
        assert query.cypher == "MATCH (n) RETURN n"
        assert query.params is None

    def test_create_query_with_params(self):
        """Test creating query with parameters."""
        query = GraphQuery(
            cypher="MATCH (n {name: $name}) RETURN n",
            params={"name": "Alice"},
        )
        assert query.params == {"name": "Alice"}


class TestQueryStatistics:
    """Tests for QueryStatistics dataclass."""

    def test_default_values(self):
        """Test default values are zero."""
        stats = QueryStatistics()
        assert stats.nodes_created == 0
        assert stats.nodes_deleted == 0
        assert stats.relationships_created == 0

    def test_custom_values(self):
        """Test setting custom values."""
        stats = QueryStatistics(
            nodes_created=5,
            relationships_created=10,
            properties_set=15,
        )
        assert stats.nodes_created == 5
        assert stats.relationships_created == 10
        assert stats.properties_set == 15


class TestGraphQueryResult:
    """Tests for GraphQueryResult dataclass."""

    def test_create_result(self):
        """Test creating query result."""
        result = GraphQueryResult(
            records=[{"n": {"name": "Alice"}}],
            count=1,
        )
        assert result.count == 1
        assert len(result.records) == 1

    def test_result_with_stats(self):
        """Test result with statistics."""
        stats = QueryStatistics(nodes_created=1)
        result = GraphQueryResult(
            records=[],
            count=0,
            stats=stats,
        )
        assert result.stats.nodes_created == 1


# ============================================================================
# Graph Operation Types Tests
# ============================================================================


class TestGraphOperation:
    """Tests for GraphOperation dataclass."""

    def test_create_node_operation(self):
        """Test CREATE_NODE operation."""
        op = GraphOperation(
            operation="CREATE_NODE",
            node_type="Person",
            properties={"name": "Alice"},
        )
        assert op.operation == "CREATE_NODE"
        assert op.node_type == "Person"

    def test_create_edge_operation(self):
        """Test CREATE_EDGE operation."""
        op = GraphOperation(
            operation="CREATE_EDGE",
            edge_type="KNOWS",
            source_id="node-1",
            target_id="node-2",
        )
        assert op.operation == "CREATE_EDGE"
        assert op.source_id == "node-1"
        assert op.target_id == "node-2"

    def test_delete_node_operation(self):
        """Test DELETE_NODE operation."""
        op = GraphOperation(
            operation="DELETE_NODE",
            node_id="node-123",
        )
        assert op.operation == "DELETE_NODE"
        assert op.node_id == "node-123"


# ============================================================================
# Batch Sync Types Tests
# ============================================================================


class TestBatchSyncTypes:
    """Tests for batch sync types."""

    def test_batch_sync_limits_defaults(self):
        """Test default limits."""
        limits = BatchSyncLimits()
        assert limits.memories == 10000
        assert limits.facts == 10000
        assert limits.users == 1000
        assert limits.agents == 1000

    def test_batch_sync_stats_defaults(self):
        """Test default stats."""
        stats = BatchSyncStats()
        assert stats.synced == 0
        assert stats.failed == 0
        assert stats.skipped == 0

    def test_batch_sync_error(self):
        """Test batch sync error."""
        error = BatchSyncError(
            entity_type="Memory",
            entity_id="mem-123",
            error="Connection failed",
        )
        assert error.entity_type == "Memory"
        assert error.entity_id == "mem-123"

    def test_batch_sync_result_defaults(self):
        """Test default result."""
        result = BatchSyncResult()
        assert result.memories.synced == 0
        assert result.facts.synced == 0
        assert result.duration == 0


class TestSchemaVerificationResult:
    """Tests for SchemaVerificationResult dataclass."""

    def test_valid_schema(self):
        """Test valid schema result."""
        result = SchemaVerificationResult(valid=True)
        assert result.valid is True
        assert result.missing == []

    def test_invalid_schema(self):
        """Test invalid schema with missing items."""
        result = SchemaVerificationResult(
            valid=False,
            missing=["constraint_1", "index_2"],
        )
        assert result.valid is False
        assert len(result.missing) == 2


# ============================================================================
# Orphan Detection Types Tests
# ============================================================================


class TestOrphanDetectionTypes:
    """Tests for orphan detection types."""

    def test_orphan_rule(self):
        """Test OrphanRule dataclass."""
        rule = OrphanRule(
            node_type="Entity",
            keep_if_referenced_by=["Fact", "Memory"],
            never_auto_delete=False,
        )
        assert rule.node_type == "Entity"
        assert "Fact" in rule.keep_if_referenced_by

    def test_deletion_context(self):
        """Test DeletionContext dataclass."""
        rule = OrphanRule(node_type="Test", keep_if_referenced_by=[])
        ctx = DeletionContext(
            reason="Test deletion",
            rules=[rule],
        )
        assert ctx.reason == "Test deletion"
        assert len(ctx.rules) == 1

    def test_orphan_check_result(self):
        """Test OrphanCheckResult dataclass."""
        result = OrphanCheckResult(
            is_orphan=True,
            referenced_by=["node-1", "node-2"],
            circular_island=False,
        )
        assert result.is_orphan is True
        assert len(result.referenced_by) == 2


class TestOrphanRules:
    """Tests for ORPHAN_RULES constant."""

    def test_orphan_rules_exists(self):
        """Test ORPHAN_RULES is defined."""
        assert ORPHAN_RULES is not None
        assert isinstance(ORPHAN_RULES, dict)

    def test_conversation_rule(self):
        """Test Conversation orphan rule."""
        assert "Conversation" in ORPHAN_RULES
        rule = ORPHAN_RULES["Conversation"]
        assert rule.keep_if_referenced_by is not None

    def test_user_never_delete(self):
        """Test User has never_delete rule."""
        assert "User" in ORPHAN_RULES
        rule = ORPHAN_RULES["User"]
        assert rule.never_delete is True


class TestCreateDeletionContext:
    """Tests for create_deletion_context function."""

    def test_create_context(self):
        """Test creating deletion context."""
        ctx = create_deletion_context("Test reason", ORPHAN_RULES)
        assert ctx.reason == "Test reason"
        assert ctx.timestamp > 0
        assert len(ctx.deleted_node_ids) == 0


# ============================================================================
# Error Classes Tests
# ============================================================================


class TestGraphDatabaseError:
    """Tests for GraphDatabaseError class."""

    def test_create_error(self):
        """Test creating base error."""
        error = GraphDatabaseError("Test error")
        assert str(error) == "Test error"
        assert error.code is None

    def test_error_with_code(self):
        """Test error with code."""
        error = GraphDatabaseError("Test error", code="ERR001")
        assert error.code == "ERR001"
        assert "[ERR001]" in str(error)


class TestGraphConnectionError:
    """Tests for GraphConnectionError class."""

    def test_connection_error(self):
        """Test connection error."""
        error = GraphConnectionError("Failed to connect")
        assert error.code == "CONNECTION_ERROR"
        assert "Failed to connect" in str(error)


class TestGraphQueryError:
    """Tests for GraphQueryError class."""

    def test_query_error(self):
        """Test query error with query."""
        error = GraphQueryError(
            "Invalid syntax",
            query="MATCH (n) RETURN x",
        )
        assert error.query == "MATCH (n) RETURN x"
        assert "QUERY_ERROR" in str(error)


class TestGraphNotFoundError:
    """Tests for GraphNotFoundError class."""

    def test_not_found_error(self):
        """Test not found error."""
        error = GraphNotFoundError("node", "node-123")
        assert error.resource_type == "node"
        assert error.identifier == "node-123"
        assert "not found" in str(error)


class TestGraphSchemaError:
    """Tests for GraphSchemaError class."""

    def test_schema_error(self):
        """Test schema error."""
        error = GraphSchemaError("Failed to create constraint")
        assert error.code == "SCHEMA_ERROR"


class TestGraphSyncError:
    """Tests for GraphSyncError class."""

    def test_sync_error(self):
        """Test sync error."""
        error = GraphSyncError(
            "Sync failed",
            entity_type="Memory",
            entity_id="mem-123",
        )
        assert error.entity_type == "Memory"
        assert error.entity_id == "mem-123"
        assert error.code == "SYNC_ERROR"


# ============================================================================
# Graph Delete Result Tests
# ============================================================================


class TestGraphDeleteResult:
    """Tests for GraphDeleteResult dataclass."""

    def test_empty_result(self):
        """Test empty delete result."""
        result = GraphDeleteResult()
        assert result.deleted_nodes == []
        assert result.deleted_edges == []
        assert result.orphan_islands == []

    def test_with_deleted_nodes(self):
        """Test result with deleted nodes."""
        result = GraphDeleteResult(
            deleted_nodes=["node-1", "node-2"],
            deleted_edges=["edge-1"],
        )
        assert len(result.deleted_nodes) == 2
        assert len(result.deleted_edges) == 1


# ============================================================================
# Traversal Config Tests
# ============================================================================


class TestTraversalConfig:
    """Tests for TraversalConfig dataclass."""

    def test_minimal_config(self):
        """Test minimal traversal config."""
        config = TraversalConfig(
            start_id="node-1",
            relationship_types=["KNOWS"],
            max_depth=3,
        )
        assert config.start_id == "node-1"
        assert config.max_depth == 3
        assert config.direction == "BOTH"  # Default value

    def test_full_config(self):
        """Test full traversal config with direction."""
        config = TraversalConfig(
            start_id="node-1",
            max_depth=5,
            relationship_types=["KNOWS", "WORKS_WITH"],
            direction="OUTGOING",
        )
        assert config.direction == "OUTGOING"
        assert "KNOWS" in config.relationship_types


class TestShortestPathConfig:
    """Tests for ShortestPathConfig dataclass."""

    def test_minimal_config(self):
        """Test minimal path config."""
        config = ShortestPathConfig(
            from_id="node-1",
            to_id="node-2",
            max_hops=5,
        )
        assert config.from_id == "node-1"
        assert config.to_id == "node-2"

    def test_with_relationship_types(self):
        """Test config with relationship types."""
        config = ShortestPathConfig(
            from_id="node-1",
            to_id="node-2",
            max_hops=3,
            relationship_types=["KNOWS"],
        )
        assert config.relationship_types == ["KNOWS"]

