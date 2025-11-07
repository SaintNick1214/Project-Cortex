"""
Tests for Memory Spaces API

Port of: tests/memorySpaces.test.ts

Tests validate:
- Memory space registration
- Hive mode (shared spaces)
- Collaboration mode (separate spaces)
- Memory space metadata
"""

import pytest
from cortex import RegisterMemorySpaceParams
from tests.helpers import generate_test_memory_space_id


# ============================================================================
# register() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_register_memory_space(cortex_client, test_ids):
    """
    Test registering a memory space.
    
    Port of: memorySpaces.test.ts - register tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    result = await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=memory_space_id,
            name="Test Memory Space",
            description="Space for testing",
            type="personal",
            owner_id=test_ids["user_id"],
            metadata={"environment": "test"},
        )
    )
    
    # Validate result
    assert result.memory_space_id == memory_space_id
    assert result.name == "Test Memory Space"
    assert result.type == "personal"
    assert result.status == "active"
    
    # Cleanup
    await cortex_client.memory_spaces.delete(memory_space_id)


@pytest.mark.asyncio
async def test_register_shared_memory_space(cortex_client, test_ids):
    """
    Test registering shared memory space (Hive mode).
    
    Port of: memorySpaces.test.ts - hive mode tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    result = await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=memory_space_id,
            name="Shared Space",
            type="shared",
            participants=["agent-1", "agent-2", "agent-3"],
            metadata={"mode": "hive"},
        )
    )
    
    # Validate result
    assert result.type == "shared"
    assert len(result.participants) >= 3
    
    # Cleanup
    await cortex_client.memory_spaces.delete(memory_space_id)


# ============================================================================
# get() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_memory_space(cortex_client, test_ids):
    """
    Test retrieving a memory space by ID.
    
    Port of: memorySpaces.test.ts - get tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Register space
    await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=memory_space_id,
            name="Get Test Space",
            type="personal",
        )
    )
    
    # Get space
    retrieved = await cortex_client.memory_spaces.get(memory_space_id)
    
    assert retrieved is not None
    assert retrieved.memory_space_id == memory_space_id
    assert retrieved.name == "Get Test Space"
    
    # Cleanup
    await cortex_client.memory_spaces.delete(memory_space_id)


@pytest.mark.asyncio
async def test_get_nonexistent_returns_none(cortex_client):
    """
    Test that getting non-existent space returns None.
    
    Port of: memorySpaces.test.ts - get tests
    """
    result = await cortex_client.memory_spaces.get("space-does-not-exist")
    
    assert result is None


# ============================================================================
# list() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_memory_spaces(cortex_client, test_ids):
    """
    Test listing memory spaces.
    
    Port of: memorySpaces.test.ts - list tests
    """
    # Register multiple spaces
    space_ids = []
    for i in range(3):
        space_id = f"{test_ids['memory_space_id']}-{i}"
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id,
                name=f"Space {i+1}",
                type="personal",
            )
        )
        space_ids.append(space_id)
    
    # List spaces
    result = await cortex_client.memory_spaces.list(limit=100)
    
    # Should return at least our 3 spaces
    spaces = result if isinstance(result, list) else result.get("spaces", [])
    assert len(spaces) >= 3
    
    # Cleanup
    for space_id in space_ids:
        await cortex_client.memory_spaces.delete(space_id)


@pytest.mark.asyncio
async def test_list_filter_by_type(cortex_client, test_ids):
    """
    Test listing memory spaces filtered by type.
    
    Port of: memorySpaces.test.ts - list tests
    """
    # Register spaces of different types
    personal_id = f"{test_ids['memory_space_id']}-personal"
    shared_id = f"{test_ids['memory_space_id']}-shared"
    
    await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=personal_id,
            name="Personal Space",
            type="personal",
        )
    )
    
    await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=shared_id,
            name="Shared Space",
            type="shared",
        )
    )
    
    # List only personal spaces
    result = await cortex_client.memory_spaces.list(type="personal", limit=100)
    
    spaces = result if isinstance(result, list) else result.get("spaces", [])
    
    # All should be personal type
    for space in spaces:
        space_type = space.get("type") if isinstance(space, dict) else space.type
        assert space_type == "personal"
    
    # Cleanup
    await cortex_client.memory_spaces.delete(personal_id)
    await cortex_client.memory_spaces.delete(shared_id)


# ============================================================================
# delete() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_delete_memory_space(cortex_client, test_ids):
    """
    Test deleting a memory space.
    
    Port of: memorySpaces.test.ts - delete tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Register space
    await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=memory_space_id,
            name="Space to Delete",
            type="personal",
        )
    )
    
    # Delete space
    result = await cortex_client.memory_spaces.delete(memory_space_id)
    
    # Verify deleted
    retrieved = await cortex_client.memory_spaces.get(memory_space_id)
    assert retrieved is None


# ============================================================================
# count() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_count_memory_spaces(cortex_client, test_ids):
    """
    Test counting memory spaces.
    
    Port of: memorySpaces.test.ts - count tests
    """
    # Register spaces
    space_ids = []
    for i in range(3):
        space_id = f"{test_ids['memory_space_id']}-count-{i}"
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id,
                name=f"Count Space {i+1}",
                type="personal",
            )
        )
        space_ids.append(space_id)
    
    # Count spaces
    count = await cortex_client.memory_spaces.count()
    
    assert count >= 3
    
    # Cleanup
    for space_id in space_ids:
        await cortex_client.memory_spaces.delete(space_id)


# ============================================================================
# getStats() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_memory_space_stats(cortex_client, test_ids, cleanup_helper):
    """
    Test getting memory space statistics.
    
    Port of: memorySpaces.test.ts - getStats tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Register space
    await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=memory_space_id,
            name="Stats Test Space",
            type="personal",
        )
    )
    
    # Create some data in the space
    from tests.helpers import create_test_memory_input
    await cortex_client.vector.store(memory_space_id, create_test_memory_input())
    
    # Get stats
    stats = await cortex_client.memory_spaces.get_stats(memory_space_id)
    
    # Validate stats exist
    assert stats is not None
    # Memory count should be at least 1
    if hasattr(stats, 'memory_count'):
        assert stats.memory_count >= 1
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)
    await cortex_client.memory_spaces.delete(memory_space_id)

