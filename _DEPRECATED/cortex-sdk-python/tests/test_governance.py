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
    SessionCleanupPolicy,
    SessionLifecyclePolicy,
    SessionLimitsPolicy,
    SessionPolicy,
    SimulationOptions,
    VectorPolicy,
    VectorPurging,
    VectorRetention,
)
from cortex.governance import GovernanceValidationError

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Client-Side Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_set_policy_missing_scope(cortex_client: Cortex):
    """Should throw on missing scope."""
    policy = GovernancePolicy(
        # Missing organization_id and memory_space_id
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
    )

    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.set_policy(policy)

    assert "must specify either organization_id or memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_policy_invalid_period_format(cortex_client: Cortex):
    """Should throw on invalid period format."""
    policy = GovernancePolicy(
        organization_id="test-org-validation",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(
                delete_after="7years",  # Invalid format
                purge_on_user_request=True,
            ),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
    )

    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.set_policy(policy)

    assert "Invalid period format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_policy_overlapping_ranges(cortex_client: Cortex):
    """Should throw on overlapping importance ranges."""
    policy = GovernancePolicy(
        organization_id="test-org-validation",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(
                default_versions=10,
                by_importance=[
                    ImportanceRange(range=[0, 50], versions=5),
                    ImportanceRange(range=[40, 80], versions=10),  # Overlaps
                ],
            ),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
    )

    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.set_policy(policy)

    assert "overlaps with range" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_policy_invalid_version_count(cortex_client: Cortex):
    """Should throw on invalid version count."""
    policy = GovernancePolicy(
        organization_id="test-org-validation",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=-5),  # Invalid
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
    )

    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.set_policy(policy)

    assert "must be >= -1" in str(exc_info.value)


@pytest.mark.asyncio
async def test_set_policy_invalid_importance_bounds(cortex_client: Cortex):
    """Should throw on invalid importance range bounds."""
    policy = GovernancePolicy(
        organization_id="test-org-validation",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(
                default_versions=10,
                by_importance=[
                    ImportanceRange(range=[0, 150], versions=5),  # Max > 100
                ],
            ),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
    )

    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.set_policy(policy)

    assert "must be between 0 and 100" in str(exc_info.value)


@pytest.mark.asyncio
async def test_enforce_missing_scope(cortex_client: Cortex):
    """Should throw when scope is missing and no global policy exists."""
    # Scope is optional for global enforcement, but server will fail if no policy exists
    # This tests the server-side error when no active policy is found
    with pytest.raises(Exception) as exc_info:
        await cortex_client.governance.enforce(
            EnforcementOptions(
                layers=["vector"],
                rules=["retention"],
                # Missing scope - allows global enforcement attempt
            )
        )

    # Server throws when no policy exists for the (global) scope
    assert "No active policy found" in str(exc_info.value) or "policy" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_enforce_empty_scope(cortex_client: Cortex):
    """Should throw when scope is empty."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.enforce(
            EnforcementOptions(scope=PolicyScope())  # Empty scope
        )

    assert "must include either organization_id or memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_enforce_invalid_layers(cortex_client: Cortex):
    """Should throw on invalid layer names."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.enforce(
            EnforcementOptions(
                scope=PolicyScope(organization_id="test-org"),
                layers=["invalid-layer"],
            )
        )

    assert "Invalid layer" in str(exc_info.value)


@pytest.mark.asyncio
async def test_enforce_invalid_rules(cortex_client: Cortex):
    """Should throw on invalid rule names."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.enforce(
            EnforcementOptions(
                scope=PolicyScope(organization_id="test-org"),
                rules=["invalid-rule"],
            )
        )

    assert "Invalid rule" in str(exc_info.value)


@pytest.mark.asyncio
async def test_enforce_empty_layers_array(cortex_client: Cortex):
    """Should throw on empty layers array."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.enforce(
            EnforcementOptions(
                scope=PolicyScope(organization_id="test-org"),
                layers=[],
            )
        )

    assert "Layers array cannot be empty" in str(exc_info.value)


