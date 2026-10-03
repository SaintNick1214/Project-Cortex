"""
Stream Metrics Collection and Reporting

Tracks comprehensive performance metrics during streaming operations
including timing, throughput, processing stats, and cost estimates.

Python implementation matching TypeScript src/memory/streaming/StreamMetrics.ts
"""

import time
from typing import Dict, List, Literal, Optional

from ..streaming_types import StreamMetrics


class MetricsCollector:
    """Collects and aggregates streaming metrics in real-time"""

    def __init__(self) -> None:
        self.start_time = int(time.time() * 1000)
        self.first_chunk_time: Optional[int] = None
        self.chunk_sizes: List[int] = []
        self.chunk_timestamps: List[int] = []
        self.facts_count = 0
        self.partial_update_count = 0
        self.error_count = 0
        self.retry_count = 0
        self.token_estimate = 0

    def record_chunk(self, size: int) -> None:
        """Record a received chunk"""
        now = int(time.time() * 1000)

        # Record first chunk latency
        if self.first_chunk_time is None:
            self.first_chunk_time = now

        self.chunk_sizes.append(size)
        self.chunk_timestamps.append(now)

        # Rough token estimate (1 token ≈ 4 chars)
        self.token_estimate += size // 4

    def record_fact_extraction(self, count: int) -> None:
        """Record fact extraction"""
        self.facts_count += count

    def record_partial_update(self) -> None:
        """Record partial storage update"""
        self.partial_update_count += 1

    def record_error(self, error: Exception) -> None:
        """Record an error occurrence"""
        self.error_count += 1

    def record_retry(self) -> None:
        """Record a retry attempt"""
        self.retry_count += 1

    def get_snapshot(self) -> StreamMetrics:
        """Get current metrics snapshot"""
        now = int(time.time() * 1000)
        duration = now - self.start_time
        total_bytes = sum(self.chunk_sizes)
        total_chunks = len(self.chunk_sizes)

        return StreamMetrics(
            # Timing
            start_time=self.start_time,
            first_chunk_latency=(
                self.first_chunk_time - self.start_time if self.first_chunk_time else 0
            ),
            stream_duration_ms=duration,
            # Throughput
            total_chunks=total_chunks,
            total_bytes=total_bytes,
            average_chunk_size=total_bytes / total_chunks if total_chunks > 0 else 0.0,
            chunks_per_second=(
                (total_chunks / duration) * 1000 if duration > 0 else 0.0
            ),
            # Processing
            facts_extracted=self.facts_count,
            partial_updates=self.partial_update_count,
            error_count=self.error_count,
            retry_count=self.retry_count,
            # Estimates
            estimated_tokens=self.token_estimate,
            estimated_cost=self._calculate_cost(self.token_estimate),
        )

    def _calculate_cost(self, tokens: int) -> Optional[float]:
        """
        Calculate estimated cost based on tokens
        Using GPT-4 pricing as baseline: ~$0.03/1K input tokens, $0.06/1K output tokens
        """
        if tokens == 0:
            return None

        # Assume output tokens, more expensive
        cost_per_1k = 0.06
        return (tokens / 1000) * cost_per_1k

    def get_chunk_stats(self) -> Dict[str, float]:
        """Get chunk size statistics"""
        if not self.chunk_sizes:
            return {"min": 0.0, "max": 0.0, "median": 0.0, "std_dev": 0.0}

        sorted_sizes = sorted(self.chunk_sizes)
        min_size = float(sorted_sizes[0])
        max_size = float(sorted_sizes[-1])
        median = float(sorted_sizes[len(sorted_sizes) // 2])

        # Calculate standard deviation
        mean = sum(self.chunk_sizes) / len(self.chunk_sizes)
        variance = sum((size - mean) ** 2 for size in self.chunk_sizes) / len(
            self.chunk_sizes
        )
        std_dev = variance**0.5

        return {"min": min_size, "max": max_size, "median": median, "std_dev": std_dev}

    def get_timing_stats(self) -> Dict[str, float]:
        """Get timing statistics"""
        if len(self.chunk_timestamps) < 2:
            return {
                "average_inter_chunk_delay": 0.0,
                "min_delay": 0.0,
                "max_delay": 0.0,
            }

        delays = [
            self.chunk_timestamps[i] - self.chunk_timestamps[i - 1]
            for i in range(1, len(self.chunk_timestamps))
        ]

        average_delay = sum(delays) / len(delays)
        min_delay = float(min(delays))
        max_delay = float(max(delays))

        return {
            "average_inter_chunk_delay": average_delay,
            "min_delay": min_delay,
            "max_delay": max_delay,
        }

    def detect_stream_type(self) -> Literal["fast", "slow", "bursty", "steady"]:
        """Detect stream characteristics"""
        timing_stats = self.get_timing_stats()
        chunk_stats = self.get_chunk_stats()

        avg_delay = timing_stats["average_inter_chunk_delay"]

        # Fast: Short inter-chunk delays (< 50ms average)
        if avg_delay < 50:
            return "fast"

        # Slow: Long inter-chunk delays (> 500ms average)
        if avg_delay > 500:
            return "slow"

        # Bursty: High variance in chunk sizes or timing
        if avg_delay > 0:
            timing_variance = (
                timing_stats["max_delay"] - timing_stats["min_delay"]
            ) / avg_delay
            if timing_variance > 2 or chunk_stats["std_dev"] > chunk_stats["median"]:
                return "bursty"

        # Steady: Consistent timing and chunk sizes
        return "steady"

    def reset(self) -> None:
        """Reset metrics (useful for testing or reuse)"""
        self.start_time = int(time.time() * 1000)
        self.first_chunk_time = None
        self.chunk_sizes = []
        self.chunk_timestamps = []
        self.facts_count = 0
        self.partial_update_count = 0
        self.error_count = 0
        self.retry_count = 0
        self.token_estimate = 0

    def generate_insights(self) -> Dict[str, List[str]]:
        """Generate performance insights based on metrics"""
        metrics = self.get_snapshot()
        bottlenecks: List[str] = []
        recommendations: List[str] = []

        # Analyze first chunk latency
        if metrics.first_chunk_latency > 2000:
            bottlenecks.append("High first chunk latency (> 2s)")
            recommendations.append(
                "Consider optimizing LLM prompt or switching to a faster model"
            )

        # Analyze throughput
        if metrics.chunks_per_second < 1 and metrics.total_chunks > 10:
            bottlenecks.append("Low throughput (< 1 chunk/second)")
            recommendations.append(
                "Stream may be slow, consider using progressive storage"
            )

        # Analyze error rate
        error_rate = (
            metrics.error_count / metrics.total_chunks if metrics.total_chunks > 0 else 0
        )
        if error_rate > 0.1:
            bottlenecks.append(f"High error rate ({error_rate * 100:.1f}%)")
            recommendations.append(
                "Implement retry logic or check network stability"
            )

        # Analyze fact extraction
        if metrics.facts_extracted == 0 and metrics.total_bytes > 1000:
            recommendations.append(
                "No facts extracted - consider enabling progressive fact extraction"
            )

        # Analyze partial updates
        if metrics.partial_updates == 0 and metrics.stream_duration_ms > 5000:
            recommendations.append(
                "Long stream with no partial updates - enable progressive storage for better resilience"
            )

        # Cost warnings
        if metrics.estimated_cost and metrics.estimated_cost > 1:
            recommendations.append(
                f"High estimated cost (${metrics.estimated_cost:.2f}) - consider response length limits"
            )

        return {"bottlenecks": bottlenecks, "recommendations": recommendations}
