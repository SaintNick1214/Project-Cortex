"""
Comprehensive enum-based filter tests for Facts API.

Tests all 7 factTypes across all 5 filter operations to ensure:
1. No ArgumentValidationError for valid enum values
2. Filters return only matching results
3. Regression test for "observation" factType bug

Port of: Comprehensive filter coverage (new tests)
"""

import pytest

from cortex.types import StoreFactParams
from tests.helpers import generate_test_memory_space_id

# All valid factTypes as per schema
ALL_FACT_TYPES = [
    "preference",
    "identity",
    "knowledge",
    "relationship",
    "event",
    "observation",  # This was the bug - missing in query validators
    "custom",
]


@pytest.mark.parametrize("fact_type", ALL_FACT_TYPES)
class TestFactsFilterParametrized:
    """Parametrized tests covering all factTypes across all operations."""

    @pytest.mark.asyncio
    async def test_list_filters_by_fact_type(self, cortex_client, fact_type):
        """Test facts.list() filters correctly by factType."""
        space_id = generate_test_memory_space_id()

        # Store target fact
        target_fact = await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type=fact_type,
                fact=f"Test {fact_type} fact for list",
                subject=f"test-subject-{fact_type}",
                confidence=85,
                source_type="manual",
            )
        )

        # Store different type as noise
        if fact_type != "preference":
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id=space_id,
                    fact_type="preference",
                    fact="Noise fact",
                    subject="noise-subject",
                    confidence=90,
                    source_type="manual",
                )
            )

        # Execute: List with factType filter
        results = await cortex_client.facts.list(
            memory_space_id=space_id, fact_type=fact_type
        )

        # Validate
        assert len(results) >= 1, f"Should find at least 1 {fact_type} fact"
        for fact in results:
            assert (
                fact.fact_type == fact_type
            ), f"All results should be {fact_type}, got {fact.fact_type}"

        # Verify target fact is in results
        fact_ids = [f.fact_id for f in results]
        assert (
            target_fact.fact_id in fact_ids
        ), f"Target {fact_type} fact should be in results"

    @pytest.mark.asyncio
    async def test_count_filters_by_fact_type(self, cortex_client, fact_type):
        """Test facts.count() filters correctly by factType."""
        space_id = generate_test_memory_space_id()

        # Store 2 facts of target type
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type=fact_type,
                fact=f"Test {fact_type} fact 1 for count",
                subject=f"test-subject-{fact_type}-1",
                confidence=85,
                source_type="manual",
            )
        )

        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type=fact_type,
                fact=f"Test {fact_type} fact 2 for count",
                subject=f"test-subject-{fact_type}-2",
                confidence=90,
                source_type="manual",
            )
        )

        # Store different type as noise
        if fact_type != "custom":
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id=space_id,
                    fact_type="custom",
                    fact="Noise fact",
                    subject="noise",
                    confidence=70,
                    source_type="manual",
                )
            )

        # Execute: Count with factType filter
        count = await cortex_client.facts.count(
            memory_space_id=space_id, fact_type=fact_type
        )

        # Validate
        assert count >= 2, f"Should count at least 2 {fact_type} facts, got {count}"

    @pytest.mark.asyncio
    async def test_search_filters_by_fact_type(self, cortex_client, fact_type):
        """Test facts.search() filters correctly by factType."""
        space_id = generate_test_memory_space_id()

        # Store target fact with searchable content
        search_term = "searchable"
        _target_fact = await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type=fact_type,
                fact=f"{search_term} {fact_type} fact for search",
                subject=f"test-subject-{fact_type}",
                confidence=85,
                source_type="manual",
            )
        )

        # Store different type with same search term (should be filtered out)
        if fact_type != "knowledge":
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id=space_id,
                    fact_type="knowledge",
                    fact=f"{search_term} noise fact",
                    subject="noise-subject",
                    confidence=90,
                    source_type="manual",
                )
            )

        # Execute: Search with factType filter
        results = await cortex_client.facts.search(
            memory_space_id=space_id, query=search_term, fact_type=fact_type
        )

        # Validate
        assert len(results) >= 1, f"Should find at least 1 {fact_type} fact"
        for fact in results:
            assert (
                fact.fact_type == fact_type
            ), f"All results should be {fact_type}, got {fact.fact_type}"
            assert search_term in fact.fact.lower(), "Results should match search term"

    @pytest.mark.asyncio
    async def test_query_by_subject_filters_by_fact_type(
        self, cortex_client, fact_type
    ):
        """Test facts.query_by_subject() filters correctly by factType."""
        space_id = generate_test_memory_space_id()
        subject = f"query-subject-{fact_type}"

        # Store target fact
        _target_fact = await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type=fact_type,
                fact=f"Test {fact_type} fact for query_by_subject",
                subject=subject,
                confidence=85,
                source_type="manual",
            )
        )

        # Store same subject but different type (should be filtered out)
        if fact_type != "relationship":
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id=space_id,
                    fact_type="relationship",
                    fact="Noise fact with same subject",
                    subject=subject,
                    confidence=90,
                    source_type="manual",
                )
            )

        # Execute: Query by subject with factType filter
        results = await cortex_client.facts.query_by_subject(
            memory_space_id=space_id, subject=subject, fact_type=fact_type
        )

        # Validate
        assert len(results) >= 1, f"Should find at least 1 {fact_type} fact"
        for fact in results:
            assert (
                fact.fact_type == fact_type
            ), f"All results should be {fact_type}, got {fact.fact_type}"
            assert fact.subject == subject, "All results should have target subject"

    @pytest.mark.asyncio
    async def test_export_filters_by_fact_type(self, cortex_client, fact_type):
        """Test facts.export() filters correctly by factType."""
        space_id = generate_test_memory_space_id()

        # Store target fact
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type=fact_type,
                fact=f"Test {fact_type} fact for export",
                subject=f"export-subject-{fact_type}",
                confidence=85,
                source_type="manual",
            )
        )

        # Store different type as noise
        if fact_type != "event":
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id=space_id,
                    fact_type="event",
                    fact="Noise fact",
                    subject="noise",
                    confidence=70,
                    source_type="manual",
                )
            )

        # Execute: Export with factType filter (JSON format)
        export_data = await cortex_client.facts.export(
            memory_space_id=space_id, format="json", fact_type=fact_type
        )

        # Validate
        assert export_data is not None, "Export should return data"
        assert isinstance(export_data, dict), "Export should return dict"
        assert "data" in export_data, "Export should have 'data' field"
        assert isinstance(export_data["data"], str), "Export data should be string"

        # Parse JSON and validate factType
        import json

        facts = json.loads(export_data["data"])
        assert len(facts) >= 1, f"Should export at least 1 {fact_type} fact"
        for fact in facts:
            assert (
                fact["factType"] == fact_type
            ), f"All exported facts should be {fact_type}, got {fact['factType']}"


