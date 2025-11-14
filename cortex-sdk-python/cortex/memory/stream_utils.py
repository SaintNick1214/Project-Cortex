"""
Stream Utility Helpers

Utilities for consuming and handling streaming responses in the Memory API.
Supports Python AsyncIterable protocol.
"""

from collections.abc import AsyncIterable
from typing import Any


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



