"""
Comprehensive State Transition Testing

Tests all valid state transitions across stateful entities to ensure:
1. Valid transitions succeed
2. Invalid transitions are rejected
3. List/count reflect transitions immediately
4. Data preserved through transitions
5. Cascade effects properly handled
"""

import pytest

from cortex.types import AgentRegistration, ContextInput, RegisterMemorySpaceParams

# State definitions from schema
CONTEXT_STATUSES = ["active", "completed", "cancelled", "blocked"]
MEMORYSPACE_STATUSES = ["active", "archived"]
AGENT_STATUSES = ["active", "inactive", "archived"]

# Valid transitions
CONTEXT_TRANSITIONS = [
    ("active", "completed"),
    ("active", "cancelled"),
    ("active", "blocked"),
    ("blocked", "active"),
    ("blocked", "cancelled"),
    ("completed", "active"),  # Reopen
]

MEMORYSPACE_TRANSITIONS = [
    ("active", "archived"),
]

AGENT_TRANSITIONS = [
    ("active", "inactive"),
    ("active", "archived"),
    ("inactive", "active"),
    ("inactive", "archived"),
]


@pytest.fixture(scope="module")
def base_id():
    import time
    return f"state-test-{int(time.time() * 1000)}"


@pytest.fixture(scope="module")
def test_user_id():
    return "state-test-user"


