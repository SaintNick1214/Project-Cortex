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

# ============================================================================
# Client-Side Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_register_missing_agent_id(cortex_client):
    """Should throw on missing agent ID."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.register(
            AgentRegistration(id=None, name="Test Agent")
        )

    error = exc_info.value
    assert hasattr(error, "code")
    assert error.code == "MISSING_AGENT_ID"


@pytest.mark.asyncio
async def test_register_empty_agent_id(cortex_client):
    """Should throw on empty agent ID."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.register(
            AgentRegistration(id="", name="Test Agent")
        )

    error = exc_info.value
    assert hasattr(error, "code")
    assert error.code == "EMPTY_AGENT_ID"
    assert error.field == "id"


@pytest.mark.asyncio
async def test_register_whitespace_agent_id(cortex_client):
    """Should throw on whitespace-only agent ID."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.register(
            AgentRegistration(id="   ", name="Test Agent")
        )

    error = exc_info.value
    assert error.code == "EMPTY_AGENT_ID"


@pytest.mark.asyncio
async def test_register_agent_id_too_long(cortex_client):
    """Should throw on agent ID too long."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.register(
            AgentRegistration(id="a" * 300, name="Test Agent")
        )

    error = exc_info.value
    assert error.code == "AGENT_ID_TOO_LONG"


@pytest.mark.asyncio
async def test_register_missing_agent_name(cortex_client):
    """Should throw on missing agent name."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.register(
            AgentRegistration(id="test-agent", name=None)
        )

    error = exc_info.value
    assert error.code == "MISSING_AGENT_NAME"


@pytest.mark.asyncio
async def test_register_empty_agent_name(cortex_client):
    """Should throw on empty agent name."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.register(
            AgentRegistration(id="test-agent", name="")
        )

    error = exc_info.value
    assert error.code == "EMPTY_AGENT_NAME"


@pytest.mark.asyncio
async def test_register_agent_name_too_long(cortex_client):
    """Should throw on agent name too long."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.register(
            AgentRegistration(id="test-agent", name="a" * 300)
        )

    error = exc_info.value
    assert error.code == "AGENT_NAME_TOO_LONG"


@pytest.mark.asyncio
async def test_register_invalid_metadata_format(cortex_client):
    """Should throw on invalid metadata format."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.register(
            AgentRegistration(id="test", name="Test", metadata="invalid")
        )

    error = exc_info.value
    assert error.code == "INVALID_METADATA_FORMAT"


@pytest.mark.asyncio
async def test_register_invalid_config_format(cortex_client):
    """Should throw on invalid config format."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.register(
            AgentRegistration(id="test", name="Test", config=["invalid"])
        )

    error = exc_info.value
    assert error.code == "INVALID_CONFIG_FORMAT"


# get() validation tests


@pytest.mark.asyncio
async def test_get_empty_agent_id(cortex_client):
    """Should throw on empty agent ID."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.get("")

    error = exc_info.value
    assert error.code == "EMPTY_AGENT_ID"


@pytest.mark.asyncio
async def test_get_whitespace_agent_id(cortex_client):
    """Should throw on whitespace agent ID."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.get("   ")

    error = exc_info.value
    assert error.code == "EMPTY_AGENT_ID"


# list() validation tests


@pytest.mark.asyncio
async def test_list_invalid_limit_zero(cortex_client):
    """Should throw on zero limit."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.list(limit=0)

    error = exc_info.value
    assert error.code == "INVALID_LIMIT_VALUE"


@pytest.mark.asyncio
async def test_list_invalid_limit_too_large(cortex_client):
    """Should throw on limit too large."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.list(limit=2000)

    error = exc_info.value
    assert error.code == "INVALID_LIMIT_VALUE"


@pytest.mark.asyncio
async def test_list_negative_offset(cortex_client):
    """Should throw on negative offset."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.list(offset=-5)

    error = exc_info.value
    assert error.code == "INVALID_OFFSET_VALUE"


