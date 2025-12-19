"""
Cortex SDK Resilience Layer

Main entry point for the overload protection system.
Provides a unified interface that combines:
- Token Bucket Rate Limiter (Layer 1)
- Semaphore Concurrency Limiter (Layer 2)
- Priority Queue (Layer 3)
- Circuit Breaker (Layer 4)

Usage:
    from cortex.resilience import ResilienceLayer, ResiliencePresets

    resilience = ResilienceLayer(ResiliencePresets.default())

    # Execute an operation through all layers
    result = await resilience.execute(
        lambda: convex_client.mutation(...),
        'memory:remember'
    )
"""

import asyncio
import time
from typing import Awaitable, Callable, Optional, TypeVar

from .circuit_breaker import CircuitBreaker
from .priorities import OPERATION_PRIORITIES, get_priority, is_critical
from .priority_queue import PriorityQueue
from .semaphore import Semaphore
from .token_bucket import TokenBucket
from .types import (
    DEFAULT_QUEUE_SIZES,
    PRIORITY_ORDER,
    AcquireTimeoutError,
    CircuitBreakerConfig,
    CircuitBreakerMetrics,
    # Errors
    CircuitOpenError,
    CircuitState,
    ConcurrencyConfig,
    ConcurrencyMetrics,
    # Other types
    Priority,
    QueueConfig,
    QueuedRequest,
    QueueFullError,
    QueueMetrics,
    RateLimiterConfig,
    RateLimiterMetrics,
    RateLimitExceededError,
    # Config types
    ResilienceConfig,
    # Metric types
    ResilienceMetrics,
    # Retry config
    RetryConfig,
    SemaphorePermit,
)

# Re-export all types and classes
__all__ = [
    # Main class
    "ResilienceLayer",
    "ResiliencePresets",
    # Component classes
    "TokenBucket",
    "Semaphore",
    "PriorityQueue",
    "CircuitBreaker",
    # Config types
    "ResilienceConfig",
    "RateLimiterConfig",
    "ConcurrencyConfig",
    "CircuitBreakerConfig",
    "QueueConfig",
    "RetryConfig",
    # Metric types
    "ResilienceMetrics",
    "RateLimiterMetrics",
    "ConcurrencyMetrics",
    "CircuitBreakerMetrics",
    "QueueMetrics",
    # Other types
    "Priority",
    "CircuitState",
    "QueuedRequest",
    "SemaphorePermit",
    "PRIORITY_ORDER",
    "DEFAULT_QUEUE_SIZES",
    # Errors
    "CircuitOpenError",
    "QueueFullError",
    "AcquireTimeoutError",
    "RateLimitExceededError",
    # Priority helpers
    "get_priority",
    "is_critical",
    "OPERATION_PRIORITIES",
    # Plan-based preset selection
    "get_preset_for_plan",
    "get_detected_plan_tier",
    "get_plan_limits",
    "ConvexPlanTier",
    # Helper for non-system-failure error detection
    "_is_non_system_failure",
    "_is_idempotent_not_found_error",  # Backwards compatibility alias
]

T = TypeVar("T")