class TestContextStateTransitions:
    """Context state transition tests."""

    @pytest.mark.parametrize("from_status,to_status", CONTEXT_TRANSITIONS)
    async def test_context_transition(self, cortex_client, base_id, test_user_id, from_status, to_status):
        """Test successful context state transition."""
        space_id = f"{base_id}-ctx-{from_status}-{to_status}"
        user_id = f"user-{from_status}-{to_status}"

        # Create context in initial state
        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose=f"Testing {from_status} → {to_status}",
                status=from_status,
            )
        )

        assert ctx.status == from_status
        assert ctx.id is not None

        # Verify in list with initial status
        before_list_result = await cortex_client.contexts.list(
            memory_space_id=space_id, status=from_status
        )
        before_list = before_list_result.get("contexts", [])
        assert any(c.id == ctx.id for c in before_list)

        # Transition to new status
        updated = await cortex_client.contexts.update(ctx.id, updates={"status": to_status})

        assert updated.status == to_status
        assert updated.id == ctx.id

        # Verify in list with new status
        after_list_result = await cortex_client.contexts.list(
            memory_space_id=space_id, status=to_status
        )
        after_list = after_list_result.get("contexts", [])
        assert any(c.id == ctx.id for c in after_list)

        # Verify NOT in list with old status
        old_status_list_result = await cortex_client.contexts.list(
            memory_space_id=space_id, status=from_status
        )
        old_status_list = old_status_list_result.get("contexts", [])
        assert not any(c.id == ctx.id for c in old_status_list)

    @pytest.mark.parametrize("from_status,to_status", CONTEXT_TRANSITIONS)
    async def test_context_count_reflects_transition(
        self, cortex_client, base_id, test_user_id, from_status, to_status
    ):
        """Test count reflects state transition."""
        space_id = f"{base_id}-ctx-count-{from_status}-{to_status}"
        user_id = f"user-count-{from_status}-{to_status}"

        # Get initial counts
        before_from_count = await cortex_client.contexts.count(
            memory_space_id=space_id, status=from_status
        )
        before_to_count = await cortex_client.contexts.count(
            memory_space_id=space_id, status=to_status
        )

        # Create and transition
        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Count test",
                status=from_status,
            )
        )

        await cortex_client.contexts.update(ctx.id, updates={"status": to_status})

        # Get final counts
        after_from_count = await cortex_client.contexts.count(
            memory_space_id=space_id, status=from_status
        )
        after_to_count = await cortex_client.contexts.count(
            memory_space_id=space_id, status=to_status
        )

        # Validate count changes
        assert after_from_count == before_from_count
        assert after_to_count == before_to_count + 1

    async def test_data_preservation_through_transitions(
        self, cortex_client, base_id, test_user_id
    ):
        """Test data preserved through status transitions."""
        space_id = f"{base_id}-ctx-preserve"
        user_id = "preserve-user"
        original_data = {
            "taskId": "task-123",
            "priority": "high",
            "assignee": "agent-1",
        }

        # Create with data
        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Data preservation test",
                status="active",
                data=original_data,
            )
        )

        # Transition through multiple states
        await cortex_client.contexts.update(ctx.id, updates={"status": "blocked"})
        blocked = await cortex_client.contexts.get(ctx.id)
        assert blocked.data == original_data

        await cortex_client.contexts.update(ctx.id, updates={"status": "completed"})
        completed = await cortex_client.contexts.get(ctx.id)
        assert completed.data == original_data

        await cortex_client.contexts.update(ctx.id, updates={"status": "active"})
        reactivated = await cortex_client.contexts.get(ctx.id)
        assert reactivated.data == original_data

    async def test_completed_at_set_on_completion(
        self, cortex_client, base_id, test_user_id
    ):
        """Test completedAt set when transitioning to completed."""
        space_id = f"{base_id}-ctx-completed"
        user_id = "completed-user"

        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Completion test",
                status="active",
            )
        )

        assert ctx.completed_at is None

        # Transition to completed
        completed = await cortex_client.contexts.update(
            ctx.id, updates={"status": "completed"}
        )

        assert completed.completed_at is not None
        assert completed.completed_at > 0

    async def test_parent_child_preserved_through_transitions(
        self, cortex_client, base_id, test_user_id
    ):
        """Test parent/child relationships preserved through transitions."""
        space_id = f"{base_id}-ctx-hierarchy"
        user_id = "hierarchy-user"

        parent = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Parent context",
                status="active",
            )
        )

        child = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Child context",
                status="active",
                parent_id=parent.id,
            )
        )

        # Transition parent
        await cortex_client.contexts.update(parent.id, updates={"status": "completed"})

        # Verify child still references parent
        child_after = await cortex_client.contexts.get(child.id)
        assert child_after.parent_id == parent.id

    async def test_rapid_state_transitions(self, cortex_client, base_id, test_user_id):
        """Test rapid state transitions."""
        space_id = f"{base_id}-ctx-rapid"
        user_id = "rapid-user"

        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Rapid transition test",
                status="active",
            )
        )

        # Rapid transitions
        await cortex_client.contexts.update(ctx.id, updates={"status": "blocked"})
        await cortex_client.contexts.update(ctx.id, updates={"status": "active"})
        await cortex_client.contexts.update(ctx.id, updates={"status": "completed"})
        await cortex_client.contexts.update(ctx.id, updates={"status": "active"})

        final = await cortex_client.contexts.get(ctx.id)
        assert final.status == "active"

    async def test_all_statuses_independently(
        self, cortex_client, base_id, test_user_id
    ):
        """Test all contexts can independently transition."""
        space_id = f"{base_id}-ctx-independent"
        user_id = "independent-user"

        # Create 4 contexts, one in each status
        contexts = []
        for status in CONTEXT_STATUSES:
            ctx = await cortex_client.contexts.create(
                ContextInput(
                    memory_space_id=space_id,
                    user_id=user_id,
                    purpose=f"Context {status}",
                    status=status,
                )
            )
            contexts.append((ctx, status))

        # Verify each in correct status list
        for ctx, status in contexts:
            status_list_result = await cortex_client.contexts.list(memory_space_id=space_id, status=status)

            status_list = status_list_result.get("contexts", [])
            assert any(c.id == ctx.id for c in status_list)

        # Transition each to different status
        await cortex_client.contexts.update(contexts[0][0].id, updates={"status": "completed"})
        await cortex_client.contexts.update(contexts[1][0].id, updates={"status": "active"})
        await cortex_client.contexts.update(contexts[2][0].id, updates={"status": "blocked"})
        await cortex_client.contexts.update(contexts[3][0].id, updates={"status": "cancelled"})

        # Verify new states
        ctx0 = await cortex_client.contexts.get(contexts[0][0].id)
        ctx1 = await cortex_client.contexts.get(contexts[1][0].id)
        ctx2 = await cortex_client.contexts.get(contexts[2][0].id)
        ctx3 = await cortex_client.contexts.get(contexts[3][0].id)

        assert ctx0.status == "completed"
        assert ctx1.status == "active"
        assert ctx2.status == "blocked"
        assert ctx3.status == "cancelled"


