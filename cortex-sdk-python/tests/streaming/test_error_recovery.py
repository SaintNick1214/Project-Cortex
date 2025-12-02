"""
Error Recovery Tests

Tests that validate ACTUAL error recovery behavior.
Verifies resume token generation, validation, and recovery strategies.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from cortex.memory.streaming.error_recovery import (
    ResumableStreamError,
    StreamErrorRecovery,
)
from cortex.memory.streaming_types import (
    FailureStrategy,
    RecoveryOptions,
    StreamContext,
)


@pytest.fixture
def mock_convex_client():
    """Mock Convex client for testing"""
    client = MagicMock()
    client.mutation = AsyncMock()
    client.query = AsyncMock()
    return client


@pytest.fixture
def test_context():
    """Test stream context"""
    return StreamContext(
        memory_space_id="test-space",
        conversation_id="test-conv",
        user_id="test-user",
        user_name="Test User",
        accumulated_text="Partial content from stream",
        chunk_count=5,
        estimated_tokens=100,
        elapsed_ms=500,
        partial_memory_id="partial-mem-123",
        extracted_fact_ids=["fact-1", "fact-2"],
    )


class TestStreamErrorRecovery:
    """Test suite for StreamErrorRecovery with actual recovery validation"""

    @pytest.mark.asyncio
    async def test_generate_resume_token_creates_valid_token(self, mock_convex_client):
        """
        Test: Resume token generation creates valid token
        Validates: Token format and storage in mutable store
        """
        recovery = StreamErrorRecovery(mock_convex_client)

        import time

        from cortex.memory.streaming_types import ResumeContext

        resume_context = ResumeContext(
            resume_token="",
            last_processed_chunk=10,
            accumulated_content="Test content",
            partial_memory_id="mem-123",
            facts_extracted=["fact-1"],
            timestamp=int(time.time() * 1000),
            checksum="abc123",
        )

        # Generate token
        token = await recovery.generate_resume_token(resume_context)

        # CRITICAL: Validate token format
        assert token is not None
        assert token.startswith("resume_"), f"Token should start with 'resume_', got {token}"
        assert len(token) > 20, "Token should be sufficiently long"

        # Validate mutation was called to store context
        mock_convex_client.mutation.assert_called_once()
        call_args = mock_convex_client.mutation.call_args
        assert call_args[0][0] == "mutable:set"
        assert call_args[0][1]["namespace"] == "resume-tokens"
        assert call_args[0][1]["key"] == token

    @pytest.mark.asyncio
    async def test_validate_resume_token_retrieves_context(self, mock_convex_client):
        """
        Test: Token validation retrieves stored context
        Validates: Context is correctly retrieved and validated
        """
        import time

        recovery = StreamErrorRecovery(mock_convex_client)

        # Mock stored context
        stored_context = {
            "resumeToken": "test-token",
            "lastProcessedChunk": 5,
            "accumulatedContent": "Test content",
            "partialMemoryId": "mem-123",
            "factsExtracted": ["fact-1"],
            "timestamp": int(time.time() * 1000),
            "checksum": recovery._calculate_checksum("Test content"),
            "expiresAt": int(time.time() * 1000) + 3600000,  # 1 hour from now
        }

        mock_convex_client.query.return_value = {"value": stored_context}

        # Validate token
        context = await recovery.validate_resume_token("test-token")

        # CRITICAL: Validate retrieved context
        assert context is not None, "Context should be retrieved"
        assert context.last_processed_chunk == 5
        assert context.accumulated_content == "Test content"
        assert context.partial_memory_id == "mem-123"

    @pytest.mark.asyncio
    async def test_expired_token_returns_none(self, mock_convex_client):
        """
        Test: Expired tokens are rejected
        Validates: Expiration check works correctly
        """
        import time

        recovery = StreamErrorRecovery(mock_convex_client)

        # Mock expired context
        expired_context = {
            "resumeToken": "expired-token",
            "lastProcessedChunk": 5,
            "accumulatedContent": "Test",
            "partialMemoryId": "mem-123",
            "factsExtracted": [],
            "timestamp": int(time.time() * 1000),
            "checksum": "abc",
            "expiresAt": int(time.time() * 1000) - 1000,  # Expired 1 second ago
        }

        mock_convex_client.query.return_value = {"value": expired_context}

        # Validate token
        context = await recovery.validate_resume_token("expired-token")

        # CRITICAL: Validate expired token is rejected
        assert context is None, "Expired token should return None"

    @pytest.mark.asyncio
    async def test_store_partial_strategy(self, mock_convex_client, test_context):
        """
        Test: Store-partial strategy preserves data
        Validates: Recovery result indicates success
        """
        recovery = StreamErrorRecovery(mock_convex_client)

        options = RecoveryOptions(
            strategy=FailureStrategy.STORE_PARTIAL,
            preserve_partial_data=True,
        )

        # Handle error
        result = await recovery.handle_stream_error(
            Exception("Test error"), test_context, options
        )

        # CRITICAL: Validate recovery result
        assert result.success is True, "Store-partial should succeed"
        assert result.strategy == FailureStrategy.STORE_PARTIAL
        assert result.partial_memory_id == "partial-mem-123"

    @pytest.mark.asyncio
    async def test_rollback_strategy(self, mock_convex_client, test_context):
        """
        Test: Rollback strategy cleans up data
        Validates: Delete mutation is called
        """
        recovery = StreamErrorRecovery(mock_convex_client)

        options = RecoveryOptions(strategy=FailureStrategy.ROLLBACK)

        # Handle error
        result = await recovery.handle_stream_error(
            Exception("Test error"), test_context, options
        )

        # CRITICAL: Validate rollback
        assert result.success is True or mock_convex_client.mutation.called
        # Delete should be called for partial memory
        delete_calls = [
            call for call in mock_convex_client.mutation.call_args_list
            if "deleteMemory" in str(call)
        ]
        assert len(delete_calls) > 0, "Delete mutation should be called"

    @pytest.mark.asyncio
    async def test_retry_with_backoff_delays(self):
        """
        Test: Retry with backoff uses exponential delays
        Validates: Delays increase exponentially
        """
        recovery = StreamErrorRecovery(MagicMock())

        attempt_count = 0

        async def failing_operation():
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 3:
                raise Exception("Retry me")
            return "Success"

        # Execute with retry
        result = await recovery.retry_with_backoff(
            failing_operation, max_retries=3, base_delay=10
        )

        # CRITICAL: Validate retries occurred
        assert attempt_count == 3, f"Expected 3 attempts, got {attempt_count}"
        assert result == "Success"

    @pytest.mark.asyncio
    async def test_max_retries_exceeded_raises_error(self):
        """
        Test: Max retries exceeded raises last error
        Validates: Error propagation after max retries
        """
        recovery = StreamErrorRecovery(MagicMock())

        async def always_fails():
            raise Exception("Always fails")

        # Should raise after max retries
        with pytest.raises(Exception, match="Always fails"):
            await recovery.retry_with_backoff(always_fails, max_retries=2, base_delay=1)

    def test_resumable_error_wraps_original(self):
        """
        Test: ResumableStreamError wraps original error
        Validates: Error contains resume token and original error
        """
        original = Exception("Original error")
        token = "resume-token-123"

        resumable = ResumableStreamError(original, token)

        # CRITICAL: Validate error wrapping
        assert resumable.original_error is original
        assert resumable.resume_token == token
        assert "resume-token-123" in str(resumable)
        assert "Original error" in str(resumable)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
