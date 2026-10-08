"""
Comprehensive enum-based filter tests for Memory Spaces API.

Tests all 4 types and 2 statuses across list operation to ensure:
1. No ArgumentValidationError for valid enum values
2. Filters return only matching results
3. Combining type and status filters works

Port of: Comprehensive filter coverage (new tests)
"""

import pytest

from cortex.types import RegisterMemorySpaceParams
from tests.helpers import generate_test_memory_space_id

# All valid memory space types and statuses
ALL_SPACE_TYPES = ["personal", "team", "project", "custom"]
ALL_SPACE_STATUSES = ["active", "archived"]


@pytest.mark.parametrize("space_type", ALL_SPACE_TYPES)
class TestMemorySpacesTypeFilterParametrized:
    """Parametrized tests covering all memory space types."""

    @pytest.mark.asyncio
    async def test_list_filters_by_type(self, cortex_client, space_type):
        """Test memory_spaces.list() filters correctly by type."""
        # Register space with target type
        space_id = generate_test_memory_space_id()
        _target_space = await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id,
                type=space_type,
                name=f"Test {space_type} space",
            )
        )

        # Register space with different type as noise
        if space_type != "personal":
            noise_id = generate_test_memory_space_id()
            await cortex_client.memory_spaces.register(
                RegisterMemorySpaceParams(
                    memory_space_id=noise_id,
                    type="personal",
                    name="Noise personal space",
                )
            )

        # Execute: List with type filter
        results = await cortex_client.memory_spaces.list(type=space_type)

        # Extract spaces from response
        spaces = results.spaces if hasattr(results, 'spaces') else results

        # Validate
        assert len(spaces) >= 1, f"Should find at least 1 {space_type} space"
        for space in spaces:
            assert (
                space.type == space_type
            ), f"All results should be {space_type}, got {space.type}"

        # Verify target space is in results
        space_ids = [s.memory_space_id for s in spaces]
        assert space_id in space_ids, f"Target {space_type} space should be in results"


@pytest.mark.parametrize("status", ALL_SPACE_STATUSES)
class TestMemorySpacesStatusFilterParametrized:
    """Parametrized tests covering all memory space statuses."""

    @pytest.mark.asyncio
    async def test_list_filters_by_status(self, cortex_client, status):
        """Test memory_spaces.list() filters correctly by status."""
        # Register space (active by default)
        space_id = generate_test_memory_space_id()
        space = await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id,
                type="personal",
                name=f"Test space for {status} status",
            )
        )

        # Archive if testing archived status
        if status == "archived":
            await cortex_client.memory_spaces.archive(space_id)

        # Execute: List with status filter
        results = await cortex_client.memory_spaces.list(status=status)

        # Extract spaces from response
        spaces = results.spaces if hasattr(results, 'spaces') else results

        # Validate
        assert len(spaces) >= 1, f"Should find at least 1 {status} space"
        for space in spaces:
            assert (
                space.status == status
            ), f"All results should be {status}, got {space.status}"


