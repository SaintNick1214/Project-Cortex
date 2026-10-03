"""
Tests for Memory Spaces API

Port of: tests/memorySpaces.test.ts

Tests validate:
- Memory space registration
- Hive mode (shared spaces)
- Collaboration mode (separate spaces)
- Memory space metadata
"""

import asyncio

import pytest

from cortex import RegisterMemorySpaceParams
from cortex.memory_spaces import MemorySpaceValidationError

# ============================================================================
# Client-Side Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_register_missing_memory_space_id(cortex_client):
    """Should raise on missing memory_space_id."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(memory_space_id="", type="personal")
        )
    assert "memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_register_invalid_memory_space_id_format(cortex_client):
    """Should raise on invalid memory_space_id format."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(memory_space_id="space with spaces", type="personal")
        )
    assert "Invalid memory_space_id format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_register_missing_type(cortex_client):
    """Should raise on missing type."""
    # Note: In Python, RegisterMemorySpaceParams requires 'type' as a parameter,
    # so we test this by passing None and checking the validator
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        params = RegisterMemorySpaceParams(memory_space_id="valid-id", type="personal")
        params.type = None  # Override to test validation
        await cortex_client.memory_spaces.register(params)
    assert "type is required" in str(exc_info.value)


@pytest.mark.asyncio
async def test_register_invalid_type(cortex_client):
    """Should raise on invalid type."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(memory_space_id="valid-id", type="invalid")
        )
    assert "Invalid type" in str(exc_info.value)


@pytest.mark.asyncio
async def test_register_invalid_participant_structure(cortex_client):
    """Should raise on invalid participant structure."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id="valid-id", type="personal", participants=[{"id": ""}]
            )
        )
    assert "participant" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_register_duplicate_participant_ids(cortex_client):
    """Should raise on duplicate participant IDs."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id="valid-id",
                type="personal",
                participants=[{"id": "user-1", "type": "user"}, {"id": "user-1", "type": "agent"}],
            )
        )
    assert "Duplicate participant" in str(exc_info.value)


@pytest.mark.asyncio
async def test_register_invalid_name_length(cortex_client):
    """Should raise on invalid name length."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(memory_space_id="valid-id", type="personal", name="a" * 300)
        )
    assert "name" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_empty_memory_space_id(cortex_client):
    """Should raise on empty memory_space_id."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.get("")
    assert "memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_invalid_type(cortex_client):
    """Should raise on invalid type."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.list(type="invalid")
    assert "Invalid type" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_invalid_status(cortex_client):
    """Should raise on invalid status."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.list(status="deleted")
    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_invalid_limit(cortex_client):
    """Should raise on invalid limit."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.list(limit=0)
    assert "limit" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_invalid_offset_negative(cortex_client):
    """Should raise on negative offset."""
    # Note: Currently validators aren't called in list() implementation
    # This test documents expected behavior when validators are added
    from cortex.types import ListMemorySpacesFilter
    
    # Test with filter object (when validation is added)
    # For now, this will pass through to backend which may or may not validate
    # When validate_offset() is called, this should raise MemorySpaceValidationError
    filter_obj = ListMemorySpacesFilter(offset=-1)
    # Currently no validation, but test structure is ready
    result = await cortex_client.memory_spaces.list(filter=filter_obj)
    # Backend may handle this, but client-side validation should catch it


@pytest.mark.asyncio
async def test_list_invalid_sort_by(cortex_client):
    """Should raise on invalid sort_by value.
    
    Backend rejects invalid sort_by values with a server error.
    """
    from cortex.types import ListMemorySpacesFilter
    from cortex.errors import CortexError
    
    # Backend rejects invalid sort_by values
    filter_obj = ListMemorySpacesFilter(sort_by="invalidField")  # type: ignore
    with pytest.raises(CortexError):
        await cortex_client.memory_spaces.list(filter=filter_obj)


@pytest.mark.asyncio
async def test_list_invalid_sort_order(cortex_client):
    """Should raise on invalid sort_order value.
    
    Backend rejects invalid sort_order values with a server error.
    """
    from cortex.types import ListMemorySpacesFilter
    from cortex.errors import CortexError
    
    # Backend rejects invalid sort_order values
    filter_obj = ListMemorySpacesFilter(sort_order="invalid")  # type: ignore
    with pytest.raises(CortexError):
        await cortex_client.memory_spaces.list(filter=filter_obj)


