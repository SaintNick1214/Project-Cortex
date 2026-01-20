"""
Artifacts API Validation

Client-side validation for artifacts operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

import re
from typing import Any, List, Optional

from ..types import ArtifactKind, StreamingState


class ArtifactsValidationError(Exception):
    """Custom exception for artifacts validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize artifacts validation error.

        Args:
            message: Human-readable error message
            code: Error code for programmatic handling
            field: Optional field name that failed validation
        """
        self.code = code
        self.field = field
        super().__init__(message)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Constants
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ARTIFACT_ID_MIN_LENGTH = 1
ARTIFACT_ID_MAX_LENGTH = 100
TITLE_MIN_LENGTH = 1
TITLE_MAX_LENGTH = 500
CONTENT_MAX_SIZE = 10485760  # 10MB in bytes
MAX_TAGS = 50
TAG_MAX_LENGTH = 100
MAX_LIMIT = 1000

# Valid kind values (from unified specification)
VALID_KINDS: List[ArtifactKind] = ["text", "code", "sheet", "image", "diagram", "html", "custom"]

# Valid streaming state values (from unified specification)
VALID_STREAMING_STATES: List[StreamingState] = ["draft", "streaming", "paused", "final", "error"]

# Valid sort fields
VALID_SORT_BY = ["createdAt", "updatedAt", "title"]
VALID_SORT_ORDER = ["asc", "desc"]

# Regex patterns
# 1-100 chars, alphanumeric + `-_.:` per unified specification
ARTIFACT_ID_PATTERN = re.compile(r"^[a-zA-Z0-9\-_.:]+$")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Required Field Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_artifact_id(artifact_id: Any, field_name: str = "artifact_id") -> None:
    """
    Validates artifact_id is non-empty string with valid format.

    Args:
        artifact_id: Value to validate
        field_name: Field name for error messages

    Raises:
        ArtifactsValidationError: If artifact_id is invalid
    """
    if artifact_id is None:
        raise ArtifactsValidationError(
            f"{field_name} is required",
            "MISSING_ARTIFACT_ID",
            field_name,
        )

    if not isinstance(artifact_id, str):
        raise ArtifactsValidationError(
            f"{field_name} must be a string, got {type(artifact_id).__name__}",
            "INVALID_ARTIFACT_ID_TYPE",
            field_name,
        )

    if not artifact_id.strip():
        raise ArtifactsValidationError(
            f"{field_name} cannot be empty",
            "EMPTY_ARTIFACT_ID",
            field_name,
        )

    if len(artifact_id) < ARTIFACT_ID_MIN_LENGTH:
        raise ArtifactsValidationError(
            f"{field_name} must be at least {ARTIFACT_ID_MIN_LENGTH} character(s)",
            "ARTIFACT_ID_TOO_SHORT",
            field_name,
        )

    if len(artifact_id) > ARTIFACT_ID_MAX_LENGTH:
        raise ArtifactsValidationError(
            f"{field_name} exceeds maximum length of {ARTIFACT_ID_MAX_LENGTH} characters (got {len(artifact_id)})",
            "ARTIFACT_ID_TOO_LONG",
            field_name,
        )

    if not ARTIFACT_ID_PATTERN.match(artifact_id):
        raise ArtifactsValidationError(
            f'Invalid {field_name} format "{artifact_id}". Must contain only alphanumeric characters, hyphens, underscores, dots, and colons',
            "INVALID_ARTIFACT_ID_FORMAT",
            field_name,
        )


def validate_title(title: Any, required: bool = True) -> None:
    """
    Validates title is a valid string (1-500 chars, non-empty).

    Args:
        title: Value to validate
        required: Whether the field is required

    Raises:
        ArtifactsValidationError: If title is invalid
    """
    if title is None:
        if required:
            raise ArtifactsValidationError(
                "title is required",
                "MISSING_TITLE",
                "title",
            )
        return  # Optional and not provided

    if not isinstance(title, str):
        raise ArtifactsValidationError(
            f"title must be a string, got {type(title).__name__}",
            "INVALID_TITLE_TYPE",
            "title",
        )

    if not title.strip():
        raise ArtifactsValidationError(
            "title cannot be empty",
            "EMPTY_TITLE",
            "title",
        )

    if len(title) < TITLE_MIN_LENGTH:
        raise ArtifactsValidationError(
            f"title must be at least {TITLE_MIN_LENGTH} character(s)",
            "TITLE_TOO_SHORT",
            "title",
        )

    if len(title) > TITLE_MAX_LENGTH:
        raise ArtifactsValidationError(
            f"title exceeds maximum length of {TITLE_MAX_LENGTH} characters (got {len(title)})",
            "TITLE_TOO_LONG",
            "title",
        )


def validate_content(content: Any, required: bool = True) -> None:
    """
    Validates content is a valid string within size limits (max 10MB).

    Args:
        content: Value to validate
        required: Whether the field is required

    Raises:
        ArtifactsValidationError: If content is invalid
    """
    if content is None:
        if required:
            raise ArtifactsValidationError(
                "content is required",
                "MISSING_CONTENT",
                "content",
            )
        return  # Optional and not provided

    if not isinstance(content, str):
        raise ArtifactsValidationError(
            f"content must be a string, got {type(content).__name__}",
            "INVALID_CONTENT_TYPE",
            "content",
        )

    # Check size in bytes
    content_bytes = len(content.encode('utf-8'))
    if content_bytes > CONTENT_MAX_SIZE:
        size_mb = content_bytes / 1048576
        raise ArtifactsValidationError(
            f"content exceeds maximum size of 10MB (got {size_mb:.2f}MB)",
            "CONTENT_TOO_LARGE",
            "content",
        )


def validate_kind(kind: Any, required: bool = True) -> None:
    """
    Validates kind is a valid ArtifactKind.

    Args:
        kind: Value to validate
        required: Whether the field is required

    Raises:
        ArtifactsValidationError: If kind is invalid
    """
    if kind is None:
        if required:
            raise ArtifactsValidationError(
                "kind is required",
                "MISSING_KIND",
                "kind",
            )
        return  # Optional

    if not isinstance(kind, str):
        raise ArtifactsValidationError(
            f"kind must be a string, got {type(kind).__name__}",
            "INVALID_KIND_TYPE",
            "kind",
        )

    if kind not in VALID_KINDS:
        raise ArtifactsValidationError(
            f'kind must be one of: {", ".join(VALID_KINDS)}. Got "{kind}"',
            "INVALID_KIND_VALUE",
            "kind",
        )


def validate_streaming_state(streaming_state: Any, required: bool = False) -> None:
    """
    Validates streaming_state is a valid StreamingState.

    Args:
        streaming_state: Value to validate
        required: Whether the field is required

    Raises:
        ArtifactsValidationError: If streaming_state is invalid
    """
    if streaming_state is None:
        if required:
            raise ArtifactsValidationError(
                "streaming_state is required",
                "MISSING_STREAMING_STATE",
                "streaming_state",
            )
        return  # Optional

    if not isinstance(streaming_state, str):
        raise ArtifactsValidationError(
            f"streaming_state must be a string, got {type(streaming_state).__name__}",
            "INVALID_STREAMING_STATE_TYPE",
            "streaming_state",
        )

    if streaming_state not in VALID_STREAMING_STATES:
        raise ArtifactsValidationError(
            f'streaming_state must be one of: {", ".join(VALID_STREAMING_STATES)}. Got "{streaming_state}"',
            "INVALID_STREAMING_STATE_VALUE",
            "streaming_state",
        )


def validate_tags(tags: Any) -> None:
    """
    Validates tags is a valid list of strings (max 50 tags, each max 100 chars).

    Args:
        tags: Value to validate

    Raises:
        ArtifactsValidationError: If tags is invalid
    """
    if tags is None:
        return  # Optional

    if not isinstance(tags, list):
        raise ArtifactsValidationError(
            f"tags must be a list, got {type(tags).__name__}",
            "INVALID_TAGS_TYPE",
            "tags",
        )

    if len(tags) > MAX_TAGS:
        raise ArtifactsValidationError(
            f"tags exceeds maximum of {MAX_TAGS} items (got {len(tags)})",
            "TOO_MANY_TAGS",
            "tags",
        )

    for i, tag in enumerate(tags):
        if not isinstance(tag, str):
            raise ArtifactsValidationError(
                f"tags[{i}] must be a string, got {type(tag).__name__}",
                "INVALID_TAG_TYPE",
                f"tags[{i}]",
            )

        if not tag.strip():
            raise ArtifactsValidationError(
                f"tags[{i}] cannot be empty",
                "EMPTY_TAG",
                f"tags[{i}]",
            )

        if len(tag) > TAG_MAX_LENGTH:
            raise ArtifactsValidationError(
                f"tags[{i}] exceeds maximum length of {TAG_MAX_LENGTH} characters",
                "TAG_TOO_LONG",
                f"tags[{i}]",
            )


def validate_file_reference(file_ref: Any, field_name: str = "file_ref") -> None:
    """
    Validates file_ref has required fields matching Convex backend schema.

    Args:
        file_ref: Value to validate
        field_name: Field name for error messages

    Raises:
        ArtifactsValidationError: If file_ref is invalid
    """
    if file_ref is None:
        raise ArtifactsValidationError(
            f"{field_name} is required",
            "MISSING_FILE_REF",
            field_name,
        )

    # Check required fields (matches Convex backend setFileRef schema)
    required_fields = ["storage_id", "mime_type", "size"]
    for req_field in required_fields:
        if not hasattr(file_ref, req_field) or getattr(file_ref, req_field) is None:
            raise ArtifactsValidationError(
                f'{field_name} is missing required field "{req_field}"',
                "MISSING_FILE_REF_FIELD",
                f"{field_name}.{req_field}",
            )

    # Validate size is positive
    if hasattr(file_ref, "size") and file_ref.size <= 0:
        raise ArtifactsValidationError(
            f'{field_name}.size must be positive',
            "INVALID_FILE_SIZE",
            f"{field_name}.size",
        )


def validate_version(version: Any, field_name: str = "version") -> None:
    """
    Validates version is a positive integer.

    Args:
        version: Value to validate
        field_name: Field name for error messages

    Raises:
        ArtifactsValidationError: If version is invalid
    """
    if version is None:
        raise ArtifactsValidationError(
            f"{field_name} is required",
            "MISSING_VERSION",
            field_name,
        )

    if not isinstance(version, int):
        raise ArtifactsValidationError(
            f"{field_name} must be an integer, got {type(version).__name__}",
            "INVALID_VERSION_TYPE",
            field_name,
        )

    if version < 1:
        raise ArtifactsValidationError(
            f"{field_name} must be at least 1, got {version}",
            "INVALID_VERSION_RANGE",
            field_name,
        )


def validate_session_id(session_id: Any, field_name: str = "session_id") -> None:
    """
    Validates session_id is a non-empty string.

    Args:
        session_id: Value to validate
        field_name: Field name for error messages

    Raises:
        ArtifactsValidationError: If session_id is invalid
    """
    if session_id is None:
        raise ArtifactsValidationError(
            f"{field_name} is required",
            "MISSING_SESSION_ID",
            field_name,
        )

    if not isinstance(session_id, str):
        raise ArtifactsValidationError(
            f"{field_name} must be a string, got {type(session_id).__name__}",
            "INVALID_SESSION_ID_TYPE",
            field_name,
        )

    if not session_id.strip():
        raise ArtifactsValidationError(
            f"{field_name} cannot be empty",
            "EMPTY_SESSION_ID",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Range Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_limit(limit: Any) -> None:
    """
    Validates limit is positive integer <= 1000.

    Args:
        limit: Limit value to validate

    Raises:
        ArtifactsValidationError: If limit is invalid
    """
    if limit is None:
        return  # Optional

    if not isinstance(limit, int):
        raise ArtifactsValidationError(
            f"limit must be an integer, got {type(limit).__name__}",
            "INVALID_LIMIT_TYPE",
            "limit",
        )

    if limit < 1:
        raise ArtifactsValidationError(
            f"limit must be at least 1, got {limit}",
            "INVALID_LIMIT_RANGE",
            "limit",
        )

    if limit > MAX_LIMIT:
        raise ArtifactsValidationError(
            f"limit exceeds maximum of {MAX_LIMIT}, got {limit}",
            "INVALID_LIMIT_RANGE",
            "limit",
        )


def validate_offset(offset: Any) -> None:
    """
    Validates offset is non-negative integer.

    Args:
        offset: Offset value to validate

    Raises:
        ArtifactsValidationError: If offset is invalid
    """
    if offset is None:
        return  # Optional

    if not isinstance(offset, int):
        raise ArtifactsValidationError(
            f"offset must be an integer, got {type(offset).__name__}",
            "INVALID_OFFSET_TYPE",
            "offset",
        )

    if offset < 0:
        raise ArtifactsValidationError(
            f"offset must be non-negative, got {offset}",
            "INVALID_OFFSET_RANGE",
            "offset",
        )


def validate_timestamp(timestamp: Any, field_name: str) -> None:
    """
    Validates timestamp is a valid Unix timestamp.

    Args:
        timestamp: Timestamp to validate
        field_name: Field name for error messages

    Raises:
        ArtifactsValidationError: If timestamp is invalid
    """
    if timestamp is None:
        return  # Optional

    if not isinstance(timestamp, (int, float)):
        raise ArtifactsValidationError(
            f"{field_name} must be a number, got {type(timestamp).__name__}",
            "INVALID_TIMESTAMP_TYPE",
            field_name,
        )

    if timestamp < 0:
        raise ArtifactsValidationError(
            f"{field_name} must be a valid Unix timestamp (positive number), got {timestamp}",
            "INVALID_TIMESTAMP_VALUE",
            field_name,
        )


def validate_sort_by(sort_by: Any) -> None:
    """
    Validates sort_by is a valid sort field.

    Args:
        sort_by: Sort field to validate

    Raises:
        ArtifactsValidationError: If sort_by is invalid
    """
    if sort_by is None:
        return  # Optional

    if not isinstance(sort_by, str):
        raise ArtifactsValidationError(
            f"sort_by must be a string, got {type(sort_by).__name__}",
            "INVALID_SORT_BY_TYPE",
            "sort_by",
        )

    if sort_by not in VALID_SORT_BY:
        raise ArtifactsValidationError(
            f'sort_by must be one of: {", ".join(VALID_SORT_BY)}. Got "{sort_by}"',
            "INVALID_SORT_BY_VALUE",
            "sort_by",
        )


def validate_sort_order(sort_order: Any) -> None:
    """
    Validates sort_order is a valid sort direction.

    Args:
        sort_order: Sort order to validate

    Raises:
        ArtifactsValidationError: If sort_order is invalid
    """
    if sort_order is None:
        return  # Optional

    if not isinstance(sort_order, str):
        raise ArtifactsValidationError(
            f"sort_order must be a string, got {type(sort_order).__name__}",
            "INVALID_SORT_ORDER_TYPE",
            "sort_order",
        )

    if sort_order not in VALID_SORT_ORDER:
        raise ArtifactsValidationError(
            f'sort_order must be one of: {", ".join(VALID_SORT_ORDER)}. Got "{sort_order}"',
            "INVALID_SORT_ORDER_VALUE",
            "sort_order",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Composite Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_create_options(options: Any) -> None:
    """
    Validates CreateArtifactOptions structure.

    Args:
        options: Options object to validate

    Raises:
        ArtifactsValidationError: If options are invalid
    """
    if options is None:
        raise ArtifactsValidationError(
            "options is required",
            "MISSING_OPTIONS",
            "options",
        )

    # Required fields
    validate_title(getattr(options, "title", None), required=True)
    validate_content(getattr(options, "content", None), required=True)

    # Optional fields with defaults
    validate_kind(getattr(options, "kind", None), required=False)
    validate_streaming_state(getattr(options, "streaming_state", None), required=False)
    validate_tags(getattr(options, "tags", None))

    # If artifact_id is provided, validate it
    artifact_id = getattr(options, "artifact_id", None)
    if artifact_id is not None:
        validate_artifact_id(artifact_id)


def validate_update_options(options: Any) -> None:
    """
    Validates UpdateArtifactOptions structure.

    Args:
        options: Options object to validate

    Raises:
        ArtifactsValidationError: If options are invalid
    """
    if options is None:
        return  # Optional parameter

    validate_title(getattr(options, "title", None), required=False)
    validate_tags(getattr(options, "tags", None))


def validate_list_filter(filter_obj: Any) -> None:
    """
    Validates ListArtifactsFilter structure.

    Args:
        filter_obj: Filter object to validate

    Raises:
        ArtifactsValidationError: If filter is invalid
    """
    if filter_obj is None:
        raise ArtifactsValidationError(
            "filter is required",
            "MISSING_FILTER",
            "filter",
        )

    # Validate individual fields
    validate_kind(getattr(filter_obj, "kind", None), required=False)
    validate_streaming_state(getattr(filter_obj, "streaming_state", None), required=False)
    validate_tags(getattr(filter_obj, "tags", None))
    validate_limit(getattr(filter_obj, "limit", None))
    validate_offset(getattr(filter_obj, "offset", None))
    validate_timestamp(getattr(filter_obj, "created_after", None), "filter.created_after")
    validate_timestamp(getattr(filter_obj, "created_before", None), "filter.created_before")
    validate_timestamp(getattr(filter_obj, "updated_after", None), "filter.updated_after")
    validate_timestamp(getattr(filter_obj, "updated_before", None), "filter.updated_before")
    validate_sort_by(getattr(filter_obj, "sort_by", None))
    validate_sort_order(getattr(filter_obj, "sort_order", None))


def validate_count_filter(filter_obj: Any) -> None:
    """
    Validates CountArtifactsFilter structure.

    Args:
        filter_obj: Filter object to validate

    Raises:
        ArtifactsValidationError: If filter is invalid
    """
    if filter_obj is None:
        raise ArtifactsValidationError(
            "filter is required",
            "MISSING_FILTER",
            "filter",
        )

    validate_kind(getattr(filter_obj, "kind", None), required=False)
    validate_streaming_state(getattr(filter_obj, "streaming_state", None), required=False)
    validate_tags(getattr(filter_obj, "tags", None))
    validate_timestamp(getattr(filter_obj, "created_after", None), "filter.created_after")
    validate_timestamp(getattr(filter_obj, "created_before", None), "filter.created_before")


def validate_start_streaming_params(params: Any) -> None:
    """
    Validates StartStreamingParams structure.

    Args:
        params: Params object to validate

    Raises:
        ArtifactsValidationError: If params are invalid
    """
    if params is None:
        raise ArtifactsValidationError(
            "params is required",
            "MISSING_PARAMS",
            "params",
        )

    validate_artifact_id(getattr(params, "artifact_id", None))


def validate_append_content_params(params: Any) -> None:
    """
    Validates AppendContentParams structure.

    Args:
        params: Params object to validate

    Raises:
        ArtifactsValidationError: If params are invalid
    """
    if params is None:
        raise ArtifactsValidationError(
            "params is required",
            "MISSING_PARAMS",
            "params",
        )

    validate_artifact_id(getattr(params, "artifact_id", None))
    validate_session_id(getattr(params, "session_id", None))

    # Content chunk is required
    chunk = getattr(params, "chunk", None)
    if chunk is None:
        raise ArtifactsValidationError(
            "chunk is required",
            "MISSING_CHUNK",
            "chunk",
        )
    if not isinstance(chunk, str):
        raise ArtifactsValidationError(
            f"chunk must be a string, got {type(chunk).__name__}",
            "INVALID_CHUNK_TYPE",
            "chunk",
        )
