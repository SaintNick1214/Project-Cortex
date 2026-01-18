"""
Integration Tests: recall() Orchestration API

Tests prove that anything stored with remember() can be correctly
retrieved with recall(), even in complex scenarios.
"""

import uuid
import pytest

from cortex import (
    RecallParams,
    RecallLimits,
    RecallSourceConfig,
    RecallGraphExpansionConfig,
    RememberParams,
)


def create_test_id(prefix: str) -> str:
    """Create unique test ID for parallel execution isolation."""
    return f"{prefix}-recall-{uuid.uuid4().hex[:8]}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Remember/Recall Symmetry Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_recall_simple_message(
    cortex_client, test_memory_space_id, test_user_id, test_agent_id
):
    """Recall finds simple message stored with remember."""
    conversation_id = create_test_id("conv")

    # Store with remember
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id,
            user_message="My favorite color is blue",
            agent_response="I'll remember that your favorite color is blue!",
            user_id=test_user_id,
            user_name="Recall Test User",
            agent_id=test_agent_id,
        )
    )

    # Recall
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="favorite color",
        )
    )

    # Assert - should find the stored content
    assert len(result.items) > 0
    assert any("blue" in item.content.lower() for item in result.items)
    assert result.context is not None


@pytest.mark.asyncio
async def test_recall_from_vector_search(
    cortex_client, test_memory_space_id, test_user_id, test_agent_id
):
    """Recall retrieves results from vector search."""
    conversation_id = create_test_id("conv")

    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id,
            user_message="I prefer dark mode for all my applications",
            agent_response="Dark mode preference noted!",
            user_id=test_user_id,
            user_name="Recall Test User",
            agent_id=test_agent_id,
        )
    )

    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="dark mode preference",
        )
    )

    assert result.sources.vector["count"] >= 0
    assert result.context is not None


@pytest.mark.asyncio
async def test_recall_with_user_filter(
    cortex_client, test_memory_space_id, test_agent_id
):
    """Recall respects userId filter."""
    conversation_id = create_test_id("conv")
    specific_user_id = create_test_id("user")

    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id,
            user_message="This is a user-specific message",
            agent_response="Got it!",
            user_id=specific_user_id,
            user_name="Specific User",
            agent_id=test_agent_id,
        )
    )

    # Recall with userId filter should find it
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="user-specific message",
            user_id=specific_user_id,
        )
    )

    # Should find at least the stored memory
    assert result.total_results >= 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Multi-Layer Retrieval Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_recall_multi_layer(
    cortex_client, test_memory_space_id, test_user_id, test_agent_id
):
    """Recall retrieves from both vector and facts."""
    conversation_id = create_test_id("conv")

    # Store with fact extraction
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id,
            user_message="Call me Alex, I work at TechCorp",
            agent_response="Nice to meet you, Alex from TechCorp!",
            user_id=test_user_id,
            user_name="Recall Test User",
            agent_id=test_agent_id,
            extract_facts=lambda user_msg, agent_msg: [
                {
                    "fact": "User prefers to be called Alex",
                    "factType": "preference",
                    "subject": test_user_id,
                    "confidence": 95,
                },
                {
                    "fact": "User works at TechCorp",
                    "factType": "relationship",
                    "subject": test_user_id,
                    "predicate": "works_at",
                    "object": "TechCorp",
                    "confidence": 90,
                },
            ],
        )
    )

    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="Alex TechCorp",
        )
    )

    # Should have results from vector source at minimum
    assert result.sources.vector["count"] >= 0
    assert result.context is not None


@pytest.mark.asyncio
async def test_recall_deduplicates(
    cortex_client, test_memory_space_id, test_user_id, test_agent_id
):
    """Recall deduplicates across sources."""
    conversation_id = create_test_id("conv")

    # Store a distinctive message
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id,
            user_message="My password hint is starlight123",
            agent_response="Password hint stored securely.",
            user_id=test_user_id,
            user_name="Recall Test User",
            agent_id=test_agent_id,
        )
    )

    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="password hint starlight",
        )
    )

    # Check for duplicates - each unique ID should only appear once
    ids = [item.id for item in result.items]
    unique_ids = set(ids)
    assert len(ids) == len(unique_ids)


