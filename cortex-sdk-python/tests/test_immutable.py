"""
Tests for Immutable Store API (Layer 1b)

Port of: tests/immutable.test.ts

Tests validate:
- SDK API calls
- Storage operations
- Versioning behavior
- Note: Immutable storage is GLOBAL across all memory spaces
"""

import pytest
from cortex import ImmutableEntry
from tests.helpers import TestCleanup


# ============================================================================
# store() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_store_creates_version_1(cortex_client):
    """
    Test creating version 1 for new entry.
    
    Port of: immutable.test.ts - line 83
    """
    import time
    unique_id = f"refund-policy-test-{int(time.time() * 1000)}"
    
    result = await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-kb-article",
            id=unique_id,
            data={
                "title": "Refund Policy",
                "content": "Refunds available within 30 days",
            },
            metadata={
                "publishedBy": "admin",
                "tags": ["policy", "refunds"],
            },
        )
    )
    
    # Validate result
    assert result.type == "test-kb-article"
    assert result.id == unique_id
    assert result.version == 1
    assert result.data["title"] == "Refund Policy"
    assert len(result.previous_versions) == 0
    
    # Cleanup
    await cortex_client.immutable.purge("test-kb-article", unique_id)


@pytest.mark.asyncio
async def test_store_creates_version_2_on_update(cortex_client):
    """
    Test creating version 2 when updating existing entry.
    
    Port of: immutable.test.ts - versioning tests
    """
    import time
    unique_id = f"test-doc-{int(time.time() * 1000)}"
    
    # Create version 1
    v1 = await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-article",
            id=unique_id,
            data={"content": "Version 1"},
        )
    )
    
    assert v1.version == 1
    
    # Update to version 2
    v2 = await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-article",
            id=unique_id,
            data={"content": "Version 2"},
        )
    )
    
    assert v2.version == 2
    assert v2.data["content"] == "Version 2"
    # previous_versions is list of version objects with {version, data, timestamp}
    version_numbers = [v.get("version") if isinstance(v, dict) else v.version for v in v2.previous_versions]
    assert 1 in version_numbers
    
    # Cleanup
    await cortex_client.immutable.purge("test-article", unique_id)


# ============================================================================
# get() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_latest_version(cortex_client):
    """
    Test getting latest version of an entry.
    
    Port of: immutable.test.ts - get tests
    """
    # Create entry
    stored = await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-config",
            id="app-settings",
            data={"theme": "dark"},
        )
    )
    
    # Get latest version
    result = await cortex_client.immutable.get("test-config", "app-settings")
    
    assert result is not None
    assert result.type == "test-config"
    assert result.id == "app-settings"
    assert result.data["theme"] == "dark"
    
    # Cleanup
    await cortex_client.immutable.purge("test-config", "app-settings")


@pytest.mark.asyncio
async def test_get_nonexistent_returns_none(cortex_client):
    """
    Test that getting non-existent entry returns None.
    
    Port of: immutable.test.ts - get tests
    """
    result = await cortex_client.immutable.get("test-config", "does-not-exist")
    
    assert result is None


# ============================================================================
# getVersion() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_specific_version(cortex_client):
    """
    Test retrieving specific version of an entry.
    
    Port of: immutable.test.ts - getVersion tests
    """
    # Create version 1
    v1 = await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-config",
            id="settings-ver",
            data={"value": "v1"},
        )
    )
    
    # Create version 2
    v2 = await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-config",
            id="settings-ver",
            data={"value": "v2"},
        )
    )
    
    # Get version 1
    retrieved_v1 = await cortex_client.immutable.get_version("test-config", "settings-ver", 1)
    
    assert retrieved_v1 is not None
    assert retrieved_v1.version == 1
    assert retrieved_v1.data["value"] == "v1"
    
    # Get version 2
    retrieved_v2 = await cortex_client.immutable.get_version("test-config", "settings-ver", 2)
    
    assert retrieved_v2 is not None
    assert retrieved_v2.version == 2
    assert retrieved_v2.data["value"] == "v2"
    
    # Cleanup
    await cortex_client.immutable.purge("test-config", "settings-ver")


