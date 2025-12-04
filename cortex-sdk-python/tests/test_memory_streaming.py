"""
Tests for Memory Streaming API - remember_stream()

Tests the streaming variant of remember() that consumes AsyncIterable streams.
"""

import asyncio

import pytest

from cortex import Cortex, CortexConfig, RememberStreamParams
from cortex.types import RegisterMemorySpaceParams


# Helper to create async generator for testing
async def simple_stream():
    """Simple async generator that yields text chunks."""
    yield "The weather "
    yield "is sunny "
    yield "today."


async def multi_chunk_stream():
    """Async generator with many chunks."""
    chunks = ["Hello ", "from ", "the ", "streaming ", "API!"]
    for chunk in chunks:
        yield chunk


async def single_chunk_stream():
    """Async generator with single chunk."""
    yield "Single chunk response"


async def empty_stream():
    """Async generator that yields nothing."""
    return
    yield  # Make it a generator


async def whitespace_stream():
    """Async generator that yields only whitespace."""
    yield "   "
    yield "\n"
    yield "\t"


async def delayed_stream():
    """Async generator with delays between chunks."""
    yield "First "
    await asyncio.sleep(0.01)
    yield "second "
    await asyncio.sleep(0.01)
    yield "third"


@pytest.mark.asyncio
class TestMemoryStreaming:
    """Test suite for Memory Streaming API."""

    @pytest.fixture(autouse=True)
    async def setup(self, test_run_context, request):
        """Set up test environment."""
        import os
        import random
        # Use environment CONVEX_URL (set by conftest.py for LOCAL/MANAGED mode)
        self.convex_url = os.getenv("CONVEX_URL", "http://127.0.0.1:3210")
        self.cortex = Cortex(CortexConfig(convex_url=self.convex_url))
        # Use ctx for unique ID generation + test name for uniqueness per method
        self.ctx = test_run_context
        test_name = request.node.name.replace("test_", "")
        self.test_space_id = f"{self.ctx.run_id}-stream-{test_name}-{random.randint(1000, 9999)}"

        # Register memory space
        await self.cortex.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=self.test_space_id,
                name="Test Streaming Space",
                type="custom",
            )
        )

        yield

        # Cleanup
        try:
            await self.cortex.close()
        except:
            pass

    async def test_basic_streaming(self):
        """Test basic streaming with async generator."""
        conv_id = self.ctx.conversation_id("stream-1")

        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id=conv_id,
                user_message="What's the weather?",
                response_stream=simple_stream(),
                user_id=self.ctx.user_id("user-1"),
                user_name="TestUser",
                agent_id=self.ctx.agent_id("test-agent"),
            )
        )

        assert result.full_response == "The weather is sunny today."
        assert len(result.memories) == 2  # user + agent
        assert result.conversation["conversationId"] == conv_id
        assert len(result.conversation["messageIds"]) == 2
        assert isinstance(result.facts, list)

    async def test_multi_chunk_stream(self):
        """Test streaming with many chunks."""
        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id=self.ctx.conversation_id("stream-2"),
                user_message="Say hello",
                response_stream=multi_chunk_stream(),
                user_id=self.ctx.user_id("user-2"),
                user_name="MultiUser",
                agent_id=self.ctx.agent_id("test-agent"),
            )
        )

        assert result.full_response == "Hello from the streaming API!"
        assert len(result.memories) == 2

    async def test_single_chunk_stream(self):
        """Test streaming with single chunk."""
        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id=self.ctx.conversation_id("stream-3"),
                user_message="Single chunk test",
                response_stream=single_chunk_stream(),
                user_id=self.ctx.user_id("user-3"),
                user_name="SingleUser",
                agent_id=self.ctx.agent_id("test-agent"),
            )
        )

        assert result.full_response == "Single chunk response"
        assert len(result.memories) == 2

    async def test_delayed_stream(self):
        """Test streaming with delays between chunks."""
        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id=self.ctx.conversation_id("stream-4"),
                user_message="Delayed test",
                response_stream=delayed_stream(),
                user_id=self.ctx.user_id("user-4"),
                user_name="DelayUser",
                agent_id=self.ctx.agent_id("test-agent"),
            )
        )

        assert result.full_response == "First second third"
        assert len(result.memories) == 2

    async def test_empty_stream_error(self):
        """Test that empty stream raises error."""
        with pytest.raises(Exception) as exc_info:
            await self.cortex.memory.remember_stream(
                RememberStreamParams(
                    memory_space_id=self.test_space_id,
                    conversation_id="stream-conv-empty",
                    user_message="Empty test",
                    response_stream=empty_stream(),
                    user_id="user-empty",
                    user_name="EmptyUser",
                    agent_id="test-agent",
                )
            )

        assert "produced no content" in str(exc_info.value)

    async def test_whitespace_stream_error(self):
        """Test that whitespace-only stream raises error."""
        with pytest.raises(Exception) as exc_info:
            await self.cortex.memory.remember_stream(
                RememberStreamParams(
                    memory_space_id=self.test_space_id,
                    conversation_id="stream-conv-whitespace",
                    user_message="Whitespace test",
                    response_stream=whitespace_stream(),
                    user_id="user-whitespace",
                    user_name="WhitespaceUser",
                    agent_id="test-agent",
                )
            )

        assert "produced no content" in str(exc_info.value)

    async def test_invalid_stream_type(self):
        """Test that non-iterable raises error."""
        from cortex.memory.validators import MemoryValidationError

        with pytest.raises(MemoryValidationError) as exc_info:
            await self.cortex.memory.remember_stream(
                RememberStreamParams(
                    memory_space_id=self.test_space_id,
                    conversation_id="stream-conv-invalid",
                    user_message="Invalid test",
                    response_stream="not a stream",  # Invalid
                    user_id="user-invalid",
                    user_name="InvalidUser",
                    agent_id="test-agent",
                )
            )

        # Validation catches invalid stream type
        assert "AsyncIterable" in str(exc_info.value) or "__aiter__" in str(exc_info.value)

    async def test_stream_with_fact_extraction(self):
        """Test streaming with fact extraction."""

        async def fact_extractor(user_msg: str, agent_resp: str):
            """Extract facts from the conversation."""
            if "favorite color" in agent_resp.lower():
                return [
                    {
                        "fact": "User's favorite color is blue",
                        "factType": "preference",
                        "confidence": 95,
                        "subject": "user",
                        "predicate": "favoriteColor",
                        "object": "blue",
                    }
                ]
            return []

        async def color_stream():
            # Response with meaningful content (not just acknowledgment)
            yield "Your favorite color "
            yield "is blue - "
            yield "I'll use this preference "
            yield "for future recommendations"

        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id="stream-conv-facts",
                user_message="My favorite color is blue",
                response_stream=color_stream(),
                user_id="user-facts",
                user_name="FactUser",
                agent_id="test-agent",
                extract_facts=fact_extractor,
            )
        )

        assert result.full_response == "Your favorite color is blue - I'll use this preference for future recommendations"
        assert len(result.memories) == 2
        assert len(result.facts) == 1
        assert "blue" in result.facts[0].fact

    async def test_stream_with_metadata(self):
        """Test streaming with importance and tags."""
        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id="stream-conv-metadata",
                user_message="Important message",
                response_stream=simple_stream(),
                user_id="user-meta",
                user_name="MetaUser",
                agent_id="test-agent",
                importance=80,
                tags=["important", "weather"],
            )
        )

        assert result.full_response == "The weather is sunny today."
        assert len(result.memories) == 2
        # Check that metadata was applied
        memory = result.memories[0]
        assert memory.importance == 80
        assert "important" in memory.tags
        assert "weather" in memory.tags

    async def test_stream_with_participant_id(self):
        """Test streaming with participant_id for Hive Mode."""
        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id="stream-conv-hive",
                user_message="Hive test",
                response_stream=simple_stream(),
                user_id="user-hive",
                user_name="HiveUser",
                agent_id="test-agent",
                participant_id="agent-alpha",
            )
        )

        assert result.full_response == "The weather is sunny today."
        assert len(result.memories) == 2
        # Both memories should have the participant_id
        for memory in result.memories:
            assert memory.participant_id == "agent-alpha"

    async def test_stream_result_structure(self):
        """Test that result has all expected fields."""
        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id="stream-conv-structure",
                user_message="Structure test",
                response_stream=simple_stream(),
                user_id="user-structure",
                user_name="StructUser",
                agent_id="test-agent",
            )
        )

        # Check all expected fields exist
        assert hasattr(result, "conversation")
        assert hasattr(result, "memories")
        assert hasattr(result, "facts")
        assert hasattr(result, "full_response")

        # Check types
        assert isinstance(result.conversation, dict)
        assert isinstance(result.memories, list)
        assert isinstance(result.facts, list)
        assert isinstance(result.full_response, str)

        # Check conversation structure
        assert "conversationId" in result.conversation
        assert "messageIds" in result.conversation

    async def test_stream_verification_in_database(self):
        """Test that streamed content is actually stored and retrievable."""
        conv_id = self.ctx.conversation_id("verify")

        await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id=conv_id,
                user_message="Verify this",
                response_stream=simple_stream(),
                user_id=self.ctx.user_id("user-verify"),
                user_name="VerifyUser",
                agent_id=self.ctx.agent_id("test-agent"),
            )
        )

        # Verify we can retrieve the stored conversation
        conversation = await self.cortex.conversations.get(conv_id)
        assert conversation is not None
        assert conversation.conversation_id == conv_id
        assert len(conversation.messages) == 2

        # Verify message content
        agent_message = conversation.messages[1]
        content = agent_message.get("content") if isinstance(agent_message, dict) else agent_message.content
        assert content == "The weather is sunny today."

        # Verify we can search for the memory
        memories = await self.cortex.memory.search(
            self.test_space_id,
            "weather sunny",
        )
        assert len(memories) > 0