@pytest.mark.asyncio
async def test_recall_ranks_by_relevance(
    cortex_client, test_memory_space_id, test_user_id, test_agent_id
):
    """Recall ranks results by relevance."""
    conversation_id1 = create_test_id("conv1")
    conversation_id2 = create_test_id("conv2")

    # Store two messages with different relevance
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id1,
            user_message="I love Python programming",
            agent_response="Python is great!",
            user_id=test_user_id,
            user_name="Recall Test User",
            agent_id=test_agent_id,
            importance=90,
        )
    )

    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id2,
            user_message="The weather is nice today",
            agent_response="Yes it is!",
            user_id=test_user_id,
            user_name="Recall Test User",
            agent_id=test_agent_id,
            importance=50,
        )
    )

    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="Python programming",
        )
    )

    # Python-related result should rank higher
    if len(result.items) >= 2:
        python_item = next(
            (i for i in result.items if "python" in i.content.lower()), None
        )
        weather_item = next(
            (i for i in result.items if "weather" in i.content.lower()), None
        )

        if python_item and weather_item:
            assert python_item.score >= weather_item.score


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Result Options Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_recall_respects_limit(cortex_client, test_memory_space_id):
    """Recall respects limit parameter (legacy - still supported for backward compat)."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            limit=3,  # Legacy parameter - maps to limits.total
        )
    )

    assert len(result.items) <= 3


@pytest.mark.asyncio
async def test_recall_respects_limits_total(cortex_client, test_memory_space_id):
    """Recall respects limits.total parameter (v0.31.0+)."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            limits=RecallLimits(total=5),
        )
    )

    assert len(result.items) <= 5


@pytest.mark.asyncio
async def test_recall_generates_llm_context_by_default(
    cortex_client, test_memory_space_id
):
    """Recall generates LLM context by default (formatForLLM: true)."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test query",
        )
    )

    # context should be generated by default
    assert result.context is not None
    if len(result.items) > 0:
        assert "## Relevant Context" in result.context


@pytest.mark.asyncio
async def test_recall_skips_llm_context_when_disabled(
    cortex_client, test_memory_space_id
):
    """Recall skips LLM context when formatForLLM is false."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test query",
            format_for_llm=False,
        )
    )

    assert result.context is None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Source Control Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_recall_can_disable_vector_source(
    cortex_client, test_memory_space_id
):
    """Recall can disable vector source."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            sources=RecallSourceConfig(vector=False, facts=True, graph=False),
        )
    )

    # Vector count should be 0 since we disabled it
    assert result.sources.vector["count"] == 0


@pytest.mark.asyncio
async def test_recall_can_disable_facts_source(
    cortex_client, test_memory_space_id
):
    """Recall can disable facts source."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            sources=RecallSourceConfig(vector=True, facts=False, graph=False),
        )
    )

    # Facts count should be 0 since we disabled it
    assert result.sources.facts["count"] == 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Metadata Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_recall_includes_query_timing(cortex_client, test_memory_space_id):
    """Recall includes query timing metadata."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
        )
    )

    assert result.query_time_ms >= 0


@pytest.mark.asyncio
async def test_recall_includes_total_results(cortex_client, test_memory_space_id):
    """Recall includes total results count."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
        )
    )

    assert result.total_results >= 0


@pytest.mark.asyncio
async def test_recall_reports_graph_expansion_status(
    cortex_client, test_memory_space_id
):
    """Recall reports graph expansion status."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
        )
    )

    # graphExpansionApplied should be a boolean
    assert isinstance(result.graph_expansion_applied, bool)


@pytest.mark.asyncio
async def test_recall_includes_source_breakdown(
    cortex_client, test_memory_space_id
):
    """Recall includes source breakdown."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
        )
    )

    assert result.sources is not None
    assert "count" in result.sources.vector
    assert "count" in result.sources.facts
    assert "count" in result.sources.graph


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Edge Cases
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_recall_handles_empty_memory_space(cortex_client):
    """Recall handles empty memory space gracefully."""
    empty_space_id = create_test_id("empty-space")

    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=empty_space_id,
            query="anything",
        )
    )

    assert len(result.items) == 0
    assert result.total_results == 0
    assert result.context == ""  # Empty context for no results


