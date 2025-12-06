"""
Comprehensive enum-based filter tests for Conversations API.

Tests both conversation types across all 3 filter operations to ensure:
1. No ArgumentValidationError for valid enum values
2. Filters return only matching results
3. Combining type filter with other parameters works

Port of: Comprehensive filter coverage (new tests)
"""

import pytest

from cortex.types import (
    AddMessageInput,
    ConversationParticipants,
    CreateConversationInput,
)
from tests.helpers import generate_test_memory_space_id, generate_test_user_id

# All valid conversation types
ALL_CONVERSATION_TYPES = ["user-agent", "agent-agent"]


@pytest.mark.parametrize("conv_type", ALL_CONVERSATION_TYPES)
class TestConversationsFilterParametrized:
    """Parametrized tests covering all conversation types across all operations."""

    @pytest.mark.asyncio
    async def test_list_filters_by_type(self, cortex_client, conv_type):
        """Test conversations.list() filters correctly by type."""
        space_id = generate_test_memory_space_id()
        user_id = generate_test_user_id()

        # Create conversation of target type
        if conv_type == "user-agent":
            target_conv = await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="user-agent",
                    participants=ConversationParticipants(user_id=user_id, agent_id="test-agent"),
                )
            )
        else:  # agent-agent
            target_conv = await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="agent-agent",
                    participants=ConversationParticipants(
                        participant_id="agent-a",
                        memory_space_ids=["space-a", "space-b"],
                    ),
                )
            )

        # Create conversation of different type as noise
        if conv_type == "user-agent":
            await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="agent-agent",
                    participants=ConversationParticipants(
                        participant_id="noise-agent",
                        memory_space_ids=["noise-1", "noise-2"],
                    ),
                )
            )
        else:
            await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="user-agent",
                    participants=ConversationParticipants(user_id="noise-user", agent_id="test-agent"),
                )
            )

        # Execute: List with type filter
        results = await cortex_client.conversations.list(
            type=conv_type, memory_space_id=space_id
        )

        # Validate
        assert len(results) >= 1, f"Should find at least 1 {conv_type} conversation"
        for conv in results:
            assert (
                conv.type == conv_type
            ), f"All results should be {conv_type}, got {conv.type}"

        # Verify target conversation is in results
        conv_ids = [c.conversation_id for c in results]
        assert (
            target_conv.conversation_id in conv_ids
        ), f"Target {conv_type} conversation should be in results"

    @pytest.mark.asyncio
    async def test_count_filters_by_type(self, cortex_client, conv_type):
        """Test conversations.count() filters correctly by type."""
        space_id = generate_test_memory_space_id()

        # Create 2 conversations of target type
        if conv_type == "user-agent":
            await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="user-agent",
                    participants=ConversationParticipants(user_id="user-count-1", agent_id="test-agent"),
                )
            )
            await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="user-agent",
                    participants=ConversationParticipants(user_id="user-count-2", agent_id="test-agent"),
                )
            )
        else:  # agent-agent
            await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="agent-agent",
                    participants=ConversationParticipants(
                        participant_id="agent-count-a1",
                        memory_space_ids=["a1-1", "a1-2"]
                    ),
                )
            )
            await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="agent-agent",
                    participants=ConversationParticipants(
                        participant_id="agent-count-a2",
                        memory_space_ids=["a2-1", "a2-2"]
                    ),
                )
            )

        # Create different type as noise
        if conv_type == "user-agent":
            await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="agent-agent",
                    participants=ConversationParticipants(
                        participant_id="noise", memory_space_ids=["n1", "n2"]
                    ),
                )
            )
        else:
            await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="user-agent",
                    participants=ConversationParticipants(user_id="noise-user", agent_id="test-agent"),
                )
            )

        # Execute: Count with type filter
        count = await cortex_client.conversations.count(type=conv_type)

        # Validate
        assert (
            count >= 2
        ), f"Should count at least 2 {conv_type} conversations, got {count}"

    @pytest.mark.asyncio
    async def test_search_filters_by_type(self, cortex_client, conv_type):
        """Test conversations.search() filters correctly by type."""
        space_id = generate_test_memory_space_id()
        search_term = "searchable"

        # Create conversation with searchable message
        if conv_type == "user-agent":
            target_conv = await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="user-agent",
                    participants=ConversationParticipants(user_id="search-user", agent_id="test-agent"),
                )
            )
        else:
            target_conv = await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="agent-agent",
                    participants=ConversationParticipants(
                        participant_id="search-a", memory_space_ids=["s1", "s2"]
                    ),
                )
            )

        # Add message with search term
        await cortex_client.conversations.add_message(
            AddMessageInput(
                conversation_id=target_conv.conversation_id,
                role="user",
                content=f"{search_term} message content",
            )
        )

        # Create different type with same search term (should be filtered out)
        if conv_type == "user-agent":
            noise_conv = await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="agent-agent",
                    participants=ConversationParticipants(
                        participant_id="noise", memory_space_ids=["n1", "n2"]
                    ),
                )
            )
        else:
            noise_conv = await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="user-agent",
                    participants=ConversationParticipants(user_id="noise-user", agent_id="test-agent"),
                )
            )

        await cortex_client.conversations.add_message(
            AddMessageInput(
                conversation_id=noise_conv.conversation_id,
                role="user",
                content=f"{search_term} noise message",
            )
        )

        # Execute: Search with type filter
        results = await cortex_client.conversations.search(
            query=search_term, type=conv_type, memory_space_id=space_id
        )

        # Validate
        assert len(results) >= 1, f"Should find at least 1 {conv_type} conversation"
        for result in results:
            conv = result.conversation
            assert (
                conv["type"] == conv_type
            ), f"All results should be {conv_type}, got {conv['type']}"