class TestMemorySpaceStateTransitions:
    """Memory space state transition tests."""

    async def test_active_to_archived_transition(self, cortex_client, base_id):
        """Test transition from active to archived."""
        import time
        space_id = f"{base_id}-space-archive-{int(time.time() * 1000)}"

        # Register as active
        space = await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id, type="project", name="Archive test"
            )
        )

        assert space.status == "active"

        # Verify in active list
        active_list = await cortex_client.memory_spaces.list(status="active")
        assert any(s.memory_space_id == space_id for s in active_list.get("spaces", []))

        # Archive
        archived = await cortex_client.memory_spaces.archive(space_id)
        assert archived.status == "archived"

        # Verify in archived list
        archived_list = await cortex_client.memory_spaces.list(status="archived")
        assert any(s.memory_space_id == space_id for s in archived_list.get("spaces", []))

        # Verify NOT in active list
        active_list_after = await cortex_client.memory_spaces.list(status="active")
        assert not any(
            s.memory_space_id == space_id for s in active_list_after.get("spaces", [])
        )

    async def test_archived_to_active_via_reactivate(self, cortex_client, base_id):
        """Test transition from archived to active via reactivate."""
        import time
        space_id = f"{base_id}-space-reactivate-{int(time.time() * 1000)}"

        # Register and archive
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id, type="project", name="Reactivate test"
            )
        )
        await cortex_client.memory_spaces.archive(space_id)

        # Verify archived
        archived_list = await cortex_client.memory_spaces.list(status="archived")
        assert any(s.memory_space_id == space_id for s in archived_list.get("spaces", []))

        # Reactivate
        reactivated = await cortex_client.memory_spaces.reactivate(space_id)
        assert reactivated.status == "active"

        # Verify in active list
        active_list = await cortex_client.memory_spaces.list(status="active")
        assert any(s.memory_space_id == space_id for s in active_list.get("spaces", []))

    async def test_count_reflects_archive_transition(self, cortex_client, base_id):
        """Test count reflects archive transition."""
        import time
        space_id = f"{base_id}-space-count-{int(time.time() * 1000)}"

        # Get initial counts
        before_active = await cortex_client.memory_spaces.count(status="active")
        before_archived = await cortex_client.memory_spaces.count(status="archived")

        # Register and archive
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id, type="project", name="Count test"
            )
        )
        await cortex_client.memory_spaces.archive(space_id)

        # Get final counts
        after_active = await cortex_client.memory_spaces.count(status="active")
        after_archived = await cortex_client.memory_spaces.count(status="archived")

        # Active unchanged (added then removed)
        assert after_active == before_active

        # Archived increased
        assert after_archived == before_archived + 1

    async def test_metadata_preserved_through_archive_cycle(
        self, cortex_client, base_id
    ):
        """Test metadata preserved through archive/reactivate cycle."""
        import time
        space_id = f"{base_id}-space-preserve-{int(time.time() * 1000)}"
        original_metadata = {
            "project_name": "Test Project",
            "owner": "team-alpha",
            "tags": ["important", "active-project"],
        }

        # Register with metadata
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id,
                type="project",
                name="Metadata test",
                metadata=original_metadata,
            )
        )

        # Archive
        await cortex_client.memory_spaces.archive(space_id, reason="Project completed")

        archived = await cortex_client.memory_spaces.get(space_id)
        assert archived.metadata.get("project_name") == "Test Project"
        assert archived.metadata.get("owner") == "team-alpha"

        # Reactivate
        await cortex_client.memory_spaces.reactivate(space_id)

        reactivated = await cortex_client.memory_spaces.get(space_id)
        assert reactivated.metadata.get("project_name") == "Test Project"
        assert reactivated.metadata.get("owner") == "team-alpha"

    async def test_participants_preserved_through_archive(self, cortex_client, base_id):
        """Test participants preserved through archive/reactivate."""
        import time
        space_id = f"{base_id}-space-participants-{int(time.time() * 1000)}"
        participants = [
            {"id": "user-1", "type": "user", "joinedAt": int(time.time() * 1000)},
            {"id": "agent-1", "type": "agent", "joinedAt": int(time.time() * 1000)},
        ]

        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id,
                type="team",
                name="Participant test",
                participants=participants,
            )
        )

        # Archive and reactivate
        await cortex_client.memory_spaces.archive(space_id)
        await cortex_client.memory_spaces.reactivate(space_id)

        space = await cortex_client.memory_spaces.get(space_id)
        assert len(space.participants) == 2
        assert any(p.get("id") == "user-1" for p in space.participants)
        assert any(p.get("id") == "agent-1" for p in space.participants)

    async def test_archived_space_queryable_and_updatable(
        self, cortex_client, base_id
    ):
        """Test archived space can be queried but behaves correctly."""
        import time
        space_id = f"{base_id}-space-readonly-{int(time.time() * 1000)}"

        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id, type="project", name="Readonly test"
            )
        )

        await cortex_client.memory_spaces.archive(space_id)

        # Can get
        space = await cortex_client.memory_spaces.get(space_id)
        assert space is not None
        assert space.status == "archived"

        # Can list
        archived_list = await cortex_client.memory_spaces.list(status="archived")
        assert any(s.memory_space_id == space_id for s in archived_list.get("spaces", []))

        # Update metadata works
        await cortex_client.memory_spaces.update(
            space_id, updates={"metadata": {"note": "Updated while archived"}}
        )

        updated = await cortex_client.memory_spaces.get(space_id)
        assert updated.metadata.get("note") == "Updated while archived"

    async def test_archive_with_reason_stores_metadata(self, cortex_client, base_id):
        """Test archiving with reason stores metadata."""
        import time
        space_id = f"{base_id}-space-reason-{int(time.time() * 1000)}"

        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id, type="project", name="Reason test"
            )
        )

        reason = "Project completed successfully"
        archived = await cortex_client.memory_spaces.archive(
            space_id, reason=reason, metadata={"completed_by": "user-1"}
        )

        assert archived.metadata.get("archive_reason") == reason
        assert archived.metadata.get("archived_at") is not None
        assert archived.metadata.get("completed_by") == "user-1"


