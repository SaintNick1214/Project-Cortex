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
    ResilienceMetrics,
    ResiliencePresets,
)
from .types import CortexConfig, GraphConfig, GraphConnectionConfig, LLMConfig
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
    async def _auto_configure_graph() -> Optional[GraphConfig]:
        """
        Auto-configure graph database from environment variables.

        Uses a two-gate approach:
        - Gate 1: Connection credentials must be present (NEO4J_URI or MEMGRAPH_URI + auth)
        - Gate 2: CORTEX_GRAPH_SYNC must be explicitly set to 'true'

        This prevents accidental graph connections - users must explicitly opt-in.

        Returns:
            GraphConfig if both gates pass, None otherwise
        """
        graph_sync_enabled = os.environ.get("CORTEX_GRAPH_SYNC") == "true"

        if not graph_sync_enabled:
            return None

        # Check providers in priority order
        neo4j_uri = os.environ.get("NEO4J_URI")
        memgraph_uri = os.environ.get("MEMGRAPH_URI")

        if neo4j_uri and memgraph_uri:
            warnings.warn(
                "[Cortex] Both NEO4J_URI and MEMGRAPH_URI set. Using Neo4j.",
                UserWarning,
                stacklevel=2,
            )

        if neo4j_uri:
            try:
                from .graph.adapters import CypherGraphAdapter

                adapter = CypherGraphAdapter()
                await adapter.connect(GraphConnectionConfig(
                    uri=neo4j_uri,
                    username=os.environ.get("NEO4J_USERNAME", "neo4j"),
                    password=os.environ.get("NEO4J_PASSWORD", ""),
                ))
                return GraphConfig(adapter=adapter, auto_sync=True)
            except ImportError:
                warnings.warn(
                    "[Cortex] neo4j package not installed. "
                    "Run: pip install cortex-memory[graph]",
                    UserWarning,
                    stacklevel=2,
                )
                return None
            except Exception as e:
                print(f"[Cortex] Failed to connect to Neo4j: {e}")
                return None

        if memgraph_uri:
            try:
                from .graph.adapters import CypherGraphAdapter

                adapter = CypherGraphAdapter()
                await adapter.connect(GraphConnectionConfig(
                    uri=memgraph_uri,
                    username=os.environ.get("MEMGRAPH_USERNAME", "memgraph"),
                    password=os.environ.get("MEMGRAPH_PASSWORD", ""),
                ))
                return GraphConfig(adapter=adapter, auto_sync=True)
            except ImportError:
                warnings.warn(
                    "[Cortex] neo4j package not installed. "
                    "Run: pip install cortex-memory[graph]",
                    UserWarning,
                    stacklevel=2,
                )
                return None
            except Exception as e:
                print(f"[Cortex] Failed to connect to Memgraph: {e}")
                return None

        # CORTEX_GRAPH_SYNC=true but no URI found - warn user
        warnings.warn(
            "[Cortex] CORTEX_GRAPH_SYNC=true but no graph database URI found. "
            "Set NEO4J_URI or MEMGRAPH_URI to enable graph sync.",
            UserWarning,
            stacklevel=2,
        )

        return None

    @classmethod
    async def create(cls, config: CortexConfig) -> "Cortex":
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
        # Auto-configure graph if not explicitly provided
        graph_config = config.graph or await cls._auto_configure_graph()

        # Auto-configure LLM if not explicitly provided
        llm_config = config.llm or cls._auto_configure_llm()

        # Create a new config with the potentially auto-configured components
        updated_config = CortexConfig(
            convex_url=config.convex_url,
            graph=graph_config,
            resilience=config.resilience,
            llm=llm_config,
        )

        return cls(updated_config)

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

        # Store LLM config for fact extraction
        # Use explicit config if provided, otherwise auto-configure from environment
        self._llm_config: Optional[LLMConfig] = config.llm or Cortex._auto_configure_llm()

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
        self.memory = MemoryAPI(
            self.client, self.graph_adapter, self._resilience, self._llm_config
        )
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

