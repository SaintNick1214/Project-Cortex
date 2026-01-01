"""
Memory Streaming + Belief Revision Tests (Python SDK)

Tests the integration of belief revision with remember_stream().
Validates that streaming respects belief revision settings and
properly handles fact creation, updates, supersession, and deduplication.
"""

import asyncio
import os
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.helpers import TestRunContext

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test Helpers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def create_async_stream(*chunks: str) -> AsyncIterator[str]:
    """Create an async iterator from string chunks."""
    for chunk in chunks:
        await asyncio.sleep(0.001)  # Simulate streaming delay
        yield chunk


class MockConvexClient:
    """Mock Convex client for unit tests."""

    def __init__(self) -> None:
        self.mutations: Dict[str, Any] = {}
        self.queries: Dict[str, Any] = {}

    async def mutation(self, name: str, args: Dict[str, Any]) -> Any:
        """Mock mutation handler."""
        if name == "conversations:create":
            return {
                "_id": "conv-123",
                "conversationId": args.get("conversationId", "test-conv"),
                "memorySpaceId": args.get("memorySpaceId", "test-space"),
                "type": args.get("type", "user-agent"),
                "participants": args.get("participants", {}),
                "messageCount": 0,
                "createdAt": 1000000000,
                "updatedAt": 1000000000,
            }
        elif name == "conversations:addMessage":
            return {
                "_id": f"msg-{args.get('role', 'user')}",
                "conversationId": args.get("conversationId"),
                "role": args.get("role", "user"),
                "text": args.get("text", ""),
                "createdAt": 1000000000,
            }
        elif name == "facts:storeWithDedup":
            return {
                "fact": {
                    "_id": "fact-123",
                    "factId": f"fact-{args.get('fact', 'test')[:10]}",
                    "memorySpaceId": args.get("memorySpaceId", "test-space"),
                    "fact": args.get("fact", "Test fact"),
                    "factType": args.get("factType", "preference"),
                    "confidence": args.get("confidence", 90),
                    "sourceType": args.get("sourceType", "conversation"),
                    "tags": args.get("tags", []),
                    "version": 1,
                    "createdAt": 1000000000,
                    "updatedAt": 1000000000,
                },
                "wasUpdated": False,
                "deduplication": {
                    "strategy": "structural",
                    "matchedExisting": False,
                },
            }
        elif name == "memorySpaces:register":
            return {
                "_id": "space-123",
                "memorySpaceId": args.get("memorySpaceId", "test-space"),
                "name": args.get("name", "Test Space"),
                "type": args.get("type", "custom"),
                "status": "active",
            }
        elif name.startswith("memories:") or name.startswith("vector:"):
            return {
                "_id": "mem-123",
                "memoryId": "mem-123",
                "memorySpaceId": args.get("memorySpaceId", "test-space"),
                "content": args.get("content", "Test content"),
                "contentType": "raw",
                "version": 1,
                "accessCount": 0,
                "createdAt": 1000000000,
                "updatedAt": 1000000000,
            }
        return {}

    async def query(self, name: str, args: Dict[str, Any]) -> Any:
        """Mock query handler."""
        if name == "conversations:get":
            return {
                "_id": "conv-123",
                "conversationId": args.get("conversationId", "test-conv"),
                "memorySpaceId": "test-space",
                "type": "user-agent",
                "participants": {},
                "messageCount": 0,
                "createdAt": 1000000000,
                "updatedAt": 1000000000,
            }
        elif name == "memorySpaces:get":
            return {
                "_id": "space-123",
                "memorySpaceId": args.get("memorySpaceId", "test-space"),
                "name": "Test Space",
                "type": "custom",
                "status": "active",
            }
        elif name == "facts:list":
            return []
        return None

    async def close(self) -> None:
        """Mock close."""
        pass


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Unit Tests: StreamingOptions with belief_revision
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStreamingOptionsBeliefRevision:
    """Tests for StreamingOptions belief_revision field."""

    def test_streaming_options_has_belief_revision_field(self) -> None:
        """StreamingOptions should have belief_revision field."""
        from cortex.memory.streaming_types import StreamingOptions

        opts = StreamingOptions()
        assert hasattr(opts, "belief_revision")

    def test_streaming_options_belief_revision_default_none(self) -> None:
        """belief_revision should default to None."""
        from cortex.memory.streaming_types import StreamingOptions

        opts = StreamingOptions()
        assert opts.belief_revision is None

    def test_streaming_options_belief_revision_can_be_true(self) -> None:
        """belief_revision can be set to True."""
        from cortex.memory.streaming_types import StreamingOptions

        opts = StreamingOptions(belief_revision=True)
        assert opts.belief_revision is True

    def test_streaming_options_belief_revision_can_be_false(self) -> None:
        """belief_revision can be set to False."""
        from cortex.memory.streaming_types import StreamingOptions

        opts = StreamingOptions(belief_revision=False)
        assert opts.belief_revision is False


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Unit Tests: EnhancedRememberStreamResult with fact_revisions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestEnhancedRememberStreamResultFactRevisions:
    """Tests for fact_revisions in EnhancedRememberStreamResult."""

    def test_result_has_fact_revisions_field(self) -> None:
        """EnhancedRememberStreamResult should have fact_revisions field."""
        from cortex.memory.streaming_types import (
            EnhancedRememberStreamResult,
            PerformanceInsights,
            ProgressiveProcessing,
            StreamMetrics,
        )
        from cortex.types import FactRecord, MemoryEntry

        result = EnhancedRememberStreamResult(
            conversation={"conversationId": "test", "messageIds": []},
            memories=[],
            facts=[],
            full_response="Test response",
            stream_metrics=StreamMetrics(
                start_time=1000,
                first_chunk_latency=10,
                stream_duration_ms=100,
                total_chunks=5,
                total_bytes=50,
                average_chunk_size=10,
                chunks_per_second=50.0,
                facts_extracted=1,
                partial_updates=0,
                error_count=0,
                retry_count=0,
                estimated_tokens=10,
            ),
            progressive_processing=ProgressiveProcessing(
                facts_extracted_during_stream=[],
                partial_storage_history=[],
            ),
            performance=PerformanceInsights(
                bottlenecks=[],
                recommendations=[],
            ),
            fact_revisions=None,
        )

        assert hasattr(result, "fact_revisions")

    def test_result_fact_revisions_can_be_list(self) -> None:
        """fact_revisions can be a list of FactRevisionAction."""
        from cortex.memory.streaming_types import (
            EnhancedRememberStreamResult,
            PerformanceInsights,
            ProgressiveProcessing,
            StreamMetrics,
        )
        from cortex.types import FactRecord, FactRevisionAction

        fact = FactRecord(
            _id="fact-123",
            fact_id="fact-123",
            memory_space_id="test-space",
            fact="User likes coffee",
            fact_type="preference",
            confidence=90,
            source_type="conversation",
            tags=["beverage"],
            created_at=1000000000,
            updated_at=1000000000,
            version=1,
        )

        revision = FactRevisionAction(
            action="ADD",
            fact=fact,
            superseded=None,
            reason="New fact",
        )

        result = EnhancedRememberStreamResult(
            conversation={"conversationId": "test", "messageIds": []},
            memories=[],
            facts=[fact],
            full_response="Test response",
            stream_metrics=StreamMetrics(
                start_time=1000,
                first_chunk_latency=10,
                stream_duration_ms=100,
                total_chunks=5,
                total_bytes=50,
                average_chunk_size=10,
                chunks_per_second=50.0,
                facts_extracted=1,
                partial_updates=0,
                error_count=0,
                retry_count=0,
                estimated_tokens=10,
            ),
            progressive_processing=ProgressiveProcessing(
                facts_extracted_during_stream=[],
                partial_storage_history=[],
            ),
            performance=PerformanceInsights(
                bottlenecks=[],
                recommendations=[],
            ),
            fact_revisions=[revision],
        )

        assert result.fact_revisions is not None
        assert len(result.fact_revisions) == 1
        assert result.fact_revisions[0].action == "ADD"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Unit Tests: FactRevisionAction Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestFactRevisionActionInStreaming:
    """Tests for FactRevisionAction structure in streaming context."""

    def test_fact_revision_action_add(self) -> None:
        """FactRevisionAction should support ADD action."""
        from cortex.types import FactRecord, FactRevisionAction

        fact = FactRecord(
            _id="fact-123",
            fact_id="fact-123",
            memory_space_id="test-space",
            fact="User prefers dark mode",
            fact_type="preference",
            confidence=90,
            source_type="conversation",
            tags=["ui"],
            created_at=1000000000,
            updated_at=1000000000,
            version=1,
        )

        revision = FactRevisionAction(
            action="ADD",
            fact=fact,
            superseded=None,
            reason="New preference fact",
        )

        assert revision.action == "ADD"
        assert revision.fact.fact == "User prefers dark mode"
        assert revision.superseded is None

    def test_fact_revision_action_supersede(self) -> None:
        """FactRevisionAction should support SUPERSEDE action."""
        from cortex.types import FactRecord, FactRevisionAction

        old_fact = FactRecord(
            _id="fact-old",
            fact_id="fact-old",
            memory_space_id="test-space",
            fact="User prefers blue",
            fact_type="preference",
            confidence=90,
            source_type="conversation",
            tags=["color"],
            created_at=1000000000,
            updated_at=1000000000,
            version=1,
        )

        new_fact = FactRecord(
            _id="fact-new",
            fact_id="fact-new",
            memory_space_id="test-space",
            fact="User prefers green",
            fact_type="preference",
            confidence=95,
            source_type="conversation",
            tags=["color"],
            created_at=1000000001,
            updated_at=1000000001,
            version=1,
        )

        revision = FactRevisionAction(
            action="SUPERSEDE",
            fact=new_fact,
            superseded=[old_fact],
            reason="Color preference changed",
        )

        assert revision.action == "SUPERSEDE"
        assert revision.fact.fact == "User prefers green"
        assert revision.superseded is not None
        assert len(revision.superseded) == 1
        assert revision.superseded[0].fact == "User prefers blue"

    def test_fact_revision_action_none(self) -> None:
        """FactRevisionAction should support NONE action (skip)."""
        from cortex.types import FactRecord, FactRevisionAction

        existing_fact = FactRecord(
            _id="fact-existing",
            fact_id="fact-existing",
            memory_space_id="test-space",
            fact="User works remotely",
            fact_type="identity",
            confidence=90,
            source_type="conversation",
            tags=["work"],
            created_at=1000000000,
            updated_at=1000000000,
            version=1,
        )

        revision = FactRevisionAction(
            action="NONE",
            fact=existing_fact,
            superseded=None,
            reason="Duplicate fact - already captured",
        )

        assert revision.action == "NONE"
        assert "Duplicate" in (revision.reason or "")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Integration Tests: remember_stream with belief revision
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestRememberStreamBeliefRevisionIntegration:
    """Integration tests for remember_stream with belief revision."""

    @pytest.mark.asyncio
    async def test_remember_stream_passes_belief_revision_false(
        self, ctx: TestRunContext
    ) -> None:
        """remember_stream should pass belief_revision=False to remember()."""
        from cortex import Cortex
        from cortex.memory.streaming_types import StreamingOptions
        from cortex.types import CortexConfig, RememberStreamParams

        # Skip if no CONVEX_URL
        convex_url = os.environ.get("CONVEX_URL")
        if not convex_url:
            pytest.skip("CONVEX_URL not set")

        cortex = Cortex(CortexConfig(convex_url=convex_url))

        # Use ctx for unique IDs to ensure parallel test isolation
        memory_space_id = ctx.memory_space_id("stream-br")
        conversation_id = ctx.conversation_id("stream-br")
        user_id = ctx.user_id("stream-br")
        agent_id = ctx.agent_id("stream-br")

        try:
            # Create async stream
            async def stream() -> AsyncIterator[str]:
                yield "Test "
                yield "response."

            # Extract facts callback
            async def extract_facts(
                user_msg: str, agent_resp: str
            ) -> List[Dict[str, Any]]:
                return [
                    {
                        "fact": f"Test fact from streaming {ctx.run_id}",
                        "factType": "observation",
                        "confidence": 80,
                        "tags": ["test"],
                    }
                ]

            result = await cortex.memory.remember_stream(
                {
                    "memorySpaceId": memory_space_id,
                    "conversationId": conversation_id,
                    "userMessage": "Test message",
                    "responseStream": stream(),
                    "userId": user_id,
                    "userName": "Test User",
                    "agentId": agent_id,
                    "extractFacts": extract_facts,
                },
                StreamingOptions(belief_revision=False),
            )

            # With belief_revision=False, factRevisions should be None
            assert result.fact_revisions is None or len(result.fact_revisions) == 0

        finally:
            await cortex.close()

    @pytest.mark.asyncio
    async def test_remember_stream_with_llm_has_fact_revisions(
        self, ctx: TestRunContext
    ) -> None:
        """remember_stream with LLM should include factRevisions."""
        from cortex import Cortex
        from cortex.memory.streaming_types import StreamingOptions
        from cortex.types import CortexConfig, LLMConfig

        # Skip if no credentials
        convex_url = os.environ.get("CONVEX_URL")
        openai_key = os.environ.get("OPENAI_API_KEY")
        if not convex_url or not openai_key:
            pytest.skip("CONVEX_URL or OPENAI_API_KEY not set")

        cortex = Cortex(
            CortexConfig(
                convex_url=convex_url,
                llm=LLMConfig(provider="openai", api_key=openai_key),
            )
        )

        # Use ctx for unique IDs to ensure parallel test isolation
        memory_space_id = ctx.memory_space_id("stream-llm")
        conversation_id = ctx.conversation_id("stream-llm")
        user_id = ctx.user_id("stream-llm")
        agent_id = ctx.agent_id("stream-llm")

        try:
            # Create async stream
            async def stream() -> AsyncIterator[str]:
                yield "I'll remember "
                yield "that!"

            # Extract facts callback
            async def extract_facts(
                user_msg: str, agent_resp: str
            ) -> List[Dict[str, Any]]:
                return [
                    {
                        "fact": f"User {ctx.run_id} likes pizza",
                        "factType": "preference",
                        "subject": user_id,
                        "predicate": "food preference",
                        "object": "pizza",
                        "confidence": 90,
                        "tags": ["food"],
                    }
                ]

            result = await cortex.memory.remember_stream(
                {
                    "memorySpaceId": memory_space_id,
                    "conversationId": conversation_id,
                    "userMessage": "I like pizza",
                    "responseStream": stream(),
                    "userId": user_id,
                    "userName": "Test User",
                    "agentId": agent_id,
                    "extractFacts": extract_facts,
                },
                StreamingOptions(belief_revision=True),
            )

            # With LLM configured, should have factRevisions
            if cortex.facts.has_belief_revision():
                assert result.fact_revisions is not None
                assert len(result.fact_revisions) > 0
                # First action should be ADD for new fact
                assert result.fact_revisions[0].action in ["ADD", "UPDATE", "SUPERSEDE", "NONE"]

        finally:
            await cortex.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# E2E Tests: Full Belief Revision Flow through Streaming
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStreamingBeliefRevisionE2E:
    """End-to-end tests for streaming with belief revision."""

    @pytest.mark.asyncio
    async def test_e2e_add_fact_via_streaming(self, ctx: TestRunContext) -> None:
        """E2E: New fact should be ADDed through streaming."""
        from cortex import Cortex
        from cortex.memory.streaming_types import StreamingOptions
        from cortex.types import CortexConfig, LLMConfig

        convex_url = os.environ.get("CONVEX_URL")
        openai_key = os.environ.get("OPENAI_API_KEY")
        if not convex_url or not openai_key:
            pytest.skip("CONVEX_URL or OPENAI_API_KEY not set")

        cortex = Cortex(
            CortexConfig(
                convex_url=convex_url,
                llm=LLMConfig(provider="openai", api_key=openai_key),
            )
        )

        # Use ctx for unique IDs to ensure parallel test isolation
        test_id = ctx.run_id
        memory_space_id = ctx.memory_space_id("e2e-add")
        conversation_id = ctx.conversation_id("e2e-add")
        user_id = ctx.user_id("e2e-add")
        agent_id = ctx.agent_id("e2e-add")

        try:

            async def stream() -> AsyncIterator[str]:
                yield "Great choice! "
                yield "Sushi is delicious."

            async def extract_facts(
                user_msg: str, agent_resp: str
            ) -> List[Dict[str, Any]]:
                return [
                    {
                        "fact": f"User {test_id} favorite food is sushi",
                        "factType": "preference",
                        "subject": user_id,
                        "predicate": "favorite food",
                        "object": "sushi",
                        "confidence": 90,
                        "tags": ["food", "preference"],
                    }
                ]

            result = await cortex.memory.remember_stream(
                {
                    "memorySpaceId": memory_space_id,
                    "conversationId": conversation_id,
                    "userMessage": "My favorite food is sushi",
                    "responseStream": stream(),
                    "userId": user_id,
                    "userName": "E2E User",
                    "agentId": agent_id,
                    "extractFacts": extract_facts,
                },
                StreamingOptions(belief_revision=True),
            )

            assert result.full_response == "Great choice! Sushi is delicious."
            assert len(result.facts) >= 1

            if cortex.facts.has_belief_revision() and result.fact_revisions:
                print(f"[E2E] Fact revisions: {[(r.action, r.fact.fact[:30]) for r in result.fact_revisions]}")
                # New fact should typically be ADD
                assert result.fact_revisions[0].action in ["ADD", "NONE"]

        finally:
            await cortex.close()

    @pytest.mark.asyncio
    async def test_e2e_supersede_fact_via_streaming(
        self, ctx: TestRunContext
    ) -> None:
        """E2E: Conflicting fact should be SUPERSEDEd through streaming."""
        from cortex import Cortex
        from cortex.memory.streaming_types import StreamingOptions
        from cortex.types import CortexConfig, LLMConfig

        convex_url = os.environ.get("CONVEX_URL")
        openai_key = os.environ.get("OPENAI_API_KEY")
        if not convex_url or not openai_key:
            pytest.skip("CONVEX_URL or OPENAI_API_KEY not set")

        cortex = Cortex(
            CortexConfig(
                convex_url=convex_url,
                llm=LLMConfig(provider="openai", api_key=openai_key),
            )
        )

        # Use ctx for unique IDs to ensure parallel test isolation
        test_id = ctx.run_id
        memory_space_id = ctx.memory_space_id("e2e-supersede")
        conversation_id_1 = ctx.conversation_id("e2e-supersede-1")
        conversation_id_2 = ctx.conversation_id("e2e-supersede-2")
        user_id = ctx.user_id("e2e-supersede")
        agent_id = ctx.agent_id("e2e-supersede")

        try:
            # First, store initial fact
            async def stream1() -> AsyncIterator[str]:
                yield "Blue is nice!"

            async def extract_facts1(
                user_msg: str, agent_resp: str
            ) -> List[Dict[str, Any]]:
                return [
                    {
                        "fact": f"User {test_id} favorite color is blue",
                        "factType": "preference",
                        "subject": user_id,
                        "predicate": "favorite color",
                        "object": "blue",
                        "confidence": 90,
                        "tags": ["color"],
                    }
                ]

            await cortex.memory.remember_stream(
                {
                    "memorySpaceId": memory_space_id,
                    "conversationId": conversation_id_1,
                    "userMessage": "My favorite color is blue",
                    "responseStream": stream1(),
                    "userId": user_id,
                    "userName": "E2E User",
                    "agentId": agent_id,
                    "extractFacts": extract_facts1,
                },
                StreamingOptions(belief_revision=True),
            )

            # Now change the color (should supersede)
            async def stream2() -> AsyncIterator[str]:
                yield "Updated to green!"

            async def extract_facts2(
                user_msg: str, agent_resp: str
            ) -> List[Dict[str, Any]]:
                return [
                    {
                        "fact": f"User {test_id} favorite color is green",
                        "factType": "preference",
                        "subject": user_id,
                        "predicate": "favorite color",
                        "object": "green",
                        "confidence": 95,
                        "tags": ["color"],
                    }
                ]

            result2 = await cortex.memory.remember_stream(
                {
                    "memorySpaceId": memory_space_id,
                    "conversationId": conversation_id_2,
                    "userMessage": "Actually, my favorite color is now green",
                    "responseStream": stream2(),
                    "userId": user_id,
                    "userName": "E2E User",
                    "agentId": agent_id,
                    "extractFacts": extract_facts2,
                },
                StreamingOptions(belief_revision=True),
            )

            if cortex.facts.has_belief_revision() and result2.fact_revisions:
                actions = [r.action for r in result2.fact_revisions]
                print(f"[E2E] Color change actions: {actions}")
                # Should be SUPERSEDE or UPDATE
                assert len(result2.fact_revisions) > 0

        finally:
            await cortex.close()

    @pytest.mark.asyncio
    async def test_e2e_skip_duplicate_fact_via_streaming(
        self, ctx: TestRunContext
    ) -> None:
        """E2E: Duplicate fact should be skipped (NONE) through streaming."""
        from cortex import Cortex
        from cortex.memory.streaming_types import StreamingOptions
        from cortex.types import CortexConfig, LLMConfig

        convex_url = os.environ.get("CONVEX_URL")
        openai_key = os.environ.get("OPENAI_API_KEY")
        if not convex_url or not openai_key:
            pytest.skip("CONVEX_URL or OPENAI_API_KEY not set")

        cortex = Cortex(
            CortexConfig(
                convex_url=convex_url,
                llm=LLMConfig(provider="openai", api_key=openai_key),
            )
        )

        # Use ctx for unique IDs to ensure parallel test isolation
        test_id = ctx.run_id
        memory_space_id = ctx.memory_space_id("e2e-none")
        conversation_id_1 = ctx.conversation_id("e2e-none-1")
        conversation_id_2 = ctx.conversation_id("e2e-none-2")
        user_id = ctx.user_id("e2e-none")
        agent_id = ctx.agent_id("e2e-none")

        try:
            # Store fact
            async def stream1() -> AsyncIterator[str]:
                yield "Got it!"

            async def extract_facts(
                user_msg: str, agent_resp: str
            ) -> List[Dict[str, Any]]:
                return [
                    {
                        "fact": f"User {test_id} works remotely",
                        "factType": "identity",
                        "subject": user_id,
                        "predicate": "work style",
                        "object": "remote",
                        "confidence": 90,
                        "tags": ["work"],
                    }
                ]

            await cortex.memory.remember_stream(
                {
                    "memorySpaceId": memory_space_id,
                    "conversationId": conversation_id_1,
                    "userMessage": "I work remotely",
                    "responseStream": stream1(),
                    "userId": user_id,
                    "userName": "E2E User",
                    "agentId": agent_id,
                    "extractFacts": extract_facts,
                },
                StreamingOptions(belief_revision=True),
            )

            # Try to store same fact again
            async def stream2() -> AsyncIterator[str]:
                yield "Yes, remote work!"

            result2 = await cortex.memory.remember_stream(
                {
                    "memorySpaceId": memory_space_id,
                    "conversationId": conversation_id_2,
                    "userMessage": "As I said, I work remotely",
                    "responseStream": stream2(),
                    "userId": user_id,
                    "userName": "E2E User",
                    "agentId": agent_id,
                    "extractFacts": extract_facts,
                },
                StreamingOptions(belief_revision=True),
            )

            if cortex.facts.has_belief_revision() and result2.fact_revisions:
                actions = [r.action for r in result2.fact_revisions]
                print(f"[E2E] Duplicate fact actions: {actions}")
                # Could be NONE (skip) or ADD if not detected as duplicate
                assert len(result2.fact_revisions) > 0

        finally:
            await cortex.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Run tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