class TestAgentStateTransitions:
    """Agent state transition tests."""

    @pytest.mark.parametrize("from_status,to_status", AGENT_TRANSITIONS)
    async def test_agent_transition(
        self, cortex_client, from_status, to_status
    ):
        """Test successful agent state transition."""
        import time
        agent_id = f"agent-{from_status}-{to_status}-{int(time.time() * 1000)}"

        # Register agent (always defaults to 'active')
        agent = await cortex_client.agents.register(
            AgentRegistration(
                id=agent_id,
                name=f"Agent {from_status} to {to_status}",
            )
        )

        assert agent.status == "active"

        # Update to from_status first (if not already active)
        if from_status != "active":
            await cortex_client.agents.update(agent_id, updates={"status": from_status})

        # Then transition to to_status
        updated = await cortex_client.agents.update(agent_id, updates={"status": to_status})
        assert updated.status == to_status

        # Verify in list
        agent_list = await cortex_client.agents.list(status=to_status)
        assert any(a.id == agent_id for a in agent_list)

        # Verify NOT in from_status list
        old_list = await cortex_client.agents.list(status=from_status)
        assert not any(a.id == agent_id for a in old_list)

    async def test_inactive_agent_preserves_capabilities(self, cortex_client):
        """Test inactive agent preserves metadata (including capabilities)."""
        import time
        agent_id = f"agent-preserve-{int(time.time() * 1000)}"

        # Register agent with capabilities in metadata
        agent = await cortex_client.agents.register(
            AgentRegistration(
                id=agent_id,
                name="Capability test agent",
                metadata={"capabilities": ["code", "analysis", "testing"]},
            )
        )

        # Verify capabilities stored in metadata
        assert agent.metadata.get("capabilities") == ["code", "analysis", "testing"]

        # Deactivate
        await cortex_client.agents.update(agent_id, updates={"status": "inactive"})

        inactive = await cortex_client.agents.get(agent_id)
        assert inactive.status == "inactive"
        assert inactive.metadata.get("capabilities") == ["code", "analysis", "testing"]

        # Reactivate
        await cortex_client.agents.update(agent_id, updates={"status": "active"})

        reactivated = await cortex_client.agents.get(agent_id)
        assert reactivated.status == "active"
        assert reactivated.metadata.get("capabilities") == ["code", "analysis", "testing"]


