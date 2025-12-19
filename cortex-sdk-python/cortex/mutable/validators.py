"""
Mutable Store API Validation

Client-side validation for mutable store operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

import json
import re
import sys
import warnings
from typing import Any, Optional


class MutableValidationError(Exception):
    """Custom exception for mutable validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize mutable validation error.

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

NAMESPACE_MAX_LENGTH = 100
KEY_MAX_LENGTH = 255
MAX_VALUE_SIZE = 1048576  # 1MB in bytes
MAX_LIMIT = 1000

# Regex patterns (compiled at module level for performance)
NAMESPACE_PATTERN = re.compile(r"^[a-zA-Z0-9-_.:]+$")
KEY_PATTERN = re.compile(r"^[a-zA-Z0-9-_.:/@]+$")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Required Field Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_namespace(namespace: Any, field_name: str = "namespace") -> None:
    """
    Validates namespace is non-empty string.

    Args:
        namespace: Value to validate
        field_name: Field name for error messages

    Raises:
        MutableValidationError: If namespace is missing or invalid
    """
    if not namespace or not isinstance(namespace, str) or not namespace.strip():
        raise MutableValidationError(
            f"{field_name} is required and cannot be empty",
            "MISSING_NAMESPACE",
            field_name,
        )


def validate_key(key: Any, field_name: str = "key") -> None:
    """
    Validates key is non-empty string.

    Args:
        key: Value to validate
        field_name: Field name for error messages

    Raises:
        MutableValidationError: If key is missing or invalid
    """
    if not key or not isinstance(key, str) or not key.strip():
        raise MutableValidationError(
            f"{field_name} is required and cannot be empty",
            "MISSING_KEY",
            field_name,
        )


