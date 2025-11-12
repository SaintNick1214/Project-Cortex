"""
Cortex SDK - Vector Memory API

Layer 2: Searchable memory with embeddings and versioning
"""

from typing import Optional, List, Dict, Any

from ..types import (
    MemoryEntry,
    StoreMemoryInput,
    StoreMemoryOptions,
    DeleteMemoryOptions,
    SearchOptions,
    SourceType,
)
from ..errors import CortexError, ErrorCode
from .._utils import filter_none_values, convert_convex_response


class VectorAPI:
    """
    Vector Memory API - Layer 2

    Manages searchable memory entries with optional embeddings and versioning.
    """

    def __init__(self, client, graph_adapter=None):
        """
        Initialize Vector API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
        """
        self.client = client
        self.graph_adapter = graph_adapter

    async def store(
        self,
        memory_space_id: str,
        input: StoreMemoryInput,
        options: Optional[StoreMemoryOptions] = None,
    ) -> MemoryEntry:
        """
        Store a vector memory.

        Args:
            memory_space_id: Memory space ID
            input: Memory input data
            options: Optional store options (e.g., syncToGraph)

        Returns:
            Stored memory entry

        Example:
            >>> memory = await cortex.vector.store(
            ...     'agent-1',
            ...     StoreMemoryInput(
            ...         content='User prefers dark mode',
            ...         content_type='raw',
            ...         source=MemorySource(type='conversation', timestamp=now),
            ...         metadata=MemoryMetadata(importance=70, tags=['preferences'])
            ...     )
            ... )
        """
        result = await self.client.mutation(
            "memories:store",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "participantId": input.participant_id,
                "content": input.content,
                "contentType": input.content_type,
                "embedding": input.embedding,
            "sourceType": input.source.get("type") if isinstance(input.source, dict) else input.source.type,
            "sourceUserId": input.source.get("userId") if isinstance(input.source, dict) else getattr(input.source, "user_id", None),
            "sourceUserName": input.source.get("userName") if isinstance(input.source, dict) else getattr(input.source, "user_name", None),
                "userId": input.user_id,
                "conversationRef": (
                    {
                        "conversationId": input.conversation_ref.get("conversationId") if isinstance(input.conversation_ref, dict) else input.conversation_ref.conversation_id,
                        "messageIds": (input.conversation_ref.get("messageIds") if isinstance(input.conversation_ref, dict) else input.conversation_ref.message_ids) or [],
                    }
                    if input.conversation_ref
                    else None
                ),
                "immutableRef": (
                    {
                        "type": input.immutable_ref.get("type") if isinstance(input.immutable_ref, dict) else input.immutable_ref.type,
                        "id": input.immutable_ref.get("id") if isinstance(input.immutable_ref, dict) else input.immutable_ref.id,
                        "version": input.immutable_ref.get("version") if isinstance(input.immutable_ref, dict) else input.immutable_ref.version,
                    }
                    if input.immutable_ref
                    else None
                ),
                "mutableRef": (
                    {
                        "namespace": input.mutable_ref.get("namespace") if isinstance(input.mutable_ref, dict) else input.mutable_ref.namespace,
                        "key": input.mutable_ref.get("key") if isinstance(input.mutable_ref, dict) else input.mutable_ref.key,
                        "snapshotValue": input.mutable_ref.get("snapshotValue") if isinstance(input.mutable_ref, dict) else input.mutable_ref.snapshot_value,
                        "snapshotAt": input.mutable_ref.get("snapshotAt") if isinstance(input.mutable_ref, dict) else input.mutable_ref.snapshot_at,
                    }
                    if input.mutable_ref
                    else None
                ),
            "importance": input.metadata.get("importance") if isinstance(input.metadata, dict) else input.metadata.importance,
            "tags": input.metadata.get("tags") if isinstance(input.metadata, dict) else input.metadata.tags,
            }),
        )

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_memory_to_graph, sync_memory_relationships

                node_id = await sync_memory_to_graph(result, self.graph_adapter)
                await sync_memory_relationships(result, node_id, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync memory to graph: {error}")

        return MemoryEntry(**convert_convex_response(result))

    async def get(
        self, memory_space_id: str, memory_id: str
    ) -> Optional[MemoryEntry]:
        """
        Get memory by ID.

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID

        Returns:
            Memory entry if found, None otherwise

        Example:
            >>> memory = await cortex.vector.get('agent-1', 'mem-abc123')
        """
        result = await self.client.query(
            "memories:get", filter_none_values({"memorySpaceId": memory_space_id, "memoryId": memory_id})
        )

        if not result:
            return None

        return MemoryEntry(**convert_convex_response(result))

    async def search(
        self,
        memory_space_id: str,
        query: str,
        options: Optional[SearchOptions] = None,
    ) -> List[MemoryEntry]:
        """
        Search memories (semantic with embeddings or keyword without).

        Args:
            memory_space_id: Memory space ID
            query: Search query string
            options: Optional search options

        Returns:
            List of matching memories

        Example:
            >>> results = await cortex.vector.search(
            ...     'agent-1',
            ...     'user preferences',
            ...     SearchOptions(limit=10, min_importance=50)
            ... )
        """
        opts = options or SearchOptions()

        result = await self.client.query(
            "memories:search",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "query": query,
                "embedding": opts.embedding,
                "userId": opts.user_id,
                "tags": opts.tags,
                "sourceType": opts.source_type,
                "minImportance": opts.min_importance,
                "limit": opts.limit,
            }),
        )

        return [MemoryEntry(**convert_convex_response(mem)) for mem in result]

    async def update(
        self,
        memory_space_id: str,
        memory_id: str,
        updates: Dict[str, Any],
        options: Optional[Dict[str, Any]] = None,
    ) -> MemoryEntry:
        """
        Update a memory (creates new version).

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID
            updates: Fields to update
            options: Optional update options (e.g., syncToGraph)

        Returns:
            Updated memory entry

        Example:
            >>> updated = await cortex.vector.update(
            ...     'agent-1', 'mem-123',
            ...     {'content': 'Updated content', 'importance': 80}
            ... )
        """
        # Convex expects flat parameters, not an 'updates' object
        params = {
            "memorySpaceId": memory_space_id,
            "memoryId": memory_id,
        }
        # Add update fields directly (not nested in 'updates')
        if "content" in updates:
            params["content"] = updates["content"]
        if "embedding" in updates:
            params["embedding"] = updates["embedding"]
        if "importance" in updates:
            params["importance"] = updates["importance"]
        if "tags" in updates:
            params["tags"] = updates["tags"]
        
        result = await self.client.mutation(
            "memories:update",
            filter_none_values(params),
        )

        # Sync to graph if requested
        if options and options.get("sync_to_graph") and self.graph_adapter:
            try:
                from ..graph import sync_memory_to_graph

                await sync_memory_to_graph(result, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync memory update to graph: {error}")

        return MemoryEntry(**convert_convex_response(result))

    async def delete(
        self,
        memory_space_id: str,
        memory_id: str,
        options: Optional[DeleteMemoryOptions] = None,
    ) -> Dict[str, bool]:
        """
        Delete a memory.

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID
            options: Optional delete options (e.g., syncToGraph)

        Returns:
            Deletion result

        Example:
            >>> await cortex.vector.delete('agent-1', 'mem-abc123')
        """
        result = await self.client.mutation(
            "memories:deleteMemory",  # Correct function name
            filter_none_values({"memorySpaceId": memory_space_id, "memoryId": memory_id}),
        )

        # Delete from graph with orphan cleanup
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import delete_memory_from_graph

                await delete_memory_from_graph(
                    memory_id, memory_space_id, self.graph_adapter, True
                )
            except Exception as error:
                print(f"Warning: Failed to delete memory from graph: {error}")

        return result

    async def update_many(
        self,
        memory_space_id: str,
        filters: Dict[str, Any],
        updates: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Bulk update memories matching filters.

        Args:
            memory_space_id: Memory space ID
            filters: Filter criteria
            updates: Updates to apply

        Returns:
            Update result with counts

        Example:
            >>> result = await cortex.vector.update_many(
            ...     'agent-1',
            ...     {'user_id': 'user-123'},
            ...     {'importance': 75}
            ... )
        """
        result = await self.client.mutation(
            "memories:updateMany",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "filters": filters,
                "updates": updates,
            }),
        )

        return result

    async def delete_many(
        self, memory_space_id: str, filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Bulk delete memories matching filters.

        Args:
            memory_space_id: Memory space ID
            filters: Filter criteria

        Returns:
            Deletion result with counts

        Example:
            >>> result = await cortex.vector.delete_many(
            ...     'agent-1',
            ...     {'importance': {'$lte': 30}}
            ... )
        """
        result = await self.client.mutation(
            "memories:deleteMany",
            filter_none_values({"memorySpaceId": memory_space_id, "filters": filters}),
        )

        return result

    async def count(
        self,
        memory_space_id: str,
        user_id: Optional[str] = None,
        participant_id: Optional[str] = None,
        source_type: Optional[SourceType] = None,
    ) -> int:
        """
        Count memories.

        Args:
            memory_space_id: Memory space ID
            user_id: Filter by user ID
            participant_id: Filter by participant ID
            source_type: Filter by source type

        Returns:
            Count of matching memories

        Example:
            >>> total = await cortex.vector.count('agent-1')
        """
        result = await self.client.query(
            "memories:count",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "userId": user_id,
                "participantId": participant_id,
                "sourceType": source_type,
            }),
        )

        return int(result)

    async def list(
        self,
        memory_space_id: str,
        user_id: Optional[str] = None,
        participant_id: Optional[str] = None,
        source_type: Optional[SourceType] = None,
        limit: Optional[int] = None,
        enrich_facts: bool = False,
    ) -> List[MemoryEntry]:
        """
        List memories with filtering.

        Args:
            memory_space_id: Memory space ID
            user_id: Filter by user ID
            participant_id: Filter by participant ID
            source_type: Filter by source type
            limit: Maximum results
            enrich_facts: Include facts in results

        Returns:
            List of memory entries

        Example:
            >>> memories = await cortex.vector.list(
            ...     'agent-1',
            ...     user_id='user-123',
            ...     limit=50
            ... )
        """
        # Convex list doesn't support enrichFacts parameter
        result = await self.client.query(
            "memories:list",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "userId": user_id,
                "participantId": participant_id,
                "sourceType": source_type,
                "limit": limit,
                # enrichFacts not supported in Convex function
            }),
        )

        return [MemoryEntry(**convert_convex_response(mem)) for mem in result]

    async def export(
        self,
        memory_space_id: str,
        user_id: Optional[str] = None,
        format: str = "json",
        include_embeddings: bool = False,
        include_facts: bool = False,
    ) -> Dict[str, Any]:
        """
        Export memories to JSON or CSV.

        Args:
            memory_space_id: Memory space ID
            user_id: Filter by user ID
            format: Export format ('json' or 'csv')
            include_embeddings: Include embedding vectors
            include_facts: Include facts in export

        Returns:
            Export result

        Example:
            >>> exported = await cortex.vector.export(
            ...     'agent-1',
            ...     user_id='user-123',
            ...     format='json'
            ... )
        """
        result = await self.client.query(
            "memories:export",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "userId": user_id,
                "format": format,
                "includeEmbeddings": include_embeddings,
                "includeFacts": include_facts,
            }),
        )

        return result

    async def archive(
        self, memory_space_id: str, memory_id: str
    ) -> Dict[str, Any]:
        """
        Soft delete (move to archive).

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID

        Returns:
            Archive result

        Example:
            >>> result = await cortex.vector.archive('agent-1', 'mem-123')
        """
        result = await self.client.mutation(
            "memories:archive",
            filter_none_values({"memorySpaceId": memory_space_id, "memoryId": memory_id}),
        )

        return result

    async def get_version(
        self, memory_space_id: str, memory_id: str, version: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get specific version of a memory.

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID
            version: Version number

        Returns:
            Memory version if found, None otherwise

        Example:
            >>> v1 = await cortex.vector.get_version('agent-1', 'mem-123', 1)
        """
        result = await self.client.query(
            "memories:getVersion",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "memoryId": memory_id,
                "version": version,
            }),
        )

        return result

    async def get_history(
        self, memory_space_id: str, memory_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get all versions of a memory.

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID

        Returns:
            List of all versions

        Example:
            >>> history = await cortex.vector.get_history('agent-1', 'mem-123')
        """
        result = await self.client.query(
            "memories:getHistory",
            filter_none_values({"memorySpaceId": memory_space_id, "memoryId": memory_id}),
        )

        return result

    async def get_at_timestamp(
        self, memory_space_id: str, memory_id: str, timestamp: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get memory version at specific time.

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID
            timestamp: Point in time (Unix timestamp in ms)

        Returns:
            Memory version at that time if found, None otherwise

        Example:
            >>> historical = await cortex.vector.get_at_timestamp(
            ...     'agent-1', 'mem-123', 1609459200000
            ... )
        """
        result = await self.client.query(
            "memories:getAtTimestamp",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "memoryId": memory_id,
                "timestamp": timestamp,
            }),
        )

        return result

