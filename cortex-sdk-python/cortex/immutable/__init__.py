"""
Cortex SDK - Immutable Store API

Layer 1b: Shared immutable data with automatic versioning
"""

from typing import Any, Dict, List, Optional, cast

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import ImmutableEntry, ImmutableRecord, ImmutableVersion
from .validators import (
    ImmutableValidationError,
    validate_id,
    validate_immutable_entry,
    validate_keep_latest,
    validate_limit,
    validate_purge_many_filter,
    validate_search_query,
    validate_timestamp,
    validate_type,
    validate_user_id,
    validate_version,
)


def _is_immutable_not_found_error(e: Exception) -> bool:
    """Check if an exception indicates an immutable entry was not found.

    This handles the Convex error format which includes the error code
    in the exception message. We check multiple patterns to be robust.

    Args:
        e: The exception to check

    Returns:
        True if this is a "not found" error that can be safely ignored
    """
    error_str = str(e)
    # Check for the specific error code pattern from Convex
    # Format: "Error: IMMUTABLE_ENTRY_NOT_FOUND" or within a longer message
    return (
        "IMMUTABLE_ENTRY_NOT_FOUND" in error_str
        or "immutable entry not found" in error_str.lower()
    )


class ImmutableAPI:
    """
    Immutable Store API - Layer 1b

    Provides TRULY SHARED immutable data storage across ALL memory spaces.
    Perfect for knowledge base articles, policies, and audit logs.
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
    ) -> None:
        """
        Initialize Immutable API.

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

    async def store(self, entry: ImmutableEntry) -> ImmutableRecord:
        """
        Store immutable data (creates v1 or increments version).

        Args:
            entry: Immutable entry to store

        Returns:
            Stored immutable record

        Example:
            >>> article = await cortex.immutable.store(
            ...     ImmutableEntry(
            ...         type='kb-article',
            ...         id='refund-guide',
            ...         data={'title': 'Refund Guide', 'content': '...'},
            ...         metadata={'importance': 85, 'tags': ['kb', 'refunds']}
            ...     )
            ... )
        """
        # CLIENT-SIDE VALIDATION
        validate_immutable_entry(entry)

        result = await self.client.mutation(
            "immutable:store",
            filter_none_values({
                "type": entry.type,
                "id": entry.id,
                "data": entry.data,
                "userId": entry.user_id,
                "metadata": entry.metadata,
            }),
        )

        return ImmutableRecord(**convert_convex_response(result))

    async def get(self, type: str, id: str) -> Optional[ImmutableRecord]:
        """
        Get current version of immutable data.

        Args:
            type: Entity type
            id: Logical ID

        Returns:
            Immutable record if found, None otherwise

        Example:
            >>> article = await cortex.immutable.get('kb-article', 'refund-policy')
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")

        result = await self.client.query("immutable:get", filter_none_values({"type": type, "id": id}))

        if not result:
            return None

        return ImmutableRecord(**convert_convex_response(result))

    async def get_version(
        self, type: str, id: str, version: int
    ) -> Optional[ImmutableVersion]:
        """
        Get specific version of immutable data.

        Args:
            type: Entity type
            id: Logical ID
            version: Version number

        Returns:
            Specific version if found, None otherwise

        Example:
            >>> v1 = await cortex.immutable.get_version('kb-article', 'guide-1', 1)
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")
        validate_version(version, "version")

        result = await self.client.query(
            "immutable:getVersion", filter_none_values({"type": type, "id": id, "version": version})
        )

        if not result:
            return None

        # Manually construct to handle field name differences
        return ImmutableVersion(
            version=result.get("version"),
            data=result.get("data"),
            timestamp=result.get("createdAt"),
            metadata=result.get("metadata"),
        )

    async def get_history(self, type: str, id: str) -> List[ImmutableVersion]:
        """
        Get all versions of immutable data.

        Args:
            type: Entity type
            id: Logical ID

        Returns:
            List of all versions (subject to retention)

        Example:
            >>> history = await cortex.immutable.get_history('policy', 'max-refund')
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")

        result = await self.client.query(
            "immutable:getHistory", filter_none_values({"type": type, "id": id})
        )

        # Manually construct to handle field name differences
        return [
            ImmutableVersion(
                version=v.get("version"),
                data=v.get("data"),
                timestamp=v.get("createdAt"),
                metadata=v.get("metadata"),
            )
            for v in result
        ]

    async def get_at_timestamp(
        self, type: str, id: str, timestamp: int
    ) -> Optional[ImmutableVersion]:
        """
        Get version that was current at specific time.

        Args:
            type: Entity type
            id: Logical ID
            timestamp: Point in time (Unix timestamp in ms)

        Returns:
            Version at that time if found, None otherwise

        Example:
            >>> policy = await cortex.immutable.get_at_timestamp(
            ...     'policy', 'max-refund', 1609459200000
            ... )
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")
        validate_timestamp(timestamp, "timestamp")

        result = await self.client.query(
            "immutable:getAtTimestamp",
            filter_none_values({"type": type, "id": id, "timestamp": timestamp}),
        )

        if not result:
            return None

        return ImmutableVersion(**convert_convex_response(result))

    async def list(
        self,
        type: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[ImmutableRecord]:
        """
        List immutable records with filtering.

        Args:
            type: Filter by type
            user_id: Filter by user ID
            limit: Maximum results

        Returns:
            List of immutable records

        Example:
            >>> articles = await cortex.immutable.list(type='kb-article', limit=50)
        """
        # CLIENT-SIDE VALIDATION
        if type is not None:
            validate_type(type, "type")
        if user_id is not None:
            validate_user_id(user_id, "user_id")
        if limit is not None:
            validate_limit(limit, "limit")

        result = await self.client.query(
            "immutable:list", filter_none_values({"type": type, "userId": user_id, "limit": limit})
        )

        return [ImmutableRecord(**convert_convex_response(record)) for record in result]

    async def search(
        self,
        query: str,
        type: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search immutable data by content.

        Args:
            query: Search query string
            type: Filter by type
            user_id: Filter by user ID
            limit: Maximum results

        Returns:
            List of search results with scores

        Example:
            >>> results = await cortex.immutable.search(
            ...     'refund process',
            ...     type='kb-article'
            ... )
        """
        # CLIENT-SIDE VALIDATION
        validate_search_query(query, "query")
        if type is not None:
            validate_type(type, "type")
        if user_id is not None:
            validate_user_id(user_id, "user_id")
        if limit is not None:
            validate_limit(limit, "limit")

        result = await self.client.query(
            "immutable:search",
            filter_none_values({"query": query, "type": type, "userId": user_id, "limit": limit}),
        )

        return cast(List[Dict[str, Any]], result)

    async def count(
        self, type: Optional[str] = None, user_id: Optional[str] = None
    ) -> int:
        """
        Count immutable records.

        Args:
            type: Filter by type
            user_id: Filter by user ID

        Returns:
            Count of matching records

        Example:
            >>> total = await cortex.immutable.count(type='kb-article')
        """
        # CLIENT-SIDE VALIDATION
        if type is not None:
            validate_type(type, "type")
        if user_id is not None:
            validate_user_id(user_id, "user_id")

        result = await self.client.query(
            "immutable:count", filter_none_values({"type": type, "userId": user_id})
        )

        return int(result)

    async def purge(self, type: str, id: str) -> Dict[str, Any]:
        """
        Delete all versions of an immutable record.

        Args:
            type: Entity type
            id: Logical ID

        Returns:
            Purge result

        Warning:
            This deletes ALL versions permanently.

        Example:
            >>> result = await cortex.immutable.purge('kb-article', 'old-article')
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")

        try:
            result = await self.client.mutation(
                "immutable:purge", filter_none_values({"type": type, "id": id})
            )
            return cast(Dict[str, Any], result)
        except Exception as e:
            # Entry may not exist (already deleted by parallel run or global purge)
            # Check for IMMUTABLE_ENTRY_NOT_FOUND error code in the exception
            if _is_immutable_not_found_error(e):
                return {"deleted": 0}
            raise

    async def purge_many(
        self,
        type: Optional[str] = None,
        user_id: Optional[str] = None,
        created_before: Optional[int] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        Bulk delete immutable records.

        Args:
            type: Filter by type
            user_id: Filter by user ID
            created_before: Filter by creation date
            dry_run: Preview without deleting

        Returns:
            Purge result with counts

        Example:
            >>> result = await cortex.immutable.purge_many(
            ...     type='audit-log',
            ...     created_before=1609459200000,
            ...     dry_run=True
            ... )
        """
        # CLIENT-SIDE VALIDATION
        validate_purge_many_filter(type, user_id)
        if created_before is not None:
            validate_timestamp(created_before, "created_before")

        result = await self.client.mutation(
            "immutable:purgeMany",
            filter_none_values({
                "type": type,
                "userId": user_id,
                "createdBefore": created_before,
                "dryRun": dry_run,
            }),
        )

        return cast(Dict[str, Any], result)

    async def purge_versions(
        self,
        type: str,
        id: str,
        keep_latest: Optional[int] = None,
        older_than: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Delete old versions while keeping recent ones.

        Args:
            type: Entity type
            id: Logical ID
            keep_latest: Number of latest versions to keep
            older_than: Delete versions before this timestamp

        Returns:
            Purge result

        Example:
            >>> result = await cortex.immutable.purge_versions(
            ...     'kb-article', 'guide-123',
            ...     keep_latest=20
            ... )
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")

        # At least one parameter required
        if keep_latest is None and older_than is None:
            raise ImmutableValidationError(
                "purge_versions requires either keep_latest or older_than parameter",
                "INVALID_FILTER",
            )

        if keep_latest is not None:
            validate_keep_latest(keep_latest, "keep_latest")
        if older_than is not None:
            validate_timestamp(older_than, "older_than")

        result = await self.client.mutation(
            "immutable:purgeVersions",
            filter_none_values({"type": type, "id": id, "keepLatest": keep_latest, "olderThan": older_than}),
        )

        return cast(Dict[str, Any], result)


# Export validation error for specific error handling
__all__ = ["ImmutableAPI", "ImmutableValidationError"]

