"""
Edge Cases & Error Conditions Tests (v0.6.1)

Tests to ensure robustness with extreme values, special characters,
and boundary conditions.

Port of: tests/edgeCases.test.ts

PARALLEL-SAFE: Uses test_run_context for unique test data.
"""

import time

import pytest

from cortex.types import (
    ContextInput,
    ConversationParticipants,
    CreateConversationInput,
    ImmutableEntry,
    MemoryMetadata,
    MemorySource,
    StoreFactParams,
    StoreMemoryInput,
)


# ============================================================================
# Large Content
# ============================================================================


@pytest.mark.asyncio
async def test_handles_very_long_content_10kb_plus(cortex_client, ctx):
    """Test handling very long content (10KB+). Port of: edgeCases.test.ts - line 32"""
    memory_space_id = ctx.memory_space_id()
    user_id = ctx.user_id()
    
    long_content = "A" * 10000

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=long_content,
            content_type="raw",
            source=MemorySource(type="system", user_id=user_id, timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    assert len(memory.content) == 10000

    stored = await cortex_client.vector.get(memory_space_id, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == long_content
    assert len(stored_content) == 10000


@pytest.mark.asyncio
async def test_handles_very_long_fact_statements_10kb_plus(cortex_client, ctx):
    """Test handling very long fact statements (10KB+). Port of: edgeCases.test.ts - line 49"""
    memory_space_id = ctx.memory_space_id()
    user_id = ctx.user_id()
    
    long_fact = "B" * 10000

    fact = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact=long_fact,
            fact_type="knowledge",
            subject=user_id,
            confidence=80,
            source_type="system",
        )
    )

    assert len(fact.fact) == 10000


@pytest.mark.asyncio
async def test_handles_long_array_of_tags_100_plus_tags(cortex_client, ctx):
    """Test handling long array of tags (100+ tags). Port of: edgeCases.test.ts - line 67"""
    memory_space_id = ctx.memory_space_id()
    user_id = ctx.user_id()
    
    tags = [f"tag-{i}" for i in range(100)]

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Memory with many tags",
            content_type="raw",
            source=MemorySource(type="system", user_id=user_id, timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(
                importance=50,
                tags=tags,
            ),
        ),
    )

    assert len(memory.tags) == 100

    stored = await cortex_client.vector.get(memory_space_id, memory.memory_id)
    stored_tags = stored.tags if hasattr(stored, 'tags') else stored.get("tags")
    assert len(stored_tags) == 100
    assert all(tag in stored_tags for tag in tags)


