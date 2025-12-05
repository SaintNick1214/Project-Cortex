"""
Cortex SDK - Error Handling

All error types and error codes used throughout the Cortex SDK.
"""

from typing import Any, Optional


class CortexError(Exception):
    """Base exception for all Cortex errors with structured error codes."""

    def __init__(self, code: str, message: str = "", details: Optional[Any] = None) -> None:
        """
        Initialize Cortex error.

        Args:
            code: Error code for programmatic handling
            message: Human-readable error message
            details: Additional error context and debugging information
        """
        self.code = code
        self.details = details
        super().__init__(message or code)


class A2ATimeoutError(Exception):
    """Exception raised when A2A request times out."""

    def __init__(self, message: str, message_id: str, timeout: int) -> None:
        """
        Initialize A2A timeout error.

        Args:
            message: Error message
            message_id: The request message ID
            timeout: Timeout duration in milliseconds
        """
        self.message_id = message_id
        self.timeout = timeout
        super().__init__(message)


class CascadeDeletionError(Exception):
    """Exception raised when cascade deletion fails."""

    def __init__(self, message: str, cause: Optional[Exception] = None) -> None:
        """
        Initialize cascade deletion error.

        Args:
            message: Error message
            cause: Original exception that caused the failure
        """
        self.cause = cause
        super().__init__(message)


class AgentCascadeDeletionError(Exception):
    """Exception raised when agent cascade deletion fails.

    This error includes information about what was already deleted before
    the failure occurred. This is critical for understanding database state
    after a partial failure - records that were deleted cannot be recovered.
    """

    def __init__(
        self,
        message: str,
        cause: Optional[Exception] = None,
        partial_deletion: Optional[dict] = None,
    ) -> None:
        """
        Initialize agent cascade deletion error.

        Args:
            message: Error message
            cause: Original exception that caused the failure
            partial_deletion: Dict containing what was already deleted before failure:
                - facts_deleted: Number of facts deleted
                - memories_deleted: Number of memories deleted
                - conversations_deleted: Number of conversations deleted
                - deleted_layers: List of layers that were successfully deleted
                - failed_layer: The layer that failed
        """
        self.cause = cause
        self.partial_deletion = partial_deletion or {}
        super().__init__(message)


