"""
Tests for Contexts API

Port of: tests/contexts.test.ts

Tests validate:
- Context creation and management
- Context chains
- Parent-child relationships
- Search and filtering
"""

import pytest

from cortex import ContextInput
from cortex.contexts import ContextsValidationError

# ============================================================================
# create() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_context(cortex_client, test_ids, cleanup_helper):
    """
    Test creating a context.
    
    Port of: contexts.test.ts - create tests
    """
    memory_space_id = test_ids["memory_space_id"]

    result = await cortex_client.contexts.create(
        ContextInput(
            memory_space_id=memory_space_id,
            purpose="Main project context",
            description="Project Alpha description",
            data={"type": "project", "priority": "high"},
        )
    )

    # Validate result
    assert result.id is not None
    assert result.purpose == "Main project context"
    assert result.status == "active"

    # Cleanup - delete context
    await cortex_client.contexts.delete(result.id)


@pytest.mark.asyncio
async def test_create_context_with_parent(cortex_client, test_ids, cleanup_helper):
    """
    Test creating context with parent (context chain).
    
    Port of: contexts.test.ts - chain tests
    """
    memory_space_id = test_ids["memory_space_id"]

    # Create parent context
    parent = await cortex_client.contexts.create(
        ContextInput(
            memory_space_id=memory_space_id,
            purpose="Parent context for workspace",
            data={"type": "workspace"},
        )
    )

    # Create child context
    child = await cortex_client.contexts.create(
        ContextInput(
            memory_space_id=memory_space_id,
            purpose="Child context for project",
            parent_id=parent.id,
            data={"type": "project"},
        )
    )

    # Validate parent-child relationship
    assert child.parent_id == parent.id

    # Cleanup - delete parent with cascade to delete child
    from cortex.types import DeleteContextOptions
    await cortex_client.contexts.delete(parent.id, DeleteContextOptions(cascade_children=True))


# ============================================================================
# get() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_context(cortex_client, test_ids, cleanup_helper):
    """
    Test retrieving a context by ID.
    
    Port of: contexts.test.ts - get tests
    """
    memory_space_id = test_ids["memory_space_id"]

    # Create context
    created = await cortex_client.contexts.create(
        ContextInput(
            memory_space_id=memory_space_id,
            purpose="Test Context",
        )
    )

    # Get context
    retrieved = await cortex_client.contexts.get(created.id)

    assert retrieved is not None
    assert retrieved.id == created.id
    assert retrieved.purpose == "Test Context"

    # Cleanup
    await cortex_client.contexts.delete(created.id)


@pytest.mark.asyncio
async def test_get_nonexistent_returns_none(cortex_client, test_ids):
    """
    Test that getting non-existent context returns None.
    
    Port of: contexts.test.ts - get tests
    Note: This tests BACKEND validation (DB lookup)
    """
    memory_space_id = test_ids["memory_space_id"]

    # Using properly formatted ID that doesn't exist in database
    result = await cortex_client.contexts.get("ctx-9999999999-nonexistent")

    assert result is None


# ============================================================================
# update() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_update_context(cortex_client, test_ids, cleanup_helper):
    """
    Test updating context properties.
    
    Port of: contexts.test.ts - update tests
    """
    memory_space_id = test_ids["memory_space_id"]

    # Create context
    created = await cortex_client.contexts.create(
        ContextInput(
            memory_space_id=memory_space_id,
            purpose="Original Name",
        )
    )

    # Update context (backend only supports status, data, completedAt)
    updated = await cortex_client.contexts.update(
        created.id,
        {"data": {"description": "New description", "updated": True}},
    )

    # Verify updated
    assert updated.purpose == "Original Name"  # Purpose can't be updated
    assert updated.data.get("description") == "New description"

    # Cleanup
    await cortex_client.contexts.delete(created.id)