class TestMemorySpacesFilterEdgeCases:
    """Edge case tests for memory spaces filter operations."""

    @pytest.mark.asyncio
    async def test_list_filter_no_matches_type(self, cortex_client):
        """Test list with type filter when no matches exist."""
        # Register only personal spaces
        space_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id,
                type="personal",
                name="Only personal space",
            )
        )

        # Query for different type
        results = await cortex_client.memory_spaces.list(type="team")

        # Extract spaces
        spaces = results.spaces if hasattr(results, 'spaces') else results

        # Should return empty list, not error
        # Note: May return results if team spaces already exist in test environment
        # So we just verify no error is thrown
        assert isinstance(spaces, list), "Should return list"

    @pytest.mark.asyncio
    async def test_combine_type_and_status_filters(self, cortex_client):
        """Test combining type and status filters."""
        # Register active team space
        active_team_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=active_team_id,
                type="team",
                name="Active team space",
            )
        )

        # Register active personal space (different type)
        active_personal_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=active_personal_id,
                type="personal",
                name="Active personal space",
            )
        )

        # Archive a team space
        archived_team_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=archived_team_id,
                type="team",
                name="Archived team space",
            )
        )
        await cortex_client.memory_spaces.archive(archived_team_id)

        # Execute: Filter by type AND status
        results = await cortex_client.memory_spaces.list(type="team", status="active")

        # Extract spaces
        spaces = results.spaces if hasattr(results, 'spaces') else results

        # Validate: Should only find active team space
        assert len(spaces) >= 1, "Should find active team spaces"
        for space in spaces:
            assert space.type == "team", "All should be team type"
            assert space.status == "active", "All should be active"
        assert any(s.memory_space_id == active_team_id for s in spaces)

    @pytest.mark.asyncio
    async def test_all_space_types_coexist(self, cortex_client):
        """Test that all space types can coexist and be filtered correctly."""
        # Register one space of each type
        spaces_by_type = {}
        for space_type in ALL_SPACE_TYPES:
            space_id = generate_test_memory_space_id()
            space = await cortex_client.memory_spaces.register(
                RegisterMemorySpaceParams(
                    memory_space_id=space_id,
                    type=space_type,
                    name=f"Test {space_type} space",
                )
            )
            spaces_by_type[space_type] = space

        # Verify each type filter returns correct spaces
        for space_type in ALL_SPACE_TYPES:
            results = await cortex_client.memory_spaces.list(type=space_type)
            spaces = results.spaces if hasattr(results, 'spaces') else results
            assert len(spaces) >= 1, f"Should find {space_type} spaces"
            assert all(s.type == space_type for s in spaces)
            assert any(
                s.memory_space_id == spaces_by_type[space_type].memory_space_id
                for s in spaces
            )

    @pytest.mark.asyncio
    async def test_status_transition_active_to_archived(self, cortex_client):
        """Test status change from active to archived."""
        # Register active space
        space_id = generate_test_memory_space_id()
        _space = await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id,
                type="project",
                name="Transitioning space",
            )
        )

        # Verify it's in active list
        active_results = await cortex_client.memory_spaces.list(status="active")
        active_spaces = active_results.spaces if hasattr(active_results, 'spaces') else active_results
        assert any(s.memory_space_id == space_id for s in active_spaces)

        # Archive it
        await cortex_client.memory_spaces.archive(space_id)

        # Verify it's now in archived list
        archived_results = await cortex_client.memory_spaces.list(status="archived")
        archived_spaces = archived_results.spaces if hasattr(archived_results, 'spaces') else archived_results
        assert any(s.memory_space_id == space_id for s in archived_spaces)

        # Verify it's NOT in active list anymore
        active_results_after = await cortex_client.memory_spaces.list(status="active")
        active_spaces_after = active_results_after.spaces if hasattr(active_results_after, 'spaces') else active_results_after
        assert not any(s.memory_space_id == space_id for s in active_spaces_after)

    @pytest.mark.asyncio
    async def test_list_filter_multiple_results_by_type(self, cortex_client):
        """Test list with type filter returns all matching results."""
        # Register 3 custom spaces
        custom_ids = []
        for i in range(3):
            space_id = generate_test_memory_space_id()
            await cortex_client.memory_spaces.register(
                RegisterMemorySpaceParams(
                    memory_space_id=space_id,
                    type="custom",
                    name=f"Custom space {i}",
                )
            )
            custom_ids.append(space_id)

        # Register personal space as noise
        noise_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=noise_id,
                type="personal",
                name="Noise space",
            )
        )

        # Query for custom type
        results = await cortex_client.memory_spaces.list(type="custom")

        # Extract spaces
        spaces = results.spaces if hasattr(results, 'spaces') else results

        # Should return at least our 3 custom spaces
        assert len(spaces) >= 3, "Should return at least 3 custom spaces"
        for space in spaces:
            assert space.type == "custom"

        # Verify all our custom spaces are in results
        result_ids = [s.memory_space_id for s in spaces]
        for custom_id in custom_ids:
            assert (
                custom_id in result_ids
            ), f"Custom space {custom_id} should be in results"

    @pytest.mark.asyncio
    async def test_list_no_filter_returns_all(self, cortex_client):
        """Test list without filters returns spaces of all types and statuses."""
        # Register spaces of different types
        personal_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=personal_id,
                type="personal",
                name="Personal space",
            )
        )

        team_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=team_id,
                type="team",
                name="Team space",
            )
        )

        # List all (no filters)
        all_results = await cortex_client.memory_spaces.list()

        # Extract spaces
        all_spaces = all_results.spaces if hasattr(all_results, 'spaces') else all_results

        # Should include both
        assert len(all_spaces) >= 2, "Should return multiple spaces"
        result_ids = [s.memory_space_id for s in all_spaces]
        assert personal_id in result_ids
        assert team_id in result_ids

    @pytest.mark.asyncio
    async def test_archived_filter_excludes_active(self, cortex_client):
        """Test archived filter only returns archived spaces, not active ones."""
        # Register active space
        active_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=active_id,
                type="project",
                name="Active space",
            )
        )

        # Register and archive another space
        archived_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=archived_id,
                type="project",
                name="To be archived",
            )
        )
        await cortex_client.memory_spaces.archive(archived_id)

        # Query for archived only
        archived_results = await cortex_client.memory_spaces.list(status="archived")

        # Extract spaces
        archived_spaces = archived_results.spaces if hasattr(archived_results, 'spaces') else archived_results

        # Active space should NOT be in archived results
        archived_ids = [s.memory_space_id for s in archived_spaces]
        assert (
            active_id not in archived_ids
        ), "Active space should not be in archived results"

    @pytest.mark.asyncio
    async def test_combine_filters_different_types_same_status(self, cortex_client):
        """Test that different types with same status can be filtered independently."""
        # Register active personal space
        personal_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=personal_id,
                type="personal",
                name="Active personal",
            )
        )

        # Register active team space
        team_id = generate_test_memory_space_id()
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=team_id,
                type="team",
                name="Active team",
            )
        )

        # List active personal only
        personal_results = await cortex_client.memory_spaces.list(
            type="personal", status="active"
        )
        personal_spaces = personal_results.spaces if hasattr(personal_results, 'spaces') else personal_results
        personal_ids = [s.memory_space_id for s in personal_spaces]
        assert personal_id in personal_ids
        # Team should not be in personal results
        assert team_id not in personal_ids

        # List active team only
        team_results = await cortex_client.memory_spaces.list(
            type="team", status="active"
        )
        team_spaces = team_results.spaces if hasattr(team_results, 'spaces') else team_results
        team_ids = [s.memory_space_id for s in team_spaces]
        assert team_id in team_ids
        # Personal should not be in team results
        assert personal_id not in team_ids
