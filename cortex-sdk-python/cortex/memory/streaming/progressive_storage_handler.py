"""Progressive native storage retains one captured physical source and original jobs."""

import time
from dataclasses import replace
from typing import Any, List, Optional

from convex import ConvexError

from ...graph.erasure import graph_receipt_from_wire, write_graph_mutation
from ...graph.errors import (
    GraphCommittedPartial,
    GraphDatabaseError,
    GraphPrimaryOutcomeUnknown,
)
from ...graph.identity import safe_integer
from ..streaming_types import PartialSourceEvidence, PartialUpdate


class ProgressiveStorageHandler:
    """Owns exact guarded partial writes; never deletes a finalized or unknown source."""

    def __init__(self, client: Any, memory_space_id: str, conversation_id: str,
                 user_id: str, update_interval: int = 3000,
                 resilience: Optional[Any] = None, *, tenant_id: Optional[str] = None,
                 graph_adapter: Any = None, graph_sync_policy: Any = None,
                 sync_to_graph: Optional[bool] = None) -> None:
        self.client = client
        self.memory_space_id = memory_space_id
        self.conversation_id = conversation_id
        self.user_id = user_id
        self.update_interval = update_interval
        self._resilience = resilience
        self.tenant_id = tenant_id
        self.graph_adapter = graph_adapter
        self.graph_sync_policy = graph_sync_policy
        self.sync_to_graph = sync_to_graph
        self.partial_memory_id: Optional[str] = None
        self.last_update_time = 0
        self.update_history: List[PartialUpdate] = []
        self.is_initialized = False
        self.is_finalized = False
        self._source: Optional[PartialSourceEvidence] = None
        self._unknown = False
        self._deleted = False

    def _adopt(self, value: Any, jobs: Any = None) -> None:
        if not isinstance(value, dict) or not isinstance(value.get("_id"), str) or not isinstance(value.get("memoryId"), str) or not safe_integer(value.get("sourceRevision")) or not value.get("referenceGeneration") or not safe_integer(value.get("ownershipRevision")):
            raise GraphDatabaseError("Native partial storage did not return captured physical evidence.", "GRAPH_PARTIAL_SOURCE_UNRESOLVED")
        previous = self._source
        if previous and (previous.physical_source_id != value["_id"] or previous.memory_id != value["memoryId"] or previous.reference_generation != value["referenceGeneration"]):
            raise GraphDatabaseError("Native partial identity changed.", "GRAPH_PARTIAL_SELECTION_CHANGED")
        receipts = [graph_receipt_from_wire(item) for item in (jobs if jobs is not None else value.get("graphJobs", []))]
        for receipt in receipts:
            if receipt.identity.physical_source_id != value["_id"] or receipt.identity.tenant_id != self.tenant_id or receipt.identity.memory_space_id != self.memory_space_id:
                raise GraphDatabaseError("Foreign partial graph receipt.", "GRAPH_SCOPE_MISMATCH")
        prior = list(previous.graph_jobs) if previous else []
        self._source = PartialSourceEvidence(
            memory_id=value["memoryId"], physical_source_id=value["_id"], source_revision=value["sourceRevision"],
            reference_generation=value["referenceGeneration"], ownership_revision=value["ownershipRevision"],
            tenant_id=self.tenant_id, memory_space_id=self.memory_space_id,
            graph_jobs=prior + [item for item in receipts if not any(item.id == old.id and item.generation == old.generation for old in prior)],
            graph_disposition=value.get("graphDisposition"))
        self.partial_memory_id = value["memoryId"]
        self.is_initialized = True

    def _failed(self, error: BaseException, finalizing: bool = False) -> None:
        if isinstance(error, GraphCommittedPartial):
            self._adopt(error.primary_result, error.jobs)
            if finalizing:
                self.is_finalized = True
            if error.graph_outcome == "unknown":
                self._unknown = True
        elif isinstance(error, GraphPrimaryOutcomeUnknown) or not isinstance(error, (ConvexError, GraphDatabaseError)):
            self._unknown = True

    def _guards(self) -> dict[str, Any]:
        if not self._source or self._unknown or self._deleted:
            raise GraphDatabaseError("Partial response settlement is unresolved; do not retry or delete it.", "GRAPH_PARTIAL_OUTCOME_UNKNOWN")
        return {"memorySpaceId": self.memory_space_id, **({"tenantId": self.tenant_id} if self.tenant_id is not None else {}),
                "memoryId": self._source.memory_id, "expectedPhysicalId": self._source.physical_source_id,
                "expectedSourceRevision": self._source.source_revision, "expectedReferenceGeneration": self._source.reference_generation}

    async def _write(self, name: str, args: dict[str, Any]) -> Any:
        return await write_graph_mutation(self.client, self.graph_adapter, self.graph_sync_policy, name, args, self.sync_to_graph)

    async def initialize_partial_memory(self, participant_id: Optional[str] = None,
                                        user_message: str = "", importance: int = 50,
                                        tags: Optional[List[str]] = None) -> str:
        if self.is_initialized or self._unknown:
            raise RuntimeError("Partial memory already initialized or unresolved")
        try:
            result = await self._write("memories:storePartialMemory", {
                "memorySpaceId": self.memory_space_id, **({"tenantId": self.tenant_id} if self.tenant_id is not None else {}),
                "participantId": participant_id if participant_id is not None else "agent",
                "conversationId": self.conversation_id, "userId": self.user_id,
                "content": "[Streaming in progress...]", "isPartial": True,
                "metadata": {"userMessage": user_message, "streamStartTime": int(time.time() * 1000)},
                "importance": importance if importance is not None else 50, "tags": [*(tags or []), "streaming", "partial"]})
            self._adopt(result)
            self.last_update_time = int(time.time() * 1000)
            assert self.partial_memory_id is not None
            return self.partial_memory_id
        except Exception as error:
            self._failed(error)
            raise

    async def update_partial_content(self, content: str, chunk_number: int, force: bool = False) -> bool:
        if not self.is_initialized:
            raise RuntimeError("Partial memory not initialized")
        if self.is_finalized:
            return False
        now = int(time.time() * 1000)
        if not force and now - self.last_update_time < self.update_interval:
            return False
        try:
            result = await self._write("memories:updatePartialMemory", {**self._guards(), "content": content,
                "metadata": {"lastUpdateTime": now, "currentChunk": chunk_number, "contentLength": len(content)}})
            self._adopt(result)
            self.last_update_time = now
            self.update_history.append(PartialUpdate(now, self.partial_memory_id or "", len(content), chunk_number))
            return True
        except Exception as error:
            self._failed(error)
            if self.graph_adapter is not None and self.sync_to_graph is not False:
                raise
            print("Warning: Partial update failed; its physical settlement is retained.")
            return False

    async def finalize_memory(self, full_content: str, embedding: Optional[List[float]] = None) -> None:
        if not self.is_initialized:
            raise RuntimeError("Partial memory not initialized")
        if self.is_finalized:
            return
        try:
            result = await self._write("memories:finalizePartialMemory", {**self._guards(), "content": full_content,
                **({"embedding": embedding} if embedding is not None else {}),
                "metadata": {"streamCompleteTime": int(time.time() * 1000), "totalUpdates": len(self.update_history), "finalContentLength": len(full_content)}})
            self._adopt(result)
            self.is_finalized = True
        except Exception as error:
            self._failed(error, True)
            raise

    async def rollback(self) -> None:
        if not self._source or self.is_finalized or self._unknown or self._deleted:
            return
        try:
            await self._write("memories:deleteMemory", {**self._guards(), "expectedPartial": True})
            self._deleted = True
            self.partial_memory_id = None
            self.is_initialized = False
        except Exception as error:
            if isinstance(error, GraphCommittedPartial):
                self._deleted = True
                if error.graph_outcome == "unknown":
                    self._unknown = True
                self._source.graph_jobs.extend(error.jobs)
            else:
                self._failed(error)
            raise

    def should_update(self) -> bool:
        return self.is_ready() and int(time.time() * 1000) - self.last_update_time >= self.update_interval

    def get_partial_memory_id(self) -> Optional[str]:
        return self.partial_memory_id

    def get_partial_source_evidence(self) -> Optional[PartialSourceEvidence]:
        return replace(self._source, graph_jobs=list(self._source.graph_jobs)) if self._source else None

    def is_outcome_unknown(self) -> bool:
        return self._unknown

    def was_deleted(self) -> bool:
        return self._deleted

    def get_update_history(self) -> List[PartialUpdate]:
        return list(self.update_history)

    def is_ready(self) -> bool:
        return self.is_initialized and not self.is_finalized and not self._unknown and not self._deleted

    def is_complete(self) -> bool:
        return self.is_finalized


def calculate_optimal_update_interval(
    average_chunk_size: float, chunks_per_second: float
) -> int:
    """Helper to estimate optimal update interval based on stream characteristics"""
    # If stream is very fast, update less frequently to reduce load
    if chunks_per_second > 10:
        return 5000  # 5 seconds

    # If stream is slow, update more frequently for better progress tracking
    if chunks_per_second < 1:
        return 1000  # 1 second

    # Default: 3 seconds
    return 3000
