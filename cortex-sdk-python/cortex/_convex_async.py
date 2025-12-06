"""
Async wrapper for synchronous Convex client.

The convex Python package is synchronous, but we want to provide
an async API to match the TypeScript SDK.
"""

import asyncio
import json
from typing import Any, Dict

from cortex.errors import CortexError, ErrorCode


def _extract_convex_error_data(error: Exception) -> str:
    """
    Extract error data from a ConvexError.

    In managed Convex deployments, ConvexError has a `data` property containing
    the actual error code/message, while the `message` is often sanitized to
    "Server Error" for security reasons.

    Args:
        error: The caught exception

    Returns:
        The error data as a string
    """
    # Check if this is a ConvexError with a data attribute
    if hasattr(error, "data") and error.data is not None:
        if isinstance(error.data, str):
            return error.data
        else:
            return json.dumps(error.data)
    # Fall back to the original error message
    return str(error)


class AsyncConvexClient:
    """
    Async wrapper around the synchronous ConvexClient.

    Runs sync Convex operations in a thread pool to avoid blocking the event loop.
    """

    def __init__(self, sync_client: Any) -> None:  # type: ignore
        """
        Initialize async wrapper.

        Args:
            sync_client: Synchronous ConvexClient instance
        """
        self._sync_client = sync_client

    async def query(self, name: str, args: Dict[str, Any]) -> Any:
        """
        Execute a query (async wrapper).

        Args:
            name: Query name (e.g., "conversations:list")
            args: Query arguments

        Returns:
            Query result

        Raises:
            CortexError: All Convex exceptions are wrapped as CortexError for consistent error handling
        """
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(
                None,
                lambda: self._sync_client.query(name, args)
            )
        except Exception as e:
            # Extract error data from ConvexError for enhanced message
            # ConvexError has a `data` field with the actual error code/message
            error_data = _extract_convex_error_data(e)
            # Always wrap as CortexError for consistent error handling
            # This ensures callers can rely on catching CortexError type
            raise CortexError(
                code=ErrorCode.CONVEX_ERROR,
                message=error_data,
                details={"original_exception": type(e).__name__, "query": name}
            ) from e

    async def mutation(self, name: str, args: Dict[str, Any]) -> Any:
        """
        Execute a mutation (async wrapper).

        Args:
            name: Mutation name (e.g., "conversations:create")
            args: Mutation arguments

        Returns:
            Mutation result

        Raises:
            CortexError: All Convex exceptions are wrapped as CortexError for consistent error handling
        """
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(
                None,
                lambda: self._sync_client.mutation(name, args)
            )
        except Exception as e:
            # Extract error data from ConvexError for enhanced message
            # ConvexError has a `data` field with the actual error code/message
            error_data = _extract_convex_error_data(e)
            # Always wrap as CortexError for consistent error handling
            # This ensures callers can rely on catching CortexError type
            raise CortexError(
                code=ErrorCode.CONVEX_ERROR,
                message=error_data,
                details={"original_exception": type(e).__name__, "mutation": name}
            ) from e

    async def close(self) -> None:
        """
        Close the Convex client connection.
        """
        # ConvexClient might not have a close method
        # If it does, it's likely synchronous
        if hasattr(self._sync_client, 'close') and callable(self._sync_client.close):
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._sync_client.close)
        # If no close method, nothing to do

    def set_auth(self, token: str) -> None:
        """
        Set authentication token.

        Args:
            token: Authentication token
        """
        if hasattr(self._sync_client, 'set_auth'):
            self._sync_client.set_auth(token)

    def set_debug(self, debug: bool) -> None:
        """
        Set debug mode.

        Args:
            debug: Enable debug logging
        """
        if hasattr(self._sync_client, 'set_debug'):
            self._sync_client.set_debug(debug)

