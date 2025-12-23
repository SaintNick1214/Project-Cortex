"""
Tests for Facts Deduplication

Port of: tests/facts-deduplication.test.ts

Tests validate:
- Cross-session fact deduplication
- Exact, structural, and semantic matching strategies
- Confidence-based updates
- Integration with memory.remember()

PARALLEL-SAFE: Uses TestRunContext for isolated test data
"""

import pytest

from cortex import (
    Cortex,
    DeduplicationConfig,
    FactDeduplicationService,
    RememberOptions,
    RememberParams,
    StoreFactParams,
)
from cortex.facts import StoreFactWithDedupOptions


# ============================================================================
# Unit Tests - FactDeduplicationService
# ============================================================================


class TestFactDeduplicationServiceUnit:
    """Unit tests for FactDeduplicationService."""

    def test_resolve_config_returns_default_semantic_config(self):
        """
        Test that resolve_config returns structural fallback when no config provided.

        Since no generateEmbedding is provided, semantic falls back to structural.
        """
        config = FactDeduplicationService.resolve_config(None)
        # Should fall back to structural since no generateEmbedding provided
        assert config.strategy == "structural"

    def test_resolve_config_converts_string_shorthand(self):
        """Test that string strategy is converted to config."""
        config = FactDeduplicationService.resolve_config("exact")
        assert config.strategy == "exact"

    def test_resolve_config_falls_back_to_structural_without_embedding(self):
        """Test semantic falls back to structural when no embedding function."""
        config = FactDeduplicationService.resolve_config(
            DeduplicationConfig(strategy="semantic")
        )
        assert config.strategy == "structural"

    def test_resolve_config_keeps_semantic_with_embedding(self):
        """Test semantic is kept when generateEmbedding is provided."""
        async def mock_embed(text: str):
            return [0.1, 0.2, 0.3]

        config = FactDeduplicationService.resolve_config(
            DeduplicationConfig(strategy="semantic", generate_embedding=mock_embed)
        )
        assert config.strategy == "semantic"
        assert config.generate_embedding == mock_embed

    def test_resolve_config_uses_fallback_embedding(self):
        """Test fallback embedding function is used when provided."""
        async def fallback_embed(text: str):
            return [0.1, 0.2, 0.3]

        config = FactDeduplicationService.resolve_config(
            DeduplicationConfig(strategy="semantic"),
            fallback_embed,
        )
        assert config.strategy == "semantic"
        assert config.generate_embedding == fallback_embed


# ============================================================================
# Integration Tests - facts.store_with_dedup()
# ============================================================================


@pytest.mark.asyncio
async def test_store_with_dedup_stores_first_fact(ctx, cortex_client, scoped_cleanup):
    """
    Test that first fact is stored without finding duplicate.

    Port of: facts-deduplication.test.ts - storeWithDedup() - Exact Strategy
    """
    memory_space_id = ctx.memory_space_id("dedup-first")

    result = await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User's favorite color is blue",
            fact_type="preference",
            subject="user-123",
            confidence=80,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="exact"),
    )

    assert result.fact is not None
    assert result.fact.fact_id.startswith("fact-")
    assert result.was_updated is False
    assert result.deduplication is not None
    assert result.deduplication.get("matched_existing") is False


@pytest.mark.asyncio
async def test_store_with_dedup_detects_exact_duplicate(ctx, cortex_client, scoped_cleanup):
    """
    Test that exact duplicate is detected and returns existing fact.

    Port of: facts-deduplication.test.ts - storeWithDedup() - Exact Strategy
    """
    memory_space_id = ctx.memory_space_id("dedup-exact")
    unique_fact = f"User likes hiking-{ctx.run_id}"

    # Store first fact
    first_result = await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact=unique_fact,
            fact_type="preference",
            subject="user-456",
            confidence=85,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="exact"),
    )

    # Store duplicate
    second_result = await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact=unique_fact,  # Same fact text
            fact_type="preference",
            subject="user-456",
            confidence=75,  # Lower confidence
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="exact"),
    )

    assert second_result.deduplication is not None
    assert second_result.deduplication.get("matched_existing") is True
    assert second_result.was_updated is False  # Lower confidence, no update


@pytest.mark.asyncio
async def test_store_with_dedup_structural_match(ctx, cortex_client, scoped_cleanup):
    """
    Test structural deduplication by subject+predicate+object.

    Port of: facts-deduplication.test.ts - storeWithDedup() - Structural Strategy
    """
    memory_space_id = ctx.memory_space_id("dedup-struct")
    subject = f"user-struct-{ctx.run_id}"

    # Store first fact
    await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User enjoys reading",
            fact_type="preference",
            subject=subject,
            predicate="enjoys",
            object="reading",
            confidence=90,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="structural"),
    )

    # Store with same structure but different text
    second_result = await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User loves reading books",  # Different text
            fact_type="preference",
            subject=subject,  # Same subject
            predicate="enjoys",  # Same predicate
            object="reading",  # Same object
            confidence=85,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="structural"),
    )

    assert second_result.deduplication is not None
    assert second_result.deduplication.get("matched_existing") is True


