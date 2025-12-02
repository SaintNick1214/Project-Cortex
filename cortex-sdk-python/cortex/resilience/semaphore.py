"""
Async Semaphore Concurrency Limiter

Limits the number of concurrent in-flight requests using a semaphore pattern.
Requests beyond the limit wait in a queue until a permit becomes available.

Behavior:
- max_concurrent permits available at any time
- Requests acquire a permit before executing, release after
- Excess requests wait in a queue (up to queue_size)
- Optional timeout prevents indefinite waiting
"""

import asyncio
from typing import List, Optional, Tuple

from .types import (
    AcquireTimeoutError,
    ConcurrencyConfig,
    ConcurrencyMetrics,
    SemaphorePermit,
)


class Semaphore:
    """Async semaphore for limiting concurrent operations."""

    def __init__(self, config: Optional[ConcurrencyConfig] = None):
        """
        Initialize the semaphore.

        Args:
            config: Concurrency configuration (uses defaults if not provided)
        """
        cfg = config or ConcurrencyConfig()
        self._max_permits = cfg.max_concurrent
        self._queue_limit = cfg.queue_size
        self._default_timeout = cfg.timeout
        self._available_permits = self._max_permits
        self._waiting: List[Tuple[asyncio.Future, Optional[asyncio.TimerHandle]]] = []

        # Metrics tracking
        self._max_reached = 0
        self._timeouts = 0

    async def acquire(self, timeout: Optional[float] = None) -> SemaphorePermit:
        """
        Acquire a permit, waiting if necessary.

        Args:
            timeout: Maximum time to wait (seconds). Uses default if not provided.

        Returns:
            A permit that must be released when done

        Raises:
            AcquireTimeoutError: If timeout is reached
            RuntimeError: If queue is full
        """
        # Fast path: permit available immediately
        if self._available_permits > 0:
            self._available_permits -= 1
            self._update_max_reached()
            return self._create_permit()

        # Check queue limit
        if len(self._waiting) >= self._queue_limit:
            raise RuntimeError(
                f"Semaphore queue full ({self._queue_limit} requests waiting)"
            )

        # Wait for a permit
        effective_timeout = timeout if timeout is not None else self._default_timeout
        loop = asyncio.get_event_loop()
        future: asyncio.Future = loop.create_future()
        timer_handle: Optional[asyncio.TimerHandle] = None

        # Set timeout if specified
        if effective_timeout > 0:

            def on_timeout() -> None:
                if not future.done():
                    # Remove from waiting list
                    self._waiting = [
                        (f, h) for f, h in self._waiting if f is not future
                    ]
                    self._timeouts += 1
                    future.set_exception(
                        AcquireTimeoutError(
                            effective_timeout * 1000, len(self._waiting)
                        )
                    )

            timer_handle = loop.call_later(effective_timeout, on_timeout)

        self._waiting.append((future, timer_handle))

        try:
            result = await future
            return result  # type: ignore[no-any-return]
        except asyncio.CancelledError:
            # Remove from waiting list on cancellation
            self._waiting = [(f, h) for f, h in self._waiting if f is not future]
            if timer_handle:
                timer_handle.cancel()
            raise

    def try_acquire(self) -> Optional[SemaphorePermit]:
        """
        Try to acquire a permit without waiting.

        Returns:
            A permit if available, None otherwise
        """
        if self._available_permits > 0:
            self._available_permits -= 1
            self._update_max_reached()
            return self._create_permit()

        return None

    def _create_permit(self) -> SemaphorePermit:
        """Create a permit object with release function."""
        released = False

        def release() -> None:
            nonlocal released
            if released:
                return

            released = True
            self._release()

        return SemaphorePermit(release=release)

    def _release(self) -> None:
        """Release a permit back to the semaphore."""
        # If there are waiting requests, give permit to next in line
        if self._waiting:
            future, timer_handle = self._waiting.pop(0)

            # Clear timeout if set
            if timer_handle:
                timer_handle.cancel()

            # Give them a new permit (don't increase available_permits)
            self._update_max_reached()

            if not future.done():
                future.set_result(self._create_permit())
        else:
            # No waiting requests, return permit to pool
            self._available_permits += 1

    def _update_max_reached(self) -> None:
        """Update max concurrent reached metric."""
        active = self._max_permits - self._available_permits
        if active > self._max_reached:
            self._max_reached = active

    def get_active_count(self) -> int:
        """Get number of currently active (acquired) permits."""
        return self._max_permits - self._available_permits

    def get_waiting_count(self) -> int:
        """Get number of requests waiting for a permit."""
        return len(self._waiting)

    def get_available_count(self) -> int:
        """Get available permits."""
        return self._available_permits

    def get_metrics(self) -> ConcurrencyMetrics:
        """Get current metrics."""
        return ConcurrencyMetrics(
            active=self.get_active_count(),
            waiting=len(self._waiting),
            max_reached=self._max_reached,
            timeouts=self._timeouts,
        )

    def reset(self) -> None:
        """
        Reset semaphore to initial state.
        WARNING: This will reject all waiting requests.
        """
        # Reject all waiting requests
        for future, timer_handle in self._waiting:
            if timer_handle:
                timer_handle.cancel()
            if not future.done():
                future.set_exception(RuntimeError("Semaphore reset"))

        self._waiting = []

        # Reset permits and metrics
        self._available_permits = self._max_permits
        self._max_reached = 0
        self._timeouts = 0