def validate_user_id(user_id: Optional[str]) -> None:
    """
    Validates user_id format if provided.

    Args:
        user_id: User ID to validate (None is acceptable)

    Raises:
        MutableValidationError: If user_id is invalid
    """
    if user_id is None:
        return  # Optional field

    if not isinstance(user_id, str):
        raise MutableValidationError(
            f"user_id must be a string, got {type(user_id).__name__}",
            "INVALID_USER_ID",
            "user_id",
        )

    if not user_id.strip():
        raise MutableValidationError(
            "user_id cannot be empty", "INVALID_USER_ID", "user_id"
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Format Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_namespace_format(namespace: str) -> None:
    """
    Validates namespace format (alphanumeric, hyphens, underscores, dots, colons).

    Args:
        namespace: Namespace string to validate

    Raises:
        MutableValidationError: If namespace format is invalid
    """
    if len(namespace) > NAMESPACE_MAX_LENGTH:
        raise MutableValidationError(
            f"Namespace exceeds maximum length of {NAMESPACE_MAX_LENGTH} characters (got {len(namespace)})",
            "NAMESPACE_TOO_LONG",
            "namespace",
        )

    if not NAMESPACE_PATTERN.match(namespace):
        raise MutableValidationError(
            f'Invalid namespace format "{namespace}". Must contain only alphanumeric characters, hyphens, underscores, dots, and colons',
            "INVALID_NAMESPACE",
            "namespace",
        )


def validate_key_format(key: str) -> None:
    """
    Validates key format (allows slash for hierarchical keys).

    Args:
        key: Key string to validate

    Raises:
        MutableValidationError: If key format is invalid
    """
    if len(key) > KEY_MAX_LENGTH:
        raise MutableValidationError(
            f"Key exceeds maximum length of {KEY_MAX_LENGTH} characters (got {len(key)})",
            "KEY_TOO_LONG",
            "key",
        )

    if not KEY_PATTERN.match(key):
        raise MutableValidationError(
            f'Invalid key format "{key}". Must contain only alphanumeric characters, hyphens, underscores, dots, colons, slashes, and @ symbols',
            "INVALID_KEY",
            "key",
        )


def validate_key_prefix(key_prefix: Optional[str]) -> None:
    """
    Validates key_prefix format if provided.

    Args:
        key_prefix: Key prefix to validate (None is acceptable)

    Raises:
        MutableValidationError: If key_prefix is invalid
    """
    if key_prefix is None:
        return  # Optional field

    if not isinstance(key_prefix, str):
        raise MutableValidationError(
            f"key_prefix must be a string, got {type(key_prefix).__name__}",
            "INVALID_KEY_PREFIX",
            "key_prefix",
        )

    if not key_prefix.strip():
        raise MutableValidationError(
            "key_prefix cannot be empty", "INVALID_KEY_PREFIX", "key_prefix"
        )

    # Key prefix should follow same format rules as keys
    if not KEY_PATTERN.match(key_prefix):
        raise MutableValidationError(
            f'Invalid key_prefix format "{key_prefix}". Must contain only alphanumeric characters, hyphens, underscores, dots, colons, slashes, and @ symbols',
            "INVALID_KEY_PREFIX",
            "key_prefix",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Range Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_limit(limit: Optional[int]) -> None:
    """
    Validates limit is positive integer <= 1000.

    Args:
        limit: Limit value to validate (None is acceptable)

    Raises:
        MutableValidationError: If limit is invalid
    """
    if limit is None:
        return  # Optional field

    if not isinstance(limit, int):
        raise MutableValidationError(
            f"limit must be an integer, got {type(limit).__name__}",
            "INVALID_LIMIT_TYPE",
            "limit",
        )

    if limit < 0:
        raise MutableValidationError(
            f"limit must be non-negative, got {limit}",
            "INVALID_LIMIT_RANGE",
            "limit",
        )

    if limit > MAX_LIMIT:
        raise MutableValidationError(
            f"limit exceeds maximum of {MAX_LIMIT}, got {limit}",
            "INVALID_LIMIT_RANGE",
            "limit",
        )


def validate_amount(amount: Any, field_name: str = "amount") -> None:
    """
    Validates amount is a finite number.

    Args:
        amount: Amount to validate (None is acceptable)
        field_name: Field name for error messages

    Raises:
        MutableValidationError: If amount is invalid
    """
    if amount is None:
        return  # Optional field (has default)

    if not isinstance(amount, (int, float)):
        raise MutableValidationError(
            f"{field_name} must be a number, got {type(amount).__name__}",
            "INVALID_AMOUNT_TYPE",
            field_name,
        )

    # Check for infinity
    if isinstance(amount, float) and (amount == float("inf") or amount == float("-inf")):
        raise MutableValidationError(
            f"{field_name} must be a finite number",
            "INVALID_AMOUNT_TYPE",
            field_name,
        )

    # Warn about zero amount (but allow it)
    if amount == 0:
        warnings.warn(f"{field_name} is zero, which will have no effect on the value")


def validate_value_size(value: Any) -> None:
    """
    Validates value size (serialized JSON) is reasonable (< 1MB).

    Args:
        value: Value to validate

    Raises:
        MutableValidationError: If value is too large
    """
    try:
        serialized = json.dumps(value)
        size_bytes = sys.getsizeof(serialized)

        if size_bytes > MAX_VALUE_SIZE:
            size_mb = size_bytes / 1048576
            raise MutableValidationError(
                f"Value exceeds maximum size of 1MB (got {size_mb:.2f}MB). Consider splitting data into multiple keys or using a different storage approach.",
                "VALUE_TOO_LARGE",
                "value",
            )
    except (TypeError, ValueError) as e:
        # If JSON serialization fails, let backend handle it
        # unless it's our own error
        if isinstance(e, MutableValidationError):
            raise


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Additional Range Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_offset(offset: Any) -> None:
    """
    Validates offset is non-negative integer.

    Args:
        offset: Offset value to validate (None is acceptable)

    Raises:
        MutableValidationError: If offset is invalid
    """
    if offset is None:
        return  # Optional field

    if not isinstance(offset, int):
        raise MutableValidationError(
            f"offset must be an integer, got {type(offset).__name__}",
            "INVALID_OFFSET_TYPE",
            "offset",
        )

    if offset < 0:
        raise MutableValidationError(
            f"offset must be non-negative, got {offset}",
            "INVALID_OFFSET_RANGE",
            "offset",
        )


def validate_timestamp(timestamp: Any, field_name: str) -> None:
    """
    Validates timestamp is a valid Unix timestamp (positive number).

    Args:
        timestamp: Timestamp to validate (None is acceptable)
        field_name: Field name for error messages

    Raises:
        MutableValidationError: If timestamp is invalid
    """
    if timestamp is None:
        return  # Optional field

    if not isinstance(timestamp, (int, float)):
        raise MutableValidationError(
            f"{field_name} must be a number, got {type(timestamp).__name__}",
            "INVALID_TIMESTAMP_TYPE",
            field_name,
        )

    if timestamp < 0:
        raise MutableValidationError(
            f"{field_name} must be a valid Unix timestamp (positive number), got {timestamp}",
            "INVALID_TIMESTAMP_VALUE",
            field_name,
        )


VALID_SORT_BY = ["key", "updatedAt", "accessCount"]


def validate_sort_by(sort_by: Any) -> None:
    """
    Validates sortBy is a valid sort field.

    Args:
        sort_by: Sort field to validate (None is acceptable)

    Raises:
        MutableValidationError: If sort_by is invalid
    """
    if sort_by is None:
        return  # Optional field

    if not isinstance(sort_by, str):
        raise MutableValidationError(
            f"sort_by must be a string, got {type(sort_by).__name__}",
            "INVALID_SORT_BY_TYPE",
            "sort_by",
        )

    if sort_by not in VALID_SORT_BY:
        raise MutableValidationError(
            f"sort_by must be one of: {', '.join(VALID_SORT_BY)}. Got \"{sort_by}\"",
            "INVALID_SORT_BY_VALUE",
            "sort_by",
        )


VALID_SORT_ORDER = ["asc", "desc"]


def validate_sort_order(sort_order: Any) -> None:
    """
    Validates sortOrder is a valid sort direction.

    Args:
        sort_order: Sort order to validate (None is acceptable)

    Raises:
        MutableValidationError: If sort_order is invalid
    """
    if sort_order is None:
        return  # Optional field

    if not isinstance(sort_order, str):
        raise MutableValidationError(
            f"sort_order must be a string, got {type(sort_order).__name__}",
            "INVALID_SORT_ORDER_TYPE",
            "sort_order",
        )

    if sort_order not in VALID_SORT_ORDER:
        raise MutableValidationError(
            f"sort_order must be one of: {', '.join(VALID_SORT_ORDER)}. Got \"{sort_order}\"",
            "INVALID_SORT_ORDER_VALUE",
            "sort_order",
        )


def validate_dry_run(dry_run: Any) -> None:
    """
    Validates dryRun is a boolean.

    Args:
        dry_run: dry_run value to validate (None is acceptable)

    Raises:
        MutableValidationError: If dry_run is invalid
    """
    if dry_run is None:
        return  # Optional field

    if not isinstance(dry_run, bool):
        raise MutableValidationError(
            f"dry_run must be a boolean, got {type(dry_run).__name__}",
            "INVALID_DRY_RUN_TYPE",
            "dry_run",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Type Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_updater(updater: Any) -> None:
    """
    Validates updater is a callable function.

    Args:
        updater: Updater to validate

    Raises:
        MutableValidationError: If updater is not callable
    """
    if updater is None:
        raise MutableValidationError(
            "Updater function is required", "INVALID_UPDATER_TYPE", "updater"
        )

    if not callable(updater):
        raise MutableValidationError(
            f"Updater must be a callable function, got {type(updater).__name__}",
            "INVALID_UPDATER_TYPE",
            "updater",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Filter Object Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_list_filter(filter_obj: Any) -> None:
    """
    Validates ListMutableFilter object structure.

    Args:
        filter_obj: Filter object to validate

    Raises:
        MutableValidationError: If filter is invalid
    """
    if filter_obj is None:
        raise MutableValidationError(
            "Filter is required",
            "MISSING_FILTER",
            "filter",
        )

    # Check for namespace (required)
    namespace = getattr(filter_obj, "namespace", None)
    if not namespace:
        raise MutableValidationError(
            "Filter must include namespace",
            "MISSING_NAMESPACE",
            "filter.namespace",
        )

    # Validate individual filter fields
    validate_namespace(namespace, "filter.namespace")
    validate_namespace_format(namespace)

    key_prefix = getattr(filter_obj, "key_prefix", None)
    if key_prefix is not None:
        validate_key_prefix(key_prefix)

    user_id = getattr(filter_obj, "user_id", None)
    if user_id is not None:
        validate_user_id(user_id)

    limit = getattr(filter_obj, "limit", None)
    if limit is not None:
        validate_limit(limit)

    offset = getattr(filter_obj, "offset", None)
    if offset is not None:
        validate_offset(offset)

    updated_after = getattr(filter_obj, "updated_after", None)
    if updated_after is not None:
        validate_timestamp(updated_after, "filter.updated_after")

    updated_before = getattr(filter_obj, "updated_before", None)
    if updated_before is not None:
        validate_timestamp(updated_before, "filter.updated_before")

    sort_by = getattr(filter_obj, "sort_by", None)
    if sort_by is not None:
        validate_sort_by(sort_by)

    sort_order = getattr(filter_obj, "sort_order", None)
    if sort_order is not None:
        validate_sort_order(sort_order)


def validate_count_filter(filter_obj: Any) -> None:
    """
    Validates CountMutableFilter object structure.

    Args:
        filter_obj: Filter object to validate

    Raises:
        MutableValidationError: If filter is invalid
    """
    if filter_obj is None:
        raise MutableValidationError(
            "Filter is required",
            "MISSING_FILTER",
            "filter",
        )

    # Check for namespace (required)
    namespace = getattr(filter_obj, "namespace", None)
    if not namespace:
        raise MutableValidationError(
            "Filter must include namespace",
            "MISSING_NAMESPACE",
            "filter.namespace",
        )

    # Validate individual filter fields
    validate_namespace(namespace, "filter.namespace")
    validate_namespace_format(namespace)

    key_prefix = getattr(filter_obj, "key_prefix", None)
    if key_prefix is not None:
        validate_key_prefix(key_prefix)

    user_id = getattr(filter_obj, "user_id", None)
    if user_id is not None:
        validate_user_id(user_id)

    updated_after = getattr(filter_obj, "updated_after", None)
    if updated_after is not None:
        validate_timestamp(updated_after, "filter.updated_after")

    updated_before = getattr(filter_obj, "updated_before", None)
    if updated_before is not None:
        validate_timestamp(updated_before, "filter.updated_before")


def validate_purge_filter(filter_obj: Any) -> None:
    """
    Validates PurgeManyFilter object structure.

    Args:
        filter_obj: Filter object to validate

    Raises:
        MutableValidationError: If filter is invalid
    """
    if filter_obj is None:
        raise MutableValidationError(
            "Filter is required",
            "MISSING_FILTER",
            "filter",
        )

    # Check for namespace (required)
    namespace = getattr(filter_obj, "namespace", None)
    if not namespace:
        raise MutableValidationError(
            "Filter must include namespace",
            "MISSING_NAMESPACE",
            "filter.namespace",
        )

    # Validate individual filter fields
    validate_namespace(namespace, "filter.namespace")
    validate_namespace_format(namespace)

    key_prefix = getattr(filter_obj, "key_prefix", None)
    if key_prefix is not None:
        validate_key_prefix(key_prefix)

    user_id = getattr(filter_obj, "user_id", None)
    if user_id is not None:
        validate_user_id(user_id)

    updated_before = getattr(filter_obj, "updated_before", None)
    if updated_before is not None:
        validate_timestamp(updated_before, "filter.updated_before")

    last_accessed_before = getattr(filter_obj, "last_accessed_before", None)
    if last_accessed_before is not None:
        validate_timestamp(last_accessed_before, "filter.last_accessed_before")


def validate_purge_namespace_options(options: Any) -> None:
    """
    Validates PurgeNamespaceOptions object structure.

    Args:
        options: Options object to validate (None is acceptable)

    Raises:
        MutableValidationError: If options are invalid
    """
    if options is None:
        return  # Optional parameter

    dry_run = getattr(options, "dry_run", None)
    if dry_run is not None:
        validate_dry_run(dry_run)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Transaction Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


VALID_OPERATIONS = ["set", "update", "delete", "increment", "decrement"]


def validate_operations_array(operations: Any) -> None:
    """
    Validates operations array is non-empty.

    Args:
        operations: Operations array to validate

    Raises:
        MutableValidationError: If operations array is invalid
    """
    if operations is None:
        raise MutableValidationError(
            "Operations array is required",
            "MISSING_OPERATIONS",
            "operations",
        )

    if not isinstance(operations, list):
        raise MutableValidationError(
            f"Operations must be a list, got {type(operations).__name__}",
            "INVALID_OPERATIONS_ARRAY",
            "operations",
        )

    if len(operations) == 0:
        raise MutableValidationError(
            "Operations array cannot be empty",
            "EMPTY_OPERATIONS_ARRAY",
            "operations",
        )


def validate_transaction_operation(operation: Any, index: int) -> None:
    """
    Validates individual transaction operation structure.

    Args:
        operation: Operation to validate
        index: Index in the operations array

    Raises:
        MutableValidationError: If operation is invalid
    """
    if operation is None:
        raise MutableValidationError(
            f"Operation at index {index} must be an object",
            "INVALID_TRANSACTION_OPERATION",
            f"operations[{index}]",
        )

    # Get operation type
    op = getattr(operation, "op", None)
    if not op:
        raise MutableValidationError(
            f'Operation at index {index} is missing required field "op"',
            "MISSING_OPERATION_FIELD",
            f"operations[{index}].op",
        )

    if not isinstance(op, str) or op not in VALID_OPERATIONS:
        raise MutableValidationError(
            f'Operation at index {index} has invalid "op" value "{op}". Must be one of: {", ".join(VALID_OPERATIONS)}',
            "INVALID_OPERATION_TYPE",
            f"operations[{index}].op",
        )

    # Validate namespace
    namespace = getattr(operation, "namespace", None)
    if not namespace:
        raise MutableValidationError(
            f'Operation at index {index} is missing required field "namespace"',
            "MISSING_OPERATION_FIELD",
            f"operations[{index}].namespace",
        )

    # Validate key
    key = getattr(operation, "key", None)
    if not key:
        raise MutableValidationError(
            f'Operation at index {index} is missing required field "key"',
            "MISSING_OPERATION_FIELD",
            f"operations[{index}].key",
        )

    # Validate namespace and key format
    validate_namespace(namespace, f"operations[{index}].namespace")
    validate_namespace_format(namespace)
    validate_key(key, f"operations[{index}].key")
    validate_key_format(key)

    # Validate operation-specific fields
    if op == "set":
        value = getattr(operation, "value", None)
        if value is None:
            raise MutableValidationError(
                f'Operation at index {index} with op="set" is missing required field "value"',
                "MISSING_OPERATION_FIELD",
                f"operations[{index}].value",
            )

    elif op == "update":
        value = getattr(operation, "value", None)
        if value is None:
            raise MutableValidationError(
                f'Operation at index {index} with op="update" is missing required field "value"',
                "MISSING_OPERATION_FIELD",
                f"operations[{index}].value",
            )

    elif op in ("increment", "decrement"):
        amount = getattr(operation, "amount", None)
        if amount is not None:
            validate_amount(amount, f"operations[{index}].amount")

    # delete operation has no additional required fields


def validate_transaction_operations(operations: list) -> None:
    """
    Validates complete transaction operations.

    Args:
        operations: List of operations to validate

    Raises:
        MutableValidationError: If any operation is invalid
    """
    for i, operation in enumerate(operations):
        validate_transaction_operation(operation, i)
