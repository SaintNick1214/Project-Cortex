"""
E2E Tests: Collaboration Mode

Tests validate:
- Cross-space context sharing
- Secure cross-space access
- Multi-organization workflows
- Access control

Port of: tests/collaborationMode.test.ts
"""

import pytest
import time
import os
from cortex import Cortex, CortexConfig
from cortex.types import (
    RegisterMemorySpaceParams,
    StoreMemoryInput,
    MemorySource,
    MemoryMetadata,
    StoreFactParams,
    ListFactsFilter,
    ContextInput,
)
from tests.helpers import TestCleanup


# Two separate organizations - use timestamp to avoid conflicts
import time as _time
_timestamp = int(_time.time() * 1000)
ORG_A_SPACE = f"org-a-space-python-{_timestamp}"
ORG_B_SPACE = f"org-b-space-python-{_timestamp}"


@pytest.fixture(scope="module")
async def collab_cortex():
    """Set up Cortex with two organization spaces."""
    convex_url = os.getenv("CONVEX_URL", "http://127.0.0.1:3210")
    cortex = Cortex(CortexConfig(convex_url=convex_url))
    cleanup = TestCleanup(cortex)
    
    await cleanup.purge_all()
    
    # Register two separate organizations
    now = int(time.time() * 1000)
    await cortex.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=ORG_A_SPACE,
            name="Organization A",
            type="team",
            participants=[
                {"id": "user-alice", "type": "user", "joinedAt": now},
                {"id": "agent-a", "type": "agent", "joinedAt": now},
            ],
        )
    )
    
    await cortex.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=ORG_B_SPACE,
            name="Organization B",
            type="team",
            participants=[
                {"id": "user-bob", "type": "user", "joinedAt": now},
                {"id": "agent-b", "type": "agent", "joinedAt": now},
            ],
        )
    )
    
    yield cortex
    
    # Cleanup
    await cleanup.purge_all()
    await cortex.close()


# ============================================================================
# Memory Space Isolation
# ============================================================================


@pytest.mark.asyncio
async def test_each_organization_has_separate_data_by_default(collab_cortex):
    """
    Test that each organization has separate data by default.
    
    Port of: collaborationMode.test.ts - line 60
    """
    # Org A stores data
    await collab_cortex.vector.store(
        ORG_A_SPACE,
        StoreMemoryInput(
            content="Organization A confidential information",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=90, tags=["confidential"]),
        ),
    )
    
    # Org B stores data
    await collab_cortex.vector.store(
        ORG_B_SPACE,
        StoreMemoryInput(
            content="Organization B confidential information",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=90, tags=["confidential"]),
        ),
    )
    
    # Org A only sees their data
    org_a_result = await collab_cortex.vector.list(memory_space_id=ORG_A_SPACE)
    org_a_memories = org_a_result if isinstance(org_a_result, list) else org_a_result.get("memories", [])
    
    for m in org_a_memories:
        space_id = m.memory_space_id if hasattr(m, 'memory_space_id') else m.get("memorySpaceId")
        assert space_id == ORG_A_SPACE
    
    # Org B only sees their data
    org_b_result = await collab_cortex.vector.list(memory_space_id=ORG_B_SPACE)
    org_b_memories = org_b_result if isinstance(org_b_result, list) else org_b_result.get("memories", [])
    
    for m in org_b_memories:
        space_id = m.memory_space_id if hasattr(m, 'memory_space_id') else m.get("memorySpaceId")
        assert space_id == ORG_B_SPACE
    
    # No cross-contamination
    org_a_contents = [m.content if hasattr(m, 'content') else m.get("content") for m in org_a_memories]
    org_b_contents = [m.content if hasattr(m, 'content') else m.get("content") for m in org_b_memories]
    
    assert not any("Organization B" in content for content in org_a_contents)
    assert not any("Organization A" in content for content in org_b_contents)


# ============================================================================
# Cross-Space Context Sharing
# ============================================================================


@pytest.mark.asyncio
async def test_shares_workflow_context_across_organizations(collab_cortex):
    """
    Test sharing workflow context across organizations.
    
    Port of: collaborationMode.test.ts - line 106
    """
    # Org A creates context for joint project
    shared_context = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Joint marketing campaign",
            memory_space_id=ORG_A_SPACE,
            data={
                "campaign": "Q4 Partnership",
                "budget": 100000,
                "startDate": "2025-11-01",
            },
        )
    )
    
    # Org A grants access to Org B
    updated = await collab_cortex.contexts.grant_access(
        shared_context.id,
        ORG_B_SPACE,
        "read-only",
    )
    
    assert updated.granted_access is not None
    assert any(g.get("memorySpaceId") == ORG_B_SPACE for g in updated.granted_access)
    
    # Both orgs can see the context
    org_a_view = await collab_cortex.contexts.get(shared_context.id)
    assert org_a_view is not None
    
    # Org B can also see (via granted access)
    assert any(g.get("memorySpaceId") == ORG_B_SPACE for g in (org_a_view.granted_access or []))


