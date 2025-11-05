"""
Tests for Conversations API (Layer 1a)
"""

import pytest

from cortex import CreateConversationInput, AddMessageInput, ConversationParticipants


@pytest.mark.asyncio
async def test_create_conversation(cortex_client, test_memory_space_id, test_user_id):
    """Test creating a conversation."""
    conversation = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, participant_id="test-bot"
            ),
        )
    )

    assert conversation is not None
    assert conversation.type == "user-agent"
    assert conversation.message_count == 0


@pytest.mark.asyncio
async def test_add_message(cortex_client, test_memory_space_id, test_conversation_id, test_user_id):
    """Test adding a message to conversation."""
    # Create conversation first
    await cortex_client.conversations.create(
        CreateConversationInput(
            conversation_id=test_conversation_id,
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(user_id=test_user_id),
        )
    )

    # Add message
    conversation = await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=test_conversation_id, role="user", content="Hello!"
        )
    )

    assert conversation.message_count == 1
    assert len(conversation.messages) == 1
    assert conversation.messages[0].content == "Hello!"


@pytest.mark.asyncio
async def test_get_conversation(cortex_client, test_memory_space_id, test_conversation_id, test_user_id):
    """Test retrieving a conversation."""
    # Create conversation
    created = await cortex_client.conversations.create(
        CreateConversationInput(
            conversation_id=test_conversation_id,
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(user_id=test_user_id),
        )
    )

    # Get it back
    retrieved = await cortex_client.conversations.get(test_conversation_id)

    assert retrieved is not None
    assert retrieved.conversation_id == test_conversation_id


@pytest.mark.asyncio
async def test_list_conversations(cortex_client, test_memory_space_id, test_user_id):
    """Test listing conversations."""
    # Create a few conversations
    for i in range(3):
        await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=test_memory_space_id,
                type="user-agent",
                participants=ConversationParticipants(user_id=test_user_id),
            )
        )

    # List them
    conversations = await cortex_client.conversations.list(
        memory_space_id=test_memory_space_id, limit=10
    )

    assert len(conversations) >= 3


@pytest.mark.asyncio
async def test_count_conversations(cortex_client, test_memory_space_id, test_user_id):
    """Test counting conversations."""
    # Create conversations
    for i in range(2):
        await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=test_memory_space_id,
                type="user-agent",
                participants=ConversationParticipants(user_id=test_user_id),
            )
        )

    # Count them
    count = await cortex_client.conversations.count(memory_space_id=test_memory_space_id)

    assert count >= 2


@pytest.mark.asyncio
async def test_get_or_create(cortex_client, test_memory_space_id, test_user_id):
    """Test get or create conversation."""
    # First call creates
    conv1 = await cortex_client.conversations.get_or_create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, participant_id="bot-1"
            ),
        )
    )

    # Second call gets existing
    conv2 = await cortex_client.conversations.get_or_create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, participant_id="bot-1"
            ),
        )
    )

    assert conv1.conversation_id == conv2.conversation_id

