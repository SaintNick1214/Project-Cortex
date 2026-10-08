"""
Token Bucket Rate Limiter

Implements the classic token bucket algorithm to smooth burst traffic.
Tokens are consumed on each request and refill over time.

Behavior:
- Bucket starts full (bucket_size tokens)
- Each request consumes 1 token
- Tokens refill at refill_rate per second
- Burst traffic up to bucket_size passes immediately
- Sustained traffic is smoothed to refill_rate
"""

import asyncio
import time
from typing import Optional

from .types import RateLimiterConfig, RateLimiterMetrics, RateLimitExceededError


class TokenBucket:
    """Token bucket rate limiter for smoothing burst traffic."""

    def __init__(self, config: Optional[RateLimiterConfig] = None):
        """
        Initialize the token bucket.

        Args:
            config: Rate limiter configuration (uses defaults if not provided)
        """
        cfg = config or RateLimiterConfig()
        self._bucket_size = cfg.bucket_size
        self._refill_rate = cfg.refill_rate
        self._tokens = float(self._bucket_size)  # Start with full bucket
        self._last_refill = time.time()

        # Metrics tracking
        self._requests_throttled = 0
        self._total_wait_time_ms = 0.0

    def _refill(self) -> None:
        """Refill tokens based on time elapsed since last refill."""
        now = time.time()
        elapsed = now - self._last_refill
        tokens_to_add = elapsed * self._refill_rate

        self._tokens = min(self._bucket_size, self._tokens + tokens_to_add)
        self._last_refill = now

    def try_acquire(self) -> bool:
        """
        Try to acquire a token without waiting.

        Returns:
            True if token was acquired, False if bucket is empty
        """
        self._refill()

        if self._tokens >= 1:
            self._tokens -= 1
            return True

        return False

    async def acquire(self, timeout: Optional[float] = None) -> None:
        """
        Acquire a token, waiting if necessary.

        Args:
            timeout: Maximum time to wait (seconds). If not provided, waits indefinitely.

        Raises:
            RateLimitExceededError: If timeout is reached
        """
        self._refill()

        # Fast path: token available immediately
        if self._tokens >= 1:
            self._tokens -= 1
            return

        # Calculate time until next token is available
        tokens_needed = 1 - self._tokens
        wait_time_s = tokens_needed / self._refill_rate

        # Check timeout
        if timeout is not None and wait_time_s > timeout:
            raise RateLimitExceededError(
                int(self._tokens), wait_time_s * 1000  # Convert to ms
            )

        # Track throttling metrics
        self._requests_throttled += 1
        self._total_wait_time_ms += wait_time_s * 1000

        # Wait for token to become available
        await asyncio.sleep(wait_time_s)

        # Refill and consume token
        self._refill()
        self._tokens -= 1

    def get_available_tokens(self) -> int:
        """Get the number of tokens currently available."""
        self._refill()
        return int(self._tokens)

    def get_time_until_next_token(self) -> float:
        """
        Get time until next token is available (seconds).

        Returns:
            Time in seconds, 0 if token is available
        """
        self._refill()

        if self._tokens >= 1:
            return 0.0

        tokens_needed = 1 - self._tokens
        return tokens_needed / self._refill_rate

    def get_metrics(self) -> RateLimiterMetrics:
        """Get current metrics."""
        self._refill()

        return RateLimiterMetrics(
            tokens_available=int(self._tokens),
            requests_throttled=self._requests_throttled,
            avg_wait_time_ms=(
                self._total_wait_time_ms / self._requests_throttled
                if self._requests_throttled > 0
                else 0.0
            ),
        )

    def reset(self) -> None:
        """Reset the bucket to full and clear metrics."""
        self._tokens = float(self._bucket_size)
        self._last_refill = time.time()
        self._requests_throttled = 0
        self._total_wait_time_ms = 0.0
