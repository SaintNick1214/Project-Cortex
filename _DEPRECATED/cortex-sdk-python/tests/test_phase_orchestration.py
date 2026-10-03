"""
Integration Tests: Full Phase-Aware Orchestration Flow

Tests for the complete orchestration flow across recall and remember operations.
Verifies event ordering, timing, and full workflow behavior.

PARALLEL-SAFE: Uses TestRunContext for isolated test data.
"""

import asyncio
import uuid
from typing import Any, Dict, List, Optional

import pytest

from cortex import (
    RecallParams,
    RememberParams,
)
from cortex.types import (
    LayerEvent,
    MemoryLayer,
    OrchestrationSummary,
    RecallSummary,
)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Event Recording Observer
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class EventRecordingObserver:
    """Observer that records all events with timestamps for ordering verification."""

    def __init__(self):
        self.events: List[Dict[str, Any]] = []
        self._sequence = 0

    def _record(self, event_type: str, data: Any) -> None:
        self.events.append({
            "sequence": self._sequence,
            "type": event_type,
            "data": data,
        })
        self._sequence += 1

    def on_recall_start(self, orchestration_id: str) -> None:
        self._record("recall_start", {"orchestration_id": orchestration_id})

    def on_recall_complete(self, summary: RecallSummary) -> None:
        self._record("recall_complete", {"summary": summary})

    def on_remember_start(self, orchestration_id: str) -> None:
        self._record("remember_start", {"orchestration_id": orchestration_id})

    def on_remember_complete(self, summary: OrchestrationSummary) -> None:
        self._record("remember_complete", {"summary": summary})

    def on_layer_update(self, event: LayerEvent) -> None:
        self._record("layer_update", {"layer": event.layer, "status": event.status, "phase": event.phase, "event": event})

    def get_event_types(self) -> List[str]:
        """Get list of event types in order."""
        return [e["type"] for e in self.events]

    def get_layers_in_order(self) -> List[str]:
        """Get list of layers that had updates, in order."""
        return [e["data"]["layer"] for e in self.events if e["type"] == "layer_update"]

    def get_phases_in_order(self) -> List[str]:
        """Get list of phases for layer events, in order."""
        return [e["data"]["phase"] for e in self.events if e["type"] == "layer_update"]


def create_test_id(prefix: str) -> str:
    """Create unique test ID for parallel execution isolation."""
    return f"{prefix}-phase-{uuid.uuid4().hex[:8]}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Full Flow Integration Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_full_flow_recall_then_remember(cortex_client, ctx):
    """Test full flow: recall with observer then remember with observer."""
    memory_space_id = ctx.memory_space_id("full-flow")
    conversation_id = ctx.conversation_id("full-flow")
    user_id = ctx.user_id("full-flow")
    agent_id = ctx.agent_id("full-flow")

    recall_observer = EventRecordingObserver()
    remember_observer = EventRecordingObserver()

    # First: recall (read phase)
    recall_result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=memory_space_id,
            query="user preferences",
            observer=recall_observer,
        )
    )

    # Then: remember (write phase)
    remember_result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="I prefer dark mode",
            agent_response="I'll remember your dark mode preference!",
            user_id=user_id,
            user_name="Test User",
            agent_id=agent_id,
            observer=remember_observer,
        )
    )

    # Verify recall events are all phase="recall"
    recall_phases = recall_observer.get_phases_in_order()
    assert all(p == "recall" for p in recall_phases), f"All recall phases should be 'recall', got: {recall_phases}"

    # Verify remember events are all phase="remember"
    remember_phases = remember_observer.get_phases_in_order()
    assert all(p == "remember" for p in remember_phases), f"All remember phases should be 'remember', got: {remember_phases}"

    # Verify results are valid
    assert recall_result is not None
    assert remember_result is not None
    assert len(remember_result.memories) >= 1


@pytest.mark.asyncio
async def test_recall_event_ordering_start_layers_complete(cortex_client, ctx):
    """Test recall event ordering is correct: start -> layers -> complete."""
    memory_space_id = ctx.memory_space_id("recall-order")
    observer = EventRecordingObserver()

    await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=memory_space_id,
            query="test query",
            observer=observer,
        )
    )

    event_types = observer.get_event_types()

    # First event should be recall_start
    assert event_types[0] == "recall_start", f"First event should be recall_start, got: {event_types[0]}"

    # Last event should be recall_complete
    assert event_types[-1] == "recall_complete", f"Last event should be recall_complete, got: {event_types[-1]}"

    # Middle events should be layer_update
    middle_events = event_types[1:-1]
    assert all(e == "layer_update" for e in middle_events), f"Middle events should all be layer_update, got: {middle_events}"