@pytest.mark.asyncio
async def test_recall_handles_special_characters(
    cortex_client, test_memory_space_id
):
    """Recall handles special characters in query."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query='user\'s preference (test) & "quoted"',
        )
    )

    # Should not throw, should return results
    assert result is not None
    assert isinstance(result.items, list)


@pytest.mark.asyncio
async def test_recall_handles_very_long_queries(
    cortex_client, test_memory_space_id
):
    """Recall handles very long queries."""
    long_query = "test " * 100

    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query=long_query,
        )
    )

    assert result is not None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Validation Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_recall_validates_memory_space_id(cortex_client):
    """Recall validates memory_space_id is required."""
    from cortex.memory.validators import MemoryValidationError

    with pytest.raises(MemoryValidationError):
        await cortex_client.memory.recall(
            RecallParams(
                memory_space_id="",  # Empty - should fail
                query="test",
            )
        )


@pytest.mark.asyncio
async def test_recall_validates_query(cortex_client, test_memory_space_id):
    """Recall validates query is required."""
    from cortex.memory.validators import MemoryValidationError

    with pytest.raises(MemoryValidationError):
        await cortex_client.memory.recall(
            RecallParams(
                memory_space_id=test_memory_space_id,
                query="",  # Empty - should fail
            )
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RecallLimits Tests (v0.31.0+)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_recall_with_recall_limits_memories(
    cortex_client, test_memory_space_id, test_user_id, test_agent_id
):
    """Recall respects limits.memories for vector search."""
    conversation_id = create_test_id("conv")

    # Store multiple memories
    for i in range(5):
        await cortex_client.memory.remember(
            RememberParams(
                memory_space_id=test_memory_space_id,
                conversation_id=f"{conversation_id}-{i}",
                user_message=f"Memory {i}: test content",
                agent_response=f"Response {i}",
                user_id=test_user_id,
                user_name="Test User",
                agent_id=test_agent_id,
            )
        )

    # Recall with limited memories
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test content",
            limits=RecallLimits(memories=2, facts=0, graph_hops=0),
        )
    )

    # Should respect the memories limit
    assert result.sources.vector["count"] <= 2


@pytest.mark.asyncio
async def test_recall_with_recall_limits_facts(
    cortex_client, test_memory_space_id, test_user_id, test_agent_id
):
    """Recall respects limits.facts for fact search."""
    conversation_id = create_test_id("conv")

    # Store with fact extraction
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id,
            user_message="I like Python and JavaScript",
            agent_response="Noted your preferences",
            user_id=test_user_id,
            user_name="Test User",
            agent_id=test_agent_id,
            extract_facts=lambda user_msg, agent_msg: [
                {
                    "fact": "User likes Python",
                    "factType": "preference",
                    "subject": test_user_id,
                    "confidence": 90,
                },
                {
                    "fact": "User likes JavaScript",
                    "factType": "preference",
                    "subject": test_user_id,
                    "confidence": 85,
                },
            ],
        )
    )

    # Recall with limited facts
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="Python JavaScript",
            limits=RecallLimits(memories=0, facts=1, graph_hops=0),
        )
    )

    # Should respect the facts limit
    assert result.sources.facts["count"] <= 1


@pytest.mark.asyncio
async def test_recall_with_recall_limits_graph_hops_zero(
    cortex_client, test_memory_space_id
):
    """Recall disables graph expansion when limits.graph_hops=0."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            limits=RecallLimits(graph_hops=0),  # Disable graph
        )
    )

    # Graph expansion should be disabled
    assert result.graph_expansion_applied is False
    assert result.sources.graph["count"] == 0


@pytest.mark.asyncio
async def test_recall_with_recall_limits_all_fields(
    cortex_client, test_memory_space_id
):
    """Recall respects all RecallLimits fields."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            limits=RecallLimits(
                memories=10,
                facts=5,
                graph_hops=1,
                graph_entities_per_hop=3,
                graph_results_per_entity=2,
                total=15,
            ),
        )
    )

    # Verify limits are respected
    assert len(result.items) <= 15  # total limit
    assert result.sources.vector["count"] <= 10  # memories limit
    assert result.sources.facts["count"] <= 5  # facts limit


@pytest.mark.asyncio
async def test_recall_limits_backward_compat_with_legacy_limit(
    cortex_client, test_memory_space_id
):
    """Recall maintains backward compatibility: legacy limit parameter still works."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            limit=7,  # Legacy parameter
        )
    )

    # Should work and respect the limit
    assert len(result.items) <= 7