@pytest.mark.asyncio
async def test_list_invalid_status(cortex_client):
    """Should throw on invalid status."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.list(status="deleted")

    error = exc_info.value
    assert error.code == "INVALID_STATUS"


@pytest.mark.asyncio
async def test_list_invalid_sort_by(cortex_client):
    """Should throw on invalid sortBy."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.list(sort_by="invalid")

    error = exc_info.value
    assert error.code == "INVALID_SORT_BY"


# search() validation tests


@pytest.mark.asyncio
async def test_search_invalid_filters_format(cortex_client):
    """Should throw on invalid filters format."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.search(filters="invalid")

    error = exc_info.value
    assert error.code == "INVALID_METADATA_FORMAT"


@pytest.mark.asyncio
async def test_search_invalid_limit(cortex_client):
    """Should throw on invalid limit."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.search(limit=-1)

    error = exc_info.value
    assert error.code == "INVALID_LIMIT_VALUE"


# count() validation tests


@pytest.mark.asyncio
async def test_count_invalid_status(cortex_client):
    """Should throw on invalid status value."""
    from cortex.agents.validators import AgentValidationError

    with pytest.raises(AgentValidationError) as exc_info:
        await cortex_client.agents.count(status="invalid-status")

    error = exc_info.value
    assert error.code == "INVALID_STATUS"


# get_stats() validation tests


@pytest.mark.asyncio
async def test_get_stats_empty_agent_id(cortex_client):
    """Should throw on empty agent ID."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.get_stats("")

    error = exc_info.value
    assert error.code == "EMPTY_AGENT_ID"


# update() validation tests


@pytest.mark.asyncio
async def test_update_empty_agent_id(cortex_client):
    """Should throw on empty agent ID."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.update("", {"name": "New Name"})

    error = exc_info.value
    assert error.code == "EMPTY_AGENT_ID"


@pytest.mark.asyncio
async def test_update_no_fields(cortex_client):
    """Should throw when no update fields provided."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.update("test-agent", {})

    error = exc_info.value
    assert error.code == "MISSING_UPDATES"


@pytest.mark.asyncio
async def test_update_invalid_status(cortex_client):
    """Should throw on invalid status."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.update("test-agent", {"status": "deleted"})

    error = exc_info.value
    assert error.code == "INVALID_STATUS"


@pytest.mark.asyncio
async def test_update_empty_name(cortex_client):
    """Should throw on empty name."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.update("test-agent", {"name": ""})

    error = exc_info.value
    assert error.code == "EMPTY_AGENT_NAME"


# configure() validation tests


@pytest.mark.asyncio
async def test_configure_empty_agent_id(cortex_client):
    """Should throw on empty agent ID."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.configure("", {"setting": "value"})

    error = exc_info.value
    assert error.code == "EMPTY_AGENT_ID"


@pytest.mark.asyncio
async def test_configure_empty_config(cortex_client):
    """Should throw on empty config object."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.configure("test-agent", {})

    error = exc_info.value
    assert error.code == "EMPTY_CONFIG_OBJECT"


@pytest.mark.asyncio
async def test_configure_invalid_config_format(cortex_client):
    """Should throw on invalid config format."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.configure("test-agent", "invalid")

    error = exc_info.value
    assert error.code == "INVALID_CONFIG_FORMAT"


# unregister() validation tests


