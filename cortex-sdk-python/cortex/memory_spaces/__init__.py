"""
Cortex SDK - Memory Spaces API

Memory space management for Hive and Collaboration modes
"""

from typing import Any, Dict, List, Optional

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..graph.erasure import (
    graph_option,
    requested_graph,
    write_graph_mutation,
)
from ..types import (
    AuthContext,
    DeleteMemorySpaceCascade,
    DeleteMemorySpaceOptions,
    DeleteMemorySpaceResult,
    GetMemorySpaceStatsOptions,
    ListMemorySpacesFilter,
    ListMemorySpacesResult,
    MemorySpace,
    MemorySpaceStats,
    MemorySpaceStatus,
    MemorySpaceType,
    ParticipantUpdates,
    RegisterMemorySpaceParams,
    UpdateMemorySpaceOptions,
)
from ..users.erasure import (
    ErasureTransport,
    create_erasure_transport,
    execute_erasure,
    prepare_erasure,
)
from .validators import (
    MemorySpaceValidationError,
    resolve_domain_scope,
    validate_delete_options,
    validate_limit,
    validate_memory_space_id,
    validate_memory_space_status,
    validate_memory_space_type,
    validate_name,
    validate_participant,
    validate_participant_ids,  # noqa: F401 - Re-exported for public API
    validate_participants,
    validate_search_query,
    validate_time_window,
    validate_update_params,
)


