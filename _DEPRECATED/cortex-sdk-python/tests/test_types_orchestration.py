"""
Unit Tests: Orchestration Types

Tests verify that the phase-aware orchestration types are correctly defined
and work as expected, including:
- LayerEvent with phase field
- MemoryLayer literal includes "context"
- OrchestrationObserver Protocol methods
- RecallSummary dataclass structure
"""

from dataclasses import fields
from typing import get_args

import pytest

from cortex.types import (
    CreatedIds,
    LayerEvent,
    LayerEventData,
    LayerEventError,
    LayerStatus,
    MemoryLayer,
    OrchestrationObserver,
    OrchestrationPhase,
    OrchestrationSummary,
    RecallContext,
    RecallSummary,
)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LayerEvent Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def test_layer_event_accepts_phase_field():
    """Test LayerEvent can be constructed with phase field."""
    event = LayerEvent(
        layer="vector",
        status="complete",
        timestamp=1234567890,
        phase="recall",
    )

    assert event.layer == "vector"
    assert event.status == "complete"
    assert event.timestamp == 1234567890
    assert event.phase == "recall"


def test_layer_event_phase_recall():
    """Test LayerEvent with phase='recall' is valid."""
    event = LayerEvent(
        layer="facts",
        status="in_progress",
        timestamp=1234567890,
        phase="recall",
    )

    assert event.phase == "recall"
    assert event.layer == "facts"


def test_layer_event_phase_remember():
    """Test LayerEvent with phase='remember' is valid."""
    event = LayerEvent(
        layer="conversation",
        status="complete",
        timestamp=1234567890,
        phase="remember",
        latency_ms=45,
    )

    assert event.phase == "remember"
    assert event.layer == "conversation"
    assert event.latency_ms == 45


def test_layer_event_with_data():
    """Test LayerEvent with optional data field."""
    data = LayerEventData(
        id="mem-123",
        preview="Found 5 memories",
        metadata={"memoryCount": 5}
    )

    event = LayerEvent(
        layer="vector",
        status="complete",
        timestamp=1234567890,
        phase="recall",
        latency_ms=100,
        data=data,
    )

    assert event.data is not None
    assert event.data.id == "mem-123"
    assert event.data.preview == "Found 5 memories"
    assert event.data.metadata == {"memoryCount": 5}


def test_layer_event_with_error():
    """Test LayerEvent with optional error field."""
    error = LayerEventError(
        message="Connection timeout",
        code="TIMEOUT"
    )

    event = LayerEvent(
        layer="graph",
        status="error",
        timestamp=1234567890,
        phase="recall",
        error=error,
    )

    assert event.status == "error"
    assert event.error is not None
    assert event.error.message == "Connection timeout"
    assert event.error.code == "TIMEOUT"


def test_layer_event_with_revision_action():
    """Test LayerEvent with revision_action for facts layer."""
    event = LayerEvent(
        layer="facts",
        status="complete",
        timestamp=1234567890,
        phase="remember",
        revision_action="SUPERSEDE",
        superseded_facts=["fact-old-1", "fact-old-2"],
    )

    assert event.revision_action == "SUPERSEDE"
    assert event.superseded_facts == ["fact-old-1", "fact-old-2"]


def test_layer_event_fields_exist():
    """Test LayerEvent has all expected fields."""
    field_names = {f.name for f in fields(LayerEvent)}

    expected_fields = {
        "layer",
        "status",
        "timestamp",
        "phase",
        "latency_ms",
        "data",
        "error",
        "revision_action",
        "superseded_facts",
    }

    assert expected_fields.issubset(field_names), f"Missing fields: {expected_fields - field_names}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MemoryLayer Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def test_memory_layer_includes_context():
    """Test MemoryLayer Literal includes 'context'."""
    valid_layers = get_args(MemoryLayer)

    assert "context" in valid_layers, "MemoryLayer must include 'context'"


def test_memory_layer_includes_all_expected_layers():
    """Test MemoryLayer Literal includes all orchestration layers."""
    valid_layers = get_args(MemoryLayer)

    expected_layers = {
        "memorySpace",
        "user",
        "agent",
        "conversation",
        "vector",
        "facts",
        "graph",
        "context",  # New layer for recall aggregation
    }

    for layer in expected_layers:
        assert layer in valid_layers, f"MemoryLayer must include '{layer}'"


def test_orchestration_phase_values():
    """Test OrchestrationPhase has correct values."""
    valid_phases = get_args(OrchestrationPhase)

    assert "recall" in valid_phases
    assert "remember" in valid_phases
    assert len(valid_phases) == 2


def test_layer_status_values():
    """Test LayerStatus has all expected values."""
    valid_statuses = get_args(LayerStatus)

    expected_statuses = {"pending", "in_progress", "complete", "error", "skipped"}

    for status in expected_statuses:
        assert status in valid_statuses, f"LayerStatus must include '{status}'"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# OrchestrationObserver Protocol Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def test_orchestration_observer_has_recall_start():
    """Test OrchestrationObserver Protocol has on_recall_start method."""
    assert hasattr(OrchestrationObserver, "on_recall_start")


def test_orchestration_observer_has_recall_complete():
    """Test OrchestrationObserver Protocol has on_recall_complete method."""
    assert hasattr(OrchestrationObserver, "on_recall_complete")


def test_orchestration_observer_has_remember_start():
    """Test OrchestrationObserver Protocol has on_remember_start method."""
    assert hasattr(OrchestrationObserver, "on_remember_start")


def test_orchestration_observer_has_remember_complete():
    """Test OrchestrationObserver Protocol has on_remember_complete method."""
    assert hasattr(OrchestrationObserver, "on_remember_complete")


