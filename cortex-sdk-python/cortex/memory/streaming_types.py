"""
Streaming-specific type definitions for RememberStream API

Comprehensive types for progressive streaming, real-time processing,
error recovery, and advanced streaming features.

Python implementation matching TypeScript src/types/streaming.ts
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, List, Literal, Optional

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stream Hooks & Events
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class ChunkEvent:
    """Event emitted for each chunk received from the stream"""

    chunk: str
    chunk_number: int
    accumulated: str
    timestamp: int
    estimated_tokens: int


@dataclass
class ProgressEvent:
    """Progress update during streaming"""

    bytes_processed: int
    chunks: int
    elapsed_ms: int
    estimated_completion: Optional[int] = None
    current_phase: Optional[
        Literal["streaming", "fact-extraction", "storage", "finalization"]
    ] = None


@dataclass
class StreamCompleteEvent:
    """Event emitted when stream completes successfully"""

    full_response: str
    total_chunks: int
    duration_ms: int
    facts_extracted: int


@dataclass
class StreamHooks:
    """Hooks for stream lifecycle events"""

    on_chunk: Optional[Callable[[ChunkEvent], Optional[Awaitable[None]]]] = None
    on_progress: Optional[Callable[[ProgressEvent], Optional[Awaitable[None]]]] = None
    on_error: Optional[Callable[[Any], Optional[Awaitable[None]]]] = None
    on_complete: Optional[
        Callable[[StreamCompleteEvent], Optional[Awaitable[None]]]
    ] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stream Metrics
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class StreamMetrics:
    """Comprehensive streaming performance metrics"""

    # Timing
    start_time: int
    first_chunk_latency: int
    stream_duration_ms: int

    # Throughput
    total_chunks: int
    total_bytes: int
    average_chunk_size: float
    chunks_per_second: float

    # Processing
    facts_extracted: int
    partial_updates: int
    error_count: int
    retry_count: int

    # Estimates
    estimated_tokens: int
    estimated_cost: Optional[float] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Progressive Storage
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class PartialUpdate:
    """Update record for partial storage"""

    timestamp: int
    memory_id: str
    content_length: int
    chunk_number: int


@dataclass
class ProgressiveFact:
    """Progressive fact extraction result"""

    fact_id: str
    extracted_at_chunk: int
    confidence: int
    fact: str
    deduped: bool = False


@dataclass
class GraphSyncEvent:
    """Graph sync event during streaming"""

    timestamp: int
    event_type: Literal["node-created", "node-updated", "relationship-created", "finalized"]
    node_id: Optional[str] = None
    details: Optional[str] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Error Handling & Recovery
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class FailureStrategy(str, Enum):
    """Failure handling strategy"""

    STORE_PARTIAL = "store-partial"
    ROLLBACK = "rollback"
    RETRY = "retry"
    BEST_EFFORT = "best-effort"


@dataclass
class ErrorContext:
    """Error context for debugging"""

    phase: Literal["initialization", "streaming", "fact-extraction", "storage", "finalization"]
    chunk_number: int
    bytes_processed: int
    partial_memory_id: Optional[str] = None
    last_successful_update: Optional[int] = None


@dataclass
class StreamError:
    """Stream error with recovery information"""

    code: str
    message: str
    recoverable: bool
    partial_data_saved: bool
    context: ErrorContext
    resume_token: Optional[str] = None
    original_error: Optional[Exception] = None


@dataclass
class RecoveryOptions:
    """Recovery options for stream errors"""

    strategy: FailureStrategy
    max_retries: int = 3
    retry_delay: int = 1000
    preserve_partial_data: bool = True
    notify_on_recovery: bool = False


@dataclass
class RecoveryResult:
    """Result of recovery attempt"""

    success: bool
    strategy: FailureStrategy
    partial_memory_id: Optional[str] = None
    resume_token: Optional[str] = None
    error: Optional[Exception] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Resume Capability
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class ResumeContext:
    """Context for resuming interrupted streams"""

    resume_token: str
    last_processed_chunk: int
    accumulated_content: str
    partial_memory_id: str
    facts_extracted: List[str]
    timestamp: int
    checksum: str


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Chunking Strategies
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class ChunkStrategy(str, Enum):
    """Strategy for breaking content into chunks"""

    TOKEN = "token"
    SENTENCE = "sentence"
    PARAGRAPH = "paragraph"
    FIXED = "fixed"
    SEMANTIC = "semantic"


@dataclass
class ChunkingConfig:
    """Configuration for content chunking"""

    strategy: ChunkStrategy
    max_chunk_size: int
    overlap_size: int = 0
    preserve_boundaries: bool = True


@dataclass
class ContentChunk:
    """A single content chunk"""

    content: str
    chunk_index: int
    start_offset: int
    end_offset: int
    metadata: Dict[str, Any] = field(default_factory=dict)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Adaptive Processing
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class StreamType(str, Enum):
    """Stream type classification"""

    FAST = "fast"
    SLOW = "slow"
    BURSTY = "bursty"
    STEADY = "steady"


@dataclass
class ProcessingStrategy:
    """Processing strategy for adaptive behavior"""

    buffer_size: int
    fact_extraction_frequency: int
    partial_update_interval: int
    enable_predictive_loading: bool


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Streaming Options
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class StreamingOptions:
    """Comprehensive streaming options"""

    # Graph sync
    sync_to_graph: bool = True
    progressive_graph_sync: bool = False
    graph_sync_interval: int = 5000

    # Progressive storage
    store_partial_response: bool = False
    partial_response_interval: int = 3000

    # Progressive fact extraction
    progressive_fact_extraction: bool = False
    fact_extraction_threshold: int = 500

    # Chunking
    chunk_size: Optional[int] = None
    chunking_strategy: Optional[ChunkStrategy] = None
    max_single_memory_size: Optional[int] = None

    # Hooks
    hooks: Optional[StreamHooks] = None

    # Error handling
    partial_failure_handling: Optional[FailureStrategy] = None
    max_retries: int = 3
    retry_delay: int = 1000
    generate_resume_token: bool = False
    stream_timeout: Optional[int] = None

    # Memory efficiency
    max_buffer_size: int = 10000
    incremental_embeddings: bool = False

    # Adaptive processing
    enable_adaptive_processing: bool = False

    # Advanced
    max_response_length: Optional[int] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Enhanced Result Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class PerformanceInsights:
    """Performance insights and recommendations"""

    bottlenecks: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    cost_estimate: Optional[float] = None


@dataclass
class ProgressiveProcessing:
    """Progressive processing results"""

    facts_extracted_during_stream: List[ProgressiveFact] = field(default_factory=list)
    partial_storage_history: List[PartialUpdate] = field(default_factory=list)
    graph_sync_events: Optional[List[GraphSyncEvent]] = None


@dataclass
class EnhancedRememberStreamResult:
    """Enhanced result from remember_stream with comprehensive metadata"""

    # Core data (from RememberResult)
    conversation: Dict[str, Any]
    memories: List[Any]  # List[MemoryEntry]
    facts: List[Any]  # List[FactRecord]
    full_response: str

    # Stream metrics
    stream_metrics: StreamMetrics

    # Progressive processing results
    progressive_processing: Optional[ProgressiveProcessing] = None

    # Error/recovery info
    errors: Optional[List[StreamError]] = None
    recovered: bool = False
    resume_token: Optional[str] = None

    # Performance insights
    performance: Optional[PerformanceInsights] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stream Context
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class StreamContext:
    """Internal streaming context for processing"""

    memory_space_id: str
    conversation_id: str
    user_id: str
    user_name: str

    # State
    accumulated_text: str = ""
    chunk_count: int = 0
    estimated_tokens: int = 0
    elapsed_ms: int = 0

    # Processing
    partial_memory_id: Optional[str] = None
    extracted_fact_ids: List[str] = field(default_factory=list)
    graph_node_id: Optional[str] = None

    # Metrics
    metrics: Optional[StreamMetrics] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Custom Exceptions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class ResumableStreamError(Exception):
    """Error that can be resumed with a token"""

    def __init__(self, original_error: Exception, resume_token: str):
        self.original_error = original_error
        self.resume_token = resume_token
        super().__init__(
            f"Stream interrupted: {original_error}. Resume with token: {resume_token}"
        )
