"""
Governance API - Data Retention, Purging, and Compliance Rules

Centralized control over data retention, purging, and compliance rules
across all Cortex storage layers.
"""

from typing import Any, Optional

from .._convex_async import AsyncConvexClient
from ..types import (
    ComplianceReport,
    ComplianceReportOptions,
    ComplianceTemplate,
    EnforcementOptions,
    EnforcementResult,
    EnforcementStats,
    EnforcementStatsOptions,
    GovernancePolicy,
    PolicyResult,
    PolicyScope,
    SimulationOptions,
    SimulationResult,
)
from .validators import (
    GovernanceValidationError,
    validate_compliance_template,
    validate_date_range,
    validate_enforcement_options,
    validate_importance_ranges,
    validate_period_format,
    validate_policy_scope,
    validate_stats_period,
    validate_version_count,
)


class GovernanceAPI:
    """
    Governance Policies API - Data Retention & Compliance

    Provides centralized control over data retention, purging, and compliance
    rules across all Cortex storage layers (Conversations, Immutable, Mutable, Vector).

    Supports GDPR, HIPAA, SOC2, and FINRA compliance templates with flexible
    organization-wide and memory-space-specific policies.

    Example:
        >>> # Apply GDPR template
        >>> policy = await cortex.governance.get_template("GDPR")
        >>> await cortex.governance.set_policy(
        ...     GovernancePolicy(
        ...         organization_id="my-org",
        ...         **policy.to_dict()
        ...     )
        ... )
        >>>
        >>> # Override for audit agent (unlimited retention)
        >>> await cortex.governance.set_agent_override(
        ...     "audit-agent",
        ...     GovernancePolicy(
        ...         vector=VectorPolicy(
        ...             retention=VectorRetention(default_versions=-1)
        ...         )
        ...     )
        ... )
    """

    def __init__(
        self,
        client: AsyncConvexClient,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
    ) -> None:
        """
        Initialize Governance API.

        Args:
            client: Async Convex client
            graph_adapter: Optional graph database adapter
            resilience: Optional resilience layer for overload protection

        """
        self._client = client
        self._graph_adapter = graph_adapter
        self._resilience = resilience

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    async def set_policy(self, policy: GovernancePolicy) -> PolicyResult:
        """
        Set governance policy for organization or memory space.

        Args:
            policy: Complete governance policy

        Returns:
            Policy result with confirmation

        Example:
            >>> await cortex.governance.set_policy(
            ...     GovernancePolicy(
            ...         organization_id="org-123",
            ...         conversations=ConversationsPolicy(...),
            ...         immutable=ImmutablePolicy(...),
            ...         mutable=MutablePolicy(...),
            ...         vector=VectorPolicy(...),
            ...         compliance=ComplianceSettings(...)
            ...     )
            ... )

        """
        # Validate policy is provided
        if not policy:
            raise GovernanceValidationError("Policy is required", "MISSING_POLICY")

        # Validate at least one scope is provided
        if not policy.organization_id and not policy.memory_space_id:
            raise GovernanceValidationError(
                "Policy must specify either organization_id or memory_space_id",
                "MISSING_SCOPE",
            )

        # Validate period formats in conversations policy
        if policy.conversations and policy.conversations.retention:
            if policy.conversations.retention.delete_after:
                validate_period_format(
                    policy.conversations.retention.delete_after,
                    "conversations.retention.delete_after",
                )
            if policy.conversations.retention.archive_after:
                validate_period_format(
                    policy.conversations.retention.archive_after,
                    "conversations.retention.archive_after",
                )
        if policy.conversations and policy.conversations.purging:
            if policy.conversations.purging.delete_inactive_after:
                validate_period_format(
                    policy.conversations.purging.delete_inactive_after,
                    "conversations.purging.delete_inactive_after",
                )

        # Validate period formats in mutable policy
        if policy.mutable and policy.mutable.retention:
            if policy.mutable.retention.default_ttl:
                validate_period_format(
                    policy.mutable.retention.default_ttl,
                    "mutable.retention.default_ttl",
                )
            if policy.mutable.retention.purge_inactive_after:
                validate_period_format(
                    policy.mutable.retention.purge_inactive_after,
                    "mutable.retention.purge_inactive_after",
                )
        if policy.mutable and policy.mutable.purging:
            if policy.mutable.purging.delete_unaccessed_after:
                validate_period_format(
                    policy.mutable.purging.delete_unaccessed_after,
                    "mutable.purging.delete_unaccessed_after",
                )

        # Validate period formats in immutable policy
        if policy.immutable and policy.immutable.purging:
            if policy.immutable.purging.purge_unused_after:
                validate_period_format(
                    policy.immutable.purging.purge_unused_after,
                    "immutable.purging.purge_unused_after",
                )

        # Validate version counts
        if policy.immutable and policy.immutable.retention:
            if policy.immutable.retention.default_versions is not None:
                validate_version_count(
                    policy.immutable.retention.default_versions,
                    "immutable.retention.default_versions",
                )
        if policy.vector and policy.vector.retention:
            if policy.vector.retention.default_versions is not None:
                validate_version_count(
                    policy.vector.retention.default_versions,
                    "vector.retention.default_versions",
                )

        # Validate vector importance ranges
        if policy.vector and policy.vector.retention:
            if policy.vector.retention.by_importance:
                validate_importance_ranges(policy.vector.retention.by_importance)

        policy_dict = policy.to_dict()
        # Remove None values to avoid Convex validation errors
        policy_dict = {k: v for k, v in policy_dict.items() if v is not None}

        result = await self._client.mutation(
            "governance:setPolicy", {"policy": policy_dict}
        )
        return PolicyResult.from_dict(result)

    async def get_policy(self, scope: Optional[PolicyScope] = None) -> GovernancePolicy:
        """
        Get current governance policy.

        Args:
            scope: Optional organization or memory space scope

        Returns:
            Current policy (includes org defaults + overrides)

        Example:
            >>> # Get org-wide policy
            >>> org_policy = await cortex.governance.get_policy(
            ...     PolicyScope(organization_id="org-123")
            ... )
            >>>
            >>> # Get memory-space-specific policy
            >>> space_policy = await cortex.governance.get_policy(
            ...     PolicyScope(memory_space_id="audit-agent-space")
            ... )

        """
        # If scope provided, validate it
        if scope and (
            scope.organization_id is not None or scope.memory_space_id is not None
        ):
            validate_policy_scope(scope)

        scope_dict = scope.to_dict() if scope else {}
        # Remove None values
        scope_dict = {k: v for k, v in scope_dict.items() if v is not None}

        result = await self._client.query("governance:getPolicy", {"scope": scope_dict})
        return GovernancePolicy.from_dict(result)

    async def set_agent_override(
        self, memory_space_id: str, overrides: GovernancePolicy
    ) -> None:
        """
        Override policy for specific memory space.

        Args:
            memory_space_id: Memory space to override
            overrides: Partial policy to override org defaults

        Example:
            >>> # Audit agent needs unlimited retention
            >>> await cortex.governance.set_agent_override(
            ...     "audit-agent",
            ...     GovernancePolicy(
            ...         vector=VectorPolicy(
            ...             retention=VectorRetention(default_versions=-1)
            ...         )
            ...     )
            ... )

        """
        # Validate memory_space_id
        if not memory_space_id or not memory_space_id.strip():
            raise GovernanceValidationError(
                "memory_space_id is required and cannot be empty",
                "MISSING_SCOPE",
                "memory_space_id",
            )

        # Validate override structure (same as set_policy but for partial)
        if overrides.conversations and overrides.conversations.retention:
            if overrides.conversations.retention.delete_after:
                validate_period_format(
                    overrides.conversations.retention.delete_after,
                    "conversations.retention.delete_after",
                )
            if overrides.conversations.retention.archive_after:
                validate_period_format(
                    overrides.conversations.retention.archive_after,
                    "conversations.retention.archive_after",
                )
        if overrides.conversations and overrides.conversations.purging:
            if overrides.conversations.purging.delete_inactive_after:
                validate_period_format(
                    overrides.conversations.purging.delete_inactive_after,
                    "conversations.purging.delete_inactive_after",
                )

        if overrides.mutable and overrides.mutable.retention:
            if overrides.mutable.retention.default_ttl:
                validate_period_format(
                    overrides.mutable.retention.default_ttl,
                    "mutable.retention.default_ttl",
                )
            if overrides.mutable.retention.purge_inactive_after:
                validate_period_format(
                    overrides.mutable.retention.purge_inactive_after,
                    "mutable.retention.purge_inactive_after",
                )
        if overrides.mutable and overrides.mutable.purging:
            if overrides.mutable.purging.delete_unaccessed_after:
                validate_period_format(
                    overrides.mutable.purging.delete_unaccessed_after,
                    "mutable.purging.delete_unaccessed_after",
                )

        if overrides.immutable and overrides.immutable.purging:
            if overrides.immutable.purging.purge_unused_after:
                validate_period_format(
                    overrides.immutable.purging.purge_unused_after,
                    "immutable.purging.purge_unused_after",
                )

        if overrides.immutable and overrides.immutable.retention:
            if overrides.immutable.retention.default_versions is not None:
                validate_version_count(
                    overrides.immutable.retention.default_versions,
                    "immutable.retention.default_versions",
                )
        if overrides.vector and overrides.vector.retention:
            if overrides.vector.retention.default_versions is not None:
                validate_version_count(
                    overrides.vector.retention.default_versions,
                    "vector.retention.default_versions",
                )

        if overrides.vector and overrides.vector.retention:
            if overrides.vector.retention.by_importance:
                validate_importance_ranges(overrides.vector.retention.by_importance)

        overrides_dict = overrides.to_dict()
        # Remove None values
        overrides_dict = {k: v for k, v in overrides_dict.items() if v is not None}

        await self._client.mutation(
            "governance:setAgentOverride",
            {"memorySpaceId": memory_space_id, "overrides": overrides_dict},
        )

    async def get_template(self, template: ComplianceTemplate) -> GovernancePolicy:
        """
        Get compliance template (GDPR, HIPAA, SOC2, FINRA).

        Args:
            template: Template name

        Returns:
            Pre-configured policy for compliance standard

        Example:
            >>> gdpr_policy = await cortex.governance.get_template("GDPR")
            >>> await cortex.governance.set_policy(
            ...     GovernancePolicy(
            ...         organization_id="org-123",
            ...         **gdpr_policy.to_dict()
            ...     )
            ... )

        """
        # Validate template name
        validate_compliance_template(template)

        result = await self._client.query("governance:getTemplate", {"template": template})
        return GovernancePolicy.from_dict(result)

    async def enforce(self, options: EnforcementOptions) -> EnforcementResult:
        """
        Manually enforce governance policy.

        Triggers immediate policy enforcement across specified layers and rules.
        Normally enforcement is automatic, but this allows manual triggering.

        Args:
            options: Enforcement options (layers, rules)

        Returns:
            Enforcement result with counts

        Example:
            >>> result = await cortex.governance.enforce(
            ...     EnforcementOptions(
            ...         layers=["vector", "immutable"],
            ...         rules=["retention", "purging"]
            ...     )
            ... )
            >>> print(f"Deleted {result.versions_deleted} versions")

        """
        # Validate enforcement options
        validate_enforcement_options(options)

        result = await self._client.mutation(
            "governance:enforce", {"options": options.to_dict()}
        )
        return EnforcementResult.from_dict(result)

    async def simulate(self, options: SimulationOptions) -> SimulationResult:
        """
        Simulate policy impact without applying.

        Previews what would happen if a policy were applied, without actually
        applying it. Useful for testing policy changes before committing.

        Args:
            options: Simulation options (policy to test)

        Returns:
            Simulation result with impact analysis

        Example:
            >>> impact = await cortex.governance.simulate(
            ...     SimulationOptions(
            ...         organization_id="org-123",
            ...         vector=VectorPolicy(
            ...             retention=VectorRetention(
            ...                 by_importance=[
            ...                     ImportanceRange(range=[0, 30], versions=1)
            ...                 ]
            ...             )
            ...         )
            ...     )
            ... )
            >>> print(f"Would delete {impact.versions_affected} versions")
            >>> print(f"Would save {impact.storage_freed} MB")
            >>> print(f"Estimated savings: ${impact.cost_savings}/month")

        """
        # Validate partial policy structure (same validations as set_policy)
        if options.conversations and options.conversations.retention:
            if options.conversations.retention.delete_after:
                validate_period_format(
                    options.conversations.retention.delete_after,
                    "conversations.retention.delete_after",
                )
            if options.conversations.retention.archive_after:
                validate_period_format(
                    options.conversations.retention.archive_after,
                    "conversations.retention.archive_after",
                )
        if options.conversations and options.conversations.purging:
            if options.conversations.purging.delete_inactive_after:
                validate_period_format(
                    options.conversations.purging.delete_inactive_after,
                    "conversations.purging.delete_inactive_after",
                )

        if options.mutable and options.mutable.retention:
            if options.mutable.retention.default_ttl:
                validate_period_format(
                    options.mutable.retention.default_ttl,
                    "mutable.retention.default_ttl",
                )
            if options.mutable.retention.purge_inactive_after:
                validate_period_format(
                    options.mutable.retention.purge_inactive_after,
                    "mutable.retention.purge_inactive_after",
                )
        if options.mutable and options.mutable.purging:
            if options.mutable.purging.delete_unaccessed_after:
                validate_period_format(
                    options.mutable.purging.delete_unaccessed_after,
                    "mutable.purging.delete_unaccessed_after",
                )

        if options.immutable and options.immutable.purging:
            if options.immutable.purging.purge_unused_after:
                validate_period_format(
                    options.immutable.purging.purge_unused_after,
                    "immutable.purging.purge_unused_after",
                )

        if options.immutable and options.immutable.retention:
            if options.immutable.retention.default_versions is not None:
                validate_version_count(
                    options.immutable.retention.default_versions,
                    "immutable.retention.default_versions",
                )
        if options.vector and options.vector.retention:
            if options.vector.retention.default_versions is not None:
                validate_version_count(
                    options.vector.retention.default_versions,
                    "vector.retention.default_versions",
                )

        if options.vector and options.vector.retention:
            if options.vector.retention.by_importance:
                validate_importance_ranges(options.vector.retention.by_importance)

        result = await self._client.query(
            "governance:simulate", {"options": options.to_dict()}
        )
        return SimulationResult.from_dict(result)

    async def get_compliance_report(
        self, options: ComplianceReportOptions
    ) -> ComplianceReport:
        """
        Generate compliance report.

        Creates a detailed compliance report showing policy adherence,
        data retention status, and user request fulfillment.

        Args:
            options: Report options (org, period)

        Returns:
            Compliance report

        Example:
            >>> from datetime import datetime
            >>>
            >>> report = await cortex.governance.get_compliance_report(
            ...     ComplianceReportOptions(
            ...         organization_id="org-123",
            ...         period_start=datetime(2025, 1, 1),
            ...         period_end=datetime(2025, 10, 31)
            ...     )
            ... )
            >>> print(f"Status: {report.conversations.compliance_status}")

        """
        # Validate date range (only if both dates are provided)
        if options.period_start is not None and options.period_end is not None:
            validate_date_range(options.period_start, options.period_end)

        # Validate scope if provided
        if options.organization_id or options.memory_space_id:
            validate_policy_scope(
                PolicyScope(
                    organization_id=options.organization_id,
                    memory_space_id=options.memory_space_id,
                )
            )

        result = await self._client.query(
            "governance:getComplianceReport", {"options": options.to_dict()}
        )
        return ComplianceReport.from_dict(result)

    async def get_enforcement_stats(
        self, options: EnforcementStatsOptions
    ) -> EnforcementStats:
        """
        Get enforcement statistics.

        Returns statistics about policy enforcement over a time period.
        Shows what has been purged, storage freed, and cost savings.

        Args:
            options: Stats options (period)

        Returns:
            Enforcement statistics

        Example:
            >>> stats = await cortex.governance.get_enforcement_stats(
            ...     EnforcementStatsOptions(period="30d")
            ... )
            >>> print(f"Vector versions deleted: {stats.vector.versions_deleted}")
            >>> print(f"Storage freed: {stats.storage_freed} MB")
            >>> print(f"Cost savings: ${stats.cost_savings}")

        """
        # Validate period format
        validate_stats_period(options.period)

        # Validate scope if provided
        if options.organization_id or options.memory_space_id:
            validate_policy_scope(
                PolicyScope(
                    organization_id=options.organization_id,
                    memory_space_id=options.memory_space_id,
                )
            )

        result = await self._client.query(
            "governance:getEnforcementStats", {"options": options.to_dict()}
        )
        return EnforcementStats.from_dict(result)


__all__ = ["GovernanceAPI", "GovernanceValidationError"]
