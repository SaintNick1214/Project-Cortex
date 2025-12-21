"""
Unit tests for Cortex SDK - Fact History Service

Tests history logging, retrieval, and cleanup operations.
"""

from datetime import datetime, timedelta

import pytest

from cortex.facts.history import (
    ActionCounts,
    ActivitySummary,
    ChangeFilter,
    FactChangeEvent,
    FactChangePipeline,
    FactHistoryService,
    LogEventParams,
    SupersessionChainEntry,
    TimeRange,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Data Class Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestFactChangePipeline:
    """Tests for FactChangePipeline dataclass."""

    def test_default_values(self) -> None:
        """Should have None as default values."""
        pipeline = FactChangePipeline()
        assert pipeline.slot_matching is None
        assert pipeline.semantic_matching is None
        assert pipeline.llm_resolution is None

    def test_explicit_values(self) -> None:
        """Should accept explicit values."""
        pipeline = FactChangePipeline(
            slot_matching=True,
            semantic_matching=False,
            llm_resolution=True,
        )
        assert pipeline.slot_matching is True
        assert pipeline.semantic_matching is False
        assert pipeline.llm_resolution is True


class TestFactChangeEvent:
    """Tests for FactChangeEvent dataclass."""

    def test_required_fields(self) -> None:
        """Should require essential fields."""
        event = FactChangeEvent(
            event_id="evt-123",
            fact_id="fact-456",
            memory_space_id="space-1",
            action="CREATE",
            timestamp=1700000000000,
        )
        assert event.event_id == "evt-123"
        assert event.fact_id == "fact-456"
        assert event.memory_space_id == "space-1"
        assert event.action == "CREATE"
        assert event.timestamp == 1700000000000

    def test_optional_fields(self) -> None:
        """Should handle optional fields."""
        event = FactChangeEvent(
            event_id="evt-123",
            fact_id="fact-456",
            memory_space_id="space-1",
            action="UPDATE",
            timestamp=1700000000000,
            old_value="Old value",
            new_value="New value",
            reason="Updated information",
            confidence=85,
            pipeline=FactChangePipeline(slot_matching=True),
        )
        assert event.old_value == "Old value"
        assert event.new_value == "New value"
        assert event.reason == "Updated information"
        assert event.confidence == 85
        assert event.pipeline.slot_matching is True


class TestLogEventParams:
    """Tests for LogEventParams dataclass."""

    def test_required_fields(self) -> None:
        """Should require essential fields."""
        params = LogEventParams(
            fact_id="fact-123",
            memory_space_id="space-1",
            action="CREATE",
        )
        assert params.fact_id == "fact-123"
        assert params.memory_space_id == "space-1"
        assert params.action == "CREATE"

    def test_with_pipeline(self) -> None:
        """Should accept pipeline parameter."""
        params = LogEventParams(
            fact_id="fact-123",
            memory_space_id="space-1",
            action="SUPERSEDE",
            pipeline=FactChangePipeline(
                slot_matching=True,
                semantic_matching=False,
                llm_resolution=True,
            ),
        )
        assert params.pipeline is not None
        assert params.pipeline.slot_matching is True


class TestChangeFilter:
    """Tests for ChangeFilter dataclass."""

    def test_required_memory_space(self) -> None:
        """Should require memory_space_id."""
        filter = ChangeFilter(memory_space_id="space-1")
        assert filter.memory_space_id == "space-1"

    def test_optional_time_range(self) -> None:
        """Should accept time range filters."""
        now = datetime.now()
        yesterday = now - timedelta(days=1)
        filter = ChangeFilter(
            memory_space_id="space-1",
            after=yesterday,
            before=now,
        )
        assert filter.after == yesterday
        assert filter.before == now

    def test_optional_action_filter(self) -> None:
        """Should accept action filter."""
        filter = ChangeFilter(
            memory_space_id="space-1",
            action="SUPERSEDE",
        )
        assert filter.action == "SUPERSEDE"


class TestActivitySummary:
    """Tests for ActivitySummary dataclass."""

    def test_default_values(self) -> None:
        """Should have sensible defaults."""
        summary = ActivitySummary(
            time_range=TimeRange(hours=24, since="2024-01-01T00:00:00Z", until="2024-01-02T00:00:00Z"),
            total_events=100,
            action_counts=ActionCounts(CREATE=50, UPDATE=30, SUPERSEDE=15, DELETE=5),
        )
        assert summary.total_events == 100
        assert summary.action_counts.CREATE == 50
        assert summary.unique_facts_modified == 0  # Default
        assert summary.active_participants == 0  # Default


class TestSupersessionChainEntry:
    """Tests for SupersessionChainEntry dataclass."""

    def test_required_fields(self) -> None:
        """Should require essential fields."""
        entry = SupersessionChainEntry(
            fact_id="fact-123",
            superseded_by="fact-456",
            timestamp=1700000000000,
        )
        assert entry.fact_id == "fact-123"
        assert entry.superseded_by == "fact-456"
        assert entry.timestamp == 1700000000000

    def test_null_superseded_by(self) -> None:
        """Should allow null superseded_by (current fact)."""
        entry = SupersessionChainEntry(
            fact_id="fact-123",
            superseded_by=None,
            timestamp=1700000000000,
        )
        assert entry.superseded_by is None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FactHistoryService Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class MockClient:
    """Mock Convex client for testing."""

    def __init__(self, mutation_response=None, query_response=None):
        self.mutation_response = mutation_response or {}
        self.query_response = query_response or []
        self.last_mutation = None
        self.last_query = None

    async def mutation(self, method: str, args: dict):
        self.last_mutation = (method, args)
        return self.mutation_response

    async def query(self, method: str, args: dict):
        self.last_query = (method, args)
        return self.query_response


@pytest.mark.asyncio
class TestFactHistoryServiceLog:
    """Tests for FactHistoryService.log method."""

    async def test_log_create_event(self) -> None:
        """Should log CREATE event."""
        client = MockClient(mutation_response={"eventId": "evt-001"})
        service = FactHistoryService(client)

        result = await service.log(LogEventParams(
            fact_id="fact-123",
            memory_space_id="space-1",
            action="CREATE",
            new_value="User likes blue",
        ))

        assert result["event_id"] == "evt-001"
        assert client.last_mutation[0] == "factHistory:logEvent"
        assert client.last_mutation[1]["factId"] == "fact-123"
        assert client.last_mutation[1]["action"] == "CREATE"

    async def test_log_update_event(self) -> None:
        """Should log UPDATE event with old and new values."""
        client = MockClient(mutation_response={"eventId": "evt-002"})
        service = FactHistoryService(client)

        result = await service.log(LogEventParams(
            fact_id="fact-123",
            memory_space_id="space-1",
            action="UPDATE",
            old_value="User likes blue",
            new_value="User likes purple",
            reason="User changed preference",
        ))

        assert result["event_id"] == "evt-002"
        assert client.last_mutation[1]["oldValue"] == "User likes blue"
        assert client.last_mutation[1]["newValue"] == "User likes purple"
        assert client.last_mutation[1]["reason"] == "User changed preference"

    async def test_log_supersede_event(self) -> None:
        """Should log SUPERSEDE event with supersedes info."""
        client = MockClient(mutation_response={"eventId": "evt-003"})
        service = FactHistoryService(client)

        result = await service.log(LogEventParams(
            fact_id="fact-old",
            memory_space_id="space-1",
            action="SUPERSEDE",
            superseded_by="fact-new",
            reason="Location changed",
        ))

        assert result["event_id"] == "evt-003"
        assert client.last_mutation[1]["supersededBy"] == "fact-new"

    async def test_log_with_pipeline_info(self) -> None:
        """Should log event with pipeline information."""
        client = MockClient(mutation_response={"eventId": "evt-004"})
        service = FactHistoryService(client)

        await service.log(LogEventParams(
            fact_id="fact-123",
            memory_space_id="space-1",
            action="SUPERSEDE",
            pipeline=FactChangePipeline(
                slot_matching=True,
                semantic_matching=False,
                llm_resolution=True,
            ),
        ))

        pipeline = client.last_mutation[1]["pipeline"]
        assert pipeline["slotMatching"] is True
        assert pipeline["semanticMatching"] is False
        assert pipeline["llmResolution"] is True


@pytest.mark.asyncio
class TestFactHistoryServiceGetHistory:
    """Tests for FactHistoryService.get_history method."""

    async def test_get_history_returns_events(self) -> None:
        """Should return history events."""
        client = MockClient(query_response=[
            {
                "eventId": "evt-001",
                "factId": "fact-123",
                "memorySpaceId": "space-1",
                "action": "CREATE",
                "timestamp": 1700000000000,
            },
            {
                "eventId": "evt-002",
                "factId": "fact-123",
                "memorySpaceId": "space-1",
                "action": "UPDATE",
                "timestamp": 1700001000000,
            },
        ])
        service = FactHistoryService(client)

        events = await service.get_history("fact-123")

        assert len(events) == 2
        assert events[0].event_id == "evt-001"
        assert events[0].action == "CREATE"
        assert events[1].event_id == "evt-002"
        assert events[1].action == "UPDATE"

    async def test_get_history_with_limit(self) -> None:
        """Should pass limit to query."""
        client = MockClient(query_response=[])
        service = FactHistoryService(client)

        await service.get_history("fact-123", limit=10)

        assert client.last_query[1]["limit"] == 10

    async def test_get_history_empty(self) -> None:
        """Should handle empty history."""
        client = MockClient(query_response=[])
        service = FactHistoryService(client)

        events = await service.get_history("fact-nonexistent")

        assert len(events) == 0


@pytest.mark.asyncio
class TestFactHistoryServiceGetEvent:
    """Tests for FactHistoryService.get_event method."""

    async def test_get_event_found(self) -> None:
        """Should return event when found."""
        client = MockClient(query_response={
            "eventId": "evt-001",
            "factId": "fact-123",
            "memorySpaceId": "space-1",
            "action": "CREATE",
            "timestamp": 1700000000000,
        })
        service = FactHistoryService(client)

        event = await service.get_event("evt-001")

        assert event is not None
        assert event.event_id == "evt-001"

    async def test_get_event_not_found(self) -> None:
        """Should return None when not found."""
        client = MockClient(query_response=None)
        service = FactHistoryService(client)

        event = await service.get_event("evt-nonexistent")

        assert event is None


@pytest.mark.asyncio
class TestFactHistoryServiceGetChanges:
    """Tests for FactHistoryService.get_changes method."""

    async def test_get_changes_with_time_range(self) -> None:
        """Should query with time range."""
        client = MockClient(query_response=[])
        service = FactHistoryService(client)

        now = datetime.now()
        yesterday = now - timedelta(days=1)

        await service.get_changes(ChangeFilter(
            memory_space_id="space-1",
            after=yesterday,
            before=now,
        ))

        assert client.last_query[1]["after"] is not None
        assert client.last_query[1]["before"] is not None

    async def test_get_changes_with_action_filter(self) -> None:
        """Should query with action filter."""
        client = MockClient(query_response=[])
        service = FactHistoryService(client)

        await service.get_changes(ChangeFilter(
            memory_space_id="space-1",
            action="SUPERSEDE",
        ))

        assert client.last_query[1]["action"] == "SUPERSEDE"


@pytest.mark.asyncio
class TestFactHistoryServiceCountByAction:
    """Tests for FactHistoryService.count_by_action method."""

    async def test_count_by_action(self) -> None:
        """Should return counts by action."""
        client = MockClient(query_response={
            "CREATE": 50,
            "UPDATE": 30,
            "SUPERSEDE": 15,
            "DELETE": 5,
            "total": 100,
        })
        service = FactHistoryService(client)

        counts = await service.count_by_action("space-1")

        assert counts["CREATE"] == 50
        assert counts["UPDATE"] == 30
        assert counts["SUPERSEDE"] == 15
        assert counts["DELETE"] == 5
        assert counts["total"] == 100


@pytest.mark.asyncio
class TestFactHistoryServiceSupersessionChain:
    """Tests for FactHistoryService.get_supersession_chain method."""

    async def test_get_supersession_chain(self) -> None:
        """Should return supersession chain."""
        client = MockClient(query_response=[
            {"factId": "fact-v1", "supersededBy": "fact-v2", "timestamp": 1700000000000},
            {"factId": "fact-v2", "supersededBy": "fact-v3", "timestamp": 1700001000000},
            {"factId": "fact-v3", "supersededBy": None, "timestamp": 1700002000000},
        ])
        service = FactHistoryService(client)

        chain = await service.get_supersession_chain("fact-v3")

        assert len(chain) == 3
        assert chain[0].fact_id == "fact-v1"
        assert chain[0].superseded_by == "fact-v2"
        assert chain[2].superseded_by is None


@pytest.mark.asyncio
class TestFactHistoryServiceActivitySummary:
    """Tests for FactHistoryService.get_activity_summary method."""

    async def test_get_activity_summary(self) -> None:
        """Should return activity summary."""
        client = MockClient(query_response={
            "timeRange": {
                "hours": 24,
                "since": "2024-01-01T00:00:00Z",
                "until": "2024-01-02T00:00:00Z",
            },
            "totalEvents": 100,
            "actionCounts": {
                "CREATE": 50,
                "UPDATE": 30,
                "SUPERSEDE": 15,
                "DELETE": 5,
            },
            "uniqueFactsModified": 75,
            "activeParticipants": 10,
        })
        service = FactHistoryService(client)

        summary = await service.get_activity_summary("space-1", 24)

        assert summary.total_events == 100
        assert summary.action_counts.CREATE == 50
        assert summary.action_counts.SUPERSEDE == 15
        assert summary.unique_facts_modified == 75
        assert summary.active_participants == 10


@pytest.mark.asyncio
class TestFactHistoryServiceDeletion:
    """Tests for FactHistoryService deletion methods."""

    async def test_delete_by_fact_id(self) -> None:
        """Should delete by fact ID."""
        client = MockClient(mutation_response={"deleted": 5})
        service = FactHistoryService(client)

        result = await service.delete_by_fact_id("fact-123")

        assert result["deleted"] == 5
        assert client.last_mutation[1]["factId"] == "fact-123"

    async def test_delete_by_user_id(self) -> None:
        """Should delete by user ID (GDPR)."""
        client = MockClient(mutation_response={"deleted": 100})
        service = FactHistoryService(client)

        result = await service.delete_by_user_id("user-123")

        assert result["deleted"] == 100
        assert client.last_mutation[1]["userId"] == "user-123"

    async def test_delete_by_memory_space(self) -> None:
        """Should delete by memory space."""
        client = MockClient(mutation_response={"deleted": 500})
        service = FactHistoryService(client)

        result = await service.delete_by_memory_space("space-1")

        assert result["deleted"] == 500
        assert client.last_mutation[1]["memorySpaceId"] == "space-1"

    async def test_purge_old_events(self) -> None:
        """Should purge old events."""
        client = MockClient(mutation_response={"deleted": 1000, "remaining": 500})
        service = FactHistoryService(client)

        older_than = datetime.now() - timedelta(days=90)
        result = await service.purge_old_events(older_than, limit=1000)

        assert result["deleted"] == 1000
        assert result["remaining"] == 500


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