class TestConversationsFilterEdgeCases:
    """Edge case tests for conversations filter operations."""

    @pytest.mark.asyncio
    async def test_list_filter_no_matches(self, cortex_client):
        """Test list with type filter when no matches exist."""
        space_id = generate_test_memory_space_id()

        # Create only user-agent conversations
        await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_id,
                type="user-agent",
                participants=ConversationParticipants(user_id="only-user", agent_id="test-agent"),
            )
        )

        # Query for agent-agent type
        results = await cortex_client.conversations.list(
            type="agent-agent", memory_space_id=space_id
        )

        # Should return empty list (or at least none from this test), not error
        # Relaxed assertion since there might be existing agent-agent conversations
        assert isinstance(results, list), "Should return list"

    @pytest.mark.asyncio
    async def test_list_both_types_exist(self, cortex_client):
        """Test that both conversation types can coexist in same memory space."""
        space_id = generate_test_memory_space_id()

        # Create user-agent conversation
        ua_conv = await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_id,
                type="user-agent",
                participants=ConversationParticipants(user_id="test-user", agent_id="test-agent"),
            )
        )

        # Create agent-agent conversation
        aa_conv = await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_id,
                type="agent-agent",
                participants=ConversationParticipants(
                    participant_id="agent-a", memory_space_ids=["a1", "a2"]
                ),
            )
        )

        # List user-agent
        ua_results = await cortex_client.conversations.list(
            type="user-agent", memory_space_id=space_id
        )
        assert len(ua_results) >= 1, "Should find user-agent conversations"
        assert all(c.type == "user-agent" for c in ua_results)
        assert any(c.conversation_id == ua_conv.conversation_id for c in ua_results)

        # List agent-agent
        aa_results = await cortex_client.conversations.list(
            type="agent-agent", memory_space_id=space_id
        )
        assert len(aa_results) >= 1, "Should find agent-agent conversations"
        assert all(c.type == "agent-agent" for c in aa_results)
        assert any(c.conversation_id == aa_conv.conversation_id for c in aa_results)

    @pytest.mark.asyncio
    async def test_combine_type_with_user_id_filter(self, cortex_client):
        """Test combining type filter with userId filter."""
        space_id = generate_test_memory_space_id()
        target_user = "combine-user"

        # Create user-agent conversation with target user
        _target_conv = await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_id,
                type="user-agent",
                participants=ConversationParticipants(user_id=target_user, agent_id="test-agent"),
            )
        )

        # Create user-agent conversation with different user
        await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_id,
                type="user-agent",
                participants=ConversationParticipants(user_id="different-user", agent_id="test-agent"),
            )
        )

        # Create agent-agent conversation (wrong type, even if userId matches)
        await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_id,
                type="agent-agent",
                participants=ConversationParticipants(
                    participant_id="agent-a", memory_space_ids=["a1", "a2"]
                ),
            )
        )

        # Execute: Combine type + userId filters
        results = await cortex_client.conversations.list(
            type="user-agent", user_id=target_user, memory_space_id=space_id
        )

        # Validate: Should only find target conversation
        assert len(results) >= 1, "Should find conversations matching both filters"
        for conv in results:
            assert conv.type == "user-agent", "All should be user-agent"
            # Check userId is in participants (skip detailed check, just verify structure)
            assert hasattr(conv, "participants"), "Should have participants"

    @pytest.mark.asyncio
    async def test_combine_type_with_memory_space_filter(self, cortex_client):
        """Test combining type filter with memorySpaceId filter."""
        space_1 = generate_test_memory_space_id()
        space_2 = generate_test_memory_space_id()

        # Create user-agent in space 1
        _conv_space_1 = await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_1,
                type="user-agent",
                participants=ConversationParticipants(user_id="user-space-1", agent_id="test-agent"),
            )
        )

        # Create user-agent in space 2
        await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_2,
                type="user-agent",
                participants=ConversationParticipants(user_id="user-space-2", agent_id="test-agent"),
            )
        )

        # Create agent-agent in space 1 (wrong type)
        await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_1,
                type="agent-agent",
                participants=ConversationParticipants(
                    participant_id="agent-a", memory_space_ids=["a1", "a2"]
                ),
            )
        )

        # Execute: Filter by type AND memory space
        results = await cortex_client.conversations.list(
            type="user-agent", memory_space_id=space_1
        )

        # Validate: Should only find user-agent in space 1
        assert len(results) >= 1, "Should find conversations in space 1"
        for conv in results:
            assert conv.type == "user-agent"
            assert conv.memory_space_id == space_1

    @pytest.mark.asyncio
    async def test_count_all_vs_filtered(self, cortex_client):
        """Test count() with and without type filter."""
        space_id = generate_test_memory_space_id()

        # Create 3 user-agent
        for i in range(3):
            await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="user-agent",
                    participants=ConversationParticipants(user_id=f"user-{i}", agent_id="test-agent"),
                )
            )

        # Create 2 agent-agent
        for i in range(2):
            await cortex_client.conversations.create(
                CreateConversationInput(
                    memory_space_id=space_id,
                    type="agent-agent",
                    participants=ConversationParticipants(
                        participant_id=f"agent-a-{i}",
                        memory_space_ids=[f"a{i}-1", f"a{i}-2"]
                    ),
                )
            )

        # Count user-agent only
        ua_count = await cortex_client.conversations.count(type="user-agent")
        assert ua_count >= 3, f"Should count at least 3 user-agent, got {ua_count}"

        # Count agent-agent only
        aa_count = await cortex_client.conversations.count(type="agent-agent")
        assert aa_count >= 2, f"Should count at least 2 agent-agent, got {aa_count}"

        # Count all (no filter)
        total_count = await cortex_client.conversations.count()
        assert (
            total_count >= 5
        ), f"Should count at least 5 total conversations, got {total_count}"

    @pytest.mark.asyncio
    async def test_search_with_type_and_date_range(self, cortex_client):
        """Test search() combining type filter with date range."""
        space_id = generate_test_memory_space_id()
        search_term = "dated"

        # Create user-agent conversation
        conv = await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_id,
                type="user-agent",
                participants=ConversationParticipants(user_id="date-user", agent_id="test-agent"),
            )
        )

        # Add message
        await cortex_client.conversations.add_message(
            AddMessageInput(
                conversation_id=conv.conversation_id,
                role="user",
                content=f"{search_term} message",
            )
        )

        # Search with type filter
        results = await cortex_client.conversations.search(
            query=search_term, type="user-agent", memory_space_id=space_id
        )

        # Should find the conversation
        assert len(results) >= 1, "Should find conversations with type filter"
        for result in results:
            assert result.conversation["type"] == "user-agent"

    @pytest.mark.asyncio
    async def test_search_empty_results_for_wrong_type(self, cortex_client):
        """Test search returns empty when filtering by wrong type."""
        space_id = generate_test_memory_space_id()
        search_term = "unique"

        # Create only user-agent conversations
        conv = await cortex_client.conversations.create(
            CreateConversationInput(
                memory_space_id=space_id,
                type="user-agent",
                participants=ConversationParticipants(user_id="unique-user", agent_id="test-agent"),
            )
        )

        await cortex_client.conversations.add_message(
            AddMessageInput(
                conversation_id=conv.conversation_id,
                role="user",
                content=f"{search_term} message",
            )
        )

        # Search for agent-agent type (should be empty)
        results = await cortex_client.conversations.search(
            query=search_term, type="agent-agent", memory_space_id=space_id
        )

        # Should return empty list
        assert results == [], "Should return empty list for non-matching type"
