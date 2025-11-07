"""
Tests for Vector Memory API (Layer 2)

Port of: tests/vector.test.ts

Tests validate:
- SDK API calls
- Storage operations
- Semantic search
- Memory space isolation
- Versioning
"""

import pytest
import time
from cortex import StoreMemoryInput, MemorySource, MemoryMetadata, ConversationRef
from tests.helpers import (
    TestCleanup,
    create_test_memory_input,
    generate_embedding,
    validate_memory_storage,
)


# ============================================================================
# store() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_store_memory_without_embedding(cortex_client, test_ids, cleanup_helper):
    """
    Test storing memory without embedding (keyword search only).
    
    Port of: vector.test.ts - line 43
    """
    memory_space_id = test_ids["memory_space_id"]
    
    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="User prefers dark mode",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(
                importance=60,
                tags=["preferences", "ui"],
            ),
        ),
    )
    
    # Validate result
    assert result.memory_id.startswith("mem-")
    assert result.memory_space_id == memory_space_id
    assert result.content == "User prefers dark mode"
    assert result.embedding is None
    assert result.importance == 60
    assert "preferences" in result.tags
    assert result.version == 1
    assert result.previous_versions == []
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_store_memory_with_embedding(cortex_client, test_ids, cleanup_helper):
    """
    Test storing memory with embedding (semantic search).
    
    Port of: vector.test.ts - line 64
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Generate mock embedding
    mock_embedding = await generate_embedding("User password is Blue123", use_mock=True)
    
    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="User password is Blue123",
            content_type="raw",
            embedding=mock_embedding,
            source=MemorySource(type="conversation", user_id="user-1", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(
                importance=90,
                tags=["password", "security"],
            ),
        ),
    )
    
    # Validate result
    assert result.embedding is not None
    assert len(result.embedding) == 1536
    assert result.source_type == "conversation"
    assert result.source_user_id == "user-1"
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_store_memory_with_conversation_ref(cortex_client, test_ids, cleanup_helper):
    """
    Test storing memory with conversationRef.
    
    Port of: vector.test.ts - line 84
    """
    memory_space_id = test_ids["memory_space_id"]
    
    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="User asked about refunds",
            content_type="summarized",
            source=MemorySource(type="conversation", user_id="user-1", timestamp=int(time.time() * 1000)),
            conversation_ref=ConversationRef(
                conversation_id="conv-123",
                message_ids=["msg-1", "msg-2"],
            ),
            metadata=MemoryMetadata(
                importance=70,
                tags=["refunds"],
            ),
        ),
    )
    
    # Validate result
    assert result.conversation_ref is not None
    # ConversationRef is a dict after conversion
    conv_id = result.conversation_ref.get("conversation_id") if isinstance(result.conversation_ref, dict) else result.conversation_ref.conversation_id
    msg_ids = result.conversation_ref.get("message_ids") if isinstance(result.conversation_ref, dict) else result.conversation_ref.message_ids
    assert conv_id == "conv-123"
    assert msg_ids == ["msg-1", "msg-2"]
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_store_memory_with_user_id_for_gdpr(cortex_client, test_ids, cleanup_helper):
    """
    Test storing memory with userId for GDPR.
    
    Port of: vector.test.ts - line 104
    """
    memory_space_id = test_ids["memory_space_id"]
    user_id = test_ids["user_id"]
    
    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="User-specific data",
            content_type="raw",
            user_id=user_id,
            source=MemorySource(type="conversation", user_id=user_id, timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(
                importance=50,
                tags=["user-data"],
            ),
        ),
    )
    
    # Validate result
    assert result.user_id == user_id
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# get() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_existing_memory(cortex_client, test_ids, cleanup_helper):
    """
    Test retrieving existing memory.
    
    Port of: vector.test.ts - line 137
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create memory first
    memory_input = create_test_memory_input(content="Test memory for retrieval")
    stored = await cortex_client.vector.store(memory_space_id, memory_input)
    memory_id = stored.memory_id
    
    # Retrieve it
    result = await cortex_client.vector.get(memory_space_id, memory_id)
    
    # Validate result
    assert result is not None
    assert result.memory_id == memory_id
    assert result.content == "Test memory for retrieval"
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_get_nonexistent_memory_returns_none(cortex_client, test_ids):
    """
    Test that getting non-existent memory returns None.
    
    Port of: vector.test.ts - line 145
    """
    memory_space_id = test_ids["memory_space_id"]
    
    result = await cortex_client.vector.get(memory_space_id, "mem-does-not-exist")
    
    assert result is None


