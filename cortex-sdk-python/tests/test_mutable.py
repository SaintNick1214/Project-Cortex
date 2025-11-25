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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Client-Side Validation Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# These tests validate CLIENT-SIDE validation (synchronous errors)
# Backend validation tests are in the functional test sections above
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# ============================================================================
# set() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_set_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.set("", "key", "value")

    assert exc_info.value.code == "MISSING_NAMESPACE"
    assert "namespace is required" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_validation_whitespace_namespace(cortex_client):
    """Should throw on whitespace-only namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.set("   ", "key", "value")

    assert exc_info.value.code == "MISSING_NAMESPACE"
    assert "namespace is required" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_validation_invalid_namespace_format_spaces(cortex_client):
    """Should throw on invalid namespace format (spaces)."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.set("name with spaces", "key", "value")

    assert exc_info.value.code == "INVALID_NAMESPACE"
    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_validation_invalid_namespace_format_emoji(cortex_client):
    """Should throw on invalid namespace format (emoji)."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.set("namespace-😀", "key", "value")

    assert exc_info.value.code == "INVALID_NAMESPACE"
    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_validation_namespace_too_long(cortex_client):
    """Should throw on namespace too long."""
    from cortex.mutable import MutableValidationError

    long_namespace = "a" * 101  # Max is 100

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.set(long_namespace, "key", "value")

    assert exc_info.value.code == "NAMESPACE_TOO_LONG"
    assert "exceeds maximum length" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_validation_missing_key(cortex_client):
    """Should throw on missing key."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.set("namespace", "", "value")

    assert exc_info.value.code == "MISSING_KEY"
    assert "key is required" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_validation_invalid_key_format(cortex_client):
    """Should throw on invalid key format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.set("namespace", "key with spaces", "value")

    assert exc_info.value.code == "INVALID_KEY"
    assert "Invalid key format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_validation_key_too_long(cortex_client):
    """Should throw on key too long."""
    from cortex.mutable import MutableValidationError

    long_key = "a" * 256  # Max is 255

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.set("namespace", long_key, "value")

    assert exc_info.value.code == "KEY_TOO_LONG"
    assert "exceeds maximum length" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_validation_value_too_large(cortex_client):
    """Should throw on value too large."""
    from cortex.mutable import MutableValidationError

    large_value = {"data": "x" * (2 * 1024 * 1024)}  # 2MB

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.set("namespace", "key", large_value)

    assert exc_info.value.code == "VALUE_TOO_LARGE"
    assert "exceeds maximum size" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_validation_invalid_user_id(cortex_client):
    """Should throw on invalid user_id format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.set("namespace", "key", "value", user_id="")

    assert exc_info.value.code == "INVALID_USER_ID"
    assert "user_id cannot be empty" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_validation_accepts_valid_inputs(cortex_client, cleanup_helper, test_ids):
    """Should accept valid inputs."""
    result = await cortex_client.mutable.set(
        "validation-test", "valid-key", "valid-value"
    )
    assert result.value == "valid-value"
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


@pytest.mark.asyncio
async def test_set_validation_accepts_complex_values(cortex_client, cleanup_helper, test_ids):
    """Should accept complex dict values."""
    complex_value = {"nested": {"data": [1, 2, 3]}}
    result = await cortex_client.mutable.set(
        "validation-test", "complex", complex_value
    )
    assert result.value == complex_value
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


# ============================================================================
# get() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.get("", "key")

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_get_validation_invalid_namespace_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.get("name with spaces", "key")

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_validation_missing_key(cortex_client):
    """Should throw on missing key."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.get("namespace", "")

    assert exc_info.value.code == "MISSING_KEY"


@pytest.mark.asyncio
async def test_get_validation_invalid_key_format(cortex_client):
    """Should throw on invalid key format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.get("namespace", "key with spaces")

    assert "Invalid key format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_validation_accepts_valid_inputs(cortex_client, cleanup_helper, test_ids):
    """Should accept valid inputs."""
    await cortex_client.mutable.set("validation-test", "get-test", "value")
    value = await cortex_client.mutable.get("validation-test", "get-test")
    assert value is not None
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