def _is_non_system_failure(e: Exception) -> bool:
    """
    Check if an exception is NOT a system failure and should not trip the circuit breaker.

    The circuit breaker should only trip on actual infrastructure/system failures,
    not on expected application-level errors. This function identifies errors that
    indicate the system is working correctly but the operation couldn't complete
    for business/validation reasons.

    Categories of non-system failures:
    1. Idempotent "not found" errors - Entity already deleted/doesn't exist
    2. Validation errors - Invalid input from client
    3. Duplicate/conflict errors - Idempotent create operations
    4. Empty result errors - Query returned no results (expected)
    5. Permission errors - Auth/authorization issues (not infrastructure)
    6. Configuration errors - Feature not configured (not infrastructure)
    7. Business logic errors - Constraints like HAS_CHILDREN

    Args:
        e: The exception to check

    Returns:
        True if this is NOT a system failure (should not trip circuit breaker)
    """
    error_str = str(e)
    error_lower = error_str.lower()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Category 1: Idempotent "not found" errors
    # Deleting something already deleted = success, not failure
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    not_found_patterns = (
        "IMMUTABLE_ENTRY_NOT_FOUND",
        "USER_NOT_FOUND",
        "CONVERSATION_NOT_FOUND",
        "MEMORY_NOT_FOUND",
        "FACT_NOT_FOUND",
        "MUTABLE_KEY_NOT_FOUND",
        "KEY_NOT_FOUND",
        "CONTEXT_NOT_FOUND",
        "MEMORY_SPACE_NOT_FOUND",
        "MEMORYSPACE_NOT_FOUND",
        "AGENT_NOT_FOUND",
        "AGENT_NOT_REGISTERED",
        "VERSION_NOT_FOUND",
        "PARENT_NOT_FOUND",
        "NOT_FOUND",
        "not found",
    )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Category 2: Validation errors (client bugs, not system failures)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    validation_patterns = (
        "INVALID_",  # Catches all INVALID_* errors
        "DATA_TOO_LARGE",
        "VALUE_TOO_LARGE",
        "invalid ",  # Natural language validation errors
        "validation error",
        "validation failed",
    )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Category 3: Idempotent "already exists" errors
    # Creating something that exists = idempotent success
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    duplicate_patterns = (
        "ALREADY_EXISTS",
        "ALREADY_REGISTERED",
        "MEMORYSPACE_ALREADY_EXISTS",
        "AGENT_ALREADY_REGISTERED",
        "DUPLICATE",
        "CONFLICT",
        "already exists",
        "already registered",
    )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Category 4: Empty result errors (expected, not failures)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    empty_result_patterns = (
        "NO_MEMORIES_MATCHED",
        "NO_USERS_MATCHED",
        "no results",
        "no matches",
    )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Category 5: Permission/auth errors (not infrastructure failures)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    permission_patterns = (
        "PERMISSION_DENIED",
        "UNAUTHORIZED",
        "FORBIDDEN",
        "ACCESS_DENIED",
        "permission denied",
        "unauthorized",
        "forbidden",
    )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Category 6: Configuration errors (feature not enabled, not infra)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    config_patterns = (
        "CLOUD_MODE_REQUIRED",
        "PUBSUB_NOT_CONFIGURED",
        "not configured",
        "not enabled",
    )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Category 7: Business logic constraints (not system failures)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    business_logic_patterns = (
        "HAS_CHILDREN",
        "MEMORYSPACE_HAS_DATA",
        "PURGE_CANCELLED",
        "DELETION_CANCELLED",
        "has children",
        "has data",
        "cancelled",
    )

    # Combine all patterns
    all_patterns = (
        not_found_patterns +
        validation_patterns +
        duplicate_patterns +
        empty_result_patterns +
        permission_patterns +
        config_patterns +
        business_logic_patterns
    )

    # Check if any pattern matches
    return any(
        pattern in error_str or pattern.lower() in error_lower
        for pattern in all_patterns
    )


# Backwards compatibility alias
_is_idempotent_not_found_error = _is_non_system_failure


def _is_retryable_error(e: Exception) -> bool:
    """
    Check if an exception is retryable (transient error that may succeed on retry).

    Retryable errors include:
    - Generic "Server Error" from Convex (transient backend issues)
    - Rate limiting errors
    - Timeout errors
    - Network/connection errors

    Non-retryable errors (won't succeed on retry):
    - Validation errors (client bugs)
    - Not found errors (data doesn't exist)
    - Permission errors (auth issues)
    - Business logic errors (constraints)

    Args:
        e: The exception to check

    Returns:
        True if the error is retryable
    """
    # Non-system failures should NOT be retried - they indicate
    # the request is invalid and will fail every time
    if _is_non_system_failure(e):
        return False

    error_str = str(e)
    error_lower = error_str.lower()

    # Patterns that indicate transient/retryable errors
    retryable_patterns = (
        # Generic server errors (often transient)
        "Server Error",
        "server error",
        "Internal Server Error",
        "internal server error",
        # Rate limiting
        "rate limit",
        "too many requests",
        "429",
        "throttl",
        # Timeouts
        "timeout",
        "timed out",
        "deadline exceeded",
        # Network issues
        "connection",
        "network",
        "ECONNRESET",
        "ECONNREFUSED",
        "ETIMEDOUT",
        # Temporary unavailability
        "temporarily unavailable",
        "service unavailable",
        "503",
        "502",
        "504",
        # Convex-specific transient errors
        "overloaded",
        "try again",
        "retry",
    )

    return any(pattern in error_str or pattern in error_lower for pattern in retryable_patterns)


