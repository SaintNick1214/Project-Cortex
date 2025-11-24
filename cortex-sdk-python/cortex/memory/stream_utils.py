"""
Stream Utility Helpers

Utilities for consuming and handling streaming responses in the Memory API.
Supports Python AsyncIterable protocol.

Python implementation matching TypeScript src/memory/streamUtils.ts
"""

import asyncio
from collections.abc import AsyncIterable
from typing import Any, Callable, Generic, List, Optional, TypeVar

T = TypeVar("T")


def is_async_iterable(value: Any) -> bool:
    """
    Type guard to check if a value is an AsyncIterable.

    Args:
        value: Value to check

    Returns:
        True if value is an AsyncIterable, False otherwise

    Example:
        >>> async def gen():
        ...     yield "test"
        >>> is_async_iterable(gen())
        True
        >>> is_async_iterable("not iterable")
        False
    """
    return isinstance(value, AsyncIterable)


async def consume_async_iterable(iterable: AsyncIterable[str]) -> str:
    """
    Consume an AsyncIterable and return the complete text.

    Args:
        iterable: AsyncIterable to consume

    Returns:
        Complete text from all chunks

    Raises:
        Exception: If iteration fails

    Example:
        >>> async def generator():
        ...     yield "Hello "
        ...     yield "World"
        >>> text = await consume_async_iterable(generator())
        >>> print(text)
        Hello World
    """
    chunks = []

    try:
        async for chunk in iterable:
            if chunk is not None:
                chunks.append(str(chunk))

        return "".join(chunks)
    except Exception as error:
        raise Exception(
            f"Failed to consume AsyncIterable: {str(error)}"
        ) from error


async def consume_stream(stream: Any) -> str:
    """
    Consume any supported stream type and return the complete text.

    Automatically detects the stream type and uses the appropriate consumer.
    Currently supports AsyncIterable protocol (async generators/iterators).

    Args:
        stream: AsyncIterable to consume

    Returns:
        Complete text from stream

    Raises:
        Exception: If stream type is unsupported or consumption fails

    Example:
        >>> # Works with async generators
        >>> async def gen():
        ...     yield "test"
        >>> text = await consume_stream(gen())
        >>> print(text)
        test
    """
    if is_async_iterable(stream):
        return await consume_async_iterable(stream)
    else:
        raise Exception(
            "Unsupported stream type. Must be AsyncIterable[str] "
            "(e.g., async generator or async iterator)"
        )


class RollingContextWindow:
    """
    Create a rolling context window for streaming
    Keeps only the last N characters in memory
    """

    def __init__(self, max_size: int = 1000) -> None:
        self.window: List[str] = []
        self.max_size = max_size

    def add(self, chunk: str) -> None:
        """Add a chunk to the window"""
        self.window.append(chunk)

        # Trim window if it exceeds max size
        while len(self.get_context()) > self.max_size and len(self.window) > 1:
            self.window.pop(0)

    def get_context(self) -> str:
        """Get current context"""
        return "".join(self.window)

    def get_size(self) -> int:
        """Get context size"""
        return len(self.get_context())

    def clear(self) -> None:
        """Clear the window"""
        self.window = []


class AsyncQueue(Generic[T]):
    """Create an async queue for processing items"""

    def __init__(self, processor: Optional[Callable[[T], Any]] = None) -> None:
        self.queue: List[T] = []
        self.processing = False
        self.processor = processor

    async def enqueue(self, item: T) -> None:
        """Enqueue an item"""
        self.queue.append(item)

        if self.processor and not self.processing:
            await self._process_queue()

    def dequeue(self) -> Optional[T]:
        """Dequeue an item"""
        if self.queue:
            return self.queue.pop(0)
        return None

    def size(self) -> int:
        """Get queue size"""
        return len(self.queue)

    def is_empty(self) -> bool:
        """Check if queue is empty"""
        return len(self.queue) == 0

    async def _process_queue(self) -> None:
        """Process all items in queue"""
        if not self.processor or self.processing:
            return

        self.processing = True

        while self.queue:
            item = self.queue.pop(0)
            if item is not None:
                try:
                    result = self.processor(item)
                    if asyncio.iscoroutine(result):
                        await result
                except Exception as error:
                    print(f"Error processing queue item: {error}")

        self.processing = False

    def clear(self) -> None:
        """Clear the queue"""
        self.queue = []


async def with_stream_timeout(
    stream: AsyncIterable[T], timeout_ms: int
) -> AsyncIterable[T]:
    """
    Create a timeout wrapper for a stream

    Args:
        stream: AsyncIterable to wrap
        timeout_ms: Timeout in milliseconds

    Yields:
        Items from the stream

    Raises:
        asyncio.TimeoutError: If stream exceeds timeout
    """
    try:
        async for chunk in stream:
            yield chunk
    except asyncio.TimeoutError:
        raise asyncio.TimeoutError(f"Stream timeout after {timeout_ms}ms")


async def _consume_to_list(stream: AsyncIterable[T]) -> AsyncIterable[T]:
    """Helper to consume stream and yield items"""
    async for item in stream:
        yield item


async def with_max_length(
    stream: AsyncIterable[str], max_length: int
) -> AsyncIterable[str]:
    """
    Create a length-limited stream

    Args:
        stream: AsyncIterable to limit
        max_length: Maximum total length

    Yields:
        Chunks from stream until max length reached

    Raises:
        Exception: If stream exceeds max length
    """
    total_length = 0

    async for chunk in stream:
        total_length += len(chunk)

        if total_length > max_length:
            raise Exception(f"Stream exceeded max length of {max_length}")

        yield chunk


async def buffer_stream(
    stream: AsyncIterable[str], buffer_size: int
) -> AsyncIterable[List[str]]:
    """
    Buffer stream chunks for batch processing

    Args:
        stream: AsyncIterable to buffer
        buffer_size: Number of chunks to buffer

    Yields:
        Lists of buffered chunks
    """
    buffer: List[str] = []

    async for chunk in stream:
        buffer.append(chunk)

        if len(buffer) >= buffer_size:
            yield list(buffer)
            buffer = []

    # Emit remaining buffer
    if buffer:
        yield list(buffer)