# ============================================================================
# get_record() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_record_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.get_record("", "key")

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_get_record_validation_invalid_namespace_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.get_record("name with spaces", "key")

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_record_validation_missing_key(cortex_client):
    """Should throw on missing key."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.get_record("namespace", "")

    assert exc_info.value.code == "MISSING_KEY"


@pytest.mark.asyncio
async def test_get_record_validation_invalid_key_format(cortex_client):
    """Should throw on invalid key format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.get_record("namespace", "key with spaces")

    assert "Invalid key format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_record_validation_accepts_valid_inputs(cortex_client, cleanup_helper, test_ids):
    """Should accept valid inputs."""
    await cortex_client.mutable.set("validation-test", "record-test", "value")
    record = await cortex_client.mutable.get_record("validation-test", "record-test")
    assert record is not None
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


# ============================================================================
# update() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_update_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.update("", "key", lambda v: v)

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_update_validation_invalid_namespace_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.update("name with spaces", "key", lambda v: v)

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_validation_missing_key(cortex_client):
    """Should throw on missing key."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.update("namespace", "", lambda v: v)

    assert exc_info.value.code == "MISSING_KEY"


@pytest.mark.asyncio
async def test_update_validation_invalid_key_format(cortex_client):
    """Should throw on invalid key format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.update("namespace", "key with spaces", lambda v: v)

    assert "Invalid key format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_validation_missing_updater(cortex_client):
    """Should throw on missing updater."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.update("namespace", "key", None)

    assert exc_info.value.code == "INVALID_UPDATER_TYPE"
    assert "Updater function is required" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_validation_non_callable_updater(cortex_client):
    """Should throw on non-callable updater."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.update("namespace", "key", "not a function")

    assert exc_info.value.code == "INVALID_UPDATER_TYPE"
    assert "must be a callable function" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_validation_accepts_valid_updater(cortex_client, cleanup_helper, test_ids):
    """Should accept valid callable updater."""
    await cortex_client.mutable.set("validation-test", "update-test", 100)
    result = await cortex_client.mutable.update(
        "validation-test", "update-test", lambda v: v + 1
    )
    assert result.value == 101
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


# ============================================================================
# increment() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_increment_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.increment("", "key", 1)

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_increment_validation_invalid_namespace_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.increment("name with spaces", "key", 1)

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_increment_validation_missing_key(cortex_client):
    """Should throw on missing key."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.increment("namespace", "", 1)

    assert exc_info.value.code == "MISSING_KEY"


@pytest.mark.asyncio
async def test_increment_validation_invalid_key_format(cortex_client):
    """Should throw on invalid key format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.increment("namespace", "key with spaces", 1)

    assert "Invalid key format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_increment_validation_non_numeric_amount(cortex_client):
    """Should throw on non-numeric amount."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.increment("namespace", "key", "not a number")

    assert exc_info.value.code == "INVALID_AMOUNT_TYPE"
    assert "amount must be a number" in str(exc_info.value)


@pytest.mark.asyncio
async def test_increment_validation_accepts_valid_amount(cortex_client, cleanup_helper, test_ids):
    """Should accept valid amount."""
    await cortex_client.mutable.set("validation-test", "inc-test", 0)
    result = await cortex_client.mutable.increment("validation-test", "inc-test", 5)
    assert result.value >= 5
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


@pytest.mark.asyncio
async def test_increment_validation_accepts_default_amount(cortex_client, cleanup_helper, test_ids):
    """Should accept default amount."""
    await cortex_client.mutable.set("validation-test", "inc-default", 0)
    result = await cortex_client.mutable.increment("validation-test", "inc-default")
    assert result.value == 1
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


# ============================================================================
# decrement() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_decrement_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.decrement("", "key", 1)

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_decrement_validation_invalid_namespace_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.decrement("name with spaces", "key", 1)

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_decrement_validation_missing_key(cortex_client):
    """Should throw on missing key."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.decrement("namespace", "", 1)

    assert exc_info.value.code == "MISSING_KEY"