def _calculate_retry_delay(
    attempt: int,
    base_delay: float,
    max_delay: float,
    exponential_base: float,
    jitter: bool,
) -> float:
    """
    Calculate delay before next retry using exponential backoff with optional jitter.

    Args:
        attempt: Current attempt number (0-based)
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        exponential_base: Exponential backoff multiplier
        jitter: Whether to add random jitter

    Returns:
        Delay in seconds before next retry
    """
    import random

    # Exponential backoff: base_delay * (exponential_base ^ attempt)
    delay = base_delay * (exponential_base ** attempt)

    # Cap at max delay
    delay = min(delay, max_delay)

    # Add jitter (±25%) to prevent thundering herd
    if jitter:
        jitter_range = delay * 0.25
        delay = delay + random.uniform(-jitter_range, jitter_range)

    return max(0.0, delay)


class ResiliencePresets:
    """
    Pre-configured resilience settings for common use cases.

    Based on Convex platform limits:
    https://docs.convex.dev/production/state/limits

    Free/Starter Plan:
      - Concurrent queries: 16
      - Concurrent mutations: 16
      - Concurrent actions: 64
      - Function calls: 1M/month

    Professional Plan:
      - Concurrent queries: 256
      - Concurrent mutations: 256
      - Concurrent actions: 256-1000
      - Function calls: 25M/month

    All presets include automatic retry with exponential backoff for
    transient failures (e.g., "Server Error", rate limiting, timeouts).
    """

    @staticmethod
    def default() -> ResilienceConfig:
        """
        Default configuration for Convex Free/Starter plan.

        Respects Convex's 16 concurrent query/mutation limit.
        Good for most single-agent use cases.
        Includes automatic retry (3 attempts) for transient failures.
        """
        return ResilienceConfig(
            enabled=True,
            rate_limiter=RateLimiterConfig(
                bucket_size=100,  # Allow burst of 100 calls
                refill_rate=50,  # Sustain ~50 ops/sec (well under 1M/month)
            ),
            concurrency=ConcurrencyConfig(
                max_concurrent=16,  # Convex free plan limit for queries/mutations
                queue_size=1000,  # Queue excess requests
                timeout=30,  # 30s timeout
            ),
            circuit_breaker=CircuitBreakerConfig(
                failure_threshold=5,  # Open after 5 consecutive failures
                success_threshold=2,  # Close after 2 successes in half-open
                timeout=30,  # 30s before attempting recovery
                half_open_max=3,  # Allow 3 test requests in half-open
            ),
            queue=QueueConfig(
                max_size={
                    "critical": 100,
                    "high": 500,
                    "normal": 1000,
                    "low": 2000,
                    "background": 5000,
                }
            ),
            retry=RetryConfig(
                max_retries=3,  # Retry up to 3 times
                base_delay_s=0.5,  # Start with 0.5s delay
                max_delay_s=10.0,  # Cap at 10s
                exponential_base=2.0,  # Double delay each attempt
                jitter=True,  # Prevent thundering herd
            ),
        )

    @staticmethod
    def real_time_agent() -> ResilienceConfig:
        """
        Real-time agent configuration for Convex Free/Starter plan.

        Optimized for low latency conversation storage.
        Uses conservative limits to ensure fast response times.
        Includes fast retry (2 attempts) with shorter delays.
        """
        return ResilienceConfig(
            enabled=True,
            rate_limiter=RateLimiterConfig(
                bucket_size=30,  # Small burst for responsive UX
                refill_rate=20,  # Modest sustained rate
            ),
            concurrency=ConcurrencyConfig(
                max_concurrent=8,  # Half of free plan limit for headroom
                queue_size=100,  # Small queue - prefer fast failure
                timeout=5,  # 5s timeout - fail fast for real-time
            ),
            circuit_breaker=CircuitBreakerConfig(
                failure_threshold=3,  # Trip quickly on issues
                success_threshold=2,
                timeout=10,  # Quick recovery attempt
                half_open_max=2,
            ),
            queue=QueueConfig(
                max_size={
                    "critical": 50,
                    "high": 100,
                    "normal": 200,
                    "low": 100,
                    "background": 50,
                }
            ),
            retry=RetryConfig(
                max_retries=2,  # Fewer retries for faster failure
                base_delay_s=0.25,  # Shorter initial delay
                max_delay_s=2.0,  # Lower cap for responsiveness
                exponential_base=2.0,
                jitter=True,
            ),
        )

    @staticmethod
    def batch_processing() -> ResilienceConfig:
        """
        Batch processing configuration for Convex Professional plan.

        High throughput for bulk operations.
        ⚠️ Requires Professional plan (256 concurrent limit).
        Includes patient retry (5 attempts) with longer delays.
        """
        return ResilienceConfig(
            enabled=True,
            rate_limiter=RateLimiterConfig(
                bucket_size=500,  # Large burst for batch imports
                refill_rate=100,  # High sustained throughput
            ),
            concurrency=ConcurrencyConfig(
                max_concurrent=64,  # Professional plan allows 256, use 64 for safety
                queue_size=10000,  # Large queue for batch jobs
                timeout=60,  # 1 minute timeout for batch operations
            ),
            circuit_breaker=CircuitBreakerConfig(
                failure_threshold=10,  # More tolerant of transient failures
                success_threshold=3,
                timeout=60,  # Longer recovery for batch context
                half_open_max=5,
            ),
            queue=QueueConfig(
                max_size={
                    "critical": 200,
                    "high": 1000,
                    "normal": 5000,
                    "low": 10000,
                    "background": 20000,
                }
            ),
            retry=RetryConfig(
                max_retries=5,  # More retries for batch reliability
                base_delay_s=1.0,  # Longer initial delay
                max_delay_s=30.0,  # Higher cap for batch operations
                exponential_base=2.0,
                jitter=True,
            ),
        )

    @staticmethod
    def hive_mode() -> ResilienceConfig:
        """
        Hive Mode configuration for Convex Professional plan.

        Extreme concurrency for multi-agent swarms sharing one database.
        ⚠️ Requires Professional plan with increased limits.
        Contact Convex support for limits beyond default Professional tier.
        Includes aggressive retry (5 attempts) for swarm coordination.
        """
        return ResilienceConfig(
            enabled=True,
            rate_limiter=RateLimiterConfig(
                bucket_size=1000,  # Large burst for swarm coordination
                refill_rate=200,  # High sustained for many agents
            ),
            concurrency=ConcurrencyConfig(
                max_concurrent=128,  # High concurrency for swarms
                queue_size=50000,  # Very large queue for burst absorption
                timeout=120,  # 2 minute timeout for complex coordination
            ),
            circuit_breaker=CircuitBreakerConfig(
                failure_threshold=20,  # Very tolerant - swarms have natural backoff
                success_threshold=5,
                timeout=30,
                half_open_max=10,
            ),
            queue=QueueConfig(
                max_size={
                    "critical": 500,
                    "high": 5000,
                    "normal": 20000,
                    "low": 30000,
                    "background": 50000,
                }
            ),
            retry=RetryConfig(
                max_retries=5,  # Aggressive retry for swarm resilience
                base_delay_s=0.5,  # Moderate initial delay
                max_delay_s=15.0,  # Higher cap but balanced
                exponential_base=1.5,  # Slower backoff for swarms
                jitter=True,  # Critical for swarms to prevent thundering herd
            ),
        )

    @staticmethod
    def disabled() -> ResilienceConfig:
        """Disabled configuration. Bypasses all resilience mechanisms including retry."""
        return ResilienceConfig(enabled=False)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Plan-Based Preset Selection
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Type alias for plan tiers
ConvexPlanTier = str  # "free" | "starter" | "professional"


