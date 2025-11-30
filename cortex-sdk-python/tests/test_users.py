"""
Tests for Users API with GDPR cascade deletion
"""

import pytest

from cortex import DeleteUserOptions
from cortex.users.validators import UserValidationError

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Client-Side Validation Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestUserValidation:
    """Test client-side validation for Users API."""

    @pytest.mark.asyncio
    async def test_get_empty_user_id(self, cortex_client):
        """Should throw on empty user_id."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.get("")

        error = exc_info.value
        assert error.code == "INVALID_USER_ID_FORMAT"
        assert "user_id cannot be empty" in str(error)

    @pytest.mark.asyncio
    async def test_get_none_user_id(self, cortex_client):
        """Should throw on None user_id."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.get(None)

        error = exc_info.value
        assert error.code == "MISSING_USER_ID"

    @pytest.mark.asyncio
    async def test_get_whitespace_user_id(self, cortex_client):
        """Should throw on whitespace-only user_id."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.get("   ")

        assert "user_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_empty_user_id(self, cortex_client):
        """Should throw on empty user_id in update."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.update("", {"name": "Test"})

        assert "user_id cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_none_data(self, cortex_client):
        """Should throw on None data."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.update("user-123", None)

        assert "data is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_list_data(self, cortex_client):
        """Should throw on list data (should be dict)."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.update("user-123", [])

        assert "data must be a dict" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_invalid_limit_zero(self, cortex_client):
        """Should throw on limit = 0."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.list(limit=0)

        assert "limit must be between 1 and 1000" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_invalid_limit_negative(self, cortex_client):
        """Should throw on negative limit."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.list(limit=-5)

        assert "limit must be between 1 and 1000" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_invalid_limit_too_large(self, cortex_client):
        """Should throw on limit > 1000."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.list(limit=1001)

        assert "limit must be between 1 and 1000" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_list_negative_offset(self, cortex_client):
        """Should throw on negative offset."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.list(offset=-1)

        assert "offset must be >= 0" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_version_invalid_version_zero(self, cortex_client):
        """Should throw on version = 0."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.get_version("user-123", 0)

        assert "version must be >= 1" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_version_negative_version(self, cortex_client):
        """Should throw on negative version."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.get_version("user-123", -1)

        assert "version must be >= 1" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_version_float_version(self, cortex_client):
        """Should throw on non-integer version."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.get_version("user-123", 1.5)

        assert "version must be a whole number" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_at_timestamp_negative(self, cortex_client):
        """Should throw on negative timestamp."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.get_at_timestamp("user-123", -1000)

        assert "timestamp must be >= 0" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_export_invalid_format(self, cortex_client):
        """Should throw on invalid export format."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.export(format="xml")

        error = exc_info.value
        assert 'Invalid export format "xml"' in str(error)
        assert error.code == "INVALID_EXPORT_FORMAT"

    @pytest.mark.asyncio
    async def test_update_many_empty_array(self, cortex_client):
        """Should throw on empty user_ids array."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.update_many([], {"name": "Test"})

        assert "user_ids array cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_many_too_large(self, cortex_client):
        """Should throw on > 100 user_ids."""
        too_many = [f"user-{i}" for i in range(101)]

        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.update_many(too_many, {"name": "Test"})

        assert "user_ids array cannot exceed 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_many_duplicates(self, cortex_client):
        """Should throw on duplicate user_ids."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.update_many(
                ["user-1", "user-1"], {"name": "Test"}
            )

        assert "Duplicate" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_many_empty_array(self, cortex_client):
        """Should throw on empty user_ids array."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.delete_many([])

        assert "user_ids array cannot be empty" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_many_too_large(self, cortex_client):
        """Should throw on > 100 user_ids."""
        too_many = [f"user-{i}" for i in range(101)]

        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.delete_many(too_many)

        assert "user_ids array cannot exceed 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_validation_error_has_code(self, cortex_client):
        """Validation errors should include error code."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.get("")

        error = exc_info.value
        assert hasattr(error, "code")
        assert hasattr(error, "field")
        assert error.code == "INVALID_USER_ID_FORMAT"
        assert error.field == "user_id"

    @pytest.mark.asyncio
    async def test_get_or_create_invalid_defaults(self, cortex_client):
        """Should throw on invalid defaults type."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.get_or_create("user-123", [])

        assert "defaults must be a dict" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_merge_none_updates(self, cortex_client):
        """Should throw on None updates."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.merge("user-123", None)

        assert "updates is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_merge_list_updates(self, cortex_client):
        """Should throw on list updates (should be dict)."""
        with pytest.raises(UserValidationError) as exc_info:
            await cortex_client.users.merge("user-123", [])

        assert "updates must be a dict" in str(exc_info.value)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Existing E2E Tests - Backend Behavior and Integration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTE: Tests below validate BACKEND behavior and E2E functionality
# Client-side validation tests are in TestUserValidation class above


@pytest.mark.asyncio
async def test_create_user_profile(cortex_client, test_user_id):
    """Test creating a user profile."""
    user = await cortex_client.users.update(
        test_user_id,
        {
            "displayName": "Test User",
            "email": "test@example.com",
            "preferences": {"theme": "dark"},
        },
    )

    assert user.id == test_user_id
    assert user.data["displayName"] == "Test User"
    assert user.version == 1


@pytest.mark.asyncio
async def test_get_user_profile(cortex_client, test_user_id):
    """Test retrieving a user profile."""
    # Create user
    await cortex_client.users.update(test_user_id, {"displayName": "Test User"})

    # Get it back
    user = await cortex_client.users.get(test_user_id)

    assert user is not None
    assert user.id == test_user_id


@pytest.mark.asyncio
async def test_update_user_profile(cortex_client, test_user_id):
    """Test updating a user profile (creates new version)."""
    # Create user
    await cortex_client.users.update(test_user_id, {"displayName": "Original"})

    # Update user
    updated = await cortex_client.users.update(
        test_user_id, {"displayName": "Updated", "email": "new@example.com"}
    )

    assert updated.version == 2
    assert updated.data["displayName"] == "Updated"


@pytest.mark.asyncio
async def test_user_exists(cortex_client, test_user_id):
    """Test checking if user exists."""
    # Should not exist initially
    assert not await cortex_client.users.exists(test_user_id)

    # Create user
    await cortex_client.users.update(test_user_id, {"displayName": "Test"})

    # Should exist now
    assert await cortex_client.users.exists(test_user_id)


@pytest.mark.asyncio
async def test_get_or_create_user(cortex_client, test_user_id):
    """Test get or create user."""
    # First call creates
    user1 = await cortex_client.users.get_or_create(
        test_user_id, {"displayName": "Default User", "tier": "free"}
    )

    assert user1.id == test_user_id
    assert user1.version == 1

    # Second call gets existing
    user2 = await cortex_client.users.get_or_create(test_user_id)

    assert user2.id == test_user_id
    assert user2.version == 1  # Same version


@pytest.mark.asyncio
async def test_merge_user_profile(cortex_client, test_user_id):
    """Test merging updates into user profile."""
    # Create user
    await cortex_client.users.update(
        test_user_id, {"displayName": "User", "preferences": {"theme": "dark"}}
    )

    # Merge update
    merged = await cortex_client.users.merge(
        test_user_id, {"preferences": {"notifications": True}}
    )

    assert merged.data["displayName"] == "User"  # Preserved
    assert merged.data["preferences"]["theme"] == "dark"  # Preserved
    assert merged.data["preferences"]["notifications"] is True  # Added


@pytest.mark.asyncio
async def test_delete_user_simple(cortex_client, test_user_id):
    """Test simple user deletion (no cascade)."""
    # Create user
    await cortex_client.users.update(test_user_id, {"displayName": "To Delete"})

    # Delete (no cascade)
    result = await cortex_client.users.delete(test_user_id)

    assert result.total_deleted == 1
    assert "user-profile" in result.deleted_layers

    # Verify deletion
    user = await cortex_client.users.get(test_user_id)
    assert user is None


@pytest.mark.asyncio
async def test_delete_user_cascade_dry_run(cortex_client, test_user_id):
    """Test GDPR cascade deletion dry run."""
    # Create user with some data
    await cortex_client.users.update(test_user_id, {"displayName": "Test User"})

    # Dry run cascade deletion
    result = await cortex_client.users.delete(
        test_user_id, DeleteUserOptions(cascade=True, dry_run=True)
    )

    # User should still exist after dry run
    user = await cortex_client.users.get(test_user_id)
    assert user is not None


@pytest.mark.asyncio
async def test_count_users(cortex_client):
    """Test counting users."""
    # Count all users
    total = await cortex_client.users.count()

    assert isinstance(total, int)
    assert total >= 0


# ============================================================================
# Additional Tests - Expanding Coverage
# ============================================================================


@pytest.mark.asyncio
async def test_delete_user_full_cascade(cortex_client, test_user_id, test_memory_space_id, test_conversation_id, cleanup_helper):
    """
    Test full GDPR cascade deletion across all layers.
    
    Port of: users.test.ts - full cascade tests
    """
    # Create user
    await cortex_client.users.update(test_user_id, {"displayName": "Cascade Test"})

    # Create user data across layers
    from cortex import RememberParams
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="User message",
            agent_response="Agent response",
            user_id=test_user_id,
            user_name="Tester",
        )
    )

    # Delete with cascade
    result = await cortex_client.users.delete(
        test_user_id,
        DeleteUserOptions(cascade=True, verify=True),
    )

    # Should have deleted from multiple layers
    assert result.total_deleted > 0
    assert "user-profile" in result.deleted_layers

    # Verify user is gone
    user = await cortex_client.users.get(test_user_id)
    assert user is None

    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_search_users(cortex_client, test_user_id, cleanup_helper):
    """
    Test searching users (client-side implementation).
    
    Port of: users.test.ts - search tests
    """
    # Create users with searchable data
    await cortex_client.users.update(
        test_user_id,
        {"displayName": "John Smith", "email": "john@example.com"},
    )

    # Search returns all users (client-side uses immutable.list)
    results = await cortex_client.users.search(limit=100)

    # Should find the user in results
    assert len(results) > 0
    found = any(r.id == test_user_id for r in results)
    assert found

    # Cleanup
    await cortex_client.users.delete(test_user_id)


@pytest.mark.asyncio
async def test_list_users(cortex_client, cleanup_helper):
    """
    Test listing users with pagination.
    
    Port of: users.test.ts - list tests
    """
    # List users
    result = await cortex_client.users.list(limit=10)

    # Should return users
    users = result.get("users", [])
    assert isinstance(users, list)

    # No cleanup needed - just listing


@pytest.mark.asyncio
async def test_update_many_users(cortex_client, cleanup_helper):
    """
    Test bulk updating users (client-side implementation).
    
    Port of: users.test.ts - updateMany tests
    """
    from tests.helpers import generate_test_user_id

    # Create test users
    user_ids = [generate_test_user_id() for _ in range(3)]

    for uid in user_ids:
        await cortex_client.users.update(uid, {"status": "active"})

    # Update many (client-side)
    result = await cortex_client.users.update_many(
        user_ids,
        {"status": "inactive"},
    )

    # Verify updated
    assert result["updated"] == 3
    assert len(result["user_ids"]) == 3

    # Cleanup
    for uid in user_ids:
        await cortex_client.users.delete(uid)


@pytest.mark.asyncio
async def test_delete_many_users(cortex_client, cleanup_helper):
    """
    Test bulk deleting users (client-side implementation).
    
    Port of: users.test.ts - deleteMany tests
    """
    from tests.helpers import generate_test_user_id

    # Create test users
    user_ids = [generate_test_user_id() for _ in range(3)]

    for uid in user_ids:
        await cortex_client.users.update(uid, {"displayName": f"User {uid}"})

    # Delete many (client-side)
    result = await cortex_client.users.delete_many(user_ids)

    # Verify result
    assert result["deleted"] == 3
    assert len(result["user_ids"]) == 3

    # Verify all deleted
    for uid in user_ids:
        user = await cortex_client.users.get(uid)
        assert user is None


@pytest.mark.asyncio
async def test_export_users(cortex_client, test_user_id, cleanup_helper):
    """
    Test exporting user data (client-side implementation).
    
    Port of: users.test.ts - export tests
    """
    # Create user
    await cortex_client.users.update(
        test_user_id,
        {"displayName": "Export Test", "email": "export@test.com"},
    )

    # Export as JSON (client-side using list())
    result = await cortex_client.users.export(format="json")

    # Should return export data containing our user
    assert result is not None
    assert test_user_id in result

    # Cleanup
    await cortex_client.users.delete(test_user_id)


@pytest.mark.asyncio
async def test_get_version_history(cortex_client, test_user_id, cleanup_helper):
    """
    Test getting user version history.
    
    Port of: users.test.ts - versioning tests
    """
    # Create user
    await cortex_client.users.update(test_user_id, {"displayName": "Version 1"})
    await cortex_client.users.update(test_user_id, {"displayName": "Version 2"})
    await cortex_client.users.update(test_user_id, {"displayName": "Version 3"})

    # Get history
    history = await cortex_client.users.get_history(test_user_id)

    # Should have 3 versions
    assert len(history) >= 3

    # Cleanup
    await cortex_client.users.delete(test_user_id)


@pytest.mark.asyncio
async def test_get_at_timestamp(cortex_client, test_user_id, cleanup_helper):
    """
    Test getting user state at specific timestamp.
    
    Port of: users.test.ts - temporal query tests
    """
    import time

    # Create user
    await cortex_client.users.update(test_user_id, {"status": "online"})

    timestamp = int(time.time() * 1000)

    # Update user
    await cortex_client.users.update(test_user_id, {"status": "offline"})

    # Get state at timestamp (should be "online")
    historical = await cortex_client.users.get_at_timestamp(test_user_id, timestamp)

    # Should return historical state
    assert historical is not None

    # Cleanup
    await cortex_client.users.delete(test_user_id)