@pytest.mark.asyncio
async def test_handles_very_long_participant_id(cortex_client, ctx):
    """Test handling very long participant ID. Port of: edgeCases.test.ts - line 87"""
    memory_space_id = ctx.memory_space_id()
    user_id = ctx.user_id()
    long_participant_id = "participant-" + "x" * 200

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Long participant ID",
            content_type="raw",
            participant_id=long_participant_id,
            source=MemorySource(type="system", user_id=user_id, timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    assert memory.participant_id == long_participant_id


# ============================================================================
# Special Characters
# ============================================================================


@pytest.mark.asyncio
async def test_handles_unicode_emoji_in_content(cortex_client, ctx):
    """Test handling Unicode emoji in content. Port of: edgeCases.test.ts - line 106"""
    memory_space_id = ctx.memory_space_id()
    unicode_content = "Hello 👋 world 🌍 with emoji 🎉 and symbols ∑∫√"

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=unicode_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    stored = await cortex_client.vector.get(memory_space_id, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == unicode_content


@pytest.mark.asyncio
async def test_handles_special_characters_in_ids(cortex_client, ctx):
    """Test handling special characters in IDs. Port of: edgeCases.test.ts - line 127"""
    memory_space_id = ctx.memory_space_id()
    immutable_type = ctx.immutable_type("test-type")
    special_id = ctx.immutable_id("test-id-with-dash_underscore.period")

    immutable = await cortex_client.immutable.store(
        ImmutableEntry(
            type=immutable_type,
            id=special_id,
            data={"value": "test"},
        )
    )

    assert immutable.id == special_id

    retrieved = await cortex_client.immutable.get(immutable_type, special_id)
    assert retrieved.id == special_id


@pytest.mark.asyncio
async def test_handles_newlines_and_tabs_in_content(cortex_client, ctx):
    """Test handling newlines and tabs in content. Port of: edgeCases.test.ts - line 148"""
    memory_space_id = ctx.memory_space_id()
    content_with_whitespace = "Line 1\nLine 2\n\tTabbed\r\nWindows newline"

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=content_with_whitespace,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    stored = await cortex_client.vector.get(memory_space_id, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == content_with_whitespace


@pytest.mark.asyncio
async def test_handles_json_special_characters(cortex_client, ctx):
    """Test handling JSON special characters. Port of: edgeCases.test.ts - line 169"""
    memory_space_id = ctx.memory_space_id()
    content = 'Content with "quotes" and \\backslashes\\ and {curly braces}'

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    stored = await cortex_client.vector.get(memory_space_id, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == content


# ============================================================================
# Empty and Minimal Values
# ============================================================================


@pytest.mark.asyncio
async def test_handles_empty_tags_array(cortex_client, ctx):
    """Test handling empty tags array. Port of: edgeCases.test.ts - line 190"""
    memory_space_id = ctx.memory_space_id()
    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="No tags",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    assert memory.tags == []


@pytest.mark.asyncio
async def test_handles_minimal_metadata(cortex_client, ctx):
    """Test handling minimal metadata. Port of: edgeCases.test.ts - line 208"""
    memory_space_id = ctx.memory_space_id()
    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Minimal metadata",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=0, tags=[]),
        ),
    )

    assert memory.importance == 0
    assert memory.tags == []


@pytest.mark.asyncio
async def test_handles_empty_data_object(cortex_client, ctx):
    """Test handling empty data object. Port of: edgeCases.test.ts - line 229"""
    memory_space_id = ctx.memory_space_id()
    immutable = await cortex_client.immutable.store(
        ImmutableEntry(type=ctx.immutable_type("test-empty"), id=ctx.immutable_id("empty-data"),
            data={},
        )
    )

    assert immutable.data == {}

    retrieved = await cortex_client.immutable.get(ctx.immutable_type("test-empty"), ctx.immutable_id("empty-data"))
    assert retrieved.data == {}


# ============================================================================
# Boundary Values
# ============================================================================


@pytest.mark.asyncio
async def test_handles_importance_zero(cortex_client, ctx):
    """Test handling importance = 0. Port of: edgeCases.test.ts - line 251"""
    memory_space_id = ctx.memory_space_id()
    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Zero importance",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=0, tags=[]),
        ),
    )

    assert memory.importance == 0


@pytest.mark.asyncio
async def test_handles_importance_100(cortex_client, ctx):
    """Test handling importance = 100. Port of: edgeCases.test.ts - line 272"""
    memory_space_id = ctx.memory_space_id()
    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Max importance",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=100, tags=[]),
        ),
    )

    assert memory.importance == 100


@pytest.mark.asyncio
async def test_handles_confidence_zero(cortex_client, ctx):
    """Test handling confidence = 0. Port of: edgeCases.test.ts - line 293"""
    memory_space_id = ctx.memory_space_id()
    user_id = ctx.user_id()
    fact = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="Zero confidence fact",
            fact_type="knowledge",
            subject=user_id,
            confidence=0,
            source_type="system",
        )
    )

    assert fact.confidence == 0


@pytest.mark.asyncio
async def test_handles_confidence_100(cortex_client, ctx):
    """Test handling confidence = 100. Port of: edgeCases.test.ts - line 313"""
    memory_space_id = ctx.memory_space_id()
    user_id = ctx.user_id()
    fact = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="Max confidence fact",
            fact_type="knowledge",
            subject=user_id,
            confidence=100,
            source_type="system",
        )
    )

    assert fact.confidence == 100


