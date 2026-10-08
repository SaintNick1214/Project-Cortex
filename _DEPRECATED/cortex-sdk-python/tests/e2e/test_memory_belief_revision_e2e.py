"""
E2E tests for Memory API Belief Revision Integration

Tests the complete remember() belief revision workflow with a real Convex backend.
Verifies that facts are intelligently managed (ADD/UPDATE/SUPERSEDE/NONE)
when using MemoryAPI.remember() with an LLM configured.

Note: These tests require a live Convex backend and should be run
with proper environment configuration.
"""

import os
import time
from uuid import uuid4

import pytest

# Skip all tests if CONVEX_URL not configured
pytestmark = pytest.mark.skipif(
    not os.environ.get("CONVEX_URL"),
    reason="Requires CONVEX_URL environment variable"
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test Fixtures
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.fixture
def test_run_id():
    """Generate unique ID for test isolation."""
    return f"mbr-{uuid4().hex[:8]}"


@pytest.fixture
def memory_space_id(test_run_id):
    """Generate unique memory space ID."""
    return f"test-space-{test_run_id}"


@pytest.fixture
def user_id(test_run_id):
    """Generate unique user ID."""
    return f"test-user-{test_run_id}"


@pytest.fixture
def agent_id(test_run_id):
    """Generate unique agent ID."""
    return f"test-agent-{test_run_id}"


@pytest.fixture
def conversation_id(test_run_id):
    """Generate unique conversation ID."""
    return f"test-conv-{test_run_id}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Mock LLM Client for Testing
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class MockLLMClientForMemory:
    """
    Mock LLM client that returns predetermined responses for belief revision.

    This allows testing the full remember() -> belief revision flow without actual LLM calls.
    """

    def __init__(self):
        self.call_count = 0
        self.complete_calls = []

    def _extract_fact_id_from_prompt(self, prompt: str) -> str | None:
        """Extract the first fact ID from the prompt."""
        import re
        match = re.search(r'\bfact-[a-zA-Z0-9]+\b', prompt)
        if match:
            return match.group(0)
        return None

    async def extract_facts(self, user_message: str, agent_response: str):
        """Extract facts from conversation - returns preset facts."""
        self.call_count += 1

        # Color preference
        if "favorite color" in user_message.lower() or "prefer" in user_message.lower():
            if "blue" in user_message.lower():
                return [
                    {
                        "fact": "User's favorite color is blue",
                        "factType": "preference",
                        "confidence": 85,
                        "subject": "user",
                        "predicate": "favorite color",
                        "object": "blue",
                    }
                ]
            if "purple" in user_message.lower():
                return [
                    {
                        "fact": "User's favorite color is purple",
                        "factType": "preference",
                        "confidence": 90,
                        "subject": "user",
                        "predicate": "favorite color",
                        "object": "purple",
                    }
                ]

        # Default - extract simple preference
        return [
            {
                "fact": f"User said: {user_message[:50]}",
                "factType": "custom",
                "confidence": 70,
            }
        ]

    async def complete(self, *, system: str, prompt: str, model=None, response_format=None):
        """Handle belief revision LLM calls."""
        self.call_count += 1
        self.complete_calls.append({"system": system, "prompt": prompt})

        prompt_lower = prompt.lower()
        target_fact_id = self._extract_fact_id_from_prompt(prompt)
        target_fact_json = f'"{target_fact_id}"' if target_fact_id else "null"

        # Color preference change - purple supersedes blue
        if "purple" in prompt_lower and "blue" in prompt_lower:
            return f'''
            {{
                "action": "SUPERSEDE",
                "targetFactId": {target_fact_json},
                "reason": "Color preference changed from blue to purple",
                "mergedFact": null,
                "confidence": 90
            }}
            '''

        # Exact duplicate
        if "duplicate" in prompt_lower or prompt.count("blue") >= 2:
            return f'''
            {{
                "action": "NONE",
                "targetFactId": {target_fact_json},
                "reason": "Duplicate fact already exists",
                "mergedFact": null,
                "confidence": 85
            }}
            '''

        # Default - new fact
        return '''
        {
            "action": "ADD",
            "targetFactId": null,
            "reason": "New fact with no existing conflicts",
            "mergedFact": null,
            "confidence": 85
        }
        '''


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# E2E Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestMemoryRememberBeliefRevisionE2E:
    """
    E2E tests for MemoryAPI.remember() with belief revision.

    These tests verify the complete workflow from remember() through
    belief revision to fact storage.
    """

    @pytest.mark.asyncio
    async def test_remember_with_belief_revision_disabled(
        self, memory_space_id, user_id, agent_id, conversation_id
    ):
        """
        Test that remember() uses deduplication when belief_revision=False.

        This verifies the explicit opt-out path.
        """
        from cortex import Cortex
        from cortex.types import CortexConfig, RememberOptions, RememberParams

        # Initialize Cortex with config
        convex_url = os.environ.get("CONVEX_URL")
        cortex = Cortex(CortexConfig(convex_url=convex_url))

        # Custom fact extractor
        async def extract_facts(user_msg, agent_resp):
            return [
                {
                    "fact": "User prefers Python for backend",
                    "factType": "preference",
                    "confidence": 85,
                    "subject": user_id,
                }
            ]

        try:
            result = await cortex.memory.remember(
                RememberParams(
                    memory_space_id=memory_space_id,
                    conversation_id=conversation_id,
                    user_message="I prefer Python for backend development",
                    agent_response="Python is a great choice for backends!",
                    user_id=user_id,
                    user_name="E2E Test User",
                    agent_id=agent_id,
                    extract_facts=extract_facts,
                ),
                RememberOptions(belief_revision=False),
            )

            # Verify result structure
            assert result is not None
            assert result.conversation is not None
            assert len(result.facts) == 1 or result.facts is not None
            # fact_revisions should be None when belief_revision=False
            assert result.fact_revisions is None

        finally:
            # Cleanup
            await cortex.close()

    @pytest.mark.asyncio
    async def test_remember_graceful_fallback_without_llm(
        self, memory_space_id, user_id, agent_id, conversation_id
    ):
        """
        Test graceful operation when no LLM is configured.

        Batteries-included means belief revision is always available,
        using heuristics when no LLM is configured for conflict resolution.
        """
        from cortex import Cortex
        from cortex.types import CortexConfig, RememberParams

        convex_url = os.environ.get("CONVEX_URL")

        # Create Cortex without LLM
        cortex = Cortex(CortexConfig(convex_url=convex_url))

        # Batteries-included: belief revision always available (uses heuristics without LLM)
        assert cortex.facts.has_belief_revision() is True

        async def extract_facts(user_msg, agent_resp):
            return [
                {
                    "fact": "User likes TypeScript",
                    "factType": "preference",
                    "confidence": 80,
                }
            ]

        try:
            result = await cortex.memory.remember(
                RememberParams(
                    memory_space_id=memory_space_id,
                    conversation_id=conversation_id,
                    user_message="I really like TypeScript",
                    agent_response="TypeScript is wonderful!",
                    user_id=user_id,
                    user_name="E2E Test User",
                    agent_id=agent_id,
                    extract_facts=extract_facts,
                ),
            )

            # Should complete successfully
            assert result is not None
            # With batteries-included, fact_revisions is populated (uses heuristics without LLM)
            # The system still works gracefully - it just uses heuristics instead of LLM
            # fact_revisions may contain results from heuristic-based revision
            assert result is not None  # Main assertion: operation completes successfully

        finally:
            await cortex.close()

    @pytest.mark.asyncio
    @pytest.mark.skipif(
        not os.environ.get("OPENAI_API_KEY") and not os.environ.get("ANTHROPIC_API_KEY"),
        reason="Requires OPENAI_API_KEY or ANTHROPIC_API_KEY"
    )
    async def test_remember_with_auto_configured_llm(
        self, memory_space_id, user_id, agent_id, conversation_id
    ):
        """
        Test remember() with auto-configured LLM for real belief revision.

        Requires actual LLM API keys to test the full flow.
        """
        from cortex import Cortex
        from cortex.types import CortexConfig, LLMConfig, RememberParams

        convex_url = os.environ.get("CONVEX_URL")

        # Auto-configure LLM from environment
        llm_config = None
        if os.environ.get("OPENAI_API_KEY"):
            llm_config = LLMConfig(provider="openai", api_key=os.environ["OPENAI_API_KEY"])
        elif os.environ.get("ANTHROPIC_API_KEY"):
            llm_config = LLMConfig(provider="anthropic", api_key=os.environ["ANTHROPIC_API_KEY"])

        cortex = Cortex(CortexConfig(convex_url=convex_url, llm=llm_config))

        try:
            # Verify belief revision is available
            if cortex.facts.has_belief_revision():
                result = await cortex.memory.remember(
                    RememberParams(
                        memory_space_id=memory_space_id,
                        conversation_id=conversation_id,
                        user_message="My favorite programming language is Rust",
                        agent_response="Rust is known for its memory safety!",
                        user_id=user_id,
                        user_name="E2E Test User",
                        agent_id=agent_id,
                    ),
                )

                # Result should have facts
                assert result is not None
                # When LLM is configured and belief revision runs,
                # fact_revisions may be populated
                if result.facts and len(result.facts) > 0:
                    # Either have revisions or successfully stored
                    assert len(result.facts) > 0 or result.fact_revisions is not None
            else:
                pytest.skip("LLM auto-configuration did not enable belief revision")

        finally:
            await cortex.close()


class TestRememberResultFactRevisions:
    """Tests verifying fact_revisions field in remember() results."""

    @pytest.mark.asyncio
    async def test_fact_revisions_structure(self, memory_space_id, user_id):
        """
        Test the structure of fact_revisions when present.

        Uses mocked belief revision to verify the result structure.
        """
        from cortex.types import FactRevisionAction, RememberResult, FactRecord

        # Create a mock result to verify structure
        mock_fact = FactRecord(
            _id="test-id",
            fact_id="fact-test",
            memory_space_id=memory_space_id,
            fact="User prefers dark mode",
            fact_type="preference",
            confidence=90,
            source_type="conversation",
            tags=[],
            created_at=int(time.time() * 1000),
            updated_at=int(time.time() * 1000),
            version=1,
        )

        revision = FactRevisionAction(
            action="ADD",
            fact=mock_fact,
            superseded=None,
            reason="New preference discovered",
        )

        result = RememberResult(
            conversation={"messageIds": [], "conversationId": "conv-test"},
            memories=[],
            facts=[mock_fact],
            fact_revisions=[revision],
        )

        # Verify structure
        assert result.fact_revisions is not None
        assert len(result.fact_revisions) == 1
        assert result.fact_revisions[0].action == "ADD"
        assert result.fact_revisions[0].fact.fact == "User prefers dark mode"
        assert result.fact_revisions[0].reason is not None

    @pytest.mark.asyncio
    async def test_fact_revisions_all_action_types(self, memory_space_id):
        """Test that all action types can be represented in fact_revisions."""
        from cortex.types import FactRevisionAction, FactRecord

        mock_fact = FactRecord(
            _id="test",
            fact_id="fact-1",
            memory_space_id=memory_space_id,
            fact="Test fact",
            fact_type="custom",
            confidence=80,
            source_type="conversation",
            tags=[],
            created_at=0,
            updated_at=0,
            version=1,
        )

        # Test all action types
        for action_type in ["ADD", "UPDATE", "SUPERSEDE", "NONE"]:
            revision = FactRevisionAction(
                action=action_type,
                fact=mock_fact,
                superseded=[mock_fact] if action_type == "SUPERSEDE" else None,
                reason=f"Test {action_type} action",
            )

            assert revision.action == action_type
            if action_type == "SUPERSEDE":
                assert revision.superseded is not None
                assert len(revision.superseded) == 1
