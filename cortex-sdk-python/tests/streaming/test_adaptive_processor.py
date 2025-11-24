"""
Adaptive Processor Tests

Tests that validate ACTUAL adaptive behavior and strategy selection.
Verifies stream type detection and strategy recommendations.
"""

import pytest
from cortex.memory.streaming.adaptive_processor import (
    AdaptiveStreamProcessor,
    create_adaptive_processor,
)
from cortex.memory.streaming.stream_metrics import MetricsCollector
from cortex.memory.streaming_types import StreamMetrics, StreamType


def create_test_metrics(
    chunks_per_second: float,
    total_chunks: int,
    total_bytes: int,
    partial_updates: int = 0,
) -> StreamMetrics:
    """Helper to create test metrics"""
    return StreamMetrics(
        start_time=0,
        first_chunk_latency=100,
        stream_duration_ms=1000,
        total_chunks=total_chunks,
        total_bytes=total_bytes,
        average_chunk_size=total_bytes / total_chunks if total_chunks > 0 else 0.0,
        chunks_per_second=chunks_per_second,
        facts_extracted=0,
        partial_updates=partial_updates,
        error_count=0,
        retry_count=0,
        estimated_tokens=total_bytes // 4,
        estimated_cost=None,
    )


class TestAdaptiveStreamProcessor:
    """Test suite for AdaptiveStreamProcessor with actual behavior validation"""

    def test_detect_fast_stream(self):
        """
        Test: Fast stream detection is accurate
        Validates: Streams with >10 chunks/sec are classified as "fast"
        """
        processor = AdaptiveStreamProcessor()
        metrics = create_test_metrics(
            chunks_per_second=15.0, total_chunks=150, total_bytes=7500
        )

        stream_type = processor.detect_stream_type(metrics)

        # CRITICAL: Validate fast stream detection
        assert stream_type == StreamType.FAST, f"Expected FAST, got {stream_type}"

    def test_detect_slow_stream(self):
        """
        Test: Slow stream detection is accurate
        Validates: Streams with <1 chunk/sec are classified as "slow"
        """
        processor = AdaptiveStreamProcessor()
        metrics = create_test_metrics(
            chunks_per_second=0.5, total_chunks=10, total_bytes=1000
        )

        stream_type = processor.detect_stream_type(metrics)

        # CRITICAL: Validate slow stream detection
        assert stream_type == StreamType.SLOW, f"Expected SLOW, got {stream_type}"

    def test_detect_steady_stream(self):
        """
        Test: Steady stream detection is accurate
        Validates: Streams with consistent behavior
        """
        processor = AdaptiveStreamProcessor()
        
        # Record consistent chunk sizes
        for _ in range(10):
            processor.record_chunk_size(100)  # Consistent size

        metrics = create_test_metrics(
            chunks_per_second=5.0, total_chunks=10, total_bytes=1000
        )

        stream_type = processor.detect_stream_type(metrics)

        # CRITICAL: Validate steady stream detection
        assert stream_type == StreamType.STEADY, f"Expected STEADY, got {stream_type}"

    def test_detect_bursty_stream(self):
        """
        Test: Bursty stream detection is accurate
        Validates: High variance in chunk sizes
        """
        processor = AdaptiveStreamProcessor()
        
        # Record variable chunk sizes (high variance)
        processor.record_chunk_size(10)
        processor.record_chunk_size(500)
        processor.record_chunk_size(20)
        processor.record_chunk_size(450)
        processor.record_chunk_size(15)

        metrics = create_test_metrics(
            chunks_per_second=5.0, total_chunks=5, total_bytes=995
        )

        stream_type = processor.detect_stream_type(metrics)

        # CRITICAL: Validate bursty stream detection
        assert stream_type == StreamType.BURSTY, f"Expected BURSTY, got {stream_type}"

    @pytest.mark.asyncio
    async def test_strategy_adapts_to_fast_stream(self):
        """
        Test: Strategy adapts appropriately for fast streams
        Validates: Fast stream gets batching strategy
        """
        processor = AdaptiveStreamProcessor()
        metrics_collector = MetricsCollector()
        
        # Simulate fast stream
        for _ in range(20):
            metrics_collector.record_chunk(100)

        metrics = metrics_collector.get_snapshot()
        strategy = await processor.adjust_processing_strategy(metrics, metrics_collector)

        # CRITICAL: Validate fast stream strategy
        assert strategy.buffer_size >= 5, "Fast streams should have larger buffer"
        assert strategy.partial_update_interval >= 3000, "Fast streams should update less frequently"

    @pytest.mark.asyncio
    async def test_strategy_adapts_to_slow_stream(self):
        """
        Test: Strategy adapts appropriately for slow streams
        Validates: Slow stream gets immediate processing
        """
        processor = AdaptiveStreamProcessor()
        metrics_collector = MetricsCollector()
        
        # Simulate slow stream
        metrics_collector.record_chunk(100)
        import time
        time.sleep(0.6)
        metrics_collector.record_chunk(100)

        metrics = metrics_collector.get_snapshot()
        strategy = await processor.adjust_processing_strategy(metrics, metrics_collector)

        # CRITICAL: Validate slow stream strategy
        assert strategy.buffer_size <= 1, "Slow streams should have minimal buffering"
        assert strategy.fact_extraction_frequency <= 500, "Slow streams should extract facts more frequently"

    def test_should_enable_chunking_for_large_streams(self):
        """
        Test: Chunking recommendation for large streams
        Validates: Large streams trigger chunking suggestion
        """
        processor = AdaptiveStreamProcessor()
        
        # Large stream
        large_metrics = create_test_metrics(
            chunks_per_second=5.0, total_chunks=100, total_bytes=60000
        )
        
        assert processor.should_enable_chunking(large_metrics) is True, "Large stream should enable chunking"

        # Small stream
        small_metrics = create_test_metrics(
            chunks_per_second=5.0, total_chunks=10, total_bytes=1000
        )
        
        assert processor.should_enable_chunking(small_metrics) is False, "Small stream should not chunk"

    def test_suggest_chunk_size_based_on_characteristics(self):
        """
        Test: Chunk size suggestions are reasonable
        Validates: Suggestions adapt to stream characteristics
        """
        processor = AdaptiveStreamProcessor()
        
        # Small average chunk size -> smaller memory chunks
        small_metrics = create_test_metrics(
            chunks_per_second=10.0, total_chunks=100, total_bytes=3000
        )
        small_suggestion = processor.suggest_chunk_size(small_metrics)
        assert small_suggestion == 2000, "Small chunks should suggest 2KB memory chunks"

        # Large average chunk size -> larger memory chunks
        large_metrics = create_test_metrics(
            chunks_per_second=5.0, total_chunks=50, total_bytes=15000
        )
        large_suggestion = processor.suggest_chunk_size(large_metrics)
        assert large_suggestion == 10000, "Large chunks should suggest 10KB memory chunks"

    def test_recommendations_for_fast_stream(self):
        """
        Test: Recommendations are appropriate for stream type
        Validates: Fast streams get specific recommendations
        """
        processor = AdaptiveStreamProcessor()
        
        # Create fast stream metrics
        fast_metrics = create_test_metrics(
            chunks_per_second=20.0, total_chunks=200, total_bytes=100000
        )

        recommendations = processor.get_recommendations(fast_metrics)

        # CRITICAL: Validate recommendations
        assert len(recommendations) > 0, "Should provide recommendations"
        # Fast streams with large size should suggest chunking
        assert any("chunk" in rec.lower() for rec in recommendations)

    def test_progressive_facts_recommendation(self):
        """
        Test: Progressive fact extraction recommendations
        Validates: Appropriate suggestions based on stream characteristics
        """
        processor = AdaptiveStreamProcessor()
        
        # Slow, long stream -> enable progressive facts
        slow_long = create_test_metrics(
            chunks_per_second=2.0, total_chunks=50, total_bytes=3000
        )
        assert processor.should_enable_progressive_facts(slow_long) is True

        # Very fast stream -> disable progressive facts
        very_fast = create_test_metrics(
            chunks_per_second=20.0, total_chunks=200, total_bytes=10000
        )
        assert processor.should_enable_progressive_facts(very_fast) is False

    def test_reset_clears_all_state(self):
        """
        Test: Reset clears all processor state
        Validates: State returns to initial values
        """
        processor = AdaptiveStreamProcessor()
        
        # Record data
        processor.record_chunk_size(100)
        processor.record_chunk_size(200)
        processor.record_processing_time(50.0)

        # Reset
        processor.reset()

        # CRITICAL: Validate state is cleared
        assert len(processor.chunk_size_history) == 0
        assert len(processor.processing_time_history) == 0


def test_create_adaptive_processor():
    """
    Test: Factory function creates valid processor
    Validates: Processor is properly initialized
    """
    processor = create_adaptive_processor()
    
    # CRITICAL: Validate initialization
    assert processor is not None
    assert isinstance(processor, AdaptiveStreamProcessor)
    strategy = processor.get_current_strategy()
    assert strategy.buffer_size > 0
    assert strategy.fact_extraction_frequency > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