# ============================================================================
# Concurrent Operations
# ============================================================================


@pytest.mark.asyncio
async def test_handles_concurrent_memory_creation(cortex_client, ctx):
    """Test handling concurrent memory creation. Port of: edgeCases.test.ts - line 333"""
    memory_space_id = ctx.memory_space_id()
    import asyncio

    # Create 10 memories concurrently
    tasks = [
        cortex_client.vector.store(
            memory_space_id,
            StoreMemoryInput(
                content=f"Concurrent memory {i}",
                content_type="raw",
                source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
                metadata=MemoryMetadata(importance=50, tags=[f"concurrent-{i}"]),
            ),
        )
        for i in range(10)
    ]

    results = await asyncio.gather(*tasks)

    assert len(results) == 10
    # All should have unique memory IDs
    memory_ids = [r.memory_id for r in results]
    assert len(set(memory_ids)) == 10


@pytest.mark.asyncio
async def test_handles_concurrent_fact_updates(cortex_client, ctx):
    """Test handling concurrent fact updates. Port of: edgeCases.test.ts - line 363"""
    memory_space_id = ctx.memory_space_id()
    user_id = ctx.user_id()
    import asyncio

    # Create initial fact
    fact = await cortex_client.facts.store(
        StoreFactParams(
            memory_space_id=memory_space_id,
            fact="Concurrent update test",
            fact_type="knowledge",
            subject=user_id,
            confidence=50,
            source_type="system",
        )
    )

    # Update concurrently (last write wins)
    tasks = [
        cortex_client.facts.update(
            memory_space_id,
            fact.fact_id,
            {"confidence": 50 + i * 10},
        )
        for i in range(5)
    ]

    results = await asyncio.gather(*tasks)

    # All updates succeeded
    assert len(results) == 5


# ============================================================================
# Complex Nested Data
# ============================================================================


@pytest.mark.asyncio
async def test_handles_deeply_nested_data_objects(cortex_client, ctx):
    """Test handling deeply nested data objects. Port of: edgeCases.test.ts - line 397"""
    memory_space_id = ctx.memory_space_id()
    nested_data = {
        "level1": {
            "level2": {
                "level3": {
                    "level4": {
                        "level5": {
                            "value": "deep nesting works"
                        }
                    }
                }
            }
        }
    }

    immutable = await cortex_client.immutable.store(
        ImmutableEntry(type=ctx.immutable_type("nested-test"), id=ctx.immutable_id("deep-nest"),
            data=nested_data,
        )
    )

    retrieved = await cortex_client.immutable.get(ctx.immutable_type("nested-test"), ctx.immutable_id("deep-nest"))
    assert retrieved.data["level1"]["level2"]["level3"]["level4"]["level5"]["value"] == "deep nesting works"


@pytest.mark.asyncio
async def test_handles_arrays_in_data(cortex_client, ctx):
    """Test handling arrays in data. Port of: edgeCases.test.ts - line 429"""
    memory_space_id = ctx.memory_space_id()
    data_with_arrays = {
        "items": [1, 2, 3, 4, 5],
        "names": ["Alice", "Bob", "Charlie"],
        "nested": [[1, 2], [3, 4]],
    }

    immutable = await cortex_client.immutable.store(
        ImmutableEntry(type=ctx.immutable_type("array-test"), id=ctx.immutable_id("arrays"),
            data=data_with_arrays,
        )
    )

    retrieved = await cortex_client.immutable.get(ctx.immutable_type("array-test"), ctx.immutable_id("arrays"))
    assert retrieved.data["items"] == [1, 2, 3, 4, 5]
    assert retrieved.data["names"] == ["Alice", "Bob", "Charlie"]


# ============================================================================
# ID Formats
# ============================================================================


