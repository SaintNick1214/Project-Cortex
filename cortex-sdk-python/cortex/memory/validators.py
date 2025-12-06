"""
Memory API Validation

Client-side validation for memory operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

import math
import re
from typing import Any, Dict, List, Optional, Union

from ..types import RememberParams, SearchOptions, SourceType, StoreMemoryInput


class MemoryValidationError(Exception):
    """Custom exception for memory validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize memory validation error.

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
        MemoryValidationError: If memory_space_id is invalid
    """
    if not isinstance(memory_space_id, str):
        raise MemoryValidationError(
            f"{field_name} is required and must be a string",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )

    if memory_space_id.strip() == "":
        raise MemoryValidationError(
            f"{field_name} cannot be empty", "MISSING_REQUIRED_FIELD", field_name
        )


def validate_memory_id(memory_id: str, field_name: str = "memory_id") -> None:
    """
    Validates memory_id is non-empty string.

    Args:
        memory_id: Memory ID to validate
        field_name: Name of the field being validated

    Raises:
        MemoryValidationError: If memory_id is invalid
    """
    if not isinstance(memory_id, str):
        raise MemoryValidationError(
            f"{field_name} is required and must be a string",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )

    if memory_id.strip() == "":
        raise MemoryValidationError(
            f"{field_name} cannot be empty", "MISSING_REQUIRED_FIELD", field_name
        )


def validate_user_id(user_id: str, field_name: str = "user_id") -> None:
    """
    Validates user_id is non-empty string.

    Args:
        user_id: User ID to validate
        field_name: Name of the field being validated

    Raises:
        MemoryValidationError: If user_id is invalid
    """
    if not isinstance(user_id, str):
        raise MemoryValidationError(
            f"{field_name} is required and must be a string",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )

    if user_id.strip() == "":
        raise MemoryValidationError(
            f"{field_name} cannot be empty", "MISSING_REQUIRED_FIELD", field_name
        )


def validate_conversation_id(
    conversation_id: str, field_name: str = "conversation_id"
) -> None:
    """
    Validates conversation_id is non-empty string.

    Args:
        conversation_id: Conversation ID to validate
        field_name: Name of the field being validated

    Raises:
        MemoryValidationError: If conversation_id is invalid
    """
    if not isinstance(conversation_id, str):
        raise MemoryValidationError(
            f"{field_name} is required and must be a string",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )

    if conversation_id.strip() == "":
        raise MemoryValidationError(
            f"{field_name} cannot be empty", "MISSING_REQUIRED_FIELD", field_name
        )


def validate_content(content: str, field_name: str = "content") -> None:
    """
    Validates content is non-empty string.

    Args:
        content: Content to validate
        field_name: Name of the field being validated

    Raises:
        MemoryValidationError: If content is invalid
    """
    if not isinstance(content, str):
        raise MemoryValidationError(
            f"{field_name} is required and must be a string",
            "MISSING_REQUIRED_FIELD",
            field_name,
        )

    if content.strip() == "":
        raise MemoryValidationError(
            f"{field_name} cannot be empty", "MISSING_REQUIRED_FIELD", field_name
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Format Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID_FORMAT_REGEX = re.compile(r"^[a-zA-Z0-9_-]+$")


def validate_id_format(id: str, field_name: str) -> None:
    """
    Validates ID format (alphanumeric, hyphens, underscores).

    Args:
        id: ID to validate
        field_name: Name of the field being validated

    Raises:
        MemoryValidationError: If ID format is invalid
    """
    if not ID_FORMAT_REGEX.match(id):
        raise MemoryValidationError(
            f"{field_name} contains invalid characters. Only alphanumeric, hyphens, and underscores are allowed",
            "INVALID_ID_FORMAT",
            field_name,
        )


VALID_CONTENT_TYPES = ["raw", "summarized", "fact"]


def validate_content_type(content_type: str) -> None:
    """
    Validates content_type is one of allowed values.

    Args:
        content_type: Content type to validate

    Raises:
        MemoryValidationError: If content_type is invalid
    """
    if content_type not in VALID_CONTENT_TYPES:
        raise MemoryValidationError(
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
        MemoryValidationError: If source_type is invalid
    """
    if source_type not in VALID_SOURCE_TYPES:
        raise MemoryValidationError(
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
        MemoryValidationError: If format is invalid
    """
    if format not in VALID_EXPORT_FORMATS:
        raise MemoryValidationError(
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
        MemoryValidationError: If importance is invalid
    """
    if not isinstance(importance, (int, float)) or math.isnan(importance):
        raise MemoryValidationError(
            f"{field_name} must be a number", "INVALID_IMPORTANCE", field_name
        )

    if importance < 0 or importance > 100:
        raise MemoryValidationError(
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
        MemoryValidationError: If version is invalid
    """
    if not isinstance(version, (int, float)) or math.isnan(version):
        raise MemoryValidationError(
            f"{field_name} must be a number", "NEGATIVE_NUMBER", field_name
        )

    if version < 1 or not float(version).is_integer():
        raise MemoryValidationError(
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
        MemoryValidationError: If limit is invalid
    """
    if not isinstance(limit, (int, float)) or math.isnan(limit):
        raise MemoryValidationError(
            f"{field_name} must be a number", "NEGATIVE_NUMBER", field_name
        )

    if limit < 1:
        raise MemoryValidationError(
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
        MemoryValidationError: If timestamp is invalid
    """
    if not isinstance(timestamp, (int, float)) or math.isnan(timestamp):
        raise MemoryValidationError(
            f"{field_name} must be a valid timestamp (number)",
            "INVALID_TIMESTAMP",
            field_name,
        )

    if timestamp < 0:
        raise MemoryValidationError(
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
        MemoryValidationError: If min_score is invalid
    """
    if not isinstance(min_score, (int, float)) or math.isnan(min_score):
        raise MemoryValidationError(
            f"{field_name} must be a number", "INVALID_FORMAT", field_name
        )

    if min_score < 0 or min_score > 1:
        raise MemoryValidationError(
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
        MemoryValidationError: If embedding is invalid
    """
    if not isinstance(embedding, list):
        raise MemoryValidationError(
            f"{field_name} must be a list of numbers", "INVALID_EMBEDDING", field_name
        )

    if len(embedding) == 0:
        raise MemoryValidationError(
            f"{field_name} cannot be empty", "INVALID_EMBEDDING", field_name
        )

    for i, value in enumerate(embedding):
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            raise MemoryValidationError(
                f"{field_name}[{i}] must be a finite number, got {value}",
                "INVALID_EMBEDDING",
                field_name,
            )


def validate_embedding_dimension(
    embedding: List[Union[int, float]], expected_dim: int
) -> None:
    """
    Validates embedding dimension matches expected.

    Args:
        embedding: Embedding vector to validate
        expected_dim: Expected dimension

    Raises:
        MemoryValidationError: If dimension mismatch
    """
    if len(embedding) != expected_dim:
        raise MemoryValidationError(
            f"Embedding dimension mismatch: expected {expected_dim}, got {len(embedding)}",
            "INVALID_EMBEDDING",
            "embedding",
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
        MemoryValidationError: If tags are invalid
    """
    if not isinstance(tags, list):
        raise MemoryValidationError(
            f"{field_name} must be a list", "INVALID_FORMAT", field_name
        )

    for i, tag in enumerate(tags):
        if not isinstance(tag, str) or tag.strip() == "":
            raise MemoryValidationError(
                f"{field_name}[{i}] must be a non-empty string",
                "INVALID_FORMAT",
                field_name,
            )


def validate_message_ids(
    message_ids: List[str], field_name: str = "message_ids"
) -> None:
    """
    Validates message_ids array is non-empty with non-empty strings.

    Args:
        message_ids: Message IDs list to validate
        field_name: Name of the field being validated

    Raises:
        MemoryValidationError: If message_ids are invalid
    """
    if not isinstance(message_ids, list):
        raise MemoryValidationError(
            f"{field_name} must be a list", "INVALID_FORMAT", field_name
        )

    if len(message_ids) == 0:
        raise MemoryValidationError(
            f"{field_name} cannot be empty", "EMPTY_ARRAY", field_name
        )

    for i, id in enumerate(message_ids):
        if not isinstance(id, str) or id.strip() == "":
            raise MemoryValidationError(
                f"{field_name}[{i}] must be a non-empty string",
                "INVALID_FORMAT",
                field_name,
            )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Structural Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_remember_params(params: RememberParams) -> None:
    """
    Validates RememberParams structure.

    Args:
        params: RememberParams to validate

    Raises:
        MemoryValidationError: If params are invalid

    Ownership rules:
        - Either user_id or agent_id must be provided
        - If user_id is provided, agent_id is also required (user-agent conversations)
        - If user_id is provided, user_name is required
    """
    # Required fields (always)
    validate_memory_space_id(params.memory_space_id)
    validate_conversation_id(params.conversation_id)
    validate_content(params.user_message, "user_message")
    validate_content(params.agent_response, "agent_response")

    # Owner validation
    has_user_id = params.user_id and isinstance(params.user_id, str) and params.user_id.strip() != ""
    has_agent_id = params.agent_id and isinstance(params.agent_id, str) and params.agent_id.strip() != ""

    # Either user_id or agent_id must be provided
    if not has_user_id and not has_agent_id:
        raise MemoryValidationError(
            "Either user_id or agent_id must be provided for memory ownership. "
            "Use user_id for user-owned memories, agent_id for agent-owned memories.",
            "OWNER_REQUIRED",
            "user_id/agent_id",
        )

    # If user_id is provided, agent_id is required (user-agent conversations)
    if has_user_id and not has_agent_id:
        raise MemoryValidationError(
            "agent_id is required when user_id is provided. "
            "User-agent conversations require both a user and an agent participant.",
            "AGENT_REQUIRED_FOR_USER_CONVERSATION",
            "agent_id",
        )

    # If user_id is provided, user_name is required
    if has_user_id:
        if not params.user_name or not isinstance(params.user_name, str):
            raise MemoryValidationError(
                "user_name is required when user_id is provided",
                "MISSING_REQUIRED_FIELD",
                "user_name",
            )
        if params.user_name.strip() == "":
            raise MemoryValidationError(
                "user_name cannot be empty when user_id is provided",
                "MISSING_REQUIRED_FIELD",
                "user_name",
            )

    # Optional fields validation
    if params.importance is not None:
        validate_importance(params.importance)

    if params.tags is not None:
        validate_tags(params.tags)

    if params.participant_id is not None:
        if not isinstance(params.participant_id, str) or params.participant_id.strip() == "":
            raise MemoryValidationError(
                "participant_id must be a non-empty string if provided",
                "INVALID_FORMAT",
                "participant_id",
            )


def validate_store_memory_input(input: StoreMemoryInput) -> None:
    """
    Validates StoreMemoryInput structure.

    Args:
        input: StoreMemoryInput to validate

    Raises:
        MemoryValidationError: If input is invalid
    """
    # Required fields
    validate_content(input.content)
    validate_content_type(input.content_type)

    if not input.source:
        raise MemoryValidationError(
            "source is required", "MISSING_REQUIRED_FIELD", "source"
        )

    validate_source_type(input.source.type)

    if not input.metadata:
        raise MemoryValidationError(
            "metadata is required", "MISSING_REQUIRED_FIELD", "metadata"
        )

    validate_importance(input.metadata.importance)
    validate_tags(input.metadata.tags)

    # Optional fields validation
    if input.embedding is not None:
        validate_embedding(input.embedding)

    if input.user_id is not None:
        validate_user_id(input.user_id, "user_id")

    if input.participant_id is not None:
        if not isinstance(input.participant_id, str) or input.participant_id.strip() == "":
            raise MemoryValidationError(
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
        MemoryValidationError: If options are invalid
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
        MemoryValidationError: If updates are invalid
    """
    has_updates = (
        "content" in updates
        or "embedding" in updates
        or "importance" in updates
        or "tags" in updates
    )

    if not has_updates:
        raise MemoryValidationError(
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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Business Logic Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_conversation_ref_requirement(
    source_type: SourceType, conversation_ref: Any
) -> None:
    """
    Validates conversation_ref is required when source_type is conversation.

    Args:
        source_type: Source type
        conversation_ref: Conversation reference

    Raises:
        MemoryValidationError: If conversation_ref is missing
    """
    if source_type == "conversation" and not conversation_ref:
        raise MemoryValidationError(
            'conversation_ref is required when source.type is "conversation"',
            "MISSING_CONVERSATION_REF",
            "conversation_ref",
        )


def validate_stream_object(stream: Any) -> None:
    """
    Validates stream object is valid AsyncIterable.

    Args:
        stream: Stream object to validate

    Raises:
        MemoryValidationError: If stream is invalid
    """
    if stream is None or not hasattr(stream, "__aiter__"):
        raise MemoryValidationError(
            "response_stream must be an AsyncIterable object with __aiter__",
            "INVALID_STREAM",
            "response_stream",
        )


def validate_filter_combination(filter_dict: Dict[str, Any]) -> None:
    """
    Validates filter has at least one criterion beyond memory_space_id.

    Args:
        filter_dict: Filter dictionary to validate

    Raises:
        MemoryValidationError: If filter is too broad
    """
    # For delete_many, we require at least one additional filter
    # to prevent accidental mass deletion
    has_additional_filter = "user_id" in filter_dict or "source_type" in filter_dict

    if not has_additional_filter:
        raise MemoryValidationError(
            "Filter must include at least one criterion (user_id or source_type) in addition to memory_space_id to prevent accidental mass deletion",
            "INVALID_FILTER",
        )
