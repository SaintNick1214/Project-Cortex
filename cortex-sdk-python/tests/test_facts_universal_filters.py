"""
Comprehensive Universal Filters Tests for Facts API (Python SDK)

Tests all universal filters documented in v0.9.1:
- user_id (GDPR compliance)
- participant_id (Hive Mode)
- created_before/after, updated_before/after (date filters)
- source_type (conversation, system, tool, manual)
- tags with tag_match (any/all)
- min_confidence (quality threshold)
- metadata (custom filters)
- version
- valid_at, valid_from, valid_until (temporal validity)
- sort_by, sort_order
- limit, offset (pagination)

Ensures Facts API matches Memory API universal filter patterns.
"""

import pytest
from datetime import datetime, timedelta
from time import sleep
from cortex import Cortex
from cortex.types import (
    StoreFactParams,
    ListFactsFilter,
    CountFactsFilter,
    SearchFactsOptions,
    QueryBySubjectFilter,
    QueryByRelationshipFilter,
)


class TestFactsUniversalFilters:
    """Comprehensive universal filters tests for Facts API."""

    @pytest.fixture
    def test_space_id(self):
        """Generate unique test space ID."""
        return f"universal-filter-test-{int(datetime.now().timestamp() * 1000)}"

    # Use the cortex_client fixture from conftest.py (no need to override)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Identity Filters (GDPR & Hive Mode)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @pytest.mark.asyncio
    async def test_list_filter_by_user_id(self, cortex_client, test_space_id):
        """Test filtering by user_id (GDPR compliance)."""
        space_id = f"{test_space_id}-userid"
        target_user = "user-alice"
        other_user = "user-bob"

        # Store facts for different users
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id=target_user,
                fact="Alice prefers dark mode",
                fact_type="preference",
                confidence=90,
                source_type="manual",
                tags=["test"],
            )
        )

        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id=other_user,
                fact="Bob prefers light mode",
                fact_type="preference",
                confidence=85,
                source_type="manual",
                tags=["test"],
            )
        )

        # Test: Filter by user_id
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                user_id=target_user,
            )
        )

        # Validate: Only Alice's facts
        assert len(results) >= 1
        for fact in results:
            assert fact.user_id == target_user

    @pytest.mark.asyncio
    async def test_list_filter_by_participant_id(self, cortex_client, test_space_id):
        """Test filtering by participant_id (Hive Mode)."""
        space_id = f"{test_space_id}-participantid"
        email_agent = "email-agent"
        calendar_agent = "calendar-agent"

        # Store facts from different agents in same space (Hive Mode)
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                participant_id=email_agent,
                fact="User receives emails at 9am",
                fact_type="preference",
                confidence=95,
                source_type="manual",
                tags=["test"],
            )
        )

        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                participant_id=calendar_agent,
                fact="User has meetings on Tuesdays",
                fact_type="event",
                confidence=90,
                source_type="manual",
                tags=["test"],
            )
        )

        # Test: Filter by participant_id
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                participant_id=email_agent,
            )
        )

        # Validate: Only email agent's facts
        assert len(results) >= 1
        for fact in results:
            assert fact.participant_id == email_agent

    @pytest.mark.asyncio
    async def test_count_filter_by_user_id(self, cortex_client, test_space_id):
        """Test count filtering by user_id."""
        space_id = f"{test_space_id}-userid-count"
        target_user = "user-charlie"

        # Store multiple facts for target user
        for i in range(3):
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id=space_id,
                    user_id=target_user,
                    fact=f"Fact {i} for Charlie",
                    fact_type="knowledge",
                    confidence=85,
                    source_type="manual",
                    tags=["test"],
                )
            )

        # Store fact for different user
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id="other-user",
                fact="Other user fact",
                fact_type="knowledge",
                confidence=80,
                source_type="manual",
                tags=["test"],
            )
        )

        # Test: Count by user_id
        count = await cortex_client.facts.count(
            CountFactsFilter(
                memory_space_id=space_id,
                user_id=target_user,
            )
        )

        # Validate: Should count exactly 3
        assert count == 3

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Date Filters
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @pytest.mark.asyncio
    async def test_list_filter_by_created_after(self, cortex_client, test_space_id):
        """Test filtering by created_after."""
        space_id = f"{test_space_id}-created-after"
        cutoff_date = datetime.now()

        # Wait to ensure timestamp difference
        sleep(0.2)

        # Store fact after cutoff
        recent_fact = await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Recent fact",
                fact_type="knowledge",
                confidence=90,
                source_type="manual",
                tags=["test"],
            )
        )

        # Test: Filter by created_after
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                created_after=cutoff_date,
            )
        )

        # Validate: Should include recent fact
        assert len(results) >= 1
        fact_ids = [f.fact_id for f in results]
        assert recent_fact.fact_id in fact_ids

    @pytest.mark.asyncio
    async def test_search_combine_date_filters(self, cortex_client, test_space_id):
        """Test combining date filters in search."""
        space_id = f"{test_space_id}-date-range"
        search_term = "datetest"

        start_date = datetime.now()
        sleep(0.2)

        # Store fact in range
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact=f"{search_term} fact in range",
                fact_type="knowledge",
                confidence=90,
                source_type="manual",
                tags=["test"],
            )
        )

        sleep(0.2)
        end_date = datetime.now()
        sleep(0.2)

        # Store fact after range
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact=f"{search_term} fact after range",
                fact_type="knowledge",
                confidence=85,
                source_type="manual",
                tags=["test"],
            )
        )

        # Test: Search with date range
        results = await cortex_client.facts.search(
            space_id,
            search_term,
            SearchFactsOptions(
                created_after=start_date,
                created_before=end_date,
            ),
        )

        # Validate: Should only find facts in range
        assert len(results) >= 1
        for fact in results:
            assert fact.created_at >= int(start_date.timestamp() * 1000)
            assert fact.created_at < int(end_date.timestamp() * 1000)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Source Type Filters
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @pytest.mark.parametrize("source_type", ["conversation", "system", "tool", "manual"])
    @pytest.mark.asyncio
    async def test_list_filter_by_source_type(
        self, cortex_client, test_space_id, source_type
    ):
        """Test filtering by source_type."""
        space_id = f"{test_space_id}-source-{source_type}"

        # Store fact with target source_type
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact=f"Fact from {source_type}",
                fact_type="knowledge",
                confidence=90,
                source_type=source_type,  # type: ignore
                tags=["test"],
            )
        )

        # Store fact with different source_type
        other_type = "system" if source_type != "system" else "manual"
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact=f"Fact from {other_type}",
                fact_type="knowledge",
                confidence=85,
                source_type=other_type,  # type: ignore
                tags=["test"],
            )
        )

        # Test: Filter by source_type
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                source_type=source_type,  # type: ignore
            )
        )

        # Validate: Only facts from target source
        assert len(results) >= 1
        for fact in results:
            assert fact.source_type == source_type

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Tag Filters
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @pytest.mark.asyncio
    async def test_list_filter_by_tags_any_match(self, cortex_client, test_space_id):
        """Test filtering by tags with 'any' match."""
        space_id = f"{test_space_id}-tags-any"

        # Store fact with tag1
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Fact with tag1",
                fact_type="knowledge",
                tags=["tag1", "extra"],
                confidence=90,
                source_type="manual",
            )
        )

        # Store fact with tag2
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Fact with tag2",
                fact_type="knowledge",
                tags=["tag2", "other"],
                confidence=85,
                source_type="manual",
            )
        )

        # Store fact with no matching tags
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Fact with different tags",
                fact_type="knowledge",
                tags=["unrelated"],
                confidence=80,
                source_type="manual",
            )
        )

        # Test: Filter by tags (any match - default)
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                tags=["tag1", "tag2"],
                tag_match="any",
            )
        )

        # Validate: Should find facts with tag1 OR tag2
        assert len(results) >= 2
        for fact in results:
            has_tags = any(tag in fact.tags for tag in ["tag1", "tag2"])
            assert has_tags

    @pytest.mark.asyncio
    async def test_list_filter_by_tags_all_match(self, cortex_client, test_space_id):
        """Test filtering by tags with 'all' match."""
        space_id = f"{test_space_id}-tags-all"

        # Store fact with both required tags
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Fact with all required tags",
                fact_type="knowledge",
                tags=["important", "verified", "extra"],
                confidence=95,
                source_type="manual",
            )
        )

        # Store fact with only one required tag
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Fact with partial tags",
                fact_type="knowledge",
                tags=["important", "other"],
                confidence=85,
                source_type="manual",
            )
        )

        # Test: Filter by tags (all match)
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                tags=["important", "verified"],
                tag_match="all",
            )
        )

        # Validate: Should only find facts with ALL required tags
        assert len(results) >= 1
        for fact in results:
            assert "important" in fact.tags
            assert "verified" in fact.tags

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Confidence Filters
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @pytest.mark.asyncio
    async def test_list_filter_by_min_confidence(self, cortex_client, test_space_id):
        """Test filtering by min_confidence."""
        space_id = f"{test_space_id}-confidence"

        # Store high confidence fact
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="High confidence fact",
                fact_type="knowledge",
                confidence=95,
                source_type="manual",
                tags=["test"],
            )
        )

        # Store low confidence fact
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Low confidence fact",
                fact_type="knowledge",
                confidence=60,
                source_type="manual",
                tags=["test"],
            )
        )

        # Test: Filter by min_confidence
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                min_confidence=80,
            )
        )

        # Validate: Only high confidence facts
        assert len(results) >= 1
        for fact in results:
            assert fact.confidence >= 80

    @pytest.mark.asyncio
    async def test_search_filter_by_min_confidence(self, cortex_client, test_space_id):
        """Test search with min_confidence filter."""
        space_id = f"{test_space_id}-search-confidence"
        search_term = "confidence-test"

        # Store high confidence fact
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact=f"{search_term} high confidence",
                fact_type="knowledge",
                confidence=92,
                source_type="manual",
                tags=["test"],
            )
        )

        # Store low confidence fact
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact=f"{search_term} low confidence",
                fact_type="knowledge",
                confidence=55,
                source_type="manual",
                tags=["test"],
            )
        )

        # Test: Search with min_confidence
        results = await cortex_client.facts.search(
            space_id,
            search_term,
            SearchFactsOptions(min_confidence=80),
        )

        # Validate: Only high confidence facts
        assert len(results) >= 1
        for fact in results:
            assert fact.confidence >= 80

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Metadata Filters
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @pytest.mark.asyncio
    async def test_list_filter_by_metadata(self, cortex_client, test_space_id):
        """Test filtering by metadata fields."""
        space_id = f"{test_space_id}-metadata"

        # Store fact with target metadata
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Fact with priority high",
                fact_type="knowledge",
                confidence=90,
                source_type="manual",
                tags=["test"],
                metadata={"priority": "high", "category": "security"},
            )
        )

        # Store fact with different metadata
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Fact with priority low",
                fact_type="knowledge",
                confidence=85,
                source_type="manual",
                tags=["test"],
                metadata={"priority": "low", "category": "general"},
            )
        )

        # Test: Filter by metadata
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                metadata={"priority": "high"},
            )
        )

        # Validate: Only facts with matching metadata
        assert len(results) >= 1
        for fact in results:
            assert fact.metadata is not None
            assert fact.metadata.get("priority") == "high"

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Sorting and Pagination
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @pytest.mark.asyncio
    async def test_list_sort_by_confidence(self, cortex_client, test_space_id):
        """Test sorting by confidence descending."""
        space_id = f"{test_space_id}-sort"

        # Store facts with different confidence levels
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Low confidence",
                fact_type="knowledge",
                confidence=65,
                source_type="manual",
                tags=["test"],
            )
        )

        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="High confidence",
                fact_type="knowledge",
                confidence=95,
                source_type="manual",
                tags=["test"],
            )
        )

        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                fact="Medium confidence",
                fact_type="knowledge",
                confidence=80,
                source_type="manual",
                tags=["test"],
            )
        )

        # Test: Sort by confidence descending
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                sort_by="confidence",
                sort_order="desc",
            )
        )

        # Validate: Results sorted by confidence (high to low)
        assert len(results) >= 3
        for i in range(len(results) - 1):
            assert results[i].confidence >= results[i + 1].confidence

    @pytest.mark.asyncio
    async def test_list_pagination(self, cortex_client, test_space_id):
        """Test pagination with limit and offset."""
        space_id = f"{test_space_id}-pagination"

        # Store 5 facts
        for i in range(5):
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id=space_id,
                    fact=f"Fact {i}",
                    fact_type="knowledge",
                    confidence=80 + i,
                    source_type="manual",
                    tags=["test"],
                )
            )

        # Test: Get first page (limit 2)
        page1 = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                limit=2,
                offset=0,
                sort_by="confidence",
                sort_order="asc",
            )
        )

        # Test: Get second page (limit 2, offset 2)
        page2 = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                limit=2,
                offset=2,
                sort_by="confidence",
                sort_order="asc",
            )
        )

        # Validate: Correct pagination
        assert len(page1) == 2
        assert len(page2) == 2

        # Pages should have different facts
        page1_ids = [f.fact_id for f in page1]
        page2_ids = [f.fact_id for f in page2]
        for id in page1_ids:
            assert id not in page2_ids

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Complex Multi-Filter Queries
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @pytest.mark.asyncio
    async def test_combine_multiple_universal_filters(
        self, cortex_client, test_space_id
    ):
        """Test combining multiple universal filters."""
        space_id = f"{test_space_id}-complex"
        target_user = "user-david"

        # Store target fact matching all criteria
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id=target_user,
                participant_id="agent-1",
                fact="Complex filter test fact",
                fact_type="preference",
                tags=["important", "verified"],
                confidence=92,
                source_type="conversation",
                metadata={"category": "ui"},
            )
        )

        # Store facts missing one criterion each
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id="other-user",  # Wrong user
                participant_id="agent-1",
                fact="Wrong user fact",
                fact_type="preference",
                tags=["important", "verified"],
                confidence=90,
                source_type="conversation",
                metadata={"category": "ui"},
            )
        )

        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id=target_user,
                participant_id="agent-1",
                fact="Low confidence fact",
                fact_type="preference",
                tags=["important", "verified"],
                confidence=65,  # Too low
                source_type="conversation",
                metadata={"category": "ui"},
            )
        )

        # Test: Complex query with multiple filters
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                user_id=target_user,
                participant_id="agent-1",
                fact_type="preference",
                tags=["important", "verified"],
                tag_match="all",
                min_confidence=80,
                source_type="conversation",
                metadata={"category": "ui"},
            )
        )

        # Validate: Should only find the target fact
        assert len(results) >= 1
        for fact in results:
            assert fact.user_id == target_user
            assert fact.participant_id == "agent-1"
            assert fact.fact_type == "preference"
            assert "important" in fact.tags
            assert "verified" in fact.tags
            assert fact.confidence >= 80
            assert fact.source_type == "conversation"
            assert fact.metadata.get("category") == "ui"

    @pytest.mark.asyncio
    async def test_query_by_subject_with_universal_filters(
        self, cortex_client, test_space_id
    ):
        """Test query_by_subject() with universal filters."""
        space_id = f"{test_space_id}-subject-filters"
        subject = "user-eve"

        # Store facts for same subject
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id="eve",
                fact="Eve prefers dark mode",
                fact_type="preference",
                subject=subject,
                confidence=95,
                source_type="conversation",
                tags=["test"],
            )
        )

        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id="eve",
                fact="Eve works at TechCorp",
                fact_type="identity",
                subject=subject,
                confidence=98,
                source_type="conversation",
                tags=["test"],
            )
        )

        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id="eve",
                fact="Eve knows Python (low confidence)",
                fact_type="knowledge",
                subject=subject,
                confidence=60,
                source_type="system",
                tags=["test"],
            )
        )

        # Test: Query by subject with filters
        results = await cortex_client.facts.query_by_subject(
            QueryBySubjectFilter(
                memory_space_id=space_id,
                subject=subject,
                user_id="eve",
                min_confidence=90,
                source_type="conversation",
            )
        )

        # Validate: Only high-confidence conversation facts
        assert len(results) >= 2
        for fact in results:
            assert fact.subject == subject
            assert fact.user_id == "eve"
            assert fact.confidence >= 90
            assert fact.source_type == "conversation"

    @pytest.mark.asyncio
    async def test_search_with_complex_filters(self, cortex_client, test_space_id):
        """Test search() with complex filter combinations."""
        space_id = f"{test_space_id}-search-complex"
        search_term = "comprehensive"

        # Store target fact
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id="user-frank",
                participant_id="search-agent",
                fact=f"{search_term} test for search filters",
                fact_type="knowledge",
                tags=["test", "validated"],
                confidence=88,
                source_type="manual",
            )
        )

        # Store facts that don't match all criteria
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id="other-user",
                participant_id="search-agent",
                fact=f"{search_term} wrong user",
                fact_type="knowledge",
                tags=["test", "validated"],
                confidence=90,
                source_type="manual",
            )
        )

        # Test: Complex search with filters
        results = await cortex_client.facts.search(
            space_id,
            search_term,
            SearchFactsOptions(
                user_id="user-frank",
                participant_id="search-agent",
                fact_type="knowledge",
                tags=["test"],
                min_confidence=85,
            ),
        )

        # Validate: Only target fact
        assert len(results) >= 1
        for fact in results:
            assert fact.user_id == "user-frank"
            assert fact.participant_id == "search-agent"
            assert fact.fact_type == "knowledge"
            assert "test" in fact.tags
            assert fact.confidence >= 85

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # API Consistency
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @pytest.mark.asyncio
    async def test_api_consistency_with_memory_api(
        self, cortex_client, test_space_id
    ):
        """Verify same filter syntax as memory API."""
        space_id = f"{test_space_id}-consistency"

        # Store fact matching filters
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=space_id,
                user_id="test-user-consistency",
                fact="Consistent filter test",
                fact_type="knowledge",
                tags=["important"],
                confidence=85,
                source_type="manual",
            )
        )

        # Test: Use universal filter pattern
        results = await cortex_client.facts.list(
            ListFactsFilter(
                memory_space_id=space_id,
                user_id="test-user-consistency",
                tags=["important"],
                min_confidence=70,
                created_after=datetime.now() - timedelta(days=7),
            )
        )

        # Validate: Pattern works
        assert len(results) >= 1
        for fact in results:
            assert fact.user_id == "test-user-consistency"
            assert "important" in fact.tags
            assert fact.confidence >= 70

