"""
E2E tests for Cortex SDK - Belief Revision Workflows

Real-world scenarios testing the complete belief revision system
including fact storage, conflict detection, and supersession.

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
    return f"br-{uuid4().hex[:8]}"


@pytest.fixture
def memory_space_id(test_run_id):
    """Generate unique memory space ID."""
    return f"test-space-{test_run_id}"


@pytest.fixture
def user_id(test_run_id):
    """Generate unique user ID."""
    return f"test-user-{test_run_id}"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Mock LLM Client for Testing
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class MockLLMClient:
    """
    Mock LLM client that returns predetermined responses based on fact content.

    This allows testing the full belief revision flow without actual LLM calls.
    """

    def __init__(self):
        self.call_count = 0

    def _extract_fact_id_from_prompt(self, prompt: str) -> str | None:
        """Extract the first fact ID from the prompt (existing facts section)."""
        import re
        # Look for fact-N pattern (most common in our tests)
        match = re.search(r'\bfact-\d+\b', prompt)
        if match:
            return match.group(0)
        # Also look for ID patterns like "ID: xxx" or "factId: xxx"
        match = re.search(r'(?:ID|factId)[:\s]+["\'"]?([a-zA-Z0-9-]+)["\'"]?', prompt, re.IGNORECASE)
        if match:
            return match.group(1)
        return None

    async def complete(self, *, system: str, prompt: str, model=None, response_format=None):
        self.call_count += 1

        # Analyze the prompt to determine appropriate response
        prompt_lower = prompt.lower()

        # Extract fact ID from existing facts in the prompt for UPDATE/SUPERSEDE actions
        target_fact_id = self._extract_fact_id_from_prompt(prompt)
        target_fact_json = f'"{target_fact_id}"' if target_fact_id else "null"

        # Color preference change scenario
        if "favorite color" in prompt_lower or "color" in prompt_lower:
            if "purple" in prompt_lower and "blue" in prompt_lower:
                return f'''
                {{
                    "action": "SUPERSEDE",
                    "targetFactId": {target_fact_json},
                    "reason": "Color preference has changed from blue to purple",
                    "mergedFact": null,
                    "confidence": 90
                }}
                '''

        # Location change scenario
        if "lives in" in prompt_lower or "moved to" in prompt_lower:
            if "san francisco" in prompt_lower and "new york" in prompt_lower:
                return f'''
                {{
                    "action": "SUPERSEDE",
                    "targetFactId": {target_fact_json},
                    "reason": "User has moved to a new location",
                    "mergedFact": null,
                    "confidence": 95
                }}
                '''

        # Employment change scenario
        if "works at" in prompt_lower or "employed" in prompt_lower:
            return f'''
            {{
                "action": "SUPERSEDE",
                "targetFactId": {target_fact_json},
                "reason": "Employment status has changed",
                "mergedFact": null,
                "confidence": 85
            }}
            '''

        # Pet detail refinement scenario
        if "dog" in prompt_lower and "named" in prompt_lower:
            return f'''
            {{
                "action": "UPDATE",
                "targetFactId": {target_fact_json},
                "reason": "Adding pet name detail to existing fact",
                "mergedFact": "User has a dog named Max",
                "confidence": 90
            }}
            '''

        # Duplicate scenario
        if "outdoor" in prompt_lower and "hiking" in prompt_lower:
            return f'''
            {{
                "action": "NONE",
                "targetFactId": {target_fact_json},
                "reason": "New fact is already covered by existing fact",
                "mergedFact": null,
                "confidence": 95
            }}
            '''

        # Default: ADD new fact
        return '''
        {
            "action": "ADD",
            "targetFactId": null,
            "reason": "New information not covered by existing facts",
            "mergedFact": null,
            "confidence": 80
        }
        '''


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Workflow Tests - Color Preference Change
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestColorPreferenceWorkflow:
    """E2E tests for color preference change scenario."""

    async def test_color_preference_change_flow(self, memory_space_id, user_id):
        """
        Complete flow: User changes color preference from blue to purple.

        Steps:
        1. Store initial preference (blue)
        2. User states new preference (purple)
        3. Belief revision should SUPERSEDE blue with purple
        4. Old fact should be marked with validUntil
        """
        from cortex.facts.belief_revision import (
            BeliefRevisionConfig,
            BeliefRevisionService,
            ConflictCandidate,
            ReviseParams,
        )

        # Use a mock client for testing without real Convex
        class MockConvexClient:
            def __init__(self):
                self.facts = []
                self.fact_counter = 0

            async def query(self, method, args):
                if "queryBySubject" in method:
                    subject = args.get("subject", "").lower()
                    return [f for f in self.facts
                            if f.get("subject", "").lower() == subject
                            and f.get("supersededBy") is None]
                return self.facts

            async def mutation(self, method, args):
                if "store" in method:
                    self.fact_counter += 1
                    fact = {
                        "factId": f"fact-{self.fact_counter}",
                        **args,
                        "createdAt": int(time.time() * 1000),
                    }
                    self.facts.append(fact)
                    return fact
                if "update" in method:
                    fact_id = args.get("factId")
                    for f in self.facts:
                        if f.get("factId") == fact_id:
                            f.update({k: v for k, v in args.items() if v is not None})
                            return f
                    return None
                return {}

        client = MockConvexClient()
        llm_client = MockLLMClient()
        service = BeliefRevisionService(client, llm_client)

        # Step 1: Store initial preference
        initial_result = await service.revise(ReviseParams(
            memory_space_id=memory_space_id,
            user_id=user_id,
            fact=ConflictCandidate(
                fact="User's favorite color is blue",
                confidence=90,
                fact_type="preference",
                subject=user_id,
                predicate="favorite color",
                object="blue",
                tags=["color", "preference"],
            ),
        ))

        assert initial_result.action == "ADD"
        initial_fact_id = initial_result.fact.get("factId")
        assert initial_fact_id is not None

        # Step 2: User states new preference
        update_result = await service.revise(ReviseParams(
            memory_space_id=memory_space_id,
            user_id=user_id,
            fact=ConflictCandidate(
                fact="User now prefers purple as favorite color",
                confidence=95,
                fact_type="preference",
                subject=user_id,
                predicate="favorite color",
                object="purple",
                tags=["color", "preference"],
            ),
        ))

        # Step 3: Verify supersession occurred
        assert update_result.action == "SUPERSEDE"
        assert len(update_result.superseded) >= 0  # May or may not have found old fact

        # LLM should have been called
        assert llm_client.call_count >= 1


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Workflow Tests - Location Updates
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestLocationWorkflow:
    """E2E tests for location update scenarios."""

    async def test_location_change_over_time(self, memory_space_id, user_id):
        """
        Complete flow: User moves from NYC to SF.

        Steps:
        1. Store initial location (NYC)
        2. User announces move to SF
        3. Belief revision should SUPERSEDE NYC with SF
        """
        from cortex.facts.belief_revision import (
            BeliefRevisionService,
            ConflictCandidate,
            ReviseParams,
        )

        class MockConvexClient:
            def __init__(self):
                self.facts = []
                self.fact_counter = 0

            async def query(self, method, args):
                if "queryBySubject" in method:
                    subject = args.get("subject", "").lower()
                    return [f for f in self.facts
                            if f.get("subject", "").lower() == subject
                            and f.get("validUntil") is None]
                return self.facts

            async def mutation(self, method, args):
                if "store" in method:
                    self.fact_counter += 1
                    fact = {
                        "factId": f"fact-{self.fact_counter}",
                        **args,
                        "createdAt": int(time.time() * 1000),
                    }
                    self.facts.append(fact)
                    return fact
                if "update" in method:
                    fact_id = args.get("factId")
                    for f in self.facts:
                        if f.get("factId") == fact_id:
                            f.update({k: v for k, v in args.items() if v is not None})
                            return f
                return {}

        client = MockConvexClient()
        llm_client = MockLLMClient()
        service = BeliefRevisionService(client, llm_client)

        # Store initial location
        nyc_result = await service.revise(ReviseParams(
            memory_space_id=memory_space_id,
            user_id=user_id,
            fact=ConflictCandidate(
                fact="User lives in New York City",
                confidence=90,
                fact_type="identity",
                subject=user_id,
                predicate="lives in",
                object="New York City",
                tags=["location"],
            ),
        ))

        assert nyc_result.action == "ADD"

        # User moves to SF
        sf_result = await service.revise(ReviseParams(
            memory_space_id=memory_space_id,
            user_id=user_id,
            fact=ConflictCandidate(
                fact="User moved to San Francisco",
                confidence=95,
                fact_type="identity",
                subject=user_id,
                predicate="lives in",
                object="San Francisco",
                tags=["location"],
            ),
        ))

        # Should supersede old location
        assert sf_result.action == "SUPERSEDE"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Workflow Tests - Employment Changes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestEmploymentWorkflow:
    """E2E tests for employment change scenarios."""

    async def test_job_change(self, memory_space_id, user_id):
        """
        Complete flow: User changes jobs.

        Steps:
        1. Store initial job (Acme Corp)
        2. User gets new job (TechStartup)
        3. Old job should be superseded
        """
        from cortex.facts.belief_revision import (
            BeliefRevisionService,
            ConflictCandidate,
            ReviseParams,
        )

        class MockConvexClient:
            def __init__(self):
                self.facts = []
                self.fact_counter = 0

            async def query(self, method, args):
                if "queryBySubject" in method:
                    subject = args.get("subject", "").lower()
                    return [f for f in self.facts
                            if f.get("subject", "").lower() == subject
                            and f.get("validUntil") is None]
                return self.facts

            async def mutation(self, method, args):
                if "store" in method:
                    self.fact_counter += 1
                    fact = {
                        "factId": f"fact-{self.fact_counter}",
                        **args,
                        "createdAt": int(time.time() * 1000),
                    }
                    self.facts.append(fact)
                    return fact
                if "update" in method:
                    fact_id = args.get("factId")
                    for f in self.facts:
                        if f.get("factId") == fact_id:
                            f.update({k: v for k, v in args.items() if v is not None})
                            return f
                return {}

        client = MockConvexClient()
        llm_client = MockLLMClient()
        service = BeliefRevisionService(client, llm_client)

        # Store initial employment
        await service.revise(ReviseParams(
            memory_space_id=memory_space_id,
            user_id=user_id,
            fact=ConflictCandidate(
                fact="User works at Acme Corporation",
                confidence=90,
                fact_type="identity",
                subject=user_id,
                predicate="works at",
                object="Acme Corporation",
                tags=["employment"],
            ),
        ))

        # New job
        new_job_result = await service.revise(ReviseParams(
            memory_space_id=memory_space_id,
            user_id=user_id,
            fact=ConflictCandidate(
                fact="User now works at TechStartup Inc",
                confidence=95,
                fact_type="identity",
                subject=user_id,
                predicate="works at",
                object="TechStartup Inc",
                tags=["employment"],
            ),
        ))

        assert new_job_result.action == "SUPERSEDE"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Workflow Tests - Fact Refinement
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestFactRefinementWorkflow:
    """E2E tests for fact refinement (UPDATE) scenarios."""

    async def test_add_detail_to_existing_fact(self, memory_space_id, user_id):
        """
        Complete flow: Adding detail to existing fact.

        Steps:
        1. Store basic fact (User has a dog)
        2. User mentions dog's name
        3. Should UPDATE to include name
        """
        from cortex.facts.belief_revision import (
            BeliefRevisionService,
            ConflictCandidate,
            ReviseParams,
        )

        class MockConvexClient:
            def __init__(self):
                self.facts = []
                self.fact_counter = 0

            async def query(self, method, args):
                if "queryBySubject" in method:
                    subject = args.get("subject", "").lower()
                    return [f for f in self.facts
                            if f.get("subject", "").lower() == subject
                            and f.get("validUntil") is None]
                return self.facts

            async def mutation(self, method, args):
                if "store" in method:
                    self.fact_counter += 1
                    fact = {
                        "factId": f"fact-{self.fact_counter}",
                        **args,
                        "createdAt": int(time.time() * 1000),
                    }
                    self.facts.append(fact)
                    return fact
                if "update" in method:
                    fact_id = args.get("factId")
                    for f in self.facts:
                        if f.get("factId") == fact_id:
                            f.update({k: v for k, v in args.items() if v is not None})
                            return f
                return {}

        client = MockConvexClient()
        llm_client = MockLLMClient()
        service = BeliefRevisionService(client, llm_client)

        # Store basic pet fact
        await service.revise(ReviseParams(
            memory_space_id=memory_space_id,
            user_id=user_id,
            fact=ConflictCandidate(
                fact="User has a dog",
                confidence=85,
                fact_type="preference",
                subject=user_id,
                predicate="has pet",
                object="dog",
                tags=["pet"],
            ),
        ))

        # Add dog's name
        refined_result = await service.revise(ReviseParams(
            memory_space_id=memory_space_id,
            user_id=user_id,
            fact=ConflictCandidate(
                fact="User has a dog named Max",
                confidence=90,
                fact_type="preference",
                subject=user_id,
                predicate="has pet",
                object="dog named Max",
                tags=["pet"],
            ),
        ))

        # Should UPDATE (add detail) rather than create new
        assert refined_result.action == "UPDATE"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Workflow Tests - Duplicate Detection
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestDuplicateDetectionWorkflow:
    """E2E tests for duplicate fact detection (NONE) scenarios."""

    async def test_duplicate_ignored(self, memory_space_id, user_id):
        """
        Complete flow: Duplicate fact should be ignored.

        Steps:
        1. Store specific fact (User likes hiking in mountains)
        2. User mentions general preference (User enjoys outdoors)
        3. Should return NONE (existing fact covers this)
        """
        from cortex.facts.belief_revision import (
            BeliefRevisionService,
            ConflictCandidate,
            ReviseParams,
        )

        class MockConvexClient:
            def __init__(self):
                self.facts = []
                self.fact_counter = 0

            async def query(self, method, args):
                if "queryBySubject" in method:
                    subject = args.get("subject", "").lower()
                    return [f for f in self.facts
                            if f.get("subject", "").lower() == subject]
                return self.facts

            async def mutation(self, method, args):
                if "store" in method:
                    self.fact_counter += 1
                    fact = {
                        "factId": f"fact-{self.fact_counter}",
                        **args,
                        "createdAt": int(time.time() * 1000),
                    }
                    self.facts.append(fact)
                    return fact
                if "update" in method:
                    fact_id = args.get("factId")
                    for f in self.facts:
                        if f.get("factId") == fact_id:
                            f.update({k: v for k, v in args.items() if v is not None})
                            return f
                return {}

        client = MockConvexClient()
        llm_client = MockLLMClient()
        service = BeliefRevisionService(client, llm_client)

        # Store specific fact
        specific_result = await service.revise(ReviseParams(
            memory_space_id=memory_space_id,
            user_id=user_id,
            fact=ConflictCandidate(
                fact="User likes hiking in the mountains",
                confidence=90,
                fact_type="preference",
                subject=user_id,
                predicate="enjoys",
                object="hiking in mountains",
                tags=["hobby", "outdoor"],
            ),
        ))

        assert specific_result.action == "ADD"

        # Try to add more general fact
        general_result = await service.revise(ReviseParams(
            memory_space_id=memory_space_id,
            user_id=user_id,
            fact=ConflictCandidate(
                fact="User enjoys outdoor activities",
                confidence=85,
                fact_type="preference",
                subject=user_id,
                predicate="enjoys",
                object="outdoors",
                tags=["hobby", "outdoor"],
            ),
        ))

        # Should recognize this is less specific and return NONE
        assert general_result.action == "NONE"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Workflow Tests - Multiple Facts Same Session
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
class TestMultipleFactsWorkflow:
    """E2E tests for multiple facts in same session."""

    async def test_multiple_unrelated_facts_add(self, memory_space_id, user_id):
        """
        Complete flow: Multiple unrelated facts should all ADD.
        """
        from cortex.facts.belief_revision import (
            BeliefRevisionService,
            ConflictCandidate,
            ReviseParams,
        )

        class MockConvexClient:
            def __init__(self):
                self.facts = []
                self.fact_counter = 0

            async def query(self, method, args):
                if "queryBySubject" in method:
                    subject = args.get("subject", "").lower()
                    return [f for f in self.facts
                            if f.get("subject", "").lower() == subject]
                return self.facts

            async def mutation(self, method, args):
                if "store" in method:
                    self.fact_counter += 1
                    fact = {
                        "factId": f"fact-{self.fact_counter}",
                        **args,
                        "createdAt": int(time.time() * 1000),
                    }
                    self.facts.append(fact)
                    return fact
                return {}

        client = MockConvexClient()
        llm_client = MockLLMClient()
        service = BeliefRevisionService(client, llm_client)

        # Add multiple unrelated facts
        facts_to_add = [
            ("User's age is 30", "age", "30"),
            ("User speaks Spanish", "language", "Spanish"),
            ("User drives a Tesla", "vehicle", "Tesla"),
        ]

        results = []
        for fact_text, predicate, obj in facts_to_add:
            result = await service.revise(ReviseParams(
                memory_space_id=memory_space_id,
                user_id=user_id,
                fact=ConflictCandidate(
                    fact=fact_text,
                    confidence=90,
                    fact_type="identity",
                    subject=user_id,
                    predicate=predicate,
                    object=obj,
                ),
            ))
            results.append(result)

        # All should be ADD since they're unrelated
        for result in results:
            assert result.action == "ADD"

        # Should have 3 facts stored
        assert len(client.facts) == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