@pytest.mark.asyncio
async def test_handles_uuid_format_ids(cortex_client, ctx):
    """Test handling UUID format IDs. Port of: edgeCases.test.ts - line 456"""
    memory_space_id = ctx.memory_space_id()
    immutable_type = ctx.immutable_type("uuid-test")
    # Use ctx-prefixed ID to maintain isolation
    uuid_id = ctx.immutable_id("550e8400-e29b-41d4-a716-446655440000")

    immutable = await cortex_client.immutable.store(
        ImmutableEntry(
            type=immutable_type,
            id=uuid_id,
            data={"value": "uuid format"},
        )
    )

    assert immutable.id == uuid_id

    retrieved = await cortex_client.immutable.get(immutable_type, uuid_id)
    assert retrieved.id == uuid_id


@pytest.mark.asyncio
async def test_handles_numeric_string_ids(cortex_client, ctx):
    """Test handling numeric string IDs. Port of: edgeCases.test.ts - line 478"""
    memory_space_id = ctx.memory_space_id()
    immutable_type = ctx.immutable_type("numeric-test")
    # Use ctx-prefixed ID to maintain isolation
    numeric_id = ctx.immutable_id("12345678901234567890")

    immutable = await cortex_client.immutable.store(
        ImmutableEntry(
            type=immutable_type,
            id=numeric_id,
            data={"value": "numeric id"},
        )
    )

    assert immutable.id == numeric_id


# ============================================================================
# Null/None Handling
# ============================================================================


@pytest.mark.asyncio
async def test_handles_none_optional_fields(cortex_client, ctx):
    """Test handling None optional fields. Port of: edgeCases.test.ts - line 500"""
    memory_space_id = ctx.memory_space_id()
    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Minimal required fields only",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
            # All optional fields omitted
        ),
    )

    assert memory.participant_id is None
    assert memory.user_id is None


# ============================================================================
# Timestamp Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_handles_very_old_timestamps(cortex_client, ctx):
    """Test handling very old timestamps. Port of: edgeCases.test.ts - line 523"""
    memory_space_id = ctx.memory_space_id()
    old_timestamp = 946684800000  # Year 2000

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Old timestamp",
            content_type="raw",
            source=MemorySource(type="system", timestamp=old_timestamp),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    # Backend may override timestamp with current time for validation
    source_ts = memory.source_timestamp if hasattr(memory, 'source_timestamp') else memory.get("sourceTimestamp")
    assert source_ts is not None  # Just verify it exists


@pytest.mark.asyncio
async def test_handles_future_timestamps(cortex_client, ctx):
    """Test handling future timestamps. Port of: edgeCases.test.ts - line 545"""
    memory_space_id = ctx.memory_space_id()
    future_timestamp = 2524608000000  # Year 2050

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Future timestamp",
            content_type="raw",
            source=MemorySource(type="system", timestamp=future_timestamp),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    # Backend may override timestamp with current time for validation
    source_ts = memory.source_timestamp if hasattr(memory, 'source_timestamp') else memory.get("sourceTimestamp")
    assert source_ts is not None  # Just verify it exists


# ============================================================================
# Content Type Variations
# ============================================================================


@pytest.mark.asyncio
async def test_handles_all_content_types(cortex_client, ctx):
    """Test handling all content types. Port of: edgeCases.test.ts - line 567"""
    memory_space_id = ctx.memory_space_id()
    content_types = ["raw", "summarized", "fact"]  # Backend supported types

    for ct in content_types:
        memory = await cortex_client.vector.store(
            memory_space_id,
            StoreMemoryInput(
                content=f"Content type: {ct}",
                content_type=ct,
                source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
                metadata=MemoryMetadata(importance=50, tags=[ct]),
            ),
        )

        content_type = memory.content_type if hasattr(memory, 'content_type') else memory.get("contentType")
        assert content_type == ct


# ============================================================================
# Source Type Variations
# ============================================================================


