"""
Vector API Validation

Client-side validation for vector memory operations to catch errors before
they reach the backend, providing faster feedback and better error messages.

This module wraps the memory validators with Vector-specific error class.
"""

import math
from typing import Any, Dict, List, Optional, Union

from ..types import SearchOptions, StoreMemoryInput


class VectorValidationError(Exception):
    """Custom exception for vector validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize vector validation error.

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


def validate_memory_space_id(
    memory_space_id: str, field_name: str = "memory_space_id"
) -> None:
    """
    Validates memory_space_id is non-empty string.

    Args:
        memory_space_id: Memory space ID to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If memory_space_id is invalid
    """
    if not isinstance(memory_space_id, str):
        raise VectorValidationError(
            f"{field_name} is required and must be a string",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )

    if memory_space_id.strip() == "":
        raise VectorValidationError(
            f"{field_name} cannot be empty", "MISSING_REQUIRED_FIELD", field_name
        )


def validate_memory_id(memory_id: str, field_name: str = "memory_id") -> None:
    """
    Validates memory_id is non-empty string.

    Args:
        memory_id: Memory ID to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If memory_id is invalid
    """
    if not isinstance(memory_id, str):
        raise VectorValidationError(
            f"{field_name} is required and must be a string",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )

    if memory_id.strip() == "":
        raise VectorValidationError(
            f"{field_name} cannot be empty", "MISSING_REQUIRED_FIELD", field_name
        )


def validate_user_id(user_id: str, field_name: str = "user_id") -> None:
    """
    Validates user_id is non-empty string.

    Args:
        user_id: User ID to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If user_id is invalid
    """
    if not isinstance(user_id, str):
        raise VectorValidationError(
            f"{field_name} is required and must be a string",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )

    if user_id.strip() == "":
        raise VectorValidationError(
            f"{field_name} cannot be empty", "MISSING_REQUIRED_FIELD", field_name
        )


def validate_content(content: str, field_name: str = "content") -> None:
    """
    Validates content is non-empty string.

    Args:
        content: Content to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If content is invalid
    """
    if not isinstance(content, str):
        raise VectorValidationError(
            f"{field_name} is required and must be a string",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )

    if content.strip() == "":
        raise VectorValidationError(
            f"{field_name} cannot be empty", "MISSING_REQUIRED_FIELD", field_name
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Format Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALID_CONTENT_TYPES = ["raw", "summarized", "fact"]


def validate_content_type(content_type: str) -> None:
    """
    Validates content_type is one of allowed values.

    Args:
        content_type: Content type to validate

    Raises:
        VectorValidationError: If content_type is invalid
    """
    if content_type not in VALID_CONTENT_TYPES:
        raise VectorValidationError(
            f'Invalid content_type "{content_type}". Valid types: {", ".join(VALID_CONTENT_TYPES)}',
            "INVALID_FORMAT",
            "content_type",
        )


VALID_SOURCE_TYPES = ["conversation", "system", "tool", "a2a"]


def validate_source_type(source_type: str) -> None:
    """
    Validates source_type is one of allowed values.

    Args:
        source_type: Source type to validate

    Raises:
        VectorValidationError: If source_type is invalid
    """
    if source_type not in VALID_SOURCE_TYPES:
        raise VectorValidationError(
            f'Invalid source_type "{source_type}". Valid types: {", ".join(VALID_SOURCE_TYPES)}',
            "INVALID_SOURCE_TYPE",
            "source_type",
        )


VALID_EXPORT_FORMATS = ["json", "csv"]


def validate_export_format(format: str) -> None:
    """
    Validates export format is one of allowed values.

    Args:
        format: Export format to validate

    Raises:
        VectorValidationError: If format is invalid
    """
    if format not in VALID_EXPORT_FORMATS:
        raise VectorValidationError(
            f'Invalid format "{format}". Valid formats: {", ".join(VALID_EXPORT_FORMATS)}',
            "INVALID_FORMAT",
            "format",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Range/Boundary Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_importance(
    importance: Union[int, float], field_name: str = "importance"
) -> None:
    """
    Validates importance is between 0-100.

    Args:
        importance: Importance value to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If importance is invalid
    """
    if not isinstance(importance, (int, float)) or math.isnan(importance):
        raise VectorValidationError(
            f"{field_name} must be a number", "INVALID_IMPORTANCE", field_name
        )

    if importance < 0 or importance > 100:
        raise VectorValidationError(
            f"{field_name} must be between 0 and 100, got {importance}",
            "INVALID_IMPORTANCE",
            field_name,
        )


def validate_version(version: int, field_name: str = "version") -> None:
    """
    Validates version is positive integer >= 1.

    Args:
        version: Version number to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If version is invalid
    """
    if not isinstance(version, (int, float)) or math.isnan(version):
        raise VectorValidationError(
            f"{field_name} must be a number", "NEGATIVE_NUMBER", field_name
        )

    if version < 1 or not float(version).is_integer():
        raise VectorValidationError(
            f"{field_name} must be a positive integer >= 1, got {version}",
            "NEGATIVE_NUMBER",
            field_name,
        )


def validate_limit(limit: int, field_name: str = "limit") -> None:
    """
    Validates limit is positive integer >= 1.

    Args:
        limit: Limit value to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If limit is invalid
    """
    if not isinstance(limit, (int, float)) or math.isnan(limit):
        raise VectorValidationError(
            f"{field_name} must be a number", "NEGATIVE_NUMBER", field_name
        )

    if limit < 1:
        raise VectorValidationError(
            f"{field_name} must be a positive integer >= 1, got {limit}",
            "NEGATIVE_NUMBER",
            field_name,
        )


def validate_timestamp(
    timestamp: Union[int, float], field_name: str = "timestamp"
) -> None:
    """
    Validates timestamp is valid.

    Args:
        timestamp: Timestamp to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If timestamp is invalid
    """
    if not isinstance(timestamp, (int, float)) or math.isnan(timestamp):
        raise VectorValidationError(
            f"{field_name} must be a valid timestamp (number)",
            "INVALID_TIMESTAMP",
            field_name,
        )

    if timestamp < 0:
        raise VectorValidationError(
            f"{field_name} cannot be negative, got {timestamp}",
            "INVALID_TIMESTAMP",
            field_name,
        )


def validate_min_score(min_score: float, field_name: str = "min_score") -> None:
    """
    Validates min_score is between 0-1.

    Args:
        min_score: Minimum score to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If min_score is invalid
    """
    if not isinstance(min_score, (int, float)) or math.isnan(min_score):
        raise VectorValidationError(
            f"{field_name} must be a number", "INVALID_FORMAT", field_name
        )

    if min_score < 0 or min_score > 1:
        raise VectorValidationError(
            f"{field_name} must be between 0 and 1 (similarity score), got {min_score}",
            "INVALID_FORMAT",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Embedding Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_embedding(
    embedding: List[Union[int, float]], field_name: str = "embedding"
) -> None:
    """
    Validates embedding is list of finite numbers.

    Args:
        embedding: Embedding vector to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If embedding is invalid
    """
    if not isinstance(embedding, list):
        raise VectorValidationError(
            f"{field_name} must be a list of numbers", "INVALID_EMBEDDING", field_name
        )

    if len(embedding) == 0:
        raise VectorValidationError(
            f"{field_name} cannot be empty", "INVALID_EMBEDDING", field_name
        )

    for i, value in enumerate(embedding):
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            raise VectorValidationError(
                f"{field_name}[{i}] must be a finite number, got {value}",
                "INVALID_EMBEDDING",
                field_name,
            )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Array Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_tags(tags: List[str], field_name: str = "tags") -> None:
    """
    Validates tags array contains non-empty strings.

    Args:
        tags: Tags list to validate
        field_name: Name of the field being validated

    Raises:
        VectorValidationError: If tags are invalid
    """
    if not isinstance(tags, list):
        raise VectorValidationError(
            f"{field_name} must be a list", "INVALID_FORMAT", field_name
        )

    for i, tag in enumerate(tags):
        if not isinstance(tag, str) or tag.strip() == "":
            raise VectorValidationError(
                f"{field_name}[{i}] must be a non-empty string",
                "INVALID_FORMAT",
                field_name,
            )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Structural Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_store_memory_input(input: StoreMemoryInput) -> None:
    """
    Validates StoreMemoryInput structure.

    Args:
        input: StoreMemoryInput to validate

    Raises:
        VectorValidationError: If input is invalid
    """
    # Required fields
    validate_content(input.content)
    validate_content_type(input.content_type)

    if not input.source:
        raise VectorValidationError(
            "source is required", "MISSING_REQUIRED_FIELD", "source"
        )

    # Handle both dict and object access for source
    source_type = input.source.get("type") if isinstance(input.source, dict) else input.source.type
    if source_type is None:
        raise VectorValidationError(
            "source.type is required", "MISSING_REQUIRED_FIELD", "source.type"
        )
    validate_source_type(str(source_type))

    if not input.metadata:
        raise VectorValidationError(
            "metadata is required", "MISSING_REQUIRED_FIELD", "metadata"
        )

    # Handle both dict and object access for metadata
    importance = input.metadata.get("importance") if isinstance(input.metadata, dict) else input.metadata.importance
    if importance is None:
        raise VectorValidationError(
            "metadata.importance is required", "MISSING_REQUIRED_FIELD", "metadata.importance"
        )
    tags = input.metadata.get("tags") if isinstance(input.metadata, dict) else input.metadata.tags
    if tags is None:
        raise VectorValidationError(
            "metadata.tags is required", "MISSING_REQUIRED_FIELD", "metadata.tags"
        )
    validate_importance(int(importance) if isinstance(importance, (int, float)) else importance)
    validate_tags(list(tags) if isinstance(tags, list) else tags)

    # Optional fields validation
    if input.embedding is not None:
        validate_embedding(input.embedding)

    if input.user_id is not None:
        validate_user_id(input.user_id, "user_id")

    if input.participant_id is not None:
        if not isinstance(input.participant_id, str) or input.participant_id.strip() == "":
            raise VectorValidationError(
                "participant_id must be a non-empty string if provided",
                "INVALID_FORMAT",
                "participant_id",
            )


def validate_search_options(options: SearchOptions) -> None:
    """
    Validates SearchOptions.

    Args:
        options: SearchOptions to validate

    Raises:
        VectorValidationError: If options are invalid
    """
    if options.embedding is not None:
        validate_embedding(options.embedding)

    if options.min_score is not None:
        validate_min_score(options.min_score)

    if options.limit is not None:
        validate_limit(options.limit)

    if options.tags is not None:
        validate_tags(options.tags)

    if options.min_importance is not None:
        validate_importance(options.min_importance, "min_importance")

    if options.user_id is not None:
        validate_user_id(options.user_id, "user_id")

    if options.source_type is not None:
        validate_source_type(options.source_type)


def validate_update_options(updates: Dict[str, Any]) -> None:
    """
    Validates update options has at least one field.

    Args:
        updates: Updates dictionary to validate

    Raises:
        VectorValidationError: If updates are invalid
    """
    has_updates = (
        "content" in updates
        or "embedding" in updates
        or "importance" in updates
        or "tags" in updates
    )

    if not has_updates:
        raise VectorValidationError(
            "At least one update field must be provided (content, embedding, importance, or tags)",
            "INVALID_FORMAT",
        )

    # Validate individual fields if present
    if "content" in updates:
        validate_content(updates["content"])

    if "embedding" in updates:
        validate_embedding(updates["embedding"])

    if "importance" in updates:
        validate_importance(updates["importance"])

    if "tags" in updates:
        validate_tags(updates["tags"])
