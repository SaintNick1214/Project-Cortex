"""
Immutable API Validation

Client-side validation for immutable operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

import re
from typing import Any, Dict, Optional

from ..types import ImmutableEntry


class ImmutableValidationError(Exception):
    """Custom exception for immutable validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize immutable validation error.

        Args:
            message: Human-readable error message
            code: Error code for programmatic handling
            field: Optional field name that failed validation
        """
        self.code = code
        self.field = field
        super().__init__(message)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Basic Field Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_type(type_value: str, field_name: str = "type") -> None:
    """
    Validates type string is non-empty and valid format.

    Args:
        type_value: Type string to validate
        field_name: Name of the field being validated

    Raises:
        ImmutableValidationError: If type is invalid
    """
    if type_value is None:
        raise ImmutableValidationError(
            "Type is required", "MISSING_REQUIRED_FIELD", field_name
        )

    if not isinstance(type_value, str) or not type_value.strip():
        raise ImmutableValidationError(
            "Type must be a non-empty string", "INVALID_TYPE", field_name
        )

    # Only allow alphanumeric, dash, underscore, dot
    type_regex = re.compile(r"^[a-zA-Z0-9_.-]+$")
    if not type_regex.match(type_value):
        raise ImmutableValidationError(
            f'{field_name} must contain only valid characters (alphanumeric, dash, underscore, dot), got "{type_value}"',
            "INVALID_TYPE",
            field_name,
        )


def validate_id(id_value: str, field_name: str = "id") -> None:
    """
    Validates ID string is non-empty.

    Args:
        id_value: ID string to validate
        field_name: Name of the field being validated

    Raises:
        ImmutableValidationError: If ID is invalid
    """
    if id_value is None:
        raise ImmutableValidationError(
            "ID is required", "MISSING_REQUIRED_FIELD", field_name
        )

    if not isinstance(id_value, str) or not id_value.strip():
        raise ImmutableValidationError(
            "ID must be a non-empty string", "INVALID_ID", field_name
        )


def validate_data(data: Dict[str, Any], field_name: str = "data") -> None:
    """
    Validates data is a valid dict.

    Args:
        data: Data dict to validate
        field_name: Name of the field being validated

    Raises:
        ImmutableValidationError: If data is invalid
    """
    if data is None:
        raise ImmutableValidationError(
            "Data is required", "MISSING_REQUIRED_FIELD", field_name
        )

    if not isinstance(data, dict):
        raise ImmutableValidationError(
            "Data must be a valid dict", "INVALID_DATA", field_name
        )


def validate_metadata(
    metadata: Optional[Dict[str, Any]], field_name: str = "metadata"
) -> None:
    """
    Validates metadata is dict or None.

    Args:
        metadata: Metadata dict to validate
        field_name: Name of the field being validated

    Raises:
        ImmutableValidationError: If metadata is invalid
    """
    if metadata is None:
        return  # None is OK

    if not isinstance(metadata, dict):
        raise ImmutableValidationError(
            "Metadata must be a dict", "INVALID_METADATA", field_name
        )


def validate_user_id(user_id: Optional[str], field_name: str = "user_id") -> None:
    """
    Validates user_id is string or None, non-empty if provided.

    Args:
        user_id: User ID to validate
        field_name: Name of the field being validated

    Raises:
        ImmutableValidationError: If user_id is invalid
    """
    if user_id is None:
        return  # None is OK

    if not isinstance(user_id, str) or not user_id.strip():
        raise ImmutableValidationError(
            f"{field_name} cannot be empty if provided",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )


def validate_version(version: int, field_name: str = "version") -> None:
    """
    Validates version is positive integer >= 1.

    Args:
        version: Version number to validate
        field_name: Name of the field being validated

    Raises:
        ImmutableValidationError: If version is invalid
    """
    if not isinstance(version, int) or version < 1:
        raise ImmutableValidationError(
            "Version must be a positive integer >= 1",
            "INVALID_VERSION",
            field_name,
        )


def validate_timestamp(timestamp: int, field_name: str = "timestamp") -> None:
    """
    Validates timestamp is positive integer (Unix ms).

    Args:
        timestamp: Timestamp to validate
        field_name: Name of the field being validated

    Raises:
        ImmutableValidationError: If timestamp is invalid
    """
    if not isinstance(timestamp, int) or timestamp < 0:
        raise ImmutableValidationError(
            "Timestamp must be a positive integer (Unix milliseconds)",
            "INVALID_TIMESTAMP",
            field_name,
        )


def validate_limit(limit: Optional[int], field_name: str = "limit") -> None:
    """
    Validates limit is positive integer or None.

    Args:
        limit: Limit to validate
        field_name: Name of the field being validated

    Raises:
        ImmutableValidationError: If limit is invalid
    """
    if limit is None:
        return  # None is OK

    if not isinstance(limit, int) or limit < 1:
        raise ImmutableValidationError(
            "Limit must be a positive integer", "INVALID_LIMIT", field_name
        )


def validate_keep_latest(keep_latest: int, field_name: str = "keep_latest") -> None:
    """
    Validates keep_latest is positive integer >= 1.

    Args:
        keep_latest: keep_latest value to validate
        field_name: Name of the field being validated

    Raises:
        ImmutableValidationError: If keep_latest is invalid
    """
    if not isinstance(keep_latest, int) or keep_latest < 1:
        raise ImmutableValidationError(
            "keep_latest must be a positive integer >= 1",
            "INVALID_KEEP_LATEST",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Composite Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_immutable_entry(entry: ImmutableEntry) -> None:
    """
    Validates complete immutable entry structure.

    Args:
        entry: Immutable entry to validate

    Raises:
        ImmutableValidationError: If entry is invalid
    """
    if not entry:
        raise ImmutableValidationError(
            "Entry is required", "MISSING_REQUIRED_FIELD"
        )

    # Validate required fields
    validate_type(entry.type, "type")
    validate_id(entry.id, "id")
    validate_data(entry.data, "data")

    # Validate optional fields if provided
    if entry.metadata is not None:
        validate_metadata(entry.metadata, "metadata")

    if entry.user_id is not None:
        validate_user_id(entry.user_id, "user_id")


def validate_search_query(query: str, field_name: str = "query") -> None:
    """
    Validates search query is non-empty string.

    Args:
        query: Search query to validate
        field_name: Name of the field being validated

    Raises:
        ImmutableValidationError: If query is invalid
    """
    if not query or not isinstance(query, str) or not query.strip():
        raise ImmutableValidationError(
            "Search query is required and must be a non-empty string",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )


def validate_purge_many_filter(
    type_value: Optional[str], user_id: Optional[str]
) -> None:
    """
    Validates purge_many filter parameters.

    Args:
        type_value: Type filter to validate
        user_id: User ID filter to validate

    Raises:
        ImmutableValidationError: If filters are invalid
    """
    # At least one filter must be provided
    if type_value is None and user_id is None:
        raise ImmutableValidationError(
            "purge_many requires at least one filter (type or user_id)",
            "INVALID_FILTER",
        )

    # Validate provided filters
    if type_value is not None:
        validate_type(type_value, "type")

    if user_id is not None:
        validate_user_id(user_id, "user_id")