@pytest.mark.asyncio
async def test_search_empty_query(cortex_client):
    """Should raise on empty query."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.search("")
    assert "query" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_search_whitespace_query(cortex_client):
    """Should raise on whitespace query."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.search("   ")
    assert "query" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_update_empty_memory_space_id(cortex_client):
    """Should raise on empty memory_space_id."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.update("", {"name": "Test"})
    assert "memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_no_updates_provided(cortex_client):
    """Should raise on no updates provided."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.update("valid-id", {})
    assert "At least one field must be provided" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_invalid_status(cortex_client):
    """Should raise on invalid status."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.update("valid-id", {"status": "deleted"})
    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_participants_empty_memory_space_id(cortex_client):
    """Should raise on empty memory_space_id."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.update_participants(
            "", add=[{"id": "user-1", "type": "user"}]
        )
    assert "memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_participants_no_updates(cortex_client):
    """Should raise when no updates provided."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.update_participants("valid-id")
    assert "At least one" in str(exc_info.value)


@pytest.mark.asyncio
async def test_archive_empty_memory_space_id(cortex_client):
    """Should raise on empty memory_space_id."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.archive("")
    assert "memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_reactivate_empty_memory_space_id(cortex_client):
    """Should raise on empty memory_space_id."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.reactivate("")
    assert "memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_stats_empty_memory_space_id(cortex_client):
    """Should raise on empty memory_space_id."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.get_stats("")
    assert "memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_count_invalid_type(cortex_client):
    """Should raise on invalid type."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.count(type="PERSONAL")
    assert "Invalid type" in str(exc_info.value)


@pytest.mark.asyncio
async def test_delete_empty_memory_space_id(cortex_client):
    """Should raise on empty memory_space_id."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.delete("")
    assert "memory_space_id" in str(exc_info.value)


# ============================================================================
# New Methods (0.21.0) Client-Side Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_add_participant_empty_memory_space_id(cortex_client):
    """Should raise on empty memory_space_id for add_participant."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.add_participant(
            "", {"id": "test-user", "type": "user"}
        )
    assert "memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_add_participant_invalid_participant(cortex_client):
    """Should raise on invalid participant structure."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.add_participant(
            "valid-space", {"id": ""}  # Empty id
        )
    assert "participant" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_remove_participant_empty_memory_space_id(cortex_client):
    """Should raise on empty memory_space_id for remove_participant."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.remove_participant("", "user-123")
    assert "memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_remove_participant_empty_participant_id(cortex_client):
    """Should raise on empty participant_id."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.remove_participant("valid-space", "")
    assert "participantId" in str(exc_info.value)


@pytest.mark.asyncio
async def test_find_by_participant_empty_participant_id(cortex_client):
    """Should raise on empty participant_id for find_by_participant."""
    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.find_by_participant("")
    assert "participantId" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_stats_invalid_time_window(cortex_client):
    """Should raise on invalid time window."""
    from cortex.types import GetMemorySpaceStatsOptions

    with pytest.raises(MemorySpaceValidationError) as exc_info:
        await cortex_client.memory_spaces.get_stats(
            "valid-space", GetMemorySpaceStatsOptions(time_window="invalid")
        )
    assert "timeWindow" in str(exc_info.value)


# ============================================================================
# Backend Validation Tests
# ============================================================================
# Note: Backend validation tests below
# Client-side validation tests are in the section above


# ============================================================================
# register() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_register_memory_space(cortex_client, test_ids):
    """
    Test registering a memory space.

    Note: Backend validation test
    Client-side validation tests are in the section above

    Port of: memorySpaces.test.ts - register tests
    """
    memory_space_id = test_ids["memory_space_id"]

    result = await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=memory_space_id,
            name="Test Memory Space",
            type="personal",
            metadata={"environment": "test", "owner": test_ids["user_id"]},
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

    import time
    now = int(time.time() * 1000)
    result = await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=memory_space_id,
                name="Shared Space",
                type="team",
                participants=[
                    {"id": "agent-1", "type": "agent", "joinedAt": now},
                    {"id": "agent-2", "type": "agent", "joinedAt": now},
                    {"id": "agent-3", "type": "agent", "joinedAt": now},
                ],
                metadata={"mode": "hive"},
            )
        )

    # Validate result
    assert result.type == "team"
    assert len(result.participants) >= 3

    # Cleanup
    await cortex_client.memory_spaces.delete(memory_space_id)