def test_orchestration_observer_has_layer_update():
    """Test OrchestrationObserver Protocol has on_layer_update method."""
    assert hasattr(OrchestrationObserver, "on_layer_update")


def test_orchestration_observer_protocol_is_implementable():
    """Test that a class can implement OrchestrationObserver Protocol."""
    class MyObserver:
        def on_recall_start(self, orchestration_id: str) -> None:
            pass

        def on_recall_complete(self, summary: RecallSummary) -> None:
            pass

        def on_remember_start(self, orchestration_id: str) -> None:
            pass

        def on_remember_complete(self, summary: OrchestrationSummary) -> None:
            pass

        def on_layer_update(self, event: LayerEvent) -> None:
            pass

    # Verify class can be instantiated
    observer = MyObserver()
    assert observer is not None

    # Verify methods are callable
    observer.on_recall_start("test-id")
    observer.on_layer_update(LayerEvent(
        layer="vector",
        status="complete",
        timestamp=123,
        phase="recall",
    ))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RecallSummary Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def test_recall_summary_dataclass_structure():
    """Test RecallSummary dataclass has correct structure."""
    field_names = {f.name for f in fields(RecallSummary)}

    expected_fields = {
        "orchestration_id",
        "total_latency_ms",
        "layers",
        "context",
        "phase",
    }

    assert expected_fields.issubset(field_names), f"Missing fields: {expected_fields - field_names}"


def test_recall_summary_can_be_constructed():
    """Test RecallSummary can be constructed with valid data."""
    context = RecallContext(
        memories_count=5,
        facts_count=3,
        graph_entities_count=2,
        formatted="## Retrieved Context\n- Memory 1\n- Fact 1",
    )

    summary = RecallSummary(
        orchestration_id="recall_abc123",
        total_latency_ms=150,
        layers={
            "vector": LayerEvent(
                layer="vector",
                status="complete",
                timestamp=123,
                phase="recall",
            )
        },
        context=context,
        phase="recall",
    )

    assert summary.orchestration_id == "recall_abc123"
    assert summary.total_latency_ms == 150
    assert "vector" in summary.layers
    assert summary.context.memories_count == 5
    assert summary.context.facts_count == 3
    assert summary.context.graph_entities_count == 2
    assert summary.phase == "recall"


def test_recall_summary_phase_is_recall():
    """Test RecallSummary phase field defaults to 'recall'."""
    context = RecallContext(
        memories_count=0,
        facts_count=0,
        graph_entities_count=0,
    )

    summary = RecallSummary(
        orchestration_id="test",
        total_latency_ms=100,
        layers={},
        context=context,
    )

    assert summary.phase == "recall"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RecallContext Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def test_recall_context_dataclass_structure():
    """Test RecallContext dataclass has correct structure."""
    field_names = {f.name for f in fields(RecallContext)}

    expected_fields = {
        "memories_count",
        "facts_count",
        "graph_entities_count",
        "formatted",
    }

    assert expected_fields == field_names


def test_recall_context_can_be_constructed():
    """Test RecallContext can be constructed."""
    context = RecallContext(
        memories_count=10,
        facts_count=5,
        graph_entities_count=3,
        formatted="Formatted context string",
    )

    assert context.memories_count == 10
    assert context.facts_count == 5
    assert context.graph_entities_count == 3
    assert context.formatted == "Formatted context string"


def test_recall_context_formatted_optional():
    """Test RecallContext formatted field is optional."""
    context = RecallContext(
        memories_count=1,
        facts_count=0,
        graph_entities_count=0,
    )

    assert context.formatted is None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# OrchestrationSummary Tests (Remember phase)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def test_orchestration_summary_dataclass_structure():
    """Test OrchestrationSummary dataclass has correct structure."""
    field_names = {f.name for f in fields(OrchestrationSummary)}

    expected_fields = {
        "orchestration_id",
        "total_latency_ms",
        "layers",
        "created_ids",
        "phase",
    }

    assert expected_fields.issubset(field_names), f"Missing fields: {expected_fields - field_names}"


def test_orchestration_summary_can_be_constructed():
    """Test OrchestrationSummary can be constructed with valid data."""
    created = CreatedIds(
        conversation_id="conv-123",
        memory_ids=["mem-1", "mem-2"],
        fact_ids=["fact-1"],
    )

    summary = OrchestrationSummary(
        orchestration_id="orch_xyz789",
        total_latency_ms=200,
        layers={
            "conversation": LayerEvent(
                layer="conversation",
                status="complete",
                timestamp=123,
                phase="remember",
            )
        },
        created_ids=created,
        phase="remember",
    )

    assert summary.orchestration_id == "orch_xyz789"
    assert summary.total_latency_ms == 200
    assert "conversation" in summary.layers
    assert summary.created_ids.conversation_id == "conv-123"
    assert summary.created_ids.memory_ids == ["mem-1", "mem-2"]
    assert summary.phase == "remember"


def test_orchestration_summary_phase_is_remember():
    """Test OrchestrationSummary phase field defaults to 'remember'."""
    summary = OrchestrationSummary(
        orchestration_id="test",
        total_latency_ms=100,
        layers={},
        created_ids=CreatedIds(),
    )

    assert summary.phase == "remember"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CreatedIds Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def test_created_ids_dataclass_structure():
    """Test CreatedIds dataclass has correct structure."""
    field_names = {f.name for f in fields(CreatedIds)}

    expected_fields = {
        "conversation_id",
        "memory_ids",
        "fact_ids",
    }

    assert expected_fields == field_names


def test_created_ids_all_fields_optional():
    """Test CreatedIds all fields are optional."""
    created = CreatedIds()

    assert created.conversation_id is None
    assert created.memory_ids is None
    assert created.fact_ids is None