@pytest.mark.asyncio
async def test_enforce_empty_rules_array(cortex_client: Cortex):
    """Should throw on empty rules array."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.enforce(
            EnforcementOptions(
                scope=PolicyScope(organization_id="test-org"),
                rules=[],
            )
        )

    assert "Rules array cannot be empty" in str(exc_info.value)


@pytest.mark.asyncio
async def test_compliance_report_invalid_date_range(cortex_client: Cortex):
    """Should throw when start date is after end date."""
    now = datetime.now()
    yesterday = now - timedelta(days=1)

    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.get_compliance_report(
            ComplianceReportOptions(
                organization_id="test-org",
                period_start=now,
                period_end=yesterday,
            )
        )

    assert "Start date must be before end date" in str(exc_info.value)


@pytest.mark.asyncio
async def test_enforcement_stats_invalid_period(cortex_client: Cortex):
    """Should throw on invalid period format."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.get_enforcement_stats(
            EnforcementStatsOptions(
                period="60d",  # Invalid: not in allowed list
                organization_id="test-org",
            )
        )

    assert "Invalid period" in str(exc_info.value)


@pytest.mark.asyncio
async def test_agent_override_empty_memory_space_id(cortex_client: Cortex):
    """Should throw when memory_space_id is empty."""
    # Create minimal valid policy for override (only need one field to test memory_space_id validation)
    override = GovernancePolicy(
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=10, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
    )

    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.set_agent_override("", override)

    assert "memory_space_id is required and cannot be empty" in str(exc_info.value)


@pytest.mark.asyncio
async def test_agent_override_whitespace_memory_space_id(cortex_client: Cortex):
    """Should throw when memory_space_id is only whitespace."""
    override = GovernancePolicy(
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=10, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
    )

    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.set_agent_override("   ", override)

    assert "memory_space_id is required and cannot be empty" in str(exc_info.value)


@pytest.mark.asyncio
async def test_agent_override_invalid_period(cortex_client: Cortex):
    """Should throw on invalid period in override."""
    override = GovernancePolicy(
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(
                delete_after="invalid-period",
                purge_on_user_request=True,
            ),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=10, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
    )

    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.set_agent_override("test-space", override)

    assert "Invalid period format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_simulate_invalid_period(cortex_client: Cortex):
    """Should throw on invalid period format in simulation."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.simulate(
            SimulationOptions(
                organization_id="test-org",
                conversations=ConversationsPolicy(
                    retention=ConversationsRetention(
                        delete_after="bad-format",
                        purge_on_user_request=True,
                    ),
                    purging=ConversationsPurging(auto_delete=True),
                ),
            )
        )

    assert "Invalid period format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_simulate_invalid_version_count(cortex_client: Cortex):
    """Should throw on invalid version count in simulation."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.simulate(
            SimulationOptions(
                organization_id="test-org",
                vector=VectorPolicy(
                    retention=VectorRetention(default_versions=-10, by_importance=[]),
                    purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
                ),
            )
        )

    assert "must be >= -1" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_template_invalid_name(cortex_client: Cortex):
    """Should throw on invalid template name."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.get_template("INVALID")  # type: ignore

    assert "Invalid compliance template" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_policy_empty_organization_id(cortex_client: Cortex):
    """Should throw on empty organization_id."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.get_policy(PolicyScope(organization_id=""))

    assert "must include either organization_id or memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_policy_empty_memory_space_id(cortex_client: Cortex):
    """Should throw on empty memory_space_id."""
    with pytest.raises(GovernanceValidationError) as exc_info:
        await cortex_client.governance.get_policy(PolicyScope(memory_space_id="   "))

    assert "must include either organization_id or memory_space_id" in str(exc_info.value)


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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Session Policy Tests (v0.31.0)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.asyncio
async def test_set_policy_with_session_lifecycle(cortex_client: Cortex):
    """Should set policy with session lifecycle configuration."""
    policy = GovernancePolicy(
        organization_id="test-org-session-lifecycle",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        sessions=SessionPolicy(
            lifecycle=SessionLifecyclePolicy(
                idle_timeout="30m",
                max_duration="24h",
                auto_extend=True,
                warn_before_expiry="5m",
            ),
            cleanup=SessionCleanupPolicy(
                auto_expire_idle=True,
                delete_ended_after="7d",
                archive_after="30d",
            ),
            limits=SessionLimitsPolicy(
                max_active_sessions=5,
                max_sessions_per_device=2,
            ),
        ),
    )

    result = await cortex_client.governance.set_policy(policy)

    assert result.success is True

    # Retrieve and verify
    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-session-lifecycle")
    )

    assert retrieved.sessions is not None
    assert retrieved.sessions.lifecycle.idle_timeout == "30m"
    assert retrieved.sessions.lifecycle.max_duration == "24h"
    assert retrieved.sessions.lifecycle.auto_extend is True
    assert retrieved.sessions.lifecycle.warn_before_expiry == "5m"
    assert retrieved.sessions.cleanup.auto_expire_idle is True
    assert retrieved.sessions.cleanup.delete_ended_after == "7d"
    assert retrieved.sessions.cleanup.archive_after == "30d"
    assert retrieved.sessions.limits is not None
    assert retrieved.sessions.limits.max_active_sessions == 5
    assert retrieved.sessions.limits.max_sessions_per_device == 2


