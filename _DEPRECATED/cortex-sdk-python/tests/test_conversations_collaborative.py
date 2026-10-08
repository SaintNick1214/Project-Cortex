"""
Tests for Collaborative Conversations (Shareable Chats Phase 4)

Tests collaborative conversation creation, message approval workflow,
approve_message(), and reject_message().

PARALLEL-SAFE: Uses TestRunContext for isolated test data.
"""

import pytest

from cortex import (
    Cortex,
    CortexConfig,
    AuthContext,
    ConversationParticipants,
    CreateConversationInput,
)
from cortex.types import ApproveMessageInput, AddMessageInput, CollaborativeSettings

# We need a client with auth context for approval tests
# The auth context's user_id will be used as the approverId
AUTH_USER_ID = "collab-test-auth-user"


@pytest.fixture(scope="function")
async def cortex_client_with_auth(test_config):
    """Cortex client fixture with auth context for collaborative tests."""
    convex_url = test_config["convex_url"]
    auth = AuthContext(user_id=AUTH_USER_ID)
    client = Cortex(CortexConfig(convex_url=convex_url, auth=auth))
    yield client
    try:
        await client.close()
    except Exception:
        pass


@pytest.mark.asyncio
async def test_create_collaborative_conversation(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test creating a collaborative conversation with requireApproval."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-collab-1"
            ),
            collaborative_settings=CollaborativeSettings(
                require_approval=True,
                owner_user_id=test_user_id,
            ),
        )
    )

    assert conv.collaborative_settings is not None
    # Handle both dict and dataclass responses
    if isinstance(conv.collaborative_settings, dict):
        assert conv.collaborative_settings["require_approval"] is True
        assert conv.collaborative_settings["owner_user_id"] == test_user_id
    else:
        assert conv.collaborative_settings.require_approval is True
        assert conv.collaborative_settings.owner_user_id == test_user_id


@pytest.mark.asyncio
async def test_owner_message_auto_approved(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test that owner's message is auto-approved."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-collab-2"
            ),
            collaborative_settings=CollaborativeSettings(
                require_approval=True,
                owner_user_id=test_user_id,
            ),
        )
    )

    # Add message as owner
    updated = await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="user",
            content="Owner message",
            participant_id=test_user_id,
        )
    )

    message = updated.messages[-1]
    if isinstance(message, dict):
        assert message.get("approval_status") == "approved"
    else:
        assert message.approval_status == "approved"


@pytest.mark.asyncio
async def test_non_owner_message_pending(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test that non-owner's message requires approval."""
    participant_id = f"{test_user_id}-participant"

    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_ids=[test_user_id, participant_id],
                agent_id="test-agent-collab-3",
            ),
            collaborative_settings=CollaborativeSettings(
                require_approval=True,
                owner_user_id=test_user_id,
            ),
        )
    )

    # Add message as non-owner
    updated = await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="user",
            content="Participant message",
            participant_id=participant_id,
        )
    )

    message = updated.messages[-1]
    if isinstance(message, dict):
        assert message.get("approval_status") == "pending"
    else:
        assert message.approval_status == "pending"


@pytest.mark.asyncio
async def test_approved_participant_auto_approved(
    cortex_client, test_memory_space_id, test_user_id
):
    """Test that pre-approved participant's message is auto-approved."""
    approved_id = f"{test_user_id}-approved"

    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_ids=[test_user_id, approved_id],
                agent_id="test-agent-collab-4",
            ),
            collaborative_settings=CollaborativeSettings(
                require_approval=True,
                owner_user_id=test_user_id,
                approved_participants=[approved_id],
            ),
        )
    )

    # Add message as pre-approved participant
    updated = await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="user",
            content="Pre-approved participant message",
            participant_id=approved_id,
        )
    )

    message = updated.messages[-1]
    if isinstance(message, dict):
        assert message.get("approval_status") == "approved"
    else:
        assert message.approval_status == "approved"


@pytest.mark.asyncio
async def test_approve_message(cortex_client_with_auth, test_memory_space_id):
    """Test approving a pending message."""
    # Use AUTH_USER_ID as owner since it matches the client's auth context
    owner_id = AUTH_USER_ID
    participant_id = f"{owner_id}-to-approve"

    conv = await cortex_client_with_auth.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_ids=[owner_id, participant_id],
                agent_id="test-agent-collab-5",
            ),
            collaborative_settings=CollaborativeSettings(
                require_approval=True,
                owner_user_id=owner_id,
            ),
        )
    )

    # Add pending message
    updated = await cortex_client_with_auth.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="user",
            content="Message to approve",
            participant_id=participant_id,
        )
    )

    pending_msg = updated.messages[-1]
    msg_id = pending_msg.id if hasattr(pending_msg, 'id') else pending_msg["id"]

    # Approve it
    approved = await cortex_client_with_auth.conversations.approve_message(
        ApproveMessageInput(
            conversation_id=conv.conversation_id,
            message_id=msg_id,
        )
    )

    # Find the message
    for msg in approved.messages:
        m_id = msg.id if hasattr(msg, 'id') else msg["id"]
        if m_id == msg_id:
            status = msg.approval_status if hasattr(msg, 'approval_status') else msg.get("approval_status")
            assert status == "approved"
            break


@pytest.mark.asyncio
async def test_reject_message(cortex_client_with_auth, test_memory_space_id):
    """Test rejecting a pending message."""
    # Use AUTH_USER_ID as owner since it matches the client's auth context
    owner_id = AUTH_USER_ID
    participant_id = f"{owner_id}-to-reject"

    conv = await cortex_client_with_auth.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_ids=[owner_id, participant_id],
                agent_id="test-agent-collab-6",
            ),
            collaborative_settings=CollaborativeSettings(
                require_approval=True,
                owner_user_id=owner_id,
            ),
        )
    )

    # Add pending message
    updated = await cortex_client_with_auth.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="user",
            content="Message to reject",
            participant_id=participant_id,
        )
    )

    pending_msg = updated.messages[-1]
    msg_id = pending_msg.id if hasattr(pending_msg, 'id') else pending_msg["id"]

    # Reject it
    rejected = await cortex_client_with_auth.conversations.reject_message(
        ApproveMessageInput(
            conversation_id=conv.conversation_id,
            message_id=msg_id,
        )
    )

    # Find the message
    for msg in rejected.messages:
        m_id = msg.id if hasattr(msg, 'id') else msg["id"]
        if m_id == msg_id:
            status = msg.approval_status if hasattr(msg, 'approval_status') else msg.get("approval_status")
            assert status == "rejected"
            break


@pytest.mark.asyncio
async def test_no_approval_required(cortex_client, test_memory_space_id, test_user_id):
    """Test messages have no approvalStatus when approval not required."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-collab-7"
            ),
            collaborative_settings=CollaborativeSettings(
                require_approval=False,
            ),
        )
    )

    updated = await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="user",
            content="No approval needed",
            participant_id=test_user_id,
        )
    )

    message = updated.messages[-1]
    if isinstance(message, dict):
        assert message.get("approval_status") is None
    else:
        assert message.approval_status is None


@pytest.mark.asyncio
async def test_backward_compatibility(cortex_client, test_memory_space_id, test_user_id):
    """Test conversation without collaborativeSettings works normally."""
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-collab-8"
            ),
            # No collaborative_settings
        )
    )

    assert conv.collaborative_settings is None

    updated = await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="user",
            content="Normal message",
        )
    )

    message = updated.messages[-1]
    if isinstance(message, dict):
        assert message.get("approval_status") is None
    else:
        assert message.approval_status is None
