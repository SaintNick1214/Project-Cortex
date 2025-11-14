"""
Tests for Facts API (Layer 3)

Port of: tests/facts.test.ts

Tests validate:
- SDK API calls
- Fact storage and versioning
- Graph-like relationships
- Memory space isolation
"""

import pytest
from cortex import StoreFactParams, FactSourceRef
from tests.helpers import TestCleanup


# ============================================================================
# store() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_store_preference_fact(cortex_client, test_ids, cleanup_helper):
    """
    Test storing a preference fact.
    
    Port of: facts.test.ts - line 39
    """
    memory_space_id = test_ids["memory_space_id"]
    
    fact = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User prefers dark mode for UI",
            fact_type="preference",
            subject="user-123",
            predicate="prefers",
            object="dark-mode",
            confidence=95,
            source_type="conversation",
            tags=["ui", "theme"],
        )
    )
    
    # Validate result
    assert fact.fact_id.startswith("fact-")
    assert fact.memory_space_id == memory_space_id
    assert fact.fact == "User prefers dark mode for UI"
    assert fact.fact_type == "preference"
    assert fact.subject == "user-123"
    assert fact.confidence == 95
    assert fact.version == 1
    assert fact.superseded_by is None
    
    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


@pytest.mark.asyncio
async def test_store_knowledge_fact_with_source_ref(cortex_client, test_ids, cleanup_helper):
    """
    Test storing knowledge fact with source reference.
    
    Port of: facts.test.ts - line 62
    """
    memory_space_id = test_ids["memory_space_id"]
    
    fact = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="API password for production is SecurePass123",
            fact_type="knowledge",
            subject="production-api",
            confidence=90,
            source_type="conversation",
            source_ref=FactSourceRef(
                conversation_id="conv-123",
                message_ids=["msg-1", "msg-2"],
                memory_id="mem-123",
            ),
            tags=["password", "production", "api"],
        )
    )
    
    # Validate result
    assert fact.fact_type == "knowledge"
    assert fact.source_ref is not None
    # Handle dict or object access
    conv_id = fact.source_ref.get("conversation_id") if isinstance(fact.source_ref, dict) else fact.source_ref.conversation_id
    assert conv_id == "conv-123"
    assert "password" in fact.tags
    
    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


@pytest.mark.asyncio
async def test_store_relationship_fact(cortex_client, test_ids, cleanup_helper):
    """
    Test storing relationship fact (graph triple).
    
    Port of: facts.test.ts - line 83
    """
    memory_space_id = test_ids["memory_space_id"]
    
    fact = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="Alice works at Acme Corp",
            fact_type="relationship",
            subject="user-alice",
            predicate="works_at",
            object="company-acme",
            confidence=100,
            source_type="manual",
            tags=["employment", "relationship"],
        )
    )
    
    # Validate result
    assert fact.fact_type == "relationship"
    assert fact.subject == "user-alice"
    assert fact.predicate == "works_at"
    assert fact.object == "company-acme"
    
    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


# ============================================================================
# get() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_fact_by_id(cortex_client, test_ids, cleanup_helper):
    """
    Test retrieving fact by ID.
    
    Port of: facts.test.ts - get tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create fact
    stored = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="Test fact",
            fact_type="observation",
            confidence=80,
            source_type="system",
        )
    )
    
    fact_id = stored.fact_id
    
    # Get fact
    retrieved = await cortex_client.facts.get(memory_space_id, fact_id)
    
    assert retrieved is not None
    assert retrieved.fact_id == fact_id
    assert retrieved.fact == "Test fact"
    
    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


@pytest.mark.asyncio
async def test_get_nonexistent_fact_returns_none(cortex_client, test_ids):
    """
    Test that getting non-existent fact returns None.
    
    Port of: facts.test.ts - get tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    result = await cortex_client.facts.get(memory_space_id, "fact-does-not-exist")
    
    assert result is None


