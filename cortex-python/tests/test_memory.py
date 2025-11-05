"""
Tests for Memory API (Layer 4 convenience)
"""

import pytest

from cortex import RememberParams, SearchOptions, ForgetOptions, CortexError


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

