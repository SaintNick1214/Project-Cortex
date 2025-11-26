"""
Facts API Validation

Client-side validation for facts operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Union


class FactsValidationError(Exception):
    """Custom exception for facts validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize facts validation error.

        Args:
            message: Human-readable error message
            code: Error code for programmatic handling
            field: Optional field name that failed validation
        """
        self.code = code
        self.field = field
        super().__init__(message)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Enum Constants
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALID_FACT_TYPES = [
    "preference",
    "identity",
    "knowledge",
    "relationship",
    "event",
    "observation",
    "custom",
]

VALID_SOURCE_TYPES = [
    "conversation",
    "system",
    "tool",
    "manual",
    "a2a",
]

VALID_EXPORT_FORMATS = ["json", "jsonld", "csv"]

VALID_SORT_BY_FIELDS = [
    "createdAt",
    "updatedAt",
    "confidence",
    "version",
]

VALID_TAG_MATCH = ["any", "all"]
VALID_SORT_ORDER = ["asc", "desc"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Required Field Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_required_string(value: Optional[str], field_name: str) -> None:
    """
    Validates required string fields (non-null, non-empty, trimmed).

    Args:
        value: String value to validate
        field_name: Name of the field being validated

    Raises:
        FactsValidationError: If value is invalid
    """
    if not value or not isinstance(value, str) or not value.strip():
        raise FactsValidationError(
            f"{field_name} is required and cannot be empty",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )


def validate_required_number(
    value: Optional[Union[int, float]], field_name: str
) -> None:
    """
    Validates required number fields (non-null, is number).

    Args:
        value: Number value to validate
        field_name: Name of the field being validated

    Raises:
        FactsValidationError: If value is invalid
    """
    if value is None or not isinstance(value, (int, float)):
        raise FactsValidationError(
            f"{field_name} is required and must be a number",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )

    # Check for NaN in floats
    if isinstance(value, float):
        import math

        if math.isnan(value):
            raise FactsValidationError(
                f"{field_name} must be a valid number, got NaN",
                "MISSING_REQUIRED_FIELD",
                field_name,
            )


def validate_required_enum(
    value: Optional[str], field_name: str, allowed_values: List[str]
) -> None:
    """
    Validates required enum value.

    Args:
        value: Enum value to validate
        field_name: Name of the field being validated
        allowed_values: List of allowed values

    Raises:
        FactsValidationError: If value is invalid
    """
    if value is None:
        raise FactsValidationError(
            f"{field_name} is required", "MISSING_REQUIRED_FIELD", field_name
        )

    if value not in allowed_values:
        code = f"INVALID_{field_name.upper().replace('.', '_')}"
        raise FactsValidationError(
            f'Invalid {field_name} "{value}". Valid values: {", ".join(allowed_values)}',
            code,
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Format Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_fact_id_format(fact_id: str, field_name: str = "fact_id") -> None:
    """
    Validates fact_id format (should match "fact-*").

    Args:
        fact_id: Fact ID to validate
        field_name: Name of the field being validated

    Raises:
        FactsValidationError: If fact_id format is invalid
    """
    if not fact_id or not isinstance(fact_id, str):
        raise FactsValidationError(
            f"{field_name} must be a non-empty string",
            "INVALID_FACT_ID_FORMAT",
            field_name,
        )

    if not fact_id.startswith("fact-"):
        raise FactsValidationError(
            f'{field_name} must start with "fact-", got "{fact_id}"',
            "INVALID_FACT_ID_FORMAT",
            field_name,
        )


def validate_memory_space_id(memory_space_id: str) -> None:
    """
    Validates memory_space_id is non-empty.

    Args:
        memory_space_id: Memory space ID to validate

    Raises:
        FactsValidationError: If memory_space_id is invalid
    """
    validate_required_string(memory_space_id, "memory_space_id")


def validate_string_array(
    arr: Any, field_name: str, allow_empty: bool = True
) -> None:
    """
    Validates list of strings (tags, fact_ids).

    Args:
        arr: Array to validate
        field_name: Name of the field being validated
        allow_empty: Whether empty arrays are allowed

    Raises:
        FactsValidationError: If array is invalid
    """
    if not isinstance(arr, list):
        raise FactsValidationError(
            f"{field_name} must be a list", "INVALID_ARRAY", field_name
        )

    if not allow_empty and len(arr) == 0:
        raise FactsValidationError(
            f"{field_name} must contain at least one element",
            "EMPTY_ARRAY",
            field_name,
        )

    for i, item in enumerate(arr):
        if not isinstance(item, str):
            raise FactsValidationError(
                f"{field_name} must contain only strings, found {type(item).__name__} at index {i}",
                "INVALID_ARRAY",
                field_name,
            )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Range/Boundary Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_confidence(
    confidence: Union[int, float], field_name: str = "confidence"
) -> None:
    """
    Validates confidence score (0-100).

    Args:
        confidence: Confidence value to validate
        field_name: Name of the field being validated

    Raises:
        FactsValidationError: If confidence is out of range
    """
    validate_required_number(confidence, field_name)

    if confidence < 0 or confidence > 100:
        raise FactsValidationError(
            f"{field_name} must be between 0 and 100, got {confidence}",
            "INVALID_CONFIDENCE",
            field_name,
        )


def validate_non_negative_integer(
    value: Optional[Union[int, float]], field_name: str
) -> None:
    """
    Validates non-negative integer (limit, offset).

    Args:
        value: Value to validate
        field_name: Name of the field being validated

    Raises:
        FactsValidationError: If value is invalid
    """
    if value is None:
        return

    if not isinstance(value, (int, float)):
        raise FactsValidationError(
            f"{field_name} must be a valid number", "INVALID_ARRAY", field_name
        )

    # Check for NaN in floats
    if isinstance(value, float):
        import math

        if math.isnan(value):
            raise FactsValidationError(
                f"{field_name} must be a valid number", "INVALID_ARRAY", field_name
            )

    if value < 0:
        raise FactsValidationError(
            f"{field_name} must be non-negative, got {value}",
            "INVALID_ARRAY",
            field_name,
        )

    if not isinstance(value, int) and (isinstance(value, float) and value != int(value)):
        raise FactsValidationError(
            f"{field_name} must be an integer, got {value}",
            "INVALID_ARRAY",
            field_name,
        )


def validate_pagination(limit: Optional[int] = None, offset: Optional[int] = None) -> None:
    """
    Validates pagination parameters.

    Args:
        limit: Limit value to validate
        offset: Offset value to validate

    Raises:
        FactsValidationError: If pagination parameters are invalid
    """
    if limit is not None:
        validate_non_negative_integer(limit, "limit")
    if offset is not None:
        validate_non_negative_integer(offset, "offset")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Enum Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_fact_type(fact_type: str) -> None:
    """
    Validates fact_type.

    Args:
        fact_type: Fact type to validate

    Raises:
        FactsValidationError: If fact_type is invalid
    """
    if fact_type not in VALID_FACT_TYPES:
        raise FactsValidationError(
            f'Invalid fact_type "{fact_type}". Valid types: {", ".join(VALID_FACT_TYPES)}',
            "INVALID_FACT_TYPE",
            "fact_type",
        )


def validate_source_type(source_type: str) -> None:
    """
    Validates source_type.

    Args:
        source_type: Source type to validate

    Raises:
        FactsValidationError: If source_type is invalid
    """
    if source_type not in VALID_SOURCE_TYPES:
        raise FactsValidationError(
            f'Invalid source_type "{source_type}". Valid types: {", ".join(VALID_SOURCE_TYPES)}',
            "INVALID_SOURCE_TYPE",
            "source_type",
        )


def validate_export_format(format: str) -> None:
    """
    Validates export format.

    Args:
        format: Export format to validate

    Raises:
        FactsValidationError: If format is invalid
    """
    if format not in VALID_EXPORT_FORMATS:
        raise FactsValidationError(
            f'Invalid format "{format}". Valid formats: {", ".join(VALID_EXPORT_FORMATS)}',
            "INVALID_EXPORT_FORMAT",
            "format",
        )


def validate_sort_by(sort_by: str) -> None:
    """
    Validates sort_by field.

    Args:
        sort_by: Sort field to validate

    Raises:
        FactsValidationError: If sort_by is invalid
    """
    if sort_by not in VALID_SORT_BY_FIELDS:
        raise FactsValidationError(
            f'Invalid sort_by "{sort_by}". Valid fields: {", ".join(VALID_SORT_BY_FIELDS)}',
            "INVALID_SORT_BY",
            "sort_by",
        )


def validate_tag_match(tag_match: str) -> None:
    """
    Validates tag_match.

    Args:
        tag_match: Tag match mode to validate

    Raises:
        FactsValidationError: If tag_match is invalid
    """
    if tag_match not in VALID_TAG_MATCH:
        raise FactsValidationError(
            f'Invalid tag_match "{tag_match}". Valid values: {", ".join(VALID_TAG_MATCH)}',
            "INVALID_TAG_MATCH",
            "tag_match",
        )


def validate_sort_order(sort_order: str) -> None:
    """
    Validates sort_order.

    Args:
        sort_order: Sort order to validate

    Raises:
        FactsValidationError: If sort_order is invalid
    """
    if sort_order not in VALID_SORT_ORDER:
        raise FactsValidationError(
            f'Invalid sort_order "{sort_order}". Valid values: {", ".join(VALID_SORT_ORDER)}',
            "INVALID_SORT_ORDER",
            "sort_order",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Date Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_datetime(date: Optional[datetime], field_name: str) -> None:
    """
    Validates datetime object is valid.

    Args:
        date: Datetime to validate
        field_name: Name of the field being validated

    Raises:
        FactsValidationError: If datetime is invalid
    """
    if date is None:
        return

    if not isinstance(date, datetime):
        raise FactsValidationError(
            f"{field_name} must be a valid datetime object",
            "INVALID_DATE_RANGE",
            field_name,
        )


def validate_datetime_range(
    start: Optional[datetime],
    end: Optional[datetime],
    start_field_name: str,
    end_field_name: str,
) -> None:
    """
    Validates datetime range (start < end).

    Args:
        start: Start datetime
        end: End datetime
        start_field_name: Name of start field
        end_field_name: Name of end field

    Raises:
        FactsValidationError: If date range is invalid
    """
    if not start or not end:
        return

    validate_datetime(start, start_field_name)
    validate_datetime(end, end_field_name)

    if start >= end:
        raise FactsValidationError(
            f"{start_field_name} must be before {end_field_name}",
            "INVALID_DATE_RANGE",
        )


def validate_validity_period(
    valid_from: Optional[int] = None, valid_until: Optional[int] = None
) -> None:
    """
    Validates validity period.

    Args:
        valid_from: Start timestamp
        valid_until: End timestamp

    Raises:
        FactsValidationError: If validity period is invalid
    """
    if valid_from is None or valid_until is None:
        return

    if not isinstance(valid_from, (int, float)) or not isinstance(
        valid_until, (int, float)
    ):
        raise FactsValidationError(
            "valid_from and valid_until must be numbers (timestamps)",
            "INVALID_VALIDITY_PERIOD",
        )

    # Check for NaN
    import math

    if isinstance(valid_from, float) and math.isnan(valid_from):
        raise FactsValidationError(
            "valid_from must be a valid timestamp", "INVALID_VALIDITY_PERIOD"
        )

    if isinstance(valid_until, float) and math.isnan(valid_until):
        raise FactsValidationError(
            "valid_until must be a valid timestamp", "INVALID_VALIDITY_PERIOD"
        )

    if valid_from >= valid_until:
        raise FactsValidationError(
            "valid_from must be before valid_until", "INVALID_VALIDITY_PERIOD"
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Business Logic Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_update_has_fields(updates: Dict[str, Any]) -> None:
    """
    Validates at least one field is provided for update.

    Args:
        updates: Update dictionary to validate

    Raises:
        FactsValidationError: If no fields are provided
    """
    has_fields = (
        "fact" in updates
        or "confidence" in updates
        or "tags" in updates
        or "validUntil" in updates
        or "metadata" in updates
    )

    if not has_fields:
        raise FactsValidationError(
            "Update must include at least one field (fact, confidence, tags, validUntil, or metadata)",
            "INVALID_UPDATE",
        )


def validate_consolidation(fact_ids: List[str], keep_fact_id: str) -> None:
    """
    Validates consolidation parameters.

    Args:
        fact_ids: List of fact IDs to consolidate
        keep_fact_id: Fact ID to keep

    Raises:
        FactsValidationError: If consolidation parameters are invalid
    """
    # Must have at least 2 facts
    if len(fact_ids) < 2:
        raise FactsValidationError(
            f"consolidation requires at least 2 facts, got {len(fact_ids)}",
            "INVALID_CONSOLIDATION",
            "fact_ids",
        )

    # keep_fact_id must be in fact_ids
    if keep_fact_id not in fact_ids:
        raise FactsValidationError(
            f'keep_fact_id "{keep_fact_id}" must be in fact_ids list',
            "INVALID_CONSOLIDATION",
            "keep_fact_id",
        )

    # No duplicate fact_ids
    unique_ids = set(fact_ids)
    if len(unique_ids) != len(fact_ids):
        raise FactsValidationError(
            "fact_ids list must not contain duplicates",
            "INVALID_CONSOLIDATION",
            "fact_ids",
        )


def validate_source_ref(source_ref: Any) -> None:
    """
    Validates source_ref structure.

    Args:
        source_ref: Source reference to validate

    Raises:
        FactsValidationError: If source_ref is invalid
    """
    # Check if it's a primitive type (string, number, bool, None)
    if source_ref is None or isinstance(source_ref, (str, int, float, bool)):
        raise FactsValidationError(
            "source_ref must be an object or dict", "INVALID_METADATA", "source_ref"
        )

    # Must be dict or object with attributes
    if not isinstance(source_ref, dict) and not hasattr(source_ref, "__dict__"):
        raise FactsValidationError(
            "source_ref must be an object or dict", "INVALID_METADATA", "source_ref"
        )

    # Handle both dict and object access
    if isinstance(source_ref, dict):
        # Validate optional fields if present
        if "conversationId" in source_ref and not isinstance(
            source_ref["conversationId"], str
        ):
            raise FactsValidationError(
                "source_ref.conversationId must be a string",
                "INVALID_METADATA",
                "source_ref.conversationId",
            )

        if "messageIds" in source_ref:
            if not isinstance(source_ref["messageIds"], list):
                raise FactsValidationError(
                    "source_ref.messageIds must be a list",
                    "INVALID_METADATA",
                    "source_ref.messageIds",
                )
            for msg_id in source_ref["messageIds"]:
                if not isinstance(msg_id, str):
                    raise FactsValidationError(
                        "source_ref.messageIds must contain only strings",
                        "INVALID_METADATA",
                        "source_ref.messageIds",
                    )

        if "memoryId" in source_ref and not isinstance(source_ref["memoryId"], str):
            raise FactsValidationError(
                "source_ref.memoryId must be a string",
                "INVALID_METADATA",
                "source_ref.memoryId",
            )
    else:
        # Handle object with attributes
        if hasattr(source_ref, "conversation_id") and not isinstance(
            source_ref.conversation_id, (str, type(None))
        ):
            raise FactsValidationError(
                "source_ref.conversation_id must be a string",
                "INVALID_METADATA",
                "source_ref.conversation_id",
            )

        if hasattr(source_ref, "message_ids"):
            if not isinstance(source_ref.message_ids, (list, type(None))):
                raise FactsValidationError(
                    "source_ref.message_ids must be a list",
                    "INVALID_METADATA",
                    "source_ref.message_ids",
                )
            if source_ref.message_ids:
                for msg_id in source_ref.message_ids:
                    if not isinstance(msg_id, str):
                        raise FactsValidationError(
                            "source_ref.message_ids must contain only strings",
                            "INVALID_METADATA",
                            "source_ref.message_ids",
                        )

        if hasattr(source_ref, "memory_id") and not isinstance(
            source_ref.memory_id, (str, type(None))
        ):
            raise FactsValidationError(
                "source_ref.memory_id must be a string",
                "INVALID_METADATA",
                "source_ref.memory_id",
            )


def validate_metadata(metadata: Any) -> None:
    """
    Validates metadata is dict.

    Args:
        metadata: Metadata to validate

    Raises:
        FactsValidationError: If metadata is invalid
    """
    if metadata is None or not isinstance(metadata, dict):
        raise FactsValidationError(
            "metadata must be a dict", "INVALID_METADATA", "metadata"
        )

    if isinstance(metadata, list):
        raise FactsValidationError(
            "metadata must be a dict, not a list", "INVALID_METADATA", "metadata"
        )