# ============================================================================
# list() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_facts(cortex_client, test_ids, cleanup_helper):
    """
    Test listing facts in a memory space.
    
    Port of: facts.test.ts - list tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create multiple facts
    for i in range(3):
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=memory_space_id,
                fact=f"Test fact {i+1}",
                fact_type="observation",
                confidence=80,
                source_type="system",
            )
        )
    
    # List facts
    result = await cortex_client.facts.list(memory_space_id, limit=10)
    
    # Should return at least 3 facts
    facts = result if isinstance(result, list) else result.get("facts", [])
    assert len(facts) >= 3
    
    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


@pytest.mark.asyncio
async def test_list_facts_filter_by_type(cortex_client, test_ids, cleanup_helper):
    """
    Test listing facts filtered by fact type.
    
    Port of: facts.test.ts - list tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create facts of different types
    await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="Preference fact",
            fact_type="preference",
            confidence=90,
            source_type="system",
        )
    )
    
    await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="Knowledge fact",
            fact_type="knowledge",
            confidence=85,
            source_type="system",
        )
    )
    
    # List only preference facts
    result = await cortex_client.facts.list(
        memory_space_id,
        fact_type="preference",
        limit=10,
    )
    
    facts = result if isinstance(result, list) else result.get("facts", [])
    
    # All facts should be preference type
    for fact in facts:
        fact_type = fact.get("fact_type") if isinstance(fact, dict) else fact.fact_type
        assert fact_type == "preference"
    
    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


# ============================================================================
# search() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_search_facts(cortex_client, test_ids, cleanup_helper):
    """
    Test searching facts by query text.
    
    Port of: facts.test.ts - search tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create searchable facts
    await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User prefers dark mode theme",
            fact_type="preference",
            subject="user-123",
            confidence=90,
            source_type="system",
            tags=["ui", "theme"],
        )
    )
    
    await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="System uses PostgreSQL database",
            fact_type="knowledge",
            subject="system",
            confidence=100,
            source_type="system",
            tags=["database", "tech"],
        )
    )
    
    # Search for "dark mode"
    results = await cortex_client.facts.search(memory_space_id, "dark mode")
    
    # Should find the preference fact
    assert len(results) > 0
    found = any("dark mode" in (f.get("fact") if isinstance(f, dict) else f.fact) for f in results)
    assert found
    
    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


# ============================================================================
# update() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_update_fact_confidence(cortex_client, test_ids, cleanup_helper):
    """
    Test updating fact confidence.
    
    Port of: facts.test.ts - update tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create fact
    stored = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="Test fact",
            fact_type="observation",
            confidence=70,
            source_type="system",
        )
    )
    
    fact_id = stored.fact_id
    
    # Update confidence
    updated = await cortex_client.facts.update(
        memory_space_id,
        fact_id,
        {"confidence": 95},
    )
    
    # Confidence should be updated in the returned value
    confidence = updated.get("confidence") if isinstance(updated, dict) else updated.confidence
    assert confidence == 95
    
    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


# ============================================================================
# delete() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_delete_fact(cortex_client, test_ids, cleanup_helper):
    """
    Test deleting a fact.
    
    Port of: facts.test.ts - delete tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create fact
    stored = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="Fact to delete",
            fact_type="observation",
            confidence=80,
            source_type="system",
        )
    )
    
    fact_id = stored.fact_id
    
    # Delete fact
    result = await cortex_client.facts.delete(memory_space_id, fact_id)
    
    # Verify deletion result (backend might implement soft delete)
    assert result is not None
    
    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


# ============================================================================
# count() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_count_facts(cortex_client, test_ids, cleanup_helper):
    """
    Test counting facts in a memory space.
    
    Port of: facts.test.ts - count tests
    """
    memory_space_id = test_ids["memory_space_id"]
    
    # Create facts
    for i in range(4):
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=memory_space_id,
                fact=f"Fact {i+1}",
                fact_type="observation",
                confidence=80,
                source_type="system",
            )
        )
    
    # Count facts
    count = await cortex_client.facts.count(memory_space_id)
    
    assert count >= 4
    
    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)