# ============================================================================
# list() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_contexts(cortex_client, test_ids, cleanup_helper):
    """
    Test listing contexts in a memory space.
    
    Port of: contexts.test.ts - list tests
    """
    memory_space_id = test_ids["memory_space_id"]

    # Create multiple contexts
    created_ids = []
    for i in range(3):
        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=memory_space_id,
                purpose=f"Context {i+1}",
            )
        )
        created_ids.append(ctx.id)

    # List contexts
    result = await cortex_client.contexts.list(memory_space_id, limit=10)

    # Should return at least 3 contexts
    contexts = result if isinstance(result, list) else result.get("contexts", [])
    assert len(contexts) >= 3

    # Cleanup
    for ctx_id in created_ids:
        await cortex_client.contexts.delete(ctx_id)


# ============================================================================
# search() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_search_contexts(cortex_client, test_ids, cleanup_helper):
    """
    Test searching contexts by name or description.
    
    Port of: contexts.test.ts - search tests
    """
    memory_space_id = test_ids["memory_space_id"]

    # Create searchable contexts
    ctx1 = await cortex_client.contexts.create(
        ContextInput(
            memory_space_id=memory_space_id,
            purpose="Python Development",
            description="Context for Python projects",
        )
    )

    ctx2 = await cortex_client.contexts.create(
        ContextInput(
            memory_space_id=memory_space_id,
            purpose="JavaScript Development",
            description="Context for JS projects",
            data={"type": "project"},
        )
    )

    # Search contexts in memory space
    results = await cortex_client.contexts.search(memory_space_id=memory_space_id)

    # Should find both contexts
    assert len(results) >= 2
    purposes = [r.purpose if hasattr(r, 'purpose') else r.get("purpose") for r in results]
    assert "Python Development" in purposes or "JavaScript Development" in purposes

    # Cleanup
    await cortex_client.contexts.delete(ctx1.id)
    await cortex_client.contexts.delete(ctx2.id)


# ============================================================================
# delete() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_delete_context(cortex_client, test_ids, cleanup_helper):
    """
    Test deleting a context.
    
    Port of: contexts.test.ts - delete tests
    """
    memory_space_id = test_ids["memory_space_id"]

    # Create context
    created = await cortex_client.contexts.create(
        ContextInput(
            memory_space_id=memory_space_id,
            purpose="Context to Delete",
        )
    )

    # Delete context
    result = await cortex_client.contexts.delete(created.id)

    # Verify deleted
    retrieved = await cortex_client.contexts.get(created.id)
    assert retrieved is None


# ============================================================================
# count() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_count_contexts(cortex_client, test_ids, cleanup_helper):
    """
    Test counting contexts in a memory space.
    
    Port of: contexts.test.ts - count tests
    """
    memory_space_id = test_ids["memory_space_id"]

    # Create contexts
    created_ids = []
    for i in range(4):
        ctx = await cortex_client.contexts.create(
            ContextInput(
                memory_space_id=memory_space_id,
                purpose=f"Context {i+1}",
            )
        )
        created_ids.append(ctx.id)

    # Count contexts
    count = await cortex_client.contexts.count(memory_space_id)

    assert count >= 4

    # Cleanup
    for ctx_id in created_ids:
        await cortex_client.contexts.delete(ctx_id)


# ============================================================================
# Client-Side Validation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_missing_purpose(cortex_client):
    """Should throw on missing purpose."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.create(
            ContextInput(
                purpose="",
                memory_space_id="test-space",
            )
        )

    assert "purpose" in str(exc_info.value)
    assert exc_info.value.code == "MISSING_REQUIRED_FIELD"


@pytest.mark.asyncio
async def test_create_whitespace_only_purpose(cortex_client):
    """Should throw on whitespace-only purpose."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.create(
            ContextInput(
                purpose="   ",
                memory_space_id="test-space",
            )
        )

    assert "whitespace" in str(exc_info.value).lower()
    assert exc_info.value.code == "WHITESPACE_ONLY"


@pytest.mark.asyncio
async def test_create_missing_memory_space_id(cortex_client):
    """Should throw on missing memory_space_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.create(
            ContextInput(
                purpose="Test",
                memory_space_id="",
            )
        )

    assert "memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_create_invalid_parent_id_format(cortex_client):
    """Should throw on invalid parent_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.create(
            ContextInput(
                purpose="Test",
                memory_space_id="test-space",
                parent_id="invalid-format",
            )
        )

    assert "Invalid contextId format" in str(exc_info.value)
    assert exc_info.value.code == "INVALID_CONTEXT_ID_FORMAT"


