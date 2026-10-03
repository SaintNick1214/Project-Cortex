"""
Priority Queue

In-memory queue that orders requests by priority level.
Higher priority requests are processed before lower priority ones.

Features:
- Separate queues per priority level
- Configurable max size per priority
- FIFO within same priority level
"""

import time
from typing import Dict, List, Optional, TypeVar

from .types import (
    DEFAULT_QUEUE_SIZES,
    PRIORITY_ORDER,
    Priority,
    QueueConfig,
    QueuedRequest,
    QueueFullError,
    QueueMetrics,
)

T = TypeVar("T")


class PriorityQueue:
    """Priority queue for ordering requests by importance."""

    def __init__(self, config: Optional[QueueConfig] = None):
        """
        Initialize the priority queue.

        Args:
            config: Queue configuration (uses defaults if not provided)
        """
        cfg = config or QueueConfig()

        # Initialize queue for each priority level
        self._queues: Dict[Priority, List[QueuedRequest]] = {
            priority: [] for priority in PRIORITY_ORDER
        }

        # Merge limits with defaults
        self._limits: Dict[Priority, int] = {**DEFAULT_QUEUE_SIZES}
        if cfg.max_size:
            self._limits.update(cfg.max_size)

        # Metrics tracking
        self._processed = 0
        self._dropped = 0

    def enqueue(self, request: QueuedRequest) -> bool:
        """
        Add a request to the queue.

        Args:
            request: The request to queue

        Returns:
            True if queued

        Raises:
            QueueFullError: If queue is full for the given priority
        """
        queue = self._queues[request.priority]
        limit = self._limits[request.priority]

        # Check if queue is full
        if len(queue) >= limit:
            self._dropped += 1
            raise QueueFullError(request.priority, len(queue))

        queue.append(request)
        return True

    def try_enqueue(self, request: QueuedRequest) -> bool:
        """
        Try to add a request without raising an exception.

        Args:
            request: The request to queue

        Returns:
            True if queued, False if queue was full
        """
        queue = self._queues[request.priority]
        limit = self._limits[request.priority]

        if len(queue) >= limit:
            self._dropped += 1
            return False

        queue.append(request)
        return True

    def dequeue(self) -> Optional[QueuedRequest]:
        """
        Remove and return the highest priority request.

        Returns:
            The next request to process, or None if queue is empty
        """
        # Process in priority order (critical first, background last)
        for priority in PRIORITY_ORDER:
            queue = self._queues[priority]

            if queue:
                self._processed += 1
                return queue.pop(0)

        return None

    def peek(self) -> Optional[QueuedRequest]:
        """
        Peek at the highest priority request without removing it.

        Returns:
            The next request that would be dequeued, or None if empty
        """
        for priority in PRIORITY_ORDER:
            queue = self._queues[priority]

            if queue:
                return queue[0]

        return None

    def size(self) -> int:
        """Get total number of queued requests."""
        return sum(len(queue) for queue in self._queues.values())

    def size_by_priority(self) -> Dict[Priority, int]:
        """Get queue size broken down by priority."""
        return {priority: len(queue) for priority, queue in self._queues.items()}

    def is_empty(self) -> bool:
        """Check if the queue is empty."""
        return self.size() == 0

    def has_capacity(self, priority: Priority) -> bool:
        """Check if a specific priority queue has capacity."""
        queue = self._queues[priority]
        return len(queue) < self._limits[priority]

    def get_oldest_request_age(self) -> Optional[float]:
        """
        Get the age of the oldest request in the queue (seconds).

        Returns:
            Age in seconds, or None if queue is empty
        """
        oldest: Optional[float] = None
        now = time.time()

        for queue in self._queues.values():
            if queue:
                age = now - queue[0].queued_at
                if oldest is None or age > oldest:
                    oldest = age

        return oldest

    def remove_expired(self, max_age_s: float) -> int:
        """
        Remove all expired requests (older than max_age).

        Args:
            max_age_s: Maximum age in seconds

        Returns:
            Number of requests removed
        """
        now = time.time()
        removed = 0

        for queue in self._queues.values():
            to_remove = []

            for i, request in enumerate(queue):
                if now - request.queued_at > max_age_s:
                    to_remove.append(i)

            # Remove from end to preserve indices
            for i in reversed(to_remove):
                request = queue.pop(i)
                request.reject(
                    TimeoutError(f"Request expired after {max_age_s}s in queue")
                )
                removed += 1

        return removed

    def cancel(self, request_id: str) -> bool:
        """
        Cancel a specific request by ID.

        Args:
            request_id: The request ID to cancel

        Returns:
            True if found and cancelled, False otherwise
        """
        for queue in self._queues.values():
            for i, request in enumerate(queue):
                if request.id == request_id:
                    queue.pop(i)
                    request.reject(RuntimeError("Request cancelled"))
                    return True

        return False

    def get_metrics(self) -> QueueMetrics:
        """Get current metrics."""
        oldest_age = self.get_oldest_request_age()

        return QueueMetrics(
            total=self.size(),
            by_priority=self.size_by_priority(),
            processed=self._processed,
            dropped=self._dropped,
            oldest_request_age_ms=oldest_age * 1000 if oldest_age else None,
        )

    def clear(self) -> None:
        """Clear all queues and reject all pending requests."""
        for queue in self._queues.values():
            while queue:
                request = queue.pop(0)
                request.reject(RuntimeError("Queue cleared"))

    def reset_metrics(self) -> None:
        """Reset metrics (but keep queued requests)."""
        self._processed = 0
        self._dropped = 0
