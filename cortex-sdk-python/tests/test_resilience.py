"""
Resilience Layer Tests

Tests for the overload protection system components:
- Token Bucket Rate Limiter
- Semaphore Concurrency Limiter
- Priority Queue
- Circuit Breaker
- ResilienceLayer (integration)
"""

import asyncio
import time
from typing import Any

import pytest

from cortex.resilience import (
    AcquireTimeoutError,
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitOpenError,
    ConcurrencyConfig,
    PriorityQueue,
    QueueConfig,
    QueuedRequest,
    QueueFullError,
    RateLimiterConfig,
    RateLimitExceededError,
    ResilienceConfig,
    ResilienceLayer,
    ResiliencePresets,
    Semaphore,
    TokenBucket,
    get_priority,
    is_critical,
)


# Helper to create test operations
async def create_operation(result: Any, delay: float = 0):
    """Create a successful async operation."""
    if delay > 0:
        await asyncio.sleep(delay)
    return result


async def create_failing_operation(error: Exception, delay: float = 0):
    """Create a failing async operation."""
    if delay > 0:
        await asyncio.sleep(delay)
    raise error


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Token Bucket Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestTokenBucket:
    def test_starts_with_full_bucket(self):
        bucket = TokenBucket(RateLimiterConfig(bucket_size=10, refill_rate=5))
        assert bucket.get_available_tokens() == 10

    def test_allows_burst_up_to_bucket_size(self):
        bucket = TokenBucket(RateLimiterConfig(bucket_size=5, refill_rate=10))

        # Should be able to acquire 5 tokens immediately
        for _ in range(5):
            assert bucket.try_acquire() is True

        # 6th should fail
        assert bucket.try_acquire() is False

    @pytest.mark.asyncio
    async def test_refills_tokens_over_time(self):
        bucket = TokenBucket(RateLimiterConfig(bucket_size=10, refill_rate=100))

        # Drain all tokens
        for _ in range(10):
            bucket.try_acquire()

        assert bucket.get_available_tokens() == 0

        # Wait for refill
        await asyncio.sleep(0.05)

        # Should have some tokens back
        assert bucket.get_available_tokens() > 0

    @pytest.mark.asyncio
    async def test_waits_for_token_when_acquiring_async(self):
        bucket = TokenBucket(RateLimiterConfig(bucket_size=1, refill_rate=100))

        bucket.try_acquire()  # Use the only token

        start = time.time()
        await bucket.acquire()  # Should wait for refill
        elapsed = time.time() - start

        # Should have waited some time
        assert elapsed > 0.005

    @pytest.mark.asyncio
    async def test_raises_on_timeout(self):
        bucket = TokenBucket(RateLimiterConfig(bucket_size=1, refill_rate=1))

        bucket.try_acquire()

        with pytest.raises(RateLimitExceededError):
            await bucket.acquire(timeout=0.01)

    def test_tracks_metrics(self):
        bucket = TokenBucket(RateLimiterConfig(bucket_size=10, refill_rate=50))

        bucket.try_acquire()
        bucket.try_acquire()

        metrics = bucket.get_metrics()
        assert metrics.tokens_available == 8

    def test_resets_correctly(self):
        bucket = TokenBucket(RateLimiterConfig(bucket_size=10, refill_rate=50))

        bucket.try_acquire()
        bucket.try_acquire()

        bucket.reset()

        assert bucket.get_available_tokens() == 10
        assert bucket.get_metrics().requests_throttled == 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Semaphore Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestSemaphore:
    def test_allows_up_to_max_permits(self):
        sem = Semaphore(ConcurrencyConfig(max_concurrent=3, queue_size=10, timeout=1))

        p1 = sem.try_acquire()
        p2 = sem.try_acquire()
        p3 = sem.try_acquire()
        p4 = sem.try_acquire()

        assert p1 is not None
        assert p2 is not None
        assert p3 is not None
        assert p4 is None

        assert sem.get_active_count() == 3

    @pytest.mark.asyncio
    async def test_releases_permit_properly(self):
        sem = Semaphore(ConcurrencyConfig(max_concurrent=1, queue_size=10, timeout=1))

        permit = sem.try_acquire()
        assert sem.get_active_count() == 1

        permit.release()
        assert sem.get_active_count() == 0

    @pytest.mark.asyncio
    async def test_queues_waiting_requests(self):
        sem = Semaphore(ConcurrencyConfig(max_concurrent=1, queue_size=10, timeout=1))

        permit1 = await sem.acquire()
        assert sem.get_waiting_count() == 0

        # Start waiting for permit
        wait_task = asyncio.create_task(sem.acquire())
        await asyncio.sleep(0.01)

        assert sem.get_waiting_count() == 1

        # Release first permit
        permit1.release()

        # Waiting request should now have permit
        permit2 = await wait_task
        assert sem.get_active_count() == 1
        permit2.release()

    @pytest.mark.asyncio
    async def test_timeouts_waiting_requests(self):
        sem = Semaphore(ConcurrencyConfig(max_concurrent=1, queue_size=10, timeout=0.05))

        permit = await sem.acquire()

        with pytest.raises(AcquireTimeoutError):
            await sem.acquire(timeout=0.05)

        permit.release()

    @pytest.mark.asyncio
    async def test_raises_when_queue_is_full(self):
        sem = Semaphore(ConcurrencyConfig(max_concurrent=1, queue_size=1, timeout=1))

        await sem.acquire()  # Take the permit

        # First waiter should be queued
        asyncio.create_task(sem.acquire())
        await asyncio.sleep(0.01)

        # Second waiter should fail (queue full)
        with pytest.raises(RuntimeError, match="queue full"):
            await sem.acquire()

        sem.reset()

    def test_tracks_metrics(self):
        sem = Semaphore(ConcurrencyConfig(max_concurrent=3, queue_size=10, timeout=1))

        sem.try_acquire()
        sem.try_acquire()

        metrics = sem.get_metrics()
        assert metrics.active == 2
        assert metrics.waiting == 0
        assert metrics.max_reached == 2


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Priority Queue Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestPriorityQueue:
    def _create_request(self, priority: str, id: str = "test") -> QueuedRequest:
        return QueuedRequest(
            id=id,
            operation=lambda: asyncio.sleep(0),
            priority=priority,
            operation_name="test",
            queued_at=time.time(),
            attempts=0,
            resolve=lambda x: None,
            reject=lambda x: None,
        )

    def test_processes_in_priority_order(self):
        queue = PriorityQueue()

        queue.enqueue(self._create_request("low", "low-1"))
        queue.enqueue(self._create_request("high", "high-1"))
        queue.enqueue(self._create_request("normal", "normal-1"))
        queue.enqueue(self._create_request("critical", "critical-1"))

        assert queue.dequeue().id == "critical-1"
        assert queue.dequeue().id == "high-1"
        assert queue.dequeue().id == "normal-1"
        assert queue.dequeue().id == "low-1"

    def test_maintains_fifo_within_priority(self):
        queue = PriorityQueue()

        queue.enqueue(self._create_request("normal", "first"))
        queue.enqueue(self._create_request("normal", "second"))
        queue.enqueue(self._create_request("normal", "third"))

        assert queue.dequeue().id == "first"
        assert queue.dequeue().id == "second"
        assert queue.dequeue().id == "third"

    def test_raises_when_queue_is_full(self):
        queue = PriorityQueue(
            QueueConfig(
                max_size={
                    "critical": 1,
                    "high": 1,
                    "normal": 1,
                    "low": 1,
                    "background": 1,
                }
            )
        )

        queue.enqueue(self._create_request("normal", "first"))

        with pytest.raises(QueueFullError):
            queue.enqueue(self._create_request("normal", "second"))

    def test_tracks_size_by_priority(self):
        queue = PriorityQueue()

        queue.enqueue(self._create_request("high", "h1"))
        queue.enqueue(self._create_request("high", "h2"))
        queue.enqueue(self._create_request("normal", "n1"))

        sizes = queue.size_by_priority()
        assert sizes["high"] == 2
        assert sizes["normal"] == 1
        assert sizes["low"] == 0

    def test_tracks_metrics(self):
        queue = PriorityQueue()

        queue.enqueue(self._create_request("normal"))
        queue.dequeue()

        metrics = queue.get_metrics()
        assert metrics.processed == 1
        assert metrics.total == 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Circuit Breaker Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestCircuitBreaker:
    def test_starts_in_closed_state(self):
        cb = CircuitBreaker()
        assert cb.get_state() == "closed"
        assert cb.is_open() is False

    @pytest.mark.asyncio
    async def test_opens_after_threshold_failures(self):
        cb = CircuitBreaker(
            CircuitBreakerConfig(failure_threshold=3, success_threshold=2, timeout=1)
        )

        async def failing_op():
            raise RuntimeError("Test error")

        # Fail 3 times
        for _ in range(3):
            try:
                await cb.execute(failing_op)
            except RuntimeError:
                pass

        assert cb.get_state() == "open"
        assert cb.is_open() is True

    @pytest.mark.asyncio
    async def test_rejects_requests_when_open(self):
        cb = CircuitBreaker(CircuitBreakerConfig(failure_threshold=1))

        async def failing_op():
            raise RuntimeError("Test error")

        try:
            await cb.execute(failing_op)
        except RuntimeError:
            pass

        async def success_op():
            return "test"

        with pytest.raises(CircuitOpenError):
            await cb.execute(success_op)

    @pytest.mark.asyncio
    async def test_transitions_to_half_open_after_timeout(self):
        cb = CircuitBreaker(CircuitBreakerConfig(failure_threshold=1, timeout=0.05))

        async def failing_op():
            raise RuntimeError("Test error")

        try:
            await cb.execute(failing_op)
        except RuntimeError:
            pass

        assert cb.get_state() == "open"

        # Wait for timeout
        await asyncio.sleep(0.06)

        # Should now be half-open
        assert cb.get_state() == "half-open"

    @pytest.mark.asyncio
    async def test_closes_after_successes_in_half_open(self):
        cb = CircuitBreaker(
            CircuitBreakerConfig(
                failure_threshold=1,
                success_threshold=2,
                timeout=0.05,
                half_open_max=3,
            )
        )

        # Open the circuit
        async def failing_op():
            raise RuntimeError("Test error")

        try:
            await cb.execute(failing_op)
        except RuntimeError:
            pass

        # Wait for timeout
        await asyncio.sleep(0.06)

        # Execute successful operations
        async def success_op():
            return "test"

        await cb.execute(success_op)
        await cb.execute(success_op)

        assert cb.get_state() == "closed"

    @pytest.mark.asyncio
    async def test_calls_on_open_callback(self):
        open_called = False

        def on_open(failures):
            nonlocal open_called
            open_called = True

        cb = CircuitBreaker(
            CircuitBreakerConfig(failure_threshold=1), on_open=on_open
        )

        async def failing_op():
            raise RuntimeError("Test error")

        try:
            await cb.execute(failing_op)
        except RuntimeError:
            pass

        assert open_called is True

    @pytest.mark.asyncio
    async def test_tracks_metrics(self):
        cb = CircuitBreaker(CircuitBreakerConfig(failure_threshold=3))

        async def failing_op():
            raise RuntimeError("Test error")

        for _ in range(2):
            try:
                await cb.execute(failing_op)
            except RuntimeError:
                pass

        metrics = cb.get_metrics()
        assert metrics.failures == 2
        assert metrics.state == "closed"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Priority Mapping Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestPriorityMapping:
    def test_returns_correct_priorities_for_known_operations(self):
        assert get_priority("users:delete") == "critical"
        assert get_priority("memory:remember") == "high"
        assert get_priority("memory:search") == "normal"
        assert get_priority("memory:export") == "low"
        assert get_priority("graph:sync") == "background"

    def test_matches_wildcard_patterns(self):
        assert get_priority("graphSync:anything") == "background"
        assert get_priority("graphSync:somethingElse") == "background"

    def test_returns_normal_for_unknown_operations(self):
        assert get_priority("unknown:operation") == "normal"
        assert get_priority("foo:bar") == "normal"

    def test_correctly_identifies_critical_operations(self):
        assert is_critical("users:delete") is True
        assert is_critical("governance:purge") is True
        assert is_critical("memory:remember") is False
        assert is_critical("memory:search") is False


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ResilienceLayer Integration Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestResilienceLayer:
    @pytest.fixture
    def resilience(self):
        r = ResilienceLayer(
            ResilienceConfig(
                enabled=True,
                rate_limiter=RateLimiterConfig(bucket_size=10, refill_rate=100),
                concurrency=ConcurrencyConfig(
                    max_concurrent=5, queue_size=100, timeout=1
                ),
                circuit_breaker=CircuitBreakerConfig(
                    failure_threshold=3,
                    success_threshold=2,
                    timeout=0.1,
                    half_open_max=2,
                ),
            )
        )
        yield r
        r.stop_queue_processor()

    @pytest.mark.asyncio
    async def test_executes_operations_through_all_layers(self, resilience):
        async def op():
            return "success"

        result = await resilience.execute(op, "memory:remember")
        assert result == "success"

    @pytest.mark.asyncio
    async def test_passes_through_when_disabled(self):
        disabled = ResilienceLayer(ResilienceConfig(enabled=False))

        async def op():
            return "success"

        result = await disabled.execute(op, "memory:remember")
        assert result == "success"
        disabled.stop_queue_processor()

    def test_reports_healthy_when_circuit_is_closed(self, resilience):
        assert resilience.is_healthy() is True
        assert resilience.is_accepting_requests() is True

    def test_gets_combined_metrics(self, resilience):
        metrics = resilience.get_metrics()

        assert metrics.rate_limiter is not None
        assert metrics.concurrency is not None
        assert metrics.circuit_breaker is not None
        assert metrics.queue is not None
        assert metrics.timestamp > 0

    @pytest.mark.asyncio
    async def test_resets_all_layers(self, resilience):
        async def op():
            return "test"

        await resilience.execute(op, "memory:remember")
        await resilience.execute(op, "memory:remember")

        resilience.reset()

        metrics = resilience.get_metrics()
        assert metrics.concurrency.max_reached == 0

    @pytest.mark.asyncio
    async def test_rejects_non_critical_when_circuit_is_open(self, resilience):
        async def failing_op():
            raise RuntimeError("Test")

        # Force circuit open
        for _ in range(3):
            try:
                await resilience.execute(failing_op, "memory:remember")
            except RuntimeError:
                pass

        async def success_op():
            return "test"

        with pytest.raises(CircuitOpenError):
            await resilience.execute(success_op, "memory:search")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Presets Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestResiliencePresets:
    def test_has_default_preset(self):
        preset = ResiliencePresets.default()
        assert preset is not None
        assert preset.enabled is True

    def test_has_real_time_agent_preset(self):
        preset = ResiliencePresets.real_time_agent()
        assert preset is not None
        assert preset.concurrency.max_concurrent == 10

    def test_has_batch_processing_preset(self):
        preset = ResiliencePresets.batch_processing()
        assert preset is not None
        assert preset.concurrency.max_concurrent == 50

    def test_has_hive_mode_preset(self):
        preset = ResiliencePresets.hive_mode()
        assert preset is not None
        assert preset.concurrency.max_concurrent == 100

    def test_has_disabled_preset(self):
        preset = ResiliencePresets.disabled()
        assert preset is not None
        assert preset.enabled is False