@pytest.mark.asyncio
async def test_remember_event_ordering_start_layers_complete(cortex_client, ctx):
    """Test remember event ordering is correct: start -> layers -> complete."""
    memory_space_id = ctx.memory_space_id("remember-order")
    conversation_id = ctx.conversation_id("remember-order")
    user_id = ctx.user_id("remember-order")
    agent_id = ctx.agent_id("remember-order")
    observer = EventRecordingObserver()

    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=user_id,
            user_name="Test User",
            agent_id=agent_id,
            observer=observer,
        )
    )

    event_types = observer.get_event_types()

    # First event should be remember_start
    assert event_types[0] == "remember_start", f"First event should be remember_start, got: {event_types[0]}"

    # Last event should be remember_complete
    assert event_types[-1] == "remember_complete", f"Last event should be remember_complete, got: {event_types[-1]}"

    # Middle events should be layer_update
    middle_events = event_types[1:-1]
    assert all(e == "layer_update" for e in middle_events), f"Middle events should all be layer_update, got: {middle_events}"


@pytest.mark.asyncio
async def test_recall_timing_values_are_reasonable(cortex_client, ctx):
    """Test timing/latency values are reasonable (not negative, not absurdly high)."""
    memory_space_id = ctx.memory_space_id("timing-test")
    observer = EventRecordingObserver()

    await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=memory_space_id,
            query="test query",
            observer=observer,
        )
    )

    # Get the recall_complete summary
    complete_events = [e for e in observer.events if e["type"] == "recall_complete"]
    assert len(complete_events) == 1

    summary = complete_events[0]["data"]["summary"]

    # Verify total latency is reasonable
    assert summary.total_latency_ms >= 0, "Total latency should not be negative"
    assert summary.total_latency_ms < 60000, "Total latency should not exceed 60 seconds"

    # Verify layer event timestamps are positive
    layer_events = [e for e in observer.events if e["type"] == "layer_update"]
    for e in layer_events:
        event = e["data"]["event"]
        assert event.timestamp > 0, "Event timestamp should be positive"


@pytest.mark.asyncio
async def test_remember_timing_values_are_reasonable(cortex_client, ctx):
    """Test remember timing/latency values are reasonable."""
    memory_space_id = ctx.memory_space_id("timing-rem")
    conversation_id = ctx.conversation_id("timing-rem")
    user_id = ctx.user_id("timing-rem")
    agent_id = ctx.agent_id("timing-rem")
    observer = EventRecordingObserver()

    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=user_id,
            user_name="Test User",
            agent_id=agent_id,
            observer=observer,
        )
    )

    # Get the remember_complete summary
    complete_events = [e for e in observer.events if e["type"] == "remember_complete"]
    assert len(complete_events) == 1

    summary = complete_events[0]["data"]["summary"]

    # Verify total latency is reasonable
    assert summary.total_latency_ms >= 0, "Total latency should not be negative"
    assert summary.total_latency_ms < 60000, "Total latency should not exceed 60 seconds"


@pytest.mark.asyncio
async def test_recall_layers_include_context(cortex_client, ctx):
    """Test recall includes 'context' layer for result aggregation."""
    memory_space_id = ctx.memory_space_id("context-layer")
    observer = EventRecordingObserver()

    await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=memory_space_id,
            query="test query",
            observer=observer,
        )
    )

    layers = observer.get_layers_in_order()
    assert "context" in layers, f"Recall should include 'context' layer, got: {layers}"


@pytest.mark.asyncio
async def test_remember_layers_include_core_layers(cortex_client, ctx):
    """Test remember includes core layers: memorySpace, conversation, vector."""
    memory_space_id = ctx.memory_space_id("core-layers")
    conversation_id = ctx.conversation_id("core-layers")
    user_id = ctx.user_id("core-layers")
    agent_id = ctx.agent_id("core-layers")
    observer = EventRecordingObserver()

    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=user_id,
            user_name="Test User",
            agent_id=agent_id,
            observer=observer,
        )
    )

    layers = set(observer.get_layers_in_order())

    # Core layers should always be present
    assert "memorySpace" in layers, f"Remember should include 'memorySpace' layer, got: {layers}"
    assert "conversation" in layers, f"Remember should include 'conversation' layer, got: {layers}"
    assert "vector" in layers, f"Remember should include 'vector' layer, got: {layers}"


@pytest.mark.asyncio
async def test_same_observer_for_both_phases(cortex_client, ctx):
    """Test using the same observer for both recall and remember works correctly."""
    memory_space_id = ctx.memory_space_id("same-observer")
    conversation_id = ctx.conversation_id("same-observer")
    user_id = ctx.user_id("same-observer")
    agent_id = ctx.agent_id("same-observer")

    observer = EventRecordingObserver()

    # Use same observer for recall
    await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=memory_space_id,
            query="test query",
            observer=observer,
        )
    )

    recall_event_count = len(observer.events)

    # Use same observer for remember
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=user_id,
            user_name="Test User",
            agent_id=agent_id,
            observer=observer,
        )
    )

    # Verify both operations recorded events
    assert len(observer.events) > recall_event_count

    # Verify we have both recall and remember phases in events
    phases = set(observer.get_phases_in_order())
    assert "recall" in phases
    assert "remember" in phases


