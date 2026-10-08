"""
A2A API Validation

Client-side validation for A2A operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

import re
from datetime import datetime
from typing import List, Optional, Union

from ..types import (
    A2ABroadcastParams,
    A2ARequestParams,
    A2ASendParams,
)


class A2AValidationError(Exception):
    """Custom exception for A2A validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize A2A validation error.

        Args:
            message: Human-readable error message
            code: Error code for programmatic handling
            field: Optional field name that failed validation
        """
        self.code = code
        self.field = field
        super().__init__(message)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Agent ID Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Agent ID pattern: alphanumeric, hyphens, underscores
AGENT_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")
MAX_AGENT_ID_LENGTH = 100


def validate_agent_id(agent_id: str, field_name: str) -> None:
    """
    Validates an agent ID.

    Args:
        agent_id: Agent ID to validate
        field_name: Field name for error messages

    Raises:
        A2AValidationError: If validation fails
    """
    if agent_id is None:
        raise A2AValidationError(
            f"{field_name} is required",
            "INVALID_AGENT_ID",
            field_name,
        )

    if not isinstance(agent_id, str):
        raise A2AValidationError(
            f"{field_name} must be a string",
            "INVALID_AGENT_ID",
            field_name,
        )

    if agent_id.strip() == "":
        raise A2AValidationError(
            f"{field_name} cannot be empty",
            "INVALID_AGENT_ID",
            field_name,
        )

    if len(agent_id) > MAX_AGENT_ID_LENGTH:
        raise A2AValidationError(
            f"{field_name} exceeds maximum length of {MAX_AGENT_ID_LENGTH} characters",
            "INVALID_AGENT_ID",
            field_name,
        )

    if not AGENT_ID_PATTERN.match(agent_id):
        raise A2AValidationError(
            f"{field_name} contains invalid characters. Only alphanumeric characters, "
            "hyphens, and underscores are allowed",
            "INVALID_AGENT_ID",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Message Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAX_MESSAGE_SIZE = 102400  # 100KB in bytes


def validate_message(message: str) -> None:
    """
    Validates a message content.

    Args:
        message: Message to validate

    Raises:
        A2AValidationError: If validation fails
    """
    if message is None:
        raise A2AValidationError(
            "Message is required",
            "EMPTY_MESSAGE",
            "message",
        )

    if not isinstance(message, str):
        raise A2AValidationError(
            "Message must be a string",
            "EMPTY_MESSAGE",
            "message",
        )

    if message.strip() == "":
        raise A2AValidationError(
            "Message cannot be empty or whitespace-only",
            "EMPTY_MESSAGE",
            "message",
        )

    # Check byte size for UTF-8 encoded message
    byte_size = len(message.encode("utf-8"))
    if byte_size > MAX_MESSAGE_SIZE:
        raise A2AValidationError(
            f"Message exceeds maximum size of 100KB (current size: {byte_size // 1024}KB)",
            "MESSAGE_TOO_LARGE",
            "message",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Importance Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_importance(importance: Optional[int]) -> None:
    """
    Validates importance value.

    Args:
        importance: Importance value (0-100)

    Raises:
        A2AValidationError: If validation fails
    """
    if importance is None:
        return  # Optional field, skip validation

    if not isinstance(importance, int) or isinstance(importance, bool):
        raise A2AValidationError(
            "Importance must be an integer",
            "INVALID_IMPORTANCE",
            "importance",
        )

    if importance < 0 or importance > 100:
        raise A2AValidationError(
            f"Importance must be between 0 and 100, got {importance}",
            "INVALID_IMPORTANCE",
            "importance",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Timeout Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MIN_TIMEOUT = 1000  # 1 second
MAX_TIMEOUT = 300000  # 5 minutes


def validate_timeout(timeout: Optional[int]) -> None:
    """
    Validates timeout value.

    Args:
        timeout: Timeout in milliseconds

    Raises:
        A2AValidationError: If validation fails
    """
    if timeout is None:
        return  # Optional field, skip validation

    if not isinstance(timeout, int) or isinstance(timeout, bool):
        raise A2AValidationError(
            "Timeout must be an integer",
            "INVALID_TIMEOUT",
            "timeout",
        )

    if timeout < MIN_TIMEOUT or timeout > MAX_TIMEOUT:
        raise A2AValidationError(
            f"Timeout must be between {MIN_TIMEOUT}ms (1 second) and "
            f"{MAX_TIMEOUT}ms (5 minutes), got {timeout}ms",
            "INVALID_TIMEOUT",
            "timeout",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Retries Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAX_RETRIES = 10


def validate_retries(retries: Optional[int]) -> None:
    """
    Validates retries value.

    Args:
        retries: Number of retry attempts

    Raises:
        A2AValidationError: If validation fails
    """
    if retries is None:
        return  # Optional field, skip validation

    if not isinstance(retries, int) or isinstance(retries, bool):
        raise A2AValidationError(
            "Retries must be an integer",
            "INVALID_RETRIES",
            "retries",
        )

    if retries < 0 or retries > MAX_RETRIES:
        raise A2AValidationError(
            f"Retries must be between 0 and {MAX_RETRIES}, got {retries}",
            "INVALID_RETRIES",
            "retries",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Recipients Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAX_RECIPIENTS = 100


def validate_recipients(recipients: List[str], sender: str) -> None:
    """
    Validates recipients array for broadcast.

    Args:
        recipients: Array of recipient agent IDs
        sender: Sender agent ID (to check it's not in recipients)

    Raises:
        A2AValidationError: If validation fails
    """
    if recipients is None or not isinstance(recipients, list):
        raise A2AValidationError(
            "Recipients must be an array",
            "EMPTY_RECIPIENTS",
            "to",
        )

    if len(recipients) == 0:
        raise A2AValidationError(
            "Recipients array cannot be empty",
            "EMPTY_RECIPIENTS",
            "to",
        )

    if len(recipients) > MAX_RECIPIENTS:
        raise A2AValidationError(
            f"Maximum {MAX_RECIPIENTS} recipients allowed, got {len(recipients)}",
            "TOO_MANY_RECIPIENTS",
            "to",
        )

    # Check for duplicates
    seen: set[str] = set()
    for recipient in recipients:
        if recipient in seen:
            raise A2AValidationError(
                f"Duplicate recipient: {recipient}",
                "DUPLICATE_RECIPIENTS",
                "to",
            )
        seen.add(recipient)

    # Check for sender in recipients
    if sender in recipients:
        raise A2AValidationError(
            "Sender cannot be included in recipients list",
            "INVALID_RECIPIENT",
            "to",
        )

    # Validate each recipient ID
    for i, recipient in enumerate(recipients):
        try:
            validate_agent_id(recipient, f"to[{i}]")
        except A2AValidationError as e:
            raise A2AValidationError(
                f"Invalid recipient at index {i}: {str(e)}",
                "INVALID_AGENT_ID",
                "to",
            ) from e


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Conversation Filters Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAX_LIMIT = 1000


def validate_conversation_filters(
    since: Optional[Union[datetime, int]] = None,
    until: Optional[Union[datetime, int]] = None,
    min_importance: Optional[int] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
) -> None:
    """
    Validates conversation filters.

    Args:
        since: Filter by start date (datetime or timestamp)
        until: Filter by end date (datetime or timestamp)
        min_importance: Minimum importance filter (0-100)
        limit: Maximum messages to return
        offset: Pagination offset

    Raises:
        A2AValidationError: If validation fails
    """
    # Validate date range
    if since is not None and until is not None:
        since_time = since.timestamp() * 1000 if isinstance(since, datetime) else since
        until_time = until.timestamp() * 1000 if isinstance(until, datetime) else until

        if since_time > until_time:
            raise A2AValidationError(
                "'since' must be before 'until'",
                "INVALID_DATE_RANGE",
            )

    # Validate minImportance
    if min_importance is not None:
        if not isinstance(min_importance, int) or isinstance(min_importance, bool):
            raise A2AValidationError(
                "minImportance must be an integer",
                "INVALID_IMPORTANCE",
                "minImportance",
            )

        if min_importance < 0 or min_importance > 100:
            raise A2AValidationError(
                "minImportance must be between 0 and 100",
                "INVALID_IMPORTANCE",
                "minImportance",
            )

    # Validate limit
    if limit is not None:
        if not isinstance(limit, int) or isinstance(limit, bool):
            raise A2AValidationError(
                "Limit must be an integer",
                "INVALID_LIMIT",
                "limit",
            )

        if limit <= 0:
            raise A2AValidationError(
                "Limit must be greater than 0",
                "INVALID_LIMIT",
                "limit",
            )

        if limit > MAX_LIMIT:
            raise A2AValidationError(
                f"Limit cannot exceed {MAX_LIMIT}",
                "INVALID_LIMIT",
                "limit",
            )

    # Validate offset
    if offset is not None:
        if not isinstance(offset, int) or isinstance(offset, bool):
            raise A2AValidationError(
                "Offset must be an integer",
                "INVALID_OFFSET",
                "offset",
            )

        if offset < 0:
            raise A2AValidationError(
                "Offset cannot be negative",
                "INVALID_OFFSET",
                "offset",
            )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Composite Validators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_send_params(params: A2ASendParams) -> None:
    """
    Validates send parameters.

    Args:
        params: Send parameters to validate

    Raises:
        A2AValidationError: If validation fails
    """
    if not params:
        raise A2AValidationError(
            "Send parameters are required",
            "MISSING_PARAMS",
        )

    # Required fields
    validate_agent_id(params.from_agent, "from")
    validate_agent_id(params.to_agent, "to")
    validate_message(params.message)

    # Check sender !== receiver
    if params.from_agent == params.to_agent:
        raise A2AValidationError(
            "Cannot send message to self. 'from' and 'to' must be different agents",
            "SAME_AGENT_COMMUNICATION",
        )

    # Optional fields
    validate_importance(params.importance)


def validate_request_params(params: A2ARequestParams) -> None:
    """
    Validates request parameters.

    Args:
        params: Request parameters to validate

    Raises:
        A2AValidationError: If validation fails
    """
    if not params:
        raise A2AValidationError(
            "Request parameters are required",
            "MISSING_PARAMS",
        )

    # Required fields
    validate_agent_id(params.from_agent, "from")
    validate_agent_id(params.to_agent, "to")
    validate_message(params.message)

    # Check sender !== receiver
    if params.from_agent == params.to_agent:
        raise A2AValidationError(
            "Cannot send request to self. 'from' and 'to' must be different agents",
            "SAME_AGENT_COMMUNICATION",
        )

    # Optional fields
    validate_timeout(params.timeout)
    validate_retries(params.retries)
    validate_importance(params.importance)


def validate_broadcast_params(params: A2ABroadcastParams) -> None:
    """
    Validates broadcast parameters.

    Args:
        params: Broadcast parameters to validate

    Raises:
        A2AValidationError: If validation fails
    """
    if not params:
        raise A2AValidationError(
            "Broadcast parameters are required",
            "MISSING_PARAMS",
        )

    # Required fields
    validate_agent_id(params.from_agent, "from")
    validate_message(params.message)
    validate_recipients(params.to_agents, params.from_agent)

    # Optional fields
    validate_importance(params.importance)
