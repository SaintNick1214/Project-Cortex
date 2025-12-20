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

from cortex import FactSourceRef, StoreFactParams

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


@pytest.mark.asyncio
async def test_store_fact_with_enrichment_fields(cortex_client, test_ids, cleanup_helper):
    """
    Test storing a fact with enrichment fields.

    Validates TypeScript SDK 0.21.0 parity for enrichment field support.
    """
    from cortex.types import EnrichedEntity, EnrichedRelation

    memory_space_id = test_ids["memory_space_id"]

    fact = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User prefers to be called Alex",
            fact_type="preference",
            subject="user-123",
            predicate="prefers_name",
            object="Alex",
            confidence=95,
            source_type="conversation",
            tags=["name", "addressing"],
            # Enrichment fields
            category="addressing_preference",
            search_aliases=["name", "nickname", "what to call"],
            semantic_context="Use when greeting or addressing the user",
            entities=[
                EnrichedEntity(name="Alex", type="name", full_value="Alex"),
            ],
            relations=[
                EnrichedRelation(subject="user-123", predicate="prefers_name", object="Alex"),
            ],
        )
    )

    # Validate result
    assert fact.fact_id.startswith("fact-")
    assert fact.memory_space_id == memory_space_id
    assert fact.fact == "User prefers to be called Alex"
    assert fact.confidence == 95

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
    from cortex.types import ListFactsFilter
    result = await cortex_client.facts.list(
        ListFactsFilter(memory_space_id=memory_space_id, limit=10)
    )

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
    from cortex.types import ListFactsFilter
    result = await cortex_client.facts.list(
        ListFactsFilter(
            memory_space_id=memory_space_id,
            fact_type="preference",
            limit=10,
        )
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


@pytest.mark.asyncio
async def test_update_fact_with_update_fact_input(cortex_client, test_ids, cleanup_helper):
    """
    Test updating fact using UpdateFactInput dataclass.

    Validates TypeScript SDK 0.21.0 parity for typed update input.
    """
    from cortex.types import UpdateFactInput

    memory_space_id = test_ids["memory_space_id"]

    # Create fact
    stored = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User prefers dark mode",
            fact_type="preference",
            confidence=70,
            source_type="system",
        )
    )

    fact_id = stored.fact_id

    # Update using UpdateFactInput dataclass with enrichment fields
    updated = await cortex_client.facts.update(
        memory_space_id,
        fact_id,
        UpdateFactInput(
            confidence=99,
            tags=["verified", "ui"],
            category="ui_preference",
            search_aliases=["theme", "display mode"],
            semantic_context="Use when setting UI appearance",
        ),
    )

    # Verify update was successful
    assert updated.confidence == 99
    assert "verified" in updated.tags
    assert "ui" in updated.tags

    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


@pytest.mark.asyncio
async def test_update_fact_with_enrichment_fields_dict(cortex_client, test_ids, cleanup_helper):
    """
    Test updating fact using dict with enrichment fields (backward compatible).

    Validates that dict-based updates with enrichment fields still work.
    """
    memory_space_id = test_ids["memory_space_id"]

    # Create fact
    stored = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="User's favorite color is blue",
            fact_type="preference",
            confidence=80,
            source_type="conversation",
        )
    )

    fact_id = stored.fact_id

    # Update using dict with enrichment fields
    updated = await cortex_client.facts.update(
        memory_space_id,
        fact_id,
        {
            "confidence": 95,
            "category": "color_preference",
            "searchAliases": ["favorite color", "colour"],
        },
    )

    # Verify update was successful
    assert updated.confidence == 95

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


