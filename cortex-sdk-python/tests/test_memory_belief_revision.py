"""
Unit tests for Memory API Belief Revision Integration

Tests the belief revision integration in MemoryAPI.remember() method.
Verifies that facts are intelligently managed (ADD/UPDATE/SUPERSEDE/NONE)
when an LLM is configured.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any, Dict, List, Optional

from cortex.memory import MemoryAPI
from cortex.facts import FactsAPI
from cortex.facts.belief_revision import (
    BeliefRevisionService,
    ConflictCandidate,
    ReviseParams,
    ReviseResult,
)
from cortex.types import (
    FactRevisionAction,
    LLMConfig,
    MemoryEntry,
    RememberOptions,
    RememberParams,
    RememberResult,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Mock Helpers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class MockConvexClient:
    """Mock Convex client for testing."""

    def __init__(self) -> None:
        self.queries: List[tuple] = []
        self.mutations: List[tuple] = []
        self._conversation_exists = False
        self._memory_space_exists = True
        self._user_exists = True
        self._agent_exists = True
        self._mutation_count = 0

    async def query(self, method: str, args: dict) -> Any:
        self.queries.append((method, args))

        if method == "conversations:get":
            if self._conversation_exists:
                return {
                    "_id": "conv-id-1",
                    "conversationId": args.get("conversationId", "conv-test"),
                    "memorySpaceId": args.get("memorySpaceId", "space-test"),
                    "type": "user-agent",
                    "participants": [],
                    "messages": [],
                    "messageCount": 0,
                    "metadata": {},
                    "createdAt": 1234567890000,
                    "updatedAt": 1234567890000,
                }
            return None
        if method == "memorySpaces:get":
            return {"memorySpaceId": args.get("memorySpaceId")} if self._memory_space_exists else None
        if method == "immutable:get":
            return {"id": args.get("id")} if self._user_exists else None
        if method == "agents:exists":
            return self._agent_exists

        return None

    async def mutation(self, method: str, args: dict) -> Any:
        self.mutations.append((method, args))
        self._mutation_count += 1

        if method == "conversations:addMessage":
            return {
                "messages": [{"id": f"msg-{self._mutation_count}"}],
            }
        if method == "conversations:create":
            return {
                "_id": f"conv-id-{self._mutation_count}",
                "conversationId": args.get("conversationId", "conv-test"),
                "memorySpaceId": args.get("memorySpaceId", "space-test"),
                "type": "user-agent",
                "participants": [],
                "messages": [],
                "messageCount": 0,
                "metadata": {},
                "createdAt": 1234567890000,
                "updatedAt": 1234567890000,
            }
        if method == "memories:store":
            return {
                "memoryId": f"mem-{self._mutation_count}",
                "memorySpaceId": args.get("memorySpaceId"),
                "content": args.get("content"),
                "version": 1,
            }
        if method == "facts:store":
            return {
                "factId": f"fact-{self._mutation_count}",
                "fact": args.get("fact"),
                "factType": args.get("factType", "custom"),
                "confidence": args.get("confidence", 80),
                "memorySpaceId": args.get("memorySpaceId"),
                "sourceType": args.get("sourceType", "conversation"),
                "tags": args.get("tags", []),
                "createdAt": 1234567890,
                "updatedAt": 1234567890,
                "version": 1,
            }
        if method == "facts:storeWithDedup":
            return {
                "status": "stored",
                "fact": {
                    "factId": f"fact-{self._mutation_count}",
                    "fact": args.get("fact"),
                    "factType": args.get("factType", "custom"),
                    "confidence": args.get("confidence", 80),
                    "memorySpaceId": args.get("memorySpaceId"),
                    "sourceType": args.get("sourceType", "conversation"),
                    "tags": args.get("tags", []),
                    "createdAt": 1234567890,
                    "updatedAt": 1234567890,
                    "version": 1,
                }
            }

        return {}


class MockLLMClient:
    """Mock LLM client for fact extraction and belief revision."""

    def __init__(self, facts_response: Optional[List[Dict]] = None, complete_response: Optional[str] = None) -> None:
        self.facts_response = facts_response
        self.complete_response = complete_response or '{"action": "ADD", "targetFactId": null, "reason": "New fact", "mergedFact": null, "confidence": 80}'
        self.extract_calls: List[tuple] = []
        self.complete_calls: List[Dict] = []

    async def extract_facts(self, user_message: str, agent_response: str) -> Optional[List[Dict]]:
        self.extract_calls.append((user_message, agent_response))
        return self.facts_response

    async def complete(
        self,
        *,
        system: str,
        prompt: str,
        model: Optional[str] = None,
        response_format: Optional[str] = None,
    ) -> str:
        self.complete_calls.append({
            "system": system,
            "prompt": prompt,
            "model": model,
            "response_format": response_format,
        })
        return self.complete_response


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# has_belief_revision() Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestHasBeliefRevision:
    """Tests for FactsAPI.has_belief_revision() method."""

    def test_has_belief_revision_true_without_llm(self) -> None:
        """Should return True even without LLM (batteries-included mode uses heuristics)."""
        client = MockConvexClient()
        facts_api = FactsAPI(client)

        # Batteries-included: belief revision always available, uses heuristics without LLM
        assert facts_api.has_belief_revision() is True

    def test_has_belief_revision_true_with_llm(self) -> None:
        """Should return True when LLM client is provided."""
        client = MockConvexClient()
        llm_client = MockLLMClient()
        facts_api = FactsAPI(client, llm_client=llm_client)

        assert facts_api.has_belief_revision() is True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RememberResult Type Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestRememberResultType:
    """Tests for RememberResult type extensions."""

    def test_remember_result_has_fact_revisions_field(self) -> None:
        """RememberResult should have fact_revisions field."""
        result = RememberResult(
            conversation={"messageIds": [], "conversationId": "conv-1"},
            memories=[],
            facts=[],
            fact_revisions=None,
        )
        assert hasattr(result, "fact_revisions")
        assert result.fact_revisions is None

    def test_remember_result_with_fact_revisions(self) -> None:
        """RememberResult should accept fact_revisions."""
        from cortex.types import FactRecord

        mock_fact = FactRecord(
            _id="test",
            fact_id="fact-1",
            memory_space_id="space-1",
            fact="User prefers blue",
            fact_type="preference",
            confidence=90,
            source_type="conversation",
            tags=[],
            created_at=0,
            updated_at=0,
            version=1,
        )

        revision = FactRevisionAction(
            action="ADD",
            fact=mock_fact,
            superseded=None,
            reason="New preference",
        )

        result = RememberResult(
            conversation={"messageIds": [], "conversationId": "conv-1"},
            memories=[],
            facts=[mock_fact],
            fact_revisions=[revision],
        )

        assert result.fact_revisions is not None
        assert len(result.fact_revisions) == 1
        assert result.fact_revisions[0].action == "ADD"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RememberOptions Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestRememberOptions:
    """Tests for RememberOptions belief_revision field."""

    def test_remember_options_has_belief_revision_field(self) -> None:
        """RememberOptions should have belief_revision field."""
        opts = RememberOptions()
        assert hasattr(opts, "belief_revision")

    def test_remember_options_belief_revision_default_none(self) -> None:
        """belief_revision should default to None (auto-detect)."""
        opts = RememberOptions()
        assert opts.belief_revision is None

    def test_remember_options_belief_revision_explicit_false(self) -> None:
        """belief_revision can be explicitly set to False."""
        opts = RememberOptions(belief_revision=False)
        assert opts.belief_revision is False

    def test_remember_options_belief_revision_explicit_true(self) -> None:
        """belief_revision can be explicitly set to True."""
        opts = RememberOptions(belief_revision=True)
        assert opts.belief_revision is True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FactRevisionAction Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestFactRevisionAction:
    """Tests for FactRevisionAction type."""

    def test_fact_revision_action_add(self) -> None:
        """FactRevisionAction should support ADD action."""
        from cortex.types import FactRecord

        mock_fact = FactRecord(
            _id="test",
            fact_id="fact-1",
            memory_space_id="space-1",
            fact="User likes pizza",
            fact_type="preference",
            confidence=85,
            source_type="conversation",
            tags=[],
            created_at=0,
            updated_at=0,
            version=1,
        )

        action = FactRevisionAction(
            action="ADD",
            fact=mock_fact,
            reason="First mention of food preference",
        )

        assert action.action == "ADD"
        assert action.fact.fact == "User likes pizza"
        assert action.superseded is None
        assert action.reason == "First mention of food preference"

    def test_fact_revision_action_update(self) -> None:
        """FactRevisionAction should support UPDATE action."""
        from cortex.types import FactRecord

        mock_fact = FactRecord(
            _id="test",
            fact_id="fact-1",
            memory_space_id="space-1",
            fact="User likes pizza, especially pepperoni",
            fact_type="preference",
            confidence=90,
            source_type="conversation",
            tags=[],
            created_at=0,
            updated_at=0,
            version=2,
        )

        action = FactRevisionAction(
            action="UPDATE",
            fact=mock_fact,
            reason="Refined with more detail",
        )

        assert action.action == "UPDATE"
        assert "pepperoni" in action.fact.fact

    def test_fact_revision_action_supersede(self) -> None:
        """FactRevisionAction should support SUPERSEDE action."""
        from cortex.types import FactRecord

        old_fact = FactRecord(
            _id="old",
            fact_id="fact-old",
            memory_space_id="space-1",
            fact="User lives in NYC",
            fact_type="identity",
            confidence=85,
            source_type="conversation",
            tags=[],
            created_at=0,
            updated_at=0,
            version=1,
        )

        new_fact = FactRecord(
            _id="new",
            fact_id="fact-new",
            memory_space_id="space-1",
            fact="User lives in San Francisco",
            fact_type="identity",
            confidence=95,
            source_type="conversation",
            tags=[],
            created_at=0,
            updated_at=0,
            version=1,
        )

        action = FactRevisionAction(
            action="SUPERSEDE",
            fact=new_fact,
            superseded=[old_fact],
            reason="User relocated",
        )

        assert action.action == "SUPERSEDE"
        assert action.superseded is not None
        assert len(action.superseded) == 1
        assert action.superseded[0].fact == "User lives in NYC"

    def test_fact_revision_action_none(self) -> None:
        """FactRevisionAction should support NONE action (skip)."""
        from cortex.types import FactRecord

        mock_fact = FactRecord(
            _id="test",
            fact_id="fact-existing",
            memory_space_id="space-1",
            fact="User likes blue",
            fact_type="preference",
            confidence=90,
            source_type="conversation",
            tags=[],
            created_at=0,
            updated_at=0,
            version=1,
        )

        action = FactRevisionAction(
            action="NONE",
            fact=mock_fact,
            reason="Duplicate of existing fact",
        )

        assert action.action == "NONE"
        assert action.reason == "Duplicate of existing fact"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Memory API Integration Tests (Unit-style with mocks)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestMemoryAPIBeliefRevisionPath:
    """Tests for belief revision path in MemoryAPI.remember()."""

    def test_memory_api_has_belief_revision_true_without_llm(self) -> None:
        """MemoryAPI.facts.has_belief_revision() should be True (batteries-included)."""
        client = MockConvexClient()
        memory_api = MemoryAPI(client)

        # Batteries-included: belief revision always available, uses heuristics without LLM
        assert memory_api.facts.has_belief_revision() is True

    def test_memory_api_has_belief_revision_true_with_llm(self) -> None:
        """MemoryAPI.facts.has_belief_revision() should be True with LLM."""
        from cortex.types import LLMConfig

        client = MockConvexClient()
        llm_config = LLMConfig(provider="openai", api_key="test-key")

        # Create MemoryAPI with LLM config
        memory_api = MemoryAPI(client, llm_config=llm_config)

        # Should have belief revision available
        assert memory_api.facts.has_belief_revision() is True

    def test_remember_options_respected(self) -> None:
        """belief_revision option in RememberOptions should control behavior."""
        # Test explicit False
        opts_disabled = RememberOptions(belief_revision=False)
        assert opts_disabled.belief_revision is False

        # Test explicit True
        opts_enabled = RememberOptions(belief_revision=True)
        assert opts_enabled.belief_revision is True

        # Test default None (auto-detect)
        opts_default = RememberOptions()
        assert opts_default.belief_revision is None

    def test_belief_revision_default_on_with_llm(self) -> None:
        """
        Belief revision should be ON by default when LLM is configured.

        This tests the 'batteries-included' philosophy.
        """
        from cortex.types import LLMConfig

        client = MockConvexClient()
        llm_config = LLMConfig(provider="openai", api_key="test-key")
        memory_api = MemoryAPI(client, llm_config=llm_config)

        # LLM is configured
        assert memory_api.facts.has_belief_revision() is True

        # Default options should use belief revision (None means auto-detect -> True)
        opts = RememberOptions()
        assert opts.belief_revision is None  # None = auto-detect

        # With belief_revision=None and LLM configured, revision should be used
        # The logic: opts.belief_revision is not False AND has_belief_revision() == True
        use_belief_revision = (
            opts.belief_revision is not False
            and memory_api.facts.has_belief_revision()
        )
        assert use_belief_revision is True


class TestMemoryAPIDeduplicationFallback:
    """Tests for deduplication fallback when belief revision explicitly disabled."""

    def test_graceful_fallback_detection(self) -> None:
        """Should detect when to fall back to deduplication via explicit opt-out."""
        client = MockConvexClient()
        memory_api = MemoryAPI(client)

        # Batteries-included: belief revision always available
        assert memory_api.facts.has_belief_revision() is True

        # With explicit belief_revision=False (user opt-out)
        opts_disabled = RememberOptions(belief_revision=False)

        # Default options use belief revision (batteries-included)
        opts_default = RememberOptions()

        # Logic from remember():
        # use_belief_revision = opts.belief_revision is not False AND has_belief_revision()
        use_with_disabled = (
            opts_disabled.belief_revision is not False
            and memory_api.facts.has_belief_revision()
        )
        use_with_default = (
            opts_default.belief_revision is not False
            and memory_api.facts.has_belief_revision()
        )

        # Disabled: False (explicit opt-out), Default: True (batteries-included)
        assert use_with_disabled is False  # User explicitly disabled
        assert use_with_default is True  # Batteries-included: default to revision

    def test_explicit_disable_overrides_llm(self) -> None:
        """
        Explicitly setting belief_revision=False should disable it
        even when LLM is configured.
        """
        from cortex.types import LLMConfig

        client = MockConvexClient()
        llm_config = LLMConfig(provider="openai", api_key="test-key")
        memory_api = MemoryAPI(client, llm_config=llm_config)

        # LLM is configured
        assert memory_api.facts.has_belief_revision() is True

        # But user explicitly disables belief revision
        opts = RememberOptions(belief_revision=False)

        # Logic from remember():
        use_belief_revision = (
            opts.belief_revision is not False
            and memory_api.facts.has_belief_revision()
        )

        # Should NOT use belief revision because explicitly disabled
        assert use_belief_revision is False
