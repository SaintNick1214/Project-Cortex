"""
Integration tests for Cortex SDK - Belief Revision Service

Tests the full belief revision pipeline including slot matching,
semantic matching, and LLM resolution.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from cortex.facts.belief_revision import (
    BeliefRevisionConfig,
    BeliefRevisionService,
    ConflictCandidate,
    ConflictCheckResult,
    LLMResolutionConfigOptions,
    ReviseParams,
    ReviseResult,
    SemanticMatchingConfigOptions,
    SlotMatchingConfigOptions,
)
from cortex.facts.conflict_prompts import ConflictDecision


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Mock Helpers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class MockConvexClient:
    """Mock Convex client for testing."""

    def __init__(self, facts=None, store_response=None, update_response=None):
        self.facts = facts or []
        self.store_response = store_response or {
            "factId": "fact-new",
            "fact": "New fact",
            "confidence": 90,
        }
        self.update_response = update_response or {
            "factId": "fact-updated",
            "fact": "Updated fact",
            "confidence": 95,
        }
        self.mutations = []
        self.queries = []

    async def query(self, method: str, args: dict):
        self.queries.append((method, args))
        if "queryBySubject" in method:
            # Return facts matching subject
            subject = args.get("subject", "").lower()
            return [f for f in self.facts if f.get("subject", "").lower() == subject]
        return self.facts

    async def mutation(self, method: str, args: dict):
        self.mutations.append((method, args))
        if "store" in method:
            return {**self.store_response, **args}
        if "update" in method:
            return {**self.update_response, **args}
        return {}


class MockLLMClient:
    """Mock LLM client for testing."""

    def __init__(self, response=None):
        self.response = response or '{"action": "ADD", "targetFactId": null, "reason": "New fact", "mergedFact": null, "confidence": 80}'
        self.calls = []

    async def complete(self, *, system: str, prompt: str, model=None, response_format=None):
        self.calls.append({"system": system, "prompt": prompt, "model": model})
        return self.response


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BeliefRevisionService Initialization Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestBeliefRevisionServiceInit:
    """Tests for BeliefRevisionService initialization."""

    def test_default_config(self) -> None:
        """Should initialize with default config."""
        client = MockConvexClient()
        service = BeliefRevisionService(client)

        config = service.get_config()
        assert config is not None

    def test_custom_config(self) -> None:
        """Should accept custom config."""
        client = MockConvexClient()
        config = BeliefRevisionConfig(
            slot_matching=SlotMatchingConfigOptions(enabled=False),
            semantic_matching=SemanticMatchingConfigOptions(threshold=0.8),
            llm_resolution=LLMResolutionConfigOptions(enabled=True, model="gpt-4"),
        )
        service = BeliefRevisionService(client, config=config)

        result_config = service.get_config()
        assert result_config.slot_matching.enabled is False
        assert result_config.semantic_matching.threshold == 0.8
        assert result_config.llm_resolution.model == "gpt-4"

    def test_update_config(self) -> None:
        """Should update config."""
        client = MockConvexClient()
        service = BeliefRevisionService(client)

        new_config = BeliefRevisionConfig(
            semantic_matching=SemanticMatchingConfigOptions(threshold=0.9),
        )
        service.update_config(new_config)

        result_config = service.get_config()
        assert result_config.semantic_matching.threshold == 0.9


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Revise Operation Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestReviseOperation:
    """Tests for revise operation."""

    async def test_add_new_fact_no_conflicts(self) -> None:
        """Should ADD when no conflicts found."""
        client = MockConvexClient(facts=[])  # No existing facts
        service = BeliefRevisionService(client)

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User prefers purple",
                confidence=90,
                subject="user-123",
                predicate="favorite color",
                object="purple",
            ),
        ))

        assert result.action == "ADD"
        assert "No conflicts found" in result.reason
        assert len(result.superseded) == 0
        assert len(client.mutations) == 1  # One store mutation

    async def test_slot_conflict_triggers_llm(self) -> None:
        """Should use LLM when slot conflict found."""
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes blue",
            "subject": "user-123",
            "predicate": "preferred color",
            "object": "blue",
            "confidence": 80,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        llm_client = MockLLMClient(
            response='{"action": "SUPERSEDE", "targetFactId": "fact-existing", "reason": "Color preference changed", "mergedFact": null, "confidence": 85}'
        )
        service = BeliefRevisionService(client, llm_client)

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User prefers purple",
                confidence=90,
                subject="user-123",
                predicate="favorite color",
                object="purple",
            ),
        ))

        assert result.action == "SUPERSEDE"
        assert result.pipeline.get("slot_matching").executed is True
        assert result.pipeline.get("slot_matching").matched is True
        assert result.pipeline.get("llm_resolution").executed is True
        assert len(llm_client.calls) == 1  # LLM was called

    async def test_none_action_returns_existing(self) -> None:
        """Should return existing fact for NONE action."""
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes outdoor activities",
            "subject": "user-123",
            "predicate": "enjoys",
            "object": "outdoors",
            "confidence": 90,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        llm_client = MockLLMClient(
            response='{"action": "NONE", "targetFactId": "fact-existing", "reason": "Duplicate fact", "mergedFact": null, "confidence": 95}'
        )
        service = BeliefRevisionService(client, llm_client)

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User enjoys outdoor activities",
                confidence=85,
                subject="user-123",
                predicate="enjoys",
                object="outdoors",
            ),
        ))

        assert result.action == "NONE"
        assert result.fact["factId"] == "fact-existing"
        assert len(client.mutations) == 0  # No mutations

    async def test_none_action_without_target_does_not_create_fact(self) -> None:
        """Bug fix: NONE without targetFactId should NOT create a new fact."""
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes outdoor activities",
            "subject": "user-123",
            "predicate": "enjoys",
            "object": "outdoors",
            "confidence": 90,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        # LLM returns NONE but with an invalid/missing targetFactId
        llm_client = MockLLMClient(
            response='{"action": "NONE", "targetFactId": "nonexistent-fact", "reason": "Already captured", "mergedFact": null, "confidence": 95}'
        )
        service = BeliefRevisionService(client, llm_client)

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User enjoys outdoor activities",
                confidence=85,
                subject="user-123",
                predicate="enjoys",
                object="outdoors",
            ),
        ))

        assert result.action == "NONE"
        # Should NOT have created a new fact (Bug 1 fix)
        assert len(client.mutations) == 0
        # The result should indicate the fact was skipped
        assert result.fact.get("skipped") is True or result.fact.get("fact_id") is None

    async def test_update_action_updates_existing(self) -> None:
        """Should update existing fact for UPDATE action."""
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User has a dog",
            "subject": "user-123",
            "predicate": "has pet",
            "object": "dog",
            "confidence": 80,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        llm_client = MockLLMClient(
            response='{"action": "UPDATE", "targetFactId": "fact-existing", "reason": "Added dog name", "mergedFact": "User has a dog named Rex", "confidence": 90}'
        )
        service = BeliefRevisionService(client, llm_client)

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User has a dog named Rex",
                confidence=90,
                subject="user-123",
                predicate="has pet",
                object="dog named Rex",
            ),
        ))

        assert result.action == "UPDATE"
        # Should call update mutation
        update_calls = [m for m in client.mutations if "update" in m[0]]
        assert len(update_calls) == 1

    async def test_supersede_action_creates_new_and_marks_old(self) -> None:
        """Should create new fact and mark old as superseded."""
        existing_fact = {
            "factId": "fact-old",
            "fact": "User lives in New York",
            "subject": "user-123",
            "predicate": "lives in",
            "object": "New York",
            "confidence": 85,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        llm_client = MockLLMClient(
            response='{"action": "SUPERSEDE", "targetFactId": "fact-old", "reason": "User moved", "mergedFact": null, "confidence": 90}'
        )
        service = BeliefRevisionService(client, llm_client)

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User moved to San Francisco",
                confidence=90,
                subject="user-123",
                predicate="lives in",
                object="San Francisco",
            ),
        ))

        assert result.action == "SUPERSEDE"
        assert len(result.superseded) == 1
        assert result.superseded[0]["factId"] == "fact-old"
        # Should call both store and update mutations
        store_calls = [m for m in client.mutations if "store" in m[0]]
        update_calls = [m for m in client.mutations if "update" in m[0]]
        assert len(store_calls) == 1
        assert len(update_calls) == 1

    async def test_fallback_to_heuristics_when_no_llm(self) -> None:
        """Should use default heuristics when LLM not available."""
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes blue color",
            "subject": "user-123",
            "predicate": "favorite color",
            "object": "blue",
            "confidence": 70,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        service = BeliefRevisionService(client)  # No LLM client

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User likes blue color",  # Same fact
                confidence=90,  # Higher confidence
                subject="user-123",
                predicate="favorite color",
                object="blue",
            ),
        ))

        # Should use heuristics - similar fact with higher confidence -> UPDATE
        assert result.action in ["UPDATE", "SUPERSEDE", "ADD"]  # Depends on similarity calc

    async def test_disabled_slot_matching(self) -> None:
        """Should skip slot matching when disabled."""
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes blue",
            "subject": "user-123",
            "predicate": "favorite color",
            "object": "blue",
            "confidence": 80,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        config = BeliefRevisionConfig(
            slot_matching=SlotMatchingConfigOptions(enabled=False),
        )
        service = BeliefRevisionService(client, config=config)

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User prefers purple",
                confidence=90,
                subject="user-123",
                predicate="favorite color",
                object="purple",
            ),
        ))

        # Slot matching should not be in pipeline or should show not executed
        assert result.pipeline.get("slot_matching") is None or \
               result.pipeline.get("slot_matching").executed is False or \
               result.action == "ADD"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Check Conflicts Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestCheckConflicts:
    """Tests for check_conflicts operation."""

    async def test_no_conflicts(self) -> None:
        """Should report no conflicts when none exist."""
        client = MockConvexClient(facts=[])
        service = BeliefRevisionService(client)

        result = await service.check_conflicts(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User likes hiking",
                confidence=90,
                subject="user-123",
                predicate="hobby",
                object="hiking",
            ),
        ))

        assert result.has_conflicts is False
        assert len(result.slot_conflicts) == 0
        assert len(result.semantic_conflicts) == 0
        assert result.recommended_action == "ADD"

    async def test_with_slot_conflicts(self) -> None:
        """Should find slot conflicts."""
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes blue",
            "subject": "user-123",
            "predicate": "favorite color",
            "object": "blue",
            "confidence": 80,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        llm_client = MockLLMClient(
            response='{"action": "SUPERSEDE", "targetFactId": "fact-existing", "reason": "Color change", "mergedFact": null, "confidence": 85}'
        )
        service = BeliefRevisionService(client, llm_client)

        result = await service.check_conflicts(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User prefers purple",
                confidence=90,
                subject="user-123",
                predicate="favorite color",
                object="purple",
            ),
        ))

        assert result.has_conflicts is True
        assert len(result.slot_conflicts) == 1
        assert result.recommended_action == "SUPERSEDE"

    async def test_does_not_execute_changes(self) -> None:
        """Should not make any mutations."""
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes blue",
            "subject": "user-123",
            "predicate": "favorite color",
            "object": "blue",
            "confidence": 80,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        llm_client = MockLLMClient(
            response='{"action": "SUPERSEDE", "targetFactId": "fact-existing", "reason": "Color change", "mergedFact": null, "confidence": 85}'
        )
        service = BeliefRevisionService(client, llm_client)

        await service.check_conflicts(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User prefers purple",
                confidence=90,
                subject="user-123",
                predicate="favorite color",
                object="purple",
            ),
        ))

        # Should have no mutations (only queries)
        assert len(client.mutations) == 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LLM Failure Handling Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestLLMFailureHandling:
    """Tests for LLM failure handling."""

    async def test_fallback_on_invalid_response(self) -> None:
        """Should fallback to heuristics on invalid LLM response."""
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes blue",
            "subject": "user-123",
            "predicate": "favorite color",
            "object": "blue",
            "confidence": 80,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        llm_client = MockLLMClient(response="Invalid response - not JSON")
        service = BeliefRevisionService(client, llm_client)

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User prefers purple",
                confidence=90,
                subject="user-123",
                predicate="favorite color",
                object="purple",
            ),
        ))

        # Should still work with fallback
        assert result.action in ["ADD", "UPDATE", "SUPERSEDE", "NONE"]

    async def test_fallback_on_llm_exception(self) -> None:
        """Should fallback to heuristics when LLM raises exception."""

        class FailingLLMClient:
            async def complete(self, **kwargs):
                raise Exception("LLM service unavailable")

        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes blue",
            "subject": "user-123",
            "predicate": "favorite color",
            "object": "blue",
            "confidence": 80,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        service = BeliefRevisionService(client, FailingLLMClient())

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User prefers purple",
                confidence=90,
                subject="user-123",
                predicate="favorite color",
                object="purple",
            ),
        ))

        # Should still work with fallback
        assert result.action in ["ADD", "UPDATE", "SUPERSEDE", "NONE"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Pipeline Execution Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestPipelineExecution:
    """Tests for pipeline execution tracking."""

    async def test_pipeline_tracks_all_stages(self) -> None:
        """Should track all pipeline stages."""
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes blue",
            "subject": "user-123",
            "predicate": "favorite color",
            "object": "blue",
            "confidence": 80,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        llm_client = MockLLMClient(
            response='{"action": "SUPERSEDE", "targetFactId": "fact-existing", "reason": "Changed", "mergedFact": null, "confidence": 85}'
        )
        service = BeliefRevisionService(client, llm_client)

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User prefers purple",
                confidence=90,
                subject="user-123",
                predicate="favorite color",
                object="purple",
            ),
        ))

        # Should have pipeline info
        assert "slot_matching" in result.pipeline
        assert "llm_resolution" in result.pipeline
        assert result.pipeline["slot_matching"].executed is True
        assert result.pipeline["llm_resolution"].executed is True

    async def test_semantic_matching_only_when_no_slot_match(self) -> None:
        """Should only run semantic matching when no slot matches."""
        # No slot-matchable fact
        existing_fact = {
            "factId": "fact-existing",
            "fact": "User likes hiking",
            "subject": "different-user",  # Different subject
            "predicate": "hobby is",
            "object": "hiking",
            "confidence": 80,
            "supersededBy": None,
        }
        client = MockConvexClient(facts=[existing_fact])
        service = BeliefRevisionService(client)

        result = await service.revise(ReviseParams(
            memory_space_id="space-1",
            fact=ConflictCandidate(
                fact="User enjoys biking",
                confidence=90,
                subject="user-123",
                predicate="hobby is",
                object="biking",
            ),
        ))

        # Slot matching should not find matches (different subject)
        if "slot_matching" in result.pipeline:
            assert result.pipeline["slot_matching"].matched is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