def get_preset_for_plan(plan: Optional[str] = None) -> ResilienceConfig:
    """
    Get the appropriate resilience preset based on Convex plan tier.

    Reads from CONVEX_PLAN environment variable if not specified.
    Defaults to 'free' plan limits for safety.

    Args:
        plan: Optional plan tier override. If not provided, reads from CONVEX_PLAN env var.

    Returns:
        The appropriate ResilienceConfig for the plan tier

    Example:
        # Auto-detect from CONVEX_PLAN env var
        config = get_preset_for_plan()

        # Explicit plan tier
        pro_config = get_preset_for_plan('professional')

        # Use with ResilienceLayer
        resilience = ResilienceLayer(get_preset_for_plan())
    """
    import os

    effective_plan = plan or os.environ.get("CONVEX_PLAN", "free")

    if effective_plan.lower() == "professional":
        # Professional plan: 256 concurrent queries/mutations
        # Use batch_processing preset which allows higher throughput
        return ResiliencePresets.batch_processing()

    # Free/Starter plan: 16 concurrent queries/mutations
    return ResiliencePresets.default()


def get_detected_plan_tier() -> str:
    """
    Get the detected Convex plan tier from environment.

    Returns:
        The detected plan tier, defaulting to 'free'
    """
    import os

    env_plan = os.environ.get("CONVEX_PLAN", "").lower()
    if env_plan == "professional":
        return "professional"
    if env_plan == "starter":
        return "starter"
    return "free"


