"""
Cortex SDK - Vector Memory API

Layer 2: Searchable memory with embeddings and versioning
"""

from typing import Any, Dict, List, Optional, cast

from .._domain_export import memory_export
from .._domain_paging import (
    DomainOperationPartialError,
    active,
    collect,
    definite_failure,
    loader,
    natural,
    partial,
    resolve_scope,
    same_selection,
    select,
    wait_operation,
)
from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..graph.erasure import (
    GraphCommittedPartial,
    graph_option,
    mutate_graph_selected,
    requested_graph,
    write_graph_mutation,
)
from ..types import (
    AuthContext,
    CountMemoriesFilter,
    DeleteMemoryOptions,
    DomainReadOptions,
    ListMemoriesFilter,
    MemoryEntry,
    SearchOptions,
    SourceType,
    StoreMemoryInput,
    StoreMemoryOptions,
)
from .validators import (
    VectorValidationError,
    resolve_domain_scope,
    validate_content,
    validate_count_filter,
    validate_delete_many_filter,
    validate_export_format,
    validate_export_options,
    validate_limit,
    validate_list_filter,
    validate_memory_id,
    validate_memory_space_id,
    validate_search_options,
    validate_source_type,
    validate_store_memory_input,
    validate_timestamp,
    validate_update_many_inputs,
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
        auth_context: Optional[AuthContext] = None,
        graph_sync_policy: Optional[Any] = None,
    ) -> None:
        """
        Initialize Vector API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
            resilience: Optional resilience layer for overload protection
            auth_context: Optional auth context for multi-tenancy
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._graph_sync_policy = graph_sync_policy
        self._resilience = resilience
        self._auth_context = auth_context

    @property
    def _tenant_id(self) -> Optional[str]:
        """Get tenant_id from auth context (for multi-tenancy)."""
        return self._auth_context.tenant_id if self._auth_context else None

    async def _mutate_graph(self, reference: str, args: Dict[str, Any], explicit: Optional[bool] = None) -> Any:
        return await write_graph_mutation(self.client, self.graph_adapter, self._graph_sync_policy, reference, args, explicit)

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str, *, graph_write: Optional[bool] = False
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if requested_graph(self.graph_adapter, graph_write):
            return await operation()
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

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "memories:store",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "tenantId": resolve_scope(self._tenant_id, getattr(input, "tenant_id", None)),  # Exact constructor/input scope
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
            graph_option(options), ),
            "memories:store",
        graph_write=graph_option(options), )

        # Sync to graph if requested

        return MemoryEntry(**convert_convex_response(result))

    async def get(self, memory_space_id: str, memory_id: str, *, tenant_id: Optional[str] = None, read_options: Optional[DomainReadOptions] = None) -> Optional[MemoryEntry]:
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        tenant = resolve_scope(self._tenant_id, tenant_id)
        result = await wait_operation(self.client.query("memories:get", filter_none_values({"memorySpaceId": memory_space_id, "memoryId": memory_id, "tenantId": tenant})), read_options)
        return MemoryEntry(**convert_convex_response(result)) if result else None


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

        result = await self._execute_with_resilience(
            lambda: self.client.action(
                "memories:search",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "tenantId": resolve_scope(self._tenant_id, opts.tenant_id),
                    "participantId": opts.participant_id,
                    "query": query,
                    "embedding": opts.embedding,
                    "userId": opts.user_id,
                    "tags": opts.tags,
                    "tagMatch": opts.tag_match,
                    "importance": opts.importance,
                    "createdBefore": opts.created_before,
                    "createdAfter": opts.created_after,
                    "updatedBefore": opts.updated_before,
                    "updatedAfter": opts.updated_after,
                    "lastAccessedBefore": opts.last_accessed_before,
                    "lastAccessedAfter": opts.last_accessed_after,
                    "accessCount": opts.access_count,
                    "version": opts.version,
                    "contentType": opts.content_type,
                    "offset": opts.offset,
                    "sourceType": opts.source_type,
                    "minImportance": opts.min_importance,
                    "minScore": opts.min_score,
                    "queryCategory": opts.query_category,  # Category boost for bullet-proof retrieval
                    "limit": opts.limit,
                }),
            ),
            "memories:search",
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

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "memories:update",
                filter_none_values(params),
            graph_option(options), ),
            "memories:update",
        graph_write=graph_option(options), )

        # Sync to graph if requested

        return MemoryEntry(**convert_convex_response(result))

    async def delete(self, memory_space_id: str, memory_id: str, options: Optional[DeleteMemoryOptions] = None, *, tenant_id: Optional[str] = None, read_options: Optional[DomainReadOptions] = None) -> Dict[str, Any]:
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        tenant = resolve_scope(self._tenant_id, tenant_id)
        selected = [row for row in await select(loader(self.client, "memories", {"memorySpaceId": memory_space_id, "tenantId": tenant}), read_options) if row["document"]["memoryId"] == memory_id]
        if len(selected) > 1:
            raise ValueError("DOMAIN_SCOPE_AMBIGUOUS")
        if not selected:
            raise ValueError("MEMORY_NOT_FOUND")
        outcome = await mutate_graph_selected(self.client, "memories", selected, {"memorySpaceId": memory_space_id, "tenantId": tenant}, read_options, self.graph_adapter, self._graph_sync_policy, explicit=graph_option(options))
        return {"deleted": bool(outcome["confirmedCount"]), "memoryId": memory_id, "partial": outcome}


    async def update_many(
        self,
        memory_space_id: str,
        user_id: Optional[str] = None,
        source_type: Optional[SourceType] = None,
        importance: Optional[int] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Bulk update memories matching filters.

        Args:
            memory_space_id: Memory space ID
            user_id: Optional filter by user ID
            source_type: Optional filter by source type
            importance: New importance value to set
            tags: New tags to set

        Returns:
            Update result with updated count and memory IDs

        Example:
            >>> result = await cortex.vector.update_many(
            ...     'agent-1',
            ...     source_type='system',
            ...     importance=20
            ... )
        """
        # Client-side validation
        validate_memory_space_id(memory_space_id)

        if user_id is not None:
            validate_user_id(user_id)

        if source_type is not None:
            validate_source_type(source_type)

        # Validate updates if provided
        if importance is None and tags is None:
            raise VectorValidationError(
                "At least one update field must be provided (importance or tags)",
                "INVALID_FORMAT",
            )

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "memories:updateMany",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "userId": user_id,
                    "sourceType": source_type,
                    "importance": importance,
                    "tags": tags,
                }),
            None, ),
            "memories:updateMany",
        graph_write=None, )

        return cast(Dict[str, Any], result)

    async def delete_many(self, memory_space_id: str, user_id: Optional[str] = None, source_type: Optional[SourceType] = None, *, participant_id: Optional[str] = None, tenant_id: Optional[str] = None, read_options: Optional[DomainReadOptions] = None) -> Dict[str, Any]:
        validate_memory_space_id(memory_space_id)
        if user_id is not None:
            validate_user_id(user_id)
        if source_type is not None:
            validate_source_type(source_type)
        tenant = resolve_scope(self._tenant_id, tenant_id)
        load = loader(self.client, "memories", {"memorySpaceId": memory_space_id, "tenantId": tenant, "userId": user_id, "sourceType": source_type, "participantId": participant_id})
        selected = await select(load, read_options)
        if not same_selection(selected, await select(load, read_options)):
            raise ValueError("DOMAIN_SELECTION_CHANGED")
        outcome = await mutate_graph_selected(self.client, "memories", selected, {"memorySpaceId": memory_space_id, "tenantId": tenant}, read_options, self.graph_adapter, self._graph_sync_policy, explicit=graph_option(read_options))
        try:
            remaining = await select(load, read_options)
            if remaining:
                outcome["remainingPhysicalIds"] = [row["physicalId"] for row in remaining]
                raise ValueError("DOMAIN_SELECTION_CHANGED")
        except BaseException as cause:
            raise DomainOperationPartialError("vector:delete_many", outcome, cause) from cause
        return {"deleted": outcome["confirmedCount"], "memoryIds": [row["document"]["memoryId"] for row in selected if row["physicalId"] in outcome["confirmedPhysicalIds"]], "partial": outcome}


    async def count(
        self,
        memory_space_id: str,
        user_id: Optional[str] = None,
        participant_id: Optional[str] = None,
        source_type: Optional[SourceType] = None,
        *,
        tenant_id: Optional[str] = None,
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
        selected_tenant = resolve_domain_scope(self._tenant_id, tenant_id)
        if participant_id is not None and (not isinstance(participant_id, str) or not participant_id.strip()):
            raise VectorValidationError("Invalid participant_id", "INVALID_PARTICIPANT_ID", "participant_id")

        # Client-side validation
        validate_memory_space_id(memory_space_id)

        if user_id is not None:
            validate_user_id(user_id)

        if source_type is not None:
            validate_source_type(source_type)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "memories:count",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "tenantId": selected_tenant,
                    "userId": user_id,
                    "participantId": participant_id,
                    "sourceType": source_type,
                }),
            ),
            "memories:count",
        )

        return int(result)

    async def list(self, memory_space_id: str, user_id: Optional[str] = None, participant_id: Optional[str] = None, source_type: Optional[SourceType] = None, limit: Optional[int] = None, enrich_facts: bool = False, *, tenant_id: Optional[str] = None, read_options: Optional[DomainReadOptions] = None) -> List[MemoryEntry]:
        validate_memory_space_id(memory_space_id)
        if user_id is not None:
            validate_user_id(user_id)
        if source_type is not None:
            validate_source_type(source_type)
        if limit is not None and limit != 0:
            validate_limit(limit)
        tenant = resolve_scope(self._tenant_id, tenant_id)
        rows = await collect(loader(self.client, "memories", {"memorySpaceId": memory_space_id, "tenantId": tenant, "userId": user_id, "participantId": participant_id, "sourceType": source_type}), read_options, 100 if limit is None else natural(limit))
        return [MemoryEntry(**convert_convex_response(row)) for row in rows]


    async def export(self, memory_space_id: str, user_id: Optional[str] = None, format: str = "json", include_embeddings: bool = False, include_facts: bool = False, *, tenant_id: Optional[str] = None, read_options: Optional[DomainReadOptions] = None) -> Dict[str, Any]:
        validate_memory_space_id(memory_space_id)
        validate_export_format(format)
        if user_id is not None:
            validate_user_id(user_id)
        tenant = resolve_scope(self._tenant_id, tenant_id)
        rows = await collect(loader(self.client, "memories", {"memorySpaceId": memory_space_id, "tenantId": tenant, "userId": user_id}), read_options)
        facts = await collect(loader(self.client, "facts", {"memorySpaceId": memory_space_id, "tenantId": tenant, "includeSuperseded": False}), read_options) if include_facts else []
        return memory_export(rows, format, include_embeddings, include_facts, facts)


    async def archive(self, memory_space_id: str, memory_id: str, *, tenant_id: Optional[str] = None, read_options: Optional[DomainReadOptions] = None) -> Dict[str, Any]:
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        tenant = resolve_scope(self._tenant_id, tenant_id)
        selected = [row for row in await select(loader(self.client, "memories", {"memorySpaceId": memory_space_id, "tenantId": tenant}), read_options) if row["document"]["memoryId"] == memory_id]
        if len(selected) != 1:
            raise ValueError("DOMAIN_SCOPE_AMBIGUOUS" if selected else "MEMORY_NOT_FOUND")
        active(read_options)
        try:
            result: Dict[str, Any] = await wait_operation(self._mutate_graph("memories:archive", filter_none_values({"memorySpaceId": memory_space_id, "memoryId": memory_id, "tenantId": tenant, "expectedPhysicalId": selected[0]["physicalId"], "expectedFingerprint": selected[0]["fingerprint"]}), graph_option(read_options)), read_options)
            return result
        except BaseException as cause:
            outcome = {"physicalId": selected[0]["physicalId"], "disposition": "knownRolledBack" if definite_failure(cause) else "outcomeUnknown"}
            if isinstance(cause, GraphCommittedPartial):
                outcome["disposition"] = "knownCommitted" if cause.primary_result.get("archived") else "alreadyAbsent"
                outcome["graphJobs"] = cause.jobs
            raise DomainOperationPartialError("vector:archive", partial([outcome]), cause) from cause


    async def restore_from_archive(self, memory_space_id: str, memory_id: str, *, tenant_id: Optional[str] = None, read_options: Optional[DomainReadOptions] = None) -> Dict[str, Any]:
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        active(read_options)
        result: Dict[str, Any] = await wait_operation(self._mutate_graph("memories:restoreFromArchive", filter_none_values({"memorySpaceId": memory_space_id, "memoryId": memory_id, "tenantId": resolve_scope(self._tenant_id, tenant_id)}), graph_option(read_options)), read_options)
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
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        validate_version(version)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "memories:getVersion",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "memoryId": memory_id,
                    "version": version,
                }),
            ),
            "memories:getVersion",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "memories:getHistory",
                filter_none_values({"memorySpaceId": memory_space_id, "memoryId": memory_id}),
            ),
            "memories:getHistory",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "memories:getAtTimestamp",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "memoryId": memory_id,
                    "timestamp": timestamp,
                }),
            ),
            "memories:getAtTimestamp",
        )

        return cast(Optional[Dict[str, Any]], result)


__all__ = [
    "VectorAPI",
    "VectorValidationError",
    # Types for TypeScript-style API
    "CountMemoriesFilter",
    "ListMemoriesFilter",
    # Validators for custom usage
    "validate_count_filter",
    "validate_delete_many_filter",
    "validate_export_options",
    "validate_list_filter",
    "validate_update_many_inputs",
]