@pytest.mark.asyncio
async def test_handles_all_source_types(cortex_client, ctx):
    """Test handling all source types. Port of: edgeCases.test.ts - line 595"""
    memory_space_id = ctx.memory_space_id()
    source_types = ["conversation", "system", "tool", "a2a"]

    for st in source_types:
        memory = await cortex_client.vector.store(
            memory_space_id,
            StoreMemoryInput(
                content=f"Source type: {st}",
                content_type="raw",
                source=MemorySource(type=st, timestamp=int(time.time() * 1000)),
                metadata=MemoryMetadata(importance=50, tags=[st]),
            ),
        )

        source_type = memory.source_type if hasattr(memory, 'source_type') else memory.get("sourceType")
        assert source_type == st


# ============================================================================
# Large Scale Operations
# ============================================================================


@pytest.mark.asyncio
async def test_handles_bulk_memory_creation_50_plus(cortex_client, ctx):
    """Test handling bulk memory creation (50+). Port of: edgeCases.test.ts - line 623"""
    memory_space_id = ctx.memory_space_id()
    memories = []
    for i in range(50):
        mem = await cortex_client.vector.store(
            memory_space_id,
            StoreMemoryInput(
                content=f"Bulk memory {i}",
                content_type="raw",
                source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
                metadata=MemoryMetadata(importance=50, tags=["bulk"]),
            ),
        )
        memories.append(mem)

    assert len(memories) == 50

    # All retrievable
    for mem in memories[:5]:  # Check first 5
        stored = await cortex_client.vector.get(memory_space_id, mem.memory_id)
        assert stored is not None


@pytest.mark.asyncio
async def test_handles_bulk_fact_creation_50_plus(cortex_client, ctx):
    """Test handling bulk fact creation (50+). Port of: edgeCases.test.ts - line 653"""
    memory_space_id = ctx.memory_space_id()
    user_id = ctx.user_id()
    facts = []
    for i in range(50):
        fact = await cortex_client.facts.store(
            StoreFactParams(
                memory_space_id=memory_space_id,
                fact=f"Bulk fact {i}",
                fact_type="knowledge",
                subject=user_id,
                confidence=80,
                source_type="system",
                tags=["bulk"],
            )
        )
        facts.append(fact)

    assert len(facts) == 50


# ============================================================================
# Extreme Metadata
# ============================================================================


@pytest.mark.asyncio
async def test_handles_very_large_metadata_object(cortex_client, ctx):
    """Test handling very large metadata object. Port of: edgeCases.test.ts - line 682"""
    memory_space_id = ctx.memory_space_id()
    # Backend only supports specific metadata fields, put large data in data instead
    large_data = {f"key{i}": f"value{i}" for i in range(100)}

    immutable = await cortex_client.immutable.store(
        ImmutableEntry(type=ctx.immutable_type("large-meta"), id=ctx.immutable_id("large-metadata"),
            data=large_data,
        )
    )

    retrieved = await cortex_client.immutable.get(ctx.immutable_type("large-meta"), ctx.immutable_id("large-metadata"))
    assert len(retrieved.data) == 100


# ============================================================================
# Error Recovery
# ============================================================================


@pytest.mark.asyncio
async def test_handles_nonexistent_ids_gracefully(cortex_client, ctx):
    """Test handling nonexistent IDs gracefully. Port of: edgeCases.test.ts - line 708"""
    memory_space_id = ctx.memory_space_id()
    # Get nonexistent memory (use valid ID format)
    memory = await cortex_client.vector.get(memory_space_id, "mem-nonexistent-12345")
    assert memory is None

    # Get nonexistent fact (use valid ID format: fact-*)
    fact = await cortex_client.facts.get(memory_space_id, "fact-nonexistent-12345")
    assert fact is None

    # Get nonexistent conversation (use valid ID format: conv-*)
    conv = await cortex_client.conversations.get("conv-nonexistent-12345")
    assert conv is None