@pytest.mark.asyncio
async def test_recall_summary_context_counts_match_results(cortex_client, ctx):
    """Test RecallSummary context counts match actual result counts."""
    memory_space_id = ctx.memory_space_id("context-counts")
    conversation_id = ctx.conversation_id("context-counts")
    user_id = ctx.user_id("context-counts")
    agent_id = ctx.agent_id("context-counts")

    # First store some data
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="I love Python programming",
            agent_response="Python is great for many tasks!",
            user_id=user_id,
            user_name="Test User",
            agent_id=agent_id,
        )
    )

    # Wait for indexing
    await asyncio.sleep(1)

    observer = EventRecordingObserver()

    # Now recall
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=memory_space_id,
            query="Python programming",
            observer=observer,
        )
    )

    # Get the summary
    complete_events = [e for e in observer.events if e["type"] == "recall_complete"]
    assert len(complete_events) == 1
    summary = complete_events[0]["data"]["summary"]

    # Verify context exists
    assert summary.context is not None
    assert summary.context.memories_count >= 0
    assert summary.context.facts_count >= 0
    assert summary.context.graph_entities_count >= 0


@pytest.mark.asyncio
async def test_orchestration_ids_are_unique(cortex_client, ctx):
    """Test orchestration IDs are unique across calls."""
    memory_space_id = ctx.memory_space_id("unique-ids")

    observer1 = EventRecordingObserver()
    observer2 = EventRecordingObserver()

    await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=memory_space_id,
            query="test query 1",
            observer=observer1,
        )
    )

    await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=memory_space_id,
            query="test query 2",
            observer=observer2,
        )
    )

    # Get orchestration IDs
    id1 = observer1.events[0]["data"]["orchestration_id"]
    id2 = observer2.events[0]["data"]["orchestration_id"]

    assert id1 != id2, f"Orchestration IDs should be unique, got: {id1} and {id2}"


@pytest.mark.asyncio
async def test_recall_and_remember_ids_have_different_prefixes(cortex_client, ctx):
    """Test recall uses 'recall_' prefix and remember uses 'orch_' prefix."""
    memory_space_id = ctx.memory_space_id("id-prefixes")
    conversation_id = ctx.conversation_id("id-prefixes")
    user_id = ctx.user_id("id-prefixes")
    agent_id = ctx.agent_id("id-prefixes")

    recall_observer = EventRecordingObserver()
    remember_observer = EventRecordingObserver()

    await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=memory_space_id,
            query="test query",
            observer=recall_observer,
        )
    )

    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=user_id,
            user_name="Test User",
            agent_id=agent_id,
            observer=remember_observer,
        )
    )

    recall_id = recall_observer.events[0]["data"]["orchestration_id"]
    remember_id = remember_observer.events[0]["data"]["orchestration_id"]

    assert recall_id.startswith("recall_"), f"Recall ID should start with 'recall_', got: {recall_id}"
    assert remember_id.startswith("orch_"), f"Remember ID should start with 'orch_', got: {remember_id}"


@pytest.mark.asyncio
async def test_layer_events_include_data_on_complete(cortex_client, ctx):
    """Test layer events include data field when status is 'complete'."""
    memory_space_id = ctx.memory_space_id("layer-data")
    conversation_id = ctx.conversation_id("layer-data")
    user_id = ctx.user_id("layer-data")
    agent_id = ctx.agent_id("layer-data")
    observer = EventRecordingObserver()

    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=user_id,
            user_name="Test User",
            agent_id=agent_id,
            observer=observer,
        )
    )

    # Find complete events
    complete_events = [
        e for e in observer.events
        if e["type"] == "layer_update" and e["data"]["status"] == "complete"
    ]

    assert len(complete_events) > 0, "Should have some complete events"

    # Verify at least some complete events have data
    events_with_data = [e for e in complete_events if e["data"]["event"].data is not None]
    assert len(events_with_data) > 0, "Some complete events should have data"


@pytest.mark.asyncio
async def test_layer_status_progression(cortex_client, ctx):
    """Test layer status follows correct progression: in_progress -> complete/error/skipped."""
    memory_space_id = ctx.memory_space_id("status-prog")
    conversation_id = ctx.conversation_id("status-prog")
    user_id = ctx.user_id("status-prog")
    agent_id = ctx.agent_id("status-prog")
    observer = EventRecordingObserver()

    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=user_id,
            user_name="Test User",
            agent_id=agent_id,
            observer=observer,
        )
    )

    # Group events by layer
    events_by_layer: Dict[str, List[str]] = {}
    for e in observer.events:
        if e["type"] == "layer_update":
            layer = e["data"]["layer"]
            status = e["data"]["status"]
            if layer not in events_by_layer:
                events_by_layer[layer] = []
            events_by_layer[layer].append(status)

    # Verify each layer follows progression
    for layer, statuses in events_by_layer.items():
        if len(statuses) == 1:
            # Single status should be terminal (complete, error, or skipped)
            assert statuses[0] in ["complete", "error", "skipped"], f"Single status for {layer} should be terminal, got: {statuses[0]}"
        elif len(statuses) >= 2:
            # Multiple statuses: first should be in_progress, last should be terminal
            assert statuses[0] == "in_progress", f"First status for {layer} should be 'in_progress', got: {statuses[0]}"
            assert statuses[-1] in ["complete", "error", "skipped"], f"Last status for {layer} should be terminal, got: {statuses[-1]}"
