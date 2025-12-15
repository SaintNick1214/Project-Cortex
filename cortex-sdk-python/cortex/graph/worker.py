"""
Cortex SDK - Graph Sync Worker

Real-time reactive worker for syncing Cortex entities to graph database.
"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

from ..types import (
    GraphAdapter,
    GraphSyncWorkerOptions,
    SyncHealthMetrics,
)
from . import (
    sync_memory_space_to_graph,
    sync_context_to_graph,
    sync_context_relationships,
    sync_conversation_to_graph,
    sync_conversation_relationships,
    sync_memory_to_graph,
    sync_memory_relationships,
    sync_fact_to_graph,
    sync_fact_relationships,
    delete_memory_from_graph,
    delete_conversation_from_graph,
    delete_fact_from_graph,
    delete_context_from_graph,
    delete_memory_space_from_graph,
    sync_a2a_relationships,
)
from .errors import GraphSyncError

if TYPE_CHECKING:
    from ..client import Cortex


@dataclass
class SyncQueueItem:
    """Item in the sync queue."""
    id: str
    entity_type: str
    entity_id: str
    operation: str  # "create" | "update" | "delete"
    data: Optional[Dict[str, Any]] = None
    queued_at: int = 0
    retry_count: int = 0


class GraphSyncWorker:
    """
    Real-time graph sync worker.

    Subscribes to Convex sync queue and processes entities for graph sync.
    Handles failures with retry logic and provides health metrics.

    Example:
        >>> from cortex.graph.adapters import CypherGraphAdapter
        >>> from cortex.graph.worker import GraphSyncWorker
        >>> 
        >>> adapter = CypherGraphAdapter()
        >>> await adapter.connect(config)
        >>> 
        >>> worker = GraphSyncWorker(cortex, adapter)
        >>> await worker.start()
        >>> 
        >>> # Check health
        >>> metrics = worker.get_health()
        >>> print(f"Processed: {metrics.total_processed}, Queue: {metrics.queue_size}")
        >>> 
        >>> # Stop worker
        >>> await worker.stop()
    """

    def __init__(
        self,
        cortex: "Cortex",
        adapter: GraphAdapter,
        options: Optional[GraphSyncWorkerOptions] = None,
    ):
        """
        Initialize the sync worker.

        Args:
            cortex: Cortex client instance
            adapter: Graph database adapter
            options: Worker options
        """
        self._cortex = cortex
        self._adapter = adapter
        self._options = options or GraphSyncWorkerOptions()

        # State
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._queue: List[SyncQueueItem] = []

        # Metrics
        self._total_processed = 0
        self._success_count = 0
        self._failure_count = 0
        self._sync_times: List[float] = []
        self._last_sync_at: Optional[int] = None

        # Callbacks
        self._on_error: Optional[Callable[[str, Exception], None]] = None
        self._on_success: Optional[Callable[[str, str], None]] = None

    async def start(self) -> None:
        """
        Start the sync worker.

        Begins polling for sync queue items and processing them.
        """
        if self._running:
            print("GraphSyncWorker is already running")
            return

        print("🚀 Starting GraphSyncWorker...")
        self._running = True

        # Start the processing loop
        self._task = asyncio.create_task(self._processing_loop())

    async def stop(self) -> None:
        """
        Stop the sync worker.

        Waits for current processing to complete before stopping.
        """
        if not self._running:
            return

        print("⏹️  Stopping GraphSyncWorker...")
        self._running = False

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        print("✅ GraphSyncWorker stopped")

    def get_health(self) -> SyncHealthMetrics:
        """
        Get health metrics for the worker.

        Returns:
            Health metrics including processed counts and queue size
        """
        avg_sync_time = (
            sum(self._sync_times) / len(self._sync_times)
            if self._sync_times
            else 0.0
        )

        return SyncHealthMetrics(
            is_running=self._running,
            total_processed=self._total_processed,
            success_count=self._success_count,
            failure_count=self._failure_count,
            avg_sync_time_ms=avg_sync_time,
            queue_size=len(self._queue),
            last_sync_at=self._last_sync_at,
        )

    def on_error(self, callback: Callable[[str, Exception], None]) -> None:
        """
        Set error callback.

        Args:
            callback: Function called when sync fails (entity_id, error)
        """
        self._on_error = callback

    def on_success(self, callback: Callable[[str, str], None]) -> None:
        """
        Set success callback.

        Args:
            callback: Function called when sync succeeds (entity_type, entity_id)
        """
        self._on_success = callback

    # ============================================================================
    # Private Methods
    # ============================================================================

    async def _processing_loop(self) -> None:
        """Main processing loop - polls queue and processes items."""
        poll_interval = 1.0  # seconds
        batch_size = self._options.batch_size

        while self._running:
            try:
                # Fetch unsynced items from Convex
                items = await self._fetch_queue_items(batch_size)

                if items:
                    if self._options.verbose:
                        print(f"📦 Processing {len(items)} sync items...")

                    # Process items
                    for item in items:
                        await self._process_item(item)

                else:
                    # No items, wait before polling again
                    await asyncio.sleep(poll_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"❌ Error in processing loop: {e}")
                await asyncio.sleep(poll_interval)

    async def _fetch_queue_items(self, limit: int) -> List[SyncQueueItem]:
        """
        Fetch unsynced items from the Convex queue.

        Args:
            limit: Maximum number of items to fetch

        Returns:
            List of items to sync
        """
        try:
            # Query the Convex sync queue
            result = await self._cortex._client.query(
                "graphSync:getUnsyncedItems",
                {"limit": limit},
            )

            items = []
            for record in result or []:
                items.append(
                    SyncQueueItem(
                        id=record.get("_id"),
                        entity_type=record.get("entityType"),
                        entity_id=record.get("entityId"),
                        operation=record.get("operation", "create"),
                        data=record.get("data"),
                        queued_at=record.get("queuedAt", 0),
                        retry_count=record.get("retryCount", 0),
                    )
                )

            return items

        except Exception as e:
            if self._options.verbose:
                print(f"Failed to fetch queue items: {e}")
            return []

    async def _process_item(self, item: SyncQueueItem) -> None:
        """
        Process a single sync queue item.

        Args:
            item: Queue item to process
        """
        start_time = time.time()

        try:
            if item.operation == "delete":
                await self._handle_delete(item)
            else:
                await self._handle_sync(item)

            # Mark as synced in Convex
            await self._mark_synced(item.id)

            # Update metrics
            self._total_processed += 1
            self._success_count += 1
            self._last_sync_at = int(time.time() * 1000)
            self._sync_times.append((time.time() - start_time) * 1000)

            # Keep only last 100 sync times for average
            if len(self._sync_times) > 100:
                self._sync_times.pop(0)

            # Call success callback
            if self._on_success:
                self._on_success(item.entity_type, item.entity_id)

            if self._options.verbose:
                print(f"  ✓ Synced {item.entity_type} {item.entity_id}")

        except Exception as e:
            self._total_processed += 1
            self._failure_count += 1

            # Handle retry logic
            if item.retry_count < self._options.retry_attempts:
                await self._mark_failed(item.id, str(e))
                if self._options.verbose:
                    print(f"  ✗ Failed {item.entity_type} {item.entity_id}: {e} (will retry)")
            else:
                # Max retries exceeded - mark as permanently failed
                await self._mark_permanently_failed(item.id, str(e))
                if self._options.verbose:
                    print(f"  ✗ Permanently failed {item.entity_type} {item.entity_id}: {e}")

            # Call error callback
            if self._on_error:
                self._on_error(item.entity_id, e)

    async def _handle_sync(self, item: SyncQueueItem) -> None:
        """
        Handle sync (create/update) operation.

        Args:
            item: Queue item

        Raises:
            GraphSyncError: If sync fails
        """
        if not item.data:
            raise GraphSyncError(
                f"No data provided for sync",
                entity_type=item.entity_type,
                entity_id=item.entity_id,
            )

        entity_type = item.entity_type.lower()
        data = item.data

        if entity_type == "memoryspace":
            await sync_memory_space_to_graph(data, self._adapter)

        elif entity_type == "context":
            node_id = await sync_context_to_graph(data, self._adapter)
            await sync_context_relationships(data, node_id, self._adapter)

        elif entity_type == "conversation":
            node_id = await sync_conversation_to_graph(data, self._adapter)
            await sync_conversation_relationships(data, node_id, self._adapter)

        elif entity_type == "memory":
            node_id = await sync_memory_to_graph(data, self._adapter)
            await sync_memory_relationships(data, node_id, self._adapter)

            # Handle A2A relationships
            if data.get("sourceType") == "a2a":
                await sync_a2a_relationships(data, self._adapter)

        elif entity_type == "fact":
            node_id = await sync_fact_to_graph(data, self._adapter)
            await sync_fact_relationships(data, node_id, self._adapter)

        else:
            raise GraphSyncError(
                f"Unknown entity type: {item.entity_type}",
                entity_type=item.entity_type,
                entity_id=item.entity_id,
            )

    async def _handle_delete(self, item: SyncQueueItem) -> None:
        """
        Handle delete operation.

        Args:
            item: Queue item
        """
        entity_type = item.entity_type.lower()

        if entity_type == "memoryspace":
            await delete_memory_space_from_graph(item.entity_id, self._adapter)

        elif entity_type == "context":
            await delete_context_from_graph(item.entity_id, self._adapter)

        elif entity_type == "conversation":
            await delete_conversation_from_graph(item.entity_id, self._adapter)

        elif entity_type == "memory":
            await delete_memory_from_graph(item.entity_id, self._adapter)

        elif entity_type == "fact":
            await delete_fact_from_graph(item.entity_id, self._adapter)

        else:
            raise GraphSyncError(
                f"Unknown entity type for delete: {item.entity_type}",
                entity_type=item.entity_type,
                entity_id=item.entity_id,
            )

    async def _mark_synced(self, queue_id: str) -> None:
        """Mark item as successfully synced in Convex."""
        try:
            await self._cortex._client.mutation(
                "graphSync:markSynced",
                {"queueId": queue_id},
            )
        except Exception as e:
            if self._options.verbose:
                print(f"Failed to mark synced: {e}")

    async def _mark_failed(self, queue_id: str, error: str) -> None:
        """Mark item as failed (will retry) in Convex."""
        try:
            await self._cortex._client.mutation(
                "graphSync:markFailed",
                {"queueId": queue_id, "error": error},
            )
        except Exception as e:
            if self._options.verbose:
                print(f"Failed to mark failed: {e}")

    async def _mark_permanently_failed(self, queue_id: str, error: str) -> None:
        """Mark item as permanently failed in Convex."""
        try:
            await self._cortex._client.mutation(
                "graphSync:markPermanentlyFailed",
                {"queueId": queue_id, "error": error},
            )
        except Exception as e:
            if self._options.verbose:
                print(f"Failed to mark permanently failed: {e}")


__all__ = [
    "GraphSyncWorker",
    "SyncQueueItem",
]
