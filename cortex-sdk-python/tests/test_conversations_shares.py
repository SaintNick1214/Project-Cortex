"""
Tests for Conversation Shares (Shareable Chats Phase 2)

Tests share(), revoke_share(), list_shares(), get_share(),
check_share_access(), and sharing utilities.

PARALLEL-SAFE: Uses TestRunContext for isolated test data.
"""

import pytest

from cortex import (
    ConversationParticipants,
    CreateConversationInput,
    build_share_url,
    extract_share_id,
)
from cortex.types import CreateShareInput


@pytest.mark.asyncio
async def test_share_link_with_defaults(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test creating a link share with default permissions."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-share-1"
            ),
        )
    )

    result = await cortex_client.conversations.share(
        CreateShareInput(
            conversation_id=conv.conversation_id,
            grant_type="link",
        )
    )

    assert result.share_id.startswith("share-")
    assert result.share.conversation_id == conv.conversation_id
    assert result.share.grant_type == "link"
    assert result.share.status == "active"
    # Permissions is a dict from Convex response
    perms = result.share.permissions
    assert perms["can_view"] is True or perms.can_view is True
    assert perms["can_view_facts"] is False or perms.can_view_facts is False


@pytest.mark.asyncio
async def test_share_user_with_custom_permissions(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test creating a user share with custom permissions."""
    recipient_id = f"{test_user_id}-recipient"

    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-share-2"
            ),
        )
    )

    result = await cortex_client.conversations.share(
        CreateShareInput(
            conversation_id=conv.conversation_id,
            grant_type="user",
            granted_to=recipient_id,
            permissions={
                "can_view": True,
                "can_view_facts": True,
                "can_continue": True,
                "can_fork": False,
                "can_export": True,
            },
        )
    )

    assert result.share.grant_type == "user"
    assert result.share.granted_to == recipient_id
    # Access permissions as dict (Convex response format)
    perms = result.share.permissions
    if isinstance(perms, dict):
        assert perms["can_view"] is True
        assert perms["can_view_facts"] is True
        assert perms["can_continue"] is True
        assert perms["can_fork"] is False
        assert perms["can_export"] is True
    else:
        assert perms.can_view is True
        assert perms.can_view_facts is True
        assert perms.can_continue is True
        assert perms.can_fork is False
        assert perms.can_export is True


@pytest.mark.asyncio
async def test_share_with_expiration(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test creating a share with expiration."""
    import time

    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-share-3"
            ),
        )
    )

    expires_at = int(time.time() * 1000) + 60 * 60 * 1000  # 1 hour

    result = await cortex_client.conversations.share(
        CreateShareInput(
            conversation_id=conv.conversation_id,
            grant_type="link",
            expires_at=expires_at,
        )
    )

    assert result.expires_at == expires_at
    assert result.share.expires_at == expires_at


@pytest.mark.asyncio
async def test_share_with_max_views(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test creating a share with max views limit."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-share-4"
            ),
        )
    )

    result = await cortex_client.conversations.share(
        CreateShareInput(
            conversation_id=conv.conversation_id,
            grant_type="link",
            max_views=10,
        )
    )

    assert result.share.max_views == 10
    assert result.share.view_count == 0


@pytest.mark.asyncio
async def test_revoke_share(cortex_client, test_memory_space_id, test_user_id):
    """Test revoking an active share."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-revoke-1"
            ),
        )
    )

    share_result = await cortex_client.conversations.share(
        CreateShareInput(
            conversation_id=conv.conversation_id,
            grant_type="link",
        )
    )

    revoke_result = await cortex_client.conversations.revoke_share(
        share_result.share_id
    )

    assert revoke_result.revoked is True
    assert revoke_result.revoked_at > 0
    assert revoke_result.share.status == "revoked"


@pytest.mark.asyncio
async def test_list_shares(cortex_client, test_memory_space_id, test_user_id):
    """Test listing all shares for a conversation."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-list-1"
            ),
        )
    )

    # Create multiple shares
    await cortex_client.conversations.share(
        CreateShareInput(conversation_id=conv.conversation_id, grant_type="link")
    )
    await cortex_client.conversations.share(
        CreateShareInput(conversation_id=conv.conversation_id, grant_type="link")
    )

    shares = await cortex_client.conversations.list_shares(conv.conversation_id)

    assert len(shares) >= 2
    assert all(s.conversation_id == conv.conversation_id for s in shares)