class TestCrossEntityStateEffects:
    """Test cross-entity state effects."""

    async def test_archiving_space_preserves_contexts(
        self, cortex_client, base_id, test_user_id
    ):
        """Test archiving memory space doesn't affect contexts."""
        import time
        space_id = f"{base_id}-cross-archive-{int(time.time() * 1000)}"
        user_id = "cross-user"

        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id, type="project", name="Cross-effect test"
            )
        )

        # Create context
        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Test context",
                status="active",
            )
        )

        # Archive space
        await cortex_client.memory_spaces.archive(space_id)

        # Context should still exist
        context_after = await cortex_client.contexts.get(ctx.id)
        assert context_after is not None
        assert context_after.status == "active"

    async def test_parent_completion_doesnt_cascade_to_children(
        self, cortex_client, base_id, test_user_id
    ):
        """Test completing parent doesn't auto-complete children."""
        import time
        space_id = f"{base_id}-parent-complete-{int(time.time() * 1000)}"
        user_id = "parent-user"

        parent = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Parent",
                status="active",
            )
        )

        child = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Child",
                status="active",
                parent_id=parent.id,
            )
        )

        # Complete parent
        await cortex_client.contexts.update(parent.id, updates={"status": "completed"})

        # Child should still be active
        child_after = await cortex_client.contexts.get(child.id)
        assert child_after.status == "active"

    async def test_multiple_statuses_in_same_space(
        self, cortex_client, base_id, test_user_id
    ):
        """Test multiple contexts in same space with different statuses."""
        import time
        space_id = f"{base_id}-mixed-status-{int(time.time() * 1000)}"
        user_id = "mixed-user"

        # Create contexts with different statuses
        active = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Active context",
                status="active",
            )
        )

        completed = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Completed context",
                status="completed",
            )
        )

        blocked = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Blocked context",
                status="blocked",
            )
        )

        # Verify each in correct status list
        active_list_result = await cortex_client.contexts.list(
            memory_space_id=space_id, status="active"
        )
        active_list = active_list_result.get("contexts", [])
        completed_list_result = await cortex_client.contexts.list(
            memory_space_id=space_id, status="completed"
        )
        completed_list = completed_list_result.get("contexts", [])
        blocked_list_result = await cortex_client.contexts.list(memory_space_id=space_id, status="blocked")
        blocked_list = blocked_list_result.get("contexts", [])

        assert any(c.id == active.id for c in active_list)
        assert any(c.id == completed.id for c in completed_list)
        assert any(c.id == blocked.id for c in blocked_list)


