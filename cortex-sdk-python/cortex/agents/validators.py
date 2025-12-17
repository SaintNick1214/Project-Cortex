"""
Agents API Validation

Client-side validation for agent operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

from typing import Any, Dict, Optional

from ..types import (
    AgentFilters,
    AgentRegistration,
    ExportAgentsOptions,
    UnregisterAgentOptions,
)


class AgentValidationError(Exception):
    """Custom exception for agent validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize agent validation error.

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


def validate_agent_id(agent_id: str, field_name: str = "agent_id") -> None:
    """
    Validates agent ID is non-empty and within length limits.

    Args:
        agent_id: Agent ID to validate
        field_name: Name of the field being validated

    Raises:
        AgentValidationError: If agent ID is invalid
    """
    if agent_id is None:
        raise AgentValidationError(
            f"{field_name} is required", "MISSING_AGENT_ID", field_name
        )

    if not isinstance(agent_id, str):
        raise AgentValidationError(
            f"{field_name} must be a string", "INVALID_AGENT_ID_FORMAT", field_name
        )

    if not agent_id.strip():
        raise AgentValidationError(
            f"{field_name} cannot be empty or whitespace only",
            "EMPTY_AGENT_ID",
            field_name,
        )

    if len(agent_id) > 256:
        raise AgentValidationError(
            f"{field_name} cannot exceed 256 characters, got {len(agent_id)}",
            "AGENT_ID_TOO_LONG",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Agent Name Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_agent_name(name: str, field_name: str = "name") -> None:
    """
    Validates agent name is non-empty and within length limits.

    Args:
        name: Agent name to validate
        field_name: Name of the field being validated

    Raises:
        AgentValidationError: If agent name is invalid
    """
    if name is None:
        raise AgentValidationError(
            f"{field_name} is required", "MISSING_AGENT_NAME", field_name
        )

    if not isinstance(name, str):
        raise AgentValidationError(
            f"{field_name} must be a string", "INVALID_NAME_FORMAT", field_name
        )

    if not name.strip():
        raise AgentValidationError(
            f"{field_name} cannot be empty or whitespace only",
            "EMPTY_AGENT_NAME",
            field_name,
        )

    if len(name) > 200:
        raise AgentValidationError(
            f"{field_name} cannot exceed 200 characters, got {len(name)}",
            "AGENT_NAME_TOO_LONG",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Agent Registration Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_agent_registration(agent: AgentRegistration) -> None:
    """
    Validates complete agent registration structure.

    Args:
        agent: Agent registration to validate

    Raises:
        AgentValidationError: If agent registration is invalid
    """
    if not agent:
        raise AgentValidationError(
            "Agent registration object is required", "MISSING_AGENT_ID"
        )

    # Validate required fields exist (not None)
    if agent.id is None:
        raise AgentValidationError("Agent ID is required", "MISSING_AGENT_ID", "id")

    if agent.name is None:
        raise AgentValidationError(
            "Agent name is required", "MISSING_AGENT_NAME", "name"
        )

    # Validate field formats (these will check for empty strings)
    validate_agent_id(agent.id, "id")
    validate_agent_name(agent.name, "name")

    # Validate optional fields if provided
    if agent.metadata is not None:
        validate_metadata(agent.metadata, "metadata")

    if agent.config is not None:
        validate_config(agent.config, "config")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Status Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALID_STATUSES = ["active", "inactive", "archived"]


def validate_agent_status(status: str, field_name: str = "status") -> None:
    """
    Validates agent status value.

    Args:
        status: Status to validate
        field_name: Name of the field being validated

    Raises:
        AgentValidationError: If status is invalid
    """
    if not status or not isinstance(status, str):
        raise AgentValidationError(
            f"{field_name} is required and must be a string",
            "INVALID_STATUS_VALUE",
            field_name,
        )

    if status not in VALID_STATUSES:
        raise AgentValidationError(
            f"Invalid status '{status}'. Valid values: {', '.join(VALID_STATUSES)}",
            "INVALID_STATUS",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# List Parameters Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALID_SORT_BY = ["name", "registered_at", "last_active"]


def validate_list_parameters(
    status: Optional[str], limit: int, offset: int, sort_by: str
) -> None:
    """
    Validates list() method parameters.

    Args:
        status: Optional status filter
        limit: Maximum results
        offset: Number of results to skip
        sort_by: Sort field

    Raises:
        AgentValidationError: If parameters are invalid
    """
    # Validate limit
    if not isinstance(limit, int):
        raise AgentValidationError(
            "limit must be an integer", "INVALID_LIMIT_VALUE", "limit"
        )

    if limit < 1 or limit > 1000:
        raise AgentValidationError(
            f"limit must be between 1 and 1000, got {limit}",
            "INVALID_LIMIT_VALUE",
            "limit",
        )

    # Validate offset
    if not isinstance(offset, int):
        raise AgentValidationError(
            "offset must be an integer", "INVALID_OFFSET_VALUE", "offset"
        )

    if offset < 0:
        raise AgentValidationError(
            f"offset must be >= 0, got {offset}", "INVALID_OFFSET_VALUE", "offset"
        )

    # Validate status if provided
    if status is not None:
        validate_agent_status(status, "status")

    # Validate sort_by
    if sort_by not in VALID_SORT_BY:
        raise AgentValidationError(
            f"Invalid sort_by '{sort_by}'. Valid values: {', '.join(VALID_SORT_BY)}",
            "INVALID_SORT_BY",
            "sort_by",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Search Parameters Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_search_parameters(
    filters: Optional[Dict[str, Any]], limit: int
) -> None:
    """
    Validates search() method parameters.

    Args:
        filters: Optional filter dict
        limit: Maximum results

    Raises:
        AgentValidationError: If parameters are invalid
    """
    # Validate filters if provided
    if filters is not None:
        if not isinstance(filters, dict):
            raise AgentValidationError(
                "filters must be a dict or None", "INVALID_METADATA_FORMAT", "filters"
            )

    # Validate limit
    if not isinstance(limit, int):
        raise AgentValidationError(
            "limit must be an integer", "INVALID_LIMIT_VALUE", "limit"
        )

    if limit < 1 or limit > 1000:
        raise AgentValidationError(
            f"limit must be between 1 and 1000, got {limit}",
            "INVALID_LIMIT_VALUE",
            "limit",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Unregister Options Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_unregister_options(options: UnregisterAgentOptions) -> None:
    """
    Validates unregister options.

    Args:
        options: Unregister options to validate

    Raises:
        AgentValidationError: If options are invalid
    """
    if not options:
        return  # Options are optional

    # Conflicting options: dry_run=True requires verify to be enabled
    if options.dry_run is True and options.verify is False:
        raise AgentValidationError(
            "Cannot disable verification in dry run mode. Set verify=True or remove verify option.",
            "CONFLICTING_OPTIONS",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Metadata/Config Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_metadata(metadata: Dict[str, Any], field_name: str = "metadata") -> None:
    """
    Validates metadata is a dict.

    Args:
        metadata: Metadata to validate
        field_name: Name of the field being validated

    Raises:
        AgentValidationError: If metadata is invalid
    """
    if metadata is None:
        raise AgentValidationError(
            f"{field_name} cannot be None", "INVALID_METADATA_FORMAT", field_name
        )

    if not isinstance(metadata, dict):
        raise AgentValidationError(
            f"{field_name} must be a dict", "INVALID_METADATA_FORMAT", field_name
        )

    if isinstance(metadata, list):
        raise AgentValidationError(
            f"{field_name} must be a dict, not a list",
            "INVALID_METADATA_FORMAT",
            field_name,
        )


def validate_config(config: Dict[str, Any], field_name: str = "config") -> None:
    """
    Validates config is a dict.

    Args:
        config: Config to validate
        field_name: Name of the field being validated

    Raises:
        AgentValidationError: If config is invalid
    """
    if config is None:
        raise AgentValidationError(
            f"{field_name} cannot be None", "INVALID_CONFIG_FORMAT", field_name
        )

    if not isinstance(config, dict):
        raise AgentValidationError(
            f"{field_name} must be a dict", "INVALID_CONFIG_FORMAT", field_name
        )

    if isinstance(config, list):
        raise AgentValidationError(
            f"{field_name} must be a dict, not a list",
            "INVALID_CONFIG_FORMAT",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Agent Filters Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALID_SORT_BY_FILTERS = ["name", "registeredAt", "lastActive"]
VALID_SORT_ORDER = ["asc", "desc"]
VALID_CAPABILITIES_MATCH = ["any", "all"]


def validate_agent_filters(filters: AgentFilters) -> None:
    """
    Validates agent filter options.

    Matches TypeScript SDK validateAgentFilters() behavior.

    Args:
        filters: Agent filters to validate

    Raises:
        AgentValidationError: If filters are invalid
    """
    if not filters:
        return  # Filters are optional

    # Validate limit
    if filters.limit is not None:
        if not isinstance(filters.limit, int):
            raise AgentValidationError(
                "limit must be an integer", "INVALID_LIMIT_VALUE", "limit"
            )
        if filters.limit < 1 or filters.limit > 1000:
            raise AgentValidationError(
                f"limit must be between 1 and 1000, got {filters.limit}",
                "INVALID_LIMIT_VALUE",
                "limit",
            )

    # Validate offset
    if filters.offset is not None:
        if not isinstance(filters.offset, int):
            raise AgentValidationError(
                "offset must be an integer", "INVALID_OFFSET_VALUE", "offset"
            )
        if filters.offset < 0:
            raise AgentValidationError(
                f"offset must be >= 0, got {filters.offset}",
                "INVALID_OFFSET_VALUE",
                "offset",
            )

    # Validate status
    if filters.status is not None:
        validate_agent_status(filters.status, "status")

    # Validate metadata
    if filters.metadata is not None:
        validate_metadata(filters.metadata, "metadata")

    # Validate timestamp range
    if filters.registered_after is not None and filters.registered_before is not None:
        if filters.registered_after >= filters.registered_before:
            raise AgentValidationError(
                "registered_after must be before registered_before",
                "INVALID_TIMESTAMP_RANGE",
            )

    # Validate last_active timestamp range
    if filters.last_active_after is not None and filters.last_active_before is not None:
        if filters.last_active_after >= filters.last_active_before:
            raise AgentValidationError(
                "last_active_after must be before last_active_before",
                "INVALID_TIMESTAMP_RANGE",
            )

    # Validate sortBy
    if filters.sort_by is not None:
        if filters.sort_by not in VALID_SORT_BY_FILTERS:
            raise AgentValidationError(
                f"Invalid sort_by '{filters.sort_by}'. Valid values: {', '.join(VALID_SORT_BY_FILTERS)}",
                "INVALID_SORT_BY",
                "sort_by",
            )

    # Validate sortOrder
    if filters.sort_order is not None:
        if filters.sort_order not in VALID_SORT_ORDER:
            raise AgentValidationError(
                f"Invalid sort_order '{filters.sort_order}'. Valid values: {', '.join(VALID_SORT_ORDER)}",
                "INVALID_SORT_ORDER",
                "sort_order",
            )

    # Validate capabilities_match
    if filters.capabilities_match is not None:
        if filters.capabilities_match not in VALID_CAPABILITIES_MATCH:
            raise AgentValidationError(
                f"Invalid capabilities_match '{filters.capabilities_match}'. Valid values: {', '.join(VALID_CAPABILITIES_MATCH)}",
                "INVALID_CAPABILITIES_MATCH",
                "capabilities_match",
            )

    # Validate capabilities is a list of strings
    if filters.capabilities is not None:
        if not isinstance(filters.capabilities, list):
            raise AgentValidationError(
                "capabilities must be a list", "INVALID_CAPABILITIES", "capabilities"
            )
        for cap in filters.capabilities:
            if not isinstance(cap, str):
                raise AgentValidationError(
                    "capabilities must be a list of strings",
                    "INVALID_CAPABILITIES",
                    "capabilities",
                )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Export Options Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALID_EXPORT_FORMATS = ["json", "csv"]


def validate_export_options(options: ExportAgentsOptions) -> None:
    """
    Validates export options.

    Matches TypeScript SDK validateExportOptions() behavior.

    Args:
        options: Export options to validate

    Raises:
        AgentValidationError: If options are invalid
    """
    if not options:
        raise AgentValidationError(
            "Export options are required", "MISSING_OPTIONS"
        )

    # Validate format is provided
    if not options.format:
        raise AgentValidationError(
            "format is required", "MISSING_FORMAT", "format"
        )

    # Validate format value
    if options.format not in VALID_EXPORT_FORMATS:
        raise AgentValidationError(
            f"Invalid format '{options.format}'. Valid values: {', '.join(VALID_EXPORT_FORMATS)}",
            "INVALID_FORMAT",
            "format",
        )

    # Validate filters if provided
    if options.filters:
        validate_agent_filters(options.filters)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Update Payload Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_update_payload(
    agent_id: str, updates: Dict[str, Any]
) -> None:
    """
    Validates update operation has valid fields.

    Matches TypeScript SDK validateUpdatePayload() behavior.

    Args:
        agent_id: Agent ID to update
        updates: Updates dict to validate

    Raises:
        AgentValidationError: If payload is invalid
    """
    # Validate agentId
    validate_agent_id(agent_id, "agent_id")

    # Check that at least one field is provided
    has_updates = (
        updates.get("name") is not None
        or updates.get("description") is not None
        or updates.get("metadata") is not None
        or updates.get("config") is not None
        or updates.get("status") is not None
    )

    if not has_updates:
        raise AgentValidationError(
            "At least one field must be provided for update (name, description, metadata, config, or status)",
            "MISSING_UPDATES",
        )

    # Validate individual fields if provided
    if updates.get("name") is not None:
        validate_agent_name(updates["name"], "name")

    if updates.get("metadata") is not None:
        validate_metadata(updates["metadata"], "metadata")

    if updates.get("config") is not None:
        validate_config(updates["config"], "config")

    if updates.get("status") is not None:
        validate_agent_status(updates["status"], "status")
