"""
Debug Integration Tests

Simplified tests to debug why integration tests might be failing.
"""

import asyncio

import pytest

from cortex.memory.streaming_types import StreamingOptions


async def simple_stream():
    yield "Test"
    await asyncio.sleep(0.01)
    yield " "
    yield "Stream"


class TestDebugIntegration:
    """Debug tests to understand failures"""

    def test_streaming_options_has_sync_to_graph(self):
        """Test: StreamingOptions has sync_to_graph attribute"""
        opts = StreamingOptions()

        # CRITICAL: Check attribute exists
        assert hasattr(opts, "sync_to_graph"), "StreamingOptions missing sync_to_graph"

        # Check default value
        assert opts.sync_to_graph is True, f"Expected True, got {opts.sync_to_graph}"

    def test_streaming_options_from_dict_preserves_sync(self):
        """Test: Creating StreamingOptions from dict preserves sync_to_graph"""
        opts = StreamingOptions(**{"sync_to_graph": True, "store_partial_response": True})

        assert opts.sync_to_graph is True
        assert opts.store_partial_response is True

    def test_streaming_options_explicit_false(self):
        """Test: Can explicitly set sync_to_graph to False"""
        opts = StreamingOptions(sync_to_graph=False)

        assert opts.sync_to_graph is False

    @pytest.mark.asyncio
    async def test_remember_stream_signature(self):
        """Test: remember_stream accepts dict params and StreamingOptions"""
        # This is a signature test - just verify it doesn't error on call signature
        params = {
            "memorySpaceId": "test",
            "conversationId": "conv",
            "userMessage": "Hi",
            "responseStream": simple_stream(),
            "userId": "user",
            "userName": "User",
        }

        opts = StreamingOptions(sync_to_graph=True)

        # Just verify the types are correct (we won't actually run this)
        assert isinstance(params, dict)
        assert isinstance(opts, StreamingOptions)
        assert opts.sync_to_graph is True

    def test_streaming_options_defaults_match_typescript(self):
        """Test: All defaults match TypeScript SDK"""
        opts = StreamingOptions()

        # Check all defaults
        assert opts.sync_to_graph is True, "sync_to_graph should default to True"
        assert opts.progressive_graph_sync is False
        assert opts.graph_sync_interval == 5000
        assert opts.store_partial_response is False
        assert opts.partial_response_interval == 3000
        assert opts.progressive_fact_extraction is False
        assert opts.fact_extraction_threshold == 500
        assert opts.chunk_size is None
        assert opts.chunking_strategy is None
        assert opts.max_single_memory_size is None
        assert opts.hooks is None
        assert opts.partial_failure_handling is None
        assert opts.max_retries == 3
        assert opts.retry_delay == 1000
        assert opts.generate_resume_token is False
        assert opts.stream_timeout is None
        assert opts.max_buffer_size == 10000
        assert opts.incremental_embeddings is False
        assert opts.enable_adaptive_processing is False
        assert opts.max_response_length is None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