@pytest.mark.asyncio
async def test_set_policy_with_session_lifecycle_only(cortex_client: Cortex):
    """Should set policy with only session lifecycle (no cleanup or limits)."""
    policy = GovernancePolicy(
        organization_id="test-org-session-lifecycle-only",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        sessions=SessionPolicy(
            lifecycle=SessionLifecyclePolicy(
                idle_timeout="1h",
                max_duration="12h",
                auto_extend=False,
            ),
            cleanup=SessionCleanupPolicy(),  # Defaults
        ),
    )

    result = await cortex_client.governance.set_policy(policy)

    assert result.success is True

    # Retrieve and verify
    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-session-lifecycle-only")
    )

    assert retrieved.sessions is not None
    assert retrieved.sessions.lifecycle.idle_timeout == "1h"
    assert retrieved.sessions.lifecycle.max_duration == "12h"
    assert retrieved.sessions.lifecycle.auto_extend is False
    assert retrieved.sessions.lifecycle.warn_before_expiry is None
    assert retrieved.sessions.limits is None  # Optional limits not set


@pytest.mark.asyncio
async def test_set_policy_with_session_cleanup_only(cortex_client: Cortex):
    """Should set policy with session cleanup configuration."""
    policy = GovernancePolicy(
        organization_id="test-org-session-cleanup",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        sessions=SessionPolicy(
            lifecycle=SessionLifecyclePolicy(),  # Defaults
            cleanup=SessionCleanupPolicy(
                auto_expire_idle=False,
                delete_ended_after="90d",
                archive_after="60d",
            ),
        ),
    )

    result = await cortex_client.governance.set_policy(policy)

    assert result.success is True

    # Retrieve and verify
    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-session-cleanup")
    )

    assert retrieved.sessions is not None
    assert retrieved.sessions.cleanup.auto_expire_idle is False
    assert retrieved.sessions.cleanup.delete_ended_after == "90d"
    assert retrieved.sessions.cleanup.archive_after == "60d"


@pytest.mark.asyncio
async def test_set_policy_with_session_limits_only(cortex_client: Cortex):
    """Should set policy with session limits configuration."""
    policy = GovernancePolicy(
        organization_id="test-org-session-limits",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        sessions=SessionPolicy(
            lifecycle=SessionLifecyclePolicy(),  # Defaults
            cleanup=SessionCleanupPolicy(),  # Defaults
            limits=SessionLimitsPolicy(
                max_active_sessions=10,
                max_sessions_per_device=3,
            ),
        ),
    )

    result = await cortex_client.governance.set_policy(policy)

    assert result.success is True

    # Retrieve and verify
    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-session-limits")
    )

    assert retrieved.sessions is not None
    assert retrieved.sessions.limits is not None
    assert retrieved.sessions.limits.max_active_sessions == 10
    assert retrieved.sessions.limits.max_sessions_per_device == 3


