"""
User API Validation

Client-side validation for user operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

from typing import Any, List, Optional


class UserValidationError(Exception):
    """Custom exception for user validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize user validation error.

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


def validate_user_id(user_id: Optional[str], field_name: str = "user_id") -> None:
    """
    Validates user_id is provided and non-empty.

    Args:
        user_id: User ID to validate
        field_name: Name of the field being validated

    Raises:
        UserValidationError: If user_id is None, empty, or whitespace-only
    """
    if user_id is None:
        raise UserValidationError(
            f"{field_name} is required", "MISSING_USER_ID", field_name
        )

    if not isinstance(user_id, str):
        raise UserValidationError(
            f"{field_name} must be a string", "INVALID_USER_ID_FORMAT", field_name
        )

    if not user_id.strip():
        raise UserValidationError(
            f"{field_name} cannot be empty", "INVALID_USER_ID_FORMAT", field_name
        )


def validate_data(data: Any, field_name: str = "data") -> None:
    """
    Validates data is a non-null dict.

    Args:
        data: Data to validate
        field_name: Name of the field being validated

    Raises:
        UserValidationError: If data is None, not a dict, or a list
    """
    if data is None:
        raise UserValidationError(
            f"{field_name} is required", "MISSING_DATA", field_name
        )

    if not isinstance(data, dict):
        if isinstance(data, list):
            raise UserValidationError(
                f"{field_name} must be a dict, not a list",
                "INVALID_DATA_TYPE",
                field_name,
            )
        else:
            raise UserValidationError(
                f"{field_name} must be a dict", "INVALID_DATA_TYPE", field_name
            )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Format Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_version_number(version: Any, field_name: str = "version") -> None:
    """
    Validates version number is a positive integer >= 1.

    Args:
        version: Version number to validate
        field_name: Name of the field being validated

    Raises:
        UserValidationError: If version is invalid
    """
    if not isinstance(version, (int, float)):
        raise UserValidationError(
            f"{field_name} must be a number", "INVALID_VERSION_NUMBER", field_name
        )

    if version < 1:
        raise UserValidationError(
            f"{field_name} must be >= 1, got {version}",
            "INVALID_VERSION_RANGE",
            field_name,
        )

    # Check if it's a whole number (handles both int and float)
    if version != int(version):
        raise UserValidationError(
            f"{field_name} must be a whole number, got {version}",
            "INVALID_VERSION_NUMBER",
            field_name,
        )


def validate_timestamp(timestamp: Any, field_name: str = "timestamp") -> None:
    """
    Validates timestamp is a non-negative integer.

    Args:
        timestamp: Timestamp to validate (Unix timestamp in ms)
        field_name: Name of the field being validated

    Raises:
        UserValidationError: If timestamp is invalid
    """
    if not isinstance(timestamp, (int, float)):
        raise UserValidationError(
            f"{field_name} must be a number", "INVALID_TIMESTAMP", field_name
        )

    if timestamp < 0:
        raise UserValidationError(
            f"{field_name} must be >= 0, got {timestamp}",
            "INVALID_TIMESTAMP",
            field_name,
        )


