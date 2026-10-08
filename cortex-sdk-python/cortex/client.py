"""
Cortex SDK - Main Client

Main entry point for the Cortex SDK providing access to all memory operations.
"""

import asyncio
import os
import warnings
from typing import Any, Optional

from convex import ConvexClient

from ._convex_async import AsyncConvexClient
from .a2a import A2AAPI
from .agents import AgentsAPI
from .artifacts import ArtifactsAPI
from .attachments import AttachmentsAPI
from .contexts import ContextsAPI
from .conversations import ConversationsAPI
from .facts import FactsAPI
from .governance import GovernanceAPI
from .graph.config import GraphConnectionOptions, resolve_graph_connection
from .immutable import ImmutableAPI
from .memory import MemoryAPI
from .memory_spaces import MemorySpacesAPI
from .mutable import MutableAPI
from .resilience import (
    ResilienceLayer,
    ResilienceMetrics,
    ResiliencePresets,
)
from .sessions import SessionsAPI
from .types import (
    AuthContext,
    CortexConfig,
    GraphConfig,
    GraphSyncPolicy,
    LLMConfig,
)
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

    @staticmethod
    def _auto_configure_llm() -> Optional[LLMConfig]:
        """
        Auto-configure LLM from environment variables.

        Uses a two-gate approach:
        - Gate 1: An API key must be present (OPENAI_API_KEY or ANTHROPIC_API_KEY)
        - Gate 2: CORTEX_FACT_EXTRACTION must be explicitly set to 'true'

        This prevents accidental API costs - users must explicitly opt-in.

        Returns:
            LLMConfig if both gates pass, None otherwise
        """
        fact_extraction_enabled = os.environ.get("CORTEX_FACT_EXTRACTION") == "true"

        if not fact_extraction_enabled:
            return None

        # Check providers in priority order
        openai_key = os.environ.get("OPENAI_API_KEY")
        if openai_key:
            return LLMConfig(provider="openai", api_key=openai_key)

        anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
        if anthropic_key:
            return LLMConfig(provider="anthropic", api_key=anthropic_key)

        # CORTEX_FACT_EXTRACTION=true but no API key found - warn user
        warnings.warn(
            "[Cortex] CORTEX_FACT_EXTRACTION=true but no API key found. "
            "Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable automatic fact extraction.",
            UserWarning,
            stacklevel=2,
        )

        return None

    @staticmethod
    async def _auto_configure_graph(
        enabled: Optional[bool] = None,
        connection: Optional[GraphConnectionOptions] = None,
    ) -> Optional[GraphConfig]:
        selected = resolve_graph_connection(enabled, connection)
        if selected is None:
            return None
        try:
            from .graph.adapters import CypherGraphAdapter
            adapter = CypherGraphAdapter()
        except ImportError:
            raise ImportError("Graph is enabled. Install cortex-memory[graph].") from None
        await adapter.connect(selected)
        return GraphConfig(adapter=adapter, auto_sync=True)

    @classmethod
    async def create(
        cls, config: CortexConfig, *, graph_enabled: Optional[bool] = None,
        graph_connection: Optional[GraphConnectionOptions] = None,
    ) -> "Cortex":
        """
        Create a Cortex instance with automatic configuration.

        This factory method enables async auto-configuration of:
        - Graph database (if CORTEX_GRAPH_SYNC=true and connection credentials set)
        - LLM for fact extraction (if CORTEX_FACT_EXTRACTION=true and API key set)

        Use this instead of `Cortex()` when you want environment-based auto-config.

        Example:
            >>> # With env vars: CORTEX_GRAPH_SYNC=true, NEO4J_URI=bolt://localhost:7687
            >>> cortex = await Cortex.create(CortexConfig(convex_url=os.getenv("CONVEX_URL")))
            >>> # Graph is automatically connected and sync worker started

        Args:
            config: Cortex configuration (explicit config takes priority over env vars)

        Returns:
            Fully configured Cortex instance
        """
        # Manual adapters retain caller ownership and take priority over env/off.
        graph_config = config.graph or await cls._auto_configure_graph(graph_enabled, graph_connection)
        owned_adapter = graph_config.adapter if graph_config and config.graph is None else None
        try:
            updated_config = CortexConfig(
                convex_url=config.convex_url, graph=graph_config,
                resilience=config.resilience, llm=config.llm or cls._auto_configure_llm(),
                auth=config.auth,
            )
            cortex = cls(updated_config)
            cortex._owned_graph_adapter = owned_adapter
            return cortex
        except BaseException:
            if owned_adapter is not None:
                try:
                    await owned_adapter.disconnect()
                except Exception:
                    pass  # Preserve construction error without credential diagnostics.
            raise

    def __init__(self, config: CortexConfig) -> None:
        """
        Initialize Cortex SDK.

        Args:
            config: Cortex configuration including Convex URL and optional graph config

        """
        self._owned_graph_adapter: Any = None
        self._cleanup_task: Optional[asyncio.Task[None]] = None
        self._worker_task: Optional[asyncio.Task[None]] = None
        # Initialize Convex client (sync) and wrap for async API
        sync_client = ConvexClient(config.convex_url)
        self.client = AsyncConvexClient(sync_client)

        # Get graph adapter if configured
        self.graph_adapter = config.graph.adapter if config.graph else None
        graph_policy = GraphSyncPolicy("background" if config.graph and config.graph.auto_sync else "inline")

        # Store auth context for auto-injection into all operations
        self._auth_context: Optional[AuthContext] = config.auth

        # Store LLM config for fact extraction
        # Use explicit config if provided, otherwise auto-configure from environment
        self._llm_config: Optional[LLMConfig] = config.llm or Cortex._auto_configure_llm()

        # Initialize resilience layer (default: enabled with balanced settings)
        resilience_config = (
            config.resilience if config.resilience else ResiliencePresets.default()
        )
        self._resilience = ResilienceLayer(resilience_config)

        # Initialize API modules with graph adapter, resilience layer, and auth context
        self.conversations = ConversationsAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context, graph_sync_policy=graph_policy
        )
        self.immutable = ImmutableAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context, graph_sync_policy=graph_policy
        )
        self.mutable = MutableAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context, graph_sync_policy=graph_policy
        )
        self.vector = VectorAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context, graph_sync_policy=graph_policy
        )
        self.facts = FactsAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context, graph_sync_policy=graph_policy
        )
        self.memory = MemoryAPI(
            self.client, self.graph_adapter, self._resilience, self._llm_config,
            self._auth_context, graph_sync_policy=graph_policy
        )
        self.contexts = ContextsAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context, graph_sync_policy=graph_policy
        )
        self.users = UsersAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context
        )
        self.agents = AgentsAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context
        )
        self.memory_spaces = MemorySpacesAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context, graph_sync_policy=graph_policy
        )
        self.governance = GovernanceAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context
        )
        self.a2a = A2AAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context
        )
        self.sessions = SessionsAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context
        )
        self.artifacts = ArtifactsAPI(
            self.client, self.graph_adapter, self._resilience, self._auth_context, graph_sync_policy=graph_policy
        )
        self.attachments = AttachmentsAPI(
            self.client, self._resilience, self._auth_context
        )

        # Start graph sync worker if enabled
        self.sync_worker = None
        if config.graph and config.graph.auto_sync and self.graph_adapter:
            from .graph.worker.sync_worker import GraphSyncWorker

            self.sync_worker = GraphSyncWorker(
                self.client,
                self.graph_adapter,
                config.graph.sync_worker_options,
                tenant_id=self._auth_context.tenant_id if self._auth_context else None,
            )

            # Start worker asynchronously (don't block constructor)
            self._worker_task = asyncio.create_task(self._start_worker())

    async def _start_worker(self) -> None:
        """Start the graph sync worker (internal)."""
        if self.sync_worker:
            try:
                await self.sync_worker.start()
            except Exception:
                print("[Cortex] Graph sync worker initialization failed.")

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

    async def _dispose(self, graceful: bool, timeout_s: float = 30.0) -> None:
        async def cleanup() -> None:
            failed = False
            try:
                if self._worker_task is not None:
                    await asyncio.gather(self._worker_task, return_exceptions=True)
                if self.sync_worker:
                    await self.sync_worker.stop()
            except Exception:
                failed = True
            try:
                if graceful:
                    await self._resilience.shutdown(timeout_s)
                else:
                    self._resilience.stop_queue_processor()
            except Exception:
                failed = True
            adapter = self._owned_graph_adapter
            self._owned_graph_adapter = None
            operations = [self.client.close()]
            if adapter is not None:
                operations.append(adapter.disconnect())
            results = await asyncio.gather(*operations, return_exceptions=True)
            if failed or any(isinstance(result, BaseException) for result in results):
                raise RuntimeError("Cortex resource cleanup failed.") from None

        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(cleanup())
            # Observe failure even when a waiter is cancelled; later disposal still
            # awaits this task and receives its credential-free failure.
            self._cleanup_task.add_done_callback(
                lambda task: task.exception() if not task.cancelled() else None
            )
        # One cancelled waiter must not cancel shared owned-resource disposal.
        await asyncio.shield(self._cleanup_task)

    async def close(self) -> None:
        """Await exactly-once owned cleanup; manual graph adapters remain caller-owned."""
        await self._dispose(False)

    async def shutdown(self, timeout_s: float = 30.0) -> None:
        """Drain pending work and await owned graph/Convex cleanup, idempotently."""
        await self._dispose(True, timeout_s)
