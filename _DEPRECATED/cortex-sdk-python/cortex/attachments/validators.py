"""
Attachments API Validation

Client-side validation for attachment operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

from typing import Any, List, Optional

from ..types import AttachmentType

__all__ = [
    "AttachmentValidationError",
    "validate_attachment_id",
    "validate_storage_id",
    "validate_memory_space_id",
    "validate_user_id",
    "validate_attachment_type",
    "validate_mime_type",
    "validate_filename",
    "validate_file_size",
    "validate_dimensions",
    "validate_duration",
    "validate_limit",
    "validate_attach_params",
    "validate_list_attachments_filter",
    "validate_attachment_ids",
]


class AttachmentValidationError(Exception):
    """Custom exception for attachment validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize attachment validation error.

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

ATTACHMENT_ID_MAX_LENGTH = 100
FILENAME_MAX_LENGTH = 255
MAX_LIMIT = 1000

# Valid attachment types
VALID_ATTACHMENT_TYPES: List[AttachmentType] = ["image", "audio", "video", "file", "pdf"]

# Valid sort fields
VALID_SORT_BY = ["createdAt", "updatedAt"]
VALID_SORT_ORDER = ["asc", "desc"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Required Field Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_attachment_id(attachment_id: Any, field_name: str = "attachment_id") -> None:
    """
    Validates attachment_id is non-empty string.

    Args:
        attachment_id: Value to validate
        field_name: Field name for error messages

    Raises:
        AttachmentValidationError: If attachment_id is invalid
    """
    if attachment_id is None:
        raise AttachmentValidationError(
            f"{field_name} is required",
            "MISSING_ATTACHMENT_ID",
            field_name,
        )

    if not isinstance(attachment_id, str):
        raise AttachmentValidationError(
            f"{field_name} must be a string, got {type(attachment_id).__name__}",
            "INVALID_ATTACHMENT_ID",
            field_name,
        )

    if not attachment_id.strip():
        raise AttachmentValidationError(
            f"{field_name} is required and cannot be empty",
            "MISSING_ATTACHMENT_ID",
            field_name,
        )

    if len(attachment_id) > ATTACHMENT_ID_MAX_LENGTH:
        raise AttachmentValidationError(
            f"{field_name} exceeds maximum length of {ATTACHMENT_ID_MAX_LENGTH} characters",
            "ATTACHMENT_ID_TOO_LONG",
            field_name,
        )


def validate_storage_id(storage_id: Any) -> None:
    """
    Validates storage_id is non-empty string.

    Args:
        storage_id: Value to validate

    Raises:
        AttachmentValidationError: If storage_id is invalid
    """
    if storage_id is None:
        raise AttachmentValidationError(
            "storage_id is required",
            "MISSING_STORAGE_ID",
            "storage_id",
        )

    if not isinstance(storage_id, str):
        raise AttachmentValidationError(
            f"storage_id must be a string, got {type(storage_id).__name__}",
            "INVALID_STORAGE_ID",
            "storage_id",
        )

    if not storage_id.strip():
        raise AttachmentValidationError(
            "storage_id is required and cannot be empty",
            "MISSING_STORAGE_ID",
            "storage_id",
        )


def validate_memory_space_id(memory_space_id: Any) -> None:
    """
    Validates memory_space_id is non-empty string.

    Args:
        memory_space_id: Value to validate

    Raises:
        AttachmentValidationError: If memory_space_id is invalid
    """
    if memory_space_id is None:
        raise AttachmentValidationError(
            "memory_space_id is required",
            "MISSING_MEMORY_SPACE_ID",
            "memory_space_id",
        )

    if not isinstance(memory_space_id, str):
        raise AttachmentValidationError(
            f"memory_space_id must be a string, got {type(memory_space_id).__name__}",
            "INVALID_MEMORY_SPACE_ID",
            "memory_space_id",
        )

    if not memory_space_id.strip():
        raise AttachmentValidationError(
            "memory_space_id is required and cannot be empty",
            "MISSING_MEMORY_SPACE_ID",
            "memory_space_id",
        )


def validate_user_id(user_id: Any) -> None:
    """
    Validates user_id is non-empty string.

    Args:
        user_id: Value to validate

    Raises:
        AttachmentValidationError: If user_id is invalid
    """
    if user_id is None:
        raise AttachmentValidationError(
            "user_id is required",
            "MISSING_USER_ID",
            "user_id",
        )

    if not isinstance(user_id, str):
        raise AttachmentValidationError(
            f"user_id must be a string, got {type(user_id).__name__}",
            "INVALID_USER_ID",
            "user_id",
        )

    if not user_id.strip():
        raise AttachmentValidationError(
            "user_id is required and cannot be empty",
            "MISSING_USER_ID",
            "user_id",
        )


def validate_attachment_type(attachment_type: Any) -> None:
    """
    Validates attachment type is a valid AttachmentType value.

    Args:
        attachment_type: Value to validate

    Raises:
        AttachmentValidationError: If type is invalid
    """
    if attachment_type is None:
        raise AttachmentValidationError(
            "type is required",
            "MISSING_TYPE",
            "type",
        )

    if not isinstance(attachment_type, str):
        raise AttachmentValidationError(
            f"type must be a string, got {type(attachment_type).__name__}",
            "INVALID_TYPE",
            "type",
        )

    if attachment_type not in VALID_ATTACHMENT_TYPES:
        raise AttachmentValidationError(
            f"type must be one of: {', '.join(VALID_ATTACHMENT_TYPES)}. Got '{attachment_type}'",
            "INVALID_TYPE_VALUE",
            "type",
        )


def validate_optional_attachment_type(attachment_type: Any) -> None:
    """
    Validates optional attachment type.

    Args:
        attachment_type: Value to validate (can be None)

    Raises:
        AttachmentValidationError: If type is invalid
    """
    if attachment_type is None:
        return
    validate_attachment_type(attachment_type)


def validate_mime_type(mime_type: Any) -> None:
    """
    Validates mime_type is a valid MIME type format.

    Args:
        mime_type: Value to validate

    Raises:
        AttachmentValidationError: If mime_type is invalid
    """
    if mime_type is None:
        raise AttachmentValidationError(
            "mime_type is required",
            "MISSING_MIME_TYPE",
            "mime_type",
        )

    if not isinstance(mime_type, str):
        raise AttachmentValidationError(
            f"mime_type must be a string, got {type(mime_type).__name__}",
            "INVALID_MIME_TYPE",
            "mime_type",
        )

    if "/" not in mime_type:
        raise AttachmentValidationError(
            "mime_type must be a valid MIME type (e.g., image/png)",
            "INVALID_MIME_TYPE",
            "mime_type",
        )


def validate_filename(filename: Any) -> None:
    """
    Validates filename is non-empty string.

    Args:
        filename: Value to validate

    Raises:
        AttachmentValidationError: If filename is invalid
    """
    if filename is None:
        raise AttachmentValidationError(
            "filename is required",
            "MISSING_FILENAME",
            "filename",
        )

    if not isinstance(filename, str):
        raise AttachmentValidationError(
            f"filename must be a string, got {type(filename).__name__}",
            "INVALID_FILENAME",
            "filename",
        )

    if not filename.strip():
        raise AttachmentValidationError(
            "filename is required and cannot be empty",
            "MISSING_FILENAME",
            "filename",
        )

    if len(filename) > FILENAME_MAX_LENGTH:
        raise AttachmentValidationError(
            f"filename exceeds maximum length of {FILENAME_MAX_LENGTH} characters",
            "FILENAME_TOO_LONG",
            "filename",
        )


def validate_file_size(size: Any) -> None:
    """
    Validates file size is a positive number.

    Args:
        size: Value to validate

    Raises:
        AttachmentValidationError: If size is invalid
    """
    if size is None:
        raise AttachmentValidationError(
            "size is required",
            "MISSING_SIZE",
            "size",
        )

    if not isinstance(size, (int, float)):
        raise AttachmentValidationError(
            f"size must be a number, got {type(size).__name__}",
            "INVALID_SIZE",
            "size",
        )

    if size <= 0:
        raise AttachmentValidationError(
            "size must be a positive number",
            "INVALID_SIZE",
            "size",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Optional Field Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_dimensions(dimensions: Any) -> None:
    """
    Validates dimensions object has valid width and height.

    Args:
        dimensions: Value to validate (can be None)

    Raises:
        AttachmentValidationError: If dimensions are invalid
    """
    if dimensions is None:
        return

    if not hasattr(dimensions, "width") or not hasattr(dimensions, "height"):
        raise AttachmentValidationError(
            "dimensions must have width and height attributes",
            "INVALID_DIMENSIONS",
            "dimensions",
        )

    if not isinstance(dimensions.width, (int, float)) or dimensions.width <= 0:
        raise AttachmentValidationError(
            "dimensions.width must be a positive number",
            "INVALID_DIMENSIONS",
            "dimensions.width",
        )

    if not isinstance(dimensions.height, (int, float)) or dimensions.height <= 0:
        raise AttachmentValidationError(
            "dimensions.height must be a positive number",
            "INVALID_DIMENSIONS",
            "dimensions.height",
        )


def validate_duration(duration: Any) -> None:
    """
    Validates duration is a positive number.

    Args:
        duration: Value to validate (can be None)

    Raises:
        AttachmentValidationError: If duration is invalid
    """
    if duration is None:
        return

    if not isinstance(duration, (int, float)):
        raise AttachmentValidationError(
            f"duration must be a number, got {type(duration).__name__}",
            "INVALID_DURATION",
            "duration",
        )

    if duration <= 0:
        raise AttachmentValidationError(
            "duration must be a positive number",
            "INVALID_DURATION",
            "duration",
        )


def validate_limit(limit: Any) -> None:
    """
    Validates limit is a positive integer within range.

    Args:
        limit: Value to validate (can be None)

    Raises:
        AttachmentValidationError: If limit is invalid
    """
    if limit is None:
        return

    if not isinstance(limit, int):
        raise AttachmentValidationError(
            f"limit must be an integer, got {type(limit).__name__}",
            "INVALID_LIMIT_TYPE",
            "limit",
        )

    if limit < 1:
        raise AttachmentValidationError(
            f"limit must be at least 1, got {limit}",
            "INVALID_LIMIT_RANGE",
            "limit",
        )

    if limit > MAX_LIMIT:
        raise AttachmentValidationError(
            f"limit exceeds maximum of {MAX_LIMIT}, got {limit}",
            "INVALID_LIMIT_RANGE",
            "limit",
        )


def validate_sort_by(sort_by: Any) -> None:
    """
    Validates sort_by is a valid sort field.

    Args:
        sort_by: Value to validate (can be None)

    Raises:
        AttachmentValidationError: If sort_by is invalid
    """
    if sort_by is None:
        return

    if not isinstance(sort_by, str):
        raise AttachmentValidationError(
            f"sort_by must be a string, got {type(sort_by).__name__}",
            "INVALID_SORT_BY_TYPE",
            "sort_by",
        )

    if sort_by not in VALID_SORT_BY:
        raise AttachmentValidationError(
            f"sort_by must be one of: {', '.join(VALID_SORT_BY)}. Got '{sort_by}'",
            "INVALID_SORT_BY_VALUE",
            "sort_by",
        )


def validate_sort_order(sort_order: Any) -> None:
    """
    Validates sort_order is a valid order.

    Args:
        sort_order: Value to validate (can be None)

    Raises:
        AttachmentValidationError: If sort_order is invalid
    """
    if sort_order is None:
        return

    if not isinstance(sort_order, str):
        raise AttachmentValidationError(
            f"sort_order must be a string, got {type(sort_order).__name__}",
            "INVALID_SORT_ORDER_TYPE",
            "sort_order",
        )

    if sort_order not in VALID_SORT_ORDER:
        raise AttachmentValidationError(
            f"sort_order must be one of: {', '.join(VALID_SORT_ORDER)}. Got '{sort_order}'",
            "INVALID_SORT_ORDER_VALUE",
            "sort_order",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Composite Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_attach_params(params: Any) -> None:
    """
    Validates AttachParams object.

    Args:
        params: AttachParams to validate

    Raises:
        AttachmentValidationError: If params are invalid
    """
    if params is None:
        raise AttachmentValidationError(
            "params is required",
            "MISSING_PARAMS",
            "params",
        )

    # Required fields
    validate_storage_id(getattr(params, "storage_id", None))
    validate_memory_space_id(getattr(params, "memory_space_id", None))
    validate_user_id(getattr(params, "user_id", None))
    validate_attachment_type(getattr(params, "type", None))
    validate_mime_type(getattr(params, "mime_type", None))
    validate_filename(getattr(params, "filename", None))
    validate_file_size(getattr(params, "size", None))

    # Optional fields
    validate_dimensions(getattr(params, "dimensions", None))
    validate_duration(getattr(params, "duration", None))


def validate_list_attachments_filter(filter_obj: Any) -> None:
    """
    Validates ListAttachmentsFilter object.

    Args:
        filter_obj: Filter to validate

    Raises:
        AttachmentValidationError: If filter is invalid
    """
    if filter_obj is None:
        raise AttachmentValidationError(
            "filter is required",
            "MISSING_FILTER",
            "filter",
        )

    # Required field
    validate_memory_space_id(getattr(filter_obj, "memory_space_id", None))

    # Optional fields
    validate_optional_attachment_type(getattr(filter_obj, "type", None))
    validate_limit(getattr(filter_obj, "limit", None))
    validate_sort_by(getattr(filter_obj, "sort_by", None))
    validate_sort_order(getattr(filter_obj, "sort_order", None))


def validate_attachment_ids(attachment_ids: Any) -> None:
    """
    Validates attachment IDs array for bulk operations.

    Args:
        attachment_ids: Array to validate

    Raises:
        AttachmentValidationError: If attachment_ids are invalid
    """
    if attachment_ids is None:
        raise AttachmentValidationError(
            "attachment_ids is required",
            "MISSING_ATTACHMENT_IDS",
            "attachment_ids",
        )

    if not isinstance(attachment_ids, list):
        raise AttachmentValidationError(
            f"attachment_ids must be a list, got {type(attachment_ids).__name__}",
            "INVALID_ATTACHMENT_IDS",
            "attachment_ids",
        )

    for i, aid in enumerate(attachment_ids):
        validate_attachment_id(aid, f"attachment_ids[{i}]")
