"""
Cortex SDK - Session Validators

Validation logic for session management.
"""

from typing import Any, Dict, Optional


class SessionValidationError(Exception):
    """
    Validation error for session operations.

    Attributes:
        message: Error message
        code: Error code for programmatic handling
        field: Optional field name that failed validation
    """

    def __init__(
        self,
        message: str,
        code: str,
        field: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.field = field

    def __repr__(self) -> str:
        return f"SessionValidationError(message={self.message!r}, code={self.code!r}, field={self.field!r})"


def validate_session_id(session_id: Any) -> None:
    """
    Validate session ID.

    Args:
        session_id: Session ID to validate

    Raises:
        SessionValidationError: If session_id is invalid
    """
    if session_id is None:
        raise SessionValidationError(
            "sessionId is required",
            "MISSING_SESSION_ID",
            "sessionId",
        )

    if not isinstance(session_id, str):
        raise SessionValidationError(
            f"sessionId must be a string, got {type(session_id).__name__}",
            "INVALID_SESSION_ID_TYPE",
            "sessionId",
        )

    if len(session_id.strip()) == 0:
        raise SessionValidationError(
            "sessionId cannot be empty",
            "EMPTY_SESSION_ID",
            "sessionId",
        )

    if len(session_id) > 256:
        raise SessionValidationError(
            f"sessionId too long: {len(session_id)} > 256 characters",
            "SESSION_ID_TOO_LONG",
            "sessionId",
        )


def validate_user_id(user_id: Any) -> None:
    """
    Validate user ID.

    Args:
        user_id: User ID to validate

    Raises:
        SessionValidationError: If user_id is invalid
    """
    if user_id is None:
        raise SessionValidationError(
            "userId is required",
            "MISSING_USER_ID",
            "userId",
        )

    if not isinstance(user_id, str):
        raise SessionValidationError(
            f"userId must be a string, got {type(user_id).__name__}",
            "INVALID_USER_ID_TYPE",
            "userId",
        )

    if len(user_id.strip()) == 0:
        raise SessionValidationError(
            "userId cannot be empty",
            "EMPTY_USER_ID",
            "userId",
        )

    if len(user_id) > 256:
        raise SessionValidationError(
            f"userId too long: {len(user_id)} > 256 characters",
            "USER_ID_TOO_LONG",
            "userId",
        )


def validate_tenant_id(tenant_id: Any) -> None:
    """
    Validate tenant ID (optional field).

    Args:
        tenant_id: Tenant ID to validate

    Raises:
        SessionValidationError: If tenant_id is invalid
    """
    if tenant_id is None:
        return  # Optional field

    if not isinstance(tenant_id, str):
        raise SessionValidationError(
            f"tenantId must be a string, got {type(tenant_id).__name__}",
            "INVALID_TENANT_ID_TYPE",
            "tenantId",
        )

    if len(tenant_id.strip()) == 0:
        raise SessionValidationError(
            "tenantId cannot be empty string (use None instead)",
            "EMPTY_TENANT_ID",
            "tenantId",
        )


def validate_status(status: Any) -> None:
    """
    Validate session status.

    Args:
        status: Status to validate

    Raises:
        SessionValidationError: If status is invalid
    """
    if status is None:
        return  # Optional in filters

    valid_statuses = {"active", "idle", "ended"}

    if not isinstance(status, str):
        raise SessionValidationError(
            f"status must be a string, got {type(status).__name__}",
            "INVALID_STATUS_TYPE",
            "status",
        )

    if status not in valid_statuses:
        raise SessionValidationError(
            f"Invalid status: {status}. Must be one of: {', '.join(sorted(valid_statuses))}",
            "INVALID_STATUS",
            "status",
        )


def validate_limit(limit: Any) -> None:
    """
    Validate limit parameter.

    Args:
        limit: Limit to validate

    Raises:
        SessionValidationError: If limit is invalid
    """
    if limit is None:
        return  # Optional field

    if not isinstance(limit, int):
        raise SessionValidationError(
            f"limit must be an integer, got {type(limit).__name__}",
            "INVALID_LIMIT_TYPE",
            "limit",
        )

    if limit < 1:
        raise SessionValidationError(
            "limit must be at least 1",
            "LIMIT_TOO_SMALL",
            "limit",
        )

    if limit > 1000:
        raise SessionValidationError(
            f"limit too large: {limit} > 1000",
            "LIMIT_TOO_LARGE",
            "limit",
        )


def validate_offset(offset: Any) -> None:
    """
    Validate offset parameter.

    Args:
        offset: Offset to validate

    Raises:
        SessionValidationError: If offset is invalid
    """
    if offset is None:
        return  # Optional field

    if not isinstance(offset, int):
        raise SessionValidationError(
            f"offset must be an integer, got {type(offset).__name__}",
            "INVALID_OFFSET_TYPE",
            "offset",
        )

    if offset < 0:
        raise SessionValidationError(
            "offset cannot be negative",
            "NEGATIVE_OFFSET",
            "offset",
        )


def validate_timestamp(timestamp: Any, field_name: str) -> None:
    """
    Validate a timestamp field.

    Args:
        timestamp: Timestamp to validate
        field_name: Field name for error messages

    Raises:
        SessionValidationError: If timestamp is invalid
    """
    if timestamp is None:
        return  # Optional field

    if not isinstance(timestamp, (int, float)):
        raise SessionValidationError(
            f"{field_name} must be a number, got {type(timestamp).__name__}",
            "INVALID_TIMESTAMP_TYPE",
            field_name,
        )

    if timestamp < 0:
        raise SessionValidationError(
            f"{field_name} cannot be negative",
            "NEGATIVE_TIMESTAMP",
            field_name,
        )


def validate_create_session_params(params: Dict[str, Any]) -> None:
    """
    Validate session creation parameters.

    Args:
        params: Dictionary of session creation parameters

    Raises:
        SessionValidationError: If any parameter is invalid
    """
    validate_user_id(params.get("user_id"))

    # Optional session_id validation (if provided)
    session_id = params.get("session_id")
    if session_id is not None:
        if not isinstance(session_id, str):
            raise SessionValidationError(
                f"sessionId must be a string, got {type(session_id).__name__}",
                "INVALID_SESSION_ID_TYPE",
                "sessionId",
            )
        if len(session_id.strip()) == 0:
            raise SessionValidationError(
                "sessionId cannot be empty (use None for auto-generation)",
                "EMPTY_SESSION_ID",
                "sessionId",
            )

    validate_tenant_id(params.get("tenant_id"))
    validate_timestamp(params.get("expires_at"), "expiresAt")

    # Validate metadata if provided
    metadata = params.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        raise SessionValidationError(
            f"metadata must be a dict, got {type(metadata).__name__}",
            "INVALID_METADATA_TYPE",
            "metadata",
        )


def validate_session_filters(filters: Dict[str, Any]) -> None:
    """
    Validate session filter parameters.

    Args:
        filters: Dictionary of filter parameters

    Raises:
        SessionValidationError: If any parameter is invalid
    """
    # All filter fields are optional
    user_id = filters.get("user_id")
    if user_id is not None:
        if not isinstance(user_id, str):
            raise SessionValidationError(
                f"userId must be a string, got {type(user_id).__name__}",
                "INVALID_USER_ID_TYPE",
                "userId",
            )

    validate_tenant_id(filters.get("tenant_id"))
    validate_status(filters.get("status"))
    validate_limit(filters.get("limit"))
    validate_offset(filters.get("offset"))


def validate_expire_options(options: Dict[str, Any]) -> None:
    """
    Validate expire options.

    Args:
        options: Dictionary of expire options

    Raises:
        SessionValidationError: If any option is invalid
    """
    validate_tenant_id(options.get("tenant_id"))

    idle_timeout = options.get("idle_timeout")
    if idle_timeout is not None:
        if not isinstance(idle_timeout, int):
            raise SessionValidationError(
                f"idleTimeout must be an integer, got {type(idle_timeout).__name__}",
                "INVALID_IDLE_TIMEOUT_TYPE",
                "idleTimeout",
            )
        if idle_timeout < 0:
            raise SessionValidationError(
                "idleTimeout cannot be negative",
                "NEGATIVE_IDLE_TIMEOUT",
                "idleTimeout",
            )
