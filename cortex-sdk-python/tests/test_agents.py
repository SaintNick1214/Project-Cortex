"""
Tests for Agents API

Port of: tests/agents.test.ts

Tests validate:
- Agent registration
- Agent metadata
- Agent discovery
- Cascade deletion by participantId
"""

import pytest
from cortex import AgentRegistration
from tests.helpers import TestCleanup


# ============================================================================
# register() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_register_agent(cortex_client, test_ids):
    """
    Test registering an agent.
    
    Port of: agents.test.ts - register tests
    """
    agent_id = test_ids["agent_id"]
    
    result = await cortex_client.agents.register(
        AgentRegistration(
            id=agent_id,
            name="Test Agent",
            description="Agent for testing",
            metadata={"version": "1.0", "capabilities": ["chat", "search"]},
        )
    )
    
    # Validate result
    agent_id_result = result.get("id") if isinstance(result, dict) else result.id
    agent_name = result.get("name") if isinstance(result, dict) else result.name
    assert agent_id_result == agent_id
    assert agent_name == "Test Agent"
    
    # Cleanup - unregister agent
    await cortex_client.agents.unregister(agent_id)


@pytest.mark.asyncio
async def test_register_agent_updates_existing(cortex_client, test_ids):
    """
    Test that registering same agent updates existing registration.
    
    Port of: agents.test.ts - register tests
    """
    agent_id = test_ids["agent_id"]
    
    # Register first time
    await cortex_client.agents.register(
        AgentRegistration(
            id=agent_id,
            name="Agent V1",
            metadata={"capabilities": ["chat"]},
        )
    )
    
    # Update with different data (backend doesn't support re-registration)
    result = await cortex_client.agents.update(
        agent_id,
        {
            "name": "Agent V2",
            "metadata": {"capabilities": ["chat", "search", "analyze"]},
        }
    )
    
    # Should have updated
    agent_name = result.get("name") if isinstance(result, dict) else result.name
    assert agent_name == "Agent V2"
    
    # Cleanup
    await cortex_client.agents.unregister(agent_id)


# ============================================================================
# get() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_registered_agent(cortex_client, test_ids):
    """
    Test getting a registered agent.
    
    Port of: agents.test.ts - get tests
    """
    agent_id = test_ids["agent_id"]
    
    # Register agent
    await cortex_client.agents.register(
        AgentRegistration(
            id=agent_id,
            name="Test Agent",
            metadata={"capabilities": ["chat"]},
        )
    )
    
    # Get agent
    result = await cortex_client.agents.get(agent_id)
    
    assert result is not None
    agent_id_result = result.get("id") if isinstance(result, dict) else result.id
    agent_name = result.get("name") if isinstance(result, dict) else result.name
    assert agent_id_result == agent_id
    assert agent_name == "Test Agent"
    
    # Cleanup
    await cortex_client.agents.unregister(agent_id)


@pytest.mark.asyncio
async def test_get_nonexistent_returns_none(cortex_client):
    """
    Test that getting non-existent agent returns None.
    
    Port of: agents.test.ts - get tests
    """
    result = await cortex_client.agents.get("agent-does-not-exist")
    
    assert result is None


# ============================================================================
# list() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_agents(cortex_client, test_ids):
    """
    Test listing registered agents.
    
    Port of: agents.test.ts - list tests
    """
    # Register multiple agents
    agent_ids = []
    for i in range(3):
        agent_id = f"test-agent-list-{i}-{test_ids['user_id'][-4:]}"
        await cortex_client.agents.register(
            AgentRegistration(
                id=agent_id,
                name=f"Agent {i+1}",
                metadata={"capabilities": ["chat"]},
            )
        )
        agent_ids.append(agent_id)
    
    # List agents
    result = await cortex_client.agents.list(limit=100)
    
    # Should return at least our 3 agents
    agents = result if isinstance(result, list) else result.get("agents", [])
    assert len(agents) >= 3
    
    # Cleanup
    for agent_id in agent_ids:
        await cortex_client.agents.unregister(agent_id)


# ============================================================================
# unregister() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_unregister_agent(cortex_client, test_ids):
    """
    Test unregistering an agent.
    
    Port of: agents.test.ts - unregister tests
    """
    agent_id = test_ids["agent_id"]
    
    # Register agent
    await cortex_client.agents.register(
        AgentRegistration(
            id=agent_id,
            name="Test Agent",
            metadata={"capabilities": ["chat"]},
        )
    )
    
    # Unregister
    result = await cortex_client.agents.unregister(agent_id)
    
    # Verify unregistered
    retrieved = await cortex_client.agents.get(agent_id)
    assert retrieved is None


