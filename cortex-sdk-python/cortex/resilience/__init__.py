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
]

T = TypeVar("T")


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
    """

    @staticmethod
    def default() -> ResilienceConfig:
        """
        Default configuration for Convex Free/Starter plan.

        Respects Convex's 16 concurrent query/mutation limit.
        Good for most single-agent use cases.
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
        )

    @staticmethod
    def real_time_agent() -> ResilienceConfig:
        """
        Real-time agent configuration for Convex Free/Starter plan.

        Optimized for low latency conversation storage.
        Uses conservative limits to ensure fast response times.
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
        )

    @staticmethod
    def batch_processing() -> ResilienceConfig:
        """
        Batch processing configuration for Convex Professional plan.

        High throughput for bulk operations.
        ⚠️ Requires Professional plan (256 concurrent limit).
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
        )

    @staticmethod
    def hive_mode() -> ResilienceConfig:
        """
        Hive Mode configuration for Convex Professional plan.

        Extreme concurrency for multi-agent swarms sharing one database.
        ⚠️ Requires Professional plan with increased limits.
        Contact Convex support for limits beyond default Professional tier.
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
        )

    @staticmethod
    def disabled() -> ResilienceConfig:
        """Disabled configuration. Bypasses all resilience mechanisms."""
        return ResilienceConfig(enabled=False)


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
        Execute an operation through all resilience layers.

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
            # Record failure
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
        max_retries: int = 3,
        retry_delay_s: float = 1.0,
    ) -> T:
        """
        Execute with automatic retry on transient failures.

        Args:
            operation: The operation to execute
            operation_name: Operation identifier
            max_retries: Maximum retry attempts
            retry_delay_s: Delay between retries (seconds)

        Returns:
            The result of the operation
        """
        last_error: Optional[Exception] = None

        for attempt in range(max_retries + 1):
            try:
                return await self.execute(operation, operation_name)
            except CircuitOpenError:
                # Don't retry on circuit open
                raise
            except QueueFullError:
                # Don't retry on queue full
                raise
            except Exception as e:
                last_error = e

                # Wait before retry (exponential backoff)
                if attempt < max_retries:
                    delay = retry_delay_s * (2**attempt)
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