@pytest.mark.asyncio
async def test_store_with_dedup_disabled(ctx, cortex_client, scoped_cleanup):
    """
    Test that deduplication can be disabled.

    Port of: facts-deduplication.test.ts - storeWithDedup() - Disabled
    """
    memory_space_id = ctx.memory_space_id("dedup-disabled")

    # Store first fact without deduplication
    await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User prefers tea",
            fact_type="preference",
            subject="user-789",
            confidence=70,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="none"),
    )

    # Store duplicate - should create new since dedup is disabled
    second_result = await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User prefers tea",
            fact_type="preference",
            subject="user-789",
            confidence=70,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="none"),
    )

    # Both should be stored
    from cortex.types import ListFactsFilter
    facts = await cortex_client.facts.list(
        ListFactsFilter(
            memory_space_id=memory_space_id,
            subject="user-789",
        )
    )
    assert len(facts) == 2


@pytest.mark.asyncio
async def test_cross_session_deduplication(ctx, cortex_client, scoped_cleanup):
    """
    Test that duplicates are prevented across multiple store calls.

    Port of: facts-deduplication.test.ts - Cross-Session Deduplication
    """
    memory_space_id = ctx.memory_space_id("cross-session")
    subject = f"user-cross-{ctx.run_id}"

    # First "session"
    await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User's birthday is January 15",
            fact_type="identity",
            subject=subject,
            predicate="birthday",
            object="January 15",
            confidence=95,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="structural"),
    )

    # Second "session" - same fact
    await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User's birthday is January 15th",  # Slightly different text
            fact_type="identity",
            subject=subject,
            predicate="birthday",
            object="January 15",
            confidence=90,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="structural"),
    )

    # Third "session" - same fact again
    await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="The user was born on January 15",
            fact_type="identity",
            subject=subject,
            predicate="birthday",
            object="January 15",
            confidence=85,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="structural"),
    )

    # Should only have 1 fact due to structural deduplication
    from cortex.types import ListFactsFilter
    facts = await cortex_client.facts.list(
        ListFactsFilter(
            memory_space_id=memory_space_id,
            subject=subject,
        )
    )
    assert len(facts) == 1
    assert facts[0].confidence == 95  # Original higher confidence preserved


@pytest.mark.asyncio
async def test_memory_space_isolation(ctx, cortex_client, scoped_cleanup):
    """
    Test that deduplication doesn't cross memory space boundaries.

    Port of: facts-deduplication.test.ts - Memory Space Isolation
    """
    memory_space_1 = ctx.memory_space_id("isolation-1")
    memory_space_2 = ctx.memory_space_id("isolation-2")

    # Store in space 1
    await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_1,
            fact="User prefers morning meetings",
            fact_type="preference",
            subject="user-isolation",
            predicate="prefers",
            object="morning meetings",
            confidence=80,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="structural"),
    )

    # Store same fact in space 2 - should NOT be detected as duplicate
    result = await cortex_client.facts.store_with_dedup(
        StoreFactParams(
            memory_space_id=memory_space_2,
            fact="User prefers morning meetings",
            fact_type="preference",
            subject="user-isolation",
            predicate="prefers",
            object="morning meetings",
            confidence=80,
            source_type="conversation",
        ),
        StoreFactWithDedupOptions(deduplication="structural"),
    )

    # Should NOT be detected as duplicate (different memory space)
    assert result.deduplication is not None
    assert result.deduplication.get("matched_existing") is False


# ============================================================================
# Integration Tests - memory.remember() with deduplication
# ============================================================================