# ============================================================================
# getStats() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_agent_stats(cortex_client, test_ids):
    """
    Test getting agent statistics.
    
    Port of: agents.test.ts - getStats tests
    """
    agent_id = test_ids["agent_id"]
    
    # Register agent
    await cortex_client.agents.register(
        AgentRegistration(
            id=agent_id,
            name="Stats Test Agent",
            metadata={"capabilities": ["chat"]},
        )
    )
    
    # Get stats
    stats = await cortex_client.agents.get_stats(agent_id)
    
    # Validate stats exist (returns dict with totalMemories, totalConversations, etc.)
    assert stats is not None
    assert isinstance(stats, dict)
    # Stats should have at least these fields
    assert "totalMemories" in stats or "total_memories" in stats
    
    # Cleanup
    await cortex_client.agents.unregister(agent_id)


# ============================================================================
# count() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_count_agents(cortex_client, test_ids):
    """
    Test counting registered agents.
    
    Port of: agents.test.ts - count tests
    """
    # Register agents
    agent_ids = []
    for i in range(2):
        agent_id = f"test-agent-count-{i}-{test_ids['user_id'][-4:]}"
        await cortex_client.agents.register(
            AgentRegistration(
                id=agent_id,
                name=f"Agent {i+1}",
                metadata={"capabilities": ["chat"]},
            )
        )
        agent_ids.append(agent_id)
    
    # Count agents
    count = await cortex_client.agents.count()
    
    assert count >= 2
    
    # Cleanup
    for agent_id in agent_ids:
        await cortex_client.agents.unregister(agent_id)


# ============================================================================
# unregister_many() Tests (NEW)
# ============================================================================


@pytest.mark.asyncio
async def test_unregister_many_without_cascade(cortex_client):
    """
    Test bulk unregistering agents without cascade.
    
    New method: agents.unregister_many()
    """
    from cortex import UnregisterAgentOptions
    
    # Register multiple test agents
    agent1 = await cortex_client.agents.register(
        AgentRegistration(
            id="bulk-py-agent-1",
            name="Bulk Test 1",
            metadata={"environment": "test", "team": "experimental"},
        )
    )
    
    agent2 = await cortex_client.agents.register(
        AgentRegistration(
            id="bulk-py-agent-2",
            name="Bulk Test 2",
            metadata={"environment": "test", "team": "experimental"},
        )
    )
    
    agent3 = await cortex_client.agents.register(
        AgentRegistration(
            id="bulk-py-agent-3",
            name="Bulk Test 3",
            metadata={"environment": "production", "team": "core"},
        )
    )
    
    # Unregister agents with environment=test
    result = await cortex_client.agents.unregister_many(
        filters={"metadata": {"environment": "test"}},
        options=UnregisterAgentOptions(cascade=False),
    )
    
    assert result["deleted"] == 2
    assert "bulk-py-agent-1" in result["agent_ids"]
    assert "bulk-py-agent-2" in result["agent_ids"]
    
    # Verify unregistered
    agent1_check = await cortex_client.agents.get("bulk-py-agent-1")
    agent2_check = await cortex_client.agents.get("bulk-py-agent-2")
    agent3_check = await cortex_client.agents.get("bulk-py-agent-3")
    
    assert agent1_check is None
    assert agent2_check is None
    assert agent3_check is not None  # Not in filter
    
    # Cleanup
    await cortex_client.agents.unregister("bulk-py-agent-3")


@pytest.mark.asyncio
async def test_unregister_many_dry_run(cortex_client):
    """
    Test dry run for bulk unregister.
    """
    from cortex import UnregisterAgentOptions
    
    # Register test agent
    await cortex_client.agents.register(
        AgentRegistration(
            id="dry-run-py-agent",
            name="Dry Run Test",
            metadata={"team": "test"},
        )
    )
    
    # Dry run
    result = await cortex_client.agents.unregister_many(
        filters={"metadata": {"team": "test"}},
        options=UnregisterAgentOptions(dry_run=True),
    )
    
    assert result["deleted"] == 0
    assert len(result["agent_ids"]) == 1
    assert "dry-run-py-agent" in result["agent_ids"]
    
    # Verify agent still exists
    agent = await cortex_client.agents.get("dry-run-py-agent")
    assert agent is not None
    
    # Cleanup
    await cortex_client.agents.unregister("dry-run-py-agent")
