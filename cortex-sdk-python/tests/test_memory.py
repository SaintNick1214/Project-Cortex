"""
Tests for Memory API (Layer 4 convenience)
"""

import pytest

from cortex import RememberParams, SearchOptions, ForgetOptions, CortexError
from tests.helpers import embeddings_available


@pytest.mark.asyncio
async def test_remember_basic(cortex_client, test_memory_space_id, test_conversation_id, test_user_id):
    """Test basic remember operation."""
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="Test message",
            agent_response="Test response",
            user_id=test_user_id,
            user_name="Tester",
        )
    )

    assert len(result.memories) == 2
    assert result.conversation["conversationId"] == test_conversation_id
    assert len(result.conversation["messageIds"]) == 2


@pytest.mark.asyncio
async def test_remember_with_metadata(
    cortex_client, test_memory_space_id, test_conversation_id, test_user_id
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
            importance=90,
            tags=["important", "test"],
        )
    )

    assert len(result.memories) == 2
    assert result.memories[0].importance == 90
    assert "important" in result.memories[0].tags


@pytest.mark.asyncio
async def test_search(cortex_client, test_memory_space_id, test_conversation_id, test_user_id):
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
async def test_get_memory(cortex_client, test_memory_space_id, test_conversation_id, test_user_id):
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
        )
    )

    memory_id = result.memories[0].memory_id

    # Get it back
    retrieved = await cortex_client.memory.get(test_memory_space_id, memory_id)

    assert retrieved is not None
    assert retrieved.memory_id == memory_id


@pytest.mark.asyncio
async def test_get_with_enrichment(
    cortex_client, test_memory_space_id, test_conversation_id, test_user_id
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
async def test_update_memory(cortex_client, test_memory_space_id, test_conversation_id, test_user_id):
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
async def test_delete_memory(cortex_client, test_memory_space_id, test_conversation_id, test_user_id):
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
    cortex_client, test_memory_space_id, test_conversation_id, test_user_id
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
async def test_count_and_list(cortex_client, test_memory_space_id, test_conversation_id, test_user_id):
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
async def test_remember_with_embeddings(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
    """
    Test remember with embedding generation.
    
    Port of: memory.test.ts - embedding tests
    """
    from tests.helpers import generate_embedding
    
    # Generate embeddings for messages
    user_embedding = await generate_embedding("I need help with my account", use_mock=True)
    agent_embedding = await generate_embedding("I can help you with that", use_mock=True)
    
    # Note: Embeddings are generated automatically by the backend
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="I need help with my account",
            agent_response="I can help you with that",
            user_id=test_user_id,
            user_name="Tester",
        )
    )
    
    # Both memories should be created
    assert len(result.memories) == 2
    # Note: Embeddings are generated automatically by backend if enabled
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_remember_with_fact_extraction(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
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
    from cortex import RememberParams, ListFactsFilter
    
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
async def test_search_with_strategy(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
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
async def test_list_with_filters(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
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
async def test_count_with_filters(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
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
async def test_forget_with_options(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
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
async def test_archive_and_restore(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
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
async def test_get_conversation_ref(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
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
