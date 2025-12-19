"""
Tests for Agent-to-Agent (A2A) API

Comprehensive tests for agent-to-agent communication.
Tests cover: core operations, client-side validation, integration, and edge cases.
"""

import time

import pytest

from cortex import (
    A2ABroadcastParams,
    A2AConversation,
    A2AConversationFilters,
    A2AConversationMessage,
    A2ARequestParams,
    A2ASendParams,
    A2AValidationError,
    AddMessageInput,
    ConversationParticipants,
    CreateConversationInput,
    MemoryMetadata,
    MemorySource,
    StoreMemoryInput,
)

# ============================================================================
# Core Operations (Happy Path)
# ============================================================================


class TestA2ACoreSend:
    """Tests for A2A send() operation."""

    @pytest.mark.asyncio
    async def test_send_basic_message_between_agents(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should send basic message between agents."""
        prefix = f"a2a-send-{int(time.time() * 1000)}"

        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=f"{prefix}-agent-1",
                to_agent=f"{prefix}-agent-2",
                message="Hello from agent 1",
                importance=70,
            )
        )

        assert result.message_id is not None
        assert result.message_id.startswith("a2a-msg-")
        assert result.sent_at > 0
        assert result.sender_memory_id is not None
        assert result.receiver_memory_id is not None

    @pytest.mark.asyncio
    async def test_send_creates_bidirectional_memories(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should create memories in both sender and receiver memory spaces."""
        prefix = f"a2a-bidir-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-agent-1"
        agent2 = f"{prefix}-agent-2"

        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="Bidirectional test message",
                importance=60,
            )
        )

        # Verify sender memory exists
        sender_memory = await cortex_client.vector.get(agent1, result.sender_memory_id)
        assert sender_memory is not None
        assert "Sent to" in sender_memory.content

        # Verify receiver memory exists
        receiver_memory = await cortex_client.vector.get(
            agent2, result.receiver_memory_id
        )
        assert receiver_memory is not None
        assert "Received from" in receiver_memory.content

    @pytest.mark.asyncio
    async def test_send_tracks_in_acid_conversation_by_default(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should track in ACID conversation by default."""
        prefix = f"a2a-acid-{int(time.time() * 1000)}"

        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=f"{prefix}-agent-1",
                to_agent=f"{prefix}-agent-2",
                message="ACID conversation test",
                importance=65,
            )
        )

        assert result.conversation_id is not None
        assert result.conversation_id.startswith("a2a-conv-")
        assert result.acid_message_id is not None

    @pytest.mark.asyncio
    async def test_send_skips_acid_when_track_conversation_false(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should skip ACID when track_conversation=False."""
        prefix = f"a2a-noacid-{int(time.time() * 1000)}"

        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=f"{prefix}-agent-1",
                to_agent=f"{prefix}-agent-2",
                message="No ACID tracking test",
                track_conversation=False,
                importance=50,
            )
        )

        assert result.conversation_id is None
        assert result.acid_message_id is None
        # But memories should still exist
        assert result.sender_memory_id is not None
        assert result.receiver_memory_id is not None

    @pytest.mark.asyncio
    async def test_send_links_to_user_id_when_provided(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should link to userId when provided."""
        prefix = f"a2a-user-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-agent-1"
        agent2 = f"{prefix}-agent-2"
        test_user_id = f"user-{prefix}"

        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="Message about a specific user",
                user_id=test_user_id,
                importance=75,
            )
        )

        # Verify memory has userId linked
        memory = await cortex_client.vector.get(agent1, result.sender_memory_id)
        assert memory is not None
        assert memory.user_id == test_user_id

    @pytest.mark.asyncio
    async def test_send_respects_importance_level(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should respect importance level."""
        prefix = f"a2a-imp-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-agent-1"
        agent2 = f"{prefix}-agent-2"

        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="High importance message",
                importance=95,
            )
        )

        memory = await cortex_client.vector.get(agent1, result.sender_memory_id)
        assert memory is not None
        assert memory.importance == 95

    @pytest.mark.asyncio
    async def test_send_stores_metadata_correctly(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should store metadata correctly."""
        prefix = f"a2a-meta-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-agent-1"
        agent2 = f"{prefix}-agent-2"

        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="Message with metadata",
                importance=60,
                metadata={"tags": ["important", "budget"], "priority": "high"},
            )
        )

        memory = await cortex_client.vector.get(agent1, result.sender_memory_id)
        assert memory is not None
        assert "important" in memory.tags
        assert "budget" in memory.tags


class TestA2ACoreBroadcast:
    """Tests for A2A broadcast() operation."""

    @pytest.mark.asyncio
    async def test_broadcast_to_multiple_agents(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should broadcast to multiple agents."""
        prefix = f"a2a-broadcast-{int(time.time() * 1000)}"
        sender = f"{prefix}-sender"
        recipients = [
            f"{prefix}-recipient-1",
            f"{prefix}-recipient-2",
            f"{prefix}-recipient-3",
        ]

        result = await cortex_client.a2a.broadcast(
            A2ABroadcastParams(
                from_agent=sender,
                to_agents=recipients,
                message="Broadcast message to team",
                importance=70,
            )
        )

        assert result.message_id is not None
        assert len(result.recipients) == 3
        for recipient in recipients:
            assert recipient in result.recipients

    @pytest.mark.asyncio
    async def test_broadcast_creates_memories_for_all_recipients(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should create memories for all recipients."""
        prefix = f"a2a-bc-mem-{int(time.time() * 1000)}"
        sender = f"{prefix}-sender"
        recipients = [f"{prefix}-r1", f"{prefix}-r2"]

        result = await cortex_client.a2a.broadcast(
            A2ABroadcastParams(
                from_agent=sender,
                to_agents=recipients,
                message="Broadcast with memories",
                importance=65,
            )
        )

        assert len(result.sender_memory_ids) == len(recipients)
        assert len(result.receiver_memory_ids) == len(recipients)

    @pytest.mark.asyncio
    async def test_broadcast_returns_correct_counts(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should return correct counts."""
        prefix = f"a2a-bc-count-{int(time.time() * 1000)}"
        sender = f"{prefix}-sender"
        recipients = [f"{prefix}-r1", f"{prefix}-r2", f"{prefix}-r3", f"{prefix}-r4"]

        result = await cortex_client.a2a.broadcast(
            A2ABroadcastParams(
                from_agent=sender,
                to_agents=recipients,
                message="Counting broadcast",
                importance=60,
            )
        )

        # 4 recipients = 4 sender memories + 4 receiver memories = 8 total
        assert result.memories_created == 8


class TestA2ACoreGetConversation:
    """Tests for A2A get_conversation() operation."""

    @pytest.mark.asyncio
    async def test_get_conversation_retrieves_conversation(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should retrieve conversation between two agents."""
        prefix = f"a2a-convo-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-agent-1"
        agent2 = f"{prefix}-agent-2"

        # Send some messages
        await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="First message",
                importance=80,
            )
        )

        await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent2,
                to_agent=agent1,
                message="Reply message",
                importance=75,
            )
        )

        convo = await cortex_client.a2a.get_conversation(agent1, agent2)

        # Verify typed A2AConversation is returned
        assert isinstance(convo, A2AConversation)
        assert agent1 in convo.participants
        assert agent2 in convo.participants
        assert convo.message_count > 0
        assert len(convo.messages) > 0

        # Verify messages are typed A2AConversationMessage
        for msg in convo.messages:
            assert isinstance(msg, A2AConversationMessage)
            assert msg.from_agent is not None
            assert msg.to_agent is not None
            assert msg.message is not None

    @pytest.mark.asyncio
    async def test_get_conversation_with_filters_object(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should accept A2AConversationFilters object."""
        prefix = f"a2a-filters-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-agent-1"
        agent2 = f"{prefix}-agent-2"

        # Send a message
        await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="Filter test message",
                importance=85,
            )
        )

        # Use filters object
        filters = A2AConversationFilters(
            min_importance=70,
            limit=50,
        )
        convo = await cortex_client.a2a.get_conversation(agent1, agent2, filters=filters)

        assert isinstance(convo, A2AConversation)
        assert convo.message_count > 0
        # All messages should have importance >= 70
        for msg in convo.messages:
            assert msg.importance >= 70

    @pytest.mark.asyncio
    async def test_get_conversation_applies_importance_filters(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should apply importance filters."""
        prefix = f"a2a-convo-imp-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-agent-1"
        agent2 = f"{prefix}-agent-2"

        # Send messages with different importance
        await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="High importance",
                importance=90,
            )
        )

        await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="Low importance",
                importance=30,
            )
        )

        convo = await cortex_client.a2a.get_conversation(
            agent1, agent2, min_importance=70
        )

        # Verify typed return
        assert isinstance(convo, A2AConversation)

        # All messages should have importance >= 70
        for msg in convo.messages:
            assert isinstance(msg, A2AConversationMessage)
            assert msg.importance >= 70

    @pytest.mark.asyncio
    async def test_get_conversation_handles_empty_conversations(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should handle empty conversations."""
        prefix = f"a2a-empty-{int(time.time() * 1000)}"

        convo = await cortex_client.a2a.get_conversation(
            f"{prefix}-nonexistent-1", f"{prefix}-nonexistent-2"
        )

        # Verify typed return even for empty conversation
        assert isinstance(convo, A2AConversation)
        assert convo.message_count == 0
        assert len(convo.messages) == 0

    @pytest.mark.asyncio
    async def test_get_conversation_period_fields(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should populate period_start and period_end fields."""
        prefix = f"a2a-period-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-agent-1"
        agent2 = f"{prefix}-agent-2"

        # Send a message
        await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="Period test message",
                importance=70,
            )
        )

        convo = await cortex_client.a2a.get_conversation(agent1, agent2)

        assert isinstance(convo, A2AConversation)
        assert convo.period_start > 0
        assert convo.period_end > 0
        assert convo.period_end >= convo.period_start


class TestA2ACoreRequest:
    """Tests for A2A request() operation."""

    @pytest.mark.asyncio
    async def test_request_throws_explaining_pubsub_requirement(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should throw explaining pub/sub requirement."""
        with pytest.raises(Exception) as exc_info:
            await cortex_client.a2a.request(
                A2ARequestParams(
                    from_agent="test-requester",
                    to_agent="test-responder",
                    message="What is the status?",
                    timeout=5000,
                )
            )

        # Should mention pub/sub in some way
        assert "pub" in str(exc_info.value).lower() or "sub" in str(
            exc_info.value
        ).lower()


# ============================================================================
# Client-Side Validation
# ============================================================================


class TestA2AClientSideValidation:
    """Tests for A2A client-side validation."""

    # ---- send() validation ----

    @pytest.mark.asyncio
    async def test_send_throws_on_missing_from_agent(self, cortex_client):
        """Should throw on missing from agent."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.send(
                A2ASendParams(
                    from_agent="",
                    to_agent="agent-2",
                    message="test",
                )
            )

        assert exc_info.value.code == "INVALID_AGENT_ID"
        assert exc_info.value.field == "from"

    @pytest.mark.asyncio
    async def test_send_throws_on_missing_to_agent(self, cortex_client):
        """Should throw on missing to agent."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.send(
                A2ASendParams(
                    from_agent="agent-1",
                    to_agent="",
                    message="test",
                )
            )

        assert exc_info.value.code == "INVALID_AGENT_ID"
        assert exc_info.value.field == "to"

    @pytest.mark.asyncio
    async def test_send_throws_on_empty_message(self, cortex_client):
        """Should throw on empty message."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.send(
                A2ASendParams(
                    from_agent="agent-1",
                    to_agent="agent-2",
                    message="",
                )
            )

        assert exc_info.value.code == "EMPTY_MESSAGE"

    @pytest.mark.asyncio
    async def test_send_throws_on_whitespace_only_message(self, cortex_client):
        """Should throw on whitespace-only message."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.send(
                A2ASendParams(
                    from_agent="agent-1",
                    to_agent="agent-2",
                    message="   \n\t   ",
                )
            )

        assert exc_info.value.code == "EMPTY_MESSAGE"

    @pytest.mark.asyncio
    async def test_send_throws_on_message_too_large(self, cortex_client):
        """Should throw on message > 100KB."""
        large_message = "x" * 102401  # 100KB + 1 byte

        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.send(
                A2ASendParams(
                    from_agent="agent-1",
                    to_agent="agent-2",
                    message=large_message,
                )
            )

        assert exc_info.value.code == "MESSAGE_TOO_LARGE"

    @pytest.mark.asyncio
    async def test_send_throws_on_invalid_importance_negative(self, cortex_client):
        """Should throw on invalid importance (-1)."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.send(
                A2ASendParams(
                    from_agent="agent-1",
                    to_agent="agent-2",
                    message="test",
                    importance=-1,
                )
            )

        assert exc_info.value.code == "INVALID_IMPORTANCE"

    @pytest.mark.asyncio
    async def test_send_throws_on_invalid_importance_over_100(self, cortex_client):
        """Should throw on invalid importance (101)."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.send(
                A2ASendParams(
                    from_agent="agent-1",
                    to_agent="agent-2",
                    message="test",
                    importance=101,
                )
            )

        assert exc_info.value.code == "INVALID_IMPORTANCE"

    @pytest.mark.asyncio
    async def test_send_throws_on_invalid_agent_id_format(self, cortex_client):
        """Should throw on invalid agent ID format."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.send(
                A2ASendParams(
                    from_agent="agent@invalid!chars",
                    to_agent="agent-2",
                    message="test",
                )
            )

        assert exc_info.value.code == "INVALID_AGENT_ID"

    @pytest.mark.asyncio
    async def test_send_throws_when_from_equals_to(self, cortex_client):
        """Should throw when from === to."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.send(
                A2ASendParams(
                    from_agent="same-agent",
                    to_agent="same-agent",
                    message="test",
                )
            )

        assert exc_info.value.code == "SAME_AGENT_COMMUNICATION"

    # ---- broadcast() validation ----

    @pytest.mark.asyncio
    async def test_broadcast_throws_on_empty_recipients_array(self, cortex_client):
        """Should throw on empty recipients array."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.broadcast(
                A2ABroadcastParams(
                    from_agent="sender",
                    to_agents=[],
                    message="test",
                )
            )

        assert exc_info.value.code == "EMPTY_RECIPIENTS"

    @pytest.mark.asyncio
    async def test_broadcast_throws_on_duplicate_recipients(self, cortex_client):
        """Should throw on duplicate recipients."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.broadcast(
                A2ABroadcastParams(
                    from_agent="sender",
                    to_agents=["recipient-1", "recipient-1", "recipient-2"],
                    message="test",
                )
            )

        assert exc_info.value.code == "DUPLICATE_RECIPIENTS"

    @pytest.mark.asyncio
    async def test_broadcast_throws_on_too_many_recipients(self, cortex_client):
        """Should throw on > 100 recipients."""
        too_many_recipients = [f"recipient-{i}" for i in range(101)]

        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.broadcast(
                A2ABroadcastParams(
                    from_agent="sender",
                    to_agents=too_many_recipients,
                    message="test",
                )
            )

        assert exc_info.value.code == "TOO_MANY_RECIPIENTS"

    @pytest.mark.asyncio
    async def test_broadcast_throws_on_invalid_recipient_id(self, cortex_client):
        """Should throw on invalid recipient ID."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.broadcast(
                A2ABroadcastParams(
                    from_agent="sender",
                    to_agents=["valid-recipient", "invalid@recipient!"],
                    message="test",
                )
            )

        assert exc_info.value.code == "INVALID_AGENT_ID"

    @pytest.mark.asyncio
    async def test_broadcast_throws_when_sender_in_recipients(self, cortex_client):
        """Should throw when sender in recipients."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.broadcast(
                A2ABroadcastParams(
                    from_agent="sender",
                    to_agents=["recipient-1", "sender", "recipient-2"],
                    message="test",
                )
            )

        assert exc_info.value.code == "INVALID_RECIPIENT"

    # ---- get_conversation() validation ----

    @pytest.mark.asyncio
    async def test_get_conversation_throws_when_since_after_until(self, cortex_client):
        """Should throw when since > until."""
        now = int(time.time() * 1000)
        yesterday = now - 24 * 60 * 60 * 1000

        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.get_conversation(
                "agent-1", "agent-2", since=now, until=yesterday
            )

        assert exc_info.value.code == "INVALID_DATE_RANGE"

    @pytest.mark.asyncio
    async def test_get_conversation_throws_on_invalid_min_importance(
        self, cortex_client
    ):
        """Should throw on invalid minImportance."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.get_conversation(
                "agent-1", "agent-2", min_importance=150
            )

        assert exc_info.value.code == "INVALID_IMPORTANCE"

    @pytest.mark.asyncio
    async def test_get_conversation_throws_on_limit_zero(self, cortex_client):
        """Should throw on limit = 0."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.get_conversation("agent-1", "agent-2", limit=0)

        assert exc_info.value.code == "INVALID_LIMIT"

    @pytest.mark.asyncio
    async def test_get_conversation_throws_on_limit_over_1000(self, cortex_client):
        """Should throw on limit > 1000."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.get_conversation("agent-1", "agent-2", limit=1001)

        assert exc_info.value.code == "INVALID_LIMIT"

    @pytest.mark.asyncio
    async def test_get_conversation_throws_on_negative_offset(self, cortex_client):
        """Should throw on negative offset."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.get_conversation("agent-1", "agent-2", offset=-1)

        assert exc_info.value.code == "INVALID_OFFSET"

    @pytest.mark.asyncio
    async def test_get_conversation_throws_on_empty_agent1(self, cortex_client):
        """Should throw on empty agent1."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.get_conversation("", "agent-2")

        assert exc_info.value.code == "INVALID_AGENT_ID"

    @pytest.mark.asyncio
    async def test_get_conversation_throws_on_empty_agent2(self, cortex_client):
        """Should throw on empty agent2."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.get_conversation("agent-1", "")

        assert exc_info.value.code == "INVALID_AGENT_ID"

    # ---- request() validation ----

    @pytest.mark.asyncio
    async def test_request_throws_on_invalid_timeout_too_low(self, cortex_client):
        """Should throw on invalid timeout (< 1000ms)."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.request(
                A2ARequestParams(
                    from_agent="agent-1",
                    to_agent="agent-2",
                    message="test",
                    timeout=500,
                )
            )

        assert exc_info.value.code == "INVALID_TIMEOUT"

    @pytest.mark.asyncio
    async def test_request_throws_on_invalid_timeout_too_high(self, cortex_client):
        """Should throw on invalid timeout (> 300000ms)."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.request(
                A2ARequestParams(
                    from_agent="agent-1",
                    to_agent="agent-2",
                    message="test",
                    timeout=400000,
                )
            )

        assert exc_info.value.code == "INVALID_TIMEOUT"

    @pytest.mark.asyncio
    async def test_request_throws_on_invalid_retries_negative(self, cortex_client):
        """Should throw on invalid retries (negative)."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.request(
                A2ARequestParams(
                    from_agent="agent-1",
                    to_agent="agent-2",
                    message="test",
                    retries=-1,
                )
            )

        assert exc_info.value.code == "INVALID_RETRIES"

    @pytest.mark.asyncio
    async def test_request_throws_on_invalid_retries_too_high(self, cortex_client):
        """Should throw on invalid retries (> 10)."""
        with pytest.raises(A2AValidationError) as exc_info:
            await cortex_client.a2a.request(
                A2ARequestParams(
                    from_agent="agent-1",
                    to_agent="agent-2",
                    message="test",
                    retries=11,
                )
            )

        assert exc_info.value.code == "INVALID_RETRIES"


# ============================================================================
# Integration Tests
# ============================================================================


class TestA2AIntegration:
    """Tests for A2A integration with other systems."""

    @pytest.mark.asyncio
    async def test_integrate_with_memory_api_search(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should integrate with Memory API search (source.type='a2a')."""
        prefix = f"a2a-search-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-agent"
        agent2 = f"{prefix}-target"

        # Send A2A message
        await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="Searchable A2A message about quarterly budget",
                importance=70,
            )
        )

        # Search for A2A messages using tags (all A2A messages have "a2a" tag)
        from cortex import SearchOptions

        search_results = await cortex_client.vector.search(
            agent1, "budget", SearchOptions(tags=["a2a"])
        )

        assert len(search_results) > 0
        found = any(m.source_type == "a2a" for m in search_results)
        assert found

    @pytest.mark.asyncio
    async def test_a2a_messages_have_proper_tags(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """A2A messages should have proper tags."""
        prefix = f"a2a-tag-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-agent-1"
        agent2 = f"{prefix}-agent-2"

        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=agent1,
                to_agent=agent2,
                message="Tagged A2A message",
                importance=60,
                metadata={"tags": ["custom-tag"]},
            )
        )

        memory = await cortex_client.vector.get(agent1, result.sender_memory_id)
        assert memory is not None
        assert "a2a" in memory.tags
        assert "sent" in memory.tags
        assert "custom-tag" in memory.tags


