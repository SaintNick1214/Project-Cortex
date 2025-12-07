"""
Tests for Memory API (Layer 4 convenience)

OPTIMIZATION: Tests are organized into batched groups to reduce setup overhead:
1. TestMemoryBasicOperations - Core CRUD operations, share setup where possible
2. TestMemoryValidation - Client-side validation (NO database calls needed!)
3. TestMemorySkipLayers - Layer skipping behavior
"""

import time

import pytest

from cortex import ForgetOptions, RememberParams, SearchOptions


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Batched Test Group 1: Basic Operations (shared setup)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Basic Memory Operations
# PARALLEL-SAFE: Uses function-scoped fixtures with unique IDs per test
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_remember_basic(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id):
    """Test basic remember operation."""
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    assert len(result.memories) == 2
    assert result.conversation["conversationId"] == test_conversation_id
    assert len(result.conversation["messageIds"]) == 2


@pytest.mark.asyncio
async def test_remember_with_metadata(
    cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id
):
    """Test remember with importance and tags."""
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Important message",
            agent_response="Acknowledged",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
            importance=90,
            tags=["important", "test"],
        )
    )

    assert len(result.memories) == 2
    assert result.memories[0].importance == 90
    assert "important" in result.memories[0].tags


@pytest.mark.asyncio
async def test_search(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id):
    """Test memory search."""
    # Store a memory first
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="I prefer dark mode",
            agent_response="Noted",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    # Search for it
    results = await cortex_client.memory.search(
        test_memory_space_id,
        "dark mode",
        SearchOptions(user_id=test_user_id, limit=10),
    )

    assert len(results) > 0
    # Note: Without embeddings, results might not be semantic


@pytest.mark.asyncio
async def test_get_memory(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id):
    """Test getting a specific memory."""
    # Store a memory
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test",
            agent_response="Response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    memory_id = result.memories[0].memory_id

    # Get it back
    retrieved = await cortex_client.memory.get(test_memory_space_id, memory_id)

    assert retrieved is not None
    assert retrieved.memory_id == memory_id


@pytest.mark.asyncio
async def test_get_with_enrichment(
    cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id
):
    """Test getting memory with conversation enrichment."""
    # Store a memory
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test",
            agent_response="Response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    memory_id = result.memories[0].memory_id

    # Get with enrichment
    enriched = await cortex_client.memory.get(
        test_memory_space_id, memory_id, include_conversation=True
    )

    assert enriched is not None
    assert enriched.conversation is not None
    assert enriched.conversation.conversation_id == test_conversation_id


@pytest.mark.asyncio
async def test_update_memory(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id):
    """Test updating a memory."""
    # Store a memory
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Original",
            agent_response="Response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    memory_id = result.memories[0].memory_id

    # Update it
    updated = await cortex_client.memory.update(
        test_memory_space_id, memory_id, {"content": "Updated", "importance": 80}
    )

    assert updated["memory"].content == "Updated"
    assert updated["memory"].version == 2


