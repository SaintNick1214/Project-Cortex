"""
Adaptive Stream Processor

Analyzes stream characteristics in real-time and adjusts processing
strategy for optimal performance:
- Fast streams: Batch processing, reduced overhead
- Slow streams: Immediate processing, optimize for latency
- Bursty streams: Dynamic buffering
- Long streams: Enable chunking automatically

Python implementation matching TypeScript src/memory/streaming/AdaptiveProcessor.ts
"""

from typing import Dict, List, Optional

from ..streaming_types import ProcessingStrategy, StreamMetrics, StreamType
from .stream_metrics import MetricsCollector


class AdaptiveStreamProcessor:
    """Adapts processing strategy based on stream characteristics"""

    def __init__(self, initial_strategy: Optional[ProcessingStrategy] = None) -> None:
        self.chunk_size_history: List[int] = []
        self.processing_time_history: List[float] = []
        self.current_strategy = initial_strategy or self._get_default_strategy()
        self.max_history_size = 50

    async def adjust_processing_strategy(
        self, metrics: StreamMetrics, metrics_collector: MetricsCollector
    ) -> ProcessingStrategy:
        """Adjust processing strategy based on current metrics"""
        # Detect stream type
        stream_type_str = metrics_collector.detect_stream_type()
        stream_type = StreamType(stream_type_str)

        # Get optimal strategy for this stream type
        new_strategy = self._optimize_for_type(stream_type, metrics)

        # Update current strategy if changed
        if self._has_strategy_changed(new_strategy):
            self.current_strategy = new_strategy

        return self.current_strategy

    def detect_stream_type(self, metrics: StreamMetrics) -> StreamType:
        """Detect stream type based on metrics"""
        chunks_per_second = metrics.chunks_per_second
        total_chunks = metrics.total_chunks

        # Fast: High throughput
        if chunks_per_second > 10:
            return StreamType.FAST

        # Slow: Low throughput
        if chunks_per_second < 1 and total_chunks > 5:
            return StreamType.SLOW

        # Bursty: High variance in chunk sizes
        chunk_stats = self._calculate_variance(self.chunk_size_history)
        if chunk_stats["coefficient"] > 0.5:
            return StreamType.BURSTY

        # Steady: Consistent throughput and chunk sizes
        return StreamType.STEADY

    def _optimize_for_type(
        self, stream_type: StreamType, metrics: StreamMetrics
    ) -> ProcessingStrategy:
        """Optimize strategy for detected stream type"""
        if stream_type == StreamType.FAST:
            return self._get_fast_stream_strategy(metrics)

        elif stream_type == StreamType.SLOW:
            return self._get_slow_stream_strategy(metrics)

        elif stream_type == StreamType.BURSTY:
            return self._get_bursty_stream_strategy(metrics)

        elif stream_type == StreamType.STEADY:
            return self._get_steady_stream_strategy(metrics)

        else:
            return self._get_default_strategy()

    def _get_fast_stream_strategy(self, metrics: StreamMetrics) -> ProcessingStrategy:
        """Strategy for fast streams - batch processing"""
        return ProcessingStrategy(
            buffer_size=10,  # Buffer 10 chunks before processing
            fact_extraction_frequency=1000,  # Extract every 1000 chars
            partial_update_interval=5000,  # Update every 5 seconds
            enable_predictive_loading=True,
        )

    def _get_slow_stream_strategy(self, metrics: StreamMetrics) -> ProcessingStrategy:
        """Strategy for slow streams - immediate processing"""
        return ProcessingStrategy(
            buffer_size=1,  # Process immediately
            fact_extraction_frequency=300,  # Extract every 300 chars
            partial_update_interval=2000,  # Update every 2 seconds
            enable_predictive_loading=False,
        )

    def _get_bursty_stream_strategy(self, metrics: StreamMetrics) -> ProcessingStrategy:
        """Strategy for bursty streams - dynamic buffering"""
        return ProcessingStrategy(
            buffer_size=5,  # Medium buffering
            fact_extraction_frequency=500,  # Extract every 500 chars
            partial_update_interval=3000,  # Update every 3 seconds
            enable_predictive_loading=False,
        )

    def _get_steady_stream_strategy(self, metrics: StreamMetrics) -> ProcessingStrategy:
        """Strategy for steady streams - balanced approach"""
        return ProcessingStrategy(
            buffer_size=3,  # Small buffer
            fact_extraction_frequency=500,  # Extract every 500 chars
            partial_update_interval=3000,  # Update every 3 seconds
            enable_predictive_loading=True,
        )

    def _get_default_strategy(self) -> ProcessingStrategy:
        """Default processing strategy"""
        return ProcessingStrategy(
            buffer_size=1,
            fact_extraction_frequency=500,
            partial_update_interval=3000,
            enable_predictive_loading=False,
        )

    def _has_strategy_changed(self, new_strategy: ProcessingStrategy) -> bool:
        """Check if strategy has meaningfully changed"""
        return (
            new_strategy.buffer_size != self.current_strategy.buffer_size
            or new_strategy.fact_extraction_frequency
            != self.current_strategy.fact_extraction_frequency
            or new_strategy.partial_update_interval
            != self.current_strategy.partial_update_interval
        )

    def record_chunk_size(self, size: int) -> None:
        """Record chunk size for analysis"""
        self.chunk_size_history.append(size)

        # Keep history size manageable
        if len(self.chunk_size_history) > self.max_history_size:
            self.chunk_size_history.pop(0)

    def record_processing_time(self, time_ms: float) -> None:
        """Record processing time for analysis"""
        self.processing_time_history.append(time_ms)

        # Keep history size manageable
        if len(self.processing_time_history) > self.max_history_size:
            self.processing_time_history.pop(0)

    def _calculate_variance(self, values: List[int]) -> Dict[str, float]:
        """Calculate variance and coefficient of variation"""
        if len(values) == 0:
            return {"variance": 0.0, "std_dev": 0.0, "coefficient": 0.0}

        mean = sum(values) / len(values)
        variance = sum((val - mean) ** 2 for val in values) / len(values)
        std_dev = variance**0.5
        coefficient = std_dev / mean if mean != 0 else 0.0

        return {"variance": variance, "std_dev": std_dev, "coefficient": coefficient}

    def get_current_strategy(self) -> ProcessingStrategy:
        """Get current strategy"""
        return ProcessingStrategy(
            buffer_size=self.current_strategy.buffer_size,
            fact_extraction_frequency=self.current_strategy.fact_extraction_frequency,
            partial_update_interval=self.current_strategy.partial_update_interval,
            enable_predictive_loading=self.current_strategy.enable_predictive_loading,
        )

    def should_enable_chunking(self, metrics: StreamMetrics) -> bool:
        """Predict if content should be chunked based on characteristics"""
        # Enable chunking for very long streams
        if metrics.total_bytes > 50000:  # > 50KB
            return True

        # Enable if processing is slow and content is growing
        if metrics.chunks_per_second < 2 and metrics.total_bytes > 20000:
            return True

        return False

    def suggest_chunk_size(self, metrics: StreamMetrics) -> int:
        """Suggest optimal chunk size based on stream characteristics"""
        avg_chunk_size = metrics.average_chunk_size

        # If chunks are small, suggest smaller memory chunks
        if avg_chunk_size < 50:
            return 2000  # 2KB chunks

        # If chunks are large, suggest larger memory chunks
        if avg_chunk_size > 200:
            return 10000  # 10KB chunks

        # Default
        return 5000  # 5KB chunks

    def should_enable_progressive_facts(self, metrics: StreamMetrics) -> bool:
        """Determine if we should enable progressive fact extraction"""
        # Enable for slow, long streams where facts would be valuable early
        if metrics.total_bytes > 2000 and metrics.chunks_per_second < 5:
            return True

        # Disable for very fast streams to reduce overhead
        if metrics.chunks_per_second > 15:
            return False

        # Enable by default for medium streams
        return metrics.total_bytes > 1000

    def get_recommendations(self, metrics: StreamMetrics) -> List[str]:
        """Get performance recommendations based on analysis"""
        recommendations: List[str] = []

        # Chunking recommendation
        if self.should_enable_chunking(metrics):
            recommendations.append(
                f"Enable chunked storage with {self.suggest_chunk_size(metrics)} char chunks"
            )

        # Fact extraction recommendation
        if not self.should_enable_progressive_facts(metrics):
            recommendations.append(
                "Consider disabling progressive fact extraction to improve throughput"
            )

        # Buffer size recommendation
        stream_type = self.detect_stream_type(metrics)
        if stream_type == StreamType.FAST and self.current_strategy.buffer_size < 5:
            recommendations.append(
                "Increase buffer size to improve batching efficiency"
            )

        # Update interval recommendation
        if metrics.partial_updates > metrics.total_chunks / 2:
            recommendations.append(
                "Reduce partial update frequency to lower database load"
            )

        return recommendations

    def reset(self) -> None:
        """Reset processor state"""
        self.chunk_size_history = []
        self.processing_time_history = []
        self.current_strategy = self._get_default_strategy()


def create_adaptive_processor() -> AdaptiveStreamProcessor:
    """Helper to create an adaptive processor with sensible defaults"""
    return AdaptiveStreamProcessor()
