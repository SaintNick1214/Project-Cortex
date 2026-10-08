"""
Stream Metrics Tests

Tests that validate ACTUAL metrics values, not just "no errors".
Verifies timing, throughput, and performance calculations.
"""

import asyncio

import pytest

from cortex.memory.streaming.stream_metrics import MetricsCollector


class TestMetricsCollector:
    """Test suite for MetricsCollector with actual value validation"""

    def test_metrics_initialization(self):
        """
        Test: Metrics collector initializes with correct defaults
        Validates: All counters start at zero, timestamps are reasonable
        """
        collector = MetricsCollector()
        snapshot = collector.get_snapshot()

        # Validate initial state
        assert snapshot.total_chunks == 0
        assert snapshot.total_bytes == 0
        assert snapshot.facts_extracted == 0
        assert snapshot.partial_updates == 0
        assert snapshot.error_count == 0
        assert snapshot.retry_count == 0
        assert snapshot.estimated_tokens == 0

        # Validate timing
        assert snapshot.start_time > 0
        assert snapshot.first_chunk_latency == 0  # No chunks yet
        assert snapshot.stream_duration_ms >= 0

    @pytest.mark.asyncio
    async def test_record_chunk_updates_metrics(self):
        """
        Test: Recording chunks updates ALL relevant metrics
        Validates: Chunk count, bytes, tokens, timing
        """
        collector = MetricsCollector()

        # Record first chunk
        chunk_size_1 = 100
        collector.record_chunk(chunk_size_1)

        # Small delay to ensure timing differences
        await asyncio.sleep(0.01)

        # Record second chunk
        chunk_size_2 = 150
        collector.record_chunk(chunk_size_2)

        snapshot = collector.get_snapshot()

        # CRITICAL: Validate actual values
        assert snapshot.total_chunks == 2, f"Expected 2 chunks, got {snapshot.total_chunks}"
        assert snapshot.total_bytes == 250, f"Expected 250 bytes, got {snapshot.total_bytes}"
        assert snapshot.average_chunk_size == 125.0, f"Expected 125.0 avg, got {snapshot.average_chunk_size}"
        assert snapshot.estimated_tokens == 62, f"Expected ~62 tokens (250/4), got {snapshot.estimated_tokens}"
        assert snapshot.first_chunk_latency >= 0, "First chunk latency should be non-negative"

    def test_metrics_cost_calculation(self):
        """
        Test: Cost estimation calculates correctly
        Validates: Actual cost values based on token count
        """
        collector = MetricsCollector()

        # Record chunks to generate tokens
        for _ in range(10):
            collector.record_chunk(400)  # 400 bytes = 100 tokens

        snapshot = collector.get_snapshot()

        # CRITICAL: Validate cost calculation
        # 10 chunks × 400 bytes = 4000 bytes = 1000 tokens
        assert snapshot.estimated_tokens == 1000
        assert snapshot.estimated_cost is not None
        # Cost should be ~$0.06 (1000 tokens @ $0.06/1K)
        assert 0.05 <= snapshot.estimated_cost <= 0.07, f"Expected ~$0.06, got ${snapshot.estimated_cost}"

    def test_chunk_stats_calculation(self):
        """
        Test: Chunk statistics calculate correctly
        Validates: Min, max, median, standard deviation
        """
        collector = MetricsCollector()

        # Record chunks with known sizes
        sizes = [10, 20, 30, 40, 50]
        for size in sizes:
            collector.record_chunk(size)

        stats = collector.get_chunk_stats()

        # CRITICAL: Validate actual statistical values
        assert stats["min"] == 10.0
        assert stats["max"] == 50.0
        assert stats["median"] == 30.0  # Middle value of sorted list
        # Standard deviation should be ~14.14
        assert 13.0 <= stats["std_dev"] <= 15.0

    @pytest.mark.asyncio
    async def test_throughput_calculation(self):
        """
        Test: Throughput calculations are accurate
        Validates: Chunks per second based on actual timing
        """
        collector = MetricsCollector()

        # Record chunks with delays
        for i in range(5):
            collector.record_chunk(100)
            await asyncio.sleep(0.05)  # 50ms between chunks

        snapshot = collector.get_snapshot()

        # CRITICAL: Validate throughput
        # 5 chunks over ~250ms = ~20 chunks/second
        assert snapshot.chunks_per_second > 10, f"Expected >10 chunks/sec, got {snapshot.chunks_per_second}"
        assert snapshot.chunks_per_second < 30, f"Expected <30 chunks/sec, got {snapshot.chunks_per_second}"

    def test_stream_type_detection(self):
        """
        Test: Stream type detection is accurate
        Validates: Fast/slow/bursty/steady classification
        """
        # Test fast stream
        fast_collector = MetricsCollector()
        for i in range(20):
            fast_collector.record_chunk(100)

        stream_type = fast_collector.detect_stream_type()
        assert stream_type == "fast", f"Expected 'fast', got '{stream_type}'"

        # Test slow stream
        slow_collector = MetricsCollector()
        slow_collector.record_chunk(100)
        import time
        time.sleep(0.6)  # 600ms delay
        slow_collector.record_chunk(100)

        stream_type = slow_collector.detect_stream_type()
        assert stream_type == "slow", f"Expected 'slow', got '{stream_type}'"

    def test_fact_and_update_counters(self):
        """
        Test: Fact extraction and update counters are accurate
        Validates: Exact counts match records
        """
        collector = MetricsCollector()

        # Record various events
        collector.record_fact_extraction(3)
        collector.record_fact_extraction(2)
        collector.record_partial_update()
        collector.record_partial_update()
        collector.record_partial_update()
        collector.record_error(Exception("test"))
        collector.record_retry()

        snapshot = collector.get_snapshot()

        # CRITICAL: Validate exact counts
        assert snapshot.facts_extracted == 5, f"Expected 5 facts, got {snapshot.facts_extracted}"
        assert snapshot.partial_updates == 3, f"Expected 3 updates, got {snapshot.partial_updates}"
        assert snapshot.error_count == 1, f"Expected 1 error, got {snapshot.error_count}"
        assert snapshot.retry_count == 1, f"Expected 1 retry, got {snapshot.retry_count}"

    def test_performance_insights_generation(self):
        """
        Test: Performance insights generate valid recommendations
        Validates: Bottleneck detection and recommendations
        """
        collector = MetricsCollector()

        # Simulate slow first chunk
        import time
        time.sleep(2.1)  # 2.1 second delay
        collector.record_chunk(100)

        insights = collector.generate_insights()

        # CRITICAL: Validate bottleneck detection
        assert len(insights["bottlenecks"]) > 0, "Should detect high first chunk latency"
        assert any("first chunk latency" in b.lower() for b in insights["bottlenecks"])
        assert len(insights["recommendations"]) > 0, "Should provide recommendations"

    def test_reset_clears_all_metrics(self):
        """
        Test: Reset clears all metrics completely
        Validates: All values return to initial state
        """
        collector = MetricsCollector()

        # Record data
        for i in range(10):
            collector.record_chunk(100)
        collector.record_fact_extraction(5)
        collector.record_partial_update()

        # Reset
        collector.reset()

        # CRITICAL: Validate everything is cleared
        snapshot = collector.get_snapshot()
        assert snapshot.total_chunks == 0
        assert snapshot.total_bytes == 0
        assert snapshot.facts_extracted == 0
        assert snapshot.partial_updates == 0
        assert len(collector.chunk_sizes) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
