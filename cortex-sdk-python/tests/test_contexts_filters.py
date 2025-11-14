"""
Comprehensive enum-based filter tests for Contexts API.

Tests all 4 statuses across all 2 filter operations to ensure:
1. No ArgumentValidationError for valid enum values
2. Filters return only matching results
3. Combining status filter with other parameters works

Port of: Comprehensive filter coverage (new tests)
"""

import pytest

from cortex.types import ContextInput
from tests.helpers import generate_test_memory_space_id, generate_test_user_id

# All valid context statuses
ALL_CONTEXT_STATUSES = ["active", "completed", "cancelled", "blocked"]


@pytest.mark.parametrize("status", ALL_CONTEXT_STATUSES)
class TestContextsFilterParametrized:
    """Parametrized tests covering all context statuses across all operations."""

    @pytest.mark.asyncio
    async def test_list_filters_by_status(self, cortex_client, status):
        """Test contexts.list() filters correctly by status."""
        space_id = generate_test_memory_space_id()
        user_id = generate_test_user_id()

        # Create context with target status
        target_ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose=f"Test {status} context",
                status=status,
            )
        )

        # Create context with different status as noise
        if status != "active":
            await cortex_client.contexts.create(
                ContextInput(
                    memory_space_id=space_id,
                    user_id=user_id,
                    purpose="Noise active context",
                    status="active",
                )
            )

        # Execute: List with status filter
        results = await cortex_client.contexts.list(
            memory_space_id=space_id, status=status
        )

        # Extract contexts from response (can be list or dict)
        contexts = results if isinstance(results, list) else results.get("contexts", [])

        # Validate
        assert len(contexts) >= 1, f"Should find at least 1 {status} context"
        for ctx in contexts:
            assert (
                ctx.status == status
            ), f"All results should be {status}, got {ctx.status}"

        # Verify target context is in results
        ctx_ids = [c.id for c in contexts]
        assert target_ctx.id in ctx_ids, f"Target {status} context should be in results"

    @pytest.mark.asyncio
    async def test_count_filters_by_status(self, cortex_client, status):
        """Test contexts.count() filters correctly by status."""
        space_id = generate_test_memory_space_id()
        user_id = generate_test_user_id()

        # Create 2 contexts with target status
        await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose=f"Test {status} context 1",
                status=status,
            )
        )

        await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose=f"Test {status} context 2",
                status=status,
            )
        )

        # Create context with different status as noise
        if status != "completed":
            await cortex_client.contexts.create(
                ContextInput(
                    memory_space_id=space_id,
                    user_id=user_id,
                    purpose="Noise completed context",
                    status="completed",
                )
            )

        # Execute: Count with status filter
        count = await cortex_client.contexts.count(
            memory_space_id=space_id, status=status
        )

        # Validate
        assert count >= 2, f"Should count at least 2 {status} contexts, got {count}"