@pytest.mark.asyncio
async def test_get_memory_space_isolation(cortex_client, test_ids, cleanup_helper):
    """
    Test that memory space isolation is enforced.
    
    Port of: vector.test.ts - line 154
    """
    memory_space_id_1 = test_ids["memory_space_id"]
    memory_space_id_2 = memory_space_id_1 + "-2"
    
    # Store memory in space 1
    memory_input = create_test_memory_input(content="Memory in space 1")
    stored = await cortex_client.vector.store(memory_space_id_1, memory_input)
    memory_id = stored.memory_id
    
    # Try to access from space 2
    result = await cortex_client.vector.get(memory_space_id_2, memory_id)
    
    # Should return None (memory space isolation)
    assert result is None
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id_1)


# ============================================================================
# search() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_search_keyword(cortex_client, test_ids, cleanup_helper):
    """
    Test keyword search finds memories.
    
    Port of: vector.test.ts - line 196
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create searchable memories
    await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="User prefers dark mode for the interface",
            content_type="raw",
            source=MemorySource(type="conversation", user_id="user-1", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=70, tags=["preferences", "ui"]),
        ),
    )
    
    await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="The password for admin account is Secret123",
            content_type="raw",
            source=MemorySource(type="conversation", user_id="user-1", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=95, tags=["password", "security"]),
        ),
    )
    
    # Search for "password"
    results = await cortex_client.vector.search(memory_space_id, "password")
    
    # Should find at least one memory with "password" in content
    assert len(results) > 0
    assert any("password" in m.content.lower() for m in results)
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_search_filter_by_user_id(cortex_client, test_ids, cleanup_helper):
    """
    Test search filters by userId.
    
    Port of: vector.test.ts - line 203
    """
    memory_space_id = test_ids["memory_space_id"]
    user_id = test_ids["user_id"]
    
    # Create memories for different users
    await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="User 1 prefers dark mode",
            content_type="raw",
            source=MemorySource(type="conversation", user_id=user_id, timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=70, tags=["preferences"]),
        ),
    )
    
    await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="User 2 prefers light mode",
            content_type="raw",
                source=MemorySource(type="conversation", user_id="user-2", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=70, tags=["preferences"]),
        ),
    )
    
    # Search with userId filter
    from cortex import SearchOptions
    results = await cortex_client.vector.search(
        memory_space_id,
        "mode",
        SearchOptions(user_id=user_id),
    )
    
    # All results should be from user_id
    assert len(results) > 0
    for memory in results:
        assert memory.source_user_id == user_id
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_search_filter_by_tags(cortex_client, test_ids, cleanup_helper):
    """
    Test search filters by tags.
    
    Port of: vector.test.ts - line 215
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create memories with different tags
    await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="System started successfully",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=20, tags=["system", "status"]),
        ),
    )
    
    await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="User login event",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=30, tags=["user", "auth"]),
        ),
    )
    
    # Search with tags filter
    from cortex import SearchOptions
    results = await cortex_client.vector.search(
        memory_space_id,
        "system",
        SearchOptions(tags=["system"]),
    )
    
    # All results should have "system" tag
    assert len(results) > 0
    for memory in results:
        assert "system" in memory.tags
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_search_filter_by_min_importance(cortex_client, test_ids, cleanup_helper):
    """
    Test search filters by minImportance.
    
    Port of: vector.test.ts - line 226
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create memories with different importance levels
    await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Low importance memory",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=30, tags=["test"]),
        ),
    )
    
    await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="High importance password",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=95, tags=["password"]),
        ),
    )
    
    # Search with minImportance filter
    from cortex import SearchOptions
    results = await cortex_client.vector.search(
        memory_space_id,
        "password",
        SearchOptions(min_importance=90),
    )
    
    # All results should have importance >= 90
    for memory in results:
        assert memory.importance >= 90
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_search_respects_limit(cortex_client, test_ids, cleanup_helper):
    """
    Test search respects limit parameter.
    
    Port of: vector.test.ts - line 236
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create multiple memories
    for i in range(5):
        await cortex_client.vector.store(
            memory_space_id,
            create_test_memory_input(content=f"Test memory {i}"),
        )
    
    # Search with limit=1
    from cortex import SearchOptions
    results = await cortex_client.vector.search(
        memory_space_id,
        "test",
        SearchOptions(limit=1),
    )
    
    # Should return at most 1 result
    assert len(results) <= 1
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# update() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_update_memory_content(cortex_client, test_ids, cleanup_helper):
    """
    Test updating memory content creates new version.
    
    Port of: vector.test.ts - update tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create memory
    memory_input = create_test_memory_input(content="Original content")
    stored = await cortex_client.vector.store(memory_space_id, memory_input)
    memory_id = stored.memory_id
    
    # Update content
    updated = await cortex_client.vector.update(
        memory_space_id,
        memory_id,
        {"content": "Updated content"},
    )
    
    # Should create version 2
    assert updated.version == 2
    assert updated.content == "Updated content"
    assert len(updated.previous_versions) == 1
    # previousVersions contains full version objects, not just numbers
    prev_version = updated.previous_versions[0]
    assert prev_version.get("version") == 1 or prev_version == 1
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_update_memory_importance(cortex_client, test_ids, cleanup_helper):
    """
    Test updating memory importance.
    
    Port of: vector.test.ts - update tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create memory with importance 50
    memory_input = create_test_memory_input(content="Test memory", importance=50)
    stored = await cortex_client.vector.store(memory_space_id, memory_input)
    memory_id = stored.memory_id
    
    # Update importance to 80
    updated = await cortex_client.vector.update(
        memory_space_id,
        memory_id,
        {"importance": 80},
    )
    
    # Importance should be updated
    assert updated.importance == 80
    assert updated.content == "Test memory"  # Content unchanged
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# delete() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_delete_memory(cortex_client, test_ids, cleanup_helper):
    """
    Test deleting a memory.
    
    Port of: vector.test.ts - delete tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create memory
    memory_input = create_test_memory_input(content="Memory to delete")
    stored = await cortex_client.vector.store(memory_space_id, memory_input)
    memory_id = stored.memory_id
    
    # Delete it
    result = await cortex_client.vector.delete(memory_space_id, memory_id)
    
    # Verify deleted
    assert result.get("success") is True or result.get("deleted") is True
    
    # Try to retrieve - should be None
    retrieved = await cortex_client.vector.get(memory_space_id, memory_id)
    assert retrieved is None
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# list() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_memories(cortex_client, test_ids, cleanup_helper):
    """
    Test listing memories in a space.
    
    Port of: vector.test.ts - list tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create multiple memories
    for i in range(3):
        await cortex_client.vector.store(
            memory_space_id,
            create_test_memory_input(content=f"Memory {i+1}"),
        )
    
    # List memories
    result = await cortex_client.vector.list(memory_space_id, limit=10)
    
    # Should return at least 3 memories
    memories = result if isinstance(result, list) else result.get("memories", [])
    assert len(memories) >= 3
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_list_memories_with_limit(cortex_client, test_ids, cleanup_helper):
    """
    Test list respects limit parameter.
    
    Port of: vector.test.ts - list tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create multiple memories
    for i in range(5):
        await cortex_client.vector.store(
            memory_space_id,
            create_test_memory_input(content=f"Memory {i+1}"),
        )
    
    # List with limit=2
    result = await cortex_client.vector.list(memory_space_id, limit=2)
    
    # Should return at most 2 memories
    memories = result if isinstance(result, list) else result.get("memories", [])
    assert len(memories) <= 2
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# count() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_count_memories(cortex_client, test_ids, cleanup_helper):
    """
    Test counting memories in a space.
    
    Port of: vector.test.ts - count tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create memories
    for i in range(4):
        await cortex_client.vector.store(
            memory_space_id,
            create_test_memory_input(content=f"Memory {i+1}"),
        )
    
    # Count memories
    count = await cortex_client.vector.count(memory_space_id)
    
    # Should have at least 4
    assert count >= 4
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# Versioning Tests
# ============================================================================


