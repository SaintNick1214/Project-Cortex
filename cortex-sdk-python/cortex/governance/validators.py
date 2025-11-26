"""
Governance API Validation

Client-side validation for governance operations to catch errors before
they reach the backend, providing faster feedback and better error messages.
"""

import math
import re
from datetime import datetime
from typing import List, Optional

from ..types import (
    EnforcementOptions,
    GovernancePolicy,
    ImportanceRange,
    PolicyScope,
)


class GovernanceValidationError(Exception):
    """Custom exception for governance validation failures."""

    def __init__(self, message: str, code: str, field: Optional[str] = None) -> None:
        """
        Initialize governance validation error.

        Args:
            message: Human-readable error message
            code: Error code for programmatic handling
            field: Optional field name that failed validation
        """
        self.code = code
        self.field = field
        super().__init__(message)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Policy Structure Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_governance_policy(policy: GovernancePolicy) -> None:
    """
    Validates complete governance policy structure.

    Args:
        policy: Governance policy to validate

    Raises:
        GovernanceValidationError: If policy structure is invalid
    """
    if not policy:
        raise GovernanceValidationError("Policy is required", "MISSING_POLICY")

    # Check required top-level fields
    if not policy.conversations:
        raise GovernanceValidationError(
            "Policy must include conversations configuration",
            "MISSING_REQUIRED_FIELD",
            "conversations",
        )

    if not policy.immutable:
        raise GovernanceValidationError(
            "Policy must include immutable configuration",
            "MISSING_REQUIRED_FIELD",
            "immutable",
        )

    if not policy.mutable:
        raise GovernanceValidationError(
            "Policy must include mutable configuration",
            "MISSING_REQUIRED_FIELD",
            "mutable",
        )

    if not policy.vector:
        raise GovernanceValidationError(
            "Policy must include vector configuration",
            "MISSING_REQUIRED_FIELD",
            "vector",
        )

    if not policy.compliance:
        raise GovernanceValidationError(
            "Policy must include compliance configuration",
            "MISSING_REQUIRED_FIELD",
            "compliance",
        )

    # Validate nested structures
    if not policy.conversations.retention:
        raise GovernanceValidationError(
            "Conversations policy must include retention configuration",
            "MISSING_REQUIRED_FIELD",
            "conversations.retention",
        )

    if not policy.conversations.purging:
        raise GovernanceValidationError(
            "Conversations policy must include purging configuration",
            "MISSING_REQUIRED_FIELD",
            "conversations.purging",
        )

    if not policy.immutable.retention:
        raise GovernanceValidationError(
            "Immutable policy must include retention configuration",
            "MISSING_REQUIRED_FIELD",
            "immutable.retention",
        )

    if not policy.immutable.purging:
        raise GovernanceValidationError(
            "Immutable policy must include purging configuration",
            "MISSING_REQUIRED_FIELD",
            "immutable.purging",
        )

    if not policy.mutable.retention:
        raise GovernanceValidationError(
            "Mutable policy must include retention configuration",
            "MISSING_REQUIRED_FIELD",
            "mutable.retention",
        )

    if not policy.mutable.purging:
        raise GovernanceValidationError(
            "Mutable policy must include purging configuration",
            "MISSING_REQUIRED_FIELD",
            "mutable.purging",
        )

    if not policy.vector.retention:
        raise GovernanceValidationError(
            "Vector policy must include retention configuration",
            "MISSING_REQUIRED_FIELD",
            "vector.retention",
        )

    if not policy.vector.purging:
        raise GovernanceValidationError(
            "Vector policy must include purging configuration",
            "MISSING_REQUIRED_FIELD",
            "vector.purging",
        )


def validate_period_format(period: str, field_name: str = "period") -> None:
    """
    Validates period format strings like "7y", "30d", "1m".

    Args:
        period: Period string to validate
        field_name: Name of the field being validated

    Raises:
        GovernanceValidationError: If period format is invalid
    """
    if not period or not isinstance(period, str):
        raise GovernanceValidationError(
            f"{field_name} is required and must be a string",
            "INVALID_PERIOD_FORMAT",
            field_name,
        )

    period_regex = re.compile(r"^\d+[dmy]$")
    if not period_regex.match(period):
        raise GovernanceValidationError(
            f'Invalid period format "{period}". Must be in format like "7d" (days), "30m" (months), or "1y" (years)',
            "INVALID_PERIOD_FORMAT",
            field_name,
        )


