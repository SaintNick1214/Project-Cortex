"""
Conversations API Validation

Client-side validation for conversation operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

from typing import Any, List, Literal, Optional


class ConversationValidationError(Exception):
    """Custom exception for conversation validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize conversation validation error.

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


def validate_required_string(value: Optional[str], field_name: str) -> None:
    """
    Validates required string field is non-empty.

    Args:
        value: String value to validate
        field_name: Name of the field being validated

    Raises:
        ConversationValidationError: If value is None, empty, or whitespace-only
    """
    if not value or not isinstance(value, str) or not value.strip():
        raise ConversationValidationError(
            f"{field_name} is required and cannot be empty",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )


def validate_conversation_type(type: str) -> None:
    """
    Validates conversation type enum.

    Args:
        type: Conversation type to validate

    Raises:
        ConversationValidationError: If type is not valid
    """
    if type not in ("user-agent", "agent-agent"):
        raise ConversationValidationError(
            f'Invalid conversation type "{type}". Must be "user-agent" or "agent-agent"',
            "INVALID_TYPE",
            "type",
        )


def validate_message_role(role: str) -> None:
    """
    Validates message role enum.

    Args:
        role: Message role to validate

    Raises:
        ConversationValidationError: If role is not valid
    """
    if role not in ("user", "agent", "system"):
        raise ConversationValidationError(
            f'Invalid message role "{role}". Must be "user", "agent", or "system"',
            "INVALID_ROLE",
            "role",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Format Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_id_format(
    id: Optional[str], id_type: Literal["conversation", "message"], field_name: str
) -> None:
    """
    Validates ID format (optional - only if provided by user).

    Args:
        id: ID to validate (None is OK)
        id_type: Type of ID being validated
        field_name: Name of the field being validated

    Raises:
        ConversationValidationError: If ID format is invalid
    """
    # ID is optional, skip validation if not provided
    if id is None:
        return

    if not isinstance(id, str) or not id.strip():
        raise ConversationValidationError(
            f"{field_name} cannot be empty", "INVALID_ID_FORMAT", field_name
        )

    # Check for invalid characters (newlines, null bytes)
    if "\n" in id or "\0" in id:
        raise ConversationValidationError(
            f"{field_name} contains invalid characters",
            "INVALID_ID_FORMAT",
            field_name,
        )

    # Check reasonable length
    if len(id) > 500:
        raise ConversationValidationError(
            f"{field_name} exceeds maximum length of 500 characters",
            "INVALID_ID_FORMAT",
            field_name,
        )


def validate_export_format(format: str) -> None:
    """
    Validates export format enum.

    Args:
        format: Export format to validate

    Raises:
        ConversationValidationError: If format is not valid
    """
    if format not in ("json", "csv"):
        raise ConversationValidationError(
            f'Invalid export format "{format}". Must be "json" or "csv"',
            "INVALID_FORMAT",
            "format",
        )


def validate_sort_order(order: Optional[str]) -> None:
    """
    Validates sort order enum.

    Args:
        order: Sort order to validate (None is OK)

    Raises:
        ConversationValidationError: If order is not valid
    """
    # Sort order is optional
    if order is None:
        return

    if order not in ("asc", "desc"):
        raise ConversationValidationError(
            f'Invalid sort order "{order}". Must be "asc" or "desc"',
            "INVALID_SORT_ORDER",
            "sort_order",
        )


def validate_search_query(query: str) -> None:
    """
    Validates search query is non-empty.

    Args:
        query: Search query to validate

    Raises:
        ConversationValidationError: If query is empty
    """
    if not query or not isinstance(query, str) or not query.strip():
        raise ConversationValidationError(
            "Search query is required and cannot be empty", "EMPTY_STRING", "query"
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Range/Boundary Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_limit(limit: Optional[int], field_name: str = "limit") -> None:
    """
    Validates limit is positive integer between 1 and 1000.

    Args:
        limit: Limit to validate (None is OK)
        field_name: Name of the field being validated

    Raises:
        ConversationValidationError: If limit is invalid
    """
    if limit is None:
        return

    if not isinstance(limit, int):
        raise ConversationValidationError(
            f"{field_name} must be an integer", "INVALID_RANGE", field_name
        )

    if limit < 1 or limit > 1000:
        raise ConversationValidationError(
            f"{field_name} must be between 1 and 1000, got {limit}",
            "INVALID_RANGE",
            field_name,
        )


def validate_offset(offset: Optional[int], field_name: str = "offset") -> None:
    """
    Validates offset is non-negative integer.

    Args:
        offset: Offset to validate (None is OK)
        field_name: Name of the field being validated

    Raises:
        ConversationValidationError: If offset is invalid
    """
    if offset is None:
        return

    if not isinstance(offset, int):
        raise ConversationValidationError(
            f"{field_name} must be an integer", "INVALID_RANGE", field_name
        )

    if offset < 0:
        raise ConversationValidationError(
            f"{field_name} must be >= 0, got {offset}",
            "INVALID_RANGE",
            field_name,
        )


def validate_non_empty_list(lst: Optional[List[Any]], field_name: str) -> None:
    """
    Validates list is non-empty when provided.

    Args:
        lst: List to validate (None is OK)
        field_name: Name of the field being validated

    Raises:
        ConversationValidationError: If list exists but is empty
    """
    if lst is None:
        return

    if not isinstance(lst, list):
        raise ConversationValidationError(
            f"{field_name} must be a list", "INVALID_RANGE", field_name
        )

    if len(lst) == 0:
        raise ConversationValidationError(
            f"{field_name} cannot be empty", "EMPTY_ARRAY", field_name
        )


def validate_list_length(
    lst: List[Any], min_len: int, max_len: Optional[int], field_name: str
) -> None:
    """
    Validates list length constraint.

    Args:
        lst: List to validate
        min_len: Minimum required length
        max_len: Maximum allowed length (None for unlimited)
        field_name: Name of the field being validated

    Raises:
        ConversationValidationError: If list length is invalid
    """
    if not isinstance(lst, list):
        raise ConversationValidationError(
            f"{field_name} must be a list", "INVALID_ARRAY_LENGTH", field_name
        )

    if len(lst) < min_len:
        plural = "" if min_len == 1 else "s"
        raise ConversationValidationError(
            f"{field_name} must have at least {min_len} element{plural}, got {len(lst)}",
            "INVALID_ARRAY_LENGTH",
            field_name,
        )

    if max_len is not None and len(lst) > max_len:
        plural = "" if max_len == 1 else "s"
        raise ConversationValidationError(
            f"{field_name} must have at most {max_len} element{plural}, got {len(lst)}",
            "INVALID_ARRAY_LENGTH",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Date Range Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_timestamp_range(start: Optional[int], end: Optional[int]) -> None:
    """
    Validates timestamp range (start < end).

    Args:
        start: Start timestamp (None is OK if end is also None)
        end: End timestamp (None is OK if start is also None)

    Raises:
        ConversationValidationError: If timestamp range is invalid
    """
    # Only validate if both provided
    if start is None or end is None:
        return

    if not isinstance(start, int) or not isinstance(end, int):
        raise ConversationValidationError(
            "Date range values must be integers (timestamps)",
            "INVALID_DATE_RANGE",
        )

    if start >= end:
        raise ConversationValidationError(
            "Start date must be before end date", "INVALID_DATE_RANGE"
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Business Logic Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_participants(type: str, participants: Any) -> None:
    """
    Validates participants structure based on conversation type.

    Args:
        type: Conversation type
        participants: Participants object or dict

    Raises:
        ConversationValidationError: If participants structure is invalid
    """
    if not participants:
        raise ConversationValidationError(
            "Participants is required", "MISSING_REQUIRED_FIELD", "participants"
        )

    if type == "user-agent":
        # User-agent conversations require user_id
        user_id = None
        if hasattr(participants, "user_id"):
            user_id = participants.user_id
        elif isinstance(participants, dict):
            user_id = participants.get("userId") or participants.get("user_id")

        if not user_id or not isinstance(user_id, str) or not user_id.strip():
            raise ConversationValidationError(
                "user-agent conversations require user_id",
                "INVALID_PARTICIPANTS",
                "participants.user_id",
            )

    elif type == "agent-agent":
        # Agent-agent conversations require memory_space_ids with at least 2 elements
        memory_space_ids = None
        if hasattr(participants, "memory_space_ids"):
            memory_space_ids = participants.memory_space_ids
        elif isinstance(participants, dict):
            memory_space_ids = participants.get("memorySpaceIds") or participants.get(
                "memory_space_ids"
            )

        if not memory_space_ids or not isinstance(memory_space_ids, list):
            raise ConversationValidationError(
                "agent-agent conversations require memory_space_ids list",
                "INVALID_PARTICIPANTS",
                "participants.memory_space_ids",
            )

        if len(memory_space_ids) < 2:
            raise ConversationValidationError(
                "agent-agent conversations require at least 2 memory_space_ids",
                "INVALID_PARTICIPANTS",
                "participants.memory_space_ids",
            )


def validate_no_duplicates(lst: List[Any], field_name: str) -> None:
    """
    Validates no duplicates in list.

    Args:
        lst: List to validate
        field_name: Name of the field being validated

    Raises:
        ConversationValidationError: If list contains duplicates
    """
    if not isinstance(lst, list):
        raise ConversationValidationError(
            f"{field_name} must be a list", "INVALID_RANGE", field_name
        )

    seen = set()
    duplicates = []

    for item in lst:
        if item in seen:
            duplicates.append(item)
        seen.add(item)

    if duplicates:
        raise ConversationValidationError(
            f"{field_name} contains duplicate values: {', '.join(str(d) for d in duplicates)}",
            "DUPLICATE_VALUES",
            field_name,
        )
