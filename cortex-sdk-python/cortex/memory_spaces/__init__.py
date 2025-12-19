"""
Cortex SDK - Memory Spaces API

Memory space management for Hive and Collaboration modes
"""

from typing import Any, Dict, List, Optional

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import (
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
from .validators import (
    MemorySpaceValidationError,
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
    ) -> None:
        """
        Initialize Memory Spaces API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter
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

    async def register(
        self, params: RegisterMemorySpaceParams, sync_to_graph: bool = False
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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "memorySpaces:register",
                filter_none_values({
                    "memorySpaceId": params.memory_space_id,
                    "name": params.name,
                    "type": params.type,
                    "participants": params.participants,
                    "metadata": params.metadata or {},
                }),
            ),
            "memorySpaces:register",
        )

        # Sync to graph if requested
        if sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_memory_space_to_graph

                await sync_memory_space_to_graph(result, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync memory space to graph: {error}")

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
                {"memorySpaceId": memory_space_id},
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
                filter_none_values({"query": query, "type": type, "status": status, "limit": limit}),
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
        mutation_args = {"memorySpaceId": memory_space_id}
        mutation_args.update(updates)
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "memorySpaces:update", filter_none_values(mutation_args)
            ),
            "memorySpaces:update",
        )

        memory_space = MemorySpace(**convert_convex_response(result))

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_memory_space_to_graph

                await sync_memory_space_to_graph(result, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync memory space update to graph: {error}")

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
            lambda: self.client.mutation(
                "memorySpaces:updateParticipants",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "add": p_add,
                    "remove": p_remove,
                }),
            ),
            "memorySpaces:updateParticipants",
        )

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
            lambda: self.client.mutation(
                "memorySpaces:archive",
                filter_none_values({"memorySpaceId": memory_space_id, "reason": reason, "metadata": metadata}),
            ),
            "memorySpaces:archive",
        )

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
            lambda: self.client.mutation(
                "memorySpaces:reactivate", {"memorySpaceId": memory_space_id}
            ),
            "memorySpaces:reactivate",
        )

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
            lambda: self.client.mutation(
                "memorySpaces:addParticipant",
                {
                    "memorySpaceId": memory_space_id,
                    "participant": participant,
                },
            ),
            "memorySpaces:addParticipant",
        )

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
            lambda: self.client.mutation(
                "memorySpaces:removeParticipant",
                {
                    "memorySpaceId": memory_space_id,
                    "participantId": participant_id,
                },
            ),
            "memorySpaces:removeParticipant",
        )

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
                {"participantId": participant_id},
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
        Delete memory space and ALL associated data.

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
            >>> # Using options object (new API)
            >>> result = await cortex.memory_spaces.delete(
            ...     'user-123-personal',
            ...     DeleteMemorySpaceOptions(cascade=True, reason='GDPR request')
            ... )
            >>>
            >>> # Using simple call (backward compatible)
            >>> await cortex.memory_spaces.delete('space-id')
        """
        validate_memory_space_id(memory_space_id)

        # Support both options object and keyword arguments
        d_cascade = options.cascade if options else cascade
        d_reason = options.reason if options else reason
        d_confirm_id = options.confirm_id if options else confirm_id

        # Backend requires reason - provide default if not specified
        if d_reason is None:
            d_reason = "SDK deletion request"

        # Only validate delete options if explicitly provided and reason is set
        if options is not None and d_reason is not None:
            validate_delete_options(memory_space_id, d_cascade, d_reason, d_confirm_id)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "memorySpaces:deleteSpace",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "cascade": d_cascade,
                    "reason": d_reason,
                    "confirmId": d_confirm_id,
                }),
            ),
            "memorySpaces:deleteSpace",
        )

        # Convert response to typed result
        response = convert_convex_response(result)
        cascade_data = response.get("cascade", {})

        return DeleteMemorySpaceResult(
            memory_space_id=response.get("memory_space_id", memory_space_id),
            deleted=response.get("deleted", True),
            cascade=DeleteMemorySpaceCascade(
                conversations_deleted=cascade_data.get("conversations_deleted", 0),
                memories_deleted=cascade_data.get("memories_deleted", 0),
                facts_deleted=cascade_data.get("facts_deleted", 0),
                total_bytes=cascade_data.get("total_bytes", 0),
            ),
            reason=response.get("reason", d_reason or ""),
            deleted_at=response.get("deleted_at", 0),
        )

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
                    "type": type,
                    "status": status,
                }),
            ),
            "memorySpaces:count",
        )

        return int(result)


# Export validation error for users who want to catch it specifically
__all__ = ["MemorySpacesAPI", "MemorySpaceValidationError"]