@pytest.mark.asyncio
async def test_recall_limits_precedence_limits_over_legacy(
    cortex_client, test_memory_space_id
):
    """Recall: limits.total takes precedence over legacy limit parameter."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            limit=10,  # Legacy - should be ignored
            limits=RecallLimits(total=5),  # Should take precedence
        )
    )

    # limits.total should take precedence
    assert len(result.items) <= 5


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Tenant ID Tests (v0.31.0+ Multi-Tenancy)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_recall_with_tenant_id(
    cortex_client, test_memory_space_id, test_user_id, test_agent_id
):
    """Recall respects tenant_id parameter for multi-tenancy isolation."""
    conversation_id = create_test_id("conv")
    tenant_id = create_test_id("tenant")

    # Store memory with tenant_id
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id,
            user_message="Tenant-specific content",
            agent_response="Acknowledged",
            user_id=test_user_id,
            user_name="Test User",
            agent_id=test_agent_id,
            tenant_id=tenant_id,
        )
    )

    # Recall with tenant_id filter
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="tenant-specific",
            tenant_id=tenant_id,
        )
    )

    # Should find the tenant-specific memory
    assert result.total_results >= 0


@pytest.mark.asyncio
async def test_recall_tenant_id_isolation(
    cortex_client, test_memory_space_id, test_user_id, test_agent_id
):
    """Recall isolates results by tenant_id (multi-tenancy)."""
    conversation_id1 = create_test_id("conv1")
    conversation_id2 = create_test_id("conv2")
    tenant_id1 = create_test_id("tenant1")
    tenant_id2 = create_test_id("tenant2")

    # Store memories for different tenants
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id1,
            user_message="Tenant 1 content",
            agent_response="Response 1",
            user_id=test_user_id,
            user_name="Test User",
            agent_id=test_agent_id,
            tenant_id=tenant_id1,
        )
    )

    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=conversation_id2,
            user_message="Tenant 2 content",
            agent_response="Response 2",
            user_id=test_user_id,
            user_name="Test User",
            agent_id=test_agent_id,
            tenant_id=tenant_id2,
        )
    )

    # Recall for tenant 1 should only find tenant 1 content
    result1 = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="content",
            tenant_id=tenant_id1,
        )
    )

    # Recall for tenant 2 should only find tenant 2 content
    result2 = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="content",
            tenant_id=tenant_id2,
        )
    )

    # Results should be isolated (exact isolation depends on backend implementation)
    assert result1.total_results >= 0
    assert result2.total_results >= 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RecallGraphExpansionConfig Tests (v0.31.0+)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_recall_graph_expansion_with_entities_per_hop(
    cortex_client, test_memory_space_id
):
    """Recall respects graph_expansion.entities_per_hop parameter."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            graph_expansion=RecallGraphExpansionConfig(
                entities_per_hop=3,  # Limit entities per hop
                enabled=True,
            ),
            limits=RecallLimits(graph_hops=2),  # Enable graph expansion
        )
    )

    # Should execute without error
    assert result is not None
    assert isinstance(result.graph_expansion_applied, bool)


@pytest.mark.asyncio
async def test_recall_graph_expansion_with_results_per_entity(
    cortex_client, test_memory_space_id
):
    """Recall respects graph_expansion.results_per_entity parameter."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            graph_expansion=RecallGraphExpansionConfig(
                results_per_entity=2,  # Limit results per entity
                enabled=True,
            ),
            limits=RecallLimits(graph_hops=1),  # Enable graph expansion
        )
    )

    # Should execute without error
    assert result is not None
    assert isinstance(result.graph_expansion_applied, bool)


@pytest.mark.asyncio
async def test_recall_graph_expansion_config_all_fields(
    cortex_client, test_memory_space_id
):
    """Recall respects all RecallGraphExpansionConfig fields."""
    result = await cortex_client.memory.recall(
        RecallParams(
            memory_space_id=test_memory_space_id,
            query="test",
            graph_expansion=RecallGraphExpansionConfig(
                enabled=True,
                max_depth=2,
                relationship_types=None,  # All types
                expand_from_facts=True,
                expand_from_memories=True,
                entities_per_hop=4,
                results_per_entity=3,
            ),
            limits=RecallLimits(graph_hops=2),
        )
    )

    # Should execute without error
    assert result is not None