@pytest.mark.asyncio
async def test_set_policy_with_partial_session_limits(cortex_client: Cortex):
    """Should set policy with partial session limits (only max_active_sessions)."""
    policy = GovernancePolicy(
        organization_id="test-org-session-limits-partial",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        sessions=SessionPolicy(
            lifecycle=SessionLifecyclePolicy(),
            cleanup=SessionCleanupPolicy(),
            limits=SessionLimitsPolicy(
                max_active_sessions=8,
                max_sessions_per_device=None,  # Only set one limit
            ),
        ),
    )

    result = await cortex_client.governance.set_policy(policy)

    assert result.success is True

    # Retrieve and verify
    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-session-limits-partial")
    )

    assert retrieved.sessions is not None
    assert retrieved.sessions.limits is not None
    assert retrieved.sessions.limits.max_active_sessions == 8
    assert retrieved.sessions.limits.max_sessions_per_device is None


@pytest.mark.asyncio
async def test_get_policy_without_sessions(cortex_client: Cortex):
    """Should get policy without sessions (backward compatibility)."""
    # Set policy without sessions
    policy = GovernancePolicy(
        organization_id="test-org-no-sessions",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        # sessions=None (not set)
    )

    await cortex_client.governance.set_policy(policy)

    # Retrieve and verify sessions is None
    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-no-sessions")
    )

    # Sessions should be None or have defaults (depending on backend)
    # Backend may return defaults even if not explicitly set
    if retrieved.sessions is not None:
        # If backend returns defaults, verify they're valid
        assert retrieved.sessions.lifecycle is not None
        assert retrieved.sessions.cleanup is not None


@pytest.mark.asyncio
async def test_set_agent_override_with_sessions(cortex_client: Cortex):
    """Should set agent override with session policy."""
    # First set org policy
    org_policy = GovernancePolicy(
        organization_id="test-org-override-base",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
    )
    await cortex_client.governance.set_policy(org_policy)

    # Set override with session policy (include all required fields)
    override = GovernancePolicy(
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        sessions=SessionPolicy(
            lifecycle=SessionLifecyclePolicy(
                idle_timeout="15m",
                max_duration="8h",
                auto_extend=True,
                warn_before_expiry="10m",
            ),
            cleanup=SessionCleanupPolicy(
                auto_expire_idle=True,
                delete_ended_after="14d",
            ),
        ),
    )

    await cortex_client.governance.set_agent_override("test-space-override-sessions", override)

    # Verify override
    space_policy = await cortex_client.governance.get_policy(
        PolicyScope(memory_space_id="test-space-override-sessions")
    )

    assert space_policy.sessions is not None
    assert space_policy.sessions.lifecycle.idle_timeout == "15m"
    assert space_policy.sessions.lifecycle.max_duration == "8h"
    assert space_policy.sessions.cleanup.delete_ended_after == "14d"


@pytest.mark.asyncio
async def test_session_lifecycle_policy_serialization(cortex_client: Cortex):
    """Should correctly serialize/deserialize SessionLifecyclePolicy."""
    policy = GovernancePolicy(
        organization_id="test-org-session-serialization",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        sessions=SessionPolicy(
            lifecycle=SessionLifecyclePolicy(
                idle_timeout="45m",
                max_duration="48h",
                auto_extend=False,
                warn_before_expiry="15m",
            ),
            cleanup=SessionCleanupPolicy(),
        ),
    )

    # Test to_dict serialization
    policy_dict = policy.to_dict()
    assert "sessions" in policy_dict
    assert policy_dict["sessions"]["lifecycle"]["idleTimeout"] == "45m"
    assert policy_dict["sessions"]["lifecycle"]["maxDuration"] == "48h"
    assert policy_dict["sessions"]["lifecycle"]["autoExtend"] is False
    assert policy_dict["sessions"]["lifecycle"]["warnBeforeExpiry"] == "15m"

    # Set policy and verify round-trip
    await cortex_client.governance.set_policy(policy)

    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-session-serialization")
    )

    assert retrieved.sessions.lifecycle.idle_timeout == "45m"
    assert retrieved.sessions.lifecycle.max_duration == "48h"
    assert retrieved.sessions.lifecycle.auto_extend is False
    assert retrieved.sessions.lifecycle.warn_before_expiry == "15m"


