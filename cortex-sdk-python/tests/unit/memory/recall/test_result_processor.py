"""
Unit Tests: Result Processor for recall() Orchestration

Tests for the merge, deduplicate, rank, and format functions.
"""

import time
from dataclasses import dataclass, field
from typing import List, Optional
from unittest.mock import MagicMock

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
    message_role: Optional[str] = None
    user_id: Optional[str] = None
    fact_category: Optional[str] = None
    conversation_ref: Optional[dict] = None


@dataclass
class MockFactRecord:
    """Mock FactRecord for testing."""
    fact_id: str
    fact: str
    confidence: int = 80
    created_at: int = field(default_factory=lambda: int(time.time() * 1000))
    subject: Optional[str] = None
    object: Optional[str] = None
    entities: Optional[List[dict]] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Import module under test
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

from cortex.memory.recall.result_processor import (
    RANKING_WEIGHTS,
    SCORE_BOOSTS,
    memory_to_recall_item,
    fact_to_recall_item,
    merge_results,
    deduplicate_results,
    rank_results,
    format_for_llm,
    build_source_breakdown,
    process_recall_results,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Conversion Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestConversion:
    """Tests for memory/fact to RecallItem conversion."""

    def test_memory_to_recall_item_basic(self):
        """Convert memory to RecallItem with basic fields."""
        memory = MockMemoryEntry(
            memory_id="mem-123",
            content="User prefers dark mode",
        )

        item = memory_to_recall_item(memory, "vector", 0.8)

        assert item.type == "memory"
        assert item.id == "mem-123"
        assert item.content == "User prefers dark mode"
        assert item.score == 0.8
        assert item.source == "vector"
        assert item.memory == memory
        assert item.fact is None

    def test_memory_to_recall_item_graph_expanded(self):
        """Convert graph-expanded memory to RecallItem."""
        memory = MockMemoryEntry(
            memory_id="mem-456",
            content="Meeting tomorrow",
        )

        item = memory_to_recall_item(memory, "graph-expanded", 0.5)

        assert item.source == "graph-expanded"
        assert item.score == 0.5

    def test_fact_to_recall_item_basic(self):
        """Convert fact to RecallItem with basic fields."""
        fact = MockFactRecord(
            fact_id="fact-123",
            fact="User works at TechCorp",
            subject="user-1",
            object="TechCorp",
        )

        item = fact_to_recall_item(fact, "facts", 0.7)

        assert item.type == "fact"
        assert item.id == "fact-123"
        assert item.content == "User works at TechCorp"
        assert item.score == 0.7
        assert item.source == "facts"
        assert item.fact == fact
        assert item.memory is None
        assert "user-1" in item.graph_context.connected_entities
        assert "TechCorp" in item.graph_context.connected_entities


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Merge Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestMerge:
    """Tests for merging results from multiple sources."""

    def test_merge_empty_inputs(self):
        """Merge with empty inputs returns empty list."""
        result = merge_results([], [], [], [], [])
        assert result == []

    def test_merge_vector_only(self):
        """Merge with only vector memories."""
        memories = [
            MockMemoryEntry(memory_id="m1", content="Memory 1"),
            MockMemoryEntry(memory_id="m2", content="Memory 2"),
        ]

        result = merge_results(memories, [], [], [], [])

        assert len(result) == 2
        assert all(item.source == "vector" for item in result)
        assert all(item.score == 0.7 for item in result)

    def test_merge_facts_only(self):
        """Merge with only direct facts."""
        facts = [
            MockFactRecord(fact_id="f1", fact="Fact 1"),
            MockFactRecord(fact_id="f2", fact="Fact 2"),
        ]

        result = merge_results([], facts, [], [], [])

        assert len(result) == 2
        assert all(item.source == "facts" for item in result)

    def test_merge_all_sources(self):
        """Merge from all sources."""
        vector_memories = [MockMemoryEntry(memory_id="vm1", content="Vector memory")]
        direct_facts = [MockFactRecord(fact_id="df1", fact="Direct fact")]
        graph_memories = [MockMemoryEntry(memory_id="gm1", content="Graph memory")]
        graph_facts = [MockFactRecord(fact_id="gf1", fact="Graph fact")]

        result = merge_results(
            vector_memories, direct_facts, graph_memories, graph_facts, ["entity-1"]
        )

        assert len(result) == 4
        sources = [item.source for item in result]
        assert "vector" in sources
        assert "facts" in sources
        assert sources.count("graph-expanded") == 2

    def test_merge_graph_expanded_has_entities(self):
        """Graph-expanded items should have discovered entities in context."""
        graph_memories = [MockMemoryEntry(memory_id="gm1", content="Test")]

        result = merge_results([], [], graph_memories, [], ["entity-A", "entity-B"])

        assert len(result) == 1
        assert "entity-A" in result[0].graph_context.connected_entities
        assert "entity-B" in result[0].graph_context.connected_entities


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Deduplication Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestDeduplicate:
    """Tests for deduplication logic."""

    def test_dedupe_no_duplicates(self):
        """No deduplication needed when all IDs unique."""
        items = [
            memory_to_recall_item(
                MockMemoryEntry(memory_id="m1", content="A"), "vector", 0.7
            ),
            memory_to_recall_item(
                MockMemoryEntry(memory_id="m2", content="B"), "vector", 0.6
            ),
        ]

        result = deduplicate_results(items)

        assert len(result) == 2

    def test_dedupe_keeps_primary_over_graph(self):
        """Primary source item kept over graph-expanded duplicate."""
        m = MockMemoryEntry(memory_id="m1", content="Test")
        items = [
            memory_to_recall_item(m, "vector", 0.7),
            memory_to_recall_item(m, "graph-expanded", 0.5),
        ]

        result = deduplicate_results(items)

        assert len(result) == 1
        assert result[0].source == "vector"
        # Score boosted for multi-source
        assert result[0].score > 0.7

    def test_dedupe_replaces_graph_with_primary(self):
        """Graph-expanded item replaced by later primary source."""
        m = MockMemoryEntry(memory_id="m1", content="Test")
        items = [
            memory_to_recall_item(m, "graph-expanded", 0.5),
            memory_to_recall_item(m, "vector", 0.7),
        ]

        result = deduplicate_results(items)

        assert len(result) == 1
        assert result[0].source == "vector"

    def test_dedupe_keeps_higher_score_same_priority(self):
        """When both same priority, keep higher score."""
        m = MockMemoryEntry(memory_id="m1", content="Test")
        items = [
            memory_to_recall_item(m, "vector", 0.6),
            memory_to_recall_item(m, "vector", 0.8),
        ]

        result = deduplicate_results(items)

        assert len(result) == 1
        assert result[0].score == 0.8


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Ranking Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestRanking:
    """Tests for ranking algorithm."""

    def test_rank_sorts_by_score_descending(self):
        """Items sorted by score, highest first."""
        items = [
            memory_to_recall_item(
                MockMemoryEntry(memory_id="m1", content="Low", importance=30),
                "vector",
                0.3,
            ),
            memory_to_recall_item(
                MockMemoryEntry(memory_id="m2", content="High", importance=90),
                "vector",
                0.9,
            ),
            memory_to_recall_item(
                MockMemoryEntry(memory_id="m3", content="Mid", importance=50),
                "vector",
                0.5,
            ),
        ]

        result = rank_results(items)

        assert result[0].id == "m2"
        assert result[-1].id == "m1"

    def test_rank_boosts_user_messages(self):
        """User messages get boosted score."""
        agent_mem = MockMemoryEntry(
            memory_id="m1", content="Agent", importance=50, message_role="agent"
        )
        user_mem = MockMemoryEntry(
            memory_id="m2", content="User", importance=50, message_role="user"
        )

        items = [
            memory_to_recall_item(agent_mem, "vector", 0.5),
            memory_to_recall_item(user_mem, "vector", 0.5),
        ]

        result = rank_results(items)

        user_item = next(i for i in result if i.id == "m2")
        agent_item = next(i for i in result if i.id == "m1")
        assert user_item.score > agent_item.score

    def test_rank_recent_items_score_higher(self):
        """Recent items score higher than old items."""
        now = int(time.time() * 1000)
        old_time = now - (60 * 24 * 60 * 60 * 1000)  # 60 days ago

        old_mem = MockMemoryEntry(
            memory_id="m1", content="Old", importance=50, created_at=old_time
        )
        new_mem = MockMemoryEntry(
            memory_id="m2", content="New", importance=50, created_at=now
        )

        items = [
            memory_to_recall_item(old_mem, "vector", 0.5),
            memory_to_recall_item(new_mem, "vector", 0.5),
        ]

        result = rank_results(items)

        new_item = next(i for i in result if i.id == "m2")
        old_item = next(i for i in result if i.id == "m1")
        assert new_item.score > old_item.score

    def test_rank_scores_clamped_to_0_1(self):
        """Scores should be between 0 and 1."""
        # High importance, high confidence fact that might exceed 1.0
        fact = MockFactRecord(
            fact_id="f1",
            fact="Very confident fact",
            confidence=100,
            subject="e1",
            object="e2",
        )
        fact_item = fact_to_recall_item(fact, "facts", 0.99)

        # Add lots of connected entities for high connectivity
        fact_item.graph_context.connected_entities = [
            "e1", "e2", "e3", "e4", "e5", "e6"
        ]

        result = rank_results([fact_item])

        assert result[0].score <= 1.0
        assert result[0].score >= 0.0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LLM Formatting Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestFormatForLLM:
    """Tests for LLM context formatting."""

    def test_format_empty_returns_empty(self):
        """Empty items returns empty string."""
        result = format_for_llm([])
        assert result == ""

    def test_format_facts_only(self):
        """Format with only facts."""
        fact = MockFactRecord(fact_id="f1", fact="User likes coffee", confidence=90)
        items = [fact_to_recall_item(fact, "facts", 0.8)]

        result = format_for_llm(items)

        assert "## Relevant Context" in result
        assert "### Known Facts" in result
        assert "User likes coffee" in result
        assert "confidence: 90%" in result

    def test_format_memories_only(self):
        """Format with only memories."""
        mem = MockMemoryEntry(
            memory_id="m1", content="Hello there", message_role="user"
        )
        items = [memory_to_recall_item(mem, "vector", 0.7)]

        result = format_for_llm(items)

        assert "## Relevant Context" in result
        assert "### Conversation History" in result
        assert "[user]: Hello there" in result

    def test_format_mixed(self):
        """Format with both facts and memories."""
        fact = MockFactRecord(fact_id="f1", fact="Fact content", confidence=85)
        mem = MockMemoryEntry(
            memory_id="m1", content="Memory content", message_role="agent"
        )

        items = [
            fact_to_recall_item(fact, "facts", 0.8),
            memory_to_recall_item(mem, "vector", 0.7),
        ]

        result = format_for_llm(items)

        assert "### Known Facts" in result
        assert "### Conversation History" in result
        assert "Fact content" in result
        assert "[agent]: Memory content" in result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Source Breakdown Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestSourceBreakdown:
    """Tests for source breakdown building."""

    def test_breakdown_counts(self):
        """Source breakdown has correct counts."""
        vector = [MockMemoryEntry(memory_id="m1", content="A")]
        facts = [
            MockFactRecord(fact_id="f1", fact="B"),
            MockFactRecord(fact_id="f2", fact="C"),
        ]
        graph_mem = [MockMemoryEntry(memory_id="gm1", content="D")]
        graph_facts = []
        entities = ["e1", "e2"]

        result = build_source_breakdown(vector, facts, graph_mem, graph_facts, entities)

        assert result.vector["count"] == 1
        assert result.facts["count"] == 2
        assert result.graph["count"] == 1
        assert result.graph["expanded_entities"] == ["e1", "e2"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Full Pipeline Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestProcessRecallResults:
    """Tests for the full processing pipeline."""

    def test_pipeline_with_limit(self):
        """Pipeline respects limit option."""
        memories = [
            MockMemoryEntry(memory_id=f"m{i}", content=f"Memory {i}")
            for i in range(10)
        ]

        result = process_recall_results(
            memories, [], [], [], [], {"limit": 3, "format_for_llm": True}
        )

        assert len(result["items"]) == 3

    def test_pipeline_formats_llm_by_default(self):
        """Pipeline generates LLM context by default."""
        memories = [MockMemoryEntry(memory_id="m1", content="Test", message_role="user")]

        result = process_recall_results(memories, [], [], [], [], {})

        assert result["context"] is not None
        assert "Test" in result["context"]

    def test_pipeline_skips_llm_format_when_disabled(self):
        """Pipeline skips LLM formatting when disabled."""
        memories = [MockMemoryEntry(memory_id="m1", content="Test")]

        result = process_recall_results(
            memories, [], [], [], [], {"format_for_llm": False}
        )

        assert result["context"] is None

    def test_pipeline_deduplicates(self):
        """Pipeline removes duplicates."""
        # Same memory from two sources
        mem = MockMemoryEntry(memory_id="m1", content="Duplicate")

        result = process_recall_results([mem], [], [mem], [], [], {})

        assert len(result["items"]) == 1

    def test_pipeline_ranks_results(self):
        """Pipeline ranks results by score."""
        low = MockMemoryEntry(memory_id="m1", content="Low", importance=10)
        high = MockMemoryEntry(memory_id="m2", content="High", importance=100)

        result = process_recall_results([low, high], [], [], [], [], {})

        assert result["items"][0].id == "m2"  # High importance first
