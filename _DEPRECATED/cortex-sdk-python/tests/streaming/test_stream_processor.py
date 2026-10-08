"""
Stream Processor Tests

Tests that validate ACTUAL stream processing behavior.
Verifies chunk accumulation, hook invocation, and context updates.
"""

import asyncio

import pytest

from cortex.memory.streaming.stream_metrics import MetricsCollector
from cortex.memory.streaming.stream_processor import (
    StreamProcessor,
    create_stream_context,
)
from cortex.memory.streaming_types import StreamHooks


async def create_simple_stream():
    """Create a simple test stream"""
    chunks = ["Hello", " ", "World", "!"]
    for chunk in chunks:
        await asyncio.sleep(0.01)
        yield chunk


async def create_numbered_stream(count: int):
    """Create a numbered stream for testing"""
    for i in range(count):
        yield f"Chunk{i}"
        await asyncio.sleep(0.01)


class TestStreamProcessor:
    """Test suite for StreamProcessor with actual behavior validation"""

    @pytest.mark.asyncio
    async def test_process_stream_accumulates_correctly(self):
        """
        Test: Stream processor accumulates all chunks
        Validates: Final content matches all chunks combined
        """
        context = create_stream_context(
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            user_name="Test User",
        )

        processor = StreamProcessor(context)

        # Process stream
        result = await processor.process_stream(create_simple_stream())

        # CRITICAL: Validate actual accumulated content
        assert result == "Hello World!", f"Expected 'Hello World!', got '{result}'"
        assert processor.get_accumulated_content() == "Hello World!"
        assert processor.get_chunk_number() == 4, f"Expected 4 chunks, got {processor.get_chunk_number()}"

    @pytest.mark.asyncio
    async def test_chunk_hook_receives_all_chunks(self):
        """
        Test: onChunk hook is called for every chunk
        Validates: Hook receives correct chunk data
        """
        context = create_stream_context(
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            user_name="Test User",
        )

        chunk_events = []

        def on_chunk(event):
            chunk_events.append(event)

        hooks = StreamHooks(on_chunk=on_chunk)
        processor = StreamProcessor(context, hooks)

        # Process stream
        await processor.process_stream(create_numbered_stream(5))

        # CRITICAL: Validate hook was called for each chunk
        assert len(chunk_events) == 5, f"Expected 5 chunk events, got {len(chunk_events)}"

        # Validate each event
        for i, event in enumerate(chunk_events):
            assert event.chunk == f"Chunk{i}", f"Chunk {i} has wrong content"
            assert event.chunk_number == i + 1, f"Chunk {i} has wrong number"
            assert event.estimated_tokens >= 0

    @pytest.mark.asyncio
    async def test_progress_hook_called_periodically(self):
        """
        Test: onProgress hook is called at intervals
        Validates: Progress events contain correct metrics
        """
        context = create_stream_context(
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            user_name="Test User",
        )

        progress_events = []

        def on_progress(event):
            progress_events.append(event)

        hooks = StreamHooks(on_progress=on_progress)
        processor = StreamProcessor(context, hooks)

        # Process 25 chunks (progress every 10 chunks by default)
        await processor.process_stream(create_numbered_stream(25))

        # CRITICAL: Validate progress was called
        # Should be called at chunks 10 and 20
        assert len(progress_events) >= 2, f"Expected at least 2 progress events, got {len(progress_events)}"

        # Validate progress event data
        for event in progress_events:
            assert event.bytes_processed > 0
            assert event.chunks > 0
            assert event.elapsed_ms >= 0
            assert event.current_phase == "streaming"

    @pytest.mark.asyncio
    async def test_completion_hook_called_once(self):
        """
        Test: onComplete hook is called exactly once
        Validates: Completion event has final metrics
        """
        context = create_stream_context(
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            user_name="Test User",
        )

        completion_events = []

        def on_complete(event):
            completion_events.append(event)

        hooks = StreamHooks(on_complete=on_complete)
        processor = StreamProcessor(context, hooks)

        # Process stream
        full_response = await processor.process_stream(create_numbered_stream(10))

        # CRITICAL: Validate completion hook
        assert len(completion_events) == 1, "onComplete should be called exactly once"

        complete_event = completion_events[0]
        assert complete_event.full_response == full_response
        assert complete_event.total_chunks == 10
        assert complete_event.duration_ms > 0

    @pytest.mark.asyncio
    async def test_error_hook_called_on_failure(self):
        """
        Test: onError hook is called when stream fails
        Validates: Error event contains failure details
        """
        context = create_stream_context(
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            user_name="Test User",
        )

        error_events = []

        def on_error(event):
            error_events.append(event)

        hooks = StreamHooks(on_error=on_error)
        processor = StreamProcessor(context, hooks)

        # Create failing stream
        async def failing_stream():
            yield "Start"
            raise Exception("Test error")

        # Process and expect error
        with pytest.raises(Exception, match="Test error"):
            await processor.process_stream(failing_stream())

        # CRITICAL: Validate error hook was called
        assert len(error_events) == 1, "onError should be called once"

        error_event = error_events[0]
        assert error_event.code == "STREAM_PROCESSING_ERROR"
        assert "Test error" in error_event.message
        assert error_event.recoverable is False

    @pytest.mark.asyncio
    async def test_context_updates_during_streaming(self):
        """
        Test: Stream context is updated during processing
        Validates: Context reflects actual processing state
        """
        context = create_stream_context(
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            user_name="Test User",
        )

        processor = StreamProcessor(context)

        # Process stream
        await processor.process_stream(create_numbered_stream(5))

        # CRITICAL: Validate context updates
        final_context = processor.get_context()
        assert final_context.chunk_count == 5
        assert len(final_context.accumulated_text) > 0
        assert final_context.estimated_tokens > 0
        assert final_context.elapsed_ms > 0

    @pytest.mark.asyncio
    async def test_metrics_track_actual_stream_activity(self):
        """
        Test: Metrics collector tracks all stream activity
        Validates: Metrics match actual stream characteristics
        """
        context = create_stream_context(
            memory_space_id="test-space",
            conversation_id="test-conv",
            user_id="test-user",
            user_name="Test User",
        )

        metrics_collector = MetricsCollector()
        processor = StreamProcessor(context, metrics=metrics_collector)

        # Process known stream
        await processor.process_stream(create_numbered_stream(7))

        # CRITICAL: Validate metrics accuracy
        metrics = metrics_collector.get_snapshot()
        assert metrics.total_chunks == 7, f"Expected 7 chunks, got {metrics.total_chunks}"
        assert metrics.total_bytes > 0
        assert metrics.stream_duration_ms > 0

        # Get metrics from processor
        processor_metrics = processor.get_metrics()
        assert processor_metrics is metrics_collector


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