@pytest.mark.asyncio
async def test_decrement_validation_invalid_key_format(cortex_client):
    """Should throw on invalid key format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.decrement("namespace", "key with spaces", 1)

    assert "Invalid key format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_decrement_validation_non_numeric_amount(cortex_client):
    """Should throw on non-numeric amount."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.decrement("namespace", "key", "not a number")

    assert exc_info.value.code == "INVALID_AMOUNT_TYPE"
    assert "amount must be a number" in str(exc_info.value)


@pytest.mark.asyncio
async def test_decrement_validation_accepts_valid_amount(cortex_client, cleanup_helper, test_ids):
    """Should accept valid amount."""
    await cortex_client.mutable.set("validation-test", "dec-test", 100)
    result = await cortex_client.mutable.decrement("validation-test", "dec-test", 5)
    assert result.value <= 95
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


@pytest.mark.asyncio
async def test_decrement_validation_accepts_default_amount(cortex_client, cleanup_helper, test_ids):
    """Should accept default amount."""
    await cortex_client.mutable.set("validation-test", "dec-default", 10)
    result = await cortex_client.mutable.decrement("validation-test", "dec-default")
    assert result.value == 9
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


# ============================================================================
# exists() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_exists_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.exists("", "key")

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_exists_validation_invalid_namespace_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.exists("name with spaces", "key")

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_exists_validation_missing_key(cortex_client):
    """Should throw on missing key."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.exists("namespace", "")

    assert exc_info.value.code == "MISSING_KEY"


@pytest.mark.asyncio
async def test_exists_validation_invalid_key_format(cortex_client):
    """Should throw on invalid key format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.exists("namespace", "key with spaces")

    assert "Invalid key format" in str(exc_info.value)


# ============================================================================
# delete() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_delete_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.delete("", "key")

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_delete_validation_invalid_namespace_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.delete("name with spaces", "key")

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_delete_validation_missing_key(cortex_client):
    """Should throw on missing key."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.delete("namespace", "")

    assert exc_info.value.code == "MISSING_KEY"


@pytest.mark.asyncio
async def test_delete_validation_invalid_key_format(cortex_client):
    """Should throw on invalid key format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.delete("namespace", "key with spaces")

    assert "Invalid key format" in str(exc_info.value)