class MemorySpacesAPI:
    """
    Memory Spaces API

    Manages memory space lifecycle, participants, and access control for both
    Hive Mode (shared spaces) and Collaboration Mode (separate spaces).
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
        Initialize Memory Spaces API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter
            resilience: Optional resilience layer for overload protection
            auth_context: Optional auth context for multi-tenancy
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._graph_sync_policy = graph_sync_policy
        self._resilience = resilience
        self._auth_context = auth_context

    def create_erasure_transport(self, *, url: str, deployment_key: str,
                                 timeout: float = 30, socket_timeout: float = 5) -> ErasureTransport:
        """Construct the same fixed Task19 administrator transport used by users."""
        return create_erasure_transport(url=url, deployment_key=deployment_key,
                                        timeout=timeout, socket_timeout=socket_timeout)

    @property
    def _tenant_id(self) -> Optional[str]:
        """Get tenant_id from auth context (for multi-tenancy)."""
        return resolve_domain_scope(self._auth_context.tenant_id if self._auth_context else None)

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

    async def register(
        self, params: RegisterMemorySpaceParams, sync_to_graph: Optional[bool] = None
    ) -> MemorySpace:
        """
        Register a memory space with metadata and participant tracking.

        Args:
            params: Memory space registration parameters
            sync_to_graph: Sync to graph database

        Returns:
            Registered memory space

        Example:
            >>> space = await cortex.memory_spaces.register(
            ...     RegisterMemorySpaceParams(
            ...         memory_space_id='user-123-personal',
            ...         name="Alice's Personal AI Memory",
            ...         type='personal',
            ...         participants=[
            ...             {'id': 'cursor', 'type': 'tool'},
            ...             {'id': 'claude', 'type': 'tool'}
            ...         ]
            ...     )
            ... )
        """
        # Validate required fields
        validate_memory_space_id(params.memory_space_id)
        if not params.type:
            raise MemorySpaceValidationError("type is required", "MISSING_TYPE", "type")
        validate_memory_space_type(params.type)

        # Validate optional fields
        if params.name is not None:
            validate_name(params.name)
        if params.participants is not None:
            validate_participants(params.participants)

        # Determine tenant_id: explicit param > auth context
        tenant_id = resolve_domain_scope(self._tenant_id, params.tenant_id)

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "memorySpaces:register",
                filter_none_values({
                    "memorySpaceId": params.memory_space_id,
                    "name": params.name,
                    "type": params.type,
                    "tenantId": tenant_id,  # Multi-tenancy: associate space with tenant
                    "participants": params.participants,
                    "metadata": params.metadata or {},
                }),
            sync_to_graph, ),
            "memorySpaces:register",
        graph_write=sync_to_graph, )

        # Sync to graph if requested

        return MemorySpace(**convert_convex_response(result))

    async def get(self, memory_space_id: str) -> Optional[MemorySpace]:
        """
        Retrieve memory space details and metadata.

        Args:
            memory_space_id: Memory space ID

        Returns:
            Memory space if found, None otherwise

        Example:
            >>> space = await cortex.memory_spaces.get('user-123-personal')
        """
        validate_memory_space_id(memory_space_id)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "memorySpaces:get",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "tenantId": self._tenant_id,  # Multi-tenancy: find space within tenant
                }),
            ),
            "memorySpaces:get",
        )

        if not result:
            return None

        return MemorySpace(**convert_convex_response(result))

    async def list(
        self,
        filter: Optional[ListMemorySpacesFilter] = None,
        *,
        type: Optional[MemorySpaceType] = None,
        status: Optional[MemorySpaceStatus] = None,
        participant: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> ListMemorySpacesResult:
        """
        List memory spaces with filtering, pagination, and sorting.

        Args:
            filter: Optional filter object (preferred)
            type: Filter by type (backward compatible)
            status: Filter by status (backward compatible)
            participant: Filter by participant (backward compatible)
            limit: Maximum results (backward compatible)
            offset: Pagination offset (backward compatible)

        Returns:
            List result with pagination metadata

        Example:
            >>> # Using filter object (new API)
            >>> result = await cortex.memory_spaces.list(
            ...     ListMemorySpacesFilter(type='personal', status='active', limit=20)
            ... )
            >>>
            >>> # Using kwargs (backward compatible)
            >>> result = await cortex.memory_spaces.list(type='personal', status='active')
        """
        # Support both filter object and keyword arguments
        f_type = filter.type if filter else type
        f_status = filter.status if filter else status
        f_tenant_id = resolve_domain_scope(self._tenant_id, filter.tenant_id if filter else None)
        f_participant = filter.participant if filter else participant
        f_limit = filter.limit if filter else limit
        f_offset = filter.offset if filter else offset
        f_sort_by = filter.sort_by if filter else None
        f_sort_order = filter.sort_order if filter else None

        # Validate options
        if f_type is not None:
            validate_memory_space_type(f_type)
        if f_status is not None:
            validate_memory_space_status(f_status)
        if f_limit is not None:
            validate_limit(f_limit, 1000)
        if f_participant is not None and not f_participant.strip():
            raise MemorySpaceValidationError(
                "participant filter cannot be empty",
                "INVALID_PARTICIPANT",
                "participant",
            )

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "memorySpaces:list",
                filter_none_values({
                    "type": f_type,
                    "status": f_status,
                    "tenantId": f_tenant_id,  # Multi-tenancy: filter by tenant
                    "participant": f_participant,
                    "limit": f_limit,
                    "offset": f_offset,
                    "sortBy": f_sort_by,
                    "sortOrder": f_sort_order,
                }),
            ),
            "memorySpaces:list",
        )

        # Handle list or dict response from backend
        if isinstance(result, list):
            spaces = [MemorySpace(**convert_convex_response(s)) for s in result]
            return ListMemorySpacesResult(
                spaces=spaces,
                total=len(spaces),
                has_more=False,
                offset=f_offset if f_offset else 0,
            )
        else:
            spaces = [MemorySpace(**convert_convex_response(s)) for s in result.get("spaces", [])]
            return ListMemorySpacesResult(
                spaces=spaces,
                total=result.get("total", len(spaces)),
                has_more=result.get("hasMore", False),
                offset=result.get("offset", f_offset if f_offset else 0),
            )

    async def search(
        self,
        query: str,
        type: Optional[MemorySpaceType] = None,
        status: Optional[MemorySpaceStatus] = None,
        limit: int = 20,
    ) -> List[MemorySpace]:
        """
        Search memory spaces by name or metadata.

        Args:
            query: Search query string
            type: Filter by type
            status: Filter by status
            limit: Maximum results

        Returns:
            List of matching memory spaces

        Example:
            >>> results = await cortex.memory_spaces.search('engineering')
        """
        validate_search_query(query)

        if type is not None:
            validate_memory_space_type(type)
        if status is not None:
            validate_memory_space_status(status)
        if limit is not None:
            validate_limit(limit, 1000)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "memorySpaces:search",
                filter_none_values({"tenantId": self._tenant_id, "query": query, "type": type, "status": status, "limit": limit}),
            ),
            "memorySpaces:search",
        )

        return [MemorySpace(**convert_convex_response(space)) for space in result]

    async def update(
        self,
        memory_space_id: str,
        updates: Dict[str, Any],
        options: Optional[UpdateMemorySpaceOptions] = None,
    ) -> MemorySpace:
        """
        Update memory space metadata.

        Args:
            memory_space_id: Memory space ID
            updates: Updates to apply (name, metadata, status)
            options: Optional options for graph sync

        Returns:
            Updated memory space

        Example:
            >>> # Update name and status
            >>> await cortex.memory_spaces.update(
            ...     'team-alpha',
            ...     {'name': 'Updated Name', 'status': 'archived'}
            ... )
            >>>
            >>> # Update with graph sync
            >>> await cortex.memory_spaces.update(
            ...     'team-alpha',
            ...     {'metadata': {'lastReview': int(time.time() * 1000)}},
            ...     UpdateMemorySpaceOptions(sync_to_graph=True)
            ... )
        """
        validate_memory_space_id(memory_space_id)
        validate_update_params(updates)

        if "name" in updates and updates["name"] is not None:
            validate_name(updates["name"])
        if "status" in updates and updates["status"] is not None:
            validate_memory_space_status(updates["status"])

        # Flatten updates - backend expects direct fields, not an updates dict
        mutation_args: Dict[str, Any] = {"memorySpaceId": memory_space_id}
        mutation_args.update(updates)
        mutation_args["tenantId"] = self._tenant_id
        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "memorySpaces:update", filter_none_values(mutation_args)
            , graph_option(options)),
            "memorySpaces:update",
        graph_write=graph_option(options), )

        memory_space = MemorySpace(**convert_convex_response(result))

        # Sync to graph if requested

        return memory_space

    async def update_participants(
        self,
        memory_space_id: str,
        updates: Optional[ParticipantUpdates] = None,
        *,
        add: Optional[List[Dict[str, Any]]] = None,
        remove: Optional[List[str]] = None,
    ) -> MemorySpace:
        """
        Add or remove participants from a memory space (Hive Mode).

        Args:
            memory_space_id: Memory space ID
            updates: ParticipantUpdates object (preferred)
            add: Participants to add as list of {id, type, joinedAt} (backward compatible)
            remove: Participant IDs to remove (backward compatible)

        Returns:
            Updated memory space

        Example:
            >>> # Using ParticipantUpdates object (new API)
            >>> await cortex.memory_spaces.update_participants(
            ...     'team-alpha',
            ...     ParticipantUpdates(add=[{'id': 'new-tool', 'type': 'tool', 'joinedAt': now}])
            ... )
            >>>
            >>> # Using kwargs (backward compatible)
            >>> await cortex.memory_spaces.update_participants(
            ...     'team-alpha',
            ...     add=[{'id': 'new-tool', 'type': 'tool'}]
            ... )
        """
        validate_memory_space_id(memory_space_id)

        # Support both updates object and keyword arguments
        p_add = updates.add if updates else add
        p_remove = updates.remove if updates else remove

        # At least one operation required
        if p_add is None and p_remove is None:
            raise MemorySpaceValidationError(
                "At least one of 'add' or 'remove' must be provided", "EMPTY_UPDATES"
            )

        # Validate add participants (full objects with id, type, joinedAt)
        if p_add is not None and len(p_add) > 0:
            validate_participants(p_add)

        # Validate remove participant IDs
        if p_remove is not None and len(p_remove) > 0:
            for participant_id in p_remove:
                if not participant_id or not participant_id.strip():
                    raise MemorySpaceValidationError(
                        "Participant ID to remove cannot be empty", "MISSING_PARTICIPANT_ID"
                    )

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "memorySpaces:updateParticipants",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "tenantId": self._tenant_id,
                    "add": p_add,
                    "remove": p_remove,
                }),
            None, ),
            "memorySpaces:updateParticipants",
        graph_write=None, )

        return MemorySpace(**convert_convex_response(result))

    async def archive(
        self,
        memory_space_id: str,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MemorySpace:
        """
        Mark memory space as archived (inactive).

        Args:
            memory_space_id: Memory space ID
            reason: Why archived
            metadata: Archive metadata

        Returns:
            Archived memory space

        Example:
            >>> await cortex.memory_spaces.archive(
            ...     'project-apollo',
            ...     reason='Project completed successfully'
            ... )
        """
        validate_memory_space_id(memory_space_id)

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "memorySpaces:archive",
                filter_none_values({"memorySpaceId": memory_space_id,
                    "tenantId": self._tenant_id, "reason": reason, "metadata": metadata}),
            None, ),
            "memorySpaces:archive",
        graph_write=None, )

        return MemorySpace(**convert_convex_response(result))

    async def reactivate(self, memory_space_id: str) -> MemorySpace:
        """
        Reactivate an archived memory space.

        Args:
            memory_space_id: Memory space ID

        Returns:
            Reactivated memory space

        Example:
            >>> await cortex.memory_spaces.reactivate('user-123-personal')
        """
        validate_memory_space_id(memory_space_id)

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "memorySpaces:reactivate", filter_none_values({"memorySpaceId": memory_space_id, "tenantId": self._tenant_id})
            , None),
            "memorySpaces:reactivate",
        graph_write=None, )

        return MemorySpace(**convert_convex_response(result))

    async def add_participant(
        self,
        memory_space_id: str,
        participant: Dict[str, Any],
    ) -> MemorySpace:
        """
        Add a participant to a memory space.

        Args:
            memory_space_id: Memory space ID
            participant: Participant to add with id, type, and joinedAt

        Returns:
            Updated memory space

        Example:
            >>> await cortex.memory_spaces.add_participant(
            ...     'team-alpha',
            ...     {'id': 'tool-analyzer', 'type': 'tool', 'joinedAt': int(time.time() * 1000)}
            ... )
        """
        validate_memory_space_id(memory_space_id)
        validate_participant(participant)

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "memorySpaces:addParticipant",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "tenantId": self._tenant_id,
                    "participant": participant,
                }),
            None, ),
            "memorySpaces:addParticipant",
        graph_write=None, )

        return MemorySpace(**convert_convex_response(result))

    async def remove_participant(
        self,
        memory_space_id: str,
        participant_id: str,
    ) -> MemorySpace:
        """
        Remove a participant from a memory space.

        Args:
            memory_space_id: Memory space ID
            participant_id: ID of participant to remove

        Returns:
            Updated memory space

        Example:
            >>> await cortex.memory_spaces.remove_participant('team-alpha', 'tool-analyzer')
        """
        validate_memory_space_id(memory_space_id)
        if not participant_id or not participant_id.strip():
            raise MemorySpaceValidationError(
                "participantId is required and cannot be empty",
                "MISSING_PARTICIPANT_ID",
                "participantId",
            )

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "memorySpaces:removeParticipant",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "tenantId": self._tenant_id,
                    "participantId": participant_id,
                }),
            None, ),
            "memorySpaces:removeParticipant",
        graph_write=None, )

        return MemorySpace(**convert_convex_response(result))

    async def find_by_participant(self, participant_id: str) -> List[MemorySpace]:
        """
        Find memory spaces that include a specific participant.

        Args:
            participant_id: Participant ID to search for

        Returns:
            List of memory spaces containing the participant

        Example:
            >>> spaces = await cortex.memory_spaces.find_by_participant('user-123')
        """
        if not participant_id or not participant_id.strip():
            raise MemorySpaceValidationError(
                "participantId is required and cannot be empty",
                "MISSING_PARTICIPANT_ID",
                "participantId",
            )

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "memorySpaces:findByParticipant",
                filter_none_values({"participantId": participant_id, "tenantId": self._tenant_id}),
            ),
            "memorySpaces:findByParticipant",
        )

        return [MemorySpace(**convert_convex_response(space)) for space in result]

    async def delete(
        self,
        memory_space_id: str,
        options: Optional[DeleteMemorySpaceOptions] = None,
        *,
        cascade: bool = True,
        reason: Optional[str] = None,
        confirm_id: Optional[str] = None,
    ) -> DeleteMemorySpaceResult:
        """
        Delete a memory space and its supported exclusive primary data.

        Requires explicit administrator transport and exact tenant scope; the erasure
        receipt discloses residual/partial outcomes, not universal physical removal.

        WARNING: This is DESTRUCTIVE!

        Args:
            memory_space_id: Memory space ID
            options: Deletion options object (preferred)
            cascade: Must be True to proceed (backward compatible, default True)
            reason: Reason for deletion (backward compatible)
            confirm_id: Safety check - must match memory_space_id (backward compatible)

        Returns:
            Deletion result with cascade details

        Example:
            >>> import os
            >>> transport = cortex.memory_spaces.create_erasure_transport(
            ...     url=os.environ['CONVEX_URL'],
            ...     deployment_key=os.environ['CONVEX_DEPLOY_KEY'])
            >>> try:
            ...     result = await cortex.memory_spaces.delete('user-123-personal',
            ...         DeleteMemorySpaceOptions(cascade=True, reason='Reviewed retention',
            ...             confirm_id='user-123-personal', tenant_id='team-a',
            ...             erasure_transport=transport, dry_run=True))
            ...     print(result.erasure)  # Supported scope with explicit residuals.
            ... finally:
            ...     transport.close()
        """
        validate_memory_space_id(memory_space_id)

        opts = options or DeleteMemorySpaceOptions(cascade=cascade, reason=reason or "SDK deletion request", confirm_id=confirm_id)
        validate_delete_options(memory_space_id, opts.cascade, opts.reason, opts.confirm_id)
        for name in ("dry_run", "verify"):
            if type(getattr(opts, name)) is not bool:
                raise MemorySpaceValidationError(f"{name} must be boolean", "INVALID_OPTIONS", name)
        if opts.cancel_event is not None and not all(callable(getattr(opts.cancel_event, name, None)) for name in ("is_set", "wait")):
            raise MemorySpaceValidationError("Invalid cancellation event", "INVALID_OPTIONS", "cancel_event")
        if opts.graph_participant is not None and (getattr(opts.graph_participant, "adapter", None) is None or getattr(opts.graph_participant, "disposal_transport", None) is None):
            raise MemorySpaceValidationError("Invalid graph participant", "INVALID_OPTIONS", "graph_participant")
        tenant_id = resolve_domain_scope(self._tenant_id, opts.tenant_id)
        domain = {"kind": "space", "memorySpaceId": memory_space_id}
        if tenant_id is not None:
            domain["tenantId"] = tenant_id
        receipt = await execute_erasure(await prepare_erasure(domain, opts, self.graph_adapter), self.client)
        return DeleteMemorySpaceResult(
            memory_space_id=memory_space_id,
            deleted=receipt.per_table["memorySpaces"]["deleted"] > 0,
            cascade=DeleteMemorySpaceCascade(
                conversations_deleted=receipt.per_table["conversations"]["deleted"],
                memories_deleted=receipt.per_table["memories"]["deleted"],
                facts_deleted=receipt.per_table["facts"]["deleted"],
                total_bytes=sum(int(item.get("serializedBytes", 0)) for item in receipt.outcomes)),
            reason=opts.reason, deleted_at=receipt.ended_at,
            total_bytes_kind="serializedDocumentEstimate", erasure=receipt)

    async def get_stats(
        self,
        memory_space_id: str,
        options: Optional[GetMemorySpaceStatsOptions] = None,
    ) -> MemorySpaceStats:
        """
        Get analytics and usage statistics for a memory space.

        Args:
            memory_space_id: Memory space ID
            options: Optional options for time window and participant breakdown

        Returns:
            Memory space statistics

        Example:
            >>> # Basic stats
            >>> stats = await cortex.memory_spaces.get_stats('team-alpha')
            >>> print(f"{stats.total_conversations} conversations, {stats.total_memories} memories")
            >>>
            >>> # With time window and participant breakdown (Hive Mode)
            >>> stats = await cortex.memory_spaces.get_stats(
            ...     'team-engineering-workspace',
            ...     GetMemorySpaceStatsOptions(
            ...         time_window='7d',
            ...         include_participants=True
            ...     )
            ... )
            >>> print(f"Activity this week: {stats.memories_this_window} memories")
            >>> if stats.participants:
            ...     for p in stats.participants:
            ...         print(f"{p['participantId']}: {p['memoriesStored']} memories")
        """
        validate_memory_space_id(memory_space_id)

        # Validate time window if provided
        if options and options.time_window:
            validate_time_window(options.time_window)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "memorySpaces:getStats",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "tenantId": self._tenant_id,
                    "timeWindow": options.time_window if options else None,
                    "includeParticipants": options.include_participants if options else None,
                }),
            ),
            "memorySpaces:getStats",
        )

        return MemorySpaceStats(**convert_convex_response(result))

    async def count(
        self,
        type: Optional[MemorySpaceType] = None,
        status: Optional[MemorySpaceStatus] = None,
    ) -> int:
        """
        Count memory spaces matching filters.

        Args:
            type: Filter by type
            status: Filter by status

        Returns:
            Count of matching memory spaces

        Example:
            >>> total = await cortex.memory_spaces.count(type='personal')
        """
        if type is not None:
            validate_memory_space_type(type)
        if status is not None:
            validate_memory_space_status(status)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "memorySpaces:count",
                filter_none_values({
                    "tenantId": self._tenant_id,
                    "type": type,
                    "status": status,
                }),
            ),
            "memorySpaces:count",
        )

        return int(result)


# Export validation error for users who want to catch it specifically
__all__ = ["MemorySpacesAPI", "MemorySpaceValidationError"]