class ErrorCode:
    """Error codes used throughout Cortex SDK."""

    # General
    CONVEX_ERROR = "CONVEX_ERROR"
    INVALID_INPUT = "INVALID_INPUT"

    # Memory Operations
    INVALID_MEMORYSPACE_ID = "INVALID_MEMORYSPACE_ID"
    INVALID_AGENT_ID = "INVALID_AGENT_ID"
    INVALID_CONTENT = "INVALID_CONTENT"
    INVALID_IMPORTANCE = "INVALID_IMPORTANCE"
    INVALID_EMBEDDING_DIMENSION = "INVALID_EMBEDDING_DIMENSION"
    MEMORY_NOT_FOUND = "MEMORY_NOT_FOUND"
    VERSION_NOT_FOUND = "VERSION_NOT_FOUND"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    INVALID_FILTERS = "INVALID_FILTERS"
    NO_MEMORIES_MATCHED = "NO_MEMORIES_MATCHED"

    # User Operations
    INVALID_USER_ID = "INVALID_USER_ID"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    INVALID_PROFILE_DATA = "INVALID_PROFILE_DATA"
    NO_USERS_MATCHED = "NO_USERS_MATCHED"

    # Context Operations
    INVALID_PURPOSE = "INVALID_PURPOSE"
    CONTEXT_NOT_FOUND = "CONTEXT_NOT_FOUND"
    PARENT_NOT_FOUND = "PARENT_NOT_FOUND"
    HAS_CHILDREN = "HAS_CHILDREN"
    INVALID_STATUS = "INVALID_STATUS"

    # Conversation Operations
    INVALID_CONVERSATION_ID = "INVALID_CONVERSATION_ID"
    CONVERSATION_NOT_FOUND = "CONVERSATION_NOT_FOUND"
    INVALID_TYPE = "INVALID_TYPE"
    INVALID_PARTICIPANTS = "INVALID_PARTICIPANTS"
    INVALID_MESSAGE = "INVALID_MESSAGE"
    INVALID_QUERY = "INVALID_QUERY"

    # Immutable Store
    INVALID_ID = "INVALID_ID"
    DATA_TOO_LARGE = "DATA_TOO_LARGE"
    NOT_FOUND = "NOT_FOUND"
    PURGE_FAILED = "PURGE_FAILED"
    PURGE_CANCELLED = "PURGE_CANCELLED"

    # Mutable Store
    INVALID_NAMESPACE = "INVALID_NAMESPACE"
    INVALID_KEY = "INVALID_KEY"
    VALUE_TOO_LARGE = "VALUE_TOO_LARGE"
    KEY_NOT_FOUND = "KEY_NOT_FOUND"
    UPDATE_FAILED = "UPDATE_FAILED"
    TRANSACTION_FAILED = "TRANSACTION_FAILED"

    # Operations
    INVALID_PAGINATION = "INVALID_PAGINATION"
    INVALID_OPTIONS = "INVALID_OPTIONS"
    INVALID_UPDATE = "INVALID_UPDATE"
    INVALID_FORMAT = "INVALID_FORMAT"
    INVALID_TIMESTAMP = "INVALID_TIMESTAMP"

    # Deletion
    DELETION_FAILED = "DELETION_FAILED"
    DELETION_CANCELLED = "DELETION_CANCELLED"

    # Export
    EXPORT_FAILED = "EXPORT_FAILED"

    # A2A Communication
    PUBSUB_NOT_CONFIGURED = "PUBSUB_NOT_CONFIGURED"
    EMPTY_RECIPIENTS = "EMPTY_RECIPIENTS"

    # Cloud Mode
    CLOUD_MODE_REQUIRED = "CLOUD_MODE_REQUIRED"
    STRATEGY_FAILED = "STRATEGY_FAILED"

    # Agent Management
    AGENT_NOT_REGISTERED = "AGENT_NOT_REGISTERED"
    AGENT_ALREADY_REGISTERED = "AGENT_ALREADY_REGISTERED"
    INVALID_METADATA = "INVALID_METADATA"
    INVALID_CONFIG = "INVALID_CONFIG"

    # Memory Spaces
    MEMORYSPACE_ALREADY_EXISTS = "MEMORYSPACE_ALREADY_EXISTS"
    MEMORYSPACE_NOT_FOUND = "MEMORYSPACE_NOT_FOUND"
    MEMORYSPACE_HAS_DATA = "MEMORYSPACE_HAS_DATA"

    # Graph Operations
    GRAPH_CONNECTION_ERROR = "GRAPH_CONNECTION_ERROR"
    GRAPH_QUERY_ERROR = "GRAPH_QUERY_ERROR"
    GRAPH_SYNC_ERROR = "GRAPH_SYNC_ERROR"

    # Governance Validation
    GOVERNANCE_VALIDATION_ERROR = "GOVERNANCE_VALIDATION_ERROR"
    MISSING_POLICY_SCOPE = "MISSING_POLICY_SCOPE"
    INVALID_POLICY_SCOPE = "INVALID_POLICY_SCOPE"
    INVALID_PERIOD_FORMAT = "INVALID_PERIOD_FORMAT"
    INVALID_IMPORTANCE_RANGES = "INVALID_IMPORTANCE_RANGES"
    INVALID_VERSION_COUNT = "INVALID_VERSION_COUNT"
    INVALID_ENFORCEMENT_OPTIONS = "INVALID_ENFORCEMENT_OPTIONS"
    INVALID_DATE_RANGE = "INVALID_DATE_RANGE"


def is_cortex_error(error: Any) -> bool:
    """Type guard for CortexError."""
    return isinstance(error, CortexError)


def is_a2a_timeout_error(error: Any) -> bool:
    """Type guard for A2ATimeoutError."""
    return isinstance(error, A2ATimeoutError)


def is_cascade_deletion_error(error: Any) -> bool:
    """Type guard for CascadeDeletionError."""
    return isinstance(error, CascadeDeletionError)

