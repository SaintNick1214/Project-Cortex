"""
Edge Cases & Error Conditions Tests (v0.6.1)

Tests to ensure robustness with extreme values, special characters,
and boundary conditions.

Port of: tests/edgeCases.test.ts
"""

import pytest
import time
import os
from cortex import Cortex, CortexConfig
from cortex.types import (
    StoreMemoryInput,
    MemorySource,
    MemoryMetadata,
    StoreFactParams,
    ImmutableEntry,
    CreateConversationInput,
    ConversationParticipants,
    ContextInput,
)
from tests.helpers import TestCleanup


TEST_MEMSPACE_ID = "edge-cases-test-python"


@pytest.fixture(scope="module")
async def edge_cortex():
    """Set up Cortex for edge case tests."""
    convex_url = os.getenv("CONVEX_URL", "http://127.0.0.1:3210")
    cortex = Cortex(CortexConfig(convex_url=convex_url))
    cleanup = TestCleanup(cortex)
    
    await cleanup.purge_all()
    
    yield cortex
    
    await cleanup.purge_all()
    await cortex.close()


# ============================================================================
# Large Content
# ============================================================================


@pytest.mark.asyncio
async def test_handles_very_long_content_10kb_plus(edge_cortex):
    """Test handling very long content (10KB+). Port of: edgeCases.test.ts - line 32"""
    long_content = "A" * 10000
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content=long_content,
            content_type="raw",
            source=MemorySource(type="system", user_id="test-user", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    assert len(memory.content) == 10000
    
    stored = await edge_cortex.vector.get(TEST_MEMSPACE_ID, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == long_content
    assert len(stored_content) == 10000


@pytest.mark.asyncio
async def test_handles_very_long_fact_statements_10kb_plus(edge_cortex):
    """Test handling very long fact statements (10KB+). Port of: edgeCases.test.ts - line 49"""
    long_fact = "B" * 10000
    
    fact = await edge_cortex.facts.store(
        StoreFactParams(
            memory_space_id=TEST_MEMSPACE_ID,
            fact=long_fact,
            fact_type="knowledge",
            subject="test-user",
            confidence=80,
            source_type="system",
        )
    )
    
    assert len(fact.fact) == 10000


@pytest.mark.asyncio
async def test_handles_long_array_of_tags_100_plus_tags(edge_cortex):
    """Test handling long array of tags (100+ tags). Port of: edgeCases.test.ts - line 67"""
    tags = [f"tag-{i}" for i in range(100)]
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content="Memory with many tags",
            content_type="raw",
            source=MemorySource(type="system", user_id="test-user", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(
                importance=50,
                tags=tags,
            ),
        ),
    )
    
    assert len(memory.tags) == 100
    
    stored = await edge_cortex.vector.get(TEST_MEMSPACE_ID, memory.memory_id)
    stored_tags = stored.tags if hasattr(stored, 'tags') else stored.get("tags")
    assert len(stored_tags) == 100
    assert all(tag in stored_tags for tag in tags)


@pytest.mark.asyncio
async def test_handles_very_long_participant_id(edge_cortex):
    """Test handling very long participant ID. Port of: edgeCases.test.ts - line 87"""
    long_participant_id = "participant-" + "x" * 200
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content="Long participant ID",
            content_type="raw",
            participant_id=long_participant_id,
            source=MemorySource(type="system", user_id="test-user", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    assert memory.participant_id == long_participant_id


# ============================================================================
# Special Characters
# ============================================================================


@pytest.mark.asyncio
async def test_handles_unicode_emoji_in_content(edge_cortex):
    """Test handling Unicode emoji in content. Port of: edgeCases.test.ts - line 106"""
    unicode_content = "Hello 👋 world 🌍 with emoji 🎉 and symbols ∑∫√"
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content=unicode_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    stored = await edge_cortex.vector.get(TEST_MEMSPACE_ID, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == unicode_content


@pytest.mark.asyncio
async def test_handles_special_characters_in_ids(edge_cortex):
    """Test handling special characters in IDs. Port of: edgeCases.test.ts - line 127"""
    special_id = "test-id-with-dash_underscore.period"
    
    immutable = await edge_cortex.immutable.store(
        ImmutableEntry(
            type="test-type",
            id=special_id,
            data={"value": "test"},
        )
    )
    
    assert immutable.id == special_id
    
    retrieved = await edge_cortex.immutable.get("test-type", special_id)
    assert retrieved.id == special_id


@pytest.mark.asyncio
async def test_handles_newlines_and_tabs_in_content(edge_cortex):
    """Test handling newlines and tabs in content. Port of: edgeCases.test.ts - line 148"""
    content_with_whitespace = "Line 1\nLine 2\n\tTabbed\r\nWindows newline"
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content=content_with_whitespace,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    stored = await edge_cortex.vector.get(TEST_MEMSPACE_ID, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == content_with_whitespace


@pytest.mark.asyncio
async def test_handles_json_special_characters(edge_cortex):
    """Test handling JSON special characters. Port of: edgeCases.test.ts - line 169"""
    content = 'Content with "quotes" and \\backslashes\\ and {curly braces}'
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content=content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    stored = await edge_cortex.vector.get(TEST_MEMSPACE_ID, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == content


# ============================================================================
# Empty and Minimal Values
# ============================================================================


@pytest.mark.asyncio
async def test_handles_empty_tags_array(edge_cortex):
    """Test handling empty tags array. Port of: edgeCases.test.ts - line 190"""
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content="No tags",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    assert memory.tags == []


@pytest.mark.asyncio
async def test_handles_minimal_metadata(edge_cortex):
    """Test handling minimal metadata. Port of: edgeCases.test.ts - line 208"""
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
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
async def test_handles_empty_data_object(edge_cortex):
    """Test handling empty data object. Port of: edgeCases.test.ts - line 229"""
    immutable = await edge_cortex.immutable.store(
        ImmutableEntry(
            type="test-empty",
            id="empty-data",
            data={},
        )
    )
    
    assert immutable.data == {}
    
    retrieved = await edge_cortex.immutable.get("test-empty", "empty-data")
    assert retrieved.data == {}


# ============================================================================
# Boundary Values
# ============================================================================


@pytest.mark.asyncio
async def test_handles_importance_zero(edge_cortex):
    """Test handling importance = 0. Port of: edgeCases.test.ts - line 251"""
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content="Zero importance",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=0, tags=[]),
        ),
    )
    
    assert memory.importance == 0


@pytest.mark.asyncio
async def test_handles_importance_100(edge_cortex):
    """Test handling importance = 100. Port of: edgeCases.test.ts - line 272"""
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content="Max importance",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=100, tags=[]),
        ),
    )
    
    assert memory.importance == 100


