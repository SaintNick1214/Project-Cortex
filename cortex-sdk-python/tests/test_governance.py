"""
Governance API Tests

Comprehensive tests for data retention, purging, and compliance rules.
"""

from datetime import datetime, timedelta

import pytest

from cortex import (
    ComplianceReportOptions,
    ComplianceSettings,
    ConversationsPolicy,
    ConversationsPurging,
    ConversationsRetention,
    Cortex,
    EnforcementOptions,
    EnforcementStatsOptions,
    GovernancePolicy,
    ImmutablePolicy,
    ImmutablePurging,
    ImmutableRetention,
    ImmutableTypeRetention,
    ImportanceRange,
    MutablePolicy,
    MutablePurging,
    MutableRetention,
    PolicyScope,
    SimulationOptions,
    VectorPolicy,
    VectorPurging,
    VectorRetention,
)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Core Operations
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_set_organization_policy(cortex_client: Cortex):
    """Should set organization-wide policy."""
    policy = GovernancePolicy(
        organization_id="test-org-001",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(
                delete_after="7y",
                archive_after="1y",
                purge_on_user_request=True,
            ),
            purging=ConversationsPurging(
                auto_delete=True,
                delete_inactive_after="2y",
            ),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(
                default_versions=20,
                by_type={
                    "audit-log": ImmutableTypeRetention(versions_to_keep=-1),
                    "kb-article": ImmutableTypeRetention(versions_to_keep=50),
                },
            ),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(purge_inactive_after="2y"),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(
                default_versions=10,
                by_importance=[
                    ImportanceRange(range=[0, 20], versions=1),
                    ImportanceRange(range=[21, 40], versions=3),
                    ImportanceRange(range=[41, 70], versions=10),
                    ImportanceRange(range=[71, 89], versions=20),
                    ImportanceRange(range=[90, 100], versions=30),
                ],
            ),
            purging=VectorPurging(
                auto_cleanup_versions=True,
                delete_orphaned=False,
            ),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[90, 100],
            audit_logging=True,
        ),
    )

    result = await cortex_client.governance.set_policy(policy)

    assert result.success is True
    assert result.policy_id is not None
    assert result.scope["organizationId"] == "test-org-001"
    assert result.applied_at > 0


@pytest.mark.asyncio
async def test_get_organization_policy(cortex_client: Cortex):
    """Should get organization-wide policy."""
    policy = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-001")
    )

    assert policy is not None
    assert policy.conversations is not None
    assert policy.immutable is not None
    assert policy.mutable is not None
    assert policy.vector is not None
    assert policy.compliance is not None


@pytest.mark.asyncio
async def test_set_memory_space_override(cortex_client: Cortex):
    """Should set memory-space-specific policy override."""
    override_policy = GovernancePolicy(
        memory_space_id="audit-agent-space",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(
                delete_after="7y",
                purge_on_user_request=True,
            ),
            purging=ConversationsPurging(auto_delete=False),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=20),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(
                default_versions=-1,  # Unlimited
                by_importance=[ImportanceRange(range=[0, 100], versions=-1)],
            ),
            purging=VectorPurging(
                auto_cleanup_versions=False,
                delete_orphaned=False,
            ),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
    )

    await cortex_client.governance.set_agent_override("audit-agent-space", override_policy)

    space_policy = await cortex_client.governance.get_policy(
        PolicyScope(memory_space_id="audit-agent-space")
    )

    assert space_policy is not None
    assert space_policy.vector.retention.default_versions == -1


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Compliance Templates
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_get_gdpr_template(cortex_client: Cortex):
    """Should get GDPR compliance template."""
    policy = await cortex_client.governance.get_template("GDPR")

    assert policy is not None
    assert policy.compliance.mode == "GDPR"
    assert policy.conversations.retention.delete_after == "7y"
    assert policy.conversations.retention.purge_on_user_request is True


@pytest.mark.asyncio
async def test_get_hipaa_template(cortex_client: Cortex):
    """Should get HIPAA compliance template."""
    policy = await cortex_client.governance.get_template("HIPAA")

    assert policy is not None
    assert policy.compliance.mode == "HIPAA"
    assert policy.conversations.retention.delete_after == "6y"


@pytest.mark.asyncio
async def test_get_soc2_template(cortex_client: Cortex):
    """Should get SOC2 compliance template."""
    policy = await cortex_client.governance.get_template("SOC2")

    assert policy is not None
    assert policy.compliance.mode == "SOC2"


@pytest.mark.asyncio
async def test_get_finra_template(cortex_client: Cortex):
    """Should get FINRA compliance template."""
    policy = await cortex_client.governance.get_template("FINRA")

    assert policy is not None
    assert policy.compliance.mode == "FINRA"
    assert policy.conversations.retention.purge_on_user_request is False


