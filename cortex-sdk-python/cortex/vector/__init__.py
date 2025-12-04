"""
Cortex SDK - Vector Memory API

Layer 2: Searchable memory with embeddings and versioning
"""

from typing import Any, Dict, List, Optional, cast

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import (
    DeleteMemoryOptions,
    MemoryEntry,
    SearchOptions,
    SourceType,
    StoreMemoryInput,
    StoreMemoryOptions,
)
from .validators import (
    VectorValidationError,
    validate_content,
    validate_export_format,
    validate_limit,
    validate_memory_id,
    validate_memory_space_id,
    validate_search_options,
    validate_source_type,
    validate_store_memory_input,
    validate_timestamp,
    validate_update_options,
    validate_user_id,
    validate_version,
)


class VectorAPI:
    """
    Vector Memory API - Layer 2

    Manages searchable memory entries with optional embeddings and versioning.
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
    ) -> None:
        """
        Initialize Vector API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
            resilience: Optional resilience layer for overload protection
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._resilience = resilience

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_store_memory_input(input)

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
                "agentId": getattr(input, "agent_id", None),  # Agent-owned memories support
                "messageRole": getattr(input, "message_role", None),  # For semantic search weighting
                # Enrichment fields (for bullet-proof retrieval)
                "enrichedContent": getattr(input, "enriched_content", None),  # Concatenated searchable content
                "factCategory": getattr(input, "fact_category", None),  # Category for filtering
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
                from ..graph import sync_memory_relationships, sync_memory_to_graph

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_content(query, "query")

        opts = options or SearchOptions()

        if options:
            validate_search_options(options)

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
                "minScore": opts.min_score,  # FIX: Forward min_score parameter
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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        validate_update_options(updates)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)

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

        return cast(Dict[str, bool], result)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_update_options(updates)

        if filters.get("user_id") is not None:
            validate_user_id(filters["user_id"])

        if filters.get("source_type") is not None:
            validate_source_type(filters["source_type"])

        result = await self.client.mutation(
            "memories:updateMany",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "filters": filters,
                "updates": updates,
            }),
        )

        return cast(Dict[str, Any], result)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)

        if filters.get("user_id") is not None:
            validate_user_id(filters["user_id"])

        if filters.get("source_type") is not None:
            validate_source_type(filters["source_type"])

        result = await self.client.mutation(
            "memories:deleteMany",
            filter_none_values({"memorySpaceId": memory_space_id, "filters": filters}),
        )

        return cast(Dict[str, Any], result)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)

        if user_id is not None:
            validate_user_id(user_id)

        if source_type is not None:
            validate_source_type(source_type)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)

        if user_id is not None:
            validate_user_id(user_id)

        if source_type is not None:
            validate_source_type(source_type)

        if limit is not None:
            validate_limit(limit)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_export_format(format)

        if user_id is not None:
            validate_user_id(user_id)

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

        return cast(Dict[str, Any], result)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)

        result = await self.client.mutation(
            "memories:archive",
            filter_none_values({"memorySpaceId": memory_space_id, "memoryId": memory_id}),
        )

        return cast(Dict[str, Any], result)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        validate_version(version)

        result = await self.client.query(
            "memories:getVersion",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "memoryId": memory_id,
                "version": version,
            }),
        )

        return cast(Optional[Dict[str, Any]], result)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)

        result = await self.client.query(
            "memories:getHistory",
            filter_none_values({"memorySpaceId": memory_space_id, "memoryId": memory_id}),
        )

        return cast(List[Dict[str, Any]], result)

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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        validate_timestamp(timestamp)

        result = await self.client.query(
            "memories:getAtTimestamp",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "memoryId": memory_id,
                "timestamp": timestamp,
            }),
        )

        return cast(Optional[Dict[str, Any]], result)


__all__ = ["VectorAPI", "VectorValidationError"]

