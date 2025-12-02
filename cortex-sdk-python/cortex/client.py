"""
Cortex SDK - Main Client

Main entry point for the Cortex SDK providing access to all memory operations.
"""

import asyncio
from typing import Any, Optional

from convex import ConvexClient

from ._convex_async import AsyncConvexClient
from .a2a import A2AAPI
from .agents import AgentsAPI
from .contexts import ContextsAPI
from .conversations import ConversationsAPI
from .facts import FactsAPI
from .governance import GovernanceAPI
from .immutable import ImmutableAPI
from .memory import MemoryAPI
from .memory_spaces import MemorySpacesAPI
from .mutable import MutableAPI
from .resilience import (
    ResilienceLayer,
    ResiliencePresets,
    ResilienceConfig,
    ResilienceMetrics,
)
from .types import CortexConfig
from .users import UsersAPI
from .vector import VectorAPI


class Cortex:
    """
    Cortex SDK - Main Entry Point

    Open-source SDK for AI agents with persistent memory built on Convex
    for reactive TypeScript/Python queries.

    Example:
        >>> config = CortexConfig(convex_url="https://your-deployment.convex.cloud")
        >>> cortex = Cortex(config)
        >>>
        >>> # Remember a conversation
        >>> result = await cortex.memory.remember(
        ...     RememberParams(
        ...         memory_space_id="agent-1",
        ...         conversation_id="conv-123",
        ...         user_message="I prefer dark mode",
        ...         agent_response="Got it!",
        ...         user_id="user-123",
        ...         user_name="Alex"
        ...     )
        ... )
        >>>
        >>> # Clean up when done
        >>> await cortex.close()
    """

    def __init__(self, config: CortexConfig) -> None:
        """
        Initialize Cortex SDK.

        Args:
            config: Cortex configuration including Convex URL and optional graph config

        """
        # Initialize Convex client (sync) and wrap for async API
        sync_client = ConvexClient(config.convex_url)
        self.client = AsyncConvexClient(sync_client)

        # Get graph adapter if configured
        self.graph_adapter = config.graph.adapter if config.graph else None

        # Initialize resilience layer (default: enabled with balanced settings)
        resilience_config = (
            config.resilience if config.resilience else ResiliencePresets.default()
        )
        self._resilience = ResilienceLayer(resilience_config)

        # Initialize API modules with graph adapter and resilience layer
        self.conversations = ConversationsAPI(
            self.client, self.graph_adapter, self._resilience
        )
        self.immutable = ImmutableAPI(
            self.client, self.graph_adapter, self._resilience
        )
        self.mutable = MutableAPI(self.client, self.graph_adapter, self._resilience)
        self.vector = VectorAPI(self.client, self.graph_adapter, self._resilience)
        self.facts = FactsAPI(self.client, self.graph_adapter, self._resilience)
        self.memory = MemoryAPI(self.client, self.graph_adapter, self._resilience)
        self.contexts = ContextsAPI(self.client, self.graph_adapter, self._resilience)
        self.users = UsersAPI(self.client, self.graph_adapter, self._resilience)
        self.agents = AgentsAPI(self.client, self.graph_adapter, self._resilience)
        self.memory_spaces = MemorySpacesAPI(
            self.client, self.graph_adapter, self._resilience
        )
        self.governance = GovernanceAPI(
            self.client, self.graph_adapter, self._resilience
        )
        self.a2a = A2AAPI(self.client, self.graph_adapter, self._resilience)

        # Start graph sync worker if enabled
        self.sync_worker = None
        if config.graph and config.graph.auto_sync and self.graph_adapter:
            from .graph.worker.sync_worker import GraphSyncWorker

            self.sync_worker = GraphSyncWorker(
                self.client,
                self.graph_adapter,
                config.graph.sync_worker_options,
            )

            # Start worker asynchronously (don't block constructor)
            asyncio.create_task(self._start_worker())

    async def _start_worker(self) -> None:
        """Start the graph sync worker (internal)."""
        if self.sync_worker:
            try:
                await self.sync_worker.start()
            except Exception as error:
                print(f"Failed to start graph sync worker: {error}")

    def get_graph_sync_worker(self) -> Any:
        """
        Get graph sync worker instance (if running).

        Returns:
            GraphSyncWorker instance or None if not running
        """
        return self.sync_worker

    def get_resilience(self) -> ResilienceLayer:
        """
        Get the resilience layer for monitoring and manual control.

        Example:
            >>> # Check system health
            >>> is_healthy = cortex.get_resilience().is_healthy()
            >>>
            >>> # Get current metrics
            >>> metrics = cortex.get_resilience().get_metrics()
            >>> print(f'Circuit state: {metrics.circuit_breaker.state}')
            >>> print(f'Queue size: {metrics.queue.total}')
            >>>
            >>> # Reset all resilience state (use with caution)
            >>> cortex.get_resilience().reset()

        Returns:
            ResilienceLayer instance
        """
        return self._resilience

    def get_resilience_metrics(self) -> ResilienceMetrics:
        """
        Get current resilience metrics.

        Convenience method equivalent to `get_resilience().get_metrics()`.

        Returns:
            Current resilience metrics
        """
        return self._resilience.get_metrics()

    def is_healthy(self) -> bool:
        """
        Check if the SDK is healthy and accepting requests.

        Returns:
            False if circuit breaker is open
        """
        return self._resilience.is_healthy()

    async def close(self) -> None:
        """
        Close the connection to Convex and stop all workers.

        Example:
            >>> cortex = Cortex(config)
            >>> # ... use cortex ...
            >>> await cortex.close()
        """
        # Stop graph sync worker
        if self.sync_worker:
            self.sync_worker.stop()

        # Stop resilience layer queue processor
        self._resilience.stop_queue_processor()

        await self.client.close()

    async def shutdown(self, timeout_s: float = 30.0) -> None:
        """
        Gracefully shutdown the SDK.

        Waits for pending operations to complete before closing.

        Args:
            timeout_s: Maximum time to wait (default: 30 seconds)

        Example:
            >>> cortex = Cortex(config)
            >>> # ... use cortex ...
            >>> await cortex.shutdown()
        """
        # Stop graph sync worker
        if self.sync_worker:
            self.sync_worker.stop()

        # Gracefully shutdown resilience layer
        await self._resilience.shutdown(timeout_s)

        # Close Convex client
        await self.client.close()