@pytest.mark.asyncio
async def test_creates_child_contexts_in_different_spaces(collab_cortex):
    """
    Test creating child contexts in different spaces.
    
    Port of: collaborationMode.test.ts - line 143
    """
    # Org A creates root
    root = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Partnership project root",
            memory_space_id=ORG_A_SPACE,
        )
    )
    
    # Org A creates their task
    org_a_task = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Org A handles marketing materials",
            memory_space_id=ORG_A_SPACE,
            parent_id=root.id,
        )
    )
    
    # Org B creates their task (child of A's root - cross-space)
    org_b_task = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Org B handles distribution",
            memory_space_id=ORG_B_SPACE,
            parent_id=root.id,
        )
    )
    
    # Both children reference same root but live in different spaces
    assert org_a_task.memory_space_id == ORG_A_SPACE
    assert org_b_task.memory_space_id == ORG_B_SPACE
    assert org_a_task.root_id == root.id
    assert org_b_task.root_id == root.id


# ============================================================================
# Access Control
# ============================================================================


@pytest.mark.asyncio
async def test_contexts_can_grant_selective_access(collab_cortex):
    """
    Test that contexts can grant selective access.
    
    Port of: collaborationMode.test.ts - line 173
    """
    private_context = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Internal Org A workflow",
            memory_space_id=ORG_A_SPACE,
            data={"confidential": True},
        )
    )
    
    # Initially no access granted
    assert private_context.granted_access == [] or private_context.granted_access is None
    
    # Grant read-only access to Org B
    updated = await collab_cortex.contexts.grant_access(
        private_context.id,
        ORG_B_SPACE,
        "read-only",
    )
    
    assert len(updated.granted_access) == 1
    assert updated.granted_access[0].get("scope") == "read-only"


@pytest.mark.asyncio
async def test_can_grant_different_scopes(collab_cortex):
    """
    Test that can grant different access scopes.
    
    Port of: collaborationMode.test.ts - line 194
    """
    context = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Multi-scope test",
            memory_space_id=ORG_A_SPACE,
        )
    )
    
    # Grant read-only to Org B
    await collab_cortex.contexts.grant_access(
        context.id,
        ORG_B_SPACE,
        "read-only",
    )
    
    # Grant full access to another space
    updated = await collab_cortex.contexts.grant_access(
        context.id,
        "partner-space",
        "full-access",
    )
    
    assert len(updated.granted_access) == 2


# ============================================================================
# Real-World Collaboration Scenario
# ============================================================================