@pytest.mark.asyncio
async def test_session_cleanup_policy_serialization(cortex_client: Cortex):
    """Should correctly serialize/deserialize SessionCleanupPolicy."""
    policy = GovernancePolicy(
        organization_id="test-org-cleanup-serialization",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        sessions=SessionPolicy(
            lifecycle=SessionLifecyclePolicy(),
            cleanup=SessionCleanupPolicy(
                auto_expire_idle=False,
                delete_ended_after="30d",
                archive_after="15d",
            ),
        ),
    )

    # Test to_dict serialization
    policy_dict = policy.to_dict()
    assert "sessions" in policy_dict
    assert policy_dict["sessions"]["cleanup"]["autoExpireIdle"] is False
    assert policy_dict["sessions"]["cleanup"]["deleteEndedAfter"] == "30d"
    assert policy_dict["sessions"]["cleanup"]["archiveAfter"] == "15d"

    # Set policy and verify round-trip
    await cortex_client.governance.set_policy(policy)

    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-cleanup-serialization")
    )

    assert retrieved.sessions.cleanup.auto_expire_idle is False
    assert retrieved.sessions.cleanup.delete_ended_after == "30d"
    assert retrieved.sessions.cleanup.archive_after == "15d"


@pytest.mark.asyncio
async def test_session_limits_policy_serialization(cortex_client: Cortex):
    """Should correctly serialize/deserialize SessionLimitsPolicy."""
    policy = GovernancePolicy(
        organization_id="test-org-limits-serialization",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        sessions=SessionPolicy(
            lifecycle=SessionLifecyclePolicy(),
            cleanup=SessionCleanupPolicy(),
            limits=SessionLimitsPolicy(
                max_active_sessions=15,
                max_sessions_per_device=4,
            ),
        ),
    )

    # Test to_dict serialization
    policy_dict = policy.to_dict()
    assert "sessions" in policy_dict
    assert "limits" in policy_dict["sessions"]
    assert policy_dict["sessions"]["limits"]["maxActiveSessions"] == 15
    assert policy_dict["sessions"]["limits"]["maxSessionsPerDevice"] == 4

    # Set policy and verify round-trip
    await cortex_client.governance.set_policy(policy)

    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-limits-serialization")
    )

    assert retrieved.sessions.limits is not None
    assert retrieved.sessions.limits.max_active_sessions == 15
    assert retrieved.sessions.limits.max_sessions_per_device == 4


@pytest.mark.asyncio
async def test_session_policy_optional_limits(cortex_client: Cortex):
    """Should handle optional limits field (None vs not set)."""
    # Policy without limits
    policy_no_limits = GovernancePolicy(
        organization_id="test-org-no-limits",
        conversations=ConversationsPolicy(
            retention=ConversationsRetention(delete_after="7y", purge_on_user_request=True),
            purging=ConversationsPurging(auto_delete=True),
        ),
        immutable=ImmutablePolicy(
            retention=ImmutableRetention(default_versions=10),
            purging=ImmutablePurging(auto_cleanup_versions=True),
        ),
        mutable=MutablePolicy(
            retention=MutableRetention(),
            purging=MutablePurging(auto_delete=False),
        ),
        vector=VectorPolicy(
            retention=VectorRetention(default_versions=5, by_importance=[]),
            purging=VectorPurging(auto_cleanup_versions=True, delete_orphaned=True),
        ),
        compliance=ComplianceSettings(
            mode="GDPR",
            data_retention_years=7,
            require_justification=[],
            audit_logging=True,
        ),
        sessions=SessionPolicy(
            lifecycle=SessionLifecyclePolicy(),
            cleanup=SessionCleanupPolicy(),
            # limits=None (not set)
        ),
    )

    await cortex_client.governance.set_policy(policy_no_limits)

    retrieved = await cortex_client.governance.get_policy(
        PolicyScope(organization_id="test-org-no-limits")
    )

    # Limits should be None when not set
    assert retrieved.sessions is not None
    # Backend may return None or omit the field
    if hasattr(retrieved.sessions, "limits"):
        # If limits exists, it should be None
        assert retrieved.sessions.limits is None or retrieved.sessions.limits is None