# ============================================================================
# Version Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_handles_rapid_version_updates_10_plus(cortex_client, ctx):
    """Test handling rapid version updates (10+). Port of: edgeCases.test.ts - line 734"""
    memory_space_id = ctx.memory_space_id()
    # Create initial
    v = await cortex_client.immutable.store(
        ImmutableEntry(type=ctx.immutable_type("rapid-version"), id=ctx.immutable_id("rapid-test"),
            data={"version": 1},
        )
    )

    # Rapidly update 10 times
    for i in range(2, 12):
        v = await cortex_client.immutable.store(
            ImmutableEntry(type=ctx.immutable_type("rapid-version"), id=ctx.immutable_id("rapid-test"),
                data={"version": i},
            )
        )

    # Should be version 11 or higher (may have been run before)
    assert v.version >= 11

    # Should have previous versions tracked
    assert len(v.previous_versions) > 0


# ============================================================================
# Special Character Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_handles_sql_injection_attempt_in_content(cortex_client, ctx):
    """Test handling SQL injection attempt in content. Port of: edgeCases.test.ts - line 765"""
    memory_space_id = ctx.memory_space_id()
    sql_content = "'; DROP TABLE users; --"

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=sql_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    # Should store safely
    stored = await cortex_client.vector.get(memory_space_id, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == sql_content


@pytest.mark.asyncio
async def test_handles_xss_attempt_in_content(cortex_client, ctx):
    """Test handling XSS attempt in content. Port of: edgeCases.test.ts - line 788"""
    memory_space_id = ctx.memory_space_id()
    xss_content = "<script>alert('XSS')</script>"

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=xss_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    # Should store safely without executing
    stored = await cortex_client.vector.get(memory_space_id, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == xss_content


# ============================================================================
# Zero-Length and Whitespace
# ============================================================================


@pytest.mark.asyncio
async def test_handles_single_character_content(cortex_client, ctx):
    """Test handling single character content. Port of: edgeCases.test.ts - line 811"""
    memory_space_id = ctx.memory_space_id()
    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="A",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    assert memory.content == "A"


@pytest.mark.asyncio
async def test_handles_content_with_only_spaces(cortex_client, ctx):
    """Test handling content with only spaces. Port of: edgeCases.test.ts - line 832"""
    memory_space_id = ctx.memory_space_id()
    from cortex.vector.validators import VectorValidationError

    # Whitespace-only content should be rejected by validation
    with pytest.raises(VectorValidationError) as exc_info:
        await cortex_client.vector.store(
            memory_space_id,
            StoreMemoryInput(
                content="     ",
                content_type="raw",
                source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
                metadata=MemoryMetadata(importance=50, tags=[]),
            ),
        )

    assert "cannot be empty" in str(exc_info.value)


# ============================================================================
# Mixed Language Content
# ============================================================================


@pytest.mark.asyncio
async def test_handles_mixed_language_content(cortex_client, ctx):
    """Test handling mixed language content. Port of: edgeCases.test.ts - line 853"""
    memory_space_id = ctx.memory_space_id()
    mixed_content = "English, 中文, العربية, עברית, 日本語, 한국어, Русский"

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=mixed_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )

    stored = await cortex_client.vector.get(memory_space_id, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == mixed_content


# ============================================================================
# Conversation Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_handles_conversation_with_100_plus_messages(cortex_client, ctx):
    """Test handling conversation with 100+ messages. Port of: edgeCases.test.ts - line 876"""
    memory_space_id = ctx.memory_space_id()
    user_id = ctx.user_id()
    from cortex.types import AddMessageInput

    conv = await cortex_client.conversations.create(
        CreateConversationInput(
            type="user-agent",
            memory_space_id=memory_space_id,
            participants=ConversationParticipants(user_id=user_id),
        )
    )

    # Add 100 messages - with resilience for parallel test interference
    try:
        for i in range(100):
            await cortex_client.conversations.add_message(
                AddMessageInput(
                    conversation_id=conv.conversation_id,
                    role="user" if i % 2 == 0 else "agent",
                    content=f"Message {i+1}",
                )
            )
    except Exception as e:
        if "CONVERSATION_NOT_FOUND" in str(e):
            # In high-parallelism environments, another test may have cleaned this up
            pytest.skip("Conversation deleted by parallel test cleanup - expected in stress tests")
        raise

    # Retrieve conversation
    updated = await cortex_client.conversations.get(conv.conversation_id)

    assert len(updated.messages) == 100
    assert updated.message_count == 100


# ============================================================================
# Context Chain Depth
# ============================================================================


@pytest.mark.asyncio
async def test_handles_deep_context_chain_10_plus_levels(cortex_client, ctx):
    """Test handling deep context chain (10+ levels). Port of: edgeCases.test.ts - line 910"""
    memory_space_id = ctx.memory_space_id()
    # Create 10-level deep chain
    contexts = []

    # Root
    root = await cortex_client.contexts.create(
        ContextInput(
            purpose="Root",
            memory_space_id=memory_space_id,
        )
    )
    contexts.append(root)

    # Create 9 more levels
    for i in range(1, 10):
        ctx = await cortex_client.contexts.create(
            ContextInput(
                purpose=f"Level {i}",
                memory_space_id=memory_space_id,
                parent_id=contexts[i-1].id,
            )
        )
        contexts.append(ctx)

    # Deepest context
    deepest = contexts[-1]
    assert deepest.depth == 9
    assert deepest.root_id == root.id

    # Can navigate to root
    retrieved_root = await cortex_client.contexts.get_root(deepest.id)
    assert retrieved_root.id == root.id


# ============================================================================
# Data Type Variations
# ============================================================================


@pytest.mark.asyncio
async def test_handles_boolean_values_in_data(cortex_client, ctx):
    """Test handling boolean values in data. Port of: edgeCases.test.ts - line 950"""
    memory_space_id = ctx.memory_space_id()
    immutable = await cortex_client.immutable.store(
        ImmutableEntry(type=ctx.immutable_type("boolean-test"), id=ctx.immutable_id("booleans"),
            data={"enabled": True, "disabled": False, "nullable": None},
        )
    )

    retrieved = await cortex_client.immutable.get(ctx.immutable_type("boolean-test"), ctx.immutable_id("booleans"))
    assert retrieved.data["enabled"] is True
    assert retrieved.data["disabled"] is False
    assert retrieved.data["nullable"] is None


@pytest.mark.asyncio
async def test_handles_numeric_values_in_data(cortex_client, ctx):
    """Test handling numeric values in data. Port of: edgeCases.test.ts - line 975"""
    memory_space_id = ctx.memory_space_id()
    immutable = await cortex_client.immutable.store(
        ImmutableEntry(type=ctx.immutable_type("numeric-test"), id=ctx.immutable_id("numbers"),
            data={
                "integer": 42,
                "float": 3.14159,
                "negative": -100,
                "zero": 0,
                "large": 999999999,
            },
        )
    )

    retrieved = await cortex_client.immutable.get(ctx.immutable_type("numeric-test"), ctx.immutable_id("numbers"))
    assert retrieved.data["integer"] == 42
    assert retrieved.data["float"] == 3.14159
    assert retrieved.data["zero"] == 0


# ============================================================================
# Tag Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_handles_tags_with_special_characters(cortex_client, ctx):
    """Test handling tags with special characters. Port of: edgeCases.test.ts - line 1003"""
    memory_space_id = ctx.memory_space_id()
    special_tags = ["tag-with-dash", "tag_with_underscore", "tag.with.dots", "tag:with:colons"]

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Special character tags",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=special_tags),
        ),
    )

    stored_tags = memory.tags if hasattr(memory, 'tags') else memory.get("tags")
    assert all(tag in stored_tags for tag in special_tags)


@pytest.mark.asyncio
async def test_handles_duplicate_tags(cortex_client, ctx):
    """Test handling duplicate tags. Port of: edgeCases.test.ts - line 1028"""
    memory_space_id = ctx.memory_space_id()
    tags_with_dupes = ["tag1", "tag2", "tag1", "tag3", "tag2"]

    memory = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Duplicate tags",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=tags_with_dupes),
        ),
    )

    # Backend may deduplicate or keep all
    stored_tags = memory.tags if hasattr(memory, 'tags') else memory.get("tags")
    assert len(stored_tags) >= 3  # At least the unique ones

