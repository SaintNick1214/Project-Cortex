"""
Integration Tests - Cross-Layer Functionality

Port of: tests/integration.test.ts

Tests validate:
- Cross-layer data flow
- Reference integrity
- ACID + Vector linkage
- Orphan detection
"""

import time

import pytest

from cortex import ForgetOptions, RememberParams
from tests.helpers import create_test_memory_input

# ============================================================================
# Remember Integration Tests
# ============================================================================


@pytest.mark.integration
@pytest.mark.asyncio
async def test_remember_creates_conversation_and_memories(cortex_client, test_ids, cleanup_helper):
    """
    Test that remember() creates both conversation and memories.

    Port of: integration.test.ts - remember integration
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    user_id = test_ids["user_id"]

    # Remember creates conversation + memories
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Hello",
            agent_response="Hi there!",
            user_id=user_id,
            user_name="Tester",
        )
    )

    # Verify conversation was created
    conv = await cortex_client.conversations.get(conversation_id)
    assert conv is not None
    assert conv.message_count == 2

    # Verify memories were created
    assert len(result.memories) == 2

    # Verify linkage - memories should reference conversation
    for memory in result.memories:
        assert memory.conversation_ref is not None
        # conversation_ref is a dict after conversion
        conv_id = memory.conversation_ref.get("conversation_id") if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
        assert conv_id == conversation_id

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_forget_deletes_both_layers(cortex_client, test_ids, cleanup_helper):
    """
    Test that forget() can delete from both ACID and Vector layers.

    Port of: integration.test.ts - forget integration
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    user_id = test_ids["user_id"]

    # Remember
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Forget me",
            agent_response="Okay",
            user_id=user_id,
            user_name="Tester",
        )
    )

    memory_id = result.memories[0].memory_id

    # Forget with conversation deletion
    forget_result = await cortex_client.memory.forget(
        memory_space_id,
        memory_id,
        ForgetOptions(
            delete_conversation=True,
            delete_entire_conversation=True,
        ),
    )

    # Both should be deleted
    assert forget_result.memory_deleted is True
    assert forget_result.conversation_deleted is True

    # Verify conversation is gone
    conv = await cortex_client.conversations.get(conversation_id)
    assert conv is None

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_cross_layer_reference_integrity(cortex_client, test_ids, cleanup_helper):
    """
    Test reference integrity between layers.

    Port of: integration.test.ts - reference integrity
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    user_id = test_ids["user_id"]

    # Create conversation
    from cortex import ConversationParticipants, CreateConversationInput
    await cortex_client.conversations.create(
        CreateConversationInput(
            conversation_id=conversation_id,
            memory_space_id=memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(user_id=user_id),
        )
    )

    # Add messages
    from cortex import AddMessageInput
    await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conversation_id,
            role="user",
            content="Test message",
        )
    )

    # Create memory referencing conversation
    from cortex import ConversationRef, MemoryMetadata, MemorySource, StoreMemoryInput
    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Memory with conversation ref",
            content_type="raw",
            conversation_ref=ConversationRef(
                conversation_id=conversation_id,
                message_ids=[],
            ),
            source=MemorySource(type="conversation", user_id=user_id, timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=["test"]),
        ),
    )

    # Verify reference exists
    assert memory.conversation_ref is not None
    # conversation_ref is a dict after conversion
    conv_id = memory.conversation_ref.get("conversation_id") if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
    assert conv_id == conversation_id

    # Get conversation - verify it exists
    conv_check = await cortex_client.conversations.get(conversation_id)
    assert conv_check is not None

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_memory_facts_linkage(cortex_client, test_ids, cleanup_helper):
    """
    Test linkage between memories and facts.

    Port of: integration.test.ts - memory-facts integration
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    user_id = test_ids["user_id"]

    # Define fact extraction
    async def extract_facts(user_msg, agent_msg):
        return [
            {
                "fact": "User likes pizza",
                "factType": "preference",
                "confidence": 90,
            }
        ]

    # Remember with fact extraction
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="I love pizza",
            # Agent response with meaningful content (not just acknowledgment)
            agent_response="I'll remember that you love pizza for future restaurant recommendations",
            user_id=user_id,
            user_name="Tester",
            extract_facts=extract_facts,
        )
    )

    # Verify memories created (both user and agent have meaningful content)
    assert len(result.memories) == 2

    # Verify facts created
    assert len(result.facts) > 0

    # Verify linkage - facts should be in same memory space
    fact = result.facts[0]
    assert fact.memory_space_id == memory_space_id

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_user_cascade_affects_all_layers(cortex_client, test_ids, cleanup_helper):
    """
    Test user deletion cascades to all layers.

    Port of: integration.test.ts - cascade integration
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    user_id = test_ids["user_id"]

    # Create user profile
    await cortex_client.users.update(user_id, {"displayName": "Cascade Test"})

    # Create memories
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="User data",
            agent_response="Response",
            user_id=user_id,
            user_name="Tester",
        )
    )

    # Count memories before
    mem_count_before = await cortex_client.vector.count(
        memory_space_id,
        user_id=user_id,
    )
    assert mem_count_before > 0

    # Delete user with cascade
    from cortex import DeleteUserOptions
    delete_result = await cortex_client.users.delete(
        user_id,
        DeleteUserOptions(cascade=True),
    )

    # Should have deleted from multiple layers
    assert delete_result.total_deleted > 0

    # Count memories after - should be 0
    mem_count_after = await cortex_client.vector.count(
        memory_space_id,
        user_id=user_id,
    )
    assert mem_count_after == 0

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_memory_space_isolation(cortex_client, test_ids, cleanup_helper):
    """
    Test that memory spaces are isolated from each other.

    Port of: integration.test.ts - isolation tests
    """
    space_1 = test_ids["memory_space_id"]
    space_2 = space_1 + "-isolated"
    test_ids["user_id"]

    # Create memory in space 1
    await cortex_client.vector.store(
        space_1,
        create_test_memory_input(content="Space 1 memory"),
    )

    # Create memory in space 2
    await cortex_client.vector.store(
        space_2,
        create_test_memory_input(content="Space 2 memory"),
    )

    # List space 1 - should only see space 1 memory
    list1 = await cortex_client.vector.list(space_1, limit=100)
    memories1 = list1 if isinstance(list1, list) else list1.get("memories", [])

    # Verify space 1 only has its own memories
    for mem in memories1:
        mem_space = mem.get("memory_space_id") if isinstance(mem, dict) else mem.memory_space_id
        assert mem_space == space_1

    # List space 2 - should only see space 2 memory
    list2 = await cortex_client.vector.list(space_2, limit=100)
    memories2 = list2 if isinstance(list2, list) else list2.get("memories", [])

    # Verify space 2 only has its own memories
    for mem in memories2:
        mem_space = mem.get("memory_space_id") if isinstance(mem, dict) else mem.memory_space_id
        assert mem_space == space_2

    # Cleanup
    await cleanup_helper.purge_memory_space(space_1)
    await cleanup_helper.purge_memory_space(space_2)