# ============================================================================
# getHistory() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_version_history(cortex_client):
    """
    Test retrieving version history.
    
    Port of: immutable.test.ts - getHistory tests
    """
    # Create entry with multiple versions
    await cortex_client.immutable.store(
        ImmutableEntry(type="test-doc", id="history-test", data={"content": "Version 1"})
    )
    
    await cortex_client.immutable.store(
        ImmutableEntry(type="test-doc", id="history-test", data={"content": "Version 2"})
    )
    
    await cortex_client.immutable.store(
        ImmutableEntry(type="test-doc", id="history-test", data={"content": "Version 3"})
    )
    
    # Get history
    history = await cortex_client.immutable.get_history("test-doc", "history-test")
    
    assert len(history) >= 3
    
    # Cleanup
    await cortex_client.immutable.purge("test-doc", "history-test")


# ============================================================================
# list() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_entries(cortex_client):
    """
    Test listing immutable entries.
    
    Port of: immutable.test.ts - list tests
    """
    # Create multiple entries
    for i in range(3):
        await cortex_client.immutable.store(
            ImmutableEntry(
                type="test-item",
                id=f"list-item-{i}",
                data={"value": i},
            )
        )
    
    # List entries
    result = await cortex_client.immutable.list(limit=100)
    
    # Should return at least 3 entries
    entries = result if isinstance(result, list) else result.get("records", [])
    test_entries = [e for e in entries if (e.get("type") if isinstance(e, dict) else e.type) == "test-item"]
    assert len(test_entries) >= 3
    
    # Cleanup
    for i in range(3):
        await cortex_client.immutable.purge("test-item", f"list-item-{i}")


# ============================================================================
# count() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_count_entries(cortex_client):
    """
    Test counting immutable entries.
    
    Port of: immutable.test.ts - count tests
    """
    # Create entries
    for i in range(3):
        await cortex_client.immutable.store(
            ImmutableEntry(
                type="test-count",
                id=f"count-item-{i}",
                data={"value": i},
            )
        )
    
    # Count entries
    count = await cortex_client.immutable.count()
    
    # Should have at least 3
    assert count >= 3
    
    # Cleanup
    for i in range(3):
        await cortex_client.immutable.purge("test-count", f"count-item-{i}")


# ============================================================================
# purge() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_purge_entry(cortex_client):
    """
    Test purging an immutable entry (all versions).
    
    Port of: immutable.test.ts - purge tests
    """
    # Create entry with multiple versions
    await cortex_client.immutable.store(
        ImmutableEntry(type="test-purge", id="purge-test", data={"content": "Version 1"})
    )
    
    await cortex_client.immutable.store(
        ImmutableEntry(type="test-purge", id="purge-test", data={"content": "Version 2"})
    )
    
    # Purge entry
    result = await cortex_client.immutable.purge("test-purge", "purge-test")
    
    # Verify purged
    retrieved = await cortex_client.immutable.get("test-purge", "purge-test")
    
    assert retrieved is None


# ============================================================================
# search() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_search_immutable(cortex_client):
    """
    Test searching immutable entries.
    
    Port of: immutable.test.ts - search tests
    """
    # Create searchable entries
    await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-search-article",
            id="article-python",
            data={
                "title": "Getting Started with Python",
                "content": "Python is a great programming language",
            },
        )
    )
    
    await cortex_client.immutable.store(
        ImmutableEntry(
            type="test-search-article",
            id="article-js",
            data={
                "title": "Advanced JavaScript",
                "content": "JavaScript async patterns",
            },
        )
    )
    
    # Search for "Python"
    results = await cortex_client.immutable.search("Python")
    
    # Should find the Python article
    # Backend returns {entry, score, highlights} format
    assert len(results) > 0
    found_python = any(
        "Python" in str(r.get("entry", {}).get("data", {}))
        for r in results
    )
    assert found_python
    
    # Cleanup
    await cortex_client.immutable.purge("test-search-article", "article-python")
    await cortex_client.immutable.purge("test-search-article", "article-js")
