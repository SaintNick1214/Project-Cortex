"""
Contexts API Validation

Client-side validation for contexts operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

import re
from datetime import datetime
from typing import Any, Dict, Optional


class ContextsValidationError(Exception):
    """Custom exception for contexts validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize contexts validation error.

        Args:
            message: Human-readable error message
            code: Error code for programmatic handling
            field: Optional field name that failed validation
        """
        self.code = code
        self.field = field
        super().__init__(message)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Required Field Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_required_string(value: Any, field_name: str) -> None:
    """
    Validates that a value is a non-empty string.

    Args:
        value: Value to validate
        field_name: Name of the field being validated

    Raises:
        ContextsValidationError: If value is not a valid non-empty string
    """
    if not value or not isinstance(value, str) or not value.strip():
        raise ContextsValidationError(
            f"{field_name} is required and cannot be empty",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )


def validate_purpose(purpose: str) -> None:
    """
    Validates purpose field (non-empty, not whitespace-only).

    Args:
        purpose: Purpose string to validate

    Raises:
        ContextsValidationError: If purpose is invalid
    """
    if not purpose or not isinstance(purpose, str):
        raise ContextsValidationError(
            "purpose is required and cannot be empty",
            "MISSING_REQUIRED_FIELD",
            "purpose",
        )

    if not purpose.strip():
        raise ContextsValidationError(
            "purpose cannot contain only whitespace",
            "WHITESPACE_ONLY",
            "purpose",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Format Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTEXT_ID_REGEX = re.compile(r"^ctx-\d+-[a-z0-9]+$")
CONVERSATION_ID_PREFIX = "conv-"
VALID_STATUSES = ["active", "completed", "cancelled", "blocked"]
VALID_FORMATS = ["json", "csv"]


def validate_context_id_format(context_id: str) -> None:
    r"""
    Validates contextId format: must match pattern /^ctx-\d+-[a-z0-9]+$/.

    Args:
        context_id: Context ID to validate

    Raises:
        ContextsValidationError: If format is invalid
    """
    if not CONTEXT_ID_REGEX.match(context_id):
        raise ContextsValidationError(
            f'Invalid contextId format "{context_id}". Expected format: "ctx-{{timestamp}}-{{random}}" (e.g., "ctx-1234567890-abc123")',
            "INVALID_CONTEXT_ID_FORMAT",
            "context_id",
        )


def validate_conversation_id_format(conversation_id: str) -> None:
    """
    Validates conversationId format: must start with "conv-".

    Args:
        conversation_id: Conversation ID to validate

    Raises:
        ContextsValidationError: If format is invalid
    """
    if not conversation_id.startswith(CONVERSATION_ID_PREFIX):
        raise ContextsValidationError(
            f'Invalid conversationId format "{conversation_id}". Must start with "conv-"',
            "INVALID_CONVERSATION_ID_FORMAT",
            "conversation_id",
        )


def validate_status(status: str) -> None:
    """
    Validates status enum value.

    Args:
        status: Status string to validate

    Raises:
        ContextsValidationError: If status is invalid
    """
    if not status or not isinstance(status, str):
        raise ContextsValidationError(
            "status is required and must be a string",
            "INVALID_STATUS",
            "status",
        )

    if status not in VALID_STATUSES:
        raise ContextsValidationError(
            f'Invalid status "{status}". Valid statuses: {", ".join(VALID_STATUSES)}',
            "INVALID_STATUS",
            "status",
        )


def validate_export_format(format: str) -> None:
    """
    Validates export format enum value.

    Args:
        format: Format string to validate

    Raises:
        ContextsValidationError: If format is invalid
    """
    if not format or not isinstance(format, str):
        raise ContextsValidationError(
            "format is required and must be a string",
            "INVALID_FORMAT",
            "format",
        )

    if format not in VALID_FORMATS:
        raise ContextsValidationError(
            f'Invalid format "{format}". Valid formats: {", ".join(VALID_FORMATS)}',
            "INVALID_FORMAT",
            "format",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Range Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_depth(depth: int) -> None:
    """
    Validates depth value (must be >= 0).

    Args:
        depth: Depth value to validate

    Raises:
        ContextsValidationError: If depth is invalid
    """
    if not isinstance(depth, (int, float)):
        raise ContextsValidationError(
            "depth must be a number",
            "INVALID_RANGE",
            "depth",
        )

    if depth < 0:
        raise ContextsValidationError(
            f"depth must be >= 0, got {depth}",
            "INVALID_RANGE",
            "depth",
        )


def validate_limit(limit: int) -> None:
    """
    Validates limit value (must be > 0 and <= 1000).

    Args:
        limit: Limit value to validate

    Raises:
        ContextsValidationError: If limit is invalid
    """
    if not isinstance(limit, (int, float)):
        raise ContextsValidationError(
            "limit must be a number",
            "INVALID_RANGE",
            "limit",
        )

    if limit <= 0:
        raise ContextsValidationError(
            f"limit must be > 0, got {limit}",
            "INVALID_RANGE",
            "limit",
        )

    if limit > 1000:
        raise ContextsValidationError(
            f"limit must be <= 1000, got {limit}",
            "INVALID_RANGE",
            "limit",
        )


def validate_version(version: int) -> None:
    """
    Validates version number (must be integer >= 1).

    Args:
        version: Version number to validate

    Raises:
        ContextsValidationError: If version is invalid
    """
    if not isinstance(version, (int, float)):
        raise ContextsValidationError(
            "version must be a number",
            "INVALID_RANGE",
            "version",
        )

    if version < 1:
        raise ContextsValidationError(
            f"version must be >= 1, got {version}",
            "INVALID_RANGE",
            "version",
        )

    if not isinstance(version, int) and version != int(version):
        raise ContextsValidationError(
            f"version must be an integer, got {version}",
            "INVALID_RANGE",
            "version",
        )


def validate_timestamp(timestamp: int, field_name: str) -> None:
    """
    Validates timestamp value (must be > 0).

    Args:
        timestamp: Timestamp to validate
        field_name: Name of the field being validated

    Raises:
        ContextsValidationError: If timestamp is invalid
    """
    if not isinstance(timestamp, (int, float)):
        raise ContextsValidationError(
            f"{field_name} must be a number",
            "INVALID_RANGE",
            field_name,
        )

    if timestamp <= 0:
        raise ContextsValidationError(
            f"{field_name} must be > 0, got {timestamp}",
            "INVALID_RANGE",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Type Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_data_object(data: Any) -> None:
    """
    Validates that data is a dictionary (not null, not list).

    Args:
        data: Data to validate

    Raises:
        ContextsValidationError: If data is not a valid dictionary
    """
    if not isinstance(data, dict):
        raise ContextsValidationError(
            "data must be a dictionary",
            "INVALID_TYPE",
            "data",
        )


def validate_conversation_ref(ref: Any) -> None:
    """
    Validates conversationRef structure.

    Args:
        ref: Conversation reference to validate

    Raises:
        ContextsValidationError: If conversation ref is invalid
    """
    if not isinstance(ref, dict):
        raise ContextsValidationError(
            "conversation_ref must be a dictionary",
            "INVALID_TYPE",
            "conversation_ref",
        )

    if "conversationId" not in ref or not isinstance(ref["conversationId"], str):
        raise ContextsValidationError(
            "conversation_ref must include conversationId string",
            "MISSING_REQUIRED_FIELD",
            "conversation_ref.conversationId",
        )

    validate_conversation_id_format(ref["conversationId"])

    if "messageIds" in ref and not isinstance(ref["messageIds"], list):
        raise ContextsValidationError(
            "conversation_ref.messageIds must be a list",
            "INVALID_TYPE",
            "conversation_ref.messageIds",
        )


def validate_datetime_object(dt: Any, field_name: str) -> None:
    """
    Validates datetime object.

    Args:
        dt: Datetime to validate
        field_name: Name of the field being validated

    Raises:
        ContextsValidationError: If datetime is invalid
    """
    if not isinstance(dt, datetime):
        raise ContextsValidationError(
            f"{field_name} must be a datetime object",
            "INVALID_DATE",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Business Logic Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_non_empty_list(arr: Any, field_name: str) -> None:
    """
    Validates that a list is non-empty.

    Args:
        arr: List to validate
        field_name: Name of the field being validated

    Raises:
        ContextsValidationError: If list is empty or not a list
    """
    if not isinstance(arr, list):
        raise ContextsValidationError(
            f"{field_name} must be a list",
            "INVALID_TYPE",
            field_name,
        )

    if len(arr) == 0:
        raise ContextsValidationError(
            f"{field_name} cannot be empty",
            "EMPTY_ARRAY",
            field_name,
        )


def validate_updates_dict(updates: Dict[str, Any]) -> None:
    """
    Validates that updates dictionary has at least one field.

    Args:
        updates: Updates dictionary to validate

    Raises:
        ContextsValidationError: If updates is invalid
    """
    if not isinstance(updates, dict):
        raise ContextsValidationError(
            "updates must be a dictionary",
            "INVALID_TYPE",
            "updates",
        )

    if len(updates) == 0:
        raise ContextsValidationError(
            "updates must include at least one field to update",
            "EMPTY_UPDATES",
            "updates",
        )


def validate_has_filters(filters: Dict[str, Any]) -> None:
    """
    Validates that filters dictionary has at least one defined value.

    Args:
        filters: Filters dictionary to validate

    Raises:
        ContextsValidationError: If filters is invalid
    """
    if not isinstance(filters, dict):
        raise ContextsValidationError(
            "filters must be a dictionary",
            "INVALID_TYPE",
            "filters",
        )

    # Check if at least one filter has a non-None value
    has_defined_filter = any(v is not None for v in filters.values())

    if not has_defined_filter:
        raise ContextsValidationError(
            "filters must include at least one defined filter field",
            "EMPTY_FILTERS",
            "filters",
        )
