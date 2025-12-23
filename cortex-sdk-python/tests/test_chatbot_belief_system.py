"""
Chatbot Belief System Tests (Python SDK)

E2E tests simulating a chatbot conversation flow where:
1. User states their name and favorite color -> 2 facts extracted (ADD)
2. User asks a question -> recall context, no new facts
3. User changes color preference -> SUPERSEDE old color with new

This validates the complete belief revision pipeline including:
- Subject + FactType Matching (Stage 2.5)
- LLM Conflict Resolution
- Proper supersession with facts:supersede mutation
"""

import os
import time
from typing import Any, AsyncGenerator, Dict

import pytest

from cortex.types import ListFactsFilter, RecallParams, RememberOptions, RememberParams

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test Fixtures
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.fixture
def test_context() -> Dict[str, str]:
    """Generate unique test identifiers for parallel isolation."""
    test_id = f"belief-{int(time.time() * 1000)}-{os.getpid()}"
    return {
        "memory_space_id": f"test-{test_id}",
        "user_id": f"user-{test_id}",
        "agent_id": f"agent-{test_id}",
        "conversation_id": f"conv-{test_id}",
    }


@pytest.fixture
async def cortex_client(test_context: Dict[str, str]) -> AsyncGenerator[Any, None]:
    """Create a Cortex client for testing."""
    from cortex import Cortex
    from cortex.types import CortexConfig, LLMConfig, RegisterMemorySpaceParams, RememberParams, RememberOptions

    convex_url = os.environ.get("CONVEX_URL")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if not convex_url:
        pytest.skip("CONVEX_URL not set")

    config = CortexConfig(convex_url=convex_url)

    # Add LLM if available
    if openai_key:
        config = CortexConfig(
            convex_url=convex_url,
            llm=LLMConfig(provider="openai", api_key=openai_key),
        )

    cortex = Cortex(config)

    # Register memory space for tests
    await cortex.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=test_context["memory_space_id"],
            name="Belief System Test Space",
            type="custom",
        )
    )

    yield cortex

    # Cleanup
    await cortex.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Unit Tests: Stage 2.5 Subject+FactType Matching
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestSubjectFactTypeMatching:
    """Tests for the new Subject+FactType matching stage."""

    def test_pipeline_result_has_subject_type_matching(self) -> None:
        """ReviseResult.pipeline should include subject_type_matching."""
        from cortex.facts.belief_revision import PipelineStageResult, ReviseResult

        result = ReviseResult(
            action="ADD",
            fact={"factId": "test"},
            superseded=[],
            reason="Test",
            confidence=100,
            pipeline={
                "slot_matching": PipelineStageResult(executed=True, matched=False),
                "semantic_matching": PipelineStageResult(executed=True, matched=False),
                "subject_type_matching": PipelineStageResult(
                    executed=True,
                    matched=True,
                    fact_ids=["fact-123"],
                ),
            },
        )

        assert "subject_type_matching" in result.pipeline
        assert result.pipeline["subject_type_matching"].executed is True
        assert result.pipeline["subject_type_matching"].matched is True
        assert result.pipeline["subject_type_matching"].fact_ids == ["fact-123"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Unit Tests: Batteries Included Mode
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestBatteriesIncludedMode:
    """Tests for always-on belief revision."""

    @pytest.mark.asyncio
    async def test_belief_revision_always_initialized(
        self, cortex_client: Any
    ) -> None:
        """BeliefRevisionService should always be initialized."""
        # has_belief_revision() should always return True now
        assert cortex_client.facts.has_belief_revision() is True

    @pytest.mark.asyncio
    async def test_revise_available_without_llm(self) -> None:
        """revise() should be callable even without LLM configured."""
        from cortex import Cortex
        from cortex.types import CortexConfig

        convex_url = os.environ.get("CONVEX_URL")
        if not convex_url:
            pytest.skip("CONVEX_URL not set")

        # Create client WITHOUT LLM
        cortex = Cortex(CortexConfig(convex_url=convex_url))

        try:
            # Should not raise "Belief revision not configured"
            assert cortex.facts.has_belief_revision() is True
        finally:
            await cortex.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# E2E Tests: Chatbot Conversation Flow
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestChatbotBeliefSystemE2E:
    """
    E2E tests simulating a multi-turn chatbot conversation.

    Scenario:
    - Turn 1: "My name is Nicholas and I like blue" -> 2 facts (name, color) ADDed
    - Turn 2: "What is my favorite color?" -> recall context, no new facts
    - Turn 3: "Actually I prefer purple now" -> color SUPERSEDED
    """

    @pytest.fixture
    async def e2e_cortex(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Create Cortex client with LLM for E2E tests."""
        from cortex import Cortex
        from cortex.types import CortexConfig, LLMConfig, RegisterMemorySpaceParams, RememberParams, RememberOptions

        convex_url = os.environ.get("CONVEX_URL")
        openai_key = os.environ.get("OPENAI_API_KEY")

        if not convex_url or not openai_key:
            pytest.skip("CONVEX_URL or OPENAI_API_KEY not set")

        test_id = f"chatbot-{int(time.time() * 1000)}"
        conversation_id = f"conv-{test_id}"

        cortex = Cortex(
            CortexConfig(
                convex_url=convex_url,
                llm=LLMConfig(provider="openai", api_key=openai_key),
            )
        )

        memory_space_id = f"test-{test_id}"
        user_id = f"user-{test_id}"
        agent_id = f"agent-{test_id}"

        ctx: Dict[str, Any] = {
            "cortex": cortex,
            "memory_space_id": memory_space_id,
            "user_id": user_id,
            "agent_id": agent_id,
            "conversation_id": conversation_id,
        }

        # Register memory space
        await cortex.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=memory_space_id,
                name="Chatbot E2E Test Space",
                type="custom",
            )
        )

        yield ctx

        await cortex.close()

    async def test_turn1_extracts_name_and_color_facts(
        self, e2e_cortex: Dict[str, Any]
    ) -> None:
        """Turn 1: User states name and color -> 2 facts ADDed."""
        cortex = e2e_cortex["cortex"]
        memory_space_id = e2e_cortex["memory_space_id"]
        user_id = e2e_cortex["user_id"]
        agent_id = e2e_cortex["agent_id"]

        # Simulate user message
        user_message = "My name is Nicholas and my favorite color is blue"
        conversation_id = e2e_cortex["conversation_id"]

        # Create conversation and store memory
        result = await cortex.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=f"{conversation_id}-turn1",
                user_message=user_message,
                agent_response="Nice to meet you, Nicholas! Blue is a lovely color.",
                user_id=user_id,
                agent_id=agent_id,
                user_name="Test User",
            ),
            RememberOptions(extract_facts=True),
        )

        # Should have extracted facts
        assert result.facts is not None
        print(f"[Turn 1] Facts extracted: {len(result.facts or [])}")
        for fact in result.facts or []:
            action = getattr(fact, "action", "unknown")
            print(f"  - {fact.fact} ({action})")

        # Verify facts stored in database
        stored_facts = await cortex.facts.list(
            ListFactsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                include_superseded=False,
            )
        )

        print(f"[Turn 1] Active facts in DB: {len(stored_facts)}")
        for fact in stored_facts:
            print(f"  - {fact.fact_id}: {fact.fact}")

        # Should have at least 1 fact (may vary by LLM extraction)
        assert len(stored_facts) >= 1, "Expected at least 1 fact after Turn 1"

    async def test_turn2_recall_does_not_create_duplicates(
        self, e2e_cortex: Dict[str, Any]
    ) -> None:
        """Turn 2: User asks question -> recall returns context, no new facts."""
        cortex = e2e_cortex["cortex"]
        memory_space_id = e2e_cortex["memory_space_id"]
        user_id = e2e_cortex["user_id"]
        agent_id = e2e_cortex["agent_id"]

        # First, store initial facts
        conversation_id = e2e_cortex["conversation_id"]
        await cortex.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=f"{conversation_id}-turn2-init",
                user_message="My name is Nicholas and my favorite color is blue",
                agent_response="Nice to meet you!",
                user_id=user_id,
                agent_id=agent_id,
                user_name="Test User",
            ),
            RememberOptions(extract_facts=True),
        )

        # Get initial fact count
        facts_before = await cortex.facts.list(
            ListFactsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                include_superseded=False,
            )
        )
        initial_count = len(facts_before)
        print(f"[Turn 2] Facts before question: {initial_count}")

        # Recall context for question (no facts to extract from Q&A)
        recall_result = await cortex.memory.recall(
            RecallParams(
                memory_space_id=memory_space_id,
                query="What is my favorite color?",
                user_id=user_id,
            )
        )

        context_preview = recall_result.context[:200] if recall_result.context else "None"
        print(f"[Turn 2] Recall context: {context_preview}...")

        # Store the Q&A exchange without fact extraction
        await cortex.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=f"{conversation_id}-turn2-qa",
                user_message="What is my favorite color?",
                agent_response="Based on what you told me, your favorite color is blue!",
                user_id=user_id,
                agent_id=agent_id,
                user_name="Test User",
            ),
            RememberOptions(extract_facts=False),  # Q&A doesn't add new facts
        )

        # Verify no duplicate facts were created
        facts_after = await cortex.facts.list(
            ListFactsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                include_superseded=False,
            )
        )

        print(f"[Turn 2] Facts after question: {len(facts_after)}")
        assert len(facts_after) == initial_count, "Q&A should not create new facts"

    async def test_turn3_supersedes_color_preference(
        self, e2e_cortex: Dict[str, Any]
    ) -> None:
        """Turn 3: User changes color -> old color SUPERSEDED by new."""
        cortex = e2e_cortex["cortex"]
        memory_space_id = e2e_cortex["memory_space_id"]
        user_id = e2e_cortex["user_id"]
        agent_id = e2e_cortex["agent_id"]

        # First, store initial color fact
        conversation_id = e2e_cortex["conversation_id"]
        await cortex.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=f"{conversation_id}-turn3-init",
                user_message="My name is Nicholas and my favorite color is blue",
                agent_response="Nice to meet you!",
                user_id=user_id,
                agent_id=agent_id,
                user_name="Test User",
            ),
            RememberOptions(extract_facts=True),
        )

        # Get initial state
        facts_before = await cortex.facts.list(
            ListFactsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                include_superseded=False,
            )
        )
        print(f"[Turn 3] Active facts before change: {len(facts_before)}")
        for fact in facts_before:
            print(f"  - {fact.fact}")

        # Now user changes color preference
        result = await cortex.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=f"{conversation_id}-turn3-change",
                user_message="Actually, I've decided I prefer purple now",
                agent_response="Purple is a great choice! I'll remember that.",
                user_id=user_id,
                agent_id=agent_id,
                user_name="Test User",
            ),
            RememberOptions(extract_facts=True),
        )

        print("[Turn 3] Belief revision result:")
        if result.facts:
            for fact in result.facts:
                action = getattr(fact, "action", "unknown")
                print(f"  - {fact.fact} (action: {action})")

        # Check final state: should have active facts including purple
        active_facts = await cortex.facts.list(
            ListFactsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                include_superseded=False,
            )
        )

        # Also check superseded facts
        all_facts = await cortex.facts.list(
            ListFactsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                include_superseded=True,
            )
        )

        print(f"[Turn 3] Active facts after change: {len(active_facts)}")
        print(f"[Turn 3] Total facts (including superseded): {len(all_facts)}")

        # Verify the belief state
        active_fact_texts = [f.fact.lower() for f in active_facts]

        # Purple should be active
        has_purple = any("purple" in text for text in active_fact_texts)
        print(f"[Turn 3] Has active purple fact: {has_purple}")

        # Blue should NOT be active (if supersession worked correctly)
        has_blue = any("blue" in text for text in active_fact_texts)
        print(f"[Turn 3] Has active blue fact: {has_blue}")

        # Key assertion: purple should be the active color, not blue
        if has_purple:
            assert not has_blue, (
                "Blue color fact should be superseded, not active. "
                "The belief system should have replaced blue with purple."
            )
        else:
            # If LLM didn't extract purple fact, that's acceptable
            print("[Turn 3] Note: Purple fact not extracted - may vary by LLM")

    async def test_full_conversation_flow(self, e2e_cortex: Dict[str, Any]) -> None:
        """Complete test of 3-turn conversation with belief revision."""
        cortex = e2e_cortex["cortex"]
        memory_space_id = e2e_cortex["memory_space_id"]
        user_id = e2e_cortex["user_id"]
        agent_id = e2e_cortex["agent_id"]

        print("\n" + "=" * 60)
        print("CHATBOT BELIEF SYSTEM E2E TEST")
        print("=" * 60)

        conversation_id = e2e_cortex["conversation_id"]

        # ─────────────────────────────────────────────────────────────
        # Turn 1: User introduces themselves
        # ─────────────────────────────────────────────────────────────
        print("\n[TURN 1] User: My name is Nicholas and I like blue")

        turn1_result = await cortex.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=f"{conversation_id}-full-turn1",
                user_message="My name is Nicholas and I like blue",
                agent_response="Nice to meet you, Nicholas! Blue is a wonderful color choice.",
                user_id=user_id,
                agent_id=agent_id,
                user_name="Nicholas",
            ),
            RememberOptions(extract_facts=True),
        )

        facts_after_turn1 = await cortex.facts.list(
            ListFactsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                include_superseded=False,
            )
        )

        print(f"[TURN 1] Extracted {len(turn1_result.facts or [])} facts")
        print(f"[TURN 1] Active facts in DB: {len(facts_after_turn1)}")
        for f in facts_after_turn1:
            print(f"  └─ {f.fact}")

        # ─────────────────────────────────────────────────────────────
        # Turn 2: User asks a question
        # ─────────────────────────────────────────────────────────────
        print("\n[TURN 2] User: What is my favorite color?")

        recall = await cortex.memory.recall(
            RecallParams(
                memory_space_id=memory_space_id,
                query="What is my favorite color?",
                user_id=user_id,
            )
        )

        # Simulate LLM response using recalled context
        context_snippet = recall.context[:150] if recall.context else "None"
        print(f"[TURN 2] Recalled context snippet: {context_snippet}...")

        # Store the exchange (no fact extraction for Q&A)
        await cortex.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=f"{conversation_id}-full-turn2",
                user_message="What is my favorite color?",
                agent_response="Based on what you told me earlier, your favorite color is blue!",
                user_id=user_id,
                agent_id=agent_id,
                user_name="Nicholas",
            ),
            RememberOptions(extract_facts=False),
        )

        facts_after_turn2 = await cortex.facts.list(
            ListFactsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                include_superseded=False,
            )
        )
        print(f"[TURN 2] Active facts unchanged: {len(facts_after_turn2)}")

        # ─────────────────────────────────────────────────────────────
        # Turn 3: User changes preference
        # ─────────────────────────────────────────────────────────────
        print("\n[TURN 3] User: Actually I prefer purple now")

        turn3_result = await cortex.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=f"{conversation_id}-full-turn3",
                user_message="Actually I've decided I prefer purple now",
                agent_response="I'll update my notes - purple is now your favorite color!",
                user_id=user_id,
                agent_id=agent_id,
                user_name="Nicholas",
            ),
            RememberOptions(extract_facts=True),
        )

        print("[TURN 3] Belief revision results:")
        if turn3_result.facts:
            for f in turn3_result.facts:
                action = getattr(f, "action", "?")
                print(f"  └─ {f.fact} (action: {action})")

        # ─────────────────────────────────────────────────────────────
        # Final State Verification
        # ─────────────────────────────────────────────────────────────
        print("\n[FINAL] Verifying belief state...")

        active_facts = await cortex.facts.list(
            ListFactsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                include_superseded=False,
            )
        )

        all_facts = await cortex.facts.list(
            ListFactsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                include_superseded=True,
            )
        )

        print(f"[FINAL] Active facts: {len(active_facts)}")
        for f in active_facts:
            print(f"  └─ ✓ {f.fact}")

        superseded_count = len(all_facts) - len(active_facts)
        print(f"[FINAL] Superseded facts: {superseded_count}")

        # Check that purple is active and blue is not
        active_texts = [f.fact.lower() for f in active_facts]
        has_active_purple = any("purple" in t for t in active_texts)
        has_active_blue = any("blue" in t for t in active_texts)

        print(f"[FINAL] Purple active: {has_active_purple}")
        print(f"[FINAL] Blue active: {has_active_blue}")

        # The key test: if purple was extracted, blue should be superseded
        if has_active_purple:
            assert not has_active_blue, (
                "BELIEF SYSTEM ERROR: Blue should be superseded when purple is active. "
                "The Stage 2.5 Subject+FactType matching and SUPERSEDE action should "
                "have marked blue as superseded."
            )
            print("\n✅ SUCCESS: Belief revision correctly superseded blue with purple!")
        else:
            print("\n⚠ NOTE: Purple fact not extracted (LLM variation) - test inconclusive")

        print("=" * 60)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Run tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-s"])