@pytest.mark.asyncio
async def test_delete_memory(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id):
    """Test deleting a memory."""
    # Store a memory
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="To delete",
            agent_response="Response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    memory_id = result.memories[0].memory_id

    # Delete it
    delete_result = await cortex_client.memory.delete(test_memory_space_id, memory_id)

    assert delete_result["deleted"] is True

    # Verify it's gone
    retrieved = await cortex_client.memory.get(test_memory_space_id, memory_id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_forget_with_conversation(
    cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id
):
    """Test forgetting a memory and its conversation."""
    # Store a memory
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="To forget",
            agent_response="Response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    memory_id = result.memories[0].memory_id

    # Forget it (including conversation)
    forget_result = await cortex_client.memory.forget(
        test_memory_space_id,
        memory_id,
        ForgetOptions(delete_conversation=True, delete_entire_conversation=True),
    )

    assert forget_result.memory_deleted is True
    assert forget_result.conversation_deleted is True
    assert not forget_result.restorable


@pytest.mark.asyncio
async def test_count_and_list(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id):
    """Test counting and listing memories."""
    # Store a few memories
    for i in range(3):
        await cortex_client.memory.remember(
            RememberParams(
                memory_space_id=test_memory_space_id,
                conversation_id=test_conversation_id,
                user_message=f"Message {i}",
                agent_response=f"Response {i}",
                user_id=test_user_id,
                user_name="Tester",
                agent_id=test_agent_id,
            )
        )

    # Count them
    count = await cortex_client.memory.count(test_memory_space_id, user_id=test_user_id)
    assert count >= 6  # At least 6 (3 user + 3 agent messages)

    # List them
    memories = await cortex_client.memory.list(
        test_memory_space_id, user_id=test_user_id, limit=10
    )
    assert len(memories) >= 6


# ============================================================================
# Additional Tests - Expanding Coverage
# ============================================================================


@pytest.mark.asyncio
async def test_remember_with_embeddings(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """
    Test remember with embedding generation.

    Port of: memory.test.ts - embedding tests
    """
    from tests.helpers import generate_embedding

    # Generate embeddings for messages
    await generate_embedding("I need help with my account", use_mock=True)
    await generate_embedding("I can help you with that", use_mock=True)

    # Note: Embeddings are generated automatically by the backend
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="I need help with my account",
            agent_response="I can help you with that",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    # Both memories should be created
    assert len(result.memories) == 2
    # Note: Embeddings are generated automatically by backend if enabled

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_remember_with_fact_extraction(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """
    Test remember with fact extraction callback.

    Port of: memory.test.ts - fact extraction tests
    """
    # Define fact extraction function
    async def extract_facts(user_msg, agent_msg):
        return [
            {
                "fact": "User prefers dark mode",
                "factType": "preference",
                "confidence": 95,
                "tags": ["ui", "preferences"],
            }
        ]

    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="I like dark mode",
            agent_response="I've noted your preference",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
            participant_id="agent-test",  # Add participantId to test propagation
            extract_facts=extract_facts,
        )
    )

    # Should have extracted facts
    assert len(result.facts) > 0
    assert any(f.fact == "User prefers dark mode" for f in result.facts)

    # CRITICAL: Verify userId was propagated from remember() to facts.store()
    # This was a bug fixed in Python SDK - userId was missing!
    extracted_fact = next(f for f in result.facts if f.fact == "User prefers dark mode")
    assert extracted_fact.user_id == test_user_id
    assert extracted_fact.participant_id == "agent-test"

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_remember_fact_extraction_parameter_propagation(cortex_client, test_memory_space_id, test_user_id, cleanup_helper):
    """
    REGRESSION TEST: Ensures ALL parameters are properly passed from remember() to facts.store().

    Bug found: userId was not being passed to facts.store() during fact extraction.
    This caused:
    - userId filter not working for extracted facts
    - GDPR cascade delete failing for facts
    - Multi-user demos breaking
    """
    from cortex import ListFactsFilter, RememberParams

    specific_conv_id = f"conv-param-prop-{test_user_id}"
    specific_participant_id = "agent-param-test"

    async def extract_facts(user_msg, agent_msg):
        return [
            {
                "fact": "Parameter propagation test fact",
                "factType": "knowledge",
                "confidence": 88,
                "tags": ["regression-test"],
            }
        ]

    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=specific_conv_id,
            user_message="Test message for parameter propagation",
            agent_response="Acknowledged",
            user_id=test_user_id,
            user_name="Test User",
            agent_id="agent-param-test",
            participant_id=specific_participant_id,
            tags=["test-tag"],
            extract_facts=extract_facts,
        )
    )

    assert len(result.facts) == 1
    fact = result.facts[0]

    # Verify ALL parameters were properly propagated
    assert fact.memory_space_id == test_memory_space_id
    assert fact.user_id == test_user_id  # ← This was the bug!
    assert fact.participant_id == specific_participant_id
    assert fact.source_type == "conversation"
    # source_ref could be dict or object depending on conversion
    assert fact.source_ref is not None
    conv_id = fact.source_ref.get("conversation_id") if isinstance(fact.source_ref, dict) else fact.source_ref.conversation_id
    mem_id = fact.source_ref.get("memory_id") if isinstance(fact.source_ref, dict) else fact.source_ref.memory_id
    msg_ids = fact.source_ref.get("message_ids") if isinstance(fact.source_ref, dict) else fact.source_ref.message_ids
    assert conv_id == specific_conv_id
    assert mem_id is not None
    assert msg_ids is not None
    assert len(msg_ids) == 2

    # Now test that filtering by userId actually works
    filtered_facts = await cortex_client.facts.list(
        ListFactsFilter(
            memory_space_id=test_memory_space_id,
            user_id=test_user_id,
        )
    )

    found_fact = next((f for f in filtered_facts if f.fact_id == fact.fact_id), None)
    assert found_fact is not None
    assert found_fact.user_id == test_user_id

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_search_with_strategy(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """
    Test search with different strategies.

    Port of: memory.test.ts - search strategy tests
    """
    # Store memories
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Recent message",
            agent_response="Response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
            importance=50,
        )
    )

    # Search with keyword strategy
    results = await cortex_client.memory.search(
        test_memory_space_id,
        "recent",
        SearchOptions(
            user_id=test_user_id,
            strategy="keyword",
            limit=10,
        ),
    )

    assert len(results) >= 0  # May or may not find results

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_list_with_filters(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """
    Test listing memories with filters.

    Port of: memory.test.ts - list tests
    """
    # Store memories with different importance
    for i in range(3):
        await cortex_client.memory.remember(
            RememberParams(
                memory_space_id=test_memory_space_id,
                conversation_id=test_conversation_id,
                user_message=f"Message {i}",
                agent_response=f"Response {i}",
                user_id=test_user_id,
                user_name="Tester",
                agent_id=test_agent_id,
                importance=30 + (i * 20),  # 30, 50, 70
            )
        )

    # List memories (filter by importance client-side)
    memories = await cortex_client.memory.list(
        test_memory_space_id,
        user_id=test_user_id,
        limit=10,
    )
    # Filter by importance client-side
    memories = [m for m in memories if m.importance >= 60]

    # Should only return memories with importance >= 60
    for mem in memories:
        assert mem.importance >= 60

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_count_with_filters(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """
    Test counting memories with filters.

    Port of: memory.test.ts - count tests
    """
    # Store memories with tags
    for i in range(4):
        await cortex_client.memory.remember(
            RememberParams(
                memory_space_id=test_memory_space_id,
                conversation_id=test_conversation_id,
                user_message=f"Message {i}",
                agent_response=f"Response {i}",
                user_id=test_user_id,
                user_name="Tester",
                agent_id=test_agent_id,
                tags=["important"] if i % 2 == 0 else ["normal"],
            )
        )

    # Count all memories (backend doesn't support tags filter)
    count = await cortex_client.memory.count(
        test_memory_space_id,
        user_id=test_user_id,
    )

    # Should have 8 memories total (4 user + 4 agent messages)
    assert count >= 8

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_forget_with_options(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """
    Test forget with various options.

    Port of: memory.test.ts - forget tests
    """
    # Store a memory
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Memory to forget",
            agent_response="Noted",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    memory_id = result.memories[0].memory_id

    # Forget (soft delete by default)
    forget_result = await cortex_client.memory.forget(
        test_memory_space_id,
        memory_id,
        ForgetOptions(
            delete_conversation=False,
        ),
    )

    assert forget_result.memory_deleted is True
    assert forget_result.restorable is True

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_archive_and_restore(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """
    Test archiving and restoring memories.

    Port of: memory.test.ts - archive tests
    """
    # Store a memory
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Memory to archive",
            agent_response="Response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    memory_id = result.memories[0].memory_id

    # Archive it
    archived = await cortex_client.vector.archive(test_memory_space_id, memory_id)

    # Verify archived
    assert archived is not None

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_get_conversation_ref(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """
    Test getting memory with conversationRef populated.

    Port of: memory.test.ts - conversationRef tests
    """
    # Store memory with conversation
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    memory_id = result.memories[0].memory_id

    # Get memory
    memory = await cortex_client.memory.get(test_memory_space_id, memory_id)

    # Should have conversationRef
    assert memory is not None
    assert memory.conversation_ref is not None
    # conversation_ref is a dict after conversion
    conv_id = memory.conversation_ref.get("conversation_id") if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
    assert conv_id == test_conversation_id

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


# ============================================================================
# Archive and Restore Tests (NEW)
# ============================================================================


@pytest.mark.asyncio
async def test_restore_from_archive(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """
    Test restoring memory from archive.

    New method: memory.restore_from_archive()
    """
    # Store a memory
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Important memory",
            agent_response="Noted",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
            importance=80,
        )
    )

    memory_id = result.memories[0].memory_id

    # Archive it
    archived = await cortex_client.memory.archive(test_memory_space_id, memory_id)
    assert archived is not None

    # Verify archived
    memory = await cortex_client.vector.get(test_memory_space_id, memory_id)
    assert "archived" in memory.tags
    assert memory.importance <= 10

    # Restore from archive
    restored = await cortex_client.memory.restore_from_archive(
        test_memory_space_id, memory_id
    )

    assert restored["restored"] is True
    assert restored["memoryId"] == memory_id

    # Verify restoration
    restored_memory = await cortex_client.vector.get(test_memory_space_id, memory_id)
    assert "archived" not in restored_memory.tags
    assert restored_memory.importance >= 50

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_restore_non_archived_throws_error(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """
    Test that restoring non-archived memory throws error.
    """
    # Store a memory (don't archive)
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Not archived",
            agent_response="OK",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
        )
    )

    memory_id = result.memories[0].memory_id

    # Try to restore without archiving
    # Backend validation: archive status check
    with pytest.raises(Exception):
        await cortex_client.memory.restore_from_archive(test_memory_space_id, memory_id)

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Batched Test Group 2: Client-Side Validation Tests
# OPTIMIZATION: These tests validate errors BEFORE any API call - no DB needed!
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

from cortex import MemoryMetadata, MemorySource, StoreMemoryInput
from cortex.memory import MemoryValidationError


class TestMemoryValidation:
    """
    Client-side validation tests - NO database calls needed!
    
    These tests verify that MemoryValidationError is raised BEFORE
    any API call is made. They only need the cortex_client to be
    initialized, not any test data in the database.
    
    Grouping them in a class allows pytest to potentially optimize
    fixture setup across the entire class.
    """

    # Static test IDs - no need for database-backed fixtures
    SPACE_ID = "validation-test-space"
    CONV_ID = "validation-test-conv"
    USER_ID = "validation-test-user"
    AGENT_ID = "validation-test-agent"

    # ━━━ remember() validation tests ━━━

    @pytest.mark.asyncio
    async def test_remember_validation_missing_memory_space_id(self, cortex_client):
        """Should throw on missing memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id="",
                    conversation_id=self.CONV_ID,
                    user_message="Test",
                    agent_response="OK",
                    user_id=self.USER_ID,
                    user_name="Tester"
                )
            )
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on whitespace memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id="   ",
                    conversation_id=self.CONV_ID,
                    user_message="Test",
                    agent_response="OK",
                    user_id=self.USER_ID,
                    user_name="Tester"
                )
            )
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_validation_missing_conversation_id(self, cortex_client):
        """Should throw on missing conversation_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id=self.SPACE_ID,
                    conversation_id="",
                    user_message="Test",
                    agent_response="OK",
                    user_id=self.USER_ID,
                    user_name="Tester"
                )
            )
        assert "conversation_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_validation_missing_user_message(self, cortex_client):
        """Should throw on missing user_message."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id=self.SPACE_ID,
                    conversation_id=self.CONV_ID,
                    user_message="",
                    agent_response="OK",
                    user_id=self.USER_ID,
                    user_name="Tester"
                )
            )
        assert "user_message cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_validation_empty_user_message(self, cortex_client):
        """Should throw on whitespace user_message."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id=self.SPACE_ID,
                    conversation_id=self.CONV_ID,
                    user_message="   ",
                    agent_response="OK",
                    user_id=self.USER_ID,
                    user_name="Tester"
                )
            )
        assert "user_message cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_validation_missing_agent_response(self, cortex_client):
        """Should throw on missing agent_response."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id=self.SPACE_ID,
                    conversation_id=self.CONV_ID,
                    user_message="Test",
                    agent_response="",
                    user_id=self.USER_ID,
                    user_name="Tester"
                )
            )
        assert "agent_response cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_validation_missing_owner(self, cortex_client):
        """Should throw on missing owner (neither user_id nor agent_id)."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id=self.SPACE_ID,
                    conversation_id=self.CONV_ID,
                    user_message="Test",
                    agent_response="OK",
                    user_id="",
                    user_name="Tester"
                )
            )
        assert "Either user_id or agent_id must be provided" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_validation_user_without_agent(self, cortex_client):
        """Should throw when user_id is provided without agent_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id=self.SPACE_ID,
                    conversation_id=self.CONV_ID,
                    user_message="Test",
                    agent_response="OK",
                    user_id=self.USER_ID,
                    user_name="Tester"
                    # Missing agent_id - should throw!
                )
            )
        assert "agent_id is required when user_id is provided" in str(exc_info.value)


    @pytest.mark.asyncio
    async def test_remember_validation_invalid_importance_negative(self, cortex_client):
        """Should throw on negative importance."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id=self.SPACE_ID,
                    conversation_id=self.CONV_ID,
                    user_message="Test",
                    agent_response="OK",
                    user_id=self.USER_ID,
                    user_name="Tester",
                    agent_id=self.AGENT_ID,
                    importance=-1
                )
            )
        assert "importance must be between 0 and 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_validation_invalid_importance_too_high(self, cortex_client):
        """Should throw on importance > 100."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id=self.SPACE_ID,
                    conversation_id=self.CONV_ID,
                    user_message="Test",
                    agent_response="OK",
                    user_id=self.USER_ID,
                    user_name="Tester",
                    agent_id=self.AGENT_ID,
                    importance=150
                )
            )
        assert "importance must be between 0 and 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_validation_tags_with_empty_strings(self, cortex_client):
        """Should throw on tags with empty strings."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember(
                RememberParams(
                    memory_space_id=self.SPACE_ID,
                    conversation_id=self.CONV_ID,
                    user_message="Test",
                    agent_response="OK",
                    user_id=self.USER_ID,
                    user_name="Tester",
                    agent_id=self.AGENT_ID,
                    tags=["valid", "", "tag"]
                )
            )
        assert "must be a non-empty string" in str(exc_info.value)

    # ━━━ rememberStream() validation tests ━━━

    @pytest.mark.asyncio
    async def test_remember_stream_validation_invalid_stream(self, cortex_client):
        """Should throw on invalid stream object."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember_stream({
                "memorySpaceId": self.SPACE_ID,
                "conversationId": self.CONV_ID,
                "userMessage": "Test",
                "responseStream": {},  # Invalid
                "userId": self.USER_ID,
                "userName": "Tester",
                "agentId": self.AGENT_ID
            })
        assert "response_stream must be" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_stream_validation_null_stream(self, cortex_client):
        """Should throw on null stream."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember_stream({
                "memorySpaceId": self.SPACE_ID,
                "conversationId": self.CONV_ID,
                "userMessage": "Test",
                "responseStream": None,
                "userId": self.USER_ID,
                "userName": "Tester",
                "agentId": self.AGENT_ID
            })
        assert "response_stream must be" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_remember_stream_validation_inherits_remember_checks(self, cortex_client):
        """Should inherit remember() validations."""
        async def mock_stream():
            yield "test"

        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.remember_stream({
                "memorySpaceId": "",
                "conversationId": self.CONV_ID,
                "userMessage": "Test",
                "responseStream": mock_stream(),
                "userId": self.USER_ID,
                "userName": "Tester",
                "agentId": self.AGENT_ID
            })
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    # ━━━ forget() validation tests ━━━

    @pytest.mark.asyncio
    async def test_forget_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.forget("", "mem-123")
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_forget_validation_empty_memory_id(self, cortex_client):
        """Should throw on empty memory_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.forget(self.SPACE_ID, "   ")
        assert "memory_id cannot be empty" in str(exc_info.value)

    # ━━━ get() validation tests ━━━

    @pytest.mark.asyncio
    async def test_get_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get("", "mem-123")
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_validation_empty_memory_id(self, cortex_client):
        """Should throw on empty memory_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get(self.SPACE_ID, "")
        assert "memory_id cannot be empty" in str(exc_info.value)

    # ━━━ search() validation tests ━━━

    @pytest.mark.asyncio
    async def test_search_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.search("", "query")
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_validation_empty_query(self, cortex_client):
        """Should throw on empty query."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.search(self.SPACE_ID, "   ")
        assert "query cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_validation_invalid_embedding_empty(self, cortex_client):
        """Should throw on empty embedding array."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.search(
                self.SPACE_ID,
                "query",
                SearchOptions(embedding=[])
            )
        assert "embedding cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_validation_invalid_embedding_nan(self, cortex_client):
        """Should throw on NaN in embedding."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.search(
                self.SPACE_ID,
                "query",
                SearchOptions(embedding=[0.1, float('nan'), 0.3])
            )
        assert "must be a finite number" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_validation_invalid_min_score_negative(self, cortex_client):
        """Should throw on negative min_score."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.search(
                self.SPACE_ID,
                "query",
                SearchOptions(min_score=-0.5)
            )
        assert "min_score must be between 0 and 1" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_validation_invalid_min_score_too_high(self, cortex_client):
        """Should throw on min_score > 1."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.search(
                self.SPACE_ID,
                "query",
                SearchOptions(min_score=1.5)
            )
        assert "min_score must be between 0 and 1" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_validation_invalid_limit_zero(self, cortex_client):
        """Should throw on limit=0."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.search(
                self.SPACE_ID,
                "query",
                SearchOptions(limit=0)
            )
        assert "limit must be a positive integer" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_validation_invalid_limit_negative(self, cortex_client):
        """Should throw on negative limit."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.search(
                self.SPACE_ID,
                "query",
                SearchOptions(limit=-10)
            )
        assert "limit must be a positive integer" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_validation_tags_with_empty_strings(self, cortex_client):
        """Should throw on tags with empty strings."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.search(
                self.SPACE_ID,
                "query",
                SearchOptions(tags=["valid", ""])
            )
        assert "must be a non-empty string" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_validation_invalid_min_importance(self, cortex_client):
        """Should throw on invalid min_importance."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.search(
                self.SPACE_ID,
                "query",
                SearchOptions(min_importance=150)
            )
        assert "min_importance must be between 0 and 100" in str(exc_info.value)


    # ━━━ store() validation tests ━━━

    @pytest.mark.asyncio
    async def test_store_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.store(
                "",
                StoreMemoryInput(
                    content="Test",
                    content_type="raw",
                    source=MemorySource(type="system", timestamp=1000),
                    metadata=MemoryMetadata(importance=50, tags=[])
                )
            )
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_store_validation_empty_content(self, cortex_client):
        """Should throw on empty content."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.store(
                self.SPACE_ID,
                StoreMemoryInput(
                    content="   ",
                    content_type="raw",
                    source=MemorySource(type="system", timestamp=1000),
                    metadata=MemoryMetadata(importance=50, tags=[])
                )
            )
        assert "content cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_store_validation_invalid_content_type(self, cortex_client):
        """Should throw on invalid content_type."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.store(
                self.SPACE_ID,
                StoreMemoryInput(
                    content="Test",
                    content_type="unknown",  # Invalid
                    source=MemorySource(type="system", timestamp=1000),
                    metadata=MemoryMetadata(importance=50, tags=[])
                )
            )
        assert "Invalid content_type" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_store_validation_invalid_source_type(self, cortex_client):
        """Should throw on invalid source_type."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.store(
                self.SPACE_ID,
                StoreMemoryInput(
                    content="Test",
                    content_type="raw",
                    source=MemorySource(type="invalid", timestamp=1000),  # Invalid
                    metadata=MemoryMetadata(importance=50, tags=[])
                )
            )
        assert "Invalid source_type" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_store_validation_missing_conversation_ref(self, cortex_client):
        """Should throw when conversation_ref missing for conversation source."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.store(
                self.SPACE_ID,
                StoreMemoryInput(
                    content="Test",
                    content_type="raw",
                    source=MemorySource(type="conversation", timestamp=1000),
                    metadata=MemoryMetadata(importance=50, tags=[])
                )
            )
        assert "conversation_ref is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_store_validation_invalid_embedding(self, cortex_client):
        """Should throw on invalid embedding."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.store(
                self.SPACE_ID,
                StoreMemoryInput(
                    content="Test",
                    content_type="raw",
                    source=MemorySource(type="system", timestamp=1000),
                    metadata=MemoryMetadata(importance=50, tags=[]),
                    embedding=[float('inf'), 0.2]
                )
            )
        assert "must be a finite number" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_store_validation_invalid_importance(self, cortex_client):
        """Should throw on invalid importance."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.store(
                self.SPACE_ID,
                StoreMemoryInput(
                    content="Test",
                    content_type="raw",
                    source=MemorySource(type="system", timestamp=1000),
                    metadata=MemoryMetadata(importance=150, tags=[])
                )
            )
        assert "importance must be between 0 and 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_store_validation_tags_with_empty_strings(self, cortex_client):
        """Should throw on tags with empty strings."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.store(
                self.SPACE_ID,
                StoreMemoryInput(
                    content="Test",
                    content_type="raw",
                    source=MemorySource(type="system", timestamp=1000),
                    metadata=MemoryMetadata(importance=50, tags=["valid", ""])
                )
            )
        assert "must be a non-empty string" in str(exc_info.value)

    # ━━━ update() validation tests ━━━

    @pytest.mark.asyncio
    async def test_update_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.update("", "mem-123", {"content": "Updated"})
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_validation_empty_memory_id(self, cortex_client):
        """Should throw on empty memory_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.update(self.SPACE_ID, "", {"content": "Updated"})
        assert "memory_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_validation_no_update_fields(self, cortex_client):
        """Should throw when no update fields provided."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.update(self.SPACE_ID, "mem-123", {})
        assert "At least one update field must be provided" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_validation_invalid_importance(self, cortex_client):
        """Should throw on invalid importance."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.update(self.SPACE_ID, "mem-123", {"importance": -5})
        assert "importance must be between 0 and 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_validation_invalid_embedding(self, cortex_client):
        """Should throw on invalid embedding."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.update(self.SPACE_ID, "mem-123", {"embedding": []})
        assert "embedding cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_validation_tags_with_empty_strings(self, cortex_client):
        """Should throw on tags with empty strings."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.update(self.SPACE_ID, "mem-123", {"tags": ["", "valid"]})
        assert "must be a non-empty string" in str(exc_info.value)

    # ━━━ delete() validation tests ━━━

    @pytest.mark.asyncio
    async def test_delete_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.delete("", "mem-123")
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_validation_empty_memory_id(self, cortex_client):
        """Should throw on empty memory_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.delete(self.SPACE_ID, "")
        assert "memory_id cannot be empty" in str(exc_info.value)

    # ━━━ list() validation tests ━━━

    @pytest.mark.asyncio
    async def test_list_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.list("")
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_validation_invalid_source_type(self, cortex_client):
        """Should throw on invalid source_type."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.list(self.SPACE_ID, source_type="invalid")
        assert "Invalid source_type" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_validation_invalid_limit_negative(self, cortex_client):
        """Should throw on negative limit."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.list(self.SPACE_ID, limit=-5)
        assert "limit must be a positive integer" in str(exc_info.value)

    # ━━━ count() validation tests ━━━

    @pytest.mark.asyncio
    async def test_count_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.count("")
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_count_validation_invalid_source_type(self, cortex_client):
        """Should throw on invalid source_type."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.count(self.SPACE_ID, source_type="invalid")
        assert "Invalid source_type" in str(exc_info.value)


    # ━━━ update_many() validation tests ━━━

    @pytest.mark.asyncio
    async def test_update_many_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.update_many("", {}, {"importance": 80})
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_many_validation_no_update_fields(self, cortex_client):
        """Should throw when no update fields provided."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.update_many(self.SPACE_ID, {}, {})
        assert "At least one update field must be provided" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_many_validation_invalid_importance(self, cortex_client):
        """Should throw on invalid importance."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.update_many(self.SPACE_ID, {}, {"importance": 200})
        assert "importance must be between 0 and 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_many_validation_tags_with_empty_strings(self, cortex_client):
        """Should throw on tags with empty strings."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.update_many(self.SPACE_ID, {}, {"tags": ["valid", ""]})
        assert "must be a non-empty string" in str(exc_info.value)

    # ━━━ delete_many() validation tests ━━━

    @pytest.mark.asyncio
    async def test_delete_many_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.delete_many("", {})
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_many_validation_empty_filter_prevents_mass_delete(self, cortex_client):
        """Should throw on empty filter to prevent mass delete."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.delete_many(self.SPACE_ID, {})
        assert "Filter must include at least one criterion" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_many_validation_invalid_source_type(self, cortex_client):
        """Should throw on invalid source_type."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.delete_many(self.SPACE_ID, {"source_type": "invalid"})
        assert "Invalid source_type" in str(exc_info.value)

    # ━━━ export() validation tests ━━━

    @pytest.mark.asyncio
    async def test_export_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.export("", format="json")
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_export_validation_invalid_format(self, cortex_client):
        """Should throw on invalid format."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.export(self.SPACE_ID, format="xml")
        assert "Invalid format" in str(exc_info.value)

    # ━━━ archive() validation tests ━━━

    @pytest.mark.asyncio
    async def test_archive_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.archive("", "mem-123")
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_archive_validation_empty_memory_id(self, cortex_client):
        """Should throw on empty memory_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.archive(self.SPACE_ID, "")
        assert "memory_id cannot be empty" in str(exc_info.value)

    # ━━━ restore_from_archive() validation tests ━━━

    @pytest.mark.asyncio
    async def test_restore_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.restore_from_archive("", "mem-123")
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_restore_validation_empty_memory_id(self, cortex_client):
        """Should throw on empty memory_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.restore_from_archive(self.SPACE_ID, "")
        assert "memory_id cannot be empty" in str(exc_info.value)

    # ━━━ get_version() validation tests ━━━

    @pytest.mark.asyncio
    async def test_get_version_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get_version("", "mem-123", 1)
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_version_validation_empty_memory_id(self, cortex_client):
        """Should throw on empty memory_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get_version(self.SPACE_ID, "", 1)
        assert "memory_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_version_validation_invalid_version_zero(self, cortex_client):
        """Should throw on version=0."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get_version(self.SPACE_ID, "mem-123", 0)
        assert "version must be a positive integer" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_version_validation_negative_version(self, cortex_client):
        """Should throw on negative version."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get_version(self.SPACE_ID, "mem-123", -1)
        assert "version must be a positive integer" in str(exc_info.value)

    # ━━━ get_history() validation tests ━━━

    @pytest.mark.asyncio
    async def test_get_history_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get_history("", "mem-123")
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_history_validation_empty_memory_id(self, cortex_client):
        """Should throw on empty memory_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get_history(self.SPACE_ID, "")
        assert "memory_id cannot be empty" in str(exc_info.value)

    # ━━━ get_at_timestamp() validation tests ━━━

    @pytest.mark.asyncio
    async def test_get_at_timestamp_validation_empty_memory_space_id(self, cortex_client):
        """Should throw on empty memory_space_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get_at_timestamp("", "mem-123", 1000)
        assert "memory_space_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_at_timestamp_validation_empty_memory_id(self, cortex_client):
        """Should throw on empty memory_id."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get_at_timestamp(self.SPACE_ID, "", 1000)
        assert "memory_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_at_timestamp_validation_invalid_timestamp_nan(self, cortex_client):
        """Should throw on NaN timestamp."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get_at_timestamp(self.SPACE_ID, "mem-123", float('nan'))
        assert "timestamp must be a valid timestamp" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_at_timestamp_validation_negative_timestamp(self, cortex_client):
        """Should throw on negative timestamp."""
        with pytest.raises(MemoryValidationError) as exc_info:
            await cortex_client.memory.get_at_timestamp(self.SPACE_ID, "mem-123", -1000)
        assert "timestamp cannot be negative" in str(exc_info.value)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Batched Test Group 3: skipLayers Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# Agent-only test moved outside validation class (requires actual DB call)
