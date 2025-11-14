"""
Tests for Agent-to-Agent (A2A) API

Port of: tests/a2a.test.ts (if exists)

Tests validate:
- Agent-to-agent communication
- Memory space coordination
- Multi-agent workflows
"""

import pytest
import time
from cortex import CreateConversationInput, ConversationParticipants, AddMessageInput
from tests.helpers import TestCleanup


# ============================================================================
# Agent-to-Agent Communication Tests
# ============================================================================


@pytest.mark.asyncio
async def test_agent_to_agent_conversation(cortex_client, test_ids, cleanup_helper):
    """
    Test creating agent-to-agent conversation.
    
    Port of: a2a.test.ts - basic A2A
    """
    memory_space_id = test_ids["memory_space_id"]
    conversation_id = test_ids["conversation_id"]
    
    # Create A2A conversation
    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            conversation_id=conversation_id,
            memory_space_id=memory_space_id,
            type="agent-agent",
            participants=ConversationParticipants(
                participant_id="agent-1",
                memory_space_ids=["agent-1-space", "agent-2-space"],
            ),
        )
    )
    
    assert conv.type == "agent-agent"
    
    # Add message from agent-1
    await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conversation_id,
            role="agent",
            content="Message from agent-1",
            participant_id="agent-1",
        )
    )
    
    # Add message from agent-2
    await cortex_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conversation_id,
            role="agent",
            content="Message from agent-2",
            participant_id="agent-2",
        )
    )
    
    # Get conversation
    retrieved = await cortex_client.conversations.get(conversation_id)
    assert retrieved.message_count == 2
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_agent_memory_sharing(cortex_client, test_ids, cleanup_helper):
    """
    Test agents sharing memory in same space (Hive mode).
    
    Port of: a2a.test.ts - memory sharing
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Agent-1 stores memory
    from cortex import StoreMemoryInput, MemorySource, MemoryMetadata
    mem1 = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Shared knowledge",
            content_type="raw",
            participant_id="agent-1",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=70, tags=["shared"]),
        ),
    )
    
    # Agent-2 can access the same memory
    retrieved = await cortex_client.vector.get(memory_space_id, mem1.memory_id)
    
    assert retrieved is not None
    assert retrieved.content == "Shared knowledge"
    
    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_agent_separate_spaces(cortex_client, test_ids, cleanup_helper):
    """
    Test agents with separate memory spaces (Collaboration mode).
    
    Port of: a2a.test.ts - separate spaces
    """
    space_1 = test_ids["memory_space_id"] + "-agent1"
    space_2 = test_ids["memory_space_id"] + "-agent2"
    
    # Agent-1 stores in their space
    from cortex import StoreMemoryInput, MemorySource, MemoryMetadata
    mem1 = await cortex_client.vector.store(
        space_1,
        StoreMemoryInput(
            content="Agent-1 private memory",
            content_type="raw",
            participant_id="agent-1",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=70, tags=["private"]),
        ),
    )
    
    # Agent-2 stores in their space
    mem2 = await cortex_client.vector.store(
        space_2,
        StoreMemoryInput(
            content="Agent-2 private memory",
            content_type="raw",
            participant_id="agent-2",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=70, tags=["private"]),
        ),
    )
    
    # Verify isolation - agent-2 can't see agent-1's memory
    result = await cortex_client.vector.get(space_2, mem1.memory_id)
    assert result is None
    
    # Cleanup
    await cleanup_helper.purge_memory_space(space_1)
    await cleanup_helper.purge_memory_space(space_2)