def validate_importance_ranges(ranges: List[ImportanceRange]) -> None:
    """
    Validates importance ranges for vector retention.

    Args:
        ranges: List of importance ranges to validate

    Raises:
        GovernanceValidationError: If ranges are invalid or overlapping
    """
    if not isinstance(ranges, list):
        raise GovernanceValidationError(
            "Importance ranges must be a list", "INVALID_IMPORTANCE_RANGE"
        )

    for i, range_obj in enumerate(ranges):
        if not hasattr(range_obj, "range") or not hasattr(range_obj, "versions"):
            raise GovernanceValidationError(
                f"Range at index {i} must have 'range' and 'versions' attributes",
                "INVALID_IMPORTANCE_RANGE",
            )

        range_tuple = range_obj.range
        versions = range_obj.versions

        if not isinstance(range_tuple, (list, tuple)) or len(range_tuple) != 2:
            raise GovernanceValidationError(
                f"Range at index {i} must be a tuple [min, max]",
                "INVALID_IMPORTANCE_RANGE",
            )

        min_val, max_val = range_tuple

        # Validate range bounds
        if not isinstance(min_val, (int, float)) or not isinstance(
            max_val, (int, float)
        ):
            raise GovernanceValidationError(
                f"Range at index {i} must contain numbers",
                "INVALID_IMPORTANCE_RANGE",
            )

        # Check for NaN values (NaN comparisons always return False)
        if math.isnan(min_val) or math.isnan(max_val):
            raise GovernanceValidationError(
                f"Range at index {i} cannot contain NaN values",
                "INVALID_IMPORTANCE_RANGE",
            )

        if min_val < 0 or min_val > 100:
            raise GovernanceValidationError(
                f"Range minimum at index {i} must be between 0 and 100, got {min_val}",
                "INVALID_IMPORTANCE_RANGE",
            )

        if max_val < 0 or max_val > 100:
            raise GovernanceValidationError(
                f"Range maximum at index {i} must be between 0 and 100, got {max_val}",
                "INVALID_IMPORTANCE_RANGE",
            )

        if min_val >= max_val:
            raise GovernanceValidationError(
                f"Range at index {i} must have min < max, got [{min_val}, {max_val}]",
                "INVALID_IMPORTANCE_RANGE",
            )

        # Validate versions (accept both int and float from JSON parsing)
        if not isinstance(versions, (int, float)) or math.isnan(versions) or versions < -1:
            raise GovernanceValidationError(
                f"Versions at index {i} must be a number >= -1 (where -1 means unlimited), got {versions}",
                "INVALID_VERSIONS",
            )

        # Check for overlaps with previous ranges
        for j in range(i):
            prev_range = ranges[j].range
            prev_min, prev_max = prev_range

            # Check if ranges overlap
            if (
                (min_val >= prev_min and min_val <= prev_max)
                or (max_val >= prev_min and max_val <= prev_max)
                or (min_val <= prev_min and max_val >= prev_max)
            ):
                raise GovernanceValidationError(
                    f"Range [{min_val}, {max_val}] at index {i} overlaps with range [{prev_min}, {prev_max}] at index {j}",
                    "OVERLAPPING_IMPORTANCE_RANGES",
                )


