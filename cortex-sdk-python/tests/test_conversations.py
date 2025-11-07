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
    # After conversion, messages are dicts
    msg = conversation.messages[0]
    msg_content = msg["content"] if isinstance(msg, dict) else msg.content
    assert msg_content == "Hello!"


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


# ============================================================================
# Additional Tests - Expanding Coverage
# ============================================================================


@pytest.mark.asyncio
async def test_create_agent_to_agent_conversation(cortex_client, test_memory_space_id, test_user_id, cleanup_helper):
    """
    Test creating agent-to-agent conversation.
    
    Port of: conversations.test.ts - agent-agent tests
    """
    conversation = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="agent-agent",
            participants=ConversationParticipants(
                participant_id="agent-1",
                memory_space_ids=["agent-1-space", "agent-2-space"],
            ),
        )
    )
    
    assert conversation is not None
    assert conversation.type == "agent-agent"
    
    # Cleanup
    await cortex_client.conversations.delete(conversation.conversation_id)


@pytest.mark.asyncio
async def test_get_history(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
    """
    Test getting conversation history.
    
    Port of: conversations.test.ts - getHistory tests
    """
    # Create conversation
    await cortex_client.conversations.create(
        CreateConversationInput(
            conversation_id=test_conversation_id,
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(user_id=test_user_id),
        )
    )
    
    # Add multiple messages
    for i in range(3):
        await cortex_client.conversations.add_message(
            AddMessageInput(
                conversation_id=test_conversation_id,
                role="user" if i % 2 == 0 else "agent",
                content=f"Message {i+1}",
            )
        )
    
    # Get history
    history = await cortex_client.conversations.get_history(
        test_conversation_id,
        limit=10,
    )
    
    # Should return messages
    messages = history if isinstance(history, list) else history.get("messages", [])
    assert len(messages) >= 3
    
    # Cleanup
    await cortex_client.conversations.delete(test_conversation_id)


@pytest.mark.asyncio
async def test_get_message(cortex_client, test_memory_space_id, test_conversation_id, test_user_id, cleanup_helper):
    """
    Test getting a specific message by ID.
    
    Port of: conversations.test.ts - getMessage tests
    """
    # Create conversation
    await cortex_client.conversations.create(
        CreateConversationInput(
            conversation_id=test_conversation_id,
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(user_id=test_user_id),
        )
    )
    
    # Add message
    conv = await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=test_conversation_id,
            role="user",
            content="Test message",
        )
    )
    
    # Get message ID
    msg = conv.messages[0]
    message_id = msg["id"] if isinstance(msg, dict) else msg.id
    
    # Get message
    retrieved = await cortex_client.conversations.get_message(
        test_conversation_id,
        message_id,
    )
    
    assert retrieved is not None
    msg_content = retrieved.get("content") if isinstance(retrieved, dict) else retrieved.content
    assert msg_content == "Test message"
    
    # Cleanup
    await cortex_client.conversations.delete(test_conversation_id)


@pytest.mark.asyncio
async def test_find_conversation(cortex_client, test_memory_space_id, test_user_id, cleanup_helper):
    """
    Test finding conversation by participants.
    
    Port of: conversations.test.ts - findConversation tests
    """
    participant_id = "specific-agent-123"
    
    # Create conversation with specific participants
    created = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id,
                participant_id=participant_id,
            ),
        )
    )
    
    # Find conversation
    found = await cortex_client.conversations.find_conversation(
        test_memory_space_id,
        test_user_id,
        participant_id,
    )
    
    assert found is not None
    assert found.conversation_id == created.conversation_id
    
    # Cleanup
    await cortex_client.conversations.delete(created.conversation_id)


@pytest.mark.asyncio
async def test_search_conversations(cortex_client, test_memory_space_id, test_user_id, cleanup_helper):
    """
    Test searching conversations.
    
    Port of: conversations.test.ts - search tests
    """
    # Create conversations with different content
    conv1 = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(user_id=test_user_id),
            metadata={"topic": "refunds"},
        )
    )
    
    await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conv1.conversation_id,
            role="user",
            content="I want a refund for my purchase",
        )
    )
    
    # Search for "refund"
    results = await cortex_client.conversations.search(
        test_memory_space_id,
        "refund",
    )
    
    # Should find the conversation
    assert len(results) > 0
    
    # Cleanup
    await cortex_client.conversations.delete(conv1.conversation_id)


@pytest.mark.asyncio
async def test_delete_conversation(cortex_client, test_memory_space_id, test_user_id, cleanup_helper):
    """
    Test deleting a conversation.
    
    Port of: conversations.test.ts - delete tests
    """
    # Create conversation
    created = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(user_id=test_user_id),
        )
    )
    
    # Delete it
    result = await cortex_client.conversations.delete(created.conversation_id)
    
    # Verify deleted
    retrieved = await cortex_client.conversations.get(created.conversation_id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_delete_many_conversations(cortex_client, test_memory_space_id, test_user_id, cleanup_helper):
    """
    Test deleting multiple conversations.
    
    Port of: conversations.test.ts - deleteMany tests
    """
    # Create multiple conversations
    conv_ids = []
    for i in range(3):
        conv = await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=test_memory_space_id,
                type="user-agent",
                participants=ConversationParticipants(user_id=test_user_id),
            )
        )
        conv_ids.append(conv.conversation_id)
    
    # Delete many
    result = await cortex_client.conversations.delete_many(conv_ids)
    
    # Verify all deleted
    for conv_id in conv_ids:
        retrieved = await cortex_client.conversations.get(conv_id)
        assert retrieved is None


@pytest.mark.asyncio
async def test_export_conversations(cortex_client, test_memory_space_id, test_user_id, cleanup_helper):
    """
    Test exporting conversations.
    
    Port of: conversations.test.ts - export tests
    """
    # Create conversation with messages
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(user_id=test_user_id),
        )
    )
    
    await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="user",
            content="Export test message",
        )
    )
    
    # Export
    result = await cortex_client.conversations.export(
        memory_space_id=test_memory_space_id,
        format="json",
    )
    
    # Should return export data
    assert result is not None
    
    # Cleanup
    await cortex_client.conversations.delete(conv.conversation_id)

