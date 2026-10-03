"""
Progressive Graph Synchronization

Syncs partial memories to graph database during streaming:
- Creates partial nodes on stream initialization
- Updates node properties as content grows
- Finalizes nodes and relationships on completion
- Handles failures gracefully

Python implementation matching TypeScript src/memory/streaming/ProgressiveGraphSync.ts
"""

from typing import Any, Dict, List, Optional

from ..streaming_types import GraphSyncEvent, StreamContext


class ProgressiveGraphSync:
    """Manages progressive graph synchronization during streaming"""

    def __init__(self, graph_adapter: Any, sync_interval: int = 5000) -> None:
        self.graph_adapter = graph_adapter
        self.sync_interval = sync_interval
        self.partial_node_id: Optional[str] = None
        self.sync_events: List[GraphSyncEvent] = []
        self.last_sync_time = 0

    async def initialize_partial_node(
        self, partial_memory: Dict[str, Any]
    ) -> str:
        """Initialize partial memory node in graph"""
        import time

        try:
            # Create node with streaming properties
            # Note: Using single label 'Memory' as multiple labels may not be supported
            node_id = await self.graph_adapter.create_node(
                {
                    "label": "Memory",
                    "properties": {
                        "memoryId": partial_memory["memoryId"],
                        "memorySpaceId": partial_memory.get("memorySpaceId"),
                        "userId": partial_memory.get("userId"),
                        "contentPreview": self._truncate_content(
                            partial_memory.get("content", ""), 100
                        ),
                        "isPartial": True,
                        "isStreaming": True,
                        "streamStartTime": int(time.time() * 1000),
                        "createdAt": int(time.time() * 1000),
                    },
                }
            )

            self.partial_node_id = str(node_id)
            self.last_sync_time = int(time.time() * 1000)

            self._record_sync_event(
                GraphSyncEvent(
                    timestamp=int(time.time() * 1000),
                    event_type="node-created",
                    node_id=str(node_id),
                    details="Created partial memory node",
                )
            )

            return str(node_id)

        except Exception as error:
            print(f"Warning: Failed to initialize partial graph node: {error}")
            raise

    async def update_partial_node(
        self, content: str, context: StreamContext
    ) -> None:
        """Update partial node with current content"""
        import time

        if not self.partial_node_id:
            return  # Not initialized

        # Check if enough time has passed since last sync
        now = int(time.time() * 1000)
        if now - self.last_sync_time < self.sync_interval:
            return  # Too soon to sync again

        try:
            await self.graph_adapter.update_node(
                self.partial_node_id,
                {
                    "contentPreview": self._truncate_content(content, 100),
                    "contentLength": len(content),
                    "chunkCount": context.chunk_count,
                    "estimatedTokens": context.estimated_tokens,
                    "lastUpdatedAt": now,
                },
            )

            self.last_sync_time = now

            self._record_sync_event(
                GraphSyncEvent(
                    timestamp=now,
                    event_type="node-updated",
                    node_id=self.partial_node_id,
                    details=f"Updated with {context.chunk_count} chunks, {len(content)} chars",
                )
            )

        except Exception as error:
            print(f"Warning: Failed to update partial graph node: {error}")
            # Don't throw - graph sync is non-critical

    async def finalize_node(self, complete_memory: Any) -> None:
        """Finalize node when stream completes"""
        import time

        if not self.partial_node_id:
            return  # Not initialized

        try:
            # Update node to mark as complete
            await self.graph_adapter.update_node(
                self.partial_node_id,
                {
                    "contentPreview": self._truncate_content(
                        complete_memory.content, 100
                    ),
                    "contentLength": len(complete_memory.content),
                    "isPartial": False,
                    "isStreaming": False,
                    "streamCompleteTime": int(time.time() * 1000),
                    "importance": complete_memory.importance,
                    "tags": complete_memory.tags,
                },
            )

            # Note: removeLabel and createRelationship methods not available in GraphAdapter
            # Full relationship creation should be handled by the standard graph sync flow

            self._record_sync_event(
                GraphSyncEvent(
                    timestamp=int(time.time() * 1000),
                    event_type="finalized",
                    node_id=self.partial_node_id,
                    details="Finalized memory node (relationships handled by standard sync)",
                )
            )

        except Exception as error:
            print(f"Warning: Failed to finalize graph node: {error}")
            # Don't throw - best effort

    async def rollback(self) -> None:
        """Rollback/cleanup on failure"""
        if not self.partial_node_id:
            return

        try:
            await self.graph_adapter.delete_node(self.partial_node_id)
            self.partial_node_id = None

        except Exception as error:
            print(f"Warning: Failed to rollback graph node: {error}")
            # Best effort cleanup

    def should_sync(self) -> bool:
        """Check if sync should happen based on interval"""
        import time

        if not self.partial_node_id:
            return False

        return int(time.time() * 1000) - self.last_sync_time >= self.sync_interval

    def get_sync_events(self) -> List[GraphSyncEvent]:
        """Get all sync events"""
        return list(self.sync_events)

    def get_partial_node_id(self) -> Optional[str]:
        """Get the partial node ID"""
        return self.partial_node_id

    def _record_sync_event(self, event: GraphSyncEvent) -> None:
        """Record a sync event"""
        self.sync_events.append(event)

    def _truncate_content(self, content: str, max_length: int) -> str:
        """Truncate content for preview"""
        if len(content) <= max_length:
            return content

        return content[:max_length] + "..."

    def reset(self) -> None:
        """Reset sync state"""
        self.partial_node_id = None
        self.sync_events = []
        self.last_sync_time = 0


def create_progressive_graph_sync(
    graph_adapter: Any, sync_interval: Optional[int] = None
) -> ProgressiveGraphSync:
    """Helper to create a progressive graph sync instance"""
    return ProgressiveGraphSync(
        graph_adapter, sync_interval if sync_interval is not None else 5000
    )
