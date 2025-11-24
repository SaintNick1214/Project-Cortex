"""
Basic Functionality Tests

Simple tests to verify core streaming works before complex integration.
These tests validate the implementation is correct at a basic level.
"""

import asyncio
import pytest
from cortex.memory.streaming.stream_metrics import MetricsCollector
from cortex.memory.streaming.stream_processor import StreamProcessor, create_stream_context
from cortex.memory.streaming_types import StreamingOptions, StreamHooks


async def simple_stream():
    """Create a simple 3-chunk stream"""
    yield "Hello"
    await asyncio.sleep(0.01)
    yield " "
    await asyncio.sleep(0.01)
    yield "World"


class TestBasicFunctionality:
    """Basic functionality validation"""

    @pytest.mark.asyncio
    async def test_stream_processor_works(self):
        """Test: StreamProcessor can process a simple stream"""
        context = create_stream_context(
            memory_space_id="test",
            conversation_id="conv",
            user_id="user",
            user_name="User",
        )
        
        processor = StreamProcessor(context)
        result = await processor.process_stream(simple_stream())
        
        assert result == "Hello World"
        assert processor.get_chunk_number() == 3

    @pytest.mark.asyncio
    async def test_hooks_are_called(self):
        """Test: Hooks are actually invoked"""
        context = create_stream_context(
            memory_space_id="test",
            conversation_id="conv",
            user_id="user",
            user_name="User",
        )
        
        chunk_calls = []
        complete_calls = []
        
        def on_chunk(event):
            chunk_calls.append(event)
        
        def on_complete(event):
            complete_calls.append(event)
        
        hooks = StreamHooks(on_chunk=on_chunk, on_complete=on_complete)
        processor = StreamProcessor(context, hooks)
        
        result = await processor.process_stream(simple_stream())
        
        # CRITICAL: Hooks should be called
        assert len(chunk_calls) == 3, f"Expected 3 chunk calls, got {len(chunk_calls)}"
        assert len(complete_calls) == 1, f"Expected 1 complete call, got {len(complete_calls)}"
        assert result == "Hello World"

    def test_metrics_collector_basics(self):
        """Test: MetricsCollector tracks basic metrics"""
        collector = MetricsCollector()
        
        collector.record_chunk(100)
        collector.record_chunk(200)
        
        snapshot = collector.get_snapshot()
        
        assert snapshot.total_chunks == 2
        assert snapshot.total_bytes == 300
        assert snapshot.average_chunk_size == 150.0

    def test_streaming_options_defaults(self):
        """Test: StreamingOptions has sensible defaults"""
        opts = StreamingOptions()
        
        assert opts.sync_to_graph is True  # Should default to True
        assert opts.progressive_graph_sync is False  # Should default to False
        assert opts.store_partial_response is False
        assert opts.max_retries == 3

    def test_streaming_options_from_dict(self):
        """Test: StreamingOptions can be created from dict"""
        opts = StreamingOptions(**{
            "sync_to_graph": True,
            "store_partial_response": True,
            "progressive_fact_extraction": True,
        })
        
        assert opts.sync_to_graph is True
        assert opts.store_partial_response is True
        assert opts.progressive_fact_extraction is True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