@pytest.mark.asyncio
async def test_memory_versioning(cortex_client, test_ids, cleanup_helper):
    """
    Test memory versioning on updates.
    
    Port of: vector.test.ts - versioning tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create memory (version 1)
    memory_input = create_test_memory_input(content="Version 1")
    v1 = await cortex_client.vector.store(memory_space_id, memory_input)
    memory_id = v1.memory_id
    
    assert v1.version == 1
    assert v1.previous_versions == []
    
    # Update to version 2
    v2 = await cortex_client.vector.update(
        memory_space_id,
        memory_id,
        {"content": "Version 2"},
    )
    
    assert v2.version == 2
    # previousVersions contains version objects, check length instead
    assert len(v2.previous_versions) >= 1
    
    # Update to version 3
    v3 = await cortex_client.vector.update(
        memory_space_id,
        memory_id,
        {"content": "Version 3"},
    )
    
    assert v3.version == 3
    # previousVersions contains version objects, check length
    assert len(v3.previous_versions) >= 2
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_get_version(cortex_client, test_ids, cleanup_helper):
    """
    Test retrieving specific memory version.
    
    Port of: vector.test.ts - getVersion tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create and update memory
    memory_input = create_test_memory_input(content="Version 1")
    v1 = await cortex_client.vector.store(memory_space_id, memory_input)
    memory_id = v1.memory_id
    
    v2 = await cortex_client.vector.update(
        memory_space_id,
        memory_id,
        {"content": "Version 2"},
    )
    
    # Get version 1
    retrieved_v1 = await cortex_client.vector.get_version(
        memory_space_id,
        memory_id,
        1,
    )
    
    assert retrieved_v1 is not None
    # Handle dict response
    v1_version = retrieved_v1.get("version") if isinstance(retrieved_v1, dict) else retrieved_v1.version
    v1_content = retrieved_v1.get("content") if isinstance(retrieved_v1, dict) else retrieved_v1.content
    assert v1_version == 1
    assert v1_content == "Version 1"
    
    # Get version 2
    retrieved_v2 = await cortex_client.vector.get_version(
        memory_space_id,
        memory_id,
        2,
    )
    
    assert retrieved_v2 is not None
    # Handle dict response
    v2_version = retrieved_v2.get("version") if isinstance(retrieved_v2, dict) else retrieved_v2.version
    v2_content = retrieved_v2.get("content") if isinstance(retrieved_v2, dict) else retrieved_v2.content
    assert v2_version == 2
    assert v2_content == "Version 2"
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_get_history(cortex_client, test_ids, cleanup_helper):
    """
    Test retrieving memory version history.
    
    Port of: vector.test.ts - getHistory tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create memory with multiple versions
    memory_input = create_test_memory_input(content="Version 1")
    v1 = await cortex_client.vector.store(memory_space_id, memory_input)
    memory_id = v1.memory_id
    
    await cortex_client.vector.update(memory_space_id, memory_id, {"content": "Version 2"})
    await cortex_client.vector.update(memory_space_id, memory_id, {"content": "Version 3"})
    
    # Get history
    history = await cortex_client.vector.get_history(memory_space_id, memory_id)
    
    # Should have 3 versions
    assert len(history) >= 3
    
    # Versions should be in order - handle dict or object
    versions = [v.get("version") if isinstance(v, dict) else v.version for v in history]
    assert 1 in versions
    assert 2 in versions
    assert 3 in versions
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# Storage Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_store_validates_in_convex_storage(cortex_client, test_ids, cleanup_helper):
    """
    Test that stored memory exists in Convex storage.
    
    Port of: vector.test.ts - storage validation
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Store memory
    memory_input = create_test_memory_input(content="Storage validation test")
    result = await cortex_client.vector.store(memory_space_id, memory_input)
    
    # Validate in Convex storage
    validation = await validate_memory_storage(
        cortex_client,
        memory_space_id,
        result.memory_id,
        expected_data={"content": "Storage validation test"},
    )
    
    assert validation["exists"]
    assert validation["data"] is not None
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_store_memory_with_special_characters(cortex_client, test_ids, cleanup_helper):
    """
    Test storing memory with special characters in content.
    """
    memory_space_id = test_ids["memory_space_id"]
    
    special_content = "Content with émojis 🎉 and special chars: @#$%^&*()"
    
    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=special_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=["test"]),
        ),
    )
    
    assert result.content == special_content
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_store_memory_with_long_content(cortex_client, test_ids, cleanup_helper):
    """
    Test storing memory with very long content.
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create long content (5000 characters)
    long_content = "This is a very long memory content. " * 150
    
    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=long_content[:5000],
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=["test"]),
        ),
    )
    
    assert len(result.content) <= 5000
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)