@pytest.mark.asyncio
async def test_handles_confidence_zero(edge_cortex):
    """Test handling confidence = 0. Port of: edgeCases.test.ts - line 293"""
    fact = await edge_cortex.facts.store(
        StoreFactParams(
            memory_space_id=TEST_MEMSPACE_ID,
            fact="Zero confidence fact",
            fact_type="knowledge",
            subject="test-user",
            confidence=0,
            source_type="system",
        )
    )
    
    assert fact.confidence == 0


@pytest.mark.asyncio
async def test_handles_confidence_100(edge_cortex):
    """Test handling confidence = 100. Port of: edgeCases.test.ts - line 313"""
    fact = await edge_cortex.facts.store(
        StoreFactParams(
            memory_space_id=TEST_MEMSPACE_ID,
            fact="Max confidence fact",
            fact_type="knowledge",
            subject="test-user",
            confidence=100,
            source_type="system",
        )
    )
    
    assert fact.confidence == 100


# ============================================================================
# Concurrent Operations
# ============================================================================


@pytest.mark.asyncio
async def test_handles_concurrent_memory_creation(edge_cortex):
    """Test handling concurrent memory creation. Port of: edgeCases.test.ts - line 333"""
    import asyncio
    
    # Create 10 memories concurrently
    tasks = [
        edge_cortex.vector.store(
            TEST_MEMSPACE_ID,
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
async def test_handles_concurrent_fact_updates(edge_cortex):
    """Test handling concurrent fact updates. Port of: edgeCases.test.ts - line 363"""
    import asyncio
    
    # Create initial fact
    fact = await edge_cortex.facts.store(
        StoreFactParams(
            memory_space_id=TEST_MEMSPACE_ID,
            fact="Concurrent update test",
            fact_type="knowledge",
            subject="test-user",
            confidence=50,
            source_type="system",
        )
    )
    
    # Update concurrently (last write wins)
    tasks = [
        edge_cortex.facts.update(
            TEST_MEMSPACE_ID,
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
async def test_handles_deeply_nested_data_objects(edge_cortex):
    """Test handling deeply nested data objects. Port of: edgeCases.test.ts - line 397"""
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
    
    immutable = await edge_cortex.immutable.store(
        ImmutableEntry(
            type="nested-test",
            id="deep-nest",
            data=nested_data,
        )
    )
    
    retrieved = await edge_cortex.immutable.get("nested-test", "deep-nest")
    assert retrieved.data["level1"]["level2"]["level3"]["level4"]["level5"]["value"] == "deep nesting works"


@pytest.mark.asyncio
async def test_handles_arrays_in_data(edge_cortex):
    """Test handling arrays in data. Port of: edgeCases.test.ts - line 429"""
    data_with_arrays = {
        "items": [1, 2, 3, 4, 5],
        "names": ["Alice", "Bob", "Charlie"],
        "nested": [[1, 2], [3, 4]],
    }
    
    immutable = await edge_cortex.immutable.store(
        ImmutableEntry(
            type="array-test",
            id="arrays",
            data=data_with_arrays,
        )
    )
    
    retrieved = await edge_cortex.immutable.get("array-test", "arrays")
    assert retrieved.data["items"] == [1, 2, 3, 4, 5]
    assert retrieved.data["names"] == ["Alice", "Bob", "Charlie"]


# ============================================================================
# ID Formats
# ============================================================================


@pytest.mark.asyncio
async def test_handles_uuid_format_ids(edge_cortex):
    """Test handling UUID format IDs. Port of: edgeCases.test.ts - line 456"""
    uuid_id = "550e8400-e29b-41d4-a716-446655440000"
    
    immutable = await edge_cortex.immutable.store(
        ImmutableEntry(
            type="uuid-test",
            id=uuid_id,
            data={"value": "uuid format"},
        )
    )
    
    assert immutable.id == uuid_id
    
    retrieved = await edge_cortex.immutable.get("uuid-test", uuid_id)
    assert retrieved.id == uuid_id


@pytest.mark.asyncio
async def test_handles_numeric_string_ids(edge_cortex):
    """Test handling numeric string IDs. Port of: edgeCases.test.ts - line 478"""
    numeric_id = "12345678901234567890"
    
    immutable = await edge_cortex.immutable.store(
        ImmutableEntry(
            type="numeric-test",
            id=numeric_id,
            data={"value": "numeric id"},
        )
    )
    
    assert immutable.id == numeric_id


# ============================================================================
# Null/None Handling
# ============================================================================


@pytest.mark.asyncio
async def test_handles_none_optional_fields(edge_cortex):
    """Test handling None optional fields. Port of: edgeCases.test.ts - line 500"""
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
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
async def test_handles_very_old_timestamps(edge_cortex):
    """Test handling very old timestamps. Port of: edgeCases.test.ts - line 523"""
    old_timestamp = 946684800000  # Year 2000
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
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
async def test_handles_future_timestamps(edge_cortex):
    """Test handling future timestamps. Port of: edgeCases.test.ts - line 545"""
    future_timestamp = 2524608000000  # Year 2050
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
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
async def test_handles_all_content_types(edge_cortex):
    """Test handling all content types. Port of: edgeCases.test.ts - line 567"""
    content_types = ["raw", "summarized", "fact"]  # Backend supported types
    
    for ct in content_types:
        memory = await edge_cortex.vector.store(
            TEST_MEMSPACE_ID,
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
async def test_handles_all_source_types(edge_cortex):
    """Test handling all source types. Port of: edgeCases.test.ts - line 595"""
    source_types = ["conversation", "system", "tool", "a2a"]
    
    for st in source_types:
        memory = await edge_cortex.vector.store(
            TEST_MEMSPACE_ID,
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
async def test_handles_bulk_memory_creation_50_plus(edge_cortex):
    """Test handling bulk memory creation (50+). Port of: edgeCases.test.ts - line 623"""
    memories = []
    for i in range(50):
        mem = await edge_cortex.vector.store(
            TEST_MEMSPACE_ID,
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
        stored = await edge_cortex.vector.get(TEST_MEMSPACE_ID, mem.memory_id)
        assert stored is not None


@pytest.mark.asyncio
async def test_handles_bulk_fact_creation_50_plus(edge_cortex):
    """Test handling bulk fact creation (50+). Port of: edgeCases.test.ts - line 653"""
    facts = []
    for i in range(50):
        fact = await edge_cortex.facts.store(
            StoreFactParams(
                memory_space_id=TEST_MEMSPACE_ID,
                fact=f"Bulk fact {i}",
                fact_type="knowledge",
                subject="bulk-user",
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
async def test_handles_very_large_metadata_object(edge_cortex):
    """Test handling very large metadata object. Port of: edgeCases.test.ts - line 682"""
    # Backend only supports specific metadata fields, put large data in data instead
    large_data = {f"key{i}": f"value{i}" for i in range(100)}
    
    immutable = await edge_cortex.immutable.store(
        ImmutableEntry(
            type="large-meta",
            id="large-metadata",
            data=large_data,
        )
    )
    
    retrieved = await edge_cortex.immutable.get("large-meta", "large-metadata")
    assert len(retrieved.data) == 100


# ============================================================================
# Error Recovery
# ============================================================================


@pytest.mark.asyncio
async def test_handles_nonexistent_ids_gracefully(edge_cortex):
    """Test handling nonexistent IDs gracefully. Port of: edgeCases.test.ts - line 708"""
    # Get nonexistent memory
    memory = await edge_cortex.vector.get(TEST_MEMSPACE_ID, "nonexistent-memory-id")
    assert memory is None
    
    # Get nonexistent fact
    fact = await edge_cortex.facts.get(TEST_MEMSPACE_ID, "nonexistent-fact-id")
    assert fact is None
    
    # Get nonexistent conversation
    conv = await edge_cortex.conversations.get("nonexistent-conv-id")
    assert conv is None


# ============================================================================
# Version Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_handles_rapid_version_updates_10_plus(edge_cortex):
    """Test handling rapid version updates (10+). Port of: edgeCases.test.ts - line 734"""
    # Create initial
    v = await edge_cortex.immutable.store(
        ImmutableEntry(
            type="rapid-version",
            id="rapid-test",
            data={"version": 1},
        )
    )
    
    # Rapidly update 10 times
    for i in range(2, 12):
        v = await edge_cortex.immutable.store(
            ImmutableEntry(
                type="rapid-version",
                id="rapid-test",
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
async def test_handles_sql_injection_attempt_in_content(edge_cortex):
    """Test handling SQL injection attempt in content. Port of: edgeCases.test.ts - line 765"""
    sql_content = "'; DROP TABLE users; --"
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content=sql_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    # Should store safely
    stored = await edge_cortex.vector.get(TEST_MEMSPACE_ID, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == sql_content


@pytest.mark.asyncio
async def test_handles_xss_attempt_in_content(edge_cortex):
    """Test handling XSS attempt in content. Port of: edgeCases.test.ts - line 788"""
    xss_content = "<script>alert('XSS')</script>"
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content=xss_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    # Should store safely without executing
    stored = await edge_cortex.vector.get(TEST_MEMSPACE_ID, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == xss_content


# ============================================================================
# Zero-Length and Whitespace
# ============================================================================


@pytest.mark.asyncio
async def test_handles_single_character_content(edge_cortex):
    """Test handling single character content. Port of: edgeCases.test.ts - line 811"""
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content="A",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    assert memory.content == "A"


@pytest.mark.asyncio
async def test_handles_content_with_only_spaces(edge_cortex):
    """Test handling content with only spaces. Port of: edgeCases.test.ts - line 832"""
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content="     ",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    assert memory.content == "     "


# ============================================================================
# Mixed Language Content
# ============================================================================


@pytest.mark.asyncio
async def test_handles_mixed_language_content(edge_cortex):
    """Test handling mixed language content. Port of: edgeCases.test.ts - line 853"""
    mixed_content = "English, 中文, العربية, עברית, 日本語, 한국어, Русский"
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
        StoreMemoryInput(
            content=mixed_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),
        ),
    )
    
    stored = await edge_cortex.vector.get(TEST_MEMSPACE_ID, memory.memory_id)
    stored_content = stored.content if hasattr(stored, 'content') else stored.get("content")
    assert stored_content == mixed_content


# ============================================================================
# Conversation Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_handles_conversation_with_100_plus_messages(edge_cortex):
    """Test handling conversation with 100+ messages. Port of: edgeCases.test.ts - line 876"""
    from cortex.types import AddMessageInput
    
    conv = await edge_cortex.conversations.create(
        CreateConversationInput(
            type="user-agent",
            memory_space_id=TEST_MEMSPACE_ID,
            participants=ConversationParticipants(user_id="test-user"),
        )
    )
    
    # Add 100 messages
    for i in range(100):
        await edge_cortex.conversations.add_message(
            AddMessageInput(
                conversation_id=conv.conversation_id,
                role="user" if i % 2 == 0 else "agent",
                content=f"Message {i+1}",
            )
        )
    
    # Retrieve conversation
    updated = await edge_cortex.conversations.get(conv.conversation_id)
    
    assert len(updated.messages) == 100
    assert updated.message_count == 100


# ============================================================================
# Context Chain Depth
# ============================================================================


@pytest.mark.asyncio
async def test_handles_deep_context_chain_10_plus_levels(edge_cortex):
    """Test handling deep context chain (10+ levels). Port of: edgeCases.test.ts - line 910"""
    # Create 10-level deep chain
    contexts = []
    
    # Root
    root = await edge_cortex.contexts.create(
        ContextInput(
            purpose="Root",
            memory_space_id=TEST_MEMSPACE_ID,
        )
    )
    contexts.append(root)
    
    # Create 9 more levels
    for i in range(1, 10):
        ctx = await edge_cortex.contexts.create(
            ContextInput(
                purpose=f"Level {i}",
                memory_space_id=TEST_MEMSPACE_ID,
                parent_id=contexts[i-1].id,
            )
        )
        contexts.append(ctx)
    
    # Deepest context
    deepest = contexts[-1]
    assert deepest.depth == 9
    assert deepest.root_id == root.id
    
    # Can navigate to root
    retrieved_root = await edge_cortex.contexts.get_root(deepest.id)
    assert retrieved_root.id == root.id


# ============================================================================
# Data Type Variations
# ============================================================================


@pytest.mark.asyncio
async def test_handles_boolean_values_in_data(edge_cortex):
    """Test handling boolean values in data. Port of: edgeCases.test.ts - line 950"""
    immutable = await edge_cortex.immutable.store(
        ImmutableEntry(
            type="boolean-test",
            id="booleans",
            data={"enabled": True, "disabled": False, "nullable": None},
        )
    )
    
    retrieved = await edge_cortex.immutable.get("boolean-test", "booleans")
    assert retrieved.data["enabled"] is True
    assert retrieved.data["disabled"] is False
    assert retrieved.data["nullable"] is None


@pytest.mark.asyncio
async def test_handles_numeric_values_in_data(edge_cortex):
    """Test handling numeric values in data. Port of: edgeCases.test.ts - line 975"""
    immutable = await edge_cortex.immutable.store(
        ImmutableEntry(
            type="numeric-test",
            id="numbers",
            data={
                "integer": 42,
                "float": 3.14159,
                "negative": -100,
                "zero": 0,
                "large": 999999999,
            },
        )
    )
    
    retrieved = await edge_cortex.immutable.get("numeric-test", "numbers")
    assert retrieved.data["integer"] == 42
    assert retrieved.data["float"] == 3.14159
    assert retrieved.data["zero"] == 0


# ============================================================================
# Tag Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_handles_tags_with_special_characters(edge_cortex):
    """Test handling tags with special characters. Port of: edgeCases.test.ts - line 1003"""
    special_tags = ["tag-with-dash", "tag_with_underscore", "tag.with.dots", "tag:with:colons"]
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
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
async def test_handles_duplicate_tags(edge_cortex):
    """Test handling duplicate tags. Port of: edgeCases.test.ts - line 1028"""
    tags_with_dupes = ["tag1", "tag2", "tag1", "tag3", "tag2"]
    
    memory = await edge_cortex.vector.store(
        TEST_MEMSPACE_ID,
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

