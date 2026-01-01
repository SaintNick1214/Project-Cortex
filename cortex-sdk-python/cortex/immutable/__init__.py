"""
Cortex SDK - Immutable Store API

Layer 1b: Shared immutable data with automatic versioning
"""

from datetime import datetime
from typing import Any, List, Optional, Union

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import (
    AuthContext,
    CountImmutableFilter,
    ImmutableEntry,
    ImmutableRecord,
    ImmutableSearchResult,
    ImmutableVersionExpanded,
    ListImmutableFilter,
    PurgeImmutableResult,
    PurgeManyFilter,
    PurgeManyImmutableResult,
    PurgeVersionsResult,
    SearchImmutableInput,
    StoreImmutableOptions,
)
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
        auth_context: Optional[AuthContext] = None,
    ) -> None:
        """
        Initialize Immutable API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
            resilience: Optional resilience layer for overload protection
            auth_context: Optional auth context for multi-tenancy
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._resilience = resilience
        self._auth_context = auth_context

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    @property
    def _tenant_id(self) -> Optional[str]:
        """Get tenant_id from auth context (for multi-tenancy)."""
        return self._auth_context.tenant_id if self._auth_context else None

    async def store(
        self,
        entry: ImmutableEntry,
        options: Optional[StoreImmutableOptions] = None,
    ) -> ImmutableRecord:
        """
        Store immutable data (creates v1 or increments version).

        Args:
            entry: Immutable entry to store
            options: Optional settings (e.g., sync_to_graph)

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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "immutable:store",
                filter_none_values({
                    "type": entry.type,
                    "id": entry.id,
                    "data": entry.data,
                    "userId": entry.user_id,
                    "metadata": entry.metadata,
                }),
            ),
            "immutable:store",
        )

        record = ImmutableRecord(**convert_convex_response(result))

        # Sync to graph if requested (facts are handled specially in FactsAPI)
        if options and options.sync_to_graph and self.graph_adapter and entry.type != "fact":
            try:
                await self.graph_adapter.create_node({
                    "label": "Immutable",
                    "properties": {
                        "immutableType": entry.type,
                        "immutableId": entry.id,
                        "_id": record._id,
                        "type": record.type,
                        "id": record.id,
                        "version": record.version,
                        "createdAt": record.created_at,
                        "updatedAt": record.updated_at,
                    },
                })
            except Exception as error:
                # Log but don't fail the operation
                import warnings
                warnings.warn(f"Failed to sync immutable to graph: {error}")

        return record

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

        result = await self._execute_with_resilience(
            lambda: self.client.query("immutable:get", filter_none_values({"type": type, "id": id})),
            "immutable:get",
        )

        if not result:
            return None

        return ImmutableRecord(**convert_convex_response(result))

    async def get_version(
        self, type: str, id: str, version: int
    ) -> Optional[ImmutableVersionExpanded]:
        """
        Get specific version of immutable data.

        Args:
            type: Entity type
            id: Logical ID
            version: Version number

        Returns:
            Expanded version with type/id info if found, None otherwise

        Example:
            >>> v1 = await cortex.immutable.get_version('kb-article', 'guide-1', 1)
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")
        validate_version(version, "version")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:getVersion", filter_none_values({"type": type, "id": id, "version": version})
            ),
            "immutable:getVersion",
        )

        if not result:
            return None

        # Return expanded version with full type/id info
        return ImmutableVersionExpanded(
            type=result.get("type"),
            id=result.get("id"),
            version=result.get("version"),
            data=result.get("data"),
            timestamp=result.get("timestamp", result.get("createdAt")),
            created_at=result.get("createdAt"),
            user_id=result.get("userId"),
            metadata=result.get("metadata"),
        )

    async def get_history(self, type: str, id: str) -> List[ImmutableVersionExpanded]:
        """
        Get all versions of immutable data.

        Args:
            type: Entity type
            id: Logical ID

        Returns:
            List of all expanded versions (subject to retention)

        Example:
            >>> history = await cortex.immutable.get_history('policy', 'max-refund')
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:getHistory", filter_none_values({"type": type, "id": id})
            ),
            "immutable:getHistory",
        )

        # Return expanded versions with full type/id info
        return [
            ImmutableVersionExpanded(
                type=v.get("type"),
                id=v.get("id"),
                version=v.get("version"),
                data=v.get("data"),
                timestamp=v.get("timestamp", v.get("createdAt")),
                created_at=v.get("createdAt"),
                user_id=v.get("userId"),
                metadata=v.get("metadata"),
            )
            for v in result
        ]

    async def get_at_timestamp(
        self, type: str, id: str, timestamp: Union[int, datetime]
    ) -> Optional[ImmutableVersionExpanded]:
        """
        Get version that was current at specific time.

        Args:
            type: Entity type
            id: Logical ID
            timestamp: Point in time (Unix timestamp in ms or datetime object)

        Returns:
            Expanded version at that time if found, None otherwise

        Example:
            >>> policy = await cortex.immutable.get_at_timestamp(
            ...     'policy', 'max-refund', 1609459200000
            ... )
            >>> # Or with datetime:
            >>> policy = await cortex.immutable.get_at_timestamp(
            ...     'policy', 'max-refund', datetime(2021, 1, 1)
            ... )
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")

        # Convert datetime to timestamp if needed
        ts: int
        if isinstance(timestamp, datetime):
            ts = int(timestamp.timestamp() * 1000)
        else:
            validate_timestamp(timestamp, "timestamp")
            ts = timestamp

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:getAtTimestamp",
                filter_none_values({"type": type, "id": id, "timestamp": ts}),
            ),
            "immutable:getAtTimestamp",
        )

        if not result:
            return None

        # Return expanded version with full type/id info
        return ImmutableVersionExpanded(
            type=result.get("type"),
            id=result.get("id"),
            version=result.get("version"),
            data=result.get("data"),
            timestamp=result.get("timestamp", result.get("createdAt")),
            created_at=result.get("createdAt"),
            user_id=result.get("userId"),
            metadata=result.get("metadata"),
        )

    async def list(
        self,
        filter: Optional[ListImmutableFilter] = None,
    ) -> List[ImmutableRecord]:
        """
        List immutable records with filtering.

        Args:
            filter: Optional filter with type, user_id, and limit

        Returns:
            List of immutable records

        Example:
            >>> articles = await cortex.immutable.list(
            ...     ListImmutableFilter(type='kb-article', limit=50)
            ... )
        """
        # Extract filter values
        type_val = filter.type if filter else None
        user_id = filter.user_id if filter else None
        limit = filter.limit if filter else None

        # CLIENT-SIDE VALIDATION
        if type_val is not None:
            validate_type(type_val, "type")
        if user_id is not None:
            validate_user_id(user_id, "user_id")
        if limit is not None:
            validate_limit(limit, "limit")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:list", filter_none_values({"type": type_val, "userId": user_id, "limit": limit})
            ),
            "immutable:list",
        )

        # Backend returns paginated result with entries array
        if isinstance(result, dict) and "entries" in result:
            entries = result["entries"]
        else:
            entries = result

        return [ImmutableRecord(**convert_convex_response(record)) for record in entries]

    async def search(
        self,
        input: SearchImmutableInput,
    ) -> List[ImmutableSearchResult]:
        """
        Search immutable data by content.

        Args:
            input: Search input with query and optional filters

        Returns:
            List of search results with scores and highlights

        Example:
            >>> results = await cortex.immutable.search(
            ...     SearchImmutableInput(query='refund process', type='kb-article')
            ... )
        """
        # CLIENT-SIDE VALIDATION
        validate_search_query(input.query, "query")
        if input.type is not None:
            validate_type(input.type, "type")
        if input.user_id is not None:
            validate_user_id(input.user_id, "user_id")
        if input.limit is not None:
            validate_limit(input.limit, "limit")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:search",
                filter_none_values({
                    "query": input.query,
                    "type": input.type,
                    "userId": input.user_id,
                    "limit": input.limit,
                }),
            ),
            "immutable:search",
        )

        # Convert results to ImmutableSearchResult
        search_results: List[ImmutableSearchResult] = []
        for item in result:
            entry_data = item.get("entry", {})
            search_results.append(
                ImmutableSearchResult(
                    entry=ImmutableRecord(**convert_convex_response(entry_data)),
                    score=item.get("score", 0.0),
                    highlights=item.get("highlights", []),
                )
            )
        return search_results

    async def count(
        self,
        filter: Optional[CountImmutableFilter] = None,
    ) -> int:
        """
        Count immutable records.

        Args:
            filter: Optional filter with type and user_id

        Returns:
            Count of matching records

        Example:
            >>> total = await cortex.immutable.count(
            ...     CountImmutableFilter(type='kb-article')
            ... )
        """
        # Extract filter values
        type_val = filter.type if filter else None
        user_id = filter.user_id if filter else None

        # CLIENT-SIDE VALIDATION
        if type_val is not None:
            validate_type(type_val, "type")
        if user_id is not None:
            validate_user_id(user_id, "user_id")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:count", filter_none_values({"type": type_val, "userId": user_id})
            ),
            "immutable:count",
        )

        return int(result)

    async def purge(self, type: str, id: str) -> PurgeImmutableResult:
        """
        Delete all versions of an immutable record.

        Args:
            type: Entity type
            id: Logical ID

        Returns:
            Purge result with deletion info

        Warning:
            This deletes ALL versions permanently.

        Example:
            >>> result = await cortex.immutable.purge('kb-article', 'old-article')
            >>> print(f"Deleted: {result.deleted}, Versions: {result.versions_deleted}")
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")

        try:
            result = await self._execute_with_resilience(
                lambda: self.client.mutation(
                    "immutable:purge", filter_none_values({"type": type, "id": id})
                ),
                "immutable:purge",
            )
            return PurgeImmutableResult(
                deleted=result.get("deleted", False),
                type=result.get("type", type),
                id=result.get("id", id),
                versions_deleted=result.get("versionsDeleted", 0),
            )
        except Exception as e:
            # Entry may not exist (already deleted by parallel run or global purge)
            # Check for IMMUTABLE_ENTRY_NOT_FOUND error code in the exception
            if _is_immutable_not_found_error(e):
                return PurgeImmutableResult(
                    deleted=False,
                    type=type,
                    id=id,
                    versions_deleted=0,
                )
            raise

    async def purge_many(
        self,
        filter: PurgeManyFilter,
    ) -> PurgeManyImmutableResult:
        """
        Bulk delete immutable records matching filters.

        Args:
            filter: Filter with at least one of type or user_id

        Returns:
            Purge result with counts and affected entries

        Example:
            >>> result = await cortex.immutable.purge_many(
            ...     PurgeManyFilter(type='audit-log', user_id='user-123')
            ... )
            >>> print(f"Deleted {result.deleted} entries")
        """
        # CLIENT-SIDE VALIDATION
        validate_purge_many_filter(filter.type, filter.user_id)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "immutable:purgeMany",
                filter_none_values({
                    "type": filter.type,
                    "userId": filter.user_id,
                }),
            ),
            "immutable:purgeMany",
        )

        return PurgeManyImmutableResult(
            deleted=result.get("deleted", 0),
            total_versions_deleted=result.get("totalVersionsDeleted", 0),
            entries=result.get("entries", []),
        )

    async def purge_versions(
        self,
        type: str,
        id: str,
        keep_latest: int,
    ) -> PurgeVersionsResult:
        """
        Delete old versions while keeping recent ones.

        Args:
            type: Entity type
            id: Logical ID
            keep_latest: Number of latest versions to keep (must be >= 1)

        Returns:
            Purge result with counts

        Example:
            >>> result = await cortex.immutable.purge_versions(
            ...     'kb-article', 'guide-123',
            ...     keep_latest=20
            ... )
            >>> print(f"Purged {result.versions_purged}, kept {result.versions_remaining}")
        """
        # CLIENT-SIDE VALIDATION
        validate_type(type, "type")
        validate_id(id, "id")
        validate_keep_latest(keep_latest, "keep_latest")

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "immutable:purgeVersions",
                filter_none_values({"type": type, "id": id, "keepLatest": keep_latest}),
            ),
            "immutable:purgeVersions",
        )

        return PurgeVersionsResult(
            versions_purged=result.get("versionsPurged", 0),
            versions_remaining=result.get("versionsRemaining", 0),
        )


# Export validation error for specific error handling
__all__ = ["ImmutableAPI", "ImmutableValidationError"]