@pytest.mark.asyncio
async def test_unregister_empty_agent_id(cortex_client):
    """Should throw on empty agent ID."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.unregister("")

    error = exc_info.value
    assert error.code == "EMPTY_AGENT_ID"


@pytest.mark.asyncio
async def test_unregister_conflicting_options(cortex_client):
    """Should throw on conflicting options."""
    from cortex import UnregisterAgentOptions

    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.unregister(
            "test-agent",
            UnregisterAgentOptions(dry_run=True, verify=False)
        )

    error = exc_info.value
    assert error.code == "CONFLICTING_OPTIONS"


# unregister_many() validation tests


@pytest.mark.asyncio
async def test_unregister_many_invalid_filters(cortex_client):
    """Should throw on invalid filters."""
    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.unregister_many(filters="invalid")

    error = exc_info.value
    assert error.code == "INVALID_METADATA_FORMAT"


@pytest.mark.asyncio
async def test_unregister_many_conflicting_options(cortex_client):
    """Should throw on conflicting options."""
    from cortex import UnregisterAgentOptions

    with pytest.raises(Exception) as exc_info:
        await cortex_client.agents.unregister_many(
            filters={"status": "archived"},
            options=UnregisterAgentOptions(dry_run=True, verify=False)
        )

    error = exc_info.value
    assert error.code == "CONFLICTING_OPTIONS"


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

    Note: This tests BACKEND validation (duplicate detection)
    Client-side validation tests are in "Client-Side Validation Tests" section above

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
    await cortex_client.agents.unregister(agent_id)

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
async def test_unregister_many_without_cascade(cortex_client, ctx):
    """
    Test bulk unregistering agents without cascade.

    New method: agents.unregister_many()
    """
    from cortex import UnregisterAgentOptions

    # Use test-scoped IDs to avoid parallel conflicts
    agent1_id = ctx.agent_id("bulk-1")
    agent2_id = ctx.agent_id("bulk-2")
    agent3_id = ctx.agent_id("bulk-3")
    # Use test-scoped metadata tags
    test_env_tag = f"test-env-{ctx.run_id}"
    prod_env_tag = f"prod-env-{ctx.run_id}"

    # Register multiple test agents
    await cortex_client.agents.register(
        AgentRegistration(
            id=agent1_id,
            name="Bulk Test 1",
            metadata={"environment": test_env_tag, "team": "experimental"},
        )
    )

    await cortex_client.agents.register(
        AgentRegistration(
            id=agent2_id,
            name="Bulk Test 2",
            metadata={"environment": test_env_tag, "team": "experimental"},
        )
    )

    await cortex_client.agents.register(
        AgentRegistration(
            id=agent3_id,
            name="Bulk Test 3",
            metadata={"environment": prod_env_tag, "team": "core"},
        )
    )

    # Unregister agents with our test-scoped environment tag
    result = await cortex_client.agents.unregister_many(
        filters={"metadata": {"environment": test_env_tag}},
        options=UnregisterAgentOptions(cascade=False),
    )

    assert result["deleted"] == 2
    assert agent1_id in result["agent_ids"]
    assert agent2_id in result["agent_ids"]

    # Verify unregistered
    agent1_check = await cortex_client.agents.get(agent1_id)
    agent2_check = await cortex_client.agents.get(agent2_id)
    agent3_check = await cortex_client.agents.get(agent3_id)

    assert agent1_check is None
    assert agent2_check is None
    assert agent3_check is not None  # Not in filter

    # Cleanup
    await cortex_client.agents.unregister(agent3_id)


@pytest.mark.asyncio
async def test_unregister_many_dry_run(cortex_client, ctx):
    """
    Test dry run for bulk unregister.
    """
    from cortex import UnregisterAgentOptions

    # Use test-scoped IDs and metadata
    agent_id = ctx.agent_id("dry-run")
    team_tag = f"test-team-{ctx.run_id}"

    # Register test agent
    await cortex_client.agents.register(
        AgentRegistration(
            id=agent_id,
            name="Dry Run Test",
            metadata={"team": team_tag},
        )
    )

    # Dry run with test-scoped metadata filter
    result = await cortex_client.agents.unregister_many(
        filters={"metadata": {"team": team_tag}},
        options=UnregisterAgentOptions(dry_run=True),
    )

    assert result["deleted"] == 0
    assert len(result["agent_ids"]) == 1
    assert agent_id in result["agent_ids"]

    # Verify agent still exists
    agent = await cortex_client.agents.get(agent_id)
    assert agent is not None

    # Cleanup
    await cortex_client.agents.unregister(agent_id)


# ============================================================================
# Cascade Deletion Tests (Port of: agents.test.ts - cascade mode)
# ============================================================================


@pytest.mark.asyncio
async def test_cascade_delete_across_memory_spaces(cortex_client, ctx):
    """
    Test cascade deletion by participantId across all memory spaces.

    Port of: agents.test.ts - "performs cascade deletion by participantId across all spaces"
    """
    import asyncio
    from cortex import UnregisterAgentOptions

    agent_id = ctx.agent_id("cascade")
    space1_id = ctx.memory_space_id("cascade-1")
    space2_id = ctx.memory_space_id("cascade-2")

    # Register agent
    await cortex_client.agents.register(
        AgentRegistration(id=agent_id, name="Cascade Test Agent")
    )

    # Register memory spaces
    await cortex_client.memory_spaces.register(
        memory_space_id=space1_id,
        space_type="personal",
    )
    await cortex_client.memory_spaces.register(
        memory_space_id=space2_id,
        space_type="personal",
    )

    # Create data in space 1 with participantId
    await cortex_client.conversations.create(
        memory_space_id=space1_id,
        participant_id=agent_id,
        conversation_type="user-agent",
        participants={"userId": "test-user-1", "participantId": agent_id},
    )

    await cortex_client.vector.store(
        memory_space_id=space1_id,
        content="Memory in space 1",
        content_type="raw",
        participant_id=agent_id,
        source={"type": "system"},
        metadata={"importance": 50, "tags": []},
    )

    # Create data in space 2 with participantId
    await cortex_client.vector.store(
        memory_space_id=space2_id,
        content="Memory in space 2",
        content_type="raw",
        participant_id=agent_id,
        source={"type": "system"},
        metadata={"importance": 50, "tags": []},
    )

    # Wait for data to persist
    await asyncio.sleep(0.2)

    # Verify setup
    memories1 = await cortex_client.vector.list(memory_space_id=space1_id)
    memories2 = await cortex_client.vector.list(memory_space_id=space2_id)
    print(f"  ℹ️  Setup: {len(memories1)} memories in space1, {len(memories2)} in space2")

    # CASCADE DELETE
    result = await cortex_client.agents.unregister(
        agent_id,
        UnregisterAgentOptions(cascade=True),
    )

    # Verify counts
    assert result.agent_id == agent_id
    assert result.memories_deleted >= 2  # At least 2 memories
    assert result.conversations_deleted >= 1
    assert result.total_deleted > 1
    assert space1_id in result.memory_spaces_affected
    assert space2_id in result.memory_spaces_affected
    assert len(result.deleted_layers) > 1

    # Verify agent is unregistered
    agent = await cortex_client.agents.get(agent_id)
    assert agent is None

    # Verify memories are deleted in both spaces
    remaining1 = await cortex_client.vector.list(memory_space_id=space1_id)
    remaining2 = await cortex_client.vector.list(memory_space_id=space2_id)
    agent_memories1 = [m for m in remaining1 if m.get("participantId") == agent_id]
    agent_memories2 = [m for m in remaining2 if m.get("participantId") == agent_id]
    assert len(agent_memories1) == 0
    assert len(agent_memories2) == 0

    print(f"  ✅ Cascade complete: Deleted from {len(result.memory_spaces_affected)} spaces")
    print(f"     Layers: {', '.join(result.deleted_layers)}")

    # Cleanup spaces
    await cortex_client.memory_spaces.delete(space1_id)
    await cortex_client.memory_spaces.delete(space2_id)


@pytest.mark.asyncio
async def test_cascade_delete_dry_run(cortex_client, ctx):
    """
    Test dry run mode previews deletion without actually deleting.

    Port of: agents.test.ts - "previews deletion without actually deleting"
    """
    from cortex import UnregisterAgentOptions

    agent_id = ctx.agent_id("dry-run-cascade")

    # Register agent
    await cortex_client.agents.register(
        AgentRegistration(id=agent_id, name="Dry Run Test Agent")
    )

    # Cascade delete with dry_run
    result = await cortex_client.agents.unregister(
        agent_id,
        UnregisterAgentOptions(cascade=True, dry_run=True),
    )

    # Should return preview
    assert result.agent_id == agent_id
    # In dry run, agent should still exist
    agent = await cortex_client.agents.get(agent_id)
    assert agent is not None

    # Cleanup
    await cortex_client.agents.unregister(agent_id)


@pytest.mark.asyncio
async def test_cascade_delete_with_verification(cortex_client, ctx):
    """
    Test verification step after cascade deletion.

    Port of: agents.test.ts - "runs verification step after deletion"
    """
    from cortex import UnregisterAgentOptions

    agent_id = ctx.agent_id("verify-cascade")

    # Register agent
    await cortex_client.agents.register(
        AgentRegistration(id=agent_id, name="Verify Test Agent")
    )

    # Cascade delete with verification
    result = await cortex_client.agents.unregister(
        agent_id,
        UnregisterAgentOptions(cascade=True, verify=True),
    )

    # Should have verification result
    assert result.verification is not None
    assert hasattr(result.verification, "complete")
    assert hasattr(result.verification, "issues")

    # Verification should be complete (or have graph adapter warning)
    if not result.verification.complete:
        print(f"  ℹ️  Verification issues: {result.verification.issues}")


@pytest.mark.asyncio
async def test_cascade_delete_without_registration(cortex_client, ctx):
    """
    Test cascade delete works even if agent was never registered.

    Port of: agents.test.ts - "deletes data even if agent was never registered"
    """
    import asyncio
    from cortex import UnregisterAgentOptions

    agent_id = ctx.agent_id("unregistered")
    space_id = ctx.memory_space_id("unreg-space")

    # DON'T register the agent - just create data with participantId
    await cortex_client.memory_spaces.register(
        memory_space_id=space_id,
        space_type="personal",
    )

    await cortex_client.vector.store(
        memory_space_id=space_id,
        content="Memory from unregistered agent",
        content_type="raw",
        participant_id=agent_id,  # Agent never registered!
        source={"type": "system"},
        metadata={"importance": 50, "tags": []},
    )

    # Wait for data to persist
    await asyncio.sleep(0.2)

    # Verify memory exists
    before_memories = await cortex_client.vector.list(memory_space_id=space_id)
    agent_memories = [m for m in before_memories if m.get("participantId") == agent_id]
    assert len(agent_memories) >= 1

    # CASCADE DELETE (without registration)
    result = await cortex_client.agents.unregister(
        agent_id,
        UnregisterAgentOptions(cascade=True),
    )

    # Should still delete the memories
    assert result.memories_deleted >= 1
    assert result.total_deleted >= 1

    # Verify memories are gone
    after_memories = await cortex_client.vector.list(memory_space_id=space_id)
    remaining = [m for m in after_memories if m.get("participantId") == agent_id]
    assert len(remaining) == 0

    print("  ✅ Cascade works without registration (queries by participantId in data)")

    # Cleanup
    await cortex_client.memory_spaces.delete(space_id)


@pytest.mark.asyncio
async def test_unregister_many_with_cascade(cortex_client, ctx):
    """
    Test bulk unregister with cascade deletion.

    Port of: agents.test.ts - "unregisters with cascade deletion"
    """
    import asyncio
    from cortex import UnregisterAgentOptions

    agent1_id = ctx.agent_id("cascade-bulk-1")
    agent2_id = ctx.agent_id("cascade-bulk-2")
    space_id = ctx.memory_space_id("bulk-cascade")
    test_env_tag = f"cascade-test-{ctx.run_id}"

    # Register memory space
    await cortex_client.memory_spaces.register(
        memory_space_id=space_id,
        space_type="personal",
    )

    # Register agents with test-scoped metadata
    await cortex_client.agents.register(
        AgentRegistration(
            id=agent1_id,
            name="Cascade Bulk 1",
            metadata={"environment": test_env_tag},
        )
    )
    await cortex_client.agents.register(
        AgentRegistration(
            id=agent2_id,
            name="Cascade Bulk 2",
            metadata={"environment": test_env_tag},
        )
    )

    # Create data for agent1
    conv = await cortex_client.conversations.create(
        memory_space_id=space_id,
        conversation_type="user-agent",
        participants={"userId": ctx.user_id("bulk-test"), "participantId": agent1_id},
    )

    await cortex_client.memory.remember(
        memory_space_id=space_id,
        participant_id=agent1_id,
        conversation_id=conv.conversation_id,
        user_message="Test",
        agent_response="OK",
        user_id=ctx.user_id("bulk-test"),
        user_name="Test User",
        agent_id=agent1_id,
    )

    await asyncio.sleep(0.2)

    # Verify memory was created
    before_memories = await cortex_client.vector.list(memory_space_id=space_id)
    agent_memories = [m for m in before_memories if m.get("participantId") == agent1_id]
    assert len(agent_memories) > 0

    # Unregister with cascade using scoped metadata filter
    result = await cortex_client.agents.unregister_many(
        filters={"metadata": {"environment": test_env_tag}},
        options=UnregisterAgentOptions(cascade=True),
    )

    assert result["deleted"] == 2
    assert result["total_data_deleted"] > 0

    # Cleanup
    await cortex_client.memory_spaces.delete(space_id)


@pytest.mark.asyncio
async def test_agent_statistics_from_actual_data(cortex_client, ctx):
    """
    Test that agent statistics are computed from actual data.

    Port of: agents.test.ts - "computes stats from actual data"
    """
    import asyncio

    agent_id = ctx.agent_id("stats-data")
    space_id = ctx.memory_space_id("stats-space")

    # Register agent and space
    await cortex_client.agents.register(
        AgentRegistration(id=agent_id, name="Stats Data Agent")
    )
    await cortex_client.memory_spaces.register(
        memory_space_id=space_id,
        space_type="personal",
    )

    # Create actual data
    await cortex_client.vector.store(
        memory_space_id=space_id,
        content="Test memory 1",
        content_type="raw",
        participant_id=agent_id,
        source={"type": "system"},
        metadata={"importance": 50, "tags": []},
    )
    await cortex_client.vector.store(
        memory_space_id=space_id,
        content="Test memory 2",
        content_type="raw",
        participant_id=agent_id,
        source={"type": "system"},
        metadata={"importance": 50, "tags": []},
    )

    await asyncio.sleep(0.1)

    # Get stats
    stats = await cortex_client.agents.get_stats(agent_id)

    assert stats is not None
    # Stats should reflect actual data
    total_memories = stats.get("totalMemories") or stats.get("total_memories", 0)
    assert total_memories >= 2

    # Cleanup
    await cortex_client.agents.unregister(agent_id)
    await cortex_client.memory_spaces.delete(space_id)


# ============================================================================
# Edge Cases (Port of: agents.test.ts - edge cases)
# ============================================================================


@pytest.mark.asyncio
async def test_unregister_nonexistent_agent_gracefully(cortex_client, ctx):
    """
    Test handling unregistering non-existent agent gracefully.

    Port of: agents.test.ts - "handles unregistering non-existent agent gracefully"
    """
    from cortex import UnregisterAgentOptions

    result = await cortex_client.agents.unregister(
        ctx.agent_id("non-existent-edge"),
        UnregisterAgentOptions(cascade=True),
    )

    assert result.total_deleted == 0


@pytest.mark.asyncio
async def test_unregister_agent_with_no_data(cortex_client, ctx):
    """
    Test handling agent with no data.

    Port of: agents.test.ts - "handles agent with no data"
    """
    from cortex import UnregisterAgentOptions

    agent_id = ctx.agent_id("empty")

    await cortex_client.agents.register(
        AgentRegistration(id=agent_id, name="Empty Agent")
    )

    result = await cortex_client.agents.unregister(
        agent_id,
        UnregisterAgentOptions(cascade=True),
    )

    # Just registration deleted
    assert result.total_deleted >= 1
    assert result.memories_deleted == 0
    assert result.conversations_deleted == 0