@pytest.mark.asyncio
async def test_partner_organizations_collaborate_on_joint_campaign(collab_cortex):
    """
    Test partner organizations collaborating on joint campaign.
    
    Port of: collaborationMode.test.ts - line 219
    """
    # SCENARIO: Two companies partner on marketing campaign
    # Each has separate memory space (data isolation)
    # But share workflow context for coordination
    
    # 1. Company A creates campaign context
    campaign = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Q4 Joint Marketing Campaign",
            memory_space_id=ORG_A_SPACE,
            data={
                "budget": 200000,
                "targetAudience": "enterprise customers",
                "startDate": "2025-11-01",
                "endDate": "2025-12-31",
            },
        )
    )
    
    # 2. Company A grants access to Company B
    await collab_cortex.contexts.grant_access(
        campaign.id,
        ORG_B_SPACE,
        "collaborate",
    )
    
    # 3. Company A adds their internal task
    org_a_task = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Create marketing content",
            memory_space_id=ORG_A_SPACE,
            parent_id=campaign.id,
        )
    )
    
    # Store facts in their own space
    await collab_cortex.facts.store(
        StoreFactParams(
            memory_space_id=ORG_A_SPACE,
            participant_id="agent-a",
            fact="Company A will handle social media content creation",
            fact_type="knowledge",
            confidence=100,
            source_type="manual",
            tags=["campaign", "content"],
        )
    )
    
    # 4. Company B adds their task
    org_b_task = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Manage ad distribution",
            memory_space_id=ORG_B_SPACE,
            parent_id=campaign.id,
        )
    )
    
    # Store facts in their own space
    await collab_cortex.facts.store(
        StoreFactParams(
            memory_space_id=ORG_B_SPACE,
            participant_id="agent-b",
            fact="Company B will handle ad platform distribution",
            fact_type="knowledge",
            confidence=100,
            source_type="manual",
            tags=["campaign", "distribution"],
        )
    )
    
    # 5. Both can see shared context chain
    chain_a = await collab_cortex.contexts.get_chain(org_a_task.id)
    chain_b = await collab_cortex.contexts.get_chain(org_b_task.id)
    
    assert chain_a.get("root", {}).get("contextId") == campaign.id
    assert chain_b.get("root", {}).get("contextId") == campaign.id
    assert len(chain_a.get("siblings", [])) == 1  # Org B's task
    assert len(chain_b.get("siblings", [])) == 1  # Org A's task
    
    # 6. But each org's facts stay private
    org_a_facts_result = await collab_cortex.facts.list(
        ListFactsFilter(memory_space_id=ORG_A_SPACE)
    )
    org_a_facts = org_a_facts_result if isinstance(org_a_facts_result, list) else org_a_facts_result.get("facts", [])
    
    org_b_facts_result = await collab_cortex.facts.list(ListFactsFilter(memory_space_id=ORG_B_SPACE))
    org_b_facts = org_b_facts_result if isinstance(org_b_facts_result, list) else org_b_facts_result.get("facts", [])
    
    org_a_fact_texts = [f.fact if hasattr(f, 'fact') else f.get("fact") for f in org_a_facts]
    org_b_fact_texts = [f.fact if hasattr(f, 'fact') else f.get("fact") for f in org_b_facts]
    
    assert any("social media" in text for text in org_a_fact_texts)
    assert not any("ad platform" in text for text in org_a_fact_texts)
    
    assert any("ad platform" in text for text in org_b_fact_texts)
    assert not any("social media" in text for text in org_b_fact_texts)


# ============================================================================
# Cross-Space Workflow
# ============================================================================


@pytest.mark.asyncio
async def test_coordinates_tasks_across_organizations(collab_cortex):
    """
    Test coordinating tasks across organizations.
    
    Port of: collaborationMode.test.ts - line 416
    """
    # Root context in Org A
    root = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Partnership deal workflow",
            memory_space_id=ORG_A_SPACE,
            data={"dealValue": 500000},
        )
    )
    
    # Grant access to Org B
    await collab_cortex.contexts.grant_access(
        root.id,
        ORG_B_SPACE,
        "collaborate",
    )
    
    # Org A creates their task
    org_a_task = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Org A legal review",
            memory_space_id=ORG_A_SPACE,
            parent_id=root.id,
        )
    )
    
    # Org B creates their task (child of A's root - cross-space!)
    org_b_task = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Org B financial review",
            memory_space_id=ORG_B_SPACE,
            parent_id=root.id,
        )
    )
    
    # Both tasks share same root
    assert org_a_task.root_id == root.id
    assert org_b_task.root_id == root.id
    
    # Can see each other as siblings
    chain_a = await collab_cortex.contexts.get_chain(org_a_task.id)
    
    siblings = chain_a.get("siblings", [])
    sibling_ids = [s.get("contextId") for s in siblings]
    assert org_b_task.id in sibling_ids


# ============================================================================
# Secure Data Sharing
# ============================================================================


@pytest.mark.asyncio
async def test_shares_only_context_not_underlying_data(collab_cortex):
    """
    Test that only context is shared, not underlying data.
    
    Port of: collaborationMode.test.ts - line 459
    """
    # Org A stores sensitive facts
    await collab_cortex.facts.store(
        StoreFactParams(
            memory_space_id=ORG_A_SPACE,
            fact="Org A revenue: $10M",
            fact_type="knowledge",
            confidence=100,
            source_type="system",
            tags=["financial", "sensitive"],
        )
    )
    
    # Create context and share it
    context = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Shared project planning",
            memory_space_id=ORG_A_SPACE,
            data={"projectName": "Joint Initiative"},
        )
    )
    
    await collab_cortex.contexts.grant_access(
        context.id,
        ORG_B_SPACE,
        "read-only",
    )
    
    # Org B can see context
    shared_ctx = await collab_cortex.contexts.get(context.id)
    
    assert shared_ctx.data.get("projectName") == "Joint Initiative"
    
    # But Org B CANNOT see Org A's facts
    org_b_fact_view_result = await collab_cortex.facts.list(ListFactsFilter(memory_space_id=ORG_B_SPACE))
    org_b_fact_view = org_b_fact_view_result if isinstance(org_b_fact_view_result, list) else org_b_fact_view_result.get("facts", [])
    
    org_b_fact_texts = [f.fact if hasattr(f, 'fact') else f.get("fact") for f in org_b_fact_view]
    assert not any("$10M" in text for text in org_b_fact_texts)


