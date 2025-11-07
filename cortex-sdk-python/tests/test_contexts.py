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
from tests.helpers import TestCleanup


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
    assert result.context_id is not None
    assert result.purpose == "Main project context"
    assert result.status == "active"
    
    # Cleanup - delete context
    await cortex_client.contexts.delete(memory_space_id, result.context_id)


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
            parent_id=parent.context_id,
            data={"type": "project"},
        )
    )
    
    # Validate parent-child relationship
    assert child.parent_id == parent.context_id
    
    # Cleanup
    await cortex_client.contexts.delete(memory_space_id, child.context_id)
    await cortex_client.contexts.delete(memory_space_id, parent.context_id)


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
    retrieved = await cortex_client.contexts.get(memory_space_id, created.context_id)
    
    assert retrieved is not None
    assert retrieved.context_id == created.context_id
    assert retrieved.purpose == "Test Context"
    
    # Cleanup
    await cortex_client.contexts.delete(memory_space_id, created.context_id)


@pytest.mark.asyncio
async def test_get_nonexistent_returns_none(cortex_client, test_ids):
    """
    Test that getting non-existent context returns None.
    
    Port of: contexts.test.ts - get tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    result = await cortex_client.contexts.get(memory_space_id, "ctx-does-not-exist")
    
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
    
    # Update context
    updated = await cortex_client.contexts.update(
        memory_space_id,
        created.context_id,
        {"purpose": "Updated Purpose", "description": "New description"},
    )
    
    # Verify updated
    assert updated.purpose == "Updated Purpose"
    assert updated.description == "New description"
    
    # Cleanup
    await cortex_client.contexts.delete(memory_space_id, created.context_id)


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
        created_ids.append(ctx.context_id)
    
    # List contexts
    result = await cortex_client.contexts.list(memory_space_id, limit=10)
    
    # Should return at least 3 contexts
    contexts = result if isinstance(result, list) else result.get("contexts", [])
    assert len(contexts) >= 3
    
    # Cleanup
    for ctx_id in created_ids:
        await cortex_client.contexts.delete(memory_space_id, ctx_id)


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
            type="project",
        )
    )
    
    # Search for "Python"
    results = await cortex_client.contexts.search(memory_space_id, "Python")
    
    # Should find the Python context
    assert len(results) > 0
    found = any(
        "Python" in (r.get("purpose") if isinstance(r, dict) else r.purpose)
        or "Python" in (r.get("description") if isinstance(r, dict) else r.description or "")
        for r in results
    )
    assert found
    
    # Cleanup
    await cortex_client.contexts.delete(memory_space_id, ctx1.context_id)
    await cortex_client.contexts.delete(memory_space_id, ctx2.context_id)


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
    result = await cortex_client.contexts.delete(memory_space_id, created.context_id)
    
    # Verify deleted
    retrieved = await cortex_client.contexts.get(memory_space_id, created.context_id)
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
        created_ids.append(ctx.context_id)
    
    # Count contexts
    count = await cortex_client.contexts.count(memory_space_id)
    
    assert count >= 4
    
    # Cleanup
    for ctx_id in created_ids:
        await cortex_client.contexts.delete(memory_space_id, ctx_id)

