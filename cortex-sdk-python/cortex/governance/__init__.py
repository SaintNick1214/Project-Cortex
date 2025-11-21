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
        self, client: AsyncConvexClient, graph_adapter: Optional[Any] = None
    ) -> None:
        """
        Initialize Governance API.

        Args:
            client: Async Convex client
            graph_adapter: Optional graph database adapter

        """
        self._client = client
        self._graph_adapter = graph_adapter

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
        result = await self._client.query(
            "governance:getEnforcementStats", {"options": options.to_dict()}
        )
        return EnforcementStats.from_dict(result)


__all__ = ["GovernanceAPI"]