@pytest.mark.asyncio
async def test_create_invalid_status(cortex_client):
    """Should throw on invalid status."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.create(
            ContextInput(
                purpose="Test",
                memory_space_id="test-space",
                status="pending",
            )
        )

    assert "Invalid status" in str(exc_info.value)
    assert exc_info.value.code == "INVALID_STATUS"


@pytest.mark.asyncio
async def test_create_invalid_data_type(cortex_client):
    """Should throw on invalid data type."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.create(
            ContextInput(
                purpose="Test",
                memory_space_id="test-space",
                data="not a dict",
            )
        )

    assert "data must be" in str(exc_info.value)
    assert exc_info.value.code == "INVALID_TYPE"


@pytest.mark.asyncio
async def test_get_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get("")

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_invalid_context_id_format(cortex_client):
    """Should throw on invalid context_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get("invalid-id")

    assert "Invalid contextId format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.update("", {"status": "completed"})

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_invalid_context_id_format(cortex_client):
    """Should throw on invalid context_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.update("invalid-id", {"status": "completed"})

    assert "Invalid contextId format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_invalid_status(cortex_client):
    """Should throw on invalid status."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.update("ctx-123-abc", {"status": "done"})

    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_invalid_timestamp(cortex_client):
    """Should throw on invalid completedAt timestamp."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.update("ctx-123-abc", {"completedAt": -1})

    assert "must be > 0" in str(exc_info.value)


@pytest.mark.asyncio
async def test_delete_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.delete("")

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_delete_invalid_context_id_format(cortex_client):
    """Should throw on invalid context_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.delete("invalid-id")

    assert "Invalid contextId format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_invalid_limit(cortex_client):
    """Should throw on invalid limit."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.list(limit=0)

    assert "limit must be > 0" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_limit_exceeding_max(cortex_client):
    """Should throw on limit exceeding max."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.list(limit=1001)

    assert "limit must be <= 1000" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_invalid_status(cortex_client):
    """Should throw on invalid status."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.list(status="pending")

    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_list_invalid_offset(cortex_client):
    """Should throw on invalid offset."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.list(offset=-1)

    assert "offset must be >= 0" in str(exc_info.value)


@pytest.mark.asyncio
async def test_count_invalid_status(cortex_client):
    """Should throw on invalid status."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.count(status="pending")

    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_search_invalid_limit(cortex_client):
    """Should throw on invalid limit."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.search(limit=0)

    assert "limit must be > 0" in str(exc_info.value)


@pytest.mark.asyncio
async def test_search_invalid_status(cortex_client):
    """Should throw on invalid status."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.search(status="pending")

    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_chain_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_chain("")

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_chain_invalid_context_id_format(cortex_client):
    """Should throw on invalid context_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_chain("invalid-id")

    assert "Invalid contextId format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_root_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_root("")

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_root_invalid_context_id_format(cortex_client):
    """Should throw on invalid context_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_root("invalid-id")

    assert "Invalid contextId format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_children_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_children("")

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_children_invalid_context_id_format(cortex_client):
    """Should throw on invalid context_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_children("invalid-id")

    assert "Invalid contextId format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_children_invalid_status(cortex_client):
    """Should throw on invalid status."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_children("ctx-123-abc", status="pending")

    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_add_participant_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.add_participant("", "participant-123")

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_add_participant_invalid_context_id_format(cortex_client):
    """Should throw on invalid context_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.add_participant("invalid-id", "participant-123")

    assert "Invalid contextId format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_add_participant_empty_participant_id(cortex_client):
    """Should throw on empty participant_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.add_participant("ctx-123-abc", "")

    assert "participant_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_remove_participant_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.remove_participant("", "participant-123")

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_remove_participant_empty_participant_id(cortex_client):
    """Should throw on empty participant_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.remove_participant("ctx-123-abc", "")

    assert "participant_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_grant_access_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.grant_access("", "space-123", "read-only")

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_grant_access_empty_target_memory_space_id(cortex_client):
    """Should throw on empty target_memory_space_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.grant_access("ctx-123-abc", "", "read-only")

    assert "target_memory_space_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_grant_access_empty_scope(cortex_client):
    """Should throw on empty scope."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.grant_access("ctx-123-abc", "space-123", "")

    assert "scope" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_many_empty_filters(cortex_client):
    """Should throw on empty filters."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.update_many({}, {"status": "completed"})

    assert "filters must include at least one" in str(exc_info.value)
    assert exc_info.value.code == "EMPTY_FILTERS"


