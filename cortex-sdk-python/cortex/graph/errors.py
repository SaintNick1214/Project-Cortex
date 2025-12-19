"""
Cortex SDK - Graph Database Error Classes

Error classes for graph database operations, matching TypeScript SDK.
"""

from typing import Optional


class GraphDatabaseError(Exception):
    """
    Error thrown when graph database operations fail.

    Base class for all graph-related errors.

    Attributes:
        message: Error message
        code: Optional error code
        cause: Optional underlying exception
    """

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        cause: Optional[Exception] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.cause = cause

    def __str__(self) -> str:
        if self.code:
            return f"[{self.code}] {self.message}"
        return self.message


class GraphConnectionError(GraphDatabaseError):
    """
    Error thrown when connection to graph database fails.

    Raised when:
    - Initial connection fails
    - Connection is lost during operation
    - Authentication fails

    Example:
        >>> try:
        ...     await adapter.connect(config)
        ... except GraphConnectionError as e:
        ...     print(f"Connection failed: {e}")
    """

    def __init__(self, message: str, cause: Optional[Exception] = None):
        super().__init__(message, "CONNECTION_ERROR", cause)


class GraphQueryError(GraphDatabaseError):
    """
    Error thrown when a graph query fails.

    Raised when:
    - Cypher syntax is invalid
    - Query execution fails
    - Query timeout

    Attributes:
        query: The Cypher query that failed (if available)

    Example:
        >>> try:
        ...     await adapter.query("INVALID CYPHER")
        ... except GraphQueryError as e:
        ...     print(f"Query failed: {e.query}")
    """

    def __init__(
        self,
        message: str,
        query: Optional[str] = None,
        cause: Optional[Exception] = None,
    ):
        super().__init__(message, "QUERY_ERROR", cause)
        self.query = query

    def __str__(self) -> str:
        base = super().__str__()
        if self.query:
            # Truncate long queries
            query_preview = (
                self.query[:100] + "..." if len(self.query) > 100 else self.query
            )
            return f"{base} | Query: {query_preview}"
        return base


class GraphNotFoundError(GraphDatabaseError):
    """
    Error thrown when a node or edge is not found.

    Raised when:
    - Getting a node by ID that doesn't exist
    - Updating a non-existent node
    - Deleting a non-existent edge

    Attributes:
        resource_type: Type of resource (node, edge, path)
        identifier: The ID or identifier that wasn't found

    Example:
        >>> try:
        ...     node = await adapter.get_node("invalid-id")
        ... except GraphNotFoundError as e:
        ...     print(f"Not found: {e.resource_type} {e.identifier}")
    """

    def __init__(self, resource_type: str, identifier: str):
        message = f"{resource_type} not found: {identifier}"
        super().__init__(message, "NOT_FOUND")
        self.resource_type = resource_type
        self.identifier = identifier


class GraphSchemaError(GraphDatabaseError):
    """
    Error thrown when schema operations fail.

    Raised when:
    - Creating constraints fails
    - Creating indexes fails
    - Schema verification fails

    Example:
        >>> try:
        ...     await initialize_graph_schema(adapter)
        ... except GraphSchemaError as e:
        ...     print(f"Schema error: {e}")
    """

    def __init__(self, message: str, cause: Optional[Exception] = None):
        super().__init__(message, "SCHEMA_ERROR", cause)


class GraphSyncError(GraphDatabaseError):
    """
    Error thrown when graph synchronization fails.

    Raised when:
    - Syncing entities to graph fails
    - Batch sync operations fail
    - Relationship sync fails

    Attributes:
        entity_type: Type of entity being synced
        entity_id: ID of the entity that failed

    Example:
        >>> try:
        ...     await sync_memory_to_graph(memory, adapter)
        ... except GraphSyncError as e:
        ...     print(f"Sync failed for {e.entity_type}: {e.entity_id}")
    """

    def __init__(
        self,
        message: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        cause: Optional[Exception] = None,
    ):
        super().__init__(message, "SYNC_ERROR", cause)
        self.entity_type = entity_type
        self.entity_id = entity_id


__all__ = [
    "GraphDatabaseError",
    "GraphConnectionError",
    "GraphQueryError",
    "GraphNotFoundError",
    "GraphSchemaError",
    "GraphSyncError",
]
