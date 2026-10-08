"""Graph events observe captured native partial jobs without raw graph CRUD."""

import time
from typing import Any, Dict, List, Optional, cast

from ...graph.errors import GraphDatabaseError
from ..streaming_types import GraphSyncEvent, StreamContext
from .progressive_storage_handler import ProgressiveStorageHandler


class ProgressiveGraphSync:
    def __init__(self, graph_adapter: Any, sync_interval: int = 5000,
                 storage: Optional[ProgressiveStorageHandler] = None) -> None:
        self.graph_adapter = graph_adapter
        self.sync_interval = sync_interval
        self.storage = storage
        self.sync_events: List[GraphSyncEvent] = []
        self.last_sync_time = 0
        self._revision = 0

    def _observe(self, event_type: Any) -> str:
        evidence = self.storage.get_partial_source_evidence() if self.storage else None
        if not evidence or not evidence.graph_jobs:
            raise GraphDatabaseError("Progressive graph sync requires scoped native partial storage and captured jobs.", "GRAPH_PARTIAL_STORAGE_REQUIRED")
        job = evidence.graph_jobs[-1]
        if evidence.source_revision > self._revision:
            queued = evidence.graph_disposition == "queued"
            self.sync_events.append(GraphSyncEvent(int(time.time() * 1000), "queued" if queued else event_type, job.identity.key,
                "Original native graph job queued; delivery is pending." if queued else "Original native partial graph job delivered."))
            self._revision = evidence.source_revision
            self.last_sync_time = int(time.time() * 1000)
        return cast(str, job.identity.key)

    async def initialize_partial_node(self, partial_memory: Dict[str, Any]) -> str:
        if not self.storage or partial_memory.get("memoryId") != self.storage.get_partial_memory_id():
            raise GraphDatabaseError("Partial graph identity is not the captured native source.", "GRAPH_PARTIAL_SELECTION_CHANGED")
        return self._observe("node-created")

    async def update_partial_node(self, content: str, context: StreamContext) -> None:
        self._observe("node-updated")

    async def finalize_node(self, complete_memory: Any) -> None:
        evidence = self.storage.get_partial_source_evidence() if self.storage else None
        physical_id = complete_memory.get("_id") if isinstance(complete_memory, dict) else getattr(complete_memory, "_id", None)
        if not evidence or physical_id != evidence.physical_source_id:
            raise GraphDatabaseError("Final primary memory cannot relabel the retained partial source.", "GRAPH_PARTIAL_SELECTION_CHANGED")
        self.record_finalized_partial()

    def record_finalized_partial(self) -> None:
        if not self.storage or not self.storage.is_complete():
            raise GraphDatabaseError("Partial finalization is not acknowledged.", "GRAPH_PARTIAL_OUTCOME_UNKNOWN")
        self._observe("finalized")

    async def rollback(self) -> None:
        if not self.storage:
            raise GraphDatabaseError("Captured native partial source is required.", "GRAPH_PARTIAL_STORAGE_REQUIRED")
        # The storage owner alone performs exact guarded deletion and delivery.

    def should_sync(self) -> bool:
        return bool(self.storage and self.storage.get_partial_source_evidence()) and int(time.time() * 1000) - self.last_sync_time >= self.sync_interval

    def get_sync_events(self) -> List[GraphSyncEvent]:
        return list(self.sync_events)

    def get_partial_node_id(self) -> Optional[str]:
        evidence = self.storage.get_partial_source_evidence() if self.storage else None
        return evidence.graph_jobs[-1].identity.key if evidence and evidence.graph_jobs else None

    def reset(self) -> None:
        self.sync_events = []
        self.last_sync_time = 0
        self._revision = 0


def create_progressive_graph_sync(graph_adapter: Any, sync_interval: Optional[int] = None,
                                  storage: Optional[ProgressiveStorageHandler] = None) -> ProgressiveGraphSync:
    return ProgressiveGraphSync(graph_adapter, sync_interval if sync_interval is not None else 5000, storage)