@pytest.mark.asyncio
async def test_apply_gdpr_template(cortex_client: Cortex):
    """Should apply GDPR template to organization."""
    gdpr_policy = await cortex_client.governance.get_template("GDPR")
    gdpr_policy.organization_id = "test-org-gdpr"

    result = await cortex_client.governance.set_policy(gdpr_policy)

    assert result.success is True

    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-gdpr")
    )

    assert retrieved.compliance.mode == "GDPR"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Policy Enforcement
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_manual_enforcement(cortex_client: Cortex):
    """Should manually enforce policy."""
    # Set up policy first
    policy = await cortex_client.governance.get_template("GDPR")
    policy.organization_id = "test-org-enforce"
    await cortex_client.governance.set_policy(policy)

    # Enforce it
    result = await cortex_client.governance.enforce(
        EnforcementOptions(
            layers=["vector", "immutable"],
            rules=["retention", "purging"],
            scope=PolicyScope(organization_id="test-org-enforce"),
        )
    )

    assert result.enforced_at > 0
    assert result.versions_deleted >= 0
    assert result.records_purged >= 0
    assert result.storage_freed >= 0
    assert "vector" in result.affected_layers
    assert "immutable" in result.affected_layers


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Policy Simulation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_simulate_policy_impact(cortex_client: Cortex):
    """Should simulate policy impact."""
    impact = await cortex_client.governance.simulate(
        SimulationOptions(
            organization_id="test-org-simulate",
            vector=VectorPolicy(
                retention=VectorRetention(
                    default_versions=5,
                    by_importance=[
                        ImportanceRange(range=[0, 30], versions=1),
                        ImportanceRange(range=[31, 100], versions=5),
                    ],
                ),
                purging=VectorPurging(
                    auto_cleanup_versions=True,
                    delete_orphaned=True,
                ),
            ),
        )
    )

    assert impact.versions_affected >= 0
    assert impact.records_affected >= 0
    assert impact.storage_freed >= 0
    assert impact.cost_savings >= 0
    assert impact.breakdown is not None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Compliance Reporting
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_generate_compliance_report(cortex_client: Cortex):
    """Should generate compliance report."""
    now = datetime.now()
    thirty_days_ago = now - timedelta(days=30)

    report = await cortex_client.governance.get_compliance_report(
        ComplianceReportOptions(
            organization_id="test-org-report",
            period_start=thirty_days_ago,
            period_end=now,
        )
    )

    assert report.organization_id == "test-org-report"
    assert report.generated_at > 0
    assert report.conversations is not None
    assert report.immutable is not None
    assert report.vector is not None
    assert report.data_retention is not None
    assert report.user_requests is not None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Enforcement Statistics
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_get_enforcement_stats(cortex_client: Cortex):
    """Should get 30-day enforcement stats."""
    stats = await cortex_client.governance.get_enforcement_stats(
        EnforcementStatsOptions(
            period="30d",
            organization_id="test-org-stats",
        )
    )

    assert stats.period["start"] > 0
    assert stats.period["end"] > 0
    assert stats.conversations is not None
    assert stats.immutable is not None
    assert stats.vector is not None
    assert stats.mutable is not None
    assert stats.storage_freed >= 0
    assert stats.cost_savings >= 0


@pytest.mark.asyncio
async def test_enforcement_stats_periods(cortex_client: Cortex):
    """Should support different time periods."""
    periods = ["7d", "30d", "90d", "1y"]

    for period in periods:
        stats = await cortex_client.governance.get_enforcement_stats(
            EnforcementStatsOptions(
                period=period,
                organization_id="test-org-stats-periods",
            )
        )

        assert stats.period["start"] > 0
        assert stats.period["end"] > stats.period["start"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Integration Scenarios
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_gdpr_compliance_workflow(cortex_client: Cortex):
    """Should support full GDPR compliance workflow."""
    org_id = "test-org-gdpr-workflow"

    # 1. Apply GDPR template
    gdpr_policy = await cortex_client.governance.get_template("GDPR")
    gdpr_policy.organization_id = org_id
    await cortex_client.governance.set_policy(gdpr_policy)

    # 2. Verify policy is applied
    policy = await cortex_client.governance.get_policy(
        PolicyScope(organization_id=org_id)
    )
    assert policy.compliance.mode == "GDPR"

    # 3. Simulate impact
    simulation = await cortex_client.governance.simulate(
        SimulationOptions(organization_id=org_id)
    )
    assert simulation.versions_affected >= 0

    # 4. Enforce policy
    enforcement = await cortex_client.governance.enforce(
        EnforcementOptions(scope=PolicyScope(organization_id=org_id))
    )
    assert enforcement.enforced_at > 0

    # 5. Generate compliance report
    now = datetime.now()
    report = await cortex_client.governance.get_compliance_report(
        ComplianceReportOptions(
            organization_id=org_id,
            period_start=now - timedelta(days=30),
            period_end=now,
        )
    )
    assert report.conversations is not None