def validate_export_format(format: str) -> None:
    """
    Validates export format is "json" or "csv".

    Args:
        format: Export format to validate

    Raises:
        UserValidationError: If format is invalid
    """
    if not format or not isinstance(format, str):
        raise UserValidationError(
            "Export format is required", "INVALID_EXPORT_FORMAT", "format"
        )

    if format not in ("json", "csv"):
        raise UserValidationError(
            f'Invalid export format "{format}". Valid formats: json, csv',
            "INVALID_EXPORT_FORMAT",
            "format",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Range Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_limit(limit: Optional[int], field_name: str = "limit") -> None:
    """
    Validates limit is within acceptable range.

    Args:
        limit: Limit to validate (None is OK)
        field_name: Name of the field being validated

    Raises:
        UserValidationError: If limit is invalid
    """
    if limit is None:
        return  # Optional parameter

    if not isinstance(limit, int):
        raise UserValidationError(
            f"{field_name} must be an integer", "INVALID_LIMIT", field_name
        )

    if limit < 1 or limit > 1000:
        raise UserValidationError(
            f"{field_name} must be between 1 and 1000, got {limit}",
            "INVALID_LIMIT",
            field_name,
        )


def validate_offset(offset: Optional[int], field_name: str = "offset") -> None:
    """
    Validates offset is non-negative.

    Args:
        offset: Offset to validate (None is OK)
        field_name: Name of the field being validated

    Raises:
        UserValidationError: If offset is invalid
    """
    if offset is None:
        return  # Optional parameter

    if not isinstance(offset, int):
        raise UserValidationError(
            f"{field_name} must be an integer", "INVALID_OFFSET", field_name
        )

    if offset < 0:
        raise UserValidationError(
            f"{field_name} must be >= 0, got {offset}",
            "INVALID_OFFSET",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Business Logic Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_user_ids_array(
    user_ids: List[str], min_length: int = 1, max_length: int = 100
) -> None:
    """
    Validates array of user IDs for bulk operations.

    Args:
        user_ids: Array of user IDs to validate
        min_length: Minimum required length
        max_length: Maximum allowed length

    Raises:
        UserValidationError: If array is invalid
    """
    if not isinstance(user_ids, list):
        raise UserValidationError(
            "user_ids must be a list", "INVALID_DATA_TYPE", "user_ids"
        )

    if len(user_ids) < min_length:
        raise UserValidationError(
            "user_ids array cannot be empty", "EMPTY_USER_IDS_ARRAY", "user_ids"
        )

    if len(user_ids) > max_length:
        raise UserValidationError(
            f"user_ids array cannot exceed {max_length} items, got {len(user_ids)}",
            "USER_ID_ARRAY_TOO_LARGE",
            "user_ids",
        )

    # Validate each userId
    for i, user_id in enumerate(user_ids):
        try:
            validate_user_id(user_id, f"user_ids[{i}]")
        except UserValidationError as error:
            raise UserValidationError(
                f"Invalid user_id at index {i}: {error}",
                error.code,
                f"user_ids[{i}]",
            )

    # Check for duplicates
    unique_ids = set(user_ids)
    if len(unique_ids) != len(user_ids):
        raise UserValidationError(
            "Duplicate user_ids found in array", "DUPLICATE_VALUES", "user_ids"
        )


def validate_delete_options(options: Any) -> None:
    """
    Validates DeleteUserOptions structure.

    Args:
        options: Delete options to validate (None is OK)

    Raises:
        UserValidationError: If options structure is invalid
    """
    if options is None:
        return  # Optional parameter

    # Check if it's a DeleteUserOptions object or dict
    if not hasattr(options, "cascade") and not isinstance(options, dict):
        raise UserValidationError(
            "Options must be a DeleteUserOptions instance or dict",
            "INVALID_OPTIONS",
            "options",
        )

    # Validate boolean fields if they exist
    if hasattr(options, "cascade"):
        if options.cascade is not None and not isinstance(options.cascade, bool):
            raise UserValidationError(
                "options.cascade must be a boolean",
                "INVALID_OPTIONS",
                "options.cascade",
            )

    if hasattr(options, "verify"):
        if options.verify is not None and not isinstance(options.verify, bool):
            raise UserValidationError(
                "options.verify must be a boolean",
                "INVALID_OPTIONS",
                "options.verify",
            )

    if hasattr(options, "dry_run"):
        if options.dry_run is not None and not isinstance(options.dry_run, bool):
            raise UserValidationError(
                "options.dry_run must be a boolean",
                "INVALID_OPTIONS",
                "options.dry_run",
            )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Filter and Options Validators (0.21.0)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_list_users_filter(filters: Any) -> None:
    """
    Validates ListUsersFilter structure for list/search operations.

    Args:
        filters: ListUsersFilter to validate (None is OK)

    Raises:
        UserValidationError: If filter structure is invalid
    """
    if filters is None:
        return  # Optional parameter

    # Validate limit if provided
    if hasattr(filters, "limit") and filters.limit is not None:
        validate_limit(filters.limit, "filters.limit")

    # Validate offset if provided
    if hasattr(filters, "offset") and filters.offset is not None:
        validate_offset(filters.offset, "filters.offset")

    # Validate timestamp fields
    timestamp_fields = [
        ("created_after", "filters.created_after"),
        ("created_before", "filters.created_before"),
        ("updated_after", "filters.updated_after"),
        ("updated_before", "filters.updated_before"),
    ]

    for attr, field_name in timestamp_fields:
        value = getattr(filters, attr, None)
        if value is not None:
            validate_timestamp(value, field_name)

    # Validate sort_by if provided
    if hasattr(filters, "sort_by") and filters.sort_by is not None:
        if filters.sort_by not in ("createdAt", "updatedAt"):
            raise UserValidationError(
                f'Invalid sort_by value "{filters.sort_by}". Valid values: createdAt, updatedAt',
                "INVALID_SORT_BY",
                "filters.sort_by",
            )

    # Validate sort_order if provided
    if hasattr(filters, "sort_order") and filters.sort_order is not None:
        if filters.sort_order not in ("asc", "desc"):
            raise UserValidationError(
                f'Invalid sort_order value "{filters.sort_order}". Valid values: asc, desc',
                "INVALID_SORT_ORDER",
                "filters.sort_order",
            )

    # Validate displayName/email are strings if provided
    if hasattr(filters, "display_name") and filters.display_name is not None:
        if not isinstance(filters.display_name, str):
            raise UserValidationError(
                "filters.display_name must be a string",
                "INVALID_FILTER_TYPE",
                "filters.display_name",
            )

    if hasattr(filters, "email") and filters.email is not None:
        if not isinstance(filters.email, str):
            raise UserValidationError(
                "filters.email must be a string",
                "INVALID_FILTER_TYPE",
                "filters.email",
            )

    # Validate date range consistency
    created_after = getattr(filters, "created_after", None)
    created_before = getattr(filters, "created_before", None)
    if created_after and created_before and created_after >= created_before:
        raise UserValidationError(
            "created_after must be less than created_before",
            "INVALID_DATE_RANGE",
            "filters",
        )

    updated_after = getattr(filters, "updated_after", None)
    updated_before = getattr(filters, "updated_before", None)
    if updated_after and updated_before and updated_after >= updated_before:
        raise UserValidationError(
            "updated_after must be less than updated_before",
            "INVALID_DATE_RANGE",
            "filters",
        )


def validate_export_options(options: Any) -> None:
    """
    Validates ExportUsersOptions structure.

    Args:
        options: Export options to validate (None is OK)

    Raises:
        UserValidationError: If options structure is invalid
    """
    if options is None:
        return  # Optional parameter

    # Validate format is required
    if hasattr(options, "format"):
        validate_export_format(options.format)
    else:
        raise UserValidationError(
            "options.format is required",
            "MISSING_EXPORT_FORMAT",
            "options.format",
        )

    # Validate filters if provided
    if hasattr(options, "filters") and options.filters is not None:
        validate_list_users_filter(options.filters)

    # Validate boolean fields
    bool_fields = [
        ("include_version_history", "options.include_version_history"),
        ("include_conversations", "options.include_conversations"),
        ("include_memories", "options.include_memories"),
    ]

    for attr, field_name in bool_fields:
        value = getattr(options, attr, None)
        if value is not None and not isinstance(value, bool):
            raise UserValidationError(
                f"{field_name} must be a boolean",
                "INVALID_OPTIONS",
                field_name,
            )


def validate_bulk_update_options(options: Any) -> None:
    """
    Validates bulk update options.

    Args:
        options: Update options dict to validate (None is OK)

    Raises:
        UserValidationError: If options structure is invalid
    """
    if options is None:
        return  # Optional parameter

    if not isinstance(options, dict):
        raise UserValidationError(
            "options must be a dict",
            "INVALID_OPTIONS",
            "options",
        )

    # Validate dry_run if provided
    if "dry_run" in options and options["dry_run"] is not None:
        if not isinstance(options["dry_run"], bool):
            raise UserValidationError(
                "options.dry_run must be a boolean",
                "INVALID_OPTIONS",
                "options.dry_run",
            )

    # Validate skip_versioning if provided
    if "skip_versioning" in options and options["skip_versioning"] is not None:
        if not isinstance(options["skip_versioning"], bool):
            raise UserValidationError(
                "options.skip_versioning must be a boolean",
                "INVALID_OPTIONS",
                "options.skip_versioning",
            )


def validate_bulk_delete_options(options: Any) -> None:
    """
    Validates bulk delete options.

    Args:
        options: Delete options dict to validate (None is OK)

    Raises:
        UserValidationError: If options structure is invalid
    """
    if options is None:
        return  # Optional parameter

    if not isinstance(options, dict):
        raise UserValidationError(
            "options must be a dict",
            "INVALID_OPTIONS",
            "options",
        )

    # Validate cascade if provided
    if "cascade" in options and options["cascade"] is not None:
        if not isinstance(options["cascade"], bool):
            raise UserValidationError(
                "options.cascade must be a boolean",
                "INVALID_OPTIONS",
                "options.cascade",
            )

    # Validate dry_run if provided
    if "dry_run" in options and options["dry_run"] is not None:
        if not isinstance(options["dry_run"], bool):
            raise UserValidationError(
                "options.dry_run must be a boolean",
                "INVALID_OPTIONS",
                "options.dry_run",
            )