class TestFactsFilterEdgeCases:
    """Edge case tests for facts filter operations."""

    @pytest.mark.asyncio
    async def test_list_filter_no_matches(self, cortex_client):
        """Test list with factType filter when no matches exist."""
        space_id = generate_test_memory_space_id()

        # Store only preference facts
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type="preference",
                fact="Only preference fact",
                subject="test",
                confidence=85,
                source_type="manual",
            )
        )

        # Query for different type
        results = await cortex_client.facts.list(
            memory_space_id=space_id, fact_type="observation"
        )

        # Should return empty list, not error
        assert results == [], "Should return empty list when no matches"

    @pytest.mark.asyncio
    async def test_list_filter_multiple_results(self, cortex_client):
        """Test list with factType filter returns all matching results."""
        space_id = generate_test_memory_space_id()

        # Store 5 identity facts
        for i in range(5):
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id=space_id,
                    fact_type="identity",
                    fact=f"Identity fact {i}",
                    subject=f"test-{i}",
                    confidence=80 + i,
                    source_type="manual",
                )
            )

        # Store some noise
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type="preference",
                fact="Noise fact",
                subject="noise",
                confidence=90,
                source_type="manual",
            )
        )

        # Query for identity
        results = await cortex_client.facts.list(
            memory_space_id=space_id, fact_type="identity"
        )

        # Should return all 5 identity facts
        assert len(results) == 5, f"Should return 5 identity facts, got {len(results)}"
        for fact in results:
            assert fact.fact_type == "identity"

    @pytest.mark.asyncio
    async def test_observation_regression(self, cortex_client):
        """Regression test for 'observation' factType bug.

        This test verifies that the bug where 'observation' was missing
        from query validators is fixed.
        """
        space_id = generate_test_memory_space_id()

        # Store observation fact (this always worked)
        _obs_fact = await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type="observation",
                fact="User observed clicking signup button",
                subject="user-behavior",
                confidence=95,
                source_type="manual",
            )
        )

        # These operations should all work with observation filter
        # (they would have failed before the bug fix)

        # Test list
        list_results = await cortex_client.facts.list(
            memory_space_id=space_id, fact_type="observation"
        )
        assert len(list_results) >= 1, "list() should work with observation"
        assert all(f.fact_type == "observation" for f in list_results)

        # Test count
        count = await cortex_client.facts.count(
            memory_space_id=space_id, fact_type="observation"
        )
        assert count >= 1, "count() should work with observation"

        # Test search
        search_results = await cortex_client.facts.search(
            memory_space_id=space_id, query="clicking", fact_type="observation"
        )
        assert len(search_results) >= 1, "search() should work with observation"

        # Test query_by_subject
        subject_results = await cortex_client.facts.query_by_subject(
            memory_space_id=space_id, subject="user-behavior", fact_type="observation"
        )
        assert (
            len(subject_results) >= 1
        ), "query_by_subject() should work with observation"

        # Test export
        export_data = await cortex_client.facts.export(
            memory_space_id=space_id, format="json", fact_type="observation"
        )
        assert export_data, "export() should work with observation"

    @pytest.mark.asyncio
    async def test_combine_fact_type_with_other_filters(self, cortex_client):
        """Test combining factType filter with tags and subject filters."""
        space_id = generate_test_memory_space_id()
        target_subject = "test-combine"
        target_tags = ["important", "user-pref"]

        # Store target fact with all criteria
        _target_fact = await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type="preference",
                fact="User prefers dark mode",
                subject=target_subject,
                tags=target_tags,
                confidence=90,
                source_type="manual",
            )
        )

        # Store preference with wrong subject
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type="preference",
                fact="Different subject preference",
                subject="different-subject",
                tags=target_tags,
                confidence=85,
                source_type="manual",
            )
        )

        # Store preference with wrong tags
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type="preference",
                fact="Different tags preference",
                subject=target_subject,
                tags=["other"],
                confidence=85,
                source_type="manual",
            )
        )

        # Store different factType with correct subject/tags
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type="identity",
                fact="Identity with same subject",
                subject=target_subject,
                tags=target_tags,
                confidence=85,
                source_type="manual",
            )
        )

        # Test: Combine factType + subject filters
        results = await cortex_client.facts.list(
            memory_space_id=space_id, fact_type="preference", subject=target_subject
        )

        # Should find facts matching BOTH filters
        assert len(results) >= 1, "Should find facts matching both filters"
        for fact in results:
            assert fact.fact_type == "preference"
            assert fact.subject == target_subject

        # Test: Combine factType + tags filters
        results_with_tags = await cortex_client.facts.list(
            memory_space_id=space_id, fact_type="preference", tags=["important"]
        )

        # Should find facts matching BOTH filters
        assert len(results_with_tags) >= 1, "Should find facts matching type and tags"
        for fact in results_with_tags:
            assert fact.fact_type == "preference"
            assert "important" in (fact.tags or [])

    @pytest.mark.asyncio
    async def test_count_with_combined_filters(self, cortex_client):
        """Test count() with factType and other filters."""
        space_id = generate_test_memory_space_id()

        # Store 3 knowledge facts
        for i in range(3):
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id=space_id,
                    fact_type="knowledge",
                    fact=f"Knowledge fact {i}",
                    subject="test",
                    confidence=85,
                    source_type="manual",
                )
            )

        # Store 2 event facts (noise)
        for i in range(2):
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id=space_id,
                    fact_type="event",
                    fact=f"Event fact {i}",
                    subject="test",
                    confidence=85,
                    source_type="manual",
                )
            )

        # Count only knowledge facts
        knowledge_count = await cortex_client.facts.count(
            memory_space_id=space_id, fact_type="knowledge"
        )

        assert (
            knowledge_count == 3
        ), f"Should count exactly 3 knowledge facts, got {knowledge_count}"

        # Count all facts (no filter)
        total_count = await cortex_client.facts.count(memory_space_id=space_id)

        assert (
            total_count >= 5
        ), f"Should count at least 5 total facts, got {total_count}"

    @pytest.mark.asyncio
    async def test_search_with_min_confidence_and_fact_type(self, cortex_client):
        """Test search() combining factType and minConfidence filters."""
        space_id = generate_test_memory_space_id()
        search_term = "combined"

        # Store high confidence preference
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type="preference",
                fact=f"{search_term} high confidence preference",
                subject="test",
                confidence=95,
                source_type="manual",
            )
        )

        # Store low confidence preference
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type="preference",
                fact=f"{search_term} low confidence preference",
                subject="test",
                confidence=60,
                source_type="manual",
            )
        )

        # Store high confidence identity (wrong type)
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact_type="identity",
                fact=f"{search_term} identity",
                subject="test",
                confidence=95,
                source_type="manual",
            )
        )

        # Search with both filters
        results = await cortex_client.facts.search(
            memory_space_id=space_id,
            query=search_term,
            fact_type="preference",
            min_confidence=90,
        )

        # Should only find high confidence preference
        assert len(results) >= 1, "Should find matching facts"
        for fact in results:
            assert fact.fact_type == "preference"
            assert fact.confidence >= 90