def get_plan_limits(plan: Optional[str] = None) -> dict:
    """
    Get concurrency limits for a given Convex plan tier.

    Based on https://docs.convex.dev/production/state/limits

    Args:
        plan: The Convex plan tier

    Returns:
        Dictionary with concurrency limits
    """
    effective_plan = plan or get_detected_plan_tier()

    if effective_plan == "professional":
        return {
            "concurrent_queries": 256,
            "concurrent_mutations": 256,
            "concurrent_actions": 256,
            "max_node_actions": 1000,
        }

    # Free/Starter plan limits
    return {
        "concurrent_queries": 16,
        "concurrent_mutations": 16,
        "concurrent_actions": 64,
        "max_node_actions": 64,
    }


class ResilienceLayer:
    """Main resilience layer that orchestrates all protection mechanisms."""

    def __init__(self, config: Optional[ResilienceConfig] = None):
        """
        Initialize the resilience layer.

        Args:
            config: Resilience configuration (uses defaults if not provided)
        """
        self._config = config or ResiliencePresets.default()
        self._enabled = self._config.enabled

        # Initialize all layers
        self._token_bucket = TokenBucket(self._config.rate_limiter)
        self._semaphore = Semaphore(self._config.concurrency)
        self._queue = PriorityQueue(self._config.queue)
        self._circuit_breaker = CircuitBreaker(
            self._config.circuit_breaker,
            on_open=self._config.on_circuit_open,
            on_close=self._config.on_circuit_close,
            on_half_open=self._config.on_circuit_half_open,
        )

        # Retry configuration (default: enabled with 3 retries)
        self._retry_config = self._config.retry or RetryConfig()

        # Queue processing state
        self._is_processing_queue = False
        self._queue_processor_task: Optional[asyncio.Task] = None

        # Request counter for unique IDs
        self._request_counter = 0

        # Start queue processor if enabled
        if self._enabled:
            self._start_queue_processor()

    def _start_queue_processor(self) -> None:
        """Start background queue processor."""
        try:
            loop = asyncio.get_running_loop()
            self._queue_processor_task = loop.create_task(self._queue_processor_loop())
        except RuntimeError:
            # No running event loop - will start when first operation is executed
            pass

    async def _queue_processor_loop(self) -> None:
        """Background loop to process queued requests."""
        while True:
            try:
                if not self._queue.is_empty():
                    await self._process_queue_batch()
                await asyncio.sleep(0.1)  # 100ms polling interval
            except asyncio.CancelledError:
                break
            except Exception:
                # Don't let errors kill the processor
                await asyncio.sleep(1)

    def stop_queue_processor(self) -> None:
        """Stop background queue processor."""
        if self._queue_processor_task:
            self._queue_processor_task.cancel()
            self._queue_processor_task = None

    async def execute(
        self,
        operation: Callable[[], Awaitable[T]],
        operation_name: str,
    ) -> T:
        """
        Execute an operation through all resilience layers with automatic retry.

        This method provides comprehensive resilience:
        - Rate limiting (token bucket)
        - Concurrency limiting (semaphore)
        - Circuit breaker protection
        - Automatic retry with exponential backoff for transient failures

        Args:
            operation: The async operation to execute
            operation_name: Operation identifier for priority mapping

        Returns:
            The result of the operation
        """
        # Ensure queue processor is running
        if self._enabled and self._queue_processor_task is None:
            self._start_queue_processor()

        # Bypass if disabled
        if not self._enabled:
            return await operation()

        priority = get_priority(operation_name)
        last_error: Optional[Exception] = None
        max_attempts = self._retry_config.max_retries + 1

        for attempt in range(max_attempts):
            try:
                return await self._execute_single_attempt(
                    operation, operation_name, priority
                )
            except CircuitOpenError:
                # Don't retry on circuit open - it's a protective mechanism
                raise
            except QueueFullError:
                # Don't retry on queue full - system is overloaded
                raise
            except Exception as e:
                last_error = e

                # Check if this error is retryable
                if not _is_retryable_error(e):
                    # Non-retryable errors (validation, not found, etc.) - fail immediately
                    raise

                # Check if we have retries left
                if attempt < max_attempts - 1:
                    delay = _calculate_retry_delay(
                        attempt=attempt,
                        base_delay=self._retry_config.base_delay_s,
                        max_delay=self._retry_config.max_delay_s,
                        exponential_base=self._retry_config.exponential_base,
                        jitter=self._retry_config.jitter,
                    )

                    # Call retry hook if configured
                    if self._config.on_retry:
                        try:
                            self._config.on_retry(attempt + 1, e, delay)
                        except Exception:
                            pass  # Don't let hook errors affect retry logic

                    await asyncio.sleep(delay)
                else:
                    # No retries left - raise the last error
                    raise

        # Should not reach here, but just in case
        if last_error:
            raise last_error
        raise RuntimeError("Unexpected state in execute()")

    async def _execute_single_attempt(
        self,
        operation: Callable[[], Awaitable[T]],
        operation_name: str,
        priority: Priority,
    ) -> T:
        """
        Execute a single attempt of an operation through resilience layers.

        This is the core execution logic without retry.
        """
        # Layer 4: Check circuit breaker
        if self._circuit_breaker.is_open():
            # Critical operations always get queued, never rejected
            if is_critical(operation_name):
                return await self._enqueue_and_wait(operation, priority, operation_name)

            # For non-critical, throw error
            metrics = self._circuit_breaker.get_metrics()
            retry_after = self._circuit_breaker.get_time_until_close() * 1000

            raise CircuitOpenError(
                f"Circuit breaker is open ({metrics.failures} failures). "
                f"Retry after {retry_after}ms",
                retry_after,
            )

        # Layer 1: Rate limiting - wait for token
        timeout = self._config.concurrency.timeout if self._config.concurrency else 30
        await self._token_bucket.acquire(timeout)

        # Layer 2: Concurrency limiting - acquire permit
        permit = await self._semaphore.acquire()

        try:
            # Execute the operation
            result = await operation()

            # Record success
            self._circuit_breaker.record_success()

            return result
        except Exception as e:
            # Only record as failure if it's a true system failure.
            # Non-system failures (validation errors, not found, duplicates, etc.)
            # should not trip the circuit breaker as they indicate the system
            # is working correctly, just rejecting invalid/expected operations.
            if not _is_non_system_failure(e):
                self._circuit_breaker.record_failure(e)
            raise
        finally:
            # Release permit
            permit.release()

            # Trigger queue processing
            asyncio.create_task(self._process_queue_batch())

    async def execute_with_retry(
        self,
        operation: Callable[[], Awaitable[T]],
        operation_name: str,
        max_retries: Optional[int] = None,
        base_delay_s: Optional[float] = None,
        max_delay_s: Optional[float] = None,
    ) -> T:
        """
        Execute with custom retry settings (overrides default config).

        Note: The standard execute() method now includes automatic retry by default.
        Use this method only if you need to override the default retry settings.

        Args:
            operation: The operation to execute
            operation_name: Operation identifier
            max_retries: Maximum retry attempts (default: uses config)
            base_delay_s: Base delay between retries in seconds (default: uses config)
            max_delay_s: Maximum delay between retries in seconds (default: uses config)

        Returns:
            The result of the operation
        """
        # Use custom values or fall back to config defaults
        effective_max_retries = max_retries if max_retries is not None else self._retry_config.max_retries
        effective_base_delay = base_delay_s if base_delay_s is not None else self._retry_config.base_delay_s
        effective_max_delay = max_delay_s if max_delay_s is not None else self._retry_config.max_delay_s

        priority = get_priority(operation_name)
        last_error: Optional[Exception] = None

        for attempt in range(effective_max_retries + 1):
            try:
                return await self._execute_single_attempt(
                    operation, operation_name, priority
                )
            except CircuitOpenError:
                # Don't retry on circuit open
                raise
            except QueueFullError:
                # Don't retry on queue full
                raise
            except Exception as e:
                last_error = e

                # Check if this error is retryable
                if not _is_retryable_error(e):
                    raise

                # Wait before retry with exponential backoff
                if attempt < effective_max_retries:
                    delay = _calculate_retry_delay(
                        attempt=attempt,
                        base_delay=effective_base_delay,
                        max_delay=effective_max_delay,
                        exponential_base=self._retry_config.exponential_base,
                        jitter=self._retry_config.jitter,
                    )

                    # Call retry hook if configured
                    if self._config.on_retry:
                        try:
                            self._config.on_retry(attempt + 1, e, delay)
                        except Exception:
                            pass

                    await asyncio.sleep(delay)

        raise last_error or RuntimeError("Max retries exceeded")

    async def _enqueue_and_wait(
        self,
        operation: Callable[[], Awaitable[T]],
        priority: Priority,
        operation_name: str,
    ) -> T:
        """Enqueue an operation and wait for execution."""
        future: asyncio.Future = asyncio.get_event_loop().create_future()

        self._request_counter += 1
        request = QueuedRequest(
            id=f"req_{int(time.time())}_{self._request_counter}",
            operation=operation,
            priority=priority,
            operation_name=operation_name,
            queued_at=time.time(),
            attempts=0,
            resolve=lambda v: future.set_result(v) if not future.done() else None,
            reject=lambda e: future.set_exception(e) if not future.done() else None,
        )

        try:
            self._queue.enqueue(request)
        except QueueFullError:
            if self._config.on_queue_full:
                self._config.on_queue_full(priority)
            raise

        result = await future
        return result  # type: ignore[no-any-return]

    async def _process_queue_batch(self) -> None:
        """Process queued requests."""
        # Prevent concurrent processing
        if self._is_processing_queue:
            return

        self._is_processing_queue = True

        try:
            # Process while there's capacity
            while (
                not self._queue.is_empty()
                and self._circuit_breaker.allows_execution()
            ):
                # Check if we can acquire resources
                if not self._token_bucket.try_acquire():
                    break

                permit = self._semaphore.try_acquire()
                if not permit:
                    break

                # Get next request from queue
                request = self._queue.dequeue()
                if not request:
                    permit.release()
                    break

                # Execute in background
                asyncio.create_task(self._execute_queued_request(request, permit))
        finally:
            self._is_processing_queue = False

    async def _execute_queued_request(
        self, request: QueuedRequest, permit: SemaphorePermit
    ) -> None:
        """Execute a queued request."""
        try:
            result = await request.operation()
            self._circuit_breaker.record_success()
            request.resolve(result)
        except Exception as e:
            # Only record as failure if it's a true system failure
            if not _is_non_system_failure(e):
                self._circuit_breaker.record_failure(e)
            request.reject(e)
        finally:
            permit.release()

    def get_metrics(self) -> ResilienceMetrics:
        """Get current metrics from all layers."""
        return ResilienceMetrics(
            rate_limiter=self._token_bucket.get_metrics(),
            concurrency=self._semaphore.get_metrics(),
            circuit_breaker=self._circuit_breaker.get_metrics(),
            queue=self._queue.get_metrics(),
            timestamp=time.time(),
        )

    def is_healthy(self) -> bool:
        """Check if the system is healthy."""
        if not self._enabled:
            return True

        return self._circuit_breaker.get_state() == "closed"

    def is_accepting_requests(self) -> bool:
        """Check if the system is accepting requests."""
        if not self._enabled:
            return True

        return self._circuit_breaker.allows_execution()

    def reset(self) -> None:
        """Reset all layers to initial state."""
        self._token_bucket.reset()
        self._semaphore.reset()
        self._queue.clear()
        self._circuit_breaker.reset()

    async def shutdown(self, timeout_s: float = 30.0) -> None:
        """
        Graceful shutdown - wait for pending operations.

        Args:
            timeout_s: Maximum time to wait for pending operations
        """
        # Stop accepting new requests
        self.stop_queue_processor()

        # Wait for queue to drain
        start_time = time.time()
        while not self._queue.is_empty() and time.time() - start_time < timeout_s:
            await asyncio.sleep(0.1)

        # Clear any remaining
        if not self._queue.is_empty():
            print(
                f"Shutdown timeout: {self._queue.size()} requests still in queue"
            )
            self._queue.clear()