# ============================================================================
# Edge Cases
# ============================================================================


class TestA2AEdgeCases:
    """Tests for A2A edge cases."""

    @pytest.mark.asyncio
    async def test_handles_messages_near_100kb_limit(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should handle messages near 100KB limit."""
        prefix = f"a2a-large-{int(time.time() * 1000)}"
        near_limit_message = "x" * 100000  # Just under 100KB

        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=f"{prefix}-1",
                to_agent=f"{prefix}-2",
                message=near_limit_message,
                importance=50,
            )
        )

        assert result.message_id is not None

    @pytest.mark.asyncio
    async def test_handles_special_characters_emoji_unicode(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should handle special characters (emoji, unicode)."""
        prefix = f"a2a-unicode-{int(time.time() * 1000)}"
        special_message = "Hello! 👋 こんにちは 🎉 مرحبا 🚀"

        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=f"{prefix}-1",
                to_agent=f"{prefix}-2",
                message=special_message,
                importance=55,
            )
        )

        assert result.message_id is not None

        # Verify message content is preserved
        memory = await cortex_client.vector.get(f"{prefix}-1", result.sender_memory_id)
        assert memory is not None
        assert "👋" in memory.content
        assert "こんにちは" in memory.content

    @pytest.mark.asyncio
    async def test_handles_agents_with_no_prior_communication(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should handle agents with no prior communication."""
        prefix = f"a2a-newagent-{int(time.time() * 1000)}"

        convo = await cortex_client.a2a.get_conversation(
            f"{prefix}-1", f"{prefix}-2"
        )

        # Verify typed return even for new agents
        assert isinstance(convo, A2AConversation)
        assert convo.message_count == 0
        assert len(convo.messages) == 0
        assert convo.can_retrieve_full_history is False

    @pytest.mark.asyncio
    async def test_handles_rapid_sequential_messages(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should handle rapid sequential messages."""
        import asyncio

        prefix = f"a2a-rapid-{int(time.time() * 1000)}"
        agent1 = f"{prefix}-1"
        agent2 = f"{prefix}-2"

        # Send 5 messages in rapid succession
        tasks = [
            cortex_client.a2a.send(
                A2ASendParams(
                    from_agent=agent1,
                    to_agent=agent2,
                    message=f"Rapid message {i + 1}",
                    importance=60,
                )
            )
            for i in range(5)
        ]

        results = await asyncio.gather(*tasks)

        # All messages should succeed with unique IDs
        message_ids = [r.message_id for r in results]
        unique_ids = set(message_ids)
        assert len(unique_ids) == 5

    @pytest.mark.asyncio
    async def test_handles_agent_ids_with_allowed_special_chars(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should handle agent IDs with allowed special chars."""
        prefix = f"a2a-special-{int(time.time() * 1000)}"

        # Hyphens and underscores are allowed
        result = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=f"{prefix}-agent_one-test",
                to_agent=f"{prefix}-agent_two-test",
                message="Test with special agent IDs",
                importance=50,
            )
        )

        assert result.message_id is not None

    @pytest.mark.asyncio
    async def test_handles_boundary_importance_values(
        self, cortex_client, test_ids, cleanup_helper
    ):
        """Should handle boundary importance values."""
        prefix = f"a2a-boundary-{int(time.time() * 1000)}"

        # Test importance = 0
        result0 = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=f"{prefix}-imp0-1",
                to_agent=f"{prefix}-imp0-2",
                message="Zero importance",
                importance=0,
            )
        )
        assert result0.message_id is not None

        # Test importance = 100
        result100 = await cortex_client.a2a.send(
            A2ASendParams(
                from_agent=f"{prefix}-imp100-1",
                to_agent=f"{prefix}-imp100-2",
                message="Max importance",
                importance=100,
            )
        )
        assert result100.message_id is not None


# ============================================================================
# Original Legacy Tests (kept for compatibility)
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
    _mem2 = await cortex_client.vector.store(
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