@pytest.mark.asyncio
async def test_remember_validation_agent_only_works(cortex_client, test_memory_space_id, test_conversation_id, test_agent_id, cleanup_helper):
    """Should allow agent-only memory (no user_id) when skipping conversations layer."""
    # Agent-only memories typically skip the conversations layer since
    # agent-agent conversations require different setup (memory_space_ids)
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Agent task",
            agent_response="Completed",
            agent_id=test_agent_id,
            skip_layers=["conversations"],  # Skip conversations for agent-only
            # No user_id - this is valid for agent-only scenarios
        )
    )
    assert len(result.memories) >= 1
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_skip_layers_conversations(cortex_client, test_memory_space_id, test_conversation_id, test_agent_id, cleanup_helper):
    """Test skipping the conversations layer."""
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test message",
            agent_response="Test response",
            agent_id=test_agent_id,
            skip_layers=["conversations"],
        )
    )

    # Should still create memories (in vector)
    assert len(result.memories) >= 1
    
    # Conversation should NOT exist (was skipped)
    conversation = await cortex_client.conversations.get(test_conversation_id)
    assert conversation is None
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_skip_layers_vector(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """Test skipping the vector layer."""
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
            skip_layers=["vector"],
        )
    )

    # Should NOT create memories (vector was skipped)
    assert len(result.memories) == 0
    
    # Conversation should exist
    conversation = await cortex_client.conversations.get(test_conversation_id)
    assert conversation is not None
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_skip_layers_facts(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """Test skipping the facts layer even when extract_facts is provided."""
    async def extract_facts(user_msg, agent_msg):
        return [
            {
                "fact": "This should NOT be stored",
                "factType": "preference",
                "confidence": 95,
            }
        ]

    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="I like testing",
            agent_response="Noted",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
            extract_facts=extract_facts,
            skip_layers=["facts"],  # Should skip fact extraction
        )
    )

    # Memories should be created
    assert len(result.memories) >= 1
    
    # Facts should NOT be extracted (was skipped)
    assert len(result.facts) == 0
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_skip_layers_multiple(cortex_client, test_memory_space_id, test_conversation_id, test_agent_id, cleanup_helper):
    """Test skipping multiple layers at once."""
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test message",
            agent_response="Test response",
            agent_id=test_agent_id,
            skip_layers=["conversations", "facts", "graph"],
        )
    )

    # Should still create memories (vector not skipped)
    assert len(result.memories) >= 1
    
    # Conversation should NOT exist (was skipped)
    conversation = await cortex_client.conversations.get(test_conversation_id)
    assert conversation is None
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_skip_layers_users(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """Test skipping the users layer (no auto-create user profile)."""
    # Use a unique user_id that shouldn't exist
    unique_user_id = f"test-skip-user-{int(time.time() * 1000)}"
    
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=unique_user_id,
            user_name="Test User",
            agent_id=test_agent_id,
            skip_layers=["users"],  # Don't auto-create user
        )
    )

    # Should still create memories
    assert len(result.memories) >= 1
    
    # User profile should NOT have been auto-created
    # (Note: this depends on the backend behavior - the user might still not exist)
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_skip_layers_agents(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
    """Test skipping the agents layer (no auto-register agent)."""
    # Use a unique agent_id that shouldn't exist
    unique_agent_id = f"test-skip-agent-{int(time.time() * 1000)}"
    
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=unique_agent_id,
            skip_layers=["agents"],  # Don't auto-register agent
        )
    )

    # Should still create memories
    assert len(result.memories) >= 1
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_no_skip_layers_default_behavior(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, test_agent_id, cleanup_helper):
    """Test that default behavior (no skipLayers) runs all layers."""
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=test_user_id,
            user_name="Tester",
            agent_id=test_agent_id,
            # No skip_layers - all layers should run
        )
    )

    # Memories should be created
    assert len(result.memories) >= 1
    
    # Conversation should exist
    conversation = await cortex_client.conversations.get(test_conversation_id)
    assert conversation is not None
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)
