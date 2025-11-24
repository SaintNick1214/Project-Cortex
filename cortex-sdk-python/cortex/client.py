"""
Cortex SDK - Main Client

Main entry point for the Cortex SDK providing access to all memory operations.
"""

import asyncio
from typing import Any

from convex import ConvexClient

from ._convex_async import AsyncConvexClient
from .agents import AgentsAPI
from .contexts import ContextsAPI
from .conversations import ConversationsAPI
from .facts import FactsAPI
from .governance import GovernanceAPI
from .immutable import ImmutableAPI
from .memory import MemoryAPI
from .memory_spaces import MemorySpacesAPI
from .mutable import MutableAPI
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

        # Initialize API modules with graph adapter
        self.conversations = ConversationsAPI(self.client, self.graph_adapter)
        self.immutable = ImmutableAPI(self.client, self.graph_adapter)
        self.mutable = MutableAPI(self.client, self.graph_adapter)
        self.vector = VectorAPI(self.client, self.graph_adapter)
        self.facts = FactsAPI(self.client, self.graph_adapter)
        self.memory = MemoryAPI(self.client, self.graph_adapter)
        self.contexts = ContextsAPI(self.client, self.graph_adapter)
        self.users = UsersAPI(self.client, self.graph_adapter)
        self.agents = AgentsAPI(self.client, self.graph_adapter)
        self.memory_spaces = MemorySpacesAPI(self.client, self.graph_adapter)
        self.governance = GovernanceAPI(self.client, self.graph_adapter)

        # Start graph sync worker if enabled
        self.sync_worker = None
        if config.graph and config.graph.auto_sync and graph_adapter:
            from .graph.worker.sync_worker import GraphSyncWorker

            self.sync_worker = GraphSyncWorker(
                self.client,
                graph_adapter,
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

    async def close(self) -> None:
        """
        Close the connection to Convex and stop graph sync worker.

        Example:
            >>> cortex = Cortex(config)
            >>> # ... use cortex ...
            >>> await cortex.close()
        """
        if self.sync_worker:
            self.sync_worker.stop()
        await self.client.close()