# ============================================================================
# Hive vs Collaboration Comparison
# ============================================================================


@pytest.mark.asyncio
async def test_demonstrates_hive_vs_collaboration_difference(collab_cortex):
    """
    Test demonstrating the difference between Hive and Collaboration modes.
    
    Port of: collaborationMode.test.ts - line 305
    """
    # HIVE MODE: All tools in ONE space (no data silos)
    hive_space = f"hive-demo-python-{int(time.time() * 1000)}"
    now = int(time.time() * 1000)
    
    await collab_cortex.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=hive_space,
            name="Hive: Single User's Tools",
            type="personal",
            participants=[
                {"id": "user-demo", "type": "user", "joinedAt": now},
                {"id": "tool-1", "type": "tool", "joinedAt": now},
                {"id": "tool-2", "type": "tool", "joinedAt": now},
                {"id": "tool-3", "type": "tool", "joinedAt": now},
            ],
        )
    )
    
    # All tools store in SAME space
    await collab_cortex.facts.store(
        StoreFactParams(
            memory_space_id=hive_space,
            participant_id="tool-1",
            fact="Fact from tool 1",
            fact_type="knowledge",
            confidence=90,
            source_type="tool",
            tags=["demo"],
        )
    )
    
    await collab_cortex.facts.store(
        StoreFactParams(
            memory_space_id=hive_space,
            participant_id="tool-2",
            fact="Fact from tool 2",
            fact_type="knowledge",
            confidence=90,
            source_type="tool",
            tags=["demo"],
        )
    )
    
    # Single query gets both
    hive_facts_result = await collab_cortex.facts.list(ListFactsFilter(memory_space_id=hive_space))
    hive_facts = hive_facts_result if isinstance(hive_facts_result, list) else hive_facts_result.get("facts", [])
    
    assert len(hive_facts) >= 2
    
    # COLLABORATION MODE: Separate spaces, shared contexts
    timestamp = int(time.time() * 1000)
    company_x = f"company-x-python-{timestamp}"
    company_y = f"company-y-python-{timestamp}"
    
    await collab_cortex.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=company_x,
            name="Company X",
            type="team",
            participants=[{"id": "user-x", "type": "user", "joinedAt": now}],
        )
    )
    
    await collab_cortex.memory_spaces.register(
        RegisterMemorySpaceParams(
            memory_space_id=company_y,
            name="Company Y",
            type="team",
            participants=[{"id": "user-y", "type": "user", "joinedAt": now}],
        )
    )
    
    # Each stores in their own space
    await collab_cortex.facts.store(
        StoreFactParams(
            memory_space_id=company_x,
            fact="Company X confidential data",
            fact_type="knowledge",
            confidence=100,
            source_type="system",
            tags=["confidential"],
        )
    )
    
    await collab_cortex.facts.store(
        StoreFactParams(
            memory_space_id=company_y,
            fact="Company Y confidential data",
            fact_type="knowledge",
            confidence=100,
            source_type="system",
            tags=["confidential"],
        )
    )
    
    # Create shared context for collaboration
    shared_project = await collab_cortex.contexts.create(
        ContextInput(
            purpose="Joint venture project",
            memory_space_id=company_x,
        )
    )
    
    await collab_cortex.contexts.grant_access(
        shared_project.id,
        company_y,
        "collaborate",
    )
    
    # Facts stay isolated
    x_facts_result = await collab_cortex.facts.list(ListFactsFilter(memory_space_id=company_x))
    x_facts = x_facts_result if isinstance(x_facts_result, list) else x_facts_result.get("facts", [])
    
    y_facts_result = await collab_cortex.facts.list(ListFactsFilter(memory_space_id=company_y))
    y_facts = y_facts_result if isinstance(y_facts_result, list) else y_facts_result.get("facts", [])
    
    x_fact_texts = [f.fact if hasattr(f, 'fact') else f.get("fact") for f in x_facts]
    y_fact_texts = [f.fact if hasattr(f, 'fact') else f.get("fact") for f in y_facts]
    
    assert not any("Company Y" in text for text in x_fact_texts)
    assert not any("Company X" in text for text in y_fact_texts)
    
    # But context is shared
    context = await collab_cortex.contexts.get(shared_project.id)
    
    assert context.granted_access is not None
    assert any(g.get("memorySpaceId") == company_y for g in context.granted_access)

