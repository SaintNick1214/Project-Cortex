"""
Unit Tests: Graph Enhancement for recall() Orchestration

Tests for entity extraction and graph traversal functions.
"""

import time
from dataclasses import dataclass, field
from typing import Any, List, Optional
from unittest.mock import AsyncMock, MagicMock

import pytest


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test Fixtures - Mock Data Classes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class MockMemoryEntry:
    """Mock MemoryEntry for testing."""
    memory_id: str
    content: str
    importance: int = 50
    created_at: int = field(default_factory=lambda: int(time.time() * 1000))
    user_id: Optional[str] = None
    fact_category: Optional[str] = None


@dataclass
class MockFactRecord:
    """Mock FactRecord for testing."""
    fact_id: str
    fact: str
    confidence: int = 80
    created_at: int = field(default_factory=lambda: int(time.time() * 1000))
    subject: Optional[str] = None
    object: Optional[str] = None
    entities: Optional[List[Any]] = None


@dataclass
class MockGraphNode:
    """Mock GraphNode for testing."""
    id: str
    label: str
    properties: dict = field(default_factory=dict)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Import module under test
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

from cortex.memory.recall.graph_enhancement import (
    GraphExpansionConfig,
    extract_entities_from_results,
    expand_via_graph,
    fetch_related_memories,
    fetch_related_facts,
    perform_graph_expansion,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Entity Extraction Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestExtractEntities:
    """Tests for extracting entities from memories and facts."""

    def test_extract_from_empty(self):
        """Extract from empty lists returns empty."""
        result = extract_entities_from_results([], [])
        assert result == []

    def test_extract_from_fact_subjects(self):
        """Extract entities from fact subjects."""
        facts = [
            MockFactRecord(fact_id="f1", fact="Test", subject="user-123"),
            MockFactRecord(fact_id="f2", fact="Test2", subject="user-456"),
        ]

        result = extract_entities_from_results([], facts)

        assert "user-123" in result
        assert "user-456" in result

    def test_extract_from_fact_objects(self):
        """Extract entities from fact objects."""
        facts = [
            MockFactRecord(
                fact_id="f1",
                fact="User works at TechCorp",
                subject="user-1",
                object="TechCorp",
            )
        ]

        result = extract_entities_from_results([], facts)

        assert "user-1" in result
        assert "TechCorp" in result

    def test_extract_from_fact_entities_array(self):
        """Extract entities from enriched entities array."""
        facts = [
            MockFactRecord(
                fact_id="f1",
                fact="Meeting with John",
                entities=[{"name": "John"}, {"name": "MeetingRoom1"}],
            )
        ]

        result = extract_entities_from_results([], facts)

        assert "John" in result
        assert "MeetingRoom1" in result

    def test_extract_from_memory_user_id(self):
        """Extract userId from memories."""
        memories = [
            MockMemoryEntry(memory_id="m1", content="Test", user_id="user-abc")
        ]

        result = extract_entities_from_results(memories, [])

        assert "user-abc" in result

    def test_extract_from_memory_fact_category(self):
        """Extract factCategory from memories."""
        memories = [
            MockMemoryEntry(
                memory_id="m1", content="Test", fact_category="preferences"
            )
        ]

        result = extract_entities_from_results(memories, [])

        assert "preferences" in result

    def test_extract_filters_empty_entities(self):
        """Extract filters out empty/whitespace entities."""
        facts = [
            MockFactRecord(fact_id="f1", fact="Test", subject="", object="   "),
            MockFactRecord(fact_id="f2", fact="Test2", subject="valid"),
        ]

        result = extract_entities_from_results([], facts)

        assert "valid" in result
        assert "" not in result
        assert "   " not in result

    def test_extract_filters_long_entities(self):
        """Extract filters out entities > 100 characters."""
        long_entity = "a" * 150
        facts = [
            MockFactRecord(fact_id="f1", fact="Test", subject=long_entity),
            MockFactRecord(fact_id="f2", fact="Test2", subject="short"),
        ]

        result = extract_entities_from_results([], facts)

        assert "short" in result
        assert long_entity not in result

    def test_extract_deduplicates(self):
        """Extract returns unique entities."""
        facts = [
            MockFactRecord(fact_id="f1", fact="A", subject="user-1"),
            MockFactRecord(fact_id="f2", fact="B", subject="user-1"),  # Duplicate
        ]

        result = extract_entities_from_results([], facts)

        assert result.count("user-1") == 1


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Graph Expansion Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestExpandViaGraph:
    """Tests for graph traversal expansion."""

    @pytest.mark.asyncio
    async def test_expand_no_adapter(self):
        """Expand returns empty when no graph adapter."""
        config = GraphExpansionConfig()
        result = await expand_via_graph(["entity-1"], None, config)
        assert result == []

    @pytest.mark.asyncio
    async def test_expand_empty_entities(self):
        """Expand returns empty when no initial entities."""
        mock_adapter = AsyncMock()
        config = GraphExpansionConfig()

        result = await expand_via_graph([], mock_adapter, config)

        assert result == []

    @pytest.mark.asyncio
    async def test_expand_not_connected(self):
        """Expand returns empty when graph not connected."""
        mock_adapter = AsyncMock()
        mock_adapter.is_connected = AsyncMock(return_value=False)
        config = GraphExpansionConfig()

        result = await expand_via_graph(["entity-1"], mock_adapter, config)

        assert result == []

    @pytest.mark.asyncio
    async def test_expand_finds_connected_entities(self):
        """Expand discovers connected entities via traversal."""
        mock_adapter = AsyncMock()
        mock_adapter.is_connected = AsyncMock(return_value=True)
        mock_adapter.find_nodes = AsyncMock(
            return_value=[MockGraphNode(id="n1", label="Entity", properties={"name": "entity-1"})]
        )
        mock_adapter.traverse = AsyncMock(
            return_value=[
                MockGraphNode(id="n2", label="Entity", properties={"name": "related-1"}),
                MockGraphNode(id="n3", label="Entity", properties={"name": "related-2"}),
            ]
        )

        config = GraphExpansionConfig(max_depth=2)

        result = await expand_via_graph(["entity-1"], mock_adapter, config)

        assert "related-1" in result
        assert "related-2" in result
        # Initial entity should NOT be in discovered
        assert "entity-1" not in result

    @pytest.mark.asyncio
    async def test_expand_respects_max_depth(self):
        """Expand passes maxDepth to graph adapter."""
        mock_adapter = AsyncMock()
        mock_adapter.is_connected = AsyncMock(return_value=True)
        mock_adapter.find_nodes = AsyncMock(
            return_value=[MockGraphNode(id="n1", label="Entity", properties={"name": "entity-1"})]
        )
        mock_adapter.traverse = AsyncMock(return_value=[])

        config = GraphExpansionConfig(max_depth=5)

        await expand_via_graph(["entity-1"], mock_adapter, config)

        # Verify traverse was called with correct maxDepth
        call_args = mock_adapter.traverse.call_args[0][0]
        assert call_args["maxDepth"] == 5

    @pytest.mark.asyncio
    async def test_expand_respects_relationship_types(self):
        """Expand passes relationshipTypes to graph adapter."""
        mock_adapter = AsyncMock()
        mock_adapter.is_connected = AsyncMock(return_value=True)
        mock_adapter.find_nodes = AsyncMock(
            return_value=[MockGraphNode(id="n1", label="Entity", properties={"name": "entity-1"})]
        )
        mock_adapter.traverse = AsyncMock(return_value=[])

        config = GraphExpansionConfig(relationship_types=["KNOWS", "WORKS_WITH"])

        await expand_via_graph(["entity-1"], mock_adapter, config)

        call_args = mock_adapter.traverse.call_args[0][0]
        assert call_args["relationshipTypes"] == ["KNOWS", "WORKS_WITH"]

    @pytest.mark.asyncio
    async def test_expand_handles_traversal_error(self):
        """Expand handles errors gracefully."""
        mock_adapter = AsyncMock()
        mock_adapter.is_connected = AsyncMock(return_value=True)
        mock_adapter.find_nodes = AsyncMock(side_effect=Exception("Graph error"))

        config = GraphExpansionConfig()

        # Should not raise, returns empty
        result = await expand_via_graph(["entity-1"], mock_adapter, config)
        assert result == []

    @pytest.mark.asyncio
    async def test_expand_limits_initial_entities(self):
        """Expand limits initial entities to 10 for performance."""
        mock_adapter = AsyncMock()
        mock_adapter.is_connected = AsyncMock(return_value=True)
        mock_adapter.find_nodes = AsyncMock(return_value=[])

        config = GraphExpansionConfig()
        many_entities = [f"entity-{i}" for i in range(20)]

        await expand_via_graph(many_entities, mock_adapter, config)

        # Should only have been called 10 times (limited)
        assert mock_adapter.find_nodes.call_count == 10


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Fetch Related Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestFetchRelated:
    """Tests for fetching related memories and facts."""

    @pytest.mark.asyncio
    async def test_fetch_memories_empty_entities(self):
        """Fetch returns empty when no entities."""
        mock_vector = AsyncMock()

        result = await fetch_related_memories([], "space-1", mock_vector, set(), 10)

        assert result == []
        mock_vector.search.assert_not_called()

    @pytest.mark.asyncio
    async def test_fetch_memories_searches_for_entities(self):
        """Fetch searches for each entity."""
        mock_vector = AsyncMock()
        mock_memory = MockMemoryEntry(memory_id="m1", content="Test")
        mock_vector.search = AsyncMock(return_value=[mock_memory])

        result = await fetch_related_memories(
            ["entity-1"], "space-1", mock_vector, set(), 10
        )

        assert len(result) == 1
        mock_vector.search.assert_called()

    @pytest.mark.asyncio
    async def test_fetch_memories_skips_processed_ids(self):
        """Fetch skips already processed IDs."""
        mock_vector = AsyncMock()
        mock_memory = MockMemoryEntry(memory_id="m1", content="Test")
        mock_vector.search = AsyncMock(return_value=[mock_memory])

        processed = {"m1"}  # Already processed
        result = await fetch_related_memories(
            ["entity-1"], "space-1", mock_vector, processed, 10
        )

        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_fetch_memories_respects_limit(self):
        """Fetch respects the limit parameter."""
        mock_vector = AsyncMock()
        mock_memories = [
            MockMemoryEntry(memory_id=f"m{i}", content=f"Test {i}")
            for i in range(20)
        ]
        mock_vector.search = AsyncMock(return_value=mock_memories)

        result = await fetch_related_memories(
            ["entity-1"], "space-1", mock_vector, set(), 5
        )

        assert len(result) <= 5

    @pytest.mark.asyncio
    async def test_fetch_facts_empty_entities(self):
        """Fetch facts returns empty when no entities."""
        mock_facts = AsyncMock()

        result = await fetch_related_facts([], "space-1", mock_facts, set(), 10)

        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_facts_queries_by_subject(self):
        """Fetch facts queries by subject."""
        mock_facts = AsyncMock()
        mock_fact = MockFactRecord(fact_id="f1", fact="Test")
        mock_facts.query_by_subject = AsyncMock(return_value=[mock_fact])
        mock_facts.search = AsyncMock(return_value=[])

        result = await fetch_related_facts(
            ["entity-1"], "space-1", mock_facts, set(), 10
        )

        assert len(result) == 1
        mock_facts.query_by_subject.assert_called()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Full Pipeline Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestPerformGraphExpansion:
    """Tests for the full graph expansion pipeline."""

    @pytest.mark.asyncio
    async def test_expansion_disabled_no_adapter(self):
        """Expansion returns empty when no graph adapter."""
        mock_vector = AsyncMock()
        mock_facts = AsyncMock()
        config = GraphExpansionConfig()

        result = await perform_graph_expansion(
            [], [], "space-1", None, mock_vector, mock_facts, config
        )

        assert result.discovered_entities == []
        assert result.related_memories == []
        assert result.related_facts == []

    @pytest.mark.asyncio
    async def test_expansion_disabled_config(self):
        """Expansion returns empty when disabled in config."""
        mock_adapter = AsyncMock()
        mock_vector = AsyncMock()
        mock_facts = AsyncMock()
        config = GraphExpansionConfig(
            expand_from_facts=False, expand_from_memories=False
        )

        result = await perform_graph_expansion(
            [], [], "space-1", mock_adapter, mock_vector, mock_facts, config
        )

        assert result.discovered_entities == []

    @pytest.mark.asyncio
    async def test_expansion_tracks_processed_ids(self):
        """Expansion tracks initial IDs to avoid re-fetching."""
        mock_adapter = AsyncMock()
        mock_adapter.is_connected = AsyncMock(return_value=False)
        mock_vector = AsyncMock()
        mock_facts = AsyncMock()
        config = GraphExpansionConfig()

        initial_memories = [MockMemoryEntry(memory_id="m1", content="Test")]
        initial_facts = [MockFactRecord(fact_id="f1", fact="Test")]

        result = await perform_graph_expansion(
            initial_memories,
            initial_facts,
            "space-1",
            mock_adapter,
            mock_vector,
            mock_facts,
            config,
        )

        assert "m1" in result.processed_ids
        assert "f1" in result.processed_ids
