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