@pytest.mark.asyncio
async def test_remember_defaults_to_semantic_fallback_structural(
    ctx, cortex_client, scoped_cleanup
):
    """
    Test that memory.remember() uses structural deduplication when
    belief revision is explicitly disabled and no embedding function is provided.

    Port of: facts-deduplication.test.ts - remember() with factDeduplication

    Note: Since belief revision is now "batteries included" (always enabled by default),
    we must explicitly disable it to test the deduplication fallback path.
    """
    memory_space_id = ctx.memory_space_id("remember-default")
    user_id = ctx.user_id("remember-user")
    agent_id = ctx.agent_id("remember-agent")

    # Async fact extractor functions (SDK expects async)
    async def extract_facts_1(_u, _a):
        return [
            {
                "fact": "User's name is Alice",
                "factType": "identity",
                "subject": user_id,
                "predicate": "name",
                "object": "Alice",
                "confidence": 95,
            }
        ]

    async def extract_facts_2(_u, _a):
        return [
            {
                "fact": "User is Alice",
                "factType": "identity",
                "subject": user_id,
                "predicate": "name",
                "object": "Alice",
                "confidence": 90,
            }
        ]

    # First remember call - explicitly disable belief revision to use deduplication path
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=ctx.conversation_id("conv1"),
            user_message="My name is Alice",
            agent_response="Nice to meet you, Alice!",
            user_id=user_id,
            user_name="Alice",
            agent_id=agent_id,
            extract_facts=extract_facts_1,
        ),
        RememberOptions(belief_revision=False),  # Disable to test deduplication path
    )

    # Second remember call - same fact should be deduplicated
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=ctx.conversation_id("conv2"),
            user_message="Remember, I'm Alice",
            agent_response="Of course, Alice!",
            user_id=user_id,
            user_name="Alice",
            agent_id=agent_id,
            extract_facts=extract_facts_2,
        ),
        RememberOptions(belief_revision=False),  # Disable to test deduplication path
    )

    # Count facts for this user - should be 1 due to structural dedup
    from cortex.types import ListFactsFilter
    facts = await cortex_client.facts.list(
        ListFactsFilter(
            memory_space_id=memory_space_id,
            subject=user_id,
        )
    )

    # Due to structural deduplication on subject/predicate/object
    assert len(facts) == 1
    assert facts[0].confidence == 95  # Original higher confidence preserved


@pytest.mark.asyncio
async def test_remember_with_deduplication_disabled(ctx, cortex_client, scoped_cleanup):
    """
    Test that fact deduplication can be disabled in remember().

    Port of: facts-deduplication.test.ts - remember() with factDeduplication: false
    """
    memory_space_id = ctx.memory_space_id("remember-no-dedup")
    user_id = ctx.user_id("no-dedup-user")
    agent_id = ctx.agent_id("no-dedup-agent")

    # Async fact extractor (SDK expects async)
    async def extract_pizza_fact(_u, _a):
        return [
            {
                "fact": "User likes pizza",
                "factType": "preference",
                "subject": user_id,
                "confidence": 85,
            }
        ]

    # First remember call - disable both deduplication AND belief revision to allow duplicates
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=ctx.conversation_id("no-dedup-conv1"),
            user_message="I like pizza",
            agent_response="Pizza is great!",
            user_id=user_id,
            user_name="TestUser",
            agent_id=agent_id,
            fact_deduplication=False,  # Disable deduplication
            extract_facts=extract_pizza_fact,
        ),
        RememberOptions(belief_revision=False),  # Also disable belief revision
    )

    # Second remember call - same fact
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=ctx.conversation_id("no-dedup-conv2"),
            user_message="Did I mention I like pizza?",
            agent_response="Yes, you love pizza!",
            user_id=user_id,
            user_name="TestUser",
            agent_id=agent_id,
            fact_deduplication=False,  # Disable deduplication
            extract_facts=extract_pizza_fact,
        ),
        RememberOptions(belief_revision=False),  # Also disable belief revision
    )

    # Count facts - should be 2 since dedup is disabled
    from cortex.types import ListFactsFilter
    facts = await cortex_client.facts.list(
        ListFactsFilter(
            memory_space_id=memory_space_id,
            subject=user_id,
        )
    )

    assert len(facts) == 2


# ============================================================================
# Real-World Scenario Tests
# ============================================================================


@pytest.mark.asyncio
async def test_real_world_name_stated_multiple_times(ctx, cortex_client, scoped_cleanup):
    """
    Test real-world scenario: user states name multiple times across conversations.

    Port of: facts-deduplication.test.ts - Real-world scenarios
    """
    memory_space_id = ctx.memory_space_id("real-world-name")
    user_id = ctx.user_id("name-user")
    agent_id = ctx.agent_id("name-agent")

    # Async fact extractor (SDK expects async)
    async def extract_name_fact(_u, _a):
        return [
            {
                "fact": "User's name is Alex",
                "factType": "identity",
                "subject": user_id,
                "predicate": "name",
                "object": "Alex",
                "confidence": 95,
            }
        ]

    conversations = [
        ("My name is Alex", "Nice to meet you, Alex!"),
        ("Call me Alex please", "Of course, Alex!"),
        ("I'm Alex, remember?", "Yes, I remember, Alex!"),
    ]

    for i, (user_msg, agent_msg) in enumerate(conversations):
        await cortex_client.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=ctx.conversation_id(f"name-conv-{i}"),
                user_message=user_msg,
                agent_response=agent_msg,
                user_id=user_id,
                user_name="Alex",
                agent_id=agent_id,
                extract_facts=extract_name_fact,
            )
        )

    # Should result in 1 fact, not 3
    from cortex.types import ListFactsFilter
    facts = await cortex_client.facts.list(
        ListFactsFilter(
            memory_space_id=memory_space_id,
            subject=user_id,
        )
    )

    assert len(facts) == 1
    assert "Alex" in facts[0].fact
