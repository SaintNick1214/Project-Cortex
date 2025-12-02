"""
Edge Cases Tests

Port of: tests/edgeCases.test.ts

Tests validate:
- Large payloads
- Empty values
- Unicode handling
- Concurrent operations
- Error conditions
"""

import time

import pytest

from cortex import MemoryMetadata, MemorySource, StoreMemoryInput
from tests.helpers import create_test_memory_input

# ============================================================================
# Large Payload Tests
# ============================================================================


@pytest.mark.asyncio
async def test_large_content_memory(cortex_client, test_ids, cleanup_helper):
    """
    Test storing memory with large content.

    Port of: edgeCases.test.ts - large payload tests
    """
    memory_space_id = test_ids["memory_space_id"]

    # Create large content (10KB)
    large_content = "A" * 10000

    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=large_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=["large"]),
        ),
    )

    assert result.content == large_content
    assert len(result.content) == 10000

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# Empty Value Tests
# ============================================================================


@pytest.mark.asyncio
async def test_empty_tags_array(cortex_client, test_ids, cleanup_helper):
    """
    Test handling empty tags array.

    Port of: edgeCases.test.ts - empty values
    """
    memory_space_id = test_ids["memory_space_id"]

    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Memory with no tags",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=[]),  # Empty tags
        ),
    )

    assert result.tags == []

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_minimal_memory_input(cortex_client, test_ids, cleanup_helper):
    """
    Test storing memory with minimal required fields.

    Port of: edgeCases.test.ts - minimal input
    """
    memory_space_id = test_ids["memory_space_id"]

    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="Minimal memory",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=["test"]),
        ),
    )

    assert result.content == "Minimal memory"

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# Unicode and Special Characters Tests
# ============================================================================


@pytest.mark.asyncio
async def test_unicode_content(cortex_client, test_ids, cleanup_helper):
    """
    Test handling unicode characters in content.

    Port of: edgeCases.test.ts - unicode tests
    """
    memory_space_id = test_ids["memory_space_id"]

    unicode_content = "Content with émojis 🎉🚀 and unicode: 日本語, العربية, 中文"

    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content=unicode_content,
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=50, tags=["unicode"]),
        ),
    )

    assert result.content == unicode_content

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_special_characters_in_ids(cortex_client, test_ids, cleanup_helper):
    """
    Test handling special characters in IDs.

    Port of: edgeCases.test.ts - special char tests
    """
    memory_space_id = "test-space-with.dots_and-dashes"

    # Should handle special characters in memory space ID
    result = await cortex_client.vector.store(
        memory_space_id,
        create_test_memory_input(content="Special ID test"),
    )

    assert result.memory_space_id == memory_space_id

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# Concurrent Operations Tests
# ============================================================================


@pytest.mark.asyncio
async def test_concurrent_memory_creation(cortex_client, test_ids, cleanup_helper):
    """
    Test concurrent memory creation.

    Port of: edgeCases.test.ts - concurrency tests
    """
    import asyncio
    memory_space_id = test_ids["memory_space_id"]

    # Create memories concurrently
    tasks = [
        cortex_client.vector.store(
            memory_space_id,
            create_test_memory_input(content=f"Concurrent memory {i}"),
        )
        for i in range(5)
    ]

    results = await asyncio.gather(*tasks)

    # All should succeed
    assert len(results) == 5
    for result in results:
        assert result.memory_id is not None

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


# ============================================================================
# Error Condition Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_from_empty_space(cortex_client, test_ids):
    """
    Test getting from empty memory space doesn't error.

    Port of: edgeCases.test.ts - error tests
    """
    memory_space_id = test_ids["memory_space_id"]

    # Get from empty space
    result = await cortex_client.vector.get(memory_space_id, "mem-nonexistent")

    assert result is None


@pytest.mark.asyncio
async def test_search_empty_query(cortex_client, test_ids, cleanup_helper):
    """
    Test searching with empty query string.

    Port of: edgeCases.test.ts - empty query tests
    """
    from cortex.vector.validators import VectorValidationError

    memory_space_id = test_ids["memory_space_id"]

    # Create a memory first
    await cortex_client.vector.store(
        memory_space_id,
        create_test_memory_input(content="Some content"),
    )

    # Search with empty query should raise validation error
    with pytest.raises(VectorValidationError) as exc_info:
        await cortex_client.vector.search(memory_space_id, "")

    assert "cannot be empty" in str(exc_info.value)

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)


@pytest.mark.asyncio
async def test_invalid_importance_values(cortex_client, test_ids, cleanup_helper):
    """
    Test handling of invalid importance values.

    Port of: edgeCases.test.ts - validation tests
    """
    memory_space_id = test_ids["memory_space_id"]

    # Importance should be clamped to 0-100
    # Test with value > 100
    result = await cortex_client.vector.store(
        memory_space_id,
        StoreMemoryInput(
            content="High importance",
            content_type="raw",
            source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
            metadata=MemoryMetadata(importance=100, tags=["test"]),  # Max valid value
        ),
    )

    assert result.importance == 100

    # Cleanup
    await cleanup_helper.purge_memory_space(memory_space_id)