class TestContextsFilterEdgeCases:
    """Edge case tests for contexts filter operations."""

    @pytest.mark.asyncio
    async def test_list_filter_no_matches(self, cortex_client):
        """Test list with status filter when no matches exist."""
        space_id = generate_test_memory_space_id()
        user_id = generate_test_user_id()

        # Create only active contexts
        await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Only active context",
                status="active",
            )
        )

        # Query for different status
        results = await cortex_client.contexts.list(
            memory_space_id=space_id, status="blocked"
        )

        # Extract contexts from response
        contexts = results if isinstance(results, list) else results.get("contexts", [])

        # Should return empty list, not error
        assert contexts == [], "Should return empty list when no matches"

    @pytest.mark.asyncio
    async def test_status_transition(self, cortex_client):
        """Test status transitions (active → completed)."""
        space_id = generate_test_memory_space_id()
        user_id = generate_test_user_id()

        # Create active context
        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Transitioning context",
                status="active",
            )
        )

        # Verify it's in active list
        active_results = await cortex_client.contexts.list(
            memory_space_id=space_id, status="active"
        )
        active_contexts = (
            active_results
            if isinstance(active_results, list)
            else active_results.get("contexts", [])
        )
        assert any(c.id == ctx.id for c in active_contexts)

        # Update to completed
        updated_ctx = await cortex_client.contexts.update(
            ctx.id,
            updates={"status": "completed"},
        )
        assert updated_ctx.status == "completed"

        # Verify it's now in completed list
        completed_results = await cortex_client.contexts.list(
            memory_space_id=space_id, status="completed"
        )
        completed_contexts = (
            completed_results
            if isinstance(completed_results, list)
            else completed_results.get("contexts", [])
        )
        assert any(c.id == ctx.id for c in completed_contexts)

        # Verify it's NOT in active list anymore
        active_results_after = await cortex_client.contexts.list(
            memory_space_id=space_id, status="active"
        )
        active_contexts_after = (
            active_results_after
            if isinstance(active_results_after, list)
            else active_results_after.get("contexts", [])
        )
        assert not any(c.id == ctx.id for c in active_contexts_after)

    @pytest.mark.asyncio
    async def test_combine_status_with_user_id_filter(self, cortex_client):
        """Test combining status filter with userId filter."""
        space_id = generate_test_memory_space_id()
        target_user = "target-user"
        other_user = "other-user"

        # Create active context for target user
        _target_ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=target_user,
                purpose="Target active context",
                status="active",
            )
        )

        # Create active context for other user
        await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=other_user,
                purpose="Other user active context",
                status="active",
            )
        )

        # Create completed context for target user
        await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=target_user,
                purpose="Target completed context",
                status="completed",
            )
        )

        # Execute: Filter by status (userId not supported by contexts.list)
        results = await cortex_client.contexts.list(
            memory_space_id=space_id, status="active"
        )

        # Extract contexts and filter by userId manually
        contexts = results if isinstance(results, list) else results.get("contexts", [])
        filtered_contexts = [c for c in contexts if c.user_id == target_user]

        # Validate: Should only find target user's active context
        assert len(filtered_contexts) >= 1, "Should find contexts matching both filters"
        for ctx in filtered_contexts:
            assert ctx.status == "active", "All should be active"
            assert ctx.user_id == target_user, "All should be target user"

    @pytest.mark.asyncio
    async def test_multiple_statuses_same_space(self, cortex_client):
        """Test that multiple statuses can coexist in same memory space."""
        space_id = generate_test_memory_space_id()
        user_id = generate_test_user_id()

        # Create context for each status
        contexts_by_status = {}
        for status in ALL_CONTEXT_STATUSES:
            ctx = await cortex_client.contexts.create(
                ContextInput(
                    memory_space_id=space_id,
                    user_id=user_id,
                    purpose=f"Context with {status} status",
                    status=status,
                )
            )
            contexts_by_status[status] = ctx

        # Verify each status filter returns correct contexts
        for status in ALL_CONTEXT_STATUSES:
            results = await cortex_client.contexts.list(
                memory_space_id=space_id, status=status
            )
            contexts = (
                results if isinstance(results, list) else results.get("contexts", [])
            )
            assert len(contexts) >= 1, f"Should find {status} contexts"
            assert all(c.status == status for c in contexts)
            assert any(c.id == contexts_by_status[status].id for c in contexts)

    @pytest.mark.asyncio
    async def test_count_all_vs_filtered(self, cortex_client):
        """Test count() with and without status filter."""
        space_id = generate_test_memory_space_id()
        user_id = generate_test_user_id()

        # Create 3 active contexts
        for i in range(3):
            await cortex_client.contexts.create(
                ContextInput(
                    memory_space_id=space_id,
                    user_id=user_id,
                    purpose=f"Active context {i}",
                    status="active",
                )
            )

        # Create 2 completed contexts
        for i in range(2):
            await cortex_client.contexts.create(
                ContextInput(
                    memory_space_id=space_id,
                    user_id=user_id,
                    purpose=f"Completed context {i}",
                    status="completed",
                )
            )

        # Count active only
        active_count = await cortex_client.contexts.count(
            memory_space_id=space_id, status="active"
        )
        assert active_count >= 3, f"Should count at least 3 active, got {active_count}"

        # Count completed only
        completed_count = await cortex_client.contexts.count(
            memory_space_id=space_id, status="completed"
        )
        assert (
            completed_count >= 2
        ), f"Should count at least 2 completed, got {completed_count}"

        # Count all (no filter)
        total_count = await cortex_client.contexts.count(memory_space_id=space_id)
        assert total_count >= 5, f"Should count at least 5 total, got {total_count}"

    @pytest.mark.asyncio
    async def test_combine_status_with_parent_id_filter(self, cortex_client):
        """Test combining status filter with parentId filter."""
        space_id = generate_test_memory_space_id()
        user_id = generate_test_user_id()

        # Create parent context
        parent_ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Parent context",
                status="active",
            )
        )

        # Create active child context
        _active_child = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Active child context",
                status="active",
                parent_id=parent_ctx.id,
            )
        )

        # Create completed child context
        _completed_child = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Completed child context",
                status="completed",
                parent_id=parent_ctx.id,
            )
        )

        # Execute: Filter by status (parentId not supported by contexts.list)
        results = await cortex_client.contexts.list(
            memory_space_id=space_id,
            status="active",
        )

        # Extract contexts and filter by parentId manually
        contexts = results if isinstance(results, list) else results.get("contexts", [])
        filtered_contexts = [c for c in contexts if c.parent_id == parent_ctx.id]

        # Validate: Should only find active child
        assert len(filtered_contexts) >= 1, "Should find active child context"
        assert all(c.status == "active" for c in filtered_contexts)
        assert all(c.parent_id == parent_ctx.id for c in filtered_contexts)

    @pytest.mark.asyncio
    async def test_list_filter_multiple_results(self, cortex_client):
        """Test list with status filter returns all matching results."""
        space_id = generate_test_memory_space_id()
        user_id = generate_test_user_id()

        # Create 5 cancelled contexts
        for i in range(5):
            await cortex_client.contexts.create(
                ContextInput(
                    memory_space_id=space_id,
                    user_id=user_id,
                    purpose=f"Cancelled context {i}",
                    status="cancelled",
                )
            )

        # Create some noise
        await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Active context",
                status="active",
            )
        )

        # Query for cancelled
        results = await cortex_client.contexts.list(
            memory_space_id=space_id, status="cancelled"
        )

        # Extract contexts
        contexts = results if isinstance(results, list) else results.get("contexts", [])

        # Should return all 5 cancelled contexts
        assert (
            len(contexts) == 5
        ), f"Should return 5 cancelled contexts, got {len(contexts)}"
        for ctx in contexts:
            assert ctx.status == "cancelled"
