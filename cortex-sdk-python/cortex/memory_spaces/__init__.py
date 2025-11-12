"""
Cortex SDK - Memory Spaces API

Memory space management for Hive and Collaboration modes
"""

from typing import Optional, List, Dict, Any, Literal

from ..types import (
    MemorySpace,
    RegisterMemorySpaceParams,
    MemorySpaceStats,
    MemorySpaceType,
    MemorySpaceStatus,
)
from ..errors import CortexError, ErrorCode
from .._utils import filter_none_values, convert_convex_response


class MemorySpacesAPI:
    """
    Memory Spaces API

    Manages memory space lifecycle, participants, and access control for both
    Hive Mode (shared spaces) and Collaboration Mode (separate spaces).
    """

    def __init__(self, client, graph_adapter=None):
        """
        Initialize Memory Spaces API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter
        """
        self.client = client
        self.graph_adapter = graph_adapter

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
        result = await self.client.mutation(
            "memorySpaces:register",
            filter_none_values({
                "memorySpaceId": params.memory_space_id,
                "name": params.name,
                "type": params.type,
                "participants": params.participants,
                "metadata": params.metadata or {},
            }),
        )

        # Sync to graph if requested
        if sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_memory_space_to_graph

                await sync_memory_space_to_graph(result, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync memory space to graph: {error}")

        return MemorySpace(**convert_convex_response(result))

    async def get(
        self, memory_space_id: str, include_stats: bool = False
    ) -> Optional[MemorySpace]:
        """
        Retrieve memory space details and metadata.

        Args:
            memory_space_id: Memory space ID
            include_stats: Include usage statistics

        Returns:
            Memory space if found, None otherwise

        Example:
            >>> space = await cortex.memory_spaces.get(
            ...     'user-123-personal',
            ...     include_stats=True
            ... )
        """
        result = await self.client.query(
            "memorySpaces:get",
            {"memorySpaceId": memory_space_id},
            # Note: includeStats not supported by backend yet
        )

        if not result:
            return None

        return MemorySpace(**convert_convex_response(result))

    async def list(
        self,
        type: Optional[MemorySpaceType] = None,
        status: Optional[MemorySpaceStatus] = None,
        participant: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        List memory spaces with filtering and pagination.

        Args:
            type: Filter by type
            status: Filter by status
            participant: Filter by participant
            limit: Maximum results
            offset: Number of results to skip

        Returns:
            List result with pagination info

        Example:
            >>> result = await cortex.memory_spaces.list(type='personal', status='active')
        """
        result = await self.client.query(
            "memorySpaces:list",
            filter_none_values({
                "type": type,
                "status": status,
                "participant": participant,
                "limit": limit,
                # Note: offset not supported by backend yet
            }),
        )

        # Handle list or dict response
        if isinstance(result, list):
            spaces = [MemorySpace(**convert_convex_response(s)) for s in result]
            return {"spaces": spaces}
        else:
            result["spaces"] = [MemorySpace(**convert_convex_response(s)) for s in result.get("spaces", [])]
            return result

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
        result = await self.client.query(
            "memorySpaces:search",
            filter_none_values({"query": query, "type": type, "status": status, "limit": limit}),
        )

        return [MemorySpace(**convert_convex_response(space)) for space in result]

    async def update(
        self, memory_space_id: str, updates: Dict[str, Any]
    ) -> MemorySpace:
        """
        Update memory space metadata.

        Args:
            memory_space_id: Memory space ID
            updates: Updates to apply

        Returns:
            Updated memory space

        Example:
            >>> await cortex.memory_spaces.update(
            ...     'user-123-personal',
            ...     {'name': "Alice's Updated Space"}
            ... )
        """
        # Flatten updates - backend expects direct fields, not an updates dict
        mutation_args = {"memorySpaceId": memory_space_id}
        mutation_args.update(updates)
        result = await self.client.mutation(
            "memorySpaces:update", filter_none_values(mutation_args)
        )

        return MemorySpace(**convert_convex_response(result))

    async def update_participants(
        self,
        memory_space_id: str,
        add: Optional[List[str]] = None,
        remove: Optional[List[str]] = None,
    ) -> MemorySpace:
        """
        Add or remove participants from a memory space (Hive Mode).

        Args:
            memory_space_id: Memory space ID
            add: Participants to add
            remove: Participants to remove

        Returns:
            Updated memory space

        Example:
            >>> await cortex.memory_spaces.update_participants(
            ...     'user-123-personal',
            ...     add=['github-copilot']
            ... )
        """
        result = await self.client.mutation(
            "memorySpaces:updateParticipants",
            filter_none_values({"memorySpaceId": memory_space_id, "add": add, "remove": remove}),
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
        result = await self.client.mutation(
            "memorySpaces:archive",
            filter_none_values({"memorySpaceId": memory_space_id, "reason": reason, "metadata": metadata}),
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
        result = await self.client.mutation(
            "memorySpaces:reactivate", {"memorySpaceId": memory_space_id}
        )

        return MemorySpace(**convert_convex_response(result))

    async def delete(
        self,
        memory_space_id: str,
        cascade: bool = True,
        reason: Optional[str] = None,
        confirm_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Delete memory space and ALL associated data.

        WARNING: This is DESTRUCTIVE!

        Args:
            memory_space_id: Memory space ID
            cascade: Must be True to proceed (safety check)
            reason: Reason for deletion (audit trail)
            confirm_id: Optional safety check (must match memory_space_id)

        Returns:
            Deletion result with details

        Example:
            >>> result = await cortex.memory_spaces.delete(
            ...     'user-123-personal',
            ...     cascade=True,
            ...     reason='GDPR deletion request',
            ...     confirm_id='user-123-personal'
            ... )
        """
        if not cascade:
            raise CortexError(
                ErrorCode.INVALID_INPUT, "Must set cascade=True to delete memory space"
            )

        if confirm_id and confirm_id != memory_space_id:
            raise CortexError(ErrorCode.INVALID_INPUT, "confirm_id must match memory_space_id")

        result = await self.client.mutation(
            "memorySpaces:deleteSpace",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "cascade": cascade,
                "reason": reason,
                "confirmId": confirm_id,
            }),
        )

        return result

    async def get_stats(
        self,
        memory_space_id: str,
        time_window: str = "all",
        include_participants: bool = False,
    ) -> MemorySpaceStats:
        """
        Get analytics and usage statistics for a memory space.

        Args:
            memory_space_id: Memory space ID
            time_window: Time window ('24h', '7d', '30d', '90d', 'all')
            include_participants: Include participant activity breakdown

        Returns:
            Memory space statistics

        Example:
            >>> stats = await cortex.memory_spaces.get_stats(
            ...     'user-123-personal',
            ...     time_window='7d',
            ...     include_participants=True
            ... )
        """
        result = await self.client.query(
            "memorySpaces:getStats",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                # Note: timeWindow and includeParticipants not supported by backend yet
            }),
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
        result = await self.client.query(
            "memorySpaces:count",
            filter_none_values({
                "type": type,
                "status": status,
            }),
        )
        
        return int(result)

