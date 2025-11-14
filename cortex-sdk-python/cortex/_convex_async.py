"""
Async wrapper for synchronous Convex client.

The convex Python package is synchronous, but we want to provide
an async API to match the TypeScript SDK.
"""

import asyncio
from typing import Any, Dict
from functools import wraps


class AsyncConvexClient:
    """
    Async wrapper around the synchronous ConvexClient.
    
    Runs sync Convex operations in a thread pool to avoid blocking the event loop.
    """
    
    def __init__(self, sync_client):
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
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._sync_client.query(name, args)
        )
    
    async def mutation(self, name: str, args: Dict[str, Any]) -> Any:
        """
        Execute a mutation (async wrapper).
        
        Args:
            name: Mutation name (e.g., "conversations:create")
            args: Mutation arguments
            
        Returns:
            Mutation result
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._sync_client.mutation(name, args)
        )
    
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