class TestStateTransitionEdgeCases:
    """State transition edge cases."""

    async def test_repeated_transitions_idempotent(
        self, cortex_client, base_id, test_user_id
    ):
        """Test repeated transitions to same state are idempotent."""
        import time
        space_id = f"{base_id}-idempotent-{int(time.time() * 1000)}"
        user_id = "idempotent-user"

        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Idempotent test",
                status="active",
            )
        )

        # Transition to completed multiple times
        await cortex_client.contexts.update(ctx.id, updates={"status": "completed"})
        await cortex_client.contexts.update(ctx.id, updates={"status": "completed"})
        await cortex_client.contexts.update(ctx.id, updates={"status": "completed"})

        final = await cortex_client.contexts.get(ctx.id)
        assert final.status == "completed"

        # Should only appear once in completed list
        completed_list_result = await cortex_client.contexts.list(
            memory_space_id=space_id, status="completed"
        )
        completed_list = completed_list_result.get("contexts", [])
        matches = [c for c in completed_list if c.id == ctx.id]
        assert len(matches) == 1

    async def test_concurrent_transitions_handled(
        self, cortex_client, base_id, test_user_id
    ):
        """Test concurrent transitions handled correctly."""
        import asyncio
        import time
        space_id = f"{base_id}-concurrent-{int(time.time() * 1000)}"
        user_id = "concurrent-user"

        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Concurrent test",
                status="active",
            )
        )

        # Attempt concurrent transitions
        await asyncio.gather(
            cortex_client.contexts.update(ctx.id, updates={"status": "completed"}),
            cortex_client.contexts.update(ctx.id, updates={"status": "blocked"}),
            cortex_client.contexts.update(ctx.id, updates={"status": "cancelled"}),
            return_exceptions=True,
        )

        # Should have one of the three statuses
        final = await cortex_client.contexts.get(ctx.id)
        assert final.status in ["completed", "blocked", "cancelled"]

    async def test_transition_with_data_update(self, cortex_client, base_id, test_user_id):
        """Test transition with data update preserves both changes."""
        import time
        space_id = f"{base_id}-combined-{int(time.time() * 1000)}"
        user_id = "combined-user"

        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Combined update test",
                status="active",
                data={"progress": 0},
            )
        )

        # Update both status and data
        updated = await cortex_client.contexts.update(
            ctx.id,
            updates={
                "status": "completed",
                "data": {"progress": 100, "completedBy": "agent-1"},
            },
        )

        assert updated.status == "completed"
        assert updated.data.get("progress") == 100
        assert updated.data.get("completedBy") == "agent-1"

    async def test_all_status_values_exhaustive(
        self, cortex_client, base_id, test_user_id
    ):
        """Test all status values exhaustively."""
        import time
        space_id = f"{base_id}-exhaustive-{int(time.time() * 1000)}"
        user_id = "exhaustive-user"

        # Create one context for each possible status
        for status in CONTEXT_STATUSES:
            ctx = await cortex_client.contexts.create(
                ContextInput(
                    memory_space_id=space_id,
                    user_id=user_id,
                    purpose=f"Test {status}",
                    status=status,
                )
            )

            assert ctx.status == status

            # Verify retrievable
            retrieved = await cortex_client.contexts.get(ctx.id)
            assert retrieved.status == status

            # Verify in correct status list
            status_list_result = await cortex_client.contexts.list(memory_space_id=space_id, status=status)

            status_list = status_list_result.get("contexts", [])
            assert any(c.id == ctx.id for c in status_list)

    async def test_archived_space_with_data_reactivatable(
        self, cortex_client, base_id, test_user_id
    ):
        """Test archived space with data can be reactivated with data intact."""
        import time

        from cortex.types import CreateConversationInput, StoreMemoryInput
        space_id = f"{base_id}-data-cycle-{int(time.time() * 1000)}"

        # Create space with data
        await cortex_client.memory_spaces.register(
            RegisterMemorySpaceParams(
                memory_space_id=space_id, type="project", name="Data cycle test"
            )
        )

        conv = await cortex_client.conversations.create(
            CreateConversationInput(
                type="user-agent",
                memory_space_id=space_id,
                participants={"userId": test_user_id},
            )
        )

        mem = await cortex_client.vector.store(
            space_id,
            StoreMemoryInput(
                content="Test memory",
                content_type="raw",
                source={"type": "system", "userId": test_user_id},
                metadata={"importance": 50, "tags": []},
            ),
        )

        # Archive
        await cortex_client.memory_spaces.archive(space_id)

        # Verify data still accessible
        conv_archived = await cortex_client.conversations.get(conv.conversation_id)
        mem_archived = await cortex_client.vector.get(space_id, mem.memory_id)

        assert conv_archived is not None
        assert mem_archived is not None

        # Reactivate
        await cortex_client.memory_spaces.reactivate(space_id)

        # Verify data still intact
        conv_reactivated = await cortex_client.conversations.get(conv.conversation_id)
        mem_reactivated = await cortex_client.vector.get(space_id, mem.memory_id)

        assert conv_reactivated is not None
        assert mem_reactivated is not None
        assert mem_reactivated.content == "Test memory"