@pytest.mark.asyncio
class TestMemoryStreamingEdgeCases:
    """Test edge cases and error conditions."""

    @pytest.fixture(autouse=True)
    async def setup(self):
        """Set up test environment."""
        import os
        import random
        import time
        # Use environment CONVEX_URL (set by conftest.py for LOCAL/MANAGED mode)
        self.convex_url = os.getenv("CONVEX_URL", "http://127.0.0.1:3210")
        self.cortex = Cortex(CortexConfig(convex_url=self.convex_url))
        # Use unique ID per test to avoid conflicts
        self.test_space_id = f"test-streaming-edge-{int(time.time() * 1000)}-{random.randint(1000, 9999)}"

        await self.cortex.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=self.test_space_id,
                name="Test Streaming Edge Cases",
                type="custom",
            )
        )

        yield

        try:
            await self.cortex.close()
        except:
            pass

    async def test_unicode_in_stream(self):
        """Test that unicode characters work correctly."""

        async def unicode_stream():
            yield "Hello "
            yield "世界 "
            yield "🌍 "
            yield "émojis!"

        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id="stream-unicode",
                user_message="Unicode test",
                response_stream=unicode_stream(),
                user_id="user-unicode",
                user_name="UnicodeUser",
                agent_id="test-agent",
            )
        )

        assert result.full_response == "Hello 世界 🌍 émojis!"
        assert len(result.memories) == 2

    async def test_large_stream(self):
        """Test streaming with large content."""

        async def large_stream():
            # Generate ~10KB of text
            for i in range(1000):
                yield f"Line {i}: This is some text content. "

        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id="stream-large",
                user_message="Large stream test",
                response_stream=large_stream(),
                user_id="user-large",
                user_name="LargeUser",
                agent_id="test-agent",
            )
        )

        assert len(result.full_response) > 10000
        assert "Line 0:" in result.full_response
        assert "Line 999:" in result.full_response
        assert len(result.memories) == 2

    async def test_none_chunks_in_stream(self):
        """Test that None chunks are handled correctly."""

        async def none_chunk_stream():
            yield "Start "
            yield None  # Should be skipped
            yield "middle "
            yield None  # Should be skipped
            yield "end"

        result = await self.cortex.memory.remember_stream(
            RememberStreamParams(
                memory_space_id=self.test_space_id,
                conversation_id="stream-none",
                user_message="None chunks test",
                response_stream=none_chunk_stream(),
                user_id="user-none",
                user_name="NoneUser",
                agent_id="test-agent",
            )
        )

        assert result.full_response == "Start middle end"
        assert len(result.memories) == 2

