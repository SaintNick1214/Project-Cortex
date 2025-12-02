"""
Cortex SDK Resilience Types

Type definitions for the overload protection system including:
- Token Bucket Rate Limiter
- Semaphore Concurrency Limiter
- Priority Queue
- Circuit Breaker
"""

from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Literal, Optional

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Priority Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Priority = Literal["critical", "high", "normal", "low", "background"]
"""
Request priority levels for queue ordering

- critical: GDPR/security operations (never dropped)
- high: Real-time conversation storage
- normal: Standard reads/writes
- low: Bulk operations, exports
- background: Async sync, analytics
"""

PRIORITY_ORDER: List[Priority] = ["critical", "high", "normal", "low", "background"]
"""Priority order for queue processing (highest first)"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Rate Limiter Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class RateLimiterConfig:
    """Token Bucket Rate Limiter configuration"""

    bucket_size: int = 100
    """Maximum burst capacity (tokens) - default: 100"""

    refill_rate: float = 50.0
    """Token refill rate per second - default: 50"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Concurrency Limiter Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class ConcurrencyConfig:
    """Semaphore Concurrency Limiter configuration"""

    max_concurrent: int = 20
    """Maximum concurrent requests - default: 20"""

    queue_size: int = 1000
    """Maximum requests waiting in queue - default: 1000"""

    timeout: float = 30.0
    """Maximum wait time for a permit (seconds) - default: 30"""


@dataclass
class SemaphorePermit:
    """Semaphore permit returned when acquiring"""

    release: Callable[[], None]
    """Release the permit back to the semaphore"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Circuit Breaker Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CircuitState = Literal["closed", "open", "half-open"]
"""Circuit breaker states"""


@dataclass
class CircuitBreakerConfig:
    """Circuit Breaker configuration"""

    failure_threshold: int = 5
    """Number of failures before opening circuit - default: 5"""

    success_threshold: int = 2
    """Number of successes in half-open to close circuit - default: 2"""

    timeout: float = 30.0
    """Time to wait in open state before half-open (seconds) - default: 30"""

    half_open_max: int = 3
    """Max test requests allowed in half-open state - default: 3"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Priority Queue Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class QueueConfig:
    """Priority Queue configuration"""

    max_size: Optional[Dict[Priority, int]] = None
    """Maximum queue size per priority level"""


DEFAULT_QUEUE_SIZES: Dict[Priority, int] = {
    "critical": 100,
    "high": 500,
    "normal": 1000,
    "low": 2000,
    "background": 5000,
}
"""Default queue size limits per priority"""


@dataclass
class QueuedRequest:
    """A queued request waiting for execution"""

    id: str
    """Unique request ID"""

    operation: Callable[[], Awaitable[Any]]
    """The async operation to execute"""

    priority: Priority
    """Request priority"""

    operation_name: str
    """Operation name for logging/metrics"""

    queued_at: float
    """When the request was queued (timestamp)"""

    attempts: int
    """Number of execution attempts"""

    resolve: Callable[[Any], None]
    """Callback to resolve the request"""

    reject: Callable[[Exception], None]
    """Callback to reject the request"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Main Resilience Configuration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class ResilienceConfig:
    """Main resilience layer configuration"""

    enabled: bool = True
    """Enable/disable resilience layer - default: True"""

    rate_limiter: Optional[RateLimiterConfig] = None
    """Token bucket rate limiter settings"""

    concurrency: Optional[ConcurrencyConfig] = None
    """Semaphore concurrency limiter settings"""

    circuit_breaker: Optional[CircuitBreakerConfig] = None
    """Circuit breaker settings"""

    queue: Optional[QueueConfig] = None
    """Priority queue settings"""

    # Monitoring hooks
    on_circuit_open: Optional[Callable[[int], None]] = None
    """Called when circuit breaker opens"""

    on_circuit_close: Optional[Callable[[], None]] = None
    """Called when circuit breaker closes"""

    on_circuit_half_open: Optional[Callable[[], None]] = None
    """Called when circuit breaker enters half-open state"""

    on_queue_full: Optional[Callable[[Priority], None]] = None
    """Called when a queue is full and request is dropped"""

    on_throttle: Optional[Callable[[float], None]] = None
    """Called when request is throttled (waiting for rate limit)"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Metrics Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class RateLimiterMetrics:
    """Rate limiter metrics"""

    tokens_available: int
    """Current available tokens"""

    requests_throttled: int
    """Total requests that had to wait"""

    avg_wait_time_ms: float
    """Average wait time for throttled requests (ms)"""


@dataclass
class ConcurrencyMetrics:
    """Concurrency limiter metrics"""

    active: int
    """Currently executing requests"""

    waiting: int
    """Requests waiting for a permit"""

    max_reached: int
    """Peak concurrent requests reached"""

    timeouts: int
    """Requests that timed out waiting"""


@dataclass
class CircuitBreakerMetrics:
    """Circuit breaker metrics"""

    state: CircuitState
    """Current circuit state"""

    failures: int
    """Consecutive failures count"""

    last_failure_at: Optional[float]
    """Last failure timestamp"""

    last_state_change_at: float
    """Last state change timestamp"""

    total_opens: int
    """Total times circuit has opened"""


@dataclass
class QueueMetrics:
    """Priority queue metrics"""

    total: int
    """Total requests in queue"""

    by_priority: Dict[Priority, int]
    """Queue size by priority"""

    processed: int
    """Total requests processed from queue"""

    dropped: int
    """Total requests dropped (queue full)"""

    oldest_request_age_ms: Optional[float]
    """Oldest request age in queue (ms)"""


@dataclass
class ResilienceMetrics:
    """Combined resilience metrics"""

    rate_limiter: RateLimiterMetrics
    """Rate limiter statistics"""

    concurrency: ConcurrencyMetrics
    """Concurrency limiter statistics"""

    circuit_breaker: CircuitBreakerMetrics
    """Circuit breaker statistics"""

    queue: QueueMetrics
    """Queue statistics"""

    timestamp: float
    """Metrics collection timestamp"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Error Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class CircuitOpenError(Exception):
    """Error thrown when circuit breaker is open"""

    def __init__(
        self,
        message: str = "Circuit breaker is open - request rejected",
        retry_after_ms: Optional[float] = None,
    ):
        super().__init__(message)
        self.retry_after_ms = retry_after_ms


class QueueFullError(Exception):
    """Error thrown when queue is full"""

    def __init__(self, priority: Priority, queue_size: int):
        super().__init__(
            f"Queue full for priority '{priority}' (size: {queue_size}) - request dropped"
        )
        self.priority = priority
        self.queue_size = queue_size


class AcquireTimeoutError(Exception):
    """Error thrown when semaphore acquire times out"""

    def __init__(self, timeout_ms: float, waiting_count: int):
        super().__init__(
            f"Timed out waiting for permit after {timeout_ms}ms ({waiting_count} requests waiting)"
        )
        self.timeout_ms = timeout_ms
        self.waiting_count = waiting_count


class RateLimitExceededError(Exception):
    """Error thrown when rate limit is exceeded and waiting is disabled"""

    def __init__(self, tokens_available: int, refill_in_ms: float):
        super().__init__(
            f"Rate limit exceeded ({tokens_available} tokens available, refill in {refill_in_ms}ms)"
        )
        self.tokens_available = tokens_available
        self.refill_in_ms = refill_in_ms