@pytest.mark.asyncio
async def test_delete_fact_returns_typed_result(cortex_client, test_ids, cleanup_helper):
    """
    Test that delete() returns typed DeleteFactResult.

    Validates TypeScript SDK 0.21.0 parity for typed return types.
    """
    from cortex.types import DeleteFactResult

    memory_space_id = test_ids["memory_space_id"]

    # Create fact
    stored = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="Fact to delete for typed test",
            fact_type="observation",
            confidence=80,
            source_type="system",
        )
    )

    fact_id = stored.fact_id

    # Delete fact
    result = await cortex_client.facts.delete(memory_space_id, fact_id)

    # Verify result is DeleteFactResult dataclass
    assert isinstance(result, DeleteFactResult)
    assert hasattr(result, "deleted")
    assert hasattr(result, "fact_id")
    assert result.fact_id == fact_id

    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


@pytest.mark.asyncio
async def test_delete_many_returns_typed_result(cortex_client, test_ids, cleanup_helper):
    """
    Test that delete_many() returns typed DeleteManyFactsResult.

    Validates TypeScript SDK 0.21.0 parity for typed return types.
    """
    from cortex.types import DeleteManyFactsParams, DeleteManyFactsResult

    memory_space_id = test_ids["memory_space_id"]

    # Create multiple facts
    for i in range(3):
        await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=memory_space_id,
                fact=f"Fact to delete {i}",
                fact_type="observation",
                confidence=80,
                source_type="system",
            )
        )

    # Delete all facts in memory space
    result = await cortex_client.facts.delete_many(
        DeleteManyFactsParams(memory_space_id=memory_space_id)
    )

    # Verify result is DeleteManyFactsResult dataclass
    assert isinstance(result, DeleteManyFactsResult)
    assert hasattr(result, "deleted")
    assert hasattr(result, "memory_space_id")
    assert result.memory_space_id == memory_space_id
    assert result.deleted >= 3  # At least the 3 we created


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
    from cortex.types import CountFactsFilter
    count = await cortex_client.facts.count(
        CountFactsFilter(memory_space_id=memory_space_id)
    )

    assert count >= 4

    # Cleanup
    await cleanup_helper.purge_facts(memory_space_id)


# ============================================================================
# Client-Side Validation Tests
# ============================================================================


class TestStoreValidation:
    """Tests for store() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id="",
                    fact="test",
                    fact_type="knowledge",
                    confidence=90,
                    source_type="system",
                )
            )
        assert "memory_space_id is required" in str(exc_info.value)
        assert exc_info.value.code == "MISSING_REQUIRED_FIELD"

    @pytest.mark.asyncio
    async def test_empty_fact(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id="test-space",
                    fact="",
                    fact_type="knowledge",
                    confidence=90,
                    source_type="system",
                )
            )
        assert "fact is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_fact_type(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id="test-space",
                    fact="test",
                    fact_type="invalid",
                    confidence=90,
                    source_type="system",
                )
            )
        assert "Invalid fact_type" in str(exc_info.value)
        assert exc_info.value.code == "INVALID_FACT_TYPE"

    @pytest.mark.asyncio
    async def test_confidence_below_zero(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id="test-space",
                    fact="test",
                    fact_type="knowledge",
                    confidence=-1,
                    source_type="system",
                )
            )
        assert "confidence must be between 0 and 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_confidence_above_100(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id="test-space",
                    fact="test",
                    fact_type="knowledge",
                    confidence=150,
                    source_type="system",
                )
            )
        assert "confidence must be between 0 and 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_source_type(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id="test-space",
                    fact="test",
                    fact_type="knowledge",
                    confidence=90,
                    source_type="invalid",
                )
            )
        assert "Invalid source_type" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_tags_not_list(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id="test-space",
                    fact="test",
                    fact_type="knowledge",
                    confidence=90,
                    source_type="system",
                    tags="not-a-list",
                )
            )
        assert "tags must be a list" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_validity_period(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id="test-space",
                    fact="test",
                    fact_type="knowledge",
                    confidence=90,
                    source_type="system",
                    valid_from=2000,
                    valid_until=1000,
                )
            )
        assert "valid_from must be before valid_until" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_source_ref_structure(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id="test-space",
                    fact="test",
                    fact_type="knowledge",
                    confidence=90,
                    source_type="system",
                    source_ref="not-an-object",
                )
            )
        assert "source_ref must be" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_metadata_not_dict(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.store(
                StoreFactParams(
                    memory_space_id="test-space",
                    fact="test",
                    fact_type="knowledge",
                    confidence=90,
                    source_type="system",
                    metadata=["array"],
                )
            )
        assert "metadata must be a dict" in str(exc_info.value)


class TestGetValidation:
    """Tests for get() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.get("", "fact-123")
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_fact_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.get("test-space", "")
        assert "fact_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_fact_id_format(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.get("test-space", "invalid-id")
        assert 'fact_id must start with "fact-"' in str(exc_info.value)