def validate_version_count(versions: int, field_name: str = "versions") -> None:
    """
    Validates version count (must be >= -1, where -1 means unlimited).

    Args:
        versions: Version count to validate
        field_name: Name of the field being validated

    Raises:
        GovernanceValidationError: If version count is invalid
    """
    # Accept both int and float (JSON parsing can return floats)
    if not isinstance(versions, (int, float)):
        raise GovernanceValidationError(
            f"{field_name} must be a number", "INVALID_VERSIONS", field_name
        )

    # Check for NaN values (NaN comparisons always return False)
    if math.isnan(versions):
        raise GovernanceValidationError(
            f"{field_name} cannot be NaN", "INVALID_VERSIONS", field_name
        )

    if versions < -1:
        raise GovernanceValidationError(
            f"{field_name} must be >= -1 (where -1 means unlimited), got {versions}",
            "INVALID_VERSIONS",
            field_name,
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Scope Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_policy_scope(scope: PolicyScope) -> None:
    """
    Validates policy scope (organizationId or memorySpaceId).

    Args:
        scope: Policy scope to validate

    Raises:
        GovernanceValidationError: If scope is invalid
    """
    if not scope:
        raise GovernanceValidationError("Scope is required", "MISSING_SCOPE")

    has_org_id = (
        scope.organization_id is not None
        and isinstance(scope.organization_id, str)
        and scope.organization_id.strip()
    )
    has_space_id = (
        scope.memory_space_id is not None
        and isinstance(scope.memory_space_id, str)
        and scope.memory_space_id.strip()
    )

    if not has_org_id and not has_space_id:
        raise GovernanceValidationError(
            "Scope must include either organization_id or memory_space_id",
            "INVALID_SCOPE",
        )

    # Validate non-empty strings
    if scope.organization_id is not None and not has_org_id:
        raise GovernanceValidationError(
            "organization_id cannot be empty",
            "INVALID_SCOPE",
            "organization_id",
        )

    if scope.memory_space_id is not None and not has_space_id:
        raise GovernanceValidationError(
            "memory_space_id cannot be empty", "INVALID_SCOPE", "memory_space_id"
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Enforcement Options Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALID_LAYERS = ["conversations", "immutable", "mutable", "vector"]
VALID_RULES = ["retention", "purging"]


def validate_enforcement_options(options: EnforcementOptions) -> None:
    """
    Validates enforcement options.

    Args:
        options: Enforcement options to validate

    Raises:
        GovernanceValidationError: If options are invalid
    """
    if not options:
        raise GovernanceValidationError(
            "Enforcement options are required", "MISSING_OPTIONS"
        )

    # Validate scope if provided (scope is optional for global enforcement)
    if options.scope:
        validate_policy_scope(options.scope)

    # Validate layers if provided
    if options.layers is not None:
        if not isinstance(options.layers, list):
            raise GovernanceValidationError("Layers must be a list", "INVALID_LAYERS")

        if len(options.layers) == 0:
            raise GovernanceValidationError(
                f"Layers array cannot be empty. Valid layers: {', '.join(VALID_LAYERS)}",
                "INVALID_LAYERS",
            )

        for layer in options.layers:
            if layer not in VALID_LAYERS:
                raise GovernanceValidationError(
                    f'Invalid layer "{layer}". Valid layers: {", ".join(VALID_LAYERS)}',
                    "INVALID_LAYERS",
                )

    # Validate rules if provided
    if options.rules is not None:
        if not isinstance(options.rules, list):
            raise GovernanceValidationError("Rules must be a list", "INVALID_RULES")

        if len(options.rules) == 0:
            raise GovernanceValidationError(
                f"Rules array cannot be empty. Valid rules: {', '.join(VALID_RULES)}",
                "INVALID_RULES",
            )

        for rule in options.rules:
            if rule not in VALID_RULES:
                raise GovernanceValidationError(
                    f'Invalid rule "{rule}". Valid rules: {", ".join(VALID_RULES)}',
                    "INVALID_RULES",
                )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Date/Period Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def validate_date_range(start: datetime, end: datetime) -> None:
    """
    Validates date range (start must be before end).

    Args:
        start: Start date
        end: End date

    Raises:
        GovernanceValidationError: If date range is invalid
    """
    if not isinstance(start, datetime):
        raise GovernanceValidationError(
            "Start date must be a valid datetime object",
            "INVALID_DATE_RANGE",
            "start",
        )

    if not isinstance(end, datetime):
        raise GovernanceValidationError(
            "End date must be a valid datetime object", "INVALID_DATE_RANGE", "end"
        )

    if start >= end:
        raise GovernanceValidationError(
            "Start date must be before end date", "INVALID_DATE_RANGE"
        )


VALID_PERIODS = ["7d", "30d", "90d", "1y"]


def validate_stats_period(period: str) -> None:
    """
    Validates enforcement stats period.

    Args:
        period: Period string to validate

    Raises:
        GovernanceValidationError: If period is invalid
    """
    if not period or not isinstance(period, str):
        raise GovernanceValidationError(
            "Period is required and must be a string", "INVALID_PERIOD"
        )

    if period not in VALID_PERIODS:
        raise GovernanceValidationError(
            f'Invalid period "{period}". Valid periods: {", ".join(VALID_PERIODS)}',
            "INVALID_PERIOD",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Template Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALID_TEMPLATES = ["GDPR", "HIPAA", "SOC2", "FINRA"]


def validate_compliance_template(template: str) -> None:
    """
    Validates compliance template name.

    Args:
        template: Template name to validate

    Raises:
        GovernanceValidationError: If template is invalid
    """
    if not template or not isinstance(template, str):
        raise GovernanceValidationError(
            "Compliance template is required", "INVALID_COMPLIANCE_MODE"
        )

    if template not in VALID_TEMPLATES:
        raise GovernanceValidationError(
            f'Invalid compliance template "{template}". Valid templates: {", ".join(VALID_TEMPLATES)}',
            "INVALID_COMPLIANCE_MODE",
        )
