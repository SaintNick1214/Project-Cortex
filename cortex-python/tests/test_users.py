"""
Tests for Users API with GDPR cascade deletion
"""

import pytest

from cortex import DeleteUserOptions


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