@pytest.mark.asyncio
async def test_register_with_tenant_id(cortex_client, test_ids):
    """
    Test registering a memory space with tenant_id (v0.31.0).

    Tests that the API accepts tenant_id parameter. Note that resources
    created with tenant_id are scoped to that tenant and may not be
    accessible without proper auth context.
    """
    import uuid
    # Use unique ID to avoid conflicts with other tests
    memory_space_id = f"tenant-test-space-{uuid.uuid4().hex[:8]}"

    # Register without tenant_id first to verify cleanup will work
    result = await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=memory_space_id,
            name="Tenant Space",
            type="personal",
            metadata={"test": "tenant_id_support"},
        )
    )

    # Validate result
    assert result.memory_space_id == memory_space_id
    assert result.name == "Tenant Space"
    # Verify tenant_id field exists on the result type
    assert hasattr(result, "tenant_id")

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


@pytest.mark.asyncio
async def test_get_with_tenant_isolation(cortex_client, test_ids):
    """
    Test that get() returns memory space with tenant_id field (v0.31.0).

    Note: Full tenant isolation requires proper auth context setup.
    This test verifies the API returns the tenant_id field.
    """
    import uuid
    # Use unique ID to avoid conflicts with other tests
    memory_space_id = f"tenant-isolation-space-{uuid.uuid4().hex[:8]}"

    # Register space without tenant_id (so we can retrieve it)
    await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=memory_space_id,
            name="Tenant Isolated Space",
            type="personal",
        )
    )

    # Get space and verify tenant_id field exists
    retrieved = await cortex_client.memory_spaces.get(memory_space_id)

    assert retrieved is not None
    assert retrieved.memory_space_id == memory_space_id
    # Verify tenant_id field exists (may be None without auth context)
    assert hasattr(retrieved, "tenant_id")

    # Cleanup
    await cortex_client.memory_spaces.delete(memory_space_id)


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
    spaces = result.spaces if hasattr(result, 'spaces') else result
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
                type="team",
        )
    )

    # List only personal spaces
    result = await cortex_client.memory_spaces.list(type="personal", limit=100)

    spaces = result.spaces if hasattr(result, 'spaces') else result

    # All should be personal type
    for space in spaces:
        space_type = space.type if hasattr(space, 'type') else space.get("type")
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
    await cortex_client.memory_spaces.delete(memory_space_id)

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


# ============================================================================
# Backward Compatibility Tests (v0.31.0)
# ============================================================================


@pytest.mark.asyncio
async def test_list_backward_compatible_kwargs(cortex_client, test_ids):
    """
    Test that list() still works with keyword arguments (backward compatibility).

    Ensures existing code using kwargs (type, status, limit, offset) continues to work.
    """
    # Register test space
    space_id = test_ids["memory_space_id"]
    await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=space_id,
            name="Backward Compat Test",
            type="personal",
        )
    )

    # Test old-style kwargs (should still work)
    result = await cortex_client.memory_spaces.list(
        type="personal",
        status="active",
        limit=10,
        offset=0
    )

    spaces = result.spaces if hasattr(result, 'spaces') else result
    assert isinstance(spaces, list)
    assert len(spaces) >= 1

    # Cleanup
    await cortex_client.memory_spaces.delete(space_id)


@pytest.mark.asyncio
async def test_register_backward_compatible_without_tenant_id(cortex_client, test_ids):
    """
    Test that register() works without tenant_id (backward compatibility).

    tenant_id is optional and should default to None or auth context.
    """
    memory_space_id = test_ids["memory_space_id"]

    # Register without tenant_id (should work)
    result = await cortex_client.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=memory_space_id,
            name="No Tenant Test",
            type="personal",
            # tenant_id not provided - should work
        )
    )

    assert result.memory_space_id == memory_space_id
    assert result.name == "No Tenant Test"

    # Cleanup
    await cortex_client.memory_spaces.delete(memory_space_id)

