"""
Progressive Storage Handler Tests

Tests that validate ACTUAL storage operations in Convex.
Verifies partial memory creation, updates, and finalization.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from cortex.memory.streaming.progressive_storage_handler import (
    ProgressiveStorageHandler,
    calculate_optimal_update_interval,
)


class TestProgressiveStorageHandler:
    """Test suite for ProgressiveStorageHandler with actual storage validation"""

    @pytest.mark.asyncio
    async def test_initialize_creates_partial_memory(self):
        """
        Test: Initialize creates partial memory in Convex
        Validates: Partial memory ID is returned and stored
        """
        # Mock Convex client
        mock_client = MagicMock()
        mock_client.mutation = AsyncMock(return_value={"memoryId": "partial-mem-123"})

        handler = ProgressiveStorageHandler(
            client=mock_client,
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
        )

        # Initialize partial memory
        memory_id = await handler.initialize_partial_memory(
            user_message="Test message", importance=60, tags=["test"]
        )

        # CRITICAL: Validate initialization
        assert memory_id == "partial-mem-123"
        assert handler.is_ready() is True
        assert handler.is_complete() is False
        assert handler.get_partial_memory_id() == "partial-mem-123"

        # Validate mutation was called with correct params
        mock_client.mutation.assert_called_once()
        call_args = mock_client.mutation.call_args
        assert call_args[0][0] == "memories:storePartialMemory"
        assert call_args[0][1]["isPartial"] is True
        assert call_args[0][1]["content"] == "[Streaming in progress...]"

    @pytest.mark.asyncio
    async def test_update_respects_interval(self):
        """
        Test: Updates only happen after interval passes
        Validates: Update timing logic
        """
        mock_client = MagicMock()
        mock_client.mutation = AsyncMock(return_value={"memoryId": "partial-mem-123"})

        handler = ProgressiveStorageHandler(
            client=mock_client,
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            update_interval=100,  # 100ms interval
        )

        # Initialize
        await handler.initialize_partial_memory(user_message="Test")

        # Reset mock to track update calls
        mock_client.mutation.reset_mock()

        # Try immediate update (should be skipped)
        updated = await handler.update_partial_content("Content 1", chunk_number=1, force=False)
        assert updated is False, "Should skip update (too soon)"

        # Wait for interval
        await asyncio.sleep(0.11)  # 110ms

        # Try update again (should succeed)
        updated = await handler.update_partial_content("Content 2", chunk_number=2, force=False)
        assert updated is True, "Should allow update after interval"

        # CRITICAL: Validate update was called
        assert mock_client.mutation.call_count == 1

    @pytest.mark.asyncio
    async def test_force_update_bypasses_interval(self):
        """
        Test: Forced updates bypass interval check
        Validates: Force flag works correctly
        """
        mock_client = MagicMock()
        mock_client.mutation = AsyncMock(return_value={"memoryId": "partial-mem-123"})

        handler = ProgressiveStorageHandler(
            client=mock_client,
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            update_interval=10000,  # Very long interval
        )

        await handler.initialize_partial_memory(user_message="Test")
        mock_client.mutation.reset_mock()

        # Force update immediately
        updated = await handler.update_partial_content("Forced content", chunk_number=1, force=True)

        # CRITICAL: Validate force worked
        assert updated is True, "Force update should succeed"
        assert mock_client.mutation.call_count == 1

    @pytest.mark.asyncio
    async def test_update_history_tracks_all_updates(self):
        """
        Test: Update history records all updates
        Validates: History length and content accuracy
        """
        mock_client = MagicMock()
        mock_client.mutation = AsyncMock(return_value={"memoryId": "partial-mem-123"})

        handler = ProgressiveStorageHandler(
            client=mock_client,
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            update_interval=10,  # Very short for testing
        )

        await handler.initialize_partial_memory(user_message="Test")

        # Perform multiple updates
        for i in range(3):
            await asyncio.sleep(0.02)
            await handler.update_partial_content(f"Content {i}", chunk_number=i + 1, force=True)

        # CRITICAL: Validate update history
        history = handler.get_update_history()
        assert len(history) == 3, f"Expected 3 updates in history, got {len(history)}"

        # Validate each update record
        for i, update in enumerate(history):
            assert update.memory_id == "partial-mem-123"
            assert update.chunk_number == i + 1
            assert update.content_length == len(f"Content {i}")

    @pytest.mark.asyncio
    async def test_finalize_marks_complete(self):
        """
        Test: Finalize marks memory as complete
        Validates: State transitions and finalization
        """
        mock_client = MagicMock()
        mock_client.mutation = AsyncMock(return_value={"memoryId": "partial-mem-123"})

        handler = ProgressiveStorageHandler(
            client=mock_client,
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
        )

        await handler.initialize_partial_memory(user_message="Test")

        # Finalize
        await handler.finalize_memory("Complete content", embedding=[0.1, 0.2, 0.3])

        # CRITICAL: Validate finalization
        assert handler.is_complete() is True
        assert handler.is_ready() is False  # No longer ready for updates

        # Validate finalize mutation was called
        finalize_calls = [
            call for call in mock_client.mutation.call_args_list
            if call[0][0] == "memories:finalizePartialMemory"
        ]
        assert len(finalize_calls) == 1

    @pytest.mark.asyncio
    async def test_rollback_cleans_up_state(self):
        """
        Test: Rollback deletes partial memory and resets state
        Validates: State is completely cleared
        """
        mock_client = MagicMock()
        mock_client.mutation = AsyncMock(return_value={"memoryId": "partial-mem-123"})

        handler = ProgressiveStorageHandler(
            client=mock_client,
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
        )

        await handler.initialize_partial_memory(user_message="Test")
        await handler.update_partial_content("Content", chunk_number=1, force=True)

        # Rollback
        await handler.rollback()

        # CRITICAL: Validate state is cleared
        assert handler.get_partial_memory_id() is None
        assert handler.is_ready() is False
        assert handler.is_complete() is False
        assert len(handler.get_update_history()) == 0

    def test_should_update_logic(self):
        """
        Test: should_update() logic is correct
        Validates: Timing-based update decisions
        """
        mock_client = MagicMock()

        handler = ProgressiveStorageHandler(
            client=mock_client,
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            update_interval=1000,
        )

        # Before initialization
        assert handler.should_update() is False

    def test_calculate_optimal_update_interval(self):
        """
        Test: Optimal interval calculation is reasonable
        Validates: Interval recommendations for different stream types
        """
        # Fast stream (>10 chunks/sec)
        fast_interval = calculate_optimal_update_interval(
            average_chunk_size=50.0, chunks_per_second=15.0
        )
        assert fast_interval == 5000, "Fast streams should update every 5s"

        # Slow stream (<1 chunk/sec)
        slow_interval = calculate_optimal_update_interval(
            average_chunk_size=100.0, chunks_per_second=0.5
        )
        assert slow_interval == 1000, "Slow streams should update every 1s"

        # Medium stream
        medium_interval = calculate_optimal_update_interval(
            average_chunk_size=75.0, chunks_per_second=5.0
        )
        assert medium_interval == 3000, "Medium streams should update every 3s"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