class TestInvalidTransitions:
    """Invalid transition rejection tests."""

    async def test_invalid_status_rejected(self, cortex_client, base_id, test_user_id):
        """Test invalid status value rejected."""
        import time
        space_id = f"{base_id}-invalid-{int(time.time() * 1000)}"
        user_id = "invalid-user"

        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=space_id,
                user_id=user_id,
                purpose="Invalid test",
                status="active",
            )
        )

        # Attempt invalid status
        with pytest.raises(Exception):
            await cortex_client.contexts.update(
                ctx.id, status="invalid-status"
            )


class TestBatchStateTransitions:
    """Batch state transition tests."""

    async def test_multiple_contexts_transition_simultaneously(
        self, cortex_client, base_id, test_user_id
    ):
        """Test multiple contexts can transition simultaneously."""
        import asyncio
        import time
        space_id = f"{base_id}-batch-{int(time.time() * 1000)}"
        user_id = "batch-user"

        # Create 5 active contexts
        contexts = []
        for i in range(5):
            ctx = await cortex_client.contexts.create(
                ContextInput(
                    memory_space_id=space_id,
                    user_id=user_id,
                    purpose=f"Batch context {i}",
                    status="active",
                )
            )
            contexts.append(ctx)

        # Transition all to completed
        await asyncio.gather(
            *[
                cortex_client.contexts.update(ctx.id, updates={"status": "completed"})
                for ctx in contexts
            ]
        )

        # Verify all completed
        for ctx in contexts:
            updated = await cortex_client.contexts.get(ctx.id)
            assert updated.status == "completed"

        # Verify count
        count = await cortex_client.contexts.count(
            memory_space_id=space_id, status="completed"
        )
        assert count == 5

    async def test_multiple_spaces_transition_independently(self, cortex_client, base_id):
        """Test transitioning multiple spaces independently."""
        import time

        spaces = []
        for i in range(3):
            space = await cortex_client.memory_spaces.register(
                RegisterMemorySpaceParams(
                    memory_space_id=f"{base_id}-multi-{i}-{int(time.time() * 1000)}",
                    type="project",
                    name=f"Multi space {i}",
                )
            )
            spaces.append(space)

        # Archive first two, keep third active
        await cortex_client.memory_spaces.archive(spaces[0].memory_space_id)
        await cortex_client.memory_spaces.archive(spaces[1].memory_space_id)

        # Verify states
        space0 = await cortex_client.memory_spaces.get(spaces[0].memory_space_id)
        space1 = await cortex_client.memory_spaces.get(spaces[1].memory_space_id)
        space2 = await cortex_client.memory_spaces.get(spaces[2].memory_space_id)

        assert space0.status == "archived"
        assert space1.status == "archived"
        assert space2.status == "active"

