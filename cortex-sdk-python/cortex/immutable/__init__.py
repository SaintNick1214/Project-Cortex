"""
Cortex SDK - Immutable Store API

Layer 1b: Shared immutable data with automatic versioning
"""

from typing import Optional, List, Dict, Any, Literal

from ..types import ImmutableRecord, ImmutableEntry, ImmutableVersion
from ..errors import CortexError, ErrorCode
from .._utils import filter_none_values, convert_convex_response


class ImmutableAPI:
    """
    Immutable Store API - Layer 1b

    Provides TRULY SHARED immutable data storage across ALL memory spaces.
    Perfect for knowledge base articles, policies, and audit logs.
    """

    def __init__(self, client, graph_adapter=None):
        """
        Initialize Immutable API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
        """
        self.client = client
        self.graph_adapter = graph_adapter

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
        result = await self.client.query(
            "immutable:search",
            filter_none_values({"query": query, "type": type, "userId": user_id, "limit": limit}),
        )

        return result

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
        result = await self.client.mutation(
            "immutable:purge", filter_none_values({"type": type, "id": id})
        )

        return result

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
        result = await self.client.mutation(
            "immutable:purgeMany",
            filter_none_values({
                "type": type,
                "userId": user_id,
                "createdBefore": created_before,
                "dryRun": dry_run,
            }),
        )

        return result

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
        result = await self.client.mutation(
            "immutable:purgeVersions",
            filter_none_values({"type": type, "id": id, "keepLatest": keep_latest, "olderThan": older_than}),
        )

        return result