@pytest.mark.asyncio
async def test_update_many_empty_updates(cortex_client):
    """Should throw on empty updates."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.update_many({"memorySpaceId": "test"}, {})

    assert "updates must include at least one" in str(exc_info.value)
    assert exc_info.value.code == "EMPTY_UPDATES"


@pytest.mark.asyncio
async def test_update_many_invalid_filter_status(cortex_client):
    """Should throw on invalid filter status."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.update_many(
            {"status": "pending"}, {"data": {}}
        )

    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_update_many_invalid_update_status(cortex_client):
    """Should throw on invalid update status."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.update_many(
            {"memorySpaceId": "test"}, {"status": "done"}
        )

    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_delete_many_empty_filters(cortex_client):
    """Should throw on empty filters."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.delete_many({})

    assert "filters must include at least one" in str(exc_info.value)
    assert exc_info.value.code == "EMPTY_FILTERS"


@pytest.mark.asyncio
async def test_delete_many_invalid_completed_before(cortex_client):
    """Should throw on invalid completedBefore."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.delete_many({"completedBefore": -1})

    assert "must be > 0" in str(exc_info.value)


@pytest.mark.asyncio
async def test_delete_many_invalid_status(cortex_client):
    """Should throw on invalid status."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.delete_many({"status": "pending"})

    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_export_invalid_format(cortex_client):
    """Should throw on invalid format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.export(filters={}, format="xml")

    assert "Invalid format" in str(exc_info.value)
    assert exc_info.value.code == "INVALID_FORMAT"


@pytest.mark.asyncio
async def test_export_invalid_filter_status(cortex_client):
    """Should throw on invalid filter status."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.export(
            filters={"status": "pending"}, format="json"
        )

    assert "Invalid status" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_by_conversation_missing_conversation_id(cortex_client):
    """Should throw on missing conversation_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_by_conversation("")

    assert "conversation_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_by_conversation_invalid_conversation_id_format(cortex_client):
    """Should throw on invalid conversation_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_by_conversation("invalid-id")

    assert "Invalid conversationId format" in str(exc_info.value)
    assert exc_info.value.code == "INVALID_CONVERSATION_ID_FORMAT"


@pytest.mark.asyncio
async def test_get_version_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_version("", 1)

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_version_invalid_context_id_format(cortex_client):
    """Should throw on invalid context_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_version("invalid-id", 1)

    assert "Invalid contextId format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_version_invalid_version_number(cortex_client):
    """Should throw on invalid version number."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_version("ctx-123-abc", 0)

    assert "version must be >= 1" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_version_negative_version(cortex_client):
    """Should throw on negative version."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_version("ctx-123-abc", -1)

    assert "version must be >= 1" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_version_non_integer_version(cortex_client):
    """Should throw on non-integer version."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_version("ctx-123-abc", 1.5)

    assert "version must be an integer" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_history_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_history("")

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_history_invalid_context_id_format(cortex_client):
    """Should throw on invalid context_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_history("invalid-id")

    assert "Invalid contextId format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_at_timestamp_missing_context_id(cortex_client):
    """Should throw on missing context_id."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_at_timestamp("", 1609459200000)

    assert "context_id" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_at_timestamp_invalid_context_id_format(cortex_client):
    """Should throw on invalid context_id format."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_at_timestamp("invalid-id", 1609459200000)

    assert "Invalid contextId format" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_at_timestamp_invalid_timestamp(cortex_client):
    """Should throw on invalid timestamp."""
    with pytest.raises(ContextsValidationError) as exc_info:
        await cortex_client.contexts.get_at_timestamp("ctx-123-abc", -1)

    assert "must be > 0" in str(exc_info.value)