class TestListValidation:
    """Tests for list() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(memory_space_id="")
            )
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_fact_type(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(
                    memory_space_id="test-space",
                    fact_type="invalid"
                )
            )
        assert "Invalid fact_type" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_confidence(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(
                    memory_space_id="test-space",
                    confidence=150
                )
            )
        assert "confidence must be between 0 and 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_min_confidence(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(
                    memory_space_id="test-space",
                    min_confidence=-10
                )
            )
        assert "min_confidence must be between 0 and 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_tag_match(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(
                    memory_space_id="test-space",
                    tag_match="invalid"
                )
            )
        assert "Invalid tag_match" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_negative_limit(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(
                    memory_space_id="test-space",
                    limit=-5
                )
            )
        assert "limit must be non-negative" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_negative_offset(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(
                    memory_space_id="test-space",
                    offset=-10
                )
            )
        assert "offset must be non-negative" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_sort_by(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(
                    memory_space_id="test-space",
                    sort_by="invalid"
                )
            )
        assert "Invalid sort_by" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_sort_order(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(
                    memory_space_id="test-space",
                    sort_order="invalid"
                )
            )
        assert "Invalid sort_order" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_date_range_created(self, cortex_client):
        from datetime import datetime, timedelta

        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        now = datetime.now()
        yesterday = now - timedelta(days=1)

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(
                    memory_space_id="test-space",
                    created_after=now,
                    created_before=yesterday
                )
            )
        assert "created_after must be before created_before" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_date_range_updated(self, cortex_client):
        from datetime import datetime, timedelta

        from cortex.facts import FactsValidationError
        from cortex.types import ListFactsFilter

        now = datetime.now()
        yesterday = now - timedelta(days=1)

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.list(
                ListFactsFilter(
                    memory_space_id="test-space",
                    updated_after=now,
                    updated_before=yesterday
                )
            )
        assert "updated_after must be before updated_before" in str(exc_info.value)


class TestCountValidation:
    """Tests for count() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import CountFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.count(
                CountFactsFilter(memory_space_id="")
            )
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_fact_type(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import CountFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.count(
                CountFactsFilter(
                    memory_space_id="test-space",
                    fact_type="invalid"
                )
            )
        assert "Invalid fact_type" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_confidence(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import CountFactsFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.count(
                CountFactsFilter(
                    memory_space_id="test-space",
                    confidence=200
                )
            )
        assert "confidence must be between 0 and 100" in str(exc_info.value)


class TestSearchValidation:
    """Tests for search() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.search("", "test query")
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_query(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.search("test-space", "")
        assert "query is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_options(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import SearchFactsOptions

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.search(
                "test-space",
                "test",
                SearchFactsOptions(fact_type="invalid")
            )
        assert "Invalid fact_type" in str(exc_info.value)


class TestUpdateValidation:
    """Tests for update() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.update("", "fact-123", {"confidence": 95})
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_fact_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.update("test-space", "", {"confidence": 95})
        assert "fact_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_fact_id_format(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.update(
                "test-space",
                "invalid-id",
                {"confidence": 95}
            )
        assert 'fact_id must start with "fact-"' in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_empty_updates_object(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.update("test-space", "fact-123", {})
        assert "Update must include at least one field" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_confidence_in_updates(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.update(
                "test-space",
                "fact-123",
                {"confidence": 150}
            )
        assert "confidence must be between 0 and 100" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_tags_in_updates(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.update(
                "test-space",
                "fact-123",
                {"tags": "not-array"}
            )
        assert "tags must be a list" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_metadata_in_updates(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.update(
                "test-space",
                "fact-123",
                {"metadata": ["array"]}
            )
        assert "metadata must be a dict" in str(exc_info.value)

    def test_enrichment_field_category_accepted(self):
        """
        Test that validate_update_has_fields accepts category enrichment field.

        Validates TypeScript SDK 0.21.0 parity for enrichment fields.
        """
        from cortex.facts.validators import validate_update_has_fields

        # Should NOT raise - category is a valid enrichment field
        validate_update_has_fields({"category": "test_category"})

    def test_enrichment_field_search_aliases_accepted(self):
        """
        Test that validate_update_has_fields accepts searchAliases enrichment field.

        Validates TypeScript SDK 0.21.0 parity for enrichment fields.
        """
        from cortex.facts.validators import validate_update_has_fields

        validate_update_has_fields({"searchAliases": ["alias1", "alias2"]})
        # Also test snake_case version
        validate_update_has_fields({"search_aliases": ["alias1", "alias2"]})

    def test_enrichment_field_semantic_context_accepted(self):
        """
        Test that validate_update_has_fields accepts semanticContext enrichment field.

        Validates TypeScript SDK 0.21.0 parity for enrichment fields.
        """
        from cortex.facts.validators import validate_update_has_fields

        validate_update_has_fields({"semanticContext": "use when greeting"})
        # Also test snake_case version
        validate_update_has_fields({"semantic_context": "use when greeting"})

    def test_enrichment_field_entities_accepted(self):
        """
        Test that validate_update_has_fields accepts entities enrichment field.

        Validates TypeScript SDK 0.21.0 parity for enrichment fields.
        """
        from cortex.facts.validators import validate_update_has_fields

        validate_update_has_fields({"entities": [{"name": "Alex", "type": "name", "fullValue": "Alex"}]})

    def test_enrichment_field_relations_accepted(self):
        """
        Test that validate_update_has_fields accepts relations enrichment field.

        Validates TypeScript SDK 0.21.0 parity for enrichment fields.
        """
        from cortex.facts.validators import validate_update_has_fields

        validate_update_has_fields({"relations": [{"subject": "user", "predicate": "likes", "object": "coffee"}]})

    def test_update_fact_input_dataclass_validation(self):
        """
        Test that UpdateFactInput dataclass passes validation.

        Validates TypeScript SDK 0.21.0 parity for typed input.
        """
        from cortex.facts.validators import validate_update_has_fields
        from cortex.types import UpdateFactInput

        # Convert UpdateFactInput to dict for validation (mimics what update() does)
        updates = UpdateFactInput(category="test_category")
        updates_dict = {
            "category": updates.category,
        }
        validate_update_has_fields(updates_dict)


class TestDeleteValidation:
    """Tests for delete() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.delete("", "fact-123")
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_fact_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.delete("test-space", "")
        assert "fact_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_fact_id_format(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.delete("test-space", "invalid-id")
        assert 'fact_id must start with "fact-"' in str(exc_info.value)


class TestGetHistoryValidation:
    """Tests for get_history() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.get_history("", "fact-123")
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_fact_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.get_history("test-space", "")
        assert "fact_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_fact_id_format(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.get_history("test-space", "invalid-id")
        assert 'fact_id must start with "fact-"' in str(exc_info.value)


class TestQueryBySubjectValidation:
    """Tests for query_by_subject() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import QueryBySubjectFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.query_by_subject(
                QueryBySubjectFilter(
                    memory_space_id="",
                    subject="user-123"
                )
            )
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_subject(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import QueryBySubjectFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.query_by_subject(
                QueryBySubjectFilter(
                    memory_space_id="test-space",
                    subject=""
                )
            )
        assert "subject is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_fact_type(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import QueryBySubjectFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.query_by_subject(
                QueryBySubjectFilter(
                    memory_space_id="test-space",
                    subject="user-123",
                    fact_type="invalid"
                )
            )
        assert "Invalid fact_type" in str(exc_info.value)


class TestQueryByRelationshipValidation:
    """Tests for query_by_relationship() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import QueryByRelationshipFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.query_by_relationship(
                QueryByRelationshipFilter(
                    memory_space_id="",
                    subject="user-123",
                    predicate="likes"
                )
            )
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_subject(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import QueryByRelationshipFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.query_by_relationship(
                QueryByRelationshipFilter(
                    memory_space_id="test-space",
                    subject="",
                    predicate="likes"
                )
            )
        assert "subject is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_predicate(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import QueryByRelationshipFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.query_by_relationship(
                QueryByRelationshipFilter(
                    memory_space_id="test-space",
                    subject="user-123",
                    predicate=""
                )
            )
        assert "predicate is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_fact_type(self, cortex_client):
        from cortex.facts import FactsValidationError
        from cortex.types import QueryByRelationshipFilter

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.query_by_relationship(
                QueryByRelationshipFilter(
                    memory_space_id="test-space",
                    subject="user-123",
                    predicate="likes",
                    fact_type="invalid"
                )
            )
        assert "Invalid fact_type" in str(exc_info.value)


class TestExportValidation:
    """Tests for export() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.export("", format="json")
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_format(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.export("test-space", format="xml")
        assert "Invalid format" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_invalid_fact_type(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.export(
                "test-space",
                format="json",
                fact_type="invalid"
            )
        assert "Invalid fact_type" in str(exc_info.value)


class TestConsolidateValidation:
    """Tests for consolidate() client-side validation"""

    @pytest.mark.asyncio
    async def test_missing_memory_space_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.consolidate(
                "",
                ["fact-1", "fact-2"],
                "fact-1"
            )
        assert "memory_space_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_empty_fact_ids_array(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.consolidate(
                "test-space",
                [],
                "fact-1"
            )
        assert "fact_ids must contain at least one element" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_fact_ids_with_single_element(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.consolidate(
                "test-space",
                ["fact-1"],
                "fact-1"
            )
        assert "consolidation requires at least 2 facts" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_missing_keep_fact_id(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.consolidate(
                "test-space",
                ["fact-1", "fact-2"],
                ""
            )
        assert "keep_fact_id is required" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_keep_fact_id_not_in_fact_ids(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.consolidate(
                "test-space",
                ["fact-1", "fact-2"],
                "fact-3"
            )
        assert "keep_fact_id" in str(exc_info.value)
        assert "must be in fact_ids" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_duplicate_fact_ids(self, cortex_client):
        from cortex.facts import FactsValidationError

        with pytest.raises(FactsValidationError) as exc_info:
            await cortex_client.facts.consolidate(
                "test-space",
                ["fact-1", "fact-2", "fact-1"],
                "fact-1"
            )
        assert "must not contain duplicates" in str(exc_info.value)


class TestSupersedeValidation:
    """Tests for supersede() client-side validation"""

    @pytest.mark.asyncio
    async def test_self_supersession_raises_error(self, cortex_client, test_ids, cleanup_helper):
        """
        Bug fix: supersede() should reject self-supersession.

        If old_fact_id == new_fact_id, the fact would be marked as superseded by itself,
        creating an inconsistent state where validUntil is set but no replacement exists.
        """
        memory_space_id = test_ids["memory_space_id"]

        # Create a fact
        stored = await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=memory_space_id,
                fact="Test fact for self-supersession test",
                fact_type="observation",
                confidence=80,
                source_type="system",
            )
        )
        fact_id = stored.fact_id

        # Attempt self-supersession should raise ValueError
        with pytest.raises(ValueError) as exc_info:
            await cortex_client.facts.supersede(
                memory_space_id=memory_space_id,
                old_fact_id=fact_id,
                new_fact_id=fact_id,  # Same as old_fact_id
                reason="This should fail",
            )

        assert "Cannot supersede a fact with itself" in str(exc_info.value)
        assert fact_id in str(exc_info.value)

        # Cleanup
        await cleanup_helper.purge_facts(memory_space_id)

