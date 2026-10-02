"""
Circuit Breaker

Implements the circuit breaker pattern to prevent cascading failures.
When too many failures occur, the circuit "opens" and fails fast.

States:
- CLOSED: Normal operation, counting failures
- OPEN: All requests fail immediately, waiting for timeout
- HALF-OPEN: Testing with limited requests to see if system recovered

Behavior:
- Starts in CLOSED state
- Opens after failure_threshold consecutive failures
- Waits timeout seconds in OPEN state, then transitions to HALF-OPEN
- In HALF-OPEN, allows half_open_max test requests
- If success_threshold successes in HALF-OPEN, transitions to CLOSED
- Any failure in HALF-OPEN transitions back to OPEN
"""

import time
from typing import Awaitable, Callable, Optional, TypeVar

from .types import (
    CircuitBreakerConfig,
    CircuitBreakerMetrics,
    CircuitOpenError,
    CircuitState,
)

T = TypeVar("T")


class CircuitBreaker:
    """Circuit breaker for preventing cascading failures."""

    def __init__(
        self,
        config: Optional[CircuitBreakerConfig] = None,
        on_open: Optional[Callable[[int], None]] = None,
        on_close: Optional[Callable[[], None]] = None,
        on_half_open: Optional[Callable[[], None]] = None,
    ):
        """
        Initialize the circuit breaker.

        Args:
            config: Circuit breaker configuration (uses defaults if not provided)
            on_open: Callback when circuit opens
            on_close: Callback when circuit closes
            on_half_open: Callback when circuit enters half-open
        """
        cfg = config or CircuitBreakerConfig()
        self._failure_threshold = cfg.failure_threshold
        self._success_threshold = cfg.success_threshold
        self._timeout = cfg.timeout
        self._half_open_max = cfg.half_open_max

        self._state: CircuitState = "closed"
        self._failures = 0
        self._successes = 0
        self._half_open_attempts = 0
        self._last_failure_at: Optional[float] = None
        self._last_state_change_at = time.time()
        self._opened_at: Optional[float] = None

        # Metrics
        self._total_opens = 0

        # Callbacks
        self._on_open = on_open
        self._on_close = on_close
        self._on_half_open = on_half_open

    def is_open(self) -> bool:
        """Check if circuit is currently open (not accepting requests)."""
        # Check if we should transition from open to half-open
        if self._state == "open" and self._opened_at:
            elapsed = time.time() - self._opened_at
            if elapsed >= self._timeout:
                self._transition_to("half-open")

        return self._state == "open"

    def allows_execution(self) -> bool:
        """Check if circuit allows execution."""
        # Update state if needed
        self.is_open()

        if self._state == "closed":
            return True

        if self._state == "open":
            return False

        # Half-open: allow limited requests
        return self._half_open_attempts < self._half_open_max

    async def execute(self, fn: Callable[[], Awaitable[T]]) -> T:
        """
        Execute a function through the circuit breaker.

        Args:
            fn: The async function to execute

        Returns:
            The result of the function

        Raises:
            CircuitOpenError: If circuit is open
        """
        if not self.allows_execution():
            retry_after = (
                (self._timeout - (time.time() - self._opened_at)) * 1000
                if self._opened_at
                else self._timeout * 1000
            )

            raise CircuitOpenError(
                "Circuit breaker is open - request rejected",
                max(0, retry_after),
            )

        # Track half-open attempts
        if self._state == "half-open":
            self._half_open_attempts += 1

        try:
            result = await fn()
            self.record_success()
            return result
        except Exception as e:
            self.record_failure(e)
            raise

    def record_success(self) -> None:
        """Record a successful execution."""
        if self._state == "closed":
            # Reset failure count on success
            self._failures = 0

        elif self._state == "half-open":
            self._successes += 1

            # Check if we should close the circuit
            if self._successes >= self._success_threshold:
                self._transition_to("closed")

    def record_failure(self, error: Optional[Exception] = None) -> None:
        """Record a failed execution."""
        self._last_failure_at = time.time()

        if self._state == "closed":
            self._failures += 1

            # Check if we should open the circuit
            if self._failures >= self._failure_threshold:
                self._transition_to("open")

        elif self._state == "half-open":
            # Any failure in half-open reopens the circuit
            self._transition_to("open")

    def get_state(self) -> CircuitState:
        """Get current circuit state."""
        # Check for state transition
        self.is_open()
        return self._state

    def get_time_until_close(self) -> float:
        """
        Get time until circuit might close (seconds).

        Returns:
            0 if circuit is closed
        """
        if self._state == "closed":
            return 0.0

        if self._state == "open" and self._opened_at:
            elapsed = time.time() - self._opened_at
            return max(0.0, self._timeout - elapsed)

        # Half-open: depends on test results
        return 0.0

    def get_metrics(self) -> CircuitBreakerMetrics:
        """Get current metrics."""
        # Update state if needed
        self.is_open()

        return CircuitBreakerMetrics(
            state=self._state,
            failures=self._failures,
            last_failure_at=self._last_failure_at,
            last_state_change_at=self._last_state_change_at,
            total_opens=self._total_opens,
        )

    def reset(self) -> None:
        """Manually reset circuit to closed state."""
        self._transition_to("closed")
        self._failures = 0
        self._successes = 0
        self._half_open_attempts = 0
        self._last_failure_at = None
        self._total_opens = 0

    def force_open(self) -> None:
        """Force circuit to open state (for testing/maintenance)."""
        self._transition_to("open")

    def force_close(self) -> None:
        """Force circuit to closed state (for testing/recovery)."""
        self._transition_to("closed")

    def _transition_to(self, new_state: CircuitState) -> None:
        """Transition to a new state."""
        if self._state == new_state:
            return

        previous_state = self._state
        self._state = new_state
        self._last_state_change_at = time.time()

        # Reset state-specific counters
        if new_state == "closed":
            self._failures = 0
            self._successes = 0
            self._half_open_attempts = 0
            if self._on_close:
                self._on_close()

        elif new_state == "open":
            self._opened_at = time.time()
            self._successes = 0
            self._half_open_attempts = 0

            # Only count as open if transitioning from non-open state
            if previous_state != "open":
                self._total_opens += 1

            if self._on_open:
                self._on_open(self._failures)

        elif new_state == "half-open":
            self._successes = 0
            self._half_open_attempts = 0
            if self._on_half_open:
                self._on_half_open()
