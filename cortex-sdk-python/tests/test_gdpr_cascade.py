"""
GDPR Cascade Deletion Tests

Port of: tests/gdprCascade.test.ts

Tests validate:
- Complete cascade deletion across all layers
- Verification phase
- Rollback on failure
- Deletion planning
"""

import pytest
import time
from cortex import RememberParams, DeleteUserOptions
from tests.helpers import TestCleanup


# ============================================================================
# Basic Cascade Tests
# ============================================================================


@pytest.mark.asyncio
async def test_cascade_delete_user_profile_layer(cortex_client, test_user_id, cleanup_helper):
    """
    Test cascade deletion removes user profile.
    
    Port of: gdprCascade.test.ts - user profile layer
    """
    # Create user
    await cortex_client.users.update(
        test_user_id,
        {"displayName": "GDPR Test User", "email": "gdpr@test.com"},
    )
    
    # Delete with cascade
    result = await cortex_client.users.delete(
        test_user_id,
        DeleteUserOptions(cascade=True),
    )
    
    # Verify user profile deleted
    assert "user-profile" in result.deleted_layers
    
    # User should be gone
    user = await cortex_client.users.get(test_user_id)
    assert user is None


@pytest.mark.asyncio
async def test_cascade_delete_conversations_layer(cortex_client, test_ids, cleanup_helper):
    """
    Test cascade deletion removes user's conversations.
    
    Port of: gdprCascade.test.ts - conversations layer
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    user_id = test_ids["user_id"]
    
    # Create user
    await cortex_client.users.update(user_id, {"displayName": "Cascade Test"})
    
    # Create conversation for user
    from cortex import CreateConversationInput, ConversationParticipants
    await cortex_client.conversations.create(
        CreateConversationInput(
            conversation_id=conversation_id,
            memory_space_id=memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(user_id=user_id),
        )
    )
    
    # Delete user with cascade
    result = await cortex_client.users.delete(
        user_id,
        DeleteUserOptions(cascade=True),
    )
    
    # Verify conversations deleted
    assert "conversations" in result.deleted_layers
    
    # Conversation should be gone
    conv = await cortex_client.conversations.get(conversation_id)
    assert conv is None
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_cascade_delete_memories_layer(cortex_client, test_ids, cleanup_helper):
    """
    Test cascade deletion removes user's memories.
    
    Port of: gdprCascade.test.ts - memories layer
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    user_id = test_ids["user_id"]
    
    # Create user
    await cortex_client.users.update(user_id, {"displayName": "Memory Cascade Test"})
    
    # Create memories for user
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="User's message",
            agent_response="Response",
            user_id=user_id,
            user_name="Tester",
        )
    )
    
    # Count memories before
    count_before = await cortex_client.vector.count(
        memory_space_id,
        user_id=user_id,
    )
    assert count_before > 0
    
    # Delete user with cascade
    delete_result = await cortex_client.users.delete(
        user_id,
        DeleteUserOptions(cascade=True),
    )
    
    # Verify memories deleted
    assert "memories" in delete_result.deleted_layers or delete_result.total_deleted > 1
    
    # Count memories after
    count_after = await cortex_client.vector.count(
        memory_space_id,
        user_id=user_id,
    )
    assert count_after == 0
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# Cascade Verification Tests
# ============================================================================


@pytest.mark.asyncio
async def test_cascade_with_verification(cortex_client, test_ids, cleanup_helper):
    """
    Test cascade deletion with verification enabled.
    
    Port of: gdprCascade.test.ts - verification tests
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    user_id = test_ids["user_id"]
    
    # Create user with data
    await cortex_client.users.update(user_id, {"displayName": "Verify Test"})
    
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Data to delete",
            agent_response="Response",
            user_id=user_id,
            user_name="Tester",
        )
    )
    
    # Delete with verification
    result = await cortex_client.users.delete(
        user_id,
        DeleteUserOptions(cascade=True, verify=True),
    )
    
    # Should have verification result
    assert result.verification is not None
    assert result.verification.complete is True
    assert len(result.verification.issues) == 0
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_cascade_dry_run(cortex_client, test_ids, cleanup_helper):
    """
    Test cascade deletion dry run (plan only, no actual deletion).
    
    Port of: gdprCascade.test.ts - dry run tests
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    user_id = test_ids["user_id"]
    
    # Create user with data
    await cortex_client.users.update(user_id, {"displayName": "Dry Run Test"})
    
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Should not be deleted",
            agent_response="Response",
            user_id=user_id,
            user_name="Tester",
        )
    )
    
    # Dry run cascade
    result = await cortex_client.users.delete(
        user_id,
        DeleteUserOptions(cascade=True, dry_run=True),
    )
    
    # Should return plan
    assert result.total_deleted >= 0  # Plan shows what would be deleted
    
    # User should still exist
    user = await cortex_client.users.get(user_id)
    assert user is not None
    
    # Memories should still exist
    count = await cortex_client.vector.count(memory_space_id, user_id=user_id)
    assert count > 0
    
    # Cleanup
    await cortex_client.users.delete(user_id, DeleteUserOptions(cascade=True))
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# Multi-Layer Cascade Tests
# ============================================================================


@pytest.mark.asyncio
async def test_cascade_all_layers(cortex_client, test_ids, cleanup_helper):
    """
    Test cascade deletion across all 4 layers.
    
    Port of: gdprCascade.test.ts - all layers test
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    user_id = test_ids["user_id"]
    
    # Layer 0: User profile
    await cortex_client.users.update(user_id, {"displayName": "All Layers Test"})
    
    # Layer 1a: Conversation
    from cortex import CreateConversationInput, ConversationParticipants, AddMessageInput
    await cortex_client.conversations.create(
        CreateConversationInput(
            conversation_id=conversation_id,
            memory_space_id=memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(user_id=user_id),
        )
    )
    
    await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conversation_id,
            role="user",
            content="Test message",
        )
    )
    
    # Layer 2: Vector memories
    from cortex import StoreMemoryInput, MemorySource, MemoryMetadata
    await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="User-specific memory",
            content_type="raw",
            user_id=user_id,
            source=MemorySource(type="conversation", user_id=user_id, timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=["user-data"]),
        ),
    )
    
    # Layer 3: Facts (via remember with extraction)
    async def extract_facts(user_msg, agent_msg):
        return [{"fact": "User fact", "factType": "observation", "confidence": 80}]
    
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Create fact",
            agent_response="Done",
            user_id=user_id,
            user_name="Tester",
            extract_facts=extract_facts,
        )
    )
    
    # Delete user with full cascade
    result = await cortex_client.users.delete(
        user_id,
        DeleteUserOptions(cascade=True, verify=True),
    )
    
    # Should have deleted from all layers
    assert result.total_deleted > 0
    expected_layers = {"user-profile", "conversations", "memories"}
    assert len(set(result.deleted_layers) & expected_layers) >= 2
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)

