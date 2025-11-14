"""
Tests for Mutable Store API (Layer 1c)

Port of: tests/mutable.test.ts

Tests validate:
- SDK API calls
- Atomic updates
- State change propagation
- Key-value operations
"""

import pytest
from tests.helpers import TestCleanup


# ============================================================================
# set() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_set_creates_new_record(cortex_client, test_ids, cleanup_helper):
    """
    Test creating a new mutable record.
    
    Port of: mutable.test.ts - set tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    result = await cortex_client.mutable.set(
        "test-namespace",
        "user-status",
        {"status": "online", "lastSeen": 1234567890},
    )
    
    # Validate result - it's a MutableRecord object
    assert result.namespace == "test-namespace"
    assert result.key == "user-status"
    assert result.value is not None
    
    # Cleanup
    await cleanup_helper.purge_mutable(memory_space_id, key_prefix=None)


@pytest.mark.asyncio
async def test_set_overwrites_existing_record(cortex_client, test_ids, cleanup_helper):
    """
    Test overwriting existing mutable record.
    
    Port of: mutable.test.ts - set tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Set initial value
    await cortex_client.mutable.set(
        "test-namespace",
        "counter",
        {"count": 0},
    )
    
    # Overwrite with new value
    result = await cortex_client.mutable.set(
        "test-namespace",
        "counter",
        {"count": 10},
    )
    
    # Get the value
    retrieved = await cortex_client.mutable.get(
        "test-namespace",
        "counter",
    )
    
    assert retrieved is not None
    # mutable.get() returns full record, value is in 'value' field
    assert retrieved["value"]["count"] == 10
    
    # Cleanup
    await cleanup_helper.purge_mutable(memory_space_id, key_prefix=None)


# ============================================================================
# get() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_existing_record(cortex_client, test_ids, cleanup_helper):
    """
    Test getting existing mutable record.
    
    Port of: mutable.test.ts - get tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Set value
    await cortex_client.mutable.set(
        "test-namespace",
        "test-key",
        {"data": "test value"},
    )
    
    # Get value
    result = await cortex_client.mutable.get(
        "test-namespace",
        "test-key",
    )
    
    assert result is not None
    # mutable.get() returns full record, value is in 'value' field
    assert result["value"]["data"] == "test value"
    
    # Cleanup
    await cleanup_helper.purge_mutable(memory_space_id, key_prefix=None)


@pytest.mark.asyncio
async def test_get_nonexistent_returns_none(cortex_client, test_ids):
    """
    Test that getting non-existent record returns None.
    
    Port of: mutable.test.ts - get tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    result = await cortex_client.mutable.get(
        "test-namespace",
        "does-not-exist",
    )
    
    assert result is None


# ============================================================================
# update() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_update_merges_values(cortex_client, test_ids, cleanup_helper):
    """
    Test update merges with existing value.
    
    Port of: mutable.test.ts - update tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Set initial value
    await cortex_client.mutable.set(
        "test-namespace",
        "user-prefs",
        {"theme": "dark", "notifications": True},
    )
    
    # Update (requires a callable updater function)
    result = await cortex_client.mutable.update(
        "test-namespace",
        "user-prefs",
        lambda current: {**current, "language": "en"},
    )
    
    # Get merged result
    retrieved = await cortex_client.mutable.get(
        "test-namespace",
        "user-prefs",
    )
    
    # Should have all fields - value is in 'value' field
    assert retrieved["value"]["theme"] == "dark"
    assert retrieved["value"]["notifications"] is True
    assert retrieved["value"]["language"] == "en"
    
    # Cleanup
    await cleanup_helper.purge_mutable(memory_space_id, key_prefix=None)


# ============================================================================
# delete() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_delete_record(cortex_client, test_ids, cleanup_helper):
    """
    Test deleting a mutable record.
    
    Port of: mutable.test.ts - delete tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create record
    await cortex_client.mutable.set(
        "test-namespace",
        "delete-test",
        {"value": "to delete"},
    )
    
    # Delete it
    result = await cortex_client.mutable.delete(
        "test-namespace",
        "delete-test",
    )
    
    # Verify deleted
    retrieved = await cortex_client.mutable.get(
        "test-namespace",
        "delete-test",
    )
    
    assert retrieved is None
    
    # Cleanup
    await cleanup_helper.purge_mutable(memory_space_id, key_prefix=None)


# ============================================================================
# list() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_records_in_namespace(cortex_client, test_ids, cleanup_helper):
    """
    Test listing records in a namespace.
    
    Port of: mutable.test.ts - list tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create multiple records
    for i in range(3):
        await cortex_client.mutable.set(
            "test-namespace",
            f"key-{i}",
            {"value": i},
        )
    
    # List records
    result = await cortex_client.mutable.list(
        "test-namespace",
        limit=10,
    )
    
    # Should return at least 3 records
    records = result if isinstance(result, list) else result.get("records", [])
    assert len(records) >= 3
    
    # Cleanup
    await cleanup_helper.purge_mutable(memory_space_id, key_prefix=None)


# ============================================================================
# count() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_count_records(cortex_client, test_ids, cleanup_helper):
    """
    Test counting records in a namespace.
    
    Port of: mutable.test.ts - count tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create records
    for i in range(4):
        await cortex_client.mutable.set(
            "count-test",
            f"key-{i}",
            {"value": i},
        )
    
    # Count records
    count = await cortex_client.mutable.count(
        "count-test",
    )
    
    assert count >= 4
    
    # Cleanup
    await cleanup_helper.purge_mutable(memory_space_id, key_prefix=None)


# ============================================================================
# exists() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_exists_returns_true_for_existing(cortex_client, test_ids, cleanup_helper):
    """
    Test exists() returns True for existing record.
    
    Port of: mutable.test.ts - exists tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create record
    await cortex_client.mutable.set(
        "test-namespace",
        "exists-test",
        {"value": "exists"},
    )
    
    # Check exists
    exists = await cortex_client.mutable.exists(
        "test-namespace",
        "exists-test",
    )
    
    assert exists is True
    
    # Cleanup
    await cleanup_helper.purge_mutable(memory_space_id, key_prefix=None)


@pytest.mark.asyncio
async def test_exists_returns_false_for_nonexistent(cortex_client, test_ids):
    """
    Test exists() returns False for non-existent record.
    
    Port of: mutable.test.ts - exists tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    exists = await cortex_client.mutable.exists(
        "test-namespace",
        "does-not-exist",
    )
    
    assert exists is False


# ============================================================================
# purgeNamespace() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_purge_namespace(cortex_client, test_ids, cleanup_helper):
    """
    Test purging entire namespace.
    
    Port of: mutable.test.ts - purgeNamespace tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create multiple records in namespace
    for i in range(5):
        await cortex_client.mutable.set(
            "purge-namespace-test",
            f"key-{i}",
            {"value": i},
        )
    
    # Purge namespace
    result = await cortex_client.mutable.purge_namespace(
        "purge-namespace-test",
    )
    
    # Verify all deleted
    count = await cortex_client.mutable.count(
        "purge-namespace-test",
    )
    
    assert count == 0
    
    # Cleanup
    await cleanup_helper.purge_mutable(memory_space_id, key_prefix=None)