# ============================================================================
# list() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.list("")

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_list_validation_invalid_namespace_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.list("name with spaces")

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_validation_invalid_key_prefix_format(cortex_client):
    """Should throw on invalid key_prefix format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.list("test", key_prefix="prefix with spaces")

    assert "Invalid key_prefix format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_validation_invalid_user_id_format(cortex_client):
    """Should throw on invalid user_id format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.list("test", user_id="")

    assert "user_id cannot be empty" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_validation_non_integer_limit(cortex_client):
    """Should throw on non-integer limit."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.list("test", limit="10")

    assert exc_info.value.code == "INVALID_LIMIT_TYPE"
    assert "limit must be an integer" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_validation_negative_limit(cortex_client):
    """Should throw on negative limit."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.list("test", limit=-1)

    assert exc_info.value.code == "INVALID_LIMIT_RANGE"
    assert "limit must be non-negative" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_validation_limit_exceeds_max(cortex_client):
    """Should throw on limit > 1000."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.list("test", limit=1001)

    assert exc_info.value.code == "INVALID_LIMIT_RANGE"
    assert "limit exceeds maximum" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_validation_accepts_valid_namespace_only(cortex_client):
    """Should accept valid namespace only."""
    result = await cortex_client.mutable.list("validation-test")
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_list_validation_accepts_all_optional_params(cortex_client):
    """Should accept all optional parameters."""
    result = await cortex_client.mutable.list(
        "validation-test", key_prefix="test-", limit=10
    )
    assert isinstance(result, list)


# ============================================================================
# count() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_count_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.count("")

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_count_validation_invalid_namespace_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.count("name with spaces")

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_count_validation_invalid_key_prefix_format(cortex_client):
    """Should throw on invalid key_prefix format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.count("test", key_prefix="prefix with spaces")

    assert "Invalid key_prefix format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_count_validation_invalid_user_id_format(cortex_client):
    """Should throw on invalid user_id format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.count("test", user_id="")

    assert "user_id cannot be empty" in str(exc_info.value)


@pytest.mark.asyncio
async def test_count_validation_accepts_valid_namespace_only(cortex_client):
    """Should accept valid namespace only."""
    result = await cortex_client.mutable.count("validation-test")
    assert isinstance(result, int)


@pytest.mark.asyncio
async def test_count_validation_accepts_with_key_prefix(cortex_client):
    """Should accept with key_prefix."""
    result = await cortex_client.mutable.count("validation-test", key_prefix="test-")
    assert isinstance(result, int)


@pytest.mark.asyncio
async def test_count_validation_accepts_with_user_id(cortex_client):
    """Should accept with user_id."""
    result = await cortex_client.mutable.count("validation-test", user_id="user-123")
    assert isinstance(result, int)


@pytest.mark.asyncio
async def test_count_validation_accepts_all_params(cortex_client):
    """Should accept all parameters."""
    result = await cortex_client.mutable.count(
        "validation-test", key_prefix="test-", user_id="user-123"
    )
    assert isinstance(result, int)


# ============================================================================
# purge_namespace() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_purge_namespace_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.purge_namespace("")

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_purge_namespace_validation_whitespace_namespace(cortex_client):
    """Should throw on whitespace-only namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.purge_namespace("   ")

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_purge_namespace_validation_invalid_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.purge_namespace("name with spaces")

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_purge_namespace_validation_accepts_valid(cortex_client, cleanup_helper, test_ids):
    """Should accept valid namespace."""
    await cortex_client.mutable.set("purge-ns-valid", "key", "value")
    result = await cortex_client.mutable.purge_namespace("purge-ns-valid")
    assert result is not None
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


# ============================================================================
# purge_many() Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_purge_many_validation_missing_namespace(cortex_client):
    """Should throw on missing namespace."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.purge_many("")

    assert exc_info.value.code == "MISSING_NAMESPACE"


@pytest.mark.asyncio
async def test_purge_many_validation_invalid_namespace_format(cortex_client):
    """Should throw on invalid namespace format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.purge_many("name with spaces")

    assert "Invalid namespace format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_purge_many_validation_invalid_key_prefix_format(cortex_client):
    """Should throw on invalid key_prefix format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.purge_many("test", key_prefix="prefix with spaces")

    assert "Invalid key_prefix format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_purge_many_validation_invalid_user_id_format(cortex_client):
    """Should throw on invalid user_id format."""
    from cortex.mutable import MutableValidationError

    with pytest.raises(MutableValidationError) as exc_info:
        await cortex_client.mutable.purge_many("test", user_id="")

    assert "user_id cannot be empty" in str(exc_info.value)


@pytest.mark.asyncio
async def test_purge_many_validation_accepts_namespace_only(cortex_client, cleanup_helper, test_ids):
    """Should accept namespace only."""
    await cortex_client.mutable.set("purge-many-valid", "key", "value")
    result = await cortex_client.mutable.purge_many("purge-many-valid")
    assert result is not None
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


@pytest.mark.asyncio
async def test_purge_many_validation_accepts_with_key_prefix(cortex_client, cleanup_helper, test_ids):
    """Should accept with key_prefix."""
    await cortex_client.mutable.set("purge-many-prefix", "prefix-1", "value")
    result = await cortex_client.mutable.purge_many(
        "purge-many-prefix", key_prefix="prefix-"
    )
    assert result is not None
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])


@pytest.mark.asyncio
async def test_purge_many_validation_accepts_all_params(cortex_client, cleanup_helper, test_ids):
    """Should accept all parameters."""
    await cortex_client.mutable.set("purge-many-all", "key", "value")
    result = await cortex_client.mutable.purge_many(
        "purge-many-all", key_prefix="key", user_id="user-123"
    )
    assert result is not None
    await cleanup_helper.purge_mutable(test_ids["memory_space_id"])

