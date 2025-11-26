"""
Memory Spaces API Validation

Client-side validation for memory space operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

import re
from typing import Any, Dict, List, Optional


class MemorySpaceValidationError(Exception):
    """Custom exception for memory space validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize memory space validation error.

        Args:
            message: Human-readable error message
            code: Error code for programmatic handling
            field: Optional field name that failed validation
        """
        self.code = code
        self.field = field
        super().__init__(message)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Memory Space ID Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_memory_space_id(id: str, field_name: str = "memory_space_id") -> None:
    """
    Validates memory space ID.

    Args:
        id: Memory space ID to validate
        field_name: Name of the field being validated

    Raises:
        MemorySpaceValidationError: If validation fails
    """
    if not id or not isinstance(id, str) or not id.strip():
        raise MemorySpaceValidationError(
            f"{field_name} is required and cannot be empty",
            "MISSING_MEMORYSPACE_ID",
            field_name,
        )

    trimmed_id = id.strip()

    # Check length
    if len(trimmed_id) > 128:
        raise MemorySpaceValidationError(
            f"{field_name} must be 128 characters or less, got {len(trimmed_id)}",
            "INVALID_MEMORYSPACE_ID",
            field_name,
        )

    # Check for safe characters (alphanumeric, hyphens, underscores)
    valid_pattern = re.compile(r"^[a-zA-Z0-9_-]+$")
    if not valid_pattern.match(trimmed_id):
        raise MemorySpaceValidationError(
            f'Invalid {field_name} format "{trimmed_id}". Only alphanumeric characters, hyphens, and underscores are allowed',
            "INVALID_MEMORYSPACE_ID",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Type and Status Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALID_TYPES = ["personal", "team", "project", "custom"]
VALID_STATUSES = ["active", "archived"]


def validate_memory_space_type(type_val: str) -> None:
    """
    Validates memory space type.

    Args:
        type_val: Type to validate

    Raises:
        MemorySpaceValidationError: If validation fails
    """
    if not type_val or not isinstance(type_val, str):
        raise MemorySpaceValidationError(
            "type is required and must be a string", "INVALID_TYPE", "type"
        )

    if type_val not in VALID_TYPES:
        raise MemorySpaceValidationError(
            f'Invalid type "{type_val}". Valid types: {", ".join(VALID_TYPES)}',
            "INVALID_TYPE",
            "type",
        )


def validate_memory_space_status(status: str) -> None:
    """
    Validates memory space status.

    Args:
        status: Status to validate

    Raises:
        MemorySpaceValidationError: If validation fails
    """
    if not status or not isinstance(status, str):
        raise MemorySpaceValidationError(
            "status is required and must be a string", "INVALID_STATUS", "status"
        )

    if status not in VALID_STATUSES:
        raise MemorySpaceValidationError(
            f'Invalid status "{status}". Valid statuses: {", ".join(VALID_STATUSES)}',
            "INVALID_STATUS",
            "status",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Limit and Range Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_limit(limit: int, max_val: int = 1000) -> None:
    """
    Validates limit parameter.

    Args:
        limit: Limit to validate
        max_val: Maximum allowed limit

    Raises:
        MemorySpaceValidationError: If validation fails
    """
    if not isinstance(limit, int):
        raise MemorySpaceValidationError(
            "limit must be a number", "INVALID_LIMIT", "limit"
        )

    if limit < 1:
        raise MemorySpaceValidationError(
            f"limit must be at least 1, got {limit}", "INVALID_LIMIT", "limit"
        )

    if limit > max_val:
        raise MemorySpaceValidationError(
            f"limit must be at most {max_val}, got {limit}", "INVALID_LIMIT", "limit"
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Participant Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_participant(participant: Dict[str, Any]) -> None:
    """
    Validates a single participant object.

    Args:
        participant: Participant dict to validate

    Raises:
        MemorySpaceValidationError: If validation fails
    """
    if not participant or not isinstance(participant, dict):
        raise MemorySpaceValidationError(
            "Participant must be a dictionary", "INVALID_PARTICIPANT"
        )

    # Validate id
    if "id" not in participant or not participant["id"] or not isinstance(participant["id"], str) or not participant["id"].strip():
        raise MemorySpaceValidationError(
            "participant.id is required and cannot be empty",
            "MISSING_PARTICIPANT_ID",
            "participant.id",
        )

    # Validate type
    if "type" not in participant or not participant["type"] or not isinstance(participant["type"], str) or not participant["type"].strip():
        raise MemorySpaceValidationError(
            "participant.type is required and cannot be empty",
            "MISSING_PARTICIPANT_TYPE",
            "participant.type",
        )

    # Validate joined_at if provided
    if "joined_at" in participant:
        joined_at = participant["joined_at"]
        if not isinstance(joined_at, (int, float)):
            raise MemorySpaceValidationError(
                "participant.joined_at must be a number",
                "INVALID_TIMESTAMP",
                "participant.joined_at",
            )

        if joined_at < 0:
            raise MemorySpaceValidationError(
                f"participant.joined_at must be a positive number, got {joined_at}",
                "INVALID_TIMESTAMP",
                "participant.joined_at",
            )


def validate_participants(participants: List[Dict[str, Any]]) -> None:
    """
    Validates an array of participants.

    Args:
        participants: List of participant dicts to validate

    Raises:
        MemorySpaceValidationError: If validation fails
    """
    if not isinstance(participants, list):
        raise MemorySpaceValidationError(
            "participants must be a list", "INVALID_PARTICIPANT"
        )

    # Empty lists are valid - a memory space can have no participants
    if len(participants) == 0:
        return

    # Track participant IDs to check for duplicates
    participant_ids = set()

    for i, participant in enumerate(participants):
        # Validate individual participant
        validate_participant(participant)

        # Check for duplicates
        p_id = participant["id"]
        if p_id in participant_ids:
            raise MemorySpaceValidationError(
                f'Duplicate participant ID "{p_id}" found in participants array',
                "DUPLICATE_PARTICIPANT",
                "participants",
            )
        participant_ids.add(p_id)


def validate_participant_ids(participant_ids: List[str]) -> None:
    """
    Validates an array of participant IDs (strings).

    Used for update_participants where only IDs are passed, not full objects.

    Args:
        participant_ids: List of participant ID strings to validate

    Raises:
        MemorySpaceValidationError: If validation fails
    """
    if not isinstance(participant_ids, list):
        raise MemorySpaceValidationError(
            "participant_ids must be a list", "INVALID_PARTICIPANT"
        )

    # Empty lists are valid
    if len(participant_ids) == 0:
        return

    # Track IDs to check for duplicates
    seen_ids: set[str] = set()

    for i, p_id in enumerate(participant_ids):
        # Validate individual ID
        if not p_id or not isinstance(p_id, str) or not p_id.strip():
            raise MemorySpaceValidationError(
                f"Participant ID at index {i} is required and cannot be empty",
                "MISSING_PARTICIPANT_ID",
                "participant_ids",
            )

        # Check for duplicates
        if p_id in seen_ids:
            raise MemorySpaceValidationError(
                f'Duplicate participant ID "{p_id}" found in participant_ids array',
                "DUPLICATE_PARTICIPANT",
                "participant_ids",
            )
        seen_ids.add(p_id)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# String Field Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_search_query(query: str) -> None:
    """
    Validates search query.

    Args:
        query: Query string to validate

    Raises:
        MemorySpaceValidationError: If validation fails
    """
    if not query or not isinstance(query, str):
        raise MemorySpaceValidationError(
            "Search query is required and must be a string", "EMPTY_QUERY", "query"
        )

    trimmed_query = query.strip()
    if not trimmed_query:
        raise MemorySpaceValidationError(
            "Search query cannot be empty", "EMPTY_QUERY", "query"
        )

    if len(trimmed_query) > 500:
        raise MemorySpaceValidationError(
            f"Search query must be 500 characters or less, got {len(trimmed_query)}",
            "EMPTY_QUERY",
            "query",
        )


def validate_name(name: Optional[str]) -> None:
    """
    Validates name field.

    Args:
        name: Name to validate

    Raises:
        MemorySpaceValidationError: If validation fails
    """
    if name is None:
        return

    if not isinstance(name, str):
        raise MemorySpaceValidationError("name must be a string", "INVALID_NAME", "name")

    trimmed_name = name.strip()
    if not trimmed_name:
        raise MemorySpaceValidationError(
            "name cannot be empty when provided", "INVALID_NAME", "name"
        )

    if len(trimmed_name) > 200:
        raise MemorySpaceValidationError(
            f"name must be 200 characters or less, got {len(trimmed_name)}",
            "INVALID_NAME",
            "name",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Update Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_update_params(updates: Dict[str, Any]) -> None:
    """
    Validates that update parameters contain at least one field.

    Args:
        updates: Updates dict to validate

    Raises:
        MemorySpaceValidationError: If validation fails
    """
    if updates is None or not isinstance(updates, dict):
        raise MemorySpaceValidationError("Updates must be a dictionary", "EMPTY_UPDATES")

    if len(updates) == 0:
        raise MemorySpaceValidationError(
            "At least one field must be provided for update", "EMPTY_UPDATES"
        )
