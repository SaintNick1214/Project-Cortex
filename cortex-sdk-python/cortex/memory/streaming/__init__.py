"""
Streaming Components

Advanced streaming capabilities for progressive memory storage,
real-time processing, error recovery, and adaptive optimization.
"""

from .adaptive_processor import AdaptiveStreamProcessor, create_adaptive_processor
from .chunking_strategies import (
    ResponseChunker,
    estimate_optimal_chunk_size,
    should_chunk_content,
)
from .error_recovery import ResumableStreamError, StreamErrorRecovery
from .fact_extractor import ProgressiveFactExtractor
from .progressive_graph_sync import (
    ProgressiveGraphSync,
    create_progressive_graph_sync,
)
from .progressive_storage_handler import (
    ProgressiveStorageHandler,
    calculate_optimal_update_interval,
)
from .stream_metrics import MetricsCollector
from .stream_processor import StreamProcessor, create_stream_context

__all__ = [
    # Core processors
    "StreamProcessor",
    "MetricsCollector",
    "create_stream_context",
    # Storage and sync
    "ProgressiveStorageHandler",
    "calculate_optimal_update_interval",
    "ProgressiveGraphSync",
    "create_progressive_graph_sync",
    # Fact extraction
    "ProgressiveFactExtractor",
    # Chunking
    "ResponseChunker",
    "estimate_optimal_chunk_size",
    "should_chunk_content",
    # Error recovery
    "StreamErrorRecovery",
    "ResumableStreamError",
    # Adaptive processing
    "AdaptiveStreamProcessor",
    "create_adaptive_processor",
]