@pytest.mark.asyncio
async def test_list_shares_filter_by_status(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test filtering shares by status."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-list-2"
            ),
        )
    )

    # Create and revoke a share
    share1 = await cortex_client.conversations.share(
        CreateShareInput(conversation_id=conv.conversation_id, grant_type="link")
    )
    await cortex_client.conversations.revoke_share(share1.share_id)

    # Create an active share
    await cortex_client.conversations.share(
        CreateShareInput(conversation_id=conv.conversation_id, grant_type="link")
    )

    active_shares = await cortex_client.conversations.list_shares(
        conv.conversation_id, status="active"
    )

    assert all(s.status == "active" for s in active_shares)


@pytest.mark.asyncio
async def test_get_share(cortex_client, test_memory_space_id, test_user_id):
    """Test retrieving a share by ID."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-get-1"
            ),
        )
    )

    share_result = await cortex_client.conversations.share(
        CreateShareInput(conversation_id=conv.conversation_id, grant_type="link")
    )

    retrieved = await cortex_client.conversations.get_share(share_result.share_id)

    assert retrieved is not None
    assert retrieved.share_id == share_result.share_id
    assert retrieved.is_valid is True


@pytest.mark.asyncio
async def test_get_share_not_found(cortex_client):
    """Test retrieving a non-existent share."""
    result = await cortex_client.conversations.get_share("share-nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_check_share_access_link_share(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test checking access via link share."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-access-1"
            ),
        )
    )

    await cortex_client.conversations.share(
        CreateShareInput(
            conversation_id=conv.conversation_id,
            grant_type="link",
            permissions={"can_view": True, "can_fork": True},
        )
    )

    # Anyone should have access via link share
    access = await cortex_client.conversations.check_share_access(
        conversation_id=conv.conversation_id,
        user_id="random-user",
    )

    assert access.has_access is True
    # Permissions may be dict or dataclass
    perms = access.permissions
    if isinstance(perms, dict):
        assert perms["can_view"] is True
        assert perms["can_fork"] is True
    else:
        assert perms.can_view is True
        assert perms.can_fork is True


@pytest.mark.asyncio
async def test_check_share_access_no_shares(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test checking access when no shares exist."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-access-2"
            ),
            visibility="private",
        )
    )

    # Don't create any shares

    access = await cortex_client.conversations.check_share_access(
        conversation_id=conv.conversation_id,
        user_id="random-user",
    )

    assert access.has_access is False
    assert access.reason == "NO_MATCHING_SHARE"


# Utility function tests

def test_build_share_url_path_style():
    """Test building path-style URL."""
    url = build_share_url("share-abc123", base_url="https://myapp.com/shared")
    assert url == "https://myapp.com/shared/share-abc123"


def test_build_share_url_path_style_trailing_slash():
    """Test building path-style URL with trailing slash."""
    url = build_share_url("share-abc123", base_url="https://myapp.com/shared/")
    assert url == "https://myapp.com/shared/share-abc123"


def test_build_share_url_query_style():
    """Test building query-style URL."""
    url = build_share_url(
        "share-abc123", base_url="https://myapp.com/shared", style="query"
    )
    assert url == "https://myapp.com/shared?id=share-abc123"


def test_build_share_url_query_style_custom_param():
    """Test building query-style URL with custom param."""
    url = build_share_url(
        "share-abc123",
        base_url="https://myapp.com/view",
        style="query",
        param_name="share",
    )
    assert url == "https://myapp.com/view?share=share-abc123"


def test_extract_share_id_path_style():
    """Test extracting ID from path-style URL."""
    share_id = extract_share_id("https://myapp.com/shared/share-abc123")
    assert share_id == "share-abc123"


def test_extract_share_id_query_style():
    """Test extracting ID from query-style URL."""
    share_id = extract_share_id(
        "https://myapp.com/shared?id=share-abc123", style="query"
    )
    assert share_id == "share-abc123"


def test_extract_share_id_custom_param():
    """Test extracting ID with custom param name."""
    share_id = extract_share_id(
        "https://myapp.com/view?share=share-abc123",
        style="query",
        param_name="share",
    )
    assert share_id == "share-abc123"


def test_extract_share_id_invalid_url():
    """Test extracting ID from invalid URL."""
    share_id = extract_share_id("not-a-url")
    assert share_id is None
